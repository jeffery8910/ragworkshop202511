import { NextResponse } from 'next/server';
import clientPromise from '@/lib/db/mongo';
import { getPineconeClient } from '@/lib/vector/pinecone';
import { generateText, getActiveProvider } from '@/lib/llm';

export const dynamic = 'force-dynamic';

export async function GET() {
    const status = {
        mongo: { status: 'unknown', latency: 0, message: '' },
        pinecone: { status: 'unknown', latency: 0, message: '' },
        llm: { status: 'unknown', latency: 0, message: '' },
        line: { status: 'unknown', latency: 0, message: '' }
    };

    // Helper to measure latency
    const measure = async (fn: () => Promise<any>) => {
        const start = Date.now();
        try {
            await fn();
            return { status: 'ok', latency: Date.now() - start, message: 'Connected' };
        } catch (e: any) {
            return { status: 'error', latency: Date.now() - start, message: e.message || 'Unknown error' };
        }
    };

    // 1. Check MongoDB
    status.mongo = await measure(async () => {
        const client = await clientPromise;
        await client.db('admin').command({ ping: 1 });
    });

    // 2. Check Pinecone
    status.pinecone = await measure(async () => {
        const pinecone = await getPineconeClient();
        await pinecone.listIndexes();
    });

    // 3. Check LLM
    status.llm = await measure(async () => {
        const provider = getActiveProvider();
        await generateText('ping');
        return `Provider: ${provider}`; // Pass provider name if successful
    });
    if (status.llm.status === 'ok' && typeof status.llm.message !== 'string') {
        // Fix message if it returned object (not needed here but good safety)
        status.llm.message = `Connected (${getActiveProvider()})`;
    } else if (status.llm.status === 'ok') {
        status.llm.message = `Connected (${getActiveProvider()})`;
    }

    // 4. Check LINE
    const cookieStore = await (await import('next/headers')).cookies();
    if (process.env.LINE_CHANNEL_SECRET || cookieStore.get('LINE_CHANNEL_SECRET')) {
        status.line = { status: 'ok', latency: 0, message: 'Credentials configured' };
    } else {
        status.line = { status: 'error', latency: 0, message: 'Missing credentials' };
    }

    return NextResponse.json(status);
}
