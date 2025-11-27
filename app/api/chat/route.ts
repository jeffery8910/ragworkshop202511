import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ragAnswer } from '@/lib/rag';
import { getConversationTitle, saveConversationTitle } from '@/lib/features/memory';
import { generateText } from '@/lib/llm';
import type { EmbeddingProvider } from '@/lib/vector/embedding';
import { saveCard } from '@/lib/features/cards';
import { z } from 'zod';

export async function POST(req: NextRequest) {
    try {
        const { message, userId } = await req.json();

        // Use a fixed userId for web demo if not provided
        const uid = userId || 'web-user-demo';

        // Extract config from cookies
        const cookieStore = await cookies();

        const embeddingProviderCookie = cookieStore.get('EMBEDDING_PROVIDER')?.value;
        const validEmbeddingProviders: EmbeddingProvider[] = ['gemini', 'openai', 'openrouter'];
        const embeddingProvider = validEmbeddingProviders.includes(
            embeddingProviderCookie as EmbeddingProvider,
        )
            ? (embeddingProviderCookie as EmbeddingProvider)
            : undefined;

        const config = {
            pineconeApiKey: cookieStore.get('PINECONE_API_KEY')?.value,
            pineconeIndex: cookieStore.get('PINECONE_INDEX_NAME')?.value,
            geminiApiKey: cookieStore.get('GEMINI_API_KEY')?.value,
            openaiApiKey: cookieStore.get('OPENAI_API_KEY')?.value,
            openrouterApiKey: cookieStore.get('OPENROUTER_API_KEY')?.value,
            embeddingProvider,
            embeddingModel: cookieStore.get('EMBEDDING_MODEL')?.value,
            chatModel: cookieStore.get('CHAT_MODEL')?.value,
            topK: cookieStore.get('RAG_TOP_K')?.value ? parseInt(cookieStore.get('RAG_TOP_K')?.value!) : 5,
            mongoUri: cookieStore.get('MONGODB_URI')?.value,
            mongoDbName: cookieStore.get('MONGODB_DB_NAME')?.value,
        };

        // Validate chat model against provider to avoid unsupported IDs or embeddings
        const validateChatModel = (provider?: string, model?: string) => {
            if (!model || !provider) return true; // allow fallback to default behavior
            const m = model.toLowerCase();
            if (m.includes('embedding') || m.includes('embed') || m.includes('rerank')) return false;
            if (provider === 'gemini') return m.startsWith('gemini');
            if (provider === 'openai') return m.startsWith('gpt') || m.startsWith('o') || m.startsWith('chatgpt');
            if (provider === 'openrouter') return true; // already filter embeddings out in model list API
            return true;
        };

        // Validate embedding model/provider pairing
        const validateEmbeddingModel = (provider?: EmbeddingProvider, model?: string) => {
            if (!model || !provider) return true;
            const m = model.toLowerCase();
            if (provider === 'gemini') return m.includes('embedding') || m.startsWith('text-embedding');
            if (provider === 'openai') return m.includes('embedding');
            if (provider === 'openrouter') return true; // openrouter list already filtered
            return true;
        };

        if (!validateChatModel(
            config.geminiApiKey ? 'gemini' : config.openaiApiKey ? 'openai' : config.openrouterApiKey ? 'openrouter' : undefined,
            config.chatModel
        )) {
            return NextResponse.json({ error: 'CHAT_MODEL 與供應商不匹配，或為 embedding / rerank 型模型。請重新選擇。' }, { status: 400 });
        }

        if (!validateEmbeddingModel(config.embeddingProvider, config.embeddingModel)) {
            return NextResponse.json({ error: 'EMBEDDING_MODEL 與供應商不匹配，請重新選擇。' }, { status: 400 });
        }

        const result = await ragAnswer(uid, message, config);

        // Server-side structured payload parsing for persistence
        const quizSchema = z.object({
            type: z.literal('quiz'),
            title: z.string(),
            questions: z.array(z.object({
                id: z.union([z.number(), z.string()]),
                question: z.string(),
                options: z.array(z.string()).min(2),
                answer: z.string(),
                explanation: z.string()
            })).min(1)
        });
        const conceptSchema = z.object({
            type: z.literal('card'),
            title: z.string(),
            bullets: z.array(z.string()).min(1),
            highlight: z.string().optional()
        });
        const summarySchema = z.object({
            type: z.literal('summary'),
            title: z.string(),
            bullets: z.array(z.string()).min(1),
            highlight: z.string().optional()
        });
        const qaCardSchema = z.object({
            type: z.literal('card-qa'),
            title: z.string(),
            qa: z.array(z.object({ q: z.string(), a: z.string() })).min(1),
            highlight: z.string().optional()
        });
        const abilitySchema = z.object({
            type: z.literal('ability'),
            title: z.string().optional(),
            topics: z.array(z.object({
                name: z.string(),
                level: z.number().optional(),
                progress: z.number().optional()
            })).min(1),
            highlight: z.string().optional()
        });
        const mistakeSchema = z.object({
            type: z.literal('mistake'),
            title: z.string().optional(),
            items: z.array(z.object({
                topic: z.string().optional(),
                question: z.string(),
                reason: z.string().optional(),
                suggestion: z.string().optional()
            })).min(1),
            highlight: z.string().optional()
        });

        const tryParsePayload = (text?: string) => {
            if (!text) return undefined;
            const match = text.match(/\{[\s\S]*\}/);
            if (!match) return undefined;
            try {
                const parsed = JSON.parse(match[0]);
                if (quizSchema.safeParse(parsed).success) return quizSchema.parse(parsed);
                if (conceptSchema.safeParse(parsed).success) return conceptSchema.parse(parsed);
                if (summarySchema.safeParse(parsed).success) return summarySchema.parse(parsed);
                if (qaCardSchema.safeParse(parsed).success) return qaCardSchema.parse(parsed);
                if (abilitySchema.safeParse(parsed).success) return abilitySchema.parse(parsed);
                if (mistakeSchema.safeParse(parsed).success) return mistakeSchema.parse(parsed);
            } catch (err) {
                console.warn('Server payload parse failed', err);
            }
            return undefined;
        };

        const payloads: any[] = [];
        const p = tryParsePayload(result?.answer);
        if (p) payloads.push(p);

        // Check and generate title if needed
        let newTitle = undefined;
        const currentTitle = await getConversationTitle(uid, {
            mongoUri: config.mongoUri,
            dbName: config.mongoDbName
        });
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
            await saveConversationTitle(uid, title.trim(), {
                mongoUri: config.mongoUri,
                dbName: config.mongoDbName
            });
            newTitle = title.trim();
        }

        // Persist structured cards if present
        try {
            const cardPayloads = payloads.length ? payloads : result?.structuredPayloads as any[] | undefined;
            if (cardPayloads?.length) {
                for (const payload of cardPayloads) {
                    await saveCard(uid, payload, { mongoUri: config.mongoUri, dbName: config.mongoDbName });
                }
            }
        } catch (err) {
            console.warn('Failed to save cards', err);
        }

        return NextResponse.json({ ...result, structuredPayloads: payloads, newTitle });
    } catch (error) {
        console.error('Chat API Error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
    }
}
