import AnalyticsPanel from '@/components/admin/AnalyticsPanel';
import UploadPanel from '@/components/admin/UploadPanel';
import ConfigPanel from '@/components/admin/ConfigPanel';
import EnvCheck from '@/components/admin/EnvCheck';
import SetupPanel from '@/components/admin/SetupPanel';
import RagLabPanel from '@/components/admin/RagLabPanel';
import KnowledgeGraph from '@/components/admin/KnowledgeGraph';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
    // Server-side check of environment variables
    const checkKeys = [
        'MONGODB_URI', 'MONGODB_DB_NAME',
        'PINECONE_API_KEY', 'PINECONE_INDEX_NAME',
        'LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN',
        'ADMIN_PASSWORD'
    ];

    const missingKeys = checkKeys.filter(key => !process.env[key]);

    return (
        <div className="space-y-6">
            <SetupPanel />
            <RagLabPanel />
            <EnvCheck missingKeys={missingKeys} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AnalyticsPanel />
                <div className="space-y-6">
                    <ConfigPanel />
                    <KnowledgeGraph />
                </div>
            </div>

            <UploadPanel />
        </div>
    );
}
