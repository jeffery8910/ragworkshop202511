import AdminDashboard from '@/components/admin/AdminDashboard';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
    const cookieStore = await cookies();

    // Server-side check of environment variables
    // We check ALL keys here so EnvCheck knows what's missing
    const checkKeys = [
        'MONGODB_URI', 'MONGODB_DB_NAME',
        'PINECONE_API_KEY', 'PINECONE_INDEX_NAME',
        'LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN',
        'ADMIN_PASSWORD',
        // Optional keys (checked here so they appear in EnvCheck correctly)
        'GEMINI_API_KEY',
        'OPENAI_API_KEY',
        'OPENROUTER_API_KEY',
        'N8N_WEBHOOK_URL'
    ];

    const missingKeys = checkKeys.filter(key => {
        const inEnv = !!process.env[key];
        const inCookie = !!cookieStore.get(key)?.value;
        return !inEnv && !inCookie;
    });

    return <AdminDashboard missingKeys={missingKeys} />;
}
