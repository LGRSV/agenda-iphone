// WhatsApp do João dentro do app: lê as conversas espelhadas pelo PC (whatsapp_web.py) no Supabase,
// recebe novidades na hora pelo Realtime e enfileira respostas em whatsapp_saida (o PC envia pela ponte).
// Só o dono enxerga (RLS). Fotos e áudios vêm do bucket privado por URL assinada.
const MODULE_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const cfg = (window.AgendaSupabaseConfig || window.SUPABASE_AGENDA_CONFIG || {});
const el = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hora = ts => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dia = ts => {
  const d = new Date(ts), hoje = new Date(), ontem = new Date(Date.now() - 864e5);
  if (d.toDateString() === hoje.toDateString()) return 'Hoje';
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
};
const quando = ts => { const d = new Date(ts); return d.toDateString() === new Date().toDateString() ? hora(ts) : dia(ts); };
const inicial = n => (String(n || '?').trim()[0] || '?').toUpperCase();
const ROTULO = { image: '📷 Foto', audio: '🎤 Áudio', video: '🎬 Vídeo (abra no celular)', document: '📄 Documento' };

let sb, uid, chats = [], atual = null, msgs = [], saidas = new Map(), urls = new Map(), filtro = 'tudo', temMais = false;
const LOTE = 80;
const CORES = ['#00a884', '#53bdeb', '#ff7aa2', '#ffbc38', '#a5b337', '#e26ab6', '#7f66ff', '#06cf9c', '#ff8c5a', '#5ba2f2'];
const corDe = s => { let h = 0; for (const ch of String(s || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0; return CORES[h % CORES.length]; };
const avatar = (el2, c) => { el2.textContent = inicial(c.nome); el2.style.background = corDe(c.jid); };

async function iniciar() {
  const conf = cfg.url ? cfg : (window.getSupabaseAgendaConfig ? window.getSupabaseAgendaConfig() : {});
  const url = conf.url || 'https://uabpevnjfcwidbjscowq.supabase.co';
  const key = conf.publishableKey || 'sb_publishable_SHH7EV0MT5grOTdCFM-V-w_FqPrtzPh';
  const { createClient } = await import(MODULE_URL);
  sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  const { data } = await sb.auth.getSession();
  uid = data?.session?.user?.id;
  if (!uid) { location.replace('./?locked=1'); return; }
  // o canal do Realtime precisa do login, senão o RLS descarta os eventos sem avisar
  sb.realtime.setAuth(data.session.access_token);
  sb.auth.onAuthStateChange((_, sess) => { if (sess?.access_token) sb.realtime.setAuth(sess.access_token); });
  await carregarChats();
  await status();
  setInterval(status, 30000);
  ouvir();
  setInterval(conferir, 3000);   // reserva: se o Realtime cair, a tela segue atualizando
  const alvo = decodeURIComponent((location.hash.match(/chat=([^&]+)/) || [])[1] || '');
  if (alvo) abrir(alvo, false);
}

async function status() {
  const { data } = await sb.from('whatsapp_status').select('visto').maybeSingle();
  const min = data ? (Date.now() - new Date(data.visto)) / 6e4 : Infinity;
  el('status').innerHTML = min < 2 ? '<span class="dot on"></span>PC online · tempo real'
    : `<span class="dot"></span>PC offline${isFinite(min) ? ` há ${Math.round(min)} min` : ''} · respostas saem quando ligar`;
}

async function carregarChats() {
  const { data, error } = await sb.from('whatsapp_chats').select('*').order('ultima_ts', { ascending: false });
  if (error) { el('chats').innerHTML = `<div class="vazio">Erro ao carregar: ${esc(error.message)}</div>`; return; }
  chats = data || [];
  pintarChats();
}

function pintarChats() {
  const q = el('busca').value.trim().toLowerCase();
  const agora = Date.now(), hoje = new Date().toDateString();
  const passa = c => filtro === 'tudo' || (filtro === 'grupos' && c.grupo) || (filtro === 'contatos' && !c.grupo)
    || (filtro === 'hoje' && c.ultima_ts && new Date(c.ultima_ts).toDateString() === hoje)
    || (filtro === 'semana' && c.ultima_ts && agora - new Date(c.ultima_ts) < 7 * 864e5);
  const lista = chats.filter(c => passa(c) && (!q || (c.nome || c.jid).toLowerCase().includes(q) || c.jid.includes(q)))
    .sort((a, b) => String(b.ultima_ts).localeCompare(String(a.ultima_ts)));
  el('chats').innerHTML = lista.length ? lista.map(c => `
    <div class="chat${atual === c.jid ? ' on' : ''}" data-jid="${esc(c.jid)}">
      <div class="av" style="background:${corDe(c.jid)}">${c.grupo ? '👥' : esc(inicial(c.nome))}</div>
      <div class="ci"><div class="l1"><b>${esc(c.nome || c.jid.split('@')[0])}</b><time>${c.ultima_ts ? quando(c.ultima_ts) : ''}</time></div>
      <div class="pv">${esc(c.ultima_previa || '')}</div></div>
    </div>`).join('') + `<div class="rodape">${lista.length} conversa(s) · últimos 30 dias</div>`
    : `<div class="vazio">${q ? 'Nenhuma conversa encontrada para “' + esc(q) + '” nos últimos 30 dias.' : 'Nenhuma conversa nos últimos 30 dias.'}</div>`;
}

async function abrir(jid, mexerHash = true) {
  atual = jid;
  const c = chats.find(x => x.jid === jid) || { jid, nome: jid.split('@')[0] };
  el('wrap').classList.add('aberto');
  el('cnome').textContent = c.nome || jid.split('@')[0];
  avatar(el('cav'), c); if (c.grupo) el('cav').textContent = '👥';
  el('cpane').classList.add('ativo');
  el('csub').textContent = c.grupo ? 'Grupo' : jid.split('@')[0];
  el('txt').disabled = false; el('enviar').disabled = false;
  if (mexerHash) history.pushState(null, '', '#chat=' + encodeURIComponent(jid));
  pintarChats();
  el('msgs').innerHTML = '<div class="vazio">Carregando…</div>';
  const [{ data: m }, { data: s }] = await Promise.all([
    sb.from('whatsapp_mensagens').select('*').eq('chat_jid', jid).order('ts', { ascending: false }).limit(LOTE),
    sb.from('whatsapp_saida').select('*').eq('chat_jid', jid).neq('status', 'enviado').order('criado', { ascending: true }),
  ]);
  if (atual !== jid) return;
  msgs = (m || []).reverse();
  temMais = (m || []).length === LOTE;
  saidas = new Map((s || []).map(x => [x.id, x]));
  await assinar(msgs);
  pintarMsgs(true);
}

async function assinar(lista) {   // URLs assinadas (1 h) das fotos e áudios ainda sem URL
  const faltam = [...new Set(lista.filter(x => x.midia_caminho && !urls.has(x.midia_caminho)).map(x => x.midia_caminho))];
  if (!faltam.length) return;
  const { data } = await sb.storage.from('whatsapp-midia').createSignedUrls(faltam, 3600);
  (data || []).forEach(d => { if (d.signedUrl) urls.set(d.path, d.signedUrl); });
}

function corpo(x) {
  const u = x.midia_caminho && urls.get(x.midia_caminho);
  let midia = '';
  if (x.midia_tipo === 'image') midia = u ? `<img src="${esc(u)}" loading="lazy" alt="Foto">` : `<span class="tag">📷 Foto (carregando no PC…)</span>`;
  else if (x.midia_tipo === 'audio') midia = u ? `<audio controls preload="none" src="${esc(u)}"></audio>` : `<span class="tag">🎤 Áudio${x.midia_seg ? ' ' + x.midia_seg + 's' : ''} (carregando no PC…)</span>`;
  else if (x.midia_tipo) midia = `<span class="tag">${esc(ROTULO[x.midia_tipo] || x.midia_tipo)}</span>`;
  if (!u && (x.midia_tipo === 'image' || x.midia_tipo === 'audio') && Date.now() - new Date(x.ts) > 7 * 864e5)
    midia = `<span class="tag">${x.midia_tipo === 'image' ? '📷 Foto' : '🎤 Áudio'} (mais de 7 dias: abra no celular)</span>`;
  const txt = x.texto ? esc(x.texto) : '';
  return midia + (midia && txt ? '<br>' : '') + txt;
}

async function anteriores() {   // mais 80 mensagens antes da primeira carregada
  if (!atual || !msgs.length) return;
  const jid = atual, box = el('msgs'), alt = box.scrollHeight;
  const { data } = await sb.from('whatsapp_mensagens').select('*').eq('chat_jid', jid).lt('ts', msgs[0].ts).order('ts', { ascending: false }).limit(LOTE);
  if (atual !== jid) return;
  const velhas = (data || []).reverse();
  temMais = velhas.length === LOTE;
  msgs = velhas.concat(msgs);
  await assinar(velhas);
  pintarMsgs(false);
  box.scrollTop = box.scrollHeight - alt;
}

function pintarMsgs(rolar) {
  const box = el('msgs'), perto = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  const c = chats.find(x => x.jid === atual) || {};
  let ult = '', html = temMais ? '<button class="mais" id="mais" type="button">Carregar mensagens anteriores</button>' : '', antes = null;
  for (const x of msgs) {
    const d = dia(x.ts);
    if (d !== ult) { html += `<div class="day"><span>${esc(d)}</span></div>`; ult = d; antes = null; }
    const quem = x.de_mim ? 'eu' : (x.remetente || 'ele');
    const cauda = quem !== antes; antes = quem;
    const nome = c.grupo && !x.de_mim && x.remetente_nome && cauda ? `<span class="who" style="color:${corDe(x.remetente)}">${esc(x.remetente_nome)}</span>` : '';
    html += `<div class="m${x.de_mim ? ' eu' : ''}${cauda ? ' cauda' : ''}">${nome}${corpo(x)}<span class="t">${hora(x.ts)}${x.de_mim ? ' <span class="ck">✓✓</span>' : ''}</span></div>`;
  }
  for (const s of saidas.values()) {   // respostas ainda não confirmadas pelo PC
    if (s.chat_jid !== atual || s.status === 'enviado') continue;
    html += `<div class="m eu">${esc(s.texto)}<span class="t">${s.status === 'erro' ? '⚠ não enviada' : '⏳ enviando'}</span></div>`;
  }
  box.innerHTML = html || '<div class="vazio">Sem mensagens recentes.</div>';
  if (rolar || perto) box.scrollTop = box.scrollHeight;
}

let conferindo = false;
async function conferir() {   // busca só o que chegou depois da última mensagem/conversa vista
  if (conferindo || document.hidden) return;
  conferindo = true;
  try {
    const ultChat = chats.reduce((m, c) => (String(c.ultima_ts) > m ? String(c.ultima_ts) : m), '');
    const { data: cs } = await sb.from('whatsapp_chats').select('*').gt('ultima_ts', ultChat || '1970-01-01');
    if (cs?.length) { for (const c of cs) { const i = chats.findIndex(x => x.jid === c.jid); if (i >= 0) chats[i] = c; else chats.unshift(c); } pintarChats(); }
    if (atual) {
      const jid = atual, ultMsg = msgs.length ? msgs[msgs.length - 1].ts : '1970-01-01';
      const { data: ms } = await sb.from('whatsapp_mensagens').select('*').eq('chat_jid', jid).gt('ts', ultMsg).order('ts');
      if (ms?.length && atual === jid) {
        for (const x of ms) { if (!msgs.some(y => y.id === x.id)) msgs.push(x); if (x.id.startsWith('app-')) saidas.delete(x.id.slice(4)); }
        await assinar(ms); pintarMsgs(false);
      }
    }
  } catch (_) { } finally { conferindo = false; }
}

function ouvir() {
  sb.channel('whatsapp-' + uid)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_chats', filter: `owner_id=eq.${uid}` }, ({ new: c, eventType }) => {
      if (eventType === 'DELETE') { chats = chats.filter(x => x.jid !== (c?.jid)); }
      else if (c?.jid) { const i = chats.findIndex(x => x.jid === c.jid); if (i >= 0) chats[i] = c; else chats.unshift(c); }
      pintarChats(); status();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_mensagens', filter: `owner_id=eq.${uid}` }, async ({ new: x }) => {
      if (!x?.id || x.chat_jid !== atual) return;
      const i = msgs.findIndex(y => y.id === x.id);
      if (i >= 0) msgs[i] = x; else { msgs.push(x); msgs.sort((a, b) => String(a.ts).localeCompare(String(b.ts))); }
      if (x.id.startsWith('app-')) saidas.delete(x.id.slice(4));
      await assinar([x]);
      pintarMsgs(false);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_saida', filter: `owner_id=eq.${uid}` }, ({ new: s }) => {
      if (!s?.id) return;
      if (s.status === 'enviado') saidas.delete(s.id); else saidas.set(s.id, s);
      if (s.chat_jid === atual) pintarMsgs(false);
    })
    .subscribe();
}

