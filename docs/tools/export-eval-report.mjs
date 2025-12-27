import fs from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    out[name] = value;
  }
  return out;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pct(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '-';
  return (v * 100).toFixed(1) + '%';
}

function num(n, digits = 4) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '-';
  return v.toFixed(digits);
}

function ms(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '-';
  return Math.round(v).toLocaleString() + ' ms';
}

function renderConfig(config) {
  if (!config || typeof config !== 'object') return '<span class="muted">（無）</span>';
  const pairs = Object.entries(config)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `<span class="chip"><span class="k">${esc(k)}</span>: ${esc(v)}</span>`)
    .join('');
  return pairs || '<span class="muted">（無）</span>';
}

function summaryTable(summary) {
  const s = summary || {};
  return `
    <table class="table">
      <thead>
        <tr>
          <th>項目</th>
          <th>數值</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>資料集</td><td>${esc(s.datasetName || s.datasetId || '-')}</td></tr>
        <tr><td>題數</td><td>${esc(s.totalQuestions ?? '-')}</td></tr>
        <tr><td>平均 Term Recall</td><td>${pct(s.avgTermRecall)}</td></tr>
        <tr><td>平均 Source Recall</td><td>${pct(s.avgSourceRecall)}</td></tr>
        <tr><td>HitRate</td><td>${pct(s.hitRate)}</td></tr>
        <tr><td>平均 Top Score</td><td>${num(s.avgTopScore)}</td></tr>
        <tr><td>平均 Score</td><td>${num(s.avgScore)}</td></tr>
        <tr><td>平均 chunks</td><td>${esc(s.avgChunkCount ?? '-')}</td></tr>
        <tr><td>平均圖譜節點</td><td>${esc(s.avgGraphNodes ?? '-')}</td></tr>
        <tr><td>平均圖譜邊</td><td>${esc(s.avgGraphEdges ?? '-')}</td></tr>
        <tr><td>總耗時</td><td>${ms(s.totalElapsedMs)}</td></tr>
      </tbody>
    </table>
  `;
}

