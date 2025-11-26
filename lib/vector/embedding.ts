import OpenAI from 'openai';

export async function getEmbedding(text: string): Promise<number[]> {
    if (!process.env.OPENAI_API_KEY) {
        console.warn('OPENAI_API_KEY is not set, returning dummy embedding');
        return new Array(1536).fill(0);
    }

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.replace(/\n/g, ' '),
    });
    return response.data[0].embedding;
}
