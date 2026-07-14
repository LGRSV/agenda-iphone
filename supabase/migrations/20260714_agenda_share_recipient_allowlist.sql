-- Reforça o compartilhamento de tarefas: hoje a RLS de agenda_task_shares só
-- garante que o remetente é quem diz ser (owner_user_id = auth.uid()), mas não
-- garante quem pode ser o destinatário. Qualquer usuário autenticado no
-- projeto (inclusive alguém que se auto-cadastre) podia inserir uma "share"
-- apontando para o UUID de qualquer outra pessoa. Isso restringe o
-- destinatário a uma allowlist explícita (só as duas contas do casal).

create table if not exists public.agenda_allowed_recipients (
  user_id uuid primary key references auth.users(id) on delete cascade,
  label text,
  created_at timestamptz not null default now()
);
revoke all on public.agenda_allowed_recipients from anon, authenticated;

insert into public.agenda_allowed_recipients (user_id, label)
select id, 'allowlist inicial'
from auth.users
where email in ('joaoantonio.negocios@gmail.com', 'anacarolina.social123@gmail.com')
on conflict (user_id) do nothing;

create or replace function public.agenda_is_allowed_recipient(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.agenda_allowed_recipients r where r.user_id = uid);
$$;
revoke all on function public.agenda_is_allowed_recipient(uuid) from public;
grant execute on function public.agenda_is_allowed_recipient(uuid) to authenticated;

drop policy if exists "shares_insert_owner" on public.agenda_task_shares;
create policy "shares_insert_owner" on public.agenda_task_shares for insert to authenticated
with check (
  (select auth.uid()) = owner_user_id
  and public.agenda_is_allowed_recipient(recipient_user_id)
);
