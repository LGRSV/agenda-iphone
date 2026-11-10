/* sugestoes-compras.js — sugere nome para paradas sem nome a partir das compras do dia.

   "Você ficou parado aqui 19:35–19:52 e houve uma compra em X às 19:42: salvar este ponto
   como X?" Só SUGERE: salvar é sempre um toque do usuário (rotas-tela.js).
   Fonte: lançamentos do financeiro do app (tarefas com nota movimento 'saida') do mesmo dia.
   - Nome sugerido = só o ESTABELECIMENTO: o que vem entre parênteses no detalhe importado
     ("… Open Finance (DROGASIL 4888)"); sem isso, o tipo da categoria ("Farmácia",
     "Mercado"…). NUNCA o texto do lançamento, que pode dizer o que foi comprado.
   - Com hora no lançamento: casa com a parada em que a hora cai (de 10 min antes da
     chegada a 15 min depois da saída). Sem hora (o normal no Open Finance): vale o dia
     todo e a sugestão fica marcada como "aproximado" (só se o dia tiver até 3 paradas
     sem nome, senão seria chute).
   Funções puras (testes em Node); no navegador: window.AgendaSugestoesCompras. */
(function (root) {
  'use strict';
  const MIN = 60000, ANTES = 10 * MIN, DEPOIS = 15 * MIN, MAX_SEM_NOME_APROX = 3, MAX_ITENS = 8;
  const titulo = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/(^|\s)\S/g, c => c.toUpperCase());
  // tipo a partir da categoria (nunca a descrição do item)
  function tipoCategoria(n) {
    const c = String((n && (n.categoria || n.ofCategoria)) || '').toLowerCase();
    if (!c) return '';
    if (/farm|drog/.test(c)) return 'Farmácia';
    if (/mercad|padar|superm|atacad/.test(c)) return 'Mercado';
    if (/restaur|lanch|aliment|ifood|comida|bar\b/.test(c)) return 'Restaurante';
    if (/combust|posto/.test(c)) return 'Posto';
    if (/pet|veterin/.test(c)) return 'Pet shop';
    if (/sa[uú]de|m[eé]dic|cl[ií]nic|exame/.test(c)) return 'Clínica';
    if (/academ/.test(c)) return 'Academia';
    return '';
  }
  // nome do estabelecimento de um lançamento, ou '' (nunca o texto livre)
  function estabelecimento(n) {
    if (!n || typeof n !== 'object') return '';
    if (n.estabelecimento) return String(n.estabelecimento).slice(0, 60);
    const m = /\(([^()]{3,60})\)\s*$/.exec(String(n.detail || ''));
    if (!m) return '';
    let s = m[1].replace(/^(MP|PG|PAG|IFD|PAGSEGURO|SUMUP|EC)\s*\*?\s+/i, '').replace(/\*/g, ' ').replace(/\s+\d+$/, '').trim();
    return s.length >= 3 ? titulo(s) : '';
  }
  const isoDe = ts => new Date(ts - 3 * 3600000).toISOString().slice(0, 10); // America/Araguaina
  const tsHora = (iso, hhmm) => Date.parse(`${iso}T${hhmm}:00Z`) + 3 * 3600000;
  // compras do dia: [{id, valor, forma, hora|null, nome, tipo}]
  function comprasDoDia(tarefas, notas, iso) {
    const out = [];
    for (const t of tarefas || []) {
      if (!t || t.id == null || t.date !== iso) continue;
      const n = (notas || {})[String(t.id)];
      if (!n || typeof n !== 'object' || n.movimento !== 'saida') continue;
      if (n.lancamento && n.lancamento !== 'compra') continue;
      const nome = estabelecimento(n), tipo = tipoCategoria(n);
      if (!nome && !tipo) continue; // sem estabelecimento nem tipo: não há o que sugerir
      const hora = /^\d{2}:\d{2}$/.test(String(t.time || '')) ? tsHora(iso, t.time) : null;
      out.push({ id: String(t.id), valor: Number(n.valor) || 0, forma: String(n.forma || ''), hora, nome, tipo });
    }
    return out;
  }
  // paradas = itens 'parada' da análise do dia ({ini, fim, nome, la, ln}); ignoradas = Set de chaves
  function sugerir(paradas, compras, iso, ignoradas) {
    ignoradas = ignoradas || new Set();
    const semNome = (paradas || []).filter(p => p && !p.nome && Number.isFinite(p.la) && Number.isFinite(p.ln) && p.fim - p.ini >= 3 * MIN);
    const out = [];
    for (const c of compras || []) {
      let alvo = [];
      if (c.hora != null) alvo = semNome.filter(p => c.hora >= p.ini - ANTES && c.hora <= p.fim + DEPOIS);
      else if (semNome.length <= MAX_SEM_NOME_APROX) alvo = semNome;
      for (const p of alvo) {
        const chave = `${iso}|${Math.round(p.ini / MIN)}|${c.id}`;
        if (ignoradas.has(chave)) continue;
        out.push({ chave, parada: p, compra: c, nome: c.nome || c.tipo, aproximado: c.hora == null, exato: c.hora != null });
      }
    }
    // exatas primeiro, depois pela hora da parada
    return out.sort((a, b) => (b.exato - a.exato) || (a.parada.ini - b.parada.ini)).slice(0, MAX_ITENS);
  }
  const N = { estabelecimento, tipoCategoria, comprasDoDia, sugerir, isoDe, tsHora };
  if (typeof module === 'object' && module && module.exports) { module.exports = N; return; }
  root.AgendaSugestoesCompras = N;
})(typeof window !== 'undefined' ? window : this);
