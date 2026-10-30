// قائمة المخوَّلين بدخول أقسام البوابة والمكتبة الإلكترونية.
// - أي حساب Google بنطاق بريد الجامعة في DOMAINS
// - والأشخاص في EMAILS بأي بريد (المدير والدكاترة من ملف doctor.xlsx)
// لإضافة دكتور جديد: أضف بريده سطراً في EMAILS ثم ارفع الملف.
window.AMU_ACCESS = {
  domains: ['almaaqal.edu.iq'],
  emails: [
    'drdsh.sw2022@gmail.com', // مدير النظام
    'ahalna.net@gmail.com',   // د. احمد خطيب
    'haider.1971@gmail.com',  // د. احمد الشافعي
    'shatt.alarb@gmail.com',  // د. نبيل شواي
    'fifo65556@gmail.com',    // د. احمد دنقل
    'gitcs.21@gmail.com',     // د. عماد بدر الدين
    't.c.basra.iq@gmail.com', // د. علاء ربيع
    'hid.you82@gmail.com'     // د. ايمن محمود
  ],
  // بريد إدارة نظام الكنترول: إليه تُرسل طلبات التنزيل
  adminEmail: 'drdsh.sw2022@gmail.com'
};
window.AMU_ACCESS.isAllowed = function (email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return false;
  if (this.emails.some((x) => x.toLowerCase() === e)) return true;
  const d = e.split('@')[1] || '';
  return this.domains.some((x) => d === x.toLowerCase());
};
