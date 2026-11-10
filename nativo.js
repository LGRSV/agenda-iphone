/* nativo.js — recursos do app nativo da Agenda (LGRSV/agenda-app, instalado pelo AltStore).

   Só faz alguma coisa dentro do app (window.Capacitor nativo). No Safari/PWA não roda nada.
   1) GPS em segundo plano: quando a localização da Agenda está ligada (AgendaLocal.ativo()),
      o plugin BackgroundGeolocation entrega as posições mesmo com o app fechado/tela apagada
      e elas entram no mesmo motor de chegadas e saídas do localizacao.js.
   2) Lembretes locais: agenda no próprio iPhone as notificações das tarefas com horário e
      lembrete (mesma regra do checkAlerts: data+hora menos `reminder` minutos). Tocam com o
      app fechado e sem internet. Limite do iOS: 64 pendentes; usamos até 50, os mais próximos.
   3) Service worker: no app a página vem direto da rede; a 1ª vez, depois que o sw.js fica
      pronto, recarrega uma vez para ele montar a página completa (scripts injetados).
   4) Renovação do app (plugin nativo AgendaRenovacao, como o SideStore): o app renova sozinho o
      próprio perfil de 7 dias da conta Apple grátis. Precisa do Apple ID (fica só no Keychain do
      iPhone), do arquivo de pareamento gerado no PC (iloader) e do app LocalDevVPN ligado.
      Ao abrir o app faltando ≤ 3 dias e com a VPN ativa, renova automaticamente. Menu ⋯ > Renovação do app.
      Campo opcional "IP do iPhone na VPN" (vazio = 10.7.0.1 do LocalDevVPN), para testar com Tailscale.
   5) Atualização do app (mesmo plugin, app com o método "atualizar"): com a VPN ligada, confere sozinho a
      versão da fonte (altstore.json) e avisa; só instala com toque em "Atualizar o app". O app baixa a .ipa,
      reassina com o Apple ID no próprio iPhone e instala pelo LocalDevVPN, como o SideStore.
      "Ligar VPN" abre localdevvpn://enable?scheme=... (o LocalDevVPN liga o túnel e volta para a Agenda). */
