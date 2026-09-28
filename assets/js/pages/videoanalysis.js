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
  const FILL_MODES = [
    { key: 'border', label: 'Con borde' },
    { key: 'fill', label: 'Relleno' }
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
  let activeTool = null; // null (seleccionar/mover) | 'line' | 'curve'
  let selectedShapeId = null;
  let creatingShape = null; // línea/curva en curso mientras se arrastra para crearla
  let currentDefaults = { color: LINE_COLORS[0], width: LINE_WIDTH_OPTIONS[1].px, dash: 'solid', arrow: 'none', fillMode: 'border' };
  let shapeDragState = null; // arrastre de un nodo de una forma ya creada: { shapeId, xField, yField }
  let handleEls = {}; // { [handleKey]: elemento DOM }, según HANDLE_DEFS[shape.type]

  // Qué nodos arrastrables tiene cada tipo de forma, y a qué campo de
  // coordenadas (fracciones 0..1) corresponde cada uno. Común a todos los
  // tipos con nodos (línea, curva, y lo que venga después), así el resto de
  // funciones de selección/arrastre no necesitan saber de tipos concretos.
  // get/set en vez de simples nombres de campo: un nodo de línea/curva es un
  // punto suelto (x,y) pero el tirador de tamaño de un rectángulo/elipse es
  // la esquina calculada (x+w, y+h) y al arrastrarlo hay que recalcular
  // w/h, no escribir directamente sobre "el campo". Con funciones, el resto
  // del código (crear/posicionar/arrastrar un tirador) no necesita saber
  // qué tipo de forma es.
  const HANDLE_DEFS = {
    line: [
      { key: 'start', get: function (s) { return { x: s.x1, y: s.y1 }; }, set: function (s, x, y) { s.x1 = x; s.y1 = y; } },
      { key: 'end', get: function (s) { return { x: s.x2, y: s.y2 }; }, set: function (s, x, y) { s.x2 = x; s.y2 = y; } }
    ],
    curve: [
      { key: 'start', get: function (s) { return { x: s.x1, y: s.y1 }; }, set: function (s, x, y) { s.x1 = x; s.y1 = y; } },
      { key: 'control', get: function (s) { return { x: s.cx, y: s.cy }; }, set: function (s, x, y) { s.cx = x; s.cy = y; } },
      { key: 'end', get: function (s) { return { x: s.x2, y: s.y2 }; }, set: function (s, x, y) { s.x2 = x; s.y2 = y; } }
    ],
    rect: [
      { key: 'resize', get: function (s) { return { x: s.x + s.w, y: s.y + s.h }; }, set: function (s, x, y) { s.w = clamp(x - s.x, 0.02, 1 - s.x); s.h = clamp(y - s.y, 0.02, 1 - s.y); } }
    ]
  };
  HANDLE_DEFS.ellipse = HANDLE_DEFS.rect;

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
            '<button type="button" class="pill va-tool-btn" data-tool="curve">Curva</button>' +
            '<button type="button" class="pill va-tool-btn" data-tool="rect">Cuadrado</button>' +
            '<button type="button" class="pill va-tool-btn" data-tool="ellipse">Elipse</button>' +
            '<span style="flex:1 1 auto;"></span>' +
            '<button type="button" class="btn btn-outline" id="va-unfreeze-btn">Volver al vídeo</button>' +
          '</div>' +
          '<div id="va-shape-props" style="display:none;flex-direction:column;gap:10px;">' +
            '<div class="va-group-row">' +
              '<span class="va-group-label">Color</span>' +
              LINE_COLORS.map(function (c) { return '<button type="button" class="va-color-swatch" data-color="' + c + '" style="background:' + c + ';"></button>'; }).join('') +
              '<span class="va-group-label">Grosor</span>' +
              LINE_WIDTH_OPTIONS.map(function (w) { return '<button type="button" class="pill va-width-btn" data-width="' + w.px + '">' + w.label + '</button>'; }).join('') +
              '<span class="va-group-label">Trazo</span>' +
              DASH_STYLES.map(function (d) { return '<button type="button" class="pill va-dash-btn" data-dash="' + d.key + '">' + d.label + '</button>'; }).join('') +
            '</div>' +
            '<div class="va-group-row" id="va-arrow-row">' +
              '<span class="va-group-label">Flecha</span>' +
              ARROW_STYLES.map(function (a) { return '<button type="button" class="pill va-arrow-btn" data-arrow="' + a.key + '">' + a.label + '</button>'; }).join('') +
            '</div>' +
            '<div class="va-group-row" id="va-fill-row">' +
              '<span class="va-group-label">Estilo</span>' +
              FILL_MODES.map(function (f) { return '<button type="button" class="pill va-fill-btn" data-fill="' + f.key + '">' + f.label + '</button>'; }).join('') +
            '</div>' +
            '<div class="va-group-row">' +
              '<button type="button" class="btn btn-outline" id="va-delete-shape" style="color:var(--red-bright);display:none;">Eliminar</button>' +
            '</div>' +
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
    activeTool = null; selectedShapeId = null; creatingShape = null;
    currentDefaults = { color: LINE_COLORS[0], width: LINE_WIDTH_OPTIONS[1].px, dash: 'solid', arrow: 'none', fillMode: 'border' };
    shapeDragState = null; handleEls = {};

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
    main.querySelectorAll('.va-fill-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { applyProp('fillMode', btn.getAttribute('data-fill')); });
    });
    main.querySelector('#va-delete-shape').addEventListener('click', function () {
      shapes = shapes.filter(function (s) { return s.id !== selectedShapeId; });
      selectShape(null);
    });

    canvas.addEventListener('pointerdown', function (e) {
      if (!frozen) return;
      const p = canvasPointFromEvent(e);
      if (activeTool === 'line' || activeTool === 'curve') {
        creatingShape = { type: activeTool, x1: p.x, y1: p.y, x2: p.x, y2: p.y, cx: p.x, cy: p.y };
        canvas.setPointerCapture(e.pointerId);
      } else if (activeTool === 'rect' || activeTool === 'ellipse') {
        creatingShape = { type: activeTool, anchorX: p.x, anchorY: p.y, x: p.x, y: p.y, w: 0, h: 0 };
        canvas.setPointerCapture(e.pointerId);
      } else {
        const hitId = hitTestShapes(p);
        selectShape(hitId);
        // Un rectángulo/elipse se mueve arrastrando su propio cuerpo (el
        // tirador de la esquina es solo para el tamaño) — línea/curva no
        // tienen "cuerpo", solo sus nodos, así que no aplica.
        if (hitId != null) {
          const shape = shapes.find(function (s) { return s.id === hitId; });
          if (shape.type === 'rect' || shape.type === 'ellipse') {
            shapeDragState = { shapeId: hitId, mode: 'move', startX: p.x, startY: p.y, origX: shape.x, origY: shape.y };
          }
        }
      }
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!creatingShape) return;
      const p = canvasPointFromEvent(e);
      if (creatingShape.type === 'rect' || creatingShape.type === 'ellipse') {
        creatingShape.x = Math.min(creatingShape.anchorX, p.x);
        creatingShape.y = Math.min(creatingShape.anchorY, p.y);
        creatingShape.w = Math.abs(p.x - creatingShape.anchorX);
        creatingShape.h = Math.abs(p.y - creatingShape.anchorY);
      } else {
        creatingShape.x2 = p.x; creatingShape.y2 = p.y;
        // Mientras se arrastra, el punto de control sigue el punto medio (la
        // vista previa sale recta) — la curva visible de verdad se le da al
        // soltar, ver más abajo.
        creatingShape.cx = (creatingShape.x1 + p.x) / 2;
        creatingShape.cy = (creatingShape.y1 + p.y) / 2;
      }
      drawFrame();
    });
    canvas.addEventListener('pointerup', function () {
      if (!creatingShape) return;
      const drawn = creatingShape;
      creatingShape = null;
      const isBox = drawn.type === 'rect' || drawn.type === 'ellipse';
      const dx = (drawn.x2 - drawn.x1) * canvas.width, dy = (drawn.y2 - drawn.y1) * canvas.height;
      const tooSmall = isBox ? (drawn.w * canvas.width < 6 || drawn.h * canvas.height < 6) : Math.hypot(dx, dy) < 6;
      if (tooSmall) { drawFrame(); return; } // tap accidental, sin arrastre real
      if (isBox) { delete drawn.anchorX; delete drawn.anchorY; }
      if (drawn.type === 'curve') {
        // Un punto de control justo en el medio da una "curva" recta, poco
        // útil de entrada — se desplaza en perpendicular al segmento (en
        // espacio de píxeles, para no deformarse si el canvas no es
        // cuadrado) para que la curva nazca ya visiblemente curvada y solo
        // haga falta afinarla arrastrando el tirador central.
        const x1px = drawn.x1 * canvas.width, y1px = drawn.y1 * canvas.height;
        const x2px = drawn.x2 * canvas.width, y2px = drawn.y2 * canvas.height;
        const midXpx = (x1px + x2px) / 2, midYpx = (y1px + y2px) / 2;
        const lenPx = Math.hypot(dx, dy) || 1;
        const perpXpx = -dy / lenPx, perpYpx = dx / lenPx;
        const offsetPx = 0.18 * lenPx;
        drawn.cx = (midXpx + perpXpx * offsetPx) / canvas.width;
        drawn.cy = (midYpx + perpYpx * offsetPx) / canvas.height;
      }
      const shape = Object.assign({ id: nextShapeId++ }, drawn, currentDefaults);
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
      if (shapeDragState.mode === 'node') {
        shapeDragState.def.set(shape, x, y);
      } else if (shapeDragState.mode === 'move') {
        shape.x = clamp(shapeDragState.origX + (x - shapeDragState.startX), 0, 1 - shape.w);
        shape.y = clamp(shapeDragState.origY + (y - shapeDragState.startY), 0, 1 - shape.h);
      }
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

  function pointOnQuadCurve(x1, y1, cx, cy, x2, y2, t) {
    const mt = 1 - t;
    return { x: mt * mt * x1 + 2 * mt * t * cx + t * t * x2, y: mt * mt * y1 + 2 * mt * t * cy + t * t * y2 };
  }

  function distToShape(px, py, s) {
    if (s.type === 'rect' || s.type === 'ellipse') {
      // Toda la caja cuenta como zona de selección (no solo el borde) — más
      // cómodo de pinchar, sobre todo en el estilo "con borde" donde el
      // interior está vacío.
      const x = s.x * canvas.width, y = s.y * canvas.height, w = s.w * canvas.width, h = s.h * canvas.height;
      if (px >= x && px <= x + w && py >= y && py <= y + h) return 0;
      const dx = Math.max(x - px, 0, px - (x + w));
      const dy = Math.max(y - py, 0, py - (y + h));
      return Math.hypot(dx, dy);
    }
    const x1 = s.x1 * canvas.width, y1 = s.y1 * canvas.height, x2 = s.x2 * canvas.width, y2 = s.y2 * canvas.height;
    if (s.type === 'curve') {
      const cx = s.cx * canvas.width, cy = s.cy * canvas.height;
      let prev = { x: x1, y: y1 }, best = Infinity;
      for (let i = 1; i <= 16; i++) {
        const pt = pointOnQuadCurve(x1, y1, cx, cy, x2, y2, i / 16);
        best = Math.min(best, distToSegment(px, py, prev.x, prev.y, pt.x, pt.y));
        prev = pt;
      }
      return best;
    }
    return distToSegment(px, py, x1, y1, x2, y2);
  }

  function hitTestShapes(p) {
    const px = p.x * canvas.width, py = p.y * canvas.height;
    let best = null, bestDist = 14; // tolerancia en píxeles de canvas
    shapes.forEach(function (s) {
      const d = distToShape(px, py, s);
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
    const type = shape ? shape.type : activeTool;
    const showProps = type != null;
    propsRow.style.display = showProps ? 'flex' : 'none';
    if (!showProps) return;
    const isLineLike = type === 'line' || type === 'curve';
    const isBoxLike = type === 'rect' || type === 'ellipse';
    main.querySelector('#va-arrow-row').style.display = isLineLike ? '' : 'none';
    main.querySelector('#va-fill-row').style.display = isBoxLike ? '' : 'none';
    const props = shape || currentDefaults;
    main.querySelectorAll('.va-color-swatch').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-color') === props.color); });
    main.querySelectorAll('.va-width-btn').forEach(function (b) { b.classList.toggle('active', Number(b.getAttribute('data-width')) === props.width); });
    main.querySelectorAll('.va-dash-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-dash') === props.dash); });
    main.querySelectorAll('.va-arrow-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-arrow') === props.arrow); });
    main.querySelectorAll('.va-fill-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-fill') === props.fillMode); });
    main.querySelector('#va-delete-shape').style.display = shape ? '' : 'none';
  }

  function removeHandles() {
    Object.keys(handleEls).forEach(function (k) { handleEls[k].remove(); });
    handleEls = {};
  }

  function createHandle(def, shapeId, isControl) {
    const el = document.createElement('div');
    el.className = 'va-node-handle' + (isControl ? ' control' : '');
    canvasWrap.appendChild(el);
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      shapeDragState = { shapeId: shapeId, mode: 'node', def: def };
    });
    return el;
  }

  function positionHandles(shape) {
    const wrapRect = canvasWrap.getBoundingClientRect();
    (HANDLE_DEFS[shape.type] || []).forEach(function (def) {
      const el = handleEls[def.key];
      if (!el) return;
      const p = def.get(shape);
      el.style.left = (p.x * wrapRect.width) + 'px';
      el.style.top = (p.y * wrapRect.height) + 'px';
    });
  }

  function updateHandles() {
    removeHandles();
    if (!frozen || selectedShapeId == null) return;
    const shape = shapes.find(function (s) { return s.id === selectedShapeId; });
    if (!shape) return;
    (HANDLE_DEFS[shape.type] || []).forEach(function (def) {
      handleEls[def.key] = createHandle(def, shape.id, def.key === 'control');
    });
    positionHandles(shape);
  }

  // ---- dibujo del fotograma ----

  function applyDashPattern(w, dashKey) {
    if (dashKey === 'dashed') ctx.setLineDash([w * 2.4, w * 2]);
    else if (dashKey === 'longdash') ctx.setLineDash([w * 5.5, w * 2.4]);
    else ctx.setLineDash([]);
  }

  function drawLineShape(s) {
    const x1 = s.x1 * canvas.width, y1 = s.y1 * canvas.height, x2 = s.x2 * canvas.width, y2 = s.y2 * canvas.height;
    const w = s.width;
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    applyDashPattern(w, s.dash);
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

  function drawCurveShape(s) {
    const x1 = s.x1 * canvas.width, y1 = s.y1 * canvas.height;
    const x2 = s.x2 * canvas.width, y2 = s.y2 * canvas.height;
    const cx = s.cx * canvas.width, cy = s.cy * canvas.height;
    const w = s.width;
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    applyDashPattern(w, s.dash);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cx, cy, x2, y2);
    ctx.stroke();
    // La punta de la flecha sigue la tangente de la curva en ese extremo
    // (dirección hacia/desde el punto de control), no la línea recta entre
    // los dos nodos — si no, se ve claramente desalineada en curvas muy
    // pronunciadas.
    if (s.arrow === 'end' || s.arrow === 'both') {
      ctx.setLineDash([]);
      drawArrowHead(x2, y2, Math.atan2(y2 - cy, x2 - cx), w);
    }
    if (s.arrow === 'both') {
      ctx.setLineDash([]);
      drawArrowHead(x1, y1, Math.atan2(y1 - cy, x1 - cx), w);
    }
    ctx.restore();
  }

  function drawRectShape(s) {
    const x = s.x * canvas.width, y = s.y * canvas.height, w = s.w * canvas.width, h = s.h * canvas.height;
    ctx.save();
    if (s.fillMode === 'fill') {
      ctx.fillStyle = s.color;
      ctx.fillRect(x, y, w, h);
    } else {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      applyDashPattern(s.width, s.dash);
      ctx.strokeRect(x, y, w, h);
    }
    ctx.restore();
  }

  function drawEllipseShape(s) {
    const x = s.x * canvas.width, y = s.y * canvas.height, w = s.w * canvas.width, h = s.h * canvas.height;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, Math.max(w / 2, 0.5), Math.max(h / 2, 0.5), 0, 0, Math.PI * 2);
    if (s.fillMode === 'fill') {
      ctx.fillStyle = s.color;
      ctx.fill();
    } else {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      applyDashPattern(s.width, s.dash);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShape(s) {
    if (s.type === 'line') drawLineShape(s);
    else if (s.type === 'curve') drawCurveShape(s);
    else if (s.type === 'rect') drawRectShape(s);
    else if (s.type === 'ellipse') drawEllipseShape(s);
  }

  function drawFrame() {
    if (!ctx) return;
    if (frozen) {
      if (frozenSourceCanvas) ctx.drawImage(frozenSourceCanvas, 0, 0);
      shapes.forEach(drawShape);
      if (creatingShape) drawShape(Object.assign({ id: 0 }, creatingShape, currentDefaults));
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
