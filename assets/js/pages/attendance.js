/* SM Stats — Asistencia */

(function () {
  const shell = document.getElementById('app-shell');
  SM.sidebar.mount(shell, 'asistencia');
  const main = document.getElementById('main');

  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const DAYS_SHORT = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  const STATES = [
    { key: 'presente', label: 'Presente', color: 'var(--green)' },
    { key: 'ausente', label: 'Ausente', color: 'var(--red)' },
    { key: 'justificado', label: 'Justificado', color: 'var(--amber)' }
  ];

  let DATA = null;
  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();

  function render() {
    const sessions = SM.stats.sessionsForMonth(DATA, viewYear, viewMonth);
    const players = DATA.players.filter(function (p) { return p.activo; }).sort(function (a, b) { return (a.dorsal || 99) - (b.dorsal || 99); });
    const monthAvg = avgForSessions(players, sessions);
    const trend = SM.stats.weeklyAttendanceTrend(DATA, 4);

    main.innerHTML =
      '<div class="page-header">' +
        '<div><div class="page-title">Asistencia</div><div class="page-subtitle">Control de presencia en entrenamientos y partidos</div></div>' +
        '<div style="display:flex;align-items:center;gap:14px;">' +
          '<div class="badge" style="background:' + SM.ui.alpha('var(--cyan)', 0.12) + ';border:1px solid ' + SM.ui.alpha('var(--cyan)', 0.5) + ';color:var(--cyan-bright);">Media del mes: ' + (monthAvg != null ? monthAvg + '%' : '—') + '</div>' +
          '<div style="display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:10px;background:var(--panel);border:1px solid var(--border-soft);">' +
            '<button id="prev-month" style="background:none;border:none;color:#8a93a3;cursor:pointer;display:flex;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>' +
            '<span style="font-size:13.5px;font-weight:700;color:var(--text);width:120px;text-align:center;">' + MONTHS[viewMonth] + ' ' + viewYear + '</span>' +
            '<button id="next-month" style="background:none;border:none;color:#8a93a3;cursor:pointer;display:flex;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>' +
          '</div>' +
          '<button id="new-session" class="btn btn-outline">+ Nueva sesión</button>' +
          '<button id="take-attendance" class="btn btn-primary">+ Tomar asistencia</button>' +
        '</div>' +
      '</div>' +

      '<div style="display:flex;align-items:center;gap:22px;flex-wrap:wrap;">' +
        STATES.map(function (s) {
          return '<div style="display:flex;align-items:center;gap:8px;"><div style="width:12px;height:12px;border-radius:4px;background:' + SM.ui.alpha(s.color, 0.2) + ';border:1px solid ' + s.color + ';"></div><span style="font-size:12.5px;color:var(--text-dim);font-weight:600;">' + s.label + '</span></div>';
        }).join('') +
        '<div style="width:1px;height:16px;background:var(--border-soft);"></div>' +
        '<div style="display:flex;align-items:center;gap:8px;"><div class="dot" style="background:var(--cyan);"></div><span style="font-size:12.5px;color:var(--text-dim);font-weight:600;">Entrenamiento</span></div>' +
        '<div style="display:flex;align-items:center;gap:8px;"><div class="dot" style="background:var(--magenta);"></div><span style="font-size:12.5px;color:var(--text-dim);font-weight:600;">Partido</span></div>' +
      '</div>' +

      '<div class="panel" style="overflow-x:auto;">' + tableHtml(players, sessions) + '</div>' +

      '<div class="panel">' +
        '<span class="panel-title">Tendencia semanal de asistencia</span>' +
        '<div style="display:flex;align-items:flex-end;gap:28px;margin-top:18px;height:90px;padding:0 10px;">' +
          (trend.length ? trend.map(function (t, i) {
            const h = t.pct != null ? Math.max(6, Math.round(t.pct * 0.9)) : 6;
            const bright = i === trend.length - 1;
            const weekNum = t.week.split('-W')[1];
            const weekLabel = weekNum ? 'Sem ' + weekNum : t.week;
            return (
              '<div style="display:flex;flex-direction:column;align-items:center;gap:8px;height:100%;justify-content:flex-end;">' +
                '<span style="font-size:11.5px;font-weight:700;color:' + (bright ? 'var(--text-strong)' : 'var(--text-dim)') + ';">' + (t.pct != null ? t.pct + '%' : '—') + '</span>' +
                '<div style="width:34px;height:' + h + 'px;border-radius:8px 8px 0 0;background:' + SM.ui.alpha('var(--cyan)', bright ? 1 : 0.6) + ';' + (bright ? 'box-shadow:0 0 12px ' + SM.ui.alpha('var(--cyan)', 0.6) + ';' : '') + '"></div>' +
                '<span style="font-size:11px;color:var(--text-mute);font-weight:600;">' + weekLabel + '</span>' +
              '</div>'
            );
          }).join('') : '<div class="empty-state">Sin sesiones registradas todavía</div>') +
        '</div>' +
      '</div>';

    document.getElementById('prev-month').addEventListener('click', function () { shiftMonth(-1); });
    document.getElementById('next-month').addEventListener('click', function () { shiftMonth(1); });
    document.getElementById('take-attendance').addEventListener('click', function () { openAttendanceModal(null); });
    document.getElementById('new-session').addEventListener('click', openNewSessionForm);
    main.querySelectorAll('[data-session]').forEach(function (th) {
      th.addEventListener('click', function () { openAttendanceModal(th.getAttribute('data-session')); });
    });
  }

  function shiftMonth(delta) {
    viewMonth += delta;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    render();
  }

  function avgForSessions(players, sessions) {
    const pcts = players.map(function (p) { return SM.stats.attendancePct(DATA, p.id, sessions); }).filter(function (v) { return v !== null; });
    if (!pcts.length) return null;
    return Math.round(pcts.reduce(function (a, b) { return a + b; }, 0) / pcts.length);
  }

  function statusIcon(estado) {
    if (estado === 'presente') {
      return '<div style="width:24px;height:24px;border-radius:7px;display:flex;align-items:center;justify-content:center;background:' + SM.ui.alpha('var(--green)', 0.12) + ';border:1px solid ' + SM.ui.alpha('var(--green)', 0.45) + ';box-shadow:0 0 8px ' + SM.ui.alpha('var(--green)', 0.25) + ';">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="oklch(0.85 0.16 150)" stroke-width="3" stroke-linecap="round"><path d="m5 13 5 5L20 7"/></svg></div>';
    }
    if (estado === 'ausente') {
      return '<div style="width:24px;height:24px;border-radius:7px;display:flex;align-items:center;justify-content:center;background:' + SM.ui.alpha('var(--red)', 0.1) + ';border:1px solid ' + SM.ui.alpha('var(--red)', 0.4) + ';">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="oklch(0.72 0.16 25)" stroke-width="2.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></div>';
    }
    if (estado === 'justificado') {
      return '<div style="width:24px;height:24px;border-radius:7px;display:flex;align-items:center;justify-content:center;background:' + SM.ui.alpha('var(--amber)', 0.12) + ';border:1px solid ' + SM.ui.alpha('var(--amber)', 0.4) + ';font-size:11px;font-weight:800;color:oklch(0.85 0.14 80);">J</div>';
    }
    return '<div style="width:24px;height:24px;border-radius:7px;display:flex;align-items:center;justify-content:center;color:var(--text-ghost);font-size:12px;">·</div>';
  }

  function tableHtml(players, sessions) {
    if (!sessions.length) return '<div class="empty-state">No hay sesiones registradas este mes.</div>';
    const cols = 'grid-template-columns:210px repeat(' + sessions.length + ', 64px) 100px;';
    const header = '<div style="display:grid;' + cols + 'align-items:center;padding-bottom:12px;border-bottom:1px solid var(--border);">' +
      '<span style="font-size:11px;font-weight:700;color:var(--text-mute);letter-spacing:.5px;">JUGADOR</span>' +
      sessions.map(function (s) {
        const d = new Date(s.fecha + 'T00:00:00');
        const color = s.tipo === 'partido' ? 'var(--magenta)' : 'var(--cyan)';
        return '<div data-session="' + s.id + '" style="display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;" title="Tomar asistencia">' +
          '<div style="width:6px;height:6px;border-radius:50%;background:' + color + ';"></div>' +
          '<span style="font-size:11px;font-weight:700;color:var(--text-mute);">' + d.getDate() + '</span></div>';
      }).join('') +
      '<span style="font-size:11px;font-weight:700;color:var(--text-mute);letter-spacing:.5px;text-align:right;">% MES</span>' +
    '</div>';

    const rows = players.map(function (p) {
      const pct = SM.stats.attendancePct(DATA, p.id, sessions);
      const cells = sessions.map(function (s) {
        const row = DATA.attendance.find(function (a) { return a.session_id === s.id && a.player_id === p.id; });
        return '<div style="display:flex;justify-content:center;">' + statusIcon(row ? row.estado : null) + '</div>';
      }).join('');
      return '<div style="display:grid;' + cols + 'align-items:center;padding:9px 0;border-bottom:1px solid var(--row-border);">' +
        '<div style="display:flex;align-items:center;gap:10px;">' + SM.ui.avatarHtml(p.foto_url, 28) + '<span style="font-size:13.5px;font-weight:600;color:var(--text);">' + SM.ui.escapeHtml(p.nombre) + '</span></div>' +
        cells +
        '<div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;">' +
          '<div class="bar-track thin" style="width:44px;"><div class="bar-fill" style="width:' + (pct || 0) + '%;background:' + (pct == null ? 'var(--text-ghost)' : pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--amber)' : 'var(--red)') + ';"></div></div>' +
          '<span style="font-size:12px;font-weight:700;color:var(--text);width:30px;text-align:right;">' + (pct != null ? pct + '%' : '—') + '</span>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<div style="padding:20px 22px;min-width:' + (210 + sessions.length * 64 + 100) + 'px;">' + header + rows + '</div>';
  }

  function openNewSessionForm() {
    const defaultDate = new Date(viewYear, viewMonth, Math.min(now.getDate() + 7, 28)).toISOString().slice(0, 10);
    const body = SM.ui.el('div', {
      html:
        '<form id="session-form"><div class="form-grid">' +
          '<div class="form-field span-2"><label>Fecha</label><input name="fecha" type="date" required value="' + defaultDate + '"></div>' +
          '<div class="form-field"><label>Hora</label><input name="hora" type="time" value="18:30"></div>' +
          '<div class="form-field"><label>Lugar</label><input name="lugar" value="Campo Municipal La Ribera"></div>' +
        '</div><div class="form-actions">' +
          '<button type="button" class="btn btn-outline" id="cancel-btn">Cancelar</button>' +
          '<button type="submit" class="btn btn-primary">Crear sesión</button>' +
        '</div></form>'
    });
    const handle = SM.ui.openModal('Nuevo entrenamiento', body);
    body.querySelector('#cancel-btn').addEventListener('click', handle.close);
    body.querySelector('#session-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const payload = {};
      new FormData(e.target).forEach(function (v, k) { payload[k] = v; });
      SM.api.postAction('addSession', payload).then(function () {
        handle.close();
        return SM.api.fetchAll(true);
      }).then(function (data) {
        DATA = data;
        viewYear = new Date(payload.fecha + 'T00:00:00').getFullYear();
        viewMonth = new Date(payload.fecha + 'T00:00:00').getMonth();
        render();
        SM.ui.toast('Sesión creada.', 'ok');
      }).catch(function (err) { SM.ui.toast(err.message, 'error'); });
    });
  }

  function openAttendanceModal(preselectSessionId) {
    const allSessions = DATA.sessions.slice().sort(function (a, b) { return b.fecha.localeCompare(a.fecha); });
    if (!allSessions.length) { SM.ui.toast('Todavía no hay sesiones creadas.', 'error'); return; }
    const initialId = preselectSessionId || allSessions[0].id;

    const body = SM.ui.el('div', {
      html:
        '<div class="form-field span-2" style="margin-bottom:18px;"><label>Sesión</label>' +
          '<select id="session-select">' + allSessions.map(function (s) {
            const label = SM.ui.formatDateLong(s.fecha) + ' · ' + (s.tipo === 'partido' ? 'Partido' : 'Entrenamiento') + (s.hora ? ' · ' + s.hora : '');
            return '<option value="' + s.id + '"' + (s.id === initialId ? ' selected' : '') + '>' + label + '</option>';
          }).join('') + '</select></div>' +
        '<div id="player-toggle-list" style="display:flex;flex-direction:column;gap:10px;max-height:420px;overflow-y:auto;"></div>' +
        '<div class="form-actions"><button type="button" class="btn btn-outline" id="cancel-btn">Cancelar</button><button type="button" class="btn btn-primary" id="save-btn">Guardar asistencia</button></div>'
    });
    const handle = SM.ui.openModal('Tomar asistencia', body);
    body.querySelector('#cancel-btn').addEventListener('click', handle.close);

    const state = {};
    function loadSession(sessionId) {
      const players = DATA.players.filter(function (p) { return p.activo; }).sort(function (a, b) { return (a.dorsal || 99) - (b.dorsal || 99); });
      players.forEach(function (p) {
        const row = DATA.attendance.find(function (a) { return a.session_id === sessionId && a.player_id === p.id; });
        state[p.id] = row ? row.estado : 'presente';
      });
      renderToggleList(players);
    }

    function renderToggleList(players) {
      const list = body.querySelector('#player-toggle-list');
      list.innerHTML = players.map(function (p) {
        return (
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">' +
            '<div style="display:flex;align-items:center;gap:10px;">' + SM.ui.avatarHtml(p.foto_url, 30) + '<span style="font-size:13.5px;font-weight:600;color:var(--text);">' + SM.ui.escapeHtml(p.nombre) + '</span></div>' +
            '<div style="display:flex;gap:6px;" data-player="' + p.id + '">' +
              STATES.map(function (s) {
                return '<button type="button" class="pill toggle-state" data-state="' + s.key + '" style="padding:6px 12px;font-size:12px;' + (state[p.id] === s.key ? 'background:' + SM.ui.alpha(s.color, 0.18) + ';color:' + s.color + ';font-weight:700;' : '') + '">' + s.label + '</button>';
              }).join('') +
            '</div>' +
          '</div>'
        );
      }).join('');
      list.querySelectorAll('.toggle-state').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const playerId = btn.parentElement.getAttribute('data-player');
          state[playerId] = btn.getAttribute('data-state');
          renderToggleList(players);
        });
      });
    }

    body.querySelector('#session-select').addEventListener('change', function (e) { loadSession(e.target.value); });
    loadSession(initialId);

    body.querySelector('#save-btn').addEventListener('click', function () {
      const sessionId = body.querySelector('#session-select').value;
      const rows = Object.keys(state).map(function (playerId) { return { player_id: playerId, estado: state[playerId] }; });
      SM.api.postAction('saveAttendance', { sessionId: sessionId, rows: rows }).then(function () {
        handle.close();
        return SM.api.fetchAll(true);
      }).then(function (data) {
        DATA = data;
        render();
        SM.ui.toast('Asistencia guardada.', 'ok');
      }).catch(function (err) { SM.ui.toast(err.message, 'error'); });
    });
  }

  SM.api.fetchAll().then(function (data) {
    DATA = data;
    render();
  }).catch(function (err) {
    main.innerHTML = '<div class="empty-state">' + err.message + '</div>';
  });
})();
