'use client';

import { useState } from 'react';
import { LayoutDashboard, Settings, Database, FlaskConical, BarChart3, AlertTriangle } from 'lucide-react';
import AnalyticsPanel from '@/components/admin/AnalyticsPanel';
import UploadPanel from '@/components/admin/UploadPanel';
import ConfigPanel from '@/components/admin/ConfigPanel';
import EnvCheck from '@/components/admin/EnvCheck';
import SetupPanel from '@/components/admin/SetupPanel';
import RagLabPanel from '@/components/admin/RagLabPanel';
import KnowledgeGraph from '@/components/admin/KnowledgeGraph';
import RagWorkflow from '@/components/admin/RagWorkflow';
import CardManager from '@/components/admin/CardManager';

interface AdminDashboardProps {
    missingKeys: string[];
    initialConfig: Record<string, string>;
}

export default function AdminDashboard({ missingKeys, initialConfig }: AdminDashboardProps) {
    const [activeTab, setActiveTab] = useState('setup');
    const [flowEvent, setFlowEvent] = useState<string | null>(null);
    const [knowledgeSubTab, setKnowledgeSubTab] = useState<'viz' | 'advanced' | 'lab' | 'cards'>('viz');

    const tabs = [
        { id: 'setup', label: '系統設定 (Setup)', icon: Settings },
        { id: 'rag-lab', label: 'RAG 實驗室 (Lab)', icon: FlaskConical },
        { id: 'knowledge', label: '知識庫管理 (Knowledge)', icon: Database },
        { id: 'analytics', label: '數據分析 (Analytics)', icon: BarChart3 },
        { id: 'advanced', label: '進階設定 (Advanced)', icon: Settings },
    ];

    return (
        <div className="flex gap-4">
            <aside className="w-60 bg-white border border-gray-200 rounded-lg p-3 h-fit sticky top-4">
                <div className="space-y-2">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isKnowledge = tab.id === 'knowledge';
                        return (
                            <div key={tab.id}>
                                <button
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${activeTab === tab.id
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : 'text-gray-600 hover:bg-gray-50 border border-transparent'}`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                                {isKnowledge && activeTab === 'knowledge' && (
                                    <div className="mt-1 pl-4 space-y-1">
                                        {[
                                            { id: 'viz', label: '視覺化' },
                                            { id: 'advanced', label: '進階設定' },
                                            { id: 'lab', label: 'RAG 實驗室' },
                                            { id: 'cards', label: '卡片管理' },
                                        ].map(sub => (
                                            <button
                                                key={sub.id}
                                                onClick={() => setKnowledgeSubTab(sub.id as any)}
                                                className={`w-full text-left text-xs px-2 py-1 rounded ${knowledgeSubTab === sub.id
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'text-gray-600 hover:bg-gray-100'}`}
                                            >
                                                {sub.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </aside>

            <div className="flex-1 space-y-6">
                {activeTab === 'setup' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <EnvCheck missingKeys={missingKeys} />
                        <SetupPanel initialConfig={initialConfig} />
                    </div>
                )}

                {activeTab === 'advanced' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <ConfigPanel initialConfig={initialConfig} />
                    </div>
                )}

                {activeTab === 'rag-lab' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <RagLabPanel />
                    </div>
                )}

                {activeTab === 'knowledge' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {knowledgeSubTab === 'viz' && (
                            <div className="space-y-4">
                                <RagWorkflow currentAction={flowEvent} />
                                <UploadPanel onAction={setFlowEvent} />
                                <KnowledgeGraph onAction={setFlowEvent} />
                                <ConfigPanel initialConfig={initialConfig} />
                            </div>
                        )}

                        {knowledgeSubTab === 'advanced' && (
                            <div className="space-y-4">
                                <ConfigPanel initialConfig={initialConfig} />
                            </div>
                        )}

                        {knowledgeSubTab === 'lab' && (
                            <div className="space-y-4">
                                <RagLabPanel />
                            </div>
                        )}

                        {knowledgeSubTab === 'cards' && (
                            <div className="space-y-4">
                                <CardManager />
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'analytics' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <AnalyticsPanel />
                    </div>
                )}
            </div>
        </div>
    );
}
