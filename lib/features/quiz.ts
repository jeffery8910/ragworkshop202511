import { generateText } from '@/lib/llm';

export interface Quiz {
    question: string;
    options: string[];
    correct_index: number;
    explanation: string;
}

export async function generateRagQuiz(topic: string): Promise<Quiz> {
    const prompt = `
    你是一個專業的家教老師。請針對主題「${topic}」出一個單選題。
    
    請嚴格遵守以下 JSON 格式回傳，不要有任何 Markdown 標記或額外文字：
    {
      "question": "題目內容",
      "options": ["選項A", "選項B", "選項C", "選項D"],
      "correct_index": 0,
      "explanation": "詳解"
    }
  `;

    const raw = await generateText(prompt, { model: 'google/gemini-flash-1.5' }); // Use fast model

    try {
        // Clean up potential markdown code blocks
        const jsonStr = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('Failed to parse quiz JSON', raw);
        return {
            question: `關於 ${topic} 的測驗生成失敗，請稍後再試。`,
            options: ['重試', '取消'],
            correct_index: 0,
            explanation: '系統忙碌中'
        };
    }
}
