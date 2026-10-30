"use strict";
/* ============ أدوات عامة ============ */
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const num=v=>{if(v===''||v==null)return null;const n=Number(v);return Number.isFinite(n)?n:null};
const r1=n=>n==null?'—':String(Math.round(n*10)/10);
const byNo=(a,b)=>String(a.no).localeCompare(String(b.no),'en',{numeric:true});
const STAGES=['الأولى','الثانية','الثالثة','الرابعة','الخامسة','السادسة'];
const TITLES=['أستاذ','أستاذ مساعد','مدرس','مدرس مساعد','مبرمج','موظف'];
const TR={'أستاذ':6,'أستاذ مساعد':5,'مدرس':4,'مدرس مساعد':3,'مبرمج':2,'موظف':1};
const GCOL=['var(--g1)','var(--g2)','var(--g3)','var(--g4)','var(--g5)'];
const DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const dayName=d=>{try{return DAYS[new Date(d+'T00:00:00').getDay()]}catch(e){return''}};
const fmtTs=ts=>{const d=new Date(ts);return d.toLocaleDateString('ar-IQ-u-nu-latn')+' '+d.toLocaleTimeString('ar-IQ-u-nu-latn',{hour:'2-digit',minute:'2-digit'})};
async function sha256(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function hmac(key,msg){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);const b=await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(msg));return [...new Uint8Array(b)]}
function randKey(){const a=new Uint8Array(24);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('')}

/* التفقيط: الدرجة كتابةً (المعدود مؤنث: درجة) */
function tafqeet(n){
  if(n==null||isNaN(n))return '—';
  const w=Math.floor(n),half=Math.abs((n-w)-0.5)<1e-9;
  const U=['','واحدة','اثنتان','ثلاث','أربع','خمس','ست','سبع','ثمان','تسع','عشر'];
  const T=['','','عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون'];
  let s;
  if(w===0)s='صفر';
  else if(w===1)s='درجة واحدة';
  else if(w===2)s='درجتان';
  else if(w<=10)s=U[w]+' درجات';
  else if(w===11)s='إحدى عشرة درجة';
  else if(w===12)s='اثنتا عشرة درجة';
  else if(w<20)s=U[w-10]+' عشرة درجة';
  else if(w<100){const t=Math.floor(w/10),u=w%10;s=(u?(u===1?'إحدى':U[u])+' و'+T[t]:T[t])+' درجة'}
  else if(w===100)s='مئة درجة';
  else s=w+' درجة';
  return s+(half?' ونصف':'')+' فقط لا غير';
}

/* ============ المخزن ============ */
const COLLS=['depts','students','courses','halls','staff','exams','slots','grades','codes','envelopes','incidents','appeals','audit','meta'];
let S={};COLLS.forEach(c=>S[c]=new Map());
const arr=c=>[...S[c].values()];
let db=null,userCap=null,dl=null,sampleCap=null,MODE='boot',RO=false,ME='local',IS_ADMIN=true;
/* وضع Firebase: قاعدة مشروع تطبيق الحضور نفسها. الطلبة والمواد والأقسام والكادر والسعي تُقرأ منه،
   وبيانات الكنترول في مجموعات k_ مستقلة تحميها قواعد Firestore. */
let FB=null,KROLE='chair',MEPROF=null;
const KCOL={halls:'k_halls',exams:'k_exams',slots:'k_slots',grades:'k_marks',codes:'k_codes',envelopes:'k_envelopes',incidents:'k_incidents',appeals:'k_appeals',audit:'k_audit',meta:'k_meta',staff:'k_staffx'};
const SHARED_RO=new Set(['depts','courses','students']);
const SHARED_MSG='هذه البيانات تُدار من نظام الحضور (لوحة الإدارة) وتظهر هنا تلقائياً.';
const KROLES={chair:'رئيس اللجنة',member:'عضو كنترول',auditor:'مدقق درجات',invigilator:'مراقب',viewer:'اطلاع'};
const ROLE_AR={admin:'مدير النظام',president:'الإدارة العليا',dean:'عميد كلية',head:'رئيس قسم',doctor:'تدريسي'};
const SUPER_ADMINS=['drdsh.sw2022@gmail.com'];
let IS_TOP=true; // مدير النظام والإدارة العليا: يكتبون هيكل الجامعة (colleges/departments)
/* هيكل جامعة المعقل الدولية: الكليات والأقسام كما تنشرها مواقع الجامعة وكلياتها.
   kw: كلمات تطابق قسماً موجوداً مسبقاً في قاعدة الحضور فيُحتفظ برمزه واسمه. */
const UNIV_STRUCT=[
  {id:'eng',name:'كلية الهندسة',kw:['الهندسة'],d:[
    {id:'petroleum',name:'هندسة النفط',kw:['هندسة النفط']},
    {id:'civil',name:'الهندسة المدنية',kw:['المدنية']},
    {id:'control',name:'هندسة السيطرة والحاسبات',kw:['السيطرة']},
    {id:'ai',name:'هندسة الذكاء الاصطناعي',kw:['الذكاء']},
    {id:'cyber',name:'هندسة الأمن السيبراني',kw:['السيبراني']},
    {id:'mechpower',name:'هندسة تقنيات ميكانيك القوى',kw:['ميكانيك']}]},
  {id:'ht',name:'كلية التقنيات الصحية والطبية',kw:['الصحية'],d:[
    {id:'medlab',name:'تقنيات المختبرات الطبية',kw:['المختبر']},
    {id:'radio',name:'تقنيات الأشعة والسونار',kw:['الاشعة','الأشعة']},
    {id:'anes',name:'تقنيات التخدير',kw:['التخدير']}]},
  {id:'mng',name:'كلية الإدارة والاقتصاد',kw:['الادارة','الإدارة'],d:[
    {id:'bus',name:'إدارة الأعمال',kw:['الاعمال','الأعمال']},
    {id:'ogm',name:'إدارة وتسويق النفط والغاز',kw:['تسويق']},
    {id:'oge',name:'اقتصاديات النفط والغاز',kw:['اقتصاديات']}]},
  {id:'ph',name:'كلية الصيدلة',kw:['الصيدلة'],d:[{id:'pharm',name:'الصيدلة',kw:['الصيدلة']}]},
  {id:'dent',name:'كلية طب الأسنان',kw:['الاسنان','الأسنان'],d:[{id:'dent',name:'طب الأسنان',kw:['الاسنان','الأسنان']}]},
  {id:'law',name:'كلية القانون',kw:['القانون'],d:[{id:'law',name:'القانون',kw:['القانون']}]},
  {id:'sp',name:'كلية التربية البدنية وعلوم الرياضة',kw:['البدنية'],d:[{id:'pe',name:'التربية البدنية وعلوم الرياضة',kw:['البدنية']}]},
  {id:'arts',name:'كلية الآداب',kw:['الآداب','الاداب'],d:[{id:'clinpsy',name:'علم النفس السريري',kw:['النفس']}]},
  {id:'sci',name:'كلية العلوم',kw:['العلوم'],d:[{id:'patho',name:'علوم التحليلات المرضية',kw:['التحليلات']}]},
];
const kwHit=(name,kw)=>kw.some(k=>String(name||'').includes(k));
/* يحسب ما ينقص قاعدة البيانات دون أن يمس الموجود: يُعاد استخدام رمز أي كلية أو قسم موجود يطابق اسمه. */
function planStructure(colleges,depts){ // colleges/depts: Map id -> {name, collegeId}
  const ops=[];const cid={};
  for(const c of UNIV_STRUCT){let id=c.id;
    for(const [x,v] of colleges)if(x===c.id||kwHit(v.name,c.kw)&&String(v.name).includes('كلية')){id=x;break}
    cid[c.id]=id;if(!colleges.has(id))ops.push({c:'colleges',id,data:{id,name:c.name},label:c.name})}
  const used=new Set();
  for(const c of UNIV_STRUCT)for(const d of c.d){let id=null;
    for(const [x,v] of depts)if(!used.has(x)&&(x===d.id||kwHit(v.name,d.kw))){id=x;break}
    if(id){used.add(id);const v=depts.get(id);if(!v.collegeId)ops.push({c:'departments',id,data:{collegeId:cid[c.id]},label:(v.name||id)+' ← '+c.name,link:1});continue}
    let nid=d.id;while(depts.has(nid)||used.has(nid))nid+='2';used.add(nid);
    ops.push({c:'departments',id:nid,data:{id:nid,name:d.name,collegeId:cid[c.id]},label:d.name+' — '+c.name})}
  return ops}
const fsSafe=id=>String(id).replace(/\//g,'_');
const settle=p=>Promise.race([p,new Promise(r=>setTimeout(r,4000))]); // دون اتصال: الكتابة تُحفظ محلياً وتُزامَن لاحقاً
function fbData(c,data){const v=strip(data);
  if(c==='grades'&&v.rows){const rows={};for(const [sid,r] of Object.entries(v.rows)){if(r==null){rows[sid]=null;continue}if(r.demo){rows[sid]={...r};continue}const o={};for(const [k,x] of Object.entries(r)){if(k.startsWith('p_')||k==='cw'||k==='imp')continue;o[k]=x}rows[sid]=o}v.rows=rows}
  if(c==='staff'){const o={};['title','phone','relatives','unavail','coi'].forEach(k=>{if(k in v)o[k]=v[k]});return o}
  return v}
function fbRef(c,id){if(!KCOL[c])throw new Error(SHARED_MSG);return FB.doc(FB.db,KCOL[c],fsSafe(id))}
function can(x){if(MODE!=='fb')return true;const r=KROLE;
  if(x==='chair')return r==='chair';
  if(x==='ctrl')return r==='chair'||r==='member';
  if(x==='grade')return r==='chair'||r==='member'||r==='auditor';
  if(x==='invig')return r==='chair'||r==='member'||r==='invigilator';
  return true}
const LKEY='kontrol.local.v3'; // يتجاهل البيانات التجريبية القديمة المحفوظة على الجهاز
function saveLocal(){if(MODE!=='local')return;try{const o={};COLLS.forEach(c=>o[c]=[...S[c].entries()]);localStorage.setItem(LKEY,JSON.stringify(o))}catch(e){}}
function loadLocal(){try{const o=JSON.parse(localStorage.getItem(LKEY)||'null');if(o&&o.students&&o.students.length){COLLS.forEach(c=>S[c]=new Map(o[c]||[]));return true}}catch(e){}return false}
function strip(d){const v={...d};delete v.id;return v}
async function put(c,id,data){
  if(RO)throw new Error('لديك صلاحية اطلاع فقط على هذه السجلات.');
  if(MODE==='fb'){await settle(FB.setDoc(fbRef(c,id),fbData(c,data),c==='staff'?{merge:true}:{}));return}
  S[c].set(id,{...strip(data),id});sched();
  if(MODE==='cloud')await db.collection(c).doc(id).set(strip(data));else saveLocal();
}
function deepMerge(a,b){const o={...a};for(const k in b){const v=b[k];if(v&&typeof v==='object'&&!Array.isArray(v)&&o[k]&&typeof o[k]==='object'&&!Array.isArray(o[k]))o[k]=deepMerge(o[k],v);else o[k]=v}return o}
async function patch(c,id,data){
  if(RO)throw new Error('لديك صلاحية اطلاع فقط على هذه السجلات.');
  if(MODE==='fb'){await settle(FB.setDoc(fbRef(c,id),fbData(c,data),{merge:true}));return}
  const cur=S[c].get(id);const m=deepMerge(cur||{},data);m.id=id;S[c].set(id,m);sched();
  if(MODE==='cloud'){const ref=db.collection(c).doc(id);if(cur)await ref.update(data);else await ref.set(strip(m))}else saveLocal();
}
async function del(c,id){
  if(RO)throw new Error('لديك صلاحية اطلاع فقط على هذه السجلات.');
  if(MODE==='fb'){await settle(FB.deleteDoc(fbRef(c,id)));return}
  S[c].delete(id);sched();
  if(MODE==='cloud')await db.collection(c).doc(id).delete();else saveLocal();
}
async function bulk(items,onProgress){ // [{c,id,data}]
  if(MODE==='fb'){for(let i=0;i<items.length;i+=400){const b=FB.writeBatch(FB.db);items.slice(i,i+400).forEach(x=>b.set(fbRef(x.c,x.id),fbData(x.c,x.data),x.c==='staff'?{merge:true}:{}));await settle(b.commit());if(onProgress)onProgress(Math.min(i+400,items.length),items.length)}return}
  if(MODE!=='cloud'){items.forEach(x=>S[x.c].set(x.id,{...strip(x.data),id:x.id}));saveLocal();sched();return}
  let i=0,done=0;const run=async()=>{while(i<items.length){const x=items[i++];S[x.c].set(x.id,{...strip(x.data),id:x.id});
    for(let t=0;;t++){try{await db.collection(x.c).doc(x.id).set(strip(x.data));break}catch(e){if(t<6&&(e.code==='resource_exhausted'||e.code==='unavailable')){await new Promise(r=>setTimeout(r,600*2**t+Math.random()*400));continue}throw e}}
    done++;if(onProgress)onProgress(done,items.length)}};
  await Promise.all(Array.from({length:4},run));sched();
}
const PARTS=[['att','الحضور',5],['hw','الواجب البيتي',5],['proj','المشروع',10],['lab','المختبر',10],['quiz','الامتحان الأسبوعي',10],['mid','الامتحان الفصلي',10]];
const cfg=()=>({univ:'جامعة المعقل الدولية',college:'كلية الهندسة',year:'2026–2027',term:'الفصل الدراسي الأول',curSem:'1',cwMax:50,finMax:50,pass:50,maxCarry:2,graceTotal:5,gracePer:5,double:true,useParts:true,requireCoi:false,appealHours:48,idleMin:30,p1:'09:00',p2:'11:30',...(S.meta.get('settings')||{})});
const partsOn=()=>cfg().useParts!==false;

/* ============ الاعتراضات: مسار موثق ============
   جديد ← قيد التدقيق ← قيد المراجعة ← بانتظار القرار ← مكتمل/مرفوض.
   لا تتغير أي درجة إلا بقرار معتمد من رئيس اللجنة (finalFin)، وتُحفظ الدرجة قبل التسجيل للمقارنة. */
const APST={new:'جديد',audit:'قيد التدقيق',review:'قيد المراجعة',decision:'بانتظار القرار',done:'مكتمل',rejected:'مرفوض'};
const AP_OPEN=['new','audit','review','decision'];
const APOUT={changed:'عُدلت الدرجة',upheld:'الدرجة صحيحة — لا تعديل',rejected:'رُفض شكلاً'};
function apN(a){ // يوحّد سجلات الإصدار السابق (الحالة نصاً عربياً) مع الحقول الجديدة
  if(!a||a.st)return a;const o={...a};
  if(a.status==='مقبول — عُدلت الدرجة'){o.st='done';o.outcome='changed';o.finalFin=a.newFin;o.decidedAt=a.statusAt}
  else if(a.status==='مرفوض — الدرجة صحيحة'){o.st='done';o.outcome='upheld';o.decidedAt=a.statusAt}
  else o.st=a.status==='قيد التدقيق'?'audit':'new';
  if(!o.decisionReason&&a.note)o.decisionReason=a.note;return o}
const apList=()=>arr('appeals').map(apN);
const apOpen=a=>AP_OPEN.includes(a.st);
const apDue=a=>a.due||((a.at||Date.now())+cfg().appealHours*36e5);
const apLate=(a,now=Date.now())=>apOpen(a)&&now>apDue(a);
let TICK=0,APC={t:-1,m:null};
function apFinMap(){if(APC.t===TICK&&APC.m)return APC.m;const m=new Map();
  apList().filter(a=>a.st==='done'&&a.outcome==='changed'&&num(a.finalFin)!=null).sort((x,y)=>(x.decidedAt||0)-(y.decidedAt||0))
    .forEach(a=>m.set(a.course+'~'+a.student,{v:+a.finalFin,round:String(a.round||'1'),ref:a.ref||''}));
  APC={t:TICK,m};return m}

/* سجل التدقيق بسلسلة تجزئة */
async function log(action,detail){
  try{
    const a=arr('audit').sort((x,y)=>x.ts-y.ts);const prev=a.length?a[a.length-1].hash:'GENESIS';
    const ts=Date.now();const hash=await sha256([prev,ts,ME,action,detail].join('|'));
    await put('audit',ts.toString(36)+'-'+Math.random().toString(36).slice(2,6),{ts,by:ME,action,detail:String(detail),prev,hash});
  }catch(e){}
}

/* ============ منطق المجال ============ */
const label={
  depts:d=>d?d.name:'—',
  students:s=>s?`${s.no} — ${s.name}`:'—',
  courses:c=>c?`${c.code} ${c.name}`:'—',
  staff:p=>p?p.name:'—', halls:h=>h?h.name:'—',
  exams:e=>{if(!e)return'—';const c=S.courses.get(e.course);return `${c?c.name:'مادة محذوفة'}${e.kind&&e.kind!=='نهائي'?' ('+e.kind+')':''} · ${e.date||''} · ج${e.period||1}`},
};
const groupKey=(d,s)=>d+'|'+s;
const groupName=k=>{const [d,s]=k.split('|');return `${label.depts(S.depts.get(d))} — المرحلة ${STAGES[(+s)-1]||s}`};
function groups(){const m=new Set();arr('courses').filter(semOk).forEach(c=>m.add(groupKey(c.dept,c.stage)));arr('students').forEach(s=>m.add(groupKey(s.dept,s.stage)));return [...m].filter(k=>S.depts.get(k.split('|')[0])).sort()}
const groupStudents=k=>{const [d,s]=k.split('|');return arr('students').filter(x=>x.dept===d&&String(x.stage)===String(s)).sort(byNo)};
const semOk=c=>!c.sem||String(c.sem)===String(cfg().curSem);
const groupCourses=k=>{const [d,s]=k.split('|');return arr('courses').filter(x=>x.dept===d&&String(x.stage)===String(s)&&semOk(x)).sort((a,b)=>String(a.code).localeCompare(String(b.code)))};
const courseStudents=c=>c?groupStudents(groupKey(c.dept,c.stage)):[];
const G=cid=>(S.grades.get(cid)||{}).rows||{};
const examOf=cid=>arr('exams').find(e=>e.course===cid);
const isLocked=k=>!!((S.meta.get('locks')||{})[k.replace('|','_')]);
const slotKey=e=>`${e.date}_p${e.period||1}`;
function slotList(){const m=new Map();for(const e of arr('exams')){if(!e.date||e.kind==='تسليم')continue;const k=slotKey(e);if(!m.has(k))m.set(k,{key:k,date:e.date,period:+e.period||1,exams:[]});m.get(k).exams.push(e)}return [...m.values()].sort((a,b)=>a.key<b.key?-1:1)}
const slotName=s=>`${dayName(s.date)} ${s.date} · الجلسة ${s.period===1?'الأولى':'الثانية'} (${s.period===1?cfg().p1:cfg().p2})`;
function examStudents(e){const c=S.courses.get(e.course);if(!c)return[];const g=G(c.id);return courseStudents(c).filter(s=>!(g[s.id]&&g[s.id].dep))}

function finalOf(r){ // الدرجة النهائية المدققة
  if(r.abs)return {v:0,ok:true};
  if(r.appealFin!=null&&r.appealFin!=='')return {v:+r.appealFin,ok:true,appeal:true};
  const a=num(r.e1),b=num(r.e2);
  if(a==null)return {v:null,ok:false};
  if(!cfg().double)return {v:a,ok:true};
  if(b==null)return {v:null,ok:false,await2:true};
  if(Math.abs(a-b)>1e-9)return {v:null,ok:false,mismatch:true};
  return {v:a,ok:true};
}
function res(cid,sid,noGrace){
  const st=cfg();let r=G(cid)[sid]||{};
  if(MODE==='fb'&&r.appealFin!=null){r={...r};delete r.appealFin} // في Firebase لا يُعتد إلا بقرار الاعتراض المعتمد
  const ap=apFinMap().get(cid+'~'+sid);if(ap){r={...r};if(ap.round==='2')r.sec=ap.v;else r.appealFin=ap.v}
  if(r.dep)return {state:'dep',label:'محروم',pass:false,total:null};
  const cw=num(r.cw);const f=finalOf(r);
  if(cw==null||f.v==null)return {state:'pending',label:f.mismatch?'تعارض رصد':'غير مكتمل',pass:false,total:null,mismatch:!!f.mismatch,cw,abs:!!r.abs};
  const g=noGrace?0:(num(r.grace)||0);
  const t1=cw+f.v+g;
  if(t1>=st.pass)return {state:'pass',round:1,total:t1,cw,fin:f.v,grace:g,pass:true,abs:!!r.abs,appeal:f.appeal};
  const sec=num(r.sec);
  if(sec!=null){const t2=cw+sec;return {state:t2>=st.pass?'pass':'fail',round:2,total:t2,cw,fin:sec,grace:0,pass:t2>=st.pass,abs:!!r.abs}}
  return {state:'fail',round:1,total:t1,cw,fin:f.v,grace:g,pass:false,abs:!!r.abs};
}
function grade(t){if(t==null)return'';if(t>=90)return'امتياز';if(t>=80)return'جيد جداً';if(t>=70)return'جيد';if(t>=60)return'متوسط';if(t>=cfg().pass)return'مقبول';return'راسب'}
function studentStatus(k,sid){
  const cs=groupCourses(k);if(!cs.length)return {label:'—',cls:''};
  const rs=cs.map(c=>({c,r:res(c.id,sid)}));
  if(rs.some(x=>x.r.state==='pending'))return {label:'غير مكتمل',cls:'warn',rs};
  const fail1=rs.filter(x=>!(x.r.state==='pass'&&x.r.round===1));
  if(!fail1.length)return {label:'ناجح',cls:'ok',rs};
  if(fail1.length>cfg().maxCarry)return {label:'راسب',cls:'bad',rs};
  const secDone=fail1.every(x=>x.r.round===2);
  if(!secDone)return {label:`مكمل (${fail1.length})`,cls:'warn',rs};
  return fail1.every(x=>x.r.pass)?{label:'ناجح — الدور الثاني',cls:'ok',rs}:{label:'راسب',cls:'bad',rs};
}

/* توزيع المقاعد: تناوب الأعمدة بين المواد المتزامنة، ومقعد فارغ بين الطلبة إن سمحت السعة */
function seatPlan(slot,hallIds){
  const gs=slot.exams.map(e=>({e,q:examStudents(e)})).filter(g=>g.q.length);
  const total=gs.reduce((a,g)=>a+g.q.length,0);
  const halls=hallIds.map(id=>S.halls.get(id)).filter(Boolean);
  const cap=halls.reduce((a,h)=>a+(+h.rows)*(+h.cols),0);
  if(!total)throw new Error('لا يوجد طلبة مؤهلون لهذه الجلسة.');
  if(total>cap)throw new Error(`السعة غير كافية: ${total} طالباً مقابل ${cap} مقعداً. اختر قاعة إضافية.`);
  const spread=gs.length===1&&total*2<=cap;
  const seats=[],taken=new Set();let gi=0;
  for(const h of halls){for(let c=0;c<+h.cols;c++){
    if(spread&&c%2===1)continue;
    const act=gs.filter(g=>g.q.length);if(!act.length)break;
    const g=act[gi%act.length];gi++;
    for(let r=0;r<+h.rows&&g.q.length;r++){const s=g.q.shift();seats.push({s:s.id,e:g.e.id,h:h.id,r,c});taken.add(h.id+':'+r+':'+c)}
  }}
  const left=gs.flatMap(g=>g.q.map(s=>({s,e:g.e})));
  for(const h of halls)for(let c=0;c<+h.cols;c++)for(let r=0;r<+h.rows;r++){if(!left.length)break;const k=h.id+':'+r+':'+c;if(taken.has(k))continue;const x=left.shift();seats.push({s:x.s.id,e:x.e.id,h:h.id,r,c});taken.add(k)}
  return seats;
}
const seatNo=(h,x)=>x.c*(+h.rows)+x.r+1;
function unavail(p,date){return String(p.unavail||'').split(/[\s,،]+/).filter(Boolean).includes(date)}
function coiNos(p){return String(p.relatives||'').split(/[\s,،]+/).filter(Boolean)}
function dutyPlan(slot){
  const sd=S.slots.get(slot.key);if(!sd||!(sd.seats||[]).length)throw new Error('وزّع المقاعد لهذه الجلسة أولاً.');
  const hallsUsed=[...new Set(sd.seats.map(x=>x.h))];
  const load=new Map();for(const o of arr('slots'))if(o.id!==slot.key)for(const d of (o.duties||[]))for(const id of d.staff)load.set(id,(load.get(id)||0)+1);
  const teachers=new Set(slot.exams.flatMap(e=>{const c=S.courses.get(e.course)||{};return [c.teacher,c.teacher2]}).filter(Boolean));
  const used=new Set(),out=[],warn=[];
  for(const hid of hallsUsed){
    const h=S.halls.get(hid);if(!h)continue;const need=Math.max(1,+h.inv||2);
    const nos=new Set(sd.seats.filter(x=>x.h===hid).map(x=>(S.students.get(x.s)||{}).no));
    const c=arr('staff').filter(p=>!used.has(p.id)&&!teachers.has(p.id)&&!unavail(p,slot.date)&&!coiNos(p).some(n=>nos.has(n))&&(!cfg().requireCoi||p.coi));
    c.sort((a,b)=>(load.get(a.id)||0)-(load.get(b.id)||0)||(TR[a.title]||0)-(TR[b.title]||0)||String(a.name).localeCompare(String(b.name)));
    const pick=c.slice(0,need);pick.forEach(p=>{used.add(p.id);load.set(p.id,(load.get(p.id)||0)+1)});
    pick.sort((a,b)=>(TR[b.title]||0)-(TR[a.title]||0));
    if(pick.length<need)warn.push(`${h.name}: نقص ${need-pick.length} مراقب`);
    out.push({h:hid,staff:pick.map(p=>p.id)});
  }
  return {duties:out,warn};
}
async function makeCodes(examId){
  const e=S.exams.get(examId);const key=randKey();const map={},seen=new Set();
  for(const s of examStudents(e)){let n=0,code;do{const b=await hmac(key,s.id+'|'+examId+'|'+n);const v=((b[0]<<24>>>0)+(b[1]<<16)+(b[2]<<8)+b[3])%900000+100000;const L='ABCDEFGHJKLMNPQRSTUVWXYZ'[b[4]%24];code=L+'-'+v;n++}while(seen.has(code));seen.add(code);map[s.id]=code}
  await put('codes',examId,{key,map,decoded:false,at:Date.now(),by:ME});
}
const codesFor=cid=>{const e=examOf(cid);return e?S.codes.get(e.id):null};
const blind=cid=>{const c=codesFor(cid);return !!(c&&!c.decoded)};

/* رمز التحقق من صحة الصدور */
const VC=new Map();let vcBusy=false;
function vcPayload(k,s){const st=studentStatus(k,s.id);return JSON.stringify([cfg().univ,cfg().year,cfg().term,s.no,s.name,k,(st.rs||[]).map(x=>[x.c.code,x.r.total]),st.label])}
async function computeVC(){if(vcBusy)return;vcBusy=true;let changed=false;
  for(const k of groups())for(const s of groupStudents(k)){const p=vcPayload(k,s);const cur=VC.get(s.id);if(cur&&cur.p===p)continue;const h=(await sha256(p)).slice(0,12).toUpperCase();VC.set(s.id,{p,code:h.slice(0,4)+'-'+h.slice(4,8)+'-'+h.slice(8,12),k});changed=true}
  vcBusy=false;if(changed)sched();}

/* ============ مزامنة Firebase ============ */
const RAW={colleges:new Map(),departments:new Map(),courses:new Map(),students:new Map(),staff:new Map(),staffx:new Map(),kmarks:new Map(),sgrades:new Map(),kroles:new Map(),kreq:new Map()};
const SHIFT_AR={morning:'صباحي',evening:'مسائي'};
const PMAP=[['attendance','att'],['assignment','hw'],['project','proj'],['lab','lab'],['quiz','quiz'],['midterm','mid']];
let rbT=0;function rebuild(){if(rbT)return;rbT=setTimeout(()=>{rbT=0;doRebuild();sched()},40)}
function doRebuild(){
  const d=new Map();RAW.departments.forEach((v,id)=>d.set(id,{id,name:v.name||id,code:id,collegeId:v.collegeId||'',college:(RAW.colleges.get(v.collegeId)||{}).name||''}));S.depts=d;
  const teach=new Map();RAW.staff.forEach((v,id)=>(v.courseIds||[]).forEach(c=>{if(!teach.has(c))teach.set(c,[]);teach.get(c).push(id)}));
  const cs=new Map();RAW.courses.forEach((v,id)=>{const t=teach.get(id)||[];const sem=v.term?String(v.term):(v.semester?String((+v.semester-1)%2+1):'1');
    cs.set(id,{id,code:v.code||id,name:v.nameAr||v.nameEn||v.code||id,nameEn:v.nameEn||'',dept:v.deptId||'',stage:String(v.stage||''),sem,ects:v.ects??null,teacher:t[0]||'',teacher2:t[1]||'',demo:!!v.demo})});S.courses=cs;
  const st=new Map();RAW.students.forEach((v,id)=>{if(!v.deptId)return;st.set(id,{id,no:id,name:v.name||id,dept:v.deptId,stage:String(v.stage||''),shift:SHIFT_AR[v.shift]||v.shift||'',demo:!!v.demo})});S.students=st;
  const sf=new Map();RAW.staff.forEach((v,id)=>{const x=RAW.staffx.get(id)||{};sf.set(id,{id,name:v.name||id,role:v.role||'',title:x.title||ROLE_AR[v.role]||'',dept:v.deptId||'',phone:x.phone||'',relatives:x.relatives||'',unavail:x.unavail||'',coi:!!x.coi,demo:!!v.demo})});S.staff=sf;
  const gm=new Map();new Set([...RAW.kmarks.keys(),...RAW.sgrades.keys()]).forEach(cid=>{const rows={};
    const sg=RAW.sgrades.get(cid);if(sg)sg.forEach((m,sid)=>{const o={};let any=false,t=0;for(const [k,f] of PMAP){const v=num(m[k]);if(v!=null){o['p_'+f]=v;any=true;t+=v}}if(any)o.cw=Math.round(t*100)/100;rows[sid]=o});
    const km=(RAW.kmarks.get(cid)||{}).rows||{};for(const [sid,r] of Object.entries(km)){if(r)rows[sid]={...(rows[sid]||{}),...r}}
    gm.set(cid,{id:cid,rows})});S.grades=gm;
  if(MODE==='fb'&&can('grade'))watchGrades();
}
const UNSUB=[];
function fbSub(path,fn,qf){let ref=FB.collection(FB.db,path);if(qf)ref=qf(ref);UNSUB.push(FB.onSnapshot(ref,fn,err=>{console.warn(path,err);if(err&&err.code==='permission-denied')toast('لا تملك صلاحية قراءة «'+path+'». راجع قواعد Firestore.','bad')}))}
const intoRaw=m=>snap=>{snap.docChanges().forEach(ch=>{if(ch.type==='removed')m.delete(ch.doc.id);else m.set(ch.doc.id,ch.doc.data())});rebuild()};
const intoS=c=>snap=>{snap.docChanges().forEach(ch=>{if(ch.type==='removed')S[c].delete(ch.doc.id);else S[c].set(ch.doc.id,{...ch.doc.data(),id:ch.doc.id})});sched()};
function fbSubscribe(){
  fbSub('colleges',intoRaw(RAW.colleges));fbSub('departments',intoRaw(RAW.departments));fbSub('courses',intoRaw(RAW.courses));fbSub('students',intoRaw(RAW.students));fbSub('staff',intoRaw(RAW.staff));fbSub('k_staffx',intoRaw(RAW.staffx));
  ['halls','exams','slots','envelopes','incidents','meta'].forEach(c=>fbSub(KCOL[c],intoS(c)));
  fbSub('k_audit',intoS('audit'),r=>FB.query(r,FB.orderBy('ts','desc'),FB.limit(500)));
  fbSub('k_appeals',intoS('appeals'));if(can('grade'))fbSub('k_marks',intoRaw(RAW.kmarks));
  if(can('ctrl'))fbSub('k_codes',intoS('codes'));
  if(can('chair')||KGRANT){fbSub('k_roles',intoRaw(RAW.kroles));kreqSubscribe()}
}
let GW={key:'',uns:[]};
function watchGrades(){ // السعي: سجلات التدريسيين في تطبيق الحضور لمواد الفصل الحالي
  const ids=[...S.courses.values()].filter(semOk).map(c=>c.id).sort();const key=ids.join(',');if(key===GW.key)return;
  GW.key=key;GW.uns.forEach(u=>u());GW.uns=[];RAW.sgrades=new Map();
  for(let i=0;i<ids.length;i+=30){const chunk=ids.slice(i,i+30);GW.uns.push(FB.onSnapshot(FB.query(FB.collection(FB.db,'grades'),FB.where('courseId','in',chunk)),snap=>{
    snap.docChanges().forEach(ch=>{const g=ch.doc.data();if(!g.courseId||!g.studentId)return;if(!RAW.sgrades.has(g.courseId))RAW.sgrades.set(g.courseId,new Map());const m=RAW.sgrades.get(g.courseId);if(ch.type==='removed')m.delete(g.studentId);else m.set(g.studentId,g.marks||{})});rebuild()},err=>console.warn('grades',err)))}
}
function fbUnsubscribe(){UNSUB.splice(0).forEach(u=>{try{u()}catch(e){}});GW.uns.forEach(u=>{try{u()}catch(e){}});GW={key:'',uns:[]};
  Object.values(RAW).forEach(m=>m.clear&&m.clear());COLLS.forEach(c=>S[c]=new Map())}
/* الدخول بحسابات تطبيق الحضور نفسها: كلمة مصادقة مشتقة من كلمة المستخدم كما في التطبيق */
async function resolveStaffEmail(authEmail){const e=String(authEmail||'').toLowerCase();if(!e.endsWith('@pw.almaaqal.app'))return e;
  const local=e.split('@')[0];try{const a=await FB.getDoc(FB.doc(FB.db,'usernames',local));const m=a.exists()&&a.data().email;if(m)return String(m).toLowerCase()}catch(x){}return local+'@almaaqal.edu.iq'}
function authErr(e){const c=(e&&e.code)||'';
  if(/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c))return'اسم المستخدم أو كلمة المرور غير صحيحة. إن كان هذا أول دخول لك فعّل حسابك من تطبيق الحضور أولاً ثم ادخل هنا.';
  if(/too-many-requests/.test(c))return'محاولات كثيرة متتالية. انتظر دقيقة ثم أعد المحاولة.';
  if(/network-request-failed/.test(c))return'لا يوجد اتصال بالإنترنت. أول دخول يحتاج اتصالاً، وبعده يعمل النظام دون اتصال.';
  if(/popup-closed|cancelled-popup/.test(c))return'أُغلقت نافذة Google قبل إكمال الدخول.';
  if(/unauthorized-domain/.test(c))return'هذا النطاق غير مضاف في Firebase > Authentication > Settings > Authorized domains.';
  return(e&&e.message)||'تعذر الدخول.'}
