import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateRagQuiz } from '@/lib/features/quiz';
import { getConfigValue } from '@/lib/config-store';
import { logConversation } from '@/lib/features/logs';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get('topic');
    const userId = searchParams.get('userId');

    if (!topic) {
        return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const readConfig = (key: string) =>
        cookieStore.get(key)?.value || getConfigValue(key) || process.env[key];
    const geminiApiKey = readConfig('GEMINI_API_KEY');
    const openaiApiKey = readConfig('OPENAI_API_KEY');
    const openrouterApiKey = readConfig('OPENROUTER_API_KEY');
    const chatModel = readConfig('CHAT_MODEL');
    const mongoUri = readConfig('MONGODB_URI');
    const dbName = readConfig('MONGODB_DB_NAME') || 'rag_db';

    const detectProviderFromModel = (model?: string): ('gemini' | 'openai' | 'openrouter' | undefined) => {
        if (!model) return undefined;
        const m = model.toLowerCase();
        if (m.startsWith('gemini')) return 'gemini';
        if (m.startsWith('gpt') || m.startsWith('o') || m.startsWith('chatgpt')) return 'openai';
        if (m.includes('/')) return 'openrouter';
        return undefined;
    };

    const providerFromModel = detectProviderFromModel(chatModel);
    const providerFromKeys = geminiApiKey ? 'gemini' : openaiApiKey ? 'openai' : openrouterApiKey ? 'openrouter' : undefined;
    const provider = providerFromModel || providerFromKeys;
    const apiKey = provider === 'gemini'
        ? geminiApiKey
        : provider === 'openai'
            ? openaiApiKey
            : provider === 'openrouter'
                ? openrouterApiKey
                : undefined;

    const quiz = await generateRagQuiz(topic, { provider, apiKey, model: chatModel });

    const resolvedUserId =
        userId || cookieStore.get('line_user_id')?.value || cookieStore.get('rag_user_id')?.value || '';
    if (resolvedUserId && mongoUri) {
        await logConversation({
            type: 'event',
            userId: resolvedUserId,
            text: '[quiz_generate]',
            meta: { event: 'quiz_generate', topic }
        }, { mongoUri, dbName });
    }

    return NextResponse.json(quiz);
}
