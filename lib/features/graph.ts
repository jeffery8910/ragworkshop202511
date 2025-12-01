import { generateText } from '@/lib/llm';
import { getMongoClient } from '@/lib/db/mongo';

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  docId?: string;
  chunkId?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  docId?: string;
  chunkId?: string;
}

export async function extractGraphFromText(text: string): Promise<{ nodes: GraphNode[], edges: GraphEdge[] }> {
  const prompt = `
    你是專業的知識圖譜建構專家。請分析以下文本，萃取其中的「實體 (Entities)」與「關係 (Relationships)」。
    
    文本：
    """
    ${text.slice(0, 2000)}
    """
    
    請回傳純 JSON 格式，不要包含任何 Markdown 標記或額外文字。JSON 結構如下：
    {
      "nodes": [
        { "id": "實體名稱(保持原文)", "label": "實體名稱", "type": "類別(如: Person, Location, Organization, Concept, Event)" }
      ],
      "edges": [
        { "source": "來源實體ID", "target": "目標實體ID", "relation": "關係描述(動詞或短語)" }
      ]
    }
    
    注意事項：
    1. 實體 ID 請保持一致，去除多餘空格。
    2. 僅萃取文本中明確提到的重要資訊。
    3. 如果文本沒有明確實體，請回傳空陣列。
  `;
  
  try {
      // 使用較快速的模型進行萃取
      const responseText = await generateText(prompt, { model: 'gemini-1.5-flash' });
      
      // 清理可能的回應格式 (去除 ```json ... ```)
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const data = JSON.parse(cleanJson);
      return {
          nodes: Array.isArray(data.nodes) ? data.nodes : [],
          edges: Array.isArray(data.edges) ? data.edges : []
      };
  } catch (e) {
      console.warn("Graph extraction failed or parsed error:", e);
      return { nodes: [], edges: [] };
  }
}

export async function saveGraphData(docId: string, chunkId: string, data: { nodes: GraphNode[], edges: GraphEdge[] }) {
    if ((!data.nodes || data.nodes.length === 0) && (!data.edges || data.edges.length === 0)) return;
    
    const client = await getMongoClient();
    const db = client.db(process.env.MONGODB_DB_NAME || 'rag_db');
    
    // 為了避免重複，我們可以選擇在插入前先清理該 chunk 的舊資料，或者使用 upsert
    // 這裡示範簡單的 append 模式，但在 production 建議要處理 deduplication
    
    const nodesPayload = data.nodes.map(n => ({
        ...n,
        docId,
        chunkId,
        createdAt: new Date()
    }));

    const edgesPayload = data.edges.map(e => ({
        ...e,
        docId,
        chunkId,
        createdAt: new Date()
    }));

    if (nodesPayload.length > 0) {
        await db.collection('graph_nodes').insertMany(nodesPayload);
    }
    if (edgesPayload.length > 0) {
        await db.collection('graph_edges').insertMany(edgesPayload);
    }
}

export async function deleteGraphDataForDoc(docId: string) {
    const client = await getMongoClient();
    const db = client.db(process.env.MONGODB_DB_NAME || 'rag_db');
    await db.collection('graph_nodes').deleteMany({ docId });
    await db.collection('graph_edges').deleteMany({ docId });
}
