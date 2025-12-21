'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import EnvCheck from '@/components/admin/EnvCheck';
import SetupPanel from '@/components/admin/SetupPanel';
import ConfigPanel from '@/components/admin/ConfigPanel';
import RagLabPanel from '@/components/admin/RagLabPanel';
import KnowledgeGraph from '@/components/admin/KnowledgeGraph';
import RagWorkflow from '@/components/admin/RagWorkflow';
import CardManager from '@/components/admin/CardManager';
import AnalyticsPanel from '@/components/admin/AnalyticsPanel';
import UploadPanel from '@/components/admin/UploadPanel';
import UploadHistoryPanel from '@/components/admin/UploadHistoryPanel';
import FileManagementPanel from '@/components/admin/FileManagementPanel';

interface AdminDashboardProps {
    missingKeys: string[];
    initialConfig: Record<string, string>;
}

export default function AdminDashboard({ missingKeys, initialConfig }: AdminDashboardProps) {
    const searchParams = useSearchParams();
    const activeTab = searchParams.get('tab') || 'setup';
    const knowledgeSubTab = (searchParams.get('sub') as 'viz' | 'advanced' | 'lab' | 'cards' | null) || 'viz';

    const [flowEvent, setFlowEvent] = useState<string | null>(null);

    return (
        <div className="space-y-6">
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
                            <UploadHistoryPanel />
                            <FileManagementPanel onAction={setFlowEvent} />
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
    );
}
