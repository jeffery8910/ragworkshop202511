import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMongoClient } from '@/lib/db/mongo';
import { getPineconeClient } from '@/lib/vector/pinecone';
import { getEmbedding } from '@/lib/vector/embedding';
import { extractGraphFromText, saveGraphData, deleteGraphDataForDoc } from '@/lib/features/graph';
import { getConfigValue } from '@/lib/config-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Scope = 'all' | 'doc';

interface ActionPayload {
    scope?: Scope;
    docId?: string;
}

async function pickConfig() {
    const cookieStore = await cookies();
    const get = (key: string) => cookieStore.get(key)?.value || process.env[key] || getConfigValue(key) || '';
    return {
        mongoUri: get('MONGODB_URI'),
        mongoDb: get('MONGODB_DB_NAME') || 'rag_db',
        pineKey: get('PINECONE_API_KEY'),
        pineIndex: get('PINECONE_INDEX_NAME') || 'rag-index',
        embeddingProvider: (get('EMBEDDING_PROVIDER') || process.env.EMBEDDING_PROVIDER || 'pinecone') as any,
        embeddingModel: get('EMBEDDING_MODEL'),
    };
}

async function getDb() {
    const cfg = await pickConfig();
    if (!cfg.mongoUri) throw new Error('MONGODB_URI not set');
    const client = await getMongoClient(cfg.mongoUri);
    return { db: client.db(cfg.mongoDb), cfg };
}

async function getPine(cfg?: Awaited<ReturnType<typeof pickConfig>>) {
    const conf = cfg || (await pickConfig());
    if (!conf.pineKey) return null;
    const pine = await getPineconeClient(conf.pineKey);
    return pine.index(conf.pineIndex);
}

async function reindexDocs(docIds: string[]) {
    const { db, cfg } = await getDb();
    const chunkCol = db.collection('chunks');
    const pine = await getPine(cfg);
    const provider = cfg.pineKey ? 'pinecone' : cfg.embeddingProvider;
    const model = cfg.pineKey ? (cfg.embeddingModel || 'multilingual-e5-large') : cfg.embeddingModel;
    const pineDim = Number(process.env.PINECONE_DIM || '1024');
    const allowedPineModels = ['multilingual-e5-large', 'llama-text-embed-v2'];

    const results: any[] = [];
    for (const docId of docIds) {
        // Clean up old graph data before re-indexing
        await deleteGraphDataForDoc(docId);

        const chunks = await chunkCol.find({ docId }).sort({ chunk: 1 }).toArray();
        if (!chunks.length) {
            results.push({ docId, status: 'skipped', reason: 'no_chunks' });
            continue;
        }

        if (cfg.pineKey && cfg.embeddingProvider === 'pinecone' && cfg.embeddingModel && !allowedPineModels.includes(cfg.embeddingModel)) {
            throw new Error(`Pinecone 嵌入目前只支援 ${allowedPineModels.join(', ')}，請改用這些模型或切換 EMBEDDING_PROVIDER。當前設定: ${cfg.embeddingModel}`);
        }

        const vectors: { id: string; values: number[]; metadata: any }[] = [];
        for (const c of chunks) {
            // 1. Embedding Generation
            const embedding = await getEmbedding(c.text, {
                provider,
                geminiApiKey: process.env.GEMINI_API_KEY,
                openaiApiKey: process.env.OPENAI_API_KEY,
                openrouterApiKey: process.env.OPENROUTER_API_KEY,
                pineconeApiKey: cfg.pineKey || process.env.PINECONE_API_KEY,
                modelName: model || undefined,
                desiredDim: cfg.pineKey ? pineDim : undefined,
            });
            if (cfg.pineKey && embedding.length !== pineDim) {
                throw new Error(`Embedding dimension ${embedding.length} != index dimension ${pineDim}`);
            }
            vectors.push({
                id: c.chunkId,
                values: embedding,
                metadata: {
                    docId,
                    source: c.source,
                    chunk: c.chunk,
                    text_length: c.text_length,
                },
            });

            // 2. Graph Extraction (Optional but enabled for this feature)
            try {
                // Only extract for chunks with sufficient content
                if (c.text && c.text.length > 50) {
                    const graphData = await extractGraphFromText(c.text);
                    await saveGraphData(docId, c.chunkId, graphData);
                }
            } catch (gErr) {
                console.warn(`Graph extraction failed for chunk ${c.chunkId}`, gErr);
            }
        }

        if (pine) {
            // 先刪除舊向量再寫入
            await pine.deleteMany(chunks.map((c: any) => c.chunkId));
            await pine.upsert(vectors);
        }

        await db.collection('documents').updateOne({ docId }, { $set: { indexedAt: new Date(), status: 'reindexed' } });
        results.push({ docId, status: 'ok', vectors: vectors.length, graph: 'extracted' });
    }

    return results;
}

async function deleteDocs(docIds: string[]) {
    const { db, cfg } = await getDb();
    const pine = await getPine(cfg);

    const chunkCol = db.collection('chunks');
    const docCol = db.collection('documents');
    const results: any[] = [];

    for (const docId of docIds) {
        const chunkIds = await chunkCol.find({ docId }).project({ _id: 0, chunkId: 1 }).toArray();
        if (pine && chunkIds.length) {
            await pine.deleteMany(chunkIds.map((c: any) => c.chunkId));
        }
        await chunkCol.deleteMany({ docId });
        await deleteGraphDataForDoc(docId); // Delete graph data
        await docCol.deleteOne({ docId });
        results.push({ docId, status: 'deleted', vectors: chunkIds.length });
    }
    return results;
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as ActionPayload;
        const scope = body.scope || 'all';
        const { db } = await getDb();
        const docIds =
            scope === 'doc' && body.docId
                ? [body.docId]
                : (await db.collection('documents').find({}, { projection: { _id: 0, docId: 1 } }).toArray()).map(d => d.docId);

        if (!docIds.length) return NextResponse.json({ ok: false, error: 'No documents to reindex' }, { status: 400 });

        const results = await reindexDocs(docIds);
        return NextResponse.json({ ok: true, results });
    } catch (error: any) {
        console.error('Reindex error', error);
        return NextResponse.json({ ok: false, error: error?.message || 'Internal Error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const body = (await req.json()) as ActionPayload;
        const scope = body.scope || 'all';
        const { db, cfg } = await getDb();
        const chunkCol = db.collection('chunks');
        const docCol = db.collection('documents');
        const pine = await getPine(cfg);

        if (scope === 'doc' && body.docId) {
            const results = await deleteDocs([body.docId]);
            return NextResponse.json({ ok: true, results });
        }

        // delete all
        if (pine) await pine.deleteAll();
        await chunkCol.deleteMany({});
        await docCol.deleteMany({});

        return NextResponse.json({ ok: true, results: [{ scope: 'all', status: 'deleted' }] });
    } catch (error: any) {
        console.error('Delete index error', error);
        return NextResponse.json({ ok: false, error: error?.message || 'Internal Error' }, { status: 500 });
    }
}