async function fbLogin(user,pass){const u=String(user||'').trim().toLowerCase();if(!u||!pass)throw new Error('أدخل اسم المستخدم وكلمة المرور.');
  if(/^\d{6,}$/.test(u))throw new Error('حسابات الطلبة لا تدخل نظام الكنترول.');
  const local=u.includes('@')?u.split('@')[0]:u;
  // حسابات الكنترول المخوّلة (<اسم>@k.almaaqal.app) ثم حسابات تطبيق الحضور (<اسم>@pw.almaaqal.app)
  const doms=local.includes('.')?[KDOM,'@pw.almaaqal.app']:['@pw.almaaqal.app',KDOM];let last=null;
  for(const d of doms){try{await FB.signInWithEmailAndPassword(FB.auth,local+d,await kpw(local+d,pass));return}catch(e){last=e;if(!/invalid-credential|wrong-password|user-not-found|invalid-login/.test(e.code||''))break}}
  throw new Error(authErr(last))}
async function afterLogin(u){
  const ae=String(u.email||'').toLowerCase();
  if(ae.endsWith('@st.almaaqal.app'))throw new Error('حسابات الطلبة لا تدخل نظام الكنترول.');
  const isK=ae.endsWith(KDOM);const google=(u.providerData||[]).some(p=>p.providerId==='google.com');
  const email=isK?ae:await resolveStaffEmail(ae);
  let prof=null;if(!isK){try{const sd=await FB.getDoc(FB.doc(FB.db,'staff',email));prof=sd.exists()?sd.data():null}catch(x){}}
  let kr=null;try{const r=await FB.getDoc(FB.doc(FB.db,'k_roles',email));kr=r.exists()?r.data():null}catch(x){}
  let role='';const top=SUPER_ADMINS.includes(email)||!!(prof&&['admin','president'].includes(prof.role));
  if(top)role='chair';
  else if(kr){
    if(kr.off)throw new Error('تصريح دخولك موقوف. راجع من منحك التصريح.');
    if(kr.until&&kr.until<Date.now())throw new Error('انتهت مدة تصريح دخولك ('+new Date(kr.until).toLocaleDateString('ar-IQ-u-nu-latn')+'). اطلب تجديده.');
    if(isK&&kr.uid!==u.uid)throw new Error('هذا الحساب غير مربوط بتصريحه. راجع رئيس النظام.');
    role=kr.role||'';
  }
  if(!KROLES[role]){
    if(isK)throw new Error('هذا الحساب غير مفعّل في الكنترول. راجع رئيس النظام.');
    if(google||prof)return joinFlow(u,email,prof);
    throw new Error('هذا الحساب غير مسجل في الكادر.');
  }
  KRANK=(!top&&kr&&kr.rank)||'';KGRANT=KRANK in KRANK_CAT?KRANK_CAT[KRANK]:'';
  ME=email;KROLE=role;IS_ADMIN=role==='chair';IS_TOP=top;RO=role==='viewer';
  MEPROF={name:(prof&&prof.name)||(kr&&kr.name)||u.displayName||email,email,role,isK};
  joinStop();MODE='fb';fbSubscribe();showLogin(false);render();
}
function showLogin(on,msg){const L=$('#login');L.hidden=!on;if(on){$('#loginform').hidden=false;const J=$('#joinbox');if(J)J.hidden=true;$('#lg_retry').hidden=true;['#lg_user','#lg_pass','#lg_btn'].forEach(x=>$(x).closest('label,button').hidden=false);$('#lg_err').textContent=msg||'';$('#lg_btn').disabled=false;$('#lg_btn').textContent='دخول';$('#lg_google').hidden=MODE!=='auth';setTimeout(()=>{const x=$('#lg_user');if(x)x.focus()},50)}}
function fbBoot(){FB=window.FBX;MODE='auth';renderNav();
  FB.onAuthStateChanged(FB.auth,async u=>{if(!u){joinStop();if(MODE==='fb'){fbUnsubscribe()}MODE='auth';ME='local';MEPROF=null;renderNav();$('#main').innerHTML='';showLogin(true);return}
    try{await afterLogin(u)}catch(e){try{await FB.signOut(FB.auth)}catch(x){}MODE='auth';showLogin(true,errMsg(e))}});
  $('#loginform').addEventListener('submit',async ev=>{ev.preventDefault();const b=$('#lg_btn');
    const wait=loginWait();if(wait>0){showLogin(true,`محاولات خاطئة متكررة. أعد المحاولة بعد ${Math.ceil(wait/1000)} ثانية.`);return}
    b.disabled=true;b.textContent='جارٍ الدخول…';$('#lg_err').textContent='';
    try{await fbLogin($('#lg_user').value,$('#lg_pass').value);loginFail(true)}catch(e){loginFail(false);showLogin(true,errMsg(e))}});
  $('#lg_google').addEventListener('click',async()=>{$('#lg_err').textContent='';try{await FB.signInWithPopup(FB.auth,new FB.GoogleAuthProvider())}catch(e){showLogin(true,authErr(e))}});
  window.addEventListener('online',renderNav);window.addEventListener('offline',renderNav);
}
/* حماية الجلسة: تأخير متصاعد بعد المحاولات الخاطئة، وإنهاء الجلسة بعد عدم النشاط */
const LF='kontrol.lf';
function lfGet(){try{return JSON.parse(localStorage.getItem(LF)||'{}')}catch(e){return{}}}
function loginWait(){const o=lfGet();return Math.max(0,(o.until||0)-Date.now())}
function loginFail(ok){try{if(ok){localStorage.removeItem(LF);return}const o=lfGet();o.n=(o.n||0)+1;if(o.n>=5)o.until=Date.now()+Math.min(15*60e3,30e3*2**(o.n-5));localStorage.setItem(LF,JSON.stringify(o))}catch(e){}}
let LAST_ACT=Date.now();['pointerdown','keydown','scroll','touchstart'].forEach(ev=>document.addEventListener(ev,()=>{LAST_ACT=Date.now()},{passive:true,capture:true}));
setInterval(()=>{if(MODE!=='fb'||!FB)return;const m=+cfg().idleMin||30;if(Date.now()-LAST_ACT>m*60e3){LAST_ACT=Date.now();FB.signOut(FB.auth).then(()=>showLogin(true,`انتهت الجلسة بعد ${m} دقيقة دون نشاط. سجّل الدخول مجدداً.`)).catch(()=>{})}},30e3);
function fbReady(){return new Promise(r=>{if(window.FBX_DONE)return r();window.addEventListener('fbx-ready',()=>r(),{once:true});setTimeout(r,10000)})}

/* ============ الهوية: الشعار والساعة والوضع الليلي ============ */
let CREST='';let crestN=0;
function fillCrests(root){if(!CREST)return;(root||document).querySelectorAll('[data-crest]:not([data-filled])').forEach(el=>{const n=++crestN;el.innerHTML=CREST.replace(/(crest[A-Za-z]*(?:Grad|Crest|Glow|Shadow)?)/g,'$1_'+n);el.dataset.filled='1'})}
fetch('crest.svg').then(r=>r.ok?r.text():'').then(t=>{CREST=t;fillCrests()}).catch(()=>{});
const AMONTHS=['كانون الثاني','شباط','آذار','نيسان','أيار','حزيران','تموز','آب','أيلول','تشرين الأول','تشرين الثاني','كانون الأول'];
function tickClock(){const el=$('#clock');if(!el)return;
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baghdad',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true,weekday:'long',day:'numeric',month:'numeric',year:'numeric'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
  const wd={Sunday:'الأحد',Monday:'الإثنين',Tuesday:'الثلاثاء',Wednesday:'الأربعاء',Thursday:'الخميس',Friday:'الجمعة',Saturday:'السبت'}[p.weekday]||'';
  const ap=/pm/i.test(p.dayPeriod||'')?'م':'ص';
  el.innerHTML=`<span>توقيت البصرة</span><span class="ap">${ap}</span><span class="t"><i>${p.hour}</i>:<i>${p.minute}</i>:<i>${p.second}</i></span><span class="d">${wd}، ${+p.day} ${AMONTHS[+p.month-1]} ${p.year}</span><span class="z">GMT+3</span>`}
