/* SM Stats — mini campo de fútbol neon reutilizable.
   Usado para marcar posición principal/secundarias en la ficha de
   jugador (y pensado para una futura pizarra táctica del 7 inicial). */

window.SM = window.SM || {};

SM.pitch = (function () {
  // 1-2-2-2 (7 puntos, fútbol 7): 1 portero, 2 defensas, 2 centrocampistas,
  // 2 delanteros. Varios puntos comparten grupo (ej. los dos DEF) — clicar
  // cualquiera de ellos etiqueta el grupo entero, no una plaza individual.
  const ZONES = [
    { code: 'POR', x: 50, y: 92 },
    { code: 'DEF', x: 25, y: 68 },
    { code: 'DEF', x: 75, y: 68 },
    { code: 'CEN', x: 25, y: 42 },
    { code: 'CEN', x: 75, y: 42 },
    { code: 'DEL', x: 30, y: 15 },
    { code: 'DEL', x: 70, y: 15 }
  ];

  function pitchMarkings() {
    return (
      '<rect x="2" y="2" width="96" height="126" rx="4" fill="oklch(0.24 0.05 150 / 0.35)" stroke="oklch(0.55 0.12 150 / 0.5)" stroke-width="1"/>' +
      '<line x1="2" y1="65" x2="98" y2="65" stroke="oklch(0.55 0.12 150 / 0.4)" stroke-width="0.8"/>' +
      '<circle cx="50" cy="65" r="14" fill="none" stroke="oklch(0.55 0.12 150 / 0.4)" stroke-width="0.8"/>' +
      '<rect x="24" y="2" width="52" height="16" fill="none" stroke="oklch(0.55 0.12 150 / 0.4)" stroke-width="0.8"/>' +
      '<rect x="24" y="112" width="52" height="16" fill="none" stroke="oklch(0.55 0.12 150 / 0.4)" stroke-width="0.8"/>'
    );
  }

  // Marcado plano (blanco/negro), sin neón — usado en la convocatoria
  // imprimible, donde el fondo del papel es blanco.
  function pitchMarkingsPlain() {
    return (
      '<rect x="2" y="2" width="96" height="126" rx="4" fill="#fff" stroke="#000" stroke-width="1"/>' +
      '<line x1="2" y1="65" x2="98" y2="65" stroke="#000" stroke-width="0.8"/>' +
      '<circle cx="50" cy="65" r="14" fill="none" stroke="#000" stroke-width="0.8"/>' +
      '<rect x="24" y="2" width="52" height="16" fill="none" stroke="#000" stroke-width="0.8"/>' +
      '<rect x="24" y="112" width="52" height="16" fill="none" stroke="#000" stroke-width="0.8"/>'
    );
  }

  // state: { primary: 'DEF'|null, secondary: ['CEN', ...] }
  // opts: { interactive: bool, width: number }
  function render(state, opts) {
    opts = opts || {};
    state = state || { primary: null, secondary: [] };
    const secondary = state.secondary || [];
    const w = opts.width || 200;
    const h = Math.round(w * 1.3);

    const dots = ZONES.map(function (z, i) {
      const meta = SM.ui.positionMeta(z.code);
      const isPrimary = state.primary === z.code;
      const isSecondary = !isPrimary && secondary.indexOf(z.code) !== -1;
      const r = isPrimary ? 11 : 8;
      const glow = isPrimary ? 'filter:drop-shadow(0 0 6px ' + meta.color + ');' : isSecondary ? 'filter:drop-shadow(0 0 3px ' + meta.color + ');' : '';
      return (
        '<g class="pitch-dot" data-zone="' + i + '" data-group="' + z.code + '" style="cursor:' + (opts.interactive ? 'pointer' : 'default') + ';">' +
          '<circle cx="' + z.x + '" cy="' + z.y + '" r="' + (r + 6) + '" fill="transparent"/>' +
          '<circle cx="' + z.x + '" cy="' + z.y + '" r="' + r + '" fill="' + ((isPrimary || isSecondary) ? meta.color : 'var(--panel-2)') + '" fill-opacity="' + ((isPrimary || isSecondary) ? 0.85 : 0.6) + '" stroke="' + meta.color + '" stroke-width="' + (isPrimary ? 2.4 : 1.4) + '" style="' + glow + '"/>' +
        '</g>'
      );
    }).join('');

    return (
      '<svg viewBox="0 0 100 130" width="' + w + '" height="' + h + '" style="overflow:visible;flex:none;">' +
        pitchMarkings() + dots +
      '</svg>'
    );
  }

  // Cycle per group on click: sin marcar -> secundaria -> principal
  // (degradando la principal anterior a secundaria) -> sin marcar.
  function toggle(state, group) {
    const secondary = (state.secondary || []).slice();
    if (state.primary === group) {
      return { primary: null, secondary: secondary };
    }
    const idx = secondary.indexOf(group);
    if (idx !== -1) {
      secondary.splice(idx, 1);
      if (state.primary) secondary.push(state.primary);
      return { primary: group, secondary: secondary };
    }
    secondary.push(group);
    return { primary: state.primary || null, secondary: secondary };
  }

  // Evenly spaces n dots across a row, within [12, 88] on the 0-100 viewBox.
  function rowXs(n) {
    if (n <= 1) return [50];
    const step = (88 - 12) / (n - 1);
    const xs = [];
    for (let i = 0; i < n; i++) xs.push(12 + step * i);
    return xs;
  }

  function shortLabel(nombre) {
    const parts = (nombre || '').trim().split(/\s+/);
    return parts[0] + (parts[1] ? ' ' + parts[1][0] + '.' : '');
  }

  // Auto-filled starting 7 (fútbol 7) — one row per position group, with
  // as many dots as players started in that group (no fixed 1-2-2-2
  // assumption, since a coach's real formation varies match to match).
  // players: array of exactly 7 {nombre, dorsal, posicion}.
  // Siempre en blanco/negro plano: esto solo se usa en la hoja de
  // convocatoria imprimible (fondo de papel blanco).
  function renderLineup(players, opts) {
    opts = opts || {};
    const w = opts.width || 260;
    const h = Math.round(w * 1.3);
    const rowY = { POR: 90, DEF: 68, CEN: 44, DEL: 21 };
    const labelBelow = { POR: true, DEF: true, CEN: false, DEL: false };
    const groups = { POR: [], DEF: [], CEN: [], DEL: [] };
    (players || []).forEach(function (p) { (groups[p.posicion] || groups.CEN).push(p); });

    let dots = '';
    ['POR', 'DEF', 'CEN', 'DEL'].forEach(function (code) {
      const list = groups[code];
      if (!list.length) return;
      const xs = rowXs(list.length);
      const y = rowY[code];
      const labelY = y + (labelBelow[code] ? 13 : -12);
      list.forEach(function (p, i) {
        const x = xs[i];
        dots += (
          '<g>' +
            '<circle cx="' + x + '" cy="' + y + '" r="9" fill="#fff" stroke="#000" stroke-width="1.5"/>' +
            '<text x="' + x + '" y="' + (y + 2.6) + '" text-anchor="middle" font-size="6.5" font-weight="800" fill="#000">' + (p.dorsal != null ? p.dorsal : '') + '</text>' +
            '<text x="' + x + '" y="' + labelY + '" text-anchor="middle" font-size="5.4" font-weight="700" fill="#000">' + SM.ui.escapeHtml(shortLabel(p.nombre)) + '</text>' +
          '</g>'
        );
      });
    });

    return (
      '<svg viewBox="0 0 100 130" width="' + w + '" height="' + h + '" style="overflow:visible;flex:none;">' +
        pitchMarkingsPlain() + dots +
      '</svg>'
    );
  }

  return { ZONES: ZONES, render: render, toggle: toggle, renderLineup: renderLineup };
})();
