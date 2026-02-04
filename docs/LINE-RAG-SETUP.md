# LINE RAG 串接指南（Vercel + Render + n8n）

## 目標（你給的條件）

- Webhook 要「永遠可打到」：不睡眠、不被保護頁擋住
- 不要被 Vercel Auth/Protection 擋：LINE Webhook 必須是公開可打
- Webhook 要能 **1–2 秒內回 200**：LLM 再慢都不能卡住 webhook
- 需要能觀測健康狀態：health / ports / logs（至少要能知道是哪一層壞）

## 我怎麼選環境（結論）

- **Vercel：放 LINE Webhook（最前面那一跳）**
  - 優點：Always-on、延遲低、適合「快速驗簽＋快速回 200」
  - 注意：如果你開了 Vercel 的 Protection（密碼/登入牆），LINE 會被擋 → webhook 直接掛
- **Render：放 n8n（慢的工作都丟這裡）**
  - 優點：適合跑「長流程」：RAG → LLM → 回覆 LINE
  - 注意：免費方案可能休眠 → 需要 keep-alive（本 repo 有 GitHub Actions 範例）

## 我怎麼查（你要的「過程」）

1. **盤點資料夾版本**：以 `NextJS_重構版_20251228` 當主線（有 async handoff、admin/status、可擴充）
2. **實測線上端點**：確認 n8n health（`/healthz`）與 webhook 路徑存在
3. **用 MCP 查 Vercel/Render 現況**：確認 Vercel 部署是否成功、Render 服務是否存活、網址是否正確
4. **針對 LINE 不回覆走最短修補路徑**
   - 先解「路由不一致」：保留 `/api/line-webhook` 舊路徑相容
   - 再解「webhook 快速回 200」：Vercel webhook 驗簽後 background 轉交給 n8n
   - 再補「n8n 預設 workflow」：提供可直接匯入的 `n8n/workflow.json`
   - 最後補「觀測/健康」：用 `/admin/status` + keep-alive 觀察狀態

## 你目前「接不到 LINE 回覆」最常見的直接原因（快速對照）

- **Vercel `/api/line/webhook` 回 500**：通常是 `LINE_CHANNEL_SECRET` 沒設定（無法驗簽）
- **n8n `/webhook/line-rag` 回 404 / webhook not registered**：workflow 沒 Active 或 path 不一致
- **有收到「處理中」但沒收到答案**：OpenRouter key/model 沒設、或 Push 權限/Token 錯、或 replyToken 過期（本 workflow 用「先 Reply 再 Push」避免過期）

## 一次設定到可跑（建議順序）

### A) Render（n8n）

1. 確認健康檢查：
   - `GET https://<your-n8n>.onrender.com/healthz` → 應回 `{"status":"ok"}`
2. 設定 Render 環境變數（n8n 服務）
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `RAG_RETRIEVE_URL`：例如 `https://<your-vercel-domain>/api/workshop/retrieve`
   - `OPENROUTER_API_KEY`
   - `OPENROUTER_MODEL`
   - 可選：`LINE_ACK_MESSAGE`, `RAG_TOP_K`, `LINE_MAX_CHARS`
3. 進 n8n UI → Import workflow
   - 匯入：`n8n/workflow.json`
4. 把 workflow **切到 Active**
5. 取得 Production webhook URL：
   - `https://<your-n8n>.onrender.com/webhook/line-rag`

### B) Vercel（Next.js + LINE Webhook）

1. 設定 Vercel 環境變數（至少）
   - `LINE_CHANNEL_SECRET`
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `N8N_WEBHOOK_URL`：填剛剛的 `https://<your-n8n>.onrender.com/webhook/line-rag`
   - `ADMIN_PASSWORD`：管理後台登入密碼（未設定時預設 `admin`，建議設定長且難猜的密碼）
2. 確認你的 Vercel 專案是「公開」的（不要把整站鎖在 Protection 後面）
3. 進 `/guide` 看你現在部署網域對應的 webhook URL
4. 進 `/admin/status` 看狀態（Mongo/Pinecone/LLM/LINE）

### C) LINE Developers

1. Webhook URL 填（擇一）
   - 新版：`https://<your-vercel-domain>/api/line/webhook`
   - 相容：`https://<your-vercel-domain>/api/line-webhook`
2. Use webhook：Enable
3. Verify：看是否成功（成功才表示驗簽/路由都 OK）

## n8n 預設 workflow 說明（這份 repo 已準備好）

檔案：`n8n/workflow.json`

- Webhook：`POST /webhook/line-rag`（responseMode=onReceived）
- 流程：
  1. 收到 Vercel 轉送的 LINE event
  2. 先用 LINE Reply API 回覆「處理中」
  3. 呼叫 `RAG_RETRIEVE_URL` 做檢索（`includeAnswer:false`）
  4. 用 OpenRouter 生成回答
  5. 用 LINE Push API 推送答案（避免 replyToken 過期）

## NVIDIA 免費模型怎麼接（可選）

這份 workflow 目前預設是 OpenRouter。若你要改 NVIDIA：

- 最簡單：在 n8n 把 `OpenRouter Chat` 那個節點改成你 NVIDIA 的推理端點（仍維持「先 Reply、後 Push」即可）
- 原則不變：**webhook 只做快速回 200**，慢的（RAG/LLM）都在 n8n 裡做

## 給 Agent / 自動化工具看的（Agent Notes）

- **管理後台登入**：`POST /api/auth/login`，body `{ "password": "<ADMIN_PASSWORD>" }`，成功會設 `admin_session` cookie。
- **Admin API 保護**：`/api/admin/*` 需要 `admin_session` cookie；未登入會回 `401`。
- **Chat 對話刪除**：`DELETE /api/chat/session?userId=<id>`（前端會使用 `localStorage.rag_user_id` 當 userId）。
- **LINE Webhook**：`POST /api/line/webhook` 必須能在 1–2 秒內回 200；慢的流程交給 n8n。
- **n8n 健康檢查**：用 `GET https://<your-n8n>.onrender.com/healthz`（不是看 `GET /rest/ping`）。
