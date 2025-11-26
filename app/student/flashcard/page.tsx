'use client';

import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';

interface FlashcardData {
    title: string;
    keyword: string;
    definition: string;
    example: string;
    color: string;
}

export default function FlashcardPage() {
    const [topic, setTopic] = useState('');
    const [card, setCard] = useState<FlashcardData | null>(null);
    const [loading, setLoading] = useState(false);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!topic.trim()) return;

        setLoading(true);
        setCard(null);

        try {
            const res = await fetch(`/api/student/flashcard?topic=${encodeURIComponent(topic)}`);
            if (res.ok) {
                const data = await res.json();
                setCard(data);
            }
        } catch (error) {
            console.error('Failed to generate flashcard', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 flex flex-col items-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">AI 重點卡片生成器</h1>

            <form onSubmit={handleGenerate} className="w-full max-w-md flex gap-2 mb-8">
                <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="輸入主題 (例如：微積分、光合作用)"
                    className="flex-1 p-2 border rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    生成
                </button>
            </form>

            {card && (
                <div className="perspective-1000 w-full max-w-md">
                    <div
                        className="bg-white rounded-xl shadow-xl overflow-hidden border-t-8 transform transition-all hover:scale-105 duration-300"
                        style={{ borderColor: card.color }}
                    >
                        <div className="p-6">
                            <div className="text-xs font-bold tracking-wider uppercase text-gray-400 mb-1">
                                {card.title}
                            </div>
                            <h2 className="text-3xl font-extrabold text-gray-800 mb-4" style={{ color: card.color }}>
                                {card.keyword}
                            </h2>

                            <div className="space-y-4">
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h3 className="text-sm font-semibold text-gray-500 mb-1">定義</h3>
                                    <p className="text-gray-700 leading-relaxed">{card.definition}</p>
                                </div>

                                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                                    <h3 className="text-sm font-semibold text-yellow-600 mb-1">舉例</h3>
                                    <p className="text-gray-700 italic">"{card.example}"</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
