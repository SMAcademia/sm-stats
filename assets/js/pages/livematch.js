/* SM Stats — Registro en vivo (consola táctil para banda).
   Página standalone (registro-vivo.html?id=<matchId>), sin sidebar,
   pensada para móvil: reloj derivado de eventos-marcador
   (inicio_1/fin_1/inicio_2/fin_2), taps por tipo de evento + jugador
   (propio) o dorsal (rival), deshacer último tap. Independiente del
   acta — al finalizar, remite a Partidos para revisar y confirmar.

   Cada tap se guarda AL INSTANTE en localStorage (id generado aquí mismo)
   y se pinta en pantalla sin esperar a la red — la sincronización con la
   hoja de cálculo pasa en segundo plano, por lotes, cada pocos segundos.
   Así la consola funciona igual con buena cobertura que en un campo con
   wifi/datos flojos: un tap nunca se queda "colgado" esperando al
   servidor. Si se cierra la pestaña con eventos sin sincronizar, se
   recuperan de localStorage la próxima vez que se abra esta misma
   consola en este mismo dispositivo. */

(function () {
  const root = document.getElementById('live-root');
  const matchId = SM.ui.qs('id');

  const EVENT_TYPES = [
    { tipo: 'gol', label: 'Gol', accent: 'var(--green)' },
    { tipo: 'asistencia', label: 'Asistencia', accent: 'var(--cyan)' },
    { tipo: 'amarilla', label: 'Amarilla', accent: 'var(--amber)' },
    { tipo: 'roja', label: 'Roja', accent: 'var(--red)' },
    { tipo: 'tiro', label: 'Tiro' },
    { tipo: 'tiro_puerta', label: 'Tiro a puerta' },
    { tipo: 'corner', label: 'Córner' },
    { tipo: 'falta_hecha', label: 'Falta hecha' },
    { tipo: 'falta_recibida', label: 'Falta recibida' },
    { tipo: 'llegada_izq', label: 'Llegada izq.' },
    { tipo: 'llegada_cen', label: 'Llegada centro' },
    { tipo: 'llegada_der', label: 'Llegada der.' }
  ];
  const EVENT_LABELS = {};
  EVENT_TYPES.forEach(function (e) { EVENT_LABELS[e.tipo] = e.label; });

  const PHASE_LABELS = {
    no_iniciado: 'Antes de empezar',
    primera: '1ª parte',
    descanso: 'Descanso',
    segunda: '2ª parte',
    finalizado: 'Partido finalizado'
  };

  const STORAGE_KEY = 'sm_stats_live_pending_' + matchId;
  const CACHE_KEY = 'sm_stats_live_cache_' + matchId;
  const SYNC_INTERVAL_MS = 10000;
  const SYNC_DEBOUNCE_MS = 1200;

  let DATA = null;
  let match = null;
  let confirmedEvents = [];   // eventos que sabemos guardados en la hoja
  let pendingAdds = [];       // taps hechos aquí, todavía sin sincronizar
  let pendingDeleteIds = [];  // deshacer de un evento ya confirmado, pendiente de borrar en la hoja
  let needsReconcile = false; // arrancamos sin red: no sabemos qué había ya confirmado
  let activeTeam = 'propio';
  let overlay = null; // { kind: 'player' | 'dorsal' }
  let pendingTipo = null;
  let tickTimer = null;
  let syncTimer = null;
  let syncDebounceTimer = null;
  let syncing = false;
  let lastSyncError = null;

  // ---- vista fusionada: confirmados + pendientes de subir, sin los
  // pendientes de borrar — es lo único que el resto del código consulta. ----
  function mergedEvents() {
    const deleted = {};
    pendingDeleteIds.forEach(function (id) { deleted[id] = true; });
    return confirmedEvents.concat(pendingAdds)
      .filter(function (e) { return !deleted[e.id]; })
      .sort(function (a, b) { return new Date(a.ts) - new Date(b.ts); });
  }

  function hasPending() { return pendingAdds.length > 0 || pendingDeleteIds.length > 0; }

  function localEventId() {
    return 'le' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---- localStorage: cola de sincronización + última copia conocida del
  // partido (para poder abrir la consola aunque falle la carga inicial). ----
  function savePending() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ pendingAdds: pendingAdds, pendingDeleteIds: pendingDeleteIds }));
    } catch (e) { /* localStorage bloqueado — no es crítico, solo se pierde la recuperación tras cerrar */ }
  }

  function loadPending() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      pendingAdds = parsed.pendingAdds || [];
      pendingDeleteIds = parsed.pendingDeleteIds || [];
    } catch (e) { /* noop */ }
  }

  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ match: match, players: DATA.players, settings: DATA.settings }));
    } catch (e) { /* noop */ }
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // ---- reloj: derivado de los eventos-marcador, no de un contador propio,
  // así que sobrevive a un refresco de página o a que el móvil se bloquee. ----

  function markers() {
    const list = mergedEvents();
    function find(tipo) { return list.find(function (e) { return e.tipo === tipo; }); }
    return { i1: find('inicio_1'), f1: find('fin_1'), i2: find('inicio_2'), f2: find('fin_2') };
  }

  function phaseOf(m) {
    if (m.f2) return 'finalizado';
    if (m.i2) return 'segunda';
    if (m.f1) return 'descanso';
    if (m.i1) return 'primera';
    return 'no_iniciado';
  }

  function elapsedMs(m, phase) {
    const now = Date.now();
    let ms = 0;
    if (m.i1) {
      const t0 = new Date(m.i1.ts).getTime();
      const t1 = m.f1 ? new Date(m.f1.ts).getTime() : (phase === 'primera' ? now : t0);
      ms += Math.max(0, t1 - t0);
    }
    if (m.i2) {
      const t0 = new Date(m.i2.ts).getTime();
      const t1 = m.f2 ? new Date(m.f2.ts).getTime() : (phase === 'segunda' ? now : t0);
      ms += Math.max(0, t1 - t0);
    }
    return ms;
  }

  function clockLabel(ms) {
    const totalSec = Math.floor(ms / 1000);
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    return mm + ':' + String(ss).padStart(2, '0');
  }

  function currentMinuteParte() {
    const m = markers();
    const phase = phaseOf(m);
    return { minuto: Math.floor(elapsedMs(m, phase) / 60000), parte: m.i2 ? 2 : 1, phase: phase };
  }

  function score() {
    let propio = 0, rival = 0;
    mergedEvents().forEach(function (e) {
      if (e.tipo !== 'gol') return;
      if (e.team === 'propio') propio++;
      else if (e.team === 'rival') rival++;
    });
    return { propio: propio, rival: rival };
  }

  function ownPlayers() {
    return (DATA.players || []).filter(function (p) { return p.activo; }).sort(function (a, b) { return (a.dorsal || 99) - (b.dorsal || 99); });
  }

  function eventFeedText(e) {
    if (e.tipo === 'inicio_1') return 'Inicio del partido';
    if (e.tipo === 'fin_1') return 'Fin de la 1ª parte';
    if (e.tipo === 'inicio_2') return 'Inicio de la 2ª parte';
    if (e.tipo === 'fin_2') return 'Fin del partido';
    const label = EVENT_LABELS[e.tipo] || e.tipo;
    let who = '';
    if (e.team === 'propio' && e.player_id) {
      const p = SM.stats.byId(DATA.players)[e.player_id];
      if (p) who = ' — ' + p.nombre;
    } else if (e.team === 'rival' && e.dorsal_rival != null) {
      who = ' — rival #' + e.dorsal_rival;
    }
    const teamTag = e.team === 'rival' ? ' (rival)' : '';
    return label + teamTag + who;
  }

  // ---- sincronización en segundo plano ----

  function syncPending() {
    if (syncing || !hasPending()) { render(); return; }
    syncing = true;
    render();
    const addsBatch = pendingAdds.slice();
    const deleteBatch = pendingDeleteIds.slice();
    const tasks = [];
    if (addsBatch.length) {
      tasks.push(SM.api.postAction('addLiveEvents', { matchId: matchId, events: addsBatch }).then(function () {
        pendingAdds = pendingAdds.filter(function (e) { return addsBatch.indexOf(e) === -1; });
        confirmedEvents = confirmedEvents.concat(addsBatch);
      }));
    }
    if (deleteBatch.length) {
      tasks.push(SM.api.postAction('deleteLiveEvents', { ids: deleteBatch }).then(function () {
        pendingDeleteIds = pendingDeleteIds.filter(function (id) { return deleteBatch.indexOf(id) === -1; });
        confirmedEvents = confirmedEvents.filter(function (e) { return deleteBatch.indexOf(e.id) === -1; });
      }));
    }
    Promise.all(tasks).then(function () {
      lastSyncError = null;
      savePending();
      syncing = false;
      if (!needsReconcile) { render(); return; }
      // Arrancamos sin red y no sabíamos qué había ya en la hoja — ahora que
      // hay conexión, se refresca una vez para no dar por perdido lo que
      // otra sesión (u otro día) hubiera guardado ya de este partido.
      needsReconcile = false;
      return SM.api.fetchAll(true).then(function (data) {
        const scoped = SM.team.filterData(data, SM.team.current());
        const pendingIds = {};
        pendingAdds.forEach(function (e) { pendingIds[e.id] = true; });
        confirmedEvents = (scoped.matchLiveEvents || [])
          .filter(function (e) { return e.match_id === matchId && !pendingIds[e.id]; });
        render();
      }).catch(function () { render(); });
    }).catch(function (err) {
      syncing = false;
      lastSyncError = err.message;
      savePending();
      render();
    });
  }

  function scheduleSync(delayMs) {
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(syncPending, delayMs != null ? delayMs : SYNC_DEBOUNCE_MS);
  }

  function startSyncLoop() {
    scheduleSync(500);
    clearInterval(syncTimer);
    syncTimer = setInterval(syncPending, SYNC_INTERVAL_MS);
  }

  // ---- acciones: instantáneas — se guardan en local y se pintan ya; la
  // sincronización con la hoja pasa en segundo plano (ver arriba). ----

  function logMarker(tipo) {
    const cm = currentMinuteParte();
    const parte = (tipo === 'inicio_2' || tipo === 'fin_2') ? 2 : (cm.parte || 1);
    const row = {
      id: localEventId(), match_id: matchId, team: '', player_id: '', dorsal_rival: null,
      tipo: tipo, minuto: cm.minuto, parte: parte, ts: new Date().toISOString()
    };
    pendingAdds.push(row);
    savePending();
    render();
    scheduleSync(tipo === 'fin_2' ? 0 : SYNC_DEBOUNCE_MS);
  }

  function onEventTap(tipo) {
    const phase = phaseOf(markers());
    if (phase !== 'primera' && phase !== 'segunda') return;
    pendingTipo = tipo;
    overlay = { kind: activeTeam === 'propio' ? 'player' : 'dorsal' };
    render();
  }

  function commitEvent(extra) {
    const cm = currentMinuteParte();
    const row = Object.assign(
      { id: localEventId(), match_id: matchId, team: activeTeam, tipo: pendingTipo, player_id: '', dorsal_rival: null, minuto: cm.minuto, parte: cm.parte, ts: new Date().toISOString() },
      extra || {}
    );
    pendingTipo = null;
    overlay = null;
    pendingAdds.push(row);
    savePending();
    render();
    scheduleSync(SYNC_DEBOUNCE_MS);
  }

  function closeOverlay() { pendingTipo = null; overlay = null; render(); }

  function undoLast() {
    const list = mergedEvents();
    if (!list.length) return;
    const last = list[list.length - 1];
    if (!window.confirm('¿Deshacer "' + eventFeedText(last) + '"?')) return;
    const pendingIdx = pendingAdds.findIndex(function (e) { return e.id === last.id; });
    if (pendingIdx !== -1) {
      // Todavía no había salido de este dispositivo — no hace falta avisar a la hoja.
      pendingAdds.splice(pendingIdx, 1);
    } else {
      pendingDeleteIds.push(last.id);
      confirmedEvents = confirmedEvents.filter(function (e) { return e.id !== last.id; });
    }
    savePending();
    render();
    scheduleSync(500);
  }

  // ---- reloj en vivo: solo actualiza el número, no repinta toda la pantalla ----

  function stopTick() { if (tickTimer) { clearInterval(tickTimer); tickTimer = null; } }
  function startTick() {
    stopTick();
    tickTimer = setInterval(function () {
      const el = document.getElementById('live-clock-value');
      if (!el) { stopTick(); return; }
      const m = markers();
      el.textContent = clockLabel(elapsedMs(m, phaseOf(m)));
    }, 1000);
  }

  // ---- render ----

  // Estado de guardado, siempre visible — sin esto, no tener ni idea de si
  // los taps están llegando de verdad a la hoja es exactamente lo que hizo
  // parecer que "Iniciar partido" no funcionaba. "Reintentar ahora" fuerza
  // un intento inmediato en vez de esperar al siguiente ciclo automático.
  function syncStatusHtml() {
    const pendingCount = pendingAdds.length + pendingDeleteIds.length;
    if (syncing) return '<span class="live-sync-badge syncing">↻ Sincronizando…</span>';
    if (!pendingCount) return '<span class="live-sync-badge ok">✓ Guardado</span>';
    if (lastSyncError) {
      return (
        '<span class="live-sync-badge error">⚠ Sin conexión — ' + pendingCount + ' sin guardar</span>' +
        '<button type="button" class="retry-sync-btn">Reintentar</button>'
      );
    }
    return '<span class="live-sync-badge pending">⏳ ' + pendingCount + ' sin guardar</span>';
  }

  function headerHtml() {
    const clubName = (DATA.settings && DATA.settings.club_nombre) || 'Mi club';
    return (
      '<div class="live-header">' +
        '<a class="live-back" href="partidos.html">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>' +
        '</a>' +
        '<div style="min-width:0;flex:1 1 auto;">' +
          '<div class="live-header-title">' + SM.ui.escapeHtml(clubName) + ' vs ' + SM.ui.escapeHtml(match.rival || 'Rival') + '</div>' +
          '<div class="live-header-sub">' + SM.ui.formatDateShort(match.fecha) + (match.hora ? ' · ' + match.hora : '') + '</div>' +
        '</div>' +
        '<div class="live-sync-wrap">' + syncStatusHtml() + '</div>' +
      '</div>'
    );
  }

  function scoreboardHtml() {
    const clubName = (DATA.settings && DATA.settings.club_nombre) || 'Mi club';
    const s = score();
    const m = markers();
    const phase = phaseOf(m);
    const clock = clockLabel(elapsedMs(m, phase));
    const phaseBtn = (function () {
      if (phase === 'no_iniciado') return '<button class="live-phase-btn primary" id="phase-btn">Iniciar partido</button>';
      if (phase === 'primera') return '<button class="live-phase-btn" id="phase-btn">Fin 1ª parte</button>';
      if (phase === 'descanso') return '<button class="live-phase-btn primary" id="phase-btn">Iniciar 2ª parte</button>';
      if (phase === 'segunda') return '<button class="live-phase-btn danger" id="phase-btn">Finalizar partido</button>';
      return '';
    })();
    return (
      '<div class="live-scoreboard">' +
        '<div class="live-teams-row">' +
          '<span class="live-team-name own">' + SM.ui.escapeHtml(clubName) + '</span>' +
          '<span class="live-score-nums">' + s.propio + ' – ' + s.rival + '</span>' +
          '<span class="live-team-name">' + SM.ui.escapeHtml(match.rival || 'Rival') + '</span>' +
        '</div>' +
        (phase !== 'no_iniciado' ? '<span class="live-clock" id="live-clock-value">' + clock + '</span>' : '') +
        '<span class="live-phase-label">' + PHASE_LABELS[phase] + '</span>' +
        phaseBtn +
      '</div>'
    );
  }

  function teamTabsHtml() {
    const phase = phaseOf(markers());
    const enabled = phase === 'primera' || phase === 'segunda';
    return (
      '<div class="live-teamtabs">' +
        '<button class="live-teamtab propio' + (activeTeam === 'propio' ? ' active' : '') + '" data-team="propio"' + (enabled ? '' : ' disabled') + '>NUESTRO EQUIPO</button>' +
        '<button class="live-teamtab rival' + (activeTeam === 'rival' ? ' active' : '') + '" data-team="rival"' + (enabled ? '' : ' disabled') + '>RIVAL</button>' +
      '</div>'
    );
  }

  function eventGridHtml() {
    const phase = phaseOf(markers());
    const enabled = phase === 'primera' || phase === 'segunda';
    return (
      '<div class="live-eventgrid">' +
        EVENT_TYPES.map(function (ev) {
          const style = ev.accent ? 'border-color:' + SM.ui.alpha(ev.accent, 0.5) + ';' : '';
          return (
            '<button class="live-event-btn' + (enabled ? '' : ' disabled') + '" data-tipo="' + ev.tipo + '" style="' + style + '"' + (enabled ? '' : ' disabled') + '>' +
              '<span class="live-event-label" style="' + (ev.accent ? 'color:' + ev.accent + ';' : '') + '">' + SM.ui.escapeHtml(ev.label) + '</span>' +
            '</button>'
          );
        }).join('') +
      '</div>'
    );
  }

  function feedHtml() {
    const rows = mergedEvents().slice().reverse().slice(0, 30);
    return (
      '<div class="live-feed-wrap">' +
        '<div class="live-feed-title">Últimos eventos</div>' +
        (rows.length ? rows.map(function (e, i) {
          const isMarker = e.tipo.indexOf('inicio_') === 0 || e.tipo.indexOf('fin_') === 0;
          return (
            '<div class="live-feed-item">' +
              '<span class="live-feed-minute">' + e.minuto + '\'</span>' +
              (isMarker ? '<span class="live-feed-dot" style="background:var(--text-ghost);"></span>' : '<span class="live-feed-dot ' + e.team + '"></span>') +
              '<span class="live-feed-text">' + SM.ui.escapeHtml(eventFeedText(e)) + '</span>' +
              (i === 0 ? '<button class="live-feed-undo" id="undo-btn">Deshacer</button>' : '') +
            '</div>'
          );
        }).join('') : '<div class="live-feed-empty">Todavía no hay eventos.</div>') +
      '</div>'
    );
  }

  function overlayHtml() {
    if (!overlay) return '';
    if (overlay.kind === 'player') {
      const players = ownPlayers();
      return (
        '<div class="live-overlay-backdrop" id="live-overlay-backdrop">' +
          '<div class="live-overlay-sheet">' +
            '<div class="live-overlay-title">' + SM.ui.escapeHtml(EVENT_LABELS[pendingTipo] || '') + ' — ¿quién?</div>' +
            '<div class="live-playergrid">' +
              players.map(function (p) {
                return (
                  '<button class="live-player-btn" data-player="' + p.id + '">' +
                    '<span class="live-player-dorsal">' + (p.dorsal != null ? p.dorsal : '—') + '</span>' +
                    '<span class="live-player-name">' + SM.ui.escapeHtml((p.nombre || '').split(' ')[0]) + '</span>' +
                  '</button>'
                );
              }).join('') +
            '</div>' +
            '<button class="live-skip-btn" id="overlay-skip">Sin jugador concreto</button>' +
            '<div class="live-overlay-actions"><button class="btn btn-outline" id="overlay-cancel">Cancelar</button></div>' +
          '</div>' +
        '</div>'
      );
    }
    return (
      '<div class="live-overlay-backdrop" id="live-overlay-backdrop">' +
        '<div class="live-overlay-sheet">' +
          '<div class="live-overlay-title">' + SM.ui.escapeHtml(EVENT_LABELS[pendingTipo] || '') + ' del rival — dorsal (opcional)</div>' +
          '<input type="tel" inputmode="numeric" pattern="[0-9]*" maxlength="3" class="live-dorsal-input" id="dorsal-input" placeholder="Nº">' +
          '<div class="live-overlay-actions">' +
            '<button class="btn btn-outline" id="overlay-cancel">Cancelar</button>' +
            '<button class="btn btn-primary" id="overlay-save">Guardar</button>' +
          '</div>' +
          '<button class="live-skip-btn" id="overlay-skip">Sin dorsal</button>' +
        '</div>' +
      '</div>'
    );
  }

  function summaryHtml() {
    const s = score();
    const pendingCount = pendingAdds.length + pendingDeleteIds.length;
    return (
      '<div class="live-summary">' +
        '<div class="live-summary-score">' + s.propio + ' – ' + s.rival + '</div>' +
        (pendingCount
          ? '<div style="color:var(--amber-bright);font-size:13px;font-weight:700;">⚠ Quedan ' + pendingCount + ' eventos por guardar en la hoja — no cierres esta pestaña hasta que se sincronicen.</div>' +
            '<button type="button" class="btn btn-outline retry-sync-btn">Reintentar ahora</button>'
          : '<div style="color:var(--green);font-size:13px;font-weight:700;">✓ Todo guardado correctamente.</div>'
        ) +
        '<div style="color:var(--text-dim);font-size:13px;">Revisa y confirma resultado, convocatoria y eventos en el acta — este registro no se guarda ahí automáticamente.</div>' +
        '<a class="btn btn-primary" href="partidos.html">Ir a Partidos</a>' +
      '</div>'
    );
  }

  function render() {
    if (!match) {
      root.innerHTML = '<div class="live-loading">No se encontró ese partido. <a href="partidos.html">Volver a Partidos</a></div>';
      return;
    }
    const phase = phaseOf(markers());
    root.innerHTML =
      headerHtml() +
      scoreboardHtml() +
      (phase === 'finalizado' ? summaryHtml() : (teamTabsHtml() + eventGridHtml() + feedHtml())) +
      overlayHtml();

    root.querySelectorAll('.retry-sync-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { scheduleSync(0); });
    });

    const phaseBtn = document.getElementById('phase-btn');
    if (phaseBtn) {
      phaseBtn.addEventListener('click', function () {
        if (phase === 'no_iniciado') logMarker('inicio_1');
        else if (phase === 'primera') logMarker('fin_1');
        else if (phase === 'descanso') logMarker('inicio_2');
        else if (phase === 'segunda') {
          if (window.confirm('¿Finalizar el partido? El marcador quedará ' + score().propio + ' – ' + score().rival + '.')) logMarker('fin_2');
        }
      });
    }

    root.querySelectorAll('.live-teamtab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        activeTeam = btn.getAttribute('data-team');
        render();
      });
    });

    root.querySelectorAll('.live-event-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { onEventTap(btn.getAttribute('data-tipo')); });
    });

    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) undoBtn.addEventListener('click', undoLast);

    const backdrop = document.getElementById('live-overlay-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', function (e) { if (e.target === backdrop) closeOverlay(); });
      const cancelBtn = document.getElementById('overlay-cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', closeOverlay);
      const skipBtn = document.getElementById('overlay-skip');
      if (skipBtn) skipBtn.addEventListener('click', function () { commitEvent({}); });
      root.querySelectorAll('.live-player-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { commitEvent({ player_id: btn.getAttribute('data-player') }); });
      });
      const saveBtn = document.getElementById('overlay-save');
      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          const input = document.getElementById('dorsal-input');
          const v = input && input.value.trim();
          commitEvent(v ? { dorsal_rival: Number(v) } : {});
        });
      }
    }

    if (phase === 'primera' || phase === 'segunda') startTick(); else stopTick();
  }

  if (!matchId) {
    root.innerHTML = '<div class="live-loading">Falta el partido. <a href="partidos.html">Volver a Partidos</a></div>';
    return;
  }

  loadPending();

  SM.api.fetchAll().then(function (data) {
    const scoped = SM.team.filterData(data, SM.team.current());
    DATA = scoped;
    match = scoped.matches.find(function (m) { return m.id === matchId; }) || null;
    confirmedEvents = (scoped.matchLiveEvents || []).filter(function (e) { return e.match_id === matchId; });
    if (match) saveCache();
    render();
    startSyncLoop();
  }).catch(function (err) {
    // Sin red al abrir (frecuente en un campo de fútbol) — si ya se había
    // abierto antes esta consola en este móvil, seguimos con esa última
    // copia guardada en vez de bloquear la pantalla con un error.
    const cached = loadCache();
    if (cached && cached.match) {
      match = cached.match;
      DATA = { players: cached.players || [], settings: cached.settings || {}, matches: [cached.match] };
      confirmedEvents = [];
      needsReconcile = true;
      render();
      SM.ui.toast('Sin conexión — usando los datos guardados de este partido. Se sincronizará cuando vuelva la red.', 'error');
      startSyncLoop();
    } else {
      root.innerHTML = '<div class="live-loading">' + err.message + '</div>';
    }
  });
})();
