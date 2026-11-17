// ============================================================
// PERSISTENCE
// ============================================================
function buildCharactersKeyed() {
  const keyed = {};
  state.characters.forEach(c => { keyed[c.id] = c; });
  return keyed;
}

function buildWorldData() {
  if (state.activeMapId) {
    const m = state.maps.find(m => m.id === state.activeMapId);
    if (m) m.tokens = mapState.tokens;
  }
  return {
    maps: state.maps,
    activeMapId: state.activeMapId,
    tokenLibrary: state.tokenLibrary,
    gridSize: state.gridSize,
    showGrid: state.showGrid,
  };
}

function buildSaveData() {
  return {
    characters: buildCharactersKeyed(),
    ...buildWorldData(),
  };
}

let _saveDebounce = null;
let _suppressRemoteUntil = 0;
function save() {
  const data = buildSaveData();
  localStorage.setItem('chronicler_v2', JSON.stringify(data));
  if (!state.syncEnabled || !state.campaignId) return;
  clearTimeout(_saveDebounce);
  _saveDebounce = setTimeout(() => {
    if (state.currentUser?.isDM) {
      // DM saves world data + all characters
      window.fbSaveWorld && window.fbSaveWorld(state.campaignId, buildWorldData());
      state.characters.forEach(ch => {
        window.fbSaveCharacter && window.fbSaveCharacter(state.campaignId, ch.id, ch);
      });
    } else {
      // Player saves only their own character
      const myChar = state.characters.find(ch => ch.player === state.currentUser?.name);
      if (myChar) window.fbSaveCharacter && window.fbSaveCharacter(state.campaignId, myChar.id, myChar);
    }
  }, 800);
}

function applyData(d) {
  // Handle characters — may be array (legacy) or keyed object
  if (Array.isArray(d.characters)) {
    state.characters = d.characters;
  } else if (d.characters && typeof d.characters === 'object') {
    state.characters = Object.values(d.characters);
  } else {
    state.characters = [];
  }
  // Handle world data — may be nested under 'world' or flat (legacy)
  const world = d.world || d;
  state.gridSize = world.gridSize || 50;
  state.showGrid = world.showGrid !== false;
  state.tokenLibrary = world.tokenLibrary || [];
  const gsInput = document.getElementById('grid-size');
  if (gsInput) gsInput.value = state.gridSize;
  const gtDM = document.getElementById('grid-toggle');
  if (gtDM) gtDM.checked = state.showGrid;
  const gtPlayer = document.getElementById('grid-toggle-player');
  if (gtPlayer) gtPlayer.checked = state.showGrid;
  if (world.maps && world.maps.length) {
    state.maps = world.maps;
    state.activeMapId = world.activeMapId || state.maps[0]?.id;
  } else if (world.mapImg) {
    const legacyMap = { id: 'map_legacy', name: 'Map 1', img: world.mapImg, tokens: world.tokens || [] };
    state.maps = [legacyMap];
    state.activeMapId = legacyMap.id;
  } else {
    state.maps = state.maps.length ? state.maps : [];
    state.activeMapId = state.activeMapId || null;
  }
  const active = state.maps.find(m => m.id === state.activeMapId);
  mapState.tokens = active ? [...(active.tokens || [])] : [];
  state.mapImg = active ? active.img : null;
}

function load() {
  try {
    const d = JSON.parse(localStorage.getItem('chronicler_v2') || '{}');
    applyData(d);
  } catch(e) { console.error(e); }
}

function _rerender() {
  if (!state.currentUser) return;
  renderCharacters();
  renderMapTabs();
  const active = state.maps.find(m => m.id === state.activeMapId);
  if (active?.img && (!mapImage || mapImage.src !== active.img)) {
    const img = new Image();
    img.onload = () => { mapImage = img; redrawMap(); };
    img.src = active.img;
  } else {
    redrawMap();
  }
  renderTokenList();
  renderTokenLibrary();
  if (!state.currentUser?.isDM) {
    const mapPanel = document.getElementById('panel-map');
    if (mapPanel && mapPanel.classList.contains('active')) renderCombatSidebar();
  }
  const sheetPanel = document.getElementById('panel-sheet');
  const typing = document.activeElement && ['TEXTAREA','INPUT','SELECT'].includes(document.activeElement.tagName);
  if (sheetPanel && sheetPanel.classList.contains('active') && !typing) renderMySheet();
  const partyPanel = document.getElementById('panel-party');
  if (partyPanel && partyPanel.classList.contains('active') && !typing) {
    state.dmPartyCharId ? renderDMSheet(state.dmPartyCharId) : renderPartyPanel();
  }
}

