const { MongoClient } = require('mongodb');

async function checkDb() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('Error: MONGODB_URI is not set in environment variables.');
        return;
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('Connected to MongoDB successfully.');
        
        const dbName = process.env.MONGODB_DB_NAME || 'rag_db';
        const db = client.db(dbName);
        
        // Check documents collection
        const docCount = await db.collection('documents').countDocuments();
        console.log(`Total documents in '${dbName}.documents': ${docCount}`);
        
        const docs = await db.collection('documents').find().limit(5).toArray();
        console.log('First 5 documents:', JSON.stringify(docs, null, 2));

        // Check chunks collection
        const chunkCount = await db.collection('chunks').countDocuments();
        console.log(`Total chunks in '${dbName}.chunks': ${chunkCount}`);
        
        // Check graph nodes
        const nodeCount = await db.collection('graph_nodes').countDocuments();
        console.log(`Total graph nodes in '${dbName}.graph_nodes': ${nodeCount}`);

    } catch (err) {
        console.error('Database connection error:', err);
    } finally {
        await client.close();
    }
}

checkDb();
