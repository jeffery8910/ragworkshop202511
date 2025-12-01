'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Info, Share2, FileText, Search, X } from 'lucide-react';

interface KnowledgeGraphProps {
    onAction?: (msg: string) => void;
}

interface GraphNode {
    id: string;
    label: string;
    type: string;
    docId?: string;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
}

interface GraphEdge {
    source: string;
    target: string;
    relation: string;
}

interface DocumentMeta {
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

export default function KnowledgeGraph({ onAction }: KnowledgeGraphProps) {
    const [loading, setLoading] = useState(false);
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [documents, setDocuments] = useState<DocumentMeta[]>([]);
    const [docsLoading, setDocsLoading] = useState(false);
    const [docFilter, setDocFilter] = useState<string | null>(null);
    const [docSearch, setDocSearch] = useState('');
    
    // Viewport state
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [dragging, setDragging] = useState(false);
    const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
    const [draggedNode, setDraggedNode] = useState<GraphNode | null>(null);

    const canvasRef = useRef<HTMLDivElement>(null);
    const requestRef = useRef<number>(0);

    // Physics simulation parameters
    const REPULSION = 200;
    const ATTRACTION = 0.05;
    const DAMPING = 0.85;
    const CENTER_PULL = 0.02;

    const fetchGraph = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/graph');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch graph');

            // Initialize positions randomly
            const initNodes = (data.nodes || []).map((n: any) => ({
                ...n,
                x: Math.random() * 800 - 400,
                y: Math.random() * 600 - 300,
                vx: 0,
                vy: 0
            }));
            
