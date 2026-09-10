import React, { useEffect, useMemo, useState } from 'react'
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updateProfile
} from 'firebase/auth'
import { auth, db } from './firebase'
import { ref, onValue } from 'firebase/database'
import {
  Moon, Home, User, Users, MessageCircle, Bell, Search, Settings, Shield,
  Image, Music2, LogOut, Plus, Heart, MessageSquare, Send, UserPlus,
  Video, Compass, Menu, X, Lock, UserRoundPlus, ChevronRight, Sparkles
} from 'lucide-react'
import {
  saveUser, saveProfile, saveAccountData, createPost, createStatus, createGroup, addFriend,
  sendMessage, sendNotification, blockUser
} from './services'

const nav = [
  ['Início', Home], ['Meu perfil', User], ['Amigos', Users], ['Grupos', Users],
  ['Mensagens', MessageCircle], ['Notificações', Bell], ['Descobrir', Compass],
  ['Privacidade', Shield], ['Configurações', Settings]
]

function Logo({large=false}) {
  return <div className={large ? 'logo logo-large' : 'logo'}>
    <span className="eclipse-logo"><span/></span>
    <div><strong>Eclipse</strong>{large && <small>ALPHA 0.0.0</small>}</div>
  </div>
}

function Landing({goLogin,goSignup}) {
  return <main className="landing">
    <div className="stars stars-one"/><div className="stars stars-two"/>
    <div className="landing-glow"/>
    <nav className="landing-nav"><Logo/><div className="landing-links"><button onClick={goLogin}>Entrar</button><button className="nav-cta" onClick={goSignup}>Criar conta</button></div></nav>
    <section className="hero">
      <div className="hero-copy">
        <span className="eyebrow"><Sparkles size={14}/> SUA IDENTIDADE. SEU UNIVERSO.</span>
        <h1>Onde sua<br/><em>história</em> ganha vida.</h1>
        <p>Eclipse é uma rede social criada para quem transforma perfis em personagens, histórias e universos próprios.</p>
        <div className="hero-actions"><button className="primary hero-btn" onClick={goSignup}>Criar meu perfil <ChevronRight size={18}/></button><button className="ghost-btn" onClick={goLogin}>Já tenho uma conta</button></div>
      </div>
      <div className="hero-orbit">
        <div className="orbit orbit-a"/><div className="orbit orbit-b"/>
        <div className="moon-hero"><span/></div>
        <div className="orbit-dot dot-a"/><div className="orbit-dot dot-b"/>
      </div>
    </section>
    <section className="landing-features">
      <div><b>01</b><h3>Identidade</h3><p>Crie um perfil que represente seu personagem.</p></div>
      <div><b>02</b><h3>Conexões</h3><p>Faça amizades, participe de grupos e converse.</p></div>
      <div><b>03</b><h3>Histórias</h3><p>Publique textos, fotos, vídeos e status.</p></div>
    </section>
  </main>
}

