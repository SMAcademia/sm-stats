/* SM Stats — equipo activo (para clubes con varias categorías en paralelo).
   Todas las páginas filtran los datos por la categoría seleccionada aquí;
   el propio selector vive en la barra lateral (ver sidebar.js). */

window.SM = window.SM || {};

SM.team = (function () {
  // "por parte" categories are two halves — duracion is the TOTAL match length.
  const CATEGORIES = [
    { key: 'Alevín', duracion: 35 },
    { key: 'Benjamín', duracion: 30 },
    { key: 'Prebenjamín', duracion: 50 },
    { key: 'Miniprebenjamín', duracion: 20 }
  ];
  const STORAGE_KEY = 'sm_stats_categoria_activa';

  function current() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && CATEGORIES.some(function (c) { return c.key === stored; })) return stored;
    } catch (e) { /* localStorage blocked — fall back to default below */ }
    return CATEGORIES[0].key;
  }

  function setCurrent(categoria) {
    try { localStorage.setItem(STORAGE_KEY, categoria); } catch (e) { /* noop */ }
  }

  function duration(categoria) {
    const found = CATEGORIES.filter(function (c) { return c.key === categoria; })[0];
    return found ? found.duracion : 90;
  }

  // Rows created before multi-equipo existed (or a fresh install's very
  // first team) have no categoria set — treat those as belonging to the
  // first configured team rather than making them vanish from every view.
  function belongsTo(rowCategoria, categoria) {
    return rowCategoria ? rowCategoria === categoria : categoria === CATEGORIES[0].key;
  }

  // Returns a copy of the full dataset scoped to one team: only that
  // team's players/sessions/matches, and everything that hangs off them
  // (asistencia, eventos, convocatorias, minutos). Staff and settings stay
  // shared across teams.
  function filterData(data, categoria) {
    const players = (data.players || []).filter(function (p) { return belongsTo(p.categoria, categoria); });
    const matches = (data.matches || []).filter(function (m) { return belongsTo(m.categoria, categoria); });
    const matchIds = {};
    matches.forEach(function (m) { matchIds[m.id] = true; });
    const sessions = (data.sessions || []).filter(function (s) {
      return s.tipo === 'partido' ? matchIds[s.match_id] : belongsTo(s.categoria, categoria);
    });
    const sessionIds = {};
    sessions.forEach(function (s) { sessionIds[s.id] = true; });
    return Object.assign({}, data, {
      players: players,
      matches: matches,
      sessions: sessions,
      attendance: (data.attendance || []).filter(function (a) { return sessionIds[a.session_id]; }),
      matchEvents: (data.matchEvents || []).filter(function (e) { return matchIds[e.match_id]; }),
      matchAppearances: (data.matchAppearances || []).filter(function (a) { return matchIds[a.match_id]; }),
      matchIntervals: (data.matchIntervals || []).filter(function (iv) { return matchIds[iv.match_id]; })
    });
  }

  return {
    CATEGORIES: CATEGORIES,
    current: current,
    setCurrent: setCurrent,
    duration: duration,
    filterData: filterData
  };
})();
