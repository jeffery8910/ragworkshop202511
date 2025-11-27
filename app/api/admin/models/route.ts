import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
    try {
        const { provider, apiKey } = await req.json();

        if (!apiKey) {
            return NextResponse.json({ error: 'API Key is required' }, { status: 400 });
        }

        let chatModels: string[] = [];
        let embeddingModels: string[] = [];

        if (provider === 'gemini') {
            // Validate key by calling a current GA model
            const genAI = new GoogleGenerativeAI(apiKey);
            const testModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
            await testModel.generateContent('ping');

            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
                if (!res.ok) throw new Error(`listModels failed: ${res.status}`);
                const data = await res.json();
                const names = (data.models || [])
                    .map((m: any) => m.name?.replace('models/', ''))
                    .filter(Boolean) as string[];
                chatModels = names
                    .filter((name) => name.includes('gemini') && !name.toLowerCase().includes('embed'))
                    .sort();
                embeddingModels = names
                    .filter((name) => name.toLowerCase().includes('embed'))
                    .sort();
            } catch (err) {
                chatModels = [
                    'gemini-2.0-flash',
                    'gemini-2.0-flash-001',
                    'gemini-1.5-pro',
                    'gemini-1.5-flash',
                ];
                embeddingModels = [
                    'text-embedding-004',
                    'text-embedding-003'
                ];
            }
        } else if (provider === 'openai') {
            const openai = new OpenAI({ apiKey });
            try {
                const list = await openai.models.list();
                const ids = list.data.map(m => m.id);
                const chatWhitelist = ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'];
                const embedWhitelist = ['text-embedding-3-large', 'text-embedding-3-small'];
                chatModels = ids.filter(id => chatWhitelist.some(c => id.startsWith(c))).sort();
                embeddingModels = ids.filter(id => embedWhitelist.some(e => id.startsWith(e))).sort();
            } catch (err) {
                chatModels = [
                    'gpt-4.1',
                    'gpt-4.1-mini',
                    'gpt-4o',
                    'gpt-4o-mini',
                ];
                embeddingModels = [
                    'text-embedding-3-large',
                    'text-embedding-3-small'
                ];
            }
        } else if (provider === 'openrouter') {
            const res = await fetch('https://openrouter.ai/api/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                }
            });
            if (!res.ok) throw new Error('Failed to fetch OpenRouter models');
            const data = await res.json();
            const ids = data.data.map((m: any) => m.id) as string[];
            chatModels = ids
                .filter(id => !id.toLowerCase().includes('embed') && !id.toLowerCase().includes('rerank'))
                .sort();
            embeddingModels = ids
                .filter(id => id.toLowerCase().includes('embed'))
                .sort();

            // Add a free-tier fallback shortlist for convenience
            const freeDefaults = [
                'mistralai/Mistral-7B-Instruct:free',
                'google/gemma-2-9b-it:free',
                'nousresearch/hermes-2-pro-llama-3-8b:free'
            ];
            freeDefaults.forEach(id => {
                if (!chatModels.includes(id)) chatModels.unshift(id);
            });
        } else if (provider === 'pinecone') {
            // Pinecone inference curated list (no public list API yet) - embedding only
            embeddingModels = [
                'multilingual-e5-large',
                'llama-text-embed-v2',
                'jina-embeddings-v4',
                'bge-m3'
            ];
        } else {
            return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
        }

        return NextResponse.json({ chatModels, embeddingModels });
    } catch (error) {
        console.error('Model fetch error:', error);
        const message = error instanceof Error ? error.message : '模型列表取得失敗，請檢查 API Key';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
