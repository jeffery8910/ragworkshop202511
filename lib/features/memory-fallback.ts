/**
 * JSON 檔案備案儲存方案
 * 當 MongoDB 不可用時，自動降級使用本地 JSON 檔案儲存對話記錄
 */

import { promises as fs } from 'fs';
import path from 'path';

export interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
}

interface ConversationData {
    userId: string;
    title?: string;
    messages: Message[];
    updatedAt: string;
}

interface StorageData {
    conversations: { [userId: string]: ConversationData };
}

// 本地儲存路徑（可透過環境變數自訂）
const STORAGE_DIR = process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), 'data');
const STORAGE_FILE = path.join(STORAGE_DIR, 'conversations.json');

/**
 * 確保儲存目錄存在
 */
async function ensureStorageDir(): Promise<void> {
    try {
        await fs.mkdir(STORAGE_DIR, { recursive: true });
    } catch (err) {
        // 目錄已存在則忽略
    }
}

/**
 * 讀取本地 JSON 資料
 */
async function readStorage(): Promise<StorageData> {
    try {
        await ensureStorageDir();
        const data = await fs.readFile(STORAGE_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        // 檔案不存在或解析失敗，回傳空結構
        return { conversations: {} };
    }
}

/**
 * 寫入本地 JSON 資料
 */
async function writeStorage(data: StorageData): Promise<void> {
    await ensureStorageDir();
    await fs.writeFile(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 儲存訊息到本地 JSON（備案方案）
 */
export async function saveMessageLocal(
    userId: string,
    role: 'user' | 'assistant',
    content: string
): Promise<void> {
    const storage = await readStorage();
    
    if (!storage.conversations[userId]) {
        storage.conversations[userId] = {
            userId,
            messages: [],
            updatedAt: new Date().toISOString()
        };
    }
    
    storage.conversations[userId].messages.push({
        role,
        content,
        timestamp: new Date().toISOString()
    });
    
    // 限制每個用戶最多保存 100 條訊息
    const maxMessages = 100;
    if (storage.conversations[userId].messages.length > maxMessages) {
        storage.conversations[userId].messages = 
            storage.conversations[userId].messages.slice(-maxMessages);
    }
    
    storage.conversations[userId].updatedAt = new Date().toISOString();
    
    await writeStorage(storage);
}

/**
 * 取得對話歷史（備案方案）
 */
export async function getConversationHistoryLocal(
    userId: string,
    limit = 5
): Promise<Message[]> {
    const storage = await readStorage();
    const conversation = storage.conversations[userId];
    
    if (!conversation) {
        return [];
    }
    
    const messages = conversation.messages.slice(-limit);
    return messages.map(msg => ({
        role: msg.role,
        content: msg.content
    }));
}

/**
 * 儲存對話標題（備案方案）
 */
export async function saveConversationTitleLocal(
    userId: string,
    title: string
): Promise<void> {
    const storage = await readStorage();
    
    if (!storage.conversations[userId]) {
        storage.conversations[userId] = {
            userId,
            messages: [],
            updatedAt: new Date().toISOString()
        };
    }
    
    storage.conversations[userId].title = title;
    storage.conversations[userId].updatedAt = new Date().toISOString();
    
    await writeStorage(storage);
}

/**
 * 取得對話標題（備案方案）
 */
export async function getConversationTitleLocal(userId: string): Promise<string | null> {
    const storage = await readStorage();
    return storage.conversations[userId]?.title || null;
}

/**
 * 刪除用戶對話記錄（備案方案）
 */
export async function deleteConversationLocal(userId: string): Promise<void> {
    const storage = await readStorage();
    delete storage.conversations[userId];
    await writeStorage(storage);
}

/**
 * 取得所有對話列表（備案方案）
 */
export async function getAllConversationsLocal(): Promise<ConversationData[]> {
    const storage = await readStorage();
    return Object.values(storage.conversations);
}

/**
 * 匯出用戶對話為 JSON（方便備份）
 */
export async function exportUserConversation(userId: string): Promise<ConversationData | null> {
    const storage = await readStorage();
    return storage.conversations[userId] || null;
}
