/* ============================================================================
   تصاريح الدخول إلى نظام الكنترول وطلبات الانضمام — جامعة المعقل الدولية
   ----------------------------------------------------------------------------
   من يدخل النظام:
   1) مدير النظام (الحساب العام) والإدارة العليا: رؤساء لجنة تلقائياً.
   2) الحسابات المخوّلة: حسابات خاصة بالكنترول باسم مستخدم وكلمة مرور
      (<اسم>@k.almaaqal.app) لها رتبة: رئيس النظام ومعاونه، رئيس المشرفين ومعاونه،
      رئيس الأساتذة ومعاونه. ينشئها رئيس النظام من صفحة «تصاريح الدخول»،
      وتُربط بمعرّف الحساب (uid) فلا ينتحلها حساب آخر.
   3) المشرفون والأساتذة: يدخلون بحساب Google فيُسجَّل لهم «طلب انضمام»،
      ويصل إشعار للمدير ولرئيس الفئة، ولا يدخلون حتى يُقبل الطلب.
   التصريح في k_roles/<الهوية>، والطلبات في k_requests/<البريد>.
   قواعد Firestore تفرض كل ذلك على الخادم (انظر firestore.rules).
   يُحمَّل قبل app.js، وتُثبَّت الصفحة والإجراءات بـ kpInstall() عند تشغيله.
   ============================================================================ */
const KDOM = '@k.almaaqal.app';
const KRANKS = { g1: 'رئيس النظام', g2: 'معاون رئيس النظام', m1: 'رئيس المشرفين', m2: 'معاون رئيس المشرفين', d1: 'رئيس الأساتذة', d2: 'معاون رئيس الأساتذة' };
const RANK_ROLE = { g1: 'chair', g2: 'chair', m1: 'member', m2: 'member', d1: 'member', d2: 'member' };
const KRANK_CAT = { m1: 'sup', m2: 'sup', d1: 'prof', d2: 'prof' };
// الفئتان اللتان تُمنحان بطلب انضمام: المشرف مراقب قاعات، والأستاذ مدقق درجات
const KCAT = {
  sup: { l: 'مشرف', pl: 'المشرفون', role: 'invigilator', what: 'مراقبة القاعات: الحضور والغياب، أظرف الأسئلة، محاضر الغش' },
  prof: { l: 'أستاذ', pl: 'الأساتذة', role: 'auditor', what: 'رصد الدرجات وتدقيقها (الإدخال الثاني) والاعتراضات' },
};
let KRANK = '', KGRANT = '';
const KFORMS = {};

/* كلمة المصادقة المشتقة (نفس طريقة تطبيق الحضور): كلمة المرور نفسها لا تُرسل ولا تُخزَّن */
async function kpw(authEmail, pass) { return 'Mq#' + (await sha256(authEmail + '::' + pass)).slice(0, 40); }
const kdate = (ts) => (ts ? new Date(ts).toLocaleDateString('ar-IQ-u-nu-latn') : '—');
const kIsLive = (r) => !r.off && !(r.until && r.until < Date.now());
const kWho = (id) => { const p = S.staff && S.staff.get(id); const r = RAW.kroles.get(id); return (p && p.name) || (r && r.name) || id; };

/* ---------- الشاشة العامة عند تعذر الاتصال (النسخة المنشورة لا تعمل محلياً) ---------- */
function showDown(err) {
  showLogin(true, 'تعذر الاتصال بقاعدة بيانات الكنترول' + (err ? ' (' + err + ')' : '') + '. تحقق من الإنترنت ثم أعد المحاولة. لا يعمل النظام دون تسجيل دخول.');
  ['#lg_user', '#lg_pass', '#lg_btn'].forEach((x) => { $(x).closest('label,button').hidden = true; });
  $('#lg_google').hidden = true; $('#lg_retry').hidden = false;
}

