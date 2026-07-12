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

For every write, first use `brief` and send its current `version`. A conflicting version is rejected rather than overwriting a newer change.

The key can be revoked by setting `revoked_at` for its row in `agenda_agent_tokens`; never put it in source code or a public page.
