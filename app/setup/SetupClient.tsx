'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Copy, RefreshCw, XCircle, AlertTriangle } from 'lucide-react';

type ProbeResult = { ok: boolean; status?: number; error?: string; bodySnippet?: string; contentType?: string };

type ReadyzResponse = {
  status: 'ok' | 'degraded';
  ts: number;
  config: {
    lineSecret: boolean;
    lineToken: boolean;
    n8nWebhookUrl: boolean;
  };
  deep?: {
    n8nHealth?: ProbeResult;
    n8nWebhook?: ProbeResult;
    n8nUi?: ProbeResult;
    n8nPing?: ProbeResult;
    n8nBaseUrl?: string;
  };
  problems: string[];
};

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${ok
        ? 'border-green-200 bg-green-50 text-green-700'
        : 'border-red-200 bg-red-50 text-red-700'
        }`}
    >
      {ok ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

function Code({ children }: { children: string }) {
  return (
    <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[12px] text-gray-800">
      {children}
    </code>
  );
}

export default function SetupClient({
  webhookNew,
  webhookCompat,
  healthUrl,
  readyUrl,
  readyDeepUrl,
}: {
  webhookNew: string;
  webhookCompat: string;
  healthUrl: string;
  readyUrl: string;
  readyDeepUrl: string;
}) {
  const [data, setData] = useState<ReadyzResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [deep, setDeep] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCopy = typeof navigator !== 'undefined' && !!navigator.clipboard;

  const copy = async (text: string) => {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const fetchReady = async (deepCheck: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const url = deepCheck ? readyDeepUrl : readyUrl;
      const res = await fetch(url, { cache: 'no-store' });
      const json = (await res.json()) as ReadyzResponse;
      setData(json);
      setDeep(deepCheck);
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
      }
    } catch (e: any) {
      setError(e?.message || 'Fetch failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReady(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suggestions = useMemo(() => {
    if (!data) return [];
    const s: string[] = [];
    if (!data.config.lineSecret) s.push('Vercel：設定 LINE_CHANNEL_SECRET（否則 /api/line/webhook 會回 500）。');
    if (!data.config.lineToken) s.push('Vercel：設定 LINE_CHANNEL_ACCESS_TOKEN（fallback reply 需要）。');
    if (!data.config.n8nWebhookUrl) s.push('Vercel：設定 N8N_WEBHOOK_URL（指向 Render n8n 的 Production webhook URL）。');

    const webhookStatus = data.deep?.n8nWebhook?.status;
    const webhookBody = data.deep?.n8nWebhook?.bodySnippet || '';
    if (webhookStatus === 404 && /not registered/i.test(webhookBody)) {
      s.push('Render/n8n：workflow 尚未 Active（webhook not registered）。請在 n8n UI 匯入 `n8n/workflow.json` 後切到 Active。');
    } else if (webhookStatus && webhookStatus >= 400) {
      s.push(`Render/n8n：webhook 回應異常（HTTP ${webhookStatus}），請檢查 workflow path/環境變數與 Render logs。`);
    }

    if (data.deep?.n8nUi && !data.deep.n8nUi.ok) {
      s.push('Render/n8n：UI 可能未啟動或冷啟動中（/ 回非 200）。先打 /healthz 喚醒，再稍等 30–60 秒重試。');
    }

    return s;
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => fetchReady(false)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          重新檢查（快速）
        </button>
        <button
          onClick={() => fetchReady(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white hover:bg-black disabled:opacity-50"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          深度檢查（含 n8n）
        </button>
        <a href={healthUrl} className="text-sm text-blue-600 hover:underline">
          /api/healthz
        </a>
        <a href={deep ? readyDeepUrl : readyUrl} className="text-sm text-blue-600 hover:underline">
          /api/readyz{deep ? '?deep=1' : ''}
        </a>
        <a href="/setup-guide.html" className="text-sm text-blue-600 hover:underline">
          一頁式指南（HTML）
        </a>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          檢查失敗：{error}
        </div>
      )}

      {data && (
        <>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Chip ok={data.config.lineSecret} label="LINE_CHANNEL_SECRET" />
              <Chip ok={data.config.lineToken} label="LINE_CHANNEL_ACCESS_TOKEN" />
              <Chip ok={data.config.n8nWebhookUrl} label="N8N_WEBHOOK_URL" />
              {deep && data.deep?.n8nHealth && <Chip ok={data.deep.n8nHealth.ok} label="n8n /healthz" />}
              {deep && data.deep?.n8nWebhook && <Chip ok={data.deep.n8nWebhook.ok} label="n8n webhook" />}
            </div>

            {deep && data.deep?.n8nBaseUrl && (
              <div className="mt-3 text-xs text-gray-600">
                n8n base：<Code>{data.deep.n8nBaseUrl}</Code>
              </div>
            )}

            {deep && data.deep?.n8nWebhook && !data.deep.n8nWebhook.ok && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                <div className="font-semibold">n8n webhook 失敗細節</div>
                <div className="mt-1">
                  狀態：<Code>{String(data.deep.n8nWebhook.status ?? 'unknown')}</Code>
                  {data.deep.n8nWebhook.contentType ? (
                    <>
                      {' '}
                      <span className="text-amber-800/70">（{data.deep.n8nWebhook.contentType}）</span>
                    </>
                  ) : null}
                </div>
                {data.deep.n8nWebhook.bodySnippet ? (
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white/70 p-2 text-[11px] text-amber-950">
                    {data.deep.n8nWebhook.bodySnippet}
                  </pre>
                ) : null}
              </div>
            )}

            {data.problems?.length > 0 && (
              <div className="mt-3 text-xs text-gray-600">
                <div className="font-semibold text-gray-800">Problems</div>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {data.problems.map((p) => (
                    <li key={p}>
                      <Code>{p}</Code>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {suggestions.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                下一步建議（依你的狀態自動產生）
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {suggestions.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="text-sm font-semibold text-gray-900">LINE Developers Webhook URL（填這個）</div>
        <div className="mt-2 grid gap-2">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs font-semibold text-gray-600">新版（建議）</div>
            <div className="mt-1 break-all font-mono text-xs text-gray-900">{webhookNew}</div>
            <button
              type="button"
              onClick={() => copy(webhookNew)}
              className="mt-2 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              disabled={!canCopy}
            >
              <Copy className="h-3 w-3" />
              複製
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs font-semibold text-gray-600">相容（舊路徑）</div>
            <div className="mt-1 break-all font-mono text-xs text-gray-900">{webhookCompat}</div>
            <button
              type="button"
              onClick={() => copy(webhookCompat)}
              className="mt-2 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              disabled={!canCopy}
            >
              <Copy className="h-3 w-3" />
              複製
            </button>
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-600">
          提醒：如果你用的是 Preview 網域（像 <Code>*-git-main-*</Code>），又開了 Vercel Protection/Auth，LINE 會被擋（401）。請改用 production 網域。
        </div>
      </div>
    </div>
  );
}
