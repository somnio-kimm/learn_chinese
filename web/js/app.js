import { renderHome } from './views/home.js';
import { renderWrong } from './views/wrong.js';
import { renderSettings } from './views/settings.js';
import { renderPinyinQuiz } from './quizzes/pinyin.js';
import { renderToneQuiz } from './quizzes/tone.js';
import { renderClozeQuiz } from './quizzes/cloze.js';
import { renderScrambleQuiz } from './quizzes/scramble.js';
import { renderFlashcard } from './quizzes/flashcard.js';
import { renderWordList } from './quizzes/wordlist.js';
import { modeTitle } from './components.js';
import { setNavigate } from './router.js';
import { Store } from './services/store.js';
import { t } from './services/i18n.js';
import { applyTheme, watchSystemTheme } from './services/theme.js';
import { migrateLegacyIfNeeded, loadHskLevels } from './services/vocabulary.js';
import { scheduleAutoUpdateCheck } from './services/app-update.js';

const MAIN = document.getElementById('main');
const HEADER_TITLE = document.getElementById('header-title');
const BACK_BTN = document.getElementById('back-btn');
const TAB_BAR = document.getElementById('tab-bar');
let currentTab = 'home';
let navStack = [];

const renderers = {
  home: renderHome, wrong: renderWrong, settings: renderSettings,
  wordlist: renderWordList, flashcard: renderFlashcard, pinyin: renderPinyinQuiz,
  tone: renderToneQuiz, cloze: renderClozeQuiz, scramble: renderScrambleQuiz,
};

function syncTabLabels() {
  document.querySelectorAll('.tab-btn').forEach(b => {
    const label = b.querySelector('.tab-label');
    if (!label) return;
    if (b.dataset.tab === 'home') label.textContent = t('tabHome');
    if (b.dataset.tab === 'wrong') label.textContent = t('tabWrong');
    if (b.dataset.tab === 'settings') label.textContent = t('tabSettings');
  });
}

function applyHeaderTitle() {
  if (BACK_BTN.hidden) {
    if (currentTab === 'home') HEADER_TITLE.textContent = t('appTitle');
    else if (currentTab === 'wrong') HEADER_TITLE.textContent = t('wrongBook');
    else if (currentTab === 'settings') HEADER_TITLE.textContent = t('tabSettings');
    else HEADER_TITLE.textContent = t('appTitle');
  } else {
    HEADER_TITLE.textContent = modeTitle(currentTab);
  }
}

function refreshChromeAndView() {
  document.documentElement.lang = Store.uiLang === 'ko' ? 'ko' : 'en';
  document.title = t('appTitle');
  syncTabLabels();
  applyHeaderTitle();
  MAIN.innerHTML = '';
  renderers[currentTab]?.(MAIN);
  window.scrollTo(0, 0);
}

function navigateTo(page, opts = {}) {
  navStack.push(currentTab);
  currentTab = page;
  HEADER_TITLE.textContent = opts.title || modeTitle(page) || t('appTitle');
  BACK_BTN.hidden = false;
  MAIN.innerHTML = '';
  renderers[page]?.(MAIN);
  window.scrollTo(0, 0);
}

setNavigate(navigateTo);

function goBack() {
  const prev = navStack.pop();
  if (prev) switchTab(prev);
  else switchTab('home');
}

function switchTab(tab) {
  currentTab = tab;
  navStack = [];
  BACK_BTN.hidden = true;
  applyHeaderTitle();
  MAIN.innerHTML = '';
  renderers[tab]?.(MAIN);
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  window.scrollTo(0, 0);
}

BACK_BTN.addEventListener('click', goBack);

document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

window.addEventListener('app-locale-changed', () => refreshChromeAndView());

applyTheme();
watchSystemTheme(() => {
  if (Store.theme === 'system') applyTheme();
});

const isLocalDev =
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1' ||
  location.hostname === '[::1]' ||
  /^(capacitor|ionic):/i.test(location.protocol);

function isCapacitorNative() {
  try {
    return window.Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

/**
 * Unregister SW on dev / native. If a controller was active, it keeps intercepting fetches until
 * the page reloads — reload once so vocabulary JSON requests actually hit the network.
 */
async function initServiceWorkerForBoot() {
  if (!('serviceWorker' in navigator)) return false;
  if (isLocalDev || isCapacitorNative()) {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (!regs.length) return false;
    const hadController = !!navigator.serviceWorker.controller;
    await Promise.all(regs.map((r) => r.unregister()));
    if (hadController) {
      location.reload();
      return true;
    }
    return false;
  }
  navigator.serviceWorker.register('sw.js').catch(() => {});
  return false;
}

async function boot() {
  TAB_BAR.hidden = true;

  if (await initServiceWorkerForBoot()) return;

  try {
    migrateLegacyIfNeeded();
  } catch {
    /* non-fatal */
  }

  if (location.protocol === 'file:') {
    MAIN.innerHTML = `<div class="card boot-error">
      <p class="boot-err-title">${t('vocabLoadError')}</p>
      <p class="boot-err-detail">${t('fileProtocolHint')}</p>
    </div>`;
    TAB_BAR.hidden = false;
    syncTabLabels();
    return;
  }

  MAIN.innerHTML = `<div class="boot-screen"><div class="boot-spinner" aria-hidden="true"></div><p class="boot-msg">${t('loadingWords')}</p></div>`;

  try {
    await loadHskLevels(Store.hskLevels);
  } catch (e) {
    MAIN.innerHTML = `<div class="card boot-error">
      <p class="boot-err-title">${t('vocabLoadError')}</p>
      <p class="boot-err-detail">${String(e.message || e)}</p>
      <button type="button" class="btn-primary boot-retry">${t('retry')}</button>
    </div>`;
    MAIN.querySelector('.boot-retry').onclick = () => boot();
    TAB_BAR.hidden = false;
    syncTabLabels();
    return;
  }

  TAB_BAR.hidden = false;
  syncTabLabels();
  switchTab('home');
  scheduleAutoUpdateCheck();
}

boot().catch((e) => {
  TAB_BAR.hidden = false;
  MAIN.innerHTML = `<div class="card boot-error">
    <p class="boot-err-title">${t('bootUnexpectedError')}</p>
    <p class="boot-err-detail">${String(e && e.message ? e.message : e)}</p>
    <button type="button" class="btn-primary boot-retry">${t('retry')}</button>
  </div>`;
  const btn = MAIN.querySelector('.boot-retry');
  if (btn) btn.onclick = () => boot();
  syncTabLabels();
});