            setNodes(initNodes);
            setEdges(data.edges || []);
            onAction?.(`已載入圖譜：${initNodes.length} 節點, ${data.edges?.length} 連線`);
        } catch (e: any) {
            console.error(e);
            onAction?.('讀取圖譜失敗: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchDocuments = async () => {
        setDocsLoading(true);
        try {
            const res = await fetch('/api/admin/documents', { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch documents');

            const mapped: DocumentMeta[] = (data.documents || []).map((d: any) => ({
                docId: d.docId,
                filename: d.filename || '未命名檔案',
                status: d.status || 'indexed',
                chunks: d.chunks,
                indexedAt: d.indexedAt,
                size: d.size,
                type: d.type,
                mode: d.mode,
                note: d.note
            }));

            setDocuments(mapped);
            onAction?.(`已載入文件清單：${mapped.length} 筆`);
        } catch (e: any) {
            console.error(e);
            onAction?.('讀取文件清單失敗: ' + e.message);
        } finally {
            setDocsLoading(false);
        }
    };

    useEffect(() => {
        fetchGraph();
        fetchDocuments();
    }, []);

    // Simple Force-Directed Layout Simulation
    const runSimulation = () => {
        setNodes(prevNodes => {
            const newNodes = prevNodes.map(n => ({ ...n }));
            const nodeMap = new Map(newNodes.map(n => [n.id, n]));

            // 1. Repulsion (Nodes push each other away)
            for (let i = 0; i < newNodes.length; i++) {
                for (let j = i + 1; j < newNodes.length; j++) {
                    const n1 = newNodes[i];
                    const n2 = newNodes[j];
                    const dx = n1.x! - n2.x!;
                    const dy = n1.y! - n2.y!;
                    const distSq = dx * dx + dy * dy || 1;
                    const force = REPULSION / Math.sqrt(distSq);
                    const fx = (dx / Math.sqrt(distSq)) * force;
                    const fy = (dy / Math.sqrt(distSq)) * force;

                    n1.vx! += fx;
                    n1.vy! += fy;
                    n2.vx! -= fx;
                    n2.vy! -= fy;
                }
            }

            // 2. Attraction (Edges pull connected nodes together)
            edges.forEach(edge => {
                const source = nodeMap.get(edge.source);
                const target = nodeMap.get(edge.target);
                if (source && target) {
                    const dx = target.x! - source.x!;
                    const dy = target.y! - source.y!;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    
                    const force = (dist - 100) * ATTRACTION; // 100 is ideal length
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;

                    source.vx! += fx;
                    source.vy! += fy;
                    target.vx! -= fx;
                    target.vy! -= fy;
                }
            });

            // 3. Center Pull (Keep graph centered) & Update Position
            newNodes.forEach(n => {
                if (n === draggedNode) return; // Don't move dragged node automatically

                n.vx! -= n.x! * CENTER_PULL;
                n.vy! -= n.y! * CENTER_PULL;

                n.vx! *= DAMPING;
                n.vy! *= DAMPING;

                // Limit max speed for stability
                const speed = Math.sqrt(n.vx! * n.vx! + n.vy! * n.vy!);
                if (speed > 10) {
                    n.vx! = (n.vx! / speed) * 10;
                    n.vy! = (n.vy! / speed) * 10;
                }

                n.x! += n.vx!;
                n.y! += n.vy!;
            });

            return newNodes;
        });

        requestRef.current = requestAnimationFrame(runSimulation);
    };

    useEffect(() => {
        if (nodes.length > 0) {
            requestRef.current = requestAnimationFrame(runSimulation);
        }
        return () => cancelAnimationFrame(requestRef.current);
    }, [nodes.length, edges.length, draggedNode]); // Restart when data changes or drag state changes

    // Interaction Handlers
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        setZoom(z => Math.min(3, Math.max(0.1, z + delta)));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        // Calculate mouse pos in graph coordinates
        const mouseX = (e.clientX - rect.left - rect.width/2 - pan.x) / zoom;
        const mouseY = (e.clientY - rect.top - rect.height/2 - pan.y) / zoom;

        // Check if clicked on a node
        const clickedNode = filteredGraph.nodes.find(n => {
            const dist = Math.sqrt(Math.pow(n.x! - mouseX, 2) + Math.pow(n.y! - mouseY, 2));
            return dist < 10; // 10 is node radius
        });

        if (clickedNode) {
            setDraggedNode(clickedNode);
            setSelectedNode(clickedNode);
            onAction?.(`選取實體: ${clickedNode.label}`);
        } else {
            setDragging(true);
        }
        setLastPos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!lastPos) return;
        const dx = e.clientX - lastPos.x;
        const dy = e.clientY - lastPos.y;
        setLastPos({ x: e.clientX, y: e.clientY });

        if (draggedNode) {
            // Move node
            setNodes(prev => prev.map(n => {
                if (n.id === draggedNode.id) {
                    return { ...n, x: n.x! + dx / zoom, y: n.y! + dy / zoom, vx: 0, vy: 0 };
                }
                return n;
            }));
        } else if (dragging) {
            // Pan view
            setPan(p => ({ x: p.x + dx, y: p.y + dy }));
        }
    };

    const handleMouseUp = () => {
        setDragging(false);
        setDraggedNode(null);
        setLastPos(null);
    };

    const filteredDocs = useMemo(() => {
        const keyword = docSearch.trim().toLowerCase();
        if (!keyword) return documents;
        return documents.filter(d =>
            (d.filename || '').toLowerCase().includes(keyword) ||
            d.docId.toLowerCase().includes(keyword)
        );
    }, [documents, docSearch]);

    const docMap = useMemo(() => new Map(documents.map(d => [d.docId, d])), [documents]);

    const docStats = useMemo(() => {
        const stats = new Map<string, { nodes: number; edges: number }>();
        const nodeDoc = new Map<string, string | undefined>();
        nodes.forEach(n => {
            nodeDoc.set(n.id, n.docId);
            if (n.docId) {
                const entry = stats.get(n.docId) || { nodes: 0, edges: 0 };
                entry.nodes += 1;
                stats.set(n.docId, entry);
            }
        });
        edges.forEach(e => {
            const sDoc = nodeDoc.get(e.source);
            const tDoc = nodeDoc.get(e.target);
            if (sDoc && sDoc === tDoc) {
                const entry = stats.get(sDoc) || { nodes: 0, edges: 0 };
                entry.edges += 1;
                stats.set(sDoc, entry);
            }
        });
        return stats;
    }, [nodes, edges]);

    const filteredGraph = useMemo(() => {
        const n = docFilter ? nodes.filter(node => node.docId === docFilter) : nodes;
        const idSet = new Set(n.map(node => node.id));
        const e = edges.filter(edge => idSet.has(edge.source) && idSet.has(edge.target));
        return { nodes: n, edges: e };
    }, [nodes, edges, docFilter]);

    const toggleDocFilter = (docId: string) => {
        setSelectedNode(null);
        setDocFilter(prev => {
            if (prev === docId) {
                onAction?.('已清除文件過濾，顯示全部節點');
                return null;
            }
            onAction?.(`只顯示文件 ${docId} 的節點`);
            return docId;
        });
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-purple-600" /> 知識圖譜 (Knowledge Graph)
                </h2>
                <div className="flex gap-2 items-center">
                    {docFilter && (
                        <button
                            onClick={() => setDocFilter(null)}
                            className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full flex items-center gap-1 hover:bg-purple-200"
                        >
                            <X className="w-3 h-3" /> 清除文件篩選
                        </button>
                    )}
                    <button
                        onClick={fetchGraph}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        disabled={loading}
                        title="重新整理圖譜"
                    >
                        <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="flex flex-1 gap-4 min-h-0">
                {/* Graph Canvas */}
                <div 
                    ref={canvasRef}
                    className="flex-1 bg-slate-50 rounded-xl border border-slate-200 relative overflow-hidden cursor-move"
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {nodes.length === 0 && !loading && (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                            尚無圖譜資料，請至文件管理執行「重新索引」以生成圖譜。
                        </div>
                    )}

                    {docFilter && filteredGraph.nodes.length === 0 && nodes.length > 0 && !loading && (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm px-6 text-center">
                            這個文件目前沒有圖譜節點，請嘗試重新索引或選擇其他文件。
                        </div>
                    )}
                    
                    <svg className="w-full h-full pointer-events-none">
                        <g transform={`translate(${pan.x + (canvasRef.current?.clientWidth || 0)/2}, ${pan.y + (canvasRef.current?.clientHeight || 0)/2}) scale(${zoom})`}>
                            {/* Edges */}
                            {filteredGraph.edges.map((e, i) => {
                                const source = filteredGraph.nodes.find(n => n.id === e.source);
                                const target = filteredGraph.nodes.find(n => n.id === e.target);
                                if (!source || !target) return null;
                                return (
                                    <g key={`${e.source}-${e.target}-${i}`}>
                                        <line
                                            x1={source.x} y1={source.y}
                                            x2={target.x} y2={target.y}
                                            stroke="#cbd5e1"
                                            strokeWidth="1"
                                        />
                                        {zoom > 0.8 && (
                                            <text 
                                                x={(source.x! + target.x!) / 2} 
                                                y={(source.y! + target.y!) / 2}
                                                textAnchor="middle"
                                                fill="#94a3b8"
                                                fontSize="8"
                                                className="select-none"
                                            >
                                                {e.relation}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                            
                            {/* Nodes */}
                            {filteredGraph.nodes.map((n) => (
                                <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
                                    <circle
                                        r={selectedNode?.id === n.id ? 8 : 5}
                                        fill={n.type === 'Person' ? '#f87171' : n.type === 'Organization' ? '#60a5fa' : '#a78bfa'}
                                        stroke="#fff"
                                        strokeWidth="1.5"
                                        className="pointer-events-auto cursor-pointer hover:opacity-80 transition-all"
                                    />
                                    {zoom > 0.5 && (
                                        <text
                                            y={-8}
                                            textAnchor="middle"
                                            fill="#475569"
                                            fontSize="10"
                                            fontWeight="500"
                                            className="select-none pointer-events-none bg-white"
                                            style={{ textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}
                                        >
                                            {n.label}
                                        </text>
                                    )}
                                </g>
                            ))}
                        </g>
                    </svg>

                    <div className="absolute bottom-2 right-2 text-[10px] text-slate-400 px-2 py-1 bg-white/80 rounded">
                        紅: 人物 | 藍: 組織 | 紫: 其他
                    </div>
                </div>

                {/* Side Panel */}
                <div className="w-80 flex flex-col gap-3 min-h-0">
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-3">
                            <Info className="w-4 h-4 text-blue-600" /> 節點詳情
                        </h3>
                        {selectedNode ? (
                            <div className="space-y-3 text-sm">
                                <div>
                                    <label className="text-xs text-gray-500 block">名稱 (Label)</label>
                                    <div className="font-medium text-gray-800">{selectedNode.label}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block">類型 (Type)</label>
                                    <div className={`inline-block px-2 py-0.5 rounded text-xs ${
                                        selectedNode.type === 'Person' ? 'bg-red-50 text-red-700' : 
                                        selectedNode.type === 'Organization' ? 'bg-blue-50 text-blue-700' : 
                                        'bg-purple-50 text-purple-700'
                                    }`}>
                                        {selectedNode.type}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block">ID</label>
                                    <div className="text-gray-400 text-xs break-all">{selectedNode.id}</div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-500 block">來源文件</label>
                                    <div className="text-sm text-gray-800">
                                        {selectedNode.docId
                                            ? (docMap.get(selectedNode.docId)?.filename || '未命名檔案')
                                            : '未標註文件'}
                                    </div>
                                    {selectedNode.docId && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-400 text-[11px] break-all">{selectedNode.docId}</span>
                                            <button
                                                className="text-[11px] text-purple-700 bg-purple-50 px-2 py-1 rounded hover:bg-purple-100"
                                                onClick={() => toggleDocFilter(selectedNode.docId!)}
                                            >
                                                {docFilter === selectedNode.docId ? '取消篩選' : '只看此文件'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500 py-4 text-center">
                                點擊圖中節點查看詳細資訊
                            </div>
                        )}
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex-1 min-h-[220px] overflow-hidden">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-emerald-600" /> 文件列表
                            </h3>
                            <button
                                onClick={fetchDocuments}
                                disabled={docsLoading}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                title="重新整理文件列表"
                            >
                                <RefreshCw className={`w-4 h-4 text-gray-500 ${docsLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        <div className="flex items-center gap-2 mb-3">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                <input
                                    value={docSearch}
                                    onChange={e => setDocSearch(e.target.value)}
                                    placeholder="搜尋檔名或 docId"
                                    className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200"
                                />
                            </div>
                            {docFilter && (
                                <button
                                    onClick={() => setDocFilter(null)}
                                    className="text-xs text-purple-700 bg-purple-50 px-3 py-2 rounded hover:bg-purple-100"
                                >
                                    顯示全部
                                </button>
                            )}
                        </div>

                        {docsLoading ? (
                            <div className="text-center py-6 text-gray-500">讀取文件中...</div>
                        ) : filteredDocs.length > 0 ? (
                            <div className="space-y-2 overflow-y-auto max-h-72 pr-1">
                                {filteredDocs.map(doc => {
                                    const stat = docStats.get(doc.docId);
                                    const statusClass = doc.status === 'processing'
                                        ? 'bg-amber-100 text-amber-700'
                                        : doc.status === 'failed'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-green-100 text-green-700';
                                    const statusLabel = doc.status === 'processing' ? '處理中' : doc.status === 'failed' ? '失敗' : '已索引';
                                    return (
                                        <div
                                            key={doc.docId}
                                            className={`p-3 border rounded-lg cursor-pointer transition-colors ${docFilter === doc.docId ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-gray-50 hover:border-purple-300'}`}
                                            onClick={() => toggleDocFilter(doc.docId)}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="w-4 h-4 text-gray-600" />
                                                        <span className="text-sm font-medium text-gray-800 truncate">{doc.filename}</span>
                                                    </div>
                                                    <p className="text-[11px] text-gray-500 mt-1 break-all">docId: {doc.docId}</p>
                                                    <p className="text-[11px] text-gray-500">
                                                        Nodes: {stat?.nodes || 0} / Edges: {stat?.edges || 0}
                                                        {typeof doc.chunks === 'number' ? ` | Chunks: ${doc.chunks}` : ''}
                                                    </p>
                                                    {doc.indexedAt && (
                                                        <p className="text-[11px] text-gray-400">索引時間: {new Date(doc.indexedAt).toLocaleString()}</p>
                                                    )}
                                                </div>
                                                <span className={`text-[11px] px-2 py-1 rounded-full flex-shrink-0 ${statusClass}`}>
                                                    {statusLabel}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                                目前沒有文件，請先上傳或重新整理。
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
