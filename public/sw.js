/* Service worker de Impulsa.
   Estrategia:
   - Navegación (el HTML): red primero, caché de respaldo. Así una versión nueva
     llega en cuanto hay internet, y sin internet la app sigue abriendo.
   - Recursos (iconos, manifest): caché primero, con refresco en segundo plano.
   Sube VERSION en cada despliegue para desalojar la caché anterior. */
const VERSION = "impulsa-v10";
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

  // El documento: red primero para que las actualizaciones lleguen solas
  if(req.mode === "navigate"){
    e.respondWith(
      fetch(req)
        .then(res => {
          const copia = res.clone();
          caches.open(VERSION).then(c => c.put("./index.html", copia));
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
