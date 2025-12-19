import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { searchPinecone } from '@/lib/vector/pinecone';
import { searchGraphContext, searchGraphEvidence } from '@/lib/features/graph-search';
import { generateText } from '@/lib/llm';

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
        const get = (key: string) => cookieStore.get(key)?.value || process.env[key] || '';

        const pineconeApiKey = get('PINECONE_API_KEY');
        const pineconeIndex = get('PINECONE_INDEX_NAME') || 'rag-index';
        if (!pineconeApiKey) {
            return NextResponse.json({ error: 'PINECONE_API_KEY is not set' }, { status: 400 });
        }

        const mongoUri = get('MONGODB_URI');
        const mongoDb = get('MONGODB_DB_NAME') || 'rag_db';

        const topK = Number(body?.topK || get('RAG_TOP_K') || 5);
        const embeddingModel = get('EMBEDDING_MODEL') || 'multilingual-e5-large';
        const chatModel = get('CHAT_MODEL') || '';
        const includeAnswer = body?.includeAnswer !== false;
        const rewrite = !!body?.rewrite;
        const useGraph = body?.useGraph !== false;

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

        let rewrittenQuery: string | undefined;
        if (rewrite && llmConfig?.apiKey) {
            const rewritePrompt = `請將以下問題改寫為更適合向量檢索的搜尋句，保持原意，20 字以內：\n問題：${query}\n改寫：`;
            try {
                rewrittenQuery = (await generateText(rewritePrompt, llmConfig)).trim();
            } catch (err) {
                console.warn('Query rewrite failed, fallback to original query', err);
            }
        }

        const searchQuery = rewrittenQuery || query;
        const context = await searchPinecone(
            searchQuery,
            Number.isFinite(topK) ? Math.max(1, topK) : 5,
            pineconeApiKey,
            pineconeIndex,
            { modelName: embeddingModel, provider: 'pinecone', pineconeApiKey, desiredDim: 1024 }
        );

        let graphContext = '';
        let graphEvidence: any = undefined;
        let matchedNodeIds: string[] | undefined = undefined;
        let graphDocIds: string[] | undefined = undefined;
        if (useGraph) {
            try {
                graphEvidence = await searchGraphEvidence(searchQuery, { mongoUri, dbName: mongoDb });
                graphContext = graphEvidence?.edges?.length
                    ? await searchGraphContext(searchQuery, graphEvidence, { mongoUri, dbName: mongoDb })
                    : '';
                matchedNodeIds = graphEvidence?.matchedNodeIds || [];
                const docSet = new Set<string>();
                graphEvidence?.nodes?.forEach((n: any) => n.docId && docSet.add(n.docId));
                graphEvidence?.edges?.forEach((e: any) => e.docId && docSet.add(e.docId));
                graphDocIds = [...docSet];
            } catch (err) {
                console.warn('Graph context search failed', err);
            }
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

        return NextResponse.json({
            query,
            rewrittenQuery,
            context,
            graphContext: graphContext || undefined,
            graphEvidence: graphEvidence || undefined,
            matchedNodeIds,
            graphDocIds,
            answer,
        });
    } catch (error: any) {
        console.error('Retrieve error', error);
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
    }
}
