/* Service Worker: يعمل النظام دون اتصال بعد أول زيارة */
const CACHE = 'amu-lms-v9';
const SHELL = ['./', './index.html', './config.js', './manifest.webmanifest', './data.json'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // خادم الرفع لا يُحفظ أبداً
  if (url.pathname.endsWith('/upload.php')) return;
  // البيانات وقائمة ملفات الأساتذة: الشبكة أولاً ثم النسخة المحفوظة
  if (url.pathname.endsWith('data.json') || url.pathname.endsWith('/uploads/feed.json') || req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
    if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return res;
  })));
});
