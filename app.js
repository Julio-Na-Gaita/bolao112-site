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
import { getMessaging, getToken, isSupported as isMessagingSupported } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

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

const getAppVersion = () => String(window.APP_VERSION || 'web-1.7.8');
const getAppVersionShort = () => getAppVersion().replace(/^web-/, '');
const getAppVersionLabel = () => `Web v${getAppVersionShort()}`;
const getAppVersionFullLabel = () => `Versão ${getAppVersionLabel()}`;

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
let adminFinancialState = {
  users: [],
  whitelist: [],
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

const normalizeAdminText = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const getAdminCommunicationVapidKey = async () => {
  const inlineKey = String(window.BOLAO_FCM_VAPID_KEY || "").trim();
  if (inlineKey) return inlineKey;

  try {
    const cfgSnap = await getDoc(doc(db, "settings", "config"));
    return String(cfgSnap.data()?.webPushVapidKey || "").trim();
  } catch (error) {
    console.warn("Não foi possível carregar VAPID de settings/config:", error);
    return "";
  }
};

const isWebPushSupported = async () => {
  try {
    return "Notification" in window && "serviceWorker" in navigator && await isMessagingSupported();
  } catch (error) {
    console.warn("Push web indisponível:", error);
    return false;
  }
};

const hashNotificationToken = async (token) => {
  const raw = String(token || "");
  if (!window.crypto?.subtle) return btoa(raw).replace(/[^a-zA-Z0-9]/g, "").slice(0, 120);
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const saveNotificationTokenForCurrentUser = async (token) => {
  if (!currentUser || !token) return;
  const tokenId = await hashNotificationToken(token);
  const userSnap = await getDoc(doc(db, "users", currentUser.uid)).catch(() => null);
  const userData = userSnap?.data?.() || {};
  const nowTs = Timestamp.fromDate(new Date());

  await setDoc(doc(db, "notification_tokens", tokenId), {
    token,
    uid: currentUser.uid,
    name: userData.name || "",
    username: userData.username || "",
    email: currentUser.email || userData.email || "",
    enabled: true,
    platform: "web",
    userAgent: navigator.userAgent || "",
    createdAt: nowTs,
    updatedAt: nowTs,
    lastSeenAt: nowTs
  }, { merge: true });

  await setDoc(doc(db, "users", currentUser.uid), {
    hasWebPushToken: true,
    webPushUpdatedAt: nowTs
  }, { merge: true });
};

window.requestWebPushPermissionAndSaveToken = async () => {
  if (!currentUser) {
    alert("Faça login para ativar notificações.");
    return null;
  }

  if (!await isWebPushSupported()) {
    alert("Este navegador ainda não suporta push web neste aparelho.");
    return null;
  }

  const vapidKey = await getAdminCommunicationVapidKey();
  if (!vapidKey) {
    alert("Push web ainda não configurado. Configure a chave VAPID do Firebase para ativar notificações.");
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    alert("Permissão de notificação não concedida.");
    return null;
  }

  const swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { updateViaCache: "none" });
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swRegistration
  });

  if (!token) {
    alert("Não foi possível obter o token de push deste aparelho.");
    return null;
  }

  await saveNotificationTokenForCurrentUser(token);
  alert("Notificações ativadas neste aparelho.");
  return token;
};

const normalizeRoundName = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

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

const buildAdminWhatsAppMessage = ({ teamA, teamB, competition, round, deadline }) => {
  const dateLabel = deadline ? formatAdminDateTimeLabel(deadline) : "";
  return `📢 JOGO NOVO: 📢\n\n⚽ ${teamA} x ${teamB}\n🏆 ${competition} (${round})\n⏰ ${dateLabel}\n\n📲 VOTE AGORA: https://bolao112-site.vercel.app`;
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

const isPwaStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const isIosDevice = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
  (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

const updatePwaInstallCard = () => {
  const card = document.getElementById('pwaInstallCard');
  const text = document.getElementById('pwaInstallText');
  const button = document.getElementById('btnInstallPwa');

  if (!card || !text || !button) return;

  button.classList.add('hidden');

  if (isPwaStandalone()) {
    text.textContent = 'Você já está usando o Bolão 112 FC como app instalado.';
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
    text.textContent = 'No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.';
    return;
  }

  text.textContent = 'No Chrome, use o menu do navegador e escolha instalar ou adicionar à tela inicial.';
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

const formatUserText = (value = '') => escapeHtml(stripControlChars(String(value || "").normalize("NFC"))).replace(/\n/g, '<br>');

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

// --- NOVA FUNÇÃO DE ORDENAÇÃO (PADRÃO ANDROID) ---
// Regra: 1. Prazo (Crescente) | 2. Criação (Crescente/Antigo 1º) | 3. ID (Fallback)
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

    // 3. ID (Último recurso)
    return a.id.localeCompare(b.id);
};
       // --- ÁUDIO SIMPLES (SOMENTE POP) ---
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
    audio.play().catch(e => console.log("Áudio bloqueado:", e));
  } catch (e) {
    console.log(e);
  }
};
        
        // Garante que o som toque nas funções de voto existentes
        // (Nota: As funções window.vote e window.votePoll já chamam playVoteSound(), 
        // então só precisamos definir ela aqui em cima e tudo volta a funcionar).
        // --- NOVO: FUNÇÃO GERADORA DE AVATAR (DiceBear) ---
        // --- GERADOR DE AVATAR (CORRIGIDO PARA FOTO REAL) ---
        const getAvatarUrl = (base64, name) => {
            // Verifica se existe, se não é texto "null"/"undefined" e se é longo o suficiente para ser imagem
            if (base64 && typeof base64 === 'string' && base64.length > 50 && base64 !== "null" && base64 !== "undefined") {
                // Se já vier com o cabeçalho 'data:image', usa como está. Se não, adiciona.
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

        // --- OTIMIZAÇÃO: ATIVAR CACHE OFFLINE ---
        // Isso faz o site carregar instantaneamente na 2ª visita
        enableIndexedDbPersistence(db).catch((err) => {
            if (err.code == 'failed-precondition') {
                console.log('Muitas abas abertas. O cache funcionará em apenas uma.');
            } else if (err.code == 'unimplemented') {
                console.log('Navegador não suporta persistência.');
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

// fecha modal só quando concluir troca (ou sair)
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
        <div class="text-sm font-black uppercase tracking-wider">Troca de senha obrigatória</div>
        <div class="text-[11px] text-white/90 font-bold mt-1">
          O admin resetou sua senha. Por segurança, você precisa criar uma nova senha agora para que só você saiba.
        </div>
      </div>

<div class="p-4 space-y-3">

  <!-- SENHA ATUAL (TEMPORÁRIA) -->
  <div>
    <label for="forcePwCurrent" class="block text-[11px] font-black text-gray-600 uppercase mb-1">
      Senha atual (temporária)
    </label>

    <div style="position: relative;">
      <input
        id="forcePwCurrent"
        name="currentPassword"
        type="password"
        class="w-full border rounded px-3 py-2 text-sm pr-10"
        placeholder="Digite a senha usada para entrar"
        autocomplete="current-password"
        aria-label="Senha atual (temporária)"
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
        placeholder="Mínimo 6 caracteres"
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
        aria-label="Mostrar/ocultar confirmação"
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

        
  // botão SAIR (única forma de fechar sem trocar)
  document.getElementById("forcePwSignOutBtn").onclick = async () => {
    try { await signOut(auth); } catch(e) {}
    // libera e fecha
    window.__forcePwLock = false;
    window.closeModal();
  };

  // botão SALVAR
  document.getElementById("forcePwSaveBtn").onclick = async () => {
    setForcePwError("");

    const currentPw = (document.getElementById("forcePwCurrent").value || "").trim();
    const newPw = (document.getElementById("forcePwNew").value || "").trim();
    const confirmPw = (document.getElementById("forcePwConfirm").value || "").trim();

    if (!currentPw) return setForcePwError("Digite sua senha atual (temporária).");
    if (!newPw || newPw.length < 6) return setForcePwError("A nova senha deve ter no mínimo 6 caracteres.");
    if (newPw !== confirmPw) return setForcePwError("A confirmação não confere com a nova senha.");

    const btnSave = document.getElementById("forcePwSaveBtn");
    const btnOut = document.getElementById("forcePwSignOutBtn");
    btnSave.disabled = true;
    btnOut.disabled = true;
    btnSave.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> SALVANDO...`;

    try {
      const email = firebaseUser?.email;
      if (!email) throw { code: "missing-email" };

      // 1) Reautenticar com a senha temporária (a usada pra logar)
      const cred = EmailAuthProvider.credential(email, currentPw);
      await reauthenticateWithCredential(firebaseUser, cred);

      // 2) Atualizar senha
      await updatePassword(firebaseUser, newPw);

      // 3) Atualizar Firestore (desliga o gate)
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        forcePasswordChange: false,
        lastPasswordChangedAt: serverTimestamp()
      });

      // (opcional) se você guardar algo no localStorage relacionado a login, limpe aqui
      // localStorage.removeItem("SUA_CHAVE_AQUI");

      // 4) fecha e libera
      window.closeForcePasswordModal();

    } catch (e) {
      console.error("forcePasswordChange error:", e);
      const code = e?.code || "";

      if (code === "auth/wrong-password") setForcePwError("Senha atual incorreta.");
      else if (code === "auth/too-many-requests") setForcePwError("Muitas tentativas. Aguarde e tente novamente.");
      else if (code === "auth/requires-recent-login") setForcePwError("Por segurança, faça login novamente e tente de novo.");
      else if (code === "permission-denied") setForcePwError("Sem permissão no Firestore. Contate o admin.");
      else if (code === "unauthenticated") setForcePwError("Sessão inválida. Faça login novamente.");
      else setForcePwError("Erro ao trocar senha. Tente novamente.");

      btnSave.disabled = false;
      btnOut.disabled = false;
      btnSave.innerHTML = `SALVAR NOVA SENHA`;
    }
  };
};

// listener em tempo real no users/{uid}
window.startForcePasswordWatcher = (firebaseUser) => {
  // derruba listener anterior (se trocar usuário)
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
      // se estava aberto e já foi resolvido, fecha
      if (document.getElementById("forcePwModalRoot")) {
        window.closeForcePasswordModal();
window.continueAfterLoginGates();
      }
    }
  }, (err) => {
    console.error("forcePasswordChange snapshot error:", err);
  });
};


window.currentUid = null;
window.currentUser = null;

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
  if (!officialStartAt) return true; // se não tiver, vale sempre
  const now = Date.now();
  return now >= toMillis(officialStartAt);
};


        // COLETAR ESTE BLOCO AQUI (INÍCIO)
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
      if (t) t.innerText = appConfig.bannerTitle || "EM MANUTENÇÃO";
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

        // COMPRESSÃO
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
                }, 500); // Troca a imagem após 0.5s (metade da transição)
                
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
                // Configura se deve manter logado (Local) ou só na sessão (Session)
                const mode = remember ? browserLocalPersistence : browserSessionPersistence;
                await setPersistence(auth, mode);
                document.getElementById('mainHeader').classList.remove('hidden');

                // Faz o login
                await signInWithEmailAndPassword(auth, `${user}@bolao112.com`, pass);
                
                // O navegador vai perguntar "Salvar Senha?" aqui. 
                // Se o usuário salvar, na próxima vez o FaceID/Digital aparecerá automaticamente ao tocar no campo.
                
            } catch (e) {
                console.error(e);
                alert("Dados incorretos ou erro de conexão.");
                btn.innerHTML = originalText; 
                btn.disabled = false;
            }
        };

// ===============================
// Password Eye Toggle (reutilizável)
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

  // se a função ainda não existe (ordem do arquivo), tenta de novo daqui a pouco
  if (typeof window.attachPasswordEye !== "function") {
    setTimeout(window.setupLoginPasswordEye, 50);
    return;
  }

  // evita duplicar
  if (document.getElementById("loginEyeBtn")) {
    // garante que o toggle está ligado
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



// --- RECUPERAÇÃO DE SENHA (WEB) ---
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
          Escolha uma das opções abaixo:
        </p>

        <div class="bg-gray-50 border rounded-lg p-3 text-left mb-4">
          <p class="text-[10px] text-gray-500 font-black uppercase">Seu usuário (login)</p>
          <input
            type="text"
            id="recoverUser"
            value="${typedUser}"
            placeholder="Ex: joaosilva"
            class="w-full mt-2 p-3 bg-white border rounded-lg text-sm outline-none focus:border-[#006400] text-center font-bold"
          />
          <p class="text-[10px] text-gray-400 font-bold mt-2">
            Dica: seu usuário é o que você usa para entrar (sem espaços).
          </p>
        </div>

        <!-- Resultado da dica -->
        <div id="hintResultArea" class="hidden mb-4 p-3 bg-orange-50 border border-orange-200 rounded">
          <p class="text-[10px] text-orange-600 font-bold uppercase">💡 SUA DICA:</p>
          <p id="hintTextDisplay" class="text-sm font-black text-black mt-1"></p>
        </div>

        <p id="recoverMsg" class="text-xs text-red-500 font-bold mt-2"></p>

        <!-- Ações -->
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
          Se o admin resetar sua senha, ao entrar novamente você será obrigado(a) a criar uma nova senha.
        </p>
      </div>
    </div>
  `);

  // 1) BOTÃO: buscar dica
  document.getElementById('btnSearchHint').onclick = async () => {
    const user = (document.getElementById('recoverUser').value || "").trim().toLowerCase();
    const msg = document.getElementById('recoverMsg');
    const area = document.getElementById('hintResultArea');

    msg.innerText = "";
    area.classList.add('hidden');

    if (!user) {
      msg.innerText = "Digite seu usuário para buscar a dica.";
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
          msg.innerText = "Você não cadastrou dica. Use a opção de avisar o admin.";
        }
      } else {
        msg.innerText = "Usuário não encontrado. Confira se digitou corretamente.";
      }
    } catch (e) {
      console.error(e);
      msg.innerText = "Erro ao buscar a dica. Tente novamente.";
    }
  };

  // 2) BOTÃO: avisar admin no WhatsApp (não abre automaticamente ao clicar em 'Esqueci')
  document.getElementById('btnAskAdminReset').onclick = () => {
    const user = (document.getElementById('recoverUser').value || "").trim().toLowerCase();
    const when = new Date().toLocaleString('pt-BR');

    const phone = "5585988837389"; // Lincoln - 85988837389
    const msg = user
      ? `Olá Lincoln! Preciso que você resete minha senha no Bolão 112 FC.\n\nUsuário: ${user}\nData/Hora: ${when}\n\n(Enviado pela versão WEB)`
      : `Olá Lincoln! Preciso que você resete minha senha no Bolão 112 FC.\n\nNão lembro meu usuário.\nData/Hora: ${when}\n\n(Enviado pela versão WEB)`;

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
                <input type="text" id="regName" placeholder="Ex: João da Silva" class="w-full p-3 bg-gray-50 border rounded-lg mb-3 text-sm outline-none focus:border-[#006400]">
                
                <label class="block text-xs font-bold text-gray-500 mb-1">Usuário (Login)</label>
                <input type="text" id="regUser" placeholder="Ex: joaosilva (sem espaços)" class="w-full p-3 bg-gray-50 border rounded-lg mb-3 text-sm outline-none focus:border-[#006400]">
                
                <label class="block text-xs font-bold text-gray-500 mb-1">Dica de Senha (Opcional)</label>
                <input type="text" id="regHint" placeholder="Ex: Nome do meu cachorro" class="w-full p-3 bg-gray-50 border rounded-lg mb-3 text-sm outline-none focus:border-[#006400]">
                
                <label class="block text-xs font-bold text-gray-500 mb-1">Senha</label>
                <input type="password" id="regPass" placeholder="Mínimo 6 caracteres" class="w-full p-3 bg-gray-50 border rounded-lg mb-6 text-sm outline-none focus:border-[#006400]">
                
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
                alert("O usuário não pode conter espaços.");
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

                // SE NÃO TIVER CONVITE: OFERECE O TESTE GRÁTIS
                if (!whitelistSnap.exists()) {
                    const aceitaTeste = confirm("Convite oficial não encontrado.\n\nDeseja criar uma conta de TESTE GRÁTIS por 7 dias?");
                    
                    if (!aceitaTeste) {
                        btn.innerText = originalText;
                        btn.disabled = false;
                        return; // Usuário desistiu
                    }

                    // Configura modo Trial
                    isTrial = true;
                    finalName = `${name} (Teste ⏳)`; // Adiciona identificação no nome
                    
                    // Calcula data de expiração (Hoje + 7 dias)
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
                    alert(`Conta de Teste Criada!\n\nVocê tem acesso liberado até ${trialDate.toLocaleDateString()}.\nPara continuar depois disso, regularize sua mensalidade.`);
                } else {
                    alert("Conta oficial criada com sucesso! Bem-vindo(a).");
                }
                
                closeModal();

            } catch (e) {
                console.error(e);
                let msg = "Erro ao criar conta.";
                if (e.code === 'auth/email-already-in-use') msg = "Este usuário já existe.";
                alert(msg);
                btn.innerText = originalText;
                btn.disabled = false;
            }
        };
         };  

// ===============================
// CENTRAL: decide gates pós-login (Force PW -> Rules Gate -> App)
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
    // fallback seguro: mostra app mínimo mas sem liberar navegação
    document.getElementById('mainHeader').classList.remove('hidden');
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainScreens').classList.remove('hidden');
    document.getElementById('bottomNav').classList.add('hidden');
    document.getElementById('btnLogout').classList.remove('hidden');
    alert("Erro ao carregar seus dados. Verifique sua conexão.");
    return;
  }

  const userData = userSnap.exists() ? userSnap.data() : null;

  if (userData && userData.isActive === false) {
    alert("Seu acesso foi desativado. Fale com o administrador.");
    try { await signOut(auth); } catch(e) {}
    return;
  }

  // 1) FORCE PASSWORD CHANGE (prioridade máxima)
  if (userData && userData.forcePasswordChange === true) {
    // Estrutura mínima (sem liberar menu)
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
                // --- TRAVA DE SEGURANÇA E TRIAL (NOVO) ---
                const userDocRef = doc(db, "users", user.uid);
                const userSnap = await getDoc(userDocRef);

                if (userSnap.exists()) {
                    const data = userSnap.data();

                    if (data.isActive === false) {
                        alert("Seu acesso foi desativado. Fale com o administrador.");
                        signOut(auth);
                        return;
                    }
                    
                    // Verifica se é TRIAL VENCIDO
                    if (data.isTrial === true && data.trialValidUntil) {
                        const now = new Date();
                        const validUntil = data.trialValidUntil.toDate(); // Converte do Firestore

                        // Se HOJE é maior que a validade
                        if (now > validUntil) {
                            // Verifica se pagou o mês atual (Salvação)
                            const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                            const currentMonth = months[now.getMonth()];
                            const isPaid = data.payments && data.payments[currentMonth] === true;

                            if (!isPaid) {
                                alert(`🚫 PERÍODO DE TESTE EXPIRADO!\n\nSua conta de teste venceu em ${validUntil.toLocaleDateString()}.\n\nPara continuar jogando e recuperar seu acesso, realize o pagamento da mensalidade com o Admin.`);
                                signOut(auth); // Chuta o usuário para fora
                                return;
                            } else {
                                // Se pagou, remove o status de Trial automaticamente (Promoção para Oficial)
                                await updateDoc(userDocRef, { isTrial: false, name: data.name.replace(" (Teste ⏳)", "") });
                                alert("Parabéns! Sua mensalidade foi confirmada e sua conta agora é OFICIAL! 🚀");
                                location.reload(); // Recarrega para limpar o nome
                                return;
                            }
                        }
                    }

                    // ATUALIZANDO VERSÃO
try { await updateDoc(userDocRef, { appVersion: getAppVersionLabel(), lastAccess: new Date() }); } catch(e) {}

// ✅ NOVO: inicia o gate de troca de senha obrigatória (Android parity)
window.startForcePasswordWatcher(user);
                }
                // ------------------------------------------

                // define currentUser/uid (global e window)
currentUser = user;
window.currentUser = user;
window.currentUid = user.uid;

// userData (do seu userSnap que você já buscou lá em cima)
const userData = userSnap.exists() ? userSnap.data() : null;

// ✅ Entra pelo funil único (Force PW -> Rules Gate -> App)
window.continueAfterLoginGates();

            } else {
                window.currentUser = null;
window.currentUid = null;
currentUser = null;
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
// finaliza a entrada no app (chamar só quando estiver liberado)
window.finalizeAppEntryAfterLogin = () => {
  setHomeMode(false);
  document.getElementById('mainHeader').classList.remove('hidden');
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('mainScreens').classList.remove('hidden');
  document.getElementById('bottomNav').classList.remove('hidden');
  document.getElementById('btnLogout').classList.remove('hidden');

  startWebAdminSync();
  applyRemoteBackgrounds();

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


  // Esconde todas e “desativa” no menu
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

  // Chamadas de carregamento por aba (só se existirem)
  if (tab === 'matches' && typeof loadMatches === 'function') loadMatches();
if (tab === 'ranking' && typeof loadRanking === 'function') loadRanking();
if (tab === 'rules' && typeof renderRules === 'function') renderRules();
if (tab === 'profile' && typeof loadProfile === 'function') loadProfile();

if (tab === 'ranking') {
  const rankingListContent = document.getElementById('rankingListContent');
  if (rankingListContent) rankingListContent.scrollTop = 0;
}

};
      

        // --- NOVA LÓGICA DE REGRAS (COM CABEÇALHO E DATA) ---
        
        // Cache guarda objeto completo agora: { items: [], dateDisplay: "...", version: "...", updatedAt: Date|null, officialStartAt: Date|null }
let cachedRulesData = null;

async function renderRules(forceRefresh = false) {
  const list = document.getElementById('rulesList');

  // Se já tem conteúdo renderizado visualmente, não faz nada (exceto se pedir refresh)
  if (!forceRefresh && list && list.children.length > 0) return;

  // Mostra Loading
  if (list) {
    list.innerHTML = `<div class="text-center p-6"><i class="fas fa-circle-notch fa-spin text-[#006400] text-2xl"></i><p class="text-xs text-gray-500 mt-2">Buscando atualizações...</p></div>`;
  }

  try {
    // Se não temos cache ou pedimos refresh, buscamos no Firebase
    if (!cachedRulesData || forceRefresh) {
      const docRef = doc(db, "settings", "rules");
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const d = snap.data();

        // Formata a data de atualização
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
        list.innerHTML = `<div class="text-center p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-xs">O regulamento está sendo atualizado pelo Administrador.</div>`;
      }
      return;
    }

    // 1. Gera o HTML do Cabeçalho
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
                   Versão: <span class="text-black">${cachedRulesData.version}</span>
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
      list.innerHTML = `<div class="text-center text-red-500 text-xs p-4">Erro ao carregar o regulamento.<br>Verifique sua conexão.</div>`;
    }
  }
}


        const SectionHeader = (title, color) => `<div class="card-container mb-3"><div class="bg-white/90 border border-[${color}] rounded-tl-2xl rounded-br-2xl p-2 text-center shadow-sm"><h4 class="font-bold text-[${color}] uppercase tracking-wider text-xs" style="color: ${color};">${title}</h4></div></div>`;

