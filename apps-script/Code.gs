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
  matchLiveEvents: 'MatchLiveEvents',
  checkins: 'Checkins',
  planEntries: 'PlanEntries',
  devGoals: 'DevGoals',
  settings: 'Settings'
};

// motivo_baja/fecha_baja: rellenos solo mientras activo=false (baja por
// lesión/vacaciones/abandono/otro) — se limpian al reactivar. No borran ni
// afectan a ninguna otra fila: todas las estadísticas del jugador siguen
// intactas en sus propias hojas, solo dejan de contarse mientras esté de
// baja porque el resto de la app ya filtra por activo.
const PLAYER_COLUMNS = ['id', 'nombre', 'dorsal', 'posicion', 'posicion_secundaria', 'pie', 'fecha_nacimiento', 'nacionalidad', 'altura_cm', 'peso_kg', 'contacto_emergencia', 'categoria', 'club_anterior', 'fecha_alta', 'foto_url', 'activo', 'motivo_baja', 'fecha_baja', 'ritmo', 'tiro', 'pase', 'regate', 'defensa', 'fisico', 'companerismo', 'sacrificio', 'respeto', 'motivacion', 'esfuerzo', 'constancia', 'blocaje', 'despeje', 'comunicacion', 'posicionamiento', 'unoxuno', 'abp'];
const STAFF_COLUMNS = ['id', 'nombre', 'rol', 'licencia', 'fecha_alta', 'foto_url'];
const SESSION_COLUMNS = ['id', 'fecha', 'hora', 'tipo', 'lugar', 'match_id', 'categoria'];
const ATTENDANCE_COLUMNS = ['id', 'session_id', 'player_id', 'estado'];
const MATCH_COLUMNS = ['id', 'fecha', 'hora', 'rival', 'condicion', 'lugar', 'jornada', 'competicion', 'categoria', 'goles_favor', 'goles_contra', 'jugado'];
const EVENT_COLUMNS = ['id', 'match_id', 'player_id', 'tipo'];
const APPEARANCE_COLUMNS = ['id', 'match_id', 'player_id', 'minutos', 'valoracion', 'capitan'];
const MIN_CONVOCADOS = 7;
const TITULARES_MINUTO_CERO = 7;
// One row per stretch a player spent on the pitch (unlimited substitutions):
// entrada/salida are match minutes, e.g. 0-17 and 34-54 -> 37 minutes total.
const INTERVAL_COLUMNS = ['id', 'match_id', 'player_id', 'entrada', 'salida'];
// Registro en vivo (taps durante el partido) — independiente del acta.
// team: 'propio' | 'rival'. tipo: marcadores de fase (inicio_1, fin_1,
// inicio_2, fin_2, sin equipo/jugador) o eventos (gol, asistencia,
// amarilla, roja, falta_hecha, falta_recibida, tiro, tiro_puerta,
// llegada_izq, llegada_cen, llegada_der, corner). player_id solo para
// team=propio; dorsal_rival (opcional, solo número) para team=rival.
const LIVE_EVENT_COLUMNS = ['id', 'match_id', 'team', 'player_id', 'dorsal_rival', 'tipo', 'minuto', 'parte', 'ts'];
// Check-in de bienestar — lo rellena el propio jugador tras un entrenamiento
// o partido (session_id cubre ambos) desde un enlace sin login, eligiendo su
// nombre de la plantilla. satisfaccion/rendimiento: 1=rojo, 2=naranja,
// 3=amarillo, 4=verde. Un jugador solo tiene una fila por sesión — reenviar
// sobrescribe la anterior.
const CHECKIN_COLUMNS = ['id', 'session_id', 'player_id', 'satisfaccion', 'comentario_satisfaccion', 'rendimiento', 'comentario_rendimiento', 'ts'];
// Planificación del cuerpo técnico — objetivos por día y categoría (equipo).
// Una fila por día+categoría (id = "<fecha>::<categoria>", no autogenerado),
// así guardar el mismo día dos veces actualiza la fila en vez de duplicarla.
// Los 5 campos son texto libre (el entrenador puede escribir varias líneas).
const PLAN_COLUMNS = ['id', 'fecha', 'categoria', 'tecnico', 'tactico', 'fisico', 'valores', 'porteros'];
// Plan de desarrollo individual — objetivos que el entrenador fija a UN
// jugador concreto (no al equipo, a diferencia de PlanEntries). categoria:
// tecnico/tactico/fisico/valores/porteros (mismas 5 de Planificación).
// estado: pendiente / en_progreso / conseguido.
const DEV_GOAL_COLUMNS = ['id', 'player_id', 'categoria', 'texto', 'estado', 'fecha_creacion', 'fecha_actualizacion'];
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
    [SHEETS.matchLiveEvents, LIVE_EVENT_COLUMNS],
    [SHEETS.checkins, CHECKIN_COLUMNS],
    [SHEETS.planEntries, PLAN_COLUMNS],
    [SHEETS.devGoals, DEV_GOAL_COLUMNS],
    [SHEETS.settings, SETTINGS_COLUMNS]
  ];
  defs.forEach(function (def) {
    const name = def[0], columns = def[1];
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
      sheet.setFrozenRows(1);
    } else {
      // La pestaña ya existía (con datos) antes de que se añadieran estas
      // columnas — hay que ampliar su cabecera, no solo crearla de cero.
      ensureHeader(sheet, columns);
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

// Like sheetToObjects, but returns [] instead of throwing when the sheet
// doesn't exist yet — used for MatchLiveEvents so an existing Sheet that
// hasn't re-run setupSheets() after this feature was added still loads the
// rest of the app instead of failing doGet entirely.
function sheetToObjectsOrEmpty(name) {
  const sheet = getSpreadsheet().getSheetByName(name);
  return sheet ? sheetToObjects(name) : [];
}

// Sheets stores a "hora"-only cell as a Date on its time-value epoch
// (1899-12-30) — format those as HH:mm, not as a (meaningless) date, or the
// time gets silently dropped and "1899-12-30" leaks into the app instead.
//
// IMPORTANT: format using the SPREADSHEET's timezone, not the Apps Script
// project's (Session.getScriptTimeZone()) — those two can differ, and since
// Sheets stores a time-of-day as a timezone-less day-fraction, formatting it
// in the wrong timezone silently shifts the hour (e.g. a project timezone
// left on its default while the coach is in Canarias/GMT).
function normalizeCell(v, columnName) {
  if (v instanceof Date) {
    const tz = getSpreadsheet().getSpreadsheetTimeZone();
    if (columnName === 'hora') {
      return Utilities.formatDate(v, tz, 'HH:mm');
    }
    return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
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
  // ensureHeader (no solo leer la cabecera tal cual) — si `columns` incluye
  // un campo añadido después de que esta fila existiera, hay que crear esa
  // columna antes de poder escribir en ella, o el valor se pierde en silencio.
  const header = ensureHeader(sheet, columns);
  header.forEach(function (col, i) {
    if (patch[col] !== undefined) sheet.getRange(rowIndex, i + 1).setValue(patch[col]);
  });
}

function findRowIndexByColumn(sheet, column, value) {
  const values = sheet.getDataRange().getValues();
  const col = values[0].indexOf(column);
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][col]) === String(value)) return i + 1;
  }
  return -1;
}

