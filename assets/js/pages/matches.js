/* SM Stats — Partidos */

(function () {
  const shell = document.getElementById('app-shell');
  SM.sidebar.mount(shell, 'partidos');
  const main = document.getElementById('main');

  let DATA = null;
  let filter = 'todos';

  function render() {
    const next = SM.stats.nextMatch(DATA);
    let list = DATA.matches.slice();
    if (filter === 'proximos') list = list.filter(function (m) { return !m.jugado; }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
    else if (filter === 'jugados') list = list.filter(function (m) { return m.jugado; }).sort(function (a, b) { return b.fecha.localeCompare(a.fecha); });
    else list = list.sort(function (a, b) { return b.fecha.localeCompare(a.fecha); });

    main.innerHTML =
      '<div class="page-header">' +
        '<div><div class="page-title">Partidos</div><div class="page-subtitle">Liga Regional · Grupo B · Temporada 2026/27</div></div>' +
        '<div style="display:flex;align-items:center;gap:14px;">' +
          '<div class="tabbar" id="tabbar">' +
            ['todos', 'proximos', 'jugados'].map(function (f) {
              const labels = { todos: 'Todos', proximos: 'Próximos', jugados: 'Jugados' };
              return '<button class="tab' + (f === filter ? ' active' : '') + '" data-filter="' + f + '">' + labels[f] + '</button>';
            }).join('') +
          '</div>' +
          '<button class="btn btn-primary" id="btn-new-match">+ Nuevo partido</button>' +
        '</div>' +
      '</div>' +
      (next && filter !== 'jugados' ? heroCard(next) : '') +
      '<div style="display:flex;flex-direction:column;gap:12px;">' +
        '<span class="panel-title" style="padding-left:4px;">' + (filter === 'proximos' ? 'Próximos partidos' : filter === 'jugados' ? 'Partidos jugados' : 'Todos los partidos') + '</span>' +
        (list.length ? list.map(matchRow).join('') : '<div class="empty-state">No hay partidos en esta vista.</div>') +
      '</div>';

    document.getElementById('tabbar').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      filter = btn.getAttribute('data-filter');
      render();
    });
    document.getElementById('btn-new-match').addEventListener('click', openNewMatchForm);
    main.querySelectorAll('[data-match]').forEach(function (el) {
      el.addEventListener('click', function () {
        const m = DATA.matches.find(function (mm) { return mm.id === el.getAttribute('data-match'); });
        if (m) openMatchReportModal(m);
      });
    });
  }

  function heroCard(match) {
    const days = daysUntil(match.fecha);
    const rivalInitials = match.rival.split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 3).toUpperCase();
    return (
      '<div class="panel" style="padding:30px 40px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:26px;">' +
          '<span class="panel-title">Próximo partido · Jornada ' + (match.jornada || '—') + '</span>' +
          '<div class="badge" style="background:' + SM.ui.alpha('var(--cyan)', 0.12) + ';border:1px solid ' + SM.ui.alpha('var(--cyan)', 0.4) + ';color:var(--cyan-bright);font-family:var(--font-display);">' +
            (days <= 0 ? 'HOY' : 'FALTAN ' + days + ' DÍA' + (days === 1 ? '' : 'S')) +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:60px;">' +
          '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;width:170px;">' +
            '<div style="width:78px;height:78px;border-radius:50%;background:var(--panel-2);border:2px solid ' + SM.ui.alpha('var(--green)', 0.55) + ';display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:800;font-size:19px;color:var(--green);">CDR</div>' +
            '<span style="font-size:16px;font-weight:700;color:var(--text-bright);">CD Ribera</span>' +
            '<span style="font-size:11.5px;color:var(--text-mute);font-weight:600;">' + (match.condicion === 'local' ? 'Local' : 'Visitante') + '</span>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;"><span style="font-family:var(--font-display);font-weight:900;font-size:24px;color:var(--text-ghost);">VS</span><span style="font-size:13px;color:var(--text-mute);font-weight:600;">' + SM.ui.formatDateShort(match.fecha) + ' · ' + match.hora + '</span></div>' +
          '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;width:170px;">' +
            '<div style="width:78px;height:78px;border-radius:50%;background:var(--panel-2);border:2px solid var(--border-soft);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:800;font-size:19px;color:var(--text-dim);">' + rivalInitials + '</div>' +
            '<span style="font-size:16px;font-weight:700;color:var(--text-bright);">' + SM.ui.escapeHtml(match.rival) + '</span>' +
            '<span style="font-size:11.5px;color:var(--text-mute);font-weight:600;">' + (match.condicion === 'local' ? 'Visitante' : 'Local') + '</span>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:30px;margin-top:26px;">' +
          '<div style="font-size:13.5px;color:var(--text-dim);font-weight:600;">' + SM.ui.escapeHtml(match.lugar) + '</div>' +
        '</div>' +
        '<div style="display:flex;justify-content:center;gap:14px;margin-top:24px;">' +
          '<button class="btn btn-primary" data-match="' + match.id + '">Editar partido / acta</button>' +
        '</div>' +
      '</div>'
    );
  }

  function daysUntil(dateStr) {
    const target = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target - startToday) / 86400000);
  }

  function matchRow(m) {
    const scorers = {};
    DATA.matchEvents.filter(function (e) { return e.match_id === m.id && e.tipo === 'gol'; }).forEach(function (e) {
      scorers[e.player_id] = (scorers[e.player_id] || 0) + 1;
    });
    const playersById = SM.stats.byId(DATA.players);
    const scorerText = Object.keys(scorers).length
      ? 'Goleador: ' + Object.keys(scorers).map(function (id) {
          const p = playersById[id];
          return p ? SM.ui.escapeHtml(p.nombre) + (scorers[id] > 1 ? ' (' + scorers[id] + ')' : '') : '';
        }).filter(Boolean).join(', ')
      : (m.jugado ? 'Sin goleadores' : 'Pendiente de jugar');

    let scoreHtml;
    if (m.jugado) {
      const win = m.goles_favor > m.goles_contra, draw = m.goles_favor === m.goles_contra;
      const color = win ? 'var(--green)' : draw ? 'var(--text-mute)' : 'var(--red)';
      const scoreColor = win ? 'var(--green)' : draw ? 'var(--text-dim)' : 'var(--red-bright)';
      scoreHtml = '<div style="display:flex;align-items:center;gap:10px;"><div class="dot" style="background:' + color + ';box-shadow:0 0 7px ' + color + ';"></div><span style="font-family:var(--font-display);font-weight:700;font-size:16px;color:' + scoreColor + ';">' + m.goles_favor + ' – ' + m.goles_contra + '</span></div>';
    } else {
      scoreHtml = '<div class="badge" style="background:' + SM.ui.alpha('var(--cyan)', 0.1) + ';border:1px solid ' + SM.ui.alpha('var(--cyan)', 0.4) + ';color:var(--cyan-bright);font-size:11.5px;">Programado</div>';
    }

    return (
      '<div class="panel" data-match="' + m.id + '" style="padding:16px 24px;display:grid;grid-template-columns:90px 1fr 140px 240px 26px;align-items:center;gap:16px;cursor:pointer;">' +
        '<span style="font-size:12.5px;color:var(--text-mute);font-weight:600;">' + SM.ui.formatDateShort(m.fecha) + '</span>' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<span style="font-size:15px;font-weight:700;color:var(--text);">' + (m.condicion === 'local' ? 'CD Ribera' : SM.ui.escapeHtml(m.rival)) + '</span>' +
          '<span style="font-size:12px;color:var(--text-mute);">vs</span>' +
          '<span style="font-size:15px;font-weight:700;color:var(--text);">' + (m.condicion === 'local' ? SM.ui.escapeHtml(m.rival) : 'CD Ribera') + '</span>' +
        '</div>' +
        scoreHtml +
        '<span style="font-size:12.5px;color:var(--text-mute);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + scorerText + '</span>' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-ghost)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>' +
      '</div>'
    );
  }

  function openNewMatchForm() {
    const body = SM.ui.el('div', {
      html:
        '<form id="match-form"><div class="form-grid">' +
          SM.forms.field('Rival', '<input name="rival" required>', true) +
          SM.forms.field('Fecha', '<input name="fecha" type="date" required>') +
          SM.forms.field('Hora', '<input name="hora" type="time" required value="17:00">') +
          SM.forms.field('Condición', SM.forms.selectHtml('condicion', [['local', 'Local'], ['visitante', 'Visitante']], 'local')) +
          SM.forms.field('Jornada', '<input name="jornada" type="number" min="1">') +
          SM.forms.field('Lugar', '<input name="lugar" placeholder="Campo Municipal La Ribera">', true) +
        '</div><div class="form-actions">' +
          '<button type="button" class="btn btn-outline" id="cancel-btn">Cancelar</button>' +
          '<button type="submit" class="btn btn-primary">Guardar</button>' +
        '</div></form>'
    });
    const handle = SM.ui.openModal('Nuevo partido', body);
    body.querySelector('#cancel-btn').addEventListener('click', handle.close);
    body.querySelector('#match-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const payload = {};
      new FormData(e.target).forEach(function (v, k) { payload[k] = v; });
      if (payload.jornada) payload.jornada = Number(payload.jornada);
      SM.api.postAction('addMatch', payload).then(function () {
        handle.close();
        return SM.api.fetchAll(true);
      }).then(function (data) {
        DATA = data;
        render();
        SM.ui.toast('Partido añadido.', 'ok');
      }).catch(function (err) { SM.ui.toast(err.message, 'error'); });
    });
  }

  function openMatchReportModal(match) {
    const players = DATA.players.filter(function (p) { return p.activo; }).sort(function (a, b) { return (a.dorsal || 99) - (b.dorsal || 99); });
    const appsByPlayer = {};
    DATA.matchAppearances.filter(function (a) { return a.match_id === match.id; }).forEach(function (a) { appsByPlayer[a.player_id] = a; });
    const eventsByPlayer = {};
    DATA.matchEvents.filter(function (e) { return e.match_id === match.id; }).forEach(function (e) {
      eventsByPlayer[e.player_id] = eventsByPlayer[e.player_id] || { gol: 0, asistencia: 0, amarilla: 0, roja: 0 };
      eventsByPlayer[e.player_id][e.tipo]++;
    });

    const rows = players.map(function (p) {
      const app = appsByPlayer[p.id];
      const ev = eventsByPlayer[p.id] || { gol: 0, asistencia: 0, amarilla: 0, roja: 0 };
      const called = !!app || ev.gol || ev.asistencia || ev.amarilla || ev.roja;
      return (
        '<tr data-row="' + p.id + '">' +
          '<td><input type="checkbox" name="conv_' + p.id + '"' + (called ? ' checked' : '') + '></td>' +
          '<td style="text-align:left;">' + SM.ui.escapeHtml(p.nombre) + '</td>' +
          '<td><input type="number" min="0" max="120" name="min_' + p.id + '" value="' + (app ? app.minutos : 90) + '" style="width:56px;"></td>' +
          '<td><input type="number" min="0" max="10" step="0.1" name="nota_' + p.id + '" value="' + (app && app.valoracion != null ? app.valoracion : '') + '" style="width:56px;"></td>' +
          '<td><input type="number" min="0" name="gol_' + p.id + '" value="' + ev.gol + '" style="width:48px;"></td>' +
          '<td><input type="number" min="0" name="asis_' + p.id + '" value="' + ev.asistencia + '" style="width:48px;"></td>' +
          '<td><input type="checkbox" name="am_' + p.id + '"' + (ev.amarilla ? ' checked' : '') + '></td>' +
          '<td><input type="checkbox" name="ro_' + p.id + '"' + (ev.roja ? ' checked' : '') + '></td>' +
        '</tr>'
      );
    }).join('');

    const body = SM.ui.el('div', {
      html:
        '<form id="report-form">' +
          '<div class="form-grid">' +
            SM.forms.field('Goles a favor', '<input name="golesFavor" type="number" min="0" value="' + (match.goles_favor != null ? match.goles_favor : '') + '">') +
            SM.forms.field('Goles en contra', '<input name="golesContra" type="number" min="0" value="' + (match.goles_contra != null ? match.goles_contra : '') + '">') +
          '</div>' +
          '<div class="form-hint" style="margin:16px 0 8px;">Convocatoria y acta — marca quién jugó y sus datos.</div>' +
          '<div style="overflow-x:auto;">' +
            '<table class="data-table" style="min-width:560px;">' +
              '<thead><tr><th>Conv.</th><th style="text-align:left;">Jugador</th><th>Min</th><th>Nota</th><th>G</th><th>A</th><th>Am</th><th>Roja</th></tr></thead>' +
              '<tbody>' + rows + '</tbody>' +
            '</table>' +
          '</div>' +
          '<div class="form-actions">' +
            '<button type="button" class="btn btn-outline" id="cancel-btn">Cancelar</button>' +
            '<button type="submit" class="btn btn-primary">Guardar acta</button>' +
          '</div>' +
        '</form>'
    });
    const handle = SM.ui.openModal('Acta · vs ' + match.rival, body);
    body.querySelector('#cancel-btn').addEventListener('click', handle.close);
    body.querySelector('#report-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      const golesFavor = fd.get('golesFavor') === '' ? null : Number(fd.get('golesFavor'));
      const golesContra = fd.get('golesContra') === '' ? null : Number(fd.get('golesContra'));
      const appearances = [];
      const events = [];
      players.forEach(function (p) {
        if (!fd.get('conv_' + p.id)) return;
        appearances.push({
          player_id: p.id,
          minutos: Number(fd.get('min_' + p.id)) || 0,
          valoracion: fd.get('nota_' + p.id) ? Number(fd.get('nota_' + p.id)) : null
        });
        const gol = Number(fd.get('gol_' + p.id)) || 0;
        const asis = Number(fd.get('asis_' + p.id)) || 0;
        for (let i = 0; i < gol; i++) events.push({ player_id: p.id, tipo: 'gol' });
        for (let i = 0; i < asis; i++) events.push({ player_id: p.id, tipo: 'asistencia' });
        if (fd.get('am_' + p.id)) events.push({ player_id: p.id, tipo: 'amarilla' });
        if (fd.get('ro_' + p.id)) events.push({ player_id: p.id, tipo: 'roja' });
      });
      SM.api.postAction('saveMatchReport', { matchId: match.id, golesFavor: golesFavor, golesContra: golesContra, appearances: appearances, events: events })
        .then(function () {
          handle.close();
          return SM.api.fetchAll(true);
        }).then(function (data) {
          DATA = data;
          render();
          SM.ui.toast('Acta guardada.', 'ok');
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
