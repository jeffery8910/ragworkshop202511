import { cookies } from 'next/headers';
import ChatInterface from '@/components/chat/ChatInterface';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
    const cookieStore = await cookies();
    const chatTitle = cookieStore.get('CHAT_TITLE')?.value || 'RAG 工作坊';

    return <ChatInterface chatTitle={chatTitle} />;
}
