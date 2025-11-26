import clientPromise, { getMongoClient } from '@/lib/db/mongo';

export interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface DbConfig {
    mongoUri?: string;
    dbName?: string;
}

async function getDb(config?: DbConfig) {
    const client = await getMongoClient(config?.mongoUri);
    const dbName = config?.dbName || process.env.MONGODB_DB_NAME || 'rag_db';
    return client.db(dbName);
}

export async function getConversationHistory(userId: string, limit = 5, config?: DbConfig): Promise<Message[]> {
    const db = await getDb(config);
    const collection = db.collection('history');

    const docs = await collection.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

    return docs.reverse().map(doc => ({
        role: doc.role,
        content: doc.content
    }));
}

export async function saveMessage(userId: string, role: 'user' | 'assistant', content: string, config?: DbConfig) {
    const db = await getDb(config);
    await db.collection('history').insertOne({
        userId,
        role,
        content,
        timestamp: new Date()
    });
}

export async function saveConversationTitle(userId: string, title: string, config?: DbConfig) {
    const db = await getDb(config);
    // Upsert title for the user
    await db.collection('conversations').updateOne(
        { userId },
        { $set: { title, updatedAt: new Date() } },
        { upsert: true }
    );
}

export async function getConversationTitle(userId: string, config?: DbConfig): Promise<string | null> {
    const db = await getDb(config);
    const doc = await db.collection('conversations').findOne({ userId });
    return doc ? doc.title : null;
}
