'use client';

import { useEffect, useRef, useState } from 'react';
import { Network, RefreshCw, Info, Share2 } from 'lucide-react';

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

export default function KnowledgeGraph({ onAction }: KnowledgeGraphProps) {
    const [loading, setLoading] = useState(false);
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    
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

    const fetchData = async () => {
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

    useEffect(() => {
        fetchData();
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
        const clickedNode = nodes.find(n => {
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

    return (
        <div className="bg-white p-6 rounded-xl shadow-md h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-purple-600" /> 知識圖譜 (Knowledge Graph)
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={fetchData}
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
                    
                    <svg className="w-full h-full pointer-events-none">
                        <g transform={`translate(${pan.x + (canvasRef.current?.clientWidth || 0)/2}, ${pan.y + (canvasRef.current?.clientHeight || 0)/2}) scale(${zoom})`}>
                            {/* Edges */}
                            {edges.map((e, i) => {
                                const source = nodes.find(n => n.id === e.source);
                                const target = nodes.find(n => n.id === e.target);
                                if (!source || !target) return null;
                                return (
                                    <g key={i}>
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
                            {nodes.map((n) => (
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
                <div className="w-64 flex flex-col gap-3">
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm h-full overflow-y-auto">
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
                                <div>
                                    <label className="text-xs text-gray-500 block">來源文件 ID</label>
                                    <div className="text-gray-400 text-xs break-all">{selectedNode.docId}</div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500 py-4 text-center">
                                點擊圖中節點查看詳細資訊
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
