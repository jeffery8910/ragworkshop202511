'use client';

import { useState, useEffect } from 'react';
import { Network, FileText, RefreshCw } from 'lucide-react';

// Mock data for visualization if real data is not available or too expensive to fetch
const MOCK_VECTORS = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    title: `Chunk ${i + 1}`,
    source: i % 2 === 0 ? 'calculus_intro.pdf' : 'physics_basics.pdf'
}));

export default function KnowledgeGraph() {
    const [loading, setLoading] = useState(false);
    const [vectors, setVectors] = useState(MOCK_VECTORS);

    const handleRefresh = () => {
        setLoading(true);
        // Simulate fetch
        setTimeout(() => {
            setVectors(Array.from({ length: 20 }, (_, i) => ({
                id: i,
                x: Math.random() * 100,
                y: Math.random() * 100,
                title: `Chunk ${i + 1}`,
                source: i % 3 === 0 ? 'history.pdf' : 'science.pdf'
            })));
            setLoading(false);
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

            <div className="relative w-full h-[400px] bg-gray-50 rounded-lg border border-gray-200 overflow-hidden mb-4">
                {/* Simple Scatter Plot Visualization */}
                {vectors.map((v) => (
                    <div
                        key={v.id}
                        className="absolute w-3 h-3 bg-purple-500 rounded-full hover:bg-purple-700 cursor-pointer transition-transform hover:scale-150 shadow-sm"
                        style={{ left: `${v.x}%`, top: `${v.y}%` }}
                        title={`${v.title} (${v.source})`}
                    />
                ))}
                <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                    2D Projection (t-SNE)
                </div>
            </div>

            <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> 索引檔案列表
                </h3>
                <div className="text-sm text-gray-600 space-y-1 max-h-32 overflow-y-auto">
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
        </div>
    );
}
