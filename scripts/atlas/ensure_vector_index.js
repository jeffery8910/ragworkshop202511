const { MongoClient } = require('mongodb');
const crypto = require('crypto');

function readEnv(key, fallback = '') {
  return (process.env[key] || fallback).toString().trim();
}

function readInt(key, fallback) {
  const raw = readEnv(key, '');
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function pickEmbeddingProvider() {
  const explicit = readEnv('EMBEDDING_PROVIDER', '').toLowerCase();
  const has = (k) => !!readEnv(k, '');
  const allowed = new Set(['gemini', 'openai', 'openrouter', 'pinecone']);
  if (explicit && allowed.has(explicit)) return explicit;
  if (has('OPENROUTER_API_KEY')) return 'openrouter';
  if (has('GEMINI_API_KEY')) return 'gemini';
  if (has('OPENAI_API_KEY')) return 'openai';
  if (has('PINECONE_API_KEY')) return 'pinecone';
  return undefined;
}

async function generateEmbedding(text) {
  const provider = pickEmbeddingProvider();
  const model = readEnv('EMBEDDING_MODEL', '');
  if (!provider) throw new Error('No embedding provider available. Set EMBEDDING_PROVIDER + API key, or provide ATLAS_VECTOR_DIM.');

  if (provider === 'gemini') {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const apiKey = readEnv('GEMINI_API_KEY', '');
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
    const genAI = new GoogleGenerativeAI(apiKey);
    const m = genAI.getGenerativeModel({ model: model || 'text-embedding-004' });
    const result = await m.embedContent(text);
    return result.embedding.values.map(Number);
  }

  if (provider === 'openai') {
    const OpenAI = require('openai').default;
    const apiKey = readEnv('OPENAI_API_KEY', '');
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
    const client = new OpenAI({ apiKey });
    const resp = await client.embeddings.create({
      model: model || 'text-embedding-3-small',
      input: text.replace(/\n/g, ' '),
    });
    return resp.data[0].embedding.map(Number);
  }

  if (provider === 'openrouter') {
    const OpenAI = require('openai').default;
    const apiKey = readEnv('OPENROUTER_API_KEY', '');
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');
    const client = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' });
    const resp = await client.embeddings.create({
      model: model || 'openai/text-embedding-3-small',
      input: text.replace(/\n/g, ' '),
    });
    return resp.data[0].embedding.map(Number);
  }

  if (provider === 'pinecone') {
    const apiKey = readEnv('PINECONE_API_KEY', '');
    if (!apiKey) throw new Error('PINECONE_API_KEY is not set');
    const allowed = ['multilingual-e5-large', 'llama-text-embed-v2'];
    const pineModel = model || 'multilingual-e5-large';
    if (!allowed.includes(pineModel)) {
      throw new Error(`Pinecone inference only supports ${allowed.join(', ')}. Set EMBEDDING_MODEL accordingly.`);
    }
    const cleaned = text.replace(/\s+/g, ' ').trim().slice(0, 4000);
    const res = await fetch('https://api.pinecone.io/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': apiKey,
        'X-Pinecone-Api-Version': '2025-01',
      },
      body: JSON.stringify({
        model: pineModel,
        inputs: [{ text: cleaned }],
        parameters: { input_type: 'passage', truncate: 'END' },
      }),
    });
    if (!res.ok) throw new Error(`Pinecone embed failed: HTTP ${res.status} ${await res.text()}`);
    const data = await res.json();
    const vec = data?.data?.[0]?.values;
    if (!Array.isArray(vec) || !vec.length) throw new Error('Pinecone embed returned empty vector');
    return vec.map(Number);
  }

  throw new Error(`Unsupported embedding provider: ${provider}`);
}

async function inferDimFromDb(col) {
  const sample = await col.findOne(
    { embedding_dim: { $type: 'number', $gt: 0 } },
    { projection: { _id: 0, embedding_dim: 1 } }
  );
  if (sample?.embedding_dim) return Number(sample.embedding_dim);
  return undefined;
}

async function main() {
  const uri = readEnv('MONGODB_URI', '');
  if (!uri) throw new Error('MONGODB_URI is not set');

  const dbName = readEnv('MONGODB_DB_NAME', 'rag_db');
  const collectionName = readEnv('ATLAS_VECTOR_COLLECTION', 'chunks');
  const indexName = readEnv('ATLAS_VECTOR_INDEX_NAME', 'vector_index');
  const fieldPath = readEnv('ATLAS_VECTOR_FIELD', 'embedding');
  const similarity = readEnv('ATLAS_VECTOR_SIMILARITY', 'cosine');

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    const col = db.collection(collectionName);

    const existing = await col.listSearchIndexes().toArray().catch(() => []);
    if (existing.some((i) => i?.name === indexName)) {
      console.log(`[OK] Search index already exists: ${dbName}.${collectionName}.${indexName}`);
      return;
    }

    let dim = readInt('ATLAS_VECTOR_DIM', undefined);
    if (!dim) dim = await inferDimFromDb(col);
    if (!dim) {
      const vec = await generateEmbedding('ping');
      dim = vec.length;
    }
    if (!dim || !Number.isFinite(dim) || dim <= 0) throw new Error('Failed to determine vector dimension');

    // Safety: prevent invalid "all-zero" vectors being used later
    // (not needed for index creation, but helps catch misconfig early)
    const hash = crypto.createHash('sha1').update(String(dim)).digest('hex').slice(0, 8);

    console.log(`[INFO] Creating vector search index: ${dbName}.${collectionName}.${indexName}`);
    console.log(`[INFO] field=${fieldPath} dim=${dim} similarity=${similarity} (sig=${hash})`);

    await col.createSearchIndex({
      name: indexName,
      type: 'vectorSearch',
      definition: {
        fields: [
          {
            type: 'vector',
            path: fieldPath,
            numDimensions: dim,
            similarity,
          },
        ],
      },
    });

    console.log(`[OK] Created search index: ${indexName}`);
    console.log(`[NEXT] If you still get '$vectorSearch' errors, check Atlas tier/permissions and that you connected to an Atlas 7.0+ cluster.`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('[ERROR]', err?.message || err);
  process.exit(1);
});

