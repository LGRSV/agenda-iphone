/* vozes-worker.js — gera a voz do Jarvis no proprio aparelho, fora da tela
   (Web Worker), para a pagina nao travar enquanto a voz e calculada.

   Motores: Piper (rhasspy/piper) e Kokoro-82M (hexgrad/kokoro), rodando com
   onnxruntime-web. Fonemas em portugues do Brasil pelo piper_phonemize (eSpeak
   NG compilado para WebAssembly).

   Seguranca: cada arquivo baixado (scripts, wasm, modelos) tem versao fixa e
   SHA-256 conferido antes de ser usado; nada e executado sem bater a assinatura.
   Os arquivos ficam no Cache Storage 'jarvis-vozes-v1' (o service worker do app
   nao apaga esse cache), entao cada voz so e baixada uma vez.

   Licencas: vozes Piper pt_BR cadu e faber (dados CC0), edresson (TTS-Portuguese-
   Corpus, Edresson Casanova, CC BY 4.0); Kokoro-82M (Apache-2.0); onnxruntime-web
   (MIT); piper_phonemize/eSpeak NG (GPL-3.0). Nada disso fica no repositorio: os
   arquivos sao baixados das fontes oficiais, com versao e assinatura fixas. */
'use strict';

const CACHE = 'jarvis-vozes-v1';
const ORT = 'https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/';
const PHON = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/';
const PIPER = 'https://huggingface.co/rhasspy/piper-voices/resolve/c10ece1aade47bb51c153c893d14e5bf8e5b7117/pt/pt_BR/';
const KOKORO = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/1939ad2a8e416c0acfeecc08a694d14ef25f2231/';

// url -> sha256 (hex) e tamanho em bytes
const ARQ = {
  ortJs: [ORT + 'ort.wasm.min.js', '90533a3fd7006df7f897c0d63c468996da5c8e430e39964d92ebe586c4996614', 142930],
  ortSimd: [ORT + 'ort-wasm-simd.wasm', 'f533b5f21790563d7556c611c3835ac65848ee326da2689aac54ed7d9cc8c6a4', 10595041],
  ortBase: [ORT + 'ort-wasm.wasm', 'ebe7ec327f83aabc07e3b58487522481ccff10941f24182ab0428d0123652ff2', 9758086],
  phonJs: [PHON + 'piper_phonemize.js', 'fef0c2fc442d24fdef5c7c7cc37d5da2314407640fe11ab1bfe347c723dff19b', 120714],
  phonWasm: [PHON + 'piper_phonemize.wasm', 'b777cd107a91d2bcc6a1ea46f2c26a662a7407394fe84589198aeaa83dd7a9d6', 635212],
  phonData: [PHON + 'piper_phonemize.data', '29f1025eb23a5b5c192cd14a6efbce4509402ff265405072ee6f7d1a09b78f8c', 18077249],
  kokoroModel: [KOKORO + 'onnx/model_quantized.onnx', 'fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478', 92361116],
  kokoroTok: [KOKORO + 'tokenizer.json', '77a02c8e164413299b4b4c403b14f8e0e1c1b727db4d46a09d6327b861060a34', 3497],
};
const VOZES = {
  'piper-cadu': { motor: 'piper', modelo: [PIPER + 'cadu/medium/pt_BR-cadu-medium.onnx', '765f0809a6ea9035d4a6d0d008dbf8876e68b2dd32029312672fa8f405bdb535', 62950044], config: [PIPER + 'cadu/medium/pt_BR-cadu-medium.onnx.json', '5fe03aa3d4901880554905b12075713cd552598c8a350455a1ec73f8b4e6be19', 5040] },
  'piper-faber': { motor: 'piper', modelo: [PIPER + 'faber/medium/pt_BR-faber-medium.onnx', '858555e3a064209c57088fe6bd70c4c3dc54d03eaa00c45d5ecaf43a33f95aa7', 63201294], config: [PIPER + 'faber/medium/pt_BR-faber-medium.onnx.json', '7e694de195ae3fc36dd732c445eb04fb49b649854893cb5506b978f0d50a1d6f', 4855] },
  'piper-edresson': { motor: 'piper', modelo: [PIPER + 'edresson/low/pt_BR-edresson-low.onnx', 'de4cecee38b30bb1a6378a337af605d59f0c377df702c6a6752870db8991cd84', 63104526], config: [PIPER + 'edresson/low/pt_BR-edresson-low.onnx.json', 'f138992d2e777d1e3aa0bbb14c2d324307b0f342c1bcf20978765b3bea506c56', 4168] },
  'kokoro-pm_alex': { motor: 'kokoro', estilo: [KOKORO + 'voices/pm_alex.bin', '0175c753f59c54e7fd5a995bedef0c5ff2fb67e0043dd3dcb2ae74ec2acbeb2a', 522240] },
  'kokoro-pm_santa': { motor: 'kokoro', estilo: [KOKORO + 'voices/pm_santa.bin', '8b012db3185778afe2e45a62cbad69db73021774fe68dda634bcc748a982eede', 522240] },
};

