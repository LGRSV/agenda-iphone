(() => {
  'use strict';

  const root = document.documentElement;
  const body = document.body;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  root.classList.add('ui-polished');

  const setScrolledState = () => {
    body.classList.toggle('ui-scrolled', window.scrollY > 8);
  };

  setScrolledState();
  window.addEventListener('scroll', setScrolledState, { passive: true });

  const canVibrate = 'vibrate' in navigator;
  const pulse = (pattern = 8) => {
    if (!canVibrate) return;
    try { navigator.vibrate(pattern); } catch (_) {}
  };

  const interactiveSelector = [
    'button',
    'a',
    'input[type="checkbox"]',
    '.chip',
    '.view-tab',
    '.appswitch a',
    '.calendar-day',
    '.fab',
    '.icon-btn',
    '.nav-btn'
  ].join(',');

  document.addEventListener('pointerdown', event => {
    const target = event.target.closest(interactiveSelector);
    if (!target || target.disabled) return;
    target.classList.add('ui-pressed');
  }, { passive: true });

  const clearPressed = event => {
    const target = event.target.closest?.('.ui-pressed');
    if (!target) return;
    target.classList.remove('ui-pressed');
  };

  document.addEventListener('pointerup', clearPressed, { passive: true });
  document.addEventListener('pointercancel', clearPressed, { passive: true });
  document.addEventListener('click', event => {
    const target = event.target.closest(interactiveSelector);
    if (!target || target.disabled) return;
    pulse(target.matches('input[type="checkbox"], .check') ? [8, 18, 8] : 7);
  }, { passive: true });

  if (!reduceMotion && 'IntersectionObserver' in window) {
    const revealSelector = '.summary, .view-shell, .empty, .notice, .task-card, .group, .calendar-day';
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('ui-visible');
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    const collectRevealItems = node => {
      if (node === document) return [...document.querySelectorAll(revealSelector)];
      if (!(node instanceof Element)) return [];
      return node.matches(revealSelector) ? [node, ...node.querySelectorAll(revealSelector)] : [...node.querySelectorAll(revealSelector)];
    };

    const watch = node => {
      for (const item of collectRevealItems(node)) {
        if (item.classList.contains('ui-visible') || item.classList.contains('ui-reveal')) continue;
        item.classList.add('ui-reveal');
        observer.observe(item);
      }
    };

    watch(document);

    const mutationObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) watch(node);
      }
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  const syncThemeColor = () => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    if (bg) meta.setAttribute('content', bg);
  };

  syncThemeColor();
  new MutationObserver(syncThemeColor).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'class']
  });

  const improveDialogOpen = () => {
    for (const dialog of document.querySelectorAll('dialog[open]')) {
      dialog.setAttribute('aria-modal', 'true');
      const firstField = dialog.querySelector('input, select, textarea, button');
      if (firstField && !reduceMotion) setTimeout(() => firstField.focus({ preventScroll: true }), 60);
    }
  };

  document.addEventListener('click', () => setTimeout(improveDialogOpen, 0), true);
  improveDialogOpen();
})();
