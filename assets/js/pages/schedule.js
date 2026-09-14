/* SM Stats — Cuadrante semanal. Tabla de entrenamientos y partidos de la
   semana, con las 4 categorías a la vez (a diferencia del resto de la app,
   que trabaja siempre sobre la categoría activa del selector). Los días de
   entrenamiento no se configuran aquí: salen tal cual de las sesiones que
   ya existen en Calendario (normalmente creadas de una vez para varios
   meses con "+ Nuevas sesiones"), así que un cambio de horario se hace
   allí y esta página simplemente lo refleja. Los partidos de la semana se
   resaltan sobre el hueco del día que les corresponda. Incluye un botón
   para descargar la semana como imagen PNG lista para compartir. */

(function () {
  const shell = document.getElementById('app-shell');
  SM.sidebar.mount(shell, 'cuadrante');
  const main = document.getElementById('main');

  const WEEKDAY_LABELS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  let DATA = null;

  function mondayOf(date) {
    const d = new Date(date);
    const shift = (d.getDay() + 6) % 7; // 0 = lunes
    d.setDate(d.getDate() - shift);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  let weekStart = mondayOf(new Date());

  SM.sidebar.onSettingsClick(function () {
    SM.forms.openSettingsForm(DATA && DATA.settings, function (data) { DATA = data; render(); });
  });

  function weekDates() {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      out.push(SM.ui.formatDateIso(d));
    }
    return out;
  }

  function weekRangeLabel(dates) {
    const start = new Date(dates[0] + 'T00:00:00');
    const end = new Date(dates[6] + 'T00:00:00');
    const sameMonth = start.getMonth() === end.getMonth();
    const startLabel = start.getDate() + (sameMonth ? '' : ' ' + MONTHS[start.getMonth()]);
    return startLabel + ' – ' + end.getDate() + ' ' + MONTHS[end.getMonth()] + ' ' + end.getFullYear();
  }

  // Agrupa las sesiones de todas las categorías de la semana visible por
  // "categoria|fecha", para que montar cada celda sea una búsqueda directa.
  function buildCellMap(dates) {
    const dateSet = {};
    dates.forEach(function (d) { dateSet[d] = true; });
    const map = {};
    (DATA.sessions || []).forEach(function (s) {
      if (!dateSet[s.fecha]) return;
      // Sesiones creadas antes de que existiera multi-equipo no tienen
      // categoria — igual que en team.belongsTo, se tratan como del primer
      // equipo configurado en vez de desaparecer de esta vista.
      const categoria = s.categoria || SM.team.CATEGORIES[0].key;
      const key = categoria + '|' + s.fecha;
      (map[key] = map[key] || []).push(s);
    });
    return map;
  }

  // Un partido ese día pesa más que un entrenamiento normal (es la
  // excepción a la semana fija, justo lo que hay que destacar).
  function cellFor(cellMap, matchesById, categoria, fecha) {
    const sessions = cellMap[categoria + '|' + fecha] || [];
    const matchSession = sessions.filter(function (s) { return s.tipo === 'partido'; })[0];
    if (matchSession) {
      const match = matchesById[matchSession.match_id];
      return {
        kind: 'partido',
        hora: matchSession.hora || (match && match.hora) || '',
        lugar: matchSession.lugar || (match && match.lugar) || '',
        rival: match ? match.rival : '',
        competicion: match ? match.competicion : ''
      };
    }
    const training = sessions.filter(function (s) { return s.tipo === 'entrenamiento'; })[0];
    if (training) return { kind: 'entreno', hora: training.hora || '', lugar: training.lugar || '' };
    return null;
  }

  function render() {
    const dates = weekDates();
    const cellMap = buildCellMap(dates);
    const matchesById = SM.stats.byId(DATA.matches);
    const todayStr = SM.ui.formatDateIso(new Date());

    main.innerHTML =
      '<div class="page-header">' +
        '<div><div class="page-title">Cuadrante semanal</div><div class="page-subtitle">Entrenamientos y partidos de la semana, todas las categorías</div></div>' +
        '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">' +
          '<div style="display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:10px;background:var(--panel);border:1px solid var(--border-soft);">' +
            '<button id="prev-week" style="background:none;border:none;color:#8a93a3;cursor:pointer;display:flex;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>' +
            '<span style="font-size:13.5px;font-weight:700;color:var(--text);width:160px;text-align:center;">' + weekRangeLabel(dates) + '</span>' +
            '<button id="next-week" style="background:none;border:none;color:#8a93a3;cursor:pointer;display:flex;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>' +
          '</div>' +
          '<button id="download-btn" class="btn btn-primary">⬇ Descargar cuadrante</button>' +
        '</div>' +
      '</div>' +

      '<div style="display:flex;align-items:center;gap:22px;">' +
        '<div style="display:flex;align-items:center;gap:8px;"><div class="dot" style="background:var(--cyan);"></div><span style="font-size:12.5px;color:var(--text-dim);font-weight:600;">Entrenamiento</span></div>' +
        '<div style="display:flex;align-items:center;gap:8px;"><div class="dot" style="background:var(--magenta);"></div><span style="font-size:12.5px;color:var(--text-dim);font-weight:600;">Partido</span></div>' +
      '</div>' +

      '<div class="form-hint">Los días de entrenamiento salen de las sesiones ya creadas en Calendario — para cambiarlos, edítalas desde allí (normalmente no hace falta tocarlo semana a semana).</div>' +

      '<div class="panel" style="padding:18px;overflow-x:auto;">' + tableHtml(dates, cellMap, matchesById, todayStr) + '</div>';

    document.getElementById('prev-week').addEventListener('click', function () { shiftWeek(-1); });
    document.getElementById('next-week').addEventListener('click', function () { shiftWeek(1); });
    document.getElementById('download-btn').addEventListener('click', function () { downloadSchedule(dates, cellMap, matchesById); });
  }

  function shiftWeek(deltaWeeks) {
    weekStart = new Date(weekStart);
    weekStart.setDate(weekStart.getDate() + deltaWeeks * 7);
    render();
  }

  function cellChipHtml(cell) {
    const isMatch = cell.kind === 'partido';
    const color = isMatch ? 'var(--magenta)' : 'var(--cyan)';
    const lines = isMatch
      ? [
          '<span style="font-size:9.5px;font-weight:700;letter-spacing:.4px;color:' + color + ';">' + SM.ui.escapeHtml((SM.ui.competitionLabel(cell.competicion) || 'Partido').toUpperCase()) + '</span>',
          '<span style="font-size:12px;font-weight:700;color:var(--text);">vs ' + SM.ui.escapeHtml(cell.rival || '?') + '</span>',
          (cell.hora || cell.lugar) ? '<span style="font-size:10.5px;font-weight:600;color:var(--text-dim);">' + SM.ui.escapeHtml([cell.hora, cell.lugar].filter(Boolean).join(' · ')) + '</span>' : ''
        ]
      : [
          '<span style="font-size:12px;font-weight:700;color:' + color + ';">' + SM.ui.escapeHtml(cell.hora || '') + '</span>',
          cell.lugar ? '<span style="font-size:10.5px;font-weight:600;color:var(--text-dim);">' + SM.ui.escapeHtml(cell.lugar) + '</span>' : ''
        ];
    return (
      '<div style="width:100%;padding:8px;border-radius:8px;background:' + SM.ui.alpha(color, 0.14) + ';border:1px solid ' + SM.ui.alpha(color, 0.4) + ';display:flex;flex-direction:column;gap:3px;justify-content:center;">' +
        lines.filter(Boolean).join('') +
      '</div>'
    );
  }

  function tableHtml(dates, cellMap, matchesById, todayStr) {
    const dayHeaders = dates.map(function (d, i) {
      const isToday = d === todayStr;
      const dayNum = Number(d.slice(8, 10));
      return (
        '<div style="text-align:center;padding:6px 4px;">' +
          '<div style="font-size:10px;font-weight:700;letter-spacing:.5px;color:var(--text-ghost);">' + WEEKDAY_LABELS[i] + '</div>' +
          '<div style="font-size:13px;font-weight:700;color:' + (isToday ? 'var(--cyan-bright)' : 'var(--text-dim)') + ';">' + dayNum + '</div>' +
        '</div>'
      );
    }).join('');

    const rows = SM.team.CATEGORIES.map(function (cat) {
      const cells = dates.map(function (d) {
        const cell = cellFor(cellMap, matchesById, cat.key, d);
        return '<div style="min-height:74px;display:flex;align-items:stretch;">' + (cell ? cellChipHtml(cell) : '<div style="width:100%;"></div>') + '</div>';
      }).join('');
      return (
        '<div style="display:contents;">' +
          '<div style="display:flex;align-items:center;font-size:12.5px;font-weight:700;color:var(--text);padding:8px 10px 8px 0;">' + SM.ui.escapeHtml(cat.key) + '</div>' +
          cells +
        '</div>'
      );
    }).join('');

    return (
      '<div style="display:grid;grid-template-columns:130px repeat(7,minmax(120px,1fr));gap:8px;min-width:920px;">' +
        '<div></div>' + dayHeaders +
        rows +
      '</div>'
    );
  }

  // ---- exportar como imagen (PNG) ----

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fitText(ctx, text, maxWidth) {
    if (!text) return '';
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
    return t + '…';
  }

  const CANVAS_COLORS = {
    bg: '#0a0c10',
    panel2: '#171c25',
    border: '#232a36',
    text: '#e8ecf1',
    textDim: '#8a93a3',
    textGhost: '#4b5261',
    cyan: 'oklch(0.80 0.15 205)',
    cyanFill: 'oklch(0.80 0.15 205 / 0.16)',
    cyanBorder: 'oklch(0.80 0.15 205 / 0.45)',
    magenta: 'oklch(0.72 0.22 335)',
    magentaFill: 'oklch(0.72 0.22 335 / 0.16)',
    magentaBorder: 'oklch(0.72 0.22 335 / 0.45)'
  };

  function buildScheduleCanvas(dates, cellMap, matchesById) {
    const scale = 2; // más nítido al compartir por WhatsApp
    const pad = 64;
    const labelW = 170;
    const width = 1360;
    const dayW = Math.floor((width - pad * 2 - labelW) / 7);
    const headerH = 130;
    const dayHeaderH = 54;
    const rowH = 132;
    const height = pad + headerH + dayHeaderH + rowH * SM.team.CATEGORIES.length + pad;

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    ctx.fillStyle = CANVAS_COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    const clubName = (DATA.settings && DATA.settings.club_nombre) || 'SM Stats';
    ctx.textAlign = 'left';
    ctx.fillStyle = CANVAS_COLORS.text;
    ctx.font = "800 28px 'Orbitron', sans-serif";
    ctx.fillText(clubName.toUpperCase(), pad, pad + 28);

    ctx.fillStyle = CANVAS_COLORS.textDim;
    ctx.font = "600 15px 'Rajdhani', sans-serif";
    ctx.fillText('Cuadrante semanal de entrenamientos y partidos', pad, pad + 55);

    ctx.fillStyle = CANVAS_COLORS.cyan;
    ctx.font = "700 15px 'Rajdhani', sans-serif";
    ctx.fillText(weekRangeLabel(dates).toUpperCase(), pad, pad + 85);

    const tableTop = pad + headerH;

    dates.forEach(function (d, i) {
      const x = pad + labelW + i * dayW;
      const dayNum = Number(d.slice(8, 10));
      ctx.textAlign = 'center';
      ctx.fillStyle = CANVAS_COLORS.textGhost;
      ctx.font = "700 11px 'Rajdhani', sans-serif";
      ctx.fillText(WEEKDAY_LABELS[i], x + dayW / 2, tableTop + 18);
      ctx.fillStyle = CANVAS_COLORS.textDim;
      ctx.font = "700 16px 'Rajdhani', sans-serif";
      ctx.fillText(String(dayNum), x + dayW / 2, tableTop + 40);
    });

    const gridTop = tableTop + dayHeaderH;

    SM.team.CATEGORIES.forEach(function (cat, rowIdx) {
      const y = gridTop + rowIdx * rowH;

      ctx.textAlign = 'left';
      ctx.fillStyle = CANVAS_COLORS.text;
      ctx.font = "700 16px 'Rajdhani', sans-serif";
      ctx.fillText(cat.key, pad, y + rowH / 2 + 5);

      dates.forEach(function (d, colIdx) {
        const x = pad + labelW + colIdx * dayW;
        const cellX = x + 6, cellY = y + 6, cellW = dayW - 12, cellH = rowH - 12;
        const cell = cellFor(cellMap, matchesById, cat.key, d);

        ctx.fillStyle = CANVAS_COLORS.panel2;
        roundRect(ctx, cellX, cellY, cellW, cellH, 8);
        ctx.fill();
        ctx.strokeStyle = CANVAS_COLORS.border;
        ctx.lineWidth = 1;
        roundRect(ctx, cellX, cellY, cellW, cellH, 8);
        ctx.stroke();

        if (!cell) return;
        const isMatch = cell.kind === 'partido';
        const accent = isMatch ? CANVAS_COLORS.magenta : CANVAS_COLORS.cyan;

        ctx.fillStyle = isMatch ? CANVAS_COLORS.magentaFill : CANVAS_COLORS.cyanFill;
        roundRect(ctx, cellX, cellY, cellW, cellH, 8);
        ctx.fill();
        ctx.strokeStyle = isMatch ? CANVAS_COLORS.magentaBorder : CANVAS_COLORS.cyanBorder;
        roundRect(ctx, cellX, cellY, cellW, cellH, 8);
        ctx.stroke();

        const textX = cellX + 10;
        const maxTextW = cellW - 20;
        let textY = cellY + 24;

        if (isMatch) {
          ctx.fillStyle = accent;
          ctx.font = "700 10px 'Rajdhani', sans-serif";
          ctx.fillText(fitText(ctx, (SM.ui.competitionLabel(cell.competicion) || 'PARTIDO').toUpperCase(), maxTextW), textX, textY);
          textY += 20;
          ctx.fillStyle = CANVAS_COLORS.text;
          ctx.font = "700 14px 'Rajdhani', sans-serif";
          ctx.fillText(fitText(ctx, 'vs ' + (cell.rival || '?'), maxTextW), textX, textY);
          textY += 19;
          ctx.fillStyle = CANVAS_COLORS.textDim;
          ctx.font = "600 12px 'Rajdhani', sans-serif";
          ctx.fillText(fitText(ctx, [cell.hora, cell.lugar].filter(Boolean).join(' · '), maxTextW), textX, textY);
        } else {
          ctx.fillStyle = accent;
          ctx.font = "700 15px 'Rajdhani', sans-serif";
          ctx.fillText(cell.hora || '', textX, textY);
          textY += 21;
          ctx.fillStyle = CANVAS_COLORS.textDim;
          ctx.font = "600 12px 'Rajdhani', sans-serif";
          ctx.fillText(fitText(ctx, cell.lugar || '', maxTextW), textX, textY);
        }
      });
    });

    return canvas;
  }

  function downloadSchedule(dates, cellMap, matchesById) {
    // Sin esperar a que las fuentes estén listas, el canvas puede dibujar
    // el texto con la tipografía por defecto del navegador la primera vez.
    document.fonts.ready.then(function () {
      const canvas = buildScheduleCanvas(dates, cellMap, matchesById);
      const link = document.createElement('a');
      link.download = 'cuadrante-semanal-' + dates[0] + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }

  SM.api.fetchAll().then(function (data) {
    DATA = data;
    SM.sidebar.applySettings(data.settings);
    render();
  }).catch(function (err) {
    main.innerHTML = '<div class="empty-state">' + err.message + '</div>';
  });
})();
