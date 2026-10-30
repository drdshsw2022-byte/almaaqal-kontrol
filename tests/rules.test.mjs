// اختبار قواعد Firestore لنظام الكنترول على المحاكي: يُشغَّل تلقائياً في GitHub Actions عند تعديل القواعد.
import { test, before, after } from 'node:test';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

let env;
const D = '@almaaqal.edu.iq';
const K = '@k.almaaqal.app', G = '@gmail.com';
const kacc = (n, uid) => env.authenticatedContext(uid || 'u-' + n, { email: n + K }).firestore();
const goo = (n) => env.authenticatedContext('g-' + n, { email: n + G, email_verified: true, firebase: { sign_in_provider: 'google.com' } }).firestore();
const as = (name) => env.authenticatedContext(name, { email: `${name}@pw.almaaqal.app` }).firestore();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kontrol',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const staff = { admin: 'admin', chair1: 'doctor', mem1: 'doctor', aud1: 'doctor', inv1: 'doctor', view1: 'doctor', none1: 'doctor' };
    for (const [n, role] of Object.entries(staff)) await setDoc(doc(db, 'staff', n + D), { name: n, role });
    for (const [n, role] of Object.entries({ chair1: 'chair', mem1: 'member', aud1: 'auditor', inv1: 'invigilator', view1: 'viewer' }))
      await setDoc(doc(db, 'k_roles', n + D), { role });
    await setDoc(doc(db, 'courses', 'cyber|3|CYS300'), { deptId: 'cyber', stage: 3 });
    await setDoc(doc(db, 'courses', 'ai|1|AI100'), { deptId: 'ai', stage: 1 });
    await setDoc(doc(db, 'k_meta', 'locks'), { cyber_3: { at: 1 }, ai_1: null });
    const base = { ref: 'AP-2026-0001', student: 's1', course: 'ai|1|AI100', round: '1', at: 1, createdBy: 'mem1' + D, oldFin: 20, oldTotal: 45 };
    await setDoc(doc(db, 'k_appeals', 'a_new'), { ...base, st: 'new' });
    await setDoc(doc(db, 'k_appeals', 'a_dec'), { ...base, st: 'decision', proposedFin: 25 });
    await setDoc(doc(db, 'k_appeals', 'a_done'), { ...base, st: 'done', outcome: 'upheld', decidedBy: 'chair1' + D });
    await setDoc(doc(db, 'k_appeals', 'a_legacy'), { student: 's1', course: 'ai|1|AI100', status: 'جديد', at: 1 });
    await setDoc(doc(db, 'k_audit', 'x1'), { by: 'mem1' + D, ts: 1 });
    // حسابات الكنترول المخوّلة (مربوطة بمعرّف الحساب) وتصاريح Google
    for (const [n, role, rank] of [['g1', 'chair', 'g1'], ['g2', 'chair', 'g2'], ['m1', 'member', 'm1'], ['d1', 'member', 'd1']])
      await setDoc(doc(db, 'k_roles', n + K), { role, rank, cat: 'head', uid: 'u-' + n });
    await setDoc(doc(db, 'k_roles', 'sup1' + G), { role: 'invigilator', rank: 'sup', cat: 'sup' });
    await setDoc(doc(db, 'k_roles', 'old1' + G), { role: 'auditor', rank: 'prof', cat: 'prof', until: 1000 });
    await setDoc(doc(db, 'k_roles', 'off1' + G), { role: 'auditor', rank: 'prof', cat: 'prof', off: true });
    await setDoc(doc(db, 'k_requests', 'req1' + G), { email: 'req1' + G, name: 'x', cat: 'prof', at: 1, status: 'pending' });
    await setDoc(doc(db, 'students', '1001'), { name: 's', deptId: 'ai', stage: 1 });
  });
});
after(async () => { await env.cleanup(); });

const newAp = (by, extra = {}) => ({ ref: 'AP-2026-0009', student: 's2', course: 'ai|1|AI100', round: '1', st: 'new', at: 2, createdBy: by + D, reason: 'x', ...extra });

test('عضو الكنترول يسجل اعتراضاً جديداً باسمه فقط', async () => {
  await assertSucceeds(setDoc(doc(as('mem1'), 'k_appeals', 'n1'), newAp('mem1')));
  await assertFails(setDoc(doc(as('mem1'), 'k_appeals', 'n2'), newAp('chair1')));
  await assertFails(setDoc(doc(as('mem1'), 'k_appeals', 'n3'), newAp('mem1', { st: 'done' })));
  await assertFails(setDoc(doc(as('mem1'), 'k_appeals', 'n4'), newAp('mem1', { finalFin: 40 })));
  await assertFails(setDoc(doc(as('aud1'), 'k_appeals', 'n5'), newAp('aud1')));
  await assertFails(setDoc(doc(as('view1'), 'k_appeals', 'n6'), newAp('view1')));
});

