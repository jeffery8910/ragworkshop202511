import { generateText } from '@/lib/llm';
import { searchPinecone } from '@/lib/vector/pinecone';
import { saveMessage } from '@/lib/features/memory';
import { searchGraphContext, searchGraphEvidence } from '@/lib/features/graph-search';
import type { EmbeddingConfig, EmbeddingProvider } from '@/lib/vector/embedding';
import { planAgentic, type AgenticTrace, type AgenticTraceStep } from '@/lib/agentic';

export interface RagConfig {
  pineconeApiKey?: string;
  pineconeIndex?: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  openrouterApiKey?: string;
  embeddingProvider?: EmbeddingProvider;
  embeddingModel?: string;
  chatModel?: string;
  topK?: number;
  mongoUri?: string;
  mongoDbName?: string;
  agenticLevel?: number;
  useGraph?: boolean;
  displayQuestion?: string;
}

export async function ragAnswer(userId: string, question: string, config?: RagConfig) {
  // Helper to create LLM config
  const inferProviderFromModel = (model?: string): 'gemini' | 'openai' | 'openrouter' | undefined => {
    if (!model) return undefined;
    const m = model.toLowerCase();
    if (m.startsWith('gemini')) return 'gemini';
    if (m.startsWith('gpt') || m.startsWith('o') || m.startsWith('chatgpt')) return 'openai';
    if (m.includes('/')) return 'openrouter'; // openrouter models一般含 org/model
    return undefined;
  };

  const getLlmConfig = () => {
    const modelProvider = inferProviderFromModel(config?.chatModel);
    const provider: 'gemini' | 'openai' | 'openrouter' | undefined =
      modelProvider ||
      (config?.geminiApiKey ? 'gemini' :
        config?.openaiApiKey ? 'openai' :
          config?.openrouterApiKey ? 'openrouter' : undefined);

    if (provider === 'gemini' && config?.geminiApiKey) return { provider, apiKey: config.geminiApiKey, model: config?.chatModel };
    if (provider === 'openai' && config?.openaiApiKey) return { provider, apiKey: config.openaiApiKey, model: config?.chatModel };
    if (provider === 'openrouter' && config?.openrouterApiKey) return { provider, apiKey: config.openrouterApiKey, model: config?.chatModel };

    // No matching key for inferred provider
    if (provider) {
      throw new Error(`CHAT_MODEL 看起來是 ${provider} 模型，但缺少對應的 API Key，請在後台設定。`);
    }

    // Fallback: pick任一可用 key
    if (config?.geminiApiKey) return { provider: 'gemini' as const, apiKey: config.geminiApiKey, model: config?.chatModel };
    if (config?.openaiApiKey) return { provider: 'openai' as const, apiKey: config.openaiApiKey, model: config?.chatModel };
    if (config?.openrouterApiKey) return { provider: 'openrouter' as const, apiKey: config.openrouterApiKey, model: config?.chatModel };
    throw new Error('未設定可用的聊天模型金鑰，請在後台填入 Gemini/OpenAI/OpenRouter 的 API Key。');
  };

  const llmConfig = getLlmConfig();

  const vectorEnabled = !!config?.pineconeApiKey;

  // Prefer Pinecone inference for embeddings when key存在，避免跑到 Gemini/OpenRouter 出現模型不符
  const embeddingConfig: EmbeddingConfig | undefined = config
    ? {
      provider: config.pineconeApiKey ? 'pinecone' : config.embeddingProvider,
      pineconeApiKey: config.pineconeApiKey,
      geminiApiKey: config.geminiApiKey,
      openaiApiKey: config.openaiApiKey,
      openrouterApiKey: config.openrouterApiKey,
      modelName: config.pineconeApiKey ? (config.embeddingModel || 'multilingual-e5-large') : config.embeddingModel,
      desiredDim: 1024,
    }
    : undefined;

  const clampLevel = (value?: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(3, parsed));
  };

  const agenticLevel = clampLevel(config?.agenticLevel);
  const useGraph = config?.useGraph !== false;
  const searchParam = question;

  // 1. Agentic planning
  let searchQueries = [question];
  let needRetrieval = true;
  let followUpQuestion: string | undefined;
  let planReason: string | undefined;
  let planSubQuestions: string[] | undefined;
  const traceSteps: AgenticTraceStep[] = [];

  if (agenticLevel > 0) {
    const plan = await planAgentic(question, agenticLevel, llmConfig);
    searchQueries = plan.queries?.length ? plan.queries : [question];
    needRetrieval = plan.needRetrieval !== false;
    followUpQuestion = plan.followUp;
    planReason = plan.reason;
    planSubQuestions = plan.subQuestions;
    traceSteps.push({
      title: `Agentic L${agenticLevel} 規劃`,
      detail: planReason || (needRetrieval ? '判定需要檢索' : '判定可直接回答'),
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

  // 2. Vector Search (support multi-query)
  let results: { score?: number; text?: string; source?: string; page?: number; metadata?: any }[] = [];
  let context = '';
  const perQueryTopK = config?.topK || 5;
  const maxResults = Math.min(15, Math.max(5, perQueryTopK * Math.max(1, searchQueries.length)));
  const addResults = (items: typeof results) => {
    const map = new Map<string, typeof results[number]>();
    const makeKey = (r: typeof results[number]) => {
      const chunkId = r?.metadata?.chunk_id || r?.metadata?.chunkId;
      if (chunkId) return String(chunkId);
      const head = (r?.text || '').slice(0, 80);
      return `${r?.source || '未知來源'}::${r?.page ?? ''}::${head}`;
    };
    const addItem = (r: typeof results[number]) => {
      const key = makeKey(r);
      const prev = map.get(key);
      if (!prev || (r.score ?? 0) > (prev.score ?? 0)) {
        map.set(key, r);
      }
    };
    results.forEach(addItem);
    items.forEach(addItem);
    results = Array.from(map.values()).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, maxResults);
  };

  if (vectorEnabled && needRetrieval) {
    for (let i = 0; i < searchQueries.length; i += 1) {
      const q = searchQueries[i];
      const res = await searchPinecone(
        q,
        perQueryTopK,
        config?.pineconeApiKey,
        config?.pineconeIndex,
        embeddingConfig,
      );
      addResults(res);
      if (agenticLevel > 0) {
        traceSteps.push({
          title: `向量檢索 ${i + 1}`,
          detail: q,
          retrieved: res.length,
        });
      }
    }
  } else if (agenticLevel > 0) {
    traceSteps.push({
      title: '向量檢索',
      detail: vectorEnabled ? '已判定可直接回答' : '尚未設定 Pinecone API Key',
      retrieved: 0,
    });
  }

  if (agenticLevel > 0 && followUpQuestion && vectorEnabled && needRetrieval) {
    const needsSupplement = results.length < Math.max(3, Math.ceil(perQueryTopK / 2));
    if (needsSupplement) {
      const extra = await searchPinecone(
        followUpQuestion,
        Math.max(2, Math.ceil(perQueryTopK / 2)),
        config?.pineconeApiKey,
        config?.pineconeIndex,
        embeddingConfig,
      );
      addResults(extra);
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

  context = results.map(r => r.text).join('\n\n');

  // 2.5 Graph Search (Enhancement)
  let graphEvidence: any = undefined;
  let graphContextText = '';
  if (useGraph && (!agenticLevel || needRetrieval)) {
    try {
      graphEvidence = await searchGraphEvidence(question, { mongoUri: config?.mongoUri, dbName: config?.mongoDbName });
      graphContextText = await searchGraphContext(question, graphEvidence, { mongoUri: config?.mongoUri, dbName: config?.mongoDbName });
      if (graphContextText) {
        context += (context ? '\n\n' : '') + graphContextText;
      }
      if (agenticLevel > 0) {
        traceSteps.push({
          title: '圖譜檢索',
          detail: graphEvidence?.edges?.length ? '已補充圖譜關聯' : '沒有找到圖譜關聯',
          graphNodes: graphEvidence?.nodes?.length || 0,
          graphEdges: graphEvidence?.edges?.length || 0,
        });
      }
    } catch (err) {
      console.warn('Graph search failed, continuing with vector only', err);
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

  const contextBlock = context.trim().length ? context : '（目前沒有可用的參考資料）';

  // 3. Generate Answer
  const answerPrompt = `
    你是一個專業的家教。請根據以下參考資料回答問題。
    參考資料可能包含「文件片段」與「知識圖譜補充資訊」。
    如果資料不足，請誠實說不知道。
    若參考資料為空，請依一般常識回答，但避免捏造。

    [重要指令]
    如果使用者要求「測驗」、「題目」、「選擇題」或「考題」，請務必回傳一個 JSON 格式的測驗。
    JSON 格式如下：
    {
      "type": "quiz",
      "title": "測驗標題",
      "questions": [
        {
          "id": 1,
          "question": "題目內容",
          "options": ["選項A", "選項B", "選項C", "選項D"],
          "answer": "正確選項完整文字",
          "explanation": "解析"
        }
      ]
    }
    請確保回傳的是合法的 JSON 字串，不要使用三個反引號或任何 markdown code block 包住 JSON。
    如果使用者明確要求其他 JSON 卡片，請依下列格式回傳（同樣不可使用 Markdown）：
    - 概念卡片: {"type":"card","title":"主題","bullets":["重點1","重點2"],"highlight":"一句提醒"}
    - 對話摘要: {"type":"summary","title":"對話摘要","bullets":["重點1","重點2"],"highlight":"一句提醒"}
    - 問答卡: {"type":"card-qa","title":"主題","qa":[{"q":"問題1","a":"回答1"}],"highlight":"一句提醒"}
    - 能力分析: {"type":"ability","title":"學科能力分析","topics":[{"name":"主題","level":2,"progress":60}],"highlight":"一句提醒"}
    - 錯題分析: {"type":"mistake","title":"錯題分析","items":[{"topic":"主題","question":"題目","reason":"原因","suggestion":"建議"}],"highlight":"一句提醒"}
    如果不是測驗請求，則正常回答文字即可。
    
    參考資料：
    ${contextBlock}
    
    問題：${searchParam}
  `;

  let answer = await generateText(answerPrompt, llmConfig);

  const looksLikeJson = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
    return trimmed.includes('"type"');
  };

  const formatSources = (items: typeof results) => {
    if (!items.length) return '無（未檢索）';
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const item of items) {
      const name = item?.source || item?.metadata?.source || item?.metadata?.filename || '未知來源';
      const page = item?.page ?? item?.metadata?.page;
      const label = `${name}${page !== undefined ? ` p.${page}` : ''}`;
      if (!seen.has(label)) {
        seen.add(label);
        lines.push(`${lines.length + 1}. ${label}`);
      }
      if (lines.length >= 5) break;
    }
    return lines.join('\n');
  };

  if (agenticLevel > 0 && followUpQuestion && typeof answer === 'string' && !looksLikeJson(answer)) {
    answer = `${answer.trim()}\n\n追問：${followUpQuestion}`;
  }

  if (agenticLevel > 0 && typeof answer === 'string' && !looksLikeJson(answer)) {
    if (!answer.includes('參考來源')) {
      answer = `${answer.trim()}\n\n參考來源：\n${formatSources(results)}`;
    }
  }

  if (agenticLevel > 0) {
    traceSteps.push({
      title: '回答生成',
      detail: `引用 ${results.length} 段資料${graphContextText ? ' + 圖譜補充' : ''}`,
    });
  }

  // 4. Save History
  try {
    const displayQuestion = typeof config?.displayQuestion === 'string' && config.displayQuestion.trim().length
      ? config.displayQuestion.trim()
      : question;
    await saveMessage(userId, 'user', displayQuestion, {
      mongoUri: config?.mongoUri,
      dbName: config?.mongoDbName
    });
    await saveMessage(userId, 'assistant', answer, {
      mongoUri: config?.mongoUri,
      dbName: config?.mongoDbName
    });
  } catch (err) {
    console.warn('Skipping history save because MongoDB is not configured or unreachable.', err);
  }

  return {
    answer,
    context: results,
    rewrittenQuery: searchParam !== question ? searchParam : undefined,
    graphEvidence,
    structuredPayloads: undefined, // reserved for future enrichment by caller
    agenticTrace: agenticLevel > 0 ? ({ level: agenticLevel, steps: traceSteps } as AgenticTrace) : undefined,
  };
}
