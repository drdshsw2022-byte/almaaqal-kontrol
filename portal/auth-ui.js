// نوافذ الدخول المشتركة للبوابة والمكتبة: Google، أو اسم المستخدم وكلمة المرور للأساتذة، وتغيير كلمة المرور.
// يتطلب access.js وauth.js. الواجهة: AMU_UI.open([mode]) · AMU_UI.account() · AMU_UI.changePassword(forced)
(function () {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const G = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  const css = `
  .au-ov{position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(2,4,10,.62);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);font-family:'Cairo',sans-serif}
  .au-ov.open{display:flex}
  .au-card{width:100%;max-width:430px;border-radius:26px;padding:6px;background:linear-gradient(135deg,#F59E0B,#B45309 55%,#0284C7);box-shadow:0 30px 60px -20px rgba(0,0,0,.6)}
  .au-in{border-radius:21px;background:#fff;color:#0A0F1D;padding:22px 20px;display:flex;flex-direction:column;gap:11px;text-align:center;max-height:calc(100vh - 44px);overflow:auto}
  .dark .au-in{background:#0D1424;color:#F8FAFC}
  .au-in h3{margin:0;font:900 19px 'Cairo',sans-serif}
  .au-in p{margin:0;font-size:12.5px;font-weight:600;line-height:1.9;color:#475569}
  .dark .au-in p{color:#94A3B8}
  .au-x{align-self:flex-start;background:none;border:0;cursor:pointer;color:#94A3B8;font-size:22px;line-height:1;margin:-8px -4px -16px 0}
  .au-g{display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;padding:11px 16px;border-radius:14px;font:800 14px 'Cairo',sans-serif;background:#fff;color:#1F2937;border:1.5px solid #DADCE0;box-shadow:0 6px 20px -8px rgba(0,0,0,.25)}
  .au-g svg{width:20px;height:20px}
  .au-or{display:flex;align-items:center;gap:10px;font-size:11.5px;font-weight:800;color:#94A3B8}
  .au-or::before,.au-or::after{content:'';flex:1;height:1px;background:rgba(148,163,184,.35)}
  .au-f{display:flex;flex-direction:column;gap:8px;text-align:right}
  .au-f label{font-size:11.5px;font-weight:800;color:#64748B}
  .au-f input{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:12px;border:1.5px solid rgba(217,119,6,.4);background:#fff;color:#0A0F1D;font:700 14px 'Cairo',sans-serif;outline:none}
  .dark .au-f input{background:#0B1222;color:#F8FAFC}
  .au-f input:focus{border-color:#D97706;box-shadow:0 0 0 4px rgba(245,158,11,.18)}
  .au-btn{display:flex;align-items:center;justify-content:center;gap:8px;border:0;cursor:pointer;padding:11px 16px;border-radius:14px;font:800 14px 'Cairo',sans-serif;color:#fff;background:linear-gradient(135deg,#F59E0B 0%,#D97706 50%,#B45309 100%);box-shadow:0 4px 18px rgba(217,119,6,.4)}
  .au-btn.soft{background:rgba(245,158,11,.15);color:#92400E;box-shadow:none;border:1px solid rgba(245,158,11,.4)}
  .dark .au-btn.soft{color:#FCD34D}
  .au-btn:disabled,.au-g:disabled{opacity:.6;cursor:progress}
  .au-err{display:none;padding:9px 12px;border-radius:12px;font-size:12.5px;font-weight:700;background:rgba(244,63,94,.12);color:#E11D48;border:1px solid rgba(244,63,94,.35);text-align:right;line-height:1.8}
  .au-ok{display:none;padding:9px 12px;border-radius:12px;font-size:12.5px;font-weight:700;background:rgba(16,185,129,.12);color:#059669;border:1px solid rgba(16,185,129,.35)}
  .au-who{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:rgba(245,158,11,.12);text-align:right}
  .au-who b{display:block;font-size:14px}
  .au-who small{font-size:11.5px;color:#64748B;font-weight:700}
  .au-badge{display:inline-block;margin-top:2px;padding:1px 8px;border-radius:999px;font-size:10.5px;font-weight:800;background:#0C1224;color:#FDE047}
  .au-av{width:40px;height:40px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#F59E0B,#B45309);color:#fff;font-weight:900;object-fit:cover}
  bdi{unicode-bidi:isolate}`;

  let ov, box, mode = 'login';
  function mount() {
    if (ov) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    ov = document.createElement('div'); ov.className = 'au-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="au-card"><div class="au-in" id="auBox"></div></div>';
    document.body.appendChild(ov);
    box = ov.querySelector('#auBox');
    ov.addEventListener('click', (e) => { if (e.target === ov && mode !== 'forced') close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ov.classList.contains('open') && mode !== 'forced') close(); });
  }
  function close() { if (ov && ov.classList.contains('open')) { ov.classList.remove('open'); window.dispatchEvent(new Event('amu-ui-close')); } }
  function showErr(msg) { const e = box.querySelector('.au-err'); if (!e) return; e.textContent = msg || ''; e.style.display = msg ? 'block' : 'none'; }
  const X = '<button type="button" class="au-x" data-au="close" aria-label="إغلاق">×</button>';

  function renderLogin() {
    const st = AMU_AUTH.state;
    const denied = st.status === 'denied';
    box.innerHTML = `${X}
      <h3>${denied ? 'هذا الحساب غير مخوَّل' : 'تسجيل الدخول'}</h3>
      <p>${denied
        ? `الحساب <bdi dir="ltr">${esc(st.user && st.user.email || '')}</bdi> غير مخوَّل. الطلبة والموظفون بالبريد الجامعي (<bdi dir="ltr">almaaqal.edu.iq</bdi>)، والأساتذة باسم المستخدم وكلمة المرور.`
        : 'الطلبة والموظفون بالبريد الجامعي (<bdi dir="ltr">almaaqal.edu.iq</bdi>). الأساتذة باسم المستخدم وكلمة المرور المسلَّمة لهم. يبقى الدخول محفوظاً على جهازك.'}</p>
      <button type="button" class="au-g" data-au="google">${G}<span>الدخول بالبريد الجامعي (Google)</span></button>
      <div class="au-or">أو دخول الأساتذة</div>
      <form class="au-f" data-au="staff" autocomplete="on">
        <label for="auUser">اسم المستخدم</label>
        <input id="auUser" name="username" dir="ltr" autocomplete="username" placeholder="doc01" required>
        <label for="auPass">كلمة المرور</label>
        <input id="auPass" name="password" type="password" dir="ltr" autocomplete="current-password" required>
        <button type="submit" class="au-btn">دخول الأستاذ</button>
      </form>
      <div class="au-err"></div>`;
    showErr(st.error || '');
  }

  function renderAccount() {
    const st = AMU_AUTH.state; const u = st.user || {};
    const name = AMU_AUTH.displayName();
    const av = u.photoURL ? `<img class="au-av" src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">` : `<span class="au-av">${esc(name.trim().charAt(0) || 'م')}</span>`;
    const role = !st.allowed ? 'غير مخوَّل' : st.admin ? 'مدير النظام · صلاحية كاملة' : st.staff ? 'أستاذ' : 'حساب جامعي';
    box.innerHTML = `${X}
      <h3>حسابي</h3>
      <div class="au-who">${av}<div><b>${esc(name)}</b><small><bdi dir="ltr">${esc(st.staff ? st.username : (u.email || ''))}</bdi></small><br><span class="au-badge">${role}</span></div></div>
      ${st.staff ? '<button type="button" class="au-btn soft" data-au="pw">تغيير كلمة المرور</button>' : ''}
      <button type="button" class="au-btn" data-au="out">تسجيل الخروج</button>
      <div class="au-err"></div>`;
  }

  function renderPw(forced) {
    box.innerHTML = `${forced ? '' : X}
      <h3>${forced ? 'غيّر كلمة المرور الأولية' : 'تغيير كلمة المرور'}</h3>
      <p>${forced ? 'هذا أول دخول لك من البوابة. اختر كلمة مرور جديدة خاصة بك.' : ''} كلمة المرور الجديدة تسري على البوابة والمكتبة ونظام الكنترول وتطبيق الحضور.</p>
      <form class="au-f" data-au="pwform">
        <label for="auCur">كلمة المرور الحالية</label>
        <input id="auCur" type="password" dir="ltr" autocomplete="current-password" required>
        <label for="auNew">كلمة المرور الجديدة (6 أحرف على الأقل)</label>
        <input id="auNew" type="password" dir="ltr" autocomplete="new-password" minlength="6" required>
        <label for="auNew2">تأكيد كلمة المرور الجديدة</label>
        <input id="auNew2" type="password" dir="ltr" autocomplete="new-password" minlength="6" required>
        <button type="submit" class="au-btn">حفظ كلمة المرور</button>
      </form>
      ${forced ? '<button type="button" class="au-btn soft" data-au="later">لاحقاً</button>' : ''}
      <div class="au-err"></div><div class="au-ok"></div>`;
  }

  function open(m) {
    mount(); mode = m || 'login';
    if (mode === 'account') renderAccount();
    else if (mode === 'pw' || mode === 'forced') renderPw(mode === 'forced');
    else renderLogin();
    ov.classList.add('open');
    const f = box.querySelector('input'); if (f && mode !== 'login') setTimeout(() => f.focus(), 60);
  }

  // تذكير بتغيير كلمة المرور عند أول دخول للأستاذ من هذا الجهاز
  const FLAG = (u) => 'amu_pw_ok_' + u;
  function pwDone(u) { try { localStorage.setItem(FLAG(u), '1'); } catch (e) {} }
  function pwKnown(u) { try { return localStorage.getItem(FLAG(u)) === '1'; } catch (e) { return true; } }

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-au]'); if (!t || !box || !box.contains(t)) return;
    const a = t.dataset.au;
    if (a === 'close') close();
    else if (a === 'google') {
      t.disabled = true; showErr('');
      try { if (AMU_AUTH.state.status === 'denied') await AMU_AUTH.signOut(); await AMU_AUTH.signIn(); }
      finally { t.disabled = false; if (AMU_AUTH.state.error) showErr(AMU_AUTH.state.error); }
      if (AMU_AUTH.state.status === 'in') close();
      else if (AMU_AUTH.state.status === 'denied') renderLogin();
    }
    else if (a === 'out') { await AMU_AUTH.signOut(); close(); }
    else if (a === 'pw') open('pw');
    else if (a === 'later') { pwDone(AMU_AUTH.state.username); close(); }
  });
  document.addEventListener('submit', async (e) => {
    const f = e.target; if (!box || !box.contains(f)) return;
    e.preventDefault();
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true; showErr('');
    try {
      if (f.dataset.au === 'staff') {
        const user = f.querySelector('#auUser').value, pass = f.querySelector('#auPass').value;
        await AMU_AUTH.signInStaff(user, pass);
        const un = AMU_AUTH.state.username;
        if (un && !pwKnown(un)) open('forced'); else close();
      } else if (f.dataset.au === 'pwform') {
        const cur = f.querySelector('#auCur').value, n1 = f.querySelector('#auNew').value, n2 = f.querySelector('#auNew2').value;
        if (n1 !== n2) throw new Error('تأكيد كلمة المرور لا يطابق الجديدة.');
        await AMU_AUTH.changePassword(cur, n1);
        pwDone(AMU_AUTH.state.username);
        const ok = box.querySelector('.au-ok'); ok.textContent = 'تم تغيير كلمة المرور.'; ok.style.display = 'block';
        f.style.display = 'none'; const later = box.querySelector('[data-au=later]'); if (later) later.remove();
        mode = 'pw'; setTimeout(close, 1400);
      }
    } catch (err) { showErr(err.message || String(err)); }
    finally { btn.disabled = false; }
  });

  AMU_AUTH.onChange((st) => { if (st.status === 'in' && mode === 'login' && !st.staff && ov && ov.classList.contains('open')) close(); });
  window.AMU_UI = { open, close, account: () => open('account'), changePassword: (forced) => open(forced ? 'forced' : 'pw'), isOpen: () => !!(ov && ov.classList.contains('open')), mode: () => mode };
})();
