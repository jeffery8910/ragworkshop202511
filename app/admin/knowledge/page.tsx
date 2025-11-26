'use client';

import { useState, useEffect } from 'react';
import { Upload, FileText, Network, RefreshCw, Database, CheckCircle, Eye, Trash2 } from 'lucide-react';

interface VectorChunk {
    id: string;
    text: string;
    source: string;
    score?: number;
}

interface IndexedFile {
    name: string;
    status: 'indexed' | 'processing' | 'failed';
    chunks: number;
    uploadedAt: string;
}

export default function KnowledgeBasePage() {
    const [dragActive, setDragActive] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [indexedFiles, setIndexedFiles] = useState<IndexedFile[]>([
        { name: 'calculus_intro.pdf', status: 'indexed', chunks: 45, uploadedAt: '2025-01-15' },
        { name: 'physics_basics.pdf', status: 'indexed', chunks: 32, uploadedAt: '2025-01-14' },
        { name: 'history_of_math.txt', status: 'processing', chunks: 0, uploadedAt: '2025-01-16' },
    ]);
    const [selectedFile, setSelectedFile] = useState<IndexedFile | null>(null);
    const [chunks, setChunks] = useState<VectorChunk[]>([]);
    const [vectors, setVectors] = useState<{ id: number; x: number; y: number; title: string; source: string }[]>(
        Array.from({ length: 20 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            title: `Chunk ${i + 1}`,
            source: i % 2 === 0 ? 'calculus_intro.pdf' : 'physics_basics.pdf'
        }))
    );

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFiles(Array.from(e.target.files));
        }
    };

    const handleUpload = async () => {
        setUploading(true);
        // TODO: Implement actual upload logic
        await new Promise(resolve => setTimeout(resolve, 2000));
        setUploading(false);
        setFiles([]);
        alert('上傳完成！檔案已開始向量化。');
    };

    const handleViewChunks = async (file: IndexedFile) => {
        setSelectedFile(file);
        setLoading(true);
        // Mock: Fetch chunks for the selected file
        await new Promise(resolve => setTimeout(resolve, 500));
        setChunks([
            { id: '1', text: '微積分是數學的一個分支...', source: file.name },
            { id: '2', text: '導數表示函數在某點的瞬時變化率...', source: file.name },
            { id: '3', text: '積分可以用來計算曲線下的面積...', source: file.name },
        ]);
        setLoading(false);
    };

    const handleRefreshViz = () => {
        setVectors(Array.from({ length: 20 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            title: `Chunk ${i + 1}`,
            source: i % 3 === 0 ? 'history.pdf' : 'science.pdf'
        })));
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">知識庫管理中心</h1>
                <p className="text-gray-600">統一管理檔案上傳、向量切片、與知識視覺化</p>
            </div>

            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left Column: File Upload */}
                <div className="xl:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
                            <Upload className="w-5 h-5 text-blue-600" /> 檔案上傳
                        </h2>

                        <div
                            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                                }`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById('file-upload')?.click()}
                        >
                            <input
                                type="file"
                                id="file-upload"
                                multiple
                                className="hidden"
                                onChange={handleFileChange}
                                accept=".pdf,.txt,.md"
                            />
                            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-500 mb-2">點擊或拖放檔案</p>
                            <p className="text-xs text-gray-400">支援 PDF、TXT、MD</p>
                        </div>

                        {files.length > 0 && (
                            <div className="mt-4 space-y-2">
                                {files.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-gray-600" />
                                            <span className="text-sm truncate max-w-[150px]">{file.name}</span>
                                        </div>
                                        <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                ))}
                                <button
                                    onClick={handleUpload}
                                    disabled={uploading}
                                    className="w-full mt-4 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {uploading ? '處理中...' : '開始上傳與向量化'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Indexed Files List */}
                    <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
                            <Database className="w-5 h-5 text-green-600" /> 已索引檔案
                        </h2>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {indexedFiles.map((file, idx) => (
                                <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                                <span className="text-sm font-medium text-gray-800 truncate">{file.name}</span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">Chunks: {file.chunks} | {file.uploadedAt}</p>
                                        </div>
                                        <span
                                            className={`text-xs px-2 py-1 rounded flex-shrink-0 ${file.status === 'indexed' ? 'bg-green-100 text-green-700' :
                                                    file.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-red-100 text-red-700'
                                                }`}
                                        >
                                            {file.status === 'indexed' ? '已索引' : file.status === 'processing' ? '處理中' : '失敗'}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleViewChunks(file)}
                                            className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 flex items-center gap-1"
                                        >
                                            <Eye className="w-3 h-3" /> 查看切片
                                        </button>
                                        <button className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 flex items-center gap-1">
                                            <Trash2 className="w-3 h-3" /> 刪除
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Middle Column: Vector Chunks */}
                <div className="xl:col-span-1">
                    <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500 h-full">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
                            <FileText className="w-5 h-5 text-purple-600" /> 向量切片詳情
                        </h2>

                        {selectedFile ? (
                            <div>
                                <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                                    <p className="text-sm font-medium text-purple-900">來源檔案: {selectedFile.name}</p>
                                    <p className="text-xs text-purple-700 mt-1">Total Chunks: {selectedFile.chunks}</p>
                                </div>

                                {loading ? (
                                    <div className="text-center text-gray-500 py-8">載入中...</div>
                                ) : (
                                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                        {chunks.map((chunk, idx) => (
                                            <div key={chunk.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-xs font-mono text-gray-400">Chunk #{idx + 1}</span>
                                                    {chunk.score && (
                                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                                            Score: {chunk.score.toFixed(3)}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-700 leading-relaxed">{chunk.text}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center text-gray-500 py-12">
                                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-sm">請從左側選擇一個檔案以查看其切片詳情</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Visualization */}
                <div className="xl:col-span-1">
                    <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-indigo-500 h-full">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
                                <Network className="w-5 h-5 text-indigo-600" /> 知識視覺化
                            </h2>
                            <button
                                onClick={handleRefreshViz}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <RefreshCw className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>

                        <div className="relative w-full h-96 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 overflow-hidden mb-4">
                            {vectors.map((v) => (
                                <div
                                    key={v.id}
                                    className="absolute w-3 h-3 bg-indigo-500 rounded-full hover:bg-indigo-700 cursor-pointer transition-all hover:scale-150 shadow-lg"
                                    style={{ left: `${v.x}%`, top: `${v.y}%` }}
                                    title={`${v.title}\n來源: ${v.source}`}
                                />
                            ))}
                            <div className="absolute bottom-2 right-2 text-xs text-indigo-600 bg-white/80 px-2 py-1 rounded">
                                2D Projection (t-SNE)
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-gray-700">統計資訊</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                    <p className="text-xs text-blue-600 mb-1">總向量數</p>
                                    <p className="text-2xl font-bold text-blue-900">{vectors.length}</p>
                                </div>
                                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                    <p className="text-xs text-green-600 mb-1">已索引檔案</p>
                                    <p className="text-2xl font-bold text-green-900">{indexedFiles.filter(f => f.status === 'indexed').length}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
