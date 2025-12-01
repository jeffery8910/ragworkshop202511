import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
    const cookieStore = await cookies();
    
    const keys = [
        'MONGODB_URI',
        'MONGODB_DB_NAME',
        'PINECONE_API_KEY',
        'PINECONE_INDEX_NAME',
        'GEMINI_API_KEY',
        'OPENAI_API_KEY',
        'OPENROUTER_API_KEY',
        'EMBEDDING_PROVIDER',
        'EMBEDDING_MODEL',
    ];

    const debug: Record<string, any> = {
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        sources: {}
    };

    keys.forEach(key => {
        const envVal = process.env[key];
        const cookieVal = cookieStore.get(key)?.value;
        
        debug.sources[key] = {
            fromEnv: envVal ? `${envVal.substring(0, 20)}... (length: ${envVal.length})` : null,
            fromCookie: cookieVal ? `${cookieVal.substring(0, 20)}... (length: ${cookieVal.length})` : null,
            hasEnv: !!envVal,
            hasCookie: !!cookieVal,
        };
    });

    return NextResponse.json(debug, { status: 200 });
}
