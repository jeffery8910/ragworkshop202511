import { cookies } from 'next/headers';
import ChatInterface from '@/components/chat/ChatInterface';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
    const cookieStore = await cookies();
    const chatTitle = cookieStore.get('CHAT_TITLE')?.value || 'RAG 工作坊';
    const welcomeMessage = cookieStore.get('WELCOME_MESSAGE')?.value || '你好！我是你的 AI 學習助手。有什麼我可以幫你的嗎？';

    return <ChatInterface chatTitle={chatTitle} welcomeMessage={welcomeMessage} />;
}
