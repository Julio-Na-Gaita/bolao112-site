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

const chunkArray = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

const isInvalidTokenError = (code = '') =>
  [
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
    'messaging/invalid-argument'
  ].includes(code);

const buildPushMessage = ({ tokens = [], title, message, targetMode }) => ({
  tokens,
  notification: {
    title,
    body: message,
  },
  webpush: {
    fcmOptions: {
      link: 'https://bolao112-site.vercel.app/',
    },
  },
  data: {
    source: 'admin_communications_web',
    targetMode,
  },
});

const sendPushChunkWithoutBatch = async ({ messaging, tokens, title, message, targetMode }) => {
  if (typeof messaging.sendEachForMulticast === 'function') {
    return messaging.sendEachForMulticast(buildPushMessage({ tokens, title, message, targetMode }));
  }

  const responses = [];
  for (const token of tokens) {
    try {
      await messaging.send({
        token,
        notification: {
          title,
          body: message,
        },
        webpush: {
          fcmOptions: {
            link: 'https://bolao112-site.vercel.app/',
          },
        },
        data: {
          source: 'admin_communications_web',
          targetMode,
        },
      });
      responses.push({ success: true });
    } catch (error) {
      responses.push({ success: false, error });
    }
  }

  const successCount = responses.filter((response) => response.success).length;
  return {
    responses,
    successCount,
    failureCount: responses.length - successCount,
  };
};

const getFortalezaDateKey = () =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

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
    const adminSnap = await db.collection('users').doc(decoded.uid).get();

    if (!adminSnap.exists || adminSnap.data()?.isAdmin !== true) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }

    const webPushRef = db.collection('settings').doc('webPush');
    const webPushSnap = await webPushRef.get();
    if (!webPushSnap.exists) {
      return res.status(403).json({ ok: false, error: 'push_disabled' });
    }

    const webPushData = webPushSnap.data() || {};
    if (webPushData.enabled !== true) {
      return res.status(403).json({ ok: false, error: 'push_disabled' });
    }

    const dailyLimit = Number.isFinite(Number(webPushData.dailyLimit)) && Number(webPushData.dailyLimit) > 0
      ? Number(webPushData.dailyLimit)
      : 5;
    const todayKey = getFortalezaDateKey();
    const sentDate = String(webPushData.sentDate || '');
    const sentCount = sentDate === todayKey ? Number(webPushData.sentCount || 0) : 0;

    if (sentCount >= dailyLimit) {
      return res.status(429).json({ ok: false, error: 'push_rate_limited', dailyLimit, sentCount });
    }

    const { title, message, targetMode = 'all', targetUids = [] } = req.body || {};
    const cleanTitle = String(title || '').trim();
    const cleanMessage = String(message || '').trim();
    const cleanMode = targetMode === 'selected' ? 'selected' : 'all';
    const selectedUids = Array.isArray(targetUids) ? targetUids.map(String).filter(Boolean) : [];

    if (!cleanTitle || !cleanMessage) {
      return res.status(400).json({ ok: false, error: 'missing_title_or_message' });
    }

    if (cleanMode === 'selected' && !selectedUids.length) {
      return res.status(400).json({ ok: false, error: 'missing_targets' });
    }

    const tokenSnap = await db.collection('notification_tokens').where('enabled', '==', true).get();
    const selectedSet = new Set(selectedUids);
    const tokenDocs = [];
    const tokens = [];

    tokenSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      if (!data.token) return;
      if (cleanMode === 'selected' && !selectedSet.has(String(data.uid || ''))) return;
      tokenDocs.push(docSnap);
      tokens.push(String(data.token));
    });

    if (!tokens.length) {
      return res.status(200).json({ ok: true, totalTokens: 0, successCount: 0, failureCount: 0, message: 'no_tokens' });
    }

    let successCount = 0;
    let failureCount = 0;
    const invalidRefs = [];

    for (let chunkStart = 0; chunkStart < tokens.length; chunkStart += 500) {
      const tokenChunk = tokens.slice(chunkStart, chunkStart + 500);
      const result = await sendPushChunkWithoutBatch({
        messaging: admin.messaging(),
        tokens: tokenChunk,
        title: cleanTitle,
        message: cleanMessage,
        targetMode: cleanMode,
      });

      successCount += result.successCount || 0;
      failureCount += result.failureCount || 0;

      result.responses?.forEach((response, idx) => {
        const code = response.error?.code || '';
        if (!response.success && isInvalidTokenError(code)) {
          const originalIndex = chunkStart + idx;
          if (tokenDocs[originalIndex]?.ref) invalidRefs.push(tokenDocs[originalIndex].ref);
        }
      });
    }

    for (const refs of chunkArray(invalidRefs, 450)) {
      const batch = db.batch();
      refs.forEach((ref) => batch.set(ref, {
        enabled: false,
        disabledAt: admin.firestore.FieldValue.serverTimestamp(),
        disabledReason: 'invalid_fcm_token'
      }, { merge: true }));
      await batch.commit();
    }

    await webPushRef.set({
      enabled: true,
      dailyLimit,
      sentDate: todayKey,
      sentCount: sentCount + 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedByUid: decoded.uid
    }, { merge: true });

    return res.status(200).json({
      ok: true,
      totalTokens: tokens.length,
      successCount,
      failureCount,
    });
  } catch (error) {
    console.error('Erro ao enviar push web:', error);
    return res.status(500).json({
      ok: false,
      error: 'push_send_error',
      details: String(error?.message || 'Erro desconhecido ao enviar push.').slice(0, 240)
    });
  }
}