function itemsTable(items) {
  const rows = Array.isArray(items) ? items : [];
  const body = rows.map((it) => {
    const hit = it.hit ? 'yes' : 'no';
    const pill = it.hit ? 'pill ok' : 'pill bad';
    return `
      <tr data-q="${esc(it.question || '')}">
        <td class="k">${esc(it.id || '')}</td>
        <td>${esc(it.question || '')}</td>
        <td>${pct(it.termRecall)}</td>
        <td>${pct(it.sourceRecall)}</td>
        <td><span class="${pill}">${hit}</span></td>
        <td>${num(it.avgScore)}</td>
        <td>${num(it.topScore)}</td>
        <td>${esc(it.chunkCount ?? '-')}</td>
        <td>${esc(it.graphNodes ?? '-')}</td>
        <td>${esc(it.graphEdges ?? '-')}</td>
        <td>${ms(it.elapsedMs)}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="row" style="justify-content:space-between; margin: 10px 0 8px;">
      <div class="mini">共 ${rows.length} 題</div>
      <div class="row">
        <label class="mini" for="q">搜尋題目：</label>
        <input id="q" type="text" placeholder="輸入關鍵字..." style="padding:8px 10px;border-radius:12px;border:1px solid var(--border);background:rgba(255,255,255,.06);color:var(--text);min-width:260px">
      </div>
    </div>
    <table class="table" id="items">
      <thead>
        <tr>
          <th>ID</th>
          <th>題目</th>
          <th>Term Recall</th>
          <th>Source Recall</th>
          <th>Hit</th>
          <th>Avg Score</th>
          <th>Top Score</th>
          <th>Chunks</th>
          <th>Graph Nodes</th>
          <th>Graph Edges</th>
          <th>耗時</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
    <script>
      (function(){
        const input = document.getElementById('q');
        const table = document.getElementById('items');
        if (!input || !table) return;
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        input.addEventListener('input', () => {
          const q = (input.value || '').trim().toLowerCase();
          rows.forEach(r => {
            const text = (r.getAttribute('data-q') || '').toLowerCase();
            r.style.display = !q || text.includes(q) ? '' : 'none';
          });
        });
      })();
    </script>
  `;
}

function diffRow(label, a, b, fmt = (x) => String(x)) {
  const av = Number(a);
  const bv = Number(b);
  const delta = (Number.isFinite(av) && Number.isFinite(bv)) ? (bv - av) : null;
  const sign = delta === null ? '' : (delta > 0 ? '+' : '');
  const deltaText = delta === null ? '-' : `${sign}${fmt(delta)}`;
  const cls = delta === null ? 'pill' : (delta > 0 ? 'pill ok' : delta < 0 ? 'pill bad' : 'pill');
  return `
    <tr>
      <td>${esc(label)}</td>
      <td>${esc(fmt(av))}</td>
      <td>${esc(fmt(bv))}</td>
      <td><span class="${cls}">${esc(deltaText)}</span></td>
    </tr>
  `;
}

function renderCompare(compare) {
  const a = compare?.a || {};
  const b = compare?.b || {};
  return `
    <div class="grid">
      <div class="card two">
        <h2>設定 A：${esc(a.datasetName || a.datasetId || 'A')}</h2>
        <div class="chips">${renderConfig(a.config)}</div>
        ${summaryTable(a)}
      </div>
      <div class="card two">
        <h2>設定 B：${esc(b.datasetName || b.datasetId || 'B')}</h2>
        <div class="chips">${renderConfig(b.config)}</div>
        ${summaryTable(b)}
      </div>
      <div class="card">
        <h2>差異摘要（B - A）</h2>
        <table class="table">
          <thead>
            <tr>
              <th>指標</th><th>A</th><th>B</th><th>差異</th>
            </tr>
          </thead>
          <tbody>
            ${diffRow('HitRate', a.hitRate, b.hitRate, (x) => pct(x).replace('%','') + '%')}
            ${diffRow('平均 Term Recall', a.avgTermRecall, b.avgTermRecall, (x) => pct(x).replace('%','') + '%')}
            ${diffRow('平均 Source Recall', a.avgSourceRecall, b.avgSourceRecall, (x) => pct(x).replace('%','') + '%')}
            ${diffRow('平均 Score', a.avgScore, b.avgScore, (x) => num(x))}
            ${diffRow('總耗時 (ms)', a.totalElapsedMs, b.totalElapsedMs, (x) => Math.round(Number(x) || 0).toLocaleString())}
          </tbody>
        </table>
      </div>
      <div class="card two">
        <h2>明細：A</h2>
        ${itemsTable(a.items)}
      </div>
      <div class="card two">
        <h2>明細：B</h2>
        ${itemsTable(b.items)}
      </div>
    </div>
  `;
}

function renderSingle(summary) {
  const s = summary || {};
  return `
    <div class="grid">
      <div class="card two">
        <h2>資料集：${esc(s.datasetName || s.datasetId || '-')}</h2>
        <div class="chips">${renderConfig(s.config)}</div>
        ${summaryTable(s)}
      </div>
      <div class="card two">
        <h2>你可以怎麼寫結論（模板）</h2>
        <div class="callout">
          <strong>一句話：</strong>我把（設定）從 A 改成 B，HitRate 從 X 變成 Y，代價是延遲增加 Z。\n
          <div class="mini" style="margin-top:8px">這份報告最有價值的是「你做了哪些比較」和「你用哪些指標支持你的結論」。</div>
        </div>
      </div>
      <div class="card">
        <h2>明細（逐題）</h2>
        ${itemsTable(s.items)}
      </div>
    </div>
  `;
}

function wrapHtml(title, body) {
  return `<!doctype html>
<html lang="zh-Hant-TW">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <link rel="stylesheet" href="../assets/style.css" />
  </head>
  <body>
    <div class="topbar">
      <div class="container nav">
        <div class="brand">
          <span>${esc(title)}</span>
          <span class="badge">由 eval JSON 產生</span>
        </div>
        <div class="navlinks">
          <a href="../index.html">總覽</a>
          <a href="../experiments.html">比較與評估</a>
          <a href="../teaching.html">教學設計</a>
          <a href="../technical.html">技術細節</a>
        </div>
      </div>
    </div>
    <div class="container">
      <div class="hero">
        <div class="badge">提示：這份報告可直接給 HR/主管看</div>
        <h1>${esc(title)}</h1>
        <p class="muted">若你要放作品集：建議在報告最上面補一段「你做了哪些比較」與「你的結論」。</p>
      </div>
      ${body}
      <div class="footer">
        <div>來源：教學坊匯出的 eval JSON</div>
        <div>產生器：<span class="kbd">docs/tools/export-eval-report.mjs</span></div>
      </div>
    </div>
  </body>
</html>`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inPath = args.in || args.input;
  const outPath = args.out || args.output;
  const title = args.title;

  if (!inPath || !outPath) {
    console.error('Usage: node ./docs/tools/export-eval-report.mjs --in <eval.json> --out <report.html> [--title <title>]');
    process.exit(1);
  }

  const raw = await fs.readFile(inPath, 'utf8');
  const data = JSON.parse(raw);

  const isCompare = data && typeof data === 'object' && data.a && data.b;
  const autoTitle = isCompare
    ? `RAG A/B 評估報告：${data?.a?.datasetName || 'A'} vs ${data?.b?.datasetName || 'B'}`
    : `RAG 評估報告：${data?.datasetName || data?.datasetId || 'Eval'}`;

  const htmlBody = isCompare ? renderCompare(data) : renderSingle(data);
  const html = wrapHtml(title || autoTitle, htmlBody);

  const outDir = path.dirname(outPath);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outPath, html, 'utf8');
  console.log('Wrote:', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

