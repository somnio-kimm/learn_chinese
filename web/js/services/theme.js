import { Store } from './store.js';

function isDarkResolved(theme) {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme() {
  const th = Store.theme;
  document.documentElement.setAttribute('data-theme', th);
  const dark = isDarkResolved(th);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#000000' : '#007aff';
  const apple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (apple) apple.content = dark ? 'black-translucent' : 'default';
}

export function watchSystemTheme(cb) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
