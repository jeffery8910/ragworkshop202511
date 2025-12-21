'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import { adminFetch } from '@/lib/client/adminFetch';
import { useToast } from '@/components/ui/ToastProvider';

interface ConfigPanelProps {
    initialConfig: Record<string, string>;
}

export default function ConfigPanel({ initialConfig }: ConfigPanelProps) {
    const [config, setConfig] = useState({
        temperature: parseFloat(initialConfig['TEMPERATURE'] || '0.7'),
        promptTemplate: initialConfig['PROMPT_TEMPLATE'] || '',
        topK: parseInt(initialConfig['RAG_TOP_K'] || '5'),
        n8nWebhook: initialConfig['N8N_WEBHOOK_URL'] || '',
        chatTitle: initialConfig['CHAT_TITLE'] || '',
        welcomeMessage: initialConfig['WELCOME_MESSAGE'] || ''
    });
    const { pushToast } = useToast();

    const handleSave = async () => {
        try {
            const res = await adminFetch('/api/admin/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    RAG_TOP_K: config.topK,
                    TEMPERATURE: config.temperature,
                    PROMPT_TEMPLATE: config.promptTemplate,
                    N8N_WEBHOOK_URL: config.n8nWebhook,
                    CHAT_TITLE: config.chatTitle,
                    WELCOME_MESSAGE: config.welcomeMessage
                })
            });
            if (!res.ok) throw new Error('Failed to save');
            pushToast({ type: 'success', message: '設定已儲存' });
        } catch (e) {
            pushToast({ type: 'error', message: '儲存失敗' });
        }
    };

    const handleClearCopy = async () => {
        if (!confirm('確定要清空前台文案嗎？這會移除目前的標題與歡迎訊息。')) return;
        try {
            const payload = {
                RAG_TOP_K: config.topK,
                TEMPERATURE: config.temperature,
                PROMPT_TEMPLATE: config.promptTemplate,
                N8N_WEBHOOK_URL: config.n8nWebhook,
                CHAT_TITLE: '',
                WELCOME_MESSAGE: ''
            };
            const res = await adminFetch('/api/admin/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Failed to clear');
            setConfig(prev => ({ ...prev, chatTitle: '', welcomeMessage: '' }));
            pushToast({ type: 'success', message: '前台文案已清空' });
        } catch (e) {
            pushToast({ type: 'error', message: '清空失敗' });
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border">
            <h2 className="text-xl font-bold mb-4">進階設定 (Advanced Config)</h2>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Top K (檢索數量)</label>
                    <input
                        type="number"
                        min="1" max="20"
                        value={config.topK}
                        onChange={e => setConfig({ ...config, topK: parseInt(e.target.value) })}
                        className="w-full border rounded p-2"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Temperature (創意度)</label>
                    <input
                        type="range"
                        min="0" max="1" step="0.1"
                        value={config.temperature}
                        onChange={e => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                        className="w-full"
                    />
                    <div className="text-right text-xs text-gray-500">{config.temperature}</div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
                    <textarea
                        value={config.promptTemplate}
                        onChange={e => setConfig({ ...config, promptTemplate: e.target.value })}
                        className="w-full border rounded p-2 h-24 text-sm"
                        placeholder="預設系統提示詞..."
                    />
                </div>

                <div className="pt-4 border-t space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-800">前台文案</h3>
                        <button
                            type="button"
                            onClick={handleClearCopy}
                            className="text-xs text-red-600 hover:text-red-700 hover:underline"
                        >
                            清空文案
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">CHAT_TITLE</label>
                            <input
                                type="text"
                                value={config.chatTitle}
                                onChange={e => setConfig({ ...config, chatTitle: e.target.value })}
                                placeholder="RAG 工作坊"
                                className="w-full border rounded p-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">WELCOME_MESSAGE</label>
                            <textarea
                                value={config.welcomeMessage}
                                onChange={e => setConfig({ ...config, welcomeMessage: e.target.value })}
                                placeholder="你好！我是你的 AI 學習助手..."
                                className="w-full border rounded p-2 text-sm h-24"
                            />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500">
                        清空後會改回預設文案（或環境變數設定）。
                    </p>
                </div>

                <div className="pt-4 border-t">
                    <h3 className="text-sm font-bold text-gray-800 mb-3">N8N 自動化整合</h3>
                    <label className="block text-sm font-medium text-gray-700 mb-1">N8N Webhook URL</label>
                    <input
                        type="text"
                        value={config.n8nWebhook}
                        onChange={e => setConfig({ ...config, n8nWebhook: e.target.value })}
                        placeholder="https://your-n8n-instance.com/webhook/..."
                        className="w-full border rounded p-2 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        設置此 URL 以啟用 N8N 工作流整合 (例如：自動觸發資料處理或通知)
                    </p>
                </div>

                <button
                    onClick={handleSave}
                    className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-800 py-2 rounded hover:bg-gray-200"
                >
                    <Save className="w-4 h-4" /> 儲存設定
                </button>
            </div>
        </div>
    );
}
