/* SM Stats — Bienestar (vista del entrenador sobre los check-ins que
   rellenan los propios jugadores tras cada entreno o partido, ver
   encuesta.html). Lista de sesiones con el reparto de caritas de cada una,
   y al elegir una, caritas + comentarios por jugador y el enlace para
   compartir la encuesta de esa sesión. */

(function () {
  const shell = document.getElementById('app-shell');
  SM.sidebar.mount(shell, 'bienestar');
  const main = document.getElementById('main');

  let DATA = null;
  let selectedSessionId = null;

  SM.sidebar.onSettingsClick(function () {
    SM.forms.openSettingsForm(DATA && DATA.settings, function (data) { DATA = SM.team.filterData(data, SM.team.current()); render(); });
  });

  function checkinsForSession(sessionId) {
    return (DATA.checkins || []).filter(function (c) { return c.session_id === sessionId; });
  }

  // El equipo activo ya viene filtrado en DATA (SM.team.filterData), así
  // que la plantilla activa es la misma para todas las sesiones de esta
  // página — no hace falta re-filtrar por la categoría de cada sesión.
  function roster() {
    return (DATA.players || []).filter(function (p) { return p.activo; });
  }

  function sessionLabel(s, matchesById) {
    if (s.tipo === 'partido') {
      const m = matchesById[s.match_id];
      return m ? 'vs ' + m.rival : 'Partido';
    }
    return 'Entrenamiento';
  }

  function surveyUrl(sessionId) {
    return window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'encuesta.html?session=' + sessionId;
  }

  function faceCellHtml(value) {
    const meta = SM.ui.faceMeta(value);
    if (!meta) return '—';
    return '<span style="display:inline-flex;" title="' + meta.label + '">' + SM.ui.faceSvg(meta.key, 26) + '</span>';
  }

  function faceDotsHtml(session) {
    const checkins = checkinsForSession(session.id);
    if (!checkins.length) return '<span style="font-size:11px;color:var(--text-ghost);">Sin respuestas</span>';
    return (
      '<div style="display:flex;gap:3px;">' +
        checkins.map(function (c) {
          const meta = SM.ui.faceMeta(c.satisfaccion);
          return '<span style="width:8px;height:8px;border-radius:50%;background:' + (meta ? meta.color : 'var(--text-ghost)') + ';"></span>';
        }).join('') +
      '</div>'
    );
  }

  function render() {
    const matchesById = SM.stats.byId(DATA.matches);
    const sessions = DATA.sessions.slice().sort(function (a, b) { return b.fecha.localeCompare(a.fecha) || (b.hora || '').localeCompare(a.hora || ''); });
    if (!selectedSessionId && sessions.length) selectedSessionId = sessions[0].id;
    const session = sessions.find(function (s) { return s.id === selectedSessionId; }) || null;

    main.innerHTML =
      '<div class="page-header">' +
        '<div><div class="page-title">Bienestar</div><div class="page-subtitle">Satisfacción y rendimiento percibido, en palabras de cada jugador tras entrenar o jugar</div></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:340px 1fr;gap:20px;align-items:start;">' +
        '<div class="panel" style="padding:14px;display:flex;flex-direction:column;gap:6px;max-height:640px;overflow-y:auto;">' +
          (sessions.length ? sessions.map(function (s) { return sessionRow(s, matchesById); }).join('') : '<div class="empty-state">Todavía no hay sesiones.</div>') +
        '</div>' +
        '<div id="wellbeing-panel"></div>' +
      '</div>';

    main.querySelectorAll('[data-pick-session]').forEach(function (el) {
      el.addEventListener('click', function () {
        selectedSessionId = el.getAttribute('data-pick-session');
        render();
      });
    });

    document.getElementById('wellbeing-panel').innerHTML = session ? sessionPanelHtml(session, matchesById) : '<div class="panel"><div class="empty-state">Selecciona una sesión.</div></div>';

    const copyBtn = document.getElementById('copy-link-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        const input = document.getElementById('survey-link-input');
        const url = input.value;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            SM.ui.toast('Enlace copiado.', 'ok');
          }).catch(function () {
            input.select();
            SM.ui.toast('No se pudo copiar — selecciona y copia el enlace a mano.', 'error');
          });
        } else {
          input.select();
          SM.ui.toast('Selecciona y copia el enlace a mano.', 'ok');
        }
      });
    }
  }

  function sessionRow(s, matchesById) {
    const active = s.id === selectedSessionId;
    const checkins = checkinsForSession(s.id);
    const total = roster().length;
    return (
      '<div data-pick-session="' + s.id + '" style="cursor:pointer;padding:12px 14px;border-radius:10px;display:flex;flex-direction:column;gap:6px;' +
        (active ? 'background:' + SM.ui.alpha('var(--cyan)', 0.12) + ';border:1px solid ' + SM.ui.alpha('var(--cyan)', 0.4) + ';' : 'border:1px solid transparent;') + '">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;">' +
          '<span style="font-size:13px;font-weight:700;color:var(--text);">' + SM.ui.escapeHtml(sessionLabel(s, matchesById)) + '</span>' +
          '<span style="font-size:11px;font-weight:700;color:' + (checkins.length ? 'var(--green)' : 'var(--text-ghost)') + ';">' + checkins.length + '/' + total + '</span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;">' +
          '<span style="font-size:11.5px;color:var(--text-mute);font-weight:600;">' + SM.ui.formatDateShort(s.fecha) + (s.hora ? ' · ' + s.hora : '') + '</span>' +
          faceDotsHtml(s) +
        '</div>' +
      '</div>'
    );
  }

  function sessionPanelHtml(session, matchesById) {
    const checkinsByPlayer = {};
    checkinsForSession(session.id).forEach(function (c) { checkinsByPlayer[c.player_id] = c; });
    const rows = roster().slice().sort(function (a, b) { return (a.dorsal || 99) - (b.dorsal || 99); });

    return (
      '<div style="display:flex;flex-direction:column;gap:16px;">' +
        '<div class="panel" style="display:flex;flex-direction:column;gap:10px;">' +
          '<span class="panel-title">' + SM.ui.escapeHtml(sessionLabel(session, matchesById)) + ' · ' + SM.ui.formatDateLong(session.fecha) + '</span>' +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '<input id="survey-link-input" readonly value="' + surveyUrl(session.id) + '" style="flex:1 1 260px;padding:8px 10px;border-radius:8px;background:var(--panel-2);border:1px solid var(--border-soft);color:var(--text-dim);font-size:12px;">' +
            '<button class="btn btn-primary" id="copy-link-btn" style="flex:none;">Copiar enlace de encuesta</button>' +
          '</div>' +
          '<div class="form-hint">Comparte este enlace con las familias tras el entreno o partido — cada jugador elige su nombre y responde desde su móvil, sin cuenta ni contraseña.</div>' +
        '</div>' +
        '<div class="panel">' +
          '<span class="panel-title">Respuestas</span>' +
          (rows.length ? (
            '<div style="overflow-x:auto;margin-top:10px;">' +
              '<table class="data-table" style="min-width:720px;">' +
                '<thead><tr><th style="text-align:left;">Jugador</th><th>Satisfacción</th><th style="text-align:left;">Comentario</th><th>Rendimiento</th><th style="text-align:left;">Comentario</th></tr></thead>' +
                '<tbody>' +
                  rows.map(function (p) {
                    const c = checkinsByPlayer[p.id];
                    return (
                      '<tr>' +
                        '<td style="text-align:left;">' + SM.ui.escapeHtml(p.nombre) + '</td>' +
                        '<td>' + (c ? faceCellHtml(c.satisfaccion) : '—') + '</td>' +
                        '<td style="text-align:left;color:var(--text-dim);font-size:12.5px;">' + (c && c.comentario_satisfaccion ? SM.ui.escapeHtml(c.comentario_satisfaccion) : '—') + '</td>' +
                        '<td>' + (c ? faceCellHtml(c.rendimiento) : '—') + '</td>' +
                        '<td style="text-align:left;color:var(--text-dim);font-size:12.5px;">' + (c && c.comentario_rendimiento ? SM.ui.escapeHtml(c.comentario_rendimiento) : '—') + '</td>' +
                      '</tr>'
                    );
                  }).join('') +
                '</tbody>' +
              '</table>' +
            '</div>'
          ) : '<div class="empty-state">No hay jugadores en la plantilla de esta categoría.</div>') +
        '</div>' +
      '</div>'
    );
  }

  SM.api.fetchAll().then(function (data) {
    DATA = SM.team.filterData(data, SM.team.current());
    SM.sidebar.applySettings(DATA.settings);
    render();
  }).catch(function (err) {
    main.innerHTML = '<div class="empty-state">' + err.message + '</div>';
  });
})();
