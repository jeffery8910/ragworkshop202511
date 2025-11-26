'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Database, Cpu, MessageSquare, Smartphone, Key } from 'lucide-react';

interface StatusDetail {
    status: 'ok' | 'error' | 'missing';
    message?: string;
    latency?: number;
}

interface DetailedStatus {
    mongo: StatusDetail;
    pinecone: {
        apiKey: boolean;
        indexName: boolean;
        connection: StatusDetail;
    };
    llm: {
        gemini: StatusDetail;
        openai: StatusDetail;
        openrouter: StatusDetail;
    };
    line: {
        messaging: {
            secret: boolean;
            token: boolean;
        };
        login: {
            id: boolean;
            secret: boolean;
        };
    };
}

function StatusBadge({ status, latency, message }: { status: string, latency?: number, message?: string }) {
    if (status === 'ok') {
        return (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>正常 {latency ? `(${latency}ms)` : ''}</span>
            </div>
        );
    }
    if (status === 'missing') {
        return (
            <div className="flex items-center gap-2 text-gray-500 bg-gray-100 px-3 py-1 rounded-full text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>未設定</span>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1 rounded-full text-sm" title={message}>
            <XCircle className="w-4 h-4" />
            <span>錯誤: {message || 'Unknown'}</span>
        </div>
    );
}

function BoolCheck({ label, value }: { label: string, value: boolean }) {
    return (
        <div className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-0">
            <span className="text-gray-600">{label}</span>
            {value ? (
                <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> 設定 OK</span>
            ) : (
                <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> 未設定</span>
            )}
        </div>
    );
}

export default function StatusPage() {
    const [status, setStatus] = useState<DetailedStatus | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchStatus = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/status');
            const data = await res.json();
            setStatus(data);
        } catch (error) {
            console.error('Failed to fetch status', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    if (loading || !status) {
        return (
            <div className="p-8 flex justify-center">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">系統連線狀態 (System Status)</h1>
                <button onClick={fetchStatus} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <RefreshCw className="w-5 h-5 text-gray-600" />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* MongoDB */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-100 rounded-lg"><Database className="w-5 h-5 text-green-600" /></div>
                        <h3 className="font-semibold text-lg">MongoDB Database</h3>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-600">連線狀態</span>
                        <StatusBadge {...status.mongo} />
                    </div>
                </div>

                {/* Pinecone */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-purple-100 rounded-lg"><Database className="w-5 h-5 text-purple-600" /></div>
                        <h3 className="font-semibold text-lg">Pinecone Vector DB</h3>
                    </div>
                    <div className="space-y-2 mb-4">
                        <BoolCheck label="API Key" value={status.pinecone.apiKey} />
                        <BoolCheck label="Index Name" value={status.pinecone.indexName} />
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-gray-600">連線測試</span>
                        <StatusBadge {...status.pinecone.connection} />
                    </div>
                </div>

                {/* LLMs */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 md:col-span-2">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-100 rounded-lg"><Cpu className="w-5 h-5 text-blue-600" /></div>
                        <h3 className="font-semibold text-lg">LLM Providers</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-gray-50 rounded border">
                            <div className="font-medium mb-2">Google Gemini</div>
                            <StatusBadge {...status.llm.gemini} />
                        </div>
                        <div className="p-4 bg-gray-50 rounded border">
                            <div className="font-medium mb-2">OpenAI</div>
                            <StatusBadge {...status.llm.openai} />
                        </div>
                        <div className="p-4 bg-gray-50 rounded border">
                            <div className="font-medium mb-2">OpenRouter</div>
                            <StatusBadge {...status.llm.openrouter} />
                        </div>
                    </div>
                </div>

                {/* LINE */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 md:col-span-2">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-100 rounded-lg"><Smartphone className="w-5 h-5 text-green-600" /></div>
                        <h3 className="font-semibold text-lg">LINE Integration</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="font-medium text-gray-700 mb-2 border-b pb-1">Messaging API (Bot)</h4>
                            <div className="space-y-2">
                                <BoolCheck label="Channel Secret" value={status.line.messaging.secret} />
                                <BoolCheck label="Access Token" value={status.line.messaging.token} />
                            </div>
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-700 mb-2 border-b pb-1">LINE Login (LIFF/Auth)</h4>
                            <div className="space-y-2">
                                <BoolCheck label="Channel ID" value={status.line.login.id} />
                                <BoolCheck label="Channel Secret" value={status.line.login.secret} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
