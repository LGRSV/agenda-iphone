import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import postgres from 'npm:postgres@3.4.7'

// Rendimento diário dos cofrinhos (Mercado Pago) — roda sozinho via pg_cron.
// CDI anual vigente (BCB ou BrasilAPI) convertido em CDI diário, aplicado só em dias
// úteis (sem fim de semana e feriados nacionais) e na fração do CDI que cada cofrinho
// rende de fato (pctCDI, calibrada pelo rendimento real creditado no Mercado Pago).
// Roda à noite: o dia útil corrente já entra, como o MP credita. Nunca reaplica um
// dia: guarda `accruedThrough` (último dia já rendido).

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 1 })
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })
const equal = (a: string, b: string) => { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0 }
const r2 = (n: number) => Math.round(n * 100) / 100
const brtToday = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)
const addDays = (iso: string, d: number) => { const t = new Date(iso + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10) }

type Cofre = { id: string; nome?: string; saldo?: number; pctCDI?: number; [k: string]: unknown }
type Inv = { cofres?: Cofre[]; accruedThrough?: string; pctCDIPadrao?: number; rendimentos?: unknown[]; [k: string]: unknown }

const UA = { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (agenda-lagares rendimento)' }
async function getJson(url: string, tentativas = 3): Promise<unknown> {
  for (let i = 0; i < tentativas; i++) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000)
      const res = await fetch(url, { headers: UA, signal: ctl.signal }); clearTimeout(t)
      if (res.ok) { const body = await res.json().catch(() => null); if (body != null) return body }
    } catch (_) { /* tenta de novo */ }
    await new Promise(r => setTimeout(r, 800 * (i + 1)))
  }
  return null
}

// CDI anual vigente: BCB (SGS 4389) quando acessível; o BCB costuma bloquear IPs
// de fora do Brasil, então cai para a BrasilAPI (que espelha o mesmo número).
async function cdiAnual(): Promise<{ valor: number; fonte: string } | null> {
  const b = await getJson('https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json', 1) as { valor: string }[] | null
  if (Array.isArray(b) && b.length && Number(b[0].valor) > 0) return { valor: Number(b[0].valor) / 100, fonte: 'BCB SGS 4389' }
  const a = await getJson('https://brasilapi.com.br/api/taxas/v1/cdi') as { valor: number } | null
  if (a && Number(a.valor) > 0) return { valor: Number(a.valor) / 100, fonte: 'BrasilAPI (BCB)' }
  return null
}

const feriadosCache = new Map<number, Set<string>>()
async function feriados(ano: number): Promise<Set<string> | null> {
  if (feriadosCache.has(ano)) return feriadosCache.get(ano)!
  const f = await getJson(`https://brasilapi.com.br/api/feriados/v1/${ano}`) as { date: string; type?: string }[] | null
  if (!Array.isArray(f)) return null
  const set = new Set(f.filter(x => !x.type || x.type === 'national').map(x => x.date))
  feriadosCache.set(ano, set); return set
}

// Dias úteis (seg–sex, fora feriados nacionais) de `desde` até `ate`, cada um com o
// CDI diário = (1+CDI anual)^(1/252) − 1, em % com 6 casas — idêntico à série 12 do BCB.
async function diasUteis(desde: string, ate: string, anual: number): Promise<{ data: string; valor: number }[] | null> {
  const out: { data: string; valor: number }[] = []
  const diaria = Math.round((Math.pow(1 + anual, 1 / 252) - 1) * 100 * 1e6) / 1e6
  for (let d = desde, g = 0; d <= ate && g < 400; d = addDays(d, 1), g++) {
    const wd = new Date(d + 'T12:00:00Z').getUTCDay()
    if (wd === 0 || wd === 6) continue
    const fer = await feriados(Number(d.slice(0, 4)))
    if (!fer) return null // sem calendário confiável não rende (o próximo cron tenta de novo)
    if (fer.has(d)) continue
    out.push({ data: d, valor: diaria })
  }
  return out
}

function aplicar(inv: Inv, dias: { data: string; valor: number }[]) {
  const cofres = (inv.cofres || []).map(c => ({ ...c }))
  const padrao = Number(inv.pctCDIPadrao) > 0 ? Number(inv.pctCDIPadrao) : 1
  const log: { data: string; cdiDia: number; total: number; porCofre: Record<string, number> }[] = []
  for (const d of dias) {
    const porCofre: Record<string, number> = {}
    let total = 0
    for (const c of cofres) {
      const pct = Number(c.pctCDI) > 0 ? Number(c.pctCDI) : padrao
      const y = r2((Number(c.saldo) || 0) * (d.valor / 100) * pct)
      c.saldo = r2((Number(c.saldo) || 0) + y)
      porCofre[c.id] = y; total = r2(total + y)
    }
    log.push({ data: d.data, cdiDia: d.valor, total, porCofre })
  }
  return { cofres, log }
}

