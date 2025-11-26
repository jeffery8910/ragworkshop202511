import { NextResponse } from 'next/server';
import clientPromise from '@/lib/db/mongo';
import { getPineconeClient } from '@/lib/vector/pinecone';
import { generateText, getActiveProvider } from '@/lib/llm';

export const dynamic = 'force-dynamic';

export async function GET() {
    const status = {
        mongo: 'unknown',
        pinecone: 'unknown',
        llm: 'unknown',
        line: 'unknown'
    };

    // 1. Check MongoDB
    try {
        const client = await clientPromise;
        await client.db('admin').command({ ping: 1 });
        status.mongo = 'ok';
    } catch (e) {
        status.mongo = 'error';
    }

    // 2. Check Pinecone
    try {
        const pinecone = await getPineconeClient();
        await pinecone.listIndexes();
        status.pinecone = 'ok';
    } catch (e) {
        status.pinecone = 'error';
    }

    // 3. Check LLM (OpenRouter/OpenAI/Gemini)
    try {
        const provider = getActiveProvider();
        await generateText('ping');
        status.llm = `ok (${provider})`;
    } catch (e) {
        status.llm = 'error';
    }

    // 4. Check LINE (Just check env vars)
    if (process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN) {
        status.line = 'ok';
    } else {
        status.line = 'error';
    }

    return NextResponse.json(status);
}
