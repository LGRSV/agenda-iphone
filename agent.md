# Agenda Agent API

Endpoint: `https://uabpevnjfcwidbjscowq.supabase.co/functions/v1/agenda-agent`

Use the header `x-agenda-agent-key` with the agent key. The endpoint only permits compact task operations; it does not expose SQL, user accounts, or other database tables.

## Read current state

```json
{"action":"brief"}
```

Returns a compact list of relevant open and overdue tasks plus the current `version`.

## Create

```json
{"action":"create","expected_version":17,"task":{"text":"Enviar relatório","date":"2026-07-15","time":"09:00","tag":"trabalho","reminder":15},"note":{"valor":"100","detail":"Opcional"}}
```

## Complete

```json
{"action":"complete","expected_version":17,"id":"task-id"}
```

## Edit / reschedule

```json
{"action":"patch","expected_version":17,"id":"task-id","patch":{"date":"2026-07-16","time":"14:00","flag":"verificar"}}
```

## Financial launches (Painel Financeiro)

Um lançamento do Painel Financeiro é uma tarefa com `tag":"financeiro"` mais uma `note` com os campos financeiros. Exemplo (saída no cartão):

```json
{"action":"create","expected_version":17,"task":{"text":"Gasolina Posto Tabocão","date":"2026-07-19","time":"","tag":"financeiro"},"note":{"movimento":"saida","valor":"141.80","forma":"inter"}}
```

Campos da nota aceitos: `movimento` (`entrada`|`saida`), `valor` (texto, ex. `"141.80"`), `forma` (`inter` cartão · `pix` · `dinheiro` · `mp` Mercado Pago), `conta` (`mp`|`nb`, para Pix), `programada` (saída futura não paga), `vence`/`valorJuros` (cobrança que vira juros ao atrasar), `detail`, `durationMin`, `parcPagas`/`parcRest` (parcelas). Regras de saldo: `pix`/`dinheiro` descontam do saldo da conta; `inter`/`mp` vão para a fatura/registro sem mexer no saldo.

For every write, first use `brief` and send its current `version`. A conflicting version is rejected rather than overwriting a newer change.

The key can be revoked by setting `revoked_at` for its row in `agenda_agent_tokens`; never put it in source code or a public page.
