// PC remoto do João (o "AnyDesk" do app). Modo principal: vídeo ao vivo por WebRTC, ~30 quadros/s,
// direto entre o celular e o PC (pc_remoto_rtc.py), com mouse e teclado pelo canal de dados "controle".
// Sinalização em pc_remoto_sinal (só o dono, RLS). A página abre NA HORA em modo foto (pc_remoto.py manda uma imagem
// por segundo para o bucket privado pc-remoto; comandos por pc_remoto_comandos) e tenta o vídeo em paralelo: se ficar
// "connected" em até 8 s troca para o vídeo; senão fica na foto e tenta de novo a cada 90 s (ou ao tocar no status).
const MODULE_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const cfg = (window.AgendaSupabaseConfig || window.SUPABASE_AGENDA_CONFIG || {});
const el = id => document.getElementById(id);
const esperar = ms => new Promise(r => setTimeout(r, ms));
const lim = v => Math.min(1, Math.max(0, v));

let sb, uid, url, key, modo = 'clique', ultimoXY = { x: 0.5, y: 0.5 };
let pc = null, dc = null, video = false, fps = 0;          // modo vídeo
let foto = false, urlAtual = '', quadroOk = 0, timerAtivo = null; // modo foto (abre na hora)
let tentando = false, retry = null;
const LIMITE_VIDEO_MS = 25000, NOVA_TENTATIVA_MS = 4000;   // vídeo é o modo principal: espera até 25 s e reconecta em 4 s; a foto só cobre o intervalo
// STUN público; em 4G/CGNAT o vídeo direto só fecha com TURN. As credenciais (1 h) vêm da Edge Function pc-turn,
// que guarda a chave da Cloudflare; sem a chave configurada ela devolve só STUN e tudo segue como antes.
const ICE_STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
let iceProm = null, iceTurn = false;
function carregarIce() {
  if (iceProm) return iceProm;
  iceProm = (async () => {
    try {
      const r = await Promise.race([sb.functions.invoke('pc-turn', { body: {} }), esperar(2500).then(() => ({ error: new Error('lento') }))]);
      const lista = r?.data?.iceServers;
      if (Array.isArray(lista) && lista.length) {
        iceTurn = !!r.data.turn;
        setTimeout(() => { iceProm = null; }, 30 * 60 * 1000);   // credenciais valem 1 h: renova a cada 30 min
        return lista;
      }
    } catch (_) { }
    setTimeout(() => { iceProm = null; }, 60 * 1000);
    return ICE_STUN;
  })();
  return iceProm;
}

async function iniciar() {
  const conf = cfg.url ? cfg : (window.getSupabaseAgendaConfig ? window.getSupabaseAgendaConfig() : {});
  url = conf.url || 'https://uabpevnjfcwidbjscowq.supabase.co';
  key = conf.publishableKey || 'sb_publishable_SHH7EV0MT5grOTdCFM-V-w_FqPrtzPh';
  const { createClient } = await import(MODULE_URL);
  sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  const { data } = await sb.auth.getSession();
  uid = data?.session?.user?.id;
  if (!uid) { location.replace('./?locked=1'); return; }
  setInterval(status, 4000);
  el('vazio').textContent = 'Abrindo a tela do PC…';
  modoFoto();       // imagem já na primeira volta
  carregarIce();    // credenciais TURN já a caminho
  tentarVideo();    // e o vídeo em paralelo
}

async function tentarVideo() {
  if (video || tentando || document.hidden) return;
  tentando = true; clearTimeout(retry); status();
  try { await conectarVideo(LIMITE_VIDEO_MS); }
  catch (e) { console.warn('vídeo:', e.message); fechar(); novaTentativa(); }
  finally { tentando = false; status(); }
}

function novaTentativa() {
  clearTimeout(retry);
  retry = setTimeout(() => { if (!video && !document.hidden) tentarVideo(); }, NOVA_TENTATIVA_MS);
}

