/* SM Stats — Convocatorias (lista de partidos + hoja exportable a PDF) */

(function () {
  const shell = document.getElementById('app-shell');
  SM.sidebar.mount(shell, 'convocatorias');
  const main = document.getElementById('main');

  let DATA = null;
  let selectedMatchId = null;

  SM.sidebar.onSettingsClick(function () {
    SM.forms.openSettingsForm(DATA && DATA.settings, function (data) { DATA = SM.team.filterData(data, SM.team.current()); render(); });
  });

  function convocadosForMatch(matchId) {
    return DATA.matchAppearances.filter(function (a) { return a.match_id === matchId; });
  }

  function render() {
    const settings = DATA.settings || SM.sidebar.DEFAULT_SETTINGS;
    const clubName = settings.club_nombre;
    const matches = DATA.matches.slice().sort(function (a, b) {
      const aUpcoming = !a.jugado, bUpcoming = !b.jugado;
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      return aUpcoming ? a.fecha.localeCompare(b.fecha) : b.fecha.localeCompare(a.fecha);
    });
    if (!selectedMatchId && matches.length) selectedMatchId = matches[0].id;
    const match = matches.find(function (m) { return m.id === selectedMatchId; }) || null;

    main.innerHTML =
      '<div class="page-header">' +
        '<div><div class="page-title">Convocatorias</div><div class="page-subtitle">Elige un partido y exporta la lista de convocados para compartir con las familias</div></div>' +
      '</div>' +
      '<div class="callup-page-grid" style="display:grid;grid-template-columns:340px 1fr;gap:20px;align-items:start;">' +
        '<div class="panel no-print" style="padding:14px;display:flex;flex-direction:column;gap:6px;max-height:640px;overflow-y:auto;">' +
          (matches.length ? matches.map(function (m) { return matchRow(m, clubName); }).join('') : '<div class="empty-state">Todavía no hay partidos.</div>') +
        '</div>' +
        '<div id="callup-panel"></div>' +
      '</div>';

    main.querySelectorAll('[data-pick-match]').forEach(function (el) {
      el.addEventListener('click', function () {
        selectedMatchId = el.getAttribute('data-pick-match');
        render();
      });
    });

    document.getElementById('callup-panel').innerHTML = match ? callupPanelHtml(match, clubName) : '<div class="panel"><div class="empty-state">Selecciona un partido.</div></div>';
    const exportBtn = document.getElementById('export-pdf-btn');
    if (exportBtn) exportBtn.addEventListener('click', function () { window.print(); });
  }

  function matchRow(m, clubName) {
    const count = convocadosForMatch(m.id).length;
    const active = m.id === selectedMatchId;
    return (
      '<div data-pick-match="' + m.id + '" style="cursor:pointer;padding:12px 14px;border-radius:10px;display:flex;flex-direction:column;gap:4px;' +
        (active ? 'background:' + SM.ui.alpha('var(--cyan)', 0.12) + ';border:1px solid ' + SM.ui.alpha('var(--cyan)', 0.4) + ';' : 'border:1px solid transparent;') + '">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;">' +
          '<span style="font-size:13px;font-weight:700;color:var(--text);">' + (m.condicion === 'local' ? SM.ui.escapeHtml(clubName) + ' vs ' + SM.ui.escapeHtml(m.rival) : SM.ui.escapeHtml(m.rival) + ' vs ' + SM.ui.escapeHtml(clubName)) + '</span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;">' +
          '<span style="font-size:11.5px;color:var(--text-mute);font-weight:600;">' + SM.ui.formatDateShort(m.fecha) + (m.hora ? ' · ' + m.hora : '') + '</span>' +
          '<span style="font-size:11px;font-weight:700;color:' + (count ? 'var(--green)' : 'var(--text-ghost)') + ';">' + count + ' convocados</span>' +
        '</div>' +
      '</div>'
    );
  }

  function callupPanelHtml(match, clubName) {
    const convocados = convocadosForMatch(match.id);
    const playersById = SM.stats.byId(DATA.players);
    const rows = convocados
      .map(function (a) { return { player: playersById[a.player_id], capitan: a.capitan }; })
      .filter(function (r) { return r.player; })
      .sort(function (a, b) { return (a.player.dorsal || 99) - (b.player.dorsal || 99); });

    return (
      '<div style="display:flex;flex-direction:column;gap:16px;">' +
        '<div class="panel no-print" style="display:flex;align-items:center;justify-content:space-between;">' +
          '<span class="panel-title">Vista previa</span>' +
          '<button class="btn btn-primary" id="export-pdf-btn"' + (rows.length ? '' : ' disabled') + '>Exportar PDF</button>' +
        '</div>' +
        (rows.length ? '' : '<div class="panel no-print"><div class="empty-state">Este partido todavía no tiene convocatoria — márcala desde <a href="partidos.html">Partidos</a> (Editar partido / acta).</div></div>') +
        '<div class="callup-sheet">' +
          '<div class="callup-club">' + SM.ui.escapeHtml(clubName) + '</div>' +
          '<div class="callup-title">CONVOCATORIA' + (match.categoria ? ' · ' + SM.ui.escapeHtml(match.categoria) : '') + '</div>' +
          '<div class="callup-meta">' +
            '<span><strong>Rival:</strong> ' + (match.condicion === 'local' ? SM.ui.escapeHtml(match.rival) : SM.ui.escapeHtml(clubName) + ' (visitante)') + '</span>' +
            '<span><strong>Fecha:</strong> ' + SM.ui.formatDateLong(match.fecha) + '</span>' +
            '<span><strong>Hora:</strong> ' + (match.hora || '—') + '</span>' +
            '<span><strong>Lugar:</strong> ' + SM.ui.escapeHtml(match.lugar || '—') + '</span>' +
            (match.jornada ? '<span><strong>Jornada:</strong> ' + match.jornada + '</span>' : '') +
          '</div>' +
          (rows.length ? (
            '<table>' +
              '<thead><tr><th>DORSAL</th><th>JUGADOR</th><th></th></tr></thead>' +
              '<tbody>' +
                rows.map(function (r) {
                  return '<tr><td>' + (r.player.dorsal || '—') + '</td><td>' + SM.ui.escapeHtml(r.player.nombre) + '</td><td>' + (r.capitan ? 'C' : '') + '</td></tr>';
                }).join('') +
              '</tbody>' +
            '</table>'
          ) : '') +
          '<div class="callup-footer">Generado con SM Stats el ' + SM.ui.formatDateLong(SM.ui.formatDateIso(new Date())) + '.</div>' +
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
