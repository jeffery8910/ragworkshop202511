import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getConfigValue } from '@/lib/config-store';
import { searchPinecone } from '@/lib/vector/pinecone';
import { searchAtlas } from '@/lib/vector/atlas';
import { resolveVectorStoreProvider } from '@/lib/vector/store';
import type { EmbeddingProvider } from '@/lib/vector/embedding';
import { searchGraphContext, searchGraphEvidence } from '@/lib/features/graph-search';
import { generateText } from '@/lib/llm';
import { planAgentic, type AgenticTrace, type AgenticTraceStep } from '@/lib/agentic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Provider = 'gemini' | 'openai' | 'openrouter' | undefined;

const inferProviderFromModel = (model?: string): Provider => {
    if (!model) return undefined;
    const m = model.toLowerCase();
    if (m.startsWith('gemini')) return 'gemini';
    if (m.startsWith('gpt') || m.startsWith('o') || m.startsWith('chatgpt')) return 'openai';
    if (m.includes('/')) return 'openrouter';
    return undefined;
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const query = (body?.query || '').toString().trim();
        if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 });

        const cookieStore = await cookies();
        const get = (key: string) => cookieStore.get(key)?.value || getConfigValue(key) || process.env[key] || '';

        const pineconeApiKey = get('PINECONE_API_KEY');
        const pineconeIndex = get('PINECONE_INDEX_NAME') || 'rag-index';

        const mongoUri = get('MONGODB_URI');
        const mongoDb = get('MONGODB_DB_NAME') || 'rag_db';

        const vectorStore = resolveVectorStoreProvider({
            explicit: get('VECTOR_STORE_PROVIDER'),
            pineconeApiKey,
            mongoUri,
        });
        if (!vectorStore) {
            return NextResponse.json({ error: 'No vector store configured (need PINECONE_API_KEY or MONGODB_URI)' }, { status: 400 });
        }
        if (vectorStore === 'pinecone' && !pineconeApiKey) {
            return NextResponse.json({ error: 'VECTOR_STORE_PROVIDER=pinecone but PINECONE_API_KEY is not set' }, { status: 400 });
        }
        if (vectorStore === 'atlas' && !mongoUri) {
            return NextResponse.json({ error: 'VECTOR_STORE_PROVIDER=atlas but MONGODB_URI is not set' }, { status: 400 });
        }

        const topK = Math.max(1, Math.min(50, Number(body?.topK || get('RAG_TOP_K') || 5)));
        const embeddingModel = get('EMBEDDING_MODEL') || '';
        const chatModel = get('CHAT_MODEL') || '';
        const includeAnswer = body?.includeAnswer !== false;
        const rewrite = !!body?.rewrite;
        const useGraph = body?.useGraph !== false;

        const clampLevel = (value: any) => {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) return 0;
            return Math.max(0, Math.min(3, parsed));
        };
        const agenticLevel = clampLevel(body?.agenticLevel);

        const geminiApiKey = get('GEMINI_API_KEY');
        const openaiApiKey = get('OPENAI_API_KEY');
        const openrouterApiKey = get('OPENROUTER_API_KEY');

        const providerFromModel = inferProviderFromModel(chatModel);
        const provider: Provider =
            providerFromModel ||
            (geminiApiKey ? 'gemini' : openaiApiKey ? 'openai' : openrouterApiKey ? 'openrouter' : undefined);

        const llmConfig = provider === 'gemini'
            ? { provider, apiKey: geminiApiKey, model: chatModel }
            : provider === 'openai'
                ? { provider, apiKey: openaiApiKey, model: chatModel }
                : provider === 'openrouter'
                    ? { provider, apiKey: openrouterApiKey, model: chatModel }
                    : undefined;

        const embeddingProviderRaw = (get('EMBEDDING_PROVIDER') || '').trim().toLowerCase();
        const embeddingProvider: EmbeddingProvider | undefined =
            embeddingProviderRaw === 'gemini' || embeddingProviderRaw === 'openai' || embeddingProviderRaw === 'openrouter' || embeddingProviderRaw === 'pinecone'
                ? (embeddingProviderRaw as EmbeddingProvider)
                : undefined;
        const embeddingProviderForAtlas: EmbeddingProvider | undefined =
            embeddingProvider === 'gemini' && geminiApiKey ? 'gemini'
                : embeddingProvider === 'openai' && openaiApiKey ? 'openai'
                    : embeddingProvider === 'openrouter' && openrouterApiKey ? 'openrouter'
                        : embeddingProvider === 'pinecone' && pineconeApiKey ? 'pinecone'
                            : undefined;

        const searchVector = async (q: string, k: number) => {
            if (vectorStore === 'pinecone') {
                return searchPinecone(
                    q,
                    k,
                    pineconeApiKey,
                    pineconeIndex,
                    { modelName: (embeddingModel || 'multilingual-e5-large'), provider: 'pinecone', pineconeApiKey, desiredDim: 1024 }
                );
            }
            return searchAtlas(q, k, {
                mongoUri,
                dbName: mongoDb,
                indexName: get('ATLAS_VECTOR_INDEX_NAME') || undefined,
                embeddingConfig: {
                    ...(embeddingProviderForAtlas ? { provider: embeddingProviderForAtlas } : {}),
                    ...(embeddingProviderForAtlas && embeddingModel ? { modelName: embeddingModel } : {}),
                    geminiApiKey,
                    openaiApiKey,
                    openrouterApiKey,
                    pineconeApiKey,
                },
            });
        };

        let rewrittenQuery: string | undefined;
        if (rewrite && llmConfig?.apiKey) {
            const rewritePrompt = `請將以下問題改寫為更適合向量檢索的搜尋句，保持原意，20 字以內：\n問題：${query}\n改寫：`;
            try {
                rewrittenQuery = (await generateText(rewritePrompt, llmConfig)).trim();
            } catch (err) {
                console.warn('Query rewrite failed, fallback to original query', err);
            }
        }

        const baseQuery = rewrittenQuery || query;

        let searchQueries = [baseQuery];
        let needRetrieval = true;
        let followUpQuestion: string | undefined;
        let planSubQuestions: string[] | undefined;
        const traceSteps: AgenticTraceStep[] = [];

        if (agenticLevel > 0) {
            const plan = await planAgentic(baseQuery, agenticLevel, llmConfig);
            searchQueries = plan.queries?.length ? plan.queries : [baseQuery];
            needRetrieval = plan.needRetrieval !== false;
            followUpQuestion = plan.followUp;
            planSubQuestions = plan.subQuestions;
            traceSteps.push({
                title: `Agentic L${agenticLevel} 規劃`,
                detail: plan.reason || (needRetrieval ? '判定需要檢索' : '判定可直接回答'),
                queries: searchQueries,
            });
            if (agenticLevel >= 3) {
                traceSteps.push({
                    title: '工具規劃',
                    detail: '向量檢索 / 圖譜檢索 / 回答生成',
                });
            }
            if (agenticLevel >= 3 && planSubQuestions?.length) {
                traceSteps.push({
                    title: '多跳子問題',
                    detail: planSubQuestions.join(' / '),
                });
            }
        }

        const context: Array<{ score: number; text: string; source: string; page?: number; metadata?: any }> = [];
        const mergedKey = (item: any) => `${item.source || ''}::${(item.text || '').slice(0, 80)}`;
        const seen = new Set<string>();
        const mergeResults = (items: any[]) => {
            for (const item of items || []) {
                const key = mergedKey(item);
                if (seen.has(key)) continue;
                seen.add(key);
                context.push(item);
            }
        };

        const perQueryTopK = Math.max(1, Math.ceil(topK / Math.max(1, searchQueries.length)));

        if (!agenticLevel || needRetrieval) {
            const settled = await Promise.allSettled(
                searchQueries.map(async (q) => {
                    const res = await searchVector(q, perQueryTopK);
                    return { q, res };
                })
            );

            for (let i = 0; i < settled.length; i += 1) {
                const item = settled[i];
                const q = searchQueries[i];
                if (item.status === 'fulfilled') {
                    mergeResults(item.value.res);
                    if (agenticLevel > 0) {
                        traceSteps.push({
                            title: `向量檢索 ${i + 1}`,
                            detail: item.value.q,
                            retrieved: item.value.res.length,
                        });
                    }
                } else if (agenticLevel > 0) {
                    traceSteps.push({
                        title: `向量檢索 ${i + 1}`,
                        detail: q,
                        retrieved: 0,
                    });
                }
            }
        } else if (agenticLevel > 0) {
            traceSteps.push({
                title: '向量檢索',
                detail: '已判定可直接回答',
                retrieved: 0,
            });
        }

        if (agenticLevel > 0 && followUpQuestion && needRetrieval) {
            const needsSupplement = context.length < Math.max(3, Math.ceil(perQueryTopK / 2));
            if (needsSupplement) {
                const extra = await searchVector(followUpQuestion, Math.max(2, Math.ceil(perQueryTopK / 2)));
                mergeResults(extra);
                traceSteps.push({
                    title: '補充檢索',
                    detail: followUpQuestion,
                    retrieved: extra.length,
                });
                followUpQuestion = undefined;
            }
        }

        if (agenticLevel > 0 && followUpQuestion) {
            traceSteps.push({
                title: '追問建議',
                detail: followUpQuestion,
            });
        }

        let graphContext = '';
        let graphEvidence: any = undefined;
        let matchedNodeIds: string[] | undefined = undefined;
        let graphDocIds: string[] | undefined = undefined;
        if (useGraph && (!agenticLevel || needRetrieval)) {
            try {
                graphEvidence = await searchGraphEvidence(baseQuery, { mongoUri, dbName: mongoDb });
                graphContext = graphEvidence?.edges?.length
                    ? await searchGraphContext(baseQuery, graphEvidence, { mongoUri, dbName: mongoDb })
                    : '';
                matchedNodeIds = graphEvidence?.matchedNodeIds || [];
                const docSet = new Set<string>();
                graphEvidence?.nodes?.forEach((n: any) => n.docId && docSet.add(n.docId));
                graphEvidence?.edges?.forEach((e: any) => e.docId && docSet.add(e.docId));
                graphDocIds = [...docSet];
                if (agenticLevel > 0) {
                    traceSteps.push({
                        title: '圖譜檢索',
                        detail: graphEvidence?.edges?.length ? '已補充圖譜關聯' : '沒有找到圖譜關聯',
                        graphNodes: graphEvidence?.nodes?.length || 0,
                        graphEdges: graphEvidence?.edges?.length || 0,
                    });
                }
            } catch (err) {
                console.warn('Graph context search failed', err);
                if (agenticLevel > 0) {
                    traceSteps.push({
                        title: '圖譜檢索',
                        detail: '圖譜查詢失敗',
                    });
                }
            }
        } else if (agenticLevel > 0) {
            traceSteps.push({
                title: '圖譜檢索',
                detail: useGraph ? '已判定可直接回答' : '圖譜 RAG 關閉',
            });
        }

        let answer = '';
        if (includeAnswer) {
            if (!llmConfig?.apiKey) {
                return NextResponse.json({ error: '缺少聊天模型 API Key，無法生成回答' }, { status: 400 });
            }
            const ctxText = context.map(c => c.text).join('\n\n');
            const answerPrompt = `
你是一個專業的家教。請根據以下參考資料回答問題。
參考資料可能包含「文件片段」與「知識圖譜補充資訊」。
如果資料不足，請誠實說不知道。

參考資料：
${ctxText}
${graphContext}

問題：${query}
`;
            answer = await generateText(answerPrompt, llmConfig);
        }

        if (agenticLevel > 0 && followUpQuestion && answer) {
            answer = `${answer.trim()}\n\n追問：${followUpQuestion}`;
        }
        if (agenticLevel > 0) {
            traceSteps.push({
                title: '回答生成',
                detail: `引用 ${context.length} 段資料${graphContext ? ' + 圖譜補充' : ''}`,
            });
        }

        return NextResponse.json({
            query,
            rewrittenQuery,
            context,
            graphContext: graphContext || undefined,
            graphEvidence: graphEvidence || undefined,
            matchedNodeIds,
            graphDocIds,
            answer,
            agenticTrace: agenticLevel > 0 ? ({ level: agenticLevel, steps: traceSteps } as AgenticTrace) : undefined,
        });
    } catch (error: any) {
        console.error('Workshop retrieve error', error);
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
    }
}
