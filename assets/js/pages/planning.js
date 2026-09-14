/* SM Stats — Planificación (objetivos de entrenamiento del cuerpo técnico).
   Vista de calendario mensual, igual que calendario.html: cada día muestra
   un punto de color por cada tipo de objetivo que tiene contenido (técnico,
   táctico, físico, valores, porteros). Al hacer clic en un día se abre un
   modal para escribir/editar/borrar esos 5 campos de texto libre. Solo
   visible en la app del cuerpo técnico — las familias nunca ven la barra
   lateral ni esta página. */

(function () {
  const shell = document.getElementById('app-shell');
  SM.sidebar.mount(shell, 'planificacion');
  const main = document.getElementById('main');

  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const WEEKDAY_LABELS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

  const PLAN_TYPES = [
    { key: 'tecnico', label: 'Técnico', color: 'var(--cyan)' },
    { key: 'tactico', label: 'Táctico', color: 'var(--magenta)' },
    { key: 'fisico', label: 'Físico', color: 'var(--green)' },
    { key: 'valores', label: 'Valores', color: 'var(--amber)' },
    { key: 'porteros', label: 'Porteros', color: 'var(--orange)' }
  ];

  let DATA = null;
  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();

  SM.sidebar.onSettingsClick(function () {
    SM.forms.openSettingsForm(DATA && DATA.settings, function (data) { DATA = SM.team.filterData(data, SM.team.current()); render(); });
  });

  function hasContent(entry, key) {
    return !!(entry && entry[key] && String(entry[key]).trim());
  }

  function render() {
    const byDate = {};
    (DATA.planEntries || []).forEach(function (pe) { byDate[pe.fecha] = pe; });

    main.innerHTML =
      '<div class="page-header">' +
        '<div><div class="page-title">Planificación</div><div class="page-subtitle">Objetivos de entrenamiento del cuerpo técnico, día a día</div></div>' +
        '<div style="display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:10px;background:var(--panel);border:1px solid var(--border-soft);">' +
          '<button id="prev-month" style="background:none;border:none;color:#8a93a3;cursor:pointer;display:flex;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>' +
          '<span style="font-size:13.5px;font-weight:700;color:var(--text);width:120px;text-align:center;">' + MONTHS[viewMonth] + ' ' + viewYear + '</span>' +
          '<button id="next-month" style="background:none;border:none;color:#8a93a3;cursor:pointer;display:flex;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>' +
        '</div>' +
      '</div>' +

      '<div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;">' +
        PLAN_TYPES.map(function (t) {
          return '<div style="display:flex;align-items:center;gap:8px;"><div class="dot" style="background:' + t.color + ';"></div><span style="font-size:12.5px;color:var(--text-dim);font-weight:600;">' + t.label + '</span></div>';
        }).join('') +
      '</div>' +

      '<div class="form-hint">Haz clic en cualquier día para añadir o editar sus objetivos.</div>' +

      '<div style="display:grid;grid-template-columns:1fr 340px;gap:20px;align-items:start;">' +
        '<div class="panel" style="padding:18px;">' + gridHtml(byDate) + '</div>' +
        breakdownHtml() +
      '</div>';

    document.getElementById('prev-month').addEventListener('click', function () { shiftMonth(-1); });
    document.getElementById('next-month').addEventListener('click', function () { shiftMonth(1); });
    main.querySelectorAll('[data-plan-day]').forEach(function (cell) {
      cell.addEventListener('click', function () {
        const dateStr = cell.getAttribute('data-plan-day');
        openPlanModal(dateStr, byDate[dateStr]);
      });
    });
  }

  // Un campo puede contener varios objetivos sueltos (p. ej. "pase, control,
  // conducción" o uno por línea) — se separan por comas y saltos de línea
  // para contabilizar cada uno por separado, no el campo entero como un bloque.
  function splitObjectives(text) {
    return String(text).split(/[,\n]+/).map(function (s) { return s.trim(); }).filter(function (s) { return s; });
  }

  // Pone en mayúscula la primera letra, para que "pase" y "Pase" se vean
  // igual de cuidados en el panel aunque el entrenador no lo escriba así.
  function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  // Agrupa los objetivos idénticos (mismo texto, sin distinguir mayúsculas)
  // dentro de una categoría, para que uno repetido varias veces se muestre
  // una vez con un contador en vez de duplicado.
  function groupTexts(entries, key) {
    const order = [];
    const byNorm = {};
    entries.forEach(function (e) {
      if (!hasContent(e, key)) return;
      splitObjectives(e[key]).forEach(function (text) {
        const norm = text.toLowerCase();
        if (!byNorm[norm]) { byNorm[norm] = { text: capitalize(text), count: 0 }; order.push(norm); }
        byNorm[norm].count++;
      });
    });
    return order.map(function (norm) { return byNorm[norm]; }).sort(function (a, b) { return b.count - a.count; });
  }

  function breakdownHtml() {
    // Recuento global (toda la temporada), no solo del mes visible en el
    // calendario — así el desglose refleja en qué se incide más en total.
    const entries = DATA.planEntries || [];
    const perType = PLAN_TYPES.map(function (t) {
      const items = groupTexts(entries, t.key);
      const count = items.reduce(function (sum, it) { return sum + it.count; }, 0);
      return { type: t, count: count, items: items };
    });
    const total = perType.reduce(function (sum, c) { return sum + c.count; }, 0);

    if (!total) {
      return (
        '<div class="panel" style="padding:18px;">' +
          '<span class="panel-title">Objetivos trabajados</span>' +
          '<div class="empty-state" style="margin-top:14px;">Todavía no hay objetivos planificados.</div>' +
        '</div>'
      );
    }

    const rows = perType.map(function (c) {
      const pct = Math.round((c.count / total) * 100);
      const itemsHtml = c.items.map(function (it) {
        const itemPct = Math.round((it.count / c.count) * 100);
        return (
          '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding-left:12px;position:relative;">' +
            '<span style="position:absolute;left:0;top:1px;color:' + c.type.color + ';">·</span>' +
            '<span style="font-size:11.5px;line-height:1.45;color:var(--text-dim);">' +
              SM.ui.escapeHtml(it.text) +
              (it.count > 1 ? ' <span style="color:' + c.type.color + ';font-weight:700;white-space:nowrap;">×' + it.count + '</span>' : '') +
            '</span>' +
            '<span style="flex:none;font-size:11px;font-weight:700;color:var(--text-mute);white-space:nowrap;">' + itemPct + '%</span>' +
          '</div>'
        );
      }).join('');

      return (
        '<div>' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<span style="width:58px;font-size:12.5px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + c.type.label + '</span>' +
            '<div class="bar-track thick"><div class="bar-fill" style="width:' + pct + '%;background:' + c.type.color + ';box-shadow:0 0 8px ' + c.type.color + ';"></div></div>' +
            '<span style="width:76px;text-align:right;font-family:var(--font-display);font-size:12.5px;font-weight:700;color:' + c.type.color + ';">' + pct + '% <span style="color:var(--text-mute);font-weight:600;">(' + c.count + ')</span></span>' +
          '</div>' +
          (itemsHtml ? '<div style="display:flex;flex-direction:column;gap:5px;margin:8px 0 0;">' + itemsHtml + '</div>' : '') +
        '</div>'
      );
    }).join('');

    return (
      '<div class="panel" style="padding:18px;">' +
        '<span class="panel-title">Objetivos trabajados</span>' +
        '<div class="form-hint" style="margin:2px 0 0;">Toda la temporada · ' + total + ' objetivo' + (total === 1 ? '' : 's') + ' registrado' + (total === 1 ? '' : 's') + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:18px;margin-top:18px;">' + rows + '</div>' +
      '</div>'
    );
  }

  function shiftMonth(delta) {
    viewMonth += delta;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    render();
  }

  function gridHtml(byDate) {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const leading = (firstOfMonth.getDay() + 6) % 7; // week starts Monday
    const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7;
    const todayStr = SM.ui.formatDateIso(new Date());

    let cells = '';
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - leading + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        cells += '<div style="min-height:96px;background:var(--panel-2);border-radius:10px;opacity:.35;"></div>';
        continue;
      }
      const dateStr = viewYear + '-' + String(viewMonth + 1).padStart(2, '0') + '-' + String(dayNum).padStart(2, '0');
      const entry = byDate[dateStr];
      const isToday = dateStr === todayStr;
      const dots = PLAN_TYPES.filter(function (t) { return hasContent(entry, t.key); })
        .map(function (t) { return '<span style="width:7px;height:7px;border-radius:50%;background:' + t.color + ';box-shadow:0 0 5px ' + t.color + ';"></span>'; })
        .join('');
      cells +=
        '<div data-plan-day="' + dateStr + '" style="min-height:96px;background:var(--panel-2);border-radius:10px;border:1px solid ' + (isToday ? 'var(--cyan)' : 'var(--border-soft)') + ';padding:8px;display:flex;flex-direction:column;gap:8px;cursor:pointer;">' +
          '<span style="font-size:11.5px;font-weight:700;color:' + (isToday ? 'var(--cyan-bright)' : 'var(--text-mute)') + ';">' + dayNum + '</span>' +
          '<div style="display:flex;flex-wrap:wrap;gap:4px;">' + dots + '</div>' +
        '</div>';
    }

    return (
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:8px;">' +
        WEEKDAY_LABELS.map(function (l) { return '<span style="font-size:10.5px;font-weight:700;color:var(--text-ghost);letter-spacing:.5px;text-align:center;">' + l + '</span>'; }).join('') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;">' + cells + '</div>'
    );
  }

  function openPlanModal(dateStr, existing) {
    const e = existing || {};
    const body = SM.ui.el('div', {
      html:
        '<div id="plan-error" style="display:none;margin-bottom:14px;padding:10px 14px;border-radius:9px;background:' + SM.ui.alpha('var(--red)', 0.12) + ';border:1px solid ' + SM.ui.alpha('var(--red)', 0.4) + ';color:var(--red-bright);font-size:12.5px;font-weight:600;"></div>' +
        '<form id="plan-form">' +
          PLAN_TYPES.map(function (t) {
            return SM.forms.field(
              t.label,
              '<textarea name="' + t.key + '" rows="3" placeholder="Separa cada objetivo con una coma o un salto de línea, p. ej.: pase, control, conducción...">' + SM.ui.escapeHtml(e[t.key]) + '</textarea>',
              true
            );
          }).join('') +
          '<div class="form-actions">' +
            (existing ? '<button type="button" id="delete-plan-btn" class="btn btn-outline" style="margin-right:auto;color:var(--red-bright);border-color:' + SM.ui.alpha('var(--red)', 0.4) + ';">Borrar</button>' : '') +
            '<button type="button" class="btn btn-outline" id="cancel-btn">Cancelar</button>' +
            '<button type="submit" class="btn btn-primary">Guardar</button>' +
          '</div>' +
        '</form>'
    });
    const handle = SM.ui.openModal('Planificación · ' + SM.ui.formatDateLong(dateStr), body);
    body.querySelector('#cancel-btn').addEventListener('click', handle.close);

    // Mismo patrón que el resto de la app: bloquea el doble tap, muestra
    // "Guardando..." al instante, y si falla deja el error a la vista (no
    // solo un toast que desaparece solo).
    let saving = false;
    const submitBtn = body.querySelector('button[type="submit"]');
    const submitLabel = submitBtn.textContent;
    function showError(msg) {
      const el = body.querySelector('#plan-error');
      if (msg) { el.textContent = '⚠ ' + msg; el.style.display = 'block'; }
      else { el.style.display = 'none'; el.textContent = ''; }
    }
    function setSaving(v) {
      saving = v;
      submitBtn.disabled = v;
      submitBtn.textContent = v ? 'Guardando…' : submitLabel;
      const delBtn = body.querySelector('#delete-plan-btn');
      if (delBtn) delBtn.disabled = v;
    }

    body.querySelector('#plan-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (saving) return;
      const payload = { fecha: dateStr, categoria: SM.team.current() };
      new FormData(ev.target).forEach(function (v, k) { payload[k] = v; });
      showError(null);
      setSaving(true);
      SM.api.postAction('savePlanEntry', payload).then(function () {
        handle.close();
        return SM.api.fetchAll(true);
      }).then(function (data) {
        DATA = SM.team.filterData(data, SM.team.current());
        render();
        SM.ui.toast('Planificación guardada.', 'ok');
      }).catch(function (err) {
        setSaving(false);
        showError(err.message);
        SM.ui.toast(err.message, 'error');
      });
    });

    const deleteBtn = body.querySelector('#delete-plan-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function () {
        if (saving) return;
        if (!window.confirm('¿Borrar la planificación de este día? No se puede deshacer.')) return;
        showError(null);
        setSaving(true);
        SM.api.postAction('deletePlanEntry', { id: existing.id }).then(function () {
          handle.close();
          return SM.api.fetchAll(true);
        }).then(function (data) {
          DATA = SM.team.filterData(data, SM.team.current());
          render();
          SM.ui.toast('Planificación borrada.', 'ok');
        }).catch(function (err) {
          setSaving(false);
          showError(err.message);
          SM.ui.toast(err.message, 'error');
        });
      });
    }
  }

  SM.api.fetchAll().then(function (data) {
    DATA = SM.team.filterData(data, SM.team.current());
    SM.sidebar.applySettings(data.settings);
    render();
  }).catch(function (err) {
    main.innerHTML = '<div class="empty-state">' + err.message + '</div>';
  });
})();
