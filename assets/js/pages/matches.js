/* SM Stats — Partidos */

(function () {
  const shell = document.getElementById('app-shell');
  SM.sidebar.mount(shell, 'partidos');
  const main = document.getElementById('main');

  // Category duration (minutes) drives how minutes-played is capped/defaulted
  // in the acta — per club rules: Alevín se juega a 35', Benjamín a 30'.
  const CATEGORY_DURATION = { 'Alevín': 35, 'Benjamín': 30 };
  const DEFAULT_DURATION = 90;
  function matchDuration(match) { return CATEGORY_DURATION[match.categoria] || DEFAULT_DURATION; }

  let DATA = null;
  let filter = 'todos';

  SM.sidebar.onSettingsClick(function () {
    SM.forms.openSettingsForm(DATA && DATA.settings, function (data) { DATA = data; render(); });
  });

  function render() {
    const settings = DATA.settings || SM.sidebar.DEFAULT_SETTINGS;
    const clubName = settings.club_nombre;
    const ligaNombre = settings.liga_nombre || SM.sidebar.DEFAULT_SETTINGS.liga_nombre;
    const next = SM.stats.nextMatch(DATA);
    let list = DATA.matches.slice();
    if (filter === 'proximos') list = list.filter(function (m) { return !m.jugado; }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
    else if (filter === 'jugados') list = list.filter(function (m) { return m.jugado; }).sort(function (a, b) { return b.fecha.localeCompare(a.fecha); });
    else list = list.sort(function (a, b) { return b.fecha.localeCompare(a.fecha); });

    main.innerHTML =
      '<div class="page-header">' +
        '<div><div class="page-title">Partidos</div><div class="page-subtitle">' + SM.ui.escapeHtml(ligaNombre) + ' · Temporada 2026/27</div></div>' +
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
      (next && filter !== 'jugados' ? heroCard(next, clubName) : '') +
      '<div style="display:flex;flex-direction:column;gap:12px;">' +
        '<span class="panel-title" style="padding-left:4px;">' + (filter === 'proximos' ? 'Próximos partidos' : filter === 'jugados' ? 'Partidos jugados' : 'Todos los partidos') + '</span>' +
        (list.length ? list.map(function (m) { return matchRow(m, clubName); }).join('') : '<div class="empty-state">No hay partidos en esta vista.</div>') +
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

  function heroCard(match, clubName) {
    const days = daysUntil(match.fecha);
    const rivalInitials = SM.ui.clubInitials(match.rival);
    return (
      '<div class="panel" style="padding:30px 40px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:26px;">' +
          '<span class="panel-title">Próximo partido · ' + SM.ui.competitionLabel(match.competicion) + ' · Jornada ' + (match.jornada || '—') + '</span>' +
          '<div class="badge" style="background:' + SM.ui.alpha('var(--cyan)', 0.12) + ';border:1px solid ' + SM.ui.alpha('var(--cyan)', 0.4) + ';color:var(--cyan-bright);font-family:var(--font-display);">' +
            (days <= 0 ? 'HOY' : 'FALTAN ' + days + ' DÍA' + (days === 1 ? '' : 'S')) +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:60px;">' +
          '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;width:170px;">' +
            '<div style="width:78px;height:78px;border-radius:50%;background:var(--panel-2);border:2px solid ' + SM.ui.alpha('var(--green)', 0.55) + ';display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:800;font-size:19px;color:var(--green);">' + SM.ui.clubInitials(clubName) + '</div>' +
            '<span style="font-size:16px;font-weight:700;color:var(--text-bright);">' + SM.ui.escapeHtml(clubName) + '</span>' +
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

  function matchRow(m, clubName) {
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
      '<div class="panel" data-match="' + m.id + '" style="padding:16px 24px;display:grid;grid-template-columns:74px 90px 1fr 140px 200px 26px;align-items:center;gap:16px;cursor:pointer;">' +
        '<span class="badge" style="justify-self:start;background:var(--panel-2);border:1px solid var(--border-soft);color:var(--text-mute);font-size:10.5px;padding:4px 8px;">' + SM.ui.competitionLabel(m.competicion) + '</span>' +
        '<span style="font-size:12.5px;color:var(--text-mute);font-weight:600;">' + SM.ui.formatDateShort(m.fecha) + '</span>' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<span style="font-size:15px;font-weight:700;color:var(--text);">' + (m.condicion === 'local' ? SM.ui.escapeHtml(clubName) : SM.ui.escapeHtml(m.rival)) + '</span>' +
          '<span style="font-size:12px;color:var(--text-mute);">vs</span>' +
          '<span style="font-size:15px;font-weight:700;color:var(--text);">' + (m.condicion === 'local' ? SM.ui.escapeHtml(m.rival) : SM.ui.escapeHtml(clubName)) + '</span>' +
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
          SM.forms.field('Competición', SM.forms.selectHtml('competicion', [['liga', 'Liga'], ['copa', 'Copa'], ['torneo', 'Torneo'], ['amistoso', 'Amistoso']], 'liga')) +
          SM.forms.field('Categoría', SM.forms.selectHtml('categoria', [['Alevín', 'Alevín (35\')'], ['Benjamín', 'Benjamín (30\')']], 'Alevín')) +
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
    const duration = matchDuration(match);
    const players = DATA.players.filter(function (p) { return p.activo; }).sort(function (a, b) { return (a.dorsal || 99) - (b.dorsal || 99); });
    const appsByPlayer = {};
    DATA.matchAppearances.filter(function (a) { return a.match_id === match.id; }).forEach(function (a) { appsByPlayer[a.player_id] = a; });
    const eventsByPlayer = {};
    DATA.matchEvents.filter(function (e) { return e.match_id === match.id; }).forEach(function (e) {
      eventsByPlayer[e.player_id] = eventsByPlayer[e.player_id] || { gol: 0, asistencia: 0, amarilla: 0, roja: 0 };
      eventsByPlayer[e.player_id][e.tipo]++;
    });
    const intervalsByPlayer = {};
    (DATA.matchIntervals || []).filter(function (iv) { return iv.match_id === match.id; }).forEach(function (iv) {
      (intervalsByPlayer[iv.player_id] = intervalsByPlayer[iv.player_id] || []).push({ entrada: iv.entrada, salida: iv.salida });
    });
    Object.keys(intervalsByPlayer).forEach(function (pid) {
      intervalsByPlayer[pid].sort(function (a, b) { return a.entrada - b.entrada; });
    });

    // Editable on-pitch stretches per player (unlimited substitutions), e.g.
    // 0-17 and 34-54 -> 37 minutes. Seeded from MatchIntervals, or from the
    // old flat "minutos" field for matches saved before this existed.
    const intervalsState = {};
    players.forEach(function (p) {
      const app = appsByPlayer[p.id];
      if (intervalsByPlayer[p.id] && intervalsByPlayer[p.id].length) {
        intervalsState[p.id] = intervalsByPlayer[p.id];
      } else if (app) {
        intervalsState[p.id] = [{ entrada: 0, salida: app.minutos || 0 }];
      } else {
        intervalsState[p.id] = [];
      }
    });

    function totalMinutes(playerId) {
      return (intervalsState[playerId] || []).reduce(function (sum, iv) {
        return sum + Math.max(0, (Number(iv.salida) || 0) - (Number(iv.entrada) || 0));
      }, 0);
    }

    function intervalsHtml(playerId) {
      const list = intervalsState[playerId] || [];
      return (
        '<div style="display:flex;flex-direction:column;gap:4px;">' +
          list.map(function (iv, idx) {
            return (
              '<div style="display:flex;align-items:center;gap:4px;">' +
                '<input type="number" min="0" class="iv-in" data-player="' + playerId + '" data-idx="' + idx + '" value="' + iv.entrada + '" title="Minuto de entrada" style="width:46px;">' +
                '<span style="color:var(--text-mute);">–</span>' +
                '<input type="number" min="0" class="iv-out" data-player="' + playerId + '" data-idx="' + idx + '" value="' + iv.salida + '" title="Minuto de salida" style="width:46px;">' +
                '<button type="button" class="iv-remove" data-player="' + playerId + '" data-idx="' + idx + '" title="Quitar cambio" style="width:22px;height:22px;flex:none;border-radius:6px;background:transparent;border:1px solid var(--border-soft);color:var(--text-mute);cursor:pointer;">×</button>' +
              '</div>'
            );
          }).join('') +
          '<button type="button" class="iv-add" data-player="' + playerId + '" style="align-self:flex-start;font-size:11px;font-weight:700;color:var(--cyan-bright);background:none;border:none;cursor:pointer;padding:2px 0;">+ Cambio</button>' +
        '</div>'
      );
    }

    function rowHtml(p) {
      const app = appsByPlayer[p.id];
      const ev = eventsByPlayer[p.id] || { gol: 0, asistencia: 0, amarilla: 0, roja: 0 };
      const called = !!app || ev.gol || ev.asistencia || ev.amarilla || ev.roja || (intervalsState[p.id] && intervalsState[p.id].length);
      return (
        '<tr data-row="' + p.id + '">' +
          '<td><input type="checkbox" class="conv-cb" data-player="' + p.id + '" name="conv_' + p.id + '"' + (called ? ' checked' : '') + '></td>' +
          '<td style="text-align:left;">' + SM.ui.escapeHtml(p.nombre) + '</td>' +
          '<td data-total="' + p.id + '" style="font-weight:700;">' + totalMinutes(p.id) + '\'</td>' +
          '<td data-intervals="' + p.id + '">' + intervalsHtml(p.id) + '</td>' +
          '<td><input type="number" min="0" max="10" step="0.1" name="nota_' + p.id + '" value="' + (app && app.valoracion != null ? app.valoracion : '') + '" style="width:56px;"></td>' +
          '<td><input type="number" min="0" name="gol_' + p.id + '" value="' + ev.gol + '" style="width:48px;"></td>' +
          '<td><input type="number" min="0" name="asis_' + p.id + '" value="' + ev.asistencia + '" style="width:48px;"></td>' +
          '<td><input type="checkbox" name="am_' + p.id + '"' + (ev.amarilla ? ' checked' : '') + '></td>' +
          '<td><input type="checkbox" name="ro_' + p.id + '"' + (ev.roja ? ' checked' : '') + '></td>' +
        '</tr>'
      );
    }

    const rows = players.map(rowHtml).join('');

    const body = SM.ui.el('div', {
      html:
        '<form id="report-form">' +
          '<div class="form-grid">' +
            SM.forms.field('Goles a favor', '<input name="golesFavor" type="number" min="0" value="' + (match.goles_favor != null ? match.goles_favor : '') + '">') +
            SM.forms.field('Goles en contra', '<input name="golesContra" type="number" min="0" value="' + (match.goles_contra != null ? match.goles_contra : '') + '">') +
          '</div>' +
          '<div class="form-hint" style="margin:16px 0 8px;">Convocatoria y acta — marca quién jugó y sus cambios (minuto de entrada y salida; los minutos totales se calculan solos). Duración del partido: ' + duration + ' min' + (match.categoria ? ' (' + SM.ui.escapeHtml(match.categoria) + ')' : '') + '.</div>' +
          '<div style="overflow-x:auto;">' +
            '<table class="data-table" style="min-width:740px;">' +
              '<thead><tr><th>Conv.</th><th style="text-align:left;">Jugador</th><th>Min</th><th>Entrada – salida</th><th>Nota</th><th>G</th><th>A</th><th>Am</th><th>Roja</th></tr></thead>' +
              '<tbody id="report-tbody">' + rows + '</tbody>' +
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

    function refreshPlayerCells(playerId) {
      const cell = body.querySelector('[data-intervals="' + playerId + '"]');
      if (cell) cell.innerHTML = intervalsHtml(playerId);
      const totalCell = body.querySelector('[data-total="' + playerId + '"]');
      if (totalCell) totalCell.textContent = totalMinutes(playerId) + '\'';
    }

    const tbody = body.querySelector('#report-tbody');
    tbody.addEventListener('input', function (e) {
      const t = e.target;
      if (!t.classList.contains('iv-in') && !t.classList.contains('iv-out')) return;
      const playerId = t.getAttribute('data-player');
      const idx = Number(t.getAttribute('data-idx'));
      const key = t.classList.contains('iv-in') ? 'entrada' : 'salida';
      intervalsState[playerId][idx][key] = Number(t.value) || 0;
      const totalCell = body.querySelector('[data-total="' + playerId + '"]');
      if (totalCell) totalCell.textContent = totalMinutes(playerId) + '\'';
    });
    tbody.addEventListener('click', function (e) {
      const addBtn = e.target.closest('.iv-add');
      const removeBtn = e.target.closest('.iv-remove');
      if (addBtn) {
        const playerId = addBtn.getAttribute('data-player');
        const list = intervalsState[playerId];
        const lastOut = list.length ? list[list.length - 1].salida : 0;
        list.push({ entrada: Math.min(lastOut, duration), salida: duration });
        refreshPlayerCells(playerId);
      } else if (removeBtn) {
        const playerId = removeBtn.getAttribute('data-player');
        const idx = Number(removeBtn.getAttribute('data-idx'));
        intervalsState[playerId].splice(idx, 1);
        refreshPlayerCells(playerId);
      }
    });
    tbody.addEventListener('change', function (e) {
      const cb = e.target.closest('.conv-cb');
      if (!cb) return;
      const playerId = cb.getAttribute('data-player');
      if (cb.checked && (!intervalsState[playerId] || !intervalsState[playerId].length)) {
        intervalsState[playerId] = [{ entrada: 0, salida: duration }];
        refreshPlayerCells(playerId);
      }
    });

    body.querySelector('#report-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      const golesFavor = fd.get('golesFavor') === '' ? null : Number(fd.get('golesFavor'));
      const golesContra = fd.get('golesContra') === '' ? null : Number(fd.get('golesContra'));
      const appearances = [];
      const events = [];
      const intervals = [];
      players.forEach(function (p) {
        if (!fd.get('conv_' + p.id)) return;
        appearances.push({
          player_id: p.id,
          minutos: totalMinutes(p.id),
          valoracion: fd.get('nota_' + p.id) ? Number(fd.get('nota_' + p.id)) : null
        });
        (intervalsState[p.id] || []).forEach(function (iv) {
          intervals.push({ player_id: p.id, entrada: iv.entrada, salida: iv.salida });
        });
        const gol = Number(fd.get('gol_' + p.id)) || 0;
        const asis = Number(fd.get('asis_' + p.id)) || 0;
        for (let i = 0; i < gol; i++) events.push({ player_id: p.id, tipo: 'gol' });
        for (let i = 0; i < asis; i++) events.push({ player_id: p.id, tipo: 'asistencia' });
        if (fd.get('am_' + p.id)) events.push({ player_id: p.id, tipo: 'amarilla' });
        if (fd.get('ro_' + p.id)) events.push({ player_id: p.id, tipo: 'roja' });
      });
      SM.api.postAction('saveMatchReport', { matchId: match.id, golesFavor: golesFavor, golesContra: golesContra, appearances: appearances, events: events, intervals: intervals })
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
    SM.sidebar.applySettings(data.settings);
    render();
  }).catch(function (err) {
    main.innerHTML = '<div class="empty-state">' + err.message + '</div>';
  });
})();
