/* =========================================================================
   undo.js — desfazer a última alteração (tarefas / anotações / recorrências).
   Botão de setinha (contorno azul) na barra superior. Guarda um histórico
   das mudanças no localStorage e restaura o estado anterior num toque —
   pensado para recuperar descrições/subtarefas apagadas sem querer.
   Enhancement autossuficiente, no mesmo padrão dos outros módulos.
   ========================================================================= */
(() => {
  'use strict';

  // chaves cujas mudanças queremos poder desfazer
  const TRACK = ['agenda_lagares_v3', 'agenda_notas_v1', 'agenda_lagares_rules_v1'];
  const STACK_KEY = 'agenda_undo_v1';        // histórico (não é rastreado)
  const FLASH_KEY = 'agenda_undo_flash';     // aviso após o reload
  const MAX = 25;                            // passos guardados
  const COLLAPSE_MS = 900;                   // agrupa gravações do mesmo "salvar"
  const ARM_MS = 1200;                       // ignora gravações da inicialização

  const origSet = localStorage.setItem.bind(localStorage);
  const origGet = localStorage.getItem.bind(localStorage);
  const startAt = Date.now();
  let lastKey = null, lastTime = 0; // apenas em memória (zera a cada carga)

  function readStack() { try { const v = JSON.parse(origGet(STACK_KEY)); return Array.isArray(v) ? v : []; } catch (_) { return []; } }
  function writeStack(s) { try { origSet(STACK_KEY, JSON.stringify(s.slice(-MAX))); } catch (_) {} }

  // --- captura das alterações: intercepta os setItem das chaves rastreadas ---
  let suppress = false; // true enquanto restauramos, p/ não registrar o próprio undo
  localStorage.setItem = function (key, value) {
    if (!suppress && TRACK.indexOf(key) !== -1) {
      try {
        const now = Date.now();
        const prev = origGet(key);
        // ignora as gravações automáticas logo após carregar (normalise, restore...)
        if (prev !== value && (now - startAt) > ARM_MS) {
          // agrupa gravações rápidas da MESMA chave (um único "salvar"); só em memória,
          // então nunca colapsa através de um reload
          const collapse = key === lastKey && (now - lastTime) < COLLAPSE_MS;
          lastKey = key; lastTime = now;
          if (!collapse) {
            const stack = readStack();
            stack.push({ key: key, prev: prev });
            writeStack(stack);
            refreshButton();
          }
        } else { lastKey = key; lastTime = now; }
      } catch (_) {}
    }
    return origSet(key, value);
  };

  function canUndo() { return readStack().length > 0; }

  function doUndo() {
    const stack = readStack();
    const entry = stack.pop();
    if (!entry) return;
    writeStack(stack);
    suppress = true;
    try {
      if (entry.prev === null || entry.prev === undefined) localStorage.removeItem(entry.key);
      else origSet(entry.key, entry.prev);
    } catch (_) {}
    suppress = false;
    try { sessionStorage.setItem(FLASH_KEY, '1'); } catch (_) {}
    location.reload();
  }

  // --- interface -------------------------------------------------------
  const UNDO_SVG =
    '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>';

  function ensureStyles() {
    if (document.getElementById('undoStyles')) return;
    const s = document.createElement('style');
    s.id = 'undoStyles';
    s.textContent = `
      #undoBtn{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 45%,var(--line))}
      #undoBtn[hidden]{display:none}
      #undoBtn:active{transform:scale(.94)}
    `;
    document.head.appendChild(s);
  }

  let btn = null;
  function ensureButton() {
    const actions = document.querySelector('.head-actions');
    if (!actions) return;
    if (!document.getElementById('undoBtn')) {
      btn = document.createElement('button');
      btn.id = 'undoBtn';
      btn.className = 'icon-btn';
      btn.type = 'button';
      btn.title = 'Desfazer última alteração';
      btn.setAttribute('aria-label', 'Desfazer última alteração');
      btn.innerHTML = UNDO_SVG;
      actions.insertBefore(btn, actions.firstChild);
      btn.addEventListener('click', doUndo);
    }
    refreshButton();
  }

  function refreshButton() {
    const b = document.getElementById('undoBtn');
    if (b) b.hidden = !canUndo();
  }

  function toast(msg) {
    const t = document.querySelector('.toast');
    if (t) { t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2600); }
  }

  function init() {
    ensureStyles();
    ensureButton();
    let frame = 0;
    new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(ensureButton); })
      .observe(document.body, { childList: true, subtree: true });
    try {
      if (sessionStorage.getItem(FLASH_KEY)) {
        sessionStorage.removeItem(FLASH_KEY);
        setTimeout(() => toast('Alteração desfeita ↩'), 400);
      }
    } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
