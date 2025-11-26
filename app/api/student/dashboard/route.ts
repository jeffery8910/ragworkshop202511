import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMongoClient } from '@/lib/db/mongo';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const mongoUri = cookieStore.get('MONGODB_URI')?.value;
        const dbName = cookieStore.get('MONGODB_DB_NAME')?.value || process.env.MONGODB_DB_NAME || 'rag_workshop';

        const client = await getMongoClient(mongoUri);
        const db = client.db(dbName);

        // Fetch latest student stats
        // In a real app, we would filter by userId. Here we take the latest or a specific demo user.
        const stats = await db.collection('student_stats').findOne({}, { sort: { _id: -1 } });

        if (!stats) {
            // Return default data if no DB record exists
            return NextResponse.json({
                xp: 0,
                level: 1,
                topics: [],
                mistakes: []
            });
        }

        return NextResponse.json({
            xp: stats.xp || 0,
            level: stats.level || 1,
            topics: stats.topics || [],
            mistakes: stats.mistakes || []
        });
    } catch (error) {
        console.error('Failed to fetch student dashboard data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
