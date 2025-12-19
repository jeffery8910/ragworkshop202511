import { getMongoClient } from '@/lib/db/mongo';

export interface GraphEvidenceNode {
    id: string;
    label?: string;
    type?: string;
    docId?: string;
    chunkId?: string;
    sectionId?: string;
}

export interface GraphEvidenceEdge {
    source: string;
    target: string;
    relation: string;
    docId?: string;
    chunkId?: string;
    sectionId?: string;
}

export interface GraphEvidence {
    nodes: GraphEvidenceNode[];
    edges: GraphEvidenceEdge[];
    triples: string[];
    matchedNodeIds: string[];
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function searchGraphEvidence(
    query: string,
    opts?: { maxNodes?: number; maxEdges?: number; mongoUri?: string; dbName?: string }
): Promise<GraphEvidence> {
    const maxNodes = opts?.maxNodes ?? 10;
    const maxEdges = opts?.maxEdges ?? 30;

    const client = await getMongoClient(opts?.mongoUri);
    const db = client.db(opts?.dbName || process.env.MONGODB_DB_NAME || 'rag_db');

    const tokens = query.split(/\s+/).map(t => t.trim()).filter(t => t.length > 1);
    if (tokens.length === 0) {
        return { nodes: [], edges: [], triples: [], matchedNodeIds: [] };
    }

    const tokenRegex = tokens.map(t => new RegExp(escapeRegExp(t), 'i'));

    const matchedNodes = await db.collection<GraphEvidenceNode>('graph_nodes')
        .find({ label: { $in: tokenRegex } }, { projection: { _id: 0 } })
        .limit(maxNodes)
        .toArray();

    if (matchedNodes.length === 0) {
        return { nodes: [], edges: [], triples: [], matchedNodeIds: [] };
    }

    const matchedNodeIds = matchedNodes.map((n: any) => n.id);

    const relatedEdges = await db.collection<GraphEvidenceEdge>('graph_edges')
        .find(
            {
                $or: [
                    { source: { $in: matchedNodeIds } },
                    { target: { $in: matchedNodeIds } }
                ]
            },
            { projection: { _id: 0 } }
        )
        .limit(maxEdges)
        .toArray();

    if (relatedEdges.length === 0) {
        return { nodes: matchedNodes, edges: [], triples: [], matchedNodeIds };
    }

    const triples = relatedEdges.map((edge: any) => `${edge.source} --[${edge.relation}]--> ${edge.target}`);
    const nodeMap = new Map<string, any>();
    matchedNodes.forEach((n: any) => nodeMap.set(n.id, n));
    const edgeNodeIds = new Set<string>();
    relatedEdges.forEach((e: any) => {
        edgeNodeIds.add(e.source);
        edgeNodeIds.add(e.target);
    });
    const missingIds = [...edgeNodeIds].filter(id => !nodeMap.has(id));
    if (missingIds.length) {
        const extraNodes = await db.collection<GraphEvidenceNode>('graph_nodes')
            .find({ id: { $in: missingIds } }, { projection: { _id: 0 } })
            .limit(maxNodes * 2)
            .toArray();
        extraNodes.forEach((n: any) => nodeMap.set(n.id, n));
    }

    return {
        nodes: [...nodeMap.values()],
        edges: relatedEdges,
        triples,
        matchedNodeIds
    };
}

export async function searchGraphContext(
    query: string,
    evidence?: GraphEvidence,
    opts?: { mongoUri?: string; dbName?: string }
): Promise<string> {
    const ev = evidence || await searchGraphEvidence(query, opts);
    if (!ev.edges.length) return '';

    return `
[知識圖譜補充資訊]
以下是從知識庫圖譜中檢索到的相關實體關係：
${ev.triples.join('\n')}
`;
}