const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
const avisar = (id, extra) => postMessage({ tipo: 'progresso', id, ...extra });

// Baixa (ou le do cache) e confere o SHA-256. Arquivo errado nunca e usado nem guardado.
async function obter([url, sha, bytes], id, rotulo) {
  const cache = await caches.open(CACHE);
  const salvo = await cache.match(url);
  if (salvo) {
    const buf = await salvo.arrayBuffer();
    if (hex(await crypto.subtle.digest('SHA-256', buf)) === sha) return buf;
    await cache.delete(url); // corrompido: baixa de novo
  }
  const res = await fetch(url, { cache: 'no-store', credentials: 'omit' });
  if (!res.ok || !res.body) throw new Error('download ' + res.status + ' ' + rotulo);
  const leitor = res.body.getReader(), partes = [];
  let recebido = 0, ultimo = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    partes.push(value); recebido += value.length;
    if (recebido > bytes * 1.05) throw new Error('arquivo maior que o esperado: ' + rotulo);
    if (recebido - ultimo > 1_000_000) { ultimo = recebido; avisar(id, { rotulo, recebido, total: bytes }); }
  }
  const buf = new Uint8Array(recebido);
  let p = 0; for (const c of partes) { buf.set(c, p); p += c.length; }
  if (hex(await crypto.subtle.digest('SHA-256', buf.buffer)) !== sha) throw new Error('assinatura nao confere: ' + rotulo);
  await cache.put(url, new Response(buf.buffer, { headers: { 'content-type': 'application/octet-stream' } }));
  avisar(id, { rotulo, recebido, total: bytes });
  return buf.buffer;
}

async function carregarScript(arq, id, rotulo) {
  const buf = await obter(arq, id, rotulo);
  const url = URL.createObjectURL(new Blob([buf], { type: 'text/javascript' }));
  try { importScripts(url); } finally { URL.revokeObjectURL(url); }
}

// Mesmo teste de SIMD do wasm-feature-detect (um modulo minimo com i8x16).
const SIMD = WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
const ortWasm = () => (SIMD ? 'ortSimd' : 'ortBase');
const RUNTIME = () => [ARQ.ortJs, ARQ[ortWasm()], ARQ.phonJs, ARQ.phonWasm, ARQ.phonData];

