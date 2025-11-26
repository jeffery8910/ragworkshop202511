import { Pinecone } from '@pinecone-database/pinecone';
import { getEmbedding } from './embedding';

let pinecone: Pinecone | null = null;

export async function getPineconeClient() {
    if (!process.env.PINECONE_API_KEY) {
        throw new Error('PINECONE_API_KEY is not defined');
    }
    if (!pinecone) {
        pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
        });
    }
    return pinecone;
}

export async function searchPinecone(query: string, topK = 5) {
    // If API key is missing, return empty results to prevent crash during build/test
    if (!process.env.PINECONE_API_KEY) {
        console.warn('PINECONE_API_KEY missing, returning empty results');
        return [];
    }

    const client = await getPineconeClient();
    const index = client.index(process.env.PINECONE_INDEX_NAME || 'rag-index');
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
}