setInterval(tickClock,1000);
function curTheme(){const t=document.documentElement.dataset.theme;if(t)return t;return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
function syncThemeBtn(){const b=$('#themebtn');if(b)b.textContent=curTheme()==='dark'?'الوضع النهاري':'الوضع الليلي'}
document.addEventListener('DOMContentLoaded',()=>{tickClock();syncThemeBtn();fillCrests();const b=$('#themebtn');if(b)b.addEventListener('click',()=>{const n=curTheme()==='dark'?'light':'dark';document.documentElement.dataset.theme=n;try{localStorage.setItem('kontrol.theme',n)}catch(e){}syncThemeBtn()})});

/* ============ الحالة والواجهة ============ */
const UI={view:'dash',q:'',fd:'',fs:'',slot:'',hall:'',course:'',gtab:'cw',group:'',cdel:'',stcourse:'',ai:'',aiBusy:false,vq:'',vres:null,gracePrev:null};
const DRAFT={};
const VIEWS=[
  ['التخطيط',[['dash','لوحة القيادة'],['depts','الكليات والأقسام'],['students','الطلبة والأهلية'],['courses','المواد الدراسية'],['halls','القاعات'],['staff','الكادر وتعارض المصالح'],['exams','الجدول الامتحاني']]],
  ['يوم الامتحان',[['seating','توزيع المقاعد'],['duties','اللجان والمراقبون'],['envelopes','أظرف الأسئلة'],['attendance','الحضور والغياب'],['incidents','محاضر الغش']]],
  ['الكنترول',[['coding','التشفير والأرقام السرية'],['grading','رصد الدرجات'],['grace','الرأفة الآلية'],['master','الماستر شيت والنتائج'],['stats','التحليل الإحصائي'],['appeals','الاعتراضات']]],
  ['الحوكمة',[['audit','سجل التدقيق'],['integrity','فحص سلامة البيانات'],['demo','البيانات التجريبية'],['verify','التحقق من الصدور'],['roles','تصاريح الدخول'],['settings','الإعدادات والبيانات']]],
];
const VALID=new Set(VIEWS.flatMap(g=>g[1].map(x=>x[0])));
const ROLE_VIEWS={
  viewer:['dash','students','courses','halls','staff','exams','seating','duties','master','stats','integrity','verify'],
  invigilator:['dash','exams','halls','seating','duties','envelopes','attendance','incidents','verify'],
  auditor:['dash','students','courses','exams','grading','master','stats','appeals','integrity','verify'],
};
function viewOk(k){if(k==='roles')return MODE==='fb'&&(can('chair')||!!KGRANT);if(MODE!=='fb')return true;const l=ROLE_VIEWS[KROLE];return !l||l.includes(k)}
let rq=false,deferred=false;
function sched(){TICK++;if(rq)return;rq=true;requestAnimationFrame(()=>{rq=false;render()})}
function editing(){const a=document.activeElement;return a&&$('#main').contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&a.type!=='checkbox'&&a.type!=='button'}
document.addEventListener('focusout',()=>{if(deferred){deferred=false;setTimeout(sched,0)}});
function toast(m,k){const t=document.createElement('div');t.className='toast'+(k?' '+k:'');t.textContent=m;$('#toasts').appendChild(t);setTimeout(()=>t.remove(),k==='bad'?6000:3200)}
function errMsg(e){if(!e)return'تعذر تنفيذ العملية.';if(e.code==='permission-denied')return'رفض الخادم العملية: دورك في الكنترول لا يسمح بها.';if(e.code==='unavailable')return'لا يوجد اتصال الآن؛ ستُزامَن التعديلات عند عودة الشبكة.';if(e.code==='invalid_argument')return'رُفضت الكتابة: ليست لديك صلاحية التعديل على هذه البيانات.';if(e.code==='quota_exceeded')return'امتلأت سعة قاعدة البيانات. احذف سجلات قديمة ثم أعد المحاولة.';return e.message||String(e)}

function counts(){
  const mis=arr('grades').reduce((a,g)=>a+Object.values(g.rows||{}).filter(r=>finalOf(r).mismatch).length,0);
  const inc=arr('incidents').filter(x=>x.status!=='صدر القرار').length;
  const ap=apList().filter(apOpen).length;
  return {grading:mis,incidents:inc,appeals:ap,roles:MODE==='fb'?kreqPending().length:0};
}
function renderNav(){
  const c=counts();
  $('#nav').innerHTML=(MODE==='auth'||MODE==='down')?'':VIEWS.map(([g,items])=>[g,items.filter(([k])=>viewOk(k))]).filter(([,items])=>items.length).map(([g,items])=>`<div class="grp">${g}</div>`+items.map(([k,l])=>`<a href="#${k}" class="${UI.view===k?'on':''}" data-nav="${k}">${l}${c[k]?`<span class="badge ${k==='appeals'?'am':''}">${c[k]}</span>`:''}</a>`).join('')).join('');
  
  const me=$('#me');if(me){me.hidden=!(MODE==='fb'&&MEPROF);if(MEPROF)me.innerHTML=`<b>${esc(MEPROF.name)}</b><span class="mut">${esc(KRANKS[KRANK]||KROLES[KROLE]||'')}</span>${MEPROF.isK?'<button class="btn sm" data-act="kpass">تغيير كلمة المرور</button>':''}<button class="btn sm" data-act="logout">تسجيل الخروج</button>`}
  $('#mode').innerHTML=MODE==='fb'?(navigator.onLine?`<span class="dot on"></span>متصل بقاعدة Firebase${RO?' · اطلاع فقط':''}`:`<span class="dot loc"></span>دون اتصال — التعديلات تُحفظ وتُزامَن لاحقاً`):MODE==='auth'?`<span class="dot"></span>بانتظار تسجيل الدخول`:MODE==='down'?`<span class="dot"></span>تعذر الاتصال بقاعدة البيانات`:MODE==='cloud'?`<span class="dot on"></span>متصل — بيانات مشتركة${RO?' · اطلاع فقط':''}`:MODE==='local'?`<span class="dot loc"></span>وضع محلي على هذا الجهاز`:`<span class="dot"></span>جارٍ الاتصال…`;
}
function render(){
  if(editing()){deferred=true;return}
  renderNav();
  if(MODE==='boot'||MODE==='auth'||MODE==='down')return;
  if(!viewOk(UI.view))UI.view='dash';
  const v=VIEW[UI.view]||VIEW.dash;
  let h;try{h=v()}catch(e){console.error(e);h=`<div class="alert bad">تعذر عرض هذه الصفحة: ${esc(e.message)}</div>`}
  $('#main').innerHTML=h;fillCrests($('#main'));
  if(UI.view==='master'||UI.view==='verify')computeVC();
  if(UI.view==='audit')resolveNames();
}
const GTAG={'التخطيط':'PLANNING','يوم الامتحان':'EXAM DAY','الكنترول':'CONTROL','الحوكمة':'GOVERNANCE'};
function eyebrow(){const gi=VIEWS.findIndex(g=>g[1].some(x=>x[0]===UI.view));if(gi<0)return'';const g=VIEWS[gi];return `<div class="eyebrow"><span class="tag ${['','t2','t3','t4'][gi]||''}">0${gi+1}. ${GTAG[g[0]]||''}</span>${esc(g[0])}</div>`}
const ph=(t,p,act='')=>`<div class="ph"><div>${eyebrow()}<h2>${t}</h2>${p?`<p>${p}</p>`:''}</div><div class="row">${act}</div></div>`;
const opt=(v,l,sel)=>`<option value="${esc(v)}"${String(v)===String(sel)?' selected':''}>${esc(l)}</option>`;
const empty=(t,p,a='')=>`<div class="card empty"><b>${t}</b>${p}${a?`<div class="row" style="justify-content:center;margin-top:12px">${a}</div>`:''}</div>`;
const roBtn=()=>RO?' disabled':'';

/* ============ المخططات العامة (CRUD) ============ */
const SCHEMA={
  depts:{t:'الكليات والأقسام',one:'قسم',p:'كليات وأقسام جامعة المعقل الدولية التي تعقد امتحاناتها عبر هذا الكنترول.',f:[{k:'name',l:'اسم القسم',req:1},{k:'college',l:'الكلية'},{k:'code',l:'الرمز المختصر'}],cols:['college','name','code']},
  students:{t:'الطلبة والأهلية',one:'طالب',p:'سجل الطلبة حسب القسم والمرحلة والدوام، بالرقم المعرفي. يُستبعد المحروم من التوزيع والرصد تلقائياً (يُحدد الحرمان من صفحة الرصد ← السعي).',f:[{k:'no',l:'الرقم المعرفي',req:1,mono:1},{k:'name',l:'الاسم الرباعي واللقب',req:1},{k:'dept',l:'القسم',type:'ref',ref:'depts',req:1},{k:'stage',l:'المرحلة',type:'stage',req:1},{k:'shift',l:'الدوام',type:'sel',o:['صباحي','مسائي']}],cols:['no','name','dept','stage','shift']},
  courses:{t:'المواد الدراسية',one:'مادة',p:'الخطة الدراسية بالرمز والفصل وأستاذ المادة. تظهر في الرصد والنتائج مواد الفصل الحالي فقط (يُحدد من الإعدادات)، ولا يُكلف أستاذ المادة بمراقبة جلستها.',f:[{k:'code',l:'رمز المقرر',req:1,mono:1},{k:'name',l:'اسم المادة',req:1},{k:'nameEn',l:'الاسم بالإنجليزية'},{k:'dept',l:'القسم',type:'ref',ref:'depts',req:1},{k:'stage',l:'المرحلة',type:'stage',req:1},{k:'sem',l:'فصل السنة',type:'sel',o:[['1','الأول'],['2','الثاني']]},{k:'ects',l:'ECTS',type:'num'},{k:'teacher',l:'أستاذ المادة',type:'ref',ref:'staff'},{k:'teacher2',l:'أستاذ مشارك',type:'ref',ref:'staff'}],cols:['code','name','dept','stage','sem','teacher','ects']},
  halls:{t:'القاعات',one:'قاعة',p:'السعة = الصفوف × الأعمدة. عدد المراقبين المطلوب لكل قاعة يحدد توزيع اللجان.',f:[{k:'name',l:'اسم القاعة',req:1},{k:'building',l:'البناية/الطابق'},{k:'rows',l:'عدد الصفوف',type:'num',req:1},{k:'cols',l:'عدد الأعمدة',type:'num',req:1},{k:'inv',l:'المراقبون المطلوبون',type:'num',req:1}],cols:['name','building','rows','cols','cap','inv']},
  staff:{t:'الكادر وتعارض المصالح',one:'عضو',p:'يُستبعد العضو آلياً من مراقبة أي قاعة يجلس فيها قريب له حتى الدرجة الرابعة، ومن الأيام التي أعلن عدم توفره فيها.',f:[{k:'name',l:'الاسم',req:1},{k:'title',l:'اللقب العلمي/الوظيفي',type:'sel',o:TITLES},{k:'dept',l:'القسم',type:'ref',ref:'depts'},{k:'phone',l:'الهاتف'},{k:'relatives',l:'الأرقام الامتحانية لأقاربه (إن وجدوا)',mono:1},{k:'unavail',l:'تواريخ عدم التوفر (YYYY-MM-DD مفصولة بفاصلة)',mono:1},{k:'coi',l:'وقّع إقرار تعارض المصالح',type:'bool'}],cols:['name','title','dept','duties','relatives','coi']},
  exams:{t:'الجدول الامتحاني',one:'امتحان',p:'كل امتحان يحدد تاريخاً وجلسة ونوعاً. المواد التي تقع في الجلسة نفسها تُخلط في القاعات بتناوب الأعمدة. «التسليم» يظهر في المواعيد ولا يحتاج قاعات.',f:[{k:'course',l:'المادة',type:'ref',ref:'courses',req:1},{k:'kind',l:'النوع',type:'sel',o:['نهائي','فصلي','اختبار','تسليم']},{k:'note',l:'التفاصيل'},{k:'date',l:'التاريخ',type:'date',req:1},{k:'period',l:'الجلسة',type:'sel',o:[['1','الأولى'],['2','الثانية']],req:1},{k:'dur',l:'المدة (دقيقة)',type:'num'}],cols:['course','kind','group','date','period','n']},
  incidents:{t:'محاضر الغش',one:'محضر',p:'سلطة اللجنة الامتحانية في الغش تقتصر على التوثيق والتحريز والإحالة؛ القرار لمجلس الكلية بعد لجنة الانضباط.',f:[{k:'student',l:'الطالب',type:'ref',ref:'students',req:1},{k:'exam',l:'الامتحان',type:'ref',ref:'exams',req:1},{k:'hall',l:'القاعة',type:'ref',ref:'halls'},{k:'time',l:'وقت الواقعة',type:'time'},{k:'tool',l:'أداة الغش المحرزة',type:'sel',o:['هاتف محمول','سماعة لاسلكية','مسودة/ورقة','ساعة ذكية','كتابة على اليد/الطاولة','انتحال شخصية','أخرى']},{k:'desc',l:'وصف الواقعة',type:'area',req:1},{k:'witnesses',l:'الشهود (المراقبون)'},{k:'statement',l:'هل أُخذت إفادة الطالب الخطية؟',type:'bool'},{k:'status',l:'المرحلة',type:'sel',o:['موثق','محال إلى العميد','لدى لجنة الانضباط','صدر القرار']},{k:'decision',l:'القرار (بعد صدوره)'}],cols:[]},
  appeals:{t:'الاعتراضات',one:'اعتراض',p:'',f:[{k:'student',l:'الطالب',type:'ref',ref:'students',req:1},{k:'course',l:'المادة',type:'ref',ref:'courses',req:1},{k:'reason',l:'سبب الاعتراض',type:'area',req:1},{k:'status',l:'الحالة',type:'sel',o:['جديد','قيد التدقيق','مقبول — عُدلت الدرجة','مرفوض — الدرجة صحيحة']},{k:'newFin',l:'الدرجة النهائية بعد التدقيق (عند القبول)',type:'num'},{k:'note',l:'تقرير لجنة التدقيق'}],cols:[]},
};
function cellVal(c,k,r){
  const v=r[k];
  if(k==='dept')return esc(label.depts(S.depts.get(v)));
  if(k==='teacher')return esc(label.staff(S.staff.get(v)));
  if(k==='course')return esc(label.courses(S.courses.get(v)));
  if(k==='stage')return esc(STAGES[(+v)-1]||v);
  if(k==='cap')return (+r.rows||0)*(+r.cols||0);
  if(k==='period')return v==2?'الثانية':'الأولى';
  if(k==='sem')return v==2?'الثاني':v==1?'الأول':'—';
  if(k==='kind'){const kk=v||'نهائي';return `<span class="pill ${kk==='نهائي'?'acc':kk==='تسليم'?'':'warn'}">${esc(kk)}</span>`+(r.note?` <span class="mut">${esc(r.note)}</span>`:'')}
  if(k==='coi')return v?'<span class="pill ok">موقّع</span>':'<span class="pill warn">غير موقّع</span>';
  if(k==='relatives')return v?`<span class="mono">${esc(v)}</span>`:'<span class="mut">—</span>';
  if(k==='duties'){let n=0;arr('slots').forEach(s=>(s.duties||[]).forEach(d=>{if(d.staff.includes(r.id))n++}));return n}
  if(k==='group'){const cc=S.courses.get(r.course);return cc?esc(groupName(groupKey(cc.dept,cc.stage))):'—'}
  if(k==='n'){const e=r;return examStudents(e).length}
  if(k==='date')return esc(v)+` <span class="mut">${dayName(v)}</span>`;
  if(k==='no'||k==='code')return `<span class="mono">${esc(v)}</span>`;
  return esc(v);
}
const COLL={college:'الكلية',sem:'الفصل',ects:'ECTS',kind:'النوع',name:'الاسم',code:'الرمز',no:'الرقم المعرفي',dept:'القسم',stage:'المرحلة',shift:'الدراسة',teacher:'الأستاذ',units:'الوحدات',building:'الموقع',rows:'صفوف',cols:'أعمدة',cap:'السعة',inv:'مراقبون',title:'اللقب',duties:'واجبات المراقبة',relatives:'أقارب طلبة',coi:'الإقرار',course:'المادة',group:'القسم/المرحلة',date:'التاريخ',period:'الجلسة',dur:'المدة',n:'الطلبة المؤهلون'};
function listRows(c){
  const sc=SCHEMA[c];let rows=arr(c);
  const hasDept=sc.f.some(f=>f.k==='dept'),hasStage=sc.f.some(f=>f.k==='stage');
  if(UI.fd&&hasDept)rows=rows.filter(r=>r.dept===UI.fd);
  if(UI.fs&&hasStage)rows=rows.filter(r=>String(r.stage)===UI.fs);
  if(UI.q){const q=UI.q.trim();rows=rows.filter(r=>Object.values(r).some(v=>String(v).includes(q)))}
  if(c==='students')rows.sort(byNo);else if(c==='depts')rows.sort((a,b)=>String(a.college||'ي').localeCompare(String(b.college||'ي'),'ar')||String(a.name).localeCompare(String(b.name),'ar'));else if(c==='exams')rows.sort((a,b)=>slotKey(a)<slotKey(b)?-1:1);else rows.sort((a,b)=>String(a.name||a.code||'').localeCompare(String(b.name||b.code||''),'ar'));
  return rows}
function listView(c,extraTop=''){
  const sc=SCHEMA[c];const rows=listRows(c);
  const hasDept=sc.f.some(f=>f.k==='dept'),hasStage=sc.f.some(f=>f.k==='stage');
  const fbShared=MODE==='fb'&&(SHARED_RO.has(c)||c==='staff');
  const act=fbShared?'':`${c==='students'||c==='courses'?`<label class="btn"${RO?' style="opacity:.45"':''}>استيراد ملف Excel<input type="file" id="xlsxin2" accept=".xlsx,.xls,.csv" multiple hidden${roBtn()}></label>`:''}${c==='students'?`<button class="btn" data-act="import"${roBtn()}>لصق قائمة</button>`:''}<button class="btn pri" data-act="new" data-c="${c}"${roBtn()}>إضافة ${sc.one}</button>`;
  const filt=`<div class="row" style="margin-bottom:12px"><input type="search" id="q" placeholder="بحث…" value="${esc(UI.q)}" data-ui="q" style="width:200px">${hasDept?`<select id="fd" data-ui="fd">${opt('','كل الأقسام',UI.fd)}${arr('depts').map(d=>opt(d.id,d.name,UI.fd)).join('')}</select>`:''}${hasStage?`<select id="fs" data-ui="fs">${opt('','كل المراحل',UI.fs)}${STAGES.map((s,i)=>opt(String(i+1),'المرحلة '+s,UI.fs)).join('')}</select>`:''}<span class="mut">${rows.length} سجل</span>${sc.cols.length&&rows.length?`<span class="row" style="margin-inline-start:auto">${expBtns('lexp',c)}</span>`:''}</div>`;
  const body=rows.length?`<div class="tw"><table><thead><tr>${sc.cols.map(k=>`<th>${COLL[k]||k}</th>`).join('')}<th></th></tr></thead><tbody>${rows.map(r=>`<tr>${sc.cols.map(k=>`<td>${cellVal(c,k,r)}</td>`).join('')}<td>${r.demo?'<span class="pill warn">تجريبي</span> ':''}${rowBtns(c,r.id)}</td></tr>`).join('')}</tbody></table></div>`:empty('لا توجد سجلات بعد',`أضف ${sc.one} من الزر في الأعلى${c==='students'?'، أو الصق قائمة من Excel عبر «استيراد»':''}.`);
  return ph(sc.t,sc.p,act)+(MODE==='fb'&&SHARED_RO.has(c)?'<div class="note" style="margin-bottom:12px">تُدار هذه البيانات من لوحة إدارة نظام الحضور (ومنها رفع ملفات Excel)، وتظهر هنا تلقائياً ولحظياً.</div>':'')+extraTop+filt+body;
}
function rowBtns(c,id){if(RO)return'';if(MODE==='fb'&&SHARED_RO.has(c))return'';if(MODE==='fb'&&c==='staff')return can('ctrl')?`<button class="btn sm" data-act="edit" data-c="staff" data-id="${esc(id)}">تعديل</button>`:'';
  if(MODE==='fb'&&!can('ctrl')&&c!=='incidents')return'';const k=c+':'+id;return `<div class="row" style="flex-wrap:nowrap"><button class="btn sm" data-act="edit" data-c="${c}" data-id="${id}">تعديل</button>${UI.cdel===k?`<button class="btn sm bad" data-act="del" data-c="${c}" data-id="${id}">تأكيد الحذف</button>`:`<button class="btn sm" data-act="askdel" data-k="${k}">حذف</button>`}</div>`}
function fieldHtml(f,v){
  const id='f_'+f.k;const req=f.req?' required':'';
  if(f.type==='ref'){const list=arr(f.ref).sort((a,b)=>f.ref==='students'?byNo(a,b):String(label[f.ref](a)).localeCompare(String(label[f.ref](b)),'ar'));return `<select id="${id}" name="${f.k}"${req}>${opt('','— اختر —',v)}${list.map(x=>opt(x.id,label[f.ref](x),v)).join('')}</select>`}
  if(f.type==='stage')return `<select id="${id}" name="${f.k}"${req}>${opt('','— اختر —',v)}${STAGES.map((s,i)=>opt(String(i+1),s,v)).join('')}</select>`;
  if(f.type==='sel')return `<select id="${id}" name="${f.k}"${req}>${f.o.map(o=>Array.isArray(o)?opt(o[0],o[1],v??f.o[0][0]):opt(o,o,v??f.o[0])).join('')}</select>`;
  if(f.type==='bool')return `<span><input type="checkbox" id="${id}" name="${f.k}"${v?' checked':''}> نعم</span>`;
  if(f.type==='area')return `<textarea id="${id}" name="${f.k}"${req}>${esc(v)}</textarea>`;
  const t=f.type==='num'?'number':f.type==='date'?'date':f.type==='time'?'time':'text';
  return `<input type="${t}" id="${id}" name="${f.k}" value="${esc(v)}"${req}${f.type==='num'?' step="any"':''}${f.mono?' class="mono"':''}>`;
}
function openForm(c,id,preset){
  let sc=SCHEMA[c];if(MODE==='fb'&&SHARED_RO.has(c))throw new Error(SHARED_MSG);
  if(MODE==='fb'&&c==='staff')sc={...sc,f:sc.f.filter(f=>['title','phone','relatives','unavail','coi'].includes(f.k))};const r=id?S[c].get(id)||{}:(preset||{});
  $('#modal').innerHTML=`<form class="dlg" data-form="${c}" data-id="${id||''}"><h3>${id?'تعديل':'إضافة'} ${sc.one}</h3><div class="fgrid">${sc.f.map(f=>`<label class="f" ${f.type==='area'?'style="grid-column:1/-1"':''}>${f.l}${f.req?' *':''}${fieldHtml(f,r[f.k])}</label>`).join('')}</div><div class="row" style="margin-top:16px;justify-content:flex-start"><button class="btn pri" type="submit">حفظ</button><button class="btn" type="button" data-act="close">إلغاء</button></div><p class="mut" id="ferr" style="margin:8px 0 0"></p></form>`;
  $('#modal').hidden=false;const first=$('#modal input,#modal select,#modal textarea');if(first)first.focus();
}
async function submitForm(form){
  const c=form.dataset.form,id=form.dataset.id||rid();
  if(c==='settings')return saveSettings(form);
  if(c==='apnew')return apCreate(form);
  if(c==='apstep')return apStep(form);
  if(c==='import')return doImport(form);
  const sc=MODE==='fb'&&c==='staff'?{...SCHEMA.staff,f:SCHEMA.staff.f.filter(f=>['title','phone','relatives','unavail','coi'].includes(f.k))}:SCHEMA[c];const old=S[c].get(id)||{};const d={...strip(old)};
  for(const f of sc.f){const el=form.elements[f.k];if(!el)continue;let v=f.type==='bool'?el.checked:el.value.trim();if(f.type==='num')v=num(v);d[f.k]=v}
  if(c==='students'&&arr('students').some(s=>s.id!==id&&String(s.no)===String(d.no))){$('#ferr').textContent='هذا الرقم الامتحاني مستخدم لطالب آخر.';return}
  if(c==='incidents'&&!old.at)d.at=Date.now();
  if(c==='appeals'){if(!old.at)d.at=Date.now();if(d.status!==old.status)d.statusAt=Date.now();if(!d.status)d.status='جديد'}
  if(c==='incidents'&&!d.status)d.status='موثق';
  await put(c,id,d);
  if(c==='appeals'&&d.status==='مقبول — عُدلت الدرجة'&&d.newFin!=null){await patch('grades',d.course,{rows:{[d.student]:{appealFin:d.newFin}}});await log('تعديل درجة باعتراض',`${label.students(S.students.get(d.student))} · ${label.courses(S.courses.get(d.course))} → ${d.newFin}`)}
  await log(old.id?'تعديل':'إضافة',`${sc.one}: ${c==='students'?d.no+' '+d.name:c==='exams'?label.exams(d):c==='incidents'||c==='appeals'?label.students(S.students.get(d.student)):d.name||d.code||id}`);
  closeModal();toast('حُفظ '+sc.one);
}
function closeModal(){$('#modal').hidden=true;$('#modal').innerHTML=''}

/* ============ الصفحات ============ */
const VIEW={};
VIEW.depts=()=>{
  const fbm=MODE==='fb';let ops;
  if(fbm)ops=planStructure(RAW.colleges,RAW.departments);
  else{const dm=new Map(arr('depts').map(d=>[d.id,{name:d.name,collegeId:d.college?'x':''}]));ops=planStructure(new Map(),dm).filter(o=>o.c==='departments')}
  const allowed=fbm?IS_TOP:!RO;
  const nNew=ops.filter(o=>!o.link).length,nLink=ops.filter(o=>o.link).length;
  const groups=new Map();arr('depts').forEach(d=>{const k=d.college||'بلا كلية';if(!groups.has(k))groups.set(k,0);groups.set(k,groups.get(k)+1)});
  const card=`<div class="card" style="margin-bottom:14px"><h3>هيكل جامعة المعقل الدولية</h3><p class="mut" style="margin-top:0">${UNIV_STRUCT.length} كليات و${UNIV_STRUCT.reduce((a,c)=>a+c.d.length,0)} قسماً وفق مواقع الجامعة. ${ops.length?`ينقص قاعدة البيانات <b>${nNew}</b> سجل جديد${nLink?` و<b>${nLink}</b> ربط قسم موجود بكليته`:''}. المزامنة تضيف الناقص فقط، ولا تعدّل اسم أو رمز أي قسم موجود.`:'كل الكليات والأقسام موجودة في قاعدة البيانات.'}</p>
  ${groups.size?`<div class="row" style="margin-bottom:10px">${[...groups].map(([k,n])=>`<span class="pill">${esc(k)} · ${n}</span>`).join('')}</div>`:''}
  ${ops.length?`<details style="margin-bottom:10px"><summary class="mut">عرض ما سيُضاف</summary><ul>${ops.map(o=>`<li>${o.c==='colleges'?'كلية: ':o.link?'ربط: ':'قسم: '}${esc(o.label)}</li>`).join('')}</ul></details><button class="btn pri" data-act="syncstruct"${allowed?'':' disabled'}>مزامنة هيكل الجامعة</button>${allowed?'':` <span class="mut">${fbm?'لمدير النظام أو رئيس الجامعة (صلاحية الكتابة في هيكل الجامعة).':'للاطلاع فقط.'}</span>`}`:''}</div>`;
  return listView('depts',card)};
VIEW.halls=()=>listView('halls');
VIEW.courses=()=>listView('courses');
VIEW.staff=()=>{const n=arr('staff').filter(p=>!p.coi).length;return listView('staff',n?`<div class="alert" style="margin-bottom:12px">${n} من أعضاء الكادر لم يوقّعوا إقرار تعارض المصالح بعد.${cfg().requireCoi?' هؤلاء مستبعدون من المراقبة وفق الإعدادات.':''}</div>`:'')};
VIEW.students=()=>listView('students');
VIEW.exams=()=>{
  const warn=[];const seen=new Map();
  for(const e of arr('exams')){const c=S.courses.get(e.course);if(!c)continue;const k=slotKey(e)+'#'+groupKey(c.dept,c.stage);if(seen.has(k))warn.push(`تعارض: ${groupName(groupKey(c.dept,c.stage))} لديها امتحانان في ${e.date} الجلسة ${e.period}: ${S.courses.get(seen.get(k)).name} و${c.name}`);else seen.set(k,c.id)}
  const counts=new Map();arr('exams').forEach(e=>counts.set(e.course,(counts.get(e.course)||0)+1));counts.forEach((n,cid)=>{if(n>1)warn.push(`المادة ${label.courses(S.courses.get(cid))} مجدولة ${n} مرات.`)});
  const caps=arr('halls').reduce((a,h)=>a+(+h.rows)*(+h.cols),0);
  slotList().forEach(s=>{const n=s.exams.reduce((a,e)=>a+examStudents(e).length,0);if(n>caps)warn.push(`${slotName(s)}: ${n} طالباً يتجاوزون سعة كل القاعات (${caps}).`)});
  const noExam=arr('courses').filter(c=>!examOf(c.id));
  const top=(warn.length?warn.map(w=>`<div class="alert bad" style="margin-bottom:6px">${esc(w)}</div>`).join(''):`<div class="alert ok" style="margin-bottom:8px">لا تعارض في الجدول: لا توجد مرحلة بامتحانين في جلسة واحدة، والسعة كافية لكل جلسة.</div>`)+(noExam.length?`<div class="note" style="margin-bottom:12px">مواد بلا موعد امتحان: ${noExam.map(c=>esc(c.name)).join('، ')}</div>`:'');
  return listView('exams',top);
};

VIEW.dash=()=>{
  const st=cfg(),slots=slotList(),sl=arr('slots');
  if(MODE==='fb'&&!arr('students').length&&!arr('courses').length)return ph('لوحة القيادة',`${st.univ} · ${st.college}`)+empty('لا توجد بيانات بعد','الأقسام والمواد والطلبة والكادر تُقرأ من نظام الحضور. ارفعها من لوحة الإدارة فيه، أو انتظر لحظات إن كان الاتصال بطيئاً.');
  if(!arr('students').length&&!arr('courses').length)return ph('لوحة القيادة',`${st.univ} · ${st.college}`)+empty('سجلات الكنترول فارغة','ابدأ بإضافة الأقسام ثم الطلبة والمواد والقاعات، أو حمّل بيانات تجريبية لاستكشاف النظام كاملاً (تُعلَّم كأمثلة ويمكن مسحها من الإعدادات).',`<button class="btn pri" data-act="sample"${roBtn()}>تحميل بيانات تجريبية</button><a class="btn" href="#depts">إضافة قسم</a>`);
  const seated=slots.filter(s=>(S.slots.get(s.key)||{}).seats?.length).length;
  const dut=slots.filter(s=>(S.slots.get(s.key)||{}).duties?.length).length;
  const ex=arr('exams');const coded=ex.filter(e=>S.codes.get(e.id)).length;const opened=ex.filter(e=>(S.envelopes.get(e.id)||{}).open).length;
  const cs=arr('courses');let gDone=0,mis=0;cs.forEach(c=>{const st2=courseStudents(c);const rr=st2.map(s=>res(c.id,s.id));if(st2.length&&rr.every(r=>r.state!=='pending'))gDone++;mis+=rr.filter(r=>r.mismatch).length});
  const gs=groups();const locked=gs.filter(isLocked).length;
  const steps=[['توزيع المقاعد',seated,slots.length,'seating'],['تكليف المراقبين',dut,slots.length,'duties'],['أظرف فُتحت أصولياً',opened,ex.length,'envelopes'],['تشفير الدفاتر',coded,ex.length,'coding'],['رصد مكتمل ومدقق',gDone,cs.length,'grading'],['نتائج مصادق عليها',locked,gs.length,'master']];
  const alerts=[];
  if(mis)alerts.push(['bad',`${mis} درجة يختلف فيها الإدخال الأول عن الثاني وتنتظر الحسم.`,'grading']);
  const inc=arr('incidents').filter(x=>x.status!=='صدر القرار');if(inc.length)alerts.push(['bad',`${inc.length} محضر غش مفتوح لم يصدر فيه قرار.`,'incidents']);
  const now=Date.now();const apl=apList();const late=apl.filter(a=>apLate(a,now));if(late.length)alerts.push(['bad',`${late.length} اعتراض تجاوز مهلة ${st.appealHours} ساعة دون قرار.`,'appeals']);
  const soon=apl.filter(a=>apOpen(a)&&!apLate(a,now)&&apDue(a)-now<12*36e5);if(soon.length)alerts.push(['',`${soon.length} اعتراض تنتهي مهلته خلال 12 ساعة.`,'appeals']);
  const wait=apl.filter(a=>a.st==='decision');if(wait.length&&can('chair'))alerts.push(['',`${wait.length} اعتراض بانتظار قرارك.`,'appeals']);
  const crit=integrityScan().filter(x=>x.sev==='bad').reduce((a,x)=>a+x.items.length,0);if(crit)alerts.push(['bad',`${crit} مشكلة حرجة في سلامة البيانات (تكرار أو درجات خارج المدى).`,'integrity']);
  {const n=kreqPending().length;if(n)alerts.push(['',`${n} طلب انضمام ينتظر الموافقة.`,'roles'])}
  if(demoMeta())alerts.push(['',`النظام يحوي بيانات تجريبية (${(demoMeta().students||[]).length} طالباً). احذفها قبل الامتحانات الفعلية.`,'demo']);
  if(can('chair')&&MODE!=='cloud'){const b=S.meta.get('backup');if(!b||now-b.at>7*864e5)alerts.push(['',b?`آخر نسخة احتياطية قبل ${Math.floor((now-b.at)/864e5)} يوماً.`:'لم تُنزَّل نسخة احتياطية بعد.','settings'])}
  const noCoi=arr('staff').filter(p=>!p.coi).length;if(noCoi)alerts.push(['',`${noCoi} من الكادر بلا إقرار تعارض مصالح.`,'staff']);
  sl.forEach(s=>{if(s.dwarn&&s.dwarn.length)alerts.push(['',`نقص مراقبين: ${s.dwarn.join('، ')}`,'duties'])});
  const up=slots.filter(s=>s.date>=new Date().toISOString().slice(0,10)).slice(0,5);
  const upList=(up.length?up:slots.slice(0,5)).map(s=>{const d=S.slots.get(s.key)||{};const n=s.exams.reduce((a,e)=>a+examStudents(e).length,0);return `<tr><td>${esc(slotName(s))}</td><td class="wrap">${s.exams.map(e=>esc((S.courses.get(e.course)||{}).name)).join('، ')}</td><td>${n}</td><td>${d.seats?.length?'<span class="pill ok">المقاعد</span>':'<span class="pill warn">المقاعد</span>'} ${d.duties?.length?'<span class="pill ok">المراقبون</span>':'<span class="pill warn">المراقبون</span>'}</td></tr>`}).join('');
  const nextS=up[0]||slots[0];
  const hero=`<section class="hero"><div class="hero-in"><div class="crest" data-crest></div><div class="txt"><span class="pillgold"><i></i>${esc(st.college)} · ${esc(st.term)} · ${esc(st.year)}</span><h2>${esc(st.univ)}</h2><h3>نظام الكنترول وإدارة اللجان الامتحانية</h3><p>منظومة متكاملة تدير الامتحانات من الجدول وتوزيع المقاعد والمراقبين، إلى التشفير والرصد المزدوج والرأفة، حتى المصادقة ونشر النتائج للطلبة.</p><div class="chips"><span>Al-Maaqal International University · Basra</span><span>Examination Control System</span></div></div>
    <div class="status"><h4>حالة النظام الآن</h4><div><span class="${MODE==='fb'?(navigator.onLine?'ok':'wn'):'wn'}">قاعدة البيانات</span><em>${MODE==='fb'?(navigator.onLine?'متصلة':'دون اتصال'):MODE==='cloud'?'مشتركة':'محلية'}</em></div><div><span class="ok">الطلبة</span><em>${arr('students').length}</em></div><div><span class="ok">المواد (الفصل الحالي)</span><em>${arr('courses').filter(semOk).length}</em></div><div><span class="${mis?'wn':'ok'}">تعارضات الرصد</span><em>${mis}</em></div>${MEPROF?`<div><span class="ok">دورك</span><em>${esc(KROLES[KROLE]||'')}</em></div>`:''}${nextS?`<div><span class="wn">أقرب جلسة</span><em>${esc(nextS.date)}</em></div>`:''}</div></div></section>`;
  return hero+ph('لوحة القيادة',`${esc(st.univ)} · ${esc(st.college)} · ${esc(st.term)} ${esc(st.year)}`)+
  `<div class="grid g4" style="margin-bottom:14px">${[[arr('students').length,'طالباً مسجلاً'],[cs.length,'مادة امتحانية'],[slots.length,'جلسة امتحانية'],[arr('halls').length,'قاعة · سعة '+arr('halls').reduce((a,h)=>a+(+h.rows)*(+h.cols),0)],[arr('staff').length,'عضواً في الكادر'],[apList().filter(apOpen).length,'اعتراضاً مفتوحاً']].map(([n,l])=>`<div class="card kpi"><b>${n}</b><span>${l}</span></div>`).join('')}</div>`+
  `<div class="card" style="margin-bottom:14px"><h3>سلسلة العمل الامتحانية</h3><div class="pipe">${steps.map(([t,a,b,v])=>`<a class="step" href="#${v}" style="text-decoration:none;color:inherit"><div class="t">${t}</div><b style="font-variant-numeric:tabular-nums">${a} / ${b}</b><div class="bar"><i style="width:${b?Math.round(a/b*100):0}%"></i></div></a>`).join('')}</div></div>`+
  `<div class="grid g2"><div class="card"><h3>تنبيهات تحتاج إجراء</h3>${alerts.length?alerts.map(([k,t,v])=>`<div class="alert ${k}" style="margin-bottom:6px"><a href="#${v}" style="color:inherit">${esc(t)}</a></div>`).join(''):'<div class="alert ok">لا توجد تنبيهات مفتوحة.</div>'}</div>`+
  `<div class="card"><h3>الجلسات القادمة</h3>${upList?`<div class="tw"><table><thead><tr><th>الجلسة</th><th>المواد</th><th>طلبة</th><th>الجاهزية</th></tr></thead><tbody>${upList}</tbody></table></div>`:'<p class="mut">لم تُجدول امتحانات بعد.</p>'}</div></div>`;
};

function slotPicker(){
  const sl=slotList();if(!UI.slot||!sl.find(s=>s.key===UI.slot))UI.slot=sl[0]?.key||'';
  return `<select id="slotsel" data-ui="slot">${sl.map(s=>opt(s.key,slotName(s),UI.slot)).join('')}</select>`;
}
VIEW.seating=()=>{
  const sl=slotList();if(!sl.length)return ph('توزيع المقاعد','')+empty('لا توجد جلسات امتحانية','أضف امتحانات في الجدول الامتحاني أولاً.','<a class="btn pri" href="#exams">الجدول الامتحاني</a>');
  const pick=slotPicker();const slot=sl.find(s=>s.key===UI.slot);const sd=S.slots.get(slot.key)||{};
  const halls=arr('halls').sort((a,b)=>String(a.name).localeCompare(String(b.name),'ar'));
  const chosen=sd.halls||halls.map(h=>h.id);
  const n=slot.exams.reduce((a,e)=>a+examStudents(e).length,0);
  const cap=halls.filter(h=>chosen.includes(h.id)).reduce((a,h)=>a+(+h.rows)*(+h.cols),0);
  const legend=`<div class="legend">${slot.exams.map((e,i)=>`<span><i style="--c:${GCOL[i%5]}"></i>${esc(label.courses(S.courses.get(e.course)))} — ${examStudents(e).length} طالباً</span>`).join('')}</div>`;
  let maps='';
  if(sd.seats&&sd.seats.length){
    const ei=new Map(slot.exams.map((e,i)=>[e.id,i]));
    maps=[...new Set(sd.seats.map(x=>x.h))].map(hid=>{const h=S.halls.get(hid);if(!h)return'';const cells=new Map(sd.seats.filter(x=>x.h===hid).map(x=>[x.r+':'+x.c,x]));let g='';
      for(let r=0;r<+h.rows;r++)for(let c=0;c<+h.cols;c++){const x=cells.get(r+':'+c);const s=x&&S.students.get(x.s);g+=x?`<div class="seat" style="--c:${GCOL[(ei.get(x.e)??0)%5]}" title="${esc(s?s.name:'')}"><b>${seatNo(h,x)}</b>${esc(s?s.no:'?')}</div>`:`<div class="seat e"><b>${c*(+h.rows)+r+1}</b>فارغ</div>`}
      return `<div class="hall"><h4>${esc(h.name)} <span class="pill">${cells.size} / ${(+h.rows)*(+h.cols)}</span></h4><div style="overflow-x:auto"><div style="min-width:${(+h.cols)*58}px"><div class="board">السبورة — مقدمة القاعة</div><div class="seats" style="grid-template-columns:repeat(${+h.cols},minmax(50px,1fr))">${g}</div></div></div></div>`}).join('');
  }
  return ph('توزيع المقاعد','توزيع آلي يناوب الأعمدة بين المواد المتزامنة حتى لا يجاور طالبٌ زميلاً في المادة نفسها، ويترك مقعداً فارغاً بين الطلبة عندما تكفي السعة لمادة واحدة.',`${pick}`)+
  `<div class="card" style="margin-bottom:14px"><div class="row" style="justify-content:space-between"><div>${legend}</div><div class="mut">المطلوب ${n} · السعة المختارة ${cap}</div></div><div class="row" style="margin:12px 0">${halls.map(h=>`<label class="pill" style="cursor:pointer"><input type="checkbox" data-hall="${h.id}"${chosen.includes(h.id)?' checked':''}> ${esc(h.name)} (${(+h.rows)*(+h.cols)})</label>`).join('')}</div><div class="row"><button class="btn pri" data-act="seat"${roBtn()}>${sd.seats?.length?'إعادة التوزيع':'توزيع المقاعد'}</button><button class="btn" data-act="seatall"${roBtn()}>توزيع كل الجلسات</button>${sd.seats?.length?`<button class="btn" data-act="dlseat">تنزيل كشوف الجلوس</button><button class="btn" data-act="dldoor">تنزيل لوحات أبواب القاعات</button>`:''}${cap<n?'<span class="red">السعة المختارة لا تكفي</span>':''}</div></div>`+
  (maps||empty('لم توزَّع المقاعد بعد','اختر القاعات ثم اضغط «توزيع المقاعد».'));
};
VIEW.duties=()=>{
  const sl=slotList();if(!sl.length)return ph('اللجان والمراقبون','')+empty('لا توجد جلسات','أضف امتحانات أولاً.');
  const com=S.meta.get('committee')||{};const staff=arr('staff').sort((a,b)=>(TR[b.title]||0)-(TR[a.title]||0));
  const role=(k,l)=>`<label class="f">${l}<select data-com="${k}"${RO||!IS_ADMIN?' disabled':''}>${opt('','— اختر —',com[k])}${staff.map(p=>opt(p.id,`${p.title||''} ${p.name}`,com[k])).join('')}</select></label>`;
  const load=new Map();arr('slots').forEach(s=>(s.duties||[]).forEach(d=>d.staff.forEach(id=>load.set(id,(load.get(id)||0)+1))));
  const rows=sl.map(s=>{const d=S.slots.get(s.key)||{};return `<tr><td>${esc(slotName(s))}</td><td class="wrap">${(d.duties||[]).map(x=>`<div><b>${esc(label.halls(S.halls.get(x.h)))}:</b> ${x.staff.map((id,i)=>`${esc(label.staff(S.staff.get(id)))}${i===0?' <span class="pill acc">رئيس القاعة</span>':''}`).join('، ')||'<span class="red">لا يوجد</span>'}</div>`).join('')||(d.seats?.length?'<span class="mut">لم يُكلف أحد</span>':'<span class="mut">وزّع المقاعد أولاً</span>')}${(d.dwarn||[]).length?`<div class="red">${esc(d.dwarn.join('، '))}</div>`:''}</td><td><button class="btn sm" data-act="duty" data-k="${s.key}"${roBtn()}>${d.duties?.length?'إعادة':'تكليف'}</button></td></tr>`}).join('');
  const lt=staff.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.title||'')}</td><td style="font-variant-numeric:tabular-nums">${load.get(p.id)||0}</td><td>${p.coi?'<span class="pill ok">موقّع</span>':'<span class="pill warn">غير موقّع</span>'}</td></tr>`).join('');
  return ph('اللجان والمراقبون','تكليف عادل يوازن عدد الواجبات، ويستبعد أستاذ المادة من جلستها، والمتغيبين في تاريخهم، ومن له قريب في القاعة.',`<button class="btn pri" data-act="dutyall"${roBtn()}>تكليف كل الجلسات</button><button class="btn" data-act="dlduty">تنزيل جدول المراقبة</button>`)+
  `<div class="card" style="margin-bottom:14px"><h3>تشكيل اللجنة الامتحانية</h3><div class="fgrid">${role('chair','رئيس اللجنة')}${role('rap','مقرر اللجنة')}${role('m1','عضو أكاديمي')}${role('m2','عضو أكاديمي')}${role('m3','عضو أكاديمي')}${role('tech','الدعم الفني والأرشفة')}</div></div>`+
  `<div class="tw" style="margin-bottom:14px"><table><thead><tr><th>الجلسة</th><th>القاعات والمراقبون</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="card"><h3>عبء المراقبة لكل عضو</h3><div class="tw"><table><thead><tr><th>العضو</th><th>اللقب</th><th>الواجبات</th><th>الإقرار</th></tr></thead><tbody>${lt}</tbody></table></div></div>`;
};
const ENV=[['recv','استُلم الظرف مختوماً'],['seal','تحقق المراقب من سلامة الختم'],['open','فُتح الظرف داخل القاعة'],['ret','أُعيدت الدفاتر للكنترول']];
function presentCount(e){const sd=S.slots.get(slotKey(e))||{};const att=sd.att||{};return examStudents(e).filter(s=>att[s.id]==='p').length}
VIEW.envelopes=()=>{
  const ex=arr('exams').sort((a,b)=>slotKey(a)<slotKey(b)?-1:1);if(!ex.length)return ph('أظرف الأسئلة','')+empty('لا توجد امتحانات','أضف امتحانات أولاً.');
  return ph('أظرف الأسئلة وسلاسل التسليم','كل خطوة تُختم بالوقت واسم المنفذ في سجل التدقيق، وتُطابَق أعداد الدفاتر المعادة مع الحاضرين.')+
  `<div class="tw"><table><thead><tr><th>الامتحان</th><th>سلّم التصحيح</th><th>مراحل الظرف</th><th>الدفاتر / الحاضرون</th></tr></thead><tbody>${ex.map(e=>{const v=S.envelopes.get(e.id)||{};const pc=presentCount(e);const rc=v.ret?.count;
    return `<tr><td class="wrap">${esc(label.exams(e))}</td><td><label><input type="checkbox" data-rubric="${e.id}"${v.rubric?' checked':''}${roBtn()}> مرفق</label></td><td><div class="env">${ENV.map(([k,l],i)=>{const d=v[k];const prevOk=i===0||v[ENV[i-1][0]];return d?`<span class="s done" title="${esc(fmtTs(d.at))}">✓ ${l}<br><span class="mono">${new Date(d.at).toLocaleTimeString('ar-IQ-u-nu-latn',{hour:'2-digit',minute:'2-digit'})}</span></span>`:`<button class="btn sm" data-act="envstep" data-e="${e.id}" data-s="${k}"${!prevOk||RO?' disabled':''}>${l}</button>`}).join('')}</div></td><td>${rc!=null?`<span class="${rc!==pc?'red':''}">${rc} / ${pc}</span>${rc!==pc?' <span class="pill bad">عدم تطابق</span>':' <span class="pill ok">مطابق</span>'}`:`<span class="mut">— / ${pc}</span>`}</td></tr>`}).join('')}</tbody></table></div>`;
};
VIEW.attendance=()=>{
  const sl=slotList();if(!sl.length)return ph('الحضور والغياب','')+empty('لا توجد جلسات','أضف امتحانات أولاً.');
  const pick=slotPicker();const slot=sl.find(s=>s.key===UI.slot);const sd=S.slots.get(slot.key)||{};
  if(!sd.seats?.length)return ph('الحضور والغياب','',pick)+empty('لم توزَّع المقاعد لهذه الجلسة','وزّع المقاعد أولاً حتى تظهر قوائم القاعات.','<a class="btn pri" href="#seating">توزيع المقاعد</a>');
  const hs=[...new Set(sd.seats.map(x=>x.h))];if(!UI.hall||!hs.includes(UI.hall))UI.hall=hs[0];
  const att=sd.att||{};const list=sd.seats.filter(x=>x.h===UI.hall).sort((a,b)=>seatNo(S.halls.get(a.h),a)-seatNo(S.halls.get(b.h),b));
  const all=sd.seats.length,p=sd.seats.filter(x=>att[x.s]==='p').length,a=sd.seats.filter(x=>att[x.s]==='a').length,dd=sd.seats.filter(x=>att[x.s]==='d').length;
  return ph('الحضور والغياب','يعمل مع ماسح الباركود اليدوي (USB أو بلوتوث): امسح الرقم الامتحاني من هوية الطالب أو قسيمة الدفتر فيُسجل حاضراً فوراً.',pick)+
  `<div class="grid g4" style="margin-bottom:12px">${[[all,'مقعداً مشغولاً'],[p,'حاضر'],[a,'غائب'],[dd,'مؤجل'],[all-p-a-dd,'لم يُسجل']].map(([n,l])=>`<div class="card kpi"><b>${n}</b><span>${l}</span></div>`).join('')}</div>`+
  `<div class="scan"><b>مسح / إدخال الرقم الامتحاني</b><input type="text" id="scan" placeholder="امسح هنا ثم Enter" autocomplete="off"${roBtn()}><span class="mut">يمكن إدخال الرقم السري للدفتر أيضاً</span></div>`+
  `<div class="tabs">${hs.map(h=>`<button data-act="hall" data-h="${h}" class="${UI.hall===h?'on':''}">${esc(label.halls(S.halls.get(h)))}</button>`).join('')}</div>`+
  `<div class="row" style="margin-bottom:8px"><button class="btn sm" data-act="allp"${roBtn()}>تسجيل غير المسجلين في القاعة حاضرين</button><button class="btn sm" data-act="dlatt">تنزيل قائمة التواقيع</button></div>`+
  `<div class="tw"><table><thead><tr><th>المقعد</th><th>الرقم المعرفي</th><th>الاسم</th><th>المادة</th><th>الحالة</th></tr></thead><tbody>${list.map(x=>{const s=S.students.get(x.s)||{};const v=att[x.s]||'';return `<tr><td class="mono">${seatNo(S.halls.get(x.h),x)}</td><td class="mono">${esc(s.no)}</td><td>${esc(s.name)}</td><td>${esc((S.courses.get((S.exams.get(x.e)||{}).course)||{}).name)}</td><td><div class="att">${[['p','حاضر'],['a','غائب'],['d','مؤجل']].map(([k,l])=>`<button class="${k}${v===k?' on':''}" data-act="att" data-s="${x.s}" data-v="${k}"${roBtn()}>${l}</button>`).join('')}</div></td></tr>`}).join('')}</tbody></table></div>`;
};
VIEW.incidents=()=>{
  const list=arr('incidents').sort((a,b)=>(b.at||0)-(a.at||0));const steps=SCHEMA.incidents.f.find(f=>f.k==='status').o;
  return ph('محاضر الغش',SCHEMA.incidents.p,`<button class="btn pri" data-act="new" data-c="incidents"${roBtn()}>تحرير محضر</button>`)+
  (list.length?`<div class="grid">${list.map(x=>{const i=steps.indexOf(x.status||'موثق');const s=S.students.get(x.student);return `<div class="card"><div class="row" style="justify-content:space-between"><div><b>${esc(label.students(s))}</b><div class="mut">${esc(label.exams(S.exams.get(x.exam)))} · ${esc(label.halls(S.halls.get(x.hall)))} · الساعة ${esc(x.time||'—')}</div></div><span class="stamp ${x.status==='صدر القرار'?'ok':''}">${esc(x.status||'موثق')}</span></div><p style="margin:8px 0">${esc(x.desc)}</p><div class="row mut" style="font-size:13px"><span>الأداة المحرزة: <b>${esc(x.tool||'—')}</b></span><span>الشهود: ${esc(x.witnesses||'—')}</span><span>إفادة الطالب: ${x.statement?'أُخذت':'<span class="red">لم تؤخذ</span>'}</span>${x.decision?`<span>القرار: <b>${esc(x.decision)}</b></span>`:''}</div><div class="row" style="margin-top:10px">${i<steps.length-1?`<button class="btn sm pri" data-act="incnext" data-id="${x.id}"${roBtn()}>نقل إلى: ${steps[i+1]}</button>`:''}<button class="btn sm" data-act="edit" data-c="incidents" data-id="${x.id}"${roBtn()}>تعديل</button><button class="btn sm" data-act="dlinc" data-id="${x.id}">تنزيل المحضر الرسمي</button></div></div>`}).join('')}</div>`:empty('لا توجد محاضر','عند ضبط حالة غش، حرّر المحضر فوراً مع الوقت والأداة المحرزة والشهود.'));
};
VIEW.coding=()=>{
  const ex=arr('exams').sort((a,b)=>slotKey(a)<slotKey(b)?-1:1);if(!ex.length)return ph('التشفير والأرقام السرية','')+empty('لا توجد امتحانات','أضف امتحانات أولاً.');
  return ph('التشفير والأرقام السرية','يُولَّد لكل دفتر رقم سري بمفتاح HMAC‑SHA256 خاص بكل امتحان، ويُطبع رمز QR على الغلاف بدل قص الأسماء. يبقى الرصد أعمى حتى «فك التشفير»، وكل فك يُسجل في سجل التدقيق.')+
  (MODE==='cloud'&&!IS_ADMIN?'<div class="alert" style="margin-bottom:12px">مفاتيح التشفير مقصورة على المحررين (أعضاء الكنترول). لا تظهر لك.</div>':'')+
  `<div class="tw"><table><thead><tr><th>الامتحان</th><th>طلبة</th><th>الحالة</th><th>نموذج</th><th></th></tr></thead><tbody>${ex.map(e=>{const c=S.codes.get(e.id);const n=examStudents(e).length;const first=c?Object.entries(c.map||{})[0]:null;
    return `<tr><td class="wrap">${esc(label.exams(e))}</td><td>${n}</td><td>${!c?'<span class="pill">غير مشفر</span>':c.decoded?`<span class="pill acc">فُك التشفير ${esc(fmtTs(c.decodedAt||c.at))}</span>`:'<span class="pill ok">مشفر — رصد أعمى</span>'}</td><td>${first?`<div class="row"><span class="qrbox">${qrSvg(first[1])}</span><span class="mono">${esc(first[1])}</span></div>`:'—'}</td><td><div class="row">${!c?`<button class="btn sm pri" data-act="mkcodes" data-e="${e.id}"${roBtn()}>توليد الأرقام السرية</button>`:`<button class="btn sm" data-act="dlcovers" data-e="${e.id}">تنزيل أغلفة الدفاتر</button>${c.decoded?'':`<button class="btn sm bad" data-act="decode" data-e="${e.id}"${roBtn()}>فك التشفير</button>`}`}</div></td></tr>`}).join('')}</tbody></table></div>`;
};
function qrSvg(t){try{const q=qrcode(0,'M');q.addData(String(t));q.make();return q.createSvgTag(3,0)}catch(e){return ''}}

VIEW.grading=()=>{
  const cs=arr('courses').filter(semOk).sort((a,b)=>String(a.code).localeCompare(String(b.code)));if(!cs.length)return ph('رصد الدرجات','')+empty('لا توجد مواد','أضف المواد أولاً.');
  if(!UI.course||!S.courses.get(UI.course))UI.course=cs[0].id;
  const c=S.courses.get(UI.course);const st=cfg();const k=groupKey(c.dept,c.stage);const lock=isLocked(k);
  const studs=courseStudents(c);const g=G(c.id);const dr=DRAFT[c.id]||{};const val=(sid,f)=>dr[sid]&&f in dr[sid]?dr[sid][f]:(g[sid]||{})[f];
  const bl=blind(c.id);const codes=(codesFor(c.id)||{}).map||{};
  const tabs=[['cw',`السعي (من ${st.cwMax})`],['e1','النهائي — الإدخال الأول'],['e2','النهائي — الإدخال الثاني (المدقق)'],['sec','الدور الثاني']];
  if(!st.double)tabs.splice(2,1);
  if(MODE==='fb'&&KROLE==='auditor')tabs.splice(0,tabs.length,...tabs.filter(t=>t[0]==='e2'||t[0]==='sec'));
  if(!tabs.some(t=>t[0]===UI.gtab))UI.gtab=tabs[0][0];
  const sel=`<select id="csel" data-ui="course">${cs.map(x=>opt(x.id,label.courses(x)+' — '+groupName(groupKey(x.dept,x.stage)),UI.course)).join('')}</select>`;
  let rows=studs.filter(s=>UI.gtab==='cw'||!val(s.id,'dep'));
  const fin=UI.gtab==='e1'||UI.gtab==='e2';
  if(UI.gtab==='sec')rows=rows.filter(s=>{const r=res(c.id,s.id);return r.round===2||(r.state==='fail'&&r.round===1)});
  if(fin&&bl)rows=rows.slice().sort((a,b)=>String(codes[a.id]||'').localeCompare(String(codes[b.id]||'')));
  const dis=(lock||RO)?' disabled':'';
  const inp=(sid,f,max)=>{const v=val(sid,f);const n=num(v);const bad=n!=null&&(n<0||n>max);let mis='';if(f==='e2'&&n!=null){const a=num(val(sid,'e1'));if(a!=null&&a!==n&&(g[sid]||{}).e2!=null)mis=' mis'}return `<input class="cell${bad?' bad':''}${mis}" type="number" inputmode="decimal" step="0.5" min="0" max="${max}" data-draft="${c.id}~${sid}~${f}" data-row="${sid}" value="${esc(v??'')}"${MODE==='fb'&&(f.startsWith('p_')||f==='cw')?' disabled title="يرصده التدريسي في تطبيق الحضور"':dis}>`};
  const chk=(sid,f)=>`<input type="checkbox" data-draft="${c.id}~${sid}~${f}"${val(sid,f)?' checked':''}${dis}>`;
  const att=(()=>{const e=examOf(c.id);return e?((S.slots.get(slotKey(e))||{}).att||{}):{}})();
  let head,body;
  if(UI.gtab==='cw'&&partsOn()){const P=cfg().parts||PARTS;head='<th>الرقم المعرفي</th><th>الاسم</th><th>الغياب %</th><th>محروم</th>'+P.map(p=>`<th>${p[1]} (${p[2]})</th>`).join('')+`<th>السعي (${st.cwMax})</th>`;
    body=rows.map(s=>{const sum=partSum(s.id,val);return `<tr><td class="mono">${esc(s.no)}</td><td>${esc(s.name)}</td><td>${inp(s.id,'absPct',100)}</td><td>${chk(s.id,'dep')}</td>${P.map(p=>`<td>${inp(s.id,'p_'+p[0],p[2])}</td>`).join('')}<td><b data-sum="${s.id}" class="${sum!=null&&sum<st.cwMax/2?'red':''}">${r1(sum)}</b></td></tr>`}).join('')}
  else if(UI.gtab==='cw'){head='<th>الرقم المعرفي</th><th>الاسم</th><th>نسبة الغياب %</th><th>محروم</th><th>درجة السعي</th><th>كتابةً</th>';
    body=rows.map(s=>`<tr><td class="mono">${esc(s.no)}</td><td>${esc(s.name)}</td><td>${inp(s.id,'absPct',100)}</td><td>${chk(s.id,'dep')}</td><td>${inp(s.id,'cw',st.cwMax)}</td><td class="mut wrap">${tafqeet(num(val(s.id,'cw')))}</td></tr>`).join('')}
  else if(fin){const f=UI.gtab;head=(bl?'<th>الرقم السري</th>':'<th>الرقم المعرفي</th><th>الاسم</th>')+`<th>غائب</th><th>الدرجة (من ${st.finMax})</th><th>التفقيط</th>${f==='e2'?'<th>المطابقة</th>':''}`;
    body=rows.map(s=>{const r=g[s.id]||{};const fo=finalOf({...r,...(dr[s.id]||{})});const at=att[s.id];return `<tr>${bl?`<td class="mono">${esc(codes[s.id]||'—')}</td>`:`<td class="mono">${esc(s.no)}</td><td>${esc(s.name)}${at==='a'?' <span class="pill bad">غائب في الحضور</span>':''}</td>`}<td>${chk(s.id,'abs')}</td><td>${inp(s.id,f,st.finMax)}</td><td class="mut wrap">${tafqeet(num(val(s.id,f)))}</td>${f==='e2'?`<td>${fo.mismatch?`<span class="pill bad">تعارض</span> <button class="btn sm" data-act="resolve" data-s="${s.id}" data-w="e1"${dis}>اعتماد الأول</button><button class="btn sm" data-act="resolve" data-s="${s.id}" data-w="e2"${dis}>اعتماد الثاني</button>`:fo.ok?'<span class="pill ok">مطابق</span>':'<span class="mut">—</span>'}</td>`:''}</tr>`}).join('')}
  else{head=`<th>الرقم المعرفي</th><th>الاسم</th><th>السعي</th><th>نهائي الدور الأول</th><th>نهائي الدور الثاني (من ${st.finMax})</th><th>المجموع</th>`;
    body=rows.map(s=>{const r=res(c.id,s.id);const r0=G(c.id)[s.id]||{};const f1=finalOf(r0).v;return `<tr><td class="mono">${esc(s.no)}</td><td>${esc(s.name)}</td><td>${r1(num(r0.cw))}</td><td>${r1(f1)}</td><td>${inp(s.id,'sec',st.finMax)}</td><td>${r.round===2?`<b class="${r.pass?'':'red'}">${r1(r.total)}</b>`:'—'}</td></tr>`}).join('')}
  const dirty=Object.keys(dr).length;
  const mis=studs.filter(s=>res(c.id,s.id).mismatch).length;
  return ph('رصد الدرجات',`إدخال مزدوج أعمى: يرصد المدقق الثاني دون رؤية الإدخال الأول، ولا تُعتمد الدرجة إلا عند التطابق.${bl?' هذه المادة مشفرة: تظهر الأرقام السرية فقط حتى فك التشفير.':''}`,sel)+
  (lock?'<div class="alert bad" style="margin-bottom:12px">نتائج هذه المرحلة مصادق عليها ومقفلة. التعديل يتطلب إلغاء المصادقة من الماستر شيت.</div>':'')+
  `<div class="tabs">${tabs.map(([k,l])=>`<button data-act="gtab" data-t="${k}" class="${UI.gtab===k?'on':''}">${l}</button>`).join('')}</div>`+(MODE==='fb'&&UI.gtab==='cw'?'<div class="note" style="margin-bottom:12px">مكونات السعي يرصدها التدريسي في تطبيق الحضور وتظهر هنا لحظياً للقراءة. يرصد الكنترول نسبة الغياب والحرمان فقط.</div>':'')+
  `<div class="scan"><b>انتقال سريع</b><input type="text" id="jump" placeholder="امسح QR الدفتر أو اكتب الرقم" autocomplete="off"><span class="mut">ينقل المؤشر إلى خانة الطالب مباشرة</span>${mis?`<span class="pill bad">${mis} تعارض</span>`:''}</div>`+
  `<div class="row" style="margin-bottom:10px"><button class="btn pri" data-act="savegrades"${dirty&&!lock&&!RO?'':' disabled'}>حفظ الرصد${dirty?` (${dirty})`:''}</button>${dirty?'<button class="btn" data-act="dropdraft">تجاهل التغييرات</button>':''}${UI.gtab==='e1'||UI.gtab==='e2'?`<button class="btn" data-act="absfromatt"${dis}>نقل الغياب من سجل الحضور</button>`:''}</div>`+
  (rows.length?`<div class="tw"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`:empty(UI.gtab==='sec'?'لا يوجد طلبة في الدور الثاني لهذه المادة':'لا يوجد طلبة','الطلبة يُربطون بالمادة عبر القسم والمرحلة.'));
};
function partSum(sid,val){const P=cfg().parts||PARTS;let any=false,t=0;P.forEach(p=>{const n=num(val(sid,'p_'+p[0]));if(n!=null){any=true;t+=n}});return any?t:num(val(sid,'cw'))}
function gracePlan(k){
  const st=cfg();const cs=groupCourses(k);const out=[];
  for(const s of groupStudents(k)){let budget=st.graceTotal;const cand=[];
    for(const c of cs){const r=res(c.id,s.id,true);if(r.state==='fail'&&r.round===1&&!r.abs&&r.total>=st.pass-st.gracePer)cand.push({c,need:Math.round((st.pass-r.total)*2)/2,base:r.total})}
    cand.sort((a,b)=>a.need-b.need);const app=[];for(const x of cand){if(x.need<=budget){app.push(x);budget-=x.need}}
    if(cand.length)out.push({s,cand,app,used:st.graceTotal-budget});
  }
  return out;
}
function groupPicker(){const gs=groups();if(!UI.group||!gs.includes(UI.group))UI.group=gs[0]||'';return `<select id="gsel" data-ui="group">${gs.map(k=>opt(k,groupName(k),UI.group)).join('')}</select>`}
VIEW.grace=()=>{
  const gs=groups();if(!gs.length)return ph('الرأفة الآلية','')+empty('لا توجد مراحل','أضف مواد وطلبة أولاً.');
  const pick=groupPicker();const st=cfg();const plan=gracePlan(UI.group);const lock=isLocked(UI.group);
  const cur=groupCourses(UI.group).flatMap(c=>groupStudents(UI.group).filter(s=>num((G(c.id)[s.id]||{}).grace)).map(s=>({s,c,g:num(G(c.id)[s.id].grace)})));
  const saved=plan.reduce((a,p)=>a+p.app.length,0);
  return ph('الرأفة الآلية',`خوارزمية تُنقذ أكبر عدد ممكن من المواد لكل طالب: تُرتب المواد الراسبة تصاعدياً حسب الدرجات المطلوبة وتُمنح ضمن رصيد ${st.graceTotal} درجات للطالب، ولا تُمنح لمادة تقل عن ${st.pass-st.gracePer} ولا للغائب. تعمل على الدور الأول فقط.`,pick)+
  (lock?'<div class="alert bad" style="margin-bottom:12px">النتائج مصادق عليها ومقفلة.</div>':'')+
  `<div class="grid g4" style="margin-bottom:14px"><div class="card kpi"><b>${plan.length}</b><span>طالباً في المنطقة الحرجة</span></div><div class="card kpi"><b>${saved}</b><span>مادة يمكن إنقاذها</span></div><div class="card kpi"><b>${cur.length}</b><span>رأفة معتمدة حالياً</span></div></div>`+
  (plan.length?`<div class="tw" style="margin-bottom:12px"><table><thead><tr><th>الطالب</th><th>المواد الحرجة (الدرجة ← المطلوب)</th><th>الرأفة المقترحة</th><th>المستخدم من الرصيد</th></tr></thead><tbody>${plan.map(p=>`<tr><td>${esc(label.students(p.s))}</td><td class="wrap">${p.cand.map(x=>`${esc(x.c.name)}: ${r1(x.base)} ← +${x.need}`).join('<br>')}</td><td class="wrap">${p.app.length?p.app.map(x=>`<span class="pill ok">${esc(x.c.name)} +${x.need}</span>`).join(' '):'<span class="mut">لا يكفي الرصيد</span>'}</td><td>${p.used} / ${st.graceTotal}</td></tr>`).join('')}</tbody></table></div><div class="row"><button class="btn pri" data-act="applygrace"${lock||RO?' disabled':''}>اعتماد الرأفة المقترحة (${saved})</button>${cur.length?`<button class="btn bad" data-act="cleargrace"${lock||RO?' disabled':''}>إلغاء كل رأفة هذه المرحلة</button>`:''}</div>`:empty('لا يوجد طلبة في المنطقة الحرجة','كل الطلبة إما ناجحون أو بعيدون عن حد الرأفة، أو لم يكتمل الرصد.',cur.length?`<button class="btn bad" data-act="cleargrace"${lock||RO?' disabled':''}>إلغاء الرأفة المعتمدة (${cur.length})</button>`:''));
};
VIEW.master=()=>{
  const gs=groups();if(!gs.length)return ph('الماستر شيت','')+empty('لا توجد مراحل','أضف مواد وطلبة أولاً.');
  const pick=groupPicker();const k=UI.group;const cs=groupCourses(k);const studs=groupStudents(k);const lock=isLocked(k);
  const sts=studs.map(s=>({s,st:studentStatus(k,s.id)}));
  const cnt=l=>sts.filter(x=>x.st.label.startsWith(l)).length;
  const head1=`<tr class="grp-head"><th rowspan="2">الرقم</th><th rowspan="2">الاسم</th>${cs.map(c=>`<th colspan="4">${esc(c.name)}</th>`).join('')}<th rowspan="2">النتيجة</th><th rowspan="2">رمز التحقق</th></tr><tr>${cs.map(()=>'<th>سعي</th><th>نهائي</th><th>ر</th><th>مجموع</th>').join('')}</tr>`;
  const body=sts.map(({s,st})=>`<tr><td class="mono">${esc(s.no)}</td><td>${esc(s.name)}</td>${cs.map(c=>{const r=res(c.id,s.id);if(r.state==='dep')return '<td colspan="4"><span class="pill bad">محروم</span></td>';if(r.state==='pending')return `<td colspan="4"><span class="pill warn">${r.label}</span></td>`;return `<td>${r1(r.cw)}</td><td>${r.abs?'<span class="red">غ</span>':r1(r.fin)}${r.round===2?'<sup>د2</sup>':''}${r.appeal?'<sup>اع</sup>':''}</td><td>${r.grace?'+'+r.grace:''}</td><td class="${r.pass?'':'red'}" title="${grade(r.total)}">${r1(r.total)}</td>`}).join('')}<td><span class="pill ${st.cls}">${esc(st.label)}</span></td><td class="vc">${esc((VC.get(s.id)||{}).code||'…')}</td></tr>`).join('');
  return ph('الماستر شيت والنتائج','السجل المركزي: السعي + النهائي المدقق + الرأفة، مع حالة الطالب وفق حد المواد المكملة ورمز تحقق رقمي يثبت صحة الصدور.',pick)+
  `<div class="grid g4" style="margin-bottom:12px">${[[studs.length,'طالباً'],[cnt('ناجح'),'ناجح'],[cnt('مكمل'),'مكمل — دور ثانٍ'],[cnt('راسب'),'راسب'],[cnt('غير مكتمل'),'غير مكتمل']].map(([n,l])=>`<div class="card kpi"><b>${n}</b><span>${l}</span></div>`).join('')}</div>`+
  `<div class="row" style="margin-bottom:12px">${lock?`<span class="stamp ok">مصادق عليها — مقفلة</span><button class="btn" data-act="lock" data-v="0"${IS_ADMIN&&!RO?'':' disabled'}>إلغاء المصادقة</button>`:`<button class="btn pri" data-act="lock" data-v="1"${IS_ADMIN&&!RO&&!cnt('غير مكتمل')?'':' disabled'}>مصادقة النتائج وقفلها</button>${cnt('غير مكتمل')?'<span class="mut">تكتمل المصادقة بعد اكتمال الرصد.</span>':''}`}${MODE==='fb'&&lock?`<button class="btn pri" data-act="publish"${IS_ADMIN?'':' disabled'}>${(S.meta.get('locks')||{})[k.replace('|','_')]?.published?'إعادة نشر النتائج للطلبة':'نشر النتائج للطلبة في تطبيق الحضور'}</button>`:''}<button class="btn" data-act="dlmaster" data-k="xlsx">تنزيل الماستر شيت (Excel)</button><button class="btn" data-act="dlmaster" data-k="csv">CSV</button><button class="btn" data-act="dlmasterhtml">تنزيل نسخة للطباعة</button></div>`+
  (studs.length?`<div class="tw"><table class="cols-sticky"><thead>${head1}</thead><tbody>${body}</tbody></table></div><p class="mut" style="font-size:13px">ر = رأفة · د2 = الدور الثاني · اع = عُدلت باعتراض · غ = غائب. التقدير يظهر عند الوقوف على المجموع.</p>`:empty('لا يوجد طلبة',''));
};
function statsFor(c){const t=courseStudents(c).map(s=>res(c.id,s.id)).filter(r=>r.total!=null).map(r=>r.total);if(!t.length)return null;const n=t.length,m=t.reduce((a,b)=>a+b,0)/n;const sd=Math.sqrt(t.reduce((a,b)=>a+(b-m)**2,0)/n);const so=t.slice().sort((a,b)=>a-b);const med=n%2?so[(n-1)/2]:(so[n/2-1]+so[n/2])/2;const pr=t.filter(x=>x>=cfg().pass).length/n;return {t,n,m,sd,med,pr,min:so[0],max:so[n-1]}}
function histSvg(t){const W=520,H=190,b=new Array(10).fill(0);t.forEach(x=>b[Math.min(9,Math.floor(x/10))]++);const mx=Math.max(1,...b);const bw=(W-40)/10;
  let s=`<svg class="hist" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px" role="img" aria-label="توزيع الدرجات">`;
  for(let i=0;i<=4;i++){const y=20+(H-50)*i/4;s+=`<line x1="30" x2="${W-6}" y1="${y}" y2="${y}"/><text x="24" y="${y+3}" text-anchor="end">${Math.round(mx*(1-i/4))}</text>`}
  b.forEach((v,i)=>{const h=(H-50)*v/mx;const x=W-10-(i+1)*bw;s+=`<rect class="${i*10<cfg().pass?'f':''}" x="${x+3}" y="${H-30-h}" width="${bw-6}" height="${h}" rx="2"/><text x="${x+bw/2}" y="${H-14}" text-anchor="middle">${i*10}–${i===9?100:i*10+9}</text>${v?`<text x="${x+bw/2}" y="${H-34-h}" text-anchor="middle">${v}</text>`:''}`});
  return s+'</svg>'}
