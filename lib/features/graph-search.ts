import { getMongoClient } from '@/lib/db/mongo';

export async function searchGraphContext(query: string): Promise<string> {
    // 1. 簡單的關鍵字匹配 (實際專案可用 NER 模型)
    // 這裡我們假設 query 本身可能包含實體名稱，直接用正則表達式或模糊搜尋去對 graph_nodes 做匹配
    
    const client = await getMongoClient();
    const db = client.db(process.env.MONGODB_DB_NAME || 'rag_db');
    
    // 簡化版：將 query 拆成單詞，嘗試匹配 node label
    // (實務上建議用 LLM 先提取 query 中的 entities，這裡為了效能先做簡單關鍵字搜尋)
    const tokens = query.split(/\s+/).filter(t => t.length > 1);
    
    if (tokens.length === 0) return '';

    // 尋找與 query 相關的節點
    const matchedNodes = await db.collection('graph_nodes').find({
        label: { $in: tokens.map(t => new RegExp(t, 'i')) }
    }).limit(5).toArray();

    if (matchedNodes.length === 0) return '';

    const nodeIds = matchedNodes.map(n => n.id);

    // 尋找與這些節點相連的邊 (1-hop 鄰居)
    const relatedEdges = await db.collection('graph_edges').find({
        $or: [
            { source: { $in: nodeIds } },
            { target: { $in: nodeIds } }
        ]
    }).limit(20).toArray();

    if (relatedEdges.length === 0) return '';

    // 格式化為文字上下文
    // 格式範例: "Entity(賈伯斯) relation(創辦) Entity(蘋果)"
    const contextLines = relatedEdges.map(edge => {
        return `${edge.source} --[${edge.relation}]--> ${edge.target}`;
    });

    return `
[知識圖譜補充資訊]
以下是從知識庫圖譜中檢索到的相關實體關係：
${contextLines.join('\n')}
`;
}
