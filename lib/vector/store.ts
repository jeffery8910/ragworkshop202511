export type VectorStoreProvider = 'pinecone' | 'atlas';

export function normalizeVectorStoreProvider(value?: string): VectorStoreProvider | undefined {
    const v = (value || '').trim().toLowerCase();
    if (!v) return undefined;
    if (v === 'pinecone') return 'pinecone';
    if (v === 'atlas' || v === 'mongodb' || v === 'mongo') return 'atlas';
    return undefined;
}

export function resolveVectorStoreProvider(opts: {
    explicit?: string;
    pineconeApiKey?: string;
    mongoUri?: string;
}): VectorStoreProvider | undefined {
    const explicit = normalizeVectorStoreProvider(opts.explicit);
    if (explicit) return explicit;
    if (opts.pineconeApiKey) return 'pinecone';
    if (opts.mongoUri) return 'atlas';
    return undefined;
}

export function getAtlasVectorIndexName(explicit?: string) {
    return (explicit || process.env.ATLAS_VECTOR_INDEX_NAME || 'vector_index').trim() || 'vector_index';
}

