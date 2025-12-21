import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getConfigValue } from '@/lib/config-store';
import {
    saveConversationTitle,
    getConversationHistory,
    getConversationTitle,
    deleteConversation,
    getStorageType
} from '@/lib/features/memory';

const resolveDbConfig = async () => {
    const cookieStore = await cookies();
    const readConfig = (key: string) =>
        cookieStore.get(key)?.value || getConfigValue(key) || process.env[key];
    return {
        mongoUri: readConfig('MONGODB_URI'),
        dbName: readConfig('MONGODB_DB_NAME')
    };
};

const resolveUserId = async (req: NextRequest) => {
    const cookieStore = await cookies();
    const { searchParams } = new URL(req.url);
    return (
        searchParams.get('userId') ||
        cookieStore.get('line_user_id')?.value ||
        cookieStore.get('rag_user_id')?.value ||
        ''
    );
};

export async function GET(req: NextRequest) {
    try {
        const userId = await resolveUserId(req);
        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const limitRaw = searchParams.get('limit');
        const limit = limitRaw ? Math.max(1, parseInt(limitRaw, 10)) : 50;

        const dbConfig = await resolveDbConfig();
        const [messages, title, storage] = await Promise.all([
            getConversationHistory(userId, Number.isNaN(limit) ? 50 : limit, {
                mongoUri: dbConfig.mongoUri,
                dbName: dbConfig.dbName
            }),
            getConversationTitle(userId, {
                mongoUri: dbConfig.mongoUri,
                dbName: dbConfig.dbName
            }),
            getStorageType({
                mongoUri: dbConfig.mongoUri,
                dbName: dbConfig.dbName
            })
        ]);

        return NextResponse.json({ userId, title, messages, storage });
    } catch (error) {
        console.error('Get Session Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const { userId: bodyUserId, title } = await req.json();
        const userId = bodyUserId || (await resolveUserId(req));
        if (!userId || !title) {
            return NextResponse.json({ error: 'Missing userId or title' }, { status: 400 });
        }

        const dbConfig = await resolveDbConfig();
        await saveConversationTitle(userId, title, {
            mongoUri: dbConfig.mongoUri,
            dbName: dbConfig.dbName
        });
        return NextResponse.json({ success: true, title });
    } catch (error) {
        console.error('Update Title Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const userId = await resolveUserId(req);

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const dbConfig = await resolveDbConfig();
        await deleteConversation(userId, {
            mongoUri: dbConfig.mongoUri,
            dbName: dbConfig.dbName
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete History Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
