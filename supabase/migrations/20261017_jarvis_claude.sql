-- Jarvis com Claude: registro de chamadas para o limite de uso e auditoria.
-- Só a Edge Function jarvis-claude (chave de serviço) lê e grava.
-- Não guarda conteúdo de mensagens, só data, situação, modelo e tokens.

create table if not exists public.jarvis_claude_calls (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  status text not null default 'started',
  model text,
  input_tokens integer,
  output_tokens integer
);

create index if not exists jarvis_claude_calls_user_time
  on public.jarvis_claude_calls (user_id, created_at desc);

alter table public.jarvis_claude_calls enable row level security;
revoke all on table public.jarvis_claude_calls from public, anon, authenticated;

drop policy if exists jarvis_claude_calls_backend_only on public.jarvis_claude_calls;
create policy jarvis_claude_calls_backend_only on public.jarvis_claude_calls
  for all to authenticated using (false) with check (false);
