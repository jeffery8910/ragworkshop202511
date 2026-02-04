import { getMongoClient } from '@/lib/db/mongo';
import { getEmbedding, type EmbeddingConfig } from './embedding';
import { getAtlasVectorIndexName } from './store';

export async function searchAtlas(
    query: string,
    topK = 5,
    opts?: {
        mongoUri?: string;
        dbName?: string;
        collectionName?: string;
        indexName?: string;
        embeddingConfig?: EmbeddingConfig;
        filter?: Record<string, any>;
    }
) {
    const mongoUri = opts?.mongoUri || process.env.MONGODB_URI;
    if (!mongoUri) throw new Error('MONGODB_URI is not defined');

    const client = await getMongoClient(mongoUri);
    const dbName = opts?.dbName || process.env.MONGODB_DB_NAME || 'rag_db';
    const db = client.db(dbName);
    const collectionName = opts?.collectionName || 'chunks';
    const collection = db.collection(collectionName);

    try {
        const vector = await getEmbedding(query, opts?.embeddingConfig);
        const indexName = getAtlasVectorIndexName(opts?.indexName);

        const results = await collection
            .aggregate([
                {
                    $vectorSearch: {
                        index: indexName,
                        path: 'embedding',
                        queryVector: vector,
                        numCandidates: Math.max(50, topK * 10),
                        limit: topK,
                        ...(opts?.filter ? { filter: opts.filter } : {}),
                    },
                },
                {
                    $project: {
                        _id: 0,
                        docId: 1,
                        chunkId: 1,
                        chunk: 1,
                        text: 1,
                        source: 1,
                        page: 1,
                        score: { $meta: 'vectorSearchScore' },
                    },
                },
            ])
            .toArray();

        return results.map((r: any) => ({
            score: Number(r.score || 0),
            text: String(r.text || ''),
            source: String(r.source || ''),
            page: typeof r.page === 'number' ? r.page : undefined,
            metadata: {
                docId: r.docId,
                chunkId: r.chunkId,
                chunk: r.chunk,
            },
        }));
    } catch (error) {
        console.error('Atlas Vector Search error:', error);
        return [];
    }
}
