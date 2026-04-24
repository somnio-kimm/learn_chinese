/**
 * Fetches and converts drkameleon/complete-hsk-vocabulary minified word entries.
 * @see https://github.com/drkameleon/complete-hsk-vocabulary
 */
import https from 'https';

/** HSK 3.0-style exclusive lists (new words per band; 7 = official 7–9). */
export const UPSTREAM_BASE =
  'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/wordlists/exclusive/newest';

export const POS_MAP = {
  n: 'Noun', v: 'Verb', a: 'Adjective', d: 'Adverb', p: 'Preposition', c: 'Conjunction',
  r: 'Pronoun', m: 'Numeral', q: 'Classifier', t: 'Time Word', i: 'Idiom', u: 'Particle',
  y: 'Particle', ad: 'Adverb', an: 'Adjective', ag: 'Adjective', b: 'Adjective', o: 'Other',
  e: 'Interjection', f: 'Noun', g: 'Other', h: 'Other', j: 'Noun', k: 'Suffix', l: 'Phrase',
  mg: 'Numeral', ng: 'Noun', nr: 'Noun', ns: 'Noun', nt: 'Noun', nx: 'Noun', nz: 'Noun',
  rg: 'Pronoun', s: 'Noun', tg: 'Time', vd: 'Verb', vg: 'Verb', vn: 'Verb', w: 'Other',
  x: 'Other', z: 'Adjective', mq: 'Classifier',
};

export function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        get(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

const MARK_ROWS = [
  ['ā', 'a', 1], ['á', 'a', 2], ['ǎ', 'a', 3], ['à', 'a', 4],
  ['ē', 'e', 1], ['é', 'e', 2], ['ě', 'e', 3], ['è', 'e', 4],
  ['ī', 'i', 1], ['í', 'i', 2], ['ǐ', 'i', 3], ['ì', 'i', 4],
  ['ō', 'o', 1], ['ó', 'o', 2], ['ǒ', 'o', 3], ['ò', 'o', 4],
  ['ū', 'u', 1], ['ú', 'u', 2], ['ǔ', 'u', 3], ['ù', 'u', 4],
  ['ǖ', 'ü', 1], ['ǘ', 'ü', 2], ['ǚ', 'ü', 3], ['ǜ', 'ü', 4],
];
const MARK_MAP = new Map(MARK_ROWS.map(([m, p, t]) => [m, [p, t]]));

function parseMarkedSyllable(syl) {
  const s = syl.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return { base: '', tone: 0 };
  let tone = 0;
  let base = '';
  for (const ch of s) {
    if (MARK_MAP.has(ch)) {
      const [p, t] = MARK_MAP.get(ch);
      base += p;
      tone = t;
    } else base += ch;
  }
  base = base.replace(/v/g, 'ü');
  return { base, tone };
}

function parseNumericSyllable(part) {
  const m = part.toLowerCase().trim().match(/^([a-zü.:]+)(\d)$/);
  if (!m) return null;
  let t = parseInt(m[2], 10);
  if (t === 5) t = 0;
  return { base: m[1].replace(/:/g, '').replace(/v/g, 'ü'), tone: t };
}

function partOfSpeech(pArr) {
  if (!pArr?.length) return 'Other';
  const labels = [...new Set(pArr.map(c => POS_MAP[c] || c))];
  return labels.slice(0, 3).join(' / ');
}

function syllablesFromEntry(hanzi, form) {
  const chars = [...hanzi];
  const nStr = form.i?.n?.trim() || '';
  const yStr = form.i?.y?.trim() || '';
  const nParts = nStr.split(/\s+/).filter(Boolean);

  const numericOk = nParts.length === chars.length && nParts.every(p => parseNumericSyllable(p));
  if (numericOk) {
    return chars.map((hz, i) => {
      const { base, tone } = parseNumericSyllable(nParts[i]);
      return { hanzi: hz, base, tone };
    });
  }

  const yParts = yStr.split(/\s+/).filter(Boolean);
  if (yParts.length !== chars.length) return null;

  return chars.map((hz, i) => {
    const { base, tone } = parseMarkedSyllable(yParts[i]);
    return { hanzi: hz, base, tone };
  });
}

export function convertEntry(raw, hskLevel, index) {
  const form = raw.f[0];
  if (!form?.i) return null;
  const syls = syllablesFromEntry(raw.s, form);
  if (!syls) return null;

  const meanings = form.m || [];
  const gloss = meanings.length ? meanings.join('；') : '';

  const out = {
    id: `hsk${hskLevel}_${index}`,
    hskLevel,
    hanzi: raw.s,
    partOfSpeech: partOfSpeech(raw.p),
    syllables: syls,
    meaningEn: gloss,
    meaningKo: '',
    sentences: [],
  };
  const cls = form.c;
  if (cls?.length) out.measureWord = cls[0];
  return out;
}
