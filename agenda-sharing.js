/* Compartilhamento de tarefas — convite individual e comentários. */
(() => {
  'use strict';
  const MODULE_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  const CONFIG_KEY = 'agenda_supabase_config_v1';
  const TASK_KEY = 'agenda_lagares_v3';
  let clientPromise;
  let selectedTaskId = '';

  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || '') ?? fallback; } catch (_) { return fallback; } };
  const escape = value => { const el = document.createElement('div'); el.textContent = String(value ?? ''); return el.innerHTML; };
  const cfg = () => readJson(CONFIG_KEY, {});
  const getClient = async () => {
    if (!clientPromise) clientPromise = (async () => {
      const config = cfg();
      if (!config.url || !config.publishableKey) throw new Error('Entre na Agenda para usar o compartilhamento.');
      const { createClient } = await import(MODULE_URL);
      return createClient(config.url, config.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    })();
    return clientPromise;
  };
  const toast = message => {
    const target = document.getElementById('toast');
    if (!target) return;
    target.textContent = message;
    target.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => target.classList.remove('show'), 2600);
  };
  const taskById = id => (readJson(TASK_KEY, []) || []).find(task => String(task.id) === String(id));

  function ensureStyles() {
    if (document.getElementById('agendaShareStyles')) return;
    const style = document.createElement('style');
    style.id = 'agendaShareStyles';
    style.textContent = `
      .agenda-share{display:inline-flex;align-items:center;gap:4px;padding:3px 7px;border:1px solid var(--line);border-radius:999px;background:var(--soft);color:var(--accent);font-size:10px;font-weight:800}.agenda-share svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      #agendaShareDialog .modal,#agendaSharedDialog .modal{max-height:calc(100dvh - 32px);overflow:auto}.share-task-name{margin-top:4px!important;color:var(--text)!important;font-weight:750}.share-help{margin-top:12px!important}.share-list{display:grid;gap:10px;margin-top:14px}.share-card{padding:12px;border:1px solid var(--line);border-radius:15px;background:var(--soft)}.share-card h4{margin:0;font-size:15px;line-height:1.35}.share-meta{margin:5px 0 10px;color:var(--muted);font-size:11px;font-weight:700}.share-comments{display:grid;gap:6px;margin:9px 0}.share-comment{padding:7px 9px;border-radius:10px;background:var(--surface);color:var(--text);font-size:12px;line-height:1.35}.share-comment.mine{border-left:3px solid var(--accent)}.share-comment small{display:block;margin-top:3px;color:var(--muted);font-size:10px}.share-comment-form{display:flex;gap:6px}.share-comment-form input{min-height:37px;padding:8px 9px;font-size:13px}.share-comment-form button{flex:0 0 auto;padding:8px 10px;border:0;border-radius:10px;background:var(--accent);color:var(--accentInk);font-size:12px;font-weight:800}.share-empty{padding:22px 8px;color:var(--muted);text-align:center;font-size:13px}
    `;
    document.head.appendChild(style);
  }

  function ensureDialogs() {
    if (!document.getElementById('agendaShareDialog')) {
      const dialog = document.createElement('dialog');
      dialog.id = 'agendaShareDialog';
      dialog.innerHTML = `<form class="modal" id="agendaShareForm"><h3>Compartilhar tarefa</h3><p class="share-task-name" id="agendaShareTaskName"></p><p class="share-help">A pessoa verá uma cópia desta tarefa e poderá deixar comentários. Ela precisa já ter entrado na Agenda pelo menos uma vez.</p><label class="field-label" for="agendaShareEmail">E-mail da pessoa</label><input id="agendaShareEmail" type="email" inputmode="email" autocomplete="email" placeholder="pessoa@exemplo.com" required><p id="agendaShareStatus" class="share-help"></p><div class="actions"><button class="secondary" type="button" id="agendaShareCancel">Cancelar</button><button class="primary" type="submit">Compartilhar</button></div></form>`;
      document.body.appendChild(dialog);
      dialog.querySelector('#agendaShareCancel').addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
      dialog.querySelector('form').addEventListener('submit', submitShare);
    }
    if (!document.getElementById('agendaSharedDialog')) {
      const dialog = document.createElement('dialog');
      dialog.id = 'agendaSharedDialog';
      dialog.innerHTML = `<section class="modal"><h3>Tarefas compartilhadas</h3><p>Comentários ficam visíveis para as duas pessoas.</p><div class="share-list" id="agendaSharedList"></div><div class="actions"><button class="secondary" type="button" id="agendaSharedClose">Fechar</button></div></section>`;
      document.body.appendChild(dialog);
      dialog.querySelector('#agendaSharedClose').addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
      dialog.addEventListener('submit', submitComment);
    }
  }

  function openShare(taskId) {
    const task = taskById(taskId);
    if (!task) { toast('Não encontrei essa tarefa para compartilhar.'); return; }
    ensureDialogs();
    selectedTaskId = String(taskId);
    document.getElementById('agendaShareTaskName').textContent = task.text;
    document.getElementById('agendaShareEmail').value = '';
    document.getElementById('agendaShareStatus').textContent = '';
    document.getElementById('agendaShareDialog').showModal();
  }

  async function submitShare(event) {
    event.preventDefault();
    const status = document.getElementById('agendaShareStatus');
    const email = document.getElementById('agendaShareEmail').value.trim().toLowerCase();
    const task = taskById(selectedTaskId);
    if (!task || !email) return;
    status.textContent = 'Compartilhando…';
    try {
      const sb = await getClient();
      const { data: sessionData, error: sessionError } = await sb.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error('Entre novamente na Agenda para compartilhar.');
      const config = cfg();
      const response = await fetch(`${String(config.url).replace(/\/$/, '')}/functions/v1/agenda-share-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: config.publishableKey, Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({ recipientEmail: email, taskId: String(task.id), task: { id: String(task.id), text: task.text, date: task.date, time: task.time || '', tag: task.tag || 'outros', done: Boolean(task.done) } })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'Não foi possível compartilhar agora.');
      document.getElementById('agendaShareDialog').close();
      toast('Tarefa compartilhada.');
    } catch (error) { status.textContent = String(error?.message || error); }
  }

  const dateLabel = value => { try { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`)); } catch (_) { return value || ''; } };
  async function openShared() {
    ensureDialogs();
    const dialog = document.getElementById('agendaSharedDialog');
    const list = document.getElementById('agendaSharedList');
    list.innerHTML = '<p class="share-empty">Carregando…</p>';
    if (!dialog.open) dialog.showModal();
    try {
      const sb = await getClient();
      const { data: userData, error: userError } = await sb.auth.getUser();
      if (userError || !userData.user) throw new Error('Entre novamente na Agenda para ver compartilhamentos.');
      const userId = userData.user.id;
      const { data: shares, error: sharesError } = await sb.from('agenda_task_shares').select('id,owner_user_id,recipient_user_id,task_id,task_payload,updated_at').order('updated_at', { ascending: false });
      if (sharesError) throw sharesError;
      const ids = (shares || []).map(item => item.id);
      let comments = [];
      if (ids.length) {
        const result = await sb.from('agenda_task_comments').select('id,share_id,author_user_id,body,created_at').in('share_id', ids).order('created_at', { ascending: true });
        if (result.error) throw result.error;
        comments = result.data || [];
      }
      if (!(shares || []).length) { list.innerHTML = '<p class="share-empty">Nenhuma tarefa compartilhada ainda.</p>'; return; }
      const byShare = comments.reduce((all, comment) => { (all[comment.share_id] ||= []).push(comment); return all; }, {});
      list.innerHTML = shares.map(share => {
        const task = share.task_payload || {};
        const taskDate = task.date ? ` · ${dateLabel(task.date)}${task.time ? ` às ${escape(task.time)}` : ''}` : '';
        const direction = share.owner_user_id === userId ? 'Você compartilhou' : 'Compartilhada com você';
        const cardComments = (byShare[share.id] || []).map(comment => `<div class="share-comment ${comment.author_user_id === userId ? 'mine' : ''}">${escape(comment.body)}<small>${comment.author_user_id === userId ? 'Você' : 'Outra pessoa'} · ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(comment.created_at))}</small></div>`).join('');
        return `<article class="share-card"><h4>${escape(task.text || 'Tarefa compartilhada')}</h4><p class="share-meta">${direction}${taskDate}</p><div class="share-comments">${cardComments || '<span class="share-meta">Sem comentários ainda.</span>'}</div><form class="share-comment-form" data-share-id="${escape(share.id)}"><input maxlength="1000" required placeholder="Escreva um comentário"><button type="submit">Enviar</button></form></article>`;
      }).join('');
    } catch (error) { list.innerHTML = `<p class="share-empty">${escape(String(error?.message || error))}</p>`; }
  }

  async function submitComment(event) {
    const form = event.target.closest('.share-comment-form');
    if (!form) return;
    event.preventDefault();
    const input = form.querySelector('input');
    const body = input.value.trim();
    if (!body) return;
    try {
      const sb = await getClient();
      const { data: userData, error: userError } = await sb.auth.getUser();
      if (userError || !userData.user) throw new Error('Entre novamente na Agenda para comentar.');
      const { error } = await sb.from('agenda_task_comments').insert({ share_id: form.dataset.shareId, author_user_id: userData.user.id, body });
      if (error) throw error;
      await openShared();
    } catch (error) { toast(String(error?.message || error)); }
  }

  function installButtons() {
    ensureStyles();
    document.querySelectorAll('.task-card .check[data-id]').forEach(check => {
      const footer = check.closest('.task-card')?.querySelector('.task-footer');
      if (!footer || footer.querySelector('.agenda-share')) return;
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'agenda-share'; button.dataset.shareTaskId = check.dataset.id;
      button.setAttribute('aria-label', 'Compartilhar tarefa');
      button.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.4"/><circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="19" r="2.4"/><path d="m8.1 10.8 7.8-4.5M8.1 13.2l7.8 4.5"/></svg>Compartilhar';
      footer.appendChild(button);
    });
    const menu = document.getElementById('quickMenu');
    if (menu && !document.getElementById('agendaSharedBtn')) {
      const button = document.createElement('button');
      button.id = 'agendaSharedBtn'; button.type = 'button';
      button.innerHTML = '<span class="menu-option-icon"><svg viewBox="0 0 24 24"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7" r="4"/><path d="M16 4.5a4 4 0 0 1 0 7.5M22 20v-1.5a4 4 0 0 0-2.8-3.8"/></svg></span>Tarefas compartilhadas';
      menu.appendChild(button);
    }
  }
  document.addEventListener('click', event => {
    const share = event.target.closest('.agenda-share');
    if (share) { event.preventDefault(); openShare(share.dataset.shareTaskId); }
    if (event.target.closest('#agendaSharedBtn')) { event.preventDefault(); openShared(); }
  });
  let frame = 0;
  new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(installButtons); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installButtons);
  else installButtons();
})();
