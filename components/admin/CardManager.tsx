'use client';

import { useEffect, useState } from 'react';
import { Trash2, RefreshCw, Filter } from 'lucide-react';

interface CardManagerProps {
    defaultUserId?: string;
}

interface CardDoc {
    _id: string;
    userId: string;
    type: string;
    payload: any;
    createdAt: string;
}

export default function CardManager({ defaultUserId = 'web-user-demo' }: CardManagerProps) {
    const [userId, setUserId] = useState(defaultUserId);
    const [cards, setCards] = useState<CardDoc[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchCards = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/cards?userId=${encodeURIComponent(userId)}&limit=50`, { cache: 'no-store' });
            const data = await res.json();
            setCards(data || []);
        } catch (e) {
            console.error('Fetch cards error', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCards();
    }, [userId]);

    const handleDelete = async (id: string) => {
        if (!confirm('確定刪除這張卡片？')) return;
        try {
            await fetch('/api/admin/cards', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, userId }),
            });
            setCards(prev => prev.filter(c => c._id !== id));
        } catch (e) {
            alert('刪除失敗，請稍後再試');
        }
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        value={userId}
                        onChange={e => setUserId(e.target.value)}
                        className="border rounded px-2 py-1 text-sm"
                        placeholder="User ID"
                    />
                </div>
                <button
                    onClick={fetchCards}
                    disabled={loading}
                    className="flex items-center gap-1 text-xs px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    重新整理
                </button>
            </div>

            <div className="text-xs text-gray-500 mb-2">顯示最新 50 張卡片，可刪除無效/重複資料。</div>

            <div className="space-y-2 max-h-96 overflow-auto">
                {cards.map(card => (
                    <div key={card._id} className="border rounded p-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-1">
                            <div className="text-sm font-semibold text-gray-800">{card.type}</div>
                            <button
                                onClick={() => handleDelete(card._id)}
                                className="text-red-500 hover:text-red-700"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="text-[11px] text-gray-500 mb-1">{new Date(card.createdAt).toLocaleString()}</div>
                        <pre className="text-[11px] bg-white border border-gray-200 rounded p-2 overflow-x-auto">
                            {JSON.stringify(card.payload, null, 2)}
                        </pre>
                    </div>
                ))}
                {!cards.length && <div className="text-sm text-gray-500 text-center py-6">目前沒有卡片</div>}
            </div>
        </div>
    );
}