let runtime = null;
async function prepararRuntime(id) {
  if (runtime) return runtime;
  runtime = (async () => {
    await carregarScript(ARQ.ortJs, id, 'motor');
    // So a versao do motor que o aparelho usa (SIMD em todo iPhone recente): 10 MB a menos.
    const url = URL.createObjectURL(new Blob([await obter(ARQ[ortWasm()], id, 'motor')], { type: 'application/wasm' }));
    self.ort.env.wasm.numThreads = 1; // GitHub Pages nao permite memoria compartilhada (sem COOP/COEP)
    self.ort.env.wasm.wasmPaths = { 'ort-wasm-simd.wasm': url, 'ort-wasm.wasm': url };
    await carregarScript(ARQ.phonJs, id, 'pronuncia');
    const wasmBinary = await obter(ARQ.phonWasm, id, 'pronuncia');
    const dados = await obter(ARQ.phonData, id, 'pronuncia');
    return { wasmBinary, dados };
  })();
  try { return await runtime; } catch (e) { runtime = null; throw e; }
}

// Texto -> fonemas e ids pelo piper_phonemize (eSpeak NG pt-br). Um modulo novo
// por chamada (o main do Emscripten encerra o modulo), sem baixar nada de novo.
async function fonemizar(texto) {
  const { wasmBinary, dados } = runtime ? await runtime : await prepararRuntime('');
  return new Promise((resolve, reject) => {
    let ok = false;
    self.createPiperPhonemize({
      wasmBinary,
      getPreloadedPackage: () => dados,
      locateFile: f => f,
      print: linha => { if (ok) return; ok = true; try { resolve(JSON.parse(linha)); } catch (e) { reject(e); } },
      printErr: () => {},
    }).then(m => {
      m.callMain(['-l', 'pt-br', '--input', JSON.stringify([{ text: texto }]), '--espeak_data', '/espeak-ng-data']);
      if (!ok) reject(new Error('sem fonemas'));
    }, reject);
  });
}

// ---- Piper ----
const sessoes = new Map(); // id -> { sessao, config }
async function prepararPiper(id) {
  if (sessoes.has(id)) return sessoes.get(id);
  const v = VOZES[id];
  await prepararRuntime(id);
  const config = JSON.parse(new TextDecoder().decode(await obter(v.config, id, 'voz')));
  const modelo = await obter(v.modelo, id, 'voz');
  const sessao = await self.ort.InferenceSession.create(modelo, { executionProviders: ['wasm'] });
  for (const k of sessoes.keys()) if (k !== id) { try { await sessoes.get(k).sessao.release(); } catch (_) {} sessoes.delete(k); } // uma voz na memoria
  const s = { sessao, config };
  sessoes.set(id, s);
  return s;
}
// Mesmo mapeamento do Piper (phonemes_to_ids): BOS e PAD, cada fonema seguido de PAD, EOS.
function piperIds(fonemas, mapa) {
  const ids = [...mapa['^'], ...mapa['_']];
  for (const f of fonemas) { const m = mapa[f]; if (!m) continue; ids.push(...m, ...mapa['_']); }
  ids.push(...mapa['$']);
  return ids;
}
async function gerarPiper(id, texto, t) {
  const { sessao, config } = await prepararPiper(id);
  t.inicio = performance.now();
  const { phonemes } = await fonemizar(texto);
  t.fonemas = performance.now();
  const ids = piperIds(phonemes, config.phoneme_id_map);
  const inf = config.inference || {};
  const feeds = {
    input: new self.ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
    input_lengths: new self.ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
    scales: new self.ort.Tensor('float32', Float32Array.from([inf.noise_scale ?? 0.667, inf.length_scale ?? 1, inf.noise_w ?? 0.8]), [3]),
  };
  if (config.num_speakers > 1) feeds.sid = new self.ort.Tensor('int64', BigInt64Array.from([0n]), [1]);
  const out = await sessao.run(feeds);
  t.modelo = performance.now();
  return { pcm: out.output.data, sr: config.audio.sample_rate };
}

