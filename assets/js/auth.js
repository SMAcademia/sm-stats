/* SM Stats — acceso privado de familias/jugadores y cuerpo técnico.
   Credenciales derivadas de los datos ya existentes (no hay contraseña
   guardada en ningún sitio): usuario = nombre en mayúsculas, contraseña =
   las 4 primeras letras del nombre + el año de nacimiento (jugador) o de
   alta (staff). Igual que el TOKEN de Code.gs, esto NO es una autenticación
   real — es un filtro sencillo para que cada familia solo vea lo suyo, no
   un sistema de seguridad frente a alguien decidido a saltárselo. */

window.SM = window.SM || {};

SM.auth = (function () {
  const SESSION_KEY = 'sm_stats_family_session';

  function stripAccents(str) {
    return (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function lettersOnly(str) {
    return stripAccents(str).replace(/[^a-zA-Z]/g, '').toUpperCase();
  }

  function normalize(str) {
    return (str || '').trim().toUpperCase();
  }

  function yearOf(iso) {
    return iso && iso.length >= 4 ? iso.slice(0, 4) : '';
  }

  function playerCredentials(p) {
    return {
      username: normalize(p.nombre),
      password: lettersOnly(p.nombre).slice(0, 4) + yearOf(p.fecha_nacimiento)
    };
  }

  function staffCredentials(s) {
    return {
      username: normalize(s.nombre),
      password: lettersOnly(s.nombre).slice(0, 4) + yearOf(s.fecha_alta)
    };
  }

  // Devuelve { type: 'player', player } / { type: 'staff', staff } / null.
  function login(data, usernameInput, passwordInput) {
    const u = normalize(usernameInput);
    const pass = normalize(passwordInput);
    if (!u || !pass) return null;
    const player = (data.players || []).find(function (p) {
      const c = playerCredentials(p);
      return c.username === u && c.password === pass;
    });
    if (player) return { type: 'player', player: player };
    const staff = (data.staff || []).find(function (s) {
      const c = staffCredentials(s);
      return c.username === u && c.password === pass;
    });
    if (staff) return { type: 'staff', staff: staff };
    return null;
  }

  function saveFamilySession(playerId) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ type: 'player', id: playerId })); } catch (e) { /* noop */ }
  }

  function readFamilySession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clearFamilySession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* noop */ }
  }

  return {
    playerCredentials: playerCredentials,
    staffCredentials: staffCredentials,
    login: login,
    saveFamilySession: saveFamilySession,
    readFamilySession: readFamilySession,
    clearFamilySession: clearFamilySession
  };
})();
