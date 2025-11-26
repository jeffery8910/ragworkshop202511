'use client';

import { useState } from 'react';
import { Brain, CheckCircle, XCircle, ArrowRight } from 'lucide-react';

interface QuizData {
    question: string;
    options: string[];
    correct_index: number;
    explanation: string;
}

export default function QuizPage() {
    const [topic, setTopic] = useState('');
    const [quiz, setQuiz] = useState<QuizData | null>(null);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<number | null>(null);
    const [showResult, setShowResult] = useState(false);

    const handleGenerate = async () => {
        if (!topic.trim()) return;
        setLoading(true);
        setQuiz(null);
        setSelected(null);
        setShowResult(false);

        try {
            const res = await fetch(`/api/student/quiz?topic=${encodeURIComponent(topic)}`);
            if (res.ok) {
                const data = await res.json();
                setQuiz(data);
            }
        } catch (error) {
            console.error('Failed to generate quiz', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOptionClick = (index: number) => {
        if (showResult) return;
        setSelected(index);
        setShowResult(true);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 flex flex-col items-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Brain className="w-8 h-8 text-indigo-600" />
                AI 適性化測驗
            </h1>

            {!quiz && (
                <div className="w-full max-w-md bg-white p-6 rounded-xl shadow-md text-center">
                    <p className="text-gray-600 mb-4">輸入你想練習的主題，AI 將為你生成測驗題。</p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="例如：Python 迴圈"
                            className="flex-1 p-2 border rounded-md"
                        />
                        <button
                            onClick={handleGenerate}
                            disabled={loading}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {loading ? '生成中...' : '開始測驗'}
                        </button>
                    </div>
                </div>
            )}

            {quiz && (
                <div className="w-full max-w-md mt-6">
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800 leading-relaxed">
                                {quiz.question}
                            </h2>
                        </div>

                        <div className="p-4 space-y-3">
                            {quiz.options.map((option, idx) => {
                                let btnClass = "w-full text-left p-4 rounded-lg border-2 transition-all ";
                                if (showResult) {
                                    if (idx === quiz.correct_index) {
                                        btnClass += "border-green-500 bg-green-50 text-green-700";
                                    } else if (idx === selected) {
                                        btnClass += "border-red-500 bg-red-50 text-red-700";
                                    } else {
                                        btnClass += "border-gray-100 text-gray-400";
                                    }
                                } else {
                                    btnClass += "border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 text-gray-700";
                                }

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleOptionClick(idx)}
                                        disabled={showResult}
                                        className={btnClass}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span>{option}</span>
                                            {showResult && idx === quiz.correct_index && <CheckCircle className="w-5 h-5 text-green-500" />}
                                            {showResult && idx === selected && idx !== quiz.correct_index && <XCircle className="w-5 h-5 text-red-500" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {showResult && (
                            <div className="bg-indigo-50 p-6 border-t border-indigo-100">
                                <h3 className="font-bold text-indigo-900 mb-2">詳解：</h3>
                                <p className="text-indigo-700 text-sm leading-relaxed">
                                    {quiz.explanation}
                                </p>
                                <button
                                    onClick={handleGenerate}
                                    className="mt-4 w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 flex items-center justify-center gap-2"
                                >
                                    下一題 <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
