/**
 * SM Stats — backend en Google Apps Script.
 *
 * Qué hace: expone la Google Sheet como una pequeña API JSON que la web
 * estática (GitHub Pages) usa como base de datos.
 *   - GET  ?action=data   -> devuelve todas las pestañas en un único JSON.
 *   - POST { action, token, payload } -> ejecuta una escritura concreta.
 *
 * Cómo desplegarlo: ver README.md en la raíz del repo, sección
 * "Conectar Google Sheets". En resumen: pega este archivo en
 * Extensions > Apps Script DE LA PROPIA HOJA (para que quede vinculado a
 * ella), rellena la propiedad de script TOKEN si quieres un mínimo de
 * protección, y despliega como aplicación web ("Ejecutar como: yo",
 * "Quién tiene acceso: cualquiera con el enlace").
 *
 * Nota de seguridad: TOKEN es una comprobación simple para evitar que
 * cualquiera escriba en la hoja por accidente, no una autenticación real.
 * Si necesitas control de acceso serio, esto no es suficiente.
 */

const SHEETS = {
  players: 'Players',
  staff: 'Staff',
  sessions: 'Sessions',
  attendance: 'Attendance',
  matches: 'Matches',
  matchEvents: 'MatchEvents',
  matchAppearances: 'MatchAppearances'
};

const PLAYER_COLUMNS = ['id', 'nombre', 'dorsal', 'posicion', 'posicion_secundaria', 'pie', 'fecha_nacimiento', 'nacionalidad', 'altura_cm', 'peso_kg', 'contacto_emergencia', 'categoria', 'club_anterior', 'fecha_alta', 'foto_url', 'activo', 'ritmo', 'tiro', 'pase', 'regate', 'defensa', 'fisico'];
const STAFF_COLUMNS = ['id', 'nombre', 'rol', 'licencia', 'fecha_alta', 'foto_url'];
const SESSION_COLUMNS = ['id', 'fecha', 'hora', 'tipo', 'lugar', 'match_id'];
const ATTENDANCE_COLUMNS = ['id', 'session_id', 'player_id', 'estado'];
const MATCH_COLUMNS = ['id', 'fecha', 'hora', 'rival', 'condicion', 'lugar', 'jornada', 'goles_favor', 'goles_contra', 'jugado'];
const EVENT_COLUMNS = ['id', 'match_id', 'player_id', 'tipo'];
const APPEARANCE_COLUMNS = ['id', 'match_id', 'player_id', 'minutos', 'valoracion'];

/** Crea las 7 pestañas con sus cabeceras si no existen todavía.
 *  Ejecuta esta función UNA VEZ desde el editor de Apps Script (botón
 *  "Ejecutar" con setupSheets seleccionada) para preparar una hoja nueva. */
function setupSheets() {
  const ss = getSpreadsheet();
  const defs = [
    [SHEETS.players, PLAYER_COLUMNS],
    [SHEETS.staff, STAFF_COLUMNS],
    [SHEETS.sessions, SESSION_COLUMNS],
    [SHEETS.attendance, ATTENDANCE_COLUMNS],
    [SHEETS.matches, MATCH_COLUMNS],
    [SHEETS.matchEvents, EVENT_COLUMNS],
    [SHEETS.matchAppearances, APPEARANCE_COLUMNS]
  ];
  defs.forEach(function (def) {
    const name = def[0], columns = def[1];
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
      sheet.setFrozenRows(1);
    }
  });
  const defaultSheet = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > defs.length) ss.deleteSheet(defaultSheet);
}

function getSpreadsheet() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  const sheet = getSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('No existe la pestaña "' + name + '". Ejecuta setupSheets() primero.');
  return sheet;
}

function sheetToObjects(name) {
  const sheet = getSheet(name);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const header = values[0].map(String);
  return values.slice(1)
    .filter(function (r) { return r.some(function (c) { return c !== '' && c !== null; }); })
    .map(function (r) {
      const obj = {};
      header.forEach(function (col, i) { obj[col] = normalizeCell(r[i]); });
      return obj;
    });
}

function normalizeCell(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return v;
}

function appendRow(name, columns, obj) {
  getSheet(name).appendRow(columns.map(function (c) { return obj[c] !== undefined ? obj[c] : ''; }));
}

function findRowIndexById(sheet, id) {
  const values = sheet.getDataRange().getValues();
  const idCol = values[0].indexOf('id');
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(id)) return i + 1;
  }
  return -1;
}

function updateRowById(name, columns, id, patch) {
  const sheet = getSheet(name);
  const rowIndex = findRowIndexById(sheet, id);
  if (rowIndex === -1) throw new Error('No se encontró la fila con id ' + id + ' en ' + name + '.');
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  header.forEach(function (col, i) {
    if (patch[col] !== undefined) sheet.getRange(rowIndex, i + 1).setValue(patch[col]);
  });
}

function deleteRowsWhere(name, matchColumn, matchValue) {
  const sheet = getSheet(name);
  const values = sheet.getDataRange().getValues();
  const col = values[0].indexOf(matchColumn);
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][col]) === String(matchValue)) sheet.deleteRow(i + 1);
  }
}

