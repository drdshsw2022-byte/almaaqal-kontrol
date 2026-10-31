// تسجيل الدخول المشترك للبوابة والكتب الإلكترونية (Firebase Auth لمشروع الكنترول وتطبيق الحضور نفسه).
// يتطلب تحميل firebase-config.js وaccess.js قبله.
// - Google: المدير والبريد الجامعي
// - اسم المستخدم وكلمة المرور: حسابات الأساتذة في تطبيق الحضور (<اسم>@pw.almaaqal.app)
//   كلمة المصادقة مشتقة من كلمة المستخدم بالطريقة نفسها في تطبيق الحضور والكنترول،
//   فتغيير كلمة المرور من البوابة يسري على الأنظمة الثلاثة.
// الواجهة: AMU_AUTH.onChange(fn) · signIn() · signInStaff(user, pass) · changePassword(cur, next) · signOut()
//          state {status: loading|out|in|denied|error, user, allowed, admin, staff, username, error}
(function () {
  const FB_V = '10.12.2';
  const listeners = [];
  const state = { status: 'loading', user: null, allowed: false, admin: false, staff: false, username: '', error: '' };
  let fb = null;

  function emit() { listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } }); }

  async function sha256(s) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  // نفس kpw في الكنترول وتطبيق الحضور: كلمة المرور نفسها لا تُرسل ولا تُخزَّن
  async function kpw(authEmail, pass) { return 'Mq#' + (await sha256(authEmail + '::' + pass)).slice(0, 40); }

  function errText(e) {
    const c = (e && e.code) || '';
    if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return 'اسم المستخدم أو كلمة المرور غير صحيحة. إن كان هذا أول دخول لك فادخل أولاً من تطبيق الحضور لتفعيل حسابك.';
    if (/user-disabled/.test(c)) return 'هذا الحساب معطّل. راجع مدير النظام.';
    if (/too-many-requests/.test(c)) return 'محاولات كثيرة متتالية. انتظر دقيقة ثم أعد المحاولة.';
    if (/requires-recent-login/.test(c)) return 'لأمان حسابك، سجّل الخروج ثم ادخل من جديد قبل تغيير كلمة المرور.';
    if (c === 'auth/unauthorized-domain') return 'هذا النطاق غير مضاف إلى النطاقات المصرّح بها في Firebase.';
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return '';
    if (c === 'auth/network-request-failed') return 'تعذّر الاتصال بالإنترنت. تحقق من الشبكة ثم حاول مجدداً.';
    return (e && e.message) || 'تعذّر تسجيل الدخول.';
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
        const A = window.AMU_ACCESS;
        const email = u && u.email;
        state.user = u || null;
        state.allowed = !!(u && A && A.isAllowed(email));
        state.admin = !!(u && A && A.isAdmin(email));
        state.staff = !!(u && A && A.isStaff(email));
        state.username = state.staff ? String(email).split('@')[0] : '';
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
    displayName(u) {
      u = u || state.user; if (!u) return '';
      if (state.staff) return u.displayName || state.username;
      return u.displayName || u.email || 'مستخدم';
    },
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
    // دخول الأستاذ: اسم المستخدم (مثل doc01) وكلمة المرور
    async signInStaff(user, pass) {
      if (!fb) throw new Error('خدمة الدخول لم تجهز بعد.');
      const local = String(user || '').trim().toLowerCase().split('@')[0];
      if (!local || !pass) throw new Error('أدخل اسم المستخدم وكلمة المرور.');
      if (/^\d{6,}$/.test(local)) throw new Error('حسابات الطلبة تدخل بالبريد الجامعي عبر زر Google.');
      const authEmail = local + '@' + window.AMU_ACCESS.staffDomain;
      if (state.user) { try { await fb.signOut(fb.auth); } catch (e) {} }
      try { await fb.signInWithEmailAndPassword(fb.auth, authEmail, await kpw(authEmail, pass)); }
      catch (e) { throw new Error(errText(e)); }
    },
    // تغيير كلمة مرور الأستاذ (تسري على البوابة والكنترول وتطبيق الحضور)
    async changePassword(cur, next) {
      if (!fb || !state.user || !state.staff) throw new Error('تغيير كلمة المرور لحسابات الأساتذة فقط.');
      next = String(next || '');
      const why = window.AMU_AUTH.isWeakPassword(next, state.username);
      if (why) throw new Error('كلمة المرور الجديدة ضعيفة: ' + why);
      if (next === cur) throw new Error('اختر كلمة مرور مختلفة عن الحالية.');
      const authEmail = state.user.email.toLowerCase();
      try {
        const cred = fb.EmailAuthProvider.credential(authEmail, await kpw(authEmail, cur));
        await fb.reauthenticateWithCredential(state.user, cred);
        await fb.updatePassword(state.user, await kpw(authEmail, next));
      } catch (e) {
        if (/invalid-credential|wrong-password|invalid-login/.test((e && e.code) || '')) throw new Error('كلمة المرور الحالية غير صحيحة.');
        throw new Error(errText(e));
      }
    },
    // سبب ضعف كلمة المرور، أو '' إن كانت مقبولة
    isWeakPassword(p, username) {
      p = String(p || ''); const u = String(username || '').trim().toLowerCase().split('@')[0];
      const common = ['123', '1234', '12345', '123456', '1234567', '12345678', '123456789', '1234567890', 'password', 'admin', 'qwerty', 'almaaqal', 'maaqal', '11111111', '00000000', 'abc123', 'password1'];
      if (p.length < 8) return 'أقل من 8 خانات.';
      if (common.includes(p.toLowerCase())) return 'شائعة جداً.';
      if (u && p.toLowerCase().includes(u)) return 'تحتوي اسم المستخدم.';
      if (!/[A-Za-z\u0600-\u06FF]/.test(p) || !/\d/.test(p)) return 'يجب أن تجمع حروفاً وأرقاماً.';
      if (/^(.)\1+$/.test(p)) return 'حرف واحد مكرر.';
      return '';
    },
    async signOut() { if (fb) await fb.signOut(fb.auth); }
  };
  boot();
})();
