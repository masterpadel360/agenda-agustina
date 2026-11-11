// Service worker: la app abre sin internet (lo último guardado) y recibe los avisos push.
// Cambiar VERSION en cada cambio publicado.
const VERSION = 'agustina-v6';
const FUENTES = 'agustina-fuentes';
const ARCHIVOS = ['./', 'index.html', 'reservar.html', 'config.js', 'css/app.css', 'js/panel.js', 'js/reservar.js', 'js/logica.js', 'js/ui.js', 'js/sprite.js',
  'js/datos.js', 'js/datos-demo.js', 'js/datos-supabase.js', 'js/imagen-recordatorio.js', 'manifest.json', 'logo/logo.svg', 'logo/icono.svg',
  'iconos/icono-180.png', 'iconos/icono-192.png', 'iconos/icono-512.png', 'recordatorio/plantilla-recordatorio.jpeg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== FUENTES).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Primero la red (para recibir cambios); sin conexión, lo guardado. Supabase nunca se guarda.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FUENTES).then((c) => c.match(e.request).then((r) => r || fetch(e.request).then((res) => {
      if (res.ok || res.type === 'opaque') c.put(e.request, res.clone());
      return res;
    }))));
    return;
  }
  if (u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
// Aviso push: { title, body, tag, url } (url = "#turno/12", "#recordar/12", "#hoy"...)
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Mi agenda', {
    body: d.body || '', tag: d.tag || 'agenda', icon: 'iconos/icono-192.png', badge: 'iconos/icono-192.png', data: { url: d.url || '#hoy' },
  }));
});
// Tocar el aviso abre la app en la pantalla que corresponde.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '#hoy';
  const destino = new URL('index.html' + (url.startsWith('#') ? url : '#hoy'), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => x.url.includes('index.html') || x.url.endsWith('/'));
    if (c) { c.postMessage({ ir: url }); return c.focus(); }
    return self.clients.openWindow(destino);
  }));
});