async function processar(force = false) {
  const hoje = brtToday()
  const docs = await sql<{ user_id: string; inv: Inv }[]>`
    select user_id::text, payload->'investments' as inv from public.agenda_documents
    where document_key='settings' and jsonb_typeof(payload->'investments'->'cofres')='array'
      and coalesce((payload->'investments'->>'serverAccrual')::boolean, false) = true`
  const out: unknown[] = []
  for (const doc of docs) {
    const inv = doc.inv || {}
    const desde = inv.accruedThrough ? addDays(String(inv.accruedThrough), 1) : hoje
    const cdi = await cdiAnual()
    if (!cdi) throw new Error('CDI indisponível (BCB e BrasilAPI)')
    const cdiAnualV = cdi.valor
    const dias = desde <= hoje ? await diasUteis(desde, hoje, cdiAnualV) : []
    if (dias == null) throw new Error('Calendário de feriados indisponível')
    const cdiMudou = Math.abs(cdiAnualV - (Number(inv.cdi) || 0)) > 1e-9
    // Sem dia novo de CDI e sem mudança de taxa: não grava (evita sincronizações à toa nos aparelhos).
    if (!dias.length && !force && !cdiMudou) { out.push({ user: doc.user_id, dias: [] }); continue }
    const { cofres, log } = aplicar(inv, dias)
    const ultimoCdiDia = dias.length ? dias[dias.length - 1].valor : Number(inv.cdiDiario) || null
    const padrao = Number(inv.pctCDIPadrao) > 0 ? Number(inv.pctCDIPadrao) : 1
    const previsto = ultimoCdiDia ? cofres.reduce((s, c) => s + r2((Number(c.saldo) || 0) * (ultimoCdiDia / 100) * (Number(c.pctCDI) > 0 ? Number(c.pctCDI) : padrao)), 0) : null
    const patch: Record<string, unknown> = {
      cofres,
      upd: hoje,
      serverUpd: new Date().toISOString(),
      cdi: cdiAnualV, cdiFonte: cdi.fonte,
      ...(ultimoCdiDia ? { cdiDiario: ultimoCdiDia } : {}),
      ...(previsto != null ? { rendimentoDiaPrevisto: r2(previsto) } : {}),
    }
    if (log.length) {
      patch.accruedThrough = log[log.length - 1].data
      patch.rendimentoDia = log[log.length - 1]
      patch.rendimentos = [...(Array.isArray(inv.rendimentos) ? inv.rendimentos : []), ...log].slice(-120)
    }
    // Atualiza só se ninguém mexeu nos cofrinhos durante o cálculo (evita sobrescrever ajuste do app).
    const res = await sql`
      update public.agenda_documents
         set payload = jsonb_set(payload, '{investments}', coalesce(payload->'investments','{}'::jsonb) || ${sql.json(patch)}::jsonb),
             version = version + 1, device_id = 'server-rendimento'
       where user_id = ${doc.user_id}::uuid and document_key = 'settings'
         and coalesce(payload->'investments'->>'accruedThrough','') = ${String(inv.accruedThrough || '')}
         and (payload->'investments'->'cofres') = ${sql.json(inv.cofres || [])}::jsonb
      returning version`
    out.push({ user: doc.user_id, dias: log.map(l => l.data), total: log.reduce((s, l) => r2(s + l.total), 0), gravado: res.length > 0 })
  }
  return { hoje, docs: out }
}

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)
  try {
    const rows = await sql<{ secret_value: string }[]>`select secret_value from private.agenda_push_secrets where secret_name='cron_token'`
    const token = req.headers.get('x-agenda-cron-token') || ''
    if (!rows[0]?.secret_value || !equal(token, rows[0].secret_value)) return json({ error: 'Não autorizado' }, 401)
    const body = await req.json().catch(() => ({})) as { force?: boolean }
    return json({ ok: true, ...(await processar(!!body.force)) })
  } catch (err) { console.error(err); return json({ error: err instanceof Error ? err.message : String(err) }, 500) }
})
