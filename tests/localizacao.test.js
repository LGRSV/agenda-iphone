/* Harness Node para localizacao.js (v2, regras pós-crítica): simula window/document/
   localStorage/navigator e injeta fixes de GPS no motor. Roda: node tests/localizacao.test.js (sem dependências) */
'use strict';
const fs = require('fs');
const assert = require('assert');

// ---- ambiente fake ----
const store = new Map();
global.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
const listeners = {};
global.window = {
  addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
  dispatchEvent: ev => { (listeners[ev.type] || []).forEach(fn => fn(ev)); return true; },
};
global.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } };
const domListeners = {};
global.document = {
  readyState: 'complete', hidden: false,
  addEventListener: (t, fn) => { (domListeners[t] = domListeners[t] || []).push(fn); },
  getElementById: () => null, querySelector: () => null,
  createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, addEventListener() {}, appendChild() {}, insertBefore() {} }),
  body: { appendChild() {} },
};
let now = new Date('2026-09-01T08:00:00').getTime();
Date.now = () => now;
global.setInterval = () => 0; global.clearInterval = () => {}; global.setTimeout = () => 0; global.clearTimeout = () => {};
let gpsAtual = null;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
  geolocation: {
    getCurrentPosition: (ok, err) => { if (gpsAtual) ok(gpsAtual); else err({ code: 2, message: 'sem GPS' }); },
    watchPosition: () => 1,
    clearWatch: () => {},
  },
} });

// ---- carrega o módulo ----
new Function(fs.readFileSync(require('path').join(__dirname, '..', 'localizacao.js'), 'utf-8'))();
const L = global.window.AgendaLocal;
assert(L, 'AgendaLocal não exposto');
const S = L._state;

