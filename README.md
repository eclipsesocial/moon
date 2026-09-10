# Projeto Eclipse — Alpha 0.0.0

## IMPORTANTE: como abrir corretamente

Este é um projeto React/Vite. **Não abra o `index.html` com duplo clique** (`file://`), pois os módulos JavaScript do React podem ser bloqueados pelo navegador.

No terminal, dentro desta pasta:

```bash
npm install
npm run dev
```

Depois abra o endereço mostrado pelo Vite, normalmente:

`http://localhost:5173/`

## Correção desta versão

- Corrigido o `index.html` que continha um `\n` literal dentro do HTML.
- Adicionado um fallback visual para que a página inicial não fique totalmente branca caso o HTML seja aberto diretamente.
- Mantida a tela inicial Eclipse com identidade roxa/azul e logo de eclipse.
- O React continua responsável pela tela funcional de login, cadastro e aplicação.

## Firebase

O projeto usa Firebase Authentication, Realtime Database e Storage. Verifique as regras do Firebase antes de publicar em produção.


## Cadastro e proteção de dados

O Eclipse usa **Firebase Authentication com E-mail/Senha**, e não autenticação Google. O cadastro também grava os dados necessários no **Realtime Database**:

- `users/{uid}`: nome e papel básico da conta;
- `accountData/{uid}`: e-mail e data de nascimento, com leitura/escrita restritas ao próprio usuário;
- `profiles/{uid}`: dados públicos/editáveis do perfil.

**A senha nunca é gravada no Realtime Database.** Não é seguro armazenar senhas em texto ou criar uma senha reversivelmente criptografada. O Firebase Authentication gerencia o segredo de autenticação.

O tráfego entre navegador e Firebase usa HTTPS/TLS e o Firebase fornece criptografia dos dados armazenados. Para adicionar **criptografia de campo ponta a ponta** (por exemplo, criptografar dados privados antes de persistir), precisamos de uma camada de gerenciamento de chaves/servidor; colocar a chave secreta no JavaScript do navegador não seria uma proteção real.

### Ativar o cadastro por e-mail

No Firebase Console: **Authentication → Sign-in method → E-mail/Password → Enable**. Não é necessário ativar Google.

Depois, publique as regras do `database.rules.json` no Realtime Database.
