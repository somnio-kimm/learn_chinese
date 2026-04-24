import { Store } from '../services/store.js';
import { Haptic } from '../services/haptic.js';
import { t } from '../services/i18n.js';
import { applyTheme } from '../services/theme.js';
import { resetCache } from '../services/vocabulary.js';
import { checkForAppUpdate, getSeenBundleVersion, isUpdateCheckEnabled } from '../services/app-update.js';

const APP_VERSION = '1.0.0';
/** Optional: set to your support address so reports go to a fixed inbox. Empty = user picks recipient. */
const BUG_REPORT_EMAIL = 'somnio.box@gmail.com';
const VOCAB_ISSUES = 'https://github.com/drkameleon/complete-hsk-vocabulary/issues';
/** e.g. https://www.patreon.com/yourname */
const PATREON_URL = 'https://www.patreon.com/somnio_box';
/** mailto: URLs are length-limited on some clients; beyond this we copy the full body and open a short mail. */
const MAILTO_SAFE_LEN = 1700;

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function runtimeKind() {
  try {
    if (window.Capacitor?.isNativePlatform?.() === true) return 'capacitor';
  } catch {
    /* ignore */
  }
  return 'web';
}

function bugDiagnostics(userNote = '') {
  const bundleV = getSeenBundleVersion();
  const lines = [
    `Chinese Study v${APP_VERSION}`,
    `dataBundle: ${bundleV ?? '—'}`,
    `runtime: ${runtimeKind()}`,
    `URL: ${location.href}`,
    `online: ${navigator.onLine}`,
    `uiLang: ${Store.uiLang}`,
    `theme: ${Store.theme}`,
    `haptic: ${Store.hapticEnabled}`,
    `UA: ${navigator.userAgent}`,
    `platform: ${navigator.platform}`,
    `viewport: ${typeof window.visualViewport !== 'undefined' ? `${visualViewport.width}x${visualViewport.height}` : `${innerWidth}x${innerHeight}`}`,
  ];
  const note = String(userNote || '').trim();
  if (note) {
    lines.push('', '--- What happened ---', note);
  } else {
    lines.push('', '(No description — please add what you were doing if you can.)');
  }
  return lines.join('\n');
}

async function openBugReportComposer(body) {
  const sub = encodeURIComponent(`[Chinese Study] Bug / feedback (${APP_VERSION})`);
  const prefix = BUG_REPORT_EMAIL.trim() ? `mailto:${BUG_REPORT_EMAIL.trim()}` : 'mailto:';
  let encBody = encodeURIComponent(body);
  let url = `${prefix}?subject=${sub}&body=${encBody}`;
  if (url.length > MAILTO_SAFE_LEN) {
    try {
      await navigator.clipboard.writeText(body);
      showToast(t('bugReportCopiedFull'));
    } catch {
      window.prompt(t('copyFallback'), body);
      return;
    }
    encBody = encodeURIComponent(t('bugReportPasteBody'));
    url = `${prefix}?subject=${sub}&body=${encBody}`;
  }
  window.location.href = url;
}

function licenseSections() {
  const ko = Store.uiLang === 'ko';
  if (ko) {
    return [
      ['단어 데이터', 'HSK 단어 목록: complete-hsk-vocabulary (MIT)\nhttps://github.com/drkameleon/complete-hsk-vocabulary\n\n프로젝트 설명에 따르면 영문 정의 등은 MDBG/CC-CEDICT 등 출처를 바탕으로 합니다.'],
      ['이 앱', '로컬에 저장되는 학습용 PWA입니다. 저장소에 별도 LICENSE가 없다면 개인 학습 용도로 이용해 주세요.'],
    ];
  }
  return [
    ['Vocabulary', 'HSK lists: complete-hsk-vocabulary (MIT)\nhttps://github.com/drkameleon/complete-hsk-vocabulary\n\nPer that project, English glosses draw on sources such as MDBG / CC-CEDICT.'],
    ['This app', 'An offline-first study PWA with local storage. If no LICENSE is in the repo, treat as personal/educational use unless stated otherwise.'],
  ];
}

