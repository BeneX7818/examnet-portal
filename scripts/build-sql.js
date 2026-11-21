#!/usr/bin/env node
/**
 * Keeps the SQL box inside the app (Supabase Settings -> "Copy SQL") in sync with
 * the real backend files.
 *
 *   backend/supabase/migrations/*.sql   <- the source of truth (edit / add files here)
 *   backend/supabase/setup.sql          <- generated: all migrations joined in order
 *   index.html  #sql-snippet            <- generated: same text, shown in the admin dashboard
 *
 * Usage (from the project root):   node scripts/build-sql.js
 *          check only (no writes):  node scripts/build-sql.js --check
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const migDir = path.join(root, 'backend', 'supabase', 'migrations');
const setupPath = path.join(root, 'backend', 'supabase', 'setup.sql');
const indexPath = path.join(root, 'index.html');
const check = process.argv.includes('--check');

const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();
if (!files.length) { console.error('No .sql files found in ' + migDir); process.exit(1); }

// Files are joined as they are, so each one should end with a newline.
const setup = files.map(f => {
  const t = fs.readFileSync(path.join(migDir, f), 'utf8').replace(/\r\n/g, '\n');
  return t.endsWith('\n') ? t : t + '\n';
}).join('');

// Only & and < need escaping inside <pre>; a plain ">" is valid text (the SQL uses ->> and >=).
const escaped = setup.replace(/\n$/, '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

const html = fs.readFileSync(indexPath, 'utf8');
const re = /(id="sql-snippet">)[\s\S]*?(<\/pre>)/;
if (!re.test(html)) { console.error('Could not find #sql-snippet in index.html'); process.exit(1); }
const nl = html.includes('\r\n') ? '\r\n' : '\n';
const body = nl + (nl === '\n' ? escaped : escaped.replace(/\n/g, '\r\n'));
const newHtml = html.replace(re, (_, a, b) => a + body + b);

const setupOld = fs.existsSync(setupPath) ? fs.readFileSync(setupPath, 'utf8') : '';
const inSync = setupOld === setup && newHtml === html;

if (check) {
  console.log(inSync ? 'OK - setup.sql and the in-app SQL box match the migrations.' : 'OUT OF SYNC - run: node scripts/build-sql.js');
  process.exit(inSync ? 0 : 1);
}
fs.writeFileSync(setupPath, setup);
fs.writeFileSync(indexPath, newHtml);
console.log(`Done: ${files.length} migration file(s) -> backend/supabase/setup.sql and index.html`);