// ---- Kokoro ----
let kokoro = null; // { sessao, vocab }
const estilos = new Map();
async function prepararKokoro(id) {
  await prepararRuntime(id);
  if (!kokoro) {
    const tok = JSON.parse(new TextDecoder().decode(await obter(ARQ.kokoroTok, id, 'voz')));
    const modelo = await obter(ARQ.kokoroModel, id, 'voz');
    const sessao = await self.ort.InferenceSession.create(modelo, { executionProviders: ['wasm'] });
    kokoro = { sessao, vocab: tok.model.vocab };
  }
  if (!estilos.has(id)) estilos.set(id, new Float32Array(await obter(VOZES[id].estilo, id, 'voz')));
  return { ...kokoro, estilo: estilos.get(id) };
}
// Fonemas do eSpeak no formato do Kokoro (o mesmo que o misaki EspeakG2P faz):
// africadas e ditongos viram os simbolos unicos que o modelo aprendeu. O wasm nao
// marca as ligaduras (^), entao trocamos as sequencias; em 50 frases de teste o
// resultado ficou identico ao do misaki. Frases coladas ganham o espaco de volta.
const KOKORO_TROCAS = [['aɪ', 'I'], ['aʊ', 'W'], ['dz', 'ʣ'], ['dʒ', 'ʤ'], ['eɪ', 'A'], ['ss', 'S'], ['ts', 'ʦ'], ['tʃ', 'ʧ'], ['ɔɪ', 'Y']];
function kokoroFonemas(fonemas) {
  let s = fonemas.join('').replace(/([.!?;:])(?=\S)/g, '$1 ');
  for (const [a, b] of KOKORO_TROCAS) s = s.split(a).join(b);
  return s.replace(/-/g, '');
}
async function gerarKokoro(id, texto, t) {
  const { sessao, vocab, estilo } = await prepararKokoro(id);
  t.inicio = performance.now();
  const { phonemes } = await fonemizar(texto);
  t.fonemas = performance.now();
  const toks = [...kokoroFonemas(phonemes)].map(c => vocab[c]).filter(n => n !== undefined).slice(0, 510);
  const ids = [0, ...toks, 0];
  const linha = Math.min(toks.length, 509) * 256;
  const feeds = {
    input_ids: new self.ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
    style: new self.ort.Tensor('float32', estilo.slice(linha, linha + 256), [1, 256]),
    speed: new self.ort.Tensor('float32', Float32Array.from([1]), [1]),
  };
  const out = await sessao.run(feeds);
  t.modelo = performance.now();
  return { pcm: out.waveform.data, sr: 24000 };
}

// Um pedido por vez: o mesmo modelo nao roda duas geracoes ao mesmo tempo.
let fila = Promise.resolve();
self.onmessage = ({ data }) => { fila = fila.then(() => atender(data)); };
async function atender(data) {
  const { pedido, tipo, id, texto } = data;
  try {
    if (!VOZES[id]) throw new Error('voz desconhecida');
    if (tipo === 'preparar') {
      if (VOZES[id].motor === 'piper') await prepararPiper(id); else await prepararKokoro(id);
      postMessage({ pedido, ok: true });
    } else if (tipo === 'gerar') {
      const t = {};
      const r = VOZES[id].motor === 'piper' ? await gerarPiper(id, texto, t) : await gerarKokoro(id, texto, t);
      const pcm = new Float32Array(r.pcm);
      const ms = { fonemas: Math.round(t.fonemas - t.inicio), modelo: Math.round(t.modelo - t.fonemas) };
      postMessage({ pedido, ok: true, pcm, sr: r.sr, ms }, [pcm.buffer]);
    } else if (tipo === 'baixada') {
      const cache = await caches.open(CACHE), v = VOZES[id];
      const arqs = [...RUNTIME(), ...(v.motor === 'piper' ? [v.modelo, v.config] : [ARQ.kokoroModel, ARQ.kokoroTok, v.estilo])];
      const tem = (await Promise.all(arqs.map(a => cache.match(a[0])))).every(Boolean);
      postMessage({ pedido, ok: true, baixada: tem });
    } else throw new Error('pedido desconhecido');
  } catch (e) {
    postMessage({ pedido, ok: false, erro: String((e && e.message) || e) });
  }
}
