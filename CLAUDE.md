# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Escribe y comenta **en español**: el código, los comentarios y los mensajes de commit de este repo están en español, y el usuario trabaja en español.

## Qué es

PWA de prospección diaria para la red de mercadeo del usuario. La usa él y las
personas de su red. Sin framework, sin dependencias, sin paso de build: **toda
la app vive en `public/index.html`** (HTML + CSS + JS en un archivo, ~3100
líneas). `public/sw.js` es el service worker.

⚠️ **El `README.md` está desactualizado** (dice GitHub Pages y "no hay servidor
ni cuenta"; hoy es Firebase Hosting con cuentas de Google). Este archivo manda.

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
haber sesión. Receta que funciona:

```js
window.Nube = null;                       // corta cualquier subida a la nube
const p = document.getElementById('portada');
p.classList.add('oculta');                // la portada vuelve tras resolver auth
new MutationObserver(()=>{ if(!p.classList.contains('oculta')) p.classList.add('oculta'); })
  .observe(p, {attributes:true});
// ...sembrar datos en `datos`, luego repintarTodo()
localStorage.clear();                     // AL TERMINAR
```

Si el navegador sirve una copia vieja pese a recargar, es el service worker:
desregistrarlo y borrar cachés (`navigator.serviceWorker.getRegistrations()`,
`caches.keys()`).

## Arquitectura

**Un solo objeto `datos`**, serializado a `localStorage` bajo la clave
`impulsa_v1`. Las secciones del script van marcadas con `/* ====== NOMBRE ====== */`.

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
- **La venta va en pesos y la ganancia en dólares**, con `TASA_USD = 17.5` fija
  por decisión suya (no consultar un tipo de cambio en vivo: la app tiene que
  funcionar sin señal). El CONTEO de ventas sigue en `dias[fecha].venta`;
  `datos.ventas` solo le pone dinero encima.
- **El orden de las actividades se congela mientras cuentas** (`ordenMetas`):
  si la lista se reacomoda en el mismo toque que completó una, la fila de abajo
  sube al punto que acabas de tocar y el segundo toque le suma a la actividad
  equivocada. Se reacomoda al abrir, al entrar a la pestaña, al cambiar de día,
  al sincronizar y al editar el plan.
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
