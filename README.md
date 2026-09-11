# Projeto Eclipse Alpha 0.0.0

Versão com:
- Firebase EclipseSocial / Realtime Database
- Menu lateral visível no PC e navegação responsiva no celular
- Exclusão de publicações pelo autor, administrador ou moderador
- Exclusão de comentários pelo autor do comentário, administrador ou moderador
- Contador de comentários atualizado ao apagar
- Exclusão de comentários e compartilhamentos associados ao apagar uma publicação


## Sistema de cargos
A estrutura de usuários usa um campo numérico `role` como fonte principal:
- `0` — Default/Usuário
- `1` — Moderador
- `2` — Administrador

Novos cadastros recebem automaticamente `role: 0`. O Painel administrativo aparece no menu lateral para cargos 1 e 2. Somente o cargo 2 pode promover/rebaixar usuários. A estrutura antiga `admin/{uid}` é mantida apenas para compatibilidade com dados anteriores.

## Cloudflare R2

A versão atual usa o Worker R2 abaixo para mídia:

`https://dry-limit-e851.eclipsesocialoficial.workers.dev`

O frontend envia arquivos para `POST /upload` e grava no Realtime Database somente a URL/chave do objeto. Fotos de perfil/capa, fotos e vídeos de publicações, stories e mídia de grupos passam pelo R2.

O Worker precisa ter um R2 Bucket Binding chamado `R2`. As credenciais do R2 nunca devem ser colocadas no frontend.