// ---------------------------------------------------------------- vídeo ao vivo (WebRTC)
async function conectarVideo(limite) {
  const ice = await carregarIce();
  if (iceTurn) limite = Math.max(limite, 12000);   // via relay o ICE precisa de um pouco mais
  const fim = Date.now() + limite, restante = () => fim - Date.now();
  fechar();
  pc = new RTCPeerConnection({ iceServers: ice });
  const tr = pc.addTransceiver('video', { direction: 'recvonly' });
  try {   // H.264 primeiro: o PC codifica bem mais rápido
    const cs = RTCRtpReceiver.getCapabilities('video').codecs;
    const h = cs.filter(c => /h264/i.test(c.mimeType));
    if (h.length) tr.setCodecPreferences([...h, ...cs.filter(c => !/h264/i.test(c.mimeType))]);
  } catch (_) { }
  dc = pc.createDataChannel('controle', { ordered: true });
  pc.ontrack = e => {
    const v = el('video');
    v.srcObject = e.streams[0] || new MediaStream([e.track]);
    v.play().catch(() => { });
  };
  pc.onconnectionstatechange = () => {
    status();
    if (video && pc && ['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {   // o vídeo caiu: volta para a foto
      fechar(); modoFoto(); novaTentativa();
    }
  };
  await pc.setLocalDescription(await pc.createOffer());
  await new Promise(ok => {   // junta os candidatos de rede (no máx. 1,2 s)
    if (pc.iceGatheringState === 'complete') return ok();
    const t = setTimeout(ok, iceTurn ? 2000 : 1200);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); ok(); } });
  });
  const { data: s, error } = await sb.from('pc_remoto_sinal').insert({ oferta: pc.localDescription.sdp }).select('id').single();
  if (error) throw error;
  let resposta = '';
  while (!resposta && restante() > 0) {   // o PC responde em ~1,5 s
    await esperar(300);
    const { data } = await sb.from('pc_remoto_sinal').select('resposta').eq('id', s.id).maybeSingle();
    resposta = data?.resposta || '';
  }
  if (!resposta) throw new Error('o PC não respondeu a tempo');
  const meu = pc;
  await pc.setRemoteDescription({ type: 'answer', sdp: resposta });
  while (pc === meu && pc.connectionState !== 'connected' && restante() > 0) await esperar(200);
  if (pc !== meu || pc.connectionState !== 'connected') throw new Error('sem conexão direta em ' + Math.round(limite / 1000) + ' s');
  video = true; foto = false; clearInterval(timerAtivo); timerAtivo = null;
  el('img').hidden = true; el('video').hidden = false; el('vazio').hidden = true;
  sb.from('pc_remoto_estado').update({ ativo_ate: new Date().toISOString() }).eq('owner_id', uid).then(() => { });   // o PC para de mandar fotos
  medirFps();
}

function fechar() {
  try { dc?.close(); pc?.close(); } catch (_) { }
  pc = null; dc = null; video = false;
}

function medirFps() {
  const v = el('video');
  if (!v.requestVideoFrameCallback) return;
  let n = 0, t0 = performance.now();
  const conta = () => {
    n++;
    const dt = performance.now() - t0;
    if (dt > 2000) { fps = Math.round(n * 1000 / dt); n = 0; t0 = performance.now(); status(); }
    if (video) v.requestVideoFrameCallback(conta);
  };
  v.requestVideoFrameCallback(conta);
}

// ---------------------------------------------------------------- modo foto (reserva)
function modoFoto() {
  if (foto) return;
  foto = true;
  manterAtivo(); clearInterval(timerAtivo); timerAtivo = setInterval(manterAtivo, 20000);
  quadros();
}

async function manterAtivo() {   // avisa o pc_remoto.py que tem alguém olhando (vale 60 s)
  if (document.hidden || !foto) return;
  await sb.from('pc_remoto_estado').upsert({ owner_id: uid, ativo_ate: new Date(Date.now() + 60000).toISOString() }, { onConflict: 'owner_id' });
}

