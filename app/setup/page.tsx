import Link from 'next/link';
import { headers } from 'next/headers';
import { ArrowRight } from 'lucide-react';
import SetupClient from './SetupClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getOrigin(h: Headers) {
  const proto = h.get('x-forwarded-proto') || 'https';
  const host = h.get('x-forwarded-host') || h.get('host') || '';
  if (!host) return '';
  return `${proto}://${host}`;
}

function isLikelyPreviewHost(host: string) {
  // Vercel preview URLs often contain "-git-" (e.g., *-git-main-*)
  if (!host) return false;
  if (host.includes('-git-')) return true;
  return false;
}

function Code({ children }: { children: string }) {
  return (
    <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[12px] text-gray-800">
      {children}
    </code>
  );
}

export default async function SetupPage() {
  const h = await headers();
  const origin = getOrigin(h);
  const host = h.get('x-forwarded-host') || h.get('host') || '';

  const webhookNew = origin ? `${origin}/api/line/webhook` : 'https://<your-domain>/api/line/webhook';
  const webhookCompat = origin ? `${origin}/api/line-webhook` : 'https://<your-domain>/api/line-webhook';
  const healthUrl = origin ? `${origin}/api/healthz` : '/api/healthz';
  const readyUrl = origin ? `${origin}/api/readyz` : '/api/readyz';
  const readyDeepUrl = origin ? `${origin}/api/readyz?deep=1` : '/api/readyz?deep=1';

  const previewWarning = isLikelyPreviewHost(host);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">LINE RAG 一鍵檢核 / Setup</h1>
            <p className="mt-2 text-gray-600">
              目標：Webhook「永遠可打到」且在 <Code>1–2s</Code> 內回 <Code>200</Code>（LLM/RAG 慢也不能卡住 webhook）。
            </p>
            <p className="mt-2 text-sm text-gray-600">
              推薦架構：LINE →（Vercel）驗簽 + 快速回 200 →（Render）n8n 長流程 → 回覆 LINE
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/guide"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              部署指引
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/admin/status"
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-black"
            >
              系統狀態
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {previewWarning && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-900">
            你目前看起來是在 <Code>Preview</Code> 網域（例如 <Code>*-git-main-*</Code>）。如果你在 Vercel 開了 Protection/Auth，
            LINE 會直接被擋（401），Webhook 永遠打不進來。請改用 production 網域（像 <Code>xxx.vercel.app</Code> 或自訂網域）。
          </div>
        )}

        <SetupClient
          webhookNew={webhookNew}
          webhookCompat={webhookCompat}
          healthUrl={healthUrl}
          readyUrl={readyUrl}
          readyDeepUrl={readyDeepUrl}
        />
      </div>
    </div>
  );
}

