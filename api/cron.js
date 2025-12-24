import admin from 'firebase-admin';

// Inicializa o Firebase (mesma lógica do send.js)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
        }),
    });
}

const db = admin.firestore();

export default async function handler(req, res) {
    // Definindo a janela de tempo: Jogos que vencem entre 50 min e 70 min a partir de agora
    // Isso garante que peguemos o jogo "faltando 1h" mesmo se o cron rodar a cada 15 min.
    const now = new Date();
    const startWindow = new Date(now.getTime() + 50 * 60 * 1000); // Daqui a 50 min
    const endWindow = new Date(now.getTime() + 70 * 60 * 1000);   // Daqui a 70 min

    try {
        // Busca jogos nessa janela de tempo
        const snapshot = await db.collection('matches')
            .where('deadline', '>=', startWindow)
            .where('deadline', '<=', endWindow)
            .get();

        if (snapshot.empty) {
            return res.status(200).json({ message: 'Nenhum jogo próximo do prazo.' });
        }

        let notificados = 0;

        // Processa cada jogo encontrado
        const updates = snapshot.docs.map(async (doc) => {
            const match = doc.data();

            // Se já foi avisado automaticamente, ignora
            if (match.notifiedAuto) return;

            // Envia a notificação
            await admin.messaging().send({
                topic: 'todos',
                notification: {
                    title: '⏳ Falta 1 hora!',
                    body: `Corre! A votação para ${match.teamA} x ${match.teamB} encerra em breve.`,
                },
                android: {
                    priority: 'high',
                    notification: { icon: 'ic_stat_bola', color: '#006400' }
                }
            });

            notificados++;
            
            // Marca no banco que esse jogo já teve o aviso automático
            return doc.ref.update({ notifiedAuto: true });
        });

        await Promise.all(updates);

        return res.status(200).json({ success: true, message: `${notificados} jogos notificados.` });

    } catch (error) {
        console.error('Erro no Cron:', error);
        return res.status(500).json({ error: error.message });
    }
}