async function quadros() {
  while (foto) {
    if (document.hidden) { await esperar(1000); continue; }
    try {
      const { data: s } = await sb.auth.getSession();
      const r = await fetch(`${url}/storage/v1/object/authenticated/pc-remoto/${uid}/tela.jpg?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${s?.session?.access_token}`, apikey: key }, cache: 'no-store' });
      if (r.ok) {
        const novo = URL.createObjectURL(await r.blob()), img = el('img');
        img.onload = () => { if (urlAtual) URL.revokeObjectURL(urlAtual); urlAtual = novo; };
        img.src = novo; img.hidden = false; el('vazio').hidden = true; quadroOk = Date.now();
      }
    } catch (_) { }
    await esperar(450);
  }
}

async function status() {
  if (video && pc?.connectionState === 'connected') {
    el('status').innerHTML = `<span class="dot on"></span>Vídeo ao vivo${fps ? ` · ${fps} q/s` : ''}`;
    return;
  }
  const { data } = await sb.from('pc_remoto_estado').select('pc_visto').maybeSingle();
  const seg = data?.pc_visto ? (Date.now() - new Date(data.pc_visto)) / 1000 : Infinity;
  el('status').innerHTML = seg < 15
    ? `<span class="dot on"></span>PC online · ${foto ? (Date.now() - quadroOk < 6000 ? (tentando ? 'foto · conectando vídeo…' : 'modo foto · toque aqui p/ vídeo') : 'aguardando tela…') : 'conectando…'}`
    : `<span class="dot"></span>PC offline${isFinite(seg) ? ` há ${Math.round(seg / 60)} min` : ''}`;
}
el('status').addEventListener('click', () => { if (!video && !tentando) { clearTimeout(retry); tentarVideo(); } });

// ---------------------------------------------------------------- controle
function enviar(m) {
  if (dc && dc.readyState === 'open') { dc.send(JSON.stringify(m)); return; }
  // modo foto: só os comandos que a fila do pc_remoto.py entende
  const xy = 'x' in m ? { x: m.x, y: m.y } : {};
  if (m.t === 'click') sb.from('pc_remoto_comandos').insert({ tipo: m.b === 'right' ? 'direito' : m.n === 2 ? 'duplo' : 'clique', ...xy }).then(() => { });
  else if (m.t === 'wheel') sb.from('pc_remoto_comandos').insert({ tipo: 'scroll', ...xy, valor: String(m.d) }).then(() => { });
  else if (m.t === 'key') sb.from('pc_remoto_comandos').insert({ tipo: 'tecla', valor: m.k }).then(() => { });
  else if (m.t === 'text') sb.from('pc_remoto_comandos').insert({ tipo: 'texto', valor: m.s }).then(() => { });
}

function posicao(e, alvo) {   // ponto tocado → coordenada 0–1 da tela do PC (desconta as faixas pretas do vídeo)
  const r = alvo.getBoundingClientRect();
  const vw = alvo.videoWidth || alvo.naturalWidth || 16, vh = alvo.videoHeight || alvo.naturalHeight || 9;
  const s = Math.min(r.width / vw, r.height / vh), w = vw * s, h = vh * s;
  return { x: lim((e.clientX - r.left - (r.width - w) / 2) / w), y: lim((e.clientY - r.top - (r.height - h) / 2) / h) };
}

function marcar(cx, cy) {
  const m = el('marca'); m.style.left = cx + 'px'; m.style.top = cy + 'px';
  m.style.transition = 'none'; m.style.opacity = 1;
  requestAnimationFrame(() => { m.style.transition = 'opacity .6s'; m.style.opacity = 0; });
}

function cliqueDoModo(p) {
  enviar({ t: 'click', b: modo === 'direito' ? 'right' : 'left', n: modo === 'duplo' ? 2 : 1, ...p });
  if (modo !== 'clique') escolherModo('clique');   // 2× e direito valem para um toque só
}

