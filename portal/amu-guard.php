<?php
/* التحقق المشترك من تسجيل الدخول لملفات PHP في البوابة (الكتب الإلكترونية، تنزيل التطبيق…).
 * يتحقق من رمز Firebase ID token بمفاتيح Google العامة (RS256)، ومن المشروع والصلاحية،
 * ثم يطابق البريد مع قائمة المخوَّلين. **قوائم المدراء والنطاقات هنا يجب أن تطابق access.js.**
 * لا يعمل وحده: يُستدعى بـ require من الملفات الأخرى.
 */
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(404); exit; }

header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');

$ALLOWED_ORIGINS = ['https://it-basra.com', 'https://www.it-basra.com', 'https://drdshsw2022-byte.github.io'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $ALLOWED_ORIGINS, true)) {
  header('Access-Control-Allow-Origin: ' . $origin);
  header('Vary: Origin');
  header('Access-Control-Allow-Methods: POST, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

const PROJECT_ID = 'almaqal-uni';
const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
// يجب أن تطابق access.js
// المدراء (السلطة المطلقة). لإضافة مدير احتياطي أضف بريده هنا وفي access.js
const ADMINS = ['drdsh.sw2022@gmail.com'];
const DOMAINS = ['almaaqal.edu.iq'];
const STAFF_DOMAIN = 'pw.almaaqal.app';
const BLOCKED = [];

function fail($code, $msg) { header('Content-Type: application/json; charset=utf-8'); http_response_code($code); echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE); exit; }
function b64url($s) { return base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4)); }

function http_get($url) {
  if (function_exists('curl_init')) {
    $c = curl_init($url);
    curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_FOLLOWLOCATION => true]);
    $r = curl_exec($c); $ok = curl_getinfo($c, CURLINFO_HTTP_CODE) === 200; curl_close($c);
    return $ok ? $r : false;
  }
  return @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => 10]]));
}

// مفاتيح Google العامة، محفوظة ساعة واحدة
function google_certs($forceRefresh = false) {
  $cache = __DIR__ . '/library/firebase-certs.json';
  if (!$forceRefresh && is_file($cache)) {
    $d = json_decode(file_get_contents($cache), true);
    if (is_array($d) && isset($d['t'], $d['certs']) && time() - $d['t'] < 3600) return $d['certs'];
  }
  $raw = http_get(CERTS_URL);
  $certs = $raw ? json_decode($raw, true) : null;
  if (!is_array($certs) || !$certs) {
    if (is_file($cache)) { $d = json_decode(file_get_contents($cache), true); if (!empty($d['certs'])) return $d['certs']; }
    fail(503, 'تعذّر التحقق من تسجيل الدخول الآن. أعد المحاولة بعد قليل.');
  }
  @file_put_contents($cache, json_encode(['t' => time(), 'certs' => $certs]), LOCK_EX);
  return $certs;
}

function verify_token($jwt) {
  $parts = explode('.', $jwt);
  if (count($parts) !== 3) return null;
  [$h64, $p64, $s64] = $parts;
  $head = json_decode(b64url($h64), true); $pay = json_decode(b64url($p64), true); $sig = b64url($s64);
  if (!$head || !$pay || ($head['alg'] ?? '') !== 'RS256' || empty($head['kid'])) return null;
  $certs = google_certs();
  if (!isset($certs[$head['kid']])) $certs = google_certs(true);
  if (!isset($certs[$head['kid']])) return null;
  $key = openssl_pkey_get_public($certs[$head['kid']]);
  if (!$key || openssl_verify("$h64.$p64", $sig, $key, OPENSSL_ALGO_SHA256) !== 1) return null;
  $now = time();
  if (($pay['aud'] ?? '') !== PROJECT_ID) return null;
  if (($pay['iss'] ?? '') !== 'https://securetoken.google.com/' . PROJECT_ID) return null;
  if (($pay['exp'] ?? 0) < $now - 30 || ($pay['iat'] ?? PHP_INT_MAX) > $now + 300) return null;
  if (empty($pay['sub'])) return null;
  return $pay;
}

function allowed($pay) {
  $e = strtolower(trim($pay['email'] ?? ''));
  if ($e === '' || in_array($e, BLOCKED, true)) return false;
  if (substr($e, -strlen('@' . STAFF_DOMAIN)) === '@' . STAFF_DOMAIN) return true;  // حسابات الأساتذة (اسم المستخدم)
  if (empty($pay['email_verified'])) return false;                                    // Google: بريد موثّق فقط
  if (in_array($e, ADMINS, true)) return true;
  $d = substr(strrchr($e, '@'), 1);
  return in_array($d, DOMAINS, true);
}

// يعيد بيانات المستخدم من الرمز المرسل (token في POST أو JSON) أو ينهي الطلب بـ 401/403
function require_user() {
  if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail(405, 'POST فقط');
  $token = $_POST['token'] ?? '';
  if (!$token) { $j = json_decode(file_get_contents('php://input'), true); $token = $j['token'] ?? ''; }
  if (!$token || strlen($token) > 4096) fail(401, 'سجّل الدخول أولاً.');
  $pay = verify_token($token);
  if (!$pay) fail(401, 'انتهت جلسة الدخول. سجّل الدخول من جديد.');
  if (!allowed($pay)) fail(403, 'هذا الحساب غير مخوَّل.');
  return $pay;
}

function is_admin_pay($pay) {
  return !empty($pay['email_verified']) && in_array(strtolower(trim($pay['email'] ?? '')), ADMINS, true);
}
