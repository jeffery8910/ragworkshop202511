'use client';

import { useState } from 'react';
import { Trophy, Zap, BookOpen, Star } from 'lucide-react';

export default function StudentDashboard() {
    const [xp, setXp] = useState(1250);
    const [level, setLevel] = useState(5);

    const topics = [
        { name: '微積分', level: 5, progress: 80 },
        { name: '線性代數', level: 2, progress: 30 },
        { name: '機率統計', level: 3, progress: 50 },
    ];

    const mistakes = [
        { id: 1, topic: '微積分', question: '極限的定義是什麼？', reason: '觀念不清', suggestion: '複習 epsilon-delta 定義' },
        { id: 2, topic: '線性代數', question: '特徵值如何計算？', reason: '計算錯誤', suggestion: '多練習矩陣行列式運算' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <header className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-800">學習儀表板</h1>
                <div className="flex items-center gap-2 bg-yellow-100 px-3 py-1 rounded-full">
                    <Trophy className="w-5 h-5 text-yellow-600" />
                    <span className="font-bold text-yellow-700">Lv.{level}</span>
                </div>
            </header>

            {/* XP Card */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white mb-6 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-indigo-100">總經驗值</span>
                    <Zap className="w-6 h-6 text-yellow-300" />
                </div>
                <div className="text-4xl font-bold mb-4">{xp} XP</div>
                <div className="w-full bg-black/20 rounded-full h-2">
                    <div className="bg-yellow-400 h-2 rounded-full" style={{ width: '70%' }}></div>
                </div>
                <div className="text-xs text-indigo-200 mt-2 text-right">距離下一級還差 350 XP</div>
            </div>

            {/* Topic Levels */}
            <h2 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                <BookOpen className="w-5 h-5" /> 學科能力分析
            </h2>
            <div className="grid grid-cols-1 gap-3 mb-6">
                {topics.map((t, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between">
                        <div>
                            <div className="font-bold text-gray-800">{t.name}</div>
                            <div className="text-xs text-gray-500">Lv.{t.level}</div>
                        </div>
                        <div className="w-24 bg-gray-100 rounded-full h-2">
                            <div
                                className="bg-green-500 h-2 rounded-full"
                                style={{ width: `${t.progress}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Mistake Analysis */}
            <h2 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" /> 錯題分析與建議
            </h2>
            <div className="space-y-3">
                {mistakes.map((m) => (
                    <div key={m.id} className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-red-400">
                        <div className="text-xs text-gray-500 mb-1">{m.topic}</div>
                        <div className="font-medium text-gray-800 mb-2">{m.question}</div>
                        <div className="bg-red-50 p-2 rounded text-xs text-red-700 mb-2">
                            <span className="font-bold">錯誤原因：</span>{m.reason}
                        </div>
                        <div className="bg-green-50 p-2 rounded text-xs text-green-700">
                            <span className="font-bold">AI 建議：</span>{m.suggestion}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

import { AlertCircle } from 'lucide-react';
