'use client';

import { useState, useMemo, useEffect } from 'react';
import './RagWorkflow.css';
import {
    Upload,
    Scissors,
    Cpu,
    Database,
    CheckCircle,
    MessageSquare,
    Wand2,
    Search,
    Shuffle,
    Sparkles,
    Play,
    ArrowRight,
    Pause
} from 'lucide-react';

type FlowKey = 'upload' | 'query';

const flows: Record<FlowKey, Array<{
    id: string;
    label: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
}>> = {
    upload: [
        { id: 'ingest', label: '上傳檔案', desc: 'PDF / TXT / MD 等原始文件', icon: Upload },
        { id: 'chunk', label: '分段清洗', desc: '文字切割、去除雜訊、補齊中英空白', icon: Scissors },
        { id: 'embed', label: '產生向量', desc: '依照模型將文本轉為向量', icon: Cpu },
        { id: 'index', label: '寫入向量庫', desc: '將向量與 metadata 寫入 Pinecone', icon: Database },
        { id: 'ready', label: '可供查詢', desc: '資料已可被檢索與引用', icon: CheckCircle },
    ],
    query: [
        { id: 'question', label: '使用者提問', desc: '接收 Query 或 LINE/ Web 問題', icon: MessageSquare },
        { id: 'rewrite', label: 'Query Rewrite', desc: '結合歷史對話改寫成最清楚的查詢', icon: Wand2 },
        { id: 'retrieve', label: '向量檢索', desc: '在向量庫中取回 top-k 片段', icon: Search },
        { id: 'rerank', label: '重排/過濾', desc: '依分數或規則挑出最相關內容', icon: Shuffle },
        { id: 'generate', label: 'LLM 生成', desc: '使用選定模型產生回應/測驗', icon: Sparkles },
    ],
};

interface RagWorkflowProps {
    currentAction?: string | null;
}

export default function RagWorkflow({ currentAction }: RagWorkflowProps) {
    const [flow, setFlow] = useState<FlowKey>('query');
    const [activeStep, setActiveStep] = useState(0);
    const steps = useMemo(() => flows[flow], [flow]);
    const [autoPlay, setAutoPlay] = useState(false);
    const [pulseStep, setPulseStep] = useState<string | null>(null);

    // Simple auto-play simulation
    useEffect(() => {
        if (!autoPlay) return;
        const id = setTimeout(() => {
            setActiveStep((prev) => (prev + 1) % steps.length);
        }, 1400);
        return () => clearTimeout(id);
    }, [autoPlay, steps.length, activeStep]);

    const current = steps[activeStep];

    // Map admin actions to flow steps to create an "interactive" feel
    useEffect(() => {
        if (!currentAction) return;

        const lower = currentAction.toLowerCase();

        const pick = (): { flow: FlowKey; id: string } | null => {
            if (lower.includes('上傳') || lower.includes('檔案')) return { flow: 'upload', id: 'ingest' };
            if (lower.includes('切片') || lower.includes('分段')) return { flow: 'upload', id: 'chunk' };
            if (lower.includes('向量') || lower.includes('embedding')) return { flow: 'upload', id: 'embed' };
            if (lower.includes('索引') || lower.includes('寫入')) return { flow: 'upload', id: 'index' };
            if (lower.includes('視覺化') || lower.includes('更新向量')) return { flow: 'upload', id: 'ready' };

            if (lower.includes('提問') || lower.includes('查詢') || lower.includes('檢索')) return { flow: 'query', id: 'retrieve' };
            if (lower.includes('重寫')) return { flow: 'query', id: 'rewrite' };
            if (lower.includes('摘要') || lower.includes('生成')) return { flow: 'query', id: 'generate' };
            return null;
        };

        const mapped = pick();
        if (mapped) {
            setFlow(mapped.flow);
            const idx = flows[mapped.flow].findIndex(s => s.id === mapped.id);
            if (idx >= 0) {
                setActiveStep(idx);
                setPulseStep(mapped.id);
                setTimeout(() => setPulseStep(null), 1200);
            }
        }
    }, [currentAction]);

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-lg font-semibold">RAG 運作流程 (互動示意)</h2>
                    <p className="text-sm text-gray-500">依照正在操作的情境切換流程，點擊節點可查看詳情。</p>
                    {currentAction && (
                        <div className="mt-2 inline-flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-1">
                            最新操作：{currentAction}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={flow}
                        onChange={(e) => { setFlow(e.target.value as FlowKey); setActiveStep(0); }}
                        className="border rounded px-3 py-2 text-sm bg-white"
                    >
                        <option value="upload">上傳 / 向量化流程</option>
                        <option value="query">查詢 / 回答流程</option>
                    </select>
                    <button
                        onClick={() => setAutoPlay(!autoPlay)}
                        className="flex items-center gap-1 px-3 py-2 text-sm rounded border border-gray-200 hover:bg-gray-50"
                    >
                        {autoPlay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        {autoPlay ? '暫停自動播放' : '自動播放'}
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {/* Steps timeline */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    {steps.map((step, idx) => {
                        const Icon = step.icon;
                        const active = idx === activeStep;
                        return (
                            <button
                                key={step.id}
                                onClick={() => setActiveStep(idx)}
                        className={`group w-full text-left p-3 rounded-lg border transition-colors h-full
                                    ${active ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-blue-200'}
                                    ${pulseStep === step.id ? 'ring-2 ring-blue-300 pulse' : ''}`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-gray-500'}`} />
                                    <span className="text-sm font-semibold text-gray-800">{step.label}</span>
                                </div>
                                <p className="text-xs text-gray-500 leading-snug">{step.desc}</p>
                            </button>
                        );
                    })}
                </div>

                {/* Details + mini arrow indicator */}
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <ArrowRight className="w-4 h-4" />
                    目前步驟：{current.label}
                </div>

                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                        <current.icon className="w-5 h-5 text-blue-600" />
                        <span className="font-semibold text-gray-800">{current.label}</span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        {current.desc}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                        提示：可依「上傳流程」或「查詢流程」切換節點，模擬您當前操作時的處理路徑。
                    </p>
                </div>
            </div>
        </div>
    );
}
