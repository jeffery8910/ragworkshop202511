'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface QuizQuestion {
    id: number;
    question: string;
    options: string[];
    answer: string;
    explanation: string;
}

interface QuizData {
    type: 'quiz';
    title: string;
    questions: QuizQuestion[];
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    context?: any[];
    quizData?: QuizData;
}

interface ChatInterfaceProps {
    chatTitle: string;
    welcomeMessage: string;
    initialUserId?: string;
    initialUserName?: string;
    initialUserPicture?: string;
}

function QuizCard({ data }: { data: QuizData }) {
    const [selectedOptions, setSelectedOptions] = useState<{ [key: number]: string }>({});
    const [showResults, setShowResults] = useState<{ [key: number]: boolean }>({});

    const handleOptionSelect = (questionId: number, option: string) => {
        if (showResults[questionId]) return;
        setSelectedOptions(prev => ({ ...prev, [questionId]: option }));
    };

    const handleCheckAnswer = (questionId: number) => {
        setShowResults(prev => ({ ...prev, [questionId]: true }));
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6 my-2">
            <div className="flex items-center gap-2 border-b pb-4">
                <div className="bg-blue-100 p-2 rounded-lg">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-bold text-lg text-gray-800">{data.title}</h3>
            </div>

            <div className="space-y-8">
                {data.questions.map((q, idx) => (
                    <div key={q.id} className="space-y-4">
                        <div className="font-medium text-gray-800">
                            <span className="text-blue-600 mr-2">Q{idx + 1}.</span>
                            {q.question}
                        </div>

                        <div className="grid gap-2">
                            {q.options.map((option, optIdx) => {
                                const isSelected = selectedOptions[q.id] === option;
                                const isCorrect = option === q.answer;
                                const showResult = showResults[q.id];

                                let className = "p-3 rounded-lg border text-left transition-all ";
                                if (showResult) {
                                    if (isCorrect) className += "bg-green-50 border-green-200 text-green-700 font-medium";
                                    else if (isSelected) className += "bg-red-50 border-red-200 text-red-700";
                                    else className += "bg-gray-50 border-gray-200 text-gray-500 opacity-60";
                                } else {
                                    if (isSelected) className += "bg-blue-50 border-blue-200 text-blue-700 ring-1 ring-blue-200";
                                    else className += "hover:bg-gray-50 border-gray-200 text-gray-700";
                                }

                                return (
                                    <button
                                        key={optIdx}
                                        onClick={() => handleOptionSelect(q.id, option)}
                                        disabled={showResult}
                                        className={className}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs
                                                ${showResult && isCorrect ? 'bg-green-600 border-green-600 text-white' :
                                                    showResult && isSelected && !isCorrect ? 'bg-red-600 border-red-600 text-white' :
                                                        isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-500'}`}
                                            >
                                                {String.fromCharCode(65 + optIdx)}
                                            </div>
                                            {option}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {!showResults[q.id] && selectedOptions[q.id] && (
                            <button
                                onClick={() => handleCheckAnswer(q.id)}
                                className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                提交答案
                            </button>
                        )}

                        {showResults[q.id] && (
                            <div className={`p-4 rounded-lg text-sm ${selectedOptions[q.id] === q.answer ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                                <div className="font-bold mb-1">
                                    {selectedOptions[q.id] === q.answer ? '🎉 答對了！' : '❌ 答錯了'}
                                </div>
                                <div className="text-gray-600">
                                    <span className="font-semibold text-gray-700">解析：</span>
                                    {q.explanation}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function ChatInterface({
    chatTitle,
    welcomeMessage,
    initialUserId,
    initialUserName,
    initialUserPicture
}: ChatInterfaceProps) {
    const userId = initialUserId || 'web-user-demo';
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: welcomeMessage }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const [currentTitle, setCurrentTitle] = useState(chatTitle);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg, userId })
            });

            const data = await res.json();

            if (data.newTitle) {
                setCurrentTitle(data.newTitle);
            }

            let answerContent = data.answer;
            let quizData: QuizData | undefined;

            // Try to parse JSON if it looks like a quiz
            try {
                const jsonMatch = typeof answerContent === 'string' ? answerContent.match(/\{[\s\S]*\}/) : null;
                if (jsonMatch) {
                    const potentialJson = JSON.parse(jsonMatch[0]);
                    if (potentialJson.type === 'quiz' && Array.isArray(potentialJson.questions)) {
                        quizData = potentialJson as QuizData;
                        // Remove the JSON from the displayed text content if you want,
                        // or keep it as a fallback. Here we'll hide it if successfully parsed.
                        answerContent = answerContent.replace(jsonMatch[0], '').trim();
                        if (!answerContent) answerContent = "為您生成了以下測驗：";
                    }
                }
            } catch (err) {
                console.log('Failed to parse quiz JSON', err);
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: answerContent,
                context: data.context,
                quizData
            }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，系統發生錯誤，請稍後再試。' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar (Optional, hidden on mobile) */}
            <div className="hidden md:flex w-64 flex-col bg-white border-r p-4">
                <div className="flex items-center gap-2 mb-8 px-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <Bot className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-lg truncate" title={currentTitle}>{currentTitle}</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <div className="text-xs font-semibold text-gray-400 mb-2 px-2">最近對話</div>
                    <div className="p-2 bg-blue-50 text-blue-700 rounded text-sm cursor-pointer truncate">
                        {currentTitle}
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full bg-white shadow-xl my-4 md:rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between bg-white">
                    <div className="flex items-center gap-3">
                        <h2 className="font-semibold text-gray-800">{currentTitle}</h2>
                        {initialUserName && (
                            <span className="text-xs text-gray-500">使用者：{initialUserName}</span>
                        )}
                    </div>
                    <div className="text-xs text-green-600 flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        線上 (Online)
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/50">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-gray-800' : 'bg-blue-600'
                                }`}>
                                {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                            </div>

                            <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`p-4 rounded-2xl shadow-sm prose prose-sm max-w-none ${msg.role === 'user'
                                    ? 'bg-gray-800 text-white rounded-tr-none'
                                    : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                                    }`}>
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    {msg.quizData && <QuizCard data={msg.quizData} />}
                                </div>

                                {/* Source Citations */}
                                {msg.context && msg.context.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {msg.context.map((ctx: any, i: number) => (
                                            <div key={i} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100" title={ctx.text}>
                                                <BookOpen className="w-3 h-3" />
                                                參考來源 {i + 1} (Score: {ctx.score.toFixed(2)})
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex gap-4">
                            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                <Bot className="w-5 h-5 text-white" />
                            </div>
                            <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                <span className="text-sm text-gray-500">正在思考並檢索資料庫...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t">
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="輸入問題，例如：什麼是微積分？"
                            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                            disabled={loading}
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
