/* SM Stats — Encuesta de bienestar (la rellena el propio jugador).
   Página standalone (encuesta.html?session=<sessionId>), sin sidebar.
   La identidad del jugador viene SIEMPRE de su sesión de acceso (ver
   assets/js/auth.js) — nunca de una lista para elegir ni de un parámetro
   de la URL — así nadie puede rellenar la encuesta en nombre de otro
   compañero. Si el dispositivo no tiene sesión iniciada, se manda a
   acceso.html y se vuelve aquí después de entrar. */

(function () {
  const root = document.getElementById('live-root');
  const sessionId = SM.ui.qs('session');

  let DATA = null;
  let session = null;
  let match = null;

  let step = 'satisfaccion'; // satisfaccion -> rendimiento -> done
  let player = null;
  let satisfaccion = null;
  let comentarioSatisfaccion = '';
  let rendimiento = null;
  let comentarioRendimiento = '';
  let loadError = '';

  function defaultCategoria() { return SM.team.CATEGORIES[0].key; }

  function sessionLabel() {
    if (session.tipo === 'partido' && match) return 'vs ' + match.rival;
    return 'Entrenamiento';
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
      '<div id="checkin-error" style="display:none;margin:0 14px 14px;padding:10px 14px;border-radius:9px;background:' + SM.ui.alpha('var(--red)', 0.12) + ';border:1px solid ' + SM.ui.alpha('var(--red)', 0.4) + ';color:var(--red-bright);font-size:12.5px;font-weight:600;"></div>' +
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
        '<a href="mi-jugador.html?id=' + player.id + '" class="btn btn-outline">Volver a mi ficha</a>' +
      '</div>'
    );
  }

  function render() {
    if (loadError) {
      root.innerHTML = '<div class="live-loading">' + SM.ui.escapeHtml(loadError) + '</div>';
      return;
    }
    if (!session) {
      root.innerHTML = '<div class="live-loading">No se encontró esa sesión. Pide al entrenador que te pase el enlace correcto.</div>';
      return;
    }
    const body =
      step === 'satisfaccion' ? satisfaccionStepHtml() :
      step === 'rendimiento' ? rendimientoStepHtml() :
      doneHtml();
    root.innerHTML = headerHtml() + body;
    wire();
  }

  function wire() {
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
      const submitLabel = submitBtn.textContent;
      const errorEl = document.getElementById('checkin-error');
      function showError(msg) {
        if (!errorEl) return;
        if (msg) { errorEl.textContent = '⚠ ' + msg; errorEl.style.display = 'block'; }
        else { errorEl.style.display = 'none'; errorEl.textContent = ''; }
      }
      submitBtn.addEventListener('click', function () {
        comentarioRendimiento = document.getElementById('comment-rendimiento').value.trim();
        showError(null);
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando…';
        // Igual que en el resto de la app: si falla, deja el error a la
        // vista (no solo un toast que puede pasar desapercibido para un
        // jugador que ya ha soltado el móvil pensando que había terminado).
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
          submitBtn.disabled = false;
          submitBtn.textContent = submitLabel;
          showError(err.message);
          SM.ui.toast(err.message, 'error');
        });
      });
    }
  }

  if (!sessionId) {
    root.innerHTML = '<div class="live-loading">Falta el enlace de la sesión. Pide al entrenador que te lo vuelva a pasar.</div>';
    return;
  }

  // Sin sesión de acceso en este dispositivo -> a iniciar sesión, y de
  // vuelta aquí mismo en cuanto entre (ver el "next" en login.js).
  const famSession = SM.auth.readFamilySession();
  if (!famSession || famSession.type !== 'player') {
    const returnUrl = window.location.pathname + window.location.search;
    window.location.href = 'acceso.html?next=' + encodeURIComponent(returnUrl);
    return;
  }

  SM.api.fetchAll().then(function (data) {
    DATA = data;
    session = (DATA.sessions || []).find(function (s) { return s.id === sessionId; }) || null;
    if (session && session.tipo === 'partido' && session.match_id) {
      match = (DATA.matches || []).find(function (m) { return m.id === session.match_id; }) || null;
    }
    if (session) {
      player = (DATA.players || []).find(function (p) { return p.id === famSession.id && p.activo; }) || null;
      if (!player) {
        loadError = 'Tu acceso ya no es válido. Vuelve a entrar desde acceso.html.';
      } else {
        const cat = session.categoria || defaultCategoria();
        const playerCat = player.categoria || defaultCategoria();
        if (playerCat !== cat) loadError = 'Esta encuesta es de otro equipo — no es la tuya.';
      }
    }
    render();
  }).catch(function (err) {
    root.innerHTML = '<div class="live-loading">' + err.message + '</div>';
  });
})();
