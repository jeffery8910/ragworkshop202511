import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMongoClient } from '@/lib/db/mongo';
import { getPineconeClient } from '@/lib/vector/pinecone';
import { saveConfig } from '@/lib/config-store';

export async function POST(req: NextRequest) {
    try {
        const config = await req.json();
        const cookieStore = await cookies();

        // 1. Validate MongoDB Connection
        if (config.MONGODB_URI) {
            try {
                const client = await getMongoClient(config.MONGODB_URI);
                // Ping to verify connection
                await client.db('admin').command({ ping: 1 });
            } catch (error) {
                return NextResponse.json({ error: 'MongoDB 連線失敗，請檢查 URI 是否正確' }, { status: 400 });
            }
        }

        // 2. Validate Pinecone Connection (Optional but recommended)
        if (config.PINECONE_API_KEY) {
            try {
                // Just try to initialize, maybe list indexes if possible, but for now just init is enough check for format
                await getPineconeClient(config.PINECONE_API_KEY);
            } catch (error) {
                return NextResponse.json({ error: 'Pinecone API Key 格式錯誤' }, { status: 400 });
            }
        }

        // 3. Save to Cookies
        // We iterate over the config object and set cookies for each key
        const keys = [
            'MONGODB_URI', 'MONGODB_DB_NAME',
            'PINECONE_API_KEY', 'PINECONE_INDEX_NAME',
            'VECTOR_STORE_PROVIDER', 'ATLAS_VECTOR_INDEX_NAME',
            'LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN',
            'LINE_LOGIN_CHANNEL_ID', 'LINE_LOGIN_CHANNEL_SECRET',
            'GEMINI_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY',
            'EMBEDDING_PROVIDER', 'EMBEDDING_MODEL', 'CHAT_MODEL',
            'CHAT_TITLE', 'WELCOME_MESSAGE',
            'RAG_TOP_K',
            'TEMPERATURE', 'PROMPT_TEMPLATE',
            'N8N_WEBHOOK_URL'
        ];

        const res = NextResponse.json({ success: true });
        const isHttps = req.headers.get('x-forwarded-proto') === 'https';
        const secure = process.env.NODE_ENV === 'production' ? isHttps : false;

        // Persist to in-memory store as fallback for server-only requests
        saveConfig(config);

        keys.forEach(key => {
            if (Object.prototype.hasOwnProperty.call(config, key)) {
                const value = config[key];
                if (value === '' || value === null || value === undefined) {
                    res.cookies.set(key, '', {
                        httpOnly: true,
                        secure,
                        sameSite: 'lax',
                        maxAge: 0,
                        path: '/',
                    });
                } else {
                    res.cookies.set(key, String(value), {
                        httpOnly: true,
                        secure,
                        sameSite: 'lax',
                        maxAge: 60 * 60 * 24 * 30, // 30 days
                        path: '/',
                    });
                }
            }
        });

        return res;
    } catch (error) {
        console.error('Config save error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
