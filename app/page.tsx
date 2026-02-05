import Link from 'next/link';
import { Bot, GraduationCap, Settings, ArrowRight, FlaskConical, BookOpen, ListChecks } from 'lucide-react';
import { cookies } from 'next/headers';
import { getConfigValue } from '@/lib/config-store';
import { resolveVectorStoreProvider } from '@/lib/vector/store';

export default async function Home() {
  const cookieStore = await cookies();
  const readConfig = (key: string) => cookieStore.get(key)?.value || getConfigValue(key) || process.env[key] || '';

  const chatTitle = readConfig('CHAT_TITLE') || 'RAG 工作坊';
  const welcomeMessage = readConfig('WELCOME_MESSAGE')
    || getConfigValue('WELCOME_MESSAGE')
    || process.env.WELCOME_MESSAGE
    || '結合 Next.js 與 n8n 的進階混合式 RAG 架構。\n支援多模型切換、結構化輸出與適性化學習系統。';

  const chatModel = readConfig('CHAT_MODEL');
  const embeddingModel = readConfig('EMBEDDING_MODEL');
  const pineconeKey = readConfig('PINECONE_API_KEY');
  const pineconeIndex = readConfig('PINECONE_INDEX_NAME');
  const mongoUri = readConfig('MONGODB_URI');
  const dbName = readConfig('MONGODB_DB_NAME');
  const vectorStore = resolveVectorStoreProvider({
    explicit: readConfig('VECTOR_STORE_PROVIDER') || readConfig('VECTOR_BACKEND'),
    pineconeApiKey: pineconeKey,
    mongoUri,
  });
  const lineLoginId = readConfig('LINE_LOGIN_CHANNEL_ID');
  const lineLoginSecret = readConfig('LINE_LOGIN_CHANNEL_SECRET');
  const anyLlmKey = readConfig('GEMINI_API_KEY') || readConfig('OPENAI_API_KEY') || readConfig('OPENROUTER_API_KEY');
  const adminPassword = readConfig('ADMIN_PASSWORD') || readConfig('ADMIN_TOKEN');
  const adminPasswordWeak = !adminPassword || adminPassword === 'admin' || adminPassword.length < 12;

  const setupIssues = [
    !anyLlmKey ? '聊天 API Key 未設定（Gemini/OpenAI/OpenRouter 任一）' : '',
    !chatModel ? '聊天模型未設定（CHAT_MODEL）' : '',
    !embeddingModel ? 'Embedding 模型未設定（EMBEDDING_MODEL；不填會使用預設）' : '',
    !vectorStore ? '向量庫未設定（需要 PINECONE_API_KEY 或 MONGODB_URI）' : '',
    vectorStore === 'pinecone' && !pineconeKey ? 'Pinecone API Key 未設定（PINECONE_API_KEY）' : '',
    vectorStore === 'pinecone' && !pineconeIndex ? 'Pinecone Index 未設定（PINECONE_INDEX_NAME）' : '',
    !mongoUri ? 'MongoDB URI 未設定（MONGODB_URI）' : '',
    !dbName ? 'MongoDB DB Name 未設定（MONGODB_DB_NAME）' : '',
  ].filter(Boolean);

  const hasSetupIssues = setupIssues.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center p-4">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
          {chatTitle}
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto whitespace-pre-line">
          {welcomeMessage}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {lineLoginId && lineLoginSecret ? (
            <Link
              href="/api/auth/line/login"
              className="inline-flex items-center gap-2 rounded-full bg-green-600 text-white px-4 py-2 text-sm hover:bg-green-700"
            >
              使用 LINE 登入
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <div className="text-xs text-gray-400">
              LINE 登入未設定（需要 LINE_LOGIN_CHANNEL_ID / SECRET）
            </div>
          )}
          <Link
            href="/setup"
            className="inline-flex items-center gap-2 rounded-full bg-gray-900 text-white px-4 py-2 text-sm hover:bg-black"
          >
            一鍵檢核 / Setup
            <ListChecks className="w-4 h-4" />
          </Link>
          <Link
            href="/guide"
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            部署/LINE 指引
            <BookOpen className="w-4 h-4" />
          </Link>
        </div>
        {adminPasswordWeak && (
          <div className="mt-6 max-w-3xl mx-auto rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-left">
            <div className="font-semibold text-red-900 mb-1">安全提醒：請設定管理員密碼（ADMIN_PASSWORD）</div>
            <div className="text-sm text-red-900/90 mb-3">
              管理後台登入使用環境變數 <span className="font-mono">ADMIN_PASSWORD</span>。若未設定，預設密碼是 <span className="font-mono">admin</span>，建議立刻改成長且難猜的密碼。
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/login"
                className="inline-flex items-center gap-2 rounded-lg bg-red-700 text-white px-4 py-2 text-sm hover:bg-red-800"
              >
                前往管理登入
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/guide"
                className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm text-red-900 hover:bg-red-100"
              >
                看設定說明
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
        {hasSetupIssues && (
          <div className="mt-6 max-w-3xl mx-auto rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4 text-left">
            <div className="font-semibold text-amber-900 mb-1">系統尚未準備完成</div>
            <div className="text-sm text-amber-900/90 mb-3">
              還缺 {setupIssues.length} 項設定。先到管理後台完成「系統快速設定」，學生端的教學坊/聊天才會穩定。
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {setupIssues.slice(0, 4).map((t) => (
                <span key={t} className="text-xs px-2 py-1 rounded-full bg-white border border-amber-200 text-amber-900">
                  {t}
                </span>
              ))}
              {setupIssues.length > 4 && (
                <span className="text-xs px-2 py-1 rounded-full bg-white border border-amber-200 text-amber-900">
                  以及其他 {setupIssues.length - 4} 項…
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin?tab=setup"
                className="inline-flex items-center gap-2 rounded-lg bg-amber-700 text-white px-4 py-2 text-sm hover:bg-amber-800"
              >
                去完成設定
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/admin/status"
                className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm text-amber-900 hover:bg-amber-100"
              >
                看系統狀態
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl w-full">
        <Link href="/chat" className="group">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors">
              <Bot className="w-6 h-6 text-blue-600 group-hover:text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">AI 聊天室</h2>
            <p className="text-gray-500 mb-4">
              網頁版 RAG 測試介面，支援 Markdown 渲染與即時檢索除錯。
            </p>
            <div className="flex items-center text-blue-600 font-medium">
              開始對話 <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>

        <Link href="/workshop" className="group">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-purple-600 transition-colors">
              <FlaskConical className="w-6 h-6 text-purple-600 group-hover:text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">RAG 教學坊</h2>
            <p className="text-gray-500 mb-4">
              做 A/B 比較：TopK、重寫、圖譜、Agentic，並下載 CSV/JSON 評估報告。
            </p>
            <div className="flex items-center text-purple-600 font-medium">
              開始比較 <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>

        <Link href="/student" className="group">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-green-600 transition-colors">
              <GraduationCap className="w-6 h-6 text-green-600 group-hover:text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">學生儀表板</h2>
            <p className="text-gray-500 mb-4">
              查看學習進度、XP 經驗值、錯題分析與重點卡片。
            </p>
            <div className="flex items-center text-green-600 font-medium">
              進入學習 <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>

        <Link href="/admin" className="group">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-gray-800 transition-colors">
              <Settings className="w-6 h-6 text-gray-600 group-hover:text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">管理後台</h2>
            <p className="text-gray-500 mb-4">
              知識庫檔案上傳、系統參數設定與服務連線狀態監控。
            </p>
            <div className="flex items-center text-gray-600 font-medium">
              系統設定 <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>
      </div>

      <footer className="mt-16 text-gray-400 text-sm">
        技術支援：Next.js 16, n8n, 與 Vercel AI SDK
      </footer>
    </div>
  );
}