test('المدقق يدقق ولا يقرر', async () => {
  await assertSucceeds(updateDoc(doc(as('aud1'), 'k_appeals', 'a_new'), { st: 'audit', auditNote: 'ok', assignee: 'aud1' + D }));
  await assertSucceeds(updateDoc(doc(as('aud1'), 'k_appeals', 'a_legacy'), { st: 'audit' }));
  await assertFails(updateDoc(doc(as('aud1'), 'k_appeals', 'a_dec'), { st: 'done', outcome: 'changed', finalFin: 30, decidedBy: 'aud1' + D }));
  await assertFails(updateDoc(doc(as('aud1'), 'k_appeals', 'a_dec'), { finalFin: 30 }));
  await assertFails(updateDoc(doc(as('mem1'), 'k_appeals', 'a_dec'), { oldTotal: 99 }));
  await assertFails(updateDoc(doc(as('mem1'), 'k_appeals', 'a_dec'), { st: 'rejected', decidedBy: 'mem1' + D }));
});

test('رئيس اللجنة يعتمد القرار باسمه فقط، والاعتراض المغلق لا يُعدَّل', async () => {
  await assertFails(updateDoc(doc(as('chair1'), 'k_appeals', 'a_dec'), { st: 'done', outcome: 'changed', finalFin: 30, decidedBy: 'mem1' + D }));
  await assertSucceeds(updateDoc(doc(as('chair1'), 'k_appeals', 'a_dec'), { st: 'done', outcome: 'changed', finalFin: 30, decidedBy: 'chair1' + D, decidedAt: 5 }));
  await assertFails(updateDoc(doc(as('chair1'), 'k_appeals', 'a_done'), { finalFin: 44 }));
  await assertFails(updateDoc(doc(as('admin'), 'k_appeals', 'a_done'), { outcome: 'changed' }));
});

test('القراءة والحذف حسب الدور', async () => {
  await assertSucceeds(getDoc(doc(as('view1'), 'k_appeals', 'a_new')));
  await assertSucceeds(getDoc(doc(as('inv1'), 'k_appeals', 'a_new')));
  await assertFails(getDoc(doc(as('none1'), 'k_appeals', 'a_new')));
  await assertFails(deleteDoc(doc(as('mem1'), 'k_appeals', 'a_legacy')));
  await assertSucceeds(deleteDoc(doc(as('chair1'), 'k_appeals', 'a_legacy')));
});

test('الرصد مرفوض على مرحلة مصادق عليها إلا لرئيس اللجنة', async () => {
  const rows = { rows: { s1: { e1: 30 } } };
  await assertFails(setDoc(doc(as('aud1'), 'k_marks', 'cyber|3|CYS300'), rows, { merge: true }));
  await assertFails(setDoc(doc(as('mem1'), 'k_marks', 'cyber|3|CYS300'), rows, { merge: true }));
  await assertSucceeds(setDoc(doc(as('aud1'), 'k_marks', 'ai|1|AI100'), rows, { merge: true }));
  await assertSucceeds(setDoc(doc(as('chair1'), 'k_marks', 'cyber|3|CYS300'), rows, { merge: true }));
  await assertFails(setDoc(doc(as('view1'), 'k_marks', 'ai|1|AI100'), rows, { merge: true }));
  await assertFails(getDoc(doc(as('inv1'), 'k_marks', 'ai|1|AI100')));
});

test('سجل التدقيق إضافة فقط وباسم المستخدم نفسه', async () => {
  await assertSucceeds(setDoc(doc(as('inv1'), 'k_audit', 'x2'), { by: 'inv1' + D, ts: 2 }));
  await assertFails(setDoc(doc(as('inv1'), 'k_audit', 'x3'), { by: 'chair1' + D, ts: 3 }));
  await assertFails(updateDoc(doc(as('chair1'), 'k_audit', 'x1'), { ts: 9 }));
  await assertFails(deleteDoc(doc(as('admin'), 'k_audit', 'x1')));
});

test('هيكل الجامعة والصلاحيات للإدارة العليا ورئيس اللجنة', async () => {
  await assertSucceeds(setDoc(doc(as('admin'), 'colleges', 'eng'), { name: 'كلية الهندسة' }));
  await assertFails(setDoc(doc(as('chair1'), 'colleges', 'eng2'), { name: 'x' }));
  await assertFails(setDoc(doc(as('mem1'), 'departments', 'x'), { name: 'x', collegeId: 'eng' }));
  await assertSucceeds(setDoc(doc(as('chair1'), 'k_roles', 'none1' + D), { role: 'viewer', by: 'chair1' + D }));
  await assertFails(setDoc(doc(as('chair1'), 'k_roles', 'view1' + D), { role: 'viewer', by: 'admin' + D }));
  await assertFails(setDoc(doc(as('mem1'), 'k_roles', 'none1' + D), { role: 'chair' }));
  await assertFails(setDoc(doc(as('mem1'), 'k_meta', 'locks'), { cyber_3: null }, { merge: true }));
});

