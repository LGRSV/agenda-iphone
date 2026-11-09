/* acessos.js — acessos do iPhone pela Agenda (app nativo LGRSV/agenda-app, plugin local AgendaAcesso).

   1) Falar: botão de microfone junto aos botões flutuantes. Toca, fala, o iPhone transcreve em pt-BR NO APARELHO
      e a tela mostra o texto (com data e hora tiradas da fala quando é óbvio: "amanhã às 9") para confirmar
      antes de criar a tarefa ou perguntar ao Jarvis. No app, o microfone do Jarvis usa o mesmo ditado.
      O áudio não é gravado nem enviado; sem o modelo local, só usa a transcrição da Apple se o João aceitar.
   2) Menu ⋯ > Acessos do iPhone: contatos (buscar, ligar, WhatsApp, tarefa "falar com"), calendário (hoje/semana,
      eventos de hoje na tela inicial, evento a partir de tarefa), anexos de foto/documento por tarefa (ficam só
      neste aparelho, no IndexedDB), salvar imagem/PDF no rolo, exportar tarefa+nota para o Arquivos, Saúde.
   3) Saúde: o app (conta Apple grátis, reassinado pelo próprio app) não tem o direito de uso do HealthKit.
      Plano alternativo: automação do Atalhos abre agenda-lgrsv://saude?passos=N&sono=H (só números do dia),
      e o resumo fica na chave agenda_saude_v1, sincronizada dentro de "settings".
   Cada permissão só é pedida no toque. Sem o app (Safari/PWA) ou com o app antigo, avisa e não chama nada.
   A lógica pura (data/hora ditadas, telefones, saúde, mensagens de erro) é testada em Node: tests/acessos.test.js */
