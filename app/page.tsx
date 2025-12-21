import Link from 'next/link';
import { Bot, GraduationCap, Settings, ArrowRight } from 'lucide-react';
import { cookies } from 'next/headers';
import { getConfigValue } from '@/lib/config-store';

export default async function Home() {
  const cookieStore = await cookies();
  const chatTitle = cookieStore.get('CHAT_TITLE')?.value || getConfigValue('CHAT_TITLE') || process.env.CHAT_TITLE || 'RAG 工作坊';
  const welcomeMessage = cookieStore.get('WELCOME_MESSAGE')?.value
    || getConfigValue('WELCOME_MESSAGE')
    || process.env.WELCOME_MESSAGE
    || '結合 Next.js 與 n8n 的進階混合式 RAG 架構。\n支援多模型切換、結構化輸出與適性化學習系統。';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center p-4">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
          {chatTitle}
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto whitespace-pre-line">
          {welcomeMessage}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
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
        技術支援：Next.js 14, n8n, 與 Vercel AI SDK
      </footer>
    </div>
  );
}
