const ALLOWED_TYPES = [
  'image/jpeg','image/png','image/webp','image/gif',
  'video/mp4','video/webm','video/quicktime'
];
const MAX_FILE_SIZE = 100 * 1024 * 1024;

function cors(request) {
  const origin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
function json(request, data, status=200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {'Content-Type':'application/json; charset=utf-8', ...cors(request)}
  });
}
function safe(v) {
  return String(v || '').replace(/[^a-zA-Z0-9._/-]/g,'_').replace(/\.\./g,'').replace(/^\/+/, '').slice(0,500);
}
function ext(type) {
  return ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'})[type] || 'bin';
}

export default {
  async fetch(request, env) {
    if(request.method === 'OPTIONS') return new Response(null,{status:204,headers:cors(request)});
    const url = new URL(request.url);
    const bucket = env.R2;

    if(url.pathname === '/' && request.method === 'GET') {
      return json(request,{ok:true,service:'Eclipse R2 Storage',status:'online',r2Binding:!!bucket});
    }

    if(!bucket) return json(request,{ok:false,error:'O binding R2 não está configurado neste Worker. Em Settings > Bindings, adicione o bucket com a variável R2.'},500);

    if(url.pathname === '/upload' && request.method === 'POST') {
      try {
        const form = await request.formData();
        const file = form.get('file');
        const folder = safe(form.get('folder'));
        const uid = safe(form.get('uid'));
        if(!file || typeof file === 'string') return json(request,{ok:false,error:'Arquivo não enviado.'},400);
        if(!uid) return json(request,{ok:false,error:'UID do usuário não informado.'},400);
        if(!folder) return json(request,{ok:false,error:'Pasta não informada.'},400);
        if(file.size > MAX_FILE_SIZE) return json(request,{ok:false,error:'Arquivo muito grande. Limite de 100 MB.'},413);
        const contentType = file.type || 'application/octet-stream';
        if(!ALLOWED_TYPES.includes(contentType)) return json(request,{ok:false,error:'Tipo de arquivo não permitido: '+contentType},415);
        const key = `${folder}/${uid}/${Date.now()}_${crypto.randomUUID()}.${ext(contentType)}`;
        await bucket.put(key,file.stream(),{httpMetadata:{contentType,cacheControl:'public, max-age=31536000'}});
        return json(request,{ok:true,key,contentType,size:file.size},201);
      } catch(e) {
        console.error('R2 upload',e);
        return json(request,{ok:false,error:'Erro ao enviar arquivo para o R2.',details:e?.message || String(e)},500);
      }
    }

    if(url.pathname === '/file' && request.method === 'GET') {
      const key=safe(url.searchParams.get('key'));
      if(!key)return json(request,{ok:false,error:'Arquivo não informado.'},400);
      const object=await bucket.get(key);
      if(!object)return json(request,{ok:false,error:'Arquivo não encontrado.'},404);
      const headers=new Headers(cors(request));
      object.writeHttpMetadata(headers);
      headers.set('ETag',object.httpEtag);
      headers.set('Cache-Control','public, max-age=31536000');
      return new Response(object.body,{headers});
    }

    if(url.pathname === '/file' && request.method === 'DELETE') {
      const key=safe(url.searchParams.get('key'));
      if(!key)return json(request,{ok:false,error:'Arquivo não informado.'},400);
      await bucket.delete(key);
      return json(request,{ok:true,deleted:key});
    }

    return json(request,{ok:false,error:'Rota não encontrada.'},404);
  }
};
