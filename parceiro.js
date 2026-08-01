/* parceiro.js — visão da agenda do parceiro (só leitura).
   • Aba AGENDA: calendário mensal idêntico ao da tela inicial (grade 7x6 com
     pílulas coloridas por tag), tocando no dia abre a lista daquele dia.
   • Aba FINANCEIRO: resumo do mês (entradas, saídas, saldo) e lançamentos
     agrupados por dia — mesma leitura do painel financeiro, sem edição.
   Também espelha a conclusão da mesada da Ana para o João.
   A segurança está no banco: a RLS só permite SELECT dos documentos do
   parceiro; nada aqui grava na conta do outro. */
(() => {
  'use strict';
  const MODULE_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  const CONFIG_KEY = 'agenda_supabase_config_v1';
  const JOAO = '718266ce-ac47-4ab9-ac39-4fde8344c9d7';
  const ANA = '3f5bc48d-1c0d-4bc1-9437-0f62814d2f6b';
  const NAMES = { [JOAO]: 'João', [ANA]: 'Ana Carolina' };
  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';

  // Mesmas cores/rótulos da tela inicial.
  const TAGS = { trabalho:{label:'Trabalho',color:'#4db6f4'}, pessoal:{label:'Pessoal',color:'#bb86fc'}, casa:{label:'Casa',color:'#71d6be'}, faculdade:{label:'Faculdade',color:'#ffb74d'}, saude:{label:'Academia',color:'#78d88b'}, financeiro:{label:'Financeiro',color:'#ff7f91'}, outros:{label:'Outros',color:'#aab3c2'} };
  const tagMeta = t => TAGS[String(t || 'outros').toLowerCase()] || TAGS.outros;

  let clientPromise, mirrorRan = false, cursor = null, data = null, aba = 'agenda', diaAberto = null;

  const readJson = (k, f) => { try { return JSON.parse(localStorage.getItem(k) || '') ?? f; } catch (_) { return f; } };
  const cfg = () => readJson(CONFIG_KEY, {});
  const myId = () => String(cfg().workspaceOwnerId || '');
  const esc = s => { const d = document.createElement('div'); d.textContent = String(s ?? ''); return d.innerHTML; };
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const hoje = () => iso(new Date());
  const money = n => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
  const num = v => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

  const getClient = async () => {
    if (!clientPromise) clientPromise = (async () => {
      const c = cfg();
      if (!c.url || !c.publishableKey) throw new Error('Entre na Agenda primeiro.');
      const { createClient } = await import(MODULE_URL);
      return createClient(c.url, c.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    })();
    return clientPromise;
  };

  // Busca tarefas + notas do parceiro (a RLS garante que só vem o permitido).
  async function fetchPartner() {
    const sb = await getClient();
    const { data: u } = await sb.auth.getUser();
    const me = u?.user?.id || myId();
    const { data: rows, error } = await sb.from('agenda_documents')
      .select('user_id,document_key,payload')
      .in('document_key', ['tasks', 'notes'])
      .neq('user_id', me);
    if (error) throw error;
    if (!rows || !rows.length) return null;
    const id = rows[0].user_id;
    const doc = k => (rows.find(r => r.user_id === id && r.document_key === k) || {}).payload;
    const tasks = doc('tasks');
    const notes = doc('notes');
    return { id, tasks: Array.isArray(tasks) ? tasks : [], notes: (notes && typeof notes === 'object') ? notes : {} };
  }

  // Mesma classificação do painel financeiro.
  const kind = (t, n) => n.movimento
    || (/cobrar|sal[aá]rio|receber/i.test(t.text || '') ? 'entrada'
    : /mesada|mayara/i.test(t.text || '') ? 'saida'
    : (num(n.valor) > 0 ? 'entrada' : 'sem valor'));

  function ensureStyles() {
    if (document.getElementById('parceiroStyles')) return;
    const s = document.createElement('style');
    s.id = 'parceiroStyles';
    s.textContent = `
      #parceiroBtn svg{width:21px;height:21px}
      #parceiroBtn.on{color:var(--accent);border-color:var(--accent)}
      #parceiroDialog{width:min(calc(100% - 18px),560px);max-height:calc(100dvh - 26px);padding:0;border:1px solid var(--line);border-radius:22px;background:var(--surface);color:var(--text);overflow:hidden}
      #parceiroDialog .pc-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:15px 15px 11px}
      #parceiroDialog .pc-eyebrow{display:block;color:var(--accent);font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
      #parceiroDialog .pc-title{margin:2px 0 0;font-size:20px;letter-spacing:-.03em}
      #parceiroDialog .pc-close{border:0;background:transparent;color:var(--muted);font-size:24px;line-height:1;padding:2px 6px}
      #parceiroDialog .pc-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:0 15px 10px;padding:4px;border:1px solid var(--line);border-radius:14px;background:var(--soft)}
      #parceiroDialog .pc-tab{min-height:35px;border:0;border-radius:10px;background:transparent;color:var(--muted);font-size:13px;font-weight:800}
      #parceiroDialog .pc-tab.on{background:var(--surface);color:var(--text);box-shadow:0 1px 7px rgba(0,0,0,.16)}
      #parceiroDialog .pc-nav{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 13px;border:1px solid var(--line);border-radius:16px 16px 0 0;background:var(--soft);margin:0 15px}
      #parceiroDialog .pc-nav b{font-size:15px;text-transform:capitalize;font-weight:800}
      #parceiroDialog .pc-nav button{width:34px;height:34px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--text);font-size:18px}
      #parceiroDialog .pc-body{padding:0 15px 16px;overflow-y:auto;max-height:calc(100dvh - 210px)}
      #parceiroDialog .pc-shell{border:1px solid var(--line);border-top:0;border-radius:0 0 16px 16px;background:var(--surface);overflow:hidden}
      /* calendário — mesma estrutura da tela inicial */
      #parceiroDialog .pc-wk,#parceiroDialog .pc-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
      #parceiroDialog .pc-gridwrap{padding:10px 7px 8px}
      #parceiroDialog .pc-wk{padding:0 1px 4px;color:var(--muted);font-size:10px;font-weight:800;text-align:center}
      #parceiroDialog .pc-day{min-width:0;min-height:78px;padding:5px 4px;border:1px solid transparent;border-radius:12px;background:transparent;color:var(--text);text-align:left}
      #parceiroDialog .pc-day.cur{border-color:var(--line);background:var(--soft)}
      #parceiroDialog .pc-day.out{opacity:.4}
      #parceiroDialog .pc-day.sel{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,var(--surface))}
      #parceiroDialog .pc-day.today .pc-n{background:var(--accent);color:var(--accentInk)}
      #parceiroDialog .pc-n{display:grid;place-items:center;width:21px;height:21px;border-radius:50%;font-size:11px;font-weight:850}
      #parceiroDialog .pc-chips{display:grid;gap:3px;margin-top:5px}
      #parceiroDialog .pc-chip{display:block;min-width:0;overflow:hidden;padding:3px 4px;border-left:3px solid var(--tag);border-radius:5px;background:color-mix(in srgb,var(--tag) 16%,transparent);font-size:8.5px;font-weight:800;line-height:1.1;white-space:nowrap;text-overflow:ellipsis}
      #parceiroDialog .pc-more{padding-left:3px;color:var(--muted);font-size:9px;font-weight:800}
      #parceiroDialog .pc-legend{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 12px;border-top:1px solid var(--line)}
      #parceiroDialog .pc-pill{display:inline-flex;align-items:center;gap:5px;margin-top:10px;padding:3px 7px 3px 6px;border:1px solid color-mix(in srgb,var(--tag) 44%,var(--line));border-radius:999px;background:color-mix(in srgb,var(--tag) 14%,transparent);font-size:10px;font-weight:800;line-height:1}
      #parceiroDialog .pc-pill:before{content:"";width:6px;height:6px;border-radius:50%;background:var(--tag)}
      /* lista do dia */
      #parceiroDialog .pc-daylist{border-top:1px solid var(--line);padding:4px 10px 10px}
      #parceiroDialog .pc-daylist h5{margin:10px 4px 4px;font-size:12px;font-weight:850;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
      #parceiroDialog .pc-item{display:flex;gap:8px;align-items:baseline;padding:9px 4px;border-top:1px solid var(--line);font-size:13px}
      #parceiroDialog .pc-item:first-of-type{border-top:0}
      #parceiroDialog .pc-item.done span.tx{color:var(--faint);text-decoration:line-through}
      #parceiroDialog .pc-time{color:var(--accent);font-size:11px;font-weight:800;flex:0 0 auto;min-width:36px}
      /* financeiro */
      #parceiroDialog .pc-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line)}
      #parceiroDialog .pc-card{padding:12px 10px;background:var(--surface);text-align:center}
      #parceiroDialog .pc-card b{display:block;font-size:16px;font-weight:850;letter-spacing:-.02em}
      #parceiroDialog .pc-card span{display:block;margin-top:3px;color:var(--muted);font-size:10px;font-weight:750}
      #parceiroDialog .pc-in b{color:#78d88b}#parceiroDialog .pc-out b{color:#ff7f91}
      #parceiroDialog .pc-fday{border-top:1px solid var(--line)}
      #parceiroDialog .pc-fday h5{display:flex;justify-content:space-between;margin:0;padding:8px 12px;background:var(--soft);font-size:12px;font-weight:800}
      #parceiroDialog .pc-frow{display:flex;justify-content:space-between;gap:10px;padding:9px 12px;border-top:1px solid var(--line);font-size:13px}
      #parceiroDialog .pc-frow .v{font-weight:850;white-space:nowrap}
      #parceiroDialog .pc-frow .v.e{color:#78d88b}#parceiroDialog .pc-frow .v.s{color:#ff7f91}
      #parceiroDialog .pc-empty{padding:34px 16px;text-align:center;color:var(--muted);font-size:13px}
      #parceiroDialog .pc-ro{margin:0;padding:9px 15px 14px;color:var(--faint);font-size:10.5px;text-align:center}
    `;
    document.head.appendChild(s);
  }

  const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const WDL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  function renderAgenda(dialog) {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const first = new Date(y, m, 1, 12);
    const start = new Date(y, m, 1 - first.getDay(), 12);
    const porDia = {};
    data.tasks.forEach(t => { if (t && t.text && t.date) (porDia[t.date] = porDia[t.date] || []).push(t); });

    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const key = iso(d), itens = (porDia[key] || []);
      const tags = [...new Set(itens.map(t => t.tag))].slice(0, 2);
      const chips = tags.map(tg => { const meta = tagMeta(tg); return `<span class="pc-chip" style="--tag:${meta.color}">${esc(meta.label)}</span>`; }).join('');
      const mais = itens.length > tags.length ? `<span class="pc-more">+${itens.length - tags.length}</span>` : '';
      const cls = ['pc-day', d.getMonth() === m ? 'cur' : 'out', key === diaAberto ? 'sel' : '', key === hoje() ? 'today' : ''].filter(Boolean).join(' ');
      cells += `<button class="${cls}" type="button" data-dia="${key}"><span class="pc-n">${d.getDate()}</span><span class="pc-chips">${chips}${mais}</span></button>`;
    }
    const legenda = Object.values(TAGS).map(t => `<span class="pc-pill" style="--tag:${t.color}">${esc(t.label)}</span>`).join('');

    let lista = '';
    if (diaAberto) {
      const itens = (porDia[diaAberto] || []).slice().sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
      const dd = diaAberto.split('-');
      lista = `<div class="pc-daylist"><h5>${dd[2]}/${dd[1]} · ${WDL[new Date(diaAberto + 'T12:00:00').getDay()]}</h5>` +
        (itens.length ? itens.map(t => `<div class="pc-item ${t.done ? 'done' : ''}"><span class="pc-time">${t.time ? esc(t.time) : '—'}</span><span class="tx">${esc(t.text)}</span></div>`).join('')
                      : '<div class="pc-empty" style="padding:18px">Nada neste dia.</div>') + '</div>';
    }
    dialog.querySelector('.pc-body').innerHTML =
      `<div class="pc-shell"><div class="pc-gridwrap"><div class="pc-wk">${WD.map(w => `<span>${w}</span>`).join('')}</div><div class="pc-grid">${cells}</div></div>${lista}<div class="pc-legend">${legenda}</div></div>`;
  }

  function renderFinanceiro(dialog) {
    const key = cursor.getFullYear() + '-' + pad(cursor.getMonth() + 1);
    const itens = data.tasks
      .filter(t => t && t.text && String(t.date || '').startsWith(key))
      .map(t => ({ ...t, n: data.notes[t.id] || {} }))
      .filter(t => t.tag === 'financeiro' || t.n.movimento)
      .sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));

    const soma = k => itens.reduce((s, t) => s + (kind(t, t.n) === k ? num(t.n.valor) : 0), 0);
    const ent = soma('entrada'), sai = soma('saida');

    let corpo;
    if (!itens.length) corpo = '<div class="pc-empty">Nenhum lançamento neste mês.</div>';
    else {
      const byDay = {};
      itens.forEach(t => { (byDay[t.date] = byDay[t.date] || []).push(t); });
      corpo = Object.keys(byDay).sort().reverse().map(dt => {
        const dd = dt.split('-');
        let liq = 0;
        byDay[dt].forEach(t => { const k = kind(t, t.n); if (k === 'entrada') liq += num(t.n.valor); else if (k === 'saida') liq -= num(t.n.valor); });
        const rows = byDay[dt].map(t => {
          const k = kind(t, t.n), v = num(t.n.valor);
          return `<div class="pc-frow"><span>${esc(t.text)}</span><span class="v ${k === 'entrada' ? 'e' : k === 'saida' ? 's' : ''}">${v ? (k === 'entrada' ? '+ ' : k === 'saida' ? '− ' : '') + money(v) : '—'}</span></div>`;
        }).join('');
        return `<section class="pc-fday"><h5><span>${dd[2]}/${dd[1]}</span><span style="color:${liq >= 0 ? '#78d88b' : '#ff7f91'}">${liq ? (liq > 0 ? '+ ' : '− ') + money(Math.abs(liq)) : ''}</span></h5>${rows}</section>`;
      }).join('');
    }
    dialog.querySelector('.pc-body').innerHTML =
      `<div class="pc-shell"><div class="pc-cards"><div class="pc-card pc-in"><b>${money(ent)}</b><span>Entradas</span></div><div class="pc-card pc-out"><b>${money(sai)}</b><span>Saídas</span></div><div class="pc-card"><b>${money(ent - sai)}</b><span>Saldo do mês</span></div></div>${corpo}</div>`;
  }

  function paint(dialog) {
    dialog.querySelector('.pc-month').textContent = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(cursor);
    dialog.querySelectorAll('.pc-tab').forEach(b => b.classList.toggle('on', b.dataset.aba === aba));
    if (aba === 'agenda') renderAgenda(dialog); else renderFinanceiro(dialog);
  }

  async function open() {
    ensureStyles();
    let dialog = document.getElementById('parceiroDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'parceiroDialog';
      dialog.innerHTML =
        `<div class="pc-head"><div><span class="pc-eyebrow">Agenda compartilhada</span><h3 class="pc-title">Parceiro</h3></div><button type="button" class="pc-close" aria-label="Fechar">&times;</button></div>
         <nav class="pc-tabs"><button type="button" class="pc-tab on" data-aba="agenda">Agenda</button><button type="button" class="pc-tab" data-aba="financeiro">Financeiro</button></nav>
         <div class="pc-nav"><button type="button" data-mv="-1" aria-label="Mês anterior">‹</button><b class="pc-month"></b><button type="button" data-mv="1" aria-label="Próximo mês">›</button></div>
         <div class="pc-body"></div>
         <p class="pc-ro">Somente leitura · você não altera nada aqui</p>`;
      document.body.appendChild(dialog);
      dialog.querySelector('.pc-close').addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
      dialog.addEventListener('click', e => {
        const mv = e.target.closest('[data-mv]');
        if (mv && data) { cursor = new Date(cursor.getFullYear(), cursor.getMonth() + Number(mv.dataset.mv), 1); diaAberto = null; paint(dialog); return; }
        const tab = e.target.closest('.pc-tab');
        if (tab && data) { aba = tab.dataset.aba; paint(dialog); return; }
        const dia = e.target.closest('[data-dia]');
        if (dia && data) { diaAberto = (diaAberto === dia.dataset.dia) ? null : dia.dataset.dia; paint(dialog); }
      });
    }
    if (!cursor) cursor = new Date();
    dialog.querySelector('.pc-body').innerHTML = '<div class="pc-empty">Carregando…</div>';
    if (!dialog.open) dialog.showModal();
    try {
      data = await fetchPartner();
      if (!data) { dialog.querySelector('.pc-body').innerHTML = '<div class="pc-empty">Nada compartilhado ainda.</div>'; return; }
      dialog.querySelector('.pc-title').textContent = NAMES[data.id] || 'Parceiro';
      paint(dialog);
    } catch (e) {
      dialog.querySelector('.pc-body').innerHTML = '<div class="pc-empty">' + esc(String(e && e.message || e)) + '</div>';
    }
  }

  // Espelha a conclusão da mesada da Ana para o João (só roda na conta do João).
  async function mirror() {
    if (myId() !== JOAO || mirrorRan) return;
    if (!window.AgendaAPI || typeof window.AgendaAPI.getTasksFull !== 'function' || typeof window.AgendaAPI.completeById !== 'function') return;
    try {
      const p = await fetchPartner();
      if (!p || p.id !== ANA) return;
      mirrorRan = true;
      const feitas = new Set(p.tasks.filter(t => t && t.done && /ana carolina \(m2\)/i.test(t.text || '')).map(t => t.date));
      if (!feitas.size) return;
      let mudou = false;
      window.AgendaAPI.getTasksFull().forEach(t => {
        if (!t.done && /ana carolina \(m2\)/i.test(t.text || '') && feitas.has(t.date)) {
          if (window.AgendaAPI.completeById(t.id)) mudou = true;
        }
      });
      if (mudou) mirrorRan = false;
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

  const install = () => ensureButton();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });

  setTimeout(mirror, 2500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { mirrorRan = false; mirror(); } });
  setInterval(() => { mirrorRan = false; mirror(); }, 120000);
})();
