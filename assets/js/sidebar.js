/* SM Stats — shared sidebar navigation */

window.SM = window.SM || {};

SM.sidebar = (function () {
  const ICONS = {
    inicio: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9"/><path d="M9.5 20v-5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V20"/>',
    plantilla: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 19.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="8.5" r="2.6"/><path d="M15.8 13.7c2.9.3 5.2 2.5 5.2 5.8"/>',
    asistencia: '<rect x="3.5" y="5" width="17" height="16" rx="2.4"/><path d="M3.5 9.5h17"/><path d="M8 3v4M16 3v4"/><path d="M8.5 13.3l2 2 4.2-4.4"/>',
    calendario: '<rect x="3.5" y="5" width="17" height="16" rx="2.4"/><path d="M3.5 9.5h17"/><path d="M8 3v4M16 3v4"/><circle cx="8.5" cy="14" r="1.1"/><circle cx="12" cy="14" r="1.1"/><circle cx="15.5" cy="14" r="1.1"/><circle cx="8.5" cy="17.3" r="1.1"/><circle cx="12" cy="17.3" r="1.1"/>',
    partidos: '<circle cx="12" cy="12" r="9"/><path d="M12 6.6 15.4 9l-1.3 3.9H9.9L8.6 9zM12 3v3.6M12 20.9V17.4M3.6 9.8l3.4 1.1M17 12.9l3.4 1.1M6.6 18.4l1.7-3M15.7 8.6l1.7-3"/>',
    convocatorias: '<path d="M8 3.5h8a1.5 1.5 0 0 1 1.5 1.5v15a1.5 1.5 0 0 1-1.5 1.5H8a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 8 3.5Z"/><path d="M9.5 3.5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v.5"/><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4.5"/>',
    estadisticas: '<path d="M4 20V10M11 20V4M18 20v-7"/><path d="M2.5 20h19"/>'
  };

  const ITEMS = [
    { key: 'inicio', label: 'Inicio', href: 'index.html' },
    { key: 'plantilla', label: 'Plantilla', href: 'plantilla.html' },
    { key: 'asistencia', label: 'Asistencia', href: 'asistencia.html' },
    { key: 'calendario', label: 'Calendario', href: 'calendario.html' },
    { key: 'partidos', label: 'Partidos', href: 'partidos.html' },
    { key: 'convocatorias', label: 'Convocatorias', href: 'convocatorias.html' },
    { key: 'estadisticas', label: 'Estadísticas', href: 'estadisticas.html' }
  ];

  // Shown until the real Settings row loads from Sheets (or in demo mode,
  // overwritten immediately by the bundled sample data). Deliberately a
  // neutral placeholder, not a made-up club/coach name, so the brief flash
  // before data arrives never looks like the wrong team's data.
  const DEFAULT_SETTINGS = { club_nombre: 'Cargando…', entrenador_nombre: 'Cargando…', entrenador_rol: '', liga_nombre: '' };

  function icon(key, size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      ICONS[key] + '</svg>';
  }

  function render(activeKey, settings) {
    const s = Object.assign({}, DEFAULT_SETTINGS, settings);
    const nav = ITEMS.map(function (item) {
      return '<a class="nav-item' + (item.key === activeKey ? ' active' : '') + '" href="' + item.href + '">' +
        icon(item.key, 19) + '<span>' + item.label + '</span></a>';
    }).join('');

    return (
      '<aside class="sidebar">' +
        '<div class="sidebar-brand">' +
          '<div class="sidebar-mark"><span>SM</span></div>' +
          '<div class="sidebar-brand-text">' +
            '<span class="name">SM STATS</span>' +
            '<span class="club" id="sidebar-club-name">' + SM.ui.escapeHtml(s.club_nombre) + '</span>' +
          '</div>' +
        '</div>' +
        '<div style="padding:0 20px 14px;">' +
          '<select id="sidebar-team-select" title="Equipo activo" ' +
            'style="width:100%;padding:8px 10px;border-radius:9px;background:var(--panel-2);border:1px solid var(--border-soft);color:var(--text);font-family:var(--font-ui);font-size:12.5px;font-weight:700;cursor:pointer;">' +
            SM.team.CATEGORIES.map(function (c) {
              return '<option value="' + c.key + '"' + (c.key === SM.team.current() ? ' selected' : '') + '>' + c.key + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="sidebar-rule"></div>' +
        '<nav class="sidebar-nav">' + nav + '</nav>' +
        '<div class="sidebar-footer">' +
          '<div class="sidebar-rule" style="margin:0 0 16px 0;"></div>' +
          '<div style="display:flex;align-items:center;gap:6px;">' +
            '<div class="sidebar-user" style="flex:1 1 auto;min-width:0;">' +
              '<div class="sidebar-user-avatar" id="sidebar-user-avatar">' + SM.ui.initials(s.entrenador_nombre) + '</div>' +
              '<div class="sidebar-user-text" style="min-width:0;overflow:hidden;">' +
                '<span class="name" id="sidebar-user-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;">' + SM.ui.escapeHtml(s.entrenador_nombre) + '</span>' +
                '<span class="role" id="sidebar-user-role">' + SM.ui.escapeHtml(s.entrenador_rol) + '</span>' +
              '</div>' +
            '</div>' +
            '<button id="sidebar-settings-btn" type="button" title="Configuración del club" ' +
              'style="flex:none;width:30px;height:30px;border-radius:8px;background:transparent;border:1px solid transparent;color:var(--text-mute);cursor:pointer;display:flex;align-items:center;justify-content:center;">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
                '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>' +
              '</svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</aside>'
    );
  }

  // Injects the sidebar as the first child of the given shell element.
  function mount(shellEl, activeKey) {
    shellEl.insertAdjacentHTML('afterbegin', render(activeKey));
    const btn = document.getElementById('sidebar-settings-btn');
    if (btn) {
      btn.addEventListener('mouseenter', function () { btn.style.background = 'var(--panel-2)'; btn.style.color = 'var(--text)'; });
      btn.addEventListener('mouseleave', function () { btn.style.background = 'transparent'; btn.style.color = 'var(--text-mute)'; });
    }
    const teamSelect = document.getElementById('sidebar-team-select');
    if (teamSelect) {
      teamSelect.addEventListener('change', function (e) {
        SM.team.setCurrent(e.target.value);
        window.location.reload();
      });
    }
  }

  // Call once real settings have loaded (from Sheets or the demo dataset)
  // to replace the placeholder club/coach text painted at mount time.
  function applySettings(settings) {
    if (!settings) return;
    const s = Object.assign({}, DEFAULT_SETTINGS, settings);
    const clubEl = document.getElementById('sidebar-club-name');
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-user-avatar');
    if (clubEl) clubEl.textContent = s.club_nombre;
    if (nameEl) nameEl.textContent = s.entrenador_nombre;
    if (roleEl) roleEl.textContent = s.entrenador_rol;
    if (avatarEl) avatarEl.textContent = SM.ui.initials(s.entrenador_nombre);
  }

  function onSettingsClick(handler) {
    const btn = document.getElementById('sidebar-settings-btn');
    if (btn) btn.addEventListener('click', handler);
  }

  return { render: render, mount: mount, applySettings: applySettings, onSettingsClick: onSettingsClick, DEFAULT_SETTINGS: DEFAULT_SETTINGS };
})();
