/* SM Stats — Dashboard */

(function () {
  const shell = document.getElementById('app-shell');
  SM.sidebar.mount(shell, 'inicio');
  const main = document.getElementById('main');
  let DATA = null;

  SM.sidebar.onSettingsClick(function () {
    SM.forms.openSettingsForm(DATA && DATA.settings, function (data) { DATA = data; render(data); });
  });

  const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MONTHS_SHORT = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const DAYS_SHORT = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

  function todayHeader() {
    const d = new Date();
    const w = WEEKDAYS[d.getDay()];
    return w.charAt(0).toUpperCase() + w.slice(1) + ', ' + d.getDate() + ' de ' + MONTHS[d.getMonth()] + ' de ' + d.getFullYear();
  }

  function daysUntil(dateStr) {
    const target = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target - startToday) / 86400000);
  }

  function kpiCard(label, value, delta, color, iconPath) {
    return (
      '<div class="panel kpi-card">' +
        '<div class="panel-glow" style="top:-30px;right:-30px;width:110px;height:110px;background:radial-gradient(circle, ' + SM.ui.alpha(color, 0.16) + ', transparent 70%);"></div>' +
        '<div class="kpi-head">' +
          '<span class="kpi-label">' + label + '</span>' +
          '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + iconPath + '</svg>' +
        '</div>' +
        '<div class="kpi-value">' + value + '</div>' +
        '<div class="kpi-delta" style="color:' + (delta.color || color) + ';">' + delta.text + '</div>' +
      '</div>'
    );
  }

  function render(data) {
    const settings = data.settings || SM.sidebar.DEFAULT_SETTINGS;
    const clubName = settings.club_nombre;
    const coachFirstName = (settings.entrenador_nombre || '').split(/\s+/)[0] || 'Entrenador/a';
    const kpis = SM.stats.teamKpis(data);
    const nextMatch = kpis.nextMatch;
    const upcomingTrainings = SM.stats.upcomingSessions(data, { tipo: 'entrenamiento', n: 3 });
    const topScorers = SM.stats.topScorers(data, 4);
    const results = SM.stats.recentResults(data, 4);
    const trend = SM.stats.weeklyAttendanceTrend(data, 1)[0];
    const birthdays = SM.stats.birthdaysToday(data);

    const daysLabel = nextMatch ? Math.max(0, daysUntil(nextMatch.fecha)) + ' días' : '—';

    main.innerHTML =
      '<div class="page-header">' +
        '<div><div class="page-title">Hola, ' + SM.ui.escapeHtml(coachFirstName) + '</div><div class="page-subtitle">' + todayHeader() + '</div></div>' +
        '<div style="display:flex;align-items:center;gap:14px;">' +
          '<div class="badge" style="background:var(--panel);border:1px solid var(--border-soft);color:var(--text-dim);">Liga Regional · Grupo B</div>' +
        '</div>' +
      '</div>' +

      (birthdays.length ? birthdayCard(birthdays) : '') +

      '<div class="kpi-grid">' +
        kpiCard('Jugadores activos', kpis.activePlayers, { text: 'Plantilla actual' },
          'var(--green)', '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 19.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="8.5" r="2.6"/><path d="M15.8 13.7c2.9.3 5.2 2.5 5.2 5.8"/>') +
        kpiCard('Asistencia media', kpis.avgAttendance != null ? kpis.avgAttendance + '%' : '—', { text: 'Temporada 2026/27' },
          'var(--cyan)', '<rect x="3.5" y="5" width="17" height="16" rx="2.4"/><path d="M3.5 9.5h17"/><path d="M8.5 13.3l2 2 4.2-4.4"/>') +
        kpiCard('Goles totales', kpis.totalGoals, { text: 'Partidos jugados' },
          'var(--magenta)', '<circle cx="12" cy="12" r="9"/><path d="M12 6.6 15.4 9l-1.3 3.9H9.9L8.6 9z"/>') +
        kpiCard('Próximo partido', daysLabel, { text: nextMatch ? SM.ui.formatDateShort(nextMatch.fecha) + ' · ' + nextMatch.hora : 'Sin programar', color: 'var(--text-dim)' },
          'var(--amber)', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.6 2.1"/>') +
      '</div>' +

      '<div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;">' +
        heroMatchCard(nextMatch, clubName) +
        trainingsCard(upcomingTrainings) +
      '</div>' +

      '<div style="display:grid;grid-template-columns:1.4fr 1fr;gap:20px;">' +
        '<div class="panel">' +
          '<span class="panel-title">Top goleadores</span>' +
          '<div style="display:flex;flex-direction:column;gap:14px;margin-top:18px;">' +
            (topScorers.length ? SM.charts.barList(topScorers.map(function (r) { return { label: r.player.nombre, value: r.count }; }), { color: 'var(--green)' })
              : '<div class="empty-state">Todavía no hay goles registrados</div>') +
          '</div>' +
        '</div>' +
        '<div class="panel" style="display:flex;flex-direction:column;">' +
          '<span class="panel-title">Asistencia semanal</span>' +
          '<div style="display:flex;align-items:center;justify-content:center;margin-top:8px;">' +
            SM.charts.ringGauge(trend ? trend.pct : null, { color: 'var(--cyan)', label: 'MEDIA' }) +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="panel">' +
        '<span class="panel-title">Últimos resultados</span>' +
        '<div style="display:grid;grid-template-columns:repeat(4, minmax(0,1fr));gap:16px;margin-top:16px;">' +
          (results.length ? results.map(resultChip).join('') : '<div class="empty-state">Todavía no hay partidos jugados</div>') +
        '</div>' +
      '</div>';
  }

  function birthdayCard(players) {
    const today = new Date();
    return (
      '<div class="panel" style="display:flex;align-items:center;gap:22px;padding:20px 26px;flex-wrap:wrap;border:1px solid oklch(0.72 0.22 335 / 0.35);">' +
        '<div class="panel-glow" style="top:-40px;left:-30px;width:150px;height:150px;background:radial-gradient(circle, ' + SM.ui.alpha('var(--magenta)', 0.18) + ', transparent 70%);"></div>' +
        '<div style="display:flex;align-items:center;gap:12px;flex:none;">' +
          '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--magenta-bright)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M4 21h16"/><path d="M5 21v-6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6"/>' +
            '<path d="M8 13V9"/><path d="M12 13V9"/><path d="M16 13V9"/>' +
            '<circle cx="8" cy="6.3" r="1.3"/><circle cx="12" cy="6.3" r="1.3"/><circle cx="16" cy="6.3" r="1.3"/>' +
          '</svg>' +
          '<span class="panel-title">' + (players.length === 1 ? 'Cumpleaños de hoy' : 'Cumpleaños de hoy (' + players.length + ')') + '</span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:22px;flex-wrap:wrap;">' +
          players.map(function (p) {
            const age = SM.ui.ageFromBirthdate(p.fecha_nacimiento, today);
            return (
              '<div style="display:flex;align-items:center;gap:10px;">' +
                SM.ui.avatarHtml(p.foto_url, 38) +
                '<div style="display:flex;flex-direction:column;">' +
                  '<span style="font-size:13.5px;font-weight:700;color:var(--text);">' + SM.ui.escapeHtml(p.nombre) + '</span>' +
                  '<span style="font-size:12px;color:var(--text-mute);font-weight:600;">' + (age != null ? 'Cumple ' + age + ' años' : 'Cumpleaños') + '</span>' +
                '</div>' +
              '</div>'
            );
          }).join('') +
        '</div>' +
      '</div>'
    );
  }

  function heroMatchCard(match, clubName) {
    if (!match) {
      return (
        '<div class="panel center" style="flex-direction:column;gap:14px;padding:40px;">' +
          '<span class="panel-title">Próximo partido</span>' +
          '<div class="empty-state">No hay ningún partido programado todavía.</div>' +
          '<a class="btn btn-primary" href="partidos.html">+ Nuevo partido</a>' +
        '</div>'
      );
    }
    const days = Math.max(0, daysUntil(match.fecha));
    const rivalInitials = SM.ui.clubInitials(match.rival);
    const local = match.condicion === 'local';
    return (
      '<div class="panel" style="padding:26px 30px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;">' +
          '<span class="panel-title">Próximo partido · Jornada ' + (match.jornada || '—') + '</span>' +
          '<div class="badge" style="background:oklch(0.80 0.15 205 / 0.12);border:1px solid oklch(0.80 0.15 205 / 0.4);color:var(--cyan-bright);font-family:var(--font-display);">' +
            (days === 0 ? 'HOY' : 'FALTAN ' + days + ' DÍA' + (days === 1 ? '' : 'S')) +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:42px;">' +
          '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;width:150px;">' +
            '<div style="width:64px;height:64px;border-radius:50%;background:var(--panel-2);border:1.5px solid oklch(0.80 0.19 150 / 0.5);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:800;font-size:16px;color:var(--green);box-shadow:0 0 20px oklch(0.80 0.19 150 / 0.25);">' + SM.ui.clubInitials(clubName) + '</div>' +
            '<span style="font-size:15px;font-weight:700;color:var(--text);">' + SM.ui.escapeHtml(clubName) + '</span>' +
          '</div>' +
          '<div style="font-family:var(--font-display);font-weight:900;font-size:20px;color:var(--text-ghost);">VS</div>' +
          '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;width:150px;">' +
            '<div style="width:64px;height:64px;border-radius:50%;background:var(--panel-2);border:1.5px solid var(--border-soft);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:800;font-size:16px;color:var(--text-dim);">' + rivalInitials + '</div>' +
            '<span style="font-size:15px;font-weight:700;color:var(--text);">' + SM.ui.escapeHtml(match.rival) + '</span>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:28px;margin-top:24px;">' +
          '<div style="display:flex;align-items:center;gap:7px;font-size:13.5px;color:var(--text-dim);font-weight:600;">' + SM.ui.formatDateShort(match.fecha) + ' · ' + match.hora + '</div>' +
          '<div style="display:flex;align-items:center;gap:7px;font-size:13.5px;color:var(--text-dim);font-weight:600;">' + (local ? 'Local' : 'Visitante') + ' · ' + match.lugar + '</div>' +
        '</div>' +
        '<div style="display:flex;justify-content:center;margin-top:24px;">' +
          '<a class="btn btn-primary" href="partidos.html">Ver en Partidos</a>' +
        '</div>' +
      '</div>'
    );
  }

  function trainingsCard(sessions) {
    return (
      '<div class="panel" style="display:flex;flex-direction:column;gap:16px;">' +
        '<span class="panel-title">Próximos entrenamientos</span>' +
        (sessions.length ? sessions.map(function (s) {
          const d = new Date(s.fecha + 'T00:00:00');
          return (
            '<div style="display:flex;align-items:center;gap:13px;">' +
              '<div style="width:42px;height:42px;border-radius:10px;background:var(--panel-2);border:1px solid var(--border-soft);display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none;">' +
                '<span style="font-size:9.5px;font-weight:700;color:var(--text-mute);letter-spacing:.5px;">' + DAYS_SHORT[d.getDay()] + '</span>' +
                '<span style="font-size:14px;font-weight:800;color:var(--text);">' + d.getDate() + '</span>' +
              '</div>' +
              '<div style="display:flex;flex-direction:column;gap:2px;">' +
                '<span style="font-size:14px;font-weight:700;color:#dfe4ea;">Entrenamiento</span>' +
                '<span style="font-size:12px;color:var(--text-mute);font-weight:500;">' + s.hora + ' · ' + s.lugar + '</span>' +
              '</div>' +
            '</div>'
          );
        }).join('') : '<div class="empty-state">No hay entrenamientos programados</div>') +
        '<a href="asistencia.html">Ver calendario completo →</a>' +
      '</div>'
    );
  }

  function resultChip(match) {
    const win = match.goles_favor > match.goles_contra;
    const draw = match.goles_favor === match.goles_contra;
    const color = win ? 'var(--green)' : draw ? 'var(--text-mute)' : 'var(--red)';
    const scoreColor = win ? 'var(--green)' : draw ? 'var(--text-dim)' : 'var(--red-bright)';
    return (
      '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;background:var(--panel-2);border:1px solid var(--border-soft);">' +
        '<div class="dot" style="background:' + color + ';box-shadow:0 0 7px ' + color + ';"></div>' +
        '<div style="display:flex;flex-direction:column;gap:2px;">' +
          '<span style="font-size:12.5px;font-weight:700;color:#dfe4ea;">' + (match.condicion === 'local' ? 'vs ' : '@ ') + SM.ui.escapeHtml(match.rival) + '</span>' +
          '<span style="font-family:var(--font-display);font-size:14px;font-weight:700;color:' + scoreColor + ';">' + match.goles_favor + ' – ' + match.goles_contra + '</span>' +
        '</div>' +
      '</div>'
    );
  }

  SM.api.fetchAll().then(function (data) {
    DATA = data;
    SM.sidebar.applySettings(data.settings);
    render(data);
  }).catch(function (err) {
    main.innerHTML = '<div class="empty-state">' + err.message + '</div>';
  });
})();
