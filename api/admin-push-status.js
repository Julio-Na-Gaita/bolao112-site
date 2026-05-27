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

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (value.seconds) return Number(value.seconds) * 1000;
  return 0;
};

const toIso = (value) => {
  const millis = toMillis(value);
  return millis ? new Date(millis).toISOString() : null;
};

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
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
    const adminSnap = await db.collection('users').doc(decoded.uid).get();

    if (!adminSnap.exists || adminSnap.data()?.isAdmin !== true) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }

    const tokenSnap = await db.collection('notification_tokens').where('enabled', '==', true).get();
    const byUid = {};

    tokenSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const uid = String(data.uid || '').trim();
      if (!uid) return;

      const item = byUid[uid] || {
        active: true,
        tokenCount: 0,
        platforms: [],
        lastSeenAt: null,
        lastSentAt: null,
        lastSendStatus: ''
      };

      item.tokenCount += 1;
      const platform = String(data.platform || '').trim();
      if (platform && !item.platforms.includes(platform)) item.platforms.push(platform);

      if (toMillis(data.lastSeenAt) > toMillis(item.lastSeenAt)) item.lastSeenAt = data.lastSeenAt;
      if (toMillis(data.lastSentAt) > toMillis(item.lastSentAt)) item.lastSentAt = data.lastSentAt;
      if (data.lastSendStatus) item.lastSendStatus = String(data.lastSendStatus || '').slice(0, 80);

      byUid[uid] = item;
    });

    Object.keys(byUid).forEach((uid) => {
      byUid[uid] = {
        active: true,
        tokenCount: byUid[uid].tokenCount,
        platforms: byUid[uid].platforms,
        lastSeenAt: toIso(byUid[uid].lastSeenAt),
        lastSentAt: toIso(byUid[uid].lastSentAt),
        lastSendStatus: byUid[uid].lastSendStatus
      };
    });

    return res.status(200).json({
      ok: true,
      totalActiveTokens: tokenSnap.size,
      totalUsersWithPush: Object.keys(byUid).length,
      users: byUid
    });
  } catch (error) {
    console.error('Erro ao consultar status de push:', error);
    return res.status(500).json({ ok: false, error: 'admin_push_status_error' });
  }
}
