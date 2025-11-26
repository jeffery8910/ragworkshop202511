
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
        EMBEDDING_PROVIDER: initialConfig['EMBEDDING_PROVIDER'] || 'gemini',
        EMBEDDING_MODEL: initialConfig['EMBEDDING_MODEL'] || '',
        CHAT_MODEL: initialConfig['CHAT_MODEL'] || '',
        CHAT_TITLE: initialConfig['CHAT_TITLE'] || '',
        WELCOME_MESSAGE: initialConfig['WELCOME_MESSAGE'] || ''
    });

    const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [testingProvider, setTestingProvider] = useState<string | null>(null);
    const [availableModels, setAvailableModels] = useState<Record<string, string[]>>({});

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const handleTestConnection = async (provider: string) => {
        setTestingProvider(provider);
        setMessage('');
        let apiKey = '';
        if (provider === 'gemini') apiKey = config.GEMINI_API_KEY;
        if (provider === 'openai') apiKey = config.OPENAI_API_KEY;
        if (provider === 'openrouter') apiKey = config.OPENROUTER_API_KEY;

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
                setAvailableModels(prev => ({ ...prev, [provider]: data.models }));
                alert(`連線成功！已取得 ${data.models.length} 個模型。`);
            } else {
                alert(`連線失敗: ${data.error}`);
            }
        } catch (e) {
            alert('連線測試發生錯誤');
        } finally {
            setTestingProvider(null);
        }
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
                請輸入必要的連線資訊。點擊「測試連線」可驗證 Key 並取得可用模型列表。
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
                    <div className="grid grid-cols-1 gap-4">
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

                {/* Chat Customization Section */}
                <div className="space-y-4">
                    <h3 className="text-md font-semibold text-gray-700 flex items-center gap-2 border-b pb-2">
                        <MessageSquare className="w-4 h-4" /> 聊天介面客製
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Chat Title</label>
                            <input
                                type="text"
                                name="CHAT_TITLE"
                                value={config.CHAT_TITLE}
                                onChange={handleChange}
                                placeholder="RAG 工作坊"
                                className="w-full border rounded p-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Welcome Message</label>
                            <input
                                type="text"
                                name="WELCOME_MESSAGE"
                                value={config.WELCOME_MESSAGE}
                                onChange={handleChange}
                                placeholder="你好！我是你的 AI 學習助手。"
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
                        {['gemini', 'openai', 'openrouter'].map(provider => (
                            <div key={provider} className="flex items-end gap-2">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{provider} API Key</label>
                                    <input
                                        type="password"
                                        name={`${provider.toUpperCase()}_API_KEY`}
                                        value={(config as any)[`${provider.toUpperCase()}_API_KEY`]}
                                        onChange={handleChange}
                                        className="w-full border rounded p-2 text-sm"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleTestConnection(provider)}
                                    disabled={testingProvider === provider}
                                    className="bg-gray-100 text-gray-700 px-3 py-2 rounded border hover:bg-gray-200 text-sm flex items-center gap-1 h-[38px]"
                                >
                                    {testingProvider === provider ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                    測試 & 取得模型
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Embedding Settings Section */}
                <div className="space-y-4">
                    <h3 className="text-md font-semibold text-gray-700 flex items-center gap-2 border-b pb-2">
                        <Cpu className="w-4 h-4" /> Embedding 設定
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Embedding Provider</label>
                            <select
                                name="EMBEDDING_PROVIDER"
                                value={config.EMBEDDING_PROVIDER}
                                onChange={handleChange}
                                className="w-full border rounded p-2 text-sm"
                            >
                                <option value="gemini">Google Gemini</option>
                                <option value="openai">OpenAI</option>
                                <option value="openrouter">OpenRouter</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Embedding Model Name</label>
                            {availableModels[config.EMBEDDING_PROVIDER]?.length > 0 ? (
                                <select
                                    name="EMBEDDING_MODEL"
                                    value={config.EMBEDDING_MODEL}
                                    onChange={handleChange}
                                    className="w-full border rounded p-2 text-sm"
                                >
                                    <option value="">請選擇模型...</option>
                                    {availableModels[config.EMBEDDING_PROVIDER].map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    name="EMBEDDING_MODEL"
                                    value={config.EMBEDDING_MODEL}
                                    onChange={handleChange}
                                    placeholder="例如: text-embedding-004"
                                    className="w-full border rounded p-2 text-sm"
                                />
                            )}
                            <p className="text-xs text-gray-500 mt-1">Pinecone 僅負責儲存，需由此處設定 Embedding 模型。</p>
                        </div>
                    </div>
                </div>

                {/* Chat Model Settings Section */}
                <div className="space-y-4">
                    <h3 className="text-md font-semibold text-gray-700 flex items-center gap-2 border-b pb-2">
                        <MessageSquare className="w-4 h-4" /> 聊天模型設定
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Chat Model Name</label>
                            {/* We try to infer which provider is being used for chat based on keys, or just show all if fetched */}
                            {/* Since chat provider isn't explicitly selected like embedding, we can show a combined list or just rely on the user testing the key they want to use */}
                            {/* For simplicity, let's show a dropdown if ANY models are fetched, or just input */}
                            {Object.values(availableModels).flat().length > 0 ? (
                                <select
                                    name="CHAT_MODEL"
                                    value={config.CHAT_MODEL}
                                    onChange={handleChange}
                                    className="w-full border rounded p-2 text-sm"
                                >
                                    <option value="">請選擇模型...</option>
                                    {Object.entries(availableModels).map(([provider, models]) => (
                                        <optgroup key={provider} label={provider}>
                                            {models.map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    name="CHAT_MODEL"
                                    value={config.CHAT_MODEL}
                                    onChange={handleChange}
                                    placeholder="例如: gemini-1.5-flash"
                                    className="w-full border rounded p-2 text-sm"
                                />
                            )}
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
