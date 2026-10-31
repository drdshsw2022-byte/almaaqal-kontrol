<?php
/* قراءة كتاب من السيرفر لمن سجّل الدخول فقط.
 *   POST book.php  token=<Firebase>&id=<معرّف الكتاب>
 *        ← {"url": "…", "dl": "…" (للمدير فقط), "size": …}   روابط صالحة 4 ساعات
 *   GET  book.php?f=<id>&e=<انتهاء>&k=<توقيع>[&d=1]   ← الملف (مع دعم Range للقارئ)
 * الملفات في files/ (ممنوعة من الويب بـ .htaccess).
 */
require __DIR__ . '/../amu-guard.php';
const BOOK_TTL = 14400;
$BASE = 'https://it-basra.com/amu/library/book.php';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
  header('Content-Type: application/json; charset=utf-8');
  $pay = require_user();
  $id = (string)($_POST['id'] ?? '');
  if (!preg_match('/^[\w-]{10,80}$/', $id)) fail(400, 'معرّف غير صالح.');
  $b = book_by_id(amu_catalog(), $id);
  if (!$b) fail(404, 'الكتاب غير موجود في الفهرس.');
  $path = book_file($b);
  if (!is_file($path)) fail(404, 'الكتاب لم يُنقل إلى السيرفر بعد.');
  $e = time() + BOOK_TTL;
  $q = fn($d) => $BASE . '?' . http_build_query(['f' => $id, 'e' => $e, 'd' => $d, 'k' => amu_sign("book:$id:$e:$d")]);
  $out = ['url' => $q(0), 'size' => filesize($path), 'ext' => pathinfo($path, PATHINFO_EXTENSION)];
  if (is_admin_pay($pay)) $out['dl'] = $q(1);
  echo json_encode($out, JSON_UNESCAPED_SLASHES);
  exit;
}

// GET / HEAD برابط موقّع
$id = (string)($_GET['f'] ?? ''); $e = (int)($_GET['e'] ?? 0); $d = ($_GET['d'] ?? '0') === '1' ? 1 : 0; $k = (string)($_GET['k'] ?? '');
if (!preg_match('/^[\w-]{10,80}$/', $id) || $e < time() || $e > time() + BOOK_TTL + 60 || !hash_equals(amu_sign("book:$id:$e:$d"), $k)) {
  fail(403, 'انتهت صلاحية رابط القراءة. أغلق الكتاب وافتحه من جديد.');
}
$b = book_by_id(amu_catalog(), $id);
if (!$b || !is_file(book_file($b))) fail(404, 'الكتاب غير موجود.');
$path = book_file($b);
$ext = pathinfo($path, PATHINFO_EXTENSION);
$name = preg_replace('/[\\\\\/:*?"<>|]+/', ' ', $b['t'] ?? $id) . '.' . $ext;
send_file($path, BOOK_TYPE[$ext] ?? 'application/octet-stream', $name, $d === 1 || $ext !== 'pdf');
