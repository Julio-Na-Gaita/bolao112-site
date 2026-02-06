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
        import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, query, where, deleteDoc, writeBatch, addDoc, onSnapshot, orderBy, enableIndexedDbPersistence, arrayUnion, arrayRemove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

        const registerServiceWorker = () => {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js');
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
        // NOVO: Objeto para guardar as regras do Android
        let appConfig = { chat: true, scout: true, vote: true };
        // --- NOVAS VARIÁVEIS AQUI ---
        let layoutOrder = []; // Vai guardar a ordem da tela ["ticker", "banner_X", "matches_open"...]
        let activePolls = {}; // Cache das enquetes
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
        const playVoteSound = () => {
            try {
                const audio = new Audio('som_pop.mp3');
                audio.volume = 0.5;
                audio.play().catch(e => console.log("Áudio bloqueado:", e));
            } catch(e) { console.log(e); }
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
       <div style="position: relative;">
  <input id="forcePwCurrent" type="password" class="w-full border rounded px-3 py-2 text-sm pr-10" autocomplete="current-password" />
  <button id="eyeForceCurrent" type="button"
    style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:transparent; border:none; color:#666; font-size:16px; cursor:pointer; padding:6px;">
  </button>
</div>


       <div style="position: relative;">
  <input id="forcePwNew" type="password" class="w-full border rounded px-3 py-2 text-sm pr-10" autocomplete="new-password" />
  <button id="eyeForceNew" type="button"
    style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:transparent; border:none; color:#666; font-size:16px; cursor:pointer; padding:6px;">
  </button>
</div>


       <div style="position: relative;">
  <input id="forcePwConfirm" type="password" class="w-full border rounded px-3 py-2 text-sm pr-10" autocomplete="new-password" />
  <button id="eyeForceConfirm" type="button"
    style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:transparent; border:none; color:#666; font-size:16px; cursor:pointer; padding:6px;">
  </button>
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
        const initRemoteConfig = () => {
            onSnapshot(doc(db, "settings", "config"), (docSnap) => {
                if (docSnap.exists()) {
                    const config = docSnap.data();
                    
                    // A. Atualiza Configurações Globais (Lê do seu print)
                    appConfig.chat = config.enable_chat !== false; // Padrão true se não existir
                    appConfig.scout = config.enable_scout !== false;
                    appConfig.vote = config.enable_fast_vote !== false;

                    // B. Lógica Visual do Banner
                    const maintScreen = document.getElementById('maintenanceScreen');
                    const alertBanner = document.getElementById('alertBanner');
                    
                    if (!maintScreen || !alertBanner) return;

                    // Bloqueio (Manutenção)
                    if (config.banner_active && config.banner_blocking) {
                        const t = document.getElementById('maintTitle'); if(t) t.innerText = config.banner_title || "EM MANUTENÇÃO";
                        const m = document.getElementById('maintMessage'); if(m) m.innerText = config.banner_message || "Voltamos logo!";
                        maintScreen.classList.remove('hidden');
                        alertBanner.classList.add('hidden');
                        document.body.style.overflow = "hidden";
                    } else {
                        maintScreen.classList.add('hidden');
                        document.body.style.overflow = "auto";
                    }

                    // Aviso Informativo
                    if (config.banner_active && !config.banner_blocking) {
                        const t = document.getElementById('alertTitle'); if(t) t.innerText = config.banner_title || "AVISO";
                        const m = document.getElementById('alertMessage'); if(m) m.innerText = config.banner_message || "";
                        alertBanner.classList.remove('hidden');
                    } else {
                        alertBanner.classList.add('hidden');
                    }
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
});



// --- RECUPERAÇÃO DE SENHA (WEB) ---
        document.getElementById('btnForgotPass').onclick = () => {
            const modal = document.getElementById('modalOverlay'); 
            const cont = document.getElementById('modalContainer'); 
            modal.classList.remove('hidden');

            cont.innerHTML = `
                <div class="bg-white p-6 relative w-full max-w-sm rounded shadow-xl">
                    <button onclick="closeModal()" class="absolute top-2 right-2 text-gray-400 p-2"><i class="fas fa-times text-xl"></i></button>
                    <div class="text-center">
                        <i class="fas fa-key text-[#FFD700] text-3xl mb-2"></i>
                        <h3 class="text-[#006400] font-black uppercase text-lg mb-2">Recuperar Acesso</h3>
                        <p class="text-xs text-gray-500 mb-4">Digite seu usuário para ver a dica cadastrada.</p>
                        
                        <input type="text" id="recoverUser" placeholder="Ex: joaosilva" class="w-full p-3 bg-gray-50 border rounded-lg mb-4 text-sm outline-none focus:border-[#006400] text-center font-bold">
                        
                        <div id="hintResultArea" class="hidden mb-4 p-3 bg-orange-50 border border-orange-200 rounded">
                            <p class="text-[10px] text-orange-600 font-bold uppercase">💡 SUA DICA:</p>
                            <p id="hintTextDisplay" class="text-sm font-black text-black mt-1"></p>
                        </div>

                        <button id="btnSearchHint" class="w-full bg-[#006400] text-white py-3 font-bold rounded-lg shadow-lg btn-press text-sm">BUSCAR DICA</button>
                        <p id="recoverMsg" class="text-xs text-red-500 font-bold mt-2"></p>
                    </div>
                </div>
            `;

            document.getElementById('btnSearchHint').onclick = async () => {
                const user = document.getElementById('recoverUser').value.trim();
                const msg = document.getElementById('recoverMsg');
                const area = document.getElementById('hintResultArea');
                
                if(!user) { msg.innerText = "Digite seu usuário."; return; }
                
                msg.innerText = "Buscando...";
                area.classList.add('hidden');

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
                            document.getElementById('btnSearchHint').innerText = "LEMBREI!";
                            document.getElementById('btnSearchHint').onclick = closeModal;
                        } else {
                            msg.innerText = "Você não cadastrou dica. Contate o Admin.";
                        }
                    } else {
                        msg.innerText = "Usuário não encontrado.";
                    }
                } catch(e) {
                    console.error(e);
                    msg.innerText = "Erro ao buscar. Tente novamente.";
                }
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
                    appVersion: "Web v1.7",
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
try { await updateDoc(userDocRef, { appVersion: "Web v1.7", lastAccess: new Date() }); } catch(e) {}

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

document.getElementById('mainHeader').classList.add('hidden');
document.getElementById('loginScreen').classList.remove('hidden');
document.getElementById('mainScreens').classList.add('hidden');
document.getElementById('bottomNav').classList.add('hidden');

            }
        });
