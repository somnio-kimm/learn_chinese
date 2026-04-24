/**
 * Lazy-loads HSK JSON by level (data/hsk-{1..7}.json) to avoid parsing ~30k words on startup.
 * SRS is stored separately in localStorage (srsById).
 */

const SRS_KEY = 'srsById';
const LEGACY_WORDS = 'words';
const LEGACY_VER = 'wordsDataVersion';

function defaultSrs() {
  return { level: 0, nextReview: Date.now(), lastReview: null };
}

function readSrsMap() {
  try {
    const v = localStorage.getItem(SRS_KEY);
    return v ? JSON.parse(v) : {};
  } catch {
    return {};
  }
}

function writeSrsMap(m) {
  localStorage.setItem(SRS_KEY, JSON.stringify(m));
}

/** One-time migration from monolithic `words` array to srsById + lazy JSON. */
export function migrateLegacyIfNeeded() {
  if (localStorage.getItem(SRS_KEY)) return;
  const raw = localStorage.getItem(LEGACY_WORDS);
  if (!raw) return;
  try {
    const arr = JSON.parse(raw);
    const map = {};
    for (const w of arr) {
      if (w?.id && w.srs) {
        map[w.id] = {
          level: w.srs.level,
          nextReview: w.srs.nextReview,
          lastReview: w.srs.lastReview ?? null,
        };
      }
    }
    writeSrsMap(map);
  } catch {
    /* ignore */
  }
  localStorage.removeItem(LEGACY_WORDS);
  localStorage.removeItem(LEGACY_VER);
}

let cache = [];
const loadedLevels = new Set();

function fetchVocabFile(url, timeoutMs = 60000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { signal: ctrl.signal, cache: 'no-store' }).finally(() => clearTimeout(t));
}

function attachSrs(rows) {
  const map = readSrsMap();
  return rows.map(row => ({
    ...row,
    srs: map[row.id] ? { ...defaultSrs(), ...map[row.id] } : defaultSrs(),
  }));
}

/**
 * Fetches any selected levels not yet loaded. Safe to call repeatedly.
 * Parses one level at a time so the main thread can breathe between files.
 */
export async function loadHskLevels(levels) {
  const need = [...new Set(levels)]
    .filter(lv => lv >= 1 && lv <= 7 && !loadedLevels.has(lv))
    .sort((a, b) => a - b);

  for (const lv of need) {
    const url = `data/hsk-${lv}.json`;
    const res = await fetchVocabFile(url);
    if (!res.ok) {
      throw new Error(`Failed to load data/hsk-${lv}.json (${res.status})`);
    }
    const arr = JSON.parse(await res.text());
    cache.push(...attachSrs(arr));
    loadedLevels.add(lv);
  }
  return cache;
}

export function getWords() {
  return cache;
}

export function persistSrs(id, srs) {
  const map = readSrsMap();
  map[id] = {
    level: srs.level,
    nextReview: srs.nextReview,
    lastReview: srs.lastReview ?? null,
  };
  writeSrsMap(map);
}

export function resetCache() {
  cache = [];
  loadedLevels.clear();
}

/** Word ids look like `hsk3_42` from build-hsk-data. */
export function parseHskLevelFromWordId(id) {
  const m = /^hsk(\d+)_/i.exec(String(id || ''));
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 7 ? n : null;
}
