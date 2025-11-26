import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type LLMProvider = 'openai' | 'gemini' | 'openrouter';

interface LLMConfig {
    provider: LLMProvider;
    apiKey: string;
    model?: string;
}

export async function generateText(prompt: string, config?: Partial<LLMConfig>): Promise<string> {
    const provider = config?.provider || (process.env.LLM_PROVIDER as LLMProvider) || 'openrouter';

    try {
        if (provider === 'gemini') {
            return await generateGemini(prompt, config?.model);
        } else if (provider === 'openai') {
            return await generateOpenAI(prompt, config?.model, false);
        } else {
            // Default to OpenRouter (uses OpenAI client structure)
            return await generateOpenAI(prompt, config?.model, true);
        }
    } catch (error) {
        console.warn(`LLM Generation failed for provider ${provider}:`, error);
        return `[AI Generation Failed: ${(error as Error).message}]`;
    }
}

async function generateGemini(prompt: string, modelName = 'gemini-1.5-flash') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

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
