// ============================================================
// UTILS
// ============================================================
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Flush any pending save when tab is closed or hidden
function _flushSave() {
  if (!state.syncEnabled || !state.campaignId || !state.currentUser) return;
  clearTimeout(_saveDebounce);
  localStorage.setItem('chronicler_v2', JSON.stringify(buildSaveData()));
  if (state.currentUser.isDM) {
    window.fbSaveWorld && window.fbSaveWorld(state.campaignId, buildWorldData());
    state.characters.forEach(ch => {
      window.fbSaveCharacter && window.fbSaveCharacter(state.campaignId, ch.id, ch);
    });
  } else {
    const myChar = state.characters.find(ch => ch.player === state.currentUser?.name);
    if (myChar) window.fbSaveCharacter && window.fbSaveCharacter(state.campaignId, myChar.id, myChar);
  }
}
window.addEventListener('beforeunload', _flushSave);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') _flushSave(); });
