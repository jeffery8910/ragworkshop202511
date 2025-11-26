import { generateText } from '@/lib/llm';
import { searchPinecone } from '@/lib/vector/pinecone';
import { getConversationHistory, saveMessage } from '@/lib/features/memory';

export async function ragAnswer(userId: string, question: string) {
    // 1. Get History & Rewrite Query
    const history = await getConversationHistory(userId);
    let searchParam = question;

    if (history.length > 0) {
        const rewritePrompt = `
      請根據對話歷史，重寫使用者的最新問題，使其包含完整上下文。
      歷史：${JSON.stringify(history)}
      最新問題：${question}
      
      只回傳重寫後的問題，不要有其他文字。
    `;
        searchParam = await generateText(rewritePrompt, { model: 'google/gemini-flash-1.5' });
    }

    // 2. Vector Search
    const results = await searchPinecone(searchParam);
    const context = results.map(r => r.text).join('\n\n');

    // 3. Generate Answer
    const answerPrompt = `
    你是一個專業的家教。請根據以下參考資料回答問題。
    如果資料不足，請誠實說不知道。
    
    參考資料：
    ${context}
    
    問題：${searchParam}
  `;

    const answer = await generateText(answerPrompt);

    // 4. Save History
    await saveMessage(userId, 'user', question);
    await saveMessage(userId, 'assistant', answer);

    return { answer, context: results };
}
