import { Store } from '../services/store.js';
import { Pinyin } from '../services/pinyin.js';
import { TTS } from '../services/tts.js';
import { Haptic } from '../services/haptic.js';
import { recordAnswer } from '../services/srs.js';
import { shuffle, pick, scorePill, showCorrectBurst, posGroupIdsForWord, quizMark } from '../components.js';
import { navigate } from '../router.js';
import { t, sentenceMeaning } from '../services/i18n.js';

export function renderScrambleQuiz(el) {
  const words = Store.activeWords;
  const withSentences = words.filter(w => w.sentences?.length);
  if (!withSentences.length) {
    el.innerHTML = `<div class="card" style="text-align:center;padding:20px"><div style="font-size:48px">🧩</div><div>${t('noExampleWords')}</div></div>`;
    return;
  }
  let score = 0, total = 0, word, sentence, pool = [], chosen = [], feedback = '';

  function newQ() {
    word = pick(withSentences);
    sentence = pick(word.sentences);
    const chars = [...sentence.hanzi];
    pool = shuffle(chars);
    chosen = [];
    feedback = '';
    draw();
  }

  function tapPool(i) {
    if (feedback) return;
    chosen.push(pool[i]);
    pool = pool.filter((_, j) => j !== i);
    Haptic.light();
    draw();
  }
  function tapChosen(i) {
    if (feedback) return;
    pool.push(chosen[i]);
    chosen = chosen.filter((_, j) => j !== i);
    Haptic.light();
    draw();
  }

  function checkAnswer() {
    total++;
    const user = chosen.join('');
    if (user === sentence.hanzi) {
      score++; feedback = 'correct'; Haptic.success(); showCorrectBurst();
      recordAnswer(true);
    } else {
      feedback = 'wrong'; Haptic.error();
      recordAnswer(false);
      Store.addWrong({
        mode: 'scramble', wordHanzi: word.hanzi, wordId: word.id,
        hskLevel: word.hskLevel,
        posGroups: posGroupIdsForWord(word),
        userAnswer: user, correctAnswer: sentence.hanzi,
      });
    }
    draw();
  }

  function draw() {
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="section-title" style="margin:0">${t('mode_scramble')}</div>
        ${scorePill(score, total)}
      </div>
      <div class="card" style="text-align:center">
        <button class="speak-btn" style="font-size:20px;color:var(--blue);margin-bottom:8px">🔊</button>
        ${sentence.pinyin ? `<div style="font-size:14px;color:var(--blue);font-weight:600;margin-bottom:8px">${Pinyin.convertLive(sentence.pinyin)}</div>` : ''}
        <div style="font-size:14px;color:var(--text2)">${sentenceMeaning(sentence)}</div>
      </div>
      <div class="card">
        <div style="font-size:13px;color:var(--text3);margin-bottom:8px">${t('yourAnswer')}:</div>
        <div class="flow-row">${chosen.map((c, i) => `<button class="flow-chip chosen" data-i="${i}">${c}</button>`).join('') || `<span style="color:var(--text3)">${t('buildSentence')}</span>`}</div>
      </div>
      <div class="card">
        <div class="flow-row">${pool.map((c, i) => `<button class="flow-chip" data-pi="${i}">${c}</button>`).join('')}</div>
      </div>
      ${!feedback ? `<div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn-primary" id="sub-btn" style="flex:1" ${!chosen.length ? 'disabled' : ''}>${t('submit')}</button>
        <button class="btn-small" id="clr-btn">${t('reset')}</button>
        <button class="btn-small" id="skip-btn">${t('skip')}</button>
      </div>` : ''}
      ${feedback === 'correct' ? `<div class="card" style="text-align:center;margin-top:12px">${quizMark(true)}<button class="btn-primary" id="next-btn" style="margin-top:12px">${t('nextQ')}</button></div>` : ''}
      ${feedback === 'wrong' ? `<div class="card" style="text-align:center;margin-top:12px">${quizMark(false)}<div style="margin-top:10px;font-size:20px;font-weight:700">${sentence.hanzi}</div><button class="btn-primary" id="next-btn" style="margin-top:12px">${t('nextQ')}</button></div>` : ''}`;

    el.querySelector('.speak-btn')?.addEventListener('click', () => TTS.speak(sentence.hanzi));
    el.querySelectorAll('.flow-chip[data-pi]').forEach(b => b.onclick = () => tapPool(Number(b.dataset.pi)));
    el.querySelectorAll('.flow-chip.chosen').forEach(b => b.onclick = () => tapChosen(Number(b.dataset.i)));
    el.querySelector('#sub-btn')?.addEventListener('click', checkAnswer);
    el.querySelector('#clr-btn')?.addEventListener('click', () => { pool = shuffle([...pool, ...chosen]); chosen = []; draw(); });
    el.querySelector('#skip-btn')?.addEventListener('click', () => {
      Haptic.light();
      navigate('wrong', { title: t('wrongBook') });
    });
    el.querySelector('#next-btn')?.addEventListener('click', newQ);
  }
  newQ();
}