VIEW.stats=()=>{
  const cs=arr('courses').map(c=>({c,s:statsFor(c)})).filter(x=>x.s);
  if(!cs.length)return ph('التحليل الإحصائي','')+empty('لا توجد نتائج مكتملة','تظهر الإحصاءات بعد رصد السعي والنهائي المدقق.');
  const means=cs.map(x=>x.s.m);const M=means.reduce((a,b)=>a+b,0)/means.length;const SD=Math.sqrt(means.reduce((a,b)=>a+(b-M)**2,0)/means.length)||1;
  cs.forEach(x=>{x.z=(x.s.m-M)/SD;x.flag=x.z>=1.5?['warn','تساهل محتمل']:x.z<=-1.5?['bad','تشدد محتمل']:x.s.pr<0.4?['bad','نسبة رسوب مرتفعة']:x.s.sd<5&&x.s.n>=8?['warn','تباين منخفض جداً']:['ok','ضمن المتوقع']});
  if(!UI.stcourse||!cs.find(x=>x.c.id===UI.stcourse))UI.stcourse=cs[0].c.id;const cur=cs.find(x=>x.c.id===UI.stcourse);
  return ph('التحليل الإحصائي','منحنى توزيع الدرجات لكل مادة، ومقارنة متوسطها بمتوسط بقية المواد (الدرجة المعيارية z) لكشف مؤشرات التساهل أو التشدد آلياً.')+
  `<div class="grid g2" style="margin-bottom:14px"><div class="card"><div class="row" style="justify-content:space-between;margin-bottom:8px"><h3 style="margin:0">توزيع المجاميع</h3><select id="stsel" data-ui="stcourse">${cs.map(x=>opt(x.c.id,label.courses(x.c),UI.stcourse)).join('')}</select></div>${histSvg(cur.s.t)}<div class="row mut" style="font-size:13px;margin-top:6px"><span>العدد ${cur.s.n}</span><span>المتوسط ${r1(cur.s.m)}</span><span>الوسيط ${r1(cur.s.med)}</span><span>الانحراف المعياري ${r1(cur.s.sd)}</span><span>النجاح ${Math.round(cur.s.pr*100)}%</span><span>المدى ${r1(cur.s.min)}–${r1(cur.s.max)}</span></div></div>`+
  `<div class="card"><h3>قراءة تحليلية ذكية</h3>${sampleCap?`<p class="mut" style="margin-top:0">يرسل الأرقام الإحصائية فقط (دون أسماء الطلبة) إلى Claude ليكتب تقريراً للجنة.</p><button class="btn pri" data-act="ai"${UI.aiBusy?' disabled':''}>${UI.aiBusy?'جارٍ التحليل…':'توليد تقرير التحليل'}</button>${UI.ai?`<div class="ai" style="margin-top:12px">${esc(UI.ai)}</div>`:''}`:'<p class="mut">التحليل الذكي متاح عند فتح النظام داخل Claude.</p>'}</div></div>`+
  `<div class="tw"><table><thead><tr><th>المادة</th><th>العدد</th><th>المتوسط</th><th>الانحراف</th><th>النجاح</th><th>z</th><th>المؤشر</th></tr></thead><tbody>${cs.sort((a,b)=>b.z-a.z).map(x=>`<tr><td>${esc(label.courses(x.c))}</td><td>${x.s.n}</td><td>${r1(x.s.m)}</td><td>${r1(x.s.sd)}</td><td>${Math.round(x.s.pr*100)}%</td><td class="mono">${x.z.toFixed(2)}</td><td><span class="pill ${x.flag[0]}">${x.flag[1]}</span></td></tr>`).join('')}</tbody></table></div>`;
};
const NAMES=new Map();let nameBusy=false;
async function resolveNames(){if(!userCap||nameBusy)return;const ids=[...new Set(arr('audit').map(a=>a.by))].filter(id=>id&&id!=='local'&&!NAMES.has(id));if(!ids.length)return;nameBusy=true;try{const ps=await userCap.profiles(ids);ids.forEach(id=>NAMES.set(id,(ps[id]&&(ps[id].isMe?'أنت':ps[id].name))||'عضو'))}catch(e){ids.forEach(id=>NAMES.set(id,'عضو'))}nameBusy=false;sched()}
let chainRes=null;
VIEW.audit=()=>{
  const a=arr('audit').sort((x,y)=>y.ts-x.ts);
  return ph('سجل التدقيق','كل عملية تُختم بالوقت والمنفذ وتُربط ببصمة SHA‑256 للعملية السابقة؛ أي تعديل أو حذف لسطر قديم يكسر السلسلة ويظهر عند الفحص.',`<button class="btn pri" data-act="chain">فحص سلامة السلسلة</button><button class="btn" data-act="dlaudit">تنزيل السجل</button>`)+
  (chainRes?`<div class="alert ${chainRes.ok?'ok':'bad'}" style="margin-bottom:12px">${esc(chainRes.msg)}</div>`:'')+
  (a.length?`<div class="tw"><table><thead><tr><th>الوقت</th><th>المنفذ</th><th>العملية</th><th>التفاصيل</th><th>البصمة</th></tr></thead><tbody>${a.slice(0,400).map(x=>`<tr><td>${esc(fmtTs(x.ts))}</td><td>${esc(x.by==='local'?'هذا الجهاز':NAMES.get(x.by)||'…')}</td><td><b>${esc(x.action)}</b></td><td class="wrap">${esc(x.detail)}</td><td class="mono mut">${esc(String(x.hash).slice(0,10))}</td></tr>`).join('')}</tbody></table></div>${a.length>400?`<p class="mut">يُعرض أحدث 400 من ${a.length}. نزّل السجل للاطلاع على الكل.</p>`:''}`:empty('السجل فارغ','تظهر هنا كل عمليات الإضافة والتعديل والرصد وفك التشفير.'));
};
VIEW.verify=()=>{
  const v=UI.vres;
  return ph('التحقق من صحة الصدور','لكل نتيجة رمز تحقق مشتق ببصمة SHA‑256 من بيانات الطالب ودرجاته. أي تزوير في وثيقة مطبوعة يجعل رمزها لا يطابق السجل.')+
  `<div class="card" style="max-width:640px;margin-bottom:14px"><form data-form="verify" class="row"><input type="text" id="vq" name="vq" class="mono" placeholder="XXXX-XXXX-XXXX" value="${esc(UI.vq)}" style="width:220px"><button class="btn pri" type="submit">تحقق</button></form>${v?(v.found?`<div class="alert ok" style="margin-top:12px"><b>الوثيقة صحيحة ومطابقة للسجل.</b><br>${esc(v.s.name)} — ${esc(v.s.no)}<br>${esc(groupName(v.k))} · النتيجة: <b>${esc(studentStatus(v.k,v.s.id).label)}</b></div>`:'<div class="alert bad" style="margin-top:12px"><b>لا يوجد سجل بهذا الرمز.</b> قد تكون الوثيقة مزورة، أو عُدلت النتيجة بعد طباعتها.</div>'):''}</div>`+
  `<p class="mut">تظهر الرموز في عمود «رمز التحقق» بالماستر شيت وفي النسخة المطبوعة.</p>`;
};
VIEW.settings=()=>{
  const st=cfg();const F=(k,l,t='text')=>`<label class="f">${l}<input type="${t}" name="${k}" id="s_${k}" value="${esc(st[k])}"${t==='number'?' step="any"':''}></label>`;
  const B=(k,l)=>`<label class="f">${l}<span><input type="checkbox" name="${k}" id="s_${k}"${st[k]?' checked':''}> مفعّل</span></label>`;
  const fbm=MODE==='fb';
  return ph('الإعدادات والبيانات','الضوابط هنا تحكم كل الحسابات: النجاح والرأفة والمواد المكملة والرصد المزدوج.')+
  `<form class="card" data-form="settings" style="margin-bottom:14px"><h3>الجامعة والدورة الامتحانية</h3><div class="fgrid">${F('univ','الجامعة')}${F('college','الكلية')}${F('year','العام الدراسي')}${F('term','الفصل/الدور')}<label class="f">الفصل الحالي<select name="curSem" id="s_curSem">${opt('1','الفصل الأول',st.curSem)}${opt('2','الفصل الثاني',st.curSem)}</select></label>${F('p1','وقت الجلسة الأولى','time')}${F('p2','وقت الجلسة الثانية','time')}</div><h3 style="margin-top:16px">ضوابط الدرجات</h3><div class="fgrid">${F('cwMax','درجة السعي القصوى','number')}${F('finMax','درجة النهائي القصوى','number')}${F('pass','درجة النجاح','number')}${F('maxCarry','أقصى عدد مواد مكملة','number')}${F('graceTotal','رصيد الرأفة للطالب','number')}${F('gracePer','أقصى رأفة للمادة الواحدة','number')}${F('appealHours','مهلة البت بالاعتراض (ساعة)','number')}${F('idleMin','إنهاء الجلسة بعد عدم النشاط (دقيقة)','number')}${B('double','الرصد المزدوج (مدقق ثانٍ)')}${B('useParts','السعي من مكوناته (حضور 5، واجب 5، مشروع 10، مختبر 10، أسبوعي 10، فصلي 10)')}${B('requireCoi','استبعاد من لم يوقع إقرار تعارض المصالح')}</div><div class="row" style="margin-top:14px"><button class="btn pri" type="submit"${RO||(fbm&&!IS_ADMIN)?' disabled':''}>حفظ الإعدادات</button>${fbm&&!IS_ADMIN?'<span class="mut">تعديل الإعدادات لرئيس اللجنة.</span>':''}</div></form>`+(fbm?
  `<div class="card"><h3>قاعدة البيانات</h3><p class="mut" style="margin-top:0">النظام متصل بمشروع Firebase «${esc(FB.projectId)}» نفسه الذي يعمل عليه تطبيق الحضور. الأقسام والمواد والطلبة والكادر ومكونات السعي تُقرأ منه مباشرة، وبيانات الكنترول (القاعات، الجداول، المقاعد، الرصد المزدوج، الأرقام السرية، المحاضر، سجل التدقيق) في مجموعات k_ تحميها قواعد Firestore حسب الدور. يعمل دون اتصال ويزامن تلقائياً عند عودة الشبكة.</p><div class="row"><button class="btn" data-act="backup">تنزيل نسخة احتياطية (JSON)</button>${can('chair')?`<label class="btn">استعادة سجلات الكنترول من نسخة<input type="file" id="restore" accept=".json,application/json" hidden></label>`:''}</div><p class="mut" style="margin-bottom:0">${(()=>{const b=S.meta.get('backup');return b&&b.at?`آخر نسخة احتياطية: ${esc(fmtTs(b.at))}.`:'لم تُسجَّل نسخة احتياطية بعد.'})()} الاستعادة تعيد مجموعات الكنترول (k_) فقط، ولا تمس بيانات تطبيق الحضور ولا سجل التدقيق. يُنصح بتجربتها على نسخة حديثة قبل الامتحانات.</p></div>
  <div class="card" style="margin-top:14px"><h3>الأمان</h3><ul style="margin:0;padding-inline-start:18px;line-height:1.9"><li>الصلاحيات تفرضها قواعد Firestore على الخادم لكل مجموعة، لا إخفاء الأزرار فقط: تعديل الدرجة باعتراض يحتاج قرار رئيس اللجنة، والرصد يُرفض على المراحل المصادق عليها.</li><li>سجل التدقيق إضافة فقط ومسلسل ببصمات SHA‑256، ولا يملك أحد تعديله أو حذفه.</li><li>تنتهي الجلسة بعد ${esc(cfg().idleMin)} دقيقة دون نشاط، وتُقفل شاشة الدخول مؤقتاً بعد 5 محاولات خاطئة.</li><li>مفتاح Firebase في ملفات الواجهة معرّف عام للمشروع وليس سراً؛ الحماية في المصادقة والقواعد. لا توجد كلمات مرور أو مفاتيح سرية في الواجهة.</li></ul></div>`:
  `<div class="card" style="margin-bottom:14px"><h3>استيراد من ملفات Excel</h3><p class="mut" style="margin-top:0">يقرأ ملفات الجامعة كما هي: كشوف الطلبة (ورقة لكل مرحلة ودوام)، قاعدة المواد (رمز المقرر والفصل والقسم)، وسجلات الدرجات (ورقة لكل مادة بعناوين مثل «المشروع (10)»). يكتشف صف العناوين تلقائياً، ويطابق كل ورقة بمادتها، ويعرض الصفوف المرفوضة وسببها قبل الحفظ. لا يحذف شيئاً: يضيف الجديد ويحدّث الموجود.</p><label class="btn pri"${RO?' style="opacity:.45"':''}>اختيار ملفات Excel<input type="file" id="xlsxin" accept=".xlsx,.xls,.csv" multiple hidden${roBtn()}></label></div>
<div class="card"><h3>البيانات والنسخ الاحتياطي</h3><p class="mut" style="margin-top:0">${MODE==='cloud'?'البيانات محفوظة في قاعدة مشتركة بين كل من يملك صلاحية على هذه الصفحة، وتتزامن لحظياً بين الحاسوب والهاتف والجهاز اللوحي.':'تعمل الآن في الوضع المحلي: البيانات محفوظة في هذا المتصفح فقط. للعمل المشترك أضف إعدادات Firebase في firebase-config.js.'}</p><div class="row"><button class="btn" data-act="backup">تنزيل نسخة احتياطية (JSON)</button><label class="btn"${RO?' style="opacity:.45"':''}>استعادة من نسخة<input type="file" id="restore" accept=".json,application/json" hidden${roBtn()}></label><button class="btn" data-act="sample"${roBtn()}>تحميل بيانات تجريبية</button>${UI.cdel==='ALL'?`<button class="btn bad" data-act="wipe"${roBtn()}>تأكيد مسح كل البيانات</button>`:`<button class="btn bad" data-act="askdel" data-k="ALL"${roBtn()}>مسح كل البيانات</button>`}</div></div>`);
};

