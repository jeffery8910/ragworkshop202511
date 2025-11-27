'use client';

import { useState } from 'react';
import { Network, FileText, RefreshCw, Info } from 'lucide-react';

// Mock data for visualization if real data is not available or too expensive to fetch
const MOCK_VECTORS = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    title: `Chunk ${i + 1}`,
    source: i % 2 === 0 ? 'calculus_intro.pdf' : 'physics_basics.pdf',
    len: 180 + Math.floor(Math.random() * 400),
    indexedAt: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24),
}));

interface KnowledgeGraphProps {
    onAction?: (msg: string) => void;
}

export default function KnowledgeGraph({ onAction }: KnowledgeGraphProps) {
    const [loading, setLoading] = useState(false);
    const [vectors, setVectors] = useState(MOCK_VECTORS);
    const [selected, setSelected] = useState<typeof MOCK_VECTORS[number] | null>(MOCK_VECTORS[0]);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

    const handleRefresh = () => {
        setLoading(true);
        setTimeout(() => {
            const refreshed = Array.from({ length: 20 }, (_, i) => ({
                id: i,
                x: Math.random() * 100,
                y: Math.random() * 100,
                title: `Chunk ${i + 1}`,
                source: i % 3 === 0 ? 'history.pdf' : 'science.pdf',
                len: 180 + Math.floor(Math.random() * 400),
                indexedAt: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24),
            }));
            setVectors(refreshed);
            setSelected(refreshed[0]);
            setLoading(false);
            onAction?.('更新向量視覺化');
        }, 1000);
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
                                    : 'bg-purple-500 hover:bg-purple-700 hover:scale-150'
                            }`}
                            style={{ left: `${v.x}%`, top: `${v.y}%` }}
                            onClick={() => {
                                setSelected(v);
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
                        <FileText className="w-4 h-4" /> 節點詳細
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
                                <div className="flex justify-between text-sm text-gray-700">
                                    <span className="text-gray-500">相似度</span>
                                    <span>{(100 - Math.abs(selected.x - selected.y)).toFixed(2)}%</span>
                                </div>
                                <div className="text-xs text-gray-500">
                                    * 模擬資料；實際可返回 chunk 長度、向量維度、索引時間等欄位。
                                </div>
                            </>
                        ) : (
                            <div className="text-sm text-gray-500">點擊圖上節點查看資訊</div>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Info className="w-4 h-4 text-blue-600" /> 索引檔案列表
                    </h3>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-2 max-h-64 overflow-auto">
                        {['calculus_intro.pdf', 'physics_basics.pdf', 'history_of_math.txt'].map((f, i) => (
                            <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded border border-gray-100">
                                <span className="text-sm text-gray-700">{f}</span>
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Indexed</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-3 text-xs text-gray-500">
                提示：點擊節點可查看 ID、標題、來源與座標；重新整理可更新佈局以檢視不同分佈。
            </div>
        </div>
    );
}
