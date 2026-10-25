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
const fsSafe=id=>String(id).replace(/\//g,'_');
const settle=p=>Promise.race([p,new Promise(r=>setTimeout(r,4000))]); // دون اتصال: الكتابة تُحفظ محلياً وتُزامَن لاحقاً
function fbData(c,data){const v=strip(data);
  if(c==='grades'&&v.rows){const rows={};for(const [sid,r] of Object.entries(v.rows)){if(r==null){rows[sid]=null;continue}const o={};for(const [k,x] of Object.entries(r)){if(k.startsWith('p_')||k==='cw'||k==='imp')continue;o[k]=x}rows[sid]=o}v.rows=rows}
  if(c==='staff'){const o={};['title','phone','relatives','unavail','coi'].forEach(k=>{if(k in v)o[k]=v[k]});return o}
  return v}
function fbRef(c,id){if(!KCOL[c])throw new Error(SHARED_MSG);return FB.doc(FB.db,KCOL[c],fsSafe(id))}
function can(x){if(MODE!=='fb')return true;const r=KROLE;
  if(x==='chair')return r==='chair';
  if(x==='ctrl')return r==='chair'||r==='member';
  if(x==='grade')return r==='chair'||r==='member'||r==='auditor';
  if(x==='invig')return r==='chair'||r==='member'||r==='invigilator';
  return true}
const LKEY='kontrol.univ.v2';
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
const cfg=()=>({univ:'جامعة المعقل الدولية',college:'كلية الهندسة',year:'2026–2027',term:'الفصل الدراسي الأول',curSem:'1',cwMax:50,finMax:50,pass:50,maxCarry:2,graceTotal:5,gracePer:5,double:true,useParts:true,requireCoi:false,appealHours:48,p1:'09:00',p2:'11:30',...(S.meta.get('settings')||{})});
const partsOn=()=>cfg().useParts!==false;

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
  const st=cfg();const r=G(cid)[sid]||{};
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
const RAW={departments:new Map(),courses:new Map(),students:new Map(),staff:new Map(),staffx:new Map(),kmarks:new Map(),sgrades:new Map(),kroles:new Map()};
const SHIFT_AR={morning:'صباحي',evening:'مسائي'};
const PMAP=[['attendance','att'],['assignment','hw'],['project','proj'],['lab','lab'],['quiz','quiz'],['midterm','mid']];
let rbT=0;function rebuild(){if(rbT)return;rbT=setTimeout(()=>{rbT=0;doRebuild();sched()},40)}
function doRebuild(){
  const d=new Map();RAW.departments.forEach((v,id)=>d.set(id,{id,name:v.name||id,code:id,collegeId:v.collegeId||''}));S.depts=d;
  const teach=new Map();RAW.staff.forEach((v,id)=>(v.courseIds||[]).forEach(c=>{if(!teach.has(c))teach.set(c,[]);teach.get(c).push(id)}));
  const cs=new Map();RAW.courses.forEach((v,id)=>{const t=teach.get(id)||[];const sem=v.term?String(v.term):(v.semester?String((+v.semester-1)%2+1):'1');
    cs.set(id,{id,code:v.code||id,name:v.nameAr||v.nameEn||v.code||id,nameEn:v.nameEn||'',dept:v.deptId||'',stage:String(v.stage||''),sem,ects:v.ects??null,teacher:t[0]||'',teacher2:t[1]||''})});S.courses=cs;
  const st=new Map();RAW.students.forEach((v,id)=>{if(!v.deptId)return;st.set(id,{id,no:id,name:v.name||id,dept:v.deptId,stage:String(v.stage||''),shift:SHIFT_AR[v.shift]||v.shift||''})});S.students=st;
  const sf=new Map();RAW.staff.forEach((v,id)=>{const x=RAW.staffx.get(id)||{};sf.set(id,{id,name:v.name||id,role:v.role||'',title:x.title||ROLE_AR[v.role]||'',dept:v.deptId||'',phone:x.phone||'',relatives:x.relatives||'',unavail:x.unavail||'',coi:!!x.coi})});S.staff=sf;
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
  fbSub('departments',intoRaw(RAW.departments));fbSub('courses',intoRaw(RAW.courses));fbSub('students',intoRaw(RAW.students));fbSub('staff',intoRaw(RAW.staff));fbSub('k_staffx',intoRaw(RAW.staffx));
  ['halls','exams','slots','envelopes','incidents','meta'].forEach(c=>fbSub(KCOL[c],intoS(c)));
  fbSub('k_audit',intoS('audit'),r=>FB.query(r,FB.orderBy('ts','desc'),FB.limit(500)));
  if(can('grade')){fbSub('k_marks',intoRaw(RAW.kmarks));fbSub('k_appeals',intoS('appeals'))}
  if(can('ctrl'))fbSub('k_codes',intoS('codes'));
  if(can('chair'))fbSub('k_roles',intoRaw(RAW.kroles));
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
  const authEmail=(u.includes('@')?u.split('@')[0]:u)+'@pw.almaaqal.app';
  const pw='Mq#'+(await sha256(authEmail+'::'+pass)).slice(0,40);
  try{await FB.signInWithEmailAndPassword(FB.auth,authEmail,pw)}catch(e){throw new Error(authErr(e))}}
async function afterLogin(u){
  if(String(u.email||'').endsWith('@st.almaaqal.app'))throw new Error('حسابات الطلبة لا تدخل نظام الكنترول.');
  const email=await resolveStaffEmail(u.email);
  let prof=null;try{const sd=await FB.getDoc(FB.doc(FB.db,'staff',email));prof=sd.exists()?sd.data():null}catch(x){}
  let role='';
  if(SUPER_ADMINS.includes(email)||(prof&&['admin','president'].includes(prof.role)))role='chair';
  else{if(!prof)throw new Error('هذا الحساب غير مسجل في الكادر.');try{const r=await FB.getDoc(FB.doc(FB.db,'k_roles',email));role=r.exists()?r.data().role:''}catch(x){}}
  if(!KROLES[role])throw new Error('لا تملك صلاحية في نظام الكنترول بعد. اطلب من رئيس اللجنة إضافتك من صفحة «صلاحيات الكنترول».');
  ME=email;KROLE=role;IS_ADMIN=role==='chair';RO=role==='viewer';MEPROF={name:(prof&&prof.name)||email,email,role};
  MODE='fb';fbSubscribe();showLogin(false);render();
}
function showLogin(on,msg){const L=$('#login');L.hidden=!on;if(on){$('#lg_err').textContent=msg||'';$('#lg_btn').disabled=false;$('#lg_btn').textContent='دخول';$('#lg_google').hidden=MODE!=='auth';setTimeout(()=>{const x=$('#lg_user');if(x)x.focus()},50)}}
function fbBoot(){FB=window.FBX;MODE='auth';renderNav();
  FB.onAuthStateChanged(FB.auth,async u=>{if(!u){if(MODE==='fb'){fbUnsubscribe()}MODE='auth';ME='local';MEPROF=null;renderNav();$('#main').innerHTML='';showLogin(true);return}
    try{await afterLogin(u)}catch(e){try{await FB.signOut(FB.auth)}catch(x){}MODE='auth';showLogin(true,errMsg(e))}});
  $('#loginform').addEventListener('submit',async ev=>{ev.preventDefault();const b=$('#lg_btn');b.disabled=true;b.textContent='جارٍ الدخول…';$('#lg_err').textContent='';
    try{await fbLogin($('#lg_user').value,$('#lg_pass').value)}catch(e){showLogin(true,errMsg(e))}});
  $('#lg_google').addEventListener('click',async()=>{$('#lg_err').textContent='';try{await FB.signInWithPopup(FB.auth,new FB.GoogleAuthProvider())}catch(e){showLogin(true,authErr(e))}});
  window.addEventListener('online',renderNav);window.addEventListener('offline',renderNav);
}
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
  ['التخطيط',[['dash','لوحة القيادة'],['depts','الأقسام'],['students','الطلبة والأهلية'],['courses','المواد الدراسية'],['halls','القاعات'],['staff','الكادر وتعارض المصالح'],['exams','الجدول الامتحاني']]],
  ['يوم الامتحان',[['seating','توزيع المقاعد'],['duties','اللجان والمراقبون'],['envelopes','أظرف الأسئلة'],['attendance','الحضور والغياب'],['incidents','محاضر الغش']]],
  ['الكنترول',[['coding','التشفير والأرقام السرية'],['grading','رصد الدرجات'],['grace','الرأفة الآلية'],['master','الماستر شيت والنتائج'],['stats','التحليل الإحصائي'],['appeals','الاعتراضات']]],
  ['الحوكمة',[['audit','سجل التدقيق'],['verify','التحقق من الصدور'],['roles','صلاحيات الكنترول'],['settings','الإعدادات والبيانات']]],
];
const VALID=new Set(VIEWS.flatMap(g=>g[1].map(x=>x[0])));
const ROLE_VIEWS={
  viewer:['dash','students','courses','halls','staff','exams','seating','duties','master','stats','verify'],
  invigilator:['dash','exams','halls','seating','duties','envelopes','attendance','incidents','verify'],
  auditor:['dash','students','courses','exams','grading','master','stats','appeals','verify'],
};
function viewOk(k){if(k==='roles')return MODE==='fb'&&can('chair');if(MODE!=='fb')return true;const l=ROLE_VIEWS[KROLE];return !l||l.includes(k)}
let rq=false,deferred=false;
function sched(){if(rq)return;rq=true;requestAnimationFrame(()=>{rq=false;render()})}
function editing(){const a=document.activeElement;return a&&$('#main').contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&a.type!=='checkbox'&&a.type!=='button'}
document.addEventListener('focusout',()=>{if(deferred){deferred=false;setTimeout(sched,0)}});
function toast(m,k){const t=document.createElement('div');t.className='toast'+(k?' '+k:'');t.textContent=m;$('#toasts').appendChild(t);setTimeout(()=>t.remove(),k==='bad'?6000:3200)}
function errMsg(e){if(!e)return'تعذر تنفيذ العملية.';if(e.code==='permission-denied')return'رفض الخادم العملية: دورك في الكنترول لا يسمح بها.';if(e.code==='unavailable')return'لا يوجد اتصال الآن؛ ستُزامَن التعديلات عند عودة الشبكة.';if(e.code==='invalid_argument')return'رُفضت الكتابة: ليست لديك صلاحية التعديل على هذه البيانات.';if(e.code==='quota_exceeded')return'امتلأت سعة قاعدة البيانات. احذف سجلات قديمة ثم أعد المحاولة.';return e.message||String(e)}

