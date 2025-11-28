import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMongoClient } from '@/lib/db/mongo';
import { getPineconeClient } from '@/lib/vector/pinecone';
import { getEmbedding } from '@/lib/vector/embedding';
import { nanoid } from 'nanoid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Mode = 'text' | 'ocr' | 'llm';

// Simple chunker by characters
function chunkText(text: string, size = 800, overlap = 100) {
    const chunks: { text: string; start: number; end: number }[] = [];
    let idx = 0;
    while (idx < text.length) {
        const end = Math.min(text.length, idx + size);
        chunks.push({ text: text.slice(idx, end), start: idx, end });
        idx = end - overlap;
    }
    return chunks;
}

async function extractPdf(buffer: ArrayBuffer): Promise<{ text: string; error?: string }> {
    // Minimal stubs to satisfy pdfjs in serverless env without canvas
    if (!(global as any).DOMMatrix) {
        (global as any).DOMMatrix = class DOMMatrix {
            a: number; b: number; c: number; d: number; e: number; f: number;
            constructor() {
                this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
            }
            multiply() { return this; }
            inverse() { return this; }
            translate() { return this; }
            scale() { return this; }
            transformPoint(pt: any) { return pt; }
        } as any;
    }
    if (!(global as any).Path2D) {
        (global as any).Path2D = class Path2D { constructor() { } addPath() { } } as any;
    }
    if (!(global as any).ImageData) {
        (global as any).ImageData = class ImageData { constructor() { } } as any;
    }
    try {
        const mod = await import('pdf-parse');
        const pdfParse = (mod as any).default || (mod as any);
        const data = await pdfParse(Buffer.from(buffer));
        return { text: data.text as string };
    } catch (err: any) {
        return { text: '', error: err?.message || String(err) };
    }
}

async function extractImageWithVision(buffer: ArrayBuffer, fileName: string) {
    // Prefer OpenAI Vision if key exists, else Gemini
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const b64 = Buffer.from(buffer).toString('base64');
    const prompt = 'Extract all readable text from this image or scanned page, keep original order. Return plain text only.';

    if (openaiKey) {
        const OpenAI = (await import('openai')).default;
        const client = new OpenAI({ apiKey: openaiKey });
        const res = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: prompt },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
                    ],
                },
            ],
            max_tokens: 2048,
        });
        return res.choices[0]?.message?.content ?? '';
    }

    if (geminiKey) {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const res = await model.generateContent([
            { text: prompt },
            { inlineData: { data: b64, mimeType: 'image/png' } },
        ]);
        return res.response.text();
    }

    throw new Error(`No vision-capable API key (OPENAI_API_KEY or GEMINI_API_KEY) to OCR ${fileName}`);
}

type LlmConfig = { provider?: 'openai' | 'gemini' | 'openrouter'; apiKey?: string; model?: string };

async function extractWithLLM(text: string, fileName: string, llm: LlmConfig) {
    const instruction = `整理以下文件內容，輸出乾淨純文字。不要摘要，保留所有可讀文本，移除多餘空白。`;

    if (llm.provider === 'openai' && llm.apiKey) {
        const OpenAI = (await import('openai')).default;
        const client = new OpenAI({ apiKey: llm.apiKey });
        const res = await client.chat.completions.create({
            model: llm.model || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: instruction },
                { role: 'user', content: text.slice(0, 12000) },
            ],
            max_tokens: 6000,
        });
        return res.choices[0]?.message?.content ?? text;
    }
    if (llm.provider === 'gemini' && llm.apiKey) {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(llm.apiKey);
        const model = genAI.getGenerativeModel({ model: llm.model || 'gemini-1.5-flash' });
        const res = await model.generateContent([instruction, text.slice(0, 12000)]);
        return res.response.text();
    }
    if (llm.provider === 'openrouter' && llm.apiKey) {
        const OpenAI = (await import('openai')).default;
        const client = new OpenAI({ apiKey: llm.apiKey, baseURL: 'https://openrouter.ai/api/v1' });
        const res = await client.chat.completions.create({
            model: llm.model || 'mistralai/Mistral-7B-Instruct:free',
            messages: [
                { role: 'system', content: instruction },
                { role: 'user', content: text.slice(0, 12000) },
            ],
            max_tokens: 6000,
        });
        return res.choices[0]?.message?.content ?? text;
    }
    throw new Error(`No LLM key (Gemini/OpenAI/OpenRouter) to清理檔案 ${fileName}`);
}

