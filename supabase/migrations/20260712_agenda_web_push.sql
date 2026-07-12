-- Agenda Lagares — Web Push
-- A chave VAPID privada e o token do cron são gerados dentro do Supabase.
-- Nenhum segredo deve ser gravado neste arquivo ou no frontend.

create extension if not exists pgcrypto;
create extension if not exists pg_net;
create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.agenda_push_secrets (
  secret_name text primary key,
  secret_value text not null,
  updated_at timestamptz not null default now()
);
revoke all on table private.agenda_push_secrets from public, anon, authenticated;

insert into private.agenda_push_secrets(secret_name, secret_value)
values
  ('cron_token', encode(gen_random_bytes(48), 'base64')),
  ('bootstrap_nonce', encode(gen_random_bytes(48), 'base64')),
  ('vapid_subject', 'mailto:agenda-lagares@users.noreply.github.com')
on conflict (secret_name) do nothing;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  expiration_time bigint,
  user_agent text,
  device_label text,
  timezone text not null default 'America/Araguaina',
  active boolean not null default true,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions(user_id, active);

alter table public.push_subscriptions enable row level security;
revoke all privileges on table public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;

drop policy if exists "push_select_own" on public.push_subscriptions;
create policy "push_select_own" on public.push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "push_insert_own" on public.push_subscriptions;
create policy "push_insert_own" on public.push_subscriptions
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "push_update_own" on public.push_subscriptions;
create policy "push_update_own" on public.push_subscriptions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "push_delete_own" on public.push_subscriptions;
create policy "push_delete_own" on public.push_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.push_deliveries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null,
  scheduled_for timestamptz not null,
  status text not null default 'processing'
    check (status in ('processing','sent','failed','no_subscription')),
  attempts integer not null default 0,
  sent_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(user_id, task_id, scheduled_for)
);

alter table public.push_deliveries enable row level security;
revoke all privileges on table public.push_deliveries from anon, authenticated;

drop policy if exists "push_deliveries_backend_only" on public.push_deliveries;
create policy "push_deliveries_backend_only"
on public.push_deliveries as restrictive for all to authenticated
using (false) with check (false);

create or replace function public.touch_push_subscription_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_push_subscription_updated_at() from public, anon, authenticated;

drop trigger if exists touch_push_subscription_updated_at on public.push_subscriptions;
create trigger touch_push_subscription_updated_at
before update on public.push_subscriptions
for each row execute function public.touch_push_subscription_updated_at();

-- O worker agenda-web-push-worker deve ser implantado antes de criar o cron.
do $$
declare existing_job bigint;
begin
  for existing_job in select jobid from cron.job where jobname = 'agenda-web-push-every-minute'
  loop
    perform cron.unschedule(existing_job);
  end loop;
end $$;

select cron.schedule(
  'agenda-web-push-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://uabpevnjfcwidbjscowq.supabase.co/functions/v1/agenda-web-push-worker',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','sb_publishable_SHH7EV0MT5grOTdCFM-V-w_FqPrtzPh',
      'x-agenda-cron-token',(
        select secret_value from private.agenda_push_secrets where secret_name='cron_token'
      )
    ),
    body := '{"mode":"cron"}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