// finaliza a entrada no app (chamar só quando estiver liberado)
window.finalizeAppEntryAfterLogin = () => {
  document.getElementById('mainHeader').classList.remove('hidden');
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('mainScreens').classList.remove('hidden');
  document.getElementById('bottomNav').classList.remove('hidden');
  document.getElementById('btnLogout').classList.remove('hidden');

  showTab('matches');
  calculatePot();
};


        window.showTab = (tab) => {
  const appContent = document.getElementById('appContent');
  if (appContent) appContent.className = `flex-1 overflow-y-auto bg-main pb-32 tab-${tab}`;

  // Pega as tabs que EXISTEM no HTML (evita null)
  const tabs = ['matches', 'ranking', 'rules', 'shop', 'profile']
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
  if (tab === 'shop' && typeof loadShop === 'function') loadShop();
  if (tab === 'profile' && typeof loadProfile === 'function') loadProfile();
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
            let unreadGames = [];
            let totalUnread = 0;

            if(window.cachedMatches) {
                window.cachedMatches.forEach(m => {
                    const sCount = globalServerCounts[m.id] || 0;
                    const lCount = parseInt(localStorage.getItem(`read_count_${m.id}`) || "0");
                    
                    if (sCount > lCount) {
                        totalUnread++;
                        // Guarda o objeto completo para usar no onclick
                        unreadGames.push({
                            id: m.id,
                            title: `${m.teamA} x ${m.teamB}`,
                            teamA: m.teamA,
                            teamB: m.teamB,
                            winner: m.winner || ''
                        });
                    }
                });
            }

            const btnBell = document.getElementById('btnBell');
            const old = btnBell.querySelector('.bell-badge'); if(old) old.remove();
            
            // Clona para limpar eventos antigos
            const newBell = btnBell.cloneNode(true); 
            btnBell.parentNode.replaceChild(newBell, btnBell);

            if (totalUnread > 0) {
                newBell.innerHTML += `<div class="bell-badge">${totalUnread > 9 ? '+' : totalUnread}</div>`;
                newBell.classList.add('text-red-400');
                
                // AQUI ESTAVA O PROBLEMA: Agora o onclick abre o modal DIRETO
                newBell.onclick = () => {
                    const modal = document.getElementById('modalOverlay');
                    const cont = document.getElementById('modalContainer');
                    
                    // Gera a lista clicável que chama openMatchComments
                    let listHtml = unreadGames.map(game => `
                        <div onclick="window.openMatchComments('${game.id}', '${game.teamA}', '${game.teamB}', '${game.winner}');" 
                             class="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-green-50 transition-colors btn-press">
                            <span class="text-xs font-bold text-gray-700">💬 ⚽ ${game.title}</span>
                            <span class="text-[9px] text-green-600 font-bold uppercase tracking-wider bg-green-100 px-2 py-1 rounded">Ler</span>
                        </div>
                    `).join('');

                    modal.classList.remove('hidden');
                    
                    // CORREÇÃO DO LAYOUT: Usando classes padrão (w-full max-w-sm) em vez de w-72 fixo
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
                            <button onclick="closeModal()" class="w-full bg-gray-800 text-white py-2 rounded font-bold text-xs shadow-md btn-press">
                                FECHAR LISTA
                            </button>
                        </div>
                    </div>`;
                };
            } else {
                newBell.classList.remove('text-red-400');
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
                        <img src="${img1}" referrerpolicy="no-referrer" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
                    </a>
                    ${img2 ? `<a href="${link2}" target="_blank" class="block rounded-xl overflow-hidden shadow-md border border-gray-200 relative group aspect-[4/3]"><img src="${img2}" referrerpolicy="no-referrer" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"></a>` : ''}
                </div>`;
            }

            if (type === "small") {
                 return `
                <div class="card-container mb-4 animate-fade-in">
                    <a href="${link1}" target="_blank" class="block rounded-lg overflow-hidden shadow-sm border border-gray-200 relative group aspect-[6/1]">
                        <img src="${img1}" referrerpolicy="no-referrer" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
                    </a>
                </div>`;
            }

            return `
            <div class="card-container mb-4 animate-fade-in">
                <a href="${link1}" target="_blank" class="block rounded-xl overflow-hidden shadow-lg border border-gray-200 relative group aspect-[2.7/1]">
                    <img src="${img1}" referrerpolicy="no-referrer" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onerror="this.style.display='none'">
                    ${bannerData.name ? `<div class="absolute bottom-0 right-0 bg-black/60 text-white text-[8px] px-2 py-1 font-bold rounded-tl-lg">${bannerData.name}</div>` : ''}
                </a>
            </div>`;
        };

        // 3. Renderiza Enquete (Correção de Clique)
        const renderPoll = (poll) => {
            if (!poll || !poll.active) return '';
            const totalVotes = Object.keys(poll.votes || {}).length;
            const myVote = poll.votes ? poll.votes[currentUser.uid] : null;
            let isExpired = false;
            if(poll.deadline) { try { isExpired = new Date() > poll.deadline.toDate(); } catch(e) {} }
            
            let optionsHtml = '';
            (poll.options || []).forEach((opt, idx) => {
                let count = 0;
                if (poll.votes) Object.values(poll.votes).forEach(v => { if(v == idx) count++; });
                const pct = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
                const isSelected = myVote === idx;
                const barColor = isSelected ? 'bg-[#006400]' : 'bg-gray-300';
                const textColor = isSelected ? 'text-[#006400]' : 'text-gray-700';
                const border = isSelected ? 'border-[#FFD700] border-2' : 'border-gray-200 border';
                
                const clickAction = isExpired ? '' : `onclick="window.votePoll('${poll.id}', ${idx})"`;

                optionsHtml += `
                <div ${clickAction} class="mb-2 relative rounded-lg overflow-hidden ${border} bg-white h-10 px-3 cursor-pointer btn-press shadow-sm select-none flex items-center justify-between group hover:bg-gray-50">
                    <div class="absolute top-0 left-0 bottom-0 ${barColor} opacity-30 transition-all duration-500 pointer-events-none" style="width: ${pct}%; z-index: 0;"></div>
                    <span class="relative z-10 text-xs font-bold ${textColor} pointer-events-none flex items-center">
                        ${opt} ${isSelected ? '<i class="fas fa-check-circle ml-2 text-green-600"></i>' : ''}
                    </span>
                    <span class="relative z-10 text-[10px] font-black text-gray-500 pointer-events-none">${pct}%</span>
                </div>`;
            });

            return `
            <div class="card-cut bg-white border-t-4 border-blue-600 mb-4 p-4 shadow-md relative overflow-hidden">
                <div class="flex justify-between items-start mb-3">
                    <h3 class="font-black text-blue-800 text-sm uppercase"><i class="fas fa-poll-h mr-2"></i>${poll.question}</h3>
                    ${isExpired ? '<span class="bg-red-100 text-red-600 text-[8px] font-bold px-2 py-1 rounded">ENCERRADA</span>' : ''}
                </div>
                <div class="flex flex-col">${optionsHtml}</div>
                <p class="text-[9px] text-gray-400 text-right mt-2 font-bold">${totalVotes} votos • ${isExpired ? 'Finalizada' : 'Toque na opção para votar'}</p>
            </div>`;
        };

        window.votePoll = async (pid, idx) => {
            if(!currentUser) { alert("Faça login para votar."); return; }
            try {
                const ref = doc(db, "polls", pid);
                await setDoc(ref, { [`votes.${currentUser.uid}`]: idx }, { merge: true });
                loadMatches();
            } catch(e) { console.error("Erro enquete:", e); alert("Erro ao salvar voto."); }
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

        async function loadMatches() {
        const container = document.getElementById('matchesScreen');
        document.getElementById('progressBar').classList.remove('hidden');
        try {
            // 1. BUSCA TUDO (Adicionado: layout, banners, polls)
            const [setSnap, matchesSnap, guessesSnap, uSnap, commentsSnap, newsSnap, layoutSnap, bannersSnap, pollsSnap] = await Promise.all([
                getDoc(doc(db, "settings", "competitions")), 
                getDocs(collection(db, "matches")), 
                getDocs(collection(db, "guesses")),
                getDocs(collection(db, "users")), 
                getDocs(collection(db, "match_comments")), 
                getDoc(doc(db, "settings", "news")),
                getDoc(doc(db, "settings", "home_layout")), 
                getDocs(collection(db, "banners")), 
                getDocs(collection(db, "polls"))
            ]);

            // ... (Processamento de dados padrão - mantido para brevidade) ...
            const totalParticipants = uSnap.size || 1;
            // --- NOVO TRECHO (LINHA DO TEMPO) ---
            // Cria uma lista com a data de entrada de cada usuário para o cálculo correto
            const allUsersData = uSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // Se não tiver data, assume AGORA (new Date()), para proteger usuários novos em jogos velhos
                createdAt: doc.data().createdAt ? doc.data().createdAt.toDate() : new Date()
            }));
            // ------------------------------------
            if(setSnap.exists()) (setSnap.data().items||[]).forEach(i => compMap[i.name] = i.logo);
            
            const statsMap = {}; const myVotesMap = {};
            const guessesData = []; // <--- VARIÁVEL QUE FALTAVA
            guessesSnap.forEach(d => {
                const g = d.data();
                guessesData.push(g); // <--- PREENCHENDO A VARIÁVEL
                if(g.userId === currentUser.uid) myVotesMap[g.matchId] = g.teamSelected;
                if(!statsMap[g.matchId]) statsMap[g.matchId] = { teamA: 0, teamB: 0, total: 0 };
                if(!statsMap[g.matchId][g.teamSelected]) statsMap[g.matchId][g.teamSelected] = 0;
                statsMap[g.matchId][g.teamSelected]++; statsMap[g.matchId].total++;
            });

            globalServerCounts = {};
            commentsSnap.forEach(d => { const mid = d.data().matchId; globalServerCounts[mid] = (globalServerCounts[mid]||0)+1; });

            // 1. DADOS BRUTOS & ORDENAÇÃO
            const now = new Date();
            let matches = [];

            matchesSnap.forEach(d => {
                const m = {id: d.id, ...d.data()};
                
                if(m.deadline) {
                    m.deadlineDate = m.deadline.toDate();
                    m.expired = now > m.deadlineDate;
                    m.final = (m.round || "").toLowerCase() === 'final';
                    m.stats = statsMap[m.id] || {};
                    matches.push(m);
                }
            });

            // CORREÇÃO CRÍTICA: Ordenação por Data (Crescente) E ID (Desempate)
            // ORDENAÇÃO OFICIAL: 1. Prazo > 2. Criação (Antigo 1º) > 3. ID
            matches.sort(matchComparator);
            
            window.cachedMatches = matches;

            // 2. SEPARAÇÃO NAS ABAS
            let open = [], waiting = [], finished = [];
            let totalUnread = 0;
            
            matches.forEach((m, idx) => {
                m.matchNumber = idx + 1; // Numeração baseada na ordem correta
                
                const sCount = globalServerCounts[m.id] || 0;
                const lCount = parseInt(localStorage.getItem(`read_count_${m.id}`) || "0");
                if (sCount > lCount) totalUnread++;
                
                if(m.winner) finished.push(m);
                else if(m.expired) waiting.push(m);
                else open.push(m);
            });

           // CORREÇÃO FINAL:
           // Aguardando: Usa a mesma lógica padrão (Crescente)
waiting.sort(matchComparator);

// Finalizados: Inverso (Do mais recente para o mais antigo)
finished.sort((a,b) => matchComparator(b, a)); // Note o (b, a) para inverter
            // --- LÓGICA SDUI (NOVA) ---
            let order = ["ticker", "matches_open", "matches_wait", "matches_done"];
            if (layoutSnap.exists() && layoutSnap.data().order) order = layoutSnap.data().order;
            
            const bannersMap = {}; bannersSnap.forEach(d => bannersMap[d.id] = d.data());
            const pollsMap = {}; pollsSnap.forEach(d => pollsMap[d.id] = {id: d.id, ...d.data()});

            let finalHtml = "";
            
            // --- CORREÇÃO: CRIAR A VARIÁVEL QUE FALTA ---
            // Cria a lista de jogos com prazo vencido (usado para a medalha Fantasma no letreiro)
            const expiredMatches = matches.filter(m => m.deadlineDate < new Date());
            // --------------------------------------------

            const newsContent = generateNewsFeed(
                newsSnap, 
                guessesData, 
                finished, 
                allUsersData, 
                expiredMatches // Agora a variável existe e o erro sumirá!
            );
            
            const tickerBlock = `<div class="card-container mb-4"><div class="ticker-container shadow-lg"><div class="ticker-wrapper"><div class="ticker-item">${newsContent}</div></div></div></div>`;

            for (const item of order) {
                if (item === "ticker") finalHtml += tickerBlock;
                
                else if (item.startsWith("banner_")) {
                    let bid = item; 
                    if(!bannersMap[item]) bid = item.replace("banner_", "");
                    const bData = bannersMap[bid] || bannersMap[item];
                    if(bData) finalHtml += renderBanner(bData);
                }
                
                else if (item === "matches_open") {
                    const pulse = open.some(m => !myVotesMap[m.id]) ? '<span class="pulse-dot"></span>' : '';
                    // Passa allUsersData aqui também
                    finalHtml += `<div onclick="window.toggleOpen()" class="card-container mb-3 cursor-pointer btn-press"><div class="bg-white/90 border border-[#006400] rounded-tl-2xl rounded-br-2xl p-2 text-center shadow-sm flex justify-between items-center px-4"><h4 class="font-bold text-[#006400] uppercase tracking-wider text-xs flex-1">✅ (${open.length}) DISPONÍVEIS ${pulse}</h4><i id="iconOpen" class="fas fa-chevron-up text-[#006400]"></i></div></div><div id="openContainer">${open.length > 0 ? await renderMatchList(open, allUsersData, globalServerCounts, myVotesMap) : `<div class="text-center text-black text-[12px] italic mb-6 font-bold">Nenhum confronto aberto.</div>`}</div>`;
                }
                
                else if (item === "matches_wait") {
                    // Passa allUsersData aqui também
                    finalHtml += `<div onclick="window.toggleWaiting()" class="card-container mb-3 cursor-pointer btn-press"><div class="bg-white/90 border border-[#FBC02D] rounded-tl-2xl rounded-br-2xl p-2 text-center shadow-sm flex justify-between items-center px-4"><h4 class="font-bold text-[#FBC02D] uppercase tracking-wider text-xs flex-1">⏳ (${waiting.length}) AGUARDANDO</h4><i id="iconWaiting" class="fas fa-chevron-down text-[#FBC02D]"></i></div></div><div id="waitingContainer" class="${waiting.length > 0 ? 'hidden' : ''}">${waiting.length > 0 ? await renderMatchList(waiting, allUsersData, globalServerCounts, myVotesMap) : `<div class="text-center text-black text-[12px] italic mb-6 font-bold">Nenhum confronto aguardando.</div>`}</div>`;
                }
                
                else if (item === "matches_done") {
                    if (finished.length > 0) {
                        // Passa allUsersData aqui também
                        finalHtml += `<div onclick="window.toggleFinished()" class="card-container mb-3 cursor-pointer btn-press"><div class="bg-white/90 border border-[#D32F2F] rounded-tl-2xl rounded-br-2xl p-2 text-center shadow-sm flex justify-between items-center px-4"><h4 class="font-bold text-[#D32F2F] uppercase tracking-wider text-xs flex-1">🚫 (${finished.length}) FINALIZADOS</h4><i id="iconFinished" class="fas fa-chevron-down text-[#D32F2F]"></i></div></div><div id="finishedContainer" class="hidden">${await renderMatchList(finished, allUsersData, globalServerCounts, myVotesMap)}</div>`;
                    }
                }
                
                else if (item === "poll") {
                    Object.values(pollsMap).filter(p=>p.active).forEach(p => finalHtml += renderPoll(p));
                }
            }
            container.innerHTML = finalHtml;
            window.updateBadges();

            const bell = document.getElementById('btnBell');
            const old = bell.querySelector('.bell-badge'); if(old) old.remove();
            if(totalUnread > 0) bell.innerHTML += `<div class="bell-badge">${totalUnread > 9 ? '+' : totalUnread}</div>`;

            let pendingCount = 0; open.forEach(m => { if (!myVotesMap[m.id]) pendingCount++; });
            const navBtn = document.getElementById('nav-matches'); const oldBadge = document.getElementById('matches-badge'); if(oldBadge) oldBadge.remove();
            if (pendingCount > 0) navBtn.innerHTML += `<span id="matches-badge" class="nav-badge">${pendingCount}</span>`;

        } catch(e) { console.error("Erro fatal loadMatches:", e); }
        document.getElementById('progressBar').classList.add('hidden');
    }

        // --- RENDERIZA LISTA DE JOGOS (COM DATA NO BOTÃO DE VOTANTES) ---
        async function renderMatchList(list, usersList, serverCounts, myVotesMap) {
            let html = "";
            for (const m of list) {
                let userVote = myVotesMap[m.id] || ""; 
                
                const dl = m.deadlineDate; 
                const borderColor = m.final ? 'border-[#FFD700]' : (m.expired ? (m.winner ? 'border-[#D32F2F]' : 'border-[#FBC02D]') : 'border-[#006400]'); 
                const bgColor = m.final ? 'bg-[#FFF9C4]' : 'bg-white'; 
                const logo = compMap[m.competition] || "";
                
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
                const validCount = usersList.filter(u => u.createdAt < m.deadlineDate).length;
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

                html += `<div class="card-cut relative border-l-[6px] ${bgColor} mb-6 overflow-hidden" style="border-left-color: ${borderColor.replace('border-[','').replace(']','')};">
                            ${logo ? `<img src="${logo}" class="absolute inset-0 w-full h-full object-contain opacity-[0.10] z-0 pointer-events-none p-8">` : ''}
                            <div class="relative z-10 p-3">
                                
                                <div class="flex justify-between items-start mb-2 border-b border-gray-100 pb-2">
                                    <div class="w-10">
                                        <span class="text-[14px] font-black text-gray-400">#${m.matchNumber}</span>
                                    </div>
                                    
                                    <div class="flex-1 text-center">
                                        ${m.final ? '<div class="text-[9px] font-black text-orange-600 mb-0 leading-none">★ FINAL ★</div>' : ''}
                                        <div class="text-[12px] font-black text-[#006400] uppercase tracking-wide leading-tight">${m.competition}</div>
                                    </div>
                                    
                                    <div class="w-10"></div> </div>

                                <div class="flex justify-between items-start mb-4">
                                    <div class="flex flex-col w-full pr-2">
                                        <span class="text-[10px] text-gray-500 font-bold leading-tight mb-1">${m.round}</span>
                                        <span class="text-[11px] font-black text-[#D32F2F]">${m.expired ? 'Encerrado:' : '⚠️ Prazo:'} ${dl.toLocaleTimeString([], {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    
                                    <div class="flex gap-3 pt-1">
                                        <button onclick="openMatchComments('${m.id}', '${m.teamA}', '${m.teamB}', '${m.winner||''}')" class="text-gray-500 hover:text-[#006400] transition-colors relative">
                                            <i class="fas fa-comment-dots text-xl"></i>${chatBadge}
                                        </button>
                                        <button onclick="openVoters('${m.id}', '${m.teamA}', '${m.teamB}', '${m.teamAUrl}', '${m.teamBUrl}', ${m.expired}, '${m.winner||''}', '${dl.toISOString()}')" class="text-[#006400] hover:scale-110 transition-transform">
                                            <i class="fas ${m.expired ? 'fa-eye' : 'fa-users'} text-xl"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <div class="flex items-center justify-between px-1">
                                    ${createTeamBtn(m.id, m.teamA, m.teamAUrl, userVote===m.teamA, m.expired)}
                                    <span class="font-black text-gray-300 text-xl">X</span>
                                    ${createTeamBtn(m.id, m.teamB, m.teamBUrl, userVote===m.teamB, m.expired)}
                                </div>
                                
                                ${m.winner ? `<div class="mt-3 text-center border-t pt-2"><span class="text-[10px] font-bold text-gray-400">VENCEDOR</span><p class="text-[#006400] font-black text-lg">${m.winner}</p></div>` : ''}
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
                <span class="text-[11px] font-bold text-center leading-tight px-1 line-clamp-2">${name}</span>
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
        async function loadRanking() {
            const listContainer = document.getElementById('rankingListContent');
            const footer = document.getElementById('lastUpdateRanking');

            footer.innerHTML = "";
            listContainer.innerHTML = `<div class="text-center py-10"><i class="fas fa-circle-notch fa-spin text-[#006400] text-2xl"></i></div>`;

            try {
                const [uSnap, gSnap, mSnap] = await Promise.all([
                    getDocs(collection(db, "users")),
                    getDocs(collection(db, "guesses")),
                    getDocs(collection(db, "matches"))
                ]);

                // 1. DADOS BRUTOS & DATA MATCHES
                const matches = [];
                const validMatchIds = new Set();
                mSnap.forEach(d => {
                    const data = d.data();
                    if (data.deadline) {
                        matches.push({ id: d.id, ...data, deadlineDate: data.deadline.toDate() });
                        validMatchIds.add(d.id);
                    }
                });
                const finishedMatches = matches.filter(m => m.winner);
                
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
                        let winnerVotes = 0;
                        allGuesses.forEach(g => {
                            if (g.matchId === m.id && g.teamSelected === m.winner) winnerVotes++;
                        });
                        
                        // Nova Regra: Menor ou IGUAL a 20%
                        if ((winnerVotes / validUsersAtTime) <= 0.20) {
                            zebraMatchIds.push(m.id);
                        }
                    }
                });

                // =================================================================
                // 4. CÁLCULO HISTÓRICO: REIS DO MÊS (👑)
                // =================================================================
                // Precisamos saber quem ganhou os meses anteriores para dar a medalha
                const kingCounts = {}; // { uid: 2 } (Ganhou 2 meses)
                const now = new Date();
                const currentYear = now.getFullYear();
                const currentMonthIndex = now.getMonth(); 

                // Loop pelos meses anteriores do ano (0 = Jan, até o mês passado)
                for (let m = 0; m < currentMonthIndex; m++) {
                    // Filtra jogos daquele mês/ano
                    const monthMatches = finishedMatches.filter(x => x.deadlineDate.getMonth() === m && x.deadlineDate.getFullYear() === currentYear);
                    
                    if (monthMatches.length > 0) {
                        const monthScores = {};
                        
                        // Calcula pontos só daquele mês
                        users.forEach(u => {
                            let score = 0;
                            monthMatches.forEach(match => {
                                if (u.createdDate > match.deadlineDate) return;
                                const g = allGuesses.find(gx => gx.userId === u.uid && gx.matchId === match.id);
                                if (g && g.teamSelected === match.winner) {
                                    score += (match.round?.toLowerCase() === 'final') ? 6 : 3;
                                }
                            });
                            // Bônus Oitavas daquele mês (Simplificado: se data final caiu no mês)
                            // (Logica completa de diamante omitida aqui para brevidade, focado nos pontos de jogo)
                            monthScores[u.uid] = score;
                        });

                        // Acha o líder
                        const sortedMonth = Object.entries(monthScores).sort((a,b) => b[1] - a[1]);
                        
                        // Regra: Líder ISOLADO (1º > 2º) e pontos > 0
                        if (sortedMonth.length >= 2) {
                            if (sortedMonth[0][1] > sortedMonth[1][1] && sortedMonth[0][1] > 0) {
                                const winnerId = sortedMonth[0][0];
                                kingCounts[winnerId] = (kingCounts[winnerId] || 0) + 1;
                            }
                        } else if (sortedMonth.length === 1 && sortedMonth[0][1] > 0) {
                             kingCounts[sortedMonth[0][0]] = 1;
                        }
                    }
                }

                // =================================================================
                // 5. CÁLCULO PRINCIPAL (PONTOS ATUAIS)
                // =================================================================
                let monthlyData = [];

                users.forEach(u => {
                    let p = 0, monthlyP = 0, victories = 0, finalsWon = 0, simStreak = 0;
                    const d = u.debts || 0;
                    const trophyRoom = [];
                    const hist = [];
                    const userGuesses = allGuesses.filter(g => g.userId === u.uid && validMatchIds.has(g.matchId));

                    // ORDENAÇÃO OFICIAL: Usa o comparador padrão (Deadline > CreatedAt > ID)
const chronoMatches = [...finishedMatches].sort(matchComparator);
                   // ✅ STREAKS (regras oficiais)
let noVoteStreak = 0;   // 3 seguidos sem votar => 👻
let wrongStreak  = 0;   // 3 erros seguidos     => 🥬
let gotGhost     = false;

chronoMatches.forEach(m => {
  // Linha do Tempo: Ignora jogos antes do user nascer
  if (u.createdDate > m.deadlineDate) return;

  const g = userGuesses.find(x => x.matchId === m.id);
  const isThisMonth = m.deadlineDate.getMonth() === currentMonthIndex && m.deadlineDate.getFullYear() === currentYear;
  const dateStr = `📅 ${m.deadlineDate.getDate()}/${m.deadlineDate.getMonth()+1}`;

  if (g) {
    // votou => zera "sem votar"
    noVoteStreak = 0;

    if (m.winner === g.teamSelected) {
      // acertou => zera erros
      wrongStreak = 0;

      const isFinal = (m.round && m.round.toLowerCase() === 'final');
      const pts = isFinal ? 6 : 3;
      p += pts;
      if (isThisMonth) monthlyP += pts;
      victories++;
      simStreak++;
      if (isFinal) finalsWon++;

      hist.push({ id: m.id, ts: m.deadlineDate, created: m.createdAt, text: `${dateStr} - ✅ Acerto: ${m.teamA} x ${m.teamB} (+${pts})`, type: 'good' });

      if (simStreak === 3) trophyRoom.push({ icon: "🔥", name: "ON FIRE", desc: "3 acertos seguidos.", date: dateStr, hiddenInList: false });
      if (simStreak === 5) trophyRoom.push({ icon: "🎯", name: "MITO", desc: "5 acertos seguidos.", date: dateStr, hiddenInList: false });
      if (simStreak === 10) trophyRoom.push({ icon: "👽", name: "ALIEN", desc: "10 acertos seguidos!", date: dateStr, hiddenInList: false });

      if (zebraMatchIds.includes(m.id)) trophyRoom.push({ icon: "🦓", name: "CAÇADOR DE ZEBRAS", desc: `Acertou a zebra em ${m.teamA} x ${m.teamB}`, date: dateStr, hiddenInList: false });

      if (isFinal) trophyRoom.push({ icon: "🔮", name: "MÃE DINAH", desc: "Cravou o campeão.", date: dateStr, hiddenInList: false });

    } else {
      // errou => acumula erros
      wrongStreak++;
      simStreak = 0;

      hist.push({ id: m.id, ts: m.deadlineDate, created: m.createdAt, text: `${dateStr} - 👎 Errou: ${m.teamA} x ${m.teamB}`, type: 'bad' });
    }

  } else {
    // não votou => acumula "sem votar" e zera erros
    noVoteStreak++;
    wrongStreak = 0;
    simStreak = 0;

    hist.push({ id: m.id, ts: m.deadlineDate, created: m.createdAt, text: `${dateStr} - ❌ Não votou: ${m.teamA} x ${m.teamB}`, type: 'bad' });
  }
});
                        // ✅ STATUS ATUAL (não é conquista): Fantasma só se a sequência ATUAL for >= 3 sem votar
if (noVoteStreak >= 3) {
  trophyRoom.push({
    icon: "👻",
    name: "FANTASMA",
    desc: `Está com ${noVoteStreak} jogo(s) seguidos sem votar.`,
    date: "Atual",
    hiddenInList: false
  });
}

// ✅ STATUS ATUAL (não é conquista): Mão de Alface só se a sequência ATUAL for >= 3 erros seguidos
if (wrongStreak >= 3) {
  trophyRoom.push({
    icon: "🥬",
    name: "MÃO DE ALFACE",
    desc: `Está com ${wrongStreak} erro(s) seguidos.`,
    date: "Atual",
    hiddenInList: false
  });
}



                    // Diamante
                    const oitavas = chronoMatches.filter(m => m.round === "Oitavas de final");
                    const byComp = {}; oitavas.forEach(m => { if(!byComp[m.competition]) byComp[m.competition]=[]; byComp[m.competition].push(m); });
                    for(const k in byComp) {
                        const matches = byComp[k];
                        if(matches.length === 8) {
                            const hits = matches.filter(m => userGuesses.find(g=>g.matchId===m.id && g.teamSelected===m.winner)).length;
                            if(hits === 8) { 
                                p += 3; 
                                const lastOitava = matches[matches.length-1].deadlineDate;
                                if(lastOitava.getMonth() === currentMonthIndex && lastOitava.getFullYear() === currentYear) monthlyP += 3;
                                trophyRoom.push({ icon: "💎", name: "DIAMANTE", desc: "Gabaritou Oitavas.", date: "Bônus", hiddenInList: false });
                                hist.push({ id: "diamante", ts: new Date(), text: `💎 BÔNUS: Gabarito Oitavas (+3 pts)`, type: 'good' });
                            }
                        }
                    }

                    // Veterano
                    if (victories >= 50) {
                        const level = Math.floor(victories / 50);
                        trophyRoom.push({ icon: "🎓", name: `VETERANO Nvl ${level}`, desc: `${victories} vitórias.`, date: "Carreira", hiddenInList: false });
                    }

                    // Injeta as Coroas Históricas (Calculadas no passo 4)
                    const kings = kingCounts[u.uid] || 0;
                    for(let k=0; k<kings; k++) {
                        trophyRoom.push({ icon: "👑", name: "REI DO MÊS", desc: "Líder isolado de mês anterior.", date: "2026", hiddenInList: false });
                    }

                    // Patrão
                    const monthsNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                    const isPaid = (new Date().getFullYear() < 2026) || (u.payments && u.payments[monthsNames[currentMonthIndex]]);
                    if (isPaid) trophyRoom.unshift({ icon: "💰", name: "PATRÃO", desc: "Mensalidade OK.", date: "Mês Atual", hiddenInList: false });

                    // Débitos
                    if (d > 0) {
                        p -= (d * 3);
                        hist.push({ ts: new Date(), text: `🔻 PENALIDADE: Inadimplência (-${d*3} pts)`, type: 'bad' });
                    }

                    // Amauri (Oculto na lista, mas conta pro objeto)
                    if (u.username === 'amauri') trophyRoom.push({icon: "🏆", name:"Campeão 2025", desc:"Lenda.", hiddenInList: true});

                    u.p = p; 
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
                        const countA = a.trophyRoom.filter(m => m.icon === icon && !m.hiddenInList).length;
  const countB = b.trophyRoom.filter(m => m.icon === icon && !m.hiddenInList).length;

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
                             // Adiciona ícone visualmente para aparecer na lista
                             users[i].trophyRoom.push({icon: "⚓", name:"ZONA DE PERIGO", desc:"Z-4", date:"Atual", hiddenInList: false});
                        }
                    }
                }

                currentRankingData = users;
                window.currentMonthlyRanking = monthlyData.sort((a,b) => b.points - a.points);

                // Renderiza HTML
                let html = `<div class="bg-[#006400] rounded-t-xl p-3 flex justify-between items-center shadow-md"><div><h3 class="font-black text-white text-sm tracking-wider">CLASSIFICAÇÃO</h3><p class="text-[10px] text-[#FFD700] font-bold">TEMPORADA 2026</p></div><div class="flex gap-2"><button onclick="window.showKingModal()" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg shadow border border-white/20">🏆</button><button onclick="window.openRankingInfo()" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shadow border border-white/20"><i class="fas fa-info text-xs"></i></button></div></div><div class="bg-[#005000] flex text-white/70 text-[9px] font-bold py-1 px-2 uppercase border-b border-white/10"><div class="w-[35px] text-center">Pos</div><div class="flex-1 pl-2">Participante</div><div class="w-[28px] text-center">D</div><div class="w-[40px] text-center text-white">Pts</div></div><div class="bg-white rounded-b-xl overflow-hidden shadow-sm">`;

                html += users.map((u, i) => {
                    const pos = i + 1;
                    let bgColor = 'bg-white';
                    let borderColor = 'border-transparent';
                    let posIcon = `<span class="text-gray-500 font-bold">${pos}º</span>`;
                    let nameColor = "text-gray-800";

                    if (i === 0) { bgColor = 'bg-[#FFF9C4]'; posIcon = '🥇'; borderColor = 'border-[#FFD700]'; }
                    else if (i === 1) { bgColor = 'bg-[#E0E0E0]'; posIcon = '🥈'; borderColor = 'border-gray-400'; }
                    else if (i === 2) { bgColor = 'bg-[#FFCCBC]'; posIcon = '🥉'; borderColor = 'border-[#D84315]'; }
                    else if (i === 3 || i === 4) { bgColor = 'bg-green-50'; borderColor = 'border-green-600'; posIcon = `<span class="text-green-700 font-black">${pos}º</span>`; }
                    else if (u.isZ4) { bgColor = 'bg-[#FFEBEE]'; nameColor = "text-[#8B0000]"; }

                    // Renderiza Medalhas (Agrupadas)
                    let medalsHtml = "";
                    const visibleMedals = u.trophyRoom.filter(m => !m.hiddenInList);
                    const counts = {};
                    visibleMedals.forEach(m => counts[m.icon] = (counts[m.icon]||0)+1);
                    
                    // Ordena ícones visualmente pela mesma hierarquia do sort (mais importantes primeiro)
                    // Adiciona os que não estão na hierarquia no final (Patrão, etc)
                    const visualHierarchy = ["🏆", ...medalHierarchy, "💰", "👻", "🥬", "⚓"];
                    const uniqueIcons = Object.keys(counts).sort((a,b) => {
                        let idxA = visualHierarchy.indexOf(a); if(idxA === -1) idxA = 99;
                        let idxB = visualHierarchy.indexOf(b); if(idxB === -1) idxB = 99;
                        return idxA - idxB;
                    }).slice(0, 6);

                    if (uniqueIcons.length > 0) {
                        medalsHtml = `<div class="flex items-center mt-1 space-x-1">` + 
                            uniqueIcons.map(icon => `<span class="text-[12px] leading-none">${icon}${counts[icon]>1 ? `<sup class="text-[8px] text-gray-500">${counts[icon]}</sup>`:''}</span>`).join('') + 
                        `</div>`;
                    }

                    let diffHtml = u.lastRank > 0 
                        ? (pos < u.lastRank ? `<div class="text-green-600 text-[8px] font-bold mt-1 flex justify-center"><i class="fas fa-caret-up mr-1"></i> ${u.lastRank - pos}</div>` 
                        : (pos > u.lastRank ? `<div class="text-red-600 text-[8px] font-bold mt-1 flex justify-center"><i class="fas fa-caret-down mr-1"></i> ${pos - u.lastRank}</div>` : `<div class="text-gray-300 text-[8px] font-bold mt-1 text-center">=</div>`)) 
                        : `<div class="text-blue-500 text-[7px] font-bold mt-1 text-center">NOVO</div>`;

                    return `<div class="${bgColor} border-b border-gray-100 flex items-center py-1 px-2 ${i < 5 ? 'border-l-4' : ''}" style="${i < 5 ? `border-left-color: ${borderColor.replace('border-[', '').replace(']', '')}` : ''}">
                        <div class="w-[35px] text-center flex flex-col items-center justify-center h-full"><div class="text-sm">${posIcon}</div>${diffHtml}</div>
                        <div class="flex-1 flex flex-col justify-center pl-2 overflow-hidden shrink-0 cursor-pointer h-full py-1" onclick="showModalPhoto(${i})">
                            <div class="flex items-center gap-2">
                                <div class="w-[30px] h-[30px] rounded-full bg-white border border-gray-300 flex items-center justify-center overflow-hidden shrink-0"><img src="${getAvatarUrl(u.photoBase64, u.name)}" class="w-full h-full object-cover"></div>
                                <div class="flex flex-col w-full overflow-hidden">
                                    <div class="flex items-center"><span class="text-xs font-bold ${nameColor} truncate max-w-[140px]">${u.name || u.username}</span></div>
                                    ${medalsHtml}
                                </div>
                            </div>
                        </div>
                        <div class="w-[28px] text-center text-xs font-bold ${u.debts > 0 ? 'text-red-600' : 'text-gray-300'}" onclick="showModalHistory(${i})">${u.debts||0}</div>
                        <div class="w-[40px] text-center text-sm font-black text-[#006400]" onclick="showModalHistory(${i})">${u.p}</div>
                    </div>`;
                }).join('');

                html += `</div>`;
                listContainer.innerHTML = html;

            } catch (e) { console.error(e); listContainer.innerHTML = `<div class="text-center text-red-500 text-xs">Erro ao carregar ranking.</div>`; }
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
    <div class="w-full max-w-sm rounded-none shadow-2xl overflow-hidden relative" style="max-height: 90vh; overflow-y: auto;">
      <div class="absolute inset-0 bg-gradient-to-b from-[#071018] via-[#0b1622] to-[#071018]"></div>

      <div class="relative z-10 p-5 text-white">
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

window.showKingModal = () => {
            const modal = document.getElementById('modalOverlay');
            const cont = document.getElementById('modalContainer');
            modal.classList.remove('hidden');
            
            const months = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
            const currentMonthName = months[new Date().getMonth()];
            
            const ranking = window.currentMonthlyRanking || [];
            
            // Verifica líder isolado para exibir a coroa apenas aqui
            let hasKing = false;
            if(ranking.length > 0 && ranking[0].points > 0) {
                if(ranking.length === 1) hasKing = true;
                else if(ranking[0].points > ranking[1].points) hasKing = true;
            }

            let listHtml = "";
            if(ranking.length === 0 || ranking[0].points === 0) {
                listHtml = `<div class="text-center p-6 text-xs text-gray-500 italic">Nenhum ponto marcado neste mês ainda.</div>`;
            } else {
                listHtml = ranking.map((u, i) => {
                    const isKingRow = i === 0 && hasKing;
                    const bg = isKingRow ? 'bg-[#FFF9C4]' : 'bg-white';
                    const icon = isKingRow ? '👑 ' : '';
                    const bold = isKingRow ? 'font-black' : 'font-normal';
                    const color = isKingRow ? 'text-[#006400]' : 'text-black';
                    
                    return `
                    <div class="flex items-center justify-between p-3 border-b border-gray-100 ${bg} shrink-0">
                        <div class="flex items-center gap-3 overflow-hidden">
                            <span class="text-xs font-bold text-gray-400 w-6 text-center shrink-0">${i+1}º</span>
                            <span class="text-xs ${bold} truncate max-w-[150px]">${icon}${u.name}</span>
                        </div>
                        <span class="text-sm ${bold} ${color} shrink-0">${u.points}</span>
                    </div>`;
                }).join('');
            }

            // CORREÇÃO IPHONE: Estrutura flexível com altura máxima controlada
            cont.innerHTML = `
            <div class="bg-white rounded-lg shadow-2xl relative overflow-hidden w-[95%] max-w-sm mx-auto flex flex-col" style="max-height: 80vh;">
                <img src="bg_ranking.png" class="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none">
                
                <div class="relative z-10 bg-[#006400] p-4 text-center shrink-0">
                    <div class="text-3xl mb-1">🏆</div>
                    <h3 class="font-black text-[#FFD700] text-lg tracking-widest uppercase leading-none">REI DE ${currentMonthName}</h3>
                    <p class="text-[10px] text-white font-bold opacity-80 uppercase mt-1">Classificação Mensal</p>
                </div>
                
                <div class="relative z-10 flex justify-between bg-gray-100 p-2 text-[10px] font-bold text-gray-500 uppercase shrink-0 border-b">
                    <span class="pl-4">Participante</span>
                    <span class="pr-2">Pts</span>
                </div>

                <div class="relative z-10 overflow-y-auto flex-1 bg-white/80 overscroll-contain">
                    ${listHtml}
                </div>

                <div class="relative z-10 p-3 bg-gray-50 shrink-0 border-t pb-safe">
                    <button onclick="closeModal()" class="w-full bg-[#006400] text-white py-3 rounded font-bold shadow btn-press text-sm">FECHAR</button>
                </div>
            </div>`;
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
                    <img src="bg_dialog_foto.png" class="absolute inset-0 w-full h-full object-cover opacity-100">
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
                    <img src="bg_perfil.jpeg" class="absolute inset-0 w-full h-full object-cover opacity-15 pointer-events-none">

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
        
       window.showModalHistory = (idx) => { 
            const u = currentRankingData[idx]; 
            if(!u) return;
               // Guarda de qual extrato estamos vindo (para o botão VOLTAR no modal de palpites)
window.__fromHistoryIdx = idx;
window.__fromHistoryUid = u.uid;

            
            const html = (u.hist && u.hist.length > 0)
  ? u.hist.map(h => {
      const colorClass = (h.type === 'bad') ? 'text-red-600' : 'text-[#2E7D32]';

      // Só deixa clicável se tiver id de match e não for item "especial"
      const isMatch = h.id && h.id !== "diamante";

      if (!isMatch) {
        return `<div class="border-b border-gray-300/50 py-2 text-xs font-bold ${colorClass}">${h.text}</div>`;
      }

      return `
        <button
          type="button"
          onclick="window.goToMatchRegisteredBets('${String(h.id).replace(/'/g, "\\'")}', window.__fromHistoryIdx)"
          class="w-full text-left border-b border-gray-300/50 py-2 text-xs font-bold ${colorClass} hover:bg-black/5 active:bg-black/10 rounded px-1"
          title="Abrir palpites registrados deste confronto"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="leading-snug">${h.text}</span>
            <i class="fas fa-chevron-right text-[10px] opacity-60"></i>
          </div>
        </button>
      `;
    }).join('')
  : "<div class='text-center py-4 text-gray-400 text-xs'>Nenhum registro encontrado.</div>";

            
            document.getElementById('modalOverlay').classList.remove('hidden'); 
            document.getElementById('modalContainer').innerHTML = `
            <div class="w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden relative">
                <img src="bg_dialog_extrato.jpeg" class="absolute inset-0 w-full h-full object-cover opacity-20">
                <div class="relative z-10 p-6 flex flex-col items-center h-[60vh]">
                    <i class="fas fa-file-invoice-dollar text-[#006400] text-3xl mb-2"></i>
                    <div class="bg-white/80 rounded px-3 py-1 mb-1 shadow-sm"><h3 class="font-black text-[#006400] uppercase text-sm">Extrato de Pontos</h3></div>
                    <div class="bg-white/80 rounded px-2 py-1 mb-4 shadow-sm"><h2 class="font-black text-black text-lg">${u.name}</h2></div>
                    <div class="w-full bg-white/90 rounded-lg shadow-inner p-3 flex-1 overflow-y-auto border border-gray-200">
                        ${html}
                    </div>
                    <button onclick="closeModal()" class="mt-4 w-full bg-[#006400] text-white font-bold py-3 rounded shadow-lg btn-press">FECHAR</button>
                </div>
            </div>`; 
        };
        
        // --- LEGENDA MEDALHAS ATUALIZADA (MITO, DIAMANTE...) ---

        window.openAdminMenu = () => {
            const modal = document.getElementById('modalOverlay'); 
            const cont = document.getElementById('modalContainer'); 
            modal.classList.remove('hidden');
            
            cont.innerHTML = `
            <div class="w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden relative h-[85vh] flex flex-col">
                <img src="bg_painel_admin.jpeg" class="absolute inset-0 w-full h-full object-cover opacity-100">
                
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
                                <button onclick="alert('Funcionalidade nativa do Android.')" class="bg-[#1565C0] text-white py-3 rounded font-bold text-xs shadow btn-press flex flex-col items-center gap-1"><i class="fas fa-plus-circle text-lg"></i> Novo Jogo</button>
                                                                <button onclick="alert('Funcionalidade nativa do Android.')" class="bg-[#2E7D32] text-white py-3 rounded font-bold text-xs shadow btn-press flex flex-col items-center gap-1"><i class="fas fa-check-circle text-lg"></i> Baixa Rápida</button>
                                <button onclick="openTrashBin()" class="bg-gray-700 text-white py-3 rounded font-bold text-xs shadow btn-press flex flex-col items-center gap-1"><i class="fas fa-trash text-lg"></i> Lixeira</button>
                            </div>
                        </div>

                        <div>
                            <h4 class="text-xs font-bold text-gray-500 mb-2 pl-1">👥 PESSOAS & FINANCEIRO</h4>
                            <button onclick="openFinancialScreen()" class="w-full bg-[#C62828] text-white py-4 rounded font-bold text-xs shadow btn-press flex items-center justify-center gap-2">
                                <i class="fas fa-wallet text-lg"></i> GERENCIAR PAGAMENTOS & USUÁRIOS
                            </button>
                        </div>

                        <div>
                            <h4 class="text-xs font-bold text-gray-500 mb-2 pl-1">📢 COMUNICAÇÃO</h4>
                            <div class="grid grid-cols-2 gap-2">
                                <button onclick="alert('Funcionalidade nativa do Android.')" class="bg-[#6A1B9A] text-white py-3 rounded font-bold text-xs shadow btn-press flex flex-col items-center gap-1"><i class="fas fa-bell text-lg"></i> Enviar Push</button>
                                <button onclick="openCompetitionsManager()" class="bg-[#F9A825] text-white py-3 rounded font-bold text-xs shadow btn-press flex flex-col items-center gap-1"><i class="fas fa-trophy text-lg"></i> Competições</button>
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
                if(m.deadline) m.deadlineDate = m.deadline.toDate();
                all.push({id: d.id, ...m});
            });

            // Ordena para numerar
            all.sort(matchComparator);

            // Gera HTML (Exibindo na ordem inversa para facilitar edição dos recentes, mas com o número certo)
            let html = ""; 
            [...all].reverse().forEach((m) => { 
                // Encontra o índice na lista original ordenada
                const number = all.findIndex(x => x.id === m.id) + 1;

                html += `<div class="flex justify-between items-center p-2 border-b border-gray-100">
                    <div class="flex flex-col truncate w-2/3">
                        <span class="font-bold text-black text-xs">#${number} ${m.teamA} x ${m.teamB}</span>
                        <span class="text-[10px] text-gray-400">${m.competition}</span>
                    </div>
                    <div class="flex gap-2">
                        <button class="text-blue-500" onclick="alert('Edição apenas no App')"><i class="fas fa-edit"></i></button>
                        <button class="text-red-500" onclick="moveToTrash('${m.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`; 
            }); 
            listDiv.innerHTML = html || "Sem jogos."; 
        }
        // --- LIXEIRA WEB ---
        window.moveToTrash = async (matchId) => { if(!confirm("Mover para Lixeira?")) return; try { const snap = await getDoc(doc(db, "matches", matchId)); if(snap.exists()) { await setDoc(doc(db, "bin_matches", matchId), {...snap.data(), deletedAt: new Date()}); await deleteDoc(doc(db, "matches", matchId)); loadAdminMatches(); loadMatches(); } } catch(e){alert(e.message);} };
        window.openTrashBin = async () => { const cont = document.getElementById('modalContainer'); const snap = await getDocs(collection(db, "bin_matches")); let html = `<div class="w-full bg-white h-[85vh] p-4 overflow-y-auto"><div class="flex justify-between mb-4"><button onclick="openAdminMenu()"><i class="fas fa-arrow-left"></i></button><h3 class="font-bold">Lixeira</h3><div></div></div>`; if(snap.empty) html += "<p>Vazia.</p>"; else snap.forEach(d => { const m = d.data(); html += `<div class="border p-2 mb-2 rounded flex justify-between"><span>${m.teamA} x ${m.teamB}</span><button onclick="restoreMatch('${d.id}')" class="text-green-600 font-bold">Restaurar</button></div>`; }); html += "</div>"; cont.innerHTML = html; };
        window.restoreMatch = async (matchId) => { try { const snap = await getDoc(doc(db, "bin_matches", matchId)); if(snap.exists()) { const d = snap.data(); delete d.deletedAt; await setDoc(doc(db, "matches", matchId), d); await deleteDoc(doc(db, "bin_matches", matchId)); openTrashBin(); loadMatches(); } } catch(e){alert(e.message);} };

        window.openCompetitionsManager = async () => {
            const cont = document.getElementById('modalContainer'); cont.innerHTML = `<div class="bg-white p-6 text-center"><i class="fas fa-spinner fa-spin text-2xl text-[#006400]"></i></div>`;
            const docRef = doc(db, "settings", "competitions"); const snap = await getDoc(docRef);
            let comps = snap.exists() ? (snap.data().items || []) : [];
            const render = () => {
                let html = `<div class="w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden relative h-[85vh]"><img src="bg_painel_admin.jpeg" class="absolute inset-0 w-full h-full object-cover"><div class="relative z-10 flex flex-col h-full bg-white/80 p-4"><div class="flex justify-between items-center mb-4"><button onclick="openAdminMenu()"><i class="fas fa-arrow-left text-black text-xl"></i></button><h3 class="font-bold text-black text-lg">Competições</h3><div class="w-6"></div></div><div class="bg-white p-3 rounded border mb-4"><h4 class="font-bold text-xs text-[#006400] mb-2">Nova/Editar</h4><input type="text" id="compName" placeholder="Nome (ex: Copa do Mundo)" class="w-full border p-2 text-xs rounded mb-2"><input type="text" id="compLogo" placeholder="URL do Logo" class="w-full border p-2 text-xs rounded mb-2"><button onclick="saveComp()" class="w-full bg-[#EF6C00] text-white py-2 rounded font-bold text-xs shadow">SALVAR</button></div><div class="flex-1 overflow-y-auto space-y-2">`;
                comps.forEach((c, idx) => { html += `<div class="bg-white p-2 rounded border flex justify-between items-center shadow-sm"><div class="flex items-center gap-2"><img src="${c.logo}" class="w-8 h-8 object-contain bg-gray-100 rounded"> <span class="font-bold text-xs text-black">${c.name}</span></div><button onclick="deleteComp(${idx})" class="text-red-500"><i class="fas fa-trash"></i></button></div>`; });
                html += `</div></div></div>`; cont.innerHTML = html;
            };
            window.saveComp = async () => { const n = document.getElementById('compName').value; const l = document.getElementById('compLogo').value; if(n) { comps.push({name:n, logo:l}); await setDoc(docRef, {items: comps}); render(); } };
            window.deleteComp = async (idx) => { if(confirm("Remover?")) { comps.splice(idx, 1); await setDoc(docRef, {items: comps}); render(); } };
            render();
        };

       // --- CORREÇÃO DO PAINEL FINANCEIRO E PAGAMENTO ---

        window.openFinancialScreen = async () => {
            const modal = document.getElementById('modalOverlay');
            const cont = document.getElementById('modalContainer');
            modal.classList.remove('hidden');
            cont.innerHTML = `<div class="bg-white p-6 text-center"><i class="fas fa-spinner fa-spin text-2xl text-[#006400]"></i></div>`;

            try {
                // Busca dados atualizados
                const snap = await getDocs(collection(db, "users"));
                let usersList = [];
                snap.forEach(d => { const u = d.data(); usersList.push({id: d.id, ...u}); });
                usersList.sort((a,b) => (a.name||"").localeCompare(b.name||""));

                let html = `<div class="w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden relative" style="max-height: 85vh; display:flex; flex-direction:column;">
                    <div class="bg-[#006400] p-4 text-white flex justify-between items-center shrink-0">
                        <h3 class="font-bold uppercase text-sm">Financeiro</h3>
                        <button onclick="window.closeModal()"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="flex-1 overflow-y-auto p-2 bg-gray-50">`;

                const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                
                usersList.forEach(u => {
                    // Ícone de chave se tiver dica
                    const hintIcon = u.passwordHint ? `<i class="fas fa-key text-orange-400 text-xs ml-2 cursor-pointer" onclick="alert('Dica: ${u.passwordHint}')" title="Ver Dica"></i>` : '';

                    html += `<div class="bg-white border rounded p-2 mb-2 shadow-sm">
                        <div class="flex justify-between items-center mb-2">
                            <span class="font-bold text-xs text-gray-800 flex items-center">${u.name} ${hintIcon}</span>
                            <div class="flex items-center gap-2">
                                <button onclick="window.changeDebt('${u.id}', -1)" class="text-gray-400 bg-gray-100 p-1 rounded"><i class="fas fa-minus-circle"></i></button>
                                <span class="text-red-600 font-black text-xs min-w-[30px] text-center">${u.debts||0}</span>
                                <button onclick="window.changeDebt('${u.id}', 1)" class="text-red-500 bg-red-50 p-1 rounded"><i class="fas fa-plus-circle"></i></button>
                            </div>
                        </div>
                        <div class="grid grid-cols-6 gap-1">`;
                    
                    months.forEach(m => {
                        const isPaid = u.payments && u.payments[m];
                        const bg = isPaid ? "bg-green-600 text-white border-green-600 shadow-md" : "bg-gray-100 text-gray-400 border-gray-200";
                        // AQUI ESTAVA O ERRO: Passamos apenas ID e Mês. O JS resolve o resto.
                       // Correção: Passamos apenas o ID e o Mês. O status é calculado na função.
                    html += `<div onclick="window.togglePay('${u.id}', '${m}')" class="${bg} border text-[8px] font-bold py-1 rounded text-center cursor-pointer select-none hover:opacity-80 transition-all">${m}</div>`;
                    });
                    html += `</div></div>`;
                });
                
                html += `</div><div class="p-2 bg-gray-100 border-t shrink-0"><button onclick="window.checkDelays()" class="w-full bg-red-600 text-white font-bold py-2 rounded text-xs shadow">AUDITORIA DE ATRASOS</button></div></div>`;
                cont.innerHTML = html;
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
        window.checkDelays = async () => { const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]; const now = new Date(); const currMonth = months[now.getMonth()]; const day = now.getDate(); if (day <= 10) { alert(`Hoje é dia ${day}. Atrasos só após dia 10.`); return; } const cont = document.getElementById('modalContainer'); cont.innerHTML = `<div class="bg-white p-6 text-center"><i class="fas fa-spinner fa-spin text-2xl text-[#006400]"></i></div>`; const snap = await getDocs(collection(db, "users")); let late = []; snap.forEach(d => { const u = d.data(); if (!u.payments || !u.payments[currMonth]) { late.push({id: d.id, name: u.name, debts: u.debts || 0}); } }); let html = `<div class="w-full bg-white h-[60vh] p-6 rounded shadow relative"><button onclick="openFinancialScreen()" class="absolute top-2 right-2"><i class="fas fa-times"></i></button><h3 class="font-bold text-red-700 text-lg mb-4">Auditoria: ${currMonth}</h3>`; if (late.length === 0) { html += `<p class="text-green-600 font-bold">✅ Ninguém está atrasado!</p>`; } else { html += `<div class="max-h-[30vh] overflow-y-auto mb-4 border p-2">`; late.forEach(l => { html += `<p class="text-xs text-red-500">• ${l.name}</p>`; }); html += `</div><p class="text-xs mb-4">Deseja adicionar +1 ponto de inadimplência para todos?</p><button onclick="applyBatchPenalty()" class="w-full bg-red-600 text-white font-bold py-3 rounded">APLICAR PENALIDADE</button>`; } html += `</div>`; cont.innerHTML = html; window.applyBatchPenalty = async () => { if(!confirm("Confirmar aplicação de multa em massa?")) return; const batch = writeBatch(db); late.forEach(l => { const ref = doc(db, "users", l.id); batch.update(ref, { debts: l.debts + 1 }); }); await batch.commit(); alert("Penalidades aplicadas!"); openFinancialScreen(); }; };

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
            <div id="pixArea" class="hidden fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" onclick="if(event.target === this) this.classList.add('hidden')">
                <div class="relative bg-white rounded-lg w-full max-w-sm overflow-hidden shadow-2xl border border-gray-200">
                    <div class="absolute inset-0 z-0">
                        <img src="bg_pix.jpeg" class="w-full h-full object-cover opacity-50">
                    </div>
                    
                    <div class="relative z-10 p-6 pt-8 text-center">
                        <button onclick="document.getElementById('pixArea').classList.add('hidden')" class="absolute top-2 right-2 text-[#006400] p-2 hover:scale-110 transition-transform"><i class="fas fa-times text-xl"></i></button>
                        
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

            // HTML DA TELA DE PERFIL (GRADE LIMPA)
            const profileHTML = `
            <div id="profileScreen" class="animate-fade-in p-4">
                ${pixModalHTML}
                
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
                            <div class="mt-2 inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-[10px] font-bold text-gray-600">
                                <i class="fas fa-crown text-[#FFD700]"></i> SÓCIO TORCEDOR
                            </div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3 mb-6">
                    <label class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 btn-press cursor-pointer">
                        <div class="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600"><i class="fas fa-camera text-lg"></i></div>
                        <span class="text-xs font-bold text-gray-700">Mudar Foto</span>
                        <input type="file" id="uploadPhoto" accept="image/*" class="hidden" onchange="handlePhotoUpload(this)">
                    </label>

                    <button onclick="changePassword()" class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 btn-press">
                        <div class="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600"><i class="fas fa-lock text-lg"></i></div>
                        <span class="text-xs font-bold text-gray-700">Senha</span>
                    </button>
                    
<button onclick="openRulesModal()" class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 btn-press col-span-2">
  <div class="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700">
    <i class="fas fa-scroll text-lg"></i>
  </div>
  <span class="text-xs font-bold text-gray-700">Regras</span>
</button>

                    <!-- Linha: CALENDÁRIO + GUIA -->
<button onclick="window.openCalendar2026()" class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 btn-press">
  <div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-700">
    <i class="fas fa-calendar-alt text-lg"></i>
  </div>
  <span class="text-xs font-bold text-gray-700">Calendário</span>
</button>

<button onclick="showAppGuide()" class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 btn-press">
  <div class="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
    <i class="fas fa-info-circle text-lg"></i>
  </div>
  <span class="text-xs font-bold text-gray-700">Guia do App</span>
</button>



                <div class="space-y-3 mb-8">
                     <div id="financialCard" class="p-4 rounded-lg border shadow-sm cursor-pointer btn-press flex justify-between items-center transition-colors ${finCardClass}" onclick="document.getElementById('pixArea').classList.remove('hidden')">
                        <div class="text-left">
                            <p class="font-black text-sm ${isPaid ? 'text-green-800' : 'text-red-800'}">${finStatusText}</p>
                            <p class="text-[10px] font-bold opacity-70">Toque para detalhes</p>
                        </div>
                        <i class="fas ${finIcon} text-2xl"></i>
                    </div>
                    ${u.isAdmin ? `<button onclick="openAdminMenu()" class="w-full bg-gray-800 text-white py-3 rounded-lg font-bold text-xs shadow-lg btn-press"><i class="fas fa-cogs mr-2"></i> PAINEL DO ADMIN</button>` : ''}
                </div>

                <div class="text-center pb-safe">
                    <div class="version-chip">Web v1.7</div>
                    <p class="text-[9px] text-gray-400 mt-2 font-bold uppercase">Bolão 112 F.C • 2026</p>
                </div>
            </div>`;

            document.getElementById('profileScreen').innerHTML = profileHTML;
            document.getElementById('profileScreen').classList.remove('hidden');

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

        window.changeDebt = async (uid, delta) => { const ref = doc(db, "users", uid); const u = await getDoc(ref); let debts = u.data().debts || 0; debts += delta; if(debts < 0) debts = 0; await updateDoc(ref, { debts: debts }); openFinancialScreen(); };
        document.getElementById('financialCard').onclick = () => document.getElementById('pixArea').classList.remove('hidden');
        window.copyKeyOnly = () => { document.getElementById('pixKey').select(); document.execCommand('copy'); alert("Chave Pix Copiada!"); };
        document.getElementById('btnCopyPix').onclick = () => { alert("Copie a chave manual abaixo por enquanto."); };
        window.changePassword = () => { document.getElementById('modalOverlay').classList.remove('hidden'); document.getElementById('modalContainer').innerHTML = `<div class="w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden relative"><img src="bg_login2.png" class="absolute inset-0 w-full h-full object-cover opacity-15"><div class="relative z-10 p-6"><h3 class="font-black text-[#006400] text-center mb-6 text-lg uppercase">Nova Senha</h3><input type="password" id="newPassInput" placeholder="Mínimo 6 caracteres" class="w-full p-3 bg-gray-50 border rounded-lg mb-6 text-sm outline-none focus:border-[#006400]"><button id="btnConfirmPass" class="w-full bg-[#006400] text-white py-3 font-bold rounded-lg shadow-lg btn-press">CONFIRMAR</button><button onclick="closeModal()" class="w-full text-black font-black text-xs mt-4">CANCELAR</button></div></div>`; document.getElementById('btnConfirmPass').onclick = () => { const newPass = document.getElementById('newPassInput').value; if(newPass && newPass.length >= 6) { updatePassword(currentUser, newPass).then(() => { alert("Senha alterada com sucesso!"); closeModal(); }).catch(e => alert("Erro: Faça logout e login novamente para trocar a senha.")); } else { alert("A senha deve ter no mínimo 6 caracteres."); } }; };

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
        // --- GUIA DO APP ATUALIZADO (v1.7) ---
        window.showAppGuide = () => { 
            document.getElementById('modalOverlay').classList.remove('hidden'); 
            document.getElementById('modalContainer').innerHTML = `
            <div class="w-full max-w-sm bg-white rounded-none shadow-2xl overflow-hidden relative">
                <img src="bg_regras.png" class="absolute inset-0 w-full h-full object-cover opacity-15">
                <div class="relative z-10 bg-white/80 p-6 max-h-[85vh] overflow-y-auto">
                    <h3 class="font-bold text-lg mb-4 text-center uppercase tracking-widest text-gray-800">GUIA DO APP</h3>
                    <p class="text-center text-[10px] text-gray-500 font-bold mb-4">Versão Web v1.7</p>
                    
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
                 const snap = await getDocs(collection(db, "users"));
                 
                 let totalCotasPagas = 0; // Quantidade de meses pagos (real)
                 const totalParticipantes = snap.size; // Total de pessoas no bolão
                 
                 snap.forEach(d => {
                     const p = d.data().payments;
                     if(p) totalCotasPagas += Object.values(p).filter(Boolean).length;
                 });
                 
                 // 1. Valores Reais (O que já tem no caixa)
                 const currentPrize = totalCotasPagas * 10;
                 const currentParty = totalCotasPagas * 5;
                 const currentTotal = currentPrize + currentParty;

                 // 2. Valores de Previsão (Participantes * 12 meses * Valor)
                 const forecastPrize = totalParticipantes * 12 * 10;
                 const forecastParty = totalParticipantes * 12 * 5;

                 // Formatador de Moeda
                 const fmt = (v) => v.toLocaleString('pt-br',{style:'currency',currency:'BRL'});

                 // Atualiza HTML - Valores Reais
                 const elPot = document.getElementById('potValue');
                 const elParty = document.getElementById('partyValue');
                 const elTotal = document.getElementById('totalValue');

                 if(elPot) elPot.innerText = fmt(currentPrize);
                 if(elParty) elParty.innerText = fmt(currentParty);
                 if(elTotal) elTotal.innerText = `Total Arrecadado (Real): ${fmt(currentTotal)}`;

                 // Atualiza HTML - Previsões
                 const elPotRef = document.getElementById('potRef');
                 const elPartyRef = document.getElementById('partyRef');

                 if(elPotRef) elPotRef.innerText = `Previsão Final: ${fmt(forecastPrize)}`;
                 if(elPartyRef) elPartyRef.innerText = `Previsão Final: ${fmt(forecastParty)}`;

             // ATUALIZAÇÃO DO CONTADOR NO HTML
                 const elCount = document.getElementById('potCount');
                 if (elCount) {
                     elCount.innerText = `👥 ${totalParticipantes} PARTICIPANTES ATIVOS`;
                 }

             } catch (e) { console.error("Erro Pote:", e); }
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
                    const countA = (a.trophyRoom || []).filter(m => m.icon === icon).length;
                    const countB = (b.trophyRoom || []).filter(m => m.icon === icon).length;
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

const visibleMedals = (user.trophyRoom || []).filter(m => !m.hiddenInList);
const medalCounts = {};
visibleMedals.forEach(m => {
  medalCounts[m.icon] = (medalCounts[m.icon] || 0) + 1;
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
                    <img src="bg_ranking.jpeg" style="position: absolute; top:0; left:0; width:100%; height:100%; object-fit: cover; opacity: 0.15; mix-blend-mode: overlay;">
                    
                    <div style="position: relative; z-index: 10; flex: 1; display: flex; flex-direction: column;">
                        <h1 style="color: #FFD700; font-weight: 900; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; margin: 0;">BOLÃO 112 F.C</h1>
                        
                        <div style="background: rgba(0,0,0,0.6); border: 1px solid rgba(255,215,0,0.5); border-radius: 8px; padding: 6px; margin-top: 8px; margin-bottom: 16px;">
                            <div style="color: #FFF176; font-weight: bold; font-size: 9px;">⚠️ PRÉ-TEMPORADA (PERÍODO DE TESTES)</div>
                            <div style="color: white; font-weight: 900; font-size: 11px; margin-top: 2px;">🚀 INÍCIO OFICIAL: 1º DE FEVEREIRO</div>
                        </div>

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
                const canvas = await html2canvas(cardContainer, { scale: 2, useCORS: true, backgroundColor: null, logging: false });
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
                const ref = doc(db, "match_comments", msgId);
                const key = `reactions.${currentUser.uid}`;
                // Se clicar no mesmo, remove (toggle). Se for diferente, atualiza.
                // Como ler o estado atual é complexo no onclick, vamos apenas setar por enquanto.
                // Para toggle perfeito, precisariamos ler o doc antes, mas para performance vamos apenas escrever.
                await updateDoc(ref, { [key]: emoji });
                
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

                                        ${!isMe ? `<p class="text-[9px] font-bold text-[#006400] mb-1">${m.userName}</p>` : ''}
                                        <p class="text-gray-800 text-sm leading-snug">${m.text}</p>
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
                             <input type="text" id="commentInput" placeholder="Digite sua resenha..." class="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none border focus:border-[#006400]">
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
  
  if(msgs.length > currentCount) {
    localStorage.setItem(`read_count_${mid}`, msgs.length);
  }
  renderChat(msgs);
});
            
            window.sendComment = async (matchId) => {
                const txt = document.getElementById('commentInput').value.trim();
                if(!txt) return;
                const uDoc = await getDoc(doc(db, "users", currentUser.uid));
                const uData = uDoc.data();
                await addDoc(collection(db, "match_comments"), { 
                    matchId: matchId, 
                    userId: currentUser.uid, 
                    userName: uData.name || "Anônimo", 
                    userPhoto: uData.photoBase64 || "", 
                    text: txt, 
                    timestamp: serverTimestamp(), 
                    reactions: {} // Inicializa vazio
                });
                document.getElementById('commentInput').value = "";
                document.getElementById('commentInput').focus();
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
        <div class="grid grid-cols-[1fr_70px_70px_70px] bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white/70">
          <div>Competição</div>
          <div class="text-center">Jogos</div>
          <div class="text-center">Acertos</div>
          <div class="text-center">%</div>
        </div>
        ${compRows.map(r => `
          <div class="grid grid-cols-[1fr_70px_70px_70px] px-3 py-2 text-xs border-t border-white/10">
            <div class="text-white font-bold truncate">${r.comp}</div>
            <div class="text-center text-white/90 font-bold">${r.t}</div>
            <div class="text-center text-[#FFD700] font-black">${r.h}</div>
            <div class="text-center text-white font-black">${r.pct}%</div>
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

      window.myScoutChart = new Chart(ctx, {
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
