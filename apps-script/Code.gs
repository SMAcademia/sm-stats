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
  matchAppearances: 'MatchAppearances',
  matchIntervals: 'MatchIntervals',
  settings: 'Settings'
};

const PLAYER_COLUMNS = ['id', 'nombre', 'dorsal', 'posicion', 'posicion_secundaria', 'pie', 'fecha_nacimiento', 'nacionalidad', 'altura_cm', 'peso_kg', 'contacto_emergencia', 'categoria', 'club_anterior', 'fecha_alta', 'foto_url', 'activo', 'ritmo', 'tiro', 'pase', 'regate', 'defensa', 'fisico'];
const STAFF_COLUMNS = ['id', 'nombre', 'rol', 'licencia', 'fecha_alta', 'foto_url'];
const SESSION_COLUMNS = ['id', 'fecha', 'hora', 'tipo', 'lugar', 'match_id', 'categoria'];
const ATTENDANCE_COLUMNS = ['id', 'session_id', 'player_id', 'estado'];
const MATCH_COLUMNS = ['id', 'fecha', 'hora', 'rival', 'condicion', 'lugar', 'jornada', 'competicion', 'categoria', 'goles_favor', 'goles_contra', 'jugado'];
const EVENT_COLUMNS = ['id', 'match_id', 'player_id', 'tipo'];
const APPEARANCE_COLUMNS = ['id', 'match_id', 'player_id', 'minutos', 'valoracion', 'capitan'];
const MIN_CONVOCADOS = 7;
// One row per stretch a player spent on the pitch (unlimited substitutions):
// entrada/salida are match minutes, e.g. 0-17 and 34-54 -> 37 minutes total.
const INTERVAL_COLUMNS = ['id', 'match_id', 'player_id', 'entrada', 'salida'];
// Settings is a singleton sheet: header row + exactly one data row (row 2).
const SETTINGS_COLUMNS = ['club_nombre', 'entrenador_nombre', 'entrenador_rol', 'liga_nombre'];
const DEFAULT_SETTINGS = { club_nombre: 'Mi Club', entrenador_nombre: 'Nombre del entrenador', entrenador_rol: 'Entrenador', liga_nombre: 'Liga Regional · Grupo B' };

