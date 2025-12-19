import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMongoClient } from '@/lib/db/mongo';
import { getConfigValue } from '@/lib/config-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const getConfig = async (key: string) => {
    const cookieStore = await cookies();
    return cookieStore.get(key)?.value || process.env[key] || getConfigValue(key) || '';
};

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || '20')));
        const skip = Math.max(0, Number(searchParams.get('skip') || '0'));
        const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
        const q = (searchParams.get('q') || '').trim();

        const mongoUri = await getConfig('MONGODB_URI');
        const mongoDb = (await getConfig('MONGODB_DB_NAME')) || 'rag_db';
        if (!mongoUri) return NextResponse.json({ error: 'MONGODB_URI not set' }, { status: 400 });

        const client = await getMongoClient(mongoUri);
        const db = client.db(mongoDb);

        const filter: any = {};
        if (q) {
            const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapeRegExp(q), 'i');
            filter.$or = [
                { uploadId: regex },
                { status: regex },
                { mode: regex },
                { files: { $elemMatch: { filename: regex } } }
            ];
        }

        const total = await db.collection('uploads').countDocuments(filter);
        const sortOrder = order === 'asc' ? 1 : -1;
        const uploads = await db.collection('uploads')
            .find(filter, { projection: { _id: 0 } })
            .sort({ createdAt: sortOrder })
            .skip(skip)
            .limit(limit)
            .toArray();

        return NextResponse.json({ uploads, limit, skip, total, order, q });
    } catch (error: any) {
        console.error('Fetch uploads error', error);
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
    }
}
