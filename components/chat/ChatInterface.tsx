'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, BookOpen, Home, Sparkles, ListChecks, FileText, MessagesSquare, AlertCircle, Pencil, Check, X, Trash2 } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { z } from 'zod';

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
    conceptCard?: ConceptCardData;
    summaryCard?: SummaryCardData;
    qaCard?: QACardData;
    parseError?: string;
    abilityCard?: AbilityCardData;
    mistakeCard?: MistakeCardData;
}

interface ChatInterfaceProps {
    chatTitle: string;
    welcomeMessage: string;
    initialUserId?: string;
    initialUserName?: string;
    initialUserPicture?: string;
}

interface ConceptCardData {
    type: 'card';
    title: string;
    bullets: string[];
    highlight?: string;
}

interface SummaryCardData {
    type: 'summary';
    title: string;
    bullets: string[];
    highlight?: string;
}

interface QAPair {
    q: string;
    a: string;
}

interface QACardData {
    type: 'card-qa';
    title: string;
    qa: QAPair[];
    highlight?: string;
}

interface AbilityTopic {
    name: string;
    level?: number;
    progress?: number;
}

interface AbilityCardData {
    type: 'ability';
    title?: string;
    topics: AbilityTopic[];
    highlight?: string;
}

interface MistakeItem {
    topic?: string;
    question: string;
    reason?: string;
    suggestion?: string;
}

