/* SM Stats — Acceso privado (familias/jugadores y cuerpo técnico).
   Página standalone (acceso.html), sin sidebar. Las credenciales las da
   el entrenador: usuario = nombre en mayúsculas, contraseña = 4 primeras
   letras del nombre + año (ver assets/js/auth.js). Un jugador entra a su
   ficha reducida (mi-jugador.html); el staff entra directo a la app
   completa (index.html) — tiene el mismo acceso que el entrenador. */

(function () {
  const root = document.getElementById('live-root');
  let DATA = null;
  let error = '';
  let submitting = false;

  function render() {
    const clubName = (DATA && DATA.settings && DATA.settings.club_nombre) || 'SM Stats';
    root.innerHTML =
      '<div class="live-header">' +
        '<div style="min-width:0;flex:1 1 auto;">' +
          '<div class="live-header-title">' + SM.ui.escapeHtml(clubName) + '</div>' +
          '<div class="live-header-sub">Acceso privado — familias y cuerpo técnico</div>' +
        '</div>' +
      '</div>' +
      '<div style="padding:28px 20px;display:flex;flex-direction:column;gap:16px;">' +
        '<div class="panel" style="display:flex;flex-direction:column;gap:16px;">' +
          '<div>' +
            '<div style="font-size:17px;font-weight:700;color:var(--text-strong);">Iniciar sesión</div>' +
            '<div style="font-size:13px;color:var(--text-faint);margin-top:4px;">Usa el usuario y la contraseña que te ha dado el entrenador.</div>' +
          '</div>' +
          '<form id="login-form" style="display:flex;flex-direction:column;gap:14px;">' +
            '<div class="form-field">' +
              '<label>Usuario</label>' +
              '<input type="text" id="login-username" autocomplete="username" autocapitalize="characters" placeholder="p. ej. DIEGO PRIETO">' +
            '</div>' +
            '<div class="form-field">' +
              '<label>Contraseña</label>' +
              '<input type="password" id="login-password" autocomplete="current-password" placeholder="••••••••">' +
            '</div>' +
            (error ? '<div style="font-size:12.5px;color:var(--red-bright);font-weight:600;">' + SM.ui.escapeHtml(error) + '</div>' : '') +
            '<button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;padding:13px;"' + (submitting ? ' disabled' : '') + '>' +
              (submitting ? 'Entrando…' : 'Entrar') +
            '</button>' +
          '</form>' +
        '</div>' +
      '</div>';

    document.getElementById('login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;
      const match = SM.auth.login(DATA, username, password);
      if (!match) {
        error = 'Usuario o contraseña incorrectos.';
        render();
        return;
      }
      error = '';
      submitting = true;
      render();
      if (match.type === 'player') {
        SM.auth.saveFamilySession(match.player.id);
        window.location.href = 'mi-jugador.html?id=' + match.player.id;
      } else {
        window.location.href = 'index.html';
      }
    });
  }

  SM.api.fetchAll().then(function (data) {
    DATA = data;
    render();
  }).catch(function (err) {
    root.innerHTML = '<div class="live-loading">' + err.message + '</div>';
  });
})();
