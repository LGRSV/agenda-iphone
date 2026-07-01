(() => {
  'use strict';

  const TASK_KEY = 'agenda_lagares_v3';
  const DIALOG_ID = 'agendaEditDialog';
  const STYLE_ID = 'agendaEditStyles';
  let editingId = null;

  const TAGS = {
    trabalho: 'Trabalho',
    pessoal: 'Pessoal',
    casa: 'Casa',
    faculdade: 'Faculdade',
    saude: 'Saúde',
    financeiro: 'Financeiro',
    outros: 'Outros'
  };

  function readTasks() {
    try {
      const value = JSON.parse(localStorage.getItem(TASK_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function writeTasks(tasks) {
    localStorage.setItem(TASK_KEY, JSON.stringify(tasks));
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .task-card.edit-enabled { grid-template-columns: 25px minmax(0, 1fr) 31px 31px; }
      .agenda-edit { padding: 2px; border: 0; border-radius: 8px; background: transparent; color: var(--faint); font-size: 17px; line-height: 1; }
      .agenda-edit:active { background: var(--soft2); color: var(--accent); transform: scale(.96); }
      #${DIALOG_ID} { width: min(calc(100% - 32px), 480px); max-height: calc(100dvh - 32px); padding: 0; border: 1px solid var(--line); border-radius: 24px; background: var(--surface); color: var(--text); box-shadow: 0 30px 90px rgba(0,0,0,.56); }
      #${DIALOG_ID}::backdrop { background: rgba(0,0,0,.57); backdrop-filter: blur(3px); }
      #${DIALOG_ID} .agenda-edit-modal { padding: 21px; }
      #${DIALOG_ID} h3 { margin: 0 0 10px; font-size: 22px; letter-spacing: -.045em; }
      #${DIALOG_ID} .edit-copy { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.45; }
      #${DIALOG_ID} label { display: block; margin: 13px 0 7px; color: var(--muted); font-size: 11px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
      #${DIALOG_ID} input, #${DIALOG_ID} select { width: 100%; min-height: 46px; padding: 11px 12px; border: 1px solid var(--line); border-radius: 13px; outline: 0; background: var(--soft); color: var(--text); font-size: 16px; }
      #${DIALOG_ID} input:focus, #${DIALOG_ID} select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(117,203,255,.2); }
      #${DIALOG_ID} .edit-two-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      #${DIALOG_ID} .edit-actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 21px; }
      #${DIALOG_ID} .edit-secondary, #${DIALOG_ID} .edit-primary { padding: 11px 15px; border-radius: 13px; font-size: 14px; font-weight: 750; }
      #${DIALOG_ID} .edit-secondary { border: 1px solid var(--line); background: var(--soft); color: var(--text); }
      #${DIALOG_ID} .edit-primary { border: 1px solid var(--accent); background: var(--accent); color: var(--accentInk); }
    `;
    document.head.appendChild(style);
  }

  function ensureDialog() {
    let dialog = document.getElementById(DIALOG_ID);
    if (dialog) return dialog;

    dialog = document.createElement('dialog');
    dialog.id = DIALOG_ID;
    dialog.innerHTML = `
      <form class="agenda-edit-modal" id="agendaEditForm">
        <h3>Editar tarefa</h3>
        <p class="edit-copy">Altere o que precisar, inclusive a data para reagendar.</p>
        <label for="agendaEditText">Tarefa</label>
        <input id="agendaEditText" type="text" maxlength="240" autocomplete="off" required>
        <div class="edit-two-fields">
          <div>
            <label for="agendaEditDate">Data</label>
            <input id="agendaEditDate" type="date" required>
          </div>
          <div>
            <label for="agendaEditTime">Horário</label>
            <input id="agendaEditTime" type="time">
          </div>
        </div>
        <label for="agendaEditTag">Tag</label>
        <select id="agendaEditTag">
          <option value="trabalho">Trabalho</option>
          <option value="pessoal">Pessoal</option>
          <option value="casa">Casa</option>
          <option value="faculdade">Faculdade</option>
          <option value="saude">Saúde</option>
          <option value="financeiro">Financeiro</option>
          <option value="outros">Outros</option>
        </select>
        <label for="agendaEditReminder">Lembrete</label>
        <select id="agendaEditReminder">
          <option value="-1">Sem alerta</option>
          <option value="0">No horário</option>
          <option value="5">5 minutos antes</option>
          <option value="10">10 minutos antes</option>
          <option value="15">15 minutos antes</option>
          <option value="30">30 minutos antes</option>
          <option value="60">1 hora antes</option>
        </select>
        <div class="edit-actions">
          <button class="edit-secondary" id="agendaEditCancel" type="button">Cancelar</button>
          <button class="edit-primary" type="submit">Salvar alterações</button>
        </div>
      </form>
    `;
    document.body.appendChild(dialog);

    dialog.querySelector('#agendaEditCancel').addEventListener('click', () => dialog.close());
    dialog.querySelector('#agendaEditForm').addEventListener('submit', event => {
      event.preventDefault();
      if (!editingId) return;

      const text = dialog.querySelector('#agendaEditText').value.trim();
      const date = dialog.querySelector('#agendaEditDate').value;
      const time = dialog.querySelector('#agendaEditTime').value;
      const tag = dialog.querySelector('#agendaEditTag').value;
      const reminder = time ? Number(dialog.querySelector('#agendaEditReminder').value) : -1;
      if (!text || !date) return;

      const tasks = readTasks();
      const task = tasks.find(item => String(item.id) === String(editingId));
      if (!task) {
        dialog.close();
        return;
      }

      task.text = text;
      task.date = date;
      task.time = time;
      task.tag = Object.prototype.hasOwnProperty.call(TAGS, tag) ? tag : 'outros';
      task.reminder = Number.isFinite(reminder) ? reminder : -1;
      writeTasks(tasks);
      sessionStorage.setItem('agenda_lagares_edit_message', 'Tarefa atualizada e reagendada.');
      dialog.close();
      window.location.reload();
    });

    return dialog;
  }

  function openEditor(taskId) {
    const task = readTasks().find(item => String(item.id) === String(taskId));
    if (!task) return;
    editingId = task.id;
    const dialog = ensureDialog();
    dialog.querySelector('#agendaEditText').value = task.text || '';
    dialog.querySelector('#agendaEditDate').value = task.date || '';
    dialog.querySelector('#agendaEditTime').value = /^\d{2}:\d{2}$/.test(task.time || '') ? task.time : '';
    dialog.querySelector('#agendaEditTag').value = Object.prototype.hasOwnProperty.call(TAGS, task.tag) ? task.tag : 'outros';
    const reminder = Number(task.reminder);
    dialog.querySelector('#agendaEditReminder').value = [-1, 0, 5, 10, 15, 30, 60].includes(reminder) ? String(reminder) : '-1';
    dialog.showModal();
    setTimeout(() => dialog.querySelector('#agendaEditText').focus(), 60);
  }

  function installButtons() {
    document.querySelectorAll('.task-card').forEach(card => {
      const checkbox = card.querySelector('.check[data-id]');
      const deleteButton = card.querySelector('.delete');
      if (!checkbox || !deleteButton || card.querySelector('.agenda-edit')) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'agenda-edit';
      button.dataset.editId = checkbox.dataset.id;
      button.setAttribute('aria-label', 'Editar ou reagendar tarefa');
      button.title = 'Editar ou reagendar';
      button.textContent = '✎';
      card.classList.add('edit-enabled');
      deleteButton.before(button);
    });
  }

  function init() {
    ensureStyles();
    ensureDialog();
    installButtons();

    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(installButtons);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('click', event => {
      const button = event.target.closest('.agenda-edit');
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openEditor(button.dataset.editId);
    }, true);

    const message = sessionStorage.getItem('agenda_lagares_edit_message');
    if (message) {
      sessionStorage.removeItem('agenda_lagares_edit_message');
      setTimeout(() => {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2400);
      }, 160);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
