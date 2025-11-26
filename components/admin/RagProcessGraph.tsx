'use client';

import { motion } from 'framer-motion';
import { Database, FileText, Search, Zap, MessageSquare, ArrowRight, User } from 'lucide-react';

export default function RagProcessGraph() {
    return (
        <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center bg-white p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-700 mb-6">RAG 運作流程 (RAG Workflow)</h3>

            <div className="flex items-center justify-between w-full max-w-4xl relative">
                {/* Connecting Line */}
                <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -z-10 transform -translate-y-1/2" />

                {/* Step 1: User Query */}
                <div className="flex flex-col items-center gap-2 bg-white p-2 z-10">
                    <motion.div
                        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }}
                        className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 border-2 border-blue-200"
                    >
                        <User className="w-6 h-6" />
                    </motion.div>
                    <span className="text-xs font-bold text-gray-600">使用者提問</span>
                </div>

                <ArrowRight className="w-5 h-5 text-gray-400" />

                {/* Step 2: Embedding */}
                <div className="flex flex-col items-center gap-2 bg-white p-2 z-10">
                    <motion.div
                        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4 }}
                        className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 border-2 border-purple-200"
                    >
                        <Zap className="w-6 h-6" />
                    </motion.div>
                    <span className="text-xs font-bold text-gray-600">向量化 (Embedding)</span>
                </div>

                <ArrowRight className="w-5 h-5 text-gray-400" />

                {/* Step 3: Retrieval */}
                <div className="flex flex-col items-center gap-2 bg-white p-2 z-10">
                    <motion.div
                        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6 }}
                        className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 border-2 border-green-200"
                    >
                        <Search className="w-6 h-6" />
                    </motion.div>
                    <span className="text-xs font-bold text-gray-600">語意檢索 (Retrieval)</span>
                    <div className="absolute -bottom-12 flex flex-col items-center">
                        <div className="h-8 w-0.5 bg-gray-300 mb-1"></div>
                        <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                            <Database className="w-3 h-3 text-gray-500" />
                            <span className="text-[10px] text-gray-500">Vector DB</span>
                        </div>
                    </div>
                </div>

                <ArrowRight className="w-5 h-5 text-gray-400" />

                {/* Step 4: Generation */}
                <div className="flex flex-col items-center gap-2 bg-white p-2 z-10">
                    <motion.div
                        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8 }}
                        className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 border-2 border-yellow-200"
                    >
                        <FileText className="w-6 h-6" />
                    </motion.div>
                    <span className="text-xs font-bold text-gray-600">生成回答 (Generation)</span>
                </div>

                <ArrowRight className="w-5 h-5 text-gray-400" />

                {/* Step 5: Answer */}
                <div className="flex flex-col items-center gap-2 bg-white p-2 z-10">
                    <motion.div
                        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.0 }}
                        className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 border-2 border-indigo-200"
                    >
                        <MessageSquare className="w-6 h-6" />
                    </motion.div>
                    <span className="text-xs font-bold text-gray-600">最終回覆</span>
                </div>
            </div>

            <div className="mt-8 text-xs text-gray-400 max-w-2xl text-center">
                <p>RAG (Retrieval-Augmented Generation) 結合了檢索與生成技術。系統首先將您的問題轉換為向量，從知識庫中檢索最相關的片段，然後將這些片段作為上下文提供給 AI 模型，以生成準確且基於事實的回答。</p>
            </div>
        </div>
    );
}
