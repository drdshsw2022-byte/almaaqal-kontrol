<?php
/* تنزيل تطبيق أندرويد لمن سجّل الدخول فقط.
 *   GET  apk.php?meta=1              ← {"size":…, "mtime":…} (حجم وتاريخ الملف، بلا دخول)
 *   POST apk.php  token=<Firebase>   ← {"url":"apk.php?k=…"} رابط تنزيل صالح 10 دقائق
 *   GET  apk.php?k=<رابط موقّع>       ← الملف نفسه
 * الملف الحقيقي في private/almaqal-12.apk (المجلد private ممنوع من الويب بـ .htaccess).
 * الرابط الموقّع يجعل التنزيل طلب GET عادياً، فيعمل مع مدير التنزيلات في أندرويد وآيفون.
 */
require __DIR__ . '/amu-guard.php';

const APK_NAME = 'almaqal-12.apk';
const LINK_TTL = 600;
$DIR = __DIR__ . '/private';
$APK = $DIR . '/' . APK_NAME;

function apk_secret($dir) {
  $f = $dir . '/apk-secret.php';
  $guard = "<?php exit; ?>\n";
  $raw = @file_get_contents($f);
  if ($raw !== false && strpos($raw, $guard) === 0 && strlen($raw) > strlen($guard) + 32) return substr($raw, strlen($guard));
  $s = bin2hex(random_bytes(32));
  if (!@file_put_contents($f, $guard . $s, LOCK_EX)) fail(500, 'تعذّر تجهيز رابط التنزيل.');
  return $s;
}
function sign($exp, $secret) { return $exp . '.' . substr(hash_hmac('sha256', 'apk:' . $exp, $secret), 0, 40); }

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET' && isset($_GET['meta'])) {
  header('Content-Type: application/json; charset=utf-8');
  if (!is_file($APK)) fail(404, 'الملف غير موجود.');
  echo json_encode(['name' => APK_NAME, 'size' => filesize($APK), 'mtime' => filemtime($APK)]);
  exit;
}

if ($method === 'POST') {
  header('Content-Type: application/json; charset=utf-8');
  require_user();
  if (!is_file($APK)) fail(404, 'ملف التطبيق غير موجود على السيرفر.');
  $exp = time() + LINK_TTL;
  echo json_encode(['url' => 'https://it-basra.com/amu/apk.php?k=' . sign($exp, apk_secret($DIR))]);
  exit;
}

// GET apk.php?k=…
$k = (string)($_GET['k'] ?? '');
$exp = (int)strtok($k, '.');
$ok = $k !== '' && $exp >= time() && $exp <= time() + LINK_TTL + 60 && hash_equals(sign($exp, apk_secret($DIR)), $k);
if (!$ok) {
  // رابط قديم أو مباشر: نعيده إلى قسم التطبيق في البوابة ليسجّل الدخول
  header('Location: https://it-basra.com/amu/index.html#dl', true, 302);
  exit;
}
if (!is_file($APK)) fail(404, 'ملف التطبيق غير موجود على السيرفر.');

while (ob_get_level()) ob_end_clean();
header('Content-Type: application/vnd.android.package-archive');
header('Content-Disposition: attachment; filename="' . APK_NAME . '"');
header('Content-Length: ' . filesize($APK));
header('Last-Modified: ' . gmdate('D, d M Y H:i:s', filemtime($APK)) . ' GMT');
@set_time_limit(0);
readfile($APK);
