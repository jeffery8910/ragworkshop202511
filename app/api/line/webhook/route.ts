import { NextRequest, NextResponse } from 'next/server';
import { validateSignature } from '@line/bot-sdk';
import { findKeywordMatch } from '@/lib/features/keywords';
import { getConfigValue } from '@/lib/config-store';

// Force Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const N8N_TIMEOUT_MS = 900;
const LINE_REPLY_TIMEOUT_MS = 900;

function getRuntimeConfig() {
    return {
        channelSecret: getConfigValue('LINE_CHANNEL_SECRET') || process.env.LINE_CHANNEL_SECRET || '',
        channelAccessToken: getConfigValue('LINE_CHANNEL_ACCESS_TOKEN') || process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
        n8nWebhookUrl: getConfigValue('N8N_WEBHOOK_URL') || process.env.N8N_WEBHOOK_URL || '',
    };
}

async function replyText(replyToken: string, text: string, channelAccessToken: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LINE_REPLY_TIMEOUT_MS);

    try {
        const res = await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                Authorization: `Bearer ${channelAccessToken}`,
            },
            body: JSON.stringify({
                replyToken,
                messages: [{ type: 'text', text }],
            }),
            signal: controller.signal,
            cache: 'no-store',
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`LINE reply HTTP ${res.status}: ${errText.slice(0, 200)}`);
        }
    } finally {
        clearTimeout(timeout);
    }
}

async function handoffToN8n(n8nWebhookUrl: string, event: any) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

    try {
        const res = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events: [event] }),
            signal: controller.signal,
            cache: 'no-store',
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`n8n webhook HTTP ${res.status}: ${errText.slice(0, 200)}`);
        }
    } finally {
        clearTimeout(timeout);
    }
}

export async function POST(req: NextRequest) {
    const body = await req.text();
    const signature = req.headers.get('x-line-signature');
    const { channelSecret, channelAccessToken, n8nWebhookUrl } = getRuntimeConfig();

    if (!channelSecret) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (!signature) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    if (!validateSignature(body, channelSecret, signature)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let parsed: any = null;
    try {
        parsed = JSON.parse(body);
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const events: any[] = Array.isArray(parsed?.events) ? parsed.events : [];
    if (events.length === 0) {
        return NextResponse.json({ status: 'ok' });
    }

    // Prefer the first text message event (most common webhook shape)
    const firstTextEvent =
        events.find((e) => e?.type === 'message' && e?.message?.type === 'text' && typeof e?.replyToken === 'string') || events[0];

    const replyToken = firstTextEvent?.replyToken || '';
    const text = firstTextEvent?.message?.type === 'text' ? String(firstTextEvent?.message?.text || '') : '';

    // 1) Keyword shortcuts (fast local reply)
    if (text && replyToken && channelAccessToken) {
        const rule = await findKeywordMatch(text);
        if (rule?.action === 'reply' && rule.replyText) {
            try {
                await replyText(replyToken, rule.replyText, channelAccessToken);
            } catch (err) {
                console.error('LINE keyword reply failed:', err);
            }
            return NextResponse.json({ status: 'ok' });
        }
    }

    // 2) Handoff to n8n (fast, bounded). This is the primary path for RAG/LLM.
    if (n8nWebhookUrl) {
        try {
            await handoffToN8n(n8nWebhookUrl, firstTextEvent);
        } catch (err) {
            console.error('n8n handoff failed:', err);

            // Fallback: send a short hint so user doesn't feel "no response"
            if (replyToken && channelAccessToken) {
                const hint =
                    '⚠️ 已收到訊息，但 n8n 工作流程尚未啟用或暫時不可用。\n\n請先打開 n8n，import `n8n/workflow.json` 並將 workflow 切到 Active，確認 Production URL 可用。';
                try {
                    await replyText(replyToken, hint, channelAccessToken);
                } catch (e) {
                    console.error('LINE fallback reply failed:', e);
                }
            }
        }

        return NextResponse.json({ status: 'ok' });
    }

    // 3) Missing n8n config fallback
    if (replyToken && channelAccessToken) {
        const hint =
            '⚠️ 系統提示：尚未設定 n8n Webhook URL，無法進行 AI 回覆。\n\n請檢查部署狀態或環境變數，確認 N8N_WEBHOOK_URL 已正確填寫。';
        try {
            await replyText(replyToken, hint, channelAccessToken);
        } catch (err) {
            console.error('LINE missing n8n reply failed:', err);
        }
    }

    return NextResponse.json({ status: 'ok' });
}
