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
        const docId = searchParams.get('docId') || '';
        const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || '100')));
        const skip = Math.max(0, Number(searchParams.get('skip') || '0'));
        const order = searchParams.get('order') === 'desc' ? 'desc' : 'asc';
        const q = (searchParams.get('q') || '').trim();

        if (!docId) return NextResponse.json({ error: 'docId is required' }, { status: 400 });

        const mongoUri = await getConfig('MONGODB_URI');
        const mongoDb = (await getConfig('MONGODB_DB_NAME')) || 'rag_db';
        if (!mongoUri) return NextResponse.json({ error: 'MONGODB_URI not set' }, { status: 400 });

        const client = await getMongoClient(mongoUri);
        const db = client.db(mongoDb);

        const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const filter: any = { docId };
        if (q) {
            const regex = new RegExp(escapeRegExp(q), 'i');
            filter.$or = [{ text: regex }, { source: regex }];
        }

        const total = await db.collection('chunks').countDocuments(filter);
        const sortOrder = order === 'desc' ? -1 : 1;
        const chunksRaw = await db.collection('chunks')
            .find(
                filter,
                { projection: { _id: 0, docId: 1, chunkId: 1, chunk: 1, text: 1, text_length: 1, indexed_at: 1, source: 1 } }
            )
            .sort({ chunk: sortOrder })
            .skip(skip)
            .limit(limit)
            .toArray();

        const chunks = chunksRaw.map(c => ({
            ...c,
            text: typeof c.text === 'string' ? c.text.slice(0, 2000) : ''
        }));

        return NextResponse.json({ chunks, limit, skip, total, order, q });
    } catch (error: any) {
        console.error('Fetch chunks error', error);
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
    }
}
