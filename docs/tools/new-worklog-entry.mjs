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

function localDateYYYYMMDD(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function slugify(input) {
  const s = String(input || '').trim().toLowerCase();
  const slug = s
    .replace(/[\u4e00-\u9fff]/g, '') // drop CJK for filename safety
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'entry';
}

function normalizeTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return String(raw)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function normalizeHighlights(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  const text = String(raw);
  if (!text.trim()) return [];
  return text
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
}

function worklogHtml({ title, date, tags, highlights, body }) {
  const tagHtml = (tags || []).map(t => `<span class="chip">${esc(t)}</span>`).join('');
  const hiHtml = (highlights || []).length
    ? `<ul class="list">${highlights.map(h => `<li>${esc(h)}</li>`).join('')}</ul>`
    : `<p class="muted">（可選）你可以補 2～4 個重點，讓 HR/主管一眼看懂。</p>`;

  const bodyText = String(body || '').trim();
  const bodyBlock = bodyText
    ? `<pre class="codebox"><code>${esc(bodyText)}</code></pre>`
    : `<p class="muted">（尚未填內容）建議至少寫：做了什麼、怎麼驗證、看到什麼差異。</p>`;

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
          <span>RAG 工作坊作品集</span>
          <span class="badge">週誌</span>
        </div>
        <div class="navlinks">
          <a href="../index.html">總覽</a>
          <a href="../hr.html">HR 版</a>
          <a href="../teaching.html">教學設計</a>
          <a href="../experiments.html">比較與評估</a>
          <a href="../technical.html">技術細節</a>
          <a href="./index.html">週誌</a>
        </div>
      </div>
    </div>

    <div class="container">
      <div class="hero">
        <div class="badge">${esc(date)}</div>
        <h1>${esc(title)}</h1>
        <p class="muted">這篇週誌的目標：讓人看完就知道「你做了什麼」以及「怎麼驗證」。</p>
        <div class="row" style="margin-top:12px">${tagHtml}</div>
      </div>

      <div class="grid">
        <div class="card two">
          <h2>重點（先看這裡）</h2>
          ${hiHtml}
        </div>

        <div class="card two">
          <h2>怎麼驗證（可操作）</h2>
          <ul class="list">
            <li>用同一題在「RAG 教學坊」做 A/B，比較 HitRate/Recall/時間差異。</li>
            <li>把 eval JSON 匯出成 HTML 報告，附在這篇週誌裡。</li>
          </ul>
        </div>

        <div class="card">
          <h2>紀錄內容</h2>
          ${bodyBlock}
          <div class="callout" style="margin-top:12px">
            <strong>小提醒：</strong>如果你寫「變快」或「變準」，最好補一個指標或一段對照（不然看的人很難判斷）。
          </div>
        </div>
      </div>

      <div class="footer">
        <div><a href="./index.html">← 回週誌清單</a></div>
        <div>產生器：<span class="kbd">docs/tools/new-worklog-entry.mjs</span></div>
      </div>
    </div>

    <script src="../assets/app.js"></script>
  </body>
</html>`;
}

async function readJsonSafe(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const title = args.title;
  const date = args.date || localDateYYYYMMDD();

  if (!title) {
    console.error('Usage: node ./docs/tools/new-worklog-entry.mjs --title "本週做了什麼" [--tags "教學坊,A/B"] [--highlights "重點1\\n重點2"] [--body-file ./notes.txt] [--date YYYY-MM-DD]');
    process.exit(1);
  }

  const tags = normalizeTags(args.tags);
  const highlights = normalizeHighlights(args.highlights);

  let body = '';
  if (args['body-file']) {
    body = await fs.readFile(String(args['body-file']), 'utf8');
  } else if (args.body) {
    body = String(args.body);
  }

  const slug = slugify(title);
  const outDir = path.join('docs', 'worklog');
  await fs.mkdir(outDir, { recursive: true });
  const fileName = `${date}-${slug}.html`;
  const filePath = path.join(outDir, fileName);

  const html = worklogHtml({ title, date, tags, highlights, body });
  await fs.writeFile(filePath, html, 'utf8');

  const entriesPath = path.join(outDir, 'entries.json');
  const entries = await readJsonSafe(entriesPath);
  const href = `./${fileName}`;
  const nextEntry = { date, title, href, tags, highlights };
  const nextEntries = [nextEntry, ...entries.filter(e => e && e.href !== href)];
  await fs.writeFile(entriesPath, JSON.stringify(nextEntries, null, 2) + '\n', 'utf8');

  console.log('Wrote:', filePath);
  console.log('Updated:', entriesPath);
  console.log('Next: git add docs/worklog && git commit -m "worklog: ' + date + ' ' + title + '"');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

