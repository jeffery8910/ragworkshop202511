import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/db/mongo';
import { saveConversationTitle } from '@/lib/features/memory';

export async function PATCH(req: NextRequest) {
    try {
        const { userId, title } = await req.json();
        if (!userId || !title) {
            return NextResponse.json({ error: 'Missing userId or title' }, { status: 400 });
        }

        await saveConversationTitle(userId, title);
        return NextResponse.json({ success: true, title });
    } catch (error) {
        console.error('Update Title Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db(process.env.MONGODB_DB_NAME || 'rag_db');

        // Delete history
        await db.collection('history').deleteMany({ userId });

        // Optionally delete conversation metadata or just reset it?
        // For now, we just clear history. The title remains or can be reset if needed.

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete History Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
