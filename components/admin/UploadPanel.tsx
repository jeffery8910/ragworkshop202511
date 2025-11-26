'use client';

import { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';

export default function UploadPanel() {
    const [dragActive, setDragActive] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);

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

    const handleUpload = async () => {
        setUploading(true);
        // TODO: Implement actual upload logic to API
        await new Promise(resolve => setTimeout(resolve, 2000));
        setUploading(false);
        setFiles([]);
        alert('Upload Complete!');
    };

    const onButtonClick = () => {
        document.getElementById('file-upload')?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFiles(Array.from(e.target.files));
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md h-full">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" /> 知識庫上傳
            </h2>

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
                </div>
            )}
        </div>
    );
}