function showToast(msg) {
  const host = document.getElementById('app') || document.body;
  let n = host.querySelector('.settings-toast');
  if (!n) {
    n = document.createElement('div');
    n.className = 'settings-toast';
    host.appendChild(n);
  }
  n.textContent = msg;
  n.classList.add('visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => n.classList.remove('visible'), 2000);
}

function openLicenseSheet() {
  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';
  const blocks = licenseSections()
    .map(([h, p]) => `<div class="lic-block"><div class="lic-h">${esc(h)}</div><pre class="lic-body">${esc(p)}</pre></div>`)
    .join('');
  overlay.innerHTML = `<div class="detail-sheet lic-sheet">
    <div class="lic-head">
      <span>${esc(t('licenseTitle'))}</span>
      <button type="button" class="close-btn lic-x">✕</button>
    </div>
    <div class="lic-scroll">${blocks}</div>
    <button type="button" class="btn-primary lic-done">${esc(t('licenseClose'))}</button>
  </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('.lic-x').onclick = close;
  overlay.querySelector('.lic-done').onclick = close;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}

function resetStudyData() {
  if (!confirm(t('resetStudyConfirm'))) return;
  resetCache();
  localStorage.removeItem('srsById');
  localStorage.removeItem('words');
  localStorage.removeItem('wordsDataVersion');
  localStorage.removeItem('wrong');
  localStorage.removeItem('streak');
  localStorage.removeItem('hskLevels');
  location.reload();
}

function segBtn(value, label, active) {
  return `<button type="button" class="set-seg-btn ${active ? 'active' : ''}" data-v="${value}">${esc(label)}</button>`;
}

function buildMarkup() {
  const th = Store.theme;
  const lang = Store.uiLang;
  const hap = Store.hapticEnabled;
  return `<div class="set-page">
    <div class="set-card">
      <div class="set-line set-line--stack">
        <span class="set-k">${esc(t('settingsAppearance'))}</span>
        <div class="set-seg" data-role="theme">
          ${segBtn('light', t('themeLight'), th === 'light')}
          ${segBtn('dark', t('themeDark'), th === 'dark')}
          ${segBtn('system', t('themeSystem'), th === 'system')}
        </div>
      </div>
      <div class="set-hr"></div>
      <div class="set-line">
        <span class="set-k">${esc(t('settingsHaptic'))}</span>
        <button type="button" class="toggle-switch toggle-compact ${hap ? 'on' : ''}" id="set-haptic"
          role="switch" aria-checked="${hap}"></button>
      </div>
      <div class="set-hr"></div>
      <div class="set-line set-line--stack">
        <span class="set-k">${esc(t('settingsLanguage'))}</span>
        <div class="set-seg" data-role="lang">
          ${segBtn('ko', 'KO', lang === 'ko')}
          ${segBtn('en', 'EN', lang === 'en')}
        </div>
      </div>
    </div>
    ${isUpdateCheckEnabled()
      ? `<div class="set-card">
      <div class="set-line set-line--stack">
        <span class="set-k">${esc(t('settingsUpdates'))}</span>
        <span class="set-hint">${esc(t('dataBundle'))} · v${getSeenBundleVersion() ?? '—'}</span>
        <button type="button" class="btn-primary set-update-btn" id="set-check-update">${esc(t('updateCheck'))}</button>
      </div>
    </div>`
      : ''}
    <div class="set-card">
      <div class="set-line set-line--stack">
        <span class="set-k">${esc(t('settingsBug'))}</span>
        <span class="set-hint">${esc(t('bugReportHint'))}</span>
      </div>
      <textarea class="set-bug-desc" id="set-bug-desc" rows="3" maxlength="8000"
        placeholder="${esc(t('bugReportPlaceholder'))}" spellcheck="true"></textarea>
      <div class="set-bug-actions">
        <button type="button" class="btn-primary set-bug-send" id="set-bug-send">${esc(t('bugSendReport'))}</button>
        <button type="button" class="set-chip set-bug-chip" id="set-bug-copy">${esc(t('bugCopyInfo'))}</button>
        <a class="set-chip set-bug-chip" href="${VOCAB_ISSUES}" target="_blank" rel="noopener" title="${esc(t('bugDataIssues'))}">GitHub</a>
      </div>
      ${PATREON_URL.trim()
      ? `<div class="set-patreon-wrap">
        <a class="set-patreon" href="${esc(PATREON_URL.trim())}" target="_blank" rel="noopener noreferrer">${esc(t('supportPatreon'))}</a>
      </div>`
      : ''}
      <button type="button" class="set-danger" id="set-reset">${esc(t('resetStudy'))}</button>
      <div class="set-meta">
        <span class="set-meta-ver">v${APP_VERSION}</span>
        <button type="button" class="set-textbtn" id="set-license">${esc(t('openLicense'))}</button>
      </div>
    </div>
  </div>`;
}

function bind(root, host) {
  root.querySelector('[data-role="theme"]').querySelectorAll('.set-seg-btn').forEach(b => {
    b.onclick = () => {
      Store.theme = b.dataset.v;
      applyTheme();
      Haptic.light();
      host.innerHTML = buildMarkup();
      bind(host.querySelector('.set-page'), host);
    };
  });

  root.querySelector('[data-role="lang"]').querySelectorAll('.set-seg-btn').forEach(b => {
    b.onclick = () => {
      const v = b.dataset.v;
      if (v !== 'ko' && v !== 'en') return;
      Store.uiLang = v;
      Haptic.light();
      window.dispatchEvent(new CustomEvent('app-locale-changed'));
    };
  });

  root.querySelector('#set-haptic').onclick = () => {
    Store.hapticEnabled = !Store.hapticEnabled;
    if (Store.hapticEnabled) Haptic.light();
    const row = root.querySelector('#set-haptic');
    row.classList.toggle('on', Store.hapticEnabled);
    row.setAttribute('aria-checked', String(Store.hapticEnabled));
  };

  root.querySelector('#set-bug-copy').onclick = async () => {
    const note = root.querySelector('#set-bug-desc')?.value ?? '';
    const text = bugDiagnostics(note);
    try {
      await navigator.clipboard.writeText(text);
      showToast(t('copied'));
    } catch {
      window.prompt(t('copyFallback'), text);
    }
    Haptic.light();
  };

  root.querySelector('#set-bug-send').onclick = async () => {
    Haptic.light();
    if (!navigator.onLine) {
      showToast(t('bugReportOffline'));
      return;
    }
    const note = root.querySelector('#set-bug-desc')?.value ?? '';
    await openBugReportComposer(bugDiagnostics(note));
  };

  root.querySelector('#set-reset').onclick = () => { Haptic.light(); resetStudyData(); };
  root.querySelector('#set-license').onclick = () => { Haptic.light(); openLicenseSheet(); };
  root.querySelector('#set-check-update')?.addEventListener('click', async () => {
    Haptic.light();
    await checkForAppUpdate({ force: true, silent: false });
  });
}

export function renderSettings(el) {
  el.innerHTML = buildMarkup();
  bind(el.querySelector('.set-page'), el);
}
