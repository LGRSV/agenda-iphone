/* local-tarefa.js — LOCAL nas tarefas da agenda + utilidades do mapa.

   - No formulário de criar (#taskForm) e de editar (#agendaEditForm) entra o
     campo "Local": usar onde estou, lugares salvos do Jarvis, buscar endereço
     (Nominatim/OpenStreetMap, só ao apertar Buscar e no máximo 1 busca/s) ou
     tocar no mapa (Leaflet carregado só quando precisa).
   - O local fica na NOTA da tarefa: agenda_notas_v1[id].local = {nome, lat, lng, lugarId?, autoConcluir?}
     (lugarId = lugar salvo do Jarvis escolhido; autoConcluir = "Concluir sozinho
     quando eu chegar lá", executado pelo auto-concluir.js). Em tarefa repetida
     (rec-<regra>-<data>) o local vale para esta e as próximas ocorrências e entra
     na nota da regra, para as ocorrências que ainda serão geradas.
     (mesclado com os campos que já existem — lembreteDe, movimento, cond…), com
     syncRev novo para vencer a cópia antiga no merge do supabase-shared-storage.
     Remover grava local:null (apagar a chave não propagaria: o merge de notas
     só sobrepõe as chaves que existem no aparelho).
   - No card da tarefa: "📍 nome · 1,2 km" (distância só com posição recente).
   - window.AgendaLocalTarefa expõe as utilidades usadas também pelo mapa.html. */
