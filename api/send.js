import admin from 'firebase-admin';

// Inicializa o Firebase apenas uma vez
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            // Corrige a formatação da chave privada que vem com quebras de linha
            privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
        }),
    });
}

export default async function handler(req, res) {
    // Segurança básica: só aceita POST
    if (req.method !== 'POST') {
        return res.status(405).send({ message: 'Método não permitido' });
    }

    const { title, body } = req.body;

    if (!title || !body) {
        return res.status(400).send({ message: 'Faltando título ou mensagem' });
    }

    const message = {
        topic: 'todos', // Vamos inscrever todos os celulares neste tópico
        notification: {
            title: title,
            body: body,
        },
        android: {
            priority: 'high',
            notification: {
                sound: 'default',
                channelId: 'bolao_notificacoes'
            }
        }
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('Notificação enviada:', response);
        return res.status(200).json({ success: true, id: response });
    } catch (error) {
        console.error('Erro ao enviar:', error);
        return res.status(500).json({ error: error.message });
    }
}
