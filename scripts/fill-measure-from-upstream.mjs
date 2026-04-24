/**
 * Fills missing `measureWord` on web/data/hsk-{N}.json from upstream exclusive lists
 * (classifiers in form.c). Does not overwrite existing measureWord.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { get, UPSTREAM_BASE } from './lib/hsk-upstream.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const WEB_DATA = path.join(ROOT, 'web', 'data');

function classifierFromRaw(raw) {
  const form = raw?.f?.[0];
  const cls = form?.c;
  if (!Array.isArray(cls) || !cls.length) return null;
  const w = String(cls[0]).trim();
  return w || null;
}

async function main() {
  const levels = process.argv.slice(2).map(Number).filter((n) => n >= 1 && n <= 7);
  const runLevels = levels.length ? levels : [1, 2, 3, 4, 5, 6, 7];

  for (const lv of runLevels) {
    const url = `${UPSTREAM_BASE}/${lv}.min.json`;
    process.stderr.write(`Fetching classifiers ${url}...\n`);
    const arr = JSON.parse(await get(url));
    const hzToCls = new Map();
    for (const raw of arr) {
      const hz = raw?.s;
      if (!hz) continue;
      const c = classifierFromRaw(raw);
      if (c) hzToCls.set(hz, c);
    }

    const file = path.join(WEB_DATA, `hsk-${lv}.json`);
    if (!fs.existsSync(file)) continue;
    const words = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(words)) continue;
    let filled = 0;
    for (const w of words) {
      if (w.measureWord) continue;
      const c = hzToCls.get(w.hanzi);
      if (!c) continue;
      w.measureWord = c;
      filled++;
    }
    fs.writeFileSync(file, JSON.stringify(words), 'utf8');
    process.stderr.write(`  hsk-${lv}.json: filled measureWord for ${filled} word(s)\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
