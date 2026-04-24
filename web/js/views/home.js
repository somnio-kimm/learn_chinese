import { Store } from '../services/store.js';
import { Haptic } from '../services/haptic.js';
import { modeColor, modeTitle, modeIcon, QUIZ_MODES } from '../components.js';
import { navigate } from '../router.js';
import { t } from '../services/i18n.js';
import { loadHskLevels } from '../services/vocabulary.js';

export function renderHome(el) {
  const selectedLv = Store.hskLevels[0] ?? 1;
  let switching = false;

  el.innerHTML = `
    <div class="card">
      <div style="font-size:14px;font-weight:600;margin-bottom:10px">${t('studyLevel')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${[1,2,3,4,5,6,7].map(lv => `
          <button class="hsk-chip ${selectedLv === lv ? 'active' : ''}" data-lv="${lv}">${lv === 7 ? 'HSK 7–9' : `HSK ${lv}`}</button>
        `).join('')}
      </div>
    </div>
    <div class="quiz-grid">
      ${QUIZ_MODES.map(m => `
        <div class="quiz-card" data-quiz="${m}">
          <div class="quiz-icon" style="background:${modeColor(m)}">${modeIcon(m)}</div>
          <div class="quiz-label">${modeTitle(m)}</div>
        </div>`).join('')}
    </div>`;

  const levelCard = el.querySelector('.card');
  el.querySelectorAll('.hsk-chip').forEach(b => {
    b.onclick = async () => {
      if (switching) return;
      const lv = Number(b.dataset.lv);
      const prev = Store.hskLevels;
      if (prev.length === 1 && prev[0] === lv) return;
      switching = true;
      const busy = document.createElement('div');
      busy.className = 'hsk-load-mask';
      busy.innerHTML = `<span class="hsk-load-txt">${t('loadingLevels')}</span>`;
      levelCard.style.position = 'relative';
      levelCard.appendChild(busy);
      el.querySelectorAll('.hsk-chip').forEach(chip => { chip.disabled = true; });
      try {
        await loadHskLevels([lv]);
        Store.hskLevels = [lv];
        Haptic.light();
        renderHome(el);
      } catch {
        Store.hskLevels = prev;
        busy.remove();
        el.querySelectorAll('.hsk-chip').forEach(chip => { chip.disabled = false; });
        switching = false;
        alert(t('vocabLoadError'));
      }
    };
  });
  el.querySelectorAll('.quiz-card').forEach(c => c.onclick = () => {
    Haptic.light(); navigate(c.dataset.quiz, { title: modeTitle(c.dataset.quiz) });
  });
}
