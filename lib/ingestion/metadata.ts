import { generateText } from '@/lib/llm';

export interface Metadata {
    keywords: string[];
    summary: string;
    questions: string[]; // Hypothetical questions
}

export async function extractMetadata(text: string): Promise<Metadata> {
    const prompt = `
    請分析以下文本，並產生元數據 (Metadata)。
    文本：${text.substring(0, 2000)}... (截斷)

    請回傳 JSON 格式：
    {
      "keywords": ["關鍵字1", "關鍵字2", "關鍵字3"],
      "summary": "一句話摘要",
      "questions": ["這段文字在講什麼？", "關鍵概念是什麼？"]
    }
  `;

    const raw = await generateText(prompt, { model: 'google/gemini-flash-1.5' });

    try {
        const jsonStr = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('Failed to extract metadata', raw);
        return { keywords: [], summary: '', questions: [] };
    }
}
