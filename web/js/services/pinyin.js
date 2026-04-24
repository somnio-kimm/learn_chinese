const TONE_MAP = {
  a: ['ā','á','ǎ','à'], e: ['ē','é','ě','è'], i: ['ī','í','ǐ','ì'],
  o: ['ō','ó','ǒ','ò'], u: ['ū','ú','ǔ','ù'], 'ü': ['ǖ','ǘ','ǚ','ǜ']
};
const VOWELS = new Set(['a','e','i','o','u','ü']);
/** Max grapheme length for a single syllable’s marked pinyin in our data (column `ch` width). */
const PY_COL_MIN_CH = 6;

export const Pinyin = {
  marked(base, tone) {
    if (tone === 0) return base;
    const cs = [...base];
    const place = i => {
      const m = TONE_MAP[cs[i]];
      if (m) { cs[i] = m[tone - 1]; return cs.join(''); }
      return base;
    };
    let idx = cs.indexOf('a'); if (idx >= 0) return place(idx);
    idx = cs.indexOf('e');     if (idx >= 0) return place(idx);
    if (base.includes('ou')) { idx = cs.indexOf('o'); if (idx >= 0) return place(idx); }
    for (let i = cs.length - 1; i >= 0; i--) if (VOWELS.has(cs[i])) return place(i);
    return base;
  },

  numbered(syls) { return syls.map(s => s.base + (s.tone === 0 ? '' : s.tone)).join(' '); },
  markedWord(syls) { return syls.map(s => this.marked(s.base, s.tone)).join(' '); },

  _col(py, hz) {
    return `<span class="py-char-col"><span class="py-char-py">${py}</span><span class="py-char-hz">${hz}</span></span>`;
  },
  /** Fixed column width: longest syllable pinyin in data is capped at PY_COL_MIN_CH graphemes. */
  _syllableGridVars(syls) {
    const n = syls.length;
    return `--py-cols:${n};--py-min-ch:${PY_COL_MIN_CH}`;
  },
  /** `style=""` value for tone quiz / shared syllable rows (same column metrics as py-per-char). */
  syllableRowStyle(syls) {
    if (!syls?.length) return '';
    return this._syllableGridVars(syls);
  },
  /** Marked pinyin above each syllable’s hanzi (centered columns). */
  htmlMarkedColumns(syls) {
    if (!syls?.length) return '';
    const st = this._syllableGridVars(syls);
    return `<span class="py-per-char" style="${st}">${syls.map(s => this._col(this.marked(s.base, s.tone), s.hanzi)).join('')}</span>`;
  },
  /** Live input (space-separated syllables) aligned to word syllables. */
  htmlLiveInputColumns(word, input) {
    const syls = word?.syllables;
    if (!syls?.length) return '';
    const st = this._syllableGridVars(syls);
    const parts = input.trim().split(/\s+/).filter(Boolean);
    return `<span class="py-per-char" style="${st}">${syls.map((s, i) =>
      this._col(this.convertLive(parts[i] || '') || '\u00a0', s.hanzi)).join('')}</span>`;
  },
  /** ü as `:u`, `u:`, or keyboard `v` (no plain `v` in Hanyu Pinyin). */
  _umlautFromAscii(s) {
    if (!s) return s;
    return s.toLowerCase().replace(/:u/g, 'ü').replace(/u:/g, 'ü').replace(/v/g, 'ü');
  },

  normalize(s) { return this._umlautFromAscii(s.trim()).replace(/ +/g, ' '); },

  compare(input, word) {
    const parts = this.normalize(input).split(' ').filter(Boolean);
    const syls = word.syllables;
    if (parts.length !== syls.length) return false;
    return parts.every((p, i) => {
      const full = syls[i].base + syls[i].tone;
      const noTone = syls[i].tone === 0 ? syls[i].base : full;
      return p === full || p === noTone;
    });
  },

  convertLive(input) {
    const s = this._umlautFromAscii(input);
    return s.replace(/([a-zü]+)([0-5])/gi, (_, base, toneStr) => {
      const t = parseInt(toneStr, 10);
      const b = base.toLowerCase();
      if (t === 0 || t === 5) return b;
      return this.marked(b, t);
    });
  }
};
