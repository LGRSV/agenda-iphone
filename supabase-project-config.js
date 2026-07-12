/* Configuração pública do projeto Supabase da Agenda Lagares.
   A publishable key é própria para uso no navegador. Nunca use service_role aqui. */
(() => {
  'use strict';

  const KEY = 'agenda_supabase_config_v1';
  const defaults = {
    url: 'https://uabpevnjfcwidbjscowq.supabase.co',
    publishableKey: 'sb_publishable_SHH7EV0MT5grOTdCFM-V-w_FqPrtzPh',
    enabled: true
  };

  let current = {};
  try { current = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) {}

  const next = {
    ...current,
    url: current.url || defaults.url,
    publishableKey: current.publishableKey || defaults.publishableKey,
    enabled: true
  };

  localStorage.setItem(KEY, JSON.stringify(next));
})();
