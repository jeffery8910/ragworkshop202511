import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMongoClient } from '@/lib/db/mongo';
import { getConfigValue } from '@/lib/config-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getDb() {
    const cookieStore = await cookies();
    const get = (key: string) => cookieStore.get(key)?.value || process.env[key] || getConfigValue(key) || '';
    const mongoUri = get('MONGODB_URI');
    const mongoDb = get('MONGODB_DB_NAME') || 'rag_db';
    if (!mongoUri) throw new Error('MONGODB_URI is not defined');
    const client = await getMongoClient(mongoUri);
    return client.db(mongoDb);
}

export async function GET(req: NextRequest) {
    try {
        const db = await getDb();
        
        // 限制回傳數量以免瀏覽器跑不動 (例如限制 500 個節點)
        // 實際應用可以根據 docId 篩選，這裡先抓全部
        const nodes = await db.collection('graph_nodes')
            .find({})
            .limit(500)
            .project({ _id: 0, id: 1, label: 1, type: 1, docId: 1, sectionId: 1 })
            .toArray();

        const edges = await db.collection('graph_edges')
            .find({})
            .limit(1000)
            .project({ _id: 0, source: 1, target: 1, relation: 1, docId: 1, sectionId: 1 })
            .toArray();

        return NextResponse.json({ ok: true, nodes, edges });
    } catch (error: any) {
        console.error('Fetch graph error', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