// صفحة «تصاريح الدخول» وطلبات الانضمام في permits.js

/* ============ الإجراءات ============ */
const ACT={};
VIEW.appeals=()=>{
  const st=cfg(),now=Date.now();const all=apList();let list=all;
  const k={open:all.filter(apOpen).length,late:all.filter(a=>apLate(a,now)).length,closed:all.filter(a=>!apOpen(a)).length,changed:all.filter(a=>a.st==='done'&&a.outcome==='changed').length,wait:all.filter(a=>a.st==='decision').length};
  const cl=all.filter(a=>!apOpen(a)&&a.decidedAt&&a.at);const avg=cl.length?cl.reduce((x,a)=>x+(a.decidedAt-a.at),0)/cl.length/36e5:null;
  const f=UI.apf||'open';
  if(f==='open')list=list.filter(apOpen);else if(f==='late')list=list.filter(a=>apLate(a,now));else if(f==='wait')list=list.filter(a=>a.st==='decision');else if(f==='closed')list=list.filter(a=>!apOpen(a));
  if(UI.q){const q=UI.q.trim();list=list.filter(a=>[a.ref,label.students(S.students.get(a.student)),label.courses(S.courses.get(a.course)),a.reason].some(v=>String(v||'').includes(q)))}
  list.sort((a,b)=>(apOpen(b)-apOpen(a))||(apOpen(a)?apDue(a)-apDue(b):(b.decidedAt||0)-(a.decidedAt||0)));
  const fl=[['open','المفتوحة',k.open],['late','المتأخرة',k.late],['wait','بانتظار القرار',k.wait],['closed','المغلقة',k.closed],['all','الكل',all.length]];
  const act=`${expBtns('apexp','')}${can('ctrl')?`<button class="btn pri" data-act="apnew"${roBtn()}>تسجيل اعتراض</button>`:''}`;
  return ph('الاعتراضات',`مسار موثق لكل تظلّم: تسجيل برقم مرجعي ← تدقيق الدفتر ← مراجعة اللجنة ← قرار رئيس اللجنة. المهلة ${st.appealHours} ساعة من التسجيل. لا تتغير أي درجة إلا بقرار معتمد من رئيس اللجنة، ويُحفظ قبلها وبعدها وسببها في سجل الاعتراض وسجل التدقيق.`,act)+
  `<div class="grid g4" style="margin-bottom:12px">${[[k.open,'اعتراضاً مفتوحاً'],[k.late,'متأخراً عن المهلة'],[`${k.closed}`,`مغلقاً · ${k.changed} عُدلت درجته`],[avg==null?'—':r1(avg)+' ساعة','متوسط زمن البت']].map(([n,l],i)=>`<div class="card kpi"><b class="${i===1&&k.late?'red':''}">${n}</b><span>${l}</span></div>`).join('')}</div>`+
  `<div class="row" style="margin-bottom:12px;align-items:flex-start"><div class="tabs" style="margin:0">${fl.map(([v,l,n])=>`<button class="${f===v?'on':''}" data-act="apf" data-v="${v}">${l} (${n})</button>`).join('')}</div><input type="search" id="q" placeholder="بحث بالمرجع أو الطالب أو المادة…" value="${esc(UI.q)}" data-ui="q" style="width:240px"></div>`+
  (list.length?`<div class="tw"><table><thead><tr><th>المرجع</th><th>الطالب</th><th>المادة</th><th>الدور</th><th>المجموع قبل ← بعد</th><th>المسؤول</th><th>المهلة / القرار</th><th>الحالة</th><th></th></tr></thead><tbody>${list.map(a=>apRow(a,now)).join('')}</tbody></table></div>`:empty(f==='open'?'لا توجد اعتراضات مفتوحة':'لا توجد سجلات في هذا التصنيف','سجّل اعتراض الطالب ليحصل على رقم مرجعي ويبدأ عدّاد المهلة.'));
};
function apWho(id,full){if(!id)return'—';if(id===ME)return full?(MEPROF?MEPROF.name:'هذا الجهاز'):'أنت';const p=S.staff.get(id);return p?p.name:(NAMES.get(id)||id)}
function apRow(a,now){
  const left=(apDue(a)-now)/36e5;const r=res(a.course,a.student);
  const after=a.st==='done'&&a.outcome==='changed'?`<b>${r1(r.total)}</b>`:apOpen(a)?'…':'بلا تغيير';
  const stc=apOpen(a)?(apLate(a,now)?'bad':a.st==='decision'?'acc':'warn'):a.st==='done'?'ok':'';
  return `<tr><td class="mono">${esc(a.ref||'—')}</td><td>${esc(label.students(S.students.get(a.student)))}</td><td>${esc((S.courses.get(a.course)||{}).name||'—')}</td><td>${a.round==='2'?'الثاني':'الأول'}</td><td>${a.oldTotal!=null?r1(a.oldTotal):'—'} ← ${after}</td><td>${esc(apWho(a.assignee))}</td><td>${apOpen(a)?(left>0?`<span class="${left<12?'red':''}">${Math.floor(left)} ساعة متبقية</span>`:`<span class="pill bad">متأخر ${Math.ceil(-left)} ساعة</span>`):(a.decidedAt?esc(fmtTs(a.decidedAt)):'—')}</td><td><span class="pill ${stc}">${esc(APST[a.st])}</span>${a.outcome&&!apOpen(a)?`<div class="mut" style="font-size:12px">${esc(APOUT[a.outcome]||'')}</div>`:''}</td><td><button class="btn sm" data-act="apopen" data-id="${esc(a.id)}">فتح</button></td></tr>`}
ACT.apf=d=>{UI.apf=d.v;render()};
function apStudentOpts(cid){const c=S.courses.get(cid);if(!c)return opt('','اختر المادة أولاً','');return opt('','— اختر —','')+courseStudents(c).map(s=>opt(s.id,label.students(s),'')).join('')}
const staffSorted=()=>arr('staff').sort((a,b)=>String(a.name).localeCompare(String(b.name),'ar'));
ACT.apnew=()=>{
  if(!can('ctrl')||RO)throw new Error('تسجيل الاعتراضات لأعضاء الكنترول.');
  const cs=arr('courses').filter(semOk).sort((a,b)=>label.courses(a).localeCompare(label.courses(b),'ar'));
  $('#modal').innerHTML=`<form class="dlg" data-form="apnew"><h3>تسجيل اعتراض جديد</h3><p class="mut" style="margin-top:0">يحصل الاعتراض على رقم مرجعي، وتُحفظ درجة الطالب الحالية لحظة التسجيل للمقارنة بعد القرار. لا يُقبل اعتراض مفتوح مكرر للطالب في المادة والدور نفسيهما.</p><div class="fgrid">
  <label class="f">المادة *<select name="course" id="ap_course" required data-apc>${opt('','— اختر —',UI.apCourse||'')}${cs.map(c=>opt(c.id,label.courses(c)+' — '+groupName(groupKey(c.dept,c.stage)),UI.apCourse||'')).join('')}</select></label>
  <label class="f">الطالب *<select name="student" id="ap_student" required>${apStudentOpts(UI.apCourse)}</select></label>
  <label class="f">الدور الامتحاني<select name="round" id="ap_round">${opt('1','الأول','1')}${opt('2','الثاني','1')}</select></label>
  <label class="f">المدقق المسؤول<select name="assignee" id="ap_assignee">${opt('','— يُحدد لاحقاً —','')}${staffSorted().map(p=>opt(p.id,p.name,'')).join('')}</select></label>
  <label class="f">تاريخ تقديم الطلب<input type="date" name="date" id="ap_date" value="${new Date().toISOString().slice(0,10)}"></label></div>
  <label class="f" style="margin-top:10px">سبب الاعتراض *<textarea name="reason" id="ap_reason" required></textarea></label>
  <div class="row" style="margin-top:12px"><button class="btn pri" type="submit">تسجيل الاعتراض</button><button class="btn" type="button" data-act="close">إلغاء</button></div><p class="red" id="ferr"></p></form>`;
  $('#modal').hidden=false};
async function apCreate(f){
  const E=n=>(f.elements[n]?f.elements[n].value:'').trim();
  const course=E('course'),student=E('student'),round=E('round')||'1',reason=E('reason');
  const c=S.courses.get(course),s=S.students.get(student);
  if(!c||!s)throw new Error('اختر المادة والطالب.');
  if(!courseStudents(c).some(x=>x.id===student))throw new Error('الطالب ليس من طلبة هذه المادة (القسم والمرحلة).');
  if(!reason)throw new Error('اكتب سبب الاعتراض.');
  {const r0=res(course,student);if(r0.state==='dep')throw new Error('الطالب محروم في هذه المادة؛ الحرمان يُعالَج بقرار مستقل لا باعتراض على الدرجة.');if(r0.state==='pending')throw new Error('لا توجد نتيجة مكتملة للطالب في هذه المادة بعد (السعي أو النهائي غير مرصود أو فيه تعارض).')}
  if(apList().some(a=>apOpen(a)&&a.course===course&&a.student===student&&String(a.round||'1')===round))throw new Error('يوجد اعتراض مفتوح للطالب نفسه في المادة والدور نفسيهما.');
  const r=res(course,student);const now=Date.now();const yr=new Date().getFullYear();
  const seq=Math.max(0,...apList().map(a=>{const m=/^AP-(\d{4})-(\d+)$/.exec(a.ref||'');return m&&+m[1]===yr?+m[2]:0}))+1;
  const ref=`AP-${yr}-${String(seq).padStart(4,'0')}`;
  const d={ref,student,course,round,reason,filedOn:E('date'),assignee:E('assignee'),st:'new',at:now,due:now+cfg().appealHours*36e5,
    oldFin:r.fin??null,oldTotal:r.total??null,oldState:r.label||(r.pass?'ناجح':'راسب'),createdBy:ME,hist:[{ts:now,by:ME,from:'',to:'new',note:'تسجيل الاعتراض'}]};
  await put('appeals',rid(),d);
  await log('تسجيل اعتراض',`${ref} · ${label.students(s)} · ${label.courses(c)} · المجموع عند التسجيل ${r1(r.total)}`);
  UI.apCourse='';closeModal();toast('سُجل الاعتراض برقم '+ref)}
async function apAssign(id,staff){const a=S.appeals.get(id);if(!a)return;const n=apN(a);const now=Date.now();
  await put('appeals',id,{...strip(a),st:n.st,assignee:staff,hist:[...(a.hist||[]),{ts:now,by:ME,from:n.st,to:n.st,note:'المسؤول: '+apWho(staff)}]});
  await log('اعتراض: تكليف',`${n.ref||id} · ${apWho(staff)}`);toast('حُدد المسؤول')}
ACT.apopen=d=>{UI.apId=d.id;apModal()};
function apModal(){
  const a=apN(S.appeals.get(UI.apId));if(!a){closeModal();return}
  const s=S.students.get(a.student),c=S.courses.get(a.course),r=res(a.course,a.student),st=cfg(),now=Date.now();
  const open=apOpen(a),gr=can('grade')&&!RO,ct=can('ctrl')&&!RO,ch=can('chair')&&!RO&&(MODE!=='fb'||IS_ADMIN);
  const row=(k,v)=>v===''||v==null?'':`<tr><th style="width:32%">${k}</th><td class="wrap">${v}</td></tr>`;
  const info=`<div class="tw"><table><tbody>${row('الرقم المرجعي',`<b class="mono">${esc(a.ref||a.id)}</b>`)}${row('الطالب',esc(label.students(s)))}${row('المادة',esc(label.courses(c))+(c?' — '+esc(groupName(groupKey(c.dept,c.stage))):''))}${row('الدور',a.round==='2'?'الثاني':'الأول')}${row('تاريخ تقديم الطلب',esc(a.filedOn||''))}${row('سجّله',esc(apWho(a.createdBy))+(a.at?' · '+esc(fmtTs(a.at)):''))}${row('المسؤول',esc(apWho(a.assignee)))}${row('المهلة',open?`${esc(fmtTs(apDue(a)))} ${apLate(a,now)?'<span class="pill bad">متأخر</span>':''}`:'')}${row('الحالة',`<span class="pill">${esc(APST[a.st])}</span>`)}${row('سبب الاعتراض',esc(a.reason))}
  ${row('الدرجة عند التسجيل',a.oldTotal!=null||a.oldFin!=null?`النهائي ${r1(a.oldFin)} · المجموع ${r1(a.oldTotal)}${a.oldState?' · '+esc(a.oldState):''}`:'')}${row('الدرجة الآن',r.total!=null?`النهائي ${r1(r.fin)} · المجموع <b>${r1(r.total)}</b> · ${esc(r.pass?'ناجح':'راسب')}`:esc(r.label||''))}
  ${row('نتيجة التدقيق',a.auditNote?esc(a.auditNote)+(a.proposedFin!=null?` · <b>الدرجة المقترحة ${r1(a.proposedFin)}</b>`:' · الدرجة صحيحة')+` <span class="mut">(${esc(apWho(a.auditBy))})</span>`:'')}${row('ملاحظات المراجعة',a.reviewNote?esc(a.reviewNote)+` <span class="mut">(${esc(apWho(a.reviewBy))})</span>`:'')}
  ${row('القرار',!open&&a.outcome?`<b>${esc(APOUT[a.outcome]||a.outcome)}</b>${a.finalFin!=null&&a.outcome==='changed'?` · النهائي ${r1(a.oldFin)} ← <b>${r1(a.finalFin)}</b>`:''}<br>${esc(a.decisionReason||'')}<br><span class="mut">${esc(apWho(a.decidedBy))}${a.decidedAt?' · '+esc(fmtTs(a.decidedAt)):''}</span>`:'')}</tbody></table></div>`;
  const hist=(a.hist||[]).length?`<h3 style="margin-top:14px">سجل الإجراءات</h3><ol style="margin:0;padding-inline-start:20px;line-height:1.8">${a.hist.map(h=>`<li><span class="mut">${esc(fmtTs(h.ts))} · ${esc(apWho(h.by))}</span> — ${h.from&&h.from!==h.to?esc(APST[h.from]||h.from)+' ← ':''}<b>${esc(APST[h.to]||h.to)}</b>${h.note?': '+esc(h.note):''}</li>`).join('')}</ol>`:'';
  const F=(to,title,inner,btn,cls='pri')=>`<form class="card" data-form="apstep" data-to="${to}" style="margin-top:10px"><h3>${title}</h3>${inner}<div class="row" style="margin-top:10px"><button class="btn ${cls}" type="submit">${btn}</button></div><p class="red" id="ferr" style="margin:6px 0 0"></p></form>`;
  let acts='';
  if(open&&ct)acts+=`<label class="f" style="margin-top:12px">المدقق المسؤول<select data-apassign="${esc(a.id)}">${opt('','— غير محدد —',a.assignee||'')}${staffSorted().map(p=>opt(p.id,p.name,a.assignee||'')).join('')}</select></label>`;
  if(a.st==='new'&&gr)acts+=F('audit','بدء التدقيق','<p class="mut" style="margin:0">يُثبت استلام الدفتر الامتحاني الأصلي وبدء تدقيقه، ويُسجَّل باسمك ووقته.</p>','استلام الدفتر وبدء التدقيق');
  if(a.st==='audit'&&gr)acts+=F('review','نتيجة التدقيق',`<label class="f">ما وجده المدقق (إعادة الجمع، أسئلة غير مصححة، مطابقة الدرجة بالسجل) *<textarea name="auditNote" required>${esc(a.auditNote||'')}</textarea></label><label class="f" style="margin-top:8px">الدرجة ${a.round==='2'?'(الدور الثاني)':'النهائية'} المقترحة من ${st.finMax} — اتركها فارغة إن كانت الدرجة صحيحة<input type="number" step="any" min="0" max="${st.finMax}" name="proposedFin" value="${esc(a.proposedFin??'')}"></label>`,'إحالة إلى المراجعة');
  if(a.st==='review'&&ct)acts+=F('decision','مراجعة اللجنة',`<label class="f">ملاحظات المراجعة *<textarea name="reviewNote" required>${esc(a.reviewNote||'')}</textarea></label>`,'رفع إلى رئيس اللجنة للقرار')+F('audit','إعادة إلى التدقيق',`<label class="f">سبب الإعادة *<textarea name="note" required></textarea></label>`,'إعادة إلى التدقيق','');
  if(open&&ch)acts+=F('decide',a.st==='decision'?'قرار رئيس اللجنة':'قرار مباشر من رئيس اللجنة',`<div class="fgrid"><label class="f">القرار *<select name="outcome" required>${opt('','— اختر —','')}${Object.entries(APOUT).map(([k,l])=>opt(k,l,'')).join('')}</select></label><label class="f">الدرجة المعتمدة من ${st.finMax} (عند تعديل الدرجة)<input type="number" step="any" min="0" max="${st.finMax}" name="finalFin" value="${esc(a.proposedFin??'')}"></label></div><label class="f" style="margin-top:8px">سبب القرار *<textarea name="decisionReason" required></textarea></label><p class="mut" style="margin:6px 0 0">يُحفظ القرار باسمك ووقته، ويُسجل في سجل التدقيق مع الدرجة قبل وبعد. إن كانت النتائج منشورة تُحدَّث درجة الطالب المنشورة تلقائياً.</p>`,'اعتماد القرار');
  else if(open&&a.st==='decision')acts+=`<div class="note" style="margin-top:10px">بانتظار قرار رئيس اللجنة.</div>`;
  acts+=`<div class="row" style="margin-top:12px"><button class="btn" data-act="apprint">طباعة استمارة الاعتراض</button>${ch?`<button class="btn bad" data-act="apdel">حذف الاعتراض</button>`:''}<button class="btn" data-act="close">إغلاق</button></div>`;
  $('#modal').innerHTML=`<div class="dlg" style="max-width:760px"><h3>اعتراض ${esc(a.ref||'')}</h3>${info}${hist}${acts}</div>`;$('#modal').hidden=false;
}
async function apStep(f){
  const raw=S.appeals.get(UI.apId);const a=apN(raw);if(!a)throw new Error('الاعتراض غير موجود.');
  if(!apOpen(a))throw new Error('الاعتراض مغلق.');
  const to=f.dataset.to,E=n=>(f.elements[n]?f.elements[n].value:'').trim(),now=Date.now(),st=cfg();
  const upd={};let note='';
  if(to==='audit'){if(!can('grade'))throw new Error('للمدققين وأعضاء الكنترول.');
    if(a.st==='review'){if(!E('note'))throw new Error('اكتب سبب الإعادة.');note='إعادة إلى التدقيق: '+E('note')}else note='استلام الدفتر وبدء التدقيق';
    if(a.st==='new'&&!a.assignee)upd.assignee=ME}
  else if(to==='review'){if(!can('grade'))throw new Error('للمدققين وأعضاء الكنترول.');if(!E('auditNote'))throw new Error('اكتب نتيجة التدقيق.');
    const p=num(E('proposedFin'));if(p!=null&&(p<0||p>st.finMax))throw new Error(`الدرجة المقترحة بين 0 و${st.finMax}.`);
    Object.assign(upd,{auditNote:E('auditNote'),proposedFin:p,auditBy:ME,auditAt:now});note='نتيجة التدقيق: '+E('auditNote')+(p!=null?` · المقترح ${p}`:' · الدرجة صحيحة')}
  else if(to==='decision'){if(!can('ctrl'))throw new Error('لأعضاء الكنترول.');if(!E('reviewNote'))throw new Error('اكتب ملاحظات المراجعة.');
    Object.assign(upd,{reviewNote:E('reviewNote'),reviewBy:ME,reviewAt:now});note='المراجعة: '+E('reviewNote')}
  else if(to==='decide'){if(!can('chair')||(MODE==='fb'&&!IS_ADMIN))throw new Error('اعتماد القرار لرئيس اللجنة فقط.');
    const out=E('outcome'),why=E('decisionReason');if(!APOUT[out])throw new Error('اختر القرار.');if(!why)throw new Error('اكتب سبب القرار.');
    let fin=null;if(out==='changed'){fin=num(E('finalFin'));if(fin==null||fin<0||fin>st.finMax)throw new Error(`أدخل الدرجة المعتمدة بين 0 و${st.finMax}.`);if(a.oldFin!=null&&+a.oldFin===fin)throw new Error('الدرجة المعتمدة تساوي الدرجة الأصلية؛ اختر «الدرجة صحيحة — لا تعديل».')}
    Object.assign(upd,{outcome:out,finalFin:fin,decisionReason:why,decidedBy:ME,decidedAt:now,st:out==='rejected'?'rejected':'done'});
    note=`القرار: ${APOUT[out]}${fin!=null?` (النهائي ${a.oldFin??'—'} ← ${fin})`:''} · ${why}`}
  else throw new Error('خطوة غير معروفة.');
  if(!upd.st)upd.st=to;
  await put('appeals',a.id,{...strip(raw),...upd,hist:[...(raw.hist||[]),{ts:now,by:ME,from:a.st,to:upd.st,note}]});
  if(to==='decide'){
    let pub='';
    if(upd.outcome==='changed'&&MODE==='fb'){const c=S.courses.get(a.course);const gk=c&&groupKey(c.dept,c.stage);const L=gk&&(S.meta.get('locks')||{})[gk.replace('|','_')];
      if(L&&L.published){const g=a.round==='2'?0:(num((G(a.course)[a.student]||{}).grace)||0);const s=S.students.get(a.student)||{};
        await settle(FB.setDoc(FB.doc(FB.db,'grades',fsSafe(a.course+'_'+a.student)),{courseId:a.course,studentId:a.student,studentName:s.name||'',marks:{final:Math.round((upd.finalFin+g)*100)/100},updatedAt:now},{merge:true}));pub=' · حُدّثت الدرجة المنشورة للطالب'}}
    await log('قرار اعتراض',`${a.ref||a.id} · ${label.students(S.students.get(a.student))} · ${label.courses(S.courses.get(a.course))} · ${APOUT[upd.outcome]}${upd.finalFin!=null?` · النهائي ${a.oldFin??'—'} ← ${upd.finalFin} · المجموع قبل ${r1(a.oldTotal)}`:''} · السبب: ${upd.decisionReason}${pub}`);
  }else await log('اعتراض: '+APST[upd.st],`${a.ref||a.id} · ${note}`);
  toast('حُفظ: '+APST[upd.st]);setTimeout(()=>{if(!$('#modal').hidden)apModal()},120);
}
ACT.apdel=async(d,b)=>{if(!can('chair'))throw new Error('الحذف لرئيس اللجنة فقط.');if(!b.dataset.sure){b.dataset.sure='1';b.textContent='اضغط مرة أخرى لتأكيد الحذف';return}
  const a=apN(S.appeals.get(UI.apId));await del('appeals',UI.apId);await log('حذف اعتراض',`${a.ref||UI.apId} · ${label.students(S.students.get(a.student))} · الحالة ${APST[a.st]}`);closeModal();toast('حُذف الاعتراض')};
ACT.apprint=()=>{const a=apN(S.appeals.get(UI.apId));if(!a)return;const s=S.students.get(a.student)||{},c=S.courses.get(a.course),r=res(a.course,a.student);
  const tr=(k,v)=>`<tr><th style="width:30%">${k}</th><td>${v}</td></tr>`;
  const body=`<h2>استمارة اعتراض على نتيجة امتحانية — ${esc(a.ref||'')}</h2><table>${tr('الطالب',esc(s.name)+' — <span class="mono">'+esc(s.no)+'</span>')}${tr('المادة',esc(label.courses(c)))}${tr('القسم والمرحلة',c?esc(groupName(groupKey(c.dept,c.stage))):'')}${tr('الدور',a.round==='2'?'الثاني':'الأول')}${tr('تاريخ تقديم الطلب',esc(a.filedOn||''))}${tr('سبب الاعتراض',esc(a.reason))}${tr('الدرجة عند التسجيل',`النهائي ${r1(a.oldFin)} · المجموع ${r1(a.oldTotal)}`)}${tr('نتيجة التدقيق',esc(a.auditNote||'—')+(a.proposedFin!=null?' · المقترح '+r1(a.proposedFin):''))}${tr('ملاحظات المراجعة',esc(a.reviewNote||'—'))}${tr('القرار',a.outcome&&!apOpen(a)?esc(APOUT[a.outcome])+(a.outcome==='changed'?` · النهائي ${r1(a.oldFin)} ← ${r1(a.finalFin)} (${esc(tafqeet(a.finalFin))})`:'')+'<br>'+esc(a.decisionReason||''):'لم يصدر بعد')}${tr('الدرجة الحالية',r.total!=null?`المجموع ${r1(r.total)} — ${esc(grade(r.total))}`:'—')}</table>
  <h2>سجل الإجراءات</h2><table><tr><th>الوقت</th><th>المنفذ</th><th>الإجراء</th></tr>${(a.hist||[]).map(h=>`<tr><td>${esc(fmtTs(h.ts))}</td><td>${esc(apWho(h.by,1))}</td><td>${esc(APST[h.to]||h.to)}${h.note?': '+esc(h.note):''}</td></tr>`).join('')}</table>${sigs()}`;
  printOut('اعتراض-'+(a.ref||a.id),printDoc('استمارة اعتراض '+(a.ref||''),body))};
ACT.apexp=d=>{const now=Date.now();const list=apList().sort((a,b)=>(a.at||0)-(b.at||0));
  const head=['الرقم المرجعي','الرقم المعرفي','الطالب','المادة','القسم والمرحلة','الدور','تاريخ التقديم','تاريخ التسجيل','نهاية المهلة','المسؤول','الحالة','متأخر','القرار','النهائي قبل','النهائي بعد','المجموع قبل','المجموع الآن','نتيجة التدقيق','سبب القرار','اعتمده','تاريخ القرار'];
  const rows=list.map(a=>{const s=S.students.get(a.student)||{},c=S.courses.get(a.course),r=res(a.course,a.student);return [a.ref||'',s.no||'',s.name||'',c?label.courses(c):'',c?groupName(groupKey(c.dept,c.stage)):'',a.round==='2'?'الثاني':'الأول',a.filedOn||'',a.at?fmtTs(a.at):'',fmtTs(apDue(a)),apWho(a.assignee,1),APST[a.st],apLate(a,now)?'نعم':'',apOpen(a)?'':(APOUT[a.outcome]||''),a.oldFin??'',a.outcome==='changed'?a.finalFin:'',a.oldTotal??'',r.total??'',a.auditNote||'',a.decisionReason||'',a.decidedBy?apWho(a.decidedBy,1):'',a.decidedAt?fmtTs(a.decidedAt):'']});
  const o=list.filter(apOpen).length,l=list.filter(a=>apLate(a,now)).length;
  return exportTable('تقرير-الاعتراضات','تقرير الاعتراضات',head,rows,d.k,`مفتوحة ${o} · متأخرة ${l} · مغلقة ${list.length-o}`)};

/* ============ فحص سلامة البيانات ============ */
function integrityScan(){
  const st=cfg();const out=[];const add=(sev,t,items,view,act)=>out.push({sev,t,items,view,act});
  const studs=arr('students');
  const byN=new Map();studs.forEach(s=>{const k=String(s.no??'').trim();if(k)byN.set(k,[...(byN.get(k)||[]),s])});
  add('bad','أرقام معرفية مكررة',[...byN].filter(([,l])=>l.length>1).map(([k,l])=>`${k}: ${l.map(s=>s.name).join(' / ')}`),'students');
  const nm=new Map();studs.forEach(s=>{const k=s.dept+'|'+s.stage+'|'+normAr(s.name);nm.set(k,[...(nm.get(k)||[]),s])});
  add('warn','أسماء متطابقة في المرحلة نفسها (قد تكون تكراراً)',[...nm.values()].filter(l=>l.length>1).map(l=>`${l[0].name} — ${groupName(groupKey(l[0].dept,l[0].stage))}: ${l.map(s=>s.no).join('، ')}`),'students');
  add('bad','طلبة بلا قسم صالح أو بلا مرحلة',studs.filter(s=>!S.depts.get(s.dept)||!s.stage).map(s=>label.students(s)),'students');
  const cs=arr('courses').filter(semOk);
  add('warn','مواد الفصل الحالي بلا أستاذ',cs.filter(c=>!c.teacher).map(c=>label.courses(c)+' — '+groupName(groupKey(c.dept,c.stage))),'courses');
  add('warn','مواد الفصل الحالي غير مجدولة امتحانياً',cs.filter(c=>!examOf(c.id)).map(c=>label.courses(c)+' — '+groupName(groupKey(c.dept,c.stage))),'exams');
  add('warn','مواد بلا طلبة في قسمها ومرحلتها',cs.filter(c=>!courseStudents(c).length).map(c=>label.courses(c)),'courses');
  const orphan=[],range=[],mis=[];
  arr('grades').forEach(g=>{const c=S.courses.get(g.id);if(!c)return;const ids=new Set(courseStudents(c).map(s=>s.id));
    for(const [sid,r] of Object.entries(g.rows||{})){const nmS=(S.students.get(sid)||{}).name||sid;
      if(!ids.has(sid)&&['cw','e1','e2','sec'].some(f=>num(r[f])!=null))orphan.push(`${label.courses(c)} · ${nmS}`);
      const chk=(f,mx,l)=>{const v=num(r[f]);if(v!=null&&(v<0||v>mx))range.push(`${label.courses(c)} · ${nmS} · ${l} = ${v} (الحد ${mx})`)};
      chk('cw',st.cwMax,'السعي');chk('e1',st.finMax,'النهائي 1');chk('e2',st.finMax,'النهائي 2');chk('sec',st.finMax,'الدور الثاني');chk('grace',st.gracePer,'الرأفة');
      if(finalOf(r).mismatch)mis.push(`${label.courses(c)} · ${nmS}: ${r.e1} ≠ ${r.e2}`)}});
  add('bad','درجات مرصودة لطلبة ليسوا من طلبة المادة',orphan,'grading','orphandel');
  add('bad','درجات خارج المدى المسموح',range,'grading');
  add('warn','تعارض بين الإدخال الأول والثاني للنهائي',mis,'grading');
  const ap=apList();const dup=new Map();ap.filter(apOpen).forEach(a=>{const k=a.course+'~'+a.student+'~'+(a.round||'1');dup.set(k,(dup.get(k)||0)+1)});
  add('warn','اعتراضات مفتوحة مكررة للطالب والمادة نفسيهما',[...dup].filter(([,n])=>n>1).map(([k])=>{const [c,s]=k.split('~');return `${label.students(S.students.get(s))} · ${label.courses(S.courses.get(c))}`}),'appeals');
  add('bad','اعتراضات تجاوزت المهلة دون قرار',ap.filter(a=>apLate(a)).map(a=>`${a.ref||'—'} · ${label.students(S.students.get(a.student))} · ${(S.courses.get(a.course)||{}).name||''}`),'appeals');
  add('warn','اعتراضات مقبولة على مراحل مصادق عليها (راجع النشر)',ap.filter(a=>a.st==='done'&&a.outcome==='changed').filter(a=>{const c=S.courses.get(a.course);return c&&isLocked(groupKey(c.dept,c.stage))&&a.decidedAt<(((S.meta.get('locks')||{})[groupKey(c.dept,c.stage).replace('|','_')]||{}).at||0)}).map(a=>`${a.ref} · ${label.students(S.students.get(a.student))}`),'master');
  return out}
