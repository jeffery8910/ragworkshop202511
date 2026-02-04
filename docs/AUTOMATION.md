# 自動化（你能一鍵跑的部分）

有些事情（開帳號、同意條款、Email 驗證、CAPTCHA、2FA）無法替你「代辦」，但本專案已把「拿到憑證後」能自動化的都做成腳本與 UI 檢核。

## 0) 先準備環境變數（最少）

> 這些腳本會自動讀取專案根目錄的 `.env.local` / `.env`（不會覆蓋你已經設定的環境變數）。

- `MONGODB_URI`
- `MONGODB_DB_NAME`（例如 `rag_db`）

（向量/Embedding 需要其中一個 provider 的 key）
- `GEMINI_API_KEY` 或 `OPENAI_API_KEY` 或 `OPENROUTER_API_KEY`（或 `PINECONE_API_KEY`）

（LINE webhook smoke test 需要）
- `LINE_CHANNEL_SECRET`
- `LINE_WEBHOOK_URL`（例如 `https://<vercel-domain>/api/line/webhook`）

## 1) Atlas Vector Search：自動建立 Vector Index

這個腳本會在 Atlas 叢集上對 `chunks.embedding` 建立 `vectorSearch` index。

- index 名稱：`ATLAS_VECTOR_INDEX_NAME`（預設 `vector_index`）
- collection：`ATLAS_VECTOR_COLLECTION`（預設 `chunks`）

```bash
npm run atlas:ensure-index
```

常見失敗原因：
- 不是 Atlas 7.0+ 叢集
- 帳號權限不足
- Free tier/M0 的限制（索引數量、特定操作）

## 2) Atlas Vector Search：快速測試 `$vectorSearch`

需要 DB 中已經有 `chunks.embedding`（先用管理端上傳文件或 reindex）。

```bash
npm run atlas:test
```

## 3) LINE webhook：本機 smoke test（驗簽 + 200）

只測「你的 webhook route 存在且能驗簽後回 200」（不代表能真的 reply/push，因為 replyToken 是假的）。

```bash
npm run line:smoke-webhook
```

## 4) Web UI 檢核（不用 CLI）

- `/guide`：部署/LINE/向量庫設定指引
- `/admin/status`：Mongo / n8n / Pinecone / Atlas Vector Search / LLM / LINE 健康檢查
