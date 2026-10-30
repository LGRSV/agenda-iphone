// PC remoto do João (o "AnyDesk" do app). Modo principal: vídeo ao vivo por WebRTC, ~30 quadros/s,
// direto entre o celular e o PC (pc_remoto_rtc.py), com mouse e teclado pelo canal de dados "controle".
// Sinalização em pc_remoto_sinal (só o dono, RLS). Se o vídeo não conectar, cai para o modo foto:
// pc_remoto.py manda uma imagem por segundo para o bucket privado pc-remoto e os comandos vão por pc_remoto_comandos.
const MODULE_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const cfg = (window.AgendaSupabaseConfig || window.SUPABASE_AGENDA_CONFIG || {});
const el = id => document.getElementById(id);
const esperar = ms => new Promise(r => setTimeout(r, ms));
const lim = v => Math.min(1, Math.max(0, v));

let sb, uid, url, key, modo = 'clique', ultimoXY = { x: 0.5, y: 0.5 };
let pc = null, dc = null, video = false, fps = 0;          // modo vídeo
let foto = false, urlAtual = '', quadroOk = 0;             // modo foto (reserva)

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
  conectar();
}

async function conectar() {
  el('vazio').textContent = 'Conectando ao vídeo do PC…'; el('vazio').hidden = false;
  try { await conectarVideo(); }
  catch (e) { console.warn('vídeo:', e); fechar(); modoFoto(); }
  status();
}

// ---------------------------------------------------------------- vídeo ao vivo (WebRTC)
async function conectarVideo() {
  fechar();
  pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
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
    if (pc && ['failed', 'disconnected'].includes(pc.connectionState) && !document.hidden) {
      setTimeout(() => { if (pc && pc.connectionState !== 'connected') conectar(); }, 3000);
    }
  };
  await pc.setLocalDescription(await pc.createOffer());
  await new Promise(ok => {   // junta os candidatos de rede (no máx. 2,5 s)
    if (pc.iceGatheringState === 'complete') return ok();
    const t = setTimeout(ok, 2500);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); ok(); } });
  });
  const { data: s, error } = await sb.from('pc_remoto_sinal').insert({ oferta: pc.localDescription.sdp }).select('id').single();
  if (error) throw error;
  let resposta = '';
  for (let i = 0; i < 40 && !resposta; i++) {   // o PC responde em ~1 s
    await esperar(400);
    const { data } = await sb.from('pc_remoto_sinal').select('resposta').eq('id', s.id).maybeSingle();
    resposta = data?.resposta || '';
  }
  if (!resposta) throw new Error('o PC não respondeu');
  await pc.setRemoteDescription({ type: 'answer', sdp: resposta });
  for (let i = 0; i < 40 && pc.connectionState !== 'connected'; i++) await esperar(250);
  if (pc.connectionState !== 'connected') throw new Error('sem conexão direta');
  video = true; foto = false;
  el('img').hidden = true; el('video').hidden = false; el('vazio').hidden = true;
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
  el('video').hidden = true;
  manterAtivo(); setInterval(manterAtivo, 20000);
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
    ? `<span class="dot on"></span>PC online · ${foto ? (Date.now() - quadroOk < 5000 ? 'modo foto (toque aqui p/ vídeo)' : 'aguardando tela…') : 'conectando vídeo…'}`
    : `<span class="dot"></span>PC offline${isFinite(seg) ? ` há ${Math.round(seg / 60)} min` : ''}`;
}
el('status').addEventListener('click', () => { if (!video) { foto = false; conectar(); } });

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

// Toque (celular): toque = clique · segurar = direito · arrastar = arrastar com o botão esquerdo
// Mouse (computador): movimento, botões e rodinha vão direto, igual a estar no PC.
let toque = null, pendente = null;
function ligar(alvo) {
  alvo.addEventListener('contextmenu', e => e.preventDefault());
  alvo.addEventListener('pointerdown', e => {
    const p = posicao(e, alvo); ultimoXY = p;
    if (e.pointerType === 'mouse') {
      enviar({ t: 'down', b: ['left', 'middle', 'right'][e.button] || 'left', ...p });
      alvo.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    toque = { x: e.clientX, y: e.clientY, p, arrasto: false, feito: false };
    toque.timer = setTimeout(() => { if (toque && !toque.arrasto) { toque.feito = true; marcar(e.clientX, e.clientY); enviar({ t: 'click', b: 'right', ...p }); } }, 600);
  });
  alvo.addEventListener('pointermove', e => {
    const p = posicao(e, alvo);
    if (e.pointerType === 'mouse') {   // um movimento por quadro de tela, no máximo
      if (!pendente) requestAnimationFrame(() => { enviar({ t: 'move', ...pendente }); pendente = null; });
      pendente = p; return;
    }
    if (!toque || toque.feito || el('tela').classList.contains('grande') || !video) return;
    if (!toque.arrasto && Math.hypot(e.clientX - toque.x, e.clientY - toque.y) > 12) {
      toque.arrasto = true; clearTimeout(toque.timer);
      enviar({ t: 'down', b: 'left', ...toque.p });
    }
    if (toque.arrasto) enviar({ t: 'move', ...p });
  });
  alvo.addEventListener('pointerup', e => {
    const p = posicao(e, alvo);
    if (e.pointerType === 'mouse') { enviar({ t: 'up', b: ['left', 'middle', 'right'][e.button] || 'left', ...p }); return; }
    if (!toque) return;
    clearTimeout(toque.timer);
    if (toque.arrasto) enviar({ t: 'up', b: 'left', ...p });
    else if (!toque.feito && Math.hypot(e.clientX - toque.x, e.clientY - toque.y) <= 12) { marcar(e.clientX, e.clientY); ultimoXY = p; cliqueDoModo(p); }
    toque = null;
  });
  alvo.addEventListener('pointercancel', () => { if (toque?.arrasto) enviar({ t: 'up', b: 'left', ...ultimoXY }); clearTimeout(toque?.timer); toque = null; });
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
  if (b.id === 'zoom') { el('tela').classList.toggle('grande'); return; }
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
  if (e.target === el('txt') || !video) return;
  const mods = [e.ctrlKey && 'ctrl', e.altKey && 'alt', e.metaKey && 'win'].filter(Boolean);
  if (!mods.length && e.key.length === 1) { enviar({ t: 'text', s: e.key }); e.preventDefault(); return; }
  const k = ESPECIAIS[e.key] || (e.key.length === 1 ? e.key.toLowerCase() : '');
  if (!k) return;
  enviar({ t: 'key', k: [...mods, ...(e.shiftKey && mods.length ? ['shift'] : []), k].join('+') });
  e.preventDefault();
});

document.addEventListener('visibilitychange', async () => {
  if (document.hidden) {   // saiu da página: libera o PC
    if (video) fechar();
    if (foto) await sb.from('pc_remoto_estado').update({ ativo_ate: new Date().toISOString() }).eq('owner_id', uid);
  } else if (!video && !foto) conectar();
  else if (foto) manterAtivo();
});

iniciar().catch(err => { el('vazio').textContent = 'Erro: ' + err.message; });
