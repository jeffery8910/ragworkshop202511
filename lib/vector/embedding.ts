import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type EmbeddingProvider = 'openai' | 'gemini' | 'openrouter' | 'pinecone';

export interface EmbeddingConfig {
    provider?: EmbeddingProvider;
    openaiApiKey?: string;
    geminiApiKey?: string;
    openrouterApiKey?: string;
    pineconeApiKey?: string;
    modelName?: string;
    desiredDim?: number; // optional target dimension to pad/trim embeddings
}

export async function getEmbedding(text: string, config?: EmbeddingConfig): Promise<number[]> {
    const primaryProvider = config?.provider || getActiveEmbeddingProvider();

    // Define provider priority and availability
    const providers: EmbeddingProvider[] = ([
        primaryProvider,
        'gemini',
        'openai',
        'openrouter',
        'pinecone',
    ] as EmbeddingProvider[]).filter((p, index, self) => self.indexOf(p) === index); // Unique providers, starting with primary

    let lastError: Error | null = null;

    for (const provider of providers) {
        try {
            // Check if API key exists for this provider before trying
            if (!hasEmbeddingApiKey(provider, config)) {
                continue;
            }

            console.log(`Attempting embedding with provider: ${provider}`);

            let vec: number[] | null = null;
            if (provider === 'gemini') {
                vec = await generateGeminiEmbedding(text, config?.geminiApiKey, config?.modelName);
            } else if (provider === 'openai') {
                vec = await generateOpenAIEmbedding(text, config?.openaiApiKey, config?.modelName);
            } else if (provider === 'openrouter') {
                vec = await generateOpenRouterEmbedding(text, config?.openrouterApiKey, config?.modelName);
            } else if (provider === 'pinecone') {
                vec = await generatePineconeEmbedding(text, config?.pineconeApiKey, config?.modelName);
            }

            if (vec) {
                vec = vec.map(Number); // ensure mutable number[]
                const desired = config?.desiredDim;
                if (desired && desired > 0) {
                    if (vec.length > desired) vec = vec.slice(0, desired);
                    else if (vec.length < desired) vec = [...vec, ...new Array(desired - vec.length).fill(0)];
                }
                // Avoid all-zero vectors which Pinecone rejects for dense mode
                if (vec.every(v => v === 0)) {
                    (vec as number[])[0] = 1e-8;
                }
                return vec;
            }
        } catch (error) {
            console.warn(`Embedding generation failed for provider ${provider}:`, error);
            lastError = error as Error;
            // Continue to next provider
        }
    }

    // If all providers failed, bubble up error instead of returning dummy
    throw lastError || new Error('All embedding providers failed');
}

function getActiveEmbeddingProvider(): EmbeddingProvider {
    if (process.env.EMBEDDING_PROVIDER) {
        const envProvider = process.env.EMBEDDING_PROVIDER as EmbeddingProvider;
        if ((['gemini', 'openai', 'openrouter', 'pinecone'] as EmbeddingProvider[]).includes(envProvider)) {
            return envProvider;
        }
    }

    if (process.env.OPENROUTER_API_KEY) return 'openrouter';
    if (process.env.GEMINI_API_KEY) return 'gemini';
    if (process.env.OPENAI_API_KEY) return 'openai';
    if (process.env.PINECONE_API_KEY) return 'pinecone';
    return 'openai'; // Default fallback
}

function hasEmbeddingApiKey(provider: EmbeddingProvider, config?: EmbeddingConfig): boolean {
    switch (provider) {
        case 'gemini':
            return !!(config?.geminiApiKey || process.env.GEMINI_API_KEY);
        case 'openai':
            return !!(config?.openaiApiKey || process.env.OPENAI_API_KEY);
        case 'openrouter':
            return !!(config?.openrouterApiKey || process.env.OPENROUTER_API_KEY);
        case 'pinecone':
            return !!(config?.pineconeApiKey || process.env.PINECONE_API_KEY);
        default:
            return false;
    }
}

async function generateGeminiEmbedding(text: string, apiKey?: string, modelName?: string): Promise<number[]> {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY is not set');

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: modelName || 'text-embedding-004' });

    const result = await model.embedContent(text);
    return result.embedding.values;
}

async function generateOpenAIEmbedding(text: string, apiKey?: string, modelName?: string): Promise<number[]> {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is not set');

    const openai = new OpenAI({
        apiKey: key,
    });

    const response = await openai.embeddings.create({
        model: modelName || 'text-embedding-3-small',
        input: text.replace(/\n/g, ' '),
    });

    return response.data[0].embedding;
}

async function generateOpenRouterEmbedding(text: string, apiKey?: string, modelName?: string): Promise<number[]> {
    const key = apiKey || process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY is not set');

    const openai = new OpenAI({
        apiKey: key,
        baseURL: 'https://openrouter.ai/api/v1',
    });

    const response = await openai.embeddings.create({
        model: modelName || 'openai/text-embedding-3-small',
        input: text.replace(/\n/g, ' '),
    });

    return response.data[0].embedding;
}

async function generatePineconeEmbedding(text: string, apiKey?: string, modelName?: string): Promise<number[]> {
    const key = apiKey || process.env.PINECONE_API_KEY;
    if (!key) throw new Error('PINECONE_API_KEY is not set');
    const allowed = ['multilingual-e5-large', 'llama-text-embed-v2'];
    const model = modelName || 'multilingual-e5-large';
    if (!allowed.includes(model)) {
        throw new Error(`Pinecone inference currently只支援 ${allowed.join(', ')}，請調整 EMBEDDING_MODEL 或改用其他 provider`);
    }

    const res = await fetch('https://api.pinecone.io/embed', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Api-Key': key,
            'X-Pinecone-Api-Version': '2025-01',
        },
        body: JSON.stringify({
            model,
            inputs: [text.replace(/\n/g, ' ')],
            parameters: {
                input_type: 'passage',
                truncate: 'END',
            },
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        if (res.status === 404) {
            throw new Error(`Pinecone inference 404：常見原因為 model 名稱不受支援（目前僅 ${allowed.join(' / ')}），或專案未開啟 Inference。回應: ${body || '空白'}`);
        }
        throw new Error(`Pinecone inference error (${res.status} ${res.statusText}): ${body || 'empty body'}`);
    }
    const data = await res.json();
    const embedding = data?.data?.[0]?.values;
    if (!embedding) throw new Error('Pinecone inference returned empty embedding');
    return embedding;
}
