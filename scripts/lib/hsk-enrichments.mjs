/**
 * Merge meaningKo / sentences from existing hsk-*.json + augment shards by hanzi (stable key).
 */
import fs from 'fs';
import path from 'path';
import { loadAugmentMerged } from './augment-store.mjs';

function mergeInto(byHanzi, hanzi, patch, preferTie) {
  if (!hanzi || typeof hanzi !== 'string') return;
  const prev = byHanzi.get(hanzi) || { meaningKo: '', sentences: [] };
  const newKo = String(patch.meaningKo ?? '').trim();
  const prevKo = String(prev.meaningKo ?? '').trim();
  let meaningKo = prevKo;
  if (newKo.length > prevKo.length) meaningKo = newKo;
  else if (preferTie && newKo.length === prevKo.length && newKo) meaningKo = newKo;
  else if (!prevKo && newKo) meaningKo = newKo;

  const newS = Array.isArray(patch.sentences) ? patch.sentences : [];
  const prevS = Array.isArray(prev.sentences) ? prev.sentences : [];
  let sentences = prevS;
  if (newS.length > prevS.length) sentences = newS;
  else if (preferTie && newS.length === prevS.length && newS.length) sentences = newS;
  else if (!prevS.length && newS.length) sentences = newS;

  byHanzi.set(hanzi, { meaningKo, sentences });
}

/**
 * @param {string} dataDir project data/ (hsk-*.json + augment)
 * @returns {Map<string, { meaningKo: string, sentences: unknown[] }>}
 */
export function collectEnrichmentsByHanzi(dataDir) {
  const byHanzi = new Map();
  const idToHanzi = new Map();

  for (let lv = 1; lv <= 7; lv++) {
    const fp = path.join(dataDir, `hsk-${lv}.json`);
    if (!fs.existsSync(fp)) continue;
    let arr;
    try {
      arr = JSON.parse(fs.readFileSync(fp, 'utf8'));
    } catch {
      continue;
    }
    if (!Array.isArray(arr)) continue;
    for (const w of arr) {
      if (!w?.hanzi) continue;
      if (w.id) idToHanzi.set(w.id, w.hanzi);
      mergeInto(byHanzi, w.hanzi, { meaningKo: w.meaningKo, sentences: w.sentences }, false);
    }
  }

  let augment = {};
  try {
    augment = loadAugmentMerged();
  } catch {
    augment = {};
  }
  for (const [id, a] of Object.entries(augment)) {
    if (!a || typeof a !== 'object') continue;
    const hz = idToHanzi.get(id);
    if (!hz) continue;
    mergeInto(byHanzi, hz, { meaningKo: a.meaningKo, sentences: a.sentences }, true);
  }

  return byHanzi;
}

export function applyEnrichments(words, byHanzi) {
  for (const w of words) {
    const e = byHanzi.get(w.hanzi);
    if (!e) continue;
    if (e.meaningKo) w.meaningKo = e.meaningKo;
    if (e.sentences?.length) w.sentences = JSON.parse(JSON.stringify(e.sentences));
  }
}

/** After baking augment into hsk-*.json, drop legacy id-keyed shards (optional cleanup). */
export function clearAugmentStorage(dataDir) {
  const aug = path.join(dataDir, 'augment.json');
  const partsDir = path.join(dataDir, 'augment', 'parts');
  fs.mkdirSync(partsDir, { recursive: true });
  fs.writeFileSync(aug, '{}\n', 'utf8');
  if (fs.existsSync(partsDir)) {
    for (const n of fs.readdirSync(partsDir)) {
      if (/^part-\d+\.json$/.test(n)) fs.unlinkSync(path.join(partsDir, n));
    }
  }
}
