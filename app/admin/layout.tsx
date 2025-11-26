'use client';

import { Home, Database, Activity } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const activeTab = pathname === '/admin' ? 'dashboard' :
        pathname.startsWith('/admin/knowledge') ? 'knowledge' :
            pathname.startsWith('/admin/status') ? 'status' : 'dashboard';

    const activeClass = 'flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium';
    const inactiveClass = 'flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors';

    return (
        <div className="min-h-screen bg-gray-100 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white shadow-lg border-r flex flex-col">
                <div className="p-6 border-b">
                    <h1 className="text-2xl font-bold text-gray-900">RAG Admin</h1>
                    <p className="text-xs text-gray-500 mt-1">v2.0.0</p>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <Link href="/admin" className={activeTab === 'dashboard' ? activeClass : inactiveClass}>
                        <Home className="w-4 h-4" />
                        儀表板
                    </Link>
                    <Link href="/admin/knowledge" className={activeTab === 'knowledge' ? activeClass : inactiveClass}>
                        <Database className="w-4 h-4" />
                        知識庫管理
                    </Link>
                    <Link href="/admin/status" className={activeTab === 'status' ? activeClass : inactiveClass}>
                        <Activity className="w-4 h-4" />
                        系統狀態
                    </Link>
                </nav>

                <div className="p-4 border-t">
                    <Link href="/" className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors">
                        <Home className="w-4 h-4" />
                        回到首頁 (Back to Chat)
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    );
}