// ---- zoom: dois dedos ampliam e movem (transform nas mídias); o botão Zoom alterna 1× → 2× → 3×
let zoom = 1, tx = 0, ty = 0;
const midias = () => [el('img'), el('video')];
function aplicarZoom() {
  const r = el('tela').getBoundingClientRect();
  zoom = Math.min(6, Math.max(1, zoom));
  tx = Math.min(0, Math.max(r.width * (1 - zoom), tx)); ty = Math.min(0, Math.max(r.height * (1 - zoom), ty));
  if (zoom === 1) { tx = 0; ty = 0; }
  midias().forEach(m => { m.style.transform = zoom === 1 ? '' : `translate(${tx}px,${ty}px) scale(${zoom})`; });
}
function zoomEm(z, cx, cy) {   // mantém o ponto (cx,cy), em coordenadas da área da tela, parado
  const c = { x: (cx - tx) / zoom, y: (cy - ty) / zoom };
  zoom = z; tx = cx - zoom * c.x; ty = cy - zoom * c.y; aplicarZoom();
}
window.addEventListener('resize', aplicarZoom);
const dedos = new Map();
let pinca = null;
function dedosPonto() {
  const r = el('tela').getBoundingClientRect(), [a, b] = [...dedos.values()];
  return { mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
}

// Toque (celular): toque = clique · segurar = direito · arrastar = arrastar com o botão esquerdo · dois dedos = zoom

// Mouse (computador): movimento, botões e rodinha vão direto, igual a estar no PC.
let toque = null, pendente = null;
function ligar(alvo) {
  alvo.addEventListener('contextmenu', e => e.preventDefault());
  alvo.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') {
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (dedos.size === 2) {   // começou o zoom: cancela o toque/arrasto de um dedo
        if (toque?.arrasto) enviar({ t: 'up', b: 'left', ...ultimoXY });
        clearTimeout(toque?.timer); toque = null;
        pinca = { ...dedosPonto(), z: zoom, tx, ty }; return;
      }
      if (dedos.size > 2) return;
    }
    const p = posicao(e, alvo); ultimoXY = p;
    if (e.pointerType === 'mouse' && video) {
      enviar({ t: 'down', b: ['left', 'middle', 'right'][e.button] || 'left', ...p });
      alvo.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    toque = { x: e.clientX, y: e.clientY, p, arrasto: false, feito: false };
    toque.timer = setTimeout(() => { if (toque && !toque.arrasto) { toque.feito = true; marcar(e.clientX, e.clientY); enviar({ t: 'click', b: 'right', ...p }); } }, 600);
  });
  alvo.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' && dedos.has(e.pointerId)) {
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinca && dedos.size === 2) {
        const n = dedosPonto(), z = Math.min(6, Math.max(1, pinca.z * n.d / pinca.d));
        const c = { x: (pinca.mx - pinca.tx) / pinca.z, y: (pinca.my - pinca.ty) / pinca.z };
        zoom = z; tx = n.mx - z * c.x; ty = n.my - z * c.y; aplicarZoom(); return;
      }
    }
    const p = posicao(e, alvo);
    if (e.pointerType === 'mouse' && video) {   // um movimento por quadro de tela, no máximo
      if (!pendente) requestAnimationFrame(() => { enviar({ t: 'move', ...pendente }); pendente = null; });
      pendente = p; return;
    }
    if (!toque || toque.feito || !video) return;
    if (!toque.arrasto && Math.hypot(e.clientX - toque.x, e.clientY - toque.y) > 12) {
      toque.arrasto = true; clearTimeout(toque.timer);
      enviar({ t: 'down', b: 'left', ...toque.p });
    }
    if (toque.arrasto) enviar({ t: 'move', ...p });
  });
  alvo.addEventListener('pointerup', e => {
    if (e.pointerType === 'touch') {
      const eraPinca = !!pinca;
      dedos.delete(e.pointerId);
      if (eraPinca) { if (dedos.size < 2) pinca = null; if (dedos.size === 0) toque = null; return; }
    }
    const p = posicao(e, alvo);
    if (e.pointerType === 'mouse' && video) { enviar({ t: 'up', b: ['left', 'middle', 'right'][e.button] || 'left', ...p }); return; }
    if (!toque) return;
    clearTimeout(toque.timer);
    if (toque.arrasto) enviar({ t: 'up', b: 'left', ...p });
    else if (!toque.feito && Math.hypot(e.clientX - toque.x, e.clientY - toque.y) <= 12) { marcar(e.clientX, e.clientY); ultimoXY = p; cliqueDoModo(p); }
    toque = null;
  });
  alvo.addEventListener('pointercancel', e => {
    dedos.delete(e.pointerId); if (dedos.size < 2) pinca = null; if (toque?.arrasto) enviar({ t: 'up', b: 'left', ...ultimoXY }); clearTimeout(toque?.timer); toque = null; });
  alvo.addEventListener('wheel', e => {
    e.preventDefault();
    enviar({ t: 'wheel', d: -Math.sign(e.deltaY) * Math.max(1, Math.round(Math.abs(e.deltaY) / 100)), ...posicao(e, alvo) });
  }, { passive: false });
}
ligar(el('video')); ligar(el('img'));

