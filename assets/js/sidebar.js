/* SM Stats — shared sidebar navigation */

window.SM = window.SM || {};

SM.sidebar = (function () {
  const ICONS = {
    inicio: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9"/><path d="M9.5 20v-5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V20"/>',
    plantilla: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 19.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="8.5" r="2.6"/><path d="M15.8 13.7c2.9.3 5.2 2.5 5.2 5.8"/>',
    asistencia: '<rect x="3.5" y="5" width="17" height="16" rx="2.4"/><path d="M3.5 9.5h17"/><path d="M8 3v4M16 3v4"/><path d="M8.5 13.3l2 2 4.2-4.4"/>',
    partidos: '<circle cx="12" cy="12" r="9"/><path d="M12 6.6 15.4 9l-1.3 3.9H9.9L8.6 9zM12 3v3.6M12 20.9V17.4M3.6 9.8l3.4 1.1M17 12.9l3.4 1.1M6.6 18.4l1.7-3M15.7 8.6l1.7-3"/>',
    estadisticas: '<path d="M4 20V10M11 20V4M18 20v-7"/><path d="M2.5 20h19"/>'
  };

  const ITEMS = [
    { key: 'inicio', label: 'Inicio', href: 'index.html' },
    { key: 'plantilla', label: 'Plantilla', href: 'plantilla.html' },
    { key: 'asistencia', label: 'Asistencia', href: 'asistencia.html' },
    { key: 'partidos', label: 'Partidos', href: 'partidos.html' },
    { key: 'estadisticas', label: 'Estadísticas', href: 'estadisticas.html' }
  ];

  function icon(key, size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      ICONS[key] + '</svg>';
  }

  function render(activeKey) {
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
            '<span class="club">CD Ribera</span>' +
          '</div>' +
        '</div>' +
        '<div class="sidebar-rule"></div>' +
        '<nav class="sidebar-nav">' + nav + '</nav>' +
        '<div class="sidebar-footer">' +
          '<div class="sidebar-rule" style="margin:0 0 16px 0;"></div>' +
          '<div class="sidebar-user">' +
            '<div class="sidebar-user-avatar">MV</div>' +
            '<div class="sidebar-user-text">' +
              '<span class="name">Marcos Vidal</span>' +
              '<span class="role">Entrenador</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</aside>'
    );
  }

  // Injects the sidebar as the first child of the given shell element.
  function mount(shellEl, activeKey) {
    shellEl.insertAdjacentHTML('afterbegin', render(activeKey));
  }

  return { render: render, mount: mount };
})();
