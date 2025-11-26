import { NextResponse } from 'next/server';
import clientPromise from '@/lib/db/mongo';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const client = await clientPromise;
        const db = client.db(process.env.MONGODB_DB_NAME || 'rag_workshop');

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
