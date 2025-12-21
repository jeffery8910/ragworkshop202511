'use client';

import { useEffect, useMemo, useState } from 'react';
import { Folder, FileText, RefreshCw, Trash2, ShieldCheck } from 'lucide-react';
import { adminFetch } from '@/lib/client/adminFetch';
import { useToast } from '@/components/ui/ToastProvider';
import Skeleton from '@/components/ui/Skeleton';

interface DocumentItem {
    docId: string;
    filename?: string;
    status?: string;
    chunks?: number;
    indexedAt?: string;
    size?: number;
    type?: string;
    mode?: string;
    note?: string;
}

interface FileManagementPanelProps {
    onAction?: (msg: string) => void;
}

export default function FileManagementPanel({ onAction }: FileManagementPanelProps) {
    const [loading, setLoading] = useState(false);
    const [docs, setDocs] = useState<DocumentItem[]>([]);
    const [query, setQuery] = useState('');
    const [order, setOrder] = useState<'asc' | 'desc'>('desc');
    const [deleteEnabled, setDeleteEnabled] = useState(false);
    const [deletingDoc, setDeletingDoc] = useState<string | null>(null);
    const { pushToast } = useToast();

    const fetchDocs = async () => {
        setLoading(true);
        try {
            const res = await adminFetch('/api/admin/documents', { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '\u8b80\u53d6\u6587\u4ef6\u5931\u6557');
            setDocs(data.documents || []);
            onAction?.(`\u5df2\u66f4\u65b0\u6587\u4ef6\u6e05\u55ae\uff1a${(data.documents || []).length} \u7b46`);
        } catch (e: any) {
            console.error(e);
            pushToast({ type: 'error', message: e?.message || '\u8b80\u53d6\u6587\u4ef6\u5931\u6557' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocs();
    }, []);

    const filteredDocs = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        const base = keyword
            ? docs.filter(d =>
                (d.filename || '').toLowerCase().includes(keyword) ||
                d.docId.toLowerCase().includes(keyword)
            )
            : [...docs];
        return base.sort((a, b) => {
            const at = a.indexedAt ? new Date(a.indexedAt).getTime() : 0;
            const bt = b.indexedAt ? new Date(b.indexedAt).getTime() : 0;
            return order === 'desc' ? bt - at : at - bt;
        });
    }, [docs, order, query]);

    const removeDoc = async (doc: DocumentItem) => {
        if (!deleteEnabled || deletingDoc) return;
        const ok = confirm(`\u78ba\u5b9a\u522a\u9664\u300c${doc.filename || doc.docId}\u300d\u7684\u5411\u91cf\u8207\u7d00\u9304\uff1f`);
        if (!ok) return;
        setDeletingDoc(doc.docId);
        try {
            const res = await adminFetch('/api/admin/index', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scope: 'doc', docId: doc.docId }),
            });
            const data = await res.json();
            if (!res.ok || !data?.ok) throw new Error(data?.error || '\u522a\u9664\u5931\u6557');
            pushToast({ type: 'success', message: '\u6587\u4ef6\u5df2\u522a\u9664' });
            onAction?.(`\u5df2\u522a\u9664\u6587\u4ef6 ${doc.filename || doc.docId}`);
            await fetchDocs();
        } catch (e: any) {
            console.error(e);
            pushToast({ type: 'error', message: e?.message || '\u522a\u9664\u5931\u6557' });
        } finally {
            setDeletingDoc(null);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-emerald-500">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
                    <Folder className="w-5 h-5 text-emerald-600" /> {'\u6587\u4ef6\u7ba1\u7406'}
                </h2>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-gray-500">
                        <input
                            type="checkbox"
                            checked={deleteEnabled}
                            onChange={e => setDeleteEnabled(e.target.checked)}
                        />
                        {'\u555f\u7528\u522a\u9664'}
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    </label>
                    <button
                        onClick={fetchDocs}
                        disabled={loading}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        title="\u91cd\u65b0\u6574\u7406"
                    >
                        <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center mb-3">
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="\u641c\u5c0b\u6a94\u540d / docId"
                    className="flex-1 min-w-[160px] border rounded px-2 py-1 text-xs"
                />
                <select
                    value={order}
                    onChange={e => setOrder(e.target.value as 'asc' | 'desc')}
                    className="border rounded px-2 py-1 text-xs"
                >
                    <option value="desc">{'\u6700\u65b0'}</option>
                    <option value="asc">{'\u6700\u820a'}</option>
                </select>
            </div>

            <div className="text-xs text-gray-500 mb-3">
                {'\u986f\u793a'} {filteredDocs.length} / {docs.length}
            </div>

            {loading && docs.length === 0 ? (
                <div className="space-y-2">
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                </div>
            ) : filteredDocs.length === 0 ? (
                <div className="text-sm text-gray-500 bg-gray-50 border border-dashed rounded p-4 text-center">
                    {'\u5c1a\u7121\u6587\u4ef6\u7d00\u9304'}
                </div>
            ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {filteredDocs.map(doc => {
                        const statusClass = doc.status === 'processing'
                            ? 'bg-amber-100 text-amber-700'
                            : doc.status === 'failed'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-green-100 text-green-700';
                        const statusLabel = doc.status === 'processing'
                            ? '\u8655\u7406\u4e2d'
                            : doc.status === 'failed'
                                ? '\u5931\u6557'
                                : '\u5df2\u7d22\u5f15';
                        return (
                            <div key={doc.docId} className="flex items-start justify-between gap-3 bg-gray-50 border rounded p-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-gray-600" />
                                        <span className="text-sm font-medium text-gray-800 truncate">{doc.filename || '\u672a\u547d\u540d\u6a94\u6848'}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1 space-y-1">
                                        <div className="break-all">docId: {doc.docId}</div>
                                        <div>
                                            {typeof doc.chunks === 'number' ? `Chunks: ${doc.chunks}` : 'Chunks: -'}
                                            {doc.mode ? ` | \u6a21\u5f0f: ${doc.mode}` : ''}
                                            {typeof doc.size === 'number' ? ` | \u5927\u5c0f: ${(doc.size / 1024).toFixed(1)} KB` : ''}
                                        </div>
                                        {doc.indexedAt && <div>{'\u7d22\u5f15\u6642\u9593'}: {new Date(doc.indexedAt).toLocaleString()}</div>}
                                        {doc.note && <div className="text-[11px] text-gray-400">{doc.note}</div>}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                    <span className={`text-[11px] px-2 py-1 rounded-full ${statusClass}`}>
                                        {statusLabel}
                                    </span>
                                    {deleteEnabled && (
                                        <button
                                            onClick={() => removeDoc(doc)}
                                            disabled={!!deletingDoc}
                                            className="text-[11px] px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-60 flex items-center gap-1"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            {deletingDoc === doc.docId ? '\u522a\u9664\u4e2d' : '\u522a\u9664'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
