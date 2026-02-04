import { NextRequest, NextResponse } from 'next/server';
import { validateSignature, Client } from '@line/bot-sdk';
import { findKeywordMatch } from '@/lib/features/keywords';
import { generateRagQuiz } from '@/lib/features/quiz';
import { createQuizFlexMessage } from '@/lib/line/templates/quiz';
import { checkRateLimit } from '@/lib/features/ratelimit';
import { logConversation } from '@/lib/features/logs';
import { getConfigValue } from '@/lib/config-store';

// Force Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let client: Client | null = null;
let clientKey = '';

function getRuntimeConfig() {
    return {
        channelSecret: getConfigValue('LINE_CHANNEL_SECRET') || process.env.LINE_CHANNEL_SECRET || '',
        channelAccessToken: getConfigValue('LINE_CHANNEL_ACCESS_TOKEN') || process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
        n8nWebhookUrl: getConfigValue('N8N_WEBHOOK_URL') || process.env.N8N_WEBHOOK_URL || '',
        mongoUri: getConfigValue('MONGODB_URI') || process.env.MONGODB_URI || '',
        dbName: getConfigValue('MONGODB_DB_NAME') || process.env.MONGODB_DB_NAME || 'rag_db',
    };
}

function getClient(channelAccessToken: string, channelSecret: string) {
    const key = `${channelAccessToken}::${channelSecret}`;
    if (!client || clientKey !== key) {
        client = new Client({
            channelAccessToken,
            channelSecret,
        });
        clientKey = key;
    }
    return client;
}

export async function POST(req: NextRequest) {
    const body = await req.text();
    const signature = req.headers.get('x-line-signature') as string;
    const { channelSecret } = getRuntimeConfig();

    if (!channelSecret) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (!validateSignature(body, channelSecret, signature)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const events = JSON.parse(body).events;

    // Async Handoff: Process events in background
    processEvents(events).catch(err => console.error('Event processing error:', err));

    return NextResponse.json({ status: 'ok' });
}

async function processEvents(events: any[]) {
    for (const event of events) {
        if (event.type !== 'message' || event.message.type !== 'text') continue;

        const { channelSecret, channelAccessToken, n8nWebhookUrl, mongoUri, dbName } = getRuntimeConfig();

        const userId = event.source.userId;
        const text = event.message.text;
        const replyToken = event.replyToken;

        if (!channelAccessToken || !channelSecret) {
            await logConversation({ type: 'error', userId, text: '[Missing LINE access token/secret]', meta: {} }, { mongoUri, dbName });
            continue;
        }

        // 0. Rate Limit Check
        if (!checkRateLimit(userId)) {
            await getClient(channelAccessToken, channelSecret).replyMessage(replyToken, { type: 'text', text: '您的訊息發送太快，請稍後再試。' });
            continue;
        }

        // 0. Log Inbound
        await logConversation({
            type: 'message',
            userId,
            text,
            meta: { eventId: event.webhookEventId }
        }, { mongoUri, dbName });

        // 1. Keyword Matching
        const rule = await findKeywordMatch(text);

        if (rule) {
            if (rule.action === 'reply' && rule.replyText) {
                await getClient(channelAccessToken, channelSecret).replyMessage(replyToken, { type: 'text', text: rule.replyText });
                await logConversation({ type: 'reply', userId, text: rule.replyText, meta: { rule: rule.keyword } }, { mongoUri, dbName });
                continue;
            }
            // Handle other actions (n8n, rag) if needed here or fall through
        }

        // 2. Quiz Feature
        if (text.startsWith('測驗') || text.startsWith('quiz')) {
            const topic = text.replace(/測驗|quiz/i, '').trim() || '隨機主題';
            const quiz = await generateRagQuiz(topic);
            const flex = createQuizFlexMessage(quiz, topic);
            await getClient(channelAccessToken, channelSecret).replyMessage(replyToken, flex);
            await logConversation({ type: 'reply', userId, text: `[Quiz] ${topic}`, meta: { quiz } }, { mongoUri, dbName });
            continue;
        }

        // 3. Async Handoff to n8n (Default RAG)

        if (n8nWebhookUrl) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1200);

            try {
                const res = await fetch(n8nWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ events: [event] }), // Forward single event
                    signal: controller.signal,
                });

                if (!res.ok) {
                    const errText = await res.text().catch(() => '');
                    throw new Error(`n8n webhook HTTP ${res.status}: ${errText.slice(0, 200)}`);
                }

                await logConversation(
                    { type: 'event', userId, text: '[Forwarded to n8n]', meta: { url: n8nWebhookUrl } },
                    { mongoUri, dbName }
                );
            } catch (err) {
                // Fallback: n8n not ready / workflow not active. Reply a short hint so user doesn't feel "no response".
                const hint =
                    '⚠️ 已收到訊息，但 n8n 工作流程尚未啟用或暫時不可用。\n\n請先打開 n8n，import `n8n/workflow.json` 並將 workflow 切到 Active，確認 Production URL 可用。';

                try {
                    await getClient(channelAccessToken, channelSecret).replyMessage(replyToken, { type: 'text', text: hint });
                } catch (e) {
                    console.error('LINE fallback reply failed:', e);
                }

                await logConversation(
                    { type: 'error', userId, text: '[n8n handoff failed]', meta: { url: n8nWebhookUrl, err: String(err) } },
                    { mongoUri, dbName }
                );
            } finally {
                clearTimeout(timeout);
            }
        } else {
            // Fallback: If n8n is not configured, reply with a friendly message
            await getClient(channelAccessToken, channelSecret).replyMessage(replyToken, {
                type: 'text',
                text: '⚠️ 系統提示：尚未設定 n8n Webhook URL，無法進行 AI 回覆。\n\n請檢查 .env.local 設定或部署狀態，確認 N8N_WEBHOOK_URL 已正確填寫。'
            });
            await logConversation({ type: 'error', userId, text: '[Missing N8N_WEBHOOK_URL]', meta: {} }, { mongoUri, dbName });
        }
    }
}
