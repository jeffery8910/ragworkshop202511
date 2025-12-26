import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ragAnswer } from '@/lib/rag';
import { getConversationTitle, saveConversationTitle } from '@/lib/features/memory';
import { generateText } from '@/lib/llm';
import type { EmbeddingProvider } from '@/lib/vector/embedding';
import { saveCard, pruneCards, logCardError } from '@/lib/features/cards';
import { getConfigValue } from '@/lib/config-store';
import { z } from 'zod';
import { generateAndSaveShortMemory } from '@/lib/features/memoryCards';
import { logConversation } from '@/lib/features/logs';

export async function POST(req: NextRequest) {
    let uid = '';
    let userMessage = '';
    try {
        const body = await req.json().catch(() => ({} as any));
        const message = body?.message;
        const userId = body?.userId;
        const agenticLevel = body?.agenticLevel;
        const client = body?.client as { kind?: string; displayText?: string } | undefined;
        const safeMessage = typeof message === 'string' ? message.trim() : '';
        userMessage = safeMessage;

        const cookieStore = await cookies();
        uid = userId || cookieStore.get('line_user_id')?.value || cookieStore.get('rag_user_id')?.value || '';
        if (!uid) {
            return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
        }
        if (!safeMessage) {
            return NextResponse.json({ error: 'message is required.' }, { status: 400 });
        }

        // Extract config from cookies
        const readConfig = (key: string) =>
            cookieStore.get(key)?.value || getConfigValue(key) || process.env[key];

        const embeddingProviderCookie = readConfig('EMBEDDING_PROVIDER');
        const validEmbeddingProviders: EmbeddingProvider[] = ['gemini', 'openai', 'openrouter', 'pinecone'];
        const embeddingProvider = validEmbeddingProviders.includes(
            embeddingProviderCookie as EmbeddingProvider,
        )
            ? (embeddingProviderCookie as EmbeddingProvider)
            : undefined;

        const topKRaw = readConfig('RAG_TOP_K');
        const parsedTopK = topKRaw ? parseInt(topKRaw, 10) : NaN;

        const clampLevel = (value: any) => {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) return 0;
            return Math.max(0, Math.min(3, parsed));
        };

        const normalizeTitleSeed = (value: string) => {
            return String(value || '')
                .replace(/\s+/g, ' ')
                .replace(/中\.{3,}$/g, '')
                .replace(/中…+$/g, '')
                .trim();
        };

        const clientKind = client?.kind === 'quickAction' || client?.kind === 'teachingPrompt' ? client.kind : 'free';
        const displayText = typeof client?.displayText === 'string' && client.displayText.trim().length
            ? client.displayText.trim()
            : safeMessage;
        const titleSeed = normalizeTitleSeed(displayText || safeMessage);

        const config = {
            pineconeIndex: readConfig('PINECONE_INDEX_NAME'),
            geminiApiKey: readConfig('GEMINI_API_KEY'),
            openaiApiKey: readConfig('OPENAI_API_KEY'),
            openrouterApiKey: readConfig('OPENROUTER_API_KEY'),
            pineconeApiKey: readConfig('PINECONE_API_KEY'),
            embeddingProvider,
            embeddingModel: readConfig('EMBEDDING_MODEL'),
            chatModel: readConfig('CHAT_MODEL'),
            topK: Number.isNaN(parsedTopK) ? 5 : parsedTopK,
            mongoUri: readConfig('MONGODB_URI'),
            mongoDbName: readConfig('MONGODB_DB_NAME'),
            agenticLevel: clampLevel(agenticLevel),
            displayQuestion: titleSeed,
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

        const detectProviderFromModel = (model?: string): ('gemini' | 'openai' | 'openrouter' | undefined) => {
            if (!model) return undefined;
            const m = model.toLowerCase();
            if (m.startsWith('gemini')) return 'gemini';
            if (m.startsWith('gpt') || m.startsWith('o') || m.startsWith('chatgpt')) return 'openai';
            if (m.includes('/')) return 'openrouter'; // openrouter models often have org/model
            return undefined;
        };

        const providerFromModel = detectProviderFromModel(config.chatModel);
        const providerFromKeys = config.geminiApiKey
            ? 'gemini'
            : config.openaiApiKey
                ? 'openai'
                : config.openrouterApiKey
                    ? 'openrouter'
                    : undefined;

        const providerForChat = providerFromModel || providerFromKeys;

        if (!validateChatModel(providerForChat, config.chatModel)) {
            return NextResponse.json({
                error: 'RAG 教學坊 CHAT_MODEL 與供應商不匹配，或為 embedding / rerank 型模型，請重新選擇聊天模型。'
            }, { status: 400 });
        }

        if (!validateEmbeddingModel(config.embeddingProvider, config.embeddingModel)) {
            return NextResponse.json({ error: 'EMBEDDING_MODEL 與供應商不匹配，請重新選擇。' }, { status: 400 });
        }

        if (titleSeed) {
            await logConversation({ type: 'message', userId: uid, text: titleSeed });
        }

        const result = await ragAnswer(uid, safeMessage, config);

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

        // Check and generate title if needed (best-effort)
        let newTitle = undefined;
        try {
            const currentTitle = await getConversationTitle(uid, {
                mongoUri: config.mongoUri,
                dbName: config.mongoDbName
            });
            if (!currentTitle) {
                const llmConfig = {
                    provider: providerForChat,
                    apiKey: providerForChat === 'gemini' ? config.geminiApiKey
                        : providerForChat === 'openai' ? config.openaiApiKey
                            : providerForChat === 'openrouter' ? config.openrouterApiKey
                                : undefined,
                    model: config.chatModel,
                } as any;

                const seed = titleSeed || safeMessage;
                const buildDirectTitle = () => {
                    if (clientKind === 'quickAction') {
                        if (seed.includes('測驗')) return '小測驗練習';
                        if (seed.includes('摘要')) return '對話摘要';
                        if (seed.includes('概念')) return '概念卡片';
                        if (seed.includes('問答')) return '問答卡片';
                        if (seed.includes('能力')) return '能力分析';
                        if (seed.includes('錯題')) return '錯題分析';
                        return seed.slice(0, 12) || '快捷練習';
                    }
                    if (clientKind === 'teachingPrompt') {
                        if (seed.includes('要點')) return '要點整理';
                        if (seed.includes('改寫')) return '白話改寫';
                        if (seed.includes('小測驗')) return '小測驗練習';
                        if (seed.includes('比較')) return '比較練習';
                        return seed.slice(0, 12) || '教學練習';
                    }
                    return '';
                };

                const directTitle = buildDirectTitle();
                const titlePrompt = `你是「RAG 教學坊」的對話標題產生器。\n請用「摘要式」命名，12 字以內。\n規則：\n- 只輸出標題文字（不要加引號/句號/emoji）\n- 用名詞片語，不要完整句子\n- 避免語助詞（例如：請問、可以嗎、要不要）\n- 若輸入是功能按鈕（測驗/摘要/卡片/比較），請用「練習/整理」的名詞片語表達\n\n輸入：${seed}\n標題：`;

                const sanitizeTitle = (raw: string) => {
                    const firstLine = String(raw || '').trim().split('\n')[0] || '';
                    const cleaned = firstLine
                        .replace(/^[「『"'\[]+/, '')
                        .replace(/[」』"'\]]+$/, '')
                        .replace(/[。．.]+$/g, '')
                        .trim();
                    if (!cleaned) return '';
                    if (cleaned.includes('[AI')) return '';
                    return cleaned.slice(0, 20);
                };

                let title = '';
                if (directTitle) {
                    title = directTitle;
                } else if (llmConfig?.apiKey) {
                    title = sanitizeTitle(await generateText(titlePrompt, llmConfig));
                }
                if (!title) {
                    title = seed.slice(0, 12) || '新對話';
                }

                await saveConversationTitle(uid, title.trim(), {
                    mongoUri: config.mongoUri,
                    dbName: config.mongoDbName
                });
                newTitle = title.trim();
            }
        } catch (titleErr) {
            console.warn('Skip title generation', titleErr);
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

        if (result?.answer) {
            await logConversation({ type: 'reply', userId: uid, text: result.answer });
        }

        const res = NextResponse.json({ ...result, structuredPayloads: payloads, newTitle });
        if (!cookieStore.get('line_user_id')?.value && uid) {
            const isHttps = req.headers.get('x-forwarded-proto') === 'https';
            const secure = process.env.NODE_ENV === 'production' ? isHttps : false;
            res.cookies.set('rag_user_id', uid, {
                httpOnly: true,
                secure,
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 30,
                path: '/',
            });
        }
        return res;
    } catch (error) {
        console.error('Chat API Error:', error);
        if (uid) {
            await logConversation({
                type: 'error',
                userId: uid,
                text: error instanceof Error ? error.message : 'Internal Server Error',
                meta: { message: userMessage }
            });
        }
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
    }
}