VIEW.integrity=()=>{const L=integrityScan();const nb=L.filter(x=>x.sev==='bad').reduce((a,x)=>a+x.items.length,0),nw=L.filter(x=>x.sev==='warn').reduce((a,x)=>a+x.items.length,0);
  return ph('فحص سلامة البيانات','فحص آلي يكشف التكرار وعدم الاتساق قبل المصادقة. الفحص يُنبّه فقط ولا يعدّل أي درجة؛ المعالجة والقرار للجنة المخوّلة.',expBtns('intexp',''))+
  `<div class="grid g4" style="margin-bottom:12px">${[[L.length,'فحصاً'],[nb,'مشكلة حرجة'],[nw,'تنبيهاً'],[L.filter(x=>!x.items.length).length,'فحصاً سليماً']].map(([n,l],i)=>`<div class="card kpi"><b class="${i===1&&n?'red':''}">${n}</b><span>${l}</span></div>`).join('')}</div>`+
  L.map(x=>`<div class="card" style="margin-bottom:10px"><div class="row" style="justify-content:space-between"><b>${esc(x.t)}</b><span class="pill ${x.items.length?(x.sev==='bad'?'bad':'warn'):'ok'}">${x.items.length?x.items.length+(x.sev==='bad'?' حرجة':' تنبيه'):'سليم'}</span></div>${x.items.length?`<ul style="margin:8px 0 0;padding-inline-start:20px">${x.items.slice(0,12).map(i=>`<li>${esc(i)}</li>`).join('')}</ul>${x.items.length>12?`<p class="mut" style="margin:4px 0">و${x.items.length-12} غيرها — صدّر التقرير للقائمة الكاملة.</p>`:''}${viewOk(x.view)?`<a class="btn sm" href="#${x.view}" data-nav="${x.view}" style="margin-top:8px">الانتقال للمعالجة</a>`:''}${x.act&&MODE==='fb'&&IS_TOP&&!RO?` <button class="btn sm bad" data-act="${x.act}" style="margin-top:8px">حذف هذه الدرجات من تطبيق الحضور</button>`:''}`:''}</div>`).join('')};
ACT.intexp=d=>{const L=integrityScan();const rows=L.flatMap(x=>x.items.length?x.items.map(i=>[x.t,x.sev==='bad'?'حرجة':'تنبيه',i]):[[x.t,'سليم','']]);return exportTable('فحص-سلامة-البيانات','تقرير فحص سلامة البيانات',['الفحص','المستوى','التفاصيل'],rows,d.k)};

/* ============ التصدير: Excel وCSV وتقارير رسمية للطباعة ============ */
const expBtns=(act,c)=>`<button class="btn sm" data-act="${act}" data-c="${esc(c)}" data-k="xlsx">Excel</button><button class="btn sm" data-act="${act}" data-c="${esc(c)}" data-k="csv">CSV</button><button class="btn sm" data-act="${act}" data-c="${esc(c)}" data-k="print">طباعة / PDF</button>`;
function plain(h){const d=document.createElement('div');d.innerHTML=String(h??'');return d.textContent.trim()}
async function exportTable(base,title,head,rows,kind,extra=''){
  const st=cfg(),now=new Date();base=String(base).replace(/[\\/:*?"<>|]+/g,'-');
  if(kind==='csv'){const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';return download(base+'.csv','﻿'+[head,...rows].map(r=>r.map(q).join(',')).join('\n'))}
  if(kind==='xlsx'){if(!window.XLSX)throw new Error('مكتبة Excel لم تُحمّل بعد، أعد المحاولة بعد لحظات.');
    const aoa=[[`${st.univ} — ${st.college}`],[`اللجنة الامتحانية · ${st.term} ${st.year}`],[title],[`تاريخ الإصدار: ${fmtTs(now)} · عدد السجلات: ${rows.length}${extra?' · '+extra:''}`],[],head,...rows];
    const ws=XLSX.utils.aoa_to_sheet(aoa);ws['!cols']=head.map((h,i)=>({wch:Math.min(48,Math.max(8,String(h).length+2,...rows.slice(0,300).map(r=>String(r[i]??'').length+2)))}));
    ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:5,c:0},e:{r:5+rows.length,c:Math.max(0,head.length-1)}})};
    const wb=XLSX.utils.book_new();wb.Workbook={Views:[{RTL:true}]};XLSX.utils.book_append_sheet(wb,ws,(title.replace(/[\\/?*[\]:]/g,' ').slice(0,31))||'تقرير');
    const out=XLSX.write(wb,{bookType:'xlsx',type:'array'});
    return download(base+'.xlsx',new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}))}
  const fp=(await sha256(JSON.stringify([title,head,rows]))).slice(0,16).toUpperCase().replace(/(.{4})(?!$)/g,'$1-');
  const body=`<h2>${esc(title)}</h2><p>تاريخ الإصدار: ${esc(fmtTs(now))} · عدد السجلات: <b>${rows.length}</b>${extra?' · '+esc(extra):''} · أصدره: ${esc(MEPROF?MEPROF.name:'هذا الجهاز')}</p>${head.length>9?'<style>@page{size:A4 landscape}</style>':''}<table><tr><th>#</th>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr>${rows.map((r,i)=>`<tr><td>${i+1}</td>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</table>${sigs()}<p class="mono" style="margin-top:14px;font-size:11px">بصمة الوثيقة: ${fp} — صادرة آلياً من نظام الكنترول، وأي تعديل على محتواها يغيّر البصمة.</p>`;
  return printOut(base,printDoc(title,body))}
function printOut(base,html){let w=null;try{w=window.open('','_blank')}catch(e){}
  if(w){w.document.open();w.document.write(html.replace('</body>','<script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body>'));w.document.close();return}
  return download(base+'.html',html)}
ACT.lexp=d=>{const sc=SCHEMA[d.c];const rows=listRows(d.c);const f=[UI.fd?label.depts(S.depts.get(UI.fd)):'',UI.fs?'المرحلة '+STAGES[+UI.fs-1]:'',UI.q?'بحث: '+UI.q:''].filter(Boolean).join(' · ');
  return exportTable(sc.t,sc.t,sc.cols.map(k=>COLL[k]||k),rows.map(r=>sc.cols.map(k=>plain(cellVal(d.c,k,r)))),d.k,f)};
/* ============ البيانات التجريبية ومصادر البيانات الحقيقية ============
   تُنشأ في قاعدة Firebase الحقيقية نفسها وكل سجل منها يحمل demo:true، وأسماء الطلبة والمواد والكادر تنتهي بـ «(تجريبي)»
   لتظهر كذلك في تطبيق الحضور. بيان كامل بها في k_meta/demo، ويحذفها زر واحد دون المساس بالبيانات الحقيقية. */
const ATT_APP='https://drdshsw2022-byte.github.io/almaaqal/';
const DEMO_TAG=' (تجريبي)';
const DEMO_STAGES={ph:5,dent:5};
const DEMO_PFX={petroleum:'PE',civil:'CE',control:'CCE',ai:'AIE',cyber:'CYS',mechpower:'MPE',medlab:'MLT',radio:'RAD',anes:'ANS',bus:'BUS',ogm:'OGM',oge:'OGE',pharm:'PHM',dent:'DEN',law:'LAW',pe:'PES',clinpsy:'CPS',patho:'PAT'};
const DEMO_SUBJ={
  petroleum:['هندسة المكامن','حفر الآبار','إنتاج النفط','خواص الموائع','جيولوجيا النفط','تكرير النفط','نقل وخزن النفط','تقييم المكامن'],
  civil:['تحليل المنشآت','الخرسانة المسلحة','ميكانيك التربة','هندسة المساحة','هندسة الطرق','الموارد المائية','إدارة المشاريع','مواد البناء'],
  control:['أنظمة السيطرة','الإلكترونيات','المعالجات الدقيقة','الإشارات والأنظمة','برمجة الحاسوب','شبكات الحاسوب','السيطرة الرقمية','الروبوتات'],
  ai:['تعلم الآلة','الشبكات العصبية','معالجة اللغات','الرؤية الحاسوبية','هياكل البيانات','الخوارزميات','الإحصاء الهندسي','قواعد البيانات'],
  cyber:['أمن الشبكات','التشفير','التحليل الجنائي الرقمي','أمن التطبيقات','أنظمة التشغيل','اختبار الاختراق','إدارة المخاطر','أمن السحابة'],
  mechpower:['الديناميكا الحرارية','ميكانيك الموائع','انتقال الحرارة','محركات الاحتراق','تصميم المكائن','محطات القدرة','التبريد والتكييف','الرسم الهندسي'],
  medlab:['الكيمياء السريرية','الأحياء المجهرية','علم الدم','المناعة','الطفيليات','علم الأنسجة','بنك الدم','الوراثة الطبية'],
  radio:['فيزياء الإشعاع','التصوير بالأشعة السينية','التصوير المقطعي','الرنين المغناطيسي','الأمواج فوق الصوتية','التشريح الإشعاعي','الوقاية من الإشعاع','أجهزة التصوير'],
  anes:['علم التخدير','علم الأدوية','الإنعاش القلبي الرئوي','أجهزة التخدير','وظائف الأعضاء','التخدير الموضعي','العناية المركزة','إدارة الألم'],
  bus:['مبادئ الإدارة','المحاسبة المالية','التسويق','إدارة الموارد البشرية','الاقتصاد الجزئي','الإدارة الاستراتيجية','نظم المعلومات الإدارية','الإحصاء'],
  ogm:['تسويق النفط والغاز','اقتصاديات الطاقة','سلاسل الإمداد','العقود النفطية','إدارة المشاريع النفطية','التجارة الدولية','التسعير','إدارة المخاطر'],
  oge:['اقتصاديات النفط','الاقتصاد الكلي','الاقتصاد القياسي','أسواق الطاقة','المالية العامة','اقتصاديات الغاز','التنمية الاقتصادية','الاقتصاد الدولي'],
  pharm:['الكيمياء الصيدلانية','علم الأدوية','الصيدلانيات','العقاقير','الصيدلة السريرية','الكيمياء الحياتية','السموم','الصيدلة الصناعية'],
  dent:['تشريح الأسنان','الحشوات','جراحة الفم','تقويم الأسنان','طب أسنان الأطفال','أمراض اللثة','التعويضات السنية','الأشعة السنية'],
  law:['القانون المدني','القانون الدستوري','القانون الجنائي','القانون الإداري','قانون المرافعات','القانون التجاري','القانون الدولي العام','الأحوال الشخصية'],
  pe:['التربية الرياضية','فسلجة التدريب','علم النفس الرياضي','الألعاب الجماعية','ألعاب القوى','السباحة','الإصابات الرياضية','الاختبارات والقياس'],
  clinpsy:['علم النفس العام','علم النفس المرضي','الإرشاد النفسي','الاختبارات النفسية','علم النفس الفسيولوجي','العلاج النفسي','علم نفس النمو','الإحصاء النفسي'],
  patho:['الكيمياء الحياتية','علم الأحياء المجهرية','التحليلات المرضية','علم الدم','المناعة','الطفيليات','الوراثة','تقنيات المختبر'],
};
const DEMO_GEN=['الرياضيات','الفيزياء','اللغة الإنجليزية','حقوق الإنسان','الحاسوب','الكتابة الأكاديمية','أخلاقيات المهنة','الإحصاء'];
const DF=['محمد','علي','حسين','زينب','فاطمة','مريم','أحمد','حسن','سجاد','مصطفى','نور','رقية','عباس','كرار','دعاء','آية','يوسف','عمر','هدى','سارة','منتظر','بنين','ضحى','مرتضى','زهراء','حيدر','رسل','أمير','تبارك','جعفر'];
const DM=['عبد الله','جاسم','كاظم','عبد الحسين','قاسم','ناصر','فاضل','مهدي','صادق','رحيم','عادل','هادي','سلمان','ياسين','حمزة','رضا'];
const DL=['الموسوي','الحلفي','العيداني','البطاط','الأسدي','التميمي','الخفاجي','المالكي','الربيعي','الحسيني','الكعبي','السعدي','الجابري','العبادي','الساعدي','اللامي'];
const isDemo=x=>!!(x&&x.demo);
const demoMeta=()=>S.meta.get('demo')||null;
function demoRand(seed){let s=seed%2147483647||7;return()=>(s=(s*16807)%2147483647)/2147483647}
function nextWorkdays(n){const out=[];const d=new Date();d.setDate(d.getDate()+7);while(out.length<n){d.setDate(d.getDate()+1);const w=d.getDay();if(w!==5&&w!==6)out.push(d.toISOString().slice(0,10))}return out}
async function fbCommit(ops,prog,label){ // ops: [ref,data,opts]
  for(let i=0;i<ops.length;i+=400){const b=FB.writeBatch(FB.db);ops.slice(i,i+400).forEach(([r,d,o])=>o==='del'?b.delete(r):b.set(r,d,o||{}));await b.commit();if(prog)prog(`${label}: ${Math.min(i+400,ops.length)} / ${ops.length}`)}}
const waitFor=(fn,ms=20000)=>new Promise(res=>{const t0=Date.now();const iv=setInterval(()=>{if(fn()||Date.now()-t0>ms){clearInterval(iv);res(fn())}},300)});

async function demoSeed(prog){
  if(MODE!=='fb')throw new Error('إنشاء البيانات التجريبية يعمل على قاعدة Firebase.');
  if(!IS_TOP||!can('chair'))throw new Error('لمدير النظام أو رئيس الجامعة.');
  if(demoMeta()&&demoMeta().at)throw new Error('البيانات التجريبية موجودة مسبقاً. احذفها أولاً إن أردت إنشاءها من جديد.');
  const R=demoRand(Date.now()%100000+11);const pk=a=>a[Math.floor(R()*a.length)];
  const term=+cfg().curSem||1;const now=Date.now();const db=FB.db;const D=(c,id)=>FB.doc(db,c,id);
  const realGroups=new Set();RAW.students.forEach(v=>{if(!v.demo&&v.deptId)realGroups.add(v.deptId+'|'+(+v.stage))});
  const man={at:now,by:ME,students:[],courses:[],staff:[],halls:[],exams:[],slots:[],codes:[],incidents:[],appeals:[],kmarksCreated:[],kmarksRows:{}};
  const ops=[];const staffByDept={};const courseOps=[];const marks={};const groupsMade=[];
  let sn=0;const newSid=()=>{let id;do{sn++;id='99'+String(sn).padStart(8,'0')}while(RAW.students.has(id));return id};
  const depts=[...RAW.departments.entries()].map(([id,v])=>({id,name:v.name||id,col:v.collegeId||''}));
  for(const d of depts){
    const stages=DEMO_STAGES[d.col]||4;const subj=DEMO_SUBJ[d.id]||DEMO_GEN;const pfx=DEMO_PFX[d.id]||String(d.id).slice(0,3).toUpperCase();
    staffByDept[d.id]=[0,1].map(n=>({email:`demo.${d.id}.${n+1}@almaaqal.edu.iq`,name:`${n?'م.':'د.'} ${pk(DF)} ${pk(DM)} ${pk(DL)}${DEMO_TAG}`,title:n?'مدرس':'أستاذ مساعد',courseIds:[]}));
    for(let st=1;st<=stages;st++){
      if(realGroups.has(d.id+'|'+st))continue; // لا تُخلط بيانات تجريبية بمرحلة فيها طلبة حقيقيون
      let cs=[...RAW.courses.entries()].filter(([,v])=>v.deptId===d.id&&+(v.stage||0)===st&&+(v.term||((+v.semester-1)%2+1))===term).map(([id])=>id);
      if(!cs.length){for(let k=0;k<4;k++){const sem=(st-1)*2+term;const code=`${pfx}${st}${term}${k+1}`;const id=`${d.id}|${sem}|${code}`;if(RAW.courses.has(id))continue;
        const nm=(k<3?subj[(st*3+k)%subj.length]+' '+(term===1?'1':'2'):DEMO_GEN[(st+k)%DEMO_GEN.length])+DEMO_TAG;
        courseOps.push([D('courses',id),{id,deptId:d.id,semester:sem,stage:st,term,code,nameAr:nm,nameEn:'',ects:k<3?6:3,credits:k<3?3:2,demo:true}]);man.courses.push(id);cs.push(id)}}
      const sids=[];
      for(let i=0;i<8;i++){const id=newSid();const name=`${pk(DF)} ${pk(DM)} ${pk(DM)} ${pk(DL)}${DEMO_TAG}`;ops.push([D('students',id),{id,name,stage:st,shift:i<6?'morning':'evening',deptId:d.id,demo:true}]);man.students.push(id);sids.push({id,ab:0.45+R()*0.5})}
      cs.forEach((cid,k)=>{const t=staffByDept[d.id][k%2];const real=(RAW.staff.size&&[...RAW.staff.values()].some(s=>(s.courseIds||[]).includes(cid)));if(!real)t.courseIds.push(cid);
        const rows={};for(const s of sids){const a=s.ab;const P=(mx)=>Math.max(0,Math.min(mx,Math.round((a*mx+(R()-.5)*mx*.3)*2)/2));
          const o={demo:true,p_att:P(5),p_hw:P(5),p_proj:P(10),p_lab:P(10),p_quiz:P(10),p_mid:P(10)};o.cw=Math.round((o.p_att+o.p_hw+o.p_proj+o.p_lab+o.p_quiz+o.p_mid)*100)/100;
          const fin=P(50);o.e1=fin;o.e2=R()<0.01?Math.min(50,fin+1):fin;if(R()<0.02){o.abs=true;o.e1=0;o.e2=0}rows[s.id]=o}
        marks[cid]=rows;if(RAW.kmarks.has(cid))man.kmarksRows[cid]=sids.map(s=>s.id);else man.kmarksCreated.push(cid)});
      groupsMade.push({dept:d.id,col:d.col,stage:st,courses:cs,sids:sids.map(s=>s.id)});
    }
  }
  if(!groupsMade.length)throw new Error('لا توجد مراحل بلا طلبة حقيقيين لإضافة بيانات تجريبية إليها.');
  for(const [dep,list] of Object.entries(staffByDept))for(const t of list){if(RAW.staff.has(t.email))continue;const dv=RAW.departments.get(dep)||{};
    ops.push([D('staff',t.email),{id:t.email,email:t.email,name:t.name,role:'doctor',deptId:dep,collegeId:dv.collegeId||'',courseIds:t.courseIds,demo:true}]);
    ops.push([D('k_staffx',t.email),{title:t.title,coi:true,demo:true}]);man.staff.push(t.email)}
  const cols=[...new Set(groupsMade.map(g=>g.col))];
  cols.forEach(c=>{const cn=(RAW.colleges.get(c)||{}).name||c;for(let i=1;i<=2;i++){const id=`demo_h_${c}_${i}`;ops.push([D('k_halls',id),{name:`${cn.replace('كلية ','')} — القاعة ${i}${DEMO_TAG}`,building:cn,rows:8,cols:6,inv:2,demo:true}]);man.halls.push(id)}});
  const days=nextWorkdays(Math.max(1,...groupsMade.map(g=>g.courses.length)));const exams=[];
  groupsMade.forEach(g=>g.courses.forEach((cid,k)=>{const id='demo_ex_'+fsSafe(cid).replace(/\|/g,'_');exams.push(id);ops.push([D('k_exams',id),{course:cid,kind:'نهائي',date:days[k%days.length],period:String(g.stage%2?1:2),dur:120,demo:true}]);man.exams.push(id)}));
  prog('المواد');await fbCommit(courseOps,prog,'المواد');
  prog('الطلبة والكادر والقاعات والجدول');await fbCommit(ops,prog,'السجلات');
  const mops=Object.entries(marks).map(([cid,rows])=>[D('k_marks',fsSafe(cid)),man.kmarksCreated.includes(cid)?{rows,demo:true}:{rows},{merge:true}]);
  await fbCommit(mops,prog,'الدرجات');
  await fbCommit([[D('k_meta','demo'),man]],null,'');
  prog('انتظار وصول البيانات…');
  await waitFor(()=>man.exams.every(id=>S.exams.has(id))&&man.students.every(id=>S.students.has(id))&&man.halls.every(id=>S.halls.has(id))&&Object.keys(marks).every(c=>RAW.kmarks.has(c)),60000);
  await new Promise(r=>setTimeout(r,800));
  const hallIds=man.halls;
  for(const s of slotList()){const demoEx=s.exams.filter(e=>isDemo(e));if(!demoEx.length||S.slots.get(s.key))continue;
    prog('توزيع المقاعد: '+slotName(s));const seats=seatPlan({...s,exams:demoEx},hallIds);await put('slots',s.key,{seats,halls:hallIds,att:{},duties:[],dwarn:[],at:Date.now(),demo:true});man.slots.push(s.key)}
  await waitFor(()=>man.slots.every(k=>S.slots.has(k)));
  for(const k of man.slots){const s=slotList().find(x=>x.key===k);if(!s)continue;const p=dutyPlan(s);await patch('slots',k,{duties:p.duties,dwarn:p.warn})}
  const firstSlot=man.slots[0];
  for(const id of man.exams){const e=S.exams.get(id);if(!e)continue;prog('الأرقام السرية: '+label.exams(e));await makeCodes(id);await patch('codes',id,{demo:true,decoded:slotKey(e)!==firstSlot,decodedAt:Date.now()});man.codes.push(id)}
  // محاضر واعتراضات توضيحية
  const fx=man.exams.map(id=>S.exams.get(id)).filter(e=>e&&slotKey(e)===firstSlot);const st=[];
  for(const e of fx.slice(0,2)){const s=examStudents(e)[0];if(s)st.push([e,s])}
  for(const [i,[e,s]] of st.entries()){const id='demo_inc_'+i;await put('incidents',id,{student:s.id,exam:e.id,hall:hallIds[0],time:'10:'+(15+i*20),tool:i?'مسودة/ورقة':'هاتف محمول',desc:'واقعة توضيحية ضمن البيانات التجريبية.',witnesses:'المراقبون',statement:true,status:i?'محال إلى العميد':'موثق',at:Date.now()-i*36e5,demo:true});man.incidents.push(id)}
  const yr=new Date().getFullYear();const apSt=['new','audit','decision'];
  const cand=groupsMade.flatMap(g=>g.courses.slice(0,1).map(c=>[c,g.sids[1]])).slice(0,3);
  for(const [i,[cid,sid]] of cand.entries()){const r=res(cid,sid);if(r.state==='pending'||r.state==='dep')continue;const t=Date.now()-(i*20+2)*36e5;const id='demo_ap_'+i;
    const hist=[{ts:t,by:ME,from:'',to:'new',note:'تسجيل الاعتراض'}];if(i>0)hist.push({ts:t+36e5,by:ME,from:'new',to:'audit',note:'استلام الدفتر وبدء التدقيق'});if(i>1)hist.push({ts:t+5*36e5,by:ME,from:'audit',to:'review',note:'نتيجة التدقيق: خطأ في الجمع'},{ts:t+8*36e5,by:ME,from:'review',to:'decision',note:'المراجعة: تأكدت اللجنة'});
    const base={ref:`AP-${yr}-9${String(i+1).padStart(3,'0')}`,student:sid,course:cid,round:'1',reason:'اعتراض توضيحي ضمن البيانات التجريبية.',filedOn:new Date(t).toISOString().slice(0,10),assignee:'',st:'new',at:t,due:t+cfg().appealHours*36e5,oldFin:r.fin??null,oldTotal:r.total??null,oldState:r.pass?'ناجح':'راسب',createdBy:ME,hist:hist.slice(0,1),demo:true};
    await put('appeals',id,base); // قواعد Firestore: الاعتراض يُنشأ «جديداً» ثم ينتقل في مساره
    if(i>0)await put('appeals',id,{...base,st:apSt[i],hist,...(i>1?{auditNote:'خطأ في جمع درجات السؤال الثالث',proposedFin:Math.min(50,(r.fin||0)+3),reviewNote:'تأكدت اللجنة'}:{})});man.appeals.push(id)}
  await patch('meta','demo',{slots:man.slots,codes:man.codes,incidents:man.incidents,appeals:man.appeals,done:Date.now()});
  await log('إنشاء بيانات تجريبية',`${groupsMade.length} مرحلة في ${new Set(groupsMade.map(g=>g.dept)).size} قسماً: ${man.students.length} طالباً، ${man.courses.length} مادة، ${man.staff.length} من الكادر، ${man.halls.length} قاعة، ${man.exams.length} امتحاناً، ${man.slots.length} جلسة`);
  return man;
}
async function demoPurge(prog){
  if(MODE!=='fb'||!IS_TOP||!can('chair'))throw new Error('لمدير النظام أو رئيس الجامعة.');
  const m=demoMeta();if(!m)throw new Error('لا توجد بيانات تجريبية مسجلة.');const db=FB.db;const D=(c,id)=>FB.doc(db,c,id);
  const ops=[];const add=(c,ids)=>(ids||[]).forEach(id=>ops.push([D(c,id),null,'del']));
  add('k_appeals',m.appeals);add('k_incidents',m.incidents);add('k_codes',m.codes);add('k_slots',m.slots);add('k_exams',m.exams);add('k_halls',m.halls);
  add('k_marks',(m.kmarksCreated||[]).map(fsSafe));add('k_staffx',m.staff);add('staff',m.staff);add('students',m.students);add('courses',m.courses);
  // ما فات البيان: أي سجل كنترول يحمل demo:true
  [['appeals','k_appeals'],['incidents','k_incidents'],['exams','k_exams'],['halls','k_halls'],['slots','k_slots'],['codes','k_codes']].forEach(([c,k])=>arr(c).filter(isDemo).forEach(x=>{if(!ops.some(o=>o[0].path===k+'/'+x.id))ops.push([D(k,x.id),null,'del'])}));
  await fbCommit(ops,prog,'الحذف');
  for(const [cid,sids] of Object.entries(m.kmarksRows||{})){const ref=D('k_marks',fsSafe(cid));const args=sids.flatMap(s=>[new FB.FieldPath('rows',s),FB.deleteField()]);if(args.length)await FB.updateDoc(ref,...args).catch(()=>{})}
  await FB.deleteDoc(D('k_meta','demo'));
  await log('حذف البيانات التجريبية',`${ops.length} سجل`);return ops.length;
}
function demoRunUI(fn,title){$('#modal').innerHTML=`<div class="dlg"><h3>${esc(title)}</h3><p class="mut" id="dprog">جارٍ التحضير…</p><p class="mut" style="font-size:12px">لا تغلق الصفحة حتى ينتهي.</p></div>`;$('#modal').hidden=false;
  const pr=t=>{const e=$('#dprog');if(e)e.textContent=t};return fn(pr).then(r=>{closeModal();return r}).catch(e=>{closeModal();throw e})}
ACT.demoseed=async(d,b)=>{if(!b.dataset.sure){b.dataset.sure='1';b.textContent='اضغط مرة أخرى للتأكيد — ستُكتب في القاعدة الحقيقية';return}
  const m=await demoRunUI(demoSeed,'إنشاء البيانات التجريبية');toast(`أُنشئت: ${m.students.length} طالباً، ${m.courses.length} مادة، ${m.exams.length} امتحاناً`);go('demo')};
ACT.demopurge=async(d,b)=>{if(!b.dataset.sure){b.dataset.sure='1';b.textContent='اضغط مرة أخرى لتأكيد حذف كل البيانات التجريبية';return}
  const n=await demoRunUI(demoPurge,'حذف البيانات التجريبية');toast(`حُذف ${n} سجل تجريبي`);go('demo')};
VIEW.demo=()=>{
  const m=demoMeta();const top=MODE==='fb'&&IS_TOP&&can('chair')&&!RO;
  const cnt=(list)=>{const d=list.filter(isDemo).length;return [d,list.length-d]};
  const sg=[...RAW.sgrades.values()].reduce((a,m2)=>a+m2.size,0);const km=arr('grades').reduce((a,g)=>{Object.values(g.rows||{}).forEach(r=>{if(r&&num(r.e1)!=null){r.demo?a[0]++:a[1]++}});return a},[0,0]);
  const cwDemo=arr('grades').reduce((a,g)=>a+Object.values(g.rows||{}).filter(r=>r&&r.demo&&num(r.cw)!=null).length,0);
  const A=(href,l,ext)=>`<a class="btn sm" href="${href}"${ext?' target="_blank" rel="noopener"':` data-nav="${href.slice(1)}"`}>${l}</a>`;
  const rows=[
    ['الكليات والأقسام',[0,RAW.departments.size],'حقيقية (9 كليات و18 قسماً من مواقع الجامعة). أي كلية أو قسم جديد: تطبيق الحضور ← لوحة الإدارة ← «رفع Excel» ← الكليات والأقسام، أو «الكليات والأقسام» في الكنترول.',A('#depts','الكليات والأقسام')],
    ['الطلبة',cnt(arr('students')),'تطبيق الحضور ← لوحة الإدارة ← «رفع Excel» ← الطلاب (الرقم المعرفي، الاسم، القسم، المرحلة، الدوام). يقبل ملف الطلاب الأصلي كما هو.',A(ATT_APP,'فتح تطبيق الحضور',1)],
    ['المواد الدراسية',cnt(arr('courses')),'تطبيق الحضور ← لوحة الإدارة ← «رفع Excel» ← المواد (القسم، المرحلة، الكورس، رمز المقرر، الاسم، ECTS). يقبل ملف Resources الأصلي.',A(ATT_APP,'فتح تطبيق الحضور',1)],
    ['الكادر وتكليف المواد',cnt(arr('staff')),'تطبيق الحضور ← لوحة الإدارة ← «رفع Excel» ← الكادر (البريد، الاسم، الصفة، الكلية، القسم)، ثم «الكادر» لربط كل تدريسي بمواده.',A(ATT_APP,'فتح تطبيق الحضور',1)],
    ['درجات السعي (الحضور، الواجب، المشروع، المختبر، الأسبوعي، الفصلي)',[cwDemo,sg],'يرصدها التدريسي في تطبيق الحضور ← «موادي» ← الدرجات، أو «رفع نتائج الطلبة» من ملف Excel. تظهر في الكنترول لحظياً.',A(ATT_APP,'فتح تطبيق الحضور',1)],
    ['اللقب وتعارض المصالح',cnt(arr('staff')),'الكنترول ← «الكادر وتعارض المصالح» ← تعديل: اللقب، أقارب الطلبة، أيام عدم التوفر، توقيع الإقرار.',A('#staff','الكادر')],
    ['القاعات',cnt(arr('halls')),'الكنترول ← «القاعات» ← إضافة قاعة (الصفوف × الأعمدة، وعدد المراقبين).',A('#halls','القاعات')],
    ['الجدول الامتحاني',cnt(arr('exams')),'الكنترول ← «الجدول الامتحاني» ← إضافة امتحان لكل مادة (التاريخ والجلسة).',A('#exams','الجدول')],
    ['توزيع المقاعد والمراقبين',cnt(arr('slots')),'تلقائي من الجدول والقاعات والكادر: «توزيع المقاعد» ثم «اللجان والمراقبون» لكل جلسة.',A('#seating','توزيع المقاعد')],
    ['الأرقام السرية',cnt(arr('codes')),'الكنترول ← «التشفير والأرقام السرية» ← توليد لكل امتحان، وفك التشفير لرئيس اللجنة.',A('#coding','التشفير')],
    ['درجات الامتحان النهائي',km,'الكنترول ← «رصد الدرجات» ← النهائي (إدخال أول ثم إدخال ثانٍ أعمى من مدقق آخر).',A('#grading','رصد الدرجات')],
    ['محاضر الغش',cnt(arr('incidents')),'الكنترول ← «محاضر الغش» (يحررها المراقب يوم الامتحان).',A('#incidents','محاضر الغش')],
    ['الاعتراضات',cnt(apList()),'الكنترول ← «الاعتراضات» ← تسجيل اعتراض.',A('#appeals','الاعتراضات')],
  ];
  return ph('البيانات التجريبية ومصادر البيانات الحقيقية','بيانات تجريبية تملأ كل أقسام النظام لتجربته كاملاً على القاعدة الحقيقية. كل سجل تجريبي معلَّم «تجريبي»، وأسماء الطلبة والمواد والكادر تنتهي بـ «(تجريبي)» فتظهر كذلك في تطبيق الحضور أيضاً. لا تُضاف إلى أي مرحلة فيها طلبة حقيقيون، وتُحذف كلها بزر واحد دون المساس بالبيانات الحقيقية.')+
  `<div class="card" style="margin-bottom:14px">${m?`<div class="alert" style="margin-bottom:10px">أُنشئت بيانات تجريبية في ${esc(fmtTs(m.at))}: ${(m.students||[]).length} طالباً، ${(m.courses||[]).length} مادة، ${(m.staff||[]).length} من الكادر، ${(m.halls||[]).length} قاعة، ${(m.exams||[]).length} امتحاناً، ${(m.slots||[]).length} جلسة.</div>`:'<p class="mut" style="margin-top:0">لا توجد بيانات تجريبية الآن.</p>'}
  <div class="row">${top?(m?`<button class="btn bad" data-act="demopurge">حذف كل البيانات التجريبية</button>`:`<button class="btn pri" data-act="demoseed">إنشاء بيانات تجريبية لكل الكليات والأقسام</button>`):'<span class="mut">الإنشاء والحذف لمدير النظام أو رئيس الجامعة على قاعدة Firebase.</span>'}</div>
  <p class="mut" style="margin-bottom:0">التجريبي لا يُنشر للطلبة: لا تصادق على نتائج مرحلة تجريبية ولا تنشرها. احذف التجريبي قبل بدء الامتحانات الفعلية.</p></div>`+
  `<div class="tw"><table><thead><tr><th>الفقرة</th><th>تجريبي</th><th>حقيقي</th><th>أين تُحمَّل البيانات الحقيقية</th><th></th></tr></thead><tbody>${rows.map(([t,[d,r],w,a])=>`<tr><td><b>${esc(t)}</b></td><td>${d?`<span class="pill warn">${d}</span>`:'—'}</td><td>${r}</td><td class="wrap">${esc(w)}</td><td>${a}</td></tr>`).join('')}</tbody></table></div>`;
};
ACT.orphandel=async(d,b)=>{
  if(MODE!=='fb'||!IS_TOP)throw new Error('لمدير النظام.');
  const list=[];RAW.sgrades.forEach((m,cid)=>{const c=S.courses.get(cid);if(!c)return;const ids=new Set(courseStudents(c).map(s=>s.id));m.forEach((x,sid)=>{if(!ids.has(sid))list.push([cid,sid])})});
  if(!list.length)return toast('لا توجد درجات خارج طلبة المواد');
  if(!b.dataset.sure){b.dataset.sure='1';b.textContent=`اضغط مرة أخرى لحذف ${list.length} سجل درجات نهائياً من تطبيق الحضور`;return}
  await demoRunUI(async pr=>{await fbCommit(list.map(([c,s])=>[FB.doc(FB.db,'grades',fsSafe(c+'_'+s)),null,'del']),pr,'الحذف')},'حذف الدرجات المرصودة لطلبة من خارج المادة');
  await log('حذف درجات خارج طلبة المادة',`${list.length} سجل من مجموعة grades`);toast(`حُذف ${list.length} سجل`)};

ACT.close=closeModal;
ACT.logout=async()=>{try{await FB.signOut(FB.auth)}catch(e){}};
ACT.publish=async()=>{
  if(MODE!=='fb'||!IS_ADMIN)throw new Error('نشر النتائج صلاحية رئيس اللجنة.');
  const k=UI.group;if(!isLocked(k))throw new Error('صادق على نتائج المرحلة أولاً.');
  const ops=[];const studs=groupStudents(k);
  for(const c of groupCourses(k)){for(const s of studs){const r=res(c.id,s.id);if(r.state==='dep'||r.state==='pending')continue;
      const fin=Math.round(((r.round===1?r.fin+(r.grace||0):r.fin))*100)/100;
      ops.push([FB.doc(FB.db,'grades',fsSafe(c.id+'_'+s.id)),{courseId:c.id,studentId:s.id,studentName:s.name,marks:{final:fin},updatedAt:Date.now()}])}
    ops.push([FB.doc(FB.db,'schemes',fsSafe(c.id)),{id:c.id,courseId:c.id,published:FB.arrayUnion('final')}])}
  for(let i=0;i<ops.length;i+=400){const b=FB.writeBatch(FB.db);ops.slice(i,i+400).forEach(([r,d])=>b.set(r,d,{merge:true}));await settle(b.commit())}
  await patch('meta','locks',{[k.replace('|','_')]:{published:Date.now(),publishedBy:ME}});
  await log('نشر النتائج للطلبة',`${groupName(k)}: ${ops.length} سجل إلى تطبيق الحضور`);toast('نُشرت الدرجات النهائية، وتظهر للطلبة في تطبيق الحضور');
};
ACT.new=d=>openForm(d.c);
ACT.edit=d=>openForm(d.c,d.id);
ACT.askdel=d=>{UI.cdel=d.k;render();setTimeout(()=>{if(UI.cdel===d.k){UI.cdel='';sched()}},5000)};
ACT.del=async d=>{const r=S[d.c].get(d.id);await del(d.c,d.id);UI.cdel='';await log('حذف',`${SCHEMA[d.c].one}: ${r?(r.name||r.no||r.code||d.id):d.id}`);toast('حُذف السجل')};
ACT.gtab=d=>{UI.gtab=d.t;render()};
ACT.hall=d=>{UI.hall=d.h;render()};
ACT.import=()=>{$('#modal').innerHTML=`<form class="dlg" data-form="import"><h3>استيراد طلبة من Excel</h3><p class="mut">انسخ عمودين من Excel (الرقم الامتحاني ثم الاسم) والصقهما هنا، سطر لكل طالب.</p><div class="fgrid"><label class="f">القسم *${fieldHtml({k:'dept',type:'ref',ref:'depts',req:1})}</label><label class="f">المرحلة *${fieldHtml({k:'stage',type:'stage',req:1})}</label><label class="f">الدراسة${fieldHtml({k:'shift',type:'sel',o:['صباحي','مسائي']})}</label></div><label class="f" style="margin-top:10px">البيانات<textarea name="data" id="impdata" class="mono" placeholder="2601001	علي حسين جاسم الموسوي" required></textarea></label><div class="row" style="margin-top:12px"><button class="btn pri" type="submit">استيراد</button><button class="btn" type="button" data-act="close">إلغاء</button></div><p class="mut" id="ferr"></p></form>`;$('#modal').hidden=false};
async function doImport(form){const dept=form.elements.dept.value,stage=form.elements.stage.value,shift=form.elements.shift.value;const have=new Set(arr('students').map(s=>String(s.no)));const items=[];let dup=0;
  for(const line of form.elements.data.value.split(/\r?\n/)){const p=line.split(/\t|,|;/).map(x=>x.trim()).filter(Boolean);if(p.length<2)continue;const no=/\d/.test(p[0])?p[0]:p[1],name=/\d/.test(p[0])?p.slice(1).join(' '):p[0];if(have.has(no)){dup++;continue}have.add(no);items.push({c:'students',id:rid()+items.length,data:{no,name,dept,stage,shift}})}
  if(!items.length){$('#ferr').textContent=dup?'كل الأرقام موجودة مسبقاً.':'لم يُعثر على أسطر صالحة (رقم ثم اسم).';return}
  await bulk(items);await log('استيراد طلبة',`${items.length} طالباً إلى ${groupName(groupKey(dept,stage))}`);closeModal();toast(`استُورد ${items.length} طالباً${dup?` وتُجوهل ${dup} مكرر`:''}`)}
async function saveSettings(form){const o={};for(const el of form.elements){if(!el.name)continue;o[el.name]=el.type==='checkbox'?el.checked:el.type==='number'?num(el.value):el.value}await patch('meta','settings',o);await log('تعديل الإعدادات','ضوابط الدرجات والدورة');toast('حُفظت الإعدادات')}
function hallsChecked(){return [...document.querySelectorAll('[data-hall]')].filter(x=>x.checked).map(x=>x.dataset.hall)}
ACT.seat=async()=>{const slot=slotList().find(s=>s.key===UI.slot);const hs=hallsChecked();const seats=seatPlan(slot,hs);const old=S.slots.get(slot.key)||{};await put('slots',slot.key,{seats,halls:hs,att:old.att||{},duties:[],dwarn:[],at:Date.now()});await log('توزيع المقاعد',`${slotName(slot)}: ${seats.length} طالباً`);toast(`وُزع ${seats.length} طالباً — أعد تكليف المراقبين لهذه الجلسة`)};
ACT.seatall=async()=>{let n=0,errs=[];const hs=hallsChecked();for(const s of slotList()){try{const seats=seatPlan(s,hs);const old=S.slots.get(s.key)||{};await put('slots',s.key,{seats,halls:hs,att:old.att||{},duties:[],dwarn:[],at:Date.now()});n++}catch(e){errs.push(slotName(s)+': '+e.message)}}await log('توزيع المقاعد',`${n} جلسة دفعة واحدة`);toast(`وُزعت ${n} جلسة`);errs.forEach(e=>toast(e,'bad'))};
ACT.duty=async d=>{const s=slotList().find(x=>x.key===d.k);const p=dutyPlan(s);await patch('slots',s.key,{duties:p.duties,dwarn:p.warn});await log('تكليف المراقبين',slotName(s));toast(p.warn.length?'كُلّف المراقبون مع نقص في بعض القاعات':'كُلّف المراقبون')};
ACT.dutyall=async()=>{let n=0;for(const s of slotList()){try{const p=dutyPlan(s);await patch('slots',s.key,{duties:p.duties,dwarn:p.warn});n++}catch(e){}}await log('تكليف المراقبين',`${n} جلسة`);toast(`كُلّف المراقبون في ${n} جلسة`)};
ACT.envstep=async d=>{const o={[d.s]:{at:Date.now(),by:ME}};
  if(d.s==='ret'){openRet(d.e);return}await patch('envelopes',d.e,o);await log('ظرف امتحاني',`${ENV.find(x=>x[0]===d.s)[1]} — ${label.exams(S.exams.get(d.e))}`)};
function openRet(eid){const pc=presentCount(S.exams.get(eid));$('#modal').innerHTML=`<form class="dlg" data-form="ret" data-id="${eid}"><h3>إعادة الدفاتر للكنترول</h3><p class="mut">${esc(label.exams(S.exams.get(eid)))} — الحاضرون وفق سجل الحضور: <b>${pc}</b></p><label class="f">عدد الدفاتر المستلمة فعلاً<input type="number" name="count" id="retc" min="0" value="${pc}" required></label><div class="row" style="margin-top:12px"><button class="btn pri" type="submit">تثبيت الاستلام</button><button class="btn" type="button" data-act="close">إلغاء</button></div></form>`;$('#modal').hidden=false;$('#retc').focus()}
ACT.att=async d=>{const sd=S.slots.get(UI.slot);const cur=(sd.att||{})[d.s];await patch('slots',UI.slot,{att:{[d.s]:cur===d.v?null:d.v}})};
ACT.allp=async()=>{const sd=S.slots.get(UI.slot);const att=sd.att||{};const o={};sd.seats.filter(x=>x.h===UI.hall&&!att[x.s]).forEach(x=>o[x.s]='p');if(!Object.keys(o).length)return toast('لا يوجد غير مسجلين');await patch('slots',UI.slot,{att:o});toast(`سُجل ${Object.keys(o).length} حاضراً`)};
ACT.incnext=async d=>{const x=S.incidents.get(d.id);const st=SCHEMA.incidents.f.find(f=>f.k==='status').o;const nx=st[st.indexOf(x.status||'موثق')+1];if(nx==='صدر القرار'&&!x.decision){openForm('incidents',d.id,null);toast('اكتب نص القرار ثم اختر «صدر القرار»');return}await patch('incidents',d.id,{status:nx,[`t_${st.indexOf(nx)}`]:Date.now()});await log('محضر غش',`${label.students(S.students.get(x.student))} ← ${nx}`)};
ACT.mkcodes=async d=>{await makeCodes(d.e);await log('توليد أرقام سرية',label.exams(S.exams.get(d.e)));toast('وُلدت الأرقام السرية — الرصد أعمى الآن')};
ACT.decode=async d=>{if(!IS_ADMIN)throw new Error('فك التشفير صلاحية رئيس اللجنة فقط.');if(UI.cdel!=='DEC'+d.e){UI.cdel='DEC'+d.e;toast('اضغط «فك التشفير» مرة ثانية للتأكيد. العملية تُسجل ولا تُلغى.');setTimeout(()=>{UI.cdel=''},5000);return}UI.cdel='';await patch('codes',d.e,{decoded:true,decodedAt:Date.now(),decodedBy:ME});await log('فك التشفير',label.exams(S.exams.get(d.e)));toast('فُك التشفير وظهرت الأسماء')};
ACT.savegrades=async()=>{const c=S.courses.get(UI.course);if(isLocked(groupKey(c.dept,c.stage)))throw new Error('نتائج هذه المرحلة مصادق عليها ومقفلة. يلغي رئيس اللجنة المصادقة أولاً، ويُسجَّل ذلك في سجل التدقيق.');const dr=DRAFT[c.id]||{};const st=cfg();const rows={};let bad=0;
  for(const [sid,o] of Object.entries(dr)){const r={};for(const [f,v] of Object.entries(o)){if(f==='dep'||f==='abs'){r[f]=!!v;continue}const n=num(v);const pp=(cfg().parts||PARTS).find(p=>'p_'+p[0]===f);const mx=pp?pp[2]:f==='cw'?st.cwMax:f==='absPct'?100:st.finMax;if(n!=null&&(n<0||n>mx)){bad++;continue}r[f]=n}rows[sid]=r}
  if(bad)throw new Error(`${bad} قيمة خارج المدى المسموح. صحّح الخانات المؤطرة بالأحمر.`);
  if(partsOn())for(const sid of Object.keys(rows)){if(Object.keys(rows[sid]).some(f=>f.startsWith('p_'))){const m={...(G(c.id)[sid]||{}),...rows[sid]};rows[sid].cw=partSum(sid,(x,f)=>m[f])}}
  await patch('grades',c.id,{rows});delete DRAFT[c.id];
  const tabN={cw:'السعي',e1:'النهائي (إدخال أول)',e2:'النهائي (إدخال ثانٍ)',sec:'الدور الثاني'}[UI.gtab];
  await log('رصد درجات',`${label.courses(c)} · ${tabN} · ${Object.keys(rows).length} طالباً`);
  const mis=courseStudents(c).filter(s=>res(c.id,s.id).mismatch).length;toast(mis?`حُفظ الرصد — ${mis} تعارض بين الإدخالين`:'حُفظ الرصد')};
ACT.dropdraft=()=>{delete DRAFT[UI.course];render()};
ACT.resolve=async d=>{const r=G(UI.course)[d.s]||{};const v=r[d.w];await patch('grades',UI.course,{rows:{[d.s]:{e1:v,e2:v}}});await log('حسم تعارض رصد',`${label.courses(S.courses.get(UI.course))} · ${blind(UI.course)?((codesFor(UI.course)||{}).map||{})[d.s]:label.students(S.students.get(d.s))} → ${v}`)};
ACT.absfromatt=()=>{const c=S.courses.get(UI.course);const e=examOf(c.id);if(!e)return toast('لا يوجد امتحان مجدول لهذه المادة','bad');const att=(S.slots.get(slotKey(e))||{}).att||{};let n=0;DRAFT[c.id]=DRAFT[c.id]||{};courseStudents(c).forEach(s=>{if(att[s.id]==='a'){DRAFT[c.id][s.id]={...(DRAFT[c.id][s.id]||{}),abs:true};n++}});toast(n?`عُلّم ${n} غائباً — اضغط «حفظ الرصد»`:'لا يوجد غائبون في سجل الحضور');render()};
ACT.applygrace=async()=>{const k=UI.group;const plan=gracePlan(k);const by=new Map();
  groupCourses(k).forEach(c=>by.set(c.id,{}));groupCourses(k).forEach(c=>groupStudents(k).forEach(s=>{if(num((G(c.id)[s.id]||{}).grace))by.get(c.id)[s.id]={grace:null}}));
  plan.forEach(p=>p.app.forEach(x=>{by.get(x.c.id)[p.s.id]={grace:x.need}}));
  for(const [cid,rows] of by)if(Object.keys(rows).length)await patch('grades',cid,{rows});
  const n=plan.reduce((a,p)=>a+p.app.length,0);await log('اعتماد الرأفة',`${groupName(k)}: ${n} مادة لـ ${plan.filter(p=>p.app.length).length} طالباً`);toast(`اعتُمدت الرأفة لـ ${n} مادة`)};
ACT.cleargrace=async()=>{const k=UI.group;for(const c of groupCourses(k)){const rows={};groupStudents(k).forEach(s=>{if(num((G(c.id)[s.id]||{}).grace))rows[s.id]={grace:null}});if(Object.keys(rows).length)await patch('grades',c.id,{rows})}await log('إلغاء الرأفة',groupName(k));toast('أُلغيت الرأفة')};
ACT.lock=async d=>{const k=UI.group.replace('|','_');await patch('meta','locks',{[k]:d.v==='1'?{at:Date.now(),by:ME}:null});await log(d.v==='1'?'مصادقة النتائج':'إلغاء المصادقة',groupName(UI.group));toast(d.v==='1'?'صودق على النتائج وقُفلت':'أُلغيت المصادقة')};
ACT.chain=async()=>{const a=arr('audit').sort((x,y)=>x.ts-y.ts);let breaks=0,first=null;for(let i=0;i<a.length;i++){const x=a[i];const h=await sha256([x.prev,x.ts,x.by,x.action,x.detail].join('|'));const prevOk=i===0?true:x.prev===a[i-1].hash;if(h!==x.hash||!prevOk){breaks++;if(!first)first=x}}
  chainRes=breaks?{ok:false,msg:`وُجد ${breaks} موضع انقطاع في السلسلة، أولها ${fmtTs(first.ts)} (${first.action}). قد يعني ذلك تعديلاً لاحقاً، أو تسجيلاً متزامناً من جهازين في اللحظة نفسها.`}:{ok:true,msg:`السلسلة سليمة: تحققت ${a.length} عملية متتالية دون أي تلاعب.`};render()};
ACT.ai=async()=>{const cs=arr('courses').map(c=>({c,s:statsFor(c)})).filter(x=>x.s);const data=cs.map(x=>({المادة:x.c.name,المرحلة:groupName(groupKey(x.c.dept,x.c.stage)),العدد:x.s.n,المتوسط:+x.s.m.toFixed(1),الوسيط:x.s.med,الانحراف:+x.s.sd.toFixed(1),نسبة_النجاح:Math.round(x.s.pr*100),التوزيع_بالعشرات:(()=>{const b=new Array(10).fill(0);x.s.t.forEach(v=>b[Math.min(9,Math.floor(v/10))]++);return b})()}));
  UI.aiBusy=true;UI.ai='';render();
  try{const out=await sampleCap(`أنت محلل إحصائي في لجنة امتحانية جامعية عراقية. درجة النجاح ${cfg().pass} من 100. هذه إحصاءات المواد (التوزيع بالعشرات من 0-9 إلى 90-100):\n${JSON.stringify(data)}\n\nاكتب تقريراً عربياً موجزاً (لا يتجاوز 220 كلمة) للجنة: 1) المواد التي تظهر مؤشرات تساهل أو تشدد ولماذا، 2) أي توزيع غير طبيعي (ثنائي القمة، تكدس عند حد النجاح يوحي بتعديل يدوي، تباين منخفض)، 3) توصيات إجرائية محددة. لا تستخدم تنسيق Markdown، استخدم أسطراً مرقمة بسيطة.`,{onText:({text})=>{UI.ai=text;sched()}});UI.ai=out.text}catch(e){UI.ai='';toast(e.code==='rate_limited'?'طلبات كثيرة، أعد المحاولة بعد قليل':'تعذر التحليل الذكي الآن','bad')}UI.aiBusy=false;render()};
ACT.wipe=async()=>{UI.cdel='';for(const c of COLLS){for(const id of [...S[c].keys()]){if(MODE==='cloud')await db.collection(c).doc(id).delete();S[c].delete(id)}}saveLocal();if(MODE==='local')try{localStorage.removeItem(LKEY)}catch(e){}toast('مُسحت كل البيانات');render()};
ACT.syncstruct=async()=>{
  if(MODE==='fb'){
    if(!IS_TOP)throw new Error('تعديل هيكل الجامعة لمدير النظام أو رئيس الجامعة.');
    const ops=planStructure(RAW.colleges,RAW.departments);if(!ops.length)return toast('الهيكل مكتمل');
    const b=FB.writeBatch(FB.db);ops.forEach(o=>b.set(FB.doc(FB.db,o.c,o.id),o.data,{merge:true}));await settle(b.commit());
    await log('مزامنة هيكل الجامعة',ops.map(o=>o.label).join('، '));toast(`أُضيف ${ops.length} سجل إلى هيكل الجامعة`);return}
  const dm=new Map(arr('depts').map(d=>[d.id,{name:d.name,collegeId:d.college?'x':''}]));
  const cname=Object.fromEntries(UNIV_STRUCT.map(c=>[c.id,c.name]));
  const ops=planStructure(new Map(),dm).filter(o=>o.c==='departments');
  const items=ops.map(o=>o.link?{c:'depts',id:o.id,data:{...S.depts.get(o.id),college:cname[o.data.collegeId]||''}}:{c:'depts',id:o.id,data:{name:o.data.name,code:o.id,college:cname[o.data.collegeId]||''}});
  if(!items.length)return toast('الهيكل مكتمل');
  await bulk(items);await log('مزامنة هيكل الجامعة',`${items.length} قسم`);toast(`أُضيف ${items.length} قسم`)};
ACT.backup=async()=>{const o={app:'kontrol',v:3,at:new Date().toISOString(),by:ME};COLLS.forEach(c=>o[c]=arr(c));await download(`kontrol-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(o,null,1));
  if(can('chair')&&!RO){try{await patch('meta','backup',{at:Date.now(),by:ME,n:COLLS.reduce((a,c)=>a+S[c].size,0)});await log('نسخة احتياطية','نُزّلت نسخة كاملة من سجلات الكنترول')}catch(e){}}};
