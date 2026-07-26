-- Leitura da agenda do parceiro (o casal) — SOMENTE o documento 'tasks',
-- SOMENTE SELECT. Não expõe notas/financeiro/contas. Já aplicada ao projeto.
create table if not exists public.agenda_partners (
  user_id uuid not null references auth.users(id) on delete cascade,
  partner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, partner_user_id),
  check (user_id <> partner_user_id)
);
alter table public.agenda_partners enable row level security;
revoke all on public.agenda_partners from anon;
grant select on public.agenda_partners to authenticated;

drop policy if exists "partners_select_self" on public.agenda_partners;
create policy "partners_select_self" on public.agenda_partners for select to authenticated
using ((select auth.uid()) in (user_id, partner_user_id));

drop policy if exists "docs_select_partner_tasks" on public.agenda_documents;
create policy "docs_select_partner_tasks" on public.agenda_documents for select to authenticated
using (
  document_key = 'tasks'
  and exists (
    select 1 from public.agenda_partners p
    where p.user_id = (select auth.uid()) and p.partner_user_id = agenda_documents.user_id
  )
);
