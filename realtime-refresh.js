/*
  Realtime Refresh
  Mantém a Agenda Lagares reativa: mudanças no localStorage e ações da AgendaAPI
  disparam atualização visual, reclassificação de pendências e sincronização entre abas.
*/
(() => {
  'use strict';

  const TASK_KEY = 'agenda_lagares_v3';
  const NOTES_KEY = 'agenda_notas_v1';
  const RULES_KEY = 'agenda_regras_v1';
  const EVENT_NAME = 'agenda:datachange';
  const CHANNEL_NAME = 'agenda-lagares-realtime';
  const WATCHED_KEYS = new Set([TASK_KEY, NOTES_KEY, RULES_KEY]);
  const state = { timer: 0, lastPayload: '', channel: null };

  const safeJson = value => {
    try { return JSON.parse(value || '[]'); } catch (_) { return []; }
  };

  const readTasks = () => {
    const list = safeJson(localStorage.getItem(TASK_KEY));
    return Array.isArray(list) ? list : [];
  };

  const todayIso = () => {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };

  const isTreino = task => /^(🏋️?|treino\b)/i.test(String(task?.text || '').trim());

  const snapshot = () => {
    const today = todayIso();
    const tasks = readTasks().filter(t => t && !t.done);
    const normal = tasks.filter(t => !isTreino(t));
    const treinos = tasks.filter(isTreino);
    const group = list => ({
      atrasadas: list.filter(t => t.date && t.date < today).length,
      hoje: list.filter(t => t.date === today).length,
      futuras: list.filter(t => t.date && t.date > today).length,
      semData: list.filter(t => !t.date).length
    });
    return { today, normal: group(normal), treinos: group(treinos), total: tasks.length };
  };

  const refreshSummaryText = snap => {
    const msg = document.querySelector('.summary-message');
    if (!msg) return;
    const parts = [];
    if (snap.normal.atrasadas) parts.push(`${snap.normal.atrasadas} atrasada${snap.normal.atrasadas > 1 ? 's' : ''}`);
    if (snap.normal.hoje) parts.push(`${snap.normal.hoje} para hoje`);
    if (snap.normal.futuras) parts.push(`${snap.normal.futuras} futura${snap.normal.futuras > 1 ? 's' : ''}`);
    if (snap.treinos.atrasadas || snap.treinos.hoje) {
      const t = [];
      if (snap.treinos.atrasadas) t.push(`${snap.treinos.atrasadas} treino${snap.treinos.atrasadas > 1 ? 's' : ''} atrasado${snap.treinos.atrasadas > 1 ? 's' : ''}`);
      if (snap.treinos.hoje) t.push(`${snap.treinos.hoje} treino hoje`);
      parts.push(t.join(' + '));
    }
    if (parts.length) msg.textContent = `Pendências: ${parts.join(' · ')}.`;
  };

  const emit = (detail = {}) => {
    const snap = snapshot();
    const payload = JSON.stringify({ snap, detail });
    state.lastPayload = payload;
    document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { ...detail, snapshot: snap } }));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { ...detail, snapshot: snap } }));
    try { state.channel?.postMessage({ type: EVENT_NAME, payload }); } catch (_) {}
  };

  const schedule = (detail = {}) => {
    clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      refreshSummaryText(snapshot());
      emit(detail);
    }, 60);
  };

  const patchStorage = () => {
    if (localStorage.__agendaRealtimePatched) return;
    const setItem = Storage.prototype.setItem;
    const removeItem = Storage.prototype.removeItem;
    const clear = Storage.prototype.clear;

    Storage.prototype.setItem = function patchedSetItem(key, value) {
      const before = this.getItem(key);
      const result = setItem.apply(this, arguments);
      if (this === localStorage && WATCHED_KEYS.has(String(key)) && before !== String(value)) schedule({ source: 'localStorage.setItem', key });
      return result;
    };

    Storage.prototype.removeItem = function patchedRemoveItem(key) {
      const had = this.getItem(key) !== null;
      const result = removeItem.apply(this, arguments);
      if (this === localStorage && WATCHED_KEYS.has(String(key)) && had) schedule({ source: 'localStorage.removeItem', key });
      return result;
    };

    Storage.prototype.clear = function patchedClear() {
      const hadWatched = [...WATCHED_KEYS].some(key => this.getItem(key) !== null);
      const result = clear.apply(this, arguments);
      if (this === localStorage && hadWatched) schedule({ source: 'localStorage.clear' });
      return result;
    };

    Object.defineProperty(localStorage, '__agendaRealtimePatched', { value: true });
  };

  const patchAgendaApi = () => {
    const api = window.AgendaAPI;
    if (!api || api.__realtimeWrapped) return false;

    ['addTask', 'completeTask', 'deleteTask'].forEach(name => {
      if (typeof api[name] !== 'function') return;
      const original = api[name].bind(api);
      api[name] = (...args) => {
        const result = original(...args);
        schedule({ source: `AgendaAPI.${name}` });
        return result;
      };
    });

    api.refreshRealtime = () => schedule({ source: 'AgendaAPI.refreshRealtime' });
    api.__realtimeWrapped = true;
    return true;
  };

  const installChannel = () => {
    if (!('BroadcastChannel' in window)) return;
    try {
      state.channel = new BroadcastChannel(CHANNEL_NAME);
      state.channel.onmessage = event => {
        if (!event?.data || event.data.type !== EVENT_NAME) return;
        if (event.data.payload === state.lastPayload) return;
        refreshSummaryText(snapshot());
        document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { source: 'BroadcastChannel' } }));
      };
    } catch (_) {}
  };

  const installMinuteTicker = () => {
    // Reclassifica quando o relógio muda: uma tarefa futura de hoje pode virar "horário passado" sem clique algum.
    setInterval(() => schedule({ source: 'clock' }), 60000);
  };

  const installObservers = () => {
    window.addEventListener('storage', event => {
      if (WATCHED_KEYS.has(event.key)) schedule({ source: 'storage', key: event.key });
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) schedule({ source: 'visibilitychange' });
    });
  };

  const init = () => {
    patchStorage();
    installChannel();
    installObservers();
    installMinuteTicker();

    if (!patchAgendaApi()) {
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        if (patchAgendaApi() || attempts > 40) clearInterval(timer);
      }, 250);
    }

    schedule({ source: 'init' });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
