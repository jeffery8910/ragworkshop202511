import { getMongoClient } from '@/lib/db/mongo';
import { generateText } from '@/lib/llm';
import { getConversationHistory } from '@/lib/features/memory';

export interface MemoryCardPayload {
  type: 'summary';
  title: string;
  bullets: string[];
  highlight?: string;
}

interface SaveMemoryOpts {
  mongoUri?: string;
  dbName?: string;
}

export async function saveShortTermMemoryCard(userId: string, recentMessages: { role: string; content: string }[], opts?: SaveMemoryOpts) {
  // Build prompt for short summary card
  const transcript = recentMessages.map(m => `${m.role}: ${m.content}`).join('\n');
  const prompt = `
你是一個助教，請將以下對話整理為 JSON 摘要卡：
{
  "type": "summary",
  "title": "對話摘要",
  "bullets": ["重點1","重點2","重點3"],
  "highlight": "一句提醒"
}
只回傳 JSON，不能有 Markdown。

對話：
${transcript}
`;
  const summaryText = await generateText(prompt, {});
  // Try parse JSON
  try {
    const jsonMatch = summaryText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;
    const payload = JSON.parse(jsonMatch[0]) as MemoryCardPayload;
    if (payload.type !== 'summary' || !Array.isArray(payload.bullets)) return;
    const client = await getMongoClient(opts?.mongoUri);
    const db = client.db(opts?.dbName || process.env.MONGODB_DB_NAME || 'rag_workshop');
    await db.collection('cards').insertOne({
      userId,
      type: 'summary',
      payload,
      createdAt: new Date(),
      scope: 'short_term'
    });
  } catch (err) {
    console.warn('saveShortTermMemoryCard failed', err);
  }
}

export async function generateAndSaveShortMemory(userId: string, opts?: SaveMemoryOpts) {
  const history = await getConversationHistory(userId, 10, { mongoUri: opts?.mongoUri, dbName: opts?.dbName });
  if (!history.length) return;
  await saveShortTermMemoryCard(userId, history, opts);
}
