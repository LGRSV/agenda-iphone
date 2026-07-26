(() => {
  'use strict';

  const TASKS_KEY = 'agenda_lagares_v3';
  const NOTES_KEY = 'agenda_notas_v1';
  const ACCOUNTS_KEY = 'agenda_contas_v1';
  const read = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key) || ''); return value == null ? fallback : value; } catch (_) { return fallback; } };
  const amount = value => { const parsed = Number(String(value ?? '').replace(',', '.')); return Number.isFinite(parsed) ? parsed : 0; };
  const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value || 0);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const query = new URLSearchParams(location.search);
  const today = new Date();
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,'0')}`;
  const selectedKey = /^\d{4}-\d{2}$/.test(query.get('mes') || '') ? query.get('mes') : currentKey;
  const kind = (task, note) => note.movimento || (/cobrar|sal[aá]rio|receber/i.test(task.text || '') ? 'entrada' : /mesada|mayara/i.test(task.text || '') ? 'saida' : amount(note.valor) > 0 ? 'entrada' : 'sem valor');
  const sameMonth = task => String(task.date || '').startsWith(selectedKey);
  const displayDate = task => { const parts = String(task.date || '').split('-'); return parts.length === 3 ? `${parts[2]}/${parts[1]}${task.time ? ` · ${task.time}` : ''}` : ''; };
  const isFernanda = task => /fernanda/i.test(task.text || '');

  function rows(items, direction, empty) {
    if (!items.length) return `<div class="empty">${empty}</div>`;
    return items.sort((a,b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`)).map(item =>
      `<article class="row"><i class="dot ${direction === 'minus' ? 'minus' : ''}"></i><div><div class="title">${esc(item.text)}</div><div class="meta">${displayDate(item)}${item.n.conta === 'nb' ? ' · Nubank' : item.n.conta === 'mp' ? ' · Mercado Pago' : ''}</div></div><strong class="value ${direction === 'minus' ? 'minus' : 'plus'}">${direction === 'minus' ? '− ' : '+ '}${money(amount(item.n.valor))}</strong></article>`
    ).join('');
  }

  function render() {
    const notes = read(NOTES_KEY, {});
    const all = read(TASKS_KEY, []).filter(task => task?.text && sameMonth(task)).map(task => ({...task,n:notes[task.id] || {}}));
    const received = all.filter(task => kind(task,task.n) === 'entrada' && task.done && amount(task.n.valor) > 0);
    const expected = all.filter(task => kind(task,task.n) === 'entrada' && !task.done && !isFernanda(task) && amount(task.n.valor) > 0);
    const scheduled = all.filter(task => kind(task,task.n) === 'saida' && !task.done && task.n.programada && amount(task.n.valor) > 0 && ['pix','dinheiro'].includes(task.n.forma));
    const accounts = read(ACCOUNTS_KEY, {});
    const actual = selectedKey === currentKey ? amount(accounts.mp) + amount(accounts.nb) : 0;
    const plus = expected.reduce((sum,item) => sum + amount(item.n.valor),0);
    const minus = scheduled.reduce((sum,item) => sum + amount(item.n.valor),0);
    const forecast = actual + plus - minus;
    const [year, month] = selectedKey.split('-').map(Number);
    document.querySelector('#month').textContent = new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(year,month - 1,1));
    document.querySelector('#total').textContent = money(forecast);
    document.querySelector('#formula').innerHTML = `<span>Saldo atual em conta</span><span>${money(actual)}</span><span class="plus">Entradas pendentes</span><span class="plus">+ ${money(plus)}</span><span class="minus">Saídas programadas</span><span class="minus">− ${money(minus)}</span>`;
    document.querySelector('#received').innerHTML = rows(received,'plus','Nenhuma entrada recebida neste mês.');
    document.querySelector('#expected').innerHTML = rows(expected,'plus','Nenhuma entrada pendente neste mês.');
    document.querySelector('#scheduled').innerHTML = rows(scheduled,'minus','Nenhuma saída programada neste mês.');
  }

  window.addEventListener('agenda:remote-sync', render);
  window.addEventListener('storage', event => { if ([TASKS_KEY,NOTES_KEY,ACCOUNTS_KEY].includes(event.key)) render(); });
  render();
})();
