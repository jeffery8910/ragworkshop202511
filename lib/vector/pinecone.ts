import { Pinecone } from '@pinecone-database/pinecone';
import { getEmbedding } from './embedding';

let pinecone: Pinecone | null = null;

export async function getPineconeClient(dynamicApiKey?: string) {
    const apiKey = dynamicApiKey || process.env.PINECONE_API_KEY;

    if (!apiKey) {
        // Return null or throw a specific error that can be caught
        // Since the return type is inferred or explicit, let's throw but make sure we catch it.
        // Actually, let's just log a warning and throw, but ensure the app doesn't crash on boot.
        // This function is async, so it won't crash the module load.
        throw new Error('PINECONE_API_KEY is not defined');
    }

    // Always create a new instance if dynamic key is provided to ensure we use the correct one
    // Or we could cache it, but for now simplicity is better.
    // If using env var, we can use the singleton.
    if (dynamicApiKey) {
        return new Pinecone({ apiKey });
    }

    if (!pinecone) {
        pinecone = new Pinecone({
            apiKey: apiKey,
        });
    }
    return pinecone;
}

export async function searchPinecone(query: string, topK = 5, dynamicApiKey?: string, dynamicIndexName?: string) {
    const apiKey = dynamicApiKey || process.env.PINECONE_API_KEY;
    const indexName = dynamicIndexName || process.env.PINECONE_INDEX_NAME || 'rag-index';

    if (!apiKey) {
        console.warn('PINECONE_API_KEY missing, returning empty results');
        return [];
    }

    try {
        const client = await getPineconeClient(dynamicApiKey);
        const index = client.index(indexName);
        const vector = await getEmbedding(query);

        const result = await index.query({
            vector,
            topK,
            includeMetadata: true,
        });

        return result.matches.map(match => ({
            score: match.score,
            text: match.metadata?.text as string,
            source: match.metadata?.source as string,
            page: match.metadata?.page as number,
        }));
    } catch (error) {
        console.error('Pinecone search error:', error);
        return [];
    }
}
