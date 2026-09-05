/* SM Stats — Calendario (entrenamientos y partidos del mes) */

(function () {
  const shell = document.getElementById('app-shell');
  SM.sidebar.mount(shell, 'calendario');
  const main = document.getElementById('main');

  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const WEEKDAY_LABELS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

  let DATA = null;
  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();

  SM.sidebar.onSettingsClick(function () {
    SM.forms.openSettingsForm(DATA && DATA.settings, function (data) { DATA = data; });
  });

  function render() {
    const sessions = SM.stats.sessionsForMonth(DATA, viewYear, viewMonth);
    const matchesById = SM.stats.byId(DATA.matches);
    const byDate = {};
    sessions.forEach(function (s) { (byDate[s.fecha] = byDate[s.fecha] || []).push(s); });
    Object.keys(byDate).forEach(function (k) {
      byDate[k].sort(function (a, b) { return (a.hora || '').localeCompare(b.hora || ''); });
    });

    main.innerHTML =
      '<div class="page-header">' +
        '<div><div class="page-title">Calendario</div><div class="page-subtitle">Entrenamientos y partidos del mes</div></div>' +
        '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">' +
          '<div style="display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:10px;background:var(--panel);border:1px solid var(--border-soft);">' +
            '<button id="prev-month" style="background:none;border:none;color:#8a93a3;cursor:pointer;display:flex;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>' +
            '<span style="font-size:13.5px;font-weight:700;color:var(--text);width:120px;text-align:center;">' + MONTHS[viewMonth] + ' ' + viewYear + '</span>' +
            '<button id="next-month" style="background:none;border:none;color:#8a93a3;cursor:pointer;display:flex;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>' +
          '</div>' +
          '<a href="asistencia.html" class="btn btn-outline">Ver asistencia</a>' +
          '<button id="new-session" class="btn btn-outline">+ Nuevas sesiones</button>' +
          '<a href="partidos.html" class="btn btn-primary">+ Nuevo partido</a>' +
        '</div>' +
      '</div>' +

      '<div style="display:flex;align-items:center;gap:22px;">' +
        '<div style="display:flex;align-items:center;gap:8px;"><div class="dot" style="background:var(--cyan);"></div><span style="font-size:12.5px;color:var(--text-dim);font-weight:600;">Entrenamiento — clic para tomar asistencia</span></div>' +
        '<div style="display:flex;align-items:center;gap:8px;"><div class="dot" style="background:var(--magenta);"></div><span style="font-size:12.5px;color:var(--text-dim);font-weight:600;">Partido — clic para ir a Partidos</span></div>' +
      '</div>' +

      '<div class="panel" style="padding:18px;">' + gridHtml(byDate, matchesById) + '</div>';

    document.getElementById('prev-month').addEventListener('click', function () { shiftMonth(-1); });
    document.getElementById('next-month').addEventListener('click', function () { shiftMonth(1); });
    document.getElementById('new-session').addEventListener('click', function () {
      SM.forms.openRecurringSessionForm(function (data) { DATA = data; render(); });
    });
    main.querySelectorAll('[data-open-session]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        SM.forms.openAttendanceModal(DATA, chip.getAttribute('data-open-session'), function (data) { DATA = data; render(); });
      });
    });
  }

  function shiftMonth(delta) {
    viewMonth += delta;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    render();
  }

  function sessionChip(s, matchesById) {
    const isMatch = s.tipo === 'partido';
    const color = isMatch ? 'var(--magenta)' : 'var(--cyan)';
    const match = isMatch ? matchesById[s.match_id] : null;
    const label = isMatch ? (match ? 'vs ' + SM.ui.escapeHtml(match.rival) : 'Partido') : 'Entreno';
    const inner =
      '<div style="padding:4px 6px;border-radius:6px;background:' + SM.ui.alpha(color, 0.14) + ';border:1px solid ' + SM.ui.alpha(color, 0.4) + ';cursor:pointer;overflow:hidden;">' +
        '<span style="font-size:10.5px;font-weight:700;color:' + color + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;">' + (s.hora ? s.hora + ' · ' : '') + label + '</span>' +
      '</div>';
    if (isMatch) return '<a href="partidos.html" style="text-decoration:none;display:block;">' + inner + '</a>';
    return '<div data-open-session="' + s.id + '">' + inner + '</div>';
  }

  function gridHtml(byDate, matchesById) {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const leading = (firstOfMonth.getDay() + 6) % 7; // week starts Monday
    const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7;
    const todayStr = new Date().toISOString().slice(0, 10);

    let cells = '';
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - leading + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        cells += '<div style="min-height:96px;background:var(--panel-2);border-radius:10px;opacity:.35;"></div>';
        continue;
      }
      const dateStr = viewYear + '-' + String(viewMonth + 1).padStart(2, '0') + '-' + String(dayNum).padStart(2, '0');
      const daySessions = byDate[dateStr] || [];
      const isToday = dateStr === todayStr;
      cells +=
        '<div style="min-height:96px;background:var(--panel-2);border-radius:10px;border:1px solid ' + (isToday ? 'var(--cyan)' : 'var(--border-soft)') + ';padding:8px;display:flex;flex-direction:column;gap:5px;">' +
          '<span style="font-size:11.5px;font-weight:700;color:' + (isToday ? 'var(--cyan-bright)' : 'var(--text-mute)') + ';">' + dayNum + '</span>' +
          '<div style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;">' +
            daySessions.map(function (s) { return sessionChip(s, matchesById); }).join('') +
          '</div>' +
        '</div>';
    }

    return (
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:8px;">' +
        WEEKDAY_LABELS.map(function (l) { return '<span style="font-size:10.5px;font-weight:700;color:var(--text-ghost);letter-spacing:.5px;text-align:center;">' + l + '</span>'; }).join('') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;">' + cells + '</div>'
    );
  }

  SM.api.fetchAll().then(function (data) {
    DATA = data;
    SM.sidebar.applySettings(data.settings);
    render();
  }).catch(function (err) {
    main.innerHTML = '<div class="empty-state">' + err.message + '</div>';
  });
})();
