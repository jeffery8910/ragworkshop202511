'use client';

import { useState, useEffect, Suspense } from 'react';
import { FileText, RefreshCw, Database, Eye, Trash2, Zap } from 'lucide-react';
import Link from 'next/link';
import RagLabPanel from '@/components/admin/RagLabPanel';
import RagProcessGraph from '@/components/admin/RagProcessGraph';
import KnowledgeGraph from '@/components/admin/KnowledgeGraph';
import UploadHistoryPanel from '@/components/admin/UploadHistoryPanel';
import UploadPanel from '@/components/admin/UploadPanel';
import FileManagementPanel from '@/components/admin/FileManagementPanel';
import { useToast } from '@/components/ui/ToastProvider';
import { adminFetch } from '@/lib/client/adminFetch';
import Skeleton from '@/components/ui/Skeleton';

interface VectorChunk {
    id: string;
    text: string;
    source: string;
    score?: number;
}

interface IndexedFile {
    docId: string;
    name: string;
    status: 'indexed' | 'processing' | 'failed' | 'reindexed';
    chunks: number;
    uploadedAt: string;
}

export default function KnowledgeBasePage() {
    const [activeTab, setActiveTab] = useState<'knowledge' | 'rag-lab'>('knowledge');
    const [loading, setLoading] = useState(false);

    // Initialize with empty array - No Mock Data
    const [indexedFiles, setIndexedFiles] = useState<IndexedFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<IndexedFile | null>(null);
    const [chunks, setChunks] = useState<VectorChunk[]>([]);
    const [listLoading, setListLoading] = useState(false);
    const [actionMsg, setActionMsg] = useState<string | null>(null);
    const [docDetail, setDocDetail] = useState<any | null>(null);
    const [chunkQuery, setChunkQuery] = useState('');
    const [chunkOrder, setChunkOrder] = useState<'asc' | 'desc'>('asc');
    const [chunkPage, setChunkPage] = useState(0);
    const [chunkLimit, setChunkLimit] = useState(50);
    const [chunkTotal, setChunkTotal] = useState(-1);
    const { pushToast } = useToast();
    const [activeChunk, setActiveChunk] = useState<VectorChunk | null>(null);
    const [graphStats, setGraphStats] = useState<{ totalNodes: number; totalEdges: number } | null>(null);
    const [graphStatsLoading, setGraphStatsLoading] = useState(false);

    const loadDocuments = async () => {
        setListLoading(true);
        try {
            const res = await adminFetch('/api/admin/documents', { cache: 'no-store' });
            if (!res.ok) {
                const data = await res.json();
                if (data.error && data.error.includes('MONGODB_URI')) {
                    const goToSetup = confirm(
                        'MONGODB_URI 尚未設定。\n\n點擊「確定」前往設定頁面配置環境變數。'
                    );
                    if (goToSetup) {
                        window.location.href = '/admin?tab=setup';
                    }
                    return;
                }
                throw new Error(data.error || '讀取失敗');
            }
            const data = await res.json();
            const mapped: IndexedFile[] = (data?.documents || []).map((d: any) => ({
                docId: d.docId,
                name: d.filename,
                status: (d.status as any) || 'indexed',
                chunks: d.chunks,
                uploadedAt: d.indexedAt ? new Date(d.indexedAt).toLocaleString() : '',
            }));
            setIndexedFiles(mapped);
        } catch (e: any) {
            console.error(e);
            pushToast({ type: 'error', message: '讀取文件列表失敗：' + (e?.message || e) });
        } finally {
            setListLoading(false);
        }
    };

    const loadGraphStats = async () => {
        setGraphStatsLoading(true);
        try {
            const res = await adminFetch('/api/admin/graph?stats=1', { cache: 'no-store' });
            const data = await res.json().catch(() => ({} as any));
            if (!res.ok || data?.ok === false) {
                throw new Error(data?.error || '讀取圖譜統計失敗');
            }
            setGraphStats({
                totalNodes: Number(data?.totalNodes || 0),
                totalEdges: Number(data?.totalEdges || 0),
            });
        } catch (e: any) {
            console.error(e);
            setGraphStats(null);
        } finally {
            setGraphStatsLoading(false);
        }
    };

    useEffect(() => {
        loadDocuments();
        loadGraphStats();
    }, []);

    const highlightText = (text: string, query: string) => {
        const tokens = query.split(/\s+/).map(t => t.trim()).filter(t => t.length > 1);
        if (!tokens.length) return text;
        const pattern = new RegExp(`(${tokens.map(t => t.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')).join('|')})`, 'gi');
        const parts = text.split(pattern);
        return parts.map((part, idx) =>
            tokens.some(t => t.toLowerCase() === part.toLowerCase())
                ? <mark key={idx} className="bg-yellow-200 px-0.5">{part}</mark>
                : <span key={idx}>{part}</span>
        );
    };

    const loadDocDetail = async (docId: string) => {
        const res = await adminFetch(`/api/admin/documents/${encodeURIComponent(docId)}`, { cache: 'no-store' });
        const data = await res.json();
        if (res.ok) {
            setDocDetail(data);
        }
    };

    const loadChunks = async (docId: string, opts?: { page?: number; query?: string; order?: 'asc' | 'desc'; limit?: number }) => {
        const page = opts?.page ?? chunkPage;
        const query = (opts?.query ?? chunkQuery).trim();
        const order = opts?.order ?? chunkOrder;
        const limit = opts?.limit ?? chunkLimit;
        const skip = page * limit;

        const params = new URLSearchParams({
            docId,
            limit: String(limit),
            skip: String(skip),
            order
        });
        if (query) params.set('q', query);

        const res = await adminFetch(`/api/admin/chunks?${params.toString()}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '讀取切片失敗');
        setChunks(
            (data?.chunks || []).map((c: any) => ({
                id: c.chunkId,
                text: c.text || '',
                source: c.source,
                score: c.score,
            }))
        );
        setChunkTotal(typeof data.total === 'number' ? data.total : 0);
        setChunkPage(page);
        setChunkLimit(limit);
        setChunkOrder(order);
    };

    const handleViewChunks = async (file: IndexedFile) => {
        setSelectedFile(file);
        setDocDetail(null);
        setChunkPage(0);
        setChunkTotal(-1);
        setLoading(true);
        try {
            await Promise.all([
                loadChunks(file.docId, { page: 0 }),
                loadDocDetail(file.docId),
            ]);
        } catch (e: any) {
            console.error(e);
            pushToast({ type: 'error', message: e?.message || '讀取切片失敗' });
        } finally {
            setLoading(false);
        }
    };

    const runChunkSearch = async (page = 0) => {
        if (!selectedFile) return;
        setLoading(true);
        try {
            await loadChunks(selectedFile.docId, { page, query: chunkQuery, order: chunkOrder, limit: chunkLimit });
        } catch (e: any) {
            console.error(e);
            pushToast({ type: 'error', message: e?.message || '讀取切片失敗' });
        } finally {
            setLoading(false);
        }
    };

    const reindex = async (docId?: string) => {
        setActionMsg('重新索引中...');
        try {
            const res = await adminFetch('/api/admin/index', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(docId ? { scope: 'doc', docId } : { scope: 'all' }),
            });
            const data = await res.json();
            if (!res.ok || !data?.ok) {
                const error = data?.error || '重新索引失敗';
                if (error.includes('MONGODB_URI')) {
                    const goToSetup = confirm(
                        'MONGODB_URI 尚未設定。\n\n點擊「確定」前往設定頁面配置環境變數。'
                    );
                    if (goToSetup) {
                        window.location.href = '/admin?tab=setup';
                    }
                    return;
                }
                throw new Error(error);
            }
            await loadDocuments();
            pushToast({ type: 'success', message: '重新索引完成' });
        } catch (e: any) {
            pushToast({ type: 'error', message: e?.message || '重新索引失敗' });
        } finally {
            setActionMsg(null);
        }
    };

    const removeDocs = async (docId?: string) => {
        const ok = confirm(docId ? '確定刪除該文件的向量與紀錄？' : '確定清空所有文件與向量？');
        if (!ok) return;
        setActionMsg('刪除中...');
        try {
            const res = await adminFetch('/api/admin/index', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(docId ? { scope: 'doc', docId } : { scope: 'all' }),
            });
            const data = await res.json();
            if (!res.ok || !data?.ok) throw new Error(data?.error || '刪除失敗');
            await loadDocuments();
            if (selectedFile && (!docId || selectedFile.docId === docId)) {
                setSelectedFile(null);
                setChunks([]);
                setDocDetail(null);
                setChunkTotal(-1);
            }
            pushToast({ type: 'success', message: '刪除完成' });
        } catch (e: any) {
            pushToast({ type: 'error', message: e?.message || '刪除失敗' });
        } finally {
            setActionMsg(null);
        }
    };

    const docTotal = indexedFiles.length;
    const docProcessing = indexedFiles.filter(f => f.status === 'processing').length;
    const docFailed = indexedFiles.filter(f => f.status === 'failed').length;
    const docOk = Math.max(0, docTotal - docProcessing - docFailed);
    const chunkTotalCount = indexedFiles.reduce((sum, f) => sum + (Number(f.chunks) || 0), 0);
    const graphTotalNodes = graphStats?.totalNodes ?? 0;
    const graphTotalEdges = graphStats?.totalEdges ?? 0;

    const nextSteps = (() => {
        const steps: string[] = [];
        if (docTotal === 0) {
            steps.push('先上傳 1 份文件並完成索引，才有東西可以檢索/比較。');
        } else {
            if (docFailed > 0) steps.push('有文件索引失敗：先針對失敗的檔案按「重建」或重新上傳。');
            if (chunkTotalCount === 0) steps.push('Chunks 為 0：可能還在處理中或索引流程異常，建議先看「上傳歷史」。');
        }
        if (docTotal > 0 && graphTotalNodes === 0) {
            steps.push('圖譜節點為 0：先按下方「知識圖譜」的重新整理，或重建索引後再觀察。');
        }
        steps.push('接著到「RAG 教學坊」用同一題做 A/B 比較（TopK/重寫/圖譜/Agentic）。');
        return steps;
    })();

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="mb-6 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">知識庫管理中心</h1>
                    <p className="text-gray-600">統一管理檔案上傳、向量切片、與 RAG 實驗測試</p>
                </div>

                {/* Tabs */}
                <div className="flex bg-white rounded-lg p-1 shadow-sm border">
                    <button
                        onClick={() => setActiveTab('knowledge')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'knowledge' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <Database className="w-4 h-4" /> 知識庫管理
                    </button>
                    <button
                        onClick={() => setActiveTab('rag-lab')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'rag-lab' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <Zap className="w-4 h-4" /> RAG 教學坊
                    </button>
                </div>
            </div>

            {activeTab === 'knowledge' ? (
                <div className="space-y-6">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="font-semibold text-gray-800">狀態總覽</div>
                            <button
                                onClick={() => {
                                    loadDocuments();
                                    loadGraphStats();
                                }}
                                className="text-xs px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 inline-flex items-center gap-1"
                                disabled={listLoading || graphStatsLoading}
                                title="重新整理統計"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${listLoading || graphStatsLoading ? 'animate-spin' : ''}`} />
                                重新整理
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <div className="text-xs text-slate-500 mb-1">文件</div>
                                <div className="text-sm text-slate-800">
                                    共 <span className="font-semibold">{docTotal}</span> 份
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
                                    <span className="rounded-full bg-white border px-2 py-0.5">已完成 {docOk}</span>
                                    <span className="rounded-full bg-white border px-2 py-0.5">處理中 {docProcessing}</span>
                                    <span className="rounded-full bg-white border px-2 py-0.5">失敗 {docFailed}</span>
                                </div>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <div className="text-xs text-slate-500 mb-1">向量切片</div>
                                <div className="text-sm text-slate-800">
                                    Chunks 合計 <span className="font-semibold">{chunkTotalCount}</span>
                                </div>
                                <div className="mt-2 text-[11px] text-slate-600">
                                    建議：用「查看切片」確認內容是否合理、是否反白命中關鍵字。
                                </div>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <div className="text-xs text-slate-500 mb-1">知識圖譜</div>
                                <div className="text-sm text-slate-800">
                                    節點 <span className="font-semibold">{graphTotalNodes}</span> · 關係 <span className="font-semibold">{graphTotalEdges}</span>
                                </div>
                                <div className="mt-2 text-[11px] text-slate-600">
                                    建議：用「標示」與「路徑」做同題比較（少量/大量、同文件/跨文件）。
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/60 p-3">
                            <div className="text-xs font-semibold text-amber-900 mb-1">下一步建議</div>
                            <ul className="list-disc pl-4 text-[12px] text-amber-900 space-y-1">
                                {nextSteps.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <Link
                                    href="/workshop"
                                    className="text-xs px-3 py-1.5 rounded-full bg-purple-600 text-white hover:bg-purple-700"
                                >
                                    去 RAG 教學坊做比較
                                </Link>
                                <Link
                                    href="/chat"
                                    className="text-xs px-3 py-1.5 rounded-full bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                                >
                                    去聊天做同題練習
                                </Link>
                                <Link
                                    href="/admin/status"
                                    className="text-xs px-3 py-1.5 rounded-full bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                                >
                                    看系統狀態
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: File Upload */}
                    <div className="lg:col-span-3 space-y-6">
                        <UploadPanel onAction={setActionMsg} onUploadComplete={loadDocuments} />

                        {/* Indexed Files List */}
                        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500 space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
                                    <Database className="w-5 h-5 text-green-600" /> 已索引檔案
                                </h2>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => reindex()}
                                        disabled={!!actionMsg}
                                        className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 flex items-center gap-1"
                                    >
                                        <RefreshCw className="w-3 h-3" /> 全部重建
                                    </button>
                                    <button
                                        onClick={() => removeDocs()}
                                        disabled={!!actionMsg}
                                        className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 flex items-center gap-1"
                                    >
                                        <Trash2 className="w-3 h-3" /> 清空
                                    </button>
                                </div>
                            </div>
                            {listLoading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-14" />
                                    <Skeleton className="h-14" />
                                    <Skeleton className="h-14" />
                                </div>
                            ) : indexedFiles.length > 0 ? (
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {indexedFiles.map((file, idx) => (
                                        <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                                        <span className="text-sm font-medium text-gray-800 truncate">{file.name}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1">Chunks: {file.chunks} | {file.uploadedAt}</p>
                                                    <p className="text-[10px] text-gray-400 break-all">docId: {file.docId}</p>
                                                </div>
                                                <span
                                                    className={`text-xs px-2 py-1 rounded flex-shrink-0 ${file.status === 'indexed' || file.status === 'reindexed' ? 'bg-green-100 text-green-700' :
                                                        file.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-red-100 text-red-700'
                                                        }`}
                                                >
                                                    {file.status === 'indexed' || file.status === 'reindexed' ? '已索引' : file.status === 'processing' ? '處理中' : '失敗'}
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleViewChunks(file)}
                                                    className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 flex items-center gap-1"
                                                >
                                                    <Eye className="w-3 h-3" /> 查看切片
                                                </button>
                                                <button
                                                    onClick={() => reindex(file.docId)}
                                                    disabled={!!actionMsg}
                                                    className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded hover:bg-amber-200 flex items-center gap-1"
                                                >
                                                    <RefreshCw className="w-3 h-3" /> 重建
                                                </button>
                                                <button
                                                    onClick={() => removeDocs(file.docId)}
                                                    disabled={!!actionMsg}
                                                    className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 flex items-center gap-1"
                                                >
                                                    <Trash2 className="w-3 h-3" /> 刪除
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                                    <Database className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                    <p className="text-sm">尚無已索引的檔案</p>
                                </div>
                            )}
                            {actionMsg && <p className="text-xs text-amber-700">{actionMsg}</p>}
                        </div>
                    </div>

                    {/* Middle Column: Vector Chunks */}
                    <div className="lg:col-span-4">
                        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500 h-full">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
                                <FileText className="w-5 h-5 text-purple-600" /> 向量切片詳情
                            </h2>

                            {selectedFile ? (
                                <div>
                                    <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                                        <p className="text-sm font-medium text-purple-900">來源檔案: {selectedFile.name}</p>
                                        <p className="text-xs text-purple-700 mt-1">Total Chunks: {selectedFile.chunks}</p>
                                        {docDetail?.stats && (
                                            <div className="mt-2 text-xs text-purple-700 space-y-1">
                                                <div>平均長度: {docDetail.stats.avgLen} / 最小: {docDetail.stats.minLen} / 最大: {docDetail.stats.maxLen}</div>
                                                {docDetail?.document?.mode && <div>解析模式: {docDetail.document.mode}</div>}
                                                {docDetail?.document?.type && <div>檔案類型: {docDetail.document.type}</div>}
                                                {docDetail?.document?.note && <div>備註: {docDetail.document.note}</div>}
                                            </div>
                                        )}
                                    </div>

                                    <div className="mb-3 space-y-2">
                                        <div className="flex flex-wrap gap-2 items-center">
                                            <input
                                                value={chunkQuery}
                                                onChange={e => setChunkQuery(e.target.value)}
                                                placeholder="搜尋切片內容/來源"
                                                className="flex-1 min-w-[160px] border rounded px-2 py-1 text-xs"
                                            />
                                            <select
                                                value={chunkOrder}
                                                onChange={e => setChunkOrder(e.target.value as 'asc' | 'desc')}
                                                className="border rounded px-2 py-1 text-xs"
                                            >
                                                <option value="asc">順序</option>
                                                <option value="desc">倒序</option>
                                            </select>
                                            <select
                                                value={chunkLimit}
                                                onChange={e => setChunkLimit(Number(e.target.value))}
                                                className="border rounded px-2 py-1 text-xs"
                                            >
                                                <option value={20}>20 / 頁</option>
                                                <option value={50}>50 / 頁</option>
                                                <option value={100}>100 / 頁</option>
                                            </select>
                                            <button
                                                onClick={() => runChunkSearch(0)}
                                                disabled={loading}
                                                className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 disabled:opacity-50"
                                            >
                                                搜尋
                                            </button>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-gray-500">
                                            <span>
                                                顯示 {chunks.length} / {chunkTotal >= 0 ? chunkTotal : (selectedFile.chunks || 0)}
                                            </span>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => runChunkSearch(Math.max(0, chunkPage - 1))}
                                                    disabled={loading || chunkPage === 0}
                                                    className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-50"
                                                >
                                                    上一頁
                                                </button>
                                                <button
                                                    onClick={() => runChunkSearch(chunkPage + 1)}
                                                    disabled={loading || (chunkTotal >= 0 && (chunkPage + 1) * chunkLimit >= chunkTotal)}
                                                    className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-50"
                                                >
                                                    下一頁
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {loading ? (
                                        <div className="space-y-3">
                                            <Skeleton className="h-20" />
                                            <Skeleton className="h-20" />
                                            <Skeleton className="h-20" />
                                        </div>
                                    ) : chunks.length > 0 ? (
                                        <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                            {chunks.map((chunk, idx) => (
                                                <div key={chunk.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-xs font-mono text-gray-400">Chunk #{idx + 1}</span>
                                                        {chunk.score && (
                                                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                                                Score: {chunk.score.toFixed(3)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-700 leading-relaxed">
                                                        {highlightText(chunk.text, chunkQuery)}
                                                    </p>
                                                    <div className="mt-2 flex justify-end">
                                                        <button
                                                            onClick={() => setActiveChunk(chunk)}
                                                            className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100"
                                                        >
                                                            檢視全文
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-gray-500">
                                            <p>此檔案暫無切片資料</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center text-gray-500 py-12">
                                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <p className="text-sm">請從左側選擇一個檔案以查看其切片詳情</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Visualization */}
                    <div className="lg:col-span-5 flex flex-col gap-4">
                        <UploadHistoryPanel />
                        <FileManagementPanel onAction={setActionMsg} />
                        {/* Replaced inline visualization with the real KnowledgeGraph component */}
                        <div className="h-[500px]">
                            <Suspense fallback={<div className="h-full w-full rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-400">載入圖譜中…</div>}>
                                <KnowledgeGraph />
                            </Suspense>
                        </div>
                        
                        {/* RAG Process Visualization */}
                        <RagProcessGraph />
                    </div>
                </div>
                </div>
            ) : (
                <RagLabPanel />
            )}

            {activeChunk && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-3xl bg-white rounded-lg shadow-lg border">
                        <div className="flex items-center justify-between px-4 py-3 border-b">
                            <div className="text-sm font-semibold text-gray-800">切片全文</div>
                            <button
                                onClick={() => setActiveChunk(null)}
                                className="text-xs text-gray-600 hover:text-gray-900"
                            >
                                關閉
                            </button>
                        </div>
                        <div className="p-4 max-h-[70vh] overflow-y-auto text-sm leading-relaxed">
                            {highlightText(activeChunk.text, chunkQuery)}
                        </div>
                        <div className="px-4 py-3 border-t flex justify-end gap-2">
                            <button
                                onClick={async () => {
                                    try {
                                        await navigator.clipboard.writeText(activeChunk.text);
                                        pushToast({ type: 'success', message: '已複製切片內容' });
                                    } catch {
                                        pushToast({ type: 'error', message: '複製失敗' });
                                    }
                                }}
                                className="text-xs bg-gray-100 px-3 py-1 rounded hover:bg-gray-200"
                            >
                                複製
                            </button>
                            <button
                                onClick={() => setActiveChunk(null)}
                                className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                            >
                                關閉
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
