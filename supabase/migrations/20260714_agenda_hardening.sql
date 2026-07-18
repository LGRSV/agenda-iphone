-- =====================================================================
-- Agenda Lagares — reforço de segurança e correção do sync compartilhado.
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
--
-- Contexto:
--  • O cliente (supabase-shared-storage.js) sincroniza 10 documentos,
--    incluindo 'investments' e 'accounts', mas o CHECK original só
--    permitia 8 chaves — os upserts dessas duas FALHAVAM e derrubavam a
--    sincronização (dado ficava só no aparelho). Aqui ampliamos o CHECK.
--  • Reforçamos o isolamento por usuário com FORCE ROW LEVEL SECURITY
--    (nem o dono da tabela burla as políticas) e revogamos qualquer
--    acesso de anon/public. As políticas por usuário já existentes
--    (auth.uid() = user_id / participantes do compartilhamento) seguem
--    valendo — este arquivo apenas as blinda.
-- =====================================================================

-- 1) Documentos: aceitar as chaves novas usadas pelo app -----------------
alter table public.agenda_documents
  drop constraint if exists agenda_documents_document_key_check;

alter table public.agenda_documents
  add constraint agenda_documents_document_key_check
  check (document_key in (
    'tasks',
    'notes',
    'rules',
    'training_logs',
    'training_meta',
    'settings',
    'trash',
    'history',
    'investments',
    'accounts'
  ));

-- 2) Blindagem de RLS: força as políticas mesmo para o dono da tabela -----
alter table public.agenda_documents      enable row level security;
alter table public.agenda_documents      force  row level security;
alter table public.agenda_task_shares    enable row level security;
alter table public.agenda_task_shares    force  row level security;
alter table public.agenda_task_comments  enable row level security;
alter table public.agenda_task_comments  force  row level security;

-- 3) Nenhum acesso anônimo/público às tabelas da agenda ------------------
revoke all on public.agenda_documents     from anon, public;
revoke all on public.agenda_task_shares   from anon, public;
revoke all on public.agenda_task_comments from anon, public;
grant select, insert, update, delete on public.agenda_documents     to authenticated;
grant select, insert, update, delete on public.agenda_task_shares   to authenticated;
grant select, insert, update, delete on public.agenda_task_comments to authenticated;

-- Observação: as políticas por usuário (isolamento por auth.uid() nos
-- documentos e acesso por participante no compartilhamento) permanecem
-- exatamente como definidas nas migrations anteriores. Este arquivo não
-- afrouxa nenhuma permissão — apenas amplia as chaves aceitas, força o
-- RLS e remove qualquer acesso anônimo remanescente.