function Auth({initial='login', onBack}) {
  const [mode,setMode]=useState(initial), [email,setEmail]=useState(''), [password,setPassword]=useState('')
  const [name,setName]=useState(''), [username,setUsername]=useState(''), [birth,setBirth]=useState('')
  const [error,setError]=useState(''), [busy,setBusy]=useState(false)
  async function submit(e){
    e.preventDefault(); setError(''); setBusy(true)
    if(!auth){ setError('O Firebase ainda não está disponível. A página inicial funciona, mas o login/cadastro precisa da configuração do Firebase.'); setBusy(false); return }
    try {
      if(mode==='login') await signInWithEmailAndPassword(auth,email,password)
      else {
        const cred=await createUserWithEmailAndPassword(auth,email,password)
        await updateProfile(cred.user,{displayName:name})
        const clean=username.toLowerCase().replace(/[^a-z0-9._]/g,'')
        // Firebase Email/Password autentica a conta; não existe login Google neste projeto.
        // Os dados do cadastro são gravados diretamente no Realtime Database.
        // A senha NÃO é armazenada no banco: o Firebase Auth mantém o segredo de forma segura.
        await saveUser(cred.user.uid,{name,role:'user'})
        await saveAccountData(cred.user.uid,{email,birthDate:birth})
        await saveProfile(cred.user.uid,{displayName:name,username:clean,bio:'',location:'',relationship:'',profilePhotoUrl:'',coverPhotoUrl:'',spotify:''})
      }
    } catch(err){ setError(err.code==='auth/invalid-credential'?'E-mail ou senha incorretos.':err.message) }
    finally{setBusy(false)}
  }
  return <main className="auth-shell">
    <div className="auth-back" onClick={onBack}>← Voltar</div>
    <div className="auth-visual"><Logo large/><div className="auth-moon"><span/></div><h2>{mode==='login'?'Volte para o seu universo.':'Comece a criar o seu.'}</h2><p>Uma nova forma de viver identidades interpretativas.</p></div>
    <section className="auth-card">
      <div className="mobile-logo"><Logo/></div>
      <div className="auth-tabs"><button className={mode==='login'?'selected':''} onClick={()=>setMode('login')}>Entrar</button><button className={mode==='signup'?'selected':''} onClick={()=>setMode('signup')}>Criar conta</button></div>
      <h1>{mode==='login'?'Bem-vindo de volta.':'Crie sua conta.'}</h1>
      <p className="muted">{mode==='login'?'Entre com seu e-mail e senha.':'Seu universo começa com alguns dados básicos.'}</p>
      <form onSubmit={submit}>
        {mode==='signup' && <>
          <input placeholder="Nome" value={name} onChange={e=>setName(e.target.value)} required/>
          <input placeholder="Nome de usuário" value={username} onChange={e=>setUsername(e.target.value)} required/>
          <input type="date" value={birth} onChange={e=>setBirth(e.target.value)} required/>
        </>}
        <input type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} required/>
        <input type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} required minLength="6"/>
        {error && <div className="error">{error}</div>}
        <button className="primary auth-submit" disabled={busy}>{busy?'Aguarde…':mode==='login'?'Entrar no Eclipse':'Criar minha conta'}</button>
      </form>
      <p className="switch">{mode==='login'?'Ainda não tem uma conta?':'Já possui uma conta?'} <button onClick={()=>setMode(mode==='login'?'signup':'login')}>{mode==='login'?'Cadastre-se':'Entrar'}</button></p>
    </section>
  </main>
}

function App(){
  const [user,setUser]=useState(null), [authReady,setAuthReady]=useState(!auth), [route,setRoute]=useState('landing')
  useEffect(()=>{
    if(!auth){ setAuthReady(true); return }
    return onAuthStateChanged(auth,u=>{setUser(u);setAuthReady(true)})
  },[])
  if(!authReady) return <div className="loading"><div className="loading-logo"><Logo/><span>Entrando no Eclipse…</span></div></div>
  if(user) return <Dashboard user={user}/>
  if(route==='login') return <Auth initial="login" onBack={()=>setRoute('landing')}/>
  if(route==='signup') return <Auth initial="signup" onBack={()=>setRoute('landing')}/>
  return <Landing goLogin={()=>setRoute('login')} goSignup={()=>setRoute('signup')}/>
}

