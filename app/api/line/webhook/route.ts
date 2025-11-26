import { NextRequest, NextResponse } from 'next/server';
import { validateSignature, Client } from '@line/bot-sdk';
import { findKeywordMatch } from '@/lib/features/keywords';
import { generateRagQuiz } from '@/lib/features/quiz';
import { createQuizFlexMessage } from '@/lib/line/templates/quiz';
import { checkRateLimit } from '@/lib/features/ratelimit';
import { logConversation } from '@/lib/features/logs';

// Force Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const channelSecret = process.env.LINE_CHANNEL_SECRET || '';
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

let client: Client | null = null;

function getClient() {
    if (!client) {
        client = new Client({
            channelAccessToken: channelAccessToken,
            channelSecret: channelSecret,
        });
    }
    return client;
}

export async function POST(req: NextRequest) {
    const body = await req.text();
    const signature = req.headers.get('x-line-signature') as string;

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

        const userId = event.source.userId;
        const text = event.message.text;
        const replyToken = event.replyToken;

        // 0. Rate Limit Check
        if (!checkRateLimit(userId)) {
            await getClient().replyMessage(replyToken, { type: 'text', text: '您的訊息發送太快，請稍後再試。' });
            continue;
        }

        // 0. Log Inbound
        await logConversation({
            type: 'message',
            userId,
            text,
            meta: { eventId: event.webhookEventId }
        });

        // 1. Keyword Matching
        const rule = await findKeywordMatch(text);

        if (rule) {
            if (rule.action === 'reply' && rule.replyText) {
                await getClient().replyMessage(replyToken, { type: 'text', text: rule.replyText });
                await logConversation({ type: 'reply', userId, text: rule.replyText, meta: { rule: rule.keyword } });
                continue;
            }
            // Handle other actions (n8n, rag) if needed here or fall through
        }

        // 2. Quiz Feature
        if (text.startsWith('測驗') || text.startsWith('quiz')) {
            const topic = text.replace(/測驗|quiz/i, '').trim() || '隨機主題';
            const quiz = await generateRagQuiz(topic);
            const flex = createQuizFlexMessage(quiz, topic);
            await getClient().replyMessage(replyToken, flex);
            await logConversation({ type: 'reply', userId, text: `[Quiz] ${topic}`, meta: { quiz } });
            continue;
        }

        // 3. Async Handoff to n8n (Default RAG)
        if (process.env.N8N_WEBHOOK_URL) {
            await fetch(process.env.N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ events: [event] }) // Forward single event
            });
            await logConversation({ type: 'event', userId, text: '[Forwarded to n8n]', meta: { url: process.env.N8N_WEBHOOK_URL } });
        }
    }
}
