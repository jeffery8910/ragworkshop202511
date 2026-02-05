import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMongoClient } from '@/lib/db/mongo';
import { getPineconeClient } from '@/lib/vector/pinecone';
import { getEmbedding } from '@/lib/vector/embedding';
import type { EmbeddingProvider } from '@/lib/vector/embedding';
import { extractGraphFromText, saveGraphData, deleteGraphDataForDoc } from '@/lib/features/graph';
import { getConfigValue } from '@/lib/config-store';
import { resolveVectorStoreProvider } from '@/lib/vector/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Scope = 'all' | 'doc';

interface ActionPayload {
    scope?: Scope;
    docId?: string;
}

function slugifySection(title: string) {
    const base = title
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
    return base || 'section';
}

function splitIntoSections(text: string) {
    const lines = text.split('\n');
    const sections: { id: string; title: string; text: string }[] = [];
    let currentTitle = 'document';
    let currentLines: string[] = [];
    const pushSection = () => {
        const content = currentLines.join('\n').trim();
        if (!content) return;
        const id = `${slugifySection(currentTitle)}-${sections.length + 1}`;
        sections.push({ id, title: currentTitle, text: content });
    };
    lines.forEach(line => {
        const headingMatch = line.match(/^#{1,6}\s+(.+)/);
        if (headingMatch) {
            pushSection();
            currentTitle = headingMatch[1].trim();
            currentLines = [];
            return;
        }
        currentLines.push(line);
    });
    pushSection();
    return sections.length ? sections : [{ id: 'document-1', title: 'document', text }];
}

async function pickConfig() {
    const cookieStore = await cookies();
    const get = (key: string) => cookieStore.get(key)?.value || process.env[key] || getConfigValue(key) || '';

    const embeddingProviderRaw = (get('EMBEDDING_PROVIDER') || '').trim().toLowerCase();
    const embeddingProvider: EmbeddingProvider | undefined =
        embeddingProviderRaw === 'gemini' || embeddingProviderRaw === 'openai' || embeddingProviderRaw === 'openrouter' || embeddingProviderRaw === 'pinecone'
            ? (embeddingProviderRaw as EmbeddingProvider)
            : undefined;

    return {
        mongoUri: get('MONGODB_URI'),
        mongoDb: get('MONGODB_DB_NAME') || 'rag_db',
        pineKey: get('PINECONE_API_KEY'),
        pineIndex: get('PINECONE_INDEX_NAME') || 'rag-index',
        vectorStoreProvider: get('VECTOR_STORE_PROVIDER') || get('VECTOR_BACKEND'),
        geminiKey: get('GEMINI_API_KEY'),
        openaiKey: get('OPENAI_API_KEY'),
        openrouterKey: get('OPENROUTER_API_KEY'),
        embeddingProvider,
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

    const vectorStore = resolveVectorStoreProvider({
        explicit: cfg.vectorStoreProvider,
        pineconeApiKey: cfg.pineKey,
        mongoUri: cfg.mongoUri,
    });
    const usePinecone = vectorStore === 'pinecone';
    if (usePinecone && !cfg.pineKey) {
        throw new Error('VECTOR_STORE_PROVIDER=pinecone but PINECONE_API_KEY not set');
    }

    const pine = usePinecone ? await getPine(cfg) : null;

    const embeddingProviderForAtlas: EmbeddingProvider | undefined =
        cfg.embeddingProvider === 'gemini' && cfg.geminiKey ? 'gemini'
            : cfg.embeddingProvider === 'openai' && cfg.openaiKey ? 'openai'
                : cfg.embeddingProvider === 'openrouter' && cfg.openrouterKey ? 'openrouter'
                    : cfg.embeddingProvider === 'pinecone' && cfg.pineKey ? 'pinecone'
                        : undefined;

    const provider: EmbeddingProvider | undefined = usePinecone ? 'pinecone' : embeddingProviderForAtlas;
    const model = usePinecone
        ? (cfg.embeddingModel || 'multilingual-e5-large')
        : (embeddingProviderForAtlas ? cfg.embeddingModel : undefined);
    const pineDim = Number(process.env.PINECONE_DIM || '1024');
    const allowedPineModels = ['multilingual-e5-large', 'llama-text-embed-v2'];

    const results: any[] = [];
    for (const docId of docIds) {
        // Clean up old graph data before re-indexing
        await deleteGraphDataForDoc(docId, { mongoUri: cfg.mongoUri, dbName: cfg.mongoDb });

        const chunks = await chunkCol.find({ docId }).sort({ chunk: 1 }).toArray();
        if (!chunks.length) {
            results.push({ docId, status: 'skipped', reason: 'no_chunks' });
            continue;
        }

        if (usePinecone && cfg.embeddingModel && !allowedPineModels.includes(cfg.embeddingModel)) {
            throw new Error(`Pinecone 嵌入目前只支援 ${allowedPineModels.join(', ')}，請改用這些模型或切換 EMBEDDING_PROVIDER。當前設定: ${cfg.embeddingModel}`);
        }

        const vectors: { id: string; values: number[]; metadata: any }[] = [];
        const bulkOps: any[] = [];
        for (const c of chunks) {
            // 1. Embedding Generation
            const embedding = await getEmbedding(c.text, {
                ...(provider ? { provider } : {}),
                geminiApiKey: cfg.geminiKey || process.env.GEMINI_API_KEY,
                openaiApiKey: cfg.openaiKey || process.env.OPENAI_API_KEY,
                openrouterApiKey: cfg.openrouterKey || process.env.OPENROUTER_API_KEY,
                pineconeApiKey: cfg.pineKey || process.env.PINECONE_API_KEY,
                ...(provider && model ? { modelName: model } : {}),
                desiredDim: usePinecone ? pineDim : undefined,
            });
            if (usePinecone && embedding.length !== pineDim) {
                throw new Error(`Embedding dimension ${embedding.length} != index dimension ${pineDim}`);
            }

            if (usePinecone) {
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
            } else {
                bulkOps.push({
                    updateOne: {
                        filter: { _id: c._id },
                        update: {
                            $set: {
                                embedding,
                                embedding_dim: embedding.length,
                                embedding_provider: embeddingProviderForAtlas || 'auto',
                                ...(embeddingProviderForAtlas && cfg.embeddingModel ? { embedding_model: cfg.embeddingModel } : {}),
                                embedding_updated_at: new Date(),
                            },
                        },
                    },
                });
            }
        }

        if (!usePinecone && bulkOps.length) {
            await chunkCol.bulkWrite(bulkOps, { ordered: false });
        }

        // 2. Document-level Graph Extraction (no chunk slicing)
        try {
            const fullText = chunks.map((c: any) => c.text || '').join('\n');
            if (fullText.trim().length > 50) {
                const sections = splitIntoSections(fullText);
                for (const section of sections) {
                    if (!section.text.trim()) continue;
                    const graphData = await extractGraphFromText(section.text);
                    await saveGraphData(docId, section.id, graphData, { mongoUri: cfg.mongoUri, dbName: cfg.mongoDb });
                }
            }
        } catch (gErr) {
            console.warn(`Graph extraction failed for doc ${docId}`, gErr);
        }

        if (pine) {
            // 先刪除舊向量再寫入
            await pine.deleteMany(chunks.map((c: any) => c.chunkId));
            await pine.upsert(vectors);
        }

        await db.collection('documents').updateOne({ docId }, { $set: { indexedAt: new Date(), status: 'reindexed', graphMode: 'document' } });
        results.push({ docId, status: 'ok', vectors: usePinecone ? vectors.length : chunks.length, vectorStore: vectorStore || 'atlas', graph: 'extracted' });
    }

    return results;
}

async function deleteDocs(docIds: string[]) {
    const { db, cfg } = await getDb();

    const vectorStore = resolveVectorStoreProvider({
        explicit: cfg.vectorStoreProvider,
        pineconeApiKey: cfg.pineKey,
        mongoUri: cfg.mongoUri,
    });
    const usePinecone = vectorStore === 'pinecone';
    if (usePinecone && !cfg.pineKey) {
        throw new Error('VECTOR_STORE_PROVIDER=pinecone but PINECONE_API_KEY not set');
    }
    const pine = usePinecone ? await getPine(cfg) : null;

    const chunkCol = db.collection('chunks');
    const docCol = db.collection('documents');
    const results: any[] = [];

    for (const docId of docIds) {
        const chunkIds = await chunkCol.find({ docId }).project({ _id: 0, chunkId: 1 }).toArray();
        if (pine && chunkIds.length) {
            await pine.deleteMany(chunkIds.map((c: any) => c.chunkId));
        }
        await chunkCol.deleteMany({ docId });
        await deleteGraphDataForDoc(docId, { mongoUri: cfg.mongoUri, dbName: cfg.mongoDb }); // Delete graph data
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

        const vectorStore = resolveVectorStoreProvider({
            explicit: cfg.vectorStoreProvider,
            pineconeApiKey: cfg.pineKey,
            mongoUri: cfg.mongoUri,
        });
        const usePinecone = vectorStore === 'pinecone';
        if (usePinecone && !cfg.pineKey) {
            throw new Error('VECTOR_STORE_PROVIDER=pinecone but PINECONE_API_KEY not set');
        }
        const pine = usePinecone ? await getPine(cfg) : null;

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
