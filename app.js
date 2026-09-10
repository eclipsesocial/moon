// Projeto Eclipse — versão estática, sem Vite/React.
// O Firebase é usado diretamente pelo navegador através do SDK compat.

const firebaseConfig = {
  apiKey: "AIzaSyDhWlhYXPh34BuOf-kPYbGgYKVFew7fZ_g",
  authDomain: "projetoeclipse-2374b.firebaseapp.com",
  databaseURL: "https://projetoeclipse-2374b-default-rtdb.firebaseio.com",
  projectId: "projetoeclipse-2374b",
  storageBucket: "projetoeclipse-2374b.firebasestorage.app",
  messagingSenderId: "460740273909",
  appId: "1:460740273909:web:fb081ae806b15802a0c7bc",
  measurementId: "G-0806KRDLS2"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

const $ = id => document.getElementById(id);

function show(screen) {
  document.querySelectorAll(".landing,.auth-screen,.dashboard").forEach(el => el.classList.add("hidden"));
  if (screen === "home") document.querySelector(".landing").classList.remove("hidden");
  else $(screen).classList.remove("hidden");
  window.scrollTo(0,0);
}

document.addEventListener("click", e => {
  const target = e.target.closest("[data-screen]");
  if (target) show(target.dataset.screen);
});

$("registerForm").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = $("registerMsg");
  msg.textContent = "";

  const name = $("regName").value.trim();
  const username = $("regUsername").value.trim().replace(/^@/, "").toLowerCase();
  const birthDate = $("regBirth").value;
  const email = $("regEmail").value.trim().toLowerCase();
  const password = $("regPassword").value;
  const confirm = $("regConfirm").value;

  if (password !== confirm) {
    msg.textContent = "As senhas não são iguais.";
    return;
  }

  try {
    const credential = await auth.createUserWithEmailAndPassword(email, password);
    const uid = credential.user.uid;

    await credential.user.updateProfile({displayName: name});

    // A senha NÃO é gravada no Realtime Database.
    // O Firebase Authentication armazena a credencial de forma segura.
    await db.ref("users/" + uid).set({
      uid, name, username, createdAt: firebase.database.ServerValue.TIMESTAMP
    });

    await db.ref("profiles/" + uid).set({
      uid, username, displayName: name, birthDate,
      bio: "", location: "", relationship: "",
      photoURL: "", coverURL: "",
      createdAt: firebase.database.ServerValue.TIMESTAMP
    });

    msg.style.color = "#86efac";
    msg.textContent = "Conta criada com sucesso!";
  } catch (err) {
    msg.style.color = "#fca5a5";
    msg.textContent = firebaseError(err);
  }
});

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = $("loginMsg");
  msg.textContent = "";
  try {
    await auth.signInWithEmailAndPassword($("loginEmail").value.trim(), $("loginPassword").value);
  } catch (err) {
    msg.textContent = firebaseError(err);
  }
});

function firebaseError(err) {
  const map = {
    "auth/email-already-in-use": "Este e-mail já está cadastrado.",
    "auth/invalid-email": "Digite um e-mail válido.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/user-not-found": "E-mail ou senha incorretos."
  };
  return map[err.code] || ("Erro Firebase: " + (err.code || "desconhecido") + " — " + (err.message || "verifique a configuração do Firebase."));
}

function openDashboard(user) {
  show("dashboard");
  $("welcome").textContent = user.displayName ? "Olá, " + user.displayName : "Olá!";
}

auth.onAuthStateChanged(user => {
  if (user) openDashboard(user);
  else show("home");
});

function logout() { auth.signOut(); }
$("logout").addEventListener("click", logout);
$("logoutTop").addEventListener("click", logout);