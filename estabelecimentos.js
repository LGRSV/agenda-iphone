/* estabelecimentos.js — nome do estabelecimento num ponto do mapa (OpenStreetMap).

   - nomeNoPonto(lat, lng): Nominatim reverse (zoom 18). Devolve o estabelecimento
     (farmácia, loja, restaurante…) que o OSM tem naquele ponto, ou o endereço.
   - perto(lat, lng, raio): Overpass, estabelecimentos com nome num raio (padrão 150 m),
     do mais perto para o mais longe.
   Só consulta quando o usuário toca no mapa ou pede a lista: no máximo 1 requisição
   por segundo (fila única), e o resultado fica guardado neste aparelho
   (agenda_poi_cache_v1: endereço 30 dias, listas 7 dias). Nada vai para a nuvem.
   Limite honesto: o OSM de Palmas não tem todos os estabelecimentos; para o que faltar,
   os links "Google Maps" e "Apple Mapas" abrem o app do iPhone no mesmo ponto.
   window.AgendaEstabelecimentos; em Node exporta as funções puras para teste. */
(function (root) {
  'use strict';

  const CK = 'agenda_poi_cache_v1';
  const DIA = 86400000, TTL_PONTO = 30 * DIA, TTL_LISTA = 7 * DIA, MAX_CACHE = 300;
  const CHAVES = ['amenity', 'shop', 'office', 'tourism', 'leisure', 'craft', 'healthcare'];
  // rótulos em português dos tipos mais comuns (o resto mostra a categoria genérica)
  const TIPOS = {
    pharmacy: 'Farmácia', chemist: 'Farmácia', restaurant: 'Restaurante', fast_food: 'Lanchonete', cafe: 'Café',
    bar: 'Bar', pub: 'Bar', ice_cream: 'Sorveteria', bakery: 'Padaria', supermarket: 'Supermercado', convenience: 'Conveniência',
    fuel: 'Posto', bank: 'Banco', atm: 'Caixa eletrônico', hospital: 'Hospital', clinic: 'Clínica', doctors: 'Consultório',
    dentist: 'Dentista', school: 'Escola', university: 'Universidade', college: 'Faculdade', kindergarten: 'Creche',
    place_of_worship: 'Igreja', police: 'Polícia', post_office: 'Correios', townhall: 'Prefeitura', parking: 'Estacionamento',
    marketplace: 'Feira', veterinary: 'Veterinário', pet: 'Pet shop', clothes: 'Roupas', shoes: 'Calçados', hairdresser: 'Salão',
    beauty: 'Estética', mall: 'Shopping', department_store: 'Loja', hardware: 'Material de construção', doityourself: 'Material de construção',
    car_repair: 'Oficina', car: 'Concessionária', butcher: 'Açougue', greengrocer: 'Hortifrúti', optician: 'Ótica', mobile_phone: 'Celulares',
    electronics: 'Eletrônicos', books: 'Livraria', stationery: 'Papelaria', furniture: 'Móveis', gym: 'Academia', fitness_centre: 'Academia',
    park: 'Parque', hotel: 'Hotel', company: 'Empresa', government: 'Órgão público', laundry: 'Lavanderia', car_wash: 'Lava-jato'
  };
  function dist(aLat, aLng, bLat, bLng) {
    const R = 6371000, r = Math.PI / 180;
    const dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  function tipoDe(tags) {
    tags = tags || {};
    for (const k of CHAVES) if (tags[k]) return TIPOS[tags[k]] || TIPOS[k] || '';
    return '';
  }
  // resposta do Overpass -> [{nome, tipo, lat, lng, dist}] (sem repetidos, mais perto primeiro)
  function lerOverpass(json, lat, lng) {
    const vistos = new Set(), out = [];
    for (const e of (json && json.elements) || []) {
      const t = e.tags || {}, nome = String(t.name || t.brand || '').trim();
      const la = Number(e.lat != null ? e.lat : e.center && e.center.lat), ln = Number(e.lon != null ? e.lon : e.center && e.center.lon);
      if (!nome || !Number.isFinite(la) || !Number.isFinite(ln)) continue;
      const chave = nome.toLowerCase() + '|' + la.toFixed(4) + ',' + ln.toFixed(4);
      if (vistos.has(chave)) continue; vistos.add(chave);
      out.push({ nome: nome.slice(0, 60), tipo: tipoDe(t), lat: la, lng: ln, dist: Math.round(dist(lat, lng, la, ln)) });
    }
    return out.sort((a, b) => a.dist - b.dist);
  }
  // resposta do Nominatim reverse -> {nome, tipo, endereco, estabelecimento, lat, lng, dist}
  function lerReverso(j, lat, lng) {
    if (!j || j.error) return null;
    const a = j.address || {};
    const cat = String(j.category || j.class || '');
    const estab = !!j.name && CHAVES.includes(cat);
    const rua = [a.road || a.pedestrian || a.footway, a.house_number].filter(Boolean).join(', ');
    const bairro = a.suburb || a.neighbourhood || a.city_district || a.quarter || '';
    const la = Number(j.lat), ln = Number(j.lon);
    return {
      nome: estab ? String(j.name).slice(0, 60) : '',
      tipo: estab ? (TIPOS[j.type] || TIPOS[cat] || '') : '',
      endereco: [rua, bairro].filter(Boolean).join(' · ') || String(j.display_name || '').split(',').slice(0, 2).join(','),
      estabelecimento: estab,
      lat: la, lng: ln, dist: Number.isFinite(la) ? Math.round(dist(lat, lng, la, ln)) : null
    };
  }
  const consultaOverpass = (lat, lng, raio) =>
    `[out:json][timeout:20];nwr(around:${Math.round(raio)},${lat.toFixed(6)},${lng.toFixed(6)})[name][~"^(${CHAVES.join('|')})$"~"."];out center tags 60;`;
  const linkGoogle = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  const linkApple = (lat, lng, nome) => `https://maps.apple.com/?ll=${lat},${lng}${nome ? '&q=' + encodeURIComponent(nome) : ''}`;

  const N = { dist, tipoDe, lerOverpass, lerReverso, consultaOverpass, linkGoogle, linkApple, TIPOS };
  if (typeof module === 'object' && module && module.exports) { module.exports = N; return; }

  // ------------------------------------------------------------ navegador
  const LS = root.localStorage;
  const json = (v, fb) => { try { const x = JSON.parse(v); return x == null ? fb : x; } catch (_) { return fb; } };
  function cacheLer(k, ttl) {
    const c = json(LS.getItem(CK), {}); const e = c && c[k];
    return e && Date.now() - (e.em || 0) < ttl ? e.v : undefined;
  }
  function cacheGravar(k, v) {
    const c = json(LS.getItem(CK), {}) || {};
    c[k] = { v, em: Date.now() };
    const ks = Object.keys(c);
    if (ks.length > MAX_CACHE) ks.sort((a, b) => (c[a].em || 0) - (c[b].em || 0)).slice(0, ks.length - MAX_CACHE).forEach(x => delete c[x]);
    try { LS.setItem(CK, JSON.stringify(c)); } catch (_) {}
  }
  // fila única: 1 requisição por segundo para os serviços do OpenStreetMap
  let fila = Promise.resolve(), ultima = 0;
  function naFila(fn) {
    const p = fila.then(async () => {
      const espera = ultima + 1100 - Date.now();
      if (espera > 0) await new Promise(r => setTimeout(r, espera));
      ultima = Date.now();
      return fn();
    });
    fila = p.catch(() => {});
    return p;
  }
  async function nomeNoPonto(lat, lng) {
    const k = `r:${lat.toFixed(5)},${lng.toFixed(5)}`;
    const c = cacheLer(k, TTL_PONTO); if (c !== undefined) return c;
    return naFila(async () => {
      const q = new URLSearchParams({ format: 'jsonv2', lat: lat.toFixed(6), lon: lng.toFixed(6), zoom: '18', addressdetails: '1', 'accept-language': 'pt-BR' });
      const r = await fetch('https://nominatim.openstreetmap.org/reverse?' + q, { headers: { Accept: 'application/json' }, referrerPolicy: 'strict-origin-when-cross-origin' });
      if (!r.ok) throw new Error(r.status === 429 ? 'Muitas consultas seguidas. Espere um pouco.' : 'Não consegui consultar o mapa agora.');
      const v = lerReverso(await r.json(), lat, lng);
      cacheGravar(k, v);
      return v;
    });
  }
  async function perto(lat, lng, raio) {
    raio = Math.max(30, Math.min(500, Number(raio) || 150));
    const k = `p:${lat.toFixed(4)},${lng.toFixed(4)},${raio}`;
    const c = cacheLer(k, TTL_LISTA); if (c !== undefined) return c.map(e => ({ ...e, dist: Math.round(dist(lat, lng, e.lat, e.lng)) })).sort((a, b) => a.dist - b.dist);
    return naFila(async () => {
      const r = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(consultaOverpass(lat, lng, raio))
      });
      if (!r.ok) throw new Error(r.status === 429 || r.status === 504 ? 'O servidor do OpenStreetMap está ocupado. Tente de novo em instantes.' : 'Não consegui buscar os estabelecimentos agora.');
      const v = lerOverpass(await r.json(), lat, lng);
      cacheGravar(k, v);
      return v;
    });
  }
  root.AgendaEstabelecimentos = Object.assign({ nomeNoPonto, perto }, N);
})(typeof window !== 'undefined' ? window : this);
