'use client';

import { Flashcard as FlashcardType } from '@/lib/features/flashcard';
import { Share2, Download } from 'lucide-react';

export default function Flashcard({ data }: { data: FlashcardType }) {
    return (
        <div
            className="relative w-full max-w-sm mx-auto aspect-[3/4] rounded-2xl shadow-2xl p-8 flex flex-col justify-between text-white transition-transform hover:scale-105"
            style={{ backgroundColor: data.color }}
        >
            <div className="absolute top-4 right-4 opacity-50">
                <div className="w-8 h-8 rounded-full bg-white/20"></div>
            </div>

            <div className="mt-8">
                <div className="text-sm opacity-80 tracking-widest uppercase mb-2">{data.title}</div>
                <h2 className="text-4xl font-extrabold mb-4">{data.keyword}</h2>
                <div className="w-12 h-1 bg-white/50 mb-6"></div>
                <p className="text-lg font-medium leading-relaxed mb-6">
                    {data.definition}
                </p>
            </div>

            <div className="bg-black/20 rounded-xl p-4 backdrop-blur-sm">
                <div className="text-xs opacity-60 mb-1">範例 (EXAMPLE)</div>
                <div className="text-sm italic">"{data.example}"</div>
            </div>

            <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/20">
                <div className="text-xs font-bold opacity-80">RAG 重點卡片</div>
                <div className="flex gap-3">
                    <button className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <Share2 className="w-5 h-5" />
                    </button>
                    <button className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <Download className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
