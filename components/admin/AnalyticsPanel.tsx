'use client';

import { useState } from 'react';
import { BarChart, Activity, Users, Sparkles, Loader2 } from 'lucide-react';

interface AnalyticsData {
    activeUsers: number;
    totalChats: number;
    hotKeywords: string[];
}

interface AnalyticsPanelProps {
    data?: AnalyticsData;
}

export default function AnalyticsPanel({ data }: AnalyticsPanelProps) {
    const [generating, setGenerating] = useState(false);
    const [keywords, setKeywords] = useState<string[]>(data?.hotKeywords || []);

    const handleGenerateKeywords = async () => {
        setGenerating(true);
        // Mock AI generation delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        setKeywords(['微積分', '線性代數', '極限', '矩陣', '特徵值', '機率論', '統計學']);
        setGenerating(false);
    };

    const hasData = data && (data.activeUsers > 0 || data.totalChats > 0);

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
                <Activity className="w-5 h-5 text-blue-600" /> 數據概覽
            </h2>

            {!hasData ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300 mb-6">
                    <BarChart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">尚無足夠數據</p>
                    <p className="text-xs text-gray-400 mt-1">當有更多用戶互動時，此處將顯示統計數據</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <div className="text-blue-600 text-sm font-medium flex items-center gap-1">
                            <Users className="w-4 h-4" /> 活躍用戶
                        </div>
                        <div className="text-2xl font-bold text-blue-900 mt-1">{data.activeUsers.toLocaleString()}</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                        <div className="text-green-600 text-sm font-medium flex items-center gap-1">
                            <BarChart className="w-4 h-4" /> 今日對話
                        </div>
                        <div className="text-2xl font-bold text-green-900 mt-1">{data.totalChats.toLocaleString()}</div>
                    </div>
                </div>
            )}

            <div>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-medium text-gray-700">熱門關鍵字 (Hot Keywords)</h3>
                    <button
                        onClick={handleGenerateKeywords}
                        disabled={generating}
                        className="text-xs flex items-center gap-1 text-purple-600 hover:text-purple-700 disabled:opacity-50"
                    >
                        {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        {generating ? 'AI 分析中...' : 'AI 生成分析'}
                    </button>
                </div>

                {keywords.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {keywords.map((tag, idx) => (
                            <span key={idx} className="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-100 text-xs rounded-full">
                                {tag}
                            </span>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-4 bg-gray-50 rounded border border-dashed text-xs text-gray-400">
                        點擊上方按鈕以使用 AI 分析對話紀錄並生成熱門關鍵字
                    </div>
                )}
            </div>
        </div>
    );
}
