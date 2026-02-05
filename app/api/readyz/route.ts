import { NextRequest, NextResponse } from 'next/server';
import { getConfigValue } from '@/lib/config-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getConfig(key: string) {
    return getConfigValue(key) || process.env[key] || '';
}

type ProbeResult = {
    ok: boolean;
    status?: number;
    error?: string;
    contentType?: string;
    bodySnippet?: string;
};

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

async function probe(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    bodyLimit = 600
): Promise<ProbeResult> {
    try {
        const res = await fetchWithTimeout(url, init, timeoutMs);
        const contentType = res.headers.get('content-type') || undefined;
        let bodySnippet: string | undefined;
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            bodySnippet = text ? text.slice(0, bodyLimit) : undefined;
        }
        return { ok: res.ok, status: res.status, contentType, bodySnippet };
    } catch (e: any) {
        return { ok: false, error: e?.message || String(e) };
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

    let n8nBaseUrl: string | undefined;
    let n8nHealth: ProbeResult | undefined;
    let n8nWebhook: ProbeResult | undefined;
    let n8nUi: ProbeResult | undefined;
    let n8nPing: ProbeResult | undefined;

    if (deep && n8nWebhookUrl) {
        try {
            const u = new URL(n8nWebhookUrl);
            n8nBaseUrl = `${u.protocol}//${u.host}`;
        } catch {
            // ignore
        }

        try {
            const healthUrl = n8nBaseUrl ? `${n8nBaseUrl}/healthz` : '';
            if (healthUrl) {
                n8nHealth = await probe(healthUrl, { method: 'GET' }, 1200);
                if (!n8nHealth.ok) problems.push(`n8n health: HTTP ${n8nHealth.status ?? 'ERR'}`);
            }
        } catch {
            // ignore (probe already captures errors)
        }

        if (n8nBaseUrl) {
            n8nUi = await probe(`${n8nBaseUrl}/`, { method: 'GET' }, 1200);
            n8nPing = await probe(`${n8nBaseUrl}/rest/ping`, { method: 'GET' }, 1200);
        }

        try {
            n8nWebhook = await probe(
                n8nWebhookUrl,
                {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ events: [] }),
                },
                1200
            );
            if (!n8nWebhook.ok) problems.push(`n8n webhook: HTTP ${n8nWebhook.status ?? 'ERR'}`);
        } catch {
            // ignore (probe already captures errors)
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
        deep: deep ? { n8nBaseUrl, n8nHealth, n8nUi, n8nPing, n8nWebhook } : undefined,
        problems,
    });
}
