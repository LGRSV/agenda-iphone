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
      Campo opcional "IP do iPhone na VPN" (vazio = 10.7.0.1 do LocalDevVPN), para testar com Tailscale. */
(() => {
  'use strict';
  const C = window.Capacitor;
  if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return;

  const BG = C.registerPlugin('BackgroundGeolocation');
  const LN = C.registerPlugin('LocalNotifications');
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
  let watcherId = null;
  async function ligarGps() {
    if (watcherId) return;
    try {
      watcherId = await BG.addWatcher({
        backgroundTitle: 'Agenda',
        backgroundMessage: 'Registrando chegadas e saídas dos seus lugares.',
        requestPermissions: true,
        stale: false,
        distanceFilter: 25
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
      log('gps ligado');
    } catch (e) { watcherId = null; log('gps falhou', e && e.message); }
  }
  async function desligarGps() {
    if (!watcherId) return;
    const id = watcherId; watcherId = null;
    try { await BG.removeWatcher({ id }); } catch (_) {}
    log('gps desligado');
  }
  function conferirGps() {
    const L = window.AgendaLocal;
    if (!L || typeof L.ativo !== 'function') return;
    if (L.ativo()) ligarGps(); else desligarGps();
  }

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
    ? C.registerPlugin('AgendaRenovacao') : null;
  const RV_AUTO = 'agenda_renovacao_auto_ts';
  const RV_IP = 'agenda_renovacao_ip';
  let rvOcupado = false, rvEstado = null, rvUi = null;
  const rvOpcoes = extra => {
    const ip = (localStorage.getItem(RV_IP) || '').trim();
    return Object.assign(ip ? { ip } : {}, extra || {});
  };

  function aviso(msg, ms) {
    const t = document.getElementById('toast');
    if (!t) { log(msg); return; }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(aviso._t); aviso._t = setTimeout(() => t.classList.remove('show'), ms || 4500);
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
    const lab = document.getElementById('renovacaoLabel');
    if (lab) lab.textContent = e && typeof e.diasRestantes === 'number'
      ? `Renovação do app · ${fmtDias(e.diasRestantes)} d` : 'Renovação do app';
    if (rvUi && rvUi.open) desenharEstado();
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
    if (!e || !e.logado || !e.temPareamento || !(typeof e.diasRestantes === 'number' && e.diasRestantes <= 3)) return;
    if (!e.vpnAtiva) { aviso(`O app vence em ${fmtDias(e.diasRestantes)} dias. Ligue o LocalDevVPN e abra a Agenda para renovar.`, 6000); return; }
    const ultima = Number(localStorage.getItem(RV_AUTO)) || 0;
    if (Date.now() - ultima < 2 * 3600000) return; // no máximo 1 tentativa automática a cada 2 h
    localStorage.setItem(RV_AUTO, String(Date.now()));
    await renovarAgora(false);
  }

  function montarUi() {
    if (!RN || document.getElementById('renovacaoBtn')) return;
    const menu = document.getElementById('quickMenu');
    if (!menu) return;
    const b = document.createElement('button');
    b.id = 'renovacaoBtn'; b.type = 'button'; b.title = 'Renovação do app (perfil de 7 dias)';
    b.innerHTML = '<span class="menu-option-icon"><svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4h-4"/><path d="M12 8v4l3 2"/></svg></span><span id="renovacaoLabel">Renovação do app</span>';
    menu.appendChild(b);

    const st = document.createElement('style');
    st.textContent = '#renovacaoDialog input[type=password],#renovacaoDialog input[type=email]{width:100%;min-height:46px;padding:11px 12px;border:1px solid var(--line);border-radius:13px;outline:0;background:var(--soft);color:var(--text);font-size:16px}#renovacaoDialog input[type=file]{width:100%;font-size:14px;color:var(--muted)}#renovacaoDialog .rv-linha{display:flex;justify-content:space-between;gap:10px;padding:3px 0}#renovacaoDialog .rv-linha b{color:var(--text);text-align:right}#renovacaoDialog .rv-linha b.rv-ok{color:#4ade80}#renovacaoDialog .rv-linha b.rv-no{color:#f87171}';
    document.head.appendChild(st);

    rvUi = document.createElement('dialog');
    rvUi.id = 'renovacaoDialog';
    rvUi.innerHTML = `<div class="modal">
      <h3>Renovação do app</h3>
      <p>O app renova sozinho o perfil de 7 dias (como o SideStore), sem reinstalar. Precisa do LocalDevVPN ligado.</p>
      <div class="notice" id="rvStatus">Carregando…</div>
      <div id="rvLogin">
        <label class="field-label" for="rvApple">Apple ID (o mesmo usado no AltStore)</label>
        <input type="email" id="rvApple" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false">
        <label class="field-label" for="rvSenha">Senha do Apple ID</label>
        <input type="password" id="rvSenha" autocomplete="current-password">
        <button class="secondary wide" id="rvEntrar" type="button">Entrar</button>
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

    b.addEventListener('click', () => { rvUi.showModal(); desenharEstado(); lerEstado(true); });
    $('rvFechar').addEventListener('click', () => rvUi.close());
    $('rvRenovar').addEventListener('click', () => renovarAgora(true));
    $('rvSair').addEventListener('click', async () => {
      if (!confirm('Sair do Apple ID neste app? (o pareamento continua salvo)')) return;
      try { await RN.sair(); } catch (_) {}
      lerEstado(false);
    });
    $('rvEntrar').addEventListener('click', async () => {
      const appleId = $('rvApple').value.trim(), senha = $('rvSenha').value;
      if (!appleId || !senha) { aviso('Digite Apple ID e senha.'); return; }
      if (rvOcupado) return;
      rvOcupado = true; desenharEstado('Entrando na Apple… (pode pedir o código de 2 fatores)');
      try {
        const r = await RN.entrar({ appleId, senha });
        $('rvSenha').value = '';
        aviso(`Conectado: ${r.nome || r.appleId}.`);
      } catch (e) {
        aviso(`Não entrou: ${(e && e.message) || 'erro'}`, 7000);
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
  }

  function desenharEstado(ocupadoMsg) {
    if (!rvUi) return;
    const $ = id => rvUi.querySelector('#' + id);
    const e = rvEstado || {};
    const sim = (v, ok, no) => `<b class="${v ? 'rv-ok' : 'rv-no'}">${esc(v ? ok : no)}</b>`;
    const dias = typeof e.diasRestantes === 'number' ? `${fmtDias(e.diasRestantes)} dias` : '—';
    let html = '';
    if (ocupadoMsg) html += `<strong>${esc(ocupadoMsg)}</strong>`;
    html += `<div class="rv-linha"><span>Validade</span><b>${e.validade ? esc(fmtData(e.validade)) + ' · ' + dias : '—'}</b></div>`;
    if (e.validadeNoAparelho) html += `<div class="rv-linha"><span>Perfil no iPhone</span><b>${esc(fmtData(e.validadeNoAparelho))}</b></div>`;
    html += `<div class="rv-linha"><span>Apple ID</span>${sim(e.logado, e.appleId || 'conectado', 'não conectado')}</div>`;
    html += `<div class="rv-linha"><span>Pareamento</span>${sim(e.temPareamento, e.tipoPareamento || 'salvo', 'falta importar')}</div>`;
    html += `<div class="rv-linha"><span>VPN (${esc(localStorage.getItem(RV_IP) || '10.7.0.1')})</span>${sim(e.vpnAtiva, 'responde', 'sem resposta')}</div>`;
    if (e.ultimaRenovacao) html += `<div class="rv-linha"><span>Última renovação</span><b>${esc(fmtData(e.ultimaRenovacao))}</b></div>`;
    if (e.ultimoErro) html += `<div style="margin-top:6px">Último erro: ${esc(e.ultimoErro)}</div>`;
    if (e.erroAparelho) html += `<div style="margin-top:6px">Leitura do iPhone: ${esc(e.erroAparelho)}</div>`;
    $('rvStatus').innerHTML = html;
    $('rvLogin').hidden = !!e.logado;
    $('rvSair').hidden = !e.logado;
    $('rvRenovar').disabled = rvOcupado || !e.logado || !e.temPareamento;
    $('rvEntrar').disabled = rvOcupado;
  }

  // ---------- ciclo ----------
  function ciclo() { conferirGps(); sincronizarLembretes(); }
  if (RN) {
    window.addEventListener('load', () => { montarUi(); setTimeout(autoRenovar, 4000); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(autoRenovar, 1500); });
  }
  window.addEventListener('load', () => setTimeout(ciclo, 2500));
  setInterval(ciclo, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ciclo(); });
  window.addEventListener('storage', e => { if (e.key === TK) sincronizarLembretes(); });
  window.AgendaNativo = { ciclo, ligarGps, desligarGps, sincronizarLembretes, proximosLembretes,
    renovacao: RN ? { estado: lerEstado, renovar: () => renovarAgora(true) } : null };
})();
