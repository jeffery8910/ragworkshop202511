import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMongoClient } from '@/lib/db/mongo';
import { getConfigValue } from '@/lib/config-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Edge {
    source: string;
    target: string;
    relation: string;
    docId?: string;
    sectionId?: string;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const fromNodeId = (body?.fromNodeId || '').toString().trim();
        const toNodeId = (body?.toNodeId || '').toString().trim();
        const maxHops = Math.min(6, Math.max(1, Number(body?.maxHops || 3)));
        const allowCrossDoc = body?.allowCrossDoc !== false;

        if (!fromNodeId || !toNodeId) {
            return NextResponse.json({ error: 'fromNodeId and toNodeId are required' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const get = (key: string) => cookieStore.get(key)?.value || process.env[key] || getConfigValue(key) || '';
        const mongoUri = get('MONGODB_URI');
        const mongoDb = get('MONGODB_DB_NAME') || 'rag_db';
        if (!mongoUri) return NextResponse.json({ error: 'MONGODB_URI not set' }, { status: 400 });

        const client = await getMongoClient(mongoUri);
        const db = client.db(mongoDb);

        let allowedDocId: string | null = null;
        if (!allowCrossDoc) {
            const fromNode = await db.collection('graph_nodes').findOne({ id: fromNodeId }, { projection: { _id: 0, docId: 1 } });
            const toNode = await db.collection('graph_nodes').findOne({ id: toNodeId }, { projection: { _id: 0, docId: 1 } });
            if (!fromNode?.docId || !toNode?.docId || fromNode.docId !== toNode.docId) {
                return NextResponse.json({ ok: true, pathNodes: [], pathEdges: [], docIds: [], summary: 'no_path_same_doc' });
            }
            allowedDocId = fromNode.docId;
        }

        const edgeFilter: any = {};
        if (!allowCrossDoc && allowedDocId) edgeFilter.docId = allowedDocId;

        const edges: Edge[] = await db.collection<Edge>('graph_edges')
            .find(edgeFilter, { projection: { _id: 0 } })
            .limit(5000)
            .toArray();

        const adjacency = new Map<string, Edge[]>();
        edges.forEach(edge => {
            if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
            if (!adjacency.has(edge.target)) adjacency.set(edge.target, []);
            adjacency.get(edge.source)!.push(edge);
            adjacency.get(edge.target)!.push(edge);
        });

        const queue: Array<{ node: string; pathNodes: string[]; pathEdges: Edge[] }> = [];
        const visited = new Set<string>();
        queue.push({ node: fromNodeId, pathNodes: [fromNodeId], pathEdges: [] });
        visited.add(fromNodeId);

        let found: { pathNodes: string[]; pathEdges: Edge[] } | null = null;

        while (queue.length) {
            const current = queue.shift()!;
            if (current.pathEdges.length > maxHops) continue;
            if (current.node === toNodeId) {
                found = { pathNodes: current.pathNodes, pathEdges: current.pathEdges };
                break;
            }
            const neighbors = adjacency.get(current.node) || [];
            for (const edge of neighbors) {
                const nextNode = edge.source === current.node ? edge.target : edge.source;
                if (visited.has(nextNode)) continue;
                visited.add(nextNode);
                queue.push({
                    node: nextNode,
                    pathNodes: [...current.pathNodes, nextNode],
                    pathEdges: [...current.pathEdges, edge],
                });
            }
        }

        if (!found) {
            return NextResponse.json({ ok: true, pathNodes: [], pathEdges: [], docIds: [], summary: 'no_path' });
        }

        const docSet = new Set<string>();
        found.pathEdges.forEach(e => e.docId && docSet.add(e.docId));

        const summary = found.pathNodes.join(' -> ');

        return NextResponse.json({
            ok: true,
            pathNodes: found.pathNodes,
            pathEdges: found.pathEdges,
            docIds: [...docSet],
            summary,
        });
    } catch (error: any) {
        console.error('Graph path error', error);
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
    }
}
