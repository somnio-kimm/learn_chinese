/**
 * Augment storage: optional sharded JSON under data/augment/parts/
 * plus legacy data/augment.json (merged on load; parts override legacy on same id).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');
export const AUGMENT_PATH = path.join(DATA_DIR, 'augment.json');
export const AUGMENT_PARTS_DIR = path.join(DATA_DIR, 'augment', 'parts');

function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function shardIndexForId(id, shardCount) {
  const n = Number(shardCount);
  if (!Number.isFinite(n) || n < 2) return 0;
  return fnv1a32(String(id)) % n;
}

export function augmentPartPath(shardIndex) {
  return path.join(AUGMENT_PARTS_DIR, `part-${String(shardIndex).padStart(5, '0')}.json`);
}

/** Full id → entry map from legacy file + all part files. */
export function loadAugmentMerged() {
  const merged = {};

  if (fs.existsSync(AUGMENT_PATH)) {
    try {
      const leg = JSON.parse(fs.readFileSync(AUGMENT_PATH, 'utf8'));
      if (leg && typeof leg === 'object' && !Array.isArray(leg)) Object.assign(merged, leg);
    } catch {
      /* ignore */
    }
  }

  if (fs.existsSync(AUGMENT_PARTS_DIR)) {
    for (const name of fs.readdirSync(AUGMENT_PARTS_DIR)) {
      const m = /^part-(\d+)\.json$/.exec(name);
      if (!m) continue;
      try {
        const obj = JSON.parse(fs.readFileSync(path.join(AUGMENT_PARTS_DIR, name), 'utf8'));
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) Object.assign(merged, obj);
      } catch {
        /* ignore */
      }
    }
  }

  return merged;
}

/**
 * In-memory merged map + per-shard cache for fast small writes.
 * @returns {{ merged: Record<string, unknown>, cache: Map<number, Record<string, unknown>> }}
 */
export function loadAugmentStore() {
  const merged = {};
  const cache = new Map();

  if (fs.existsSync(AUGMENT_PATH)) {
    try {
      const leg = JSON.parse(fs.readFileSync(AUGMENT_PATH, 'utf8'));
      if (leg && typeof leg === 'object' && !Array.isArray(leg)) Object.assign(merged, leg);
    } catch {
      /* ignore */
    }
  }

  if (fs.existsSync(AUGMENT_PARTS_DIR)) {
    for (const name of fs.readdirSync(AUGMENT_PARTS_DIR)) {
      const m = /^part-(\d+)\.json$/.exec(name);
      if (!m) continue;
      const idx = Number(m[1]);
      try {
        const obj = JSON.parse(fs.readFileSync(path.join(AUGMENT_PARTS_DIR, name), 'utf8'));
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          cache.set(idx, { ...obj });
          Object.assign(merged, obj);
        }
      } catch {
        /* ignore */
      }
    }
  }

  return { merged, cache };
}

function ensureShardObject(s, merged, cache, shardCount) {
  if (cache.has(s)) return cache.get(s);
  const p = augmentPartPath(s);
  let obj = {};
  if (fs.existsSync(p)) {
    try {
      obj = { ...JSON.parse(fs.readFileSync(p, 'utf8')) };
    } catch {
      obj = {};
    }
  } else {
    for (const [k, v] of Object.entries(merged)) {
      if (shardIndexForId(k, shardCount) === s) obj[k] = v;
    }
  }
  cache.set(s, obj);
  return obj;
}

/**
 * @param {string} id
 * @param {unknown} entry
 * @param {number} shardCount  use 0 or 1 for legacy single-file data/augment.json only
 * @param {Record<string, unknown>} merged
 * @param {Map<number, Record<string, unknown>>} cache
 */
export function persistAugmentEntry(id, entry, shardCount, merged, cache) {
  const n = Number(shardCount);
  merged[id] = entry;

  if (!Number.isFinite(n) || n < 2) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(AUGMENT_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
    return;
  }

  const s = shardIndexForId(id, n);
  const obj = ensureShardObject(s, merged, cache, n);
  obj[id] = entry;
  fs.mkdirSync(AUGMENT_PARTS_DIR, { recursive: true });
  fs.writeFileSync(augmentPartPath(s), `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
}
