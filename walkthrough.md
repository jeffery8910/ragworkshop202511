# RAG 工作坊 - 操作指南 (Walkthrough)

## 1. 專案概覽
本專案已成功重構為 **Next.js + n8n + Hybrid RAG** 架構。
主要功能包含：
- **多模型支援**: OpenAI, Gemini, OpenRouter 自由切換。
- **進階 RAG**: 結構化輸出 (摘要/表格/時間軸)、父子索引、元數據增強。
- **學習功能**: 學生儀表板 (XP/錯題)、重點卡片生成器、測驗系統。
- **後台管理**: 檔案上傳、參數設定、數據分析、系統狀態監控。

## 2. 快速開始 (Quick Start)

### 步驟 1: 設定環境變數
請在專案根目錄建立 `.env.local` 檔案，並填入以下資訊：
```bash
# LINE 設定
LINE_CHANNEL_SECRET=你的ChannelSecret
LINE_CHANNEL_ACCESS_TOKEN=你的AccessToken

# LLM 設定 (擇一或全部)
OPENROUTER_API_KEY=你的OpenRouterKey
OPENAI_API_KEY=你的OpenAIKey
GEMINI_API_KEY=你的GeminiKey
LLM_PROVIDER=openrouter # 或 openai, gemini

# 資料庫設定
PINECONE_API_KEY=你的PineconeKey
PINECONE_INDEX_NAME=rag-index
MONGODB_URI=你的MongoDB連線字串
MONGODB_DB_NAME=rag_db

# n8n 設定 (選填)
N8N_WEBHOOK_URL=你的n8nWebhook網址
```

### 步驟 2: 啟動開發伺服器
```bash
npm run dev
```
啟動後，請訪問 `http://localhost:3000/admin` 進入管理後台 (預設帳密: admin / admin)。

### 步驟 3: 部署至 Vercel
1. 安裝 Vercel CLI: `npm i -g vercel`
2. 執行部署: `vercel`
3. 在 Vercel Dashboard 設定上述環境變數。

## 3. 功能驗證 (Verification)

### LINE Bot 測試
1. 加入 Bot 好友。
2. 輸入 **「測驗 微積分」** -> 應回傳微積分測驗題 (Flex Message)。
3. 輸入 **「ping」** -> 應回傳 "Pong! 系統運作正常"。
4. 輸入 **「什麼是極限？」** -> 應觸發 RAG 檢索並回傳答案。

### 後台測試 (Admin Dashboard)
1. **登入**: 進入 `/admin`，輸入密碼 (預設環境變數 `ADMIN_PASSWORD` 或使用動態設定)。
2. **系統設定 (Setup)**:
   - 在 **Setup Panel** 填寫 API Keys (Gemini/OpenAI/Pinecone/Mongo)。
   - 選擇 **Embedding Provider** 與 **Model Name** (支援 Gemini/OpenAI/OpenRouter)。
   - 設定 **Chat Title** 與 **Welcome Message**。
   - 點擊 "Save & Connect" 儲存設定 (存於 Cookie)。
3. **RAG 實驗室 (RAG Lab)**:
   - 輸入測試問題，觀察 Query Rewrite 結果與檢索到的 Chunks。
   - 調整 **Top K** 與 **Temperature** 參數，即時查看效果。
4. **知識庫管理 (Knowledge)**:
   - 查看 **Knowledge Graph** (2D 向量分佈)。
   - 使用 **Upload Panel** 拖曳或點擊上傳檔案。
5. **數據分析 (Analytics)**: 查看系統使用數據。

### 學生功能測試
1. 進入 `/student` -> 查看學習儀表板、XP 與錯題分析。
2. 測試 API: `/api/student/flashcard?topic=微積分` -> 應回傳 JSON 格式的卡片資料。

## 4. 進階 RAG 功能 (Advanced RAG)
- **Auto-Generated Chat Title**: 首次對話時，AI 會根據問題自動生成標題。
- **Dynamic TopK**: 可在後台動態調整檢索數量 (TopK)，無需重啟伺服器。
- **Model Switching**: 支援在後台切換 Embedding 與 Chat 模型，並指定具體模型名稱 (如 `gemini-1.5-pro`, `gpt-4o`)。

## 5. 常見問題
- **Build 失敗？**: 請確認 `.env.local` 是否已填寫正確，或暫時忽略 (本專案已做防呆處理)。
- **LINE 沒回應？**: 請檢查 Vercel Logs 或 `/admin/status` 確認 Webhook 是否正常。
- **設定沒生效？**: 請確認是否已點擊 "Save & Connect" 並重新整理頁面。設定儲存於 Cookie，請勿清除瀏覽器 Cookie。
