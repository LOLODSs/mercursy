<?php
/**
 * Mercury Lead Handler for PHP Web Hostings (Onreza, Beget, Timeweb, Reg.ru, cPanel, etc.)
 * Receives JSON from Mascot chat and sends formatted lead directly to Telegram bot.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method Not Allowed']);
    exit;
}

// 1. Поиск токена и Chat ID в переменных окружения или файле .env
$botToken = getenv('TELEGRAM_BOT_TOKEN');
$chatId = getenv('TELEGRAM_CHAT_ID');

$envCandidates = [
    __DIR__ . '/.env',
    __DIR__ . '/../.env',
    __DIR__ . '/../../.env',
    $_SERVER['DOCUMENT_ROOT'] . '/.env',
    dirname($_SERVER['DOCUMENT_ROOT']) . '/.env'
];

foreach ($envCandidates as $envFile) {
    if (file_exists($envFile) && is_readable($envFile)) {
        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || strpos($line, '#') === 0) continue;
            if (strpos($line, '=') !== false) {
                list($k, $v) = explode('=', $line, 2);
                $k = trim($k);
                $v = trim($v, " \t\n\r\0\x0B\"'");
                if ($k === 'TELEGRAM_BOT_TOKEN' && !$botToken) $botToken = $v;
                if ($k === 'TELEGRAM_CHAT_ID' && !$chatId) $chatId = $v;
            }
        }
    }
}

// Дефолтные значения проекта (на случай, если .env не загружен на хостинг)
if (!$botToken) $botToken = '8943025919:AAEgsA7CYUrursO7ihR2sMVd4BoPDG1Gas4';
if (!$chatId) $chatId = '1031568361';

if (!$botToken || !$chatId) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'Telegram credentials not configured']);
    exit;
}

// 2. Чтение тела запроса
$rawBody = file_get_contents('php://input');
$data = json_decode($rawBody, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid JSON']);
    exit;
}

// Honeypot защита от спам-ботов
if (!empty($data['website'])) {
    echo json_encode(['ok' => true]);
    exit;
}

// 3. Санитизация полей
$esc = function($val) {
    return htmlspecialchars(trim((string)($val ?? '')), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
};

$name = $esc($data['name'] ?? 'Аноним');
$contact = $esc($data['contact'] ?? '');
$type = $esc($data['type'] ?? 'Не указан');
$ref = !empty($data['ref']) ? $esc($data['ref']) : null;
$task = $esc($data['task'] ?? '');
$budget = $esc($data['budget'] ?? 'Не указан');
$deadline = $esc($data['deadline'] ?? 'Не указан');
$page = $esc($data['page'] ?? '');

if (empty($contact) || empty($task)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing contact or task']);
    exit;
}

// Распознаём Telegram никнейм для быстрой ссылки в ответе
$tgUser = null;
if (preg_match('/^@?([a-zA-Z0-9_]{4,})$/', $contact, $m) && !is_numeric($contact)) {
    $tgUser = $m[1];
} elseif (preg_match('/(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]{4,})/i', $contact, $m)) {
    $tgUser = $m[1];
}

$refStr = $ref ? " (как «{$ref}»)" : '';

$text = "🔥 <b>Новая заявка с сайта</b>\n\n"
      . "👤 <b>{$name}</b>\n"
      . "📬 {$contact}\n"
      . "🧩 {$type}{$refStr}\n"
      . "📝 {$task}\n"
      . "💰 {$budget}\n"
      . "⏰ {$deadline}\n\n"
      . "<i>{$page}</i>";

$buttons = [];
if ($tgUser) {
    $buttons[] = [['text' => '✍️ Ответить клиенту', 'url' => "https://t.me/{$tgUser}"]];
}
$buttons[] = [
    ['text' => '🟡 В работу', 'callback_data' => 'crm:work:lead'],
    ['text' => '🟢 Сдан', 'callback_data' => 'crm:done:lead'],
    ['text' => '⚪ В архив', 'callback_data' => 'crm:archive:lead']
];
$buttons[] = [
    ['text' => '📋 Копировать бриф', 'callback_data' => 'crm:copy:lead']
];

$tgPayload = [
    'chat_id' => $chatId,
    'text' => $text,
    'parse_mode' => 'HTML',
    'disable_web_page_preview' => true,
    'reply_markup' => ['inline_keyboard' => $buttons]
];

// 4. Отправка в Telegram API
$ch = curl_init("https://api.telegram.org/bot{$botToken}/sendMessage");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($tgPayload),
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 12,
    CURLOPT_SSL_VERIFYPEER => true
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($httpCode >= 200 && $httpCode < 300) {
    echo json_encode(['ok' => true]);
} else {
    http_response_code(502);
    echo json_encode([
        'ok' => false,
        'error' => 'Telegram API error',
        'http_code' => $httpCode,
        'curl_error' => $curlError
    ]);
}