(function (raiz) {
  'use strict';

  // ---------------------------------------------------------------- lógica pura
  const pad = n => String(n).padStart(2, '0');
  const isoDia = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const somaDias = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12); return x; };
  const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

  const NUM = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
    onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18,
    dezenove: 19, vinte: 20, 'vinte e um': 21, 'vinte e uma': 21, 'vinte e dois': 22, 'vinte e duas': 22, 'vinte e tres': 23,
    trinta: 30, quarenta: 40, cinquenta: 50 };
  const PAL = Object.keys(NUM).sort((a, b) => b.length - a.length).join('|');
  const numero = s => { s = String(s || '').trim(); return /^\d+$/.test(s) ? Number(s) : (NUM[s] != null ? NUM[s] : NaN); };
  const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const SEMANA = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };

  function dataValida(a, m, d) { const x = new Date(a, m - 1, d, 12); return x.getFullYear() === a && x.getMonth() === m - 1 && x.getDate() === d ? x : null; }

  /* Tira data e hora de um texto ditado em pt-BR. Só preenche quando é óbvio; hora de 1 a 6 sem "da manhã/tarde/
     noite" é ambígua (3 = 15h?) e fica no texto com horaDuvida = true. Sem data dita, a data é hoje. */
  function interpretarDitado(texto, agora) {
    agora = agora || new Date();
    const orig = String(texto || '').normalize('NFC').replace(/\s+/g, ' ').trim();
    const base = semAcento(orig.toLowerCase()); // mesmo comprimento do original (NFC -> NFD sem acentos)
    const cortes = [];
    const usar = (m, extra) => { cortes.push([m.index, m.index + m[0].length]); return extra; };
    const livre = (i, j) => !cortes.some(([a, b]) => i < b && j > a);
    let data = null, hora = '', horaDuvida = false;

    // ---- data
    let m;
    if ((m = /\bdepois de amanha\b/.exec(base))) data = usar(m, somaDias(agora, 2));
    else if ((m = /\bamanha\b/.exec(base))) data = usar(m, somaDias(agora, 1));
    else if ((m = /\bhoje\b/.exec(base))) data = usar(m, somaDias(agora, 0));
    if (!data && (m = new RegExp(`\\b(?:daqui a|em|dentro de)\\s+(\\d{1,2}|${PAL})\\s+dias?\\b`).exec(base))) {
      const n = numero(m[1]); if (n > 0 && n < 400) data = usar(m, somaDias(agora, n));
    }
    if (!data && (m = /\b(?:(?:n[ao]|nest[ae]|ness[ae]|est[ae]|ess[ae]|proxim[ao]|na proxima|no proximo)\s+)?(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:[- ]feira)?(?:\s+que vem)?\b(?!\s+via\b)/.exec(base))) {
      let dif = (SEMANA[m[1]] - agora.getDay() + 7) % 7; if (dif === 0) dif = 7;
      data = usar(m, somaDias(agora, dif));
    }
    if (!data && (m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(base))) {
      const d = +m[1], me = +m[2]; let a = m[3] ? +m[3] : agora.getFullYear(); if (a < 100) a += 2000;
      let x = dataValida(a, me, d);
      if (x && !m[3] && isoDia(x) < isoDia(agora)) x = dataValida(a + 1, me, d);
      if (x) data = usar(m, x);
    }
    if (!data && (m = new RegExp(`\\b(?:no |para o |pro )?dia\\s+(\\d{1,2}|${PAL})(?:\\s+de\\s+(${MESES.join('|')}))?\\b`).exec(base))) {
      const d = numero(m[1]);
      let me = m[2] ? MESES.indexOf(m[2]) + 1 : agora.getMonth() + 1, a = agora.getFullYear();
      let x = dataValida(a, me, d);
      if (x && isoDia(x) < isoDia(agora)) x = m[2] ? dataValida(a + 1, me, d) : (me === 12 ? dataValida(a + 1, 1, d) : dataValida(a, me + 1, d));
      if (x) data = usar(m, x);
    }

    // ---- hora
    const periodo = (h, p) => {
      if (!p) return h;
      if (p === 'tarde' || p === 'noite') return h === 12 ? (p === 'noite' ? 0 : 12) : (h < 12 ? h + 12 : h);
      return h === 12 ? 0 : h; // manha / madrugada
    };
    const minutos = s => !s ? 0 : s === 'meia' ? 30 : numero(s);
    const achaHora = () => {
      const PER = '(?:\\s+(?:da|de)\\s+(manha|tarde|noite|madrugada))?';
      let x = /\b(?:(?:as|a|ao|pro|para o)\s+)?(meio[- ]dia|meia[- ]noite)(?:\s+e\s+meia)?\b/.exec(base);
      if (x && livre(x.index, x.index + x[0].length)) {
        usar(x); return { h: /^meio/.test(x[1]) ? 12 : 0, mi: /e meia$/.test(x[0]) ? 30 : 0, certo: true };
      }
      // 9h, 9h30, 9:30, 14 h, às 9:00
      x = new RegExp(`\\b(?:(?:as|a|para as|pras)\\s+)?(\\d{1,2})\\s*(?::|h)\\s*(\\d{2})?(?:\\s*(?:min|minutos))?(?:\\s*h(?:oras?)?)?${PER}(?![\\w/])`).exec(base);
      if (x && livre(x.index, x.index + x[0].length)) {
        usar(x); return { h: periodo(+x[1], x[3]), mi: x[2] ? +x[2] : 0, certo: !!x[3] || +x[1] === 0 || +x[1] > 6 || !!x[2] };
      }
      // às 9 / às nove e meia / às 3 da tarde / às 10 horas
      x = new RegExp(`\\b(?:as|a partir das|para as|pras|ate as)\\s+(\\d{1,2}|${PAL})(?:\\s+horas?)?(?:\\s+e\\s+(meia|\\d{1,2}|${PAL}))?(?:\\s+minutos)?${PER}\\b`).exec(base);
      if (x && livre(x.index, x.index + x[0].length)) {
        const h0 = numero(x[1]);
        if (h0 >= 0 && h0 <= 23) { usar(x); return { h: periodo(h0, x[3]), mi: minutos(x[2]), certo: !!x[3] || h0 === 0 || h0 > 6 }; }
      }
      // 3 da tarde (sem "às")
      x = new RegExp(`\\b(\\d{1,2}|${PAL})(?:\\s+horas?)?(?:\\s+e\\s+(meia|\\d{1,2}))?\\s+(?:da|de)\\s+(manha|tarde|noite|madrugada)\\b`).exec(base);
      if (x && livre(x.index, x.index + x[0].length)) {
        const h0 = numero(x[1]);
        if (h0 >= 1 && h0 <= 12) { usar(x); return { h: periodo(h0, x[3]), mi: minutos(x[2]), certo: true }; }
      }
      return null;
    };
    const hh = achaHora();
    if (hh && hh.h >= 0 && hh.h <= 23 && hh.mi >= 0 && hh.mi <= 59) {
      if (hh.certo) hora = `${pad(hh.h)}:${pad(hh.mi)}`;
      else { horaDuvida = true; cortes.pop(); } // ambígua: devolve ao texto
    } else if (hh) cortes.pop(); // hora impossível (31h): fica no texto

    // ---- texto sem os trechos de data/hora
    let t = orig;
    cortes.sort((a, b) => b[0] - a[0]).forEach(([a, b]) => { t = t.slice(0, a) + ' ' + t.slice(b); });
    t = t.replace(/\s+/g, ' ').trim();
    const INICIO = /^(?:(?:me\s+)?lembr(?:a|e|ar)(?:\s+de)?|lembrete(?:\s+de)?|cri(?:a|e|ar)\s+(?:uma\s+)?tarefa(?:\s+de|\s+para)?|nova\s+tarefa|tarefa|anot(?:a|e|ar)|adicion(?:a|e|ar))\s*[:,-]?\s+/i;
    for (let i = 0; i < 2; i++) t = t.replace(INICIO, '');
    const FIM = /[\s,;:.-]+(?:para|pra|no|na|nos|nas|em|de|do|da|as|às|a|ao|e|que)?[\s,;:.-]*$/i;
    for (let i = 0; i < 3; i++) t = t.replace(FIM, '').replace(/^[\s,;:.-]+/, '');
    t = t.replace(/\s+(?:para|pra|no|na|em|de|às|as|ao)\s*$/i, '');
    if (t) t = t.charAt(0).toUpperCase() + t.slice(1);
    return { texto: t, data: isoDia(data || agora), hora, temData: !!data, temHora: !!hora, horaDuvida };
  }

  /* Telefone -> links de ligação e WhatsApp (Brasil: sem DDI, coloca 55). */
  function linksTelefone(numeroTel) {
    const bruto = String(numeroTel || '').trim();
    let d = bruto.replace(/\D/g, '');
    if (!d) return null;
    const internacional = bruto.startsWith('+') || bruto.startsWith('00');
    if (bruto.startsWith('00')) d = d.slice(2);
    if (!internacional) {
      const comZero = /^0/.test(d);
      d = d.replace(/^0+/, '');
      if (comZero && /^(?:12|14|15|21|23|31|41|43|81)\d{10,11}$/.test(d)) d = d.slice(2); // 0 + operadora + DDD + número
      if (d.length === 10 || d.length === 11) d = '55' + d;
    }
    if (d.length < 8) return null;
    return { tel: `tel:+${d}`, whatsapp: `https://wa.me/${d}`, digitos: d };
  }

  /* Números da Saúde (vindos do Atalhos): passos do dia e minutos de sono. Aceita lista (somada). */
  function lerNumero(s, inteiro) {
    s = String(s == null ? '' : s).trim();
    if (!s) return NaN;
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, '')); // 8.123 ou 8,123 = milhar
    const n = Number(s.replace(/\s/g, '').replace(',', '.'));
    return inteiro ? Math.round(n) : n;
  }
  const itens = s => String(s == null ? '' : s).split(/[\n;|]+/).map(x => x.trim()).filter(Boolean);
  function somaPassos(v) {
    const xs = itens(v).map(x => /-/.test(x) ? NaN : lerNumero(x.replace(/[^\d.,]/g, ''), true));
    if (!xs.length || xs.some(x => !Number.isFinite(x) || x < 0)) return NaN;
    return xs.reduce((a, b) => a + b, 0);
  }
  /* sono: "7.5" / "7,5" (horas), "450" (minutos, > 24), "7:30", "7 h 30 min", "7h30" */
  function minutosSono(v) {
    let total = 0;
    const xs = itens(v);
    if (!xs.length) return NaN;
    for (const x0 of xs) {
      const x = semAcento(x0.toLowerCase());
      let m;
      if ((m = /^(\d{1,2})\s*(?::|h)\s*(\d{1,2})?\s*(?:min(?:utos)?)?$/.exec(x)) || (m = /^(\d{1,2})\s*h(?:oras?)?\s*(?:e\s*)?(\d{1,2})?\s*(?:m|min|minutos)?$/.exec(x))) {
        total += (+m[1]) * 60 + (+(m[2] || 0));
        continue;
      }
      if ((m = /^(\d+)\s*(?:m|min|minutos)$/.exec(x))) { total += +m[1]; continue; }
      const n = lerNumero(x.replace(/\s*(?:horas?|hrs?)$/, ''), false);
      if (!Number.isFinite(n) || n < 0) return NaN;
      total += n > 24 ? n : n * 60;
    }
    return Math.round(total);
  }

  /* agenda-lgrsv://saude?data=AAAA-MM-DD&passos=N&sono=H (ou sonoMin=M). Devolve {data, passos?, sonoMin?} ou null. */
  function lerUrlSaude(url, agora) {
    let u;
    try { u = new URL(String(url || '')); } catch (_) { return null; }
    const alvo = (u.host || u.pathname.replace(/^\/+/, '')).toLowerCase();
    if (!/^agenda-lgrsv:$/i.test(u.protocol) || !/^saude\/?$/.test(alvo)) return null;
    const p = u.searchParams;
    let data = p.get('data') || '';
    if (/^ontem$/i.test(data)) data = isoDia(somaDias(agora || new Date(), -1));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) data = isoDia(agora || new Date());
    const r = { data };
    if (p.has('passos')) { const n = somaPassos(p.get('passos')); if (Number.isFinite(n) && n <= 200000) r.passos = n; }
    if (p.has('sonoMin')) { const n = lerNumero(itens(p.get('sonoMin')).reduce((a, b) => a + lerNumero(b, false), 0), true); if (Number.isFinite(n) && n <= 1440) r.sonoMin = n; }
    else if (p.has('sono')) { const n = minutosSono(p.get('sono')); if (Number.isFinite(n) && n <= 1440) r.sonoMin = n; }
    return r.passos == null && r.sonoMin == null ? null : r;
  }

  /* Junta o dia novo no resumo guardado {v:1, dias:{data:{passos?, sonoMin?, em}}}; guarda 90 dias. */
  function saudeMesclar(atual, dia, agora) {
    const est = atual && typeof atual === 'object' && atual.dias && typeof atual.dias === 'object' ? atual : { v: 1, dias: {} };
    const dias = { ...est.dias };
    if (dia && /^\d{4}-\d{2}-\d{2}$/.test(dia.data)) {
      const antes = dias[dia.data] || {};
      const novo = { ...antes, em: (agora || new Date()).toISOString() };
      if (Number.isFinite(dia.passos)) novo.passos = dia.passos;
      if (Number.isFinite(dia.sonoMin)) novo.sonoMin = dia.sonoMin;
      dias[dia.data] = novo;
    }
    const limite = isoDia(somaDias(agora || new Date(), -90));
    Object.keys(dias).forEach(k => { if (k < limite) delete dias[k]; });
    return { v: 1, dias };
  }

  /* Últimos 7 dias até hoje + médias dos dias que têm número. */
  function saudeSemana(est, agora) {
    agora = agora || new Date();
    const dias = (est && est.dias) || {};
    const lista = [];
    for (let i = 6; i >= 0; i--) {
      const d = isoDia(somaDias(agora, -i)), x = dias[d] || {};
      lista.push({ data: d, passos: Number.isFinite(x.passos) ? x.passos : null, sonoMin: Number.isFinite(x.sonoMin) ? x.sonoMin : null });
    }
    const media = k => { const v = lista.map(x => x[k]).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
    return { dias: lista, mediaPassos: media('passos'), mediaSonoMin: media('sonoMin') };
  }

  /* Erro do plugin -> frase para o João. */
  function mensagemErro(e, funcao) {
    const code = e && (e.code || (e.data && e.data.code));
    const msg = String(typeof e === 'string' ? e : (e && (e.message || e.errorMessage)) || '').trim();
    if (code === 'SEM_PERMISSAO') return msg || `Sem permissão para ${funcao || 'esta função'}. Libere em Ajustes > Agenda.`;
    if (code === 'SEM_MODELO_LOCAL') return 'Este iPhone não tem o ditado em português no aparelho.';
    if (code === 'UNIMPLEMENTED' || /not implemented|unimplemented|is not available/i.test(msg)) return 'Esta versão do app ainda não tem esta função. Atualize o app (menu ⋯ > Renovação do app).';
    return msg || 'Não deu certo. Tente de novo.';
  }

  const Logica = { interpretarDitado, linksTelefone, lerUrlSaude, saudeMesclar, saudeSemana, minutosSono, somaPassos, mensagemErro, isoDia };
  if (typeof module !== 'undefined' && module.exports) module.exports = Logica;
  if (!raiz || !raiz.document) return;
  raiz.AgendaAcessosLogica = Logica;

  // ---------------------------------------------------------------- interface
  const doc = raiz.document;
  const C = raiz.Capacitor;
  const NATIVO = !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
  const registrar = nome => {
    if (C.Plugins && C.Plugins[nome] && typeof C.registerPlugin !== 'function') return C.Plugins[nome];
    if (typeof C.registerPlugin === 'function') return C.registerPlugin(nome);
    return new Proxy({}, { get(_, metodo) {
      if (typeof metodo !== 'string' || metodo === 'then') return undefined;
      if (metodo === 'addListener') return (evento, cb) => {
        const id = C.nativeCallback(nome, 'addListener', { eventName: evento }, cb);
        return { remove: () => C.nativePromise(nome, 'removeListener', { callbackId: id, eventName: evento }) };
      };
      return opcoes => C.nativePromise(nome, metodo, opcoes || {});
    } });
  };
  const cab = NATIVO ? (C.PluginHeaders || []).find(h => h.name === 'AgendaAcesso') : null;
  const tem = m => !!(cab && (cab.methods || []).some(x => x.name === m));
  const AC = cab ? registrar('AgendaAcesso') : null;
  const PODE = AC && tem('ditadoIniciar') ? AC : null;
  const AVISO_SEM = NATIVO ? 'Esta versão do app ainda não tem esta função. Atualize o app (menu ⋯ > Renovação do app > Atualizar o app).'
    : 'Disponível só no app Agenda instalado no iPhone.';
  const TK = 'agenda_lagares_v3', NK = 'agenda_notas_v1', SK = 'agenda_saude_v1', CAL_INICIO = 'agenda_cal_inicio';
  const lerJson = (k, p) => { try { const v = JSON.parse(localStorage.getItem(k) || ''); return v == null ? p : v; } catch (_) { return p; } };
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (id, el) => (el || doc).querySelector('#' + id);
  const log = (...a) => { try { console.log('[acessos]', ...a); } catch (_) {} };
  function toast(msg, ms) {
    const t = $('toast');
    if (!t) { log(msg); return; }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms || 3200);
  }
  const fmtDiaCurto = iso => { const [a, m, d] = String(iso).split('-'); return `${d}/${m}`; };
  const fmtHora = ms => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtSono = min => min == null ? '—' : `${Math.floor(min / 60)}h${pad(min % 60)}`;

  function tarefas(soComHora) {
    const t = lerJson(TK, []);
    if (!Array.isArray(t)) return [];
    const corte = isoDia(somaDias(new Date(), -7));
    return t.filter(x => x && !x.done && x.text && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date || '')) && x.date >= corte && (!soComHora || /^\d{2}:\d{2}$/.test(String(x.time || ''))))
      .sort((a, b) => `${a.date} ${a.time || '99'}`.localeCompare(`${b.date} ${b.time || '99'}`)).slice(0, 80);
  }
  const opcoesTarefas = soComHora => tarefas(soComHora).map(t => `<option value="${esc(t.id)}">${esc(fmtDiaCurto(t.date))}${t.time ? ' ' + esc(t.time) : ''} · ${esc(String(t.text).slice(0, 60))}</option>`).join('')
    || '<option value="">(nenhuma tarefa pendente)</option>';

  // ---- estilos
  const css = doc.createElement('style');
  css.textContent = `
#vozFab{position:relative;z-index:5;order:-1;width:48px;height:48px;display:grid;place-items:center;border:1px solid var(--line);border-radius:15px;background:var(--surface);color:var(--accent);box-shadow:0 10px 24px rgba(0,0,0,.25);transition:transform .14s ease}
#vozFab:active{transform:scale(.94)}
#vozDialog textarea{width:100%;min-height:84px;padding:11px 12px;border:1px solid var(--line);border-radius:13px;background:var(--soft);color:var(--text);font:inherit;font-size:16px;resize:vertical}
#vozDialog .voz-ouvir{display:flex;align-items:center;gap:10px;margin:8px 0}
#vozDialog .voz-ouvir button{flex:0 0 auto}
#vozDialog .voz-ouvir small{color:var(--muted)}
#vozDialog .voz-dica{margin:4px 0 8px;font-size:14px;color:var(--muted)}
#vozOuvir.rec,#jarvis-mic.rec-nativo{background:#e5484d!important;color:#fff!important;border-color:#e5484d!important}
#acessosDialog .ac-sec{border-top:1px solid var(--line);margin-top:12px;padding-top:10px}
#acessosDialog h4{margin:0 0 6px;font-size:15px}
#acessosDialog .ac-linha{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0}
#acessosDialog .ac-linha>*{flex:1 1 auto}
#acessosDialog input[type=search],#acessosDialog select{width:100%;min-height:44px;padding:9px 11px;border:1px solid var(--line);border-radius:12px;background:var(--soft);color:var(--text);font-size:16px}
#acessosDialog .ac-lista{max-height:240px;overflow:auto;-webkit-overflow-scrolling:touch}
#acessosDialog .ac-item{padding:7px 0;border-bottom:1px solid var(--line)}
#acessosDialog .ac-item:last-child{border-bottom:0}
#acessosDialog .ac-item small{color:var(--muted)}
#acessosDialog .ac-acoes{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px}
#acessosDialog .ac-acoes button{min-height:34px;padding:6px 10px;border-radius:10px;border:1px solid var(--line);background:var(--soft);color:var(--text);font-size:13px}
#acessosDialog .ac-aviso{font-size:13px;color:var(--muted)}
#acessosDialog table{width:100%;border-collapse:collapse;font-size:13px}
#acessosDialog td,#acessosDialog th{padding:4px 2px;text-align:right}
#acessosDialog td:first-child,#acessosDialog th:first-child{text-align:left}
#acessosDialog ol{margin:6px 0 0;padding-left:20px;font-size:13px;color:var(--muted)}
#acessosDialog code{font-size:12px;word-break:break-all}
#calIphoneHoje{margin:8px 0 2px;padding:9px 12px;border:1px solid var(--line);border-radius:14px;background:var(--surface);font-size:13px}
#calIphoneHoje b{font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:3px}
#calIphoneHoje div{display:flex;gap:8px;padding:1px 0}
#calIphoneHoje span:first-child{min-width:44px;color:var(--accent);font-variant-numeric:tabular-nums}`;
  doc.head.appendChild(css);

  // ---- ditado nativo (um ouvinte só; quem está ouvindo recebe os trechos)
  let ouvinte = null, ouvindo = null, nuvemAceita = false;
  function garantirOuvinte() {
    if (ouvinte || !PODE) return;
    ouvinte = PODE.addListener('ditado', ev => {
      const o = ouvindo;
      if (!o) return;
      if (ev && typeof ev.texto === 'string') o.parcial(ev.texto);
      if (ev && ev.fim) { ouvindo = null; o.fim(ev.texto || ''); }
    });
  }
  async function comecarDitado(parcial, fim) {
    garantirOuvinte();
    const opc = soLocal => ({ idioma: 'pt-BR', soNoAparelho: soLocal, segundosMax: 60 });
    let r;
    try {
      r = await PODE.ditadoIniciar(opc(!nuvemAceita));
    } catch (e) {
      const code = e && (e.code || (e.data && e.data.code));
      if (code !== 'SEM_MODELO_LOCAL') throw e;
      if (!raiz.confirm('Este iPhone não tem o ditado em português no próprio aparelho.\n\nUsar a transcrição da Apple desta vez? O áudio vai para os servidores da Apple (não para a Agenda nem para o Jarvis).\n\nPara ficar só no aparelho: Ajustes > Geral > Teclado > Ditado, com o idioma Português (Brasil).')) throw new Error('cancelado');
      nuvemAceita = true;
      r = await PODE.ditadoIniciar(opc(false));
    }
    ouvindo = { parcial, fim };
    return r || {};
  }
  async function pararDitado(cancelar) {
    const o = ouvindo; ouvindo = null;
    let texto = '';
    try { const r = await PODE.ditadoParar({ cancelar: !!cancelar }); texto = (r && r.texto) || ''; } catch (_) {}
    if (o && !cancelar) o.fim(texto);
    return texto;
  }

  // ---- 1) botão Falar + tela de confirmação
  let vozUi = null, vozCamposMexidos = false, vozOuvindo = false;
  function montarVoz() {
    if ($('vozFab')) return;
    const dock = $('agendaActions');
    if (!dock) return;
    const b = doc.createElement('button');
    b.id = 'vozFab'; b.type = 'button'; b.title = 'Falar uma tarefa'; b.setAttribute('aria-label', 'Falar uma tarefa');
    b.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3.5"/></svg>';
    dock.insertBefore(b, dock.firstChild);
    vozUi = doc.createElement('dialog');
    vozUi.id = 'vozDialog';
    vozUi.innerHTML = `<div class="modal">
      <h3>Falar</h3>
      <p class="voz-dica" id="vozDica">${PODE ? 'Fale a tarefa ou a pergunta. Ex.: "pagar a conta de luz amanhã às 9".' : esc(AVISO_SEM) + ' Aqui, use o microfone do teclado para ditar.'}</p>
      <div class="voz-ouvir"><button class="secondary" id="vozOuvir" type="button"${PODE ? '' : ' hidden'}>Ouvir</button><small id="vozEstado"></small></div>
      <textarea id="vozTexto" maxlength="1000" placeholder="O texto aparece aqui; dá para corrigir antes de criar."></textarea>
      <div class="two-fields">
        <div><label class="field-label" for="vozData">Data</label><input id="vozData" type="date"></div>
        <div><label class="field-label" for="vozHora">Hora</label><input id="vozHora" type="time"></div>
      </div>
      <p class="voz-dica" id="vozAviso" hidden></p>
      <div class="actions">
        <button class="secondary" id="vozFechar" type="button">Fechar</button>
        <button class="secondary" id="vozJarvis" type="button">Perguntar ao Jarvis</button>
        <button class="primary" id="vozTarefa" type="button">Criar tarefa</button>
      </div>
    </div>`;
    doc.body.appendChild(vozUi);
    const txt = $('vozTexto', vozUi), dt = $('vozData', vozUi), hr = $('vozHora', vozUi), est = $('vozEstado', vozUi), ouv = $('vozOuvir', vozUi), av = $('vozAviso', vozUi);
    const aplicar = () => {
      if (vozCamposMexidos) return;
      const r = interpretarDitado(txt.value);
      dt.value = r.data; hr.value = r.hora;
      av.hidden = !r.horaDuvida; av.textContent = r.horaDuvida ? 'A hora ficou ambígua (manhã ou tarde?): confira o campo Hora.' : '';
    };
    const textoFinal = () => (vozCamposMexidos ? txt.value.trim() : interpretarDitado(txt.value).texto) || txt.value.trim();
    [dt, hr].forEach(i => i.addEventListener('input', () => { vozCamposMexidos = true; }));
    txt.addEventListener('input', () => { clearTimeout(aplicar._t); aplicar._t = setTimeout(aplicar, 250); });
    const pararUi = () => { vozOuvindo = false; ouv.classList.remove('rec'); ouv.textContent = 'Ouvir'; if (/Ouvindo/.test(est.textContent)) est.textContent = ''; };
    async function alternar() {
      if (!PODE) return;
      if (vozOuvindo) { est.textContent = 'Terminando…'; await pararDitado(false); return; }
      vozCamposMexidos = false; txt.value = ''; aplicar();
      try {
        vozOuvindo = true; ouv.classList.add('rec'); ouv.textContent = 'Parar'; est.textContent = 'Ouvindo… fale e toque em Parar.';
        const r = await comecarDitado(p => { txt.value = p; }, f => { if (f) txt.value = f; pararUi(); aplicar(); est.textContent = txt.value ? 'Confira e escolha abaixo.' : 'Não ouvi nada. Toque em Ouvir de novo.'; });
        if (r.noAparelho === false) est.textContent = 'Ouvindo… (transcrição da Apple)';
      } catch (e) {
        pararUi();
        est.textContent = /cancelado/.test(String(e && e.message)) ? '' : mensagemErro(e, 'o microfone');
      }
    }
    ouv.addEventListener('click', alternar);
    b.addEventListener('click', () => {
      vozCamposMexidos = false; txt.value = ''; av.hidden = true; est.textContent = '';
      dt.value = isoDia(new Date()); hr.value = '';
      vozUi.showModal();
      if (PODE) alternar(); else setTimeout(() => txt.focus(), 80);
    });
    const fechar = () => { if (vozOuvindo) pararDitado(true).then(pararUi); vozUi.close(); };
    $('vozFechar', vozUi).addEventListener('click', fechar);
    vozUi.addEventListener('cancel', e => { e.preventDefault(); fechar(); });
    $('vozTarefa', vozUi).addEventListener('click', () => {
      const texto = textoFinal();
      if (!texto) { est.textContent = 'Fale ou escreva a tarefa primeiro.'; return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dt.value)) { est.textContent = 'Escolha a data.'; return; }
      fechar();
      criarTarefa(texto, dt.value, hr.value);
    });
    $('vozJarvis', vozUi).addEventListener('click', () => {
      const texto = txt.value.trim();
      if (!texto) { est.textContent = 'Fale ou escreva a pergunta primeiro.'; return; }
      fechar();
      perguntarJarvis(texto);
    });
  }

  /* Cria pela tela normal de "Nova tarefa" (mesmas regras de lembrete e de sincronização). */
  function criarTarefa(texto, data, hora) {
    const abrir = $('openDialog'), form = $('taskForm');
    if (!abrir || !form) { toast('Não achei a tela de nova tarefa.'); return false; }
    abrir.click();
    $('taskText').value = texto.slice(0, 240);
    $('taskDate').value = data;
    $('taskTime').value = hora || '';
    if (typeof form.requestSubmit === 'function') form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true }));
    return true;
  }
  /* Abre o formulário preenchido (o João confere e salva). */
  function abrirTarefa(texto, data, hora) {
    const abrir = $('openDialog');
    if (!abrir) return;
    abrir.click();
    $('taskText').value = texto.slice(0, 240);
    if (data) $('taskDate').value = data;
    if (hora) $('taskTime').value = hora;
  }
  function perguntarJarvis(texto) {
    const painel = $('jarvis-panel'), btn = $('jarvis-btn'), input = $('jarvis-input'), enviar = $('jarvis-send');
    if (!input || !enviar) { toast('O Jarvis não está nesta página.'); return; }
    if (painel && !painel.classList.contains('open') && btn) btn.click();
    setTimeout(() => { input.value = texto; input.dispatchEvent(new Event('input')); enviar.click(); }, 350);
  }

  // Microfone do Jarvis no app: usa o ditado nativo (a fala do WebView não funciona no app).
  if (PODE) {
    let jOuvindo = false;
    doc.addEventListener('click', async ev => {
      const mic = ev.target && ev.target.closest && ev.target.closest('#jarvis-mic');
      if (!mic) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      const input = $('jarvis-input'), status = $('jarvis-status');
      const fim = () => { jOuvindo = false; mic.classList.remove('rec-nativo'); };
      if (jOuvindo) { await pararDitado(false); return; }
      try {
        jOuvindo = true; mic.classList.add('rec-nativo');
        if (status) status.textContent = 'OUVINDO… TOQUE DE NOVO PARA ENVIAR';
        await comecarDitado(p => { if (input) input.value = p; }, f => {
          fim();
          if (status) status.textContent = 'ASSISTENTE PESSOAL · CLAUDE';
          const t = (f || (input && input.value) || '').trim();
          if (t && input) { input.value = t; const s = $('jarvis-send'); if (s) s.click(); }
        });
      } catch (e) {
        fim();
        if (status && !/cancelado/.test(String(e && e.message))) status.textContent = mensagemErro(e, 'o microfone').toUpperCase().slice(0, 60);
      }
    }, true);
  }

  // ---- 2) Acessos do iPhone (menu ⋯)
  let acUi = null;
  function montarMenu() {
    const menu = $('quickMenu');
    if (!menu || $('acessosBtn')) return;
    const b = doc.createElement('button');
    b.id = 'acessosBtn'; b.type = 'button'; b.title = 'Contatos, calendário, fotos, arquivos e Saúde';
    b.innerHTML = '<span class="menu-option-icon"><svg viewBox="0 0 24 24"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 18.5h3"/></svg></span><span>Acessos do iPhone</span>';
    const ref = $('renovacaoBtn') || $('renovacaoDiag');
    menu.insertBefore(b, ref ? ref.nextSibling : menu.firstChild);
    b.addEventListener('click', abrirAcessos);
  }

  function montarAcessos() {
    if (acUi) return;
    const off = PODE ? '' : ' disabled';
    acUi = doc.createElement('dialog');
    acUi.id = 'acessosDialog';
    acUi.innerHTML = `<div class="modal">
      <h3>Acessos do iPhone</h3>
      <p class="ac-aviso">${PODE ? 'Cada acesso só é pedido quando você toca na função. Nada daqui vai para a nuvem, exceto o resumo da Saúde (só números do dia).' : esc(AVISO_SEM)}</p>
      <div class="ac-sec"><h4>Contatos</h4>
        <div class="ac-linha"><input type="search" id="acBusca" placeholder="Nome ou telefone" autocomplete="off"${off}></div>
        <div class="ac-linha"><button class="secondary" id="acBuscar" type="button"${off}>Buscar</button><button class="secondary" id="acNovoContato" type="button"${off}>Novo contato</button></div>
        <div class="ac-lista" id="acContatos"></div>
      </div>
      <div class="ac-sec"><h4>Calendário</h4>
        <div class="ac-linha"><button class="secondary" id="acCalHoje" type="button"${off}>Hoje</button><button class="secondary" id="acCalSemana" type="button"${off}>Semana</button></div>
        <label class="ac-linha"><input type="checkbox" id="acCalInicio" style="flex:0 0 auto"${off}> <span>Mostrar os eventos de hoje na tela inicial</span></label>
        <div class="ac-lista" id="acEventos"></div>
        <label class="field-label" for="acTarefaEvento">Criar evento de uma tarefa com horário</label>
        <div class="ac-linha"><select id="acTarefaEvento"${off}></select></div>
        <div class="ac-linha"><button class="secondary" id="acCriarEvento" type="button"${off}>Criar evento</button></div>
      </div>
      <div class="ac-sec"><h4>Fotos e arquivos</h4>
        <label class="field-label" for="acTarefaAnexo">Tarefa</label>
        <div class="ac-linha"><select id="acTarefaAnexo"${off}></select></div>
        <div class="ac-linha"><button class="secondary" id="acFoto" type="button"${off}>Anexar foto</button><button class="secondary" id="acDoc" type="button"${off}>Anexar documento</button><button class="secondary" id="acExportar" type="button"${off}>Exportar tarefa</button></div>
        <p class="ac-aviso">Os anexos ficam só neste iPhone (não sincronizam).</p>
        <div class="ac-lista" id="acAnexos"></div>
      </div>
      <div class="ac-sec"><h4>Saúde (passos e sono)</h4>
        <p class="ac-aviso" id="acSaudeEstado">Leitura direta do app Saúde: indisponível nesta instalação. A conta Apple grátis aceita o HealthKit, mas o app é reassinado pelo próprio iPhone sem esse direito de uso.</p>
        <div id="acSaude"></div>
        <details><summary class="field-label">Como mandar os números pelo Atalhos</summary>
          <ol>
            <li>Atalhos &gt; Automação &gt; Nova &gt; Hora do Dia (ex.: 22:00) &gt; Executar Imediatamente.</li>
            <li>Encontrar Amostras de Saúde: Tipo é Passos, Data de Início é Hoje. Depois Calcular Estatísticas: Soma.</li>
            <li>Encontrar Amostras de Saúde: Tipo é Análise do Sono, Valor é Dormindo, Data de Início nas últimas 24 horas. Depois Obter Detalhes: Duração e Calcular Estatísticas: Soma (em minutos).</li>
            <li>Abrir URLs: <code>agenda-lgrsv://saude?passos=[Soma dos passos]&amp;sonoMin=[Soma do sono]</code></li>
          </ol>
          <p class="ac-aviso">A Agenda abre, guarda só os dois números do dia e sincroniza com a sua conta. Aceita também <code>sono=7,5</code> (horas) e <code>data=AAAA-MM-DD</code>.</p>
        </details>
      </div>
      <div class="actions"><button class="primary" id="acFechar" type="button">Fechar</button></div>
    </div>`;
    doc.body.appendChild(acUi);
    const q = id => $(id, acUi);
    q('acFechar').addEventListener('click', () => acUi.close());
    q('acBuscar').addEventListener('click', buscarContatos);
    q('acBusca').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); buscarContatos(); } });
    q('acNovoContato').addEventListener('click', novoContato);
    q('acContatos').addEventListener('click', acaoContato);
    q('acCalHoje').addEventListener('click', () => listarEventos(0));
    q('acCalSemana').addEventListener('click', () => listarEventos(6));
    q('acCalInicio').checked = localStorage.getItem(CAL_INICIO) === '1';
    q('acCalInicio').addEventListener('change', async e => {
      if (e.target.checked) {
        const ok = await listarEventos(0);
        if (ok) localStorage.setItem(CAL_INICIO, '1'); else e.target.checked = false;
      } else localStorage.removeItem(CAL_INICIO);
      desenharCalHoje();
    });
    q('acCriarEvento').addEventListener('click', criarEvento);
    q('acTarefaAnexo').addEventListener('change', listarAnexos);
    q('acFoto').addEventListener('click', anexarFoto);
    q('acDoc').addEventListener('click', anexarDocumento);
    q('acExportar').addEventListener('click', exportarTarefa);
    q('acAnexos').addEventListener('click', acaoAnexo);
  }

  function abrirAcessos() {
    montarAcessos();
    $('acTarefaEvento', acUi).innerHTML = opcoesTarefas(true);
    const sel = $('acTarefaAnexo', acUi), antes = sel.value;
    sel.innerHTML = opcoesTarefas(false);
    if (antes && [...sel.options].some(o => o.value === antes)) sel.value = antes;
    desenharSaude();
    listarAnexos();
    if (!acUi.open) acUi.showModal();
  }

  // contatos
  let contatos = [];
  async function buscarContatos() {
    if (!PODE) return;
    const lista = $('acContatos', acUi);
    lista.innerHTML = '<p class="ac-aviso">Buscando…</p>';
    try {
      const r = await PODE.contatosBuscar({ termo: $('acBusca', acUi).value.trim(), limite: 30 });
      contatos = (r && r.contatos) || [];
      const limitado = r && r.status === 'limited' ? '<p class="ac-aviso">Acesso limitado: só os contatos que você liberou aparecem.</p>' : '';
      lista.innerHTML = limitado + (contatos.length ? contatos.map((c, i) => `<div class="ac-item"><strong>${esc(c.nome || '(sem nome)')}</strong>
        ${(c.telefones || []).map((t, j) => `<div><small>${esc(t.rotulo || 'telefone')}: ${esc(t.numero)}</small>
          <div class="ac-acoes"><button type="button" data-c="${i}" data-t="${j}" data-a="ligar">Ligar</button><button type="button" data-c="${i}" data-t="${j}" data-a="wa">WhatsApp</button><button type="button" data-c="${i}" data-t="${j}" data-a="tarefa">Tarefa "falar com"</button></div></div>`).join('')
          || `<div class="ac-acoes"><button type="button" data-c="${i}" data-a="tarefa">Tarefa "falar com"</button></div>`}</div>`).join('') : '<p class="ac-aviso">Nenhum contato encontrado.</p>');
    } catch (e) { lista.innerHTML = `<p class="ac-aviso">${esc(mensagemErro(e, 'os contatos'))}</p>`; }
  }
  function abrirLink(url) {
    if (NATIVO || /^tel:/.test(url)) raiz.location.href = url; else raiz.open(url, '_blank', 'noopener');
  }
  function acaoContato(ev) {
    const b = ev.target.closest('button[data-a]');
    if (!b) return;
    const c = contatos[+b.dataset.c];
    if (!c) return;
    const t = b.dataset.t != null ? (c.telefones || [])[+b.dataset.t] : null;
    const links = t ? linksTelefone(t.numero) : null;
    if (b.dataset.a === 'ligar' && links) abrirLink(links.tel);
    else if (b.dataset.a === 'wa' && links) abrirLink(links.whatsapp);
    else if (b.dataset.a === 'tarefa') { acUi.close(); abrirTarefa(`Falar com ${c.nome}${t ? ' · ' + t.numero : ''}`, isoDia(new Date()), ''); }
  }
  async function novoContato() {
    if (!PODE) return;
    const termo = $('acBusca', acUi).value.trim();
    const ehTel = /^[\d\s()+-]{8,}$/.test(termo);
    try {
      const r = await PODE.contatoNovo(ehTel ? { telefone: termo } : { nome: termo });
      if (r && r.salvo) { toast(`Contato salvo${r.nome ? ': ' + r.nome : ''}.`); buscarContatos(); }
    } catch (e) { toast(mensagemErro(e, 'os contatos'), 5000); }
  }

  // calendário
  async function eventosDoPeriodo(diasAMais) {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + diasAMais + 1);
    const r = await PODE.calendarioEventos({ inicio: hoje.getTime(), fim: fim.getTime() });
    return (r && r.eventos) || [];
  }
  async function listarEventos(diasAMais) {
    if (!PODE) return false;
    const lista = $('acEventos', acUi);
    lista.innerHTML = '<p class="ac-aviso">Lendo o calendário…</p>';
    try {
      const evs = await eventosDoPeriodo(diasAMais);
      let dia = '';
      lista.innerHTML = evs.length ? evs.map(e => {
        const d = isoDia(new Date(e.inicio)), cab = diasAMais && d !== dia ? `<div class="field-label">${esc(fmtDiaCurto(d))}</div>` : '';
        dia = d;
        return `${cab}<div class="ac-item">${e.diaInteiro ? 'dia inteiro' : esc(fmtHora(e.inicio))} · <strong>${esc(e.titulo || '(sem título)')}</strong>${e.local ? ` <small>${esc(e.local)}</small>` : ''} <small>· ${esc(e.calendario)}</small></div>`;
      }).join('') : '<p class="ac-aviso">Nenhum evento no período.</p>';
      return true;
    } catch (e) { lista.innerHTML = `<p class="ac-aviso">${esc(mensagemErro(e, 'o calendário'))}</p>`; return false; }
  }
  async function criarEvento() {
    if (!PODE) return;
    const id = $('acTarefaEvento', acUi).value;
    const t = lerJson(TK, []).find(x => x && String(x.id) === String(id));
    if (!t || !t.time) { toast('Escolha uma tarefa com horário.'); return; }
    const inicio = new Date(`${t.date}T${t.time}:00`).getTime();
    const nota = (lerJson(NK, {}) || {})[t.id] || {};
    const dur = Number(nota.durationMin) > 0 ? Number(nota.durationMin) : 60;
    try {
      const r = await PODE.calendarioCriar({ titulo: t.text, inicio, fim: inicio + dur * 60000, notas: nota.detail || '' });
      if (r && r.salvo) toast('Evento criado no calendário.');
    } catch (e) { toast(mensagemErro(e, 'o calendário'), 5000); }
  }
  // eventos de hoje na tela inicial (só se o João ligou e a permissão já existe: nunca pede aqui)
  async function desenharCalHoje() {
    let caixa = $('calIphoneHoje');
    const ligado = PODE && localStorage.getItem(CAL_INICIO) === '1';
    if (!ligado) { if (caixa) caixa.remove(); return; }
    try {
      const st = await PODE.estado();
      if (!st || st.calendario !== 'granted') { if (caixa) caixa.remove(); return; }
      const agora = Date.now();
      const evs = (await eventosDoPeriodo(0)).filter(e => e.diaInteiro || e.fim > agora).slice(0, 4);
      if (!evs.length) { if (caixa) caixa.remove(); return; }
      if (!caixa) {
        const tabs = $('viewTabs');
        if (!tabs) return;
        caixa = doc.createElement('section'); caixa.id = 'calIphoneHoje'; caixa.setAttribute('aria-label', 'Calendário do iPhone hoje');
        tabs.parentNode.insertBefore(caixa, tabs);
      }
      caixa.innerHTML = '<b>Calendário do iPhone · hoje</b>' + evs.map(e => `<div><span>${e.diaInteiro ? 'dia' : esc(fmtHora(e.inicio))}</span><span>${esc(e.titulo || '(sem título)')}</span></div>`).join('');
    } catch (e) { log('calendário na tela inicial', e && e.message); }
  }

  // anexos (IndexedDB, só neste aparelho)
  let bancoP = null;
  function banco() {
    if (bancoP) return bancoP;
    bancoP = new Promise((res, rej) => {
      const r = raiz.indexedDB.open('agenda_anexos', 1);
      r.onupgradeneeded = () => { const s = r.result.createObjectStore('anexos', { keyPath: 'id', autoIncrement: true }); s.createIndex('tarefa', 'tarefa'); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => { bancoP = null; rej(r.error); };
    });
    return bancoP;
  }
  async function op(modo, fn) {
    const db = await banco();
    return new Promise((res, rej) => {
      const tx = db.transaction('anexos', modo), s = tx.objectStore('anexos');
      const r = fn(s);
      tx.oncomplete = () => res(r && r.result);
      tx.onerror = () => rej(tx.error);
    });
  }
  const anexosDe = tarefa => op('readonly', s => s.index('tarefa').getAll(String(tarefa)));
  const guardarAnexo = a => op('readwrite', s => s.add({ ...a, tarefa: String(a.tarefa), criado: new Date().toISOString() }));
  const lerAnexo = id => op('readonly', s => s.get(Number(id)));
  const apagarAnexo = id => op('readwrite', s => s.delete(Number(id)));
  const tarefaEscolhida = () => $('acTarefaAnexo', acUi).value;
  const kb = n => n > 1048576 ? `${(n / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

  async function listarAnexos() {
    const lista = $('acAnexos', acUi), id = tarefaEscolhida();
    if (!id || !raiz.indexedDB) { lista.innerHTML = ''; return; }
    try {
      const xs = await anexosDe(id);
      lista.innerHTML = xs.length ? xs.map(a => `<div class="ac-item"><strong>${esc(a.nome)}</strong> <small>${esc(kb(a.tamanho || 0))}</small>
        <div class="ac-acoes"><button type="button" data-id="${a.id}" data-a="abrir"${PODE ? '' : ' disabled'}>Abrir</button>${/^image\/|pdf/.test(a.tipo || '') ? `<button type="button" data-id="${a.id}" data-a="rolo"${PODE ? '' : ' disabled'}>Salvar no rolo</button>` : ''}<button type="button" data-id="${a.id}" data-a="apagar">Remover</button></div></div>`).join('')
        : '<p class="ac-aviso">Sem anexos nesta tarefa.</p>';
    } catch (e) { lista.innerHTML = `<p class="ac-aviso">Anexos indisponíveis: ${esc(e && e.message)}</p>`; }
  }
  async function anexarFoto() {
    if (!PODE) return;
    const id = tarefaEscolhida(); if (!id) { toast('Escolha a tarefa.'); return; }
    try {
      const r = await PODE.fotoEscolher({ max: 5, largura: 1600 });
      const fotos = (r && r.fotos) || [];
      for (const f of fotos) await guardarAnexo({ tarefa: id, nome: f.nome, tipo: f.tipo, tamanho: f.tamanho, base64: f.base64 });
      if (fotos.length) toast(`${fotos.length} foto${fotos.length > 1 ? 's' : ''} anexada${fotos.length > 1 ? 's' : ''}.`);
      listarAnexos();
    } catch (e) { toast(mensagemErro(e, 'as fotos'), 5000); }
  }
  async function anexarDocumento() {
    if (!PODE) return;
    const id = tarefaEscolhida(); if (!id) { toast('Escolha a tarefa.'); return; }
    try {
      const r = await PODE.arquivoEscolher({ maxMB: 15 });
      if (!r || r.cancelado || !r.base64) return;
      await guardarAnexo({ tarefa: id, nome: r.nome, tipo: r.tipo, tamanho: r.tamanho, base64: r.base64 });
      toast('Documento anexado.');
      listarAnexos();
    } catch (e) { toast(mensagemErro(e, 'os arquivos'), 5000); }
  }
  async function acaoAnexo(ev) {
    const b = ev.target.closest('button[data-a]');
    if (!b) return;
    try {
      if (b.dataset.a === 'apagar') {
        if (!raiz.confirm('Remover este anexo deste iPhone?')) return;
        await apagarAnexo(b.dataset.id); listarAnexos(); return;
      }
      const a = await lerAnexo(b.dataset.id);
      if (!a || !PODE) return;
      if (b.dataset.a === 'abrir') await PODE.arquivoAbrir({ base64: a.base64, nome: a.nome });
      else if (b.dataset.a === 'rolo') { const r = await PODE.fotoSalvar({ base64: a.base64, tipo: a.tipo }); toast(`Salvo no rolo (${(r && r.salvas) || 1} imagem${r && r.salvas > 1 ? 'ns' : ''}).`); }
    } catch (e) { toast(mensagemErro(e, 'as fotos'), 5000); }
  }
  function textoDaTarefa(t, nota) {
    const [a, m, d] = String(t.date).split('-');
    const linhas = [`Tarefa: ${t.text}`, `Data: ${d}/${m}/${a}${t.time ? ' às ' + t.time : ''}`];
    if (t.tag) linhas.push(`Etiqueta: ${t.tag}`);
    linhas.push(`Situação: ${t.done ? 'concluída' : 'pendente'}`);
    if (nota && String(nota.detail || '').trim()) linhas.push('', 'Nota:', String(nota.detail).trim());
    if (nota && Array.isArray(nota.subs) && nota.subs.length) linhas.push('', 'Subtarefas:', ...nota.subs.map(s => `[${s && s.done ? 'x' : ' '}] ${s && (s.text || s.t || '')}`));
    return linhas.join('\n') + '\n';
  }
  async function exportarTarefa() {
    if (!PODE) return;
    const id = tarefaEscolhida();
    const t = lerJson(TK, []).find(x => x && String(x.id) === String(id));
    if (!t) { toast('Escolha a tarefa.'); return; }
    const slug = semAcento(t.text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'tarefa';
    try {
      const r = await PODE.arquivoExportar({ texto: textoDaTarefa(t, (lerJson(NK, {}) || {})[t.id]), nome: `tarefa-${t.date}-${slug}.txt` });
      if (r && r.salvo) toast('Tarefa exportada para o Arquivos.');
    } catch (e) { toast(mensagemErro(e, 'os arquivos'), 5000); }
  }

  // saúde
  function desenharSaude() {
    const caixa = $('acSaude', acUi);
    const s = saudeSemana(lerJson(SK, null));
    const temAlgum = s.dias.some(d => d.passos != null || d.sonoMin != null);
    caixa.innerHTML = temAlgum ? `<table><tr><th>Dia</th><th>Passos</th><th>Sono</th></tr>${s.dias.map(d => `<tr><td>${esc(fmtDiaCurto(d.data))}</td><td>${d.passos == null ? '—' : d.passos.toLocaleString('pt-BR')}</td><td>${fmtSono(d.sonoMin)}</td></tr>`).join('')}
      <tr><th>Média</th><th>${s.mediaPassos == null ? '—' : s.mediaPassos.toLocaleString('pt-BR')}</th><th>${fmtSono(s.mediaSonoMin)}</th></tr></table>`
      : '<p class="ac-aviso">Ainda sem números. Configure a automação do Atalhos abaixo.</p>';
  }
  // abertura: o getLaunchUrl devolve a URL de lançamento enquanto o processo do app viver (uma recarga da página
  // dias depois não pode regravar números velhos no dia de hoje): só processa uma URL de lançamento nova.
  const ULTIMA_URL = 'agenda_saude_ultima_url';
  function receberUrl(url, deLancamento) {
    const dia = lerUrlSaude(url);
    if (!dia) return;
    if (deLancamento && localStorage.getItem(ULTIMA_URL) === url) return;
    if (receberUrl._ultima === url && Date.now() - receberUrl._em < 10000) return; // o mesmo toque chega pelos dois caminhos
    receberUrl._ultima = url; receberUrl._em = Date.now();
    try { localStorage.setItem(ULTIMA_URL, url); } catch (_) {}
    localStorage.setItem(SK, JSON.stringify(saudeMesclar(lerJson(SK, null), dia)));
    toast(`Saúde ${fmtDiaCurto(dia.data)}: ${dia.passos != null ? dia.passos.toLocaleString('pt-BR') + ' passos' : ''}${dia.passos != null && dia.sonoMin != null ? ' · ' : ''}${dia.sonoMin != null ? fmtSono(dia.sonoMin) + ' de sono' : ''}`, 4500);
    if (acUi && acUi.open) desenharSaude();
  }
  if (NATIVO) {
    try {
      const App = registrar('App');
      App.addListener('appUrlOpen', ev => { if (ev && ev.url) receberUrl(ev.url); });
      Promise.resolve(App.getLaunchUrl()).then(r => { if (r && r.url) receberUrl(r.url, true); }).catch(() => {});
    } catch (e) { log('url', e && e.message); }
  }

  // ---- ciclo
  const pronto = fn => { const s = () => { try { fn(); } catch (e) { log('erro', e && e.message); } }; if (doc.readyState === 'complete') s(); else raiz.addEventListener('load', s); };
  pronto(() => { montarVoz(); montarMenu(); setTimeout(desenharCalHoje, 2500); });
  doc.addEventListener('click', e => { if (e.target && e.target.closest && e.target.closest('#moreMenuBtn')) setTimeout(() => { try { montarMenu(); } catch (_) {} }, 0); }, true);
  { let n = 0; const t = setInterval(() => { try { montarMenu(); montarVoz(); } catch (_) {} if (++n >= 10) clearInterval(t); }, 2000); }
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) setTimeout(desenharCalHoje, 1200); });
  setInterval(() => { if (!doc.hidden) desenharCalHoje(); }, 15 * 60000);
  raiz.AgendaAcessos = { disponivel: !!PODE, criarTarefa, perguntarJarvis, receberUrl, desenharCalHoje };
})(typeof window !== 'undefined' ? window : null);
