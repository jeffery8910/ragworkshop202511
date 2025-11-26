import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
    try {
        const { provider, apiKey } = await req.json();

        if (!apiKey) {
            return NextResponse.json({ error: 'API Key is required' }, { status: 400 });
        }

        let models: string[] = [];

        if (provider === 'gemini') {
            // Gemini doesn't have a simple list models API in the node SDK that returns clean names easily without full metadata,
            // but we can try to list them or return a static list of known good models if listing fails or is too complex.
            // Actually, genAI.getGenerativeModel is for getting a model, not listing.
            // We can use the REST API or just validate the key by trying to embed/generate with a default model.
            // However, the user wants to SELECT models.
            // Let's try to list models if possible, otherwise return a curated list.
            // GoogleGenerativeAI SDK doesn't seem to expose listModels directly in the main class easily in all versions.
            // Let's assume a curated list for now to ensure stability, or try a dummy call to verify key.

            // Verification: Try to create a model and run a dummy prompt.
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            await model.generateContent('Hi'); // Test connection

            // If success, return curated list
            models = [
                'gemini-1.5-flash',
                'gemini-1.5-pro',
                'gemini-1.0-pro',
                'text-embedding-004'
            ];
        } else if (provider === 'openai') {
            const openai = new OpenAI({ apiKey });
            const list = await openai.models.list();
            models = list.data.map(m => m.id).filter(id =>
                id.startsWith('gpt') || id.startsWith('text-embedding')
            ).sort();
        } else if (provider === 'openrouter') {
            const res = await fetch('https://openrouter.ai/api/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                }
            });
            if (!res.ok) throw new Error('Failed to fetch OpenRouter models');
            const data = await res.json();
            models = data.data.map((m: any) => m.id).sort();
        } else {
            return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
        }

        return NextResponse.json({ models });
    } catch (error) {
        console.error('Model fetch error:', error);
        const message = error instanceof Error ? error.message : '連線失敗或 API Key 無效';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
