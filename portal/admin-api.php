<?php
/* واجهة لوحة مدير النظام (للمدراء فقط، بحساب Google للمدير).
 * كل الطلبات POST مع token=<Firebase ID token>.
 *  الكتب:
 *   action=books                                   ← الفهرس كاملاً مع حالة كل ملف (h) وغلافه (cv) وحجمه
 *   action=book_save  id?(للتعديل) t c l [x]        ← إضافة كتاب جديد إلى الفهرس أو تعديل عنوانه وتصنيفه ولغته
 *   action=book_delete id                          ← حذف الكتاب من الفهرس ونقل ملفه إلى private/removed-books/
 *   action=book_chunk id i n data(ملف)              ← رفع الملف على أجزاء (i من 0 إلى n-1)؛ بعد آخر جزء يُتحقق أنه PDF/Office
 *   action=book_cover id data(صورة JPEG)            ← حفظ غلاف الكتاب
 *   action=cat_save  cats(JSON [{id,name}])        ← تعديل قائمة التصنيفات
 *  الكليات:
 *   action=colleges_save data(JSON)                ← يحفظ colleges.json العام (الكليات والأقسام لاختيار الزائر)
 */
require __DIR__ . '/amu-guard.php';
header('Content-Type: application/json; charset=utf-8');
$pay = require_user();
if (!is_admin_pay($pay)) fail(403, 'للمدير فقط.');
$action = $_POST['action'] ?? '';
const DATA_FILE = __DIR__ . '/library/books-data.php';
const GUARD = "<?php exit; ?>\n";
const MAX_BOOK = 300 * 1048576;

