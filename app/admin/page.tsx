import UploadPanel from '@/components/admin/UploadPanel';
import ConfigPanel from '@/components/admin/ConfigPanel';
import AnalyticsPanel from '@/components/admin/AnalyticsPanel';
import EnvCheck from '@/components/admin/EnvCheck';

export default function AdminPage() {
    // Server-side check of environment variables
    const checkKeys = [
        'MONGODB_URI', 'MONGODB_DB_NAME',
        'PINECONE_API_KEY', 'PINECONE_INDEX_NAME',
        'LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN',
        'ADMIN_PASSWORD',
        'GEMINI_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY',
        'N8N_WEBHOOK_URL'
    ];

    const missingKeys = checkKeys.filter(key => !process.env[key]);

    return (
        <div className="space-y-6">
            <EnvCheck missingKeys={missingKeys} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <AnalyticsPanel />
                    <UploadPanel />
                </div>
                <div className="md:col-span-1">
                    <ConfigPanel />
                </div>
            </div>
        </div>
    );
}