// Like updateRowById, but matches by any column — used to keep a match's
// linked Sessions row (matched by match_id, not id) in sync.
function updateRowByColumn(name, columns, matchColumn, matchValue, patch) {
  const sheet = getSheet(name);
  const rowIndex = findRowIndexByColumn(sheet, matchColumn, matchValue);
  if (rowIndex === -1) return false;
  const header = ensureHeader(sheet, columns);
  header.forEach(function (col, i) {
    if (patch[col] !== undefined) sheet.getRange(rowIndex, i + 1).setValue(patch[col]);
  });
  return true;
}

function deleteRowsWhere(name, matchColumn, matchValue) {
  const sheet = getSheet(name);
  const values = sheet.getDataRange().getValues();
  const col = values[0].indexOf(matchColumn);
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][col]) === String(matchValue)) sheet.deleteRow(i + 1);
  }
}

// Like deleteRowsWhere, but a no-op if the sheet doesn't exist yet — used
// for sheets added after this feature (Checkins, MatchLiveEvents) so an
// older workbook that hasn't re-run setupSheets() doesn't throw here.
function deleteRowsWhereIfExists(name, matchColumn, matchValue) {
  if (!getSpreadsheet().getSheetByName(name)) return;
  deleteRowsWhere(name, matchColumn, matchValue);
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
      matchLiveEvents: sheetToObjectsOrEmpty(SHEETS.matchLiveEvents).map(coerceLiveEvent),
      checkins: sheetToObjectsOrEmpty(SHEETS.checkins).map(coerceCheckin),
      planEntries: sheetToObjectsOrEmpty(SHEETS.planEntries),
      devGoals: sheetToObjectsOrEmpty(SHEETS.devGoals),
      settings: readSingletonRow(SHEETS.settings, SETTINGS_COLUMNS, DEFAULT_SETTINGS)
    };
    return jsonResponse({ ok: true, result: data });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

