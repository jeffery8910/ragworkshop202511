'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// configure pdfjs worker (use CDN worker to avoid bundling)
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.js`;

interface UploadPanelProps {
    onAction?: (msg: string) => void;
}

export default function UploadPanel({ onAction }: UploadPanelProps) {
    const router = useRouter();
    const [dragActive, setDragActive] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [mode, setMode] = useState<'text' | 'ocr' | 'llm'>('text');
    const [localParse, setLocalParse] = useState<boolean>(false);
    const [chunkSize, setChunkSize] = useState<number>(800);
    const [chunkOverlap, setChunkOverlap] = useState<number>(100);
    const [progress, setProgress] = useState<{ stage: 'idle' | 'parsing' | 'uploading'; value: number; message?: string }>({
        stage: 'idle',
        value: 0,
        message: ''
    });

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
            const picked = Array.from(e.dataTransfer.files);
            setFiles(picked);
            onAction?.('已選擇檔案，準備上傳');
        }
    };

    const extractPdfText = async (file: File) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const strings = content.items.map((item: any) => item.str).join(' ');
            fullText += strings + '\n';
        }
        return fullText;
    };

    const chunkText = (text: string, size = 800, overlap = 100) => {
        const chunks: string[] = [];
        let idx = 0;
        while (idx < text.length) {
            const end = Math.min(text.length, idx + size);
            chunks.push(text.slice(idx, end));
            idx = end - overlap;
        }
        return chunks;
    };

    const handleUpload = async () => {
        if (!files.length) return;
        setUploading(true);
        setProgress({ stage: 'parsing', value: 5, message: '準備切分檔案…' });
        onAction?.('開始上傳/切分/向量化');
        try {
            const formData = new FormData();
            formData.append('mode', mode);

            if (localParse) {
                // 前端解析 PDF 為純文字並切 chunk，以 plaintext 傳給後端
                for (const file of files) {
                    if (file.type === 'application/pdf') {
                        setProgress({ stage: 'parsing', value: 10, message: `解析 ${file.name}…` });
                        const text = await extractPdfText(file);
                        const chunks = chunkText(text, chunkSize, chunkOverlap);
                        setProgress({ stage: 'parsing', value: 30, message: `切分 ${chunks.length} 塊…` });
                        chunks.forEach((chunk, idx) => {
                            formData.append('plaintext', JSON.stringify({
                                filename: `${file.name}#chunk${idx + 1}`,
                                text: chunk,
                                mode
                            }));
                        });
                    } else {
                        // 非 PDF 仍傳檔案由後端處理
                        formData.append('files', file);
                    }
                }
            } else {
                files.forEach(file => formData.append('files', file));
            }

            setProgress({ stage: 'uploading', value: 50, message: '上傳伺服器中…' });
            const res = await fetch('/api/admin/upload', {
                method: 'POST',
                body: formData,
            });
            const text = await res.text();
            let data: any = {};
            try { data = text ? JSON.parse(text) : {}; } catch (e) {
                throw new Error(text.slice(0, 200) || '上傳失敗 (非 JSON 回應)');
            }
            if (!res.ok) throw new Error(data?.error || text || '上傳失敗');

            setFiles([]);
            onAction?.('檔案上傳並向量化完成');
            alert('Upload Complete!');
            router.refresh();
            setProgress({ stage: 'idle', value: 0 });
        } catch (err: any) {
            console.error(err);
            alert(err?.message || '上傳過程發生錯誤');
            onAction?.('上傳失敗，請稍後再試');
        } finally {
            setUploading(false);
            setProgress(p => ({ ...p, stage: 'idle', value: 0 }));
        }
    };

    const onButtonClick = () => {
        document.getElementById('file-upload')?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const picked = Array.from(e.target.files);
            setFiles(picked);
            onAction?.('已選擇檔案，準備上傳');
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md h-full">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" /> 知識庫上傳
            </h2>
            <div className="mb-4 flex items-center gap-4 text-sm">
                <label className="flex items-center gap-1">
                    <input type="radio" value="text" checked={mode === 'text'} onChange={() => setMode('text')} />
                    純文字解析
                </label>
                <label className="flex items-center gap-1">
                    <input type="radio" value="ocr" checked={mode === 'ocr'} onChange={() => setMode('ocr')} />
                    OCR / 圖片轉文字
                </label>
                <label className="flex items-center gap-1">
                    <input type="radio" value="llm" checked={mode === 'llm'} onChange={() => setMode('llm')} />
                    LLM 精修文字
                </label>
                <label className="flex items-center gap-1">
                    <input type="checkbox" checked={localParse} onChange={e => setLocalParse(e.target.checked)} />
                    本地切分 PDF 後上傳（推薦大檔/無 OCR）
                </label>
            </div>

            {localParse && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                        <label className="block text-gray-600 mb-1">Chunk 大小 (字元)</label>
                        <input
                            type="number"
                            min={200}
                            max={4000}
                            value={chunkSize}
                            onChange={e => setChunkSize(Number(e.target.value))}
                            className="w-full border rounded p-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-600 mb-1">重疊 (字元)</label>
                        <input
                            type="number"
                            min={0}
                            max={1000}
                            value={chunkOverlap}
                            onChange={e => setChunkOverlap(Number(e.target.value))}
                            className="w-full border rounded p-2 text-sm"
                        />
                    </div>
                </div>
            )}

            <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                    }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={onButtonClick}
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
                <p className="text-gray-500 mb-2">點擊此處或拖放 PDF/TXT 檔案</p>
                <p className="text-xs text-gray-400">支援多檔上傳</p>
            </div>

            {files.length > 0 && (
                <div className="mt-4 space-y-2">
                    {files.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-gray-600" />
                                <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                            </div>
                            <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</span>
                        </div>
                    ))}
                    <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="w-full mt-4 bg-black text-white py-2 rounded hover:bg-gray-800 disabled:opacity-50"
                    >
                        {uploading ? '處理中...' : '開始上傳與向量化'}
                    </button>
                    {uploading && (
                        <div className="mt-2">
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className="h-2 bg-blue-500 transition-all"
                                    style={{ width: `${progress.value || (progress.stage === 'uploading' ? 70 : 30)}%` }}
                                />
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                {progress.message || (progress.stage === 'uploading' ? '上傳中…' : '解析/切分中…')}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
