import { Quiz } from '@/lib/features/quiz';
import { FlexMessage, FlexBubble } from '@line/bot-sdk';

export function createQuizFlexMessage(quiz: Quiz, topic: string): FlexMessage {
    const labels = ['A', 'B', 'C', 'D', 'E'];

    const bubble: FlexBubble = {
        type: 'bubble',
        size: 'mega',
        body: {
            type: 'box',
            layout: 'vertical',
            contents: [
                { type: 'text', text: 'RAG 測驗題', weight: 'bold', size: 'lg', color: '#00C48C' },
                { type: 'text', text: `主題：${topic}`, size: 'sm', color: '#aaaaaa', margin: 'sm', wrap: true },
                { type: 'separator', margin: 'md' },
                { type: 'text', text: quiz.question, wrap: true, margin: 'md', weight: 'bold', size: 'md' },
                {
                    type: 'box',
                    layout: 'vertical',
                    margin: 'md',
                    spacing: 'sm',
                    contents: quiz.options.map((opt, idx) => ({
                        type: 'box',
                        layout: 'baseline',
                        spacing: 'sm',
                        contents: [
                            { type: 'text', text: labels[idx], size: 'sm', color: '#999999', flex: 1 },
                            { type: 'text', text: opt, size: 'sm', color: '#333333', wrap: true, flex: 9 }
                        ]
                    }))
                },
                { type: 'separator', margin: 'md' },
                { type: 'text', text: '請在下方點選答案', size: 'xs', color: '#aaaaaa', margin: 'md', align: 'center' }
            ]
        },
        footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'button',
                    style: 'primary',
                    color: '#00C48C',
                    action: {
                        type: 'postback',
                        label: '查看答案與解析',
                        data: `action=answer&idx=${quiz.correct_index}`
                    }
                }
            ]
        }
    };

    return {
        type: 'flex',
        altText: `測驗：${topic}`,
        contents: bubble
    };
}
