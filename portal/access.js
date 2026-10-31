// من يدخل أقسام البوابة والكتب الإلكترونية:
// 1) مدير النظام بحساب Google (السلطة المطلقة على كل أجزاء المنصة)
// 2) أي حساب Google بالبريد الجامعي @almaaqal.edu.iq
// 3) الأساتذة باسم المستخدم وكلمة المرور (doc01، doc02، …) من ملف الدكاترة،
//    وهي حسابات تطبيق الحضور نفسها (<اسم المستخدم>@pw.almaaqal.app)
// لا تُقبل حسابات Gmail للأساتذة؛ الأستاذ يدخل باسم المستخدم فقط.
window.AMU_ACCESS = {
  admins: ['drdsh.sw2022@gmail.com'],
  domains: ['almaaqal.edu.iq'],
  staffDomain: 'pw.almaaqal.app',
  // حسابات ممنوعة من الدخول حتى لو طابقت ما سبق (أضف البريد أو اسم المستخدم@pw.almaaqal.app)
  blocked: [],
  // بريد إدارة نظام الكنترول: إليه تُرسل طلبات التنزيل
  adminEmail: 'drdsh.sw2022@gmail.com'
};
window.AMU_ACCESS.norm = (e) => String(e || '').trim().toLowerCase();
window.AMU_ACCESS.isAdmin = function (email) { const e = this.norm(email); return !!e && this.admins.some((x) => this.norm(x) === e); };
window.AMU_ACCESS.isStaff = function (email) { return this.norm(email).endsWith('@' + this.staffDomain); };
window.AMU_ACCESS.isAllowed = function (email) {
  const e = this.norm(email);
  if (!e) return false;
  if (this.blocked.some((x) => this.norm(x) === e)) return false;
  if (this.isAdmin(e) || this.isStaff(e)) return true;
  const d = e.split('@')[1] || '';
  return this.domains.some((x) => d === this.norm(x));
};
