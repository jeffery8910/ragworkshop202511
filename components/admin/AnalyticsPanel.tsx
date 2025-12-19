'use client';

import { useEffect, useState } from 'react';
import { BarChart, Activity, Users, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { adminFetch } from '@/lib/client/adminFetch';
import Skeleton from '@/components/ui/Skeleton';

interface AnalyticsData {
    activeUsers: number;
    totalChats: number;
    hotKeywords: string[];
    series?: Array<{ date: string; count: number }>;
    rangeDays?: number;
}

interface LogEntry {
    type: 'message' | 'reply' | 'error' | 'event';
    userId?: string;
    text?: string;
    timestamp?: string;
    meta?: any;
}

export default function AnalyticsPanel() {
    const [loading, setLoading] = useState(false);
    const [logsLoading, setLogsLoading] = useState(false);
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [keywords, setKeywords] = useState<string[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [logQuery, setLogQuery] = useState('');
    const [logType, setLogType] = useState('');
    const [logOrder, setLogOrder] = useState<'asc' | 'desc'>('desc');
    const [logPage, setLogPage] = useState(0);
    const [logLimit, setLogLimit] = useState(10);
    const [logTotal, setLogTotal] = useState(0);
    const [rangeDays, setRangeDays] = useState(7);
    const [expandedLog, setExpandedLog] = useState<number | null>(null);

    const fetchAnalytics = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminFetch(`/api/admin/analytics?range=${rangeDays}`, { cache: 'no-store' });
            const payload = await res.json();
            if (!res.ok) throw new Error(payload.error || '讀取分析失敗');
            setData(payload);
            setKeywords(payload.hotKeywords || []);
        } catch (e: any) {
            setError(e?.message || '讀取分析失敗');
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async (nextPage = logPage) => {
        setLogsLoading(true);
        try {
            const skip = nextPage * logLimit;
            const params = new URLSearchParams({
                limit: String(logLimit),
                skip: String(skip),
                order: logOrder,
            });
            if (logType) params.set('type', logType);
            if (logQuery.trim()) params.set('q', logQuery.trim());
            const res = await adminFetch(`/api/admin/logs?${params.toString()}`, { cache: 'no-store' });
            const payload = await res.json();
            if (!res.ok) throw new Error(payload.error || '讀取紀錄失敗');
            setLogs(payload.logs || []);
            setLogTotal(payload.total || 0);
            setLogPage(nextPage);
        } catch (e) {
            console.error(e);
        } finally {
            setLogsLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [rangeDays]);

    useEffect(() => {
        fetchLogs(0);
    }, []);

    const hasData = data && (data.activeUsers > 0 || data.totalChats > 0);
    const maxSeries = data?.series?.reduce((m, s) => Math.max(m, s.count), 0) || 1;

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

    const exportCsv = () => {
        if (!data?.series?.length) return;
        const header = 'date,count\n';
        const rows = data.series.map(s => `${s.date},${s.count}`).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `analytics_${rangeDays}d.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    if (loading && !data) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-md space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
                    <Activity className="w-5 h-5 text-blue-600" /> 數據概覽
                </h2>
                <button
                    onClick={() => { fetchAnalytics(); fetchLogs(); }}
                    disabled={loading}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    title="重新整理"
                >
                    <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                </div>
            )}

            {!hasData ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300 mb-6">
                    <BarChart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">尚無足夠數據</p>
                    <p className="text-xs text-gray-400 mt-1">當有更多用戶互動時，此處將顯示統計數據</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <div className="text-blue-600 text-sm font-medium flex items-center gap-1">
                            <Users className="w-4 h-4" /> 活躍用戶
                        </div>
                        <div className="text-2xl font-bold text-blue-900 mt-1">{data!.activeUsers.toLocaleString()}</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                        <div className="text-green-600 text-sm font-medium flex items-center gap-1">
                            <BarChart className="w-4 h-4" /> 今日對話
                        </div>
                        <div className="text-2xl font-bold text-green-900 mt-1">{data!.totalChats.toLocaleString()}</div>
                    </div>
                </div>
            )}

            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700">聊天趨勢</h3>
                    <div className="flex items-center gap-2">
                        <select
                            value={rangeDays}
                            onChange={(e) => setRangeDays(Number(e.target.value))}
                            className="border rounded px-2 py-1 text-xs"
                        >
                            <option value={7}>7 天</option>
                            <option value={14}>14 天</option>
                            <option value={30}>30 天</option>
                        </select>
                        <button
                            onClick={exportCsv}
                            className="text-xs bg-gray-100 px-3 py-1 rounded hover:bg-gray-200"
                        >
                            匯出 CSV
                        </button>
                    </div>
                </div>
                {data?.series?.length ? (
                    <div className="flex items-end gap-2 h-28 bg-gray-50 rounded border p-3">
                        {data.series.map((s, idx) => {
                            const height = Math.max(6, Math.round((s.count / maxSeries) * 80));
                            return (
                                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                    <div className="w-full bg-blue-500 rounded" style={{ height }} />
                                    <div className="text-[10px] text-gray-400">{s.date.slice(5)}</div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-xs text-gray-400 bg-gray-50 border border-dashed rounded p-3 text-center">
                        暫無趨勢資料
                    </div>
                )}
            </div>

            <div>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-medium text-gray-700">熱門關鍵字 (Hot Keywords)</h3>
                    <button
                        onClick={fetchAnalytics}
                        disabled={loading}
                        className="text-xs flex items-center gap-1 text-purple-600 hover:text-purple-700 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        {loading ? '分析中...' : '重新分析'}
                    </button>
                </div>

                {keywords.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {keywords.map((tag, idx) => (
                            <span key={idx} className="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-100 text-xs rounded-full">
                                {tag}
                            </span>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-4 bg-gray-50 rounded border border-dashed text-xs text-gray-400">
                        點擊上方按鈕以分析對話紀錄並生成熱門關鍵字
                    </div>
                )}
            </div>

            <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-700">最新系統事件 / 對話紀錄</h3>
                    {logsLoading && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                </div>
                <div className="flex flex-wrap gap-2 items-center mb-3">
                    <input
                        value={logQuery}
                        onChange={e => setLogQuery(e.target.value)}
                        placeholder="搜尋文字或 userId"
                        className="flex-1 min-w-[160px] border rounded px-2 py-1 text-xs"
                    />
                    <select
                        value={logType}
                        onChange={e => setLogType(e.target.value)}
                        className="border rounded px-2 py-1 text-xs"
                    >
                        <option value="">全部類型</option>
                        <option value="message">message</option>
                        <option value="reply">reply</option>
                        <option value="event">event</option>
                        <option value="error">error</option>
                    </select>
                    <select
                        value={logOrder}
                        onChange={e => setLogOrder(e.target.value as 'asc' | 'desc')}
                        className="border rounded px-2 py-1 text-xs"
                    >
                        <option value="desc">最新</option>
                        <option value="asc">最舊</option>
                    </select>
                    <select
                        value={logLimit}
                        onChange={e => setLogLimit(Number(e.target.value))}
                        className="border rounded px-2 py-1 text-xs"
                    >
                        <option value={10}>10 / 頁</option>
                        <option value={20}>20 / 頁</option>
                        <option value={50}>50 / 頁</option>
                    </select>
                    <button
                        onClick={() => fetchLogs(0)}
                        disabled={logsLoading}
                        className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 disabled:opacity-50"
                    >
                        搜尋
                    </button>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500 mb-3">
                    <span>顯示 {logs.length} / {logTotal}</span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => fetchLogs(Math.max(0, logPage - 1))}
                            disabled={logsLoading || logPage === 0}
                            className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-50"
                        >
                            上一頁
                        </button>
                        <button
                            onClick={() => fetchLogs(logPage + 1)}
                            disabled={logsLoading || (logPage + 1) * logLimit >= logTotal}
                            className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-50"
                        >
                            下一頁
                        </button>
                    </div>
                </div>
                {logs.length ? (
                    <div className="space-y-2">
                        {logs.map((log, idx) => (
                            <div key={idx} className="text-xs text-gray-600 bg-gray-50 border rounded p-2">
                                <div className="flex justify-between">
                                    <span className="font-medium text-gray-700">{log.type}</span>
                                    <span className="text-gray-400">{log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}</span>
                                </div>
                                <div className="mt-1">{highlightText(log.text || '', logQuery)}</div>
                                {log.userId && (
                                    <div className="text-[11px] text-gray-400">
                                        userId: {highlightText(log.userId, logQuery)}
                                    </div>
                                )}
                                {log.meta && (
                                    <button
                                        onClick={() => setExpandedLog(expandedLog === idx ? null : idx)}
                                        className="mt-1 text-[11px] text-blue-600 hover:underline"
                                    >
                                        {expandedLog === idx ? '隱藏 meta' : '顯示 meta'}
                                    </button>
                                )}
                                {log.meta && expandedLog === idx && (
                                    <pre className="mt-2 text-[10px] bg-white border rounded p-2 overflow-x-auto">
                                        {JSON.stringify(log.meta, null, 2)}
                                    </pre>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-4 bg-gray-50 rounded border border-dashed text-xs text-gray-400">
                        暫無紀錄
                    </div>
                )}
            </div>
        </div>
    );
}
