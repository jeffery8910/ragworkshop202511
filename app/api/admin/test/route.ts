import { NextRequest, NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/db/mongo';
import { getPineconeClient } from '@/lib/vector/pinecone';

type TestPayload =
    | { type: 'mongo'; uri?: string; dbName?: string }
    | { type: 'pinecone'; apiKey?: string; indexName?: string };

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as TestPayload;

        if (body.type === 'mongo') {
            if (!body.uri) {
                return NextResponse.json({ error: 'MONGODB_URI is required' }, { status: 400 });
            }
            const client = await getMongoClient(body.uri);
            await client.db(body.dbName || 'admin').command({ ping: 1 });
            return NextResponse.json({ ok: true, detail: 'MongoDB 連線成功' });
        }

        if (body.type === 'pinecone') {
            if (!body.apiKey) {
                return NextResponse.json({ error: 'PINECONE_API_KEY is required' }, { status: 400 });
            }
            const pine = await getPineconeClient(body.apiKey);
            let indexNames: string[] = [];
            try {
                const list = await pine.listIndexes();
                // listIndexes can return array of strings or objects depending on SDK version
                indexNames = Array.isArray((list as any).indexes)
                    ? (list as any).indexes.map((i: any) => i.name || i)
                    : Array.isArray(list)
                        ? (list as any).map((i: any) => i.name || i)
                        : [];
            } catch (err) {
                // If list fails, still count as key-valid but warn
                return NextResponse.json({ ok: true, warning: 'Key valid,但無法列出索引，請檢查權限' });
            }

            const hasIndex = body.indexName ? indexNames.includes(body.indexName) : undefined;
            return NextResponse.json({
                ok: true,
                detail: 'Pinecone API Key 驗證成功',
                indexes: indexNames,
                hasIndex,
            });
        }

        return NextResponse.json({ error: 'Invalid test type' }, { status: 400 });
    } catch (error: any) {
        console.error('Test endpoint error', error);
        return NextResponse.json({ error: error?.message || 'Test failed' }, { status: 500 });
    }
}
