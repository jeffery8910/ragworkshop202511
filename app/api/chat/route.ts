import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ragAnswer } from '@/lib/rag';
import { getConversationTitle, saveConversationTitle } from '@/lib/features/memory';
import { generateText } from '@/lib/llm';

export async function POST(req: NextRequest) {
    try {
        const { message, userId } = await req.json();

        // Use a fixed userId for web demo if not provided
        const uid = userId || 'web-user-demo';

        // Extract config from cookies
        const cookieStore = await cookies();
        const config = {
            pineconeApiKey: cookieStore.get('PINECONE_API_KEY')?.value,
            pineconeIndex: cookieStore.get('PINECONE_INDEX_NAME')?.value,
            geminiApiKey: cookieStore.get('GEMINI_API_KEY')?.value,
            openaiApiKey: cookieStore.get('OPENAI_API_KEY')?.value,
            openrouterApiKey: cookieStore.get('OPENROUTER_API_KEY')?.value,
            topK: cookieStore.get('RAG_TOP_K')?.value ? parseInt(cookieStore.get('RAG_TOP_K')?.value!) : 5
        };

        const result = await ragAnswer(uid, message, config);

        // Check and generate title if needed
        let newTitle = undefined;
        const currentTitle = await getConversationTitle(uid);
        if (!currentTitle) {
            const titlePrompt = `
            請根據使用者的問題，生成一個簡短的對話標題 (5個字以內)。
            問題：${message}
            標題：`;

            // Use same LLM config for title generation
            const llmConfig = {
                provider: config.geminiApiKey ? 'gemini' : config.openaiApiKey ? 'openai' : config.openrouterApiKey ? 'openrouter' : undefined,
                apiKey: config.geminiApiKey || config.openaiApiKey || config.openrouterApiKey
            } as any; // Type casting for simplicity here, ideally strict typed

            const title = await generateText(titlePrompt, { ...llmConfig, model: 'google/gemini-flash-1.5' });
            await saveConversationTitle(uid, title.trim());
            newTitle = title.trim();
        }

        return NextResponse.json({ ...result, newTitle });
    } catch (error) {
        console.error('Chat API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
