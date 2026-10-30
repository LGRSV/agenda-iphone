// PC remoto do João: mostra a tela que o PC de casa manda (pc_remoto.py → bucket privado pc-remoto)
// e enfileira toques e teclado em pc_remoto_comandos, que o PC executa. Só o dono enxerga (RLS).
// O PC só transmite enquanto esta página renova pc_remoto_estado.ativo_ate.
const MODULE_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const cfg = (window.AgendaSupabaseConfig || window.SUPABASE_AGENDA_CONFIG || {});
const el = id => document.getElementById(id);

let sb, uid, url, key, modo = 'clique', ultimoXY = { x: 0.5, y: 0.5 }, urlAtual = '', quadroOk = 0;

async function iniciar() {
  const conf = cfg.url ? cfg : (window.getSupabaseAgendaConfig ? window.getSupabaseAgendaConfig() : {});
  url = conf.url || 'https://uabpevnjfcwidbjscowq.supabase.co';
  key = conf.publishableKey || 'sb_publishable_SHH7EV0MT5grOTdCFM-V-w_FqPrtzPh';
  const { createClient } = await import(MODULE_URL);
  sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  const { data } = await sb.auth.getSession();
  uid = data?.session?.user?.id;
  if (!uid) { location.replace('./?locked=1'); return; }
  await manterAtivo();
  setInterval(manterAtivo, 20000);
  setInterval(status, 4000);
  status();
  quadros();
}

async function manterAtivo() {   // avisa o PC que tem alguém olhando (vale 60 s)
  if (document.hidden) return;
  const ate = new Date(Date.now() + 60000).toISOString();
  const { error } = await sb.from('pc_remoto_estado').upsert({ owner_id: uid, ativo_ate: ate }, { onConflict: 'owner_id' });
  if (error) el('status').textContent = 'Erro: ' + error.message;
}

async function status() {
  const { data } = await sb.from('pc_remoto_estado').select('pc_visto, frame_ts').maybeSingle();
  const seg = data?.pc_visto ? (Date.now() - new Date(data.pc_visto)) / 1000 : Infinity;
  el('status').innerHTML = seg < 15
    ? `<span class="dot on"></span>PC online${Date.now() - quadroOk < 5000 ? ' · ao vivo' : ' · aguardando tela…'}`
    : `<span class="dot"></span>PC offline${isFinite(seg) ? ` há ${Math.round(seg / 60)} min` : ''}`;
}

async function quadros() {   // baixa o quadro mais recente em laço enquanto a página está visível
  while (true) {
    if (document.hidden) { await esperar(1000); continue; }
    try {
      const { data: s } = await sb.auth.getSession();
      const r = await fetch(`${url}/storage/v1/object/authenticated/pc-remoto/${uid}/tela.jpg?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${s?.session?.access_token}`, apikey: key }, cache: 'no-store' });
      if (r.ok) {
        const novo = URL.createObjectURL(await r.blob());
        const img = el('img');
        img.onload = () => { if (urlAtual) URL.revokeObjectURL(urlAtual); urlAtual = novo; };
        img.src = novo; img.hidden = false; el('vazio').hidden = true; quadroOk = Date.now();
      }
    } catch (_) { }
    await esperar(450);
  }
}
const esperar = ms => new Promise(r => setTimeout(r, ms));

async function comando(tipo, extra = {}) {
  const { error } = await sb.from('pc_remoto_comandos').insert({ tipo, ...extra });
  if (error) el('status').textContent = 'Erro: ' + error.message;
}

function marcar(cx, cy) {
  const m = el('marca'); m.style.left = cx + 'px'; m.style.top = cy + 'px';
  m.style.transition = 'none'; m.style.opacity = 1;
  requestAnimationFrame(() => { m.style.transition = 'opacity .6s'; m.style.opacity = 0; });
}

// toque na imagem → posição relativa (0–1), vale com zoom e rolagem
let ini = null;
el('img').addEventListener('pointerdown', e => { ini = { x: e.clientX, y: e.clientY, t: Date.now() }; });
el('img').addEventListener('pointerup', e => {
  if (!ini || Math.hypot(e.clientX - ini.x, e.clientY - ini.y) > 12) { ini = null; return; }   // foi arrasto/zoom
  const longo = Date.now() - ini.t > 600; ini = null;
  const r = e.currentTarget.getBoundingClientRect();
  const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  ultimoXY = { x, y };
  marcar(e.clientX, e.clientY);
  comando(longo ? 'direito' : modo, { x, y });
  if (modo !== 'clique') escolherModo('clique');   // 2× e direito valem para um toque só
});
el('img').addEventListener('contextmenu', e => e.preventDefault());

function escolherModo(m) {
  modo = m;
  el('modos').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.modo === m));
}
el('modos').addEventListener('click', e => { const b = e.target.closest('[data-modo]'); if (b) escolherModo(b.dataset.modo); });

document.querySelector('.barra').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'zoom') { el('tela').classList.toggle('grande'); return; }
  if (b.dataset.tecla) comando('tecla', { valor: b.dataset.tecla });
  if (b.dataset.scroll) comando('scroll', { ...ultimoXY, valor: b.dataset.scroll });
});

el('form').addEventListener('submit', e => {
  e.preventDefault();
  const t = el('txt').value;
  if (!t) return;
  comando('texto', { valor: t.slice(0, 2000) });
  el('txt').value = '';
});

document.addEventListener('visibilitychange', async () => {
  if (document.hidden) {   // saiu da página: o PC para de transmitir
    await sb.from('pc_remoto_estado').update({ ativo_ate: new Date().toISOString() }).eq('owner_id', uid);
  } else manterAtivo();
});

iniciar().catch(err => { el('vazio').textContent = 'Erro: ' + err.message; });
