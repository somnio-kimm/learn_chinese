/**
 * Offline-first updates without a backend: static `version.json` on the same host.
 * - First run: record remote `v` in localStorage (no banner).
 * - Later: if remote `v` > stored, show banner → user reload applies new SW + precache.
 * - Auto check at most once per 7 days when online; settings can force a check.
 */

import { t } from './i18n.js';

const LS_SEEN = 'dataAppSeenV';
const LS_LAST_CHECK = 'dataAppLastUpdateCheck';
const WEEK_MS = 7 * 864e5;

function versionUrl() {
  return new URL('version.json', location.href.split('#')[0]).href;
}

export function isUpdateCheckEnabled() {
  if (!('serviceWorker' in navigator)) return false;
  if (location.protocol === 'file:') return false;
  const h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return false;
  try {
    if (window.Capacitor?.isNativePlatform?.() === true) return false;
  } catch {
    /* ignore */
  }
  return true;
}

export function getSeenBundleVersion() {
  const n = Number(localStorage.getItem(LS_SEEN) || 0);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function ensureBannerHost() {
  const app = document.getElementById('app');
  if (!app) return null;
  let el = document.getElementById('app-update-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-update-banner';
    el.className = 'app-update-banner';
    el.hidden = true;
    el.setAttribute('role', 'status');
    app.insertBefore(el, app.firstChild);
  }
  return el;
}

function showUpdateBanner(remoteV) {
  const el = ensureBannerHost();
  if (!el) return;
  el.hidden = false;
  el.innerHTML = `<span class="app-update-banner__text">${t('updateAvailable')}</span>
    <button type="button" class="btn-primary app-update-banner__reload">${t('updateReload')}</button>`;
  el.querySelector('.app-update-banner__reload').onclick = () => {
    localStorage.setItem(LS_SEEN, String(remoteV));
    location.reload();
  };
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
  showToast._t = setTimeout(() => n.classList.remove('visible'), 2200);
}

/**
 * @returns {{ status: string, remoteV?: number }}
 */
export async function checkForAppUpdate({ force = false, silent = false } = {}) {
  if (!isUpdateCheckEnabled()) {
    return { status: 'disabled' };
  }
  if (!navigator.onLine) {
    if (!silent && force) showToast(t('updateOffline'));
    return { status: 'offline' };
  }

  if (force) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.update();
    } catch {
      /* non-fatal */
    }
  }

  const now = Date.now();
  if (!force) {
    const last = Number(localStorage.getItem(LS_LAST_CHECK) || 0);
    if (now - last < WEEK_MS) {
      return { status: 'throttled' };
    }
  }

  let remoteV = 0;
  try {
    const res = await fetch(versionUrl(), { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    remoteV = Number(j.v) || 0;
  } catch {
    if (!silent && force) showToast(t('updateCheckFailed'));
    return { status: 'fetch-failed' };
  }

  localStorage.setItem(LS_LAST_CHECK, String(now));

  const seen = Number(localStorage.getItem(LS_SEEN) || 0);
  if (remoteV > seen) {
    if (seen === 0) {
      localStorage.setItem(LS_SEEN, String(remoteV));
    } else {
      showUpdateBanner(remoteV);
    }
  } else if (!silent && force) {
    showToast(t('updateAlreadyLatest'));
  }

  return { status: 'ok', remoteV };
}

/** After boot: ping SW (cheap); fetch `version.json` at most once per week. */
export function scheduleAutoUpdateCheck() {
  if (!isUpdateCheckEnabled()) return;
  queueMicrotask(async () => {
    try {
      if (navigator.onLine) {
        const reg = await navigator.serviceWorker.ready;
        await reg.update();
      }
    } catch {
      /* non-fatal */
    }
    await checkForAppUpdate({ force: false, silent: true }).catch(() => {});
  });
}
