import { NextRequest, NextResponse } from 'next/server';
import { ragAnswer } from '@/lib/rag';

export async function POST(req: NextRequest) {
    try {
        const { message, userId } = await req.json();

        // Use a fixed userId for web demo if not provided
        const uid = userId || 'web-user-demo';

        const result = await ragAnswer(uid, message);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Chat API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