function counts(){
  const mis=arr('grades').reduce((a,g)=>a+Object.values(g.rows||{}).filter(r=>finalOf(r).mismatch).length,0);
  const inc=arr('incidents').filter(x=>x.status!=='صدر القرار').length;
  const ap=arr('appeals').filter(x=>x.status==='جديد'||x.status==='قيد التدقيق').length;
  return {grading:mis,incidents:inc,appeals:ap};
}
function renderNav(){
  const c=counts();
  $('#nav').innerHTML=MODE==='auth'?'':VIEWS.map(([g,items])=>[g,items.filter(([k])=>viewOk(k))]).filter(([,items])=>items.length).map(([g,items])=>`<div class="grp">${g}</div>`+items.map(([k,l])=>`<a href="#${k}" class="${UI.view===k?'on':''}" data-nav="${k}">${l}${c[k]?`<span class="badge ${k==='appeals'?'am':''}">${c[k]}</span>`:''}</a>`).join('')).join('');
  
  const me=$('#me');if(me){me.hidden=!(MODE==='fb'&&MEPROF);if(MEPROF)me.innerHTML=`<b>${esc(MEPROF.name)}</b><span class="mut">${esc(KROLES[KROLE]||'')}</span><button class="btn sm" data-act="logout">تسجيل الخروج</button>`}
  $('#mode').innerHTML=MODE==='fb'?(navigator.onLine?`<span class="dot on"></span>متصل بقاعدة Firebase${RO?' · اطلاع فقط':''}`:`<span class="dot loc"></span>دون اتصال — التعديلات تُحفظ وتُزامَن لاحقاً`):MODE==='auth'?`<span class="dot"></span>بانتظار تسجيل الدخول`:MODE==='cloud'?`<span class="dot on"></span>متصل — بيانات مشتركة${RO?' · اطلاع فقط':''}`:MODE==='local'?`<span class="dot loc"></span>وضع محلي على هذا الجهاز`:`<span class="dot"></span>جارٍ الاتصال…`;
}
function render(){
  if(editing()){deferred=true;return}
  renderNav();
  if(MODE==='boot'||MODE==='auth')return;
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
  depts:{t:'الأقسام',one:'قسم',p:'الأقسام العلمية التي تعقد امتحاناتها عبر هذا الكنترول.',f:[{k:'name',l:'اسم القسم',req:1},{k:'code',l:'الرمز المختصر'}],cols:['name','code']},
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
const COLL={sem:'الفصل',ects:'ECTS',kind:'النوع',name:'الاسم',code:'الرمز',no:'الرقم المعرفي',dept:'القسم',stage:'المرحلة',shift:'الدراسة',teacher:'الأستاذ',units:'الوحدات',building:'الموقع',rows:'صفوف',cols:'أعمدة',cap:'السعة',inv:'مراقبون',title:'اللقب',duties:'واجبات المراقبة',relatives:'أقارب طلبة',coi:'الإقرار',course:'المادة',group:'القسم/المرحلة',date:'التاريخ',period:'الجلسة',dur:'المدة',n:'الطلبة المؤهلون'};
function listView(c,extraTop=''){
  const sc=SCHEMA[c];let rows=arr(c);
  const hasDept=sc.f.some(f=>f.k==='dept'),hasStage=sc.f.some(f=>f.k==='stage');
  if(UI.fd&&hasDept)rows=rows.filter(r=>r.dept===UI.fd);
  if(UI.fs&&hasStage)rows=rows.filter(r=>String(r.stage)===UI.fs);
  if(UI.q){const q=UI.q.trim();rows=rows.filter(r=>Object.values(r).some(v=>String(v).includes(q)))}
  if(c==='students')rows.sort(byNo);else if(c==='exams')rows.sort((a,b)=>slotKey(a)<slotKey(b)?-1:1);else rows.sort((a,b)=>String(a.name||a.code||'').localeCompare(String(b.name||b.code||''),'ar'));
  const fbShared=MODE==='fb'&&(SHARED_RO.has(c)||c==='staff');
  const act=fbShared?'':`${c==='students'||c==='courses'?`<label class="btn"${RO?' style="opacity:.45"':''}>استيراد ملف Excel<input type="file" id="xlsxin2" accept=".xlsx,.xls,.csv" multiple hidden${roBtn()}></label>`:''}${c==='students'?`<button class="btn" data-act="import"${roBtn()}>لصق قائمة</button>`:''}<button class="btn pri" data-act="new" data-c="${c}"${roBtn()}>إضافة ${sc.one}</button>`;
  const filt=`<div class="row" style="margin-bottom:12px"><input type="search" id="q" placeholder="بحث…" value="${esc(UI.q)}" data-ui="q" style="width:200px">${hasDept?`<select id="fd" data-ui="fd">${opt('','كل الأقسام',UI.fd)}${arr('depts').map(d=>opt(d.id,d.name,UI.fd)).join('')}</select>`:''}${hasStage?`<select id="fs" data-ui="fs">${opt('','كل المراحل',UI.fs)}${STAGES.map((s,i)=>opt(String(i+1),'المرحلة '+s,UI.fs)).join('')}</select>`:''}<span class="mut">${rows.length} سجل</span></div>`;
  const body=rows.length?`<div class="tw"><table><thead><tr>${sc.cols.map(k=>`<th>${COLL[k]||k}</th>`).join('')}<th></th></tr></thead><tbody>${rows.map(r=>`<tr>${sc.cols.map(k=>`<td>${cellVal(c,k,r)}</td>`).join('')}<td>${rowBtns(c,r.id)}</td></tr>`).join('')}</tbody></table></div>`:empty('لا توجد سجلات بعد',`أضف ${sc.one} من الزر في الأعلى${c==='students'?'، أو الصق قائمة من Excel عبر «استيراد»':''}.`);
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
VIEW.depts=()=>listView('depts');
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
  const now=Date.now();const late=arr('appeals').filter(a=>(a.status==='جديد'||a.status==='قيد التدقيق')&&now-(a.at||now)>st.appealHours*36e5*0.75);if(late.length)alerts.push(['',`${late.length} اعتراض اقترب من تجاوز مهلة ${st.appealHours} ساعة أو تجاوزها.`,'appeals']);
  const noCoi=arr('staff').filter(p=>!p.coi).length;if(noCoi)alerts.push(['',`${noCoi} من الكادر بلا إقرار تعارض مصالح.`,'staff']);
  sl.forEach(s=>{if(s.dwarn&&s.dwarn.length)alerts.push(['',`نقص مراقبين: ${s.dwarn.join('، ')}`,'duties'])});
  const up=slots.filter(s=>s.date>=new Date().toISOString().slice(0,10)).slice(0,5);
  const upList=(up.length?up:slots.slice(0,5)).map(s=>{const d=S.slots.get(s.key)||{};const n=s.exams.reduce((a,e)=>a+examStudents(e).length,0);return `<tr><td>${esc(slotName(s))}</td><td class="wrap">${s.exams.map(e=>esc((S.courses.get(e.course)||{}).name)).join('، ')}</td><td>${n}</td><td>${d.seats?.length?'<span class="pill ok">المقاعد</span>':'<span class="pill warn">المقاعد</span>'} ${d.duties?.length?'<span class="pill ok">المراقبون</span>':'<span class="pill warn">المراقبون</span>'}</td></tr>`}).join('');
  const nextS=up[0]||slots[0];
  const hero=`<section class="hero"><div class="hero-in"><div class="crest" data-crest></div><div class="txt"><span class="pillgold"><i></i>${esc(st.college)} · ${esc(st.term)} · ${esc(st.year)}</span><h2>${esc(st.univ)}</h2><h3>نظام الكنترول وإدارة اللجان الامتحانية</h3><p>منظومة متكاملة تدير الامتحانات من الجدول وتوزيع المقاعد والمراقبين، إلى التشفير والرصد المزدوج والرأفة، حتى المصادقة ونشر النتائج للطلبة.</p><div class="chips"><span>Al-Maaqal International University · Basra</span><span>Examination Control System</span></div></div>
    <div class="status"><h4>حالة النظام الآن</h4><div><span class="${MODE==='fb'?(navigator.onLine?'ok':'wn'):'wn'}">قاعدة البيانات</span><em>${MODE==='fb'?(navigator.onLine?'متصلة':'دون اتصال'):MODE==='cloud'?'مشتركة':'محلية'}</em></div><div><span class="ok">الطلبة</span><em>${arr('students').length}</em></div><div><span class="ok">المواد (الفصل الحالي)</span><em>${arr('courses').filter(semOk).length}</em></div><div><span class="${mis?'wn':'ok'}">تعارضات الرصد</span><em>${mis}</em></div>${MEPROF?`<div><span class="ok">دورك</span><em>${esc(KROLES[KROLE]||'')}</em></div>`:''}${nextS?`<div><span class="wn">أقرب جلسة</span><em>${esc(nextS.date)}</em></div>`:''}</div></div></section>`;
  return hero+ph('لوحة القيادة',`${esc(st.univ)} · ${esc(st.college)} · ${esc(st.term)} ${esc(st.year)}`)+
  `<div class="grid g4" style="margin-bottom:14px">${[[arr('students').length,'طالباً مسجلاً'],[cs.length,'مادة امتحانية'],[slots.length,'جلسة امتحانية'],[arr('halls').length,'قاعة · سعة '+arr('halls').reduce((a,h)=>a+(+h.rows)*(+h.cols),0)],[arr('staff').length,'عضواً في الكادر']].map(([n,l])=>`<div class="card kpi"><b>${n}</b><span>${l}</span></div>`).join('')}</div>`+
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
  `<div class="row" style="margin-bottom:12px">${lock?`<span class="stamp ok">مصادق عليها — مقفلة</span><button class="btn" data-act="lock" data-v="0"${IS_ADMIN&&!RO?'':' disabled'}>إلغاء المصادقة</button>`:`<button class="btn pri" data-act="lock" data-v="1"${IS_ADMIN&&!RO&&!cnt('غير مكتمل')?'':' disabled'}>مصادقة النتائج وقفلها</button>${cnt('غير مكتمل')?'<span class="mut">تكتمل المصادقة بعد اكتمال الرصد.</span>':''}`}${MODE==='fb'&&lock?`<button class="btn pri" data-act="publish"${IS_ADMIN?'':' disabled'}>${(S.meta.get('locks')||{})[k.replace('|','_')]?.published?'إعادة نشر النتائج للطلبة':'نشر النتائج للطلبة في تطبيق الحضور'}</button>`:''}<button class="btn" data-act="dlmaster">تنزيل الماستر شيت (Excel)</button><button class="btn" data-act="dlmasterhtml">تنزيل نسخة للطباعة</button></div>`+
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
VIEW.appeals=()=>{
  const st=cfg();const list=arr('appeals').sort((a,b)=>(b.at||0)-(a.at||0));const now=Date.now();
  return ph('الاعتراضات',`بوابة تظلم موحدة: يُدقق الدفتر لجنةٌ محايدة خلال ${st.appealHours} ساعة. قبول الاعتراض مع درجة جديدة يعدّل النهائي في الماستر شيت ويُسجل في سجل التدقيق.`,`<button class="btn pri" data-act="new" data-c="appeals"${roBtn()}>تسجيل اعتراض</button>`)+
  (list.length?`<div class="tw"><table><thead><tr><th>الطالب</th><th>المادة</th><th>الدرجة الحالية</th><th>السبب</th><th>المهلة</th><th>الحالة</th><th></th></tr></thead><tbody>${list.map(a=>{const open=a.status==='جديد'||a.status==='قيد التدقيق';const left=st.appealHours-(now-(a.at||now))/36e5;const r=res(a.course,a.student);return `<tr><td>${esc(label.students(S.students.get(a.student)))}</td><td>${esc((S.courses.get(a.course)||{}).name)}</td><td>${r1(r.total)}</td><td class="wrap">${esc(a.reason)}${a.note?`<div class="mut">التقرير: ${esc(a.note)}</div>`:''}</td><td>${open?(left>0?`<span class="${left<12?'red':''}">${Math.floor(left)} ساعة متبقية</span>`:`<span class="pill bad">متأخر ${Math.ceil(-left)} ساعة</span>`):'—'}</td><td><span class="pill ${open?'warn':a.status.startsWith('مقبول')?'ok':''}">${esc(a.status)}</span></td><td>${rowBtns('appeals',a.id)}</td></tr>`}).join('')}</tbody></table></div>`:empty('لا توجد اعتراضات','سجّل اعتراض الطالب ليبدأ عدّاد المهلة.'));
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
  `<form class="card" data-form="settings" style="margin-bottom:14px"><h3>الجامعة والدورة الامتحانية</h3><div class="fgrid">${F('univ','الجامعة')}${F('college','الكلية')}${F('year','العام الدراسي')}${F('term','الفصل/الدور')}<label class="f">الفصل الحالي<select name="curSem" id="s_curSem">${opt('1','الفصل الأول',st.curSem)}${opt('2','الفصل الثاني',st.curSem)}</select></label>${F('p1','وقت الجلسة الأولى','time')}${F('p2','وقت الجلسة الثانية','time')}</div><h3 style="margin-top:16px">ضوابط الدرجات</h3><div class="fgrid">${F('cwMax','درجة السعي القصوى','number')}${F('finMax','درجة النهائي القصوى','number')}${F('pass','درجة النجاح','number')}${F('maxCarry','أقصى عدد مواد مكملة','number')}${F('graceTotal','رصيد الرأفة للطالب','number')}${F('gracePer','أقصى رأفة للمادة الواحدة','number')}${F('appealHours','مهلة البت بالاعتراض (ساعة)','number')}${B('double','الرصد المزدوج (مدقق ثانٍ)')}${B('useParts','السعي من مكوناته (حضور 5، واجب 5، مشروع 10، مختبر 10، أسبوعي 10، فصلي 10)')}${B('requireCoi','استبعاد من لم يوقع إقرار تعارض المصالح')}</div><div class="row" style="margin-top:14px"><button class="btn pri" type="submit"${RO||(fbm&&!IS_ADMIN)?' disabled':''}>حفظ الإعدادات</button>${fbm&&!IS_ADMIN?'<span class="mut">تعديل الإعدادات لرئيس اللجنة.</span>':''}</div></form>`+(fbm?
  `<div class="card"><h3>قاعدة البيانات</h3><p class="mut" style="margin-top:0">النظام متصل بمشروع Firebase «${esc(FB.projectId)}» نفسه الذي يعمل عليه تطبيق الحضور. الأقسام والمواد والطلبة والكادر ومكونات السعي تُقرأ منه مباشرة، وبيانات الكنترول (القاعات، الجداول، المقاعد، الرصد المزدوج، الأرقام السرية، المحاضر، سجل التدقيق) في مجموعات k_ تحميها قواعد Firestore حسب الدور. يعمل دون اتصال ويزامن تلقائياً عند عودة الشبكة.</p><div class="row"><button class="btn" data-act="backup">تنزيل نسخة احتياطية (JSON)</button></div></div>`:
  `<div class="card" style="margin-bottom:14px"><h3>استيراد من ملفات Excel</h3><p class="mut" style="margin-top:0">يقرأ ملفات الجامعة كما هي: كشوف الطلبة (ورقة لكل مرحلة ودوام)، قاعدة المواد (رمز المقرر والفصل والقسم)، وسجلات الدرجات (ورقة لكل مادة بعناوين مثل «المشروع (10)»). يكتشف صف العناوين تلقائياً، ويطابق كل ورقة بمادتها، ويعرض الصفوف المرفوضة وسببها قبل الحفظ. لا يحذف شيئاً: يضيف الجديد ويحدّث الموجود.</p><label class="btn pri"${RO?' style="opacity:.45"':''}>اختيار ملفات Excel<input type="file" id="xlsxin" accept=".xlsx,.xls,.csv" multiple hidden${roBtn()}></label></div>
<div class="card"><h3>البيانات والنسخ الاحتياطي</h3><p class="mut" style="margin-top:0">${MODE==='cloud'?'البيانات محفوظة في قاعدة مشتركة بين كل من يملك صلاحية على هذه الصفحة، وتتزامن لحظياً بين الحاسوب والهاتف والجهاز اللوحي.':'تعمل الآن في الوضع المحلي: البيانات محفوظة في هذا المتصفح فقط. للعمل المشترك أضف إعدادات Firebase في firebase-config.js.'}</p><div class="row"><button class="btn" data-act="backup">تنزيل نسخة احتياطية (JSON)</button><label class="btn"${RO?' style="opacity:.45"':''}>استعادة من نسخة<input type="file" id="restore" accept=".json,application/json" hidden${roBtn()}></label><button class="btn" data-act="sample"${roBtn()}>تحميل بيانات تجريبية</button>${UI.cdel==='ALL'?`<button class="btn bad" data-act="wipe"${roBtn()}>تأكيد مسح كل البيانات</button>`:`<button class="btn bad" data-act="askdel" data-k="ALL"${roBtn()}>مسح كل البيانات</button>`}</div></div>`);
};

VIEW.roles=()=>{
  if(MODE!=='fb')return ph('صلاحيات الكنترول','')+empty('تعمل عند الربط بقاعدة Firebase','');
  const staff=arr('staff').sort((a,b)=>String(a.name).localeCompare(String(b.name),'ar'));
  const auto=p=>SUPER_ADMINS.includes(p.id)||['admin','president'].includes(p.role);
  const n=k=>staff.filter(p=>!auto(p)&&(RAW.kroles.get(p.id)||{}).role===k).length;
  return ph('صلاحيات الكنترول','الدخول بحساب تطبيق الحضور نفسه، والدور هنا يحدد ما يراه كل عضو. مدير النظام والإدارة العليا رؤساء للكنترول تلقائياً. تحمي قواعد Firestore هذه الحدود على الخادم، لا في الواجهة فقط.')+
  `<div class="grid g4" style="margin-bottom:12px">${Object.entries(KROLES).map(([k,l])=>`<div class="card kpi"><b>${n(k)+(k==='chair'?staff.filter(auto).length:0)}</b><span>${l}</span></div>`).join('')}</div>`+
  `<div class="note" style="margin-bottom:12px"><b>رئيس اللجنة:</b> كل شيء، ومنه فك التشفير والمصادقة ونشر النتائج والصلاحيات. <b>عضو كنترول:</b> كل العمل عدا ذلك. <b>مدقق درجات:</b> الإدخال الثاني والدور الثاني فقط. <b>مراقب:</b> الحضور والأظرف ومحاضر الغش يوم الامتحان. <b>اطلاع:</b> قراءة فقط.</div>`+
  `<div class="tw"><table><thead><tr><th>العضو</th><th>صفته في نظام الحضور</th><th>دوره في الكنترول</th></tr></thead><tbody>${staff.map(p=>`<tr><td>${esc(p.name)}<div class="mut mono" style="font-size:12px">${esc(p.id)}</div></td><td>${esc(ROLE_AR[p.role]||p.role||'—')}</td><td>${auto(p)?'<span class="pill acc">رئيس اللجنة (تلقائي)</span>':`<select data-krole="${esc(p.id)}">${opt('','بلا صلاحية',(RAW.kroles.get(p.id)||{}).role||'')}${Object.entries(KROLES).map(([k,l])=>opt(k,l,(RAW.kroles.get(p.id)||{}).role||'')).join('')}</select>`}</td></tr>`).join('')}</tbody></table></div>`;
};

/* ============ الإجراءات ============ */
const ACT={};
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
ACT.savegrades=async()=>{const c=S.courses.get(UI.course);const dr=DRAFT[c.id]||{};const st=cfg();const rows={};let bad=0;
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
ACT.backup=()=>{const o={app:'kontrol',v:2,at:new Date().toISOString()};COLLS.forEach(c=>o[c]=arr(c));download(`kontrol-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(o,null,1))};
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
ACT.dlmaster=()=>{const k=UI.group;const cs=groupCourses(k);const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';let csv='﻿'+['الرقم الامتحاني','الاسم',...cs.flatMap(c=>[c.name+' سعي',c.name+' نهائي',c.name+' رأفة',c.name+' مجموع',c.name+' تقدير']),'النتيجة','رمز التحقق'].map(q).join(',')+'\n';
  masterRows(k).forEach(r=>{csv+=[r.s.no,r.s.name,...r.rs.flatMap(x=>x.total==null?[x.label,'','','','']:[x.cw,x.abs?'غائب':x.fin,x.grace||'',x.total,grade(x.total)]),r.st.label,r.vc].map(q).join(',')+'\n'});download(`ماستر-شيت-${groupName(k)}.csv`,csv)};
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
  add('meta','settings',{univ:'جامعة المعقل الدولية',college:'كلية الهندسة',year:'2026–2027',term:'الفصل الدراسي الأول — الدور الأول',cwMax:40,finMax:60,pass:50,maxCarry:2,graceTotal:5,gracePer:5,double:true,useParts:false,curSem:'1',requireCoi:false,appealHours:48,p1:'09:00',p2:'11:30'});
  add('meta','committee',{chair:'p0',rap:'p2',m1:'p1',m2:'p6',m3:'p7',tech:'p11'});
  // درجات لمواد اليومين الأولين
  const graded=['CE201','CE202','CE203','CE301','CE302','CE303','EE201','EE301','EE202','EE302'];
  Object.entries(CN).forEach(([k,list])=>list.forEach(([code])=>{if(!graded.includes(code))return;const rows={};studIds[k].forEach((sid,i)=>{const ab=R();const cw=Math.round((18+R()*20)*2)/2;let fin=Math.round((14+R()*44)*2)/2;if(code==='CE302')fin=Math.max(0,fin-12);if(i===3&&code==='CE201')fin=Math.max(0,47-cw);const r={cw,absPct:Math.round(R()*12)};if(code==='EE202'&&i===14){r.dep=true;r.absPct=18}else if(ab<0.04){r.abs=true;r.e1=0;r.e2=0}else{r.e1=fin;r.e2=(code==='CE202'&&i===6)?fin+5:(code==='EE302'&&i>=12)?null:fin}rows[sid]=r});add('grades','c_'+code,{rows})}));
  add('incidents','inc1',{student:'s_25CE3_9',exam:'e_CE301',hall:'h205',time:'12:10',tool:'سماعة لاسلكية',desc:'ضُبطت سماعة لاسلكية دقيقة في أذن الطالب بعد مرور 40 دقيقة على بدء الامتحان، وسُحب الدفتر وحُرزت الأداة.',witnesses:'م.م. علي عبد الحسين، م.د. أسيل كريم',statement:true,status:'محال إلى العميد',at:Date.now()-26*36e5});
  add('appeals','ap1',{student:'s_26CE2_2',course:'c_CE201',reason:'يعتقد الطالب أن السؤال الثالث لم يُصحح كاملاً.',status:'قيد التدقيق',at:Date.now()-30*36e5});
  add('appeals','ap2',{student:'s_26EE2_7',course:'c_EE201',reason:'خطأ محتمل في جمع درجات الأسئلة الفرعية.',status:'جديد',at:Date.now()-5*36e5});
  await bulk(items);
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
  Promise.resolve().then(()=>submitForm(f)).catch(err=>{const el=$('#ferr');if(el)el.textContent=errMsg(err);else toast(errMsg(err),'bad')});
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset.ui){UI[t.dataset.ui]=t.value;if(t.dataset.ui==='course')UI.gtab=UI.gtab||'cw';render();return}
  if(t.dataset.draft&&t.type==='checkbox'){setDraft(t);render();return}
  if(t.dataset.hall){const sd=S.slots.get(UI.slot);if(sd&&!RO){patch('slots',UI.slot,{halls:hallsChecked()}).catch(()=>{})}else render();return}
  if(t.dataset.com){patch('meta','committee',{[t.dataset.com]:t.value||null}).then(()=>log('تشكيل اللجنة',t.closest('label').firstChild.textContent+': '+label.staff(S.staff.get(t.value)))).catch(err=>toast(errMsg(err),'bad'));return}
  if(t.dataset.krole!==undefined){const em=t.dataset.krole,r=t.value;const ref=FB.doc(FB.db,'k_roles',em);
    settle(r?FB.setDoc(ref,{role:r,by:ME,at:Date.now()}):FB.deleteDoc(ref)).then(()=>log('صلاحيات الكنترول',`${label.staff(S.staff.get(em))} ← ${KROLES[r]||'بلا صلاحية'}`)).then(()=>toast('حُفظت الصلاحية')).catch(err=>toast(errMsg(err),'bad'));return}
  if(t.dataset.rubric){patch('envelopes',t.dataset.rubric,{rubric:t.checked}).catch(err=>toast(errMsg(err),'bad'));return}
  if((t.id==='xlsxin'||t.id==='xlsxin2')&&t.files.length){startImport([...t.files]);t.value='';return}
  if(t.dataset.impdept!==undefined&&IMP){IMP.dept=t.value;IMP.res=analyze(IMP.books,IMP.dept);$('#modal').innerHTML=importView();return}
  if(t.id==='restore'&&t.files[0]){const r=new FileReader();r.onload=async()=>{try{const o=JSON.parse(r.result);if(o.app!=='kontrol')throw new Error('الملف ليس نسخة احتياطية من هذا النظام.');const items=[];COLLS.forEach(c=>(o[c]||[]).forEach(x=>items.push({c,id:x.id,data:x})));await bulk(items);await log('استعادة نسخة احتياطية',`${items.length} سجل`);toast(`استُعيد ${items.length} سجل`)}catch(err){toast(errMsg(err),'bad')}};r.readAsText(t.files[0])}
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
    if(window.FBX_ERROR)toast('تعذر الاتصال بـ Firebase، يعمل النظام محلياً: '+window.FBX_ERROR,'bad');
    MODE='local';
    if(!loadLocal()){await loadSample()}
  }
  render();
}
boot();
