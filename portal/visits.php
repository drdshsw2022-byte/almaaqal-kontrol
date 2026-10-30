<?php
/* عداد زوار بوابة جامعة المعقل الدولية
 * GET  visits.php        → {"total":…, "today":…, "date":"YYYY-MM-DD"}
 * POST visits.php (hit)  → يسجل زيارة واحدة لكل زائر في اليوم ثم يعيد الأرقام
 * الزائر يُعرَّف ببصمة مجهولة (تجزئة IP + المتصفح + التاريخ) تُمسح كل يوم، فلا يُحفظ عنوان IP نفسه.
 * البيانات في visits-data.php (ملف PHP لا يُقرأ من المتصفح).
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$allowed = ['https://it-basra.com', 'https://www.it-basra.com', 'https://drdshsw2022-byte.github.io'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed, true)) {
  header('Access-Control-Allow-Origin: ' . $origin);
  header('Vary: Origin');
  header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

date_default_timezone_set('Asia/Baghdad');
$today = date('Y-m-d');
$file = __DIR__ . '/visits-data.php';
$guard = "<?php exit; ?>\n";

$fp = fopen($file, 'c+');
if (!$fp) { http_response_code(500); echo json_encode(['error' => 'storage']); exit; }
flock($fp, LOCK_EX);
$raw = stream_get_contents($fp);
$data = json_decode(substr($raw, strlen($guard)) ?: '{}', true);
if (!is_array($data)) $data = [];
$data += ['total' => 0, 'date' => $today, 'today' => 0, 'seen' => [], 'days' => []];

// يوم جديد: احفظ عدد أمس في السجل وابدأ من الصفر
if ($data['date'] !== $today) {
  $data['days'][$data['date']] = $data['today'];
  $data['days'] = array_slice($data['days'], -60, null, true);
  $data['date'] = $today; $data['today'] = 0; $data['seen'] = [];
}

$isHit = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST';
if ($isHit) {
  $ip = $_SERVER['REMOTE_ADDR'] ?? '';
  $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 200);
  if (!preg_match('/bot|crawl|spider|slurp|preview|monitor|curl|wget|python|headless/i', $ua)) {
    $key = substr(hash('sha256', $ip . '|' . $ua . '|' . $today . '|amu'), 0, 16);
    if (!isset($data['seen'][$key]) && count($data['seen']) < 50000) {
      $data['seen'][$key] = 1;
      $data['today']++;
      $data['total']++;
    }
  }
  ftruncate($fp, 0); rewind($fp);
  fwrite($fp, $guard . json_encode($data));
  fflush($fp);
}
flock($fp, LOCK_UN);
fclose($fp);

echo json_encode(['total' => $data['total'], 'today' => $data['today'], 'date' => $today]);
