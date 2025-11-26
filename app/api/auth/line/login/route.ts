import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const cookieStore = await cookies();
    const channelId = process.env.LINE_LOGIN_CHANNEL_ID || cookieStore.get('LINE_LOGIN_CHANNEL_ID')?.value;

    if (!channelId) {
        return NextResponse.json({ error: 'LINE Login Channel ID not configured' }, { status: 400 });
    }

    const url = new URL(request.url);
    const callbackUrl = `${url.origin}/api/auth/line/callback`;
    const state = Math.random().toString(36).substring(7);

    // Store state in cookie for verification (optional but recommended)

    const lineAuthUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${channelId}&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${state}&scope=profile%20openid`;

    return NextResponse.redirect(lineAuthUrl);
}
