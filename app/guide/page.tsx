import Link from 'next/link';
import { headers } from 'next/headers';
import { ArrowRight } from 'lucide-react';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getOrigin(h: Headers) {
  const proto = h.get('x-forwarded-proto') || 'https';
  const host = h.get('x-forwarded-host') || h.get('host') || '';
  if (!host) return '';
  return `${proto}://${host}`;
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-xl bg-gray-900 p-4 text-sm text-gray-100">
      <code>{children}</code>
    </pre>
  );
}

export default async function GuidePage() {
  const h = await headers();
  const origin = getOrigin(h);

  const webhookNew = origin ? `${origin}/api/line/webhook` : 'https://<your-domain>/api/line/webhook';
  const webhookCompat = origin ? `${origin}/api/line-webhook` : 'https://<your-domain>/api/line-webhook';

  const n8nBaseUrl = 'https://n8n-rag-workflow.onrender.com';
  const n8nHealthUrl = `${n8nBaseUrl}/healthz`;
  const n8nSetupUrl = `${n8nBaseUrl}/setup`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">部署與串接指引</h1>
            <p className="mt-2 text-gray-600">
              推薦架構：LINE →（Vercel）Webhook 驗簽/快速回 200 →（Render）n8n 工作流 → LLM（OpenRouter/NVIDIA 等）→ 回覆 LINE
            </p>
          </div>
          <Link
            href="/admin/status"
            className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            系統狀態
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 space-y-8">
          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-bold text-gray-900">1) 先把 n8n 開起來（Render）</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700">
              <li>
                打開 n8n：<span className="font-mono">{n8nBaseUrl}/</span>
              </li>
              <li>
                第一次通常會導到 setup：<span className="font-mono">{n8nSetupUrl}</span>
              </li>
              <li>
                健康檢查：<span className="font-mono">{n8nHealthUrl}</span> 應回 <span className="font-mono">{'{"status":"ok"}'}</span>
              </li>
              <li>
                若你看到 <span className="font-mono">Cannot GET /</span> 或前端一時開不起來：通常是 Render 免費方案冷啟動/休眠，先等 30–60 秒或先打 <span className="font-mono">/healthz</span> 喚醒即可。
              </li>
              <li>
                匯入本專案的預設 workflow：<span className="font-mono">n8n/workflow.json</span>（Webhook path 已是 <span className="font-mono">line-rag</span>）
              </li>
              <li>
                記得在 Render（n8n 服務）設定環境變數：<span className="font-mono">LINE_CHANNEL_ACCESS_TOKEN</span>、<span className="font-mono">RAG_RETRIEVE_URL</span>、<span className="font-mono">OPENROUTER_API_KEY</span>、<span className="font-mono">OPENROUTER_MODEL</span>
              </li>
              <li>
                把 workflow 切到 Active，Production URL 會是：<span className="font-mono">{n8nBaseUrl}/webhook/line-rag</span>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-bold text-gray-900">2) LINE Developers 設定 Webhook URL</h2>
            <p className="mt-2 text-sm text-gray-700">
              你現在有兩個路徑可用（新舊相容）。請把「Webhook URL」填其中一個（建議用新版）：
            </p>
            <div className="mt-3 grid gap-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-600">新版（建議）</div>
                <div className="mt-1 break-all font-mono text-sm text-gray-900">{webhookNew}</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-600">相容（舊路徑）</div>
                <div className="mt-1 break-all font-mono text-sm text-gray-900">{webhookCompat}</div>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-700">
              注意：如果你看到 401/unauthorized，通常表示「路徑存在但簽章不對」；用 LINE 的「Verify」測試會帶正確簽章，驗簽才會過。
            </p>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-bold text-gray-900">3) Vercel 環境變數（最少要這些）</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700">
              <li>
                <span className="font-mono">LINE_CHANNEL_SECRET</span>（LINE Messaging API 的 Channel secret）
              </li>
              <li>
                <span className="font-mono">LINE_CHANNEL_ACCESS_TOKEN</span>（LINE Messaging API 的 Channel access token）
              </li>
              <li>
                <span className="font-mono">N8N_WEBHOOK_URL</span>（n8n workflow 的 Production webhook URL，例如 <span className="font-mono">{n8nBaseUrl}/webhook/line-rag</span>）
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-bold text-gray-900">4) 向量資料庫（Pinecone / MongoDB Atlas Vector Search）</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700">
              <li>
                預設規則：如果你有設 <span className="font-mono">PINECONE_API_KEY</span> 就走 Pinecone；否則改用 Atlas Vector Search。
              </li>
              <li>
                若你同時有 Pinecone key 但仍想強制用 Atlas：設定 <span className="font-mono">VECTOR_STORE_PROVIDER=atlas</span>
              </li>
              <li>
                Atlas 模式需要你先在 Atlas 建好 <span className="font-mono">chunks.embedding</span> 的 vector index（預設索引名 <span className="font-mono">vector_index</span>；可用 <span className="font-mono">ATLAS_VECTOR_INDEX_NAME</span> 調整）
              </li>
              <li>
                若你想把建索引自動化：可在本機執行 <span className="font-mono">npm run atlas:ensure-index</span>（需要先設好 <span className="font-mono">MONGODB_URI</span> 與 embedding 的 API key）
              </li>
              <li>
                設定與索引建立細節請看：<span className="font-mono">docs/MONGODB-ATLAS-VECTOR-SEARCH.md</span>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-bold text-gray-900">5) 快速自我檢查（不靠 UI）</h2>
            <p className="mt-2 text-sm text-gray-700">n8n 健康：</p>
            <CodeBlock>{`curl -sS -i ${n8nHealthUrl}`}</CodeBlock>
            <p className="mt-4 text-sm text-gray-700">如果你 n8n Webhook 看到 404 類似「webhook is not registered」，通常是 workflow 還沒 Active 或 path 填錯。</p>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-bold text-gray-900">下一步</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href="/admin?tab=setup"
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-black"
              >
                去完成管理端設定
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/admin/status"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                看系統狀態
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
