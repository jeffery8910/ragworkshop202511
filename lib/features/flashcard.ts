import { generateText } from '@/lib/llm';

type LlmConfig = {
    provider?: 'openai' | 'gemini' | 'openrouter';
    apiKey?: string;
    model?: string;
};

export interface Flashcard {
    title: string;
    keyword: string;
    definition: string;
    example: string;
    color: string;
}

export async function generateFlashcard(topic: string, config?: LlmConfig): Promise<Flashcard> {
    const prompt = `
    請針對主題「${topic}」製作一張重點單字卡。
    
    請回傳 JSON 格式：
    {
      "title": "卡片標題 (例如：微積分基礎)",
      "keyword": "核心關鍵字 (例如：極限)",
      "definition": "簡短定義 (50字內)",
      "example": "一個生活化或簡單的例子",
      "color": "推薦色碼 (例如 #FF5733)"
    }
  `;

    const raw = await generateText(prompt, config || {});

    try {
        const jsonStr = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        return {
            title: topic,
            keyword: topic,
            definition: '生成失敗',
            example: '請稍後再試',
            color: '#CCCCCC'
        };
    }
}
