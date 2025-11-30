import { generateText } from '@/lib/llm';
import { searchPinecone } from '@/lib/vector/pinecone';
import { saveMessage } from '@/lib/features/memory';
import type { EmbeddingConfig, EmbeddingProvider } from '@/lib/vector/embedding';

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
}

export async function ragAnswer(userId: string, question: string, config?: RagConfig) {
  if (!config?.pineconeApiKey) {
    throw new Error('缺少 PINECONE_API_KEY，無法執行檢索。請在後台設定 Pinecone key 與 index。');
  }

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

  // 1. Query without rewrite (依使用者需求直接使用原始問題)
  const searchParam = question;

  // 2. Vector Search
  const results = await searchPinecone(
    searchParam,
    config?.topK || 5,
    config?.pineconeApiKey,
    config?.pineconeIndex,
    embeddingConfig,
  );
  const context = results.map(r => r.text).join('\n\n');

  // 3. Generate Answer
  const answerPrompt = `
    你是一個專業的家教。請根據以下參考資料回答問題。
    如果資料不足，請誠實說不知道。

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
    如果不是測驗請求，則正常回答文字即可。
    
    參考資料：
    ${context}
    
    問題：${searchParam}
  `;

  const answer = await generateText(answerPrompt, llmConfig);

  // 4. Save History
  try {
    await saveMessage(userId, 'user', question, {
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
    structuredPayloads: undefined // reserved for future enrichment by caller
  };
}
