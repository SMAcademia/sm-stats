/* SM Stats — Portal de directiva (directiva.html).
   Acceso de gestión para la junta directiva: cuotas mensuales, uniformes
   y datos personales de contacto de los jugadores — sin nada deportivo
   (ni atributos, ni partidos, ni asistencia a entrenamientos, ni
   bienestar). Dos formas de entrar:
   - Un miembro de la directiva via acceso.html: se guarda una sesión de
     staff y aquí se comprueba que siga marcado "Es directiva" en
     Plantilla; si no, se manda a acceso.html.
   - El propio entrenador/a, directamente desde el enlace "Directiva" de
     la barra lateral de la app completa: sin sesión guardada, igual que
     el resto de páginas de la app (mismo nivel de acceso que ya tiene a
     todo lo demás). Solo se bloquea una sesión guardada que NO sea de
     staff (p. ej. un enlace de mi-jugador.html abierto en el mismo
     dispositivo). */

(function () {
  const main = document.getElementById('main');
  const esc = SM.ui.escapeHtml;

  // Las celdas de Cuotas/Uniformes son pequeñas y viven dentro de una tabla
  // con scroll horizontal — en el móvil, el navegador a veces interpreta el
  // dedo al tocar como el inicio de ese scroll y cancela el "click" nativo
  // sin avisar (se ve el resalte azul de "tocado" pero no pasa nada más).
  // Para no depender de esa síntesis, se calcula el toque a mano con
  // Pointer Events: solo cuenta como toque si el dedo no se ha movido más
  // de unos pocos píxeles entre bajar y soltar.
  function wireTapButtons(selector, handler) {
    main.querySelectorAll(selector).forEach(function (btn) {
      let startX = 0, startY = 0, tracking = false;
      btn.addEventListener('pointerdown', function (e) {
        if (btn.disabled) return;
        tracking = true;
        startX = e.clientX;
        startY = e.clientY;
      });
      btn.addEventListener('pointerup', function (e) {
        if (!tracking || btn.disabled) return;
        tracking = false;
        if (Math.abs(e.clientX - startX) < 12 && Math.abs(e.clientY - startY) < 12) handler(btn);
      });
      btn.addEventListener('pointercancel', function () { tracking = false; });
    });
  }

  const session = SM.auth.readFamilySession();
  if (session && (session.type !== 'staff' || !session.id)) {
    window.location.href = 'acceso.html';
    return;
  }

  let DATA = null;
  let staffMember = null;
  let tab = 'jugadores'; // 'jugadores' | 'cuotas' | 'uniformes'

  // ---- temporada: de septiembre a junio, anclada al año en curso (si
  // estamos entre enero y agosto, la temporada empezó el año anterior) ----
  const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  function seasonPeriods() {
    const now = new Date();
    const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    const periods = [];
    for (let m = 8; m <= 17; m++) {
      const year = startYear + Math.floor(m / 12);
      const month = (m % 12) + 1;
      periods.push(year + '-' + String(month).padStart(2, '0'));
    }
    return periods;
  }
  function periodLabel(periodo) {
    const parts = periodo.split('-');
    return MONTH_LABELS[Number(parts[1]) - 1] + " '" + parts[0].slice(2);
  }

  function activePlayers() {
    return (DATA.players || []).filter(function (p) { return p.activo; })
      .sort(function (a, b) { return (a.categoria || '').localeCompare(b.categoria || '') || (a.dorsal || 99) - (b.dorsal || 99); });
  }

  // Condiciones económicas: el valor por defecto viene de Ajustes, pero un
  // jugador puede tener su propia excepción guardada en su ficha (beca,
  // precio distinto...) — se detecta sola, sin tocar nada aquí.
  function effectiveCuota(player) {
    const custom = player && player.cuota_mensual_custom;
    if (custom != null && custom !== '') return Number(custom);
    return (DATA.settings && DATA.settings.cuota_mensual) || 0;
  }
  function effectiveUniformePrecio(player, tipo) {
    const custom = player && player['uniforme_precio_' + tipo + '_custom'];
    if (custom != null && custom !== '') return Number(custom);
    return (DATA.settings && DATA.settings['uniforme_precio_' + tipo]) || 0;
  }

  function kpiCard(label, value, subtitle, color, iconPath) {
    return (
      '<div class="panel kpi-card">' +
        '<div class="panel-glow" style="top:-30px;right:-30px;width:110px;height:110px;background:radial-gradient(circle, ' + SM.ui.alpha(color, 0.16) + ', transparent 70%);"></div>' +
        '<div class="kpi-head">' +
          '<span class="kpi-label">' + label + '</span>' +
          '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + iconPath + '</svg>' +
        '</div>' +
        '<div class="kpi-value">' + value + '</div>' +
        '<div class="kpi-delta" style="color:' + color + ';">' + subtitle + '</div>' +
      '</div>'
    );
  }

  function render() {
    const clubName = (DATA.settings && DATA.settings.club_nombre) || 'Mi club';
    const personName = staffMember ? staffMember.nombre : ((DATA.settings && DATA.settings.entrenador_nombre) || 'Entrenador/a');
    main.innerHTML =
      '<div class="page-header">' +
        '<div><div class="page-title">Directiva</div><div class="page-subtitle">' + esc(clubName) + ' · ' + esc(personName) + '</div></div>' +
        (session ? '<button type="button" id="logout-btn" class="btn btn-outline">Salir</button>' : '<a href="index.html" class="btn btn-outline">Volver a la app</a>') +
      '</div>' +
      '<div class="tabbar" id="section-tabbar" style="margin-bottom:18px;">' +
        '<button class="tab' + (tab === 'jugadores' ? ' active' : '') + '" data-tab="jugadores">Jugadores</button>' +
        '<button class="tab' + (tab === 'cuotas' ? ' active' : '') + '" data-tab="cuotas">Cuotas</button>' +
        '<button class="tab' + (tab === 'uniformes' ? ' active' : '') + '" data-tab="uniformes">Uniformes</button>' +
      '</div>' +
      (tab === 'jugadores' ? jugadoresTabHtml() : tab === 'cuotas' ? cuotasTabHtml() : uniformesTabHtml());

    const logoutBtn = main.querySelector('#logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', function () {
      SM.auth.clearFamilySession();
      window.location.href = 'acceso.html';
    });
    main.querySelector('#section-tabbar').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;
      tab = btn.getAttribute('data-tab');
      render();
    });
    if (tab === 'cuotas') wireCuotasTab();
    if (tab === 'uniformes') wireUniformesTab();
  }

  // ---- Jugadores: datos personales/contacto, solo lectura (la ficha
  // deportiva se edita desde Plantilla, no desde aquí) ----
  function jugadoresTabHtml() {
    const players = activePlayers();
    if (!players.length) return '<div class="empty-state">Todavía no hay jugadores dados de alta.</div>';
    const rows = players.map(function (p) {
      return (
        '<tr>' +
          '<td style="text-align:left;"><div style="display:flex;align-items:center;gap:10px;">' + SM.ui.avatarHtml(p.foto_url, 30) + '<span style="font-weight:700;color:var(--text-strong);">' + esc(p.nombre) + '</span></div></td>' +
          '<td>' + esc(p.categoria || '—') + '</td>' +
          '<td>' + (p.dorsal || '—') + '</td>' +
          '<td>' + SM.ui.formatDateLong(p.fecha_nacimiento) + '</td>' +
          '<td style="text-align:left;">' + esc(p.contacto_emergencia || '—') + '</td>' +
          '<td>' + (p.fecha_alta || '—') + '</td>' +
        '</tr>'
      );
    }).join('');
    return (
      '<div class="panel" style="overflow-x:auto;">' +
        '<span class="panel-title">Datos personales</span>' +
        '<table class="data-table" style="margin-top:12px;min-width:720px;">' +
          '<thead><tr><th style="text-align:left;">Jugador</th><th>Categoría</th><th>Dorsal</th><th>F. nacimiento</th><th style="text-align:left;">Contacto</th><th>En el club desde</th></tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>'
    );
  }

  // ---- Cuotas: cuadrícula jugador × mes de la temporada ----
  function cuotasByKey() {
    const map = {};
    (DATA.cuotas || []).forEach(function (c) { map[c.player_id + '::' + c.periodo] = c; });
    return map;
  }

  // Periodos de la temporada que ya han empezado (hasta el mes actual) —
  // los que quedan por venir no cuentan como "pendientes" todavía.
  function elapsedPeriods(periods) {
    const now = new Date();
    const current = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    return periods.filter(function (per) { return per <= current; });
  }

  function cuotaKpis(players) {
    const periods = seasonPeriods();
    const elapsed = elapsedPeriods(periods);
    const byKey = cuotasByKey();
    const playerIds = players.map(function (p) { return p.id; });
    const expected = players.length * elapsed.length;
    let paidCount = 0;
    let recaudado = 0;
    (DATA.cuotas || []).forEach(function (c) {
      if (playerIds.indexOf(c.player_id) === -1 || periods.indexOf(c.periodo) === -1 || !c.pagado) return;
      recaudado += c.importe || 0;
      if (elapsed.indexOf(c.periodo) !== -1) paidCount++;
    });
    const pendientes = Math.max(0, expected - paidCount);
    const pctAlDia = expected > 0 ? Math.round((paidCount / expected) * 100) : null;
    return (
      '<div class="kpi-grid" style="margin-bottom:18px;">' +
        kpiCard('Recaudado (temporada)', recaudado.toLocaleString('es-ES') + '€', 'cuotas marcadas como pagadas',
          'var(--green)', '<circle cx="12" cy="12" r="9"/><path d="M9 9.2h5.2M9 12.3h4M15 7.6a4.3 4.3 0 100 8.8"/>') +
        kpiCard('Cuotas pendientes', pendientes, 'de ' + expected + ' esperadas hasta este mes',
          pendientes > 0 ? 'var(--amber)' : 'var(--green)', '<rect x="4.5" y="3.5" width="15" height="17" rx="2.2"/><path d="M8 8h8M8 11.5h8M8 15h5"/>') +
        kpiCard('Al día', pctAlDia != null ? pctAlDia + '%' : '—', 'pagos del periodo ya transcurrido',
          'var(--cyan)', '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.6 2.6L16 9.3"/>') +
      '</div>'
    );
  }

  function cuotasTabHtml() {
    const players = activePlayers();
    if (!players.length) return '<div class="empty-state">Todavía no hay jugadores dados de alta.</div>';
    const periods = seasonPeriods();
    const byKey = cuotasByKey();
    const defaultImporte = DATA.settings && DATA.settings.cuota_mensual;
    const head = '<tr><th style="text-align:left;">Jugador</th>' + periods.map(function (per) { return '<th>' + periodLabel(per) + '</th>'; }).join('') + '</tr>';
    const rows = players.map(function (p) {
      const hasCustom = p.cuota_mensual_custom != null && p.cuota_mensual_custom !== '';
      const cells = periods.map(function (per) {
        const c = byKey[p.id + '::' + per];
        const paid = !!(c && c.pagado);
        return (
          '<td>' +
            '<button type="button" class="cuota-cell" data-player="' + p.id + '" data-periodo="' + per + '" title="' + (paid ? 'Pagado — toca para desmarcar' : 'Pendiente — toca para marcar pagado') + '" style="touch-action:none;width:100%;min-width:40px;padding:7px 4px;border-radius:7px;border:1px solid ' + (paid ? 'var(--green)' : 'var(--red)') + ';background:' + (paid ? SM.ui.alpha('var(--green)', 0.16) : SM.ui.alpha('var(--red)', 0.16)) + ';color:' + (paid ? 'var(--green)' : 'var(--red-bright)') + ';font-weight:800;font-size:14px;cursor:pointer;">' + (paid ? '✓' : '✕') + '</button>' +
          '</td>'
        );
      }).join('');
      return (
        '<tr><td style="text-align:left;font-weight:700;color:var(--text-strong);white-space:nowrap;">' + esc(p.nombre) +
          (hasCustom ? ' <span style="font-weight:600;color:var(--amber);font-size:11px;" title="Cuota personalizada en su ficha">(' + effectiveCuota(p) + '€)</span>' : '') +
        '</td>' + cells + '</tr>'
      );
    }).join('');
    return (
      cuotaKpis(players) +
      '<div class="panel" style="overflow-x:auto;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">' +
          '<span class="panel-title">Cuotas de la temporada</span>' +
          '<span style="font-size:11.5px;color:var(--text-mute);font-weight:600;">Cuota por defecto: ' + (defaultImporte != null ? defaultImporte + '€/mes' : '— (configúrala en Ajustes)') + ' · toca una casilla para marcar pagado/pendiente</span>' +
        '</div>' +
        '<table class="data-table" style="margin-top:12px;min-width:900px;">' +
          '<thead>' + head + '</thead><tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>'
    );
  }

  function wireCuotasTab() {
    wireTapButtons('.cuota-cell', function (btn) {
      // Feedback inmediato al tocar — antes de esperar a la red, para que
      // se note el toque incluso si la hoja tarda en responder (y para
      // poder distinguir "no ha reaccionado al toque" de "ha tardado").
      btn.disabled = true;
      btn.style.opacity = '0.45';
      btn.textContent = '…';
      toggleCuotaPagado(btn.getAttribute('data-player'), btn.getAttribute('data-periodo'), btn);
    });
  }

  // Toca una casilla -> alterna pagado/pendiente directamente, sin modal.
  // El importe se calcula solo (cuota por defecto de Ajustes, o la
  // personalizada de la ficha del jugador si tiene una) — no se edita a
  // mano aquí.
  function toggleCuotaPagado(playerId, periodo, btn) {
    const player = (DATA.players || []).find(function (p) { return p.id === playerId; });
    const existing = (DATA.cuotas || []).find(function (c) { return c.player_id === playerId && c.periodo === periodo; });
    const willPay = !(existing && existing.pagado);
    const payload = {
      id: existing ? existing.id : undefined,
      player_id: playerId,
      periodo: periodo,
      importe: willPay ? effectiveCuota(player) : null,
      pagado: willPay,
      fecha_pago: willPay ? SM.ui.formatDateIso(new Date()) : ''
    };
    SM.api.postAction('saveCuota', payload).then(function () {
      return SM.api.fetchAll(true);
    }).then(function (data) {
      DATA = data;
      render();
    }).catch(function (err) {
      if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.textContent = willPay ? '✕' : '✓'; }
      // alert() en vez de (o además de) un toast que puede pasar
      // desapercibido en 3 segundos — necesitamos ver el texto exacto del
      // error para saber qué está fallando de verdad en el guardado.
      window.alert('No se pudo guardar la cuota:\n\n' + err.message);
    });
  }

  // ---- Uniformes: dos kits por jugador (entrenamiento/paseo) ----
  const KIT_TYPES = [{ key: 'entrenamiento', label: 'Entrenamiento' }, { key: 'paseo', label: 'Paseo' }];

  function uniformesByKey() {
    const map = {};
    (DATA.uniformes || []).forEach(function (u) { map[u.player_id + '::' + u.tipo] = u; });
    return map;
  }

  function statusBadgeHtml(on) {
    return '<td><span class="badge" style="background:' + (on ? SM.ui.alpha('var(--green)', 0.14) : 'var(--panel-2)') + ';border:1px solid ' + (on ? SM.ui.alpha('var(--green)', 0.5) : 'var(--border-soft)') + ';color:' + (on ? 'var(--green)' : 'var(--text-ghost)') + ';">' + (on ? 'Sí' : 'No') + '</span></td>';
  }

  function uniformeKpis(players) {
    const byKey = uniformesByKey();
    let entregadoEntreno = 0;
    let entregadoPaseo = 0;
    let pendientePago = 0;
    let pendienteImporte = 0;
    players.forEach(function (p) {
      KIT_TYPES.forEach(function (kit) {
        const u = byKey[p.id + '::' + kit.key];
        if (u && u.entregado) { if (kit.key === 'entrenamiento') entregadoEntreno++; else entregadoPaseo++; }
        if (u && (u.pedido || u.entregado) && !u.pagado) {
          pendientePago++;
          pendienteImporte += effectiveUniformePrecio(p, kit.key);
        }
      });
    });
    return (
      '<div class="kpi-grid" style="margin-bottom:18px;">' +
        kpiCard('Entrenamiento entregado', entregadoEntreno + '/' + players.length, 'kits de entrenamiento entregados',
          entregadoEntreno === players.length ? 'var(--green)' : 'var(--amber)', '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.6 2.6L16 9.3"/>') +
        kpiCard('Paseo entregado', entregadoPaseo + '/' + players.length, 'kits de paseo entregados',
          entregadoPaseo === players.length ? 'var(--green)' : 'var(--amber)', '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.6 2.6L16 9.3"/>') +
        kpiCard('Pendiente de pago', pendientePago, pendienteImporte > 0 ? ('≈ ' + pendienteImporte.toLocaleString('es-ES') + '€ por cobrar') : 'kits pedidos/entregados sin cobrar',
          pendientePago > 0 ? 'var(--magenta)' : 'var(--green)', '<rect x="4.5" y="3.5" width="15" height="17" rx="2.2"/><path d="M8 8h8M8 11.5h8M8 15h5"/>') +
      '</div>'
    );
  }

  function uniformesTabHtml() {
    const players = activePlayers();
    if (!players.length) return '<div class="empty-state">Todavía no hay jugadores dados de alta.</div>';
    const byKey = uniformesByKey();
    const rows = players.map(function (p) {
      return KIT_TYPES.map(function (kit) {
        const u = byKey[p.id + '::' + kit.key];
        const paid = !!(u && u.pagado);
        const precio = effectiveUniformePrecio(p, kit.key);
        return (
          '<tr>' +
            '<td style="text-align:left;font-weight:700;color:var(--text-strong);">' + esc(p.nombre) + '</td>' +
            '<td>' + kit.label + '</td>' +
            '<td>' + esc((u && u.talla) || '—') + '</td>' +
            statusBadgeHtml(u && u.pedido) +
            statusBadgeHtml(u && u.entregado) +
            '<td>' + (precio ? precio.toLocaleString('es-ES') + '€' : '—') + '</td>' +
            '<td><button type="button" class="uniforme-pagado-cell" data-player="' + p.id + '" data-tipo="' + kit.key + '" title="' + (paid ? 'Pagado — toca para desmarcar' : 'Pendiente — toca para marcar pagado') + '" style="touch-action:none;padding:6px 16px;border-radius:7px;border:1px solid ' + (paid ? 'var(--green)' : 'var(--red)') + ';background:' + (paid ? SM.ui.alpha('var(--green)', 0.16) : SM.ui.alpha('var(--red)', 0.16)) + ';color:' + (paid ? 'var(--green)' : 'var(--red-bright)') + ';font-weight:800;font-size:14px;cursor:pointer;">' + (paid ? '✓' : '✕') + '</button></td>' +
            '<td><button type="button" class="btn btn-outline uniforme-edit-btn" data-player="' + p.id + '" data-tipo="' + kit.key + '" style="padding:5px 12px;font-size:11.5px;">Editar</button></td>' +
          '</tr>'
        );
      }).join('');
    }).join('');
    return (
      uniformeKpis(players) +
      '<div class="panel" style="overflow-x:auto;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">' +
          '<span class="panel-title">Uniformes</span>' +
          '<button type="button" class="btn btn-outline" id="bulk-training-btn" style="padding:6px 14px;font-size:12px;">Marcar entrenamiento pedido + entregado a todos</button>' +
        '</div>' +
        '<table class="data-table" style="margin-top:12px;min-width:760px;">' +
          '<thead><tr><th style="text-align:left;">Jugador</th><th>Kit</th><th>Talla</th><th>Pedido</th><th>Entregado</th><th>Precio</th><th>Pagado</th><th></th></tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>'
    );
  }

  function wireUniformesTab() {
    main.querySelectorAll('.uniforme-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openUniformeModal(btn.getAttribute('data-player'), btn.getAttribute('data-tipo'));
      });
    });
    wireTapButtons('.uniforme-pagado-cell', function (btn) {
      const wasPaid = btn.textContent.trim() === '✓';
      btn.disabled = true;
      btn.style.opacity = '0.45';
      btn.textContent = '…';
      toggleUniformePagado(btn.getAttribute('data-player'), btn.getAttribute('data-tipo'), btn, wasPaid);
    });
    const bulkBtn = main.querySelector('#bulk-training-btn');
    if (bulkBtn) bulkBtn.addEventListener('click', bulkMarkTrainingDelivered);
  }

  // Toca la columna "Pagado" -> alterna pagado/pendiente directamente, sin
  // modal (igual que las cuotas) — conserva talla/pedido/entregado tal
  // cual estuvieran.
  function toggleUniformePagado(playerId, tipo, btn, wasPaid) {
    const byKey = uniformesByKey();
    const existing = byKey[playerId + '::' + tipo];
    const payload = {
      id: existing ? existing.id : undefined,
      player_id: playerId,
      tipo: tipo,
      talla: existing ? existing.talla : '',
      pedido: existing ? existing.pedido : false,
      entregado: existing ? existing.entregado : false,
      pagado: !(existing && existing.pagado)
    };
    SM.api.postAction('saveUniforme', payload).then(function () {
      return SM.api.fetchAll(true);
    }).then(function (data) {
      DATA = data;
      render();
    }).catch(function (err) {
      if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.textContent = wasPaid ? '✓' : '✕'; }
      window.alert('No se pudo guardar el uniforme:\n\n' + err.message);
    });
  }

  function openUniformeModal(playerId, tipo) {
    const player = (DATA.players || []).find(function (p) { return p.id === playerId; });
    const existing = (DATA.uniformes || []).find(function (u) { return u.player_id === playerId && u.tipo === tipo; });
    const kitLabel = (KIT_TYPES.find(function (k) { return k.key === tipo; }) || {}).label || tipo;
    const body = SM.ui.el('div', {
      html:
        '<form id="uniforme-form">' +
          '<div class="form-grid">' +
            '<div class="form-field span-2"><label>Talla</label><input name="talla" placeholder="Ej. 12 años / M" value="' + esc((existing && existing.talla) || '') + '"></div>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">' +
            '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--text);"><input type="checkbox" name="pedido"' + (existing && existing.pedido ? ' checked' : '') + '> Pedido</label>' +
            '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--text);"><input type="checkbox" name="entregado"' + (existing && existing.entregado ? ' checked' : '') + '> Entregado</label>' +
          '</div>' +
          '<div class="form-hint" style="margin-top:10px;">El estado de pago se marca directamente desde la tabla (columna "Pagado") — aquí solo talla, pedido y entregado.</div>' +
          '<div class="form-actions">' +
            '<button type="button" class="btn btn-outline" id="cancel-btn">Cancelar</button>' +
            '<button type="submit" class="btn btn-primary">Guardar</button>' +
          '</div>' +
        '</form>'
    });
    const handle = SM.ui.openModal('Uniforme · ' + (player ? player.nombre : '') + ' · ' + kitLabel, body);
    body.querySelector('#cancel-btn').addEventListener('click', handle.close);
    body.querySelector('#uniforme-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        id: existing ? existing.id : undefined,
        player_id: playerId,
        tipo: tipo,
        talla: fd.get('talla') || '',
        pedido: !!fd.get('pedido'),
        entregado: !!fd.get('entregado'),
        pagado: existing ? !!existing.pagado : false
      };
      SM.api.postAction('saveUniforme', payload).then(function () {
        handle.close();
        return SM.api.fetchAll(true);
      }).then(function (data) {
        DATA = data;
        render();
        SM.ui.toast('Uniforme guardado.', 'ok');
      }).catch(function (err) { SM.ui.toast(err.message, 'error'); });
    });
  }

  // Ya se ha entregado la ropa de entrenamiento a todos los jugadores — un
  // atajo para no tener que abrir el editor uno a uno para marcar lo mismo.
  // No toca talla ni el estado de pago de nadie, solo pedido/entregado.
  function bulkMarkTrainingDelivered() {
    if (!window.confirm('¿Marcar "Pedido" y "Entregado" del kit de entrenamiento para TODOS los jugadores activos? No toca la talla ni el estado de pago.')) return;
    const byKey = uniformesByKey();
    const players = activePlayers();
    const calls = players.map(function (p) {
      const existing = byKey[p.id + '::entrenamiento'];
      return SM.api.postAction('saveUniforme', {
        id: existing ? existing.id : undefined,
        player_id: p.id,
        tipo: 'entrenamiento',
        talla: existing ? existing.talla : '',
        pedido: true,
        entregado: true,
        pagado: existing ? !!existing.pagado : false
      });
    });
    Promise.all(calls).then(function () {
      return SM.api.fetchAll(true);
    }).then(function (data) {
      DATA = data;
      render();
      SM.ui.toast('Kit de entrenamiento marcado como pedido y entregado para todos.', 'ok');
    }).catch(function (err) { SM.ui.toast(err.message, 'error'); });
  }

  SM.api.fetchAll().then(function (data) {
    DATA = data;
    if (session) {
      staffMember = (DATA.staff || []).find(function (s) { return s.id === session.id; });
      if (!staffMember || !staffMember.es_directiva) {
        SM.auth.clearFamilySession();
        window.location.href = 'acceso.html';
        return;
      }
    }
    render();
  }).catch(function (err) {
    main.innerHTML = '<div class="empty-state">' + err.message + '</div>';
  });
})();
