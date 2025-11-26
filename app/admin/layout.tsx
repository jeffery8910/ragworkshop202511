import { Home } from 'lucide-react';
import Link from 'next/link';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-100">
            <nav className="bg-white shadow-sm border-b px-6 py-4 flex items-center justify-between">
                <div className="font-bold text-xl text-gray-800">RAG Admin Panel</div>
                <div className="flex items-center gap-4">
                    <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors">
                        <Home className="w-4 h-4" />
                        <span>回到首頁 (Back to Chat)</span>
                    </Link>
                    <div className="text-sm text-gray-500">v2.0.0</div>
                </div>
            </nav>
            <main className="p-6 max-w-7xl mx-auto">
                {children}
            </main>
        </div>
    );
}
