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

export async function getCardsByUser(userId: string, opts?: SaveOptions, limit = 20) {
  const client = await getMongoClient(opts?.mongoUri);
  const db = client.db(opts?.dbName || process.env.MONGODB_DB_NAME || 'rag_workshop');
  return db
    .collection('cards')
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}
