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
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-1">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors font-medium text-sm ${activeTab === tab.id
                                ? 'bg-white text-blue-600 border border-b-0 border-gray-200 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="min-h-[500px]">
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
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-6xl">
                        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
                            {[
                                { id: 'viz', label: '知識庫視覺化' },
                                { id: 'advanced', label: '進階設定（資料庫）' },
                                { id: 'lab', label: 'RAG 實驗室模擬' },
                                { id: 'cards', label: '卡片管理' },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setKnowledgeSubTab(tab.id as any)}
                                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                                        knowledgeSubTab === tab.id
                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {knowledgeSubTab === 'viz' && (
                            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                                <div className="xl:col-span-1">
                                    <RagWorkflow currentAction={flowEvent} />
                                </div>
                                <div className="xl:col-span-1">
                                    <UploadPanel onAction={setFlowEvent} />
                                </div>
                                <div className="xl:col-span-1">
                                    <KnowledgeGraph onAction={setFlowEvent} />
                                </div>
                                <div className="xl:col-span-1">
                                    <ConfigPanel initialConfig={initialConfig} />
                                </div>
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
