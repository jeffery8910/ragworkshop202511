import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMongoClient } from '@/lib/db/mongo';
import { getConfigValue } from '@/lib/config-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const q = (searchParams.get('q') || '').trim();
        const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || '10')));
        if (!q) return NextResponse.json({ nodes: [] });

        const cookieStore = await cookies();
        const get = (key: string) => cookieStore.get(key)?.value || process.env[key] || getConfigValue(key) || '';
        const mongoUri = get('MONGODB_URI');
        const mongoDb = get('MONGODB_DB_NAME') || 'rag_db';
        if (!mongoUri) return NextResponse.json({ error: 'MONGODB_URI not set' }, { status: 400 });

        const client = await getMongoClient(mongoUri);
        const db = client.db(mongoDb);

        const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapeRegExp(q), 'i');

        const nodes = await db.collection('graph_nodes')
            .find({ label: regex }, { projection: { _id: 0, id: 1, label: 1, type: 1, docId: 1, sectionId: 1 } })
            .limit(limit)
            .toArray();

        return NextResponse.json({ nodes, limit });
    } catch (error: any) {
        console.error('Graph search error', error);
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
    }
}
