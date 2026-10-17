// Jarvis com Claude. A chave da Anthropic fica SO aqui (segredo ANTHROPIC_API_KEY
// do Supabase): nunca vai para o app, o navegador ou o GitHub.
// Camadas: origem do site, sessao valida do Supabase, lista fechada de usuarios,
// limite de uso por tempo, tamanho maximo do pedido. O modelo pode LER a agenda
// inteira (consultar_agenda) e responde com UMA acao proposta; quem executa e o
// app, com as validacoes do Jarvis (apagar pede confirmacao na tela).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { LAST_CALL, LIMITS, TOOL, type Msg, buildPayload, extractAction, filterAgenda, parseRequest, visibleTasks } from "./logic.ts";

const ORIGIN = "https://lgrsv.github.io";
const OWNER = "718266ce-ac47-4ab9-ac39-4fde8344c9d7";
const env = (k: string) => (Deno.env.get(k) || "").trim();
const allowed = new Set((env("JARVIS_ALLOWED_USER_IDS") || OWNER).split(/[\s,;]+/).filter(Boolean));
const MODEL = env("JARVIS_CLAUDE_MODEL") || "claude-opus-5-5";
const num = (k: string, d: number) => Number(env(k)) || d;
const CHAT_10MIN = num("JARVIS_LIMIT_10MIN", 20), CHAT_DAY = num("JARVIS_LIMIT_DAY", 200);

let secretKeys: Record<string, string> = {};
try { secretKeys = JSON.parse(env("SUPABASE_SECRET_KEYS") || "{}"); } catch { secretKeys = {}; }
const admin = createClient(env("SUPABASE_URL"), secretKeys.default || env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const headers = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "600",
  "Vary": "Origin",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Type": "application/json; charset=utf-8",
};
const out = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers });
const fail = (error: string, status: number) => out({ ok: false, error }, status);
const since = (ms: number) => new Date(Date.now() - ms).toISOString();

// Quantas linhas do usuario na tabela desde ms atras; null se o banco falhar.
async function recent(table: string, userId: string, ms: number) {
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true })
    .eq("user_id", userId).gte("created_at", since(ms));
  return error ? null : (count ?? 0);
}

async function patch(table: string, id: unknown, values: Record<string, unknown>) {
  const { error } = await admin.from(table).update(values).eq("id", id);
  if (error) console.error("jarvis-claude: falha ao atualizar", table, error.code);
}

async function loadAgenda(userId: string) {
  const { data, error } = await admin.from("agenda_documents").select("document_key,payload")
    .eq("user_id", userId).in("document_key", ["tasks", "notes"]);
  if (error) return null;
  const by = Object.fromEntries((data || []).map((d) => [d.document_key, d.payload]));
  return visibleTasks(by.tasks, by.notes);
}

