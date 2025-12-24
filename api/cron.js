import admin from 'firebase-admin';

// Função para limpar a chave privada
const getPrivateKey = () => {
    const key = process.env.FIREBASE_PRIVATE_KEY;
    if (!key) return undefined;
    const rawKey = key.replace(/^"|"$/g, '');
    return rawKey.replace(/\\n/g, '\n');
};

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: getPrivateKey(),
            }),
        });
    } catch (e) {
        console.error("Erro na inicialização do Firebase:", e);
    }
}

const db = admin.firestore();

export default async function handler(req, res) {
    if (!process.env.FIREBASE_PRIVATE_KEY) return res.status(500).json({ error: "Chave Privada não configurada." });
    if (!process.env.FIREBASE_CLIENT_EMAIL) return res.status(500).json({ error: "Email não configurado." });

    const now = new Date();
    // Janela de tempo: Jogos vencendo entre 50 e 75 minutos a partir de agora
    const startWindow = new Date(now.getTime() + 50 * 60 * 1000); 
    const endWindow = new Date(now.getTime() + 75 * 60 * 1000);   

    try {
        const snapshot = await db.collection('matches')
            .where('deadline', '>=', startWindow)
            .where('deadline', '<=', endWindow)
            .get();

        if (snapshot.empty) {
            return res.status(200).json({ status: "Ok", message: 'Nenhum jogo na janela de 1h.' });
        }

        let notificados = 0;
        const updates = snapshot.docs.map(async (doc) => {
            const match = doc.data();
            if (match.notifiedAuto) return;

            const deadlineDate = match.deadline.toDate();
            const horaFormatada = deadlineDate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

            // --- AQUI ESTÁ A MUDANÇA NO TEXTO ---
            await admin.messaging().send({
                topic: 'todos',
                notification: {
                    title: '⏳ Falta 1 hora!',
                    body: `O jogo ${match.teamA} x ${match.teamB} encerra às ${horaFormatada}. (Se você já votou, desconsidere este aviso).`,
                },
                android: {
                    priority: 'high',
                    notification: { 
                        icon: 'ic_stat_bola', 
                        color: '#006400',
                        sound: 'default'
                    }
                }
            });
            // ------------------------------------

            notificados++;
            return doc.ref.update({ notifiedAuto: true });
        });

        await Promise.all(updates);
        return res.status(200).json({ success: true, message: `${notificados} notificações enviadas.` });

    } catch (error) {
        console.error('Erro no Cron:', error);
        return res.status(500).json({ error: "Erro interno.", details: error.message });
    }
}
