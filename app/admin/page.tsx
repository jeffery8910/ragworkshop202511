import AdminDashboard from '@/components/admin/AdminDashboard';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { getConfigValue } from '@/lib/config-store';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
    const cookieStore = await cookies();

    // Server-side check of environment variables
    // We check ALL keys here so EnvCheck knows what's missing
    const checkKeys = [
        'MONGODB_URI', 'MONGODB_DB_NAME',
        'PINECONE_API_KEY', 'PINECONE_INDEX_NAME',
        'VECTOR_STORE_PROVIDER', 'ATLAS_VECTOR_INDEX_NAME',
        'LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN',
        'LINE_LOGIN_CHANNEL_ID', 'LINE_LOGIN_CHANNEL_SECRET',
        'ADMIN_PASSWORD',
        'GEMINI_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY',
        'N8N_WEBHOOK_URL',
        'EMBEDDING_PROVIDER', 'EMBEDDING_MODEL', 'CHAT_MODEL',
        'CHAT_TITLE', 'WELCOME_MESSAGE',
        'RAG_TOP_K', 'TEMPERATURE', 'PROMPT_TEMPLATE'
    ];

    const missingKeys = checkKeys.filter(key => {
        const envVal = process.env[key]?.trim();
        const cookieVal = cookieStore.get(key)?.value?.trim();
        const storeVal = (getConfigValue(key) || '')?.toString().trim();
        const hasEnv = !!envVal && envVal.length > 0;
        const hasCookie = !!cookieVal && cookieVal.length > 0;
        const hasStore = !!storeVal && storeVal.length > 0;
        return !hasEnv && !hasCookie && !hasStore;
    });

    // Prepare initial config for client components
    const initialConfig: Record<string, string> = {};
    checkKeys.forEach(key => {
        initialConfig[key] = cookieStore.get(key)?.value || getConfigValue(key) || process.env[key] || '';
    });

    return (
        <Suspense fallback={<div className="p-6">載入中...</div>}>
            <AdminDashboard missingKeys={missingKeys} initialConfig={initialConfig} />
        </Suspense>
    );
}
