import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Runs on every matched request to protect admin routes.
export function proxy(req: NextRequest) {
    const path = req.nextUrl.pathname;

    // Protect /admin routes
    if (path.startsWith('/admin')) {
        // Allow access to login page
        if (path === '/admin/login') {
            return NextResponse.next();
        }

        // Check for session cookie
        const adminSession = req.cookies.get('admin_session');

        if (!adminSession) {
            // Redirect to login page if not authenticated
            return NextResponse.redirect(new URL('/admin/login', req.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*'],
};
