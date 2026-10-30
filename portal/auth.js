// تسجيل الدخول المشترك للبوابة والمكتبة: Google عبر Firebase Auth (مشروع الكنترول نفسه).
// يتطلب تحميل firebase-config.js وaccess.js قبله.
// الواجهة: AMU_AUTH.onChange(fn) · signIn() · signOut() · state {status, user, allowed}
(function () {
  const FB_V = '10.12.2';
  const listeners = [];
  const state = { status: 'loading', user: null, allowed: false, error: '' };
  let fb = null;

  function emit() { listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } }); }

  function errText(e) {
    const c = (e && e.code) || '';
    if (c === 'auth/unauthorized-domain') return 'هذا النطاق غير مضاف إلى النطاقات المصرّح بها في Firebase.';
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return '';
    if (c === 'auth/network-request-failed') return 'تعذّر الاتصال بالإنترنت. تحقق من الشبكة ثم حاول مجدداً.';
    return 'تعذّر تسجيل الدخول: ' + ((e && e.message) || String(e));
  }

  async function boot() {
    const cfg = window.FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey) { state.status = 'error'; state.error = 'تعذّر تحميل إعدادات تسجيل الدخول. تحقق من الاتصال ثم أعد التحميل.'; emit(); return; }
    try {
      const base = `https://www.gstatic.com/firebasejs/${FB_V}`;
      const [appM, authM] = await Promise.all([import(`${base}/firebase-app.js`), import(`${base}/firebase-auth.js`)]);
      const app = appM.initializeApp(cfg, 'amu-portal');
      const auth = authM.getAuth(app);
      auth.languageCode = 'ar';
      await authM.setPersistence(auth, authM.browserLocalPersistence); // دخول تلقائي في الزيارات القادمة
      fb = { auth, ...authM };
      try { await authM.getRedirectResult(auth); } catch (e) { state.error = errText(e); }
      authM.onAuthStateChanged(auth, (u) => {
        state.user = u || null;
        state.allowed = !!(u && window.AMU_ACCESS && window.AMU_ACCESS.isAllowed(u.email));
        state.status = u ? (state.allowed ? 'in' : 'denied') : 'out';
        emit();
      });
    } catch (e) {
      console.error(e); state.status = 'error'; state.error = 'تعذّر تحميل خدمة تسجيل الدخول. أعد تحميل الصفحة.'; emit();
    }
  }

  window.AMU_AUTH = {
    state,
    onChange(fn) { listeners.push(fn); fn(state); },
    async signIn() {
      if (!fb) return;
      state.error = '';
      const provider = new fb.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await fb.signInWithPopup(fb.auth, provider);
      } catch (e) {
        const c = e && e.code;
        if (c === 'auth/popup-blocked' || c === 'auth/operation-not-supported-in-this-environment') {
          try { await fb.signInWithRedirect(fb.auth, provider); return; } catch (e2) { state.error = errText(e2); }
        } else state.error = errText(e);
        emit();
      }
    },
    async signOut() { if (fb) await fb.signOut(fb.auth); }
  };
  boot();
})();
