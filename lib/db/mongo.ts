import { MongoClient } from 'mongodb';

const globalUri = process.env.MONGODB_URI || '';
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

// Cache for dynamic clients to prevent connection leaks
const clientCache: Record<string, Promise<MongoClient> | undefined> = {};

export async function getMongoClient(dynamicUri?: string): Promise<MongoClient> {
    const uri = dynamicUri || globalUri;

    if (!uri) {
        throw new Error('MONGODB_URI is not defined');
    }

    // Return cached promise if exists
    if (clientCache[uri]) {
        return clientCache[uri];
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
    return clientPromise;
}

// Default export for backward compatibility (uses env var)
// We need to handle the case where globalUri is empty to avoid top-level crash
// but still export a promise.
if (globalUri) {
    if (process.env.NODE_ENV === 'development') {
        let globalWithMongo = global as typeof globalThis & {
            _mongoClientPromise?: Promise<MongoClient>;
        };
        if (!globalWithMongo._mongoClientPromise) {
            client = new MongoClient(globalUri, options);
            globalWithMongo._mongoClientPromise = client.connect();
        }
        clientPromise = globalWithMongo._mongoClientPromise;
    } else {
        client = new MongoClient(globalUri, options);
        clientPromise = client.connect();
    }
} else {
    // Return a dummy promise if no env var is set, to satisfy the type
    // This allows the app to build/start, but usage will fail if not configured dynamically
    clientPromise = Promise.resolve({
        db: () => { throw new Error('MONGODB_URI is not defined'); },
        connect: () => Promise.resolve(),
    } as any);
}

export default clientPromise;

