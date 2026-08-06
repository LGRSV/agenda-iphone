import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import postgres from 'npm:postgres@3.4.7'
import webpush from 'npm:web-push@3.6.7'

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 1 })
type SecretMap = Record<string, string>
type Task = { id?: string; text?: string; date?: string; time?: string; reminder?: number | string; done?: boolean }
type Sub = { id: string; endpoint: string; p256dh: string; auth_key: string }

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const equal = (a: string, b: string) => { if (a.length !== b.length) return false; let x=0; for(let i=0;i<a.length;i++) x|=a.charCodeAt(i)^b.charCodeAt(i); return x===0 }

async function loadSecrets(): Promise<SecretMap> {
  const rows = await sql<{secret_name:string;secret_value:string}[]>`select secret_name, secret_value from private.agenda_push_secrets`
  return Object.fromEntries(rows.map(r => [r.secret_name, r.secret_value]))
}

async function ensureVapid(s: SecretMap) {
  if (s.vapid_public_key && s.vapid_private_key) return s
  const keys = webpush.generateVAPIDKeys()
  await sql`
    insert into private.agenda_push_secrets(secret_name,secret_value)
    values ('vapid_public_key',${keys.publicKey}),('vapid_private_key',${keys.privateKey})
    on conflict(secret_name) do update set secret_value=excluded.secret_value, updated_at=now()
  `
  return {...s,vapid_public_key:keys.publicKey,vapid_private_key:keys.privateKey}
}

function moments(task: Task) {
  if (task.done || !task.date || !task.time) return []
  // `reminder` é a antecedência escolhida na tarefa, em minutos: -1 sem alerta,
  // 0 no horário, 5/10/15/30/60 antes. Antes daqui saía sempre [15, 0] — quem
  // pedia "1 hora antes" era avisado 15 min antes, e quem pedia "5 minutos"
  // também recebia 15. Agora o aviso adiantado usa a antecedência da própria
  // tarefa, e o aviso da hora marcada continua saindo.
  const lead = Number(task.reminder)
  if (!Number.isFinite(lead) || lead < 0) return []
  const start = new Date(task.date + 'T' + task.time + ':00-03:00')
  if (Number.isNaN(start.getTime())) return []
  const leads = lead > 0 ? [lead, 0] : [0]
  return leads.map(reminder => ({ reminder, fire: new Date(start.getTime() - reminder * 60000) }))
}

async function subs(userId:string):Promise<Sub[]> {
  return await sql<Sub[]>`select id::text,endpoint,p256dh,auth_key from public.push_subscriptions where user_id=${userId}::uuid and active=true`
}

async function send(userId:string,payload:Record<string,unknown>) {
  const list=await subs(userId); let sent=0; const errors:string[]=[]
  for(const sub of list){
    try{
      await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_key}},JSON.stringify(payload),{TTL:3600,urgency:'high'})
      sent++
      await sql`update public.push_subscriptions set last_success_at=now(),last_error=null,active=true,updated_at=now() where id=${sub.id}::uuid`
    }catch(err){
      const e=err as {statusCode?:number;message?:string;body?:string}; const code=Number(e.statusCode||0); const msg=String(e.message||e.body||'Falha no Web Push').slice(0,1000)
      errors.push(`${code||'erro'}: ${msg}`)
      await sql`update public.push_subscriptions set active=case when ${code} in (404,410) then false else active end,last_error=${msg},updated_at=now() where id=${sub.id}::uuid`
    }
  }
  return {subscriptions:list.length,sent,errors}
}

async function reserve(userId:string,taskId:string,fire:Date){
  const rows=await sql<{status:string;attempts:number;updated_at:Date}[]>`select status,attempts,updated_at from public.push_deliveries where user_id=${userId}::uuid and task_id=${taskId} and scheduled_for=${fire.toISOString()}::timestamptz`
  const r=rows[0]
  if(r?.status==='sent'||(r?.status==='processing'&&Date.now()-new Date(r.updated_at).getTime()<240000)||(r?.attempts||0)>=3)return false
  await sql`insert into public.push_deliveries(user_id,task_id,scheduled_for,status,attempts,updated_at) values(${userId}::uuid,${taskId},${fire.toISOString()}::timestamptz,'processing',1,now()) on conflict(user_id,task_id,scheduled_for) do update set status='processing',attempts=public.push_deliveries.attempts+1,updated_at=now(),last_error=null`
  return true
}

async function finish(userId:string,taskId:string,fire:Date,r:{subscriptions:number;sent:number;errors:string[]}){
  const status=r.subscriptions===0?'no_subscription':r.sent>0?'sent':'failed'
  await sql`update public.push_deliveries set status=${status},sent_count=${r.sent},last_error=${r.errors.join(' | ').slice(0,2000)||null},sent_at=case when ${status}='sent' then now() else sent_at end,updated_at=now() where user_id=${userId}::uuid and task_id=${taskId} and scheduled_for=${fire.toISOString()}::timestamptz`
}

async function run(){
  const docs=await sql<{user_id:string;payload:Task[]}[]>`select user_id::text,payload from public.agenda_documents where document_key='tasks' and jsonb_typeof(payload)='array'`
  const now=Date.now(),from=now-120000,to=now+25000; let due=0,delivered=0
  for(const doc of docs) for(const task of Array.isArray(doc.payload)?doc.payload:[]){
    const id = String(task.id || [task.date, task.time, task.text || 'tarefa'].join('-'))
    for (const m of moments(task)) {
      if (m.fire.getTime() < from || m.fire.getTime() > to) continue
      if (!(await reserve(doc.user_id, id, m.fire))) continue
    due++
    const r=await send(doc.user_id,{title:'Lembrete da Agenda',body:`${task.text||'Tarefa'} · ${m.reminder>0?`começa em ${m.reminder} min`:'é agora'}`,tag:`agenda-${id}-${m.fire.toISOString()}`,url:`./?alert=1&task=${encodeURIComponent(id)}`})
      await finish(doc.user_id,id,m.fire,r); delivered+=r.sent
    }
  }
  return {due,delivered}
}

Deno.serve(async req=>{
  if(req.method!=='POST')return response({error:'Método não permitido'},405)
  try{
    let s=await loadSecrets(); const token=req.headers.get('x-agenda-cron-token')||''
    if(!s.cron_token||!equal(token,s.cron_token))return response({error:'Não autorizado'},401)
    s=await ensureVapid(s); webpush.setVapidDetails(s.vapid_subject||'mailto:agenda-lagares@users.noreply.github.com',s.vapid_public_key,s.vapid_private_key)
    const body=await req.json().catch(()=>({})) as {mode?:string}
    if(body.mode==='bootstrap')return response({ok:true,publicKey:s.vapid_public_key})
    return response({ok:true,...await run()})
  }catch(err){console.error(err);return response({error:err instanceof Error?err.message:String(err)},500)}
})
