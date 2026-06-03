              import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { 
  getAuth, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut, 
  updatePassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  setPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence,
  EmailAuthProvider,
  reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

        // ADICIONADO: enableIndexedDbPersistence
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, query, where, deleteDoc, writeBatch, addDoc, onSnapshot, orderBy, enableIndexedDbPersistence, arrayUnion, arrayRemove, serverTimestamp, increment, deleteField, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getMessaging, getToken, onMessage, deleteToken, isSupported as isMessagingSupported } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

let mainServiceWorkerRegistrationPromise = null;

        const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) return;
  if (window.__bolaoSwBootstrapped) return;
  window.__bolaoSwBootstrapped = true;

  let refreshing = false;


  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const swVersion = getAppVersion();

const registration = await navigator.serviceWorker.register(
  `/sw.js?v=${swVersion}`,
  { updateViaCache: 'none' }
);

mainServiceWorkerRegistrationPromise = Promise.resolve(registration);
window.__bolaoMainServiceWorkerRegistration = registration;

await registration.update();


      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    } catch (error) {
      console.error('Erro ao registrar service worker:', error);
    }
  });
};

window.getMainServiceWorkerRegistration = async () => {
  if (!('serviceWorker' in navigator)) return null;
  if (window.__bolaoMainServiceWorkerRegistration) return window.__bolaoMainServiceWorkerRegistration;
  if (!mainServiceWorkerRegistrationPromise) {
    mainServiceWorkerRegistrationPromise = navigator.serviceWorker.ready.catch(() => null);
  }
  const registration = await mainServiceWorkerRegistrationPromise.catch(() => null);
  if (registration) window.__bolaoMainServiceWorkerRegistration = registration;
  return registration || null;
};

registerServiceWorker();


const firebaseConfig = { apiKey: "AIzaSyAEkEE2X5hWIqopoJ0D9jFzCjJHKR8b82k", authDomain: "bolao112fc.firebaseapp.com", projectId: "bolao112fc", storageBucket: "bolao112fc.firebasestorage.app", messagingSenderId: "131329454158", appId: "1:131329454158:web:983e4544dd651ec942131f", measurementId: "G-5SGWJE6EKK" };
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);
         let currentUser = null;
let currentRankingData = [];
let compMap = {};
let globalServerCounts = {};

let appConfig = {
  chat: true,
  scout: true,
  vote: true,
  featureFlags: {},
  bgHome: "",
  bgRanking: "",
  mediaAssets: {},
  soundAssets: {},
  bannerActive: false,
  bannerBlocking: false,
  bannerTitle: "",
  bannerMessage: ""
};

let layoutOrder = [];
let homeSections = [];
let activePolls = {};
let activeBannersMap = {};
let __appStateUnsub = null;

let homeSectionCollapseState = {
  matches_open: false,
  matches_wait: false,
  matches_done: true
};

// NÃ£o alterar APP_VERSION automaticamente. A versÃ£o visual sÃ³ deve mudar quando solicitado pelo administrador.
const getAppVersion = () => String(window.APP_VERSION || 'web-1.7.5');
const getAppVersionShort = () => getAppVersion().replace(/^web-/, '');
const getAppVersionLabel = () => `Web v${getAppVersionShort()}`;
const getAppVersionFullLabel = () => `VersÃ£o ${getAppVersionLabel()}`;

const CHAT_MAX_MESSAGE_LENGTH = 280;
const CHAT_ALLOWED_REACTIONS = Object.freeze([
  "\u{1F44D}",
  "\u{1F602}",
  "\u{1F525}",
  "\u{1F621}",
  "\u{1F62D}"
]);
const SOUND_PREFERENCE_KEY = "bolao112_sound_enabled";

let matchesLoadRequestSeq = 0;
let adminCreationState = {
  loading: false,
  stage: "intro",
  competitions: [],
  competitionItems: [],
  rounds: [],
  inactiveRounds: [],
  selectedCompetition: "",
  selectedRound: "",
  editingRoundName: "",
  editingCompetitionName: "",
  roundsTab: "active",
  competitionsTab: "active",
  teams: []
};
let adminSessionProfile = null;
let adminQuickResultsState = {
  loading: false,
  saving: false,
  matches: [],
  selections: {},
  scrollTop: 0
};
let adminCleanupState = {
  tab: "trash",
  trashMatches: [],
  finishedMatches: [],
  search: ""
};
let adminMatchEditState = {
  loading: false,
  saving: false,
  matchId: "",
  match: null,
  guessCount: 0
};
let adminFinancialState = {
  users: [],
  whitelist: [],
  pushStatuses: {},
  search: "",
  sortKey: "name",
  sortDir: "asc",
  loading: false,
  editUserId: "",
  editUserDraft: null
};

let adminCommunicationState = {
  tab: "push",
  pushTargetMode: "all",
  pushSearch: "",
  users: [],
  selectedUids: new Set(),
  whatsappCount: 0
};
let adminRoundSummaryState = {
  loading: false,
  loadingImage: false,
  quickFilter: "all",
  competitionFilter: "",
  roundFilter: "",
  matches: [],
  users: [],
  guesses: [],
  competitions: [],
  rounds: [],
  selectedIds: new Set(),
  previewBlob: null,
  previewUrl: ""
};

// ================= UTILITÃRIOS GERAIS =================
const normalizeAdminText = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const normalizeHomeFeatureFlag = (raw = "") => {
  const value = String(raw || "").trim().toLowerCase();
  return ["", "chat", "fast_vote", "scout"].includes(value) ? value : "";
};

const normalizeHomeUserSegment = (raw = "") => {
  const value = String(raw || "").trim().toLowerCase();
  return ["", "debtors", "new_users", "veterans"].includes(value) ? value : "";
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeJsString = (value = "") =>
  String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, " ")
    .replace(/\r/g, " ");

const clampTextLength = (value = "", max = CHAT_MAX_MESSAGE_LENGTH) =>
  Array.from(String(value || "")).slice(0, max).join("");

const stripControlChars = (value = "") =>
  String(value || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

const normalizeChatMessageInput = (value = "") =>
  clampTextLength(
    stripControlChars(String(value || "").normalize("NFC")).replace(/\r\n?/g, "\n").trim(),
    CHAT_MAX_MESSAGE_LENGTH
  );

const getTextLength = (value = "") => Array.from(String(value || "")).length;

const normalizeChatUserName = (value = "") => {
  const sanitized = clampTextLength(
    stripControlChars(String(value || "").normalize("NFC")).trim(),
    40
  );
  return sanitized || "Anonimo";
};

const normalizeChatReaction = (value = "") => {
  const normalized = String(value || "").normalize("NFC").trim();
  return CHAT_ALLOWED_REACTIONS.includes(normalized) ? normalized : "";
};

const formatUserText = (value = "") =>
  escapeHtml(stripControlChars(String(value || "").normalize("NFC"))).replace(/\n/g, "<br>");

const isHttpUrl = (value = "") => /^https?:\/\/\S+/i.test(String(value || "").trim());

const formatAdminDateTimeInput = (value) => {
  const date = toJsDate(value) || new Date();
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatAdminDateTimeLabel = (value) => {
  const date = toJsDate(value) || new Date();
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const isPwaStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const isIosDevice = () =>
  /iPhone|iPad|iPod/i.test(window.navigator.userAgent || "") ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const toJsDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  return null;
};

const getAdminCommunicationVapidKey = async () => {
  const inlineKey = String(window.BOLAO_FCM_VAPID_KEY || "").trim();
  if (inlineKey) return inlineKey;

  try {
    const cfgSnap = await getDoc(doc(db, "settings", "config"));
    return String(cfgSnap.data()?.webPushVapidKey || "").trim();
  } catch (error) {
    console.warn("NÃ£o foi possÃ­vel carregar VAPID de settings/config:", error);
    return "";
  }
};

const isWebPushSupported = async () => {
  try {
    return "Notification" in window && "serviceWorker" in navigator && await isMessagingSupported();
  } catch (error) {
    console.warn("Push web indisponÃ­vel:", error);
    return false;
  }
};

const getWebPushPlatform = () => {
  const ua = window.navigator.userAgent || "";
  if (isIosDevice()) return "ios";
  if (/android/i.test(ua)) return "android";
  if (/windows|macintosh|linux|cros/i.test(ua)) return "desktop";
  return "unknown";
};

const updateUserPushStatusOnServer = async (status) => {
  try {
    if (!currentUser || !status) return;
    const activeUser = auth.currentUser || currentUser;
    const idToken = await activeUser.getIdToken(true);
    await fetch("/api/update-push-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({
        status,
        platform: getWebPushPlatform(),
        userAgent: navigator.userAgent || ""
      })
    });
  } catch (error) {
    console.warn("NÃ£o foi possÃ­vel salvar status de push:", error);
  }
};

const getProfileWebPushState = async (userData = {}) => {
  const vapidKey = await getAdminCommunicationVapidKey();
  const supported = await isWebPushSupported();
  const status = String(userData.webPushLastStatus || "").trim().toLowerCase();
  const tokenCount = Number(userData.webPushTokenCount || 0);
  const hasToken = userData.hasWebPushToken === true || status === "active" || tokenCount > 0;
  const disabled = status === "disabled";
  const knownIssue = ["denied", "unsupported", "ios_not_installed", "not_configured", "error"].includes(status);
  const active = hasToken && !disabled;

  let chip = "DESLIGADO";
  let desc = "Toque para ativar notificaÃ§Ãµes neste aparelho.";
  let note = supported
    ? "Funciona neste navegador quando permitido."
    : "Este navegador nÃ£o suporta notificaÃ§Ãµes web.";

  if (active) {
    chip = "LIGADO";
    desc = "NotificaÃ§Ãµes deste aparelho ativas. Toque para desligar.";
    note = "VocÃª receberÃ¡ avisos importantes do BolÃ£o, inclusive em segundo plano.";
  } else if (knownIssue) {
    chip = "REVALIDAR";
    desc = status === "denied"
      ? "PermissÃ£o negada. Toque para tentar novamente."
      : status === "ios_not_installed"
        ? "No iPhone, adicione Ã  Tela de InÃ­cio antes de ativar."
        : status === "unsupported"
          ? "Este navegador nÃ£o suporta notificaÃ§Ãµes web."
          : status === "not_configured"
            ? "Push ainda nÃ£o configurado pelo admin."
            : "Toque para tentar novamente.";
    note = isIosDevice()
      ? "Requer iOS 16.4 ou superior."
      : "VocÃª pode tentar novamente quando quiser.";
  } else if (disabled) {
    chip = "DESLIGADO";
    desc = "NotificaÃ§Ãµes deste aparelho desativadas.";
    note = "Toque para ativar novamente.";
  } else if (!vapidKey) {
    chip = "DESLIGADO";
    desc = "Push ainda nÃ£o configurado pelo admin.";
    note = "Configure a chave VAPID pÃºblica para liberar notificaÃ§Ãµes.";
  } else if (!supported) {
    chip = "DESLIGADO";
    desc = "Este navegador ainda nÃ£o suporta notificaÃ§Ãµes web.";
  }

  return {
    active,
    chip,
    desc,
    note,
    hasToken,
    supported,
    vapidKey,
    status
  };
};

window.toggleProfileWebPushPreference = async () => {
  if (!currentUser) {
    alert("FaÃ§a login para ativar notificaÃ§Ãµes.");
    return;
  }

  const userData = getMergedCurrentUserData(currentUser || {});
  const pushState = await getProfileWebPushState(userData);

  if (pushState.active) {
    try {
      if (pushState.supported) {
        const swRegistration = window.getMainServiceWorkerRegistration
          ? await window.getMainServiceWorkerRegistration()
          : await navigator.serviceWorker.ready.catch(() => null);
        if (swRegistration) {
          const messaging = getMessaging(app);
          try {
            await deleteToken(messaging, { serviceWorkerRegistration: swRegistration });
          } catch (error) {
            console.warn("NÃ£o foi possÃ­vel remover o token local de push:", error);
          }
        }
      }

      await updateUserPushStatusOnServer("disabled");
      if (typeof loadProfile === "function" && !document.getElementById("profileScreen")?.classList.contains("hidden")) {
        await loadProfile();
      }
      if (typeof showFinancialToast === "function") showFinancialToast("NotificaÃ§Ãµes deste aparelho desativadas.");
      else alert("NotificaÃ§Ãµes deste aparelho desativadas.");
    } catch (error) {
      console.error("Falha ao desativar notificaÃ§Ãµes deste aparelho:", error);
      if (typeof showFinancialToast === "function") showFinancialToast("NÃ£o foi possÃ­vel desativar as notificaÃ§Ãµes.", "danger");
      else alert("NÃ£o foi possÃ­vel desativar as notificaÃ§Ãµes.");
    }
    return;
  }

  await window.requestWebPushPermissionAndSaveToken();
};

let foregroundPushListenerReady = false;

const showForegroundPushFallback = (title, body) => {
  const message = [title, body].filter(Boolean).join("\n");
  if (typeof showFinancialToast === "function") {
    showFinancialToast(message || "Novo comunicado recebido.", "success");
    return;
  }
  if (message) alert(message);
};

const setupForegroundPushListener = async () => {
  if (foregroundPushListenerReady) return;
  foregroundPushListenerReady = true;

  try {
    if (!await isWebPushSupported()) return;

    const messaging = getMessaging(app);
    onMessage(messaging, async (payload) => {
      const title = payload?.notification?.title || payload?.data?.title || "BolÃ£o 112 FC";
      const body = payload?.notification?.body || payload?.data?.body || "";
      const link = payload?.fcmOptions?.link || payload?.data?.link || "https://bolao112-site.vercel.app/";
      const tag = payload?.messageId || `bolao112-${Date.now()}`;

      if (Notification.permission !== "granted") {
        showForegroundPushFallback(title, body);
        return;
      }

      try {
        const registration = window.getMainServiceWorkerRegistration
          ? await window.getMainServiceWorkerRegistration()
          : await navigator.serviceWorker.ready.catch(() => null);

        if (!registration?.showNotification) throw new Error("service_worker_registration_unavailable");

        await registration.showNotification(title, {
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          data: { url: link },
          tag
        });
      } catch (error) {
        console.warn("Falha ao exibir push em primeiro plano:", error);
        showForegroundPushFallback(title, body);
      }
    });
  } catch (error) {
    foregroundPushListenerReady = false;
    console.warn("NÃ£o foi possÃ­vel instalar listener de push em primeiro plano:", error);
  }
};

const registerWebPushTokenOnServer = async (token) => {
  if (!currentUser || !token) return false;
  const activeUser = auth.currentUser || currentUser;
  const idToken = await activeUser.getIdToken(true);
  const response = await fetch("/api/register-push-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`
    },
    body: JSON.stringify({
      token,
      platform: getWebPushPlatform(),
      userAgent: navigator.userAgent || ""
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.ok === false) {
    const error = new Error(result?.error || "NÃ£o foi possÃ­vel registrar este aparelho.");
    error.code = result?.error || "register_push_error";
    error.result = result;
    throw error;
  }
  return true;
};

const isIosPwaHintRequired = () => isIosDevice() && !isPwaStandalone();

const buildIosPushHelpHtml = () => {
  if (!isIosDevice()) return "";

  return `
    <div class="profile-push-ios-help">
      <div class="profile-push-ios-help__title">
        <i class="fab fa-apple"></i>
        <span>iPhone / iPad</span>
      </div>
      <p>Para receber notificaÃ§Ãµes no iPhone, use o Safari e adicione o BolÃ£o Ã  Tela de InÃ­cio. Requer iOS 16.4 ou superior.</p>
      <ol>
        <li>Abra o BolÃ£o pelo Safari.</li>
        <li>Toque em Compartilhar.</li>
        <li>Toque em Adicionar Ã  Tela de InÃ­cio.</li>
        <li>Abra o BolÃ£o pelo Ã­cone criado.</li>
        <li>FaÃ§a login.</li>
        <li>VÃ¡ em Perfil.</li>
        <li>Toque em Ativar notificaÃ§Ãµes deste aparelho.</li>
      </ol>
    </div>
  `;
};

const buildProfileWebPushSection = async (userData = {}) => {
  const vapidKey = await getAdminCommunicationVapidKey();
  const supported = await isWebPushSupported();
  const hasToken = userData.hasWebPushToken === true;
  const platform = getWebPushPlatform();
  const pushStatus = !vapidKey
    ? "Push ainda nÃ£o configurado pelo admin"
    : hasToken
      ? "NotificaÃ§Ãµes ativadas neste aparelho"
      : supported
        ? "Toque para ativar neste aparelho"
        : "Navegador incompatÃ­vel";
  const pushDescription = hasToken
    ? "VocÃª receberÃ¡ avisos importantes do BolÃ£o, inclusive quando o site/app estiver em segundo plano."
    : !supported
      ? "Este navegador ainda nÃ£o suporta notificaÃ§Ãµes web. Tente usar Chrome no Android ou Safari no iPhone com o BolÃ£o adicionado Ã  Tela de InÃ­cio."
      : !vapidKey
        ? "Configure a chave VAPID pÃºblica para liberar notificaÃ§Ãµes neste app."
        : isIosPwaHintRequired()
          ? "No iPhone, para receber notificaÃ§Ãµes, Ã© necessÃ¡rio adicionar o BolÃ£o Ã  Tela de InÃ­cio e abrir pelo Ã­cone criado. Depois disso, volte aqui e toque em â€œAtivar notificaÃ§Ãµes deste aparelhoâ€."
          : platform === "android"
            ? "VocÃª pode receber notificaÃ§Ãµes mesmo sem instalar o app. Basta permitir as notificaÃ§Ãµes neste navegador. Para uma experiÃªncia melhor, recomendamos adicionar o BolÃ£o Ã  tela inicial."
            : "Permita as notificaÃ§Ãµes deste aparelho para receber avisos do BolÃ£o 112 FC.";
  const pushNote = hasToken
    ? "NotificaÃ§Ãµes ativadas neste aparelho."
    : isIosDevice()
      ? "Requer iOS 16.4 ou superior."
      : "Funciona em navegadores compatÃ­veis com Web Push.";
  const pushButtonLabel = hasToken
    ? "Revalidar notificaÃ§Ãµes deste aparelho"
    : "Ativar notificaÃ§Ãµes deste aparelho";

  return `
    <section id="profileWebPushSection" class="profile-section profile-section--compact mb-3">
      ${renderProfileSectionHeader("NotificaÃ§Ãµes", "Receba avisos deste aparelho", pushStatus)}
      <div class="profile-push-card">
        <div class="profile-push-card__copy">
          <div class="profile-push-card__title">Ative as notificaÃ§Ãµes deste aparelho</div>
          <div class="profile-push-card__desc">${escapeHtml(pushDescription)}</div>
          <div class="profile-push-card__note">${escapeHtml(pushNote)}</div>
        </div>
        <button type="button" onclick="window.requestWebPushPermissionAndSaveToken()" class="profile-push-card__button btn-press">
          <i class="fas fa-bell"></i>
          <span>${escapeHtml(pushButtonLabel)}</span>
        </button>
      </div>
      ${buildIosPushHelpHtml()}
    </section>
  `;
};

window.requestWebPushPermissionAndSaveToken = async () => {
  if (!currentUser) {
    alert("FaÃ§a login para ativar notificaÃ§Ãµes.");
    return null;
  }

  if (!await isWebPushSupported()) {
    await updateUserPushStatusOnServer("unsupported");
    alert("Este navegador ainda nÃ£o suporta push web neste aparelho.");
    return null;
  }

  const vapidKey = await getAdminCommunicationVapidKey();
  if (!vapidKey) {
    await updateUserPushStatusOnServer("not_configured");
    alert("Push ainda nÃ£o configurado pelo admin.");
    return null;
  }

  if (isIosPwaHintRequired()) {
    await updateUserPushStatusOnServer("ios_not_installed");
    alert("No iPhone, adicione o BolÃ£o Ã  Tela de InÃ­cio antes de ativar as notificaÃ§Ãµes.");
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    await updateUserPushStatusOnServer(permission === "denied" ? "denied" : "error");
    alert(permission === "denied" ? "PermissÃ£o negada." : "PermissÃ£o de notificaÃ§Ã£o nÃ£o concedida.");
    return null;
  }

  const swRegistration = window.getMainServiceWorkerRegistration
    ? await window.getMainServiceWorkerRegistration()
    : await navigator.serviceWorker.ready.catch(() => null);
  if (!swRegistration) {
    alert("NÃ£o foi possÃ­vel preparar o serviÃ§o de notificaÃ§Ãµes neste aparelho.");
    return null;
  }

  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swRegistration
  });

  if (!token) {
    alert("NÃ£o foi possÃ­vel obter o token de push deste aparelho.");
    return null;
  }

  try {
    await registerWebPushTokenOnServer(token);
  } catch (error) {
    console.error("Erro ao registrar token de push:", error);
    if (error.code === "push_not_configured") {
      await updateUserPushStatusOnServer("not_configured");
      alert("Push ainda nÃ£o configurado pelo servidor.");
      return null;
    }
    await updateUserPushStatusOnServer("error");
    alert(error.message || "NÃ£o foi possÃ­vel registrar este aparelho.");
    return null;
  }

  alert("NotificaÃ§Ãµes ativadas neste aparelho.\n\nAgora feche o app ou deixe-o em segundo plano e envie um push de teste pelo admin.");
  if (typeof loadProfile === "function" && !document.getElementById("profileScreen")?.classList.contains("hidden")) {
    loadProfile();
  }
  return token;
};

const normalizeRoundName = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const buildAdminWhatsAppMessage = ({ teamA, teamB, competition, round, deadline }) => {
  const dateLabel = deadline ? formatAdminDateTimeLabel(deadline) : "";
  return `ðŸ“¢ JOGO NOVO: ðŸ“¢\n\nâš½ ${teamA} x ${teamB}\nðŸ† ${competition} (${round})\nâ° ${dateLabel}\n\nðŸ“² VOTE AGORA: https://bolao112-site.vercel.app`;
};

const getAdminCreationTeamFieldIds = (side) => ({
  name: `adminTeamName${side}`,
  logo: `adminTeamLogo${side}`,
  thumb: `adminTeamThumb${side}`,
  thumbImg: `adminTeamThumbImg${side}`,
  thumbFallback: `adminTeamThumbFallback${side}`,
  suggestions: `adminTeamSuggestions${side}`
});

const syncStaticVersionLabels = () => {
  document.querySelectorAll('[data-app-version-label]').forEach((el) => {
    el.textContent = getAppVersionLabel();
  });
  document.querySelectorAll('[data-app-version-full]').forEach((el) => {
    el.textContent = getAppVersionFullLabel();
  });
};

const setHomeMode = (enabled) => {
  const appContent = document.getElementById('appContent');
  if (!appContent) return;
  appContent.classList.toggle('home-mode', !!enabled);
};

let deferredPwaInstallPrompt = null;

const updatePwaInstallCard = () => {
  const card = document.getElementById('pwaInstallCard');
  const text = document.getElementById('pwaInstallText');
  const button = document.getElementById('btnInstallPwa');

  if (!card || !text || !button) return;

  button.classList.add('hidden');

  if (isPwaStandalone()) {
    text.textContent = 'VocÃª jÃ¡ estÃ¡ usando o BolÃ£o 112 FC como app instalado.';
    card.classList.add('pwa-install-card--installed');
    return;
  }

  card.classList.remove('pwa-install-card--installed');

  if (deferredPwaInstallPrompt) {
    text.textContent = 'Acesse pela tela inicial como um app, sem precisar procurar o site toda vez.';
    button.classList.remove('hidden');
    return;
  }

  if (isIosDevice()) {
    text.textContent = 'No Safari, toque em Compartilhar e depois em Adicionar Ã  Tela de InÃ­cio.';
    return;
  }

  text.textContent = 'No Chrome, use o menu do navegador e escolha instalar ou adicionar Ã  tela inicial.';
};

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPwaInstallPrompt = event;
  updatePwaInstallCard();
});

window.addEventListener('appinstalled', () => {
  deferredPwaInstallPrompt = null;
  updatePwaInstallCard();
});

const ensureExternalScript = (src, globalKey) => {
  if (globalKey && window[globalKey]) return Promise.resolve(window[globalKey]);
  if (!window.__externalScriptPromises) window.__externalScriptPromises = {};
  if (window.__externalScriptPromises[src]) return window.__externalScriptPromises[src];

  window.__externalScriptPromises[src] = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-dynamic-src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(globalKey ? window[globalKey] : true), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Falha ao carregar ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.dataset.dynamicSrc = src;
    script.onload = () => resolve(globalKey ? window[globalKey] : true);
    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(script);
  });

  return window.__externalScriptPromises[src];
};

const ensureChartJs = () => ensureExternalScript('https://cdn.jsdelivr.net/npm/chart.js', 'Chart');
const ensureHtml2Canvas = () => ensureExternalScript('https://html2canvas.hertzen.com/dist/html2canvas.min.js', 'html2canvas');

const DATA_CACHE_TTL = {
  hot: 15000,
  warm: 60000,
  cold: 300000
};

const runtimeQueryCache = new Map();
window.__matchesScreenStateCache = null;
window.__rankingScreenCache = null;

const readWithRuntimeCache = async (key, loader, { ttlMs = DATA_CACHE_TTL.hot, force = false } = {}) => {
  const now = Date.now();
  const current = runtimeQueryCache.get(key);

  if (!force && current?.data && (now - current.ts) < ttlMs) {
    return current.data;
  }

  if (!force && current?.promise) {
    return current.promise;
  }

  const promise = Promise.resolve()
    .then(loader)
    .then((data) => {
      runtimeQueryCache.set(key, { data, ts: Date.now(), promise: null });
      return data;
    })
    .catch((error) => {
      runtimeQueryCache.delete(key);
      throw error;
    });

  runtimeQueryCache.set(key, {
    data: current?.data || null,
    ts: current?.ts || 0,
    promise
  });

  return promise;
};

const invalidateRuntimeCache = (...keys) => {
  keys.forEach((key) => runtimeQueryCache.delete(key));
};

const invalidateHomeRankingCaches = () => {
  invalidateRuntimeCache(
    "col:matches",
    "col:guesses",
    "col:users",
    "col:teams",
    "col:match_comments",
    "col:polls",
    "col:banners",
    "doc:settings:competitions",
    "doc:settings:rounds",
    "doc:settings:news",
    "doc:settings:home_layout"
  );

  window.__matchesScreenStateCache = null;
  window.__rankingScreenCache = null;
  window.cachedMatches = null;
};

const syncMatchesNavBadge = (pendingFastVoteCount = 0) => {
  const navBtn = document.getElementById("nav-matches");
  const oldBadge = document.getElementById("matches-badge");

  if (oldBadge) oldBadge.remove();
  if (!navBtn || pendingFastVoteCount <= 0) return;

  navBtn.innerHTML += `<span id="matches-badge" class="nav-badge">${pendingFastVoteCount > 9 ? "+" : pendingFastVoteCount}</span>`;
};

const renderMatchesScreenFromState = async (state) => {
  const container = document.getElementById("matchesScreen");
  if (!container || !state) return;

  const finalHtml = await renderHomeSectionsWeb(state);
  container.innerHTML = finalHtml;
  applyRemoteBackgrounds();
  window.updateBadges();
  syncMatchesNavBadge(state.runtime?.pendingFastVoteCount || 0);
};

// --- NOVA FUNÃ‡ÃƒO DE ORDENAÃ‡ÃƒO (PADRÃƒO ANDROID) ---
// Regra: 1. Prazo (Crescente) | 2. CriaÃ§Ã£o (Crescente/Antigo 1Âº) | 3. ID (Fallback)
const matchComparator = (a, b) => {
    // 1. Deadline
    const dateA = a.deadlineDate ? a.deadlineDate.getTime() : 0;
    const dateB = b.deadlineDate ? b.deadlineDate.getTime() : 0;
    if (dateA !== dateB) return dateA - dateB;

    // 2. CreatedAt (Desempate: Jogo cadastrado antes recebe # menor)
    // Tratamento seguro para timestamp do Firestore ou Date convertida
    let createdA = 0, createdB = 0;
    
    if (a.createdAt) {
        if (typeof a.createdAt.toDate === 'function') createdA = a.createdAt.toDate().getTime();
        else if (a.createdAt instanceof Date) createdA = a.createdAt.getTime();
        else if (a.createdAt.seconds) createdA = a.createdAt.seconds * 1000;
    }
    
    if (b.createdAt) {
        if (typeof b.createdAt.toDate === 'function') createdB = b.createdAt.toDate().getTime();
        else if (b.createdAt instanceof Date) createdB = b.createdAt.getTime();
        else if (b.createdAt.seconds) createdB = b.createdAt.seconds * 1000;
    }

    if (createdA !== createdB) return createdA - createdB;

    // 3. ID (Ãšltimo recurso)
    return a.id.localeCompare(b.id);
};
       // --- ÃUDIO SIMPLES (SOMENTE POP) ---
        const isSoundEnabled = () => {
  try {
    return localStorage.getItem(SOUND_PREFERENCE_KEY) !== "0";
  } catch (e) {
    return true;
  }
};

const setSoundEnabled = (enabled) => {
  try {
    localStorage.setItem(SOUND_PREFERENCE_KEY, enabled ? "1" : "0");
  } catch (e) {
    console.log("Nao foi possivel salvar preferencia de som:", e);
  }
};

window.toggleSoundPreference = () => {
  const nextValue = !isSoundEnabled();
  setSoundEnabled(nextValue);
  if (typeof loadProfile === "function" && !document.getElementById("profileScreen")?.classList.contains("hidden")) {
    loadProfile();
  }
  if (nextValue) playVoteSound();
};

        const playVoteSound = () => {
  if (!isSoundEnabled()) return;
  try {
    const audioSrc = resolveRemoteSoundAsset("POP", "som_pop.mp3");
    const audio = new Audio(audioSrc);
    audio.volume = 0.5;
    audio.play().catch(e => console.log("Ãudio bloqueado:", e));
  } catch (e) {
    console.log(e);
  }
};
        
        // Garante que o som toque nas funÃ§Ãµes de voto existentes
        // (Nota: As funÃ§Ãµes window.vote e window.votePoll jÃ¡ chamam playVoteSound(), 
        // entÃ£o sÃ³ precisamos definir ela aqui em cima e tudo volta a funcionar).
        // --- NOVO: FUNÃ‡ÃƒO GERADORA DE AVATAR (DiceBear) ---
        // --- GERADOR DE AVATAR (CORRIGIDO PARA FOTO REAL) ---
        const getAvatarUrl = (base64, name) => {
            // Verifica se existe, se nÃ£o Ã© texto "null"/"undefined" e se Ã© longo o suficiente para ser imagem
            if (base64 && typeof base64 === 'string' && base64.length > 50 && base64 !== "null" && base64 !== "undefined") {
                // Se jÃ¡ vier com o cabeÃ§alho 'data:image', usa como estÃ¡. Se nÃ£o, adiciona.
                if (base64.startsWith('data:image')) {
                    return base64;
                } else {
                    return `data:image/jpeg;base64,${base64}`;
                }
            }
            
            // Fallback: DiceBear (Avatar Desenhado)
            const seed = (name || "user").trim();
            const bgColors = ["b6e3f4", "c0aede", "d1d4f9", "ffdfbf", "fdcdc5"]; 
            const bg = bgColors[seed.length % bgColors.length];
            return `https://api.dicebear.com/7.x/adventurer/png?seed=${seed}&backgroundColor=${bg}`;
        };

        // --- OTIMIZAÃ‡ÃƒO: ATIVAR CACHE OFFLINE ---
        // Isso faz o site carregar instantaneamente na 2Âª visita
        enableIndexedDbPersistence(db).catch((err) => {
            if (err.code == 'failed-precondition') {
                console.log('Muitas abas abertas. O cache funcionarÃ¡ em apenas uma.');
            } else if (err.code == 'unimplemented') {
                console.log('Navegador nÃ£o suporta persistÃªncia.');
            }
        });
        // ----------------------------------------
      // --- RULES GATE (3.3) ---
window.__rulesGateLock = false;
window.__rulesGate = {
  requiredVersion: 0,
  items: [],
  updatedAt: null,
  officialStartAt: null,
  gateRules: false
};

// ===============================
// FORCE PASSWORD CHANGE GATE (igual Android)
// ===============================
window.__forcePwLock = false;
window.__forcePwUnsub = null;

// helper pra mostrar erro no modal
const setForcePwError = (msg) => {
  const box = document.getElementById("forcePwError");
  if (!box) return;
  if (!msg) {
    box.classList.add("hidden");
    box.innerText = "";
    return;
  }
  box.classList.remove("hidden");
  box.innerText = msg;
};

// fecha modal sÃ³ quando concluir troca (ou sair)
window.closeForcePasswordModal = () => {
  // libera a trava e fecha o modal
  window.__forcePwLock = false;
  try { window.closeModal(); } catch(e) {}
};

// abre modal bloqueante
window.openForcePasswordModal = (firebaseUser) => {
  // evita duplicar
  if (document.getElementById("forcePwModalRoot")) return;

  // trava o fechamento por overlay/ESC/closeModal
  window.__forcePwLock = true;

  window.openModal(`
    <div id="forcePwModalRoot" class="w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden">
      <div class="bg-[#006400] p-4 text-white">
        <div class="text-sm font-black uppercase tracking-wider">Troca de senha obrigatÃ³ria</div>
        <div class="text-[11px] text-white/90 font-bold mt-1">
          O admin resetou sua senha. Por seguranÃ§a, vocÃª precisa criar uma nova senha agora para que sÃ³ vocÃª saiba.
        </div>
      </div>

<div class="p-4 space-y-3">

  <!-- SENHA ATUAL (TEMPORÃRIA) -->
  <div>
    <label for="forcePwCurrent" class="block text-[11px] font-black text-gray-600 uppercase mb-1">
      Senha atual (temporÃ¡ria)
    </label>

    <div style="position: relative;">
      <input
        id="forcePwCurrent"
        name="currentPassword"
        type="password"
        class="w-full border rounded px-3 py-2 text-sm pr-10"
        placeholder="Digite a senha usada para entrar"
        autocomplete="current-password"
        aria-label="Senha atual (temporÃ¡ria)"
      />
      <button
        id="eyeForceCurrent"
        type="button"
        aria-label="Mostrar/ocultar senha atual"
        style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:transparent; border:none; color:#666; font-size:16px; cursor:pointer; padding:6px;">
      </button>
    </div>
  </div>

  <!-- NOVA SENHA -->
  <div>
    <label for="forcePwNew" class="block text-[11px] font-black text-gray-600 uppercase mb-1">
      Nova senha
    </label>

    <div style="position: relative;">
      <input
        id="forcePwNew"
        name="newPassword"
        type="password"
        class="w-full border rounded px-3 py-2 text-sm pr-10"
        placeholder="MÃ­nimo 6 caracteres"
        autocomplete="new-password"
        aria-label="Nova senha"
      />
      <button
        id="eyeForceNew"
        type="button"
        aria-label="Mostrar/ocultar nova senha"
        style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:transparent; border:none; color:#666; font-size:16px; cursor:pointer; padding:6px;">
      </button>
    </div>
  </div>

  <!-- CONFIRMAR NOVA SENHA -->
  <div>
    <label for="forcePwConfirm" class="block text-[11px] font-black text-gray-600 uppercase mb-1">
      Confirmar nova senha
    </label>

    <div style="position: relative;">
      <input
        id="forcePwConfirm"
        name="confirmPassword"
        type="password"
        class="w-full border rounded px-3 py-2 text-sm pr-10"
        placeholder="Repita a nova senha"
        autocomplete="new-password"
        aria-label="Confirmar nova senha"
      />
      <button
        id="eyeForceConfirm"
        type="button"
        aria-label="Mostrar/ocultar confirmaÃ§Ã£o"
        style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:transparent; border:none; color:#666; font-size:16px; cursor:pointer; padding:6px;">
      </button>
    </div>
  </div>

  <div id="forcePwError" class="text-[11px] font-bold text-red-600 hidden"></div>

  <button id="forcePwSaveBtn" class="w-full bg-[#006400] text-white font-black py-3 rounded shadow btn-press text-sm">
    SALVAR NOVA SENHA
  </button>

  <button id="forcePwSignOutBtn" class="w-full bg-gray-100 text-gray-700 font-black py-3 rounded shadow btn-press text-sm">
    SAIR
  </button>
</div>

    </div>
  `);

// liga olhos nos 3 campos
window.attachPasswordEye("forcePwCurrent", "eyeForceCurrent");
window.attachPasswordEye("forcePwNew", "eyeForceNew");
window.attachPasswordEye("forcePwConfirm", "eyeForceConfirm");

        
  // botÃ£o SAIR (Ãºnica forma de fechar sem trocar)
  document.getElementById("forcePwSignOutBtn").onclick = async () => {
    try { await signOut(auth); } catch(e) {}
    // libera e fecha
    window.__forcePwLock = false;
    window.closeModal();
  };

  // botÃ£o SALVAR
  document.getElementById("forcePwSaveBtn").onclick = async () => {
    setForcePwError("");

    const currentPw = (document.getElementById("forcePwCurrent").value || "").trim();
    const newPw = (document.getElementById("forcePwNew").value || "").trim();
    const confirmPw = (document.getElementById("forcePwConfirm").value || "").trim();

    if (!currentPw) return setForcePwError("Digite sua senha atual (temporÃ¡ria).");
    if (!newPw || newPw.length < 6) return setForcePwError("A nova senha deve ter no mÃ­nimo 6 caracteres.");
    if (newPw !== confirmPw) return setForcePwError("A confirmaÃ§Ã£o nÃ£o confere com a nova senha.");

    const btnSave = document.getElementById("forcePwSaveBtn");
    const btnOut = document.getElementById("forcePwSignOutBtn");
    btnSave.disabled = true;
    btnOut.disabled = true;
    btnSave.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> SALVANDO...`;

    try {
      const email = firebaseUser?.email;
      if (!email) throw { code: "missing-email" };

      // 1) Reautenticar com a senha temporÃ¡ria (a usada pra logar)
      const cred = EmailAuthProvider.credential(email, currentPw);
      await reauthenticateWithCredential(firebaseUser, cred);

      // 2) Atualizar senha
      await updatePassword(firebaseUser, newPw);

      // 3) Atualizar Firestore (desliga o gate)
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        forcePasswordChange: false,
        lastPasswordChangedAt: serverTimestamp()
      });

      // (opcional) se vocÃª guardar algo no localStorage relacionado a login, limpe aqui
      // localStorage.removeItem("SUA_CHAVE_AQUI");

      // 4) fecha e libera
      window.closeForcePasswordModal();

    } catch (e) {
      console.error("forcePasswordChange error:", e);
      const code = e?.code || "";

      if (code === "auth/wrong-password") setForcePwError("Senha atual incorreta.");
      else if (code === "auth/too-many-requests") setForcePwError("Muitas tentativas. Aguarde e tente novamente.");
      else if (code === "auth/requires-recent-login") setForcePwError("Por seguranÃ§a, faÃ§a login novamente e tente de novo.");
      else if (code === "permission-denied") setForcePwError("Sem permissÃ£o no Firestore. Contate o admin.");
      else if (code === "unauthenticated") setForcePwError("SessÃ£o invÃ¡lida. FaÃ§a login novamente.");
      else setForcePwError("Erro ao trocar senha. Tente novamente.");

      btnSave.disabled = false;
      btnOut.disabled = false;
      btnSave.innerHTML = `SALVAR NOVA SENHA`;
    }
  };
};

// listener em tempo real no users/{uid}
window.startForcePasswordWatcher = (firebaseUser) => {
  // derruba listener anterior (se trocar usuÃ¡rio)
  if (window.__forcePwUnsub) {
    try { window.__forcePwUnsub(); } catch(e) {}
    window.__forcePwUnsub = null;
  }
  if (!firebaseUser) return;

  const userRef = doc(db, "users", firebaseUser.uid);

  window.__forcePwUnsub = onSnapshot(userRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    const mustChange = data.forcePasswordChange === true;

    if (mustChange) {
      window.openForcePasswordModal(firebaseUser);
    } else {
      // se estava aberto e jÃ¡ foi resolvido, fecha
      if (document.getElementById("forcePwModalRoot")) {
        window.closeForcePasswordModal();
window.continueAfterLoginGates();
      }
    }
  }, (err) => {
    console.error("forcePasswordChange snapshot error:", err);
  });
};

window.startCurrentUserDataWatcher = (firebaseUser) => {
  if (window.__currentUserLiveDataUnsub) {
    try { window.__currentUserLiveDataUnsub(); } catch (error) {}
    window.__currentUserLiveDataUnsub = null;
  }
  window.__currentUserLiveData = null;
  if (!firebaseUser) return;

  const userRef = doc(db, "users", firebaseUser.uid);

  window.__currentUserLiveDataUnsub = onSnapshot(userRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data() || {};
    const previous = window.__currentUserLiveData || {};
    applyLiveCurrentUserData(data);

    const currentMonthKey = typeof getFinancialCurrentMonthKey === "function" ? getFinancialCurrentMonthKey() : "";
    const previousPayment = previous?.payments?.[currentMonthKey] === true;
    const nextPayment = data?.payments?.[currentMonthKey] === true;
    const paymentChanged = previousPayment !== nextPayment;
    const profileChanged =
      String(previous?.photoBase64 || "") !== String(data.photoBase64 || "") ||
      String(previous?.name || "") !== String(data.name || "") ||
      String(previous?.username || "") !== String(data.username || "") ||
      Number(previous?.debts || 0) !== Number(data.debts || 0) ||
      String(previous?.webPushLastStatus || "") !== String(data.webPushLastStatus || "") ||
      Number(previous?.webPushTokenCount || 0) !== Number(data.webPushTokenCount || 0);

    const visibleTab = getCurrentVisibleTab();
    const shouldRefreshAny = paymentChanged || profileChanged;

    if (shouldRefreshAny) {
      refreshCurrentVisibleViews({
        forceMatches: true,
        forceRanking: visibleTab === "ranking",
        forceProfile: visibleTab === "profile"
      }).catch((error) => {
        console.error("Falha ao atualizar dados do usuÃ¡rio em tempo real:", error);
      });
    }
  }, (err) => {
    console.error("currentUserData snapshot error:", err);
  });
};


window.currentUid = null;
window.currentUser = null;
window.__currentUserLiveData = null;
window.__currentUserLiveDataUnsub = null;
window.__appRefreshBusy = false;

// Normaliza TS/Date
const toMillis = (v) => {
  if (!v) return 0;
  if (v instanceof Date) return v.getTime();
  if (typeof v.toDate === "function") return v.toDate().getTime();
  if (v.seconds) return v.seconds * 1000;
  return 0;
};

// Decide se o gate deve valer (considerando officialStartAt opcional)
const shouldGateBeActiveNow = (officialStartAt) => {
  if (!officialStartAt) return true; // se nÃ£o tiver, vale sempre
  const now = Date.now();
  return now >= toMillis(officialStartAt);
};


        // COLETAR ESTE BLOCO AQUI (INÃCIO)
// --- 2. SISTEMA DE REMOTE CONFIG (BANNERS E RECURSOS) ---
        const normalizeRemoteMap = (raw) => {
  const result = {};
  if (!raw || typeof raw !== "object") return result;

  Object.entries(raw).forEach(([key, value]) => {
    if (typeof key !== "string" || typeof value !== "string") return;
    const safeKey = key.trim();
    const safeValue = fixDriveUrl(value.trim());
    if (safeKey && safeValue) result[safeKey] = safeValue;
  });

  return result;
};

const resolveRemoteMediaAsset = (source = "") => {
  const trimmed = String(source || "").trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("data:image")) return trimmed;
  if (/^[A-Za-z0-9+/=]{120,}$/.test(trimmed)) {
    return `data:image/jpeg;base64,${trimmed}`;
  }

  return appConfig.mediaAssets[trimmed] || fixDriveUrl(trimmed);
};

const resolveRemoteSoundAsset = (code = "", fallback = "som_pop.mp3") => {
  const trimmed = String(code || "").trim();
  return appConfig.soundAssets[trimmed] || fallback;
};

const applyRemoteBackgrounds = () => {
  const homeBg = resolveRemoteMediaAsset(appConfig.bgHome);
  const rankingBg = resolveRemoteMediaAsset(appConfig.bgRanking);

  const applyBg = (el, bgUrl) => {
    if (!el) return;

    if (bgUrl) {
      el.style.backgroundImage = `linear-gradient(rgba(255,255,255,0.92), rgba(255,255,255,0.97)), url('${bgUrl}')`;
      el.style.backgroundSize = "cover";
      el.style.backgroundPosition = "center";
      el.style.backgroundRepeat = "no-repeat";
    } else {
      el.style.backgroundImage = "";
      el.style.backgroundSize = "";
      el.style.backgroundPosition = "";
      el.style.backgroundRepeat = "";
    }
  };

  applyBg(document.getElementById("matchesScreen"), homeBg);
  applyBg(document.getElementById("rankingScreen"), rankingBg);
};

const initRemoteConfig = () => {
  onSnapshot(doc(db, "settings", "config"), (docSnap) => {
    if (!docSnap.exists()) return;

    const config = docSnap.data() || {};
    const featureFlags = (config.feature_flags && typeof config.feature_flags === "object")
      ? config.feature_flags
      : {};

    appConfig.featureFlags = featureFlags;
    appConfig.chat =
      (typeof featureFlags.chat === "boolean" ? featureFlags.chat : undefined) ??
      (typeof config.enable_chat === "boolean" ? config.enable_chat : undefined) ??
      true;

    appConfig.scout =
      (typeof featureFlags.scout === "boolean" ? featureFlags.scout : undefined) ??
      (typeof config.enable_scout === "boolean" ? config.enable_scout : undefined) ??
      true;

    appConfig.vote =
      (typeof featureFlags.fast_vote === "boolean" ? featureFlags.fast_vote : undefined) ??
      (typeof config.enable_fast_vote === "boolean" ? config.enable_fast_vote : undefined) ??
      true;

    appConfig.bannerActive = config.banner_active === true;
    appConfig.bannerBlocking = config.banner_blocking === true;
    appConfig.bannerTitle = String(config.banner_title || "");
    appConfig.bannerMessage = String(config.banner_message || "");

    appConfig.bgHome = String(config.bg_home || config.bghome || "");
    appConfig.bgRanking = String(config.bg_ranking || config.bgranking || "");
    appConfig.mediaAssets = normalizeRemoteMap(config.media_assets);
    appConfig.soundAssets = normalizeRemoteMap(config.sound_assets);

    applyRemoteBackgrounds();

    const maintScreen = document.getElementById("maintenanceScreen");
    const alertBanner = document.getElementById("alertBanner");
    if (!maintScreen || !alertBanner) return;

    if (appConfig.bannerActive && appConfig.bannerBlocking) {
      const t = document.getElementById("maintTitle");
      const m = document.getElementById("maintMessage");
      if (t) t.innerText = appConfig.bannerTitle || "EM MANUTENÃ‡ÃƒO";
      if (m) m.innerText = appConfig.bannerMessage || "Voltamos logo!";
      maintScreen.classList.remove("hidden");
      alertBanner.classList.add("hidden");
      document.body.style.overflow = "hidden";
    } else {
      maintScreen.classList.add("hidden");
      document.body.style.overflow = "auto";
    }

    if (appConfig.bannerActive && !appConfig.bannerBlocking) {
      const t = document.getElementById("alertTitle");
      const m = document.getElementById("alertMessage");
      if (t) t.innerText = appConfig.bannerTitle || "AVISO";
      if (m) m.innerText = appConfig.bannerMessage || "";
      alertBanner.classList.remove("hidden");
    } else {
      alertBanner.classList.add("hidden");
    }

    if (currentUser && !document.getElementById("matchesScreen")?.classList.contains("hidden")) {
  loadMatches({ force: true });
}
if (currentUser && !document.getElementById("rankingScreen")?.classList.contains("hidden") && typeof loadRanking === "function") {
  loadRanking({ force: true });
}
  });
};

        initRemoteConfig();
        // (FIM DO BLOCO)

        // COMPRESSÃƒO
        const compressImage = (file) => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = (event) => {
                    const img = new Image();
                    img.src = event.target.result;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX_WIDTH = 500; const scaleSize = MAX_WIDTH / img.width; canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize;
                        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.7); resolve(dataUrl.split(',')[1]);
                    };
                };
            });
        };
// --- CARROSSEL DE IMAGENS DO CELULAR ---
        // Coloque aqui as URLs das suas imagens (Prints do App)
        const appScreenshots = [
            "print1.jpeg", // Exemplo: Substitua por print_ranking.jpg
            "print2.jpeg",   // Exemplo: Substitua por print_jogos.jpg
            "print3.jpeg"   // Exemplo: Substitua por print_perfil.jpg
        ];
        
        let currentImgIdx = 0;
        const imgEl = document.getElementById('showcaseImg');

        if (imgEl && appScreenshots.length > 0) {
            // Define a primeira imagem
            imgEl.src = appScreenshots[0];

            setInterval(() => {
                // Efeito de Fade Out
                imgEl.style.opacity = 0;
                
                setTimeout(() => {
                    currentImgIdx = (currentImgIdx + 1) % appScreenshots.length;
                    imgEl.src = appScreenshots[currentImgIdx];
                    // Efeito de Fade In
                    imgEl.style.opacity = 1;
                }, 500); // Troca a imagem apÃ³s 0.5s (metade da transiÃ§Ã£o)
                
            }, 4000); // Muda a cada 4 segundos
        }
        // Handlers
        // --- LOGIN OTIMIZADO PARA BIOMETRIA WEB ---
        window.handleLogin = async () => {
            const btn = document.getElementById('btnLoginAction');
            const originalText = btn.innerHTML;
            btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i>`;
            btn.disabled = true;

            const user = document.getElementById('userInput').value.trim().toLowerCase();
            const pass = document.getElementById('passInput').value;
            const remember = document.getElementById('rememberMe').checked;

            if (!user || !pass) {
                alert("Preencha todos os campos.");
                btn.innerHTML = originalText; btn.disabled = false;
                return;
            }

            try {
                // Configura se deve manter logado (Local) ou sÃ³ na sessÃ£o (Session)
                const mode = remember ? browserLocalPersistence : browserSessionPersistence;
                await setPersistence(auth, mode);
                document.getElementById('mainHeader').classList.remove('hidden');

                // Faz o login
                await signInWithEmailAndPassword(auth, `${user}@bolao112.com`, pass);
                
                // O navegador vai perguntar "Salvar Senha?" aqui. 
                // Se o usuÃ¡rio salvar, na prÃ³xima vez o FaceID/Digital aparecerÃ¡ automaticamente ao tocar no campo.
                
            } catch (e) {
                console.error(e);
                alert("Dados incorretos ou erro de conexÃ£o.");
                btn.innerHTML = originalText; 
                btn.disabled = false;
            }
        };

// ===============================
// Password Eye Toggle (reutilizÃ¡vel)
// ===============================
window.attachPasswordEye = (inputId, eyeBtnId) => {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(eyeBtnId);
  if (!input || !btn) return;

  const setIcon = () => {
    const isHidden = input.type === "password";
    btn.innerHTML = isHidden
      ? `<i class="fas fa-eye"></i>`
      : `<i class="fas fa-eye-slash"></i>`;
  };

  setIcon();

  btn.onclick = () => {
    input.type = (input.type === "password") ? "text" : "password";
    setIcon();
    input.focus();
  };
};

// ===============================
// LOGIN: adiciona "olho" no campo de senha (passInput) - SAFE
// ===============================
window.setupLoginPasswordEye = () => {
  const passInput = document.getElementById("passInput");
  if (!passInput) return;

  // se a funÃ§Ã£o ainda nÃ£o existe (ordem do arquivo), tenta de novo daqui a pouco
  if (typeof window.attachPasswordEye !== "function") {
    setTimeout(window.setupLoginPasswordEye, 50);
    return;
  }

  // evita duplicar
  if (document.getElementById("loginEyeBtn")) {
    // garante que o toggle estÃ¡ ligado
    window.attachPasswordEye("passInput", "loginEyeBtn");
    return;
  }

  const parent = passInput.parentElement;
  if (parent) parent.style.position = "relative";

  const eyeBtn = document.createElement("button");
  eyeBtn.type = "button";
  eyeBtn.id = "loginEyeBtn";
  eyeBtn.setAttribute("aria-label", "Mostrar/ocultar senha");
  eyeBtn.style.position = "absolute";
  eyeBtn.style.right = "10px";
  eyeBtn.style.top = "50%";
  eyeBtn.style.transform = "translateY(-50%)";
  eyeBtn.style.background = "transparent";
  eyeBtn.style.border = "none";
  eyeBtn.style.color = "#666";
  eyeBtn.style.fontSize = "16px";
  eyeBtn.style.cursor = "pointer";
  eyeBtn.style.padding = "6px";

  parent.appendChild(eyeBtn);

  window.attachPasswordEye("passInput", "loginEyeBtn");
};

// roda quando o DOM estiver pronto
window.addEventListener("DOMContentLoaded", () => {
  window.setupLoginPasswordEye();
  syncStaticVersionLabels();
  updatePwaInstallCard();

  document.getElementById('btnInstallPwa')?.addEventListener('click', async () => {
    if (!deferredPwaInstallPrompt) return;

    deferredPwaInstallPrompt.prompt();
    await deferredPwaInstallPrompt.userChoice.catch(() => null);
    deferredPwaInstallPrompt = null;
    updatePwaInstallCard();
  });
});



// --- RECUPERAÃ‡ÃƒO DE SENHA (WEB) ---
        document.getElementById('btnForgotPass').onclick = () => {
  const typedUser =
    (document.getElementById('userInput')?.value || "").trim().toLowerCase();

  window.openModal(`
    <div class="bg-white p-6 relative w-full max-w-sm rounded shadow-xl">
      <button onclick="closeModal()" class="absolute top-2 right-2 text-gray-400 p-2">
        <i class="fas fa-times text-xl"></i>
      </button>

      <div class="text-center">
        <i class="fas fa-key text-[#FFD700] text-3xl mb-2"></i>
        <h3 class="text-[#006400] font-black uppercase text-lg mb-1">Esqueci minha senha</h3>
        <p class="text-xs text-gray-600 font-bold mb-4">
          Escolha uma das opÃ§Ãµes abaixo:
        </p>

        <div class="bg-gray-50 border rounded-lg p-3 text-left mb-4">
          <p class="text-[10px] text-gray-500 font-black uppercase">Seu usuÃ¡rio (login)</p>
          <input
            type="text"
            id="recoverUser"
            value="${typedUser}"
            placeholder="Ex: joaosilva"
            class="w-full mt-2 p-3 bg-white border rounded-lg text-sm outline-none focus:border-[#006400] text-center font-bold"
          />
          <p class="text-[10px] text-gray-400 font-bold mt-2">
            Dica: seu usuÃ¡rio Ã© o que vocÃª usa para entrar (sem espaÃ§os).
          </p>
        </div>

        <!-- Resultado da dica -->
        <div id="hintResultArea" class="hidden mb-4 p-3 bg-orange-50 border border-orange-200 rounded">
          <p class="text-[10px] text-orange-600 font-bold uppercase">ðŸ’¡ SUA DICA:</p>
          <p id="hintTextDisplay" class="text-sm font-black text-black mt-1"></p>
        </div>

        <p id="recoverMsg" class="text-xs text-red-500 font-bold mt-2"></p>

        <!-- AÃ§Ãµes -->
        <div class="space-y-2 mt-4">
          <button id="btnSearchHint"
            class="w-full bg-[#006400] text-white py-3 font-black rounded-lg shadow-lg btn-press text-sm">
            VER MINHA DICA DE SENHA
          </button>

          <button id="btnAskAdminReset"
            class="w-full bg-[#25D366] text-white py-3 font-black rounded-lg shadow-lg btn-press text-sm flex items-center justify-center gap-2">
            <i class="fab fa-whatsapp text-lg"></i> AVISAR ADMIN (RESET)
          </button>

          <button onclick="closeModal()"
            class="w-full bg-gray-100 text-gray-700 py-3 font-black rounded-lg shadow btn-press text-sm">
            VOLTAR
          </button>
        </div>

        <p class="text-[10px] text-gray-400 font-bold mt-4">
          Se o admin resetar sua senha, ao entrar novamente vocÃª serÃ¡ obrigado(a) a criar uma nova senha.
        </p>
      </div>
    </div>
  `);

  // 1) BOTÃƒO: buscar dica
  document.getElementById('btnSearchHint').onclick = async () => {
    const user = (document.getElementById('recoverUser').value || "").trim().toLowerCase();
    const msg = document.getElementById('recoverMsg');
    const area = document.getElementById('hintResultArea');

    msg.innerText = "";
    area.classList.add('hidden');

    if (!user) {
      msg.innerText = "Digite seu usuÃ¡rio para buscar a dica.";
      return;
    }

    msg.innerText = "Buscando dica...";

    try {
      const q = query(collection(db, "users"), where("username", "==", user));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const data = snap.docs[0].data();
        const hint = data.passwordHint;

        if (hint) {
          document.getElementById('hintTextDisplay').innerText = hint;
          area.classList.remove('hidden');
          msg.innerText = "";
        } else {
          msg.innerText = "VocÃª nÃ£o cadastrou dica. Use a opÃ§Ã£o de avisar o admin.";
        }
      } else {
        msg.innerText = "UsuÃ¡rio nÃ£o encontrado. Confira se digitou corretamente.";
      }
    } catch (e) {
      console.error(e);
      msg.innerText = "Erro ao buscar a dica. Tente novamente.";
    }
  };

  // 2) BOTÃƒO: avisar admin no WhatsApp (nÃ£o abre automaticamente ao clicar em 'Esqueci')
  document.getElementById('btnAskAdminReset').onclick = () => {
    const user = (document.getElementById('recoverUser').value || "").trim().toLowerCase();
    const when = new Date().toLocaleString('pt-BR');

    const phone = "5585988837389"; // Lincoln - 85988837389
    const msg = user
      ? `OlÃ¡ Lincoln! Preciso que vocÃª resete minha senha no BolÃ£o 112 FC.\n\nUsuÃ¡rio: ${user}\nData/Hora: ${when}\n\n(Enviado pela versÃ£o WEB)`
      : `OlÃ¡ Lincoln! Preciso que vocÃª resete minha senha no BolÃ£o 112 FC.\n\nNÃ£o lembro meu usuÃ¡rio.\nData/Hora: ${when}\n\n(Enviado pela versÃ£o WEB)`;

    const encoded = encodeURIComponent(msg);

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const url = isMobile
      ? `https://wa.me/${phone}?text=${encoded}`
      : `https://web.whatsapp.com/send?phone=${phone}&text=${encoded}`;

    window.open(url, "_blank");
  };
};

      
       document.getElementById('btnOpenRegister').onclick = () => {
            const modal = document.getElementById('modalOverlay'); 
            const cont = document.getElementById('modalContainer'); 
            modal.classList.remove('hidden');
            
            // ADICIONADO CAMPO DE DICA (passwordHint)
            cont.innerHTML = `
            <div class="bg-white p-6 relative">
                <button onclick="closeModal()" class="absolute top-2 right-2 text-gray-400 p-2"><i class="fas fa-times text-xl"></i></button>
                <h3 class="text-[#006400] font-black uppercase text-center mb-6 text-lg">Criar Nova Conta</h3>
                
                <label class="block text-xs font-bold text-gray-500 mb-1">Nome Completo</label>
                <input type="text" id="regName" placeholder="Ex: JoÃ£o da Silva" class="w-full p-3 bg-gray-50 border rounded-lg mb-3 text-sm outline-none focus:border-[#006400]">
                
                <label class="block text-xs font-bold text-gray-500 mb-1">UsuÃ¡rio (Login)</label>
                <input type="text" id="regUser" placeholder="Ex: joaosilva (sem espaÃ§os)" class="w-full p-3 bg-gray-50 border rounded-lg mb-3 text-sm outline-none focus:border-[#006400]">
                
                <label class="block text-xs font-bold text-gray-500 mb-1">Dica de Senha (Opcional)</label>
                <input type="text" id="regHint" placeholder="Ex: Nome do meu cachorro" class="w-full p-3 bg-gray-50 border rounded-lg mb-3 text-sm outline-none focus:border-[#006400]">
                
                <label class="block text-xs font-bold text-gray-500 mb-1">Senha</label>
                <input type="password" id="regPass" placeholder="MÃ­nimo 6 caracteres" class="w-full p-3 bg-gray-50 border rounded-lg mb-6 text-sm outline-none focus:border-[#006400]">
                
                <button id="btnDoRegister" class="w-full bg-[#006400] text-white py-3 font-bold rounded-lg shadow-lg btn-press">CADASTRAR</button>
            </div>`;
            
            document.getElementById('btnDoRegister').onclick = async () => {
            const name = document.getElementById('regName').value.trim();
            const user = document.getElementById('regUser').value.trim().toLowerCase();
            const pass = document.getElementById('regPass').value;
            const hint = document.getElementById('regHint').value.trim();

            if (!name || !user || pass.length < 6) {
                alert("Preencha todos os dados corretamente (Senha min. 6 caracteres).");
                return;
            }
            if (user.includes(" ")) {
                alert("O usuÃ¡rio nÃ£o pode conter espaÃ§os.");
                return;
            }

            const btn = document.getElementById('btnDoRegister');
            const originalText = btn.innerText;
            btn.innerText = "VERIFICANDO...";
            btn.disabled = true;

            try {
                // 1. Verifica se existe o convite na Whitelist
                const whitelistRef = doc(db, "whitelist", user);
                const whitelistSnap = await getDoc(whitelistRef);
                
                let finalName = name;
                let isTrial = false;
                let trialDate = null;

                // SE NÃƒO TIVER CONVITE: OFERECE O TESTE GRÃTIS
                if (!whitelistSnap.exists()) {
                    const aceitaTeste = confirm("Convite oficial nÃ£o encontrado.\n\nDeseja criar uma conta de TESTE GRÃTIS por 7 dias?");
                    
                    if (!aceitaTeste) {
                        btn.innerText = originalText;
                        btn.disabled = false;
                        return; // UsuÃ¡rio desistiu
                    }

                    // Configura modo Trial
                    isTrial = true;
                    finalName = `${name} (Teste â³)`; // Adiciona identificaÃ§Ã£o no nome
                    
                    // Calcula data de expiraÃ§Ã£o (Hoje + 7 dias)
                    const d = new Date();
                    d.setDate(d.getDate() + 7);
                    trialDate = d;
                }

                // 2. Cria a conta no Firebase Auth
                btn.innerText = "CRIANDO...";
                const res = await createUserWithEmailAndPassword(auth, `${user}@bolao112.com`, pass);

                // 3. Salva os dados do perfil com as flags de teste
                await setDoc(doc(db, "users", res.user.uid), {
                    name: finalName,
                    username: user,
                    createdAt: new Date(),
                    isAdmin: false,
                    debts: 0,
                    payments: {},
                    appVersion: getAppVersionLabel(),
                    passwordHint: hint,
                    // NOVOS CAMPOS PARA CONTROLE:
                    isTrial: isTrial, 
                    trialValidUntil: trialDate 
                });

                if (isTrial) {
                    alert(`Conta de Teste Criada!\n\nVocÃª tem acesso liberado atÃ© ${trialDate.toLocaleDateString()}.\nPara continuar depois disso, regularize sua mensalidade.`);
                } else {
                    alert("Conta oficial criada com sucesso! Bem-vindo(a).");
                }
                
                closeModal();

            } catch (e) {
                console.error(e);
                let msg = "Erro ao criar conta.";
                if (e.code === 'auth/email-already-in-use') msg = "Este usuÃ¡rio jÃ¡ existe.";
                alert(msg);
                btn.innerText = originalText;
                btn.disabled = false;
            }
        };
         };  

// ===============================
// CENTRAL: decide gates pÃ³s-login (Force PW -> Rules Gate -> App)
// ===============================
window.continueAfterLoginGates = async () => {
  if (!auth.currentUser) return;

  const user = auth.currentUser;
  const userDocRef = doc(db, "users", user.uid);

  let userSnap = null;
  try {
    userSnap = await getDoc(userDocRef);
  } catch (e) {
    console.error("continueAfterLoginGates getDoc:", e);
    // fallback seguro: mostra app mÃ­nimo mas sem liberar navegaÃ§Ã£o
    document.getElementById('mainHeader').classList.remove('hidden');
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainScreens').classList.remove('hidden');
    document.getElementById('bottomNav').classList.add('hidden');
    document.getElementById('btnLogout').classList.remove('hidden');
    alert("Erro ao carregar seus dados. Verifique sua conexÃ£o.");
    return;
  }

  const userData = userSnap.exists() ? userSnap.data() : null;

  if (userData && userData.isActive === false) {
    alert("Seu acesso foi desativado. Fale com o administrador.");
    try { await signOut(auth); } catch(e) {}
    return;
  }

  // 1) FORCE PASSWORD CHANGE (prioridade mÃ¡xima)
  if (userData && userData.forcePasswordChange === true) {
    // Estrutura mÃ­nima (sem liberar menu)
    document.getElementById('mainHeader').classList.remove('hidden');
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainScreens').classList.remove('hidden');
    document.getElementById('bottomNav').classList.add('hidden');
    document.getElementById('btnLogout').classList.remove('hidden');

    // abre modal bloqueante
    window.openForcePasswordModal(user);
    return;
  }

  // 2) RULES GATE
  const mustAccept = await evaluateRulesGate(user.uid, userData);
  if (mustAccept) {
    document.getElementById('mainHeader').classList.remove('hidden');
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainScreens').classList.remove('hidden');
    document.getElementById('bottomNav').classList.add('hidden'); // trava menu
    document.getElementById('btnLogout').classList.remove('hidden');

    showTab('rules');
    if (typeof renderRules === 'function') renderRules();

    setTimeout(() => openRulesGateModal(), 0);
    return;
  }

  // 3) LIBERA APP
  finalizeAppEntryAfterLogin();
};


        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // --- TRAVA DE SEGURANÃ‡A E TRIAL (NOVO) ---
                const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

                if (userSnap.exists()) {
                    const data = userSnap.data();
                    applyLiveCurrentUserData(data);
                    currentUser = user;
                    window.currentUser = user;
                    window.currentUid = user.uid;

                    if (data.isActive === false) {
                        alert("Seu acesso foi desativado. Fale com o administrador.");
                        signOut(auth);
                        return;
                    }
                    
                    // Verifica se Ã© TRIAL VENCIDO
                    if (data.isTrial === true && data.trialValidUntil) {
                        const now = new Date();
                        const validUntil = data.trialValidUntil.toDate(); // Converte do Firestore

                        // Se HOJE Ã© maior que a validade
                        if (now > validUntil) {
                            // Verifica se pagou o mÃªs atual (SalvaÃ§Ã£o)
                            const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                            const currentMonth = months[now.getMonth()];
                            const isPaid = data.payments && data.payments[currentMonth] === true;

                            if (!isPaid) {
                                alert(`ðŸš« PERÃODO DE TESTE EXPIRADO!\n\nSua conta de teste venceu em ${validUntil.toLocaleDateString()}.\n\nPara continuar jogando e recuperar seu acesso, realize o pagamento da mensalidade com o Admin.`);
                                signOut(auth); // Chuta o usuÃ¡rio para fora
                                return;
                            } else {
                                // Se pagou, remove o status de Trial automaticamente (PromoÃ§Ã£o para Oficial)
                                await updateDoc(userDocRef, { isTrial: false, name: data.name.replace(" (Teste â³)", "") });
                                alert("ParabÃ©ns! Sua mensalidade foi confirmada e sua conta agora Ã© OFICIAL! ðŸš€");
                                location.reload(); // Recarrega para limpar o nome
                                return;
                            }
                        }
                    }

                    // ATUALIZANDO VERSÃƒO
try { await updateDoc(userDocRef, { appVersion: getAppVersionLabel(), lastAccess: new Date() }); } catch(e) {}

// âœ… NOVO: inicia o gate de troca de senha obrigatÃ³ria (Android parity)
window.startForcePasswordWatcher(user);
setupForegroundPushListener();
startCurrentUserDataWatcher(user);
                }
                // ------------------------------------------

                // define currentUser/uid (global e window)
currentUser = user;
window.currentUser = user;
window.currentUid = user.uid;

// userData (do seu userSnap que vocÃª jÃ¡ buscou lÃ¡ em cima)
const userData = userSnap.exists() ? userSnap.data() : null;

// âœ… Entra pelo funil Ãºnico (Force PW -> Rules Gate -> App)
setupForegroundPushListener();
window.continueAfterLoginGates();

            } else {
                window.currentUser = null;
window.currentUid = null;
currentUser = null;
if (window.__currentUserLiveDataUnsub) {
  try { window.__currentUserLiveDataUnsub(); } catch (e) {}
  window.__currentUserLiveDataUnsub = null;
}
window.__currentUserLiveData = null;
setHomeMode(true);

if (__appStateUnsub) {
  try { __appStateUnsub(); } catch (e) {}
  __appStateUnsub = null;
}

document.getElementById('mainHeader').classList.add('hidden');
document.getElementById('loginScreen').classList.remove('hidden');
document.getElementById('mainScreens').classList.add('hidden');
document.getElementById('bottomNav').classList.add('hidden');

            }
        });
// finaliza a entrada no app (chamar sÃ³ quando estiver liberado)
window.finalizeAppEntryAfterLogin = () => {
  setHomeMode(false);
  document.getElementById('mainHeader').classList.remove('hidden');
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('mainScreens').classList.remove('hidden');
  document.getElementById('bottomNav').classList.remove('hidden');
  document.getElementById('btnLogout').classList.remove('hidden');

  startWebAdminSync();
  applyRemoteBackgrounds();
  setupForegroundPushListener();

  showTab('matches');
  calculatePot();
};


        window.showTab = (tab) => {
  const appContent = document.getElementById('appContent');
  if (appContent) {
    const contentBottomPaddingClass = tab === 'ranking' ? 'pb-16' : 'pb-32';
    appContent.className = `flex-1 overflow-y-auto bg-main ${contentBottomPaddingClass} tab-${tab}`;
    appContent.scrollTop = 0;
  }

  // Pega as tabs que EXISTEM no HTML (evita null)
  const tabs = ['matches', 'ranking', 'rules', 'profile']
  .filter(t => document.getElementById(`${t}Screen`) && document.getElementById(`nav-${t}`));


  // Esconde todas e â€œdesativaâ€ no menu
  tabs.forEach(t => {
    document.getElementById(`${t}Screen`).classList.add('hidden');
    const navBtn = document.getElementById(`nav-${t}`);
    navBtn.classList.remove('text-[#006400]');
    navBtn.classList.add('text-gray-400');
  });

  // Mostra a tab pedida (se existir)
  const screen = document.getElementById(`${tab}Screen`);
  const nav = document.getElementById(`nav-${tab}`);
  if (!screen || !nav) {
    console.warn('[showTab] Tab inexistente no HTML:', tab);
    return;
  }

  screen.classList.remove('hidden');
  nav.classList.remove('text-gray-400');
  nav.classList.add('text-[#006400]');

  // Chamadas de carregamento por aba (sÃ³ se existirem)
  if (tab === 'matches' && typeof loadMatches === 'function') loadMatches();
if (tab === 'ranking' && typeof loadRanking === 'function') loadRanking();
if (tab === 'rules' && typeof renderRules === 'function') renderRules();
if (tab === 'profile' && typeof loadProfile === 'function') loadProfile();

if (tab === 'ranking') {
  const rankingListContent = document.getElementById('rankingListContent');
  if (rankingListContent) rankingListContent.scrollTop = 0;
}

};
      

        // --- NOVA LÃ“GICA DE REGRAS (COM CABEÃ‡ALHO E DATA) ---
        
        // Cache guarda objeto completo agora: { items: [], dateDisplay: "...", version: "...", updatedAt: Date|null, officialStartAt: Date|null }
let cachedRulesData = null;

async function renderRules(forceRefresh = false) {
  const list = document.getElementById('rulesList');

  // Se jÃ¡ tem conteÃºdo renderizado visualmente, nÃ£o faz nada (exceto se pedir refresh)
  if (!forceRefresh && list && list.children.length > 0) return;

  // Mostra Loading
  if (list) {
    list.innerHTML = `<div class="text-center p-6"><i class="fas fa-circle-notch fa-spin text-[#006400] text-2xl"></i><p class="text-xs text-gray-500 mt-2">Buscando atualizaÃ§Ãµes...</p></div>`;
  }

  try {
    // Se nÃ£o temos cache ou pedimos refresh, buscamos no Firebase
    if (!cachedRulesData || forceRefresh) {
      const docRef = doc(db, "settings", "rules");
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const d = snap.data();

        // Formata a data de atualizaÃ§Ã£o
        let dateStr = "Data desconhecida";
        let updatedAtDate = null;
        if (d.updatedAt) {
          updatedAtDate = d.updatedAt.toDate();
          dateStr = updatedAtDate.toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          });
        }

        cachedRulesData = {
          items: d.items || [],
          dateDisplay: dateStr,
          version: (d.version || "").toString(),
          updatedAt: updatedAtDate,
          officialStartAt: d.officialStartAt?.toDate ? d.officialStartAt.toDate() : null,
        };
      } else {
        cachedRulesData = {
          items: [],
          dateDisplay: "--/--/----",
          version: "",
          updatedAt: null,
          officialStartAt: null
        };
      }
    }

    // Se a lista estiver vazia
    if (!cachedRulesData.items || cachedRulesData.items.length === 0) {
      if (list) {
        list.innerHTML = `<div class="text-center p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-xs">O regulamento estÃ¡ sendo atualizado pelo Administrador.</div>`;
      }
      return;
    }

    // 1. Gera o HTML do CabeÃ§alho
    const headerHtml = `
      <div class="flex flex-col items-center justify-center mb-6 pt-2">
        <div class="bg-[#006400] text-white px-4 py-1 rounded-full shadow-md border-2 border-[#FFD700] mb-2">
          <h3 class="font-black text-xs uppercase tracking-widest">
            <i class="fas fa-balance-scale mr-2"></i>REGULAMENTO OFICIAL
          </h3>
        </div>

        <div class="flex flex-col items-center gap-1">
          <p class="text-[10px] text-gray-500 font-bold bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
            <i class="fas fa-sync-alt text-[#006400] mr-1"></i>
            Atualizado em: <span class="text-black">${cachedRulesData.dateDisplay}</span>
          </p>

          ${
            cachedRulesData.version
              ? `<p class="text-[10px] text-gray-500 font-bold bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                   <i class="fas fa-hashtag text-[#006400] mr-1"></i>
                   VersÃ£o: <span class="text-black">${cachedRulesData.version}</span>
                 </p>`
              : ``
          }
        </div>
      </div>
    `;

    // 2. Gera a Lista de Regras
    const itemsHtml = cachedRulesData.items.map(r => `
      <div class="bg-white rounded p-3 shadow-sm border border-gray-100 mb-2">
        <button class="w-full text-left font-black text-xs text-[#006400] uppercase tracking-wide flex justify-between items-center py-1"
                onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('i').classList.toggle('fa-chevron-up'); this.querySelector('i').classList.toggle('fa-chevron-down');">
          ${r.title || r.t}
          <i class="fas fa-chevron-down text-gray-400 transition-transform"></i>
        </button>
        <div class="hidden mt-2 text-xs text-gray-700 border-t pt-3 whitespace-pre-line leading-relaxed font-medium">
          ${r.content || r.c}
        </div>
      </div>
    `).join('');

    // 3. Junta tudo
    if (list) list.innerHTML = headerHtml + itemsHtml;

  } catch (e) {
    console.error("Erro ao buscar regras:", e);
    if (list) {
      list.innerHTML = `<div class="text-center text-red-500 text-xs p-4">Erro ao carregar o regulamento.<br>Verifique sua conexÃ£o.</div>`;
    }
  }
}


        const SectionHeader = (title, color) => `<div class="card-container mb-3"><div class="bg-white/90 border border-[${color}] rounded-tl-2xl rounded-br-2xl p-2 text-center shadow-sm"><h4 class="font-bold text-[${color}] uppercase tracking-wider text-xs" style="color: ${color};">${title}</h4></div></div>`;

// --- FUNÃ‡ÃƒO SINO INTELIGENTE (LISTA ONDE TEM MENSAGEM) ---
          // --- FUNÃ‡ÃƒO SINO: SEM ALERT E COM LAYOUT CORRIGIDO ---
        // --- FUNÃ‡ÃƒO SINO: SEM ALERT E COM LAYOUT CORRIGIDO ---
        window.updateBadges = () => {
            const unreadGames = [];
            let totalUnread = 0;

            if (Array.isArray(window.cachedMatches)) {
                window.cachedMatches.forEach((m) => {
                    const sCount = globalServerCounts[m.id] || 0;
                    const lCount = parseInt(localStorage.getItem(`read_count_${m.id}`) || "0", 10);
                    const unreadCount = Math.max(0, sCount - lCount);

                    if (unreadCount > 0) {
                        totalUnread += unreadCount;
                        unreadGames.push({
                            id: m.id,
                            title: `${m.teamA} x ${m.teamB}`,
                            teamA: m.teamA,
                            teamB: m.teamB,
                            winner: m.winner || "",
                            unreadCount
                        });
                    }
                });
            }

            unreadGames.sort((a, b) => b.unreadCount - a.unreadCount);

            const btnBell = document.getElementById("btnBell");
            if (!btnBell) return;

            const old = btnBell.querySelector(".bell-badge");
            if (old) old.remove();
            
            // Clona para limpar eventos antigos
            const newBell = btnBell.cloneNode(true); 
            btnBell.parentNode?.replaceChild(newBell, btnBell);

            if (totalUnread > 0) {
                newBell.innerHTML += `<div class="bell-badge">${totalUnread > 9 ? '+9' : totalUnread}</div>`;
                newBell.classList.add("text-red-400");
                
                newBell.onclick = () => {
                    const modal = document.getElementById("modalOverlay");
                    const cont = document.getElementById("modalContainer");
                    if (!modal || !cont) return;

                    const listHtml = unreadGames.map((game, idx) => `
                        <button
                          type="button"
                          data-unread-index="${idx}"
                          class="js-unread-game w-full p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-green-50 transition-colors btn-press text-left"
                        >
                            <span class="text-xs font-bold text-gray-700">ðŸ’¬ âš½ ${escapeHtml(game.title)}</span>
                            <span class="text-[9px] text-green-700 font-black uppercase tracking-wider bg-green-100 px-2 py-1 rounded">${game.unreadCount > 9 ? "+9" : game.unreadCount}</span>
                        </button>
                    `).join("");

                    modal.classList.remove("hidden");
                    cont.innerHTML = `
                    <div class="w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden">
                        <div class="bg-[#006400] p-3 text-center">
                            <h3 class="font-black text-[#FFD700] text-sm uppercase tracking-widest">
                                <i class="fas fa-comment-dots mr-1"></i> RESENHA ATIVA
                            </h3>
                        </div>
                        <div class="p-4">
                            <p class="text-[10px] text-gray-500 font-bold mb-2 uppercase text-center">Toque para responder:</p>
                            <div class="max-h-60 overflow-y-auto border border-gray-200 rounded-lg mb-4 shadow-inner bg-gray-100">
                                ${listHtml}
                            </div>
                            <button onclick="window.closeModal()" class="w-full bg-gray-800 text-white py-2 rounded font-bold text-xs shadow-md btn-press">
                                FECHAR LISTA
                            </button>
                        </div>
                    </div>`;

                    cont.querySelectorAll(".js-unread-game").forEach((btn) => {
                        btn.addEventListener("click", () => {
                            const index = Number(btn.getAttribute("data-unread-index"));
                            const targetGame = unreadGames[index];
                            if (!targetGame) return;

                            window.openMatchComments(
                                targetGame.id,
                                targetGame.teamA,
                                targetGame.teamB,
                                targetGame.winner || ""
                            );
                        });
                    });
                };
            } else {
                newBell.classList.remove("text-red-400");
                newBell.onclick = () => alert("Nenhuma nova mensagem.");
            }
        };
// --- CORREÃ‡ÃƒO DE IMAGENS DO GOOGLE DRIVE ---
        const fixDriveUrl = (url) => {
            if (!url) return "";
            if (url.includes("drive.google.com") && url.includes("id=")) {
                const match = url.match(/id=([a-zA-Z0-9_-]+)/);
                if (match && match[1]) {
                    // Usa o domÃ­nio lh3 que Ã© mais permissivo para imagens
                    return `https://lh3.googleusercontent.com/d/${match[1]}`;
                }
            }
            return url;
        };
     // 2. Renderiza Banner (CorreÃ§Ã£o de Link e Tamanho)
        const renderBanner = (bannerData) => {
            if (!bannerData || !bannerData.active) return '';
            
            const fixLink = (u) => {
                if (!u || u === "#") return "#";
                if (!u.startsWith("http://") && !u.startsWith("https://")) return "https://" + u;
                return u;
            };

            const type = bannerData.type || "full";
            const img1 = fixDriveUrl(bannerData.imageUrl);
            const link1 = fixLink(bannerData.targetUrl);

            if (type === "double") {
                const img2 = fixDriveUrl(bannerData.imageUrl2);
                const link2 = fixLink(bannerData.targetUrl2);
                return `
                <div class="card-container mb-4 animate-fade-in grid grid-cols-2 gap-2">
                    <a href="${link1}" target="_blank" class="block rounded-xl overflow-hidden shadow-md border border-gray-200 relative group aspect-[4/3]">
                        <img src="${img1}" referrerpolicy="no-referrer" loading="lazy" decoding="async" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
                    </a>
                    ${img2 ? `<a href="${link2}" target="_blank" class="block rounded-xl overflow-hidden shadow-md border border-gray-200 relative group aspect-[4/3]"><img src="${img2}" referrerpolicy="no-referrer" loading="lazy" decoding="async" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"></a>` : ''}
                </div>`;
            }

            if (type === "small") {
                 return `
                <div class="card-container mb-4 animate-fade-in">
                    <a href="${link1}" target="_blank" class="block rounded-lg overflow-hidden shadow-sm border border-gray-200 relative group aspect-[6/1]">
                        <img src="${img1}" referrerpolicy="no-referrer" loading="lazy" decoding="async" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
                    </a>
                </div>`;
            }

            return `
            <div class="card-container mb-4 animate-fade-in">
                <a href="${link1}" target="_blank" class="block rounded-xl overflow-hidden shadow-lg border border-gray-200 relative group aspect-[2.7/1]">
                    <img src="${img1}" referrerpolicy="no-referrer" loading="lazy" decoding="async" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onerror="this.style.display='none'">
                    ${bannerData.name ? `<div class="absolute bottom-0 right-0 bg-black/60 text-white text-[8px] px-2 py-1 font-bold rounded-tl-lg">${escapeHtml(bannerData.name)}</div>` : ''}
                </a>
            </div>`;
        };

        // 3. Renderiza Enquete (CorreÃ§Ã£o de Clique)
        const renderPoll = (poll) => {
  if (!poll || !poll.active) return "";

  const votes = (poll.votes && typeof poll.votes === "object") ? poll.votes : {};
  const userVotes = (poll.userVotes && typeof poll.userVotes === "object") ? poll.userVotes : {};
  const myVote = currentUser ? userVotes[currentUser.uid] : null;
  const totalVotes = Object.values(votes).reduce((sum, value) => sum + (Number(value) || 0), 0);

  let isExpired = false;
  if (poll.deadline) {
    const deadlineDate = toJsDate(poll.deadline);
    if (deadlineDate) isExpired = new Date() > deadlineDate;
  }

  let optionsHtml = "";

  (poll.options || []).forEach((opt, idx) => {
    const count = Number(votes[idx] ?? votes[String(idx)] ?? 0);
    const pct = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
    const isSelected = myVote === idx;

    const textColor = isSelected ? "text-[#006400]" : "text-gray-700";
    const border = isSelected ? "border-[#FFD700] border-2" : "border-gray-200 border";
    const clickAction = isExpired ? "" : `onclick="window.votePoll('${poll.id}', ${idx})"`;

    optionsHtml += `
      <button ${clickAction} class="w-full text-left px-4 py-3 rounded-2xl ${border} bg-white mb-2">
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm font-black ${textColor}">${escapeHtml(opt)}</span>
          <span class="text-xs font-black ${textColor}">${pct}%</span>
        </div>
        <div class="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div class="h-full ${isSelected ? "bg-[#006400]" : "bg-gray-300"}" style="width:${pct}%"></div>
        </div>
      </button>
    `;
  });

  return `
    <div class="bg-white rounded-[26px] border-[3px] border-[#006400] shadow-lg p-4 mb-3">
      <div class="flex items-center justify-between gap-3 mb-3">
        <h3 class="text-base font-black text-[#006400]">${escapeHtml(poll.question)}</h3>
        ${isExpired ? `<span class="text-[10px] font-black text-red-600">ENCERRADA</span>` : ``}
      </div>

      ${optionsHtml}

      <div class="text-[11px] font-bold text-gray-500 mt-2">
        ${totalVotes} votos â€¢ ${isExpired ? "Finalizada" : "Toque na opÃ§Ã£o para votar"}
      </div>
    </div>
  `;
};

window.votePoll = async (pid, idx) => {
  if (!currentUser) {
    alert("FaÃ§a login para votar.");
    return;
  }

  try {
    const ref = doc(db, "polls", pid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      alert("Enquete nÃ£o encontrada.");
      return;
    }

    const data = snap.data() || {};
    const prev = data.userVotes?.[currentUser.uid];

    if (Number(prev) === idx) return;

    const payload = {
      [`votes.${idx}`]: increment(1),
      [`userVotes.${currentUser.uid}`]: idx
    };

    if (prev !== undefined && prev !== null) {
      payload[`votes.${prev}`] = increment(-1);
    }

    await updateDoc(ref, payload);
    invalidateHomeRankingCaches();
    loadMatches({ force: true });
  } catch (e) {
    console.error("Erro enquete:", e);
    alert("Erro ao salvar voto.");
  }
};

        // --- FUNÃ‡ÃƒO DE NOTÃCIAS (COM LINHA DO TEMPO) ---
       const generateNewsFeed = (newsSnap, guessesData, finishedMatches, users, expiredMatches = []) => {
            let segments = [];
            const addSegment = (text, color) => segments.push(`<span style="color: ${color}; font-weight: 900; margin: 0 10px;">${text}</span>`);
            
            // --- 1. ENGINE (LÃ³gica Android: Timeline + Zebra Ajustada) ---
            let rankingSnapshot = [];

            if (users.length > 0) {
                // Prepara usuÃ¡rios com data (Verifica se Ã© Timestamp ou Date)
                const usersWithDate = users.map(u => {
                    let cDate = new Date(0);
                    if (u.createdAt) {
                        // Se tiver .toDate Ã© Firebase, senÃ£o jÃ¡ Ã© Data normal
                        cDate = (typeof u.createdAt.toDate === 'function') ? u.createdAt.toDate() : u.createdAt;
                    }
                    return { ...u, createdDate: cDate };
                });

                // Zebra: Calcula com base apenas nos usuÃ¡rios VÃLIDOS na data
                const zebraMatchIds = [];
                finishedMatches.forEach(m => {
                    const validUsersCount = usersWithDate.filter(u => u.createdDate < m.deadlineDate).length;
                    const hits = guessesData.filter(g => g.matchId === m.id && g.teamSelected === m.winner).length;
                    
                    // LÃ³gica <= 0.20
                    if (validUsersCount > 0 && (hits / validUsersCount) <= 0.20) {
                        zebraMatchIds.push(m.id);
                    }
                });

                rankingSnapshot = usersWithDate.map(u => {
                    if(!u.id) return null;
                    let pts = 0, victories = 0, finalsWon = 0, simStreak = 0;
                    const userMedals = [];
                    const userGuesses = guessesData.filter(g => g.userId === u.id);
                    const matchesChronological = [...finishedMatches].sort((a,b) => (a.deadlineDate || 0) - (b.deadlineDate || 0));

                    matchesChronological.forEach(m => {
                        // FILTRO LINHA DO TEMPO: Ignora se jogo foi antes do usuÃ¡rio nascer
                        if (u.createdDate > m.deadlineDate) return;

                        const g = userGuesses.find(x => x.matchId === m.id);
                        const isHit = g && g.teamSelected === m.winner;

                        if (isHit) {
                            pts += (m.round && m.round.toLowerCase() === 'final') ? 6 : 3;
                            victories++; simStreak++;
                            if (m.round && m.round.toLowerCase() === 'final') finalsWon++;
                            if (simStreak === 3) userMedals.push("ðŸ”¥");
                            if (simStreak === 5) userMedals.push("ðŸŽ¯");
                            if (simStreak === 10) userMedals.push("ðŸ‘½");
                            if (zebraMatchIds.includes(m.id)) userMedals.push("ðŸ¦“");
                        } else { simStreak = 0; }
                    });

                    // Diamante (Oitavas)
                    const oitavas = matchesChronological.filter(m => m.round === "Oitavas de final");
                    const byComp = {}; oitavas.forEach(m => { if(!byComp[m.competition]) byComp[m.competition]=[]; byComp[m.competition].push(m); });
                    for(const k in byComp) {
                        if(byComp[k].length === 8) {
                            const hits = byComp[k].filter(m => userGuesses.find(g=>g.matchId===m.id && g.teamSelected===m.winner)).length;
                            if(hits === 8) { pts += 3; userMedals.push("ðŸ’Ž"); }
                        }
                    }
// --- MEDALHA FANTASMA ðŸ‘» (LÃ³gica de SequÃªncia Inversa com ID) ---
                let ghostStreak = 0;
                // Pega jogos expirados onde o usuÃ¡rio JÃ EXISTIA
                // Ordena: Data Decrescente (Mais novo 1Âº) -> Desempate: ID Decrescente (Z->A)
                // Isso garante que a verificaÃ§Ã£o siga a ordem exata de processamento reverso
                const validExpiredDesc = expiredMatches
                    .filter(m => u.createdDate < m.deadlineDate)
                    .sort((a,b) => matchComparator(b, a)); // Inverso

                for (const m of validExpiredDesc) {
                    const hasVote = userGuesses.some(g => g.matchId === m.id);
                    if (!hasVote) {
                        ghostStreak++;
                    } else {
                        break; // Votou neste, quebra a sequÃªncia imediatamente
                    }
                }
                
                if (ghostStreak >= 3) {
                // CORREÃ‡ÃƒO: Usa addSegment para aparecer no letreiro
                addSegment(`ðŸ‘» ${u.name.toUpperCase()} VIROU FANTASMA! NÃƒO VOTA HÃ ${ghostStreak} JOGOS!`, "#9E9E9E");
            }

                // --- MEDALHA MÃƒO DE ALFACE ðŸ¥¬ (Mesma LÃ³gica Inversa) ---
                let lettuceStreak = 0;
                const validFinishedDesc = finishedMatches
                    .filter(m => u.createdDate < m.deadlineDate)
                    .sort((a,b) => matchComparator(b, a)); // Inverso

                for (const m of validFinishedDesc) {
                    const g = userGuesses.find(x => x.matchId === m.id);
                    if (g) {
                        if (g.teamSelected !== m.winner) {
                            lettuceStreak++; 
                        } else {
                            break; 
                        }
                    } else {
                        break; // AusÃªncia conta como fantasma, interrompe alface
                    }
                }
                
                if (lettuceStreak >= 3) {
                // CORREÃ‡ÃƒO:
                addSegment(`ðŸ¥¬ ${u.name.toUpperCase()} TÃ COM MÃƒO DE ALFACE! ERROU ${lettuceStreak} SEGUIDOS!`, "#EF5350");
            }
                    if (finalsWon > 0) userMedals.push("ðŸ”®");
                    if (victories >= 50) { const qtd = Math.floor(victories / 50); for(let i=0; i<qtd; i++) userMedals.push("ðŸŽ“"); }

                    const debts = u.debts || 0;
                    pts -= (debts * 3);

                    return {
                        uid: u.id,
                        name: (u.name || u.username || "SemNome").split(" ")[0].toUpperCase(),
                        pts, debts, victories, userMedals,
                        createdDate: u.createdDate // Passa adiante para o filtro de Dorminhoco
                    };
                }).filter(u => u !== null);

                // OrdenaÃ§Ã£o (Mantida)
                rankingSnapshot.sort((a, b) => {
                    if (b.pts !== a.pts) return b.pts - a.pts;
                    if (a.debts !== b.debts) return a.debts - b.debts;
                    const c = (user, i) => user.userMedals.filter(m => m === i).length;
                    let diff;
                    diff = c(b,"ðŸ‘½")-c(a,"ðŸ‘½"); if(diff) return diff;
                    diff = c(b,"ðŸ’Ž")-c(a,"ðŸ’Ž"); if(diff) return diff;
                    diff = c(b,"ðŸ‘‘")-c(a,"ðŸ‘‘"); if(diff) return diff;
                    diff = c(b,"ðŸŽ¯")-c(a,"ðŸŽ¯"); if(diff) return diff;
                    diff = c(b,"ðŸ¦“")-c(a,"ðŸ¦“"); if(diff) return diff;
                    diff = c(b,"ðŸ”¥")-c(a,"ðŸ”¥"); if(diff) return diff;
                    diff = c(b,"ðŸ”®")-c(a,"ðŸ”®"); if(diff) return diff;
                    diff = c(b,"ðŸŽ“")-c(a,"ðŸŽ“"); if(diff) return diff;
                    return 0;
                });
            }

            // --- 2. GERAÃ‡ÃƒO DE FRASES ---
            if (finishedMatches.length > 0 && rankingSnapshot.length > 0) {
                const lider = rankingSnapshot[0];
                const lanterna = rankingSnapshot[rankingSnapshot.length - 1];

                addSegment(`ðŸ‘‘ SEGUE O LÃDER! O ${lider.name} TÃ TRANQUILO COM SEUS ${lider.pts} PTS!`, "#FFD700");
                if (rankingSnapshot.length >= 2) addSegment(`ðŸ¥ˆ O ${rankingSnapshot[1].name} TÃ NA COLA DO LÃDER!`, "#C0C0C0");
                if (rankingSnapshot.length >= 3) addSegment(`ðŸ¥‰ ${rankingSnapshot[2].name} FECHA O PÃ“DIO!`, "#CD7F32");
                if (rankingSnapshot.length >= 4) addSegment(`ðŸ‘€ OLHO NO ${rankingSnapshot[3].name}! TÃ CHEGANDO!`, "#4FC3F7");
                
                if (rankingSnapshot.length >= 6) { 
                    const idxPorteiro = rankingSnapshot.length - 5; 
                    if(idxPorteiro >= 0) addSegment(`âš“ CUIDADO ${rankingSnapshot[idxPorteiro].name}! O Z-4 TÃ TE PUXANDO!`, "#FF6D00");
                }
                if (rankingSnapshot.length > 1) addSegment(`ðŸ”¦ ALÃ” ${lanterna.name}! CANSOU DE SEGURAR A LANTERNA NÃƒO?`, "#FF5252");

                const recent10 = [...finishedMatches].sort((a,b) => (b.deadlineDate||0)-(a.deadlineDate||0)).slice(0, 10);
                
                // Loops de Streaks e Dorminhoco
                rankingSnapshot.forEach(u => {
                    // Re-calcula streak recente
                    let streak = 0; let isNegative = false;
                    for (const m of recent10) {
                        if (u.createdDate > m.deadlineDate) continue; // Pula jogo antigo

                        const g = guessesData.find(x => x.userId === u.uid && x.matchId === m.id);
                        if (g && g.teamSelected === m.winner) { 
                            if (isNegative) break; streak++; 
                        } else { 
                            if (streak > 0 && !isNegative) break; isNegative = true; streak++; 
                        }
                    }
                    if (!isNegative) {
                        if (streak >= 10) addSegment(`ðŸ‘½ ${u.name} Ã‰ DE OUTRO MUNDO (${streak} ACERTOS)!`, "#64DD17");
                        else if (streak >= 5) addSegment(`ðŸŽ¯ ${u.name} VIROU MITO! (${streak} ACERTOS)`, "#FFD700");
                        else if (streak >= 3) addSegment(`ðŸ”¥ ${u.name} TÃ ON FIRE! (${streak} ACERTOS)`, "#00E676");
                    } else if (streak >= 3) addSegment(`ðŸ¥¬ ${u.name} TÃ COM MÃƒO DE ALFACE! (${streak} ERROS)`, "#FF5252");

                    // Dorminhoco (Ignora se o usuÃ¡rio Ã© mais novo que o Ãºltimo jogo)
                    if (recent10.length > 0) {
                        const lastM = recent10[0];
                        if (u.createdDate < lastM.deadlineDate) {
                            const voted = guessesData.some(x => x.userId === u.uid && x.matchId === lastM.id);
                            if (!voted) addSegment(`ðŸ’¤ O BURRÃƒO DO ${u.name} NÃƒO VOTOU NO ÃšLTIMO CONFRONTO!`, "#9E9E9E");
                        }
                    }
                });
            }

            if (newsSnap && newsSnap.exists()) {
                (newsSnap.data().items || []).forEach(item => {
                    if (typeof item === 'object') addSegment(item.text, `#${item.color.replace('FF','')}`);
                    else addSegment(item, "#EF6C00");
                });
            }
            if (segments.length === 0) addSegment("âš½ BEM-VINDO AO BOLÃƒO 112 F.C! FAÃ‡A SEU PALPITE!", "#FFD700");
            return segments.join(' | ') + " | " + segments.join(' | ');
        };

const DEFAULT_HOME_LAYOUT_ORDER = ["ticker", "fast_vote", "matches_open", "matches_wait", "matches_done"];

const normalizeRankingMovementPositions = (raw = {}) => {
  const result = {};
  if (!raw || typeof raw !== "object") return result;
  Object.entries(raw).forEach(([uid, value]) => {
    const position = Number(value);
    if (!uid || !Number.isFinite(position) || position <= 0) return;
    result[uid] = Math.trunc(position);
  });
  return result;
};

const normalizeRankingMovementMap = (raw = {}) => {
  const result = {};
  if (!raw || typeof raw !== "object") return result;

  Object.entries(raw).forEach(([uid, value]) => {
    if (!uid || !value || typeof value !== "object") return;

    const previousPosition = Number(value.previousPosition || value.previous || value.lastPosition || value.from || 0);
    const currentPosition = Number(value.currentPosition || value.current || value.position || value.to || 0);
    const delta = Number(value.delta || 0);

    result[uid] = {
      previousPosition: Number.isFinite(previousPosition) ? Math.trunc(previousPosition) : 0,
      currentPosition: Number.isFinite(currentPosition) ? Math.trunc(currentPosition) : 0,
      delta: Number.isFinite(delta) ? Math.trunc(delta) : 0
    };
  });

  return result;
};

const getRankingMovementInfo = (uid = "") => {
  const snapshot = window.__rankingMovementSnapshot || {};
  return snapshot.movements?.[uid] || null;
};

const loadRankingMovementSnapshot = async ({ force = false } = {}) => {
  if (!force && window.__rankingMovementSnapshot) return window.__rankingMovementSnapshot;

  try {
    const snap = await getDoc(doc(db, "settings", "rankingMovement"));
    const data = snap.exists() ? (snap.data() || {}) : {};
    const snapshot = {
      positions: normalizeRankingMovementPositions(data.positions || {}),
      movements: normalizeRankingMovementMap(data.movements || {}),
      updatedAt: data.updatedAt || null,
      updatedBy: data.updatedBy || "",
      updatedByName: data.updatedByName || "",
      updatedByEmail: data.updatedByEmail || "",
      source: String(data.source || "").trim()
    };

    window.__rankingMovementSnapshot = snapshot;
    return snapshot;
  } catch (error) {
    console.warn("NÃ£o foi possÃ­vel carregar o snapshot de movimento do ranking:", error);
    return window.__rankingMovementSnapshot || {
      positions: {},
      movements: {}
    };
  }
};

const buildRankingMovementSnapshot = (users = [], previousPositions = {}, meta = {}) => {
  const positions = {};
  const movements = {};

  users.forEach((user, index) => {
    const uid = String(user?.uid || user?.id || "").trim();
    if (!uid) return;

    const currentPosition = index + 1;
    const previousPosition = Number(previousPositions?.[uid] || 0);
    const delta = previousPosition > 0 ? previousPosition - currentPosition : 0;

    positions[uid] = currentPosition;
    movements[uid] = {
      previousPosition: previousPosition > 0 ? previousPosition : currentPosition,
      currentPosition,
      delta: previousPosition > 0 ? delta : 0
    };
  });

  return {
    positions,
    movements,
    updatedAt: Timestamp.fromDate(new Date()),
    updatedBy: String(meta?.updatedBy || "").trim(),
    updatedByName: String(meta?.updatedByName || "").trim(),
    updatedByEmail: String(meta?.updatedByEmail || "").trim(),
    source: String(meta?.source || "").trim()
  };
};

const persistRankingMovementSnapshot = async ({ users = [], previousPositions = {}, meta = {} } = {}) => {
  const snapshot = buildRankingMovementSnapshot(users, previousPositions, meta);
  await setDoc(doc(db, "settings", "rankingMovement"), snapshot, { merge: true });
  window.__rankingMovementSnapshot = snapshot;
  return snapshot;
};

const normalizeHomeSectionType = (raw = "") => {
  const value = String(raw || "").trim().toLowerCase();
  if ([
    "ticker",
    "banner",
    "banner_ref",
    "poll",
    "fast_vote",
    "matches_open",
    "matches_wait",
    "matches_done",
    "announcement",
    "cta_card"
  ].includes(value)) return value;
  return "";
};

const normalizeHomeActionType = (raw = "") => {
  const value = String(raw || "").trim().toLowerCase();
  return ["none", "url", "tab"].includes(value) ? value : "none";
};

const normalizeHomeSectionStyle = (raw = "") => {
  const value = String(raw || "").trim().toLowerCase();
  return ["default", "warning", "success", "danger", "dark"].includes(value) ? value : "default";
};

const createBaseHomeSection = (id, type) => ({
  id,
  type,
  enabled: true,
  title: "",
  subtitle: "",
  body: "",
  bannerId: "",
  mediaUrl: "",
  mediaBase64: "",
  style: "default",
  action: { type: "none", value: "", label: "" },
  visibility: {
    adminsOnly: false,
    requiresPendingVotes: false,
    requiresUnreadOpenChat: false,
    requiresUnreadWaitingChat: false,
    requiresUnreadFinishedChat: false,
    featureFlag: "",
    competition: "",
    userSegment: "",
    startAt: null,
    endAt: null
  }
});

const getBaseHomeSections = () => ([
  createBaseHomeSection("base_fast_vote", "fast_vote"),
  createBaseHomeSection("base_matches_open", "matches_open"),
  createBaseHomeSection("base_matches_wait", "matches_wait"),
  createBaseHomeSection("base_matches_done", "matches_done")
]);

const getStatusToneChipClass = (tone = "default") => ({
  default: "status-chip--default",
  success: "status-chip--success",
  warning: "status-chip--warning",
  danger: "status-chip--danger"
}[tone] || "status-chip--default");

const renderCompactEmptyState = ({ title, description, tone = "default" }) => {
  const toneClass = {
    default: "empty-state--default",
    success: "empty-state--success",
    warning: "empty-state--warning",
    danger: "empty-state--danger"
  }[tone] || "empty-state--default";

  return `
    <div class="empty-state ${toneClass}">
      <p class="empty-state__title">${escapeHtml(title)}</p>
      <p class="empty-state__description">${escapeHtml(description)}</p>
    </div>
  `;
};

const renderSkeletonBlock = (lines = 3) => `
  <div class="skeleton-card">
    ${Array.from({ length: lines }).map((_, index) => `
      <div class="skeleton-line ${index === 0 ? "skeleton-line--short" : ""}"></div>
    `).join("")}
  </div>
`;

const renderDeferredHomeSkeleton = () => `
  <div class="surface-card mb-4 p-4">
    <div class="status-chip status-chip--default mb-3">Atualizando destaques</div>
    <div class="space-y-3">
      ${renderSkeletonBlock(3)}
    </div>
  </div>
`;

const getCurrentVisibleTab = () => {
  const tabs = ["matches", "ranking", "rules", "profile"];
  return tabs.find((tab) => {
    const screen = document.getElementById(`${tab}Screen`);
    return screen && !screen.classList.contains("hidden");
  }) || "matches";
};

const applyLiveCurrentUserData = (data = null) => {
  if (!currentUser) return null;
  if (!data) return null;

  const merged = {
    uid: currentUser.uid,
    id: currentUser.uid,
    ...data
  };

  window.__currentUserLiveData = merged;
  return merged;
};

const getLiveCurrentUserData = () => window.__currentUserLiveData || null;

const getMergedCurrentUserData = (fallback = {}) => ({
  ...(fallback || {}),
  ...(getLiveCurrentUserData() || {})
});

const refreshCurrentVisibleViews = async ({ forceMatches = true, forceRanking = true, forceProfile = true } = {}) => {
  const visibleTab = getCurrentVisibleTab();

  if (forceMatches && typeof loadMatches === "function") {
    await loadMatches({ force: true }).catch((error) => {
      console.error("Falha ao recarregar confrontos:", error);
    });
  }

  if (forceRanking && visibleTab === "ranking" && typeof loadRanking === "function") {
    await loadRanking({ force: true }).catch((error) => {
      console.error("Falha ao recarregar ranking:", error);
    });
  }

  if (forceProfile && typeof loadProfile === "function") {
    await loadProfile().catch((error) => {
      console.error("Falha ao recarregar perfil:", error);
    });
  }
};

window.refreshAppData = async ({ hardReload = false, source = "manual" } = {}) => {
  if (window.__appRefreshBusy) return;
  window.__appRefreshBusy = true;

  const btn = document.getElementById("btnRefresh");
  const progressBar = document.getElementById("progressBar");
  const originalHtml = btn?.innerHTML || "";

  try {
    if (btn) {
      btn.disabled = true;
      btn.classList.add("is-loading");
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin text-xl"></i>';
    }
    progressBar?.classList.remove("hidden");

    invalidateHomeRankingCaches();
    await refreshCurrentVisibleViews({ forceMatches: true, forceRanking: true, forceProfile: true });

    const registration = await window.getMainServiceWorkerRegistration?.();
    if (registration?.update) {
      await registration.update().catch((error) => {
        console.warn("Falha ao atualizar service worker:", error);
      });
    }

    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }

    if (hardReload) {
      window.location.reload();
    }
  } catch (error) {
    console.error("Erro ao atualizar o app:", error);
    if (!hardReload) {
      window.location.reload();
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("is-loading");
      btn.innerHTML = originalHtml;
    }
    progressBar?.classList.add("hidden");
    window.__appRefreshBusy = false;
  }
};

const getHomePendingPaymentNotice = (user = {}) => {
  const monthKey = typeof getFinancialCurrentMonthKey === "function" ? getFinancialCurrentMonthKey() : "";
  const monthName = typeof getFinancialCurrentMonthName === "function" ? getFinancialCurrentMonthName() : "mÃªs vigente";
  if (!monthKey) return null;

  const paid = user?.payments?.[monthKey] === true;
  if (paid) return null;

  const today = new Date();
  const overdue = today.getDate() > 10;
  return {
    overdue,
    title: overdue
      ? `Mensalidade de ${monthName} em atraso`
      : `Mensalidade de ${monthName} pendente`,
    message: overdue
      ? `Sua mensalidade de ${monthName} ainda estÃ¡ pendente. Regularize o pagamento para manter sua participaÃ§Ã£o no BolÃ£o 112 FC.`
      : `OlÃ¡! Sua mensalidade de ${monthName} ainda estÃ¡ pendente. O pagamento pode ser realizado atÃ© o dia 10.`
  };
};

window.openHomeFinancialSection = () => {
  showTab("profile");
  setTimeout(() => {
    if (typeof loadProfile === "function") loadProfile();
    document.getElementById("financialSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 240);
};

const formatHomeDeadlineLabel = (value, isWaiting = false) => {
  const deadlineDate = toJsDate(value);
  if (!deadlineDate) return "Sem prazo definido";
  if (isWaiting) return "Prazo encerrado";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDeadline = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
  const diffDays = Math.round((startOfDeadline.getTime() - startOfToday.getTime()) / 86400000);
  const timeLabel = deadlineDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });

  if (diffDays <= 0) return `Expira hoje Ã s ${timeLabel}`;
  if (diffDays === 1) return `Expira amanhÃ£ Ã s ${timeLabel}`;
  return `Expira em ${diffDays} dias Ã s ${timeLabel}`;
};

const getHomeDeadlineGroupKey = (match = {}) => {
  const deadlineDate = match.deadlineDate || toJsDate(match.deadline);
  if (!(deadlineDate instanceof Date)) return "no-deadline";
  if (match.expired === true && !match.winner) return "expired";
  return [
    deadlineDate.getFullYear(),
    String(deadlineDate.getMonth() + 1).padStart(2, "0"),
    String(deadlineDate.getDate()).padStart(2, "0"),
    String(deadlineDate.getHours()).padStart(2, "0"),
    String(deadlineDate.getMinutes()).padStart(2, "0")
  ].join("-");
};

const getHomeDeadlineGroupSortValue = (match = {}) => {
  const deadlineDate = match.deadlineDate || toJsDate(match.deadline);
  if (!(deadlineDate instanceof Date)) return Number.MAX_SAFE_INTEGER;
  if (match.expired === true && !match.winner) return Math.min(deadlineDate.getTime(), Date.now() - 1);
  return deadlineDate.getTime();
};

const getHomeDeadlineGroupLabel = (match = {}) => {
  const deadlineDate = match.deadlineDate || toJsDate(match.deadline);
  if (!(deadlineDate instanceof Date)) return "Sem prazo definido";
  return formatHomeDeadlineLabel(deadlineDate, match.expired === true && !match.winner);
};

const getHomeDeadlineGroupTitle = (group = {}) => {
  if (group.type === "expired") return "Prazo encerrado";
  if (!(group.date instanceof Date)) return "Sem prazo definido";
  return formatHomeDeadlineLabel(group.date, false);
};

window.openDeadlineModal = () => {
  const modal = document.getElementById("modalOverlay");
  const cont = document.getElementById("modalContainer");
  if (!modal || !cont) return;

  const allMatches = Array.isArray(window.cachedMatches) ? window.cachedMatches : [];
  const relevantMatches = allMatches
    .filter((match) => {
      if (!match || match.winner) return false;
      const deadlineDate = match.deadlineDate || toJsDate(match.deadline);
      return deadlineDate instanceof Date;
    })
    .sort((a, b) => {
      const dateA = getHomeDeadlineGroupSortValue(a);
      const dateB = getHomeDeadlineGroupSortValue(b);
      if (dateA !== dateB) return dateA - dateB;
      return matchComparator(a, b);
    });

  const groupedMatches = new Map();
  relevantMatches.forEach((match) => {
    const key = getHomeDeadlineGroupKey(match);
    const deadlineDate = match.deadlineDate || toJsDate(match.deadline);
    const groupDate = deadlineDate instanceof Date ? deadlineDate : null;
    const existing = groupedMatches.get(key);
    if (existing) {
      existing.matches.push(match);
      return;
    }
    groupedMatches.set(key, {
      key,
      type: key === "expired" ? "expired" : key === "no-deadline" ? "no-deadline" : "deadline",
      date: groupDate,
      matches: [match]
    });
  });

  const groupedList = Array.from(groupedMatches.values()).sort((a, b) => {
    const orderA = a.type === "expired" ? -1 : a.date ? a.date.getTime() : Number.MAX_SAFE_INTEGER;
    const orderB = b.type === "expired" ? -1 : b.date ? b.date.getTime() : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.key.localeCompare(b.key);
  });

  const itemsHtml = groupedList.length > 0
    ? groupedList.map((group) => {
        const groupTitle = getHomeDeadlineGroupTitle(group);
        const groupCount = group.matches.length;
        const groupCountLabel = `${groupCount} confronto${groupCount === 1 ? "" : "s"}`;
        const groupSubtitle = group.type === "expired"
          ? "Jogos que jÃ¡ passaram do prazo e aguardam resultado."
          : "Confrontos que expiram nesse mesmo horÃ¡rio.";

        const matchesHtml = group.matches.map((match) => {
          const isWaiting = match.expired === true && !match.winner;
          const statusLabel = isWaiting ? "Aguardando resultado" : "Aberto";
          const statusClass = isWaiting ? "is-waiting" : "is-open";
          const competition = escapeHtml(match.competition || "CompetiÃ§Ã£o");
          const round = escapeHtml(match.round || "Fase");
          return `
            <div class="deadline-match-item ${statusClass}">
              <div class="deadline-match-title">${escapeHtml(match.teamA || "Time A")} x ${escapeHtml(match.teamB || "Time B")}</div>
              <div class="deadline-match-meta">${round} â€” ${competition}</div>
              <div class="deadline-match-footer">
                <span class="deadline-status-chip ${statusClass}">${statusLabel}</span>
              </div>
            </div>
          `;
        }).join("");

        return `
          <section class="deadline-group">
            <div class="deadline-group-header">
              <div class="deadline-group-marker"></div>
              <div class="deadline-group-copy">
                <div class="deadline-group-title">${escapeHtml(groupTitle)}</div>
                <div class="deadline-group-subtitle">${escapeHtml(groupSubtitle)}</div>
              </div>
              <div class="deadline-group-count">${escapeHtml(groupCountLabel)}</div>
            </div>
            <div class="deadline-match-list">
              ${matchesHtml}
            </div>
          </section>
        `;
      }).join("")
    : `
      <div class="deadline-modal-empty">
        Nenhum prazo ativo no momento.<br>
        Quando novos confrontos forem criados, eles aparecerÃ£o aqui.
      </div>
    `;

  modal.classList.remove("hidden");
  cont.innerHTML = `
    <div class="deadline-modal-shell">
      <div class="deadline-modal-header">
        <div>
          <h3 class="deadline-modal-title-main">PrÃ³ximos prazos</h3>
          <p class="deadline-modal-subtitle">Veja quando os confrontos abertos ou aguardando resultado expiram.</p>
        </div>
        <button type="button" class="deadline-modal-close btn-press" onclick="closeModal()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="deadline-groups">
        ${itemsHtml}
      </div>
    </div>
  `;
};

const renderHomeQuickPanel = ({ runtime, open, waiting, finished, myVotesMap }) => {
  const currentUserData = getMergedCurrentUserData(runtime.currentUser || {});
  const currentName = currentUserData?.name || currentUserData?.username || "Jogador";
  const nextMatch = open[0] || waiting[0] || finished[0] || null;
  const nextLabel = open.length
    ? "PrÃ³ximo jogo"
    : waiting.length
      ? "Aguardando resultado"
      : "Painel rÃ¡pido";

  const nextDescription = nextMatch
    ? `${escapeHtml(nextMatch.teamA)} x ${escapeHtml(nextMatch.teamB)}`
    : "Sem confronto aberto no momento.";

  const nextMeta = nextMatch?.deadlineDate
    ? `Prazo: ${nextMatch.deadlineDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} Ã s ${nextMatch.deadlineDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
    : "Use os atalhos abaixo para navegar.";

  const pendingCount = open.filter((m) => !myVotesMap[m.id]).length;
  const paymentNotice = getHomePendingPaymentNotice(currentUserData || {});
  const pendingActionLabel = pendingCount > 0 ? "Votar nos pendentes" : "Tudo certo! Sem pendÃªncias";
  const pendingCounterClass = pendingCount > 0 ? "home-quick-stat--pending-alert" : "home-quick-stat--success";

  return `
    <section class="home-quick-panel surface-card mb-4 overflow-hidden">
      <div class="home-quick-panel__top">
        <div>
          <p class="home-quick-panel__eyebrow">Bem-vindo, ${escapeHtml(currentName)}</p>
          <h3 class="home-quick-panel__title">Seu painel rÃ¡pido</h3>
        </div>
        <span class="status-chip status-chip--success">Ao vivo</span>
      </div>

      ${paymentNotice ? `
        <div class="home-payment-notice ${paymentNotice.overdue ? "is-overdue" : "is-reminder"}">
          <div class="home-payment-notice__icon">
            <i class="fas ${paymentNotice.overdue ? "fa-exclamation-triangle" : "fa-bell"}"></i>
          </div>
          <div class="home-payment-notice__body">
            <div class="home-payment-notice__title">${escapeHtml(paymentNotice.title)}</div>
            <div class="home-payment-notice__message">${escapeHtml(paymentNotice.message)}</div>
          </div>
          <button type="button" class="home-payment-notice__action btn-press" onclick="window.openHomeFinancialSection()">
            Ver financeiro
          </button>
        </div>
      ` : ""}

      <div class="home-quick-panel__hero">
        <div class="home-quick-panel__hero-label">${escapeHtml(nextLabel)}</div>
        <div class="home-quick-panel__hero-title">${nextDescription}</div>
        <div class="home-quick-panel__hero-meta">${escapeHtml(nextMeta)}</div>
      </div>

      <div class="home-quick-stats">
        <button type="button" class="home-quick-stat home-quick-stat--clickable ${pendingCounterClass} btn-press" onclick="window.goToPendingVote()">
          <span class="home-quick-stat__value">${pendingCount}</span>
          <span class="home-quick-stat__label">palpites pendentes</span>
        </button>
        <div class="home-quick-stat">
          <span class="home-quick-stat__value">${open.length}</span>
          <span class="home-quick-stat__label">jogos abertos</span>
        </div>
        <div class="home-quick-stat">
          <span class="home-quick-stat__value">${finished.length}</span>
          <span class="home-quick-stat__label">finalizados</span>
        </div>
      </div>

      <button
        type="button"
        class="home-pending-cta btn-press ${pendingCount > 0 ? "is-active" : "is-empty"}"
        onclick="window.goToPendingVote()"
        ${pendingCount <= 0 ? "disabled" : ""}
      >
        <i class="fas fa-bullseye"></i>
        <span>${escapeHtml(pendingActionLabel)}</span>
      </button>

      <div class="home-quick-actions">
        <button type="button" class="home-quick-action btn-press" onclick="window.openDeadlineModal()">
          <i class="fas fa-calendar-alt"></i>
          <span>Prazos</span>
        </button>
        <button type="button" class="home-quick-action btn-press" onclick="showTab('ranking')">
          <i class="fas fa-trophy"></i>
          <span>Ranking</span>
        </button>
        <button type="button" class="home-quick-action btn-press" onclick="showTab('ranking'); setTimeout(() => { if (window.showKingModal) window.showKingModal(); }, 180)">
          <i class="fas fa-crown"></i>
          <span>Rei do MÃªs</span>
        </button>
        <button type="button" class="home-quick-action btn-press" onclick="showTab('profile')">
          <i class="fas fa-user"></i>
          <span>Perfil</span>
        </button>
      </div>
    </section>
  `;
};

const escapeCssAttrValue = (value = "") =>
  String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');

window.flashPendingMatchCard = (matchId) => {
  if (!matchId) return;
  const selector = `[data-match-id="${escapeCssAttrValue(matchId)}"]`;
  const card = document.querySelector(selector);
  if (!card) return;

  card.classList.add("match-card-shell--flash");
  card.scrollIntoView({ behavior: "smooth", block: "start" });

  if (window.__pendingMatchFlashTimer) clearTimeout(window.__pendingMatchFlashTimer);
  window.__pendingMatchFlashTimer = setTimeout(() => {
    card.classList.remove("match-card-shell--flash");
  }, 1400);
};

window.goToPendingVote = async () => {
  const state = window.__matchesScreenStateCache;
  const pendingCount = state?.runtime?.pendingFastVoteCount || 0;

  if (pendingCount <= 0) {
    if (typeof window.showToast === "function") {
      window.showToast("Tudo certo!", "VocÃª nÃ£o tem palpites pendentes.", "");
    } else {
      alert("VocÃª nÃ£o tem palpites pendentes.");
    }
    return;
  }

  showTab("matches");

  const tryScroll = (attempt = 0) => {
    const card = document.querySelector('[data-match-id][data-pending-vote="1"]');
    if (card) {
      window.flashPendingMatchCard(card.dataset.matchId || "");
      return;
    }

    if (attempt < 12) {
      setTimeout(() => tryScroll(attempt + 1), 150);
      return;
    }

    if (typeof window.showToast === "function") {
      window.showToast("Tudo certo!", "VocÃª nÃ£o tem palpites pendentes.", "");
    } else {
      alert("VocÃª nÃ£o tem palpites pendentes.");
    }
  };

  setTimeout(() => tryScroll(0), 250);
};

const renderMatchesScreenSkeleton = () => `
  <div class="space-y-4">
    ${renderDeferredHomeSkeleton()}
    ${Array.from({ length: 3 }).map(() => `
      <section class="surface-card overflow-hidden">
        <div class="px-4 py-3 bg-white/80 border-b border-gray-100">
          <div class="flex items-center justify-between gap-3">
            <div class="status-chip status-chip--default">Carregando jogos</div>
            <div class="skeleton-pill"></div>
          </div>
        </div>
        <div class="p-3 space-y-3">
          ${renderSkeletonBlock(4)}
        </div>
      </section>
    `).join("")}
  </div>
`;

const renderRankingScreenSkeleton = () => `
  <div class="space-y-3">
    ${Array.from({ length: 6 }).map(() => `
      <div class="surface-card p-4">
        <div class="flex items-center gap-3">
          <div class="skeleton-avatar"></div>
          <div class="flex-1 space-y-2">
            <div class="skeleton-line skeleton-line--medium"></div>
            <div class="skeleton-line skeleton-line--short"></div>
          </div>
          <div class="skeleton-pill"></div>
        </div>
      </div>
    `).join("")}
  </div>
`;

const resolveSectionMediaSource = (section) => {
  const mediaUrl = String(section.mediaUrl || "").trim();
  const mediaBase64 = String(section.mediaBase64 || "").trim();
  return resolveRemoteMediaAsset(mediaUrl || mediaBase64);
};

const parseHomeLayoutDoc = (layoutSnap) => {
  const data = layoutSnap?.exists() ? (layoutSnap.data() || {}) : {};
  const rawSections = Array.isArray(data.sections) ? data.sections : [];

  if (rawSections.length > 0) {
    return {
      hasExplicitSections: true,
      order: Array.isArray(data.order) && data.order.length ? data.order : DEFAULT_HOME_LAYOUT_ORDER,
      sections: rawSections.map((section, index) => {
        const action = section?.action && typeof section.action === "object" ? section.action : {};
        const visibility = section?.visibility && typeof section.visibility === "object" ? section.visibility : {};

        return {
          id: String(section?.id || `section_${index}`),
          type: normalizeHomeSectionType(section?.type),
          enabled: section?.enabled !== false,
          title: String(section?.title || ""),
          subtitle: String(section?.subtitle || ""),
          body: String(section?.body || ""),
          bannerId: String(section?.bannerId || ""),
          mediaUrl: String(section?.mediaUrl || ""),
          mediaBase64: String(section?.mediaBase64 || ""),
          style: normalizeHomeSectionStyle(section?.style),
          action: {
            type: normalizeHomeActionType(action.type),
            value: String(action.value || ""),
            label: String(action.label || "")
          },
          visibility: {
            adminsOnly: visibility.adminsOnly === true,
            requiresPendingVotes: visibility.requiresPendingVotes === true,
            requiresUnreadOpenChat: visibility.requiresUnreadOpenChat === true,
            requiresUnreadWaitingChat: visibility.requiresUnreadWaitingChat === true,
            requiresUnreadFinishedChat: visibility.requiresUnreadFinishedChat === true,
            featureFlag: normalizeHomeFeatureFlag(visibility.featureFlag),
            competition: String(visibility.competition || ""),
            userSegment: normalizeHomeUserSegment(visibility.userSegment),
            startAt: toJsDate(visibility.startAt),
            endAt: toJsDate(visibility.endAt)
          }
        };
      }).filter(section => section.type)
    };
  }

  const legacyOrder = Array.isArray(data.order) && data.order.length
    ? data.order.filter(Boolean)
    : DEFAULT_HOME_LAYOUT_ORDER;

  return {
    hasExplicitSections: false,
    order: legacyOrder,
    sections: legacyOrder.map((item, index) => ({
      id: `legacy_${index}`,
      type: item.startsWith("banner_") ? "banner_ref" : normalizeHomeSectionType(item),
      enabled: true,
      title: "",
      subtitle: "",
      body: "",
      bannerId: item.startsWith("banner_") ? item.replace("banner_", "") : "",
      mediaUrl: "",
      mediaBase64: "",
      style: "default",
      action: { type: "none", value: "", label: "" },
      visibility: {
        adminsOnly: false,
        requiresPendingVotes: false,
        requiresUnreadOpenChat: false,
        requiresUnreadWaitingChat: false,
        requiresUnreadFinishedChat: false,
        featureFlag: "",
        competition: "",
        userSegment: "",
        startAt: null,
        endAt: null
      }
    }))
  };
};

const buildHomeVisibilityRuntime = ({ matches, open, waiting, finished, myVotesMap, allUsersData }) => {
  const currentUserData = getMergedCurrentUserData(
    allUsersData.find(u => u.uid === currentUser?.uid) || null
  );

  let hasUnreadOpenChat = false;
  let hasUnreadWaitingChat = false;
  let hasUnreadFinishedChat = false;

  matches.forEach((m) => {
    const serverCount = globalServerCounts[m.id] || 0;
    const localCount = parseInt(localStorage.getItem(`read_count_${m.id}`) || "0", 10);
    if (serverCount <= localCount) return;

    if (m.winner) hasUnreadFinishedChat = true;
    else if (m.expired) hasUnreadWaitingChat = true;
    else hasUnreadOpenChat = true;
  });

  const pendingFastVoteCount = open.filter(m => !myVotesMap[m.id]).length;

  return {
    currentUser: currentUserData,
    pendingFastVoteCount,
    hasUnreadOpenChat,
    hasUnreadWaitingChat,
    hasUnreadFinishedChat,
    enableChat: appConfig.chat,
    enableFastVote: appConfig.vote,
    enableScout: appConfig.scout,
    availableCompetitions: new Set(matches.map(m => String(m.competition || "").trim()).filter(Boolean)),
    now: new Date()
  };
};

window.toggleHomeSectionCollapse = async (sectionKey) => {
  homeSectionCollapseState[sectionKey] = !homeSectionCollapseState[sectionKey];

  if (window.__matchesScreenStateCache) {
    await renderMatchesScreenFromState(window.__matchesScreenStateCache);
    return;
  }

  loadMatches();
};

const renderCollapsibleSection = ({ sectionKey, title, count, accentClass, tone = "default", contentHtml, emptyHtml = "", defaultCollapsed = false }) => {
  if (!(sectionKey in homeSectionCollapseState)) {
    homeSectionCollapseState[sectionKey] = defaultCollapsed;
  }

  const isCollapsed = !!homeSectionCollapseState[sectionKey];
  const chevron = isCollapsed ? "â–¾" : "â–´";

  return `
    <section class="mb-4 surface-card overflow-hidden matches-section-shell matches-section--${tone}">
      <button
        type="button"
        onclick="window.toggleHomeSectionCollapse('${sectionKey}')"
        class="w-full relative px-4 py-3 matches-section-header"
      >
        <div class="flex flex-col items-center justify-center text-center">
          <span class="status-chip ${getStatusToneChipClass(tone)} ${accentClass}">${title}</span>
          <span class="text-xs font-black text-gray-500">
            (${count})
          </span>
        </div>

        <span class="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-black text-gray-500">
          ${chevron}
        </span>
      </button>

      ${isCollapsed ? "" : `
        <div class="p-3 matches-section-body">
          ${count > 0 ? contentHtml : emptyHtml}
        </div>
      `}
    </section>
  `;
};

const isHomeSectionVisibleWeb = (section, runtime) => {
  const visibility = section.visibility || {};
  const currentUserData = runtime.currentUser;
  const now = runtime.now;

  if (!section.enabled) return false;
  if (visibility.adminsOnly && currentUserData?.isAdmin !== true) return false;
  if (visibility.requiresPendingVotes && runtime.pendingFastVoteCount <= 0) return false;
  if (visibility.requiresUnreadOpenChat && !runtime.hasUnreadOpenChat) return false;
  if (visibility.requiresUnreadWaitingChat && !runtime.hasUnreadWaitingChat) return false;
  if (visibility.requiresUnreadFinishedChat && !runtime.hasUnreadFinishedChat) return false;

  if (visibility.startAt && now < visibility.startAt) return false;
  if (visibility.endAt && now > visibility.endAt) return false;

  if (visibility.featureFlag) {
    if (visibility.featureFlag === "chat" && !runtime.enableChat) return false;
    if (visibility.featureFlag === "fast_vote" && !runtime.enableFastVote) return false;
    if (visibility.featureFlag === "scout" && !runtime.enableScout) return false;
  }

  if (visibility.competition) {
    const hasCompetition = [...runtime.availableCompetitions].some(
      item => item.toLowerCase() === visibility.competition.toLowerCase()
    );
    if (!hasCompetition) return false;
  }

  if (visibility.userSegment) {
    const createdAt = currentUserData?.createdDate || null;
    const daysSinceCreation = createdAt
      ? Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    if (visibility.userSegment === "debtors" && Number(currentUserData?.debts || 0) <= 0) return false;
    if (visibility.userSegment === "new_users" && !(daysSinceCreation !== null && daysSinceCreation <= 30)) return false;
    if (visibility.userSegment === "veterans" && !(daysSinceCreation !== null && daysSinceCreation > 30)) return false;
  }

  return true;
};

window.executeHomeSectionAction = (type, value) => {
  const actionType = normalizeHomeActionType(type);
  const actionValue = String(value || "").trim();

  if (!actionValue || actionType === "none") return;

  if (actionType === "tab") {
    showTab(actionValue);
    return;
  }

  if (actionType === "url") {
    const safeUrl = /^https?:\/\//i.test(actionValue) ? actionValue : `https://${actionValue}`;
    window.open(safeUrl, "_blank", "noopener,noreferrer");
  }
};

const renderTickerBlock = (newsContent) => `
  <div class="mb-3 rounded-[24px] border-[3px] border-[#006400] bg-white shadow-lg overflow-hidden">
    <div class="px-4 py-3 bg-[#006400] text-white text-[11px] font-black uppercase tracking-wide">
      Letreiro
    </div>
    <div class="px-3 py-3 text-[13px] font-bold text-[#006400] bg-[#F9FFF4]">
      <marquee scrollamount="4">${escapeHtml(newsContent)}</marquee>
    </div>
  </div>
`;

const renderServerDrivenSection = (section) => {
  const style = normalizeHomeSectionStyle(section.style);
  const mediaSource = resolveSectionMediaSource(section);
  const actionType = normalizeHomeActionType(section.action?.type);
  const actionValue = String(section.action?.value || "");
  const actionLabel = String(section.action?.label || "");
  const canExecute = actionType !== "none" && actionValue && actionLabel;

  const palette = {
    default: {
      wrapper: "bg-white border-[#006400]",
      title: "text-[#111827]",
      subtitle: "text-gray-600",
      body: "text-gray-700",
      button: "bg-[#006400] text-white"
    },
    warning: {
      wrapper: "bg-[#FFF8E1] border-[#F9A825]",
      title: "text-[#E65100]",
      subtitle: "text-[#8D6E63]",
      body: "text-[#5D4037]",
      button: "bg-[#F9A825] text-black"
    },
    success: {
      wrapper: "bg-[#E8F5E9] border-[#2E7D32]",
      title: "text-[#1B5E20]",
      subtitle: "text-[#2E7D32]",
      body: "text-[#1B4332]",
      button: "bg-[#2E7D32] text-white"
    },
    danger: {
      wrapper: "bg-[#FFEBEE] border-[#C62828]",
      title: "text-[#B71C1C]",
      subtitle: "text-[#C62828]",
      body: "text-[#6D1B1B]",
      button: "bg-[#C62828] text-white"
    },
    dark: {
      wrapper: "bg-[#102027] border-[#FFD700]",
      title: "text-white",
      subtitle: "text-[#CFD8DC]",
      body: "text-[#ECEFF1]",
      button: "bg-[#FFD700] text-black"
    }
  }[style];

  return `
    <div class="mb-3 rounded-[26px] border-[3px] ${palette.wrapper} shadow-lg overflow-hidden">
      ${mediaSource ? `
        <img
          src="${mediaSource}"
          alt="${escapeHtml(section.title || "section")}"
          class="w-full h-[180px] object-cover"
          loading="lazy"
        />
      ` : ""}

      <div class="p-4">
        ${section.title ? `<h3 class="text-lg font-black ${palette.title}">${escapeHtml(section.title)}</h3>` : ""}
        ${section.subtitle ? `<p class="text-[12px] font-bold ${palette.subtitle} mt-1">${escapeHtml(section.subtitle)}</p>` : ""}
        ${section.body ? `<p class="text-[13px] leading-6 ${palette.body} mt-3">${escapeHtml(section.body)}</p>` : ""}

        ${canExecute ? `
          <button
            onclick="window.executeHomeSectionAction('${escapeJsString(actionType)}', '${escapeJsString(actionValue)}')"
            class="mt-4 px-4 py-3 rounded-2xl font-black shadow-sm ${palette.button}"
          >
            ${escapeHtml(actionLabel)}
          </button>
        ` : ""}
      </div>
    </div>
  `;
};

const renderFastVoteBlock = async (pendingOpenMatches, allUsersData, myVotesMap) => {
  if (!pendingOpenMatches.length) return "";

  return `
    <div class="mb-3">
      <h3 class="text-base font-black text-[#006400] mb-2">âš¡ VOTO RÃPIDO (${pendingOpenMatches.length})</h3>
      ${await renderMatchList(pendingOpenMatches, allUsersData, globalServerCounts, myVotesMap)}
    </div>
  `;
};

const renderMatchesOpenBlock = async (open, allUsersData, myVotesMap) => {
  const contentHtml = await renderMatchList(open, allUsersData, globalServerCounts, myVotesMap);

  return renderCollapsibleSection({
    sectionKey: "matches_open",
    title: "âœ… DISPONÃVEIS",
    count: open.length,
    accentClass: "text-[#006400]",
    tone: "success",
    contentHtml,
    emptyHtml: renderCompactEmptyState({
      title: "Nenhum confronto aberto",
      description: "Assim que um novo jogo for liberado, ele aparece aqui.",
      tone: "success"
    }),
    defaultCollapsed: false
  });
};

const renderMatchesWaitingBlock = async (waiting, allUsersData, myVotesMap) => {
  const contentHtml = await renderMatchList(waiting, allUsersData, globalServerCounts, myVotesMap);

  return renderCollapsibleSection({
    sectionKey: "matches_wait",
    title: "â³ AGUARDANDO",
    count: waiting.length,
    accentClass: "text-[#8A6D00]",
    tone: "warning",
    contentHtml,
    emptyHtml: renderCompactEmptyState({
      title: "Nada aguardando resultado",
      description: "Quando o prazo fechar, o confronto entra nesta area.",
      tone: "warning"
    }),
    defaultCollapsed: false
  });
};

const renderMatchesDoneBlock = async (finished, allUsersData, myVotesMap) => {
  const contentHtml = await renderMatchList(finished, allUsersData, globalServerCounts, myVotesMap);

  return renderCollapsibleSection({
    sectionKey: "matches_done",
    title: "ðŸ FINALIZADOS",
    count: finished.length,
    accentClass: "text-[#B71C1C]",
    tone: "danger",
    contentHtml,
    emptyHtml: renderCompactEmptyState({
      title: "Ainda sem jogos finalizados",
      description: "Os resultados encerrados ficam organizados neste bloco.",
      tone: "danger"
    }),
    defaultCollapsed: true
  });
};

const renderHomeSectionsWeb = async ({
  sections,
  runtime,
  open,
  waiting,
  finished,
  allUsersData,
  myVotesMap,
  bannersMap,
  activePoll,
  newsContent,
  extrasPending = false
}) => {
  let html = extrasPending ? renderDeferredHomeSkeleton() : "";
  html += renderHomeQuickPanel({ runtime, open, waiting, finished, myVotesMap });
  const firstActiveBanner = Object.values(bannersMap).find(item => item.active) || null;
  const pendingOpenMatches = open.filter(m => !myVotesMap[m.id]);

  for (const section of sections) {
    if (!isHomeSectionVisibleWeb(section, runtime)) continue;

    switch (normalizeHomeSectionType(section.type)) {
      case "ticker":
        html += renderTickerBlock(newsContent);
        break;

      case "banner_ref":
        if (section.bannerId && bannersMap[section.bannerId]) {
          html += renderBanner(bannersMap[section.bannerId]);
        }
        break;

      case "banner":
        if (firstActiveBanner) {
          html += renderBanner(firstActiveBanner);
        }
        break;

      case "poll":
        if (activePoll) {
          html += renderPoll(activePoll);
        }
        break;

      case "announcement":
      case "cta_card":
        html += renderServerDrivenSection(section);
        break;

      case "fast_vote":
        html += await renderFastVoteBlock(pendingOpenMatches, allUsersData, myVotesMap);
        break;

      case "matches_open":
        html += await renderMatchesOpenBlock(open, allUsersData, myVotesMap);
        break;

      case "matches_wait":
        html += await renderMatchesWaitingBlock(waiting, allUsersData, myVotesMap);
        break;

      case "matches_done":
        html += await renderMatchesDoneBlock(finished, allUsersData, myVotesMap);
        break;
    }
  }

  return html;
};

const buildMatchesCriticalData = ({ setSnap, matchesSnap, guessesSnap, uSnap = null, commentsSnap = null }) => {
  compMap = {};
  if (setSnap.exists()) {
    const items = Array.isArray(setSnap.data().items) ? setSnap.data().items : [];
    items.forEach((item) => {
      if (item?.name) compMap[item.name] = item.logo || "";
    });
  }

  const allUsersData = [];
  if (uSnap) {
    uSnap.forEach((d) => {
      const data = d.data() || {};
      allUsersData.push({
        id: d.id,
        uid: d.id,
        ...data,
        name: data.name || data.username || "Sem nome",
        createdDate: toJsDate(data.createdAt) || new Date(0),
        debts: Number(data.debts || 0),
        isAdmin: data.isAdmin === true
      });
    });
  }

  const guessesData = [];
  const myVotesMap = {};
  const statsMap = {};

  guessesSnap.forEach((d) => {
    const guess = d.data() || {};
    guessesData.push({ id: d.id, ...guess });

    if (guess.userId === currentUser?.uid) {
      myVotesMap[guess.matchId] = guess.teamSelected;
    }

    if (!statsMap[guess.matchId]) {
      statsMap[guess.matchId] = { a: 0, b: 0 };
    }

    if (guess.teamSelected && statsMap[guess.matchId]) {
      if (!statsMap[guess.matchId][guess.teamSelected]) {
        statsMap[guess.matchId][guess.teamSelected] = 0;
      }
      statsMap[guess.matchId][guess.teamSelected] += 1;
    }
  });

  globalServerCounts = {};
  if (commentsSnap) {
    commentsSnap.forEach((d) => {
      const data = d.data() || {};
      const matchId = data.matchId || d.id;

      if (!matchId) return;

      if (typeof data.count === "number") {
        globalServerCounts[matchId] = data.count;
      } else if (Array.isArray(data.comments)) {
        globalServerCounts[matchId] = data.comments.length;
      } else {
        globalServerCounts[matchId] = 0;
      }
    });
  }

  const now = new Date();
  const matches = [];

  matchesSnap.forEach((d) => {
    const m = { id: d.id, ...d.data() };
    const deadlineDate = toJsDate(m.deadline);
    if (!deadlineDate) return;

    m.deadlineDate = deadlineDate;
    m.expired = now > deadlineDate;
    m.final = String(m.round || "").toLowerCase() === "final";
    m.stats = statsMap[m.id] || {};
    matches.push(m);
  });

  matches.sort(matchComparator);
  window.cachedMatches = matches;

  const open = [];
  const waiting = [];
  const finished = [];

  matches.forEach((m, idx) => {
    m.matchNumber = idx + 1;

    if (m.winner) finished.push(m);
    else if (m.expired) waiting.push(m);
    else open.push(m);
  });

  waiting.sort(matchComparator);
  finished.sort((a, b) => matchComparator(b, a));

  return {
    matches,
    open,
    waiting,
    finished,
    allUsersData,
    myVotesMap,
    guessesData,
    runtime: buildHomeVisibilityRuntime({
      matches,
      open,
      waiting,
      finished,
      myVotesMap,
      allUsersData
    })
  };
};

const buildInitialMatchesScreenState = (criticalData) => ({
  sections: getBaseHomeSections(),
  runtime: criticalData.runtime,
  open: criticalData.open,
  waiting: criticalData.waiting,
  finished: criticalData.finished,
  allUsersData: criticalData.allUsersData,
  myVotesMap: criticalData.myVotesMap,
  bannersMap: {},
  activePoll: null,
  newsContent: "",
  extrasPending: true,
  cachedAt: Date.now()
});

const buildFinalMatchesScreenState = (criticalData, { newsSnap, layoutSnap, bannersSnap, pollsSnap }) => {
  const parsedLayout = parseHomeLayoutDoc(layoutSnap);
  layoutOrder = parsedLayout.order;
  homeSections = parsedLayout.sections;

  const bannersMap = {};
  bannersSnap.forEach((d) => {
    const b = d.data() || {};
    bannersMap[d.id] = {
      id: d.id,
      ...b,
      name: b.name || "",
      type: b.type || "full",
      imageUrl: fixDriveUrl(b.imageUrl || ""),
      targetUrl: b.targetUrl || "",
      imageUrl2: fixDriveUrl(b.imageUrl2 || ""),
      targetUrl2: b.targetUrl2 || "",
      active: b.active !== false
    };
  });
  activeBannersMap = bannersMap;

  const pollsMap = {};
  let activePoll = null;

  pollsSnap.forEach((d) => {
    const p = d.data() || {};
    const poll = {
      id: d.id,
      question: p.question || "",
      options: Array.isArray(p.options) ? p.options : [],
      votes: (p.votes && typeof p.votes === "object") ? p.votes : {},
      userVotes: (p.userVotes && typeof p.userVotes === "object") ? p.userVotes : {},
      active: p.active !== false,
      deadline: p.deadline || null
    };

    pollsMap[d.id] = poll;
    if (!activePoll && poll.active) activePoll = poll;
  });
  activePolls = pollsMap;

  const expiredMatches = criticalData.matches.filter((m) => m.deadlineDate < new Date());
  const newsContent = generateNewsFeed(
    newsSnap,
    criticalData.guessesData,
    criticalData.finished,
    criticalData.allUsersData,
    expiredMatches
  );

  return {
    sections: homeSections.length ? homeSections : getBaseHomeSections(),
    runtime: criticalData.runtime,
    open: criticalData.open,
    waiting: criticalData.waiting,
    finished: criticalData.finished,
    allUsersData: criticalData.allUsersData,
    myVotesMap: criticalData.myVotesMap,
    bannersMap,
    activePoll,
    newsContent,
    extrasPending: false,
    cachedAt: Date.now()
  };
};

const startWebAdminSync = () => {
  if (__appStateUnsub) return;

  __appStateUnsub = onSnapshot(doc(db, "settings", "app_state"), () => {
    if (!currentUser) return;

    if (typeof calculatePot === "function") calculatePot();

    if (!document.getElementById("matchesScreen")?.classList.contains("hidden")) {
  loadMatches({ force: true });
}
if (!document.getElementById("rankingScreen")?.classList.contains("hidden") && typeof loadRanking === "function") {
  loadRanking({ force: true });
}

    if (!document.getElementById("profileScreen")?.classList.contains("hidden") && typeof loadProfile === "function") {
      loadProfile();
    }
  });
};

        async function loadMatches(options = {}) {
  const { force = false } = options;
  const container = document.getElementById("matchesScreen");
  const progressBar = document.getElementById("progressBar");
  if (!container) return;

  const cachedState = window.__matchesScreenStateCache;
  if (!force && cachedState && (Date.now() - cachedState.cachedAt) < DATA_CACHE_TTL.hot) {
    await renderMatchesScreenFromState(cachedState);
    return;
  }

  const requestId = ++matchesLoadRequestSeq;

  if (!cachedState) {
    container.innerHTML = renderMatchesScreenSkeleton();
    applyRemoteBackgrounds();
  }

  progressBar?.classList.remove("hidden");

  try {
    const [
      setSnap,
      matchesSnap,
      guessesSnap
    ] = await Promise.all([
      readWithRuntimeCache("doc:settings:competitions", () => getDoc(doc(db, "settings", "competitions")), { ttlMs: DATA_CACHE_TTL.cold, force }),
      readWithRuntimeCache("col:matches", () => getDocs(collection(db, "matches")), { ttlMs: DATA_CACHE_TTL.hot, force }),
      readWithRuntimeCache("col:guesses", () => getDocs(collection(db, "guesses")), { ttlMs: DATA_CACHE_TTL.hot, force })
    ]);

    if (requestId !== matchesLoadRequestSeq) return;

    const criticalData = buildMatchesCriticalData({
      setSnap,
      matchesSnap,
      guessesSnap
    });

    const initialState = buildInitialMatchesScreenState(criticalData);
    window.__matchesScreenStateCache = initialState;
    await renderMatchesScreenFromState(initialState);
    progressBar?.classList.add("hidden");

    void (async () => {
      try {
        const [uSnap, commentsSnap, newsSnap, layoutSnap, bannersSnap, pollsSnap] = await Promise.all([
          readWithRuntimeCache("col:users", () => getDocs(collection(db, "users")), { ttlMs: DATA_CACHE_TTL.warm, force }),
          readWithRuntimeCache("col:match_comments", () => getDocs(collection(db, "match_comments")), { ttlMs: DATA_CACHE_TTL.hot, force }),
        readWithRuntimeCache("doc:settings:news", () => getDoc(doc(db, "settings", "news")), { ttlMs: DATA_CACHE_TTL.warm, force }),
        readWithRuntimeCache("doc:settings:home_layout", () => getDoc(doc(db, "settings", "home_layout")), { ttlMs: DATA_CACHE_TTL.warm, force }),
        readWithRuntimeCache("col:banners", () => getDocs(collection(db, "banners")), { ttlMs: DATA_CACHE_TTL.warm, force }),
        readWithRuntimeCache("col:polls", () => getDocs(collection(db, "polls")), { ttlMs: DATA_CACHE_TTL.hot, force })
      ]);

        if (requestId !== matchesLoadRequestSeq) return;

        const hydratedCriticalData = buildMatchesCriticalData({
          setSnap,
          matchesSnap,
          guessesSnap,
          uSnap,
          commentsSnap
        });

        const finalState = buildFinalMatchesScreenState(hydratedCriticalData, {
          newsSnap,
          layoutSnap,
          bannersSnap,
          pollsSnap
        });

        window.__matchesScreenStateCache = finalState;
        await renderMatchesScreenFromState(finalState);
      } catch (secondaryError) {
        console.error("Erro ao carregar blocos secundarios da home:", secondaryError);
      }
    })();
  } catch (e) {
    console.error("Erro fatal loadMatches:", e);
    if (!cachedState) {
      container.innerHTML = `
        <div class="p-4">
          ${renderCompactEmptyState({
            title: "Erro ao carregar confrontos",
            description: "Confira sua conexao e toque em atualizar para tentar de novo.",
            tone: "danger"
          })}
        </div>
      `;
    }
  } finally {
    progressBar?.classList.add("hidden");
  }
}

        // --- RENDERIZA LISTA DE JOGOS (COM DATA NO BOTÃƒO DE VOTANTES) ---
        const normalizeCompetitionKey = (value = "") => String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();

        const getCompetitionTheme = (competitionName = "") => {
          const key = normalizeCompetitionKey(competitionName);
          const themes = [
            {
              test: /(libertadores|pre-libertadores|conmebol libertadores)/,
              accent: "#0f766e",
              soft: "rgba(236, 253, 245, 0.92)",
              softStrong: "rgba(209, 250, 229, 0.9)",
              chipBg: "rgba(16, 185, 129, 0.14)",
              chipText: "#065f46",
              icon: "fa-star"
            },
            {
              test: /(copa do brasil|cdb)/,
              accent: "#9d174d",
              soft: "rgba(253, 242, 248, 0.92)",
              softStrong: "rgba(252, 231, 243, 0.9)",
              chipBg: "rgba(190, 24, 93, 0.14)",
              chipText: "#831843",
              icon: "fa-trophy"
            },
            {
              test: /(brasileirao|brasileiro|serie a|serie b|serie c)/,
              accent: "#1d4ed8",
              soft: "rgba(239, 246, 255, 0.92)",
              softStrong: "rgba(219, 234, 254, 0.9)",
              chipBg: "rgba(37, 99, 235, 0.14)",
              chipText: "#1e3a8a",
              icon: "fa-shield-halved"
            },
            {
              test: /(sul-americana|sulamericana|sudamericana)/,
              accent: "#c2410c",
              soft: "rgba(255, 247, 237, 0.92)",
              softStrong: "rgba(254, 215, 170, 0.42)",
              chipBg: "rgba(234, 88, 12, 0.14)",
              chipText: "#9a3412",
              icon: "fa-fire-flame-curved"
            },
            {
              test: /(champions|uefa)/,
              accent: "#1e40af",
              soft: "rgba(238, 242, 255, 0.92)",
              softStrong: "rgba(224, 231, 255, 0.9)",
              chipBg: "rgba(59, 130, 246, 0.14)",
              chipText: "#1e3a8a",
              icon: "fa-futbol"
            },
            {
              test: /(carioca|paulista|gaucho|cearense|mineiro|pernambucano|paranaense|estadual)/,
              accent: "#0f766e",
              soft: "rgba(240, 253, 250, 0.92)",
              softStrong: "rgba(204, 251, 241, 0.88)",
              chipBg: "rgba(13, 148, 136, 0.14)",
              chipText: "#115e59",
              icon: "fa-map"
            },
            {
              test: /(amistoso|pre temporada|pre-temporada|torneio de verao|supercopa)/,
              accent: "#475569",
              soft: "rgba(248, 250, 252, 0.92)",
              softStrong: "rgba(226, 232, 240, 0.88)",
              chipBg: "rgba(100, 116, 139, 0.14)",
              chipText: "#334155",
              icon: "fa-flag-checkered"
            }
          ];

          const fallback = {
            accent: "#006400",
            soft: "rgba(240, 253, 244, 0.9)",
            softStrong: "rgba(220, 252, 231, 0.86)",
            chipBg: "rgba(0, 100, 0, 0.14)",
            chipText: "#065f46",
            icon: "fa-medal"
          };

          return themes.find((theme) => theme.test.test(key)) || fallback;
        };

        async function renderMatchList(list, usersList, serverCounts, myVotesMap) {
            let html = "";
            for (const m of list) {
                let userVote = myVotesMap[m.id] || ""; 
                
                const dl = m.deadlineDate;
                const statusAccent = m.final ? "#FFD700" : (m.expired ? (m.winner ? "#D32F2F" : "#FBC02D") : "#006400");
                const theme = getCompetitionTheme(m.competition || "");
                const logo = m.competitionLogo || m.competitionLogoUrl || compMap[m.competition] || "";
                const cardStyle = `--match-accent:${theme.accent};--match-soft:${theme.soft};--match-soft-strong:${theme.softStrong};--match-chip-bg:${theme.chipBg};--match-chip-text:${theme.chipText};border-left-color:${statusAccent};`;
                const isPendingVote = !m.expired && !userVote;
                const isVoteRegistered = !m.expired && !!userVote;
                const sCount = serverCounts[m.id] || 0; 
                const lCount = parseInt(localStorage.getItem(`read_count_${m.id}`) || "0"); 
                let chatBadge = "";
                
                if (sCount > 0) { 
                    const isUnread = sCount > lCount; 
                    const badgeColor = isUnread ? "bg-red-600" : "bg-gray-400"; 
                    const badgeText = sCount > 9 ? "+9" : sCount; 
                    chatBadge = `<div class="absolute -top-1 -right-1 ${badgeColor} text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">${badgeText}</div>`; 
                }

                let thermoHtml = ""; 
                const votesA = m.stats[m.teamA] || 0; 
                const votesB = m.stats[m.teamB] || 0; 
                const totalVotes = votesA + votesB; 
                
                if (Array.isArray(usersList) && usersList.length > 0) {
                    // --- CÃLCULO CIRÃšRGICO DO TERMÃ”METRO ---
                    // Conta apenas usuÃ¡rios que existiam ANTES do prazo do jogo
                    const validCount = usersList.filter(u => (u.createdDate || u.createdAt || new Date(0)) < m.deadlineDate).length;
                    // Garante que o total seja pelo menos 1 ou o nÃºmero de votos (seguranÃ§a contra inconsistÃªncia)
                    const safeTotalUsers = Math.max(validCount || 1, totalVotes);
                    // ---------------------------------------

                    if (!m.expired) {
                        const partPct = Math.round((totalVotes / safeTotalUsers) * 100); 
                        thermoHtml = `<div class="mt-3 pt-2 border-t border-gray-100"><div class="flex justify-between text-[9px] font-bold mb-1 text-gray-500"><span>Engajamento</span><span class="text-[#006400]">${partPct}% votaram</span></div><div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden"><div style="width: ${partPct}%" class="bg-[#006400] h-full"></div></div><p class="text-[8px] text-gray-400 text-right mt-1">${totalVotes} de ${safeTotalUsers} participantes</p></div>`; 
                    } else { 
                        const abstencoes = safeTotalUsers - totalVotes; 
                        const absReal = abstencoes < 0 ? 0 : abstencoes; 
                        const pctA = Math.round((votesA / safeTotalUsers) * 100); 
                        const pctB = Math.round((votesB / safeTotalUsers) * 100); 
                        thermoHtml = `<div class="mt-3 pt-2 border-t border-gray-100"><div class="flex justify-between text-[9px] font-bold mb-1"><span class="text-green-700">${pctA}%</span><span class="text-gray-400 text-[8px]">TERMÃ”METRO (CINZA = NÃƒO VOTOU)</span><span class="text-red-700">${pctB}%</span></div><div class="w-full h-2.5 bg-gray-200 rounded-full flex overflow-hidden"><div style="flex: ${votesA}" class="bg-green-700 h-full border-r border-white/50"></div><div style="flex: ${absReal}" class="bg-gray-300 h-full border-r border-white/50"></div><div style="flex: ${votesB}" class="bg-red-700 h-full"></div></div><div class="flex justify-between text-[8px] text-gray-400 mt-1"><span>${m.teamA}: ${votesA}</span>${absReal > 0 ? `<span>Faltosos: ${absReal}</span>` : ''}<span>${m.teamB}: ${votesB}</span></div></div>`; 
                    }
                }

                html += `<div id="match-card-${escapeJsString(m.id)}" data-match-id="${escapeHtml(m.id)}" data-pending-vote="${isPendingVote ? "1" : "0"}" data-user-voted="${isVoteRegistered ? "1" : "0"}" class="match-card-shell card-cut relative border-l-[6px] mb-6 overflow-hidden ${isPendingVote ? "match-card-shell--pending" : ""} ${isVoteRegistered ? "match-card-shell--voted" : ""}" style="${cardStyle}">
                            <div class="match-card-topbar"></div>
                            ${logo ? `<img src="${logo}" class="match-card-logo-ghost absolute inset-0 w-full h-full object-contain z-0 pointer-events-none p-8">` : ''}
                            <div class="relative z-10 p-3">
                                
                                <div class="flex justify-between items-start mb-2 border-b border-gray-100 pb-2">
                                    <div class="w-10">
                                        <span class="match-number-pill">#${m.matchNumber}</span>
                                    </div>
                                    
                                    <div class="flex-1 text-center">
                                        ${m.final ? '<div class="text-[9px] font-black text-orange-600 mb-1 leading-none">FINAL</div>' : ''}
                                        <div class="match-competition-chip">
                                          <i class="fas ${theme.icon}"></i>
                                          <span>${escapeHtml(m.competition || "Confronto")}</span>
                                        </div>
                                    </div>
                                    
                                    <div class="w-10"></div> </div>

                                <div class="flex justify-between items-start mb-4">
                                    <div class="flex flex-col w-full pr-2">
                                        <span class="match-round-pill">${escapeHtml(m.round || "Rodada")}</span>
                                        <span class="match-deadline-pill ${m.expired ? "is-expired" : ""}">${m.expired ? "Encerrado:" : "Prazo:"} ${dl.toLocaleTimeString([], {day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit"})}</span>
                                    </div>
                                    
                                    <div class="flex gap-3 pt-1">
                                        <button onclick="openMatchComments('${escapeJsString(m.id)}', '${escapeJsString(m.teamA || "")}', '${escapeJsString(m.teamB || "")}', '${escapeJsString(m.winner || "")}')" class="match-action-btn text-gray-500 hover:text-[#006400] transition-colors relative">
                                            <i class="fas fa-comment-dots text-xl"></i>${chatBadge}
                                        </button>
                                        <button onclick="openVoters('${escapeJsString(m.id)}', '${escapeJsString(m.teamA || "")}', '${escapeJsString(m.teamB || "")}', '${escapeJsString(m.teamAUrl || "")}', '${escapeJsString(m.teamBUrl || "")}', ${m.expired}, '${escapeJsString(m.winner || "")}', '${escapeJsString(dl.toISOString())}')" class="match-action-btn text-[#006400] hover:scale-110 transition-transform">
                                            <i class="fas ${m.expired ? 'fa-eye' : 'fa-users'} text-xl"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <div class="flex items-center justify-between px-1">
                                    ${createTeamBtn(m.id, m.teamA, m.teamAUrl, userVote===m.teamA, m.expired, "A")}
                                    <span class="match-versus">X</span>
                                    ${createTeamBtn(m.id, m.teamB, m.teamBUrl, userVote===m.teamB, m.expired, "B")}
                                </div>
                                
                                ${m.winner ? `<div class="mt-3 text-center border-t pt-2"><span class="text-[10px] font-bold text-gray-400">VENCEDOR</span><p class="match-winner-name">${escapeHtml(m.winner)}</p></div>` : ''}
                                ${thermoHtml}
                            </div>
                        </div>`;
            } 
            return html;
        }

        // --- FUNÃ‡Ã•ES DE VOTO OTIMIZADAS (SEM LAG) ---
        
        function createTeamBtn(mid, name, url, selected, expired, side) { 
            const btnId = `btn-${mid}-${side}`;
            
            const bg = selected ? 'bg-[#006400] text-white' : 'bg-[#EEEEEE] text-gray-800'; 
            const border = selected ? 'border-2 border-[#FFD700]' : ''; 
            
            // LÃ“GICA DE CORREÃ‡ÃƒO DE IMAGEM
            // Verifica se a URL existe e nÃ£o Ã© "false" ou "null"
            const hasImage = url && url !== "false" && url !== "null" && url.trim() !== "";
            
            const iconHtml = hasImage 
                ? `<img src="${escapeHtml(url)}" class="w-10 h-10 object-contain mb-1" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
                   <i class="fas fa-shield-alt text-2xl mb-1 text-gray-400 hidden"></i>` 
                : `<i class="fas fa-shield-alt text-2xl mb-1 text-gray-400"></i>`;
            // CORREÃ‡ÃƒO DO CLICK: Adicionado window.vote
            return `<button id="${btnId}" data-team="${escapeHtml(name)}" onclick="window.vote('${escapeJsString(mid)}', '${side}', '${btnId}')" ${expired?'disabled':''} class="match-btn-${mid} btn-press relative flex flex-col items-center justify-center w-[40%] h-24 rounded-lg transition-all ${bg} ${border} ${expired?'opacity-80':''}">
                ${iconHtml}
                <span class="match-team-name text-center leading-tight px-1 line-clamp-2">${name}</span>
            </button>`; 
        }
        window.vote = async (mid, side, btnId) => { 
            if(!currentUser) return; 

            // --- TRAVA DE SEGURANÃ‡A (NOVO) ---
            // Verifica se o usuÃ¡rio realmente existe no banco antes de aceitar o voto
            const userRef = doc(db, "users", currentUser.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                alert("SessÃ£o invÃ¡lida ou duplicada.\n\nVocÃª serÃ¡ desconectado para corrigir seu cadastro. Por favor, faÃ§a login novamente.");
                await signOut(auth);
                location.reload();
                return;
            }
            // ----------------------------------
            
            const clickedBtn = document.getElementById(btnId);
            const team = clickedBtn?.dataset?.team || "";
            if (!team) {
                console.warn("BotÃ£o de voto sem time associado:", { mid, side, btnId });
                return;
            }
            const existingVote = window.__matchesScreenStateCache?.myVotesMap?.[mid] || "";
            const currentMatch = window.__matchesScreenStateCache?.open?.find((match) => match.id === mid);
            const isChangingVote = !!existingVote && existingVote !== team && !currentMatch?.expired;

            // 1. ATUALIZAÃ‡ÃƒO VISUAL IMEDIATA (Otimista)
            const buttons = document.getElementsByClassName(`match-btn-${mid}`);
            for (let btn of buttons) {
                btn.className = `match-btn-${mid} btn-press flex flex-col items-center justify-center w-[40%] h-24 rounded-lg transition-all bg-[#EEEEEE] text-gray-800`;
            }

            for (let btn of buttons) {
                btn.disabled = true;
                btn.classList.add("is-saving-vote");
            }
            if(clickedBtn) {
                clickedBtn.className = `match-btn-${mid} btn-press flex flex-col items-center justify-center w-[40%] h-24 rounded-lg transition-all bg-[#006400] text-white border-2 border-[#FFD700]`;
            }

            try {
                await setDoc(doc(db, "guesses", `${mid}_${currentUser.uid}`), {
                    matchId: mid,
                    userId: currentUser.uid,
                    teamSelected: team,
                    timestamp: new Date()
                });
            } catch (error) {
                console.error("Erro ao salvar voto:", error);
                if (window.__matchesScreenStateCache) {
                    await renderMatchesScreenFromState(window.__matchesScreenStateCache);
                }
                if (typeof window.showToast === "function") {
                    window.showToast("NÃ£o foi possÃ­vel salvar seu palpite.", "Tente novamente.", "");
                } else {
                    alert("NÃ£o foi possÃ­vel salvar seu palpite. Tente novamente.");
                }
                return;
            }

            if (typeof window.showToast === "function") {
                window.showToast(
                  isChangingVote ? "Palpite alterado!" : "Palpite registrado!",
                  isChangingVote ? "Seu voto anterior foi substituÃ­do com sucesso." : "Seu voto foi salvo com sucesso.",
                  ""
                );
            } else {
                alert(isChangingVote ? "Palpite alterado com sucesso!" : "Palpite registrado com sucesso!");
            }

            try {
                playVoteSound();
                invalidateHomeRankingCaches();
                if (window.__matchesScreenStateCache) {
                    const wasPending = !existingVote;
                    window.__matchesScreenStateCache.myVotesMap = window.__matchesScreenStateCache.myVotesMap || {};
                    window.__matchesScreenStateCache.myVotesMap[mid] = team;
                    if (window.__matchesScreenStateCache.runtime) {
                        window.__matchesScreenStateCache.runtime.pendingFastVoteCount = Math.max(
                          0,
                          (window.__matchesScreenStateCache.runtime.pendingFastVoteCount || 0) - (wasPending ? 1 : 0)
                        );
                    }
                    if (Array.isArray(window.__matchesScreenStateCache.open)) {
                        const cachedMatch = window.__matchesScreenStateCache.open.find((match) => match.id === mid);
                        if (cachedMatch) cachedMatch.userVote = team;
                    }
                    if (!document.getElementById("matchesScreen")?.classList.contains("hidden")) {
                        await renderMatchesScreenFromState(window.__matchesScreenStateCache);
                        window.flashPendingMatchCard(mid);
                    }
                }

            } catch (uiError) {
                console.warn("Voto salvo, mas houve erro ao atualizar a interface:", uiError);
            } finally {
                for (let btn of buttons) {
                    btn.disabled = false;
                    btn.classList.remove("is-saving-vote");
                }
            }
        };
        
       // --- FUNÃ‡ÃƒO QUEM VOTOU / QUEM FALTA (CORRIGIDA COM FILTRO DE DATA) ---
        // Recebe deadlineIso como Ãºltimo argumento
        window.openVoters = async (matchId, ta, tb, taUrl, tbUrl, isExpired, winner, deadlineIso) => {
            const container = document.getElementById('modalContainer');
            document.getElementById('modalOverlay').classList.remove('hidden');
            
            container.innerHTML = `
                <div class="bg-white rounded-lg p-6 shadow-xl relative w-80 text-center">
                    <i class="fas fa-circle-notch fa-spin text-2xl text-[#006400] mb-4"></i>
                    <p class="font-bold text-gray-500">Analisando lista de presenÃ§a...</p>
                </div>`;

            try {
                // Converte a data do prazo para objeto Date
                const matchDeadline = new Date(deadlineIso);

                // 1. Busca UsuÃ¡rios e Palpites
                const [uSnap, gSnap] = await Promise.all([
                    getDocs(collection(db, "users")),
                    getDocs(query(collection(db, "guesses"), where("matchId", "==", matchId)))
                ]);

                // 2. Mapeia UsuÃ¡rios (Com Data de CriaÃ§Ã£o)
                const userMap = {};
                const allUsers = [];
                
                uSnap.forEach(doc => {
                    const d = doc.data();
                   // --- CORREÃ‡ÃƒO CRÃTICA AQUI ---
                    // Se nÃ£o tiver data, assume AGORA (new Date()), para nÃ£o aparecer em jogos velhos.
                    // Antes estava new Date(0) [1970], o que causava o bug.
                    const created = d.createdAt ? d.createdAt.toDate() : new Date();
                    
                    const u = { 
                        id: doc.id, 
                        name: d.name || "AnÃ´nimo", 
                        photo: d.photoBase64 || "",
                        createdAt: created 
                    };
                    
                    userMap[doc.id] = u;
                    allUsers.push(u);
                });

                const votedIds = new Set();
                let votersList = [];

                gSnap.forEach(doc => {
                    const g = doc.data();
                    const uid = g.userId;
                    votedIds.add(uid);
                    
                    const user = userMap[uid] || { name: "Desconhecido", photo: "" };
                    let imgShow = "";
                    
                    if(isExpired) {
                        const voted = (g.teamSelected||"").trim().toLowerCase();
                        if(voted === ta.trim().toLowerCase()) imgShow = taUrl;
                        else if(voted === tb.trim().toLowerCase()) imgShow = tbUrl;
                    }

                    votersList.push({
                        name: user.name,
                        photo: user.photo,
                        team: g.teamSelected,
                        img: imgShow,
                        isWinner: winner && g.teamSelected === winner
                    });
                });

                // 3. Identifica quem FALTOU (Com Filtro de Data)
                // AQUI ESTÃ A CORREÃ‡ÃƒO: SÃ³ entra na lista se criado ANTES do jogo
                const missingList = allUsers.filter(u => {
                    // Se jÃ¡ votou, nÃ£o Ã© faltoso
                    if (votedIds.has(u.id)) return false;
                    
                    // Se entrou DEPOIS do jogo, nÃ£o Ã© faltoso (ignora)
                    if (u.createdAt > matchDeadline) return false;

                    // Caso contrÃ¡rio, Ã© faltoso
                    return true;
                });

                // OrdenaÃ§Ã£o
                if(winner) {
                    votersList.sort((a,b) => (b.isWinner === a.isWinner) ? a.name.localeCompare(b.name) : (b.isWinner ? 1 : -1));
                } else {
                    votersList.sort((a,b) => a.name.localeCompare(b.name));
                }
                missingList.sort((a,b) => a.name.localeCompare(b.name));

                // Renderiza HTML dos Votantes
                let listHtml = "";
                if(votersList.length === 0) listHtml = `<p class="text-center text-gray-400 text-xs py-2">NinguÃ©m votou ainda.</p>`;
                else {
                    votersList.forEach(v => {
                        let bgClass = "bg-white/80";
                        let statusIcon = "";
                        if(winner) {
                            if(v.isWinner) { bgClass = "bg-green-50/90 border-green-200"; statusIcon = `<i class="fas fa-check-circle text-green-600 ml-2"></i>`; }
                            else { bgClass = "bg-red-50/90 border-red-200"; statusIcon = `<i class="fas fa-times-circle text-red-600 ml-2"></i>`; }
                        }
                        listHtml += `
                        <div class="flex items-center justify-between p-2 mb-1 rounded border border-gray-100 shadow-sm ${bgClass}">
                            <div class="flex items-center gap-2 overflow-hidden">
                                <img src="${getAvatarUrl(v.photo, v.name)}" class="w-8 h-8 rounded-full border border-gray-300 object-cover bg-white">
                                <span class="text-sm font-bold text-gray-800 truncate max-w-[130px]">${v.name}</span>
                            </div>
                            <div class="flex items-center">
                                ${!isExpired 
                                    ? `<span class="text-[10px] font-bold text-gray-500 flex items-center bg-gray-200 px-2 py-1 rounded"><i class="fas fa-lock mr-1"></i> Sigilo</span>` 
                                    : (v.img ? `<img src="${v.img}" class="w-6 h-6 object-contain">` : `<span class="text-xs font-bold">${v.team}</span>`)
                                }
                                ${winner ? statusIcon : ''}
                            </div>
                        </div>`;
                    });
                }

                // Renderiza HTML dos Faltosos
                let missingHtml = "";
                if(missingList.length > 0) {
                    const titleMissing = isExpired ? "ðŸ˜¡ NÃƒO VOTARAM (MÃƒO DE ALFACE)" : "â³ FALTA VOTAR";
                    const colorMissing = isExpired ? "text-red-600" : "text-yellow-600";
                    
                    missingHtml += `<div class="mt-4 mb-2 border-t border-gray-300 pt-2"><h4 class="text-xs font-black ${colorMissing} uppercase text-center mb-2">${titleMissing} (${missingList.length})</h4><div class="grid grid-cols-4 gap-2">`;
                    
                    missingList.forEach(u => {
                        missingHtml += `
                        <div class="flex flex-col items-center">
                            <div class="w-8 h-8 rounded-full border border-gray-300 overflow-hidden grayscale opacity-70">
                                <img src="${getAvatarUrl(u.photo, u.name)}" class="w-full h-full object-cover">
                            </div>
                            <span class="text-[9px] font-bold text-gray-500 truncate w-full text-center mt-1">${u.name.split(' ')[0]}</span>
                        </div>`;
                    });
                    missingHtml += `</div></div>`;
                }

                // Montagem Final
                const title = !isExpired ? "QUEM JA VOTOU?" : (winner ? "RESULTADO DOS PALPITES" : "PALPITES REGISTRADOS");
                const votersSubtitle = !isExpired
                    ? "Os palpites sao revelados apos o prazo."
                    : (winner ? "Acertos, erros e ausencias em formato compacto." : "Aguardando resultado oficial.");
                const shortVoterName = (name = "") => String(name || "Anonimo").trim().split(/\s+/).slice(0, 2).join(" ");
                const normalizeTeamChoice = (value = "") => String(value || "").trim().toLowerCase();
                const teamLogoForChoice = (team = "") => {
                    const choice = normalizeTeamChoice(team);
                    if (choice === normalizeTeamChoice(ta)) return taUrl;
                    if (choice === normalizeTeamChoice(tb)) return tbUrl;
                    return "";
                };
                const renderVoterChip = (person, modifier = "", metaHtml = "") => `
                    <div class="voter-chip ${modifier}">
                        <img src="${escapeHtml(getAvatarUrl(person.photo, person.name))}" class="voter-chip__avatar" alt="">
                        <span class="voter-chip__name">${escapeHtml(shortVoterName(person.name))}</span>
                        ${metaHtml}
                    </div>
                `;
                const renderVoterGroup = (groupTitle, count, modifier, contentHtml) => `
                    <section class="voter-group ${modifier}">
                        <div class="voter-group-title"><span>${escapeHtml(groupTitle)} (${count})</span></div>
                        <div class="voters-compact-grid">${contentHtml}</div>
                    </section>
                `;

                if (votersList.length === 0) {
                    listHtml = `<p class="voters-empty">Ninguem votou ainda.</p>`;
                } else if (!isExpired) {
                    listHtml = renderVoterGroup(
                        "VOTARAM",
                        votersList.length,
                        "voter-group--secret",
                        votersList.map((v) => renderVoterChip(v, "voter-chip--secret", `<span class="voter-chip__tag"><i class="fas fa-lock"></i> Sigilo</span>`)).join("")
                    );
                } else if (winner) {
                    const correctList = votersList.filter((v) => v.isWinner);
                    const wrongList = votersList.filter((v) => !v.isWinner);
                    listHtml = "";
                    if (correctList.length) {
                        listHtml += renderVoterGroup(
                            "ACERTARAM",
                            correctList.length,
                            "voter-group--correct",
                            correctList.map((v) => renderVoterChip(v, "voter-chip--correct", `<span class="voter-chip__team">${teamLogoForChoice(v.team) ? `<img src="${escapeHtml(teamLogoForChoice(v.team))}" alt="">` : escapeHtml(v.team || "")}</span><span class="voter-chip__result"><i class="fas fa-check"></i></span>`)).join("")
                        );
                    }
                    if (wrongList.length) {
                        listHtml += renderVoterGroup(
                            "ERRARAM",
                            wrongList.length,
                            "voter-group--wrong",
                            wrongList.map((v) => renderVoterChip(v, "voter-chip--wrong", `<span class="voter-chip__team">${teamLogoForChoice(v.team) ? `<img src="${escapeHtml(teamLogoForChoice(v.team))}" alt="">` : escapeHtml(v.team || "")}</span><span class="voter-chip__result"><i class="fas fa-times"></i></span>`)).join("")
                        );
                    }
                } else {
                    const grouped = new Map();
                    votersList.forEach((v) => {
                        const label = String(v.team || "Sem time").trim() || "Sem time";
                        const key = normalizeTeamChoice(label);
                        if (!grouped.has(key)) grouped.set(key, { label, items: [] });
                        grouped.get(key).items.push(v);
                    });
                    listHtml = "";
                    grouped.forEach((group) => {
                        const logo = teamLogoForChoice(group.label);
                        listHtml += renderVoterGroup(
                            group.label,
                            group.items.length,
                            "voter-group--waiting",
                            group.items.map((v) => renderVoterChip(v, "voter-chip--waiting", `<span class="voter-chip__team">${logo ? `<img src="${escapeHtml(logo)}" alt="">` : escapeHtml(group.label)}</span>`)).join("")
                        );
                    });
                }

                if (missingList.length > 0) {
                    const titleMissing = isExpired ? "NAO VOTARAM" : "FALTA VOTAR";
                    missingHtml = renderVoterGroup(
                        titleMissing,
                        missingList.length,
                        "voter-group--missing",
                        missingList.map((u) => renderVoterChip(u, "voter-chip--missing", `<span class="voter-chip__tag">Pendente</span>`)).join("")
                    );
                }

                container.innerHTML = `
                <div class="voters-modal w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden relative">
                    <img src="bg_dialog_votantes.jpeg" class="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none z-0">
                    <div class="voters-modal__header">
                        <h3>${escapeHtml(title)}</h3>
                        <p>${escapeHtml(votersSubtitle)}</p>
                        <div class="voters-summary">
                            <span><i class="fas fa-check-circle"></i> Votaram: ${votersList.length}</span>
                            <span><i class="fas fa-hourglass-half"></i> Faltam: ${missingList.length}</span>
                        </div>
                    </div>
                    <div class="voters-modal__body">
                        ${listHtml}
                        ${missingHtml}
                    </div>
                    <div class="voters-modal__footer">
  <div class="flex gap-2">
    ${
      (window.__returnToHistoryIdx !== null && window.__returnToHistoryIdx !== undefined)
        ? `<button id="btnBackToHistory"
              class="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-bold shadow-md btn-press text-sm uppercase">
              Voltar
           </button>`
        : ''
    }

    <button onclick="closeModal()" class="${(window.__returnToHistoryIdx !== null && window.__returnToHistoryIdx !== undefined) ? 'flex-1' : 'w-full'} bg-[#006400] text-white py-3 rounded-lg font-bold shadow-md btn-press text-sm uppercase">
      Fechar
    </button>
  </div>
</div>

                </div>`;

            } catch(e) {
                console.error(e);
                container.innerHTML = `<div class="bg-white p-6 rounded text-center"><p class="text-red-500 font-bold">Erro ao carregar lista.</p><button onclick="closeModal()" class="mt-4 bg-gray-800 text-white px-4 py-2 rounded">Fechar</button></div>`;
            }
              // Se veio do extrato, habilita o botÃ£o VOLTAR
const backBtn = document.getElementById('btnBackToHistory');
if (backBtn) {
  backBtn.onclick = () => {
    const idx = window.__returnToHistoryIdx;
    window.__returnToHistoryIdx = null; // limpa retorno (evita voltar infinito)
    closeModal(); // fecha lista de palpites
    if (typeof window.showModalHistory === 'function' && typeof idx === 'number') {
      window.showModalHistory(idx); // reabre extrato do mesmo usuÃ¡rio
    }
  };
}
  
        };
// --- IR PARA "PALPITES REGISTRADOS" PELO EXTRATO ---
window.goToMatchRegisteredBets = async (matchId, fromHistoryIdx = null) => {

  try {
    if (!matchId) return;
// âœ… COLE ESSE BLOCO AQUI (logo depois do if (!matchId) return;)
    window.__returnToHistoryIdx =
      (typeof fromHistoryIdx === 'number')
        ? fromHistoryIdx
        : (typeof window.__fromHistoryIdx === 'number' ? window.__fromHistoryIdx : null);
          
    // Fecha o modal do extrato (se estiver aberto)
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.add('hidden');

    // Vai para a aba de confrontos
    if (typeof showTab === 'function') showTab('matches');

    // Garante que os confrontos estejam em cache
    if (!Array.isArray(window.cachedMatches) || window.cachedMatches.length === 0) {
      if (typeof loadMatches === 'function') {
        await loadMatches();
      }
    }

    const m = (window.cachedMatches || []).find(x => x.id === matchId);
    if (!m) {
      alert("Confronto nÃ£o encontrado. Recarregue a pÃ¡gina e tente novamente.");
      return;
    }

    // Normaliza deadlineDate (no seu loadMatches vocÃª jÃ¡ cria m.deadlineDate)
    const dl = m.deadlineDate instanceof Date
      ? m.deadlineDate
      : (m.deadline && typeof m.deadline.toDate === 'function' ? m.deadline.toDate() : null);

    if (!dl) {
      alert("Confronto sem prazo vÃ¡lido.");
      return;
    }

    const now = new Date();
    const isExpired = now > dl;

    // Abre o modal de "Palpites registrados" do confronto clicado
    await window.openVoters(
      m.id,
      m.teamA,
      m.teamB,
      m.teamAUrl || "",
      m.teamBUrl || "",
      isExpired,
      m.winner || "",
      dl.toISOString()
    );
  } catch (e) {
    console.error("goToMatchRegisteredBets error:", e);
    alert("Erro ao abrir o confronto. Tente novamente.");
  }
};


        // --- TIRA-TEIMA (WEB) COM ESCUDOS, DATA E SOMA 100% ---
        window.compareGuesses = async (targetUid, targetName) => {
            const modal = document.getElementById('modalOverlay'); 
            const cont = document.getElementById('modalContainer'); 
            cont.innerHTML = `<div class="bg-white p-4 text-center"><i class="fas fa-spinner fa-spin text-[#006400]"></i></div>`;
            
            const [mSnap, mySnap, rivalSnap] = await Promise.all([
                getDocs(query(collection(db, "matches"), orderBy("deadline", "desc"))),
                getDocs(query(collection(db, "guesses"), where("userId", "==", currentUser.uid))),
                getDocs(query(collection(db, "guesses"), where("userId", "==", targetUid)))
            ]);

            const myVotes = {}; mySnap.forEach(d => myVotes[d.data().matchId] = d.data().teamSelected);
            const rivalVotes = {}; rivalSnap.forEach(d => rivalVotes[d.data().matchId] = d.data().teamSelected);
            
            let html = `
            <div class="w-full max-w-sm bg-white h-[85vh] flex flex-col relative rounded-none shadow-2xl">
                <div class="bg-[#006400] p-4 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h3 class="font-black text-xs uppercase text-[#FFD700]">TIRA-TEIMA</h3>
                        <p class="font-bold text-sm">Eu x ${targetName}</p>
                    </div>
                    <button onclick="window.closeModal()"><i class="fas fa-times"></i></button>
                </div>
                <div class="flex-1 overflow-y-auto p-2 bg-gray-50 space-y-2">`;

            const now = new Date();
            let count = 0;

            mSnap.forEach(d => {
                const m = {id:d.id, ...d.data()};
                const dl = m.deadline.toDate();
                const isExpired = now > dl;
                const myV = myVotes[m.id];
                const rivalV = rivalVotes[m.id];

                if (myV || rivalV || isExpired) {
                    count++;
                    const isDiff = isExpired && myV && rivalV && myV !== rivalV;
                    const bgClass = isDiff ? "bg-red-50 border-red-200" : "bg-white border-gray-200";
                    
                    const dateStr = dl.toLocaleTimeString('pt-BR', {day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit'});

                    let rivalDisplay = "-";
                    if (!isExpired) {
                        rivalDisplay = `<span class="text-gray-400 italic"><i class="fas fa-lock"></i> Sigilo</span>`;
                    } else {
                        rivalDisplay = rivalV || "âŒ";
                        if(rivalV === m.winner) rivalDisplay = `<span class="text-green-600 font-bold">${rivalV}</span>`;
                    }

                    let myDisplay = myV || "âŒ";
                    if(myV === m.winner) myDisplay = `<span class="text-green-600 font-bold">${myV}</span>`;

                    html += `
                    <div class="border rounded p-2 ${bgClass}">
                        <div class="text-center mb-1">
                            <p class="text-[9px] text-gray-500 mb-1">${dateStr}</p>
                            <div class="flex items-center justify-center gap-2">
                                ${m.teamAUrl ? `<img src="${m.teamAUrl}" class="w-5 h-5 object-contain">` : ''}
                                <span class="text-[10px] font-bold text-gray-700">${m.teamA} x ${m.teamB}</span>
                                ${m.teamBUrl ? `<img src="${m.teamBUrl}" class="w-5 h-5 object-contain">` : ''}
                            </div>
                            ${m.winner ? `<span class="text-[9px] text-green-700 font-black">Vencedor: ${m.winner}</span>` : ''}
                        </div>
                        <div class="flex items-center text-xs border-t pt-1">
                            <div class="flex-1 text-center font-bold border-r">${myDisplay}</div>
                            <div class="px-2 text-gray-400">vs</div>
                            <div class="flex-1 text-center font-bold">${rivalDisplay}</div>
                        </div>
                    </div>`;
                }
            });

            if(count === 0) html += `<p class="text-center text-gray-500 mt-10">Sem dados para comparar.</p>`;
            
            html += `</div>
                <div class="p-2 border-t bg-white">
                    <button onclick="closeModal()" class="w-full bg-[#006400] text-white py-3 font-bold rounded">FECHAR</button>
                </div>
            </div>`;
            
            cont.innerHTML = html;
        };

        // --- RANKING COM NOVAS MEDALHAS (MITO E DIAMANTE) ---
        // VariÃ¡vel global para armazenar a info da Ãºltima atualizaÃ§Ã£o
        window.globalLastUpdateInfo = "Aguardando atualizaÃ§Ã£o...";

       // --- RANKING FINAL (PARIDADE ANDROID: REIS, ZEBRAS E SORT COMPLEXO) ---
async function loadRanking(options = {}) {
  const { force = false } = options;
  const listContainer = document.getElementById('rankingListContent');
  const footer = document.getElementById('lastUpdateRanking');
  const appContent = document.getElementById('appContent');
  if (!listContainer || !footer) return;

  const cachedRanking = window.__rankingScreenCache;
  if (!force && cachedRanking && (Date.now() - cachedRanking.cachedAt) < DATA_CACHE_TTL.hot) {
    footer.innerHTML = cachedRanking.footerHtml;
    listContainer.innerHTML = cachedRanking.html;
    currentRankingData = cachedRanking.currentRankingData;
    window.currentMonthlyRanking = cachedRanking.currentMonthlyRanking;
    window.currentMonthlyRankingHistory = cachedRanking.currentMonthlyRankingHistory;
    window.currentMonthlyRankingSelectedMonth = cachedRanking.currentMonthlyRankingSelectedMonth;
    window.globalLastUpdateInfo = cachedRanking.lastUpdateInfo;
    window.__rankingMovementSnapshot = cachedRanking.rankingMovementSnapshot || window.__rankingMovementSnapshot || { positions: {}, movements: {} };
    listContainer.scrollTop = 0;
    if (appContent) appContent.scrollTop = 0;
    return;
  }

  footer.innerHTML = "";
  if (!cachedRanking) {
    listContainer.innerHTML = renderRankingScreenSkeleton();
  }

  try {
    const [uSnap, gSnap, mSnap] = await Promise.all([
      readWithRuntimeCache("col:users", () => getDocs(collection(db, "users")), { ttlMs: DATA_CACHE_TTL.warm, force }),
      readWithRuntimeCache("col:guesses", () => getDocs(collection(db, "guesses")), { ttlMs: DATA_CACHE_TTL.hot, force }),
      readWithRuntimeCache("col:matches", () => getDocs(collection(db, "matches")), { ttlMs: DATA_CACHE_TTL.hot, force })
    ]);
    const rankingMovementSnapshot = await loadRankingMovementSnapshot({ force });

                // 1. DADOS BRUTOS & DATA MATCHES
                const matches = [];
const validMatchIds = new Set();

mSnap.forEach(d => {
    const data = d.data();
    if (data.deadline) {
        matches.push({
            id: d.id,
            ...data,
            deadlineDate: data.deadline.toDate()
        });
        validMatchIds.add(d.id);
    }
});

// ADICIONE EXATAMENTE AQUI
matches.sort(matchComparator);
matches.forEach((m, idx) => {
    m.matchNumber = idx + 1;
});

// IMPORTANTE:
// finishedMatchesChrono = ordem oficial para cÃ¡lculo de medalhas/streaks
// finishedMatchesDisplay = ordem visual mais recente primeiro
const finishedMatchesChrono = matches.filter(m => m.winner);
const finishedMatchesDisplay = [...finishedMatchesChrono].sort((a, b) => matchComparator(b, a));

// MantÃ©m esta cÃ³pia sÃ³ para o rodapÃ© da Ãºltima atualizaÃ§Ã£o
const finishedMatches = [...finishedMatchesChrono];

                
               // 1.1 Info RodapÃ© (Ãšltima AtualizaÃ§Ã£o Real)
                if (finishedMatches.length > 0) {
                    finishedMatches.sort((a, b) => {
                        const dateA = a.finishedAt ? a.finishedAt.toDate() : a.deadlineDate;
                        const dateB = b.finishedAt ? b.finishedAt.toDate() : b.deadlineDate;

                        // 1. TRUQUE DO LOTE: Arredonda para segundos para ignorar milissegundos
                        // Isso forÃ§a o EMPATE de tempo na "Baixa RÃ¡pida"
                        const timeA = Math.floor(dateA.getTime() / 1000);
                        const timeB = Math.floor(dateB.getTime() / 1000);

                        // Se os horÃ¡rios (segundos) forem diferentes, o mais recente ganha
                        if (timeB !== timeA) {
                            return timeB - timeA;
                        }

                        // 2. CRITÃ‰RIO DE DESEMPATE (Empate TÃ©cnico de HorÃ¡rio)
                        // AQUI ESTÃ O SEGREDO: Usamos o matchComparator INVERTIDO (b, a).
                        // O matchComparator define quem Ã© o #53 e quem Ã© o #54.
                        // Ao fazer (b, a), garantimos que o #54 fique acima do #53 na lista de "Recentes".
                        return matchComparator(b, a);
                    });

                    // Pega o campeÃ£o da ordenaÃ§Ã£o (o mais recente e com maior "nÃºmero")
                    const last = finishedMatches[0];
                    
                    const d = last.finishedAt ? last.finishedAt.toDate() : last.deadlineDate;
                    const dt = d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}) + " " + d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
                    
                    window.globalLastUpdateInfo = `Ãšltima atualizaÃ§Ã£o: ${dt}\n${last.teamA} x ${last.teamB}`;
                }
                // 2. PREPARAÃ‡ÃƒO DE USUÃRIOS (TIMELINE)
                const allGuesses = [];
gSnap.forEach(d => allGuesses.push(d.data()));

const guessesByUser = {};
const guessesByMatch = {};
const guessLookupByUserMatch = {};

allGuesses.forEach((guess) => {
  if (!guess?.userId || !guess?.matchId) return;

  if (!guessesByUser[guess.userId]) guessesByUser[guess.userId] = [];
  if (!guessesByMatch[guess.matchId]) guessesByMatch[guess.matchId] = [];

  guessesByUser[guess.userId].push(guess);
  guessesByMatch[guess.matchId].push(guess);
  guessLookupByUserMatch[`${guess.userId}__${guess.matchId}`] = guess;
});
                
                let users = [];
                uSnap.forEach(doc => {
                    const d = doc.data();
                    users.push({
                        uid: doc.id,
                        ...d,
                        createdDate: d.createdAt ? d.createdAt.toDate() : new Date(0) // 1970 se nulo
                    });
                });

                // =================================================================
                // 3. CÃLCULO DAS ZEBRAS (REGRA: <= 20% DOS VÃLIDOS NA Ã‰POCA)
                // =================================================================
                const zebraMatchIds = [];
                finishedMatches.forEach(m => {
                    // Filtra usuÃ¡rios que JÃ EXISTIAM na data desse jogo
                    const validUsersAtTime = users.filter(u => u.createdDate < m.deadlineDate).length;
                    
                    if (validUsersAtTime > 0) {
                        const winnerVotes = (guessesByMatch[m.id] || []).filter(g => g.teamSelected === m.winner).length;

if ((winnerVotes / validUsersAtTime) <= 0.20) {
  zebraMatchIds.push(m.id);
}
                    }
                });

                // =================================================================
// 4. BASE MENSAL (PARIDADE COM ANDROID)
// =================================================================
const now = new Date();
const currentYear = now.getFullYear();
const currentMonthIndex = now.getMonth();
const monthNames = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÃ‡O",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];
const monthlyHistory = [];
const pointsByMonth = {};
for (let i = 0; i < 12; i++) pointsByMonth[i] = {};

                // =================================================================
                // 5. CÃLCULO PRINCIPAL (PONTOS ATUAIS)
                // =================================================================
                let monthlyData = [];

                users.forEach((u) => {
  let p = 0,
    monthlyP = 0,
    victories = 0,
    finalsWon = 0,
    simStreak = 0;
  const d = u.debts || 0;
  const trophyRoom = [];
  const rawMedals = Array.isArray(u.medals) ? u.medals : [];
  const existingMedals = rawMedals.filter(
    (icon) =>
      !["ðŸ‘½", "ðŸ’Ž", "ðŸŽ¯", "ðŸ¦“", "ðŸ”¥", "ðŸ”®", "ðŸŽ“", "ðŸ¥¬", "ðŸ‘»"].includes(icon),
  );
  const activeMedals = [...existingMedals];
  const hist = [];
  const userGuesses = (guessesByUser[u.uid] || []).filter((g) =>
    validMatchIds.has(g.matchId),
  );
  const userGuessesMap = Object.fromEntries(
    userGuesses.map((g) => [g.matchId, g]),
  );

 // ORDENAÃ‡ÃƒO OFICIAL: usa a ordem cronolÃ³gica real, igual ao Android
const chronoMatches = finishedMatchesChrono;
  const cloneHistoryMedal = (medal) => ({
  icon: medal.icon,
  name: medal.name,
  desc: medal.desc,
  date: medal.date,
});

const registerMatchMedal = (medal) => {
  trophyRoom.push(medal);
  if (["ðŸ‘½", "ðŸ’Ž", "ðŸŽ¯", "ðŸ¦“", "ðŸ”¥", "ðŸ”®", "ðŸŽ“"].includes(medal.icon)) {
    activeMedals.push(medal.icon);
  }
};

const attachMedalToHistItem = (historyItemId, medal) => {
  if (!historyItemId) return;

  const target = hist.find((item) => item.id === historyItemId);
  if (!target) return;

  if (!Array.isArray(target.medalsHere)) {
    target.medalsHere = [];
  }

  target.medalsHere.push(cloneHistoryMedal(medal));
};

chronoMatches.forEach(m => {
  // Linha do Tempo: Ignora jogos antes do user nascer
  if (u.createdDate > m.deadlineDate) return;

  const g = userGuessesMap[m.id] || null;
  const isThisMonth = m.deadlineDate.getMonth() === currentMonthIndex && m.deadlineDate.getFullYear() === currentYear;
  const dateStr = `ðŸ“… ${m.deadlineDate.getDate()}/${m.deadlineDate.getMonth()+1}`;

  if (g) {
  if (m.winner === g.teamSelected) {
  const isFinal = m.round && m.round.toLowerCase() === "final";
  const pts = isFinal ? 6 : 3;
  const matchMonth = m.deadlineDate.getMonth();
  const matchYear = m.deadlineDate.getFullYear();

  p += pts;
  if (isThisMonth) monthlyP += pts;

  if (matchYear === currentYear) {
    pointsByMonth[matchMonth][u.uid] =
      (pointsByMonth[matchMonth][u.uid] || 0) + pts;
  }

  victories++;
  simStreak++;
  if (isFinal) finalsWon++;

  const medalsWonHere = [];
  const registerMatchMedalForHistory = (medal) => {
    registerMatchMedal(medal);
    medalsWonHere.push(cloneHistoryMedal(medal));
  };

  if (simStreak === 3)
    registerMatchMedalForHistory({
      icon: "ðŸ”¥",
      name: "ON FIRE",
      desc: "Palpitou 3 acertos seguidos.",
      date: dateStr,
      hiddenInList: false,
    });

  if (simStreak === 5)
    registerMatchMedalForHistory({
      icon: "ðŸŽ¯",
      name: "MITO",
      desc: "Palpitou 5 acertos seguidos.",
      date: dateStr,
      hiddenInList: false,
    });

  if (simStreak === 10)
    registerMatchMedalForHistory({
      icon: "ðŸ‘½",
      name: "ALIEN",
      desc: "Palpitou 10 acertos seguidos!",
      date: dateStr,
      hiddenInList: false,
    });

  if (zebraMatchIds.includes(m.id))
    registerMatchMedalForHistory({
      icon: "ðŸ¦“",
      name: "CAÃ‡ADOR DE ZEBRAS",
      desc: `Acertou a zebra em ${m.teamA} x ${m.teamB}`,
      date: dateStr,
      hiddenInList: false,
    });

  if (isFinal)
    registerMatchMedalForHistory({
      icon: "ðŸ”®",
      name: "MÃƒE DINAH",
      desc: `Cravou o campeÃ£o em ${m.teamA} x ${m.teamB}`,
      date: dateStr,
      hiddenInList: false,
    });

  if (victories > 0 && victories % 50 === 0)
    registerMatchMedalForHistory({
      icon: "ðŸŽ“",
      name: `VETERANO Nvl ${victories / 50}`,
      desc: `Conquistou ${victories} acertos.`,
      date: dateStr,
      hiddenInList: false,
    });

  hist.push({
  id: m.id,
  matchNumber: m.matchNumber || null,
  ts: m.deadlineDate,
  created: m.createdAt,
  text: `${dateStr} - âœ… Acerto ${m.teamA} x ${m.teamB}`,
  label: `${dateStr} - Acerto`,
  teamA: m.teamA,
  teamB: m.teamB,
  teamAUrl: m.teamAUrl || "",
  teamBUrl: m.teamBUrl || "",
  votedTeam: g.teamSelected || "",
  votedLogo: g.teamSelected === m.teamA
    ? (m.teamAUrl || "")
    : g.teamSelected === m.teamB
      ? (m.teamBUrl || "")
      : "",
  ptsEarned: pts,
  medalsHere: medalsWonHere,
  type: "good"
});

    } else {
  simStreak = 0;

      hist.push({
    id: m.id,
    matchNumber: m.matchNumber || null,
    ts: m.deadlineDate,
    created: m.createdAt,
    text: `${dateStr} - âŒ Errou ${m.teamA} x ${m.teamB}`,
    label: `${dateStr} - Errou`,
    teamA: m.teamA,
    teamB: m.teamB,
    teamAUrl: m.teamAUrl || "",
    teamBUrl: m.teamBUrl || "",
    votedTeam: g.teamSelected || "",
    votedLogo: g.teamSelected === m.teamA
        ? (m.teamAUrl || "")
        : g.teamSelected === m.teamB
            ? (m.teamBUrl || "")
            : "",
    ptsEarned: 0,
    type: 'bad'
});




    }

  } else {
  simStreak = 0;

    hist.push({
    id: m.id,
    matchNumber: m.matchNumber || null,
    ts: m.deadlineDate,
    created: m.createdAt,
    text: `${dateStr} - âšª NÃ£o votou ${m.teamA} x ${m.teamB}`,
    label: `${dateStr} - NÃ£o votou`,
    teamA: m.teamA,
    teamB: m.teamB,
    teamAUrl: m.teamAUrl || "",
    teamBUrl: m.teamBUrl || "",
    votedTeam: "",
    votedLogo: "",
    ptsEarned: 0,
    type: 'bad'
});



  }
});
                        const last3Matches = finishedMatchesDisplay.slice(0, 3);
if (last3Matches.length === 3) {
  let wrongCount = 0;
  let noVoteCount = 0;

  last3Matches.forEach((match) => {
    if (u.createdDate > match.deadlineDate) return;

    const guess = userGuessesMap[match.id] || null;
    if (!guess) noVoteCount++;
    else if (guess.teamSelected !== match.winner) wrongCount++;
  });

  if (wrongCount === 3) {
    activeMedals.push("ðŸ¥¬");
    trophyRoom.push({
      icon: "ðŸ¥¬",
      name: "MÃƒO DE ALFACE",
      desc: "Status Atual: Errou 3 palpites seguidos.",
      date: "Atual",
      hiddenInList: false,
    });
  }

  if (noVoteCount === 3) {
    activeMedals.push("ðŸ‘»");
    trophyRoom.push({
      icon: "ðŸ‘»",
      name: "FANTASMA",
      desc: "Status Atual: Esqueceu de votar em 3 seguidos.",
      date: "Atual",
      hiddenInList: false,
    });
  }
}

// Diamante
const oitavas = chronoMatches.filter((m) => m.round === "Oitavas de final");
const byComp = {};
oitavas.forEach((m) => {
  if (!byComp[m.competition]) byComp[m.competition] = [];
  byComp[m.competition].push(m);
});

for (const competitionName in byComp) {
  const competitionMatches = byComp[competitionName];
  if (competitionMatches.length === 8) {
    const hits = competitionMatches.filter(
      (match) => userGuessesMap[match.id]?.teamSelected === match.winner,
    ).length;

    if (hits === 8) {
      p += 3;

      const lastOitavaMatch =
        competitionMatches[competitionMatches.length - 1];
      const lastOitavaDate = lastOitavaMatch.deadlineDate;
      const bonusMonth = lastOitavaDate.getMonth();
      const bonusYear = lastOitavaDate.getFullYear();

      if (bonusMonth === currentMonthIndex && bonusYear === currentYear) {
        monthlyP += 3;
      }

      if (bonusYear === currentYear) {
        pointsByMonth[bonusMonth][u.uid] =
          (pointsByMonth[bonusMonth][u.uid] || 0) + 3;
      }

      const diamondMedal = {
  icon: "ðŸ’Ž",
  name: "DIAMANTE",
  desc: competitionName
    ? `Gabaritou as Oitavas (8/8) da ${competitionName}.`
    : "Gabaritou as Oitavas (8/8) de um torneio.",
  date: `ðŸ“… ${lastOitavaDate.getDate()}/${lastOitavaDate.getMonth() + 1}`,
  hiddenInList: false,
};

registerMatchMedal(diamondMedal);
attachMedalToHistItem(lastOitavaMatch?.id, diamondMedal);

hist.push({
  id: `diamante_${competitionName || "torneio"}`,
  ts: lastOitavaDate,
  text: `ðŸ’Ž BÃ”NUS: Gabarito Oitavas (+3 pts)`,
  type: "good",
});
    }
  }
}

// PatrÃ£o
const monthsNames = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

let allPaid = true;
if (currentYear >= 2026) {
  for (let i = 0; i <= currentMonthIndex; i++) {
    if (u.payments?.[monthsNames[i]] !== true) {
      allPaid = false;
      break;
    }
  }
} else if (d > 0) {
  allPaid = false;
}

if (allPaid) {
  activeMedals.push("ðŸ’°");
  trophyRoom.unshift({
    icon: "ðŸ’°",
    name: "PATRÃƒO",
    desc: "Mensalidades em dia.",
    date: monthsNames[currentMonthIndex],
    hiddenInList: false,
  });
}
                    // DÃ©bitos
                    if (d > 0) {
                        p -= (d * 3);
                        hist.push({ ts: new Date(), text: `ðŸ”» PENALIDADE: InadimplÃªncia (-${d*3} pts)`, type: 'bad' });
                    }

                    // Amauri (Oculto na lista, mas conta pro objeto)
                    if (u.username === 'amauri') trophyRoom.push({icon: "ðŸ†", name:"CampeÃ£o 2025", desc:"Lenda.", hiddenInList: true});

                    u.p = p;
u.medals = activeMedals;
u.trophyRoom = trophyRoom; 
                   // ORDENAÃ‡ÃƒO DO EXTRATO: Inversa Ã  lista de jogos (Mais recente no topo)
                    u.hist = hist.sort((a,b) => {
                        // 1. Data do Jogo (Decrescente)
                        const dateA = a.ts ? new Date(a.ts).getTime() : 0;
                        const dateB = b.ts ? new Date(b.ts).getTime() : 0;
                        if (dateA !== dateB) return dateB - dateA;

                        // 2. Data de CriaÃ§Ã£o (Decrescente - O jogo criado DEPOIS aparece EM CIMA)
                        let createdA = 0, createdB = 0;
                        if (a.created && a.created.seconds) createdA = a.created.seconds;
                        if (b.created && b.created.seconds) createdB = b.created.seconds;
                        if (createdA !== createdB) return createdB - createdA;

                        // 3. ID (Decrescente)
                        return b.id.localeCompare(a.id);
                    });
                    
                    monthlyData.push({ name: u.name, points: monthlyP, uid: u.uid });
                });

for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
  const ranking = users
    .map((u) => ({
      uid: u.uid,
      name: u.name || u.username || "Sem nome",
      points: pointsByMonth[monthIdx][u.uid] || 0,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return (a.name || "").localeCompare(b.name || "");
    });

  const maxScore = ranking[0]?.points || 0;
  const leaders = ranking.filter((entry) => entry.points === maxScore);
  const hasKing = maxScore > 0 && leaders.length === 1;

  if (hasKing) {
    const winnerId = leaders[0].uid;
    const winnerIndex = users.findIndex((user) => user.uid === winnerId);

    if (winnerIndex !== -1) {
      const winner = users[winnerIndex];

      if (!winner.medals.includes("ðŸ‘‘")) winner.medals.push("ðŸ‘‘");

      const crownName = `REI DE ${monthNames[monthIdx]}`;
      const alreadyHasThisCrown = winner.trophyRoom.some(
        (medal) => medal.icon === "ðŸ‘‘" && medal.name === crownName,
      );

      if (!alreadyHasThisCrown) {
        winner.trophyRoom.unshift({
          icon: "ðŸ‘‘",
          name: crownName,
          desc: `CampeÃ£o isolado do mÃªs (${maxScore} pts).`,
          date: String(currentYear),
          hiddenInList: false,
        });
      }
    }
  }

  monthlyHistory.push({
    monthIndex: monthIdx,
    monthName: monthNames[monthIdx],
    ranking,
    hasKing,
  });
}

                // =================================================================
                // 6. SORTING CRÃTICO (A LÃ“GICA DO ANDROID)
                // =================================================================
                // Ordem: Pontos > DÃ©bitos (Menor) > Alien > Diamante > Rei > Mito > Zebra > OnFire > Dinah > Veterano
                const medalHierarchy = ["ðŸ‘½", "ðŸ’Ž", "ðŸ‘‘", "ðŸŽ¯", "ðŸ¦“", "ðŸ”¥", "ðŸ”®", "ðŸŽ“"];

                users.sort((a, b) => {
                    // 1. Pontos (Maior primeiro)
                    if (b.p !== a.p) return b.p - a.p;
                    
                    // 2. DÃ©bitos (Menor primeiro - quem deve menos sobe)
                    if (a.debts !== b.debts) return (a.debts||0) - (b.debts||0);
                    
                    // 3. Medalhas (Hierarquia Estrita)
                    for (let icon of medalHierarchy) {
                        // Conta medalhas VISÃVEIS (ignora hiddenInList como o trofÃ©u do amauri se nÃ£o estiver na hierarquia)
                        const countA = (a.medals || []).filter((medalIcon) => medalIcon === icon).length;
const countB = (b.medals || []).filter((medalIcon) => medalIcon === icon).length;

  if (countB !== countA) return countB - countA; // Maior quantidade ganha
}
                    
                    // 4. Ordem AlfabÃ©tica (CritÃ©rio final de estabilidade)
                    return (a.name || "").localeCompare(b.name || "");
                });

                // Z-4 (ApÃ³s ordenaÃ§Ã£o final)
                if (users.length > 4) {
                    const z4StartIndex = users.length - 4;
                    for(let i = z4StartIndex; i < users.length; i++) {
                        if(users[i]) {
                             users[i].isZ4 = true;
if (!users[i].medals.includes("âš“")) users[i].medals.push("âš“");
users[i].trophyRoom.push({
  icon: "âš“",
  name: "ZONA DE REBAIXAMENTO",
  desc: "Z-4",
  date: "Atual",
  hiddenInList: false,
});
                        }
                    }
                }

                currentRankingData = users;

const currentMonthRanking = monthlyData.sort((a, b) => {
  if (b.points !== a.points) return b.points - a.points;
  return (a.name || "").localeCompare(b.name || "");
});

const currentMonthEntry = monthlyHistory.find((item) => item.monthIndex === currentMonthIndex);
const selectedKingMonth = Number(window.currentMonthlyRankingSelectedMonth);
const safeSelectedKingMonth =
  Number.isInteger(selectedKingMonth) && selectedKingMonth >= 0 && selectedKingMonth < 12
    ? selectedKingMonth
    : currentMonthIndex;

window.currentMonthlyRanking = [...(currentMonthEntry?.ranking || currentMonthRanking)];
window.currentMonthlyRankingHistory = [...monthlyHistory];
window.currentMonthlyRankingSelectedMonth = safeSelectedKingMonth;

const currentUserRankingEntry = currentUser ? users.find((u) => u.uid === currentUser.uid) : null;
const currentUserRankIndex = currentUserRankingEntry ? users.findIndex((u) => u.uid === currentUserRankingEntry.uid) : -1;
const currentUserMovementInfo = currentUserRankingEntry
  ? (rankingMovementSnapshot?.movements?.[currentUserRankingEntry.uid] || getRankingMovementInfo(currentUserRankingEntry.uid))
  : null;
const currentUserMovementDelta = Number(currentUserMovementInfo?.delta || 0);
const currentUserMovementText = currentUserRankingEntry
  ? (currentUserMovementInfo
    ? (currentUserMovementDelta > 0
      ? `â†‘ Subiu ${currentUserMovementDelta} ${currentUserMovementDelta > 1 ? "posiÃ§Ãµes" : "posiÃ§Ã£o"}`
      : currentUserMovementDelta < 0
        ? `â†“ Caiu ${Math.abs(currentUserMovementDelta)} ${Math.abs(currentUserMovementDelta) > 1 ? "posiÃ§Ãµes" : "posiÃ§Ã£o"}`
        : Number(currentUserMovementInfo?.previousPosition || 0) > 0
          ? "â†” Sem mudanÃ§a"
          : "Sem histÃ³rico de movimentaÃ§Ã£o")
    : "Movimento ainda nÃ£o disponÃ­vel")
  : "";
const currentUserDisplayName = currentUserRankingEntry?.name || currentUserRankingEntry?.username || "Sem nome";
const currentUserPositionText = currentUserRankingEntry && currentUserRankIndex >= 0
  ? `VocÃª estÃ¡ em ${currentUserRankIndex + 1}Âº`
  : "Sua posiÃ§Ã£o ainda nÃ£o estÃ¡ disponÃ­vel.";

// Renderiza HTML
let html = `
  <div class="ranking-hero mb-4">
    <div class="ranking-hero__bg"></div>
    <div class="ranking-hero__content">
      <div>
        <h3 class="ranking-hero__title">CLASSIFICACAO</h3>
        <p class="ranking-hero__subtitle">Temporada 2026 â€¢ ${users.length} participantes</p>
      </div>

      <div class="ranking-hero__actions">
        <button
          onclick="showKingModal()"
          aria-label="Rei do mes"
          title="Rei do mes"
          class="ranking-hero__btn ranking-hero__btn--king btn-press"
        >
          <i class="fas fa-trophy"></i>
        </button>

        <button
          onclick="openRankingInfo()"
          aria-label="Sobre o ranking"
          title="Sobre o ranking"
          class="ranking-hero__btn ranking-hero__btn--info btn-press"
        >
          <i class="fas fa-info"></i>
        </button>
      </div>
    </div>
  </div>

  <div class="ranking-my-position mb-3">
    <div class="ranking-my-position__eyebrow">VocÃª no ranking</div>
    ${
      currentUserRankingEntry && currentUserRankIndex >= 0
        ? `
          <div class="ranking-my-position__main">
            <div class="ranking-my-position__title">${escapeHtml(currentUserPositionText)}</div>
            <div class="ranking-my-position__line">${escapeHtml(currentUserDisplayName)}</div>
            <div class="ranking-my-position__movement">${escapeHtml(currentUserMovementText)}</div>
          </div>
        `
        : `<div class="ranking-my-position__empty">Sua posiÃ§Ã£o ainda nÃ£o estÃ¡ disponÃ­vel.</div>`
    }
  </div>

  <div class="ranking-table-shell">
    <div class="ranking-table-head">
      <span>Posicao</span>
      <span>Participante</span>
      <span class="text-center">Dividas</span>
      <span class="text-right">Pontos</span>
    </div>
    <div class="ranking-table-body">
`;

                html += users.map((u, i) => {
                    const pos = i + 1;
                    let rowClass = "";
                    let posIcon = `<span class="ranking-pos-plain">${pos}Âº</span>`;
                    let nameClass = "ranking-name";
                    let avatarClass = "ranking-avatar";
                    const isMe = currentUser && u.uid === currentUser.uid;

                    if (i === 0) { rowClass = "ranking-row--gold"; posIcon = "ðŸ¥‡"; avatarClass += " ranking-avatar--gold"; }
                    else if (i === 1) { rowClass = "ranking-row--silver"; posIcon = "ðŸ¥ˆ"; avatarClass += " ranking-avatar--silver"; }
                    else if (i === 2) { rowClass = "ranking-row--bronze"; posIcon = "ðŸ¥‰"; avatarClass += " ranking-avatar--bronze"; }
                    else if (i === 3 || i === 4) { rowClass = "ranking-row--top5"; }
                    if (u.isZ4) { rowClass += " ranking-row--z4"; nameClass += " ranking-name--danger"; }
                    if (isMe) { rowClass += " ranking-row--me"; nameClass += " ranking-name--me"; }

                    let medalsHtml = "";
                    const counts = {};
(u.medals || []).forEach(
  (icon) => (counts[icon] = (counts[icon] || 0) + 1),
);

                    const visualHierarchy = ["ðŸ†", ...medalHierarchy, "ðŸ’°", "ðŸ‘»", "ðŸ¥¬", "âš“"];
                    const orderedIcons = Object.keys(counts).sort((a,b) => {
                        let idxA = visualHierarchy.indexOf(a); if(idxA === -1) idxA = 99;
                        let idxB = visualHierarchy.indexOf(b); if(idxB === -1) idxB = 99;
                        return idxA - idxB;
                    });
                    const uniqueIcons = orderedIcons;

                    if (uniqueIcons.length > 0) {
                        medalsHtml = `<div class="ranking-medals">` +
                            uniqueIcons.map(icon => {
                              const count = counts[icon] || 0;
                              const isSuperMedal = count >= 10;
                              return `<span class="ranking-medal-chip ${isSuperMedal ? "super-medal" : ""}">${icon}${count > 1 ? `<span class="ranking-medal-count">${count}</span>` : ""}</span>`;
                            }).join("") +
                        `</div>`;
                    }

                    const movementInfo = rankingMovementSnapshot?.movements?.[u.uid] || getRankingMovementInfo(u.uid);
                    const movementDelta = Number(movementInfo?.delta || 0);
                    const hasMovementHistory = Number(movementInfo?.previousPosition || 0) > 0;
                    let diffHtml = `<div class="ranking-move ranking-move--neutral">â€“</div>`;
                    if (movementDelta > 0) diffHtml = `<div class="ranking-move ranking-move--up"><i class="fas fa-caret-up"></i> ${movementDelta}</div>`;
                    else if (movementDelta < 0) diffHtml = `<div class="ranking-move ranking-move--down"><i class="fas fa-caret-down"></i> ${Math.abs(movementDelta)}</div>`;
                    else if (hasMovementHistory) diffHtml = `<div class="ranking-move ranking-move--same">=</div>`;

                    return `<div class="ranking-row ${rowClass}">
                        <div class="ranking-row__pos">
                          <div class="ranking-pos-badge">${posIcon}</div>
                          ${diffHtml}
                        </div>

                        <div class="ranking-row__user" onclick="showModalPhoto(${i})">
                            <div class="${avatarClass}"><img src="${getAvatarUrl(u.photoBase64, u.name)}" class="w-full h-full object-cover"></div>
                            <div class="ranking-user-meta">
                                <div class="flex items-center gap-2 flex-wrap">
                                  <span class="${nameClass}">${escapeHtml(u.name || u.username || "Sem nome")}</span>
                                  ${isMe ? '<span class="ranking-you-badge">VocÃª</span>' : ""}
                                </div>
                            </div>
                        </div>

                        <div class="ranking-row__medals">
                          ${medalsHtml || '<div class="ranking-medals-empty">Sem medalhas</div>'}
                        </div>

                        <button type="button" class="ranking-row__debt ${u.debts > 0 ? 'is-debt' : ''}" onclick="showModalHistory(${i})">${u.debts||0}</button>
                        <button type="button" class="ranking-row__points" onclick="showModalHistory(${i})">${u.p}</button>
                    </div>`;
                }).join('');

                html += `</div></div>`;
                listContainer.innerHTML = html;
                listContainer.scrollTop = 0;
                if (appContent) appContent.scrollTop = 0;

window.__rankingScreenCache = {
  html,
  footerHtml: footer.innerHTML,
  currentRankingData: [...users],
  currentMonthlyRanking: [...window.currentMonthlyRanking],
  currentMonthlyRankingHistory: [...window.currentMonthlyRankingHistory],
  currentMonthlyRankingSelectedMonth: window.currentMonthlyRankingSelectedMonth,
  rankingMovementSnapshot: rankingMovementSnapshot ? JSON.parse(JSON.stringify(rankingMovementSnapshot)) : { positions: {}, movements: {} },
  lastUpdateInfo: window.globalLastUpdateInfo,
  cachedAt: Date.now()
};

            } catch (e) { console.error(e); listContainer.innerHTML = `<div class="text-center text-red-500 text-xs">Erro ao carregar ranking.</div>`; listContainer.scrollTop = 0; if (appContent) appContent.scrollTop = 0; }
        }
        // ===============================
// NOVO "i" DO RANKING (igual Android) â€” mantÃ©m o mesmo nome para nÃ£o quebrar chamadas
// ===============================
window.openRankingInfo = () => {
  window.openRankingInfoModal(window.globalLastUpdateInfo || "");
};

window.openRankingInfoModal = (lastUpdateInfoText = "") => {
  const medalInfos = [
    { icon: "ðŸ‘½", name: "Alien", how: "10 acertos seguidos.", order: 1 },
    { icon: "ðŸ’Ž", name: "Diamante", how: "Gabaritar as Oitavas (8/8).", order: 2 },
    { icon: "ðŸ‘‘", name: "Rei do MÃªs", how: "LÃ­der da pontuaÃ§Ã£o no mÃªs vigente.", order: 3 },
    { icon: "ðŸŽ¯", name: "Mito", how: "5 acertos seguidos.", order: 4 },
    { icon: "ðŸ¦“", name: "CaÃ§ador de Zebras", how: "Acertar um jogo em que 80% ou mais erraram ou nÃ£o votaram.", order: 5 },
    { icon: "ðŸ”¥", name: "On Fire", how: "3 acertos seguidos.", order: 6 },
    { icon: "ðŸ”®", name: "MÃ£e Dinah", how: "Acertar o campeÃ£o na final.", order: 7 },
    { icon: "ðŸŽ“", name: "Veterano", how: "A cada 50 vitÃ³rias acumuladas.", order: 8 },
    { icon: "ðŸ’°", name: "PatrÃ£o", how: "Mensalidade rigorosamente em dia.", order: 9 },
    { icon: "ðŸ‘»", name: "Fantasma", how: "Deixar de votar em 3 jogos seguidos.", order: 10 },
    { icon: "ðŸ¥¬", name: "MÃ£o de Alface", how: "Errar 3 palpites seguidos.", order: 11 },
    { icon: "âš“", name: "Zona de Rebaixamento", how: "Os 4 Ãºltimos colocados.", order: 12 },
  ];

  const medalRows = medalInfos.map((medal) => `
    <div class="ranking-info-medal">
      <div class="ranking-info-medal__icon">${medal.icon}</div>
      <div class="ranking-info-medal__body">
        <div class="ranking-info-medal__name">${escapeHtml(medal.name)}</div>
        <div class="ranking-info-medal__desc">${escapeHtml(medal.how)}</div>
      </div>
    </div>
  `).join("");

  const html = `
    <div class="w-full max-w-sm rounded-none shadow-2xl overflow-hidden text-white" style="max-height: 90vh; overflow-y: auto; background: linear-gradient(180deg, #071018 0%, #0b1622 50%, #071018 100%);">
      <div class="p-5">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2">
              <i class="fas fa-info-circle text-[#38BDF8]"></i>
              <div class="font-black uppercase tracking-wider text-lg">INFORMAÃ‡Ã•ES DO RANKING</div>
            </div>
            <div class="text-[10px] font-bold text-white/60 uppercase tracking-wider">Ãšltima AtualizaÃ§Ã£o</div>
          </div>

          <button onclick="window.closeModal()" class="text-white/80 hover:text-white">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="mt-3 rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <div class="text-sm font-black text-[#F472B6] leading-snug whitespace-pre-line">
            ${lastUpdateInfoText || "Carregando..."}
          </div>
        </div>

        <div class="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <div class="text-xs font-black text-[#A78BFA] uppercase tracking-wider">Como o ranking funciona</div>
          <div class="mt-3 space-y-2 text-xs font-bold text-white/80 leading-snug">
            <div>â€¢ Pontos: total acumulado no BolÃ£o.</div>
            <div>â€¢ DÃ­vidas: mensalidades pendentes.</div>
            <div>â€¢ Setas: indicam subida, queda ou permanÃªncia na posiÃ§Ã£o.</div>
            <div>â€¢ AtualizaÃ§Ã£o: ocorre apÃ³s baixa de resultados e sincronizaÃ§Ã£o do sistema.</div>
            <div>â€¢ Rei do MÃªs: lÃ­der da pontuaÃ§Ã£o no mÃªs vigente.</div>
          </div>
        </div>

        <div class="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <div class="text-xs font-black text-[#FDE68A] uppercase tracking-wider">Medalhas</div>
          <div class="text-[10px] font-bold text-white/60 uppercase tracking-wider mt-1">Ordem de importÃ¢ncia: da mais valiosa para a menos valiosa.</div>
          <div class="mt-3 space-y-3">
            ${medalRows}
          </div>
        </div>

        <button onclick="window.closeModal()" class="w-full mt-5 bg-[#0B5F2A] text-white font-black py-3 rounded shadow-lg btn-press text-sm">
          ENTENDI
        </button>
      </div>
    </div>
  `;

  // usa a infra do seu site (modalOverlay + modalContainer)
  window.openModal(html);
};

window.selectKingMonth = (monthIndex) => {
  window.currentMonthlyRankingSelectedMonth = Number(monthIndex);
  window.showKingModal();
};

window.showKingModal = () => {
  const modal = document.getElementById("modalOverlay");
  const cont = document.getElementById("modalContainer");
  modal.classList.remove("hidden");

  const monthHistory = window.currentMonthlyRankingHistory || [];
  const fallbackMonthIndex = new Date().getMonth();

  const selectedMonthIndex = Number.isInteger(window.currentMonthlyRankingSelectedMonth)
    ? window.currentMonthlyRankingSelectedMonth
    : fallbackMonthIndex;

  const fallbackMonthNames = [
    "JANEIRO", "FEVEREIRO", "MARÃ‡O", "ABRIL", "MAIO", "JUNHO",
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
  ];

  const selectedMonth =
    monthHistory.find(item => item.monthIndex === selectedMonthIndex) ||
    monthHistory[monthHistory.length - 1] || {
      monthIndex: fallbackMonthIndex,
      monthName: fallbackMonthNames[fallbackMonthIndex],
      ranking: [],
      hasKing: false
    };

  const ranking = Array.isArray(selectedMonth.ranking) ? selectedMonth.ranking : [];
  const hasKing = !!selectedMonth.hasKing;

  const monthTabsHtml = monthHistory.map(item => {
    const isActive = item.monthIndex === selectedMonth.monthIndex;

    return `
      <button
        onclick="selectKingMonth(${item.monthIndex})"
        class="px-3 py-2 rounded-full border text-[11px] font-black whitespace-nowrap ${
          isActive
            ? "bg-[#006400] text-white border-[#006400]"
            : "bg-white text-[#006400] border-green-200"
        }"
      >
        ${item.monthName.slice(0, 3)}
      </button>
    `;
  }).join("");

  let listHtml = "";
  if (ranking.length === 0 || ranking.every(u => (u.points || 0) === 0)) {
    listHtml = `
      <div class="bg-white rounded-2xl border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
        Nenhum ponto marcado neste mÃªs ainda.
      </div>
    `;
  } else {
    listHtml = ranking.map((u, i) => {
      const isKingRow = i === 0 && hasKing;
      const bg = isKingRow ? "bg-[#FFF9C4]" : "bg-white";
      const icon = isKingRow ? "ðŸ‘‘ " : "";
      const bold = isKingRow ? "font-black" : "font-normal";
      const color = isKingRow ? "text-[#006400]" : "text-black";

      return `
        <div class="${bg} border border-gray-200 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-8 text-sm font-black text-gray-500">${i + 1}Âº</div>
            <div class="truncate text-sm ${bold} ${color}">${icon}${u.name}</div>
          </div>
          <div class="text-sm font-black ${color}">${u.points}</div>
        </div>
      `;
    }).join("");
  }

  cont.innerHTML = `
    <div class="w-full max-w-md mx-auto bg-[#F9FFF4] rounded-[28px] border-[3px] border-[#006400] shadow-2xl overflow-hidden">
      <div class="relative px-5 pt-5 pb-4 text-center bg-gradient-to-b from-[#006400] to-[#0B7A0B] text-white">
        <img src="bg_ranking.png" class="absolute inset-0 w-full h-full object-cover opacity-10" />
        <div class="relative z-10">
          <h3 class="text-2xl font-black tracking-wide">ðŸ‘‘ REI DE ${selectedMonth.monthName}</h3>
          <p class="text-xs font-semibold text-white/80 mt-1">ClassificaÃ§Ã£o mensal</p>
        </div>
      </div>

      <div class="px-4 pt-4">
        <div class="flex gap-2 overflow-x-auto pb-2">
          ${monthTabsHtml}
        </div>
      </div>

      <div class="px-4 py-4 space-y-3 max-h-[58vh] overflow-y-auto">
        <div class="grid grid-cols-[1fr_56px] gap-2 px-2 text-[11px] font-black text-gray-500 uppercase">
          <div>Participante</div>
          <div class="text-right">Pts</div>
        </div>

        ${listHtml}
      </div>

      <div class="px-4 pb-4 pt-2">
        <button onclick="closeModal()" class="w-full py-3 rounded-2xl bg-[#006400] text-white font-black shadow-lg">
          FECHAR
        </button>
      </div>
    </div>
  `;
};

       window.showModalPhoto = (idx) => { 
            const u = currentRankingData[idx]; 
            document.getElementById('modalOverlay').classList.remove('hidden'); 
            const scoutClass = appConfig.scout ? "flex" : "hidden";
            
            // CORREÃ‡ÃƒO 1: Mudado de u.photo para u.photoBase64
            let imageContent = `<img src="${getAvatarUrl(u.photoBase64, u.name)}" class="w-full h-full object-contain bg-black">`;
            
            // --- LÃ“GICA DE STACKING E ORDENAÃ‡ÃƒO DE MEDALHAS ---
            let medalsHtml = "";
            if (u.trophyRoom && u.trophyRoom.length > 0) {
                // 1. Ordem de prioridade (TROFÃ‰U ADICIONADO NO INÃCIO)
                const priorityOrder = ["ðŸ†", "ðŸ‘½", "ðŸ’Ž", "ðŸ‘‘", "ðŸŽ¯", "ðŸ¦“", "ðŸ”¥", "ðŸ”®", "ðŸŽ“", "ðŸ’°", "ðŸ‘»", "ðŸ¥¬"];

                
                // 2. Ordena
                u.trophyRoom.sort((a,b) => {
                    const idxA = priorityOrder.indexOf(a.icon);
                    const idxB = priorityOrder.indexOf(b.icon);
                    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
                });

                // 3. Agrupa por nome
                const grouped = {};
                u.trophyRoom.forEach(m => {
                    if (!grouped[m.name]) grouped[m.name] = [];
                    grouped[m.name].push(m);
                });

                // 4. Gera HTML
                for (const [name, medals] of Object.entries(grouped)) {
                    const count = medals.length;
                    const first = medals[0];
                    const isLegendary = count >= 10;

                    let badgeHtml = "";
if (count > 1) {
  const badgeText = count >= 10 ? `${count}` : `x${count}`;
  badgeHtml = `
    <span class="medal-count-badge ${isLegendary ? "super-medal" : ""}">
      ${badgeText}
    </span>
  `;
}

                    
                    // Click: Se > 1 abre lista, senÃ£o Toast
                    const clickAction = count > 1 
                        ? `showMedalList('${name}')` 
                        : `showToast('${first.name}', '${first.desc}', '${first.date}')`;

                    medalsHtml += `
                        <div class="relative inline-flex items-center justify-center mx-1 my-1 cursor-pointer hover:scale-110 transition-transform select-none group ${isLegendary ? "super-medal" : ""}" onclick="${clickAction}">
                            ${badgeHtml}
                            <span class="text-4xl drop-shadow-sm">${first.icon}</span>
                        </div>
                    `;
                }
            } else {
                medalsHtml = `<span class="text-xs text-gray-400 italic">Ainda nÃ£o possui trofÃ©us.</span>`;
            }
            // ----------------------------------------------------

            const isMe = currentUser && currentUser.uid === u.uid;
            const compareBtnClass = isMe ? "hidden" : "";
               
            document.getElementById('modalContainer').innerHTML = `
                <div class="w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden relative" id="profileModal" data-uid="${u.uid}">
                    <img src="bg_dialog_foto.png" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover opacity-100">
                    <div class="relative z-10 p-6 text-center flex flex-col items-center max-h-[85vh] overflow-y-auto">
                        <h3 class="font-bold uppercase text-[#006400] mb-4 text-xl tracking-wider">${u.name}</h3>
                        <div class="border-4 border-[#FFD700] rounded-2xl overflow-hidden shadow-2xl bg-black w-[240px] h-[240px] flex items-center justify-center mb-6 relative">
                            ${imageContent}
                            <div class="absolute inset-0 border border-white/20 rounded-xl pointer-events-none"></div>
                        </div>
                        <div class="w-full mb-4">
                            <div class="bg-gradient-to-r from-[#FFD700] via-[#FDB931] to-[#FFD700] border-y-2 border-[#B8860B] shadow-lg p-2 mb-3 transform skew-x-[-5deg]">
                                <p class="text-[12px] text-[#3E2723] font-black uppercase tracking-[0.2em] transform skew-x-[5deg]">âœ¨ Sala de TrofÃ©us âœ¨</p>
                            </div>
                            <div class="flex flex-wrap justify-center py-2 px-2 min-h-[60px]">
                                ${medalsHtml}
                            </div>
                            <p class="text-[9px] text-gray-500 mt-1 font-bold">(Toque na medalha para ver detalhes)</p>
                        </div>
                        <div id="medalToast" class="medal-toast"></div>
                        <div class="w-full space-y-2 mt-4">
  <!-- 1) VER ESTATÃSTICAS -->
  <button id="btnStatsAction" class="${scoutClass} w-full bg-black border border-[#FFD700] text-[#FFD700] font-bold py-3 rounded shadow-lg items-center justify-center gap-2 btn-press">
    <i class="fas fa-chart-pie"></i> VER ESTATÃSTICAS
  </button>

  <!-- 2) COMPARAR PALPITES -->
  <button id="btnCompareAction" class="${compareBtnClass} w-full bg-[#1565C0] text-white font-bold py-3 rounded shadow-lg btn-press flex items-center justify-center gap-2">
    <i class="fas fa-exchange-alt"></i> COMPARAR PALPITES
  </button>

  <!-- 3) GERAR CARD INSTAGRAM -->
  <button id="btnInstaAction" onclick="window.generateWebCard()" class="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 rounded shadow-lg flex items-center justify-center gap-2 btn-press">
    <i class="fab fa-instagram text-xl"></i> GERAR CARD INSTAGRAM
  </button>

  <!-- 4) FECHAR -->
  <button onclick="closeModal()" class="w-full bg-[#006400] text-white font-bold py-3 rounded shadow-lg btn-press uppercase text-xs mt-2">FECHAR</button>
</div>

                    </div>
                </div>`;
            
            // CORREÃ‡ÃƒO 2: Mudado de u.photo para u.photoBase64 aqui tambÃ©m para o botÃ£o do scout
            const btnStats = document.getElementById('btnStatsAction'); if (btnStats) btnStats.onclick = () => window.showPlayerScout(u.uid, u.name, u.photoBase64);
            const btnCompare = document.getElementById('btnCompareAction'); if (btnCompare && !isMe) btnCompare.onclick = () => window.compareGuesses(u.uid, u.name);
        };

        // --- NOVA FUNÃ‡ÃƒO PARA LISTA DE MEDALHAS (STACKING) COM FUNDO ---
        window.showMedalList = (medalName) => {
            // Recupera o usuÃ¡rio atual do modal aberto (usando o ID salvo no atributo data-uid)
            const modalEl = document.getElementById('profileModal');
            if(!modalEl) return;
            const uid = modalEl.getAttribute('data-uid');
            const u = currentRankingData.find(user => user.uid === uid);
            if(!u) return;

            const medals = u.trophyRoom.filter(m => m.name === medalName);
            if(medals.length === 0) return;
            
            const first = medals[0];
            
            // Salva o conteÃºdo anterior para o botÃ£o voltar funcionar
            const oldContent = document.getElementById('modalContainer').innerHTML;
            
            const listHtml = medals.map(m => `
                <div class="bg-white/90 border border-gray-200 rounded p-3 mb-2 flex flex-col items-center text-center shadow-sm">
                    <p class="text-xs font-bold text-black">${m.desc}</p>
                    <div class="flex items-center mt-1 text-[#EF6C00]">
                        <i class="fas fa-calendar-alt text-[10px] mr-1"></i>
                        <span class="text-[10px] font-bold">Conquistado em: ${m.date}</span>
                    </div>
                </div>
            `).join('');

            document.getElementById('modalContainer').innerHTML = `
                <div class="w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden h-[400px] flex flex-col relative">
                    <img src="bg_perfil.png" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover opacity-15 pointer-events-none">

                    <div class="relative z-10 bg-white/80 p-4 border-b flex flex-col items-center">
                        <span class="text-5xl mb-2">${first.icon}</span>
                        <h3 class="font-black text-[#006400] text-lg uppercase">${first.name}</h3>
                        <p class="text-xs text-gray-400">HistÃ³rico de Conquistas</p>
                    </div>
                    
                    <div class="relative z-10 flex-1 overflow-y-auto p-4">
                        ${listHtml}
                    </div>
                    
                    <div class="relative z-10 p-3 border-t bg-white">
                        <button id="btnBackMedal" class="w-full bg-[#006400] text-white py-3 rounded font-bold shadow btn-press">VOLTAR</button>
                    </div>
                </div>
            `;
            
            document.getElementById('btnBackMedal').onclick = () => {
                // ReconstrÃ³i o modal do perfil
                const idx = currentRankingData.findIndex(x => x.uid === uid);
                window.showModalPhoto(idx);
            };
        };

        // FunÃ§Ã£o auxiliar para mostrar o Toast
        window.showToast = (title, desc, date) => {
            const toast = document.getElementById('medalToast');
            if (!toast) return;
            
            let html = `<span class="text-[#FFD700]">${title}</span><br><span class="font-normal">${desc}</span>`;
    if(date && date !== 'undefined' && date !== 'null') { // <--- ADD ESSA LINHA
        html += `<br><span class="text-[9px] text-gray-400 font-bold mt-1 block">Conquistado em: ${date}</span>`;
    }
            
            toast.innerHTML = html;
            toast.classList.add('show');
            
            if (window.toastTimeout) clearTimeout(window.toastTimeout);
            window.toastTimeout = setTimeout(() => {
                toast.classList.remove('show');
            }, 2500);
        };
        
window.__extractMedalsCache = {};

window.openExtractMedalsInline = (cacheKey) => {
  const data = window.__extractMedalsCache?.[cacheKey];
  const overlay = document.getElementById("extractMedalsInlineOverlay");
  const titleEl = document.getElementById("extractMedalsInlineTitle");
  const bodyEl = document.getElementById("extractMedalsInlineBody");

  if (!data || !overlay || !titleEl || !bodyEl) return;

  titleEl.textContent = data.title || "Confronto";
  bodyEl.innerHTML = (data.medals || [])
    .map((medal) => `
      <div class="w-full rounded-2xl border border-gray-200 bg-[#F8F9FA] p-3">
        <div class="flex items-start gap-3">
          <div class="text-[24px] leading-none">${escapeHtml(medal.icon || "")}</div>
          <div class="min-w-0 flex-1">
            <div class="text-[13px] font-black text-[#006400]">${escapeHtml(medal.name || "")}</div>
            <div class="mt-1 text-[12px] font-medium text-gray-700">${escapeHtml(medal.desc || "")}</div>
            <div class="mt-2 text-[10px] font-bold text-gray-400">Conquistada em: ${escapeHtml(medal.date || "")}</div>
          </div>
        </div>
      </div>
    `)
    .join("");

  overlay.classList.remove("hidden");
};

window.closeExtractMedalsInline = () => {
  const overlay = document.getElementById("extractMedalsInlineOverlay");
  const titleEl = document.getElementById("extractMedalsInlineTitle");
  const bodyEl = document.getElementById("extractMedalsInlineBody");

  if (titleEl) titleEl.textContent = "";
  if (bodyEl) bodyEl.innerHTML = "";
  if (overlay) overlay.classList.add("hidden");
};

       window.showModalHistory = (idx) => { 
            const u = currentRankingData[idx]; 
            if(!u) return;
               // Guarda de qual extrato estamos vindo (para o botÃ£o VOLTAR no modal de palpites)
window.__fromHistoryIdx = idx;
window.__fromHistoryUid = u.uid;
window.__extractMedalsCache = {};
            
           const html = u.hist && u.hist.length > 0 ? u.hist.map((h, histIndex) => {
    const colorClass = h.type === 'bad' ? 'text-red-600' : 'text-[#2E7D32]';

    // SÃ³ deixa clicÃ¡vel se tiver id de match e nÃ£o for item especial
    const isMatch = h.id && !String(h.id).startsWith('diamante_');

    if (!isMatch) {
        return `<div class="border-b border-gray-300/50 py-2 text-xs font-bold ${colorClass}">${h.text}</div>`;
    }

    const votedA = (h.votedTeam || "") === (h.teamA || "");
const votedB = (h.votedTeam || "") === (h.teamB || "");

const teamALogo = h.teamAUrl
    ? `<img src="${h.teamAUrl}" class="extract-team-logo w-9 h-9 object-contain bg-white rounded-full border border-gray-200 p-0.5">`
    : `<span class="extract-team-fallback text-[10px] font-black text-gray-500 text-center leading-tight">${h.teamA || ''}</span>`;

const teamBLogo = h.teamBUrl
    ? `<img src="${h.teamBUrl}" class="extract-team-logo w-9 h-9 object-contain bg-white rounded-full border border-gray-200 p-0.5">`
    : `<span class="extract-team-fallback text-[10px] font-black text-gray-500 text-center leading-tight">${h.teamB || ''}</span>`;


const dateText = h.ts instanceof Date
    ? h.ts.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : '';

const isNoVote = (h.label || '').toLowerCase().includes('nÃ£o votou');
const isHit = h.type === 'good' && !isNoVote;
const ptsEarned = Number(h.ptsEarned || 0);
const ptsText = `${ptsEarned > 0 ? '+' : ''}${ptsEarned}`;
const ptsColor = ptsEarned > 0 ? 'text-[#2E7D32]' : 'text-gray-400';

const resultIcon = isHit
    ? `<i class="fas fa-check text-black text-[18px] extract-result-icon"></i>`
    : `<i class="fas fa-times text-black text-[18px] extract-result-icon"></i>`;

const rowBg = isHit ? 'bg-[#EEF6EC]' : 'bg-[#F7EAEA]';
const matchNo = h.matchNumber ? `#${h.matchNumber}` : '';

const medalsWonHere = Array.isArray(h.medalsHere) ? h.medalsHere : [];
const matchTitleText = [h.teamA, h.teamB].filter(Boolean).join(' x ') || (h.label || '');
const medalCacheKey = `${u.uid}_${String(h.id || histIndex).replace(/[^a-zA-Z0-9_-]/g, '_')}_${histIndex}`;

if (medalsWonHere.length > 0) {
  window.__extractMedalsCache[medalCacheKey] = {
    title: matchTitleText,
    medals: medalsWonHere.map((medal) => ({ ...medal })),
  };
}

const medalBadgeHtml = `
  <div class="extract-col-medal">
    ${medalsWonHere.length > 0
      ? `
        <button
          type="button"
          onclick="event.stopPropagation(); window.openExtractMedalsInline('${medalCacheKey}')"
          class="extract-medal-btn"
          title="Ver medalhas deste confronto"
        >
          <span class="text-[12px] leading-none">ðŸ…</span>
          ${medalsWonHere.length > 1
            ? `<span class="extract-medal-count">${medalsWonHere.length}</span>`
            : ``
          }
        </button>
      `
      : ``
    }
  </div>
`;


return `
    <div
        role="button"
        tabindex="0"
        onclick="window.goToMatchRegisteredBets('${String(h.id).replace(/'/g, "\\'")}', window.__fromHistoryIdx)"
        onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); window.goToMatchRegisteredBets('${String(h.id).replace(/'/g, "\\'")}', window.__fromHistoryIdx); }"
        class="extract-match-card w-full text-left mb-2 rounded-2xl border border-gray-200 ${rowBg} px-3 py-3 hover:bg-black/5 active:bg-black/10 transition cursor-pointer"
        title="Abrir palpites registrados deste confronto"
    >
        <div class="extract-row-grid">
            <div class="extract-col-status">
                <div class="extract-date">${dateText}</div>
                <div class="extract-result-wrap">
                    ${resultIcon}
                </div>
            </div>

            <div class="extract-col-match">
                <div class="extract-match-layout">
                    <div class="extract-team-slot">
                        <div class="extract-team-circle ${votedA ? 'ring-2 ring-[#FFD700] bg-yellow-50' : ''}">
                            ${teamALogo}
                        </div>
                        <div class="extract-vote-slot">
                            ${votedA
                                ? `<span class="extract-vote-tag">SEU VOTO</span>`
                                : ``
                            }
                        </div>
                    </div>

                    <span class="extract-versus">X</span>

                    <div class="extract-team-slot">
                        <div class="extract-team-circle ${votedB ? 'ring-2 ring-[#FFD700] bg-yellow-50' : ''}">
                            ${teamBLogo}
                        </div>
                        <div class="extract-vote-slot">
                            ${votedB
                                ? `<span class="extract-vote-tag">SEU VOTO</span>`
                                : ``
                            }
                        </div>
                    </div>

                    <div class="extract-match-no">
                        <span class="extract-match-no-text">${matchNo}</span>
                    </div>
                </div>
            </div>

            ${medalBadgeHtml}

            <div class="extract-col-points">
                <div class="extract-points-value ${ptsColor}">${ptsText}</div>
                <div class="extract-points-unit ${ptsColor}">pts</div>
            </div>
        </div>
    </div>
`;

}).join('') : `<div class="text-center py-4 text-gray-400 text-xs">Nenhum registro encontrado.</div>`;



            
            document.getElementById("modalOverlay").classList.remove("hidden");
document.getElementById("modalContainer").innerHTML = `
    <div class="w-[min(94vw,430px)] max-w-md bg-white rounded-none shadow-2xl overflow-hidden relative">
        <img src="bg_dialog_extrato.jpeg" class="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none z-0" onerror="this.style.display='none'">

        <div class="relative z-10 px-3 sm:px-4 pt-4 pb-3 flex flex-col items-stretch h-[78vh]">
            <i class="fas fa-file-invoice-dollar text-[#006400] text-2xl mb-1 self-center"></i>

            <div class="bg-white/80 rounded px-3 py-1 mb-1 shadow-sm self-center">
                <h3 class="font-black text-[#006400] uppercase text-sm">Extrato de Pontos</h3>
            </div>

            <div class="bg-white/80 rounded px-2 py-1 mb-2 shadow-sm self-center">
                <h2 class="font-black text-black text-lg">${u.name}</h2>
            </div>

            <div class="w-full bg-white/90 rounded-lg shadow-inner p-2 flex-1 overflow-y-auto border border-gray-200">
                ${html}
            </div>

            <button onclick="closeModal()" class="mt-3 w-full bg-[#006400] text-white font-bold py-2.5 rounded shadow-lg btn-press">
                FECHAR
            </button>

            <div id="extractMedalsInlineOverlay" class="hidden absolute inset-0 z-30 bg-black/45 flex items-center justify-center p-4">
                <div class="w-full max-w-[320px] rounded-[28px] bg-white shadow-2xl p-5">
                    <div class="text-center">
                        <h3 class="text-[14px] font-black text-[#006400] uppercase">Medalhas deste confronto</h3>
                        <p id="extractMedalsInlineTitle" class="mt-2 text-[13px] font-bold text-gray-800"></p>
                    </div>

                    <div id="extractMedalsInlineBody" class="mt-4 max-h-[260px] overflow-y-auto space-y-3"></div>

                    <button onclick="window.closeExtractMedalsInline()" class="mt-4 w-full bg-[#006400] text-white font-bold py-2.5 rounded shadow-lg btn-press">
                        FECHAR
                    </button>
                </div>
            </div>
        </div>
    </div>
`;

        };
        
const getCurrentAdminProfile = async (force = false) => {
  const user = currentUser || auth.currentUser;
  if (!user) return null;

  if (!force && adminSessionProfile && adminSessionProfile.uid === user.uid) {
    return adminSessionProfile;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return null;

    const data = snap.data() || {};
    if (data.isAdmin !== true) return null;

    adminSessionProfile = {
      uid: user.uid,
      email: user.email || data.email || "",
      name: data.name || user.displayName || user.email || "Admin"
    };

    return adminSessionProfile;
  } catch (error) {
    console.error("Erro ao validar admin:", error);
    return null;
  }
};

const showAdminCommunicationToast = (message, tone = "success") => {
  if (typeof showFinancialToast === "function") {
    showFinancialToast(message, tone);
    return;
  }
  alert(message);
};

const logAdminCommunicationAction = async (type, payload = {}) => {
  try {
    const admin = await getCurrentAdminProfile();
    if (!admin) return;
    await addDoc(collection(db, "admin_audit_logs"), {
      type,
      source: "admin_communications",
      ...payload,
      adminUid: admin.uid || "",
      adminName: admin.name || "",
      adminEmail: admin.email || "",
      createdAt: Timestamp.fromDate(new Date())
    });
  } catch (error) {
    console.warn("Falha ao registrar auditoria de comunicado:", error);
  }
};

const loadAdminCommunicationUsers = async () => {
  const snap = await getDocs(collection(db, "users"));
  const users = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    users.push({
      id: d.id,
      uid: d.id,
      name: data.name || data.username || "Sem nome",
      username: data.username || "",
      email: data.email || "",
      isActive: data.isActive !== false
    });
  });
  users.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  adminCommunicationState.users = users;
  return users;
};

const sendAdminPushRequest = async ({ title, message, targetMode = "all", targetUids = [] }) => {
  const token = await auth.currentUser.getIdToken(true);
  const response = await fetch("/api/send-push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ title, message, targetMode, targetUids })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.ok === false) {
    const error = new Error(result?.error || "NÃ£o foi possÃ­vel enviar o push.");
    error.code = result?.error || "push_error";
    error.result = result;
    throw error;
  }
  return result;
};

const saveAdminCommunicationRecord = async (payload = {}) => {
  const admin = await getCurrentAdminProfile(true);
  return addDoc(collection(db, "admin_communications"), {
    ...payload,
    createdAt: Timestamp.fromDate(new Date()),
    createdByUid: admin?.uid || "",
    createdByName: admin?.name || "",
    createdByEmail: admin?.email || "",
    source: "admin_communications_web"
  });
};

const renderAdminCommunicationsModal = () => {
  const tab = adminCommunicationState.tab || "push";
  const isPush = tab === "push";
  const copy = isPush
    ? "Abra a ferramenta de push para enviar notificaÃ§Ãµes manuais aos usuÃ¡rios."
    : "Abra a ferramenta de WhatsApp para avisar rapidamente sobre novos confrontos.";
  const action = isPush ? "window.openAdminManualPushModal()" : "window.openAdminWhatsAppNoticeModal()";
  const actionLabel = isPush ? "Abrir Push" : "Abrir WhatsApp";

  window.openModal(`
    <div class="admin-communications-modal">
      <div class="admin-communications-header">
        <div>
          <h3>Comunicados</h3>
          <p>Push e WhatsApp para o BolÃ£o 112 FC</p>
        </div>
        <button type="button" onclick="window.closeModal()" class="admin-communications-close"><i class="fas fa-times"></i></button>
      </div>
      <div class="admin-communications-body">
        <div class="admin-communication-tabs">
          <button type="button" onclick="window.switchAdminCommunicationTab('push')" class="${isPush ? "is-active" : ""}">
            <i class="fas fa-bell"></i><span>Push</span>
          </button>
          <button type="button" onclick="window.switchAdminCommunicationTab('whatsapp')" class="${!isPush ? "is-active" : ""}">
            <i class="fab fa-whatsapp"></i><span>WhatsApp</span>
          </button>
        </div>
        <div class="admin-communication-panel">
          <div class="admin-communication-icon ${isPush ? "is-push" : "is-whatsapp"}">
            <i class="${isPush ? "fas fa-bullhorn" : "fab fa-whatsapp"}"></i>
          </div>
          <p>${escapeHtml(copy)}</p>
        </div>
      </div>
      <div class="admin-communications-footer">
        <button type="button" onclick="window.closeModal()" class="admin-communication-secondary">Cancelar</button>
        <button type="button" onclick="${action}" class="admin-communication-primary">${actionLabel}</button>
      </div>
    </div>
  `);
};

window.openAdminCommunicationsModal = async () => {
  window.__setAdminReturnTarget(() => window.openAdminMenu());
  const admin = await getCurrentAdminProfile(true);
  if (!admin) {
    alert("VocÃª nÃ£o tem permissÃ£o para acessar comunicados.");
    return;
  }
  adminCommunicationState.tab = "push";
  renderAdminCommunicationsModal();
};

window.switchAdminCommunicationTab = (tab) => {
  adminCommunicationState.tab = tab === "whatsapp" ? "whatsapp" : "push";
  renderAdminCommunicationsModal();
};

const renderAdminManualPushModal = async () => {
  const mode = adminCommunicationState.pushTargetMode || "all";
  const isSelected = mode === "selected";
  const search = normalizeAdminText(adminCommunicationState.pushSearch || "");
  const selectedCount = adminCommunicationState.selectedUids.size;
  const users = adminCommunicationState.users || [];
  const filtered = search
    ? users.filter((user) => normalizeAdminText([user.name, user.username, user.email].join(" ")).includes(search))
    : users;

  const usersHtml = filtered.length ? filtered.map((user) => {
    const checked = adminCommunicationState.selectedUids.has(user.uid);
    return `
      <label class="admin-user-picker-row ${checked ? "is-selected" : ""}">
        <input type="checkbox" ${checked ? "checked" : ""} onchange="window.toggleAdminPushUser('${escapeJsString(user.uid)}', this.checked, this)">
        <span>
          <strong>${escapeHtml(user.name || "Sem nome")}</strong>
          <small>@${escapeHtml(user.username || user.uid)}${user.email ? ` â€¢ ${escapeHtml(user.email)}` : ""}</small>
        </span>
      </label>
    `;
  }).join("") : `<div class="admin-communication-empty">Nenhum usuÃ¡rio encontrado.</div>`;

  window.openModal(`
    <div class="admin-communications-modal admin-communications-modal--large">
      <div class="admin-communications-header">
        <div>
          <h3>Enviar Push Manual</h3>
          <p>${isSelected ? "Escolha exatamente quem deve receber a notificaÃ§Ã£o." : "Envie avisos para todos os usuÃ¡rios."}</p>
        </div>
        <button type="button" onclick="window.openAdminCommunicationsModal()" class="admin-communications-close"><i class="fas fa-arrow-left"></i></button>
      </div>
      <div class="admin-communications-body">
        <div class="admin-communication-tabs">
          <button type="button" onclick="window.switchAdminPushTargetMode('all')" class="${!isSelected ? "is-active" : ""}">Todos</button>
          <button type="button" onclick="window.switchAdminPushTargetMode('selected')" class="${isSelected ? "is-active" : ""}">Selecionados</button>
        </div>
        <div class="admin-push-form">
          <label>TÃ­tulo</label>
          <input id="adminPushTitle" class="admin-creation-input" value="${escapeHtml(window.__adminPushDraftTitle || "")}" placeholder="TÃ­tulo do comunicado">
          <label>Mensagem</label>
          <textarea id="adminPushMessage" class="admin-communication-textarea" placeholder="Mensagem para os usuÃ¡rios">${escapeHtml(window.__adminPushDraftMessage || "")}</textarea>
        </div>
        ${isSelected ? `
          <div class="admin-user-picker">
            <div class="admin-user-picker-top">
              <input id="adminPushUserSearch" class="admin-creation-input" value="${escapeHtml(adminCommunicationState.pushSearch || "")}" placeholder="Buscar usuÃ¡rio" oninput="window.filterAdminPushUsers(this.value)">
              <span>${selectedCount} usuÃ¡rio(s) selecionado(s)</span>
            </div>
            <div class="admin-user-picker-list">${usersHtml}</div>
          </div>
        ` : `
          <button type="button" onclick="window.requestWebPushPermissionAndSaveToken()" class="admin-communication-enable-push">
            <i class="fas fa-bell"></i> Ativar notificaÃ§Ãµes deste aparelho
          </button>
        `}
      </div>
      <div class="admin-communications-footer">
        <button type="button" onclick="window.openAdminCommunicationsModal()" class="admin-communication-secondary">Cancelar</button>
        <button type="button" onclick="window.sendAdminManualPush()" class="admin-communication-primary">ENVIAR</button>
      </div>
    </div>
  `);
};

window.openAdminManualPushModal = async () => {
  window.__setAdminReturnTarget(() => window.openAdminCommunicationsModal());
  const admin = await getCurrentAdminProfile(true);
  if (!admin) {
    alert("VocÃª nÃ£o tem permissÃ£o para enviar comunicados.");
    return;
  }
  adminCommunicationState.pushTargetMode = "all";
  adminCommunicationState.pushSearch = "";
  adminCommunicationState.selectedUids = new Set();
  await loadAdminCommunicationUsers();
  await renderAdminManualPushModal();
};

window.switchAdminPushTargetMode = async (mode) => {
  window.__adminPushDraftTitle = document.getElementById("adminPushTitle")?.value || window.__adminPushDraftTitle || "";
  window.__adminPushDraftMessage = document.getElementById("adminPushMessage")?.value || window.__adminPushDraftMessage || "";
  adminCommunicationState.pushTargetMode = mode === "selected" ? "selected" : "all";
  await renderAdminManualPushModal();
};

window.filterAdminPushUsers = async (value = "") => {
  window.__adminPushDraftTitle = document.getElementById("adminPushTitle")?.value || "";
  window.__adminPushDraftMessage = document.getElementById("adminPushMessage")?.value || "";
  adminCommunicationState.pushSearch = String(value || "");
  await renderAdminManualPushModal();
};

window.toggleAdminPushUser = (uid, checked, input = null) => {
  if (checked) adminCommunicationState.selectedUids.add(uid);
  else adminCommunicationState.selectedUids.delete(uid);
  const counter = document.querySelector(".admin-user-picker-top span");
  if (counter) counter.textContent = `${adminCommunicationState.selectedUids.size} usuÃ¡rio(s) selecionado(s)`;
  input?.closest?.(".admin-user-picker-row")?.classList.toggle("is-selected", checked);
};

window.sendAdminManualPush = async () => {
  const title = String(document.getElementById("adminPushTitle")?.value || "").trim();
  const message = String(document.getElementById("adminPushMessage")?.value || "").trim();
  const targetMode = adminCommunicationState.pushTargetMode === "selected" ? "selected" : "all";
  const targetUids = Array.from(adminCommunicationState.selectedUids);

  if (!title) return showAdminCommunicationToast("Informe o tÃ­tulo.", "danger");
  if (!message) return showAdminCommunicationToast("Informe a mensagem.", "danger");
  if (targetMode === "selected" && !targetUids.length) return showAdminCommunicationToast("Selecione pelo menos 1 usuÃ¡rio.", "danger");
  if (!confirm("Enviar este comunicado agora?")) return;

  const recordRef = await saveAdminCommunicationRecord({
    type: "manual_push",
    channel: "push",
    title,
    message,
    targetMode,
    targetUids: targetMode === "selected" ? targetUids : [],
    status: "pending"
  });

  try {
    const result = await sendAdminPushRequest({ title, message, targetMode, targetUids });
    await updateDoc(recordRef, {
      status: "sent",
      sentAt: Timestamp.fromDate(new Date()),
      result
    });
    await logAdminCommunicationAction("manual_push", {
      title,
      message,
      targetMode,
      targetCount: targetMode === "selected" ? targetUids.length : Number(result.totalTokens || 0)
    });
    const totalTokens = Number(result.totalTokens || 0);
    const successCount = Number(result.successCount || 0);
    const failureCount = Number(result.failureCount || 0);
    showAdminCommunicationToast(totalTokens === 0
      ? "Nenhum aparelho com push ativo ainda."
      : failureCount > 0
        ? `Push enviado para ${successCount} aparelho(s). Alguns aparelhos falharam. Verifique notification_tokens no Firestore.`
        : `Push enviado para ${successCount} aparelho(s). Se vocÃª estava com o app aberto, a notificaÃ§Ã£o pode aparecer pelo handler em primeiro plano; se nÃ£o aparecer, feche o app e teste novamente.`);
    window.closeModal();
  } catch (error) {
    console.error("Erro ao enviar push:", error);
    await updateDoc(recordRef, {
      status: "error",
      error: error.code || error.message || "push_error",
      updatedAt: Timestamp.fromDate(new Date())
    });
    if (error.code === "push_not_configured") {
      showAdminCommunicationToast("Push web ainda nÃ£o estÃ¡ configurado no servidor. O comunicado foi salvo, mas a notificaÃ§Ã£o nÃ£o foi enviada.", "danger");
      return;
    }
    if (error.code === "push_disabled") {
      showAdminCommunicationToast("Push web estÃ¡ desligado nas configuraÃ§Ãµes de seguranÃ§a.", "danger");
      return;
    }
    if (error.code === "push_rate_limited") {
      showAdminCommunicationToast("Push bloqueado pela trava de seguranÃ§a.", "danger");
      return;
    }
    if (error.code === "push_send_error") {
      showAdminCommunicationToast("Erro ao enviar push. Verifique a configuraÃ§Ã£o do Firebase Admin e tente novamente.", "danger");
      return;
    }
    showAdminCommunicationToast(error.code === "push_send_error"
      ? "Erro ao enviar push. Verifique a configuraÃ§Ã£o do Firebase Admin e tente novamente."
      : error.message || "NÃ£o foi possÃ­vel enviar o push.", "danger");
  }
};

const buildNewMatchesNoticeText = (count) => {
  const line = count === 1
    ? "1 novo confronto liberado para votaÃ§Ã£o. Abra o app e deixe seu palpite!"
    : `${count} novos confrontos liberados para votaÃ§Ã£o. Abra o app e deixe seu palpite!`;
  return `ðŸ”¥ NOVOS CONFRONTOS DISPONÃVEIS! ðŸ”¥\n\n${line}\n\nðŸ“² Acesse: https://bolao112-site.vercel.app`;
};

window.openAdminWhatsAppNoticeModal = async () => {
  window.__setAdminReturnTarget(() => window.openAdminCommunicationsModal());
  const admin = await getCurrentAdminProfile(true);
  if (!admin) {
    alert("VocÃª nÃ£o tem permissÃ£o para enviar comunicados.");
    return;
  }
  adminCommunicationState.whatsappCount = 0;
  const buttons = Array.from({ length: 20 }, (_, idx) => {
    const n = idx + 1;
    return `<button type="button" onclick="window.selectAdminWhatsappCount(${n})" id="adminWhatsappCount${n}" class="admin-whatsapp-number-button">${n}</button>`;
  }).join("");

  window.openModal(`
    <div class="admin-communications-modal">
      <div class="admin-communications-header">
        <div>
          <h3>Avisar Novos Confrontos</h3>
          <p>Quantos confrontos foram adicionados?</p>
        </div>
        <button type="button" onclick="window.openAdminCommunicationsModal()" class="admin-communications-close"><i class="fas fa-arrow-left"></i></button>
      </div>
      <div class="admin-communications-body">
        <div class="admin-whatsapp-grid">${buttons}</div>
        <label class="admin-communication-check"><input id="adminWhatsappOpen" type="checkbox" checked> Abrir WhatsApp</label>
        <label class="admin-communication-check"><input id="adminWhatsappPush" type="checkbox"> Enviar Push Notification</label>
      </div>
      <div class="admin-communications-footer">
        <button type="button" onclick="window.openAdminCommunicationsModal()" class="admin-communication-secondary">Cancelar</button>
        <button type="button" onclick="window.sendAdminWhatsappNotice()" class="admin-communication-primary">ENVIAR AVISO</button>
      </div>
    </div>
  `);
};

window.selectAdminWhatsappCount = (count) => {
  adminCommunicationState.whatsappCount = Number(count || 0);
  document.querySelectorAll(".admin-whatsapp-number-button").forEach((btn) => btn.classList.remove("is-selected"));
  document.getElementById(`adminWhatsappCount${count}`)?.classList.add("is-selected");
};

window.sendAdminWhatsappNotice = async () => {
  const count = Number(adminCommunicationState.whatsappCount || 0);
  if (!count) return showAdminCommunicationToast("Selecione a quantidade de confrontos.", "danger");

  const openedWhatsapp = document.getElementById("adminWhatsappOpen")?.checked === true;
  const shouldPush = document.getElementById("adminWhatsappPush")?.checked === true;
  const whatsappText = buildNewMatchesNoticeText(count);
  const pushTitle = "ðŸ”¥ Novos confrontos disponÃ­veis!";
  const pushMessage = count === 1
    ? "1 novo confronto foi liberado para votaÃ§Ã£o. Abra o BolÃ£o e deixe seu palpite!"
    : `${count} novos confrontos foram liberados para votaÃ§Ã£o. Abra o BolÃ£o e deixe seus palpites!`;
  let sentPush = false;

  if (openedWhatsapp) {
    const popup = window.open(`https://wa.me/?text=${encodeURIComponent(whatsappText)}`, "_blank");
    if (!popup) showAdminCommunicationToast("O navegador bloqueou a abertura do WhatsApp. Toque novamente em Abrir WhatsApp.", "danger");
  }

  if (shouldPush) {
    try {
      await sendAdminPushRequest({ title: pushTitle, message: pushMessage, targetMode: "all", targetUids: [] });
      sentPush = true;
    } catch (error) {
      console.error("Erro ao enviar push do aviso:", error);
      showAdminCommunicationToast(
        error.code === "push_not_configured"
          ? "Push web ainda nÃ£o estÃ¡ configurado no servidor. O aviso foi salvo, mas a notificaÃ§Ã£o nÃ£o foi enviada."
          : error.code === "push_disabled"
            ? "Push web estÃ¡ desligado nas configuraÃ§Ãµes de seguranÃ§a."
          : error.code === "push_rate_limited"
            ? "Push bloqueado pela trava de seguranÃ§a."
            : error.code === "push_send_error"
              ? "Erro ao enviar push. Verifique a configuraÃ§Ã£o do Firebase Admin e tente novamente."
              : "NÃ£o foi possÃ­vel enviar o push do aviso.",
        "danger"
      );
    }
  }

  await saveAdminCommunicationRecord({
    type: "new_matches_notice",
    channel: openedWhatsapp && shouldPush ? "whatsapp_push" : (openedWhatsapp ? "whatsapp" : "push"),
    matchCount: count,
    openedWhatsapp,
    sentPush,
    whatsappText,
    pushTitle,
    pushMessage
  });
  await logAdminCommunicationAction("new_matches_notice", {
    matchCount: count,
    openedWhatsapp,
    sentPush
  });
  showAdminCommunicationToast("Aviso registrado!");
  window.closeModal();
};

const ADMIN_SUMMARY_TIME_ZONE = "America/Fortaleza";

const getAdminRoundSummaryDate = (value) => {
  const date = toJsDate(value);
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const getAdminRoundSummaryMatchDate = (match = {}) =>
  getAdminRoundSummaryDate(match.finishedAt)
  || getAdminRoundSummaryDate(match.displayDate)
  || getAdminRoundSummaryDate(match.deadlineDate)
  || getAdminRoundSummaryDate(match.deadline)
  || getAdminRoundSummaryDate(match.createdAt)
  || new Date(0);

const getAdminRoundSummaryDateKey = (value) => {
  const date = getAdminRoundSummaryDate(value);
  if (!date) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ADMIN_SUMMARY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const map = {};
  parts.forEach((part) => {
    if (part.type !== "literal") map[part.type] = part.value;
  });

  return `${map.year || "0000"}-${map.month || "00"}-${map.day || "00"}`;
};

const formatAdminRoundSummaryDateLabel = (value) => {
  const date = getAdminRoundSummaryDate(value);
  if (!date) return "Data indisponÃ­vel";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatAdminRoundSummaryShortDate = (value) => {
  const date = getAdminRoundSummaryDate(value);
  if (!date) return "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const getAdminRoundSummaryInitials = (value = "") => {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ""}${words[words.length - 1][0] || ""}`.toUpperCase();
};

const getAdminRoundSummaryMatchLogo = (match = {}, side = "A") => {
  const isA = side === "A";
  return String(
    isA
      ? (match.teamAUrl || match.teamALogo || match.logoA || match.teamA_logo || match.teamALogoUrl || "")
      : (match.teamBUrl || match.teamBLogo || match.logoB || match.teamB_logo || match.teamBLogoUrl || "")
  ).trim();
};

const loadAdminRoundSummaryImage = (src = "") => new Promise((resolve) => {
  const safeSrc = String(src || "").trim();
  if (!safeSrc) return resolve(null);

  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = safeSrc;
  } catch (error) {
    resolve(null);
  }
});

const drawAdminRoundSummaryRoundRect = (ctx, x, y, w, h, r = 20) => {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }

  const radius = typeof r === "number" ? { tl: r, tr: r, br: r, bl: r } : {
    tl: r.tl || 0,
    tr: r.tr || 0,
    br: r.br || 0,
    bl: r.bl || 0
  };

  ctx.beginPath();
  ctx.moveTo(x + radius.tl, y);
  ctx.lineTo(x + w - radius.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius.tr);
  ctx.lineTo(x + w, y + h - radius.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius.br, y + h);
  ctx.lineTo(x + radius.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius.bl);
  ctx.lineTo(x, y + radius.tl);
  ctx.quadraticCurveTo(x, y, x + radius.tl, y);
  ctx.closePath();
};

const drawAdminRoundSummaryCardShadow = (ctx, x, y, w, h, radius = 28) => {
  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.15)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  drawAdminRoundSummaryRoundRect(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.restore();
};

const wrapAdminRoundSummaryText = (ctx, text, maxWidth, maxLines = 2) => {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines = [];
  let current = "";

  const pushCurrent = () => {
    if (current) lines.push(current);
    current = "";
  };

  const ellipsize = (value) => {
    let output = String(value || "");
    while (output && ctx.measureText(`${output}â€¦`).width > maxWidth) {
      output = output.slice(0, -1);
    }
    return `${output || value.slice(0, 1)}â€¦`;
  };

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }

    if (!current) {
      current = word;
      if (ctx.measureText(current).width > maxWidth) {
        current = ellipsize(current);
        pushCurrent();
      }
      continue;
    }

    pushCurrent();
    current = word;
    if (lines.length >= maxLines) break;
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (lines.length > maxLines) {
    return lines.slice(0, maxLines);
  }

  if (lines.length === maxLines) {
    const lastIdx = lines.length - 1;
    while (ctx.measureText(lines[lastIdx]).width > maxWidth && lines[lastIdx].length > 1) {
      lines[lastIdx] = lines[lastIdx].slice(0, -1);
    }
    if (ctx.measureText(lines[lastIdx]).width > maxWidth) {
      lines[lastIdx] = ellipsize(lines[lastIdx]);
    }
    return lines;
  }

  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
};

const drawAdminRoundSummaryWrappedText = (ctx, text, x, y, maxWidth, lineHeight, options = {}) => {
  const {
    color = "#0f172a",
    font = "28px Inter, system-ui, sans-serif",
    weight = 700,
    align = "left",
    maxLines = 2,
    fill = true
  } = options;

  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${weight} ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  const lines = wrapAdminRoundSummaryText(ctx, text, maxWidth, maxLines);
  lines.forEach((line, index) => {
    if (fill) ctx.fillText(line, x, y + (index * lineHeight));
  });
  ctx.restore();
  return lines.length;
};

const drawAdminRoundSummarySingleLineText = (ctx, text, x, y, maxWidth, options = {}) => {
  const {
    color = "#0f172a",
    font = "26px Inter, system-ui, sans-serif",
    weight = 900,
    align = "center",
    ellipsis = true
  } = options;

  const value = String(text || "").trim();
  if (!value) return "";

  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${weight} ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  let output = value;
  while (ctx.measureText(output).width > maxWidth && output.length > 1) {
    output = output.slice(0, -1);
  }
  if (ellipsis && output !== value) {
    while (output && ctx.measureText(`${output}â€¦`).width > maxWidth) {
      output = output.slice(0, -1);
    }
    output = `${output || value.slice(0, 1)}â€¦`;
  }
  ctx.fillText(output, x, y);
  ctx.restore();
  return output;
};

const drawAdminRoundSummaryBadge = (ctx, text, x, y, colors = {}) => {
  const value = String(text || "");
  ctx.save();
  ctx.font = "700 22px Inter, system-ui, sans-serif";
  const width = Math.max(100, ctx.measureText(value).width + 36);
  const height = 44;
  ctx.fillStyle = colors.bg || "rgba(255,255,255,0.92)";
  drawAdminRoundSummaryRoundRect(ctx, x, y, width, height, 22);
  ctx.fill();
  ctx.strokeStyle = colors.border || "rgba(15, 23, 42, 0.08)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = colors.text || "#0f172a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(value, x + (width / 2), y + (height / 2) + 1);
  ctx.restore();
  return width;
};

const drawAdminRoundSummaryImageCircle = (ctx, image, x, y, size, fallbackText, colors = {}) => {
  ctx.save();
  drawAdminRoundSummaryRoundRect(ctx, x, y, size, size, size / 2);
  ctx.fillStyle = colors.bg || "#f1f5f9";
  ctx.fill();
  if (colors.ring) {
    ctx.strokeStyle = colors.ring;
    ctx.lineWidth = colors.ringWidth || 7;
    ctx.stroke();
  }
  if (colors.glow) {
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 0;
  }
  if (image) {
    const inset = Math.max(8, Math.floor(size * 0.10));
    const innerX = x + inset;
    const innerY = y + inset;
    const innerSize = size - (inset * 2);
    const sourceRatio = image.width / image.height;
    const targetRatio = innerSize / innerSize;
    let drawW = innerSize;
    let drawH = innerSize;
    let drawX = innerX;
    let drawY = innerY;
    if (sourceRatio > targetRatio) {
      drawH = innerSize / sourceRatio;
      drawY = innerY + ((innerSize - drawH) / 2);
    } else {
      drawW = innerSize * sourceRatio;
      drawX = innerX + ((innerSize - drawW) / 2);
    }
    ctx.drawImage(image, drawX, drawY, drawW, drawH);
  } else {
    ctx.fillStyle = colors.bg || "#f1f5f9";
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = colors.text || "#0f172a";
    ctx.font = `900 ${Math.max(18, Math.floor(size * 0.32))}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(getAdminRoundSummaryInitials(fallbackText), x + (size / 2), y + (size / 2) + 1);
  }
  if (colors.badge) {
    const badgeText = String(colors.badge).trim();
    const badgeWidth = Math.max(74, Math.min(size + 24, badgeText.length * 10 + 32));
    const badgeHeight = 26;
    const badgeX = x + Math.max(4, Math.floor((size - badgeWidth) / 2));
    const badgeY = y + size - 13;
    ctx.fillStyle = colors.badgeBg || "#FFD54A";
    drawAdminRoundSummaryRoundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 13);
    ctx.fill();
    ctx.fillStyle = colors.badgeText || "#0f172a";
    ctx.font = "900 14px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(badgeText, badgeX + (badgeWidth / 2), badgeY + (badgeHeight / 2) + 1);
  }
  ctx.restore();
};

const getAdminRoundSummaryFilteredMatches = () => {
  const quick = adminRoundSummaryState.quickFilter || "all";
  const competition = normalizeAdminText(adminRoundSummaryState.competitionFilter || "");
  const round = normalizeAdminText(adminRoundSummaryState.roundFilter || "");
  const todayKey = getAdminRoundSummaryDateKey(new Date());

  return [...(adminRoundSummaryState.matches || [])].filter((match) => {
    if (quick === "today" && getAdminRoundSummaryDateKey(getAdminRoundSummaryMatchDate(match)) !== todayKey) {
      return false;
    }
    if (competition && normalizeAdminText(match.competition || "") !== competition) return false;
    if (round && normalizeAdminText(match.round || "") !== round) return false;
    return true;
  }).sort((a, b) => {
    const dateDiff = getAdminRoundSummaryMatchDate(b).getTime() - getAdminRoundSummaryMatchDate(a).getTime();
    if (dateDiff) return dateDiff;
    return matchComparator(b, a);
  });
};

const buildAdminRoundSummaryStats = (selectedMatches = []) => {
  const guesses = Array.isArray(adminRoundSummaryState.guesses) ? adminRoundSummaryState.guesses : [];
  const users = Array.isArray(adminRoundSummaryState.users) ? adminRoundSummaryState.users : [];
  const selectedIds = new Set(selectedMatches.map((match) => match.id));
  const guessLookup = {};

  guesses.forEach((guess) => {
    if (!guess?.userId || !guess?.matchId || !selectedIds.has(guess.matchId)) return;
    guessLookup[`${guess.userId}__${guess.matchId}`] = guess;
  });

  const participants = [];
  users.forEach((user) => {
    let considered = 0;
    let hits = 0;

    selectedMatches.forEach((match) => {
      const guess = guessLookup[`${user.uid}__${match.id}`];
      if (!guess) return;
      considered += 1;
      if (String(guess.teamSelected || "").trim() === String(match.winner || "").trim()) hits += 1;
    });

    if (considered > 0) {
      participants.push({
        user,
        considered,
        hits,
        percentage: considered > 0 ? (hits / considered) : 0
      });
    }
  });

  const byBest = [...participants].sort((a, b) => {
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    if (b.hits !== a.hits) return b.hits - a.hits;
    const nameDiff = String(a.user.name || a.user.username || a.user.uid || "").localeCompare(String(b.user.name || b.user.username || b.user.uid || ""));
    if (nameDiff) return nameDiff;
    return String(a.user.uid || "").localeCompare(String(b.user.uid || ""));
  });

  const byWorst = [...participants].sort((a, b) => {
    if (a.percentage !== b.percentage) return a.percentage - b.percentage;
    if (a.hits !== b.hits) return a.hits - b.hits;
    const nameDiff = String(a.user.name || a.user.username || a.user.uid || "").localeCompare(String(b.user.name || b.user.username || b.user.uid || ""));
    if (nameDiff) return nameDiff;
    return String(a.user.uid || "").localeCompare(String(b.user.uid || ""));
  });

  const bestPercentage = byBest.length ? byBest[0].percentage : null;
  const bestHits = byBest.length ? byBest[0].hits : null;
  const worstPercentage = byWorst.length ? byWorst[0].percentage : null;
  const worstHits = byWorst.length ? byWorst[0].hits : null;
  const craques = byBest.filter((item) => item.percentage === bestPercentage && item.hits === bestHits);
  const perebas = byWorst.filter((item) => item.percentage === worstPercentage && item.hits === worstHits);

  const competitionNames = Array.from(new Set(selectedMatches.map((match) => String(match.competition || "").trim()).filter(Boolean)));
  const roundNames = Array.from(new Set(selectedMatches.map((match) => String(match.round || "").trim()).filter(Boolean)));

  return {
    participants,
    participantCount: participants.length,
    craques,
    perebas,
    craque: craques[0] || null,
    pereba: perebas[0] || null,
    competitionLabel: competitionNames.length === 1 ? competitionNames[0] : "MÃºltiplas competiÃ§Ãµes",
    roundLabel: roundNames.length === 1 ? roundNames[0] : "MÃºltiplas fases"
  };
};

const loadAdminRoundSummaryData = async () => {
  const admin = await getCurrentAdminProfile(true);
  if (!admin) throw new Error("admin_required");

  const [competitionsState, roundsState, matchesSnap, guessesSnap, usersSnap] = await Promise.all([
    loadAdminCompetitions({ force: true }).catch(() => ({ items: [] })),
    loadAdminRounds({ force: true, migrate: true }).catch(() => ({ items: [], inactiveItems: [] })),
    getDocs(collection(db, "matches")),
    getDocs(collection(db, "guesses")),
    getDocs(collection(db, "users"))
  ]);

  const competitions = (competitionsState.items || []).filter((item) => item.active === true);
  const rounds = dedupeRoundNames(roundsState.items || []);
  const matches = [];
  const guesses = [];
  const users = [];

  guessesSnap.forEach((snap) => {
    const data = snap.data() || {};
    guesses.push({ id: snap.id, ...data });
  });

  usersSnap.forEach((snap) => {
    const data = snap.data() || {};
    users.push({
      uid: snap.id,
      id: snap.id,
      ...data,
      name: data.name || data.username || "Sem nome",
      username: data.username || "",
      photoBase64: data.photoBase64 || data.photo || "",
      createdDate: toJsDate(data.createdAt) || new Date(0)
    });
  });

  matchesSnap.forEach((snap) => {
    const data = snap.data() || {};
    if (!String(data.winner || "").trim() && String(data.status || "").toLowerCase() !== "finalizado") return;

    matches.push({
      id: snap.id,
      ...data,
      teamA: String(data.teamA || "").trim(),
      teamB: String(data.teamB || "").trim(),
      competition: String(data.competition || "").trim(),
      round: String(data.round || "").trim(),
      winner: String(data.winner || "").trim(),
      teamAUrl: String(data.teamAUrl || data.teamALogo || data.logoA || "").trim(),
      teamBUrl: String(data.teamBUrl || data.teamBLogo || data.logoB || "").trim(),
      displayDate: getAdminRoundSummaryMatchDate(data),
      deadlineDate: getAdminRoundSummaryDate(data.deadline) || null,
      finishedAtDate: getAdminRoundSummaryDate(data.finishedAt) || null
    });
  });

  matches.sort((a, b) => {
    const diff = getAdminRoundSummaryMatchDate(b).getTime() - getAdminRoundSummaryMatchDate(a).getTime();
    if (diff) return diff;
    return matchComparator(b, a);
  });

  adminRoundSummaryState.matches = matches;
  adminRoundSummaryState.users = users;
  adminRoundSummaryState.guesses = guesses;
  adminRoundSummaryState.competitions = competitions;
  adminRoundSummaryState.rounds = rounds;
  adminRoundSummaryState.selectedIds = new Set(
    Array.from(adminRoundSummaryState.selectedIds || []).filter((id) => matches.some((match) => match.id === id))
  );
};

const getAdminRoundSummarySelectedMatches = () =>
  (adminRoundSummaryState.matches || []).filter((match) => adminRoundSummaryState.selectedIds.has(match.id));

const renderAdminRoundSummarySelectionModal = () => {
  const modal = document.getElementById("modalOverlay");
  const cont = document.getElementById("modalContainer");
  if (!modal || !cont) return;

  const allMatches = [...(adminRoundSummaryState.matches || [])];
  const filteredMatches = getAdminRoundSummaryFilteredMatches();
  const selectedMatches = getAdminRoundSummarySelectedMatches();
  const stats = buildAdminRoundSummaryStats(selectedMatches);
  const selectedCount = adminRoundSummaryState.selectedIds.size;
  const todayActive = adminRoundSummaryState.quickFilter === "today";
  const activeFilters = [];
  if (todayActive) activeFilters.push("Hoje");
  if (adminRoundSummaryState.competitionFilter) activeFilters.push(adminRoundSummaryState.competitionFilter);
  if (adminRoundSummaryState.roundFilter) activeFilters.push(adminRoundSummaryState.roundFilter);

  const competitionOptions = (adminRoundSummaryState.competitions || [])
    .map((item) => `<option value="${escapeHtml(item.name || "")}" ${normalizeAdminText(item.name || "") === normalizeAdminText(adminRoundSummaryState.competitionFilter || "") ? "selected" : ""}>${escapeHtml(item.name || "")}</option>`)
    .join("");
  const roundOptions = (adminRoundSummaryState.rounds || [])
    .map((item) => `<option value="${escapeHtml(item)}" ${normalizeAdminText(item || "") === normalizeAdminText(adminRoundSummaryState.roundFilter || "") ? "selected" : ""}>${escapeHtml(item)}</option>`)
    .join("");

  const listHtml = filteredMatches.length
    ? filteredMatches.map((match) => {
        const checked = adminRoundSummaryState.selectedIds.has(match.id);
        const dateLabel = formatAdminRoundSummaryShortDate(match.displayDate);
        const teamAlogo = getAdminRoundSummaryMatchLogo(match, "A");
        const teamBlogo = getAdminRoundSummaryMatchLogo(match, "B");

        return `
          <button type="button" onclick="window.toggleAdminRoundSummaryMatch('${escapeJsString(match.id)}')" class="w-full text-left rounded-3xl border p-3 bg-white shadow-sm transition-all ${checked ? "border-[#006400] ring-2 ring-[#006400]/25" : "border-slate-200 hover:border-[#006400]/50"}">
            <div class="flex items-start justify-between gap-3 mb-3">
              <div class="min-w-0">
                <div class="flex flex-wrap gap-1 mb-2">
                  ${dateLabel ? `<span class="status-chip status-chip--default">${escapeHtml(dateLabel)}</span>` : ""}
                  ${match.round ? `<span class="status-chip status-chip--default">${escapeHtml(match.round)}</span>` : ""}
                </div>
                <div class="text-sm font-black text-slate-900 leading-tight break-words">${escapeHtml(match.teamA || "Time A")} x ${escapeHtml(match.teamB || "Time B")}</div>
                <div class="mt-1 text-[11px] font-bold text-slate-500 leading-snug">${escapeHtml(match.round || "Fase")} â€¢ ${escapeHtml(match.competition || "CompetiÃ§Ã£o")}</div>
              </div>
              <div class="shrink-0">
                <span class="status-chip ${checked ? "status-chip--success" : "status-chip--default"}">${checked ? "Selecionado" : "Toque para selecionar"}</span>
              </div>
            </div>
            <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div class="flex flex-col items-center text-center min-w-0">
                ${teamAlogo ? `<img src="${escapeHtml(teamAlogo)}" alt="" class="w-14 h-14 rounded-2xl object-contain bg-slate-50 border border-slate-100 p-1">` : `<div class="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-500">${escapeHtml(getAdminRoundSummaryInitials(match.teamA || ""))}</div>`}
                <div class="mt-2 text-[11px] font-black text-slate-900 leading-tight line-clamp-2">${escapeHtml(match.teamA || "")}</div>
              </div>
              <div class="text-xl font-black text-[#006400] px-2">x</div>
              <div class="flex flex-col items-center text-center min-w-0">
                ${teamBlogo ? `<img src="${escapeHtml(teamBlogo)}" alt="" class="w-14 h-14 rounded-2xl object-contain bg-slate-50 border border-slate-100 p-1">` : `<div class="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-500">${escapeHtml(getAdminRoundSummaryInitials(match.teamB || ""))}</div>`}
                <div class="mt-2 text-[11px] font-black text-slate-900 leading-tight line-clamp-2">${escapeHtml(match.teamB || "")}</div>
              </div>
            </div>
          </button>
        `;
      }).join("")
    : `
      <div class="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center">
        <p class="text-sm font-black text-slate-500">Nenhum jogo finalizado encontrado.</p>
      </div>
    `;

  const filterLabel = activeFilters.length ? activeFilters.join(" â€¢ ") : "Sem filtros adicionais";

  modal.classList.remove("hidden");
  cont.innerHTML = `
    <div class="w-full max-w-3xl bg-white rounded-none shadow-2xl overflow-hidden relative h-[92vh] flex flex-col">
      <div class="bg-[#006400] p-4 text-white flex items-start justify-between gap-3 shadow-md shrink-0">
        <div class="min-w-0">
          <h3 class="font-black uppercase text-lg leading-none">Selecionar Jogos do Resumo</h3>
          <p class="text-[10px] text-[#FFD700] font-bold mt-1">Selecione os jogos que entrarÃ£o na prÃ©via do WhatsApp.</p>
        </div>
        <button type="button" onclick="closeModal()" class="shrink-0 text-white/90"><i class="fas fa-times text-xl"></i></button>
      </div>

      <div class="flex-1 overflow-y-auto bg-slate-50 p-3 space-y-3">
        <div class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-[10px] font-black text-[#006400] uppercase tracking-[0.18em]">Filtros</div>
              <p class="text-xs font-bold text-slate-500 mt-1">VocÃª pode combinar competiÃ§Ã£o e rodada ao mesmo tempo.</p>
            </div>
            <span class="status-chip status-chip--default">${selectedCount} selecionado(s)</span>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <button type="button" onclick="window.switchAdminRoundSummaryQuickFilter('all')" class="min-h-[44px] rounded-2xl border px-3 py-2 text-xs font-black ${adminRoundSummaryState.quickFilter === 'all' ? 'bg-[#111827] text-[#FFD700] border-[#111827]' : 'bg-white text-slate-600 border-slate-200'}">Todos</button>
            <button type="button" onclick="window.switchAdminRoundSummaryQuickFilter('today')" class="min-h-[44px] rounded-2xl border px-3 py-2 text-xs font-black ${todayActive ? 'bg-[#111827] text-[#FFD700] border-[#111827]' : 'bg-white text-slate-600 border-slate-200'}">Hoje</button>
            <button type="button" onclick="window.clearAdminRoundSummaryFilters()" class="min-h-[44px] rounded-2xl border px-3 py-2 text-xs font-black bg-white text-slate-600 border-slate-200">Limpar filtros</button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select id="adminSummaryCompetitionFilter" class="admin-creation-input" onchange="window.setAdminRoundSummaryCompetitionFilter(this.value)">
              <option value="">CompetiÃ§Ã£o</option>
              ${competitionOptions}
            </select>
            <select id="adminSummaryRoundFilter" class="admin-creation-input" onchange="window.setAdminRoundSummaryRoundFilter(this.value)">
              <option value="">Rodada</option>
              ${roundOptions}
            </select>
          </div>

          <p class="text-[11px] font-bold text-slate-500">Filtros ativos: ${escapeHtml(filterLabel)}</p>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="status-chip status-chip--default">Exibindo ${filteredMatches.length} de ${allMatches.length} jogos finalizados</div>
          <div class="status-chip status-chip--${selectedCount ? "success" : "warning"}">Selecionados: ${selectedCount}</div>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <button type="button" onclick="window.selectAllAdminRoundSummaryMatches()" class="min-h-[44px] rounded-2xl bg-[#006400] text-white text-xs font-black shadow-lg btn-press">Selecionar todos</button>
          <button type="button" onclick="window.clearAdminRoundSummarySelection()" class="min-h-[44px] rounded-2xl bg-slate-200 text-slate-800 text-xs font-black shadow-lg btn-press">Limpar</button>
          <button type="button" onclick="window.invertAdminRoundSummarySelection()" class="min-h-[44px] rounded-2xl bg-slate-800 text-white text-xs font-black shadow-lg btn-press">Inverter</button>
        </div>

        <div class="space-y-2">
          ${listHtml}
        </div>
      </div>

      <div class="grid grid-cols-1 gap-2 p-3 border-t bg-white shrink-0">
        <button type="button" onclick="window.generateAdminRoundSummaryImage()" class="min-h-[48px] rounded-2xl bg-[#006400] text-white text-xs font-black shadow-lg btn-press ${selectedCount ? "" : "opacity-40 cursor-not-allowed"}" ${selectedCount ? "" : "disabled"}>Gerar imagem do resumo</button>
        <button type="button" onclick="window.closeModal()" class="min-h-[44px] rounded-2xl bg-slate-200 text-slate-800 text-xs font-black shadow-lg btn-press">Fechar</button>
      </div>
    </div>
  `;
};

const renderAdminRoundSummaryPreviewModal = () => {
  const modal = document.getElementById("modalOverlay");
  const cont = document.getElementById("modalContainer");
  if (!modal || !cont) return;

  window.__setAdminReturnTarget(() => window.backToAdminRoundSummarySelection());

  const previewUrl = adminRoundSummaryState.previewUrl || "";
  modal.classList.remove("hidden");
  cont.innerHTML = `
    <div class="w-full max-w-xl bg-white rounded-none shadow-2xl overflow-hidden relative h-[92vh] flex flex-col">
      <div class="bg-[#006400] p-4 text-white flex items-start justify-between gap-3 shadow-md shrink-0">
        <div class="min-w-0">
          <h3 class="font-black uppercase text-lg leading-none">Imagem do Resumo</h3>
          <p class="text-[10px] text-[#FFD700] font-bold mt-1">PrÃ©via da imagem</p>
        </div>
        <button type="button" onclick="window.closeModal()" class="shrink-0 text-white/90"><i class="fas fa-times text-xl"></i></button>
      </div>

      <div class="flex-1 overflow-y-auto bg-slate-50 p-3">
        <div class="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          ${previewUrl ? `<img src="${escapeHtml(previewUrl)}" alt="PrÃ©via do resumo da rodada" class="w-full h-auto rounded-2xl">` : `<div class="py-20 text-center text-sm font-black text-slate-500">Imagem indisponÃ­vel.</div>`}
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 p-3 border-t bg-white shrink-0">
        <button type="button" onclick="window.backToAdminRoundSummarySelection()" class="min-h-[46px] rounded-2xl bg-slate-200 text-slate-800 text-xs font-black shadow-lg btn-press">Voltar</button>
        <button type="button" onclick="window.shareAdminRoundSummaryImage()" class="min-h-[46px] rounded-2xl bg-[#006400] text-white text-xs font-black shadow-lg btn-press">Compartilhar</button>
      </div>
      <div class="px-3 pb-3 bg-white">
        <button type="button" onclick="window.downloadAdminRoundSummaryImage()" class="w-full min-h-[44px] rounded-2xl bg-white text-slate-700 text-xs font-black border border-slate-200 shadow-sm btn-press">Baixar imagem</button>
      </div>
    </div>
  `;
};

window.switchAdminRoundSummaryQuickFilter = (value) => {
  adminRoundSummaryState.quickFilter = value === "today" ? "today" : "all";
  renderAdminRoundSummarySelectionModal();
};

window.setAdminRoundSummaryCompetitionFilter = (value = "") => {
  adminRoundSummaryState.competitionFilter = String(value || "").trim();
  renderAdminRoundSummarySelectionModal();
};

window.setAdminRoundSummaryRoundFilter = (value = "") => {
  adminRoundSummaryState.roundFilter = String(value || "").trim();
  renderAdminRoundSummarySelectionModal();
};

window.clearAdminRoundSummaryFilters = () => {
  adminRoundSummaryState.quickFilter = "all";
  adminRoundSummaryState.competitionFilter = "";
  adminRoundSummaryState.roundFilter = "";
  renderAdminRoundSummarySelectionModal();
};

window.toggleAdminRoundSummaryMatch = (matchId) => {
  const id = String(matchId || "").trim();
  if (!id) return;
  if (adminRoundSummaryState.selectedIds.has(id)) adminRoundSummaryState.selectedIds.delete(id);
  else adminRoundSummaryState.selectedIds.add(id);
  renderAdminRoundSummarySelectionModal();
};

window.selectAllAdminRoundSummaryMatches = () => {
  getAdminRoundSummaryFilteredMatches().forEach((match) => adminRoundSummaryState.selectedIds.add(match.id));
  renderAdminRoundSummarySelectionModal();
};

window.clearAdminRoundSummarySelection = () => {
  adminRoundSummaryState.selectedIds = new Set();
  renderAdminRoundSummarySelectionModal();
};

window.invertAdminRoundSummarySelection = () => {
  const filtered = getAdminRoundSummaryFilteredMatches();
  const next = new Set(adminRoundSummaryState.selectedIds || []);
  filtered.forEach((match) => {
    if (next.has(match.id)) next.delete(match.id);
    else next.add(match.id);
  });
  adminRoundSummaryState.selectedIds = next;
  renderAdminRoundSummarySelectionModal();
};

window.backToAdminRoundSummarySelection = () => {
  window.__setAdminReturnTarget(() => window.openAdminMenu());
  renderAdminRoundSummarySelectionModal();
};

const buildAdminRoundSummaryCanvas = async (selectedMatches = []) => {
  const stats = buildAdminRoundSummaryStats(selectedMatches);
  const width = 1080;
  const padding = 56;
  const gap = 24;
  const cols = selectedMatches.length === 1 ? 1 : 2;
  const cardWidth = cols === 1 ? (width - padding * 2) : Math.floor((width - padding * 2 - gap) / 2);
  const cardHeight = selectedMatches.length <= 4 ? 298 : selectedMatches.length <= 8 ? 270 : 246;
  const rows = Math.ceil(selectedMatches.length / cols);
  const cardsHeight = rows * cardHeight + Math.max(0, rows - 1) * gap;
  const highlightMaxItems = Math.max(1, (stats.craques || []).length, (stats.perebas || []).length);
  const highlightStride = 104;
  const highlightHeight = 130 + ((highlightMaxItems - 1) * highlightStride);
  const footerHeight = 136;
  const topHeight = 332;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");

  const pills = [
    { icon: "âš½", text: `${selectedMatches.length} confronto(s)`, bg: "#fef3c7", iconBg: "#0b5f2a", iconColor: "#fff" },
    { icon: "ðŸ‘¥", text: `${stats.participantCount} participante(s)`, bg: "#ecfdf5", iconBg: "#0b5f2a", iconColor: "#fff" },
    { icon: "ðŸ—‚", text: stats.roundLabel, bg: "#eff6ff", iconBg: "#1d4ed8", iconColor: "#fff" },
    { icon: "ðŸ…", text: stats.competitionLabel, bg: "#f5f3ff", iconBg: "#7c3aed", iconColor: "#fff" }
  ];

  let pillX = padding;
  let pillY = 176;
  let pillRowHeight = 0;
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  pills.forEach((pill) => {
    const pillWidth = Math.min(500, Math.max(252, ctx.measureText(pill.text).width + 110));
    if (pillX + pillWidth > width - padding) {
      pillX = padding;
      pillY += pillRowHeight + 14;
      pillRowHeight = 0;
    }
    const pillHeight = 56;
    pillRowHeight = Math.max(pillRowHeight, pillHeight);
    ctx.fillStyle = pill.bg;
    drawAdminRoundSummaryRoundRect(ctx, pillX, pillY, pillWidth, pillHeight, 28);
    ctx.fill();
    ctx.strokeStyle = "rgba(15, 23, 42, 0.07)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = pill.iconBg;
    drawAdminRoundSummaryRoundRect(ctx, pillX + 12, pillY + 12, 32, 32, 16);
    ctx.fill();
    ctx.fillStyle = pill.iconColor;
    ctx.font = "900 16px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pill.icon, pillX + 28, pillY + 28);
    ctx.fillStyle = "#0f172a";
    ctx.font = "900 22px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(pill.text, pillX + 56, pillY + 29);
    pillX += pillWidth + 12;
  });

  const cardsStartY = Math.max(344, pillY + pillRowHeight + 38);
  const height = cardsStartY + cardsHeight + highlightHeight + footerHeight + 64;

  const cardImages = await Promise.all(selectedMatches.flatMap((match) => [
    loadAdminRoundSummaryImage(getAdminRoundSummaryMatchLogo(match, "A")),
    loadAdminRoundSummaryImage(getAdminRoundSummaryMatchLogo(match, "B"))
  ]));

  canvas.height = height;
  const topGradient = ctx.createLinearGradient(0, 0, 0, topHeight);
  topGradient.addColorStop(0, "#0a7f31");
  topGradient.addColorStop(1, "#095d29");
  ctx.fillStyle = "#ECF5EC";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = topGradient;
  drawAdminRoundSummaryRoundRect(ctx, 0, 0, width, topHeight, 0);
  ctx.fill();
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.arc(width - 120, 92, 118, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(120, 176, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 213, 74, 0.12)";
  ctx.beginPath();
  ctx.arc(width / 2, 32, 210, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.30)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = "#FFD54A";
  ctx.font = "900 70px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("RESUMO DA RODADA", width / 2, 60);
  ctx.restore();
  ctx.font = "800 28px Inter, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.90)";
  ctx.textAlign = "center";
  ctx.fillText(formatAdminRoundSummaryDateLabel(new Date()), width / 2, 136);

  let y = cardsStartY;
  const startX = padding;

  for (let index = 0; index < selectedMatches.length; index += 1) {
    const match = selectedMatches[index];
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = startX + (col * (cardWidth + gap));
    const cardY = y + (row * (cardHeight + gap));

    drawAdminRoundSummaryCardShadow(ctx, x, cardY, cardWidth, cardHeight, 30);
    ctx.save();
    ctx.fillStyle = "#FBFDFC";
    drawAdminRoundSummaryRoundRect(ctx, x + 2, cardY + 2, cardWidth - 4, cardHeight - 4, 28);
    ctx.fill();
    ctx.fillStyle = "rgba(11, 95, 42, 0.08)";
    drawAdminRoundSummaryRoundRect(ctx, x + 2, cardY + 2, cardWidth - 4, 60, 26);
    ctx.fill();

    ctx.fillStyle = "#0b5f2a";
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const dateShort = formatAdminRoundSummaryShortDate(match.displayDate);
    if (dateShort) {
      ctx.fillText(dateShort, x + 26, cardY + 20);
    }
    const metaY = cardY + 20;
    const roundText = String(match.round || "").trim() || "Fase";
    const compText = String(match.competition || "").trim() || "CompetiÃ§Ã£o";
    const roundW = Math.min(cardWidth * 0.43, ctx.measureText(roundText).width + 22);
    const compW = Math.min(cardWidth * 0.48, ctx.measureText(compText).width + 22);
    drawAdminRoundSummaryBadge(ctx, compText, x + cardWidth - 26 - compW, metaY, {
      bg: "rgba(11, 95, 42, 0.10)",
      border: "rgba(11, 95, 42, 0.12)",
      text: "#0b5f2a"
    });
    drawAdminRoundSummaryBadge(ctx, roundText, x + cardWidth - 26 - compW - roundW - 10, metaY, {
      bg: "rgba(15,23,42,0.06)",
      border: "rgba(15,23,42,0.08)",
      text: "#334155"
    });
    ctx.restore();

    const logoSize = Math.min(96, Math.max(76, Math.floor(cardWidth * 0.18)));
    const teamY = cardY + 96;
    const teamTextY = teamY + logoSize + 16;
    const leftX = x + 30;
    const rightX = x + cardWidth - 30 - logoSize;
    const centerX = x + (cardWidth / 2);
    const logoA = cardImages[index * 2] || null;
    const logoB = cardImages[index * 2 + 1] || null;
    const winnerValue = String(match.winner || "").trim();
    const isWinnerA = winnerValue && normalizeAdminText(winnerValue) === normalizeAdminText(match.teamA || "");
    const isWinnerB = winnerValue && normalizeAdminText(winnerValue) === normalizeAdminText(match.teamB || "");
    const winnerRing = "#D4AF37";

    drawAdminRoundSummaryImageCircle(ctx, logoA, leftX, teamY, logoSize, match.teamA, {
      bg: isWinnerA ? "#fff8dc" : "#f1f5f9",
      text: isWinnerA ? "#8a6b00" : "#0b5f2a",
      ring: isWinnerA ? winnerRing : "",
      ringWidth: isWinnerA ? 8 : 0,
      glow: isWinnerA ? "rgba(212,175,55,0.35)" : "",
      badge: isWinnerA ? "VENCEDOR" : "",
      badgeBg: winnerRing,
      badgeText: "#102a43"
    });
    drawAdminRoundSummaryImageCircle(ctx, logoB, rightX, teamY, logoSize, match.teamB, {
      bg: isWinnerB ? "#fff8dc" : "#f1f5f9",
      text: isWinnerB ? "#8a6b00" : "#0b5f2a",
      ring: isWinnerB ? winnerRing : "",
      ringWidth: isWinnerB ? 8 : 0,
      glow: isWinnerB ? "rgba(212,175,55,0.35)" : "",
      badge: isWinnerB ? "VENCEDOR" : "",
      badgeBg: winnerRing,
      badgeText: "#102a43"
    });

    ctx.save();
    ctx.fillStyle = "#0b5f2a";
    ctx.font = "900 34px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    drawAdminRoundSummaryRoundRect(ctx, centerX - 24, teamY + (logoSize / 2) - 20, 48, 40, 18);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText("x", centerX, teamY + (logoSize / 2) + 2);
    ctx.restore();

    const nameMaxWidth = Math.max(114, Math.floor(cardWidth * 0.30));
    drawAdminRoundSummarySingleLineText(ctx, match.teamA || "", leftX + (logoSize / 2), teamTextY, nameMaxWidth, {
      color: isWinnerA ? "#0b5f2a" : "#0f172a",
      font: "25px Inter, system-ui, sans-serif",
      weight: isWinnerA ? 900 : 800,
      align: "center"
    });
    drawAdminRoundSummarySingleLineText(ctx, match.teamB || "", rightX + (logoSize / 2), teamTextY, nameMaxWidth, {
      color: isWinnerB ? "#0b5f2a" : "#0f172a",
      font: "25px Inter, system-ui, sans-serif",
      weight: isWinnerB ? 900 : 800,
      align: "center"
    });

    const resultText = winnerValue ? `Vencedor: ${winnerValue}` : "Jogo finalizado";
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const resultWidth = Math.min(cardWidth - 72, ctx.measureText(resultText).width + 48);
    drawAdminRoundSummaryRoundRect(ctx, centerX - (resultWidth / 2), cardY + cardHeight - 50, resultWidth, 34, 17);
    ctx.fillStyle = winnerValue ? "rgba(11,95,42,0.10)" : "rgba(100,116,139,0.10)";
    ctx.fill();
    ctx.fillStyle = winnerValue ? "#0b5f2a" : "#64748b";
    ctx.fillText(resultText, centerX, cardY + cardHeight - 33);
  }

  const highlightsY = y + cardsHeight + 36;
  ctx.fillStyle = "#0f172a";
  ctx.font = "900 34px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Craques da rodada", padding, highlightsY);
  ctx.fillText("Perebas da rodada", width / 2 + 18, highlightsY);

  const highlightTop = highlightsY + 52;
  const highlightW = Math.floor((width - padding * 2 - 18) / 2);
  const highlightEntries = [
    {
      x: padding,
      title: "Craques da rodada",
      accent: "#0b5f2a",
      badge: "CRAQUE",
      items: Array.isArray(stats.craques) ? stats.craques : []
    },
    {
      x: padding + highlightW + 18,
      title: "Perebas da rodada",
      accent: "#b91c1c",
      badge: "PEREBA",
      items: Array.isArray(stats.perebas) ? stats.perebas : []
    }
  ];

  const highlightImages = [];
  for (const entry of highlightEntries) {
    const entryImages = [];
    for (const item of entry.items) {
      const avatarSource = getAvatarUrl(item.user?.photoBase64 || item.user?.photo || "", item.user?.name || item.user?.username || "");
      entryImages.push(await loadAdminRoundSummaryImage(avatarSource));
    }
    highlightImages.push(entryImages);
  }

  highlightEntries.forEach((entry, entryIndex) => {
    const items = Array.isArray(entry.items) ? entry.items : [];
    const blockHeight = 130 + (Math.max(1, items.length) - 1) * highlightStride;
    drawAdminRoundSummaryCardShadow(ctx, entry.x, highlightTop, highlightW, blockHeight, 28);
    ctx.save();
    ctx.fillStyle = "#FBFDFC";
    drawAdminRoundSummaryRoundRect(ctx, entry.x + 2, highlightTop + 2, highlightW - 4, blockHeight - 4, 26);
    ctx.fill();
    drawAdminRoundSummaryRoundRect(ctx, entry.x + 20, highlightTop + 18, 14, 46, 7);
    ctx.fillStyle = entry.accent;
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#0f172a";
    ctx.font = "900 24px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(entry.title, entry.x + 42, highlightTop + 20);

    drawAdminRoundSummaryBadge(ctx, entry.badge, entry.x + highlightW - 152, highlightTop + 18, {
      bg: entry.accent === "#0b5f2a" ? "#ecfdf5" : "#fef2f2",
      border: entry.accent,
      text: entry.accent
    });

    if (!items.length) {
      ctx.fillStyle = "#64748b";
      ctx.font = "800 22px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Sem dados", entry.x + 24, highlightTop + 82);
      return;
    }

    items.forEach((item, itemIndex) => {
      const rowY = highlightTop + 72 + (itemIndex * highlightStride);
      if (itemIndex > 0) {
        ctx.save();
        ctx.strokeStyle = "rgba(15, 23, 42, 0.08)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(entry.x + 22, rowY - 12);
        ctx.lineTo(entry.x + highlightW - 22, rowY - 12);
        ctx.stroke();
        ctx.restore();
      }

      const itemImage = highlightImages[entryIndex][itemIndex] || null;
      const avatarName = item.user?.name || item.user?.username || "?";
      drawAdminRoundSummaryImageCircle(ctx, itemImage, entry.x + 24, rowY, 68, avatarName, {
        bg: "#eef2f7",
        text: entry.accent,
        ring: entry.accent,
        ringWidth: 5,
        badge: itemIndex === 0 && items.length === 1 ? entry.badge : ""
      });

      drawAdminRoundSummarySingleLineText(ctx, avatarName, entry.x + 108, rowY + 2, highlightW - 168, {
        color: "#0f172a",
        font: "24px Inter, system-ui, sans-serif",
        weight: 900,
        align: "left"
      });

      const scoreText = `${item.hits}/${item.considered} acerto(s) â€¢ ${Math.round(item.percentage * 100)}% de aproveitamento`;
      ctx.fillStyle = "#475569";
      ctx.font = "800 20px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(scoreText, entry.x + 108, rowY + 30);

    });
  });

  ctx.fillStyle = "#0b5f2a";
  ctx.font = "900 28px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("BOLÃƒO 112 F.C", width / 2, height - 72);

  return canvas;
};

const downloadAdminRoundSummaryBlob = (blob) => {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `resumo-da-rodada-${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

window.downloadAdminRoundSummaryImage = () => {
  if (!adminRoundSummaryState.previewBlob) {
    showAdminCommunicationToast("A imagem ainda nÃ£o foi gerada.", "danger");
    return;
  }
  downloadAdminRoundSummaryBlob(adminRoundSummaryState.previewBlob);
  showAdminCommunicationToast("Imagem baixada para o aparelho.");
};

window.shareAdminRoundSummaryImage = async () => {
  const blob = adminRoundSummaryState.previewBlob;
  if (!blob) {
    showAdminCommunicationToast("A imagem ainda nÃ£o foi gerada.", "danger");
    return;
  }

  const file = new File([blob], `resumo-da-rodada-${Date.now()}.png`, { type: "image/png" });
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({
        title: "Resumo da Rodada",
        files: [file]
      });
      return;
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
    console.warn("Falha ao compartilhar a imagem:", error);
  }

  downloadAdminRoundSummaryBlob(blob);
  showAdminCommunicationToast("Seu navegador nÃ£o permite compartilhar a imagem diretamente. A imagem foi baixada para vocÃª enviar manualmente no WhatsApp.", "warning");
};

window.generateAdminRoundSummaryImage = async () => {
  const selectedMatches = getAdminRoundSummarySelectedMatches();
  if (!selectedMatches.length) {
    showAdminCommunicationToast("Selecione ao menos 1 jogo para gerar o resumo.", "danger");
    return;
  }

  try {
    showAdminCommunicationToast("Gerando imagem do resumo...");
    const canvas = await buildAdminRoundSummaryCanvas(selectedMatches);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
    if (!blob) throw new Error("blob_unavailable");

    if (adminRoundSummaryState.previewUrl) {
      try { URL.revokeObjectURL(adminRoundSummaryState.previewUrl); } catch (error) {}
    }

    adminRoundSummaryState.previewBlob = blob;
    adminRoundSummaryState.previewUrl = URL.createObjectURL(blob);
    renderAdminRoundSummaryPreviewModal();
  } catch (error) {
    console.error("Erro ao gerar imagem do resumo:", error);
    showAdminCommunicationToast("NÃ£o foi possÃ­vel gerar a imagem do resumo.", "danger");
  }
};

window.openAdminRoundSummaryModal = async () => {
  window.__setAdminReturnTarget(() => window.openAdminMenu());
  const admin = await getCurrentAdminProfile(true);
  if (!admin) {
    alert("VocÃª nÃ£o tem permissÃ£o para acessar o resumo da rodada.");
    return;
  }

  const modal = document.getElementById("modalOverlay");
  const cont = document.getElementById("modalContainer");
  if (!modal || !cont) return;

  modal.classList.remove("hidden");
  cont.innerHTML = `
    <div class="w-full max-w-md bg-white rounded-none shadow-2xl overflow-hidden relative">
      <div class="p-6 text-center">
        <i class="fas fa-circle-notch fa-spin text-2xl text-[#006400] mb-3"></i>
        <p class="text-xs font-black text-slate-500 uppercase">Carregando resumo...</p>
      </div>
    </div>
  `;

  try {
    adminRoundSummaryState.loading = true;
    adminRoundSummaryState.previewBlob = null;
    if (adminRoundSummaryState.previewUrl) {
      try { URL.revokeObjectURL(adminRoundSummaryState.previewUrl); } catch (error) {}
      adminRoundSummaryState.previewUrl = "";
    }
    await loadAdminRoundSummaryData();
    renderAdminRoundSummarySelectionModal();
  } catch (error) {
    console.error("Erro ao abrir resumo da rodada:", error);
    cont.innerHTML = `
      <div class="bg-white p-6 text-center rounded shadow-xl">
        <p class="text-sm font-black text-red-600 mb-3">NÃ£o foi possÃ­vel carregar o resumo da rodada.</p>
        <button onclick="openAdminMenu()" class="bg-[#006400] text-white px-4 py-2 rounded font-black text-xs">Voltar</button>
      </div>
    `;
  } finally {
    adminRoundSummaryState.loading = false;
  }
};

const getRoundsSettingsRef = () => doc(db, "settings", "rounds");

const dedupeRoundNames = (items = []) => {
  const seen = new Set();
  const output = [];

  items.forEach((item) => {
    const value = normalizeRoundName(item);
    if (!value) return;
    const key = normalizeAdminText(value);
    if (seen.has(key)) return;
    seen.add(key);
    output.push(value);
  });

  return output;
};

const readRoundSettingsState = (snap) => {
  const data = snap?.data?.() || {};
  return {
    items: dedupeRoundNames(Array.isArray(data.items) ? data.items : []),
    inactiveItems: dedupeRoundNames(Array.isArray(data.inactiveItems) ? data.inactiveItems : [])
  };
};

const ensureRoundSettingsDoc = async () => {
  const ref = getRoundsSettingsRef();
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const emptyState = { items: [], inactiveItems: [] };
    await setDoc(ref, emptyState, { merge: true });
    return emptyState;
  }

  const current = readRoundSettingsState(snap);
  const raw = snap.data() || {};
  const patch = {};
  if (!Array.isArray(raw.items)) patch.items = [];
  if (!Array.isArray(raw.inactiveItems)) patch.inactiveItems = [];
  if (Object.keys(patch).length > 0) {
    await setDoc(ref, patch, { merge: true });
  }

  return current;
};

const migrateAdminRoundsToSettings = async (settingsState) => {
  if (!settingsState || (settingsState.items || []).length > 0) return settingsState;

  try {
    const legacySnap = await getDocs(query(collection(db, "admin_rounds"), orderBy("order", "asc")));
    const legacyItems = [];

    legacySnap.forEach((snap) => {
      const data = snap.data() || {};
      if (data.active === false) return;
      const value = normalizeRoundName(data.name || "");
      if (value) legacyItems.push(value);
    });

    const items = dedupeRoundNames(legacyItems);
    if (items.length === 0) return settingsState;

    const nextState = {
      items,
      inactiveItems: dedupeRoundNames(settingsState.inactiveItems || [])
    };

    await setDoc(getRoundsSettingsRef(), nextState, { merge: true });
    invalidateRuntimeCache("doc:settings:rounds");
    return nextState;
  } catch (error) {
    console.warn("Falha na migraÃ§Ã£o de admin_rounds para settings/rounds:", error);
    return settingsState;
  }
};

const loadAdminRounds = async ({ force = false, migrate = true } = {}) => {
  let state = await readWithRuntimeCache(
    "doc:settings:rounds",
    () => ensureRoundSettingsDoc(),
    { ttlMs: DATA_CACHE_TTL.cold, force }
  );

  if (migrate) {
    state = await migrateAdminRoundsToSettings(state);
  }

  return {
    items: dedupeRoundNames(state.items || []),
    inactiveItems: dedupeRoundNames(state.inactiveItems || [])
  };
};

const persistRoundsSettingsState = async (items = [], inactiveItems = [], action = "update_rounds", payload = {}) => {
  const nextState = {
    items: dedupeRoundNames(items),
    inactiveItems: dedupeRoundNames(inactiveItems)
  };

  await setDoc(
    getRoundsSettingsRef(),
    {
      ...nextState,
      updatedAt: Timestamp.fromDate(new Date())
    },
    { merge: true }
  );

  invalidateRuntimeCache("doc:settings:rounds");
  await logAdminRoundAction(action, {
    source: "settings/rounds",
    oldItems: payload.oldItems || [],
    newItems: payload.newItems || nextState.items,
    oldInactiveItems: payload.oldInactiveItems || [],
    newInactiveItems: payload.newInactiveItems || nextState.inactiveItems,
    ...payload
  });

  return nextState;
};

const logAdminRoundAction = async (type, payload = {}) => {
  try {
    const admin = await getCurrentAdminProfile();
    if (!admin) return;

    await addDoc(collection(db, "admin_audit_logs"), {
      type,
      adminUid: admin.uid || "",
      adminName: admin.name || "",
      adminEmail: admin.email || "",
      source: "settings/rounds",
      ...payload,
      createdAt: Timestamp.fromDate(new Date())
    });
  } catch (error) {
    console.warn("Falha ao registrar auditoria de rodada:", error);
  }
};

const getCompetitionsSettingsRef = () => doc(db, "settings", "competitions");

const normalizeCompetitionName = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeCompetitionItem = (item = {}) => ({
  name: normalizeCompetitionName(item.name || ""),
  logo: String(item.logo || "").trim(),
  active: item.active === true
});

const dedupeCompetitionItems = (items = []) => {
  const seen = new Set();
  const output = [];

  items.forEach((item) => {
    const normalized = normalizeCompetitionItem(item);
    if (!normalized.name) return;
    const key = normalizeAdminText(normalized.name);
    if (seen.has(key)) return;
    seen.add(key);
    output.push(normalized);
  });

  return output;
};

const readCompetitionSettingsState = (snap) => {
  const data = snap?.data?.() || {};
  return {
    items: dedupeCompetitionItems(Array.isArray(data.items) ? data.items : [])
  };
};

const ensureCompetitionSettingsDoc = async () => {
  const ref = getCompetitionsSettingsRef();
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const emptyState = { items: [] };
    await setDoc(ref, emptyState, { merge: true });
    return emptyState;
  }

  const current = readCompetitionSettingsState(snap);
  const raw = snap.data() || {};
  if (!Array.isArray(raw.items)) {
    await setDoc(ref, { items: [] }, { merge: true });
  }

  return current;
};

const loadAdminCompetitions = async ({ force = false } = {}) => {
  const state = await readWithRuntimeCache(
    "doc:settings:competitions",
    () => ensureCompetitionSettingsDoc(),
    { ttlMs: DATA_CACHE_TTL.cold, force }
  );

  return {
    items: dedupeCompetitionItems(state.items || [])
  };
};

const logAdminCompetitionAction = async (type, payload = {}) => {
  try {
    const admin = await getCurrentAdminProfile();
    if (!admin) return;

    await addDoc(collection(db, "admin_audit_logs"), {
      type,
      adminUid: admin.uid || "",
      adminName: admin.name || "",
      adminEmail: admin.email || "",
      source: "settings/competitions",
      ...payload,
      createdAt: Timestamp.fromDate(new Date())
    });
  } catch (error) {
    console.warn("Falha ao registrar auditoria de competiÃ§Ã£o:", error);
  }
};

const persistCompetitionSettingsState = async (items = [], action = "update_competition", payload = {}) => {
  const nextState = {
    items: dedupeCompetitionItems(items)
  };

  await setDoc(
    getCompetitionsSettingsRef(),
    {
      ...nextState,
      updatedAt: Timestamp.fromDate(new Date())
    },
    { merge: true }
  );

  invalidateRuntimeCache("doc:settings:competitions");
  await logAdminCompetitionAction(action, {
    source: "settings/competitions",
    oldItems: payload.oldItems || [],
    newItems: payload.newItems || nextState.items,
    ...payload
  });

  return nextState;
};

const refreshAdminCompetitionsState = async () => {
  const state = await loadAdminCompetitions({ force: true });
  adminCreationState.competitionItems = state.items || [];
  adminCreationState.competitions = (state.items || []).filter((item) => item.active === true);
  invalidateRuntimeCache("doc:settings:competitions");
  return state;
};

const findAdminCompetitionDuplicate = (competitionName, ignoreName = "") => {
  const normalized = normalizeAdminText(competitionName);
  const ignoreNormalized = normalizeAdminText(ignoreName);
  const active = (adminCreationState.competitionItems || []).find((item) => {
    const itemNormalized = normalizeAdminText(item.name || "");
    return itemNormalized === normalized && itemNormalized !== ignoreNormalized && item.active === true;
  });
  const inactive = (adminCreationState.competitionItems || []).find((item) => {
    const itemNormalized = normalizeAdminText(item.name || "");
    return itemNormalized === normalized && itemNormalized !== ignoreNormalized && item.active !== true;
  });
  return { active, inactive };
};

const getTeamThumbHtml = (fieldSide, logoUrl = "") => {
  const ids = getAdminCreationTeamFieldIds(fieldSide);
  const hasLogo = isHttpUrl(logoUrl);

  return `
    <div id="${ids.thumb}" class="admin-team-thumb">
      <img id="${ids.thumbImg}" src="${hasLogo ? logoUrl : ""}" class="${hasLogo ? "" : "hidden"}" alt="Logo do time">
      <i id="${ids.thumbFallback}" class="fas fa-shield-alt text-gray-400 ${hasLogo ? "hidden" : ""}"></i>
    </div>
  `;
};

const getCompetitionThumbHtml = (logoUrl = "") => {
  const hasLogo = isHttpUrl(logoUrl);
  return `
    <div class="admin-competition-thumb">
      <img id="adminCompetitionThumbImg" src="${hasLogo ? logoUrl : ""}" class="${hasLogo ? "" : "hidden"}" alt="Logo da competiÃ§Ã£o">
      <i id="adminCompetitionThumbFallback" class="fas fa-trophy text-gray-400 ${hasLogo ? "hidden" : ""}"></i>
    </div>
  `;
};

const buildAdminTeamSuggestions = (fieldSide) => {
  const ids = getAdminCreationTeamFieldIds(fieldSide);
  const input = document.getElementById(ids.name);
  const panel = document.getElementById(ids.suggestions);
  if (!input || !panel) return;

  const queryText = normalizeAdminText(input.value);
  const teams = Array.isArray(adminCreationState.teams) ? adminCreationState.teams : [];
  const filtered = queryText
    ? teams.filter((team) => {
        const teamName = normalizeAdminText(team.name || "");
        const normalizedName = normalizeAdminText(team.normalizedName || "");
        return teamName.includes(queryText) || normalizedName.includes(queryText);
      })
    : teams.slice(0, 6);

  if (!input.value.trim()) {
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }

  if (filtered.length === 0) {
    panel.innerHTML = `<div class="px-3 py-2 text-[11px] text-gray-400">Nenhum time encontrado.</div>`;
    panel.classList.remove("hidden");
    return;
  }

  panel.innerHTML = filtered.slice(0, 6).map((team) => {
    const logo = isHttpUrl(team.logoUrl || "") ? team.logoUrl : "";
    return `
      <button
        type="button"
        onmousedown="window.selectAdminTeam('${fieldSide}', '${escapeJsString(team.name || "")}', '${escapeJsString(logo)}')"
        class="admin-team-suggestion"
      >
        <div class="admin-team-thumb admin-team-thumb--small">
          ${logo ? `<img src="${escapeHtml(logo)}" alt="Logo do time">` : `<i class="fas fa-shield-alt text-gray-400"></i>`}
        </div>
        <div class="min-w-0 text-left">
          <div class="text-[11px] font-black text-gray-800 truncate">${escapeHtml(team.name || "")}</div>
          <div class="text-[9px] text-gray-400 uppercase font-bold">${logo ? "Logo salva" : "Sem logo"}</div>
        </div>
      </button>
    `;
  }).join("");

  panel.classList.remove("hidden");
};

const renderAdminCreationModal = () => {
  const modal = document.getElementById("modalOverlay");
  const cont = document.getElementById("modalContainer");
  if (!modal || !cont) return;

  const activeCompetitions = Array.isArray(adminCreationState.competitions) ? adminCreationState.competitions : [];
  const competitionItems = Array.isArray(adminCreationState.competitionItems) ? adminCreationState.competitionItems : activeCompetitions;
  const competitionValue = adminCreationState.selectedCompetition || "";
  const roundValue = adminCreationState.selectedRound || "";
  const hasCompetitions = activeCompetitions.length > 0;
  const hasRounds = (adminCreationState.rounds || []).length > 0;

  const competitionOptions = activeCompetitions
    .map((competition) => `<option value="${escapeHtml(competition.name || "")}" data-logo="${escapeHtml(competition.logo || "")}" ${competition.name === competitionValue ? "selected" : ""}>${escapeHtml(competition.name || "")}</option>`)
    .join("");

  const roundOptions = (adminCreationState.rounds || [])
    .map((round) => `<option value="${escapeHtml(round)}" ${round === roundValue ? "selected" : ""}>${escapeHtml(round)}</option>`)
    .join("");

  const introCard = `
    <div class="admin-creation-panel space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-[10px] font-black text-[#006400] uppercase tracking-[0.18em]">Novo confronto</div>
          <h4 class="text-lg font-black text-gray-900 leading-tight">Abra o cadastro e publique um jogo novo.</h4>
        </div>
        <span class="status-chip status-chip--success">Admin</span>
      </div>
      <p class="text-xs text-gray-500 leading-relaxed">
        Escolha competiÃ§Ã£o, rodada, times, logos e prazo de votaÃ§Ã£o. O fluxo estÃ¡ pronto para a home web/PWA.
      </p>
      <button type="button" onclick="window.openNewMatchForm()" class="w-full bg-[#006400] text-white py-3 rounded-2xl font-black text-xs shadow-lg btn-press flex items-center justify-center gap-2">
        <i class="fas fa-plus-circle text-base"></i>
        Abrir Novo Confronto
      </button>
      <div class="grid grid-cols-3 gap-2 pt-1">
        <div class="admin-mini-chip"><i class="fas fa-shield-alt"></i><span>Atualiza lista</span></div>
        <div class="admin-mini-chip"><i class="fas fa-whatsapp"></i><span>Compartilha jogo</span></div>
        <div class="admin-mini-chip"><i class="fas fa-mobile-screen-button"></i><span>Pronto para celular</span></div>
      </div>
    </div>
  `;

  const roundsSoonCard = `
    <div class="admin-creation-panel space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-[10px] font-black text-[#006400] uppercase tracking-[0.18em]">Rodadas</div>
          <h4 class="text-lg font-black text-gray-900 leading-tight">Gerencie as fases do app.</h4>
        </div>
        <span class="status-chip status-chip--default">${(adminCreationState.rounds || []).length}</span>
      </div>
      <p class="text-xs text-gray-500 leading-relaxed">
        As rodadas ativas aparecem no menu de Novo Confronto na mesma ordem definida aqui.
      </p>
      <button type="button" onclick="window.openAdminRoundsManager()" class="w-full bg-[#006400] text-white py-3 rounded-2xl font-black text-xs shadow-lg btn-press flex items-center justify-center gap-2">
        <i class="fas fa-list-ol text-base"></i>
        Abrir Rodadas
      </button>
      <div class="admin-round-preview">
        ${(adminCreationState.rounds || []).slice(0, 4).map((round) => `<span>${escapeHtml(round)}</span>`).join("") || '<span>Nenhuma rodada ativa</span>'}
      </div>
    </div>
  `;

  const competitionPreviewHtml = activeCompetitions.slice(0, 4).map((competition) => `
    <span>
      ${competition.logo ? `<img src="${escapeHtml(competition.logo)}" alt="">` : '<i class="fas fa-trophy"></i>'}
      <b>${escapeHtml(competition.name || "")}</b>
    </span>
  `).join("") || '<span><i class="fas fa-trophy"></i><b>Nenhuma ativa</b></span>';

  const competitionsSoonCard = `
    <div class="admin-creation-panel space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-[10px] font-black text-[#006400] uppercase tracking-[0.18em]">CompetiÃ§Ãµes</div>
          <h4 class="text-lg font-black text-gray-900 leading-tight">Gerencie nomes e logos oficiais.</h4>
        </div>
        <span class="status-chip status-chip--default">${competitionItems.length}</span>
      </div>
      <p class="text-xs text-gray-500 leading-relaxed">Gerencie as competiÃ§Ãµes exibidas no app.</p>
      <button type="button" onclick="window.openCompetitionsManager()" class="w-full bg-[#006400] text-white py-3 rounded-2xl font-black text-xs shadow-lg btn-press flex items-center justify-center gap-2">
        <i class="fas fa-trophy text-base"></i>
        Abrir CompetiÃ§Ãµes
      </button>
      <div class="admin-competition-preview">
        ${competitionPreviewHtml}
      </div>
    </div>
  `;

  const getTabButton = (key, label, icon, active = false, disabled = false) => `
    <button
      type="button"
      ${disabled ? "disabled" : `onclick="window.switchAdminCreationTab('${key}')"` }
      class="admin-creation-tab ${active ? "is-active" : ""} ${disabled ? "is-disabled" : ""}"
    >
      <i class="fas ${icon}"></i>
      <span>${label}</span>
      ${disabled ? '<small>Em breve</small>' : ''}
    </button>
  `;

  const formHtml = `
    <div class="admin-creation-panel space-y-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-[10px] font-black text-[#006400] uppercase tracking-[0.18em]">Novo confronto</div>
          <h4 class="text-lg font-black text-gray-900 leading-tight">Cadastro rÃ¡pido do jogo</h4>
        </div>
        <button type="button" onclick="window.openAdminMenu()" class="text-xs font-black text-gray-500">
          <i class="fas fa-arrow-left mr-1"></i> Voltar
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="admin-compact-label">CompetiÃ§Ã£o</label>
          <select id="adminMatchCompetition" class="admin-creation-input" ${hasCompetitions ? "" : "disabled"} onchange="window.handleAdminCompetitionChange()">
            <option value="">Selecione</option>
            ${competitionOptions}
          </select>
          ${hasCompetitions ? "" : '<p class="mt-2 text-[11px] font-bold text-red-600">Nenhuma competiÃ§Ã£o ativa disponÃ­vel.</p>'}
          <div class="mt-2 flex items-center gap-3">
            ${getCompetitionThumbHtml((competitionItems.find((item) => item.name === competitionValue) || {}).logo || "")}
            <div class="flex-1">
              <div class="text-[10px] font-bold uppercase text-gray-400 mb-1">Logo da competiÃ§Ã£o</div>
              <div class="text-xs text-gray-500">A imagem serÃ¡ usada no confronto e no destaque visual.</div>
            </div>
          </div>
        </div>
        <div>
          <label class="admin-compact-label">Rodada/Fase</label>
          <select id="adminMatchRound" class="admin-creation-input" ${hasRounds ? "" : "disabled"} onchange="window.handleAdminRoundChange()">
            <option value="">Selecione</option>
            ${roundOptions}
          </select>
          ${hasRounds ? "" : '<p class="mt-2 text-[11px] font-bold text-red-600">Nenhuma rodada ativa disponÃ­vel.</p>'}
        </div>
      </div>

      <div class="space-y-3">
        <div class="admin-team-card">
          <div class="flex items-center justify-between gap-2 mb-2">
            <label class="admin-compact-label mb-0">Time A</label>
            <button type="button" onclick="window.searchAdminTeamLogo('A')" class="admin-search-btn"><i class="fas fa-magnifying-glass"></i></button>
          </div>
          <div class="relative">
            <input id="adminTeamNameA" type="text" class="admin-creation-input pr-10" placeholder="Digite ou pesquise o time" oninput="window.refreshAdminTeamSuggestions('A')" onfocus="window.refreshAdminTeamSuggestions('A')" onblur="window.hideAdminTeamSuggestionsDelayed('A')">
            <div id="adminTeamSuggestionsA" class="admin-team-suggestions hidden"></div>
          </div>
          <div class="mt-3 flex items-center gap-3">
            ${getTeamThumbHtml("A")}
            <div class="flex-1">
              <div class="text-[10px] font-bold uppercase text-gray-400 mb-1">Miniatura da logo</div>
              <div class="text-xs text-gray-500">A imagem aparece quando o link da logo estiver preenchido.</div>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-center text-[#006400] font-black text-sm">X</div>

        <div class="admin-team-card">
          <div class="flex items-center justify-between gap-2 mb-2">
            <label class="admin-compact-label mb-0">Time B</label>
            <button type="button" onclick="window.searchAdminTeamLogo('B')" class="admin-search-btn"><i class="fas fa-magnifying-glass"></i></button>
          </div>
          <div class="relative">
            <input id="adminTeamNameB" type="text" class="admin-creation-input pr-10" placeholder="Digite ou pesquise o time" oninput="window.refreshAdminTeamSuggestions('B')" onfocus="window.refreshAdminTeamSuggestions('B')" onblur="window.hideAdminTeamSuggestionsDelayed('B')">
            <div id="adminTeamSuggestionsB" class="admin-team-suggestions hidden"></div>
          </div>
          <div class="mt-3 flex items-center gap-3">
            ${getTeamThumbHtml("B")}
            <div class="flex-1">
              <div class="text-[10px] font-bold uppercase text-gray-400 mb-1">Miniatura da logo</div>
              <div class="text-xs text-gray-500">A imagem aparece quando o link da logo estiver preenchido.</div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <button type="button" id="btnToggleAdminLogoFields" class="text-[11px] font-black uppercase text-[#006400]">
          <i class="fas fa-link mr-1"></i> Mostrar links das logos
        </button>
        <div id="adminLogoFields" class="hidden mt-3 space-y-3">
          <div>
            <label class="admin-compact-label">Link Logo A</label>
            <input id="adminTeamLogoA" type="url" class="admin-creation-input" placeholder="https://...">
          </div>
          <div>
            <label class="admin-compact-label">Link Logo B</label>
            <input id="adminTeamLogoB" type="url" class="admin-creation-input" placeholder="https://...">
          </div>
        </div>
      </div>

      <div>
        <label class="admin-compact-label">Data e Hora limite para votaÃ§Ã£o</label>
        <input id="adminMatchDeadline" type="datetime-local" class="admin-creation-input">
      </div>

      <label class="admin-check-row">
        <input id="adminMatchShareWhatsapp" type="checkbox" class="accent-[#006400]" checked>
        <span>Compartilhar no WhatsApp</span>
      </label>

      <label class="admin-check-row admin-check-row--disabled" title="SerÃ¡ implementado depois no Android.">
        <input type="checkbox" class="accent-[#006400]" disabled>
        <span>Enviar Push</span>
      </label>

      <div id="adminCreationStatus" class="hidden rounded-2xl border px-3 py-2 text-xs font-black"></div>

      <div class="grid grid-cols-3 gap-2">
        <button type="button" onclick="window.saveAdminMatch(true)" class="bg-[#F9A825] text-white py-3 rounded-2xl font-black text-[11px] shadow-lg btn-press">
          Salvar +1
        </button>
        <button type="button" onclick="window.saveAdminMatch(false)" class="bg-[#006400] text-white py-3 rounded-2xl font-black text-[11px] shadow-lg btn-press">
          Salvar
        </button>
        <button type="button" onclick="window.closeModal()" class="bg-gray-200 text-gray-800 py-3 rounded-2xl font-black text-[11px] shadow-lg btn-press">
          Cancelar
        </button>
      </div>
    </div>
  `;

  const tabContent = adminCreationState.stage === "form"
    ? formHtml
    : {
        "new-match": introCard,
        rounds: roundsSoonCard,
        competitions: competitionsSoonCard
      }[adminCreationState.tab] || introCard;

  cont.innerHTML = `
    <div class="w-full max-w-md bg-white rounded-none shadow-2xl overflow-hidden relative h-[88vh] flex flex-col">
      <img src="bg_painel_admin.jpeg" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover opacity-100">
      <div class="relative z-10 flex flex-col h-full bg-white/90">
        <div class="bg-[#006400] p-4 text-white flex items-center justify-between shadow-md shrink-0">
          <button onclick="openAdminMenu()" class="mr-3"><i class="fas fa-arrow-left text-xl"></i></button>
          <div class="flex-1">
            <h3 class="font-black uppercase text-lg leading-none">CriaÃ§Ã£o</h3>
            <p class="text-[10px] text-[#FFD700] font-bold">Novo confronto, rodadas e competiÃ§Ãµes</p>
          </div>
          <button onclick="closeModal()" class="ml-3"><i class="fas fa-times text-xl"></i></button>
        </div>

        <div class="px-3 pt-3 shrink-0">
          <div class="admin-creation-tabs">
            ${getTabButton("new-match", "Novo Confronto", "fa-futbol", adminCreationState.tab === "new-match", false)}
            ${getTabButton("rounds", "Rodadas", "fa-list-ol", adminCreationState.tab === "rounds", false)}
            ${getTabButton("competitions", "CompetiÃ§Ãµes", "fa-trophy", adminCreationState.tab === "competitions", false)}
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-3">
          ${tabContent}
        </div>
      </div>
    </div>
  `;

  const deadlineInput = document.getElementById("adminMatchDeadline");
  if (deadlineInput && !deadlineInput.value) {
    deadlineInput.value = formatAdminDateTimeInput(new Date(Date.now() + 60 * 60 * 1000));
  }

  const teamAName = document.getElementById("adminTeamNameA");
  const teamBName = document.getElementById("adminTeamNameB");
  const teamALogo = document.getElementById("adminTeamLogoA");
  const teamBLogo = document.getElementById("adminTeamLogoB");
  const toggleLinksBtn = document.getElementById("btnToggleAdminLogoFields");
  const linksWrap = document.getElementById("adminLogoFields");

  if (teamAName) teamAName.addEventListener("input", () => window.refreshAdminTeamSuggestions("A"));
  if (teamBName) teamBName.addEventListener("input", () => window.refreshAdminTeamSuggestions("B"));
  if (teamALogo) teamALogo.addEventListener("input", () => window.updateAdminTeamPreview("A"));
  if (teamBLogo) teamBLogo.addEventListener("input", () => window.updateAdminTeamPreview("B"));
  if (toggleLinksBtn && linksWrap) {
    toggleLinksBtn.onclick = () => {
      const hidden = linksWrap.classList.toggle("hidden");
      toggleLinksBtn.innerHTML = hidden
        ? '<i class="fas fa-link mr-1"></i> Mostrar links das logos'
        : '<i class="fas fa-eye-slash mr-1"></i> Ocultar links das logos';
    };
  }

  window.updateAdminTeamPreview("A");
  window.updateAdminTeamPreview("B");
};

window.refreshAdminTeamSuggestions = (fieldSide) => {
  buildAdminTeamSuggestions(fieldSide);
};

window.hideAdminTeamSuggestionsDelayed = (fieldSide) => {
  setTimeout(() => {
    const ids = getAdminCreationTeamFieldIds(fieldSide);
    const panel = document.getElementById(ids.suggestions);
    if (panel) {
      panel.classList.add("hidden");
    }
  }, 130);
};

window.selectAdminTeam = (fieldSide, name, logoUrl) => {
  const ids = getAdminCreationTeamFieldIds(fieldSide);
  const nameInput = document.getElementById(ids.name);
  const logoInput = document.getElementById(ids.logo);
  const panel = document.getElementById(ids.suggestions);

  if (nameInput) nameInput.value = name || "";
  if (logoInput) logoInput.value = logoUrl || "";
  if (panel) panel.classList.add("hidden");
  window.updateAdminTeamPreview(fieldSide);
};

window.updateAdminTeamPreview = (fieldSide) => {
  const ids = getAdminCreationTeamFieldIds(fieldSide);
  const logoInput = document.getElementById(ids.logo);
  const img = document.getElementById(ids.thumbImg);
  const fallback = document.getElementById(ids.thumbFallback);
  if (!logoInput || !img || !fallback) return;

  const logoUrl = logoInput.value.trim();
  const valid = isHttpUrl(logoUrl);

  if (valid) {
    img.src = logoUrl;
    img.classList.remove("hidden");
    fallback.classList.add("hidden");
  } else {
    img.src = "";
    img.classList.add("hidden");
    fallback.classList.remove("hidden");
  }
};

window.updateAdminCompetitionPreview = () => {
  const select = document.getElementById("adminMatchCompetition");
  const img = document.getElementById("adminCompetitionThumbImg");
  const fallback = document.getElementById("adminCompetitionThumbFallback");
  if (!select || !img || !fallback) return;

  const selected = select.selectedOptions?.[0];
  const logoUrl = String(selected?.dataset?.logo || "").trim();
  const valid = isHttpUrl(logoUrl);

  if (valid) {
    img.src = logoUrl;
    img.classList.remove("hidden");
    fallback.classList.add("hidden");
  } else {
    img.src = "";
    img.classList.add("hidden");
    fallback.classList.remove("hidden");
  }
};

window.handleAdminCompetitionChange = () => {
  const select = document.getElementById("adminMatchCompetition");
  adminCreationState.selectedCompetition = String(select?.value || "").trim();
  window.updateAdminCompetitionPreview();
};

window.handleAdminRoundChange = () => {
  const select = document.getElementById("adminMatchRound");
  adminCreationState.selectedRound = String(select?.value || "").trim();
};

window.searchAdminTeamLogo = (fieldSide) => {
  const ids = getAdminCreationTeamFieldIds(fieldSide);
  const nameInput = document.getElementById(ids.name);
  const teamName = String(nameInput?.value || "").trim();

  if (!teamName) {
    alert("Digite o nome do time antes de pesquisar o escudo.");
    return;
  }

  const query = encodeURIComponent(`escudo ${teamName} PNG`);
  window.open(`https://www.google.com/search?q=${query}`, "_blank", "noopener");
};

window.openCreationModal = async () => {
  window.__setAdminReturnTarget(() => window.openAdminMenu());
  const admin = await getCurrentAdminProfile(true);
  if (!admin) {
    alert("VocÃª nÃ£o tem permissÃ£o para acessar a criaÃ§Ã£o.");
    closeModal();
    return;
  }

  const modal = document.getElementById("modalOverlay");
  const cont = document.getElementById("modalContainer");
  if (!modal || !cont) return;

  adminCreationState = {
    ...adminCreationState,
    loading: true,
    tab: "new-match",
    stage: "intro",
    selectedCompetition: "",
    selectedRound: ""
  };

  modal.classList.remove("hidden");
  cont.innerHTML = `
    <div class="bg-white p-6 text-center rounded shadow-xl">
      <i class="fas fa-circle-notch fa-spin text-2xl text-[#006400] mb-3"></i>
      <p class="text-xs font-black text-gray-500 uppercase">Carregando criaÃ§Ã£o...</p>
    </div>
  `;

  try {
    await loadAdminCreationState();
    renderAdminCreationModal();
  } catch (error) {
    console.error("Erro ao abrir criaÃ§Ã£o:", error);
    cont.innerHTML = `
      <div class="bg-white p-6 text-center rounded shadow-xl">
        <p class="text-sm font-black text-red-600 mb-3">NÃ£o foi possÃ­vel carregar a criaÃ§Ã£o.</p>
        <button onclick="openAdminMenu()" class="bg-[#006400] text-white px-4 py-2 rounded font-black text-xs">Voltar</button>
      </div>
    `;
  }
};

window.switchAdminCreationTab = (tabKey) => {
  adminCreationState.tab = tabKey;
  adminCreationState.stage = "intro";
  renderAdminCreationModal();
};

window.openNewMatchForm = () => {
  window.__setAdminReturnTarget(() => window.openCreationModal());
  adminCreationState.stage = "form";
  renderAdminCreationModal();
};

window.switchAdminRoundsTab = (tabKey) => {
  adminCreationState.roundsTab = tabKey === "inactive" ? "inactive" : "active";
  adminCreationState.editingRoundName = "";
  renderAdminRoundsManager();
};

const renderAdminRoundsManager = () => {
  const modal = document.getElementById("modalOverlay");
  const cont = document.getElementById("modalContainer");
  if (!modal || !cont) return;

  const activeRounds = Array.isArray(adminCreationState.rounds) ? adminCreationState.rounds : [];
  const inactiveRounds = Array.isArray(adminCreationState.inactiveRounds) ? adminCreationState.inactiveRounds : [];
  const activeTab = adminCreationState.roundsTab === "inactive" ? "inactive" : "active";
  const list = activeTab === "inactive" ? inactiveRounds : activeRounds;
  const editingName = normalizeRoundName(adminCreationState.editingRoundName || "");
  const emptyMessage = activeTab === "inactive" ? "Nenhuma rodada inativa disponÃ­vel." : "Nenhuma rodada ativa disponÃ­vel.";
  const listHtml = list.length
    ? list.map((round, index) => {
        const safeRound = normalizeRoundName(round);
        const isEditing = activeTab === "active" && editingName && normalizeAdminText(editingName) === normalizeAdminText(safeRound);
        const isFirst = index === 0;
        const isLast = index === list.length - 1;

        return `
          <div class="admin-round-card">
            ${isEditing ? `
              <div class="flex-1 min-w-0">
                <input id="adminRoundEditName" type="text" value="${escapeHtml(safeRound)}" class="admin-creation-input" placeholder="Nome da rodada">
              </div>
              <div class="admin-round-actions">
                <button type="button" onclick="window.updateAdminRound('${escapeJsString(safeRound)}')" class="admin-round-icon admin-round-icon--ok" aria-label="Salvar"><i class="fas fa-check"></i></button>
                <button type="button" onclick="window.cancelAdminRoundEdit()" class="admin-round-icon" aria-label="Cancelar"><i class="fas fa-times"></i></button>
              </div>
            ` : activeTab === "active" ? `
              <div class="admin-round-order">${index + 1}</div>
              <div class="admin-round-name">${escapeHtml(safeRound)}</div>
              <div class="admin-round-actions">
                <button type="button" onclick="window.moveAdminRound('${escapeJsString(safeRound)}', -1)" ${isFirst ? "disabled" : ""} class="admin-round-icon" aria-label="Subir"><i class="fas fa-arrow-up"></i></button>
                <button type="button" onclick="window.moveAdminRound('${escapeJsString(safeRound)}', 1)" ${isLast ? "disabled" : ""} class="admin-round-icon" aria-label="Descer"><i class="fas fa-arrow-down"></i></button>
                <button type="button" onclick="window.startAdminRoundEdit('${escapeJsString(safeRound)}')" class="admin-round-icon" aria-label="Editar"><i class="fas fa-pen"></i></button>
                <button type="button" onclick="window.disableAdminRound('${escapeJsString(safeRound)}')" class="admin-round-icon admin-round-icon--danger" aria-label="Desativar"><i class="fas fa-trash"></i></button>
              </div>
            ` : `
              <div class="admin-round-order"><i class="fas fa-rotate-left"></i></div>
              <div class="admin-round-name">${escapeHtml(safeRound)}</div>
              <div class="admin-round-actions">
                <button type="button" onclick="window.restoreAdminRound('${escapeJsString(safeRound)}')" class="admin-round-icon admin-round-icon--ok" aria-label="Restaurar"><i class="fas fa-rotate-left"></i></button>
              </div>
            `}
          </div>
        `;
      }).join("")
    : `
      <div class="admin-creation-panel text-center">
        <p class="text-sm font-black text-gray-500">${emptyMessage}</p>
      </div>
    `;

  modal.classList.remove("hidden");
  cont.innerHTML = `
    <div class="w-full max-w-md bg-white rounded-none shadow-2xl overflow-hidden relative h-[88vh] flex flex-col">
      <img src="bg_painel_admin.jpeg" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover opacity-100">
      <div class="relative z-10 flex flex-col h-full bg-white/92">
        <div class="bg-[#006400] p-4 text-white flex items-center shadow-md shrink-0">
          <button onclick="openCreationModal()" class="mr-4"><i class="fas fa-arrow-left text-xl"></i></button>
          <div>
            <h3 class="font-black uppercase text-lg leading-none">Gerenciar Rodadas</h3>
            <p class="text-[10px] text-[#FFD700] font-bold">Ordem do dropdown de Novo Confronto</p>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-3 space-y-3">
          <div class="admin-creation-panel space-y-3">
            <div class="admin-round-tabs">
              <button type="button" onclick="window.switchAdminRoundsTab('active')" class="admin-round-tab ${activeTab === "active" ? "is-active" : ""}">Ativas <span>${activeRounds.length}</span></button>
              <button type="button" onclick="window.switchAdminRoundsTab('inactive')" class="admin-round-tab ${activeTab === "inactive" ? "is-active" : ""}">Inativas <span>${inactiveRounds.length}</span></button>
            </div>

            ${activeTab === "active" ? `
              <div class="flex gap-2">
                <input id="adminRoundNewName" type="text" class="admin-creation-input flex-1" placeholder="Nova Rodada">
                <button type="button" onclick="window.createAdminRound()" class="admin-round-add-btn btn-press" aria-label="Adicionar rodada">
                  <i class="fas fa-plus"></i>
                </button>
              </div>
              <p class="text-[11px] font-bold text-gray-500">Use as setas para definir a ordem no app</p>
            ` : `
              <p class="text-[11px] font-bold text-gray-500">Rodadas desativadas continuam salvas para restauraÃ§Ã£o.</p>
            `}

            <div id="adminRoundsStatus" class="hidden rounded-2xl border px-3 py-2 text-xs font-black"></div>
          </div>

          <div class="space-y-2">
            ${listHtml}
          </div>
        </div>
      </div>
    </div>
  `;

  if (activeTab === "active") {
    if (editingName) {
      setTimeout(() => document.getElementById("adminRoundEditName")?.focus(), 0);
    } else {
      setTimeout(() => document.getElementById("adminRoundNewName")?.focus(), 0);
    }
  }
};

const setAdminRoundsStatus = (message = "", tone = "success") => {
  const el = document.getElementById("adminRoundsStatus");
  if (!el) return;

  if (!message) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }

  el.classList.remove("hidden", "border-green-200", "bg-green-50", "text-green-700", "border-red-200", "bg-red-50", "text-red-700");
  el.classList.add(
    tone === "danger" ? "border-red-200" : "border-green-200",
    tone === "danger" ? "bg-red-50" : "bg-green-50",
    tone === "danger" ? "text-red-700" : "text-green-700"
  );
  el.textContent = message;
};

const refreshAdminRoundsState = async () => {
  const state = await loadAdminRounds({ force: true, migrate: true });
  adminCreationState.rounds = state.items || [];
  adminCreationState.inactiveRounds = state.inactiveItems || [];
  invalidateRuntimeCache("doc:settings:rounds");
  return state;
};

const findAdminRoundDuplicate = (roundName, ignoreId = "") => {
  const normalized = normalizeAdminText(roundName);
  const ignoreNormalized = normalizeAdminText(ignoreId);
  const active = (adminCreationState.rounds || []).find((round) => normalizeAdminText(round) === normalized && normalizeAdminText(round) !== ignoreNormalized);
  const inactive = (adminCreationState.inactiveRounds || []).find((round) => normalizeAdminText(round) === normalized);
  return { active, inactive };
};

window.openAdminRoundsManager = async () => {
  window.__setAdminReturnTarget(() => window.openCreationModal());
  const admin = await getCurrentAdminProfile(true);
  if (!admin) {
    alert("VocÃª nÃ£o tem permissÃ£o para gerenciar rodadas.");
    closeModal();
    return;
  }

  const modal = document.getElementById("modalOverlay");
  const cont = document.getElementById("modalContainer");
  if (!modal || !cont) return;

  modal.classList.remove("hidden");
  cont.innerHTML = `
    <div class="bg-white p-6 text-center rounded shadow-xl">
      <i class="fas fa-circle-notch fa-spin text-2xl text-[#006400] mb-3"></i>
      <p class="text-xs font-black text-gray-500 uppercase">Carregando rodadas...</p>
    </div>
  `;

  try {
    adminCreationState.editingRoundName = "";
    adminCreationState.roundsTab = "active";
    await refreshAdminRoundsState();
    renderAdminRoundsManager();
  } catch (error) {
    console.error("Erro ao abrir rodadas:", error);
    cont.innerHTML = `
      <div class="bg-white p-6 text-center rounded shadow-xl">
        <p class="text-sm font-black text-red-600 mb-3">NÃ£o foi possÃ­vel carregar as rodadas.</p>
        <button onclick="openCreationModal()" class="bg-[#006400] text-white px-4 py-2 rounded font-black text-xs">Voltar</button>
      </div>
    `;
  }
};

window.createAdminRound = async () => {
  const input = document.getElementById("adminRoundNewName");
  const name = normalizeRoundName(input?.value || "");
  if (!name) return setAdminRoundsStatus("Informe o nome da rodada.", "danger");
  const duplicate = findAdminRoundDuplicate(name);
  if (duplicate.active) return setAdminRoundsStatus("Essa rodada jÃ¡ existe.", "danger");
  if (duplicate.inactive) {
    if (!confirm("Essa rodada estÃ¡ inativa. Deseja restaurÃ¡-la?")) return;
    return window.restoreAdminRound(duplicate.inactive);
  }

  try {
    const state = await refreshAdminRoundsState();
    const nextItems = [...(state.items || []), name];
    const nextState = await persistRoundsSettingsState(nextItems, state.inactiveItems || [], "create_round", {
      roundName: name,
      newValue: name,
      oldItems: state.items || [],
      oldInactiveItems: state.inactiveItems || []
    });

    if (input) input.value = "";
    adminCreationState.rounds = nextState.items;
    adminCreationState.inactiveRounds = nextState.inactiveItems;
    renderAdminRoundsManager();
    setAdminRoundsStatus("Rodada salva!");
    await loadAdminCreationState();
  } catch (error) {
    console.error("Erro ao criar rodada:", error);
    setAdminRoundsStatus("NÃ£o foi possÃ­vel salvar a rodada.", "danger");
  }
};

window.startAdminRoundEdit = (roundName) => {
  adminCreationState.editingRoundName = normalizeRoundName(roundName);
  renderAdminRoundsManager();
};

window.cancelAdminRoundEdit = () => {
  adminCreationState.editingRoundName = "";
  renderAdminRoundsManager();
};

window.updateAdminRound = async (oldRoundName) => {
  const input = document.getElementById("adminRoundEditName");
  const name = normalizeRoundName(input?.value || "");
  const oldName = normalizeRoundName(oldRoundName);
  if (!name) return setAdminRoundsStatus("Informe o nome da rodada.", "danger");
  const duplicate = findAdminRoundDuplicate(name, oldName);
  if (duplicate.active || duplicate.inactive) return setAdminRoundsStatus("Essa rodada jÃ¡ existe.", "danger");

  try {
    const state = await refreshAdminRoundsState();
    const items = [...(state.items || [])];
    const index = items.findIndex((item) => normalizeAdminText(item) === normalizeAdminText(oldName));
    if (index < 0) return setAdminRoundsStatus("Rodada nÃ£o encontrada.", "danger");

    const oldItems = [...items];
    items[index] = name;
    const nextState = await persistRoundsSettingsState(items, state.inactiveItems || [], "update_round", {
      roundName: name,
      oldValue: oldName,
      newValue: name,
      oldItems,
      newItems: items,
      oldInactiveItems: state.inactiveItems || []
    });

    adminCreationState.editingRoundName = "";
    adminCreationState.rounds = nextState.items;
    adminCreationState.inactiveRounds = nextState.inactiveItems;
    renderAdminRoundsManager();
    setAdminRoundsStatus("Rodada atualizada!");
    await loadAdminCreationState();
  } catch (error) {
    console.error("Erro ao atualizar rodada:", error);
    setAdminRoundsStatus("NÃ£o foi possÃ­vel atualizar a rodada.", "danger");
  }
};

window.disableAdminRound = async (roundName) => {
  const targetName = normalizeRoundName(roundName);
  if (!targetName) return;
  if (!confirm("Remover esta rodada da lista de opÃ§Ãµes?")) return;

  try {
    const state = await refreshAdminRoundsState();
    const items = (state.items || []).filter((item) => normalizeAdminText(item) !== normalizeAdminText(targetName));
    if (items.length === (state.items || []).length) return setAdminRoundsStatus("Rodada nÃ£o encontrada.", "danger");

    const inactiveItems = [...(state.inactiveItems || [])];
    if (!inactiveItems.some((item) => normalizeAdminText(item) === normalizeAdminText(targetName))) {
      inactiveItems.push(targetName);
    }

    const nextState = await persistRoundsSettingsState(items, inactiveItems, "disable_round", {
      roundName: targetName,
      oldValue: targetName,
      newValue: "inactive",
      oldItems: state.items || [],
      oldInactiveItems: state.inactiveItems || []
    });

    adminCreationState.editingRoundName = "";
    adminCreationState.rounds = nextState.items;
    adminCreationState.inactiveRounds = nextState.inactiveItems;
    renderAdminRoundsManager();
    setAdminRoundsStatus("Rodada desativada. Ela nÃ£o aparecerÃ¡ em novos confrontos, mas continua salva para restauraÃ§Ã£o.");
    await loadAdminCreationState();
  } catch (error) {
    console.error("Erro ao remover rodada:", error);
    setAdminRoundsStatus("NÃ£o foi possÃ­vel remover a rodada.", "danger");
  }
};

window.restoreAdminRound = async (roundName) => {
  const targetName = normalizeRoundName(roundName);
  if (!targetName) return;

  try {
    const state = await refreshAdminRoundsState();
    const inactiveItems = (state.inactiveItems || []).filter((item) => normalizeAdminText(item) !== normalizeAdminText(targetName));
    if (inactiveItems.length === (state.inactiveItems || []).length) return setAdminRoundsStatus("Rodada nÃ£o encontrada.", "danger");

    const items = [...(state.items || [])];
    if (!items.some((item) => normalizeAdminText(item) === normalizeAdminText(targetName))) {
      items.push(targetName);
    }

    const nextState = await persistRoundsSettingsState(items, inactiveItems, "restore_round", {
      roundName: targetName,
      oldValue: "inactive",
      newValue: "active",
      oldItems: state.items || [],
      oldInactiveItems: state.inactiveItems || []
    });

    adminCreationState.rounds = nextState.items;
    adminCreationState.inactiveRounds = nextState.inactiveItems;
    adminCreationState.roundsTab = "inactive";
    renderAdminRoundsManager();
    setAdminRoundsStatus("Rodada restaurada!");
    await loadAdminCreationState();
  } catch (error) {
    console.error("Erro ao restaurar rodada:", error);
    setAdminRoundsStatus("NÃ£o foi possÃ­vel restaurar a rodada.", "danger");
  }
};

window.moveAdminRound = async (roundName, direction) => {
  const targetName = normalizeRoundName(roundName);
  const state = await refreshAdminRoundsState();
  const rounds = [...(state.items || [])];
  const currentIndex = rounds.findIndex((round) => normalizeAdminText(round) === normalizeAdminText(targetName));
  if (currentIndex < 0) return;

  const targetIndex = currentIndex + Number(direction || 0);
  if (targetIndex < 0 || targetIndex >= rounds.length) return;

  try {
    [rounds[currentIndex], rounds[targetIndex]] = [rounds[targetIndex], rounds[currentIndex]];
    const nextState = await persistRoundsSettingsState(rounds, state.inactiveItems || [], "reorder_round", {
      roundName: targetName,
      oldOrder: currentIndex + 1,
      newOrder: targetIndex + 1,
      oldItems: state.items || [],
      newItems: rounds,
      oldInactiveItems: state.inactiveItems || []
    });

    adminCreationState.rounds = nextState.items;
    adminCreationState.inactiveRounds = nextState.inactiveItems;
    renderAdminRoundsManager();
    setAdminRoundsStatus("Ordem atualizada!");
    await loadAdminCreationState();
  } catch (error) {
    console.error("Erro ao reordenar rodada:", error);
    setAdminRoundsStatus("NÃ£o foi possÃ­vel reordenar a rodada.", "danger");
  }
};

const setAdminCompetitionsStatus = (message = "", tone = "success") => {
  const el = document.getElementById("adminCompetitionsStatus");
  if (!el) return;

  if (!message) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }

  el.classList.remove("hidden", "border-green-200", "bg-green-50", "text-green-700", "border-red-200", "bg-red-50", "text-red-700");
  el.classList.add(
    tone === "danger" ? "border-red-200" : "border-green-200",
    tone === "danger" ? "bg-red-50" : "bg-green-50",
    tone === "danger" ? "text-red-700" : "text-green-700"
  );
  el.textContent = message;
};

const renderAdminCompetitionsManager = () => {
  const modal = document.getElementById("modalOverlay");
  const cont = document.getElementById("modalContainer");
  if (!modal || !cont) return;

  const allItems = Array.isArray(adminCreationState.competitionItems) ? adminCreationState.competitionItems : [];
  const activeItems = allItems.filter((item) => item.active === true);
  const inactiveItems = allItems.filter((item) => item.active !== true);
  const activeTab = adminCreationState.competitionsTab === "inactive" ? "inactive" : "active";
  const list = activeTab === "inactive" ? inactiveItems : activeItems;
  const editingName = normalizeCompetitionName(adminCreationState.editingCompetitionName || "");
  const emptyMessage = activeTab === "inactive"
    ? "Nenhuma competiÃ§Ã£o arquivada disponÃ­vel."
    : "Nenhuma competiÃ§Ã£o ativa disponÃ­vel.";

  const listHtml = list.length
    ? list.map((item) => {
        const safeName = normalizeCompetitionName(item.name || "");
        const safeLogo = String(item.logo || "").trim();
        const isEditing = editingName && normalizeAdminText(editingName) === normalizeAdminText(safeName);

        return `
          <div class="admin-competition-card ${activeTab === "inactive" ? "admin-competition-card--inactive" : ""}">
            ${isEditing ? `
              <div class="admin-competition-edit">
                <div class="admin-competition-thumb admin-competition-thumb--small">
                  ${safeLogo ? `<img src="${escapeHtml(safeLogo)}" alt="Logo da competiÃ§Ã£o">` : `<i class="fas fa-trophy text-gray-400"></i>`}
                </div>
                <div class="flex-1 min-w-0 space-y-2">
                  <input id="adminCompetitionEditName" type="text" value="${escapeHtml(safeName)}" class="admin-creation-input" placeholder="Nome da competiÃ§Ã£o">
                  <input id="adminCompetitionEditLogo" type="url" value="${escapeHtml(safeLogo)}" class="admin-creation-input" placeholder="URL do logo">
                </div>
                <div class="admin-competition-actions">
                  <button type="button" onclick="window.updateAdminCompetition('${escapeJsString(safeName)}')" class="admin-competition-icon admin-competition-icon--ok" aria-label="Salvar"><i class="fas fa-check"></i></button>
                  <button type="button" onclick="window.cancelAdminCompetitionEdit()" class="admin-competition-icon" aria-label="Cancelar"><i class="fas fa-times"></i></button>
                </div>
              </div>
            ` : `
              <div class="admin-competition-thumb">
                ${safeLogo ? `<img src="${escapeHtml(safeLogo)}" alt="Logo da competiÃ§Ã£o">` : `<i class="fas fa-trophy text-gray-400"></i>`}
              </div>
              <div class="admin-competition-name">${escapeHtml(safeName)}</div>
              <div class="admin-competition-actions">
                <button type="button" onclick="window.startAdminCompetitionEdit('${escapeJsString(safeName)}')" class="admin-competition-icon" aria-label="Editar"><i class="fas fa-pen"></i></button>
                ${activeTab === "active"
                  ? `<button type="button" onclick="window.disableAdminCompetition('${escapeJsString(safeName)}')" class="admin-competition-icon admin-competition-icon--danger" aria-label="Arquivar"><i class="fas fa-box-archive"></i></button>`
                  : `<button type="button" onclick="window.restoreAdminCompetition('${escapeJsString(safeName)}')" class="admin-competition-icon admin-competition-icon--ok" aria-label="Restaurar"><i class="fas fa-rotate-left"></i></button>`
                }
              </div>
            `}
          </div>
        `;
      }).join("")
    : `
      <div class="admin-creation-panel text-center">
        <p class="text-sm font-black text-gray-500">${emptyMessage}</p>
      </div>
    `;

  modal.classList.remove("hidden");
  cont.innerHTML = `
    <div class="w-full max-w-md bg-white rounded-none shadow-2xl overflow-hidden relative h-[88vh] flex flex-col">
      <img src="bg_painel_admin.jpeg" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover opacity-100">
      <div class="relative z-10 flex flex-col h-full bg-white/92">
        <div class="bg-[#006400] p-4 text-white flex items-center shadow-md shrink-0">
          <button onclick="openCreationModal()" class="mr-4"><i class="fas fa-arrow-left text-xl"></i></button>
          <div>
            <h3 class="font-black uppercase text-lg leading-none">CompetiÃ§Ãµes</h3>
            <p class="text-[10px] text-[#FFD700] font-bold">settings/competitions.items</p>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-3 space-y-3">
          <div class="admin-creation-panel space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-[10px] font-black text-[#006400] uppercase tracking-[0.18em]">Nova CompetiÃ§Ã£o</div>
                <h4 class="text-lg font-black text-gray-900 leading-tight">Cadastre nome, logo e ativaÃ§Ã£o.</h4>
              </div>
              <span class="status-chip status-chip--default">${allItems.length}</span>
            </div>

            <div>
              <label class="admin-compact-label">Nome</label>
              <div class="flex gap-2">
                <input id="adminCompetitionName" type="text" class="admin-creation-input flex-1" placeholder="Nome (ex: BrasileirÃ£o)">
                <button type="button" onclick="window.searchAdminCompetitionLogo()" class="admin-search-btn"><i class="fas fa-magnifying-glass"></i></button>
              </div>
            </div>

            <div>
              <label class="admin-compact-label">URL do Logo</label>
              <input id="adminCompetitionLogo" type="url" class="admin-creation-input" placeholder="https://..." oninput="window.updateAdminCompetitionFormPreview()">
              <div class="mt-2 flex items-center gap-3">
                ${getCompetitionThumbHtml("")}
                <div class="flex-1">
                  <div class="text-[10px] font-bold uppercase text-gray-400 mb-1">Miniatura da logo</div>
                  <div class="text-xs text-gray-500">Cole um link para visualizar a imagem salva.</div>
                </div>
              </div>
            </div>

            <button type="button" onclick="window.createAdminCompetition()" class="w-full bg-[#006400] text-white py-3 rounded-2xl font-black text-xs shadow-lg btn-press flex items-center justify-center gap-2">
              <i class="fas fa-save text-base"></i>
              Salvar
            </button>

            <div id="adminCompetitionsStatus" class="hidden rounded-2xl border px-3 py-2 text-xs font-black"></div>
          </div>

          <div class="admin-competition-tabs">
            <button type="button" onclick="window.switchAdminCompetitionsTab('active')" class="admin-competition-tab ${activeTab === "active" ? "is-active" : ""}">Ativas <span>${activeItems.length}</span></button>
            <button type="button" onclick="window.switchAdminCompetitionsTab('inactive')" class="admin-competition-tab ${activeTab === "inactive" ? "is-active" : ""}">Arquivadas <span>${inactiveItems.length}</span></button>
          </div>

          <div class="space-y-2">
            ${listHtml}
          </div>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    document.getElementById("adminCompetitionName")?.focus();
    window.updateAdminCompetitionFormPreview();
  }, 0);
};

window.openCompetitionsManager = async () => {
  window.__setAdminReturnTarget(() => window.openCreationModal());
  const admin = await getCurrentAdminProfile(true);
  if (!admin) {
    alert("VocÃª nÃ£o tem permissÃ£o para gerenciar competiÃ§Ãµes.");
    closeModal();
    return;
  }

  const modal = document.getElementById("modalOverlay");
  const cont = document.getElementById("modalContainer");
  if (!modal || !cont) return;

  modal.classList.remove("hidden");
  cont.innerHTML = `
    <div class="bg-white p-6 text-center rounded shadow-xl">
      <i class="fas fa-circle-notch fa-spin text-2xl text-[#006400] mb-3"></i>
      <p class="text-xs font-black text-gray-500 uppercase">Carregando competiÃ§Ãµes...</p>
    </div>
  `;

  try {
    adminCreationState.editingCompetitionName = "";
    adminCreationState.competitionsTab = "active";
    await refreshAdminCompetitionsState();
    renderAdminCompetitionsManager();
  } catch (error) {
    console.error("Erro ao abrir competiÃ§Ãµes:", error);
    cont.innerHTML = `
      <div class="bg-white p-6 text-center rounded shadow-xl">
        <p class="text-sm font-black text-red-600 mb-3">NÃ£o foi possÃ­vel carregar as competiÃ§Ãµes.</p>
        <button onclick="openCreationModal()" class="bg-[#006400] text-white px-4 py-2 rounded font-black text-xs">Voltar</button>
      </div>
    `;
  }
};

window.switchAdminCompetitionsTab = (tabKey) => {
  adminCreationState.competitionsTab = tabKey === "inactive" ? "inactive" : "active";
  adminCreationState.editingCompetitionName = "";
  renderAdminCompetitionsManager();
};

window.updateAdminCompetitionFormPreview = () => {
  const input = document.getElementById("adminCompetitionLogo");
  const img = document.getElementById("adminCompetitionThumbImg");
  const fallback = document.getElementById("adminCompetitionThumbFallback");
  if (!input || !img || !fallback) return;

  const logoUrl = String(input.value || "").trim();
  const valid = isHttpUrl(logoUrl);

  if (valid) {
    img.src = logoUrl;
    img.classList.remove("hidden");
    fallback.classList.add("hidden");
  } else {
    img.src = "";
    img.classList.add("hidden");
    fallback.classList.remove("hidden");
  }
};

window.searchAdminCompetitionLogo = () => {
  const input = document.getElementById("adminCompetitionName");
  const competitionName = String(input?.value || "").trim();

  if (!competitionName) {
    alert("Digite o nome da competiÃ§Ã£o antes de pesquisar.");
    return;
  }

  const query = encodeURIComponent(`escudo ${competitionName} PNG`);
  window.open(`https://www.google.com/search?tbm=isch&q=${query}`, "_blank", "noopener");
};

window.startAdminCompetitionEdit = (competitionName) => {
  adminCreationState.editingCompetitionName = normalizeCompetitionName(competitionName);
  renderAdminCompetitionsManager();
};

window.cancelAdminCompetitionEdit = () => {
  adminCreationState.editingCompetitionName = "";
  renderAdminCompetitionsManager();
};

window.createAdminCompetition = async () => {
  const nameInput = document.getElementById("adminCompetitionName");
  const logoInput = document.getElementById("adminCompetitionLogo");
  const name = normalizeCompetitionName(nameInput?.value || "");
  const logo = String(logoInput?.value || "").trim();

  if (!name) return setAdminCompetitionsStatus("Informe o nome da competiÃ§Ã£o.", "danger");
  if (!logo) return setAdminCompetitionsStatus("Informe a URL do logo.", "danger");
  if (!isHttpUrl(logo)) return setAdminCompetitionsStatus("A URL do logo precisa comeÃ§ar com http:// ou https://.", "danger");

  const duplicate = findAdminCompetitionDuplicate(name);
  if (duplicate.active) return setAdminCompetitionsStatus("Essa competiÃ§Ã£o jÃ¡ existe.", "danger");

  try {
    const state = await refreshAdminCompetitionsState();
    const oldItems = [...(state.items || [])];

    if (duplicate.inactive) {
      if (!confirm("Essa competiÃ§Ã£o estÃ¡ arquivada. Deseja restaurÃ¡-la?")) return;
      const nextItems = oldItems.map((item) => {
        if (normalizeAdminText(item.name || "") !== normalizeAdminText(name)) return item;
        return {
          ...item,
          name,
          logo,
          active: true
        };
      });
      const nextState = await persistCompetitionSettingsState(nextItems, "restore_competition", {
        competitionName: name,
        oldValue: duplicate.inactive,
        newValue: { name, logo, active: true },
        oldItems,
        newItems: nextItems
      });

      if (nameInput) nameInput.value = "";
      if (logoInput) logoInput.value = "";
      adminCreationState.competitionItems = nextState.items;
      adminCreationState.competitions = nextState.items.filter((item) => item.active === true);
      renderAdminCompetitionsManager();
      setAdminCompetitionsStatus("CompetiÃ§Ã£o restaurada!");
      await loadAdminCreationState();
      window.updateAdminCompetitionFormPreview();
      return;
    }

    const nextItems = [...oldItems, { name, logo, active: true }];
    const nextState = await persistCompetitionSettingsState(nextItems, "create_competition", {
      competitionName: name,
      newValue: { name, logo, active: true },
      oldItems,
      newItems: nextItems
    });

    if (nameInput) nameInput.value = "";
    if (logoInput) logoInput.value = "";
    adminCreationState.competitionItems = nextState.items;
    adminCreationState.competitions = nextState.items.filter((item) => item.active === true);
    renderAdminCompetitionsManager();
    setAdminCompetitionsStatus("CompetiÃ§Ã£o salva!");
    await loadAdminCreationState();
    window.updateAdminCompetitionFormPreview();
  } catch (error) {
    console.error("Erro ao criar competiÃ§Ã£o:", error);
    setAdminCompetitionsStatus("NÃ£o foi possÃ­vel salvar a competiÃ§Ã£o.", "danger");
  }
};

window.updateAdminCompetition = async (oldCompetitionName) => {
  const nameInput = document.getElementById("adminCompetitionEditName");
  const logoInput = document.getElementById("adminCompetitionEditLogo");
  const name = normalizeCompetitionName(nameInput?.value || "");
  const logo = String(logoInput?.value || "").trim();
  const oldName = normalizeCompetitionName(oldCompetitionName);

  if (!name) return setAdminCompetitionsStatus("Informe o nome da competiÃ§Ã£o.", "danger");
  if (!logo) return setAdminCompetitionsStatus("Informe a URL do logo.", "danger");
  if (!isHttpUrl(logo)) return setAdminCompetitionsStatus("A URL do logo precisa comeÃ§ar com http:// ou https://.", "danger");

  const duplicate = findAdminCompetitionDuplicate(name, oldName);
  if (duplicate.active || duplicate.inactive) return setAdminCompetitionsStatus("Essa competiÃ§Ã£o jÃ¡ existe.", "danger");

  try {
    const state = await refreshAdminCompetitionsState();
    const items = [...(state.items || [])];
    const index = items.findIndex((item) => normalizeAdminText(item.name || "") === normalizeAdminText(oldName));
    if (index < 0) return setAdminCompetitionsStatus("CompetiÃ§Ã£o nÃ£o encontrada.", "danger");

    const oldItems = [...items];
    items[index] = {
      ...items[index],
      name,
      logo
    };
    const nextState = await persistCompetitionSettingsState(items, "update_competition", {
      competitionName: name,
      oldValue: oldItems[index],
      newValue: items[index],
      oldItems,
      newItems: items
    });

    adminCreationState.editingCompetitionName = "";
    adminCreationState.competitionItems = nextState.items;
    adminCreationState.competitions = nextState.items.filter((item) => item.active === true);
    renderAdminCompetitionsManager();
    setAdminCompetitionsStatus("CompetiÃ§Ã£o atualizada!");
    await loadAdminCreationState();
    window.updateAdminCompetitionFormPreview();
  } catch (error) {
    console.error("Erro ao atualizar competiÃ§Ã£o:", error);
    setAdminCompetitionsStatus("NÃ£o foi possÃ­vel atualizar a competiÃ§Ã£o.", "danger");
  }
};

window.disableAdminCompetition = async (competitionName) => {
  const targetName = normalizeCompetitionName(competitionName);
  if (!targetName) return;
  if (!confirm("Arquivar esta competiÃ§Ã£o? Ela deixarÃ¡ de aparecer em novos confrontos, mas continuarÃ¡ salva para restauraÃ§Ã£o.")) return;

  try {
    const state = await refreshAdminCompetitionsState();
    const oldItems = [...(state.items || [])];
    const items = oldItems.map((item) => {
      if (normalizeAdminText(item.name || "") !== normalizeAdminText(targetName)) return item;
      return {
        ...item,
        active: false
      };
    });

    if (!items.some((item) => normalizeAdminText(item.name || "") === normalizeAdminText(targetName))) {
      return setAdminCompetitionsStatus("CompetiÃ§Ã£o nÃ£o encontrada.", "danger");
    }

    const nextState = await persistCompetitionSettingsState(items, "disable_competition", {
      competitionName: targetName,
      oldValue: oldItems.find((item) => normalizeAdminText(item.name || "") === normalizeAdminText(targetName)) || null,
      newValue: items.find((item) => normalizeAdminText(item.name || "") === normalizeAdminText(targetName)) || null,
      oldItems,
      newItems: items
    });

    adminCreationState.editingCompetitionName = "";
    adminCreationState.competitionItems = nextState.items;
    adminCreationState.competitions = nextState.items.filter((item) => item.active === true);
    renderAdminCompetitionsManager();
    setAdminCompetitionsStatus("CompetiÃ§Ã£o arquivada. Ela nÃ£o aparecerÃ¡ em novos confrontos, mas continua salva para restauraÃ§Ã£o.");
    await loadAdminCreationState();
  } catch (error) {
    console.error("Erro ao arquivar competiÃ§Ã£o:", error);
    setAdminCompetitionsStatus("NÃ£o foi possÃ­vel arquivar a competiÃ§Ã£o.", "danger");
  }
};

window.restoreAdminCompetition = async (competitionName, nextLogo = "") => {
  const targetName = normalizeCompetitionName(competitionName);
  if (!targetName) return;

  try {
    const state = await refreshAdminCompetitionsState();
    const oldItems = [...(state.items || [])];
    let changed = false;
    const items = oldItems.map((item) => {
      if (normalizeAdminText(item.name || "") !== normalizeAdminText(targetName)) return item;
      changed = true;
      return {
        ...item,
        logo: isHttpUrl(nextLogo) ? nextLogo.trim() : item.logo || "",
        active: true
      };
    });

    if (!changed) return setAdminCompetitionsStatus("CompetiÃ§Ã£o nÃ£o encontrada.", "danger");

    const nextState = await persistCompetitionSettingsState(items, "restore_competition", {
      competitionName: targetName,
      oldValue: oldItems.find((item) => normalizeAdminText(item.name || "") === normalizeAdminText(targetName)) || null,
      newValue: items.find((item) => normalizeAdminText(item.name || "") === normalizeAdminText(targetName)) || null,
      oldItems,
      newItems: items
    });

    adminCreationState.competitionItems = nextState.items;
    adminCreationState.competitions = nextState.items.filter((item) => item.active === true);
    adminCreationState.competitionsTab = "inactive";
    renderAdminCompetitionsManager();
    setAdminCompetitionsStatus("CompetiÃ§Ã£o restaurada!");
    await loadAdminCreationState();
  } catch (error) {
    console.error("Erro ao restaurar competiÃ§Ã£o:", error);
    setAdminCompetitionsStatus("NÃ£o foi possÃ­vel restaurar a competiÃ§Ã£o.", "danger");
  }
};

const setAdminCreationStatus = (message = "", tone = "success") => {
  const el = document.getElementById("adminCreationStatus");
  if (!el) return;

  if (!message) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }

  el.classList.remove("hidden", "border-green-200", "bg-green-50", "text-green-700", "border-red-200", "bg-red-50", "text-red-700");
  el.classList.add(
    tone === "danger" ? "border-red-200" : "border-green-200",
    tone === "danger" ? "bg-red-50" : "bg-green-50",
    tone === "danger" ? "text-red-700" : "text-green-700"
  );
  el.textContent = message;
};

const loadAdminCreationState = async () => {
  const [competitionsState, matchesSnap, teamsSnap, roundsState] = await Promise.all([
    loadAdminCompetitions({ force: true }).catch((error) => {
      console.warn("NÃ£o foi possÃ­vel carregar competiÃ§Ãµes.", error);
      return { items: [] };
    }),
    readWithRuntimeCache("col:matches", () => getDocs(collection(db, "matches")), { ttlMs: DATA_CACHE_TTL.hot, force: true }),
    readWithRuntimeCache("col:teams", () => getDocs(collection(db, "teams")), { ttlMs: DATA_CACHE_TTL.cold, force: true }).catch((error) => {
      console.warn("NÃ£o foi possÃ­vel carregar teams. Autocomplete seguirÃ¡ vazio.", error);
      return null;
    }),
    loadAdminRounds({ force: true, migrate: true }).catch((error) => {
      console.warn("NÃ£o foi possÃ­vel carregar rodadas.", error);
      return { items: [], inactiveItems: [] };
    })
  ]);

  const teams = [];
  if (teamsSnap) {
    teamsSnap.forEach((snap) => {
      const data = snap.data() || {};
      const name = String(data.name || "").trim();
      if (!name) return;
      teams.push({
        id: snap.id,
        name,
        logoUrl: String(data.logoUrl || data.logo || "").trim(),
        normalizedName: String(data.normalizedName || normalizeAdminText(name))
      });
    });
  }

  teams.sort((a, b) => a.name.localeCompare(b.name));

  adminCreationState = {
    ...adminCreationState,
    loading: false,
    competitionItems: (competitionsState.items || []).slice(),
    competitions: (competitionsState.items || []).filter((item) => item.active === true),
    rounds: (roundsState.items || []).slice(),
    inactiveRounds: (roundsState.inactiveItems || []).slice(),
    teams
  };
};

const getAdminMatchStatusInfo = (match = {}) => {
  const winnerLabel = String(match.winner || "").trim();
  if (winnerLabel) {
    return {
      label: `Finalizado â€¢ ${winnerLabel}`,
      tone: "success"
    };
  }

  const expired = match.expired === true || (match.deadlineDate instanceof Date && new Date() > match.deadlineDate);
  return {
    label: expired ? "Aguardando resultado" : "Em aberto",
    tone: expired ? "warning" : "default"
  };
};

const buildAdminMatchCompetitionOptions = (currentValue = "") => {
  const items = Array.isArray(adminCreationState.competitionItems) ? adminCreationState.competitionItems : [];
  const activeItems = items.filter((item) => item?.active === true);
  const normalizedCurrent = normalizeAdminText(currentValue);
  const hasCurrent = !normalizedCurrent
    ? true
    : activeItems.some((item) => normalizeAdminText(item.name || "") === normalizedCurrent);
  const currentItem = items.find((item) => normalizeAdminText(item.name || "") === normalizedCurrent) || null;
  const options = activeItems.slice();

  if (currentValue && !hasCurrent) {
    options.unshift({
      name: currentValue,
      logo: currentItem?.logo || "",
      active: false,
      _current: true
    });
  }

  return options
    .map((competition) => {
      const label = competition._current && competition.active !== true
        ? `${competition.name || ""} (atual)`
        : competition.name || "";
      return `<option value="${escapeHtml(competition.name || "")}" data-logo="${escapeHtml(competition.logo || "")}" ${normalizeAdminText(competition.name || "") === normalizedCurrent ? "selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");
};

const buildAdminMatchRoundOptions = (currentValue = "") => {
  const activeRounds = Array.isArray(adminCreationState.rounds) ? adminCreationState.rounds : [];
  const inactiveRounds = Array.isArray(adminCreationState.inactiveRounds) ? adminCreationState.inactiveRounds : [];
  const normalizedCurrent = normalizeAdminText(currentValue);
  const hasCurrent = !normalizedCurrent
    ? true
    : activeRounds.some((round) => normalizeAdminText(round) === normalizedCurrent);
  const currentRound = [...activeRounds, ...inactiveRounds].find((round) => normalizeAdminText(round) === normalizedCurrent) || "";
  const rounds = activeRounds.slice();

  if (currentValue && !hasCurrent) {
    rounds.unshift(currentRound || currentValue);
  }

  return rounds
    .map((round) => {
      const roundText = String(round || "").trim();
      const isCurrent = normalizeAdminText(roundText) === normalizedCurrent;
      const label = isCurrent && !activeRounds.some((item) => normalizeAdminText(item) === normalizedCurrent)
        ? `${roundText} (atual)`
        : roundText;
      return `<option value="${escapeHtml(roundText)}" ${isCurrent ? "selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");
};

const buildAdminMatchEditWarnings = (match = {}, guessCount = 0) => {
  const warnings = [];
  const finished = Boolean(String(match.winner || "").trim() || match.finishedAt || match.final === true || String(match.status || "").toLowerCase().includes("final"));
  if (finished) {
    warnings.push("AtenÃ§Ã£o: esta partida jÃ¡ possui resultado/finalizaÃ§Ã£o. Edite apenas informaÃ§Ãµes cadastrais se tiver certeza.");
  }
  if (Number(guessCount || 0) > 0) {
    warnings.push("Esta partida pode jÃ¡ possuir palpites. Alterar times ou prazo pode impactar a compreensÃ£o dos usuÃ¡rios.");
  }
  return warnings;
};

const persistAdminTeamIfNeeded = async (teamName = "", logoUrl = "") => {
  const cleanName = String(teamName || "").trim();
  const cleanLogo = String(logoUrl || "").trim();
  if (!cleanName || !cleanLogo || !isHttpUrl(cleanLogo)) return null;

  const normalizedName = normalizeAdminText(cleanName);
  const existing = (adminCreationState.teams || []).find((team) => normalizeAdminText(team.name || team.normalizedName || "") === normalizedName);
  if (existing) return existing;

  const nowTs = Timestamp.fromDate(new Date());
  try {
    const docRef = await addDoc(collection(db, "teams"), {
      name: cleanName,
      logoUrl: cleanLogo,
      normalizedName,
      createdAt: nowTs,
      updatedAt: nowTs
    });

    const savedTeam = {
      id: docRef.id,
      name: cleanName,
      logoUrl: cleanLogo,
      normalizedName
    };

    adminCreationState.teams = [savedTeam, ...(adminCreationState.teams || [])];
    invalidateRuntimeCache("col:teams");
    return savedTeam;
  } catch (error) {
    console.warn("NÃ£o foi possÃ­vel salvar o time para autocomplete:", error);
    return null;
  }
};

const logAdminMatchCreation = async ({ matchId, teamA, teamB, competition, round, deadline }) => {
  try {
    const admin = await getCurrentAdminProfile();
    if (!admin) return;

    await addDoc(collection(db, "admin_audit_logs"), {
      type: "create_match",
      adminUid: admin.uid || "",
      adminName: admin.name || "",
      adminEmail: admin.email || "",
      matchId: matchId || "",
      teams: {
        teamA,
        teamB
      },
      competition,
      round,
      deadline: deadline ? Timestamp.fromDate(deadline) : null,
      createdAt: Timestamp.fromDate(new Date())
    });
  } catch (error) {
    console.warn("Falha ao registrar auditoria do confronto:", error);
  }
};

const logAdminMatchUpdate = async ({ matchId, oldMatch = {}, newMatch = {} }) => {
  try {
    const admin = await getCurrentAdminProfile();
    if (!admin) return;

    await addDoc(collection(db, "admin_audit_logs"), {
      type: "update_match",
      adminUid: admin.uid || "",
      adminName: admin.name || "",
      adminEmail: admin.email || "",
      source: "matches",
      matchId: matchId || "",
      teams: {
        teamA: newMatch.teamA || oldMatch.teamA || "",
        teamB: newMatch.teamB || oldMatch.teamB || ""
      },
      competition: newMatch.competition || oldMatch.competition || "",
      round: newMatch.round || oldMatch.round || "",
      deadline: newMatch.deadline ? Timestamp.fromDate(newMatch.deadline) : (oldMatch.deadline ? oldMatch.deadline : null),
      oldValue: {
        teamA: oldMatch.teamA || "",
        teamB: oldMatch.teamB || "",
        teamAUrl: oldMatch.teamAUrl || "",
        teamBUrl: oldMatch.teamBUrl || "",
        competition: oldMatch.competition || "",
        competitionLogo: oldMatch.competitionLogo || "",
        round: oldMatch.round || "",
        deadline: oldMatch.deadline || null
      },
      newValue: {
        teamA: newMatch.teamA || "",
        teamB: newMatch.teamB || "",
        teamAUrl: newMatch.teamAUrl || "",
        teamBUrl: newMatch.teamBUrl || "",
        competition: newMatch.competition || "",
        competitionLogo: newMatch.competitionLogo || "",
        round: newMatch.round || "",
        deadline: newMatch.deadline || null
      },
      createdAt: Timestamp.fromDate(new Date())
    });
  } catch (error) {
    console.warn("Falha ao registrar auditoria da ediÃ§Ã£o do confronto:", error);
  }
};

const resetAdminMatchEditState = () => {
  adminMatchEditState = {
    loading: false,
    saving: false,
    matchId: "",
    match: null,
    guessCount: 0
  };
};

const setAdminQuickResultsStatus = (message = "", tone = "success") => {
  const el = document.getElementById("adminQuickResultsStatus");
  if (!el) return;

  if (!message) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }

  el.classList.remove("hidden", "border-green-200", "bg-green-50", "text-green-700", "border-red-200", "bg-red-50", "text-red-700");
  el.classList.add(
    tone === "danger" ? "border-red-200" : "border-green-200",
    tone === "danger" ? "bg-red-50" : "bg-green-50",
    tone === "danger" ? "text-red-700" : "text-green-700"
  );
  el.textContent = message;
};

const loadAdminQuickResultsState = async () => {
  const snap = await getDocs(collection(db, "matches"));
  const now = new Date();
  const matches = [];

  snap.forEach((d) => {
    const m = { id: d.id, ...d.data() };
    const deadlineDate = toJsDate(m.deadline);
    if (!deadlineDate) return;
    if (deadlineDate >= now) return;
    if (m.winner) return;
    matches.push({
      ...m,
      deadlineDate,
      expired: true
    });
  });

  matches.sort(matchComparator);

  return { matches };
};

const renderAdminQuickResultsModal = () => {
  const modal = document.getElementById("modalOverlay");
  const cont = document.getElementById("modalContainer");
  if (!modal || !cont) return;

  const pendingMatches = Array.isArray(adminQuickResultsState.matches) ? adminQuickResultsState.matches : [];
  const selectedCount = Object.keys(adminQuickResultsState.selections || {}).length;
  const saveDisabled = selectedCount === 0 || adminQuickResultsState.saving === true;

  const cardsHtml = pendingMatches.length
    ? pendingMatches.map((m, index) => {
        const selected = adminQuickResultsState.selections?.[m.id] || "";
        const deadlineLabel = formatAdminDateTimeLabel(m.deadlineDate);
        const competitionLabel = escapeHtml(String(m.competition || "Sem competiÃ§Ã£o").trim());
        const roundLabel = String(m.round || "").trim();
        const teamASelected = selected === "A";
        const teamBSelected = selected === "B";

        return `
          <div class="admin-quick-result-card">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-[10px] font-black text-[#006400] uppercase tracking-[0.18em]">Confronto #${index + 1}</div>
                <div class="text-sm font-black text-gray-900 leading-tight break-words">${escapeHtml(m.teamA || "Time A")} x ${escapeHtml(m.teamB || "Time B")}</div>
                <div class="mt-1 text-[10px] font-bold text-gray-500 break-words">${competitionLabel}${roundLabel ? ` â€¢ ${escapeHtml(roundLabel)}` : ""}</div>
                <div class="mt-1 text-[10px] font-bold text-gray-400">Prazo encerrado em ${escapeHtml(deadlineLabel)}</div>
              </div>
              <span class="status-chip status-chip--warning">Pendente</span>
            </div>

            <div class="admin-quick-result-team-grid">
              <button
                type="button"
                onclick="window.toggleAdminQuickResultWinner('${escapeJsString(m.id)}', 'A')"
                class="admin-quick-result-team ${teamASelected ? 'is-selected' : ''}"
              >
                <span class="text-[9px] uppercase tracking-[0.18em]">Time A</span>
                <span class="text-sm leading-tight break-words">${escapeHtml(m.teamA || "Time A")}</span>
              </button>

              <button
                type="button"
                onclick="window.toggleAdminQuickResultWinner('${escapeJsString(m.id)}', 'B')"
                class="admin-quick-result-team ${teamBSelected ? 'is-selected' : ''}"
              >
                <span class="text-[9px] uppercase tracking-[0.18em]">Time B</span>
                <span class="text-sm leading-tight break-words">${escapeHtml(m.teamB || "Time B")}</span>
              </button>
            </div>
          </div>
        `;
      }).join("")
    : `
      <div class="admin-quick-result-empty">
        <div class="text-base font-black text-gray-800">Nenhum confronto pendente.</div>
        <p class="mt-1 text-xs text-gray-500">Quando houver jogos aguardando resultado, eles aparecerÃ£o aqui para baixa rÃ¡pida.</p>
      </div>
    `;

  modal.classList.remove("hidden");
  cont.innerHTML = `
    <div class="w-full max-w-md bg-white rounded-none shadow-2xl overflow-hidden relative h-[88vh] flex flex-col">
      <img src="bg_painel_admin.jpeg" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover opacity-100">
      <div class="relative z-10 flex flex-col h-full bg-white/92">
        <div class="bg-[#006400] p-4 text-white flex items-start justify-between shadow-md shrink-0">
          <div class="pr-3">
            <h3 class="font-black uppercase text-lg leading-none">âš¡ BAIXA RÃPIDA</h3>
            <p class="text-[10px] text-[#FFD700] font-bold mt-1">Confrontos aguardando resultado</p>
          </div>
          <button type="button" onclick="closeModal()" class="ml-2"><i class="fas fa-times text-xl"></i></button>
        </div>

        <div id="adminQuickResultsScroll" class="flex-1 overflow-y-auto p-3 space-y-3">
          <div class="admin-creation-panel space-y-3">
            <div class="flex items-center justify-between gap-2">
              <div>
                <div class="text-[10px] font-black text-[#006400] uppercase tracking-[0.18em]">Resumo</div>
                <h4 class="text-lg font-black text-gray-900 leading-tight">Escolha o vencedor de cada confronto.</h4>
              </div>
              <span class="status-chip status-chip--default">${pendingMatches.length}</span>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div class="admin-mini-chip">
                <i class="fas fa-hourglass-half"></i>
                <span>${pendingMatches.length} pendentes</span>
              </div>
              <div class="admin-mini-chip">
                <i class="fas fa-circle-check"></i>
                <span>${selectedCount} selecionados</span>
              </div>
            </div>
            <div id="adminQuickResultsStatus" class="hidden rounded-2xl border px-3 py-2 text-xs font-black"></div>
          </div>

          <div class="space-y-2">
            ${cardsHtml}
          </div>
        </div>

        <div class="admin-quick-results-footer shrink-0">
          <button
            type="button"
            onclick="window.saveAdminQuickResults()"
            class="w-full py-3 rounded-2xl font-black text-xs shadow-lg btn-press flex items-center justify-center gap-2 ${saveDisabled ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-black text-white'}"
            ${saveDisabled ? "disabled" : ""}
          >
            <i class="fas fa-floppy-disk text-base"></i>
            SALVAR (${selectedCount}) RESULTADOS
          </button>
          <button
            type="button"
            onclick="closeModal()"
            class="w-full mt-2 bg-gray-200 text-gray-800 py-3 rounded-2xl font-black text-xs shadow-lg btn-press"
          >
            CANCELAR
          </button>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    const scrollBox = document.getElementById("adminQuickResultsScroll");
    if (scrollBox) scrollBox.scrollTop = adminQuickResultsState.scrollTop || 0;
  }, 0);
};

window.toggleAdminQuickResultWinner = (matchId, side) => {
  if (!matchId) return;
  const nextSide = side === "B" ? "B" : "A";
  adminQuickResultsState.selections = {
    ...(adminQuickResultsState.selections || {}),
    [matchId]: nextSide
  };
  adminQuickResultsState.scrollTop = document.getElementById("adminQuickResultsScroll")?.scrollTop || 0;
  renderAdminQuickResultsModal();
};

window.openQuickResultsModal = async () => {
  window.__setAdminReturnTarget(() => window.openAdminMenu());
  const admin = await getCurrentAdminProfile(true);
  if (!admin) {
    alert("VocÃª nÃ£o tem permissÃ£o para usar a Baixa RÃ¡pida.");
    closeModal();
    return;
  }

  const modal = document.getElementById("modalOverlay");
  const cont = document.getElementById("modalContainer");
  if (!modal || !cont) return;

  modal.classList.remove("hidden");
  cont.innerHTML = `
    <div class="bg-white p-6 text-center rounded shadow-xl">
      <i class="fas fa-circle-notch fa-spin text-2xl text-[#006400] mb-3"></i>
      <p class="text-xs font-black text-gray-500 uppercase">Carregando baixa rÃ¡pida...</p>
    </div>
  `;

  try {
    adminQuickResultsState = {
      loading: true,
      saving: false,
      matches: [],
      selections: {},
      scrollTop: 0
    };

    const state = await loadAdminQuickResultsState();
    adminQuickResultsState = {
      ...adminQuickResultsState,
      loading: false,
      matches: state.matches || [],
      selections: {}
    };

    renderAdminQuickResultsModal();
  } catch (error) {
    console.error("Erro ao abrir baixa rÃ¡pida:", error);
    cont.innerHTML = `
      <div class="bg-white p-6 text-center rounded shadow-xl">
        <p class="text-sm font-black text-red-600 mb-3">NÃ£o foi possÃ­vel carregar a baixa rÃ¡pida.</p>
        <button onclick="openAdminMenu()" class="bg-[#006400] text-white px-4 py-2 rounded font-black text-xs">Voltar</button>
      </div>
    `;
  }
};

const logAdminQuickResultsAction = async (payload = {}) => {
  try {
    const admin = await getCurrentAdminProfile();
    if (!admin) return;

    await addDoc(collection(db, "admin_audit_logs"), {
      type: "quick_results",
      adminUid: admin.uid || "",
      adminName: admin.name || "",
      adminEmail: admin.email || "",
      source: "matches",
      ...payload,
      createdAt: Timestamp.fromDate(new Date())
    });
  } catch (error) {
    console.warn("Falha ao registrar auditoria da baixa rÃ¡pida:", error);
  }
};

const refreshRankingMovementAfterOfficialChange = async (meta = {}) => {
  try {
    const previousSnapshot = await loadRankingMovementSnapshot({ force: true });
    await loadRanking({ force: true });
    await persistRankingMovementSnapshot({
      users: Array.isArray(currentRankingData) ? currentRankingData : [],
      previousPositions: previousSnapshot?.positions || {},
      meta
    });

    if (!document.getElementById("rankingScreen")?.classList.contains("hidden")) {
      await loadRanking({ force: true });
    } else {
      window.__rankingScreenCache = null;
    }
  } catch (error) {
    console.warn("Falha ao atualizar snapshot do ranking:", error);
  }
};

window.saveAdminQuickResults = async () => {
  const pendingMatches = Array.isArray(adminQuickResultsState.matches) ? adminQuickResultsState.matches : [];
  const selections = adminQuickResultsState.selections || {};
  const selectedEntries = pendingMatches.filter((match) => selections[match.id]);

  if (!selectedEntries.length) {
    setAdminQuickResultsStatus("Selecione ao menos um vencedor.", "danger");
    return;
  }

  if (!confirm("Salvar os resultados selecionados?")) return;

  const admin = await getCurrentAdminProfile(true);
  if (!admin) {
    alert("VocÃª nÃ£o tem permissÃ£o para salvar resultados.");
    return;
  }

  try {
    adminQuickResultsState.saving = true;
    renderAdminQuickResultsModal();

    const batch = writeBatch(db);
    const nowTs = Timestamp.fromDate(new Date());
    const updatedMatches = [];

    selectedEntries.forEach((match) => {
      const winnerSide = selections[match.id] === "B" ? "B" : "A";
      const winner = winnerSide === "A" ? (match.teamA || "") : (match.teamB || "");
      const matchRef = doc(db, "matches", match.id);

      batch.update(matchRef, {
        winner,
        finishedAt: nowTs,
        updatedAt: nowTs,
        updatedByUid: admin.uid || "",
        updatedByName: admin.name || "",
        updatedByEmail: admin.email || ""
      });

      updatedMatches.push({
        matchId: match.id,
        teamA: match.teamA || "",
        teamB: match.teamB || "",
        competition: match.competition || "",
        winner
      });
    });

    await batch.commit();
    await logAdminQuickResultsAction({
      totalResults: updatedMatches.length,
      matches: updatedMatches
    });

    invalidateHomeRankingCaches();
    invalidateRuntimeCache("col:matches");
    await loadAdminMatches();
    if (!document.getElementById("matchesScreen")?.classList.contains("hidden")) {
      await loadMatches({ force: true });
    }
    await refreshRankingMovementAfterOfficialChange({
      source: "quick_results",
      updatedBy: admin.uid || "",
      updatedByName: admin.name || "",
      updatedByEmail: admin.email || ""
    });

    if (typeof window.showToast === "function") {
      window.showToast("Resultados salvos!", "Baixa rÃ¡pida concluÃ­da.", "");
    } else {
      alert("Resultados salvos!");
    }

    closeModal();
  } catch (error) {
    console.error("Erro ao salvar baixa rÃ¡pida:", error);
    adminQuickResultsState.saving = false;
    setAdminQuickResultsStatus("NÃ£o foi possÃ­vel salvar os resultados.", "danger");
    renderAdminQuickResultsModal();
  }
};

const saveAdminMatchInternal = async (keepOpen = false) => {
  setAdminCreationStatus("");

  const competition = String(document.getElementById("adminMatchCompetition")?.value || "").trim();
  const round = String(document.getElementById("adminMatchRound")?.value || "").trim();
  const teamA = String(document.getElementById("adminTeamNameA")?.value || "").trim();
  const teamB = String(document.getElementById("adminTeamNameB")?.value || "").trim();
  const teamALogo = String(document.getElementById("adminTeamLogoA")?.value || "").trim();
  const teamBLogo = String(document.getElementById("adminTeamLogoB")?.value || "").trim();
  const deadlineValue = String(document.getElementById("adminMatchDeadline")?.value || "").trim();
  const shareWhatsapp = document.getElementById("adminMatchShareWhatsapp")?.checked === true;

  if (!competition) return alert("Informe a competiÃ§Ã£o.");
  if (!round) return alert("Informe a rodada/fase.");
  if (!teamA) return alert("Informe o Time A.");
  if (!teamB) return alert("Informe o Time B.");
  if (normalizeAdminText(teamA) === normalizeAdminText(teamB)) return alert("O Time A e o Time B nÃ£o podem ser iguais.");
  if (!deadlineValue) return alert("Informe a data e hora limite para votaÃ§Ã£o.");
  if (teamALogo && !isHttpUrl(teamALogo)) return alert("O link da logo do Time A precisa comeÃ§ar com http:// ou https://.");
  if (teamBLogo && !isHttpUrl(teamBLogo)) return alert("O link da logo do Time B precisa comeÃ§ar com http:// ou https://.");

  const deadlineDate = new Date(deadlineValue);
  if (Number.isNaN(deadlineDate.getTime())) return alert("A data e hora informadas sÃ£o invÃ¡lidas.");

  const isEditingMatch = Boolean(adminMatchEditState.matchId);
  const editingMatchId = String(adminMatchEditState.matchId || "").trim();
  const editingMatch = adminMatchEditState.match || {};

  const admin = await getCurrentAdminProfile(true);
  if (!admin) {
    alert(isEditingMatch ? "VocÃª nÃ£o tem permissÃ£o para editar confrontos." : "VocÃª nÃ£o tem permissÃ£o para criar confrontos.");
    closeModal();
    return;
  }

  try {
    if (isEditingMatch) {
      adminMatchEditState.saving = true;
      renderAdminMatchEditModal();
    }

    const competitionItem = (adminCreationState.competitionItems || []).find((item) => normalizeAdminText(item.name || "") === normalizeAdminText(competition) && item.active === true) || null;
    const savedTeamA = await persistAdminTeamIfNeeded(teamA, teamALogo);
    const savedTeamB = await persistAdminTeamIfNeeded(teamB, teamBLogo);

    const nowTs = Timestamp.fromDate(new Date());
    const deadlineTs = Timestamp.fromDate(deadlineDate);

    const matchPayload = {
      competition,
      competitionLogo: competitionItem?.logo || editingMatch.competitionLogo || "",
      round,
      teamA,
      teamB,
      teamAUrl: teamALogo || savedTeamA?.logoUrl || "",
      teamBUrl: teamBLogo || savedTeamB?.logoUrl || "",
      deadline: deadlineTs,
      updatedAt: nowTs,
      updatedByUid: admin.uid || "",
      updatedByName: admin.name || "",
      updatedByEmail: admin.email || ""
    };

    let matchRef = null;
    if (isEditingMatch) {
      matchRef = doc(db, "matches", editingMatchId);
      await updateDoc(matchRef, matchPayload);
      await logAdminMatchUpdate({
        matchId: editingMatchId,
        oldMatch: editingMatch,
        newMatch: {
          ...editingMatch,
          ...matchPayload,
          deadline: deadlineDate
        }
      });
    } else {
      matchPayload.createdAt = nowTs;
      matchPayload.winner = "";
      matchPayload.final = false;
      matchPayload.stats = {};
      matchPayload.createdByUid = admin.uid || "";
      matchPayload.createdByName = admin.name || "";
      matchPayload.createdByEmail = admin.email || "";

      matchRef = await addDoc(collection(db, "matches"), matchPayload);
      await logAdminMatchCreation({
        matchId: matchRef.id,
        teamA,
        teamB,
        competition,
        round,
        deadline: deadlineDate
      });
    }

    invalidateHomeRankingCaches();
    invalidateRuntimeCache("col:matches");
    await loadAdminMatches();
    if (!document.getElementById("matchesScreen")?.classList.contains("hidden")) {
      await loadMatches({ force: true });
    }
    if (!document.getElementById("rankingScreen")?.classList.contains("hidden") && typeof loadRanking === "function") {
      await loadRanking({ force: true });
    }

    if (shareWhatsapp) {
      const text = buildAdminWhatsAppMessage({
        teamA,
        teamB,
        competition,
        round,
        deadline: deadlineDate
      });
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    }

    if (keepOpen && !isEditingMatch) {
      const preservedDeadline = formatAdminDateTimeInput(deadlineDate);
      const preservedWhatsapp = shareWhatsapp;

      const teamANameInput = document.getElementById("adminTeamNameA");
      const teamBNameInput = document.getElementById("adminTeamNameB");
      const teamALogoInput = document.getElementById("adminTeamLogoA");
      const teamBLogoInput = document.getElementById("adminTeamLogoB");
      const deadlineInput = document.getElementById("adminMatchDeadline");
      const whatsappInput = document.getElementById("adminMatchShareWhatsapp");

      if (teamANameInput) teamANameInput.value = "";
      if (teamBNameInput) teamBNameInput.value = "";
      if (teamALogoInput) teamALogoInput.value = "";
      if (teamBLogoInput) teamBLogoInput.value = "";
      if (deadlineInput) deadlineInput.value = preservedDeadline;
      if (whatsappInput) whatsappInput.checked = preservedWhatsapp;

      window.updateAdminTeamPreview("A");
      window.updateAdminTeamPreview("B");
      setAdminCreationStatus("Confronto salvo. Preencha o prÃ³ximo jogo.");
      return;
    }

    if (typeof window.showToast === "function") {
      window.showToast(
        isEditingMatch ? "Confronto atualizado!" : "Confronto salvo!",
        isEditingMatch ? "Os dados da partida foram atualizados." : "O confronto foi publicado com sucesso.",
        ""
      );
    } else {
      alert(isEditingMatch ? "Confronto atualizado com sucesso." : "Confronto salvo com sucesso.");
    }
    closeModal();
  } catch (error) {
    console.error(isEditingMatch ? "Erro ao editar confronto:" : "Erro ao salvar confronto:", error);
    if (isEditingMatch) {
      adminMatchEditState.saving = false;
      renderAdminMatchEditModal();
    }
    setAdminCreationStatus(isEditingMatch ? "NÃ£o foi possÃ­vel atualizar o confronto." : "NÃ£o foi possÃ­vel salvar o confronto.", "danger");
    alert(`${isEditingMatch ? "NÃ£o foi possÃ­vel atualizar o confronto." : "NÃ£o foi possÃ­vel salvar o confronto."} ${error?.message || ""}`.trim());
  }
};

window.saveAdminMatch = async (keepOpen = false) => {
  await saveAdminMatchInternal(keepOpen);
};

window.saveAdminMatchAndReset = async () => {
  await saveAdminMatchInternal(true);
};

window.saveAdminMatchEdit = async () => {
  await saveAdminMatchInternal(false);
};

window.cancelAdminMatchEdit = () => {
  resetAdminMatchEditState();
  closeModal();
};

const renderAdminMatchEditModal = () => {
  const modal = document.getElementById("modalOverlay");
  const cont = document.getElementById("modalContainer");
  if (!modal || !cont) return;

  const match = adminMatchEditState.match || {};
  const statusInfo = getAdminMatchStatusInfo(match);
  const warnings = buildAdminMatchEditWarnings(match, adminMatchEditState.guessCount);
  const competitionValue = String(match.competition || "").trim();
  const roundValue = String(match.round || "").trim();
  const competitionLogo = String(match.competitionLogo || "").trim();
  const teamALogo = String(match.teamAUrl || "").trim();
  const teamBLogo = String(match.teamBUrl || "").trim();
  const deadlineDate = match.deadlineDate || toJsDate(match.deadline) || new Date();
  const deadlineValue = formatAdminDateTimeInput(deadlineDate);
  const competitionOptions = buildAdminMatchCompetitionOptions(competitionValue);
  const roundOptions = buildAdminMatchRoundOptions(roundValue);
  const warningHtml = warnings.length
    ? warnings.map((text) => `
      <div class="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800 leading-relaxed">${escapeHtml(text)}</div>
    `).join("")
    : `
      <div class="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500 leading-relaxed">
        A ediÃ§Ã£o atualiza apenas os dados cadastrais do confronto.
      </div>
    `;

  modal.classList.remove("hidden");
  cont.innerHTML = `
    <div class="w-full max-w-md bg-white rounded-none shadow-2xl overflow-hidden relative h-[90vh] flex flex-col">
      <img src="bg_painel_admin.jpeg" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover opacity-100">
      <div class="relative z-10 flex flex-col h-full bg-white/92">
        <div class="bg-[#006400] p-4 text-white flex items-start justify-between shadow-md shrink-0">
          <div class="pr-3">
            <h3 class="font-black uppercase text-lg leading-none">Editar Confronto</h3>
            <p class="text-[10px] text-[#FFD700] font-bold mt-1">matches/${escapeHtml(adminMatchEditState.matchId || "")}</p>
          </div>
          <button type="button" onclick="window.cancelAdminMatchEdit()" class="ml-2"><i class="fas fa-times text-xl"></i></button>
        </div>

        <div class="flex-1 overflow-y-auto p-3 space-y-3">
          <div class="admin-creation-panel space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-[10px] font-black text-[#006400] uppercase tracking-[0.18em]">Dados do confronto</div>
                <h4 class="text-lg font-black text-gray-900 leading-tight truncate">${escapeHtml(match.teamA || "Sem time")} x ${escapeHtml(match.teamB || "Sem time")}</h4>
              </div>
              <span class="status-chip status-chip--${statusInfo.tone === "success" ? "success" : statusInfo.tone === "warning" ? "warning" : "default"}">${escapeHtml(statusInfo.label)}</span>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div class="admin-mini-chip">
                <i class="fas fa-comments"></i>
                <span>${Number(adminMatchEditState.guessCount || 0)} palpites</span>
              </div>
              <div class="admin-mini-chip">
                <i class="fas fa-futbol"></i>
                <span>${escapeHtml(match.competition || "Sem competiÃ§Ã£o")}</span>
              </div>
            </div>

            <div class="space-y-2">
              ${warningHtml}
            </div>
          </div>

          <div class="admin-creation-panel space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="admin-compact-label">CompetiÃ§Ã£o</label>
                <select id="adminMatchCompetition" class="admin-creation-input" onchange="window.handleAdminCompetitionChange()">
                  <option value="">Selecione</option>
                  ${competitionOptions}
                </select>
                <div class="mt-2 flex items-center gap-3">
                  ${getCompetitionThumbHtml(competitionLogo)}
                  <div class="flex-1">
                    <div class="text-[10px] font-bold uppercase text-gray-400 mb-1">Logo da competiÃ§Ã£o</div>
                    <div class="text-xs text-gray-500">A competiÃ§Ã£o selecionada define o destaque visual do confronto.</div>
                  </div>
                </div>
              </div>
              <div>
                <label class="admin-compact-label">Rodada/Fase</label>
                <select id="adminMatchRound" class="admin-creation-input" onchange="window.handleAdminRoundChange()">
                  <option value="">Selecione</option>
                  ${roundOptions}
                </select>
              </div>
            </div>

            <div class="space-y-3">
              <div class="admin-team-card">
                <div class="flex items-center justify-between gap-2 mb-2">
                  <label class="admin-compact-label mb-0">Time A</label>
                  <button type="button" onclick="window.searchAdminTeamLogo('A')" class="admin-search-btn"><i class="fas fa-magnifying-glass"></i></button>
                </div>
                <div class="relative">
                  <input id="adminTeamNameA" type="text" class="admin-creation-input pr-10" placeholder="Digite ou pesquise o time" oninput="window.refreshAdminTeamSuggestions('A')" onfocus="window.refreshAdminTeamSuggestions('A')" onblur="window.hideAdminTeamSuggestionsDelayed('A')" value="${escapeHtml(match.teamA || "")}">
                  <div id="adminTeamSuggestionsA" class="admin-team-suggestions hidden"></div>
                </div>
                <div class="mt-3 flex items-center gap-3">
                  ${getTeamThumbHtml("A", teamALogo)}
                  <div class="flex-1">
                    <div class="text-[10px] font-bold uppercase text-gray-400 mb-1">Miniatura da logo</div>
                    <div class="text-xs text-gray-500">A imagem aparece quando o link da logo estiver preenchido.</div>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-center text-[#006400] font-black text-sm">X</div>

              <div class="admin-team-card">
                <div class="flex items-center justify-between gap-2 mb-2">
                  <label class="admin-compact-label mb-0">Time B</label>
                  <button type="button" onclick="window.searchAdminTeamLogo('B')" class="admin-search-btn"><i class="fas fa-magnifying-glass"></i></button>
                </div>
                <div class="relative">
                  <input id="adminTeamNameB" type="text" class="admin-creation-input pr-10" placeholder="Digite ou pesquise o time" oninput="window.refreshAdminTeamSuggestions('B')" onfocus="window.refreshAdminTeamSuggestions('B')" onblur="window.hideAdminTeamSuggestionsDelayed('B')" value="${escapeHtml(match.teamB || "")}">
                  <div id="adminTeamSuggestionsB" class="admin-team-suggestions hidden"></div>
                </div>
                <div class="mt-3 flex items-center gap-3">
                  ${getTeamThumbHtml("B", teamBLogo)}
                  <div class="flex-1">
                    <div class="text-[10px] font-bold uppercase text-gray-400 mb-1">Miniatura da logo</div>
                    <div class="text-xs text-gray-500">A imagem aparece quando o link da logo estiver preenchido.</div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <button type="button" id="btnToggleAdminLogoFields" class="text-[11px] font-black uppercase text-[#006400]">
                <i class="fas fa-link mr-1"></i> Mostrar links das logos
              </button>
              <div id="adminLogoFields" class="hidden mt-3 space-y-3">
                <div>
                  <label class="admin-compact-label">Link Logo A</label>
                  <input id="adminTeamLogoA" type="url" class="admin-creation-input" placeholder="https://..." value="${escapeHtml(teamALogo)}">
                </div>
                <div>
                  <label class="admin-compact-label">Link Logo B</label>
                  <input id="adminTeamLogoB" type="url" class="admin-creation-input" placeholder="https://..." value="${escapeHtml(teamBLogo)}">
                </div>
              </div>
            </div>

            <div>
              <label class="admin-compact-label">Data e Hora limite para votaÃ§Ã£o</label>
              <input id="adminMatchDeadline" type="datetime-local" class="admin-creation-input" value="${escapeHtml(deadlineValue)}">
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button type="button" onclick="window.saveAdminMatchEdit()" ${adminMatchEditState.saving ? "disabled" : ""} class="${adminMatchEditState.saving ? "bg-gray-300 text-gray-600 cursor-not-allowed" : "bg-[#006400] text-white"} py-3 rounded-2xl font-black text-[11px] shadow-lg btn-press flex items-center justify-center gap-2">
                <i class="fas ${adminMatchEditState.saving ? "fa-circle-notch fa-spin" : "fa-save"} text-base"></i>
                ${adminMatchEditState.saving ? "Salvando..." : "Salvar alteraÃ§Ãµes"}
              </button>
              <button type="button" onclick="window.cancelAdminMatchEdit()" class="bg-gray-200 text-gray-800 py-3 rounded-2xl font-black text-[11px] shadow-lg btn-press">
                Cancelar
              </button>
            </div>

            <div id="adminCreationStatus" class="hidden rounded-2xl border px-3 py-2 text-xs font-black"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  const teamAName = document.getElementById("adminTeamNameA");
  const teamBName = document.getElementById("adminTeamNameB");
  const teamALogoInput = document.getElementById("adminTeamLogoA");
  const teamBLogoInput = document.getElementById("adminTeamLogoB");
  const toggleLinksBtn = document.getElementById("btnToggleAdminLogoFields");
  const linksWrap = document.getElementById("adminLogoFields");

  if (teamAName) teamAName.addEventListener("input", () => window.refreshAdminTeamSuggestions("A"));
  if (teamBName) teamBName.addEventListener("input", () => window.refreshAdminTeamSuggestions("B"));
  if (teamALogoInput) teamALogoInput.addEventListener("input", () => window.updateAdminTeamPreview("A"));
  if (teamBLogoInput) teamBLogoInput.addEventListener("input", () => window.updateAdminTeamPreview("B"));
  if (toggleLinksBtn && linksWrap) {
    toggleLinksBtn.onclick = () => {
      const hidden = linksWrap.classList.toggle("hidden");
      toggleLinksBtn.innerHTML = hidden
        ? '<i class="fas fa-link mr-1"></i> Mostrar links das logos'
        : '<i class="fas fa-eye-slash mr-1"></i> Ocultar links das logos';
    };
  }

  adminCreationState.selectedCompetition = competitionValue;
  adminCreationState.selectedRound = roundValue;
  window.updateAdminCompetitionPreview();
  window.updateAdminTeamPreview("A");
  window.updateAdminTeamPreview("B");
};

window.openMatchEditModal = async (matchId) => {
  const admin = await getCurrentAdminProfile(true);
  if (!admin) {
    alert("VocÃª nÃ£o tem permissÃ£o para editar confrontos.");
    closeModal();
    return;
  }

  const modal = document.getElementById("modalOverlay");
  const cont = document.getElementById("modalContainer");
  if (!modal || !cont) return;

  modal.classList.remove("hidden");
  cont.innerHTML = `
    <div class="bg-white p-6 text-center rounded shadow-xl">
      <i class="fas fa-circle-notch fa-spin text-2xl text-[#006400] mb-3"></i>
      <p class="text-xs font-black text-gray-500 uppercase">Carregando ediÃ§Ã£o...</p>
    </div>
  `;

  try {
    adminMatchEditState = {
      loading: true,
      saving: false,
      matchId: String(matchId || "").trim(),
      match: null,
      guessCount: 0
    };

    if (!Array.isArray(adminCreationState.competitionItems) || !adminCreationState.competitionItems.length || !Array.isArray(adminCreationState.rounds) || !adminCreationState.rounds.length) {
      await loadAdminCreationState().catch((error) => {
        console.warn("NÃ£o foi possÃ­vel carregar dados auxiliares da ediÃ§Ã£o:", error);
      });
    }

    const [matchSnap, guessesSnap] = await Promise.all([
      getDoc(doc(db, "matches", String(matchId || "").trim())),
      getDocs(query(collection(db, "guesses"), where("matchId", "==", String(matchId || "").trim()))).catch(() => null)
    ]);

    if (!matchSnap.exists()) {
      throw new Error("Confronto nÃ£o encontrado.");
    }

    const data = matchSnap.data() || {};
    const deadlineDate = toJsDate(data.deadline) || null;
    const guessCount = guessesSnap ? guessesSnap.size : 0;

    adminMatchEditState = {
      loading: false,
      saving: false,
      matchId: String(matchId || "").trim(),
      match: {
        id: matchSnap.id,
        ...data,
        deadlineDate,
        expired: deadlineDate ? new Date() > deadlineDate : false
      },
      guessCount
    };

    adminCreationState.selectedCompetition = data.competition || "";
    adminCreationState.selectedRound = data.round || "";

    renderAdminMatchEditModal();
  } catch (error) {
    console.error("Erro ao abrir ediÃ§Ã£o do confronto:", error);
    cont.innerHTML = `
      <div class="bg-white p-6 text-center rounded shadow-xl">
        <p class="text-sm font-black text-red-600 mb-3">NÃ£o foi possÃ­vel carregar a ediÃ§Ã£o.</p>
        <button onclick="closeModal()" class="bg-[#006400] text-white px-4 py-2 rounded font-black text-xs">Voltar</button>
      </div>
    `;
  }
};

        // --- LEGENDA MEDALHAS ATUALIZADA (MITO, DIAMANTE...) ---
        window.__adminMatchesSearch = "";
        window.__adminMatchesFilter = "all";
        window.__adminMatchesCache = [];

        const formatAdminPanelDateTime = (value) => {
          const date = toJsDate(value);
          if (!date) return "Ainda nÃ£o registrado";
          return date.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
          });
        };

        const normalizeAdminMatchSearch = (value = "") =>
          String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ")
            .trim();

        window.scrollAdminSection = (sectionId) => {
          const root = document.getElementById(sectionId);
          root?.scrollIntoView({ behavior: "smooth", block: "start" });
        };

        window.setAdminMatchesFilter = (filter = "all") => {
          window.__adminMatchesFilter = filter;
          renderAdminMatchesList();
        };

        window.filterAdminMatches = (value = "") => {
          window.__adminMatchesSearch = value;
          renderAdminMatchesList();
        };

        const renderAdminOverviewCards = async (summary = {}) => {
          const overviewEl = document.getElementById("adminOverviewCards");
          if (!overviewEl) return;

          const safeLabel = (value) => value == null || value === "" ? "N/D" : value;
          const lastRankingLabel = summary.lastRankingUpdatedAt
            ? formatAdminPanelDateTime(summary.lastRankingUpdatedAt)
            : "Ainda nÃ£o registrado";
          const lastAdminActionLabel = summary.lastAdminActionAt
            ? formatAdminPanelDateTime(summary.lastAdminActionAt)
            : "Ainda nÃ£o registrado";

          overviewEl.innerHTML = `
            <div class="admin-overview-grid">
              <div class="admin-overview-card admin-overview-card--info">
                <span class="admin-overview-card__value">${safeLabel(summary.actionsTodayCount != null ? summary.actionsTodayCount : "N/D")}</span>
                <span class="admin-overview-card__label">AÃ§Ãµes hoje</span>
                <span class="admin-overview-card__hint">Registros administrativos feitos hoje.</span>
              </div>
              <div class="admin-overview-card admin-overview-card--info">
                <span class="admin-overview-card__value">${safeLabel(summary.trashCount != null ? summary.trashCount : "N/D")}</span>
                <span class="admin-overview-card__label">Na lixeira</span>
                <span class="admin-overview-card__hint">Confrontos removidos que ainda podem ser restaurados.</span>
              </div>
              <div class="admin-overview-card admin-overview-card--info">
                <span class="admin-overview-card__value">${escapeHtml(lastAdminActionLabel)}</span>
                <span class="admin-overview-card__label">Ãšltima aÃ§Ã£o admin</span>
                <span class="admin-overview-card__hint">${escapeHtml(summary.lastAdminActionSummary || "Registro administrativo mais recente.")}</span>
              </div>
              <div class="admin-overview-card admin-overview-card--info">
                <span class="admin-overview-card__value">${summary.pendingUsersCount || 0}</span>
                <span class="admin-overview-card__label">Financeiro pendente</span>
                <span class="admin-overview-card__hint">UsuÃ¡rios com pagamento pendente.</span>
              </div>
              <div class="admin-overview-card admin-overview-card--info">
                <span class="admin-overview-card__value">${safeLabel(summary.pushActiveCount != null ? summary.pushActiveCount : "N/D")}</span>
                <span class="admin-overview-card__label">Push ativos</span>
                <span class="admin-overview-card__hint">UsuÃ¡rios com token web ativo.</span>
              </div>
              <div class="admin-overview-card admin-overview-card--info">
                <span class="admin-overview-card__value">${escapeHtml(lastRankingLabel)}</span>
                <span class="admin-overview-card__label">Ãšltima atualizaÃ§Ã£o do ranking</span>
                <span class="admin-overview-card__hint">Data da Ãºltima consolidaÃ§Ã£o.</span>
              </div>
            </div>
          `;
        };

        const getAdminDateKey = (value) => {
          const date = toJsDate(value);
          if (!date) return "";
          try {
            return new Intl.DateTimeFormat("en-CA", {
              timeZone: "America/Sao_Paulo"
            }).format(date);
          } catch (error) {
            return date.toISOString().slice(0, 10);
          }
        };

        const getAdminAuditTimestamp = (log = {}) =>
          toJsDate(log.createdAt) ||
          toJsDate(log.timestamp) ||
          toJsDate(log.date) ||
          toJsDate(log.at) ||
          toJsDate(log.updatedAt) ||
          new Date(0);

        const getAdminAuditActionLabel = (log = {}) => {
          const type = String(log.type || log.action || "AÃ§Ã£o").trim();
          const normalized = type.replace(/[_-]+/g, " ").trim();
          const known = {
            create_match: "CriaÃ§Ã£o de confronto",
            update_match: "EdiÃ§Ã£o de confronto",
            delete_match: "ExclusÃ£o de confronto",
            create_round: "CriaÃ§Ã£o de rodada",
            update_round: "AtualizaÃ§Ã£o de rodada",
            disable_round: "DesativaÃ§Ã£o de rodada",
            restore_round: "RestauraÃ§Ã£o de rodada",
            reorder_round: "ReordenaÃ§Ã£o de rodada",
            create_competition: "CriaÃ§Ã£o de competiÃ§Ã£o",
            update_competition: "AtualizaÃ§Ã£o de competiÃ§Ã£o",
            disable_competition: "Arquivamento de competiÃ§Ã£o",
            restore_competition: "RestauraÃ§Ã£o de competiÃ§Ã£o",
            manual_push: "Comunicado manual",
            new_matches_notice: "Aviso de novos confrontos",
            quick_results: "Baixa rÃ¡pida",
            baixa_rapida: "Baixa rÃ¡pida",
            bulk_cleanup_finished_matches: "Limpeza de finalizados",
            restore_match: "RestauraÃ§Ã£o de confronto",
            permanent_delete_match: "ExclusÃ£o definitiva de confronto",
            financial_audit: "Auditoria financeira"
          };
          return known[type] || known[normalized] || normalized || "AÃ§Ã£o administrativa";
        };

        const getAdminAuditSummaryText = (log = {}) => {
          const bits = [
            log.description || "",
            log.summary || "",
            log.message || "",
            log.title || "",
            log.targetName || "",
            log.targetUserId ? `UsuÃ¡rio ${String(log.targetUserId)}` : "",
            log.targetMatchId ? `Confronto ${String(log.targetMatchId)}` : "",
            log.matchId ? `Jogo #${String(log.matchId)}` : "",
            log.competition ? `CompetiÃ§Ã£o ${String(log.competition)}` : "",
            log.round ? `Rodada ${String(log.round)}` : "",
            log.totalMatches != null ? `${String(log.totalMatches)} jogo(s)` : "",
            log.totalApplied != null ? `${String(log.totalApplied)} aplicado(s)` : ""
          ].filter(Boolean);

          if (bits.length) return bits.join(" â€¢ ");

          if (log.teams && (log.teams.teamA || log.teams.teamB)) {
            return `${log.teams.teamA || "?"} x ${log.teams.teamB || "?"}`;
          }

          if (log.oldValue || log.newValue) return "AlteraÃ§Ã£o registrada";
          return "Sem detalhes adicionais";
        };

        const getAdminAuditActorLabel = (log = {}) => {
          const actor = [
            log.adminName,
            log.createdByName,
            log.updatedByName,
            log.actorName,
            log.adminEmail,
            log.createdByEmail,
            log.updatedByEmail
          ].find((value) => String(value || "").trim());

          return String(actor || "Admin").trim();
        };

        const loadRecentAdminAuditLogs = async ({ limitSize = 200 } = {}) => {
          const ref = collection(db, "admin_audit_logs");
          const sortFields = ["createdAt", "timestamp", "date", "at", "updatedAt"];
          let items = [];
          let lastError = null;

          for (const field of sortFields) {
            try {
              const snap = await getDocs(query(ref, orderBy(field, "desc"), limit(limitSize)));
              items = [];
              snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
              lastError = null;
              break;
            } catch (error) {
              lastError = error;
              console.error(`[AdminHistory] Erro ao buscar logs com ordenaÃ§Ã£o ${field}:`, error);
            }
          }

          if (!items.length) {
            try {
              const fallbackSnap = await getDocs(query(ref, limit(limitSize)));
              fallbackSnap.forEach((d) => items.push({ id: d.id, ...d.data() }));
            } catch (error) {
              lastError = error;
              console.error("[AdminHistory] Erro ao buscar logs sem ordenaÃ§Ã£o:", error);
            }
          }

          if (!items.length && lastError) {
            throw lastError;
          }

          items.sort((a, b) => getAdminAuditTimestamp(b).getTime() - getAdminAuditTimestamp(a).getTime());
          return items.slice(0, limitSize);
        };

        const getAdminAuditRelatedUserIds = (log = {}) => {
          const rawIds = [
            log.userId,
            log.uid,
            log.targetUserId,
            log.affectedUserId,
            log.createdByUid,
            log.adminUid,
            log.payload?.userId,
            log.payload?.targetUserId,
            log.payload?.affectedUserId,
            log.details?.userId,
            log.details?.targetUserId,
            log.details?.affectedUserId,
            log.target?.uid,
            log.target?.userId
          ];

          return [...new Set(rawIds.map((value) => String(value || "").trim()).filter(Boolean))];
        };

        const loadAdminUsersLookupMap = async (logs = []) => {
          const cachedUsers = Array.isArray(window.__adminUsersCache) && window.__adminUsersCache.length
            ? window.__adminUsersCache
            : (Array.isArray(adminFinancialState?.users) ? adminFinancialState.users : []);
          const neededIds = [...new Set(logs.flatMap((log) => getAdminAuditRelatedUserIds(log)))];
          if (!neededIds.length) return new Map();

          let users = cachedUsers;
          if (!users.length) {
            try {
              const snap = await getDocs(collection(db, "users"));
              users = [];
              snap.forEach((d) => {
                const data = d.data() || {};
                users.push({
                  id: d.id,
                  uid: d.id,
                  ...data,
                  name: data.name || data.username || data.displayName || "Sem nome",
                  email: data.email || data.userEmail || ""
                });
              });
              window.__adminUsersCache = users;
            } catch (error) {
              console.error("[AdminHistory] Erro ao resolver usuÃ¡rios:", error);
              return new Map();
            }
          }

          const map = new Map();
          users.forEach((user) => {
            const uid = String(user.uid || user.id || "").trim();
            if (!uid) return;
            map.set(uid, user);
          });

          return map;
        };

        const getAdminAuditUserDisplay = (log = {}, userMap = new Map()) => {
          const directName = [
            log.userName,
            log.targetUserName,
            log.affectedUserName,
            log.displayName,
            log.name,
            log.details?.userName,
            log.payload?.userName
          ].find((value) => String(value || "").trim());
          const directEmail = [
            log.userEmail,
            log.targetUserEmail,
            log.affectedUserEmail,
            log.email,
            log.details?.userEmail,
            log.payload?.userEmail
          ].find((value) => String(value || "").trim());

          if (directName || directEmail) {
            const idSource = getAdminAuditRelatedUserIds(log)[0] || "";
            return {
              isUser: true,
              name: String(directName || "UsuÃ¡rio nÃ£o identificado").trim(),
              email: String(directEmail || "").trim(),
              shortId: idSource ? `ID: ...${idSource.slice(-4)}` : ""
            };
          }

          const ids = getAdminAuditRelatedUserIds(log);
          for (const id of ids) {
            const user = userMap.get(id);
            if (!user) continue;
            return {
              isUser: true,
              name: String(user.name || user.displayName || user.username || "UsuÃ¡rio nÃ£o identificado").trim(),
              email: String(user.email || "").trim(),
              shortId: `ID: ...${id.slice(-4)}`
            };
          }

          if (ids.length) {
            const id = ids[0];
            return {
              isUser: true,
              name: "UsuÃ¡rio nÃ£o identificado",
              email: "",
              shortId: `ID: ...${id.slice(-4)}`
            };
          }

          const genericTitle = [
            log.targetName,
            log.matchTitle,
            log.competitionName,
            log.roundName,
            log.username,
            log.source
          ].find((value) => String(value || "").trim()) || "";

          return {
            isUser: false,
            name: String(genericTitle || "Registro administrativo").trim(),
            email: "",
            shortId: ""
          };
        };

        const getAdminAuditCardSummary = (log = {}, userDisplay = null) => {
          if (userDisplay?.isUser) {
            const parts = [
              userDisplay.email || "",
              userDisplay.shortId || "",
              getAdminAuditSummaryText(log)
            ].filter(Boolean);
            return parts.length ? parts.join(" â€¢ ") : "UsuÃ¡rio afetado";
          }
          return getAdminAuditSummaryText(log);
        };

        const loadAdminOverviewCards = async () => {
          try {
            const [usersSnap, rankingSnap, trashSnap, recentAuditLogs] = await Promise.all([
              getDocs(collection(db, "users")),
              getDoc(doc(db, "settings", "rankingMovement")),
              getDocs(collection(db, "bin_matches")),
              loadRecentAdminAuditLogs({ limitSize: 200 })
            ]);

            const monthKey = typeof getFinancialCurrentMonthKey === "function" ? getFinancialCurrentMonthKey() : "";
            let pendingUsersCount = 0;
            let pushActiveCount = 0;
            usersSnap.forEach((d) => {
              const user = d.data() || {};
              if (user.isActive === false) return;
              if (monthKey && user.payments?.[monthKey] !== true) pendingUsersCount += 1;
              if (user.hasWebPushToken === true || Number(user.webPushTokenCount || 0) > 0) pushActiveCount += 1;
            });

            const trashCount = trashSnap.size || 0;
            const todayKey = getAdminDateKey(new Date());
            const actionsTodayCount = recentAuditLogs.filter((log) => getAdminDateKey(getAdminAuditTimestamp(log)) === todayKey).length;
            const latestAudit = recentAuditLogs[0] || null;
            const userMap = await loadAdminUsersLookupMap(recentAuditLogs);
            const latestUserDisplay = latestAudit ? getAdminAuditUserDisplay(latestAudit, userMap) : null;
            const lastAdminActionSummary = latestAudit
              ? [
                  getAdminAuditActionLabel(latestAudit),
                  latestUserDisplay?.isUser ? latestUserDisplay.name : "",
                  latestUserDisplay?.email || ""
                ].filter(Boolean).join(" â€¢ ")
              : "";

            const rankingData = rankingSnap.exists() ? (rankingSnap.data() || {}) : {};
            const lastRankingUpdatedAt =
              rankingData.updatedAt ||
              rankingData.lastUpdatedAt ||
              rankingData.createdAt ||
              null;

            await renderAdminOverviewCards({
              pendingUsersCount,
              pushActiveCount,
              trashCount,
              actionsTodayCount,
              lastAdminActionAt: latestAudit ? getAdminAuditTimestamp(latestAudit) : null,
              lastAdminActionSummary,
              lastRankingUpdatedAt
            });
          } catch (error) {
            console.warn("Falha ao carregar resumo do painel admin:", error);
            await renderAdminOverviewCards({
              pendingUsersCount: 0,
              pushActiveCount: null,
              trashCount: null,
              actionsTodayCount: null,
              lastAdminActionAt: null,
              lastAdminActionSummary: "",
              lastRankingUpdatedAt: null
            });
          }
        };
        window.loadAdminOverviewCards = loadAdminOverviewCards;
        window.openAdminMenu = async () => {
            window.__clearAdminReturnTarget();
            const modal = document.getElementById('modalOverlay'); 
            const cont = document.getElementById('modalContainer'); 
            modal.classList.remove('hidden');

            cont.innerHTML = `
              <div class="bg-white p-6 text-center rounded shadow-xl">
                <i class="fas fa-circle-notch fa-spin text-2xl text-[#006400] mb-3"></i>
                <p class="text-xs font-black text-gray-500 uppercase">Validando admin...</p>
              </div>
            `;

            const admin = await getCurrentAdminProfile(true);
            if (!admin) {
              alert("VocÃª nÃ£o tem permissÃ£o para acessar o painel admin.");
              closeModal();
              return;
            }
            
            cont.innerHTML = `
            <div class="w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden relative h-[85vh] flex flex-col">
                <img src="bg_painel_admin.jpeg" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover opacity-100">
                
                <div class="relative z-10 flex flex-col h-full bg-white/90">
                    <div class="bg-[#006400] p-4 text-white flex items-center shadow-md">
                        <button onclick="closeModal()" class="mr-4"><i class="fas fa-arrow-left text-xl"></i></button>
                        <div>
                            <h3 class="font-black uppercase text-lg leading-none">Painel Admin</h3>
                            <p class="text-[10px] text-[#FFD700] font-bold">GestÃ£o 2026</p>
                        </div>
                    </div>

                    <div class="flex-1 overflow-y-auto p-4 space-y-6">
                        <div>
                            <div class="admin-overview-shell">
                                <div class="flex items-start justify-between gap-3 mb-3">
                                    <div>
                                        <div class="text-[10px] font-black text-[#006400] uppercase tracking-[0.18em]">Resumo operacional</div>
                                        <h4 class="text-lg font-black text-gray-900 leading-tight">VisÃ£o rÃ¡pida do BolÃ£o</h4>
                                    </div>
                                    <button type="button" onclick="window.loadAdminOverviewCards()" class="admin-overview-refresh btn-press" title="Atualizar resumo">
                                        <i class="fas fa-rotate"></i>
                                    </button>
                                </div>
                                <div id="adminOverviewCards" class="text-xs text-gray-400 font-bold">Carregando resumo...</div>
                            </div>
                        </div>
                        
                        <div>
                            <h4 class="text-xs font-bold text-gray-500 mb-2 pl-1">âš½ GESTÃƒO DE JOGOS</h4>
                            <div class="grid grid-cols-2 gap-2">
                                <button onclick="openCreationModal()" class="bg-[#1565C0] text-white py-3 rounded font-bold text-xs shadow btn-press flex flex-col items-center gap-1"><i class="fas fa-plus-circle text-lg"></i> CriaÃ§Ã£o</button>
                                <button onclick="openQuickResultsModal()" class="bg-[#2E7D32] text-white py-3 rounded font-bold text-xs shadow btn-press flex flex-col items-center gap-1"><i class="fas fa-check-circle text-lg"></i> Baixa RÃ¡pida</button>
                                <button onclick="openCleanupModal()" class="bg-gray-700 text-white py-3 rounded font-bold text-xs shadow btn-press flex flex-col items-center gap-1"><i class="fas fa-broom text-lg"></i> Limpeza</button>
                            </div>
                        </div>

                        <div>
                            <h4 class="text-xs font-bold text-gray-500 mb-2 pl-1">ðŸ‘¥ PESSOAS & FINANCEIRO</h4>
                            <button onclick="window.openFinancialScreen()" class="w-full bg-[#C62828] text-white py-4 rounded font-bold text-xs shadow btn-press flex items-center justify-center gap-2">
                                <i class="fas fa-wallet text-lg"></i> GERENCIAR PAGAMENTOS & USUÃRIOS
                            </button>
                        </div>

                        <div>
                            <h4 class="text-xs font-bold text-gray-500 mb-2 pl-1">ðŸ“¢ COMUNICAÃ‡ÃƒO & FERRAMENTAS</h4>
                            <div class="grid grid-cols-1 gap-2">
                                <button onclick="window.openAdminCommunicationsModal()" class="bg-[#6A1B9A] text-white py-3 rounded font-bold text-xs shadow btn-press flex flex-col items-center gap-1"><i class="fas fa-bullhorn text-lg"></i> Comunicados</button>
                                <button onclick="window.openAdminRoundSummaryModal()" class="bg-[#1D4ED8] text-white py-3 rounded font-bold text-xs shadow btn-press flex flex-col items-center gap-1"><i class="fas fa-image text-lg"></i> Resumo da Rodada</button>
                                <button onclick="window.openAdminAuditHistoryModal()" class="bg-slate-800 text-white py-3 rounded font-bold text-xs shadow btn-press flex flex-col items-center gap-1"><i class="fas fa-clock-rotate-left text-lg"></i> HistÃ³rico Admin</button>
                            </div>
                        </div>

                        <div>
                            <div class="border-t border-gray-300 my-2"></div>
                            <h4 class="text-xs font-bold text-gray-500 mb-2 pl-1">ðŸ“‹ LISTA DE CONFRONTOS</h4>
                            <div class="admin-match-tools">
                                <input
                                  id="adminMatchSearch"
                                  class="admin-creation-input"
                                  value="${escapeHtml(window.__adminMatchesSearch || "")}"
                                  placeholder="Buscar jogo, time, competiÃ§Ã£o ou rodada"
                                  oninput="window.filterAdminMatches(this.value)"
                                >
                                <div class="admin-match-filters">
                                  <button type="button" onclick="window.setAdminMatchesFilter('all')" class="admin-match-filter is-active" data-admin-match-filter="all">Todos</button>
                                  <button type="button" onclick="window.setAdminMatchesFilter('open')" class="admin-match-filter" data-admin-match-filter="open">Abertos</button>
                                  <button type="button" onclick="window.setAdminMatchesFilter('waiting')" class="admin-match-filter" data-admin-match-filter="waiting">Aguardando</button>
                                  <button type="button" onclick="window.setAdminMatchesFilter('finished')" class="admin-match-filter" data-admin-match-filter="finished">Finalizados</button>
                                </div>
                                <p class="admin-match-tools__note">Filtre por time, competiÃ§Ã£o, rodada ou nÃºmero do jogo.</p>
                            </div>
                            <div id="adminMatchListSection" class="scroll-mt-24">
                              <div id="adminMatchList" class="bg-white border rounded p-2 text-xs text-gray-500 min-h-[100px]">Carregando...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
            loadAdminOverviewCards();
            loadAdminMatches();
        };
const renderAdminMatchesList = () => {
            const listDiv = document.getElementById('adminMatchList'); 
            if(!listDiv) return; 

            const all = Array.isArray(window.__adminMatchesCache) ? [...window.__adminMatchesCache] : [];
            const search = normalizeAdminMatchSearch(window.__adminMatchesSearch || "");
            const filter = window.__adminMatchesFilter || "all";
            const filtered = all.filter((m) => {
                const deadline = m.deadlineDate || toJsDate(m.deadline);
                const expired = !!m.expired || (deadline ? new Date() > deadline : false);
                const hasWinner = !!String(m.winner || "").trim();
                const matchesFilter =
                  filter === "open" ? (!expired && !hasWinner)
                  : filter === "waiting" ? (expired && !hasWinner)
                  : filter === "finished" ? hasWinner
                  : true;
                if (!matchesFilter) return false;

                if (!search) return true;
                const blob = normalizeAdminMatchSearch([
                  m.teamA,
                  m.teamB,
                  m.competition,
                  m.round,
                  m.id,
                  `#${m.matchNumber || ""}`
                ].join(" "));
                return blob.includes(search);
            });

            document.querySelectorAll("[data-admin-match-filter]").forEach((btn) => {
              btn.classList.toggle("is-active", btn.dataset.adminMatchFilter === filter);
            });

            let html = "";
            [...filtered].reverse().forEach((m) => {
                const number = m.matchNumber || (all.findIndex((x) => x.id === m.id) + 1);
                const deadline = m.deadlineDate || toJsDate(m.deadline);
                const expired = !!m.expired || (deadline ? new Date() > deadline : false);
                const winnerLabel = escapeHtml(String(m.winner || ""));
                const statusLabel = m.winner
                  ? `Finalizado â€¢ ${winnerLabel}`
                  : (expired ? "Aguardando resultado" : "Em aberto");
                const statusClass = m.winner
                  ? "text-green-700 bg-green-50"
                  : (expired ? "text-amber-700 bg-amber-50" : "text-gray-500 bg-gray-100");

                html += `<div class="flex justify-between items-center p-2 border-b border-gray-100 gap-2">
                    <div class="flex flex-col truncate min-w-0 flex-1">
                        <span class="font-bold text-black text-xs truncate">#${number} ${escapeHtml(m.teamA || "")} x ${escapeHtml(m.teamB || "")}</span>
                        <span class="text-[10px] text-gray-400 truncate">${escapeHtml(m.competition || "")}${m.round ? ` â€¢ ${escapeHtml(m.round)}` : ""}</span>
                        <span class="mt-1 inline-flex w-fit rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${statusClass}">${statusLabel}</span>
                    </div>
                    <div class="flex gap-2 flex-shrink-0">
                        <button class="text-blue-500" title="Editar confronto" onclick="window.openMatchEditModal('${escapeJsString(m.id)}')"><i class="fas fa-edit"></i></button>
                        <button class="text-red-500" onclick="moveToTrash('${m.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
            });
            listDiv.innerHTML = html || `<div class="p-4 text-center text-gray-400 text-xs font-bold">Nenhum jogo encontrado.</div>`;
};

async function loadAdminMatches() { 
            const snap = await getDocs(collection(db, "matches")); 
            let all = [];
            snap.forEach(d => {
                const m = d.data();
                // Precisa da data para ordenar
                if(m.deadline) {
                    m.deadlineDate = m.deadline.toDate();
                    m.expired = new Date() > m.deadlineDate;
                }
                all.push({id: d.id, ...m});
            });

            // Ordena para numerar
            all.sort(matchComparator);
            all.forEach((m, idx) => {
                m.matchNumber = idx + 1;
            });
            window.__adminMatchesCache = all;
            renderAdminMatchesList();
        }

        window.__adminAuditHistoryFilter = "all";
        window.__adminAuditHistoryCache = [];
        window.__adminAuditHistoryUserMap = new Map();

                const getAdminAuditGroup = (type = "") => {
          const value = String(type || "").toLowerCase();
          if (!value) return "outros";
          if (
            value.includes("match") ||
            value.includes("confront") ||
            value.includes("round") ||
            value.includes("competition") ||
            value.includes("cleanup") ||
            value.includes("quick_results") ||
            value.includes("summary")
          ) return "partidas";
          if (
            value.includes("financial") ||
            value.includes("payment") ||
            value.includes("debt") ||
            value.includes("money")
          ) return "financeiro";
          if (value.includes("rank")) return "ranking";
          if (
            value.includes("user") ||
            value.includes("invite") ||
            value.includes("password") ||
            value.includes("disable")
          ) return "usuarios";
          return "outros";
        };

        const renderAdminAuditItem = (log = {}, userMap = new Map()) => {
          try {
            const action = escapeHtml(getAdminAuditActionLabel(log));
            const userDisplay = getAdminAuditUserDisplay(log, userMap);
            const targetLabel = escapeHtml(userDisplay.isUser ? (userDisplay.name || "UsuÃ¡rio nÃ£o identificado") : (log.targetName || log.matchTitle || log.competitionName || log.roundName || log.username || log.source || "â€”"));
            const targetSecondary = escapeHtml(userDisplay.isUser ? [userDisplay.email || "", userDisplay.shortId || ""].filter(Boolean).join(" â€¢ ") || getAdminAuditCardSummary(log, userDisplay) : getAdminAuditCardSummary(log, userDisplay));
            const dateValue = getAdminAuditTimestamp(log);
            const dateLabel = dateValue && dateValue.getTime && !Number.isNaN(dateValue.getTime())
              ? escapeHtml(formatAdminPanelDateTime(dateValue) || "â€”")
              : "Data nÃ£o informada";
            const adminLabel = escapeHtml(typeof getAdminAuditActorLabel === "function" ? getAdminAuditActorLabel(log) : (log.adminName || log.createdByName || log.adminEmail || "Admin"));
            const sourceLabel = escapeHtml(log.source || "admin_audit_logs");

            return `
              <div class="border border-gray-200 rounded-2xl p-3 bg-white shadow-sm">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="text-[10px] font-black uppercase tracking-[0.16em] text-[#006400]">${action}</div>
                    <div class="text-xs font-bold text-gray-900 truncate">${targetLabel}</div>
                    <div class="text-[10px] text-gray-500 font-bold mt-1">${targetSecondary}</div>
                  </div>
                  <div class="text-[10px] font-black text-right text-gray-500 shrink-0">${dateLabel}</div>
                </div>
                <div class="mt-2 flex items-center justify-between gap-2 text-[10px] text-gray-500 font-bold">
                  <span>${adminLabel}</span>
                  <span>${sourceLabel}</span>
                </div>
              </div>
            `;
          } catch (error) {
            console.error("[AdminHistory] Erro ao renderizar item:", log, error);
            const fallbackAction = escapeHtml(getAdminAuditActionLabel(log));
            return `
              <div class="border border-amber-200 rounded-2xl p-3 bg-amber-50 shadow-sm">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">${fallbackAction}</div>
                    <div class="text-xs font-bold text-gray-900 truncate">AÃ§Ã£o administrativa</div>
                    <div class="text-[10px] text-gray-500 font-bold mt-1">Detalhes nÃ£o disponÃ­veis</div>
                  </div>
                  <div class="text-[10px] font-black text-right text-gray-500 shrink-0">Data nÃ£o informada</div>
                </div>
                <div class="mt-2 flex items-center justify-between gap-2 text-[10px] text-gray-500 font-bold">
                  <span>Admin</span>
                  <span>admin_audit_logs</span>
                </div>
              </div>
            `;
          }
        };

        const renderAdminAuditHistoryModal = () => {
          const modal = document.getElementById("modalOverlay");
          const cont = document.getElementById("modalContainer");
          if (!modal || !cont) return;

          const filter = window.__adminAuditHistoryFilter || "all";
          const logs = Array.isArray(window.__adminAuditHistoryCache) ? [...window.__adminAuditHistoryCache] : [];
          let filtered = [];
          try {
            filtered = logs.filter((log) => {
              try {
                return filter === "all" ? true : getAdminAuditGroup(log.type || log.action || "") === filter;
              } catch (error) {
                console.error("[AdminHistory] Erro ao aplicar filtro:", error, log);
                return filter === "all";
              }
            });
          } catch (error) {
            console.error("[AdminHistory] Erro ao filtrar histÃ³rico:", error);
            filtered = logs;
          }

          let rows = "";
          filtered.forEach((log) => {
            try {
              rows += renderAdminAuditItem(log, window.__adminAuditHistoryUserMap || new Map());
            } catch (error) {
              console.error("[AdminHistory] Erro ao renderizar item no loop:", log, error);
              rows += renderAdminAuditItem({ ...log, type: log.type || log.action || "audit" }, new Map());
            }
          });

          if (!rows) {
            rows = `<div class="p-4 text-center text-gray-400 text-xs font-bold">Nenhum histÃ³rico admin encontrado. As prÃ³ximas aÃ§Ãµes administrativas aparecerÃ£o aqui.</div>`;
          }

          modal.classList.remove("hidden");
          cont.innerHTML = `
            <div class="w-full max-w-md bg-white rounded-none shadow-2xl overflow-hidden relative h-[86vh] flex flex-col">
              <img src="bg_painel_admin.jpeg" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover opacity-100">
              <div class="relative z-10 flex flex-col h-full bg-white/92">
                <div class="bg-[#006400] p-4 text-white flex items-center justify-between shadow-md shrink-0">
                  <button onclick="openAdminMenu()" class="mr-3"><i class="fas fa-arrow-left text-xl"></i></button>
                  <div class="flex-1">
                    <h3 class="font-black uppercase text-lg leading-none">HistÃ³rico Admin</h3>
                    <p class="text-[10px] text-[#FFD700] font-bold">Ãšltimos ${logs.length} registros</p>
                  </div>
                  <button onclick="closeModal()" class="ml-3"><i class="fas fa-times text-xl"></i></button>
                </div>

                <div class="px-3 pt-3 shrink-0">
                  <div class="admin-cleanup-tabs">
                    <button type="button" onclick="window.setAdminAuditHistoryFilter('all')" class="admin-cleanup-tab ${filter === "all" ? "is-active" : ""}">Todos</button>
                    <button type="button" onclick="window.setAdminAuditHistoryFilter('partidas')" class="admin-cleanup-tab ${filter === "partidas" ? "is-active" : ""}">Partidas</button>
                    <button type="button" onclick="window.setAdminAuditHistoryFilter('financeiro')" class="admin-cleanup-tab ${filter === "financeiro" ? "is-active" : ""}">Financeiro</button>
                    <button type="button" onclick="window.setAdminAuditHistoryFilter('ranking')" class="admin-cleanup-tab ${filter === "ranking" ? "is-active" : ""}">Ranking</button>
                    <button type="button" onclick="window.setAdminAuditHistoryFilter('usuarios')" class="admin-cleanup-tab ${filter === "usuarios" ? "is-active" : ""}">UsuÃ¡rios</button>
                  </div>
                </div>

                <div class="flex-1 overflow-y-auto p-3 bg-gray-50 space-y-2">
                  ${rows}
                </div>

                <div class="admin-quick-results-footer shrink-0">
                  <button type="button" onclick="openAdminMenu()" class="w-full bg-gray-200 text-gray-800 py-3 rounded-2xl font-black text-xs shadow-lg btn-press">Voltar</button>
                </div>
              </div>
            </div>
          `;
        };

        window.setAdminAuditHistoryFilter = (filter = "all") => {
          window.__adminAuditHistoryFilter = ["all", "partidas", "financeiro", "ranking", "usuarios"].includes(filter) ? filter : "all";
          try {
            renderAdminAuditHistoryModal();
          } catch (error) {
            console.error("[AdminHistory] Erro ao aplicar filtro:", error);
          }
        };

        window.openAdminAuditHistoryModal = async () => {
          window.__setAdminReturnTarget(() => window.openAdminMenu());
          const admin = await getCurrentAdminProfile(true);
          if (!admin) {
            alert("VocÃª nÃ£o tem permissÃ£o para ver o histÃ³rico admin.");
            return;
          }

          const modal = document.getElementById("modalOverlay");
          const cont = document.getElementById("modalContainer");
          if (!modal || !cont) return;

          modal.classList.remove("hidden");
          cont.innerHTML = `<div class="bg-white p-6 text-center rounded shadow-xl"><i class="fas fa-circle-notch fa-spin text-2xl text-[#006400] mb-3"></i><p class="text-xs font-black text-gray-500 uppercase">Carregando histÃ³rico...</p></div>`;

          try {
            const logs = await loadRecentAdminAuditLogs({ limitSize: 50 });
            window.__adminAuditHistoryCache = Array.isArray(logs) ? logs : [];

            let userMap = new Map();
            try {
              userMap = await loadAdminUsersLookupMap(window.__adminAuditHistoryCache);
            } catch (error) {
              console.error("[AdminHistory] Erro ao resolver usuÃ¡rios:", error);
              userMap = new Map();
            }
            window.__adminAuditHistoryUserMap = userMap;
            window.__adminAuditHistoryFilter = "all";

            try {
              renderAdminAuditHistoryModal();
            } catch (renderError) {
              console.error("[AdminHistory] Erro ao renderizar histÃ³rico:", renderError);
              cont.innerHTML = `
                <div class="bg-white p-6 text-center rounded shadow-xl">
                  <p class="text-sm font-black text-red-600 mb-3">NÃ£o foi possÃ­vel renderizar o histÃ³rico admin.</p>
                  <p class="text-[11px] font-bold text-gray-500 mb-4">Detalhe tÃ©cnico: ${escapeHtml(String(renderError?.code || renderError?.message || "render-error").slice(0, 80))}</p>
                  <button onclick="openAdminMenu()" class="bg-[#006400] text-white px-4 py-2 rounded font-black text-xs">Voltar</button>
                </div>
              `;
            }
          } catch (error) {
            console.error("[AdminHistory] Erro fatal ao carregar logs:", error);
            cont.innerHTML = `
              <div class="bg-white p-6 text-center rounded shadow-xl">
                <p class="text-sm font-black text-red-600 mb-3">NÃ£o foi possÃ­vel carregar o histÃ³rico admin.</p>
                <p class="text-[11px] font-bold text-gray-500 mb-2">Verifique sua permissÃ£o de administrador ou tente novamente.</p>
                <p class="text-[11px] font-bold text-gray-400 mb-4">CÃ³digo tÃ©cnico: ${escapeHtml(String(error?.code || error?.message || "unknown").slice(0, 80))}</p>
                <button onclick="openAdminMenu()" class="bg-[#006400] text-white px-4 py-2 rounded font-black text-xs">Voltar</button>
              </div>
            `;
          }
        };
        // --- LIMPEZA / LIXEIRA WEB ---
        const getAdminMatchSortDate = (match = {}) =>
          toJsDate(match.deletedAt) ||
          toJsDate(match.trashedAt) ||
          toJsDate(match.deadline) ||
          toJsDate(match.createdAt) ||
          new Date(0);

        const formatAdminCleanupDate = (value) => {
          const date = toJsDate(value);
          if (!date) return "";
          return date.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
          });
        };

        const renderAdminCleanupToast = (title, desc = "") => {
          if (typeof window.showToast === "function") {
            window.showToast(title, desc, "");
          } else {
            alert(desc ? `${title}\n${desc}` : title);
          }
        };

        const logAdminCleanupAction = async (type, payload = {}) => {
          try {
            const admin = await getCurrentAdminProfile();
            if (!admin) return;

            await addDoc(collection(db, "admin_audit_logs"), {
              type,
              adminUid: admin.uid || "",
              adminName: admin.name || "",
              adminEmail: admin.email || "",
              source: "admin_cleanup",
              ...payload,
              createdAt: Timestamp.fromDate(new Date())
            });
          } catch (error) {
            console.warn("Falha ao registrar auditoria da limpeza:", error);
          }
        };

        const refreshAdminCleanupState = async () => {
          const [trashSnap, matchesSnap] = await Promise.all([
            getDocs(collection(db, "bin_matches")),
            getDocs(collection(db, "matches"))
          ]);

          const trashMatches = [];
          trashSnap.forEach((d) => {
            trashMatches.push({ id: d.id, ...d.data() });
          });
          trashMatches.sort((a, b) => getAdminMatchSortDate(b).getTime() - getAdminMatchSortDate(a).getTime());

          const finishedMatches = [];
          matchesSnap.forEach((d) => {
            const data = d.data() || {};
            if (!String(data.winner || "").trim()) return;
            finishedMatches.push({ id: d.id, ...data });
          });
          finishedMatches.sort((a, b) => getAdminMatchSortDate(b).getTime() - getAdminMatchSortDate(a).getTime());

          adminCleanupState.trashMatches = trashMatches;
          adminCleanupState.finishedMatches = finishedMatches;
          return adminCleanupState;
        };

        const getAdminCleanupTabButton = (tabKey, label, icon, count) => `
          <button type="button" onclick="window.switchAdminCleanupTab('${tabKey}')" class="admin-cleanup-tab ${adminCleanupState.tab === tabKey ? "is-active" : ""}">
            <i class="fas ${icon}"></i>
            <span>${label}</span>
            <small>${count}</small>
          </button>
        `;

        const renderAdminCleanupModal = () => {
          const modal = document.getElementById("modalOverlay");
          const cont = document.getElementById("modalContainer");
          if (!modal || !cont) return;

          const tab = adminCleanupState.tab === "finished" ? "finished" : "trash";
          const trashCount = adminCleanupState.trashMatches.length;
          const finishedCount = adminCleanupState.finishedMatches.length;

          const content = tab === "finished"
            ? `
              <div class="admin-creation-panel space-y-3">
                <div>
                  <div class="text-[10px] font-black text-red-600 uppercase tracking-[0.18em]">Finalizados</div>
                  <h4 class="text-lg font-black text-gray-900 leading-tight">Limpeza em massa</h4>
                </div>
                <p class="text-xs font-bold text-gray-600 leading-relaxed">Move todos os confrontos finalizados para a lixeira em uma aÃ§Ã£o de limpeza em massa.</p>
                <div class="grid grid-cols-1 gap-2">
                  <div class="admin-cleanup-summary">
                    <i class="fas fa-flag-checkered"></i>
                    <span>${finishedCount} confrontos finalizados</span>
                  </div>
                </div>
                <button type="button" onclick="window.confirmBulkCleanupFinishedMatches()" class="w-full bg-red-700 text-white py-3 rounded-2xl font-black text-xs shadow-lg btn-press flex items-center justify-center gap-2 ${finishedCount ? "" : "opacity-50 cursor-not-allowed"}" ${finishedCount ? "" : "disabled"}>
                  <i class="fas fa-triangle-exclamation"></i>
                  Limpar Finalizados
                </button>
              </div>
            `
            : `
              <div class="admin-creation-panel space-y-3">
                <div>
                  <div class="text-[10px] font-black text-[#006400] uppercase tracking-[0.18em]">Lixeira</div>
                  <h4 class="text-lg font-black text-gray-900 leading-tight">Confrontos removidos</h4>
                </div>
                <p class="text-xs font-bold text-gray-600 leading-relaxed">Abra a lixeira para restaurar ou apagar confrontos individualmente.</p>
                <button type="button" onclick="window.openTrashBin()" class="w-full bg-gray-800 text-white py-3 rounded-2xl font-black text-xs shadow-lg btn-press flex items-center justify-center gap-2">
                  <i class="fas fa-trash"></i>
                  Abrir Lixeira
                </button>
              </div>
            `;

          modal.classList.remove("hidden");
          cont.innerHTML = `
            <div class="w-full max-w-md bg-white rounded-none shadow-2xl overflow-hidden relative h-[86vh] flex flex-col">
              <img src="bg_painel_admin.jpeg" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover opacity-100">
              <div class="relative z-10 flex flex-col h-full bg-white/92">
                <div class="bg-[#006400] p-4 text-white flex items-center justify-between shadow-md shrink-0">
                  <button onclick="openAdminMenu()" class="mr-3"><i class="fas fa-arrow-left text-xl"></i></button>
                  <div class="flex-1">
                    <h3 class="font-black uppercase text-lg leading-none">Limpeza</h3>
                    <p class="text-[10px] text-[#FFD700] font-bold">Lixeira e finalizados</p>
                  </div>
                  <button onclick="closeModal()" class="ml-3"><i class="fas fa-times text-xl"></i></button>
                </div>

                <div class="px-3 pt-3 shrink-0">
                  <div class="admin-cleanup-tabs">
                    ${getAdminCleanupTabButton("trash", "Lixeira", "fa-trash", trashCount)}
                    ${getAdminCleanupTabButton("finished", "Finalizados", "fa-flag-checkered", finishedCount)}
                  </div>
                </div>

                <div class="flex-1 overflow-y-auto p-3">
                  ${content}
                </div>

                <div class="admin-quick-results-footer shrink-0">
                  <button type="button" onclick="closeModal()" class="w-full bg-gray-200 text-gray-800 py-3 rounded-2xl font-black text-xs shadow-lg btn-press">Cancelar</button>
                </div>
              </div>
            </div>
          `;
        };

        window.openCleanupModal = async () => {
          window.__setAdminReturnTarget(() => window.openAdminMenu());
          const admin = await getCurrentAdminProfile(true);
          if (!admin) {
            alert("VocÃª nÃ£o tem permissÃ£o para acessar a limpeza.");
            closeModal();
            return;
          }

          const modal = document.getElementById("modalOverlay");
          const cont = document.getElementById("modalContainer");
          if (!modal || !cont) return;

          modal.classList.remove("hidden");
          cont.innerHTML = `<div class="bg-white p-6 text-center rounded shadow-xl"><i class="fas fa-circle-notch fa-spin text-2xl text-[#006400] mb-3"></i><p class="text-xs font-black text-gray-500 uppercase">Carregando limpeza...</p></div>`;

          try {
            adminCleanupState.tab = adminCleanupState.tab || "trash";
            await refreshAdminCleanupState();
            renderAdminCleanupModal();
          } catch (error) {
            console.error("Erro ao abrir limpeza:", error);
            cont.innerHTML = `<div class="bg-white p-6 text-center rounded shadow-xl"><p class="text-sm font-black text-red-600 mb-3">NÃ£o foi possÃ­vel carregar a limpeza.</p><button onclick="openAdminMenu()" class="bg-[#006400] text-white px-4 py-2 rounded font-black text-xs">Voltar</button></div>`;
          }
        };

        window.switchAdminCleanupTab = (tabKey) => {
          adminCleanupState.tab = tabKey === "finished" ? "finished" : "trash";
          renderAdminCleanupModal();
        };

        window.moveToTrash = async (matchId) => {
          if(!confirm("Mover para Lixeira?")) return;
          const admin = await getCurrentAdminProfile(true);
          if (!admin) return alert("VocÃª nÃ£o tem permissÃ£o para mover confrontos.");

          try {
            const snap = await getDoc(doc(db, "matches", matchId));
            if(!snap.exists()) return alert("Confronto nÃ£o encontrado.");

            const nowTs = Timestamp.fromDate(new Date());
            await setDoc(doc(db, "bin_matches", matchId), {
              ...snap.data(),
              deletedAt: nowTs,
              deletedByUid: admin.uid || "",
              deletedByName: admin.name || "",
              deletedByEmail: admin.email || "",
              deleteReason: "manual_admin_trash"
            });
            await deleteDoc(doc(db, "matches", matchId));
            await logAdminCleanupAction("trash_match", {
              matchIds: [matchId],
              teams: [`${snap.data().teamA || ""} x ${snap.data().teamB || ""}`]
            });

            invalidateHomeRankingCaches();
            await loadAdminMatches();
            if (!document.getElementById("matchesScreen")?.classList.contains("hidden")) await loadMatches({ force: true });
            renderAdminCleanupToast("Confronto movido para a lixeira.");
          } catch(e) {
            alert(e.message);
          }
        };

        const renderAdminTrashBin = () => {
          const modal = document.getElementById("modalOverlay");
          const cont = document.getElementById("modalContainer");
          if (!modal || !cont) return;

          modal.classList.remove("hidden");
          const search = normalizeAdminText(adminCleanupState.search || "");
          const list = search
            ? adminCleanupState.trashMatches.filter((m) => normalizeAdminText(`${m.teamA || ""} ${m.teamB || ""} ${m.competition || ""} ${m.round || ""}`).includes(search))
            : adminCleanupState.trashMatches;

          const listHtml = list.length
            ? list.map((m) => {
                const deletedLabel = formatAdminCleanupDate(m.deletedAt || m.trashedAt);
                const deadlineLabel = formatAdminCleanupDate(m.deadline);
                return `
                  <div class="admin-trash-card">
                    <div class="admin-trash-card__main">
                      <div class="admin-trash-title">${escapeHtml(m.teamA || "Time A")} x ${escapeHtml(m.teamB || "Time B")}</div>
                      <div class="admin-trash-meta">${escapeHtml(m.competition || "Sem competiÃ§Ã£o")}${m.round ? ` â€¢ ${escapeHtml(m.round)}` : ""}</div>
                      <div class="admin-trash-meta">${deadlineLabel ? `Prazo: ${escapeHtml(deadlineLabel)}` : "Sem prazo"}${deletedLabel ? ` â€¢ Apagado: ${escapeHtml(deletedLabel)}` : ""}</div>
                    </div>
                    <div class="admin-trash-actions">
                      <button type="button" onclick="window.permanentlyDeleteMatch('${escapeJsString(m.id)}')" class="admin-trash-btn admin-trash-btn--danger">APAGAR</button>
                      <button type="button" onclick="window.restoreMatch('${escapeJsString(m.id)}')" class="admin-trash-btn admin-trash-btn--ok">â†» RESTAURAR</button>
                    </div>
                  </div>
                `;
              }).join("")
            : `<div class="admin-quick-result-empty"><div class="text-base font-black text-gray-800">Lixeira vazia.</div><p class="mt-1 text-xs text-gray-500">Nenhum confronto removido encontrado.</p></div>`;

          cont.innerHTML = `
            <div class="w-full max-w-md bg-white rounded-none shadow-2xl overflow-hidden relative h-[88vh] flex flex-col">
              <div class="bg-[#006400] p-4 text-white flex items-start justify-between shadow-md shrink-0">
                <div class="flex items-start gap-3">
                  <button onclick="openCleanupModal()" class="mt-0.5"><i class="fas fa-arrow-left text-xl"></i></button>
                  <div>
                    <h3 class="font-black uppercase text-lg leading-none">LIXEIRA (RESTAURAR)</h3>
                    <p class="text-[10px] text-[#FFD700] font-bold mt-1">Restaurar trarÃ¡ os palpites de volta.</p>
                  </div>
                </div>
                <button type="button" onclick="closeModal()" class="ml-2"><i class="fas fa-times text-xl"></i></button>
              </div>

              <div class="p-3 border-b bg-white shrink-0">
                <input id="adminTrashSearch" type="search" value="${escapeHtml(adminCleanupState.search || "")}" oninput="window.filterAdminTrash(this.value)" class="admin-creation-input" placeholder="Buscar confronto...">
              </div>

              <div class="flex-1 overflow-y-auto p-3 bg-gray-50 space-y-2">
                ${listHtml}
              </div>
            </div>
          `;

          setTimeout(() => {
            const input = document.getElementById("adminTrashSearch");
            if (!input) return;
            input.focus();
            const len = input.value.length;
            input.setSelectionRange?.(len, len);
          }, 0);
        };

        window.openTrashBin = async () => {
          window.__setAdminReturnTarget(() => window.openCleanupModal());
          const admin = await getCurrentAdminProfile(true);
          if (!admin) {
            alert("VocÃª nÃ£o tem permissÃ£o para abrir a lixeira.");
            closeModal();
            return;
          }

          const modal = document.getElementById("modalOverlay");
          const cont = document.getElementById("modalContainer");
          if (!modal || !cont) return;

          modal.classList.remove("hidden");
          cont.innerHTML = `<div class="bg-white p-6 text-center rounded shadow-xl"><i class="fas fa-circle-notch fa-spin text-2xl text-[#006400] mb-3"></i><p class="text-xs font-black text-gray-500 uppercase">Carregando lixeira...</p></div>`;

          await refreshAdminCleanupState();
          renderAdminTrashBin();
        };

        window.filterAdminTrash = (value = "") => {
          adminCleanupState.search = String(value || "");
          renderAdminTrashBin();
        };

        window.restoreMatch = async (matchId) => {
          if (!confirm("Restaurar este confronto?")) return;
          const admin = await getCurrentAdminProfile(true);
          if (!admin) return alert("VocÃª nÃ£o tem permissÃ£o para restaurar confrontos.");

          try {
            const snap = await getDoc(doc(db, "bin_matches", matchId));
            if(!snap.exists()) return alert("Confronto nÃ£o encontrado na lixeira.");

            const data = { ...snap.data() };
            const teams = `${data.teamA || ""} x ${data.teamB || ""}`;
            delete data.id;
            delete data.deletedAt;
            delete data.trashedAt;
            delete data.deletedByUid;
            delete data.deletedByName;
            delete data.deletedByEmail;
            delete data.trashedByUid;
            delete data.trashedByName;
            delete data.trashedByEmail;
            delete data.deleteReason;

            await setDoc(doc(db, "matches", matchId), data);
            await deleteDoc(doc(db, "bin_matches", matchId));
            await logAdminCleanupAction("restore_match", {
              totalMatches: 1,
              matchIds: [matchId],
              teams: [teams]
            });

            invalidateHomeRankingCaches();
            renderAdminCleanupToast("Confronto restaurado!");
            await loadAdminMatches();
            await window.openTrashBin();
            if (!document.getElementById("matchesScreen")?.classList.contains("hidden")) await loadMatches({ force: true });
          } catch(e) {
            alert(e.message);
          }
        };

        window.permanentlyDeleteMatch = async (matchId) => {
          if (!confirm("Apagar definitivamente este confronto? Essa aÃ§Ã£o nÃ£o poderÃ¡ ser desfeita.")) return;
          const admin = await getCurrentAdminProfile(true);
          if (!admin) return alert("VocÃª nÃ£o tem permissÃ£o para apagar confrontos.");

          try {
            const snap = await getDoc(doc(db, "bin_matches", matchId));
            const data = snap.exists() ? snap.data() : {};
            await deleteDoc(doc(db, "bin_matches", matchId));
            await logAdminCleanupAction("permanent_delete_match", {
              totalMatches: 1,
              matchIds: [matchId],
              teams: [`${data.teamA || ""} x ${data.teamB || ""}`]
            });

            renderAdminCleanupToast("Confronto apagado definitivamente.");
            await window.openTrashBin();
          } catch(e) {
            alert(e.message);
          }
        };

        window.confirmBulkCleanupFinishedMatches = async () => {
          await refreshAdminCleanupState();
          const total = adminCleanupState.finishedMatches.length;
          if (!total) return alert("Nenhum confronto finalizado para limpar.");

          const modal = document.getElementById("modalOverlay");
          const cont = document.getElementById("modalContainer");
          if (!modal || !cont) return;

          modal.classList.remove("hidden");
          cont.innerHTML = `
            <div class="w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden">
              <div class="bg-red-700 p-4 text-white">
                <h3 class="font-black uppercase text-lg leading-tight">âš ï¸ PERIGO: Limpeza em Massa</h3>
              </div>
              <div class="p-4 space-y-4">
                <p class="text-sm font-bold text-gray-800 leading-relaxed">VocÃª tem certeza? Isso vai mover TODOS os jogos que jÃ¡ tÃªm um vencedor definido para a Lixeira.</p>
                <p class="text-xs font-bold text-gray-500 leading-relaxed">Essa aÃ§Ã£o sÃ³ poderÃ¡ ser revertida restaurando os jogos um por um na lixeira.</p>
                <div class="rounded-2xl bg-red-50 border border-red-100 p-3 text-center text-red-700 font-black text-xs">${total} confrontos finalizados serÃ£o movidos</div>
                <button type="button" onclick="window.bulkCleanupFinishedMatches()" class="w-full bg-red-700 text-white py-3 rounded-2xl font-black text-xs shadow-lg btn-press">SIM, LIMPAR TUDO</button>
                <button type="button" onclick="window.openCleanupModal()" class="w-full bg-gray-200 text-gray-800 py-3 rounded-2xl font-black text-xs shadow-lg btn-press">Cancelar</button>
              </div>
            </div>
          `;
        };

        window.bulkCleanupFinishedMatches = async () => {
          const admin = await getCurrentAdminProfile(true);
          if (!admin) return alert("VocÃª nÃ£o tem permissÃ£o para limpar confrontos.");

          await refreshAdminCleanupState();
          const matches = adminCleanupState.finishedMatches.filter((m) => String(m.winner || "").trim());
          if (!matches.length) return alert("Nenhum confronto finalizado para limpar.");

          try {
            const nowTs = Timestamp.fromDate(new Date());
            const matchIds = [];
            const teams = [];

            for (let i = 0; i < matches.length; i += 240) {
              const chunk = matches.slice(i, i + 240);
              const batch = writeBatch(db);

              chunk.forEach((match) => {
                const { id, ...matchPayload } = match;
                matchIds.push(match.id);
                teams.push(`${match.teamA || ""} x ${match.teamB || ""}`);
                batch.set(doc(db, "bin_matches", match.id), {
                  ...matchPayload,
                  deletedAt: nowTs,
                  deletedByUid: admin.uid || "",
                  deletedByName: admin.name || "",
                  deletedByEmail: admin.email || "",
                  deleteReason: "bulk_finished_cleanup"
                });
                batch.delete(doc(db, "matches", match.id));
              });

              await batch.commit();
            }

            await logAdminCleanupAction("bulk_cleanup_finished_matches", {
              totalMatches: matches.length,
              matchIds,
              teams
            });

            invalidateHomeRankingCaches();
            renderAdminCleanupToast("Confrontos finalizados movidos para a lixeira.");
            await loadAdminMatches();
            adminCleanupState.tab = "trash";
            await refreshAdminCleanupState();
            renderAdminCleanupModal();
            if (!document.getElementById("matchesScreen")?.classList.contains("hidden")) await loadMatches({ force: true });
          } catch(e) {
            alert(e.message);
          }
        };

       // --- PAINEL FINANCEIRO / USUÃRIOS ---
        const FINANCIAL_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const FINANCIAL_MONTH_LABELS = ["Janeiro", "Fevereiro", "MarÃ§o", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

        const getFinancialCurrentMonthIndex = () => new Date().getMonth();
        const getFinancialCurrentMonthKey = () => FINANCIAL_MONTHS[getFinancialCurrentMonthIndex()];
        const getFinancialCurrentMonthName = () => FINANCIAL_MONTH_LABELS[getFinancialCurrentMonthIndex()];
        const getFinancialCurrentMonthYearKey = () => {
          const now = new Date();
          return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        };

        const normalizeFinancialUsername = (value = "") => {
          let text = String(value || "").trim().toLowerCase();
          if (!text) return "";
          if (text.includes("@")) text = text.split("@")[0];
          text = text.replace(/^@+/, "").replace(/\s+/g, "");
          return text;
        };

        const normalizeFinancialSearch = (value = "") =>
          normalizeAdminText(value)
            .replace(/\s+/g, " ")
            .trim();

        const formatFinancialDateTime = (value) => {
          const date = toJsDate(value);
          if (!date) return "Nunca";
          return date.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
          });
        };

        const parseFinancialVersionScore = (value = "") => {
          const text = String(value || "").trim();
          if (!text) return 0;
          const nums = text.match(/\d+/g);
          if (!nums || !nums.length) return 0;
          return nums.slice(0, 4).reduce((acc, part) => (acc * 1000) + Number(part || 0), 0);
        };

        const isFinancialUserPaid = (user, monthKey = getFinancialCurrentMonthKey()) => {
          if (!user) return false;
          const year = new Date().getFullYear();
          if (year < 2026) return true;
          return user.payments?.[monthKey] === true;
        };

        const getFinancialUserLastLoginValue = (user) => {
          const date = toJsDate(user?.lastAccess || user?.lastLogin || user?.lastLoginAt || user?.updatedAt || user?.createdAt);
          return date ? date.getTime() : 0;
        };

        const getFinancialUserSearchBlob = (user = {}) =>
          normalizeFinancialSearch([
            user.name,
            user.username,
            user.nickName,
            user.nickname,
            user.apelido,
            user.alias,
            user.email
          ].filter(Boolean).join(" "));

        const sortFinancialUsers = (items = []) => {
          const dir = adminFinancialState.sortDir === "desc" ? -1 : 1;
          const key = adminFinancialState.sortKey || "name";
          const monthKey = getFinancialCurrentMonthKey();
          const list = [...items];

          list.sort((a, b) => {
            if (key === "status") {
              const ap = isFinancialUserPaid(a, monthKey) ? 1 : 0;
              const bp = isFinancialUserPaid(b, monthKey) ? 1 : 0;
              if (ap !== bp) return (ap - bp) * (adminFinancialState.sortDir === "desc" ? -1 : 1);
              return String(a.name || "").localeCompare(String(b.name || ""));
            }

            if (key === "version") {
              const av = parseFinancialVersionScore(a.appVersion || "");
              const bv = parseFinancialVersionScore(b.appVersion || "");
              if (av !== bv) return (av - bv) * (adminFinancialState.sortDir === "desc" ? -1 : 1);
              return String(a.name || "").localeCompare(String(b.name || ""));
            }

            if (key === "lastLogin") {
              const ad = getFinancialUserLastLoginValue(a);
              const bd = getFinancialUserLastLoginValue(b);
              if (ad !== bd) return (ad - bd) * (adminFinancialState.sortDir === "desc" ? -1 : 1);
              return String(a.name || "").localeCompare(String(b.name || ""));
            }

            const cmp = String(a.name || "").localeCompare(String(b.name || ""));
            return cmp * (adminFinancialState.sortDir === "desc" ? -1 : 1);
          });

          return list;
        };

        const getFinancialActiveSortArrow = (key) => {
          if (adminFinancialState.sortKey !== key) return "";
          return adminFinancialState.sortDir === "desc" ? "â†“" : "â†‘";
        };

        const showFinancialToast = (message, tone = "success") => {
          const existing = document.getElementById("adminFinancialToast");
          if (existing) existing.remove();

          const el = document.createElement("div");
          el.id = "adminFinancialToast";
          el.className = `admin-financial-toast ${tone === "danger" ? "is-danger" : ""}`;
          el.textContent = message;
          document.body.appendChild(el);

          requestAnimationFrame(() => el.classList.add("show"));
          clearTimeout(window.__adminFinancialToastTimeout);
          window.__adminFinancialToastTimeout = setTimeout(() => {
            el.classList.remove("show");
            setTimeout(() => el.remove(), 220);
          }, 2200);
        };

        const logAdminFinancialAction = async (type, payload = {}) => {
          try {
            const admin = await getCurrentAdminProfile();
            if (!admin) return;
            await addDoc(collection(db, "admin_audit_logs"), {
              type,
              adminUid: admin.uid || "",
              adminName: admin.name || "",
              adminEmail: admin.email || "",
              source: "admin_financial",
              ...payload,
              createdAt: Timestamp.fromDate(new Date())
            });
          } catch (error) {
            console.warn("Falha ao registrar auditoria financeira:", error);
          }
        };

        const loadAdminFinancialUsers = async () => {
          const snap = await getDocs(collection(db, "users"));
          const users = [];
          snap.forEach((d) => {
            const data = d.data() || {};
            users.push({
              id: d.id,
              uid: d.id,
              ...data,
              name: data.name || data.username || "Sem nome",
              username: data.username || "",
              email: data.email || "",
              nickName: data.nickName || data.nickname || data.apelido || "",
              nickname: data.nickname || data.nickName || data.apelido || "",
              lastAccessDate: toJsDate(data.lastAccess || data.lastLogin || data.lastLoginAt || data.updatedAt || data.createdAt),
              debts: Number(data.debts || 0),
              payments: data.payments || {},
              passwordHint: data.passwordHint || "",
              rulesAcceptedVersion: data.rulesAcceptedVersion || "",
              rulesAcceptedAt: data.rulesAcceptedAt || null,
              isAdmin: data.isAdmin === true,
              isActive: data.isActive !== false
            });
          });
          adminFinancialState.users = users;
          window.__adminUsersCache = users;
          return users;
        };

        const loadAdminPushStatuses = async () => {
          try {
            const activeUser = auth.currentUser || currentUser;
            if (!activeUser) return {};
            const idToken = await activeUser.getIdToken(true);
            const response = await fetch("/api/admin-push-status", {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${idToken}`
              }
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || result?.ok === false) throw new Error(result?.error || "admin_push_status_error");
            adminFinancialState.pushStatuses = result.users || {};
            return adminFinancialState.pushStatuses;
          } catch (error) {
            console.warn("NÃ£o foi possÃ­vel carregar status de push dos usuÃ¡rios:", error);
            adminFinancialState.pushStatuses = {};
            return {};
          }
        };

        const loadAdminWhitelistUsers = async () => {
          const snap = await getDocs(collection(db, "whitelist"));
          const items = [];
          snap.forEach((d) => {
            const data = d.data() || {};
            const username = normalizeFinancialUsername(data.username || d.id);
            if (!username) return;
            items.push({
              id: d.id,
              username,
              createdAt: data.createdAt || null,
              createdByName: data.createdByName || "",
              createdByEmail: data.createdByEmail || "",
              createdByUid: data.createdByUid || ""
            });
          });
          items.sort((a, b) => a.username.localeCompare(b.username));
          adminFinancialState.whitelist = items;
          return items;
        };

        const getFinancialPaymentsSummary = (user) => {
          const monthKey = getFinancialCurrentMonthKey();
          const monthName = getFinancialCurrentMonthName();
          const paid = isFinancialUserPaid(user, monthKey);
          return paid ? "PAGO" : `MÃŠS ${monthName} PENDENTE`;
        };

        const renderFinancialUserChip = (label, tone = "default") => `
          <span class="status-chip status-chip--${tone}">${escapeHtml(label)}</span>
        `;

        const getFinancialPushStatusChip = (user = {}) => {
          const status = adminFinancialState.pushStatuses?.[user.id || user.uid]
            || adminFinancialState.pushStatuses?.[user.uid]
            || adminFinancialState.pushStatuses?.[user.id];
          const apiTokenCount = Number(status?.tokenCount || 0);
          const userTokenCount = Number(user.webPushTokenCount || 0);
          const userHasPush = user.hasWebPushToken === true
            || user.webPushLastStatus === "active"
            || userTokenCount > 0;

          if (status?.active) {
            return {
              label: apiTokenCount > 1 ? `Push ativo Â· ${apiTokenCount} aparelhos` : "Push ativo",
              tone: "success"
            };
          }

          if (userHasPush) {
            return {
              label: userTokenCount > 1 ? `Push ativo Â· ${userTokenCount} aparelhos` : "Push ativo",
              tone: "success"
            };
          }

          if (user.webPushLastStatus === "denied") return { label: "PermissÃ£o negada", tone: "warning" };
          if (user.webPushLastStatus === "ios_not_installed") return { label: "iPhone: precisa instalar", tone: "warning" };
          if (user.webPushLastStatus === "unsupported") return { label: "Navegador incompatÃ­vel", tone: "warning" };
          if (user.webPushLastStatus === "not_configured") return { label: "Push nÃ£o configurado", tone: "default" };
          return { label: "Sem push", tone: "default" };
        };

        const renderFinancialUserCard = (user) => {
          const paid = isFinancialUserPaid(user);
          const versionLabel = String(user.appVersion || "Sem versÃ£o").trim();
          const loginLabel = formatFinancialDateTime(user.lastAccessDate);
          const rulesLabel = user.rulesAccepted === true
            ? `ACEITO ${user.rulesAcceptedVersion || ""}`.trim()
            : "REGULAMENTO PENDENTE";
          const debtLabel = user.debts > 0 ? `INADIMPLÃŠNCIA ${user.debts}` : "SEM MULTAS";
          const inactiveClass = user.isActive === false ? "admin-financial-card--inactive" : "";
          const pushChip = getFinancialPushStatusChip(user);

          return `
            <div class="admin-financial-card ${inactiveClass}">
              <div class="flex items-start gap-3">
                <div class="admin-financial-avatar">
                  <img src="${getAvatarUrl(user.photoBase64, user.name || user.username)}" alt="${escapeHtml(user.name || user.username)}">
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <div class="admin-financial-name">${escapeHtml(user.name || "Sem nome")}</div>
                      <div class="admin-financial-username">@${escapeHtml(user.username || user.id || "")}</div>
                    </div>
                    <button type="button" onclick="window.openFinancialUserModal('${escapeJsString(user.id)}')" class="admin-financial-edit">
                      <i class="fas fa-pen"></i>
                    </button>
                  </div>
                  <div class="admin-financial-badges">
                    ${renderFinancialUserChip(versionLabel, "default")}
                    ${renderFinancialUserChip(`Ãšltimo login ${loginLabel}`, paid ? "success" : "warning")}
                    ${renderFinancialUserChip(rulesLabel, user.rulesAccepted === true ? "success" : "warning")}
                    ${renderFinancialUserChip(getFinancialPaymentsSummary(user), paid ? "success" : "danger")}
                    ${renderFinancialUserChip(pushChip.label, pushChip.tone)}
                    ${renderFinancialUserChip(debtLabel, user.debts > 0 ? "danger" : "default")}
                    ${user.isAdmin ? renderFinancialUserChip("ADMIN", "default") : ""}
                    ${user.isActive === false ? renderFinancialUserChip("INATIVO", "danger") : ""}
                  </div>
                </div>
              </div>
            </div>
          `;
        };

        const renderFinancialScreenShell = (users = []) => {
          const search = normalizeFinancialSearch(adminFinancialState.search || "");
          const filtered = search
            ? users.filter((user) => getFinancialUserSearchBlob(user).includes(search))
            : users;
          const sorted = sortFinancialUsers(filtered);
          const monthKey = getFinancialCurrentMonthKey();
          const pendingCount = sorted.filter((user) => !isFinancialUserPaid(user, monthKey) && user.isActive !== false).length;
          const paidCount = sorted.filter((user) => isFinancialUserPaid(user, monthKey)).length;
          const activeSort = adminFinancialState.sortKey;

          const sortBtn = (key, label) => `
            <button type="button" onclick="window.toggleFinancialSort('${key}')" class="admin-financial-sort ${activeSort === key ? "is-active" : ""}">
              <span>${label}</span>
              <small>${getFinancialActiveSortArrow(key)}</small>
            </button>
          `;

          return `
            <div class="w-full max-w-md bg-white rounded-none shadow-2xl overflow-hidden relative h-[86vh] flex flex-col">
              <img src="bg_painel_admin.jpeg" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover opacity-100">
              <div class="relative z-10 flex flex-col h-full bg-white/92">
                <div class="bg-[#006400] p-4 text-white flex items-start justify-between shadow-md shrink-0">
                  <div class="pr-3">
                    <h3 class="font-black uppercase text-lg leading-none">GESTÃƒO FINANCEIRA</h3>
                    <p class="text-[10px] text-[#FFD700] font-bold mt-1">${getFinancialCurrentMonthName()} â€¢ ${sorted.length} usuÃ¡rios</p>
                  </div>
                  <button type="button" onclick="closeModal()" class="ml-2"><i class="fas fa-times text-xl"></i></button>
                </div>

                <div class="flex-1 overflow-y-auto p-3 space-y-3">
                  <div class="admin-creation-panel space-y-3">
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <div class="text-[10px] font-black text-[#006400] uppercase tracking-[0.18em]">Resumo</div>
                        <h4 class="text-lg font-black text-gray-900 leading-tight">Controle de acesso, mensalidade e multas.</h4>
                      </div>
                      <span class="status-chip status-chip--default">${pendingCount} pendentes</span>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                      <button type="button" onclick="window.openInviteManager()" class="bg-[#6A1B9A] text-white py-3 rounded-2xl font-black text-xs shadow-lg btn-press flex items-center justify-center gap-2">
                        <i class="fas fa-link"></i> CONVITES
                      </button>
                      <button type="button" onclick="window.openFinancialAuditModal()" class="bg-red-600 text-white py-3 rounded-2xl font-black text-xs shadow-lg btn-press flex items-center justify-center gap-2">
                        <i class="fas fa-bolt"></i> AUDITAR
                      </button>
                    </div>

                    <div>
                      <label class="admin-compact-label">Buscar participante</label>
                      <input id="adminFinancialSearch" type="search" class="admin-creation-input" placeholder="Buscar participante" value="${escapeHtml(adminFinancialState.search || "")}" oninput="window.filterFinancialUsers(this.value)">
                    </div>

                    <div class="admin-financial-sortbar">
                      ${sortBtn("name", "Nome")}
                      ${sortBtn("status", "Status")}
                      ${sortBtn("version", "VersÃ£o")}
                      ${sortBtn("lastLogin", "Ãšltimo login")}
                    </div>
                  </div>

                  <div class="admin-financial-summary">
                    <span class="status-chip status-chip--success">${paidCount} pagos</span>
                    <span class="status-chip status-chip--warning">${pendingCount} pendentes</span>
                    <span class="status-chip status-chip--default">${sorted.length} exibidos</span>
                  </div>

                  <div id="adminFinancialUsersList" class="space-y-2">
                    ${sorted.length ? sorted.map((user) => renderFinancialUserCard(user)).join("") : `
                      <div class="admin-quick-result-empty">
                        <div class="text-base font-black text-gray-800">Nenhum participante encontrado.</div>
                        <p class="mt-1 text-xs text-gray-500">Tente outro nome, usuÃ¡rio ou email.</p>
                      </div>
                    `}
                  </div>
                </div>
              </div>
            </div>
          `;
        };

        const refreshFinancialScreen = async () => {
          adminFinancialState.loading = true;
          const [users] = await Promise.all([
            loadAdminFinancialUsers(),
            loadAdminPushStatuses(),
            loadAdminWhitelistUsers().catch(() => [])
          ]);
          adminFinancialState.loading = false;
          return renderFinancialScreenShell(users);
        };

        window.toggleFinancialSort = (key) => {
          const safeKey = ["name", "status", "version", "lastLogin"].includes(key) ? key : "name";
          if (adminFinancialState.sortKey === safeKey) {
            adminFinancialState.sortDir = adminFinancialState.sortDir === "asc" ? "desc" : "asc";
          } else {
            adminFinancialState.sortKey = safeKey;
            adminFinancialState.sortDir = safeKey === "status" ? "desc" : "asc";
          }
          window.openFinancialScreen();
        };

        window.filterFinancialUsers = (value = "") => {
          adminFinancialState.search = String(value || "");
          window.openFinancialScreen();
        };

        const loadFinancialAuditSummary = async () => {
          const monthKey = getFinancialCurrentMonthYearKey();
          const pendingUsers = (adminFinancialState.users || []).filter((user) => !isFinancialUserPaid(user) && user.isActive !== false);
          const logSnap = await getDocs(query(collection(db, "admin_audit_logs"), where("type", "==", "financial_audit")));
          const alreadyApplied = [];
          logSnap.forEach((d) => {
            const data = d.data() || {};
            if (String(data.month || "") === monthKey) {
              alreadyApplied.push(data);
            }
          });

          return {
            monthKey,
            pendingUsers,
            alreadyApplied: alreadyApplied.length > 0
          };
        };

        window.addFinancialInvite = async () => {
          const input = document.getElementById("adminInviteInput");
          const raw = String(input?.value || "").trim();
          const username = normalizeFinancialUsername(raw);
          if (!username) {
            showFinancialToast("Informe um usuÃ¡rio.", "danger");
            return;
          }

          const duplicate = (adminFinancialState.whitelist || []).some((item) => normalizeFinancialUsername(item.username || item.id || "") === username);
          if (duplicate) {
            showFinancialToast("Convite jÃ¡ existe.", "danger");
            return;
          }

          try {
            const admin = await getCurrentAdminProfile(true);
            const nowTs = Timestamp.fromDate(new Date());
            await setDoc(doc(db, "whitelist", username), {
              username,
              createdAt: nowTs,
              createdByUid: admin?.uid || "",
              createdByName: admin?.name || "",
              createdByEmail: admin?.email || ""
            }, { merge: true });

            await logAdminFinancialAction("create_invite", { username });
            if (input) input.value = "";
            await loadAdminWhitelistUsers();
            await renderAdminInviteManager();
            showFinancialToast("Convite criado!");
          } catch (error) {
            console.error("Erro ao criar convite:", error);
            showFinancialToast("NÃ£o foi possÃ­vel criar o convite.", "danger");
          }
        };

        window.revokeFinancialInvite = async (username) => {
          const clean = normalizeFinancialUsername(username);
          if (!clean) return;

          const confirmText = `âš ï¸ REVOGAR ACESSO?\n\nVocÃª vai remover o convite de: ${clean}\nO usuÃ¡rio perderÃ¡ o acesso ao app imediatamente.\nFique tranquilo: os pontos e histÃ³rico dele NÃƒO serÃ£o apagados.`;
          if (!confirm(confirmText)) return;

          try {
            await deleteDoc(doc(db, "whitelist", clean));
            await logAdminFinancialAction("revoke_invite", { username: clean });
            await loadAdminWhitelistUsers();
            await renderAdminInviteManager();
            showFinancialToast("Acesso revogado.");
          } catch (error) {
            console.error("Erro ao revogar convite:", error);
            showFinancialToast("NÃ£o foi possÃ­vel revogar o acesso.", "danger");
          }
        };

        window.openInviteManager = async () => {
          const admin = await getCurrentAdminProfile(true);
          if (!admin) {
            alert("VocÃª nÃ£o tem permissÃ£o para acessar os convites.");
            return;
          }

          await loadAdminWhitelistUsers().catch(() => []);
          await renderAdminInviteManager();
        };

        window.openFinancialAuditModal = async () => {
          window.__setAdminReturnTarget(() => window.openFinancialScreen());
          const admin = await getCurrentAdminProfile(true);
          if (!admin) {
            alert("VocÃª nÃ£o tem permissÃ£o para auditar pagamentos.");
            return;
          }

          const modal = document.getElementById("modalOverlay");
          const cont = document.getElementById("modalContainer");
          if (!modal || !cont) return;

          modal.classList.remove("hidden");
          cont.innerHTML = `<div class="bg-white p-6 text-center rounded shadow-xl"><i class="fas fa-circle-notch fa-spin text-2xl text-[#006400] mb-3"></i><p class="text-xs font-black text-gray-500 uppercase">Carregando auditoria...</p></div>`;

          await loadAdminFinancialUsers();
          const summary = await loadFinancialAuditSummary();
          const pendingList = summary.pendingUsers.map((user) => `
            <div class="text-xs text-red-600 font-bold">${escapeHtml(user.name || user.username || "Sem nome")}</div>
          `).join("");

          const blocked = new Date().getDate() <= 10;
          cont.innerHTML = `
            <div class="w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden">
              <div class="bg-red-700 p-4 text-white">
                <h3 class="font-black uppercase text-lg leading-tight">Auditoria: ${escapeHtml(getFinancialCurrentMonthName())}</h3>
              </div>
              <div class="p-4 space-y-3">
                <div class="text-sm font-black text-gray-800">UsuÃ¡rios com pagamento pendente neste mÃªs: ${summary.pendingUsers.length}</div>
                <p class="text-xs text-gray-600 font-bold">Deseja aplicar +1 multa automÃ¡tica para todos?</p>
                ${blocked ? `<div class="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-black text-red-700">A auditoria automÃ¡tica sÃ³ pode ser aplicada apÃ³s o dia 10.</div>` : ""}
                ${pendingList ? `<div class="max-h-40 overflow-y-auto rounded-2xl border bg-gray-50 p-3 space-y-1">${pendingList || ""}</div>` : ""}
                <div class="grid grid-cols-2 gap-2 pt-2">
                  <button type="button" onclick="window.openFinancialScreen()" class="bg-gray-200 text-gray-800 py-3 rounded-2xl font-black text-xs shadow-lg btn-press">Cancelar</button>
                  <button type="button" onclick="window.applyFinancialAudit()" class="bg-red-700 text-white py-3 rounded-2xl font-black text-xs shadow-lg btn-press ${blocked || !summary.pendingUsers.length || summary.alreadyApplied ? "opacity-50 cursor-not-allowed" : ""}" ${blocked || !summary.pendingUsers.length || summary.alreadyApplied ? "disabled" : ""}>Aplicar Multas</button>
                </div>
              </div>
            </div>
          `;
        };

        window.applyFinancialAudit = async () => {
          const admin = await getCurrentAdminProfile(true);
          if (!admin) {
            alert("VocÃª nÃ£o tem permissÃ£o para aplicar multas.");
            return;
          }

          const day = new Date().getDate();
          if (day <= 10) {
            showFinancialToast("A auditoria automÃ¡tica sÃ³ pode ser aplicada apÃ³s o dia 10.", "danger");
            return;
          }

          await loadAdminFinancialUsers();
          const summary = await loadFinancialAuditSummary();
          if (!summary.pendingUsers.length) {
            showFinancialToast("Nenhum usuÃ¡rio pendente neste mÃªs.", "danger");
            return;
          }

          if (summary.alreadyApplied) {
            showFinancialToast("A auditoria deste mÃªs jÃ¡ foi aplicada.", "danger");
            return;
          }

          if (!confirm("Aplicar +1 multa automÃ¡tica para todos os usuÃ¡rios pendentes?")) return;

          try {
            const chunks = [];
            for (let i = 0; i < summary.pendingUsers.length; i += 450) {
              chunks.push(summary.pendingUsers.slice(i, i + 450));
            }

            const affectedUsers = [];
            for (const chunk of chunks) {
              const batch = writeBatch(db);
              chunk.forEach((user) => {
                const nextDebts = Number(user.debts || 0) + 1;
                batch.update(doc(db, "users", user.id), { debts: nextDebts });
                affectedUsers.push({
                  userId: user.id,
                  username: user.username || "",
                  name: user.name || "",
                  debts: nextDebts
                });
              });
              await batch.commit();
            }

            await logAdminFinancialAction("financial_audit", {
              month: getFinancialCurrentMonthYearKey(),
              totalPending: summary.pendingUsers.length,
              totalApplied: summary.pendingUsers.length,
              skippedAlreadyApplied: 0,
              affectedUsers
            });

            invalidateHomeRankingCaches();
            await refreshRankingMovementAfterOfficialChange({
              source: "financial_audit",
              updatedBy: admin.uid || "",
              updatedByName: admin.name || "",
              updatedByEmail: admin.email || ""
            });
            showFinancialToast("Multas aplicadas!");
            await window.openFinancialScreen();
          } catch (error) {
            console.error("Erro ao aplicar auditoria financeira:", error);
            showFinancialToast("NÃ£o foi possÃ­vel aplicar as multas.", "danger");
          }
        };

        const renderAdminInviteManager = async () => {
          const modal = document.getElementById("modalOverlay");
          const cont = document.getElementById("modalContainer");
          if (!modal || !cont) return;

          const items = [...(adminFinancialState.whitelist || [])].sort((a, b) => a.username.localeCompare(b.username));
          const htmlItems = items.length ? items.map((item) => `
            <div class="admin-invite-card">
              <div class="min-w-0">
                <div class="admin-invite-name">${escapeHtml(item.username)}</div>
                <div class="admin-invite-meta">${item.createdAt ? `Criado em ${escapeHtml(formatFinancialDateTime(item.createdAt))}` : "Convite vigente"}</div>
              </div>
              <button type="button" onclick="window.revokeFinancialInvite('${escapeJsString(item.username)}')" class="admin-invite-delete">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          `).join("") : `<div class="admin-quick-result-empty"><div class="text-base font-black text-gray-800">Nenhum convite vigente.</div><p class="mt-1 text-xs text-gray-500">Adicione um usuÃ¡rio para liberar acesso ao app.</p></div>`;

          modal.classList.remove("hidden");
          cont.innerHTML = `
            <div class="w-full max-w-md bg-white rounded-none shadow-2xl overflow-hidden relative h-[86vh] flex flex-col">
              <div class="bg-[#006400] p-4 text-white flex items-start justify-between shadow-md shrink-0">
                <div class="pr-3">
                  <h3 class="font-black uppercase text-lg leading-none">GERENCIAR CONVITES</h3>
                  <p class="text-[10px] text-[#FFD700] font-bold mt-1">Controle de Acesso (Whitelist)</p>
                </div>
                <button type="button" onclick="window.openFinancialScreen()" class="ml-2"><i class="fas fa-times text-xl"></i></button>
              </div>

              <div class="flex-1 overflow-y-auto p-3 space-y-3">
                <div class="admin-creation-panel space-y-3">
                  <div>
                    <div class="text-[10px] font-black text-[#006400] uppercase tracking-[0.18em]">Novo Convite</div>
                    <div class="mt-2 flex gap-2">
                      <input id="adminInviteInput" type="text" class="admin-creation-input flex-1" placeholder="UsuÃ¡rio (sem @bolao...)" autocomplete="off">
                      <button type="button" onclick="window.addFinancialInvite()" class="admin-search-btn"><i class="fas fa-plus"></i></button>
                    </div>
                  </div>
                  <div class="flex items-center justify-between">
                    <h4 class="text-sm font-black text-gray-800">Vigentes (${items.length})</h4>
                    <span class="status-chip status-chip--default">A-Z</span>
                  </div>
                </div>
                <div class="space-y-2">${htmlItems}</div>
              </div>
              <div class="admin-quick-results-footer shrink-0">
                <button type="button" onclick="window.openFinancialScreen()" class="w-full bg-gray-200 text-gray-800 py-3 rounded-2xl font-black text-xs shadow-lg btn-press">Cancelar</button>
              </div>
            </div>
          `;
          setTimeout(() => document.getElementById("adminInviteInput")?.focus(), 0);
        };

        const renderAdminFinancialUserEditModal = () => {
          const modal = document.getElementById("modalOverlay");
          const cont = document.getElementById("modalContainer");
          if (!modal || !cont || !adminFinancialState.editUserDraft) return;

          const draft = adminFinancialState.editUserDraft;
          const monthBlocks = FINANCIAL_MONTHS.map((month, idx) => {
            const paid = draft.payments?.[month] === true;
            return `<button type="button" onclick="window.toggleFinancialUserMonth('${escapeJsString(month)}')" class="admin-financial-month ${paid ? "is-paid" : ""}">${month}</button>`;
          }).join("");

          modal.classList.remove("hidden");
          cont.innerHTML = `
            <div class="w-full max-w-md bg-white rounded-none shadow-2xl overflow-hidden relative h-[88vh] flex flex-col">
              <div class="bg-[#006400] p-4 text-white flex items-start justify-between shadow-md shrink-0">
                <div class="pr-3">
                  <h3 class="font-black uppercase text-lg leading-none">Gerenciar @${escapeHtml(draft.username || "")}</h3>
                  <p class="text-[10px] text-[#FFD700] font-bold mt-1">${escapeHtml(draft.name || "Sem nome")}</p>
                </div>
                <button type="button" onclick="closeModal()" class="ml-2"><i class="fas fa-times text-xl"></i></button>
              </div>

              <div class="flex-1 overflow-y-auto p-3 space-y-3">
                <div class="admin-creation-panel space-y-3">
                  <div>
                    <div class="text-[10px] font-black text-[#006400] uppercase tracking-[0.18em]">Dica de senha</div>
                    <div class="mt-1 text-sm font-bold text-gray-700">${escapeHtml(draft.passwordHint || "Sem dica")}</div>
                  </div>

                  <div class="grid grid-cols-2 gap-2">
                    <button type="button" onclick="window.openResetUserPasswordModal()" class="bg-black text-white py-3 rounded-2xl font-black text-xs shadow-lg btn-press flex items-center justify-center gap-2">
                      <i class="fas fa-key"></i> RESETAR SENHA
                    </button>
                    <button type="button" onclick="window.toggleFinancialUserActive()" class="bg-gray-800 text-white py-3 rounded-2xl font-black text-xs shadow-lg btn-press flex items-center justify-center gap-2">
                      <i class="fas fa-user-slash"></i> EXCLUIR USUÃRIO
                    </button>
                  </div>

                  <div>
                    <div class="text-[10px] font-black text-[#006400] uppercase tracking-[0.18em]">InadimplÃªncias</div>
                    <div class="mt-2 flex items-center justify-center gap-3">
                      <button type="button" onclick="window.adjustFinancialUserDebt(-1)" class="admin-financial-debt-btn"><i class="fas fa-minus"></i></button>
                      <span class="admin-financial-debt-value">${Number(draft.debts || 0)}</span>
                      <button type="button" onclick="window.adjustFinancialUserDebt(1)" class="admin-financial-debt-btn admin-financial-debt-btn--plus"><i class="fas fa-plus"></i></button>
                    </div>
                  </div>

                  <div>
                    <div class="text-[10px] font-black text-[#006400] uppercase tracking-[0.18em]">Pagamentos</div>
                    <div class="admin-financial-month-grid mt-2">${monthBlocks}</div>
                  </div>

                  <div class="text-[11px] font-bold text-gray-500">
                    Ãšltimo login: ${escapeHtml(formatFinancialDateTime(draft.lastAccessDate))}
                  </div>
                </div>
              </div>

              <div class="admin-quick-results-footer shrink-0">
                <div class="grid grid-cols-3 gap-2">
                  <button type="button" onclick="closeModal()" class="bg-gray-200 text-gray-800 py-3 rounded-2xl font-black text-xs shadow-lg btn-press">Cancelar</button>
                  <button type="button" onclick="window.saveFinancialUserEdit()" class="bg-[#006400] text-white py-3 rounded-2xl font-black text-xs shadow-lg btn-press col-span-2">Salvar</button>
                </div>
              </div>
            </div>
          `;
        };
        window.openFinancialUserModal = async (uid) => {
          window.__setAdminReturnTarget(() => window.openFinancialScreen());
          const user = (adminFinancialState.users || []).find((item) => item.id === uid);
          if (!user) {
            showFinancialToast("UsuÃ¡rio nÃ£o encontrado.", "danger");
            return;
          }

          adminFinancialState.editUserId = uid;
          adminFinancialState.editUserDraft = {
            ...user,
            payments: { ...(user.payments || {}) },
            debts: Number(user.debts || 0),
            passwordHint: String(user.passwordHint || "").trim()
          };
          renderAdminFinancialUserEditModal();
        };

        window.toggleFinancialUserMonth = (month) => {
          const draft = adminFinancialState.editUserDraft;
          if (!draft) return;
          draft.payments = draft.payments || {};
          draft.payments[month] = !draft.payments[month];
          renderAdminFinancialUserEditModal();
        };

        window.adjustFinancialUserDebt = (delta) => {
          const draft = adminFinancialState.editUserDraft;
          if (!draft) return;
          draft.debts = Math.max(0, Number(draft.debts || 0) + Number(delta || 0));
          renderAdminFinancialUserEditModal();
        };

        window.toggleFinancialUserActive = async () => {
          const draft = adminFinancialState.editUserDraft;
          if (!draft) return;

          const confirmText = `âš ï¸ EXCLUIR USUÃRIO?\n\nVocÃª vai revogar o acesso de @${draft.username}.\n\nOs pontos, palpites, pagamentos e histÃ³rico serÃ£o preservados.`;
          if (!confirm(confirmText)) return;

          try {
            const admin = await getCurrentAdminProfile(true);
            const ref = doc(db, "users", draft.id);
            await setDoc(ref, {
              isActive: false,
              disabledAt: Timestamp.fromDate(new Date()),
              disabledByUid: admin?.uid || "",
              disabledByName: admin?.name || "",
              disabledByEmail: admin?.email || ""
            }, { merge: true });

            await deleteDoc(doc(db, "whitelist", normalizeFinancialUsername(draft.username || ""))).catch(() => {});
            await logAdminFinancialAction("disable_user", {
              targetUserId: draft.id,
              username: draft.username || "",
              name: draft.name || ""
            });

            invalidateHomeRankingCaches();
            await refreshRankingMovementAfterOfficialChange({
              source: "disable_user",
              updatedBy: admin?.uid || "",
              updatedByName: admin?.name || "",
              updatedByEmail: admin?.email || ""
            });

            showFinancialToast("UsuÃ¡rio desativado.");
            adminFinancialState.editUserDraft.isActive = false;
            await loadAdminFinancialUsers();
            renderAdminFinancialUserEditModal();
            await window.openFinancialScreen();
          } catch (error) {
            console.error("Erro ao desativar usuÃ¡rio:", error);
            showFinancialToast("NÃ£o foi possÃ­vel desativar o usuÃ¡rio.", "danger");
          }
        };

        window.openResetUserPasswordModal = () => {
          const draft = adminFinancialState.editUserDraft;
          if (!draft) return;
          window.__setAdminReturnTarget(() => window.openFinancialUserModal(draft.id));

          const modal = document.getElementById("modalOverlay");
          const cont = document.getElementById("modalContainer");
          if (!modal || !cont) return;

          modal.classList.remove("hidden");
          cont.innerHTML = `
            <div class="w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden">
              <div class="bg-[#006400] p-4 text-white">
                <h3 class="font-black uppercase text-lg leading-tight">ðŸ” Resetar senha</h3>
              </div>
              <div class="p-4 space-y-3">
                <p class="text-sm font-bold text-gray-700">Defina uma nova senha para este usuÃ¡rio. Ele vai usar essa senha no prÃ³ximo login.</p>
                <div class="text-xs font-black text-gray-500 uppercase">UsuÃ¡rio alvo</div>
                <div class="text-sm font-black text-gray-900">@${escapeHtml(draft.username || "")} â€¢ ${escapeHtml(draft.name || "")}</div>
                <input id="financialResetPass" type="password" class="admin-creation-input" placeholder="Nova senha (mÃ­n. 6)">
                <div class="grid grid-cols-2 gap-2 pt-2">
                  <button type="button" onclick="window.openFinancialUserModal('${escapeJsString(draft.id)}')" class="bg-gray-200 text-gray-800 py-3 rounded-2xl font-black text-xs shadow-lg btn-press">Cancelar</button>
                  <button type="button" onclick="window.confirmResetUserPassword()" class="bg-[#006400] text-white py-3 rounded-2xl font-black text-xs shadow-lg btn-press">Resetar</button>
                </div>
              </div>
            </div>
          `;
          setTimeout(() => document.getElementById("financialResetPass")?.focus(), 0);
        };

        window.confirmResetUserPassword = async () => {
          const draft = adminFinancialState.editUserDraft;
          const input = document.getElementById("financialResetPass");
          const newPassword = String(input?.value || "").trim();
          if (!draft) return;
          if (newPassword.length < 6) {
            showFinancialToast("A nova senha deve ter no mÃ­nimo 6 caracteres.", "danger");
            return;
          }

          try {
            const token = await auth.currentUser.getIdToken(true);
            const response = await fetch("/api/admin-reset-user-password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                idToken: token,
                targetUid: draft.id,
                newPassword
              })
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result?.error || "NÃ£o foi possÃ­vel resetar a senha.");

            await logAdminFinancialAction("reset_user_password", {
              targetUserId: draft.id,
              username: draft.username || "",
              name: draft.name || ""
            });
            showFinancialToast("Senha resetada!");
            await window.openFinancialUserModal(draft.id);
          } catch (error) {
            console.error("Erro ao resetar senha:", error);
            showFinancialToast(error.message || "NÃ£o foi possÃ­vel resetar a senha.", "danger");
          }
        };

        window.saveFinancialUserEdit = async () => {
          const draft = adminFinancialState.editUserDraft;
          if (!draft) return;

          try {
            const admin = await getCurrentAdminProfile(true);
            const payload = {
              debts: Number(draft.debts || 0),
              payments: draft.payments || {},
              passwordHint: String(draft.passwordHint || "").trim(),
              updatedAt: Timestamp.fromDate(new Date()),
              updatedByUid: admin?.uid || "",
              updatedByName: admin?.name || "",
              updatedByEmail: admin?.email || ""
            };

            await setDoc(doc(db, "users", draft.id), payload, { merge: true });
            await loadAdminFinancialUsers();
            await logAdminFinancialAction("update_user_financial", {
              targetUserId: draft.id,
              username: draft.username || "",
              debts: payload.debts
            });
            invalidateHomeRankingCaches();
            await refreshRankingMovementAfterOfficialChange({
              source: "update_user_financial",
              updatedBy: admin?.uid || "",
              updatedByName: admin?.name || "",
              updatedByEmail: admin?.email || ""
            });
            showFinancialToast("UsuÃ¡rio atualizado!");
            await window.openFinancialScreen();
          } catch (error) {
            console.error("Erro ao salvar usuÃ¡rio:", error);
            showFinancialToast("NÃ£o foi possÃ­vel atualizar o usuÃ¡rio.", "danger");
          }
        };
                // --- CORREÃ‡ÃƒO DO PAINEL FINANCEIRO E PAGAMENTO ---

        window.openFinancialScreen = async () => {
            window.__setAdminReturnTarget(() => window.openAdminMenu());
            const admin = await getCurrentAdminProfile(true);
            if (!admin) {
              alert("VocÃª nÃ£o tem permissÃ£o para acessar o financeiro.");
              closeModal();
              return;
            }

            const modal = document.getElementById('modalOverlay');
            const cont = document.getElementById('modalContainer');
            if (!modal || !cont) return;

            modal.classList.remove('hidden');
            cont.innerHTML = `<div class="bg-white p-6 text-center"><i class="fas fa-circle-notch fa-spin text-2xl text-[#006400]"></i><p class="text-xs font-black text-gray-500 uppercase mt-2">Carregando financeiro...</p></div>`;

            try {
                adminFinancialState.loading = true;
                adminFinancialState.users = await loadAdminFinancialUsers();
                await loadAdminWhitelistUsers().catch(() => []);
                adminFinancialState.loading = false;
                cont.innerHTML = renderFinancialScreenShell(adminFinancialState.users);
            } catch(e) {
                console.error(e);
                cont.innerHTML = '<div class="p-4 text-center text-red-500">Erro ao carregar dados.</div>';
            }
        };

        window.togglePay = async (uid, month) => {
            // Cursor de carregamento
            document.body.style.cursor = 'wait';
            
            try {
                const ref = doc(db, "users", uid);
                const snap = await getDoc(ref);
                
                if (snap.exists()) {
                    const currentData = snap.data();
                    const payments = currentData.payments || {};

                    // Inverte o valor atual (se era true vira false, se nÃ£o existia vira true)
                    payments[month] = !payments[month];

                    // Salva no banco (Merge garante que nÃ£o apague outros campos)
                    await setDoc(ref, { payments: payments }, { merge: true });
                    
                    // Atualiza o pote e a tela
                    if(window.calculatePot) window.calculatePot();
                    await window.openFinancialScreen();
                }
            } catch (e) {
                console.error("Erro ao atualizar:", e);
                alert("Erro ao salvar: " + e.message);
            } finally {
                document.body.style.cursor = 'default';
            }
        };
        window.checkDelays = async () => {
          await window.openFinancialAuditModal();
        };

const renderProfileSectionHeader = (title, subtitle, chipLabel = "") => `
  <div class="profile-section__header">
    <div>
      <div class="profile-section__title">${escapeHtml(title)}</div>
      <div class="profile-section__subtitle">${escapeHtml(subtitle)}</div>
    </div>
    ${chipLabel ? `<span class="status-chip status-chip--default">${escapeHtml(chipLabel)}</span>` : ""}
  </div>
`;

const renderProfileActionTile = ({ tag = "button", onclick = "", extraAttrs = "", iconClass, iconToneClass, title, desc, chip = "" }) => `
  <${tag}
    ${onclick ? `onclick="${onclick}"` : ""}
    ${extraAttrs}
    class="profile-action-tile btn-press ${tag === "label" ? "cursor-pointer" : ""}"
  >
    <div class="profile-action-tile__icon ${iconToneClass}">
      <i class="${iconClass}"></i>
    </div>
    <div>
      <div class="profile-action-tile__title">${escapeHtml(title)}</div>
      <div class="profile-action-tile__desc">${escapeHtml(desc)}</div>
    </div>
    ${chip ? `<span class="status-chip status-chip--default">${escapeHtml(chip)}</span>` : ""}
  </${tag}>
`;

window.scrollToProfileSection = (sectionId) => {
  const target = document.getElementById(sectionId);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
};

const renderProfileActionRow = ({ onclick = "", iconClass, iconToneClass, title, desc, chip = "", dark = false }) => `
  <button
    onclick="${onclick}"
    class="profile-action-row btn-press ${dark ? "bg-gray-900 text-white border-gray-800" : ""}"
  >
    <div class="profile-action-row__icon ${iconToneClass}">
      <i class="${iconClass}"></i>
    </div>
    <div class="profile-action-row__body">
      <div class="profile-action-row__title ${dark ? "text-white" : ""}">${escapeHtml(title)}</div>
      <div class="profile-action-row__desc ${dark ? "text-white/70" : ""}">${escapeHtml(desc)}</div>
    </div>
    <div class="profile-action-row__end">
      ${chip ? `<span class="status-chip ${dark ? "status-chip--warning" : "status-chip--default"}">${escapeHtml(chip)}</span>` : ""}
      <i class="fas fa-chevron-right profile-action-row__arrow ${dark ? "text-white/60" : ""}"></i>
    </div>
  </button>
`;

window.openPixPaymentModal = () => {
  const pixArea = document.getElementById("pixArea");
  if (!pixArea) return;
  pixArea.classList.remove("hidden");
  pixArea.querySelector(".pix-modal-scroll")?.scrollTo({ top: 0, behavior: "auto" });
};

window.closePixPaymentModal = () => {
  document.getElementById("pixArea")?.classList.add("hidden");
};

const mountPixPaymentModal = (html) => {
  document.getElementById("pixArea")?.remove();
  document.body.insertAdjacentHTML("beforeend", html);
};

async function loadProfile() { 
        if (!currentUser) return; 
        
        try { 
            // 1. Busca dados
            const [userSnap, finSnap] = await Promise.all([
                getDoc(doc(db, "users", currentUser.uid)),
                getDoc(doc(db, "settings", "financial"))
            ]);

            if (!userSnap.exists()) return; 
            
            const u = getMergedCurrentUserData(userSnap.data() || {}); 
// AQUI: Usa a funÃ§Ã£o corrigida para decidir entre Foto Real ou Avatar
            const avatar = getAvatarUrl(u.photoBase64, u.name || u.username);
            // 2. Configura dados do PIX
            let pixKey = "5585998523009"; 
            let pixCode = "00020126360014BR.GOV.BCB.PIX0114+5585998523009520400005303986540515.005802BR5922Matheus Ferreira Alves6009SAO PAULO62140510Txvo4IewB56304C78B";
            let adminPhone = "5585998523009";
            let beneficiary = "MATHEUS FERREIRA ALVES";

            if (finSnap.exists()) {
                const fin = finSnap.data();
                if (fin.pixKey) pixKey = fin.pixKey;
                if (fin.pixCode) pixCode = fin.pixCode;
                if (fin.adminPhone) adminPhone = fin.adminPhone;
                if (fin.beneficiary) beneficiary = fin.beneficiary;
            }

            // --- LÃ“GICA FINANCEIRA ---
            const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
            const currMonth = months[new Date().getMonth()];
            const payments = u.payments || {};
            const isPaid = (new Date().getFullYear() < 2026) || (payments[currMonth] === true);
            
            const finCardClass = isPaid 
                ? "bg-green-50 border-green-200 text-green-800" 
                : "bg-red-50 border-red-200 text-red-800 animate-pulse";
            
            const finStatusText = isPaid ? "MENSALIDADE EM DIA" : "PAGAMENTO PENDENTE";
            const finIcon = isPaid ? "fa-check-circle" : "fa-exclamation-circle";

            // --- MODAL PIX ---
            const pixModalHTML = `
            <div id="pixArea" class="hidden fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" onclick="if(event.target === this) window.closePixPaymentModal()">
                <div class="pix-modal-scroll relative bg-white rounded-lg w-full max-w-sm max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-200">
                    <div class="absolute inset-0 z-0">
                        <img src="bg_pix.jpeg" loading="lazy" decoding="async" class="w-full h-full object-cover opacity-50">
                    </div>
                    
                    <div class="relative z-10 p-6 pt-8 text-center">
                        <button onclick="window.closePixPaymentModal()" class="absolute top-2 right-2 text-[#006400] p-2 hover:scale-110 transition-transform"><i class="fas fa-times text-xl"></i></button>
                        
                        <div class="mb-4">
                            <i class="fas fa-qrcode text-4xl text-[#006400] drop-shadow-sm"></i>
                            <p class="font-black text-[#006400] text-xl mt-2 uppercase">PAGAMENTO PIX</p>
                            <div class="h-1 w-16 bg-[#FFD700] mx-auto rounded-full mt-2"></div>
                        </div>

                        <div class="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-gray-100 shadow-sm mb-4">
                            <p class="text-xs font-bold text-gray-800 uppercase mb-1">Valor da Mensalidade</p>
                            <p class="text-4xl font-black text-black tracking-tight">R$ 15,00</p>
                            <p class="text-[10px] text-gray-600 mt-2 font-bold">BeneficiÃ¡rio: <span class="text-[#006400] uppercase">${beneficiary}</span></p>
                        </div>

                        <div class="space-y-2">
                            <button onclick="navigator.clipboard.writeText('${pixCode}'); alert('CÃ³digo PIX Copia e Cola copiado!')" class="w-full bg-[#32BCAD] hover:bg-[#2aa89a] text-white py-3 rounded-lg font-bold text-xs shadow-md btn-press flex items-center justify-center gap-2 transition-colors">
                                <i class="fas fa-copy text-lg"></i> PIX COPIA E COLA
                            </button>
                            
                            <div class="bg-white/90 border rounded px-3 py-2 flex justify-between items-center">
                                <span class="text-[9px] font-bold text-gray-400 mr-2">CHAVE:</span>
                                <input type="text" value="${pixKey}" readonly class="bg-transparent text-xs font-bold text-gray-600 w-full outline-none text-right">
                                <button onclick="navigator.clipboard.writeText('${pixKey}'); alert('Chave PIX copiada!')" class="ml-2 text-[#006400]"><i class="fas fa-copy"></i></button>
                            </div>
                        </div>

                        <div class="border-t border-gray-300/50 pt-4 mt-4">
                            <p class="text-[10px] font-bold text-gray-700 mb-2">JÃ¡ fez o pagamento?</p>
                            <button onclick="window.open('https://wa.me/${adminPhone}?text=Ei%20Branco!%20J%C3%A1%20fiz%20o%20pagamento%20da%20minha%20mensalidade%20do%20Bol%C3%A3o%20112%20F.C.', '_blank')" class="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white py-3 rounded-lg font-bold text-xs shadow-md btn-press flex items-center justify-center gap-2 transition-colors">
                                <i class="fab fa-whatsapp text-lg"></i> AVISAR AO BRANCO
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;

            const soundEnabled = isSoundEnabled();
            const pushControlState = await getProfileWebPushState(u);
            const accountActionsHtml = `
              <section class="profile-section profile-section--compact mb-3">
                ${renderProfileSectionHeader("Conta", "AÃ§Ãµes principais do seu acesso", "Essencial")}
                <div class="profile-actions-grid">
                  ${renderProfileActionTile({
                    tag: "label",
                    extraAttrs: `for="uploadPhoto"`,
                    iconClass: "fas fa-camera",
                    iconToneClass: "bg-green-50 text-green-600",
                    title: "Mudar foto",
                    desc: "Atualize sua imagem de perfil."
                  })}
                  ${renderProfileActionTile({
                    onclick: "changePassword()",
                    iconClass: "fas fa-lock",
                    iconToneClass: "bg-orange-50 text-orange-600",
                    title: "Trocar senha",
                    desc: "Mantenha sua conta protegida."
                  })}
                  ${renderProfileActionTile({
                    onclick: "window.toggleProfileWebPushPreference()",
                    iconClass: "fas fa-bell",
                    iconToneClass: pushControlState.active ? "bg-purple-50 text-purple-600" : pushControlState.chip === "REVALIDAR" ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-gray-500",
                    title: "NotificaÃ§Ãµes",
                    desc: pushControlState.desc,
                    chip: pushControlState.chip
                  })}
                  ${renderProfileActionTile({
                    onclick: "window.toggleSoundPreference()",
                    iconClass: soundEnabled ? "fas fa-volume-high" : "fas fa-volume-xmark",
                    iconToneClass: soundEnabled ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500",
                    title: "Som do app",
                    desc: "Toque nos efeitos do BolÃ£o.",
                    chip: soundEnabled ? "Ligado" : "Desligado"
                  })}
                </div>
              </section>
            `;

            const shortcutsSectionHtml = `
              <section class="profile-section profile-section--compact mb-3">
                ${renderProfileSectionHeader("Atalhos", "Tudo o que vocÃª usa com mais frequÃªncia", "RÃ¡pido")}
                <div class="profile-shortcuts-grid">
                  ${renderProfileActionTile({
                    onclick: "openRulesModal()",
                    iconClass: "fas fa-scroll",
                    iconToneClass: "bg-emerald-50 text-emerald-700",
                    title: "Regras do bolÃ£o",
                    desc: "Consulte o regulamento sempre que precisar."
                  })}
                  ${renderProfileActionTile({
                    onclick: "window.openCalendar2026()",
                    iconClass: "fas fa-calendar-alt",
                    iconToneClass: "bg-blue-50 text-blue-700",
                    title: "CalendÃ¡rio 2026",
                    desc: "Veja as datas importantes da temporada."
                  })}
                  ${renderProfileActionTile({
                    onclick: "showAppGuide()",
                    iconClass: "fas fa-circle-info",
                    iconToneClass: "bg-purple-50 text-purple-600",
                    title: "Guia do app",
                    desc: "Relembre funÃ§Ãµes e atalhos do sistema."
                  })}
                  ${u.isAdmin ? renderProfileActionTile({
                    onclick: "openAdminMenu()",
                    iconClass: "fas fa-cogs",
                    iconToneClass: "bg-gray-900 text-[#FFD700]",
                    title: "Painel do Admin",
                    desc: "Ferramentas administrativas do bolÃ£o.",
                    chip: "Restrito"
                  }) : ""}
                </div>
              </section>
            `;
            // HTML DA TELA DE PERFIL (GRADE LIMPA)
            const profileHTML = `
            <div id="profileScreen" class="animate-fade-in p-4">
                <div class="profile-greeting card-cut relative overflow-hidden bg-white shadow-sm mb-3 border border-gray-100">
                    <div class="p-4 flex items-center justify-between gap-3">
                        <div>
                            <p class="profile-greeting__eyebrow">${escapeHtml(u.name ? `OlÃ¡, ${u.name.split(" ")[0]}` : "OlÃ¡!")}</p>
                            <h2 class="profile-greeting__title">Sua conta estÃ¡ ativa</h2>
                        </div>
                        <div class="profile-greeting__icon">
                            <i class="fas fa-user-check"></i>
                        </div>
                    </div>
                </div>
                <div class="card-cut relative overflow-hidden bg-white shadow-lg mb-4 border-l-4 border-[#006400]">
                    <div class="absolute right-0 top-0 p-2 opacity-10">
                        <i class="fas fa-id-card text-6xl text-[#006400]"></i>
                    </div>
                    <div class="p-6 flex items-center gap-4 relative z-10">
                        <div class="w-20 h-20 rounded-full border-4 border-[#FFD700] shadow-md overflow-hidden bg-gray-200">
                            <img src="${avatar}" class="w-full h-full object-cover">
                        </div>
                        <div>
                            <h2 class="text-xl font-black text-[#006400] uppercase leading-tight">${u.name || "Membro"}</h2>
                            <p class="text-sm text-gray-500 font-bold">@${u.username}</p>
                            <div class="mt-2 flex flex-wrap items-center gap-2">
                              <div class="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-[10px] font-bold text-gray-600">
                                <i class="fas fa-crown text-[#FFD700]"></i> SÃ“CIO TORCEDOR
                              </div>
                              <span class="status-chip ${isPaid ? "status-chip--success" : "status-chip--danger"}">${isPaid ? "Mensalidade ok" : "Pagamento pendente"}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <input type="file" id="uploadPhoto" accept="image/*" class="hidden" onchange="handlePhotoUpload(this)">

                ${accountActionsHtml}
                ${shortcutsSectionHtml}

                <div id="financialSection" class="profile-section profile-section--compact mb-4">
                    ${renderProfileSectionHeader("Financeiro", "Sua situaÃ§Ã£o da mensalidade em um toque", isPaid ? "Em dia" : "AtenÃ§Ã£o")}
                    <div class="p-3">
                     <div id="financialCard" class="p-4 rounded-lg border shadow-sm cursor-pointer btn-press flex justify-between items-center transition-colors ${finCardClass}" onclick="window.openPixPaymentModal()">
                        <div class="text-left">
                            <p class="font-black text-sm ${isPaid ? 'text-green-800' : 'text-red-800'}">${finStatusText}</p>
                            <p class="text-[10px] font-bold opacity-70">Toque para detalhes</p>
                        </div>
                        <i class="fas ${finIcon} text-2xl"></i>
                    </div>
                    </div>
                </div>

                <div class="text-center pb-safe">
                    <div class="version-chip">${getAppVersionLabel()}</div>
                    <p class="text-[9px] text-gray-400 mt-2 font-bold uppercase">BolÃ£o 112 F.C â€¢ 2026</p>
                </div>
            </div>`;

            document.getElementById('profileScreen').innerHTML = profileHTML;
            document.getElementById('profileScreen').classList.remove('hidden');
            mountPixPaymentModal(pixModalHTML);

            const accountSectionEl = document.querySelector("#profileScreen .profile-section");
            const financialSectionEl = document.getElementById("financialSection");
            if (accountSectionEl && financialSectionEl) {
              accountSectionEl.insertAdjacentElement("afterend", financialSectionEl);
            }

        } catch (error) { console.error("Erro no loadProfile:", error); } 
    }

    // Handler Auxiliar para Upload de Foto na nova tela
    window.handlePhotoUpload = (input) => {
         const file = input.files[0]; 
         if(file) { 
             compressImage(file).then(async (base64) => { 
                 await updateDoc(doc(db, "users", currentUser.uid), { photoBase64: base64 }); 
                 loadProfile(); 
                 alert("Foto atualizada!");
             }).catch(err => { alert("Erro na imagem."); }); 
         } 
    };
        // FunÃ§Ã£o Global para Editar Dica (ADICIONE ISSO LOGO APÃ“S A loadProfile)
        window.editHint = (currentVal) => {
            const val = currentVal === "Sem dica cadastrada" ? "" : currentVal;
            const newHint = prompt("Digite uma dica para lembrar sua senha:", val);
            if (newHint !== null) {
                updateDoc(doc(db, "users", currentUser.uid), { passwordHint: newHint })
                    .then(() => { alert("Dica salva!"); loadProfile(); })
                    .catch(e => alert("Erro ao salvar dica."));
            }
        };

      
        document.getElementById('uploadPhoto').onchange = (e) => { const file = e.target.files[0]; if(file) { compressImage(file).then(async (base64) => { await updateDoc(doc(db, "users", currentUser.uid), { photoBase64: base64 }); loadProfile(); }).catch(err => { alert("Erro ao processar imagem."); console.error(err); }); } };

        window.changeDebt = async (uid, delta) => { const ref = doc(db, "users", uid); const u = await getDoc(ref); let debts = u.data().debts || 0; debts += delta; if(debts < 0) debts = 0; await updateDoc(ref, { debts: debts }); await window.openFinancialScreen(); };
        document.getElementById('financialCard').onclick = () => window.openPixPaymentModal();
        window.copyKeyOnly = () => { document.getElementById('pixKey').select(); document.execCommand('copy'); alert("Chave Pix Copiada!"); };
        document.getElementById('btnCopyPix').onclick = () => { alert("Copie a chave manual abaixo por enquanto."); };
        window.changePassword = () => { document.getElementById('modalOverlay').classList.remove('hidden'); document.getElementById('modalContainer').innerHTML = `<div class="w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden relative"><img src="bg_login2.png" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover opacity-15"><div class="relative z-10 p-6"><h3 class="font-black text-[#006400] text-center mb-6 text-lg uppercase">Nova Senha</h3><input type="password" id="newPassInput" placeholder="MÃ­nimo 6 caracteres" class="w-full p-3 bg-gray-50 border rounded-lg mb-6 text-sm outline-none focus:border-[#006400]"><button id="btnConfirmPass" class="w-full bg-[#006400] text-white py-3 font-bold rounded-lg shadow-lg btn-press">CONFIRMAR</button><button onclick="closeModal()" class="w-full text-black font-black text-xs mt-4">CANCELAR</button></div></div>`; document.getElementById('btnConfirmPass').onclick = () => { const newPass = document.getElementById('newPassInput').value; if(newPass && newPass.length >= 6) { updatePassword(currentUser, newPass).then(() => { alert("Senha alterada com sucesso!"); closeModal(); }).catch(e => alert("Erro: FaÃ§a logout e login novamente para trocar a senha.")); } else { alert("A senha deve ter no mÃ­nimo 6 caracteres."); } }; };

window.openCalendar2026 = () => {
  const html = `
    <div class="w-full h-[90vh] max-w-md rounded-none overflow-hidden relative">
      <div class="absolute inset-0 bg-black"></div>

      <div class="relative z-10 flex items-center justify-between p-3">
        <div class="text-white font-black text-sm uppercase tracking-wider">
          CalendÃ¡rio 2026
        </div>

        <button onclick="closeModal()" class="text-white/80 hover:text-white p-2">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>

      <div class="relative z-10 w-full h-full flex items-center justify-center px-2 pb-6">
        <img
          src="calendario_2026.png"
          loading="lazy"
          decoding="async"
          class="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          alt="CalendÃ¡rio 2026"
        />
      </div>
    </div>
  `;

  window.openModal(html);
};

        // --- GUIA DO APP (SUBSTITUI CHANGELOG) ---
// --- GUIA DO APP ATUALIZADO COM LISTA COMPLETA DE MEDALHAS ---
        // --- GUIA DO APP ATUALIZADO (v1.7.5) ---
        window.showAppGuide = () => { 
            document.getElementById('modalOverlay').classList.remove('hidden'); 
            document.getElementById('modalContainer').innerHTML = `
            <div class="w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden relative">
                <img src="bg_regras.png" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover opacity-15">
                <div class="relative z-10 bg-white/80 p-6 max-h-[85vh] overflow-y-auto">
                    <h3 class="font-bold text-lg mb-4 text-center uppercase tracking-widest text-gray-800">GUIA DO APP</h3>
                    <p class="text-center text-[10px] text-gray-500 font-bold mb-4">${getAppVersionFullLabel()}</p>
                    
                    <div class="mb-6 p-4 bg-green-50 rounded-lg border border-green-100 shadow-sm">
                        <h4 class="font-black text-[#006400] text-xs mb-3 uppercase tracking-wide">âš½ JOGOS & PALPITES</h4>
                        <div class="text-xs text-gray-700 space-y-2 font-medium">
                            <p>ðŸ‘‰ <b>Como votar:</b> Toque no escudo do time. O voto fica verde quando salvo.</p>
                            <p class="text-green-800 font-bold">ðŸ‘‰ TermÃ´metro: <span class="font-normal text-gray-700">ApÃ³s o jogo, veja a % da galera.</span></p>
                            <p class="text-green-800 font-bold">ðŸ‘‰ Resenha: <span class="font-normal text-gray-700">Toque no Ã­cone ðŸ’¬ para zoar. O balÃ£o fica vermelho se tiver msg nÃ£o lida!</span></p>
                        </div>
                    </div>

                    <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100 shadow-sm">
                        <h4 class="font-black text-blue-800 text-xs mb-3 uppercase tracking-wide">ðŸ”” CENTRAL DE NOTIFICAÃ‡Ã•ES (NOVO)</h4>
                        <div class="text-xs text-gray-700 space-y-2 font-medium">
                            <p>ðŸ”´ <b>Badge na Aba Confrontos:</b> O nÃºmero vermelho no Ã­cone da bola indica quantos jogos abertos vocÃª <b>ESQUECEU</b> de votar.</p>
                            <p>ðŸ”” <b>Sininho (Topo):</b> Avisa se existe alguma mensagem nova (Resenha) em qualquer jogo do bolÃ£o.</p>
                            <p>ðŸ”† <b>Pulse (CabeÃ§alhos):</b> Uma bolinha vermelha piscando ao lado de "ABERTOS" ou "FINALIZADOS" mostra onde estÃ¡ a novidade.</p>
                        </div>
                    </div>

                    <div class="mb-6">
                       <h4 class="font-black text-black text-xs mb-3 uppercase tracking-wide">ðŸ… GALERIA DE CONQUISTAS</h4>
                            <div class="text-xs text-gray-700 space-y-3 font-medium bg-white p-3 rounded border border-gray-200">
                                <div class="flex items-start gap-2"><span class="text-lg">ðŸ‘½</span> <div><b>Alien:</b> SequÃªncia de 10 acertos seguidos.</div></div>
                                <div class="flex items-start gap-2"><span class="text-lg">ðŸ’Ž</span> <div><b>Diamante:</b> Gabaritou as Oitavas de Final (8/8).</div></div>
                                <div class="flex items-start gap-2"><span class="text-lg">ðŸ‘‘</span> <div><b>Rei do MÃªs:</b> LÃ­der da pontuaÃ§Ã£o no mÃªs vigente.</div></div>
                                <div class="flex items-start gap-2"><span class="text-lg">ðŸŽ¯</span> <div><b>Mito:</b> SequÃªncia de 5 acertos seguidos.</div></div>
                                <div class="flex items-start gap-2"><span class="text-lg">ðŸ¦“</span> <div><b>CaÃ§ador de Zebras:</b> Acertou um jogo onde +80% da galera nÃ£o acertou (errou ou nÃ£o votou).</div></div>
                                <div class="flex items-start gap-2"><span class="text-lg">ðŸ”¥</span> <div><b>On Fire:</b> SequÃªncia de 3 acertos seguidos.</div></div>
                                <div class="flex items-start gap-2"><span class="text-lg">ðŸ”®</span> <div><b>MÃ£e Dinah:</b> Acertou na mosca o campeÃ£o do torneio.</div></div>
                                <div class="flex items-start gap-2"><span class="text-lg">ðŸŽ“</span> <div><b>Veterano:</b> Ganha 1 estrela a cada 50 ACERTOS.</div></div>
                                
                                <div class="border-t my-2"></div>
                                <div class="flex items-start gap-2"><span class="text-lg">ðŸ’°</span> <div><b>PatrÃ£o:</b> Mensalidade rigorosamente em dia.</div></div>
                                <div class="flex items-start gap-2"><span class="text-lg">ðŸ‘»</span> <div><b>Fantasma:</b> Deixou de votar em 3 jogos seguidos.</div></div>
                                <div class="flex items-start gap-2"><span class="text-lg">ðŸ¥¬</span> <div><b>MÃ£o de Alface:</b> Errou 3 palpites seguidos.</div></div>
                                <div class="flex items-start gap-2"><span class="text-lg text-[#8B0000]">âš“</span> <div class="text-[#8B0000]"><b>Zona de Rebaixamento:</b> Os 4 Ãºltimos colocados.</div></div>
                            </div>
                    </div>

                    <button onclick="closeModal()" class="w-full bg-[#006400] text-white py-3 rounded-lg font-bold mt-6 shadow-lg btn-press text-sm">ENTENDI</button>
                </div>
            </div>`; 
        };
// --- CÃLCULO DO POTE COM PREVISÃƒO ANUAL ---
        window.calculatePot = async () => {
  try {
    const [usersSnap, configSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDoc(doc(db, "settings", "config"))
    ]);

    let totalCotasPagas = 0; // Quantidade de meses pagos (real)
    const totalUsuarios = usersSnap.size;

    usersSnap.forEach(d => {
      const p = d.data().payments;
      if (p) totalCotasPagas += Object.values(p).filter(Boolean).length;
    });

    const configData = configSnap.exists() ? configSnap.data() : {};
    const rawConfiguredParticipants =
      configData?.pot_active_participants ??
      configData?.potactiveparticipants;

    const totalParticipantesAtivos = Number.isFinite(Number(rawConfiguredParticipants))
      ? Number(rawConfiguredParticipants)
      : totalUsuarios;

    // 1. Valores Reais (O que jÃ¡ tem no caixa)
    const currentPrize = totalCotasPagas * 10;
    const currentParty = totalCotasPagas * 5;
    const currentTotal = currentPrize + currentParty;

    // 2. Valores de PrevisÃ£o (Participantes adimplentes definidos pelo admin)
    const forecastPrize = totalParticipantesAtivos * 12 * 10;
    const forecastParty = totalParticipantesAtivos * 12 * 5;

    // Formatador de Moeda
    const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Atualiza HTML - Valores Reais
    const elPot = document.getElementById('potValue');
    const elParty = document.getElementById('partyValue');
    const elTotal = document.getElementById('totalValue');
    if (elPot) elPot.innerText = fmt(currentPrize);
    if (elParty) elParty.innerText = fmt(currentParty);
    if (elTotal) elTotal.innerText = `Total Arrecadado (Real): ${fmt(currentTotal)}`;

    // Atualiza HTML - PrevisÃµes
    const elPotRef = document.getElementById('potRef');
    const elPartyRef = document.getElementById('partyRef');
    if (elPotRef) elPotRef.innerText = `PrevisÃ£o Final: ${fmt(forecastPrize)}`;
    if (elPartyRef) elPartyRef.innerText = `PrevisÃ£o Final: ${fmt(forecastParty)}`;

    // ATUALIZAÃ‡ÃƒO DO CONTADOR NO HTML
    const elCount = document.getElementById('potCount');
    if (elCount) {
      elCount.innerText = ` ${totalParticipantesAtivos} PARTICIPANTES ADIMPLENTES`;
    }
  } catch (e) {
    console.error("Erro Pote:", e);
  }
};
// --- CORREÃ‡ÃƒO: CARD INSTAGRAM TURBINADO (Tabela Inteligente + Marketing) ---
        window.generateWebCard = async () => {
            const modalEl = document.getElementById('profileModal');
            if(!modalEl) return;
            const uid = modalEl.getAttribute('data-uid');
            
            // 1. Verifica se os dados existem
            if (!currentRankingData || currentRankingData.length === 0) {
                 alert("Por favor, abra a aba 'Ranking' primeiro para carregar os dados atualizados."); 
                 return;
            }

            // 2. ORDENAÃ‡ÃƒO ROBUSTA
            currentRankingData.sort((a,b) => {
                if (b.p !== a.p) return b.p - a.p;
                if ((a.debts||0) !== (b.debts||0)) return (a.debts||0) - (b.debts||0);

                const hierarchy = ["ðŸ‘½", "ðŸ’Ž", "ðŸ‘‘", "ðŸŽ¯", "ðŸ¦“", "ðŸ”¥", "ðŸ”®", "ðŸŽ“"];
                for (let icon of hierarchy) {
                    const countA = (a.medals || []).filter((medalIcon) => medalIcon === icon).length;
const countB = (b.medals || []).filter((medalIcon) => medalIcon === icon).length;
                    if (countB !== countA) return countB - countA;
                }
                return a.name.localeCompare(b.name);
            });

            // 3. Localiza o usuÃ¡rio e define posiÃ§Ã£o real
            const index = currentRankingData.findIndex(u => u.uid === uid);
            if (index === -1) return;
            const user = currentRankingData[index];
            user.lastRank = index + 1;
// =========================
// âœ… MEDALHAS NO CARD DO INSTAGRAM (compacto + contador)
// =========================
const priorityOrder = ["ðŸ†", "ðŸ‘½", "ðŸ’Ž", "ðŸ‘‘", "ðŸŽ¯", "ðŸ¦“", "ðŸ”¥", "ðŸ”®", "ðŸŽ“", "ðŸ’°", "ðŸ‘»", "ðŸ¥¬"];

const medalCounts = {};
(user.medals || []).forEach((icon) => {
  medalCounts[icon] = (medalCounts[icon] || 0) + 1;
});

const iconsOrdered = Object.keys(medalCounts).sort((a,b) => {
  let ia = priorityOrder.indexOf(a); if (ia === -1) ia = 999;
  let ib = priorityOrder.indexOf(b); if (ib === -1) ib = 999;
  return ia - ib;
});

// Limita para nÃ£o â€œentupirâ€ o card (ajuste se quiser)
const maxIcons = 8;
const iconsToShow = iconsOrdered.slice(0, maxIcons);

const medalsStripHtml = (iconsToShow.length === 0) ? "" : `
  <div style="
    display:flex;
    justify-content:center;
    align-items:center;
    gap:10px;
    flex-wrap:wrap;
    margin-top:10px;
    margin-bottom:6px;
  ">
    ${iconsToShow.map(icon => `
      <div style="position:relative; display:inline-flex; align-items:center; justify-content:center;">
        <span style="font-size:32px; line-height:1;">${icon}</span>
        ${medalCounts[icon] > 1 ? `
          <span class="medal-count-badge ${medalCounts[icon] >= 10 ? "super-medal" : ""}">
            ${medalCounts[icon] >= 10 ? medalCounts[icon] : `x${medalCounts[icon]}`}
          </span>

        ` : ``}
      </div>
    `).join("")}
  </div>
`;

            // --- LÃ“GICA DA TABELA INTELIGENTE ---
            const totalParticipants = currentRankingData.length;
            const maxRows = 8;
            let displayList = [];

            if (totalParticipants <= maxRows) {
                displayList = currentRankingData;
            } else if (index < maxRows) {
                displayList = currentRankingData.slice(0, maxRows);
            } else {
                const top3 = currentRankingData.slice(0, 3);
                const separator = { uid: "sep", name: "...", p: 0 };
                const start = Math.max(3, index - 1);
                const end = Math.min(totalParticipants, index + 2);
                const neighborhood = currentRankingData.slice(start, end);
                displayList = [...top3, separator, ...neighborhood];
            }
            
            const remainingCount = totalParticipants - displayList.filter(u => u.uid !== "sep").length;

            // 4. ConfiguraÃ§Ã£o visual do botÃ£o
            const btn = document.getElementById('btnInstaAction');
            const originalText = btn.innerHTML;
            btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> GERANDO...`;
            btn.disabled = true;

            // 5. CriaÃ§Ã£o do elemento invisÃ­vel
            const cardContainer = document.createElement('div');
            cardContainer.id = "instaCardCapture";
            cardContainer.style.position = "fixed"; cardContainer.style.top = "0"; cardContainer.style.left = "0"; 
            cardContainer.style.zIndex = "-9999"; cardContainer.style.width = "320px"; cardContainer.style.height = "720px"; // Altura maior
            document.body.appendChild(cardContainer);

            const avatarUrl = getAvatarUrl(user.photoBase64, user.name);
            
            // GERAÃ‡ÃƒO DO HTML DA TABELA (AJUSTADO PARA NÃƒO CORTAR NOMES)
            let tableHtml = "";
            displayList.forEach((uItem, idx) => {
                if (uItem.uid === "sep") {
                    tableHtml += `<div style="text-align: center; color: gray; font-weight: bold; padding: 2px;">...</div>`;
                } else {
                    const realRank = currentRankingData.findIndex(x => x.uid === uItem.uid) + 1;
                    const isMe = uItem.uid === user.uid;
                    
                    // Cores e Estilos
                    const bg = isMe ? "rgba(255, 215, 0, 0.4)" : "transparent";
                    const colorPos = realRank <= 3 ? "#E65100" : "black";
                    const weight = isMe ? "900" : "normal"; // 900 = Black, normal = Regular
                    const colorPts = isMe ? "#006400" : "black";
                    
                    // CORREÃ‡ÃƒO AQUI: 
                    // 1. Padding vertical aumentado para '6px' na linha (div pai).
                    // 2. Adicionado 'line-height: 1.5' e 'padding-top: 2px' no nome para evitar corte e centralizar.
                    tableHtml += `
                    <div style="display: flex; align-items: center; background: ${bg}; padding: 6px 4px; border-radius: 4px; margin-bottom: 2px;">
                        <div style="width: 28px; font-size: 11px; font-weight: bold; color: ${colorPos};">${realRank}Âº</div>
                        
                        <div style="flex: 1; font-size: 11px; font-weight: ${weight}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.5; padding-top: 2px; padding-bottom: 2px; padding-left: 2px;">
                            ${uItem.name}
                        </div>
                        
                        <div style="width: 35px; text-align: right; font-size: 12px; font-weight: 900; color: ${colorPts};">${uItem.p}</div>
                    </div>`;
                }
            });

            if (remainingCount > 0) {
                tableHtml += `<div style="text-align: center; font-size: 9px; color: #006400; font-weight: bold; margin-top: 4px;">ðŸ‘‡ ... e mais ${remainingCount} guerreiros na disputa!</div>`;
            }

            // HTML DO CARD FINAL
            cardContainer.innerHTML = `
                <div style="width: 320px; height: 720px; display: flex; flex-direction: column; padding: 16px; background: linear-gradient(180deg, #004D40 0%, #000000 100%); font-family: serif; text-align: center; position: relative; overflow: hidden;">
                    <img src="bg_ranking.png" loading="lazy" decoding="async" style="position: absolute; top:0; left:0; width:100%; height:100%; object-fit: cover; opacity: 0.15; mix-blend-mode: overlay;">
                    
                    <div style="position: relative; z-index: 10; flex: 1; display: flex; flex-direction: column;">
                        <h1 style="color: #FFD700; font-weight: 900; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; margin: 0;">BOLÃƒO 112 F.C</h1>
                        
                        <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                            <div style="width: 65px; height: 65px; border-radius: 50%; border: 3px solid #FFD700; overflow: hidden; background: black; box-shadow: 0 4px 8px rgba(0,0,0,0.5);">
                                <img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                            </div>
                            <div style="margin-left: 12px; text-align: left;">
                                <div style="color: white; font-weight: 900; font-size: 20px; line-height: 1.2;">${user.name.toUpperCase()}</div>
                                <div style="color: #FFD700; font-weight: 900; font-size: 14px;">${user.p} PONTOS</div>
                            </div>
                        </div>
${medalsStripHtml}

                        <div style="background: rgba(255,255,255,0.95); border-radius: 12px; padding: 12px; flex: 1;">
                            <div style="display: flex; justify-content: space-between; border-bottom: 2px solid black; padding-bottom: 6px; margin-bottom: 6px;">
                                <span style="font-size: 10px; font-weight: 900;">RANKING GERAL (${totalParticipants})</span>
                                <span style="font-size: 10px; font-weight: 900;">PTS</span>
                            </div>
                            ${tableHtml}
                        </div>

                        <div style="margin-top: 16px; background: #FFD700; border-radius: 12px; padding: 10px;">
                            <div style="color: black; font-weight: 900; font-size: 12px;">VEM PRO JOGO TAMBÃ‰M!</div>
                            <div style="display: flex; align-items: center; justify-content: center; margin-top: 2px;">
                                <i class="fas fa-globe" style="font-size: 12px; margin-right: 4px;"></i>
                                <span style="color: black; font-weight: 900; font-size: 14px;">bolao112-site.vercel.app</span>
                            </div>
                            <div style="color: rgba(0,0,0,0.7); font-weight: bold; font-size: 8px; margin-top: 2px;">ðŸ‘† COLE O LINK AQUI ðŸ‘†</div>
                        </div>
                    </div>
                </div>`;

            try {
                await new Promise(r => setTimeout(r, 800)); 
await ensureHtml2Canvas();
const canvas = await window.html2canvas(cardContainer, { scale: 2, useCORS: true, backgroundColor: null, logging: false });
const link = document.createElement('a');
                link.download = `card_${user.name.replace(/\s+/g, '_')}.jpg`;
                link.href = canvas.toDataURL("image/jpeg", 0.9);
                link.click();
            } catch (err) {
                console.error(err);
                alert("Erro ao gerar card. Tente novamente.");
            } finally {
                document.body.removeChild(cardContainer);
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        };
        
        // Isso deve ficar LOGO APÃ“S a funÃ§Ã£o calculatePot
        document.getElementById('btnPot').onclick = () => {
            calculatePot(); // Chama o cÃ¡lculo
            document.getElementById('potModal').classList.remove('hidden'); // Abre o modal novo
        };
       
document.getElementById('btnRefresh').onclick = () => {
  window.refreshAppData({ hardReload: true, source: "header-button" });
};

document.getElementById('btnLogout').onclick = () => {
    document.getElementById('mainHeader').classList.add('hidden'); // Esconde menu
    signOut(auth);
};
/* ================================
   [BLOCO A] GLOBAL: guarda o listener atual do chat
     ================================ */
window.currentChatUnsub = null;
window.__currentChatMessagesById = {};
       // --- CHAT COM MÃšLTIPLAS REAÃ‡Ã•ES ---
        window.openMatchComments = async (mid, ta, tb, winner) => {
            if (!appConfig.chat) {
                alert("â›” O Chat estÃ¡ desativado no momento.");
                return;
            }
                if (window.currentChatUnsub) {
  window.currentChatUnsub();
  window.currentChatUnsub = null;
}
            window.__currentChatMessagesById = {};
            const currentCount = globalServerCounts[mid] || 0;
            localStorage.setItem(`read_count_${mid}`, currentCount);
            const matchBtns = document.querySelectorAll(`button[onclick*="${mid}"]`);
            matchBtns.forEach(btn => { const badge = btn.querySelector('.absolute'); if(badge) badge.remove(); });
            window.updateBadges();

            const modal = document.getElementById('modalOverlay'); 
            const cont = document.getElementById('modalContainer'); 
            modal.classList.remove('hidden'); 
            cont.innerHTML = `<div class="bg-white p-4 text-center"><i class="fas fa-spinner fa-spin text-[#006400]"></i></div>`;
            
            const isFinished = winner && winner !== "";

            // FunÃ§Ã£o para salvar reaÃ§Ã£o no Firestore (Map: userId -> emoji)
            window.selectReaction = async (msgId, emoji) => {
                const normalizedEmoji = normalizeChatReaction(emoji);
                if (!normalizedEmoji) return;
                const ref = doc(db, "match_comments", msgId);
                const key = `reactions.${currentUser.uid}`;
                // Se clicar no mesmo, remove (toggle). Se for diferente, atualiza.
                // Como ler o estado atual Ã© complexo no onclick, vamos apenas setar por enquanto.
                // Para toggle perfeito, precisariamos ler o doc antes, mas para performance vamos apenas escrever.
                const currentMessage = window.__currentChatMessagesById?.[msgId] || {};
                const currentReaction = normalizeChatReaction(currentMessage.reactions?.[currentUser.uid] || "");
                const payload = currentReaction === normalizedEmoji
                  ? { [key]: deleteField() }
                  : { [key]: normalizedEmoji };
                await updateDoc(ref, payload);
                
                // Fecha o menu de reaÃ§Ã£o dessa mensagem
                const menu = document.getElementById(`react-menu-${msgId}`);
                if(menu) menu.classList.add('hidden');
            };

            window.toggleReactMenu = (msgId) => {
                // Fecha outros menus abertos
                document.querySelectorAll('[id^="react-menu-"]').forEach(el => {
                    if(el.id !== `react-menu-${msgId}`) el.classList.add('hidden');
                });
                const menu = document.getElementById(`react-menu-${msgId}`);
                if(menu) menu.classList.toggle('hidden');
            };

            const renderChat = (msgs) => {
                let html = `
                <div class="w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden relative h-[80vh] flex flex-col">
                    <div class="bg-gray-100 p-3 border-b flex justify-between items-center shrink-0">
                        <div>
                            <h3 class="font-black text-[#006400] text-xs uppercase">RESENHA</h3>
                            <p class="text-[10px] text-gray-600 font-bold">${ta} x ${tb}</p>
                        </div>
                        <button onclick="window.closeModal()"><i class="fas fa-times text-gray-400"></i></button>
                    </div>
                    
                    <div id="chatBody" class="flex-1 overflow-y-auto p-3 bg-[#E5DDD5] space-y-3" onclick="if(!event.target.closest('button')) document.querySelectorAll('[id^=react-menu-]').forEach(e=>e.classList.add('hidden'))">
                        ${msgs.length ? msgs.map(m => {
                            const isMe = m.userId === currentUser.uid;
                            const time = m.timestamp ? new Date(m.timestamp.seconds*1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
                            
                            // Processa ReaÃ§Ãµes (Map: uid -> emoji)
                            const reactions = m.reactions || {};
                            const counts = {};
                            Object.values(reactions).forEach(r => { counts[r] = (counts[r]||0)+1; });
                            
                            let reactionsHtml = "";
                            const sortedReactions = Object.entries(counts).sort((a,b) => b[1] - a[1]);
                            if(sortedReactions.length > 0) {
                                reactionsHtml = `<div class="flex gap-1 bg-white/80 rounded-full px-1.5 py-0.5 shadow-sm border border-gray-200 mt-[-8px] z-10 text-[9px]">`;
                                sortedReactions.forEach(([emoji, count]) => {
                                    reactionsHtml += `<span>${emoji} ${count > 1 ? count : ''}</span>`;
                                });
                                reactionsHtml += `</div>`;
                            }

                            // Emojis disponÃ­veis
                            const emojis = ["ðŸ‘", "ðŸ˜‚", "ðŸ”¥", "ðŸ˜¡", "ðŸ˜­"];

                            return `
                            <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} relative group">
                                <div class="flex ${isMe ? 'justify-end' : 'justify-start'} w-full items-end gap-1">
                                    ${!isMe ? `<button onclick="window.toggleReactMenu('${m.id}')" class="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity px-1"><i class="far fa-smile"></i></button>` : ''}
                                    
                                    <div class="max-w-[80%] ${isMe ? 'bg-[#DCF8C6]' : 'bg-white'} p-2 rounded-lg shadow text-xs relative">

                                        ${!isMe ? `<p class="text-[9px] font-bold text-[#006400] mb-1">${escapeHtml(m.userName)}</p>` : ''}
<p class="text-gray-800 text-sm leading-snug">${formatUserText(m.text)}</p>
<p class="text-[8px] text-gray-400 text-right mt-1">${time}</p>
                                    </div>
                                    
                                    ${isMe ? `<button onclick="window.toggleReactMenu('${m.id}')" class="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity px-1"><i class="far fa-smile"></i></button>` : ''}
                                </div>
                                
                                <div class="flex justify-${isMe ? 'end' : 'start'} w-full px-2">
                                    ${reactionsHtml}
                                </div>

                                <div id="react-menu-${m.id}" class="hidden absolute ${isMe ? 'right-10' : 'left-10'} -top-8 bg-white border rounded-full shadow-lg p-1 flex gap-2 animate-fade-in z-50">
                                    ${emojis.map(e => `<button onclick="window.selectReaction('${m.id}', '${e}')" class="hover:scale-125 transition-transform text-lg">${e}</button>`).join('')}
                                </div>
                            </div>`;
                        }).join('') : '<p class="text-center text-gray-400 text-xs mt-4">Seja o primeiro a comentar!</p>'}
                    </div>

                    ${isFinished 
                        ? `<div class="p-4 bg-gray-200 text-center border-t shrink-0">
                             <p class="text-xs font-bold text-gray-500">â›” Chat encerrado (Jogo Finalizado)</p>
                            </div>`
                        : `<div class="p-2 bg-white border-t flex items-center gap-2 shrink-0">
                             <input type="text" id="commentInput" maxlength="${CHAT_MAX_MESSAGE_LENGTH}" aria-label="Mensagem da resenha" placeholder="Digite sua resenha..." class="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none border focus:border-[#006400]">
                             <button onclick="sendComment('${mid}')" class="bg-[#006400] text-white w-10 h-10 rounded-full shadow flex items-center justify-center btn-press"><i class="fas fa-paper-plane text-xs"></i></button>
                            </div>`
                    }
                </div>`;
                cont.innerHTML = html;
                const body = document.getElementById('chatBody');
                // Auto scroll apenas se estiver perto do fim ou na carga inicial
                if(body && msgs.length > 0) body.scrollTop = body.scrollHeight;
            };

            const q = query(collection(db, "match_comments"), where("matchId", "==", mid)); 
            window.currentChatUnsub = onSnapshot(q, (snap) => {
  const msgs = [];
  snap.forEach(d => msgs.push({ id: d.id, ...d.data() }));
  msgs.sort((a,b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
  window.__currentChatMessagesById = Object.fromEntries(msgs.map((msg) => [msg.id, msg]));
  
  if(msgs.length > currentCount) {
    localStorage.setItem(`read_count_${mid}`, msgs.length);
  }
  renderChat(msgs);
});
            
            window.sendComment = async (matchId) => {
                const input = document.getElementById('commentInput');
                const rawValue = input?.value || "";
                const rawLength = getTextLength(rawValue.trim());
                const txt = normalizeChatMessageInput(rawValue);
                if(!txt) return;
                if(rawLength > CHAT_MAX_MESSAGE_LENGTH) {
                    alert(`Sua mensagem pode ter no maximo ${CHAT_MAX_MESSAGE_LENGTH} caracteres.`);
                    input?.focus();
                    return;
                }
                const uDoc = await getDoc(doc(db, "users", currentUser.uid));
                const uData = uDoc.data() || {};
                await addDoc(collection(db, "match_comments"), { 
                    matchId: matchId, 
                    userId: currentUser.uid, 
                    userName: normalizeChatUserName(uData.name || "Anonimo"), 
                    userPhoto: uData.photoBase64 || "", 
                    text: txt, 
                    timestamp: serverTimestamp(), 
                    reactions: {} // Inicializa vazio
                });
                input.value = "";
                input.focus();
            };
        };
window.__toggleScoutInfo = (id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('hidden');
};

        // --- SCOUT PREMIUM (KPIs + ÃšLTIMOS 5 + GRÃFICO + COMPETIÃ‡Ã•ES + RECORDES) ---
// --- SCOUT PREMIUM (ESTATÃSTICAS + GRÃFICO + ÃšLTIMOS 5 + TABELA + RECORDES) ---
window.showPlayerScout = async (targetUid, targetName, targetPhoto) => {
  const cont = document.getElementById('modalContainer');
  const overlay = document.getElementById('modalOverlay');
  if (!cont || !overlay) return;

  overlay.classList.remove('hidden');
  cont.innerHTML = `
    <div class="bg-white p-6 text-center">
      <i class="fas fa-spinner fa-spin text-2xl text-[#006400]"></i>
      <p class="text-xs mt-2 font-bold text-gray-500">Calculando Scout Premium...</p>
    </div>
  `;

  try {
    // 1) Coleta Dados
    const [mSnap, gSnap, uSnap] = await Promise.all([
      getDocs(collection(db, "matches")),
      getDocs(collection(db, "guesses")),
      getDocs(collection(db, "users"))
    ]);

    // 2) Mapeamento de criaÃ§Ã£o de usuÃ¡rios
    const usersCreatedAt = {};
const userDebts = {}; // âœ… NOVO
const allUsersIds = [];

uSnap.forEach(d => {
  const data = d.data();
  const dt = data.createdAt ? data.createdAt.toDate() : new Date(0);
  usersCreatedAt[d.id] = dt;
  userDebts[d.id] = Number(data.debts || 0); // âœ… NOVO
  allUsersIds.push(d.id);
});


    const targetCreated = usersCreatedAt[targetUid] || new Date(0);

    // 3) Guesses e Matches
    const allGuesses = [];
    gSnap.forEach(d => allGuesses.push(d.data()));

    const matches = [];
    mSnap.forEach(d => {
      const data = d.data();
      if (data.winner) {
        matches.push({
          id: d.id,
          ...data,
          deadlineDate: data.deadline?.toDate ? data.deadline.toDate() : new Date(0)
        });
      }
    });
    // usa a mesma ordem "oficial" do ranking (deadline > createdAt > id)
matches.sort(matchComparator);

    // 4) SimulaÃ§Ã£o + Coleta do â€œextratoâ€ do usuÃ¡rio
    let rankHistory = [];
    let currentScores = {};
    allUsersIds.forEach(uid => currentScores[uid] = 0);

    let totalEligible = 0;
    let totalVoted = 0;
    let totalHits = 0;

   const compStats = {}; // { comp: {h,t} }
const myExtract = [];       // extrato completo (inclui NOVOTE) para streaks/recordes
const myVotedExtract = [];  // extrato somente de votos (HIT/MISS) para "Ãšltimos 5" igual ao Extrato de Pontos
          // --- NOVO: mÃ©tricas de RISCO (perfil de "ir contra a maioria") ---
const riskShares = [];        // % de votos que bateram com a escolha dele (por jogo votado)
let riskAgainstMajority = 0;  // quantas vezes ele votou diferente do mais votado



    matches.forEach(m => {
      // SÃ³ considera jogos apÃ³s o usuÃ¡rio existir
      if (targetCreated > m.deadlineDate) return;

      totalEligible++;

      // Atualiza ranking global atÃ© esse jogo
      allUsersIds.forEach(uid => {
        if (usersCreatedAt[uid] > m.deadlineDate) return;

        const vote = allGuesses.find(g => g.matchId === m.id && g.userId === uid);
        if (vote && vote.teamSelected === m.winner) {
          currentScores[uid] += (m.round?.toLowerCase() === 'final' ? 6 : 3);
        }
      });

      // PosiÃ§Ã£o do target nesse momento
      const activeUsers = allUsersIds.filter(uid => usersCreatedAt[uid] <= m.deadlineDate);
      activeUsers.sort((a, b) => {
  const netA = (currentScores[a] || 0) - (userDebts[a] || 0) * 3;
  const netB = (currentScores[b] || 0) - (userDebts[b] || 0) * 3;

  // 1) Pontos lÃ­quidos desc
  if (netB !== netA) return netB - netA;

  // 2) Menos dÃ©bitos ganha
  const da = userDebts[a] || 0;
  const dbb = userDebts[b] || 0;
  if (da !== dbb) return da - dbb;

  // 3) Desempate por ID
  return String(a).localeCompare(String(b));
});

      const myPos = activeUsers.indexOf(targetUid) + 1;
      if (myPos > 0) rankHistory.push(myPos);

      // Status do target nesse jogo
      const myVote = allGuesses.find(g => g.matchId === m.id && g.userId === targetUid);
            // --- NOVO: calcula maioria e % de concordÃ¢ncia (Risco) ---
const activeUsersAtTime = allUsersIds.filter(uid => usersCreatedAt[uid] <= m.deadlineDate);

// votos vÃ¡lidos desse jogo (sÃ³ de quem jÃ¡ existia)
const votesThisMatch = allGuesses.filter(g =>
  g.matchId === m.id && activeUsersAtTime.includes(g.userId)
);

const counts = {};
votesThisMatch.forEach(v => {
  const k = v.teamSelected;
  counts[k] = (counts[k] || 0) + 1;
});

let majorityTeam = null;
let majorityCount = 0;
Object.entries(counts).forEach(([team, c]) => {
  if (c > majorityCount) { majorityCount = c; majorityTeam = team; }
});


      if (myVote) {
              // --- NOVO: registra risco sÃ³ quando ele vota ---
const totalVotesThisMatch = votesThisMatch.length || 0;
const sameCount = counts[myVote.teamSelected] || 0;
const sameShare = totalVotesThisMatch > 0 ? (sameCount / totalVotesThisMatch) : 1;

riskShares.push(sameShare);
if (majorityTeam && myVote.teamSelected !== majorityTeam) riskAgainstMajority++;

  totalVoted++;
  if (!compStats[m.competition]) compStats[m.competition] = { h: 0, t: 0 };
  compStats[m.competition].t++;

  const status = (myVote.teamSelected === m.winner) ? 'HIT' : 'MISS';

  if (status === 'HIT') {
    totalHits++;
    compStats[m.competition].h++;
  }

  // extrato completo (para streaks/recordes)
  myExtract.push({ matchId: m.id, status });

  // extrato somente votados (para "Ãšltimos 5" igual ao Extrato de Pontos)
  myVotedExtract.push({ matchId: m.id, status, deadlineDate: m.deadlineDate });

} else {
  // Sem voto entra apenas no extrato completo (quebra sequÃªncia)
  myExtract.push({ matchId: m.id, status: 'NOVOTE' });
}

    });

// --- CONSISTÃŠNCIA (PARIDADE ANDROID): mÃ©dia do |Î”| entre rodadas ---
const mean = (arr) => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length) : 0;

const avgDeltaAbs = (arrAsc) => {
  if (arrAsc.length < 3) return null; // Android retorna "-" com <3
  let s = 0;
  for (let i = 1; i < arrAsc.length; i++) s += Math.abs(arrAsc[i] - arrAsc[i-1]);
  return s / (arrAsc.length - 1);
};

// rankHistory jÃ¡ estÃ¡ em ordem cronolÃ³gica (ASC) porque vocÃª faz push no forEach
const avgDelta = avgDeltaAbs(rankHistory);

let consistencyLabel = "-";
let consistencyEmoji = "ðŸ“Š";
let consistencyDetail = "Dados insuficientes";

if (avgDelta !== null) {
  if (avgDelta <= 2.2) consistencyLabel = "ALTA";
  else if (avgDelta <= 2.5) consistencyLabel = "MÃ‰DIA";
  else consistencyLabel = "BAIXA";

  consistencyDetail = `OscilaÃ§Ã£o mÃ©dia: ${avgDelta.toFixed(1)}`;
}

// --- RISCO (PARIDADE ANDROID): risk = 1 - avgShare ---
const avgShare = mean(riskShares); // 0..1 (se ele sempre vota com a maioria, tende a 1)
const risk = 1.0 - avgShare;       // 0 = segue maioria, 1 = sempre contra

let riskLabel = "BAIXO";
let riskEmoji = "ðŸŽ²";

if (risk >= 0.50) riskLabel = "ALTO";
else if (risk >= 0.25) riskLabel = "MÃ‰DIO";

const riskDetail = `Risco: ${(risk*100).toFixed(0)}% â€¢ ConcordÃ¢ncia mÃ©dia: ${(avgShare*100).toFixed(0)}%`;
          
    // 5) SequÃªncia atual + recordes (W/L) â€” NOVOTE quebra
let maxWinStreak = 0;
let maxLossStreak = 0; // valor negativo (ex: -4)

// recordes: varre do comeÃ§o pro fim (cronolÃ³gico)
let running = 0;
myExtract.forEach(it => {
  if (it.status === 'NOVOTE') {
    running = 0;
    return;
  }
  if (it.status === 'HIT') {
    running = (running >= 0) ? running + 1 : 1;
    if (running > maxWinStreak) maxWinStreak = running;
  } else if (it.status === 'MISS') {
    running = (running <= 0) ? running - 1 : -1;
    if (running < maxLossStreak) maxLossStreak = running;
  }
});

// sequÃªncia atual: varre do fim pro comeÃ§o (mais recente) atÃ© quebrar
let currentStreak = 0;
for (let i = myExtract.length - 1; i >= 0; i--) {
  const it = myExtract[i];
  if (it.status === 'NOVOTE') break;

  if (it.status === 'HIT') {
    if (currentStreak >= 0) currentStreak++;
    else break; // mudou de derrota pra vitÃ³ria, entÃ£o sequÃªncia "atual" jÃ¡ acabou
  } else if (it.status === 'MISS') {
    if (currentStreak <= 0) currentStreak--;
    else break; // mudou de vitÃ³ria pra derrota
  }
}

const streakDisplay = currentStreak > 0
  ? `<span class="text-green-300 font-black">+${currentStreak}</span>`
  : (currentStreak < 0
    ? `<span class="text-red-300 font-black">${currentStreak}</span>`
    : `<span class="text-gray-300 font-black">0</span>`);
          
// Conta quantas vezes atingiu o recorde (ex: +6 aconteceu 4 vezes)
let winRecordCount = 0;
let lossRecordCount = 0;

let run = 0;         // sequÃªncia corrente (+ hits / - misses)
let lastType = null; // 'HIT' | 'MISS' | null

const flushRun = () => {
  if (run === maxWinStreak && maxWinStreak > 0) winRecordCount++;
  if (run === maxLossStreak && maxLossStreak < 0) lossRecordCount++;
  run = 0;
  lastType = null;
};

myExtract.forEach(it => {
  if (it.status === 'NOVOTE') {
    flushRun();
    return;
  }

  // Se mudou de HIT para MISS ou MISS para HIT, fecha a run anterior antes de comeÃ§ar a nova
  if (lastType && it.status !== lastType) {
    flushRun();
  }

  if (it.status === 'HIT') {
    run = run + 1;         // aqui run sempre positivo dentro de run de HIT
    lastType = 'HIT';
  } else if (it.status === 'MISS') {
    run = run - 1;         // aqui run sempre negativo dentro de run de MISS
    lastType = 'MISS';
  }
});

// fecha a Ãºltima sequÃªncia ao final
flushRun();



 // 6) Ãšltimos 5 resultados (IGUAL ao Extrato: Ãºltimos 5 jogos elegÃ­veis, mesmo sem voto)
// myExtract estÃ¡ em ordem cronolÃ³gica (foi preenchido no matches.forEach jÃ¡ ordenado por deadlineDate asc)
// entÃ£o os "Ãºltimos 5" sÃ£o simplesmente os 5 Ãºltimos itens do extrato completo.
const last5 = myExtract
  .slice(-5)                 // pega os 5 mais recentes
  .reverse()                 // mostra do mais recente -> mais antigo (opcional, fica mais intuitivo)
  .map(it => {
    if (it.status === 'HIT') return 'âœ…';
    if (it.status === 'MISS') return 'âŒ';
    return 'ðŸš«';
  });


    // 7) PrecisÃ£o, posiÃ§Ã£o atual, melhor posiÃ§Ã£o, % votos
    const acc = totalVoted > 0 ? Math.round((totalHits / totalVoted) * 100) : 0;
    const currentPos = rankHistory.length ? rankHistory[rankHistory.length - 1] : '-';
const bestPos = rankHistory.length ? Math.min(...rankHistory) : '-';
const worstPos = rankHistory.length ? Math.max(...rankHistory) : '-';

const bestPosCount = (rankHistory.length && bestPos !== '-') 
  ? rankHistory.filter(p => p === bestPos).length 
  : 0;

const worstPosCount = (rankHistory.length && worstPos !== '-') 
  ? rankHistory.filter(p => p === worstPos).length 
  : 0;


    // 8) Tabela por competiÃ§Ã£o (ordenada por precisÃ£o desc)
    const compRows = Object.entries(compStats).map(([comp, st]) => {
      const pct = st.t > 0 ? Math.round((st.h / st.t) * 100) : 0;
      return { comp, h: st.h, t: st.t, pct };
    }).sort((a, b) => (b.pct - a.pct) || (b.t - a.t));

    const tableHtml = compRows.length ? `
      <div class="rounded-xl border border-white/10 overflow-hidden">
        <div class="grid grid-cols-[minmax(0,1fr)_52px_62px_44px] bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white/70">
          <div>CompetiÃ§Ã£o</div>
          <div class="text-right pr-1">Jogos</div>
          <div class="text-right pr-1">Acertos</div>
          <div class="text-right">%</div>
        </div>
        ${compRows.map(r => `
          <div class="grid grid-cols-[minmax(0,1fr)_52px_62px_44px] px-3 py-2 text-xs border-t border-white/10">
            <div class="text-white font-bold truncate pr-2" title="${escapeHtml(r.comp || "Sem nome")}">${escapeHtml(r.comp || "Sem nome")}</div>
            <div class="text-right pr-1 text-white/90 font-bold tabular-nums">${r.t}</div>
            <div class="text-right pr-1 text-[#FFD700] font-black tabular-nums">${r.h}</div>
            <div class="text-right text-white font-black tabular-nums">${r.pct}%</div>
          </div>
        `).join('')}
      </div>
    ` : `<div class="text-xs text-white/60 font-bold">Sem dados por competiÃ§Ã£o ainda.</div>`;

          const badgeIfMany = (n) => (n && n > 1)
  ? `<span class="ml-2 inline-flex items-center justify-center min-w-[34px] h-7 px-2 rounded-full bg-red-600 text-white text-xs font-black shadow border border-white/20">${n}x</span>`
  : '';


    // 9) Render Premium (FIX: fundo sempre escuro + remove â€œchuva de nÃºmerosâ€ + close padronizado)
const html = `
  <div class="w-full max-w-sm rounded-none shadow-2xl overflow-hidden"
       style="max-height: 90vh; overflow-y: auto; background: linear-gradient(to bottom, #071018, #0b1622, #071018);">
       
    <div class="p-5 text-white">
      <div class="flex items-start justify-between">
        <div>
          <div class="font-black italic text-[#FFD700] text-lg tracking-widest">SCOUT DO PALPITEIRO</div>
          <div class="text-[10px] font-bold text-white/60 uppercase tracking-wider">Resumo Premium â€¢ 2026</div>
        </div>

        <!-- FIX: usar window.closeModal -->
        <button type="button" onclick="window.closeModal()" class="text-white/80 hover:text-white">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="flex items-center gap-3 mt-4">
        <img src="${getAvatarUrl(targetPhoto, targetName)}" class="w-14 h-14 rounded-full border-2 border-[#FFD700] shadow">
        <div class="min-w-0">
          <div class="font-black text-xl uppercase truncate">${targetName}</div>
          <div class="mt-2 space-y-2">

  <!-- ConsistÃªncia -->
  <div class="flex items-center justify-between px-3 py-2 rounded-xl bg-white/10 border border-white/10">
    <div class="flex items-center gap-2 min-w-0">
      <span class="text-base">${consistencyEmoji}</span>
      <div class="min-w-0">
        <div class="text-[11px] font-black text-white/90 truncate">ConsistÃªncia: <span class="text-[#FFD700]">${consistencyLabel}</span></div>
        <div class="text-[10px] text-white/50 font-bold truncate">${consistencyDetail}</div>
      </div>
    </div>
    <button class="w-7 h-7 rounded-full bg-black/30 border border-white/10 flex items-center justify-center"
      onclick="window.__toggleScoutInfo('scoutInfoConsistency')">
      <i class="fas fa-info text-[10px] text-white/80"></i>
    </button>
  </div>

  <div id="scoutInfoConsistency" class="hidden text-[10px] text-white/70 font-bold bg-black/20 border border-white/10 rounded-xl p-3">
    Mede o quanto a posiÃ§Ã£o dele â€œbalanÃ§aâ€ ao longo do tempo. Quanto menor a oscilaÃ§Ã£o, maior a consistÃªncia.
  </div>

  <!-- Risco -->
  <div class="flex items-center justify-between px-3 py-2 rounded-xl bg-white/10 border border-white/10">
    <div class="flex items-center gap-2 min-w-0">
      <span class="text-base">${riskEmoji}</span>
      <div class="min-w-0">
        <div class="text-[11px] font-black text-white/90 truncate">Risco: <span class="text-blue-200">${riskLabel}</span></div>
        <div class="text-[10px] text-white/50 font-bold truncate">${riskDetail}</div>
      </div>
    </div>
    <button class="w-7 h-7 rounded-full bg-black/30 border border-white/10 flex items-center justify-center"
      onclick="window.__toggleScoutInfo('scoutInfoRisk')">
      <i class="fas fa-info text-[10px] text-white/80"></i>
    </button>
  </div>

  <div id="scoutInfoRisk" class="hidden text-[10px] text-white/70 font-bold bg-black/20 border border-white/10 rounded-xl p-3">
    Mede se ele costuma votar com a maioria ou â€œir contraâ€. Menor concordÃ¢ncia e mais votos contra a maioria = risco mais alto.
  </div>

</div>

        </div>
      </div>

      <!-- KPIs -->
      <div class="grid grid-cols-2 gap-3 mt-4">
        <div class="bg-white/10 rounded-lg p-3 border border-white/10 text-center">
          <div class="text-[9px] uppercase tracking-wider text-white/60 font-black">Votos/Conf.</div>
          <div class="text-lg font-black">${totalEligible} <span class="text-sm text-white/60">(${totalVoted})</span></div>
        </div>
        <div class="bg-white/10 rounded-lg p-3 border border-white/10 text-center">
          <div class="text-[9px] uppercase tracking-wider text-white/60 font-black">Acertos</div>
          <div class="text-lg font-black text-[#FFD700]">${totalHits}</div>
        </div>
        <div class="bg-white/10 rounded-lg p-3 border border-white/10 text-center">
          <div class="text-[9px] uppercase tracking-wider text-white/60 font-black">PrecisÃ£o</div>
          <div class="text-lg font-black text-blue-300">${acc}%</div>
        </div>
        <div class="bg-white/10 rounded-lg p-3 border border-white/10 text-center">
          <div class="text-[9px] uppercase tracking-wider text-white/60 font-black">Seq. Atual</div>
          <div class="text-lg font-black">${streakDisplay}</div>
        </div>
      </div>

      <!-- Ãšltimos 5 -->
      <div class="mt-4 bg-white/10 rounded-lg p-3 border border-white/10">
        <div class="text-[10px] font-black uppercase tracking-wider text-white/70 mb-2">Ãšltimos 5</div>
        <div class="flex items-center justify-between text-[10px] font-black text-white/60 mb-2 px-1">
  <span>Mais recente</span>
  <span class="text-white/40">â†’</span>
  <span>Mais antigo</span>
</div>
        <div class="flex justify-between gap-2">
          ${last5.map(x => `
            <div class="w-10 h-10 rounded-full bg-black/30 border border-white/10 flex items-center justify-center text-lg">
              ${x}
            </div>
          `).join('')}
        </div>
        <div class="text-[10px] text-white/50 font-bold mt-2">âœ… acerto â€¢ âŒ erro â€¢ ðŸš« sem voto (quebra sequÃªncia)</div>
      </div>

      <!-- GrÃ¡fico -->
      <div class="mt-4 bg-white rounded-lg p-3">
        <div class="text-[10px] text-gray-600 font-black mb-2 text-center uppercase tracking-wider">EvoluÃ§Ã£o no Ranking</div>
        <div class="h-40 w-full"><canvas id="scoutChart"></canvas></div>
      </div>

      <!-- Desempenho por competiÃ§Ã£o -->
      <div class="mt-4">
        <div class="text-[10px] font-black uppercase tracking-wider text-white/70 mb-2">Desempenho por competiÃ§Ã£o</div>
        ${tableHtml}
      </div>

      <!-- Recordes & Perfil -->
<div class="mt-4 bg-white/10 rounded-lg p-3 border border-white/10">
  <div class="text-[10px] font-black uppercase tracking-wider text-white/70 mb-2">Recordes & Perfil</div>

  <div class="grid grid-cols-2 gap-3">
    <div class="bg-black/20 rounded-lg p-3 border border-white/10">
      <div class="flex items-center justify-between">
        <div class="text-[9px] uppercase text-white/60 font-black">ðŸ”¥ Melhor seq.</div>
        ${badgeIfMany(winRecordCount)}
      </div>
      <div class="text-lg font-black text-green-300">+${maxWinStreak}</div>
    </div>

    <div class="bg-black/20 rounded-lg p-3 border border-white/10">
      <div class="flex items-center justify-between">
        <div class="text-[9px] uppercase text-white/60 font-black">â„ï¸ Pior seq.</div>
        ${badgeIfMany(lossRecordCount)}
      </div>
      <div class="text-lg font-black text-red-300">${maxLossStreak}</div>
    </div>

    <div class="bg-black/20 rounded-lg p-3 border border-white/10">
      <div class="flex items-center justify-between">
        <div class="text-[9px] uppercase text-white/60 font-black">ðŸ… Melhor posiÃ§Ã£o</div>
        ${badgeIfMany(bestPosCount)}
      </div>
      <div class="text-lg font-black text-[#FFD700]">#${bestPos}</div>
    </div>

    <div class="bg-black/20 rounded-lg p-3 border border-white/10">
      <div class="flex items-center justify-between">
        <div class="text-[9px] uppercase text-white/60 font-black">âš ï¸ Pior posiÃ§Ã£o</div>
        ${badgeIfMany(worstPosCount)}
      </div>
      <div class="text-lg font-black text-white">#${worstPos}</div>
    </div>
  </div>
</div>


      <!-- FIX: usar window.closeModal -->
      <button type="button" onclick="window.closeModal()"
              class="w-full mt-5 bg-[#FFD700] text-black font-black py-3 rounded shadow-lg btn-press text-xs">
        FECHAR
      </button>
    </div>
  </div>
`;


cont.innerHTML = html;

    // 10) GrÃ¡fico
    if (window.myScoutChart) window.myScoutChart.destroy();
if (rankHistory.length > 0) {
  const canvas = document.getElementById('scoutChart');
  const ctx = canvas.getContext('2d');
  const ChartLib = await ensureChartJs();

  window.myScoutChart = new ChartLib(ctx, {
        type: 'line',
        data: {
          labels: rankHistory.map((_, i) => i + 1),
          datasets: [{
            label: 'PosiÃ§Ã£o',
            data: rankHistory,
            borderColor: '#006400',
            backgroundColor: 'rgba(0,100,0,0.12)',
            tension: 0.3,
            fill: true,
            pointRadius: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { reverse: true, beginAtZero: false, min: 1, grid: { display: false } },
            x: { grid: { display: false }, ticks: { color: '#666', font: { size: 9 }, maxTicksLimit: 8 } }
          },
          plugins: { legend: { display: false } }
        }
      });
    }

  } catch (e) {
    console.error(e);
    cont.innerHTML = `<div class="bg-white p-4 text-center text-red-600 font-bold">Erro no Scout Premium.</div>`;
  }
};

        // --- FUNÃ‡Ã•ES PARA ABRIR/FECHAR AS LISTAS (TOGGLE) ---
        window.toggleOpen = () => {
            const container = document.getElementById('openContainer');
            const icon = document.getElementById('iconOpen');
            if (container && icon) {
                container.classList.toggle('hidden');
                // Troca a seta (Cima/Baixo)
                if (container.classList.contains('hidden')) {
                    icon.classList.remove('fa-chevron-up');
                    icon.classList.add('fa-chevron-down');
                } else {
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-up');
                }
            }
        };

        window.toggleWaiting = () => {
            const container = document.getElementById('waitingContainer');
            const icon = document.getElementById('iconWaiting');
            if (container && icon) {
                container.classList.toggle('hidden');
                if (container.classList.contains('hidden')) {
                    icon.classList.remove('fa-chevron-up');
                    icon.classList.add('fa-chevron-down');
                } else {
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-up');
                }
            }
        };

        window.toggleFinished = () => {
            const container = document.getElementById('finishedContainer');
            const icon = document.getElementById('iconFinished');
            if (container && icon) {
                container.classList.toggle('hidden');
                if (container.classList.contains('hidden')) {
                    icon.classList.remove('fa-chevron-up');
                    icon.classList.add('fa-chevron-down');
                } else {
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-up');
                }
            }
        };
 // ===============================
// MODAIS: helpers globais
// ===============================
window.openModal = (html) => {
  const overlay = document.getElementById("modalOverlay");
  const container = document.getElementById("modalContainer");
  if (!overlay || !container) return;

  container.innerHTML = html;
  overlay.classList.remove("hidden");
};

window.closeModal = () => {
  const overlay = document.getElementById("modalOverlay");
  const container = document.getElementById("modalContainer");

  // âœ… evita travadas/bags do chart quando fecha modal
  if (window.currentChatUnsub) {
    try { window.currentChatUnsub(); } catch (error) {}
    window.currentChatUnsub = null;
  }
  window.__currentChatMessagesById = {};

  if (window.myScoutChart) {
    try { window.myScoutChart.destroy(); } catch(e) {}
    window.myScoutChart = null;
  }

  if (container) container.innerHTML = "";
  if (overlay) overlay.classList.add("hidden");
};
window.__adminReturnTarget = null;
window.__setAdminReturnTarget = (handler = null) => {
  window.__adminReturnTarget = typeof handler === "function" ? handler : null;
};
window.__clearAdminReturnTarget = () => {
  window.__adminReturnTarget = null;
};
window.returnToAdminHome = () => {
  window.__clearAdminReturnTarget();
  return typeof window.openAdminMenu === "function" ? window.openAdminMenu() : window.closeModal();
};
window.closeAdminSubscreen = () => {
  const next = window.__adminReturnTarget;
  window.__adminReturnTarget = null;
  if (typeof next === "function") return next();
  return typeof window.openAdminMenu === "function" ? window.openAdminMenu() : window.closeModal();
};
// ====== Bloqueio de fechamento quando Rules Gate estiver ativo ======
(() => {
  const __origCloseModal = window.closeModal;

  window.closeModal = function () {
    // se Rules Gate OU Force Password estiver ativo, impede fechar
    if (window.__rulesGateLock || window.__forcePwLock) return;
    if (adminMatchEditState.matchId) {
      resetAdminMatchEditState();
    }
    if (adminRoundSummaryState.previewUrl) {
      try { URL.revokeObjectURL(adminRoundSummaryState.previewUrl); } catch (error) {}
      adminRoundSummaryState.previewUrl = "";
      adminRoundSummaryState.previewBlob = null;
    }
    if (window.__adminReturnTarget) {
      const next = window.__adminReturnTarget;
      window.__adminReturnTarget = null;
      return typeof next === "function" ? next() : __origCloseModal.apply(this, arguments);
    }
    return __origCloseModal.apply(this, arguments);
  };
})();


// ===============================
// MODAL BASE (garante openModal/closeModal globais)
// ===============================
if (!window.openModal) {
  window.openModal = (html) => {
    const overlay = document.getElementById("modalOverlay");
    const container = document.getElementById("modalContainer");
    if (!overlay || !container) return;
    container.innerHTML = html;
    overlay.classList.remove("hidden");
  };
}

if (!window.closeModal) {
  window.closeModal = () => {
    const overlay = document.getElementById("modalOverlay");
    const container = document.getElementById("modalContainer");
    if (container) container.innerHTML = "";
    if (overlay) overlay.classList.add("hidden");
  };
}
// ===============================
// MODAL: bloqueia fechar por overlay click e ESC quando gate estiver ativo
// ===============================
(() => {
  // 1) Clique fora (overlay)
  const overlay = document.getElementById("modalOverlay");
  if (overlay && !overlay.__rulesGateBound) {
    overlay.__rulesGateBound = true;

    overlay.addEventListener("click", (e) => {
      // sÃ³ fecha se o clique foi no overlay (fora do container)
      if (e.target !== overlay) return;

      // se gate estiver ativo, nÃ£o fecha
     if (window.__rulesGateLock || window.__forcePwLock) return;
window.closeModal();

    });
  }

  // 2) ESC
  if (!document.__rulesGateEscBound) {
    document.__rulesGateEscBound = true;

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;

      // se gate estiver ativo, nÃ£o fecha
if (window.__rulesGateLock || window.__forcePwLock) return;

      // se nÃ£o tiver modal aberto, ignora
      const ov = document.getElementById("modalOverlay");
      if (ov && !ov.classList.contains("hidden")) {
        window.closeModal();
      }
    });
  }
})();
// --- RULES GATE MODAL (obrigatÃ³rio / travado) ---
const openRulesGateModal = async () => {
  const overlay = document.getElementById('modalOverlay');
  const cont = document.getElementById('modalContainer');
  if (!overlay || !cont) {
    alert("Erro: modalOverlay/modalContainer nÃ£o encontrado no HTML.");
    return;
  }

  overlay.classList.remove('hidden');
overlay.style.zIndex = '99999';
document.body.style.overflow = 'hidden';

  // monta lista de regras
  const items = Array.isArray(window.__rulesGate.items) ? window.__rulesGate.items : [];
  const listHtml = items.length
    ? items.map((t) => `<li class="mb-2 leading-relaxed text-sm text-gray-700">â€¢ ${String(t)}</li>`).join('')
    : `<li class="text-sm text-gray-500">Nenhuma regra cadastrada.</li>`;

  cont.innerHTML = `
    <div class="bg-white p-6 relative w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100">
      <div class="text-center mb-4">
        <div class="text-[#006400] font-black uppercase text-lg">Regulamento ObrigatÃ³rio</div>
        <div class="text-[11px] text-gray-500 font-bold mt-1">
          VersÃ£o: <span class="text-black">${window.__rulesGate.requiredVersion || 0}</span>
        </div>
      </div>

      <div class="max-h-[55vh] overflow-y-auto p-4 bg-gray-50 rounded-xl border border-gray-200">
        <ul class="list-none p-0 m-0">
          ${listHtml}
        </ul>
      </div>

      <div class="mt-5 flex gap-3">
        <button id="btnAcceptRulesGate"
          class="flex-1 bg-[#006400] text-white py-3 font-black rounded-xl shadow-lg btn-press text-sm">
          ACEITAR E CONTINUAR
        </button>
        <button id="btnLogoutRulesGate"
          class="px-4 bg-gray-100 text-gray-700 py-3 font-black rounded-xl border border-gray-200 text-sm">
          SAIR
        </button>
      </div>

      <p id="rulesGateMsg" class="text-[11px] text-gray-500 font-bold mt-3 text-center"></p>
    </div>
  `;

  // trava: nÃ£o fecha clicando fora nem ESC (se vocÃª tiver handler disso, ignore)
  // botÃ£o sair
  document.getElementById('btnLogoutRulesGate').onclick = async () => {
    try { await signOut(auth); } catch(e) {}
  };

  // botÃ£o aceitar
  document.getElementById('btnAcceptRulesGate').onclick = async () => {
    const msg = document.getElementById('rulesGateMsg');
    const btn = document.getElementById('btnAcceptRulesGate');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i>`;

    try {
      const uid = window.currentUid;
      if (!uid) throw new Error("Sem UID");

      const v = Number(window.__rulesGate.requiredVersion || 0);

      await updateDoc(doc(db, "users", uid), {
        rulesAccepted: true,
        rulesAcceptedVersion: v,
        rulesAcceptedAt: serverTimestamp()
      });

      // libera
      window.__rulesGate.gateRules = false;
      window.__rulesGateLock = false;

      // fecha modal e segue
      overlay.classList.add('hidden');
document.body.style.overflow = 'auto';


      // garantir que a UI â€œentreâ€ corretamente (caso tenhamos segurado a navegaÃ§Ã£o)
      // segue pelo funil central
window.continueAfterLoginGates();

    } catch (e) {
      console.error(e);
      if (msg) msg.innerText = "Erro ao salvar aceitaÃ§Ã£o. Verifique sua conexÃ£o e tente novamente.";
      btn.disabled = false;
      btn.innerText = "ACEITAR E CONTINUAR";
    }
  };
};
// --- RULES GATE EVALUATOR ---
const evaluateRulesGate = async (uid, userData) => {
  window.__rulesGateLock = true;

  try {
    // 1) settings/rules
    const rulesRef = doc(db, "settings", "rules");
    const rulesSnap = await getDoc(rulesRef);

    let rules = {
      version: 0,
      items: [],
      updatedAt: null,
      officialStartAt: null
    };

    if (rulesSnap.exists()) {
      const r = rulesSnap.data();
      rules.version = Number(r.version || 0);
      rules.items = Array.isArray(r.items) ? r.items : [];
      rules.updatedAt = r.updatedAt || null;
      rules.officialStartAt = r.officialStartAt || null;
    }

    window.__rulesGate.requiredVersion = rules.version;
    window.__rulesGate.items = rules.items;
    window.__rulesGate.updatedAt = rules.updatedAt;
    window.__rulesGate.officialStartAt = rules.officialStartAt;

    // 2) users/{uid} (vocÃª jÃ¡ tem userData do getDoc anterior)
    const accepted = userData?.rulesAccepted === true;
    const acceptedVersion = Number(userData?.rulesAcceptedVersion || 0);

    // 3) regra do gate
    const activeNow = shouldGateBeActiveNow(rules.officialStartAt);

    const mustAccept =
      activeNow &&
      (rules.version > acceptedVersion || !accepted);

    window.__rulesGate.gateRules = mustAccept;

    return mustAccept;
  } finally {
    // NÃƒO libera lock aqui se gateRules==true,
    // porque o lock sÃ³ deve cair quando aceitar.
    if (!window.__rulesGate.gateRules) window.__rulesGateLock = false;
  }
};


// Regras agora viram MODAL (conteÃºdo vem do rulesList jÃ¡ carregado)
window.openRulesModal = async ({ mandatory = false } = {}) => {
  try {
    // trava fechamento se for obrigatÃ³rio
    window.__rulesGateLock = !!mandatory;

    // Garante que renderRules rode antes de abrir o modal.
    await renderRules();

    const uid = window.getCurrentUid();
    const rulesDoc = await window.getRulesDoc(); // pega version
    const rulesVersion = (rulesDoc.version || "").toString();

    // marca "abriu tela"
    if (uid) await window.markRulesOpened(uid);

    // pega estado do usuÃ¡rio pra decidir se mostra botÃ£o
    let gate = true;
    if (uid) {
      const userState = await window.getUserRulesState(uid);
      gate = window.computeGateRules(userState, rulesDoc);
    }

    const rulesList = document.getElementById("rulesList");
    const inner = rulesList
      ? rulesList.innerHTML
      : `<div class="text-xs font-bold text-gray-600">Carregando regras...</div>`;

    const closeBtnHtml = mandatory
      ? `` // sem X no modo obrigatÃ³rio
      : `<button class="btn-press" onclick="closeModal()"><i class="fas fa-times"></i></button>`;

    const footerHtml = (() => {
      // Se Ã© obrigatÃ³rio e ainda estÃ¡ pendente: sÃ³ deixa aceitar
      if (mandatory && gate) {
        return `
          <div class="p-4 pt-0 space-y-2">
            <button id="btnAcceptRules"
                    class="w-full bg-[#006400] text-white py-3 rounded font-black text-xs shadow btn-press">
              LI E CONCORDO âœ…
            </button>
            <div class="text-[10px] text-gray-500 font-bold text-center">
              VocÃª precisa aceitar para continuar usando o app.
            </div>
          </div>
        `;
      }

      // Se nÃ£o Ã© obrigatÃ³rio:
      // - se pendente: mostra aceitar + fechar
      // - se jÃ¡ aceitou: mostra selo + fechar
      if (!mandatory) {
        if (gate) {
          return `
            <div class="p-4 pt-0 space-y-2">
              <button id="btnAcceptRules"
                      class="w-full bg-[#006400] text-white py-3 rounded font-black text-xs shadow btn-press">
                LI E CONCORDO âœ…
              </button>
              <button onclick="closeModal()"
                      class="w-full bg-white text-[#006400] py-3 rounded font-black text-xs shadow btn-press border border-[#006400]/30">
                FECHAR
              </button>
            </div>
          `;
        }

        return `
          <div class="p-4 pt-0 space-y-2">
            <div class="w-full bg-green-50 border border-green-200 text-green-800 py-3 rounded font-black text-xs text-center">
              âœ… vocÃª jÃ¡ aceitou este regulamento
            </div>
            <button onclick="closeModal()"
                    class="w-full bg-[#006400] text-white py-3 rounded font-black text-xs shadow btn-press">
              FECHAR
            </button>
          </div>
        `;
      }

      // obrigatÃ³rio mas jÃ¡ aceito (caso raro): pode fechar
      return `
        <div class="p-4 pt-0">
          <div class="w-full bg-green-50 border border-green-200 text-green-800 py-3 rounded font-black text-xs text-center">
            âœ… vocÃª jÃ¡ aceitou este regulamento
          </div>
        </div>
      `;
    })();

    const html = `
      <div class="w-full max-w-sm">
        <div class="bg-[#006400] text-white px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <i class="fas fa-scroll text-[#FFD700]"></i>
            <span class="font-black uppercase text-sm tracking-wide">Regras</span>
          </div>
          ${closeBtnHtml}
        </div>

        <div class="p-4 space-y-2 max-h-[70vh] overflow-y-auto">
          ${inner}
        </div>

        ${footerHtml}
      </div>
    `;

        
    window.openModal(html);

    // Wire do botÃ£o de aceitar (se existir)
    const btn = document.getElementById("btnAcceptRules");
    if (btn) {
      btn.onclick = async () => {
        try {
          btn.disabled = true;
          btn.classList.add("opacity-60");

          const uid2 = window.getCurrentUid();
          if (!uid2) throw new Error("Sem usuÃ¡rio logado");

          await window.acceptRules(uid2, rulesVersion);

          // atualiza status do botÃ£o de regras na profile (se vocÃª tiver)
          if (typeof window.updateRulesButtonStatus === "function") {
            window.updateRulesButtonStatus(true);
          }

          // se era obrigatÃ³rio, destrava e fecha
          window.__rulesGateLock = false;

          // Reabre o modal jÃ¡ em modo "aceito" (fica bonito e garante paridade)
          closeModal();
          window.openRulesModal({ mandatory: false });

        } catch (e) {
          console.error("Erro ao aceitar regras:", e);
          btn.disabled = false;
          btn.classList.remove("opacity-60");
          alert("NÃ£o foi possÃ­vel salvar seu aceite. Verifique sua conexÃ£o e tente novamente.");
        }
      };
    }

  } catch (e) {
    console.error("Erro ao abrir regras:", e);
    window.__rulesGateLock = false;

    window.openModal(`
      <div class="w-full max-w-sm bg-white p-4 text-center">
        <p class="text-sm font-black text-red-600">Erro ao carregar regras</p>
        <p class="text-xs text-gray-600 mt-1">Tente novamente em instantes.</p>
        <button onclick="closeModal()" class="w-full mt-4 bg-[#006400] text-white py-3 rounded font-black text-xs shadow btn-press">
          FECHAR
        </button>
      </div>
    `);
  }
};

// ========= REGRAS: GATE + ACEITE (paridade Android) =========

// Estado do modal obrigatÃ³rio (impede fechar)
window.__rulesGateLock = false;

// (vocÃª provavelmente jÃ¡ tem o uid atual em algum lugar; ajuste aqui)
window.getCurrentUid = () => {
  // opÃ§Ã£o A: Firebase Auth
  // return auth?.currentUser?.uid || null;

  // opÃ§Ã£o B: se vocÃª guarda em window/global
  return window.currentUid || null;
};

window.getRulesDoc = async () => {
  await renderRules(true); // forÃ§a pegar versÃ£o/updatedAt novos
  return cachedRulesData || { items: [], version: "", updatedAt: null, officialStartAt: null };
};

window.getUserRulesState = async (uid) => {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { rulesAccepted: false, rulesAcceptedVersion: "" };
  const d = snap.data() || {};
  return {
    rulesAccepted: !!d.rulesAccepted,
    rulesAcceptedVersion: (d.rulesAcceptedVersion || "").toString(),
  };
};

window.markRulesOpened = async (uid) => {
  try {
    await setDoc(
      doc(db, "users", uid),
      { rulesLastOpenedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (e) {
    console.warn("Falha ao gravar rulesLastOpenedAt:", e);
  }
};

window.acceptRules = async (uid, rulesVersion) => {
  await setDoc(
    doc(db, "users", uid),
    {
      rulesAccepted: true,
      rulesAcceptedVersion: (rulesVersion || "").toString(),
      rulesAcceptedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

window.computeGateRules = (userState, rulesDoc) => {
  const accepted = !!userState.rulesAccepted;
  const uVer = (userState.rulesAcceptedVersion || "").toString();
  const rVer = (rulesDoc.version || "").toString();
  return (!accepted) || (uVer !== rVer);
};

// Chame isso apÃ³s login (quando jÃ¡ tiver uid)
window.enforceRulesGate = async () => {
  const uid = window.getCurrentUid();
  if (!uid) return;

  const [rulesDoc, userState] = await Promise.all([
    window.getRulesDoc(),
    window.getUserRulesState(uid),
  ]);

  const gate = window.computeGateRules(userState, rulesDoc);
  if (gate) {
    // abre obrigatÃ³rio e trava fechar
    await window.openRulesModal({ mandatory: true });
  } else {
    // opcional: atualizar status do botÃ£o na profile
    if (typeof window.updateRulesButtonStatus === "function") {
      window.updateRulesButtonStatus(false);
    }
  }
};
