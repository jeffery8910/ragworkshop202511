import { NextRequest, NextResponse } from 'next/server';

export function isAuthenticated(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return false;

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    return user === 'admin' && pass === (process.env.ADMIN_PASSWORD || 'admin');
}

export function unauthorized() {
    return new NextResponse('Auth Required', {
        status: 401,
        headers: {
            'WWW-Authenticate': 'Basic realm="Secure Area"',
        },
    });
}
