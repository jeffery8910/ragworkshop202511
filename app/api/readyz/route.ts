import { NextRequest, NextResponse } from 'next/server';
import { getConfigValue } from '@/lib/config-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getConfig(key: string) {
    return getConfigValue(key) || process.env[key] || '';
}

async function fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number
) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, cache: 'no-store', signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

export async function GET(req: NextRequest) {
    const lineSecret = getConfig('LINE_CHANNEL_SECRET');
    const lineToken = getConfig('LINE_CHANNEL_ACCESS_TOKEN');
    const n8nWebhookUrl = getConfig('N8N_WEBHOOK_URL');

    const problems: string[] = [];
    if (!lineSecret) problems.push('Missing LINE_CHANNEL_SECRET');
    if (!lineToken) problems.push('Missing LINE_CHANNEL_ACCESS_TOKEN');
    if (!n8nWebhookUrl) problems.push('Missing N8N_WEBHOOK_URL');

    const { searchParams } = new URL(req.url);
    const deep = searchParams.get('deep') === '1';

    let n8nHealth: { ok: boolean; status?: number; error?: string } | undefined;
    let n8nWebhook: { ok: boolean; status?: number; error?: string } | undefined;

    if (deep && n8nWebhookUrl) {
        try {
            const u = new URL(n8nWebhookUrl);
            const healthUrl = `${u.protocol}//${u.host}/healthz`;
            const res = await fetchWithTimeout(healthUrl, { method: 'GET' }, 1200);
            n8nHealth = { ok: res.ok, status: res.status };
            if (!res.ok) problems.push(`n8n health: HTTP ${res.status}`);
        } catch (e: any) {
            n8nHealth = { ok: false, error: e?.message || String(e) };
            problems.push(`n8n health: ${n8nHealth.error}`);
        }

        try {
            const res = await fetchWithTimeout(
                n8nWebhookUrl,
                {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ events: [] }),
                },
                1200
            );
            n8nWebhook = { ok: res.ok, status: res.status };
            if (!res.ok) problems.push(`n8n webhook: HTTP ${res.status}`);
        } catch (e: any) {
            n8nWebhook = { ok: false, error: e?.message || String(e) };
            problems.push(`n8n webhook: ${n8nWebhook.error}`);
        }
    }

    const ok = problems.length === 0;
    return NextResponse.json({
        status: ok ? 'ok' : 'degraded',
        ts: Date.now(),
        config: {
            lineSecret: !!lineSecret,
            lineToken: !!lineToken,
            n8nWebhookUrl: !!n8nWebhookUrl,
        },
        deep: deep ? { n8nHealth, n8nWebhook } : undefined,
        problems,
    });
}
