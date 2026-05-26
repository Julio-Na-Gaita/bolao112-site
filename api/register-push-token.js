import admin from 'firebase-admin';
import { createHash } from 'crypto';

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

const hashToken = (token = '') =>
  createHash('sha256').update(String(token || '')).digest('hex');

const normalizePlatform = (value = '') => {
  const platform = String(value || '').toLowerCase();
  return ['android', 'ios', 'desktop', 'web'].includes(platform) ? platform : 'unknown';
};

const countEnabledTokensForUser = async (db, uid) => {
  const snap = await db.collection('notification_tokens')
    .where('uid', '==', uid)
    .where('enabled', '==', true)
    .get();
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
    if (!idToken) {
      return res.status(401).json({ ok: false, error: 'missing_auth_token' });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const db = admin.firestore();
    const userRef = db.collection('users').doc(decoded.uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ ok: false, error: 'user_not_found' });
    }

    const userData = userSnap.data() || {};
    const rawToken = String(req.body?.token || '').trim();
    if (!rawToken) {
      return res.status(400).json({ ok: false, error: 'missing_token' });
    }

    const tokenId = hashToken(rawToken);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const platform = normalizePlatform(req.body?.platform || 'web');
    const userAgent = String(req.body?.userAgent || '').trim().slice(0, 240);

    await db.collection('notification_tokens').doc(tokenId).set({
      token: rawToken,
      uid: decoded.uid,
      name: userData.name || decoded.name || '',
      username: userData.username || '',
      email: userData.email || decoded.email || '',
      enabled: true,
      platform,
      userAgent,
      createdAt: userData.webPushCreatedAt || now,
      updatedAt: now,
      lastSeenAt: now
    }, { merge: true });

    const tokenCount = await countEnabledTokensForUser(db, decoded.uid);

    await userRef.set({
      hasWebPushToken: true,
      webPushTokenCount: tokenCount,
      webPushLastStatus: 'active',
      webPushLastPlatform: platform,
      webPushLastUserAgent: userAgent,
      webPushLastActivatedAt: now,
      webPushUpdatedAt: now
    }, { merge: true });

    return res.status(200).json({ ok: true, tokenId });
  } catch (error) {
    console.error('Erro ao registrar token de push:', error);
    return res.status(500).json({ ok: false, error: error?.message || 'push_register_error' });
  }
}
