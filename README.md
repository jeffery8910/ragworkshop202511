# RAG 工作坊 - Advanced Hybrid Architecture

這是一個結合 **Next.js (Vercel)** 與 **n8n (Render)** 的進階 RAG 工作坊專案。
支援文字、多模型 (OpenAI/Gemini/OpenRouter) 與進階 RAG 技術 (結構化輸出、父子索引、元數據增強)。

## 作品集 / HR 入口

- 給人資/主管快速看的作品集：`docs/index.html`
- 建議把 `docs/` 開 GitHub Pages（設定方式見 `docs/README.md`）

## 🚀 快速部署 (Quick Deploy)

### 1. 部署 Frontend (Next.js) 至 Vercel

點擊下方按鈕一鍵部署至 Vercel：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjeffery8910%2Fragworkshop202511&env=ADMIN_PASSWORD)

> **注意**：
> 1. 請先將本專案 Push 至您的 GitHub Repository。
> 2. 點擊按鈕進行部署，建議至少填寫 `ADMIN_PASSWORD`（若未設定，管理後台預設密碼是 `admin`，請務必改成強密碼）。
> 3. **資料庫設定**：部署後，建議至 Vercel Marketplace 安裝 **MongoDB Atlas** Integration，它會自動設定 `MONGODB_URI`。
> 4. 其他設定 (如 Pinecone, AI Key) 可於部署後至 Vercel Settings 或 Admin 後台補填。

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
- **🛠️ 強大後台 (Admin Dashboard)**:
  - **安全登入**: 專屬管理員登入頁面 (`/admin/login`)，支援 Session Cookie 驗證。
  - **動態設定 (Dynamic Config)**: 支援線上設定 API Keys 與 RAG 參數 (TopK, Temperature)，無須重新部署。
  - **RAG 教學坊**: 視覺化 RAG 檢索過程，支援 A/B 比較、題庫管理、評估輸出 (CSV/JSON)。
  - **知識庫視覺化 (Knowledge Graph)**: 2D 向量分佈圖與索引檔案管理。
  - **檔案上傳**: 支援 PDF/TXT 拖曳或點擊上傳與向量化。
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

4. **Build**（預設使用 webpack，讓本機/CI/Vercel 更穩）:
   ```bash
   npm run build
   ```

## 📄 文件 (Documentation)

詳細設定與操作請參考專案內文件：
- [完整操作指南 (Walkthrough)](./walkthrough.md)
- [部署指南 (Deployment Guide)](./deploy-guide.md)
- [LINE RAG 串接指南（Vercel + Render + n8n）](./docs/LINE-RAG-SETUP.md)

Web UI 檢核入口（部署後直接打網址）：
- `/setup`：一鍵檢核（env var + n8n health + webhook 是否註冊）
- `/guide`：部署/LINE 指引
- `/admin/status`：系統狀態（n8n/MongoDB/向量庫/LLM/LINE）

相容舊版 sample（避免文件/流程對不上）：
- `/admin/setup` → 會導向 `/setup`
- `/api/test` → 轉送到 `/api/workshop/retrieve`
- `FORWARD_TO_N8N_URL` / `VECTOR_BACKEND` / `TOP_K` / `ADMIN_TOKEN` 仍可用（新版對應 `N8N_WEBHOOK_URL` / `VECTOR_STORE_PROVIDER` / `RAG_TOP_K` / `ADMIN_PASSWORD`）
