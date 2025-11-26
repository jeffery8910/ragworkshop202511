'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';

export default function StatusPage() {
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const checkStatus = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/status');
            const data = await res.json();
            setStatus(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkStatus();
    }, []);

    const StatusItem = ({ label, data }: { label: string, data: any }) => (
        <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border">
            <div>
                <span className="font-medium text-gray-700 block">{label}</span>
                {data?.message && (
                    <span className={`text-xs ${data.status === 'ok' ? 'text-gray-500' : 'text-red-500'}`}>
                        {data.message}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-3">
                {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                ) : data?.status === 'ok' ? (
                    <div className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                            <span className="text-green-600 text-sm font-bold">連線正常</span>
                            <CheckCircle className="w-5 h-5 text-green-500" />
                        </div>
                        {data.latency > 0 && (
                            <span className="text-xs text-gray-400">{data.latency}ms</span>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <span className="text-red-600 text-sm font-bold">連線失敗</span>
                        <XCircle className="w-5 h-5 text-red-500" />
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">系統連線狀態</h1>
                <button
                    onClick={checkStatus}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    重新檢測
                </button>
            </div>

            <div className="space-y-4">
                <StatusItem label="MongoDB Atlas (資料庫)" data={status?.mongo} />
                <StatusItem label="Pinecone (向量資料庫)" data={status?.pinecone} />
                <StatusItem label="LLM API (OpenRouter/Gemini)" data={status?.llm} />
                <StatusItem label="LINE Messaging API" data={status?.line} />
            </div>
        </div>
    );
}
