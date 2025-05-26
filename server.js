require('dotenv').config();
if (!process.env.GOOGLE_SHEET_ID) {
    console.error("Erro: GOOGLE_SHEET_ID não está definido no arquivo .env");
    process.exit(1);
}
const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
const PORT = process.env.PORT || 3000;

// Carregar credenciais do arquivo JSON
const creds = require('./credentials.json');

// Configurar o cliente JWT para autenticação
const serviceAccountAuth = new JWT({
    email: creds.client_email,
    key: creds.private_key.replace(/\\n/g, '\n'), // Tratar quebras de linha na chave privada
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);

// Função para buscar e processar dados da planilha
async function getRankingData() {
    await doc.loadInfo(); // Carrega propriedades do documento e planilhas
    const sheet = doc.sheetsByTitle['Registros']; // Ou use sheetsByIndex[0] se for a primeira
    if (!sheet) {
        console.error("Planilha 'Registros' não encontrada!");
        return { bsAnalysts: [], bbAnalysts: [], overallProgress: { current: 0, target: 1, percentage: 0} };
    }
    const rows = await sheet.getRows();

    const aggregatedData = {};

    rows.forEach(row => {
        const nomeOriginal = row.get('NomeHeroi');
        const nome = nomeOriginal?.trim().toLowerCase();
        // Remover "R$", espaços e trocar vírgula por ponto para converter para número
        const valorRecuperadoStr = String(row.get('ValorRecuperado') || '0').replace(/[R$\s.]/g, '').replace(',', '.');
        const valor = parseFloat(valorRecuperadoStr) || 0;
        
        const time = String(row.get('Time')).toUpperCase(); // BS ou BB
        const pontosStr = String(row.get('Pontos') || '0');
        const pontos = parseInt(pontosStr) || 0;

        if (!nome || !time) return; // Pular linhas incompletas

        if (!aggregatedData[nome]) {
            aggregatedData[nome] = {
                name: nomeOriginal,
                team: time,
                totalValue: 0,
                totalPoints: 0,
                // Para nomes de times e avatares, podemos adicionar uma lógica mais complexa
                // ou simplificar aqui, ou deixar para o front-end mapear
                
                avatarClass: getAvatarClass(nomeOriginal, time, 0) // Rank inicial 0, será atualizado
            };
        }
        aggregatedData[nome].totalValue += valor;
        aggregatedData[nome].totalPoints += pontos;
    });

    const allAnalysts = Object.values(aggregatedData);

    const bsAnalysts = allAnalysts
        .filter(a => a.team === 'BS')
        .sort((a, b) => b.totalValue - a.totalValue)
        .map((analyst, index) => ({ ...analyst, rank: index + 1, avatarClass: getAvatarClass(analyst.name, 'BS', index + 1) }));

    const bbAnalysts = allAnalysts
        .filter(a => a.team === 'BB')
        .sort((a, b) => b.totalValue - a.totalValue)
        .map((analyst, index) => ({ ...analyst, rank: index + 1, avatarClass: getAvatarClass(analyst.name, 'BB', index + 1) }));

    // Cálculo da meta geral (exemplo: meta de R$500.000,00)
    const totalCampaignValue = allAnalysts.reduce((sum, a) => sum + a.totalValue, 0);
    const campaignTarget = 500000; // Defina sua meta aqui
    const percentage = Math.min(100, (totalCampaignValue / campaignTarget) * 100);

    return { 
        bsAnalysts, 
        bbAnalysts, 
        overallProgress: {
            current: totalCampaignValue,
            target: campaignTarget,
            percentage: parseFloat(percentage.toFixed(2))
        }
    };
}


// Função auxiliar para classes de avatar (simplificado)
function getAvatarClass(analystName, team, rank) {
    if (rank === 1 && team === 'BS') return 'avatar-bs';
    if (rank === 1 && team === 'BB') return 'avatar-bb';
    // Lógica para avatares genéricos - pode ser mais elaborada
    const genericAvatars = ['avatar-generic1', 'avatar-generic2', 'avatar-generic3', 'avatar-generic4'];
    let hash = 0;
    for (let i = 0; i < analystName.length; i++) {
        hash = analystName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return genericAvatars[Math.abs(hash) % genericAvatars.length];
}


app.get('/api/ranking', async (req, res) => {
    try {
        const data = await getRankingData();
        res.json(data);
    } catch (error) {
        console.error('Erro ao buscar dados do ranking:', error);
        // Verificar se o erro é de autenticação específica
        if (error.message && error.message.includes('invalid_grant')) {
             res.status(500).json({ error: 'Erro de autenticação com Google Sheets. Verifique as credenciais e permissões da conta de serviço.' });
        } else if (error.message && error.message.includes('getSheetValues')){
             res.status(500).json({ error: `Erro ao ler dados da planilha: ${error.message}. Verifique se a planilha e a aba 'Registros' existem e estão acessíveis.`});
        }
        else {
             res.status(500).json({ error: 'Falha ao obter dados do ranking.', details: error.message });
        }
    }
});

// Servir arquivos estáticos do caminho correto
app.use(express.static('ranking-backend/public'));

app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
    console.log(`Endpoint da API: http://localhost:${PORT}/api/ranking`);
});