interface MistakeCardData {
    type: 'mistake';
    title?: string;
    items: MistakeItem[];
    highlight?: string;
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
                                    {selectedOptions[q.id] === q.answer ? '答對了！' : '答錯了'}
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

function ConceptCard({ data }: { data: ConceptCardData }) {
    return (
        <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm my-2">
            <div className="flex items-center gap-2 mb-2 text-amber-800 font-semibold">
                <Sparkles className="w-4 h-4" />
                {data.title}
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                {data.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
            {data.highlight && (
                <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    {data.highlight}
                </div>
            )}
        </div>
    );
}

function SummaryCard({ data }: { data: SummaryCardData }) {
    return (
        <div className="border border-gray-200 rounded-lg bg-[#f7f6f3] shadow-sm p-4 my-2">
            <div className="flex items-center gap-2 mb-2 text-gray-800 font-semibold">
                <FileText className="w-4 h-4" />
                {data.title}
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                {data.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
            {data.highlight && (
                <div className="mt-3 text-xs text-gray-700 bg-white border border-gray-200 rounded p-2">
                    {data.highlight}
                </div>
            )}
        </div>
    );
}

function AbilityCard({ data }: { data: AbilityCardData }) {
    return (
        <div className="border border-indigo-200 rounded-lg bg-indigo-50 shadow-sm p-4 my-2">
            <div className="flex items-center gap-2 mb-2 text-indigo-800 font-semibold">
                <BookOpen className="w-4 h-4" />
                {data.title || '學科能力分析'}
            </div>
            <div className="space-y-2 text-sm text-gray-800">
                {data.topics.map((t, i) => (
                    <div key={i} className="bg-white border border-indigo-100 rounded p-2 shadow-xs flex items-center justify-between">
                        <div>
                            <div className="font-medium text-gray-800">{t.name}</div>
                            <div className="text-[11px] text-gray-500">Lv.{t.level ?? 1}</div>
                        </div>
                        <div className="w-24 bg-gray-100 rounded-full h-2">
                            <div
                                className="bg-indigo-500 h-2 rounded-full"
                                style={{ width: `${t.progress ?? 50}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
            {data.highlight && (
                <div className="mt-3 text-xs text-indigo-700 bg-white border border-indigo-100 rounded p-2">
                    {data.highlight}
                </div>
            )}
        </div>
    );
}

function MistakeCard({ data }: { data: MistakeCardData }) {
    return (
        <div className="border border-red-200 rounded-lg bg-red-50 shadow-sm p-4 my-2">
            <div className="flex items-center gap-2 mb-2 text-red-800 font-semibold">
                <AlertCircle className="w-4 h-4" />
                {data.title || '錯題分析與建議'}
            </div>
            <div className="space-y-3 text-sm text-gray-800">
                {data.items.map((m, i) => (
                    <div key={i} className="bg-white border border-red-100 rounded p-3 shadow-xs">
                        <div className="text-xs text-gray-500 mb-1">{m.topic || '錯題'}</div>
                        <div className="font-medium text-gray-900 mb-1">{m.question}</div>
                        {m.reason && (
                            <div className="bg-red-50 border border-red-100 text-xs text-red-700 rounded p-2 mb-1">
                                <span className="font-semibold">錯誤原因：</span>{m.reason}
                            </div>
                        )}
                        {m.suggestion && (
                            <div className="bg-green-50 border border-green-100 text-xs text-green-700 rounded p-2">
                                <span className="font-semibold">AI 建議：</span>{m.suggestion}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {data.highlight && (
                <div className="mt-3 text-xs text-red-700 bg-white border border-red-100 rounded p-2">
                    {data.highlight}
                </div>
            )}
        </div>
    );
}

function QACard({ data }: { data: QACardData }) {
    return (
        <div className="border border-blue-200 rounded-lg bg-blue-50 shadow-sm p-4 my-2">
            <div className="flex items-center gap-2 mb-3 text-blue-800 font-semibold">
                <MessagesSquare className="w-4 h-4" />
                {data.title}
            </div>
            <div className="space-y-3 text-sm text-gray-800">
                {data.qa.map((item, i) => (
                    <div key={i} className="bg-white border border-blue-100 rounded p-3 shadow-sm">
                        <div className="font-medium text-blue-800 mb-1">Q{i + 1}: {item.q}</div>
                        <div className="text-gray-700">A: {item.a}</div>
                    </div>
                ))}
            </div>
            {data.highlight && (
                <div className="mt-3 text-xs text-blue-700 bg-white border border-blue-100 rounded p-2">
                    {data.highlight}
                </div>
            )}
        </div>
    );
}

// Zod schemas to validate structured JSON payloads from LLM
const quizSchema = z.object({
    type: z.literal('quiz'),
    title: z.string(),
    questions: z.array(z.object({
        id: z.union([z.number(), z.string()]).transform((v) => Number(v)),
        question: z.string(),
        options: z.array(z.string()).min(2),
        answer: z.string(),
        explanation: z.string()
    })).min(1)
});

const conceptSchema = z.object({
    type: z.literal('card'),
    title: z.string(),
    bullets: z.array(z.string()).min(1),
    highlight: z.string().optional()
});

const summarySchema = z.object({
    type: z.literal('summary'),
    title: z.string(),
    bullets: z.array(z.string()).min(1),
    highlight: z.string().optional()
});

const qaCardSchema = z.object({
    type: z.literal('card-qa'),
    title: z.string(),
    qa: z.array(z.object({
        q: z.string(),
        a: z.string()
    })).min(1),
    highlight: z.string().optional()
});

const abilitySchema = z.object({
    type: z.literal('ability'),
    title: z.string().optional(),
    topics: z.array(z.object({
        name: z.string(),
        level: z.number().optional(),
        progress: z.number().optional()
    })).min(1),
    highlight: z.string().optional()
});

const mistakeSchema = z.object({
    type: z.literal('mistake'),
    title: z.string().optional(),
    items: z.array(z.object({
        topic: z.string().optional(),
        question: z.string(),
        reason: z.string().optional(),
        suggestion: z.string().optional()
    })).min(1),
    highlight: z.string().optional()
});

type StructuredPayload =
    z.infer<typeof quizSchema>
    | z.infer<typeof conceptSchema>
    | z.infer<typeof summarySchema>
    | z.infer<typeof qaCardSchema>
    | z.infer<typeof abilitySchema>
    | z.infer<typeof mistakeSchema>;

function extractStructuredPayload(text: string): { payload?: StructuredPayload; cleaned: string; error?: string } {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { cleaned: text };
    try {
        const parsed = JSON.parse(match[0]);
        if (quizSchema.safeParse(parsed).success) {
            return { payload: quizSchema.parse(parsed), cleaned: text.replace(match[0], '').trim() };
        }
        if (conceptSchema.safeParse(parsed).success) {
            return { payload: conceptSchema.parse(parsed), cleaned: text.replace(match[0], '').trim() };
        }
        if (summarySchema.safeParse(parsed).success) {
            return { payload: summarySchema.parse(parsed), cleaned: text.replace(match[0], '').trim() };
        }
        if (qaCardSchema.safeParse(parsed).success) {
            return { payload: qaCardSchema.parse(parsed), cleaned: text.replace(match[0], '').trim() };
        }
        if (abilitySchema.safeParse(parsed).success) {
            return { payload: abilitySchema.parse(parsed), cleaned: text.replace(match[0], '').trim() };
        }
        if (mistakeSchema.safeParse(parsed).success) {
            return { payload: mistakeSchema.parse(parsed), cleaned: text.replace(match[0], '').trim() };
        }
        return { cleaned: text, error: 'JSON 內容與預期格式不符，未顯示卡片。' };
    } catch (err: any) {
        console.log('Structured JSON parse failed', err);
        return { cleaned: text, error: 'JSON 解析失敗，未顯示卡片。' };
    }
}

function createAnonymousId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return `web-${crypto.randomUUID()}`;
    }
    return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function hydrateHistoryMessage(message: Message): Message {
    if (message.role !== 'assistant' || typeof message.content !== 'string') {
        return message;
    }
    const { payload, cleaned, error } = extractStructuredPayload(message.content);
    const hydrated: Message = { ...message, content: cleaned };

    if (payload?.type === 'quiz') {
        hydrated.quizData = payload as QuizData;
        if (!hydrated.content) hydrated.content = '為您產生了以下測驗：';
    } else if (payload?.type === 'card') {
        hydrated.conceptCard = payload as ConceptCardData;
        if (!hydrated.content) hydrated.content = '為您產生了以下重點卡片：';
    } else if (payload?.type === 'summary') {
        hydrated.summaryCard = payload as SummaryCardData;
        if (!hydrated.content) hydrated.content = '以下是對話摘要：';
    } else if (payload?.type === 'card-qa') {
        hydrated.qaCard = payload as QACardData;
        if (!hydrated.content) hydrated.content = '以下是問答卡片：';
    } else if (payload?.type === 'ability') {
        hydrated.abilityCard = payload as AbilityCardData;
        if (!hydrated.content) hydrated.content = '以下是學科能力分析：';
    } else if (payload?.type === 'mistake') {
        hydrated.mistakeCard = payload as MistakeCardData;
        if (!hydrated.content) hydrated.content = '以下是錯題分析：';
    }

    if (error) hydrated.parseError = error;
    return hydrated;
}

export default function ChatInterface({
    chatTitle,
    welcomeMessage,
    initialUserId,
    initialUserName,
    initialUserPicture
}: ChatInterfaceProps) {
    const normalizedWelcome = (typeof welcomeMessage === 'string' && welcomeMessage.trim().length > 0)
        ? welcomeMessage
        : '你好！我是你的 AI 學習助手。有什麼我可以幫你的嗎？';
    const [userId, setUserId] = useState(initialUserId || '');
    const [historyLoading, setHistoryLoading] = useState(false);
    const hasUserInteractedRef = useRef(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: normalizedWelcome,
        },
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

    useEffect(() => {
        if (initialUserId) {
            setUserId(initialUserId);
            return;
        }
        if (typeof window === 'undefined') return;
        const storageKey = 'rag_user_id';
        let stored = window.localStorage.getItem(storageKey);
        if (!stored) {
            stored = createAnonymousId();
            window.localStorage.setItem(storageKey, stored);
        }
        setUserId(stored);
    }, [initialUserId]);

    const [currentTitle, setCurrentTitle] = useState(chatTitle);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState(chatTitle);

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        setHistoryLoading(true);

        fetch(`/api/chat/session?userId=${encodeURIComponent(userId)}&limit=50`)
            .then(async res => {
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.error || '載入對話紀錄失敗');
                }
                return res.json();
            })
            .then(data => {
                if (cancelled || hasUserInteractedRef.current) return;
                if (data?.title) {
                    setCurrentTitle(data.title);
                    if (!isEditingTitle) {
                        setTempTitle(data.title);
                    }
                }
                if (Array.isArray(data?.messages) && data.messages.length > 0) {
                    setMessages(data.messages.map((msg: Message) => hydrateHistoryMessage(msg)));
                } else {
                    setMessages([
                        {
                            role: 'assistant',
                            content: normalizedWelcome,
                        },
                    ]);
                }
            })
            .catch(() => {
                // Keep current welcome message on failure
            })
            .finally(() => {
                if (!cancelled) setHistoryLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [userId]);

    useEffect(() => {
        if (!isEditingTitle) {
            setTempTitle(currentTitle);
        }
    }, [currentTitle, isEditingTitle]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading) return;
        await sendMessage(input);
    };

    const sendMessage = async (text: string, displayText?: string) => {
        if (!userId) {
            setMessages(prev => [...prev, { role: 'assistant', content: '系統正在初始化使用者資訊，請稍候再試。' }]);
            return;
        }
        hasUserInteractedRef.current = true;
        const userMsg = text;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: displayText || userMsg }]);
        setLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg, userId })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data?.error || '聊天服務回應失敗，請稍後再試');
            }

            if (data.newTitle) {
                setCurrentTitle(data.newTitle);
            }

            let answerContent = data.answer;
            let quizData: QuizData | undefined;
            let conceptCard: ConceptCardData | undefined;
            let summaryCard: SummaryCardData | undefined;
            let qaCard: QACardData | undefined;
            let abilityCard: AbilityCardData | undefined;
            let mistakeCard: MistakeCardData | undefined;
            let parseError: string | undefined;

            if (!answerContent) {
                throw new Error(data?.error || '沒有收到模型回覆，請重新選擇聊天模型或檢查 API Key');
            }

            if (typeof answerContent === 'string') {
                const { payload, cleaned, error } = extractStructuredPayload(answerContent);
                answerContent = cleaned;
                if (payload?.type === 'quiz') {
                    quizData = payload as QuizData;
                    if (!answerContent) answerContent = '為您產生了以下測驗：';
                } else if (payload?.type === 'card') {
                    conceptCard = payload as ConceptCardData;
                    if (!answerContent) answerContent = '為您產生了以下重點卡片：';
                } else if (payload?.type === 'summary') {
                    summaryCard = payload as SummaryCardData;
                    if (!answerContent) answerContent = '以下是對話摘要：';
                } else if (payload?.type === 'card-qa') {
                    qaCard = payload as QACardData;
                    if (!answerContent) answerContent = '以下是問答卡片：';
                } else if (payload?.type === 'ability') {
                    abilityCard = payload as AbilityCardData;
                    if (!answerContent) answerContent = '以下是學科能力分析：';
                } else if (payload?.type === 'mistake') {
                    mistakeCard = payload as MistakeCardData;
                    if (!answerContent) answerContent = '以下是錯題分析：';
                }
                if (error) parseError = error;
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: answerContent,
                context: data.context,
                quizData,
                conceptCard,
                summaryCard,
                qaCard,
                abilityCard,
                mistakeCard,
                parseError
            }]);
        } catch (error: any) {
            const msg = error?.message || '抱歉，系統發生錯誤，請稍後再試。';
            setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
        } finally {
            setLoading(false);
        }
    };

    const quickActions = [
        {
            label: '產生測驗 JSON',
            icon: ListChecks,
            prompt: 'You must return ONLY valid JSON. 請根據目前的對話或使用者最後一個問題，輸出一份 JSON 測驗：{"type":"quiz","title":"標題","questions":[{"id":1,"question":"題目","options":["A","B","C","D"],"answer":"正確選項","explanation":"解析"}]}。不要使用 Markdown，不能出現 ```。',
            display: '產生測驗 JSON 中...'
        },
        {
            label: '對話摘要',
            icon: FileText,
            prompt: 'You must return ONLY valid JSON. 請回傳摘要 JSON：{"type":"summary","title":"對話摘要","bullets":["重點1","重點2","重點3"],"highlight":"一句提醒"}。不要使用 Markdown，不能出現 ```。',
            display: '產生對話摘要中...'
        },
        {
            label: '概念卡片',
            icon: Sparkles,
            prompt: 'You must return ONLY valid JSON. 請回傳概念卡片 JSON：{"type":"card","title":"主題","bullets":["重點1","重點2","重點3"],"highlight":"一句關鍵提醒"}。不要使用 Markdown，不能出現 ```。',
            display: '產生概念卡片中...'
        },
        {
            label: '互動問答卡',
            icon: MessagesSquare,
            prompt: 'You must return ONLY valid JSON. 請回傳問答卡 JSON：{"type":"card-qa","title":"主題","qa":[{"q":"問題1","a":"回答1"},{"q":"問題2","a":"回答2"}],"highlight":"一句提醒"}。不要使用 Markdown，不能出現 ```。',
            display: '產生互動問答卡中...'
        },
        {
            label: '學科能力分析',
            icon: BookOpen,
            prompt: 'You must return ONLY valid JSON. 請回傳學科能力分析 JSON：{"type":"ability","title":"學科能力分析","topics":[{"name":"數學","level":2,"progress":65},{"name":"物理","level":1,"progress":40}],"highlight":"一句提醒"}。不要使用 Markdown，不能出現 ```。',
            display: '產生學科能力分析中...'
        },
        {
            label: '錯題分析與建議',
            icon: AlertCircle,
            prompt: 'You must return ONLY valid JSON. 請回傳錯題分析 JSON：{"type":"mistake","title":"錯題分析","items":[{"topic":"幾何","question":"三角形相似條件？","reason":"混淆AA與SSS","suggestion":"先複習 AA 判定並做 3 題練習"},{"topic":"微積分","question":"什麼是導數？","reason":"概念模糊","suggestion":"用極限定義推一次"}],"highlight":"一句提醒"}。不要使用 Markdown，不能出現 ```。',
            display: '產生錯題分析中...'
        }
    ];

    const handleTitleSave = async () => {
        if (!userId) {
            alert('使用者資訊尚未初始化，請稍後再試。');
            return;
        }
        if (!tempTitle.trim()) return;
        const oldTitle = currentTitle;
        setCurrentTitle(tempTitle);
        setIsEditingTitle(false);
        try {
            const res = await fetch('/api/chat/session', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, title: tempTitle })
            });
            if (!res.ok) throw new Error('Failed to update title');
        } catch (e) {
            alert('無法儲存標題，請稍後再試。');
            setCurrentTitle(oldTitle);
        }
    };

    const handleClearHistory = async () => {
        if (!userId) {
            alert('使用者資訊尚未初始化，請稍後再試。');
            return;
        }
        if (!confirm('確定要刪除所有對話紀錄嗎？此動作無法復原。')) return;
        setMessages([{ role: 'assistant', content: normalizedWelcome }]);
        try {
            const res = await fetch(`/api/chat/session?userId=${userId}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Failed to clear history');
        } catch (e) {
            alert('無法刪除紀錄，請稍後再試。');
        }
    };

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar (Optional, hidden on mobile) */}
            <div className="hidden md:flex w-64 flex-col bg-white border-r p-4">
                <div className="flex items-center justify-between mb-8 px-2">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-lg truncate" title={currentTitle}>{currentTitle}</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-lg border border-blue-100"
                    >
                        <Home className="w-4 h-4" />
                        回到首頁
                    </Link>

                    <div className="flex-1 overflow-y-auto">
                        <div className="text-xs font-semibold text-gray-400 mb-2 px-2">最近對話</div>
                        <div className="p-2 bg-blue-50 text-blue-700 rounded text-sm cursor-pointer truncate">
                            {currentTitle}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full bg-white shadow-xl my-4 md:rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between bg-white">
                    <div className="flex items-center gap-3">
                        {isEditingTitle ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={tempTitle}
                                    onChange={(e) => setTempTitle(e.target.value)}
                                    className="border rounded px-2 py-1 text-sm"
                                    autoFocus
                                />
                                <button onClick={handleTitleSave} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                    <Check className="w-4 h-4" />
                                </button>
                                <button onClick={() => { setIsEditingTitle(false); setTempTitle(currentTitle); }} className="p-1 text-red-600 hover:bg-red-50 rounded">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <h2 className="font-semibold text-gray-800">{currentTitle}</h2>
                                <button
                                    onClick={() => setIsEditingTitle(true)}
                                    className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                                    title="編輯標題"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        {initialUserName && (
                            <span className="text-xs text-gray-500">使用者：{initialUserName}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleClearHistory}
                            className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 hover:underline"
                            title="清空對話紀錄"
                        >
                            <Trash2 className="w-4 h-4" />
                            清除對話
                        </button>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                        >
                            <Home className="w-4 h-4" />
                            回到首頁
                        </Link>
                        <div className="text-xs text-green-600 flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            線上
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/50">
                    {historyLoading && (
                        <div className="text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2 inline-flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            正在載入對話紀錄...
                        </div>
                    )}
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
                                    {msg.conceptCard && <ConceptCard data={msg.conceptCard} />}
                                    {msg.summaryCard && <SummaryCard data={msg.summaryCard} />}
                                    {msg.qaCard && <QACard data={msg.qaCard} />}
                                    {msg.abilityCard && <AbilityCard data={msg.abilityCard} />}
                                    {msg.mistakeCard && <MistakeCard data={msg.mistakeCard} />}
                                    {msg.parseError && (
                                        <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2">
                                            {msg.parseError}
                                        </div>
                                    )}
                                </div>

                                {/* Source Citations */}
                                {msg.context && msg.context.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {msg.context.map((ctx: any, i: number) => (
                                            <div key={i} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100" title={ctx.text}>
                                                <BookOpen className="w-3 h-3" />
                                                參考來源 {i + 1}（相似度 {ctx.score.toFixed(2)}）
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
                                <span className="text-sm text-gray-500">正在思考並查詢知識庫...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Quick actions */}
                <div className="px-4 pb-2 flex flex-wrap gap-2 bg-white border-t border-b">
                    {quickActions.map((action) => {
                        const Icon = action.icon;
                        return (
                            <button
                                key={action.label}
                                type="button"
                                onClick={() => sendMessage(action.prompt, action.display)}
                                className="flex items-center gap-1 text-xs px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                                disabled={loading || historyLoading || !userId}
                            >
                                <Icon className="w-4 h-4" />
                                {action.label}
                            </button>
                        );
                    })}
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
                            disabled={loading || historyLoading || !userId}
                        />
                        <button
                            type="submit"
                            disabled={loading || historyLoading || !userId || !input.trim()}
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
