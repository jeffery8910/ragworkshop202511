import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ragAnswer } from '@/lib/rag';
import { getConversationTitle, saveConversationTitle } from '@/lib/features/memory';
import { generateText } from '@/lib/llm';
import type { EmbeddingProvider } from '@/lib/vector/embedding';
import { saveCard, pruneCards, logCardError } from '@/lib/features/cards';
import { z } from 'zod';
import { generateAndSaveShortMemory } from '@/lib/features/memoryCards';

export async function POST(req: NextRequest) {
    try {
        const { message, userId } = await req.json();

        const cookieStore = await cookies();
        // Use a fixed userId for web demo if not provided
        const uid = userId || cookieStore.get('line_user_id')?.value || 'web-user-demo';
        if (!uid) {
            return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
        }

        // Extract config from cookies

        const embeddingProviderCookie = cookieStore.get('EMBEDDING_PROVIDER')?.value;
        const validEmbeddingProviders: EmbeddingProvider[] = ['gemini', 'openai', 'openrouter', 'pinecone'];
        const embeddingProvider = validEmbeddingProviders.includes(
            embeddingProviderCookie as EmbeddingProvider,
        )
            ? (embeddingProviderCookie as EmbeddingProvider)
            : undefined;

        const config = {
            pineconeIndex: cookieStore.get('PINECONE_INDEX_NAME')?.value || process.env.PINECONE_INDEX_NAME,
            geminiApiKey: cookieStore.get('GEMINI_API_KEY')?.value || process.env.GEMINI_API_KEY,
            openaiApiKey: cookieStore.get('OPENAI_API_KEY')?.value || process.env.OPENAI_API_KEY,
            openrouterApiKey: cookieStore.get('OPENROUTER_API_KEY')?.value || process.env.OPENROUTER_API_KEY,
            pineconeApiKey: cookieStore.get('PINECONE_API_KEY')?.value || process.env.PINECONE_API_KEY,
            embeddingProvider,
            embeddingModel: cookieStore.get('EMBEDDING_MODEL')?.value || process.env.EMBEDDING_MODEL,
            chatModel: cookieStore.get('CHAT_MODEL')?.value || process.env.CHAT_MODEL,
            topK: cookieStore.get('RAG_TOP_K')?.value
                ? parseInt(cookieStore.get('RAG_TOP_K')?.value!)
                : (process.env.RAG_TOP_K ? parseInt(process.env.RAG_TOP_K) : 5),
            mongoUri: cookieStore.get('MONGODB_URI')?.value || process.env.MONGODB_URI,
            mongoDbName: cookieStore.get('MONGODB_DB_NAME')?.value || process.env.MONGODB_DB_NAME,
        };

        // Validate chat model against provider to avoid unsupported IDs or embeddings
        const validateChatModel = (provider?: string, model?: string) => {
            if (!model) return true; // nothing to validate yet
            const m = model.toLowerCase();
            if (m.includes('embedding') || m.includes('embed') || m.includes('rerank')) return false;
            if (!provider) return true; // allow if provider not deduced yet
            if (provider === 'gemini') return m.startsWith('gemini');
            if (provider === 'openai') return m.startsWith('gpt') || m.startsWith('o') || m.startsWith('chatgpt');
            if (provider === 'openrouter') return true; // already filter embeddings out in model list API
            // pinecone or other providers are not valid chat providers
            return false;
        };

        // Validate embedding model/provider pairing
        const validateEmbeddingModel = (provider?: EmbeddingProvider, model?: string) => {
            if (!model || !provider) return true;
            const m = model.toLowerCase();
            if (provider === 'gemini') return m.includes('embedding') || m.startsWith('text-embedding');
            if (provider === 'openai') return m.includes('embedding');
            if (provider === 'openrouter') return true; // openrouter list already filtered
            if (provider === 'pinecone') return true; // rely on inference model list; we accept any provided
            return true;
        };

        const providerForChat = config.geminiApiKey
            ? 'gemini'
            : config.openaiApiKey
                ? 'openai'
                : config.openrouterApiKey
                    ? 'openrouter'
                    : undefined;

        if (!validateChatModel(providerForChat, config.chatModel)) {
            return NextResponse.json({
                error: 'RAG Lab CHAT_MODEL 與供應商不匹配，或為 embedding / rerank 型模型，請重新選擇聊天模型。'
            }, { status: 400 });
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
                await pruneCards(uid, 50, { mongoUri: config.mongoUri, dbName: config.mongoDbName });
            }
            // Generate & persist short-term memory summary card for dashboard reuse
            await generateAndSaveShortMemory(uid, { mongoUri: config.mongoUri, dbName: config.mongoDbName });
        } catch (err) {
            console.warn('Failed to save cards', err);
            await logCardError(uid, err instanceof Error ? err.message : 'unknown card save error', { payloads }, { mongoUri: config.mongoUri, dbName: config.mongoDbName });
        }

        return NextResponse.json({ ...result, structuredPayloads: payloads, newTitle });
    } catch (error) {
        console.error('Chat API Error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
    }
}
