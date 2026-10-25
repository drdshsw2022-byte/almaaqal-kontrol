// عامل الخدمة: يتيح تثبيت الكنترول كتطبيق وفتحه دون اتصال.
// الشبكة أولاً لملفات التطبيق (فتظهر التحديثات فوراً)، والنسخة المخزنة عند انقطاع الاتصال.
const CACHE = 'kontrol-v1';
const SHELL = ['./', './index.html', './app.css', './app.js', './fb.js', './firebase-config.js', './manifest.webmanifest', './icon.svg', './crest.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const lib = /(gstatic\.com\/firebasejs|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com)/.test(req.url);
  if (!sameOrigin && !lib) return; // طلبات Firestore والمصادقة تمر مباشرة
  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});
