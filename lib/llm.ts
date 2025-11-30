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
    const providerList: LLMProvider[] = config?.provider
        ? [config.provider]
        : [primaryProvider, 'gemini', 'openai', 'openrouter'];
    const providers = providerList.filter(
        (p, index, self) => self.indexOf(p) === index
    ); // Unique providers, starting with primary

    let lastError: Error | null = null;

    for (const provider of providers) {
        try {
            // Check if API key exists for this provider before trying
            if (!hasApiKey(provider, config)) {
                throw new Error(`Missing API key for provider ${provider}`);
            }

            console.log(`Attempting generation with provider: ${provider}`);

            if (provider === 'gemini') {
                // For fallback, we might want to ignore the specific model if it was intended for another provider
                // But if it's the primary provider, we respect the config
                const model = provider === primaryProvider ? config?.model : undefined;
                return await generateGemini(prompt, model, config?.apiKey);
            } else if (provider === 'openai') {
                const model = provider === primaryProvider ? config?.model : undefined;
                return await generateOpenAI(prompt, model, false, config?.apiKey);
            } else {
                // OpenRouter
                const model = provider === primaryProvider ? config?.model : undefined;
                return await generateOpenAI(prompt, model, true, config?.apiKey);
            }
        } catch (error) {
            console.warn(`LLM Generation failed for provider ${provider}:`, error);
            lastError = error as Error;
            // Continue to next provider
        }
    }

    if (!lastError) {
        return '[AI Error: No AI model providers are configured. Please set up an API key in the Admin Panel.]';
    }

    return `[AI Generation Failed: ${lastError.message}]`;
}

function hasApiKey(provider: LLMProvider, config?: Partial<LLMConfig>): boolean {
    // Check config first if it matches the provider
    if (config?.provider === provider && config.apiKey) return true;

    // Then check specific config keys if passed (not implemented in interface but good practice)
    // Or check environment variables
    switch (provider) {
        case 'gemini': return !!process.env.GEMINI_API_KEY || (config?.provider === 'gemini' && !!config.apiKey);
        case 'openai': return !!process.env.OPENAI_API_KEY || (config?.provider === 'openai' && !!config.apiKey);
        case 'openrouter': return !!process.env.OPENROUTER_API_KEY || (config?.provider === 'openrouter' && !!config.apiKey);
        default: return false;
    }
}

async function generateGemini(prompt: string, modelName = 'gemini-1.5-flash', apiKeyOverride?: string) {
    const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY;
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

async function generateOpenAI(prompt: string, modelName?: string, isOpenRouter = false, apiKeyOverride?: string) {
    const apiKey = apiKeyOverride || (isOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY);
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
