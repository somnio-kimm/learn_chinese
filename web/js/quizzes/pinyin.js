import { Store } from '../services/store.js';
import { Pinyin } from '../services/pinyin.js';
import { TTS } from '../services/tts.js';
import { Haptic } from '../services/haptic.js';
import { recordAnswer } from '../services/srs.js';
import {
  pick, scorePill, showCorrectBurst, renderKeyboard, attachKeyboard,
  showStatusSheet, posGroupIdsForWord, wordlistCombinedFilterMarkup,
  filterByStudyStatus, filterByPosTag,
  quizMark,
} from '../components.js';
import { t, wordMeaning } from '../services/i18n.js';

export function renderPinyinQuiz(el) {
  let srsFilter = 'all';
  let tagFilter = 'all';
  let score = 0, total = 0, input = '', feedback = '';
  let word = null;

  function buildRows() {
    const aw = Store.activeWords;
    const forStatusRow = filterByPosTag(aw, tagFilter);
    const forTagRow = filterByStudyStatus(aw, srsFilter);
    const pool = filterByPosTag(forTagRow, tagFilter);
    return { aw, forStatusRow, forTagRow, pool };
  }

  function syncWord() {
    const { pool } = buildRows();
    if (!pool.length) {
      word = null;
      return;
    }
    const fresh = word?.id && Store.words.find(x => x.id === word.id);
    if (!fresh || !pool.some(w => w.id === fresh.id)) {
      word = pick(pool);
    } else {
      word = fresh;
    }
  }

  function bindFilters() {
    el.querySelectorAll('.wl-filter[data-f]').forEach(b => b.onclick = () => {
      srsFilter = b.dataset.f;
      Haptic.light();
      feedback = '';
      input = '';
      syncWord();
      draw();
    });
    el.querySelectorAll('.wl-filter[data-tag]').forEach(b => b.onclick = () => {
      tagFilter = decodeURIComponent(b.getAttribute('data-tag') || 'all');
      Haptic.light();
      feedback = '';
      input = '';
      syncWord();
      draw();
    });
  }

  function next() {
    input = '';
    feedback = '';
    const { pool } = buildRows();
    if (!pool.length) {
      draw();
      return;
    }
    word = pick(pool);
    draw();
  }

  function submit() {
    if (!input.trim() || !word) return;
    total++;
    if (Pinyin.compare(input, word)) {
      score++; feedback = 'correct';
      recordAnswer(true); Haptic.success(); showCorrectBurst();
    } else {
      feedback = 'wrong';
      recordAnswer(false); Haptic.error();
      Store.addWrong({
        mode: 'pinyin', wordHanzi: word.hanzi, wordId: word.id,
        hskLevel: word.hskLevel,
        posGroups: posGroupIdsForWord(word),
        userAnswer: input, correctAnswer: Pinyin.numbered(word.syllables),
      });
    }
    draw();
  }

  function draw() {
    const { aw, forStatusRow, forTagRow, pool } = buildRows();
    if (!aw.length) {
      el.innerHTML = `<div class="card" style="text-align:center;padding:24px"><div style="font-size:40px">📭</div><div style="margin-top:8px;font-weight:600">${t('noWordsTitle')}</div><div style="font-size:14px;color:var(--text2);margin-top:6px">${t('pickLevelHint')}</div></div>`;
      return;
    }

    syncWord();
    if (!word && pool.length) word = pick(pool);

    if (!pool.length) {
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div class="section-title" style="margin:0">${t('mode_pinyin')}</div>
          ${scorePill(score, total)}
        </div>
        ${wordlistCombinedFilterMarkup(forStatusRow, srsFilter, forTagRow, tagFilter)}
        <div class="quiz-after-filter card" style="text-align:center;padding:28px">
          <div style="font-size:40px;margin-bottom:8px">📭</div>
          <div style="font-weight:600">${t('noWordsFilter')}</div>
          <div style="font-size:14px;color:var(--text2);margin-top:6px">${t('tryOtherFilter')}</div>
        </div>`;
      bindFilters();
      return;
    }

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="section-title" style="margin:0">${t('mode_pinyin')}</div>
        ${scorePill(score, total)}
      </div>
      ${wordlistCombinedFilterMarkup(forStatusRow, srsFilter, forTagRow, tagFilter)}
      <div class="quiz-after-filter">
      <div class="card" style="text-align:center;position:relative;padding-top:40px">
        <div style="position:absolute;top:12px;left:12px;right:12px;display:flex;justify-content:space-between;align-items:center;gap:8px">
          <button type="button" class="quiz-status-btn">${t('studyStatusBtn')}</button>
          <button type="button" class="speak-btn" style="font-size:20px;color:var(--blue)">🔊</button>
        </div>
        <div class="pinyin-quiz-word">${Pinyin.htmlLiveInputColumns(word, input)}</div>
        <div style="font-size:14px;color:var(--text2);margin-top:4px">${wordMeaning(word)}</div>
      </div>
      ${!feedback ? `<button class="submit-pill" id="submit-btn" ${!input.trim() ? 'disabled' : ''}>${t('submit')}</button>` : ''}
      ${feedback === 'correct' ? `<div class="card" style="text-align:center">
        ${quizMark(true)}
        <button class="btn-primary" id="next-btn" style="margin-top:12px">${t('nextQ')}</button>
      </div>` : ''}
      ${feedback === 'wrong' ? `<div class="card" style="text-align:center">
        ${quizMark(false)}
        <div class="py-per-char py-per-char--fb" style="margin-top:10px;color:var(--green)">${Pinyin.htmlMarkedColumns(word.syllables)}</div>
        <button class="btn-primary" id="next-btn" style="margin-top:12px">${t('nextQ')}</button>
      </div>` : ''}
      ${!feedback ? renderKeyboard() : ''}
      </div>`;

    bindFilters();
    el.querySelector('.speak-btn')?.addEventListener('click', () => TTS.speak(word.hanzi));
    el.querySelector('.quiz-status-btn')?.addEventListener('click', () => {
      Haptic.light();
      showStatusSheet(word.id, draw);
    });
    el.querySelector('#submit-btn')?.addEventListener('click', submit);
    el.querySelector('#next-btn')?.addEventListener('click', next);
    if (!feedback) {
      attachKeyboard(el, {
        onTap(k) { input += k; draw(); },
        onSpace() { input += ' '; draw(); },
        onDelete() { input = input.slice(0, -1); draw(); },
      });
    }
  }
  draw();
}
