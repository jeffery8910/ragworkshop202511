import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCardsByUser, pruneCards } from '@/lib/features/cards';
import { getMongoClient } from '@/lib/db/mongo';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const mongoUri = cookieStore.get('MONGODB_URI')?.value;
        const dbName = cookieStore.get('MONGODB_DB_NAME')?.value || process.env.MONGODB_DB_NAME || 'rag_workshop';

        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId') || undefined;
        const limit = Number(searchParams.get('limit') || 50);

        const cards = await getCardsByUser(userId || 'web-user-demo', { mongoUri, dbName }, limit);
        return NextResponse.json(cards);
    } catch (err) {
        console.error('Cards GET error', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const mongoUri = cookieStore.get('MONGODB_URI')?.value;
        const dbName = cookieStore.get('MONGODB_DB_NAME')?.value || process.env.MONGODB_DB_NAME || 'rag_workshop';
        const { id, userId } = await req.json();
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

        const client = await getMongoClient(mongoUri);
        const db = client.db(dbName);
        await db.collection('cards').deleteOne({ _id: new ObjectId(id) });

        // optional prune to keep tidy
        if (userId) await pruneCards(userId, 50, { mongoUri, dbName });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Cards DELETE error', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
