export interface KeywordRule {
    keyword: string;
    type: 'exact' | 'fuzzy';
    action: 'reply' | 'n8n' | 'rag';
    replyText?: string; // For 'reply' action
    n8nUrl?: string;    // For 'n8n' action
}

// Mock database or config for now. In real app, fetch from MongoDB.
const MOCK_RULES: KeywordRule[] = [
    { keyword: 'ping', type: 'exact', action: 'reply', replyText: 'Pong! 系統運作正常。' },
    { keyword: 'help', type: 'exact', action: 'reply', replyText: '輸入「測驗」開始測驗，或直接問問題。' },
    { keyword: '測驗', type: 'fuzzy', action: 'rag' }, // Special handling in webhook
];

export async function findKeywordMatch(text: string): Promise<KeywordRule | null> {
    const normalized = text.trim().toLowerCase();

    // 1. Exact Match
    const exact = MOCK_RULES.find(r => r.type === 'exact' && r.keyword === normalized);
    if (exact) return exact;

    // 2. Fuzzy Match
    const fuzzy = MOCK_RULES.find(r => r.type === 'fuzzy' && normalized.includes(r.keyword));
    if (fuzzy) return fuzzy;

    return null;
}
