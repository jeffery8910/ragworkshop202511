# Agent Notes（給自動化/Agent 看）

## 架構原則（最重要）

- **LINE Webhook 必須 1–2 秒內回 200**：不要把 LLM/RAG 放在 webhook request thread。
- 建議架構：**LINE → Vercel（驗簽＋快速回覆/轉送）→ Render（n8n 長流程）→ 回覆 LINE**

## 端點與健康檢查

- LINE Webhook（新版）：`POST /api/line/webhook`
- LINE Webhook（相容舊路徑）：`POST /api/line-webhook`
- 系統狀態：`GET /admin/status`（前端頁）與 `GET /api/admin/status`（JSON）
- n8n health：`GET https://<n8n>.onrender.com/healthz`

## 向量庫（Pinecone / MongoDB Atlas Vector Search）

- 自動選擇規則：
  - 有 `PINECONE_API_KEY` → 預設走 Pinecone
  - 否則 → 走 MongoDB Atlas Vector Search
- 可強制指定：
  - `VECTOR_STORE_PROVIDER=pinecone|atlas`
- Atlas 模式：
  - 向量寫入：`chunks.embedding`
  - 查詢：MongoDB `$vectorSearch`
  - 索引名：`ATLAS_VECTOR_INDEX_NAME`（預設 `vector_index`）
  - 細節：`docs/MONGODB-ATLAS-VECTOR-SEARCH.md`
  - 自動化：
    - 建 index：`npm run atlas:ensure-index`
    - 測試 `$vectorSearch`：`npm run atlas:test`

## 必要環境變數（摘要）

- Vercel（Next.js / webhook）
  - `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `N8N_WEBHOOK_URL`
  - `ADMIN_PASSWORD`（未設時預設 `admin`，務必改）
  - Vector store：`PINECONE_API_KEY`（可選）/ `MONGODB_URI`（建議）
- Render（n8n）
  - `LINE_CHANNEL_ACCESS_TOKEN`, `RAG_RETRIEVE_URL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`

## 快速 smoke test（本機）

- LINE webhook（驗簽 + 200）：`npm run line:smoke-webhook`

> 上述腳本會自動讀取 `.env.local` / `.env`（不覆蓋既有 env）。
