# Ativação do Supabase — Agenda Lagares

A integração já está implementada no aplicativo. Para colocá-la em funcionamento, é necessário criar um projeto Supabase e executar o schema do banco.

## 1. Criar o projeto

1. Crie um projeto no painel do Supabase.
2. Aguarde a inicialização do banco PostgreSQL.
3. No menu **SQL Editor**, abra uma nova consulta.
4. Copie e execute todo o conteúdo de:

```text
supabase/migrations/20260710_agenda_backend.sql
```

Esse script cria a tabela `public.agenda_documents`, ativa Row Level Security, cria as políticas por usuário e habilita Realtime.

## 2. Configurar autenticação

No painel do Supabase:

1. Acesse **Authentication > Providers**.
2. Mantenha o provedor **Email** habilitado.
3. Para uso pessoal, você pode manter a confirmação por e-mail ou desativá-la durante os testes.

## 3. Obter as chaves públicas

Em **Project Settings > API**, copie:

- **Project URL**;
- **Publishable key** ou a chave pública `anon`.

Nunca use a chave `service_role` no navegador ou no repositório.

## 4. Conectar a Agenda

1. Abra a Agenda Lagares.
2. Toque no botão com o raio do Supabase na barra superior.
3. Informe a Project URL e a chave pública.
4. Informe e-mail e senha.
5. Toque em **Criar conta** ou **Entrar**.
6. Na primeira conexão, a Agenda combina os dados locais com a nuvem e grava os documentos no Supabase.

## 5. Onde os dados aparecem

No **Table Editor**, abra `agenda_documents`.

Cada usuário possui até um documento para cada categoria:

- `tasks`;
- `notes`;
- `rules`;
- `training_logs`;
- `training_meta`;
- `settings`;
- `trash`;
- `history`.

O campo `payload` contém os dados em JSON. As políticas RLS impedem que um usuário autenticado leia ou altere os documentos de outro usuário.

## Funcionamento offline

O `localStorage` continua sendo usado como cache local. Alterações feitas sem internet permanecem no aparelho e são enviadas quando a sessão e a conexão com o Supabase estiverem disponíveis.

## Migração do sincronizador antigo

A versão Supabase não carrega mais o antigo `sync.js`, que utilizava um Gist privado do GitHub. O arquivo foi mantido no histórico do repositório e na branch de backup, mas deixou de ser executado na nova versão.
