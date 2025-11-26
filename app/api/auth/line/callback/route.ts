import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const cookieStore = await cookies();
    const channelId = process.env.LINE_LOGIN_CHANNEL_ID || cookieStore.get('LINE_LOGIN_CHANNEL_ID')?.value;
    const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET || cookieStore.get('LINE_LOGIN_CHANNEL_SECRET')?.value;

    if (!channelId || !channelSecret) {
        return NextResponse.json({ error: 'LINE Login credentials not configured' }, { status: 400 });
    }

    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const callbackUrl = `${url.origin}/api/auth/line/callback`;

    if (!code) {
        return NextResponse.json({ error: 'Missing code' }, { status: 400 });
    }

    try {
        // 1. Exchange code for token
        const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: callbackUrl,
                client_id: channelId,
                client_secret: channelSecret
            })
        });

        const tokenData = await tokenRes.json();

        if (!tokenRes.ok) {
            console.error('Token Error:', tokenData);
            return NextResponse.json({ error: 'Failed to get token', details: tokenData }, { status: 400 });
        }

        // 2. Get User Profile (using ID Token is easier if scope includes openid, but let's use access token for profile)
        // Actually, we requested 'profile openid', so we can verify id_token OR call /v2/profile
        // Let's call /v2/profile for simplicity
        const profileRes = await fetch('https://api.line.me/v2/profile', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });

        const profileData = await profileRes.json();

        if (!profileRes.ok) {
            console.error('Profile Error:', profileData);
            return NextResponse.json({ error: 'Failed to get profile', details: profileData }, { status: 400 });
        }

        // 3. Set Cookie
        // We store userId and displayName
        cookieStore.set('line_user_id', profileData.userId, { path: '/', httpOnly: true, maxAge: 60 * 60 * 24 * 30 }); // 30 days
        cookieStore.set('line_display_name', profileData.displayName, { path: '/', httpOnly: true, maxAge: 60 * 60 * 24 * 30 });
        if (profileData.pictureUrl) {
            cookieStore.set('line_picture_url', profileData.pictureUrl, { path: '/', httpOnly: true, maxAge: 60 * 60 * 24 * 30 });
        }

        // 4. Redirect to Chat
        return NextResponse.redirect(`${url.origin}/chat`);

    } catch (error: any) {
        console.error('Callback Error:', error);
        return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
    }
}
