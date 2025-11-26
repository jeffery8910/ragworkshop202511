'use client';

import { useState } from 'react';
import { Settings, Save, Database, Key, CheckCircle, AlertCircle, MessageSquare, Cpu } from 'lucide-react';

export default function SetupPanel() {
    const [config, setConfig] = useState({
        MONGODB_URI: '',
        MONGODB_DB_NAME: '',
        PINECONE_API_KEY: '',
        PINECONE_INDEX_NAME: '',
        GEMINI_API_KEY: '',
        OPENAI_API_KEY: '',
        OPENROUTER_API_KEY: '',
        EMBEDDING_PROVIDER: 'gemini',
        CHAT_TITLE: '',
        WELCOME_MESSAGE: ''
    });
    const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
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
                setMessage('設定已儲存並連線成功！');
                // Optional: Reload page to reflect changes in other components
                setTimeout(() => window.location.reload(), 1500);
            } else {
                setStatus('error');
                setMessage(data.error || '儲存失敗');
            }
        } catch (error) {
            setStatus('error');
            setMessage('發生錯誤，請稍後再試');
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6 border-l-4 border-blue-500">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
                <Settings className="w-6 h-6 text-blue-600" />
                系統快速設定 (System Setup)
            </h2>

            <p className="text-gray-600 mb-6 text-sm">
                若您未在部署時設定環境變數，請在此輸入必要的連線資訊。系統將會把設定儲存於安全的 Cookie 中。
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

                {/* LLM Section */}
                <div className="space-y-4">
                    <h3 className="text-md font-semibold text-gray-700 flex items-center gap-2 border-b pb-2">
                        <Key className="w-4 h-4" /> AI 模型金鑰 (擇一填寫即可)
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Gemini API Key</label>
                            <input
                                type="password"
                                name="GEMINI_API_KEY"
                                value={config.GEMINI_API_KEY}
                                onChange={handleChange}
                                className="w-full border rounded p-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">OpenAI API Key</label>
                            <input
                                type="password"
                                name="OPENAI_API_KEY"
                                value={config.OPENAI_API_KEY}
                                onChange={handleChange}
                                className="w-full border rounded p-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">OpenRouter API Key</label>
                            <input
                                type="password"
                                name="OPENROUTER_API_KEY"
                                value={config.OPENROUTER_API_KEY}
                                onChange={handleChange}
                                className="w-full border rounded p-2 text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Embedding Provider Section */}
                <div className="space-y-4">
                    <h3 className="text-md font-semibold text-gray-700 flex items-center gap-2 border-b pb-2">
                        <Cpu className="w-4 h-4" /> Embedding Provider
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Embedding Provider</label>
                            <select
                                name="EMBEDDING_PROVIDER"
                                value={config.EMBEDDING_PROVIDER}
                                onChange={handleSelectChange}
                                className="w-full border rounded p-2 text-sm"
                            >
                                <option value="gemini">Google Gemini</option>
                                <option value="openai">OpenAI</option>
                                <option value="openrouter">OpenRouter</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                                選擇用於向量嵌入的 AI 服務。Gemini 免費，OpenAI 需付費。
                            </p>
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
                    {status === 'saving' ? '連線測試與儲存中...' : '儲存設定並連線 (Save & Connect)'}
                </button>
            </form>
        </div>
    );
}
