import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Runs on every matched request to protect admin routes.
export function proxy(req: NextRequest) {
    const path = req.nextUrl.pathname;
    const isAdminPage = path.startsWith('/admin');
    const isAdminApi = path.startsWith('/api/admin');

    if (isAdminPage || isAdminApi) {
        if (isAdminPage && path === '/admin/login') {
            return NextResponse.next();
        }

        const adminSession = req.cookies.get('admin_session');

        if (!adminSession) {
            if (isAdminApi) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            return NextResponse.redirect(new URL('/admin/login', req.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*', '/api/admin/:path*'],
};

