/* SM Stats — lee el PDF oficial de calendario de la federación (el que
   lista "Jornada N (fecha) / Campo / Fecha-Hora" para cada partido de
   varios equipos) y extrae solo los partidos del equipo que se elija.
   No sabe nada de Sheets ni del formulario de Partidos — solo convierte
   un PDF en una lista de partidos en bruto; quien lo use decide qué
   hacer con ellos (ver pages/matches.js). */

window.SM = window.SM || {};

SM.pdfCalendar = (function () {
  // "ANTONIO ROJAS (HA) 21-11-2026 - 09:00" al final de una fila de partido.
  const VENUE_CODE_RE = /\(([A-ZÁÉÍÓÚÑ]{1,4})\)\s*(\d{2})[-/](\d{2})[-/](\d{4})\s*-\s*(\d{2}):(\d{2})\s*$/;
  // "1.- ALCOTAN CANARIAS, C.D. (1398)" en la lista de equipos participantes.
  const TEAM_LIST_RE = /^\s*\d+\.?-\s*(.+?)\s*\(\d+\)\s*$/;
  const JORNADA_RE = /^Jornada\s+(\d+)\s*\(/i;

  function stripAccents(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function normalizeKey(s) {
    return stripAccents(s).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  }

  // Palabras que no distinguen a un equipo de otro (tipo de club, filial...)
  // — compararlas haría que casi cualquier par de equipos "coincidiera".
  const STOPWORDS = { CD: true, UD: true, CF: true, A: true, B: true, C: true, OTRA: true, DE: true, LA: true, LAS: true };

  function significantWords(name) {
    return normalizeKey(name).split(' ').filter(function (w) { return w && !STOPWORDS[w]; });
  }

  // Equipo de la lista cuyas palabras significativas más coinciden con el
  // nombre del club configurado en Ajustes — un punto de partida razonable
  // para preseleccionar, pero el entrenador siempre lo confirma a mano: el
  // nombre oficial de la federación rara vez coincide letra a letra con el
  // que usa la app ("C.D. ALCOTÁN CANARIAS" vs "ALCOTAN CANARIAS, C.D.").
  function bestTeamMatch(teamNames, clubName) {
    const clubWords = significantWords(clubName);
    if (!teamNames.length) return 0;
    if (!clubWords.length) return 0;
    let bestIdx = 0, bestScore = -1;
    teamNames.forEach(function (name, idx) {
      const words = significantWords(name);
      const score = words.filter(function (w) { return clubWords.indexOf(w) !== -1; }).length;
      if (score > bestScore) { bestScore = score; bestIdx = idx; }
    });
    return bestIdx;
  }

  // Reconstruye el texto del PDF fila a fila agrupando los fragmentos que
  // da pdf.js por su posición vertical (los devuelve en el orden del
  // stream del PDF, no por fila visual — en una tabla a varias columnas
  // eso mezclaría las celdas si no se agrupan antes por altura).
  function extractLines(pdf) {
    const pagePromises = [];
    for (let i = 1; i <= pdf.numPages; i++) pagePromises.push(pdf.getPage(i));
    return Promise.all(pagePromises).then(function (pages) {
      return Promise.all(pages.map(function (page) { return page.getTextContent(); }));
    }).then(function (contents) {
      const lines = [];
      contents.forEach(function (content) {
        const items = (content.items || []).filter(function (it) { return it.str && it.str.trim(); })
          .slice().sort(function (a, b) { return b.transform[5] - a.transform[5]; });
        let current = null;
        items.forEach(function (item) {
          const y = item.transform[5];
          if (!current || Math.abs(current.y - y) > 2.5) {
            current = { y: y, items: [] };
            lines.push(current);
          }
          current.items.push(item);
        });
        lines.forEach(function (lineObj) {
          lineObj.items.sort(function (a, b) { return a.transform[4] - b.transform[4]; });
        });
      });
      return lines.map(function (lineObj) {
        return lineObj.items.map(function (it) { return it.str; }).join(' ').replace(/\s+/g, ' ').trim();
      }).filter(Boolean);
    });
  }

  function parseLines(lines) {
    const teams = [];
    const rawMatches = [];
    let currentJornada = null;
    lines.forEach(function (line) {
      if (!/ - /.test(line)) {
        const teamM = line.match(TEAM_LIST_RE);
        if (teamM && teams.indexOf(teamM[1]) === -1) teams.push(teamM[1]);
        const jornadaM = line.match(JORNADA_RE);
        if (jornadaM) currentJornada = Number(jornadaM[1]);
        return;
      }
      const tailM = line.match(VENUE_CODE_RE);
      if (!tailM) return;
      const head = line.slice(0, tailM.index).trim();
      const dash = head.indexOf(' - ');
      if (dash === -1) return;
      const team1 = head.slice(0, dash).trim();
      const rest = head.slice(dash + 3).trim();
      rawMatches.push({ jornada: currentJornada, team1: team1, rest: rest, tailM: tailM });
    });

    // El rival y el campo vienen pegados sin separador fijo ("COLORADAS,
    // U.D. LAS ANTONIO ROJAS") — nos apoyamos en la lista de equipos
    // participantes (si se encontró) para saber dónde acaba uno y empieza
    // el otro. orderedByLength evita que un nombre corto (p. ej. "FIRGAS,
    // C.D.") case contra un prefijo de otro más largo.
    const knownTeams = teams.slice().sort(function (a, b) { return b.length - a.length; });
    const derivedTeams = [];
    const matches = rawMatches.map(function (rm) {
      let team2 = null, lugar = '';
      const found = knownTeams.find(function (t) { return rm.rest.indexOf(t) === 0; });
      if (found) {
        team2 = found;
        lugar = rm.rest.slice(found.length).trim();
      } else {
        // Sin lista de equipos: aproximación — todo menos la última
        // palabra es el rival, la última es el campo. Impreciso con
        // nombres de campo de más de una palabra; de ahí el aviso al
        // entrenador para que revise el campo en la vista previa.
        const words = rm.rest.split(' ');
        lugar = words.pop() || '';
        team2 = words.join(' ');
      }
      if (derivedTeams.indexOf(rm.team1) === -1) derivedTeams.push(rm.team1);
      if (derivedTeams.indexOf(team2) === -1) derivedTeams.push(team2);
      return {
        jornada: rm.jornada,
        team1: rm.team1,
        team2: team2,
        lugar: lugar,
        fecha: rm.tailM[4] + '-' + rm.tailM[3] + '-' + rm.tailM[2],
        hora: rm.tailM[5] + ':' + rm.tailM[6]
      };
    });

    return { teams: teams.length ? teams : derivedTeams, matches: matches, teamListFound: teams.length > 0 };
  }

  function parseFile(file) {
    if (!window.pdfjsLib) return Promise.reject(new Error('No se pudo cargar el lector de PDF (revisa tu conexión e inténtalo de nuevo).'));
    return file.arrayBuffer().then(function (buf) {
      return window.pdfjsLib.getDocument({ data: buf }).promise;
    }).then(extractLines).then(parseLines);
  }

  // Partidos de un equipo concreto (nombre exacto tal como aparece en
  // `parsed.teams`), con condición y rival ya resueltos desde su punto de
  // vista — listos para pasar al importador de Partidos.
  function matchesForTeam(parsed, teamName) {
    return parsed.matches
      .filter(function (m) { return m.team1 === teamName || m.team2 === teamName; })
      .map(function (m) {
        const isLocal = m.team1 === teamName;
        return {
          jornada: m.jornada,
          fecha: m.fecha,
          hora: m.hora,
          condicion: isLocal ? 'local' : 'visitante',
          rival: isLocal ? m.team2 : m.team1,
          lugar: m.lugar
        };
      })
      .sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
  }

  return { parseFile: parseFile, bestTeamMatch: bestTeamMatch, matchesForTeam: matchesForTeam };
})();
