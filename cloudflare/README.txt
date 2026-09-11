ATUALIZAÇÃO DO WORKER R2

Cole o conteúdo de worker.js no Worker do Cloudflare.

IMPORTANTE:
1. Em Settings > Bindings, crie um R2 bucket binding.
2. Variable name: R2
3. Selecione o bucket do Eclipse.
4. Faça Deploy.
5. Abra a URL do Worker. Ela deve mostrar r2Binding: true.

O frontend usa:
https://dry-limit-e851.eclipsesocialoficial.workers.dev

Se a URL do Worker for alterada, atualize R2_WORKER_URL no app.js.
