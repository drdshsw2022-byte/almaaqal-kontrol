// جسر Firebase لنظام الكنترول — يستخدم مشروع Firebase نفسه الذي يعمل عليه تطبيق الحضور.
// تُقرأ الإعدادات من firebase-config.js (يولّده سير عمل GitHub من الأسرار).
const V = '10.12.2';
const base = `https://www.gstatic.com/firebasejs/${V}`;

async function start() {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || !cfg.projectId) return null;
  const [appM, authM, fsM] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-firestore.js`),
  ]);
  const app = appM.initializeApp(cfg);
  let db;
  try {
    // ذاكرة محلية دائمة: يعمل النظام دون اتصال ويزامن عند عودة الشبكة
    db = fsM.initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentMultipleTabManager() }),
    });
  } catch (e) {
    db = fsM.getFirestore(app);
  }
  const auth = authM.getAuth(app);
  // initializeApp/deleteApp وcfg: لإنشاء الحسابات المخوّلة بتطبيق ثانوي دون إنهاء جلسة رئيس النظام
  return { app, db, auth, ...authM, ...fsM, projectId: cfg.projectId, cfg, initializeApp: appM.initializeApp, deleteApp: appM.deleteApp };
}

start()
  .then((x) => { window.FBX = x; })
  .catch((e) => { console.error(e); window.FBX = null; window.FBX_ERROR = String(e && e.message || e); })
  .finally(() => { window.FBX_DONE = true; window.dispatchEvent(new Event('fbx-ready')); });
