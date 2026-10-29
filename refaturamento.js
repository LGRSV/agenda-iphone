(() => {
  'use strict';
  const OPS_KEY = 'agenda_refaturamentos_v1';
  const TASKS_KEY = 'agenda_lagares_v3';
  const NOTES_KEY = 'agenda_notas_v1';
  const ACCOUNTS_KEY = 'agenda_contas_v1';
  const INVESTMENTS_KEY = 'agenda_investimentos_v1';
  const DIRTY_KEY = 'agenda_supabase_dirty_v1';
  const SNAPSHOT_ID = '__shared_finance_snapshot_v2__';
  const SNAPSHOT_PREFIX = '__FINANCE_SNAPSHOT_V1__';
  // Vendas que ainda podem ser devolvidas, fatura real do Inter e saldo em conta do MP:
  // vêm de settings.refatSimulacao no Supabase (fica em agenda_lagares_config_v1),
  // para não ficarem fixos aqui no código público.
  const CONFIG_KEY = 'agenda_lagares_config_v1';
  const FALLBACK_INVOICE_CENTS = 1466440;
  const FALLBACK_GIRO_CENTS = 898404;
  const ANCHOR_START = '2026-06-26';
  const ANCHOR_END = '2026-07-26';
  const ANCHOR_INVOICE = '2026-08';
  const read = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key) || ''); return value == null ? fallback : value; } catch (_) { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const cents = value => {
    const normalized = String(value ?? '').trim().replace(/\s/g,'').replace(/^R\$/i,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.');
    const number = Number(normalized);
    return Number.isFinite(number) ? Math.round(number * 100) : 0;
  };
  const decimal = value => (Number(value || 0) / 100).toFixed(2);
  const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value || 0) / 100);
  const pad = value => String(value).padStart(2,'0');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
  const shiftMonth = (key, delta) => { const [y,m] = key.split('-').map(Number), d = new Date(Date.UTC(y,m-1+delta,1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}`; };
  const invoiceMonth = date => {
    if (date >= ANCHOR_START && date <= ANCHOR_END) return ANCHOR_INVOICE;
    const [year,month,day] = String(date).split('-').map(Number);
    if (!year || !month || !day) return ANCHOR_INVOICE;
    if (date > ANCHOR_END) return shiftMonth(`${year}-${pad(month)}`, day <= 26 ? 1 : 2);
    return shiftMonth(`${year}-${pad(month)}`, day >= 26 ? 2 : 1);
  };
  const uuid = () => globalThis.crypto?.randomUUID?.() || `refat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let editingId = '';
  const activeRefunds = new Set();
  let selectedInvoiceId = '';

  const el = id => document.getElementById(id);
  const fields = {
    description:el('description'), gross:el('gross'), fee:el('fee'), date:el('date'),
    status:el('status'), refund:el('refund'), feeMode:el('feeMode'), refundedFee:el('refundedFee')
  };

  function calculated() {
    const grossCents = cents(fields.gross.value);
    const feeCents = cents(fields.fee.value);
    const status = fields.status.value;
    let refundCents = status === 'realizada' ? 0 : status === 'total' ? grossCents : cents(fields.refund.value);
    refundCents = Math.max(0, refundCents);
    let refundedFeeCents = 0;
    if (refundCents > 0) {
      if (fields.feeMode.value === 'proportional') refundedFeeCents = grossCents ? Math.round(feeCents * refundCents / grossCents) : 0;
      if (fields.feeMode.value === 'full') refundedFeeCents = feeCents;
      if (fields.feeMode.value === 'manual') refundedFeeCents = cents(fields.refundedFee.value);
    }
    const interCents = grossCents - refundCents;
    const mpCents = grossCents - feeCents - refundCents + refundedFeeCents;
    const netFeeCents = feeCents - refundedFeeCents;
    return { grossCents,feeCents,status,refundCents,refundedFeeCents,interCents,mpCents,netFeeCents };
  }

  function syncFields() {
    const data = calculated(), hasRefund = data.status !== 'realizada';
    el('refundField').style.display = data.status === 'parcial' ? '' : 'none';
    el('feeModeField').style.display = hasRefund ? '' : 'none';
    el('refundedFeeField').style.display = hasRefund && fields.feeMode.value === 'manual' ? '' : 'none';
    if (data.status === 'total') fields.refund.value = decimal(data.grossCents).replace('.',',');
    if (hasRefund && fields.feeMode.value !== 'manual') fields.refundedFee.value = decimal(data.refundedFeeCents).replace('.',',');
    renderPreview();
  }

  function signed(value, positiveLabel = '+') {
    if (!value) return money(0);
    return `${value > 0 ? positiveLabel : '−'}${money(Math.abs(value))}`;
  }

  function currencyTextToCents(value) {
    const normalized=String(value||'').replace(/[^\d,.-]/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.');
    const parsed=Number(normalized);
    return Number.isFinite(parsed)?Math.round(parsed*100):0;
  }

  function sharedSnapshot() {
    const task=read(TASKS_KEY,[]).find(item=>item?.id===SNAPSHOT_ID);
    if(task?.financeSnapshot)return task.financeSnapshot;
    const text=String(task?.text||'');
    if(!text.startsWith(SNAPSHOT_PREFIX))return null;
    try{return JSON.parse(text.slice(SNAPSHOT_PREFIX.length))}catch(_){return null}
  }

  function simulationData() {
    const sim=read(CONFIG_KEY,{})?.refatSimulacao;
    return sim&&typeof sim==='object'?sim:null;
  }

  function refundableSales(sim) {
    const now=today();
    return (Array.isArray(sim?.vendas)?sim.vendas:[])
      .filter(item=>item&&item.id&&Number(item.venda)>0&&String(item.devolverAte||'')>=now)
      .sort((a,b)=>String(a.devolverAte).localeCompare(String(b.devolverAte)));
  }

  function simulationBase() {
    const sim=simulationData();
    const snapshot=sharedSnapshot();
    const accounts=read(ACCOUNTS_KEY,snapshot?.accounts||{});
    const localInvestments=read(INVESTMENTS_KEY,{});
    const investments=Array.isArray(localInvestments?.cofres)?localInvestments:(snapshot?.investments||{});
    const giro=(Array.isArray(investments?.cofres)?investments.cofres:[]).find(item=>item?.id==='giro'||/giro mensal/i.test(item?.nome||''));
    const invoiceFromSnapshot=currencyTextToCents(snapshot?.summary?.currentInvoice);
    // faturas ainda não vencidas (fechada e/ou aberta); o João escolhe qual simular
    const invoices=(Array.isArray(sim?.faturas)?sim.faturas:(sim?.fatura?[{id:'f',...sim.fatura}]:[]))
      .filter(f=>f&&Number(f.total)>0&&String(f.vencimento||'')>=today())
      .sort((a,b)=>String(a.vencimento).localeCompare(String(b.vencimento)));
    const chosen=invoices.find(f=>String(f.id||f.mes)===selectedInvoiceId)||invoices[0]||null;
    const realInvoice=chosen?Math.round(Number(chosen.total)*100):0;
    const accountsMp=Math.round(Number(accounts?.mp||snapshot?.accounts?.mp||0)*100);
    const simMpNewer=sim?.saldoContaMp!=null&&String(sim.saldoContaMpEm||'')>=String(accounts?.updMp||'');
    const giroCents=giro?.saldo!=null?Math.round(Number(giro.saldo)*100):FALLBACK_GIRO_CENTS;
    // saldo global informado (Mercado Pago + Giro, conferido no app do MP) tem prioridade
    const globalCents=sim?.saldoGlobal!=null?Math.round(Number(sim.saldoGlobal)*100):null;
    return {
      invoiceCents:realInvoice||invoiceFromSnapshot||FALLBACK_INVOICE_CENTS,
      invoices, chosen,
      invoiceLabel:chosen?`Fatura ${String(chosen.mes||'').split('-').reverse().join('/')}${chosen.status?` (${chosen.status})`:''} · vence ${String(chosen.vencimento).split('-').reverse().slice(0,2).join('/')}`:'',
      sales:refundableSales(sim),
      limit:sim?.limiteInter&&Number(sim.limiteInter.total)>0?{totalCents:Math.round(Number(sim.limiteInter.total)*100),usedCents:Math.round(Number(sim.limiteInter.usado||0)*100),em:sim.limiteInter.em||'',
        parts:[['Fatura fechada',sim.limiteInter.faturaFechada,'#ff8a1f'],['Próxima fatura',sim.limiteInter.proximaFatura,'#1aa3ff'],['Lançamentos futuros',sim.limiteInter.lancamentosFuturos,'#0b74b0']]
          .filter(([, v])=>Number(v)>0).map(([n,v,c])=>({name:n,cents:Math.round(Number(v)*100),color:c}))}:null,
      mpCents:globalCents!=null?globalCents-giroCents:(simMpNewer?Math.round(Number(sim.saldoContaMp)*100):accountsMp),
      giroCents:giro?.saldo!=null?Math.round(Number(giro.saldo)*100):FALLBACK_GIRO_CENTS
    };
  }

  function renderSimulator() {
    const base=simulationBase();
    const sales=base.sales;
    [...activeRefunds].forEach(id=>{if(!sales.some(item=>item.id===id))activeRefunds.delete(id);});
    const active=sales.filter(item=>activeRefunds.has(item.id));
    const refundTotal=active.reduce((sum,item)=>sum+Math.round(Number(item.venda)*100),0);
    const feeReturnTotal=active.reduce((sum,item)=>sum+Math.round(Number(item.taxa||0)*100),0);
    const anySimulation=active.length>0;
    const invoice=base.invoiceCents-refundTotal;
    const mp=base.mpCents-refundTotal+feeReturnTotal;
    const combined=mp+base.giroCents;
    const shortDate=value=>String(value||'').split('-').reverse().slice(0,2).join('/');
    const monthName=mes=>['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][Number(String(mes).slice(5,7))-1]||mes;
    el('simInvoicePick').innerHTML=base.invoices.length>1?base.invoices.map(f=>{const id=String(f.id||f.mes),on=base.chosen&&String(base.chosen.id||base.chosen.mes)===id;
      return `<button type="button" class="pick${on?' on':''}" data-invoice="${esc(id)}" aria-pressed="${on}">Fatura ${monthName(f.mes)} ${f.status==='fechada'?'(fechada)':'(aberta)'} · ${money(Math.round(Number(f.total)*100))}</button>`;}).join(''):'';
    el('simActions').innerHTML=sales.length?sales.map(item=>{
      const on=activeRefunds.has(item.id), fee=item.taxa!=null?`taxa ${money(Math.round(Number(item.taxa)*100))}`:'taxa ?';
      const who=item.conta==='ana'?' · Ana':'';
      return `<button class="sim-toggle" type="button" data-refund="${esc(item.id)}" aria-pressed="${on}"><span>${on?'✓ ':''}Devolver ${money(Math.round(Number(item.venda)*100))}${who}<small>até ${shortDate(item.devolverAte)} · ${fee}</small></span><i class="track" aria-hidden="true"></i></button>`;
    }).join(''):'<p class="sim-note">Nenhuma venda dentro dos 180 dias para devolver.</p>';
    el('simInvoice').textContent=money(invoice);
    el('simCombined').textContent=money(combined);
    const closedNote=base.chosen?.status==='fechada'?' · no app do Inter o crédito entra na fatura aberta; a dívida total cai igual':'';
    el('simInvoiceHint').textContent=(anySimulation?`Antes: ${money(base.invoiceCents)}`:(base.invoiceLabel||'Antes do crédito de estorno'))+(anySimulation?closedNote:'');
    el('simCombinedHint').textContent=anySimulation?`Antes: ${money(base.mpCents+base.giroCents)}`:'Saldo global disponível';
    el('simInvoiceDelta').textContent=anySimulation?`−${money(refundTotal)}`:'sem abatimento';
    el('simCombinedDelta').textContent=anySimulation
      ? `−${money(refundTotal)} + ${money(feeReturnTotal)} = −${money(refundTotal-feeReturnTotal)}`
      :'sem devolução da taxa';
    el('simNote').textContent=anySimulation
      ? `Projeção: a fatura cai para ${money(invoice)}, o saldo global Mercado Pago + Giro fica em ${money(combined)}${base.limit?` e o limite disponível do Inter vai a ${money(Math.min(base.limit.totalCents,Math.max(0,base.limit.totalCents-base.limit.usedCents)+refundTotal))}`:''}. Nenhum valor foi lançado.`
      : 'A simulação não altera sua fatura nem seus saldos reais.';
    // devolver a venda credita o valor inteiro no cartão Inter: o limite volta na mesma medida (até o teto)
    const limit=base.limit, limitCard=el('simLimitCard');
    if(limit){
      const freeBefore=Math.max(0,limit.totalCents-limit.usedCents), freeAfter=Math.min(limit.totalCents,freeBefore+refundTotal);
      limitCard.hidden=false;
      el('simLimit').textContent=money(freeAfter);
      el('simLimitHint').textContent=anySimulation
        ?`Antes: ${money(freeBefore)} · libera +${money(freeAfter-freeBefore)} · usado passa a ${money(limit.totalCents-freeAfter)} de ${money(limit.totalCents)}`
        :`Usado ${money(limit.usedCents)} de ${money(limit.totalCents)}${limit.em?` · ${String(limit.em).split('-').reverse().slice(0,2).join('/')}`:''}`;
      // barra como a do app do Inter: usado (por parte), liberado pela devolução (verde) e disponível (cinza)
      const freed=freeAfter-freeBefore, pct=v=>`${Math.max(0,v)/limit.totalCents*100}%`;
      let left=freed;
      const segs=limit.parts.map(part=>{const cut=Math.min(part.cents,left);left-=cut;return {...part,cents:part.cents-cut};});
      const bar=segs.map(seg=>`<i style="width:${pct(seg.cents)};background:${seg.color}"></i>`).join('')
        +(freed?`<i style="width:${pct(freed)};background:var(--green)"></i>`:'')+`<i style="width:${pct(freeBefore)};background:#5b5f68"></i>`;
      el('simLimitBar').innerHTML=bar;
      el('simLimitLegend').innerHTML=segs.map(part=>`<span><i style="background:${part.color}"></i>${esc(part.name)} ${money(part.cents)}</span>`).join('')
        +(freed?`<span><i style="background:var(--green)"></i>Liberado pela devolução ${money(freed)}</span>`:'')
        +`<span><i style="background:#5b5f68"></i>Disponível ${money(freeAfter)}</span>`;
      limitCard.classList.toggle('changed',anySimulation);
    } else limitCard.hidden=true;
    ['simInvoiceCard','simCombinedCard'].forEach(id=>el(id).classList.toggle('changed',anySimulation));
    el('simInvoiceCard').classList.toggle('credit-balance',invoice<0);
    el('simCombinedCard').classList.toggle('negative-balance',combined<0);
  }

  function renderPreview() {
    const d = calculated();
    el('preview').innerHTML = `
      <div class="preview-row"><span>Fatura Inter · venda</span><b class="negative">+${money(d.grossCents)}</b></div>
      <div class="preview-row"><span>Fatura Inter · crédito do estorno</span><b class="positive">−${money(d.refundCents)}</b></div>
      <div class="preview-row"><span>Mercado Pago · venda líquida</span><b class="positive">+${money(d.grossCents-d.feeCents)}</b></div>
      <div class="preview-row"><span>Mercado Pago · estorno líquido</span><b class="negative">${signed(-d.refundCents+d.refundedFeeCents)}</b></div>
      <div class="preview-row"><span>Taxa · cobrada / devolvida</span><b class="neutral">−${money(d.feeCents)} / +${money(d.refundedFeeCents)}</b></div>
      <div class="preview-row"><span>Saldo final desta operação</span><b>${money(d.interCents)} Inter · ${money(d.mpCents)} MP</b></div>`;
  }

  function markDirty(...keys) {
    const dirty = read(DIRTY_KEY,{});
    keys.forEach(key => { dirty[key] = Date.now(); });
    write(DIRTY_KEY,dirty);
  }

  function taskFor(id, type, data, description, date) {
    const isRefund = type === 'refund';
    const value = isRefund ? data.refundCents : data.grossCents;
    return {
      id:`refat-${type}-${id}`, text:`${isRefund ? 'Crédito de estorno' : 'Refaturamento'} — ${description}`,
      date, time:'', tag:'financeiro', reminder:-1, done:true, hidden:false, syncRev:Date.now()
    };
  }

  function noteFor(id, type, data, date) {
    const isRefund = type === 'refund';
    return {
      movimento:isRefund ? 'entrada' : 'saida', forma:'inter',
      valor:decimal(isRefund ? data.refundCents : data.grossCents),
      invoiceMonth:invoiceMonth(date), durationMin:null, subs:[],
      detail:isRefund ? 'Crédito do estorno do refaturamento no cartão Inter.' : `Venda de refaturamento. Taxa Mercado Pago: ${money(data.feeCents)}.`,
      refaturamentoOperationId:id, refaturamentoType:type, importado:true
    };
  }

  function applyOperation(operation, previous) {
    const tasks = read(TASKS_KEY,[]), notes = read(NOTES_KEY,{});
    const taskIds = [`refat-sale-${operation.id}`,`refat-refund-${operation.id}`];
    for (let index=tasks.length-1; index>=0; index--) if (taskIds.includes(tasks[index]?.id)) tasks.splice(index,1);
    taskIds.forEach(id => { delete notes[id]; });
    tasks.push(taskFor(operation.id,'sale',operation,operation.description,operation.date));
    notes[`refat-sale-${operation.id}`] = noteFor(operation.id,'sale',operation,operation.date);
    if (operation.refundCents > 0) {
      tasks.push(taskFor(operation.id,'refund',operation,operation.description,operation.date));
      notes[`refat-refund-${operation.id}`] = noteFor(operation.id,'refund',operation,operation.date);
    }
    write(TASKS_KEY,tasks); write(NOTES_KEY,notes);

    const accounts = read(ACCOUNTS_KEY,{mp:0,nb:0});
    accounts.refaturamentoApplied = accounts.refaturamentoApplied || {};
    const already = Number(accounts.refaturamentoApplied[operation.id] ?? previous?.mpCents ?? 0);
    const delta = operation.mpCents - already;
    accounts.mp = Math.round((Number(accounts.mp || 0) * 100 + delta)) / 100;
    accounts.refaturamentoApplied[operation.id] = operation.mpCents;
    accounts.upd = operation.date;
    accounts.updMp = operation.date;
    accounts.manualBalance = true;
    accounts.autoAccrual = false;
    accounts.balanceRevision = Date.now();
    write(ACCOUNTS_KEY,accounts);
    markDirty('tasks','notes','accounts');
    window.dispatchEvent(new CustomEvent('agenda:remote-sync',{detail:{documentKey:'all'}}));
  }

  function validate(data) {
    if (!fields.description.value.trim()) return 'Informe uma descrição.';
    if (!fields.date.value) return 'Informe a data.';
    if (data.grossCents <= 0) return 'O valor da venda precisa ser maior que zero.';
    if (data.feeCents < 0 || data.feeCents > data.grossCents) return 'A taxa precisa estar entre zero e o valor da venda.';
    if (data.refundCents > data.grossCents) return 'O estorno não pode ultrapassar o valor original da venda.';
    if (data.status === 'parcial' && (data.refundCents <= 0 || data.refundCents >= data.grossCents)) return 'No estorno parcial, informe um valor maior que zero e menor que a venda.';
    if (data.refundedFeeCents < 0 || data.refundedFeeCents > data.feeCents) return 'A taxa devolvida não pode ultrapassar a taxa cobrada.';
    return '';
  }

  function reset() {
    editingId='';
    fields.description.value=''; fields.gross.value=''; fields.fee.value=''; fields.date.value=today();
    fields.status.value='realizada'; fields.refund.value=''; fields.feeMode.value='proportional'; fields.refundedFee.value='';
    el('formTitle').textContent='NOVA OPERAÇÃO'; el('error').textContent=''; syncFields();
  }

  function toast(message) {
    const node=el('toast'); node.textContent=message; node.classList.add('show');
    clearTimeout(node._timer); node._timer=setTimeout(()=>node.classList.remove('show'),2800);
  }

  function render() {
    const operations = read(OPS_KEY,[]).filter(Boolean).sort((a,b)=>`${b.date}${b.updatedAt||''}`.localeCompare(`${a.date}${a.updatedAt||''}`));
    renderSimulator();
    const labels={realizada:'Realizada',parcial:'Estorno parcial',total:'Estorno total'};
    el('list').innerHTML=operations.length?operations.map(op=>`
      <article class="operation">
        <div class="op-head"><div><div class="op-title">${esc(op.description)}</div><div class="op-meta">${String(op.date).split('-').reverse().join('/')} · venda ${money(op.grossCents)} · taxa ${money(op.feeCents)}</div></div><span class="badge ${op.status}">${labels[op.status]||op.status}</span></div>
        <div class="ledger"><span>Fatura Inter</span><strong class="${op.interCents?'negative':'neutral'}">${money(op.interCents)}</strong><span>Saldo Mercado Pago</span><strong class="${op.mpCents>0?'positive':op.mpCents<0?'negative':'neutral'}">${signed(op.mpCents)}</strong><span>Estorno / taxa devolvida</span><strong>${money(op.refundCents)} / ${money(op.refundedFeeCents)}</strong></div>
        <button class="edit" type="button" data-edit="${esc(op.id)}">Editar operação</button>
      </article>`).join(''):'<div class="empty">Nenhuma operação registrada ainda.</div>';
  }

  el('form').addEventListener('submit',event=>{
    event.preventDefault();
    const data=calculated(), problem=validate(data); el('error').textContent=problem; if(problem)return;
    const operations=read(OPS_KEY,[]), previous=operations.find(op=>op.id===editingId);
    const operation={
      ...(previous||{}), id:editingId||uuid(), description:fields.description.value.trim(), date:fields.date.value,
      feeRefundMode:fields.feeMode.value, ...data, createdAt:previous?.createdAt||new Date().toISOString(), updatedAt:new Date().toISOString()
    };
    const index=operations.findIndex(op=>op.id===operation.id);
    if(index>=0)operations[index]=operation;else operations.push(operation);
    applyOperation(operation,previous);
    write(OPS_KEY,operations); markDirty('refaturamentos');
    render(); reset(); toast('Operação salva e sincronizando com Inter e Mercado Pago.');
  });

  el('reset').addEventListener('click',reset);
  el('simInvoicePick').addEventListener('click',event=>{
    const button=event.target.closest('[data-invoice]'); if(!button)return;
    selectedInvoiceId=button.dataset.invoice; renderSimulator();
  });
  el('simActions').addEventListener('click',event=>{
    const button=event.target.closest('[data-refund]'); if(!button)return;
    const id=button.dataset.refund;
    if(activeRefunds.has(id))activeRefunds.delete(id);else activeRefunds.add(id);
    renderSimulator();
  });
  ['input','change'].forEach(name=>el('form').addEventListener(name,syncFields));
  el('list').addEventListener('click',event=>{
    const button=event.target.closest('[data-edit]'); if(!button)return;
    const op=read(OPS_KEY,[]).find(item=>item.id===button.dataset.edit); if(!op)return;
    editingId=op.id; fields.description.value=op.description; fields.gross.value=decimal(op.grossCents).replace('.',',');
    fields.fee.value=decimal(op.feeCents).replace('.',','); fields.date.value=op.date; fields.status.value=op.status;
    fields.refund.value=decimal(op.refundCents).replace('.',','); fields.feeMode.value=op.feeRefundMode||'proportional';
    fields.refundedFee.value=decimal(op.refundedFeeCents).replace('.',','); el('formTitle').textContent='EDITAR OPERAÇÃO';
    syncFields(); scrollTo({top:el('form').offsetTop-18,behavior:'smooth'});
  });
  window.addEventListener('agenda:remote-sync',event=>{if(['all','settings','refaturamentos','accounts','investments','tasks','notes'].includes(event.detail?.documentKey))render();});
  window.addEventListener('storage',event=>{if([TASKS_KEY,ACCOUNTS_KEY,INVESTMENTS_KEY,CONFIG_KEY].includes(event.key))renderSimulator();});
  reset(); render();
})();
