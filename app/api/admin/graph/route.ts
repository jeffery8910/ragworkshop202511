import { NextRequest, NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/db/mongo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const client = await getMongoClient();
        const db = client.db(process.env.MONGODB_DB_NAME || 'rag_db');
        
        // 限制回傳數量以免瀏覽器跑不動 (例如限制 500 個節點)
        // 實際應用可以根據 docId 篩選，這裡先抓全部
        const nodes = await db.collection('graph_nodes')
            .find({})
            .limit(500)
            .project({ _id: 0, id: 1, label: 1, type: 1, docId: 1 })
            .toArray();

        const edges = await db.collection('graph_edges')
            .find({})
            .limit(1000)
            .project({ _id: 0, source: 1, target: 1, relation: 1 })
            .toArray();

        return NextResponse.json({ ok: true, nodes, edges });
    } catch (error: any) {
        console.error('Fetch graph error', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
