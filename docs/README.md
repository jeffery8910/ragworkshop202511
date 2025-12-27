# docs（作品集 / GitHub Pages）

這個資料夾是給人資/主管看的「作品集站」，用純靜態 HTML/CSS/JS，不依賴 Next.js build。

## 上 GitHub Pages（建議）

1. 進 GitHub repo → **Settings** → **Pages**
2. **Build and deployment** 選 **Deploy from a branch**
3. Branch 選 **main**，資料夾選 **/docs**
4. 儲存後，等 GitHub Pages 建站完成就會給你一個網址

## 本機預覽

最簡單：直接用瀏覽器打開 `docs/index.html`。

## 把教學坊的評估 JSON 轉成 HTML 報告

1. 到管理員 → **RAG 教學坊** → 做完評估後下載 `rag-eval-*.json`
2. 產生報告（會輸出到 `docs/reports/`）

```bash
node ./docs/tools/export-eval-report.mjs --in ./rag-eval-demo.json --out ./docs/reports/demo.html
```

