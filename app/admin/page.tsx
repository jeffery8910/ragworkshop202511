import UploadPanel from '@/components/admin/UploadPanel';
import ConfigPanel from '@/components/admin/ConfigPanel';
import AnalyticsPanel from '@/components/admin/AnalyticsPanel';

export default function AdminPage() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
                <AnalyticsPanel />
                <UploadPanel />
            </div>
            <div className="md:col-span-1">
                <ConfigPanel />
            </div>
        </div>
    );
}
