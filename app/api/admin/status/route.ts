import { NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/db/mongo';
import { getPineconeClient } from '@/lib/vector/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
    const cookieStore = await cookies();

    // Helper to get config value (Env or Cookie)
    const getConfig = (key: string) => process.env[key] || cookieStore.get(key)?.value || '';

    const status = {
        mongo: { status: 'unknown', latency: 0, message: '' },
        pinecone: {
            apiKey: !!getConfig('PINECONE_API_KEY'),
            indexName: !!getConfig('PINECONE_INDEX_NAME'),
            connection: { status: 'unknown', latency: 0, message: '' }
        },
        llm: {
            gemini: { status: 'unknown', latency: 0, message: '' },
            openai: { status: 'unknown', latency: 0, message: '' },
            openrouter: { status: 'unknown', latency: 0, message: '' }
        },
        line: {
            messaging: {
                secret: !!getConfig('LINE_CHANNEL_SECRET'),
                token: !!getConfig('LINE_CHANNEL_ACCESS_TOKEN')
            },
            login: {
                id: !!getConfig('LINE_LOGIN_CHANNEL_ID'),
                secret: !!getConfig('LINE_LOGIN_CHANNEL_SECRET')
            }
        }
    };

    // Helper to measure latency
    const measure = async (fn: () => Promise<any>) => {
        const start = Date.now();
        try {
            await fn();
            return { status: 'ok', latency: Date.now() - start, message: 'Connected' };
        } catch (e: any) {
            return { status: 'error', latency: Date.now() - start, message: e.message || 'Error' };
        }
    };

    // 1. Check MongoDB
    const mongoUri = getConfig('MONGODB_URI');
    if (mongoUri) {
        status.mongo = await measure(async () => {
            const client = await getMongoClient(mongoUri);
            await client.db('admin').command({ ping: 1 });
        });
    } else {
        status.mongo = { status: 'missing', latency: 0, message: 'MONGODB_URI is not defined' };
    }

    // 2. Check Pinecone Connection
    if (status.pinecone.apiKey) {
        status.pinecone.connection = await measure(async () => {
            const pinecone = await getPineconeClient();
            await pinecone.listIndexes();
        });
    } else {
        status.pinecone.connection = { status: 'error', latency: 0, message: 'Missing API Key' };
    }

    // 3. Check LLMs individually

    // Gemini
    const geminiKey = getConfig('GEMINI_API_KEY');
    if (geminiKey) {
        status.llm.gemini = await measure(async () => {
            const genAI = new GoogleGenerativeAI(geminiKey);
            // Use the current generally available generateContent model
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
            await model.generateContent('ping');
        });
    } else {
        status.llm.gemini = { status: 'missing', latency: 0, message: 'Key not set' };
    }

    // OpenAI
    const openaiKey = getConfig('OPENAI_API_KEY');
    if (openaiKey) {
        status.llm.openai = await measure(async () => {
            const openai = new OpenAI({ apiKey: openaiKey });
            await openai.models.list();
        });
    } else {
        status.llm.openai = { status: 'missing', latency: 0, message: 'Key not set' };
    }

    // OpenRouter
    const openrouterKey = getConfig('OPENROUTER_API_KEY');
    if (openrouterKey) {
        status.llm.openrouter = await measure(async () => {
            const openai = new OpenAI({
                apiKey: openrouterKey,
                baseURL: 'https://openrouter.ai/api/v1'
            });
            await openai.models.list();
        });
    } else {
        status.llm.openrouter = { status: 'missing', latency: 0, message: 'Key not set' };
    }

    return NextResponse.json(status);
}
