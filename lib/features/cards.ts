import { getMongoClient } from '@/lib/db/mongo';

export type CardPayload =
  | { type: 'quiz'; [key: string]: any }
  | { type: 'summary'; [key: string]: any }
  | { type: 'card'; [key: string]: any }
  | { type: 'card-qa'; [key: string]: any }
  | { type: 'ability'; [key: string]: any }
  | { type: 'mistake'; [key: string]: any };

interface SaveOptions {
  mongoUri?: string;
  dbName?: string;
}

export async function saveCard(userId: string, payload: CardPayload, opts?: SaveOptions) {
  const client = await getMongoClient(opts?.mongoUri);
  const db = client.db(opts?.dbName || process.env.MONGODB_DB_NAME || 'rag_workshop');
  await db.collection('cards').insertOne({
    userId,
    type: payload.type,
    payload,
    createdAt: new Date(),
  });
}

export async function getCardsByUser(userId: string, opts?: SaveOptions, limit = 20, filter?: Record<string, any>) {
  const client = await getMongoClient(opts?.mongoUri);
  const db = client.db(opts?.dbName || process.env.MONGODB_DB_NAME || 'rag_workshop');
  return db
    .collection('cards')
    .find({ userId, ...(filter || {}) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

// Keep only newest N cards per user to avoid bloat
export async function pruneCards(userId: string, maxCount = 50, opts?: SaveOptions) {
  const client = await getMongoClient(opts?.mongoUri);
  const db = client.db(opts?.dbName || process.env.MONGODB_DB_NAME || 'rag_workshop');
  const toDelete = await db.collection('cards')
    .find({ userId })
    .sort({ createdAt: -1 })
    .skip(maxCount)
    .project({ _id: 1 })
    .toArray();
  if (toDelete.length) {
    const ids = toDelete.map(d => d._id);
    await db.collection('cards').deleteMany({ _id: { $in: ids } });
  }
}

// Log parsing / save errors for observability
export async function logCardError(userId: string, error: string, payload?: any, opts?: SaveOptions) {
  const client = await getMongoClient(opts?.mongoUri);
  const db = client.db(opts?.dbName || process.env.MONGODB_DB_NAME || 'rag_workshop');
  await db.collection('card_errors').insertOne({
    userId,
    error,
    payload,
    createdAt: new Date(),
  });
}