ACT.sample=async()=>{await loadSample();toast('حُمّلت البيانات التجريبية');go('dash')};

/* ============ استيراد Excel ============ */
const normAr=x=>String(x??'').replace(/[ً-ْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/انكليز/g,'انجليز').replace(/[\r\n]+/g,' ').replace(/\s+/g,' ').trim();
const STW=[['الاولي',1],['الثانيه',2],['الثالثه',3],['الرابعه',4],['الخامسه',5],['السادسه',6]];
const stageOf=t=>{const n=normAr(t);for(const [w,v] of STW)if(n.includes(w))return v;return null};
const shiftOf=t=>{const n=normAr(t);return n.includes('مسائي')?'مسائي':n.includes('صباحي')?'صباحي':null};
const toks=t=>normAr(t).replace(/[()|\-–:,.\/]/g,' ').split(' ').map(w=>w.replace(/^(ال|و)/,'')).filter(w=>w.length>2);
let IMP=null;
async function readBooks(files){
  if(typeof XLSX==='undefined')throw new Error('تعذر تحميل قارئ Excel. أعد فتح الصفحة ثم حاول مجدداً.');
  const out=[];for(const f of files){const wb=XLSX.read(await f.arrayBuffer(),{type:'array'});out.push({name:f.name,wb})}return out;
}
function analyze(books,dept){
  const sheets=[],newDepts=new Map(),courses=new Map(),studs=new Map(),grades=[];
  const depName=new Map(arr('depts').map(d=>[normAr(d.name),d.id]));
  for(const {name,wb} of books)for(const sn of wb.SheetNames){
    const A=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,raw:true,defval:null});
    const hi=A.findIndex(r=>r&&r.some(c=>{const n=normAr(c);return n.length<25&&/الرقم المعرفي|الرقم الامتحاني|رمز المقرر/.test(n)}));
    const info={file:name,sheet:sn,type:'تجاهل',ok:0,bad:[],target:''};sheets.push(info);
    if(hi<0){info.why='لا يوجد صف عناوين معروف';continue}
    const raw=A[hi].map(h=>String(h??''));const H=raw.map(normAr);const title=A.slice(0,hi).flat().filter(Boolean).join(' ');
    const col=(...k)=>H.findIndex(h=>h&&k.some(x=>h.includes(normAr(x))));
    const rows=A.slice(hi+1);
    if(col('رمز المقرر')>=0){
      info.type='مواد';const cCode=col('رمز المقرر'),cName=col('اسم الماده بالعربيه','اسم الماده'),cEn=col('بالانجليزيه','بالانكليزيه'),cDept=col('القسم'),cStage=col('المرحله'),cSemG=col('الفصل الدراسي'),cSem=col('فصل السنه'),cEcts=col('ects'),cKey=col('معرف الماده');
      for(const r of rows){if(!r||!r[cCode])continue;const code=String(r[cCode]).trim();const dn=cDept>=0&&r[cDept]?String(r[cDept]):title.split(' ').slice(0,3).join(' ');
        const key=cKey>=0&&r[cKey]?String(r[cKey]).split('|')[0]:null;let did=depName.get(normAr(dn));
        if(!did){did='d_'+(key||('x'+[...normAr(dn)].reduce((a,ch)=>(a*31+ch.charCodeAt(0))>>>0,7).toString(36)));depName.set(normAr(dn),did);if(!S.depts.get(did))newDepts.set(did,{name:String(dn).trim(),code:key||''})}
        const stg=stageOf(r[cStage])||num(r[cStage]);const semG=num(r[cSemG]);const sem=r[cSem]!=null?(normAr(r[cSem]).includes('ثاني')||r[cSem]==2?'2':'1'):(semG?String((semG-1)%2+1):'1');
        if(!stg){info.bad.push(`${code}: مرحلة غير مفهومة`);continue}
        const id=`c_${did.slice(2)}_${semG||stg*2-(sem==='1'?1:0)}_${code}`;
        if(!courses.has(id)){const old=S.courses.get(id)||{};courses.set(id,{...strip(old),code,name:String(r[cName]||code).trim(),nameEn:cEn>=0?String(r[cEn]||''):'',dept:did,stage:String(stg),sem,ects:num(r[cEcts])});info.ok++}}
      info.target=`${courses.size} مادة`;continue}
    const cId=col('الرقم المعرفي','الرقم الامتحاني'),cNm=col('اسم الطالب');
    if(H.some(h=>h.includes('مجموع')||h.includes('المعدل'))&&!H.some(h=>h.includes('امتحان')&&h.includes('نهائي'))){info.why='ورقة محصلة (تُحسب تلقائياً)';continue}
    if(H.some(h=>h.includes('امتحان')&&h.includes('نهائي'))){
      info.type='درجات';
      const stT=stageOf(title);const pool=arr('courses').concat([...courses.entries()].map(([id,c])=>({...c,id}))).filter(c=>(!dept||c.dept===dept)&&semOk(c)&&(!stT||+c.stage===stT));
      const ctx=toks(sn+' '+((normAr(title).match(/ماده:?\s*([^|]+)/)||[])[1]||''));const en=(title.match(/\(([^)]*[A-Za-z][^)]*)\)/)||[])[1]||'';
      let best=null,bs=0;for(const c of pool){const ct=toks(c.name);let sc=ct.filter(w=>ctx.includes(w)).length/Math.max(ct.length,1);const L=x=>x.toLowerCase().replace(/[^a-z]/g,'');if(en&&c.nameEn){const a=L(en),b=L(c.nameEn);if(a===b)sc+=2;else if(b.startsWith(a)||a.startsWith(b))sc+=1.5}if(sc>bs){bs=sc;best=c}}
      if(!best||bs<0.5){info.why='لم تُطابق مع أي مادة في القسم المختار';info.type='درجات — غير مطابقة';continue}
      info.target=`${best.code} ${best.name}`;
      const map=[];raw.forEach((h,i)=>{const n=H[i];const mx=num((h.match(/\((\d+(?:\.\d+)?)\)/)||[])[1]);let f=null;
        if(n.includes('حضور'))f='p_att';else if(n.includes('واجب'))f='p_hw';else if(n.includes('مشروع'))f='p_proj';else if(n.includes('مختبر'))f='p_lab';else if(n.includes('اسبوعي'))f='p_quiz';else if(n.includes('سعي'))f='cw';else if(n.includes('امتحان')&&n.includes('فصلي'))f='p_mid';else if(n.includes('امتحان')&&n.includes('نهائي'))f='fin';
        if(f)map.push({i,f,mx})});
      const rowsOut={};const grp=groupKey(best.dept,best.stage);
      for(const r of rows){if(!r||r[cId]==null)continue;const no=String(r[cId]).trim();if(!/^\d+$/.test(no))continue;
        const st=studs.get(no)||arr('students').find(x=>String(x.no)===no);
        if(!st){info.bad.push(`${no}: الرقم غير مسجل في الطلبة`);continue}
        if(groupKey(st.dept,st.stage)!==grp){info.bad.push(`${no}: ليس من طلبة ${STAGES[(+best.stage)-1]?'المرحلة '+STAGES[(+best.stage)-1]:'المادة'}`);continue}
        const o={imp:true};let bad='';for(const m of map){const v=num(r[m.i]);if(v==null)continue;if(m.mx&&(v<0||v>m.mx)){bad=`قيمة ${v} تتجاوز ${m.mx}`;break}if(m.f==='fin'){o.e1=v;o.e2=v}else o[m.f]=v}
        if(bad){info.bad.push(`${no}: ${bad}`);continue}
        rowsOut[st.id||('s_'+no)]=o;info.ok++}
      grades.push({cid:best.id,rows:rowsOut});continue}
    if(cId>=0&&cNm>=0){
      info.type='طلبة';const cSt=col('المرحله'),cSh=col('الدوام');const stS=stageOf(sn)||stageOf(title),shS=shiftOf(sn)||shiftOf(title);
      if(!dept){info.why='اختر القسم الذي ينتمي إليه الطلبة';info.type='طلبة — بلا قسم';continue}
      for(const r of rows){if(!r||r[cId]==null)continue;const no=String(r[cId]).trim();if(!/^\d+$/.test(no))continue;const nm=String(r[cNm]||'').trim();
        const stg=(cSt>=0?stageOf(r[cSt]):null)||stS;const sh=(cSh>=0?shiftOf(r[cSh]):null)||shS||'صباحي';
        if(!nm||!stg){info.bad.push(`${no}: ${!nm?'بلا اسم':'المرحلة غير معروفة'}`);continue}
        const prev=studs.get(no);if(prev&&+prev.stage>=stg)continue; // الأولوية للمرحلة الأعلى
        const ex=arr('students').find(x=>String(x.no)===no);studs.set(no,{id:ex?ex.id:'s_'+no,no,name:nm,dept,stage:String(stg),shift:sh});if(!prev)info.ok++}
      info.target=groupName(groupKey(dept,'1')).split(' — ')[0];continue}
    info.why='نوع الورقة غير معروف';
  }
  return {sheets,newDepts,courses,studs,grades};
}
function importView(){
  const a=IMP.res;const d=arr('depts');const nG=a.grades.reduce((x,g)=>x+Object.keys(g.rows).length,0);
  return `<form class="dlg" data-form="xlsx" style="width:min(900px,100%)"><h3>مراجعة الاستيراد</h3>
  <label class="f" style="max-width:360px">القسم الذي ينتمي إليه الطلبة والدرجات<select id="impdept" data-impdept>${opt('','— اختر —',IMP.dept)}${d.map(x=>opt(x.id,x.name,IMP.dept)).join('')}${[...a.newDepts].map(([id,x])=>opt(id,x.name+' (جديد)',IMP.dept)).join('')}</select></label>
  <div class="grid g4" style="margin:12px 0">${[[a.newDepts.size,'قسم جديد'],[a.courses.size,'مادة'],[a.studs.size,'طالب'],[nG,'درجة طالب في مادة']].map(([n,l])=>`<div class="card kpi"><b>${n}</b><span>${l}</span></div>`).join('')}</div>
  <div class="tw" style="max-height:46vh;overflow:auto"><table><thead><tr><th>الملف / الورقة</th><th>النوع</th><th>الوجهة</th><th>مقبول</th><th>مرفوض</th></tr></thead><tbody>${a.sheets.map(x=>`<tr><td class="wrap">${esc(x.file)}<br><b>${esc(x.sheet)}</b></td><td>${esc(x.type)}</td><td class="wrap">${esc(x.target||x.why||'')}</td><td>${x.ok}</td><td class="wrap">${x.bad.length?`<span class="red">${x.bad.length}</span><div class="mut" style="font-size:12px">${x.bad.slice(0,3).map(esc).join('<br>')}${x.bad.length>3?'<br>…':''}</div>`:'0'}</td></tr>`).join('')}</tbody></table></div>
  <div class="row" style="margin-top:14px"><button class="btn pri" type="submit">مزامنة وحفظ</button><button class="btn" type="button" data-act="close">إلغاء</button><span class="mut" id="impprog"></span></div></form>`;
}
async function startImport(files){
  try{const books=await readBooks(files);const cyber=arr('depts').find(d=>/سيبران/.test(d.name));IMP={books,dept:IMP?.dept||(cyber?cyber.id:(arr('depts')[0]||{}).id||'')};IMP.res=analyze(books,IMP.dept);
    $('#modal').innerHTML=importView();$('#modal').hidden=false}catch(e){toast(errMsg(e),'bad')}
}
async function commitImport(){
  const a=IMP.res;const items=[];
  a.newDepts.forEach((v,id)=>items.push({c:'depts',id,data:v}));
  a.courses.forEach((v,id)=>items.push({c:'courses',id,data:v}));
  a.studs.forEach(v=>items.push({c:'students',id:v.id,data:strip(v)}));
  const pr=$('#impprog');
  await bulk(items,(d,n)=>{if(pr)pr.textContent=`حُفظ ${d} من ${n}`});
  for(const g of a.grades)if(Object.keys(g.rows).length){if(pr)pr.textContent='حفظ الدرجات: '+label.courses(S.courses.get(g.cid));await patch('grades',g.cid,{rows:g.rows})}
  const nG=a.grades.reduce((x,g)=>x+Object.keys(g.rows).length,0);
  await log('استيراد Excel',`${a.newDepts.size} قسم، ${a.courses.size} مادة، ${a.studs.size} طالب، ${nG} درجة من ${IMP.books.map(b=>b.name).join('، ')}`);
  closeModal();IMP=null;toast(`اكتمل الاستيراد: ${a.courses.size} مادة، ${a.studs.size} طالب، ${nG} درجة`);
}

