// ranking-backend/public/script.js
document.addEventListener('DOMContentLoaded', () => {
    const themeToggleButton = document.getElementById('theme-toggle-button');
    const body = document.body;
    const loadingMessage = document.getElementById('loading-message'); // Adicionado para referência
    const errorMessageArea = document.getElementById('error-message-area'); // Adicionado para referência

    function setTheme(theme) {
        if (theme === 'light') {
            body.classList.add('light-mode');
            themeToggleButton.textContent = '🌙 Tema Escuro';
        } else {
            body.classList.remove('light-mode');
            themeToggleButton.textContent = '☀️ Tema Claro';
        }
        localStorage.setItem('theme', theme);
    }

    themeToggleButton.addEventListener('click', () => {
        body.classList.toggle('light-mode'); // Simplificado
        setTheme(body.classList.contains('light-mode') ? 'light' : 'dark');
    });

    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);

    const bsTopAnalystsGrid = document.getElementById('bs-top-analysts-grid');
    const bbTopAnalystsGrid = document.getElementById('bb-top-analysts-grid');
    const bsOtherAnalystsList = document.getElementById('bs-other-analysts-list');
    const bbOtherAnalystsList = document.getElementById('bb-other-analysts-list');
    
    const progressFill = document.getElementById('progress-fill');
    const progressTextSpan = document.getElementById('progress-text'); // Renomeado para evitar conflito com variável global
    const metaTargetValueEl = document.getElementById('meta-target-value');
    const metaCurrentValueEl = document.getElementById('meta-current-value');

    let previousRankingData = { bsAnalysts: [], bbAnalysts: [] };
    const API_URL = '/api/ranking'; // Ou seu URL de produção ou 'ranking_data.json'

    function formatCurrency(value) {
        if (typeof value !== 'number' || isNaN(value)) value = 0;
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function createAnalystCard(analyst, teamType, movement = 'stay') {
        const article = document.createElement('article');
        article.classList.add('analyst-card');
        const safeName = analyst.name.replace(/[^a-zA-Z0-9_-]/g, '-'); // Nome seguro para ID
        article.id = `analyst-${safeName}-${teamType}`;
        article.dataset.analystName = analyst.name; // Para referência

        // Não adicionar classes 'moved-up'/'moved-down' aqui diretamente,
        // A lógica de animação de swap (se reintroduzida) cuidaria disso.
        // Por ora, focamos nas setas.

        let positionBadgeClass = '';
        if (analyst.rank === 1) positionBadgeClass = 'gold';
        else if (analyst.rank === 2) positionBadgeClass = 'silver';
        else if (analyst.rank === 3) positionBadgeClass = 'bronze';

        const pointsHTML = analyst.totalPoints > 0 ? `<span class="analyst-points">+${analyst.totalPoints} pts</span>` : '';
        const valueClass = teamType === 'BB' ? 'bb-value' : ''; // Mantém estilização específica se houver

        let avatarContentHTML = '';
        let avatarContainerClasses = "analyst-avatar-container";

        if (analyst.avatarImageFile) {
            avatarContentHTML = `<img src="assets/${analyst.avatarImageFile}" alt="${analyst.name}" class="analyst-avatar-image" onerror="this.style.display='none'; this.parentElement.classList.add('${analyst.avatarClass || 'avatar-generic1'}');">`;
        } else if (analyst.avatarClass) {
            avatarContainerClasses += ` ${analyst.avatarClass}`;
        } else {
            avatarContainerClasses += ' avatar-generic1';
        }

        const movementIndicatorHTML = (movement === 'up' || movement === 'down') ? `<span class="movement-indicator ${movement} recent">${movement === 'up' ? '▲' : '▼'}</span>` : '';

        article.innerHTML = `
            <div class="${avatarContainerClasses}">
                ${avatarContentHTML}
                ${positionBadgeClass ? `<span class="position-badge ${positionBadgeClass}">#${analyst.rank}</span>` : ''}
                ${movementIndicatorHTML}
            </div>
            <h3 class="analyst-name">${analyst.name}</h3>
            <p class="team-name">${analyst.teamNameDetail || `Time ${teamType}`}</p>
            <p class="negotiated-value ${valueClass}">${formatCurrency(analyst.totalValue)} ${pointsHTML}</p>
        `;
        return article;
    }

    function createOtherAnalystListItem(analyst, teamType, movement = 'stay') {
        const li = document.createElement('li');
        const safeName = analyst.name.replace(/[^a-zA-Z0-9_-]/g, '-');
        li.id = `other-analyst-${safeName}-${teamType}`;
        // As classes moved-up-list/moved-down-list podem ser usadas para destacar, mas não para animação de swap complexa

        const pointsHTML = analyst.totalPoints > 0 ? `<span class="analyst-points">+${analyst.totalPoints} pts</span>` : '';
        const rankIndicatorHTML = (movement === 'up' || movement === 'down') ? `<span class="movement-indicator-list ${movement} recent">${movement === 'up' ? '▲' : '▼'}</span>` : '';
        
        li.innerHTML = `
            <div class="top-analyst-item">
                <span class="rank">#${analyst.rank} ${rankIndicatorHTML}</span>
                <span class="name">${analyst.name}</span>
                <span class="value">${formatCurrency(analyst.totalValue)} ${pointsHTML}</span>
            </div>
        `;
        return li;
    }
    
    function getMovement(oldRank, newRank) {
        if (oldRank === undefined) return 'new';
        if (newRank < oldRank) return 'up';
        if (newRank > oldRank) return 'down';
        return 'stay';
    }

    function displayMessage(element, message, isError = false) {
        if (element) {
            element.textContent = message;
            element.style.display = message ? 'block' : 'none';
            if (isError) {
                element.style.color = '#ef4444'; // Ou sua variável de cor de erro
                element.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            } else {
                 element.style.color = 'var(--text-secondary)';
                 element.style.backgroundColor = 'transparent';
            }
        }
    }

    // Função simplificada para atualizar o DOM (sem animações complexas de swap por enquanto)
    function renderAnalystList(containerElement, analysts, oldRanks, teamType, createFunction, topN = null) {
        containerElement.innerHTML = ''; // Limpa o container
        const displayedAnalysts = topN ? analysts.slice(0, topN) : analysts.slice(topN === 0 ? 0 : 3); // topN=0 para pegar todos, topN=null para pegar a partir do 4o

        if (displayedAnalysts.length === 0) {
            let message = topN ? `Nenhum analista ${teamType} no top ${topN}.` : `Sem mais analistas ${teamType} para listar.`;
            if (containerElement.tagName === 'UL') {
                containerElement.innerHTML = `<li style="color: var(--text-secondary); text-align:center;">${message}</li>`;
            } else {
                containerElement.innerHTML = `<p style="color: var(--text-secondary); text-align:center; grid-column: 1 / -1;">${message}</p>`;
            }
            return;
        }

        displayedAnalysts.forEach(analyst => {
            const movement = getMovement(oldRanks[analyst.name], analyst.rank);
            const element = createFunction(analyst, teamType, movement);
            containerElement.appendChild(element);
        });
    }


    async function fetchAndUpdateRankings() {
        displayMessage(loadingMessage, 'Carregando ranking... 📊');
        displayMessage(errorMessageArea, '', false); // Limpa erros anteriores

        try {
            const response = await fetch(API_URL);
            if (!response.ok) {
                let errorMsg = `Erro HTTP ${response.status}.`;
                try {
                    const errorData = await response.json();
                    errorMsg += ` Detalhes: ${errorData.error || response.statusText}`;
                } catch (e) { /* Ignora se não conseguir parsear JSON do erro */ }
                throw new Error(errorMsg);
            }
            const data = await response.json();
            displayMessage(loadingMessage, ''); // Limpa mensagem de carregamento

            const currentBsAnalysts = data.bsAnalysts || [];
            const currentBbAnalysts = data.bbAnalysts || [];

            const oldRanksMap = new Map();
            previousRankingData.bsAnalysts.forEach(a => oldRanksMap.set(a.name, a.rank));
            previousRankingData.bbAnalysts.forEach(a => oldRanksMap.set(a.name, a.rank));

            renderAnalystList(bsTopAnalystsGrid, currentBsAnalysts, oldRanksMap, 'BS', createAnalystCard, 3);
            renderAnalystList(bbTopAnalystsGrid, currentBbAnalysts, oldRanksMap, 'BB', createAnalystCard, 3);
            renderAnalystList(bsOtherAnalystsList, currentBsAnalysts, oldRanksMap, 'BS', createOtherAnalystListItem, null); // null para "outros"
            renderAnalystList(bbOtherAnalystsList, currentBbAnalysts, oldRanksMap, 'BB', createOtherAnalystListItem, null); // null para "outros"

            previousRankingData = { bsAnalysts: [...currentBsAnalysts], bbAnalysts: [...currentBbAnalysts] };
            
            if (data.overallProgress) {
                progressFill.style.width = `${data.overallProgress.percentage || 0}%`;
                progressTextSpan.textContent = `${(data.overallProgress.percentage || 0).toFixed(1)}%`; // Usar toFixed(1) para uma casa decimal
                if(metaTargetValueEl) metaTargetValueEl.textContent = formatCurrency(data.overallProgress.target);
                if(metaCurrentValueEl) metaCurrentValueEl.textContent = formatCurrency(data.overallProgress.current);
            }

            // Gerenciar classes 'recent' e 'stale' para indicadores de movimento
            document.querySelectorAll('.movement-indicator.stale, .movement-indicator-list.stale').forEach(el => {
                el.classList.remove('stale'); // Remove stale se for re-aplicado como recent
            });
            setTimeout(() => {
                document.querySelectorAll('.movement-indicator.recent, .movement-indicator-list.recent').forEach(el => {
                    el.classList.remove('recent');
                    el.classList.add('stale');
                });
            }, 7000); // Tempo para o indicador ser considerado "antigo"

        } catch (error) {
            console.error('Falha ao buscar ou processar dados do ranking:', error);
            displayMessage(loadingMessage, '');
            displayMessage(errorMessageArea, `Não foi possível carregar o ranking: ${error.message}`, true);
        }
    }

    fetchAndUpdateRankings(); // Carga inicial
    setInterval(fetchAndUpdateRankings, 15000); // Atualiza a cada 15 segundos (ajuste conforme necessário)
});