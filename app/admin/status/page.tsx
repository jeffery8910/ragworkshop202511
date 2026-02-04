'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Database, Cpu, Smartphone, Key, Copy, Workflow } from 'lucide-react';

interface StatusDetail {
    status: 'ok' | 'error' | 'missing';
    message?: string;
    latency?: number;
}

interface DetailedStatus {
    mongo: StatusDetail;
    vectorStore: {
        provider: string;
    };
    atlasVector: {
        enabled: boolean;
        indexName: string;
        vectorSearch: StatusDetail;
    };
    n8n: {
        webhookUrl: boolean;
        health: StatusDetail;
        webhook: StatusDetail;
    };
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
    const [renderUrl, setRenderUrl] = useState('');
    const [pinging, setPinging] = useState(false);
    const [pingResult, setPingResult] = useState<{ ok: boolean; status: number; statusText?: string; elapsedMs: number; finalUrl?: string } | null>(null);
    const [pingError, setPingError] = useState<string | null>(null);
    const [debugOpen, setDebugOpen] = useState(false);
    const [debugLoading, setDebugLoading] = useState(false);
    const [debugData, setDebugData] = useState<any | null>(null);

    const keepAliveSecret = '${{ secrets.RENDER_URL }}';
    const keepAliveYaml = `name: Render Keep Alive

on:
  schedule:
    - cron: "*/14 * * * *"
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Render
        run: |
          if [ -z "${keepAliveSecret}" ]; then
            echo "RENDER_URL secret not set (skipped)"
            exit 0
          fi
          curl -fsSL "${keepAliveSecret}" > /dev/null
`;

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

