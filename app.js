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
const storage = firebase.storage();

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

// ===== Navegação e funções do Eclipse =====
let currentUser = null;

function openPage(pageId) {
  document.querySelectorAll(".dash-page").forEach(p => p.classList.add("hidden"));
  const page = document.getElementById(pageId);
  if (page) page.classList.remove("hidden");
  document.querySelectorAll("#mainNav button").forEach(b => b.classList.toggle("active", b.dataset.page === pageId));
}

document.querySelectorAll("#mainNav button").forEach(button => {
  button.addEventListener("click", () => openPage(button.dataset.page));
});

async function loadProfile(user) {
  try {
    const snap = await db.ref("profiles/" + user.uid).once("value");
    const p = snap.val() || {};
    $("profileName").value = p.displayName || user.displayName || "";
    $("profileUsername").value = p.username || "";
    $("profileLocation").value = p.location || "";
    $("profileRelationship").value = p.relationship || "";
    $("profileBio").value = p.bio || "";
    const privacy = p.privacy || {};
    $("privacyFriends").value = privacy.friends || "public";
    $("privacyFind").value = privacy.find || "public";
    $("privacyRequests").value = privacy.requests || "yes";
  } catch(e) {
    console.error(e);
  }
}

$("profileForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!currentUser) return;
  const msg = $("profileMsg");
  try {
    const data = {
      uid: currentUser.uid,
      displayName: $("profileName").value.trim(),
      username: $("profileUsername").value.trim().replace(/^@/,"").toLowerCase(),
      location: $("profileLocation").value.trim(),
      relationship: $("profileRelationship").value.trim(),
      bio: $("profileBio").value.trim()
    };
    await db.ref("profiles/" + currentUser.uid).update(data);
    await currentUser.updateProfile({displayName:data.displayName});
    await db.ref("users/" + currentUser.uid).update({name:data.displayName,username:data.username});
    $("welcome").textContent = "Olá, " + data.displayName;
    msg.style.color="#86efac"; msg.textContent="Perfil salvo com sucesso.";
  } catch(e) {
    msg.style.color="#fca5a5"; msg.textContent="Não foi possível salvar: "+(e.code||e.message);
  }
});

$("privacyForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!currentUser) return;
  const msg=$("privacyMsg");
  try {
    await db.ref("profiles/"+currentUser.uid+"/privacy").set({
      friends:$("privacyFriends").value,
      find:$("privacyFind").value,
      requests:$("privacyRequests").value
    });
    msg.style.color="#86efac"; msg.textContent="Privacidade salva.";
  } catch(e) {
    msg.style.color="#fca5a5"; msg.textContent="Não foi possível salvar: "+(e.code||e.message);
  }
});

$("friendForm").addEventListener("submit", async e => {
  e.preventDefault();
  const target=$("friendUid").value.trim(), msg=$("friendMsg");
  if(!currentUser) return;
  if(target===currentUser.uid){msg.textContent="Você não pode adicionar a si mesmo.";return;}
  try {
    await db.ref("friendRequests/"+target+"/"+currentUser.uid).set({from:currentUser.uid,status:"pending",createdAt:firebase.database.ServerValue.TIMESTAMP});
    await db.ref("notifications/"+target).push({type:"friend_request",from:currentUser.uid,text:"Você recebeu uma solicitação de amizade.",createdAt:firebase.database.ServerValue.TIMESTAMP,read:false});
    msg.style.color="#86efac";msg.textContent="Solicitação enviada.";
  } catch(e){msg.style.color="#fca5a5";msg.textContent="Não foi possível enviar: "+(e.code||e.message);}
});

