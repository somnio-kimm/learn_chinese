import { Store } from '../services/store.js';
import { Pinyin } from '../services/pinyin.js';
import { TTS } from '../services/tts.js';
import { Haptic } from '../services/haptic.js';
import {
  showStatusSheet, wordlistCombinedFilterMarkup, statusTagHTML, hskBandLabel,
  filterByStudyStatus, filterByPosTag, wordPosGroupDisplay,
} from '../components.js';
import { t, wordMeaning } from '../services/i18n.js';

export function renderWordList(el) {
  let statusFilter = 'all';
  let tagFilter = 'all';
  let search = '';

  function draw() {
    const active = Store.activeWords;
    const forStatusRow = filterByPosTag(active, tagFilter);
    const forTagRow = filterByStudyStatus(active, statusFilter);
    let filtered = filterByPosTag(forTagRow, tagFilter);

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(w =>
        w.hanzi.includes(q) ||
        (w.meaningKo || '').toLowerCase().includes(q) ||
        (w.meaningEn || '').toLowerCase().includes(q) ||
        w.syllables.some(s => s.base.includes(q)) ||
        Pinyin.markedWord(w.syllables).toLowerCase().includes(q)
      );
    }

    el.innerHTML = `
      <div class="section-title" style="margin-top:0">${t('wordlistTitle')} <span style="color:var(--text2);font-weight:400">(${filtered.length})</span></div>
      <div class="card" style="padding:10px">
        <input class="input-field" id="search-input" type="text" placeholder="${t('searchPlaceholder')}" value="${search}">
      </div>
      ${wordlistCombinedFilterMarkup(forStatusRow, statusFilter, forTagRow, tagFilter)}
      <div class="wl-list wl-list--wordlist">
        ${filtered.map(w => `
          <div class="wl-row" data-id="${w.id}">
            <div class="wl-main">
              <div class="wl-py-hz">${Pinyin.htmlMarkedColumns(w.syllables)}</div>
              <div class="wl-meaning">${wordMeaning(w)}</div>
            </div>
            <div class="wl-trail">
              <span class="wl-tag wl-hsk">${hskBandLabel(w.hskLevel)}</span>
              <span class="wl-tag wl-pos">${wordPosGroupDisplay(w)}</span>
              ${statusTagHTML(w.srs.level)}
              <button type="button" class="wl-speak" data-hz="${w.hanzi}">🔊</button>
            </div>
          </div>`).join('')}
        ${!filtered.length ? `<div style="text-align:center;padding:24px;color:var(--text2)">${t('noSearchResults')}</div>` : ''}
      </div>`;

    el.querySelector('#search-input').addEventListener('input', e => {
      search = e.target.value;
      draw();
      const input = el.querySelector('#search-input');
      input.focus();
      input.setSelectionRange(search.length, search.length);
    });
    el.querySelectorAll('.wl-filter[data-f]').forEach(b => b.onclick = () => {
      statusFilter = b.dataset.f;
      Haptic.light();
      draw();
    });
    el.querySelectorAll('.wl-filter[data-tag]').forEach(b => b.onclick = () => {
      tagFilter = decodeURIComponent(b.getAttribute('data-tag') || 'all');
      Haptic.light();
      draw();
    });
    el.querySelectorAll('.wl-row').forEach(r => r.onclick = e => {
      if (e.target.closest('.wl-speak')) return;
      showStatusSheet(r.dataset.id, draw);
    });
    el.querySelectorAll('.wl-speak').forEach(b => b.onclick = () => TTS.speak(b.dataset.hz));
  }
  draw();
}
