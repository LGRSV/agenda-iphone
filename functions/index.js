/* =========================================================================
   Cloud Functions — proxy seguro para a Agenda Lagares
   Esconde as chaves de API (Gemini e ElevenLabs): o app chama estas
   funções, e SÓ elas conhecem as chaves (guardadas no Secret Manager).
   - Exige App Check (só o seu app pode chamar)
   - Exige login (usuário autenticado)
   Node 20 tem fetch/Buffer globais.
   ========================================================================= */
'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { setGlobalOptions } = require('firebase-functions/v2');

const GEMINI_KEY = defineSecret('GEMINI_KEY');
const ELEVEN_KEY = defineSecret('ELEVEN_KEY');

// Região de São Paulo para menor latência no Brasil
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 10 });

const GEMINI_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
const ELEVEN_VOICE = 'onwK4e9ZLuTAKqWW03F9'; // Daniel (timbre Jarvis)
const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';

function requireAuth(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Faça login para usar o Jarvis.');
}

/* ----------------- Conversa / ações do Jarvis (Gemini) ----------------- */
exports.aiGemini = onCall(
  { secrets: [GEMINI_KEY], enforceAppCheck: true },
  async (req) => {
    requireAuth(req);
    const body = req.data && req.data.body;
    if (!body || typeof body !== 'object') throw new HttpsError('invalid-argument', 'Corpo da requisição ausente.');

    let lastErr = '';
    for (const model of GEMINI_MODELS) {
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY.value()}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        );
        const data = await r.json();
        const txt = data && data.candidates && data.candidates[0] && data.candidates[0].content &&
          data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
          data.candidates[0].content.parts[0].text;
        if (txt) return { text: txt, model };
        lastErr = (data && data.error && data.error.message) || 'resposta vazia';
      } catch (e) {
        lastErr = String(e && e.message ? e.message : e);
      }
    }
    throw new HttpsError('internal', lastErr || 'Falha ao falar com o Gemini.');
  }
);

/* ---------------------- Voz do Jarvis (Gemini TTS) --------------------- */
exports.ttsGemini = onCall(
  { secrets: [GEMINI_KEY], enforceAppCheck: true },
  async (req) => {
    requireAuth(req);
    const text = String((req.data && req.data.text) || '').trim();
    if (!text) throw new HttpsError('invalid-argument', 'Texto vazio.');

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent?key=${GEMINI_KEY.value()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Fale em portugues brasileiro com tom calmo, grave e sofisticado de assistente de IA britanico: ' + text }] }],
          generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } } }
        })
      }
    );
    const d = await r.json();
    const p = d && d.candidates && d.candidates[0] && d.candidates[0].content &&
      d.candidates[0].content.parts && d.candidates[0].content.parts[0];
    const b64 = p && p.inlineData && p.inlineData.data;
    if (!b64) throw new HttpsError('internal', (d && d.error && d.error.message) || 'sem áudio');
    return { audioBase64: b64, mimeType: (p.inlineData.mimeType || 'audio/L16;rate=24000') };
  }
);

/* --------------------- Voz do Jarvis (ElevenLabs) --------------------- */
exports.ttsEleven = onCall(
  { secrets: [ELEVEN_KEY], enforceAppCheck: true },
  async (req) => {
    requireAuth(req);
    const text = String((req.data && req.data.text) || '').trim();
    if (!text) throw new HttpsError('invalid-argument', 'Texto vazio.');

    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': ELEVEN_KEY.value(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model_id: 'eleven_flash_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.8 } })
      }
    );
    if (!r.ok) throw new HttpsError('internal', 'ElevenLabs ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 800) throw new HttpsError('internal', 'áudio vazio');
    return { audioBase64: buf.toString('base64') };
  }
);
