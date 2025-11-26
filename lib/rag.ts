import { generateText } from '@/lib/llm';
import { searchPinecone } from '@/lib/vector/pinecone';
import { getConversationHistory, saveMessage } from '@/lib/features/memory';
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
  // Helper to create LLM config
  const getLlmConfig = () => {
    if (config?.geminiApiKey) return { provider: 'gemini' as const, apiKey: config.geminiApiKey, model: config.chatModel };
    if (config?.openaiApiKey) return { provider: 'openai' as const, apiKey: config.openaiApiKey, model: config.chatModel };
    if (config?.openrouterApiKey) return { provider: 'openrouter' as const, apiKey: config.openrouterApiKey, model: config.chatModel };
    return { model: config?.chatModel };
  };

  const llmConfig = getLlmConfig();

  const embeddingConfig: EmbeddingConfig | undefined = config
    ? {
      provider: config.embeddingProvider,
      geminiApiKey: config.geminiApiKey,
      openaiApiKey: config.openaiApiKey,
      openrouterApiKey: config.openrouterApiKey,
      modelName: config.embeddingModel,
    }
    : undefined;

  // 1. Get History & Rewrite Query
  let history: { role: 'user' | 'assistant'; content: string; }[] = [];
  try {
    history = await getConversationHistory(userId, 5, {
      mongoUri: config?.mongoUri,
      dbName: config?.mongoDbName
    });
  } catch (err) {
    console.warn('Skipping conversation history because MongoDB is not configured or unreachable.', err);
  }
  let searchParam = question;

  if (history.length > 0) {
    const rewritePrompt = `
      請根據對話歷史，重寫使用者的最新問題，使其包含完整上下文。
      歷史：${JSON.stringify(history)}
      最新問題：${question}
      
      只回傳重寫後的問題，不要有其他文字。
    `;
    // Use the configured chat model for rewriting as well, or fallback to a cheap one if not specified
    searchParam = await generateText(rewritePrompt, { ...llmConfig });
  }

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
    rewrittenQuery: searchParam !== question ? searchParam : undefined
  };
}