    const copyText = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch (e) {
            console.error('Clipboard copy failed', e);
        }
    };

    const testRenderPing = async () => {
        const url = renderUrl.trim();
        if (!url) return;
        setPinging(true);
        setPingError(null);
        setPingResult(null);
        try {
            const res = await fetch('/api/admin/keepalive/ping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Ping failed');
            setPingResult(data);
        } catch (e: any) {
            setPingError(e?.message || 'Ping failed');
        } finally {
            setPinging(false);
        }
    };

    const fetchDebugEnv = async () => {
        setDebugLoading(true);
        try {
            const res = await fetch('/api/admin/debug-env');
            const data = await res.json();
            setDebugData(data);
        } catch (e) {
            setDebugData({ error: '讀取失敗' });
        } finally {
            setDebugLoading(false);
        }
    };

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

                {/* n8n */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-orange-100 rounded-lg"><Workflow className="w-5 h-5 text-orange-600" /></div>
                        <h3 className="font-semibold text-lg">n8n (Render)</h3>
                    </div>
                    <div className="space-y-2 mb-4">
                        <BoolCheck label="N8N_WEBHOOK_URL" value={status.n8n.webhookUrl} />
                    </div>
                    <div className="pt-2 border-t space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600">Health (/healthz)</span>
                            <StatusBadge {...status.n8n.health} />
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600">Webhook (N8N_WEBHOOK_URL)</span>
                            <StatusBadge {...status.n8n.webhook} />
                        </div>
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

                {/* Atlas Vector Search */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-100 rounded-lg"><Database className="w-5 h-5 text-green-600" /></div>
                        <div className="flex flex-col">
                            <h3 className="font-semibold text-lg">MongoDB Atlas Vector Search</h3>
                            <div className="text-xs text-gray-500">目前向量庫：{status.vectorStore?.provider || 'auto'}</div>
                        </div>
                    </div>
                    <div className="space-y-2 mb-4">
                        <BoolCheck label="Enabled" value={!!status.atlasVector?.enabled} />
                        <div className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                            <span className="text-gray-600">Index Name</span>
                            <span className="font-mono text-xs text-gray-700">{status.atlasVector?.indexName || 'vector_index'}</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-gray-600">Vector Search 測試</span>
                        <StatusBadge {...status.atlasVector.vectorSearch} />
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
                    <div className="mt-4 text-sm text-gray-600">
                        Webhook URL（填在 LINE Developers 後台）：
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs bg-gray-50 border rounded px-2 py-1">
                                {typeof window !== 'undefined' ? `${window.location.origin}/api/line/webhook` : '/api/line/webhook'}
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    const base = typeof window !== 'undefined' ? window.location.origin : '';
                                    copyText(`${base}/api/line/webhook`);
                                }}
                                className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border bg-white hover:bg-gray-50"
                            >
                                <Copy className="w-3 h-3" />
                                複製
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* GitHub Actions Keep Alive */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-slate-100 rounded-lg"><Key className="w-5 h-5 text-slate-700" /></div>
                    <h3 className="font-semibold text-lg">GitHub Actions：Render Keep Alive</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                    這支 Action 會定期 ping 你的 Render 網址，避免服務睡著。失敗通常是「secret 沒設定」或「URL 回傳 4xx/5xx」。
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-semibold text-gray-800">必要設定</div>
                            <button
                                type="button"
                                onClick={() => copyText('RENDER_URL')}
                                className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border bg-white hover:bg-gray-50"
                                title="複製 secret 名稱"
                            >
                                <Copy className="w-3 h-3" />
                                複製 secret 名稱
                            </button>
                        </div>
                        <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                            <li>到 GitHub Repo → Settings → Secrets and variables → Actions</li>
                            <li>新增 Repository secret：名稱填 <span className="font-mono">RENDER_URL</span></li>
                            <li>值填你的 Render 公開網址（建議用可直接 GET 的健康檢查路徑）</li>
                        </ol>

                        <div className="mt-4">
                            <div className="text-sm font-semibold text-gray-800 mb-2">快速自測（看 URL 會回什麼狀態碼）</div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    value={renderUrl}
                                    onChange={e => setRenderUrl(e.target.value)}
                                    placeholder="https://xxx.onrender.com (或你的自訂網域)"
                                    className="flex-1 border rounded px-3 py-2 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={testRenderPing}
                                    disabled={pinging || !renderUrl.trim()}
                                    className="px-4 py-2 rounded bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-50"
                                >
                                    {pinging ? '測試中…' : '測試'}
                                </button>
                            </div>

                            {(pingError || pingResult) && (
                                <div className={`mt-3 rounded border px-3 py-2 text-sm ${pingResult?.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                                    {pingError ? (
                                        <div>測試失敗：{pingError}</div>
                                    ) : (
                                        <div className="space-y-1">
                                            <div>HTTP {pingResult?.status} {pingResult?.statusText}（{pingResult?.elapsedMs}ms）</div>
                                            {pingResult?.finalUrl && <div className="text-xs text-gray-600 break-all">最終網址：{pingResult.finalUrl}</div>}
                                            {!pingResult?.ok && (
                                                <div className="text-xs text-amber-900 mt-1">
                                                    提示：401/403 代表需要登入或被擋；404 代表路徑錯；502/503 常見是冷啟動或服務不穩。
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-semibold text-gray-800">目前的 workflow 腳本</div>
                            <button
                                type="button"
                                onClick={() => copyText(keepAliveYaml)}
                                className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border bg-white hover:bg-gray-50"
                            >
                                <Copy className="w-3 h-3" />
                                複製 YAML
                            </button>
                        </div>
                        <pre className="text-[12px] leading-relaxed bg-white border rounded p-3 overflow-auto max-h-80">
                            {keepAliveYaml}
                        </pre>
                        <div className="mt-2 text-xs text-gray-500">
                            只要 <span className="font-mono">RENDER_URL</span> 沒設定，或目標網址回 4xx/5xx，這支 Action 就會失敗。
                        </div>
                    </div>
                </div>
            </div>

            {/* Debug Env */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg"><Key className="w-5 h-5 text-slate-700" /></div>
                        <h3 className="font-semibold text-lg">環境變數來源檢查（Debug）</h3>
                    </div>
                    <button
                        onClick={() => {
                            const next = !debugOpen;
                            setDebugOpen(next);
                            if (next && !debugData) fetchDebugEnv();
                        }}
                        className="text-xs bg-gray-100 px-3 py-1 rounded hover:bg-gray-200"
                    >
                        {debugOpen ? '收合' : '展開'}
                    </button>
                </div>
                {debugOpen && (
                    <div className="mt-4">
                        {debugLoading && <div className="text-xs text-gray-500">載入中…</div>}
                        {debugData && (
                            <div className="space-y-2 text-xs text-gray-700">
                                <div className="text-gray-500">nodeEnv: {debugData.nodeEnv} / {debugData.timestamp}</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {debugData.sources && Object.entries(debugData.sources).map(([key, val]: any) => (
                                        <div key={key} className="border rounded p-2 bg-gray-50">
                                            <div className="font-medium text-gray-800 mb-1">{key}</div>
                                            <div className="text-gray-600">Env: {val?.fromEnv || '—'}</div>
                                            <div className="text-gray-600">Cookie: {val?.fromCookie || '—'}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {!debugLoading && !debugData && (
                            <div className="text-xs text-gray-500">點擊展開會讀取 /api/admin/debug-env</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
