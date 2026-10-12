-- Rendimento diario automatico dos cofrinhos (Mercado Pago).
-- Roda 20:20 e 22:20 (BRT); a funcao e idempotente (guarda
-- investments.accruedThrough) e so rende dias uteis com CDI.
select cron.schedule('agenda-investimentos-rendimento-diario', '20 23,1 * * *', $$
  select net.http_post(
    url := 'https://uabpevnjfcwidbjscowq.supabase.co/functions/v1/agenda-investimentos-rendimento',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','sb_publishable_SHH7EV0MT5grOTdCFM-V-w_FqPrtzPh',
      'x-agenda-cron-token',(select secret_value from private.agenda_push_secrets where secret_name='cron_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 45000
  );
$$);
