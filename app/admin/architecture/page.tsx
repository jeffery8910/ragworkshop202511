'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    Database,
    Cloud,
    Cpu,
    MessageSquare,
    FileJson,
    ArrowRight,
    ArrowDown,
    Check,
    X,
    AlertTriangle,
    RefreshCw,
    Search,
    HardDrive,
    Zap,
    BookOpen
} from 'lucide-react';

interface ServiceStatus {
    available: boolean;
    configured: boolean;
}

export default function ArchitecturePage() {
    const [activeTab, setActiveTab] = useState<'flow' | 'providers' | 'fallback'>('flow');

    const StatusBadge = ({ configured, label }: { configured: boolean; label: string }) => (
        <span className={`px-2 py-0.5 text-xs rounded-full ${configured ? 'bg-green-500/20 text-green-300 border border-green-500/50' :
                'bg-gray-500/20 text-gray-400 border border-gray-500/50'
            }`}>
            {label}
        </span>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
            {/* Header */}
            <div className="bg-black/30 border-b border-white/10 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
                    <Link href="/admin" className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">🏗️ RAG 系統架構說明</h1>
                        <p className="text-sm text-gray-400">完整了解系統運作流程與備案機制</p>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Tab Navigation */}
                <div className="flex gap-2 mb-8 bg-white/5 p-1 rounded-xl w-fit">
                    {[
                        { id: 'flow', label: '📊 完整流程圖', icon: Zap },
                        { id: 'providers', label: '🔌 服務提供者', icon: Cloud },
                        { id: 'fallback', label: '🔄 備案機制', icon: RefreshCw },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition font-medium ${activeTab === tab.id
                                    ? 'bg-purple-600 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Flow Tab - Complete RAG Flow Diagram */}
                {activeTab === 'flow' && (
                    <div className="space-y-8">
                        {/* Main Flow Diagram */}
                        <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <Zap className="w-6 h-6 text-yellow-400" />
                                RAG 系統完整運作流程
                            </h2>

                            {/* Step 1: User Input */}
                            <div className="flex flex-col items-center">
                                <div className="bg-blue-600 px-8 py-4 rounded-2xl shadow-lg shadow-blue-500/30 flex items-center gap-3">
                                    <MessageSquare className="w-8 h-8" />
                                    <div>
                                        <div className="font-bold text-lg">1️⃣ 使用者輸入問題</div>
                                        <div className="text-blue-200 text-sm">例如：「什麼是機器學習？」</div>
                                    </div>
                                </div>

                                <ArrowDown className="w-8 h-8 text-gray-500 my-4" />

                                {/* Step 2: Query Understanding */}
                                <div className="bg-indigo-600 px-8 py-4 rounded-2xl shadow-lg shadow-indigo-500/30">
                                    <div className="font-bold text-lg flex items-center gap-2">
                                        <Cpu className="w-6 h-6" />
                                        2️⃣ 問題分析與向量化
                                    </div>
                                    <div className="text-indigo-200 text-sm mt-1">使用 Embedding 模型將問題轉為向量</div>
                                </div>

                                <ArrowDown className="w-8 h-8 text-gray-500 my-4" />

                                {/* Step 3: Vector Search */}
                                <div className="bg-cyan-600 px-8 py-4 rounded-2xl shadow-lg shadow-cyan-500/30 flex items-center gap-3">
                                    <Search className="w-8 h-8" />
                                    <div>
                                        <div className="font-bold text-lg">3️⃣ 向量資料庫檢索</div>
                                        <div className="text-cyan-200 text-sm">在 Pinecone 中搜尋相似文件</div>
                                    </div>
                                </div>

                                <ArrowDown className="w-8 h-8 text-gray-500 my-4" />

                                {/* Step 4: Context Assembly */}
                                <div className="bg-orange-600 px-8 py-4 rounded-2xl shadow-lg shadow-orange-500/30 flex items-center gap-3">
                                    <BookOpen className="w-8 h-8" />
                                    <div>
                                        <div className="font-bold text-lg">4️⃣ 組裝上下文 (Context)</div>
                                        <div className="text-orange-200 text-sm">結合檢索結果 + 對話歷史</div>
                                    </div>
                                </div>

                                <ArrowDown className="w-8 h-8 text-gray-500 my-4" />

                                {/* Step 5: LLM Generation */}
                                <div className="bg-purple-600 px-8 py-4 rounded-2xl shadow-lg shadow-purple-500/30 flex items-center gap-3">
                                    <Cloud className="w-8 h-8" />
                                    <div>
                                        <div className="font-bold text-lg">5️⃣ LLM 生成回答</div>
                                        <div className="text-purple-200 text-sm">Gemini / OpenAI / OpenRouter</div>
                                    </div>
                                </div>

                                <ArrowDown className="w-8 h-8 text-gray-500 my-4" />

                                {/* Step 6: Save & Response */}
                                <div className="flex gap-4">
                                    <div className="bg-pink-600 px-6 py-4 rounded-2xl shadow-lg shadow-pink-500/30">
                                        <div className="font-bold flex items-center gap-2">
                                            <Database className="w-5 h-5" />
                                            6a. 儲存對話
                                        </div>
                                        <div className="text-pink-200 text-sm">MongoDB / JSON</div>
                                    </div>
                                    <div className="bg-green-600 px-6 py-4 rounded-2xl shadow-lg shadow-green-500/30">
                                        <div className="font-bold flex items-center gap-2">
                                            <Check className="w-5 h-5" />
                                            6b. 回傳結果
                                        </div>
                                        <div className="text-green-200 text-sm">顯示給使用者</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Service Layers */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Embedding Layer */}
                            <div className="bg-gradient-to-br from-indigo-900/50 to-indigo-800/30 rounded-xl p-6 border border-indigo-500/30">
                                <h3 className="font-bold text-lg mb-4 text-indigo-300">📊 Embedding 層</h3>
                                <div className="space-y-3">
                                    <div className="bg-white/10 rounded-lg p-3 flex items-center justify-between">
                                        <span>Gemini</span>
                                        <StatusBadge configured={true} label="優先" />
                                    </div>
                                    <div className="bg-white/10 rounded-lg p-3 flex items-center justify-between">
                                        <span>OpenAI</span>
                                        <StatusBadge configured={false} label="備案 1" />
                                    </div>
                                    <div className="bg-white/10 rounded-lg p-3 flex items-center justify-between">
                                        <span>OpenRouter</span>
                                        <StatusBadge configured={false} label="備案 2" />
                                    </div>
                                    <div className="bg-white/10 rounded-lg p-3 flex items-center justify-between">
                                        <span>Pinecone</span>
                                        <StatusBadge configured={false} label="備案 3" />
                                    </div>
                                </div>
                            </div>

                            {/* LLM Layer */}
                            <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 rounded-xl p-6 border border-purple-500/30">
                                <h3 className="font-bold text-lg mb-4 text-purple-300">🤖 LLM 層</h3>
                                <div className="space-y-3">
                                    <div className="bg-white/10 rounded-lg p-3 flex items-center justify-between">
                                        <span>Gemini</span>
                                        <StatusBadge configured={true} label="優先" />
                                    </div>
                                    <div className="bg-white/10 rounded-lg p-3 flex items-center justify-between">
                                        <span>OpenAI</span>
                                        <StatusBadge configured={false} label="備案 1" />
                                    </div>
                                    <div className="bg-white/10 rounded-lg p-3 flex items-center justify-between">
                                        <span>OpenRouter</span>
                                        <StatusBadge configured={false} label="備案 2" />
                                    </div>
                                </div>
                            </div>

                            {/* Storage Layer */}
                            <div className="bg-gradient-to-br from-pink-900/50 to-pink-800/30 rounded-xl p-6 border border-pink-500/30">
                                <h3 className="font-bold text-lg mb-4 text-pink-300">💾 儲存層</h3>
                                <div className="space-y-3">
                                    <div className="bg-white/10 rounded-lg p-3 flex items-center justify-between">
                                        <span>MongoDB</span>
                                        <StatusBadge configured={false} label="優先" />
                                    </div>
                                    <div className="bg-white/10 rounded-lg p-3 flex items-center justify-between">
                                        <span>JSON 本地檔案</span>
                                        <StatusBadge configured={true} label="備案（自動）" />
                                    </div>
                                </div>
                                <div className="mt-4 text-xs text-pink-300/70 bg-pink-500/10 p-2 rounded">
                                    ⚡ MongoDB 不可用時自動降級
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Providers Tab */}
                {activeTab === 'providers' && (
                    <div className="space-y-8">
                        <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
                            <h2 className="text-xl font-bold mb-6">🔌 所有服務提供者一覽</h2>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-white/20">
                                            <th className="text-left py-3 px-4">類型</th>
                                            <th className="text-left py-3 px-4">服務名稱</th>
                                            <th className="text-left py-3 px-4">用途</th>
                                            <th className="text-left py-3 px-4">環境變數</th>
                                            <th className="text-left py-3 px-4">特點</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/10">
                                        {/* LLM Providers */}
                                        <tr className="bg-purple-500/10">
                                            <td className="py-3 px-4" rowSpan={3}>
                                                <span className="bg-purple-500 px-2 py-1 rounded text-sm">LLM</span>
                                            </td>
                                            <td className="py-3 px-4 font-medium">🔵 Gemini</td>
                                            <td className="py-3 px-4 text-gray-300">生成 AI 回答</td>
                                            <td className="py-3 px-4"><code className="bg-black/30 px-2 py-0.5 rounded text-xs">GEMINI_API_KEY</code></td>
                                            <td className="py-3 px-4 text-sm text-gray-400">免費額度高、速度快</td>
                                        </tr>
                                        <tr className="bg-purple-500/5">
                                            <td className="py-3 px-4 font-medium">🟢 OpenAI</td>
                                            <td className="py-3 px-4 text-gray-300">生成 AI 回答</td>
                                            <td className="py-3 px-4"><code className="bg-black/30 px-2 py-0.5 rounded text-xs">OPENAI_API_KEY</code></td>
                                            <td className="py-3 px-4 text-sm text-gray-400">品質穩定、生態豐富</td>
                                        </tr>
                                        <tr className="bg-purple-500/5">
                                            <td className="py-3 px-4 font-medium">🟠 OpenRouter</td>
                                            <td className="py-3 px-4 text-gray-300">生成 AI 回答</td>
                                            <td className="py-3 px-4"><code className="bg-black/30 px-2 py-0.5 rounded text-xs">OPENROUTER_API_KEY</code></td>
                                            <td className="py-3 px-4 text-sm text-gray-400">多模型、有免費額度</td>
                                        </tr>

                                        {/* Embedding Providers */}
                                        <tr className="bg-cyan-500/10">
                                            <td className="py-3 px-4" rowSpan={4}>
                                                <span className="bg-cyan-500 px-2 py-1 rounded text-sm">Embedding</span>
                                            </td>
                                            <td className="py-3 px-4 font-medium">🔵 Gemini</td>
                                            <td className="py-3 px-4 text-gray-300">文字向量化</td>
                                            <td className="py-3 px-4"><code className="bg-black/30 px-2 py-0.5 rounded text-xs">GEMINI_API_KEY</code></td>
                                            <td className="py-3 px-4 text-sm text-gray-400">768 維度</td>
                                        </tr>
                                        <tr className="bg-cyan-500/5">
                                            <td className="py-3 px-4 font-medium">🟢 OpenAI</td>
                                            <td className="py-3 px-4 text-gray-300">文字向量化</td>
                                            <td className="py-3 px-4"><code className="bg-black/30 px-2 py-0.5 rounded text-xs">OPENAI_API_KEY</code></td>
                                            <td className="py-3 px-4 text-sm text-gray-400">1536/3072 維度</td>
                                        </tr>
                                        <tr className="bg-cyan-500/5">
                                            <td className="py-3 px-4 font-medium">🟠 OpenRouter</td>
                                            <td className="py-3 px-4 text-gray-300">文字向量化</td>
                                            <td className="py-3 px-4"><code className="bg-black/30 px-2 py-0.5 rounded text-xs">OPENROUTER_API_KEY</code></td>
                                            <td className="py-3 px-4 text-sm text-gray-400">透過 API 呼叫</td>
                                        </tr>
                                        <tr className="bg-cyan-500/5">
                                            <td className="py-3 px-4 font-medium">🟣 Pinecone</td>
                                            <td className="py-3 px-4 text-gray-300">文字向量化</td>
                                            <td className="py-3 px-4"><code className="bg-black/30 px-2 py-0.5 rounded text-xs">PINECONE_API_KEY</code></td>
                                            <td className="py-3 px-4 text-sm text-gray-400">multilingual-e5-large</td>
                                        </tr>

                                        {/* Vector DB */}
                                        <tr className="bg-orange-500/10">
                                            <td className="py-3 px-4" rowSpan={2}>
                                                <span className="bg-orange-500 px-2 py-1 rounded text-sm">向量DB</span>
                                            </td>
                                            <td className="py-3 px-4 font-medium">🟣 Pinecone</td>
                                            <td className="py-3 px-4 text-gray-300">向量相似搜尋</td>
                                            <td className="py-3 px-4"><code className="bg-black/30 px-2 py-0.5 rounded text-xs">PINECONE_API_KEY</code></td>
                                            <td className="py-3 px-4 text-sm text-gray-400">雲端、高效能</td>
                                        </tr>
                                        <tr className="bg-orange-500/5">
                                            <td className="py-3 px-4 font-medium">🟤 MongoDB Atlas</td>
                                            <td className="py-3 px-4 text-gray-300">向量相似搜尋</td>
                                            <td className="py-3 px-4"><code className="bg-black/30 px-2 py-0.5 rounded text-xs">MONGODB_URI</code></td>
                                            <td className="py-3 px-4 text-sm text-gray-400">需開啟 Vector Search</td>
                                        </tr>

                                        {/* Storage */}
                                        <tr className="bg-pink-500/10">
                                            <td className="py-3 px-4" rowSpan={2}>
                                                <span className="bg-pink-500 px-2 py-1 rounded text-sm">儲存</span>
                                            </td>
                                            <td className="py-3 px-4 font-medium">🟤 MongoDB</td>
                                            <td className="py-3 px-4 text-gray-300">對話記錄、卡片</td>
                                            <td className="py-3 px-4"><code className="bg-black/30 px-2 py-0.5 rounded text-xs">MONGODB_URI</code></td>
                                            <td className="py-3 px-4 text-sm text-gray-400">雲端持久化</td>
                                        </tr>
                                        <tr className="bg-pink-500/5">
                                            <td className="py-3 px-4 font-medium">📁 JSON 檔案</td>
                                            <td className="py-3 px-4 text-gray-300">對話記錄備案</td>
                                            <td className="py-3 px-4"><code className="bg-black/30 px-2 py-0.5 rounded text-xs">自動啟用</code></td>
                                            <td className="py-3 px-4 text-sm text-gray-400">/data 目錄</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Fallback Tab */}
                {activeTab === 'fallback' && (
                    <div className="space-y-8">
                        {/* Fallback Explanation */}
                        <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <RefreshCw className="w-6 h-6 text-yellow-400" />
                                自動備案 (Fallback) 機制詳解
                            </h2>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* LLM Fallback */}
                                <div className="bg-purple-500/10 rounded-xl p-6 border border-purple-500/30">
                                    <h3 className="font-bold text-lg mb-4 text-purple-300">🤖 LLM 備案流程</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center font-bold">1</div>
                                            <div>
                                                <div className="font-medium">嘗試 Gemini</div>
                                                <div className="text-sm text-gray-400">如果 GEMINI_API_KEY 存在</div>
                                            </div>
                                        </div>
                                        <div className="border-l-2 border-dashed border-purple-500/50 ml-4 pl-6 py-2 text-sm text-gray-400">
                                            ↓ 失敗則往下
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-purple-400 rounded-full flex items-center justify-center font-bold">2</div>
                                            <div>
                                                <div className="font-medium">嘗試 OpenAI</div>
                                                <div className="text-sm text-gray-400">如果 OPENAI_API_KEY 存在</div>
                                            </div>
                                        </div>
                                        <div className="border-l-2 border-dashed border-purple-500/50 ml-4 pl-6 py-2 text-sm text-gray-400">
                                            ↓ 失敗則往下
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-purple-300 rounded-full flex items-center justify-center font-bold text-purple-900">3</div>
                                            <div>
                                                <div className="font-medium">嘗試 OpenRouter</div>
                                                <div className="text-sm text-gray-400">支援免費模型</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Embedding Fallback */}
                                <div className="bg-cyan-500/10 rounded-xl p-6 border border-cyan-500/30">
                                    <h3 className="font-bold text-lg mb-4 text-cyan-300">📊 Embedding 備案流程</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center font-bold">1</div>
                                            <div>
                                                <div className="font-medium">嘗試 Gemini</div>
                                                <div className="text-sm text-gray-400">text-embedding-004</div>
                                            </div>
                                        </div>
                                        <div className="border-l-2 border-dashed border-cyan-500/50 ml-4 pl-6 py-2 text-sm text-gray-400">
                                            ↓ 失敗則往下
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-cyan-400 rounded-full flex items-center justify-center font-bold">2</div>
                                            <div>
                                                <div className="font-medium">嘗試 OpenAI</div>
                                                <div className="text-sm text-gray-400">text-embedding-3-small</div>
                                            </div>
                                        </div>
                                        <div className="border-l-2 border-dashed border-cyan-500/50 ml-4 pl-6 py-2 text-sm text-gray-400">
                                            ↓ 失敗則往下
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-cyan-300 rounded-full flex items-center justify-center font-bold text-cyan-900">3</div>
                                            <div>
                                                <div className="font-medium">嘗試 OpenRouter / Pinecone</div>
                                                <div className="text-sm text-gray-400">最終備案</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 bg-yellow-500/20 rounded-lg p-3 text-sm text-yellow-200">
                                        ⚠️ 注意：指定 provider 時不會自動 fallback，以避免向量維度不匹配
                                    </div>
                                </div>

                                {/* Storage Fallback */}
                                <div className="bg-pink-500/10 rounded-xl p-6 border border-pink-500/30 lg:col-span-2">
                                    <h3 className="font-bold text-lg mb-4 text-pink-300">💾 儲存備案流程</h3>
                                    <div className="flex flex-wrap items-center gap-4">
                                        <div className="flex items-center gap-3 bg-white/10 rounded-lg px-4 py-3">
                                            <Database className="w-6 h-6 text-pink-400" />
                                            <div>
                                                <div className="font-medium">MongoDB</div>
                                                <div className="text-xs text-gray-400">優先使用</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 text-gray-400">
                                            <ArrowRight className="w-6 h-6" />
                                            <span className="text-sm">連線失敗時</span>
                                            <ArrowRight className="w-6 h-6" />
                                        </div>

                                        <div className="flex items-center gap-3 bg-white/10 rounded-lg px-4 py-3">
                                            <FileJson className="w-6 h-6 text-pink-400" />
                                            <div>
                                                <div className="font-medium">JSON 本地檔案</div>
                                                <div className="text-xs text-gray-400">/data/conversations.json</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 bg-green-500/20 rounded-lg p-3 text-sm text-green-200">
                                        ✅ 系統會自動偵測 MongoDB 是否可用，無需手動設定
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Reference */}
                        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl p-6 border border-blue-500/30">
                            <h3 className="font-bold text-lg mb-4">📋 快速參考：最少需要設定什麼？</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white/10 rounded-lg p-4">
                                    <div className="font-medium text-green-300 mb-2">✅ 基本運作（聊天功能）</div>
                                    <ul className="text-sm text-gray-300 space-y-1">
                                        <li>• <code>PINECONE_API_KEY</code> - 向量資料庫</li>
                                        <li>• <code>PINECONE_INDEX_NAME</code> - 索引名稱</li>
                                        <li>• 至少一個 LLM API Key（Gemini/OpenAI/OpenRouter）</li>
                                    </ul>
                                </div>
                                <div className="bg-white/10 rounded-lg p-4">
                                    <div className="font-medium text-blue-300 mb-2">💡 完整功能</div>
                                    <ul className="text-sm text-gray-300 space-y-1">
                                        <li>• <code>MONGODB_URI</code> - 對話持久化</li>
                                        <li>• <code>LINE_*</code> 相關設定 - LINE Bot</li>
                                        <li>• <code>ADMIN_PASSWORD</code> - 安全性</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
