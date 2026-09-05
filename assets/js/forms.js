/* SM Stats — shared form builders (player / staff), reused by plantilla.html
   and jugador.html so both stay in sync. */

window.SM = window.SM || {};

SM.forms = (function () {
  function esc(v) {
    if (v == null) return '';
    return String(v).replace(/"/g, '&quot;');
  }

  function field(label, inputHtml, span2) {
    return '<div class="form-field' + (span2 ? ' span-2' : '') + '"><label>' + label + '</label>' + inputHtml + '</div>';
  }

  function selectHtml(name, options, current) {
    return '<select name="' + name + '">' + options.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === current ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('') + '</select>';
  }

  function playerFormHtml(existing) {
    const p = existing || {};
    return (
      '<form id="player-form">' +
        (p.id ? '<input type="hidden" name="id" value="' + esc(p.id) + '">' : '') +
        '<div class="form-grid">' +
          field('Nombre completo', '<input name="nombre" required value="' + esc(p.nombre) + '">', true) +
          field('Dorsal', '<input name="dorsal" type="number" min="1" max="99" required value="' + esc(p.dorsal) + '">') +
          field('Posición', selectHtml('posicion', [['POR', 'Portero'], ['DEF', 'Defensa'], ['CEN', 'Centrocampista'], ['DEL', 'Delantero']], p.posicion)) +
          field('Posición secundaria', '<input name="posicion_secundaria" value="' + esc(p.posicion_secundaria) + '">') +
          field('Pie dominante', selectHtml('pie', [['Derecho', 'Derecho'], ['Izquierdo', 'Izquierdo'], ['Ambos', 'Ambos']], p.pie)) +
          field('Fecha de nacimiento', '<input name="fecha_nacimiento" type="date" value="' + esc(p.fecha_nacimiento) + '">') +
          field('Nacionalidad', '<input name="nacionalidad" value="' + esc(p.nacionalidad || 'España') + '">') +
          field('Categoría (equipo)', selectHtml('categoria', SM.team.CATEGORIES.map(function (c) { return [c.key, c.key]; }), p.categoria || SM.team.current())) +
          field('Altura (cm)', '<input name="altura_cm" type="number" value="' + esc(p.altura_cm) + '">') +
          field('Peso (kg)', '<input name="peso_kg" type="number" value="' + esc(p.peso_kg) + '">') +
          field('Contacto de emergencia', '<input name="contacto_emergencia" value="' + esc(p.contacto_emergencia) + '">', true) +
          field('Club anterior', '<input name="club_anterior" value="' + esc(p.club_anterior) + '">') +
          field('En el club desde', '<input name="fecha_alta" type="date" value="' + esc(p.fecha_alta) + '">') +
          field('Foto (URL, opcional)', '<input name="foto_url" type="url" placeholder="https://..." value="' + esc(p.foto_url) + '">', true) +
        '</div>' +
        '<div class="form-hint" style="margin-top:16px;">Atributos (0-100) — alimentan el radar del perfil del jugador.</div>' +
        '<div class="form-grid">' +
          SM.stats.ATTR_KEYS.map(function (k) {
            return field(k.charAt(0).toUpperCase() + k.slice(1), '<input name="' + k + '" type="number" min="0" max="100" value="' + esc(p[k] != null ? p[k] : 60) + '">');
          }).join('') +
        '</div>' +
        '<div class="form-actions">' +
          '<button type="button" class="btn btn-outline" id="cancel-btn">Cancelar</button>' +
          '<button type="submit" class="btn btn-primary">Guardar</button>' +
        '</div>' +
      '</form>'
    );
  }

  function staffFormHtml(existing) {
    const s = existing || {};
    return (
      '<form id="staff-form">' +
        (s.id ? '<input type="hidden" name="id" value="' + esc(s.id) + '">' : '') +
        '<div class="form-grid">' +
          field('Nombre completo', '<input name="nombre" required value="' + esc(s.nombre) + '">', true) +
          field('Rol', '<input name="rol" required placeholder="Ej. Preparador físico" value="' + esc(s.rol) + '">') +
          field('Licencia / formación', '<input name="licencia" value="' + esc(s.licencia) + '">') +
          field('En el club desde', '<input name="fecha_alta" placeholder="Ej. 2026" value="' + esc(s.fecha_alta) + '">') +
          field('Foto (URL, opcional)', '<input name="foto_url" type="url" placeholder="https://..." value="' + esc(s.foto_url) + '">', true) +
        '</div>' +
        '<div class="form-actions">' +
          '<button type="button" class="btn btn-outline" id="cancel-btn">Cancelar</button>' +
          '<button type="submit" class="btn btn-primary">Guardar</button>' +
        '</div>' +
      '</form>'
    );
  }

  function formToPayload(form) {
    const payload = {};
    new FormData(form).forEach(function (value, key) { payload[key] = value; });
    ['dorsal', 'altura_cm', 'peso_kg'].concat(SM.stats.ATTR_KEYS).forEach(function (k) {
      if (payload[k] !== undefined && payload[k] !== '') payload[k] = Number(payload[k]);
    });
    return payload;
  }

  // Opens the add/edit player modal and wires submit -> addPlayer/updatePlayer.
  function openPlayerForm(existing, onSaved) {
    const isEdit = !!(existing && existing.id);
    const body = SM.ui.el('div', { html: playerFormHtml(existing) });
    const handle = SM.ui.openModal(isEdit ? 'Editar ficha' : 'Añadir jugador', body);
    body.querySelector('#cancel-btn').addEventListener('click', handle.close);
    body.querySelector('#player-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const payload = formToPayload(e.target);
      SM.api.postAction(isEdit ? 'updatePlayer' : 'addPlayer', payload).then(function () {
        handle.close();
        return SM.api.fetchAll(true);
      }).then(function (data) {
        SM.ui.toast(isEdit ? 'Ficha actualizada.' : 'Jugador añadido.', 'ok');
        if (onSaved) onSaved(data);
      }).catch(function (err) { SM.ui.toast(err.message, 'error'); });
    });
  }

  function openStaffForm(existing, onSaved) {
    const body = SM.ui.el('div', { html: staffFormHtml(existing) });
    const handle = SM.ui.openModal('Añadir miembro del cuerpo técnico', body);
    body.querySelector('#cancel-btn').addEventListener('click', handle.close);
    body.querySelector('#staff-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const payload = formToPayload(e.target);
      SM.api.postAction('addStaffMember', payload).then(function () {
        handle.close();
        return SM.api.fetchAll(true);
      }).then(function (data) {
        SM.ui.toast('Miembro añadido.', 'ok');
        if (onSaved) onSaved(data);
      }).catch(function (err) { SM.ui.toast(err.message, 'error'); });
    });
  }

  function settingsFormHtml(settings) {
    const s = settings || {};
    return (
      '<form id="settings-form">' +
        '<div class="form-grid">' +
          field('Nombre del club', '<input name="club_nombre" required value="' + esc(s.club_nombre) + '">', true) +
          field('Nombre del entrenador/a', '<input name="entrenador_nombre" required value="' + esc(s.entrenador_nombre) + '">', true) +
          field('Rol', '<input name="entrenador_rol" value="' + esc(s.entrenador_rol || 'Entrenador') + '">', true) +
          field('Liga / competición (texto libre)', '<input name="liga_nombre" placeholder="Ej. Liga Alevín A · Grupo 3" value="' + esc(s.liga_nombre) + '">', true) +
        '</div>' +
        '<div class="form-actions">' +
          '<button type="button" class="btn btn-outline" id="cancel-btn">Cancelar</button>' +
          '<button type="submit" class="btn btn-primary">Guardar</button>' +
        '</div>' +
      '</form>'
    );
  }

  // Opens the club/coach settings modal and wires submit -> updateSettings.
  function openSettingsForm(current, onSaved) {
    const body = SM.ui.el('div', { html: settingsFormHtml(current) });
    const handle = SM.ui.openModal('Configuración del club', body);
    body.querySelector('#cancel-btn').addEventListener('click', handle.close);
    body.querySelector('#settings-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const payload = {};
      new FormData(e.target).forEach(function (v, k) { payload[k] = v; });
      SM.api.postAction('updateSettings', payload).then(function () {
        handle.close();
        return SM.api.fetchAll(true);
      }).then(function (data) {
        SM.sidebar.applySettings(data.settings);
        SM.ui.toast('Configuración guardada.', 'ok');
        if (onSaved) onSaved(data);
      }).catch(function (err) { SM.ui.toast(err.message, 'error'); });
    });
  }

  // ---- sessions: recurring creation + shared attendance-taking modal
  // (used by both asistencia.html and calendario.html, so the "fix a
  // mistake" flow — edit or delete a single session — lives in one place). ----

  const WEEKDAY_OPTIONS = [
    { value: 1, label: 'Lun' }, { value: 2, label: 'Mar' }, { value: 3, label: 'Mié' },
    { value: 4, label: 'Jue' }, { value: 5, label: 'Vie' }, { value: 6, label: 'Sáb' }, { value: 0, label: 'Dom' }
  ];
  const DEFAULT_WEEKDAYS = [1, 3, 5];

  const isoDate = SM.ui.formatDateIso;

  function recurringSessionFormHtml() {
    const today = new Date();
    const in3Months = new Date(today);
    in3Months.setMonth(in3Months.getMonth() + 3);
    return (
      '<form id="recurring-session-form">' +
        '<div class="form-grid">' +
          field('Desde', '<input name="fechaInicio" type="date" required value="' + isoDate(today) + '">') +
          field('Hasta', '<input name="fechaFin" type="date" required value="' + isoDate(in3Months) + '">') +
          field('Hora', '<input name="hora" type="time" value="17:00">') +
          field('Lugar', '<input name="lugar" placeholder="Campo Municipal La Ribera">', true) +
        '</div>' +
        '<div class="form-hint" style="margin:16px 0 8px;">Días de entrenamiento — se crea una sesión por cada uno de estos días entre las fechas de arriba. Para un único día puntual, deja "Desde" y "Hasta" iguales y marca solo ese día.</div>' +
        '<div class="filter-row">' +
          WEEKDAY_OPTIONS.map(function (d) {
            return '<button type="button" class="pill toggle-day' + (DEFAULT_WEEKDAYS.indexOf(d.value) !== -1 ? ' active' : '') + '" data-day="' + d.value + '">' + d.label + '</button>';
          }).join('') +
        '</div>' +
        '<div class="form-actions">' +
          '<button type="button" class="btn btn-outline" id="cancel-btn">Cancelar</button>' +
          '<button type="submit" class="btn btn-primary">Crear sesiones</button>' +
        '</div>' +
      '</form>'
    );
  }

  // Replaces one-at-a-time session creation: pick the weekdays the team
  // trains on (e.g. Lun/Mié/Vie) and a date range, and every matching date
  // gets its own Sessions row in one go — still editable/deletable
  // individually afterwards via openAttendanceModal below.
  function openRecurringSessionForm(onSaved) {
    const body = SM.ui.el('div', { html: recurringSessionFormHtml() });
    const handle = SM.ui.openModal('Nuevas sesiones de entrenamiento', body);
    body.querySelector('#cancel-btn').addEventListener('click', handle.close);
    body.querySelectorAll('.toggle-day').forEach(function (btn) {
      btn.addEventListener('click', function () { btn.classList.toggle('active'); });
    });
    body.querySelector('#recurring-session-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const dias = Array.prototype.slice.call(body.querySelectorAll('.toggle-day.active')).map(function (b) { return Number(b.getAttribute('data-day')); });
      if (!dias.length) { SM.ui.toast('Selecciona al menos un día de la semana.', 'error'); return; }
      const payload = { diasSemana: dias, categoria: SM.team.current() };
      new FormData(e.target).forEach(function (v, k) { payload[k] = v; });
      let createdCount = 0;
      SM.api.postAction('addRecurringSessions', payload).then(function (created) {
        createdCount = (created || []).length;
        handle.close();
        return SM.api.fetchAll(true);
      }).then(function (data) {
        SM.ui.toast(createdCount + (createdCount === 1 ? ' sesión creada.' : ' sesiones creadas.'), 'ok');
        if (onSaved) onSaved(data);
      }).catch(function (err) { SM.ui.toast(err.message, 'error'); });
    });
  }

  const ATTENDANCE_STATES = [
    { key: 'presente', label: 'Presente', color: 'var(--green)' },
    { key: 'ausente', label: 'Ausente', color: 'var(--red)' },
    { key: 'justificado', label: 'Justificado', color: 'var(--amber)' }
  ];

  // Shared "tomar asistencia" modal: pick a session, mark each player, and
  // (for training sessions, not match days) fix its date/hora/lugar or
  // delete it outright if it was created by mistake.
  function openAttendanceModal(data, preselectSessionId, onSaved) {
    const allSessions = data.sessions.slice().sort(function (a, b) { return b.fecha.localeCompare(a.fecha); });
    if (!allSessions.length) { SM.ui.toast('Todavía no hay sesiones creadas.', 'error'); return; }
    const initialId = preselectSessionId || allSessions[0].id;

    const body = SM.ui.el('div', {
      html:
        '<div class="form-field span-2" style="margin-bottom:12px;"><label>Sesión</label>' +
          '<select id="session-select">' + allSessions.map(function (s) {
            const label = SM.ui.formatDateLong(s.fecha) + ' · ' + (s.tipo === 'partido' ? 'Partido' : 'Entrenamiento') + (s.hora ? ' · ' + s.hora : '');
            return '<option value="' + s.id + '"' + (s.id === initialId ? ' selected' : '') + '>' + label + '</option>';
          }).join('') + '</select></div>' +
        '<div id="session-actions" style="margin-bottom:12px;"></div>' +
        '<div id="session-edit-fields"></div>' +
        '<div id="player-toggle-list" style="display:flex;flex-direction:column;gap:10px;max-height:380px;overflow-y:auto;"></div>' +
        '<div class="form-actions"><button type="button" class="btn btn-outline" id="cancel-btn">Cancelar</button><button type="button" class="btn btn-primary" id="save-btn">Guardar asistencia</button></div>'
    });
    const handle = SM.ui.openModal('Tomar asistencia', body);
    body.querySelector('#cancel-btn').addEventListener('click', handle.close);

    function currentSession() {
      const id = body.querySelector('#session-select').value;
      return data.sessions.find(function (s) { return s.id === id; });
    }

    function renderSessionActions() {
      const s = currentSession();
      const actions = body.querySelector('#session-actions');
      body.querySelector('#session-edit-fields').innerHTML = '';
      if (!s) { actions.innerHTML = ''; return; }
      if (s.tipo === 'partido') {
        actions.innerHTML = '<span style="font-size:12px;color:var(--text-mute);">Este día es un partido — edítalo desde Partidos.</span>';
        return;
      }
      actions.innerHTML =
        '<div style="display:flex;gap:8px;">' +
          '<button type="button" class="btn btn-outline" id="edit-session-btn" style="padding:6px 12px;font-size:12.5px;">Editar sesión</button>' +
          '<button type="button" class="btn btn-outline" id="delete-session-btn" style="padding:6px 12px;font-size:12.5px;color:var(--red-bright);">Eliminar sesión</button>' +
        '</div>';
      actions.querySelector('#edit-session-btn').addEventListener('click', function () { showEditFields(s); });
      actions.querySelector('#delete-session-btn').addEventListener('click', function () {
        if (!window.confirm('¿Eliminar esta sesión y su asistencia registrada? No se puede deshacer.')) return;
        SM.api.postAction('deleteSession', { id: s.id }).then(function () {
          handle.close();
          return SM.api.fetchAll(true);
        }).then(function (newData) {
          SM.ui.toast('Sesión eliminada.', 'ok');
          if (onSaved) onSaved(newData);
        }).catch(function (err) { SM.ui.toast(err.message, 'error'); });
      });
    }

    function showEditFields(s) {
      const box = body.querySelector('#session-edit-fields');
      box.innerHTML =
        '<div class="form-grid" style="margin:12px 0;">' +
          field('Fecha', '<input name="fecha" type="date" value="' + esc(s.fecha) + '">') +
          field('Hora', '<input name="hora" type="time" value="' + esc(s.hora || '') + '">') +
          field('Lugar', '<input name="lugar" value="' + esc(s.lugar || '') + '">', true) +
        '</div>' +
        '<button type="button" class="btn btn-primary" id="save-session-edit" style="padding:6px 14px;font-size:12.5px;margin-bottom:12px;">Guardar cambios de la sesión</button>';
      box.querySelector('#save-session-edit').addEventListener('click', function () {
        const patch = { id: s.id };
        box.querySelectorAll('input').forEach(function (input) { patch[input.name] = input.value; });
        SM.api.postAction('updateSession', patch).then(function () {
          handle.close();
          return SM.api.fetchAll(true);
        }).then(function (newData) {
          SM.ui.toast('Sesión actualizada.', 'ok');
          if (onSaved) onSaved(newData);
        }).catch(function (err) { SM.ui.toast(err.message, 'error'); });
      });
    }

    const state = {};
    function loadSession(sessionId) {
      const players = data.players.filter(function (p) { return p.activo; }).sort(function (a, b) { return (a.dorsal || 99) - (b.dorsal || 99); });
      players.forEach(function (p) {
        const row = data.attendance.find(function (a) { return a.session_id === sessionId && a.player_id === p.id; });
        state[p.id] = row ? row.estado : 'presente';
      });
      renderToggleList(players);
      renderSessionActions();
    }

    function renderToggleList(players) {
      const list = body.querySelector('#player-toggle-list');
      list.innerHTML = players.map(function (p) {
        return (
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">' +
            '<div style="display:flex;align-items:center;gap:10px;">' + SM.ui.avatarHtml(p.foto_url, 30) + '<span style="font-size:13.5px;font-weight:600;color:var(--text);">' + SM.ui.escapeHtml(p.nombre) + '</span></div>' +
            '<div style="display:flex;gap:6px;" data-player="' + p.id + '">' +
              ATTENDANCE_STATES.map(function (s) {
                return '<button type="button" class="pill toggle-state" data-state="' + s.key + '" style="padding:6px 12px;font-size:12px;' + (state[p.id] === s.key ? 'background:' + SM.ui.alpha(s.color, 0.18) + ';color:' + s.color + ';font-weight:700;' : '') + '">' + s.label + '</button>';
              }).join('') +
            '</div>' +
          '</div>'
        );
      }).join('');
      list.querySelectorAll('.toggle-state').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const playerId = btn.parentElement.getAttribute('data-player');
          state[playerId] = btn.getAttribute('data-state');
          renderToggleList(players);
        });
      });
    }

    body.querySelector('#session-select').addEventListener('change', function (e) { loadSession(e.target.value); });
    loadSession(initialId);

    body.querySelector('#save-btn').addEventListener('click', function () {
      const sessionId = body.querySelector('#session-select').value;
      const rows = Object.keys(state).map(function (playerId) { return { player_id: playerId, estado: state[playerId] }; });
      SM.api.postAction('saveAttendance', { sessionId: sessionId, rows: rows }).then(function () {
        handle.close();
        return SM.api.fetchAll(true);
      }).then(function (newData) {
        SM.ui.toast('Asistencia guardada.', 'ok');
        if (onSaved) onSaved(newData);
      }).catch(function (err) { SM.ui.toast(err.message, 'error'); });
    });
  }

  return {
    esc: esc, field: field, selectHtml: selectHtml,
    playerFormHtml: playerFormHtml, staffFormHtml: staffFormHtml, formToPayload: formToPayload,
    openPlayerForm: openPlayerForm, openStaffForm: openStaffForm, openSettingsForm: openSettingsForm,
    openRecurringSessionForm: openRecurringSessionForm, openAttendanceModal: openAttendanceModal
  };
})();
