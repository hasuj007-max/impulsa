# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Escribe y comenta **en español**: el código, los comentarios y los mensajes de commit de este repo están en español, y el usuario trabaja en español.

## Qué es

PWA de prospección diaria para la red de mercadeo del usuario. La usa él y las
personas de su red. Sin framework, sin dependencias, sin paso de build: **toda
la app vive en `public/index.html`** (HTML + CSS + JS en un archivo, ~3700
líneas). `public/sw.js` es el service worker. En vivo en
**https://impulsa-d9262.firebaseapp.com** (Firebase Hosting).

⚠️ **El `README.md` está desactualizado** (dice GitHub Pages y "no hay servidor
ni cuenta"; hoy es Firebase Hosting con cuentas de Google). Este archivo manda.

## Estado y pendientes (al 27-09-2026)

Lo último desplegado es `impulsa-v35`. Pendiente, en el orden propuesto:

1. **Subir a GitHub**: hay commits locales sin subir (`git status -sb`). Todo el
   rediseño y lo posterior solo existe en su Mac. `git push` no afecta el
   redirect viejo de GitHub Pages (es el `index.html` de la raíz).
2. **Respaldo de datos fresco** con `herramientas/respaldar.sh`: el último en
   `respaldos/` es del 02-09-2026, y desde entonces cambiaron las ventas y la
   regla de la racha.
3. **Ventas: rediseñar el modelo.** Él dijo que "venta en pesos + ganancia en
   dólares" está mal planteado y tiene otra idea que **aún no ha contado**.
   Preguntársela antes de tocar nada de ventas.
4. **Recordatorios.** Versión barata: en el tablero del líder, junto a quien va
   atrasado, un botón que abra `https://wa.me/?text=…` con el mensaje escrito.
   Notificaciones de verdad: plan Blaze + Cloud Function + FCM, y en iPhone solo
   con la app instalada e iOS 16.4+.
5. **Que el socio vea a su equipo** ("7 de 10 ya cerraron hoy"). Es decisión
   suya: hoy la app promete que la constancia de cada uno solo la ve el líder.
   Tendría que ser opcional y cambiar las reglas de `resumenes/`.
6. README desactualizado (menor).

## Cómo trabaja él

- Habla español de México, informal y directo. Respuestas cortas; si hay que
  decidir, `AskUserQuestion` con la opción recomendada primero le funciona bien.
- **Cambios grandes de diseño: primero un prototipo que pueda tocar** (así se
  hizo el rediseño). Cambios chicos o arreglos: los hace directo cuando dice "haz".
- **Siempre preguntar antes de desplegar** — cada despliegue le llega a toda la
  red. Suele contestar "sí, despliega". Después de desplegar, verificar en vivo.
- Quiere gastar pocos tokens: leer este archivo en vez de re-explorar.

## Comandos

```bash
# Servir en local (el service worker exige http://, no funciona en file://)
# Desde .claude/launch.json: preview_start name "impulsa" (8791) o "impulsa-aislado" (8799)
python3 -m http.server 8791 --directory public

# Desplegar a producción (toda la red lo ve al abrir la app)
firebase deploy --only hosting

# Verificar un despliegue — el ?cb= NO es opcional, ver "Trampas"
curl -s "https://impulsa-d9262.firebaseapp.com/?cb=$(date +%s)" | grep loQueSea

# Respaldo y rescate de datos reales (usan la sesión del CLI de firebase)
herramientas/respaldar.sh
herramientas/rescatar.sh
```

No hay tests, linter ni build. La verificación es abrir la app en el navegador.

## Cómo verificar cambios

☠️ **Antes de probar en el navegador, comprobar que no haya sesión iniciada y
neutralizar `window.Nube`.** El 05-08-2026 unas pruebas en `localhost:8791`
escribieron datos falsos en una cuenta real con la sesión abierta.

Usar el puerto **8799** (`impulsa-aislado`): es otro origen, así que no puede
haber sesión. **Para tener la app llena de datos de ejemplo, leer y pegar
`herramientas/demo-navegador.js` en `javascript_tool`**: neutraliza la nube,
oculta la portada y siembra racha, prospectos, ventas y agenda. Lo mínimo, si
solo hace falta la app vacía:

```js
window.Nube = null;                                          // nada sube a la nube
document.getElementById('portada').classList.add('oculto');  // basta: .oculto es !important
localStorage.clear();                                        // AL TERMINAR
```

Si el navegador sirve una copia vieja pese a recargar, es el service worker:
desregistrarlo y borrar cachés (`navigator.serviceWorker.getRegistrations()`,
`caches.keys()`). Antes de probar un cambio, `node --check` sobre los scripts
extraídos del HTML atrapa errores de sintaxis sin abrir el navegador.

## Arquitectura

**Un solo objeto `datos`**, serializado a `localStorage` bajo la clave
`impulsa_v1`. Las secciones del script van marcadas con `/* ====== NOMBRE ====== */`.

Las pestañas se llaman en pantalla **Hoy · Gente · Números · Ajustes**, pero en
el código conservan sus ids de antes: `hoy`, `prospectos`, `metricas`, `ajustes`
(`irA()`, `#tab-…`, `pintarProspectos()`, `pintarMetricas()`). La pantalla Hoy,
de arriba abajo: tira de los últimos 7 días → bloque de estado (anillo con la
marca del 80%, mensaje, pie, aviso de atrasados) → actividades (tarjeta "Te
recomiendo" y luego la lista: empezadas, sin empezar, cumplidas tachadas,
pausadas; ver `acomodarMetas()`) → "Hoy le
escribes a" (seguimientos) → resultados del mes (ventas/socios con − y +) →
"Ventas de <mes>" → agenda.

```
datos = {
  metas[],        // el plan diario: {id, nombre, objetivo}
  planVersion,    // ver "Publicar un plan nuevo"
  dias{},         // "YYYY-MM-DD" → {idMeta: conteo, _pl: idDePlan}
  planes{},       // listas de metas deduplicadas; cada día apunta a la suya con _pl
  prospectos[],   // {id, nombre, red, etapa, contacto, fecha, notas, creado, hist{}, log[]}
  ventas[],       // {id, f, monto (pesos), ganancia (dólares)} — solo el dinero
  agenda[],       // pendientes personales; NO afectan metas ni racha
  plantillas[], metaMes{}, actualizado, _uid
}
```

**localStorage manda; la nube va detrás.** Cada cambio se guarda local al
instante y sube a Firestore 2.5 s después del último cambio (debounce). En
conflicto entre aparatos gana el `actualizado` más alto.

Tres claves van aparte, **del aparato y no de la cuenta** (nunca suben a la
nube): `impulsa_tema` (claro/oscuro), `impulsa_festejo` (qué festejos ya salieron
hoy) e `impulsa_guia` (si ya vio la guía). No meterlas en `datos`.

**Firestore** (proyecto `impulsa-d9262`, plan Spark):
- `usuarios/{uid}` — un solo documento con `datos` serializado. Solo el dueño lo
  lee y lo escribe, **ni siquiera el admin**.
- `resumenes/{uid}` — colección aparte con el resumen que ve el líder
  (`calcularConstancia()`): constancia, racha, conteos de ventas y socios del
  mes. **Nunca prospectos, notas, agenda ni dinero.**
- `invitaciones/{codigo}` — códigos de un solo uso; canje en dos pasos validado
  por reglas, no por el navegador.

El admin se define por correo en dos sitios que deben coincidir: `CORREO_ADMIN`
en `public/index.html` (qué paneles se ven) y `esAdmin()` en `firestore.rules`
(qué se puede escribir). El que manda de verdad es el de las reglas.

### Decisiones que no se ven en el código

- **Actividad ≠ resultado.** Ventas y socios NO son tareas del día: no dependen
  de uno y tenerlos en la lista rompía la racha. Viven en "Resultados del mes"
  y en `IDS_RESULTADO`, que `metasActivas()` excluye incluso en días viejos.
  Si se añaden más métricas de resultado, van a esa constante.
- **Días cerrados.** Cada día queda ligado al plan que regía ESE día (`_pl`).
  Cambiar el plan hoy no reescribe el historial. Es un candado que él pidió.
- **Meta en objetivo 0 = pausada**: no cuenta ni como lograda ni como pendiente
  en racha, anillo ni barras.
- **Ley de promedios**: el embudo cuenta a los descartados usando `p.hist`
  (fecha de cada etapa alcanzada). Sin eso las tasas salen infladas. Quien es
  cliente Y socio cuenta como UNA persona cerrada, no dos.
- **El mensaje del inicio golpea al día flojo, nunca a la persona**, y del 40%
  para arriba nunca reprocha. Las reglas están escritas sobre `mensajeDelDia()`.
- **Ventas, tal como están hoy (él quiere rediseñarlas, ver Pendientes):** la
  venta en pesos y la ganancia en dólares, con `TASA_USD = 17.5` fija por
  decisión suya (no consultar un tipo de cambio en vivo: la app tiene que
  funcionar sin señal). El CONTEO de ventas vive en `dias[fecha].venta` —de ahí
  comen la meta del mes, el marcador y el resumen del líder— y `datos.ventas`
  solo le pone dinero encima. Quitar una venta le baja el conteo al día DE ESA
  venta, no al de hoy. El dinero nunca sale al tablero del líder.
- ☠️ **Regla de oro de la pantalla Hoy: mientras alguien cuenta, NADA puede
  mover la lista de actividades.** Si algo encima de ella cambia de alto, o una
  fila cambia de tamaño o de sitio, la fila de abajo sube al punto que acaban
  de tocar y el siguiente toque le suma a la actividad equivocada — y ese número
  se guarda y se sincroniza. Pasó dos veces. Lo que lo sostiene:
  - `ordenMetas` congela el orden; la lista se reacomoda 900 ms después del
    último toque (y al abrir, entrar a la pestaña, cambiar de día, sincronizar o
    editar el plan).
  - `pintarHoy({vivo:true})` —lo que usa `contar()`— NO toca el mensaje ni el
    pie, que están encima de la lista y cambian de renglones (medido: el primer
    toque del día la subía 23 px). Se ponen al día al asentarse.
  - La tarjeta "💡 Te recomiendo" (`#reco`, arriba de la lista) tiene alto
    fijo: nombre a 1 renglón, porqué reservado a 2, cuenta a 1 (medido: 141 px
    con cualquier actividad). En `vivo` sostiene la misma actividad
    (`recoFija`) y no se muestra ni se oculta. La fila recomendada solo lleva
    tinte con `box-shadow`, que no ocupa espacio.
  **Cualquier cosa nueva en Hoy tiene que respetar esto.** Medirlo: contar de 0
  a 79% con `contar()` y comprobar que `#listaMetas` no cambia de `top`.
- **La racha cuenta días con el anillo al 80% o más, con un comodín por
  semana** (decisión suya, 25-09-2026). Antes exigía el 100% y para casi todos
  estaba apagada. Las piezas:
  - `UMBRAL_DIA = 80`; `pctDelDia(clave)` es el % del anillo de cualquier día y
    **el anillo de Hoy se pinta con esa misma función**: la regla y lo que se
    ve no pueden divergir. Redondea igual que el anillo (si ves 80%, cuenta).
  - `diaTrabajado()` = llegó al 80% (cuenta para la racha).
    `diaCompleto()` = 100%, ahora significa **día perfecto**.
  - `rachaHasta(fin)` es la ÚNICA implementación de la regla: camina hacia
    atrás; cada semana de lunes a domingo perdona un día bajo la raya (no suma,
    no rompe); el día en curso no rompe ni gasta comodín. `calcularRacha()` y
    `mejorRacha()` salen de ahí, así que el récord nunca queda bajo la racha.
  - La constancia que se publica al líder mide **lo mismo que la racha** (días
    al 80%); el comodín NO entra en la constancia. El resumen lleva `umbral`
    para que el tablero marque a quien aún publica con la regla vieja.
- **Dos festejos: "Día ganado" (80%) y "Día perfecto" (100%, sello dorado).**
  Salen solo en el toque que cruza la raya (`contar()` compara antes y
  después); abrir la app o sincronizar NO festeja. Una vez por día, tipo y
  aparato (`impulsa_festejo` en localStorage, JSON `{f, t:[…]}`; no viaja a la
  nube). Si un toque cruza las dos rayas sale el perfecto y marca ambas.
- **Los mensajes de noche no pueden mentir sobre la racha**: por encima del 80%
  ya está a salvo, y con el comodín libre un día flojo no la rompe — lo que se
  pierde es el comodín. Ver el bloque "racha en riesgo" de `mensajeDelDia()`.
- **La guía de primera vez** (3 pantallas) sale una vez por aparato
  (`impulsa_guia` en localStorage). **Si cambia cómo funciona algo que la guía
  explica, subir `GUIA_VERSION`** y la vuelve a ver toda la red. Se reabre
  desde Ajustes.
- **Recomendación del día** (`empujonDelDia()`, 27-09-2026, pedida por él):
  una sola actividad, con su porqué en `POR_QUE` por id (las actividades que
  cree un socio caen en un texto general). Orden: la más avanzada desde la
  mitad → una de un toque → `conv` → la más avanzada. Botón: "Ya la hice" en
  las de objetivo 1, "Registrar" (abre la hoja de conteo) en las demás. Se
  quitó el "tu día al X%": completar una sola actividad sube 2-3% y desanimaba.
- **Palomita de seguimiento** (27-09-2026): a quien se le debe mensaje
  (`fecha <= hoy`) le sale un ✓ en `filaPersona()`. Al tocarla: nota "Seguimiento
  hecho ✓" en `p.log` (cuenta como movimiento para "fríos") y `fecha` = hoy +
  `DIAS_SEGUIMIENTO` (3), así el recordatorio vuelve solo. Aviso con Deshacer.
- **Las filas de gente no llevan botón de chat ni etiqueta de etapa**: él los
  pidió fuera ("ya sé por dónde lo voy a contactar"). No volver a ponerlos ni
  meter el chat en la ficha. La etapa se ve en la ficha y en el filtro.
- **Tocar el número de una actividad abre una hoja para escribirlo** (+5, +10,
  "Todas"). Existe porque el plan por defecto suma 145 unidades al día y el "+"
  va de uno en uno. El campo no se autoenfoca a propósito: el teclado taparía
  los atajos.

## Trampas (cada una costó datos o un día de depuración)

☠️ **La migración de `PLAN_VERSION` NO debe tocar `actualizado`.** Estamparle la
hora para que "ganara" a la nube destruyó datos reales: un aparato con copia
vieja se migraba al abrirlo, quedaba con la hora de ahora, le ganaba a la copia
buena y la pisaba entera. No hace falta que gane — `nubeAplicar` también pasa
por `normalizar`.

☠️ **Cerrar sesión deja el aparato en blanco a propósito** (`nubeReiniciar()`),
así que cualquier camino que suba lo local sin haber leído antes la nube puede
borrar la cuenta entera. Hay dos candados: `entrar()` solo sube si consiguió
leer, y `subir()` se niega a pisar la nube con una copia que `pareceVacio()`
salvo que le pasen `permitirVacio` (solo "Borrar todos los datos"). **Al tocar
esa zona, volver a comprobarlo.**

⚠️ **La URL DEBE ser `.firebaseapp.com`, no `.web.app`**, y el `authDomain` debe
coincidir. Con `.web.app` Google responde `redirect_uri_mismatch`; si app y
`authDomain` diferen, Safari corta la credencial y la PWA instalada gira
cargando y vuelve a la portada.

⚠️ **En la PWA instalada en iOS el login va por POPUP, nunca por redirect.** El
redirect hace navegar la app entera a Google y el viaje borra el sessionStorage
con el estado pendiente → `getRedirectResult` vuelve vacío y el usuario cae en
la portada en bucle.

⚠️ **Al desplegar, subir `VERSION` en `sw.js`** o la caché vieja se queda pegada.
Y en `firebase.json` la regla de `Cache-Control: no-cache` tiene que cubrir
**`/` Y `/index.html`**: la app abre en `/`, y con la regla solo en
`/index.html` quedaba con el `max-age=3600` por defecto — los despliegues
tardaban una hora en verse.

⚠️ **Al verificar un despliegue, pedir con `?cb=$(date +%s)`**: sin eso el propio
curl puede traer una copia vieja de una caché intermedia y parecer que el deploy
falló.

⚠️ `PLAN_VERSION` y su bandera van declaradas **antes** de `let datos = cargar()`:
`cargar()` llama a `normalizar()`, que las lee, y con `const`/`let` declaradas
después revienta el script entero por temporal dead zone (pantalla en blanco).
Lo mismo aplica a cualquier `let`/`const` nuevo que se lea desde `normalizar()`.

⚠️ **Cascada CSS: `.oculto` lleva `!important` y tiene que seguir llevándolo.**
Es una utilidad: cuando algo lleva esa clase, se esconde y punto. Sin el
`!important` dependía del orden de aparición y perdía contra cualquier selector
de ID. Eso ya pasó: `#panelCodigo{display:flex}` le ganaba por especificidad y
el campo del código de invitación salía SIEMPRE en la portada, junto al botón de
Google y a "Usar otra cuenta", aunque la cuenta no necesitara código. Estuvo así
desde que se añadieron los códigos (30-07-2026) hasta el 25-09-2026, y dos
revisiones de código no lo vieron porque el HTML y el JS eran correctos — el
fallo estaba solo en la cascada.

## Publicar un plan de actividades nuevo a TODA la red

Cambiar `METAS_INICIALES` y subir `PLAN_VERSION`. Cada cuenta que abra la app
con una versión menor adopta el plan sola y avisa; conserva conteos, historial,
prospectos, meta mensual y sesión. Lo aplica el propio aparato con los permisos
de cada quien: **no hace falta llave de servicio ni acceso a datos ajenos**, que
es justo lo que él eligió al montar la privacidad. Cada versión lleva su
migración en `migrarPlan()`, tocando lo MÍNIMO: la primera vez se reemplazó la
lista entera y la gente perdió las metas que había personalizado.

📌 **Él decidió expresamente NO limpiar los nombres de las actividades**
("Agregar 10 personas a fb" junto a un 0/10). Se le ofreció subir
`PLAN_VERSION` y dijo que no: prefiere que a nadie de su red le cambie el plan.
`METAS_INICIALES` y `PLAN_VERSION` están como están a propósito — no
"arreglarlo" por iniciativa propia.

## Rescate de datos

`herramientas/respaldar.sh` y `rescatar.sh` guardan en `respaldos/` (ignorado
por git: son datos de su red). El plan Spark no tiene recuperación a un punto en
el tiempo, **pero Firestore conserva 1 hora de versiones igualmente**: se leen
con `?readTime=...Z` en la API REST. Eso salvó la cuenta el 03-08-2026. Pasada
esa hora solo queda `respaldos/`.
