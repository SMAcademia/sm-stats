/* SM Stats — Usuarios (usuarios.html). Vista consolidada, solo para el
   entrenador/a: todos los accesos derivados (jugadores/familias y staff,
   incluida la directiva) en una sola tabla, con botón para copiar cada
   uno — en vez de tener que ir ficha por ficha a buscarlos. No crea
   usuarios nuevos ni contraseñas reales: son las mismas credenciales
   derivadas del nombre que ya calcula SM.auth en toda la app. */

(function () {
  const shell = document.getElementById('app-shell');
  SM.sidebar.mount(shell, 'usuarios');
  const main = document.getElementById('main');
  const esc = SM.ui.escapeHtml;

  let DATA = null;
  let search = '';

  function accessLink() {
    return window.location.origin + window.location.pathname.replace(/usuarios\.html$/, 'acceso.html');
  }

  function copyAccess(nombre, creds, kind) {
    const label = kind === 'player' ? 'familia/jugador' : kind === 'directiva' ? 'directiva' : 'cuerpo técnico';
    const text = 'Acceso SM Stats (' + label + ') — ' + nombre + '\nEnlace: ' + accessLink() +
      '\nUsuario: ' + creds.username + '\nContraseña: ' + creds.password;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        SM.ui.toast('Acceso copiado al portapapeles.', 'ok');
      }).catch(function () { SM.ui.toast('No se pudo copiar. Cópialo manualmente.', 'error'); });
    } else {
      SM.ui.toast('Usuario: ' + creds.username + ' · Contraseña: ' + creds.password, 'ok');
    }
  }

  function rowHtml(id, nombre, tipo, creds, kind) {
    return (
      '<tr>' +
        '<td style="text-align:left;font-weight:700;color:var(--text-strong);">' + esc(nombre) + '</td>' +
        '<td style="text-align:left;">' + tipo + '</td>' +
        '<td style="font-family:monospace;letter-spacing:0.5px;">' + esc(creds.username) + '</td>' +
        '<td style="font-family:monospace;letter-spacing:0.5px;">' + esc(creds.password) + '</td>' +
        '<td><button type="button" class="btn btn-outline copy-access-btn" data-id="' + id + '" data-kind="' + kind + '" style="padding:6px 16px;font-size:11.5px;">Copiar acceso</button></td>' +
      '</tr>'
    );
  }

  // Esqueleto fijo (cabecera + buscador) montado una vez; renderTables()
  // solo reescribe las dos tablas en cada tecleo, para que el buscador no
  // pierda el foco en cada letra.
  function render() {
    main.innerHTML =
      '<div class="page-header">' +
        '<div><div class="page-title">Usuarios</div><div class="page-subtitle">Accesos derivados de jugadores y staff — solo visible para ti</div></div>' +
        '<button type="button" class="btn btn-primary" id="add-user-btn">+ Añadir usuario</button>' +
      '</div>' +
      '<div class="form-hint" style="margin-top:-8px;margin-bottom:18px;">Solo para cuerpo técnico/directiva — los jugadores se dan de alta desde Plantilla, su acceso se deriva solo de su ficha.</div>' +
      '<div class="search-box" style="margin-bottom:18px;max-width:340px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7382" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
        '<input id="search" type="text" placeholder="Buscar por nombre..."></div>' +
      '<div id="staff-panel" class="panel" style="overflow-x:auto;margin-bottom:20px;"></div>' +
      '<div id="players-panel" class="panel" style="overflow-x:auto;"></div>';

    document.getElementById('add-user-btn').addEventListener('click', function () {
      SM.forms.openStaffForm(null, function (data) {
        DATA = SM.team.filterData(data, SM.team.current());
        renderTables();
      });
    });
    document.getElementById('search').addEventListener('input', function (e) {
      search = e.target.value;
      renderTables();
    });
    renderTables();
  }

  function renderTables() {
    const staff = (DATA.staff || []).slice().sort(function (a, b) { return (a.nombre || '').localeCompare(b.nombre || ''); });
    const players = (DATA.players || []).filter(function (p) { return p.activo; })
      .sort(function (a, b) { return (a.categoria || '').localeCompare(b.categoria || '') || (a.dorsal || 99) - (b.dorsal || 99); });

    const q = search.trim().toLowerCase();
    const staffFiltered = staff.filter(function (s) { return !q || s.nombre.toLowerCase().indexOf(q) !== -1; });
    const playersFiltered = players.filter(function (p) { return !q || p.nombre.toLowerCase().indexOf(q) !== -1; });

    const staffRows = staffFiltered.map(function (s) {
      const creds = SM.auth.staffCredentials(s);
      const tipo = esc(s.rol || 'Staff') + (s.es_directiva ? ' <span class="badge" style="background:' + SM.ui.alpha('var(--amber)', 0.14) + ';border:1px solid ' + SM.ui.alpha('var(--amber)', 0.5) + ';color:var(--amber-bright);margin-left:6px;">DIRECTIVA</span>' : '');
      return rowHtml(s.id, s.nombre, tipo, creds, s.es_directiva ? 'directiva' : 'staff');
    }).join('');
    const playerRows = playersFiltered.map(function (p) {
      const creds = SM.auth.playerCredentials(p);
      return rowHtml(p.id, p.nombre, 'Familia · ' + esc(p.categoria || ''), creds, 'player');
    }).join('');

    document.getElementById('staff-panel').innerHTML =
      '<span class="panel-title">Cuerpo técnico (' + staff.length + ')</span>' +
      (staffRows ?
        '<table class="data-table" style="margin-top:12px;min-width:640px;">' +
          '<thead><tr><th style="text-align:left;">Nombre</th><th style="text-align:left;">Rol</th><th>Usuario</th><th>Contraseña</th><th></th></tr></thead>' +
          '<tbody>' + staffRows + '</tbody>' +
        '</table>'
        : '<div class="empty-state">Sin resultados.</div>');

    document.getElementById('players-panel').innerHTML =
      '<span class="panel-title">Familias / jugadores (' + players.length + ')</span>' +
      (playerRows ?
        '<table class="data-table" style="margin-top:12px;min-width:640px;">' +
          '<thead><tr><th style="text-align:left;">Jugador</th><th style="text-align:left;">Categoría</th><th>Usuario</th><th>Contraseña</th><th></th></tr></thead>' +
          '<tbody>' + playerRows + '</tbody>' +
        '</table>'
        : '<div class="empty-state">Sin resultados.</div>');

    main.querySelectorAll('.copy-access-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        const kind = btn.getAttribute('data-kind');
        if (kind === 'player') {
          const p = (DATA.players || []).find(function (x) { return x.id === id; });
          if (p) copyAccess(p.nombre, SM.auth.playerCredentials(p), 'player');
        } else {
          const s = (DATA.staff || []).find(function (x) { return x.id === id; });
          if (s) copyAccess(s.nombre, SM.auth.staffCredentials(s), kind);
        }
      });
    });
  }

  SM.api.fetchAll().then(function (data) {
    DATA = SM.team.filterData(data, SM.team.current());
    SM.sidebar.applySettings(data.settings);
    render();
  }).catch(function (err) {
    main.innerHTML = '<div class="empty-state">' + err.message + '</div>';
  });
})();
