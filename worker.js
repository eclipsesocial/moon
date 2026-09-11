// Cloudflare Worker — Eclipse R2 Storage
// Bind an R2 bucket with the variable name: R2
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg','image/png','image/webp','image/gif',
  'video/mp4','video/webm','video/quicktime'
]);
const ALLOWED_FOLDERS = new Set(['profile','cover','posts','videos','stories','albums','groups','chat','bugs']);

function cors(request){
  const origin=request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
function json(request,data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8',...cors(request)}});
}
function safeSegment(value,max=120){
  return String(value||'').replace(/[^a-zA-Z0-9._-]/g,'_').replace(/\.\./g,'').slice(0,max);
}
function ext(type){
  return ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'})[type] || 'bin';
}

export default {
  async fetch(request,env){
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers:cors(request)});
    const url=new URL(request.url);
    const bucket=env.R2;

    if(url.pathname==='/' && request.method==='GET'){
      return json(request,{ok:true,service:'Eclipse R2 Storage',status:'online',r2Binding:Boolean(bucket)});
    }
    if(!bucket) return json(request,{ok:false,error:'R2 não está conectado ao Worker.',details:'Em Settings > Bindings, adicione um R2 Bucket Binding com Variable name = R2.'},500);

    if(url.pathname==='/upload' && request.method==='POST'){
      try{
        const form=await request.formData();
        const file=form.get('file');
        const folder=safeSegment(form.get('folder'));
        const uid=safeSegment(form.get('uid'));
        if(!file || typeof file==='string') return json(request,{ok:false,error:'Arquivo não enviado.'},400);
        if(!uid) return json(request,{ok:false,error:'UID do usuário não informado.'},400);
        if(!ALLOWED_FOLDERS.has(folder)) return json(request,{ok:false,error:'Pasta de armazenamento não permitida.'},400);
        if(file.size<=0) return json(request,{ok:false,error:'O arquivo está vazio.'},400);
        if(file.size>MAX_FILE_SIZE) return json(request,{ok:false,error:'Arquivo muito grande. Limite de 100 MB.'},413);
        const contentType=file.type || 'application/octet-stream';
        if(!ALLOWED_TYPES.has(contentType)) return json(request,{ok:false,error:'Tipo de arquivo não permitido: '+contentType},415);
        const key=`${folder}/${uid}/${Date.now()}_${crypto.randomUUID()}.${ext(contentType)}`;
        // Passing the File/Blob directly avoids stream incompatibilities in some Worker runtimes.
        await bucket.put(key,file,{httpMetadata:{contentType,cacheControl:'public, max-age=31536000'}});
        return json(request,{ok:true,key,contentType,size:file.size},201);
      }catch(error){
        console.error('Eclipse R2 upload error',error);
        return json(request,{ok:false,error:'Erro ao enviar arquivo para o R2.',details:error?.message || String(error),name:error?.name || 'Error'},500);
      }
    }

    if(url.pathname==='/file' && request.method==='GET'){
      const key=String(url.searchParams.get('key')||'').replace(/^\/+/,'');
      if(!key || key.includes('..')) return json(request,{ok:false,error:'Arquivo inválido.'},400);
      try{
        const object=await bucket.get(key);
        if(!object) return json(request,{ok:false,error:'Arquivo não encontrado.'},404);
        const headers=new Headers(cors(request));
        object.writeHttpMetadata(headers);
        headers.set('ETag',object.httpEtag);
        headers.set('Cache-Control','public, max-age=31536000');
        return new Response(object.body,{headers});
      }catch(error){
        return json(request,{ok:false,error:'Erro ao ler arquivo do R2.',details:error?.message || String(error)},500);
      }
    }

    if(url.pathname==='/file' && request.method==='DELETE'){
      const key=String(url.searchParams.get('key')||'').replace(/^\/+/,'');
      if(!key || key.includes('..')) return json(request,{ok:false,error:'Arquivo inválido.'},400);
      try{ await bucket.delete(key); return json(request,{ok:true,deleted:key}); }
      catch(error){ return json(request,{ok:false,error:'Erro ao apagar arquivo do R2.',details:error?.message || String(error)},500); }
    }
    return json(request,{ok:false,error:'Rota não encontrada.'},404);
  }
};
