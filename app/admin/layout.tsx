import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Note: Basic Auth is usually handled at middleware or edge, 
    // but for simple app router, we can check headers or use middleware.
    // Since we can't easily do Basic Auth prompt in Layout (it needs to be response),
    // we usually use Middleware.ts.
    // For now, let's assume Middleware handles it or we use a simple login page.
    // BUT, to keep it simple and "Basic Auth" style, Middleware is best.

    return (
        <div className="min-h-screen bg-gray-100">
            <nav className="bg-white shadow-sm p-4">
                <div className="container mx-auto flex justify-between">
                    <h1 className="text-xl font-bold">RAG Admin</h1>
                    <div className="space-x-4">
                        <a href="/admin" className="text-gray-600 hover:text-black">Dashboard</a>
                        <a href="/admin/status" className="text-gray-600 hover:text-black">Status</a>
                    </div>
                </div>
            </nav>
            <main className="container mx-auto p-4">
                {children}
            </main>
        </div>
    );
}
