-- Compartilhamento de tarefas entre agendas, com comentários por tarefa.
create table if not exists public.agenda_task_shares (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null check (char_length(task_id) between 1 and 160),
  task_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id, recipient_user_id, task_id),
  check (owner_user_id <> recipient_user_id)
);

create table if not exists public.agenda_task_comments (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.agenda_task_shares(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists agenda_task_shares_recipient_idx on public.agenda_task_shares(recipient_user_id, updated_at desc);
create index if not exists agenda_task_comments_share_idx on public.agenda_task_comments(share_id, created_at);

alter table public.agenda_task_shares enable row level security;
alter table public.agenda_task_comments enable row level security;
revoke all on public.agenda_task_shares, public.agenda_task_comments from anon;
grant select, insert, update, delete on public.agenda_task_shares, public.agenda_task_comments to authenticated;

drop policy if exists "shares_select_participants" on public.agenda_task_shares;
create policy "shares_select_participants" on public.agenda_task_shares for select to authenticated
using ((select auth.uid()) in (owner_user_id, recipient_user_id));
drop policy if exists "shares_insert_owner" on public.agenda_task_shares;
create policy "shares_insert_owner" on public.agenda_task_shares for insert to authenticated
with check ((select auth.uid()) = owner_user_id);
drop policy if exists "shares_update_owner" on public.agenda_task_shares;
create policy "shares_update_owner" on public.agenda_task_shares for update to authenticated
using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);
drop policy if exists "shares_delete_owner" on public.agenda_task_shares;
create policy "shares_delete_owner" on public.agenda_task_shares for delete to authenticated
using ((select auth.uid()) = owner_user_id);

drop policy if exists "comments_select_participants" on public.agenda_task_comments;
create policy "comments_select_participants" on public.agenda_task_comments for select to authenticated
using (exists (select 1 from public.agenda_task_shares s where s.id = share_id and (select auth.uid()) in (s.owner_user_id, s.recipient_user_id)));
drop policy if exists "comments_insert_author_participant" on public.agenda_task_comments;
create policy "comments_insert_author_participant" on public.agenda_task_comments for insert to authenticated
with check ((select auth.uid()) = author_user_id and exists (select 1 from public.agenda_task_shares s where s.id = share_id and (select auth.uid()) in (s.owner_user_id, s.recipient_user_id)));
drop policy if exists "comments_delete_author" on public.agenda_task_comments;
create policy "comments_delete_author" on public.agenda_task_comments for delete to authenticated
using ((select auth.uid()) = author_user_id);

drop trigger if exists agenda_task_shares_updated_at on public.agenda_task_shares;
create trigger agenda_task_shares_updated_at before update on public.agenda_task_shares
for each row execute function public.agenda_set_updated_at();

alter table public.agenda_task_shares replica identity full;
alter table public.agenda_task_comments replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.agenda_task_shares;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.agenda_task_comments;
exception when duplicate_object then null;
end $$;
