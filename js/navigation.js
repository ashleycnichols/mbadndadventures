// ============================================================
// NAVIGATION
// ============================================================
function showPanel(id, callerEl) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const panel = document.getElementById('panel-' + id);
  if (panel) panel.classList.add('active');
  // Highlight the matching nav tab (if caller is a nav tab, use it; otherwise find by id)
  const navEl = callerEl?.classList?.contains('nav-tab')
    ? callerEl
    : document.querySelector(`.nav-tab[onclick*="'${id}'"]`);
  if (navEl) navEl.classList.add('active');
  if (id === 'map') { setTimeout(redrawMap, 50); if (!state.currentUser?.isDM) renderCombatSidebar(); }
  if (id === 'sheet') { renderMySheet(); }
  if (id === 'party') {
    if (state.dmPartyCharId) renderDMSheet(state.dmPartyCharId);
    else renderPartyPanel();
  }
  if (id === 'settings') populateSyncSettings();
}