(() => {
  'use strict';
  const C = window.Capacitor;
  if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return;

  // A página vem da internet (server.url), sem o @capacitor/core: a ponte nativa não traz registerPlugin.
  // Este é um registerPlugin mínimo em cima de nativePromise/nativeCallback, usando os PluginHeaders.
  const registrar = nome => {
    if (typeof C.registerPlugin === 'function') return C.registerPlugin(nome);
    if (C.Plugins && C.Plugins[nome]) return C.Plugins[nome];
    const cab = (C.PluginHeaders || []).find(h => h.name === nome);
    const tipo = m => { const x = cab && (cab.methods || []).find(mm => mm.name === m); return x ? x.rtype : 'promise'; };
    return new Proxy({}, { get(_, metodo) {
      if (typeof metodo !== 'string' || metodo === 'then') return undefined;
      if (metodo === 'addListener') return (evento, cb) => {
        const id = C.nativeCallback(nome, 'addListener', { eventName: evento }, cb);
        const h = { remove: () => C.nativePromise(nome, 'removeListener', { callbackId: id, eventName: evento }) };
        return Object.assign(Promise.resolve(h), h);
      };
      if (tipo(metodo) === 'callback') return (opcoes, cb) => Promise.resolve(C.nativeCallback(nome, metodo, opcoes || {}, cb));
      return (opcoes) => C.nativePromise(nome, metodo, opcoes || {});
    } });
  };
  const BG = registrar('BackgroundGeolocation');
  const LN = registrar('LocalNotifications');
  // Toque no lembrete abre a tarefa. O plugin guarda o evento até haver ouvinte, então funciona com o app fechado.
  const abrirTarefa = id => { let n = 0; const t = setInterval(() => {
    if (window.AgendaAPI && typeof window.AgendaAPI.openTask === 'function') { clearInterval(t); try { window.AgendaAPI.openTask(id); } catch (_) {} }
    else if (++n > 50) clearInterval(t);
  }, 200); };
  try {
    LN.addListener('localNotificationActionPerformed', ev => {
      const extra = (ev && ev.notification && ev.notification.extra) || {};
      if (extra.taskId) abrirTarefa(String(extra.taskId));
    });
  } catch (_) {}
  const TK = 'agenda_lagares_v3';
  const NK = 'agenda_notas_v1';
  const SIG_KEY = 'agenda_nativo_lembretes_sig';
  const RV_VALIDADE = 'agenda_renovacao_validade';
  const log = (...a) => { try { console.log('[nativo]', ...a); } catch (_) {} };
  document.documentElement.classList.add('app-nativo');

  // ---------- 3) service worker: recarregar uma vez quando ele assumir ----------
  try {
    if ('serviceWorker' in navigator && !navigator.serviceWorker.controller && !sessionStorage.getItem('nativo_sw_reload')) {
      navigator.serviceWorker.ready.then(() => {
        sessionStorage.setItem('nativo_sw_reload', '1');
        setTimeout(() => location.reload(), 300);
      }).catch(() => {});
    }
  } catch (_) {}

  // ---------- 1) GPS em segundo plano ----------
  // Modo econômico (localizacao.js): parado num lugar salvo, o watcher volta com distanceFilter
  // grande (≈ raio + 50 m) — o plugin (@capacitor-community/background-geolocation 1.x) só
  // aceita backgroundMessage/backgroundTitle/requestPermissions/stale/distanceFilter; a precisão
  // pedida ao iOS é sempre "Best". O ganho vem de o JS não acordar a cada 25 m de ruído.
  const FILTRO_NORMAL = 25;
  let watcherId = null, filtroAtual = FILTRO_NORMAL;
  async function ligarGps(filtro) {
    filtro = filtro || FILTRO_NORMAL;
    if (watcherId && filtro === filtroAtual) return;
    if (watcherId) await desligarGps();
    filtroAtual = filtro;
    try {
      watcherId = await BG.addWatcher({
        backgroundTitle: 'Agenda',
        backgroundMessage: 'Registrando chegadas e saídas dos seus lugares.',
        requestPermissions: true,
        stale: false,
        distanceFilter: filtro
      }, (loc, err) => {
        if (err) {
          log('gps erro', err.code || err.message);
          if (err.code === 'NOT_AUTHORIZED') desligarGps();
          return;
        }
        if (!loc || !window.AgendaLocal || typeof window.AgendaLocal._processarFix !== 'function') return;
        window.AgendaLocal._processarFix({
          coords: { latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy, speed: loc.speed },
          timestamp: Number(loc.time) || Date.now()
        });
      });
      log('gps ligado', filtro + ' m');
    } catch (e) { watcherId = null; log('gps falhou', e && e.message); }
  }
  async function desligarGps() {
    if (!watcherId) return;
    const id = watcherId; watcherId = null;
    try { await BG.removeWatcher({ id }); } catch (_) {}
    log('gps desligado');
  }
  // reconfigurações em fila: duas trocas seguidas não podem criar dois watchers
  let filaGps = Promise.resolve();
  function conferirGps() {
    filaGps = filaGps.then(() => {
      const L = window.AgendaLocal;
      if (!L || typeof L.ativo !== 'function') return;
      if (!L.ativo()) return desligarGps();
      const e = typeof L.eco === 'function' ? L.eco() : null;
      return ligarGps(e && e.distancia ? e.distancia : FILTRO_NORMAL);
    }).catch(() => {});
    return filaGps;
  }
  window.addEventListener('agenda:local-change', e => { const t = e && e.detail && e.detail.tipo; if (t === 'eco' || t === 'status') conferirGps(); });

  // ---------- 2) lembretes locais ----------
  const ler = (k, padrao) => { try { const v = JSON.parse(localStorage.getItem(k) || ''); return v ?? padrao; } catch (_) { return padrao; } };
  function idNum(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) || 1; }
  function saidaFinanceira(t, notas) {
    if (!t || t.tag !== 'financeiro') return false;
    const n = notas[String(t.id)]; return !!(n && n.movimento === 'saida');
  }
  function proximosLembretes() {
    const tarefas = ler(TK, []), notas = ler(NK, {}) || {};
    if (!Array.isArray(tarefas)) return [];
    const agora = Date.now(), limite = agora + 21 * 86400000;
    const lista = [];
    for (const t of tarefas) {
      if (!t || t.done || !t.time || !t.date || !(Number(t.reminder) >= 0) || saidaFinanceira(t, notas)) continue;
      const quando = new Date(`${t.date}T${t.time}:00`).getTime() - Number(t.reminder) * 60000;
      if (!Number.isFinite(quando) || quando <= agora + 5000 || quando > limite) continue;
      lista.push({
        id: idNum(`${t.id}-${quando}`),
        title: 'Lembrete da agenda',
        body: Number(t.reminder) > 0 ? `${t.text} · começa em ${t.reminder} min` : `${t.text} · é agora`,
        schedule: { at: new Date(quando), allowWhileIdle: true },
        extra: { taskId: String(t.id) }
      });
    }
    const validade = Date.parse(localStorage.getItem(RV_VALIDADE) || '');
    if (Number.isFinite(validade)) {
      const quando = validade - 2 * 86400000;
      if (quando > agora + 5000 && quando < limite) {
        lista.push({
          id: 777001,
          title: 'Renovar o app da Agenda',
          body: 'O app vence em 2 dias. Ligue o LocalDevVPN e abra a Agenda para renovar sozinho.',
          schedule: { at: new Date(quando), allowWhileIdle: true },
          extra: { renovacao: '1' }
        });
      }
    }
    return lista.sort((a, b) => a.schedule.at - b.schedule.at).slice(0, 50);
  }
  let permissaoNotif = null;
  async function sincronizarLembretes() {
    try {
      if (permissaoNotif === null) {
        const p = await LN.checkPermissions();
        permissaoNotif = p.display === 'granted' ? 'granted' : (await LN.requestPermissions()).display;
      }
      if (permissaoNotif !== 'granted') return;
      const lista = proximosLembretes();
      const sig = lista.map(n => `${n.id}:${+n.schedule.at}:${n.body}`).join('|');
      if (sig === localStorage.getItem(SIG_KEY)) return;
      const pend = await LN.getPending();
      if (pend && pend.notifications && pend.notifications.length) {
        await LN.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
      }
      if (lista.length) await LN.schedule({ notifications: lista });
      localStorage.setItem(SIG_KEY, sig);
      log('lembretes agendados', lista.length);
    } catch (e) { log('lembretes falharam', e && e.message); }
  }

  // ---------- 4) renovação do perfil de 7 dias ----------
  const RN = (typeof C.isPluginAvailable === 'function' && C.isPluginAvailable('AgendaRenovacao'))
    ? registrar('AgendaRenovacao') : null;
  const RV_AUTO = 'agenda_renovacao_auto_ts';
  const RV_IP = 'agenda_renovacao_ip';
  const AT_AVISO = 'agenda_atualizacao_avisada';
  let rvOcupado = false, rvEstado = null, rvUi = null;
  // App antigo não tem os métodos novos: a interface só mostra o que o app nativo sabe fazer.
  const temMetodo = m => { const cab = (C.PluginHeaders || []).find(h => h.name === 'AgendaRenovacao'); return !!(cab && (cab.methods || []).some(x => x.name === m)); };
  const PODE_ATUALIZAR = !!RN && temMetodo('atualizar') && temMetodo('versaoDisponivel');
  let rvVersao = null, atProgresso = null, atChecado = 0;
  const rvOpcoes = extra => {
    const ip = (localStorage.getItem(RV_IP) || '').trim();
    return Object.assign(ip ? { ip } : {}, extra || {});
  };

  // acao (opcional): o aviso vira tocável enquanto estiver na tela (o .toast normal não recebe toque).
  function aviso(msg, ms, acao) {
    const t = document.getElementById('toast');
    if (!t) { log(msg); return; }
    const limpar = () => { t.classList.remove('show'); t.style.pointerEvents = ''; t.onclick = null; };
    t.textContent = msg; t.classList.add('show');
    t.style.pointerEvents = acao ? 'auto' : '';
    t.onclick = acao ? () => { const meu = t.textContent === msg; limpar(); if (meu) acao(); } : null;
    clearTimeout(aviso._t); aviso._t = setTimeout(limpar, ms || 4500);
  }

  // LocalDevVPN: localdevvpn://enable liga o túnel; com ?scheme= ele volta para o app 1 s depois.
  async function ligarVpn() {
    if (RN && temMetodo('ligarVpn')) {
      try {
        const r = await RN.ligarVpn();
        if (r && r.aberto === false) aviso('Não consegui abrir o LocalDevVPN. Ele está instalado?', 6000);
        return;
      } catch (e) { log('ligarVpn falhou', e && e.message); }
    }
    location.href = 'localdevvpn://enable'; // app antigo (sem esquema de volta): liga o túnel e fica no LocalDevVPN
  }
  const fmtData = iso => { try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (_) { return iso; } };
  const fmtDias = d => `${Math.max(0, d).toFixed(1).replace('.', ',')}`;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function guardarEstado(e) {
    rvEstado = e || null;
    if (e && e.validade) {
      const antes = localStorage.getItem(RV_VALIDADE);
      localStorage.setItem(RV_VALIDADE, e.validade);
      if (antes !== e.validade) localStorage.removeItem(SIG_KEY); // reagenda o lembrete de renovação
    }
    rotuloMenu();
    if (rvUi && rvUi.open) desenharEstado();
  }

  function rotuloMenu() {
    const lab = document.getElementById('renovacaoLabel');
    if (!lab) return;
    const e = rvEstado;
    lab.textContent = (e && typeof e.diasRestantes === 'number' ? `Renovação do app · ${fmtDias(e.diasRestantes)} d` : 'Renovação do app')
      + (rvVersao && rvVersao.haNova ? ' · versão nova' : '');
  }

  async function lerEstado(aparelho) {
    if (!RN) return null;
    try { const e = await RN.estado(rvOpcoes({ aparelho: !!aparelho })); guardarEstado(e); return e; }
    catch (e) { log('renovação: estado falhou', e && e.message); return null; }
  }

  async function pedirCodigo(info) {
    const porTelefone = info && (info.modo === 'sms' || info.modo === 'voice');
    const dica = porTelefone ? `Código enviado para ${info.telefone || 'o seu telefone'}.`
      : 'Código de 6 dígitos que apareceu no seu iPhone/Mac (Apple ID).';
    const erro = info && info.erro ? `\n(${info.erro})` : '';
    const r = window.prompt(`Verificação em 2 fatores\n${dica}${erro}\nDigite o código (ou "sms" para receber por SMS):`, '');
    try {
      if (r === null) await RN.cancelarEntrada();
      else if (/^\s*sms\s*$/i.test(r)) await RN.enviarCodigo({ sms: true });
      else await RN.enviarCodigo({ codigo: r.trim() });
    } catch (_) {}
  }

  async function renovarAgora(manual) {
    if (!RN || rvOcupado) return;
    rvOcupado = true; desenharEstado('Renovando… (falando com a Apple e com o iPhone)');
    try {
      const r = await RN.renovar(rvOpcoes());
      aviso(`App renovado até ${fmtData(r.validade)}.${r.aviso ? ' ' + r.aviso : ''}`, 6000);
      log('renovado', r.validade);
    } catch (e) {
      const m = (e && (e.message || e.errorMessage)) || 'falhou';
      aviso(`Renovação do app: ${m}`, 7000);
      log('renovação falhou', m);
    } finally {
      rvOcupado = false;
      await lerEstado(false);
    }
  }

  async function autoRenovar() {
    if (!RN || rvOcupado || document.hidden) return;
    const e = await lerEstado(false);
    autoChecarVersao(e);
    if (!e || !e.logado || !e.temPareamento || !(typeof e.diasRestantes === 'number' && e.diasRestantes <= 3)) return;
    if (!e.vpnAtiva) { aviso(`O app vence em ${fmtDias(e.diasRestantes)} dias. Toque aqui para ligar o LocalDevVPN e renovar.`, 8000, ligarVpn); return; }
    const ultima = Number(localStorage.getItem(RV_AUTO)) || 0;
    if (Date.now() - ultima < 2 * 3600000) return; // no máximo 1 tentativa automática a cada 2 h
    localStorage.setItem(RV_AUTO, String(Date.now()));
    await renovarAgora(false);
  }

  // ---------- 5) atualização do app ----------
  async function lerVersao() {
    if (!PODE_ATUALIZAR) return null;
    let v;
    try { v = await RN.versaoDisponivel(); } catch (e) { v = { erro: (e && e.message) || 'falhou' }; }
    rvVersao = v || null;
    if (v && v.atualizadoAgora) aviso(`App atualizado para a versão ${v.atualizadoAgora}.`, 6000);
    else if (v && v.atualizacaoNaoConcluida) aviso(`A atualização para a versão ${v.atualizacaoNaoConcluida} não terminou. Tente de novo em Renovação do app.`, 8000, abrirRenovacao);
    rotuloMenu();
    if (rvUi && rvUi.open) desenharEstado();
    return rvVersao;
  }

  // Checagem automática ao abrir, só com a VPN ligada (é quando dá para instalar); instalar só com toque.
  async function autoChecarVersao(e) {
    if (!PODE_ATUALIZAR || !e || !e.vpnAtiva || rvOcupado) return;
    if (Date.now() - atChecado < 30 * 60000) return;
    atChecado = Date.now();
    const v = await lerVersao();
    if (!v || v.erro || !v.haNova || localStorage.getItem(AT_AVISO) === v.disponivel) return; // 1 aviso por versão
    localStorage.setItem(AT_AVISO, v.disponivel);
    aviso(`Versão nova do app (${v.disponivel}). Toque aqui para atualizar.`, 9000, abrirRenovacao);
  }

  async function atualizarApp() {
    if (!PODE_ATUALIZAR || rvOcupado) return;
    const v = rvVersao || {};
    if (!confirm(`Atualizar o app para a versão ${v.disponivel || 'nova'}?\n\nO app baixa a versão nova, assina com o seu Apple ID e instala pelo LocalDevVPN. No fim ele vai para a tela inicial e se reinstala: abra a Agenda de novo. Seus dados continuam.`)) return;
    let revogar = false;
    for (let vez = 0; vez < 2; vez++) {
      let pedido = null;
      rvOcupado = true; atProgresso = { texto: 'Começando…', progresso: 0 }; desenharEstado();
      try {
        const r = await RN.atualizar(rvOpcoes(revogar ? { revogar: true } : {}));
        aviso(`App atualizado para a versão ${r && r.para}.`, 7000);
      } catch (e) {
        const m = (e && (e.message || e.errorMessage)) || 'falhou';
        if (e && e.code === 'PRECISA_REVOGAR' && !revogar) pedido = { m, lista: (e.data && e.data.certificados) || e.certificados || [] };
        else aviso(`Atualização do app: ${m}`, 8000);
      } finally {
        rvOcupado = false; atProgresso = null;
        lerEstado(false); lerVersao();
      }
      if (!pedido) return;
      const quais = pedido.lista.length ? `\n\nCertificados da conta (revoga só o necessário, nesta ordem): ${pedido.lista.join(', ')}.` : '';
      if (!confirm(`${pedido.m}${quais}\n\nRevogar e continuar?`)) return;
      revogar = true;
    }
  }

  function abrirRenovacao() {
    if (!rvUi) return;
    if (!rvUi.open) rvUi.showModal();
    desenharEstado(); lerEstado(true); lerVersao();
  }

  function montarUi() {
    if (!RN || document.getElementById('renovacaoBtn')) return;
    const menu = document.getElementById('quickMenu');
    if (!menu) return;
    const b = document.createElement('button');
    b.id = 'renovacaoBtn'; b.type = 'button'; b.title = 'Renovação do app (perfil de 7 dias)';
    b.innerHTML = '<span class="menu-option-icon"><svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4h-4"/><path d="M12 8v4l3 2"/></svg></span><span id="renovacaoLabel">Renovação do app</span>';
    // No topo do menu (no iPhone o menu passa da altura da tela e o último item ficava escondido).
    menu.insertBefore(b, menu.firstChild);
    if (!document.getElementById('quickMenuRolavel')) {
      const css = document.createElement('style'); css.id = 'quickMenuRolavel';
      css.textContent = '#quickMenu{max-height:calc(100dvh - 140px - env(safe-area-inset-bottom,0px));overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}';
      document.head.appendChild(css);
    }

    const st = document.createElement('style');
    st.textContent = '#renovacaoDialog input[type=password],#renovacaoDialog input[type=email]{width:100%;min-height:46px;padding:11px 12px;border:1px solid var(--line);border-radius:13px;outline:0;background:var(--soft);color:var(--text);font-size:16px}#renovacaoDialog input[type=file]{width:100%;font-size:14px;color:var(--muted)}#renovacaoDialog .rv-linha{display:flex;justify-content:space-between;gap:10px;padding:3px 0}#renovacaoDialog .rv-linha b{color:var(--text);text-align:right}#renovacaoDialog .rv-linha b.rv-ok{color:#4ade80}#renovacaoDialog .rv-linha b.rv-no{color:#f87171}';
    document.head.appendChild(st);

    rvUi = document.createElement('dialog');
    rvUi.id = 'renovacaoDialog';
    rvUi.innerHTML = `<div class="modal">
      <h3>Renovação do app</h3>
      <p>O app renova sozinho o perfil de 7 dias e se atualiza (como o SideStore), sem AltStore. Precisa do LocalDevVPN ligado.</p>
      <div class="notice" id="rvStatus">Carregando…</div>
      <button class="secondary wide" id="rvVpn" type="button" hidden>Ligar VPN (LocalDevVPN)</button>
      <button class="primary wide" id="rvAtualizar" type="button" hidden>Atualizar o app</button>
      <div id="rvLogin">
        <button class="secondary wide" id="rvEntrar" type="button">Entrar com o Apple ID</button>
        <p class="field-label">Abre uma janela do próprio iPhone: o Apple ID e a senha não passam pela página.</p>
      </div>
      <button class="secondary wide" id="rvSair" type="button" hidden>Sair do Apple ID</button>
      <label class="field-label" for="rvArquivo">Arquivo de pareamento (gerado no PC pelo iloader)</label>
      <input type="file" id="rvArquivo">
      <label class="field-label" for="rvIp">IP do iPhone na VPN (opcional)</label>
      <input type="text" id="rvIp" inputmode="decimal" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="vazio = LocalDevVPN (10.7.0.1)">
      <div class="actions">
        <button class="secondary" id="rvFechar" type="button">Fechar</button>
        <button class="primary" id="rvRenovar" type="button">Renovar agora</button>
      </div>
    </div>`;
    document.body.appendChild(rvUi);
    const $ = id => rvUi.querySelector('#' + id);
    $('rvIp').value = localStorage.getItem(RV_IP) || '';
    $('rvIp').addEventListener('change', () => {
      const v = $('rvIp').value.trim();
      if (v && !/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) { aviso('IP inválido (use algo como 100.101.102.103).'); return; }
      if (v) localStorage.setItem(RV_IP, v); else localStorage.removeItem(RV_IP);
      lerEstado(false);
    });

    b.addEventListener('click', abrirRenovacao);
    $('rvFechar').addEventListener('click', () => rvUi.close());
    $('rvRenovar').addEventListener('click', () => renovarAgora(true));
    $('rvVpn').addEventListener('click', ligarVpn);
    $('rvAtualizar').addEventListener('click', atualizarApp);
    $('rvSair').addEventListener('click', async () => {
      if (!confirm('Sair do Apple ID neste app? (o pareamento continua salvo)')) return;
      try { await RN.sair(); } catch (_) {}
      lerEstado(false);
    });
    $('rvEntrar').addEventListener('click', async () => {
      if (rvOcupado) return;
      rvOcupado = true; desenharEstado('Entrando na Apple… (pode pedir o código de 2 fatores)');
      try {
        const r = await RN.entrarNativo();
        aviso(`Conectado: ${r.nome || r.appleId}.`);
      } catch (e) {
        const m = (e && e.message) || 'erro';
        if (/not implemented|UNIMPLEMENTED/i.test(m)) aviso('Atualize o app Agenda no AltStore (versão nova) para entrar com o Apple ID.', 7000);
        else if (!/Cancelado/.test(m)) aviso(`Não entrou: ${m}`, 7000);
      } finally {
        rvOcupado = false; lerEstado(false);
      }
    });
    $('rvArquivo').addEventListener('change', async ev => {
      const f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      try {
        const buf = new Uint8Array(await f.arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        const r = await RN.salvarPareamento({ base64: btoa(bin) });
        aviso(`Pareamento salvo (${r.tipo}).`);
      } catch (e) {
        aviso(`Arquivo de pareamento inválido: ${(e && e.message) || 'erro'}`, 7000);
      }
      lerEstado(false);
    });

    RN.addListener('codigo2fa', pedirCodigo);
    if (PODE_ATUALIZAR) RN.addListener('atualizacao', p => { if (rvOcupado) atProgresso = p; if (rvUi && rvUi.open) desenharEstado(); });
  }

  function desenharEstado(ocupadoMsg) {
    if (!rvUi) return;
    const $ = id => rvUi.querySelector('#' + id);
    const e = rvEstado || {};
    const sim = (v, ok, no) => `<b class="${v ? 'rv-ok' : 'rv-no'}">${esc(v ? ok : no)}</b>`;
    const dias = typeof e.diasRestantes === 'number' ? `${fmtDias(e.diasRestantes)} dias` : '—';
    let html = '';
    const msg = atProgresso ? `Atualizando (${Number(atProgresso.progresso) || 0}%): ${atProgresso.texto || ''}` : ocupadoMsg;
    if (msg) html += `<strong>${esc(msg)}</strong>`;
    html += `<div class="rv-linha"><span>Validade</span><b>${e.validade ? esc(fmtData(e.validade)) + ' · ' + dias : '—'}</b></div>`;
    if (e.validadeNoAparelho) html += `<div class="rv-linha"><span>Perfil no iPhone</span><b>${esc(fmtData(e.validadeNoAparelho))}</b></div>`;
    html += `<div class="rv-linha"><span>Apple ID</span>${sim(e.logado, e.appleId || 'conectado', 'não conectado')}</div>`;
    html += `<div class="rv-linha"><span>Pareamento</span>${sim(e.temPareamento, e.tipoPareamento || 'salvo', 'falta importar')}</div>`;
    html += `<div class="rv-linha"><span>VPN (${esc(localStorage.getItem(RV_IP) || '10.7.0.1')})</span>${sim(e.vpnAtiva, 'responde', 'sem resposta')}</div>`;
    if (e.ultimaRenovacao) html += `<div class="rv-linha"><span>Última renovação</span><b>${esc(fmtData(e.ultimaRenovacao))}</b></div>`;
    if (e.ultimoErro) html += `<div style="margin-top:6px">Último erro: ${esc(e.ultimoErro)}</div>`;
    if (e.erroAparelho) html += `<div style="margin-top:6px">Leitura do iPhone: ${esc(e.erroAparelho)}</div>`;
    const v = rvVersao;
    if (PODE_ATUALIZAR && v) {
      html += `<div class="rv-linha"><span>Versão do app</span><b>${esc(v.atual || '—')}</b></div>`;
      if (v.haNova) html += `<div class="rv-linha"><span>Versão nova</span><b class="rv-ok">${esc(v.disponivel)}</b></div>`;
      if (v.erro) html += `<div style="margin-top:6px">Fonte de atualizações: ${esc(v.erro)}</div>`;
      if (v.ultimoErro) html += `<div style="margin-top:6px">Última atualização: ${esc(v.ultimoErro)}</div>`;
    } else if (!PODE_ATUALIZAR) {
      html += '<div style="margin-top:6px">Esta versão do app ainda não se atualiza sozinha: instale uma vez a versão nova pelo AltStore; as seguintes vêm por aqui.</div>';
    }
    $('rvStatus').innerHTML = html;
    $('rvLogin').hidden = !!e.logado;
    $('rvSair').hidden = !e.logado;
    $('rvRenovar').disabled = rvOcupado || !e.logado || !e.temPareamento;
    $('rvEntrar').disabled = rvOcupado;
    $('rvVpn').hidden = !rvEstado || !!e.vpnAtiva;
    $('rvAtualizar').hidden = !(PODE_ATUALIZAR && v && v.haNova);
    $('rvAtualizar').disabled = rvOcupado || !e.logado || !e.temPareamento || !e.vpnAtiva;
    $('rvAtualizar').textContent = v && v.disponivel ? `Atualizar o app (${v.disponivel})` : 'Atualizar o app';
  }

  // ---------- ciclo ----------
  function ciclo() { conferirGps(); sincronizarLembretes(); }
  // Diagnóstico: app nativo sem o plugin de renovação -> item no topo do menu dizendo o que o app enxerga.
  function montarDiagnostico() {
    const menu = document.getElementById('quickMenu');
    if (!menu || document.getElementById('renovacaoDiag')) return;
    const b = document.createElement('button');
    b.id = 'renovacaoDiag'; b.type = 'button';
    b.innerHTML = '<span class="menu-option-icon"><svg viewBox="0 0 24 24"><path d="M12 8v5"/><path d="M12 16h.01"/><circle cx="12" cy="12" r="9"/></svg></span><span>Renovação do app (diagnóstico)</span>';
    b.addEventListener('click', async () => {
      let nomes = [];
      try { nomes = (C.PluginHeaders || []).map(h => h.name); } catch (_) {}
      let versao = '?';
      try { const info = await registrar('App').getInfo(); versao = `${info.version} (${info.build})`; } catch (_) {}
      window.alert(`App ${versao}
Plugins nativos: ${nomes.join(', ') || 'nenhum'}
AgendaRenovacao: ${typeof C.isPluginAvailable === 'function' ? C.isPluginAvailable('AgendaRenovacao') : 'sem isPluginAvailable'}`);
    });
    menu.insertBefore(b, menu.firstChild);
  }
  // Roda já se a página terminou de carregar (o 'load' pode ter passado antes deste script),
  // e recoloca o item quando o menu abre (outro script pode redesenhar o menu).
  const quandoPronto = fn => { const seguro = () => { try { fn(); } catch (e) { log('erro', e && e.message); } };
    if (document.readyState === 'complete') seguro(); else window.addEventListener('load', seguro); };
  let itemRenovacao = null;
  const garantirItem = () => {
    const menu = document.getElementById('quickMenu');
    if (!menu) return;
    const id = RN ? 'renovacaoBtn' : 'renovacaoDiag';
    let b = itemRenovacao || document.getElementById(id);
    if (!b) { RN ? montarUi() : montarDiagnostico(); itemRenovacao = document.getElementById(id); return; }
    itemRenovacao = b;
    if (menu.firstElementChild !== b) menu.insertBefore(b, menu.firstChild); // mesmo elemento: sem duplicar
  };
  quandoPronto(garantirItem);
  document.addEventListener('click', e => { if (e.target && e.target.closest && e.target.closest('#moreMenuBtn')) setTimeout(() => { try { garantirItem(); } catch (_) {} }, 0); }, true);
  { let n = 0; const t = setInterval(() => { try { garantirItem(); } catch (_) {} if (++n >= 15) clearInterval(t); }, 2000); }
  if (RN) {
    quandoPronto(() => setTimeout(autoRenovar, 4000));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(autoRenovar, 1500); });
  }
  quandoPronto(() => setTimeout(ciclo, 2500));
  setInterval(ciclo, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ciclo(); });
  window.addEventListener('storage', e => { if (e.key === TK) sincronizarLembretes(); });
  // aviso imediato (sem `schedule` o plugin mostra na hora; não fica pendente, então
  // o sincronizarLembretes não o cancela). Usado pela conclusão automática por presença.
  async function avisoImediato(titulo, corpo) {
    try {
      if (permissaoNotif === null) { const p = await LN.checkPermissions(); permissaoNotif = p.display; }
      if (permissaoNotif !== 'granted') return false;
      await LN.schedule({ notifications: [{ id: idNum(`auto-${Date.now()}-${corpo}`), title: titulo, body: corpo }] });
      return true;
    } catch (e) { log('aviso falhou', e && e.message); return false; }
  }
  // Ícone por usuário: a conta "acms" usa o ícone AC, embutido no app a partir da versão com trocarIcone.
  // Só troca quando o ícone atual é outro, porque o iOS mostra um aviso a cada troca.
  const ICONE_POR_USUARIO = { acms: 'AC' };
  async function ajustarIcone() {
    if (!RN) return;
    const cab = (C.PluginHeaders || []).find(h => h.name === 'AgendaRenovacao');
    if (!cab || !(cab.methods || []).some(m => m.name === 'trocarIcone')) return; // app antigo, sem a função
    let usuario = '';
    try { usuario = String((JSON.parse(localStorage.getItem('agenda_app_profile_v1') || '{}') || {}).username || '').trim().toLowerCase(); } catch (_) {}
    if (!usuario) return; // ainda sem login: não mexe no ícone
    const alvo = ICONE_POR_USUARIO[usuario] || '';
    try {
      const atual = await RN.iconeAtual();
      if (!atual || !atual.suporta || (atual.icone || '') === alvo) return;
      await RN.trocarIcone({ nome: alvo });
      log('ícone', alvo || 'padrão');
    } catch (e) { log('ícone falhou', e && e.message); }
  }
  quandoPronto(() => setTimeout(ajustarIcone, 3000));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(ajustarIcone, 2000); });
  window.AgendaNativo = { ciclo, ligarGps, desligarGps, sincronizarLembretes, proximosLembretes, avisoImediato, ajustarIcone,
    renovacao: RN ? { estado: lerEstado, renovar: () => renovarAgora(true) } : null,
    atualizacao: PODE_ATUALIZAR ? { versao: lerVersao, atualizar: atualizarApp } : null, ligarVpn };
})();
