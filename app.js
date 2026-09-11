(function(){'use strict';
const firebaseConfig={apiKey:"AIzaSyCPVniLjOYjxkY3D11BjmPL4a3ArvvIyOw",authDomain:"eclipsesocial.firebaseapp.com",databaseURL:"https://eclipsesocial-default-rtdb.firebaseio.com/",projectId:"eclipsesocial",storageBucket:"eclipsesocial.firebasestorage.app",messagingSenderId:"813331770276",appId:"1:813331770276:web:6f50722ecfe3b98ec72f31",measurementId:"G-1VYW7EJPWY"};
let auth,db,currentUser=null,currentProfile=null,currentUserRole=null,setupStep=1,profilePhotoFile=null,coverPhotoFile=null,profilePhotoCropped='',activeChatUid=null,activeChatRef=null;
const R2_WORKER_URL='https://dry-limit-e851.eclipsesocialoficial.workers.dev';

function dataURLToBlob(dataURL){
  const parts=dataURL.split(',');
  const meta=parts[0]||'';
  const mime=(meta.match(/data:([^;]+);/)||[])[1]||'image/jpeg';
  const bin=atob(parts[1]||'');
  const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return new Blob([bytes],{type:mime});
}

async function uploadToR2(fileOrBlob,folder,uid,fileName='arquivo'){
  if(!fileOrBlob) return null;
  const file=fileOrBlob instanceof File ? fileOrBlob : new File([fileOrBlob],fileName,{type:fileOrBlob.type||'application/octet-stream'});
  const max=100*1024*1024;
  if(file.size>max)throw new Error('O arquivo deve ter no máximo 100 MB.');
  if(!folder||!uid)throw new Error('Não foi possível identificar o destino do arquivo.');

  const form=new FormData();
  form.append('file',file,file.name||fileName);
  form.append('folder',folder);
  form.append('uid',uid);

  let res;
  try{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),120000);
    try{
      res=await fetch(R2_WORKER_URL+'/upload',{method:'POST',body:form,signal:controller.signal});
    }finally{clearTimeout(timer)}
  }catch(e){
    if(e?.name==='AbortError')throw new Error('O upload demorou demais. Verifique a conexão e tente novamente.');
    throw new Error('Não foi possível conectar ao armazenamento R2. Verifique se o Worker está online e configurado com o bucket R2.');
  }

  const raw=await res.text();
  let body={};
  try{body=raw?JSON.parse(raw):{}}catch{body={error:raw||''}}

  if(!res.ok||!body.ok){
    const detail=body.error||body.message||`Servidor R2 respondeu HTTP ${res.status}.`;
    throw new Error(`R2: ${detail}`);
  }

  if(!body.key)throw new Error('R2: o servidor não retornou a chave do arquivo.');

  return {
    key:body.key,
    url:R2_WORKER_URL+'/file?key='+encodeURIComponent(body.key),
    type:body.contentType||file.type,
    size:body.size||file.size
  };
}

async function deleteFromR2(key){
  if(!key)return;
  try{await fetch(R2_WORKER_URL+'/file?key='+encodeURIComponent(key),{method:'DELETE'})}catch(e){console.warn('R2 delete',e)}
}

let cropState={file:null,img:null,zoom:1,x:0,y:0,target:'profile',callback:null,dragging:false,startX:0,startY:0};
const $=id=>document.getElementById(id); const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function show(id){document.querySelectorAll('.landing,.auth-screen,.setup-screen,.dashboard').forEach(x=>x.classList.add('hidden'));const el=id==='home'?document.querySelector('.landing'):$(id);if(el)el.classList.remove('hidden');scrollTo(0,0)}
function msg(el,text){if(el)el.textContent=text||''}
function firebaseMessage(e){const m={'auth/email-already-in-use':'Este e-mail já está cadastrado.','auth/invalid-email':'Digite um e-mail válido.','auth/weak-password':'A senha precisa ter pelo menos 6 caracteres.','auth/invalid-credential':'E-mail ou senha incorretos.','auth/user-not-found':'E-mail ou senha incorretos.','auth/network-request-failed':'Falha de conexão com o Firebase.'};return m[e?.code]||('Erro Firebase: '+(e?.message||'operação não concluída'))}
function initFirebase(){try{if(!window.firebase)return false;if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);auth=firebase.auth();db=firebase.database();return true}catch(e){console.error(e);return false}}

async function imageFileToDataURL(file, options={}){
  if(!file) return '';
  if(!file.type || !file.type.startsWith('image/')) throw new Error('Envie um arquivo de imagem válido.');
  const maxInput=10*1024*1024;
  if(file.size>maxInput) throw new Error('A imagem original deve ter no máximo 10 MB.');
  const maxWidth=options.maxWidth||1280;
  const maxHeight=options.maxHeight||1280;
  const quality=options.quality||0.82;
  const maxOutput=options.maxOutput||1800*1024;
  const src=await new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(r.result);
    r.onerror=()=>reject(new Error('Não foi possível ler a imagem.'));
    r.readAsDataURL(file);
  });
  const img=await new Promise((resolve,reject)=>{
    const el=new Image();
    el.onload=()=>resolve(el);
    el.onerror=()=>reject(new Error('Não foi possível processar a imagem.'));
    el.src=src;
  });
  const scale=Math.min(1,maxWidth/img.naturalWidth,maxHeight/img.naturalHeight);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const ctx=canvas.getContext('2d');
  if(!ctx) throw new Error('Seu navegador não conseguiu processar a imagem.');
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  let q=quality, data=canvas.toDataURL('image/jpeg',q);
  while(data.length>maxOutput*1.37 && q>0.45){
    q-=0.07;
    data=canvas.toDataURL('image/jpeg',q);
  }
  if(data.length>maxOutput*1.37) throw new Error('A imagem ficou muito grande. Escolha uma imagem menor.');
  return data;
}
async function fileToDataURL(file,maxBytes=12*1024*1024){if(!file)return '';if(file.size>maxBytes)throw new Error('O arquivo deve ter no máximo 12 MB.');return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Não foi possível ler o arquivo.'));r.readAsDataURL(file)})}
function openCropper(file,target,callback){if(!file||!file.type.startsWith('image/')){msg($('cropMsg'),'Escolha uma imagem válida.');return}const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{cropState={file,img,zoom:1,x:0,y:0,target,callback,dragging:false,startX:0,startY:0};$('cropZoom').value='1';$('cropModal').classList.remove('hidden');$('cropModal').setAttribute('aria-hidden','false');drawCrop()};img.onerror=()=>msg($('cropMsg'),'Não foi possível abrir a imagem.');img.src=reader.result};reader.readAsDataURL(file)}
function drawCrop(){const canvas=$('cropCanvas');if(!canvas||!cropState.img)return;const ctx=canvas.getContext('2d'),size=canvas.width,img=cropState.img,base=Math.max(size/img.naturalWidth,size/img.naturalHeight),scale=base*cropState.zoom,w=img.naturalWidth*scale,h=img.naturalHeight*scale,x=(size-w)/2+cropState.x,y=(size-h)/2+cropState.y;ctx.clearRect(0,0,size,size);ctx.fillStyle='#080a1b';ctx.fillRect(0,0,size,size);ctx.save();ctx.beginPath();ctx.arc(size/2,size/2,size/2-3,0,Math.PI*2);ctx.clip();ctx.drawImage(img,x,y,w,h);ctx.restore()}
function closeCropper(){const m=$('cropModal');if(m){m.classList.add('hidden');m.setAttribute('aria-hidden','true')}cropState.file=null;cropState.img=null;cropState.callback=null}
function confirmCrop(){try{const canvas=$('cropCanvas'),out=document.createElement('canvas'),size=800;out.width=size;out.height=size;const ctx=out.getContext('2d'),img=cropState.img,stage=canvas.width,base=Math.max(stage/img.naturalWidth,stage/img.naturalHeight),scale=base*cropState.zoom,w=img.naturalWidth*scale,h=img.naturalHeight*scale,x=(stage-w)/2+cropState.x,y=(stage-h)/2+cropState.y;ctx.drawImage(img,x/stage*size,y/stage*size,w/stage*size,h/stage*size);const data=out.toDataURL('image/jpeg',.86),cb=cropState.callback;closeCropper();if(cb)cb(data)}catch(e){msg($('cropMsg'),'Não foi possível recortar a imagem.')}}
function bindCropper(){$('cropZoom').addEventListener('input',e=>{cropState.zoom=Number(e.target.value);drawCrop()});$('cropReset').onclick=()=>{cropState.zoom=1;cropState.x=0;cropState.y=0;$('cropZoom').value='1';drawCrop()};$('cropConfirm').onclick=confirmCrop;$('cropCancel').onclick=closeCropper;$('closeCropModal').onclick=closeCropper;const stage=$('cropStage');stage.addEventListener('pointerdown',e=>{cropState.dragging=true;cropState.startX=e.clientX-cropState.x;cropState.startY=e.clientY-cropState.y;stage.setPointerCapture(e.pointerId)});stage.addEventListener('pointermove',e=>{if(cropState.dragging){cropState.x=e.clientX-cropState.startX;cropState.y=e.clientY-cropState.startY;drawCrop()}});stage.addEventListener('pointerup',()=>cropState.dragging=false);stage.addEventListener('pointercancel',()=>cropState.dragging=false)}
function avatar(url,cls='avatar'){return url?`<span class="${cls}"><img src="${esc(url)}"></span>`:`<span class="${cls}">☾</span>`}
async function getProfile(uid){const s=await db.ref('profiles/'+uid).once('value');const p=s.val()||{uid};if(!p.username||p.role===undefined){const u=await db.ref('users/'+uid).once('value');const uv=u.val()||{};if(uv.username&&!p.username)p.username=uv.username;if(!p.displayName&&uv.name)p.displayName=uv.name;if(p.role===undefined)p.role=Number(uv.role||0)}if(!p.username&&uid===currentUser?.uid){const uv=await db.ref('users/'+uid).once('value');p.username=uv.val()?.username||''}return p}
function closeMobile(){ $('sidebar')?.classList.remove('open'); $('mobileOverlay')?.classList.add('hidden') }

