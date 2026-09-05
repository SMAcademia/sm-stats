/* SM Stats — Plantilla (jugadores + cuerpo técnico) */

(function () {
  const shell = document.getElementById('app-shell');
  SM.sidebar.mount(shell, 'plantilla');
  const main = document.getElementById('main');

  SM.sidebar.onSettingsClick(function () {
    SM.forms.openSettingsForm(DATA && DATA.settings, function (data) { DATA = SM.team.filterData(data, SM.team.current()); });
  });

  const POSITIONS = [
    { code: 'TODOS', label: 'Todos' },
    { code: 'POR', label: 'Porteros' },
    { code: 'DEF', label: 'Defensas' },
    { code: 'CEN', label: 'Centrocampistas' },
    { code: 'DEL', label: 'Delanteros' }
  ];

  const POSITION_ORDER = { POR: 0, DEF: 1, CEN: 2, DEL: 3 };

  let DATA = null;
  let tab = 'jugadores';
  let posFilter = 'TODOS';
  let search = '';

  function render() {
    main.innerHTML =
      '<div class="page-header">' +
        '<div><div class="page-title">' + (tab === 'jugadores' ? 'Plantilla' : 'Cuerpo técnico') + '</div>' +
        '<div class="page-subtitle" id="subtitle"></div></div>' +
        '<button class="btn btn-primary" id="btn-add">+ ' + (tab === 'jugadores' ? 'Añadir jugador' : 'Añadir miembro') + '</button>' +
      '</div>' +
      '<div class="tabbar" id="tabbar">' +
        '<button class="tab' + (tab === 'jugadores' ? ' active' : '') + '" data-tab="jugadores">Jugadores</button>' +
        '<button class="tab' + (tab === 'staff' ? ' active' : '') + '" data-tab="staff">Cuerpo técnico</button>' +
      '</div>' +
      (tab === 'jugadores' ? (
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">' +
          '<div class="search-box"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7382" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
            '<input id="search" type="text" placeholder="Buscar jugador..."></div>' +
          '<div class="filter-row" id="filters">' +
            POSITIONS.map(function (p) { return '<button class="pill' + (p.code === posFilter ? ' active' : '') + '" data-pos="' + p.code + '">' + p.label + '</button>'; }).join('') +
          '</div>' +
        '</div>'
      ) : '') +
      '<div id="grid" class="card-grid"></div>';

    document.getElementById('tabbar').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;
      tab = btn.getAttribute('data-tab');
      render();
    });
    document.getElementById('btn-add').addEventListener('click', function () {
      if (tab === 'jugadores') {
        SM.forms.openPlayerForm(null, function (data) { DATA = SM.team.filterData(data, SM.team.current()); updateGrid(); });
      } else {
        SM.forms.openStaffForm(null, function (data) { DATA = SM.team.filterData(data, SM.team.current()); updateGrid(); });
      }
    });
    if (tab === 'jugadores') {
      document.getElementById('search').addEventListener('input', function (e) {
        search = e.target.value.trim().toLowerCase();
        updateGrid();
      });
      document.getElementById('filters').addEventListener('click', function (e) {
        const btn = e.target.closest('[data-pos]');
        if (!btn) return;
        posFilter = btn.getAttribute('data-pos');
        document.querySelectorAll('#filters .pill').forEach(function (p) { p.classList.toggle('active', p === btn); });
        updateGrid();
      });
    }
    updateGrid();
  }

  function updateGrid() {
    const grid = document.getElementById('grid');
    const subtitle = document.getElementById('subtitle');
    if (tab === 'jugadores') {
      let players = DATA.players.filter(function (p) { return p.activo; });
      if (posFilter !== 'TODOS') players = players.filter(function (p) { return p.posicion === posFilter; });
      if (search) players = players.filter(function (p) { return p.nombre.toLowerCase().indexOf(search) !== -1; });
      players.sort(function (a, b) {
        const posDiff = (POSITION_ORDER[a.posicion] ?? 99) - (POSITION_ORDER[b.posicion] ?? 99);
        return posDiff !== 0 ? posDiff : (a.dorsal || 99) - (b.dorsal || 99);
      });
      subtitle.textContent = DATA.players.filter(function (p) { return p.activo; }).length + ' jugadores registrados · Temporada 2026/27';
      grid.innerHTML = players.length ? players.map(playerCardHtml).join('') : '<div class="empty-state">No hay jugadores que coincidan con el filtro.</div>';
      grid.querySelectorAll('.player-card').forEach(function (card) {
        card.addEventListener('click', function () { window.location.href = 'jugador.html?id=' + card.getAttribute('data-id'); });
      });
    } else {
      subtitle.textContent = DATA.staff.length + ' miembros del staff · Temporada 2026/27';
      grid.innerHTML = DATA.staff.length ? DATA.staff.map(staffCardHtml).join('') : '<div class="empty-state">Todavía no hay miembros del cuerpo técnico.</div>';
    }
  }

  function playerCardHtml(p) {
    const meta = SM.ui.positionMeta(p.posicion);
    const rating = SM.stats.overallRating(p);
    const attendance = SM.stats.attendancePct(DATA, p.id);
    const goals = SM.stats.goalsForPlayer(DATA, p.id);
    const assists = SM.stats.assistsForPlayer(DATA, p.id);
    const pj = SM.stats.appearancesCount(DATA, p.id);
    return (
      '<div class="player-card" data-id="' + p.id + '">' +
        '<div class="accent-bar" style="background:' + meta.color + ';box-shadow:0 0 10px ' + meta.color + ';"></div>' +
        '<div class="player-card-head">' +
          '<span class="player-dorsal">' + String(p.dorsal || '').padStart(2, '0') + '</span>' +
          '<div class="player-rating" style="background:' + SM.ui.alpha(meta.color, 0.12) + ';color:' + meta.bright + ';">' + rating.toFixed(1) + '</div>' +
        '</div>' +
        '<div class="player-card-body">' +
          SM.ui.avatarHtml(p.foto_url, 64) +
          '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">' +
            '<span class="name">' + SM.ui.escapeHtml(p.nombre) + '</span>' +
            '<span class="position" style="color:' + meta.color + ';">' + meta.label.toUpperCase() + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="player-card-stats">' +
          '<div class="stat"><span class="num">' + goals + '</span><span class="lbl">GOLES</span></div>' +
          '<div class="stat"><span class="num">' + assists + '</span><span class="lbl">ASIST.</span></div>' +
          '<div class="stat"><span class="num">' + pj + '</span><span class="lbl">PJ</span></div>' +
        '</div>' +
        '<div class="player-card-attendance">' +
          '<div class="bar-track thin"><div class="bar-fill" style="width:' + (attendance || 0) + '%;background:var(--green);"></div></div>' +
          '<span style="font-size:10.5px;font-weight:700;color:var(--text-faint);">' + (attendance != null ? attendance + '%' : '—') + '</span>' +
        '</div>' +
      '</div>'
    );
  }

  function staffCardHtml(s) {
    return (
      '<div class="player-card" style="cursor:default;">' +
        '<div class="accent-bar" style="background:var(--cyan);box-shadow:0 0 10px var(--cyan);"></div>' +
        '<div class="player-card-body" style="margin-top:4px;">' +
          SM.ui.avatarHtml(s.foto_url, 84) +
          '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">' +
            '<span class="name" style="font-size:16px;">' + SM.ui.escapeHtml(s.nombre) + '</span>' +
            '<span class="position" style="color:var(--cyan);text-align:center;">' + SM.ui.escapeHtml(s.rol).toUpperCase() + '</span>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:10px;margin-top:18px;padding-top:16px;border-top:1px solid var(--border);">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;color:var(--text-faint);font-weight:600;">Licencia / formación</span><span style="font-size:12.5px;color:var(--text);font-weight:700;">' + SM.ui.escapeHtml(s.licencia || '—') + '</span></div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;color:var(--text-faint);font-weight:600;">En el club desde</span><span style="font-size:12.5px;color:var(--text);font-weight:700;">' + (s.fecha_alta || '—') + '</span></div>' +
        '</div>' +
      '</div>'
    );
  }

  SM.api.fetchAll().then(function (data) {
    DATA = SM.team.filterData(data, SM.team.current());
    SM.sidebar.applySettings(data.settings);
    render();
  }).catch(function (err) {
    main.innerHTML = '<div class="empty-state">' + err.message + '</div>';
  });
})();
