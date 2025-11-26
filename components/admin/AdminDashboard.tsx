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

interface AdminDashboardProps {
    missingKeys: string[];
}

export default function AdminDashboard({ missingKeys }: AdminDashboardProps) {
    const [activeTab, setActiveTab] = useState('setup');

    const tabs = [
        { id: 'setup', label: '系統設定 (Setup)', icon: Settings },
        { id: 'rag-lab', label: 'RAG 實驗室 (Lab)', icon: FlaskConical },
        { id: 'knowledge', label: '知識庫管理 (Knowledge)', icon: Database },
        { id: 'analytics', label: '數據分析 (Analytics)', icon: BarChart3 },
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
                        <SetupPanel />
                        <ConfigPanel />
                    </div>
                )}

                {activeTab === 'rag-lab' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <RagLabPanel />
                    </div>
                )}

                {activeTab === 'knowledge' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <UploadPanel />
                        <KnowledgeGraph />
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
