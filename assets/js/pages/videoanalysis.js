/* SM Stats — Vídeo análisis (herramienta de corrección en vídeo para el
   cuerpo técnico).

   Primera entrega ("herramienta 1 de varias", a construir paso a paso):
   cargar un vídeo del dispositivo (galería/archivos/cámara — el propio
   selector nativo ya lo ofrece, igual que con las fotos), recortar un
   fragmento de máximo 30s SIN tocar el archivo original (el recorte solo
   limita qué tramo se reproduce/exportará más adelante — no hace falta
   descodificar/recortar el vídeo de verdad), revisarlo a distinta
   velocidad, avanzar fotograma a fotograma, y hacer zoom sobre una zona.

   Pendiente para próximas entregas (se construyen una a una, sin prisa):
   dibujo sobre fotograma congelado (líneas, curvas bézier, formas, foco
   cónico, clonar jugador, redes de nodos) y la exportación final del clip
   ya anotado — eso es lo que luego se sube al área privada del jugador. */

(function () {
  const shell = document.getElementById('app-shell');
  SM.sidebar.mount(shell, 'video');
  const main = document.getElementById('main');

  const MAX_CLIP_SECONDS = 30;
  const MAX_CANVAS_WIDTH = 1280;
  const SPEEDS = [0.25, 0.5, 1, 2, 4];
  const FPS_OPTIONS = [24, 25, 30, 50, 60];
  const ZOOM_LEVELS = [1, 2, 3, 4];

  const ICON_PLAY = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  const ICON_PAUSE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';
  const ICON_STEP_BACK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="5" width="2.4" height="14"/><path d="M20 5v14L9 12z"/></svg>';
  const ICON_STEP_FWD = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="17.6" y="5" width="2.4" height="14"/><path d="M4 5v14l11-7z"/></svg>';

  // Mismos tonos que theme.css, pero como valores literales: el contexto
  // 2D del canvas no resuelve var(--cyan), necesita el color ya escrito.
  const LINE_COLORS = ['oklch(0.97 0 0)', 'oklch(0.80 0.15 205)', 'oklch(0.72 0.22 335)', 'oklch(0.68 0.20 25)', 'oklch(0.80 0.17 80)', 'oklch(0.80 0.19 150)'];
  const LINE_WIDTH_OPTIONS = [{ px: 2.5, label: 'Fino' }, { px: 5, label: 'Medio' }, { px: 9, label: 'Grueso' }];
  const DASH_STYLES = [
    { key: 'solid', label: 'Continuo' },
    { key: 'dashed', label: 'Discontinuo' },
    { key: 'longdash', label: 'Guiones largos' }
  ];
  const ARROW_STYLES = [
    { key: 'none', label: 'Sin flecha' },
    { key: 'end', label: 'Flecha' },
    { key: 'both', label: 'Doble flecha' }
  ];

  let DATA = null;

  SM.sidebar.onSettingsClick(function () {
    SM.forms.openSettingsForm(DATA && DATA.settings, function (data) { DATA = data; });
  });

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function fmtTime(t) {
    t = Math.max(0, t || 0);
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function speedLabel(s) {
    if (s === 1) return '1×';
    if (s < 1) return '1/' + Math.round(1 / s) + '×';
    return s + '×';
  }

  // ---- estado del editor (todo se reinicia al cargar un vídeo nuevo) ----
  let video = null;
  let canvas = null, ctx = null, canvasWrap = null;
  let objectUrl = null;
  let duration = 0;
  let inPoint = 0, outPoint = 0;
  let fps = 25;
  let speed = 1;
  let boundedPlayback = false; // true mientras se reproduce con "Reproducir recorte"
  let rafId = null;
  let scrubbing = false;

  // Zoom: recuadro guardado como fracciones [0,1] del fotograma (no en
  // píxeles) para que no dependa de a qué tamaño se esté pintando el canvas
  // en pantalla. w === h siempre, así el recorte ampliado conserva la
  // proporción del propio canvas (nunca sale deformado).
  let zoomLevel = 1;
  let zoomRect = null;
  let zoomPreviewMode = false; // false = ajustando el recuadro, true = viendo el efecto ya aplicado
  let zoomBoxEl = null;
  let dragState = null;

  // ---- congelar fotograma + anotaciones ----
  // El fotograma congelado es una copia de píxeles del canvas en ese
  // instante (incluye el efecto de zoom si estaba activo) — a partir de ahí
  // se dibuja siempre esa imagen fija, nunca el vídeo, así lo que se anota
  // no se mueve aunque el vídeo original siga "detrás".
  let frozen = false;
  let frozenSourceCanvas = null;
  let shapes = [];
  let nextShapeId = 1;
  let activeTool = null; // null (seleccionar/mover) | 'line'
  let selectedShapeId = null;
  let creatingLine = null; // línea en curso mientras se arrastra para crearla
  let currentDefaults = { color: LINE_COLORS[0], width: LINE_WIDTH_OPTIONS[1].px, dash: 'solid', arrow: 'none' };
  let shapeDragState = null; // arrastre de un nodo de una línea ya creada
  let handleEls = { start: null, end: null };

  function renderEmpty() {
    main.innerHTML =
      '<div class="page-header">' +
        '<div><div class="page-title">Vídeo análisis</div><div class="page-subtitle">Recorta un fragmento corto, revísalo con calma y prepáralo para anotarlo</div></div>' +
      '</div>' +
      '<div class="panel" style="text-align:center;padding:60px 20px;">' +
        '<input type="file" id="video-file-input" accept="video/*" style="display:none;">' +
        '<div style="font-size:14px;color:var(--text-dim);font-weight:600;margin-bottom:16px;">Elige un vídeo de la galería, archivos o grábalo con la cámara</div>' +
        '<button type="button" class="btn btn-primary" id="video-pick-btn">Cargar vídeo</button>' +
      '</div>';
    main.querySelector('#video-pick-btn').addEventListener('click', function () {
      main.querySelector('#video-file-input').click();
    });
    main.querySelector('#video-file-input').addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      if (file) loadVideo(file);
    });
  }

  function renderEditor() {
    main.innerHTML =
      '<div class="page-header">' +
        '<div><div class="page-title">Vídeo análisis</div><div class="page-subtitle">Recorta, revisa a distinta velocidad y ajusta el zoom</div></div>' +
        '<button type="button" class="btn btn-outline" id="video-change-btn">Cambiar vídeo</button>' +
      '</div>' +
      '<div class="panel">' +
        '<div class="va-canvas-wrap" id="canvas-wrap"><canvas id="va-canvas"></canvas></div>' +

        '<div id="va-annotate-panel" style="display:none;">' +
          '<div class="va-group-row">' +
            '<span class="va-group-label">Herramienta</span>' +
            '<button type="button" class="pill va-tool-btn" data-tool="line">Línea</button>' +
            '<span style="flex:1 1 auto;"></span>' +
            '<button type="button" class="btn btn-outline" id="va-unfreeze-btn">Volver al vídeo</button>' +
          '</div>' +
          '<div class="va-group-row" id="va-shape-props" style="display:none;">' +
            '<span class="va-group-label">Color</span>' +
            LINE_COLORS.map(function (c) { return '<button type="button" class="va-color-swatch" data-color="' + c + '" style="background:' + c + ';"></button>'; }).join('') +
            '<span class="va-group-label">Grosor</span>' +
            LINE_WIDTH_OPTIONS.map(function (w) { return '<button type="button" class="pill va-width-btn" data-width="' + w.px + '">' + w.label + '</button>'; }).join('') +
            '<span class="va-group-label">Trazo</span>' +
            DASH_STYLES.map(function (d) { return '<button type="button" class="pill va-dash-btn" data-dash="' + d.key + '">' + d.label + '</button>'; }).join('') +
            '<span class="va-group-label">Flecha</span>' +
            ARROW_STYLES.map(function (a) { return '<button type="button" class="pill va-arrow-btn" data-arrow="' + a.key + '">' + a.label + '</button>'; }).join('') +
            '<button type="button" class="btn btn-outline" id="va-delete-shape" style="color:var(--red-bright);display:none;">Eliminar</button>' +
          '</div>' +
        '</div>' +

        '<div class="va-controls">' +
          '<div>' +
            '<div class="va-timeline" id="va-timeline">' +
              '<div class="va-trim-range" id="va-trim-range"></div>' +
              '<input type="range" id="va-scrub" min="0" max="0" step="0.01" value="0">' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-mute);font-weight:600;margin-top:2px;">' +
              '<span id="va-current-time">0:00</span><span id="va-duration">0:00</span>' +
            '</div>' +
          '</div>' +

          '<div class="va-group-row">' +
            '<span class="va-group-label">Recorte (máx. 30s)</span>' +
            '<button type="button" class="btn btn-outline" id="va-mark-in" style="padding:6px 12px;font-size:12px;">Marcar inicio</button>' +
            '<span class="va-time-label" id="va-in-label">Inicio: 0:00</span>' +
            '<button type="button" class="btn btn-outline" id="va-mark-out" style="padding:6px 12px;font-size:12px;">Marcar fin</button>' +
            '<span class="va-time-label" id="va-out-label">Fin: 0:00</span>' +
            '<span class="va-time-label" id="va-selected-label">Duración: 0s</span>' +
            '<button type="button" class="btn btn-primary" id="va-play-clip" style="padding:6px 14px;font-size:12px;">▶ Reproducir recorte</button>' +
          '</div>' +
          '<div class="va-trim-error" id="va-trim-error" style="display:none;"></div>' +

          '<div class="va-transport">' +
            '<button type="button" class="va-icon-btn" id="va-step-back" title="Fotograma anterior">' + ICON_STEP_BACK + '</button>' +
            '<button type="button" class="va-icon-btn primary" id="va-play" title="Reproducir / pausar">' + ICON_PLAY + '</button>' +
            '<button type="button" class="va-icon-btn" id="va-step-fwd" title="Fotograma siguiente">' + ICON_STEP_FWD + '</button>' +
            '<select id="va-fps" style="font-size:12px;padding:6px 8px;border-radius:8px;">' +
              FPS_OPTIONS.map(function (f) { return '<option value="' + f + '"' + (f === fps ? ' selected' : '') + '>' + f + ' fps</option>'; }).join('') +
            '</select>' +
            '<button type="button" class="btn btn-primary" id="va-freeze-btn" style="padding:8px 16px;font-size:12.5px;margin-left:10px;">Congelar fotograma</button>' +
          '</div>' +

          '<div class="va-group-row">' +
            '<span class="va-group-label">Velocidad</span>' +
            SPEEDS.map(function (s) {
              return '<button type="button" class="pill va-speed-btn' + (s === speed ? ' active' : '') + '" data-speed="' + s + '">' + speedLabel(s) + '</button>';
            }).join('') +
          '</div>' +

          '<div class="va-group-row">' +
            '<span class="va-group-label">Zoom</span>' +
            ZOOM_LEVELS.map(function (z) {
              return '<button type="button" class="pill va-zoom-btn' + (z === zoomLevel ? ' active' : '') + '" data-zoom="' + z + '">' + (z === 1 ? 'Sin zoom' : z + '×') + '</button>';
            }).join('') +
            '<button type="button" class="btn btn-outline" id="va-zoom-toggle" style="padding:6px 12px;font-size:12px;display:none;">Vista previa del zoom</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    canvasWrap = main.querySelector('#canvas-wrap');
    canvas = main.querySelector('#va-canvas');
    ctx = canvas.getContext('2d');

    wireEditor();
  }

  function loadVideo(file) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    duration = 0; inPoint = 0; outPoint = 0; speed = 1; fps = 25;
    zoomLevel = 1; zoomRect = null; zoomPreviewMode = false; zoomBoxEl = null;
    boundedPlayback = false;
    frozen = false; frozenSourceCanvas = null; shapes = []; nextShapeId = 1;
    activeTool = null; selectedShapeId = null; creatingLine = null;
    currentDefaults = { color: LINE_COLORS[0], width: LINE_WIDTH_OPTIONS[1].px, dash: 'solid', arrow: 'none' };
    shapeDragState = null; handleEls = { start: null, end: null };

    renderEditor();

    video = document.createElement('video');
    video.src = objectUrl;
    video.playsInline = true;
    video.preload = 'auto';
    video.style.display = 'none';
    document.body.appendChild(video);

    video.addEventListener('loadedmetadata', function () {
      duration = video.duration;
      inPoint = 0;
      outPoint = Math.min(duration, MAX_CLIP_SECONDS);
      const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
      const scale = Math.min(1, MAX_CANVAS_WIDTH / vw);
      canvas.width = Math.round(vw * scale);
      canvas.height = Math.round(vh * scale);
      main.querySelector('#va-scrub').max = duration;
      main.querySelector('#va-duration').textContent = fmtTime(duration);
      updateTrimUI();
      drawFrame();
    });
    // 'loadedmetadata' ya da las dimensiones, pero el primer fotograma no
    // siempre está decodificado todavía en ese momento — sin esto, el
    // canvas se queda en negro hasta la primera interacción.
    video.addEventListener('loadeddata', drawFrame);
    video.addEventListener('play', function () { updatePlayIcon(); startDrawLoop(); });
    video.addEventListener('pause', function () { updatePlayIcon(); stopDrawLoop(); drawFrame(); });
    video.addEventListener('seeked', function () { drawFrame(); updateScrubPosition(); });
    video.addEventListener('timeupdate', function () {
      if (boundedPlayback && !video.paused && video.currentTime >= outPoint) {
        video.pause();
        video.currentTime = outPoint;
        boundedPlayback = false;
      }
      if (!scrubbing) updateScrubPosition();
    });
  }

  function wireEditor() {
    main.querySelector('#video-change-btn').addEventListener('click', function () {
      stopDrawLoop();
      if (video) { video.pause(); video.remove(); video = null; }
      if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
      renderEmpty();
    });

    const scrub = main.querySelector('#va-scrub');
    scrub.addEventListener('pointerdown', function () { scrubbing = true; });
    scrub.addEventListener('pointerup', function () { scrubbing = false; });
    scrub.addEventListener('input', function () {
      boundedPlayback = false;
      if (!video.paused) video.pause();
      video.currentTime = Number(scrub.value);
    });

    main.querySelector('#va-mark-in').addEventListener('click', markIn);
    main.querySelector('#va-mark-out').addEventListener('click', markOut);
    main.querySelector('#va-play-clip').addEventListener('click', playClip);

    main.querySelector('#va-play').addEventListener('click', togglePlay);
    main.querySelector('#va-step-back').addEventListener('click', function () { stepFrame(-1); });
    main.querySelector('#va-step-fwd').addEventListener('click', function () { stepFrame(1); });
    main.querySelector('#va-fps').addEventListener('change', function (e) { fps = Number(e.target.value); });

    main.querySelectorAll('.va-speed-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        speed = Number(btn.getAttribute('data-speed'));
        video.playbackRate = speed;
        main.querySelectorAll('.va-speed-btn').forEach(function (b) { b.classList.toggle('active', b === btn); });
      });
    });

    main.querySelectorAll('.va-zoom-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setZoomLevel(Number(btn.getAttribute('data-zoom')));
        main.querySelectorAll('.va-zoom-btn').forEach(function (b) { b.classList.toggle('active', b === btn); });
      });
    });

    main.querySelector('#va-zoom-toggle').addEventListener('click', function () {
      zoomPreviewMode = !zoomPreviewMode;
      updateZoomUiState();
      drawFrame();
    });

    main.querySelector('#va-freeze-btn').addEventListener('click', freezeFrame);
    main.querySelector('#va-unfreeze-btn').addEventListener('click', unfreeze);

    main.querySelectorAll('.va-tool-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeTool = activeTool === btn.getAttribute('data-tool') ? null : btn.getAttribute('data-tool');
        selectShape(null);
        updateToolButtonsUi();
      });
    });
    main.querySelectorAll('.va-color-swatch').forEach(function (btn) {
      btn.addEventListener('click', function () { applyProp('color', btn.getAttribute('data-color')); });
    });
    main.querySelectorAll('.va-width-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { applyProp('width', Number(btn.getAttribute('data-width'))); });
    });
    main.querySelectorAll('.va-dash-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { applyProp('dash', btn.getAttribute('data-dash')); });
    });
    main.querySelectorAll('.va-arrow-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { applyProp('arrow', btn.getAttribute('data-arrow')); });
    });
    main.querySelector('#va-delete-shape').addEventListener('click', function () {
      shapes = shapes.filter(function (s) { return s.id !== selectedShapeId; });
      selectShape(null);
    });

    canvas.addEventListener('pointerdown', function (e) {
      if (!frozen) return;
      const p = canvasPointFromEvent(e);
      if (activeTool === 'line') {
        creatingLine = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
        canvas.setPointerCapture(e.pointerId);
      } else {
        selectShape(hitTestShapes(p));
      }
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!creatingLine) return;
      const p = canvasPointFromEvent(e);
      creatingLine.x2 = p.x; creatingLine.y2 = p.y;
      drawFrame();
    });
    canvas.addEventListener('pointerup', function () {
      if (!creatingLine) return;
      const line = creatingLine;
      creatingLine = null;
      const dx = (line.x2 - line.x1) * canvas.width, dy = (line.y2 - line.y1) * canvas.height;
      if (Math.hypot(dx, dy) < 6) { drawFrame(); return; } // tap accidental, sin arrastre real
      const shape = Object.assign({ id: nextShapeId++, type: 'line' }, line, currentDefaults);
      shapes.push(shape);
      activeTool = null;
      updateToolButtonsUi();
      selectShape(shape.id);
    });

    window.addEventListener('pointermove', function (e) {
      if (!shapeDragState) return;
      const shape = shapes.find(function (s) { return s.id === shapeDragState.shapeId; });
      if (!shape) return;
      const wrapRect = canvasWrap.getBoundingClientRect();
      const x = clamp((e.clientX - wrapRect.left) / wrapRect.width, 0, 1);
      const y = clamp((e.clientY - wrapRect.top) / wrapRect.height, 0, 1);
      if (shapeDragState.which === 'start') { shape.x1 = x; shape.y1 = y; } else { shape.x2 = x; shape.y2 = y; }
      positionHandles(shape);
      drawFrame();
    });
    window.addEventListener('pointerup', function () { shapeDragState = null; });
  }

  // ---- reproducción ----

  function togglePlay() {
    if (!video) return;
    boundedPlayback = false;
    if (video.paused) video.play(); else video.pause();
  }

  function playClip() {
    if (!video) return;
    video.currentTime = inPoint;
    boundedPlayback = true;
    video.play();
  }

  function stepFrame(dir) {
    if (!video) return;
    boundedPlayback = false;
    if (!video.paused) video.pause();
    video.currentTime = clamp(video.currentTime + dir * (1 / fps), 0, duration);
  }

  function updatePlayIcon() {
    const btn = main.querySelector('#va-play');
    if (btn && video) btn.innerHTML = video.paused ? ICON_PLAY : ICON_PAUSE;
  }

  function updateScrubPosition() {
    const scrub = main.querySelector('#va-scrub');
    if (scrub) scrub.value = video.currentTime;
    const cur = main.querySelector('#va-current-time');
    if (cur) cur.textContent = fmtTime(video.currentTime);
  }

  function startDrawLoop() {
    function tick() { drawFrame(); rafId = requestAnimationFrame(tick); }
    rafId = requestAnimationFrame(tick);
  }
  function stopDrawLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // ---- recorte (in/out) ----

  function showTrimError(msg) {
    const el = main.querySelector('#va-trim-error');
    if (!el) return;
    if (msg) { el.textContent = '⚠ ' + msg; el.style.display = 'block'; }
    else { el.style.display = 'none'; el.textContent = ''; }
  }

  function markIn() {
    const t = video.currentTime;
    if (t >= outPoint) { showTrimError('El inicio debe quedar antes del fin.'); return; }
    inPoint = t;
    if (outPoint - inPoint > MAX_CLIP_SECONDS) outPoint = inPoint + MAX_CLIP_SECONDS;
    showTrimError(null);
    updateTrimUI();
  }

  function markOut() {
    const t = video.currentTime;
    if (t <= inPoint) { showTrimError('El fin debe quedar después del inicio.'); return; }
    if (t - inPoint > MAX_CLIP_SECONDS) { showTrimError('El recorte no puede superar 30 segundos.'); return; }
    outPoint = t;
    showTrimError(null);
    updateTrimUI();
  }

  function updateTrimUI() {
    main.querySelector('#va-in-label').textContent = 'Inicio: ' + fmtTime(inPoint);
    main.querySelector('#va-out-label').textContent = 'Fin: ' + fmtTime(outPoint);
    main.querySelector('#va-selected-label').textContent = 'Duración: ' + (Math.round((outPoint - inPoint) * 10) / 10) + 's';
    const rangeEl = main.querySelector('#va-trim-range');
    if (rangeEl && duration > 0) {
      rangeEl.style.left = (inPoint / duration * 100) + '%';
      rangeEl.style.width = ((outPoint - inPoint) / duration * 100) + '%';
    }
  }

  // ---- zoom ----

  function setZoomLevel(z) {
    zoomLevel = z;
    zoomPreviewMode = false;
    zoomRect = z > 1 ? { x: (1 - 1 / z) / 2, y: (1 - 1 / z) / 2, w: 1 / z, h: 1 / z } : null;
    updateZoomUiState();
    drawFrame();
  }

  function updateZoomUiState() {
    const toggleBtn = main.querySelector('#va-zoom-toggle');
    toggleBtn.style.display = zoomLevel > 1 ? '' : 'none';
    toggleBtn.textContent = zoomPreviewMode ? 'Ajustar recuadro' : 'Vista previa del zoom';
    if (zoomLevel > 1 && !zoomPreviewMode) {
      ensureZoomBox();
      zoomBoxEl.style.display = '';
      updateZoomBoxPosition();
    } else if (zoomBoxEl) {
      zoomBoxEl.style.display = 'none';
    }
  }

  function ensureZoomBox() {
    if (zoomBoxEl) return;
    zoomBoxEl = document.createElement('div');
    zoomBoxEl.className = 'va-zoom-box';
    zoomBoxEl.innerHTML = '<div class="va-zoom-handle"></div>';
    canvasWrap.appendChild(zoomBoxEl);
    zoomBoxEl.addEventListener('pointerdown', function (e) {
      if (e.target.classList.contains('va-zoom-handle')) return;
      e.preventDefault();
      dragState = { mode: 'move', startX: e.clientX, startY: e.clientY, origX: zoomRect.x, origY: zoomRect.y };
    });
    zoomBoxEl.querySelector('.va-zoom-handle').addEventListener('pointerdown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      dragState = { mode: 'resize', startX: e.clientX, startY: e.clientY, origS: zoomRect.w };
    });
    window.addEventListener('pointermove', onZoomPointerMove);
    window.addEventListener('pointerup', function () { dragState = null; });
  }

  function onZoomPointerMove(e) {
    if (!dragState || !zoomRect) return;
    const wrapRect = canvasWrap.getBoundingClientRect();
    if (dragState.mode === 'move') {
      const dx = (e.clientX - dragState.startX) / wrapRect.width;
      const dy = (e.clientY - dragState.startY) / wrapRect.height;
      zoomRect.x = clamp(dragState.origX + dx, 0, 1 - zoomRect.w);
      zoomRect.y = clamp(dragState.origY + dy, 0, 1 - zoomRect.h);
    } else {
      const d = ((e.clientX - dragState.startX) / wrapRect.width + (e.clientY - dragState.startY) / wrapRect.height) / 2;
      const s = clamp(dragState.origS + d, 0.15, 1);
      zoomRect.w = s; zoomRect.h = s;
      zoomRect.x = clamp(zoomRect.x, 0, 1 - s);
      zoomRect.y = clamp(zoomRect.y, 0, 1 - s);
    }
    updateZoomBoxPosition();
  }

  function updateZoomBoxPosition() {
    if (!zoomBoxEl || !zoomRect) return;
    const wrapRect = canvasWrap.getBoundingClientRect();
    zoomBoxEl.style.left = (zoomRect.x * wrapRect.width) + 'px';
    zoomBoxEl.style.top = (zoomRect.y * wrapRect.height) + 'px';
    zoomBoxEl.style.width = (zoomRect.w * wrapRect.width) + 'px';
    zoomBoxEl.style.height = (zoomRect.h * wrapRect.height) + 'px';
  }

  // ---- congelar / anotar ----

  function freezeFrame() {
    if (!video || frozen) return;
    if (!video.paused) video.pause();
    frozenSourceCanvas = document.createElement('canvas');
    frozenSourceCanvas.width = canvas.width;
    frozenSourceCanvas.height = canvas.height;
    // Copia tal cual lo que había en pantalla — si el zoom estaba en modo
    // vista previa, esa imagen ampliada queda "congelada" también.
    frozenSourceCanvas.getContext('2d').drawImage(canvas, 0, 0);
    frozen = true;
    shapes = [];
    selectedShapeId = null;
    activeTool = null;
    if (zoomBoxEl) zoomBoxEl.style.display = 'none';
    updateFreezeUiState();
    updateToolButtonsUi();
    drawFrame();
  }

  function unfreeze() {
    frozen = false;
    frozenSourceCanvas = null;
    shapes = [];
    selectedShapeId = null;
    activeTool = null;
    removeHandles();
    updateFreezeUiState();
    if (zoomLevel > 1) updateZoomUiState();
    drawFrame();
  }

  function updateFreezeUiState() {
    main.querySelector('.va-controls').style.display = frozen ? 'none' : '';
    main.querySelector('#va-annotate-panel').style.display = frozen ? '' : 'none';
  }

  function canvasPointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: clamp((e.clientX - rect.left) / rect.width, 0, 1), y: clamp((e.clientY - rect.top) / rect.height, 0, 1) };
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function hitTestShapes(p) {
    const px = p.x * canvas.width, py = p.y * canvas.height;
    let best = null, bestDist = 14; // tolerancia en píxeles de canvas
    shapes.forEach(function (s) {
      const d = distToSegment(px, py, s.x1 * canvas.width, s.y1 * canvas.height, s.x2 * canvas.width, s.y2 * canvas.height);
      if (d < bestDist) { bestDist = d; best = s.id; }
    });
    return best;
  }

  function selectShape(id) {
    selectedShapeId = id;
    updateShapePropsUi();
    updateHandles();
    drawFrame();
  }

  function applyProp(key, value) {
    const shape = selectedShapeId != null ? shapes.find(function (s) { return s.id === selectedShapeId; }) : null;
    if (shape) shape[key] = value; else currentDefaults[key] = value;
    updateShapePropsUi();
    drawFrame();
  }

  function updateToolButtonsUi() {
    main.querySelectorAll('.va-tool-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tool') === activeTool); });
    updateShapePropsUi();
  }

  function updateShapePropsUi() {
    const propsRow = main.querySelector('#va-shape-props');
    const shape = selectedShapeId != null ? shapes.find(function (s) { return s.id === selectedShapeId; }) : null;
    const showProps = activeTool != null || !!shape;
    propsRow.style.display = showProps ? '' : 'none';
    if (!showProps) return;
    const props = shape || currentDefaults;
    main.querySelectorAll('.va-color-swatch').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-color') === props.color); });
    main.querySelectorAll('.va-width-btn').forEach(function (b) { b.classList.toggle('active', Number(b.getAttribute('data-width')) === props.width); });
    main.querySelectorAll('.va-dash-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-dash') === props.dash); });
    main.querySelectorAll('.va-arrow-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-arrow') === props.arrow); });
    main.querySelector('#va-delete-shape').style.display = shape ? '' : 'none';
  }

  function removeHandles() {
    if (handleEls.start) { handleEls.start.remove(); handleEls.start = null; }
    if (handleEls.end) { handleEls.end.remove(); handleEls.end = null; }
  }

  function createHandle(which, shapeId) {
    const el = document.createElement('div');
    el.className = 'va-node-handle';
    canvasWrap.appendChild(el);
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      shapeDragState = { shapeId: shapeId, which: which };
    });
    return el;
  }

  function positionHandles(shape) {
    const wrapRect = canvasWrap.getBoundingClientRect();
    if (handleEls.start) { handleEls.start.style.left = (shape.x1 * wrapRect.width) + 'px'; handleEls.start.style.top = (shape.y1 * wrapRect.height) + 'px'; }
    if (handleEls.end) { handleEls.end.style.left = (shape.x2 * wrapRect.width) + 'px'; handleEls.end.style.top = (shape.y2 * wrapRect.height) + 'px'; }
  }

  function updateHandles() {
    removeHandles();
    if (!frozen || selectedShapeId == null) return;
    const shape = shapes.find(function (s) { return s.id === selectedShapeId; });
    if (!shape) return;
    handleEls.start = createHandle('start', shape.id);
    handleEls.end = createHandle('end', shape.id);
    positionHandles(shape);
  }

  // ---- dibujo del fotograma ----

  function drawLineShape(s) {
    const x1 = s.x1 * canvas.width, y1 = s.y1 * canvas.height, x2 = s.x2 * canvas.width, y2 = s.y2 * canvas.height;
    const w = s.width;
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (s.dash === 'dashed') ctx.setLineDash([w * 2.4, w * 2]);
    else if (s.dash === 'longdash') ctx.setLineDash([w * 5.5, w * 2.4]);
    else ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    if (s.arrow === 'end' || s.arrow === 'both') {
      ctx.setLineDash([]);
      drawArrowHead(x2, y2, Math.atan2(y2 - y1, x2 - x1), w);
    }
    if (s.arrow === 'both') {
      ctx.setLineDash([]);
      drawArrowHead(x1, y1, Math.atan2(y1 - y2, x1 - x2), w);
    }
    ctx.restore();
  }

  function drawArrowHead(x, y, angle, w) {
    const headLen = Math.max(10, w * 3.2);
    const headAngle = Math.PI / 7.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - headLen * Math.cos(angle - headAngle), y - headLen * Math.sin(angle - headAngle));
    ctx.lineTo(x - headLen * Math.cos(angle + headAngle), y - headLen * Math.sin(angle + headAngle));
    ctx.closePath();
    ctx.fill();
  }

  function drawFrame() {
    if (!ctx) return;
    if (frozen) {
      if (frozenSourceCanvas) ctx.drawImage(frozenSourceCanvas, 0, 0);
      shapes.forEach(function (s) { if (s.type === 'line') drawLineShape(s); });
      if (creatingLine) drawLineShape(Object.assign({ id: 0, type: 'line' }, creatingLine, currentDefaults));
      return;
    }
    if (!video || !video.videoWidth) return;
    if (zoomLevel > 1 && zoomPreviewMode && zoomRect) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const sx = zoomRect.x * canvas.width, sy = zoomRect.y * canvas.height;
      const sw = zoomRect.w * canvas.width, sh = zoomRect.h * canvas.height;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const bw = Math.max(3, Math.round(canvas.width * 0.006));
      ctx.lineWidth = bw;
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(bw / 2, bw / 2, canvas.width - bw, canvas.height - bw);
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
  }

  window.addEventListener('resize', function () {
    if (zoomLevel > 1 && !zoomPreviewMode) updateZoomBoxPosition();
    if (frozen && selectedShapeId != null) {
      const shape = shapes.find(function (s) { return s.id === selectedShapeId; });
      if (shape) positionHandles(shape);
    }
  });

  SM.api.fetchAll().then(function (data) {
    DATA = data;
    SM.sidebar.applySettings(data.settings);
    renderEmpty();
  }).catch(function (err) {
    main.innerHTML = '<div class="empty-state">' + err.message + '</div>';
  });
})();
