/* SM Stats — Estadísticas del equipo */

(function () {
  const shell = document.getElementById('app-shell');
  SM.sidebar.mount(shell, 'estadisticas');
  const main = document.getElementById('main');

  const COLUMNS = [
    { key: 'nombre', label: 'JUGADOR', align: 'left' },
    { key: 'posicion', label: 'POS.' },
    { key: 'pj', label: 'PJ' },
    { key: 'goles', label: 'GOLES' },
    { key: 'asistencias', label: 'ASISTENC.' },
    { key: 'tarjetas', label: 'AM / ROJ', sortable: false },
    { key: 'asistenciaPct', label: 'ASIST. %' }
  ];

  let DATA = null;
  let sortKey = 'goles';
  let sortDir = -1;

  SM.sidebar.onSettingsClick(function () {
    SM.forms.openSettingsForm(DATA && DATA.settings, function (data) { DATA = data; });
  });

  function render() {
    const rows = SM.stats.fullStatsTable(DATA);
    const scorers = SM.stats.topScorers(DATA, 6);
    const assisters = SM.stats.topAssisters(DATA, 6);
    const byPosition = SM.stats.attendanceByPosition(DATA);

    main.innerHTML =
      '<div class="page-header">' +
        '<div><div class="page-title">Estadísticas del equipo</div><div class="page-subtitle">Comparativa de toda la plantilla · Temporada 2026/27</div></div>' +
        '<div class="badge" style="background:var(--panel);border:1px solid var(--border-soft);color:var(--text-dim);">' + SM.stats.playedMatches(DATA).length + ' partidos jugados</div>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">' +
        '<div class="panel"><span class="panel-title">Goles por jugador</span><div style="display:flex;flex-direction:column;gap:12px;margin-top:18px;">' +
          (scorers.length ? SM.charts.barList(scorers.map(function (r) { return { label: r.player.nombre, value: r.count }; }), { color: 'var(--green)' }) : '<div class="empty-state">Sin goles todavía</div>') +
        '</div></div>' +
        '<div class="panel"><span class="panel-title">Asistencias (pases de gol)</span><div style="display:flex;flex-direction:column;gap:12px;margin-top:18px;">' +
          (assisters.length ? SM.charts.barList(assisters.map(function (r) { return { label: r.player.nombre, value: r.count }; }), { color: 'var(--cyan)' }) : '<div class="empty-state">Sin asistencias todavía</div>') +
        '</div></div>' +
      '</div>' +

      '<div class="panel" style="overflow-x:auto;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;">' +
          '<span class="panel-title">Estadísticas de la plantilla</span>' +
          '<span style="font-size:11.5px;color:var(--text-mute);font-weight:600;">Ordenado por ' + COLUMNS.find(function (c) { return c.key === sortKey; }).label.toLowerCase() + '</span>' +
        '</div>' +
        tableHtml(rows) +
      '</div>' +

      '<div class="panel">' +
        '<span class="panel-title">Asistencia media por posición</span>' +
        '<div style="display:grid;grid-template-columns:repeat(4, minmax(0,1fr));gap:20px;margin-top:16px;">' +
          byPosition.map(function (row) {
            const meta = SM.ui.positionMeta(row.posicion);
            const label = { POR: 'Porteros', DEF: 'Defensas', CEN: 'Centro', DEL: 'Delanteros' }[row.posicion];
            return '<div style="display:flex;align-items:center;gap:12px;">' +
              '<span style="font-size:12.5px;font-weight:700;color:' + meta.color + ';width:70px;">' + label + '</span>' +
              '<div class="bar-track"><div class="bar-fill" style="width:' + (row.avg || 0) + '%;background:' + meta.color + ';"></div></div>' +
              '<span style="font-size:12.5px;font-weight:700;color:var(--text);width:34px;text-align:right;">' + (row.avg != null ? row.avg + '%' : '—') + '</span>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>';

    main.querySelectorAll('[data-sort]').forEach(function (th) {
      th.addEventListener('click', function () {
        const key = th.getAttribute('data-sort');
        if (sortKey === key) sortDir = -sortDir; else { sortKey = key; sortDir = -1; }
        render();
      });
    });
  }

  function tableHtml(rows) {
    const sorted = rows.slice().sort(function (a, b) {
      if (sortKey === 'nombre') return sortDir === -1 ? b.player.nombre.localeCompare(a.player.nombre) : a.player.nombre.localeCompare(b.player.nombre);
      if (sortKey === 'posicion') {
        const av = a.player.posicion || '', bv = b.player.posicion || '';
        return sortDir === -1 ? bv.localeCompare(av) : av.localeCompare(bv);
      }
      const av = a[sortKey] == null ? -1 : a[sortKey];
      const bv = b[sortKey] == null ? -1 : b[sortKey];
      return sortDir === -1 ? bv - av : av - bv;
    });

    const head = '<tr>' + COLUMNS.map(function (c) {
      const active = c.key === sortKey;
      const arrow = active ? (sortDir === -1
        ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>'
        : '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="m6 15 6-6 6 6"/></svg>') : '';
      const clickable = c.sortable === false ? '' : ' data-sort="' + c.key + '" style="cursor:pointer;' + (active ? 'color:var(--green);' : '') + '"';
      return '<th' + clickable + '><div style="display:flex;align-items:center;gap:4px;' + (c.align === 'left' ? '' : 'justify-content:flex-start;') + '">' + c.label + arrow + '</div></th>';
    }).join('') + '</tr>';

    const body = sorted.map(function (r) {
      const meta = SM.ui.positionMeta(r.player.posicion);
      const pctColor = r.asistenciaPct == null ? 'var(--text-ghost)' : r.asistenciaPct >= 80 ? 'var(--cyan)' : 'var(--amber)';
      return (
        '<tr>' +
          '<td style="font-weight:700;color:var(--text-strong);">' + SM.ui.escapeHtml(r.player.nombre) + '</td>' +
          '<td style="color:' + meta.color + ';font-weight:700;">' + r.player.posicion + '</td>' +
          '<td>' + r.pj + '</td>' +
          '<td style="font-family:var(--font-display);font-weight:700;' + (r.goles > 0 ? 'color:var(--green);' : '') + '">' + r.goles + '</td>' +
          '<td>' + r.asistencias + '</td>' +
          '<td' + (r.amarillas + r.rojas > 0 ? ' style="color:var(--amber);font-weight:700;"' : '') + '>' + r.amarillas + ' / ' + r.rojas + '</td>' +
          '<td style="text-align:right;">' +
            '<div style="display:inline-flex;align-items:center;gap:8px;">' +
              '<div class="bar-track thin" style="width:44px;"><div class="bar-fill" style="width:' + (r.asistenciaPct || 0) + '%;background:' + pctColor + ';"></div></div>' +
              '<span style="font-weight:700;color:var(--text);">' + (r.asistenciaPct != null ? r.asistenciaPct + '%' : '—') + '</span>' +
            '</div>' +
          '</td>' +
        '</tr>'
      );
    }).join('');

    return '<table class="data-table" style="margin-top:10px;"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
  }

  SM.api.fetchAll().then(function (data) {
    DATA = data;
    SM.sidebar.applySettings(data.settings);
    render();
  }).catch(function (err) {
    main.innerHTML = '<div class="empty-state">' + err.message + '</div>';
  });
})();
