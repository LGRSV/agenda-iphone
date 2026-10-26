-- Busca do cérebro, versão 2:
-- 1. O trecho é montado sobre o texto SEM acento (a consulta já é sem acento), senão
--    "pendências", "diário", "reunião" voltavam sem nenhum termo destacado.
-- 2. Metade dos resultados vem das notas curadas (fora de "90 Fontes"); o resto, do
--    vault inteiro. Antes, e-mails longos ocupavam as 8 vagas e a nota
--    "00 Início/Pendências.md" ficava em 16º. O rank agora desconta o tamanho da nota.
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
    with achados as (
      select c.caminho, c.titulo, c.pasta, c.conteudo, c.atualizado,
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
    select a.caminho, a.titulo, a.pasta,
           ts_headline('portuguese', public.jarvis_sem_acento(left(a.conteudo, 60000)), consulta,
                       'MaxFragments=2, MaxWords=35, MinWords=12, StartSel=«, StopSel=»'),
           a.r
      from escolhidos e join achados a using (caminho)
     order by e.grupo, a.r desc, a.atualizado desc;
end $$;

revoke all on function public.jarvis_cerebro_buscar(text, int) from public, anon, authenticated;
grant execute on function public.jarvis_cerebro_buscar(text, int) to service_role;
