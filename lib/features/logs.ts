import clientPromise from '@/lib/db/mongo';

export interface LogEntry {
    type: 'message' | 'reply' | 'error' | 'event';
    userId?: string;
    text?: string;
    timestamp: Date;
    meta?: any;
}

export async function logConversation(entry: Omit<LogEntry, 'timestamp'>) {
    try {
        const client = await clientPromise;
        const db = client.db(process.env.MONGODB_DB_NAME || 'rag_db');
        await db.collection('logs').insertOne({
            ...entry,
            timestamp: new Date()
        });
    } catch (e) {
        console.error('Failed to log conversation:', e);
    }
}