test('حسابات الكنترول المخوّلة: مربوطة بمعرّف حسابها', async () => {
  await assertSucceeds(getDoc(doc(kacc('g1'), 'k_meta', 'locks')));
  await assertSucceeds(getDoc(doc(kacc('g1'), 'students', '1001')));
  await assertSucceeds(getDoc(doc(kacc('m1'), 'courses', 'ai|1|AI100')));
  await assertFails(getDoc(doc(kacc('g1', 'intruder'), 'k_meta', 'locks')));
  await assertFails(getDoc(doc(kacc('zz'), 'k_meta', 'locks')));
  await assertFails(getDoc(doc(kacc('zz'), 'students', '1001')));
});

test('رئيس المشرفين يمنح تصاريح المشرفين فقط، ورئيس الأساتذة للأساتذة فقط', async () => {
  const sup = (by) => ({ role: 'invigilator', rank: 'sup', cat: 'sup', by: by + K, at: 1 });
  const prof = (by) => ({ role: 'auditor', rank: 'prof', cat: 'prof', by: by + K, at: 1 });
  await assertSucceeds(setDoc(doc(kacc('m1'), 'k_roles', 'new1' + G), sup('m1')));
  await assertFails(setDoc(doc(kacc('m1'), 'k_roles', 'new2' + G), prof('m1')));
  await assertFails(setDoc(doc(kacc('m1'), 'k_roles', 'new3' + G), { ...sup('m1'), role: 'chair' }));
  await assertFails(setDoc(doc(kacc('m1'), 'k_roles', 'd1' + K), sup('m1')));
  await assertSucceeds(setDoc(doc(kacc('d1'), 'k_roles', 'new4' + G), prof('d1')));
  await assertFails(deleteDoc(doc(kacc('d1'), 'k_roles', 'sup1' + G)));
  await assertSucceeds(deleteDoc(doc(kacc('m1'), 'k_roles', 'new1' + G)));
  await assertFails(setDoc(doc(as('mem1'), 'k_roles', 'new5' + G), sup('mem1')));
});

test('معاون رئيس النظام لا يعدّل تصريح رئيس النظام، ولا أحد يعدّل تصريحه هو', async () => {
  await assertFails(updateDoc(doc(kacc('g2'), 'k_roles', 'g1' + K), { role: 'viewer', by: 'g2' + K }));
  await assertFails(deleteDoc(doc(kacc('g2'), 'k_roles', 'g1' + K)));
  await assertFails(updateDoc(doc(kacc('g2'), 'k_roles', 'g2' + K), { role: 'chair', rank: 'g1', by: 'g2' + K }));
  await assertSucceeds(updateDoc(doc(kacc('g1'), 'k_roles', 'g2' + K), { until: 0, by: 'g1' + K }));
  await assertSucceeds(setDoc(doc(kacc('g2'), 'k_roles', 'm1' + K), { role: 'member', rank: 'm1', cat: 'head', uid: 'u-m1', by: 'g2' + K }));
});

test('حساب Google: طلب انضمام باسمه فقط، ولا يدخل قبل القبول، والتصريح المنتهي أو الموقوف لا يعمل', async () => {
  const r = (n, x = {}) => ({ email: n + G, name: n, cat: 'sup', at: 1, status: 'pending', ...x });
  await assertSucceeds(setDoc(doc(goo('new9'), 'k_requests', 'new9' + G), r('new9')));
  await assertFails(setDoc(doc(goo('new8'), 'k_requests', 'other' + G), r('other')));
  await assertFails(setDoc(doc(goo('new7'), 'k_requests', 'new7' + G), r('new7', { status: 'approved' })));
  await assertFails(setDoc(doc(goo('new6'), 'k_requests', 'new6' + G), r('new6', { cat: 'chair' })));
  await assertFails(getDoc(doc(goo('new9'), 'k_meta', 'locks')));
  await assertFails(getDoc(doc(goo('new9'), 'students', '1001')));
  await assertSucceeds(getDoc(doc(goo('sup1'), 'k_slots', 'none')));
  await assertFails(getDoc(doc(goo('old1'), 'k_meta', 'locks')));
  await assertFails(getDoc(doc(goo('off1'), 'k_meta', 'locks')));
  await assertFails(updateDoc(doc(kacc('m1'), 'k_requests', 'req1' + G), { status: 'approved', decidedBy: 'm1' + K, decidedAt: 2 }));
  await assertSucceeds(updateDoc(doc(kacc('d1'), 'k_requests', 'req1' + G), { status: 'approved', decidedBy: 'd1' + K, decidedAt: 2 }));
  await assertSucceeds(getDoc(doc(as('admin'), 'k_requests', 'new9' + G)));
});
