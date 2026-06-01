import admin from 'firebase-admin';

const getPrivateKey = () => {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  if (!key) return undefined;
  const rawKey = key.replace(/^"|"$/g, '');
  return rawKey.replace(/\\n/g, '\n');
};

if (!admin.apps.length && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: getPrivateKey(),
    }),
  });
}

const allowedStatuses = new Set(['denied', 'unsupported', 'ios_not_installed', 'not_configured', 'error', 'disabled']);
const allowedPlatforms = new Set(['android', 'ios', 'desktop', 'unknown']);

const countEnabledTokensForUser = async (db, uid) => {
  const snap = await db.collection('notification_tokens')
    .where('uid', '==', uid)
    .where('enabled', '==', true)
    .get();
  return snap.size;
};

const disableAllTokensForUser = async (db, uid) => {
  const snap = await db.collection('notification_tokens')
    .where('uid', '==', uid)
    .where('enabled', '==', true)
    .get();

  if (snap.empty) return 0;

  const batch = db.batch();
  snap.forEach((docSnap) => {
    batch.update(docSnap.ref, {
      enabled: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
  return snap.size;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    return res.status(503).json({ ok: false, error: 'push_not_configured' });
  }

  try {
    const authHeader = String(req.headers.authorization || '');
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!idToken) return res.status(401).json({ ok: false, error: 'missing_auth_token' });

    const decoded = await admin.auth().verifyIdToken(idToken);
    const db = admin.firestore();
    const status = String(req.body?.status || '').trim();
    const platform = String(req.body?.platform || 'unknown').trim();
    const userAgent = String(req.body?.userAgent || '').trim().slice(0, 240);

    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ ok: false, error: 'invalid_status' });
    }

    const disabledCount = status === 'disabled'
      ? await disableAllTokensForUser(db, decoded.uid)
      : 0;
    const tokenCount = status === 'disabled'
      ? 0
      : await countEnabledTokensForUser(db, decoded.uid);
    await db.collection('users').doc(decoded.uid).set({
      hasWebPushToken: tokenCount > 0,
      webPushTokenCount: tokenCount,
      webPushLastStatus: status,
      webPushLastPlatform: allowedPlatforms.has(platform) ? platform : 'unknown',
      webPushLastUserAgent: userAgent,
      webPushUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return res.status(200).json({ ok: true, tokenCount, disabledCount });
  } catch (error) {
    console.error('Erro ao atualizar status de push:', error);
    return res.status(500).json({ ok: false, error: 'push_status_error' });
  }
}
