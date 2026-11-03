-- Cérebro no app (tela cerebro.html): ler, buscar, editar e criar notas pelo app,
-- e o PC (jarvis_app_sync.py) baixa as edições de volta para o vault Obsidian.
-- Acesso continua fechado: nada para anon/authenticated. O app fala com a Edge
-- Function jarvis-cerebro-app (só o dono, conferido pelo login); o PC fala com
-- jarvis-cerebro-sync (chave própria). As duas usam a chave de serviço.
--
-- Colunas novas:
--   versao        sobe a cada gravação (PC ou app); o app manda a versão que abriu
--                 e o banco recusa se outra gravação aconteceu no meio (conflito).
--   origem        'pc' ou 'app' (quem gravou por último). "atualizado" = updated_at.
--   pendente_pc   edição do app que o PC ainda não baixou. Enquanto true, o envio
--                 do PC não sobrescreve nem apaga a nota.
--   base_conteudo conteúdo que o PC tinha mandado antes da 1ª edição do app ainda
--                 não baixada (o PC usa para juntar notas geradas sem conflito).
--   hash          continua sendo o sha256 do ARQUIVO do PC na última sincronização
--                 ('' para nota criada no app): o PC compara com o arquivo local
--                 para saber se ele também mudou (conflito).

alter table public.jarvis_cerebro
  add column if not exists versao bigint not null default 1,
  add column if not exists origem text not null default 'pc',
  add column if not exists pendente_pc boolean not null default false,
  add column if not exists base_conteudo text,
  add column if not exists editado_app timestamptz;

do $$ begin
  alter table public.jarvis_cerebro add constraint jarvis_cerebro_origem_ok check (origem in ('pc', 'app'));
exception when duplicate_object then null; end $$;

create index if not exists jarvis_cerebro_pasta_titulo on public.jarvis_cerebro (pasta, titulo);
create index if not exists jarvis_cerebro_titulo_lower on public.jarvis_cerebro (lower(titulo));
create index if not exists jarvis_cerebro_pendentes on public.jarvis_cerebro (caminho) where pendente_pc;

-- Pastas com quantas notas cada uma (a árvore do app sai daqui).
create or replace function public.jarvis_cerebro_pastas()
  returns table (pasta text, notas bigint)
  language sql stable
  set search_path = ''
  as $$ select c.pasta, count(*) from public.jarvis_cerebro c group by c.pasta order by c.pasta $$;

-- Edição feita no app. Recusa: 90 Fontes, versão velha (conflito) e mudança acima
-- da marca das notas geradas (hubs, Pessoas, Início...).
create or replace function public.jarvis_cerebro_app_salvar(p_caminho text, p_conteudo text, p_versao bigint)
  returns jsonb
  language plpgsql
  set search_path = ''
  as $$
declare
  r record;
  marca constant text := '<!-- gerado: não editar acima desta linha -->';
  fim int;
begin
  if p_caminho like '90 Fontes/%' then
    return jsonb_build_object('ok', false, 'error', 'somente_leitura');
  end if;
  select c.conteudo, c.versao, c.pendente_pc, c.base_conteudo, c.atualizado, c.origem into r
    from public.jarvis_cerebro c where c.caminho = p_caminho for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'nao_existe');
  end if;
  if r.versao <> p_versao then
    return jsonb_build_object('ok', false, 'error', 'conflito', 'versao', r.versao, 'atualizado', r.atualizado, 'origem', r.origem);
  end if;
  fim := strpos(r.conteudo, marca);
  if fim > 0 then
    fim := fim - 1 + length(marca);
    if left(p_conteudo, fim) <> left(r.conteudo, fim) then
      return jsonb_build_object('ok', false, 'error', 'parte_gerada');
    end if;
  end if;
  if p_conteudo = r.conteudo then
    return jsonb_build_object('ok', true, 'versao', r.versao, 'atualizado', r.atualizado, 'sem_mudanca', true);
  end if;
  update public.jarvis_cerebro c
     set conteudo = p_conteudo, atualizado = now(), origem = 'app', versao = r.versao + 1,
         base_conteudo = case when r.pendente_pc then r.base_conteudo else r.conteudo end,
         pendente_pc = true, editado_app = now()
   where c.caminho = p_caminho;
  return jsonb_build_object('ok', true, 'versao', r.versao + 1, 'atualizado', now());
end $$;

