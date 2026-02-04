const crypto = require('crypto');
const { loadEnv } = require('../_load_env');

loadEnv();

function readEnv(key, fallback = '') {
  return (process.env[key] || fallback).toString().trim();
}

function hmacBase64(secret, body) {
  return crypto.createHmac('sha256', secret).update(body).digest('base64');
}

async function main() {
  const url = readEnv('LINE_WEBHOOK_URL', '');
  const secret = readEnv('LINE_CHANNEL_SECRET', '');
  if (!url) throw new Error('LINE_WEBHOOK_URL is not set (e.g. https://<vercel>/api/line/webhook)');
  if (!secret) throw new Error('LINE_CHANNEL_SECRET is not set');

  const now = Date.now();
  const event = {
    type: 'message',
    webhookEventId: `test-${now}`,
    deliveryContext: { isRedelivery: false },
    timestamp: now,
    source: { type: 'user', userId: `U${crypto.randomBytes(12).toString('hex')}` },
    replyToken: crypto.randomBytes(16).toString('hex'),
    message: { id: String(now), type: 'text', text: 'ping (smoke)' },
  };
  const payload = JSON.stringify({ destination: 'U00000000000000000000000000000000', events: [event] });
  const signature = hmacBase64(secret, payload);

  const t0 = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-line-signature': signature,
    },
    body: payload,
  });
  const elapsed = Date.now() - t0;
  const text = await res.text().catch(() => '');
  console.log(`[RESULT] ${res.status} ${res.statusText} in ${elapsed}ms`);
  if (text) console.log(text);

  if (res.status >= 500) {
    console.log('[HINT] 500 通常代表 Vercel 沒設 LINE_CHANNEL_SECRET / 其他必要 env。');
  } else if (res.status === 401) {
    console.log('[HINT] 401 通常代表簽章不對（secret 錯）或你打到錯的 webhook URL。');
  } else if (res.status === 403) {
    console.log('[HINT] 403 可能是被 Vercel Protection 擋住（LINE webhook 必須可公開打到）。');
  }
}

main().catch((err) => {
  console.error('[ERROR]', err?.message || err);
  process.exit(1);
});
