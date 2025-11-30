import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMongoClient } from '@/lib/db/mongo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        const cookieStore = await cookies();
        const mongoUri = cookieStore.get('MONGODB_URI')?.value || process.env.MONGODB_URI;
        const mongoDb = cookieStore.get('MONGODB_DB_NAME')?.value || process.env.MONGODB_DB_NAME || 'rag_db';

        if (!mongoUri) return NextResponse.json({ error: 'MONGODB_URI not set' }, { status: 400 });

        const client = await getMongoClient(mongoUri);
        const db = client.db(mongoDb);

        const documents = await db
            .collection('documents')
            .find({})
            .sort({ indexedAt: -1 })
            .limit(200)
            .project({ _id: 0, docId: 1, filename: 1, size: 1, type: 1, chunks: 1, indexedAt: 1, mode: 1 })
            .toArray();

        // Grab up to 500 chunks for visualization (lightweight fields only)
        const chunkDocsRaw = await db
            .collection('chunks')
            .find({}, { projection: { _id: 0, chunkId: 1, docId: 1, source: 1, chunk: 1, text_length: 1, indexed_at: 1, text: 1 } })
            .limit(500)
            .toArray();

        // 限制文字大小，避免回傳過大 payload
        const chunkDocs = chunkDocsRaw.map(c => ({
            ...c,
            text: typeof c.text === 'string' ? c.text.slice(0, 500) : ''
        }));

        return new NextResponse(JSON.stringify({ documents, chunks: chunkDocs }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, max-age=0',
            }
        });
    } catch (error: any) {
        console.error('Fetch documents error', error);
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
    }
}
