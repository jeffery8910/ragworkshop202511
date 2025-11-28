'use client';

import { useEffect, useMemo, useState } from 'react';
import { Network, FileText, RefreshCw, Info, Trash2 } from 'lucide-react';

interface KnowledgeGraphProps {
    onAction?: (msg: string) => void;
}

interface IndexedFile {
    name: string;
    count: number;
    status: 'Indexed' | 'Pending';
}

const buildFileList = (vecs: { source: string }[]): IndexedFile[] => {
    const counter: Record<string, number> = {};
    vecs.forEach(v => {
        counter[v.source] = (counter[v.source] || 0) + 1;
    });
    return Object.entries(counter).map(([name, count]) => ({
        name,
        count,
        status: 'Indexed',
    }));
};

export default function KnowledgeGraph({ onAction }: KnowledgeGraphProps) {
    const [loading, setLoading] = useState(false);
    const [vectors, setVectors] = useState<any[]>([]);
    const [selected, setSelected] = useState<any | null>(null);
    const [activeFile, setActiveFile] = useState<string | null>(null);
    const [indexedFiles, setIndexedFiles] = useState<IndexedFile[]>([]);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const hashToPos = (id: string, dim: number) => {
        let h = 0;
        for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
        return (h % 10000) / 100 * dim;
    };

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/documents');
            const text = await res.text();
            let data: any = {};
            try { data = text ? JSON.parse(text) : {}; } catch (e) {
                throw new Error(text.slice(0, 200) || '取得文件列表失敗 (非 JSON)');
            }
            if (!res.ok) throw new Error(data?.error || text || '取得文件列表失敗');

            const files = (data.documents || []).map((d: any) => ({
                name: d.filename,
                count: d.chunks,
                status: 'Indexed'
            }));
            setIndexedFiles(files);

            const chunks = (data.chunks || []).map((c: any, idx: number) => ({
                id: c.chunkId || idx,
                x: hashToPos(c.chunkId || String(idx), 1),
                y: hashToPos((c.chunkId || String(idx)) + 'y', 1),
                title: `Chunk ${c.chunk ?? idx}`,
                source: c.source || 'unknown',
                len: c.text_length,
                indexedAt: c.indexed_at || Date.now(),
            }));

            setVectors(chunks);
            if (chunks.length) {
                setSelected(chunks[0]);
                setActiveFile(chunks[0].source);
            }
            onAction?.('已載入索引文件與節點');
        } catch (err: any) {
            console.error(err);
            setError(err?.message || '無法讀取索引資料');
            onAction?.('讀取索引資料失敗');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRefresh = () => {
        fetchData();
    };

    const onMouseDown = (e: React.MouseEvent) => {
        setDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!dragging || !dragStart) return;
        setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    };

    const onMouseUp = () => {
        setDragging(false);
        setDragStart(null);
    };

    const onWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        setZoom(z => Math.min(2.5, Math.max(0.5, z + delta)));
    };

    const resetView = () => {
        setPan({ x: 0, y: 0 });
        setZoom(1);
    };

    const focusFile = (fileName: string) => {
        const target = vectors.find(v => v.source === fileName) || null;
        setActiveFile(fileName);
        setSelected(target);
        onAction?.(`聚焦檔案 ${fileName}`);
    };

    const deleteFile = (fileName: string) => {
        if (!confirm(`確定要刪除檔案「${fileName}」？相關向量也會一起移除（僅前端模擬）。`)) return;
        setIndexedFiles(prev => prev.filter(f => f.name !== fileName));
        setVectors(prev => prev.filter(v => v.source !== fileName));
        if (selected?.source === fileName) {
            setSelected(null);
            setActiveFile(null);
        }
        onAction?.(`已刪除檔案 ${fileName}`);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md h-full">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Network className="w-5 h-5 text-purple-600" /> 知識庫視覺化 (Knowledge Graph)
                </h2>
                <button
                    onClick={handleRefresh}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    disabled={loading}
                >
                    <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div
                className="relative w-full h-80 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden mb-4"
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onWheel={onWheel}
                onDoubleClick={resetView}
            >
                <div
                    className="absolute inset-0"
                    style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
                >
                    {vectors.map((v) => (
                        <div
                            key={v.id}
                            className={`absolute w-3 h-3 rounded-full cursor-pointer transition-transform shadow-sm ${
                                selected?.id === v.id
                                    ? 'bg-orange-500 ring-4 ring-orange-200 scale-125'
                                : activeFile === v.source
                                    ? 'bg-blue-500 ring-2 ring-blue-200'
                                    : 'bg-purple-500 hover:bg-purple-700 hover:scale-150'
                            }`}
                            style={{ left: `${v.x}%`, top: `${v.y}%` }}
                            onClick={() => {
                                setSelected(v);
                                setActiveFile(v.source);
                                onAction?.(`檢視節點 ${v.id}`);
                            }}
                            title={`ID: ${v.id} | ${v.title} (${v.source})`}
                        />
                    ))}
                </div>
                <div className="absolute bottom-2 right-2 text-xs text-gray-400 px-2 py-1 bg-white/80 rounded">
                    2D Projection (t-SNE) | 拖曳平移，滾輪縮放，雙擊重置
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                    <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> 節點詳情
                    </h3>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-2">
                        {selected ? (
                            <>
                                <div className="flex justify-between text-sm text-gray-700">
                                    <span className="text-gray-500">ID</span>
                                    <span>{selected.id}</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-700">
                                    <span className="text-gray-500">標題</span>
                                    <span>{selected.title}</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-700">
                                    <span className="text-gray-500">來源</span>
                                    <span>{selected.source}</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-700">
                                    <span className="text-gray-500">座標</span>
                                    <span>{selected.x.toFixed(2)}, {selected.y.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-700">
                                    <span className="text-gray-500">Chunk 長度</span>
                                    <span>{selected.len ?? '-'} chars</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-700">
                                    <span className="text-gray-500">索引時間</span>
                                    <span>{selected.indexedAt ? new Date(selected.indexedAt).toLocaleString() : '-'}</span>
                                </div>
                                <div className="text-xs text-gray-500">
                                    * 模擬資料；接到真實檢索結果後可回傳 metadata.text_length、indexed_at 等欄位直接顯示。
                                </div>
                            </>
                        ) : (
                            <div className="text-sm text-gray-500">點選左側節點或檔案以查看細節</div>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Info className="w-4 h-4 text-blue-600" /> 索引檔案列表
                    </h3>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-2 max-h-64 overflow-auto">
                        {indexedFiles.length === 0 ? (
                            <div className="text-sm text-gray-500">{loading ? '讀取中...' : '尚無已索引檔案'}</div>
                        ) : (
                            indexedFiles.map((file) => (
                                <div
                                    key={file.name}
                                    className={`flex justify-between items-center p-2 rounded border transition-colors ${
                                        activeFile === file.name
                                            ? 'bg-blue-50 border-blue-200'
                                            : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                                    }`}
                                >
                                    <button
                                        className="flex-1 text-left text-sm text-gray-800"
                                        onClick={() => focusFile(file.name)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span>{file.name}</span>
                                            <span className="text-xs text-gray-500">({file.count} chunks)</span>
                                        </div>
                                    </button>
                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded mr-2">
                                        {file.status}
                                    </span>
                                    <button
                                        onClick={() => deleteFile(file.name)}
                                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                        aria-label={`刪除 ${file.name}`}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-3 text-xs text-gray-500">
                提示：點擊索引檔案會同步聚焦上方節點；雙擊畫布重置視角，滑鼠滾輪縮放，拖曳可平移。
                {error && <div className="text-red-600 mt-1">讀取失敗：{error}</div>}
            </div>
        </div>
    );
}
