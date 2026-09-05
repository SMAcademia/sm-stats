/* SM Stats — pure aggregation helpers.
   Every function takes the full dataset (as returned by SM.api.fetchAll())
   and derives numbers from the raw rows. Nothing here is stored back in
   Sheets — it's all computed on the fly so the raw tables can never drift
   out of sync with the numbers shown on screen. */

window.SM = window.SM || {};

SM.stats = (function () {
  const ATTR_KEYS = ['ritmo', 'tiro', 'pase', 'regate', 'defensa', 'fisico'];

  // 0-10 overall rating derived from the six 0-100 attributes (avoids storing
  // a redundant "rating" field that could drift from the attributes).
  function overallRating(player) {
    const vals = ATTR_KEYS.map(function (k) { return Number(player[k]) || 0; });
    const avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    return Math.round(avg) / 10;
  }

  function byId(list) {
    const map = {};
    (list || []).forEach(function (item) { map[item.id] = item; });
    return map;
  }

  function playedMatches(data) {
    return (data.matches || []).filter(function (m) { return m.jugado; });
  }

  function upcomingMatches(data) {
    return (data.matches || []).filter(function (m) { return !m.jugado; })
      .sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
  }

  function nextMatch(data) {
    return upcomingMatches(data)[0] || null;
  }

  function recentResults(data, n) {
    return playedMatches(data)
      .sort(function (a, b) { return b.fecha.localeCompare(a.fecha); })
      .slice(0, n || 4);
  }

  function eventCountInMatch(data, matchId, playerId, tipo) {
    return (data.matchEvents || []).filter(function (e) {
      return e.match_id === matchId && e.player_id === playerId && e.tipo === tipo;
    }).length;
  }

  function eventsForPlayer(data, playerId, tipo) {
    return (data.matchEvents || []).filter(function (e) { return e.player_id === playerId && e.tipo === tipo; });
  }

  function goalsForPlayer(data, playerId) { return eventsForPlayer(data, playerId, 'gol').length; }
  function assistsForPlayer(data, playerId) { return eventsForPlayer(data, playerId, 'asistencia').length; }
  function yellowsForPlayer(data, playerId) { return eventsForPlayer(data, playerId, 'amarilla').length; }
  function redsForPlayer(data, playerId) { return eventsForPlayer(data, playerId, 'roja').length; }

  function appearancesForPlayer(data, playerId) {
    const matchesById = byId(data.matches);
    return (data.matchAppearances || [])
      .filter(function (a) { return a.player_id === playerId; })
      .map(function (a) { return Object.assign({}, a, { match: matchesById[a.match_id] }); })
      .filter(function (a) { return a.match; })
      .sort(function (a, b) { return a.match.fecha.localeCompare(b.match.fecha); });
  }

  function appearancesCount(data, playerId) { return appearancesForPlayer(data, playerId).length; }

  function minutesForPlayer(data, playerId) {
    return appearancesForPlayer(data, playerId).reduce(function (sum, a) { return sum + (a.minutos || 0); }, 0);
  }

  function sessionsUpTo(data, refDate) {
    const ref = refDate || new Date();
    return (data.sessions || []).filter(function (s) { return new Date(s.fecha + 'T00:00:00') <= ref; });
  }

  function attendanceForSession(data, sessionId) {
    return (data.attendance || []).filter(function (a) { return a.session_id === sessionId; });
  }

  // % of past sessions where the player was marked "presente" (justificado counts as excused, not counted against them).
  function attendancePct(data, playerId, sessions) {
    const rows = (sessions || sessionsUpTo(data)).map(function (s) {
      return (data.attendance || []).find(function (a) { return a.session_id === s.id && a.player_id === playerId; });
    }).filter(Boolean);
    const counted = rows.filter(function (r) { return r.estado === 'presente' || r.estado === 'ausente'; });
    if (!counted.length) return null;
    const presentes = counted.filter(function (r) { return r.estado === 'presente'; }).length;
    return Math.round((presentes / counted.length) * 100);
  }

  function teamAttendancePct(data) {
    const active = (data.players || []).filter(function (p) { return p.activo; });
    const pcts = active.map(function (p) { return attendancePct(data, p.id); }).filter(function (v) { return v !== null; });
    if (!pcts.length) return null;
    return Math.round(pcts.reduce(function (a, b) { return a + b; }, 0) / pcts.length);
  }

  function totalGoals(data) { return (data.matchEvents || []).filter(function (e) { return e.tipo === 'gol'; }).length; }

  function teamKpis(data) {
    return {
      activePlayers: (data.players || []).filter(function (p) { return p.activo; }).length,
      avgAttendance: teamAttendancePct(data),
      totalGoals: totalGoals(data),
      nextMatch: nextMatch(data)
    };
  }

  function topBy(data, tipo, n) {
    const counts = {};
    (data.matchEvents || []).forEach(function (e) {
      if (e.tipo === tipo) counts[e.player_id] = (counts[e.player_id] || 0) + 1;
    });
    const playersById = byId(data.players);
    return Object.keys(counts)
      .map(function (id) { return { player: playersById[id], count: counts[id] }; })
      .filter(function (row) { return row.player; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, n || 5);
  }

  function topScorers(data, n) { return topBy(data, 'gol', n); }
  function topAssisters(data, n) { return topBy(data, 'asistencia', n); }

  function evolutionForPlayer(data, playerId, n) {
    const apps = appearancesForPlayer(data, playerId).filter(function (a) { return a.valoracion != null; });
    return apps.slice(-(n || 6));
  }

  function fullPlayerRow(data, player) {
    return {
      player: player,
      pj: appearancesCount(data, player.id),
      goles: goalsForPlayer(data, player.id),
      asistencias: assistsForPlayer(data, player.id),
      amarillas: yellowsForPlayer(data, player.id),
      rojas: redsForPlayer(data, player.id),
      asistenciaPct: attendancePct(data, player.id)
    };
  }

  function fullStatsTable(data) {
    return (data.players || []).filter(function (p) { return p.activo; }).map(function (p) { return fullPlayerRow(data, p); });
  }

  function attendanceByPosition(data) {
    const positions = ['POR', 'DEF', 'CEN', 'DEL'];
    return positions.map(function (pos) {
      const players = (data.players || []).filter(function (p) { return p.activo && p.posicion === pos; });
      const pcts = players.map(function (p) { return attendancePct(data, p.id); }).filter(function (v) { return v !== null; });
      const avg = pcts.length ? Math.round(pcts.reduce(function (a, b) { return a + b; }, 0) / pcts.length) : null;
      return { posicion: pos, avg: avg, count: players.length };
    });
  }

  // ISO week key "2026-W37" for grouping sessions into weekly attendance trend.
  function isoWeekKey(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const week = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
    return target.getFullYear() + '-W' + week;
  }

  function weeklyAttendanceTrend(data, weeks) {
    const sessions = sessionsUpTo(data).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
    const groups = {};
    const order = [];
    sessions.forEach(function (s) {
      const key = isoWeekKey(s.fecha);
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(s);
    });
    const recentKeys = order.slice(-(weeks || 4));
    return recentKeys.map(function (key) {
      const sessionIds = groups[key].map(function (s) { return s.id; });
      const rows = (data.attendance || []).filter(function (a) { return sessionIds.indexOf(a.session_id) !== -1 && (a.estado === 'presente' || a.estado === 'ausente'); });
      const presentes = rows.filter(function (r) { return r.estado === 'presente'; }).length;
      const pct = rows.length ? Math.round((presentes / rows.length) * 100) : null;
      return { week: key, pct: pct };
    });
  }

  function upcomingSessions(data, opts) {
    opts = opts || {};
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return (data.sessions || [])
      .filter(function (s) { return new Date(s.fecha + 'T00:00:00') >= startOfToday; })
      .filter(function (s) { return !opts.tipo || s.tipo === opts.tipo; })
      .sort(function (a, b) { return a.fecha.localeCompare(b.fecha) || (a.hora || '').localeCompare(b.hora || ''); })
      .slice(0, opts.n || 5);
  }

  function sessionsForMonth(data, year, month) {
    return (data.sessions || []).filter(function (s) {
      const d = new Date(s.fecha + 'T00:00:00');
      return d.getFullYear() === year && d.getMonth() === month;
    }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
  }

  // Active players whose fecha_nacimiento falls on today's month/day (any birth year).
  function birthdaysToday(data, today) {
    const now = today || new Date();
    return (data.players || []).filter(function (p) {
      if (!p.activo || !p.fecha_nacimiento) return false;
      const d = new Date(p.fecha_nacimiento + 'T00:00:00');
      return !isNaN(d) && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    });
  }

  return {
    ATTR_KEYS: ATTR_KEYS,
    overallRating: overallRating,
    byId: byId,
    playedMatches: playedMatches,
    upcomingMatches: upcomingMatches,
    nextMatch: nextMatch,
    recentResults: recentResults,
    eventCountInMatch: eventCountInMatch,
    goalsForPlayer: goalsForPlayer,
    assistsForPlayer: assistsForPlayer,
    yellowsForPlayer: yellowsForPlayer,
    redsForPlayer: redsForPlayer,
    appearancesForPlayer: appearancesForPlayer,
    appearancesCount: appearancesCount,
    minutesForPlayer: minutesForPlayer,
    attendanceForSession: attendanceForSession,
    attendancePct: attendancePct,
    teamAttendancePct: teamAttendancePct,
    totalGoals: totalGoals,
    teamKpis: teamKpis,
    topScorers: topScorers,
    topAssisters: topAssisters,
    evolutionForPlayer: evolutionForPlayer,
    fullStatsTable: fullStatsTable,
    attendanceByPosition: attendanceByPosition,
    weeklyAttendanceTrend: weeklyAttendanceTrend,
    sessionsForMonth: sessionsForMonth,
    sessionsUpTo: sessionsUpTo,
    upcomingSessions: upcomingSessions,
    birthdaysToday: birthdaysToday
  };
})();
