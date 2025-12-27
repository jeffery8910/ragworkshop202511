import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const isPrivateIpv4 = (ip: string) => {
    const parts = ip.split('.').map(n => Number(n));
    if (parts.length !== 4) return false;
    if (parts.some(n => !Number.isFinite(n) || n < 0 || n > 255)) return false;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
};

const isBlockedHostname = (host: string) => {
    const h = (host || '').trim().toLowerCase();
    if (!h) return true;
    if (h === 'localhost' || h === '0.0.0.0' || h === '127.0.0.1' || h === '::1') return true;
    if (h.endsWith('.local') || h.endsWith('.internal')) return true;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return isPrivateIpv4(h);
    return false;
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({} as any));
        const url = String(body?.url || '').trim();
        if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 });

        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            return NextResponse.json({ error: 'invalid url' }, { status: 400 });
        }

        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return NextResponse.json({ error: 'only http/https are allowed' }, { status: 400 });
        }

        if (isBlockedHostname(parsed.hostname)) {
            return NextResponse.json({ error: 'blocked hostname' }, { status: 400 });
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12_000);
        const start = Date.now();
        try {
            const res = await fetch(parsed.toString(), {
                method: 'GET',
                redirect: 'follow',
                cache: 'no-store',
                signal: controller.signal,
                headers: {
                    'user-agent': 'ragworkshop-keepalive-check',
                },
            });
            const elapsedMs = Date.now() - start;
            return NextResponse.json({
                ok: res.ok,
                status: res.status,
                statusText: res.statusText,
                elapsedMs,
                finalUrl: res.url,
            });
        } finally {
            clearTimeout(timer);
        }
    } catch (error: any) {
        const message = error?.name === 'AbortError'
            ? 'timeout'
            : error?.message || 'Internal Server Error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

