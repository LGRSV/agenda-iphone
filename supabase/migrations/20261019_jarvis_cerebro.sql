-- Cérebro do Jarvis (vault Obsidian "Jarvis") para o Jarvis do app consultar.
-- Só leitura pelo Jarvis: quem grava é o PC do João, pela Edge Function
-- jarvis-cerebro-sync (token próprio, guardado aqui só como hash SHA-256).
-- Nada disto é acessível pelo app ou pelo navegador: RLS ligado, sem política
-- para anon/authenticated e sem permissão nas tabelas e funções.

create extension if not exists unaccent with schema extensions;

-- unaccent não é imutável (depende do dicionário); este invólucro fixa o
-- dicionário para poder entrar na coluna gerada da busca.
create or replace function public.jarvis_sem_acento(t text) returns text
  language sql immutable parallel safe strict
  set search_path = ''
  as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, t) $$;

create table if not exists public.jarvis_cerebro (
  caminho text primary key,          -- relativo ao vault, com "/" (ex.: "00 Início/Pendências.md")
  titulo text not null,
  pasta text not null,
  conteudo text not null,
  hash text not null,                -- sha256 do arquivo, para o PC mandar só o que mudou
  atualizado timestamptz not null default now(),
  busca tsvector generated always as (
    setweight(to_tsvector('portuguese', public.jarvis_sem_acento(titulo)), 'A') ||
    setweight(to_tsvector('portuguese', public.jarvis_sem_acento(left(conteudo, 200000))), 'B')
  ) stored
);
create index if not exists jarvis_cerebro_busca on public.jarvis_cerebro using gin (busca);

create table if not exists public.jarvis_cerebro_tokens (
  id bigint generated always as identity primary key,
  label text not null,
  token_sha256 text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.jarvis_cerebro enable row level security;
alter table public.jarvis_cerebro_tokens enable row level security;
revoke all on table public.jarvis_cerebro, public.jarvis_cerebro_tokens from public, anon, authenticated;
drop policy if exists jarvis_cerebro_backend_only on public.jarvis_cerebro;
create policy jarvis_cerebro_backend_only on public.jarvis_cerebro
  as restrictive for all to authenticated using (false) with check (false);
drop policy if exists jarvis_cerebro_tokens_backend_only on public.jarvis_cerebro_tokens;
create policy jarvis_cerebro_tokens_backend_only on public.jarvis_cerebro_tokens
  as restrictive for all to authenticated using (false) with check (false);

-- Busca: primeiro todas as palavras; se nada aparecer, qualquer uma delas.
create or replace function public.jarvis_cerebro_buscar(q text, lim int default 8)
  returns table (caminho text, titulo text, pasta text, trecho text, nota real)
  language plpgsql stable
  set search_path = ''
  as $$
declare
  consulta tsquery := websearch_to_tsquery('portuguese', public.jarvis_sem_acento(coalesce(q, '')));
  n int := least(greatest(coalesce(lim, 8), 1), 20);
begin
  if numnode(consulta) = 0 then return; end if;
  if not exists (select 1 from public.jarvis_cerebro c where c.busca @@ consulta) then
    consulta := replace(consulta::text, ' & ', ' | ')::tsquery;
  end if;
  return query
    select c.caminho, c.titulo, c.pasta,
           ts_headline('portuguese', left(c.conteudo, 60000), consulta,
                       'MaxFragments=2, MaxWords=35, MinWords=12, StartSel=«, StopSel=»'),
           ts_rank(c.busca, consulta)
      from public.jarvis_cerebro c
     where c.busca @@ consulta
     order by ts_rank(c.busca, consulta) desc, c.atualizado desc
     limit n;
end $$;

create or replace function public.jarvis_cerebro_tamanho() returns bigint
  language sql stable
  set search_path = ''
  as $$ select pg_database_size(current_database()) $$;

revoke all on function public.jarvis_cerebro_buscar(text, int), public.jarvis_cerebro_tamanho(), public.jarvis_sem_acento(text)
  from public, anon, authenticated;
grant execute on function public.jarvis_cerebro_buscar(text, int), public.jarvis_cerebro_tamanho() to service_role;
grant execute on function public.jarvis_sem_acento(text) to service_role;
