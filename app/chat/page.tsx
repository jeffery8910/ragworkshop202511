import { cookies } from 'next/headers';
import ChatInterface from '@/components/chat/ChatInterface';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
    const cookieStore = await cookies();
    const chatTitle = 'RAG 工作坊';
    const welcomeMessage = '你好！我是你的 AI 學習助手。有什麼我可以幫你的嗎？';

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