async function chat(userId: string, body: unknown, apiKey: string) {
  const parsed = parseRequest(body);
  if (!parsed.ok) return fail(parsed.error, 400);

  // Limite de uso: reserva primeiro, conta depois (incluindo a propria reserva).
  // Assim, mesmo em rajadas simultaneas, no maximo o limite passa.
  const { data: row, error: insertError } = await admin.from("jarvis_claude_calls")
    .insert({ user_id: userId, model: MODEL }).select("id").single();
  if (insertError || !row) return fail("unavailable", 503); // falha fechada
  const [n10, nDay] = await Promise.all([recent("jarvis_claude_calls", userId, 10 * 60_000), recent("jarvis_claude_calls", userId, 24 * 3_600_000)]);
  if (n10 === null || nDay === null) { await patch("jarvis_claude_calls", row.id, { status: "unavailable" }); return fail("unavailable", 503); }
  if (n10 > CHAT_10MIN || nDay > CHAT_DAY) { await patch("jarvis_claude_calls", row.id, { status: "rejected" }); return fail("rate_limited", 429); }

  const deadline = Date.now() + 50_000;
  const messages: Msg[] = [...parsed.messages];
  let agenda: Record<string, unknown>[] | null | undefined;
  let tokensIn = 0, tokensOut = 0, action: Record<string, unknown> | null = null, status = "incomplete";
  for (let turn = 0; turn < LIMITS.turns; turn++) {
    const left = deadline - Date.now();
    if (left < 3_000) { status = "timeout"; break; }
    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(buildPayload(MODEL, parsed.system, messages)),
        signal: AbortSignal.timeout(Math.min(25_000, left)),
      });
    } catch (e) {
      status = e instanceof DOMException && e.name === "TimeoutError" ? "timeout" : "network";
      break;
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      // So o codigo vai para o registro/log; o corpo do erro da Anthropic nao sai daqui.
      status = "upstream_" + res.status;
      console.error("jarvis-claude: anthropic", res.status, data?.error?.type || "");
      break;
    }
    tokensIn += Number(data.usage?.input_tokens) || 0;
    tokensOut += Number(data.usage?.output_tokens) || 0;
    const blocks = Array.isArray(data.content) ? data.content : [];
    const consulta = data.stop_reason === "tool_use"
      ? blocks.find((b: { type?: string; name?: string }) => b?.type === "tool_use" && b.name !== TOOL.name)
      : null;
    if (!consulta) { action = extractAction(data); if (!action) status = "incomplete_" + String(data.stop_reason || ""); break; }
    if (turn === LIMITS.turns - 1) break; // pediu mais uma consulta na ultima volta: sem resposta
    // Leitura da agenda inteira (so leitura; nada e gravado no servidor).
    if (agenda === undefined) agenda = await loadAgenda(userId);
    const result = consulta.name === "consultar_agenda" && agenda
      ? filterAgenda(agenda, consulta.input)
      : { erro: agenda === null ? "agenda indisponivel" : "ferramenta desconhecida" };
    const content: unknown[] = [{ type: "tool_result", tool_use_id: consulta.id, content: JSON.stringify(result) }];
    if (turn === LIMITS.turns - 2) content.push({ type: "text", text: LAST_CALL });
    messages.push({ role: "assistant", content: blocks }); // devolvido sem mudar (inclui o raciocinio assinado)
    messages.push({ role: "user", content });
  }
  await patch("jarvis_claude_calls", row.id, { status: action ? "ok" : status, input_tokens: tokensIn, output_tokens: tokensOut });
  if (!action) return fail(/^upstream_(429|529)$/.test(status) ? "upstream_busy" : status.startsWith("incomplete") ? "incomplete" : "upstream_error", 502);
  return out({ ok: true, text: JSON.stringify(action) });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  if (origin && origin !== ORIGIN) return fail("forbidden_origin", 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return fail("method_not_allowed", 405);
  // O app sempre manda Content-Length; sem ele (corpo em partes) a leitura nao teria teto.
  const length = Number(req.headers.get("content-length") || NaN);
  if (!Number.isFinite(length)) return fail("length_required", 411);
  if (length > LIMITS.bodyChars * 4) return fail("too_large", 413);

  // 1) Sessao do Supabase (o gateway ja confere o JWT; aqui confirmamos o usuario).
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return fail("unauthorized", 401);
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (authError || !user) return fail("unauthorized", 401);
  // 2) Lista fechada: so o dono da agenda (ou quem estiver em JARVIS_ALLOWED_USER_IDS).
  if (!allowed.has(user.id)) return fail("forbidden", 403);

  // 3) Corpo: tamanho e JSON.
  const raw = await req.text();
  if (raw.length > LIMITS.bodyChars) return fail("too_large", 413);
  let body: Record<string, unknown>;
  try {
    const b = JSON.parse(raw);
    if (!b || typeof b !== "object" || Array.isArray(b)) return fail("bad_request", 400);
    body = b;
  } catch { return fail("bad_request", 400); }

  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) return fail("not_configured", 503);
  return await chat(user.id, body, apiKey);
});
