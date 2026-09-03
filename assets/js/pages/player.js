/* SM Stats — Ficha de jugador */

(function () {
  const shell = document.getElementById('app-shell');
  SM.sidebar.mount(shell, 'plantilla');
  const main = document.getElementById('main');

  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function monthYear(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  const id = SM.ui.qs('id');
  let DATA = null;

  function render() {
    const p = DATA.players.find(function (pl) { return pl.id === id; });
    if (!p) {
      main.innerHTML = '<div class="empty-state">No se encontró ese jugador. <a href="plantilla.html">Volver a la plantilla</a></div>';
      return;
    }
    const meta = SM.ui.positionMeta(p.posicion);
    const rating = SM.stats.overallRating(p);
    const goles = SM.stats.goalsForPlayer(DATA, p.id);
    const asistencias = SM.stats.assistsForPlayer(DATA, p.id);
    const pj = SM.stats.appearancesCount(DATA, p.id);
    const minutos = SM.stats.minutesForPlayer(DATA, p.id);
    const amarillas = SM.stats.yellowsForPlayer(DATA, p.id);
    const asistenciaPct = SM.stats.attendancePct(DATA, p.id);
    const age = SM.ui.ageFromBirthdate(p.fecha_nacimiento);

    const radarAttrs = [
      { label: 'RITMO', value: p.ritmo || 0 }, { label: 'TIRO', value: p.tiro || 0 },
      { label: 'PASE', value: p.pase || 0 }, { label: 'REGATE', value: p.regate || 0 },
      { label: 'DEFENSA', value: p.defensa || 0 }, { label: 'FÍSICO', value: p.fisico || 0 }
    ];

    const evolution = SM.stats.evolutionForPlayer(DATA, p.id, 6).map(function (a) {
      return { label: 'J' + (a.match.jornada != null ? a.match.jornada : '?'), value: a.valoracion };
    });

    const recentApps = SM.stats.appearancesForPlayer(DATA, p.id).slice(-5).reverse();

    main.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<a href="plantilla.html" style="width:34px;height:34px;border-radius:9px;background:var(--panel);border:1px solid var(--border-soft);display:flex;align-items:center;justify-content:center;">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9aa2b0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></a>' +
        '<span style="font-size:13.5px;color:var(--text-mute);font-weight:600;">Plantilla</span>' +
        '<span style="font-size:13.5px;color:var(--text-ghost);">/</span>' +
        '<span style="font-size:13.5px;color:var(--text-dim);font-weight:600;">' + SM.ui.escapeHtml(p.nombre) + '</span>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:320px 1fr;gap:22px;">' +
        leftCardHtml(p, meta, rating, age) +
        '<div style="display:flex;flex-direction:column;gap:20px;">' +
          '<div style="display:grid;grid-template-columns:repeat(6, minmax(0,1fr));gap:14px;">' +
            miniKpi(goles, 'GOLES', 'var(--green)') +
            miniKpi(asistencias, 'ASISTENCIAS', 'var(--cyan)') +
            miniKpi(pj, 'PARTIDOS', 'var(--text)') +
            miniKpi(minutos, 'MINUTOS', 'var(--text)') +
            miniKpi(amarillas, 'AMARILLAS', 'var(--amber)') +
            miniKpi(asistenciaPct != null ? asistenciaPct + '%' : '—', 'ASISTENCIA', 'var(--magenta)') +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">' +
            '<div class="panel"><span class="panel-title">Atributos</span>' +
              '<div style="display:flex;justify-content:center;margin-top:6px;">' + SM.charts.radarChart(radarAttrs, { color: meta.color }) + '</div>' +
            '</div>' +
            '<div class="panel">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;"><span class="panel-title">Evolución del rendimiento</span>' +
              '<span style="font-size:11.5px;color:var(--text-mute);font-weight:600;">Últimos partidos</span></div>' +
              SM.charts.evolutionChart(evolution, { color: meta.color }) +
            '</div>' +
          '</div>' +
          '<div class="panel">' +
            '<span class="panel-title">Últimos partidos</span>' +
            recentMatchesTable(recentApps, p) +
          '</div>' +
        '</div>' +
      '</div>';

    main.querySelector('#edit-player-btn').addEventListener('click', function () {
      SM.forms.openPlayerForm(p, function (data) { DATA = data; render(); });
    });
  }

  function leftCardHtml(p, meta, rating, age) {
    return (
      '<div class="panel" style="padding:28px 24px;display:flex;flex-direction:column;align-items:center;align-self:start;">' +
        '<div class="badge" style="background:' + SM.ui.alpha(meta.color, 0.14) + ';border:1px solid ' + SM.ui.alpha(meta.color, 0.5) + ';color:' + meta.bright + ';margin-bottom:18px;">' + meta.label.toUpperCase() + '</div>' +
        SM.ui.avatarHtml(p.foto_url, 116) +
        '<div style="font-size:22px;font-weight:700;color:var(--text-strong);margin-top:16px;">' + SM.ui.escapeHtml(p.nombre) + '</div>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-top:6px;">' +
          '<span style="font-family:var(--font-display);font-weight:800;font-size:15px;color:var(--text-dim);">#' + p.dorsal + '</span>' +
          '<div style="width:4px;height:4px;border-radius:50%;background:var(--text-ghost);"></div>' +
          '<span style="font-family:var(--font-display);font-weight:800;font-size:15px;color:' + meta.bright + ';">RATING ' + rating.toFixed(1) + '</span>' +
        '</div>' +
        '<div style="width:100%;height:1px;background:var(--border);margin:22px 0;"></div>' +
        '<div style="display:flex;flex-direction:column;gap:13px;width:100%;">' +
          '<span style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--text-ghost);">DATOS PERSONALES</span>' +
          dataRow('Fecha de nacimiento', SM.ui.formatDateLong(p.fecha_nacimiento)) +
          dataRow('Edad', age != null ? age + ' años' : '—') +
          dataRow('Nacionalidad', SM.ui.escapeHtml(p.nacionalidad) || '—') +
          dataRow('Altura / Peso', (p.altura_cm || '—') + ' cm · ' + (p.peso_kg || '—') + ' kg') +
          dataRow('Contacto de emergencia', SM.ui.escapeHtml(p.contacto_emergencia) || '—') +
        '</div>' +
        '<div style="width:100%;height:1px;background:var(--border);margin:20px 0;"></div>' +
        '<div style="display:flex;flex-direction:column;gap:13px;width:100%;">' +
          '<span style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--text-ghost);">DATOS DEPORTIVOS</span>' +
          dataRow('Posición principal', meta.label) +
          dataRow('Posición secundaria', SM.ui.escapeHtml(p.posicion_secundaria) || '—') +
          dataRow('Pie dominante', p.pie || '—') +
          dataRow('Dorsal', '#' + p.dorsal) +
          dataRow('Categoría', p.categoria || '—') +
          dataRow('En el club desde', monthYear(p.fecha_alta)) +
          dataRow('Club anterior', SM.ui.escapeHtml(p.club_anterior) || '—') +
        '</div>' +
        '<button id="edit-player-btn" class="btn btn-outline" style="width:100%;margin-top:22px;">Editar ficha</button>' +
      '</div>'
    );
  }

  function dataRow(label, value) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12.5px;color:var(--text-faint);font-weight:600;">' + label + '</span><span style="font-size:13.5px;color:var(--text);font-weight:700;text-align:right;">' + value + '</span></div>';
  }

  function miniKpi(value, label, color) {
    return '<div class="panel" style="padding:14px;display:flex;flex-direction:column;align-items:center;gap:4px;"><span style="font-family:var(--font-display);font-weight:800;font-size:22px;color:' + color + ';">' + value + '</span><span style="font-size:10px;color:var(--text-mute);font-weight:600;letter-spacing:.3px;">' + label + '</span></div>';
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
          '<td style="color:var(--amber);font-weight:700;">' + (a.valoracion != null ? a.valoracion.toFixed(1) : '—') + '</td>' +
        '</tr>'
      );
    }).join('');
    return (
      '<table class="data-table" style="margin-top:14px;">' +
        '<thead><tr><th>FECHA</th><th>RIVAL</th><th>RESULT.</th><th>MINUTOS</th><th>GOLES</th><th>NOTA</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>'
    );
  }

  if (!id) {
    main.innerHTML = '<div class="empty-state">Falta el parámetro de jugador. <a href="plantilla.html">Volver a la plantilla</a></div>';
  } else {
    SM.api.fetchAll().then(function (data) {
      DATA = data;
      render();
    }).catch(function (err) {
      main.innerHTML = '<div class="empty-state">' + err.message + '</div>';
    });
  }
})();
