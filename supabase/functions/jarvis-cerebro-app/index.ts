// Cérebro no app (cerebro.html): ler, buscar, editar e criar notas do vault Jarvis.
// Só o dono: sessão válida do Supabase + id do dono (mesmo critério do jarvis-claude).
// A tabela public.jarvis_cerebro segue fechada para anon/authenticated; aqui se usa a
// chave de serviço, que nunca sai do Supabase. As regras de gravação (90 Fontes só
// leitura, parte gerada intocável, conflito por versão, nome único) ficam no banco,
// nas funções jarvis_cerebro_app_salvar/criar. O PC baixa as edições pelo
// jarvis-cerebro-sync (jarvis_app_sync.py) e grava no Obsidian.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGIN = "https://lgrsv.github.io";
const OWNER = "718266ce-ac47-4ab9-ac39-4fde8344c9d7";
const FONTES = "90 Fontes/";
const MARCA = "<!-- gerado: não editar acima desta linha -->";
const MAX_BODY = 2_200_000, MAX_NOTA = 2_000_000, POR_PAGINA = 100;
// Mesma regra do cerebro.py: o cérebro nunca guarda senha, token, chave ou telefone.
const SEGREDO = /(senha|password|passwd|token|api[_-]?key|secret)\s*[:=]\s*\S{4,}|\bsk-[A-Za-z0-9]{16,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|\b55\d{10,11}\b/i;

const env = (k: string) => (Deno.env.get(k) || "").trim();
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
const fail = (error: string, status = 400, extra: Record<string, unknown> = {}) => out({ ok: false, error, ...extra }, status);

const caminhoOk = (c: unknown): c is string => typeof c === "string" && c.length > 3 && c.length <= 600 && c.endsWith(".md") &&
  !c.startsWith("/") && !c.includes("\\") && !c.split("/").some((p) => p === ".." || p === "" || p.startsWith(".") || p.startsWith("_"));
const tituloOk = (t: unknown): t is string => typeof t === "string" && t.trim() === t && t.length >= 1 && t.length <= 150 &&
  !/[\\/:*?"<>|#^[\]]/.test(t) && !t.startsWith(".");
const somenteLeitura = (c: string) => c.startsWith(FONTES);
// "[oculto]" é o que o PC pôs no lugar de um segredo: não conta como segredo novo.
const temSegredo = (t: string) => SEGREDO.test(t.replaceAll("[oculto]", "[x]"));

async function pastas() {
  const { data, error } = await admin.rpc("jarvis_cerebro_pastas");
  if (error) return fail("unavailable", 503);
  return out({ ok: true, pastas: data || [] });
}

async function listar(body: Record<string, unknown>) {
  const pagina = Math.max(0, Math.min(10_000, Number(body.pagina) || 0));
  const campos = "caminho,titulo,pasta,atualizado,origem,pendente_pc";
  let q;
  if (body.recentes) {
    q = admin.from("jarvis_cerebro").select(campos).not("caminho", "like", FONTES + "%")
      .order("atualizado", { ascending: false }).range(0, 39);
  } else {
    if (typeof body.pasta !== "string" || body.pasta.length > 600) return fail("bad_request");
    q = admin.from("jarvis_cerebro").select(campos).eq("pasta", body.pasta)
      .order("titulo").range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA);
  }
  const { data, error } = await q;
  if (error) return fail("unavailable", 503);
  const lista = data || [];
  const mais = !body.recentes && lista.length > POR_PAGINA;
  return out({ ok: true, notas: lista.slice(0, POR_PAGINA), mais, pagina });
}

async function buscar(body: Record<string, unknown>) {
  const q = typeof body.q === "string" ? body.q.trim().slice(0, 200) : "";
  if (!q) return out({ ok: true, notas: [] });
  const { data, error } = await admin.rpc("jarvis_cerebro_buscar", { q, lim: 20 });
  if (error) return fail("unavailable", 503);
  return out({ ok: true, notas: data || [] });
}

async function ler(body: Record<string, unknown>) {
  let caminho = body.caminho;
  // [[link]] do Obsidian: acha pelo nome (único no vault, sem diferenciar maiúsculas)
  if (!caminhoOk(caminho) && typeof body.nome === "string" && body.nome.length <= 300) {
    const nome = body.nome.split("#")[0].split("|")[0].trim().replace(/\.md$/i, "");
    const ultimo = nome.split("/").pop() || "";
    if (!ultimo) return fail("nao_existe", 404);
    const { data, error } = await admin.from("jarvis_cerebro").select("caminho").ilike("titulo", ultimo.replace(/[\\%_]/g, "\\$&"))
      .order("caminho").limit(5);
    if (error) return fail("unavailable", 503);
    const achado = (data || []).find((r) => nome.includes("/") ? r.caminho.toLowerCase().endsWith(nome.toLowerCase() + ".md") : true) || (data || [])[0];
    if (!achado) return fail("nao_existe", 404);
    caminho = achado.caminho;
  }
  if (!caminhoOk(caminho)) return fail("bad_request");
  const { data, error } = await admin.from("jarvis_cerebro")
    .select("caminho,titulo,pasta,conteudo,versao,atualizado,origem,pendente_pc").eq("caminho", caminho).maybeSingle();
  if (error) return fail("unavailable", 503);
  if (!data) return fail("nao_existe", 404);
  return out({
    ok: true, nota: data,
    somente_leitura: somenteLeitura(data.caminho),
    gerada: data.conteudo.includes(MARCA),
    oculto: data.conteudo.includes("[oculto]"),
  });
}

async function salvar(body: Record<string, unknown>) {
  const { caminho, conteudo, versao } = body;
  if (!caminhoOk(caminho) || typeof conteudo !== "string" || !Number.isSafeInteger(versao)) return fail("bad_request");
  if (conteudo.length > MAX_NOTA) return fail("too_large", 413);
  if (somenteLeitura(caminho)) return fail("somente_leitura", 403);
  if (temSegredo(conteudo)) return fail("segredo");
  const { data, error } = await admin.rpc("jarvis_cerebro_app_salvar", { p_caminho: caminho, p_conteudo: conteudo, p_versao: versao });
  if (error) { console.error("jarvis-cerebro-app: salvar", error.code); return fail("db_error", 500); }
  return out(data, data?.ok ? 200 : (data?.error === "conflito" ? 409 : 400));
}

async function criar(body: Record<string, unknown>) {
  const { pasta, titulo, conteudo } = body;
  if (typeof pasta !== "string" || !tituloOk(titulo) || typeof conteudo !== "string") return fail("bad_request");
  const caminho = `${pasta}/${titulo}.md`;
  if (!caminhoOk(caminho)) return fail("bad_request");
  if (conteudo.length > MAX_NOTA) return fail("too_large", 413);
  if (somenteLeitura(caminho)) return fail("somente_leitura", 403);
  if (temSegredo(conteudo) || temSegredo(titulo)) return fail("segredo");
  const { data, error } = await admin.rpc("jarvis_cerebro_app_criar", { p_caminho: caminho, p_conteudo: conteudo });
  if (error) { console.error("jarvis-cerebro-app: criar", error.code); return fail("db_error", 500); }
  return out(data, data?.ok ? 200 : 400);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  if (origin && origin !== ORIGIN) return fail("forbidden_origin", 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return fail("method_not_allowed", 405);
  const length = Number(req.headers.get("content-length") || NaN);
  if (!Number.isFinite(length)) return fail("length_required", 411);
  if (length > MAX_BODY * 2) return fail("too_large", 413);

  // Sessão do Supabase (o gateway já confere o JWT) e só o dono.
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return fail("unauthorized", 401);
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth?.user) return fail("unauthorized", 401);
  if (auth.user.id !== OWNER) return fail("forbidden", 403);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return fail("too_large", 413);
  let body: Record<string, unknown>;
  try {
    const b = JSON.parse(raw);
    if (!b || typeof b !== "object" || Array.isArray(b)) return fail("bad_request");
    body = b;
  } catch { return fail("bad_request"); }

  switch (body.action) {
    case "pastas": return await pastas();
    case "listar": return await listar(body);
    case "buscar": return await buscar(body);
    case "ler": return await ler(body);
    case "salvar": return await salvar(body);
    case "criar": return await criar(body);
    default: return fail("unknown_action");
  }
});
