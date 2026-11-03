-- Busca do cérebro, versão 3 (mesmo resultado da versão 2, bem mais rápida):
-- a versão 2 lia o conteúdo inteiro de TODAS as notas achadas (1.320 para "religador",
-- quase todas e-mails longos) só para montar o trecho de 20; levava ~9 s e estourava o
-- limite de 8 s da API. Agora o conteúdo só é lido para as notas escolhidas, e a
-- função usa o índice GIN (aplicado no banco em 03/11 pela ferramenta MCP).
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
    with achados as materialized (
      select c.caminho, c.atualizado,
             ts_rank(c.busca, consulta, 1) as r,
             c.caminho not like '90 Fontes/%' as curada
        from public.jarvis_cerebro c
       where c.busca @@ consulta
    ), curadas as (
      select a.caminho from achados a where a.curada
       order by a.r desc, a.atualizado desc limit (n + 1) / 2
    ), escolhidos as (
      select a.caminho, 0 as grupo from curadas a
      union all
      (select a.caminho, 1 from achados a
        where a.caminho not in (select x.caminho from curadas x)
        order by a.r desc, a.atualizado desc
        limit n - (select count(*) from curadas)::int)
    )
    select c.caminho, c.titulo, c.pasta,
           ts_headline('portuguese', public.jarvis_sem_acento(left(c.conteudo, 60000)), consulta,
                       'MaxFragments=2, MaxWords=35, MinWords=12, StartSel=«, StopSel=»'),
           a.r
      from escolhidos e
      join achados a on a.caminho = e.caminho
      join public.jarvis_cerebro c on c.caminho = e.caminho
     order by e.grupo, a.r desc, a.atualizado desc;
end $$;

-- Dentro da função o planejador escolhia varrer a tabela inteira (abre o tsvector de todas
-- as notas): com o índice GIN "religador" cai de ~8 s para <0,1 s; "energisa" ~3,7 s.
alter function public.jarvis_cerebro_buscar(text, int) set enable_seqscan = off;

revoke all on function public.jarvis_cerebro_buscar(text, int) from public, anon, authenticated;
grant execute on function public.jarvis_cerebro_buscar(text, int) to service_role;
