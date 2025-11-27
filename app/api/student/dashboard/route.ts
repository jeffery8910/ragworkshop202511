import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMongoClient } from '@/lib/db/mongo';
import { getCardsByUser } from '@/lib/features/cards';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const mongoUri = cookieStore.get('MONGODB_URI')?.value;
        const dbName = cookieStore.get('MONGODB_DB_NAME')?.value || process.env.MONGODB_DB_NAME || 'rag_workshop';
        const userId = cookieStore.get('line_user_id')?.value || 'web-user-demo';

        const client = await getMongoClient(mongoUri);
        const db = client.db(dbName);

        // Fetch latest student stats
        // In a real app, we would filter by userId. Here we take the latest or a specific demo user.
        const stats = await db.collection('student_stats').findOne({}, { sort: { _id: -1 } });

        // Build topics, mistakes, summaries from cards
        const cards = await getCardsByUser(userId, { mongoUri, dbName }, 30);
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

        const summaryCards = cards.filter(c => c.type === 'summary').map(c => c.payload);

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
                summaries: summaryCards
            });
        }

        return NextResponse.json({
            xp: stats.xp || 0,
            level: stats.level || 1,
            topics,
            mistakes: mistakesOut,
            summaries: summaryCards
        });
    } catch (error) {
        console.error('Failed to fetch student dashboard data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