/* ============ التنزيلات والطباعة ============ */
async function download(name,content){if(!dl){const type=name.endsWith('.csv')?'text/csv;charset=utf-8':name.endsWith('.json')?'application/json':'text/html;charset=utf-8';
    const a=document.createElement('a');a.href=URL.createObjectURL(content instanceof Blob?content:new Blob([content],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);return}try{await dl.save({filename:name,data:content})}catch(e){if(e&&e.code!=='declined'&&e.code!=='cancelled')toast('لم يكتمل التنزيل.','bad')}}
function printDoc(title,body){const st=cfg();return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap"><style>body{font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;color:#111;margin:24px;font-size:13px}h1{font-size:18px;margin:0}h2{font-size:15px;margin:18px 0 6px}table{border-collapse:collapse;width:100%;margin-bottom:10px}th,td{border:1px solid #555;padding:4px 6px;text-align:right}th{background:#eee}.hd{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:12px}.pb{page-break-after:always}.sig{display:flex;justify-content:space-between;margin-top:40px}.sig div{width:30%;border-top:1px solid #111;padding-top:4px;text-align:center}.mono{font-family:Consolas,monospace}@media print{body{margin:10mm}}</style></head><body><div class="hd"><div><h1>${esc(st.univ)} — ${esc(st.college)}</h1><div>اللجنة الامتحانية · ${esc(st.term)} ${esc(st.year)}</div></div><div>${esc(title)}<br>${new Date().toLocaleDateString('ar-IQ-u-nu-latn')}</div></div>${body}</body></html>`}
const sigs=()=>{const c=S.meta.get('committee')||{};const n=k=>esc(label.staff(S.staff.get(c[k])))||'';return `<div class="sig"><div>مقرر اللجنة<br>${n('rap')}</div><div>عضو اللجنة<br>${n('m1')}</div><div>رئيس اللجنة الامتحانية<br>${n('chair')}</div></div>`};
ACT.dlseat=()=>{const slot=slotList().find(s=>s.key===UI.slot);const sd=S.slots.get(slot.key);const body=[...new Set(sd.seats.map(x=>x.h))].map(hid=>{const h=S.halls.get(hid);const l=sd.seats.filter(x=>x.h===hid).sort((a,b)=>seatNo(h,a)-seatNo(h,b));const du=(sd.duties||[]).find(x=>x.h===hid);return `<h2>${esc(h.name)} — ${esc(slotName(slot))}</h2><p>المراقبون: ${du?du.staff.map(id=>esc(label.staff(S.staff.get(id)))).join('، '):'—'}</p><table><tr><th>المقعد</th><th>الرقم المعرفي</th><th>الاسم</th><th>المادة</th><th>توقيع الطالب</th></tr>${l.map(x=>{const s=S.students.get(x.s)||{};return `<tr><td>${seatNo(h,x)}</td><td class="mono">${esc(s.no)}</td><td>${esc(s.name)}</td><td>${esc((S.courses.get((S.exams.get(x.e)||{}).course)||{}).name)}</td><td style="width:22%"></td></tr>`}).join('')}</table>${sigs()}<div class="pb"></div>`}).join('');download(`كشوف-الجلوس-${slot.key}.html`,printDoc('كشوف الجلوس والتواقيع',body))};
ACT.dlatt=ACT.dlseat;
ACT.dldoor=()=>{const slot=slotList().find(s=>s.key===UI.slot);const sd=S.slots.get(slot.key);const body=[...new Set(sd.seats.map(x=>x.h))].map(hid=>{const h=S.halls.get(hid);const l=sd.seats.filter(x=>x.h===hid).map(x=>S.students.get(x.s)).filter(Boolean).sort(byNo);return `<div style="text-align:center;padding-top:30px"><div style="font-size:44px;font-weight:700">${esc(h.name)}</div><div style="font-size:18px;margin:8px 0">${esc(slotName(slot))}</div><div style="font-size:22px;margin:20px 0">الأرقام الامتحانية من <b class="mono">${esc(l[0]?.no)}</b> إلى <b class="mono">${esc(l[l.length-1]?.no)}</b></div><div style="font-size:16px">عدد الطلبة: ${l.length}</div></div><div class="pb"></div>`}).join('');download(`لوحات-الأبواب-${slot.key}.html`,printDoc('لوحات أبواب القاعات',body))};
ACT.dlduty=()=>{const body=`<table><tr><th>الجلسة</th><th>القاعة</th><th>المراقبون</th><th>التوقيع</th></tr>${slotList().flatMap(s=>((S.slots.get(s.key)||{}).duties||[]).map(d=>`<tr><td>${esc(slotName(s))}</td><td>${esc(label.halls(S.halls.get(d.h)))}</td><td>${d.staff.map((id,i)=>esc(label.staff(S.staff.get(id)))+(i===0?' (رئيس القاعة)':'')).join('، ')}</td><td style="width:18%"></td></tr>`)).join('')}</table>${sigs()}`;download('جدول-المراقبة.html',printDoc('جدول المراقبة الامتحانية',body))};
ACT.dlcovers=d=>{const e=S.exams.get(d.e);const c=S.codes.get(d.e);const co=S.courses.get(e.course)||{};const body=examStudents(e).map(s=>{const code=c.map[s.id];return `<div style="border:2px solid #111;margin-bottom:16px;page-break-inside:avoid"><div style="padding:10px;border-bottom:2px dashed #111;display:flex;justify-content:space-between"><div><b>قسيمة الاسم (تُفصل عند الاستلام)</b><br>${esc(s.name)} — <span class="mono">${esc(s.no)}</span></div><div class="mono">${esc(code)}</div></div><div style="padding:10px;display:flex;gap:16px;align-items:center"><div style="width:110px">${qrSvg(code).replace('<svg','<svg width="110" height="110"')}</div><div><div style="font-size:12px">${esc(co.code)} ${esc(co.name)} · ${esc(e.date)}</div><div class="mono" style="font-size:26px;font-weight:700">${esc(code)}</div><div style="font-size:12px">الرقم السري للدفتر — لا يُكتب الاسم داخل الدفتر</div></div></div></div>`}).join('');download(`أغلفة-${co.code||'exam'}.html`,printDoc('أغلفة دفاتر الإجابة المشفرة',body))};
ACT.dlinc=d=>{const x=S.incidents.get(d.id);const s=S.students.get(x.student)||{};const body=`<h2>محضر ضبط حالة غش</h2><table><tr><th>الطالب</th><td>${esc(s.name)} — ${esc(s.no)}</td></tr><tr><th>الامتحان</th><td>${esc(label.exams(S.exams.get(x.exam)))}</td></tr><tr><th>القاعة</th><td>${esc(label.halls(S.halls.get(x.hall)))}</td></tr><tr><th>وقت الواقعة</th><td>${esc(x.time)}</td></tr><tr><th>الأداة المحرزة</th><td>${esc(x.tool)}</td></tr><tr><th>الوصف</th><td>${esc(x.desc)}</td></tr><tr><th>الشهود</th><td>${esc(x.witnesses)}</td></tr><tr><th>إفادة الطالب</th><td>${x.statement?'أُخذت وأُرفقت':'لم تؤخذ'}</td></tr><tr><th>المرحلة</th><td>${esc(x.status)}</td></tr>${x.decision?`<tr><th>القرار</th><td>${esc(x.decision)}</td></tr>`:''}</table><p>يُرفع هذا المحضر مع المضبوطات وإفادة الطالب إلى عميد الكلية لإحالته إلى لجنة انضباط الطلبة.</p><div class="sig"><div>المراقب الأول</div><div>المراقب الثاني</div><div>رئيس القاعة</div></div>${sigs()}`;download(`محضر-غش-${s.no}.html`,printDoc('محضر غش',body))};
function masterRows(k){const cs=groupCourses(k);return groupStudents(k).map(s=>{const st=studentStatus(k,s.id);return {s,st,rs:cs.map(c=>res(c.id,s.id)),vc:(VC.get(s.id)||{}).code||''}})}
ACT.dlmaster=d=>{const k=UI.group;const cs=groupCourses(k);
  const head=['الرقم الامتحاني','الاسم',...cs.flatMap(c=>[c.name+' سعي',c.name+' نهائي',c.name+' رأفة',c.name+' مجموع',c.name+' تقدير']),'النتيجة','رمز التحقق'];
  const rows=masterRows(k).map(r=>[r.s.no,r.s.name,...r.rs.flatMap(x=>x.total==null?[x.label,'','','','']:[x.cw,x.abs?'غائب':x.fin,x.grace||'',x.total,grade(x.total)]),r.st.label,r.vc]);
  return exportTable(`ماستر-شيت-${groupName(k)}`,`الماستر شيت — ${groupName(k)}${isLocked(k)?' (مصادق عليها)':' (مسودة)'}`,head,rows,(d&&d.k)||'xlsx')};
ACT.dlmasterhtml=()=>{const k=UI.group;const cs=groupCourses(k);const body=`<h2>${esc(groupName(k))} ${isLocked(k)?'— مصادق عليها':'— مسودة غير مصادق عليها'}</h2><table><tr><th>الرقم</th><th>الاسم</th>${cs.map(c=>`<th>${esc(c.name)}</th>`).join('')}<th>النتيجة</th><th>رمز التحقق</th></tr>${masterRows(k).map(r=>`<tr><td class="mono">${esc(r.s.no)}</td><td>${esc(r.s.name)}</td>${r.rs.map(x=>`<td>${x.total==null?esc(x.label):r1(x.total)+(x.grace?` (ر${x.grace})`:'')+(x.round===2?' د2':'')}</td>`).join('')}<td>${esc(r.st.label)}</td><td class="mono">${esc(r.vc)}</td></tr>`).join('')}</table>${sigs()}`;download(`النتائج-${groupName(k)}.html`,printDoc('السجل المركزي للنتائج',body))};
ACT.dlaudit=()=>{const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';download('سجل-التدقيق.csv','﻿'+'الوقت,المنفذ,العملية,التفاصيل,البصمة السابقة,البصمة\n'+arr('audit').sort((a,b)=>a.ts-b.ts).map(x=>[new Date(x.ts).toISOString(),x.by,x.action,x.detail,x.prev,x.hash].map(q).join(',')).join('\n'))};

/* ============ البيانات التجريبية ============ */
async function loadSample(){
  let seed=7;const R=()=>(seed=(seed*16807)%2147483647)/2147483647;const pk=a=>a[Math.floor(R()*a.length)];
  const F1=['محمد','علي','حسين','زينب','فاطمة','مريم','أحمد','حسن','سجاد','مصطفى','نور','رقية','عباس','كرار','دعاء','آية','يوسف','عمر','هدى','سارة','منتظر','بنين','ضحى','مرتضى'];
  const F2=['جاسم','كاظم','عبد الله','فاضل','ناصر','رحيم','صادق','هادي','مهدي','عادل','قاسم','حميد'];
  const F3=['الموسوي','التميمي','الأسدي','الحلفي','الكعبي','العيداني','المالكي','البطاط','الساعدي','الإمارة'];
  const items=[];const add=(c,id,data)=>items.push({c,id,data:{...data,sample:true}});
  add('depts','d_ce',{name:'هندسة الحاسوب',code:'CE'});add('depts','d_ee',{name:'الهندسة الكهربائية',code:'EE'});
  const staff=[['أ.د. كاظم جبار الحلفي','أستاذ','d_ce'],['أ.م.د. سناء عبد الكريم','أستاذ مساعد','d_ce'],['م.د. حيدر فالح العيداني','مدرس','d_ce'],['م.د. رشا ناصر','مدرس','d_ce'],['م.م. علي عبد الحسين','مدرس مساعد','d_ce'],['م.م. زهراء مجيد','مدرس مساعد','d_ce'],['أ.م.د. عماد هاشم','أستاذ مساعد','d_ee'],['م.د. ميثم عبد الأمير','مدرس','d_ee'],['م.د. أسيل كريم','مدرس','d_ee'],['م.م. مصطفى رعد','مدرس مساعد','d_ee'],['م.م. نور الهدى صالح','مدرس مساعد','d_ee'],['م. حسين علي (مبرمج)','مبرمج','d_ce'],['م.م. أحمد ستار','مدرس مساعد','d_ee'],['م.د. إسراء طالب','مدرس','d_ce']];
  staff.forEach((s,i)=>add('staff','p'+i,{name:s[0],title:s[1],dept:s[2],phone:'0780'+String(1000000+i*7331).slice(0,7),coi:i!==4&&i!==10,relatives:'',unavail:i===8?'2027-01-12':''}));
  add('halls','h101',{name:'قاعة 101',building:'البناية أ — الطابق الأول',rows:5,cols:6,inv:2});
  add('halls','h102',{name:'قاعة 102',building:'البناية أ — الطابق الأول',rows:5,cols:6,inv:2});
  add('halls','h205',{name:'قاعة 205',building:'البناية ب — الطابق الثاني',rows:6,cols:6,inv:2});
  add('halls','hbig',{name:'المدرج الكبير',building:'البناية المركزية',rows:8,cols:10,inv:3});
  const groupsDef=[['d_ce',2,'26CE2'],['d_ce',3,'25CE3'],['d_ee',2,'26EE2'],['d_ee',3,'25EE3']];
  const CN={'d_ce2':[['CE201','هياكل البيانات','p2'],['CE202','التصميم المنطقي','p3'],['CE203','الرياضيات الهندسية','p1']],'d_ce3':[['CE301','معمارية الحاسوب','p0'],['CE302','شبكات الحاسوب','p13'],['CE303','أنظمة التشغيل','p1']],'d_ee2':[['EE201','الدوائر الكهربائية','p6'],['EE202','الإلكترونيات','p7'],['EE203','المجالات الكهرومغناطيسية','p8']],'d_ee3':[['EE301','أنظمة القدرة','p6'],['EE302','نظم السيطرة','p9'],['EE303','معالجة الإشارات','p7']]};
  const studIds={};
  groupsDef.forEach(([d,st,pre],gi)=>{studIds[d+st]=[];for(let i=1;i<=16;i++){const id=`s_${pre}_${i}`;const female=R()<0.45;const n1=pk(F1);add('students',id,{no:`${pre.slice(0,2)}${String(gi+1)}${String(i).padStart(3,'0')}`,name:`${n1} ${pk(F2)} ${pk(F2)} ${pk(F3)}`,dept:d,stage:String(st),shift:i>13?'مسائي':'صباحي'});studIds[d+st].push(id)}});
  // قريب لأحد المراقبين
  const rel=items.find(x=>x.id==='s_26EE2_5');items.find(x=>x.id==='p3').data.relatives=rel.data.no;
  Object.entries(CN).forEach(([k,list])=>list.forEach(([code,name,t])=>add('courses','c_'+code,{code,name,dept:k.slice(0,4),stage:k.slice(4),teacher:t,units:3})));
  const dates=['2027-01-10','2027-01-11','2027-01-12'];
  ['1','2','3'].forEach((n,di)=>{add('exams','e_CE20'+n,{course:'c_CE20'+n,date:dates[di],period:'1',dur:120});add('exams','e_EE20'+n,{course:'c_EE20'+n,date:dates[di],period:'1',dur:120});add('exams','e_CE30'+n,{course:'c_CE30'+n,date:dates[di],period:'2',dur:120});add('exams','e_EE30'+n,{course:'c_EE30'+n,date:dates[di],period:'2',dur:120})});
  add('meta','settings',{univ:'جامعة المعقل الدولية',college:'كلية الهندسة',year:'2026–2027',term:'الفصل الدراسي الأول — الدور الأول',cwMax:40,finMax:60,pass:50,maxCarry:2,graceTotal:5,gracePer:5,double:true,useParts:false,curSem:'1',requireCoi:false,appealHours:48,idleMin:30,p1:'09:00',p2:'11:30'});
  add('meta','committee',{chair:'p0',rap:'p2',m1:'p1',m2:'p6',m3:'p7',tech:'p11'});
  // درجات لمواد اليومين الأولين
  const graded=['CE201','CE202','CE203','CE301','CE302','CE303','EE201','EE301','EE202','EE302'];
  Object.entries(CN).forEach(([k,list])=>list.forEach(([code])=>{if(!graded.includes(code))return;const rows={};studIds[k].forEach((sid,i)=>{const ab=R();const cw=Math.round((18+R()*20)*2)/2;let fin=Math.round((14+R()*44)*2)/2;if(code==='CE302')fin=Math.max(0,fin-12);if(i===3&&code==='CE201')fin=Math.max(0,47-cw);const r={cw,absPct:Math.round(R()*12)};if(code==='EE202'&&i===14){r.dep=true;r.absPct=18}else if(ab<0.04){r.abs=true;r.e1=0;r.e2=0}else{r.e1=fin;r.e2=(code==='CE202'&&i===6)?fin+5:(code==='EE302'&&i>=12)?null:fin}rows[sid]=r});add('grades','c_'+code,{rows})}));
  add('incidents','inc1',{student:'s_25CE3_9',exam:'e_CE301',hall:'h205',time:'12:10',tool:'سماعة لاسلكية',desc:'ضُبطت سماعة لاسلكية دقيقة في أذن الطالب بعد مرور 40 دقيقة على بدء الامتحان، وسُحب الدفتر وحُرزت الأداة.',witnesses:'م.م. علي عبد الحسين، م.د. أسيل كريم',statement:true,status:'محال إلى العميد',at:Date.now()-26*36e5});
  {const t=Date.now()-30*36e5;add('appeals','ap1',{ref:'AP-2026-0001',student:'s_26CE2_2',course:'c_CE201',round:'1',reason:'يعتقد الطالب أن السؤال الثالث لم يُصحح كاملاً.',st:'audit',at:t,due:t+48*36e5,filedOn:new Date(t).toISOString().slice(0,10),createdBy:ME,hist:[{ts:t,by:ME,from:'',to:'new',note:'تسجيل الاعتراض'},{ts:t+2*36e5,by:ME,from:'new',to:'audit',note:'استلام الدفتر وبدء التدقيق'}]})}
  {const t=Date.now()-5*36e5;add('appeals','ap2',{ref:'AP-2026-0002',student:'s_26EE2_7',course:'c_EE201',round:'1',reason:'خطأ محتمل في جمع درجات الأسئلة الفرعية.',st:'new',at:t,due:t+48*36e5,filedOn:new Date(t).toISOString().slice(0,10),createdBy:ME,hist:[{ts:t,by:ME,from:'',to:'new',note:'تسجيل الاعتراض'}]})}
  await bulk(items);
  for(const id of ['ap1','ap2']){const a=S.appeals.get(id);if(!a)continue;const r=res(a.course,a.student);await patch('appeals',id,{oldFin:r.fin??null,oldTotal:r.total??null})}
  // توزيع المقاعد والمراقبين لكل الجلسات، وتسجيل حضور الأيام المنقضية، وتشفير اليوم الأول
  const all=['h101','h102','h205','hbig'];
  for(const s of slotList()){const seats=seatPlan(s,all);const att={};if(s.date<='2027-01-11')seats.forEach(x=>{att[x.s]=R()<0.04?'a':'p'});await put('slots',s.key,{seats,halls:all,att,duties:[],dwarn:[],at:Date.now()})}
  for(const s of slotList()){const p=dutyPlan(s);await patch('slots',s.key,{duties:p.duties,dwarn:p.warn})}
  for(const e of ['e_CE201','e_EE201','e_CE301','e_EE301']){await makeCodes(e);const now=Date.now();await put('envelopes',e,{rubric:true,recv:{at:now-3*864e5,by:ME},seal:{at:now-3*864e5+3e6,by:ME},open:{at:now-3*864e5+36e5,by:ME},ret:{at:now-3*864e5+9e6,by:ME,count:presentCount(S.exams.get(e))}})}
  for(const e of ['e_CE201','e_CE301'])await patch('codes',e,{decoded:true,decodedAt:Date.now()});
  await put('envelopes','e_CE202',{rubric:true,recv:{at:Date.now()-864e5,by:ME},seal:{at:Date.now()-864e5+2e6,by:ME}});
  await log('تحميل بيانات تجريبية','64 طالباً، 12 مادة، 6 جلسات، 4 قاعات');
}

/* ============ الأحداث ============ */
document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-nav]');if(nav){e.preventDefault();go(nav.dataset.nav);return}
  if(e.target.id==='modal'){closeModal();return}
  const b=e.target.closest('[data-act]');if(!b||b.disabled)return;e.preventDefault();
  const fn=ACT[b.dataset.act];if(!fn)return;
  Promise.resolve().then(()=>fn(b.dataset,b,e)).catch(err=>toast(errMsg(err),'bad'));
});
document.addEventListener('submit',e=>{const f=e.target.closest('form[data-form]');if(!f)return;e.preventDefault();
  if(f.dataset.form==='verify'){UI.vq=f.elements.vq.value.trim().toUpperCase();const hit=[...VC.entries()].find(([,v])=>v.code===UI.vq);UI.vres=hit?{found:true,s:S.students.get(hit[0]),k:hit[1].k}:{found:false};render();return}
  if(f.dataset.form==='xlsx'){const b=f.querySelector('button[type=submit]');b.disabled=true;b.textContent='جارٍ الحفظ…';Promise.resolve().then(commitImport).catch(err=>{b.disabled=false;b.textContent='مزامنة وحفظ';toast(errMsg(err),'bad')});return}
  if(f.dataset.form==='ret'){const eid=f.dataset.id;const cnt=num(f.elements.count.value);Promise.resolve().then(async()=>{await patch('envelopes',eid,{ret:{at:Date.now(),by:ME,count:cnt}});await log('ظرف امتحاني',`أُعيد ${cnt} دفتراً — ${label.exams(S.exams.get(eid))}`);closeModal()}).catch(err=>toast(errMsg(err),'bad'));return}
  if(KFORMS[f.dataset.form]){const b=f.querySelector('button[type=submit]');if(b)b.disabled=true;Promise.resolve().then(()=>KFORMS[f.dataset.form](f)).catch(err=>{const el=f.querySelector('.ferr')||$('#ferr');if(el)el.textContent=errMsg(err);else toast(errMsg(err),'bad')}).finally(()=>{if(b)b.disabled=false});return}
  Promise.resolve().then(()=>submitForm(f)).catch(err=>{const el=$('#ferr');if(el)el.textContent=errMsg(err);else toast(errMsg(err),'bad')});
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset.apc!==undefined){UI.apCourse=t.value;const x=$('#ap_student');if(x)x.innerHTML=apStudentOpts(t.value);return}
  if(t.dataset.apassign){apAssign(t.dataset.apassign,t.value).catch(err=>toast(errMsg(err),'bad'));return}
  if(t.dataset.ui){UI[t.dataset.ui]=t.value;if(t.dataset.ui==='course')UI.gtab=UI.gtab||'cw';render();return}
  if(t.dataset.draft&&t.type==='checkbox'){setDraft(t);render();return}
  if(t.dataset.hall){const sd=S.slots.get(UI.slot);if(sd&&!RO){patch('slots',UI.slot,{halls:hallsChecked()}).catch(()=>{})}else render();return}
  if(t.dataset.com){patch('meta','committee',{[t.dataset.com]:t.value||null}).then(()=>log('تشكيل اللجنة',t.closest('label').firstChild.textContent+': '+label.staff(S.staff.get(t.value)))).catch(err=>toast(errMsg(err),'bad'));return}
  if(t.dataset.kuntil!==undefined){kSetUntil(t.dataset.kuntil,t.value).catch(err=>toast(errMsg(err),'bad'));return}
  if(t.dataset.krole!==undefined){const em=t.dataset.krole,r=t.value;const ref=FB.doc(FB.db,'k_roles',em);
    settle(r?FB.setDoc(ref,{role:r,by:ME,at:Date.now()}):FB.deleteDoc(ref)).then(()=>log('صلاحيات الكنترول',`${label.staff(S.staff.get(em))} ← ${KROLES[r]||'بلا صلاحية'}`)).then(()=>toast('حُفظت الصلاحية')).catch(err=>toast(errMsg(err),'bad'));return}
  if(t.dataset.rubric){patch('envelopes',t.dataset.rubric,{rubric:t.checked}).catch(err=>toast(errMsg(err),'bad'));return}
  if((t.id==='xlsxin'||t.id==='xlsxin2')&&t.files.length){startImport([...t.files]);t.value='';return}
  if(t.dataset.impdept!==undefined&&IMP){IMP.dept=t.value;IMP.res=analyze(IMP.books,IMP.dept);$('#modal').innerHTML=importView();return}
  if(t.id==='restore'&&t.files[0]){const r=new FileReader();r.onload=async()=>{try{const o=JSON.parse(r.result);if(o.app!=='kontrol')throw new Error('الملف ليس نسخة احتياطية من هذا النظام.');if(MODE==='fb'&&!can('chair'))throw new Error('الاستعادة لرئيس اللجنة فقط.');const items=[];COLLS.filter(c=>MODE!=='fb'||(KCOL[c]&&c!=='audit')).forEach(c=>(o[c]||[]).forEach(x=>items.push({c,id:x.id,data:x})));if(!items.length)throw new Error('لا توجد سجلات قابلة للاستعادة في الملف.');await bulk(items);await log('استعادة نسخة احتياطية',`${items.length} سجل`);toast(`استُعيد ${items.length} سجل`)}catch(err){toast(errMsg(err),'bad')}};r.readAsText(t.files[0])}
});
function setDraft(t){const [cid,sid,f]=t.dataset.draft.split('~');DRAFT[cid]=DRAFT[cid]||{};DRAFT[cid][sid]=DRAFT[cid][sid]||{};DRAFT[cid][sid][f]=t.type==='checkbox'?t.checked:t.value;
  const btn=document.querySelector('[data-act="savegrades"]');if(btn){const n=Object.keys(DRAFT[cid]).length;btn.disabled=RO||isLocked(groupKey(S.courses.get(cid).dept,S.courses.get(cid).stage));btn.textContent=`حفظ الرصد (${n})`}}
document.addEventListener('input',e=>{const t=e.target;
  if(t.dataset.draft&&t.type!=='checkbox'){setDraft(t);const n=num(t.value);const mx=+t.max;t.classList.toggle('bad',n!=null&&(n<0||n>mx));const td=t.closest('td');const nx=td&&td.nextElementSibling;if(nx&&nx.classList.contains('wrap'))nx.textContent=tafqeet(n);if(t.dataset.draft.split('~')[2].startsWith('p_')){const [cid,sid]=t.dataset.draft.split('~');const g=G(cid)[sid]||{},d=(DRAFT[cid]||{})[sid]||{};const sum=partSum(sid,(x,f)=>f in d?d[f]:g[f]);const el=document.querySelector(`[data-sum="${sid}"]`);if(el)el.textContent=r1(sum)}}
  if(t.dataset.ui==='q'){UI.q=t.value;clearTimeout(t._t);t._t=setTimeout(()=>{const pos=t.selectionStart;deferred=false;$('#main').innerHTML=VIEW[UI.view]();const q=$('#q');if(q){q.focus();q.setSelectionRange(pos,pos)}},250)}
});
document.addEventListener('keydown',e=>{
  const t=e.target;if(e.key==='Escape'&&!$('#modal').hidden){closeModal();return}
  if(e.key!=='Enter')return;
  if(t.id==='scan'){e.preventDefault();const v=t.value.trim();t.value='';if(!v)return;const sd=S.slots.get(UI.slot);if(!sd)return;
    let hit=sd.seats.find(x=>String((S.students.get(x.s)||{}).no)===v);
    if(!hit){const ex=sd.seats.map(x=>x.e);for(const eid of new Set(ex)){const m=(S.codes.get(eid)||{}).map||{};const sid=Object.keys(m).find(k=>m[k]===v.toUpperCase());if(sid){hit=sd.seats.find(x=>x.s===sid);break}}}
    if(!hit){toast(`الرقم ${v} غير مسجل في هذه الجلسة`,'bad');return}
    const s=S.students.get(hit.s);const h=S.halls.get(hit.h);
    patch('slots',UI.slot,{att:{[hit.s]:'p'}}).then(()=>{toast(`حاضر: ${s.name} — ${h.name} مقعد ${seatNo(h,hit)}${hit.h!==UI.hall?' (قاعة أخرى!)':''}`,hit.h!==UI.hall?'bad':'');setTimeout(()=>{const x=$('#scan');if(x)x.focus()},50)}).catch(err=>toast(errMsg(err),'bad'));return}
  if(t.id==='jump'){e.preventDefault();const v=t.value.trim().toUpperCase();t.value='';const m=(codesFor(UI.course)||{}).map||{};let sid=Object.keys(m).find(k=>m[k]===v);if(!sid){const s=arr('students').find(x=>String(x.no)===v);sid=s&&s.id}
    const el=sid&&document.querySelector(`input.cell[data-row="${sid}"]`);if(el){el.focus();el.select();el.scrollIntoView({block:'center'})}else toast('لا يوجد هذا الرقم في قائمة المادة','bad');return}
  if(t.classList&&t.classList.contains('cell')){e.preventDefault();const all=[...document.querySelectorAll('input.cell:not([disabled])')];const i=all.indexOf(t);const nx=all[i+1];if(nx){nx.focus();nx.select()}}
});
function go(v){UI.view=v;UI.q='';UI.cdel='';chainRes=null;closeModal();try{history.replaceState(null,'','#'+v)}catch(e){}render();window.scrollTo(0,0)}
window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(VALID.has(h)&&h!==UI.view){UI.view=h;UI.q='';chainRes=null;render()}});

/* ============ الإقلاع ============ */
async function boot(){
  const h=location.hash.slice(1);if(VALID.has(h))UI.view=h;
  renderNav();
  const C=window.claude;
  if(C&&typeof C.use==='function'){
    const got=await Promise.all(['db','user','downloads','sample'].map(n=>C.use(n).catch(()=>null)));
    [db,userCap,dl,sampleCap]=got;
  }
  if(db){
    MODE='cloud';
    if(userCap){try{ME=(await userCap.id())||'viewer'}catch(e){}try{const w=await userCap.can('data.write');RO=w===false}catch(e){}try{IS_ADMIN=await userCap.canEdit()}catch(e){IS_ADMIN=false}}
        COLLS.forEach(c=>db.collection(c).limit(1000).onSnapshot(snap=>{const m=new Map();snap.docs.forEach(d=>m.set(d.id,{...d.data(),id:d.id}));S[c]=m;sched()},err=>{if(err.code==='revoked'){RO=true;toast('سُحبت صلاحية الوصول لهذه الصفحة.','bad')}else if(c!=='codes')toast('تعذر تحميل جزء من البيانات: '+errMsg(err),'bad')}));
  }else{
    await fbReady();
    if(window.FBX){fbBoot();return}
    // النسخة المنشورة لا تعمل أبداً دون قاعدة البيانات ودون تسجيل دخول
    if(location.protocol==='https:'&&!/^(localhost|127\.|\[::1\])/.test(location.hostname)){MODE='down';renderNav();$('#main').innerHTML='';showDown(window.FBX_ERROR);return}
    if(window.FBX_ERROR)toast('تعذر الاتصال بـ Firebase، يعمل النظام محلياً: '+window.FBX_ERROR,'bad');
    MODE='local';
    if(!loadLocal()){await loadSample()}
  }
  render();
}
kpInstall();
boot();
