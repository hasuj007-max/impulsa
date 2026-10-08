/* Service worker de Impulsa.
   Estrategia:
   - Navegación (el HTML): red primero, caché de respaldo. Así una versión nueva
     llega en cuanto hay internet, y sin internet la app sigue abriendo.
   - Recursos (iconos, manifest): caché primero, con refresco en segundo plano.
   - Otros orígenes (Firebase, Google) y las rutas reservadas de Firebase
     (/__/auth/… del login): ni se tocan, van directo a la red.
   Sube VERSION en cada despliegue para desalojar la caché anterior. */
const VERSION = "impulsa-v37";
// Las dos rutas que SÍ son la app; ninguna otra navegación se guarda como index.html
const RAIZ = new URL("./", self.location).pathname;
const RUTAS_APP = [RAIZ, RAIZ + "index.html"];
const ESENCIALES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./iconos/icon-192.png",
  "./iconos/icon-512.png",
  "./iconos/apple-touch-icon.png"
];

self.addEventListener("install", e=>{
  e.waitUntil(
    caches.open(VERSION)
      // addAll falla entero si un recurso falla; se piden sueltos para que un
      // 404 en un icono no deje la app sin caché
      .then(c => Promise.allSettled(ESENCIALES.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e=>{
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e=>{
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  // Solo archivos de la app. La ventana del login de Google navega a
  // /__/auth/handler en este mismo origen: antes se guardaba como si fuera la
  // app y sin internet Impulsa podía abrir esa página en su lugar.
  if(url.origin !== self.location.origin || url.pathname.startsWith("/__/")) return;

  // El documento: red primero para que las actualizaciones lleguen solas
  if(req.mode === "navigate"){
    e.respondWith(
      // `no-cache` obliga a revalidar contra el servidor: sin esto, la caché
      // HTTP del navegador podía devolver una copia vieja y anular esta
      // estrategia de red-primero sin que se notara.
      fetch(req, { cache: "no-cache" })
        .then(res => {
          if(res.ok && res.type === "basic" && RUTAS_APP.includes(url.pathname)){
            const copia = res.clone();
            caches.open(VERSION).then(c => c.put("./index.html", copia));
          }
          return res;
        })
        .catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // Resto: caché primero, y se actualiza por detrás para la próxima vez
  e.respondWith(
    caches.match(req).then(hit => {
      const red = fetch(req).then(res => {
        if(res && res.status === 200 && res.type === "basic"){
          const copia = res.clone();
          caches.open(VERSION).then(c => c.put(req, copia));
        }
        return res;
      }).catch(() => hit);
      return hit || red;
    })
  );
});
