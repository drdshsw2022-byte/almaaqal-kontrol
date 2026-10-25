/* Al-Maaqal Portal Service Worker — يعمل بدون إنترنت بعد أول فتح */
const VERSION = 'amu-v2.2.0';
const CORE = [
  './',
  './index.html',
  './app.css',
  './offline.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/icon.svg'
];
// مكتبات خارجية تُحفظ عند أول تحميل لتعمل الواجهة أوفلاين
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const SCOPE_PATH = new URL(self.registration.scope).pathname; // مثال: /amu/
// ملفات لا تُحفظ أبداً (كبيرة أو يجب أن تكون حديثة دائماً)
const NEVER_CACHE = /\.(apk|aab|zip|ipa|exe|msi|dmg)$/i;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // طلبات فحص حالة الخدمات وما شابهها تذهب للشبكة مباشرة
  if (req.cache === 'no-store') return;
  const url = new URL(req.url);
  if (NEVER_CACHE.test(url.pathname)) return;

  const sameOrigin = url.origin === location.origin;
  const inScope = sameOrigin && url.pathname.startsWith(SCOPE_PATH);

  // صفحة البوابة نفسها: الشبكة أولاً ثم النسخة المحفوظة
  if (req.mode === 'navigate') {
    const isPortalPage = inScope && (url.pathname === SCOPE_PATH || url.pathname.endsWith('/index.html'));
    if (!isPortalPage) return; // أي صفحة أخرى (منصة الاختبارات مثلاً) لا نتدخل بها
    e.respondWith(
      fetch(req)
        .then((res) => {
          const type = res.headers.get('content-type') || '';
          if (res.ok && type.includes('text/html')) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./offline.html')))
    );
    return;
  }

  // الإعلانات: الأحدث دائماً، والنسخة المحفوظة عند انقطاع الإنترنت فقط
  if (inScope && url.pathname.endsWith('/announcements.json')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }

  // ملفات البوابة والمكتبات: المحفوظ أولاً مع تحديث بالخلفية
  if (inScope || CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const net = fetch(req)
          .then((res) => {
            if (res && (res.ok || res.type === 'opaque')) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || net;
      })
    );
  }
});
