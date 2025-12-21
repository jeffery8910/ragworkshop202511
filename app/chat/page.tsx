import { cookies } from 'next/headers';
import { getConfigValue } from '@/lib/config-store';
import ChatInterface from '@/components/chat/ChatInterface';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
    const cookieStore = await cookies();
    const readConfig = (key: string) =>
        cookieStore.get(key)?.value || getConfigValue(key) || process.env[key];
    const chatTitle = readConfig('CHAT_TITLE') || 'RAG 工作坊';
    const welcomeMessage = readConfig('WELCOME_MESSAGE') || '你好！我是你的 AI 學習助手。有什麼我可以幫你的嗎？';

    const lineUserId = cookieStore.get('line_user_id')?.value;
    const lineDisplayName = cookieStore.get('line_display_name')?.value;
    const linePictureUrl = cookieStore.get('line_picture_url')?.value;

    return (
        <ChatInterface
            chatTitle={chatTitle}
            welcomeMessage={welcomeMessage}
            initialUserId={lineUserId}
            initialUserName={lineDisplayName}
            initialUserPicture={linePictureUrl}
        />
    );
}
