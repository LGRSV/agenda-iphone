/* parceiro.js — ver a agenda do parceiro (só leitura, só tarefas) e espelhar a
   conclusão da mesada da Ana para o João (+ valor cai no Nubank via reconcile).
   A segurança fica no banco: a RLS só deixa ler o documento 'tasks' do parceiro,
   nunca notas/financeiro. */
(() => {
  'use strict';
  const MODULE_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  const CONFIG_KEY = 'agenda_supabase_config_v1';
  const TASK_KEY = 'agenda_lagares_v3';
  const JOAO = '718266ce-ac47-4ab9-ac39-4fde8344c9d7';
  const ANA = '3f5bc48d-1c0d-4bc1-9437-0f62814d2f6b';
  const NAMES = { [JOAO]: 'João', [ANA]: 'Ana Carolina' };
  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';

  let clientPromise, mirrorRan = false, cursor = null;
  const readJson = (k, f) => { try { return JSON.parse(localStorage.getItem(k) || '') ?? f; } catch (_) { return f; } };
  const cfg = () => readJson(CONFIG_KEY, {});
  const myId = () => String(cfg().workspaceOwnerId || '');
  const esc = s => { const d = document.createElement('div'); d.textContent = String(s ?? ''); return d.innerHTML; };
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

  const getClient = async () => {
    if (!clientPromise) clientPromise = (async () => {
      const c = cfg();
      if (!c.url || !c.publishableKey) throw new Error('Entre na Agenda primeiro.');
      const { createClient } = await import(MODULE_URL);
      return createClient(c.url, c.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    })();
    return clientPromise;
  };

  async function fetchPartner() {
    const sb = await getClient();
    const { data: u } = await sb.auth.getUser();
    const me = u?.user?.id || myId();
    const { data, error } = await sb.from('agenda_documents')
      .select('user_id,payload').eq('document_key', 'tasks').neq('user_id', me);
    if (error) throw error;
    const row = (data || [])[0];
    if (!row) return null;
    return { id: row.user_id, tasks: Array.isArray(row.payload) ? row.payload : [] };
  }

  function ensureStyles() {
    if (document.getElementById('parceiroStyles')) return;
    const s = document.createElement('style');
    s.id = 'parceiroStyles';
    s.textContent = `
      #parceiroBtn svg{width:21px;height:21px}
      #parceiroBtn.on{color:var(--accent);border-color:var(--accent)}
      #parceiroDialog{width:min(calc(100% - 20px),520px);max-height:calc(100dvh - 28px);padding:0;border:1px solid var(--line);border-radius:22px;background:var(--surface);color:var(--text)}
      #parceiroDialog .pc-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 16px 12px;border-bottom:1px solid var(--line)}
      #parceiroDialog .pc-eyebrow{display:block;color:var(--accent);font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
      #parceiroDialog .pc-head h3{margin:2px 0 0;font-size:20px;letter-spacing:-.03em}
      #parceiroDialog .pc-close{border:0;background:transparent;color:var(--muted);font-size:22px;line-height:1;padding:4px}
      #parceiroDialog .pc-nav{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 16px}
      #parceiroDialog .pc-nav b{font-size:15px;text-transform:capitalize}
      #parceiroDialog .pc-nav button{width:36px;height:36px;border:1px solid var(--line);border-radius:11px;background:var(--soft);color:var(--text);font-size:18px}
      #parceiroDialog .pc-body{padding:4px 12px 18px;overflow-y:auto}
      #parceiroDialog .pc-day{border:1px solid var(--line);border-radius:14px;background:var(--bg);margin:8px 0;overflow:hidden}
      #parceiroDialog .pc-day h4{margin:0;padding:9px 12px;background:var(--soft);font-size:12px;font-weight:800;border-bottom:1px solid var(--line)}
      #parceiroDialog .pc-day h4 em{font-style:normal;color:var(--muted);font-weight:700;margin-left:5px;text-transform:uppercase;font-size:10px}
      #parceiroDialog .pc-item{display:flex;gap:8px;align-items:baseline;padding:9px 12px;border-top:1px solid var(--line);font-size:13px}
      #parceiroDialog .pc-item:first-child{border-top:0}
      #parceiroDialog .pc-item.done span{color:var(--faint);text-decoration:line-through}
      #parceiroDialog .pc-time{color:var(--accent);font-size:11px;font-weight:800;flex:0 0 auto;min-width:38px}
      #parceiroDialog .pc-empty{padding:34px 16px;text-align:center;color:var(--muted);font-size:13px}
    `;
    document.head.appendChild(s);
  }

  const WD = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  function renderMonth(dialog, partner) {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const key = y + '-' + pad(m + 1);
    const items = partner.tasks
      .filter(t => t && t.text && String(t.date || '').startsWith(key))
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    dialog.querySelector('.pc-month').textContent = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(cursor);
    const body = dialog.querySelector('.pc-body');
    if (!items.length) { body.innerHTML = '<div class="pc-empty">Nenhuma tarefa neste mês.</div>'; return; }
    const byDay = {};
    items.forEach(t => { (byDay[t.date] = byDay[t.date] || []).push(t); });
    body.innerHTML = Object.keys(byDay).sort().map(dt => {
      const d = dt.split('-'), wd = WD[new Date(dt + 'T12:00:00').getDay()];
      const rows = byDay[dt].map(t => `<div class="pc-item ${t.done ? 'done' : ''}"><span class="pc-time">${t.time ? esc(t.time) : '—'}</span><span>${esc(t.text)}</span></div>`).join('');
      return `<section class="pc-day"><h4>${d[2]}/${d[1]} <em>${wd}</em></h4>${rows}</section>`;
    }).join('');
  }

  async function open() {
    ensureStyles();
    let dialog = document.getElementById('parceiroDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'parceiroDialog';
      dialog.innerHTML = `<div class="pc-head"><div><span class="pc-eyebrow">Agenda compartilhada</span><h3 class="pc-title">Parceiro</h3></div><button type="button" class="pc-close" aria-label="Fechar">&times;</button></div><div class="pc-nav"><button type="button" data-mv="-1" aria-label="Mês anterior">‹</button><b class="pc-month"></b><button type="button" data-mv="1" aria-label="Próximo mês">›</button></div><div class="pc-body"></div>`;
      document.body.appendChild(dialog);
      dialog.querySelector('.pc-close').addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    }
    if (!cursor) cursor = new Date();
    const body = dialog.querySelector('.pc-body');
    body.innerHTML = '<div class="pc-empty">Carregando…</div>';
    if (!dialog.open) dialog.showModal();
    try {
      const partner = await fetchPartner();
      if (!partner) { body.innerHTML = '<div class="pc-empty">Nada compartilhado ainda.</div>'; return; }
      dialog.querySelector('.pc-title').textContent = 'Agenda de ' + (NAMES[partner.id] || 'Parceiro');
      dialog._nav = mv => { cursor = new Date(cursor.getFullYear(), cursor.getMonth() + mv, 1); renderMonth(dialog, partner); };
      dialog.querySelectorAll('[data-mv]').forEach(b => { b.onclick = () => dialog._nav(Number(b.dataset.mv)); });
      renderMonth(dialog, partner);
    } catch (e) { body.innerHTML = '<div class="pc-empty">' + esc(String(e && e.message || e)) + '</div>'; }
  }

  // Espelha a conclusão da mesada da Ana para o João. Só roda na conta do João.
  // Idempotente: completeById só conclui o que ainda não está concluído; o
  // reconcile do financeiro credita o valor no Nubank uma única vez.
  async function mirror() {
    if (myId() !== JOAO || mirrorRan) return;
    if (!window.AgendaAPI || typeof window.AgendaAPI.getTasksFull !== 'function' || typeof window.AgendaAPI.completeById !== 'function') return;
    try {
      const partner = await fetchPartner();
      if (!partner || partner.id !== ANA) return;
      mirrorRan = true;
      const anaDone = new Set(partner.tasks.filter(t => t && t.done && /ana carolina \(m2\)/i.test(t.text || '')).map(t => t.date));
      if (!anaDone.size) return;
      let changed = false;
      window.AgendaAPI.getTasksFull().forEach(t => {
        if (!t.done && /ana carolina \(m2\)/i.test(t.text || '') && anaDone.has(t.date)) {
          if (window.AgendaAPI.completeById(t.id)) changed = true;
        }
      });
      if (changed) mirrorRan = false; // deixa reprocessar no próximo ciclo se surgirem mais
    } catch (_) { mirrorRan = false; }
  }

  function ensureButton() {
    if (document.getElementById('parceiroBtn')) return;
    const actions = document.querySelector('.head-actions');
    if (!actions) return;
    const btn = document.createElement('button');
    btn.id = 'parceiroBtn'; btn.type = 'button'; btn.className = 'icon-btn';
    btn.title = 'Ver agenda do parceiro'; btn.setAttribute('aria-label', 'Ver agenda do parceiro');
    btn.innerHTML = EYE;
    const more = document.getElementById('moreMenuBtn');
    if (more) actions.insertBefore(btn, more); else actions.appendChild(btn);
    btn.addEventListener('click', open);
  }

  function install() { ensureButton(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });

  // mirror ao abrir, ao voltar ao 1º plano e periodicamente (Ana marcou → cai no João)
  setTimeout(mirror, 2500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { mirrorRan = false; mirror(); } });
  setInterval(() => { mirrorRan = false; mirror(); }, 120000);
})();
