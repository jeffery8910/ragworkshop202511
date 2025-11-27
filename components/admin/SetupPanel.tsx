'use client';

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Settings, Database, CheckCircle, AlertCircle, Cpu, RefreshCw, Smartphone, Lock } from 'lucide-react';

type Provider = 'gemini' | 'openai' | 'openrouter' | 'pinecone';

interface SetupPanelProps {
    initialConfig: Record<string, string>;
}

export default function SetupPanel({ initialConfig }: SetupPanelProps) {
    const [config, setConfig] = useState({
        MONGODB_URI: initialConfig['MONGODB_URI'] || '',
        MONGODB_DB_NAME: initialConfig['MONGODB_DB_NAME'] || '',
        PINECONE_API_KEY: initialConfig['PINECONE_API_KEY'] || '',
        PINECONE_INDEX_NAME: initialConfig['PINECONE_INDEX_NAME'] || '',
        GEMINI_API_KEY: initialConfig['GEMINI_API_KEY'] || '',
        OPENAI_API_KEY: initialConfig['OPENAI_API_KEY'] || '',
        OPENROUTER_API_KEY: initialConfig['OPENROUTER_API_KEY'] || '',
        LINE_CHANNEL_SECRET: initialConfig['LINE_CHANNEL_SECRET'] || '',
        LINE_CHANNEL_ACCESS_TOKEN: initialConfig['LINE_CHANNEL_ACCESS_TOKEN'] || '',
        LINE_LOGIN_CHANNEL_ID: initialConfig['LINE_LOGIN_CHANNEL_ID'] || '',
        LINE_LOGIN_CHANNEL_SECRET: initialConfig['LINE_LOGIN_CHANNEL_SECRET'] || '',
        EMBEDDING_PROVIDER: initialConfig['EMBEDDING_PROVIDER'] || 'gemini',
        EMBEDDING_MODEL: initialConfig['EMBEDDING_MODEL'] || '',
        CHAT_MODEL: initialConfig['CHAT_MODEL'] || ''
    });

    const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [testingProvider, setTestingProvider] = useState<Provider | null>(null);
    const [availableChat, setAvailableChat] = useState<Record<string, string[]>>({
        gemini: [],
        openai: [],
        openrouter: [],
        pinecone: [],
    });
    const [availableEmbed, setAvailableEmbed] = useState<Record<string, string[]>>({
        gemini: [],
        openai: [],
        openrouter: [],
        pinecone: [],
    });
    const [chatProvider, setChatProvider] = useState<Provider>(
        initialConfig['GEMINI_API_KEY'] ? 'gemini' :
            initialConfig['OPENAI_API_KEY'] ? 'openai' :
                initialConfig['OPENROUTER_API_KEY'] ? 'openrouter' :
                    initialConfig['PINECONE_API_KEY'] ? 'pinecone' : 'gemini'
    );

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const handleTestConnection = async (provider: Provider, target: 'chat' | 'embed' | 'both' = 'chat') => {
        setTestingProvider(provider);
        setMessage('');
        let apiKey = '';
        if (provider === 'gemini') apiKey = config.GEMINI_API_KEY;
        if (provider === 'openai') apiKey = config.OPENAI_API_KEY;
        if (provider === 'openrouter') apiKey = config.OPENROUTER_API_KEY;
        if (provider === 'pinecone') apiKey = config.PINECONE_API_KEY;

        if (!apiKey) {
            alert('請先輸入 API Key');
            setTestingProvider(null);
            return;
        }

        try {
            const res = await fetch('/api/admin/models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, apiKey })
            });
            const data = await res.json();

            if (res.ok) {
                setAvailableChat(prev => ({ ...prev, [provider]: data.chatModels || [] }));
                setAvailableEmbed(prev => ({ ...prev, [provider]: data.embeddingModels || [] }));

                if ((target === 'chat' || target === 'both') && !config.CHAT_MODEL && data.chatModels?.length && chatProvider === provider) {
                    setConfig(prev => ({ ...prev, CHAT_MODEL: data.chatModels[0] }));
                }
                if ((target === 'embed' || target === 'both') && !config.EMBEDDING_MODEL && data.embeddingModels?.length && config.EMBEDDING_PROVIDER === provider) {
                    setConfig(prev => ({ ...prev, EMBEDDING_MODEL: data.embeddingModels[0] }));
                }

                await fetch('/api/admin/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...config,
                        CHAT_MODEL: config.CHAT_MODEL || data.chatModels?.[0] || '',
                        EMBEDDING_MODEL: config.EMBEDDING_MODEL || data.embeddingModels?.[0] || ''
                    }),
                });

                alert(`測試成功，聊天模型 ${data.chatModels?.length || 0} 筆，Embedding 模型 ${data.embeddingModels?.length || 0} 筆。`);
            } else {
                alert(`測試失敗: ${data.error}`);
            }
        } catch (e) {
            alert('連線測試時發生錯誤');
        } finally {
            setTestingProvider(null);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setStatus('saving');
        setMessage('');

        try {
            const res = await fetch('/api/admin/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });

            const data = await res.json();

            if (res.ok) {
                setStatus('success');
                setMessage('設定已儲存並驗證！');
                setTimeout(() => window.location.reload(), 1200);
            } else {
                setStatus('error');
                setMessage(data.error || '儲存失敗');
            }
        } catch (error) {
            setStatus('error');
            setMessage('發生錯誤，請稍後再試');
        }
    };

    const embeddingPlaceholder =
        config.EMBEDDING_PROVIDER === 'gemini'
            ? 'text-embedding-004'
            : config.EMBEDDING_PROVIDER === 'openai'
                ? 'text-embedding-3-small'
                : config.EMBEDDING_PROVIDER === 'pinecone'
                    ? 'multilingual-e5-large'
                    : 'openai/text-embedding-3-small';

    return (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6 border-l-4 border-blue-500">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
                <Settings className="w-6 h-6 text-blue-600" />
                系統快速設定 (System Setup)
            </h2>

            <p className="text-gray-600 mb-6 text-sm">
                請輸入必要的連線資訊，並透過「測試 / 取得模型」按鈕快速抓取可用的聊天與 Embedding 模型。
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Database Section */}
                <div className="space-y-4">
                    <h3 className="text-md font-semibold text-gray-700 flex items-center gap-2 border-b pb-2">
                        <Database className="w-4 h-4" /> 資料庫設定
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">MongoDB URI</label>
                            <input
                                type="password"
                                name="MONGODB_URI"
                                value={config.MONGODB_URI}
                                onChange={handleChange}
                                placeholder="mongodb+srv://..."
                                className="w-full border rounded p-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">DB Name</label>
                            <input
                                type="text"
                                name="MONGODB_DB_NAME"
                                value={config.MONGODB_DB_NAME}
                                onChange={handleChange}
                                placeholder="rag_workshop"
                                className="w-full border rounded p-2 text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Vector DB Section */}
                <div className="space-y-4">
                    <h3 className="text-md font-semibold text-gray-700 flex items-center gap-2 border-b pb-2">
                        <Database className="w-4 h-4" /> 向量資料庫 (Pinecone)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Pinecone API Key</label>
                            <input
                                type="password"
                                name="PINECONE_API_KEY"
                                value={config.PINECONE_API_KEY}
                                onChange={handleChange}
                                className="w-full border rounded p-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Index Name</label>
                            <input
                                type="text"
                                name="PINECONE_INDEX_NAME"
                                value={config.PINECONE_INDEX_NAME}
                                onChange={handleChange}
                                placeholder="rag-index"
                                className="w-full border rounded p-2 text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* LINE Settings Section */}
                <div className="space-y-4">
                    <h3 className="text-md font-semibold text-gray-700 flex items-center gap-2 border-b pb-2">
                        <Smartphone className="w-4 h-4" /> LINE Bot 設定
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Channel Secret</label>
                            <input
                                type="password"
                                name="LINE_CHANNEL_SECRET"
                                value={config.LINE_CHANNEL_SECRET}
                                onChange={handleChange}
                                className="w-full border rounded p-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Channel Access Token</label>
                            <input
                                type="password"
                                name="LINE_CHANNEL_ACCESS_TOKEN"
                                value={config.LINE_CHANNEL_ACCESS_TOKEN}
                                onChange={handleChange}
                                className="w-full border rounded p-2 text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* LINE Login Section */}
                <div className="space-y-4">
                    <h3 className="text-md font-semibold text-gray-700 flex items-center gap-2 border-b pb-2">
                        <Lock className="w-4 h-4" /> LINE Login 設定
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Login Channel ID</label>
                            <input
                                type="text"
                                name="LINE_LOGIN_CHANNEL_ID"
                                value={config.LINE_LOGIN_CHANNEL_ID}
                                onChange={handleChange}
                                placeholder="2000xxxxxx"
                                className="w-full border rounded p-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Login Channel Secret</label>
                            <input
                                type="password"
                                name="LINE_LOGIN_CHANNEL_SECRET"
                                value={config.LINE_LOGIN_CHANNEL_SECRET}
                                onChange={handleChange}
                                className="w-full border rounded p-2 text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* LLM Section */}
                <div className="space-y-4">
                    <h3 className="text-md font-semibold text-gray-700 flex items-center gap-2 border-b pb-2">
                        <Cpu className="w-4 h-4" /> 模型設定 (LLM & Embedding)
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Gemini */}
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-blue-800">Google Gemini</span>
                                {testingProvider === 'gemini' && <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />}
                            </div>
                            <input
                                type="password"
                                name="GEMINI_API_KEY"
                                value={config.GEMINI_API_KEY}
                                onChange={handleChange}
                                placeholder="AIzaSy..."
                                className="w-full border rounded p-2 text-sm mb-2"
                            />
                            <button
                                type="button"
                                onClick={() => handleTestConnection('gemini', 'both')}
                                disabled={testingProvider === 'gemini'}
                                className="w-full bg-blue-600 text-white text-xs py-1 rounded hover:bg-blue-700 disabled:opacity-50 mb-2"
                            >
                                測試 / 取得模型
                            </button>
                            {availableChat['gemini']?.length > 0 && (
                                <select
                                    name="CHAT_MODEL"
                                    value={config.CHAT_MODEL}
                                    onChange={handleChange}
                                    className="w-full border rounded p-2 text-sm bg-white"
                                >
                                    {availableChat['gemini'].map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* OpenAI */}
                        <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-green-800">OpenAI</span>
                                {testingProvider === 'openai' && <RefreshCw className="w-3 h-3 animate-spin text-green-600" />}
                            </div>
                            <input
                                type="password"
                                name="OPENAI_API_KEY"
                                value={config.OPENAI_API_KEY}
                                onChange={handleChange}
                                placeholder="sk-..."
                                className="w-full border rounded p-2 text-sm mb-2"
                            />
                            <button
                                type="button"
                                onClick={() => handleTestConnection('openai', 'both')}
                                disabled={testingProvider === 'openai'}
                                className="w-full bg-green-600 text-white text-xs py-1 rounded hover:bg-green-700 disabled:opacity-50 mb-2"
                            >
                                測試 / 取得模型
                            </button>
                        </div>

                        {/* OpenRouter */}
                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-purple-800">OpenRouter</span>
                                {testingProvider === 'openrouter' && <RefreshCw className="w-3 h-3 animate-spin text-purple-600" />}
                            </div>
                            <input
                                type="password"
                                name="OPENROUTER_API_KEY"
                                value={config.OPENROUTER_API_KEY}
                                onChange={handleChange}
                                placeholder="sk-or-..."
                                className="w-full border rounded p-2 text-sm mb-2"
                            />
                            <button
                                type="button"
                                onClick={() => handleTestConnection('openrouter', 'both')}
                                disabled={testingProvider === 'openrouter'}
                                className="w-full bg-purple-600 text-white text-xs py-1 rounded hover:bg-purple-700 disabled:opacity-50 mb-2"
                            >
                                測試 / 取得模型
                            </button>
                        </div>
                    </div>

                    {/* Chat Model Selection */}
                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800">聊天模型</span>
                            <span className="text-xs text-gray-500">(請先填入 API Key 並點測試取得列表)</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">供應商</label>
                                <select
                                    value={chatProvider}
                                    onChange={e => setChatProvider(e.target.value as Provider)}
                                    className="w-full border rounded p-2 text-sm bg-white"
                                >
                                    <option value="gemini">Google Gemini</option>
                                    <option value="openai">OpenAI</option>
                                    <option value="openrouter">OpenRouter</option>
                                    <option value="pinecone">Pinecone Inference</option>
                                </select>
                            </div>
                            <div className="md:col-span-2 flex gap-2 items-end">
                                <button
                                    type="button"
                                    onClick={() => handleTestConnection(chatProvider, 'chat')}
                                    disabled={testingProvider === chatProvider}
                                    className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {testingProvider === chatProvider ? '測試中...' : '測試/取得聊天模型'}
                                </button>
                                <div className="flex-1">
                                    <label className="block text-xs text-gray-600 mb-1">啟用模型</label>
                                    {availableChat[chatProvider]?.length ? (
                                        <select
                                            name="CHAT_MODEL"
                                            value={config.CHAT_MODEL}
                                            onChange={handleChange}
                                            className="w-full border rounded p-2 text-sm bg-white"
                                        >
                                            {availableChat[chatProvider].map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            name="CHAT_MODEL"
                                            value={config.CHAT_MODEL}
                                            onChange={handleChange}
                                            placeholder={
                                                chatProvider === 'gemini'
                                                    ? 'gemini-2.5-flash'
                                                    : chatProvider === 'openai'
                                                        ? 'gpt-4.1'
                                                        : chatProvider === 'pinecone'
                                                            ? 'multilingual-e5-large'
                                                            : 'mistralai/Mistral-7B-Instruct:free'
                                            }
                                            className="w-full border rounded p-2 text-sm"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Embedding Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Embedding Provider</label>
                            <select
                                name="EMBEDDING_PROVIDER"
                                value={config.EMBEDDING_PROVIDER}
                                onChange={handleChange}
                                className="w-full border rounded p-2 text-sm bg-white"
                            >
                                <option value="gemini">Google Gemini</option>
                                <option value="openai">OpenAI</option>
                                <option value="pinecone">Pinecone Inference</option>
                                <option value="openrouter">OpenRouter</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Embedding Model</label>
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    {availableEmbed[config.EMBEDDING_PROVIDER]?.length > 0 ? (
                                        <select
                                            name="EMBEDDING_MODEL"
                                            value={config.EMBEDDING_MODEL}
                                            onChange={handleChange}
                                            className="w-full border rounded p-2 text-sm bg-white"
                                        >
                                            {availableEmbed[config.EMBEDDING_PROVIDER].map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            name="EMBEDDING_MODEL"
                                            value={config.EMBEDDING_MODEL}
                                            onChange={handleChange}
                                            placeholder={embeddingPlaceholder}
                                            className="w-full border rounded p-2 text-sm"
                                        />
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleTestConnection(config.EMBEDDING_PROVIDER as Provider, 'embed')}
                                    disabled={testingProvider === config.EMBEDDING_PROVIDER}
                                    className="bg-blue-500 text-white px-3 py-2 rounded text-sm hover:bg-blue-600 disabled:opacity-50"
                                >
                                    {testingProvider === config.EMBEDDING_PROVIDER ? '取得中...' : '測試 / 取得 Embedding 模型'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status Message */}
                {message && (
                    <div className={`p-3 rounded flex items-center gap-2 text-sm ${status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {status === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {message}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={status === 'saving'}
                    className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 flex items-center justify-center gap-2 font-medium disabled:opacity-50"
                >
                    {status === 'saving' ? '儲存中...' : '儲存並驗證'}
                </button>
            </form>
        </div>
    );
}
