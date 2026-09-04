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
          field('Categoría', '<input name="categoria" value="' + esc(p.categoria || 'Senior') + '">') +
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

  return {
    esc: esc, field: field, selectHtml: selectHtml,
    playerFormHtml: playerFormHtml, staffFormHtml: staffFormHtml, formToPayload: formToPayload,
    openPlayerForm: openPlayerForm, openStaffForm: openStaffForm, openSettingsForm: openSettingsForm
  };
})();
