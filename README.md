# SM Stats

App de gestión de un equipo de fútbol amateur: plantilla, cuerpo técnico,
asistencia a entrenamientos y partidos, y estadísticas — con estética neón
sobre fondo oscuro. HTML/CSS/JS puro (sin build, sin frameworks), pensada
para desplegarse en **GitHub Pages** y usar **Google Sheets** como base de
datos.

## Cómo funciona

- El **entrenador introduce todo desde la propia app** (jugadores, cuerpo
  técnico, partidos, actas, asistencia) — nunca edita la hoja de cálculo a
  mano.
- Las lecturas y escrituras pasan por un pequeño backend en **Google Apps
  Script** publicado como aplicación web, que es el único que tiene acceso
  de escritura a la Sheet.
- **Modo demo incluido**: mientras no conectes tu propia hoja, la app
  funciona igualmente con un dataset de ejemplo
  (`assets/data/sample-data.json`). Los cambios que hagas en modo demo se
  ven al momento pero no se guardan al recargar — es solo para probar la
  interfaz.

## Ver la app en local

No hace falta instalar nada, solo un servidor estático (el navegador no
puede hacer `fetch` a un archivo abierto con `file://`):

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

## Conectar Google Sheets (para uso real)

1. **Crea una Google Sheet nueva** (sheets.new). Puede llamarse como
   quieras, por ejemplo "SM Stats — Datos".
2. Abre **Extensiones → Apps Script** desde la propia hoja (importante:
   así el script queda vinculado a esa Sheet y no necesitas configurar
   ningún ID).
3. Borra el contenido de `Code.gs` que aparece por defecto y pega ahí todo
   el contenido de [`apps-script/Code.gs`](apps-script/Code.gs) de este
   repositorio.
4. En el propio editor de Apps Script, selecciona la función `setupSheets`
   en el desplegable de funciones (arriba) y pulsa **Ejecutar**. La
   primera vez te pedirá autorizar permisos (es tu propio script, es
   seguro). Esto crea todas las pestañas necesarias (`Players`, `Staff`,
   `Sessions`, `Attendance`, `Matches`, `MatchEvents`, `MatchAppearances`,
   `MatchIntervals`, `MatchLiveEvents`, `Checkins`, `PlanEntries`,
   `DevGoals`, `VideoClips`, `Cuotas`, `Uniformes`, `Settings`) con sus
   columnas ya preparadas — vuelve a ejecutarla sin miedo cada vez que
   actualices `Code.gs` con una versión más reciente del repo: no borra ni
   toca filas ya existentes, solo añade las pestañas/columnas que falten.
5. (Opcional pero recomendado) En **Configuración del proyecto → Propiedades
   del script**, añade una propiedad `TOKEN` con un valor secreto a tu
   elección (por ejemplo una cadena aleatoria larga). Esto evita que
   cualquiera que descubra la URL pueda escribir en tu hoja por accidente.
6. **Implementar → Nueva implementación**:
   - Tipo: *Aplicación web*.
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier usuario**.
   - Copia la URL que te da ("URL de la aplicación web") — termina en
     `/exec`.
7. Abre [`assets/js/config.js`](assets/js/config.js) en el repo y rellena:

   ```js
   SM.config = {
     APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
     TOKEN: 'el-mismo-valor-que-pusiste-en-TOKEN' // déjalo vacío si no usaste TOKEN
   };
   ```
8. Sube el cambio (commit + push). La app ya lee y escribe en tu Sheet.

Cada vez que cambies `Code.gs`, tienes que volver a
**Implementar → Gestionar implementaciones → Editar (lápiz) → Nueva
versión → Implementar** para que los cambios se publiquen en la URL.

### Cargar tu plantilla real

Lo más rápido es añadir los jugadores y el cuerpo técnico desde la propia
app (botones **+ Añadir jugador** / **+ Añadir miembro**) una vez conectada
la Sheet — así te aseguras de que los identificadores y el formato de cada
fila son correctos. También puedes escribir filas directamente en la
pestaña `Players`/`Staff` si lo prefieres; respeta el orden de columnas de
la cabecera.

### Fotos de jugadores y del cuerpo técnico

El campo `foto_url` de `Players` y `Staff` acepta cualquier URL de imagen
pública (por ejemplo, una foto subida a Google Drive con "Compartir → cualquier
persona con el enlace" y convertida a enlace directo, o alojada en el
propio repo bajo `assets/img/`). Si se deja vacío, la app muestra
automáticamente el icono de silueta que ya viste en el diseño — no hace
falta rellenarlo para que todo funcione.

## Desplegar en GitHub Pages

1. En GitHub, ve a **Settings → Pages** del repositorio.
2. En "Build and deployment", elige **Deploy from a branch**.
3. Selecciona la rama (`main`) y la carpeta **/ (root)**.
4. Guarda. GitHub te dará la URL pública en un par de minutos
   (algo como `https://<usuario>.github.io/sm-stats/`).

No hace falta ningún paso de build: es HTML/CSS/JS servido tal cual.

## Estructura del proyecto