function Dashboard({user}){
  const [page,setPage]=useState('Início'), [profile,setProfile]=useState(null), [posts,setPosts]=useState({}), [mobile,setMobile]=useState(false)
  useEffect(()=>onValue(ref(db,`profiles/${user.uid}`),s=>setProfile(s.val())),[user.uid])
  useEffect(()=>onValue(ref(db,'posts'),s=>setPosts(s.val()||{})),[])
  const ordered=useMemo(()=>Object.values(posts).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)),[posts])
  const content = {
    'Início':<HomePage user={user} profile={profile} posts={ordered}/>,
    'Meu perfil':<ProfilePage user={user} profile={profile}/>,
    'Amigos':<FriendsPage user={user}/>, 'Grupos':<GroupsPage user={user}/>,
    'Mensagens':<ChatPage user={user}/>,
    'Notificações':<SimplePage title="Notificações" icon={Bell} text="Sua central de atividades aparecerá aqui."/>,
    'Descobrir':<SimplePage title="Descobrir" icon={Compass} text="Encontre pessoas, grupos e universos dentro do Eclipse."/>,
    'Privacidade':<PrivacyPage user={user}/>,
    'Configurações':<SimplePage title="Configurações" icon={Settings} text="Gerencie sua conta e experiência no Eclipse."/>
  }[page]
  return <div className="app">
    <header className="topbar"><button className="mobile-menu" onClick={()=>setMobile(!mobile)}>{mobile?<X/>:<Menu/>}</button><div className="brand-wrap"><Logo/></div>
      <div className="search"><Search size={17}/><input placeholder="Pesquisar no Eclipse…"/></div>
      <div className="top-actions"><button title="Notificações" onClick={()=>setPage('Notificações')}><Bell/></button><button title="Mensagens" onClick={()=>setPage('Mensagens')}><MessageCircle/></button><button title="Sair" onClick={()=>signOut(auth)}><LogOut/></button></div>
    </header>
    <div className="layout"><aside className={'sidebar '+(mobile?'open':'')}>
      <div className="profile-mini"><div className="avatar">{(profile?.displayName||user.email||'E')[0].toUpperCase()}</div><div><b>{profile?.displayName||'Seu perfil'}</b><small>@{profile?.username||'eclipse'}</small></div></div>
      <nav>{nav.map(([label,Icon])=><button className={page===label?'active':''} key={label} onClick={()=>{setPage(label);setMobile(false)}}><Icon size={19}/>{label}</button>)}</nav>
      <div className="sidebar-bottom"><span>ALPHA 0.0.0</span><button onClick={()=>signOut(auth)}><LogOut size={17}/> Sair</button></div>
    </aside><main className="content">{content}</main></div>
  </div>
}

function Section({title,icon:Icon,children}){return <section className="section"><div className="section-title"><Icon size={20}/><h2>{title}</h2></div>{children}</section>}

function HomePage({user,profile,posts}){
 const [text,setText]=useState(''),[status,setStatus]=useState('')
 async function publish(){if(!text.trim())return;try{await createPost(user.uid,{text:text.trim(),authorName:profile?.displayName||'Eclipse User',visibility:'public'});setText('')}catch(e){alert(e.message)}}
 async function postStatus(){if(!status.trim())return;try{await createStatus(user.uid,{text:status.trim(),authorName:profile?.displayName||'Eclipse User',visibility:'public'});setStatus('')}catch(e){alert(e.message)}}
 return <div className="page"><div className="welcome"><div><span>SEU UNIVERSO</span><h1>Entre no seu universo.</h1><p>O que acontece na sua história hoje?</p></div><div className="halo"><Moon/></div></div>
 <Section title="Status" icon={Sparkles}><div className="status-row"><div className="avatar">{(profile?.displayName||'E')[0]}</div><input value={status} onChange={e=>setStatus(e.target.value)} placeholder="Compartilhe um momento…"/><button className="primary small" onClick={postStatus}>Publicar</button></div></Section>
 <Section title="Criar publicação" icon={Plus}><div className="composer"><div className="avatar">{(profile?.displayName||'E')[0]}</div><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="O que está acontecendo no seu universo?"/><div className="composer-tools"><span><Image size={18}/> Foto</span><span><Video size={18}/> Vídeo</span><button className="primary small" onClick={publish}><Send size={16}/> Publicar</button></div></div></Section>
 <Section title="Feed Eclipse" icon={Home}>{posts.length===0?<div className="empty">Ainda não há publicações. Seja o primeiro a criar algo.</div>:posts.map(p=><article className="post" key={p.id}><div className="post-head"><div className="avatar">{(p.authorName||'E')[0]}</div><div><b>{p.authorName||'Usuário'}</b><small>no Eclipse</small></div></div><p>{p.text}</p><div className="post-actions"><button><Heart/> Curtir</button><button><MessageSquare/> Comentar</button><button><Send/> Compartilhar</button></div></article>)}</Section></div>
}