$("groupForm").addEventListener("submit", async e => {
  e.preventDefault(); if(!currentUser)return;
  const msg=$("groupMsg");
  try{
    const ref=db.ref("groups").push();
    await ref.set({id:ref.key,name:$("groupName").value.trim(),description:$("groupDescription").value.trim(),ownerId:currentUser.uid,createdAt:firebase.database.ServerValue.TIMESTAMP});
    await db.ref("groupMembers/"+ref.key+"/"+currentUser.uid).set({role:"owner",joinedAt:firebase.database.ServerValue.TIMESTAMP});
    msg.style.color="#86efac";msg.textContent="Grupo criado com sucesso.";e.target.reset();loadGroups();
  }catch(e){msg.style.color="#fca5a5";msg.textContent="Não foi possível criar: "+(e.code||e.message);}
});

async function loadGroups(){
  if(!currentUser)return;
  const list=$("groupsList"); list.innerHTML="";
  try{
    const snap=await db.ref("groups").limitToLast(30).once("value");
    const groups=snap.val()||{};
    Object.values(groups).reverse().forEach(g=>{
      const div=document.createElement("div");div.className="list-item";
      div.innerHTML="<b>"+escapeHtml(g.name||"Grupo")+"</b><br><span class='muted'>"+escapeHtml(g.description||"")+"</span>";
      list.appendChild(div);
    });
    if(!list.children.length) list.innerHTML="<p class='muted'>Nenhum grupo criado ainda.</p>";
  }catch(e){list.innerHTML="<p class='message'>Não foi possível carregar os grupos.</p>";}
}

$("messageForm").addEventListener("submit", async e=>{
  e.preventDefault();if(!currentUser)return;
  const to=$("messageUid").value.trim(), text=$("messageText").value.trim(), msg=$("messageMsg");
  if(!text)return;
  try{
    const chatId=[currentUser.uid,to].sort().join("_");
    const ref=db.ref("messages/"+chatId).push();
    await ref.set({id:ref.key,senderId:currentUser.uid,receiverId:to,text,createdAt:firebase.database.ServerValue.TIMESTAMP});
    msg.style.color="#86efac";msg.textContent="Mensagem enviada.";$("messageText").value="";
  }catch(e){msg.style.color="#fca5a5";msg.textContent="Não foi possível enviar: "+(e.code||e.message);}
});

async function loadNotifications(){
  if(!currentUser)return;
  const list=$("notificationsList");list.innerHTML="";
  try{
    const snap=await db.ref("notifications/"+currentUser.uid).limitToLast(30).once("value");
    const n=snap.val()||{};
    Object.values(n).reverse().forEach(x=>{const d=document.createElement("div");d.className="list-item";d.textContent=x.text||"Nova notificação";list.appendChild(d);});
    if(!list.children.length)list.innerHTML="<p class='muted'>Você não tem notificações.</p>";
  }catch(e){list.innerHTML="<p class='message'>Não foi possível carregar notificações.</p>";}
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}

// Sobrescreve a abertura do painel para carregar dados reais.
auth.onAuthStateChanged(user => {
  currentUser=user;
  if(user){
    openDashboard(user);
    loadProfile(user);
    loadGroups();
    loadNotifications();
  }
});

// ===== Configuração interativa do perfil após o cadastro =====
let setupStep = 1;
let setupUser = null;
let setupProfilePhotoFile = null;
let setupCoverPhotoFile = null;


function profileIsComplete(profile) {
  return !!(profile && profile.setupCompleted === true);
}

function openProfileSetup(user) {
  setupUser = user;
  setupStep = 1;
  $("setupBio").value = "";
  $("setupRelationship").value = "";
  $("profilePreview").innerHTML = "<span>☾</span>";
  $("coverPreview").innerHTML = "<span>Foto de capa</span>";
  $("selectedTrack").classList.add("hidden");
  $("spotifyStatus").textContent = "";
  showSetupStep();
  document.querySelectorAll(".landing,.auth-screen,.dashboard").forEach(el => el.classList.add("hidden"));
  $("profileSetup").classList.remove("hidden");
}

