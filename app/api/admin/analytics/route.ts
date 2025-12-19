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

const stopwords = new Set([
    'the', 'and', 'or', 'to', 'a', 'of', 'in', 'is', 'are', 'for', 'with', 'on', 'by', 'an', 'be', 'as', 'at', 'that', 'this', 'it', 'from',
    '請', '我', '你', '他', '她', '它', '的', '了', '嗎', '是', '在', '有', '不', '也', '就', '都', '很', '要', '會', '與', '及', '或', '而', '和'
]);

function extractKeywords(texts: string[], top = 10) {
    const counts = new Map<string, number>();
    const regex = /[A-Za-z0-9]+|[\u4e00-\u9fff]{2,}/g;
    for (const t of texts) {
        const matches = t.match(regex) || [];
        for (const raw of matches) {
            const token = raw.toLowerCase();
            if (token.length < 2) continue;
            if (stopwords.has(token)) continue;
            counts.set(token, (counts.get(token) || 0) + 1);
        }
    }
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, top)
        .map(([word]) => word);
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const rangeDays = Math.min(90, Math.max(3, Number(searchParams.get('range') || '7')));

        const mongoUri = await getConfig('MONGODB_URI');
        const mongoDb = (await getConfig('MONGODB_DB_NAME')) || 'rag_db';
        if (!mongoUri) return NextResponse.json({ error: 'MONGODB_URI not set' }, { status: 400 });

        const client = await getMongoClient(mongoUri);
        const db = client.db(mongoDb);

        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        const sevenDays = 7 * oneDay;

        const since24h = new Date(now - oneDay);
        const since7d = new Date(now - sevenDays);
        const sinceRange = new Date(now - rangeDays * oneDay);

        const totalChats = await db.collection('history').countDocuments({
            role: 'user',
            timestamp: { $gte: since24h }
        });

        const activeUsersAgg = await db.collection('history').aggregate([
            { $match: { timestamp: { $gte: since7d } } },
            { $group: { _id: '$userId' } },
            { $count: 'count' }
        ]).toArray();
        const activeUsers = activeUsersAgg[0]?.count || 0;

        const recentMessages = await db.collection('history')
            .find({ role: 'user' }, { projection: { _id: 0, content: 1 } })
            .sort({ timestamp: -1 })
            .limit(200)
            .toArray();

        const hotKeywords = extractKeywords(recentMessages.map(m => m.content || ''));

        const seriesRaw = await db.collection('history').aggregate([
            { $match: { role: 'user', timestamp: { $gte: sinceRange } } },
            {
                $project: {
                    day: {
                        $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
                    }
                }
            },
            { $group: { _id: '$day', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]).toArray();

        const seriesMap = new Map<string, number>();
        seriesRaw.forEach((r: any) => {
            seriesMap.set(r._id, r.count || 0);
        });

        const series: { date: string; count: number }[] = [];
        for (let i = rangeDays - 1; i >= 0; i--) {
            const d = new Date(now - i * oneDay);
            const key = d.toISOString().slice(0, 10);
            series.push({ date: key, count: seriesMap.get(key) || 0 });
        }

        return NextResponse.json({ activeUsers, totalChats, hotKeywords, series, rangeDays });
    } catch (error: any) {
        console.error('Analytics error', error);
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
    }
}
