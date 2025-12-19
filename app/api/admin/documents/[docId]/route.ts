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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
    try {
        const resolvedParams = await params;
        const docId = resolvedParams?.docId;
        if (!docId) return NextResponse.json({ error: 'docId is required' }, { status: 400 });

        const mongoUri = await getConfig('MONGODB_URI');
        const mongoDb = (await getConfig('MONGODB_DB_NAME')) || 'rag_db';
        if (!mongoUri) return NextResponse.json({ error: 'MONGODB_URI not set' }, { status: 400 });

        const client = await getMongoClient(mongoUri);
        const db = client.db(mongoDb);

        const document = await db.collection('documents').findOne(
            { docId },
            { projection: { _id: 0 } }
        );
        if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

        const statsAgg = await db.collection('chunks').aggregate([
            { $match: { docId } },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    avgLen: { $avg: '$text_length' },
                    minLen: { $min: '$text_length' },
                    maxLen: { $max: '$text_length' },
                }
            }
        ]).toArray();

        const stats = statsAgg[0]
            ? {
                count: statsAgg[0].count || 0,
                avgLen: Math.round(statsAgg[0].avgLen || 0),
                minLen: statsAgg[0].minLen || 0,
                maxLen: statsAgg[0].maxLen || 0,
            }
            : { count: 0, avgLen: 0, minLen: 0, maxLen: 0 };

        const samplesRaw = await db.collection('chunks')
            .find({ docId }, { projection: { _id: 0, chunkId: 1, chunk: 1, text: 1, text_length: 1 } })
            .sort({ chunk: 1 })
            .limit(5)
            .toArray();

        const samples = samplesRaw.map(s => ({
            ...s,
            text: typeof s.text === 'string' ? s.text.slice(0, 300) : ''
        }));

        return NextResponse.json({ document, stats, samples });
    } catch (error: any) {
        console.error('Fetch document detail error', error);
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
    }
}
