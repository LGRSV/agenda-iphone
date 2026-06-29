(() => {
  document.addEventListener('click', event => {
    const edit = event.target.closest('#appleSchedule .as-edit[data-edit]');
    if (!edit) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const id = edit.dataset.edit;
    document.getElementById('appleSchedule')?.classList.remove('open');
    const listTab = [...document.querySelectorAll('.tabs button')].find(button => button.dataset.view === 'list');
    listTab?.click();
    setTimeout(() => {
      const source = [...document.querySelectorAll('#calendarBody [data-edit]')].find(button => button.dataset.edit === id);
      source?.click();
    }, 120);
  }, true);
})();