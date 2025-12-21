import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCardsByUser, pruneCards } from '@/lib/features/cards';
import { getMongoClient } from '@/lib/db/mongo';
import { getConfigValue } from '@/lib/config-store';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const getConfig = (key: string) =>
            cookieStore.get(key)?.value || getConfigValue(key) || process.env[key];
        const mongoUri = getConfig('MONGODB_URI');
        const dbName = getConfig('MONGODB_DB_NAME') || 'rag_db';

        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId')
            || cookieStore.get('line_user_id')?.value
            || cookieStore.get('rag_user_id')?.value
            || undefined;
        const limitRaw = searchParams.get('limit');
        const parsedLimit = limitRaw ? parseInt(limitRaw, 10) : 50;
        const limit = Number.isNaN(parsedLimit) ? 50 : parsedLimit;

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const cards = await getCardsByUser(userId, { mongoUri, dbName }, limit);
        return NextResponse.json(cards);
    } catch (err) {
        console.error('Cards GET error', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const getConfig = (key: string) =>
            cookieStore.get(key)?.value || getConfigValue(key) || process.env[key];
        const mongoUri = getConfig('MONGODB_URI');
        const dbName = getConfig('MONGODB_DB_NAME') || 'rag_db';
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
