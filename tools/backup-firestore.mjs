// نسخة احتياطية كاملة من Firestore: كل مجموعة (ومجموعاتها الفرعية) في ملف JSON.
// يُشغَّل من سير العمل backup.yml بحساب الخدمة FIREBASE_SERVICE_ACCOUNT.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, GeoPoint, DocumentReference } from 'firebase-admin/firestore';
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || 'backup';
const sa = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
initializeApp({ credential: cert(sa), projectId: process.env.PROJECT || sa.project_id });
const db = getFirestore();

const plain = (v) => {
  if (v instanceof Timestamp) return { __ts: v.toMillis() };
  if (v instanceof GeoPoint) return { __geo: [v.latitude, v.longitude] };
  if (v instanceof DocumentReference) return { __ref: v.path };
  if (Buffer.isBuffer(v)) return { __bytes: v.toString('base64') };
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
};

const summary = {};
async function dumpCollection(col, prefix) {
  const snap = await col.get();
  const docs = {};
  for (const d of snap.docs) {
    docs[d.id] = plain(d.data());
    for (const sub of await d.ref.listCollections()) await dumpCollection(sub, `${prefix}${col.id}__${d.id}__`);
  }
  const name = prefix + col.id;
  fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(docs));
  summary[name] = snap.size;
}

fs.mkdirSync(out, { recursive: true });
for (const col of await db.listCollections()) await dumpCollection(col, '');
fs.writeFileSync(path.join(out, '_summary.json'), JSON.stringify({ at: new Date().toISOString(), project: sa.project_id, counts: summary }, null, 1));
console.log(JSON.stringify(summary));
