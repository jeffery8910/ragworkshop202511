'use client';

import { useState, useEffect } from 'react';
import { Upload, FileText, RefreshCw, Database, Eye, Trash2, Zap } from 'lucide-react';
import RagLabPanel from '@/components/admin/RagLabPanel';
import RagProcessGraph from '@/components/admin/RagProcessGraph';
import KnowledgeGraph from '@/components/admin/KnowledgeGraph';

interface VectorChunk {
    id: string;
    text: string;
    source: string;
    score?: number;
}

interface IndexedFile {
    docId: string;
    name: string;
    status: 'indexed' | 'processing' | 'failed' | 'reindexed';
    chunks: number;
    uploadedAt: string;
}

export default function KnowledgeBasePage() {
    const [activeTab, setActiveTab] = useState<'knowledge' | 'rag-lab'>('knowledge');
    const [dragActive, setDragActive] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(false);

    // Initialize with empty array - No Mock Data
    const [indexedFiles, setIndexedFiles] = useState<IndexedFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<IndexedFile | null>(null);
    const [chunks, setChunks] = useState<VectorChunk[]>([]);
    const [allChunks, setAllChunks] = useState<any[]>([]);
    const [listLoading, setListLoading] = useState(false);
    const [actionMsg, setActionMsg] = useState<string | null>(null);

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
        alert('上傳功能尚未連接後端 API (Pending Backend Integration)');
    };

    const loadDocuments = async () => {
        setListLoading(true);
        try {
            const res = await fetch('/api/admin/documents', { cache: 'no-store' });
            const data = await res.json();
            const mapped: IndexedFile[] = (data?.documents || []).map((d: any) => ({
                docId: d.docId,
                name: d.filename,
                status: (d.status as any) || 'indexed',
                chunks: d.chunks,
                uploadedAt: d.indexedAt ? new Date(d.indexedAt).toLocaleString() : '',
            }));
            setIndexedFiles(mapped);
            setAllChunks(data?.chunks || []);
        } catch (e: any) {
            console.error(e);
            alert('讀取文件列表失敗：' + (e?.message || e));
        } finally {
            setListLoading(false);
        }
    };

    useEffect(() => {
        loadDocuments();
    }, []);

    const handleViewChunks = async (file: IndexedFile) => {
        setSelectedFile(file);
        setLoading(true);
        const filtered = allChunks.filter((c: any) => c.docId === file.docId);
        setChunks(
            filtered.map((c: any) => ({
                id: c.chunkId,
                text: c.text || '',
                source: c.source,
                score: c.score,
            }))
        );
        setLoading(false);
    };

    const reindex = async (docId?: string) => {
        setActionMsg('重新索引中...');
        try {
            const res = await fetch('/api/admin/index', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(docId ? { scope: 'doc', docId } : { scope: 'all' }),
            });
            const data = await res.json();
            if (!res.ok || !data?.ok) throw new Error(data?.error || '重新索引失敗');
            await loadDocuments();
            alert('重新索引完成');
        } catch (e: any) {
            alert(e?.message || '重新索引失敗');
        } finally {
            setActionMsg(null);
        }
    };

    const removeDocs = async (docId?: string) => {
        const ok = confirm(docId ? '確定刪除該文件的向量與紀錄？' : '確定清空所有文件與向量？');
        if (!ok) return;
        setActionMsg('刪除中...');
        try {
            const res = await fetch('/api/admin/index', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(docId ? { scope: 'doc', docId } : { scope: 'all' }),
            });
            const data = await res.json();
            if (!res.ok || !data?.ok) throw new Error(data?.error || '刪除失敗');
            await loadDocuments();
            if (selectedFile && (!docId || selectedFile.docId === docId)) {
                setSelectedFile(null);
                setChunks([]);
            }
            alert('刪除完成');
        } catch (e: any) {
            alert(e?.message || '刪除失敗');
        } finally {
            setActionMsg(null);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="mb-6 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">知識庫管理中心</h1>
                    <p className="text-gray-600">統一管理檔案上傳、向量切片、與 RAG 實驗測試</p>
                </div>

                {/* Tabs */}
                <div className="flex bg-white rounded-lg p-1 shadow-sm border">
                    <button
                        onClick={() => setActiveTab('knowledge')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'knowledge' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <Database className="w-4 h-4" /> 知識庫管理
                    </button>
                    <button
                        onClick={() => setActiveTab('rag-lab')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'rag-lab' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <Zap className="w-4 h-4" /> RAG 實驗室
                    </button>
                </div>
            </div>

            {activeTab === 'knowledge' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: File Upload */}
                    <div className="lg:col-span-3 space-y-6">
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
                        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500 space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
                                    <Database className="w-5 h-5 text-green-600" /> 已索引檔案
                                </h2>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => reindex()}
                                        disabled={!!actionMsg}
                                        className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 flex items-center gap-1"
                                    >
                                        <RefreshCw className="w-3 h-3" /> 全部重建
                                    </button>
                                    <button
                                        onClick={() => removeDocs()}
                                        disabled={!!actionMsg}
                                        className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 flex items-center gap-1"
                                    >
                                        <Trash2 className="w-3 h-3" /> 清空
                                    </button>
                                </div>
                            </div>
                            {listLoading ? (
                                <div className="text-center py-6 text-gray-500">載入中...</div>
                            ) : indexedFiles.length > 0 ? (
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
                                                    <p className="text-[10px] text-gray-400 break-all">docId: {file.docId}</p>
                                                </div>
                                                <span
                                                    className={`text-xs px-2 py-1 rounded flex-shrink-0 ${file.status === 'indexed' || file.status === 'reindexed' ? 'bg-green-100 text-green-700' :
                                                        file.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-red-100 text-red-700'
                                                        }`}
                                                >
                                                    {file.status === 'indexed' || file.status === 'reindexed' ? '已索引' : file.status === 'processing' ? '處理中' : '失敗'}
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleViewChunks(file)}
                                                    className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 flex items-center gap-1"
                                                >
                                                    <Eye className="w-3 h-3" /> 查看切片
                                                </button>
                                                <button
                                                    onClick={() => reindex(file.docId)}
                                                    disabled={!!actionMsg}
                                                    className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded hover:bg-amber-200 flex items-center gap-1"
                                                >
                                                    <RefreshCw className="w-3 h-3" /> 重建
                                                </button>
                                                <button
                                                    onClick={() => removeDocs(file.docId)}
                                                    disabled={!!actionMsg}
                                                    className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 flex items-center gap-1"
                                                >
                                                    <Trash2 className="w-3 h-3" /> 刪除
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                                    <Database className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                    <p className="text-sm">尚無已索引的檔案</p>
                                </div>
                            )}
                            {actionMsg && <p className="text-xs text-amber-700">{actionMsg}</p>}
                        </div>
                    </div>

                    {/* Middle Column: Vector Chunks */}
                    <div className="lg:col-span-4">
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
                                    ) : chunks.length > 0 ? (
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
                                    ) : (
                                        <div className="text-center py-8 text-gray-500">
                                            <p>此檔案暫無切片資料</p>
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
                    <div className="lg:col-span-5 flex flex-col gap-4">
                        {/* Replaced inline visualization with the real KnowledgeGraph component */}
                        <div className="h-[500px]">
                            <KnowledgeGraph />
                        </div>
                        
                        {/* RAG Process Visualization */}
                        <RagProcessGraph />
                    </div>
                </div>
            ) : (
                <RagLabPanel />
            )}
        </div>
    );
}