async function getUserRole(uid){
  if(!uid)return 0;
  const userSnap=await db.ref('users/'+uid).once('value');
  const user=userSnap.val()||{};
  if(Number.isInteger(Number(user.role)))return Number(user.role);
  // Compatibilidade com a estrutura antiga do Alpha.
  const s=await db.ref('admin/'+uid).once('value');
  const v=s.val();
  if(v?.role==='admin')return 2;
  if(v?.role==='moderator')return 1;
  return 0;
}
function roleName(role){role=Number(role);return role===2?'Administrador':role===1?'Moderador':'Usuário'}
function roleBadge(role){
  role=Number(role);
  if(role===2) return '<span class="role-badge role-admin role-badge-inline">🛡 Administrador</span>';
  if(role===1) return '<span class="role-badge role-moderator role-badge-inline">🛡 Moderador</span>';
  return '';
}
async function refreshMyAdminUI(){
  if(!currentUser)return 0;
  const role=await getUserRole(currentUser.uid);
  currentUserRole=role;
  const nav=$('adminNavItem');
  if(nav)nav.classList.toggle('hidden',!(role===1||role===2));
  const badge=$('myAdminBadge');
  if(badge){
    badge.textContent=role===2?'🛡 Administrador':role===1?'🛡 Moderador':'';
    badge.className='role-badge '+(role===2?'role-admin':role===1?'role-moderator':'')+(role?'':' hidden');
  }
  return role;
}
async function loadAdminTeam(){
  const holder=$('adminTeamList');if(!holder)return;
  const me=await getUserRole(currentUser.uid);
  if(me!==2){
    holder.innerHTML='<p class="muted">Somente administradores podem gerenciar cargos. Você pode visualizar este painel como moderador.</p>';return;
  }
  const s=await db.ref('users').once('value');
  const entries=[];
  s.forEach(x=>{const v=x.val()||{};const role=Number(v.role||0);if(role===1||role===2)entries.push({uid:x.key,...v,role})});
  entries.sort((a,b)=>a.role-b.role);
  if(!entries.length){holder.innerHTML='<p class="muted">Nenhum administrador ou moderador cadastrado.</p>';return;}
  const rows=[];
  for(const x of entries){
    const pr=await getProfile(x.uid);
    rows.push(`<div class="admin-team-person">
      <div class="person-main">${avatar(pr.photoURL,'mini-avatar')}<div><strong>${esc(pr.displayName||x.name||'Usuário')}</strong><small class="muted">@${esc(pr.username||x.username||'')}</small></div></div>
      <div class="admin-team-actions"><span class="role-badge ${x.role===2?'role-admin':'role-moderator'}">🛡 ${roleName(x.role)}</span>
      ${x.uid!==currentUser.uid?`<button class="secondary" data-remove-admin="${esc(x.uid)}">Voltar para usuário</button>`:''}</div>
    </div>`);
  }
  holder.innerHTML=rows.join('');
  holder.querySelectorAll('[data-remove-admin]').forEach(b=>b.onclick=async()=>{
    if(!confirm('Voltar esta pessoa para o cargo 0 — Usuário?'))return;
    await db.ref('users/'+b.dataset.removeAdmin).update({role:0});
    await db.ref('profiles/'+b.dataset.removeAdmin).update({role:0,adminRole:null});
    await db.ref('admin/'+b.dataset.removeAdmin).remove();
    loadAdminTeam();
  });
}
async function addAdminRole(e){
  e.preventDefault();
  const msgEl=$('adminRoleMsg');msg(msgEl,'');
  const role=Number($('adminTargetRole').value);
  const username=$('adminTargetUsername').value.trim().replace(/^@/,'').toLowerCase();
  if(!username)return;
  const me=await getUserRole(currentUser.uid);
  if(me!==2){msg(msgEl,'Somente administradores (cargo 2) podem alterar cargos.');return;}
  if(role!==1&&role!==2){msg(msgEl,'Escolha um cargo válido.');return;}
  const s=await db.ref('users').orderByChild('username').equalTo(username).limitToFirst(1).once('value');
  let target=null;s.forEach(x=>target={uid:x.key,...x.val()});
  if(!target){msg(msgEl,'Usuário não encontrado. Verifique o username.');return;}
  await db.ref('users/'+target.uid).update({role});
  await db.ref('profiles/'+target.uid).update({role,adminRole:role===2?'admin':'moderator'});
  await db.ref('admin/'+target.uid).set({uid:target.uid,role:role===2?'admin':'moderator',roleNumber:role,assignedBy:currentUser.uid,createdAt:firebase.database.ServerValue.TIMESTAMP});
  msg(msgEl,role===2?'Administrador adicionado (cargo 2).':'Moderador adicionado (cargo 1).');
  $('adminTargetUsername').value='';
  loadAdminTeam();
}
async function loadAdminPage(){
  const role=await refreshMyAdminUI();
  if(role!==1&&role!==2){openPage('homePage');return;}
  const form=$('adminRoleForm');if(form)form.classList.toggle('hidden',role!==2);
  const note=$('adminModeratorNotice');if(note)note.classList.toggle('hidden',role!==1);
  loadAdminTeam();
}
function bindNavigation(){
 document.querySelectorAll('[data-screen]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();show(b.dataset.screen)}));
 document.querySelectorAll('#mainNav [data-page],.top-icon').forEach(b=>b.addEventListener('click',()=>openPage(b.dataset.page)));
 $('topProfile').onclick=()=>openPage('profilePage'); $('mobileMenu').onclick=()=>{$('sidebar').classList.add('open');$('mobileOverlay').classList.remove('hidden')};$('mobileClose').onclick=closeMobile;$('mobileOverlay').onclick=closeMobile;
}
function openPage(id){document.querySelectorAll('.dash-page').forEach(p=>p.classList.add('hidden'));$(id)?.classList.remove('hidden');document.querySelectorAll('#mainNav [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===id));closeMobile();if(id==='homePage')loadHome();if(id==='profilePage')renderOwnProfile();if(id==='friendsPage')loadFriends();if(id==='groupsPage'){ $('groupsBrowseView')?.classList.remove('hidden'); $('groupDetailView')?.classList.add('hidden'); loadGroups(); }if(id==='notificationsPage')loadNotifications();if(id==='adminPage')loadAdminPage()}
function openDashboard(u){currentUser=u;$('welcome').textContent=u.displayName||'Meu perfil';$('topAvatar').outerHTML=avatar(currentProfile?.photoURL,'mini-avatar').replace('span class="mini-avatar"','span id="topAvatar" class="mini-avatar"');$('composerAvatar').outerHTML=avatar(currentProfile?.photoURL,'avatar').replace('span class="avatar"','span id="composerAvatar" class="avatar"');show('dashboard');openPage('homePage');loadChatFriends();refreshMyAdminUI()}
async function checkAfterLogin(u){try{currentProfile=await getProfile(u.uid);if(currentProfile.setupCompleted===true)openDashboard(u);else openSetup(u)}catch(e){console.error(e);openDashboard(u)}}
function bindAuth(){$('loginForm').addEventListener('submit',async e=>{e.preventDefault();msg($('loginMsg'),'');try{await auth.signInWithEmailAndPassword($('loginEmail').value.trim(),$('loginPassword').value)}catch(err){msg($('loginMsg'),firebaseMessage(err))}});$('registerForm').addEventListener('submit',async e=>{e.preventDefault();msg($('registerMsg'),'');const p=$('regPassword').value;if(p!==$('regConfirm').value){msg($('registerMsg'),'As senhas não são iguais.');return}try{const c=await auth.createUserWithEmailAndPassword($('regEmail').value.trim().toLowerCase(),p);await c.user.updateProfile({displayName:$('regName').value.trim()});const uid=c.user.uid, name=$('regName').value.trim(), username=$('regUsername').value.trim().replace(/^@/,'').toLowerCase();await db.ref('users/'+uid).set({uid,name,username,role:0,createdAt:firebase.database.ServerValue.TIMESTAMP});await db.ref('profiles/'+uid).set({uid,displayName:name,username,birthDate:$('regBirth').value,bio:'',location:'',relationship:'',photoURL:'',coverURL:'',setupCompleted:false,role:0,createdAt:firebase.database.ServerValue.TIMESTAMP})}catch(err){msg($('registerMsg'),firebaseMessage(err))}})}
function openSetup(u){currentUser=u;setupStep=1;profilePhotoFile=null;profilePhotoCropped='';coverPhotoFile=null;$('setupBio').value='';$('setupRelationship').value='';$('profilePhoto').value='';$('coverPhoto').value='';$('profilePreview').innerHTML='<span>☾</span>';$('coverPreview').innerHTML='<span>Foto de capa</span>';showSetupStep();show('profileSetup')}
function showSetupStep(){document.querySelectorAll('.setup-page').forEach(x=>x.classList.toggle('hidden',+x.dataset.step!==setupStep));$('setupStep').textContent=setupStep+' de 4';$('setupProgress').style.width=setupStep*25+'%';const t=['Vamos montar seu perfil.','Escolha sua foto de perfil.','Agora escolha sua foto de capa.','Como está seu relacionamento?'];const d=['Comece contando um pouco sobre você ou sobre sua personagem.','Essa será a imagem principal do seu perfil.','Sua capa ficará no topo da página do seu perfil.','Você poderá alterar essa informação depois.'];$('setupTitle').textContent=t[setupStep-1];$('setupDescription').textContent=d[setupStep-1];$('setupBack').style.visibility=setupStep===1?'hidden':'visible';$('setupNext').textContent=setupStep===4?'Concluir perfil':'Continuar'}
function bindSetup(){$('setupBio').addEventListener('input',()=>$('bioCount').textContent=$('setupBio').value.length);$('profilePhoto').addEventListener('change',e=>{const f=e.target.files[0];if(f)openCropper(f,'setup-profile',data=>{profilePhotoCropped=data;$('profilePreview').innerHTML=`<img src="${data}">`})});$('coverPhoto').addEventListener('change',e=>{coverPhotoFile=e.target.files[0]||null;if(coverPhotoFile)$('coverPreview').innerHTML=`<img src="${URL.createObjectURL(coverPhotoFile)}">`});$('setupBack').onclick=()=>{if(setupStep>1){setupStep--;showSetupStep()}};$('setupNext').onclick=finishOrNext}
async function finishOrNext(){if(setupStep<4){setupStep++;showSetupStep();return}const b=$('setupNext');b.disabled=true;b.textContent='Salvando...';try{const uid=currentUser.uid,data={bio:$('setupBio').value.trim(),relationship:$('setupRelationship').value,setupCompleted:true,updatedAt:firebase.database.ServerValue.TIMESTAMP};if(profilePhotoCropped){const r=await uploadToR2(dataURLToBlob(profilePhotoCropped),'profile',uid,'profile.jpg');data.photoURL=r.url;data.photoKey=r.key} else if(profilePhotoFile){const optimized=await imageFileToDataURL(profilePhotoFile,{maxWidth:800,maxHeight:800,maxOutput:1200*1024});const r=await uploadToR2(dataURLToBlob(optimized),'profile',uid,'profile.jpg');data.photoURL=r.url;data.photoKey=r.key}if(coverPhotoFile){const optimized=await imageFileToDataURL(coverPhotoFile,{maxWidth:1600,maxHeight:700,maxOutput:1600*1024});const r=await uploadToR2(dataURLToBlob(optimized),'cover',uid,'cover.jpg');data.coverURL=r.url;data.coverKey=r.key}await db.ref('profiles/'+uid).update(data);currentProfile=await getProfile(uid);openDashboard(currentUser)}catch(e){msg($('setupMessage'),firebaseMessage(e));b.disabled=false;b.textContent='Concluir perfil'}}
async function loadHome(){await loadFeed();await loadStories();await loadSuggestions();renderMiniProfile()}
function renderMiniProfile(){$('homeMiniProfile').innerHTML=`${avatar(currentProfile?.photoURL,'avatar')}<div><strong>${esc(currentProfile?.displayName||currentUser.displayName||'Perfil')}</strong><small>@${esc(currentProfile?.username||'')}</small></div>`}
async function loadFeed(){const s=await db.ref('posts').orderByChild('createdAt').limitToLast(40).once('value');const arr=[];s.forEach(x=>arr.push({id:x.key,...x.val()}));arr.reverse();if(!arr.length){$('feedList').innerHTML='<div class="card post"><p class="muted">Seu feed ainda está vazio. Comece publicando algo.</p></div>';return}const profiles={};for(const p of arr){profiles[p.uid]??=await getProfile(p.uid)}$('feedList').innerHTML=arr.map(p=>postHTML(p,profiles[p.uid]||{})).join('');await bindPostInteractions()}
function canManageContent(uid){return !!currentUser&&(uid===currentUser.uid||Number(currentUserRole)===2||Number(currentUserRole)===1)}
async function deletePost(id){const snap=await db.ref('posts/'+id).once('value');const p=snap.val();if(!p||!canManageContent(p.uid))return; if(!confirm('Apagar esta publicação? Esta ação não pode ser desfeita.'))return;await deleteFromR2(p.mediaKey);await Promise.all([db.ref('posts/'+id).remove(),db.ref('comments/'+id).remove(),db.ref('shares/'+id).remove()]);await loadHome()}
async function deleteComment(postId,commentId){const ref=db.ref('comments/'+postId+'/'+commentId),snap=await ref.once('value'),c=snap.val();if(!c||!canManageContent(c.uid))return;if(!confirm('Apagar este comentário?'))return;await ref.remove();await db.ref('posts/'+postId+'/commentsCount').transaction(v=>Math.max(0,(v||0)-1));await toggleComments(postId,true)}
function postHTML(p,pr){const liked=!!(p.reactions&&p.reactions[currentUser.uid]);const likes=p.likesCount||Object.keys(p.reactions||{}).length||0;const comments=p.commentsCount||0,shares=p.sharesCount||0;const manage=canManageContent(p.uid);return `<article class="card post" data-post-id="${p.id}"><div class="post-head"><button class="post-author-link" data-profile-uid="${esc(p.uid)}">${avatar(pr.photoURL,'mini-avatar')}<span><strong>${esc(pr.displayName||'Usuário')}${roleBadge(pr.adminRole)}</strong><small>@${esc(pr.username||'')} · ${p.createdAt?new Date(p.createdAt).toLocaleString('pt-BR'):''}</small></span></button>${manage?`<button class="post-menu-delete" title="Apagar publicação" data-delete-post="${p.id}">⋯</button>`:''}</div>${p.text?`<div class="post-text">${esc(p.text)}</div>`:''}${p.imageURL?`<img class="post-image" src="${esc(p.imageURL)}">`:''}${p.videoURL?`<video class="post-video" src="${esc(p.videoURL)}" controls playsinline></video>`:''}<div class="post-counts"><span>${likes} curtida${likes===1?'':'s'}</span><span>${comments} comentário${comments===1?'':'s'} · ${shares} compartilhamento${shares===1?'':'s'}</span></div><div class="post-actions"><button class="${liked?'liked':''}" data-like-post="${p.id}">♡ Curtir</button><button data-comment-post="${p.id}">◯ Comentar</button><button data-share-post="${p.id}">↗ Compartilhar</button></div><div class="comments-box" id="comments-${p.id}"></div></article>`}
async function bindPostInteractions(){document.querySelectorAll('[data-profile-uid]').forEach(b=>b.onclick=()=>viewProfile(b.dataset.profileUid));document.querySelectorAll('[data-like-post]').forEach(b=>b.onclick=()=>toggleLike(b.dataset.likePost));document.querySelectorAll('[data-comment-post]').forEach(b=>b.onclick=()=>toggleComments(b.dataset.commentPost));document.querySelectorAll('[data-share-post]').forEach(b=>b.onclick=()=>sharePost(b.dataset.sharePost));document.querySelectorAll('[data-delete-post]').forEach(b=>b.onclick=()=>deletePost(b.dataset.deletePost))}
async function toggleLike(id){const ref=db.ref('posts/'+id),snap=await ref.once('value'),p=snap.val()||{},r=p.reactions||{};if(r[currentUser.uid]){delete r[currentUser.uid]}else{r[currentUser.uid]=true}await ref.update({reactions:r,likesCount:Object.keys(r).length});await loadFeed()}
async function toggleComments(id,forceReload=false){const box=$('comments-'+id);if(!box)return;if(box.classList.contains('loaded')&&!forceReload){box.classList.toggle('open');return}const s=await db.ref('comments/'+id).orderByChild('createdAt').once('value');const a=[];s.forEach(x=>a.push({id:x.key,...x.val()}));box.innerHTML=`<div class="comments-list">${a.map(c=>`<div class="comment"><div><strong>${esc(c.name||'Usuário')}</strong><span>${esc(c.text)}</span></div>${canManageContent(c.uid)?`<button class="comment-delete" title="Apagar comentário" data-delete-comment="${c.id}" data-delete-comment-post="${id}">Apagar</button>`:''}</div>`).join('')}</div><form class="comment-form" data-comment-form="${id}"><input placeholder="Escreva um comentário..." required><button>Enviar</button></form>`;box.classList.add('loaded','open');box.querySelectorAll('[data-delete-comment]').forEach(b=>b.onclick=()=>deleteComment(b.dataset.deleteCommentPost,b.dataset.deleteComment));box.querySelector('form').onsubmit=async e=>{e.preventDefault();const input=e.target.querySelector('input'),text=input.value.trim();if(!text)return;await db.ref('comments/'+id).push({uid:currentUser.uid,name:currentUser.displayName||currentProfile?.displayName||'Usuário',text,createdAt:firebase.database.ServerValue.TIMESTAMP});const p=await db.ref('posts/'+id).once('value');await db.ref('posts/'+id).update({commentsCount:(p.val()?.commentsCount||0)+1});await toggleComments(id,true)};}
async function sharePost(id){const p=await db.ref('posts/'+id).once('value');if(!p.exists())return;const v=p.val();await db.ref('shares/'+id).push({uid:currentUser.uid,createdAt:firebase.database.ServerValue.TIMESTAMP});await db.ref('posts/'+id).update({sharesCount:(v.sharesCount||0)+1});alert('Publicação compartilhada.');loadFeed()}
async function loadStories(){const s=await db.ref('statuses').orderByChild('createdAt').limitToLast(20).once('value');const arr=[];s.forEach(x=>arr.push({id:x.key,...x.val()}));arr.reverse();$('storiesList').innerHTML=arr.length?arr.map(x=>`<div class="story-card" data-story-id="${x.id}">${x.imageURL?`<img src="${esc(x.imageURL)}">`:''}<div class="story-avatar">☾</div><strong>${esc(x.displayName||'Amigo')}</strong></div>`).join(''):`<div class="muted">Seus amigos ainda não publicaram stories.</div>`}
async function loadSuggestions(){const s=await db.ref('profiles').limitToFirst(20).once('value');const arr=[];s.forEach(x=>{if(x.key!==currentUser.uid)arr.push({uid:x.key,...x.val()})});$('suggestionsList').innerHTML=arr.slice(0,5).map(x=>`<div class="suggestion"><button class="suggestion-person" data-profile-uid="${x.uid}">${avatar(x.photoURL,'mini-avatar')}<span><strong>${esc(x.displayName||'Usuário')}</strong><small>@${esc(x.username||'')}</small></span></button><button class="add-friend" data-add-friend="${x.uid}">Adicionar</button></div>`).join('')||'<p class="muted">Nenhuma sugestão encontrada.</p>';document.querySelectorAll('[data-add-friend]').forEach(b=>b.onclick=()=>sendFriendRequest(b.dataset.addFriend,b));document.querySelectorAll('.suggestion-person').forEach(b=>b.onclick=()=>viewProfile(b.dataset.profileUid))}
function bindFeed(){$('thinkingBtn').onclick=()=>openModal('postModal');$('composerPhotoBtn').onclick=()=>openModal('postModal');$('createStoryBtn').onclick=()=>openModal('storyModal');document.querySelectorAll('[data-close-modal]').forEach(b=>b.onclick=()=>b.closest('.modal').classList.add('hidden'));$('publishBtn').onclick=publishPost;$('publishStoryBtn').onclick=publishStory}
function openModal(id){$(id)?.classList.remove('hidden')}
async function publishPost(){const text=$('postText').value.trim(),file=$('postImage').files[0];if(!text&&!file){msg($('postMsg'),'Escreva algo ou escolha uma mídia.');return}const b=$('publishBtn');b.disabled=true;b.textContent='Publicando...';try{const data={uid:currentUser.uid,text,createdAt:firebase.database.ServerValue.TIMESTAMP,likesCount:0,commentsCount:0,sharesCount:0,reactions:{}};if(file){let r;if(file.type.startsWith('image/')){const optimized=await imageFileToDataURL(file,{maxWidth:1400,maxHeight:1400,maxOutput:1800*1024});r=await uploadToR2(dataURLToBlob(optimized),'posts',currentUser.uid,file.name||'foto.jpg');data.imageURL=r.url;data.mediaKey=r.key;data.mediaType=r.type}else if(file.type.startsWith('video/')){r=await uploadToR2(file,'videos',currentUser.uid,file.name||'video.mp4');data.videoURL=r.url;data.mediaKey=r.key;data.mediaType=r.type}else throw new Error('Formato de mídia não suportado.')}await db.ref('posts').push(data);$('postText').value='';$('postImage').value='';if($('postMediaName'))$('postMediaName').textContent='Nenhuma mídia selecionada';$('postModal').classList.add('hidden');await loadHome()}catch(e){msg($('postMsg'),'Não foi possível publicar: '+firebaseMessage(e))}finally{b.disabled=false;b.textContent='Publicar'}}
async function publishStory(){const text=$('storyText').value.trim(),file=$('storyImage').files[0];if(!text&&!file){msg($('storyMsg'),'Escreva algo ou escolha uma mídia.');return}const b=$('publishStoryBtn');b.disabled=true;b.textContent='Publicando...';try{const data={uid:currentUser.uid,text,createdAt:firebase.database.ServerValue.TIMESTAMP};if(file){let r;if(file.type.startsWith('image/')){const optimized=await imageFileToDataURL(file,{maxWidth:1080,maxHeight:1920,maxOutput:1600*1024});r=await uploadToR2(dataURLToBlob(optimized),'stories',currentUser.uid,file.name||'story.jpg');data.imageURL=r.url;data.mediaKey=r.key;data.mediaType=r.type}else if(file.type.startsWith('video/')){r=await uploadToR2(file,'stories',currentUser.uid,file.name||'story.mp4');data.videoURL=r.url;data.mediaKey=r.key;data.mediaType=r.type}else throw new Error('Formato de mídia não suportado.')}await db.ref('statuses').push(data);$('storyText').value='';$('storyImage').value='';if($('storyMediaName'))$('storyMediaName').textContent='Nenhuma mídia selecionada';$('storyModal').classList.add('hidden');await loadHome()}catch(e){msg($('storyMsg'),'Não foi possível publicar o story: '+firebaseMessage(e))}finally{b.disabled=false;b.textContent='Publicar story'}}async function renderOwnProfile(){const p=currentProfile||await getProfile(currentUser.uid);$('publicProfile').innerHTML=profileHTML(p,true);bindProfileButtons()}
async function viewProfile(uid){const p=await getProfile(uid);$('publicProfile').innerHTML=profileHTML(p,uid===currentUser.uid);bindProfileButtons();openPage('profilePage')}
function profileHTML(p,isOwn=false){const username=String(p.username||'').replace(/^@/,'').trim();return `<div class="profile-cover">${p.coverURL?`<img src="${esc(p.coverURL)}">`:''}${isOwn?`<button class="profile-photo-action profile-cover-action" id="profileCoverAction" title="Trocar foto de capa" aria-label="Trocar foto de capa">📷</button>`:''}</div><div class="profile-main"><div class="profile-head"><div class="profile-avatar-wrap"><div class="profile-avatar-large">${p.photoURL?`<img src="${esc(p.photoURL)}">`:'☾'}</div>${isOwn?`<button class="profile-photo-action profile-avatar-action" id="profilePhotoAction" title="Trocar foto de perfil" aria-label="Trocar foto de perfil">📷</button>`:''}</div><div class="profile-name"><h1>${esc(p.displayName||'Usuário')}${roleBadge(p.adminRole)}</h1><p class="profile-username">@${esc(username||'usuário')}</p></div><div class="profile-buttons">${isOwn?`<button class="profile-edit-btn" id="openProfileEdit">✎ Editar perfil</button>`:`<button class="primary" id="profileAddFriend" data-uid="${esc(p.uid)}">Adicionar como amigo</button><button class="secondary" id="profileMessage" data-uid="${esc(p.uid)}">Mensagem</button>`}</div></div><div class="profile-nav"><button class="active">Publicações</button><button>Sobre</button><button>Fotos</button><button>Amigos</button></div><div class="profile-about card"><h3>Sobre</h3><div class="info-row"><b>Biografia:</b> ${esc(p.bio||'Ainda não adicionou uma biografia.')}</div><div class="info-row"><b>Mora em:</b> ${esc(p.location||'Não informado')}</div><div class="info-row"><b>Relacionamento:</b> ${esc(p.relationship||'Não informado')}</div></div><div class="profile-publications card"><div class="profile-section-title"><h3>Publicações</h3></div><div id="profilePosts"><p class="muted">Carregando...</p></div></div></div>`}
function bindProfileButtons(){const a=$('profileAddFriend'),m=$('profileMessage'),edit=$('openProfileEdit');if(a)a.onclick=()=>sendFriendRequest(a.dataset.uid,a);if(m)m.onclick=()=>openChat(m.dataset.uid);if(edit)edit.onclick=openProfileEditor;const pf=$('editProfilePhoto'),cf=$('editProfileCover'),pa=$('profilePhotoAction'),ca=$('profileCoverAction');if(pa&&pf)pa.onclick=()=>pf.click();if(pf)pf.onchange=()=>{const f=pf.files[0];if(f)openCropper(f,'edit-profile',data=>{profilePhotoCropped=data;saveProfileEdit()})};if(ca&&cf)ca.onclick=()=>cf.click();if(cf)cf.onchange=()=>saveProfileEdit();loadProfilePosts()}
async function loadProfilePosts(){const holder=$('profilePosts');if(!holder)return;const s=await db.ref('posts').orderByChild('uid').equalTo($('profileAddFriend')?.dataset.uid||currentUser.uid).once('value');const a=[];s.forEach(x=>a.push({id:x.key,...x.val()}));a.sort((x,y)=>(y.createdAt||0)-(x.createdAt||0));holder.innerHTML=a.length?a.slice(0,10).map(p=>`<div class="profile-post"><strong>${esc(p.text||'Publicação com mídia')}</strong>${p.imageURL?`<img src="${esc(p.imageURL)}">`:''}${p.videoURL?`<video src="${esc(p.videoURL)}" controls playsinline></video>`:''}</div>`).join(''):'<p class="muted">Nenhuma publicação ainda.</p>'}
function openProfileEditor(){const p=currentProfile||{};$('profileEditPanel').classList.add('open');$('editProfileName').value=p.displayName||currentUser.displayName||'';$('editProfileUsername').value=p.username||'';$('editProfileBio').value=p.bio||'';$('editProfileLocation').value=p.location||'';$('editProfileRelationship').value=p.relationship||''}
async function saveProfileEdit(){const b=$('saveProfileEdit');if(!b)return;b.disabled=true;b.textContent='Salvando...';try{const uid=currentUser.uid,data={displayName:$('editProfileName').value.trim(),username:$('editProfileUsername').value.trim().replace(/^@/,''),bio:$('editProfileBio').value.trim(),location:$('editProfileLocation').value.trim(),relationship:$('editProfileRelationship').value,updatedAt:firebase.database.ServerValue.TIMESTAMP};const cf=$('editProfileCover')?.files[0];if(profilePhotoCropped){const optimized=await imageFileToDataURL(dataURLToBlob(profilePhotoCropped),{maxWidth:900,maxHeight:900,maxOutput:1400*1024});const r=await uploadToR2(dataURLToBlob(optimized),'profile',uid,'profile.jpg');data.photoURL=r.url;data.photoKey=r.key}else if(currentProfile?.photoKey){data.photoURL=currentProfile.photoURL;data.photoKey=currentProfile.photoKey}if(cf){const optimized=await imageFileToDataURL(cf,{maxWidth:1600,maxHeight:700,maxOutput:1800*1024});const r=await uploadToR2(dataURLToBlob(optimized),'cover',uid,'cover.jpg');data.coverURL=r.url;data.coverKey=r.key}else if(currentProfile?.coverKey){data.coverURL=currentProfile.coverURL;data.coverKey=currentProfile.coverKey}await db.ref('profiles/'+uid).update(data);await currentUser.updateProfile({displayName:data.displayName||currentUser.displayName});currentProfile=await getProfile(uid);profilePhotoCropped='';$('editProfilePhoto').value='';$('editProfileCover').value='';$('profileEditPanel').classList.remove('open');renderOwnProfile();const ta=$('topAvatar');if(ta)ta.outerHTML=avatar(currentProfile.photoURL,'mini-avatar').replace('span class="mini-avatar"','span id="topAvatar" class="mini-avatar"');const ca=$('composerAvatar');if(ca)ca.outerHTML=avatar(currentProfile.photoURL,'avatar').replace('span class="avatar"','span id="composerAvatar" class="avatar"')}catch(e){console.error('saveProfileEdit',e);msg($('profileEditMsg'),'Não foi possível salvar: '+(e?.message||firebaseMessage(e)))}finally{b.disabled=false;b.textContent='Salvar alterações'}}
async function sendFriendRequest(uid,button){if(!uid||uid===currentUser.uid)return;try{const existing=await db.ref('friendRequests/'+uid+'/'+currentUser.uid).once('value');if(existing.exists()){button.textContent='Solicitação enviada';button.disabled=true;return}await db.ref('friendRequests/'+uid+'/'+currentUser.uid).set({uid:currentUser.uid,name:currentUser.displayName||'',createdAt:firebase.database.ServerValue.TIMESTAMP});await db.ref('notifications/'+uid).push({type:'friend_request',fromUid:currentUser.uid,fromName:currentUser.displayName||'',createdAt:firebase.database.ServerValue.TIMESTAMP,read:false});button.textContent='Solicitação enviada';button.disabled=true}catch(e){alert(firebaseMessage(e))}}
async function loadFriends(){const req=await db.ref('friendRequests/'+currentUser.uid).once('value'),r=[];req.forEach(x=>r.push({uid:x.key,...x.val()}));$('friendRequestsList').innerHTML=r.length?'<h3>Solicitações</h3>'+r.map(x=>`<div class="list-item"><div class="list-main">${avatar('','mini-avatar')}<div><strong>${esc(x.name||'Usuário')}</strong><small>Quer ser seu amigo.</small></div></div><button class="primary" data-accept="${x.uid}">Aceitar</button></div>`).join(''):'<p class="muted">Nenhuma solicitação de amizade.</p>';document.querySelectorAll('[data-accept]').forEach(b=>b.onclick=()=>acceptFriend(b.dataset.accept));const fs=await db.ref('friendships/'+currentUser.uid).once('value'),ids=[];fs.forEach(x=>ids.push(x.key));$('friendsList').innerHTML='<h3>Seus amigos</h3>'+(ids.length?'<div class="list">'+(await Promise.all(ids.map(async id=>{const p=await getProfile(id);return `<div class="list-item"><button class="suggestion-person" data-profile-uid="${id}">${avatar(p.photoURL,'mini-avatar')}<strong>${esc(p.displayName||'Usuário')}</strong></button><button class="secondary" data-message="${id}">Mensagem</button></div>`}))).join('')+'</div>':'<p class="muted">Você ainda não tem amigos.</p>');document.querySelectorAll('[data-message]').forEach(b=>b.onclick=()=>openChat(b.dataset.message));document.querySelectorAll('[data-profile-uid]').forEach(b=>b.onclick=()=>viewProfile(b.dataset.profileUid))}
async function acceptFriend(uid){const updates={};updates['friendships/'+currentUser.uid+'/'+uid]=true;updates['friendships/'+uid+'/'+currentUser.uid]=true;updates['friendRequests/'+currentUser.uid+'/'+uid]=null;await db.ref().update(updates);loadFriends()}
async function loadNotifications(){const s=await db.ref('notifications/'+currentUser.uid).orderByChild('createdAt').limitToLast(30).once('value'),a=[];s.forEach(x=>a.push(x.val()));a.reverse();$('notificationsList').innerHTML=a.length?a.map(x=>`<div class="list-item">${esc(x.fromName||'Alguém')} ${x.type==='friend_request'?'enviou uma solicitação de amizade.':'interagiu com você.'}</div>`).join(''):'<p class="muted">Nenhuma notificação.</p>'}
let activeGroupId=null, groupFilter='discover';
async function getGroupMembership(groupId,uid=currentUser.uid){const s=await db.ref('groupMembers/'+groupId+'/'+uid).once('value');return s.val()||null}
async function getGroupMemberCount(groupId){const s=await db.ref('groupMembers/'+groupId).once('value');return s.numChildren()}
async function createGroup(name,description,privacy){
  if(!name.trim())throw new Error('Informe o nome do grupo.');
  const ref=db.ref('groups').push();
  await ref.set({name:name.trim(),description:description.trim(),privacy:privacy||'public',ownerUid:currentUser.uid,createdAt:firebase.database.ServerValue.TIMESTAMP,membersCount:1});
  await db.ref('groupMembers/'+ref.key+'/'+currentUser.uid).set({role:'owner',joinedAt:firebase.database.ServerValue.TIMESTAMP});
  activeGroupId=ref.key; await loadGroups(); await openGroup(ref.key);
}
async function loadGroups(){
  const holder=$('groupsList'); if(!holder)return;
  const snap=await db.ref('groups').orderByChild('createdAt').limitToLast(50).once('value');
  const all=[];snap.forEach(x=>all.push({id:x.key,...(x.val()||{})}));all.reverse();
  const q=($('groupsSearch')?.value||'').trim().toLowerCase();
  let list=all.filter(g=>!q||(g.name||'').toLowerCase().includes(q)||(g.description||'').toLowerCase().includes(q));
  if(groupFilter==='mine'){
    const mine=[]; for(const g of list){if(await getGroupMembership(g.id))mine.push(g)} list=mine;
    $('groupsSectionTitle').textContent='Seus grupos';$('groupsSectionSub').textContent='Comunidades das quais você participa.';
  }else{$('groupsSectionTitle').textContent='Grupos em destaque';$('groupsSectionSub').textContent='Comunidades para descobrir no Eclipse.'}
  if(!list.length){holder.innerHTML=`<div class="groups-empty card"><div class="groups-empty-icon">◈</div><h3>${groupFilter==='mine'?'Você ainda não participa de grupos':'Nenhum grupo encontrado'}</h3><p class="muted">${groupFilter==='mine'?'Crie um grupo ou entre em uma comunidade para começar.':'Tente outra pesquisa ou crie uma nova comunidade.'}</p><button class="primary" id="emptyCreateGroup">＋ Criar grupo</button></div>`;$('emptyCreateGroup')?.addEventListener('click',openCreateGroup);return}
  const cards=[];
  for(const g of list){
    const members=await getGroupMemberCount(g.id),membership=await getGroupMembership(g.id);
    const privacy=g.privacy==='private'?'Privado':'Público';
    cards.push(`<article class="group-fb-card card"><div class="group-cover-fake"><span>◈</span></div><div class="group-card-body"><div class="group-card-icon">${esc((g.name||'G').slice(0,1).toUpperCase())}</div><div class="group-card-title"><h3>${esc(g.name||'Grupo')}</h3><span>${privacy} · ${members} ${members===1?'membro':'membros'}</span></div><p>${esc(g.description||'Comunidade do Eclipse.')}</p><div class="group-card-actions"><button class="secondary" data-open-group="${g.id}">Ver grupo</button>${membership?`<button class="group-joined" data-open-group="${g.id}">✓ Participando</button>`:`<button class="primary" data-join-group="${g.id}">Participar</button>`}</div></div></article>`)
  }
  holder.innerHTML=cards.join('');
  holder.querySelectorAll('[data-open-group]').forEach(b=>b.onclick=()=>openGroup(b.dataset.openGroup));
  holder.querySelectorAll('[data-join-group]').forEach(b=>b.onclick=async()=>{await joinGroup(b.dataset.joinGroup);loadGroups()});
}
function openCreateGroup(){const m=$('createGroupModal');if(!m)return;m.classList.add('is-open');m.setAttribute('aria-hidden','false');$('newGroupName').focus()}
function closeCreateGroup(){const m=$('createGroupModal');if(!m)return;m.classList.remove('is-open','open');m.setAttribute('aria-hidden','true')}
async function joinGroup(id){await db.ref('groupMembers/'+id+'/'+currentUser.uid).set({role:'member',joinedAt:firebase.database.ServerValue.TIMESTAMP});await db.ref('groups/'+id+'/membersCount').transaction(v=>(v||0)+1);if(activeGroupId===id)await renderGroupDetail(id)}
async function leaveGroup(id){const membership=await getGroupMembership(id);if(membership?.role==='owner'){alert('O dono do grupo não pode sair sem transferir a propriedade.');return}if(!confirm('Sair deste grupo?'))return;await db.ref('groupMembers/'+id+'/'+currentUser.uid).remove();await db.ref('groups/'+id+'/membersCount').transaction(v=>Math.max(0,(v||1)-1));if(activeGroupId===id)await renderGroupDetail(id);loadGroups()}
async function openGroup(id){activeGroupId=id;$('groupsBrowseView').classList.add('hidden');$('groupDetailView').classList.remove('hidden');await renderGroupDetail(id);scrollTo(0,0)}
function groupMediaHTML(p){if(!p.mediaURL)return '';if((p.mediaType||'').startsWith('video/'))return `<video class="group-post-media" src="${esc(p.mediaURL)}" controls preload="metadata"></video>`;return `<img class="group-post-media" src="${esc(p.mediaURL)}" alt="Imagem da publicação">`}
async function renderGroupDetail(id){
  const root=$('groupDetail');if(!root)return;const s=await db.ref('groups/'+id).once('value');if(!s.exists()){root.innerHTML='<div class="card"><p>Grupo não encontrado.</p></div>';return}
  const g={id,...s.val()};const membership=await getGroupMembership(id),members=await getGroupMemberCount(id),isMember=!!membership;
  root.innerHTML=`<div class="group-profile-head card"><div class="group-detail-cover"><div class="group-detail-mark">${esc((g.name||'G').slice(0,1).toUpperCase())}</div></div><div class="group-detail-info"><div><span class="eyebrow">${g.privacy==='private'?'GRUPO PRIVADO':'GRUPO PÚBLICO'}</span><h2>${esc(g.name||'Grupo')}</h2><p class="muted">${members} ${members===1?'membro':'membros'} · ${g.privacy==='private'?'Somente membros podem participar das conversas.':'Qualquer pessoa pode encontrar e participar.'}</p></div><div class="group-detail-actions">${isMember?(membership.role==='owner'?'<span class="group-role">★ Dono</span>':'')+`<button class="secondary" id="leaveGroupBtn">${membership.role==='owner'?'Gerenciar grupo':'Sair do grupo'}</button>`:`<button class="primary" id="joinDetailGroup">Participar do grupo</button>`}</div></div></div><div class="group-detail-tabs"><button class="active" data-gdetail-tab="posts">Discussão</button><button data-gdetail-tab="about">Sobre</button><button data-gdetail-tab="members">Membros</button></div><div id="groupPostsTab" class="group-detail-tab-panel"></div><div id="groupAboutTab" class="group-detail-tab-panel hidden"></div><div id="groupMembersTab" class="group-detail-tab-panel hidden"></div>`;
  $('joinDetailGroup')?.addEventListener('click',()=>joinGroup(id));$('leaveGroupBtn')?.addEventListener('click',()=>membership.role==='owner'?alert('As funções de administração do grupo serão ampliadas nesta versão.'):leaveGroup(id));
  root.querySelectorAll('[data-gdetail-tab]').forEach(b=>b.onclick=()=>switchGroupDetailTab(b.dataset.gdetailTab,id));
  await loadGroupPosts(id,isMember); await loadGroupAbout(id,g); await loadGroupMembers(id);
}
async function switchGroupDetailTab(tab,id){document.querySelectorAll('[data-gdetail-tab]').forEach(b=>b.classList.toggle('active',b.dataset.gdetailTab===tab));$('groupPostsTab').classList.toggle('hidden',tab!=='posts');$('groupAboutTab').classList.toggle('hidden',tab!=='about');$('groupMembersTab').classList.toggle('hidden',tab!=='members')}
async function loadGroupPosts(id,isMember){const root=$('groupPostsTab');if(!root)return;let composer='';if(isMember)composer=`<section class="group-composer card"><div class="group-composer-row">${avatar(currentProfile?.photoURL,'mini-avatar')}<button id="openGroupPostComposer" class="thinking">Escreva algo no grupo...</button></div><div class="group-composer-actions"><label class="group-media-button" for="groupPostMedia">▧ Foto ou vídeo</label><input id="groupPostMedia" class="native-file-input" type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"><span id="groupMediaName" class="media-selected">Nenhuma mídia</span><button id="publishGroupPost" class="primary">Publicar</button></div><textarea id="groupPostText" class="group-post-text hidden" placeholder="Escreva uma publicação para o grupo..."></textarea><div id="groupPostMsg" class="message"></div></section>`;const snap=await db.ref('groupPosts/'+id).orderByChild('createdAt').limitToLast(30).once('value'),posts=[];snap.forEach(x=>posts.push({id:x.key,...x.val()}));posts.reverse();let html=posts.map(p=>`<article class="group-post card"><div class="group-post-head">${avatar(p.photoURL,'mini-avatar')}<div><strong>${esc(p.name||'Usuário')}</strong><small>@${esc(p.username||'')} · ${p.createdAt?new Date(p.createdAt).toLocaleString('pt-BR'):''}</small></div></div>${p.text?`<p class="group-post-text-view">${esc(p.text)}</p>`:''}${groupMediaHTML(p)}<div class="group-post-actions"><button data-group-like="${p.id}">♡ ${p.likesCount||0}</button><button data-group-comment-focus="${p.id}">💬 ${p.commentsCount||0}</button></div><div id="groupComments-${p.id}" class="group-comments"></div></article>`).join('');if(!isMember&&!posts.length)html='<div class="card group-private-note"><h3>Participe do grupo</h3><p class="muted">Entre no grupo para ver e participar das publicações.</p></div>';if(!posts.length&&isMember)html='<div class="card group-private-note"><h3>Comece a conversa</h3><p class="muted">Seja a primeira pessoa a publicar neste grupo.</p></div>';root.innerHTML=composer+html;if(isMember){$('openGroupPostComposer').onclick=()=>{$('groupPostText').classList.toggle('hidden');$('groupPostText').focus()};$('groupPostMedia').onchange=e=>{if($('groupMediaName'))$('groupMediaName').textContent=e.target.files[0]?.name||'Nenhuma mídia'};$('publishGroupPost').onclick=()=>publishGroupPost(id)};root.querySelectorAll('[data-group-like]').forEach(b=>b.onclick=()=>toggleGroupLike(id,b.dataset.groupLike,b));root.querySelectorAll('[data-group-comment-focus]').forEach(b=>b.onclick=()=>{const el=$('groupComments-'+b.dataset.groupCommentFocus);el.innerHTML='<input class="group-comment-input" placeholder="Escreva um comentário e pressione Enter...">';const inp=el.querySelector('input');inp.focus();inp.onkeydown=e=>{if(e.key==='Enter')addGroupComment(id,b.dataset.groupCommentFocus,inp.value)};loadGroupComments(id,b.dataset.groupCommentFocus)});for(const p of posts)await loadGroupComments(id,p.id)}
async function publishGroupPost(id){const text=$('groupPostText').value.trim(),file=$('groupPostMedia').files[0],btn=$('publishGroupPost');if(!text&&!file)return msg($('groupPostMsg'),'Escreva algo ou escolha uma mídia.');btn.disabled=true;try{let mediaURL='',mediaType='',mediaKey='';if(file){let r;if(file.type.startsWith('image/')){const optimized=await imageFileToDataURL(file,{maxWidth:1280,maxHeight:1280,maxOutput:1500*1024});r=await uploadToR2(dataURLToBlob(optimized),'groups',currentUser.uid,file.name||'foto.jpg')}else if(file.type.startsWith('video/')){r=await uploadToR2(file,'groups',currentUser.uid,file.name||'video.mp4')}else throw new Error('Formato de mídia não suportado.');mediaURL=r.url;mediaType=r.type;mediaKey=r.key}await db.ref('groupPosts/'+id).push({uid:currentUser.uid,name:currentProfile?.displayName||currentUser.displayName||'Usuário',username:currentProfile?.username||'',photoURL:currentProfile?.photoURL||'',text,mediaURL,mediaType,mediaKey,createdAt:firebase.database.ServerValue.TIMESTAMP,likesCount:0,commentsCount:0});$('groupPostText').value='';$('groupPostMedia').value='';$('groupMediaName').textContent='Nenhuma mídia';await loadGroupPosts(id,true)}catch(e){msg($('groupPostMsg'),'Não foi possível publicar: '+firebaseMessage(e))}finally{btn.disabled=false}}
async function toggleGroupLike(groupId,postId,button){const ref=db.ref('groupReactions/'+groupId+'/'+postId+'/'+currentUser.uid);const exists=await ref.once('value');if(exists.exists()){await ref.remove();await db.ref('groupPosts/'+groupId+'/'+postId+'/likesCount').transaction(v=>Math.max(0,(v||1)-1));}else{await ref.set({type:'like',createdAt:firebase.database.ServerValue.TIMESTAMP});await db.ref('groupPosts/'+groupId+'/'+postId+'/likesCount').transaction(v=>(v||0)+1)}const s=await db.ref('groupPosts/'+groupId+'/'+postId+'/likesCount').once('value');button.textContent=`♡ ${s.val()||0}`}
async function loadGroupComments(groupId,postId){const el=$('groupComments-'+postId);if(!el)return;const s=await db.ref('groupComments/'+groupId+'/'+postId).orderByChild('createdAt').limitToLast(10).once('value'),a=[];s.forEach(x=>a.push(x.val()));const membership=await getGroupMembership(groupId);el.innerHTML=a.map(c=>`<div class="group-comment">${avatar(c.photoURL,'mini-avatar')}<div><strong>${esc(c.name||'Usuário')}</strong><p>${esc(c.text||'')}</p></div></div>`).join('')+(membership?`<input class="group-comment-input" placeholder="Comente nesta publicação..." data-comment-input="${postId}">`:'');el.querySelector('[data-comment-input]')?.addEventListener('keydown',e=>{if(e.key==='Enter')addGroupComment(groupId,postId,e.target.value)})}
async function addGroupComment(groupId,postId,text){text=(text||'').trim();if(!text)return;await db.ref('groupComments/'+groupId+'/'+postId).push({uid:currentUser.uid,name:currentProfile?.displayName||currentUser.displayName||'Usuário',photoURL:currentProfile?.photoURL||'',text,createdAt:firebase.database.ServerValue.TIMESTAMP});await db.ref('groupPosts/'+groupId+'/'+postId+'/commentsCount').transaction(v=>(v||0)+1);loadGroupComments(groupId,postId)}
async function loadGroupAbout(id,g){const el=$('groupAboutTab');if(el)el.innerHTML=`<div class="card group-about-card"><h3>Sobre este grupo</h3><p>${esc(g.description||'Este grupo ainda não possui uma descrição.')}</p><div class="group-about-row"><span>Privacidade</span><strong>${g.privacy==='private'?'Privado':'Público'}</strong></div><div class="group-about-row"><span>Criado em</span><strong>${g.createdAt?new Date(g.createdAt).toLocaleDateString('pt-BR'):'—'}</strong></div></div>`}
async function loadGroupMembers(id){const el=$('groupMembersTab');if(!el)return;const s=await db.ref('groupMembers/'+id).once('value'),ids=[];s.forEach(x=>ids.push({uid:x.key,...x.val()}));const rows=[];for(const m of ids){const p=await getProfile(m.uid);rows.push(`<div class="group-member-row">${avatar(p.photoURL,'mini-avatar')}<div><strong>${esc(p.displayName||'Usuário')}</strong><small>@${esc(p.username||'')}</small></div>${m.role==='owner'?'<span class="group-role">★ Dono</span>':''}</div>`)}el.innerHTML=`<div class="card group-members-card"><h3>Membros · ${ids.length}</h3><div class="group-members-list">${rows.join('')||'<p class="muted">Nenhum membro.</p>'}</div></div>`}
function bindGroups(){
  document.querySelectorAll('[data-group-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-group-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');groupFilter=b.dataset.groupFilter;loadGroups()});
  $('groupsSearch')?.addEventListener('input',()=>loadGroups());
  $('openCreateGroup')?.addEventListener('click',openCreateGroup);$('backToGroups')?.addEventListener('click',()=>{$('groupDetailView').classList.add('hidden');$('groupsBrowseView').classList.remove('hidden');activeGroupId=null;loadGroups()});
  $('cancelCreateGroup')?.addEventListener('click',closeCreateGroup);$('confirmCreateGroup')?.addEventListener('click',async()=>{const b=$('confirmCreateGroup');b.disabled=true;try{await createGroup($('newGroupName').value,$('newGroupDescription').value,$('newGroupPrivacy').value);$('newGroupName').value='';$('newGroupDescription').value='';closeCreateGroup();msg($('groupMsg'),'')}catch(e){msg($('groupMsg'),firebaseMessage(e))}finally{b.disabled=false}});
  $('createGroupModal')?.addEventListener('click',e=>{if(e.target.id==='createGroupModal')closeCreateGroup()});
}
function bindPrivacy(){$('privacyForm').addEventListener('submit',async e=>{e.preventDefault();try{await db.ref('privacySettings/'+currentUser.uid).set({friends:$('privacyFriends').value,find:$('privacyFind').value,requests:$('privacyRequests').value});msg($('privacyMsg'),'Privacidade salva.')}catch(err){msg($('privacyMsg'),firebaseMessage(err))}})}
async function discover(){const q=$('discoverInput').value.trim().toLowerCase(),s=await db.ref('profiles').once('value'),a=[];s.forEach(x=>{const p=x.val()||{};if(x.key!==currentUser.uid&&(!q||(p.displayName||'').toLowerCase().includes(q)||(p.username||'').toLowerCase().includes(q)))a.push({uid:x.key,...p})});$('discoverResults').innerHTML=a.map(p=>`<div class="list-item"><button class="suggestion-person" data-profile-uid="${p.uid}">${avatar(p.photoURL,'mini-avatar')}<div><strong>${esc(p.displayName||'Usuário')}</strong><small>@${esc(p.username||'')}</small></div></button><div><button class="primary" data-view-profile="${p.uid}">Ver perfil</button><button class="secondary" data-discover-add="${p.uid}">Adicionar</button></div></div>`).join('')||'<p class="muted">Nenhum perfil encontrado.</p>';document.querySelectorAll('[data-view-profile]').forEach(b=>b.onclick=()=>viewProfile(b.dataset.viewProfile));document.querySelectorAll('[data-discover-add]').forEach(b=>b.onclick=()=>sendFriendRequest(b.dataset.discoverAdd,b));document.querySelectorAll('[data-profile-uid]').forEach(b=>b.onclick=()=>viewProfile(b.dataset.profileUid))}
function bindDiscover(){$('discoverBtn').onclick=discover;$('globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){openPage('discoverPage');$('discoverInput').value=e.target.value;discover()}})}
async function loadChatFriends(){const bar=$('chatFriendsBar');if(!bar)return;const fs=await db.ref('friendships/'+currentUser.uid).once('value'),ids=[];fs.forEach(x=>ids.push(x.key));const profiles=await Promise.all(ids.slice(0,8).map(getProfile));bar.innerHTML=profiles.map(p=>`<button class="chat-friend" data-chat-user="${p.uid}">${avatar(p.photoURL,'mini-avatar')}<span>${esc(p.displayName||'Usuário')}</span></button>`).join('')||'<span class="muted">Adicione amigos para conversar.</span>';bar.querySelectorAll('[data-chat-user]').forEach(b=>b.onclick=()=>openChat(b.dataset.chatUser))}
async function openChat(uid){if(!uid||uid===currentUser.uid)return;activeChatUid=uid;const p=await getProfile(uid);$('chatName').textContent=p.displayName||'Usuário';$('chatStatus').textContent='@'+(p.username||'');const old=$('chatAvatar');if(old)old.outerHTML=avatar(p.photoURL,'mini-avatar').replace('span class="mini-avatar"','span id="chatAvatar" class="mini-avatar"');$('messageDock').classList.remove('hidden');const key=[currentUser.uid,uid].sort().join('_');if(activeChatRef)activeChatRef.off();activeChatRef=db.ref('messages/'+key);activeChatRef.on('value',s=>{const a=[];s.forEach(x=>a.push(x.val()));a.sort((x,y)=>(x.createdAt||0)-(y.createdAt||0));$('chatMessages').innerHTML=a.map(x=>`<div class="bubble ${x.uid===currentUser.uid?'mine':''}">${esc(x.text)}</div>`).join('');$('chatMessages').scrollTop=$('chatMessages').scrollHeight})}
function bindChat(){$('openChatBar').onclick=()=>{$('chatFriendsBar').classList.toggle('hidden');loadChatFriends()};$('closeChat').onclick=()=>{$('messageDock').classList.add('hidden');if(activeChatRef)activeChatRef.off();activeChatRef=null};$('chatForm').addEventListener('submit',async e=>{e.preventDefault();const t=$('chatText').value.trim();if(!t||!activeChatUid)return;const key=[currentUser.uid,activeChatUid].sort().join('_');await db.ref('messages/'+key).push({uid:currentUser.uid,text:t,createdAt:firebase.database.ServerValue.TIMESTAMP});$('chatText').value=''})}
document.addEventListener('change',e=>{if(e.target.id==='postImage'&&$('postMediaName'))$('postMediaName').textContent=e.target.files[0]?.name||'Nenhuma mídia selecionada';if(e.target.id==='storyImage'&&$('storyMediaName'))$('storyMediaName').textContent=e.target.files[0]?.name||'Nenhuma mídia selecionada'});
document.addEventListener('click',e=>{if(e.target.closest('#saveProfileEdit'))saveProfileEdit();if(e.target.closest('#cancelProfileEdit'))$('profileEditPanel').classList.remove('open')});
document.addEventListener('DOMContentLoaded',()=>{bindCropper();bindNavigation();bindAuth();bindSetup();bindFeed();bindChat();bindGroups();bindPrivacy();bindDiscover();if($('adminRoleForm'))$('adminRoleForm').addEventListener('submit',addAdminRole);const finishAuthBoot=()=>{document.body.classList.remove('auth-checking');document.body.classList.add('auth-ready')};if(initFirebase())auth.onAuthStateChanged(u=>{if(u){checkAfterLogin(u).finally(finishAuthBoot)}else{show('home');finishAuthBoot()}});else{if($('loginMsg'))$('loginMsg').textContent='Firebase não foi carregado.';finishAuthBoot()}});
})();

