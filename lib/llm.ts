import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type LLMProvider = 'openai' | 'gemini' | 'openrouter';

interface LLMConfig {
    provider: LLMProvider;
    apiKey: string;
    model?: string;
}

export function getActiveProvider(): LLMProvider {
    if (process.env.LLM_PROVIDER) return process.env.LLM_PROVIDER as LLMProvider;
    if (process.env.OPENROUTER_API_KEY) return 'openrouter';
    if (process.env.OPENAI_API_KEY) return 'openai';
    if (process.env.GEMINI_API_KEY) return 'gemini';
    return 'openrouter'; // Default fallback
}

export async function generateText(prompt: string, config?: Partial<LLMConfig>): Promise<string> {
    const primaryProvider = config?.provider || getActiveProvider();

    // Define provider priority and availability
    const providers: LLMProvider[] = ([
        primaryProvider,
        'gemini',
        'openai',
        'openrouter'
    ] as LLMProvider[]).filter((p, index, self) => self.indexOf(p) === index); // Unique providers, starting with primary

    let lastError: Error | null = null;

    for (const provider of providers) {
        try {
            // Check if API key exists for this provider before trying
            if (!hasApiKey(provider)) {
                continue;
            }

            console.log(`Attempting generation with provider: ${provider}`);

            if (provider === 'gemini') {
                // For fallback, we might want to ignore the specific model if it was intended for another provider
                // But if it's the primary provider, we respect the config
                const model = provider === primaryProvider ? config?.model : undefined;
                return await generateGemini(prompt, model);
            } else if (provider === 'openai') {
                const model = provider === primaryProvider ? config?.model : undefined;
                return await generateOpenAI(prompt, model, false);
            } else {
                // OpenRouter
                const model = provider === primaryProvider ? config?.model : undefined;
                return await generateOpenAI(prompt, model, true);
            }
        } catch (error) {
            console.warn(`LLM Generation failed for provider ${provider}:`, error);
            lastError = error as Error;
            // Continue to next provider
        }
    }

    return `[AI Generation Failed: ${lastError?.message || 'No providers available'}]`;
}

function hasApiKey(provider: LLMProvider): boolean {
    switch (provider) {
        case 'gemini': return !!process.env.GEMINI_API_KEY;
        case 'openai': return !!process.env.OPENAI_API_KEY;
        case 'openrouter': return !!process.env.OPENROUTER_API_KEY;
        default: return false;
    }
}

async function generateGemini(prompt: string, modelName = 'gemini-1.5-flash') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

    // Handle OpenRouter style model names if passed to Gemini SDK
    if (modelName.startsWith('google/')) {
        modelName = modelName.replace('google/', '');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    return result.response.text();
}

async function generateOpenAI(prompt: string, modelName?: string, isOpenRouter = false) {
    const apiKey = isOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error(isOpenRouter ? 'OPENROUTER_API_KEY is not set' : 'OPENAI_API_KEY is not set');

    const baseURL = isOpenRouter ? 'https://openrouter.ai/api/v1' : undefined;
    const defaultModel = isOpenRouter ? 'meta-llama/llama-3-8b-instruct:free' : 'gpt-3.5-turbo';

    const openai = new OpenAI({
        apiKey,
        baseURL,
    });

    const completion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: modelName || defaultModel,
    });

    return completion.choices[0]?.message?.content || '';
}