function showSetupStep() {
  document.querySelectorAll(".setup-page").forEach(p => p.classList.toggle("hidden", Number(p.dataset.step)!==setupStep));
  $("setupStep").textContent = setupStep + " de 4";
  $("setupProgress").style.width = (setupStep*25)+"%";
  const titles = [
    "Vamos montar seu perfil.",
    "Escolha sua foto de perfil.",
    "Agora escolha sua foto de capa.",
    "Como está seu relacionamento?",
    "Escolha sua música favorita."
  ];
  const descriptions = [
    "Comece contando um pouco sobre você ou sobre sua personagem.",
    "Essa será a imagem principal do seu perfil.",
    "Sua capa ficará no topo da página do seu perfil.",
    "Você poderá alterar essa informação depois.",
    "Conecte sua conta Spotify para escolher uma música."
  ];
  $("setupTitle").textContent=titles[setupStep-1];
  $("setupDescription").textContent=descriptions[setupStep-1];
  $("setupBack").style.visibility=setupStep===1?"hidden":"visible";
  $("setupNext").textContent=setupStep===4?"Concluir perfil":"Continuar";
  $("setupMessage").textContent="";
}

$("setupBio").addEventListener("input",()=>{$("bioCount").textContent=$("setupBio").value.length;});

$("profilePhoto").addEventListener("change", e=>{
  setupProfilePhotoFile=e.target.files[0];
  if(!setupProfilePhotoFile)return;
  const url=URL.createObjectURL(setupProfilePhotoFile);
  $("profilePreview").innerHTML='<img src="'+url+'" alt="Prévia da foto de perfil">';
});

$("coverPhoto").addEventListener("change", e=>{
  setupCoverPhotoFile=e.target.files[0];
  if(!setupCoverPhotoFile)return;
  const url=URL.createObjectURL(setupCoverPhotoFile);
  $("coverPreview").innerHTML='<img src="'+url+'" alt="Prévia da foto de capa">';
});

$("setupBack").addEventListener("click",()=>{if(setupStep>1){setupStep--;showSetupStep();}});

$("setupNext").addEventListener("click",async()=>{
  if(setupStep<4){setupStep++;showSetupStep();return;}
  await finishProfileSetup();
});

async function finishProfileSetup(){
  if(!setupUser)return;
  const msg=$("setupMessage");
  const btn=$("setupNext");
  btn.disabled=true; btn.textContent="Salvando...";
  try{
    const uid=setupUser.uid;
    const profile={
      bio:$("setupBio").value.trim(),
      relationship:$("setupRelationship").value,
      setupCompleted:true,
      updatedAt:firebase.database.ServerValue.TIMESTAMP
    };

    if(setupProfilePhotoFile){
      const ref=storage.ref("profilePhotos/"+uid+"/profile");
      await ref.put(setupProfilePhotoFile);
      profile.photoURL=await ref.getDownloadURL();
    }
    if(setupCoverPhotoFile){
      const ref=storage.ref("coverPhotos/"+uid+"/cover");
      await ref.put(setupCoverPhotoFile);
      profile.coverURL=await ref.getDownloadURL();
    }

    await db.ref("profiles/"+uid).update(profile);
    btn.disabled=false;
    openDashboard(setupUser);
    loadProfile(setupUser);
    loadGroups();
    loadNotifications();
  }catch(e){
    btn.disabled=false;btn.textContent="Concluir perfil";
    msg.style.color="#fca5a5";
    msg.textContent="Não foi possível salvar: "+(e.code||e.message);
  }
}


// Substitui o listener principal para abrir o onboarding somente para contas novas.
const originalOpenDashboard = openDashboard;
openDashboard = async function(user){
  try{
    const snap=await db.ref("profiles/"+user.uid).once("value");
    const profile=snap.val();
    if(!profileIsComplete(profile)){
      openProfileSetup(user);
      return;
    }
  }catch(e){console.error(e);}
  show("dashboard");
  $("welcome").textContent=user.displayName?"Olá, "+user.displayName:"Olá!";
};
