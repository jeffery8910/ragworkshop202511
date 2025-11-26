import { NextRequest, NextResponse } from 'next/server';
import { generateFlashcard } from '@/lib/features/flashcard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get('topic');

    if (!topic) {
        return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    const flashcard = await generateFlashcard(topic);
    return NextResponse.json(flashcard);
}
