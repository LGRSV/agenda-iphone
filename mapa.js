/* mapa.js — mapa da Agenda: minha posição ao vivo, lugares do Jarvis e
   tarefas com local, cada um com a distância em linha reta até mim. */
(() => {
  'use strict';
  const U = window.AgendaLocalTarefa;
  const L = window.L;
  const E = window.AgendaEstabelecimentos; // nome do estabelecimento no ponto (OSM), sob demanda
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const listaEl = $('#lista'), statusEl = $('#status');
  if (!U || !L) { listaEl.innerHTML = '<div class="vazio">Não consegui carregar o mapa. Verifique a internet e abra de novo.</div>'; return; }

  const map = L.map('map', { zoomControl: false });
  if (U.camadas) U.camadas(L, map, 'bottomleft'); else U.camadaOSM(L).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  let eu = null;            // {lat,lng,acc,ts}
  let seguir = true, primeiroFix = true, watchId = null;
  let euMarca = null, euCirculo = null;
  let itens = [];           // {key,tipo,nome,sub,lat,lng,raio}
  const marcas = new Map(); // key -> {marker, circle}
  let medida = null;        // {marker, line, lat, lng}

  const pinIcon = (cor, emoji) => L.divIcon({ className: '', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14],
    html: `<div style="width:30px;height:30px;border-radius:50%;background:${cor};border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4);display:grid;place-items:center;font-size:15px">${emoji}</div>` });
  const dataBr = d => /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.slice(8, 10) + '/' + d.slice(5, 7) : '';
  const distDe = i => eu ? U.haversine(eu.lat, eu.lng, i.lat, i.lng) : NaN;
  // abre o app do iPhone no ponto (lá os estabelecimentos estão mais atualizados que no OSM)
  const linksPonto = (lat, lng, nome) => `<a class="pl" href="${E ? E.linkGoogle(lat, lng) : U.rotaGoogle({ lat, lng })}" target="_blank" rel="noopener">Google Maps</a><a class="pl" href="${E ? E.linkApple(lat, lng, nome) : U.rotaApple({ lat, lng })}" target="_blank" rel="noopener">Apple Mapas</a>`;
  const links = i => linksPonto(i.lat, i.lng, i.nome);
  const acoesItem = i => i.tipo === 'lugar'
    ? `<br><button class="pl verde" type="button" data-acao="vincular" data-id="${esc(i.lid)}">Vincular tarefa</button><button class="pl" type="button" data-acao="editar" data-id="${esc(i.lid)}">Editar</button>`
    : (U.lugarDoLocal({ lat: i.lat, lng: i.lng }) ? '' : `<br><button class="pl verde" type="button" data-acao="salvar-ponto" data-lat="${i.lat}" data-lng="${i.lng}" data-nome="${esc(i.nome)}">Salvar como lugar</button>`);
  const popupHtml = i => `<b>${esc(i.nome)}</b>${i.sub ? `<br><span style="color:#556">${esc(i.sub)}</span>` : ''}${eu ? `<br>a <b>${U.fmtDist(distDe(i))}</b> de você` : ''}<br>${links(i)}${acoesItem(i)}`;

  // ---------------------------------------------------------------- itens
  function carregarItens() {
    const novos = [];
    U.lugares().forEach(l => novos.push({ key: 'l:' + l.id, lid: l.id, tipo: 'lugar', nome: l.nome, sub: `Lugar salvo · raio ${l.raio || 100} m`, lat: l.lat, lng: l.lng, raio: l.raio || 100 }));
    U.tarefasComLocal().forEach(t => novos.push({ key: 't:' + t.id, tipo: 'tarefa', nome: t.local.nome, sub: (t.local.autoConcluir ? '⚡ ' : '') + [t.text, dataBr(t.date), t.time].filter(Boolean).join(' · '), lat: t.local.lat, lng: t.local.lng }));
    itens = novos;
    const vivos = new Set(itens.map(i => i.key));
    for (const [k, m] of marcas) if (!vivos.has(k)) { m.marker.remove(); if (m.circle) m.circle.remove(); marcas.delete(k); }
    itens.forEach(i => {
      let m = marcas.get(i.key);
      if (!m) {
        m = { marker: L.marker([i.lat, i.lng], { icon: i.tipo === 'lugar' ? pinIcon('#3ecf8e', '🏠') : pinIcon('#ffad42', '📍') }).addTo(map) };
        if (i.tipo === 'lugar') m.circle = L.circle([i.lat, i.lng], { radius: i.raio, color: '#3ecf8e', weight: 1, fillOpacity: .08, interactive: false }).addTo(map);
        m.marker.bindPopup('');
        marcas.set(i.key, m);
      }
      m.marker.setLatLng([i.lat, i.lng]);
      if (m.circle) m.circle.setLatLng([i.lat, i.lng]).setRadius(i.raio);
      m.item = i;
    });
    desenharLista(true);
  }
  let popupItem = null;
  map.on('popupopen', e => { for (const m of marcas.values()) if (m.marker.getPopup() === e.popup) { popupItem = m; e.popup.setContent(popupHtml(m.item)); } });
  map.on('popupclose', () => { popupItem = null; });

  // ---------------------------------------------------------------- lista
  let ultimaLista = 0, assinatura = '', tLista = 0;
  function desenharLista(forcar) {
    clearTimeout(tLista);
    const falta = 1000 - (Date.now() - ultimaLista);
    if (!forcar && falta > 0) { tLista = setTimeout(() => desenharLista(true), falta); return; }
    ultimaLista = Date.now();
    if (!itens.length) {
      listaEl.innerHTML = '<div class="vazio">Nenhum local ainda.<br>• Para salvar um lugar (Casa, Energisa): toque no ponto do mapa (ou no seu ponto azul) e em <b>Salvar lugar</b> — ou diga ao Jarvis "estou em Casa".<br>• Para marcar o local de uma tarefa: na agenda, crie ou edite a tarefa e use o campo <b>Local</b>.<br>• Toque no mapa para medir a distância até qualquer ponto.</div>';
      assinatura = ''; return;
    }
    const ord = itens.map(i => ({ i, d: distDe(i) })).sort((a, b) => (Number.isFinite(a.d) && Number.isFinite(b.d)) ? a.d - b.d : a.i.nome.localeCompare(b.i.nome, 'pt-BR'));
    const sig = ord.map(o => o.i.key + '|' + U.fmtDist(o.d) + '|' + o.i.nome + '|' + o.i.sub).join(';');
    if (sig === assinatura) return;
    assinatura = sig;
    listaEl.innerHTML = `<h2>${eu ? 'Mais perto primeiro' : 'Locais'}</h2>` + ord.map(({ i, d }) =>
      `<div class="item" data-key="${esc(i.key)}"><div class="ic ${i.tipo}">${i.tipo === 'lugar' ? '🏠' : '📍'}</div>` +
      `<div class="info"><b>${esc(i.nome)}</b><span>${esc(i.sub)}</span></div>` +
      `<div class="dist">${Number.isFinite(d) ? U.fmtDist(d) : ''}</div>` +
      `<div class="acoes"><a class="ir" href="${U.rotaGoogle(i)}" target="_blank" rel="noopener" title="Rota no Google Maps">Ir</a><a href="${U.rotaApple(i)}" target="_blank" rel="noopener" title="Rota no Apple Mapas">Apple</a></div></div>`).join('');
  }
  listaEl.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const row = e.target.closest('.item'); if (!row) return;
    focar(row.dataset.key);
  });
  function focar(key) {
    const m = marcas.get(key); if (!m) return false;
    pararSeguir();
    map.setView(m.marker.getLatLng(), Math.max(map.getZoom() || 0, 16));
    m.marker.openPopup();
    return true;
  }

  // ---------------------------------------------------------------- minha posição
  function status(txt, cls) { statusEl.innerHTML = `<span class="dot ${cls || ''}"></span>${esc(txt)}`; }
  function noFix(pos) {
    const c = pos.coords;
    eu = { lat: c.latitude, lng: c.longitude, acc: Number.isFinite(c.accuracy) ? c.accuracy : 0, ts: Date.now() };
    U.guardarPos(eu);
    const ll = [eu.lat, eu.lng];
    if (!euMarca) {
      euCirculo = L.circle(ll, { radius: eu.acc, color: '#1e88ff', weight: 1, fillOpacity: .12, interactive: false }).addTo(map);
      euMarca = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="eu-pin"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), zIndexOffset: 1000, keyboard: false }).addTo(map);
      euMarca.bindPopup(() => {
        const l = U.lugarEm(eu);
        return `<b>Você está aqui</b><br><span style="color:#556">precisão ±${Math.round(eu.acc)} m${l ? ` · dentro de “${esc(l.nome)}”` : ''}</span><br>` +
          `<button class="pl verde" type="button" data-acao="salvar-ponto" data-lat="${eu.lat}" data-lng="${eu.lng}" data-nome="">Salvar como lugar</button>`;
      });
    } else { euMarca.setLatLng(ll); euCirculo.setLatLng(ll).setRadius(eu.acc); }
    status(`você · precisão ±${Math.round(eu.acc)} m`, 'on');
    if (primeiroFix) {
      primeiroFix = false;
      if (!focoInicial()) map.setView(ll, 16);
    } else if (seguir) map.panTo(ll, { animate: true });
    if (medida) atualizarMedida();
    if (popupItem) popupItem.marker.getPopup().setContent(popupHtml(popupItem.item));
    desenharLista();
  }
  function noErro(e) {
    if (e && e.code === 1) status('localização negada — ative em Ajustes › Privacidade › Serviços de Localização', 'err');
    else if (e && e.code === 3) { if (!eu) status('procurando sinal de GPS…'); }
    else status('sem sinal de GPS agora', 'err');
  }
  function armar() {
    if (!('geolocation' in navigator)) { status('este aparelho não informa a localização', 'err'); return; }
    try { if (watchId != null) navigator.geolocation.clearWatch(watchId); } catch (_) {}
    watchId = navigator.geolocation.watchPosition(noFix, noErro, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  }
  // o iOS costuma matar o watch quando o app vai para segundo plano
  document.addEventListener('visibilitychange', () => { if (!document.hidden) armar(); });
  window.addEventListener('pageshow', e => { if (e.persisted) armar(); });

  const btnSeguir = $('#btnSeguir');
  function pararSeguir() { seguir = false; btnSeguir.classList.remove('on'); }
  map.on('dragstart', pararSeguir);
  btnSeguir.addEventListener('click', () => {
    seguir = true; btnSeguir.classList.add('on');
    if (eu) map.setView([eu.lat, eu.lng], Math.max(map.getZoom() || 0, 16)); else armar();
  });
  $('#btnTudo').addEventListener('click', () => {
    const pts = itens.map(i => [i.lat, i.lng]); if (eu) pts.push([eu.lat, eu.lng]);
    if (!pts.length) return;
    pararSeguir();
    if (pts.length === 1) map.setView(pts[0], 16); else map.fitBounds(pts, { padding: [40, 40], maxZoom: 17 });
  });

  // ---------------------------------------------------------------- medir até um ponto tocado
  const medidaEl = $('#medida');
  map.on('click', e => {
    const p = { lat: e.latlng.lat, lng: e.latlng.lng };
    if (!medida) medida = { marker: L.circleMarker(e.latlng, { radius: 7, color: '#fff', weight: 2, fillColor: '#ff5a7a', fillOpacity: 1 }).addTo(map), line: L.polyline([], { color: '#ff5a7a', weight: 3, dashArray: '6 6' }).addTo(map) };
    medida.marker.setLatLng(e.latlng); medida.lat = p.lat; medida.lng = p.lng; medida.sug = null;
    $('#medidaG').href = E ? E.linkGoogle(p.lat, p.lng) : U.rotaGoogle(p);
    $('#medidaA').href = E ? E.linkApple(p.lat, p.lng, '') : U.rotaApple(p);
    $('#medidaNome').textContent = '';
    medidaEl.classList.add('on');
    atualizarMedida();
    sugerirNoPonto(p.lat, p.lng);
  });
  // toque num ponto: pergunta ao OpenStreetMap qual estabelecimento está ali (fila de 1/s, cache local)
  let seqSug = 0;
  async function sugerirNoPonto(lat, lng) {
    if (!E) return;
    const meu = ++seqSug, el = $('#medidaNome');
    el.textContent = 'procurando o nome no mapa…';
    try {
      const r = await E.nomeNoPonto(lat, lng);
      if (meu !== seqSug || !medida) return;
      if (r && r.estabelecimento && r.dist != null && r.dist <= 60) {
        medida.sug = r;
        el.textContent = `🏪 ${r.nome}${r.tipo ? ' · ' + r.tipo : ''}`;
        $('#medidaA').href = E.linkApple(lat, lng, r.nome);
      } else el.textContent = r && r.endereco ? r.endereco : 'sem estabelecimento cadastrado aqui no OSM';
    } catch (err) { if (meu === seqSug) el.textContent = err.message || 'não consegui consultar o mapa'; }
  }
  function atualizarMedida() {
    if (!medida) return;
    medida.line.setLatLngs(eu ? [[eu.lat, eu.lng], [medida.lat, medida.lng]] : []);
    $('#medidaTxt').textContent = eu ? `Ponto marcado: ${U.fmtDist(U.haversine(eu.lat, eu.lng, medida.lat, medida.lng))} de você` : 'Ponto marcado (esperando sua posição)';
  }
  function fecharMedida() { if (medida) { medida.marker.remove(); medida.line.remove(); medida = null; } medidaEl.classList.remove('on'); }
  $('#medidaX').addEventListener('click', fecharMedida);
  $('#medidaSalvar').addEventListener('click', () => {
    if (!medida) return;
    const s = medida.sug; // estabelecimento achado: salva no ponto dele, com o nome sugerido (editável)
    if (s) abrirSalvar(s.lat, s.lng, s.nome); else abrirSalvar(medida.lat, medida.lng, '');
  });

  // ---------------------------------------------------------------- salvar / editar lugar
  const AL = () => window.AgendaLocal;
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const toastEl = $('#toast');
  function avisar(txt, ms) {
    toastEl.textContent = txt; toastEl.classList.add('show');
    clearTimeout(avisar._t); avisar._t = setTimeout(() => toastEl.classList.remove('show'), ms || 3800);
  }
  const sheetLugar = $('#sheetLugar'), lgNome = $('#lgNome'), lgRaio = $('#lgRaio'), lgRaioTxt = $('#lgRaioTxt');
  let edicao = null, previa = null; // edicao = {lat, lng, id?}
  function abrirSalvar(lat, lng, nome) {
    const dentro = U.lugarEm({ lat, lng });
    edicao = { lat, lng };
    $('#lgTit').textContent = 'Salvar como lugar';
    lgNome.value = nome || '';
    lgRaio.value = String(U.RAIO_AUTO || 120);
    $('#lgRemover').hidden = true;
    $('#lgSug').textContent = '';
    abrirSheet(lat, lng);
    if (dentro) avisar(`Este ponto já fica dentro de “${dentro.nome}”.`);
    if (!nome && E) {
      const ed = edicao;
      E.nomeNoPonto(lat, lng).then(r => {
        if (edicao !== ed || !r || !r.estabelecimento || r.dist == null || r.dist > 60) return;
        $('#lgSug').textContent = `Sugestão do mapa: ${r.nome}${r.tipo ? ' (' + r.tipo + ')' : ''}. Pode editar.`;
        if (!lgNome.value.trim()) lgNome.value = r.nome;
      }).catch(() => {});
    }
  }
  function abrirEditar(id) {
    const l = U.lugares().find(x => String(x.id) === String(id)); if (!l) return;
    edicao = { lat: l.lat, lng: l.lng, id: l.id };
    $('#lgTit').textContent = 'Editar lugar'; $('#lgSug').textContent = '';
    lgNome.value = l.nome; lgRaio.value = String(l.raio || 100);
    $('#lgRemover').hidden = false;
    abrirSheet(l.lat, l.lng);
  }
  function abrirSheet(lat, lng) {
    map.closePopup(); pararSeguir();
    lgRaioTxt.textContent = lgRaio.value + ' m';
    if (previa) previa.remove();
    previa = L.circle([lat, lng], { radius: Number(lgRaio.value), color: '#3ecf8e', weight: 2, dashArray: '6 6', fillOpacity: .12, interactive: false }).addTo(map);
    map.fitBounds(previa.getBounds(), { padding: [30, 30], maxZoom: 18 });
    sheetLugar.hidden = false;
    setTimeout(() => lgNome.focus(), 50);
  }
  function fecharSheet() { sheetLugar.hidden = true; edicao = null; if (previa) { previa.remove(); previa = null; } }
  lgRaio.addEventListener('input', () => { lgRaioTxt.textContent = lgRaio.value + ' m'; if (previa) previa.setRadius(Number(lgRaio.value)); });
  lgNome.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#lgSalvar').click(); } });
  $('#lgCancelar').addEventListener('click', fecharSheet);
  sheetLugar.addEventListener('click', e => { if (e.target === sheetLugar) fecharSheet(); });
  async function ligarLocalizacao() {
    const a = AL();
    if (!a || !a.ativar || a.ativo()) return '';
    const r = await a.ativar();
    return r && r.ok ? ' Localização ligada para reconhecer a chegada.' : (r ? ' ' + r.msg : '');
  }
  $('#lgSalvar').addEventListener('click', async () => {
    const a = AL();
    if (!a || !edicao) { avisar('Não consegui acessar os lugares agora. Abra a agenda e tente de novo.'); return; }
    const nome = lgNome.value.trim(), raio = Number(lgRaio.value);
    if (!nome) { lgNome.focus(); avisar('Dê um nome ao lugar (ex.: Energisa).'); return; }
    let r;
    if (edicao.id) r = a.editarLugar(edicao.id, { nome, raio });
    else {
      const igual = U.lugares().find(l => norm(l.nome) === norm(nome));
      if (igual && !confirm(`Já existe o lugar “${igual.nome}”. Mover para este ponto?`)) return;
      r = await a.salvarLugar(nome, { lat: edicao.lat, lng: edicao.lng, raio, id: igual ? igual.id : undefined });
    }
    if (!r || !r.ok) { avisar(r ? r.msg : 'Não deu para salvar.'); return; }
    const novoId = r.lugar && r.lugar.id, eraNovo = !edicao.id;
    fecharSheet(); fecharMedida();
    carregarItens();
    avisar(r.msg + (await ligarLocalizacao()), 5000);
    if (eraNovo && novoId) setTimeout(() => focar('l:' + novoId), 150);
  });
  $('#lgRemover').addEventListener('click', () => {
    const a = AL(); if (!a || !edicao || !edicao.id) return;
    const l = U.lugares().find(x => String(x.id) === String(edicao.id));
    if (!l || !confirm(`Remover o lugar “${l.nome}”? As tarefas ligadas a ele deixam de concluir sozinhas.`)) return;
    const r = a.removerLugar(l.id);
    fecharSheet(); carregarItens();
    avisar(r.msg);
  });

  // ---------------------------------------------------------------- estabelecimentos perto de mim
  const sheetPerto = $('#sheetPerto'), ptLista = $('#ptLista');
  let pertoLista = [];
  async function abrirPerto() {
    const pos = eu || U.ultimaPos();
    sheetPerto.hidden = false;
    if (!E) { ptLista.innerHTML = '<div class="vazio">Não consegui carregar a busca de estabelecimentos.</div>'; return; }
    if (!pos) { ptLista.innerHTML = '<div class="vazio">Esperando a sua posição… Ligue a localização e tente de novo.</div>'; armar(); return; }
    $('#ptSub').textContent = `Num raio de ~150 m de você (precisão ±${Math.round(pos.acc || 0)} m). Fonte: OpenStreetMap; o que faltar, abra no Google ou no Apple Mapas.`;
    ptLista.innerHTML = '<div class="vazio">Procurando…</div>';
    try {
      pertoLista = (await E.perto(pos.lat, pos.lng, 150)).slice(0, 25);
      ptLista.innerHTML = pertoLista.length ? pertoLista.map((x, k) => {
        const ja = U.lugarEm({ lat: x.lat, lng: x.lng });
        return `<div class="pt"><div class="info"><b>${esc(x.nome)}</b><span>${esc([x.tipo, U.fmtDist(x.dist), ja ? 'dentro de “' + ja.nome + '”' : ''].filter(Boolean).join(' · '))}</span></div>` +
          `<a href="${E.linkGoogle(x.lat, x.lng)}" target="_blank" rel="noopener">Google</a><a href="${E.linkApple(x.lat, x.lng, x.nome)}" target="_blank" rel="noopener">Apple</a>` +
          `<button type="button" class="ok" data-pt="${k}">Salvar</button></div>`;
      }).join('') : `<div class="vazio">O OpenStreetMap não tem estabelecimentos com nome a até 150 m daqui. Veja no app do iPhone (${linksPonto(pos.lat, pos.lng, '')}) ou toque no mapa e em Salvar lugar.</div>`;
    } catch (err) { ptLista.innerHTML = `<div class="vazio">${esc(err.message || 'Falhou a busca.')}</div>`; }
  }
  $('#btnPerto').addEventListener('click', abrirPerto);
  $('#ptFechar').addEventListener('click', () => { sheetPerto.hidden = true; });
  sheetPerto.addEventListener('click', e => {
    if (e.target === sheetPerto) { sheetPerto.hidden = true; return; }
    const b = e.target.closest('[data-pt]'); if (!b) return;
    const x = pertoLista[Number(b.dataset.pt)]; if (!x) return;
    sheetPerto.hidden = true;
    abrirSalvar(x.lat, x.lng, x.nome);
  });

  // ---------------------------------------------------------------- vincular tarefa a um lugar
  const sheetTarefas = $('#sheetTarefas');
  let vincLugar = null;
  function abrirVincular(id) {
    const l = U.lugares().find(x => String(x.id) === String(id)); if (!l) return;
    vincLugar = l; map.closePopup();
    $('#vtSub').textContent = `Toque numa tarefa: ela ganha o local “${l.nome}” e conclui sozinha quando você chegar lá (no dia dela, desde 2 h antes do horário).`;
    const ts = U.tarefasPendentes(14);
    $('#vtLista').innerHTML = ts.length ? ts.map(t => {
      const ja = t.local && t.local.autoConcluir && U.lugarDoLocal(t.local) && U.lugarDoLocal(t.local).id === l.id;
      return `<button type="button" data-tid="${esc(t.id)}" class="${ja ? 'on' : ''}">${esc(t.text)}<span>${dataBr(t.date)}${t.time ? ' · ' + t.time : ''}${ja ? ' · ⚡ já vinculada' : t.local ? ' · 📍 ' + esc(t.local.nome) : ''}</span></button>`;
    }).join('') : '<div class="vazio">Nenhuma tarefa pendente nos próximos 14 dias.</div>';
    sheetTarefas.hidden = false;
  }
  $('#vtFechar').addEventListener('click', () => { sheetTarefas.hidden = true; });
  sheetTarefas.addEventListener('click', async e => {
    if (e.target === sheetTarefas) { sheetTarefas.hidden = true; return; }
    const b = e.target.closest('[data-tid]'); if (!b || !vincLugar) return;
    const l = vincLugar;
    U.gravarLocal(b.dataset.tid, { nome: l.nome, lat: l.lat, lng: l.lng, lugarId: l.id, autoConcluir: true });
    sheetTarefas.hidden = true;
    carregarItens();
    avisar(`“${b.firstChild.textContent}” vinculada a ${l.nome}: conclui sozinha quando você chegar.` + (await ligarLocalizacao()), 5000);
  });

  // botões dentro dos popups do mapa
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-acao]'); if (!b) return;
    const ac = b.dataset.acao;
    if (ac === 'salvar-ponto') abrirSalvar(Number(b.dataset.lat), Number(b.dataset.lng), b.dataset.nome || '');
    else if (ac === 'editar') abrirEditar(b.dataset.id);
    else if (ac === 'vincular') abrirVincular(b.dataset.id);
  });

  // ---------------------------------------------------------------- início
  function focoInicial() {
    const m = /[#&]t=([^&]+)/.exec(location.hash);
    if (!m) return false;
    const ok = focar('t:' + decodeURIComponent(m[1]));
    if (ok) history.replaceState(null, '', location.pathname + location.search);
    return ok;
  }
  function iniciar() {
    carregarItens();
    const salvo = U.ultimaPos();
    if (focoInicial()) primeiroFix = false;
    else if (salvo) map.setView([salvo.lat, salvo.lng], 15);
    else if (itens.length) map.fitBounds(itens.map(i => [i.lat, i.lng]), { padding: [40, 40], maxZoom: 16 });
    else map.setView(U.CENTRO_PADRAO, 13);
    armar();
  }
  // depois do DOMContentLoaded: o localizacao.js carrega os lugares no boot dele
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();

  // dados mudaram (sync da nuvem, outra aba, Jarvis aprendeu um lugar)
  let t = 0; const recarregar = () => { clearTimeout(t); t = setTimeout(carregarItens, 300); };
  window.addEventListener('agenda:remote-sync', recarregar);
  window.addEventListener('agenda:local-change', e => { if (e.detail && (e.detail.tipo === 'lugares' || e.detail.tipo === 'sync')) recarregar(); });
  window.addEventListener('storage', e => { if (!e.key || /agenda_(lagares_v3|notas_v1|lugares_v1)/.test(e.key)) recarregar(); });
})();
