# Migração para o Firebase — passo a passo

Este guia liga o Firebase à Agenda: **esconde as chaves de API** (Gemini e
ElevenLabs) atrás de Cloud Functions e move a **base para a nuvem** (Firestore)
com login e sincronização entre aparelhos.

> Enquanto o `firebase-config.js` estiver com os valores `SUA_...`, o app
> continua funcionando no modo local antigo. Nada quebra até você concluir os
> passos abaixo.

---

## 0. Pré-requisitos (uma vez)

```bash
npm install -g firebase-tools
firebase login
```

## 1. Criar o projeto

1. Acesse <https://console.firebase.google.com> → **Adicionar projeto**.
2. Anote o **Project ID** (ex.: `agenda-lagares`).
3. Coloque o ID no arquivo **`.firebaserc`** (troque `SEU_PROJECT_ID_AQUI`).

## 2. Plano Blaze (necessário para o proxy)

As Cloud Functions só chamam APIs externas (Gemini/ElevenLabs) no plano
**Blaze (pago por uso)**. Em uso pessoal costuma custar ~R$ 0 (cota gratuita),
mas exige cartão. Console → ⚙️ **Uso e faturamento** → **Modificar plano** → Blaze.

## 3. Ativar os serviços no Console

- **Authentication** → Sign-in method → ative **Google**.
- **Firestore Database** → Criar banco → modo **produção** → região
  `southamerica-east1` (São Paulo).
- **App Check** → registre o app Web com **reCAPTCHA v3** e copie a
  **chave do site**. Em *APIs* do App Check, marque **Cloud Functions: Enforce**.

## 4. Registrar o app Web e preencher o config

1. Console → ⚙️ **Configurações do projeto** → **Seus apps** → ícone Web `</>`.
2. Copie o objeto `firebaseConfig` e cole em **`firebase-config.js`**.
3. Cole a **chave reCAPTCHA v3** em `window.FIREBASE_APPCHECK_SITE_KEY`.

## 5. Guardar as chaves de API como segredos

Use chaves **novas** (veja o passo 8 sobre revogar as antigas):

```bash
firebase functions:secrets:set GEMINI_KEY
firebase functions:secrets:set ELEVEN_KEY
```

## 6. Instalar dependências das funções

```bash
cd functions && npm install && cd ..
```

## 7. Publicar

```bash
firebase deploy --only firestore:rules,functions,hosting
```

Ao terminar, o app estará em `https://SEU_PROJETO.web.app`. Abra, toque no
botão **👤** (canto superior), entre com o Google e pronto: o Jarvis passa a
usar o proxy e a agenda sincroniza na nuvem.

### Domínios autorizados
Se for continuar usando o **GitHub Pages** além do Hosting, adicione o domínio
do Pages em **Authentication → Settings → Domínios autorizados** (senão o login
Google é bloqueado nele).

## 8. Revogar as chaves antigas (importante)

As chaves que estavam no código já foram expostas no repositório público.
Depois que o proxy estiver funcionando:

- **Gemini**: Google AI Studio / Cloud Console → API Keys → apague a chave antiga.
- **ElevenLabs**: Painel → Profile → API Keys → revogue a antiga.

Quando confirmar que tudo funciona pelo proxy, me avise que eu **removo as
chaves de fallback do `index.html`** (elas só existem hoje para o app não
quebrar durante a migração).

---

## Testar localmente (opcional)

```bash
firebase emulators:start
```

## Arquitetura

```
iPhone / navegador
  ├─ Jarvis  → Cloud Function (aiGemini/ttsGemini/ttsEleven) → Gemini / ElevenLabs
  │             (chaves ficam só no servidor, via Secret Manager + App Check)
  └─ Agenda  → Firestore  /users/{uid}  (tarefas, treinos e config na nuvem)
```

| Arquivo | Papel |
|---------|-------|
| `functions/index.js` | Proxy seguro das APIs (esconde as chaves) |
| `firestore.rules` | Cada usuário só acessa os próprios dados |
| `firebase-config.js` | Config pública do seu projeto (você preenche) |
| `firebase-client.js` | Login Google + App Check + backend do Jarvis |
| `firebase-sync.js` | Sincroniza agenda/treinos com o Firestore |
| `firebase.json` / `.firebaserc` | Deploy de hosting, functions e regras |
