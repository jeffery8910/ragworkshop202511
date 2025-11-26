# RAG 工作坊 - Advanced Hybrid Architecture

這是一個結合 **Next.js (Vercel)** 與 **n8n (Render)** 的進階 RAG 工作坊專案。
支援多模態 (文字/語音)、多模型 (OpenAI/Gemini/OpenRouter) 與進階 RAG 技術 (結構化輸出、父子索引、元數據增強)。

## 🚀 快速部署 (Quick Deploy)

### 1. 部署 Frontend (Next.js) 至 Vercel

點擊下方按鈕一鍵部署至 Vercel：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjeffery8910%2Fragworkshop202511&env=MONGODB_URI,MONGODB_DB_NAME,PINECONE_API_KEY,PINECONE_INDEX_NAME,GEMINI_API_KEY,OPENAI_API_KEY,OPENROUTER_API_KEY,ADMIN_PASSWORD,LINE_CHANNEL_SECRET,LINE_CHANNEL_ACCESS_TOKEN)

> **注意**：
> 1. 請先將本專案 Push 至您的 GitHub Repository。
> 2. 點擊按鈕進行部署，**Vercel 會提示您輸入環境變數** (如 `MONGODB_URI`, `PINECONE_API_KEY`, `ADMIN_PASSWORD` 等)。
> 3. 部署完成後，可進入 **Admin 後台** (`/admin`) 進一步確認系統狀態。

### 2. 部署 Backend (n8n) 至 Render

n8n 建議部署於 Render (Docker)：

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/jeffery8910/ragworkshop202511)

> **注意**：
> 1. 這是使用本專案內的 `n8n/render.yaml` 進行部署，確保環境設定正確。
> 2. 部署完成後，請登入 n8n 並匯入 `n8n/workflow.json` 作為基礎工作流。
> 3. 最後將 n8n 的 Webhook URL 填回 Vercel 的 `N8N_WEBHOOK_URL` 變數中。

## ✨ 主要功能 (Features)

- **🤖 多模型切換與備援**: 支援 OpenAI, Google Gemini, OpenRouter。具備 **智慧 Fallback 機制**，單一模型故障時自動切換，提升系統穩定性。
- **📚 進階 RAG**:
  - **結構化輸出**: 自動生成摘要、比較表、時間軸 (JSON Schema)。
  - **父子索引 (Parent-Child Indexing)**: 提升檢索上下文完整性。
  - **元數據增強 (Auto-Metadata)**: 自動提取關鍵字與摘要。
- **🎓 智慧學習系統**:
  - **學生儀表板 (Dashboard)**: 視覺化學習數據 (XP, Level, 錯題分析)，採用 **JSON -> React** 動態渲染架構。
  - **重點卡片 (Flashcard)**: AI 自動生成精美單字卡 (`/student/flashcard`)。
  - **適性化測驗 (Quiz)**: 根據主題生成測驗題與詳解 (`/student/quiz`)。
- **🛠️ 強大後台**:
  - **安全登入**: 專屬管理員登入頁面 (`/admin/login`)，支援 Session Cookie 驗證。
  - **檔案上傳**: 支援 PDF/TXT 拖曳上傳與向量化。
  - **系統監控**: 即時檢查 MongoDB, Pinecone, LLM 連線狀態與環境變數。

## 🛠️ 本地開發 (Local Development)

1. **安裝依賴**:
   ```bash
   npm install
   ```

2. **設定環境變數**:
   請參考 `walkthrough.md` 建立 `.env.local` 檔案。

3. **啟動伺服器**:
   ```bash
   npm run dev
   ```

## 📄 文件 (Documentation)

詳細設定與操作請參考專案內文件：
- [完整操作指南 (Walkthrough)](./walkthrough.md)
- [部署指南 (Deployment Guide)](./deploy-guide.md)
