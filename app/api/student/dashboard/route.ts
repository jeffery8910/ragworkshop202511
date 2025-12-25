import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMongoClient } from '@/lib/db/mongo';
import { getCardsByUser } from '@/lib/features/cards';
import { getConfigValue } from '@/lib/config-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const getConfig = (key: string) =>
            cookieStore.get(key)?.value || getConfigValue(key) || process.env[key];
        const mongoUri = getConfig('MONGODB_URI');
        const dbName = getConfig('MONGODB_DB_NAME') || 'rag_db';

        const { searchParams } = new URL(req.url);
        const userId =
            cookieStore.get('line_user_id')?.value
            || searchParams.get('userId')
            || cookieStore.get('rag_user_id')?.value
            || '';

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const client = await getMongoClient(mongoUri);
        const db = client.db(dbName);

        // Fetch latest student stats
        const statsByUser = await db.collection('student_stats').findOne({ userId }, { sort: { _id: -1 } });
        const stats = statsByUser || await db.collection('student_stats').findOne({}, { sort: { _id: -1 } });

        // Build topics, mistakes, summaries from cards
        const cards = await getCardsByUser(userId, { mongoUri, dbName }, 100);
        const latestAbility = cards.find(c => c.type === 'ability');
        const abilityTopics = latestAbility?.payload?.topics?.map((t: any) => ({
            name: t.name,
            level: Number(t.level) || 1,
            progress: typeof t.progress === 'number' ? t.progress : 50
        })) || [];

        const mistakeCards = cards.filter(c => c.type === 'mistake');
        const mistakes = mistakeCards.flatMap((m: any) =>
            (m.payload?.items || []).map((i: any, idx: number) => ({
                id: idx,
                topic: i.topic || (m.payload?.title ?? '錯題'),
                question: i.question,
                reason: i.reason || '',
                suggestion: i.suggestion || ''
            }))
        );

        const summaryCards = cards
            .filter(c => c.type === 'summary')
            .slice(0, 5)
            .map(c => c.payload);

        // fallback to stats if no card data
        const topics = abilityTopics.length ? abilityTopics : (stats?.topics || []);
        const mistakesOut = mistakes.length ? mistakes : (stats?.mistakes || []);

        if (!stats) {
            // Return default data if no DB record exists
            return NextResponse.json({
                xp: 0,
                level: 1,
                topics,
                mistakes: mistakesOut,
                summaries: summaryCards,
                updatedAt: new Date().toISOString()
            });
        }

        return NextResponse.json({
            xp: stats.xp || 0,
            level: stats.level || 1,
            topics,
            mistakes: mistakesOut,
            summaries: summaryCards,
            updatedAt: stats?.updatedAt || stats?._id?.getTimestamp?.()?.toISOString?.() || new Date().toISOString()
        });
    } catch (error) {
        console.error('Failed to fetch student dashboard data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
