import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMongoClient } from '@/lib/db/mongo';
import { getConfigValue } from '@/lib/config-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const getConfig = async (key: string) => {
    const cookieStore = await cookies();
    return cookieStore.get(key)?.value || process.env[key] || getConfigValue(key) || '';
};

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const rangeDays = Math.min(90, Math.max(3, Number(searchParams.get('range') || '14')));
        const inactiveDays = Math.min(60, Math.max(1, Number(searchParams.get('inactive') || '7')));
        const minMessages = Math.min(50, Math.max(0, Number(searchParams.get('minMessages') || '3')));

        const mongoUri = await getConfig('MONGODB_URI');
        const mongoDb = (await getConfig('MONGODB_DB_NAME')) || 'rag_db';
        if (!mongoUri) return NextResponse.json({ error: 'MONGODB_URI not set' }, { status: 400 });

        const client = await getMongoClient(mongoUri);
        const db = client.db(mongoDb);

        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        const sinceRange = new Date(now - rangeDays * oneDay);

        const eventNames = ['dashboard_view', 'quiz_generate', 'flashcard_generate', 'workshop_open', 'workshop_compare', 'chat_open'];
        const eventCounters = eventNames.reduce((acc: Record<string, any>, name) => {
            acc[name] = {
                $sum: {
                    $cond: [
                        {
                            $and: [
                                { $eq: ['$type', 'event'] },
                                { $eq: ['$meta.event', name] },
                            ],
                        },
                        1,
                        0,
                    ],
                },
            };
            return acc;
        }, {});

        const pipeline: any[] = [
            {
                $match: {
                    timestamp: { $gte: sinceRange },
                    userId: { $nin: [null, ''] },
                },
            },
            {
                $group: {
                    _id: '$userId',
                    lastActiveAt: { $max: '$timestamp' },
                    totalEvents: { $sum: 1 },
                    messageCount: { $sum: { $cond: [{ $eq: ['$type', 'message'] }, 1, 0] } },
                    replyCount: { $sum: { $cond: [{ $eq: ['$type', 'reply'] }, 1, 0] } },
                    errorCount: { $sum: { $cond: [{ $eq: ['$type', 'error'] }, 1, 0] } },
                    eventCount: { $sum: { $cond: [{ $eq: ['$type', 'event'] }, 1, 0] } },
                    ...eventCounters,
                },
            },
            { $sort: { lastActiveAt: -1 } },
        ];

        const rows = await db.collection('logs').aggregate(pipeline).toArray();

        const students = rows.map((row: any) => {
            const lastActive = row.lastActiveAt ? new Date(row.lastActiveAt) : null;
            const daysSince = lastActive ? Math.floor((now - lastActive.getTime()) / oneDay) : null;
            const reasons: string[] = [];
            if (daysSince === null || daysSince >= inactiveDays) {
                reasons.push(`超過 ${inactiveDays} 天未活動`);
            }
            if ((row.messageCount || 0) < minMessages) {
                reasons.push(`最近 ${rangeDays} 天訊息 ${row.messageCount || 0} 次`);
            }
            if ((row.errorCount || 0) >= 3) {
                reasons.push(`錯誤事件 ${row.errorCount} 次`);
            }

            const events: Record<string, number> = {};
            eventNames.forEach(name => {
                events[name] = row[name] || 0;
            });

            return {
                userId: row._id,
                lastActiveAt: lastActive ? lastActive.toISOString() : null,
                daysSince,
                totalEvents: row.totalEvents || 0,
                messageCount: row.messageCount || 0,
                replyCount: row.replyCount || 0,
                errorCount: row.errorCount || 0,
                eventCount: row.eventCount || 0,
                events,
                needsAttention: reasons.length > 0,
                reasons,
            };
        });

        const needsAttentionCount = students.filter(s => s.needsAttention).length;
        return NextResponse.json({
            rangeDays,
            inactiveDays,
            minMessages,
            totalStudents: students.length,
            needsAttention: needsAttentionCount,
            students,
        });
    } catch (error: any) {
        console.error('Student monitor error', error);
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
    }
}
