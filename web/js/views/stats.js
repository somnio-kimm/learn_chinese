import { Store } from '../services/store.js';
import { SRS_INTERVALS } from '../services/srs.js';
import { modeColor, modeTitle } from '../components.js';

export function renderStats(el) {
  const words = Store.words, streak = Store.streak, wrongs = Store.wrongAnswers;
  const mastered = words.filter(w => w.srs.level >= 5);
  const learning = words.filter(w => w.srs.level > 0 && w.srs.level < 5);
  const newW = words.filter(w => w.srs.level === 0);
  const pct = words.length ? Math.round(mastered.length / words.length * 100) : 0;
  const acc = streak.answered ? Math.round(streak.correct / streak.answered * 100) : 0;
  const circumference = 2 * Math.PI * 45;
  const levelCounts = SRS_INTERVALS.map((_, i) => words.filter(w => w.srs.level === i).length);
  const maxCount = Math.max(...levelCounts, 1);
  const barColors = ['var(--text3)','var(--orange)','var(--orange)','var(--blue)','var(--blue)','var(--green)','var(--green)','var(--purple)'];

  el.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-around;text-align:center">
        <div><div style="font-size:32px">🔥</div><div style="font-size:20px;font-weight:700">${streak.count}일</div><div style="font-size:12px;color:var(--text2)">연속 학습</div></div>
        <div style="border-left:0.5px solid var(--sep);padding-left:20px"><div style="font-size:20px;font-weight:700">${streak.sessions}</div><div style="font-size:12px;color:var(--text2)">총 학습 횟수</div></div>
        <div style="border-left:0.5px solid var(--sep);padding-left:20px"><div style="font-size:20px;font-weight:700">${words.length}</div><div style="font-size:12px;color:var(--text2)">전체 단어</div></div>
      </div>
    </div>
    <div class="card"><div class="card-title">단어 숙달도</div>
      <div class="ring-container">
        <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="var(--sep)" stroke-width="8"/>
        <circle cx="50" cy="50" r="45" fill="none" stroke="url(#grad)" stroke-width="8" stroke-linecap="round"
          stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - pct / 100)}"/>
        <defs><linearGradient id="grad"><stop offset="0%" stop-color="var(--green)"/><stop offset="50%" stop-color="var(--blue)"/><stop offset="100%" stop-color="var(--purple)"/></linearGradient></defs></svg>
        <div class="ring-text"><span style="font-size:22px">${pct}%</span><span style="font-size:11px;color:var(--text2)">숙달</span></div>
      </div>
      <div style="display:flex;justify-content:space-around;text-align:center">
        <div style="flex:1;padding:8px;background:rgba(52,199,89,0.08);border-radius:10px"><div style="font-weight:700;color:var(--green)">${mastered.length}</div><div style="font-size:11px;color:var(--text2)">완벽</div></div>
        <div style="flex:1;padding:8px;background:rgba(0,122,255,0.08);border-radius:10px;margin:0 8px"><div style="font-weight:700;color:var(--blue)">${learning.length}</div><div style="font-size:11px;color:var(--text2)">학습 중</div></div>
        <div style="flex:1;padding:8px;background:var(--sep);border-radius:10px"><div style="font-weight:700">${newW.length}</div><div style="font-size:11px;color:var(--text2)">새 단어</div></div>
      </div>
    </div>
    <div class="card"><div class="card-title">SRS 레벨 분포</div>
      ${levelCounts.map((c, i) => `<div class="stat-row"><span class="stat-label">Lv.${i}</span><div class="stat-bar-bg"><div class="stat-bar" style="width:${c / maxCount * 100}%;background:${barColors[i]}"></div></div><span class="stat-count">${c}</span></div>`).join('')}
    </div>
    <div class="card"><div class="card-title">정답률</div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-size:28px;font-weight:700;color:${acc >= 70 ? 'var(--green)' : 'var(--orange)'}">${acc}%</div><div style="font-size:12px;color:var(--text2)">전체 정답률</div></div>
        <div style="text-align:right;font-size:14px"><div>✅ ${streak.correct}</div><div>❌ ${streak.answered - streak.correct}</div></div>
      </div>
    </div>
    <div class="card"><div class="card-title">최근 오답</div>
      ${!wrongs.length ? '<div style="color:var(--text2)">오답이 없습니다! 대단해요!</div>'
        : wrongs.slice(0, 5).map(w => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
          <span style="font-weight:600">${w.wordHanzi}</span>
          <span class="badge" style="background:${modeColor(w.mode)}22;color:${modeColor(w.mode)}">${modeTitle(w.mode)}</span>
        </div>`).join('')}
    </div>`;
}
