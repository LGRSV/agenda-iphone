// Jarvis com Claude. A chave da Anthropic fica SO aqui (segredo ANTHROPIC_API_KEY
// do Supabase): nunca vai para o app, o navegador ou o GitHub.
// Camadas: origem do site, sessao valida do Supabase, lista fechada de usuarios,
// limite de uso por tempo, tamanho maximo do pedido e uma unica ferramenta que
// so devolve uma acao proposta. Quem executa a acao e o app, com as mesmas
// validacoes do Jarvis (apagar pede confirmacao na tela).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { LIMITS, buildPayload, extractAction, parseRequest } from "./logic.ts";

const ORIGIN = "https://lgrsv.github.io";
const OWNER = "718266ce-ac47-4ab9-ac39-4fde8344c9d7";
const env = (k: string) => (Deno.env.get(k) || "").trim();
const allowed = new Set((env("JARVIS_ALLOWED_USER_IDS") || OWNER).split(/[\s,;]+/).filter(Boolean));
const MODEL = env("JARVIS_CLAUDE_MODEL") || "claude-opus-5-5";
const PER_10MIN = Number(env("JARVIS_LIMIT_10MIN")) || 20;
const PER_DAY = Number(env("JARVIS_LIMIT_DAY")) || 200;

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

async function closeCall(id: number | null, patch: Record<string, unknown>) {
  if (id == null) return;
  const { error } = await admin.from("jarvis_claude_calls").update(patch).eq("id", id);
  if (error) console.error("jarvis-claude: falha ao fechar registro", error.code);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  if (origin && origin !== ORIGIN) return fail("forbidden_origin", 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return fail("method_not_allowed", 405);
  if (Number(req.headers.get("content-length") || 0) > LIMITS.bodyChars * 4) return fail("too_large", 413);

  // 1) Sessao do Supabase (o gateway ja confere o JWT; aqui confirmamos o usuario).
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return fail("unauthorized", 401);
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (authError || !user) return fail("unauthorized", 401);
  // 2) Lista fechada: so o dono da agenda (ou quem estiver em JARVIS_ALLOWED_USER_IDS).
  if (!allowed.has(user.id)) return fail("forbidden", 403);

  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) return fail("not_configured", 503);

  // 3) Limite de uso. Se o contador falhar, recusa (falha fechada).
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const count = async (ms: number) => {
    const { count: n, error } = await admin.from("jarvis_claude_calls")
      .select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since(ms));
    return error ? null : (n ?? 0);
  };
  const [n10, nDay] = await Promise.all([count(10 * 60_000), count(24 * 3_600_000)]);
  if (n10 === null || nDay === null) return fail("unavailable", 503);
  if (n10 >= PER_10MIN || nDay >= PER_DAY) return fail("rate_limited", 429);

  // 4) Pedido: tamanho e formato.
  const raw = await req.text();
  if (raw.length > LIMITS.bodyChars) return fail("too_large", 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return fail("bad_request", 400); }
  const parsed = parseRequest(body);
  if (!parsed.ok) return fail(parsed.error, 400);

  // 5) Registro antes de chamar: rajadas simultaneas tambem contam no limite.
  const { data: row, error: insertError } = await admin.from("jarvis_claude_calls")
    .insert({ user_id: user.id, model: MODEL }).select("id").single();
  if (insertError || !row) return fail("unavailable", 503);
  const callId = Number(row.id);

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(buildPayload(MODEL, parsed.system, parsed.messages)),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (e) {
    await closeCall(callId, { status: e instanceof DOMException && e.name === "TimeoutError" ? "timeout" : "network" });
    return fail("upstream_error", 502);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    // So o codigo vai para o registro/log; o corpo do erro da Anthropic nao sai daqui.
    await closeCall(callId, { status: "upstream_" + res.status });
    console.error("jarvis-claude: anthropic", res.status, data?.error?.type || "");
    return fail(res.status === 429 || res.status === 529 ? "upstream_busy" : "upstream_error", 502);
  }
  const action = extractAction(data);
  await closeCall(callId, {
    status: "ok",
    input_tokens: Number(data.usage?.input_tokens) || 0,
    output_tokens: Number(data.usage?.output_tokens) || 0,
  });
  return out({ ok: true, text: JSON.stringify(action) });
});
