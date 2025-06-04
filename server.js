require('dotenv').config();
if (!process.env.GOOGLE_SHEET_ID) {
    console.error("Erro: GOOGLE_SHEET_ID não está definido no arquivo .env");
    process.exit(1);
}
const express = require('express');
const fs = require('fs');
const availableImages = fs.readdirSync('ranking-backend/public/assets');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
const PORT = process.env.PORT || 3000;

const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

// Configurar o cliente JWT para autenticação
const serviceAccountAuth = new JWT({
    email: creds.client_email,
    key: creds.private_key.replace(/\\n/g, '\n'), // Tratar quebras de linha na chave privada
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

// const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);

// Função para buscar e processar dados da planilha
async function getRankingData() {
    console.log("📥 Iniciando leitura da planilha...");

    try {
        // Autenticação e inicialização do GoogleSpreadsheet
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
        await doc.useServiceAccountAuth({
            client_email: creds.client_email,
            private_key: creds.private_key.replace(/\\n/g, '\n')
        });
        console.log("🔐 Tentando carregar informações do documento...");
        await doc.loadInfo();
        console.log("✅ Documento carregado.");

        const sheet = doc.sheetsByTitle['Registros'];
        if (!sheet) {
            console.error("❌ Aba 'Registros' não encontrada!");
            return { bsAnalysts: [], bbAnalysts: [], overallProgress: { current: 0, target: 1, percentage: 0} };
        }

        console.log("📄 Aba 'Registros' localizada. Carregando linhas...");
        const rows = await sheet.getRows();
        console.log(`📊 Total de linhas lidas: ${rows.length}`);

        const aggregatedData = {};

        rows.forEach((row, index) => {
            console.log(`🔍 Processando linha ${index + 1}`);
            const nomeOriginal = row['NomeHeroi'];
            const nome = nomeOriginal?.trim().toLowerCase();
            const valorRecuperadoStr = String(row['ValorRecuperado'] || '0')
                .replace(/[R$\s.]/g, '')
                .replace(',', '.');
            const valor = parseFloat(valorRecuperadoStr) || 0;

            const time = String(row['Time']).toUpperCase(); // BS ou BB
            const pontosStr = String(row['Pontos'] || '0');
            const pontos = parseInt(pontosStr) || 0;

            if (!nome || !time) return;

            if (!aggregatedData[nome]) {
                aggregatedData[nome] = {
                    name: nomeOriginal,
                    team: time,
                    totalValue: 0,
                    totalPoints: 0,
                    avatarClass: getAvatarClass(nomeOriginal, time, 0)
                };
            }
            aggregatedData[nome].totalValue += valor;
            aggregatedData[nome].totalPoints += pontos;
        });

    const allAnalysts = Object.values(aggregatedData);

    const bsAnalysts = allAnalysts
        .filter(a => a.team === 'BS')
        .sort((a, b) => b.totalValue - a.totalValue)
        .map((analyst, index) => {
            const imageName = getImageFilename(analyst.name);
            return {
                ...analyst,
                rank: index + 1,
                avatarClass: getAvatarClass(analyst.name, analyst.team, index + 1),
                avatarUrl: `/assets/${imageName}`
            };
        });

    const bbAnalysts = allAnalysts
        .filter(a => a.team === 'BB')
        .sort((a, b) => b.totalValue - a.totalValue)
        .map((analyst, index) => {
            const imageName = getImageFilename(analyst.name);
            return {
                ...analyst,
                rank: index + 1,
                avatarClass: getAvatarClass(analyst.name, analyst.team, index + 1),
                avatarUrl: `/assets/${imageName}`
            };
        });

    // Cálculo da meta geral (exemplo: meta de R$500.000,00)
    const totalCampaignValue = allAnalysts.reduce((sum, a) => sum + a.totalValue, 0);
    const campaignTarget = 500000; // Defina sua meta aqui
    const percentage = Math.min(100, (totalCampaignValue / campaignTarget) * 100);

    console.log("Finalizou leitura da planilha.");
    return { 
        bsAnalysts, 
        bbAnalysts, 
        overallProgress: {
            current: totalCampaignValue,
            target: campaignTarget,
            percentage: parseFloat(percentage.toFixed(2))
        }
    };
    } catch (error) {
        console.error("Erro ao processar dados da planilha:", error);
        throw error;
    }
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


function getImageFilename(heroName) {
    const normalized = heroName
        .trim()
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[\s\-]+/g, '_');

    const supportedExtensions = ['jpg', 'jpeg', 'png', 'webp'];

    for (const ext of supportedExtensions) {
        const filename = `${normalized}.${ext}`;
        if (availableImages.includes(filename)) {
            return filename;
        }
    }

    return 'default.jpg';
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