const fs = require('fs');
const path = require('path');

function stripQuotes(value) {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = stripQuotes(line.slice(eq + 1));
    if (!key) continue;
    // Do not override existing env (safe for CI / production)
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function loadEnv() {
  const root = path.resolve(__dirname, '..');
  // Prefer local overrides first, then fallback
  loadEnvFile(path.join(root, '.env.local'));
  loadEnvFile(path.join(root, '.env'));
}

module.exports = { loadEnv };

