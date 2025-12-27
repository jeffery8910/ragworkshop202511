'use client';

import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { RefreshCw, Info, Share2, FileText, Search, X, GitBranch } from 'lucide-react';
import { adminFetch } from '@/lib/client/adminFetch';
import { useToast } from '@/components/ui/ToastProvider';
import { useSearchParams } from 'next/navigation';

interface KnowledgeGraphProps {
    onAction?: (msg: string) => void;
}

type SideTabKey = 'node' | 'evidence' | 'path' | 'docs';

const SIDE_TABS: Array<{ id: SideTabKey; label: string; icon: ComponentType<{ className?: string }> }> = [
    { id: 'node', label: '節點', icon: Info },
    { id: 'evidence', label: '標示', icon: Search },
    { id: 'path', label: '路徑', icon: GitBranch },
    { id: 'docs', label: '文件', icon: FileText },
];

interface GraphNode {
    id: string;
    label: string;
    type: string;
    docId?: string;
    sectionId?: string;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
}

interface GraphEdge {
    source: string;
    target: string;
    relation: string;
    docId?: string;
    sectionId?: string;
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
    const [reindexingDoc, setReindexingDoc] = useState<string | null>(null);
    const [sideTab, setSideTab] = useState<SideTabKey>('node');
    
    // Viewport state
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [dragging, setDragging] = useState(false);
    const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
    const [draggedNode, setDraggedNode] = useState<GraphNode | null>(null);
    const { pushToast } = useToast();
    const searchParams = useSearchParams();

    const [evidenceQuery, setEvidenceQuery] = useState('');
    const [evidenceMaxNodes, setEvidenceMaxNodes] = useState(20);
    const [evidenceMaxEdges, setEvidenceMaxEdges] = useState(60);
    const [matchedNodeIds, setMatchedNodeIds] = useState<string[]>([]);
    const [relatedNodeIds, setRelatedNodeIds] = useState<string[]>([]);
    const [highlightEdgeKeys, setHighlightEdgeKeys] = useState<string[]>([]);
    const [evidenceDocIds, setEvidenceDocIds] = useState<string[]>([]);
    const [pathNodeIds, setPathNodeIds] = useState<string[]>([]);
    const [pathEdgeKeys, setPathEdgeKeys] = useState<string[]>([]);
    const [pathSummary, setPathSummary] = useState<string>('');
    const [pathMaxHops, setPathMaxHops] = useState(3);
    const [allowCrossDoc, setAllowCrossDoc] = useState(true);
    const [startQuery, setStartQuery] = useState('');
    const [endQuery, setEndQuery] = useState('');
    const [startOptions, setStartOptions] = useState<GraphNode[]>([]);
    const [endOptions, setEndOptions] = useState<GraphNode[]>([]);
    const [startNode, setStartNode] = useState<GraphNode | null>(null);
    const [endNode, setEndNode] = useState<GraphNode | null>(null);

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
            const res = await adminFetch('/api/admin/graph');
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
            const res = await adminFetch('/api/admin/documents', { cache: 'no-store' });
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

    const edgeKey = (edge: GraphEdge) => `${edge.source}__${edge.relation}__${edge.target}`;

    const runEvidence = async (query?: string, opts?: { maxNodes?: number; maxEdges?: number }) => {
        const q = (query ?? evidenceQuery).trim();
        if (!q) return;
        const maxNodes = opts?.maxNodes ?? evidenceMaxNodes;
        const maxEdges = opts?.maxEdges ?? evidenceMaxEdges;
        try {
            const res = await adminFetch('/api/admin/graph/evidence', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: q, maxNodes, maxEdges })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '查詢失敗');

            const relatedIds = (data.nodes || []).map((n: any) => n.id);
            const matchedIds = data.matchedNodeIds || relatedIds;
            const edgeKeys = (data.edges || []).map((e: any) => edgeKey(e));
            const docIds = data.docIds || [];

            setEvidenceQuery(q);
            setRelatedNodeIds(relatedIds);
            setMatchedNodeIds(matchedIds);
            setHighlightEdgeKeys(edgeKeys);
            setEvidenceDocIds(docIds);
            setPathNodeIds([]);
            setPathEdgeKeys([]);
            setPathSummary('');

