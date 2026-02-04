# 部署指南 (Deployment Guide)

## 1. Vercel 部署 (前端 + Webhook)
本專案使用 Next.js，最適合部署在 Vercel。

### 步驟
1. 將專案推送到 GitHub。
2. 在 Vercel Dashboard 新增專案，選擇該 GitHub Repo。
3. 在 **Environment Variables** 設定所有環境變數 (參考 `.env.local`)。
4. 點擊 **Deploy**。

### 注意事項
- **Function Timeout**: Vercel 免費版限制 10 秒。本專案已實作 **Async Handoff**，將耗時任務轉交給 n8n，因此不會超時。
- **MongoDB Integration**: 建議直接在 Vercel Marketplace 安裝 MongoDB Atlas Integration，會自動設定 `MONGODB_URI`。
- **Vector DB 選擇**:
  - 有 `PINECONE_API_KEY` 時預設走 Pinecone
  - 沒有 Pinecone 時可改用 MongoDB Atlas Vector Search（需要先建立 `chunks.embedding` 的 vector index；見 `docs/MONGODB-ATLAS-VECTOR-SEARCH.md`）
  - 可用腳本自動建立 index：`npm run atlas:ensure-index`（見 `docs/AUTOMATION.md`）

## 2. Render 部署 (n8n 自動化)
我們已準備好 `render.yaml` (Blueprint)，可實現 Infrastructure as Code 自動部署。

### 檔案結構
專案根目錄下的 `n8n/` 資料夾包含：
- `render.yaml`: Render 的部署藍圖設定檔。

### 部署步驟
1. **建立 New Blueprint Instance**:
   - 登入 [Render Dashboard](https://dashboard.render.com/)。
   - 點擊 **New +** -> **Blueprint**。
   - 連結你的 GitHub Repository。
   - Render 預設會讀 repo 根目錄的 `render.yaml`。本專案提供的是 `n8n/render.yaml`，你可以：
     - 在 Render 建立 Blueprint 時把 **Root Directory** 指到 `n8n`；或
     - 將 `n8n/render.yaml` 複製到 repo 根目錄再部署。

2. **設定環境變數**:
   - Render 會提示你確認 `render.yaml` 中的變數。
   - `N8N_BASIC_AUTH_PASSWORD` 與 `N8N_ENCRYPTION_KEY` 會自動生成，請記下來。
   - 點擊 **Apply** 開始部署。

3. **取得 Webhook URL**:
   - 部署完成後，在 Dashboard 找到 `n8n-rag-workflow` 服務。
   - 複製其 URL (例如 `https://n8n-rag-workflow.onrender.com`)。
   - 回到 Vercel，將此 URL 填入 `N8N_WEBHOOK_URL` 環境變數：
     - 這份 repo 的預設 workflow 路徑是：`/webhook/line-rag`
     - 例如：`https://n8n-rag-workflow.onrender.com/webhook/line-rag`

### n8n 設定
1. 開啟 n8n 網址，使用 `admin` 與剛剛生成的密碼登入。
2. 匯入 Workflow：`n8n/workflow.json`，並切到 **Active**。
3. 在 Render（n8n 服務）補齊環境變數（此 workflow 會用到）：
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `RAG_RETRIEVE_URL`（例如 `https://<your-vercel-domain>/api/workshop/retrieve`）
   - `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`

## 3. GitHub Actions (防休眠)
Render 免費版會休眠。本專案包含 `.github/workflows/keep_alive.yml`。
請在 GitHub Repo 的 Secrets 設定 `RENDER_URL`，Action 會每 14 分鐘 Ping 一次。