function newId(prefix) {
  return prefix + Utilities.getUuid().slice(0, 8);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkToken(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (expected && token !== expected) throw new Error('Token no válido.');
}

// ---- entry points ----

function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action;
    if (action !== 'data') throw new Error('Acción GET desconocida: ' + action);
    const data = {
      players: sheetToObjects(SHEETS.players).map(coercePlayer),
      staff: sheetToObjects(SHEETS.staff),
      sessions: sheetToObjects(SHEETS.sessions),
      attendance: sheetToObjects(SHEETS.attendance),
      matches: sheetToObjects(SHEETS.matches).map(coerceMatch),
      matchEvents: sheetToObjects(SHEETS.matchEvents),
      matchAppearances: sheetToObjects(SHEETS.matchAppearances).map(coerceAppearance)
    };
    return jsonResponse({ ok: true, result: data });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    checkToken(body.token);
    const handlers = {
      addPlayer: addPlayer,
      updatePlayer: updatePlayer,
      addStaffMember: addStaffMember,
      addMatch: addMatch,
      addSession: addSession,
      saveMatchReport: saveMatchReport,
      saveAttendance: saveAttendance
    };
    const handler = handlers[body.action];
    if (!handler) throw new Error('Acción desconocida: ' + body.action);
    const result = handler(body.payload || {});
    return jsonResponse({ ok: true, result: result });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ---- action handlers (one per write the frontend can perform) ----

function addPlayer(payload) {
  const row = Object.assign({ id: newId('p'), activo: true }, payload);
  appendRow(SHEETS.players, PLAYER_COLUMNS, row);
  return row;
}

function updatePlayer(payload) {
  if (!payload.id) throw new Error('Falta el id del jugador.');
  updateRowById(SHEETS.players, PLAYER_COLUMNS, payload.id, payload);
  return payload;
}

function addStaffMember(payload) {
  const row = Object.assign({ id: newId('s') }, payload);
  appendRow(SHEETS.staff, STAFF_COLUMNS, row);
  return row;
}

function addMatch(payload) {
  const row = Object.assign({ id: newId('m'), jugado: false, goles_favor: '', goles_contra: '' }, payload);
  appendRow(SHEETS.matches, MATCH_COLUMNS, row);
  // Un partido es también una sesión, así aparece en la tabla de asistencia.
  appendRow(SHEETS.sessions, SESSION_COLUMNS, {
    id: newId('se'), fecha: row.fecha, hora: row.hora, tipo: 'partido', lugar: row.lugar, match_id: row.id
  });
  return row;
}

function addSession(payload) {
  const row = Object.assign({ id: newId('se'), tipo: 'entrenamiento', match_id: '' }, payload);
  appendRow(SHEETS.sessions, SESSION_COLUMNS, row);
  return row;
}

function saveMatchReport(payload) {
  const matchId = payload.matchId;
  if (!matchId) throw new Error('Falta el id del partido.');
  const hasResult = payload.golesFavor !== null && payload.golesFavor !== undefined &&
    payload.golesContra !== null && payload.golesContra !== undefined;
  updateRowById(SHEETS.matches, MATCH_COLUMNS, matchId, {
    goles_favor: hasResult ? payload.golesFavor : '',
    goles_contra: hasResult ? payload.golesContra : '',
    jugado: hasResult
  });
  deleteRowsWhere(SHEETS.matchAppearances, 'match_id', matchId);
  deleteRowsWhere(SHEETS.matchEvents, 'match_id', matchId);
  (payload.appearances || []).forEach(function (a) {
    appendRow(SHEETS.matchAppearances, APPEARANCE_COLUMNS, Object.assign({ id: newId('ma') }, a, { match_id: matchId }));
  });
  (payload.events || []).forEach(function (ev) {
    appendRow(SHEETS.matchEvents, EVENT_COLUMNS, Object.assign({ id: newId('e') }, ev, { match_id: matchId }));
  });
  return true;
}

function saveAttendance(payload) {
  const sessionId = payload.sessionId;
  if (!sessionId) throw new Error('Falta el id de la sesión.');
  deleteRowsWhere(SHEETS.attendance, 'session_id', sessionId);
  (payload.rows || []).forEach(function (r) {
    appendRow(SHEETS.attendance, ATTENDANCE_COLUMNS, Object.assign({ id: newId('at') }, r, { session_id: sessionId }));
  });
  return true;
}

// ---- coercion (una hoja editada a mano puede guardar números/booleans como texto) ----

function coercePlayer(p) {
  ['dorsal', 'altura_cm', 'peso_kg', 'ritmo', 'tiro', 'pase', 'regate', 'defensa', 'fisico'].forEach(function (k) {
    p[k] = p[k] === '' || p[k] === undefined ? null : Number(p[k]);
  });
  p.activo = p.activo === true || p.activo === 'TRUE' || p.activo === 'true' || p.activo === 1;
  return p;
}

function coerceMatch(m) {
  ['jornada', 'goles_favor', 'goles_contra'].forEach(function (k) {
    m[k] = m[k] === '' || m[k] === undefined ? null : Number(m[k]);
  });
  m.jugado = m.jugado === true || m.jugado === 'TRUE' || m.jugado === 'true' || m.jugado === 1;
  return m;
}

function coerceAppearance(a) {
  a.minutos = a.minutos === '' || a.minutos === undefined ? 0 : Number(a.minutos);
  a.valoracion = a.valoracion === '' || a.valoracion === undefined ? null : Number(a.valoracion);
  return a;
}
