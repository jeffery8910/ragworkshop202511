import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
    if (req.nextUrl.pathname.startsWith('/admin')) {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return new NextResponse('Auth Required', {
                status: 401,
                headers: {
                    'WWW-Authenticate': 'Basic realm="Secure Area"',
                },
            });
        }

        const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
        const user = auth[0];
        const pass = auth[1];

        if (user !== 'admin' || pass !== (process.env.ADMIN_PASSWORD || 'admin')) {
            return new NextResponse('Auth Required', {
                status: 401,
                headers: {
                    'WWW-Authenticate': 'Basic realm="Secure Area"',
                },
            });
        }
    }
    return NextResponse.next();
}

export const config = {
    matcher: '/admin/:path*',
};
