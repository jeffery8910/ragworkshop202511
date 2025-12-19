import { getMongoClient } from '@/lib/db/mongo';
import { getEmbedding } from './embedding';

export async function searchAtlas(query: string, topK = 5) {
    const client = await getMongoClient();
    const db = client.db(process.env.MONGODB_DB_NAME || 'rag_db');
    const collection = db.collection('documents');
    const vector = await getEmbedding(query);

    const results = await collection.aggregate([
        {
            $vectorSearch: {
                index: 'vector_index',
                path: 'embedding',
                queryVector: vector,
                numCandidates: topK * 10,
                limit: topK,
            },
        },
        {
            $project: {
                _id: 0,
                text: 1,
                source: 1,
                page: 1,
                score: { $meta: 'vectorSearchScore' },
            },
        },
    ]).toArray();

    return results;
}
