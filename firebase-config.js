/* =========================================================================
   Configuração do Firebase — projeto agenda-lagares.
   Estes valores são PÚBLICOS por natureza (podem ficar no repositório).
   ========================================================================= */

// Liga/desliga a integração com o Firebase. Enquanto estiver `false`, o app
// roda 100% no modo local (GitHub), sem login e sem nuvem. Trocamos para
// `true` quando o deploy do Firebase estiver pronto.
window.FIREBASE_ENABLED = false;

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAY3qKB85g2VZvOMDAPqLNagHANMUcnMwk",
  authDomain: "agenda-lagares.firebaseapp.com",
  projectId: "agenda-lagares",
  storageBucket: "agenda-lagares.firebasestorage.app",
  messagingSenderId: "573070914886",
  appId: "1:573070914886:web:f6c62a00c9ae8a55a1a147",
  measurementId: "G-96LBL0BNQW"
};

// (Opcional) Chave do site reCAPTCHA v3 do App Check — proteção extra.
// Deixe como está por enquanto; ativamos depois, se você quiser.
window.FIREBASE_APPCHECK_SITE_KEY = "SUA_RECAPTCHA_V3_SITE_KEY";

// Região das Cloud Functions (mesma do functions/index.js).
window.FIREBASE_REGION = "southamerica-east1";
