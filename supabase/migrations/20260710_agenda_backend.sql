-- Agenda Lagares — backend Supabase
-- Execute este arquivo no SQL Editor do projeto Supabase.

create table if not exists public.agenda_documents (
  user_id uuid not null references auth.users(id) on delete cascade,
  document_key text not null check (
    document_key in ('tasks', 'notes', 'rules', 'training_logs', 'training_meta', 'settings', 'trash', 'history')
  ),
  payload jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, document_key)
);

comment on table public.agenda_documents is
  'Documentos JSON da Agenda Lagares, isolados por usuário com Row Level Security.';

create or replace function public.agenda_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  if tg_op = 'UPDATE' then
    new.version = old.version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists agenda_documents_set_updated_at on public.agenda_documents;
create trigger agenda_documents_set_updated_at
before update on public.agenda_documents
for each row execute function public.agenda_set_updated_at();

alter table public.agenda_documents enable row level security;

-- Recriação idempotente das políticas.
drop policy if exists "agenda_select_own" on public.agenda_documents;
drop policy if exists "agenda_insert_own" on public.agenda_documents;
drop policy if exists "agenda_update_own" on public.agenda_documents;
drop policy if exists "agenda_delete_own" on public.agenda_documents;

create policy "agenda_select_own"
on public.agenda_documents
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "agenda_insert_own"
on public.agenda_documents
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "agenda_update_own"
on public.agenda_documents
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "agenda_delete_own"
on public.agenda_documents
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Necessário para receber o conteúdo anterior e novo nos eventos do Realtime.
alter table public.agenda_documents replica identity full;

-- Inclui a tabela na publicação do Supabase Realtime sem falhar se já estiver incluída.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'agenda_documents'
  ) then
    alter publication supabase_realtime add table public.agenda_documents;
  end if;
end
$$;

create index if not exists agenda_documents_updated_at_idx
  on public.agenda_documents (user_id, updated_at desc);

grant select, insert, update, delete on public.agenda_documents to authenticated;
