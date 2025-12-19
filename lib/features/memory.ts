import { getMongoClient } from '@/lib/db/mongo';
import {
    saveMessageLocal,
    getConversationHistoryLocal,
    saveConversationTitleLocal,
    getConversationTitleLocal,
    deleteConversationLocal,
    type Message as LocalMessage
} from './memory-fallback';

export interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface DbConfig {
    mongoUri?: string;
    dbName?: string;
    // 是否強制使用本地儲存（用於測試或無 MongoDB 環境）
    forceLocal?: boolean;
}

/**
 * 檢查 MongoDB 是否可用
 */
async function isMongoAvailable(config?: DbConfig): Promise<boolean> {
    if (config?.forceLocal) {
        return false;
    }

    const uri = config?.mongoUri || process.env.MONGODB_URI;
    if (!uri) {
        return false;
    }

    try {
        const client = await getMongoClient(uri);
        // 嘗試 ping 一下確認連線
        await client.db('admin').command({ ping: 1 });
        return true;
    } catch (err) {
        console.warn('[Memory] MongoDB 不可用，降級使用本地 JSON 儲存:', err);
        return false;
    }
}

async function getDb(config?: DbConfig) {
    const client = await getMongoClient(config?.mongoUri);
    const dbName = config?.dbName || process.env.MONGODB_DB_NAME || 'rag_db';
    return client.db(dbName);
}

/**
 * 取得對話歷史（自動選擇 MongoDB 或本地 JSON）
 */
export async function getConversationHistory(userId: string, limit = 5, config?: DbConfig): Promise<Message[]> {
    const mongoAvailable = await isMongoAvailable(config);

    if (!mongoAvailable) {
        console.log('[Memory] 使用本地 JSON 儲存取得對話歷史');
        return getConversationHistoryLocal(userId, limit);
    }

    try {
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
    } catch (err) {
        console.warn('[Memory] MongoDB 查詢失敗，降級使用本地儲存:', err);
        return getConversationHistoryLocal(userId, limit);
    }
}

/**
 * 儲存訊息（自動選擇 MongoDB 或本地 JSON）
 */
export async function saveMessage(userId: string, role: 'user' | 'assistant', content: string, config?: DbConfig) {
    const mongoAvailable = await isMongoAvailable(config);

    if (!mongoAvailable) {
        console.log('[Memory] 使用本地 JSON 儲存訊息');
        return saveMessageLocal(userId, role, content);
    }

    try {
        const db = await getDb(config);
        await db.collection('history').insertOne({
            userId,
            role,
            content,
            timestamp: new Date()
        });
    } catch (err) {
        console.warn('[Memory] MongoDB 儲存失敗，降級使用本地儲存:', err);
        await saveMessageLocal(userId, role, content);
    }
}

/**
 * 儲存對話標題（自動選擇 MongoDB 或本地 JSON）
 */
export async function saveConversationTitle(userId: string, title: string, config?: DbConfig) {
    const mongoAvailable = await isMongoAvailable(config);

    if (!mongoAvailable) {
        console.log('[Memory] 使用本地 JSON 儲存對話標題');
        return saveConversationTitleLocal(userId, title);
    }

    try {
        const db = await getDb(config);
        // Upsert title for the user
        await db.collection('conversations').updateOne(
            { userId },
            { $set: { title, updatedAt: new Date() } },
            { upsert: true }
        );
    } catch (err) {
        console.warn('[Memory] MongoDB 標題儲存失敗，降級使用本地儲存:', err);
        await saveConversationTitleLocal(userId, title);
    }
}

/**
 * 取得對話標題（自動選擇 MongoDB 或本地 JSON）
 */
export async function getConversationTitle(userId: string, config?: DbConfig): Promise<string | null> {
    const mongoAvailable = await isMongoAvailable(config);

    if (!mongoAvailable) {
        return getConversationTitleLocal(userId);
    }

    try {
        const db = await getDb(config);
        const doc = await db.collection('conversations').findOne({ userId });
        return doc ? doc.title : null;
    } catch (err) {
        console.warn('[Memory] MongoDB 標題查詢失敗，降級使用本地儲存:', err);
        return getConversationTitleLocal(userId);
    }
}

/**
 * 刪除用戶對話記錄（自動選擇 MongoDB 或本地 JSON）
 */
export async function deleteConversation(userId: string, config?: DbConfig): Promise<void> {
    const mongoAvailable = await isMongoAvailable(config);

    if (!mongoAvailable) {
        return deleteConversationLocal(userId);
    }

    try {
        const db = await getDb(config);
        await db.collection('history').deleteMany({ userId });
        await db.collection('conversations').deleteOne({ userId });
    } catch (err) {
        console.warn('[Memory] MongoDB 刪除失敗，降級使用本地儲存:', err);
        await deleteConversationLocal(userId);
    }
}

/**
 * 取得目前使用的儲存類型
 */
export async function getStorageType(config?: DbConfig): Promise<'mongodb' | 'local'> {
    const mongoAvailable = await isMongoAvailable(config);
    return mongoAvailable ? 'mongodb' : 'local';
}
