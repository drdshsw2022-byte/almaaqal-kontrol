<?php
/* أداة المدير لنقل الكتب من Google Drive إلى السيرفر (مرة واحدة، ثم لكل كتاب جديد يُضاف إلى الفهرس).
 *   POST import.php token=<Firebase للمدير>&action=status        ← حالة كل كتاب ومساحة القرص
 *   POST import.php token=…&action=fetch&id=<معرّف>              ← ينزّل الكتاب وغلافه من Drive
 * لا يعمل إلا لحساب المدير، ولا ينزّل إلا كتاباً موجوداً في الفهرس.
 * يعمل ما دام الملف في Drive مشاركاً بالرابط؛ بعد جعل المجلد خاصاً لا يلزم.
 */
require __DIR__ . '/../amu-guard.php';
header('Content-Type: application/json; charset=utf-8');
$pay = require_user();
if (!is_admin_pay($pay)) fail(403, 'للمدير فقط.');
$cat = amu_catalog();
foreach (['files', 'covers'] as $dir) if (!is_dir(__DIR__ . "/$dir")) @mkdir(__DIR__ . "/$dir", 0755);
$action = $_POST['action'] ?? 'status';

if ($action === 'status') {
  $list = [];
  foreach ($cat['books'] as $b) {
    $f = book_file($b);
    $list[] = ['id' => $b['id'], 'have' => is_file($f) ? filesize($f) : 0, 'cv' => is_file(book_cover($b['id'])) ? 1 : 0, 's' => $b['s'] ?? 0];
  }
  echo json_encode(['books' => $list, 'free_mb' => round(@disk_free_space(__DIR__) / 1048576)]);
  exit;
}

if ($action !== 'fetch') fail(400, 'إجراء غير معروف.');
$id = (string)($_POST['id'] ?? '');
$b = book_by_id($cat, $id);
if (!$b) fail(404, 'الكتاب غير موجود في الفهرس.');
@set_time_limit(0); @ignore_user_abort(true);

function curl_to_file($url, $dest) {
  $tmp = $dest . '.part';
  $fp = fopen($tmp, 'wb');
  $c = curl_init($url);
  curl_setopt_array($c, [CURLOPT_FILE => $fp, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 8, CURLOPT_CONNECTTIMEOUT => 20, CURLOPT_TIMEOUT => 900,
    CURLOPT_USERAGENT => 'Mozilla/5.0 (almaaqal-library-import)', CURLOPT_FAILONERROR => true]);
  $ok = curl_exec($c); $code = curl_getinfo($c, CURLINFO_HTTP_CODE); $err = curl_error($c); curl_close($c); fclose($fp);
  if (!$ok) { @unlink($tmp); return "HTTP $code $err"; }
  return $tmp;
}

$out = ['id' => $id];
$dest = book_file($b);
if (!is_file($dest) || !empty($_POST['force'])) {
  $tmp = curl_to_file('https://drive.usercontent.google.com/download?id=' . rawurlencode($id) . '&export=download&confirm=t', $dest);
  if (!is_file($tmp)) fail(502, 'تعذّر التنزيل من Drive: ' . $tmp);
  $head = file_get_contents($tmp, false, null, 0, 5);
  $ext = pathinfo($dest, PATHINFO_EXTENSION);
  $valid = $ext === 'pdf' ? strpos($head, '%PDF') === 0 : strpos($head, "PK") === 0;
  if (!$valid) { @unlink($tmp); fail(502, 'ما نزل من Drive ليس ملف ' . strtoupper($ext) . ' (قد يكون الملف غير مشارك بالرابط).'); }
  rename($tmp, $dest);
}
$out['size'] = filesize($dest);

$cv = book_cover($id);
if (!is_file($cv)) {
  $tmp = curl_to_file('https://drive.google.com/thumbnail?id=' . rawurlencode($id) . '&sz=w400', $cv);
  if (is_file($tmp)) {
    $img = @getimagesize($tmp);
    if ($img && $img[0] > 40 && in_array($img[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) rename($tmp, $cv); else @unlink($tmp);
  }
}
$out['cv'] = is_file($cv) ? 1 : 0;
echo json_encode($out);