export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const mongoUri = cookieStore.get('MONGODB_URI')?.value || process.env.MONGODB_URI;
        const mongoDb = cookieStore.get('MONGODB_DB_NAME')?.value || process.env.MONGODB_DB_NAME || 'rag_db';
        const pineKey = cookieStore.get('PINECONE_API_KEY')?.value || process.env.PINECONE_API_KEY;
        const pineIndex = cookieStore.get('PINECONE_INDEX_NAME')?.value || process.env.PINECONE_INDEX_NAME || 'rag-index';

        if (!mongoUri) return NextResponse.json({ error: 'MONGODB_URI not set' }, { status: 400 });
        if (!pineKey) return NextResponse.json({ error: 'PINECONE_API_KEY not set' }, { status: 400 });

        const form = await req.formData();
        const mode = (form.get('mode') as Mode) || 'text';
        const files = form.getAll('files') as File[];
        if (!files.length) return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });

        const mongoClient = await getMongoClient(mongoUri);
        const db = mongoClient.db(mongoDb);
        const docCollection = db.collection('documents');
        const chunkCollection = db.collection('chunks');
        const pinecone = await getPineconeClient(pineKey);
        const pine = pinecone.index(pineIndex);

        const embeddingProvider = (cookieStore.get('EMBEDDING_PROVIDER')?.value || process.env.EMBEDDING_PROVIDER || 'gemini') as any;
        const embeddingModel = cookieStore.get('EMBEDDING_MODEL')?.value || process.env.EMBEDDING_MODEL;
        const chatModel = cookieStore.get('CHAT_MODEL')?.value || process.env.CHAT_MODEL || '';
        const geminiKey = cookieStore.get('GEMINI_API_KEY')?.value || process.env.GEMINI_API_KEY;
        const openaiKey = cookieStore.get('OPENAI_API_KEY')?.value || process.env.OPENAI_API_KEY;
        const openrouterKey = cookieStore.get('OPENROUTER_API_KEY')?.value || process.env.OPENROUTER_API_KEY;

        const resolveLlm = (): LlmConfig => {
            const m = chatModel.toLowerCase();
            if (m.startsWith('gpt') || m.startsWith('o') || m.startsWith('chatgpt')) {
                if (openaiKey) return { provider: 'openai', apiKey: openaiKey, model: chatModel };
            }
            if (m.startsWith('gemini')) {
                if (geminiKey) return { provider: 'gemini', apiKey: geminiKey, model: chatModel };
            }
            if (openrouterKey) return { provider: 'openrouter', apiKey: openrouterKey, model: chatModel || 'mistralai/Mistral-7B-Instruct:free' };
            if (openaiKey) return { provider: 'openai', apiKey: openaiKey, model: 'gpt-4o-mini' };
            if (geminiKey) return { provider: 'gemini', apiKey: geminiKey, model: 'gemini-1.5-flash' };
            return {};
        };
        const llmConfig = resolveLlm();
        const llmUsable = !!llmConfig.provider && !!llmConfig.apiKey;

        const results = [];

        for (const file of files) {
            const arrayBuffer = await file.arrayBuffer();
            const name = file.name;
            const lower = name.toLowerCase();
            let text = '';
            let parseErr: string | undefined;

            try {
                if (lower.endsWith('.pdf')) {
                    const { text: pdfText, error: pdfError } = await extractPdf(arrayBuffer);
                    text = pdfText;
                    parseErr = pdfError;
                    if (mode === 'llm') {
                        if (!llmUsable) throw new Error('LLM 精修需要後台已設定 CHAT_MODEL 與對應 API Key');
                        text = await extractWithLLM(text, name, llmConfig);
                    }
                } else if (lower.endsWith('.txt') || lower.endsWith('.md')) {
                    text = Buffer.from(arrayBuffer).toString('utf-8');
                    if (mode === 'llm') {
                        if (!llmUsable) throw new Error('LLM 精修需要後台已設定 CHAT_MODEL 與對應 API Key');
                        text = await extractWithLLM(text, name, llmConfig);
                    }
                } else if (['.png', '.jpg', '.jpeg', '.webp'].some(ext => lower.endsWith(ext))) {
                    // images: use OCR/vision
                    text = await extractImageWithVision(arrayBuffer, name);
                } else {
                    return NextResponse.json({ error: `Unsupported file type: ${name}` }, { status: 400 });
                }
            } catch (stepErr: any) {
                return NextResponse.json({ error: `處理檔案 ${name} 失敗: ${stepErr?.message || stepErr}` }, { status: 500 });
            }

            if (!text.trim()) {
                results.push({ file: name, chunks: 0, status: 'empty', error: parseErr || '無文字可索引，請嘗試 OCR 模式或轉為 TXT' });
                continue;
            }

            const chunks = chunkText(text);
            const docId = nanoid();
            const vectors = [];

            for (let i = 0; i < chunks.length; i++) {
                const c = chunks[i];
                const embedding = await getEmbedding(c.text, {
                    provider: embeddingProvider,
                    geminiApiKey: process.env.GEMINI_API_KEY,
                    openaiApiKey: process.env.OPENAI_API_KEY,
                    openrouterApiKey: process.env.OPENROUTER_API_KEY,
                    pineconeApiKey: pineKey,
                    modelName: embeddingModel,
                });

                const chunkId = `${docId}#${i}`;
                vectors.push({
                    id: chunkId,
                    values: embedding,
                    metadata: {
                        text: c.text,
                        source: name,
                        chunk: i,
                        text_length: c.text.length,
                        indexed_at: Date.now(),
                    },
                });

                await chunkCollection.insertOne({
                    docId,
                    chunkId,
                    source: name,
                    chunk: i,
                    text: c.text,
                    text_length: c.text.length,
                    indexed_at: new Date(),
                });
            }

            if (vectors.length) {
                await pine.upsert(vectors);
            }

            await docCollection.insertOne({
                docId,
                filename: name,
                size: file.size,
                type: lower.split('.').pop(),
                chunks: chunks.length,
                indexedAt: new Date(),
                mode,
            });

            results.push({ file: name, chunks: chunks.length, status: 'ok' });
        }

        return NextResponse.json({ success: true, results });
    } catch (error: any) {
        console.error('Upload error', error);
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
    }
}
