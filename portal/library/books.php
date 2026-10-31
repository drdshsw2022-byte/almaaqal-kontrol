<?php
/* فهرس الكتب الإلكترونية — لا يُعطى إلا لمن سجّل الدخول وكان مخوَّلاً.
 * POST books.php   token=<Firebase ID token>
 *   ← {"cats":[…], "books":[…]}   أو 401/403 مع رسالة
 * التحقق من الدخول في ../amu-guard.php.
 * البيانات في books-data.php بجانبه (يبدأ بـ <?php exit; ?> فلا يُقرأ من المتصفح).
 */
require __DIR__ . '/../amu-guard.php';
header('Content-Type: application/json; charset=utf-8');
require_user();

$raw = @file_get_contents(__DIR__ . '/books-data.php');
$guard = "<?php exit; ?>\n";
if ($raw === false || strpos($raw, $guard) !== 0) fail(500, 'فهرس الكتب غير متاح.');
echo substr($raw, strlen($guard));
