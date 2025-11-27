'use client';

import { useEffect, useState } from 'react';
import { Home, Database, Activity, Settings, FlaskConical, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [activeTab, setActiveTab] = useState<string>('setup');

    useEffect(() => {
        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        const tab = params.get('tab') || 'setup';
        const derived = pathname.startsWith('/admin/status') ? 'status' : tab;
        setActiveTab(derived);
    }, [pathname]);

    const activeClass = 'flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium';
    const inactiveClass = 'flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors';

    return (
        <div className="min-h-screen bg-gray-100 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white shadow-lg border-r flex flex-col">
                <div className="p-6 border-b">
                    <h1 className="text-2xl font-bold text-gray-900">RAG Admin</h1>
                    <p className="text-xs text-gray-500 mt-1">v2.0.0</p>
                    <Link href="/" className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors mt-2">
                        <Home className="w-3 h-3" />
                        回到首頁 (Back to Chat)
                    </Link>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <Link href="/admin?tab=setup" className={activeTab === 'setup' ? activeClass : inactiveClass}>
                        <Settings className="w-4 h-4" />
                        系統設定 (Setup)
                    </Link>
                    <Link href="/admin?tab=rag-lab" className={activeTab === 'rag-lab' ? activeClass : inactiveClass}>
                        <FlaskConical className="w-4 h-4" />
                        RAG 實驗室 (Lab)
                    </Link>
                    <div className={`rounded-lg ${activeTab === 'knowledge' ? 'bg-blue-50 border border-blue-200' : ''}`}>
                        <Link
                            href="/admin?tab=knowledge"
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'knowledge'
                                ? 'text-blue-700'
                                : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <Database className="w-4 h-4" />
                            知識庫管理 (Knowledge)
                        </Link>
                        {activeTab === 'knowledge' && (
                            <div className="pl-6 pb-3 space-y-1">
                                <Link href="/admin?tab=knowledge&sub=viz" className="block text-xs text-gray-600 hover:text-blue-700">視覺化</Link>
                                <Link href="/admin?tab=knowledge&sub=advanced" className="block text-xs text-gray-600 hover:text-blue-700">進階設定</Link>
                                <Link href="/admin?tab=knowledge&sub=lab" className="block text-xs text-gray-600 hover:text-blue-700">RAG 實驗室</Link>
                                <Link href="/admin?tab=knowledge&sub=cards" className="block text-xs text-gray-600 hover:text-blue-700">卡片管理</Link>
                            </div>
                        )}
                    </div>
                    <Link href="/admin?tab=analytics" className={activeTab === 'analytics' ? activeClass : inactiveClass}>
                        <BarChart3 className="w-4 h-4" />
                        數據分析 (Analytics)
                    </Link>
                    <Link href="/admin?tab=advanced" className={activeTab === 'advanced' ? activeClass : inactiveClass}>
                        <Settings className="w-4 h-4" />
                        進階設定 (Advanced)
                    </Link>
                    <Link href="/admin/status" className={activeTab === 'status' ? activeClass : inactiveClass}>
                        <Activity className="w-4 h-4" />
                        系統狀態
                    </Link>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    );
}
