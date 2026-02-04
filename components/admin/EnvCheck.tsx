import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface EnvCheckProps {
    missingKeys: string[];
    initialConfig: Record<string, string>;
}

export default function EnvCheck({ missingKeys, initialConfig }: EnvCheckProps) {
    const explicitVector = (initialConfig['VECTOR_STORE_PROVIDER'] || '').trim().toLowerCase();
    const hasPineKey = !!initialConfig['PINECONE_API_KEY'];
    const usePinecone = explicitVector === 'pinecone' || (!explicitVector && hasPineKey);

    const requiredKeys = [
        'MONGODB_URI',
        'MONGODB_DB_NAME',
        ...(usePinecone ? ['PINECONE_API_KEY', 'PINECONE_INDEX_NAME'] : []),
        'LINE_CHANNEL_SECRET',
        'LINE_CHANNEL_ACCESS_TOKEN',
        'LINE_LOGIN_CHANNEL_ID',
        'LINE_LOGIN_CHANNEL_SECRET',
        'ADMIN_PASSWORD'
    ];

    const optionalKeys = [
        'GEMINI_API_KEY',
        'OPENAI_API_KEY',
        'OPENROUTER_API_KEY',
        'N8N_WEBHOOK_URL',
        'VECTOR_STORE_PROVIDER',
        'ATLAS_VECTOR_INDEX_NAME'
    ];

    const isCriticalMissing = missingKeys.some(k => requiredKeys.includes(k));
    const isOptionalMissing = missingKeys.some(k => optionalKeys.includes(k));

    if (missingKeys.length === 0) {
        return null; // All good
    }

    return (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded shadow-sm">
            <div className="flex items-start">
                <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                </div>
                <div className="ml-3 w-full">
                    <h3 className="text-lg font-medium text-yellow-800">
                        系統設定未完成 (System Configuration Incomplete)
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                        <p className="mb-2">
                            檢測到部分環境變數尚未設定。為了確保系統功能正常，請至 Vercel 後台 (Settings &gt; Environment Variables) 填寫以下變數：
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                            <div className="bg-white p-3 rounded border border-yellow-200">
                                <h4 className="font-bold text-red-600 mb-2 flex items-center gap-1">
                                    <XCircle className="w-4 h-4" /> 必要變數 (Critical)
                                </h4>
                                <ul className="list-disc list-inside space-y-1 text-gray-600">
                                    {requiredKeys.map(key => (
                                        <li key={key} className={missingKeys.includes(key) ? "text-red-500 font-semibold" : "text-green-600 flex items-center gap-1"}>
                                            {missingKeys.includes(key) ? (
                                                <span>{key} (缺失)</span>
                                            ) : (
                                                <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {key}</span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="bg-white p-3 rounded border border-yellow-200">
                                <h4 className="font-bold text-blue-600 mb-2 flex items-center gap-1">
                                    <AlertTriangle className="w-4 h-4" /> 建議變數 (Recommended)
                                </h4>
                                <p className="text-xs text-gray-500 mb-2">至少需要填寫一個 LLM API Key</p>
                                <ul className="list-disc list-inside space-y-1 text-gray-600">
                                    {optionalKeys.map(key => (
                                        <li key={key} className={missingKeys.includes(key) ? "text-gray-400" : "text-green-600 flex items-center gap-1"}>
                                            {missingKeys.includes(key) ? (
                                                <span>{key} (未設定 - 使用預設值或忽略)</span>
                                            ) : (
                                                <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {key}</span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