function save_catalog($cat) {
  $tmp = DATA_FILE . '.tmp';
  if (@file_put_contents($tmp, GUARD . json_encode($cat, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX) === false || !@rename($tmp, DATA_FILE))
    fail(500, 'تعذّر حفظ الفهرس.');
}
function s($v, $max) { return mb_substr(trim(preg_replace('/[\x00-\x1F]/u', ' ', (string)$v)), 0, $max); }
function valid_id($id) { return preg_match('/^[\w-]{10,80}$/', $id); }
function lock_catalog() { $fp = fopen(__DIR__ . '/library/.catalog.lock', 'c'); flock($fp, LOCK_EX); return $fp; }

if ($action === 'books') {
  $cat = amu_catalog();
  foreach ($cat['books'] as &$b) {
    $f = book_file($b);
    $b['h'] = is_file($f) ? 1 : 0; $b['bytes'] = is_file($f) ? filesize($f) : 0;
    $b['cv'] = is_file(book_cover($b['id'])) ? 1 : 0;
  }
  unset($b);
  echo json_encode($cat + ['free_mb' => round(@disk_free_space(__DIR__) / 1048576)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

if ($action === 'book_save') {
  $lk = lock_catalog();
  $cat = amu_catalog();
  $t = s($_POST['t'] ?? '', 200);
  $c = s($_POST['c'] ?? 'gen', 20);
  $l = in_array($_POST['l'] ?? '', ['ar', 'en'], true) ? $_POST['l'] : 'ar';
  $x = strtoupper(s($_POST['x'] ?? 'PDF', 5));
  if (!isset(BOOK_EXT[$x])) $x = 'PDF';
  if (mb_strlen($t) < 2) fail(400, 'اكتب عنوان الكتاب.');
  if (!in_array($c, array_column($cat['cats'], 'id'), true)) fail(400, 'تصنيف غير معروف.');
  $id = s($_POST['id'] ?? '', 80);
  if ($id !== '') {
    foreach ($cat['books'] as &$b) if ($b['id'] === $id) { $b['t'] = $t; $b['c'] = $c; $b['l'] = $l; $found = 1; }
    unset($b);
    if (empty($found)) fail(404, 'الكتاب غير موجود.');
  } else {
    $id = 'amu' . bin2hex(random_bytes(10));
    $cat['books'][] = ['id' => $id, 't' => $t, 'c' => $c, 's' => 0, 'x' => $x, 'l' => $l];
  }
  save_catalog($cat);
  echo json_encode(['ok' => 1, 'id' => $id]);
  exit;
}

if ($action === 'book_delete') {
  $lk = lock_catalog();
  $cat = amu_catalog();
  $id = s($_POST['id'] ?? '', 80);
  $b = book_by_id($cat, $id);
  if (!$b) fail(404, 'الكتاب غير موجود.');
  $bin = __DIR__ . '/private/removed-books';
  if (!is_dir($bin)) @mkdir($bin, 0755, true);
  foreach ([book_file($b), book_cover($id)] as $f) if (is_file($f)) @rename($f, $bin . '/' . basename($f));
  $cat['books'] = array_values(array_filter($cat['books'], fn($x) => $x['id'] !== $id));
  save_catalog($cat);
  echo json_encode(['ok' => 1]);
  exit;
}

if ($action === 'book_chunk') {
  $id = s($_POST['id'] ?? '', 80);
  $i = (int)($_POST['i'] ?? -1); $n = (int)($_POST['n'] ?? 0);
  if (!valid_id($id) || $n < 1 || $n > 400 || $i < 0 || $i >= $n) fail(400, 'بيانات الرفع غير صالحة.');
  $b = book_by_id(amu_catalog(), $id);
  if (!$b) fail(404, 'أضف الكتاب إلى الفهرس أولاً.');
  $f = $_FILES['data'] ?? null;
  if (!$f || $f['error'] !== UPLOAD_ERR_OK) fail(400, 'لم يصل جزء الملف (رمز ' . ($f['error'] ?? '?') . ').');
  $dest = book_file($b); $part = $dest . '.part';
  if (!is_dir(dirname($dest))) @mkdir(dirname($dest), 0755, true);
  if ($i === 0) @unlink($part);
  elseif (!is_file($part)) fail(409, 'انقطع الرفع. ابدأ من جديد.');
  clearstatcache();
  if ((is_file($part) ? filesize($part) : 0) + $f['size'] > MAX_BOOK) { @unlink($part); fail(413, 'الملف أكبر من 300 MB.'); }
  if (@file_put_contents($part, file_get_contents($f['tmp_name']), FILE_APPEND | LOCK_EX) === false) fail(500, 'تعذّر حفظ جزء الملف.');
  if ($i < $n - 1) { echo json_encode(['ok' => 1, 'got' => $i]); exit; }
  $head = file_get_contents($part, false, null, 0, 5);
  $ext = pathinfo($dest, PATHINFO_EXTENSION);
  if ($ext === 'pdf' ? strpos($head, '%PDF') !== 0 : strpos($head, 'PK') !== 0) { @unlink($part); fail(415, 'الملف ليس ' . strtoupper($ext) . ' صالحاً.'); }
  rename($part, $dest);
  $lk = lock_catalog();
  $cat = amu_catalog();
  foreach ($cat['books'] as &$bb) if ($bb['id'] === $id) $bb['s'] = round(filesize($dest) / 1048576, 1);
  unset($bb);
  save_catalog($cat);
  echo json_encode(['ok' => 1, 'done' => 1, 'bytes' => filesize($dest)]);
  exit;
}

if ($action === 'book_cover') {
  $id = s($_POST['id'] ?? '', 80);
  if (!valid_id($id) || !book_by_id(amu_catalog(), $id)) fail(404, 'الكتاب غير موجود.');
  $f = $_FILES['data'] ?? null;
  if (!$f || $f['error'] !== UPLOAD_ERR_OK || $f['size'] > 2 * 1048576) fail(400, 'صورة الغلاف غير صالحة.');
  $img = @getimagesize($f['tmp_name']);
  if (!$img || $img[2] !== IMAGETYPE_JPEG) fail(415, 'الغلاف يجب أن يكون JPEG.');
  $dir = dirname(book_cover($id));
  if (!is_dir($dir)) @mkdir($dir, 0755, true);
  if (!@move_uploaded_file($f['tmp_name'], book_cover($id))) fail(500, 'تعذّر حفظ الغلاف.');
  echo json_encode(['ok' => 1]);
  exit;
}

if ($action === 'cat_save') {
  $lk = lock_catalog();
  $cat = amu_catalog();
  $in = json_decode($_POST['cats'] ?? '', true);
  if (!is_array($in) || !$in) fail(400, 'قائمة التصنيفات فارغة.');
  $out = [];
  foreach ($in as $c) {
    $id = preg_replace('/[^a-z0-9_]/', '', strtolower($c['id'] ?? ''));
    $name = s($c['name'] ?? '', 60);
    if ($id && $name) $out[] = ['id' => $id, 'name' => $name];
  }
  $used = array_unique(array_column($cat['books'], 'c'));
  $missing = array_diff($used, array_column($out, 'id'));
  if ($missing) fail(400, 'لا يمكن حذف تصنيف فيه كتب: ' . implode('، ', $missing));
  $cat['cats'] = $out;
  save_catalog($cat);
  echo json_encode(['ok' => 1]);
  exit;
}

if ($action === 'colleges_save') {
  $in = json_decode($_POST['data'] ?? '', true);
  if (!is_array($in) || empty($in['colleges'])) fail(400, 'بيانات الكليات فارغة.');
  $out = ['updated' => gmdate('c'), 'colleges' => []];
  foreach ($in['colleges'] as $c) {
    $col = ['id' => s($c['id'] ?? '', 60), 'name' => s($c['name'] ?? '', 120), 'depts' => []];
    foreach (($c['depts'] ?? []) as $d) $col['depts'][] = ['id' => s($d['id'] ?? '', 60), 'name' => s($d['name'] ?? '', 120)];
    if ($col['id'] && $col['name']) $out['colleges'][] = $col;
  }
  if (@file_put_contents(__DIR__ . '/colleges.json', json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX) === false) fail(500, 'تعذّر الحفظ.');
  echo json_encode(['ok' => 1, 'n' => count($out['colleges'])]);
  exit;
}

fail(400, 'إجراء غير معروف.');
