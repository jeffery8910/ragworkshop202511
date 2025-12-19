import { MongoClient } from 'mongodb';
import { getConfigValue } from '@/lib/config-store';

const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient> | null = null;

// Cache for dynamic clients to prevent connection leaks
const clientCache: Record<string, Promise<MongoClient> | undefined> = {};

export async function getMongoClient(dynamicUri?: string): Promise<MongoClient> {
    const fallbackUri = getConfigValue('MONGODB_URI') || process.env.MONGODB_URI || '';
    const uri = dynamicUri || fallbackUri;

    if (!uri) {
        throw new Error('MONGODB_URI is not defined');
    }

    // Return cached promise if exists
    if (clientCache[uri]) {
        return clientCache[uri]!;
    }

    if (process.env.NODE_ENV === 'development') {
        // In development mode, use a global variable so that the value
        // is preserved across module reloads caused by HMR (Hot Module Replacement).
        let globalWithMongo = global as typeof globalThis & {
            _mongoClientPromise?: Promise<MongoClient>;
        };

        if (!globalWithMongo._mongoClientPromise) {
            client = new MongoClient(uri, options);
            globalWithMongo._mongoClientPromise = client.connect();
        }
        clientPromise = globalWithMongo._mongoClientPromise;
    } else {
        // In production mode, it's best to not use a global variable.
        client = new MongoClient(uri, options);
        clientPromise = client.connect();
    }

    clientCache[uri] = clientPromise;
    return clientPromise!;
}

// Default export for backward compatibility: returns a lazy promise that won't throw until actually used
// This allows the calling code to handle missing MONGODB_URI gracefully
// NOTE: Avoid default export that executes at import time; call getMongoClient() explicitly.