// Called when Firebase characters path updates
function onRemoteChars(chars) {
  if (window._fbLoadTimeout) { clearTimeout(window._fbLoadTimeout); window._fbLoadTimeout = null; }
  // Merge incoming characters — never remove chars written by others during suppress
  if (typeof chars === 'object' && chars !== null) {
    const incoming = Object.values(chars);
    if (Date.now() < _suppressRemoteUntil) {
      // During suppress: only add new characters from remote, don't overwrite local
      const localIds = new Set(state.characters.map(c => c.id));
      incoming.forEach(c => { if (!localIds.has(c.id)) state.characters.push(c); });
    } else {
      state.characters = incoming;
    }
  }
  localStorage.setItem('chronicler_v2', JSON.stringify(buildSaveData()));
  _rerender();
}

// Called when Firebase world path updates (DM data)
function onRemoteWorld(world) {
  if (!world) return;
  if (Date.now() < _suppressRemoteUntil) return;
  state.gridSize = world.gridSize || 50;
  state.showGrid = world.showGrid !== false;
  state.tokenLibrary = world.tokenLibrary || [];
  const gsInput = document.getElementById('grid-size');
  if (gsInput) gsInput.value = state.gridSize;
  const gtDM = document.getElementById('grid-toggle');
  if (gtDM) gtDM.checked = state.showGrid;
  const gtPlayer = document.getElementById('grid-toggle-player');
  if (gtPlayer) gtPlayer.checked = state.showGrid;
  if (world.maps && world.maps.length) {
    state.maps = world.maps;
    state.activeMapId = world.activeMapId || state.maps[0]?.id;
  }
  const active = state.maps.find(m => m.id === state.activeMapId);
  mapState.tokens = active ? [...(active.tokens || [])] : [];
  state.mapImg = active ? active.img : null;
  localStorage.setItem('chronicler_v2', JSON.stringify(buildSaveData()));
  _rerender();
}

// Called when a player writes their token position
function onRemoteTokenMove(moves) {
  if (!moves) return;
  let changed = false;
  Object.entries(moves).forEach(([tokenId, move]) => {
    if (!move || move.mapId !== state.activeMapId) return;
    const t = mapState.tokens.find(x => x.id === tokenId);
    if (t && (t.x !== move.x || t.y !== move.y)) {
      t.x = move.x;
      t.y = move.y;
      changed = true;
    }
  });
  if (changed) {
    const active = state.maps.find(m => m.id === state.activeMapId);
    if (active) active.tokens = mapState.tokens;
    redrawMap();
    renderTokenList();
  }
}

// Legacy handler kept for compatibility
function onRemoteData(d) {
  if (d.characters) onRemoteChars(d.characters);
  if (d.world) onRemoteWorld(d.world);
}

function startSync(campaignId) {
  state.campaignId = campaignId;
  state.syncEnabled = true;
  localStorage.setItem('chronicler_campaign_id', campaignId);
  if (window.fbListen) {
    window.fbListen(campaignId, onRemoteChars, onRemoteWorld, onRemoteTokenMove);
  }
  updateSyncStatus('connected');
}

function stopSync() {
  if (window.fbStopListen) window.fbStopListen();
  state.syncEnabled = false;
  updateSyncStatus('off');
}

function updateSyncStatus(status) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  const styles = {
    connected: { text: '🟢 Syncing', color: 'var(--green-health)' },
    connecting: { text: '🟡 Connecting…', color: '#8b6914' },
    off:        { text: '⚪ Local only', color: 'var(--text-muted)' },
    error:      { text: '🔴 Sync error', color: 'var(--blood)' },
  };
  const s = styles[status] || styles.off;
  el.textContent = s.text;
  el.style.color = s.color;
}

function getDMPass() { return localStorage.getItem('chronicler_dm_pass') || 'dm'; }
function setDMPass(p) {
  localStorage.setItem('chronicler_dm_pass', p);
  // Also write to Firebase so all DM devices stay in sync
  if (window.fbSaveMeta && window._hardcodedCampaignId) {
    window.fbSaveMeta(window._hardcodedCampaignId + '_auth', { dmPass: p });
  }
}

