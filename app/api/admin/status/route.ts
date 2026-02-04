import { NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/db/mongo';
import { getPineconeClient } from '@/lib/vector/pinecone';
import { getEmbedding } from '@/lib/vector/embedding';
import { getAtlasVectorIndexName, resolveVectorStoreProvider } from '@/lib/vector/store';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
    const cookieStore = await cookies();

    // Helper to get config value (Env or Cookie)
    const getConfig = (key: string) => process.env[key] || cookieStore.get(key)?.value || '';

    const mongoUri = getConfig('MONGODB_URI');
    const mongoDb = getConfig('MONGODB_DB_NAME') || 'rag_db';
    const pineKey = getConfig('PINECONE_API_KEY');

    const vectorStore = resolveVectorStoreProvider({
        explicit: getConfig('VECTOR_STORE_PROVIDER'),
        pineconeApiKey: pineKey,
        mongoUri,
    });
    const atlasIndexName = getAtlasVectorIndexName(getConfig('ATLAS_VECTOR_INDEX_NAME'));

    const geminiKey = getConfig('GEMINI_API_KEY');
    const openaiKey = getConfig('OPENAI_API_KEY');
    const openrouterKey = getConfig('OPENROUTER_API_KEY');
    const embeddingProviderRaw = (getConfig('EMBEDDING_PROVIDER') || '').trim().toLowerCase();
    const embeddingModel = (getConfig('EMBEDDING_MODEL') || '').trim();

    const status = {
        mongo: { status: 'unknown', latency: 0, message: '' },
        vectorStore: {
            provider: vectorStore || 'auto',
        },
        atlasVector: {
            enabled: vectorStore === 'atlas',
            indexName: atlasIndexName,
            vectorSearch: { status: 'unknown', latency: 0, message: '' },
        },
        n8n: {
            webhookUrl: !!getConfig('N8N_WEBHOOK_URL'),
            health: { status: 'unknown', latency: 0, message: '' }
        },
        pinecone: {
            apiKey: !!pineKey,
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
    if (mongoUri) {
        status.mongo = await measure(async () => {
            const client = await getMongoClient(mongoUri);
            await client.db('admin').command({ ping: 1 });
        });
    } else {
        status.mongo = { status: 'missing', latency: 0, message: 'MONGODB_URI is not defined' };
    }

    // 1.5 Check Atlas Vector Search (only when selected)
    if (!mongoUri) {
        status.atlasVector.vectorSearch = { status: 'missing', latency: 0, message: 'MONGODB_URI is not defined' };
    } else if (vectorStore !== 'atlas') {
        status.atlasVector.vectorSearch = { status: 'missing', latency: 0, message: `VECTOR_STORE_PROVIDER is ${vectorStore || 'auto'} (not atlas)` };
    } else {
        status.atlasVector.vectorSearch = await measure(async () => {
            const embeddingProvider =
                embeddingProviderRaw === 'gemini' && geminiKey ? 'gemini'
                    : embeddingProviderRaw === 'openai' && openaiKey ? 'openai'
                        : embeddingProviderRaw === 'openrouter' && openrouterKey ? 'openrouter'
                            : embeddingProviderRaw === 'pinecone' && pineKey ? 'pinecone'
                                : undefined;

            const queryVector = await getEmbedding('ping', {
                ...(embeddingProvider ? { provider: embeddingProvider as any } : {}),
                ...(embeddingProvider && embeddingModel ? { modelName: embeddingModel } : {}),
                geminiApiKey: geminiKey || undefined,
                openaiApiKey: openaiKey || undefined,
                openrouterApiKey: openrouterKey || undefined,
                pineconeApiKey: pineKey || undefined,
            });

            const client = await getMongoClient(mongoUri);
            const db = client.db(mongoDb);
            const col = db.collection('chunks');
            await col
                .aggregate([
                    {
                        $vectorSearch: {
                            index: atlasIndexName,
                            path: 'embedding',
                            queryVector,
                            numCandidates: 20,
                            limit: 1,
                        },
                    },
                    { $project: { _id: 1 } },
                ])
                .toArray();
        });
    }

    // 2. Check Pinecone Connection
    if (status.pinecone.apiKey) {
        status.pinecone.connection = await measure(async () => {
            const pinecone = await getPineconeClient(getConfig('PINECONE_API_KEY'));
            await pinecone.listIndexes();
        });
    } else {
        status.pinecone.connection = { status: 'error', latency: 0, message: 'Missing API Key' };
    }

    // 2.5 Check n8n Health (derived from N8N_WEBHOOK_URL)
    const n8nWebhookUrl = getConfig('N8N_WEBHOOK_URL');
    if (n8nWebhookUrl) {
        status.n8n.health = await measure(async () => {
            const u = new URL(n8nWebhookUrl);
            const healthUrl = `${u.protocol}//${u.host}/healthz`;
            const res = await fetch(healthUrl, { method: 'GET', cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        });
    } else {
        status.n8n.health = { status: 'missing', latency: 0, message: 'N8N_WEBHOOK_URL is not defined' };
    }

    // 3. Check LLMs individually

    // Gemini
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
    if (openaiKey) {
        status.llm.openai = await measure(async () => {
            const openai = new OpenAI({ apiKey: openaiKey });
            await openai.models.list();
        });
    } else {
        status.llm.openai = { status: 'missing', latency: 0, message: 'Key not set' };
    }

    // OpenRouter
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
