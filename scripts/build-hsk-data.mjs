/**
 * Fetches HSK 3.0 **exclusive** wordlists (new words per level) from:
 * https://github.com/drkameleon/complete-hsk-vocabulary (MIT)
 * Path: wordlists/exclusive/newest — band 7 = official levels 7–9.
 *
 * Before overwriting web/data/hsk-{1..7}.json, merges existing meaningKo/sentences
 * from those files + data/augment*.json by hanzi, then clears augment storage
 * under data/ (content is baked into web/data/hsk-*.json).
 *
 * Outputs web/data/hsk-{1..7}.json only (repo root data/hsk-*.json is not written).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { get, convertEntry, UPSTREAM_BASE } from './lib/hsk-upstream.mjs';
import {
  collectEnrichmentsByHanzi,
  applyEnrichments,
  clearAugmentStorage,
} from './lib/hsk-enrichments.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
/** Augment shards + augment.json live here (not the large hsk-*.json). */
const REPO_DATA = path.join(ROOT, 'data');
/** App + Capacitor load vocabulary from here only. */
const WEB_DATA = path.join(ROOT, 'web', 'data');

async function main() {
  const levels = [1, 2, 3, 4, 5, 6, 7];
  let total = 0;
  fs.mkdirSync(WEB_DATA, { recursive: true });

  process.stderr.write(
    `Collecting existing meaningKo/sentences by hanzi + augment (if any)...\n`
  );
  const enrich = collectEnrichmentsByHanzi(WEB_DATA);
  process.stderr.write(`  ${enrich.size} hanzi with merged enrichments\n`);

  for (const lv of levels) {
    const url = `${UPSTREAM_BASE}/${lv}.min.json`;
    process.stderr.write(`Fetching ${url}...\n`);
    const text = await get(url);
    const arr = JSON.parse(text);
    const out = [];
    let idx = 0;
    for (const raw of arr) {
      idx += 1;
      const w = convertEntry(raw, lv, idx);
      if (!w) continue;
      out.push(w);
    }
    applyEnrichments(out, enrich);
    const file = path.join(WEB_DATA, `hsk-${lv}.json`);
    fs.writeFileSync(file, JSON.stringify(out), 'utf8');
    total += out.length;
    process.stderr.write(`  level ${lv}: ${out.length} / ${arr.length} -> ${file}\n`);
  }

  clearAugmentStorage(REPO_DATA);
  process.stderr.write(
    `Cleared data/augment.json + data/augment/parts (baked into web/data/hsk-*.json).\n`
  );
  process.stderr.write(`Wrote ${total} words in ${levels.length} files under ${WEB_DATA}\n`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
