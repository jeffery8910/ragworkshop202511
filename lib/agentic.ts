import { generateText } from '@/lib/llm';

export interface AgenticPlan {
  needRetrieval: boolean;
  queries: string[];
  followUp?: string;
  reason?: string;
  subQuestions?: string[];
}

export interface AgenticTraceStep {
  title: string;
  detail?: string;
  queries?: string[];
  retrieved?: number;
  graphNodes?: number;
  graphEdges?: number;
}

export interface AgenticTrace {
  level: number;
  steps: AgenticTraceStep[];
}

export interface AgenticLlmConfig {
  provider?: 'gemini' | 'openai' | 'openrouter';
  apiKey?: string;
  model?: string;
}

const clampLevel = (level?: number) => {
  const parsed = Number(level);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(3, parsed));
};

const normalizeList = (value: any) => {
  if (Array.isArray(value)) {
    return value.map(v => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(/[\n,]/).map(v => v.trim()).filter(Boolean);
  }
  return [] as string[];
};

const findJsonObject = (text: string) => {
  const starts: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '{') starts.push(i);
  }
  for (const start of starts) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          return text.slice(start, i + 1);
        }
      }
    }
  }
  return null;
};

export const parseAgenticPlan = (raw: string, question: string, level?: number): AgenticPlan => {
  const fallback: AgenticPlan = {
    needRetrieval: true,
    queries: [question],
  };

  const json = findJsonObject(raw || '');
  if (!json) return fallback;
  try {
    const parsed = JSON.parse(json);
    const queries = normalizeList(parsed.queries);
    const subQuestions = normalizeList(parsed.sub_questions || parsed.subQuestions);
    const needRetrieval = typeof parsed.need_retrieval === 'boolean'
      ? parsed.need_retrieval
      : queries.length > 0;
    const followUp = typeof parsed.follow_up === 'string' ? parsed.follow_up.trim() : undefined;
    const reason = typeof parsed.reason === 'string' ? parsed.reason.trim() : undefined;
    const lv = clampLevel(level);
    const maxPrimary = lv <= 1 ? 2 : 3;
    const maxTotal = lv >= 3 ? 4 : maxPrimary;
    const uniq = new Set<string>();
    const merged: string[] = [];
    const push = (q: string) => {
      if (!q) return;
      if (uniq.has(q)) return;
      uniq.add(q);
      merged.push(q);
    };
    queries.forEach(push);
    if (lv >= 3) {
      subQuestions.forEach(push);
    }
    const finalQueries = merged.length ? merged.slice(0, maxTotal) : [question];
    return {
      needRetrieval,
      queries: finalQueries,
      followUp: followUp || undefined,
      reason,
      subQuestions: subQuestions.length ? subQuestions.slice(0, 3) : undefined,
    };
  } catch (err) {
    return fallback;
  }
};

export async function planAgentic(question: string, level: number, llmConfig?: AgenticLlmConfig): Promise<AgenticPlan> {
  const lv = clampLevel(level);
  if (!llmConfig?.apiKey || lv === 0) {
    return { needRetrieval: true, queries: [question] };
  }

  const prompt = `你是 RAG Agent 規劃器。請只輸出 JSON（不要加 Markdown）。\n\n需求：\n- need_retrieval: 是否需要查詢知識庫\n- queries: 1~${lv === 1 ? 2 : 3} 個適合向量檢索的搜尋句（短、精準）\n- follow_up: 若需向使用者追問，提供一句追問（可空）\n- reason: 20 字內理由\n${lv >= 3 ? '- sub_questions: 1~3 個多跳子問題（可空）\n' : ''}\n\n使用者問題：${question}\n\n請輸出：{\n  "need_retrieval": true/false,\n  "queries": ["..."],\n  "follow_up": "...",\n  "reason": "..."${lv >= 3 ? ',\n  "sub_questions": ["..."]' : ''}\n}`;

  try {
    const raw = await generateText(prompt, llmConfig);
    return parseAgenticPlan(raw, question, lv);
  } catch (err) {
    return { needRetrieval: true, queries: [question] };
  }
}
