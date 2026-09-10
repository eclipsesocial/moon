/* Eclipse — HTML/CSS/JS puro. */
(function () {
  "use strict";

  const firebaseConfig = {
    apiKey: "AIzaSyDhWlhYXPh34BuOf-kPYbGgYKVFew7f_zG",
    authDomain: "projetoeclipse-2374b.firebaseapp.com",
    databaseURL: "https://projetoeclipse-2374b-default-rtdb.firebaseio.com",
    projectId: "projetoeclipse-2374b",
    storageBucket: "projetoeclipse-2374b.firebasestorage.app",
    messagingSenderId: "460740273909",
    appId: "1:460740273909:web:fb081ae806b15802a0c7bc"
  };

  let auth = null, db = null, storage = null, currentUser = null;
  let setupStep = 1, profilePhotoFile = null, coverPhotoFile = null;

  function $(id){ return document.getElementById(id); }
  function show(id){
    document.querySelectorAll(".landing,.auth-screen,.setup-screen,.dashboard").forEach(x=>x.classList.add("hidden"));
    const el = id==="home" ? document.querySelector(".landing") : $(id);
    if(el) el.classList.remove("hidden");
    window.scrollTo(0,0);
  }

  function bindScreenButtons(){
    document.querySelectorAll("[data-screen]").forEach(btn=>{
      btn.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();
        show(this.getAttribute("data-screen"));
      });
    });
  }

  function firebaseMessage(err){
    const code=err && err.code || "";
    const map={
      "auth/email-already-in-use":"Este e-mail já está cadastrado.",
      "auth/invalid-email":"Digite um e-mail válido.",
      "auth/weak-password":"A senha precisa ter pelo menos 6 caracteres.",
      "auth/invalid-credential":"E-mail ou senha incorretos.",
      "auth/user-not-found":"E-mail ou senha incorretos.",
      "auth/network-request-failed":"Falha de conexão com o Firebase."
    };
    return map[code] || ("Erro Firebase: "+(code || err.message || "operação não concluída"));
  }

  function setupFirebase(){
    if(typeof firebase==="undefined") return false;
    try{
      if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      auth=firebase.auth();
      db=firebase.database();
      storage=firebase.storage();
      return true;
    }catch(e){
      console.error(e); return false;
    }
  }

  function openDashboard(user){
    currentUser=user;
    show("dashboard");
    $("welcome").textContent=user.displayName ? "Olá, "+user.displayName : "Olá!";
  }

  async function checkAfterLogin(user){
    try{
      const snap=await db.ref("profiles/"+user.uid).once("value");
      const p=snap.val()||{};
      if(p.setupCompleted===true){ openDashboard(user); }
      else { openSetup(user); }
    }catch(e){
      console.error(e);
      openDashboard(user);
    }
  }

  function openSetup(user){
    currentUser=user; setupStep=1; profilePhotoFile=null; coverPhotoFile=null;
    $("setupBio").value=""; $("setupRelationship").value="";
    $("profilePhoto").value=""; $("coverPhoto").value="";
    $("profilePreview").innerHTML="<span>☾</span>";
    $("coverPreview").innerHTML="<span>Foto de capa</span>";
    showSetupStep(); show("profileSetup");
  }

  function showSetupStep(){
    document.querySelectorAll(".setup-page").forEach(p=>p.classList.toggle("hidden", Number(p.dataset.step)!==setupStep));
    $("setupStep").textContent=setupStep+" de 4";
    $("setupProgress").style.width=(setupStep*25)+"%";
    const titles=["Vamos montar seu perfil.","Escolha sua foto de perfil.","Agora escolha sua foto de capa.","Como está seu relacionamento?"];
    const desc=["Comece contando um pouco sobre você ou sobre sua personagem.","Essa será a imagem principal do seu perfil.","Sua capa ficará no topo da página do seu perfil.","Você poderá alterar essa informação depois."];
    $("setupTitle").textContent=titles[setupStep-1];
    $("setupDescription").textContent=desc[setupStep-1];
    $("setupBack").style.visibility=setupStep===1?"hidden":"visible";
    $("setupNext").textContent=setupStep===4?"Concluir perfil":"Continuar";
  }

  async function finishSetup(){
    if(!currentUser || !db) return;
    const btn=$("setupNext"), msg=$("setupMessage");
    btn.disabled=true; btn.textContent="Salvando...";
    try{
      const uid=currentUser.uid;
      const data={
        bio:$("setupBio").value.trim(),
        relationship:$("setupRelationship").value,
        setupCompleted:true,
        updatedAt:firebase.database.ServerValue.TIMESTAMP
      };
      if(profilePhotoFile){
        const r=storage.ref("profilePhotos/"+uid+"/profile");
        await r.put(profilePhotoFile);
        data.photoURL=await r.getDownloadURL();
      }
      if(coverPhotoFile){
        const r=storage.ref("coverPhotos/"+uid+"/cover");
        await r.put(coverPhotoFile);
        data.coverURL=await r.getDownloadURL();
      }
      await db.ref("profiles/"+uid).update(data);
      btn.disabled=false;
      openDashboard(currentUser);
    }catch(e){
      btn.disabled=false; btn.textContent="Concluir perfil";
      msg.textContent=firebaseMessage(e);
    }
  }

  function bindAuth(){
    $("loginForm").addEventListener("submit", async e=>{
      e.preventDefault();
      const msg=$("loginMsg"); msg.textContent="";
      if(!auth){msg.textContent="Firebase não foi carregado. Recarregue a página.";return;}
      try{
        await auth.signInWithEmailAndPassword($("loginEmail").value.trim(),$("loginPassword").value);
      }catch(err){msg.textContent=firebaseMessage(err);}
    });

    $("registerForm").addEventListener("submit", async e=>{
      e.preventDefault();
      const msg=$("registerMsg"); msg.textContent="";
      if(!auth){msg.textContent="Firebase não foi carregado. Recarregue a página.";return;}
      const pass=$("regPassword").value, confirm=$("regConfirm").value;
      if(pass!==confirm){msg.textContent="As senhas não são iguais.";return;}
      try{
        const c=await auth.createUserWithEmailAndPassword($("regEmail").value.trim().toLowerCase(),pass);
        await c.user.updateProfile({displayName:$("regName").value.trim()});
        const uid=c.user.uid;
        await db.ref("users/"+uid).set({
          uid:uid,name:$("regName").value.trim(),
          username:$("regUsername").value.trim().replace(/^@/,"").toLowerCase(),
          createdAt:firebase.database.ServerValue.TIMESTAMP
        });
        await db.ref("profiles/"+uid).set({
          uid:uid,displayName:$("regName").value.trim(),
          username:$("regUsername").value.trim().replace(/^@/,"").toLowerCase(),
          birthDate:$("regBirth").value, bio:"",location:"",
          relationship:"",photoURL:"",coverURL:"",
          setupCompleted:false,createdAt:firebase.database.ServerValue.TIMESTAMP
        });
        // onAuthStateChanged abre a configuração.
      }catch(err){msg.textContent=firebaseMessage(err);}
    });
  }

  function bindSetup(){
    $("setupBio").addEventListener("input",()=>{$("bioCount").textContent=$("setupBio").value.length;});
    $("profilePhoto").addEventListener("change",e=>{
      profilePhotoFile=e.target.files[0]||null;
      if(profilePhotoFile) $("profilePreview").innerHTML='<img src="'+URL.createObjectURL(profilePhotoFile)+'" alt="Prévia">';
    });
    $("coverPhoto").addEventListener("change",e=>{
      coverPhotoFile=e.target.files[0]||null;
      if(coverPhotoFile) $("coverPreview").innerHTML='<img src="'+URL.createObjectURL(coverPhotoFile)+'" alt="Prévia">';
    });
    $("setupBack").addEventListener("click",()=>{if(setupStep>1){setupStep--;showSetupStep();}});
    $("setupNext").addEventListener("click",()=>{if(setupStep<4){setupStep++;showSetupStep();}else finishSetup();});
  }

  function bindDashboard(){
    document.querySelectorAll("#mainNav [data-page]").forEach(btn=>{
      btn.addEventListener("click",function(){
        document.querySelectorAll(".dash-page").forEach(p=>p.classList.add("hidden"));
        const page=$(this.dataset.page); if(page)page.classList.remove("hidden");
        document.querySelectorAll("#mainNav [data-page]").forEach(x=>x.classList.remove("active"));
        this.classList.add("active");
      });
    });
    const logout=()=>auth && auth.signOut();
    $("logout").addEventListener("click",logout);
    $("logoutTop").addEventListener("click",logout);
  }

  document.addEventListener("DOMContentLoaded",function(){
    bindScreenButtons();
    bindAuth();
    bindSetup();
    bindDashboard();
    setupFirebase();

    if(auth){
      auth.onAuthStateChanged(user=>{
        if(user) checkAfterLogin(user);
        else show("home");
      });
    }else{
      show("home");
      $("loginMsg").textContent="Firebase não foi carregado.";
    }
  });
})();