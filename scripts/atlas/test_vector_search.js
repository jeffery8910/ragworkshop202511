const { MongoClient } = require('mongodb');

function readEnv(key, fallback = '') {
  return (process.env[key] || fallback).toString().trim();
}

async function main() {
  const uri = readEnv('MONGODB_URI', '');
  if (!uri) throw new Error('MONGODB_URI is not set');

  const dbName = readEnv('MONGODB_DB_NAME', 'rag_db');
  const collectionName = readEnv('ATLAS_VECTOR_COLLECTION', 'chunks');
  const indexName = readEnv('ATLAS_VECTOR_INDEX_NAME', 'vector_index');

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    const col = db.collection(collectionName);

    const sample = await col.findOne(
      { embedding: { $type: 'array' } },
      { projection: { _id: 0, embedding: 1 } }
    );
    if (!sample?.embedding?.length) {
      throw new Error(
        `No embeddings found in ${dbName}.${collectionName}.embedding. Upload/reindex first (Atlas mode) so chunks have embeddings.`
      );
    }

    const queryVector = sample.embedding.map(Number);
    const t0 = Date.now();
    const results = await col
      .aggregate([
        {
          $vectorSearch: {
            index: indexName,
            path: 'embedding',
            queryVector,
            numCandidates: 20,
            limit: 3,
          },
        },
        {
          $project: {
            _id: 0,
            docId: 1,
            chunkId: 1,
            source: 1,
            chunk: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ])
      .toArray();

    const elapsed = Date.now() - t0;
    console.log(`[OK] $vectorSearch returned ${results.length} results in ${elapsed}ms`);
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('[ERROR]', err?.message || err);
  process.exit(1);
});

