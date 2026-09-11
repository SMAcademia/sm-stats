/* SM Stats — Portal privado de familia/jugador (mi-jugador.html?id=...).
   Vista reducida de la ficha de jugador (assets/js/pages/player.js), sin
   sidebar y sin nada de gestión: sin Editar/Eliminar, sin botones de
   navegación entre jugadores, y sobre todo SIN la nota de evaluación de
   partidos (columna NOTA y gráfico "Evolución del rendimiento") — esa
   valoración se queda a nivel interno del cuerpo técnico para no generar
   conflictos con las familias. Añade lo que sí les interesa: si su
   jugador está convocado al próximo partido y la agenda de próximas
   sesiones. Acceso protegido por SM.auth (ver assets/js/auth.js): si no
   hay sesión guardada para este jugador, se manda a acceso.html. */

(function () {
  const main = document.getElementById('main');
  const id = SM.ui.qs('id');

  const session = SM.auth.readFamilySession();
  if (!id || !session || session.type !== 'player' || session.id !== id) {
    window.location.href = 'acceso.html';
    return;
  }

  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function monthYear(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }
  function shortDay(iso) {
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.getDate() + '/' + (d.getMonth() + 1);
  }

  let DATA = null;

  function headerHtml(clubName, p) {
    return (
      '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">' +
        '<div>' +
          '<div style="font-size:13.5px;color:var(--text-mute);font-weight:600;">' + SM.ui.escapeHtml(clubName) + '</div>' +
          '<div style="font-size:22px;font-weight:700;color:var(--text-strong);">' + SM.ui.escapeHtml(p.nombre) + '</div>' +
        '</div>' +
        '<button type="button" id="logout-btn" class="btn btn-outline" style="padding:9px 16px;font-size:12.5px;">Salir</button>' +
      '</div>'
    );
  }

  function dataRow(label, value) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12.5px;color:var(--text-faint);font-weight:600;">' + label + '</span><span style="font-size:13.5px;color:var(--text);font-weight:700;text-align:right;">' + value + '</span></div>';
  }

  // Etiqueta(s) del punto que más destaca, sin cifra — si hay empate entre
  // varias, se muestran todas. Sin datos todavía -> estado vacío neutro.
  function highlightBadgesHtml(labels, color) {
    if (!labels.length) return '<div class="empty-state">Sin valorar todavía.</div>';
    return (
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;">' +
        labels.map(function (label) {
          return '<span class="badge" style="background:' + SM.ui.alpha(color, 0.14) + ';border:1px solid ' + SM.ui.alpha(color, 0.5) + ';color:' + color + ';">' + SM.ui.escapeHtml(label) + '</span>';
        }).join('') +
      '</div>'
    );
  }

  function miniKpi(value, label, color) {
    return '<div class="panel" style="padding:14px;display:flex;flex-direction:column;align-items:center;gap:4px;"><span style="font-family:var(--font-display);font-weight:800;font-size:22px;color:' + color + ';">' + value + '</span><span style="font-size:10px;color:var(--text-mute);font-weight:600;letter-spacing:.3px;">' + label + '</span></div>';
  }

  // Sin rating ni cualquier otra cifra numérica aquí — es la ficha que ve
  // la familia, y un número (aunque sea uno solo) vuelve a ser algo
  // comparable entre compañeros, justo lo que se quiere evitar.
  function leftCardHtml(p, meta, age) {
    return (
      '<div class="panel" style="padding:28px 24px;display:flex;flex-direction:column;align-items:center;align-self:start;">' +
        '<div class="badge" style="background:' + SM.ui.alpha(meta.color, 0.14) + ';border:1px solid ' + SM.ui.alpha(meta.color, 0.5) + ';color:' + meta.bright + ';margin-bottom:18px;">' + meta.label.toUpperCase() + '</div>' +
        SM.ui.avatarHtml(p.foto_url, 116) +
        '<div style="font-size:22px;font-weight:700;color:var(--text-strong);margin-top:16px;">' + SM.ui.escapeHtml(p.nombre) + '</div>' +
        '<div style="font-family:var(--font-display);font-weight:800;font-size:15px;color:var(--text-dim);margin-top:6px;">#' + p.dorsal + '</div>' +
        '<div style="width:100%;height:1px;background:var(--border);margin:22px 0;"></div>' +
        '<span style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--text-ghost);align-self:flex-start;margin-bottom:10px;">POSICIONES</span>' +
        SM.pitch.render({ primary: p.posicion, secondary: (p.posicion_secundaria || '').split(',').map(function (s) { return s.trim(); }).filter(function (g) { return g && g !== p.posicion; }) }, { interactive: false, width: 130 }) +
        '<div style="width:100%;height:1px;background:var(--border);margin:22px 0;"></div>' +
        '<div style="display:flex;flex-direction:column;gap:13px;width:100%;">' +
          '<span style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--text-ghost);">DATOS PERSONALES</span>' +
          dataRow('Fecha de nacimiento', SM.ui.formatDateLong(p.fecha_nacimiento)) +
          dataRow('Edad', age != null ? age + ' años' : '—') +
          dataRow('Nacionalidad', SM.ui.escapeHtml(p.nacionalidad) || '—') +
          dataRow('Altura / Peso', (p.altura_cm || '—') + ' cm · ' + (p.peso_kg || '—') + ' kg') +
        '</div>' +
        '<div style="width:100%;height:1px;background:var(--border);margin:20px 0;"></div>' +
        '<div style="display:flex;flex-direction:column;gap:13px;width:100%;">' +
          '<span style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--text-ghost);">DATOS DEPORTIVOS</span>' +
          dataRow('Posición principal', meta.label) +
          dataRow('Pie dominante', p.pie || '—') +
          dataRow('Dorsal', '#' + p.dorsal) +
          dataRow('Categoría', p.categoria || '—') +
          dataRow('En el club desde', monthYear(p.fecha_alta)) +
        '</div>' +
      '</div>'
    );
  }

  function nextMatchHtml(scoped, p) {
    const match = SM.stats.nextMatch(scoped);
    if (!match) return '<div class="empty-state">No hay ningún partido programado todavía.</div>';
    const convocado = (scoped.matchAppearances || []).find(function (a) { return a.match_id === match.id && a.player_id === p.id; });
    const clubName = (scoped.settings && scoped.settings.club_nombre) || 'Mi club';
    const rival = match.condicion === 'local' ? SM.ui.escapeHtml(clubName) + ' vs ' + SM.ui.escapeHtml(match.rival) : SM.ui.escapeHtml(match.rival) + ' vs ' + SM.ui.escapeHtml(clubName);
    // Solo se muestra una etiqueta cuando hay algo positivo que anunciar
    // (que está convocado); si la convocatoria aún no está decidida, un
    // texto neutro en vez de una etiqueta con aspecto de "no elegido".
    let statusHtml;
    if (convocado) {
      statusHtml = '<div class="badge" style="background:' + SM.ui.alpha('var(--green)', 0.14) + ';border:1px solid ' + SM.ui.alpha('var(--green)', 0.5) + ';color:var(--green);">CONVOCADO' + (convocado.capitan ? ' · CAPITÁN' : '') + '</div>';
    } else {
      statusHtml = '<div style="font-size:12.5px;color:var(--text-mute);font-weight:600;">La convocatoria se confirmará antes del partido.</div>';
    }
    return (
      '<div style="display:flex;flex-direction:column;gap:10px;">' +
        '<div style="font-size:15.5px;font-weight:700;color:var(--text-strong);">' + rival + '</div>' +
        '<div style="font-size:13px;color:var(--text-faint);font-weight:600;">' + SM.ui.formatDateLong(match.fecha) + (match.hora ? ' · ' + match.hora : '') + (match.lugar ? ' · ' + SM.ui.escapeHtml(match.lugar) : '') + '</div>' +
        statusHtml +
      '</div>'
    );
  }

  // Sesión de hoy (si la hay) para poder enlazar directo a la encuesta de
  // bienestar (encuesta.html) sin tener que esperar a que el entrenador
  // comparta el enlace por su cuenta cada vez.
  function todaySessionHtml(scoped, p) {
    const today = SM.ui.formatDateIso(new Date());
    const todaySession = (scoped.sessions || []).find(function (s) { return s.fecha === today; });
    if (!todaySession) return '';
    const already = (scoped.checkins || []).some(function (c) { return c.session_id === todaySession.id && c.player_id === p.id; });
    const link = 'encuesta.html?session=' + todaySession.id + '&player=' + p.id;
    return (
      '<div class="panel">' +
        '<span class="panel-title">Bienestar de hoy</span>' +
        (already
          ? '<div style="margin-top:10px;font-size:13px;color:var(--text-dim);font-weight:600;">Ya has respondido hoy — ¡gracias!</div>'
          : (
            '<div style="margin-top:10px;font-size:13px;color:var(--text-faint);font-weight:600;">¿Qué tal ha ido hoy? Cuéntanoslo en un minuto.</div>' +
            '<a href="' + link + '" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:14px;">Rellenar satisfacción de hoy</a>'
          )
        ) +
      '</div>'
    );
  }

  function agendaHtml(scoped) {
    const upcoming = SM.stats.upcomingSessions(scoped, { n: 6 });
    if (!upcoming.length) return '<div class="empty-state">No hay próximas sesiones programadas.</div>';
    return (
      '<div style="display:flex;flex-direction:column;gap:2px;">' +
        upcoming.map(function (s) {
          const isMatch = s.tipo === 'partido';
          const match = isMatch ? (scoped.matches || []).find(function (m) { return m.id === s.match_id; }) : null;
          const label = isMatch && match ? (match.condicion === 'local' ? 'vs ' + match.rival : '@ ' + match.rival) : 'Entrenamiento';
          return (
            '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--row-border);">' +
              '<div>' +
                '<div style="font-size:13.5px;font-weight:700;color:var(--text);">' + SM.ui.escapeHtml(label) + '</div>' +
                '<div style="font-size:11.5px;color:var(--text-mute);font-weight:600;">' + SM.ui.escapeHtml(s.lugar || '—') + '</div>' +
              '</div>' +
              '<div style="text-align:right;">' +
                '<div style="font-size:12.5px;font-weight:700;color:' + (isMatch ? 'var(--amber)' : 'var(--cyan)') + ';">' + SM.ui.formatDateShort(s.fecha) + '</div>' +
                '<div style="font-size:11.5px;color:var(--text-mute);font-weight:600;">' + (s.hora || '—') + '</div>' +
              '</div>' +
            '</div>'
          );
        }).join('') +
      '</div>'
    );
  }

  function recentMatchesTable(apps, player) {
    if (!apps.length) return '<div class="empty-state">Todavía no hay partidos registrados para este jugador.</div>';
    const rows = apps.map(function (a) {
      const m = a.match;
      const win = m.goles_favor > m.goles_contra, draw = m.goles_favor === m.goles_contra;
      const scoreColor = win ? 'var(--green)' : draw ? 'var(--text-dim)' : 'var(--red-bright)';
      const golesEnPartido = SM.stats.eventCountInMatch(DATA, m.id, player.id, 'gol');
      return (
        '<tr>' +
          '<td>' + SM.ui.formatDateShort(m.fecha) + '</td>' +
          '<td>' + (m.condicion === 'local' ? 'vs ' : '@ ') + SM.ui.escapeHtml(m.rival) + '</td>' +
          '<td style="color:' + scoreColor + ';font-weight:700;">' + m.goles_favor + ' – ' + m.goles_contra + '</td>' +
          '<td>' + a.minutos + '\'</td>' +
          '<td>' + golesEnPartido + '</td>' +
        '</tr>'
      );
    }).join('');
    return (
      '<table class="data-table" style="margin-top:14px;">' +
        '<thead><tr><th>FECHA</th><th>RIVAL</th><th>RESULT.</th><th>MINUTOS</th><th>GOLES</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>'
    );
  }

  function render() {
    const p = DATA.players.find(function (pl) { return pl.id === id; });
    if (!p) {
      main.innerHTML = '<div class="empty-state">No se encontró ese jugador.</div>';
      return;
    }
    const scoped = SM.team.filterData(DATA, p.categoria || SM.team.CATEGORIES[0].key);
    const clubName = (DATA.settings && DATA.settings.club_nombre) || 'Mi club';
    const meta = SM.ui.positionMeta(p.posicion);
    const goles = SM.stats.goalsForPlayer(scoped, p.id);
    const asistencias = SM.stats.assistsForPlayer(scoped, p.id);
    const pj = SM.stats.appearancesCount(scoped, p.id);
    const minutos = SM.stats.minutesForPlayer(scoped, p.id);
    const asistenciaPct = SM.stats.attendancePct(scoped, p.id);
    const age = SM.ui.ageFromBirthdate(p.fecha_nacimiento);

    // Nada de cifras ni radares aquí: comparar números entre compañeros
    // genera competitividad tóxica a estas edades. En su lugar, solo el
    // punto que más destaca de cada jugador, como etiqueta.
    const isGk = p.posicion === 'POR';
    const attrKeys = SM.stats.attrKeysFor(p);
    const attrLabels = isGk ? SM.stats.GK_ATTR_LABELS : SM.stats.ATTR_LABELS;
    const topAttrLabels = SM.stats.topKeys(p, attrKeys).map(function (k) { return attrLabels[k]; });
    const topValueLabels = SM.stats.topKeys(p, SM.stats.VALUE_KEYS).map(function (k) { return SM.stats.VALUE_LABELS[k]; });

    const recentApps = SM.stats.appearancesForPlayer(scoped, p.id).slice(-5).reverse();

    const checkins = SM.stats.checkinsForPlayer(scoped, p.id, 8);
    const satisfaccionEvo = checkins.map(function (c) { return { label: shortDay(c.session.fecha), value: c.satisfaccion }; });
    const rendimientoEvo = checkins.map(function (c) { return { label: shortDay(c.session.fecha), value: c.rendimiento }; });

    main.innerHTML =
      headerHtml(clubName, p) +
      '<div class="profile-grid" style="margin-top:20px;">' +
        leftCardHtml(p, meta, age) +
        '<div style="display:flex;flex-direction:column;gap:20px;">' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(90px,1fr));gap:12px;">' +
            miniKpi(goles, 'GOLES', 'var(--green)') +
            miniKpi(asistencias, 'ASISTENCIAS', 'var(--cyan)') +
            miniKpi(pj, 'PARTIDOS', 'var(--text)') +
            miniKpi(minutos, 'MINUTOS', 'var(--text)') +
            miniKpi(asistenciaPct != null ? asistenciaPct + '%' : '—', 'ASISTENCIA', 'var(--magenta)') +
          '</div>' +
          todaySessionHtml(scoped, p) +
          '<div class="panel"><span class="panel-title">Próximo partido</span>' +
            '<div style="margin-top:12px;">' + nextMatchHtml(scoped, p) + '</div>' +
          '</div>' +
          '<div class="panel"><span class="panel-title">Próximas sesiones</span>' +
            '<div style="margin-top:8px;">' + agendaHtml(scoped) + '</div>' +
          '</div>' +
          '<div class="two-col-grid">' +
            '<div class="panel">' +
              '<span class="panel-title">Punto fuerte</span>' +
              '<div style="font-size:11.5px;color:var(--text-faint);font-weight:600;margin-top:2px;">Lo que mejor se le da en el campo</div>' +
              highlightBadgesHtml(topAttrLabels, meta.color) +
            '</div>' +
            '<div class="panel">' +
              '<span class="panel-title">Valor que más destaca</span>' +
              '<div style="font-size:11.5px;color:var(--text-faint);font-weight:600;margin-top:2px;">Lo que más practica dentro y fuera del campo</div>' +
              highlightBadgesHtml(topValueLabels, 'var(--amber)') +
            '</div>' +
          '</div>' +
          '<div class="two-col-grid">' +
            '<div class="panel">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px;"><span class="panel-title">Satisfacción</span>' +
              '<span style="font-size:11.5px;color:var(--text-mute);font-weight:600;">Bienestar</span></div>' +
              SM.charts.evolutionChart(satisfaccionEvo, { color: 'var(--cyan)', min: 1, max: 4 }) +
            '</div>' +
            '<div class="panel">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px;"><span class="panel-title">Rendimiento percibido</span>' +
              '<span style="font-size:11.5px;color:var(--text-mute);font-weight:600;">Bienestar</span></div>' +
              SM.charts.evolutionChart(rendimientoEvo, { color: 'var(--magenta)', min: 1, max: 4 }) +
            '</div>' +
          '</div>' +
          '<div class="panel">' +
            '<span class="panel-title">Últimos partidos</span>' +
            recentMatchesTable(recentApps, p) +
          '</div>' +
        '</div>' +
      '</div>';

    document.getElementById('logout-btn').addEventListener('click', function () {
      SM.auth.clearFamilySession();
      window.location.href = 'acceso.html';
    });
  }

  SM.api.fetchAll().then(function (data) {
    DATA = data;
    render();
  }).catch(function (err) {
    main.innerHTML = '<div class="empty-state">' + err.message + '</div>';
  });
})();
