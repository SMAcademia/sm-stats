/* SM Stats — Portal de directiva (directiva.html).
   Acceso de gestión para la junta directiva: cuotas mensuales, uniformes
   y datos personales de contacto de los jugadores — sin nada deportivo
   (ni atributos, ni partidos, ni asistencia a entrenamientos, ni
   bienestar). Protegido por SM.auth igual que mi-jugador.html: si no hay
   sesión de staff guardada para este dispositivo, o el miembro ya no
   tiene marcado "Es directiva" en Plantilla, se manda a acceso.html. */

(function () {
  const main = document.getElementById('main');
  const esc = SM.ui.escapeHtml;

  const session = SM.auth.readFamilySession();
  if (!session || session.type !== 'staff' || !session.id) {
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

  function render() {
    const clubName = (DATA.settings && DATA.settings.club_nombre) || 'Mi club';
    main.innerHTML =
      '<div class="page-header">' +
        '<div><div class="page-title">Directiva</div><div class="page-subtitle">' + esc(clubName) + ' · ' + esc(staffMember.nombre) + '</div></div>' +
        '<button type="button" id="logout-btn" class="btn btn-outline">Salir</button>' +
      '</div>' +
      '<div class="tabbar" id="section-tabbar" style="margin-bottom:18px;">' +
        '<button class="tab' + (tab === 'jugadores' ? ' active' : '') + '" data-tab="jugadores">Jugadores</button>' +
        '<button class="tab' + (tab === 'cuotas' ? ' active' : '') + '" data-tab="cuotas">Cuotas</button>' +
        '<button class="tab' + (tab === 'uniformes' ? ' active' : '') + '" data-tab="uniformes">Uniformes</button>' +
      '</div>' +
      (tab === 'jugadores' ? jugadoresTabHtml() : tab === 'cuotas' ? cuotasTabHtml() : uniformesTabHtml());

    main.querySelector('#logout-btn').addEventListener('click', function () {
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

  function cuotasTabHtml() {
    const players = activePlayers();
    if (!players.length) return '<div class="empty-state">Todavía no hay jugadores dados de alta.</div>';
    const periods = seasonPeriods();
    const byKey = cuotasByKey();
    const defaultImporte = DATA.settings && DATA.settings.cuota_mensual;
    const head = '<tr><th style="text-align:left;">Jugador</th>' + periods.map(function (per) { return '<th>' + periodLabel(per) + '</th>'; }).join('') + '</tr>';
    const rows = players.map(function (p) {
      const cells = periods.map(function (per) {
        const c = byKey[p.id + '::' + per];
        const paid = !!(c && c.pagado);
        const label = paid ? (c.importe != null ? c.importe + '€' : '✓') : '–';
        return (
          '<td>' +
            '<button type="button" class="cuota-cell" data-player="' + p.id + '" data-periodo="' + per + '" style="width:100%;min-width:52px;padding:6px 4px;border-radius:7px;border:1px solid ' + (paid ? 'var(--green)' : 'var(--border-soft)') + ';background:' + (paid ? SM.ui.alpha('var(--green)', 0.12) : 'var(--panel-2)') + ';color:' + (paid ? 'var(--green)' : 'var(--text-mute)') + ';font-weight:700;font-size:12px;cursor:pointer;">' + label + '</button>' +
          '</td>'
        );
      }).join('');
      return '<tr><td style="text-align:left;font-weight:700;color:var(--text-strong);white-space:nowrap;">' + esc(p.nombre) + '</td>' + cells + '</tr>';
    }).join('');
    return (
      '<div class="panel" style="overflow-x:auto;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">' +
          '<span class="panel-title">Cuotas de la temporada</span>' +
          '<span style="font-size:11.5px;color:var(--text-mute);font-weight:600;">Cuota por defecto: ' + (defaultImporte != null ? defaultImporte + '€/mes' : '— (configúrala en Ajustes)') + ' · toca una celda para editarla</span>' +
        '</div>' +
        '<table class="data-table" style="margin-top:12px;min-width:900px;">' +
          '<thead>' + head + '</thead><tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>'
    );
  }

  function wireCuotasTab() {
    main.querySelectorAll('.cuota-cell').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openCuotaModal(btn.getAttribute('data-player'), btn.getAttribute('data-periodo'));
      });
    });
  }

  function openCuotaModal(playerId, periodo) {
    const player = (DATA.players || []).find(function (p) { return p.id === playerId; });
    const existing = (DATA.cuotas || []).find(function (c) { return c.player_id === playerId && c.periodo === periodo; });
    const defaultImporte = DATA.settings && DATA.settings.cuota_mensual;
    const importe = existing && existing.importe != null ? existing.importe : (defaultImporte != null ? defaultImporte : '');
    const pagado = !!(existing && existing.pagado);
    const fechaPago = (existing && existing.fecha_pago) || SM.ui.formatDateIso(new Date());
    const body = SM.ui.el('div', {
      html:
        '<form id="cuota-form">' +
          '<div class="form-grid">' +
            '<div class="form-field"><label>Importe (€)</label><input name="importe" type="number" min="0" step="0.01" value="' + esc(importe) + '"></div>' +
            '<div class="form-field"><label>Fecha de pago</label><input name="fecha_pago" type="date" value="' + esc(fechaPago) + '"></div>' +
          '</div>' +
          '<div class="form-actions" style="justify-content:space-between;">' +
            '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--text);"><input type="checkbox" name="pagado"' + (pagado ? ' checked' : '') + '> Pagado</label>' +
            '<div style="display:flex;gap:10px;"><button type="button" class="btn btn-outline" id="cancel-btn">Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>' +
          '</div>' +
        '</form>'
    });
    const handle = SM.ui.openModal('Cuota · ' + (player ? player.nombre : '') + ' · ' + periodLabel(periodo), body);
    body.querySelector('#cancel-btn').addEventListener('click', handle.close);
    body.querySelector('#cuota-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      const pagadoChecked = !!fd.get('pagado');
      const payload = {
        id: existing ? existing.id : undefined,
        player_id: playerId,
        periodo: periodo,
        importe: fd.get('importe') === '' ? null : Number(fd.get('importe')),
        pagado: pagadoChecked,
        fecha_pago: pagadoChecked ? fd.get('fecha_pago') : ''
      };
      SM.api.postAction('saveCuota', payload).then(function () {
        handle.close();
        return SM.api.fetchAll(true);
      }).then(function (data) {
        DATA = data;
        render();
        SM.ui.toast('Cuota guardada.', 'ok');
      }).catch(function (err) { SM.ui.toast(err.message, 'error'); });
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

  function uniformesTabHtml() {
    const players = activePlayers();
    if (!players.length) return '<div class="empty-state">Todavía no hay jugadores dados de alta.</div>';
    const byKey = uniformesByKey();
    const rows = players.map(function (p) {
      return KIT_TYPES.map(function (kit) {
        const u = byKey[p.id + '::' + kit.key];
        return (
          '<tr>' +
            '<td style="text-align:left;font-weight:700;color:var(--text-strong);">' + esc(p.nombre) + '</td>' +
            '<td>' + kit.label + '</td>' +
            '<td>' + esc((u && u.talla) || '—') + '</td>' +
            statusBadgeHtml(u && u.pedido) +
            statusBadgeHtml(u && u.entregado) +
            statusBadgeHtml(u && u.pagado) +
            '<td><button type="button" class="btn btn-outline uniforme-edit-btn" data-player="' + p.id + '" data-tipo="' + kit.key + '" style="padding:5px 12px;font-size:11.5px;">Editar</button></td>' +
          '</tr>'
        );
      }).join('');
    }).join('');
    return (
      '<div class="panel" style="overflow-x:auto;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">' +
          '<span class="panel-title">Uniformes</span>' +
          '<button type="button" class="btn btn-outline" id="bulk-training-btn" style="padding:6px 14px;font-size:12px;">Marcar entrenamiento pedido + entregado a todos</button>' +
        '</div>' +
        '<table class="data-table" style="margin-top:12px;min-width:640px;">' +
          '<thead><tr><th style="text-align:left;">Jugador</th><th>Kit</th><th>Talla</th><th>Pedido</th><th>Entregado</th><th>Pagado</th><th></th></tr></thead>' +
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
    const bulkBtn = main.querySelector('#bulk-training-btn');
    if (bulkBtn) bulkBtn.addEventListener('click', bulkMarkTrainingDelivered);
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
            '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--text);"><input type="checkbox" name="pagado"' + (existing && existing.pagado ? ' checked' : '') + '> Pagado</label>' +
          '</div>' +
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
        pagado: !!fd.get('pagado')
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
    staffMember = (DATA.staff || []).find(function (s) { return s.id === session.id; });
    if (!staffMember || !staffMember.es_directiva) {
      SM.auth.clearFamilySession();
      window.location.href = 'acceso.html';
      return;
    }
    render();
  }).catch(function (err) {
    main.innerHTML = '<div class="empty-state">' + err.message + '</div>';
  });
})();
