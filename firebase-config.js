/* =========================================================================
   Configuração do Firebase — PREENCHA com os dados do SEU projeto.
   Estes valores são PÚBLICOS por natureza (podem ficar no repositório).
   Enquanto os campos estiverem com "SUA_..." o app funciona no modo local
   antigo (sem nuvem). Assim que você preencher e publicar, o app passa a
   usar o proxy seguro (chaves escondidas) e o Firestore (base na nuvem).

   Onde encontrar (Console do Firebase):
   - FIREBASE_CONFIG: Configurações do projeto ⚙️ > Seus apps > App da Web
   - APPCHECK_SITE_KEY: App Check > Apps > reCAPTCHA v3 (chave do site)
   ========================================================================= */
window.FIREBASE_CONFIG = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Chave do site reCAPTCHA v3 usada pelo App Check (protege as funções).
window.FIREBASE_APPCHECK_SITE_KEY = "SUA_RECAPTCHA_V3_SITE_KEY";

// Região das Cloud Functions (mesma do functions/index.js).
window.FIREBASE_REGION = "southamerica-east1";
