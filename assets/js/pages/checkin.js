/* SM Stats — Encuesta de bienestar (la rellena el propio jugador).
   Página standalone (encuesta.html?session=<sessionId>), sin sidebar ni
   login: el jugador elige su nombre de la plantilla de ESA sesión (no de
   la categoría activa en este dispositivo, que no tiene por qué tener
   nada guardado) y marca dos caritas — satisfacción y rendimiento
   percibido — con un comentario opcional en cada una. */

(function () {
  const root = document.getElementById('live-root');
  const sessionId = SM.ui.qs('session');

  let DATA = null;
  let session = null;
  let match = null;
  let players = [];

  let step = 'player'; // player -> satisfaccion -> rendimiento -> done
  let player = null;
  let satisfaccion = null;
  let comentarioSatisfaccion = '';
  let rendimiento = null;
  let comentarioRendimiento = '';

  function defaultCategoria() { return SM.team.CATEGORIES[0].key; }

  function loadPlayers() {
    const cat = session.categoria || defaultCategoria();
    players = (DATA.players || [])
      .filter(function (p) { return p.activo && (p.categoria || defaultCategoria()) === cat; })
      .sort(function (a, b) { return (a.dorsal || 99) - (b.dorsal || 99); });
  }

  function sessionLabel() {
    if (session.tipo === 'partido' && match) return 'vs ' + match.rival;
    return 'Entrenamiento';
  }

  function reset() {
    step = 'player';
    player = null;
    satisfaccion = null;
    comentarioSatisfaccion = '';
    rendimiento = null;
    comentarioRendimiento = '';
  }

  function headerHtml() {
    const clubName = (DATA.settings && DATA.settings.club_nombre) || 'Mi club';
    return (
      '<div class="live-header">' +
        '<div style="min-width:0;flex:1 1 auto;">' +
          '<div class="live-header-title">' + SM.ui.escapeHtml(clubName) + ' — ' + SM.ui.escapeHtml(sessionLabel()) + '</div>' +
          '<div class="live-header-sub">' + SM.ui.formatDateShort(session.fecha) + (session.hora ? ' · ' + session.hora : '') + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function playerStepHtml() {
    return (
      '<div class="live-checkin-question">¿Quién eres?</div>' +
      (players.length ? (
        '<div class="live-playergrid" style="padding:10px 14px 24px;">' +
          players.map(function (p) {
            return (
              '<button class="live-player-btn" data-player="' + p.id + '">' +
                '<span class="live-player-dorsal">' + (p.dorsal != null ? p.dorsal : '—') + '</span>' +
                '<span class="live-player-name">' + SM.ui.escapeHtml((p.nombre || '').split(' ')[0]) + '</span>' +
              '</button>'
            );
          }).join('') +
        '</div>'
      ) : '<div class="live-feed-empty" style="padding:10px 14px;">No hay jugadores en la plantilla de esta sesión.</div>')
    );
  }

  function faceGridHtml(selectedValue, name) {
    return (
      '<div class="live-facegrid">' +
        SM.ui.FACES.map(function (f) {
          return (
            '<button type="button" class="live-face-btn' + (selectedValue === f.value ? ' selected' : '') + '" data-face="' + f.value + '" data-name="' + name + '" style="color:' + f.color + ';">' +
              SM.ui.faceSvg(f.key, 44) +
              '<span class="live-face-label">' + f.label + '</span>' +
            '</button>'
          );
        }).join('') +
      '</div>'
    );
  }

  function satisfaccionStepHtml() {
    return (
      '<div class="live-checkin-question">Hola ' + SM.ui.escapeHtml((player.nombre || '').split(' ')[0]) + ' — ¿qué tal te lo has pasado hoy?</div>' +
      faceGridHtml(satisfaccion, 'satisfaccion') +
      '<textarea class="live-checkin-textarea" id="comment-satisfaccion" placeholder="Cuéntanos algo más (opcional)">' + SM.ui.escapeHtml(comentarioSatisfaccion) + '</textarea>' +
      '<div class="live-checkin-actions">' +
        '<button type="button" class="btn btn-primary" id="next-btn"' + (satisfaccion ? '' : ' disabled') + '>Siguiente</button>' +
      '</div>'
    );
  }

  function rendimientoStepHtml() {
    return (
      '<div class="live-checkin-question">¿Cómo crees que has rendido?</div>' +
      faceGridHtml(rendimiento, 'rendimiento') +
      '<textarea class="live-checkin-textarea" id="comment-rendimiento" placeholder="Cuéntanos algo más (opcional)">' + SM.ui.escapeHtml(comentarioRendimiento) + '</textarea>' +
      '<div class="live-checkin-actions">' +
        '<button type="button" class="btn btn-primary" id="submit-btn"' + (rendimiento ? '' : ' disabled') + '>Enviar</button>' +
        '<button type="button" class="btn btn-outline" id="back-btn">Atrás</button>' +
      '</div>'
    );
  }

  function doneHtml() {
    return (
      '<div class="live-summary">' +
        '<div style="font-size:17px;font-weight:700;color:var(--text-strong);">¡Gracias, ' + SM.ui.escapeHtml((player.nombre || '').split(' ')[0]) + '!</div>' +
        '<div style="color:var(--text-dim);font-size:13px;">Tu respuesta se ha guardado.</div>' +
        '<button type="button" class="btn btn-outline" id="another-btn">Responder por otro jugador</button>' +
      '</div>'
    );
  }

  function render() {
    if (!session) {
      root.innerHTML = '<div class="live-loading">No se encontró esa sesión. Pide al entrenador que te pase el enlace correcto.</div>';
      return;
    }
    const body =
      step === 'player' ? playerStepHtml() :
      step === 'satisfaccion' ? satisfaccionStepHtml() :
      step === 'rendimiento' ? rendimientoStepHtml() :
      doneHtml();
    root.innerHTML = headerHtml() + body;
    wire();
  }

  function wire() {
    root.querySelectorAll('.live-player-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        player = players.find(function (p) { return p.id === btn.getAttribute('data-player'); });
        step = 'satisfaccion';
        render();
      });
    });
    root.querySelectorAll('.live-face-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const value = Number(btn.getAttribute('data-face'));
        const name = btn.getAttribute('data-name');
        if (name === 'satisfaccion') satisfaccion = value; else rendimiento = value;
        render();
      });
    });
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        comentarioSatisfaccion = document.getElementById('comment-satisfaccion').value.trim();
        step = 'rendimiento';
        render();
      });
    }
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        comentarioRendimiento = document.getElementById('comment-rendimiento').value.trim();
        step = 'satisfaccion';
        render();
      });
    }
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        comentarioRendimiento = document.getElementById('comment-rendimiento').value.trim();
        submitBtn.disabled = true;
        SM.api.postAction('saveCheckin', {
          sessionId: sessionId,
          playerId: player.id,
          satisfaccion: satisfaccion,
          comentarioSatisfaccion: comentarioSatisfaccion,
          rendimiento: rendimiento,
          comentarioRendimiento: comentarioRendimiento
        }).then(function () {
          step = 'done';
          render();
        }).catch(function (err) {
          SM.ui.toast(err.message, 'error');
          submitBtn.disabled = false;
        });
      });
    }
    const anotherBtn = document.getElementById('another-btn');
    if (anotherBtn) anotherBtn.addEventListener('click', function () { reset(); render(); });
  }

  if (!sessionId) {
    root.innerHTML = '<div class="live-loading">Falta el enlace de la sesión. Pide al entrenador que te lo vuelva a pasar.</div>';
    return;
  }

  SM.api.fetchAll().then(function (data) {
    DATA = data;
    session = (DATA.sessions || []).find(function (s) { return s.id === sessionId; }) || null;
    if (session && session.tipo === 'partido' && session.match_id) {
      match = (DATA.matches || []).find(function (m) { return m.id === session.match_id; }) || null;
    }
    if (session) loadPlayers();
    render();
  }).catch(function (err) {
    root.innerHTML = '<div class="live-loading">' + err.message + '</div>';
  });
})();
