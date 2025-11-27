'use client';

import { useState } from 'react';
import { Search, Loader2, Database, MessageSquare, ArrowRight, Zap } from 'lucide-react';

interface RagResult {
    answer: string;
    context: Array<{
        score: number;
        text: string;
        source: string;
        page?: number;
    }>;
    rewrittenQuery?: string;
}

export default function RagLabPanel() {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<RagResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setResult(null);
        setError(null);

        try {
            // We reuse the chat API but we might need to adjust it to return debug info
            // The chat API currently returns { answer, context, rewrittenQuery } (after our recent update)
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: query,
                    userId: 'admin-debug-user' // Use a specific ID for debug history
                }),
                cache: 'no-store'
            });

            const data = await res.json();

            if (res.ok) {
                setResult(data);
            } else {
                setError(data.error || '查詢失敗，請稍後再試');
            }
        } catch (error) {
            console.error('RAG Debug error:', error);
            setError('呼叫 /api/chat 時發生錯誤，請檢查伺服器日誌或環境變數設定。');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6 border-l-4 border-purple-500">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
                <Zap className="w-6 h-6 text-purple-600" />
                RAG 實驗室 (RAG Lab)
            </h2>

            <p className="text-gray-600 mb-6 text-sm">
                在此測試 RAG 檢索流程。您可以輸入問題，觀察 Query Rewrite、檢索到的 Chunks 以及最終生成的回答。
            </p>

            <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="輸入測試問題..."
                    className="flex-1 p-2 border rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    測試
                </button>
            </form>

            {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                </div>
            )}

            {result && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* 0. Vector Result Chart */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <Database className="w-4 h-4" /> 檢索結果可視化
                        </h3>
                        {result.context?.length ? (
                            <div className="space-y-2 bg-white border border-gray-200 rounded-lg p-3">
                                {result.context.map((chunk, idx) => {
                                    const pct = Math.max(5, Math.min(100, chunk.score * 100));
                                    return (
                                        <div key={idx} className="space-y-1">
                                            <div className="flex justify-between text-xs text-gray-600">
                                                <span>Chunk #{idx + 1} - {chunk.source || '未知來源'}</span>
                                                <span>Score {(chunk.score ?? 0).toFixed(4)}</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2">
                                                <div
                                                    className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500 bg-white border border-dashed border-gray-200 rounded p-3">
                                尚未取得檢索結果。
                            </div>
                        )}
                    </div>

                    {/* 1. Query Rewrite Flow */}
                    <div className="flex items-center gap-4 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            <span>原始問題: <strong>{query}</strong></span>
                        </div>
                        {result.rewrittenQuery && (
                            <>
                                <ArrowRight className="w-4 h-4" />
                                <div className="flex items-center gap-2 text-purple-700">
                                    <Zap className="w-4 h-4" />
                                    <span>重寫後: <strong>{result.rewrittenQuery}</strong></span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* 2. Retrieved Chunks */}
                    <div>
                        <h3 className="text-md font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <Database className="w-4 h-4" /> 檢索到的知識片段 (Top 5)
                        </h3>
                        {result.context?.length ? (
                            <div className="grid gap-3">
                                {result.context.map((chunk, idx) => (
                                    <div key={idx} className="bg-blue-50 p-3 rounded border border-blue-100 text-sm">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-blue-800">Chunk #{idx + 1}</span>
                                            <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded text-xs">
                                                Score: {chunk.score.toFixed(4)}
                                            </span>
                                        </div>
                                        <p className="text-gray-700 mb-2 line-clamp-3">{chunk.text}</p>
                                        <div className="text-xs text-gray-500">
                                            來源: {chunk.source} {chunk.page ? `(Page: ${chunk.page})` : ''}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded p-3">
                                沒有取得檢索片段，請確認向量資料庫設定或問題內容。
                            </div>
                        )}
                    </div>

                    {/* 3. Final Answer */}
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                        <h3 className="text-md font-semibold text-green-800 mb-2">AI 最終回答</h3>
                        <div className="prose prose-sm max-w-none text-gray-800">
                            {result.answer}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