-- Nota nova criada no app: só em pasta que já existe (fora de 90 Fontes) e com
-- nome único no vault inteiro (o Obsidian não diferencia maiúsculas).
create or replace function public.jarvis_cerebro_app_criar(p_caminho text, p_conteudo text)
  returns jsonb
  language plpgsql
  set search_path = ''
  as $$
declare
  v_titulo text := regexp_replace(regexp_replace(p_caminho, '^.*/', ''), '\.md$', '');
  v_pasta text := regexp_replace(p_caminho, '/[^/]*$', '');
begin
  if p_caminho not like '%/%.md' or v_pasta = '' or v_pasta = '90 Fontes' or v_pasta like '90 Fontes/%' then
    return jsonb_build_object('ok', false, 'error', 'pasta_invalida');
  end if;
  -- "Caixa de entrada" fica vazia (é para onde vai o que não tem tema), por isso entra à parte
  if v_pasta <> '00 Início/Caixa de entrada' and not exists (select 1 from public.jarvis_cerebro c where c.pasta = v_pasta) then
    return jsonb_build_object('ok', false, 'error', 'pasta_invalida');
  end if;
  if exists (select 1 from public.jarvis_cerebro c where lower(c.titulo) = lower(v_titulo)) then
    return jsonb_build_object('ok', false, 'error', 'nome_repetido');
  end if;
  insert into public.jarvis_cerebro (caminho, titulo, pasta, conteudo, hash, atualizado, versao, origem, pendente_pc, editado_app)
  values (p_caminho, v_titulo, v_pasta, p_conteudo, '', now(), 1, 'app', true, now());
  return jsonb_build_object('ok', true, 'caminho', p_caminho, 'versao', 1);
end $$;

-- Envio do PC: grava em lote, mas pula as notas com edição do app ainda não baixada.
create or replace function public.jarvis_cerebro_gravar_pc(notas jsonb)
  returns jsonb
  language plpgsql
  set search_path = ''
  as $$
declare
  gravadas int;
  puladas text[];
begin
  with dados as (
    select x.caminho, x.titulo, x.pasta, x.conteudo, x.hash
      from jsonb_to_recordset(notas) as x(caminho text, titulo text, pasta text, conteudo text, hash text)
  ), up as (
    insert into public.jarvis_cerebro as c (caminho, titulo, pasta, conteudo, hash, atualizado, origem, versao, pendente_pc)
    select d.caminho, d.titulo, d.pasta, d.conteudo, d.hash, now(), 'pc', 1, false from dados d
    on conflict (caminho) do update
       set titulo = excluded.titulo, pasta = excluded.pasta, conteudo = excluded.conteudo, hash = excluded.hash,
           atualizado = now(), origem = 'pc', versao = c.versao + 1
     where not c.pendente_pc
    returning c.caminho
  )
  select (select count(*) from up)::int,
         array(select d.caminho from dados d where not exists (select 1 from up u where u.caminho = d.caminho))
    into gravadas, puladas;
  return jsonb_build_object('gravadas', gravadas, 'puladas', to_jsonb(puladas));
end $$;

-- O PC confirma o que baixou. hash = sha256 do arquivo gravado (a nota no PC ficou
-- igual à do app); hash '' = o PC manteve a versão dele e vai reenviá-la (conflito
-- ou junção). Se o app editou de novo no meio (versão mudou), a nota segue pendente.
create or replace function public.jarvis_cerebro_confirmar_pc(itens jsonb)
  returns int
  language plpgsql
  set search_path = ''
  as $$
declare n int;
begin
  update public.jarvis_cerebro c
     set hash = coalesce(x.hash, c.hash),
         pendente_pc = (c.versao <> x.versao),
         base_conteudo = case when c.versao = x.versao then null else c.base_conteudo end
    from jsonb_to_recordset(itens) as x(caminho text, versao bigint, hash text)
   where c.caminho = x.caminho and c.pendente_pc;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.jarvis_cerebro_pastas(), public.jarvis_cerebro_app_salvar(text, text, bigint),
  public.jarvis_cerebro_app_criar(text, text), public.jarvis_cerebro_gravar_pc(jsonb), public.jarvis_cerebro_confirmar_pc(jsonb)
  from public, anon, authenticated;
grant execute on function public.jarvis_cerebro_pastas(), public.jarvis_cerebro_app_salvar(text, text, bigint),
  public.jarvis_cerebro_app_criar(text, text), public.jarvis_cerebro_gravar_pc(jsonb), public.jarvis_cerebro_confirmar_pc(jsonb)
  to service_role;
