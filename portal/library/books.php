<?php
/* فهرس الكتب الإلكترونية — لا يُعطى إلا لمن سجّل الدخول وكان مخوَّلاً.
 * POST books.php   token=<Firebase ID token>
 *   ← {"cats":[…], "books":[…]}   أو 401/403 مع رسالة
 * كل كتاب منقول إلى السيرفر يحمل "h":1 (يُقرأ من book.php)، و"cv":1 إن كان غلافه محفوظاً في covers/.
 * التحقق من الدخول وقراءة الفهرس في ../amu-guard.php.
 */
require __DIR__ . '/../amu-guard.php';
header('Content-Type: application/json; charset=utf-8');
require_user();
$cat = amu_catalog();
foreach ($cat['books'] as &$b) {
  if (is_file(book_file($b))) $b['h'] = 1;
  if (is_file(book_cover($b['id']))) $b['cv'] = 1;
}
unset($b);
echo json_encode($cat, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
