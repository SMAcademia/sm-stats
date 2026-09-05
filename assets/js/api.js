/* SM Stats — data access layer.
   Reads/writes go through this module only. If SM.config.APPS_SCRIPT_URL is
   empty, it transparently falls back to the bundled demo dataset so the
   site works on GitHub Pages before Sheets is connected (see README). */

window.SM = window.SM || {};

SM.api = (function () {
  let cache = null;
  let cachePromise = null;

  function isLive() {
    return !!(SM.config && SM.config.APPS_SCRIPT_URL && SM.config.APPS_SCRIPT_URL.trim());
  }

  // A "force" refresh only makes sense against a live Apps Script — in demo
  // mode there is no server to refetch from, and the in-memory cache is
  // already the freshest copy (postAction mutates it directly), so a forced
  // call there just returns what's already loaded instead of clobbering it
  // with the pristine sample file again.
  async function fetchAll(force) {
    const mustHitNetwork = isLive() ? (force || !cache) : !cache;
    if (!mustHitNetwork) return cache;
    if (cachePromise && !(force && isLive())) return cachePromise;
    cachePromise = (async () => {
      if (isLive()) {
        const res = await fetch(SM.config.APPS_SCRIPT_URL + '?action=data', { cache: 'no-store' });
        if (!res.ok) throw new Error('No se pudo conectar con la hoja de cálculo.');
        const json = await res.json();
        if (!json || json.ok === false) throw new Error((json && json.error) || 'No se pudo leer la hoja de cálculo.');
        cache = json.result;
      } else {
        const res = await fetch('assets/data/sample-data.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('No se pudo cargar el dataset de ejemplo.');
        cache = await res.json();
      }
      return cache;
    })();
    return cachePromise;
  }

  function invalidate() { cache = null; cachePromise = null; }

  function nextMockId(prefix) {
    return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1000);
  }

  // Local-date (not UTC) yyyy-MM-dd — Date#toISOString shifts the calendar
  // day for anyone west/east of UTC, which would silently misdate generated
  // sessions/matches for a coach outside that timezone.
  function isoFromLocalDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function applyMockAction(action, payload) {
    const d = cache;
    function createMockMatch(m) {
      const row = Object.assign({ id: nextMockId('m'), jugado: false, goles_favor: null, goles_contra: null }, m);
      d.matches.push(row);
      d.sessions.push({ id: nextMockId('se'), fecha: row.fecha, hora: row.hora, tipo: 'partido', lugar: row.lugar, match_id: row.id });
      return row;
    }
    switch (action) {
      case 'addPlayer': {
        const row = Object.assign({ id: nextMockId('p'), activo: true }, payload);
        d.players.push(row);
        return row;
      }
      case 'updatePlayer': {
        const i = d.players.findIndex(function (p) { return p.id === payload.id; });
        if (i >= 0) d.players[i] = Object.assign({}, d.players[i], payload);
        return d.players[i];
      }
      case 'addStaffMember': {
        const row = Object.assign({ id: nextMockId('s') }, payload);
        d.staff.push(row);
        return row;
      }
      case 'addMatch': {
        return createMockMatch(payload);
      }
      case 'addMatches': {
        return (payload.matches || []).map(createMockMatch);
      }
      case 'addSession': {
        const row = Object.assign({ id: nextMockId('se'), tipo: 'entrenamiento', match_id: '' }, payload);
        d.sessions.push(row);
        return row;
      }
      case 'addRecurringSessions': {
        const dias = (payload.diasSemana || []).map(Number);
        const start = new Date(payload.fechaInicio + 'T00:00:00');
        const end = new Date((payload.fechaFin || payload.fechaInicio) + 'T00:00:00');
        const created = [];
        for (const cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
          if (dias.indexOf(cur.getDay()) === -1) continue;
          const row = {
            id: nextMockId('se'),
            fecha: isoFromLocalDate(cur),
            hora: payload.hora || '',
            tipo: 'entrenamiento',
            lugar: payload.lugar || '',
            match_id: ''
          };
          d.sessions.push(row);
          created.push(row);
        }
        return created;
      }
      case 'updateSession': {
        const i = d.sessions.findIndex(function (s) { return s.id === payload.id; });
        if (i >= 0) d.sessions[i] = Object.assign({}, d.sessions[i], payload);
        return d.sessions[i];
      }
      case 'deleteSession': {
        d.sessions = d.sessions.filter(function (s) { return s.id !== payload.id; });
        d.attendance = d.attendance.filter(function (a) { return a.session_id !== payload.id; });
        return true;
      }
      case 'saveMatchReport': {
        const mi = d.matches.findIndex(function (m) { return m.id === payload.matchId; });
        if (mi >= 0) {
          const hasResult = payload.golesFavor != null && payload.golesContra != null;
          d.matches[mi].jugado = hasResult;
          d.matches[mi].goles_favor = payload.golesFavor;
          d.matches[mi].goles_contra = payload.golesContra;
        }
        d.matchAppearances = d.matchAppearances.filter(function (a) { return a.match_id !== payload.matchId; });
        d.matchEvents = d.matchEvents.filter(function (e) { return e.match_id !== payload.matchId; });
        d.matchIntervals = (d.matchIntervals || []).filter(function (iv) { return iv.match_id !== payload.matchId; });
        (payload.appearances || []).forEach(function (a) {
          d.matchAppearances.push(Object.assign({ id: nextMockId('ma') }, a, { match_id: payload.matchId }));
        });
        (payload.events || []).forEach(function (e) {
          d.matchEvents.push(Object.assign({ id: nextMockId('e') }, e, { match_id: payload.matchId }));
        });
        (payload.intervals || []).forEach(function (iv) {
          d.matchIntervals.push(Object.assign({ id: nextMockId('iv') }, iv, { match_id: payload.matchId }));
        });
        return true;
      }
      case 'updateSettings': {
        d.settings = Object.assign({}, d.settings, payload);
        return d.settings;
      }
      case 'saveAttendance': {
        d.attendance = d.attendance.filter(function (a) { return a.session_id !== payload.sessionId; });
        (payload.rows || []).forEach(function (r) {
          d.attendance.push(Object.assign({ id: nextMockId('at') }, r, { session_id: payload.sessionId }));
        });
        return true;
      }
      default:
        return null;
    }
  }

  async function postAction(action, payload) {
    if (isLive()) {
      const res = await fetch(SM.config.APPS_SCRIPT_URL, {
        method: 'POST',
        // text/plain avoids a CORS preflight against Apps Script Web Apps
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: action, token: SM.config.TOKEN, payload: payload })
      });
      let json = null;
      try { json = await res.json(); } catch (e) { /* noop */ }
      if (!res.ok || !json || json.ok === false) {
        throw new Error((json && json.error) || 'No se pudo guardar en la hoja de cálculo.');
      }
      invalidate();
      return json.result;
    }
    await fetchAll();
    const result = applyMockAction(action, payload);
    if (SM.ui) {
      SM.ui.toast('Modo demo: el cambio se aplica solo en esta sesión (conecta Sheets en config.js para guardarlo de verdad).', 'ok');
    }
    return result;
  }

  return { fetchAll: fetchAll, postAction: postAction, invalidate: invalidate, isLive: isLive };
})();