function escolherModo(m) {
  modo = m;
  el('modos').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.modo === m));
}
el('modos').addEventListener('click', e => { const b = e.target.closest('[data-modo]'); if (b) escolherModo(b.dataset.modo); });

document.querySelector('.barra').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'zoom') { const r = el('tela').getBoundingClientRect(); zoomEm(zoom >= 3 ? 1 : zoom < 2 ? 2 : 3, r.width / 2, r.height / 2); return; }
  if (b.dataset.tecla) enviar({ t: 'key', k: b.dataset.tecla });
  if (b.dataset.scroll) enviar({ t: 'wheel', d: Number(b.dataset.scroll), ...ultimoXY });
});

el('form').addEventListener('submit', e => {
  e.preventDefault();
  const t = el('txt').value;
  if (!t) return;
  enviar({ t: 'text', s: t.slice(0, 2000) });
  el('txt').value = '';
});

// Teclado físico (computador): fora do campo de texto, as teclas vão direto para o PC
const ESPECIAIS = { Enter: 'enter', Backspace: 'backspace', Tab: 'tab', Escape: 'esc', Delete: 'delete', Home: 'home', End: 'end',
  PageUp: 'pageup', PageDown: 'pagedown', ArrowLeft: 'left', ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', F5: 'f5', F11: 'f11', ' ': 'space' };
document.addEventListener('keydown', e => {
  if (e.target === el('txt') || !(video || foto)) return;
  const mods = [e.ctrlKey && 'ctrl', e.altKey && 'alt', e.metaKey && 'win'].filter(Boolean);
  if (!mods.length && e.key.length === 1) { enviar({ t: 'text', s: e.key }); e.preventDefault(); return; }
  const k = ESPECIAIS[e.key] || (e.key.length === 1 ? e.key.toLowerCase() : '');
  if (!k) return;
  enviar({ t: 'key', k: [...mods, ...(e.shiftKey && mods.length ? ['shift'] : []), k].join('+') });
  e.preventDefault();
});

document.addEventListener('visibilitychange', async () => {
  if (document.hidden) {   // saiu da página: libera o PC
    clearTimeout(retry);
    if (video) { fechar(); foto = false; }
    await sb.from('pc_remoto_estado').update({ ativo_ate: new Date().toISOString() }).eq('owner_id', uid);
  } else {
    if (!video && !foto) modoFoto(); else if (foto) manterAtivo();
    if (!video) tentarVideo();
  }
});

iniciar().catch(err => { el('vazio').textContent = 'Erro: ' + err.message; });
