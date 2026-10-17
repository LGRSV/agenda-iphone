/* vozes-neurais.js — vozes masculinas em portugues do Brasil para o Jarvis,
   geradas no proprio aparelho (vozes-worker.js) e um seletor para escolher.

   As 5 vozes vem dos dois projetos abertos de voz mais estrelados no GitHub que
   tem voz pronta em pt-BR e rodam no navegador: Piper (rhasspy/piper) e Kokoro
   (hexgrad/kokoro). Ordem = clareza medida (transcricao automatica com Whisper,
   8 frases do Jarvis, com a mesma pronuncia que roda aqui no navegador).
   Nenhuma e clone de pessoa famosa: sao vozes publicadas para sintese de fala.

   Uso pelo app: JarvisVozes.escolhida() -> id ou 'aparelho';
   JarvisVozes.gerar(id, texto) -> { pcm: Float32Array, sr };
   JarvisVozes.abrir({ amostra(id), vozAparelho() }) abre o seletor. */
(() => {
  'use strict';
  const CHAVE = 'jarvis_voz_neural';
  const CACHE = 'jarvis-vozes-v1';
  const MOTOR_MB = 29; // onnxruntime-web + pronuncia (eSpeak NG): uma vez so, para todas as vozes
  const LISTA = [
    { id: 'piper-cadu', nome: 'Cadu', motor: 'Piper', mb: 63, nota: 'Grave e a mais clara nos testes' },
    { id: 'kokoro-pm_alex', nome: 'Alex', motor: 'Kokoro', mb: 92, nota: 'A mais natural, porém demora mais para começar a falar' },
    { id: 'piper-faber', nome: 'Faber', motor: 'Piper', mb: 63, nota: 'Clara, tom um pouco mais agudo' },
    { id: 'kokoro-pm_santa', nome: 'Santa', motor: 'Kokoro', mb: 92, nota: 'Natural e mais lenta; usa o mesmo download do Alex' },
    { id: 'piper-edresson', nome: 'Edresson', motor: 'Piper', mb: 63, nota: 'Mais robótica, jeito de assistente' },
  ];
  const porId = Object.fromEntries(LISTA.map(v => [v.id, v]));

  const ler = () => { try { return localStorage.getItem(CHAVE) || 'aparelho'; } catch (_) { return 'aparelho'; } };
  const gravar = id => { try { localStorage.setItem(CHAVE, id); } catch (_) {} };
  // So vale uma voz neural que ja esteja baixada; enquanto baixa, o Jarvis fala com a voz do aparelho.
  let prontas = new Set();
  function escolhida() { const id = ler(); return porId[id] && prontas.has(id) ? id : 'aparelho'; }

  // ---- Conversa com o worker ----
  let worker = null, seq = 0;
  const pendentes = new Map(), ouvintes = new Set();
  function w() {
    if (worker) return worker;
    worker = new Worker('./vozes-worker.js?v=1');
    worker.onmessage = ({ data }) => {
      if (data.tipo === 'progresso') { ouvintes.forEach(f => f(data)); return; }
      const p = pendentes.get(data.pedido);
      if (!p) return;
      pendentes.delete(data.pedido);
      data.ok ? p.res(data) : p.rej(new Error(data.erro || 'falha na voz'));
    };
    worker.onerror = e => { // worker caiu (memoria, script): todos os pedidos falham e um novo nasce no proximo uso
      pendentes.forEach(p => p.rej(new Error('worker: ' + ((e && e.message) || 'erro'))));
      pendentes.clear(); try { worker.terminate(); } catch (_) {} worker = null;
    };
    return worker;
  }
  function pedir(msg) {
    return new Promise((res, rej) => { const pedido = ++seq; pendentes.set(pedido, { res, rej }); w().postMessage({ ...msg, pedido }); });
  }
  // Piper e Kokoro juntos pesam demais para o iPhone: trocar de motor recria o worker
  // (a memoria do WebAssembly so e devolvida assim). Entre vozes Piper, o worker troca a sessao.
  let motorNoWorker = null;
  function umMotor(id) {
    const m = porId[id] && porId[id].motor;
    if (worker && motorNoWorker && m !== motorNoWorker) {
      try { worker.terminate(); } catch (_) {}
      worker = null; pendentes.forEach(p => p.rej(new Error('troca de motor'))); pendentes.clear();
    }
    motorNoWorker = m;
  }
  async function baixada(id) { try { return !!(await pedir({ tipo: 'baixada', id })).baixada; } catch (_) { return false; } }
  async function gerar(id, texto) { umMotor(id); const d = await pedir({ tipo: 'gerar', id, texto }); return { pcm: d.pcm, sr: d.sr }; }
  async function preparar(id) {
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (_) {}
    umMotor(id);
    await pedir({ tipo: 'preparar', id });
    prontas.add(id);
  }
  async function atualizarProntas() {
    if (!('caches' in window)) return;
    try {
      if (!(await caches.has(CACHE))) { prontas = new Set(); return; }
      const r = await Promise.all(LISTA.map(v => baixada(v.id)));
      prontas = new Set(LISTA.filter((v, i) => r[i]).map(v => v.id));
    } catch (_) {}
  }
  // Ao abrir o painel do Jarvis: carrega a voz escolhida na memoria (a 1a resposta sai mais rapido).
  let aquecida = null;
  async function aquecer() {
    if (ler() === 'aparelho') return;
    if (!prontas.size) await atualizarProntas();
    const id = escolhida();
    if (id === 'aparelho' || aquecida === id) return;
    aquecida = id; umMotor(id);
    pedir({ tipo: 'preparar', id }).catch(() => { aquecida = null; });
  }
  // Na abertura do app: so consulta o cache se alguma voz neural foi escolhida (nao cria worker a toa).
  if (ler() !== 'aparelho') atualizarProntas();

  // ---- Seletor ----
  const CSS = `
  #voz-dialog{width:min(420px,calc(100vw - 32px));max-width:calc(100vw - 32px);max-height:86dvh;padding:0;border:1px solid rgba(117,203,255,.25);border-radius:22px;background:rgba(22,25,32,.98);color:#e8edf4;box-shadow:0 30px 80px rgba(0,0,0,.6);overflow:hidden}
  #voz-dialog::backdrop{background:rgba(0,0,0,.55)}
  #voz-dialog .vz-wrap{display:flex;flex-direction:column;max-height:86dvh}
  #voz-dialog header{display:flex;align-items:center;gap:10px;padding:16px 16px 10px}
  #voz-dialog h3{flex:1;margin:0;font-size:16px;font-weight:800;color:#f7f8fb;letter-spacing:-.02em}
  #voz-dialog .vz-x{width:44px;height:44px;border:0;border-radius:12px;background:rgba(255,255,255,.07);color:#a6acb8;font-size:18px;cursor:pointer}
  #voz-dialog .vz-sub{margin:0 16px 10px;font-size:12px;line-height:1.45;color:#9aa3b2}
  #voz-dialog .vz-lista{overflow-y:auto;padding:0 10px 6px;display:flex;flex-direction:column;gap:8px}
  #voz-dialog .vz-item{display:flex;align-items:center;gap:10px;padding:11px 12px;border:1px solid rgba(255,255,255,.07);border-radius:15px;background:rgba(255,255,255,.04);cursor:pointer;text-align:left;color:inherit;font:inherit;width:100%;box-sizing:border-box;outline:0}
  #voz-dialog .vz-item:focus-visible{border-color:#75cbff}
  #voz-dialog .vz-item.sel{border-color:rgba(117,203,255,.6);background:rgba(117,203,255,.1)}
  #voz-dialog .vz-radio{width:18px;height:18px;border-radius:50%;border:2px solid #5d6675;flex:0 0 auto;display:grid;place-items:center}
  #voz-dialog .vz-item.sel .vz-radio{border-color:#75cbff}
  #voz-dialog .vz-item.sel .vz-radio::after{content:'';width:8px;height:8px;border-radius:50%;background:#75cbff}
  #voz-dialog .vz-txt{flex:1;min-width:0}
  #voz-dialog .vz-nome,#voz-dialog .vz-nota,#voz-dialog .vz-estado,#voz-dialog .vz-barra{display:block}
  #voz-dialog .vz-nome{font-size:14px;font-weight:800;color:#f7f8fb}
  #voz-dialog .vz-nome small{font-size:11px;font-weight:700;color:#75cbff;margin-left:6px}
  #voz-dialog .vz-nota{font-size:11.5px;color:#9aa3b2;margin-top:2px;line-height:1.35}
  #voz-dialog .vz-estado{font-size:11px;font-weight:700;color:#71d6be;margin-top:4px}
  #voz-dialog .vz-estado.err{color:#ff9c9c}
  #voz-dialog .vz-barra{height:4px;border-radius:4px;background:rgba(255,255,255,.08);margin-top:6px;overflow:hidden}
  #voz-dialog .vz-barra i{display:block;height:100%;width:0;background:linear-gradient(90deg,#0d72aa,#3baee8);transition:width .2s}
  #voz-dialog .vz-ouvir{flex:0 0 auto;border:1px solid rgba(117,203,255,.35);background:rgba(117,203,255,.08);color:#9fd8ff;font-size:12px;font-weight:700;min-height:44px;padding:0 12px;border-radius:99px;cursor:pointer}
  #voz-dialog footer{padding:10px 16px 14px;border-top:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;gap:8px}
  #voz-dialog .vz-apagar{align-self:flex-start;border:0;background:none;color:#ff9c9c;font-size:12px;font-weight:700;padding:0;cursor:pointer}
  #voz-dialog .vz-cred{font-size:10.5px;line-height:1.45;color:#6f7888}
  #voz-dialog .vz-cred a{color:#8fb6cc}`;
  const CREDITOS = 'Vozes abertas: <a href="https://github.com/rhasspy/piper" target="_blank" rel="noopener">Piper</a> (Cadu e Faber: dados CC0; Edresson: TTS-Portuguese-Corpus de Edresson Casanova, CC BY 4.0) e <a href="https://github.com/hexgrad/kokoro" target="_blank" rel="noopener">Kokoro-82M</a> (Apache-2.0). Motor onnxruntime-web (MIT) e pronúncia eSpeak NG (GPL-3.0). Depois de baixada, a voz funciona sem internet.';

  let dlg = null, opcoes = {}, baixando = null, amostrando = null;
  function tocarAmostra(id) {
    if (!opcoes.amostra) return;
    amostrando = id; render();
    Promise.resolve(opcoes.amostra(id)).catch(() => {}).then(() => { if (amostrando === id) { amostrando = null; render(); } });
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function montar() {
    if (dlg) return dlg;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    dlg = document.createElement('dialog'); dlg.id = 'voz-dialog'; dlg.setAttribute('aria-label', 'Voz do Jarvis');
    dlg.innerHTML = `<div class="vz-wrap"><header><h3>Voz do Jarvis</h3><button class="vz-x" type="button" aria-label="Fechar">&times;</button></header>
      <p class="vz-sub">Cinco vozes masculinas em português do Brasil, geradas no próprio iPhone. Cada voz é baixada uma vez só; enquanto baixa, o Jarvis continua com a voz do aparelho.</p>
      <div class="vz-lista" role="radiogroup" aria-label="Vozes"></div>
      <footer><button class="vz-apagar" type="button" hidden>Apagar vozes baixadas</button><div class="vz-cred">${CREDITOS}</div></footer></div>`;
    document.body.appendChild(dlg);
    dlg.querySelector('.vz-x').onclick = () => dlg.close();
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); }); // toque fora fecha
    dlg.querySelector('.vz-apagar').onclick = apagarTudo;
    return dlg;
  }
  function item(id, nome, sub, nota) {
    const sel = ler() === id;
    const pronta = id === 'aparelho' || prontas.has(id);
    const v = porId[id];
    let estado = '';
    if (baixando && baixando.id === id) estado = `<span class="vz-estado">${esc(baixando.texto)}</span><span class="vz-barra"><i style="width:${baixando.pct}%"></i></span>`;
    else if (baixando && baixando.erro && baixando.erroId === id) estado = `<span class="vz-estado err">${esc(baixando.erro)}</span>`;
    else if (v && amostrando === id) estado = `<span class="vz-estado">Gerando a amostra…${v.motor === 'Kokoro' ? ' (o Kokoro leva alguns segundos)' : ''}</span>`;
    else if (v && pronta) estado = '<span class="vz-estado">Baixada ✓</span>';
    else if (v) estado = `<span class="vz-estado" style="color:#9fd8ff">Toque para baixar · ${v.mb} MB${prontas.size ? '' : ` (+${MOTOR_MB} MB na 1ª voz)`}</span>`;
    const ouvir = pronta ? `<button class="vz-ouvir" type="button" data-ouvir="${id}">${id === 'aparelho' ? 'Trocar' : 'Ouvir'}</button>` : '';
    return `<div class="vz-item${sel ? ' sel' : ''}" role="radio" aria-checked="${sel}" tabindex="0" data-id="${id}"><span class="vz-radio"></span><span class="vz-txt"><span class="vz-nome">${esc(nome)}<small>${esc(sub)}</small></span><span class="vz-nota">${esc(nota)}</span>${estado}</span>${ouvir}</div>`;
  }
  function render() {
    if (!dlg) return;
    const lista = dlg.querySelector('.vz-lista');
    lista.innerHTML = LISTA.map(v => item(v.id, v.nome, v.motor, v.nota)).join('') + item('aparelho', 'Voz do iPhone', 'sem download', 'Instantânea; o botão Trocar alterna entre as vozes em português instaladas no aparelho');
    lista.querySelectorAll('.vz-item').forEach(b => {
      b.onclick = e => { if (e.target.closest('[data-ouvir]')) return; escolher(b.dataset.id); };
      b.onkeydown = e => { if (e.target === b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); escolher(b.dataset.id); } };
    });
    lista.querySelectorAll('[data-ouvir]').forEach(b => {
      b.onclick = e => { e.stopPropagation(); const id = b.dataset.ouvir; if (id === 'aparelho') { gravar('aparelho'); render(); opcoes.vozAparelho && opcoes.vozAparelho(); } else tocarAmostra(id); };
    });
    const ap = dlg.querySelector('.vz-apagar');
    ap.hidden = !prontas.size || !!baixando;
  }
  async function escolher(id) {
    if (baixando && baixando.id) return; // um download por vez
    gravar(id); render();
    if (id === 'aparelho' || prontas.has(id)) { if (id !== 'aparelho') tocarAmostra(id); return; }
    const v = porId[id];
    baixando = { id, texto: 'Preparando…', pct: 0 };
    const total = (prontas.size ? 0 : MOTOR_MB) + (v.motor === 'Kokoro' && [...prontas].some(p => porId[p].motor === 'Kokoro') ? 1 : v.mb);
    let feito = 0, atual = '', recebidoAtual = 0;
    const ouvinte = d => {
      if (d.id !== id) return;
      const chave = d.rotulo + ':' + d.total;
      if (chave !== atual) { feito += recebidoAtual; atual = chave; } // arquivo novo: soma o anterior
      recebidoAtual = d.recebido;
      const mb = (feito + d.recebido) / 1e6;
      baixando.pct = Math.min(100, Math.round(mb / total * 100));
      baixando.texto = `Baixando ${d.rotulo}… ${Math.round(mb)} de ~${total} MB`;
      render();
    };
    ouvintes.add(ouvinte);
    try {
      await preparar(id);
      baixando = null; ouvintes.delete(ouvinte); render();
      if (ler() === id) tocarAmostra(id);
    } catch (e) {
      ouvintes.delete(ouvinte);
      const msg = String((e && e.message) || e);
      baixando = { erroId: id, erro: /quota|espa/i.test(msg) ? 'Sem espaço no aparelho para esta voz.' : /download|fetch|network|Failed/i.test(msg) ? 'Falha no download. Verifique a internet e toque de novo.' : 'Não deu para preparar esta voz: ' + msg.slice(0, 80) };
      if (ler() === id) gravar('aparelho');
      render();
      baixando = null;
    }
  }
  async function apagarTudo() {
    if (!confirm('Apagar as vozes baixadas? O Jarvis volta a falar com a voz do iPhone.')) return;
    try { if (worker) { worker.terminate(); worker = null; } await caches.delete(CACHE); } catch (_) {}
    prontas = new Set(); gravar('aparelho'); render();
  }
  async function abrir(o) {
    opcoes = o || {};
    montar(); render();
    if (!dlg.open) dlg.showModal();
    await atualizarProntas(); render();
  }

  window.JarvisVozes = { LISTA, escolhida, gerar, abrir, aquecer, nome: id => (porId[id] ? porId[id].nome : 'Voz do iPhone') };
})();
