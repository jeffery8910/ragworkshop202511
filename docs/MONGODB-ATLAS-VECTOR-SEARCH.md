# MongoDB Atlas Vector Search（取代 Pinecone）

本專案可把向量庫改成 **MongoDB Atlas Vector Search**：

- 向量資料寫入：`chunks.embedding`
- 查詢方式：MongoDB aggregation 的 `$vectorSearch`
- 預設索引名稱：`vector_index`（可用 `ATLAS_VECTOR_INDEX_NAME` 調整）

## 你需要先知道的事

1. **MongoDB Atlas Vector Search ≠ 一般 MongoDB**
   - `$vectorSearch` 需要 Atlas 的 Vector Search 功能與對應索引。
2. **維度要一致**
   - 你的 embedding 維度（例如 1024/1536/3072）必須和 Atlas index `numDimensions` 一樣。
3. **本專案的資料結構**
   - `documents`：文件層級 metadata（檔名、chunks 數量…）
   - `chunks`：每個 chunk 一筆（`text/source/chunkId/...` + `embedding`）

## Vercel 需要的環境變數（重點）

### 必要
- `MONGODB_URI`
- `MONGODB_DB_NAME`（例如 `rag_db`）

### 建議
- `VECTOR_STORE_PROVIDER=atlas`（如果你同時有 Pinecone key，想強制用 Atlas 才需要；否則會自動選擇）
- `ATLAS_VECTOR_INDEX_NAME=vector_index`
- `EMBEDDING_PROVIDER`（`gemini` / `openai` / `openrouter` / `pinecone`；不填則自動嘗試）
- `EMBEDDING_MODEL`（不填會用各 provider 預設模型）
- 任一 Embedding Key（至少一個）：
  - `OPENROUTER_API_KEY` 或 `GEMINI_API_KEY` 或 `OPENAI_API_KEY`（或 `PINECONE_API_KEY`）

## Atlas 上建立 Vector Search Index（chunks.embedding）

在 Atlas UI 建立 **Vector Search index**（針對 `chunks` collection）：

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1024,
      "similarity": "cosine"
    }
  ]
}
```

> 把 `numDimensions` 改成你實際 embedding 維度。
> 索引名稱請設為 `vector_index`（或配合 `ATLAS_VECTOR_INDEX_NAME`）。

## 自動化（推薦）

如果你已經把 `MONGODB_URI` 等環境變數設好，可以用腳本自動建立 index：

```bash
npm run atlas:ensure-index
```

建立完後，用這個做快速測試：

```bash
npm run atlas:test
```

## 產生 embedding 並寫入 MongoDB（兩種方式）

1) 管理介面上傳文件：`/admin?tab=knowledge`
- Upload 後會切 chunk、產生 embedding，並在 **Atlas 模式**寫入 `chunks.embedding`。

2) 對既有文件重建索引：`POST /api/admin/index`
- 會重新產生 embedding，並在 **Atlas 模式**回填到 `chunks.embedding`（同時也會更新圖譜資料）。

## 驗證（最短路徑）

1) 確認 Vercel 有設好 `MONGODB_URI`、`MONGODB_DB_NAME`
2) 確認 Atlas 有建好 `chunks.embedding` 的 vector index
3) 用 `/admin/status` 看 MongoDB 是否 OK
4) 呼叫 `POST /api/workshop/retrieve` 做檢索（includeAnswer 可先設 false）
