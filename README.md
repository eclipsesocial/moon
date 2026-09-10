# Eclipse Alpha 0.0.0 — versão estática

Sem Vite, React ou npm.

Arquivos para GitHub Pages:
- index.html
- app.js
- style.css
- eclipse.svg

O JavaScript foi refeito para a navegação da página inicial, login, cadastro, configuração pós-cadastro e painel.

**No Firebase Authentication, ative E-mail/Password.**


### Painel administrativo
O primeiro administrador precisa ser cadastrado manualmente no Realtime Database, pois nenhum usuário deve conseguir elevar o próprio cargo pelo navegador.
Crie `admin/{UID_DO_PRIMEIRO_ADMIN}` com:
`{ "uid": "UID_DO_USUARIO", "role": "admin", "createdAt": <timestamp> }`
Depois disso, esse administrador pode adicionar administradores e moderadores pelo Painel administrativo usando o username.
Os cargos também são copiados para `profiles/{uid}.adminRole` para exibição do brasão.
