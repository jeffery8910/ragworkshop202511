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

async function extractPdf(buffer: ArrayBuffer) {
    // pdfjs (pdf-parse) requires DOMMatrix in Node; provide a light stub to avoid native deps.
    if (!(global as any).DOMMatrix) {
        (global as any).DOMMatrix = class DOMMatrix {
            constructor() { }
        } as any;
    }
    const mod = await import('pdf-parse');
    const pdfParse = (mod as any).default || (mod as any);
    const data = await pdfParse(Buffer.from(buffer));
    return data.text as string;
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

async function extractWithLLM(text: string, fileName: string) {
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const instruction = `整理以下文件內容，輸出乾淨純文字。不要摘要，保留所有可讀文本，移除多餘空白。`;
    if (openaiKey) {
        const OpenAI = (await import('openai')).default;
        const client = new OpenAI({ apiKey: openaiKey });
        const res = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: instruction },
                { role: 'user', content: text.slice(0, 12000) },
            ],
            max_tokens: 6000,
        });
        return res.choices[0]?.message?.content ?? text;
    }
    if (geminiKey) {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const res = await model.generateContent([instruction, text.slice(0, 12000)]);
        return res.response.text();
    }
    throw new Error(`No LLM key (Gemini/OpenAI) to清理檔案 ${fileName}`);
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

        const results = [];

        for (const file of files) {
            const arrayBuffer = await file.arrayBuffer();
            const name = file.name;
            const lower = name.toLowerCase();
            let text = '';

            if (lower.endsWith('.pdf')) {
                text = await extractPdf(arrayBuffer);
                if (mode === 'llm') {
                    text = await extractWithLLM(text, name);
                }
            } else if (lower.endsWith('.txt') || lower.endsWith('.md')) {
                text = Buffer.from(arrayBuffer).toString('utf-8');
                if (mode === 'llm') {
                    text = await extractWithLLM(text, name);
                }
            } else if (['.png', '.jpg', '.jpeg', '.webp'].some(ext => lower.endsWith(ext))) {
                // images: use OCR/vision
                text = await extractImageWithVision(arrayBuffer, name);
            } else {
                return NextResponse.json({ error: `Unsupported file type: ${name}` }, { status: 400 });
            }

            if (!text.trim()) {
                results.push({ file: name, chunks: 0, status: 'empty' });
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
