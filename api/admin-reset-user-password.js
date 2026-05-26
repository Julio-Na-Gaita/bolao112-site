import admin from 'firebase-admin';

const getPrivateKey = () => {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  if (!key) return undefined;
  const rawKey = key.replace(/^"|"$/g, '');
  return rawKey.replace(/\\n/g, '\n');
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: getPrivateKey(),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { idToken, targetUid, newPassword } = req.body || {};

    if (!idToken || !targetUid || !newPassword) {
      return res.status(400).json({ error: 'Dados obrigatórios ausentes.' });
    }

    const password = String(newPassword || '').trim();
    if (password.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }

    const decoded = await admin.auth().verifyIdToken(String(idToken));
    const adminSnap = await db.collection('users').doc(decoded.uid).get();

    if (!adminSnap.exists || adminSnap.data()?.isAdmin !== true) {
      return res.status(403).json({ error: 'Sem permissão para resetar senha.' });
    }

    const targetRef = db.collection('users').doc(String(targetUid));
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      return res.status(404).json({ error: 'Usuário alvo não encontrado.' });
    }

    await admin.auth().updateUser(String(targetUid), { password });

    await targetRef.set({
      forcePasswordChange: true,
      passwordResetAt: admin.firestore.FieldValue.serverTimestamp(),
      passwordResetByUid: decoded.uid,
      passwordResetByName: adminSnap.data()?.name || '',
      passwordResetByEmail: adminSnap.data()?.email || ''
    }, { merge: true });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro ao resetar senha:', error);
    const message = error?.message || 'Não foi possível resetar a senha.';
    return res.status(500).json({ error: message });
  }
}
