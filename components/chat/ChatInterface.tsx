'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    context?: any[];
}

interface ChatInterfaceProps {
    chatTitle: string;
}

export default function ChatInterface({ chatTitle }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: '你好！我是你的 AI 學習助手。有什麼我可以幫你的嗎？' }
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
                body: JSON.stringify({ message: userMsg })
            });

            const data = await res.json();

            if (data.newTitle) {
                setCurrentTitle(data.newTitle);
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.answer,
                context: data.context
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
                    <span className="font-bold text-lg">{currentTitle}</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <div className="text-xs font-semibold text-gray-400 mb-2 px-2">最近對話</div>
                    {/* History items would go here */}
                    <div className="p-2 bg-blue-50 text-blue-700 rounded text-sm cursor-pointer">
                        {currentTitle}
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full bg-white shadow-xl my-4 md:rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between bg-white">
                    <h2 className="font-semibold text-gray-800">{currentTitle}</h2>
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
