import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getConfigValue } from '@/lib/config-store';
import { searchGraphEvidence } from '@/lib/features/graph-search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const query = (body?.query || '').toString().trim();
        if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 });

        const cookieStore = await cookies();
        const get = (key: string) => cookieStore.get(key)?.value || process.env[key] || getConfigValue(key) || '';
        const mongoUri = get('MONGODB_URI');
        const mongoDb = get('MONGODB_DB_NAME') || 'rag_db';

        const maxNodes = Math.min(50, Math.max(1, Number(body?.maxNodes || 10)));
        const maxEdges = Math.min(200, Math.max(1, Number(body?.maxEdges || 30)));

        const evidence = await searchGraphEvidence(query, { maxNodes, maxEdges, mongoUri, dbName: mongoDb });
        const docSet = new Set<string>();
        evidence.nodes.forEach(n => n.docId && docSet.add(n.docId));
        evidence.edges.forEach(e => e.docId && docSet.add(e.docId));

        return NextResponse.json({
            query,
            nodes: evidence.nodes,
            edges: evidence.edges,
            triples: evidence.triples,
            matchedNodeIds: evidence.matchedNodeIds,
            docIds: [...docSet],
        });
    } catch (error: any) {
        console.error('Graph evidence error', error);
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
    }
}