const CASA = { lat: -10.1840, lng: -48.3336 };
const mv = (base, dn, de) => ({ lat: base.lat + dn / 111320, lng: base.lng + de / (111320 * Math.cos(base.lat * Math.PI / 180)) });
// fix(p, acc, dtMs, speed): avança o relógio e devolve uma Position fake
const fix = (p, acc, dtMs, speed) => { now += dtMs; return { coords: { latitude: p.lat, longitude: p.lng, accuracy: acc, speed: speed == null ? null : speed }, timestamp: now }; };
const hh = ms => { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const feed = (p, acc, dt, n, speed) => { for (let i = 0; i < n; i++) L._processarFix(fix(p, acc, dt, speed)); };
const esconder = () => { global.document.hidden = true; (domListeners.visibilitychange || []).forEach(f => f()); };
const mostrar = () => { global.document.hidden = false; (domListeners.visibilitychange || []).forEach(f => f()); };
let passo = 0; const ok = msg => console.log(`${++passo} ok: ${msg}`);

(async () => {
  // 1) "agora estou em Casa" sem fix prévio → pede fix avulso; visita afirmada; rastreio liga
  gpsAtual = fix(CASA, 18, 0);
  let r = await L.salvarLugar('casa');
  assert(r.ok, 'salvarLugar falhou: ' + r.msg);
  assert.strictEqual(r.lugar.nome, 'Casa'); assert.strictEqual(r.lugar.raio, 100);
  assert(L.ativo()); let o = L.onde(); assert(o && o.lugar === 'Casa' && o.afirmada);
  ok('lugar salvo, visita afirmada aberta às ' + hh(o.desde) + ' — ' + r.msg);

  // 2) carência de 10 min: fixes longe (2 km) não fecham a visita afirmada
  feed(mv(CASA, 2000, 0), 20, 60000, 5);
  assert(L.onde() && L.onde().lugar === 'Casa', 'carência de 10 min deve segurar');
  ok('carência: 5 fixes a 2 km em 5 min não fecham a visita afirmada');

  // 3) após a carência, saída de visita afirmada exige evidência forte (acc ≤ 30, ≥3 fixes, ≥120 s)
  feed(mv(CASA, 0, 0), 15, 60000, 6); // volta pra casa por 6 min (passa da carência); ultimoDentro atualizado
  const tUltimoDentro = now;
  feed(mv(CASA, 300, 0), 60, 30000, 5); // acc 60: não é "forte" → não fecha
  assert(L.onde(), 'acc 60 não é evidência forte para visita afirmada');
  feed(mv(CASA, 300, 0), 15, 30000, 3); // 3 fixes fortes cobrindo 90 s... total sequência já > 120 s? a sequência começou com os fracos: forte=false
  assert(L.onde(), 'sequência contaminada por fix fraco não fecha');
  // sequência nova só começa após voltar ao anel — simula volta e nova saída limpa
  feed(mv(CASA, 0, 0), 15, 30000, 2);
  const tDentro2 = now;
  feed(mv(CASA, 300, 0), 15, 30000, 5); // 5 fixes fortes cobrindo 120 s
  assert(!L.onde(), 'deveria ter fechado com evidência forte');
  let v = L.visitasHoje().pop();
  // saída = ultimoDentro + min(30 s, metade do gap até o 1º fix fora)
  assert.strictEqual(v.saida, tDentro2 + 15000, 'saída = ultimoDentro + 15 s (metade de 30 s)');
  ok('saída de visita afirmada com evidência forte; horário corrigido para ' + hh(v.saida) + ' (último fix dentro + 15 s)');

  // 4) volta em ≤ 15 min → reabre a MESMA visita
  const idAntes = v.id;
  feed(mv(CASA, 5, 5), 15, 20000, 4); // 4 fixes dentro cobrindo 60 s, parado
  o = L.onde(); assert(o && o.lugar === 'Casa');
  v = L.visitasHoje().pop(); assert.strictEqual(v.id, idAntes, 'deveria reabrir a mesma visita'); assert(v.saida == null);
  ok('retorno em < 15 min reabriu a visita anterior (mesmo id)');

  // 5) passar de carro pelo Trabalho não cria visita (speed 14 m/s)
  const TRAB = mv(CASA, 5000, 0);
  gpsAtual = fix(TRAB, 12, 60000); r = await L.salvarLugar('Trabalho'); assert(r.ok && r.novo);
  // sai do trabalho de forma limpa: carência 10 min + evidência forte
  feed(mv(TRAB, 0, 0), 12, 60000, 11);
  feed(mv(TRAB, 3000, 0), 12, 30000, 5); assert(!L.onde(), 'saiu do trabalho');
  const nVisitas = L.visitasHoje().length;
  feed(mv(TRAB, 30, 0), 12, 2000, 10, 14); // 10 fixes dentro do anel, a 50 km/h, 20 s
  assert(!L.onde() && L.visitasHoje().length === nVisitas, 'carro passando não vira visita');
  ok('passagem de carro (speed 14 m/s) ignorada');

  // 6) chegada de verdade: parado dentro por ≥ 60 s → visita com chegada = 1º fix dentro
  feed(mv(TRAB, 3000, 0), 12, 60000, 20); // 20 min longe (com fixes chegando) para não cair na reabertura de 15 min
  const t0 = now + 15000;
  feed(mv(TRAB, 10, 0), 12, 15000, 5, 0.3);
  o = L.onde(); assert(o && o.lugar === 'Trabalho', 'deveria ter chegado no trabalho');
  assert.strictEqual(o.desde, t0, 'chegada = primeiro fix da sequência');
  ok('chegada confirmada após 60 s parado, chegada=' + hh(o.desde));

  // 7) visita automática curta (< 3 min) é descartada ao fechar
  feed(mv(TRAB, 3000, 0), 12, 30000, 3); // 3 fixes longe (dist-acc > 400) em 60 s → fecha por "longe" (2 fixes ≥ 5 s)
  assert(!L.onde());
  assert(!L.visitasHoje().some(x => x.nome === 'Trabalho' && x.saida != null && x.saida - x.chegada < 180000 && !x.afirmada), 'visita < 3 min deveria sumir');
  ok('visita automática de 1-2 min descartada');

  // 8) fix ruim (acc 400) cujo erro cobre o lugar atual: keep-alive, nada muda
  feed(mv(TRAB, 0, 0), 12, 20000, 4, 0); assert(L.onde() && L.onde().lugar === 'Trabalho');
  let antes = JSON.stringify(L.visitasHoje().map(x => [x.id, x.saida]));
  feed(mv(TRAB, 200, 0), 400, 30000, 5);
  assert.strictEqual(JSON.stringify(L.visitasHoje().map(x => [x.id, x.saida])), antes); assert(L.onde());
  ok('fix ruim (±400 m) não fecha nada');

  // 9) fix com acc 150 a 430 m NÃO é evidência de saída (acc > 100)
  feed(mv(TRAB, 430, 0), 150, 30000, 5); assert(L.onde(), 'acc 150 não prova saída');
  ok('acc 150 m a 430 m: sem evidência de saída (antes fechava pelo atalho)');

  // 10) dedup: mesmo timestamp duas vezes conta uma
  const rec = S().ultimoRecebidoTs; const p = fix(mv(TRAB, 0, 0), 12, 10000, 0);
  L._processarFix(p); L._processarFix(p); assert.strictEqual(S().ultimoRecebidoTs, p.timestamp);
  ok('fix duplicado (mesmo timestamp) ignorado');

  // 11) lugares vizinhos (80 m): stickiness — fixes acc 65 perto do Vizinho não trocam
  const VIZ = mv(TRAB, 80, 0);
  // cria Vizinho estando no Trabalho: salvarLugar usa fix atual (TRAB) → seria o mesmo ponto; simula fix no vizinho
  gpsAtual = fix(VIZ, 15, 60000); r = await L.salvarLugar('Vizinho'); assert(r.ok && /perto de Trabalho/.test(r.msg), r.msg);
  ok('aviso de lugares sobrepostos: ' + r.msg.split('Atenção')[1].trim());
  // agora está no Vizinho (afirmada). Volta pro Trabalho de fato: fixes acc 65 a 20 m do Trabalho
  feed(mv(TRAB, 0, 0), 65, 60000, 12); // 12 min: passa a carência
  assert(L.onde().lugar === 'Vizinho', 'com acc 65 nunca troca (precisa acc ≤ 30)');
  feed(mv(TRAB, 0, 0), 20, 30000, 3); // 3 fixes precisos claramente mais perto do Trabalho, 60 s (< 120 s)
  assert(L.onde().lugar === 'Vizinho', 'ainda < 120 s');
  feed(mv(TRAB, 0, 0), 20, 30000, 3);
  assert(L.onde().lugar === 'Trabalho', 'troca grudenta após ≥ 3 fixes precisos por ≥ 120 s');
  const vz = L.visitasHoje().filter(x => x.nome === 'Vizinho').pop(); assert(vz.saida != null);
  ok('troca Trabalho↔Vizinho só com 3 fixes ≤ 30 m por 2 min (sem ping-pong)');

  // 12) GAP sem transição: app fechado 3 h, volta no mesmo lugar → gaps[] na visita, sem split
  const hid = now; esconder(); now += 3 * 3600000; gpsAtual = fix(mv(TRAB, 0, 0), 15, 0, 0); mostrar();
  feed(mv(TRAB, 0, 0), 15, 20000, 4, 0); // 80 s dentro
  v = L.visitasHoje().pop(); assert(v.nome === 'Trabalho' && v.saida == null);
  assert(v.gaps && v.gaps.length === 1 && v.gaps[0].de === hid, 'gap registrado na visita');
  assert(!S().gapPendente, 'gap consumido');
  ok('gap de 3 h no mesmo lugar → "sem monitorar ' + hh(v.gaps[0].de) + '–' + hh(v.gaps[0].ate) + '", visita contínua');

  // 13) GAP com transição: fecha app no Trabalho, reabre em Casa → Trabalho saída ≈[de–ate], Casa chegada ≈[de–ate]
  // (o primeiro callback ao voltar é um ERRO code 2 — GPS frio — como acontece no iOS)
  const hid2 = now; esconder(); now += 2 * 3600000; gpsAtual = null; mostrar();
  const ate2 = now; // fim do gap = primeiro callback (o erro), ±10 s
  feed(mv(CASA, 3, 3), 15, 10000, 8, 0); // 80 s em casa
  const vs = L.visitasHoje(); const tr = vs.filter(x => x.nome === 'Trabalho').pop(); const ca = vs[vs.length - 1];
  assert(tr.saida === hid2 && tr.estSaida && Math.abs(tr.saidaMax - ate2) <= 10000, 'saída do trabalho = intervalo do gap');
  assert(ca.nome === 'Casa' && ca.estChegada && Math.abs(ca.chegada - ate2) <= 10000 && ca.chegadaMin === hid2, 'chegada em casa = intervalo do gap');
  ok('gap com transição: Trabalho saiu ≈' + hh(tr.saida) + '–' + hh(tr.saidaMax) + ', Casa chegou ≈' + hh(ca.chegadaMin) + '–' + hh(ca.chegada));

  // 14) recentragem: lugar criado com GPS ruim (acc 120) e depois fix bom a 60 m → centro corrige
  const ACAD = mv(CASA, -4000, 0);
  gpsAtual = fix(mv(ACAD, 60, 0), 120, 60000, 0); r = await L.salvarLugar('Academia'); assert(r.ok && /refinar/.test(r.msg));
  const lugAntes = L.lugares().find(l => l.nome === 'Academia'); assert(lugAntes.pendenteAte);
  L._processarFix(fix(ACAD, 12, 30000, 0));
  const lugDepois = L.lugares().find(l => l.nome === 'Academia');
  assert(Math.abs(lugDepois.lat - ACAD.lat) < 1e-9 && !lugDepois.pendenteAte, 'centro recentrado no fix bom');
  ok('lugar criado com ±120 m recentrado no primeiro fix ±12 m');

  // 15) horário informado: "cheguei em casa às HH:MM" (válido) e horário contraditório (limitado)
  gpsAtual = fix(CASA, 15, 60000, 0);
  const hAlvo = hh(now - 60000);
  r = await L.salvarLugar('Casa', { horario: hAlvo }); assert(r.ok);
  o = L.onde(); assert(o.lugar === 'Casa' && hh(o.desde) === hAlvo, 'chegada deve ser ' + hAlvo);
  const ultimaFechada = L.visitas(1).filter(x => x.saida != null).sort((a, b) => b.saida - a.saida)[0];
  r = await L.salvarLugar('Casa', { horario: '07:30' }); assert(r.ok); // 07:30 é antes de visitas já fechadas hoje
  o = L.onde(); assert(o.desde === ultimaFechada.saida, 'horário contraditório é limitado ao fim da última visita fechada');
  ok('salvarLugar com horário → chegada ' + hAlvo + '; "07:30" contraditório limitado a ' + hh(o.desde));

  // 16) resumo para o Jarvis
  const resumo = L.resumoJarvis();
  assert(/Legenda/.test(resumo) && /STATUS: LIGADO/.test(resumo) && new RegExp('AGORA: em Casa desde ' + hAlvo).test(resumo) && /sem monitorar/.test(resumo) && /≈12:21–14:21/.test(resumo), resumo);
  console.log(`${++passo} ok: resumoJarvis:\n` + resumo.split('\n').map(l => '   ' + l).join('\n'));

  // 17) remover + tombstone; merge remoto com o mesmo id não ressuscita
  r = L.removerLugar('vizinho'); assert(r.ok);
  const remotoL = JSON.parse(localStorage.getItem('agenda_lugares_v1'));
  const tomb = remotoL.removidos[0];
  localStorage.setItem('agenda_lugares_v1', JSON.stringify({ v: 1, itens: [...remotoL.itens, { id: tomb.id, nome: 'Vizinho', lat: VIZ.lat, lng: VIZ.lng, raio: 100, criadoEm: 1, atualizadoEm: 1 }] }));
  window.dispatchEvent(new CustomEvent('agenda:remote-sync', { detail: { documentKey: 'all' } }));
  assert(!L.lugares().some(l => l.id === tomb.id), 'tombstone segura a remoção');
  ok('tombstone por id segura a remoção no merge');

  // 18) merge de visitas: outra visita aberta do MESMO aparelho → fecha a antiga; de OUTRO aparelho → convive
  const V = JSON.parse(localStorage.getItem('agenda_visitas_v1'));
  const meuDev = S().dev;
  V.itens.push({ id: 'dup-mesmo-dev', dev: meuDev, lugarId: 'x', nome: 'Padaria', chegada: now + 60000, saida: null, atualizadoEm: now + 60000 });
  V.itens.push({ id: 'outro-dev', dev: 'iphone-da-vera', lugarId: 'y', nome: 'Salão', chegada: now + 30000, saida: null, atualizadoEm: now + 30000 });
  localStorage.setItem('agenda_visitas_v1', JSON.stringify(V));
  window.dispatchEvent(new CustomEvent('agenda:remote-sync', { detail: { documentKey: 'settings' } }));
  const abertas = L.visitas(1).filter(x => x.saida == null);
  assert.strictEqual(abertas.filter(x => x.dev === meuDev).length, 1, 'uma aberta por aparelho');
  assert(abertas.some(x => x.dev === 'iphone-da-vera'), 'aberta de outro aparelho preservada');
  assert.strictEqual(L.onde().lugar, 'Padaria', 'onde() = visita aberta mais recente deste aparelho');
  ok('merge: 1 visita aberta por aparelho; a de outro aparelho convive');

  // 19) "Localização Precisa" desligada: 2 fixes de 5 km → precisaoBaixa; um fix bom limpa
  feed(mv(CASA, 0, 0), 5000, 30000, 2);
  assert(S().precisaoBaixa === true, 'precisaoBaixa deveria ligar'); assert(/Localizacao Precisa/.test(L.resumoJarvis()));
  assert(/Localização Precisa/.test(L.resumoCurto()));
  feed(mv(CASA, 0, 0), 20, 30000, 1); assert(!S().precisaoBaixa, 'fix bom limpa precisaoBaixa');
  ok('detecção de "Localização Precisa" desligada (≥2 fixes > 1 km) e limpeza com fix bom');

  // 20) erros: code 3 ignorado; 3× code 2 em 2 min re-arma o watch sem desligar; code 1 desliga
  L._onErro({ code: 3 }); assert(L.ativo());
  L._onErro({ code: 2 }); L._onErro({ code: 2 }); L._onErro({ code: 2 }); assert(L.ativo(), 'code 2 não desliga');
  L._onErro({ code: 1 }); assert(!L.ativo() && L.permissao() === 'negada', 'code 1 desliga e marca negada');
  assert(/PERMISSAO NEGADA/.test(L.resumoJarvis()));
  ok('tratamento por código de erro (3 ignora, 2 re-arma, 1 desliga)');
  // religa para o teste final
  gpsAtual = fix(CASA, 15, 1000, 0); r = await L.ativar(); assert(r.ok && L.ativo() && L.permissao() === 'ok');

  // 21) dados carimbados com a conta: wrapper de OUTRA conta é ignorado no merge (não vaza)
  const wL = JSON.parse(localStorage.getItem('agenda_lugares_v1'));
  assert.strictEqual(wL.owner, '', 'wrapper carimbado com o owner atual (vazio = sem conta)');
  localStorage.setItem('agenda_lugares_v1', JSON.stringify({ v: 1, owner: 'conta-da-ana', itens: [{ id: 'ana-1', nome: 'Salão da Ana', lat: 0, lng: 0, raio: 100, criadoEm: 1, atualizadoEm: 1 }] }));
  window.dispatchEvent(new CustomEvent('agenda:remote-sync', { detail: { documentKey: 'all' } }));
  assert(!L.lugares().some(l => l.id === 'ana-1'), 'lugar de outra conta não pode entrar');
  assert(L.lugares().some(l => l.nome === 'Casa'), 'os meus continuam');
  ok('wrapper de outra conta ignorado no merge (sem vazamento entre contas)');

  // 22) wrappers nunca vazios; desativar
  for (const k of ['agenda_lugares_v1', 'agenda_visitas_v1']) {
    const w = JSON.parse(localStorage.getItem(k));
    assert(w && typeof w === 'object' && !Array.isArray(w) && Object.keys(w).length > 0, k + ' vazio!');
  }
  L.desativar(); assert(!L.ativo()); assert(/DESLIGADO/.test(L.resumoJarvis()) && /rastreio DESLIGADO/.test(L.resumoJarvis()));
  ok('wrappers nunca vazios; desativar reflete no resumo');

  console.log('\nTODOS OS TESTES PASSARAM');
})().catch(e => { console.error('FALHA:', e); process.exit(1); });
