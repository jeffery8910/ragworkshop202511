'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, History, ChevronDown, ChevronUp, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { adminFetch } from '@/lib/client/adminFetch';
import { useToast } from '@/components/ui/ToastProvider';
import Skeleton from '@/components/ui/Skeleton';

interface UploadFile {
    filename: string;
    size?: number;
    mode?: string;
    chunks?: number;
    status?: string;
    note?: string;
    error?: string;
}

interface UploadRecord {
    uploadId: string;
    createdAt: string;
    status: 'ok' | 'partial' | 'failed';
    totalFiles: number;
    successFiles: number;
    failedFiles: number;
    mode?: string;
    files?: UploadFile[];
}

export default function UploadHistoryPanel() {
    const [loading, setLoading] = useState(false);
    const [uploads, setUploads] = useState<UploadRecord[]>([]);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [order, setOrder] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(10);
    const [total, setTotal] = useState(0);
    const { pushToast } = useToast();

    const fetchUploads = async (nextPage = page) => {
        setLoading(true);
        try {
            const skip = nextPage * limit;
            const params = new URLSearchParams({
                limit: String(limit),
                skip: String(skip),
                order,
            });
            const q = query.trim();
            if (q) params.set('q', q);

            const res = await adminFetch(`/api/admin/uploads?${params.toString()}`, { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '讀取上傳記錄失敗');
            setUploads(data.uploads || []);
            setTotal(data.total || 0);
            setPage(nextPage);
        } catch (e) {
            console.error(e);
            pushToast({ type: 'error', message: '讀取上傳記錄失敗' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUploads();
    }, []);

    const toggle = (id: string) => {
        setExpanded(prev => prev === id ? null : id);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-slate-500">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
                    <History className="w-5 h-5 text-slate-600" /> 上傳歷史
                </h2>
                <button
                    onClick={() => fetchUploads(0)}
                    disabled={loading}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    title="重新整理"
                >
                    <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="flex flex-wrap gap-2 items-center mb-3">
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="搜尋檔名 / 狀態 / uploadId"
                    className="flex-1 min-w-[160px] border rounded px-2 py-1 text-xs"
                />
                <select
                    value={order}
                    onChange={e => setOrder(e.target.value as 'asc' | 'desc')}
                    className="border rounded px-2 py-1 text-xs"
                >
                    <option value="desc">最新</option>
                    <option value="asc">最舊</option>
                </select>
                <select
                    value={limit}
                    onChange={e => setLimit(Number(e.target.value))}
                    className="border rounded px-2 py-1 text-xs"
                >
                    <option value={5}>5 / 頁</option>
                    <option value={10}>10 / 頁</option>
                    <option value={20}>20 / 頁</option>
                </select>
                <button
                    onClick={() => fetchUploads(0)}
                    disabled={loading}
                    className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 disabled:opacity-50"
                >
                    搜尋
                </button>
            </div>

            <div className="flex justify-between items-center text-xs text-gray-500 mb-3">
                <span>顯示 {uploads.length} / {total}</span>
                <div className="flex gap-2">
                    <button
                        onClick={() => fetchUploads(Math.max(0, page - 1))}
                        disabled={loading || page === 0}
                        className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-50"
                    >
                        上一頁
                    </button>
                    <button
                        onClick={() => fetchUploads(page + 1)}
                        disabled={loading || (page + 1) * limit >= total}
                        className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-50"
                    >
                        下一頁
                    </button>
                </div>
            </div>

            {loading && uploads.length === 0 ? (
                <div className="space-y-2">
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                </div>
            ) : uploads.length === 0 ? (
                <div className="text-sm text-gray-500 bg-gray-50 border border-dashed rounded p-4 text-center">
                    尚無上傳紀錄
                </div>
            ) : (
                <div className="space-y-3">
                    {uploads.map(u => {
                        const isOpen = expanded === u.uploadId;
                        const statusClass = u.status === 'ok'
                            ? 'bg-green-100 text-green-700'
                            : u.status === 'partial'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700';
                        return (
                            <div key={u.uploadId} className="border rounded-lg bg-gray-50">
                                <button
                                    onClick={() => toggle(u.uploadId)}
                                    className="w-full px-4 py-3 flex items-center justify-between text-left"
                                >
                                    <div className="space-y-1">
                                        <div className="text-sm font-medium text-gray-800">
                                            上傳時間: {new Date(u.createdAt).toLocaleString()}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            成功 {u.successFiles} / 失敗 {u.failedFiles} / 總數 {u.totalFiles}
                                            {u.mode ? ` | 模式: ${u.mode}` : ''}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs px-2 py-1 rounded-full ${statusClass}`}>
                                            {u.status === 'ok' ? '成功' : u.status === 'partial' ? '部分失敗' : '失敗'}
                                        </span>
                                        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                                    </div>
                                </button>

                                {isOpen && (
                                    <div className="px-4 pb-4 space-y-2">
                                        {(u.files || []).length ? (
                                            <div className="space-y-2">
                                                {u.files!.map((f, idx) => {
                                                    const ok = f.status === 'ok' || f.status === 'ok_mongo_only';
                                                    return (
                                                        <div key={`${u.uploadId}-${idx}`} className="flex items-start justify-between gap-3 bg-white border rounded p-3">
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <FileText className="w-4 h-4 text-gray-500" />
                                                                    <span className="text-sm font-medium text-gray-800 truncate">{f.filename}</span>
                                                                </div>
                                                                <div className="text-xs text-gray-500 mt-1">
                                                                    {typeof f.size === 'number' ? `大小: ${(f.size / 1024).toFixed(1)} KB | ` : ''}
                                                                    {typeof f.chunks === 'number' ? `Chunks: ${f.chunks}` : ''}
                                                                    {f.mode ? ` | 模式: ${f.mode}` : ''}
                                                                </div>
                                                                {(f.error || f.note) && (
                                                                    <div className="text-xs text-red-600 mt-1">{f.error || f.note}</div>
                                                                )}
                                                            </div>
                                                            <div className={`text-xs px-2 py-1 rounded-full ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                {ok ? <CheckCircle className="w-3 h-3 inline-block mr-1" /> : <AlertCircle className="w-3 h-3 inline-block mr-1" />}
                                                                {ok ? '成功' : '失敗'}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-gray-400">無檔案詳細紀錄</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
