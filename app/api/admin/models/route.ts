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
            // Validate key by calling a current GA model
            const genAI = new GoogleGenerativeAI(apiKey);
            const testModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
            await testModel.generateContent('ping');

            // Try to list models via REST; fall back to curated list if it fails
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
                if (!res.ok) throw new Error(`listModels failed: ${res.status}`);
                const data = await res.json();
                models = (data.models || [])
                    .map((m: any) => m.name?.replace('models/', ''))
                    .filter((name: string) => name.includes('gemini'))
                    .sort();
            } catch (err) {
                models = [
                    'gemini-2.0-flash',
                    'gemini-2.0-flash-001',
                    'gemini-1.5-pro',
                    'gemini-1.5-flash',
                    'text-embedding-004',
                    'text-embedding-003'
                ];
            }
        } else if (provider === 'openai') {
            const openai = new OpenAI({ apiKey });
            try {
                const list = await openai.models.list();
                const chatWhitelist = ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'];
                const embedWhitelist = ['text-embedding-3-large', 'text-embedding-3-small'];
                models = list.data
                    .map(m => m.id)
                    .filter(id =>
                        chatWhitelist.some(c => id.startsWith(c)) ||
                        embedWhitelist.some(e => id.startsWith(e))
                    )
                    .sort();
            } catch (err) {
                models = [
                    'gpt-4.1',
                    'gpt-4.1-mini',
                    'gpt-4o',
                    'gpt-4o-mini',
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
            models = data.data
                .map((m: any) => m.id)
                .filter((id: string) => !id.toLowerCase().includes('embed') && !id.toLowerCase().includes('rerank'))
                .sort();

            // Add a free-tier fallback shortlist for convenience
            const freeDefaults = [
                'mistralai/Mistral-7B-Instruct:free',
                'google/gemma-2-9b-it:free',
                'nousresearch/hermes-2-pro-llama-3-8b:free'
            ];
            freeDefaults.forEach(id => {
                if (!models.includes(id)) models.unshift(id);
            });
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
