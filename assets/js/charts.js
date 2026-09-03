/* SM Stats — small SVG chart builders (no external library). Each function
   returns an HTML string ready to insert into the DOM. */

window.SM = window.SM || {};

SM.charts = (function () {
  // Circular gauge, e.g. weekly/monthly attendance %.
  function ringGauge(pct, opts) {
    opts = opts || {};
    const size = opts.size || 150;
    const stroke = opts.stroke || 14;
    const color = opts.color || 'var(--cyan)';
    const label = opts.label || '';
    const r = (size - stroke) / 2;
    const c = size / 2;
    const circumference = 2 * Math.PI * r;
    const value = pct == null ? 0 : Math.max(0, Math.min(100, pct));
    const offset = circumference * (1 - value / 100);
    return (
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
        '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="var(--panel-2)" stroke-width="' + stroke + '"/>' +
        '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" ' +
          'stroke-linecap="round" stroke-dasharray="' + circumference.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) + '" ' +
          'transform="rotate(-90 ' + c + ' ' + c + ')" style="filter:drop-shadow(0 0 7px ' + color + ');"/>' +
        '<text x="' + c + '" y="' + (c - 5) + '" text-anchor="middle" font-family="Orbitron, sans-serif" font-weight="800" ' +
          'font-size="26" fill="var(--text-strong)">' + (pct == null ? '—' : pct + '%') + '</text>' +
        (label ? '<text x="' + c + '" y="' + (c + 15) + '" text-anchor="middle" font-family="Rajdhani, sans-serif" ' +
          'font-weight="600" font-size="11" fill="var(--text-mute)">' + label + '</text>' : '') +
      '</svg>'
    );
  }

  // Hexagonal radar chart. `attrs` = [{label, value(0-100)}, ...] (exactly 6 for a clean hexagon).
  function radarChart(attrs, opts) {
    opts = opts || {};
    const height = opts.size || 230;
    // viewBox is wider than tall to leave room for the left/right axis labels
    // (DEFENSA, FÍSICO, TIRO, PASE) without clipping them.
    const vbX = -50, vbY = -15, vbW = 300, vbH = 230;
    const width = Math.round(height * (vbW / vbH));
    const color = opts.color || 'var(--magenta)';
    const cx = 100, cy = 100, R = 80;
    const n = attrs.length;
    function pt(i, scale) {
      const angle = -90 + (360 / n) * i;
      const rad = (angle * Math.PI) / 180;
      return { x: cx + Math.cos(rad) * R * scale, y: cy + Math.sin(rad) * R * scale };
    }
    function ring(scale) {
      const pts = attrs.map(function (_, i) { const p = pt(i, scale); return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
      return '<polygon points="' + pts + '" fill="none" stroke="var(--border)" stroke-width="1"/>';
    }
    const axes = attrs.map(function (_, i) {
      const p = pt(i, 1);
      return '<line x1="' + cx + '" y1="' + cy + '" x2="' + p.x.toFixed(1) + '" y2="' + p.y.toFixed(1) + '" stroke="var(--border)" stroke-width="1"/>';
    }).join('');
    const dataPts = attrs.map(function (a, i) {
      const p = pt(i, Math.max(0, Math.min(100, a.value)) / 100);
      return p.x.toFixed(1) + ',' + p.y.toFixed(1);
    }).join(' ');
    const labels = attrs.map(function (a, i) {
      const p = pt(i, 1.16);
      const anchor = Math.abs(p.x - cx) < 8 ? 'middle' : (p.x > cx ? 'start' : 'end');
      return '<text x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) + '" text-anchor="' + anchor + '" ' +
        'font-family="Rajdhani, sans-serif" font-weight="700" font-size="11" fill="var(--text-dim)">' + a.label + '</text>';
    }).join('');
    return (
      '<svg width="' + width + '" height="' + height + '" viewBox="' + vbX + ' ' + vbY + ' ' + vbW + ' ' + vbH + '">' +
        ring(1) + ring(0.75) + ring(0.5) + axes +
        '<polygon points="' + dataPts + '" fill="' + color + '" fill-opacity="0.22" stroke="' + color + '" stroke-width="2" ' +
          'style="filter:drop-shadow(0 0 6px ' + color + ');"/>' +
        labels +
      '</svg>'
    );
  }

  // Line + area evolution chart. `points` = [{label, value}], value on a 0-10 scale by default.
  function evolutionChart(points, opts) {
    opts = opts || {};
    const w = opts.width || 320, h = opts.height || 155;
    const color = opts.color || 'var(--magenta)';
    const min = opts.min != null ? opts.min : 6;
    const max = opts.max != null ? opts.max : 10;
    const padX = 20, top = 15, bottom = 120;
    const n = points.length;
    if (!n) return '<div class="empty-state">Sin datos todavía</div>';
    const stepX = n > 1 ? (w - padX * 2) / (n - 1) : 0;
    function xAt(i) { return padX + stepX * i; }
    function yAt(v) {
      const clamped = Math.max(min, Math.min(max, v));
      return bottom - ((clamped - min) / (max - min)) * (bottom - top);
    }
    const coords = points.map(function (p, i) { return { x: xAt(i), y: yAt(p.value) }; });
    const linePts = coords.map(function (c) { return c.x.toFixed(1) + ',' + c.y.toFixed(1); }).join(' ');
    const areaPath = 'M' + coords.map(function (c) { return c.x.toFixed(1) + ',' + c.y.toFixed(1); }).join(' L') +
      ' L' + coords[coords.length - 1].x.toFixed(1) + ',' + bottom + ' L' + coords[0].x.toFixed(1) + ',' + bottom + ' Z';
    const gradId = 'evoFill' + Math.random().toString(36).slice(2, 8);
    const dots = coords.map(function (c, i) {
      const last = i === coords.length - 1;
      return '<circle cx="' + c.x.toFixed(1) + '" cy="' + c.y.toFixed(1) + '" r="' + (last ? 4 : 3.5) + '" ' +
        (last ? 'fill="' + color + '"' : 'fill="var(--bg)" stroke="' + color + '" stroke-width="2"') + '/>';
    }).join('');
    const labels = points.map(function (p, i) {
      return '<text x="' + xAt(i).toFixed(1) + '" y="' + (bottom + 20) + '" text-anchor="middle" ' +
        'font-family="Rajdhani, sans-serif" font-weight="600" font-size="11" fill="var(--text-mute)">' + p.label + '</text>';
    }).join('');
    return (
      '<svg width="100%" height="' + h + '" viewBox="0 0 ' + w + ' ' + (h - 20) + '">' +
        '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.35"/>' +
          '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/>' +
        '</linearGradient></defs>' +
        '<line x1="' + padX + '" y1="' + bottom + '" x2="' + (w - padX) + '" y2="' + bottom + '" stroke="var(--border)" stroke-width="1"/>' +
        '<path d="' + areaPath + '" fill="url(#' + gradId + ')"/>' +
        '<polyline points="' + linePts + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linecap="round" ' +
          'stroke-linejoin="round" style="filter:drop-shadow(0 0 5px ' + color + ');"/>' +
        dots + labels +
      '</svg>'
    );
  }

  // Horizontal bar list — [{label, value, display}], sorted by caller.
  function barList(rows, opts) {
    opts = opts || {};
    const color = opts.color || 'var(--green)';
    const max = opts.max || Math.max.apply(null, rows.map(function (r) { return r.value; }).concat([1]));
    return rows.map(function (r, i) {
      const pct = max ? Math.round((r.value / max) * 100) : 0;
      return (
        '<div style="display:flex;align-items:center;gap:12px;">' +
          '<span style="width:18px;font-family:var(--font-display);font-size:11px;color:var(--text-ghost);font-weight:700;">' + (i + 1) + '</span>' +
          '<span style="width:130px;font-size:13.5px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + SM.ui.escapeHtml(r.label) + '</span>' +
          '<div class="bar-track thick"><div class="bar-fill" style="width:' + pct + '%;background:' + color + ';box-shadow:0 0 8px ' + color + ';"></div></div>' +
          '<span style="width:24px;text-align:right;font-family:var(--font-display);font-size:12.5px;font-weight:700;color:' + color + ';">' + (r.display != null ? r.display : r.value) + '</span>' +
        '</div>'
      );
    }).join('');
  }

  return { ringGauge: ringGauge, radarChart: radarChart, evolutionChart: evolutionChart, barList: barList };
})();
