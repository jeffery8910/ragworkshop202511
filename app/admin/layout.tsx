import { Suspense } from 'react';
import AdminLayoutClient from '@/components/admin/AdminLayoutClient';

export const dynamic = 'force-dynamic';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-500">載入中...</div>}>
            <AdminLayoutClient>{children}</AdminLayoutClient>
        </Suspense>
    );
}