// --- FUNÇÃO SINO INTELIGENTE (LISTA ONDE TEM MENSAGEM) ---
          // --- FUNÇÃO SINO: SEM ALERT E COM LAYOUT CORRIGIDO ---
        // --- FUNÇÃO SINO: SEM ALERT E COM LAYOUT CORRIGIDO ---
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
                            <span class="text-xs font-bold text-gray-700">💬 ⚽ ${escapeHtml(game.title)}</span>
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
// --- CORREÇÃO DE IMAGENS DO GOOGLE DRIVE ---
        const fixDriveUrl = (url) => {
            if (!url) return "";
            if (url.includes("drive.google.com") && url.includes("id=")) {
                const match = url.match(/id=([a-zA-Z0-9_-]+)/);
                if (match && match[1]) {
                    // Usa o domínio lh3 que é mais permissivo para imagens
                    return `https://lh3.googleusercontent.com/d/${match[1]}`;
                }
            }
            return url;
        };
     // 2. Renderiza Banner (Correção de Link e Tamanho)
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

        // 3. Renderiza Enquete (Correção de Clique)
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
        ${totalVotes} votos • ${isExpired ? "Finalizada" : "Toque na opção para votar"}
      </div>
    </div>
  `;
};

window.votePoll = async (pid, idx) => {
  if (!currentUser) {
    alert("Faça login para votar.");
    return;
  }

  try {
    const ref = doc(db, "polls", pid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      alert("Enquete não encontrada.");
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

        // --- FUNÇÃO DE NOTÍCIAS (COM LINHA DO TEMPO) ---
       const generateNewsFeed = (newsSnap, guessesData, finishedMatches, users, expiredMatches = []) => {
            let segments = [];
            const addSegment = (text, color) => segments.push(`<span style="color: ${color}; font-weight: 900; margin: 0 10px;">${text}</span>`);
            
            // --- 1. ENGINE (Lógica Android: Timeline + Zebra Ajustada) ---
            let rankingSnapshot = [];

            if (users.length > 0) {
                // Prepara usuários com data (Verifica se é Timestamp ou Date)
                const usersWithDate = users.map(u => {
                    let cDate = new Date(0);
                    if (u.createdAt) {
                        // Se tiver .toDate é Firebase, senão já é Data normal
                        cDate = (typeof u.createdAt.toDate === 'function') ? u.createdAt.toDate() : u.createdAt;
                    }
                    return { ...u, createdDate: cDate };
                });

                // Zebra: Calcula com base apenas nos usuários VÁLIDOS na data
                const zebraMatchIds = [];
                finishedMatches.forEach(m => {
                    const validUsersCount = usersWithDate.filter(u => u.createdDate < m.deadlineDate).length;
                    const hits = guessesData.filter(g => g.matchId === m.id && g.teamSelected === m.winner).length;
                    
                    // Lógica <= 0.20
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
                        // FILTRO LINHA DO TEMPO: Ignora se jogo foi antes do usuário nascer
                        if (u.createdDate > m.deadlineDate) return;

                        const g = userGuesses.find(x => x.matchId === m.id);
                        const isHit = g && g.teamSelected === m.winner;

                        if (isHit) {
                            pts += (m.round && m.round.toLowerCase() === 'final') ? 6 : 3;
                            victories++; simStreak++;
                            if (m.round && m.round.toLowerCase() === 'final') finalsWon++;
                            if (simStreak === 3) userMedals.push("🔥");
                            if (simStreak === 5) userMedals.push("🎯");
                            if (simStreak === 10) userMedals.push("👽");
                            if (zebraMatchIds.includes(m.id)) userMedals.push("🦓");
                        } else { simStreak = 0; }
                    });

                    // Diamante (Oitavas)
                    const oitavas = matchesChronological.filter(m => m.round === "Oitavas de final");
                    const byComp = {}; oitavas.forEach(m => { if(!byComp[m.competition]) byComp[m.competition]=[]; byComp[m.competition].push(m); });
                    for(const k in byComp) {
                        if(byComp[k].length === 8) {
                            const hits = byComp[k].filter(m => userGuesses.find(g=>g.matchId===m.id && g.teamSelected===m.winner)).length;
                            if(hits === 8) { pts += 3; userMedals.push("💎"); }
                        }
                    }
// --- MEDALHA FANTASMA 👻 (Lógica de Sequência Inversa com ID) ---
                let ghostStreak = 0;
                // Pega jogos expirados onde o usuário JÁ EXISTIA
                // Ordena: Data Decrescente (Mais novo 1º) -> Desempate: ID Decrescente (Z->A)
                // Isso garante que a verificação siga a ordem exata de processamento reverso
                const validExpiredDesc = expiredMatches
                    .filter(m => u.createdDate < m.deadlineDate)
                    .sort((a,b) => matchComparator(b, a)); // Inverso

                for (const m of validExpiredDesc) {
                    const hasVote = userGuesses.some(g => g.matchId === m.id);
                    if (!hasVote) {
                        ghostStreak++;
                    } else {
                        break; // Votou neste, quebra a sequência imediatamente
                    }
                }
                
                if (ghostStreak >= 3) {
                // CORREÇÃO: Usa addSegment para aparecer no letreiro
                addSegment(`👻 ${u.name.toUpperCase()} VIROU FANTASMA! NÃO VOTA HÁ ${ghostStreak} JOGOS!`, "#9E9E9E");
            }

                // --- MEDALHA MÃO DE ALFACE 🥬 (Mesma Lógica Inversa) ---
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
                        break; // Ausência conta como fantasma, interrompe alface
                    }
                }
                
                if (lettuceStreak >= 3) {
                // CORREÇÃO:
                addSegment(`🥬 ${u.name.toUpperCase()} TÁ COM MÃO DE ALFACE! ERROU ${lettuceStreak} SEGUIDOS!`, "#EF5350");
            }
                    if (finalsWon > 0) userMedals.push("🔮");
                    if (victories >= 50) { const qtd = Math.floor(victories / 50); for(let i=0; i<qtd; i++) userMedals.push("🎓"); }

                    const debts = u.debts || 0;
                    pts -= (debts * 3);

                    return {
                        uid: u.id,
                        name: (u.name || u.username || "SemNome").split(" ")[0].toUpperCase(),
                        pts, debts, victories, userMedals,
                        createdDate: u.createdDate // Passa adiante para o filtro de Dorminhoco
                    };
                }).filter(u => u !== null);

                // Ordenação (Mantida)
                rankingSnapshot.sort((a, b) => {
                    if (b.pts !== a.pts) return b.pts - a.pts;
                    if (a.debts !== b.debts) return a.debts - b.debts;
                    const c = (user, i) => user.userMedals.filter(m => m === i).length;
                    let diff;
                    diff = c(b,"👽")-c(a,"👽"); if(diff) return diff;
                    diff = c(b,"💎")-c(a,"💎"); if(diff) return diff;
                    diff = c(b,"👑")-c(a,"👑"); if(diff) return diff;
                    diff = c(b,"🎯")-c(a,"🎯"); if(diff) return diff;
                    diff = c(b,"🦓")-c(a,"🦓"); if(diff) return diff;
                    diff = c(b,"🔥")-c(a,"🔥"); if(diff) return diff;
                    diff = c(b,"🔮")-c(a,"🔮"); if(diff) return diff;
                    diff = c(b,"🎓")-c(a,"🎓"); if(diff) return diff;
                    return 0;
                });
            }

            // --- 2. GERAÇÃO DE FRASES ---
            if (finishedMatches.length > 0 && rankingSnapshot.length > 0) {
                const lider = rankingSnapshot[0];
                const lanterna = rankingSnapshot[rankingSnapshot.length - 1];

                addSegment(`👑 SEGUE O LÍDER! O ${lider.name} TÁ TRANQUILO COM SEUS ${lider.pts} PTS!`, "#FFD700");
                if (rankingSnapshot.length >= 2) addSegment(`🥈 O ${rankingSnapshot[1].name} TÁ NA COLA DO LÍDER!`, "#C0C0C0");
                if (rankingSnapshot.length >= 3) addSegment(`🥉 ${rankingSnapshot[2].name} FECHA O PÓDIO!`, "#CD7F32");
                if (rankingSnapshot.length >= 4) addSegment(`👀 OLHO NO ${rankingSnapshot[3].name}! TÁ CHEGANDO!`, "#4FC3F7");
                
                if (rankingSnapshot.length >= 6) { 
                    const idxPorteiro = rankingSnapshot.length - 5; 
                    if(idxPorteiro >= 0) addSegment(`⚓ CUIDADO ${rankingSnapshot[idxPorteiro].name}! O Z-4 TÁ TE PUXANDO!`, "#FF6D00");
                }
                if (rankingSnapshot.length > 1) addSegment(`🔦 ALÔ ${lanterna.name}! CANSOU DE SEGURAR A LANTERNA NÃO?`, "#FF5252");

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
                        if (streak >= 10) addSegment(`👽 ${u.name} É DE OUTRO MUNDO (${streak} ACERTOS)!`, "#64DD17");
                        else if (streak >= 5) addSegment(`🎯 ${u.name} VIROU MITO! (${streak} ACERTOS)`, "#FFD700");
                        else if (streak >= 3) addSegment(`🔥 ${u.name} TÁ ON FIRE! (${streak} ACERTOS)`, "#00E676");
                    } else if (streak >= 3) addSegment(`🥬 ${u.name} TÁ COM MÃO DE ALFACE! (${streak} ERROS)`, "#FF5252");

                    // Dorminhoco (Ignora se o usuário é mais novo que o último jogo)
                    if (recent10.length > 0) {
                        const lastM = recent10[0];
                        if (u.createdDate < lastM.deadlineDate) {
                            const voted = guessesData.some(x => x.userId === u.uid && x.matchId === lastM.id);
                            if (!voted) addSegment(`💤 O BURRÃO DO ${u.name} NÃO VOTOU NO ÚLTIMO CONFRONTO!`, "#9E9E9E");
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
            if (segments.length === 0) addSegment("⚽ BEM-VINDO AO BOLÃO 112 F.C! FAÇA SEU PALPITE!", "#FFD700");
            return segments.join(' | ') + " | " + segments.join(' | ');
        };

const DEFAULT_HOME_LAYOUT_ORDER = ["ticker", "fast_vote", "matches_open", "matches_wait", "matches_done"];

const toJsDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  return null;
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

const renderHomeQuickPanel = ({ runtime, open, waiting, finished, myVotesMap }) => {
  const currentName = runtime.currentUser?.name || runtime.currentUser?.username || "Jogador";
  const nextMatch = open[0] || waiting[0] || finished[0] || null;
  const nextLabel = open.length
    ? "Próximo jogo"
    : waiting.length
      ? "Aguardando resultado"
      : "Painel rápido";

  const nextDescription = nextMatch
    ? `${escapeHtml(nextMatch.teamA)} x ${escapeHtml(nextMatch.teamB)}`
    : "Sem confronto aberto no momento.";

  const nextMeta = nextMatch?.deadlineDate
    ? `Prazo: ${nextMatch.deadlineDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${nextMatch.deadlineDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
    : "Use os atalhos abaixo para navegar.";

  const pendingCount = open.filter((m) => !myVotesMap[m.id]).length;

  return `
    <section class="home-quick-panel surface-card mb-4 overflow-hidden">
      <div class="home-quick-panel__top">
        <div>
          <p class="home-quick-panel__eyebrow">Bem-vindo, ${escapeHtml(currentName)}</p>
          <h3 class="home-quick-panel__title">Seu painel rápido</h3>
        </div>
        <span class="status-chip status-chip--success">Ao vivo</span>
      </div>

      <div class="home-quick-panel__hero">
        <div class="home-quick-panel__hero-label">${escapeHtml(nextLabel)}</div>
        <div class="home-quick-panel__hero-title">${nextDescription}</div>
        <div class="home-quick-panel__hero-meta">${escapeHtml(nextMeta)}</div>
      </div>

      <div class="home-quick-stats">
        <div class="home-quick-stat">
          <span class="home-quick-stat__value">${pendingCount}</span>
          <span class="home-quick-stat__label">palpites pendentes</span>
        </div>
        <div class="home-quick-stat">
          <span class="home-quick-stat__value">${open.length}</span>
          <span class="home-quick-stat__label">jogos abertos</span>
        </div>
        <div class="home-quick-stat">
          <span class="home-quick-stat__value">${finished.length}</span>
          <span class="home-quick-stat__label">finalizados</span>
        </div>
      </div>

      <div class="home-quick-actions">
        <button type="button" class="home-quick-action btn-press" onclick="showTab('matches')">
          <i class="fas fa-futbol"></i>
          <span>Palpites</span>
        </button>
        <button type="button" class="home-quick-action btn-press" onclick="showTab('ranking')">
          <i class="fas fa-trophy"></i>
          <span>Ranking</span>
        </button>
        <button type="button" class="home-quick-action btn-press" onclick="showTab('ranking'); setTimeout(() => { if (window.openRankingInfo) window.openRankingInfo(); }, 180)">
          <i class="fas fa-crown"></i>
          <span>Rei do Mês</span>
        </button>
        <button type="button" class="home-quick-action btn-press" onclick="showTab('profile')">
          <i class="fas fa-user"></i>
          <span>Perfil</span>
        </button>
      </div>
    </section>
  `;
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
  const currentUserData = allUsersData.find(u => u.uid === currentUser?.uid) || null;

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
  const chevron = isCollapsed ? "▾" : "▴";

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
      <h3 class="text-base font-black text-[#006400] mb-2">⚡ VOTO RÁPIDO (${pendingOpenMatches.length})</h3>
      ${await renderMatchList(pendingOpenMatches, allUsersData, globalServerCounts, myVotesMap)}
    </div>
  `;
};

const renderMatchesOpenBlock = async (open, allUsersData, myVotesMap) => {
  const contentHtml = await renderMatchList(open, allUsersData, globalServerCounts, myVotesMap);

  return renderCollapsibleSection({
    sectionKey: "matches_open",
    title: "✅ DISPONÍVEIS",
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
    title: "⏳ AGUARDANDO",
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
    title: "🏁 FINALIZADOS",
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

const buildMatchesCriticalData = ({ setSnap, matchesSnap, guessesSnap, uSnap, commentsSnap }) => {
  compMap = {};
  if (setSnap.exists()) {
    const items = Array.isArray(setSnap.data().items) ? setSnap.data().items : [];
    items.forEach((item) => {
      if (item?.name) compMap[item.name] = item.logo || "";
    });
  }

  const allUsersData = [];
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
      guessesSnap,
      uSnap,
      commentsSnap
    ] = await Promise.all([
      readWithRuntimeCache("doc:settings:competitions", () => getDoc(doc(db, "settings", "competitions")), { ttlMs: DATA_CACHE_TTL.cold, force }),
      readWithRuntimeCache("col:matches", () => getDocs(collection(db, "matches")), { ttlMs: DATA_CACHE_TTL.hot, force }),
      readWithRuntimeCache("col:guesses", () => getDocs(collection(db, "guesses")), { ttlMs: DATA_CACHE_TTL.hot, force }),
      readWithRuntimeCache("col:users", () => getDocs(collection(db, "users")), { ttlMs: DATA_CACHE_TTL.warm, force }),
      readWithRuntimeCache("col:match_comments", () => getDocs(collection(db, "match_comments")), { ttlMs: DATA_CACHE_TTL.hot, force })
    ]);

    if (requestId !== matchesLoadRequestSeq) return;

    const criticalData = buildMatchesCriticalData({
      setSnap,
      matchesSnap,
      guessesSnap,
      uSnap,
      commentsSnap
    });

    const initialState = buildInitialMatchesScreenState(criticalData);
    window.__matchesScreenStateCache = initialState;
    await renderMatchesScreenFromState(initialState);
    progressBar?.classList.add("hidden");

    try {
      const [newsSnap, layoutSnap, bannersSnap, pollsSnap] = await Promise.all([
        readWithRuntimeCache("doc:settings:news", () => getDoc(doc(db, "settings", "news")), { ttlMs: DATA_CACHE_TTL.warm, force }),
        readWithRuntimeCache("doc:settings:home_layout", () => getDoc(doc(db, "settings", "home_layout")), { ttlMs: DATA_CACHE_TTL.warm, force }),
        readWithRuntimeCache("col:banners", () => getDocs(collection(db, "banners")), { ttlMs: DATA_CACHE_TTL.warm, force }),
        readWithRuntimeCache("col:polls", () => getDocs(collection(db, "polls")), { ttlMs: DATA_CACHE_TTL.hot, force })
      ]);

      if (requestId !== matchesLoadRequestSeq) return;

      const finalState = buildFinalMatchesScreenState(criticalData, {
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

        // --- RENDERIZA LISTA DE JOGOS (COM DATA NO BOTÃO DE VOTANTES) ---
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
                
                // --- CÁLCULO CIRÚRGICO DO TERMÔMETRO ---
                // Conta apenas usuários que existiam ANTES do prazo do jogo
                const validCount = usersList.filter(u => (u.createdDate || u.createdAt || new Date(0)) < m.deadlineDate).length;
                // Garante que o total seja pelo menos 1 ou o número de votos (segurança contra inconsistência)
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
                    thermoHtml = `<div class="mt-3 pt-2 border-t border-gray-100"><div class="flex justify-between text-[9px] font-bold mb-1"><span class="text-green-700">${pctA}%</span><span class="text-gray-400 text-[8px]">TERMÔMETRO (CINZA = NÃO VOTOU)</span><span class="text-red-700">${pctB}%</span></div><div class="w-full h-2.5 bg-gray-200 rounded-full flex overflow-hidden"><div style="flex: ${votesA}" class="bg-green-700 h-full border-r border-white/50"></div><div style="flex: ${absReal}" class="bg-gray-300 h-full border-r border-white/50"></div><div style="flex: ${votesB}" class="bg-red-700 h-full"></div></div><div class="flex justify-between text-[8px] text-gray-400 mt-1"><span>${m.teamA}: ${votesA}</span>${absReal > 0 ? `<span>Faltosos: ${absReal}</span>` : ''}<span>${m.teamB}: ${votesB}</span></div></div>`; 
                }

                html += `<div class="match-card-shell card-cut relative border-l-[6px] mb-6 overflow-hidden" style="${cardStyle}">
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
                                        <button onclick="openMatchComments('${m.id}', '${m.teamA}', '${m.teamB}', '${m.winner||''}')" class="match-action-btn text-gray-500 hover:text-[#006400] transition-colors relative">
                                            <i class="fas fa-comment-dots text-xl"></i>${chatBadge}
                                        </button>
                                        <button onclick="openVoters('${m.id}', '${m.teamA}', '${m.teamB}', '${m.teamAUrl}', '${m.teamBUrl}', ${m.expired}, '${m.winner||''}', '${dl.toISOString()}')" class="match-action-btn text-[#006400] hover:scale-110 transition-transform">
                                            <i class="fas ${m.expired ? 'fa-eye' : 'fa-users'} text-xl"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <div class="flex items-center justify-between px-1">
                                    ${createTeamBtn(m.id, m.teamA, m.teamAUrl, userVote===m.teamA, m.expired)}
                                    <span class="match-versus">X</span>
                                    ${createTeamBtn(m.id, m.teamB, m.teamBUrl, userVote===m.teamB, m.expired)}
                                </div>
                                
                                ${m.winner ? `<div class="mt-3 text-center border-t pt-2"><span class="text-[10px] font-bold text-gray-400">VENCEDOR</span><p class="match-winner-name">${escapeHtml(m.winner)}</p></div>` : ''}
                                ${thermoHtml}
                            </div>
                        </div>`;
            } 
            return html;
        }

        // --- FUNÇÕES DE VOTO OTIMIZADAS (SEM LAG) ---
        
        function createTeamBtn(mid, name, url, selected, expired) { 
            // Limpa o nome para criar um ID válido
            const safeName = name.replace(/[^a-zA-Z0-9]/g, '');
            const btnId = `btn-${mid}-${safeName}`;
            
            const bg = selected ? 'bg-[#006400] text-white' : 'bg-[#EEEEEE] text-gray-800'; 
            const border = selected ? 'border-2 border-[#FFD700]' : ''; 
            
            // LÓGICA DE CORREÇÃO DE IMAGEM
            // Verifica se a URL existe e não é "false" ou "null"
            const hasImage = url && url !== "false" && url !== "null" && url.trim() !== "";
            
            const iconHtml = hasImage 
                ? `<img src="${url}" class="w-10 h-10 object-contain mb-1" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
                   <i class="fas fa-shield-alt text-2xl mb-1 text-gray-400 hidden"></i>` 
                : `<i class="fas fa-shield-alt text-2xl mb-1 text-gray-400"></i>`;

            // CORREÇÃO DO CLICK: Adicionado window.vote
            return `<button id="${btnId}" onclick="window.vote('${mid}', '${name}', '${btnId}')" ${expired?'disabled':''} class="match-btn-${mid} btn-press flex flex-col items-center justify-center w-[40%] h-24 rounded-lg transition-all ${bg} ${border} ${expired?'opacity-80':''}">
                ${iconHtml}
                <span class="match-team-name text-center leading-tight px-1 line-clamp-2">${name}</span>
            </button>`; 
        }
        window.vote = async (mid, team, btnId) => { 
            if(!currentUser) return; 

            // --- TRAVA DE SEGURANÇA (NOVO) ---
            // Verifica se o usuário realmente existe no banco antes de aceitar o voto
            const userRef = doc(db, "users", currentUser.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                alert("Sessão inválida ou duplicada.\n\nVocê será desconectado para corrigir seu cadastro. Por favor, faça login novamente.");
                await signOut(auth);
                location.reload();
                return;
            }
            // ----------------------------------
            
            // 1. ATUALIZAÇÃO VISUAL IMEDIATA (Otimista)
            const buttons = document.getElementsByClassName(`match-btn-${mid}`);
            for (let btn of buttons) {
                btn.className = `match-btn-${mid} btn-press flex flex-col items-center justify-center w-[40%] h-24 rounded-lg transition-all bg-[#EEEEEE] text-gray-800`;
            }

            const clickedBtn = document.getElementById(btnId);
            if(clickedBtn) {
                clickedBtn.className = `match-btn-${mid} btn-press flex flex-col items-center justify-center w-[40%] h-24 rounded-lg transition-all bg-[#006400] text-white border-2 border-[#FFD700]`;
            }
playVoteSound();
            // 2. SALVA NO BANCO
            await setDoc(doc(db, "guesses", `${mid}_${currentUser.uid}`), {
  matchId: mid,
  userId: currentUser.uid,
  teamSelected: team,
  timestamp: new Date()
});

invalidateHomeRankingCaches();
        };
        
       // --- FUNÇÃO QUEM VOTOU / QUEM FALTA (CORRIGIDA COM FILTRO DE DATA) ---
        // Recebe deadlineIso como último argumento
        window.openVoters = async (matchId, ta, tb, taUrl, tbUrl, isExpired, winner, deadlineIso) => {
            const container = document.getElementById('modalContainer');
            document.getElementById('modalOverlay').classList.remove('hidden');
            
            container.innerHTML = `
                <div class="bg-white rounded-lg p-6 shadow-xl relative w-80 text-center">
                    <i class="fas fa-circle-notch fa-spin text-2xl text-[#006400] mb-4"></i>
                    <p class="font-bold text-gray-500">Analisando lista de presença...</p>
                </div>`;

            try {
                // Converte a data do prazo para objeto Date
                const matchDeadline = new Date(deadlineIso);

                // 1. Busca Usuários e Palpites
                const [uSnap, gSnap] = await Promise.all([
                    getDocs(collection(db, "users")),
                    getDocs(query(collection(db, "guesses"), where("matchId", "==", matchId)))
                ]);

                // 2. Mapeia Usuários (Com Data de Criação)
                const userMap = {};
                const allUsers = [];
                
                uSnap.forEach(doc => {
                    const d = doc.data();
                   // --- CORREÇÃO CRÍTICA AQUI ---
                    // Se não tiver data, assume AGORA (new Date()), para não aparecer em jogos velhos.
                    // Antes estava new Date(0) [1970], o que causava o bug.
                    const created = d.createdAt ? d.createdAt.toDate() : new Date();
                    
                    const u = { 
                        id: doc.id, 
                        name: d.name || "Anônimo", 
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
                // AQUI ESTÁ A CORREÇÃO: Só entra na lista se criado ANTES do jogo
                const missingList = allUsers.filter(u => {
                    // Se já votou, não é faltoso
                    if (votedIds.has(u.id)) return false;
                    
                    // Se entrou DEPOIS do jogo, não é faltoso (ignora)
                    if (u.createdAt > matchDeadline) return false;

                    // Caso contrário, é faltoso
                    return true;
                });

                // Ordenação
                if(winner) {
                    votersList.sort((a,b) => (b.isWinner === a.isWinner) ? a.name.localeCompare(b.name) : (b.isWinner ? 1 : -1));
                } else {
                    votersList.sort((a,b) => a.name.localeCompare(b.name));
                }
                missingList.sort((a,b) => a.name.localeCompare(b.name));

                // Renderiza HTML dos Votantes
                let listHtml = "";
                if(votersList.length === 0) listHtml = `<p class="text-center text-gray-400 text-xs py-2">Ninguém votou ainda.</p>`;
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
                    const titleMissing = isExpired ? "😡 NÃO VOTARAM (MÃO DE ALFACE)" : "⏳ FALTA VOTAR";
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
                const title = isExpired ? "PALPITES REGISTRADOS" : "QUEM JÁ VOTOU?";
                container.innerHTML = `
                <div class="w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden relative" style="max-height: 80vh; display:flex; flex-direction:column;">
                    <img src="bg_dialog_votantes.jpeg" class="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none z-0">
                    <div class="p-4 border-b border-gray-200 bg-gray-50/95 text-center relative z-10 backdrop-blur-sm">
                        <h3 class="font-black text-[#006400] text-lg uppercase tracking-wide">${title}</h3>
                        ${!isExpired ? '<p class="text-[10px] text-gray-500 font-bold mt-1">Os palpites são revelados após o prazo.</p>' : ''}
                    </div>
                    <div class="p-4 overflow-y-auto relative z-10 flex-1">
                        ${listHtml}
                        ${missingHtml}
                    </div>
                    <div class="p-4 bg-gray-50/95 border-t border-gray-200 z-10 backdrop-blur-sm">
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
              // Se veio do extrato, habilita o botão VOLTAR
const backBtn = document.getElementById('btnBackToHistory');
if (backBtn) {
  backBtn.onclick = () => {
    const idx = window.__returnToHistoryIdx;
    window.__returnToHistoryIdx = null; // limpa retorno (evita voltar infinito)
    closeModal(); // fecha lista de palpites
    if (typeof window.showModalHistory === 'function' && typeof idx === 'number') {
      window.showModalHistory(idx); // reabre extrato do mesmo usuário
    }
  };
}
  
        };
// --- IR PARA "PALPITES REGISTRADOS" PELO EXTRATO ---
window.goToMatchRegisteredBets = async (matchId, fromHistoryIdx = null) => {

  try {
    if (!matchId) return;
// ✅ COLE ESSE BLOCO AQUI (logo depois do if (!matchId) return;)
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
      alert("Confronto não encontrado. Recarregue a página e tente novamente.");
      return;
    }

    // Normaliza deadlineDate (no seu loadMatches você já cria m.deadlineDate)
    const dl = m.deadlineDate instanceof Date
      ? m.deadlineDate
      : (m.deadline && typeof m.deadline.toDate === 'function' ? m.deadline.toDate() : null);

    if (!dl) {
      alert("Confronto sem prazo válido.");
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
                        rivalDisplay = rivalV || "❌";
                        if(rivalV === m.winner) rivalDisplay = `<span class="text-green-600 font-bold">${rivalV}</span>`;
                    }

                    let myDisplay = myV || "❌";
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
        // Variável global para armazenar a info da última atualização
        window.globalLastUpdateInfo = "Aguardando atualização...";

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
// finishedMatchesChrono = ordem oficial para cálculo de medalhas/streaks
// finishedMatchesDisplay = ordem visual mais recente primeiro
const finishedMatchesChrono = matches.filter(m => m.winner);
const finishedMatchesDisplay = [...finishedMatchesChrono].sort((a, b) => matchComparator(b, a));

// Mantém esta cópia só para o rodapé da última atualização
const finishedMatches = [...finishedMatchesChrono];

                
               // 1.1 Info Rodapé (Última Atualização Real)
                if (finishedMatches.length > 0) {
                    finishedMatches.sort((a, b) => {
                        const dateA = a.finishedAt ? a.finishedAt.toDate() : a.deadlineDate;
                        const dateB = b.finishedAt ? b.finishedAt.toDate() : b.deadlineDate;

                        // 1. TRUQUE DO LOTE: Arredonda para segundos para ignorar milissegundos
                        // Isso força o EMPATE de tempo na "Baixa Rápida"
                        const timeA = Math.floor(dateA.getTime() / 1000);
                        const timeB = Math.floor(dateB.getTime() / 1000);

                        // Se os horários (segundos) forem diferentes, o mais recente ganha
                        if (timeB !== timeA) {
                            return timeB - timeA;
                        }

                        // 2. CRITÉRIO DE DESEMPATE (Empate Técnico de Horário)
                        // AQUI ESTÁ O SEGREDO: Usamos o matchComparator INVERTIDO (b, a).
                        // O matchComparator define quem é o #53 e quem é o #54.
                        // Ao fazer (b, a), garantimos que o #54 fique acima do #53 na lista de "Recentes".
                        return matchComparator(b, a);
                    });

                    // Pega o campeão da ordenação (o mais recente e com maior "número")
                    const last = finishedMatches[0];
                    
                    const d = last.finishedAt ? last.finishedAt.toDate() : last.deadlineDate;
                    const dt = d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}) + " " + d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
                    
                    window.globalLastUpdateInfo = `Última atualização: ${dt}\n${last.teamA} x ${last.teamB}`;
                }
                // 2. PREPARAÇÃO DE USUÁRIOS (TIMELINE)
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
                // 3. CÁLCULO DAS ZEBRAS (REGRA: <= 20% DOS VÁLIDOS NA ÉPOCA)
                // =================================================================
                const zebraMatchIds = [];
                finishedMatches.forEach(m => {
                    // Filtra usuários que JÁ EXISTIAM na data desse jogo
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
  "MARÇO",
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
                // 5. CÁLCULO PRINCIPAL (PONTOS ATUAIS)
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
      !["👽", "💎", "🎯", "🦓", "🔥", "🔮", "🎓", "🥬", "👻"].includes(icon),
  );
  const activeMedals = [...existingMedals];
  const hist = [];
  const userGuesses = (guessesByUser[u.uid] || []).filter((g) =>
    validMatchIds.has(g.matchId),
  );
  const userGuessesMap = Object.fromEntries(
    userGuesses.map((g) => [g.matchId, g]),
  );

 // ORDENAÇÃO OFICIAL: usa a ordem cronológica real, igual ao Android
const chronoMatches = finishedMatchesChrono;
  const cloneHistoryMedal = (medal) => ({
  icon: medal.icon,
  name: medal.name,
  desc: medal.desc,
  date: medal.date,
});

const registerMatchMedal = (medal) => {
  trophyRoom.push(medal);
  if (["👽", "💎", "🎯", "🦓", "🔥", "🔮", "🎓"].includes(medal.icon)) {
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
  const dateStr = `📅 ${m.deadlineDate.getDate()}/${m.deadlineDate.getMonth()+1}`;

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
      icon: "🔥",
      name: "ON FIRE",
      desc: "Palpitou 3 acertos seguidos.",
      date: dateStr,
      hiddenInList: false,
    });

  if (simStreak === 5)
    registerMatchMedalForHistory({
      icon: "🎯",
      name: "MITO",
      desc: "Palpitou 5 acertos seguidos.",
      date: dateStr,
      hiddenInList: false,
    });

  if (simStreak === 10)
    registerMatchMedalForHistory({
      icon: "👽",
      name: "ALIEN",
      desc: "Palpitou 10 acertos seguidos!",
      date: dateStr,
      hiddenInList: false,
    });

  if (zebraMatchIds.includes(m.id))
    registerMatchMedalForHistory({
      icon: "🦓",
      name: "CAÇADOR DE ZEBRAS",
      desc: `Acertou a zebra em ${m.teamA} x ${m.teamB}`,
      date: dateStr,
      hiddenInList: false,
    });

  if (isFinal)
    registerMatchMedalForHistory({
      icon: "🔮",
      name: "MÃE DINAH",
      desc: `Cravou o campeão em ${m.teamA} x ${m.teamB}`,
      date: dateStr,
      hiddenInList: false,
    });

  if (victories > 0 && victories % 50 === 0)
    registerMatchMedalForHistory({
      icon: "🎓",
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
  text: `${dateStr} - ✅ Acerto ${m.teamA} x ${m.teamB}`,
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
    text: `${dateStr} - ❌ Errou ${m.teamA} x ${m.teamB}`,
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
    text: `${dateStr} - ⚪ Não votou ${m.teamA} x ${m.teamB}`,
    label: `${dateStr} - Não votou`,
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
    activeMedals.push("🥬");
    trophyRoom.push({
      icon: "🥬",
      name: "MÃO DE ALFACE",
      desc: "Status Atual: Errou 3 palpites seguidos.",
      date: "Atual",
      hiddenInList: false,
    });
  }

  if (noVoteCount === 3) {
    activeMedals.push("👻");
    trophyRoom.push({
      icon: "👻",
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
  icon: "💎",
  name: "DIAMANTE",
  desc: competitionName
    ? `Gabaritou as Oitavas (8/8) da ${competitionName}.`
    : "Gabaritou as Oitavas (8/8) de um torneio.",
  date: `📅 ${lastOitavaDate.getDate()}/${lastOitavaDate.getMonth() + 1}`,
  hiddenInList: false,
};

registerMatchMedal(diamondMedal);
attachMedalToHistItem(lastOitavaMatch?.id, diamondMedal);

hist.push({
  id: `diamante_${competitionName || "torneio"}`,
  ts: lastOitavaDate,
  text: `💎 BÔNUS: Gabarito Oitavas (+3 pts)`,
  type: "good",
});
    }
  }
}

// Patrão
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
  activeMedals.push("💰");
  trophyRoom.unshift({
    icon: "💰",
    name: "PATRÃO",
    desc: "Mensalidades em dia.",
    date: monthsNames[currentMonthIndex],
    hiddenInList: false,
  });
}
                    // Débitos
                    if (d > 0) {
                        p -= (d * 3);
                        hist.push({ ts: new Date(), text: `🔻 PENALIDADE: Inadimplência (-${d*3} pts)`, type: 'bad' });
                    }

                    // Amauri (Oculto na lista, mas conta pro objeto)
                    if (u.username === 'amauri') trophyRoom.push({icon: "🏆", name:"Campeão 2025", desc:"Lenda.", hiddenInList: true});

                    u.p = p;
u.medals = activeMedals;
u.trophyRoom = trophyRoom; 
                   // ORDENAÇÃO DO EXTRATO: Inversa à lista de jogos (Mais recente no topo)
                    u.hist = hist.sort((a,b) => {
                        // 1. Data do Jogo (Decrescente)
                        const dateA = a.ts ? new Date(a.ts).getTime() : 0;
                        const dateB = b.ts ? new Date(b.ts).getTime() : 0;
                        if (dateA !== dateB) return dateB - dateA;

                        // 2. Data de Criação (Decrescente - O jogo criado DEPOIS aparece EM CIMA)
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

      if (!winner.medals.includes("👑")) winner.medals.push("👑");

      const crownName = `REI DE ${monthNames[monthIdx]}`;
      const alreadyHasThisCrown = winner.trophyRoom.some(
        (medal) => medal.icon === "👑" && medal.name === crownName,
      );

      if (!alreadyHasThisCrown) {
        winner.trophyRoom.unshift({
          icon: "👑",
          name: crownName,
          desc: `Campeão isolado do mês (${maxScore} pts).`,
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
                // 6. SORTING CRÍTICO (A LÓGICA DO ANDROID)
                // =================================================================
                // Ordem: Pontos > Débitos (Menor) > Alien > Diamante > Rei > Mito > Zebra > OnFire > Dinah > Veterano
                const medalHierarchy = ["👽", "💎", "👑", "🎯", "🦓", "🔥", "🔮", "🎓"];

                users.sort((a, b) => {
                    // 1. Pontos (Maior primeiro)
                    if (b.p !== a.p) return b.p - a.p;
                    
                    // 2. Débitos (Menor primeiro - quem deve menos sobe)
                    if (a.debts !== b.debts) return (a.debts||0) - (b.debts||0);
                    
                    // 3. Medalhas (Hierarquia Estrita)
                    for (let icon of medalHierarchy) {
                        // Conta medalhas VISÍVEIS (ignora hiddenInList como o troféu do amauri se não estiver na hierarquia)
                        const countA = (a.medals || []).filter((medalIcon) => medalIcon === icon).length;
const countB = (b.medals || []).filter((medalIcon) => medalIcon === icon).length;

  if (countB !== countA) return countB - countA; // Maior quantidade ganha
}
                    
                    // 4. Ordem Alfabética (Critério final de estabilidade)
                    return (a.name || "").localeCompare(b.name || "");
                });

                // Z-4 (Após ordenação final)
                if (users.length > 4) {
                    const z4StartIndex = users.length - 4;
                    for(let i = z4StartIndex; i < users.length; i++) {
                        if(users[i]) {
                             users[i].isZ4 = true;
if (!users[i].medals.includes("⚓")) users[i].medals.push("⚓");
users[i].trophyRoom.push({
  icon: "⚓",
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

// Renderiza HTML
let html = `
  <div class="ranking-hero mb-4">
    <div class="ranking-hero__bg"></div>
    <div class="ranking-hero__content">
      <div>
        <h3 class="ranking-hero__title">CLASSIFICACAO</h3>
        <p class="ranking-hero__subtitle">Temporada 2026 • ${users.length} participantes</p>
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
                    let posIcon = `<span class="ranking-pos-plain">${pos}º</span>`;
                    let nameClass = "ranking-name";
                    let avatarClass = "ranking-avatar";

                    if (i === 0) { rowClass = "ranking-row--gold"; posIcon = "🥇"; avatarClass += " ranking-avatar--gold"; }
                    else if (i === 1) { rowClass = "ranking-row--silver"; posIcon = "🥈"; avatarClass += " ranking-avatar--silver"; }
                    else if (i === 2) { rowClass = "ranking-row--bronze"; posIcon = "🥉"; avatarClass += " ranking-avatar--bronze"; }
                    else if (i === 3 || i === 4) { rowClass = "ranking-row--top5"; }
                    if (u.isZ4) { rowClass += " ranking-row--z4"; nameClass += " ranking-name--danger"; }

                    let medalsHtml = "";
                    const counts = {};
(u.medals || []).forEach(
  (icon) => (counts[icon] = (counts[icon] || 0) + 1),
);

                    const visualHierarchy = ["🏆", ...medalHierarchy, "💰", "👻", "🥬", "⚓"];
                    const orderedIcons = Object.keys(counts).sort((a,b) => {
                        let idxA = visualHierarchy.indexOf(a); if(idxA === -1) idxA = 99;
                        let idxB = visualHierarchy.indexOf(b); if(idxB === -1) idxB = 99;
                        return idxA - idxB;
                    });
                    const uniqueIcons = orderedIcons;

                    if (uniqueIcons.length > 0) {
                        medalsHtml = `<div class="ranking-medals">` +
                            uniqueIcons.map(icon => `<span class="ranking-medal-chip">${icon}${counts[icon]>1 ? `<span class="ranking-medal-count">${counts[icon]}</span>` : ""}</span>`).join("") +
                        `</div>`;
                    }

                    let diffHtml = `<div class="ranking-move ranking-move--new">NOVO</div>`;
                    if (u.lastRank > 0) {
                      if (pos < u.lastRank) diffHtml = `<div class="ranking-move ranking-move--up"><i class="fas fa-caret-up"></i> ${u.lastRank - pos}</div>`;
                      else if (pos > u.lastRank) diffHtml = `<div class="ranking-move ranking-move--down"><i class="fas fa-caret-down"></i> ${pos - u.lastRank}</div>`;
                      else diffHtml = `<div class="ranking-move ranking-move--same">=</div>`;
                    }

                    return `<div class="ranking-row ${rowClass}">
                        <div class="ranking-row__pos">
                          <div class="ranking-pos-badge">${posIcon}</div>
                          ${diffHtml}
                        </div>

                        <div class="ranking-row__user" onclick="showModalPhoto(${i})">
                            <div class="${avatarClass}"><img src="${getAvatarUrl(u.photoBase64, u.name)}" class="w-full h-full object-cover"></div>
                            <div class="ranking-user-meta">
                                <div class="flex items-start"><span class="${nameClass}">${escapeHtml(u.name || u.username || "Sem nome")}</span></div>
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
  lastUpdateInfo: window.globalLastUpdateInfo,
  cachedAt: Date.now()
};

            } catch (e) { console.error(e); listContainer.innerHTML = `<div class="text-center text-red-500 text-xs">Erro ao carregar ranking.</div>`; listContainer.scrollTop = 0; if (appContent) appContent.scrollTop = 0; }
        }
        // ===============================
// NOVO "i" DO RANKING (igual Android) — mantém o mesmo nome para não quebrar chamadas
// ===============================
window.openRankingInfo = () => {
  window.openRankingInfoModal(window.globalLastUpdateInfo || "");
};

window.openRankingInfoModal = (lastUpdateInfoText = "") => {
  const medals = [
    { icon: "👽", name: "Alien", how: "Sequência de 10 acertos seguidos." },
    { icon: "💎", name: "Diamante", how: "Gabaritar as Oitavas (8/8) de um torneio." },
    { icon: "👑", name: "Rei do Mês", how: "Maior pontuador do mês (isolado)." },
    { icon: "🎯", name: "Mito", how: "Sequência de 5 acertos seguidos." },
    { icon: "🦓", name: "Zebra", how: "Acertar um confronto em que 80% ou mais erraram/não votaram." },
    { icon: "🔥", name: "On Fire", how: "Sequência de 3 acertos seguidos." },
    { icon: "🔮", name: "Mãe Dinah", how: "Acertar o campeão numa FINAL." },
    { icon: "🎓", name: "Veterano", how: "A cada 50 vitórias acumuladas." },

  ];

  const rows = medals.map(m => `
    <div class="grid grid-cols-[140px_1fr] gap-3 py-3 border-b border-white/10 last:border-b-0">
      <div class="flex items-center gap-2">
        <span class="text-xl">${m.icon}</span>
        <span class="font-black text-sm text-white">${m.name}</span>
      </div>
      <div class="text-xs font-bold text-white/80 leading-snug">${m.how}</div>
    </div>
  `).join("");

  const html = `
    <div class="w-full max-w-sm rounded-none shadow-2xl overflow-hidden text-white" style="max-height: 90vh; overflow-y: auto; background: linear-gradient(180deg, #071018 0%, #0b1622 50%, #071018 100%);">
      <div class="p-5">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2">
              <i class="fas fa-info-circle text-[#38BDF8]"></i>
              <div class="font-black uppercase tracking-wider text-lg">SOBRE O RANKING</div>
            </div>
            <div class="text-[10px] font-bold text-white/60 uppercase tracking-wider">Última Atualização</div>
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

        <div class="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <div class="text-xs font-black text-[#A78BFA] uppercase tracking-wider">Valor das medalhas</div>
          <div class="text-xs font-bold text-[#60A5FA] mt-1">*Por Ordem de Importância*</div>
        </div>

        <div class="mt-4 rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div class="grid grid-cols-[140px_1fr] gap-3 bg-white/5 px-4 py-2 border-b border-white/10">
            <div class="text-[10px] font-black text-white/70 uppercase">Medalha</div>
            <div class="text-[10px] font-black text-white/70 uppercase">Como conquistar</div>
          </div>
          <div class="px-4">
            ${rows}
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
    "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
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
        Nenhum ponto marcado neste mês ainda.
      </div>
    `;
  } else {
    listHtml = ranking.map((u, i) => {
      const isKingRow = i === 0 && hasKing;
      const bg = isKingRow ? "bg-[#FFF9C4]" : "bg-white";
      const icon = isKingRow ? "👑 " : "";
      const bold = isKingRow ? "font-black" : "font-normal";
      const color = isKingRow ? "text-[#006400]" : "text-black";

      return `
        <div class="${bg} border border-gray-200 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-8 text-sm font-black text-gray-500">${i + 1}º</div>
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
          <h3 class="text-2xl font-black tracking-wide">👑 REI DE ${selectedMonth.monthName}</h3>
          <p class="text-xs font-semibold text-white/80 mt-1">Classificação mensal</p>
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
            
            // CORREÇÃO 1: Mudado de u.photo para u.photoBase64
            let imageContent = `<img src="${getAvatarUrl(u.photoBase64, u.name)}" class="w-full h-full object-contain bg-black">`;
            
            // --- LÓGICA DE STACKING E ORDENAÇÃO DE MEDALHAS ---
            let medalsHtml = "";
            if (u.trophyRoom && u.trophyRoom.length > 0) {
                // 1. Ordem de prioridade (TROFÉU ADICIONADO NO INÍCIO)
                const priorityOrder = ["🏆", "👽", "💎", "👑", "🎯", "🦓", "🔥", "🔮", "🎓", "💰", "👻", "🥬"];

                
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
                    
                    // Estilos da Bolinha (Badge)
                    const badgeBg = isLegendary ? "bg-[#FFD700] text-black shadow-lg" : "bg-[#D32F2F] text-white shadow-md";
                    const badgeSize = isLegendary ? "w-6 h-6 text-[9px]" : "w-5 h-5 text-[8px]";
                    
                    let badgeHtml = "";
if (count > 1) {
  badgeHtml = `
    <span style="
      position:absolute;
      top:0;
      right:0;
      transform: translate(45%, -45%);
      display:flex;
      align-items:center;
      justify-content:center;

      min-width:22px;
      height:22px;
      padding:0 6px;

      background:#D32F2F;
      color:#fff;

      font-weight:900;
      font-size:12px;
      line-height:1;

      border-radius:999px;
      border:2px solid rgba(255,255,255,.95);
      box-shadow:0 2px 6px rgba(0,0,0,.25);

      font-family: Arial, sans-serif;
      letter-spacing:-0.2px;
    ">${count}x</span>
  `;
}

                    
                    // Click: Se > 1 abre lista, senão Toast
                    const clickAction = count > 1 
                        ? `showMedalList('${name}')` 
                        : `showToast('${first.name}', '${first.desc}', '${first.date}')`;

                    medalsHtml += `
                        <div class="relative inline-block mx-1 my-1 cursor-pointer hover:scale-110 transition-transform select-none group" onclick="${clickAction}">
                            ${badgeHtml}
                            <span class="text-4xl drop-shadow-sm">${first.icon}</span>
                        </div>
                    `;
                }
            } else {
                medalsHtml = `<span class="text-xs text-gray-400 italic">Ainda não possui troféus.</span>`;
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
                                <p class="text-[12px] text-[#3E2723] font-black uppercase tracking-[0.2em] transform skew-x-[5deg]">✨ Sala de Troféus ✨</p>
                            </div>
                            <div class="flex flex-wrap justify-center py-2 px-2 min-h-[60px]">
                                ${medalsHtml}
                            </div>
                            <p class="text-[9px] text-gray-500 mt-1 font-bold">(Toque na medalha para ver detalhes)</p>
                        </div>
                        <div id="medalToast" class="medal-toast"></div>
                        <div class="w-full space-y-2 mt-4">
  <!-- 1) VER ESTATÍSTICAS -->
  <button id="btnStatsAction" class="${scoutClass} w-full bg-black border border-[#FFD700] text-[#FFD700] font-bold py-3 rounded shadow-lg items-center justify-center gap-2 btn-press">
    <i class="fas fa-chart-pie"></i> VER ESTATÍSTICAS
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
            
            // CORREÇÃO 2: Mudado de u.photo para u.photoBase64 aqui também para o botão do scout
            const btnStats = document.getElementById('btnStatsAction'); if (btnStats) btnStats.onclick = () => window.showPlayerScout(u.uid, u.name, u.photoBase64);
            const btnCompare = document.getElementById('btnCompareAction'); if (btnCompare && !isMe) btnCompare.onclick = () => window.compareGuesses(u.uid, u.name);
        };

        // --- NOVA FUNÇÃO PARA LISTA DE MEDALHAS (STACKING) COM FUNDO ---
        window.showMedalList = (medalName) => {
            // Recupera o usuário atual do modal aberto (usando o ID salvo no atributo data-uid)
            const modalEl = document.getElementById('profileModal');
            if(!modalEl) return;
            const uid = modalEl.getAttribute('data-uid');
            const u = currentRankingData.find(user => user.uid === uid);
            if(!u) return;

            const medals = u.trophyRoom.filter(m => m.name === medalName);
            if(medals.length === 0) return;
            
            const first = medals[0];
            
            // Salva o conteúdo anterior para o botão voltar funcionar
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
                        <p class="text-xs text-gray-400">Histórico de Conquistas</p>
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
                // Reconstrói o modal do perfil
                const idx = currentRankingData.findIndex(x => x.uid === uid);
                window.showModalPhoto(idx);
            };
        };

        // Função auxiliar para mostrar o Toast
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
               // Guarda de qual extrato estamos vindo (para o botão VOLTAR no modal de palpites)
window.__fromHistoryIdx = idx;
window.__fromHistoryUid = u.uid;
window.__extractMedalsCache = {};
            
           const html = u.hist && u.hist.length > 0 ? u.hist.map((h, histIndex) => {
    const colorClass = h.type === 'bad' ? 'text-red-600' : 'text-[#2E7D32]';

    // Só deixa clicável se tiver id de match e não for item especial
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

const isNoVote = (h.label || '').toLowerCase().includes('não votou');
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
          <span class="text-[12px] leading-none">🏅</span>
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
    const error = new Error(result?.error || "Não foi possível enviar o push.");
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
    ? "Abra a ferramenta de push para enviar notificações manuais aos usuários."
    : "Abra a ferramenta de WhatsApp para avisar rapidamente sobre novos confrontos.";
  const action = isPush ? "window.openAdminManualPushModal()" : "window.openAdminWhatsAppNoticeModal()";
  const actionLabel = isPush ? "Abrir Push" : "Abrir WhatsApp";

  window.openModal(`
    <div class="admin-communications-modal">
      <div class="admin-communications-header">
        <div>
          <h3>Comunicados</h3>
          <p>Push e WhatsApp para o Bolão 112 FC</p>
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
  const admin = await getCurrentAdminProfile(true);
  if (!admin) {
    alert("Você não tem permissão para acessar comunicados.");
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
          <small>@${escapeHtml(user.username || user.uid)}${user.email ? ` • ${escapeHtml(user.email)}` : ""}</small>
        </span>
      </label>
    `;
  }).join("") : `<div class="admin-communication-empty">Nenhum usuário encontrado.</div>`;

  window.openModal(`
    <div class="admin-communications-modal admin-communications-modal--large">
      <div class="admin-communications-header">
        <div>
          <h3>Enviar Push Manual</h3>
          <p>${isSelected ? "Escolha exatamente quem deve receber a notificação." : "Envie avisos para todos os usuários."}</p>
        </div>
        <button type="button" onclick="window.openAdminCommunicationsModal()" class="admin-communications-close"><i class="fas fa-arrow-left"></i></button>
      </div>
      <div class="admin-communications-body">
        <div class="admin-communication-tabs">
          <button type="button" onclick="window.switchAdminPushTargetMode('all')" class="${!isSelected ? "is-active" : ""}">Todos</button>
          <button type="button" onclick="window.switchAdminPushTargetMode('selected')" class="${isSelected ? "is-active" : ""}">Selecionados</button>
        </div>
        <div class="admin-push-form">
          <label>Título</label>
          <input id="adminPushTitle" class="admin-creation-input" value="${escapeHtml(window.__adminPushDraftTitle || "")}" placeholder="Título do comunicado">
          <label>Mensagem</label>
          <textarea id="adminPushMessage" class="admin-communication-textarea" placeholder="Mensagem para os usuários">${escapeHtml(window.__adminPushDraftMessage || "")}</textarea>
        </div>
        ${isSelected ? `
          <div class="admin-user-picker">
            <div class="admin-user-picker-top">
              <input id="adminPushUserSearch" class="admin-creation-input" value="${escapeHtml(adminCommunicationState.pushSearch || "")}" placeholder="Buscar usuário" oninput="window.filterAdminPushUsers(this.value)">
              <span>${selectedCount} usuário(s) selecionado(s)</span>
            </div>
            <div class="admin-user-picker-list">${usersHtml}</div>
          </div>
        ` : `
          <button type="button" onclick="window.requestWebPushPermissionAndSaveToken()" class="admin-communication-enable-push">
            <i class="fas fa-bell"></i> Ativar notificações deste aparelho
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
  const admin = await getCurrentAdminProfile(true);
  if (!admin) {
    alert("Você não tem permissão para enviar comunicados.");
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
  if (counter) counter.textContent = `${adminCommunicationState.selectedUids.size} usuário(s) selecionado(s)`;
  input?.closest?.(".admin-user-picker-row")?.classList.toggle("is-selected", checked);
};

window.sendAdminManualPush = async () => {
  const title = String(document.getElementById("adminPushTitle")?.value || "").trim();
  const message = String(document.getElementById("adminPushMessage")?.value || "").trim();
  const targetMode = adminCommunicationState.pushTargetMode === "selected" ? "selected" : "all";
  const targetUids = Array.from(adminCommunicationState.selectedUids);

  if (!title) return showAdminCommunicationToast("Informe o título.", "danger");
  if (!message) return showAdminCommunicationToast("Informe a mensagem.", "danger");
  if (targetMode === "selected" && !targetUids.length) return showAdminCommunicationToast("Selecione pelo menos 1 usuário.", "danger");
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
    showAdminCommunicationToast(Number(result.totalTokens || 0) === 0
      ? "Nenhum aparelho com push web ativo ainda."
      : `Push enviado para ${result.successCount || 0} aparelho(s).`);
    window.closeModal();
  } catch (error) {
    console.error("Erro ao enviar push:", error);
    await updateDoc(recordRef, {
      status: "error",
      error: error.code || error.message || "push_error",
      updatedAt: Timestamp.fromDate(new Date())
    });
    if (error.code === "push_not_configured") {
      showAdminCommunicationToast("Push web ainda não está configurado no servidor. O comunicado foi salvo, mas a notificação não foi enviada.", "danger");
      return;
    }
    showAdminCommunicationToast(error.message || "Não foi possível enviar o push.", "danger");
  }
};

const buildNewMatchesNoticeText = (count) => {
  const line = count === 1
    ? "1 novo confronto liberado para votação. Abra o app e deixe seu palpite!"
    : `${count} novos confrontos liberados para votação. Abra o app e deixe seu palpite!`;
  return `🔥 NOVOS CONFRONTOS DISPONÍVEIS! 🔥\n\n${line}\n\n📲 Acesse: https://bolao112-site.vercel.app`;
};

window.openAdminWhatsAppNoticeModal = async () => {
  const admin = await getCurrentAdminProfile(true);
  if (!admin) {
    alert("Você não tem permissão para enviar comunicados.");
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
  const pushTitle = "🔥 Novos confrontos disponíveis!";
  const pushMessage = count === 1
    ? "1 novo confronto foi liberado para votação. Abra o Bolão e deixe seu palpite!"
    : `${count} novos confrontos foram liberados para votação. Abra o Bolão e deixe seus palpites!`;
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
      showAdminCommunicationToast(error.code === "push_not_configured"
        ? "Push web ainda não está configurado no servidor. O aviso foi salvo, mas a notificação não foi enviada."
        : "Não foi possível enviar o push do aviso.", "danger");
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
    console.warn("Falha na migração de admin_rounds para settings/rounds:", error);
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
    console.warn("Falha ao registrar auditoria de competição:", error);
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
      <img id="adminCompetitionThumbImg" src="${hasLogo ? logoUrl : ""}" class="${hasLogo ? "" : "hidden"}" alt="Logo da competição">
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
        Escolha competição, rodada, times, logos e prazo de votação. O fluxo está pronto para a home web/PWA.
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
          <div class="text-[10px] font-black text-[#006400] uppercase tracking-[0.18em]">Competições</div>
          <h4 class="text-lg font-black text-gray-900 leading-tight">Gerencie nomes e logos oficiais.</h4>
        </div>
        <span class="status-chip status-chip--default">${competitionItems.length}</span>
      </div>
      <p class="text-xs text-gray-500 leading-relaxed">Gerencie as competições exibidas no app.</p>
      <button type="button" onclick="window.openCompetitionsManager()" class="w-full bg-[#006400] text-white py-3 rounded-2xl font-black text-xs shadow-lg btn-press flex items-center justify-center gap-2">
        <i class="fas fa-trophy text-base"></i>
        Abrir Competições
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
          <h4 class="text-lg font-black text-gray-900 leading-tight">Cadastro rápido do jogo</h4>
        </div>
        <button type="button" onclick="window.openAdminMenu()" class="text-xs font-black text-gray-500">
          <i class="fas fa-arrow-left mr-1"></i> Voltar
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="admin-compact-label">Competição</label>
          <select id="adminMatchCompetition" class="admin-creation-input" ${hasCompetitions ? "" : "disabled"} onchange="window.handleAdminCompetitionChange()">
            <option value="">Selecione</option>
            ${competitionOptions}
          </select>
          ${hasCompetitions ? "" : '<p class="mt-2 text-[11px] font-bold text-red-600">Nenhuma competição ativa disponível.</p>'}
          <div class="mt-2 flex items-center gap-3">
            ${getCompetitionThumbHtml((competitionItems.find((item) => item.name === competitionValue) || {}).logo || "")}
            <div class="flex-1">
              <div class="text-[10px] font-bold uppercase text-gray-400 mb-1">Logo da competição</div>
              <div class="text-xs text-gray-500">A imagem será usada no confronto e no destaque visual.</div>
            </div>
          </div>
        </div>
        <div>
          <label class="admin-compact-label">Rodada/Fase</label>
          <select id="adminMatchRound" class="admin-creation-input" ${hasRounds ? "" : "disabled"} onchange="window.handleAdminRoundChange()">
            <option value="">Selecione</option>
            ${roundOptions}
          </select>
          ${hasRounds ? "" : '<p class="mt-2 text-[11px] font-bold text-red-600">Nenhuma rodada ativa disponível.</p>'}
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
        <label class="admin-compact-label">Data e Hora limite para votação</label>
        <input id="adminMatchDeadline" type="datetime-local" class="admin-creation-input">
      </div>

      <label class="admin-check-row">
        <input id="adminMatchShareWhatsapp" type="checkbox" class="accent-[#006400]" checked>
        <span>Compartilhar no WhatsApp</span>
      </label>

      <label class="admin-check-row admin-check-row--disabled" title="Será implementado depois no Android.">
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
            <h3 class="font-black uppercase text-lg leading-none">Criação</h3>
            <p class="text-[10px] text-[#FFD700] font-bold">Novo confronto, rodadas e competições</p>
          </div>
          <button onclick="closeModal()" class="ml-3"><i class="fas fa-times text-xl"></i></button>
        </div>

        <div class="px-3 pt-3 shrink-0">
          <div class="admin-creation-tabs">
            ${getTabButton("new-match", "Novo Confronto", "fa-futbol", adminCreationState.tab === "new-match", false)}
            ${getTabButton("rounds", "Rodadas", "fa-list-ol", adminCreationState.tab === "rounds", false)}
            ${getTabButton("competitions", "Competições", "fa-trophy", adminCreationState.tab === "competitions", false)}
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
  const admin = await getCurrentAdminProfile(true);
  if (!admin) {
    alert("Você não tem permissão para acessar a criação.");
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
      <p class="text-xs font-black text-gray-500 uppercase">Carregando criação...</p>
    </div>
  `;

  try {
    await loadAdminCreationState();
    renderAdminCreationModal();
  } catch (error) {
    console.error("Erro ao abrir criação:", error);
    cont.innerHTML = `
      <div class="bg-white p-6 text-center rounded shadow-xl">
        <p class="text-sm font-black text-red-600 mb-3">Não foi possível carregar a criação.</p>
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
  const emptyMessage = activeTab === "inactive" ? "Nenhuma rodada inativa disponível." : "Nenhuma rodada ativa disponível.";
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
              <p class="text-[11px] font-bold text-gray-500">Rodadas desativadas continuam salvas para restauração.</p>
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
  const admin = await getCurrentAdminProfile(true);
  if (!admin) {
    alert("Você não tem permissão para gerenciar rodadas.");
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
        <p class="text-sm font-black text-red-600 mb-3">Não foi possível carregar as rodadas.</p>
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
  if (duplicate.active) return setAdminRoundsStatus("Essa rodada já existe.", "danger");
  if (duplicate.inactive) {
    if (!confirm("Essa rodada está inativa. Deseja restaurá-la?")) return;
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
    setAdminRoundsStatus("Não foi possível salvar a rodada.", "danger");
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
  if (duplicate.active || duplicate.inactive) return setAdminRoundsStatus("Essa rodada já existe.", "danger");

  try {
    const state = await refreshAdminRoundsState();
    const items = [...(state.items || [])];
    const index = items.findIndex((item) => normalizeAdminText(item) === normalizeAdminText(oldName));
    if (index < 0) return setAdminRoundsStatus("Rodada não encontrada.", "danger");

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
    setAdminRoundsStatus("Não foi possível atualizar a rodada.", "danger");
  }
};

window.disableAdminRound = async (roundName) => {
  const targetName = normalizeRoundName(roundName);
  if (!targetName) return;
  if (!confirm("Remover esta rodada da lista de opções?")) return;

  try {
    const state = await refreshAdminRoundsState();
    const items = (state.items || []).filter((item) => normalizeAdminText(item) !== normalizeAdminText(targetName));
    if (items.length === (state.items || []).length) return setAdminRoundsStatus("Rodada não encontrada.", "danger");

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
    setAdminRoundsStatus("Rodada desativada. Ela não aparecerá em novos confrontos, mas continua salva para restauração.");
    await loadAdminCreationState();
  } catch (error) {
    console.error("Erro ao remover rodada:", error);
    setAdminRoundsStatus("Não foi possível remover a rodada.", "danger");
  }
};

window.restoreAdminRound = async (roundName) => {
  const targetName = normalizeRoundName(roundName);
  if (!targetName) return;

  try {
    const state = await refreshAdminRoundsState();
    const inactiveItems = (state.inactiveItems || []).filter((item) => normalizeAdminText(item) !== normalizeAdminText(targetName));
    if (inactiveItems.length === (state.inactiveItems || []).length) return setAdminRoundsStatus("Rodada não encontrada.", "danger");

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
    setAdminRoundsStatus("Não foi possível restaurar a rodada.", "danger");
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
    setAdminRoundsStatus("Não foi possível reordenar a rodada.", "danger");
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
    ? "Nenhuma competição arquivada disponível."
    : "Nenhuma competição ativa disponível.";

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
                  ${safeLogo ? `<img src="${escapeHtml(safeLogo)}" alt="Logo da competição">` : `<i class="fas fa-trophy text-gray-400"></i>`}
                </div>
                <div class="flex-1 min-w-0 space-y-2">
                  <input id="adminCompetitionEditName" type="text" value="${escapeHtml(safeName)}" class="admin-creation-input" placeholder="Nome da competição">
                  <input id="adminCompetitionEditLogo" type="url" value="${escapeHtml(safeLogo)}" class="admin-creation-input" placeholder="URL do logo">
                </div>
                <div class="admin-competition-actions">
                  <button type="button" onclick="window.updateAdminCompetition('${escapeJsString(safeName)}')" class="admin-competition-icon admin-competition-icon--ok" aria-label="Salvar"><i class="fas fa-check"></i></button>
                  <button type="button" onclick="window.cancelAdminCompetitionEdit()" class="admin-competition-icon" aria-label="Cancelar"><i class="fas fa-times"></i></button>
                </div>
              </div>
            ` : `
              <div class="admin-competition-thumb">
                ${safeLogo ? `<img src="${escapeHtml(safeLogo)}" alt="Logo da competição">` : `<i class="fas fa-trophy text-gray-400"></i>`}
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
            <h3 class="font-black uppercase text-lg leading-none">Competições</h3>
            <p class="text-[10px] text-[#FFD700] font-bold">settings/competitions.items</p>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-3 space-y-3">
          <div class="admin-creation-panel space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-[10px] font-black text-[#006400] uppercase tracking-[0.18em]">Nova Competição</div>
                <h4 class="text-lg font-black text-gray-900 leading-tight">Cadastre nome, logo e ativação.</h4>
              </div>
              <span class="status-chip status-chip--default">${allItems.length}</span>
            </div>

            <div>
              <label class="admin-compact-label">Nome</label>
              <div class="flex gap-2">
                <input id="adminCompetitionName" type="text" class="admin-creation-input flex-1" placeholder="Nome (ex: Brasileirão)">
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
  const admin = await getCurrentAdminProfile(true);
  if (!admin) {
    alert("Você não tem permissão para gerenciar competições.");
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
      <p class="text-xs font-black text-gray-500 uppercase">Carregando competições...</p>
    </div>
  `;

  try {
    adminCreationState.editingCompetitionName = "";
    adminCreationState.competitionsTab = "active";
    await refreshAdminCompetitionsState();
    renderAdminCompetitionsManager();
  } catch (error) {
    console.error("Erro ao abrir competições:", error);
    cont.innerHTML = `
      <div class="bg-white p-6 text-center rounded shadow-xl">
        <p class="text-sm font-black text-red-600 mb-3">Não foi possível carregar as competições.</p>
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
    alert("Digite o nome da competição antes de pesquisar.");
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

  if (!name) return setAdminCompetitionsStatus("Informe o nome da competição.", "danger");
  if (!logo) return setAdminCompetitionsStatus("Informe a URL do logo.", "danger");
  if (!isHttpUrl(logo)) return setAdminCompetitionsStatus("A URL do logo precisa começar com http:// ou https://.", "danger");

  const duplicate = findAdminCompetitionDuplicate(name);
  if (duplicate.active) return setAdminCompetitionsStatus("Essa competição já existe.", "danger");

  try {
    const state = await refreshAdminCompetitionsState();
    const oldItems = [...(state.items || [])];

    if (duplicate.inactive) {
      if (!confirm("Essa competição está arquivada. Deseja restaurá-la?")) return;
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
      setAdminCompetitionsStatus("Competição restaurada!");
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
    setAdminCompetitionsStatus("Competição salva!");
    await loadAdminCreationState();
    window.updateAdminCompetitionFormPreview();
  } catch (error) {
    console.error("Erro ao criar competição:", error);
    setAdminCompetitionsStatus("Não foi possível salvar a competição.", "danger");
  }
};

window.updateAdminCompetition = async (oldCompetitionName) => {
  const nameInput = document.getElementById("adminCompetitionEditName");
  const logoInput = document.getElementById("adminCompetitionEditLogo");
  const name = normalizeCompetitionName(nameInput?.value || "");
  const logo = String(logoInput?.value || "").trim();
  const oldName = normalizeCompetitionName(oldCompetitionName);

  if (!name) return setAdminCompetitionsStatus("Informe o nome da competição.", "danger");
  if (!logo) return setAdminCompetitionsStatus("Informe a URL do logo.", "danger");
  if (!isHttpUrl(logo)) return setAdminCompetitionsStatus("A URL do logo precisa começar com http:// ou https://.", "danger");

  const duplicate = findAdminCompetitionDuplicate(name, oldName);
  if (duplicate.active || duplicate.inactive) return setAdminCompetitionsStatus("Essa competição já existe.", "danger");

  try {
    const state = await refreshAdminCompetitionsState();
    const items = [...(state.items || [])];
    const index = items.findIndex((item) => normalizeAdminText(item.name || "") === normalizeAdminText(oldName));
    if (index < 0) return setAdminCompetitionsStatus("Competição não encontrada.", "danger");

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
    setAdminCompetitionsStatus("Competição atualizada!");
    await loadAdminCreationState();
    window.updateAdminCompetitionFormPreview();
  } catch (error) {
    console.error("Erro ao atualizar competição:", error);
    setAdminCompetitionsStatus("Não foi possível atualizar a competição.", "danger");
  }
};

window.disableAdminCompetition = async (competitionName) => {
  const targetName = normalizeCompetitionName(competitionName);
  if (!targetName) return;
  if (!confirm("Arquivar esta competição? Ela deixará de aparecer em novos confrontos, mas continuará salva para restauração.")) return;

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
      return setAdminCompetitionsStatus("Competição não encontrada.", "danger");
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
    setAdminCompetitionsStatus("Competição arquivada. Ela não aparecerá em novos confrontos, mas continua salva para restauração.");
    await loadAdminCreationState();
  } catch (error) {
    console.error("Erro ao arquivar competição:", error);
    setAdminCompetitionsStatus("Não foi possível arquivar a competição.", "danger");
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

    if (!changed) return setAdminCompetitionsStatus("Competição não encontrada.", "danger");

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
    setAdminCompetitionsStatus("Competição restaurada!");
    await loadAdminCreationState();
  } catch (error) {
    console.error("Erro ao restaurar competição:", error);
    setAdminCompetitionsStatus("Não foi possível restaurar a competição.", "danger");
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
      console.warn("Não foi possível carregar competições.", error);
      return { items: [] };
    }),
    readWithRuntimeCache("col:matches", () => getDocs(collection(db, "matches")), { ttlMs: DATA_CACHE_TTL.hot, force: true }),
    readWithRuntimeCache("col:teams", () => getDocs(collection(db, "teams")), { ttlMs: DATA_CACHE_TTL.cold, force: true }).catch((error) => {
      console.warn("Não foi possível carregar teams. Autocomplete seguirá vazio.", error);
      return null;
    }),
    loadAdminRounds({ force: true, migrate: true }).catch((error) => {
      console.warn("Não foi possível carregar rodadas.", error);
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
    console.warn("Não foi possível salvar o time para autocomplete:", error);
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
        const competitionLabel = escapeHtml(String(m.competition || "Sem competição").trim());
        const roundLabel = String(m.round || "").trim();
        const teamASelected = selected === "A";
        const teamBSelected = selected === "B";

        return `
          <div class="admin-quick-result-card">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-[10px] font-black text-[#006400] uppercase tracking-[0.18em]">Confronto #${index + 1}</div>
                <div class="text-sm font-black text-gray-900 leading-tight break-words">${escapeHtml(m.teamA || "Time A")} x ${escapeHtml(m.teamB || "Time B")}</div>
                <div class="mt-1 text-[10px] font-bold text-gray-500 break-words">${competitionLabel}${roundLabel ? ` • ${escapeHtml(roundLabel)}` : ""}</div>
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
        <p class="mt-1 text-xs text-gray-500">Quando houver jogos aguardando resultado, eles aparecerão aqui para baixa rápida.</p>
      </div>
    `;

  modal.classList.remove("hidden");
  cont.innerHTML = `
    <div class="w-full max-w-md bg-white rounded-none shadow-2xl overflow-hidden relative h-[88vh] flex flex-col">
      <img src="bg_painel_admin.jpeg" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover opacity-100">
      <div class="relative z-10 flex flex-col h-full bg-white/92">
        <div class="bg-[#006400] p-4 text-white flex items-start justify-between shadow-md shrink-0">
          <div class="pr-3">
            <h3 class="font-black uppercase text-lg leading-none">⚡ BAIXA RÁPIDA</h3>
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
  const admin = await getCurrentAdminProfile(true);
  if (!admin) {
    alert("Você não tem permissão para usar a Baixa Rápida.");
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
      <p class="text-xs font-black text-gray-500 uppercase">Carregando baixa rápida...</p>
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
    console.error("Erro ao abrir baixa rápida:", error);
    cont.innerHTML = `
      <div class="bg-white p-6 text-center rounded shadow-xl">
        <p class="text-sm font-black text-red-600 mb-3">Não foi possível carregar a baixa rápida.</p>
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
    console.warn("Falha ao registrar auditoria da baixa rápida:", error);
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
    alert("Você não tem permissão para salvar resultados.");
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
    if (!document.getElementById("rankingScreen")?.classList.contains("hidden") && typeof loadRanking === "function") {
      await loadRanking({ force: true });
    }

    if (typeof window.showToast === "function") {
      window.showToast("Resultados salvos!", "Baixa rápida concluída.", "");
    } else {
      alert("Resultados salvos!");
    }

    closeModal();
  } catch (error) {
    console.error("Erro ao salvar baixa rápida:", error);
    adminQuickResultsState.saving = false;
    setAdminQuickResultsStatus("Não foi possível salvar os resultados.", "danger");
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

  if (!competition) return alert("Informe a competição.");
  if (!round) return alert("Informe a rodada/fase.");
  if (!teamA) return alert("Informe o Time A.");
  if (!teamB) return alert("Informe o Time B.");
  if (normalizeAdminText(teamA) === normalizeAdminText(teamB)) return alert("O Time A e o Time B não podem ser iguais.");
  if (!deadlineValue) return alert("Informe a data e hora limite para votação.");
  if (teamALogo && !isHttpUrl(teamALogo)) return alert("O link da logo do Time A precisa começar com http:// ou https://.");
  if (teamBLogo && !isHttpUrl(teamBLogo)) return alert("O link da logo do Time B precisa começar com http:// ou https://.");

  const deadlineDate = new Date(deadlineValue);
  if (Number.isNaN(deadlineDate.getTime())) return alert("A data e hora informadas são inválidas.");

  const admin = await getCurrentAdminProfile(true);
  if (!admin) {
    alert("Você não tem permissão para criar confrontos.");
    closeModal();
    return;
  }

  try {
    const competitionItem = (adminCreationState.competitionItems || []).find((item) => normalizeAdminText(item.name || "") === normalizeAdminText(competition) && item.active === true) || null;
    const savedTeamA = await persistAdminTeamIfNeeded(teamA, teamALogo);
    const savedTeamB = await persistAdminTeamIfNeeded(teamB, teamBLogo);

    const nowTs = Timestamp.fromDate(new Date());
    const deadlineTs = Timestamp.fromDate(deadlineDate);

    const matchPayload = {
      competition,
      competitionLogo: competitionItem?.logo || "",
      round,
      teamA,
      teamB,
      teamAUrl: teamALogo || savedTeamA?.logoUrl || "",
      teamBUrl: teamBLogo || savedTeamB?.logoUrl || "",
      deadline: deadlineTs,
      createdAt: nowTs,
      updatedAt: nowTs,
      winner: "",
      final: false,
      stats: {},
      createdByUid: admin.uid || "",
      createdByName: admin.name || "",
      createdByEmail: admin.email || ""
    };

    const matchRef = await addDoc(collection(db, "matches"), matchPayload);
    await logAdminMatchCreation({
      matchId: matchRef.id,
      teamA,
      teamB,
      competition,
      round,
      deadline: deadlineDate
    });

    invalidateHomeRankingCaches();
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

    if (keepOpen) {
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
      setAdminCreationStatus("Confronto salvo. Preencha o próximo jogo.");
      return;
    }

    alert("Confronto salvo com sucesso.");
    closeModal();
  } catch (error) {
    console.error("Erro ao salvar confronto:", error);
    setAdminCreationStatus("Não foi possível salvar o confronto.", "danger");
    alert(`Não foi possível salvar o confronto. ${error?.message || ""}`.trim());
  }
};

window.saveAdminMatch = async (keepOpen = false) => {
  await saveAdminMatchInternal(keepOpen);
};

window.saveAdminMatchAndReset = async () => {
  await saveAdminMatchInternal(true);
};

        // --- LEGENDA MEDALHAS ATUALIZADA (MITO, DIAMANTE...) ---

        window.openAdminMenu = async () => {
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
              alert("Você não tem permissão para acessar o painel admin.");
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
                            <p class="text-[10px] text-[#FFD700] font-bold">Gestão 2026</p>
                        </div>
                    </div>

                    <div class="flex-1 overflow-y-auto p-4 space-y-6">
                        
                        <div>
                            <h4 class="text-xs font-bold text-gray-500 mb-2 pl-1">⚽ GESTÃO DE JOGOS</h4>
                            <div class="grid grid-cols-2 gap-2">
                                <button onclick="openCreationModal()" class="bg-[#1565C0] text-white py-3 rounded font-bold text-xs shadow btn-press flex flex-col items-center gap-1"><i class="fas fa-plus-circle text-lg"></i> Criação</button>
                                <button onclick="openQuickResultsModal()" class="bg-[#2E7D32] text-white py-3 rounded font-bold text-xs shadow btn-press flex flex-col items-center gap-1"><i class="fas fa-check-circle text-lg"></i> Baixa Rápida</button>
                                <button onclick="openCleanupModal()" class="bg-gray-700 text-white py-3 rounded font-bold text-xs shadow btn-press flex flex-col items-center gap-1"><i class="fas fa-broom text-lg"></i> Limpeza</button>
                            </div>
                        </div>

                        <div>
                            <h4 class="text-xs font-bold text-gray-500 mb-2 pl-1">👥 PESSOAS & FINANCEIRO</h4>
                            <button onclick="window.openFinancialScreen()" class="w-full bg-[#C62828] text-white py-4 rounded font-bold text-xs shadow btn-press flex items-center justify-center gap-2">
                                <i class="fas fa-wallet text-lg"></i> GERENCIAR PAGAMENTOS & USUÁRIOS
                            </button>
                        </div>

                        <div>
                            <h4 class="text-xs font-bold text-gray-500 mb-2 pl-1">📢 COMUNICAÇÃO</h4>
                            <div class="grid grid-cols-1 gap-2">
                                <button onclick="window.openAdminCommunicationsModal()" class="bg-[#6A1B9A] text-white py-3 rounded font-bold text-xs shadow btn-press flex flex-col items-center gap-1"><i class="fas fa-bullhorn text-lg"></i> Comunicados</button>
                            </div>
                        </div>

                        <div>
                            <div class="border-t border-gray-300 my-2"></div>
                            <h4 class="text-xs font-bold text-gray-500 mb-2 pl-1">📋 LISTA DE CONFRONTOS</h4>
                            <div id="adminMatchList" class="bg-white border rounded p-2 text-xs text-gray-500 min-h-[100px]">Carregando...</div>
                        </div>
                    </div>
                </div>
            </div>`;
            loadAdminMatches();
        };
async function loadAdminMatches() { 
            const snap = await getDocs(collection(db, "matches")); 
            const listDiv = document.getElementById('adminMatchList'); 
            if(!listDiv) return; 
            
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

            // Gera HTML (Exibindo na ordem inversa para facilitar edição dos recentes, mas com o número certo)
            let html = ""; 
            [...all].reverse().forEach((m) => { 
                // Encontra o índice na lista original ordenada
                const number = all.findIndex(x => x.id === m.id) + 1;
                const winnerLabel = escapeHtml(String(m.winner || ""));
                const statusLabel = m.winner
                  ? `Finalizado • ${winnerLabel}`
                  : (m.expired ? "Aguardando resultado" : "Em aberto");
                const statusClass = m.winner
                  ? "text-green-700 bg-green-50"
                  : (m.expired ? "text-amber-700 bg-amber-50" : "text-gray-500 bg-gray-100");

                html += `<div class="flex justify-between items-center p-2 border-b border-gray-100">
                    <div class="flex flex-col truncate w-2/3">
                        <span class="font-bold text-black text-xs">#${number} ${m.teamA} x ${m.teamB}</span>
                        <span class="text-[10px] text-gray-400">${m.competition}</span>
                        <span class="mt-1 inline-flex w-fit rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${statusClass}">${statusLabel}</span>
                    </div>
                    <div class="flex gap-2">
                        <button class="text-blue-500" onclick="alert('Edição apenas no App')"><i class="fas fa-edit"></i></button>
                        <button class="text-red-500" onclick="moveToTrash('${m.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`; 
            }); 
            listDiv.innerHTML = html || "Sem jogos."; 
        }
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
                <p class="text-xs font-bold text-gray-600 leading-relaxed">Move todos os confrontos finalizados para a lixeira em uma ação de limpeza em massa.</p>
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
          const admin = await getCurrentAdminProfile(true);
          if (!admin) {
            alert("Você não tem permissão para acessar a limpeza.");
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
            cont.innerHTML = `<div class="bg-white p-6 text-center rounded shadow-xl"><p class="text-sm font-black text-red-600 mb-3">Não foi possível carregar a limpeza.</p><button onclick="openAdminMenu()" class="bg-[#006400] text-white px-4 py-2 rounded font-black text-xs">Voltar</button></div>`;
          }
        };

        window.switchAdminCleanupTab = (tabKey) => {
          adminCleanupState.tab = tabKey === "finished" ? "finished" : "trash";
          renderAdminCleanupModal();
        };

        window.moveToTrash = async (matchId) => {
          if(!confirm("Mover para Lixeira?")) return;
          const admin = await getCurrentAdminProfile(true);
          if (!admin) return alert("Você não tem permissão para mover confrontos.");

          try {
            const snap = await getDoc(doc(db, "matches", matchId));
            if(!snap.exists()) return alert("Confronto não encontrado.");

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
                      <div class="admin-trash-meta">${escapeHtml(m.competition || "Sem competição")}${m.round ? ` • ${escapeHtml(m.round)}` : ""}</div>
                      <div class="admin-trash-meta">${deadlineLabel ? `Prazo: ${escapeHtml(deadlineLabel)}` : "Sem prazo"}${deletedLabel ? ` • Apagado: ${escapeHtml(deletedLabel)}` : ""}</div>
                    </div>
                    <div class="admin-trash-actions">
                      <button type="button" onclick="window.permanentlyDeleteMatch('${escapeJsString(m.id)}')" class="admin-trash-btn admin-trash-btn--danger">APAGAR</button>
                      <button type="button" onclick="window.restoreMatch('${escapeJsString(m.id)}')" class="admin-trash-btn admin-trash-btn--ok">↻ RESTAURAR</button>
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
                    <p class="text-[10px] text-[#FFD700] font-bold mt-1">Restaurar trará os palpites de volta.</p>
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
          const admin = await getCurrentAdminProfile(true);
          if (!admin) {
            alert("Você não tem permissão para abrir a lixeira.");
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
          if (!admin) return alert("Você não tem permissão para restaurar confrontos.");

          try {
            const snap = await getDoc(doc(db, "bin_matches", matchId));
            if(!snap.exists()) return alert("Confronto não encontrado na lixeira.");

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
          if (!confirm("Apagar definitivamente este confronto? Essa ação não poderá ser desfeita.")) return;
          const admin = await getCurrentAdminProfile(true);
          if (!admin) return alert("Você não tem permissão para apagar confrontos.");

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
                <h3 class="font-black uppercase text-lg leading-tight">⚠️ PERIGO: Limpeza em Massa</h3>
              </div>
              <div class="p-4 space-y-4">
                <p class="text-sm font-bold text-gray-800 leading-relaxed">Você tem certeza? Isso vai mover TODOS os jogos que já têm um vencedor definido para a Lixeira.</p>
                <p class="text-xs font-bold text-gray-500 leading-relaxed">Essa ação só poderá ser revertida restaurando os jogos um por um na lixeira.</p>
                <div class="rounded-2xl bg-red-50 border border-red-100 p-3 text-center text-red-700 font-black text-xs">${total} confrontos finalizados serão movidos</div>
                <button type="button" onclick="window.bulkCleanupFinishedMatches()" class="w-full bg-red-700 text-white py-3 rounded-2xl font-black text-xs shadow-lg btn-press">SIM, LIMPAR TUDO</button>
                <button type="button" onclick="window.openCleanupModal()" class="w-full bg-gray-200 text-gray-800 py-3 rounded-2xl font-black text-xs shadow-lg btn-press">Cancelar</button>
              </div>
            </div>
          `;
        };

        window.bulkCleanupFinishedMatches = async () => {
          const admin = await getCurrentAdminProfile(true);
          if (!admin) return alert("Você não tem permissão para limpar confrontos.");

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

       // --- PAINEL FINANCEIRO / USUÁRIOS ---
        const FINANCIAL_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const FINANCIAL_MONTH_LABELS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

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
          return adminFinancialState.sortDir === "desc" ? "↓" : "↑";
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
          return users;
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
          return paid ? "PAGO" : `MÊS ${monthName} PENDENTE`;
        };

        const renderFinancialUserChip = (label, tone = "default") => `
          <span class="status-chip status-chip--${tone}">${escapeHtml(label)}</span>
        `;

        const renderFinancialUserCard = (user) => {
          const paid = isFinancialUserPaid(user);
          const versionLabel = String(user.appVersion || "Sem versão").trim();
          const loginLabel = formatFinancialDateTime(user.lastAccessDate);
          const rulesLabel = user.rulesAccepted === true
            ? `ACEITO ${user.rulesAcceptedVersion || ""}`.trim()
            : "REGULAMENTO PENDENTE";
          const debtLabel = user.debts > 0 ? `INADIMPLÊNCIA ${user.debts}` : "SEM MULTAS";
          const inactiveClass = user.isActive === false ? "admin-financial-card--inactive" : "";

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
                    ${renderFinancialUserChip(`Último login ${loginLabel}`, paid ? "success" : "warning")}
                    ${renderFinancialUserChip(rulesLabel, user.rulesAccepted === true ? "success" : "warning")}
                    ${renderFinancialUserChip(getFinancialPaymentsSummary(user), paid ? "success" : "danger")}
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
                    <h3 class="font-black uppercase text-lg leading-none">GESTÃO FINANCEIRA</h3>
                    <p class="text-[10px] text-[#FFD700] font-bold mt-1">${getFinancialCurrentMonthName()} • ${sorted.length} usuários</p>
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
                      ${sortBtn("version", "Versão")}
                      ${sortBtn("lastLogin", "Último login")}
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
                        <p class="mt-1 text-xs text-gray-500">Tente outro nome, usuário ou email.</p>
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
            showFinancialToast("Informe um usuário.", "danger");
            return;
          }

          const duplicate = (adminFinancialState.whitelist || []).some((item) => normalizeFinancialUsername(item.username || item.id || "") === username);
          if (duplicate) {
            showFinancialToast("Convite já existe.", "danger");
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
            showFinancialToast("Não foi possível criar o convite.", "danger");
          }
        };

        window.revokeFinancialInvite = async (username) => {
          const clean = normalizeFinancialUsername(username);
          if (!clean) return;

          const confirmText = `⚠️ REVOGAR ACESSO?\n\nVocê vai remover o convite de: ${clean}\nO usuário perderá o acesso ao app imediatamente.\nFique tranquilo: os pontos e histórico dele NÃO serão apagados.`;
          if (!confirm(confirmText)) return;

          try {
            await deleteDoc(doc(db, "whitelist", clean));
            await logAdminFinancialAction("revoke_invite", { username: clean });
            await loadAdminWhitelistUsers();
            await renderAdminInviteManager();
            showFinancialToast("Acesso revogado.");
          } catch (error) {
            console.error("Erro ao revogar convite:", error);
            showFinancialToast("Não foi possível revogar o acesso.", "danger");
          }
        };

        window.openInviteManager = async () => {
          const admin = await getCurrentAdminProfile(true);
          if (!admin) {
            alert("Você não tem permissão para acessar os convites.");
            return;
          }

          await loadAdminWhitelistUsers().catch(() => []);
          await renderAdminInviteManager();
        };

        window.openFinancialAuditModal = async () => {
          const admin = await getCurrentAdminProfile(true);
          if (!admin) {
            alert("Você não tem permissão para auditar pagamentos.");
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
                <div class="text-sm font-black text-gray-800">Usuários com pagamento pendente neste mês: ${summary.pendingUsers.length}</div>
                <p class="text-xs text-gray-600 font-bold">Deseja aplicar +1 multa automática para todos?</p>
                ${blocked ? `<div class="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-black text-red-700">A auditoria automática só pode ser aplicada após o dia 10.</div>` : ""}
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
            alert("Você não tem permissão para aplicar multas.");
            return;
          }

          const day = new Date().getDate();
          if (day <= 10) {
            showFinancialToast("A auditoria automática só pode ser aplicada após o dia 10.", "danger");
            return;
          }

          await loadAdminFinancialUsers();
          const summary = await loadFinancialAuditSummary();
          if (!summary.pendingUsers.length) {
            showFinancialToast("Nenhum usuário pendente neste mês.", "danger");
            return;
          }

          if (summary.alreadyApplied) {
            showFinancialToast("A auditoria deste mês já foi aplicada.", "danger");
            return;
          }

          if (!confirm("Aplicar +1 multa automática para todos os usuários pendentes?")) return;

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
            showFinancialToast("Multas aplicadas!");
            await window.openFinancialScreen();
          } catch (error) {
            console.error("Erro ao aplicar auditoria financeira:", error);
            showFinancialToast("Não foi possível aplicar as multas.", "danger");
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
          `).join("") : `<div class="admin-quick-result-empty"><div class="text-base font-black text-gray-800">Nenhum convite vigente.</div><p class="mt-1 text-xs text-gray-500">Adicione um usuário para liberar acesso ao app.</p></div>`;

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
                      <input id="adminInviteInput" type="text" class="admin-creation-input flex-1" placeholder="Usuário (sem @bolao...)" autocomplete="off">
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
                      <i class="fas fa-user-slash"></i> EXCLUIR USUÁRIO
                    </button>
                  </div>

                  <div>
                    <div class="text-[10px] font-black text-[#006400] uppercase tracking-[0.18em]">Inadimplências</div>
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
                    Último login: ${escapeHtml(formatFinancialDateTime(draft.lastAccessDate))}
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
          const user = (adminFinancialState.users || []).find((item) => item.id === uid);
          if (!user) {
            showFinancialToast("Usuário não encontrado.", "danger");
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

          const confirmText = `⚠️ EXCLUIR USUÁRIO?\n\nVocê vai revogar o acesso de @${draft.username}.\n\nOs pontos, palpites, pagamentos e histórico serão preservados.`;
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

            showFinancialToast("Usuário desativado.");
            adminFinancialState.editUserDraft.isActive = false;
            await loadAdminFinancialUsers();
            renderAdminFinancialUserEditModal();
            await window.openFinancialScreen();
          } catch (error) {
            console.error("Erro ao desativar usuário:", error);
            showFinancialToast("Não foi possível desativar o usuário.", "danger");
          }
        };

        window.openResetUserPasswordModal = () => {
          const draft = adminFinancialState.editUserDraft;
          if (!draft) return;

          const modal = document.getElementById("modalOverlay");
          const cont = document.getElementById("modalContainer");
          if (!modal || !cont) return;

          modal.classList.remove("hidden");
          cont.innerHTML = `
            <div class="w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden">
              <div class="bg-[#006400] p-4 text-white">
                <h3 class="font-black uppercase text-lg leading-tight">🔁 Resetar senha</h3>
              </div>
              <div class="p-4 space-y-3">
                <p class="text-sm font-bold text-gray-700">Defina uma nova senha para este usuário. Ele vai usar essa senha no próximo login.</p>
                <div class="text-xs font-black text-gray-500 uppercase">Usuário alvo</div>
                <div class="text-sm font-black text-gray-900">@${escapeHtml(draft.username || "")} • ${escapeHtml(draft.name || "")}</div>
                <input id="financialResetPass" type="password" class="admin-creation-input" placeholder="Nova senha (mín. 6)">
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
            showFinancialToast("A nova senha deve ter no mínimo 6 caracteres.", "danger");
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
            if (!response.ok) throw new Error(result?.error || "Não foi possível resetar a senha.");

            await logAdminFinancialAction("reset_user_password", {
              targetUserId: draft.id,
              username: draft.username || "",
              name: draft.name || ""
            });
            showFinancialToast("Senha resetada!");
            await window.openFinancialUserModal(draft.id);
          } catch (error) {
            console.error("Erro ao resetar senha:", error);
            showFinancialToast(error.message || "Não foi possível resetar a senha.", "danger");
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
            showFinancialToast("Usuário atualizado!");
            await window.openFinancialScreen();
          } catch (error) {
            console.error("Erro ao salvar usuário:", error);
            showFinancialToast("Não foi possível atualizar o usuário.", "danger");
          }
        };
                // --- CORREÇÃO DO PAINEL FINANCEIRO E PAGAMENTO ---

                window.openFinancialScreen = async () => {
            const admin = await getCurrentAdminProfile(true);
            if (!admin) {
              alert("Você não tem permissão para acessar o financeiro.");
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

                    // Inverte o valor atual (se era true vira false, se não existia vira true)
                    payments[month] = !payments[month];

                    // Salva no banco (Merge garante que não apague outros campos)
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

const renderProfileActionTile = ({ tag = "button", onclick = "", extraAttrs = "", iconClass, iconToneClass, title, desc }) => `
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
  </${tag}>
`;

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
            
            const u = userSnap.data(); 
// AQUI: Usa a função corrigida para decidir entre Foto Real ou Avatar
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

            // --- LÓGICA FINANCEIRA ---
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
                            <p class="text-[10px] text-gray-600 mt-2 font-bold">Beneficiário: <span class="text-[#006400] uppercase">${beneficiary}</span></p>
                        </div>

                        <div class="space-y-2">
                            <button onclick="navigator.clipboard.writeText('${pixCode}'); alert('Código PIX Copia e Cola copiado!')" class="w-full bg-[#32BCAD] hover:bg-[#2aa89a] text-white py-3 rounded-lg font-bold text-xs shadow-md btn-press flex items-center justify-center gap-2 transition-colors">
                                <i class="fas fa-copy text-lg"></i> PIX COPIA E COLA
                            </button>
                            
                            <div class="bg-white/90 border rounded px-3 py-2 flex justify-between items-center">
                                <span class="text-[9px] font-bold text-gray-400 mr-2">CHAVE:</span>
                                <input type="text" value="${pixKey}" readonly class="bg-transparent text-xs font-bold text-gray-600 w-full outline-none text-right">
                                <button onclick="navigator.clipboard.writeText('${pixKey}'); alert('Chave PIX copiada!')" class="ml-2 text-[#006400]"><i class="fas fa-copy"></i></button>
                            </div>
                        </div>

                        <div class="border-t border-gray-300/50 pt-4 mt-4">
                            <p class="text-[10px] font-bold text-gray-700 mb-2">Já fez o pagamento?</p>
                            <button onclick="window.open('https://wa.me/${adminPhone}?text=Ei%20Branco!%20J%C3%A1%20fiz%20o%20pagamento%20da%20minha%20mensalidade%20do%20Bol%C3%A3o%20112%20F.C.', '_blank')" class="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white py-3 rounded-lg font-bold text-xs shadow-md btn-press flex items-center justify-center gap-2 transition-colors">
                                <i class="fab fa-whatsapp text-lg"></i> AVISAR AO BRANCO
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;

            const soundEnabled = isSoundEnabled();
            const accountActionsHtml = `
              <section class="profile-section mb-4">
                ${renderProfileSectionHeader("Conta", "Ações principais do seu acesso", "Essencial")}
                <div class="profile-action-grid">
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
                </div>
              </section>
            `;

            const shortcutsSectionHtml = `
              <section class="profile-section mb-4">
                ${renderProfileSectionHeader("Atalhos", "Tudo o que você usa com mais frequência", "Rápido")}
                <div class="profile-action-list">
                  ${renderProfileActionRow({
                    onclick: "openRulesModal()",
                    iconClass: "fas fa-scroll",
                    iconToneClass: "bg-emerald-50 text-emerald-700",
                    title: "Regras do bolão",
                    desc: "Consulte o regulamento sempre que precisar."
                  })}
                  ${renderProfileActionRow({
                    onclick: "window.openCalendar2026()",
                    iconClass: "fas fa-calendar-alt",
                    iconToneClass: "bg-blue-50 text-blue-700",
                    title: "Calendário 2026",
                    desc: "Veja as datas importantes da temporada."
                  })}
                  ${renderProfileActionRow({
                    onclick: "showAppGuide()",
                    iconClass: "fas fa-info-circle",
                    iconToneClass: "bg-purple-50 text-purple-600",
                    title: "Guia do app",
                    desc: "Relembre funções e atalhos do sistema."
                  })}
                </div>
              </section>
            `;

            const preferencesSectionHtml = `
              <section class="profile-section mb-6">
                ${renderProfileSectionHeader("Preferências", "Ajustes locais deste aparelho", "Pessoal")}
                <div class="profile-action-list">
                  ${renderProfileActionRow({
                    onclick: "window.toggleSoundPreference()",
                    iconClass: soundEnabled ? "fas fa-volume-up" : "fas fa-volume-mute",
                    iconToneClass: soundEnabled ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500",
                    title: "Som do app",
                    desc: "Controle se os efeitos sonoros tocam neste dispositivo.",
                    chip: soundEnabled ? "Ligado" : "Desligado"
                  })}
                </div>
              </section>
            `;

            const adminSectionHtml = u.isAdmin ? `
              <section class="profile-section mb-6">
                ${renderProfileSectionHeader("Admin", "Ferramentas administrativas do bolão", "Restrito")}
                <div class="profile-action-list">
                  ${renderProfileActionRow({
                    onclick: "openAdminMenu()",
                    iconClass: "fas fa-cogs",
                    iconToneClass: "bg-white/10 text-[#FFD700]",
                    title: "Painel do administrador",
                    desc: "Gerencie confrontos, financeiro e configurações.",
                    dark: true
                  })}
                </div>
              </section>
            ` : "";

            // HTML DA TELA DE PERFIL (GRADE LIMPA)
            const profileHTML = `
            <div id="profileScreen" class="animate-fade-in p-4">
                <div class="card-cut relative overflow-hidden bg-white shadow-lg mb-6 border-l-4 border-[#006400]">
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
                                <i class="fas fa-crown text-[#FFD700]"></i> SÓCIO TORCEDOR
                              </div>
                              <span class="status-chip ${isPaid ? "status-chip--success" : "status-chip--danger"}">${isPaid ? "Mensalidade ok" : "Pagamento pendente"}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <input type="file" id="uploadPhoto" accept="image/*" class="hidden" onchange="handlePhotoUpload(this)">

                ${accountActionsHtml}
                ${shortcutsSectionHtml}
                ${preferencesSectionHtml}

                <div id="financialSection" class="profile-section mb-6">
                    ${renderProfileSectionHeader("Financeiro", "Sua situação da mensalidade em um toque", isPaid ? "Em dia" : "Atenção")}
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

                ${adminSectionHtml}

                <div class="text-center pb-safe">
                    <div class="version-chip">${getAppVersionLabel()}</div>
                    <p class="text-[9px] text-gray-400 mt-2 font-bold uppercase">Bolão 112 F.C • 2026</p>
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
        // Função Global para Editar Dica (ADICIONE ISSO LOGO APÓS A loadProfile)
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
        window.changePassword = () => { document.getElementById('modalOverlay').classList.remove('hidden'); document.getElementById('modalContainer').innerHTML = `<div class="w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden relative"><img src="bg_login2.png" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover opacity-15"><div class="relative z-10 p-6"><h3 class="font-black text-[#006400] text-center mb-6 text-lg uppercase">Nova Senha</h3><input type="password" id="newPassInput" placeholder="Mínimo 6 caracteres" class="w-full p-3 bg-gray-50 border rounded-lg mb-6 text-sm outline-none focus:border-[#006400]"><button id="btnConfirmPass" class="w-full bg-[#006400] text-white py-3 font-bold rounded-lg shadow-lg btn-press">CONFIRMAR</button><button onclick="closeModal()" class="w-full text-black font-black text-xs mt-4">CANCELAR</button></div></div>`; document.getElementById('btnConfirmPass').onclick = () => { const newPass = document.getElementById('newPassInput').value; if(newPass && newPass.length >= 6) { updatePassword(currentUser, newPass).then(() => { alert("Senha alterada com sucesso!"); closeModal(); }).catch(e => alert("Erro: Faça logout e login novamente para trocar a senha.")); } else { alert("A senha deve ter no mínimo 6 caracteres."); } }; };

window.openCalendar2026 = () => {
  const html = `
    <div class="w-full h-[90vh] max-w-md rounded-none overflow-hidden relative">
      <div class="absolute inset-0 bg-black"></div>

      <div class="relative z-10 flex items-center justify-between p-3">
        <div class="text-white font-black text-sm uppercase tracking-wider">
          Calendário 2026
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
          alt="Calendário 2026"
        />
      </div>
    </div>
  `;

  window.openModal(html);
};

        // --- GUIA DO APP (SUBSTITUI CHANGELOG) ---
// --- GUIA DO APP ATUALIZADO COM LISTA COMPLETA DE MEDALHAS ---
        // --- GUIA DO APP ATUALIZADO (v1.7.3) ---
        window.showAppGuide = () => { 
            document.getElementById('modalOverlay').classList.remove('hidden'); 
            document.getElementById('modalContainer').innerHTML = `
            <div class="w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden relative">
                <img src="bg_regras.png" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover opacity-15">
                <div class="relative z-10 bg-white/80 p-6 max-h-[85vh] overflow-y-auto">
                    <h3 class="font-bold text-lg mb-4 text-center uppercase tracking-widest text-gray-800">GUIA DO APP</h3>
                    <p class="text-center text-[10px] text-gray-500 font-bold mb-4">${getAppVersionFullLabel()}</p>
                    
                    <div class="mb-6 p-4 bg-green-50 rounded-lg border border-green-100 shadow-sm">
                        <h4 class="font-black text-[#006400] text-xs mb-3 uppercase tracking-wide">⚽ JOGOS & PALPITES</h4>
                        <div class="text-xs text-gray-700 space-y-2 font-medium">
                            <p>👉 <b>Como votar:</b> Toque no escudo do time. O voto fica verde quando salvo.</p>
                            <p class="text-green-800 font-bold">👉 Termômetro: <span class="font-normal text-gray-700">Após o jogo, veja a % da galera.</span></p>
                            <p class="text-green-800 font-bold">👉 Resenha: <span class="font-normal text-gray-700">Toque no ícone 💬 para zoar. O balão fica vermelho se tiver msg não lida!</span></p>
                        </div>
                    </div>

                    <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100 shadow-sm">
                        <h4 class="font-black text-blue-800 text-xs mb-3 uppercase tracking-wide">🔔 CENTRAL DE NOTIFICAÇÕES (NOVO)</h4>
                        <div class="text-xs text-gray-700 space-y-2 font-medium">
                            <p>🔴 <b>Badge na Aba Confrontos:</b> O número vermelho no ícone da bola indica quantos jogos abertos você <b>ESQUECEU</b> de votar.</p>
                            <p>🔔 <b>Sininho (Topo):</b> Avisa se existe alguma mensagem nova (Resenha) em qualquer jogo do bolão.</p>
                            <p>🔆 <b>Pulse (Cabeçalhos):</b> Uma bolinha vermelha piscando ao lado de "ABERTOS" ou "FINALIZADOS" mostra onde está a novidade.</p>
                        </div>
                    </div>

                    <div class="mb-6">
                       <h4 class="font-black text-black text-xs mb-3 uppercase tracking-wide">🏅 GALERIA DE CONQUISTAS</h4>
                            <div class="text-xs text-gray-700 space-y-3 font-medium bg-white p-3 rounded border border-gray-200">
                                <div class="flex items-start gap-2"><span class="text-lg">👽</span> <div><b>Alien:</b> Sequência de 10 acertos seguidos.</div></div>
                                <div class="flex items-start gap-2"><span class="text-lg">💎</span> <div><b>Diamante:</b> Gabaritou as Oitavas de Final (8/8).</div></div>
                                <div class="flex items-start gap-2"><span class="text-lg">👑</span> <div><b>Rei do Mês:</b> Líder da pontuação no mês vigente.</div></div>
                                <div class="flex items-start gap-2"><span class="text-lg">🎯</span> <div><b>Mito:</b> Sequência de 5 acertos seguidos.</div></div>
                                <div class="flex items-start gap-2"><span class="text-lg">🦓</span> <div><b>Caçador de Zebras:</b> Acertou um jogo onde +80% da galera não acertou (errou ou não votou).</div></div>
                                <div class="flex items-start gap-2"><span class="text-lg">🔥</span> <div><b>On Fire:</b> Sequência de 3 acertos seguidos.</div></div>
                                <div class="flex items-start gap-2"><span class="text-lg">🔮</span> <div><b>Mãe Dinah:</b> Acertou na mosca o campeão do torneio.</div></div>
                                <div class="flex items-start gap-2"><span class="text-lg">🎓</span> <div><b>Veterano:</b> Ganha 1 estrela a cada 50 ACERTOS.</div></div>
                                
                                <div class="border-t my-2"></div>
                                <div class="flex items-start gap-2"><span class="text-lg">💰</span> <div><b>Patrão:</b> Mensalidade rigorosamente em dia.</div></div>
                                <div class="flex items-start gap-2"><span class="text-lg">👻</span> <div><b>Fantasma:</b> Deixou de votar em 3 jogos seguidos.</div></div>
                                <div class="flex items-start gap-2"><span class="text-lg">🥬</span> <div><b>Mão de Alface:</b> Errou 3 palpites seguidos.</div></div>
                                <div class="flex items-start gap-2"><span class="text-lg text-[#8B0000]">⚓</span> <div class="text-[#8B0000]"><b>Zona de Rebaixamento:</b> Os 4 últimos colocados.</div></div>
                            </div>
                    </div>

                    <button onclick="closeModal()" class="w-full bg-[#006400] text-white py-3 rounded-lg font-bold mt-6 shadow-lg btn-press text-sm">ENTENDI</button>
                </div>
            </div>`; 
        };
// --- CÁLCULO DO POTE COM PREVISÃO ANUAL ---
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

    // 1. Valores Reais (O que já tem no caixa)
    const currentPrize = totalCotasPagas * 10;
    const currentParty = totalCotasPagas * 5;
    const currentTotal = currentPrize + currentParty;

    // 2. Valores de Previsão (Participantes adimplentes definidos pelo admin)
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

    // Atualiza HTML - Previsões
    const elPotRef = document.getElementById('potRef');
    const elPartyRef = document.getElementById('partyRef');
    if (elPotRef) elPotRef.innerText = `Previsão Final: ${fmt(forecastPrize)}`;
    if (elPartyRef) elPartyRef.innerText = `Previsão Final: ${fmt(forecastParty)}`;

    // ATUALIZAÇÃO DO CONTADOR NO HTML
    const elCount = document.getElementById('potCount');
    if (elCount) {
      elCount.innerText = ` ${totalParticipantesAtivos} PARTICIPANTES ADIMPLENTES`;
    }
  } catch (e) {
    console.error("Erro Pote:", e);
  }
};
// --- CORREÇÃO: CARD INSTAGRAM TURBINADO (Tabela Inteligente + Marketing) ---
        window.generateWebCard = async () => {
            const modalEl = document.getElementById('profileModal');
            if(!modalEl) return;
            const uid = modalEl.getAttribute('data-uid');
            
            // 1. Verifica se os dados existem
            if (!currentRankingData || currentRankingData.length === 0) {
                 alert("Por favor, abra a aba 'Ranking' primeiro para carregar os dados atualizados."); 
                 return;
            }

            // 2. ORDENAÇÃO ROBUSTA
            currentRankingData.sort((a,b) => {
                if (b.p !== a.p) return b.p - a.p;
                if ((a.debts||0) !== (b.debts||0)) return (a.debts||0) - (b.debts||0);

                const hierarchy = ["👽", "💎", "👑", "🎯", "🦓", "🔥", "🔮", "🎓"];
                for (let icon of hierarchy) {
                    const countA = (a.medals || []).filter((medalIcon) => medalIcon === icon).length;
const countB = (b.medals || []).filter((medalIcon) => medalIcon === icon).length;
                    if (countB !== countA) return countB - countA;
                }
                return a.name.localeCompare(b.name);
            });

            // 3. Localiza o usuário e define posição real
            const index = currentRankingData.findIndex(u => u.uid === uid);
            if (index === -1) return;
            const user = currentRankingData[index];
            user.lastRank = index + 1;
// =========================
// ✅ MEDALHAS NO CARD DO INSTAGRAM (compacto + contador)
// =========================
const priorityOrder = ["🏆", "👽", "💎", "👑", "🎯", "🦓", "🔥", "🔮", "🎓", "💰", "👻", "🥬"];

const medalCounts = {};
(user.medals || []).forEach((icon) => {
  medalCounts[icon] = (medalCounts[icon] || 0) + 1;
});

const iconsOrdered = Object.keys(medalCounts).sort((a,b) => {
  let ia = priorityOrder.indexOf(a); if (ia === -1) ia = 999;
  let ib = priorityOrder.indexOf(b); if (ib === -1) ib = 999;
  return ia - ib;
});

// Limita para não “entupir” o card (ajuste se quiser)
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
          <span style="
  position:absolute;
  top:0;
  right:0;
  transform: translate(45%, -45%);
  background:#D32F2F;
  color:#fff;
  font-weight:900;
  font-size:12px;
  line-height:1;
  padding:4px 6px;
  border-radius:999px;
  border:2px solid rgba(255,255,255,.95);
  box-shadow:0 2px 6px rgba(0,0,0,.25);
">x${medalCounts[icon]}</span>

        ` : ``}
      </div>
    `).join("")}
  </div>
`;

            // --- LÓGICA DA TABELA INTELIGENTE ---
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

            // 4. Configuração visual do botão
            const btn = document.getElementById('btnInstaAction');
            const originalText = btn.innerHTML;
            btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> GERANDO...`;
            btn.disabled = true;

            // 5. Criação do elemento invisível
            const cardContainer = document.createElement('div');
            cardContainer.id = "instaCardCapture";
            cardContainer.style.position = "fixed"; cardContainer.style.top = "0"; cardContainer.style.left = "0"; 
            cardContainer.style.zIndex = "-9999"; cardContainer.style.width = "320px"; cardContainer.style.height = "720px"; // Altura maior
            document.body.appendChild(cardContainer);

            const avatarUrl = getAvatarUrl(user.photoBase64, user.name);
            
            // GERAÇÃO DO HTML DA TABELA (AJUSTADO PARA NÃO CORTAR NOMES)
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
                    
                    // CORREÇÃO AQUI: 
                    // 1. Padding vertical aumentado para '6px' na linha (div pai).
                    // 2. Adicionado 'line-height: 1.5' e 'padding-top: 2px' no nome para evitar corte e centralizar.
                    tableHtml += `
                    <div style="display: flex; align-items: center; background: ${bg}; padding: 6px 4px; border-radius: 4px; margin-bottom: 2px;">
                        <div style="width: 28px; font-size: 11px; font-weight: bold; color: ${colorPos};">${realRank}º</div>
                        
                        <div style="flex: 1; font-size: 11px; font-weight: ${weight}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.5; padding-top: 2px; padding-bottom: 2px; padding-left: 2px;">
                            ${uItem.name}
                        </div>
                        
                        <div style="width: 35px; text-align: right; font-size: 12px; font-weight: 900; color: ${colorPts};">${uItem.p}</div>
                    </div>`;
                }
            });

            if (remainingCount > 0) {
                tableHtml += `<div style="text-align: center; font-size: 9px; color: #006400; font-weight: bold; margin-top: 4px;">👇 ... e mais ${remainingCount} guerreiros na disputa!</div>`;
            }

            // HTML DO CARD FINAL
            cardContainer.innerHTML = `
                <div style="width: 320px; height: 720px; display: flex; flex-direction: column; padding: 16px; background: linear-gradient(180deg, #004D40 0%, #000000 100%); font-family: serif; text-align: center; position: relative; overflow: hidden;">
                    <img src="bg_ranking.png" loading="lazy" decoding="async" style="position: absolute; top:0; left:0; width:100%; height:100%; object-fit: cover; opacity: 0.15; mix-blend-mode: overlay;">
                    
                    <div style="position: relative; z-index: 10; flex: 1; display: flex; flex-direction: column;">
                        <h1 style="color: #FFD700; font-weight: 900; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; margin: 0;">BOLÃO 112 F.C</h1>
                        
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
                            <div style="color: black; font-weight: 900; font-size: 12px;">VEM PRO JOGO TAMBÉM!</div>
                            <div style="display: flex; align-items: center; justify-content: center; margin-top: 2px;">
                                <i class="fas fa-globe" style="font-size: 12px; margin-right: 4px;"></i>
                                <span style="color: black; font-weight: 900; font-size: 14px;">bolao112-site.vercel.app</span>
                            </div>
                            <div style="color: rgba(0,0,0,0.7); font-weight: bold; font-size: 8px; margin-top: 2px;">👆 COLE O LINK AQUI 👆</div>
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
        
        // Isso deve ficar LOGO APÓS a função calculatePot
        document.getElementById('btnPot').onclick = () => {
            calculatePot(); // Chama o cálculo
            document.getElementById('potModal').classList.remove('hidden'); // Abre o modal novo
        };
       
        document.getElementById('btnRefresh').onclick = () => {
  const activeBtn =
    document.querySelector('#bottomNav .nav-btn.text-\\[\\#006400\\]') ||
    document.querySelector('#bottomNav .nav-btn.text-\\[\\#006400\\]'.replace(/\\/g,'')) ||
    document.querySelector('#bottomNav .nav-btn');

  const active = activeBtn?.id?.replace('nav-', '') || 'matches';
  showTab(active);
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
       // --- CHAT COM MÚLTIPLAS REAÇÕES ---
        window.openMatchComments = async (mid, ta, tb, winner) => {
            if (!appConfig.chat) {
                alert("⛔ O Chat está desativado no momento.");
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

            // Função para salvar reação no Firestore (Map: userId -> emoji)
            window.selectReaction = async (msgId, emoji) => {
                const normalizedEmoji = normalizeChatReaction(emoji);
                if (!normalizedEmoji) return;
                const ref = doc(db, "match_comments", msgId);
                const key = `reactions.${currentUser.uid}`;
                // Se clicar no mesmo, remove (toggle). Se for diferente, atualiza.
                // Como ler o estado atual é complexo no onclick, vamos apenas setar por enquanto.
                // Para toggle perfeito, precisariamos ler o doc antes, mas para performance vamos apenas escrever.
                const currentMessage = window.__currentChatMessagesById?.[msgId] || {};
                const currentReaction = normalizeChatReaction(currentMessage.reactions?.[currentUser.uid] || "");
                const payload = currentReaction === normalizedEmoji
                  ? { [key]: deleteField() }
                  : { [key]: normalizedEmoji };
                await updateDoc(ref, payload);
                
                // Fecha o menu de reação dessa mensagem
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
                            
                            // Processa Reações (Map: uid -> emoji)
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

                            // Emojis disponíveis
                            const emojis = ["👍", "😂", "🔥", "😡", "😭"];

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
                             <p class="text-xs font-bold text-gray-500">⛔ Chat encerrado (Jogo Finalizado)</p>
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

        // --- SCOUT PREMIUM (KPIs + ÚLTIMOS 5 + GRÁFICO + COMPETIÇÕES + RECORDES) ---
// --- SCOUT PREMIUM (ESTATÍSTICAS + GRÁFICO + ÚLTIMOS 5 + TABELA + RECORDES) ---
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

    // 2) Mapeamento de criação de usuários
    const usersCreatedAt = {};
const userDebts = {}; // ✅ NOVO
const allUsersIds = [];

uSnap.forEach(d => {
  const data = d.data();
  const dt = data.createdAt ? data.createdAt.toDate() : new Date(0);
  usersCreatedAt[d.id] = dt;
  userDebts[d.id] = Number(data.debts || 0); // ✅ NOVO
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

    // 4) Simulação + Coleta do “extrato” do usuário
    let rankHistory = [];
    let currentScores = {};
    allUsersIds.forEach(uid => currentScores[uid] = 0);

    let totalEligible = 0;
    let totalVoted = 0;
    let totalHits = 0;

   const compStats = {}; // { comp: {h,t} }
const myExtract = [];       // extrato completo (inclui NOVOTE) para streaks/recordes
const myVotedExtract = [];  // extrato somente de votos (HIT/MISS) para "Últimos 5" igual ao Extrato de Pontos
          // --- NOVO: métricas de RISCO (perfil de "ir contra a maioria") ---
const riskShares = [];        // % de votos que bateram com a escolha dele (por jogo votado)
let riskAgainstMajority = 0;  // quantas vezes ele votou diferente do mais votado



    matches.forEach(m => {
      // Só considera jogos após o usuário existir
      if (targetCreated > m.deadlineDate) return;

      totalEligible++;

      // Atualiza ranking global até esse jogo
      allUsersIds.forEach(uid => {
        if (usersCreatedAt[uid] > m.deadlineDate) return;

        const vote = allGuesses.find(g => g.matchId === m.id && g.userId === uid);
        if (vote && vote.teamSelected === m.winner) {
          currentScores[uid] += (m.round?.toLowerCase() === 'final' ? 6 : 3);
        }
      });

      // Posição do target nesse momento
      const activeUsers = allUsersIds.filter(uid => usersCreatedAt[uid] <= m.deadlineDate);
      activeUsers.sort((a, b) => {
  const netA = (currentScores[a] || 0) - (userDebts[a] || 0) * 3;
  const netB = (currentScores[b] || 0) - (userDebts[b] || 0) * 3;

  // 1) Pontos líquidos desc
  if (netB !== netA) return netB - netA;

  // 2) Menos débitos ganha
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
            // --- NOVO: calcula maioria e % de concordância (Risco) ---
const activeUsersAtTime = allUsersIds.filter(uid => usersCreatedAt[uid] <= m.deadlineDate);

// votos válidos desse jogo (só de quem já existia)
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
              // --- NOVO: registra risco só quando ele vota ---
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

  // extrato somente votados (para "Últimos 5" igual ao Extrato de Pontos)
  myVotedExtract.push({ matchId: m.id, status, deadlineDate: m.deadlineDate });

} else {
  // Sem voto entra apenas no extrato completo (quebra sequência)
  myExtract.push({ matchId: m.id, status: 'NOVOTE' });
}

    });

// --- CONSISTÊNCIA (PARIDADE ANDROID): média do |Δ| entre rodadas ---
const mean = (arr) => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length) : 0;

const avgDeltaAbs = (arrAsc) => {
  if (arrAsc.length < 3) return null; // Android retorna "-" com <3
  let s = 0;
  for (let i = 1; i < arrAsc.length; i++) s += Math.abs(arrAsc[i] - arrAsc[i-1]);
  return s / (arrAsc.length - 1);
};

// rankHistory já está em ordem cronológica (ASC) porque você faz push no forEach
const avgDelta = avgDeltaAbs(rankHistory);

let consistencyLabel = "-";
let consistencyEmoji = "📊";
let consistencyDetail = "Dados insuficientes";

if (avgDelta !== null) {
  if (avgDelta <= 2.2) consistencyLabel = "ALTA";
  else if (avgDelta <= 2.5) consistencyLabel = "MÉDIA";
  else consistencyLabel = "BAIXA";

  consistencyDetail = `Oscilação média: ${avgDelta.toFixed(1)}`;
}

// --- RISCO (PARIDADE ANDROID): risk = 1 - avgShare ---
const avgShare = mean(riskShares); // 0..1 (se ele sempre vota com a maioria, tende a 1)
const risk = 1.0 - avgShare;       // 0 = segue maioria, 1 = sempre contra

let riskLabel = "BAIXO";
let riskEmoji = "🎲";

if (risk >= 0.50) riskLabel = "ALTO";
else if (risk >= 0.25) riskLabel = "MÉDIO";

const riskDetail = `Risco: ${(risk*100).toFixed(0)}% • Concordância média: ${(avgShare*100).toFixed(0)}%`;
          
    // 5) Sequência atual + recordes (W/L) — NOVOTE quebra
let maxWinStreak = 0;
let maxLossStreak = 0; // valor negativo (ex: -4)

// recordes: varre do começo pro fim (cronológico)
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

// sequência atual: varre do fim pro começo (mais recente) até quebrar
let currentStreak = 0;
for (let i = myExtract.length - 1; i >= 0; i--) {
  const it = myExtract[i];
  if (it.status === 'NOVOTE') break;

  if (it.status === 'HIT') {
    if (currentStreak >= 0) currentStreak++;
    else break; // mudou de derrota pra vitória, então sequência "atual" já acabou
  } else if (it.status === 'MISS') {
    if (currentStreak <= 0) currentStreak--;
    else break; // mudou de vitória pra derrota
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

let run = 0;         // sequência corrente (+ hits / - misses)
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

  // Se mudou de HIT para MISS ou MISS para HIT, fecha a run anterior antes de começar a nova
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

// fecha a última sequência ao final
flushRun();



 // 6) Últimos 5 resultados (IGUAL ao Extrato: últimos 5 jogos elegíveis, mesmo sem voto)
// myExtract está em ordem cronológica (foi preenchido no matches.forEach já ordenado por deadlineDate asc)
// então os "últimos 5" são simplesmente os 5 últimos itens do extrato completo.
const last5 = myExtract
  .slice(-5)                 // pega os 5 mais recentes
  .reverse()                 // mostra do mais recente -> mais antigo (opcional, fica mais intuitivo)
  .map(it => {
    if (it.status === 'HIT') return '✅';
    if (it.status === 'MISS') return '❌';
    return '🚫';
  });


    // 7) Precisão, posição atual, melhor posição, % votos
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


    // 8) Tabela por competição (ordenada por precisão desc)
    const compRows = Object.entries(compStats).map(([comp, st]) => {
      const pct = st.t > 0 ? Math.round((st.h / st.t) * 100) : 0;
      return { comp, h: st.h, t: st.t, pct };
    }).sort((a, b) => (b.pct - a.pct) || (b.t - a.t));

    const tableHtml = compRows.length ? `
      <div class="rounded-xl border border-white/10 overflow-hidden">
        <div class="grid grid-cols-[minmax(0,1fr)_52px_62px_44px] bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white/70">
          <div>Competição</div>
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
    ` : `<div class="text-xs text-white/60 font-bold">Sem dados por competição ainda.</div>`;

          const badgeIfMany = (n) => (n && n > 1)
  ? `<span class="ml-2 inline-flex items-center justify-center min-w-[34px] h-7 px-2 rounded-full bg-red-600 text-white text-xs font-black shadow border border-white/20">${n}x</span>`
  : '';


    // 9) Render Premium (FIX: fundo sempre escuro + remove “chuva de números” + close padronizado)
const html = `
  <div class="w-full max-w-sm rounded-none shadow-2xl overflow-hidden"
       style="max-height: 90vh; overflow-y: auto; background: linear-gradient(to bottom, #071018, #0b1622, #071018);">
       
    <div class="p-5 text-white">
      <div class="flex items-start justify-between">
        <div>
          <div class="font-black italic text-[#FFD700] text-lg tracking-widest">SCOUT DO PALPITEIRO</div>
          <div class="text-[10px] font-bold text-white/60 uppercase tracking-wider">Resumo Premium • 2026</div>
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

  <!-- Consistência -->
  <div class="flex items-center justify-between px-3 py-2 rounded-xl bg-white/10 border border-white/10">
    <div class="flex items-center gap-2 min-w-0">
      <span class="text-base">${consistencyEmoji}</span>
      <div class="min-w-0">
        <div class="text-[11px] font-black text-white/90 truncate">Consistência: <span class="text-[#FFD700]">${consistencyLabel}</span></div>
        <div class="text-[10px] text-white/50 font-bold truncate">${consistencyDetail}</div>
      </div>
    </div>
    <button class="w-7 h-7 rounded-full bg-black/30 border border-white/10 flex items-center justify-center"
      onclick="window.__toggleScoutInfo('scoutInfoConsistency')">
      <i class="fas fa-info text-[10px] text-white/80"></i>
    </button>
  </div>

  <div id="scoutInfoConsistency" class="hidden text-[10px] text-white/70 font-bold bg-black/20 border border-white/10 rounded-xl p-3">
    Mede o quanto a posição dele “balança” ao longo do tempo. Quanto menor a oscilação, maior a consistência.
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
    Mede se ele costuma votar com a maioria ou “ir contra”. Menor concordância e mais votos contra a maioria = risco mais alto.
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
          <div class="text-[9px] uppercase tracking-wider text-white/60 font-black">Precisão</div>
          <div class="text-lg font-black text-blue-300">${acc}%</div>
        </div>
        <div class="bg-white/10 rounded-lg p-3 border border-white/10 text-center">
          <div class="text-[9px] uppercase tracking-wider text-white/60 font-black">Seq. Atual</div>
          <div class="text-lg font-black">${streakDisplay}</div>
        </div>
      </div>

      <!-- Últimos 5 -->
      <div class="mt-4 bg-white/10 rounded-lg p-3 border border-white/10">
        <div class="text-[10px] font-black uppercase tracking-wider text-white/70 mb-2">Últimos 5</div>
        <div class="flex items-center justify-between text-[10px] font-black text-white/60 mb-2 px-1">
  <span>Mais recente</span>
  <span class="text-white/40">→</span>
  <span>Mais antigo</span>
</div>
        <div class="flex justify-between gap-2">
          ${last5.map(x => `
            <div class="w-10 h-10 rounded-full bg-black/30 border border-white/10 flex items-center justify-center text-lg">
              ${x}
            </div>
          `).join('')}
        </div>
        <div class="text-[10px] text-white/50 font-bold mt-2">✅ acerto • ❌ erro • 🚫 sem voto (quebra sequência)</div>
      </div>

      <!-- Gráfico -->
      <div class="mt-4 bg-white rounded-lg p-3">
        <div class="text-[10px] text-gray-600 font-black mb-2 text-center uppercase tracking-wider">Evolução no Ranking</div>
        <div class="h-40 w-full"><canvas id="scoutChart"></canvas></div>
      </div>

      <!-- Desempenho por competição -->
      <div class="mt-4">
        <div class="text-[10px] font-black uppercase tracking-wider text-white/70 mb-2">Desempenho por competição</div>
        ${tableHtml}
      </div>

      <!-- Recordes & Perfil -->
<div class="mt-4 bg-white/10 rounded-lg p-3 border border-white/10">
  <div class="text-[10px] font-black uppercase tracking-wider text-white/70 mb-2">Recordes & Perfil</div>

  <div class="grid grid-cols-2 gap-3">
    <div class="bg-black/20 rounded-lg p-3 border border-white/10">
      <div class="flex items-center justify-between">
        <div class="text-[9px] uppercase text-white/60 font-black">🔥 Melhor seq.</div>
        ${badgeIfMany(winRecordCount)}
      </div>
      <div class="text-lg font-black text-green-300">+${maxWinStreak}</div>
    </div>

    <div class="bg-black/20 rounded-lg p-3 border border-white/10">
      <div class="flex items-center justify-between">
        <div class="text-[9px] uppercase text-white/60 font-black">❄️ Pior seq.</div>
        ${badgeIfMany(lossRecordCount)}
      </div>
      <div class="text-lg font-black text-red-300">${maxLossStreak}</div>
    </div>

    <div class="bg-black/20 rounded-lg p-3 border border-white/10">
      <div class="flex items-center justify-between">
        <div class="text-[9px] uppercase text-white/60 font-black">🏅 Melhor posição</div>
        ${badgeIfMany(bestPosCount)}
      </div>
      <div class="text-lg font-black text-[#FFD700]">#${bestPos}</div>
    </div>

    <div class="bg-black/20 rounded-lg p-3 border border-white/10">
      <div class="flex items-center justify-between">
        <div class="text-[9px] uppercase text-white/60 font-black">⚠️ Pior posição</div>
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

    // 10) Gráfico
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
            label: 'Posição',
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

        // --- FUNÇÕES PARA ABRIR/FECHAR AS LISTAS (TOGGLE) ---
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

  // ✅ evita travadas/bags do chart quando fecha modal
  if (window.myScoutChart) {
    try { window.myScoutChart.destroy(); } catch(e) {}
    window.myScoutChart = null;
  }

  if (container) container.innerHTML = "";
  if (overlay) overlay.classList.add("hidden");
};
// ====== Bloqueio de fechamento quando Rules Gate estiver ativo ======
(() => {
  const __origCloseModal = window.closeModal;

  window.closeModal = function () {
    // se Rules Gate OU Force Password estiver ativo, impede fechar
    if (window.__rulesGateLock || window.__forcePwLock) return;
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
      // só fecha se o clique foi no overlay (fora do container)
      if (e.target !== overlay) return;

      // se gate estiver ativo, não fecha
     if (window.__rulesGateLock || window.__forcePwLock) return;
window.closeModal();

    });
  }

  // 2) ESC
  if (!document.__rulesGateEscBound) {
    document.__rulesGateEscBound = true;

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;

      // se gate estiver ativo, não fecha
if (window.__rulesGateLock || window.__forcePwLock) return;

      // se não tiver modal aberto, ignora
      const ov = document.getElementById("modalOverlay");
      if (ov && !ov.classList.contains("hidden")) {
        window.closeModal();
      }
    });
  }
})();
// --- RULES GATE MODAL (obrigatório / travado) ---
const openRulesGateModal = async () => {
  const overlay = document.getElementById('modalOverlay');
  const cont = document.getElementById('modalContainer');
  if (!overlay || !cont) {
    alert("Erro: modalOverlay/modalContainer não encontrado no HTML.");
    return;
  }

  overlay.classList.remove('hidden');
overlay.style.zIndex = '99999';
document.body.style.overflow = 'hidden';

  // monta lista de regras
  const items = Array.isArray(window.__rulesGate.items) ? window.__rulesGate.items : [];
  const listHtml = items.length
    ? items.map((t) => `<li class="mb-2 leading-relaxed text-sm text-gray-700">• ${String(t)}</li>`).join('')
    : `<li class="text-sm text-gray-500">Nenhuma regra cadastrada.</li>`;

  cont.innerHTML = `
    <div class="bg-white p-6 relative w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100">
      <div class="text-center mb-4">
        <div class="text-[#006400] font-black uppercase text-lg">Regulamento Obrigatório</div>
        <div class="text-[11px] text-gray-500 font-bold mt-1">
          Versão: <span class="text-black">${window.__rulesGate.requiredVersion || 0}</span>
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

  // trava: não fecha clicando fora nem ESC (se você tiver handler disso, ignore)
  // botão sair
  document.getElementById('btnLogoutRulesGate').onclick = async () => {
    try { await signOut(auth); } catch(e) {}
  };

  // botão aceitar
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


      // garantir que a UI “entre” corretamente (caso tenhamos segurado a navegação)
      // segue pelo funil central
window.continueAfterLoginGates();

    } catch (e) {
      console.error(e);
      if (msg) msg.innerText = "Erro ao salvar aceitação. Verifique sua conexão e tente novamente.";
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

    // 2) users/{uid} (você já tem userData do getDoc anterior)
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
    // NÃO libera lock aqui se gateRules==true,
    // porque o lock só deve cair quando aceitar.
    if (!window.__rulesGate.gateRules) window.__rulesGateLock = false;
  }
};


// Regras agora viram MODAL (conteúdo vem do rulesList já carregado)
window.openRulesModal = async ({ mandatory = false } = {}) => {
  try {
    // trava fechamento se for obrigatório
    window.__rulesGateLock = !!mandatory;

    // Garante que renderRules rode antes de abrir o modal.
    await renderRules();

    const uid = window.getCurrentUid();
    const rulesDoc = await window.getRulesDoc(); // pega version
    const rulesVersion = (rulesDoc.version || "").toString();

    // marca "abriu tela"
    if (uid) await window.markRulesOpened(uid);

    // pega estado do usuário pra decidir se mostra botão
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
      ? `` // sem X no modo obrigatório
      : `<button class="btn-press" onclick="closeModal()"><i class="fas fa-times"></i></button>`;

    const footerHtml = (() => {
      // Se é obrigatório e ainda está pendente: só deixa aceitar
      if (mandatory && gate) {
        return `
          <div class="p-4 pt-0 space-y-2">
            <button id="btnAcceptRules"
                    class="w-full bg-[#006400] text-white py-3 rounded font-black text-xs shadow btn-press">
              LI E CONCORDO ✅
            </button>
            <div class="text-[10px] text-gray-500 font-bold text-center">
              Você precisa aceitar para continuar usando o app.
            </div>
          </div>
        `;
      }

      // Se não é obrigatório:
      // - se pendente: mostra aceitar + fechar
      // - se já aceitou: mostra selo + fechar
      if (!mandatory) {
        if (gate) {
          return `
            <div class="p-4 pt-0 space-y-2">
              <button id="btnAcceptRules"
                      class="w-full bg-[#006400] text-white py-3 rounded font-black text-xs shadow btn-press">
                LI E CONCORDO ✅
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
              ✅ você já aceitou este regulamento
            </div>
            <button onclick="closeModal()"
                    class="w-full bg-[#006400] text-white py-3 rounded font-black text-xs shadow btn-press">
              FECHAR
            </button>
          </div>
        `;
      }

      // obrigatório mas já aceito (caso raro): pode fechar
      return `
        <div class="p-4 pt-0">
          <div class="w-full bg-green-50 border border-green-200 text-green-800 py-3 rounded font-black text-xs text-center">
            ✅ você já aceitou este regulamento
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

    // Wire do botão de aceitar (se existir)
    const btn = document.getElementById("btnAcceptRules");
    if (btn) {
      btn.onclick = async () => {
        try {
          btn.disabled = true;
          btn.classList.add("opacity-60");

          const uid2 = window.getCurrentUid();
          if (!uid2) throw new Error("Sem usuário logado");

          await window.acceptRules(uid2, rulesVersion);

          // atualiza status do botão de regras na profile (se você tiver)
          if (typeof window.updateRulesButtonStatus === "function") {
            window.updateRulesButtonStatus(true);
          }

          // se era obrigatório, destrava e fecha
          window.__rulesGateLock = false;

          // Reabre o modal já em modo "aceito" (fica bonito e garante paridade)
          closeModal();
          window.openRulesModal({ mandatory: false });

        } catch (e) {
          console.error("Erro ao aceitar regras:", e);
          btn.disabled = false;
          btn.classList.remove("opacity-60");
          alert("Não foi possível salvar seu aceite. Verifique sua conexão e tente novamente.");
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

// Estado do modal obrigatório (impede fechar)
window.__rulesGateLock = false;

// (você provavelmente já tem o uid atual em algum lugar; ajuste aqui)
window.getCurrentUid = () => {
  // opção A: Firebase Auth
  // return auth?.currentUser?.uid || null;

  // opção B: se você guarda em window/global
  return window.currentUid || null;
};

window.getRulesDoc = async () => {
  await renderRules(true); // força pegar versão/updatedAt novos
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

// Chame isso após login (quando já tiver uid)
window.enforceRulesGate = async () => {
  const uid = window.getCurrentUid();
  if (!uid) return;

  const [rulesDoc, userState] = await Promise.all([
    window.getRulesDoc(),
    window.getUserRulesState(uid),
  ]);

  const gate = window.computeGateRules(userState, rulesDoc);
  if (gate) {
    // abre obrigatório e trava fechar
    await window.openRulesModal({ mandatory: true });
  } else {
    // opcional: atualizar status do botão na profile
    if (typeof window.updateRulesButtonStatus === "function") {
      window.updateRulesButtonStatus(false);
    }
  }
};
