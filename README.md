# Impulsa

App de un solo archivo para llevar el día a día de prospección en redes de mercadeo.

**En vivo:** https://hasuj007-max.github.io/impulsa/

## Qué hace

- **Hoy** — contadores de metas diarias, racha, seguimientos del día con reprogramación en un toque, y agenda personal (mandados, citas) separada del negocio.
- **Prospectos** — ficha con etapa, contacto directo a WhatsApp/Instagram/Messenger, historial de contactos, plantillas de mensajes personalizadas y filtro de prospectos enfriados.
- **Métricas** — metas logradas por día con semáforo, meta mensual con proyección de cierre, **ley de promedios** (embudo real contando descartados) y conversión por origen.
- **Ajustes** — metas diarias, meta del mes, plantillas y respaldo.

## Datos

Todo vive en el `localStorage` del navegador. No hay servidor ni cuenta.

- Los respaldos se descargan en JSON desde Ajustes y se restauran ahí mismo.
- Los prospectos se exportan a CSV para abrirlos en Excel o Sheets.
- Instalada en la pantalla de inicio, iOS deja de aplicar el borrado de datos a los 7 días de inactividad.

## Instalar en el teléfono

- **iPhone:** abrir en Safari → Compartir → *Añadir a pantalla de inicio*.
- **Android:** abrir en Chrome → menú → *Instalar aplicación*.

## Desarrollo

Todo el código está en `index.html` (HTML, CSS y JS en un archivo, sin dependencias).

```bash
python3 -m http.server 8791
```

El service worker requiere `http://localhost` o `https://`; con `file://` la app funciona pero sin modo offline ni instalación.

Al desplegar un cambio, subir `VERSION` en `sw.js` para desalojar la caché anterior.
