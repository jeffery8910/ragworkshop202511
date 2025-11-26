'use client';

import { BarChart, Activity, Users } from 'lucide-react';

export default function AnalyticsPanel() {
    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5" /> 數據概覽
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-blue-500 text-sm font-medium flex items-center gap-1">
                        <Users className="w-4 h-4" /> 活躍用戶
                    </div>
                    <div className="text-2xl font-bold text-blue-700 mt-1">1,234</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-green-500 text-sm font-medium flex items-center gap-1">
                        <BarChart className="w-4 h-4" /> 今日對話
                    </div>
                    <div className="text-2xl font-bold text-green-700 mt-1">856</div>
                </div>
            </div>

            <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">熱門關鍵字</h3>
                <div className="flex flex-wrap gap-2">
                    {['微積分', '線性代數', '極限', '矩陣', '特徵值'].map(tag => (
                        <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
