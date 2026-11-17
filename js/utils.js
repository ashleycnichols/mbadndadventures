// ============================================================
// UTILS
// ============================================================
function esc(s) {
  if (s === null || s === undefined || s === '') return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Send any pending changes when the tab is closed or hidden
function _flushPending() {
  if (_saveDebounce) { clearTimeout(_saveDebounce); _flushSave(); }
}
window.addEventListener('beforeunload', _flushPending);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') _flushPending(); });

// Light or dark theme, remembered on this device only
function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('chronicler_theme', next);
}
