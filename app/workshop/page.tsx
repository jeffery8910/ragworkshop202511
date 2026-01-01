'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Home, Bot, GraduationCap } from 'lucide-react';
import RagLabPanel from '@/components/admin/RagLabPanel';
import ToastProvider from '@/components/ui/ToastProvider';

export default function WorkshopPage() {
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const key = 'rag_user_id';
        let id = window.localStorage.getItem(key);
        if (!id) {
            id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
                ? `web-${crypto.randomUUID()}`
                : `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
            window.localStorage.setItem(key, id);
        }
        fetch('/api/student/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: id, event: 'workshop_open' })
        }).catch(() => undefined);
    }, []);

    return (
        <ToastProvider>
            <div className="min-h-screen bg-gray-50 p-4">
                <header className="max-w-6xl mx-auto mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">RAG 教學坊</h1>
                        <p className="text-sm text-gray-600">A/B 比較 TopK、重寫、圖譜、Agentic，並產出評估報告。</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                            <Home className="w-4 h-4" />
                            回首頁
                        </Link>
                        <Link
                            href="/chat"
                            className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                            <Bot className="w-4 h-4" />
                            去聊天練習
                        </Link>
                        <Link
                            href="/student"
                            className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                            <GraduationCap className="w-4 h-4" />
                            學生儀表板
                        </Link>
                    </div>
                </header>

                <div className="max-w-6xl mx-auto">
                    <RagLabPanel retrievePath="/api/workshop/retrieve" showAdminLinks={false} />
                </div>
            </div>
        </ToastProvider>
    );
}
