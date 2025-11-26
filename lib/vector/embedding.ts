import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type EmbeddingProvider = 'openai' | 'gemini' | 'openrouter';

export interface EmbeddingConfig {
    provider?: EmbeddingProvider;
    openaiApiKey?: string;
    geminiApiKey?: string;
    openrouterApiKey?: string;
}

export async function getEmbedding(text: string, config?: EmbeddingConfig): Promise<number[]> {
    const primaryProvider = config?.provider || getActiveEmbeddingProvider();

    // Define provider priority and availability
    const providers: EmbeddingProvider[] = ([
        primaryProvider,
        'gemini',
        'openai',
        'openrouter',
    ] as EmbeddingProvider[]).filter((p, index, self) => self.indexOf(p) === index); // Unique providers, starting with primary

    let lastError: Error | null = null;

    for (const provider of providers) {
        try {
            // Check if API key exists for this provider before trying
            if (!hasEmbeddingApiKey(provider, config)) {
                continue;
            }

            console.log(`Attempting embedding with provider: ${provider}`);

            if (provider === 'gemini') {
                return await generateGeminiEmbedding(text, config?.geminiApiKey);
            } else if (provider === 'openai') {
                return await generateOpenAIEmbedding(text, config?.openaiApiKey);
            } else if (provider === 'openrouter') {
                return await generateOpenRouterEmbedding(text, config?.openrouterApiKey);
            }
        } catch (error) {
            console.warn(`Embedding generation failed for provider ${provider}:`, error);
            lastError = error as Error;
            // Continue to next provider
        }
    }

    // Return dummy embedding if all providers fail
    console.warn('All embedding providers failed, returning dummy embedding');
    return new Array(1536).fill(0);
}

function getActiveEmbeddingProvider(): EmbeddingProvider {
    if (process.env.EMBEDDING_PROVIDER) {
        const envProvider = process.env.EMBEDDING_PROVIDER as EmbeddingProvider;
        if ((['gemini', 'openai', 'openrouter'] as EmbeddingProvider[]).includes(envProvider)) {
            return envProvider;
        }
    }

    if (process.env.OPENROUTER_API_KEY) return 'openrouter';
    if (process.env.GEMINI_API_KEY) return 'gemini';
    if (process.env.OPENAI_API_KEY) return 'openai';
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
        default:
            return false;
    }
}

async function generateGeminiEmbedding(text: string, apiKey?: string): Promise<number[]> {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY is not set');

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    
    const result = await model.embedContent(text);
    return result.embedding.values;
}

async function generateOpenAIEmbedding(text: string, apiKey?: string): Promise<number[]> {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is not set');

    const openai = new OpenAI({
        apiKey: key,
    });

    const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.replace(/\n/g, ' '),
    });

    return response.data[0].embedding;
}

async function generateOpenRouterEmbedding(text: string, apiKey?: string): Promise<number[]> {
    const key = apiKey || process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY is not set');

    const openai = new OpenAI({
        apiKey: key,
        baseURL: 'https://openrouter.ai/api/v1',
    });

    const response = await openai.embeddings.create({
        model: 'openai/text-embedding-3-small',
        input: text.replace(/\n/g, ' '),
    });

    return response.data[0].embedding;
}
