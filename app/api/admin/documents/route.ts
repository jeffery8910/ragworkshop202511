import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMongoClient } from '@/lib/db/mongo';
import { getConfigValue } from '@/lib/config-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const get = (key: string) => cookieStore.get(key)?.value || process.env[key] || getConfigValue(key) || '';
        const mongoUri = get('MONGODB_URI');
        const mongoDb = get('MONGODB_DB_NAME') || 'rag_db';

        if (!mongoUri) return NextResponse.json({ error: 'MONGODB_URI not set' }, { status: 400 });

        const client = await getMongoClient(mongoUri);
        const db = client.db(mongoDb);

        const documents = await db
            .collection('documents')
            .find({})
            .sort({ indexedAt: -1 })
            .project({ _id: 0, docId: 1, filename: 1, size: 1, type: 1, chunks: 1, indexedAt: 1, mode: 1, status: 1, note: 1 })
            .toArray();

        const includeChunks = ['1', 'true', 'yes'].includes((req.nextUrl.searchParams.get('includeChunks') || '').toLowerCase());
        let chunkDocs: any[] = [];
        if (includeChunks) {
            // Optional: fetch chunks only when explicitly requested (payload can be large)
            const chunkDocsRaw = await db
                .collection('chunks')
                .find({}, { projection: { _id: 0, chunkId: 1, docId: 1, source: 1, chunk: 1, text_length: 1, indexed_at: 1, text: 1 } })
                .sort({ indexed_at: -1 })
                .limit(5000)
                .toArray();

            chunkDocs = chunkDocsRaw.map(c => ({
                ...c,
                text: typeof c.text === 'string' ? c.text.slice(0, 500) : ''
            }));
        }

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
