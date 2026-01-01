import { getMongoClient } from '@/lib/db/mongo';
import { getConfigValue } from '@/lib/config-store';

export interface LogEntry {
    type: 'message' | 'reply' | 'error' | 'event';
    userId?: string;
    text?: string;
    timestamp: Date;
    meta?: any;
}

interface LogOptions {
    mongoUri?: string;
    dbName?: string;
}

export async function logConversation(entry: Omit<LogEntry, 'timestamp'>, opts?: LogOptions) {
    try {
        const client = await getMongoClient(opts?.mongoUri);
        const dbName = opts?.dbName || getConfigValue('MONGODB_DB_NAME') || process.env.MONGODB_DB_NAME || 'rag_db';
        const db = client.db(dbName);
        await db.collection('logs').insertOne({
            ...entry,
            timestamp: new Date()
        });
    } catch (e) {
        console.error('Failed to log conversation:', e);
    }
}