```
index.html              Dashboard
plantilla.html          Plantilla (jugadores) + Cuerpo técnico
jugador.html            Ficha de un jugador (?id=...)
asistencia.html         Control de asistencia
planificacion.html      Objetivos de entrenamiento por día (cuerpo técnico)
cuadrante.html          Cuadrante semanal (todas las categorías) + descarga PNG
partidos.html           Partidos (próximo, jugados, acta)
estadisticas.html       Estadísticas comparativas del equipo
acceso.html             Login privado para familias/jugadores, staff y directiva
mi-jugador.html         Portal reducido de familia (?id=...)
directiva.html          Portal de gestión de la directiva (cuotas, uniformes, datos personales)
assets/
  css/theme.css          Tokens de diseño (colores, tipografía) y componentes
  js/config.js            URL del Apps Script + token
  js/api.js               Acceso a datos (lee/escribe; fallback a modo demo)
  js/stats.js              Cálculo de estadísticas a partir de los datos crudos
  js/charts.js             Gráficos SVG (radar, evolución, gauge, barras)
  js/forms.js              Formularios reutilizados (jugador, staff)
  js/auth.js               Credenciales de familia/staff (ver más abajo)
  js/sidebar.js            Navegación lateral compartida
  js/ui.js                 Helpers varios (fechas, avatares, toasts, modal)
  js/pages/*.js             Lógica de cada página
  data/sample-data.json    Dataset de ejemplo (modo demo)
apps-script/Code.gs      Backend de Google Apps Script
```

## Acceso de familias y cuerpo técnico

Además de la app completa (para ti como entrenador), hay un acceso privado
reducido en `acceso.html`, pensado para compartir con las familias y con el
resto del cuerpo técnico. No hace falta tocar el Apps Script ni guardar
ninguna contraseña: las credenciales se calculan a partir de datos que ya
existen en la Sheet.

- **Familias/jugadores** — usuario: el nombre del jugador en mayúsculas
  (p. ej. `DIEGO PRIETO`); contraseña: las 4 primeras letras del nombre +
  el año de nacimiento (p. ej. `DIEG2015`). Entran a `mi-jugador.html`, una
  ficha reducida de su hijo/a con calendario de próximas sesiones y si está
  convocado al próximo partido — **sin** la nota de evaluación de partidos
  ni el gráfico de evolución de rendimiento, que se queda a nivel interno.
  Tampoco se muestran los radares de atributos/valores con cifras (para no
  fomentar comparaciones entre compañeros): en su lugar, dos etiquetas
  automáticas sin número — "Punto fuerte" y "Valor que más destaca" — con
  el atributo/valor en el que más puntúa ese jugador.
- **Cuerpo técnico** — mismo esquema pero con la fecha de alta en vez de
  la de nacimiento (p. ej. `MARC2022`). Entran directamente a la app
  completa, con el mismo acceso que tú.
- **Directiva** — mismo esquema que el resto del staff (nombre + fecha de
  alta), pero marcando "¿Es directiva?" → Sí al dar de alta a esa persona
  en Plantilla → Cuerpo técnico. Entran a su propio portal
  (`directiva.html`): datos personales/contacto de los jugadores, cuotas
  mensuales (cuadrícula jugador × mes — toca una casilla para marcar
  pagado/pendiente, con un resumen de recaudado/pendiente/al día) y
  uniformes (kits de entrenamiento/paseo por jugador: talla, pedido,
  entregado y pagado — este último también se marca tocando la celda, con
  su propio resumen de entregas y pagos pendientes) — **sin** ningún dato
  deportivo (atributos, partidos, asistencia a entrenamientos, bienestar).
  Tú, como entrenador/a, también tienes acceso directo a este portal desde
  el enlace "Directiva" de la barra lateral de la app completa, sin
  necesidad de pasar por `acceso.html`.

  El importe de la cuota y el precio de cada kit de uniforme se calculan
  solos: usan el valor por defecto de Ajustes (cuota mensual, precio de
  uniforme de entrenamiento y de paseo) salvo que ese jugador tenga su
  propia excepción guardada en su ficha (sección "Condiciones económicas
  personalizadas" en Plantilla → editar jugador) — útil para una beca o un
  precio distinto sin tener que tocarlo cada mes a mano.

Desde la ficha de cada jugador (`jugador.html`) y desde la tarjeta de cada
miembro del staff en Plantilla puedes ver y copiar sus credenciales con un
clic ("Copiar acceso"), para pasárselas por el canal que prefieras. El
enlace `acceso.html` también está siempre accesible desde el pie de la
barra lateral ("Acceso familias / staff").

## Notas

- Todas las estadísticas (goles, asistencias, % de asistencia, evolución de
  rendimiento...) se calculan en el navegador a partir de los datos
  "crudos" de la Sheet — nunca se guardan cifras ya calculadas, así no se
  pueden desincronizar.
- El "rating" que se ve en las tarjetas de jugador es la media de sus 6
  atributos (ritmo, tiro, pase, regate, defensa, físico), editables desde
  la ficha del jugador.
- Es una app de un solo equipo/club (no multi-usuario ni multi-equipo) por
  diseño, a juego con el alcance pedido.
