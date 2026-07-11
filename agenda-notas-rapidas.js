/* =========================================================================
   agenda-notas-rapidas.js
   - Move o botao "Atualizar" para o painel superior (reaproveita #app-update).
   - Adiciona um botao "Nota rapida" (icone de bloco de notas, so contorno) no
     header, no mesmo formato dos demais icones. Abre uma aba onde da pra
     escrever qualquer coisa; as notas ficam registradas por aparelho.
   Enhancement no mesmo padrao dos outros modulos; nao toca no nucleo do app.
   ========================================================================= */
(() => {
  'use strict';
  var NK = 'agenda_notas_rapidas_v1';
  var STYLE_ID = 'notasRapidasStyles';

  var load = function () { try { var v = JSON.parse(localStorage.getItem(NK)); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
  var saveAll = function (a) { try { localStorage.setItem(NK, JSON.stringify(a)); } catch (_) {} };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };
  var uid = function () { return 'nr' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  function fmtWhen(ts) {
    try { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ts)); } catch (_) { return ''; }
  }

  var ICON_NOTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5v4M16 2.5v4"/><rect x="4" y="5" width="16" height="16.5" rx="2.4"/><path d="M8 11h8M8 15h5"/></svg>';
  // religador (recloser): simbolo de chave seccionadora aberta
  var ICON_RECLOSER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12H7M17 12h4.5"/><circle cx="7" cy="12" r="1.6"/><circle cx="17" cy="12" r="1.6"/><path d="M8.4 11.3 16 6.6"/></svg>';
  var EQUIP_URL = 'https://lgrsv.github.io/equipamentos-especiais-v0/';
  var ICON_REFRESH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '#app-update{display:none !important}' + // update agora vive no header
      '#nrDialog{width:min(calc(100% - 28px),480px);max-height:calc(100dvh - 28px);padding:0;border:1px solid var(--line,#2a2d35);border-radius:24px;background:var(--surface,#202228);color:var(--text,#f7f8fb);box-shadow:0 30px 90px rgba(0,0,0,.56)}' +
      '#nrDialog::backdrop{background:rgba(0,0,0,.57);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}' +
      '#nrDialog .nr-modal{padding:19px;display:flex;flex-direction:column;gap:12px;max-height:calc(100dvh - 28px)}' +
      '#nrDialog .nr-top{display:flex;align-items:center;justify-content:space-between;gap:10px}' +
      '#nrDialog h3{margin:0;font-size:20px;letter-spacing:-.03em}' +
      '#nrDialog .nr-x{width:34px;height:34px;flex:0 0 auto;border:1px solid var(--line,#3b404a);border-radius:11px;background:var(--soft,#17181c);color:var(--muted,#a6acb8);font-size:19px;line-height:1;cursor:pointer}' +
      '#nrDialog textarea{width:100%;min-height:84px;padding:11px 12px;border:1px solid var(--line,#3b404a);border-radius:13px;background:var(--soft,#17181c);color:var(--text,#f7f8fb);font:inherit;font-size:16px;line-height:1.45;resize:vertical;outline:0}' +
      '#nrDialog textarea:focus{border-color:var(--accent,#5aa9ff);box-shadow:0 0 0 3px rgba(90,169,255,.2)}' +
      '#nrDialog .nr-save{align-self:flex-end;padding:10px 16px;border:1px solid var(--accent,#5aa9ff);border-radius:12px;background:var(--accent,#5aa9ff);color:var(--accentInk,#04121f);font-size:14px;font-weight:800;cursor:pointer}' +
      '#nrDialog .nr-save:disabled{opacity:.45}' +
      '#nrDialog .nr-list{overflow-y:auto;display:flex;flex-direction:column;gap:9px;padding-right:2px}' +
      '#nrDialog .nr-empty{padding:22px;text-align:center;color:var(--muted,#a6acb8);font-size:13px}' +
      '#nrDialog .nr-item{border:1px solid var(--line,#3b404a);border-radius:14px;background:var(--soft,#17181c);padding:11px 12px}' +
      '#nrDialog .nr-item p{margin:0;white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.45}' +
      '#nrDialog .nr-foot{display:flex;align-items:center;justify-content:space-between;margin-top:8px}' +
      '#nrDialog .nr-when{color:var(--muted,#a6acb8);font-size:11px;font-weight:700}' +
      '#nrDialog .nr-del{border:0;background:transparent;color:var(--muted,#a6acb8);font-size:12px;font-weight:800;cursor:pointer;padding:2px 4px}' +
      '#nrDialog .nr-del:active{color:#ff7f91}';
    document.head.appendChild(s);
  }

  var dlg = null;
  function ensureDialog() {
    if (dlg) return dlg;
    ensureStyles();
    dlg = document.createElement('dialog');
    dlg.id = 'nrDialog';
    dlg.innerHTML =
      '<div class="nr-modal">' +
      '<div class="nr-top"><h3>Notas rápidas</h3><button class="nr-x" type="button" data-close aria-label="Fechar">×</button></div>' +
      '<textarea id="nrText" maxlength="4000" placeholder="Escreva qualquer coisa…"></textarea>' +
      '<button class="nr-save" type="button" data-save disabled>Salvar nota</button>' +
      '<div class="nr-list" id="nrList"></div>' +
      '</div>';
    document.body.appendChild(dlg);
    var ta = dlg.querySelector('#nrText');
    var saveBtn = dlg.querySelector('[data-save]');
    ta.addEventListener('input', function () { saveBtn.disabled = !ta.value.trim(); });
    saveBtn.addEventListener('click', function () {
      var t = ta.value.trim(); if (!t) return;
      var arr = load(); arr.push({ id: uid(), text: t, ts: Date.now() }); saveAll(arr);
      ta.value = ''; saveBtn.disabled = true; renderList();
    });
    dlg.querySelector('[data-close]').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]');
      if (del) { saveAll(load().filter(function (n) { return n.id !== del.dataset.del; })); renderList(); }
    });
    return dlg;
  }

  function renderList() {
    var list = dlg && dlg.querySelector('#nrList'); if (!list) return;
    var arr = load().slice().sort(function (a, b) { return b.ts - a.ts; });
    list.innerHTML = arr.length ? arr.map(function (n) {
      return '<div class="nr-item"><p>' + esc(n.text) + '</p><div class="nr-foot"><span class="nr-when">' + fmtWhen(n.ts) + '</span><button class="nr-del" type="button" data-del="' + esc(n.id) + '">Excluir</button></div></div>';
    }).join('') : '<div class="nr-empty">Nenhuma nota ainda. Escreva algo acima e salve.</div>';
  }

  function openNotes() { ensureDialog(); renderList(); if (!dlg.open) dlg.showModal(); }

  function mkBtn(id, title, icon, onClick) {
    var b = document.createElement('button');
    b.id = id; b.className = 'icon-btn'; b.type = 'button';
    b.title = title; b.setAttribute('aria-label', title);
    b.innerHTML = icon;
    b.addEventListener('click', onClick);
    return b;
  }

  function install() {
    var host = document.querySelector('.head-actions');
    if (!host) return;
    if (!document.getElementById('atualizarBtn')) {
      host.insertBefore(mkBtn('atualizarBtn', 'Atualizar o app', ICON_REFRESH, function () {
        var u = document.getElementById('app-update');
        if (u) u.click(); else location.reload();
      }), host.firstChild);
    }
    if (!document.getElementById('notaRapidaBtn')) {
      host.insertBefore(mkBtn('notaRapidaBtn', 'Notas rápidas', ICON_NOTE, openNotes), host.firstChild);
    }
    if (!document.getElementById('equipamentosBtn')) {
      host.insertBefore(mkBtn('equipamentosBtn', 'Equipamentos Especiais', ICON_RECLOSER, function () {
        window.open(EQUIP_URL, '_blank', 'noopener');
      }), host.firstChild);
    }
  }

  function init() {
    install();
    var frame = 0;
    new MutationObserver(function () { cancelAnimationFrame(frame); frame = requestAnimationFrame(install); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