el('chats').addEventListener('click', e => { const c = e.target.closest('[data-jid]'); if (c) abrir(c.dataset.jid); });
el('busca').addEventListener('input', pintarChats);
el('chips').addEventListener('click', e => { const b = e.target.closest('button[data-f]'); if (!b) return; filtro = b.dataset.f; el('chips').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); pintarChats(); });
el('msgs').addEventListener('click', e => { if (e.target.id === 'mais') anteriores(); });
el('voltar').addEventListener('click', () => history.back());
window.addEventListener('popstate', () => { if (!location.hash.includes('chat=')) { el('wrap').classList.remove('aberto'); el('cpane').classList.remove('ativo'); atual = null; pintarChats(); } });
el('msgs').addEventListener('click', e => { const img = e.target.closest('img'); if (img) { el('zoom').querySelector('img').src = img.src; el('zoom').classList.add('on'); } });
el('zoom').addEventListener('click', () => el('zoom').classList.remove('on'));
const txt = el('txt');
txt.addEventListener('input', () => { txt.style.height = 'auto'; txt.style.height = Math.min(txt.scrollHeight, 120) + 'px'; el('enviar').classList.toggle('pronto', !!txt.value.trim()); });
txt.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(min-width:820px)').matches) { e.preventDefault(); el('form').requestSubmit(); } });
el('form').addEventListener('submit', async e => {
  e.preventDefault();
  const texto = txt.value.trim();
  if (!texto || !atual) return;
  el('enviar').disabled = true;
  const { data, error } = await sb.from('whatsapp_saida').insert({ chat_jid: atual, texto }).select().single();
  el('enviar').disabled = false;
  if (error) { alert('Não foi possível enviar: ' + error.message); return; }
  txt.value = ''; txt.style.height = 'auto';
  saidas.set(data.id, data);
  pintarMsgs(true);
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && atual) abrir(atual, false); });

iniciar().catch(err => { el('chats').innerHTML = `<div class="vazio">Erro: ${esc(err.message)}</div>`; });
