// public/script.js
document.addEventListener('DOMContentLoaded', () => {
  const themeToggleButton = document.getElementById('theme-toggle-button');
  const body = document.body;

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
      if (body.classList.contains('light-mode')) {
          setTheme('dark');
      } else {
          setTheme('light');
      }
  });

  const savedTheme = localStorage.getItem('theme') || 'dark'; // Default to dark
  setTheme(savedTheme);

  // --- Lógica do Ranking Dinâmico ---
  const bsTopAnalystsGrid = document.getElementById('bs-top-analysts-grid');
  const bbTopAnalystsGrid = document.getElementById('bb-top-analysts-grid');
  const bsOtherAnalystsList = document.getElementById('bs-other-analysts-list');
  const bbOtherAnalystsList = document.getElementById('bb-other-analysts-list');
  
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const metaTargetValueEl = document.getElementById('meta-target-value');
  const metaCurrentValueEl = document.getElementById('meta-current-value');


  let previousRankingData = { bsAnalysts: [], bbAnalysts: [] }; // Para detectar mudanças

  function formatCurrency(value) {
      return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function createAnalystCard(analyst, teamType, movement = 'stay') {
      const article = document.createElement('article');
      article.classList.add('analyst-card');
      if (movement === 'up') article.classList.add('moved-up');
      if (movement === 'down') article.classList.add('moved-down');
      
      // Adiciona um ID único para cada card para facilitar a manipulação da animação
      article.id = `analyst-${analyst.name.replace(/\s+/g, '-')}-${teamType}`;

      let positionBadgeClass = '';
      if (analyst.rank === 1) positionBadgeClass = 'gold';
      else if (analyst.rank === 2) positionBadgeClass = 'silver';
      else if (analyst.rank === 3) positionBadgeClass = 'bronze';

      const pointsHTML = teamType === 'BS' && analyst.totalPoints > 0 ? `<span class="analyst-points">+${analyst.totalPoints} pts</span>` : '';
      const valueClass = teamType === 'BB' ? 'bb-value' : '';

      article.innerHTML = `
          <div class="analyst-avatar-container ${analyst.avatarClass}">
              ${positionBadgeClass ? `<span class="position-badge ${positionBadgeClass}">#${analyst.rank}</span>` : ''}
              ${movement === 'up' ? '<span class="movement-indicator up recent">▲</span>' : ''}
              ${movement === 'down' ? '<span class="movement-indicator down recent">▼</span>' : ''}
          </div>
          <h3 class="analyst-name">${analyst.name}</h3>
          <p class="team-name">${analyst.teamNameDetail || `Time ${teamType}`}</p>
          <p class="negotiated-value ${valueClass}">${formatCurrency(analyst.totalValue)} ${pointsHTML}</p>
      `;
      return article;
  }

  function createOtherAnalystListItem(analyst, teamType, movement = 'stay') {
      const li = document.createElement('li');
      // Adiciona um ID único para cada item para facilitar a manipulação da animação
      li.id = `other-analyst-${analyst.name.replace(/\s+/g, '-')}-${teamType}`;

      if (movement === 'up') li.classList.add('moved-up-list');
      if (movement === 'down') li.classList.add('moved-down-list');

      const pointsHTML = teamType === 'BS' && analyst.totalPoints > 0 ? `<span class="analyst-points">+${analyst.totalPoints} pts</span>` : '';
      
      li.innerHTML = `
          <div class="top-analyst-item">
              <span class="rank">#${analyst.rank}
                  ${movement === 'up' ? '<span class="movement-indicator-list up recent">▲</span>' : ''}
                  ${movement === 'down' ? '<span class="movement-indicator-list down recent">▼</span>' : ''}
              </span>
              <span class="name">${analyst.name}</span>
              <span class="value">${formatCurrency(analyst.totalValue)} ${pointsHTML}</span>
          </div>
      `;
      return li;
  }
  
  function getMovement(oldRank, newRank) {
      if (oldRank === undefined) return 'new'; // Novo analista
      if (newRank < oldRank) return 'up';
      if (newRank > oldRank) return 'down';
      return 'stay';
  }

  async function fetchAndUpdateRankings() {
      try {
          const response = await fetch('/api/ranking');
          if (!response.ok) {
              const errorData = await response.json();
              console.error('Erro ao buscar ranking:', response.status, errorData.error, errorData.details);
              // Exibir uma mensagem de erro para o usuário, se apropriado
              // Por exemplo, atualizando um elemento no DOM:
              // document.getElementById('error-message-area').textContent = `Erro ao carregar dados: ${errorData.error}`;
              return; 
          }
          const data = await response.json();

          const currentBsAnalysts = data.bsAnalysts;
          const currentBbAnalysts = data.bbAnalysts;

          // Mapear ranks antigos
          const oldBsRanks = previousRankingData.bsAnalysts.reduce((acc, val) => {
              acc[val.name] = val.rank;
              return acc;
          }, {});
          const oldBbRanks = previousRankingData.bbAnalysts.reduce((acc, val) => {
              acc[val.name] = val.rank;
              return acc;
          }, {});

          // Atualizar Top 3 BS
          currentBsAnalysts.slice(0, 3).forEach(analyst => {
              const movement = getMovement(oldBsRanks[analyst.name], analyst.rank);
              const newCard = createAnalystCard(analyst, 'BS', movement);
              const existingCard = document.getElementById(newCard.id);
              if (!existingCard || existingCard.outerHTML !== newCard.outerHTML) {
                  if (existingCard) {
                      bsTopAnalystsGrid.replaceChild(newCard, existingCard);
                  } else {
                      bsTopAnalystsGrid.appendChild(newCard);
                  }
              }
          });
          // Remover cards que não estão mais no top 3 BS
          Array.from(bsTopAnalystsGrid.children).forEach(child => {
              if (!currentBsAnalysts.slice(0,3).some(a => `analyst-${a.name.replace(/\s+/g, '-')}-BS` === child.id)) {
                  child.classList.add('removing');
                  setTimeout(() => bsTopAnalystsGrid.removeChild(child), 300);
              }
          });

          // Atualizar Top 3 BB
          currentBbAnalysts.slice(0, 3).forEach(analyst => {
              const movement = getMovement(oldBbRanks[analyst.name], analyst.rank);
              const newCard = createAnalystCard(analyst, 'BB', movement);
              const existingCard = document.getElementById(newCard.id);
              if (!existingCard || existingCard.outerHTML !== newCard.outerHTML) {
                  if (existingCard) {
                      bbTopAnalystsGrid.replaceChild(newCard, existingCard);
                  } else {
                      bbTopAnalystsGrid.appendChild(newCard);
                  }
              }
          });
          // Remover cards que não estão mais no top 3 BB
          Array.from(bbTopAnalystsGrid.children).forEach(child => {
              if (!currentBbAnalysts.slice(0,3).some(a => `analyst-${a.name.replace(/\s+/g, '-')}-BB` === child.id)) {
                  child.classList.add('removing');
                  setTimeout(() => bbTopAnalystsGrid.removeChild(child), 300);
              }
          });

          // Atualizar Outros BS (a partir do 4º)
          currentBsAnalysts.slice(3).forEach(analyst => {
              const movement = getMovement(oldBsRanks[analyst.name], analyst.rank);
              const newItem = createOtherAnalystListItem(analyst, 'BS', movement);
              const existingItem = document.getElementById(newItem.id);
              if (!existingItem || existingItem.outerHTML !== newItem.outerHTML) {
                  if (existingItem) {
                      bsOtherAnalystsList.replaceChild(newItem, existingItem);
                  } else {
                      bsOtherAnalystsList.appendChild(newItem);
                  }
              }
          });
          // Remover itens que não estão mais na lista Outros BS
          Array.from(bsOtherAnalystsList.children).forEach(child => {
              if (!currentBsAnalysts.slice(3).some(a => `other-analyst-${a.name.replace(/\s+/g, '-')}-BS` === child.id)) {
                  child.classList.add('removing');
                  setTimeout(() => bsOtherAnalystsList.removeChild(child), 300);
              }
          });

          // Atualizar Outros BB (a partir do 4º)
          currentBbAnalysts.slice(3).forEach(analyst => {
              const movement = getMovement(oldBbRanks[analyst.name], analyst.rank);
              const newItem = createOtherAnalystListItem(analyst, 'BB', movement);
              const existingItem = document.getElementById(newItem.id);
              if (!existingItem || existingItem.outerHTML !== newItem.outerHTML) {
                  if (existingItem) {
                      bbOtherAnalystsList.replaceChild(newItem, existingItem);
                  } else {
                      bbOtherAnalystsList.appendChild(newItem);
                  }
              }
          });
          // Remover itens que não estão mais na lista Outros BB
          Array.from(bbOtherAnalystsList.children).forEach(child => {
              if (!currentBbAnalysts.slice(3).some(a => `other-analyst-${a.name.replace(/\s+/g, '-')}-BB` === child.id)) {
                  child.classList.add('removing');
                  setTimeout(() => bbOtherAnalystsList.removeChild(child), 300);
              }
          });

          // Atualiza dados para a próxima comparação
          previousRankingData = { bsAnalysts: [...currentBsAnalysts], bbAnalysts: [...currentBbAnalysts] };
          
          // Atualizar Barra de Progresso Geral
          if (data.overallProgress) {
              progressFill.style.width = `${data.overallProgress.percentage}%`;
              progressText.textContent = `${data.overallProgress.percentage}% da meta atingida!`;
              if(metaTargetValueEl) metaTargetValueEl.textContent = formatCurrency(data.overallProgress.target);
              if(metaCurrentValueEl) metaCurrentValueEl.textContent = formatCurrency(data.overallProgress.current);
          }

          // Removido trecho que limpa classes de animação para manter os indicadores visíveis permanentemente

          setTimeout(() => {
            document.querySelectorAll('.movement-indicator.recent, .movement-indicator-list.recent').forEach(el => {
              el.classList.remove('recent');
              el.classList.add('stale');
            });
          }, 10000);

      } catch (error) {
          console.error('Falha ao buscar ou processar dados do ranking:', error);
      }
  }

  async function startAutoUpdate() {
    await fetchAndUpdateRankings();
    setTimeout(startAutoUpdate, 30000);
  }
  startAutoUpdate();
});