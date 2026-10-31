// النسخة التجريبية (it-basra.com/amu-staging/): شريط واضح، ولا تُفتح إلا لمدير النظام.
// في البوابة الحقيقية (/amu/) لا يفعل هذا الملف شيئاً.
(function () {
  if (!/\/amu-staging\//.test(location.pathname)) return;
  var m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex, nofollow'; document.head.appendChild(m);
  document.title = '🧪 تجريبي · ' + document.title;
  function bar() {
    var b = document.createElement('div');
    b.setAttribute('role', 'status');
    b.style.cssText = 'position:fixed;top:0;inset-inline:0;z-index:99999;padding:5px 12px;background:repeating-linear-gradient(45deg,#7C2D12,#7C2D12 12px,#9A3412 12px,#9A3412 24px);color:#fff;font:800 13px Cairo,sans-serif;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.3)';
    b.innerHTML = '🧪 نسخة تجريبية للمدير — البيانات حقيقية، فجرّب بحذر · <a href="/amu/" style="color:#FDE68A">البوابة الحقيقية</a>';
    document.body.appendChild(b);
    document.body.style.paddingTop = '30px';
  }
  function gate(st) {
    var g = document.getElementById('amuStageGate');
    var ok = st && st.status === 'in' && st.admin;
    if (ok) { if (g) g.remove(); return; }
    if (st && st.status === 'loading') return;
    if (!g) {
      g = document.createElement('div'); g.id = 'amuStageGate';
      g.style.cssText = 'position:fixed;inset:0;z-index:99998;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#060A17;color:#F8FAFC;font:700 15px Cairo,sans-serif;text-align:center;padding:20px';
      g.innerHTML = '<b style="font-size:20px">النسخة التجريبية لمدير النظام فقط</b><span>تُجرَّب هنا التعديلات قبل نشرها للطلبة.</span><button type="button" style="padding:10px 18px;border-radius:12px;border:0;background:linear-gradient(135deg,#F59E0B,#B45309);color:#fff;font:800 14px Cairo,sans-serif;cursor:pointer">الدخول بحساب Google للمدير</button><a href="/amu/" style="color:#FBBF24">الذهاب إلى البوابة</a>';
      g.querySelector('button').onclick = function () { if (window.AMU_AUTH) window.AMU_AUTH.signIn(); };
      document.body.appendChild(g);
    }
  }
  function boot() {
    bar();
    if (window.AMU_AUTH) window.AMU_AUTH.onChange(gate); else gate(null);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); }); else setTimeout(boot, 0);
})();
