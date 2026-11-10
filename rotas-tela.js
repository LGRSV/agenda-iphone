/* rotas-tela.js — tela "Rotas do dia" (rotas.html): mapa com a rota, linha do
   tempo do dia, resumo da semana e apagar histórico. Os dados vêm de
   window.AgendaRotas (rotas.js). */
(() => {
  'use strict';
  const R = window.AgendaRotas, L = window.L, U = window.AgendaLocalTarefa;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const linhaEl = $('#linha');
  if (!R || !L) { linhaEl.innerHTML = '<div class="vazio">Não consegui carregar as rotas. Verifique a internet e abra de novo.</div>'; return; }
  const N = R.nucleo;
  const SEM = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const hojeIso = () => N.diaLocal(Date.now());
  const rotulo = iso => { const d = new Date(iso + 'T12:00:00Z'); return `${SEM[d.getUTCDay()]}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`; };
  const dur = min => N.duracao(min * N.MIN);
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

  // ---------------------------------------------------------------- mapa
  const map = L.map('map', { zoomControl: false });
  if (U && U.camadas) U.camadas(L, map, 'topleft');
  else L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  const dica = $('#dica');
  const conferirDica = () => { dica.style.display = map.getZoom() >= 17 ? 'none' : ''; };
  map.on('zoomend', conferirDica);
  let grupo = L.layerGroup().addTo(map);
  let camadasItem = new Map(); // k -> layer
  let sel = -1;

  let dia = hojeIso(), an = null, ultimoDesenho = '';
  function estiloTrecho(on) { return { color: on ? '#ffcf4a' : '#3d9bff', weight: on ? 8 : 5, opacity: on ? 1 : 0.85 }; }
  function desenharMapa(refit) {
    grupo.clearLayers(); camadasItem = new Map();
    const bounds = [];
    for (const it of an.itens) {
      if (it.tipo === 'trecho' && it.coords && it.coords.length >= 2) {
        const ln = L.polyline(it.coords, estiloTrecho(false)).addTo(grupo);
        ln.on('click', () => selecionar(it.k, true));
        camadasItem.set(it.k, ln); it.coords.forEach(c => bounds.push(c));
      } else if (it.tipo === 'parada' && Number.isFinite(it.la)) {
        const cor = it.nome ? '#3ecf8e' : '#ffad42';
        const m = L.circleMarker([it.la, it.ln], { radius: 9, color: '#fff', weight: 2, fillColor: cor, fillOpacity: 1 }).addTo(grupo);
        m.bindTooltip(esc(it.nome || 'Parada sem nome'), { direction: 'top', offset: [0, -8] });
        m.bindPopup(() => popupParada(it));
        m.on('click', () => selecionar(it.k, true));
        camadasItem.set(it.k, m); bounds.push([it.la, it.ln]);
      }
    }
    if (refit) {
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
      else if (bounds.length === 1) map.setView(bounds[0], 16);
      else {
        const l = (window.AgendaLocal && window.AgendaLocal.lugares && window.AgendaLocal.lugares()[0]) || null;
        map.setView(l ? [l.lat, l.lng] : (U && U.CENTRO_PADRAO) || [0, 0], l ? 15 : 12);
      }
      conferirDica();
    }
  }
  function selecionar(k, doMapa) {
    const ant = camadasItem.get(sel);
    if (ant) { if (ant.setStyle && ant instanceof L.Polyline) ant.setStyle(estiloTrecho(false)); else if (ant.setRadius) ant.setRadius(9); }
    sel = sel === k && !doMapa ? -1 : k;
    linhaEl.querySelectorAll('.ev').forEach(b => b.classList.toggle('on', Number(b.dataset.k) === sel));
    const it = an.itens.find(x => x.k === sel);
    const lay = camadasItem.get(sel);
    if (lay) {
      if (lay instanceof L.Polyline) { lay.setStyle(estiloTrecho(true)); lay.bringToFront(); if (!doMapa) map.fitBounds(lay.getBounds(), { paddingTopLeft: [60, 50], paddingBottomRight: [60, 30], maxZoom: 17 }); }
      else { lay.setRadius(13); lay.bringToFront(); if (!doMapa) map.setView(lay.getLatLng(), 18); lay.openTooltip(); }
    }
    if (doMapa) { const b = linhaEl.querySelector(`.ev[data-k="${sel}"]`); if (b) b.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    if (it && it.tipo === 'parada' && !it.nome && !it.endereco && Number.isFinite(it.la)) buscarEndereco(it);
  }

  // ---------------------------------------------------------------- parada: abrir no app do iPhone / salvar como lugar
  const E = window.AgendaEstabelecimentos, S = window.AgendaSugestoesCompras;
  const json = (v, fb) => { try { const x = JSON.parse(v); return x == null ? fb : x; } catch (_) { return fb; } };
  const linkG = (la, ln) => E ? E.linkGoogle(la, ln) : `https://www.google.com/maps/search/?api=1&query=${la},${ln}`;
  const linkA = (la, ln, nome) => E ? E.linkApple(la, ln, nome) : `https://maps.apple.com/?ll=${la},${ln}`;
  function popupParada(it) {
    const la = Number(it.la).toFixed(6), ln = Number(it.ln).toFixed(6);
    return `<b>${esc(it.nome || 'Parada sem nome')}</b><br><span style="color:#556">${esc(N.hhmm(it.ini))}–${esc(N.hhmm(it.fim))}${it.endereco ? ' · ' + esc(it.endereco) : ''}</span><br>` +
      `<a class="pl" href="${linkG(la, ln)}" target="_blank" rel="noopener">Google Maps</a><a class="pl" href="${linkA(la, ln, it.nome)}" target="_blank" rel="noopener">Apple Mapas</a>` +
      (it.nome ? '' : `<br><button class="pl verde" type="button" data-salvar-parada="${it.k}">Salvar como lugar</button>`);
  }
  const toastEl = document.getElementById('toast');
  function avisar(txt) {
    if (!toastEl) return;
    toastEl.textContent = txt; toastEl.classList.add('show');
    clearTimeout(avisar._t); avisar._t = setTimeout(() => toastEl.classList.remove('show'), 4500);
  }
  // salva um ponto da rota como lugar: o nome é sempre confirmado/editado pelo usuário
  async function salvarPonto(la, ln, sugestao) {
    const A = window.AgendaLocal;
    if (!A || !A.salvarLugar) { avisar('Abra a agenda uma vez e tente de novo.'); return; }
    let nome = sugestao || '';
    if (!nome && E) { try { const r = await E.nomeNoPonto(la, ln); if (r && r.estabelecimento && r.dist != null && r.dist <= 80) nome = r.nome; } catch (_) {} }
    nome = window.prompt('Nome do lugar (pode editar):', nome);
    if (!nome || !nome.trim()) return;
    const r = await A.salvarLugar(nome.trim(), { lat: la, lng: ln, raio: 120 });
    avisar(r && r.msg ? r.msg : 'Não deu para salvar.');
    if (r && r.ok) { ultimoDesenho = ''; render(false); }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-salvar-parada]'); if (!b || !an) return;
    const it = an.itens.find(x => x.k === Number(b.dataset.salvarParada)); if (!it) return;
    map.closePopup();
    salvarPonto(Number(it.la), Number(it.ln), '');
  });

  // ---------------------------------------------------------------- sugestões a partir das compras do dia
  const IGN = 'agenda_sug_compras_ignoradas_v1';
  const ignoradas = () => new Set(json(localStorage.getItem(IGN), []));
  let sugs = [];
  const brl = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function desenharSugestoes() {
    const el = $('#sugCompras'), tit = $('#sugTit');
    if (!el || !S || !an) return;
    try {
      const compras = S.comprasDoDia(json(localStorage.getItem('agenda_lagares_v3'), []), json(localStorage.getItem('agenda_notas_v1'), {}), dia);
      sugs = S.sugerir(an.paradas, compras, dia, ignoradas());
    } catch (_) { sugs = []; }
    tit.hidden = el.hidden = !sugs.length;
    el.innerHTML = sugs.map((x, k) => `<div class="sug"><div class="tx"><b>${esc(N.hhmm(x.parada.ini))}–${esc(N.hhmm(x.parada.fim))} · parada sem nome</b>` +
      `<span>Compra em ${esc(x.nome)}${x.compra.valor ? ' · R$ ' + esc(brl(x.compra.valor)) : ''}${x.exato ? ' às ' + esc(N.hhmm(x.compra.hora)) : ' · sem hora no lançamento (aproximado)'}</span></div>` +
      `<div class="bt"><button type="button" class="ok" data-sug="${k}">Salvar como “${esc(x.nome)}”</button><a href="${linkG(x.parada.la.toFixed(6), x.parada.ln.toFixed(6))}" target="_blank" rel="noopener">Ver no Google</a><button type="button" data-sug-ign="${k}">Ignorar</button></div></div>`).join('');
  }
  $('#sugCompras').addEventListener('click', e => {
    const s = e.target.closest('[data-sug]'), ig = e.target.closest('[data-sug-ign]');
    if (s) { const x = sugs[Number(s.dataset.sug)]; if (x) salvarPonto(x.parada.la, x.parada.ln, x.nome); }
    else if (ig) {
      const x = sugs[Number(ig.dataset.sugIgn)]; if (!x) return;
      const set = ignoradas(); set.add(x.chave);
      try { localStorage.setItem(IGN, JSON.stringify([...set].slice(-300))); } catch (_) {}
      desenharSugestoes();
    }
  });

  // Nominatim (OpenStreetMap): só quando o usuário toca numa parada sem nome,
  // no máximo 1 consulta por segundo, resultado guardado no aparelho.
  let filaGeo = Promise.resolve(), ultimaGeo = 0;
  function buscarEndereco(it) {
    const ja = R.endereco(it.la, it.ln); if (ja) { it.endereco = ja; return; }
    filaGeo = filaGeo.then(async () => {
      if (R.endereco(it.la, it.ln)) return;
      const espera = 1100 - (Date.now() - ultimaGeo); if (espera > 0) await new Promise(r => setTimeout(r, espera));
      ultimaGeo = Date.now();
      try {
        const q = new URLSearchParams({ format: 'jsonv2', lat: it.la.toFixed(5), lon: it.ln.toFixed(5), zoom: '18', addressdetails: '1', 'accept-language': 'pt-BR' });
        const r = await fetch('https://nominatim.openstreetmap.org/reverse?' + q, { headers: { Accept: 'application/json' }, referrerPolicy: 'strict-origin-when-cross-origin' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json(), a = j.address || {};
        const rua = [a.road || a.pedestrian || a.footway, a.house_number].filter(Boolean).join(', ');
        const partes = [j.name, rua, a.suburb || a.neighbourhood || a.city_district || a.village || a.town].filter((x, i, arr) => x && arr.indexOf(x) === i);
        const txt = partes.slice(0, 3).join(' · ') || String(j.display_name || '').split(',').slice(0, 2).join(',');
        if (txt) { R.lembrarEndereco(it.la, it.ln, txt); render(false); }
      } catch (_) {
        const b = linhaEl.querySelector(`.ev[data-k="${it.k}"] small`); if (b) b.textContent = 'não consegui buscar o endereço agora';
      }
    });
  }

  // ---------------------------------------------------------------- render
  function render(refit) {
    R.detalhe(dia).then(a => {
      an = a;
      const sig = JSON.stringify([dia, a.itens.map(i => [i.tipo, i.ini, i.fim, i.nome || '', i.endereco || '']), a.km]);
      if (!refit && sig === ultimoDesenho) return;
      ultimoDesenho = sig;
      desenharMapa(refit);
      desenharLinha();
      desenharResumo();
      desenharSugestoes();
      if (sel >= 0 && an.itens.some(x => x.k === sel)) { const k = sel; sel = -1; selecionar(k, true); } else sel = -1;
    });
    desenharSemana();
    desenharDias();
  }
  function desenharDias() {
    const h = hojeIso();
    $('#diaTxt').textContent = dia === h ? `Hoje · ${rotulo(dia)}` : rotulo(dia);
    const inp = $('#diaSel'); inp.value = dia; inp.max = h; inp.min = N.somaDias(h, -N.P.RETENCAO);
    $('#diaProx').disabled = dia >= h; $('#diaHoje').disabled = dia === h;
    $('#diaAnt').disabled = dia <= inp.min;
  }
  function desenharResumo() {
    $('#chips').innerHTML =
      `<div class="chip"><b>${esc(N.fmtKm(an.km))}</b><span>percorridos</span></div>` +
      `<div class="chip"><b>${esc(dur(an.minMov))}</b><span>em movimento</span></div>` +
      `<div class="chip"><b>${an.paradas.length}</b><span>paradas</span></div>`;
    const f = an.fonte === 'aparelho' ? 'Pontos gravados neste aparelho.' : an.fonte === 'sem dados' ? '' : `Mostrando o ${an.fonte} (linha simplificada).`;
    $('#fonte').textContent = f + (an.lacunas.length ? ` ${an.lacunas.length} intervalo(s) sem registro.` : '');
  }
  function iconeEv(e, it) {
    const sem = it && it.tipo === 'parada' && !it.nome ? ' sem' : '';
    if (e.tipo === 'transito') return 'transito';
    if (e.tipo === 'lacuna') return 'lacuna';
    if (e.tipo === 'saida' || e.tipo === 'fim') return 'saida' + sem;
    return 'chegada' + sem;
  }
  function desenharLinha() {
    if (!an.eventos.length) {
      const s = R.status();
      linhaEl.innerHTML = `<div class="vazio">${dia === hojeIso()
        ? (s.ativo ? 'Ainda nada registrado hoje. A rota aparece aqui conforme você se desloca.' : 'Nada registrado hoje: a localização está desligada.')
        : 'Nenhuma rota registrada neste dia.'}</div>`;
      return;
    }
    linhaEl.innerHTML = an.eventos.map(e => {
      const it = an.itens.find(x => x.k === e.k);
      let sub = '';
      if (it && it.tipo === 'trecho') sub = [it.de, it.para].every(Boolean) ? `${it.de} → ${it.para}` : (it.de ? `de ${it.de}` : (it.para ? `até ${it.para}` : ''));
      if (it && it.tipo === 'parada' && !it.nome && (e.tipo === 'chegada' || e.tipo === 'inicio')) sub = it.endereco ? '' : 'toque para ver o endereço aproximado';
      if (it && it.tipo === 'parada' && it.aberta && e.tipo !== 'saida') sub = (sub ? sub + ' · ' : '') + 'agora';
      return `<button class="ev ${e.tipo}" type="button" data-k="${e.k}"><span class="hora">${esc(e.hora)}</span><span class="ic ${iconeEv(e, it)}"></span><span class="tx">${esc(cap(e.texto))}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
    }).join('');
  }
  linhaEl.addEventListener('click', e => { const b = e.target.closest('.ev'); if (b) selecionar(Number(b.dataset.k), false); });

  function desenharSemana() {
    const fim = dia, s = R.semana(fim);
    $('#semTit').textContent = `Semana (${rotulo(s.ini).slice(5)} a ${rotulo(s.fim).slice(5)})`;
    const maxKm = Math.max(1, ...s.dias.map(d => d.km));
    $('#semana').innerHTML = s.dias.map(d => `<button class="dia${d.dia === dia ? ' on' : ''}" type="button" data-dia="${d.dia}"><b>${esc(rotulo(d.dia).slice(0, 3))} ${d.dia.slice(8, 10)}</b><div class="barra"><i style="width:${Math.round(d.km / maxKm * 100)}%"></i></div><span>${d.comDados ? `${esc(N.fmtKm(d.km))} · ${esc(dur(d.minMov))}` : 'sem registro'}</span></button>`).join('') +
      `<div class="linha"><span class="n"><b>Total</b></span><span class="v">${esc(N.fmtKm(s.km))} · ${esc(dur(s.minMov))} em movimento</span></div>`;
    const maxMin = Math.max(1, ...s.tempoPorLugar.map(l => l.min));
    $('#lugares').innerHTML = s.tempoPorLugar.length ? s.tempoPorLugar.slice(0, 8).map(l => `<div class="linha"><span class="n">${esc(l.nome)}</span><div class="barra" style="flex:0 0 30%"><i style="width:${Math.round(l.min / maxMin * 100)}%;background:#3ecf8e"></i></div><span class="v">${esc(dur(l.min))}</span></div>`).join('') : '<div class="vazio">Sem paradas registradas nestes 7 dias.</div>';
    $('#repetidos').innerHTML = s.trechosRepetidos.length ? s.trechosRepetidos.slice(0, 6).map(t => `<div class="linha"><span class="n">${esc(t.de)} → ${esc(t.para)}</span><span class="v">${t.vezes}x · ${esc(N.fmtKm(t.kmMedio))} · ${esc(dur(t.minMedio))} em média</span></div>`).join('') : '<div class="vazio">Ainda sem trechos entre lugares salvos.</div>';
  }
  $('#semana').addEventListener('click', e => { const b = e.target.closest('.dia'); if (b) irPara(b.dataset.dia); });

  function irPara(iso) {
    const h = hojeIso();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return;
    dia = iso > h ? h : iso; sel = -1; ultimoDesenho = ''; render(true);
  }
  $('#diaAnt').addEventListener('click', () => irPara(N.somaDias(dia, -1)));
  $('#diaProx').addEventListener('click', () => irPara(N.somaDias(dia, 1)));
  $('#diaHoje').addEventListener('click', () => irPara(hojeIso()));
  $('#diaSel').addEventListener('change', e => irPara(e.target.value));

  // ---------------------------------------------------------------- status / aviso
  function desenharStatus() {
    const s = R.status(), st = $('#status');
    const Lc = window.AgendaLocal;
    st.innerHTML = s.ativo ? '<span class="dot on"></span>gravando · ' + (s.nativo ? 'app nativo' : 'só com o app aberto')
      : '<span class="dot err"></span>localização desligada';
    let txt = '';
    if (!s.ativo) txt = '<b>A localização está desligada</b>, então nada está sendo gravado.' + (Lc && Lc.ativar ? '<br><button id="ligarLoc" type="button">Ligar localização</button>' : '');
    else if (s.nativo) txt = '<b>Gravando pelo app nativo.</b> Para a rota ficar completa com a tela apagada, a Agenda precisa da localização em <b>"Sempre"</b> (Ajustes &gt; Agenda &gt; Localização).';
    else txt = '<b>No navegador o iPhone pausa a Agenda em segundo plano</b>: a rota só é gravada com o app aberto. Para registrar o dia todo, use o app nativo com a localização em "Sempre".';
    txt += '<br>O que não foi gravado (app fechado, sem GPS, localização desligada) aparece como <b>"sem registro"</b>: a rota nunca liga dois pontos distantes com uma linha inventada. Os pontos detalhados ficam só neste aparelho; na nuvem vai só o resumo do dia.';
    $('#aviso').innerHTML = txt;
    const bt = $('#ligarLoc');
    if (bt) bt.addEventListener('click', async () => { bt.disabled = true; try { await Lc.ativar(); } catch (_) {} desenharStatus(); });
  }

  // ---------------------------------------------------------------- apagar
  let acao = null;
  function confirmar(tit, txt, fn) { $('#shTit').textContent = tit; $('#shTxt').textContent = txt; acao = fn; $('#sheet').hidden = false; }
  $('#shNao').addEventListener('click', () => { $('#sheet').hidden = true; acao = null; });
  $('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') { $('#sheet').hidden = true; acao = null; } });
  $('#shSim').addEventListener('click', async () => { const f = acao; acao = null; $('#sheet').hidden = true; if (f) await f(); ultimoDesenho = ''; render(true); });
  $('#apagarDia').addEventListener('click', () => confirmar(`Apagar ${rotulo(dia)}?`, 'Apaga a rota, as paradas e os trechos deste dia neste aparelho e na nuvem. Não dá para desfazer.', () => R.apagarDia(dia)));
  $('#apagarTudo').addEventListener('click', () => confirmar('Apagar todo o histórico de rotas?', 'Apaga todos os dias gravados, neste aparelho e na nuvem. Os lugares salvos e as visitas do Jarvis continuam. Não dá para desfazer.', () => R.apagarTudo()));

  // ---------------------------------------------------------------- atualizações
  let tVivo = 0;
  window.addEventListener('agenda:rotas-change', () => {
    clearTimeout(tVivo);
    tVivo = setTimeout(() => { desenharStatus(); if (dia === hojeIso()) render(false); }, 1500);
  });
  window.addEventListener('agenda:local-change', e => { if (e.detail && e.detail.tipo !== 'fix') desenharStatus(); });
  try { const q = new URLSearchParams(location.search).get('dia'); if (q) dia = q > hojeIso() ? hojeIso() : q; } catch (_) {}
  desenharStatus();
  render(true);
  // rotas.js carrega os pontos de hoje de forma assíncrona: redesenha quando chegarem
  let n = 0; const t = setInterval(() => { n += 1; if (R.status().carregado || n > 20) { clearInterval(t); ultimoDesenho = ''; render(true); } }, 200);
})();
