# Publicar pelo iPhone (Cloud Shell) — roteiro guiado

Dá para fazer tudo no **Safari do celular**. Duas ferramentas:
- **Console do Firebase** (criar o projeto e ativar serviços) — telas normais.
- **Google Cloud Shell** (terminal no navegador, já logado, Firebase CLI pronto).

Faça na ordem. Onde tiver `MAIÚSCULAS`, troque pelo seu valor.

---

## Parte 1 — Console do Firebase (no Safari)

1. Abra <https://console.firebase.google.com> e faça login.
2. **Adicionar projeto** → dê um nome (ex.: `agenda-lagares`) → anote o
   **Project ID** que ele gerar (algo como `agenda-lagares-1a2b3`).
3. **Plano Blaze**: menu ⚙️ → **Uso e faturamento** → **Modificar plano** →
   escolha **Blaze** (precisa de cartão; em uso pessoal costuma custar ~R$ 0).
4. **Authentication** → *Começar* → **Sign-in method** → ative **Google** →
   Salvar.
5. **Firestore Database** → *Criar banco* → modo **Produção** → região
   **`southamerica-east1`** → Ativar.
6. **App Check** → registre o app **Web** com **reCAPTCHA v3** e copie a
   **chave do site** (guarde). Depois, na aba *APIs*, marque
   **Cloud Functions → Impor (Enforce)**.
7. **Registrar o app Web**: ⚙️ **Configurações do projeto** → role até
   **Seus apps** → ícone **`</>`** → registre. Copie os valores do
   `firebaseConfig` (apiKey, authDomain, projectId, etc.).

## Parte 2 — Preencher a config (pelo GitHub, no Safari)

1. Abra o arquivo:
   <https://github.com/LGRSV/agenda-iphone/blob/claude/project-access-p5yl10/firebase-config.js>
2. Toque no **lápis** (Editar).
3. Troque os `SUA_.../SEU_...` pelos valores do passo 1.7 e a
   `FIREBASE_APPCHECK_SITE_KEY` pela chave do passo 1.6.
4. **Commit changes** (confirme na mesma branch `claude/project-access-p5yl10`).

## Parte 3 — Cloud Shell (terminal no navegador)

1. Abra <https://shell.cloud.google.com> no Safari e autorize.
2. Cole os comandos abaixo (um bloco de cada vez):

```bash
git clone https://github.com/LGRSV/agenda-iphone
cd agenda-iphone
git checkout claude/project-access-p5yl10
firebase use SEU_PROJECT_ID
```

Guardar as chaves de API (cole a chave **nova** quando pedir e dê Enter):

```bash
firebase functions:secrets:set GEMINI_KEY
firebase functions:secrets:set ELEVEN_KEY
```

Instalar dependências e publicar:

```bash
cd functions && npm install && cd ..
firebase deploy --only firestore:rules,functions,hosting
```

3. No fim aparece a URL `https://SEU_PROJETO.web.app`. Abra no Safari,
   toque no **👤** (canto superior), entre com o Google. Pronto: o Jarvis
   passa pelo proxy e a agenda sincroniza na nuvem.

## Parte 4 — Domínio do GitHub Pages (se ainda usar)

Se for continuar abrindo pelo GitHub Pages além do Hosting, adicione o domínio
dele em **Authentication → Settings → Domínios autorizados** (senão o login
Google é bloqueado lá).

## Parte 5 — Revogar as chaves antigas (importante)

Depois de confirmar que tudo funciona pelo proxy:
- **Gemini**: apague a chave antiga no Google AI Studio / Cloud Console.
- **ElevenLabs**: revogue a chave antiga no painel.
- Me avise que eu **removo o fallback do `index.html`**.

---

### Dicas
- Erro `Blaze required` → falta o passo 1.3.
- Login Google não abre no app instalado → use primeiro pelo Safari normal.
- Deu erro em algum comando → me manda a mensagem exata que eu ajusto.
