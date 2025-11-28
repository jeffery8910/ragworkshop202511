import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMongoClient } from '@/lib/db/mongo';

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
        const chunkDocs = await db
            .collection('chunks')
            .find({}, { projection: { _id: 0, chunkId: 1, docId: 1, source: 1, chunk: 1, text_length: 1, indexed_at: 1 } })
            .limit(500)
            .toArray();

        return NextResponse.json({ documents, chunks: chunkDocs });
    } catch (error: any) {
        console.error('Fetch documents error', error);
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
    }
}
