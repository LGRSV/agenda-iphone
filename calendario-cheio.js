/* =========================================================================
   calendario-cheio.js — visão de mês em tela cheia (estilo Calendário iOS).
   - Botão de expandir (setas diagonais) no header da agenda.
   - Abre um overlay preto com o mês inteiro: chips azuis (com hora) e chips
     com anel laranja (sem hora / lembrete), como no app de calendário.
   - Animação: um quadradinho surge no centro e cresce até a tela toda;
     ao voltar, faz a animação contrária.
   Enhancement independente; lê as tarefas do localStorage, não toca no núcleo.
   ========================================================================= */
(() => {
  'use strict';
  var STYLE_ID = 'calFullStyles', OV_ID = 'calFull';
  var esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  var WD = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  var MN = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  var pd = x => String(x).padStart(2, '0');
  var dstr = d => d.getFullYear() + '-' + pd(d.getMonth() + 1) + '-' + pd(d.getDate());
  function tasks() { try { var a = JSON.parse(localStorage.getItem('agenda_lagares_v3') || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
  var cur = null, ov = null;

  var ICON_EXPAND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/></svg>';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style'); s.id = STYLE_ID;
    s.textContent = [
      '#' + OV_ID + '{position:fixed;inset:0;z-index:6000;background:#000;color:#fff;display:flex;flex-direction:column;transform:scale(.16);opacity:0;transform-origin:center center;transition:transform .28s cubic-bezier(.2,.85,.25,1),opacity .2s ease;border-radius:30px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Roboto,sans-serif}',
      '#' + OV_ID + '.open{transform:scale(1);opacity:1;border-radius:0}',
      '#' + OV_ID + ' .cf-head{display:flex;align-items:center;justify-content:space-between;padding:calc(10px + env(safe-area-inset-top)) 16px 4px}',
      '#' + OV_ID + ' .cf-back{display:inline-flex;align-items:center;gap:3px;background:rgba(255,255,255,.09);border:0;color:#fff;font-size:15px;font-weight:700;padding:8px 15px 8px 11px;border-radius:999px;cursor:pointer}',
      '#' + OV_ID + ' .cf-back:active{transform:scale(.96)}',
      '#' + OV_ID + ' .cf-nav{display:flex;gap:6px}',
      '#' + OV_ID + ' .cf-nav button{width:38px;height:38px;border:0;border-radius:12px;background:rgba(255,255,255,.09);color:#fff;font-size:20px;line-height:1;cursor:pointer}',
      '#' + OV_ID + ' .cf-title{padding:2px 18px 8px;display:flex;align-items:baseline;gap:9px}',
      '#' + OV_ID + ' .cf-title h1{margin:0;font-size:34px;letter-spacing:-.03em}',
      '#' + OV_ID + ' .cf-title span{color:#8a8a8e;font-size:15px;font-weight:700}',
      '#' + OV_ID + ' .cf-wd{display:grid;grid-template-columns:repeat(7,1fr);padding:5px 8px;border-bottom:1px solid rgba(255,255,255,.14)}',
      '#' + OV_ID + ' .cf-wd span{text-align:center;color:#8a8a8e;font-size:11px;font-weight:800}',
      '#' + OV_ID + ' .cf-grid{flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:minmax(96px,auto);-webkit-overflow-scrolling:touch}',
      '#' + OV_ID + ' .cf-cell{border-right:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06);padding:4px 3px;min-width:0;display:flex;flex-direction:column;gap:2px}',
      '#' + OV_ID + ' .cf-cell:nth-child(7n){border-right:0}',
      '#' + OV_ID + ' .cf-dn{font-size:15px;font-weight:800;text-align:center;color:#fff;margin-bottom:1px}',
      '#' + OV_ID + ' .cf-cell.out .cf-dn{color:#48484a}',
      '#' + OV_ID + ' .cf-cell.today .cf-dn{color:#ff453a}',
      '#' + OV_ID + ' .cf-ev{font-size:8.5px;line-height:1.18;border-radius:4px;padding:2px 4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
      '#' + OV_ID + ' .cf-ev.timed{background:rgba(40,95,160,.55);color:#eaf2fb;font-weight:700}',
      '#' + OV_ID + ' .cf-ev.timed b{display:block;color:#8fbdf0;font-weight:600;font-size:8px}',
      '#' + OV_ID + ' .cf-ev.allday{background:rgba(255,255,255,.1);color:#fff;font-weight:700;display:flex;align-items:center;gap:3px}',
      '#' + OV_ID + ' .cf-ev .dot{width:7px;height:7px;flex:0 0 auto;border-radius:50%;border:1.6px solid #ff9f0a}',
      '#' + OV_ID + ' .cf-ev.done{opacity:.4;text-decoration:line-through}',
      '#' + OV_ID + ' .cf-more{font-size:8px;color:#8a8a8e;font-weight:800;padding-left:3px}',
      '#' + OV_ID + ' .cf-foot{display:flex;justify-content:center;padding:8px 0 calc(10px + env(safe-area-inset-bottom))}',
      '#' + OV_ID + ' .cf-today{background:rgba(255,255,255,.1);border:0;color:#fff;font-size:15px;font-weight:800;padding:9px 22px;border-radius:999px;cursor:pointer}'
    ].join('');
    document.head.appendChild(s);
  }

  function render() {
    if (!ov) return;
    ov.querySelector('#cfMonth').textContent = MN[cur.getMonth()];
    ov.querySelector('#cfYear').textContent = cur.getFullYear();
    var y = cur.getFullYear(), m = cur.getMonth();
    var first = new Date(y, m, 1);
    var start = new Date(y, m, 1 - first.getDay());
    var byDate = {}; tasks().forEach(function (t) { if (!t || !t.date) return; (byDate[t.date] = byDate[t.date] || []).push(t); });
    var todayS = dstr(new Date()), cells = '';
    for (var i = 0; i < 42; i++) {
      var d = new Date(start); d.setDate(start.getDate() + i);
      var ds = dstr(d), out = d.getMonth() !== m, isT = ds === todayS;
      var list = (byDate[ds] || []).slice().sort(function (a, b) { return (a.time || '~').localeCompare(b.time || '~'); });
      var evs = list.slice(0, 3).map(function (t) {
        var done = t.done ? ' done' : '';
        if (/^\d{2}:\d{2}$/.test(t.time || '')) return '<div class="cf-ev timed' + done + '">' + esc(t.text) + '<b>' + t.time + '</b></div>';
        return '<div class="cf-ev allday' + done + '"><span class="dot"></span>' + esc(t.text) + '</div>';
      }).join('');
      if (list.length > 3) evs += '<div class="cf-more">+' + (list.length - 3) + '</div>';
      cells += '<div class="cf-cell' + (out ? ' out' : '') + (isT ? ' today' : '') + '"><div class="cf-dn">' + d.getDate() + '</div>' + evs + '</div>';
    }
    ov.querySelector('#cfGrid').innerHTML = cells;
  }

  function openCal() {
    ensureStyles();
    if (ov) return;
    cur = new Date();
    ov = document.createElement('div'); ov.id = OV_ID;
    ov.innerHTML =
      '<div class="cf-head"><button class="cf-back" data-back>‹ Voltar</button><div class="cf-nav"><button type="button" data-mv="-1">‹</button><button type="button" data-mv="1">›</button></div></div>' +
      '<div class="cf-title"><h1 id="cfMonth"></h1><span id="cfYear"></span></div>' +
      '<div class="cf-wd">' + WD.map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>' +
      '<div class="cf-grid" id="cfGrid"></div>' +
      '<div class="cf-foot"><button class="cf-today" type="button" data-today>Hoje</button></div>';
    document.body.appendChild(ov);
    render();
    ov.addEventListener('click', function (e) {
      if (e.target.closest('[data-back]')) { closeCal(); return; }
      var mv = e.target.closest('[data-mv]'); if (mv) { cur = new Date(cur.getFullYear(), cur.getMonth() + Number(mv.dataset.mv), 1); render(); return; }
      if (e.target.closest('[data-today]')) { cur = new Date(); render(); }
    });
    // dois quadros para garantir a pintura do estado inicial antes de animar
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (ov) ov.classList.add('open'); }); });
  }

  function closeCal() {
    if (!ov) return;
    ov.classList.remove('open');
    var el = ov; ov = null;
    setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 320);
  }

  function install() {
    var b = document.getElementById('calFullBtn');
    if (!b || b.dataset.calFullBound) return;
    b.dataset.calFullBound = '1';
    b.addEventListener('click', openCal);
  }

  function init() {
    install();
    var frame = 0;
    new MutationObserver(function () { cancelAnimationFrame(frame); frame = requestAnimationFrame(install); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
