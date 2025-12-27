'use client';

import { useState, useEffect } from 'react';
import { Trophy, Zap, BookOpen, AlertCircle, Home } from 'lucide-react';
import Link from 'next/link';

interface Topic {
    name: string;
    level: number;
    progress: number;
}

interface Mistake {
    id: number;
    topic: string;
    question: string;
    reason: string;
    suggestion: string;
}

interface SummaryCard {
    title: string;
    bullets: string[];
    highlight?: string;
}

export default function StudentDashboard() {
    const [xp, setXp] = useState(0);
    const [level, setLevel] = useState(1);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [mistakes, setMistakes] = useState<Mistake[]>([]);
    const [summaries, setSummaries] = useState<SummaryCard[]>([]);
    const [updatedAt, setUpdatedAt] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const ensureUserId = () => {
            if (typeof window === 'undefined') return '';
            const key = 'rag_user_id';
            let id = window.localStorage.getItem(key);
            if (!id) {
                id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
                    ? `web-${crypto.randomUUID()}`
                    : `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
                window.localStorage.setItem(key, id);
            }
            return id;
        };

        const fetchData = async () => {
            try {
                const userId = ensureUserId();
                const res = await fetch(`/api/student/dashboard?userId=${encodeURIComponent(userId)}`);
                if (res.ok) {
                    const data = await res.json();
                    setXp(data.xp);
                    setLevel(data.level);
                    setTopics(data.topics);
                    setMistakes(data.mistakes);
                    setSummaries(data.summaries || []);
                    setUpdatedAt(data.updatedAt || '');
                }
            } catch (error) {
                console.error('Failed to load dashboard data', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
    const nextLevelTarget = Math.max(100, level * 500);
    const xpProgress = clamp(Math.round((xp / nextLevelTarget) * 100));
    const remainingXp = Math.max(0, nextLevelTarget - xp);
    const topTopic = topics[0]?.name;
    const topMistake = mistakes[0]?.topic || mistakes[0]?.question;
    const practiceSuggestions = [
        topMistake ? `先複盤錯題：${topMistake}` : '',
        topTopic ? `加強 ${topTopic}：做 3 題基礎題 + 1 題應用題` : '',
        '練習提問：用一句話解釋 + 舉 1 個例子',
    ].filter(Boolean);

    const milestoneHint = level >= 5
        ? 'Lv.5+：嘗試自己設計 3 題測驗並比較 AI 評分。'
        : level >= 3
            ? 'Lv.3：開始練習「比較題」與「反例題」。'
            : 'Lv.2：多做「概念 + 例子」的基礎練習。';

    const workshopSuggestions = [
        { label: 'TopK 3 vs 8', q: '請解釋 RAG 的流程，並用 1 個例子說明。' },
        { label: '重寫 開 vs 關', q: '向量檢索的「問題重寫」會影響什麼？請舉例。' },
        { label: '圖譜 開 vs 關', q: '知識圖譜 RAG 能補到什麼？用一段話說明。' },
        { label: 'Agentic L0 vs L2', q: '什麼情況下「需要檢索」？請給 2 個反例。' },
    ];

    const formatUpdatedAt = (value: string) => {
        if (!value) return '尚未更新';
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) return '尚未更新';
        return dt.toLocaleString();
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-gray-500">載入學習數據中...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <header className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-800">學習儀表板</h1>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    >
                        <Home className="w-4 h-4" />
                        回到首頁
                    </Link>
                </div>
                <div className="flex items-center gap-2 bg-yellow-100 px-3 py-1 rounded-full">
                    <Trophy className="w-5 h-5 text-yellow-600" />
                    <span className="font-bold text-yellow-700">Lv.{level}</span>
                </div>
            </header>
            <div className="text-xs text-gray-500 mb-4">最後更新：{formatUpdatedAt(updatedAt)}</div>

            {/* XP Card */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white mb-6 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-indigo-100">總經驗值</span>
                    <Zap className="w-6 h-6 text-yellow-300" />
                </div>
                <div className="text-4xl font-bold mb-4">{xp} XP</div>
                <div className="w-full bg-black/20 rounded-full h-2">
                    <div className="bg-yellow-400 h-2 rounded-full" style={{ width: `${xpProgress}%` }}></div>
                </div>
                <div className="text-xs text-indigo-200 mt-2 text-right">距離下一級還差 {remainingXp} XP（示意）</div>
            </div>

            {/* Topic Levels */}
            <h2 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                <BookOpen className="w-5 h-5" /> 學科能力分析
            </h2>
            <div className="grid grid-cols-1 gap-3 mb-6">
                {topics.length > 0 ? (
                    topics.map((t, idx) => {
                        const progress = clamp(t.progress);
                        return (
                        <div key={idx} className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between">
                            <div>
                                <div className="font-bold text-gray-800">{t.name}</div>
                                <div className="text-xs text-gray-500">Lv.{t.level}</div>
                            </div>
                            <div className="w-24 bg-gray-100 rounded-full h-2">
                                <div
                                    className="bg-green-500 h-2 rounded-full"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        </div>
                    )})
                ) : (
                    <div className="text-gray-500 text-sm text-center py-4 bg-white rounded-lg">
                        尚無學科數據，請多與 AI 家教互動！
                    </div>
                )}
            </div>

            {/* Mistake Analysis */}
            <h2 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" /> 錯題分析與建議
            </h2>
            <div className="space-y-3">
                {mistakes.length > 0 ? (
                    mistakes.map((m, idx) => (
                        <div key={`${m.id ?? idx}`} className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-red-400">
                            <div className="text-xs text-gray-500 mb-1">{m.topic}</div>
                            <div className="font-medium text-gray-800 mb-2">{m.question}</div>
                            <div className="bg-red-50 p-2 rounded text-xs text-red-700 mb-2">
                                <span className="font-bold">錯誤原因：</span>{m.reason}
                            </div>
                            <div className="bg-green-50 p-2 rounded text-xs text-green-700">
                                <span className="font-bold">AI 建議：</span>{m.suggestion}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-gray-500 text-sm text-center py-4 bg-white rounded-lg">
                        太棒了！目前沒有錯題記錄。
                    </div>
                )}
            </div>

            {/* Practice Suggestions */}
            <h2 className="text-lg font-bold text-gray-700 mt-8 mb-3 flex items-center gap-2">
                <BookOpen className="w-5 h-5" /> 練習建議
            </h2>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                {practiceSuggestions.length > 0 ? (
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                        {practiceSuggestions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                ) : (
                    <div className="text-gray-500 text-sm">先完成一次對話或測驗，系統會生成個人化建議。</div>
                )}
                <div className="mt-3">
                    <Link
                        href="/chat"
                        className="inline-flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                    >
                        前往聊天練習
                    </Link>
                </div>
            </div>

            {/* Workshop */}
            <h2 className="text-lg font-bold text-gray-700 mt-8 mb-3 flex items-center gap-2">
                <BookOpen className="w-5 h-5" /> RAG 教學坊
            </h2>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="text-sm text-gray-700 mb-3">
                    這裡可以做 A/B 比較：TopK、問題重寫、圖譜 RAG、Agentic（含流程步驟）。
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                    {workshopSuggestions.map(item => (
                        <Link
                            key={item.label}
                            href={`/workshop?q=${encodeURIComponent(item.q)}`}
                            className="text-xs px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/workshop"
                        className="inline-flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                    >
                        前往 RAG 教學坊
                    </Link>
                    <Link
                        href="/chat"
                        className="inline-flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                    >
                        用聊天做同題練習
                    </Link>
                </div>
            </div>

            {/* Daily Task */}
            <h2 className="text-lg font-bold text-gray-700 mt-8 mb-3 flex items-center gap-2">
                <Trophy className="w-5 h-5" /> 今日小任務
            </h2>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                    <li>用 1 句話解釋今天學到的概念</li>
                    <li>舉 1 個生活化例子</li>
                    <li>請 AI 出 3 題小測驗並作答</li>
                </ol>
                <div className="mt-3 text-xs text-gray-500">里程碑提示：{milestoneHint}</div>
                <div className="mt-3">
                    <Link
                        href="/chat"
                        className="inline-flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                    >
                        開始今日小任務
                    </Link>
                </div>
            </div>

            {!topics.length && !mistakes.length && (
                <div className="mt-8 bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-sm text-gray-600">
                    <div className="font-semibold text-gray-800 mb-1">下一步行動</div>
                    <div>還沒有學習資料，可以先去聊天問問題或做一次小測驗。</div>
                    <div className="mt-2 flex gap-3">
                        <Link
                            href="/chat"
                            className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                        >
                            去聊天練習
                        </Link>
                        <Link
                            href="/chat"
                            className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                        >
                            做小測驗
                        </Link>
                    </div>
                </div>
            )}

            {/* Recent Summaries (short-term memory) */}
            <h2 className="text-lg font-bold text-gray-700 mt-8 mb-3 flex items-center gap-2">
                <BookOpen className="w-5 h-5" /> 近期對話摘要
            </h2>
            <div className="space-y-3">
                {summaries.length > 0 ? summaries.map((s, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <div className="font-semibold text-gray-800 mb-2">{s.title || '對話摘要'}</div>
                        {Array.isArray(s.bullets) && s.bullets.length > 0 ? (
                            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                                {s.bullets.map((b, i) => <li key={i}>{b}</li>)}
                            </ul>
                        ) : (
                            <div className="text-sm text-gray-500">（無摘要重點）</div>
                        )}
                        {s.highlight && (
                            <div className="mt-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-2">
                                {s.highlight}
                            </div>
                        )}
                    </div>
                )) : (
                    <div className="text-gray-500 text-sm text-center py-4 bg-white rounded-lg">
                        尚無摘要卡片，與 AI 對話後將自動生成。
                    </div>
                )}
            </div>
        </div>
    );
}
