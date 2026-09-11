CORREÇÃO DO R2 — PUBLICAÇÕES E STORIES

1. No Cloudflare Worker do Eclipse, substitua o código pelo arquivo worker.js deste projeto.
2. Em Settings > Bindings, confirme:
   Variable name: R2
   Type: R2 Bucket
   Bucket: seu bucket do Eclipse
3. Clique em Deploy.
4. Abra a URL do Worker. Deve aparecer:
   {"ok":true,"service":"Eclipse R2 Storage","status":"online","r2Binding":true}
5. O frontend usa:
   https://dry-limit-e851.eclipsesocialoficial.workers.dev

Esta versão retorna o erro real do R2 em "details", facilitando diagnóstico.
