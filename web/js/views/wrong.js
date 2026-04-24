import { Store } from '../services/store.js';
import {
  modeColor, modeTitle, showStatusSheet, wrongBookCombinedFilterMarkup, posGroupIdsForWord,
} from '../components.js';
import { parseHskLevelFromWordId, loadHskLevels } from '../services/vocabulary.js';
import { Pinyin } from '../services/pinyin.js';
import { Haptic } from '../services/haptic.js';
import { t } from '../services/i18n.js';

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatWrongAnswerText(raw) {
  if (raw == null || raw === '') return '—';
  const s = String(raw);
  if (/[a-zü]+[0-5]/i.test(s)) return Pinyin.convertLive(s);
  return s;
}

function wrongLevel(w) {
  if (w.hskLevel != null && w.hskLevel >= 1 && w.hskLevel <= 7) return w.hskLevel;
  return parseHskLevelFromWordId(w.wordId);
}

function wrongGroups(w) {
  if (Array.isArray(w.posGroups) && w.posGroups.length) return w.posGroups;
  const word = Store.words.find(x => x.id === w.wordId || x.hanzi === w.wordHanzi);
  return word ? posGroupIdsForWord(word) : [];
}

function wrongIsPinyinOrTone(mode) {
  return mode === 'pinyin' || mode === 'tone';
}

function filterWrongs(wrongs, levelFilter, tagFilter) {
  let a = wrongs;
  if (levelFilter !== 'all') {
    const lv = Number(levelFilter);
    a = a.filter(w => wrongLevel(w) === lv);
  }
  if (tagFilter !== 'all') {
    a = a.filter(w => wrongGroups(w).includes(tagFilter));
  }
  return a;
}

export function renderWrong(el) {
  let levelFilter = 'all';
  let tagFilter = 'all';

  function draw() {
    const wrongs = Store.wrongAnswers;
    const rowsForLevel = filterWrongs(wrongs, 'all', tagFilter);
    const rowsForTag = filterWrongs(wrongs, levelFilter, 'all');
    const filtered = filterWrongs(wrongs, levelFilter, tagFilter);
    const filterBlock = wrongs.length
      ? wrongBookCombinedFilterMarkup(rowsForLevel, levelFilter, rowsForTag, tagFilter, {
        levelOf: wrongLevel,
        groupsOf: wrongGroups,
      })
      : '';

    el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="section-title" style="margin:0">${t('wrongBook')} (${wrongs.length})</div>
      ${wrongs.length ? `<button id="clear-wrong" class="btn-small" style="color:var(--red)">${t('clearAll')}</button>` : ''}
    </div>
    ${filterBlock}
    ${!wrongs.length ? `<div class="card"><div style="text-align:center;padding:20px"><div style="font-size:48px">🎉</div><div style="font-size:17px;font-weight:600;margin-top:8px">${t('noWrongYet')}</div></div></div>`
      : !filtered.length ? `<div class="card"><div style="text-align:center;padding:20px;color:var(--text2)">${t('noSearchResults')}</div></div>`
        : filtered.map(w => {
          const word = Store.words.find(x => x.id === w.wordId || x.hanzi === w.wordHanzi);
          const pyCols = word?.syllables?.length
            ? `<div class="wrong-py-cols">${Pinyin.htmlMarkedColumns(word.syllables)}</div>`
            : '';
          const hideCorrectLine = wrongIsPinyinOrTone(w.mode) && !!pyCols;
          const ua = escHtml(formatWrongAnswerText(w.userAnswer));
          const ca = escHtml(formatWrongAnswerText(w.correctAnswer));
          const hzOnce = pyCols
            ? ''
            : `<span class="wrong-item-hz">${escHtml(w.wordHanzi)}</span>`;
          const modeBadge = `<span class="badge wrong-item-badge" style="background:${modeColor(w.mode)}22;color:${modeColor(w.mode)}">${modeTitle(w.mode)}</span>`;
          const hzRow = hzOnce ? `<div class="wrong-item-hz-row">${hzOnce}</div>` : '';
          const resolvedId = w.wordId || word?.id || '';
          return `<div class="card wrong-item" data-id="${w.id}" data-word-id="${resolvedId}">
        <div class="wrong-item-row">
          <div class="wrong-item-body">
            ${pyCols}
            ${hzRow}
            ${hideCorrectLine ? '' : `<p class="wrong-line">${t('correctAnswer')}: <span class="wrong-correct">${ca}</span></p>`}
          </div>
          <div class="wrong-item-trail">
            <div class="wrong-item-trail-text">
              ${modeBadge}
              <p class="wrong-line wrong-line--trail">${t('yourAnswer')}: <span class="wrong-user">${ua}</span></p>
            </div>
            <button type="button" class="del-wrong" aria-label="${t('deleteAria')}">✕</button>
          </div>
        </div>
      </div>`;
        }).join('')}`;

    el.querySelector('#clear-wrong')?.addEventListener('click', () => { Store.clearWrong(); renderWrong(el); });
    el.querySelectorAll('.del-wrong').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      Store.deleteWrong(b.closest('.wrong-item')?.dataset.id);
      renderWrong(el);
    });
    el.querySelectorAll('.wl-filter[data-wlv]').forEach(b => b.onclick = () => {
      levelFilter = b.dataset.wlv;
      Haptic.light();
      draw();
    });
    el.querySelectorAll('.wl-filter[data-wtag]').forEach(b => b.onclick = () => {
      tagFilter = decodeURIComponent(b.getAttribute('data-wtag') || 'all');
      Haptic.light();
      draw();
    });
    el.querySelectorAll('.wrong-item').forEach(card => {
      card.addEventListener('click', async (e) => {
        if (e.target.closest('.del-wrong')) return;
        let wordId = card.dataset.wordId;
        const wrongId = card.dataset.id;
        const wrongEntry = Store.wrongAnswers.find(x => x.id === wrongId);
        if (!wordId) {
          const hz = card.querySelector('.wrong-item-hz')?.textContent?.trim();
          wordId = Store.words.find(x => x.hanzi === hz)?.id;
        }
        if (!wordId) return;
        if (!Store.words.find(x => x.id === wordId)) {
          const lv = wrongEntry?.hskLevel ?? parseHskLevelFromWordId(wordId);
          if (lv) await loadHskLevels([lv]);
        }
        Haptic.light();
        showStatusSheet(wordId, () => renderWrong(el));
      });
    });
  }
  draw();
}
