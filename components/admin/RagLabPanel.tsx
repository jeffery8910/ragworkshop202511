'use client';

import { useState } from 'react';
import { Search, Loader2, Database, MessageSquare, ArrowRight, Zap } from 'lucide-react';
import { adminFetch } from '@/lib/client/adminFetch';
import { useToast } from '@/components/ui/ToastProvider';

interface RagResult {
    answer: string;
    context: Array<{
        score: number;
        text: string;
        source: string;
        page?: number;
        indexedAt?: number | string;
        metadata?: {
            text_length?: number;
            indexed_at?: number | string;
            chunk_id?: string;
            [key: string]: any;
        };
    }>;
    rewrittenQuery?: string;
    graphContext?: string;
    graphEvidence?: {
        nodes?: Array<{ id: string; label?: string; type?: string; docId?: string }>;
        edges?: Array<{ source: string; target: string; relation: string; docId?: string }>;
        triples?: string[];
    };
}

export default function RagLabPanel() {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<RagResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [topK, setTopK] = useState(5);
    const [rewrite, setRewrite] = useState(true);
    const [includeAnswer, setIncludeAnswer] = useState(true);
    const [elapsedMs, setElapsedMs] = useState<number | null>(null);
    const [useGraph, setUseGraph] = useState(true);
    const [history, setHistory] = useState<Array<{
        id: string;
        query: string;
        topK: number;
        rewrite: boolean;
        includeAnswer: boolean;
        useGraph: boolean;
        elapsedMs: number | null;
        result: RagResult;
        createdAt: number;
    }>>([]);
    const { pushToast } = useToast();

    const normalizedScores = result?.context?.length
        ? result.context.map(c => c.score)
        : [];
    const maxScore = normalizedScores.length ? Math.max(...normalizedScores) : 1;

    const sourceCounts = result?.context?.reduce<Record<string, number>>((acc, c) => {
        const key = c.source || '未知來源';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {}) || {};
    const totalSources = Object.values(sourceCounts).reduce((a, b) => a + b, 0) || 1;

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setResult(null);
        setError(null);
        setElapsedMs(null);

        try {
            const startedAt = performance.now();
            const res = await adminFetch('/api/admin/retrieve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    topK,
                    includeAnswer,
                    rewrite,
                    useGraph
                }),
                cache: 'no-store'
            });

            const data = await res.json();
            setElapsedMs(Math.round(performance.now() - startedAt));

            if (res.ok) {
                setResult(data);
                setHistory(prev => {
                    const next = [{
                        id: `${Date.now()}`,
                        query,
                        topK,
                        rewrite,
                        includeAnswer,
                        useGraph,
                        elapsedMs: Math.round(performance.now() - startedAt),
                        result: data,
                        createdAt: Date.now(),
                    }, ...prev];
                    return next.slice(0, 6);
                });
            } else {
                setError(data.error || '查詢失敗，請稍後再試');
                pushToast({ type: 'error', message: data.error || '查詢失敗，請稍後再試' });
            }
        } catch (error) {
            console.error('RAG Debug error:', error);
            setError('呼叫 /api/admin/retrieve 時發生錯誤，請檢查伺服器日誌或環境變數設定。');
            pushToast({ type: 'error', message: '呼叫 /api/admin/retrieve 時發生錯誤' });
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

            <div className="flex flex-wrap gap-4 items-center text-xs mb-4">
                <label className="flex items-center gap-2">
                    TopK
                    <input
                        type="number"
                        min={1}
                        max={50}
                        value={topK}
                        onChange={(e) => setTopK(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                        className="w-16 border rounded px-2 py-1 text-xs"
                    />
                </label>
                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={rewrite} onChange={(e) => setRewrite(e.target.checked)} />
                    問題重寫
                </label>
                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={includeAnswer} onChange={(e) => setIncludeAnswer(e.target.checked)} />
                    生成回答
                </label>
                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={useGraph} onChange={(e) => setUseGraph(e.target.checked)} />
                    Graph RAG
                </label>
                {elapsedMs !== null && (
                    <span className="text-gray-500">耗時 {elapsedMs} ms</span>
                )}
            </div>

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

            {history.length > 0 && (
                <div className="mb-6 bg-white border border-gray-200 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-2">最近測試紀錄</div>
                    <div className="space-y-2">
                        {history.map(run => (
                            <button
                                key={run.id}
                                onClick={() => {
                                    setQuery(run.query);
                                    setTopK(run.topK);
                                    setRewrite(run.rewrite);
                                    setIncludeAnswer(run.includeAnswer);
                                    setUseGraph(run.useGraph);
                                    setElapsedMs(run.elapsedMs);
                                    setResult(run.result);
                                }}
                                className="w-full text-left text-xs border rounded px-3 py-2 hover:bg-gray-50"
                            >
                                <div className="flex justify-between">
                                    <span className="font-medium text-gray-700">{run.query}</span>
                                    <span className="text-gray-400">{new Date(run.createdAt).toLocaleTimeString()}</span>
                                </div>
                                <div className="text-gray-400 mt-1">
                                    topK={run.topK} | rewrite={String(run.rewrite)} | answer={String(run.includeAnswer)} | graph={String(run.useGraph)}
                                </div>
                            </button>
                        ))}
                    </div>
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

                    {/* 0b. Score vs Rank / Source 分布 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Score vs Rank</h4>
                            {result.context?.length ? result.context.map((c, i) => {
                                const pct = maxScore ? (c.score / maxScore) * 100 : 0;
                                return (
                                    <div key={i} className="space-y-1 mb-2">
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span># {i + 1}</span>
                                            <span>{c.score.toFixed(4)}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div className="h-2 rounded-full bg-blue-500" style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>
                                );
                            }) : <div className="text-xs text-gray-500">尚無資料</div>}
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">來源分布</h4>
                            {Object.keys(sourceCounts).length ? (
                                <div className="space-y-2">
                                    {Object.entries(sourceCounts).map(([src, cnt], idx) => {
                                        const pct = (cnt / totalSources) * 100;
                                        return (
                                            <div key={idx} className="space-y-1">
                                                <div className="flex justify-between text-xs text-gray-500">
                                                    <span>{src}</span>
                                                    <span>{cnt} / {totalSources}</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-2">
                                                    <div className="h-2 rounded-full bg-purple-500" style={{ width: `${pct}%` }}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : <div className="text-xs text-gray-500">尚無資料</div>}
                        </div>
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
                            <Database className="w-4 h-4" /> 檢索到的知識片段 (Top {result.context?.length ?? topK})
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
                                        <div className="text-xs text-gray-500 flex flex-wrap gap-3">
                                            <span>長度: {chunk.metadata?.text_length ?? (chunk.text || '').length} chars</span>
                                            {(chunk.metadata?.indexed_at || chunk.indexedAt) && <span>索引時間: {new Date(chunk.metadata?.indexed_at || (chunk as any).indexedAt).toLocaleString()}</span>}
                                            <span>來源: {chunk.source} {chunk.page ? `(Page: ${chunk.page})` : ''}</span>
                                            {(chunk.metadata?.chunk_id || chunk.metadata?.chunkId) && (
                                                <span>ID: {chunk.metadata?.chunk_id || chunk.metadata?.chunkId}</span>
                                            )}
                                            {chunk.metadata?.docId && <span>docId: {chunk.metadata.docId}</span>}
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

                    {result.graphContext && (
                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                            <h3 className="text-md font-semibold text-amber-800 mb-2">知識圖譜補充</h3>
                            <div className="text-xs text-amber-900 whitespace-pre-wrap">
                                {result.graphContext}
                            </div>
                        </div>
                    )}

                    {result.graphEvidence && (
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h3 className="text-md font-semibold text-slate-700 mb-2">Graph Evidence</h3>
                            <div className="text-xs text-slate-600 mb-2">
                                節點 {result.graphEvidence.nodes?.length || 0}，關係 {result.graphEvidence.edges?.length || 0}
                            </div>
                            <div className="mb-2 flex gap-2">
                                <button
                                    onClick={() => {
                                        const url = `/admin?tab=knowledge&sub=viz&graphQuery=${encodeURIComponent(query)}`;
                                        window.open(url, '_blank');
                                    }}
                                    className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded hover:bg-purple-200"
                                >
                                    在圖譜高亮
                                </button>
                            </div>
                            {result.graphEvidence.triples?.length ? (
                                <div className="space-y-1 text-xs text-slate-700">
                                    {result.graphEvidence.triples.slice(0, 8).map((t, idx) => (
                                        <div key={idx} className="bg-white border rounded px-2 py-1">
                                            {t}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400">沒有可用的圖譜關係</div>
                            )}
                        </div>
                    )}

                    {/* 3. Final Answer */}
                    {includeAnswer ? (
                        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                            <h3 className="text-md font-semibold text-green-800 mb-2">AI 最終回答</h3>
                            <div className="prose prose-sm max-w-none text-gray-800">
                                {result.answer}
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded p-3">
                            已停用回答生成，只顯示檢索結果。
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
