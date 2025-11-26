import { NextRequest, NextResponse } from 'next/server';
import { generateRagQuiz } from '@/lib/features/quiz';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get('topic');

    if (!topic) {
        return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    const quiz = await generateRagQuiz(topic);
    return NextResponse.json(quiz);
}
