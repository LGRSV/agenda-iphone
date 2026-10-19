// Recebe o cérebro (vault Obsidian "Jarvis") do PC do João e grava em
// public.jarvis_cerebro, que só o Jarvis do app lê (pela chave de serviço).
// Autenticação: header x-cerebro-key, conferido pelo hash SHA-256 em
// public.jarvis_cerebro_tokens (a chave em si fica só no PC, cifrada).
// Ações: estado (caminho+hash de tudo), gravar (até 400 notas / 4 MB), apagar.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string) => (Deno.env.get(k) || "").trim();
let secretKeys: Record<string, string> = {};
try { secretKeys = JSON.parse(env("SUPABASE_SECRET_KEYS") || "{}"); } catch { secretKeys = {}; }
const admin = createClient(env("SUPABASE_URL"), secretKeys.default || env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MAX_BODY = 4_500_000, MAX_NOTAS = 400, MAX_NOTA = 2_000_000;
const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
const out = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers });

async function sha256(t: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

const caminhoOk = (c: unknown) => typeof c === "string" && c.length > 3 && c.length <= 600 && c.endsWith(".md") &&
  !c.startsWith("/") && !c.split("/").some((p) => p === ".." || p === "" || p.startsWith("."));

Deno.serve(async (req) => {
  if (req.method !== "POST") return out({ ok: false, error: "method_not_allowed" }, 405);
  const length = Number(req.headers.get("content-length") || NaN);
  if (!Number.isFinite(length)) return out({ ok: false, error: "length_required" }, 411);
  if (length > MAX_BODY) return out({ ok: false, error: "too_large" }, 413);

  const key = (req.headers.get("x-cerebro-key") || "").trim();
  if (key.length < 32) return out({ ok: false, error: "unauthorized" }, 401);
  const { data: tok, error: tokErr } = await admin.from("jarvis_cerebro_tokens").select("id")
    .eq("token_sha256", await sha256(key)).is("revoked_at", null).maybeSingle();
  if (tokErr) return out({ ok: false, error: "unavailable" }, 503);
  if (!tok) return out({ ok: false, error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try { body = JSON.parse(await req.text()); } catch { return out({ ok: false, error: "bad_request" }, 400); }
  if (!body || typeof body !== "object") return out({ ok: false, error: "bad_request" }, 400);

  if (body.action === "estado") {
    const lista: { caminho: string; hash: string }[] = [];
    for (let de = 0; de < 100_000; de += 1000) {
      const { data, error } = await admin.from("jarvis_cerebro").select("caminho,hash").order("caminho").range(de, de + 999);
      if (error) return out({ ok: false, error: "unavailable" }, 503);
      lista.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    const { data: tam } = await admin.rpc("jarvis_cerebro_tamanho");
    return out({ ok: true, notas: lista, banco_bytes: tam ?? null });
  }

  if (body.action === "gravar") {
    const notas = Array.isArray(body.notas) ? body.notas : [];
    if (!notas.length || notas.length > MAX_NOTAS) return out({ ok: false, error: "bad_request" }, 400);
    const linhas = [];
    for (const n of notas) {
      const c = n?.caminho, conteudo = n?.conteudo, hash = n?.hash;
      if (!caminhoOk(c) || typeof conteudo !== "string" || conteudo.length > MAX_NOTA || typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash)) {
        return out({ ok: false, error: "bad_note", caminho: typeof c === "string" ? c.slice(0, 200) : null }, 400);
      }
      const partes = c.split("/");
      linhas.push({ caminho: c, titulo: partes[partes.length - 1].slice(0, -3), pasta: partes.slice(0, -1).join("/"), conteudo, hash, atualizado: new Date().toISOString() });
    }
    const { error } = await admin.from("jarvis_cerebro").upsert(linhas, { onConflict: "caminho" });
    if (error) { console.error("jarvis-cerebro-sync: gravar", error.code); return out({ ok: false, error: "db_error" }, 500); }
    const { data: tam } = await admin.rpc("jarvis_cerebro_tamanho");
    return out({ ok: true, gravadas: linhas.length, banco_bytes: tam ?? null });
  }

  if (body.action === "apagar") {
    const caminhos = Array.isArray(body.caminhos) ? body.caminhos.filter(caminhoOk) : [];
    if (!caminhos.length || caminhos.length > 1000) return out({ ok: false, error: "bad_request" }, 400);
    const { error } = await admin.from("jarvis_cerebro").delete().in("caminho", caminhos);
    if (error) return out({ ok: false, error: "db_error" }, 500);
    return out({ ok: true, apagadas: caminhos.length });
  }

  return out({ ok: false, error: "unknown_action" }, 400);
});