// Sin esto, dos peticiones concurrentes (típico justo después de un
// entrenamiento: varios jugadores enviando su encuesta de bienestar casi a
// la vez desde sus móviles) pueden entrelazarse: cada una lee la hoja,
// decide qué fila borrar/añadir según esa lectura, y la segunda escribe
// sobre una foto ya desactualizada por la primera — el resultado observado
// es que una de las dos respuestas simplemente desaparece. LockService
// serializa las escrituras (se ponen en cola, no se pierden) para toda
// acción de doPost, no solo saveCheckin.
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return jsonResponse({ ok: false, error: 'El servidor está ocupado ahora mismo — inténtalo de nuevo en unos segundos.' });
  }
  try {
    const body = JSON.parse(e.postData.contents);
    checkToken(body.token);
    const handlers = {
      addPlayer: addPlayer,
      updatePlayer: updatePlayer,
      deletePlayer: deletePlayer,
      addStaffMember: addStaffMember,
      addMatch: addMatch,
      addMatches: addMatches,
      updateMatch: updateMatch,
      deleteMatch: deleteMatch,
      addSession: addSession,
      addRecurringSessions: addRecurringSessions,
      updateSession: updateSession,
      deleteSession: deleteSession,
      addLiveEvent: addLiveEvent,
      addLiveEvents: addLiveEvents,
      deleteLiveEvent: deleteLiveEvent,
      deleteLiveEvents: deleteLiveEvents,
      clearLiveEvents: clearLiveEvents,
      saveCheckin: saveCheckin,
      savePlanEntry: savePlanEntry,
      deletePlanEntry: deletePlanEntry,
      saveDevGoal: saveDevGoal,
      deleteDevGoal: deleteDevGoal,
      uploadPhoto: uploadPhoto,
      saveCallups: saveCallups,
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
  } finally {
    lock.releaseLock();
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

// Deletes a player and everything linked to them (asistencia, convocatorias,
// goles/tarjetas, minutos por partido) — e.g. a duplicated player created by
// mistake. Matches themselves are untouched, only this player's rows in them.
function deletePlayer(payload) {
  if (!payload.id) throw new Error('Falta el id del jugador.');
  deleteRowsWhere(SHEETS.players, 'id', payload.id);
  deleteRowsWhere(SHEETS.attendance, 'player_id', payload.id);
  deleteRowsWhere(SHEETS.matchAppearances, 'player_id', payload.id);
  deleteRowsWhere(SHEETS.matchEvents, 'player_id', payload.id);
  deleteRowsWhere(SHEETS.matchIntervals, 'player_id', payload.id);
  deleteRowsWhereIfExists(SHEETS.devGoals, 'player_id', payload.id);
  return true;
}

function addStaffMember(payload) {
  const row = Object.assign({ id: newId('s') }, payload);
  appendRow(SHEETS.staff, STAFF_COLUMNS, row);
  return row;
}

const PHOTOS_FOLDER_NAME = 'SM Stats — Fotos';

function getOrCreatePhotosFolder() {
  const it = DriveApp.getFoldersByName(PHOTOS_FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(PHOTOS_FOLDER_NAME);
}

// Sube una foto (jugador o staff) hecha desde el móvil (cámara, galería o
// archivos/Drive — eso ya lo ofrece el propio selector de archivos del
// navegador, no hay que montar nada aparte) a una carpeta de Drive del
// entrenador y devuelve un enlace directo listo para foto_url. El frontend
// ya redimensiona/comprime la imagen antes de mandarla (ver forms.js), así
// que aquí no hace falta preocuparse por el tamaño.
function uploadPhoto(payload) {
  if (!payload.dataUrl) throw new Error('Falta la imagen.');
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(payload.dataUrl);
  if (!match) throw new Error('Formato de imagen no válido.');
  const mimeType = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  const ext = mimeType.split('/')[1] || 'jpg';
  const blob = Utilities.newBlob(bytes, mimeType, (payload.filename || 'foto') + '.' + ext);
  const file = getOrCreatePhotosFolder().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { url: 'https://drive.google.com/uc?export=view&id=' + file.getId() };
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

// Fixes a scheduled match's rival/fecha/hora/lugar — e.g. the league moves
// a fixture, or it was mistyped. Keeps the linked Sessions row (used by the
// calendar) in sync. Score and convocatoria are untouched here — those are
// only edited via saveMatchReport once the match is played.
function updateMatch(payload) {
  if (!payload.id) throw new Error('Falta el id del partido.');
  const patch = {};
  ['rival', 'fecha', 'hora', 'lugar'].forEach(function (k) {
    if (payload[k] !== undefined) patch[k] = payload[k];
  });
  updateRowById(SHEETS.matches, MATCH_COLUMNS, payload.id, patch);
  updateRowByColumn(SHEETS.sessions, SESSION_COLUMNS, 'match_id', payload.id, patch);
  return payload;
}

// Elimina un partido y TODO lo que cuelga de él: la sesión asociada (con su
// asistencia y check-ins de bienestar de esa sesión), convocatoria, minutos,
// goles/tarjetas y el registro en vivo. Pensado para deshacer una prueba o
// un partido creado por error — no se puede deshacer.
function deleteMatch(payload) {
  if (!payload.id) throw new Error('Falta el id del partido.');
  const matchId = payload.id;
  const sessions = sheetToObjects(SHEETS.sessions).filter(function (s) { return s.match_id === matchId; });
  sessions.forEach(function (s) {
    deleteRowsWhereIfExists(SHEETS.attendance, 'session_id', s.id);
    deleteRowsWhereIfExists(SHEETS.checkins, 'session_id', s.id);
  });
  deleteRowsWhere(SHEETS.sessions, 'match_id', matchId);
  deleteRowsWhere(SHEETS.matchEvents, 'match_id', matchId);
  deleteRowsWhere(SHEETS.matchAppearances, 'match_id', matchId);
  deleteRowsWhere(SHEETS.matchIntervals, 'match_id', matchId);
  deleteRowsWhereIfExists(SHEETS.matchLiveEvents, 'match_id', matchId);
  deleteRowsWhere(SHEETS.matches, 'id', matchId);
  return true;
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
      fecha: Utilities.formatDate(d, getSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd'),
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

// Registro en vivo (taps durante el partido) — independiente del acta.
// addLiveEvent cubre tanto los eventos (gol, tiro, falta...) como los
// marcadores de fase del reloj (inicio_1, fin_1, inicio_2, fin_2).
//
// El id lo genera el propio móvil al tocar (no aquí) y viaja en el
// payload: la consola guarda cada tap al instante en localStorage con ese
// id y lo sincroniza con la hoja en segundo plano (por lotes, ver
// addLiveEvents) — así funciona sin esperar a la red en pleno partido, y
// necesita saber de antemano qué id tendrá cada evento para poder
// deshacerlo localmente antes incluso de que llegue a guardarse aquí.
function addLiveEvent(payload) {
  if (!payload.matchId) throw new Error('Falta el id del partido.');
  if (!payload.tipo) throw new Error('Falta el tipo de evento.');
  const row = {
    id: payload.id || newId('le'),
    match_id: payload.matchId,
    team: payload.team || '',
    player_id: payload.player_id || '',
    dorsal_rival: payload.dorsal_rival != null ? payload.dorsal_rival : '',
    tipo: payload.tipo,
    minuto: payload.minuto != null ? payload.minuto : 0,
    parte: payload.parte != null ? payload.parte : '',
    ts: payload.ts || new Date().toISOString()
  };
  appendRow(SHEETS.matchLiveEvents, LIVE_EVENT_COLUMNS, row);
  return row;
}

// Versión por lotes de addLiveEvent — la consola en vivo acumula los taps
// localmente y los manda de golpe cada pocos segundos, en vez de una
// llamada de red por cada tap.
function addLiveEvents(payload) {
  if (!payload.matchId) throw new Error('Falta el id del partido.');
  const rows = (payload.events || []).map(function (ev) {
    return {
      id: ev.id || newId('le'),
      match_id: payload.matchId,
      team: ev.team || '',
      player_id: ev.player_id || '',
      dorsal_rival: ev.dorsal_rival != null ? ev.dorsal_rival : '',
      tipo: ev.tipo,
      minuto: ev.minuto != null ? ev.minuto : 0,
      parte: ev.parte != null ? ev.parte : '',
      ts: ev.ts || new Date().toISOString()
    };
  });
  rows.forEach(function (row) { appendRow(SHEETS.matchLiveEvents, LIVE_EVENT_COLUMNS, row); });
  return rows;
}

// Deshacer un tap concreto (normalmente el último). Si el tap deshecho
// todavía no había llegado a sincronizarse, la consola ni siquiera llama a
// esto — simplemente lo quita de su cola local.
function deleteLiveEvent(payload) {
  if (!payload.id) throw new Error('Falta el id del evento.');
  deleteRowsWhere(SHEETS.matchLiveEvents, 'id', payload.id);
  return true;
}

// Versión por lotes de deleteLiveEvent, para deshacer eventos que ya se
// habían sincronizado antes de que se pidiera deshacerlos.
function deleteLiveEvents(payload) {
  (payload.ids || []).forEach(function (id) { deleteRowsWhere(SHEETS.matchLiveEvents, 'id', id); });
  return true;
}

// Reinicia por completo el registro en vivo de un partido (empezar de cero).
function clearLiveEvents(payload) {
  if (!payload.matchId) throw new Error('Falta el id del partido.');
  deleteRowsWhere(SHEETS.matchLiveEvents, 'match_id', payload.matchId);
  return true;
}

// Check-in de bienestar de un jugador para una sesión (entreno o partido).
// Reenviar (mismo session_id + player_id) sobrescribe la respuesta anterior
// en vez de acumular filas — así un jugador puede corregirse.
function saveCheckin(payload) {
  if (!payload.sessionId) throw new Error('Falta la sesión.');
  if (!payload.playerId) throw new Error('Falta el jugador.');
  if (!payload.satisfaccion || !payload.rendimiento) throw new Error('Faltan las caritas de satisfacción y rendimiento.');
  const sheet = getSheet(SHEETS.checkins);
  const header = ensureHeader(sheet, CHECKIN_COLUMNS);
  const values = sheet.getDataRange().getValues();
  const sessionCol = header.indexOf('session_id'), playerCol = header.indexOf('player_id');
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][sessionCol]) === String(payload.sessionId) && String(values[i][playerCol]) === String(payload.playerId)) {
      sheet.deleteRow(i + 1);
    }
  }
  const row = {
    id: newId('ck'),
    session_id: payload.sessionId,
    player_id: payload.playerId,
    satisfaccion: payload.satisfaccion,
    comentario_satisfaccion: payload.comentarioSatisfaccion || '',
    rendimiento: payload.rendimiento,
    comentario_rendimiento: payload.comentarioRendimiento || '',
    ts: new Date().toISOString()
  };
  appendRow(SHEETS.checkins, CHECKIN_COLUMNS, row);
  return row;
}

// Planificación del cuerpo técnico: guarda (o actualiza, si ya existía) los
// objetivos de un día para una categoría — id determinista "fecha::categoria"
// en vez de generado al azar, así volver a guardar el mismo día actualiza
// la fila existente en lugar de duplicarla.
function savePlanEntry(payload) {
  if (!payload.fecha) throw new Error('Falta la fecha.');
  if (!payload.categoria) throw new Error('Falta la categoría.');
  const id = payload.fecha + '::' + payload.categoria;
  const sheet = getSheet(SHEETS.planEntries);
  const rowIndex = findRowIndexById(sheet, id);
  const row = {
    id: id,
    fecha: payload.fecha,
    categoria: payload.categoria,
    tecnico: payload.tecnico || '',
    tactico: payload.tactico || '',
    fisico: payload.fisico || '',
    valores: payload.valores || '',
    porteros: payload.porteros || ''
  };
  if (rowIndex === -1) {
    appendRow(SHEETS.planEntries, PLAN_COLUMNS, row);
  } else {
    updateRowById(SHEETS.planEntries, PLAN_COLUMNS, id, row);
  }
  return row;
}

function deletePlanEntry(payload) {
  if (!payload.id) throw new Error('Falta el id de la planificación.');
  deleteRowsWhereIfExists(SHEETS.planEntries, 'id', payload.id);
  return true;
}

// Plan de desarrollo individual: crea (o actualiza, si payload.id viene
// relleno) un objetivo de UN jugador. fecha_creacion solo se fija al crear;
// fecha_actualizacion se refresca en cada guardado (incluido el cambio de
// estado a "conseguido"), así queda constancia de cuándo pasó.
function saveDevGoal(payload) {
  if (!payload.player_id) throw new Error('Falta el jugador.');
  if (!payload.categoria) throw new Error('Falta la categoría del objetivo.');
  if (!payload.texto || !String(payload.texto).trim()) throw new Error('Escribe el objetivo.');
  const today = new Date().toISOString().slice(0, 10);
  const estado = payload.estado || 'pendiente';
  if (payload.id) {
    const patch = { categoria: payload.categoria, texto: payload.texto, estado: estado, fecha_actualizacion: today };
    updateRowById(SHEETS.devGoals, DEV_GOAL_COLUMNS, payload.id, patch);
    return Object.assign({ id: payload.id }, patch);
  }
  const row = {
    id: newId('dg'),
    player_id: payload.player_id,
    categoria: payload.categoria,
    texto: payload.texto,
    estado: estado,
    fecha_creacion: today,
    fecha_actualizacion: today
  };
  appendRow(SHEETS.devGoals, DEV_GOAL_COLUMNS, row);
  return row;
}

function deleteDevGoal(payload) {
  if (!payload.id) throw new Error('Falta el id del objetivo.');
  deleteRowsWhereIfExists(SHEETS.devGoals, 'id', payload.id);
  return true;
}

// Guarda solo la convocatoria (quién va convocado y el capitán), sin exigir
// los datos del partido (minutos, goles, tarjetas) — para poder prepararla
// antes de jugar. Solo toca MatchAppearances; goles/eventos/intervalos se
// deciden después con saveMatchReport, una vez jugado el partido.
function saveCallups(payload) {
  const matchId = payload.matchId;
  if (!matchId) throw new Error('Falta el id del partido.');
  if ((payload.appearances || []).length < MIN_CONVOCADOS) {
    throw new Error('Se necesitan al menos ' + MIN_CONVOCADOS + ' jugadores convocados para guardar la convocatoria.');
  }
  deleteRowsWhere(SHEETS.matchAppearances, 'match_id', matchId);
  (payload.appearances || []).forEach(function (a) {
    appendRow(SHEETS.matchAppearances, APPEARANCE_COLUMNS, Object.assign({ id: newId('ma') }, a, { match_id: matchId }));
  });
  return true;
}

function saveMatchReport(payload) {
  const matchId = payload.matchId;
  if (!matchId) throw new Error('Falta el id del partido.');
  if ((payload.appearances || []).length < MIN_CONVOCADOS) {
    throw new Error('Se necesitan al menos ' + MIN_CONVOCADOS + ' jugadores convocados para guardar el acta.');
  }
  const starters = {};
  (payload.intervals || []).forEach(function (iv) { if (Number(iv.entrada) === 0) starters[iv.player_id] = true; });
  const startersCount = Object.keys(starters).length;
  if (startersCount !== TITULARES_MINUTO_CERO) {
    throw new Error('El 7 inicial (minuto 0) debe ser exactamente ' + TITULARES_MINUTO_CERO + ' jugadores — ahora mismo hay ' + startersCount + '.');
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
  ['dorsal', 'altura_cm', 'peso_kg', 'ritmo', 'tiro', 'pase', 'regate', 'defensa', 'fisico', 'companerismo', 'sacrificio', 'respeto', 'motivacion', 'esfuerzo', 'constancia', 'blocaje', 'despeje', 'comunicacion', 'posicionamiento', 'unoxuno', 'abp'].forEach(function (k) {
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

function coerceLiveEvent(le) {
  le.minuto = le.minuto === '' || le.minuto === undefined ? 0 : Number(le.minuto);
  le.parte = le.parte === '' || le.parte === undefined ? null : Number(le.parte);
  le.dorsal_rival = le.dorsal_rival === '' || le.dorsal_rival === undefined ? null : Number(le.dorsal_rival);
  return le;
}

function coerceCheckin(ck) {
  ck.satisfaccion = ck.satisfaccion === '' || ck.satisfaccion === undefined ? null : Number(ck.satisfaccion);
  ck.rendimiento = ck.rendimiento === '' || ck.rendimiento === undefined ? null : Number(ck.rendimiento);
  return ck;
}
