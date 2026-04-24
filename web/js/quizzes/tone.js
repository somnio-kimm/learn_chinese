import { Store } from '../services/store.js';
import { Pinyin } from '../services/pinyin.js';
import { TTS } from '../services/tts.js';
import { Haptic } from '../services/haptic.js';
import { recordAnswer } from '../services/srs.js';
import {
  pick, scorePill, showCorrectBurst, showStatusSheet, posGroupIdsForWord,
  wordlistCombinedFilterMarkup, filterByStudyStatus, filterByPosTag,
  quizMark,
} from '../components.js';
import { t, wordMeaning } from '../services/i18n.js';

export function renderToneQuiz(el) {
  let srsFilter = 'all';
  let tagFilter = 'all';
  let score = 0, total = 0, word = null;
  /** @type {(number|null)[]} */
  let picks = [];
  let focusIdx = 0;
  /** '' | 'correct' | 'wrong' */
  let feedback = '';

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
      initPicks();
    } else {
      word = fresh;
    }
  }

  function initPicks() {
    if (!word?.syllables?.length) {
      picks = [];
      return;
    }
    picks = word.syllables.map(() => null);
    focusIdx = 0;
    feedback = '';
  }

  function bindFilters() {
    el.querySelectorAll('.wl-filter[data-f]').forEach(b => b.onclick = () => {
      srsFilter = b.dataset.f;
      Haptic.light();
      syncWord();
      if (word) initPicks();
      draw();
    });
    el.querySelectorAll('.wl-filter[data-tag]').forEach(b => b.onclick = () => {
      tagFilter = decodeURIComponent(b.getAttribute('data-tag') || 'all');
      Haptic.light();
      syncWord();
      if (word) initPicks();
      draw();
    });
  }

  function newQ() {
    const { pool } = buildRows();
    if (!pool.length) {
      draw();
      return;
    }
    word = pick(pool);
    initPicks();
    draw();
  }

  function allFilled() {
    return word && picks.length === word.syllables.length && picks.every(p => p !== null);
  }

  function selectChar(i) {
    if (feedback || !word) return;
    focusIdx = i;
    draw();
  }

  function selectTone(tone) {
    if (feedback || !word || picks.length === 0) return;
    picks[focusIdx] = tone;
    const next = picks.findIndex((p, j) => j > focusIdx && p === null);
    if (next >= 0) focusIdx = next;
    else {
      const firstEmpty = picks.findIndex(p => p === null);
      focusIdx = firstEmpty >= 0 ? firstEmpty : word.syllables.length - 1;
    }
    draw();
  }

  function checkAnswer() {
    if (feedback || !word || !allFilled()) return;
    const syls = word.syllables;
    const ok = syls.every((s, i) => picks[i] === s.tone);
    total++;
    if (ok) {
      score++;
      feedback = 'correct';
      recordAnswer(true);
      Haptic.success();
      showCorrectBurst();
    } else {
      feedback = 'wrong';
      recordAnswer(false);
      Haptic.error();
      const userStr = syls.map((s, i) => Pinyin.marked(s.base, picks[i])).join(' ');
      const ansStr = Pinyin.markedWord(syls);
      Store.addWrong({
        mode: 'tone', wordHanzi: word.hanzi, wordId: word.id,
        hskLevel: word.hskLevel,
        posGroups: posGroupIdsForWord(word),
        userAnswer: userStr, correctAnswer: ansStr,
      });
    }
    draw();
  }

  function cellClass(i) {
    const syl = word.syllables[i];
    const picked = picks[i];
    let cls = 'tone-syl-cell';
    if (feedback) {
      if (picked === syl.tone) cls += ' tone-syl-cell--ok';
      else cls += ' tone-syl-cell--bad';
    } else {
      if (i === focusIdx) cls += ' tone-syl-cell--focus';
      if (picked !== null) cls += ' tone-syl-cell--filled';
    }
    return cls;
  }

  function cellPinyinHtml(i) {
    const syl = word.syllables[i];
    const picked = picks[i];
    if (feedback) {
      return Pinyin.marked(syl.base, syl.tone);
    }
    if (picked !== null) {
      return Pinyin.marked(syl.base, picked);
    }
    return '·';
  }

  function draw() {
    const { aw, forStatusRow, forTagRow, pool } = buildRows();
    if (!aw.length) {
      el.innerHTML = `<div class="card" style="text-align:center;padding:24px"><div style="font-size:40px">📭</div><div style="margin-top:8px;font-weight:600">${t('noWordsTitle')}</div><div style="font-size:14px;color:var(--text2);margin-top:6px">${t('pickLevelHint')}</div></div>`;
      return;
    }

    syncWord();
    if (!word && pool.length) {
      word = pick(pool);
      initPicks();
    }

    if (!pool.length) {
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div class="section-title" style="margin:0">${t('mode_tone')}</div>
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

    if (!word.syllables?.length) {
      newQ();
      return;
    }

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="section-title" style="margin:0">${t('mode_tone')}</div>
        ${scorePill(score, total)}
      </div>
      ${wordlistCombinedFilterMarkup(forStatusRow, srsFilter, forTagRow, tagFilter)}
      <div class="quiz-after-filter">
      <div class="card tone-quiz-card" style="position:relative;padding-top:44px">
        <div style="position:absolute;top:12px;left:12px;right:12px;display:flex;justify-content:space-between;align-items:center;gap:8px">
          <button type="button" class="quiz-status-btn">${t('studyStatusBtn')}</button>
          <button type="button" class="speak-btn tone-quiz-speak" style="font-size:20px;color:var(--blue)">🔊</button>
        </div>
        <p class="tone-quiz-hint">${feedback ? '' : t('toneSelectChar')}</p>
        <div class="tone-word-full" style="${Pinyin.syllableRowStyle(word.syllables)}" role="group" aria-label="word">
          ${word.syllables.map((syl, i) => `
            <button type="button" class="${cellClass(i)}" data-ci="${i}" ${feedback ? 'disabled' : ''}>
              <span class="tone-syl-py">${cellPinyinHtml(i)}</span>
              <span class="tone-syl-hz">${syl.hanzi}</span>
            </button>
          `).join('')}
        </div>
        <div class="tone-quiz-meaning" style="margin-top:12px">${wordMeaning(word)}</div>
        ${!feedback ? `<div class="tone-num-grid" style="margin-top:16px">
          ${[0, 1, 2, 3, 4].map(tn => {
            const syl = word.syllables[focusIdx];
            const main = syl ? Pinyin.marked(syl.base, tn) : String(tn);
            return `<button type="button" class="tone-num-btn" data-tn="${tn}" style="background:var(--card);border-color:var(--sep);color:var(--text)">
              <span class="tone-num-main">${main}</span>
            </button>`;
          }).join('')}
        </div>
        <button type="button" class="btn-primary tone-check-btn" id="tone-check" ${allFilled() ? '' : 'disabled'}>${t('toneCheck')}</button>` : ''}
      </div>
      ${feedback === 'correct' ? `<div class="card" style="text-align:center;margin-top:12px">
        ${quizMark(true)}
        <button class="btn-primary" id="next-btn" style="margin-top:12px">${t('nextQ')}</button>
      </div>` : ''}
      ${feedback === 'wrong' ? `<div class="card" style="text-align:center;margin-top:12px">
        ${quizMark(false)}
        <div class="py-per-char py-per-char--fb" style="margin-top:10px;color:var(--green)">${Pinyin.htmlMarkedColumns(word.syllables)}</div>
        <button class="btn-primary" id="next-btn" style="margin-top:12px">${t('nextQ')}</button>
      </div>` : ''}
      </div>`;

    bindFilters();
    el.querySelector('.quiz-status-btn')?.addEventListener('click', () => {
      Haptic.light();
      showStatusSheet(word.id, draw);
    });
    el.querySelector('.tone-quiz-speak')?.addEventListener('click', () => TTS.speak(word.hanzi));

    if (!feedback) {
      el.querySelectorAll('.tone-syl-cell[data-ci]').forEach(b => {
        b.addEventListener('click', () => selectChar(Number(b.dataset.ci)));
      });
      el.querySelectorAll('.tone-num-btn[data-tn]').forEach(b => {
        b.addEventListener('click', () => selectTone(Number(b.dataset.tn)));
      });
      el.querySelector('#tone-check')?.addEventListener('click', () => {
        Haptic.light();
        checkAnswer();
      });
    }
    el.querySelector('#next-btn')?.addEventListener('click', newQ);
  }
  draw();
}