            onAction?.(`圖譜標示：${matchedIds.length} 節點 / ${(data.edges || []).length} 關係 (maxNodes=${maxNodes}, maxEdges=${maxEdges})`);
        } catch (e: any) {
            console.error(e);
            pushToast({ type: 'error', message: e?.message || 'Graph evidence 查詢失敗' });
        }
    };

    const clearHighlight = () => {
        setMatchedNodeIds([]);
        setRelatedNodeIds([]);
        setHighlightEdgeKeys([]);
        setEvidenceDocIds([]);
        setPathNodeIds([]);
        setPathEdgeKeys([]);
        setPathSummary('');
    };

    const clearPath = () => {
        setPathNodeIds([]);
        setPathEdgeKeys([]);
        setPathSummary('');
    };

    const searchNodes = async (term: string, target: 'start' | 'end') => {
        const q = term.trim();
        if (!q) return;
        try {
            const res = await adminFetch(`/api/admin/graph/search?q=${encodeURIComponent(q)}&limit=8`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '搜尋失敗');
            if (target === 'start') setStartOptions(data.nodes || []);
            if (target === 'end') setEndOptions(data.nodes || []);
        } catch (e: any) {
            console.error(e);
            pushToast({ type: 'error', message: e?.message || '搜尋節點失敗' });
        }
    };

    const runPath = async (opts?: { maxHops?: number; allowCrossDoc?: boolean }) => {
        if (!startNode || !endNode) return;
        const maxHops = opts?.maxHops ?? pathMaxHops;
        const crossDoc = typeof opts?.allowCrossDoc === 'boolean' ? opts.allowCrossDoc : allowCrossDoc;
        try {
            const res = await adminFetch('/api/admin/graph/path', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromNodeId: startNode.id,
                    toNodeId: endNode.id,
                    maxHops,
                    allowCrossDoc: crossDoc
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '路徑查詢失敗');
            const pNodes = data.pathNodes || [];
            const pEdges = data.pathEdges || [];
            let summaryText = '';
            if (data.summary === 'no_path') summaryText = '找不到可用路徑';
            if (data.summary === 'no_path_same_doc') summaryText = '起訖節點不在同一文件';
            if (!summaryText) summaryText = data.summary || '';
            setPathNodeIds(pNodes);
            setPathEdgeKeys(pEdges.map((e: any) => edgeKey(e)));
            setPathSummary(summaryText);
            if (opts?.maxHops !== undefined) setPathMaxHops(maxHops);
            if (opts?.allowCrossDoc !== undefined) setAllowCrossDoc(crossDoc);
            onAction?.(`路徑節點 ${pNodes.length} / 關係 ${pEdges.length}`);
        } catch (e: any) {
            console.error(e);
            pushToast({ type: 'error', message: e?.message || '路徑查詢失敗' });
        }
    };

    useEffect(() => {
        fetchGraph();
        fetchDocuments();
    }, []);

    useEffect(() => {
        const q = searchParams?.get('graphQuery');
        if (q) {
            setEvidenceQuery(q);
            runEvidence(q);
        }
    }, [searchParams]);

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

    const matchedSet = useMemo(() => new Set(matchedNodeIds), [matchedNodeIds]);
    const relatedSet = useMemo(() => new Set(relatedNodeIds), [relatedNodeIds]);
    const pathNodeSet = useMemo(() => new Set(pathNodeIds), [pathNodeIds]);
    const highlightEdgeSet = useMemo(() => new Set(highlightEdgeKeys), [highlightEdgeKeys]);
    const pathEdgeSet = useMemo(() => new Set(pathEdgeKeys), [pathEdgeKeys]);
    const matchedNodes = useMemo(() => nodes.filter(n => matchedSet.has(n.id)).slice(0, 8), [nodes, matchedSet]);
    const pathLabelSummary = useMemo(() => {
        if (!pathNodeIds.length) return '';
        const labelMap = new Map(nodes.map(n => [n.id, n.label]));
        return pathNodeIds.map(id => labelMap.get(id) || id).join(' → ');
    }, [pathNodeIds, nodes]);

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

    const reindexGraph = async (docId?: string) => {
        if (reindexingDoc) return; // avoid parallel calls
        const target = docId || 'all';
        setReindexingDoc(target);
        onAction?.(docId ? `重建圖譜: ${docId}` : '重建全部圖譜');
        try {
            const res = await adminFetch('/api/admin/index', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(docId ? { scope: 'doc', docId } : { scope: 'all' }),
            });
            const data = await res.json();
            if (!res.ok || !data?.ok) throw new Error(data?.error || '重建失敗');
            await Promise.all([fetchGraph(), fetchDocuments()]);
            onAction?.('圖譜重建完成');
        } catch (e: any) {
            console.error(e);
            onAction?.('重建圖譜失敗: ' + e.message);
            pushToast({ type: 'error', message: e?.message || '重建圖譜失敗' });
        } finally {
            setReindexingDoc(null);
        }
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
                                const key = edgeKey(e);
                                const isPath = pathEdgeSet.has(key);
                                const isHighlight = highlightEdgeSet.has(key);
                                const stroke = isPath ? '#ef4444' : isHighlight ? '#f59e0b' : '#cbd5e1';
                                const strokeWidth = isPath ? 2.5 : isHighlight ? 1.8 : 1;
                                return (
                                    <g key={`${e.source}-${e.target}-${i}`}>
                                        <line
                                            x1={source.x} y1={source.y}
                                            x2={target.x} y2={target.y}
                                            stroke={stroke}
                                            strokeWidth={strokeWidth}
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
                            {filteredGraph.nodes.map((n) => {
                                const isMatched = matchedSet.has(n.id);
                                const isRelated = relatedSet.has(n.id);
                                const isPathNode = pathNodeSet.has(n.id);
                                const baseColor = n.type === 'Person' ? '#f87171' : n.type === 'Organization' ? '#60a5fa' : '#a78bfa';
                                const fill = isMatched ? '#f59e0b' : isRelated ? '#fcd34d' : baseColor;
                                const radius = isPathNode ? 10 : selectedNode?.id === n.id ? 8 : 5;
                                return (
                                    <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
                                        <circle
                                            r={radius}
                                            fill={fill}
                                            stroke={isPathNode ? '#ef4444' : '#fff'}
                                            strokeWidth={isPathNode ? 2.5 : 1.5}
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
                                );
                            })}
                        </g>
                    </svg>

                    <div className="absolute bottom-2 right-2 text-[10px] text-slate-400 px-2 py-1 bg-white/80 rounded">
                        紅: 人物 | 藍: 組織 | 紫: 其他
                    </div>
                </div>

                {/* Side Panel */}
                <div className="w-80 flex flex-col gap-3 min-h-0">
                    <div className="flex flex-wrap gap-2">
                        {SIDE_TABS.map(tab => {
                            const Icon = tab.icon;
                            const active = sideTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setSideTab(tab.id)}
                                    className={`flex items-center gap-1 px-3 py-2 text-xs rounded-full border transition-colors ${
                                        active ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-gray-500'}`} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {sideTab === 'node' && (
                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                            <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-3">
                                <Info className="w-4 h-4 text-blue-600" /> 節點詳情
                            </h3>
                            <details className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                <summary className="cursor-pointer font-medium text-slate-700">操作說明（可展開）</summary>
                                <div className="mt-2 space-y-2">
                                    <p>點擊節點可查看細節，滾輪縮放、拖曳空白處可平移畫布。</p>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => setSelectedNode(null)}
                                            className="rounded-full bg-white px-3 py-1 text-[11px] text-slate-600 border border-slate-200 hover:bg-slate-100"
                                        >
                                            清除選取
                                        </button>
                                        {docFilter && (
                                            <button
                                                onClick={() => setDocFilter(null)}
                                                className="rounded-full bg-white px-3 py-1 text-[11px] text-slate-600 border border-slate-200 hover:bg-slate-100"
                                            >
                                                清除文件篩選
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </details>
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
                                    {selectedNode.sectionId && (
                                        <div>
                                            <label className="text-xs text-gray-500 block">章節 (Section)</label>
                                            <div className="text-[11px] text-gray-500 break-all">{selectedNode.sectionId}</div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-sm text-gray-500 py-4 text-center">
                                    點擊圖中節點查看詳細資訊
                                </div>
                            )}
                        </div>
                    )}

                    {sideTab === 'evidence' && (
                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                            <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-3">
                                <Search className="w-4 h-4 text-amber-600" /> 圖譜關聯標示
                            </h3>
                            <details className="mb-3 rounded-lg border border-amber-100 bg-amber-50/40 p-3 text-xs text-amber-800">
                                <summary className="cursor-pointer font-medium text-amber-900">操作說明（可展開）</summary>
                                <div className="mt-2 space-y-2">
                                    <p>輸入關鍵字後按 Enter 或點「標示」，系統會把相關節點與連線標出來。</p>
                                    <div className="flex flex-wrap gap-2">
                                        {['人物', '公司', '產品'].map(sample => (
                                            <button
                                                key={sample}
                                                onClick={() => setEvidenceQuery(sample)}
                                                className="rounded-full bg-white px-3 py-1 text-[11px] text-amber-800 border border-amber-200 hover:bg-amber-100"
                                            >
                                                例：{sample}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => {
                                                setEvidenceQuery('');
                                                clearHighlight();
                                            }}
                                            className="rounded-full bg-white px-3 py-1 text-[11px] text-amber-800 border border-amber-200 hover:bg-amber-100"
                                        >
                                            清空標示
                                        </button>
                                    </div>
                                </div>
                            </details>
                            <div className="flex items-center gap-2">
                                <input
                                    value={evidenceQuery}
                                    onChange={e => setEvidenceQuery(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') runEvidence();
                                    }}
                                    placeholder="輸入查詢關鍵字"
                                    className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200"
                                />
                                <button
                                    onClick={() => runEvidence()}
                                    className="px-3 py-2 text-xs bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100"
                                >
                                    標示
                                </button>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 items-center text-[11px] text-gray-600">
                                <span className="text-[11px] text-gray-500">強度</span>
                                <label className="flex items-center gap-1">
                                    節點
                                    <select
                                        value={evidenceMaxNodes}
                                        onChange={e => setEvidenceMaxNodes(Number(e.target.value))}
                                        className="border rounded px-2 py-1 text-[11px]"
                                    >
                                        {[10, 20, 30, 50].map(n => (
                                            <option key={n} value={n}>{n}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="flex items-center gap-1">
                                    關係
                                    <select
                                        value={evidenceMaxEdges}
                                        onChange={e => setEvidenceMaxEdges(Number(e.target.value))}
                                        className="border rounded px-2 py-1 text-[11px]"
                                    >
                                        {[30, 60, 120, 200].map(n => (
                                            <option key={n} value={n}>{n}</option>
                                        ))}
                                    </select>
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setEvidenceMaxNodes(10);
                                            setEvidenceMaxEdges(30);
                                            runEvidence(undefined, { maxNodes: 10, maxEdges: 30 });
                                        }}
                                        className="rounded-full bg-white px-3 py-1 text-[11px] text-amber-800 border border-amber-200 hover:bg-amber-100"
                                        title="比較用：少量標示"
                                    >
                                        少量
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEvidenceMaxNodes(30);
                                            setEvidenceMaxEdges(120);
                                            runEvidence(undefined, { maxNodes: 30, maxEdges: 120 });
                                        }}
                                        className="rounded-full bg-white px-3 py-1 text-[11px] text-amber-800 border border-amber-200 hover:bg-amber-100"
                                        title="比較用：大量標示"
                                    >
                                        大量
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-2 text-[11px] text-gray-500">
                                <span>
                                    符合 {matchedNodeIds.length} · 相關 {relatedNodeIds.length} · 連線 {highlightEdgeKeys.length} · maxNodes {evidenceMaxNodes} · maxEdges {evidenceMaxEdges}
                                </span>
                                <button
                                    onClick={clearHighlight}
                                    className="text-[11px] text-gray-500 hover:text-gray-700"
                                >
                                    清除
                                </button>
                            </div>
                            {matchedNodes.length > 0 && (
                                <div className="mt-2">
                                    <div className="text-[11px] text-gray-500 mb-1">符合節點</div>
                                    <div className="flex flex-wrap gap-1">
                                        {matchedNodes.map(n => (
                                            <button
                                                key={n.id}
                                                className="text-[11px] px-2 py-1 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100"
                                                onClick={() => setSelectedNode(n)}
                                            >
                                                {n.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {evidenceDocIds.length > 0 && (
                                <div className="mt-2">
                                    <div className="text-[11px] text-gray-500 mb-1">來源文件</div>
                                    <div className="flex flex-wrap gap-1">
                                        {evidenceDocIds.slice(0, 6).map(docId => (
                                            <span
                                                key={docId}
                                                className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-600"
                                            >
                                                {docMap.get(docId)?.filename || docId}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {sideTab === 'path' && (
                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                            <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-3">
                                <GitBranch className="w-4 h-4 text-purple-600" /> 路徑探索
                            </h3>
                            <details className="mb-3 rounded-lg border border-purple-100 bg-purple-50/40 p-3 text-xs text-purple-800">
                                <summary className="cursor-pointer font-medium text-purple-900">操作說明（可展開）</summary>
                                <div className="mt-2 space-y-2">
                                    <p>先搜尋起點與終點節點，再按「尋找路徑」查找關聯路徑。</p>
                                    <div className="text-[11px] text-purple-700">
                                        比較練習：試試「跨文件」開/關、或把「步數」調大，看路徑與摘要有什麼差異。
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => {
                                                setStartNode(null);
                                                setEndNode(null);
                                                setStartQuery('');
                                                setEndQuery('');
                                                setStartOptions([]);
                                                setEndOptions([]);
                                                clearPath();
                                            }}
                                            className="rounded-full bg-white px-3 py-1 text-[11px] text-purple-800 border border-purple-200 hover:bg-purple-100"
                                        >
                                            清空起訖
                                        </button>
                                        <button
                                            onClick={clearPath}
                                            className="rounded-full bg-white px-3 py-1 text-[11px] text-purple-800 border border-purple-200 hover:bg-purple-100"
                                        >
                                            清除路徑
                                        </button>
                                    </div>
                                </div>
                            </details>
                            <div className="space-y-2">
                                <div>
                                    <label className="text-[11px] text-gray-500 block mb-1">起點節點</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            value={startQuery}
                                            onChange={e => {
                                                const value = e.target.value;
                                                setStartQuery(value);
                                                if (!value.trim()) setStartOptions([]);
                                            }}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') searchNodes(startQuery, 'start');
                                            }}
                                            placeholder="搜尋起點"
                                            className="flex-1 px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200"
                                        />
                                        <button
                                            onClick={() => searchNodes(startQuery, 'start')}
                                            className="px-2 py-2 text-[11px] bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100"
                                        >
                                            搜尋
                                        </button>
                                    </div>
                                    {startOptions.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {startOptions.map(option => (
                                                <button
                                                    key={option.id}
                                                    className="text-[11px] px-2 py-1 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100"
                                                    onClick={() => {
                                                        setStartNode(option);
                                                        setStartQuery(option.label);
                                                        setStartOptions([]);
                                                    }}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {startNode && (
                                        <div className="text-[11px] text-gray-500 mt-1">
                                            已選: {startNode.label}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-[11px] text-gray-500 block mb-1">終點節點</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            value={endQuery}
                                            onChange={e => {
                                                const value = e.target.value;
                                                setEndQuery(value);
                                                if (!value.trim()) setEndOptions([]);
                                            }}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') searchNodes(endQuery, 'end');
                                            }}
                                            placeholder="搜尋終點"
                                            className="flex-1 px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200"
                                        />
                                        <button
                                            onClick={() => searchNodes(endQuery, 'end')}
                                            className="px-2 py-2 text-[11px] bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100"
                                        >
                                            搜尋
                                        </button>
                                    </div>
                                    {endOptions.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {endOptions.map(option => (
                                                <button
                                                    key={option.id}
                                                    className="text-[11px] px-2 py-1 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100"
                                                    onClick={() => {
                                                        setEndNode(option);
                                                        setEndQuery(option.label);
                                                        setEndOptions([]);
                                                    }}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {endNode && (
                                        <div className="text-[11px] text-gray-500 mt-1">
                                            已選: {endNode.label}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-gray-600">
                                    <label className="flex items-center gap-2">
                                        步數
                                        <select
                                            value={pathMaxHops}
                                            onChange={e => setPathMaxHops(Number(e.target.value))}
                                            className="border rounded px-2 py-1 text-[11px]"
                                        >
                                            {[1, 2, 3, 4, 5, 6].map(n => (
                                                <option key={n} value={n}>{n}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={allowCrossDoc}
                                            onChange={e => setAllowCrossDoc(e.target.checked)}
                                        />
                                        跨文件
                                    </label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => runPath()}
                                        disabled={!startNode || !endNode}
                                        className="px-3 py-2 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                                    >
                                        尋找路徑
                                    </button>
                                    <button
                                        onClick={clearPath}
                                        className="px-3 py-2 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                                    >
                                        清除路徑
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => runPath({ allowCrossDoc: false })}
                                        disabled={!startNode || !endNode}
                                        className="rounded-full bg-white px-3 py-1 text-[11px] text-purple-800 border border-purple-200 hover:bg-purple-100 disabled:opacity-50"
                                        title="比較用：只看同一份文件"
                                    >
                                        同文件
                                    </button>
                                    <button
                                        onClick={() => runPath({ allowCrossDoc: true })}
                                        disabled={!startNode || !endNode}
                                        className="rounded-full bg-white px-3 py-1 text-[11px] text-purple-800 border border-purple-200 hover:bg-purple-100 disabled:opacity-50"
                                        title="比較用：允許跨文件"
                                    >
                                        跨文件
                                    </button>
                                    <button
                                        onClick={() => runPath({ maxHops: 2 })}
                                        disabled={!startNode || !endNode}
                                        className="rounded-full bg-white px-3 py-1 text-[11px] text-purple-800 border border-purple-200 hover:bg-purple-100 disabled:opacity-50"
                                        title="比較用：步數 2"
                                    >
                                        2 步
                                    </button>
                                    <button
                                        onClick={() => runPath({ maxHops: 5 })}
                                        disabled={!startNode || !endNode}
                                        className="rounded-full bg-white px-3 py-1 text-[11px] text-purple-800 border border-purple-200 hover:bg-purple-100 disabled:opacity-50"
                                        title="比較用：步數 5"
                                    >
                                        5 步
                                    </button>
                                </div>
                                <div className="text-[11px] text-gray-500">
                                    路徑節點 {pathNodeIds.length} · 連線 {pathEdgeKeys.length}
                                </div>
                                {(pathSummary || pathLabelSummary) && (
                                    <div className="text-[11px] text-gray-600 bg-purple-50 rounded-lg p-2">
                                        {pathLabelSummary || pathSummary}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {sideTab === 'docs' && (
                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex-1 min-h-[220px] overflow-hidden">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-emerald-600" /> 文件列表
                                </h3>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => reindexGraph()}
                                        disabled={docsLoading || !!reindexingDoc}
                                        className="px-3 py-2 text-xs bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 flex items-center gap-1"
                                        title="重建全部圖譜 (向量+Graph)"
                                    >
                                        <RefreshCw className={`w-3 h-3 ${reindexingDoc === 'all' ? 'animate-spin' : ''}`} /> 全部重建
                                    </button>
                                    <button
                                        onClick={fetchDocuments}
                                        disabled={docsLoading}
                                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                        title="重新整理文件列表"
                                    >
                                        <RefreshCw className={`w-4 h-4 text-gray-500 ${docsLoading ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                            </div>

                            <details className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 text-xs text-emerald-800">
                                <summary className="cursor-pointer font-medium text-emerald-900">操作說明（可展開）</summary>
                                <div className="mt-2 space-y-2">
                                    <p>點擊文件可篩選圖譜，只顯示該文件的節點與關係。</p>
                                    <div className="flex flex-wrap gap-2">
                                        {docFilter && (
                                            <button
                                                onClick={() => setDocFilter(null)}
                                                className="rounded-full bg-white px-3 py-1 text-[11px] text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                                            >
                                                清除篩選
                                            </button>
                                        )}
                                        <button
                                            onClick={fetchDocuments}
                                            className="rounded-full bg-white px-3 py-1 text-[11px] text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                                        >
                                            重新整理
                                        </button>
                                    </div>
                                </div>
                            </details>

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
                                                            節點: {stat?.nodes || 0} / 連線: {stat?.edges || 0}
                                                            {typeof doc.chunks === 'number' ? ` | Chunks: ${doc.chunks}` : ''}
                                                    </p>
                                                        {doc.indexedAt && (
                                                            <p className="text-[11px] text-gray-400">索引時間: {new Date(doc.indexedAt).toLocaleString()}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                        <span className={`text-[11px] px-2 py-1 rounded-full ${statusClass}`}>
                                                            {statusLabel}
                                                        </span>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); reindexGraph(doc.docId); }}
                                                            disabled={!!reindexingDoc}
                                                            className="text-[11px] px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-60 flex items-center gap-1"
                                                            title="僅重建此文件的向量與圖譜"
                                                        >
                                                            <RefreshCw className={`w-3 h-3 ${reindexingDoc === doc.docId ? 'animate-spin' : ''}`} /> 重建
                                                        </button>
                                                    </div>
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
                    )}
                </div>
            </div>
        </div>
    );
}
