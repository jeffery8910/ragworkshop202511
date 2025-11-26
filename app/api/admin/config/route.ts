import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMongoClient } from '@/lib/db/mongo';
import { getPineconeClient } from '@/lib/vector/pinecone';

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
            'LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN',
            'LINE_LOGIN_CHANNEL_ID', 'LINE_LOGIN_CHANNEL_SECRET',
            'GEMINI_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY',
            'EMBEDDING_PROVIDER', 'EMBEDDING_MODEL', 'CHAT_MODEL',
            'RAG_TOP_K',
            'TEMPERATURE', 'PROMPT_TEMPLATE'
        ];

        keys.forEach(key => {
            if (config[key]) {
                cookieStore.set(key, config[key], {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 60 * 60 * 24 * 30, // 30 days
                    path: '/',
                });
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Config save error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
