import clientPromise from '@/lib/db/mongo';

export interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export async function getConversationHistory(userId: string, limit = 5): Promise<Message[]> {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'rag_db');
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

export async function saveMessage(userId: string, role: 'user' | 'assistant', content: string) {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'rag_db');
    await db.collection('history').insertOne({
        userId,
        role,
        content,
        timestamp: new Date()
    });
}
