/**
 * Merges augment data into web/data/hsk-{1..7}.json (in place).
 * Loads data/augment.json (legacy) and data/augment/parts/part-*.json (shards).
 * Run after build-hsk-data.mjs. No-op if no augment sources exist.
 *
 * Merge rules:
 * - meaningKo: non-empty string overwrites the word's meaningKo
 * - sentences: array replaces the word's sentences array entirely
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AUGMENT_PARTS_DIR, loadAugmentMerged } from './lib/augment-store.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const WEB_DATA = path.join(ROOT, 'web', 'data');
const AUGMENT_PATH = path.join(ROOT, 'data', 'augment.json');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function normalizeSentence(s) {
  if (!s || typeof s !== 'object') return null;
  const hanzi = String(s.hanzi ?? '').trim();
  if (!hanzi) return null;
  const o = { hanzi };
  if (s.pinyin != null && String(s.pinyin).trim()) o.pinyin = String(s.pinyin).trim();
  if (s.meaningKo != null && String(s.meaningKo).trim()) o.meaningKo = String(s.meaningKo).trim();
  if (s.meaningEn != null && String(s.meaningEn).trim()) o.meaningEn = String(s.meaningEn).trim();
  return o;
}

function main() {
  const hasLegacy = fs.existsSync(AUGMENT_PATH);
  const hasParts =
    fs.existsSync(AUGMENT_PARTS_DIR) &&
    fs.readdirSync(AUGMENT_PARTS_DIR).some((n) => /^part-\d+\.json$/.test(n));
  if (!hasLegacy && !hasParts) {
    process.stderr.write(`No augment data (${AUGMENT_PATH} or ${AUGMENT_PARTS_DIR}) — skip merge.\n`);
    return;
  }
  let augment;
  try {
    augment = loadAugmentMerged();
  } catch (e) {
    process.stderr.write(`Invalid augment data\n${e}`);
    process.exit(1);
  }
  if (augment == null || typeof augment !== 'object' || Array.isArray(augment)) {
    process.stderr.write('Augment must be a JSON object (id -> fields).\n');
    process.exit(1);
  }
  if (!Object.keys(augment).length) {
    process.stderr.write('Augment sources exist but merged map is empty — skip merge.\n');
    return;
  }

  let files = 0;

  for (let lv = 1; lv <= 7; lv++) {
    const file = path.join(WEB_DATA, `hsk-${lv}.json`);
    if (!fs.existsSync(file)) continue;
    const arr = readJson(file);
    if (!Array.isArray(arr)) continue;
    let wordsTouched = 0;
    for (const w of arr) {
      if (!w?.id) continue;
      const a = augment[w.id];
      if (!a || typeof a !== 'object') continue;
      let changed = false;
      if (typeof a.meaningKo === 'string' && a.meaningKo.trim()) {
        w.meaningKo = a.meaningKo.trim();
        changed = true;
      }
      if (Array.isArray(a.sentences)) {
        const sentences = a.sentences.map(normalizeSentence).filter(Boolean);
        w.sentences = sentences;
        changed = true;
      }
      if (changed) wordsTouched++;
    }
    if (wordsTouched) {
      fs.writeFileSync(file, JSON.stringify(arr), 'utf8');
      files++;
      process.stderr.write(`Merged augment into ${path.basename(file)} (${wordsTouched} word(s))\n`);
    }
  }

  if (!files) {
    process.stderr.write('Augment data present but no hsk-*.json files or no matching ids.\n');
  } else {
    process.stderr.write(`merge-augment: updated ${files} file(s).\n`);
  }
}

main();