(() => {
  'use strict';

  const TK = 'agenda_lagares_v3';
  const NK = 'agenda_notas_v1';
  const RK = 'agenda_lagares_rules_v1';
  const RAIO_AUTO = 120;                     // raio do lugar criado sozinho ao ligar a conclusão automática
  const LK = 'agenda_lugares_v1';
  const POS_KEY = 'agenda_mapa_pos_v1';      // última posição vista neste aparelho (não sincroniza)
  const POS_VALIDA_MS = 30 * 60 * 1000;
  const LEAFLET = {
    js: './vendor/leaflet/leaflet.js', jsSri: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',
    css: './vendor/leaflet/leaflet.css', cssSri: 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
  };
  const CENTRO_PADRAO = [-10.1846, -48.3337]; // Palmas-TO, só quando não há nenhuma referência

  // ---------------------------------------------------------------- utilidades
  const json = (v, fb) => { try { const x = JSON.parse(v); return x == null ? fb : x; } catch (_) { return fb; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function haversine(aLat, aLng, bLat, bLng) {
    const R = 6371000, r = Math.PI / 180;
    const dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function fmtDist(m) {
    if (!Number.isFinite(m)) return '';
    if (m < 1000) return `${m < 100 ? Math.round(m / 5) * 5 : Math.round(m / 10) * 10} m`;
    const km = m / 1000;
    return `${km.toLocaleString('pt-BR', { maximumFractionDigits: km < 100 ? 1 : 0 })} km`;
  }
  const localValido = l => !!(l && typeof l === 'object' && Number.isFinite(Number(l.lat)) && Number.isFinite(Number(l.lng)) && Math.abs(l.lat) <= 90 && Math.abs(l.lng) <= 180);
  const limparLocal = l => {
    const o = { nome: String(l.nome || '').trim().slice(0, 80) || 'Local', lat: Math.round(Number(l.lat) * 1e6) / 1e6, lng: Math.round(Number(l.lng) * 1e6) / 1e6 };
    if (l.lugarId) o.lugarId = String(l.lugarId).slice(0, 80);
    if (l.autoConcluir === true) o.autoConcluir = true;
    return o;
  };
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const pad = n => String(n).padStart(2, '0');
  const rotaGoogle = l => `https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}`;
  const rotaApple = l => `https://maps.apple.com/?daddr=${l.lat},${l.lng}`;

  const lerTarefas = () => { const a = json(localStorage.getItem(TK), []); return Array.isArray(a) ? a : []; };
  const lerNotas = () => { const n = json(localStorage.getItem(NK), {}); return n && typeof n === 'object' && !Array.isArray(n) ? n : {}; };
  function lerLocal(id, notas) {
    const n = (notas || lerNotas())[String(id)];
    return n && localValido(n.local) ? limparLocal(n.local) : null;
  }
  // devolve os ids gravados (em tarefa repetida: esta + as próximas pendentes da mesma regra)
  function gravarLocal(id, local) {
    const notas = lerNotas(), k = String(id), rev = Date.now();
    const novo = local ? limparLocal(local) : null;
    const ids = [k];
    const m = /^rec-(.+)-(\d{4}-\d{2}-\d{2})$/.exec(k);
    if (m) {
      lerTarefas().forEach(t => { const tid = String(t && t.id); if (t && tid !== k && !t.done && tid.startsWith('rec-' + m[1] + '-') && String(t.date || '') >= m[2]) ids.push(tid); });
      try {
        const regras = json(localStorage.getItem(RK), []);
        const r = Array.isArray(regras) ? regras.find(x => x && String(x.id) === m[1]) : null;
        if (r && JSON.stringify((r.note && r.note.local) || null) !== JSON.stringify(novo)) { r.note = { ...(r.note || {}), local: novo }; localStorage.setItem(RK, JSON.stringify(regras)); }
      } catch (_) {}
    }
    let mudou = false;
    ids.forEach(i => {
      const prev = notas[i] && typeof notas[i] === 'object' ? notas[i] : {};
      if (!novo && !prev.local) return;
      if (i !== k && JSON.stringify(prev.local || null) === JSON.stringify(novo)) return;
      notas[i] = { ...prev, local: novo, syncRev: rev }; mudou = true;
    });
    if (mudou) localStorage.setItem(NK, JSON.stringify(notas));
    try { if (window.AgendaAutoConcluir) window.AgendaAutoConcluir.agendar(500); } catch (_) {}
    return ids;
  }
  function tarefasComLocal() {
    const notas = lerNotas();
    return lerTarefas()
      .filter(t => t && t.id != null && !t.done && !t.hidden)
      .map(t => ({ id: String(t.id), text: t.text || '', date: t.date || '', time: t.time || '', local: lerLocal(t.id, notas), autoConcluida: !!(notas[String(t.id)] && notas[String(t.id)].autoConcluida) }))
      .filter(t => t.local);
  }
  function lugares() {
    try { if (window.AgendaLocal && window.AgendaLocal.lugares) return window.AgendaLocal.lugares(); } catch (_) {}
    const w = json(localStorage.getItem(LK), null);
    const itens = Array.isArray(w) ? w : (w && Array.isArray(w.itens) ? w.itens : []);
    return itens.filter(l => l && l.id && Number.isFinite(l.lat) && Number.isFinite(l.lng));
  }
  // posição mais nova entre o motor do Jarvis (localizacao.js) e a guardada pelo mapa
  function ultimaPos() {
    const c = [];
    try { const f = window.AgendaLocal && window.AgendaLocal.ultimoFix && window.AgendaLocal.ultimoFix(); if (f) c.push(f); } catch (_) {}
    const g = json(localStorage.getItem(POS_KEY), null); if (g) c.push(g);
    const ok = c.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Date.now() - (p.ts || 0) < POS_VALIDA_MS).sort((a, b) => b.ts - a.ts);
    return ok[0] || null;
  }
  let ultimaGravacaoPos = 0;
  function guardarPos(p, forcar) {
    if (!p || !Number.isFinite(p.lat)) return;
    if (!forcar && Date.now() - ultimaGravacaoPos < 15000) return;
    ultimaGravacaoPos = Date.now();
    try { localStorage.setItem(POS_KEY, JSON.stringify({ lat: p.lat, lng: p.lng, acc: p.acc, ts: p.ts || Date.now() })); } catch (_) {}
  }
  function posicaoAgora() {
    return new Promise((res, rej) => {
      if (!('geolocation' in navigator)) return rej(new Error('Este aparelho não informa a localização.'));
      navigator.geolocation.getCurrentPosition(pos => {
        const c = pos.coords, p = { lat: c.latitude, lng: c.longitude, acc: c.accuracy, ts: Date.now() };
        guardarPos(p, true); res(p);
      }, e => rej(new Error(e && e.code === 1 ? 'Localização negada. Ative em Ajustes › Privacidade › Serviços de Localização.' : 'Não consegui pegar a localização agora. Tente de novo.')), { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 });
    });
  }
  const lugarEm = p => lugares().find(l => haversine(p.lat, p.lng, l.lat, l.lng) <= (l.raio || 100)) || null;
  // lugar salvo que corresponde ao local de uma tarefa (mesma regra do auto-concluir.js)
  function lugarDoLocal(local, lista) {
    if (!local) return null;
    lista = lista || lugares();
    if (local.lugarId) { const l = lista.find(x => String(x.id) === String(local.lugarId)); if (l) return l; }
    let melhor = null, dm = Infinity;
    for (const l of lista) { const d = haversine(local.lat, local.lng, l.lat, l.lng); if (d <= (l.raio || 100) && d < dm) { melhor = l; dm = d; } }
    return melhor;
  }
  // tarefas pendentes, de hoje até daqui a N dias, para vincular a um lugar (mapa)
  function tarefasPendentes(dias) {
    const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const hoje = new Date(), lim = new Date(); lim.setDate(lim.getDate() + (dias || 14));
    const d0 = iso(hoje), d1 = iso(lim), notas = lerNotas();
    return lerTarefas().filter(t => t && t.id != null && !t.done && !t.hidden && t.tag !== 'financeiro' && t.date >= d0 && t.date <= d1)
      .sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')))
      .map(t => ({ id: String(t.id), text: t.text || '', date: t.date, time: t.time || '', local: lerLocal(t.id, notas) }));
  }

  // Nominatim (OpenStreetMap): política de uso = no máximo 1 requisição por
  // segundo, nada de autocompletar. Só busca ao apertar Buscar; o navegador
  // manda o Referer do site e o parâmetro app identifica o aplicativo.
  let ultimaBusca = 0, buscando = false;
  const cacheBusca = new Map();
  async function buscarEndereco(q) {
    q = String(q || '').trim().replace(/\s+/g, ' ');
    if (q.length < 3) throw new Error('Digite pelo menos 3 letras.');
    if (cacheBusca.has(q)) return cacheBusca.get(q);
    if (buscando) throw new Error('Aguarde a busca anterior.');
    buscando = true;
    try {
      const espera = ultimaBusca + 1100 - Date.now();
      if (espera > 0) await new Promise(r => setTimeout(r, espera));
      ultimaBusca = Date.now();
      const p = new URLSearchParams({ format: 'jsonv2', q, limit: '6', 'accept-language': 'pt-BR', app: 'agenda-iphone' });
      const perto = ultimaPos();
      if (perto) p.set('viewbox', [perto.lng - 1.5, perto.lat + 1.5, perto.lng + 1.5, perto.lat - 1.5].map(n => n.toFixed(4)).join(','));
      const r = await fetch('https://nominatim.openstreetmap.org/search?' + p, { headers: { Accept: 'application/json' }, referrerPolicy: 'strict-origin-when-cross-origin' });
      if (!r.ok) throw new Error(r.status === 429 ? 'Muitas buscas seguidas. Espere um pouco.' : 'A busca de endereço falhou.');
      const lista = (await r.json() || []).map(x => ({
        nome: String(x.name || String(x.display_name || '').split(',')[0] || 'Local').trim(),
        endereco: String(x.display_name || ''), lat: Number(x.lat), lng: Number(x.lon)
      })).filter(localValido);
      cacheBusca.set(q, lista);
      return lista;
    } catch (e) {
      if (e instanceof TypeError) throw new Error('Sem internet para buscar o endereço.');
      throw e;
    } finally { buscando = false; }
  }

  let leafletP = null;
  function carregarLeaflet() {
    if (window.L && window.L.map) return Promise.resolve(window.L);
    if (leafletP) return leafletP;
    leafletP = new Promise((res, rej) => {
      if (!document.querySelector('link[data-leaflet]')) {
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = LEAFLET.css; l.integrity = LEAFLET.cssSri; l.dataset.leaflet = '1';
        document.head.appendChild(l);
      }
      const s = document.createElement('script');
      s.src = LEAFLET.js; s.integrity = LEAFLET.jsSri; s.async = true;
      s.onload = () => res(window.L);
      s.onerror = () => { leafletP = null; rej(new Error('Não consegui abrir o mapa (sem internet?).')); };
      document.head.appendChild(s);
    });
    return leafletP;
  }
  function camadaOSM(L) {
    return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' });
  }

  window.AgendaLocalTarefa = {
    haversine, fmtDist, rotaGoogle, rotaApple, lerLocal, gravarLocal, tarefasComLocal, lugares,
    ultimaPos, guardarPos, posicaoAgora, buscarEndereco, carregarLeaflet, camadaOSM, lugarEm, lugarDoLocal, tarefasPendentes, CENTRO_PADRAO, RAIO_AUTO
  };

  // ------------------------------------------------- UI da agenda (só lá)
  if (!document.getElementById('taskDialog')) return; // mapa.html e outras páginas: só as utilidades

  const STYLE = `
    .tl-field{margin-top:13px}
    .notas-panel .tl-field{margin-top:0}
    .tl-field>label{display:block}
    .tl-field .tl-sel{display:grid;grid-template-columns:auto 1fr auto auto;align-items:center;gap:8px;margin-bottom:8px;padding:6px 6px 6px 10px;border:1px solid color-mix(in srgb,var(--accent) 55%,var(--line));border-radius:13px;background:color-mix(in srgb,var(--accent) 9%,var(--soft))}
    .tl-field .tl-sel[hidden]{display:none}
    .tl-field .tl-sel input{min-height:36px;margin:0;padding:6px 8px;border:0;background:transparent;box-shadow:none}
    .tl-field .tl-dist{color:var(--muted);font-size:12px;font-weight:700;white-space:nowrap}
    .tl-field .tl-x{width:34px;height:34px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--muted);font-size:20px;line-height:1}
    .tl-field .tl-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .tl-field .tl-b{min-height:40px;padding:8px 10px;border:1px solid var(--line);border-radius:12px;background:var(--soft);color:var(--text);font-size:13px;font-weight:750}
    .tl-field .tl-b:active{transform:scale(.97)}
    .tl-field .tl-b:disabled{opacity:.55}
    .tl-field .tl-auto{display:flex;align-items:flex-start;gap:10px;margin:0 0 8px;padding:9px 11px;border:1px solid var(--line);border-radius:13px;background:var(--soft);font-size:13px;font-weight:700;line-height:1.3;cursor:pointer}
    .tl-field .tl-auto[hidden]{display:none}
    .tl-field .tl-auto input{width:20px;height:20px;min-height:0;margin:1px 0 0;padding:0;flex:0 0 auto;accent-color:var(--accent)}
    .tl-field .tl-auto small{display:block;margin-top:3px;color:var(--muted);font-size:11.5px;font-weight:600}
    .tl-field .tl-auto small:empty{display:none}
    .tl-field .tl-chips{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:8px}
    .tl-field .tl-chips-rot{color:var(--muted);font-size:11px;font-weight:750;margin-right:2px}
    .tl-field .tl-chip.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 16%,var(--surface))}
    .tl-field .tl-chips:empty{display:none}
    .tl-field .tl-chip{padding:6px 11px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--text);font-size:12px;font-weight:750}
    .tl-field .tl-busca{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:8px}
    .tl-field .tl-busca input{width:100%;min-height:44px;margin:0;padding:10px 12px;border:1px solid var(--line);border-radius:13px;outline:0;background:var(--soft);color:var(--text);font-size:16px;-webkit-appearance:none;appearance:none}
    .tl-field .tl-busca input:focus{border-color:var(--accent)}
    .tl-field .tl-res{display:grid;gap:6px;margin-top:8px}
    .tl-field .tl-res:empty{display:none}
    .tl-field .tl-op{display:block;width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:var(--text);text-align:left;font-size:13px;line-height:1.3}
    .tl-field .tl-op b{display:block;font-size:13.5px}
    .tl-field .tl-op span{display:block;color:var(--muted);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .tl-field .tl-msg{margin:6px 0 0;color:var(--muted);font-size:12px;line-height:1.4}
    .tl-field .tl-msg:empty{display:none}
    .tl-badge{display:inline-flex;align-items:center;max-width:100%;padding:3px 8px;border:1px solid var(--line);border-radius:999px;background:var(--soft);color:var(--muted);font-size:11px;font-weight:750;line-height:1.2;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #tlMapaDialog{width:min(calc(100% - 20px),560px);height:min(calc(100dvh - 40px),640px);max-height:none;padding:0;overflow:hidden;border:1px solid var(--line);border-radius:22px;background:var(--surface);color:var(--text)}
    #tlMapaDialog::backdrop{background:rgba(0,0,0,.6)}
    #tlMapaDialog[open]{display:flex;flex-direction:column}
    #tlMapaDialog .tlm-head{padding:13px 15px 10px;border-bottom:1px solid var(--line)}
    #tlMapaDialog .tlm-head b{font-size:16px}
    #tlMapaDialog .tlm-head p{margin:3px 0 0;color:var(--muted);font-size:12px}
    #tlMapaDialog .tlm-map{flex:1;min-height:200px;background:#dfe3e8}
    #tlMapaDialog .tlm-foot{display:flex;gap:9px;justify-content:flex-end;padding:11px 13px calc(11px + env(safe-area-inset-bottom))}
    #tlMapaDialog .tlm-foot button{padding:11px 15px;border-radius:13px;font-size:14px;font-weight:750;border:1px solid var(--line);background:var(--soft);color:var(--text)}
    #tlMapaDialog .tlm-foot .tlm-ok{border-color:var(--accent);background:var(--accent);color:var(--accentInk)}
    #tlMapaDialog .tlm-foot .tlm-ok:disabled{opacity:.5}
  `;

  const avisar = msg => {
    const t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(avisar._t); avisar._t = setTimeout(() => t.classList.remove('show'), 2400);
  };

  function campoHTML(rotulo) {
    return `<label class="${rotulo}">Local</label>
      <div class="tl-sel" hidden><span aria-hidden="true">📍</span><input class="tl-nome" type="text" maxlength="80" placeholder="Nome do local" aria-label="Nome do local" autocomplete="off"><span class="tl-dist"></span><button class="tl-x" type="button" aria-label="Tirar o local">×</button></div>
      <label class="tl-auto" hidden><input class="tl-autochk" type="checkbox"><span>Concluir sozinho quando eu chegar lá<small class="tl-autoinfo"></small></span></label>
      <div class="tl-btns"><button class="tl-b" type="button" data-tl="aqui">Usar onde estou</button><button class="tl-b" type="button" data-tl="mapa">Escolher no mapa</button></div>
      <div class="tl-chips"></div>
      <div class="tl-busca"><input class="tl-q" type="search" placeholder="Buscar endereço ou lugar" enterkeyhint="search" autocomplete="off" aria-label="Buscar endereço"><button class="tl-b" type="button" data-tl="buscar">Buscar</button></div>
      <div class="tl-res"></div>
      <p class="tl-msg" aria-live="polite"></p>`;
  }

  function definir(campo, local) {
    campo._local = local ? limparLocal(local) : null;
    const sel = campo.querySelector('.tl-sel');
    sel.hidden = !campo._local;
    campo.querySelector('.tl-auto').hidden = !campo._local;
    campo.querySelector('.tl-autochk').checked = !!(campo._local && campo._local.autoConcluir);
    campo.querySelector('.tl-res').innerHTML = '';
    infoAuto(campo); chips(campo);
    if (!campo._local) return;
    campo.querySelector('.tl-nome').value = campo._local.nome;
    const p = ultimaPos();
    campo.querySelector('.tl-dist').textContent = p ? fmtDist(haversine(p.lat, p.lng, campo._local.lat, campo._local.lng)) : '';
  }
  function valorDe(campo) {
    if (!campo || !campo._local) return null;
    const nome = campo.querySelector('.tl-nome').value.trim();
    return limparLocal({ ...campo._local, nome: nome || campo._local.nome, autoConcluir: campo.querySelector('.tl-autochk').checked });
  }
  const hhmm = ms => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  function infoAuto(campo) {
    const el = campo.querySelector('.tl-autoinfo'), l = campo._local;
    if (!el) return;
    const n = campo._tid ? lerNotas()[String(campo._tid)] : null, a = n && n.autoConcluida;
    if (!l) { el.textContent = ''; return; }
    if (a && a.em) { const d = new Date(a.em); el.textContent = `Concluída sozinha em ${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${hhmm(a.em)} (chegou em ${a.lugar || 'local'}).`; return; }
    if (!campo.querySelector('.tl-autochk').checked) { el.textContent = 'Pelo GPS, no dia da tarefa, a partir de 2 h antes do horário.'; return; }
    const lg = lugarDoLocal(l), AL = window.AgendaLocal;
    el.textContent = (lg ? `Ao chegar em “${lg.nome}” (raio ${lg.raio || 100} m)` : `Vou salvar este local nos seus lugares (raio ${RAIO_AUTO} m)`) +
      ', no dia da tarefa, desde 2 h antes do horário.' + (AL && AL.ativo && !AL.ativo() ? ' ⚠ A localização está desligada.' : '');
  }
  // o local precisa ser um LUGAR salvo: é o motor do localizacao.js que reconhece a chegada
  async function garantirLugar(campo) {
    const AL = window.AgendaLocal, l = campo._local;
    if (!l) return;
    let lg = lugarDoLocal(l);
    if (!lg && AL && AL.salvarLugar) {
      const base = valorDe(campo).nome; let nome = base, i = 2;
      while (lugares().some(x => norm(x.nome) === norm(nome))) nome = `${base} ${i++}`;
      const r = await AL.salvarLugar(nome, { lat: l.lat, lng: l.lng, raio: RAIO_AUTO });
      if (r && r.ok) { lg = r.lugar; msg(campo, `Salvei “${lg.nome}” nos seus lugares (raio ${lg.raio} m) para reconhecer a chegada. Dá para ajustar no Mapa.`); }
      else if (r) msg(campo, r.msg);
    }
    if (lg && campo._local) campo._local.lugarId = String(lg.id);
    if (AL && AL.ativo && !AL.ativo() && AL.ativar) {
      try { const r = await AL.ativar(); if (r && !r.ok) msg(campo, r.msg); } catch (_) {}
    }
    infoAuto(campo); chips(campo);
  }
  function msg(campo, txt) { campo.querySelector('.tl-msg').textContent = txt || ''; }
  function chips(campo) {
    const atual = campo._local ? lugarDoLocal(campo._local) : null;
    const ls = lugares().slice(0, 16);
    campo.querySelector('.tl-chips').innerHTML = ls.length ? '<span class="tl-chips-rot">Lugares salvos:</span>' + ls
      .map(l => `<button class="tl-chip${atual && atual.id === l.id ? ' on' : ''}" type="button" data-lugar="${esc(l.id)}">${esc(l.nome)}</button>`).join('') : '';
  }
  // escolha do usuário: no painel de detalhes grava na hora (não há botão salvar).
  // Trocar de local mantém a "conclusão automática" como estava.
  function escolher(campo, local) {
    const auto = !!(campo._local && campo.querySelector('.tl-autochk').checked);
    definir(campo, local ? { ...local, autoConcluir: auto || local.autoConcluir === true } : null);
    if (campo._local && campo._local.autoConcluir) {
      garantirLugar(campo).then(() => { if (campo._aoMudar) campo._aoMudar(valorDe(campo)); });
    } else if (campo._aoMudar) campo._aoMudar(valorDe(campo));
  }
  function resetar(campo) { definir(campo, null); msg(campo, ''); campo.querySelector('.tl-q').value = ''; chips(campo); }

  function montarCampo(form, antesDe, classeRotulo, aoMudar) {
    if (!form || form.querySelector('.tl-field')) return form && form.querySelector('.tl-field');
    const campo = document.createElement('div');
    campo.className = 'tl-field';
    campo.innerHTML = campoHTML(classeRotulo);
    const ref = typeof antesDe === 'function' ? null : form.querySelector(antesDe);
    if (typeof antesDe === 'function') antesDe(campo); else if (ref) ref.before(campo); else form.appendChild(campo);
    campo._local = null;
    campo._aoMudar = aoMudar || null;
    if (aoMudar) campo.querySelector('.tl-nome').addEventListener('change', () => { if (campo._local) aoMudar(valorDe(campo)); });
    campo.querySelector('.tl-autochk').addEventListener('change', async e => {
      if (!campo._local) return;
      campo._local.autoConcluir = e.target.checked;
      if (e.target.checked) await garantirLugar(campo); else infoAuto(campo);
      if (campo._aoMudar) campo._aoMudar(valorDe(campo));
    });
    chips(campo);
    campo.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.classList.contains('tl-x')) { escolher(campo, null); msg(campo, ''); return; }
      if (b.dataset.lugar) {
        const l = lugares().find(x => String(x.id) === b.dataset.lugar);
        if (l) { escolher(campo, { nome: l.nome, lat: l.lat, lng: l.lng, lugarId: l.id }); msg(campo, ''); }
        return;
      }
      if (b.classList.contains('tl-op')) { const r = campo._res && campo._res[Number(b.dataset.i)]; if (r) { escolher(campo, r); msg(campo, r.endereco); } return; }
      const acao = b.dataset.tl;
      if (acao === 'aqui') {
        b.disabled = true; msg(campo, 'Pegando sua localização…');
        try {
          const p = await posicaoAgora();
          const l = lugarEm(p);
          escolher(campo, { nome: l ? l.nome : 'Onde eu estava', lat: p.lat, lng: p.lng, lugarId: l ? l.id : undefined });
          msg(campo, `Precisão de ±${Math.round(p.acc || 0)} m. Pode trocar o nome acima.`);
        } catch (err) { msg(campo, err.message); }
        b.disabled = false;
      } else if (acao === 'mapa') {
        escolherNoMapa(valorDe(campo)).then(r => { if (r) { escolher(campo, r); msg(campo, 'Ponto marcado no mapa. Pode trocar o nome acima.'); } }).catch(err => msg(campo, err.message));
      } else if (acao === 'buscar') {
        buscar(campo, b);
      }
    });
    campo.querySelector('.tl-q').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); buscar(campo, campo.querySelector('[data-tl="buscar"]')); }
    });
    return campo;
  }
  async function buscar(campo, botao) {
    const q = campo.querySelector('.tl-q').value;
    botao.disabled = true; msg(campo, 'Buscando…');
    try {
      const lista = await buscarEndereco(q);
      campo._res = lista;
      const p = ultimaPos();
      campo.querySelector('.tl-res').innerHTML = lista.map((r, i) => `<button class="tl-op" type="button" data-i="${i}"><b>${esc(r.nome)}${p ? ` · ${fmtDist(haversine(p.lat, p.lng, r.lat, r.lng))}` : ''}</b><span>${esc(r.endereco)}</span></button>`).join('');
      msg(campo, lista.length ? 'Toque no resultado certo.' : 'Nada encontrado. Tente com cidade ou bairro, ou escolha no mapa.');
    } catch (err) { msg(campo, err.message); }
    setTimeout(() => { botao.disabled = false; }, 1000);
  }

  // ---- escolher no mapa (diálogo próprio, empilhado sobre o formulário) ----
  let mapaDlg = null, mapaL = null, marcaL = null, meuL = null, mapaRes = null, mapaAtual = null;
  async function escolherNoMapa(atual) {
    const L = await carregarLeaflet();
    mapaAtual = atual;
    if (!mapaDlg) {
      mapaDlg = document.createElement('dialog');
      mapaDlg.id = 'tlMapaDialog';
      mapaDlg.innerHTML = '<div class="tlm-head"><b>Escolher no mapa</b><p>Toque no mapa para marcar o local.</p></div><div class="tlm-map"></div><div class="tlm-foot"><button type="button" class="tlm-cancel">Cancelar</button><button type="button" class="tlm-ok" disabled>Usar este ponto</button></div>';
      document.body.appendChild(mapaDlg);
      mapaDlg.querySelector('.tlm-cancel').addEventListener('click', () => mapaDlg.close());
      mapaDlg.querySelector('.tlm-ok').addEventListener('click', () => {
        const c = marcaL && marcaL.getLatLng();
        if (c) { const l = lugarEm({ lat: c.lat, lng: c.lng }); mapaRes = { nome: (mapaAtual && mapaAtual.nome) || (l ? l.nome : 'Ponto no mapa'), lat: c.lat, lng: c.lng, lugarId: l ? l.id : undefined }; }
        mapaDlg.close();
      });
    }
    mapaRes = null;
    const ok = mapaDlg.querySelector('.tlm-ok');
    mapaDlg.showModal();
    if (!mapaL) {
      mapaL = L.map(mapaDlg.querySelector('.tlm-map'), { zoomControl: true, attributionControl: true });
      camadaOSM(L).addTo(mapaL);
      mapaL.on('click', e => {
        if (marcaL) marcaL.setLatLng(e.latlng); else marcaL = L.marker(e.latlng, { icon: L.divIcon({ className: '', html: '<div style="font-size:30px;line-height:30px;transform:translate(-4px,-26px)">📍</div>', iconSize: [30, 30] }) }).addTo(mapaL);
        ok.disabled = false;
      });
    }
    if (marcaL) { marcaL.remove(); marcaL = null; }
    ok.disabled = true;
    const p = ultimaPos();
    if (meuL) { meuL.remove(); meuL = null; }
    if (p) meuL = L.circleMarker([p.lat, p.lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#1e88ff', fillOpacity: 1 }).addTo(mapaL);
    if (atual) { marcaL = L.marker([atual.lat, atual.lng], { icon: L.divIcon({ className: '', html: '<div style="font-size:30px;line-height:30px;transform:translate(-4px,-26px)">📍</div>', iconSize: [30, 30] }) }).addTo(mapaL); ok.disabled = false; }
    const centro = atual ? [atual.lat, atual.lng] : p ? [p.lat, p.lng] : (lugares()[0] ? [lugares()[0].lat, lugares()[0].lng] : CENTRO_PADRAO);
    mapaL.setView(centro, atual || p ? 16 : 13);
    setTimeout(() => mapaL.invalidateSize(), 60);
    return new Promise(res => mapaDlg.addEventListener('close', () => res(mapaRes), { once: true }));
  }

  // ---- ligação com os formulários ----
  let editandoId = null;
  function instalarCampos() {
    const fNova = document.getElementById('taskForm');
    if (fNova && !fNova.querySelector('.tl-field')) {
      montarCampo(fNova, '.actions', 'field-label');
      const dlg = document.getElementById('taskDialog');
      if (dlg) dlg.addEventListener('close', () => { const c = fNova.querySelector('.tl-field'); if (c) setTimeout(() => resetar(c), 0); });
    }
    const fEd = document.getElementById('agendaEditForm');
    if (fEd && !fEd.querySelector('.tl-field')) montarCampo(fEd, '.edit-actions', '');
    // "Detalhes" da tarefa (notas.js): é por aqui que se edita o local de uma tarefa que já existe
    document.querySelectorAll('.notas-panel[data-nid]').forEach(panel => {
      if (panel.querySelector('.tl-field')) return;
      const id = panel.dataset.nid;
      const c = montarCampo(panel, campo => {
        const sep = panel.querySelector('.notas-sep');
        const novoSep = document.createElement('div'); novoSep.className = 'notas-sep';
        if (sep) { sep.after(campo); campo.after(novoSep); } else panel.prepend(campo);
      }, 'notas-label', local => { gravarLocal(id, local); atualizarCards(); });
      c._tid = id;
      definir(c, lerLocal(id));
    });
  }
  // ao abrir os Detalhes, o painel (reaproveitado) relê o local salvo — pode ter vindo da nuvem
  window.addEventListener('click', e => {
    if (!e.target.closest) return;
    const b = e.target.closest('.notas-toggle'), tit = e.target.closest('.task-title');
    const chk = tit && tit.closest('.task-card') && tit.closest('.task-card').querySelector('.check[data-id]');
    const id = (b && b.dataset.nid) || (chk && chk.dataset.id);
    if (!id) return;
    setTimeout(() => {
      instalarCampos();
      const c = document.querySelector(`.notas-panel[data-nid="${CSS.escape(id)}"] .tl-field`);
      if (c) { resetar(c); definir(c, lerLocal(id)); }
    }, 0);
  }, true);
  // window em captura roda antes do listener de captura do edit-enhancement (que para a propagação)
  window.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.agenda-edit');
    if (!b || !b.dataset.editId) return;
    editandoId = b.dataset.editId;
    setTimeout(() => {
      instalarCampos();
      const c = document.querySelector('#agendaEditForm .tl-field');
      if (c) { c._tid = editandoId; resetar(c); definir(c, lerLocal(editandoId)); }
    }, 0);
  }, true);
  document.addEventListener('submit', e => {
    const f = e.target;
    const campo = f && f.querySelector && f.querySelector('.tl-field');
    if (!campo) return;
    const local = valorDe(campo);
    if (f.id === 'taskForm') {
      if (!local) return;
      const antes = new Set(lerTarefas().map(t => String(t.id)));
      // o handler da agenda cria a tarefa logo depois deste (mesmo evento)
      setTimeout(() => {
        const novas = lerTarefas().filter(t => !antes.has(String(t.id)));
        const feitos = new Set(); // repetida: a 1ª ocorrência já grava as próximas e a regra
        novas.forEach(t => { if (!feitos.has(String(t.id))) gravarLocal(t.id, local).forEach(i => feitos.add(i)); });
        if (novas.length) atualizarCards();
      }, 0);
    } else if (f.id === 'agendaEditForm' && editandoId) {
      const atual = lerLocal(editandoId);
      if (JSON.stringify(atual) !== JSON.stringify(local)) gravarLocal(editandoId, local);
    }
  }, true);

  // ---- selo "📍 nome · 1,2 km" nos cards ----
  function atualizarCards() {
    const notas = lerNotas(), p = ultimaPos();
    document.querySelectorAll('.task-card').forEach(card => {
      const chk = card.querySelector('.check[data-id]');
      const id = chk && chk.dataset.id;
      const loc = id ? lerLocal(id, notas) : null;
      let b = card.querySelector('.tl-badge');
      if (!loc) { if (b) b.remove(); return; }
      const feita = notas[String(id)] && notas[String(id)].autoConcluida;
      const txt = `📍 ${loc.nome}${p && !feita ? ` · ${fmtDist(haversine(p.lat, p.lng, loc.lat, loc.lng))}` : ''}${feita ? ' · ✓ ao chegar' : loc.autoConcluir ? ' · ⚡ auto' : ''}`;
      if (!b) {
        const rodape = card.querySelector('.task-footer'); if (!rodape) return;
        b = document.createElement('a'); b.className = 'tl-badge';
        b.addEventListener('click', ev => ev.stopPropagation());
        const tog = rodape.querySelector('.notas-toggle');
        if (tog) tog.before(b); else rodape.appendChild(b);
      }
      const href = `./mapa.html#t=${encodeURIComponent(id)}`;
      if (b.getAttribute('href') !== href) b.setAttribute('href', href);
      if (b.textContent !== txt) { b.textContent = txt; b.title = 'Ver no mapa'; }
    });
  }

  function init() {
    if (!document.getElementById('taskDialog')) return;
    if (!document.getElementById('tlStyles')) { const s = document.createElement('style'); s.id = 'tlStyles'; s.textContent = STYLE; document.head.appendChild(s); }
    instalarCampos();
    atualizarCards();
    let frame = 0;
    new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { instalarCampos(); atualizarCards(); }); })
      .observe(document.body, { childList: true, subtree: true });
    let ultimo = 0;
    window.addEventListener('agenda:local-change', e => {
      const tipo = e && e.detail && e.detail.tipo;
      if (tipo === 'lugares' || tipo === 'sync') document.querySelectorAll('.tl-field').forEach(c => { chips(c); infoAuto(c); });
      if (Date.now() - ultimo > 5000) { ultimo = Date.now(); atualizarCards(); }
    });
    window.addEventListener('agenda:remote-sync', () => setTimeout(atualizarCards, 50));
    setInterval(() => { if (!document.hidden) atualizarCards(); }, 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