function ProfilePage({user,profile}){
 const [form,setForm]=useState(profile||{}); useEffect(()=>setForm(profile||{}),[profile])
 async function save(){try{await saveProfile(user.uid,{...form})}catch(e){alert(e.message)}}
 return <div className="page"><div className="cover"><div className="cover-glow"/><div className="profile-avatar avatar xl">{(form.displayName||user.email||'E')[0]}</div></div>
 <div className="profile-head"><div><h1>{form.displayName||'Seu perfil'}</h1><p className="muted">@{form.username||'eclipse'} · {form.location||'Local não informado'}</p><p>{form.bio||'Sua biografia aparecerá aqui.'}</p></div><button className="secondary" onClick={save}>Salvar perfil</button></div>
 <Section title="Editar perfil" icon={User}><div className="form-grid">{[['displayName','Nome'],['username','Nome de usuário'],['bio','Biografia'],['location','Onde mora'],['relationship','Relacionamento'],['spotify','Música / Spotify']].map(([k,l])=><label key={k}>{l}<input value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}</div></Section></div>
}

function FriendsPage({user}){const [uid,setUid]=useState('');async function request(){if(!uid.trim())return;await addFriend(user.uid,uid.trim());await sendNotification(uid.trim(),{type:'friend_request',from:user.uid,text:'Você recebeu uma solicitação de amizade.'});setUid('')}return <div className="page"><Section title="Amigos" icon={Users}><p className="muted">Envie uma solicitação de amizade pelo UID enquanto o sistema de descoberta é desenvolvido.</p><div className="inline"><input value={uid} onChange={e=>setUid(e.target.value)} placeholder="UID do usuário"/><button className="primary" onClick={request}><UserPlus/> Adicionar</button></div></Section></div>}
function GroupsPage({user}){const [name,setName]=useState(''),[description,setDescription]=useState('');async function create(){if(!name.trim())return;await createGroup(user.uid,{name,description,visibility:'public'});setName('');setDescription('')}return <div className="page"><Section title="Grupos" icon={Users}><div className="form-grid"><label>Nome do grupo<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Descrição<textarea value={description} onChange={e=>setDescription(e.target.value)}/></label></div><button className="primary" onClick={create}><Plus/> Criar grupo</button></Section></div>}
function ChatPage({user}){const [chat,setChat]=useState(''),[msg,setMsg]=useState('');async function send(){if(!chat||!msg)return;await sendMessage(chat,user.uid,msg);setMsg('')}return <div className="page"><Section title="Mensagens" icon={MessageCircle}><div className="form-grid"><label>ID da conversa<input value={chat} onChange={e=>setChat(e.target.value)} placeholder="chatId"/></label><label>Mensagem<textarea value={msg} onChange={e=>setMsg(e.target.value)}/></label></div><button className="primary" onClick={send}><Send/> Enviar</button></Section></div>}
function PrivacyPage({user}){const [data,setData]=useState({friends:'friends',posts:'friends',findable:true,friendRequests:true,tags:'review'});async function save(){await saveProfile(user.uid,{privacy:data})}return <div className="page"><Section title="Checkup de Privacidade" icon={Shield}><div className="settings-list"><label>Lista de amigos<select value={data.friends} onChange={e=>setData({...data,friends:e.target.value})}><option value="public">Todos</option><option value="friends">Amigos</option><option value="private">Somente eu</option></select></label><label>Publicações<select value={data.posts} onChange={e=>setData({...data,posts:e.target.value})}><option value="public">Todos</option><option value="friends">Amigos</option><option value="private">Somente eu</option></select></label><label>Encontrar você<select value={data.findable?'yes':'no'} onChange={e=>setData({...data,findable:e.target.value==='yes'})}><option value="yes">Permitir</option><option value="no">Não permitir</option></select></label><label>Pedidos de amizade<select value={data.friendRequests?'yes':'no'} onChange={e=>setData({...data,friendRequests:e.target.value==='yes'})}><option value="yes">Receber</option><option value="no">Não receber</option></select></label><label>Marcações<select value={data.tags} onChange={e=>setData({...data,tags:e.target.value})}><option value="review">Revisar antes de aparecer</option><option value="auto">Permitir automaticamente</option></select></label></div><button className="primary" onClick={save}><Lock/> Salvar privacidade</button></Section></div>}
function SimplePage({title,icon:Icon,text}){return <div className="page"><Section title={title} icon={Icon}><div className="empty">{text}</div></Section></div>}
export default App
