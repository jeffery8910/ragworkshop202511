'use client';

import { useState } from 'react';
import { Network, FileText, RefreshCw, Info } from 'lucide-react';

// Mock data for visualization if real data is not available or too expensive to fetch
const MOCK_VECTORS = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    title: `Chunk ${i + 1}`,
    source: i % 2 === 0 ? 'calculus_intro.pdf' : 'physics_basics.pdf'
}));

interface KnowledgeGraphProps {
    onAction?: (msg: string) => void;
}

export default function KnowledgeGraph({ onAction }: KnowledgeGraphProps) {
    const [loading, setLoading] = useState(false);
    const [vectors, setVectors] = useState(MOCK_VECTORS);
    const [selected, setSelected] = useState<typeof MOCK_VECTORS[number] | null>(MOCK_VECTORS[0]);

    const handleRefresh = () => {
        setLoading(true);
        setTimeout(() => {
            const refreshed = Array.from({ length: 20 }, (_, i) => ({
                id: i,
                x: Math.random() * 100,
                y: Math.random() * 100,
                title: `Chunk ${i + 1}`,
                source: i % 3 === 0 ? 'history.pdf' : 'science.pdf'
            }));
            setVectors(refreshed);
            setSelected(refreshed[0]);
            setLoading(false);
            onAction?.('更新向量視覺化');
        }, 1000);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md h-full">
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

            <div className="relative w-full h-72 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden mb-4">
                {vectors.map((v) => (
                    <div
                        key={v.id}
                        className={`absolute w-3 h-3 rounded-full cursor-pointer transition-transform shadow-sm ${
                            selected?.id === v.id
                                ? 'bg-orange-500 ring-4 ring-orange-200 scale-125'
                                : 'bg-purple-500 hover:bg-purple-700 hover:scale-150'
                        }`}
                        style={{ left: `${v.x}%`, top: `${v.y}%` }}
                        onClick={() => setSelected(v)}
                        title={`ID: ${v.id} | ${v.title} (${v.source})`}
                    />
                ))}
                <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                    2D Projection (t-SNE)
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-2">
                    <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> 索引檔案列表
                    </h3>
                    <div className="text-sm text-gray-600 space-y-1 max-h-40 overflow-y-auto">
                        <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span>calculus_intro.pdf</span>
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Indexed</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span>physics_basics.pdf</span>
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Indexed</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span>history_of_math.txt</span>
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Processing</span>
                        </div>
                    </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                        <Info className="w-4 h-4 text-blue-600" /> 節點資訊
                    </div>
                    {selected ? (
                        <div className="text-sm text-gray-700 space-y-1">
                            <div className="flex justify-between"><span className="text-gray-500">ID</span><span>{selected.id}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">標題</span><span>{selected.title}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">來源</span><span>{selected.source}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">座標</span><span>{selected.x.toFixed(2)}, {selected.y.toFixed(2)}</span></div>
                        </div>
                    ) : (
                        <div className="text-sm text-gray-500">點擊圖上的節點以查看詳細資訊。</div>
                    )}
                </div>
            </div>

            <div className="mt-3 text-xs text-gray-500">
                提示：點擊節點可查看 ID、標題、來源與座標；重新整理可更新佈局以檢視不同分佈。
            </div>
        </div>
    );
}
