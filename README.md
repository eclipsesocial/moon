# Eclipse Alpha 0.0.0 — versão estática

Sem Vite, React ou npm.

Arquivos para GitHub Pages:
- index.html
- app.js
- style.css
- eclipse.svg

## Firebase
- Authentication: E-mail/Password.
- Realtime Database: usado para os dados do projeto.
- Firebase Storage: **não é necessário para esta versão**.

## Fotos armazenadas no Realtime Database
Esta versão foi adaptada para não depender do Firebase Storage. As imagens são processadas no navegador (redimensionadas e comprimidas) e salvas como **Data URL (base64)** diretamente no Realtime Database.

As fotos de:
- perfil → `profiles/{UID}/photoURL`
- capa → `profiles/{UID}/coverURL`
- publicações → `posts/{POST_ID}/imageURL`
- stories → `statuses/{STATUS_ID}/imageURL`

não são enviadas para o Firebase Storage.

Para evitar registros grandes demais, o navegador reduz as imagens antes de gravá-las no banco. A imagem original pode ter até 10 MB; depois do processamento, o tamanho é limitado por tipo de uso.

> Observação: armazenar imagens em base64 no Realtime Database aumenta bastante o tamanho do banco. Esta solução é adequada para o Alpha/testes, mas para uma rede social grande o ideal futuramente será usar armazenamento de arquivos separado.

### Painel administrativo
O primeiro administrador precisa ser cadastrado manualmente no Realtime Database, pois nenhum usuário deve conseguir elevar o próprio cargo pelo navegador.
Crie `admin/{UID_DO_PRIMEIRO_ADMIN}` com:
`{ "uid": "UID_DO_USUARIO", "role": "admin", "createdAt": <timestamp> }`
Depois disso, esse administrador pode adicionar administradores e moderadores pelo Painel administrativo usando o username.
Os cargos também são copiados para `profiles/{uid}.adminRole` para exibição do brasão.
