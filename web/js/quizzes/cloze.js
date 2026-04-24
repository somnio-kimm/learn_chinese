import { Store } from '../services/store.js';
import { Pinyin } from '../services/pinyin.js';
import { TTS } from '../services/tts.js';
import { Haptic } from '../services/haptic.js';
import { recordAnswer } from '../services/srs.js';
import { shuffle, pick, scorePill, showCorrectBurst, posGroupIdsForWord, quizMark } from '../components.js';
import { navigate } from '../router.js';
import { t, sentenceMeaning } from '../services/i18n.js';

export function renderClozeQuiz(el) {
  const words = Store.activeWords;
  const withSentences = words.filter(w => w.sentences?.length);
  if (!withSentences.length) {
    el.innerHTML = `<div class="card" style="text-align:center;padding:20px"><div style="font-size:48px">📝</div><div>${t('noExampleWords')}</div></div>`;
    return;
  }
  let score = 0, total = 0, word, sentence, blank, options, feedback = '', userAnswer = '';

  function newQ() {
    word = pick(withSentences);
    sentence = pick(word.sentences);
    blank = word.hanzi;
    const distractors = shuffle(words.filter(w => w.id !== word.id)).slice(0, 3).map(w => w.hanzi);
    options = shuffle([blank, ...distractors]);
    feedback = ''; userAnswer = '';
    draw();
  }

  function choose(opt) {
    if (feedback) return;
    userAnswer = opt; total++;
    if (opt === blank) {
      score++; feedback = 'correct'; Haptic.success(); showCorrectBurst();
      recordAnswer(true);
    } else {
      feedback = 'wrong'; Haptic.error();
      recordAnswer(false);
      Store.addWrong({
        mode: 'cloze', wordHanzi: word.hanzi, wordId: word.id,
        hskLevel: word.hskLevel,
        posGroups: posGroupIdsForWord(word),
        userAnswer: opt, correctAnswer: blank,
      });
    }
    draw();
  }

  function draw() {
    const masked = sentence.hanzi.replace(blank, '______');
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="section-title" style="margin:0">${t('mode_cloze')}</div>
        ${scorePill(score, total)}
      </div>
      <div class="card" style="text-align:center">
        <button type="button" class="speak-btn" style="font-size:20px;color:var(--blue);margin-bottom:8px">🔊</button>
        ${sentence.pinyin ? `<div style="font-size:14px;color:var(--blue);font-weight:600;margin-bottom:8px">${Pinyin.convertLive(sentence.pinyin)}</div>` : ''}
        <div style="font-size:22px;font-weight:600;line-height:1.5">${masked}</div>
        <div style="font-size:14px;color:var(--text2);margin-top:8px">${sentenceMeaning(sentence)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${options.map(o => {
          let bg = 'var(--card)', border = 'var(--sep)', color = 'inherit';
          if (feedback && o === blank) { bg = 'rgba(52,199,89,0.1)'; border = 'var(--green)'; color = 'var(--green)'; }
          else if (feedback === 'wrong' && o === userAnswer) { bg = 'rgba(255,59,48,0.1)'; border = 'var(--red)'; color = 'var(--red)'; }
          return `<button type="button" class="opt-btn" data-o="${o}" style="padding:14px;border-radius:12px;background:${bg};border:1.5px solid ${border};color:${color};font-size:17px">${o}</button>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:12px;margin-top:12px">
        ${feedback ? `<button type="button" class="btn-primary" id="next-btn" style="flex:1">${t('nextQ')}</button>` : `<button type="button" class="btn-small" id="skip-btn">${t('skip')}</button>`}
      </div>
      ${feedback === 'wrong' ? `<div class="card" style="text-align:center;margin-top:12px">${quizMark(false)}<div style="margin-top:10px;font-size:22px;font-weight:700">${blank}</div></div>` : ''}`;

    el.querySelector('.speak-btn')?.addEventListener('click', () => TTS.speak(sentence.hanzi));
    el.querySelectorAll('.opt-btn').forEach(b => b.onclick = () => choose(b.dataset.o));
    el.querySelector('#skip-btn')?.addEventListener('click', () => {
      Haptic.light();
      navigate('wrong', { title: t('wrongBook') });
    });
    el.querySelector('#next-btn')?.addEventListener('click', newQ);
  }
  newQ();
}