/* ---------- طلب الانضمام (حساب Google أو أستاذ من تطبيق الحضور بلا تصريح) ---------- */
let JOIN = null;
function joinStop() { if (JOIN) { JOIN.uns.forEach((u) => { try { u(); } catch (e) {} }); JOIN = null; } }
function joinFlow(u, email, prof) {
  joinStop();
  JOIN = { u, email, name: (prof && prof.name) || u.displayName || '', photo: u.photoURL || '', req: undefined, uns: [] };
  MODE = 'auth'; renderNav(); $('#main').innerHTML = '';
  $('#login').hidden = false; $('#loginform').hidden = true; $('#joinbox').hidden = false;
  joinRender();
  // يدخل تلقائياً لحظة قبول الطلب
  JOIN.uns.push(FB.onSnapshot(FB.doc(FB.db, 'k_roles', email), (d) => {
    if (d.exists()) { joinStop(); afterLogin(u).catch((e) => showLogin(true, errMsg(e))); }
  }, () => {}));
  JOIN.uns.push(FB.onSnapshot(FB.doc(FB.db, 'k_requests', email), (d) => {
    if (!JOIN) return; JOIN.req = d.exists() ? d.data() : null; joinRender();
  }, () => { if (JOIN) { JOIN.req = null; joinRender(); } }));
}
function joinRender() {
  const J = $('#joinbox'); if (!J || !JOIN) return; const r = JOIN.req;
  const head = `<span class="tag t2">ACCESS REQUEST</span><h3>طلب الانضمام إلى الكنترول</h3>
    <p class="mut" style="margin:0">دخلت بحساب <b dir="ltr">${esc(JOIN.email)}</b>. هذا الحساب لا يملك تصريح دخول بعد.</p>`;
  const out = `<button class="btn" type="button" data-kjoin="out">الخروج</button>`;
  if (r === undefined) { J.innerHTML = head + '<p class="mut">جارٍ التحقق من طلبك…</p>'; return; }
  if (r && r.status === 'pending') {
    J.innerHTML = head + `<div class="note" style="margin:0"><b>طلبك قيد المراجعة</b> منذ ${esc(fmtTs(r.at))} — بصفة <b>${esc((KCAT[r.cat] || {}).l || r.cat)}</b>.<br>وصل إشعار إلى مدير النظام ورئيس ${esc((KCAT[r.cat] || {}).pl || '')}. ستدخل تلقائياً لحظة الموافقة، ويمكنك ترك هذه الصفحة مفتوحة أو العودة لاحقاً.</div>
      <div class="row">${out}<button class="btn" type="button" data-kjoin="cancel">سحب الطلب</button></div><p class="red ferr" style="margin:0"></p>`;
    return;
  }
  const rej = r && r.status === 'rejected';
  J.innerHTML = head + (rej ? `<div class="note" style="margin:0;border-color:var(--bad)"><b>رُفض طلبك السابق</b>${r.decidedAt ? ' في ' + esc(kdate(r.decidedAt)) : ''}. يمكنك تقديم طلب جديد إن كان هناك خطأ.</div>` : '') +
    `<form data-form="kjoin" style="display:flex;flex-direction:column;gap:10px">
      <label class="f">الاسم الكامل *<input name="name" required maxlength="80" value="${esc(JOIN.name)}"></label>
      <fieldset class="f" style="border:0;padding:0;margin:0"><legend style="margin-bottom:6px">أطلب الانضمام بصفة *</legend>
        ${Object.entries(KCAT).map(([k, c], i) => `<label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px"><input type="radio" name="cat" value="${k}" ${i ? '' : 'checked'} style="width:auto;margin-top:4px"><span><b>${c.l}</b><br><small class="mut">${c.what}</small></span></label>`).join('')}
      </fieldset>
      <label class="f">القسم / الصفة الوظيفية<input name="note" maxlength="160" placeholder="مثال: قسم الأمن السيبراني — تدريسي"></label>
      <div class="row"><button class="btn pri" type="submit">إرسال الطلب</button>${out}</div>
      <p class="red ferr" style="margin:0"></p></form>`;
}
KFORMS.kjoin = async (f) => {
  if (!JOIN) return;
  const name = f.elements.name.value.trim(); const cat = (f.querySelector('input[name=cat]:checked') || {}).value;
  if (!name || !KCAT[cat]) throw new Error('أكمل الاسم واختر الصفة.');
  const ref = FB.doc(FB.db, 'k_requests', JOIN.email);
  if (JOIN.req && JOIN.req.status === 'rejected') await FB.deleteDoc(ref);
  await FB.setDoc(ref, { email: JOIN.email, name, photo: JOIN.photo, cat, note: f.elements.note.value.trim(), at: Date.now(), status: 'pending' });
};
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-kjoin]'); if (!b) return; e.preventDefault();
  if (b.dataset.kjoin === 'out') { joinStop(); FB.signOut(FB.auth).catch(() => {}); return; }
  if (b.dataset.kjoin === 'cancel' && JOIN) FB.deleteDoc(FB.doc(FB.db, 'k_requests', JOIN.email)).catch((err) => { const el = $('#joinbox .ferr'); if (el) el.textContent = errMsg(err); });
});

/* ---------- إشعارات طلبات الانضمام (للمدير ورؤساء الفئات) ---------- */
let KREQ_READY = false;
function kreqSubscribe() {
  KREQ_READY = false;
  UNSUB.push(FB.onSnapshot(FB.collection(FB.db, 'k_requests'), (snap) => {
    const fresh = [];
    snap.docChanges().forEach((ch) => {
      if (ch.type === 'removed') { RAW.kreq.delete(ch.doc.id); return; }
      const v = { ...ch.doc.data(), id: ch.doc.id }; RAW.kreq.set(ch.doc.id, v);
      if (KREQ_READY && ch.type === 'added' && v.status === 'pending' && kreqMine(v)) fresh.push(v);
    });
    if (!KREQ_READY) { KREQ_READY = true; const n = kreqPending().length; if (n) toast(`${n} طلب انضمام ينتظر موافقتك — صفحة «تصاريح الدخول».`); }
    fresh.forEach((v) => {
      toast(`طلب انضمام جديد: ${v.name} (${(KCAT[v.cat] || {}).l || v.cat})`);
      try { if ('Notification' in window && Notification.permission === 'granted') new Notification('طلب انضمام إلى الكنترول', { body: `${v.name} — ${(KCAT[v.cat] || {}).l || ''}\n${v.email}`, icon: 'crest.svg', tag: 'kreq-' + v.id }); } catch (e) {}
    });
    sched();
  }, (err) => console.warn('k_requests', err)));
}
const kreqMine = (r) => can('chair') || (KGRANT && r.cat === KGRANT);
function kreqPending() { return MODE === 'fb' ? [...RAW.kreq.values()].filter((r) => r.status === 'pending' && kreqMine(r)).sort((a, b) => a.at - b.at) : []; }

/* ---------- الكتابة ---------- */
async function kWrite(id, data) { await settle(FB.setDoc(FB.doc(FB.db, 'k_roles', id), { ...data, by: ME, at: Date.now() })); }
async function kPatch(id, data) { await settle(FB.updateDoc(FB.doc(FB.db, 'k_roles', id), { ...data, by: ME })); }
async function kSetUntil(id, v) {
  const until = v ? new Date(v + 'T23:59:59').getTime() : 0;
  await kPatch(id, { until }); await log('تصاريح الدخول', `${kWho(id)} — ${until ? 'ينتهي التصريح في ' + kdate(until) : 'تصريح دائم'}`); toast('حُفظ تاريخ الانتهاء');
}
function kCanEdit(r) { // هل يملك المستخدم الحالي تعديل هذا التصريح؟ (مرآة لقواعد الخادم)
  if (!r || r.id === ME) return false;
  if (can('chair')) return r.rank !== 'g1' || IS_TOP || KRANK === 'g1';
  return !!KGRANT && r.cat === KGRANT && r.rank === KGRANT;
}

/* ---------- الصفحة ---------- */
function kpView() {
  if (MODE !== 'fb') return ph('تصاريح الدخول', '') + empty('تعمل عند الربط بقاعدة Firebase', '');
  const chair = can('chair'); const cat = KGRANT;
  const all = [...RAW.kroles.entries()].map(([id, v]) => ({ ...v, id }));
  const heads = all.filter((r) => KRANKS[r.rank]).sort((a, b) => Object.keys(KRANKS).indexOf(a.rank) - Object.keys(KRANKS).indexOf(b.rank));
  const permits = all.filter((r) => !KRANKS[r.rank] && (chair || r.cat === cat)).sort((a, b) => (b.at || 0) - (a.at || 0));
  const reqs = kreqPending();
  const st = (r) => r.off ? '<span class="pill bad">موقوف</span>' : r.until && r.until < Date.now() ? '<span class="pill warn">منتهٍ</span>' : '<span class="pill ok">فعّال</span>';
  const roleL = (r) => KRANKS[r.rank] || (KCAT[r.cat] ? KCAT[r.cat].l : '') || KROLES[r.role] || r.role;
  const actions = (r) => kCanEdit(r) ? `<button class="btn sm" data-act="ktoggle" data-id="${esc(r.id)}">${r.off ? 'تفعيل' : 'إيقاف'}</button><button class="btn sm bad" data-act="krevoke" data-id="${esc(r.id)}">سحب التصريح</button>` : '<span class="mut">—</span>';
  const untilIn = (r) => kCanEdit(r) ? `<input type="date" data-kuntil="${esc(r.id)}" value="${r.until ? new Date(r.until).toISOString().slice(0, 10) : ''}" title="اتركه فارغاً لتصريح دائم" style="width:150px">` : esc(r.until ? kdate(r.until) : 'دائم');
  const sub = chair
    ? 'من يدخل الكنترول ومن يمنح التصاريح. المشرفون والأساتذة يطلبون الانضمام بحساب Google ويصلك إشعار بالطلب. كل تعديل يُسجَّل في سجل التدقيق، وقواعد Firestore تفرض هذه الحدود على الخادم.'
    : `أنت ${KRANKS[KRANK]}: تقبل طلبات انضمام ${KCAT[cat].pl} وتمنح تصاريحهم وتسحبها. يُسجَّل كل تعديل في سجل التدقيق.`;
  const kpis = [[reqs.length, 'طلب ينتظر الموافقة', reqs.length ? 'am' : ''], [heads.filter(kIsLive).length, 'حساباً مخوّلاً فعّالاً', ''],
    [all.filter((r) => r.cat === 'sup' && kIsLive(r)).length, 'مشرفاً مصرّحاً له', ''], [all.filter((r) => r.cat === 'prof' && kIsLive(r)).length, 'أستاذاً مصرّحاً له', '']];
  const notif = ('Notification' in window) && Notification.permission !== 'granted'
    ? `<button class="btn sm" data-act="knotify">تفعيل إشعارات المتصفح</button>` : '';
  return ph('تصاريح الدخول', sub, notif) +
    `<div class="grid g4" style="margin-bottom:14px">${kpis.map(([n, l, c]) => `<div class="card kpi"><b class="${c}">${n}</b><span>${l}</span></div>`).join('')}</div>` +
    // ١) الطلبات
    `<div class="card" style="margin-bottom:14px"><h3>طلبات الانضمام</h3>${reqs.length ? `<div class="tw"><table><thead><tr><th>مقدّم الطلب</th><th>الصفة المطلوبة</th><th>القسم / الملاحظة</th><th>تاريخ الطلب</th><th>${chair ? 'يُقبل بصفة' : ''}</th><th>ينتهي في (اختياري)</th><th></th></tr></thead><tbody>${reqs.map((r) => `<tr>
      <td><b>${esc(r.name)}</b><div class="mut mono" style="font-size:12px" dir="ltr">${esc(r.email)}</div></td>
      <td>${esc((KCAT[r.cat] || {}).l || r.cat)}</td><td>${esc(r.note || '—')}</td><td>${esc(fmtTs(r.at))}</td>
      <td>${chair ? `<select id="kq_role_${esc(r.id)}">${Object.entries(KCAT).map(([k, c]) => opt('cat:' + k, c.l + ' — ' + KROLES[c.role], 'cat:' + r.cat)).join('')}${['member', 'viewer', 'chair'].map((k) => opt('role:' + k, KROLES[k], '')).join('')}</select>` : ''}</td>
      <td><input type="date" id="kq_until_${esc(r.id)}" style="width:150px"></td>
      <td style="white-space:nowrap"><button class="btn sm pri" data-act="kapprove" data-id="${esc(r.id)}">قبول</button><button class="btn sm bad" data-act="kreject" data-id="${esc(r.id)}">رفض</button></td></tr>`).join('')}</tbody></table></div>`
      : `<p class="mut" style="margin:0">لا توجد طلبات معلقة. يُنشأ الطلب حين يدخل ${chair ? 'مشرف أو أستاذ' : KCAT[cat].l} بحساب Google لأول مرة من صفحة الدخول.</p>`}</div>` +
    // ٢) الحسابات المخوّلة
    (chair ? `<div class="card" style="margin-bottom:14px"><div class="row" style="justify-content:space-between"><h3 style="margin:0">الحسابات المخوّلة</h3><button class="btn pri sm" data-act="knewacct">إنشاء حساب مخوّل</button></div>
      <p class="mut">حسابات خاصة بالكنترول تدخل باسم المستخدم وكلمة المرور. رئيس النظام ومعاونه رؤساء لجنة. رؤساء المشرفين والأساتذة ومعاونوهم أعضاء كنترول، ويقبلون طلبات فئتهم ويمنحون تصاريحها.</p>
      ${heads.length ? `<div class="tw"><table><thead><tr><th>الرتبة</th><th>اسم المستخدم</th><th>الاسم</th><th>الحالة</th><th>أُنشئ / عُدّل</th><th>ينتهي في</th><th></th></tr></thead><tbody>${heads.map((r) => `<tr>
        <td><b>${esc(KRANKS[r.rank])}</b><div class="mut" style="font-size:12px">${esc(KROLES[r.role] || '')}</div></td><td class="mono" dir="ltr">${esc(r.user || r.id.replace(KDOM, ''))}</td><td>${esc(r.name || '—')}</td>
        <td>${st(r)}</td><td>${esc(kdate(r.at))}<div class="mut" style="font-size:12px">${esc(kWho(r.by))}</div></td><td>${untilIn(r)}</td><td style="white-space:nowrap">${actions(r)}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="empty"><b>لم يُنشأ أي حساب مخوّل بعد</b>أنشئ حسابات الرتب الست (رئيس النظام ومعاونه، رئيس المشرفين ومعاونه، رئيس الأساتذة ومعاونه) من زر «إنشاء حساب مخوّل».</div>`}</div>` : '') +
    // ٣) المصرّح لهم
    `<div class="card" style="margin-bottom:14px"><h3>${chair ? 'المصرّح لهم' : KCAT[cat].pl + ' المصرّح لهم'}</h3>${permits.length ? `<div class="tw"><table><thead><tr><th>الاسم</th><th>الصفة</th><th>الحالة</th><th>منحه</th><th>ينتهي في</th><th></th></tr></thead><tbody>${permits.map((r) => `<tr>
      <td><b>${esc(kWho(r.id))}</b><div class="mut mono" style="font-size:12px" dir="ltr">${esc(r.id)}</div></td><td>${esc(roleL(r))}<div class="mut" style="font-size:12px">${esc(KROLES[r.role] || '')}</div></td>
      <td>${st(r)}</td><td>${esc(kWho(r.by))}<div class="mut" style="font-size:12px">${esc(kdate(r.at))}</div></td><td>${untilIn(r)}</td><td style="white-space:nowrap">${actions(r)}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="mut" style="margin:0">لا أحد بعد.</p>'}</div>` +
    // ٤) منح مباشر لعضو من كادر تطبيق الحضور
    (chair ? kpStaffGrant(all) : '') +
    `<div class="note"><b>كيف يعمل الدخول:</b> المخوّلون يدخلون باسم المستخدم وكلمة المرور. المشرف والأستاذ يضغط «الدخول بحساب Google» فيُطلب منه اختيار صفته ويُرسل الطلب، ولا يرى أي بيانات حتى يُقبل. <b>المشرف</b> = مراقب: ${esc(KCAT.sup.what)}. <b>الأستاذ</b> = مدقق درجات: ${esc(KCAT.prof.what)}. الإيقاف يمنع الدخول فوراً دون حذف التصريح، وتاريخ الانتهاء يوقفه تلقائياً بعد ذلك اليوم.</div>`;
}
function kpStaffGrant(all) {
  const has = new Set(all.map((r) => r.id));
  const st = arr('staff').filter((p) => !has.has(p.id) && !SUPER_ADMINS.includes(p.id) && !['admin', 'president'].includes(p.role)).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'));
  return `<form class="card" data-form="kgrant" style="margin-bottom:14px"><h3>منح تصريح لعضو من كادر تطبيق الحضور</h3>
    <p class="mut" style="margin-top:0">يدخل بحسابه في تطبيق الحضور نفسه (مثل doc01) دون طلب انضمام.</p>
    <div class="fgrid"><label class="f">العضو<select name="who" required>${opt('', '— اختر —', '')}${st.map((p) => opt(p.id, p.name, '')).join('')}</select></label>
    <label class="f">الصفة<select name="as">${Object.entries(KCAT).map(([k, c]) => opt('cat:' + k, c.l + ' — ' + KROLES[c.role], '')).join('')}${['member', 'viewer', 'chair'].map((k) => opt('role:' + k, KROLES[k], '')).join('')}</select></label>
    <label class="f">ينتهي في (اختياري)<input type="date" name="until"></label></div>
    <div class="row" style="margin-top:10px"><button class="btn pri" type="submit">منح التصريح</button></div><p class="red ferr" style="margin:0"></p></form>`;
}
// "cat:sup" ← مشرف، "role:member" ← دور مباشر (لرئيس اللجنة فقط)
function kAs(v) {
  const [k, x] = String(v || '').split(':');
  if (k === 'cat' && KCAT[x]) return { role: KCAT[x].role, rank: x, cat: x };
  if (k === 'role' && KROLES[x]) return { role: x, rank: 'staff', cat: 'staff' };
  throw new Error('اختر الصفة.');
}
const kUntil = (v) => (v ? new Date(v + 'T23:59:59').getTime() : 0);

KFORMS.kgrant = async (f) => {
  const id = f.elements.who.value; if (!id) throw new Error('اختر العضو.');
  const a = kAs(f.elements.as.value); const p = S.staff.get(id);
  await kWrite(id, { ...a, name: (p && p.name) || id, until: kUntil(f.elements.until.value) });
  await log('تصاريح الدخول', `منح ${(p && p.name) || id} صفة ${KCAT[a.cat] ? KCAT[a.cat].l : KROLES[a.role]}`);
  toast('مُنح التصريح'); render();
};

/* ---------- إنشاء حساب مخوّل ---------- */
function kNewAcct() {
  if (!can('chair')) throw new Error('إنشاء الحسابات المخوّلة لرئيس النظام.');
  const ranks = Object.entries(KRANKS).filter(([k]) => k !== 'g1' || IS_TOP || KRANK === 'g1');
  $('#modal').innerHTML = `<form class="dlg" data-form="kacct"><h3>إنشاء حساب مخوّل</h3>
    <p class="mut" style="margin-top:0">حساب خاص بالكنترول يدخل باسم المستخدم وكلمة المرور من صفحة الدخول. كلمة المرور لا تُحفظ في النظام ولا تظهر لأحد؛ يُنصح صاحب الحساب بتغييرها بعد أول دخول من زر «تغيير كلمة المرور».</p>
    <div class="fgrid"><label class="f">الرتبة *<select name="rank" required>${ranks.map(([k, l]) => opt(k, l, '')).join('')}</select></label>
    <label class="f">اسم المستخدم *<input name="user" required dir="ltr" autocomplete="off" pattern="[a-zA-Z0-9._\\-]{3,30}" title="3 إلى 30 حرفاً لاتينياً أو أرقاماً أو . _ -"></label>
    <label class="f">اسم صاحب الحساب<input name="name" maxlength="80"></label>
    <label class="f">كلمة المرور *<input name="pass" type="password" required minlength="4" autocomplete="new-password" dir="ltr"></label>
    <label class="f">تأكيد كلمة المرور *<input name="pass2" type="password" required minlength="4" autocomplete="new-password" dir="ltr"></label></div>
    <div class="row" style="margin-top:12px"><button class="btn pri" type="submit">إنشاء الحساب</button><button class="btn" type="button" data-act="close">إلغاء</button></div><p class="red ferr"></p></form>`;
  $('#modal').hidden = false; $('#modal select').focus();
}
KFORMS.kacct = async (f) => {
  const rank = f.elements.rank.value; const user = f.elements.user.value.trim().toLowerCase(); const name = f.elements.name.value.trim();
  const pass = f.elements.pass.value;
  if (!KRANKS[rank]) throw new Error('اختر الرتبة.');
  if (!/^[a-z0-9._-]{3,30}$/.test(user)) throw new Error('اسم المستخدم: 3 إلى 30 حرفاً لاتينياً أو أرقاماً أو . _ -');
  if (pass !== f.elements.pass2.value) throw new Error('كلمتا المرور غير متطابقتين.');
  const ae = user + KDOM; const pw = await kpw(ae, pass);
  // تطبيق Firebase ثانوي حتى لا يخرج رئيس النظام من جلسته عند إنشاء الحساب
  const sec = FB.initializeApp(FB.cfg, 'kacct-' + Date.now());
  let uid = '';
  try {
    const sa = FB.initializeAuth(sec, { persistence: FB.inMemoryPersistence });
    try { uid = (await FB.createUserWithEmailAndPassword(sa, ae, pw)).user.uid; }
    catch (e) {
      if (!/email-already-in-use/.test(e.code || '')) throw e;
      // الحساب موجود (أُنشئ سابقاً): يُربط إن كانت كلمة المرور صحيحة
      try { uid = (await FB.signInWithEmailAndPassword(sa, ae, pw)).user.uid; }
      catch (x) { throw new Error('اسم المستخدم مستخدم مسبقاً بكلمة مرور أخرى. اختر اسماً آخر.'); }
    }
    await FB.signOut(sa).catch(() => {});
  } finally { FB.deleteApp(sec).catch(() => {}); }
  await kWrite(ae, { role: RANK_ROLE[rank], rank, cat: 'head', uid, user, name, until: 0 });
  await log('تصاريح الدخول', `إنشاء حساب مخوّل: ${user} — ${KRANKS[rank]}${name ? ' (' + name + ')' : ''}`);
  closeModal(); toast(`أُنشئ الحساب ${user} — ${KRANKS[rank]}`); render();
};

/* ---------- تغيير كلمة المرور (للحسابات المخوّلة) ---------- */
function kPassDlg() {
  $('#modal').innerHTML = `<form class="dlg" data-form="kpass" style="width:min(440px,100%)"><h3>تغيير كلمة المرور</h3>
    <label class="f">كلمة المرور الحالية<input name="cur" type="password" required autocomplete="current-password" dir="ltr"></label>
    <label class="f" style="margin-top:8px">كلمة المرور الجديدة (6 أحرف على الأقل)<input name="n1" type="password" required minlength="6" autocomplete="new-password" dir="ltr"></label>
    <label class="f" style="margin-top:8px">تأكيد الجديدة<input name="n2" type="password" required minlength="6" autocomplete="new-password" dir="ltr"></label>
    <div class="row" style="margin-top:12px"><button class="btn pri" type="submit">حفظ</button><button class="btn" type="button" data-act="close">إلغاء</button></div><p class="red ferr"></p></form>`;
  $('#modal').hidden = false; $('#modal input').focus();
}
KFORMS.kpass = async (f) => {
  const u = FB.auth.currentUser; if (!u) throw new Error('سجّل الدخول أولاً.');
  if (f.elements.n1.value !== f.elements.n2.value) throw new Error('كلمتا المرور الجديدتان غير متطابقتين.');
  if (f.elements.n1.value === f.elements.cur.value) throw new Error('اختر كلمة مرور مختلفة عن الحالية.');
  const ae = String(u.email).toLowerCase();
  try { await FB.reauthenticateWithCredential(u, FB.EmailAuthProvider.credential(ae, await kpw(ae, f.elements.cur.value))); }
  catch (e) { throw new Error('كلمة المرور الحالية غير صحيحة.'); }
  await FB.updatePassword(u, await kpw(ae, f.elements.n1.value));
  await log('تصاريح الدخول', 'غيّر كلمة مروره'); closeModal(); toast('تغيّرت كلمة المرور');
};

/* ---------- تثبيت الصفحة والإجراءات (يُستدعى من app.js) ---------- */
function kpInstall() {
  VIEW.roles = kpView;
  ACT.knewacct = kNewAcct;
  ACT.kpass = kPassDlg;
  ACT.knotify = async () => { const p = await Notification.requestPermission(); toast(p === 'granted' ? 'ستصلك إشعارات طلبات الانضمام ما دام النظام مفتوحاً.' : 'لم يُسمح بالإشعارات في هذا المتصفح.', p === 'granted' ? '' : 'bad'); render(); };
  ACT.kapprove = async (d) => {
    const r = RAW.kreq.get(d.id); if (!r) return;
    const sel = document.getElementById('kq_role_' + d.id);
    const a = can('chair') && sel ? kAs(sel.value) : kAs('cat:' + KGRANT);
    const until = kUntil((document.getElementById('kq_until_' + d.id) || {}).value);
    await kWrite(r.id, { ...a, name: r.name, until });
    await settle(FB.updateDoc(FB.doc(FB.db, 'k_requests', r.id), { status: 'approved', decidedBy: ME, decidedAt: Date.now() }));
    await log('تصاريح الدخول', `قبول طلب انضمام: ${r.name} (${r.email}) — ${KCAT[a.cat] ? KCAT[a.cat].l : KROLES[a.role]}`);
    toast('قُبل الطلب، ويدخل صاحبه الآن'); render();
  };
  ACT.kreject = async (d) => {
    const r = RAW.kreq.get(d.id); if (!r) return;
    if (!confirm(`رفض طلب ${r.name}؟`)) return;
    await settle(FB.updateDoc(FB.doc(FB.db, 'k_requests', r.id), { status: 'rejected', decidedBy: ME, decidedAt: Date.now() }));
    await log('تصاريح الدخول', `رفض طلب انضمام: ${r.name} (${r.email})`); toast('رُفض الطلب'); render();
  };
  ACT.ktoggle = async (d) => {
    const r = RAW.kroles.get(d.id); if (!r) return;
    await kPatch(d.id, { off: !r.off });
    await log('تصاريح الدخول', `${r.off ? 'تفعيل' : 'إيقاف'} تصريح ${kWho(d.id)}`); toast(r.off ? 'فُعّل التصريح' : 'أُوقف التصريح'); render();
  };
  ACT.krevoke = async (d) => {
    const who = kWho(d.id);
    if (!confirm(`سحب تصريح ${who}؟ لن يستطيع الدخول بعدها.`)) return;
    await settle(FB.deleteDoc(FB.doc(FB.db, 'k_roles', d.id)));
    // يُحذف طلبه القديم أيضاً ليتمكن من التقديم مجدداً إن لزم
    if (RAW.kreq.has(d.id) && can('chair')) await settle(FB.deleteDoc(FB.doc(FB.db, 'k_requests', d.id))).catch(() => {});
    await log('تصاريح الدخول', `سحب تصريح ${who}`); toast('سُحب التصريح'); render();
  };
}
