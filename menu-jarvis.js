/* menu-jarvis.js — um botão só (o do Jarvis, embaixo à esquerda) abre um menu suspenso com
   Conversar (painel do Jarvis), Falar (microfone, de acessos.js), Cardio (de treino.js) e
   Nova tarefa. Toque longo no botão abre direto a conversa.
   Animação só com transform/opacity (CSS em index.html, bloco JARVIS); transições CSS
   revertem do ponto em que estão, então tocar de novo no meio inverte sem travar. */
(() => {
  'use strict';
  const doc = document, $ = id => doc.getElementById(id);
  const btn = $('jarvis-btn'), menu = $('jarvisMenu'), veu = $('jarvisVeu'), painel = $('jarvis-panel');
  if (!btn || !menu || !veu) return;

  // de cima para baixo; o mais perto do polegar (Nova tarefa) fica embaixo, junto do botão
  const ORDEM = ['jarvisConversar', 'vozFab', 'cardioFab', 'openDialog'];
  const ROTULO = { jarvisConversar: 'Conversar', vozFab: 'Falar', cardioFab: 'Cardio', openDialog: 'Nova tarefa' };
  let aberto = false, tAnim = 0, y0 = 0, obsDialogo = null, longo = false, tLongo = 0, px = 0, py = 0;

  // botões criados por outros scripts chegam só com o ícone: ganham papel de item, ícone em círculo e rótulo
  function adotar(el) {
    if (el.dataset.jm) return;
    el.dataset.jm = '1';
    el.classList.add('jm-item');
    el.setAttribute('role', 'menuitem');
    el.tabIndex = -1;
    el.removeAttribute('title');
    if (!el.querySelector('.jm-ico')) {
      const ico = doc.createElement('span');
      ico.className = 'jm-ico'; ico.setAttribute('aria-hidden', 'true');
      while (el.firstChild) ico.appendChild(el.firstChild);
      el.appendChild(ico);
    }
    if (!el.querySelector('.jm-rot')) {
      const r = doc.createElement('span');
      r.className = 'jm-rot'; r.textContent = ROTULO[el.id] || el.getAttribute('aria-label') || '';
      el.appendChild(r);
    }
  }
  const itens = () => [...menu.children].filter(e => e.tagName === 'BUTTON')
    .sort((a, b) => ordem(a) - ordem(b));
  const ordem = e => { const i = ORDEM.indexOf(e.id); return i < 0 ? -1 : i; };
  function arrumar() {
    const l = itens(), n = l.length;
    l.forEach((el, k) => {
      adotar(el);
      el.style.order = k;
      el.style.setProperty('--i', n - 1 - k); // abre de baixo para cima
      el.style.setProperty('--r', k);         // fecha de cima para baixo
    });
  }
  arrumar();
  new MutationObserver(arrumar).observe(menu, { childList: true });

  function animando() {
    menu.classList.add('jm-anim');
    clearTimeout(tAnim);
    tAnim = setTimeout(() => menu.classList.remove('jm-anim'), 480);
  }
  const painelAberto = () => !!(painel && painel.classList.contains('open'));
  function estadoBotao() {
    const on = aberto || painelAberto();
    btn.classList.toggle('jm-on', on);
    btn.setAttribute('aria-expanded', String(aberto));
    btn.setAttribute('aria-label', aberto ? 'Fechar menu do Jarvis' : painelAberto() ? 'Fechar o Jarvis' : 'Jarvis: abrir menu');
  }
  if (painel) new MutationObserver(estadoBotao).observe(painel, { attributes: true, attributeFilter: ['class'] });

  function abrir(teclado) {
    if (aberto) return;
    aberto = true; y0 = scrollY;
    animando();
    menu.classList.add('jm-on'); veu.classList.add('jm-on');
    menu.setAttribute('aria-hidden', 'false');
    estadoBotao();
    doc.addEventListener('keydown', tecla, true);
    addEventListener('scroll', rolou, { passive: true });
    // qualquer janela (dialog) que abrir fecha o menu
    obsDialogo = new MutationObserver(ms => { if (ms.some(m => m.target.tagName === 'DIALOG' && m.target.open)) fechar(false); });
    obsDialogo.observe(doc.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
    if (teclado) { const l = itens(); if (l.length) l[0].focus(); }
  }
  function fechar(foco) {
    if (!aberto) return;
    aberto = false;
    animando();
    menu.classList.remove('jm-on'); veu.classList.remove('jm-on');
    menu.setAttribute('aria-hidden', 'true');
    estadoBotao();
    doc.removeEventListener('keydown', tecla, true);
    removeEventListener('scroll', rolou);
    if (obsDialogo) { obsDialogo.disconnect(); obsDialogo = null; }
    if (foco || menu.contains(doc.activeElement)) btn.focus({ preventScroll: true });
  }
  const rolou = () => { if (Math.abs(scrollY - y0) > 8) fechar(false); };

  // teclado: Esc fecha; setas andam entre os itens; Tab fica preso entre os itens e o botão
  function tecla(e) {
    if (e.key === 'Escape') { e.preventDefault(); fechar(true); return; }
    const passo = (l, i, volta) => i < 0 ? (volta ? l.length - 1 : 0) : (i + (volta ? l.length - 1 : 1)) % l.length;
    if (e.key === 'Tab') {
      const l = itens().concat(btn);
      e.preventDefault();
      l[passo(l, l.indexOf(doc.activeElement), e.shiftKey)].focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const l = itens();
      if (!l.length) return;
      e.preventDefault();
      l[passo(l, l.indexOf(doc.activeElement), e.key === 'ArrowUp')].focus();
    }
  }

  // toque longo no botão: abre direto a conversa
  btn.addEventListener('pointerdown', e => {
    longo = false; px = e.clientX; py = e.clientY;
    clearTimeout(tLongo);
    tLongo = setTimeout(() => {
      longo = true;
      fechar(false);
      if (window.JarvisPainel) window.JarvisPainel.abrir();
    }, 480);
  });
  const soltar = () => clearTimeout(tLongo);
  btn.addEventListener('pointerup', soltar);
  btn.addEventListener('pointercancel', soltar);
  btn.addEventListener('pointerleave', soltar);
  btn.addEventListener('pointermove', e => { if (Math.abs(e.clientX - px) > 10 || Math.abs(e.clientY - py) > 10) soltar(); });
  btn.addEventListener('contextmenu', e => e.preventDefault());

  btn.addEventListener('click', e => {
    if (longo) { longo = false; return; }
    if (painelAberto()) { window.JarvisPainel && window.JarvisPainel.fechar(); return; }
    if (aberto) fechar(e.detail === 0); else abrir(e.detail === 0);
  });
  veu.addEventListener('click', () => fechar(false));
  // escolher um item fecha o menu (o próprio item já fez a sua ação)
  menu.addEventListener('click', e => { if (e.target.closest && e.target.closest('.jm-item')) fechar(false); });
  $('jarvisConversar').addEventListener('click', () => { if (window.JarvisPainel) window.JarvisPainel.abrir(); });

  window.JarvisMenu = { abrir: () => abrir(false), fechar: () => fechar(false), aberto: () => aberto };
})();
