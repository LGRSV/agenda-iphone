/* mesada-sync.js — a mesada é marcada UMA vez e vale para os dois.
   • Espelha a conclusão nos DOIS sentidos (quem marcar primeiro leva).
   • Notifica o OUTRO: se eu marquei, chega no aparelho dela; se ela marcou,
     chega no meu (edge function agenda-partner-notify).
   • Deixa a mesada pré-configurada para cair no NUBANK (note.conta='nb'),
     então o reconcile do painel financeiro credita na conta certa sozinho.
   Roda tanto na agenda quanto no painel financeiro. Só leitura na conta do
   parceiro — a RLS não permite escrever lá. */
(() => {
  'use strict';

  const MODULE_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  const CONFIG_KEY = 'agenda_supabase_config_v1';
  const TK = 'agenda_lagares_v3';
  const NK = 'agenda_notas_v1';
  const MESADA = /ana carolina \(m2\)/i;
  const CONTA_MESADA = 'nb'; // Nubank

  let clientPromise, rodando = false;

  const readJson = (k, f) => { try { return JSON.parse(localStorage.getItem(k) || '') ?? f; } catch (_) { return f; } };
  const cfg = () => readJson(CONFIG_KEY, {});
  const tasks = () => { const v = readJson(TK, []); return Array.isArray(v) ? v : []; };
  const notes = () => { const v = readJson(NK, {}); return (v && typeof v === 'object') ? v : {}; };
  const isMesada = t => !!t && MESADA.test(String(t.text || ''));

  const getClient = async () => {
    if (!clientPromise) clientPromise = (async () => {
      const c = cfg();
      if (!c.url || !c.publishableKey) throw new Error('sem config');
      const { createClient } = await import(MODULE_URL);
      return createClient(c.url, c.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    })();
    return clientPromise;
  };

  // Avisa o outro lado. Silencioso: se falhar, o espelhamento ainda acontece.
  async function notificarParceiro(texto, done) {
    try {
      const c = cfg();
      if (!c.url || !c.publishableKey) return;
      const sb = await getClient();
      const { data } = await sb.auth.getSession();
      if (!data?.session) return;
      await fetch(`${String(c.url).replace(/\/$/, '')}/functions/v1/agenda-partner-notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: c.publishableKey, Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ text: String(texto || 'Mesada'), done: !!done, tag: 'mesada' })
      });
    } catch (_) { /* silencioso */ }
  }

  // Deixa a mesada pronta para cair no Nubank quando for recebida.
  function preConfigurarNubank() {
    const n = notes(); let mudou = false;
    tasks().forEach(t => {
      if (!isMesada(t)) return;
      const nota = n[t.id] || {};
      if ((nota.movimento || 'entrada') !== 'entrada') return;
      // Respeita escolha já feita: só pré-configura quando ainda não há conta
      // definida nem recebimento registrado (senão desfaria um "recebi no MP").
      if (nota.conta || nota.recebidoEm) return;
      nota.movimento = 'entrada';
      nota.conta = CONTA_MESADA;
      n[t.id] = nota; mudou = true;
    });
    if (mudou) localStorage.setItem(NK, JSON.stringify(n));
    return mudou;
  }

  // Traz para cá as mesadas que o parceiro já concluiu (casadas pela data).
  async function espelhar() {
    if (rodando) return;
    rodando = true;
    try {
      const c = cfg();
      if (!c.url || !c.publishableKey) return;
      const sb = await getClient();
      const { data: u } = await sb.auth.getUser();
      const eu = u?.user?.id || String(cfg().workspaceOwnerId || '');
      if (!eu) return;
      const { data: rows, error } = await sb.from('agenda_documents')
        .select('user_id,payload').eq('document_key', 'tasks').neq('user_id', eu);
      if (error || !rows || !rows.length) return;

      const doParceiro = Array.isArray(rows[0].payload) ? rows[0].payload : [];
      const feitas = new Set(doParceiro.filter(t => isMesada(t) && t.done).map(t => t.date));
      if (!feitas.size) return;

      const lista = tasks(); const n = notes(); let mudou = false;
      lista.forEach(t => {
        if (t.done || !isMesada(t) || !feitas.has(t.date)) return;
        t.done = true;
        t.syncRev = Date.now();                 // vence a cópia local antiga do outro aparelho
        const nota = n[t.id] || {};
        if ((nota.movimento || 'entrada') === 'entrada') { nota.movimento = 'entrada'; nota.conta = CONTA_MESADA; }
        n[t.id] = nota; mudou = true;
      });
      if (mudou) {
        localStorage.setItem(TK, JSON.stringify(lista));
        localStorage.setItem(NK, JSON.stringify(n));
        // acorda quem estiver ouvindo (agenda e painel financeiro)
        window.dispatchEvent(new CustomEvent('agenda:remote-sync', { detail: { documentKey: 'all' } }));
      }
    } catch (_) { /* silencioso */ }
    finally { rodando = false; }
  }

  // Marcação feita AQUI pelo usuário → avisa o outro lado.
  // Só dispara em interação real: o espelhamento re-renderiza sem emitir 'change'.
  document.addEventListener('change', event => {
    const box = event.target;
    if (!box || !box.matches) return;
    if (!box.matches('.task-card .check[data-id], #list .row input.check[data-i]')) return;
    const id = box.dataset.id || box.dataset.i;
    const t = tasks().find(x => String(x.id) === String(id));
    if (!isMesada(t)) return;
    notificarParceiro(t.text, box.checked);
  }, true);

  // No painel financeiro a entrada é concluída pelo seletor de banco (não há
  // checkbox). Observa o clique no banco e lê o nome da tarefa do próprio
  // diálogo — assim não é preciso alterar o finance-receive.js.
  let ultimoAviso = 0;
  document.addEventListener('click', event => {
    const banco = event.target && event.target.closest && event.target.closest('[data-receive-bank]');
    if (!banco) return;
    const alvo = document.querySelector('#receiveTask');
    const texto = alvo ? alvo.textContent : '';
    if (!MESADA.test(String(texto)) || Date.now() - ultimoAviso < 3000) return;
    ultimoAviso = Date.now();
    notificarParceiro(texto, true);
  }, true);

  function ciclo() { preConfigurarNubank(); espelhar(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(ciclo, 2000));
  else setTimeout(ciclo, 2000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ciclo(); });
  setInterval(ciclo, 120000);
})();
