import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getConfigValue } from '@/lib/config-store';
import { logConversation } from '@/lib/features/logs';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const body = await req.json().catch(() => ({} as any));
        const event = typeof body?.event === 'string' ? body.event.trim() : '';
        const meta = body?.meta && typeof body.meta === 'object' ? body.meta : undefined;
        const userId =
            body?.userId
            || cookieStore.get('line_user_id')?.value
            || cookieStore.get('rag_user_id')?.value
            || '';

        if (!event) {
            return NextResponse.json({ error: 'event is required' }, { status: 400 });
        }

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const readConfig = (key: string) =>
            cookieStore.get(key)?.value || getConfigValue(key) || process.env[key];
        const mongoUri = readConfig('MONGODB_URI');
        const dbName = readConfig('MONGODB_DB_NAME') || 'rag_db';

        await logConversation({
            type: 'event',
            userId,
            text: `[${event}]`,
            meta: { event, ...(meta || {}) }
        }, { mongoUri, dbName });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Student event error', error);
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
    }
}

