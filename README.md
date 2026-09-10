# Projeto Eclipse — Alpha 0.0.0 — versão sem Vite

Esta versão é um site **estático**, feito somente com HTML, CSS e JavaScript.

Não usa:
- Vite
- React
- npm
- build
- GitHub Actions

Pode ser publicado diretamente no GitHub Pages.

## Publicação no GitHub Pages

Envie estes arquivos para a branch configurada no Pages e publique a pasta raiz.

O arquivo de entrada é:

`index.html`

Não há necessidade de executar `npm install` ou `npm run dev`.

## Firebase

O SDK do Firebase é carregado diretamente por CDN. Ative no Firebase Authentication:

**Authentication → Sign-in method → E-mail/Password**

Não é necessário ativar o Google.

A senha nunca é gravada no Realtime Database. O Firebase Authentication administra a credencial. Os dados do perfil são gravados em `users/{uid}` e `profiles/{uid}`.

Antes de produção, configure regras de segurança restritivas no Realtime Database e Storage.