/** Crea las pestañas con sus cabeceras si no existen todavía.
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
    [SHEETS.matchAppearances, APPEARANCE_COLUMNS],
    [SHEETS.matchIntervals, INTERVAL_COLUMNS],
    [SHEETS.settings, SETTINGS_COLUMNS]
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
  // Settings needs exactly one data row to edit — seed it with placeholders
  // the coach is meant to overwrite from the app's settings form.
  const settingsSheet = ss.getSheetByName(SHEETS.settings);
  if (settingsSheet && settingsSheet.getLastRow() < 2) {
    settingsSheet.appendRow(SETTINGS_COLUMNS.map(function (c) { return DEFAULT_SETTINGS[c]; }));
  }
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
      header.forEach(function (col, i) { obj[col] = normalizeCell(r[i], col); });
      return obj;
    });
}

// Sheets stores a "hora"-only cell as a Date on its time-value epoch
// (1899-12-30) — format those as HH:mm, not as a (meaningless) date, or the
// time gets silently dropped and "1899-12-30" leaks into the app instead.
function normalizeCell(v, columnName) {
  if (v instanceof Date) {
    if (columnName === 'hora') {
      return Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm');
    }
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return v;
}

// Extends a sheet's header (adding any of `columns` it's missing, at the end)
// and returns the resulting header — so a sheet the coach set up by hand
// before a field existed picks up new columns instead of misaligning data.
function ensureHeader(sheet, columns) {
  let header = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String) : [];
  columns.forEach(function (c) {
    if (header.indexOf(c) === -1) {
      sheet.getRange(1, header.length + 1).setValue(c);
      header.push(c);
    }
  });
  return header;
}

// Appends by column NAME (via the sheet's actual header), not by array
// position — safe even if the sheet's column order doesn't match `columns`.
function appendRow(name, columns, obj) {
  const sheet = getSheet(name);
  const header = ensureHeader(sheet, columns);
  sheet.appendRow(header.map(function (c) { return obj[c] !== undefined ? obj[c] : ''; }));
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

function readSingletonRow(name, columns, defaults) {
  const sheet = getSpreadsheet().getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 2) return Object.assign({}, defaults);
  const values = sheet.getRange(1, 1, 2, sheet.getLastColumn()).getValues();
  const header = values[0].map(String);
  const row = values[1];
  const obj = {};
  header.forEach(function (col, i) { obj[col] = normalizeCell(row[i], col); });
  columns.forEach(function (c) {
    if (obj[c] === '' || obj[c] === undefined || obj[c] === null) obj[c] = defaults[c];
  });
  return obj;
}

function writeSingletonRow(name, columns, patch) {
  let sheet = getSpreadsheet().getSheetByName(name);
  if (!sheet) {
    sheet = getSpreadsheet().insertSheet(name);
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    sheet.setFrozenRows(1);
  }
  const header = ensureHeader(sheet, columns);
  if (sheet.getLastRow() < 2) {
    sheet.appendRow(header.map(function (c) { return patch[c] !== undefined ? patch[c] : ''; }));
  } else {
    header.forEach(function (col, i) {
      if (patch[col] !== undefined) sheet.getRange(2, i + 1).setValue(patch[col]);
    });
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
      matchAppearances: sheetToObjects(SHEETS.matchAppearances).map(coerceAppearance),
      matchIntervals: sheetToObjects(SHEETS.matchIntervals).map(coerceInterval),
      settings: readSingletonRow(SHEETS.settings, SETTINGS_COLUMNS, DEFAULT_SETTINGS)
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
      addMatches: addMatches,
      addSession: addSession,
      addRecurringSessions: addRecurringSessions,
      updateSession: updateSession,
      deleteSession: deleteSession,
      saveMatchReport: saveMatchReport,
      saveAttendance: saveAttendance,
      updateSettings: updateSettings
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
  return createMatchWithSession(payload);
}

// Bulk version for "Importar calendario" — one call, one round trip, instead
// of a POST per fixture when the league's whole schedule is pasted in.
function addMatches(payload) {
  return (payload.matches || []).map(createMatchWithSession);
}

function createMatchWithSession(payload) {
  const row = Object.assign({ id: newId('m'), jugado: false, goles_favor: '', goles_contra: '' }, payload);
  appendRow(SHEETS.matches, MATCH_COLUMNS, row);
  // Un partido es también una sesión, así aparece en la tabla de asistencia.
  appendRow(SHEETS.sessions, SESSION_COLUMNS, {
    id: newId('se'), fecha: row.fecha, hora: row.hora, tipo: 'partido', lugar: row.lugar, match_id: row.id, categoria: row.categoria
  });
  return row;
}

function addSession(payload) {
  const row = Object.assign({ id: newId('se'), tipo: 'entrenamiento', match_id: '' }, payload);
  appendRow(SHEETS.sessions, SESSION_COLUMNS, row);
  return row;
}

// Creates one training session per date between fechaInicio/fechaFin (both
// inclusive) whose weekday is in diasSemana (0=domingo..6=sábado) — e.g. a
// club training Mon/Wed/Fri all season without adding each date by hand.
function addRecurringSessions(payload) {
  const dias = (payload.diasSemana || []).map(Number);
  if (!dias.length) throw new Error('Selecciona al menos un día de la semana.');
  if (!payload.fechaInicio) throw new Error('Falta la fecha de inicio.');
  const start = new Date(payload.fechaInicio + 'T00:00:00');
  const end = new Date((payload.fechaFin || payload.fechaInicio) + 'T00:00:00');
  const created = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (dias.indexOf(d.getDay()) === -1) continue;
    const row = {
      id: newId('se'),
      fecha: Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      hora: payload.hora || '',
      tipo: 'entrenamiento',
      lugar: payload.lugar || '',
      match_id: '',
      categoria: payload.categoria || ''
    };
    appendRow(SHEETS.sessions, SESSION_COLUMNS, row);
    created.push(row);
  }
  return created;
}

// Fixes a single session's date/time/place — e.g. one Wednesday moves to a
// different court, without touching the rest of the recurring series.
function updateSession(payload) {
  if (!payload.id) throw new Error('Falta el id de la sesión.');
  updateRowById(SHEETS.sessions, SESSION_COLUMNS, payload.id, payload);
  return payload;
}

function deleteSession(payload) {
  if (!payload.id) throw new Error('Falta el id de la sesión.');
  deleteRowsWhere(SHEETS.sessions, 'id', payload.id);
  deleteRowsWhere(SHEETS.attendance, 'session_id', payload.id);
  return true;
}

function saveMatchReport(payload) {
  const matchId = payload.matchId;
  if (!matchId) throw new Error('Falta el id del partido.');
  if ((payload.appearances || []).length < MIN_CONVOCADOS) {
    throw new Error('Se necesitan al menos ' + MIN_CONVOCADOS + ' jugadores convocados para guardar el acta.');
  }
  const hasResult = payload.golesFavor !== null && payload.golesFavor !== undefined &&
    payload.golesContra !== null && payload.golesContra !== undefined;
  updateRowById(SHEETS.matches, MATCH_COLUMNS, matchId, {
    goles_favor: hasResult ? payload.golesFavor : '',
    goles_contra: hasResult ? payload.golesContra : '',
    jugado: hasResult
  });
  deleteRowsWhere(SHEETS.matchAppearances, 'match_id', matchId);
  deleteRowsWhere(SHEETS.matchEvents, 'match_id', matchId);
  deleteRowsWhere(SHEETS.matchIntervals, 'match_id', matchId);
  (payload.appearances || []).forEach(function (a) {
    appendRow(SHEETS.matchAppearances, APPEARANCE_COLUMNS, Object.assign({ id: newId('ma') }, a, { match_id: matchId }));
  });
  (payload.events || []).forEach(function (ev) {
    appendRow(SHEETS.matchEvents, EVENT_COLUMNS, Object.assign({ id: newId('e') }, ev, { match_id: matchId }));
  });
  (payload.intervals || []).forEach(function (iv) {
    appendRow(SHEETS.matchIntervals, INTERVAL_COLUMNS, Object.assign({ id: newId('iv') }, iv, { match_id: matchId }));
  });
  return true;
}

function updateSettings(payload) {
  writeSingletonRow(SHEETS.settings, SETTINGS_COLUMNS, payload);
  return payload;
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
  a.capitan = a.capitan === true || a.capitan === 'TRUE' || a.capitan === 'true' || a.capitan === 1;
  return a;
}

function coerceInterval(iv) {
  iv.entrada = iv.entrada === '' || iv.entrada === undefined ? 0 : Number(iv.entrada);
  iv.salida = iv.salida === '' || iv.salida === undefined ? 0 : Number(iv.salida);
  return iv;
}
