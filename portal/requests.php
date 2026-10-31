<?php
/* طلبات الدعم الفني وطلبات تنزيل الكتب — تُحفظ على السيرفر ويتابعها المدير من لوحة مدير النظام.
 *   POST requests.php action=create  type=support|download  msg=…  [token=…] [name=…] [contact=…] [book=…] [page=…]
 *        ← {"ok":1,"id":"R-…"}   (الزائر دون دخول يكتب اسمه ووسيلة تواصل؛ حد 5 طلبات في الساعة لكل عنوان)
 *   POST requests.php action=mine    token=…            ← طلبات المستخدم نفسه وحالاتها
 *   POST requests.php action=list    token=<مدير>       ← كل الطلبات
 *   POST requests.php action=update  token=<مدير> id=… status=new|working|closed [reply=…]
 * البيانات في private/requests-data.php (ممنوع من الويب).
 */
require __DIR__ . '/amu-guard.php';
header('Content-Type: application/json; charset=utf-8');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail(405, 'POST فقط');

const REQ_FILE = __DIR__ . '/private/requests-data.php';
const REQ_GUARD = "<?php exit; ?>\n";
const SUPPORT_TO = ['it.basra@gmail.com', 'drdsh.sw2022@gmail.com'];

function req_load() {
  $raw = @file_get_contents(REQ_FILE);
  if ($raw === false || strpos($raw, REQ_GUARD) !== 0) return ['seq' => 0, 'items' => [], 'rate' => []];
  $d = json_decode(substr($raw, strlen(REQ_GUARD)), true);
  return is_array($d) ? $d + ['seq' => 0, 'items' => [], 'rate' => []] : ['seq' => 0, 'items' => [], 'rate' => []];
}
function req_save($d) {
  if (!is_dir(dirname(REQ_FILE))) @mkdir(dirname(REQ_FILE), 0755);
  if (@file_put_contents(REQ_FILE, REQ_GUARD . json_encode($d, JSON_UNESCAPED_UNICODE), LOCK_EX) === false) fail(500, 'تعذّر حفظ الطلب.');
}
function clean($s, $max) { $s = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', (string)$s)); return mb_substr($s, 0, $max); }
function opt_user() {
  $t = $_POST['token'] ?? '';
  if (!$t || strlen($t) > 4096) return null;
  $p = verify_token($t);
  return ($p && allowed($p)) ? $p : null;
}
function who($p) {
  if (!$p) return '';
  $e = strtolower($p['email'] ?? '');
  return substr($e, -strlen('@' . STAFF_DOMAIN)) === '@' . STAFF_DOMAIN ? explode('@', $e)[0] : $e;
}

$action = $_POST['action'] ?? '';

// ---- إنشاء طلب ----
if ($action === 'create') {
  $type = ($_POST['type'] ?? '') === 'download' ? 'download' : 'support';
  $msg = clean($_POST['msg'] ?? '', 2000);
  $p = opt_user();
  $name = clean($_POST['name'] ?? '', 80);
  $contact = clean($_POST['contact'] ?? '', 120);
  if ($type === 'download' && !$p) fail(401, 'سجّل الدخول لطلب التنزيل.');
  if (!$p && ($name === '' || $contact === '')) fail(400, 'اكتب اسمك ورقم هاتفك أو بريدك حتى نتواصل معك.');
  if ($type === 'support' && mb_strlen($msg) < 5) fail(400, 'اكتب وصفاً للمشكلة.');
  if (!empty($_POST['website'])) fail(400, 'طلب غير صالح.'); // فخ للبرامج الآلية

  $d = req_load();
  $ip = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|amu');
  $now = time();
  $d['rate'] = array_filter($d['rate'] ?? [], fn($t) => $now - $t < 3600);
  $mine = array_filter($d['rate'], fn($t, $k) => strpos($k, $ip) === 0, ARRAY_FILTER_USE_BOTH);
  if (count($mine) >= 5) fail(429, 'أرسلت طلبات كثيرة. حاول بعد ساعة، أو اتصل بالدعم الفني مباشرة.');
  $d['rate'][$ip . '_' . $now . '_' . mt_rand()] = $now;

  $d['seq'] = ($d['seq'] ?? 0) + 1;
  $id = 'R-' . date('ymd') . '-' . str_pad((string)$d['seq'], 4, '0', STR_PAD_LEFT);
  $item = [
    'id' => $id, 'type' => $type, 'status' => 'new', 'at' => $now,
    'msg' => $msg, 'user' => who($p), 'name' => $p ? clean($p['name'] ?? '', 80) : $name, 'contact' => $contact,
    'page' => clean($_POST['page'] ?? '', 300), 'ua' => clean($_SERVER['HTTP_USER_AGENT'] ?? '', 200), 'log' => [],
  ];
  if ($type === 'download') {
    $bid = clean($_POST['book'] ?? '', 80);
    $b = $bid ? book_by_id(amu_catalog(), $bid) : null;
    if (!$b) fail(404, 'الكتاب غير موجود.');
    $item['book'] = ['id' => $b['id'], 't' => $b['t']];
  }
  array_unshift($d['items'], $item);
  $d['items'] = array_slice($d['items'], 0, 3000);
  req_save($d);

  // تنبيه بالبريد للمدراء (إن كان البريد مفعّلاً على الاستضافة)
  $subj = ($type === 'download' ? 'طلب تنزيل كتاب ' : 'طلب دعم فني ') . $id;
  $body = "طلب جديد في بوابة جامعة المعقل\n\nالرقم: $id\nالنوع: " . ($type === 'download' ? 'تنزيل كتاب: ' . $item['book']['t'] : 'دعم فني')
    . "\nمن: " . ($item['user'] ?: $item['name']) . ($contact ? " — $contact" : '') . "\n\n$msg\n\nللمتابعة: https://it-basra.com/amu/admin/";
  @mail(implode(',', SUPPORT_TO), '=?UTF-8?B?' . base64_encode($subj) . '?=', $body,
    "From: AMU Portal <no-reply@it-basra.com>\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit");

  echo json_encode(['ok' => 1, 'id' => $id]);
  exit;
}

// ---- طلبات المستخدم نفسه ----
if ($action === 'mine') {
  $p = require_user();
  $u = who($p);
  $d = req_load();
  $out = array_values(array_map(fn($r) => array_intersect_key($r, array_flip(['id', 'type', 'status', 'at', 'msg', 'book', 'reply', 'updated'])),
    array_filter($d['items'], fn($r) => ($r['user'] ?? '') === $u)));
  echo json_encode(['items' => array_slice($out, 0, 50)], JSON_UNESCAPED_UNICODE);
  exit;
}

// ---- للمدير ----
$p = require_user();
if (!is_admin_pay($p)) fail(403, 'للمدير فقط.');
$d = req_load();

if ($action === 'list') {
  echo json_encode(['items' => $d['items']], JSON_UNESCAPED_UNICODE);
  exit;
}
if ($action === 'update') {
  $id = clean($_POST['id'] ?? '', 30);
  $st = $_POST['status'] ?? '';
  if (!in_array($st, ['new', 'working', 'closed'], true)) fail(400, 'حالة غير صالحة.');
  foreach ($d['items'] as &$r) {
    if ($r['id'] !== $id) continue;
    $reply = clean($_POST['reply'] ?? '', 2000);
    $r['log'][] = ['at' => time(), 'by' => who($p), 'from' => $r['status'], 'to' => $st, 'reply' => $reply];
    $r['status'] = $st; $r['updated'] = time();
    if ($reply !== '') $r['reply'] = $reply;
    unset($r);
    req_save($d);
    echo json_encode(['ok' => 1]);
    exit;
  }
  fail(404, 'الطلب غير موجود.');
}
fail(400, 'إجراء غير معروف.');
