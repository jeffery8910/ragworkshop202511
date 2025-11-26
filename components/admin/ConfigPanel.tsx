'use client';

import { useState } from 'react';
import { Settings, Save } from 'lucide-react';

export default function ConfigPanel() {
    const [config, setConfig] = useState({
        topK: 5,
        temperature: 0.7,
        promptTemplate: '你是一個專業的家教...'
    });

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" /> 系統參數設定
            </h2>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Top-K (檢索數量)</label>
                    <input
                        type="number"
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
                    />
                </div>

                <button className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-800 py-2 rounded hover:bg-gray-200">
                    <Save className="w-4 h-4" /> 儲存設定
                </button>
            </div>
        </div>
    );
}
