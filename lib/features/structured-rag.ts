import { generateText } from '@/lib/llm';

export type StructureType = 'summary' | 'table' | 'timeline';

export async function generateStructuredResponse(context: string, type: StructureType, topic: string) {
    let prompt = '';

    if (type === 'summary') {
        prompt = `
      請根據以下資料，針對主題「${topic}」產生一個重點摘要。
      資料：${context}
      
      請回傳 JSON 格式：
      {
        "title": "標題",
        "summary": "一句話總結",
        "points": ["重點1", "重點2", "重點3"]
      }
    `;
    } else if (type === 'table') {
        prompt = `
      請根據以下資料，針對主題「${topic}」產生一個比較表。
      資料：${context}
      
      請回傳 JSON 格式：
      {
        "title": "比較表標題",
        "headers": ["欄位1", "欄位2", "欄位3"],
        "rows": [
          ["列1-1", "列1-2", "列1-3"],
          ["列2-1", "列2-2", "列2-3"]
        ]
      }
    `;
    } else if (type === 'timeline') {
        prompt = `
      請根據以下資料，針對主題「${topic}」產生一個時間軸。
      資料：${context}
      
      請回傳 JSON 格式：
      {
        "title": "時間軸標題",
        "events": [
          { "date": "日期/時間", "event": "事件內容" },
          { "date": "日期/時間", "event": "事件內容" }
        ]
      }
    `;
    }

    const raw = await generateText(prompt, { model: 'google/gemini-flash-1.5' });

    try {
        const jsonStr = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('Failed to parse structured JSON', raw);
        return null;
    }
}
