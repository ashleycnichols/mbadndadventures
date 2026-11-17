// ============================================================
// PERSISTENCE
// ============================================================
// How sync works:
// - Every character and the world are compared against the last version
//   received from (or sent to) Firebase. A save sends only what changed.
// - Players write only their own characters. Only the DM writes the world.
// - Incoming updates are never ignored. Local changes not yet sent are kept
//   and sent on the next save.

// Stable comparison form: sorted keys, no null/undefined, no empty
// arrays or objects (Firebase drops those, so they must not count as changes).
function canon(v) {
  if (Array.isArray(v)) {
    const arr = v.map(canon).filter(x => x !== undefined);
    return arr.length ? arr : undefined;
  }
  if (v && typeof v === 'object') {
    const out = {};
    Object.keys(v).sort().forEach(k => {
      const c = canon(v[k]);
      if (c !== undefined) out[k] = c;
    });
    return Object.keys(out).length ? out : undefined;
  }
  return v === null ? undefined : v;
}
function canonStr(v) { return JSON.stringify(canon(v)) || ''; }

// Fill in fields older characters may be missing, so every screen sees the same shape
function normalizeChar(c) {
  if (!c) return c;
  if (!c.usedSlots || typeof c.usedSlots !== 'object') c.usedSlots = {};
  if (!c.tempHp) c.tempHp = 0;
  if (!c.deathSaves) c.deathSaves = { success: 0, fail: 0 };
  if (!c.deathSaves.success) c.deathSaves.success = 0;
  if (!c.deathSaves.fail) c.deathSaves.fail = 0;
  if (!c.hitDiceUsed) c.hitDiceUsed = 0;
  if (!Array.isArray(c.spells)) c.spells = c.spells ? Object.values(c.spells) : [];
  if (!Array.isArray(c.weapons)) c.weapons = c.weapons ? Object.values(c.weapons) : [];
  if (!Array.isArray(c.conditions)) c.conditions = c.conditions ? Object.values(c.conditions) : [];
  if (!Array.isArray(c.skillProfs)) c.skillProfs = c.skillProfs ? Object.values(c.skillProfs) : [];
  if (!c.stats) c.stats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  if (!c.exhaustion) c.exhaustion = 0;
  if (!c.level) c.level = 1;
  if (typeof c.maxHp !== 'number') c.maxHp = +c.maxHp || 10;
  if (typeof c.currentHp !== 'number') c.currentHp = +c.currentHp || 0;
  if (c.inventory === undefined) c.inventory = (typeof STARTING_EQUIPMENT !== 'undefined' && STARTING_EQUIPMENT[c.class]) || "Explorer's pack, 10gp";
  return c;
}

function buildCharactersKeyed() {
  const keyed = {};
  state.characters.forEach(c => { keyed[c.id] = c; });
  return keyed;
}

function buildWorldData() {
  if (state.viewMapId) {
    const m = state.maps.find(m => m.id === state.viewMapId);
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
let _charSnap = {};          // charId -> canonStr last synced
let _worldSnap = null;       // canonStr of the world last synced
let _charsLoaded = false;    // first character snapshot received
let _worldLoaded = false;    // first world snapshot received
let _deletedIds = new Set(); // characters deleted here, until Firebase confirms
let _lastMoves = {};         // latest tokenMoves snapshot

// This device's copy of the campaign (shown if Firebase can't be reached)
function cacheKey() {
  return !state.campaignId || state.campaignId === LEGACY_CAMPAIGN ? 'chronicler_v2' : 'chronicler_v2_' + state.campaignId;
}

function cacheLocally() {
  try { localStorage.setItem(cacheKey(), JSON.stringify(buildSaveData())); }
  catch (e) { console.warn('Local cache full or unavailable:', e.message); }
}

function canWriteChar(ch) {
  if (!state.currentUser) return false;
  return state.currentUser.isDM || ch.player === state.currentUser.name;
}

function save() {
  cacheLocally();
  if (!state.syncEnabled || !state.campaignId) return;
  clearTimeout(_saveDebounce);
  _saveDebounce = setTimeout(_flushSave, 800);
}

// Send changes right away (map uploads, map switches, folding player moves)
function saveNow() {
  cacheLocally();
  clearTimeout(_saveDebounce);
  _flushSave();
}

function worldIsDirty() {
  return _worldLoaded && canonStr(buildWorldData()) !== _worldSnap;
}

function _flushSave() {
  _saveDebounce = null;
  if (!state.syncEnabled || !state.campaignId || !state.currentUser) return;
  if (_charsLoaded) {
    state.characters.forEach(ch => {
      if (!canWriteChar(ch)) return;
      const s = canonStr(ch);
      if (s !== _charSnap[ch.id]) {
        _charSnap[ch.id] = s;
        window.fbSaveCharacter && window.fbSaveCharacter(state.campaignId, ch.id, JSON.parse(JSON.stringify(ch)));
      }
    });
  }
  if (state.currentUser.isDM && _worldLoaded) {
    const w = buildWorldData();
    const s = canonStr(w);
    if (s !== _worldSnap) {
      _worldSnap = s;
      return window.fbSaveWorld && window.fbSaveWorld(state.campaignId, JSON.parse(JSON.stringify(w)));
    }
  }
}

function applyWorld(world) {
  world = world || {};
  state.gridSize = world.gridSize || 50;
  state.showGrid = world.showGrid !== false;
  state.tokenLibrary = Array.isArray(world.tokenLibrary) ? world.tokenLibrary : Object.values(world.tokenLibrary || {});
  if (world.maps && Object.keys(world.maps).length) {
    state.maps = (Array.isArray(world.maps) ? world.maps : Object.values(world.maps))
      .map(m => ({ ...m, tokens: Array.isArray(m.tokens) ? m.tokens : Object.values(m.tokens || {}) }));
    state.activeMapId = state.maps.some(m => m.id === world.activeMapId) ? world.activeMapId : state.maps[0].id;
  } else if (world.mapImg) {
    state.maps = [{ id: 'map_legacy', name: 'Map 1', img: world.mapImg, tokens: world.tokens || [] }];
    state.activeMapId = 'map_legacy';
  } else {
    state.maps = [];
    state.activeMapId = null;
  }
  // Players always see the live map; the DM keeps whatever map they had open
  const isDM = state.currentUser?.isDM;
  if (!isDM || !state.maps.some(m => m.id === state.viewMapId)) state.viewMapId = state.activeMapId;
  const viewed = state.maps.find(m => m.id === state.viewMapId);
  mapState.tokens = viewed ? [...(viewed.tokens || [])] : [];
  syncGridControls();
}

function syncGridControls() {
  const gsInput = document.getElementById('grid-size');
  if (gsInput) gsInput.value = mapGridSize();
  const gtDM = document.getElementById('grid-toggle');
  if (gtDM) gtDM.checked = state.showGrid;
  const gtPlayer = document.getElementById('grid-toggle-player');
  if (gtPlayer) gtPlayer.checked = effectiveShowGrid();
}

function applyData(d) {
  // Local cache format: characters keyed (or legacy array) + flat world fields
  const chars = Array.isArray(d.characters) ? d.characters : Object.values(d.characters || {});
  state.characters = chars.map(normalizeChar);
  applyWorld(d.world || d);
}

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(cacheKey()) || '{}');
    applyData(d);
  } catch(e) { console.error(e); }
}

function _rerender() {
  if (!state.currentUser) return;
  renderCharacters();
  renderMapTabs();
  ensureMapImage();
  redrawMap();
  renderTokenList();
  renderTokenLibrary();
  refreshSheets({ skipIfTyping: true });
}

// Firebase characters path updated
function onRemoteChars(chars) {
  if (window._fbLoadTimeout) { clearTimeout(window._fbLoadTimeout); window._fbLoadTimeout = null; }
  const incoming = Object.values(chars || {}).filter(c => c && c.id).map(normalizeChar);
  const incomingIds = new Set(incoming.map(c => c.id));
  const next = [];

  if (!_charsLoaded) {
    // First snapshot: Firebase is authoritative over anything cached on this device
    incoming.forEach(c => { _charSnap[c.id] = canonStr(c); next.push(c); });
    _charsLoaded = true;
  } else {
    incoming.forEach(inc => {
      if (_deletedIds.has(inc.id)) return;
      const local = state.characters.find(c => c.id === inc.id);
      const localUnsaved = local && canWriteChar(local) && _charSnap[inc.id] !== undefined && canonStr(local) !== _charSnap[inc.id];
      if (localUnsaved) {
        next.push(local); // our change is newer; it goes out on the next save
      } else {
        _charSnap[inc.id] = canonStr(inc);
        next.push(inc);
      }
    });
    // Characters created here and not yet sent stay; ones deleted elsewhere go
    state.characters.forEach(local => {
      if (incomingIds.has(local.id)) return;
      if (_charSnap[local.id] === undefined) next.push(local);
      else delete _charSnap[local.id];
    });
  }
  _deletedIds.forEach(id => { if (!incomingIds.has(id)) _deletedIds.delete(id); });
  state.characters = next;
  cacheLocally();
  if (state.currentUser?.isDM) { applyRacialBonusesToExisting(); syncPortraitsToWorld(); }
  // Anything kept locally but not yet sent goes out now
  if (state.characters.some(c => canWriteChar(c) && canonStr(c) !== _charSnap[c.id])) save();
  _rerender();
}

// Firebase world path updated (written by the DM)
function onRemoteWorld(world) {
  if (window._fbLoadTimeout) { clearTimeout(window._fbLoadTimeout); window._fbLoadTimeout = null; }
  // The DM's own unsent map changes win; they go out on the pending save
  if (_worldLoaded && state.currentUser?.isDM && worldIsDirty()) return;
  applyWorld(world);
  _worldSnap = canonStr(buildWorldData());
  _worldLoaded = true;
  applyTokenMoves();
  if (state.currentUser?.isDM) { syncPortraitsToWorld(); migrateInlineMapImages(); }
  cacheLocally();
  _rerender();
}

// Firebase tokenMoves path updated (players moving their own tokens)
function onRemoteTokenMove(moves) {
  _lastMoves = moves || {};
  if (!_worldLoaded) return; // applied once the world arrives
  if (applyTokenMoves()) {
    redrawMap();
    renderTokenList();
  }
}

// Apply pending player moves. The DM folds them into the world and clears them,
// so a stored move is always newer than the world's position for that token.
function applyTokenMoves() {
  let changed = false;
  const isDM = state.currentUser?.isDM;
  const folded = [];
  Object.entries(_lastMoves).forEach(([tokenId, mv]) => {
    if (!mv) return;
    const map = state.maps.find(m => m.id === mv.mapId);
    const tokens = mv.mapId === state.viewMapId ? mapState.tokens : (map?.tokens || []);
    const t = tokens.find(x => x.id === tokenId);
    if (t && (t.x !== mv.x || t.y !== mv.y) && mapState.dragging !== t) {
      t.x = mv.x;
      t.y = mv.y;
      changed = true;
    }
    folded.push([tokenId, mv._t]);
  });
  if (isDM && folded.length && state.syncEnabled && state.campaignId) {
    const done = changed ? saveNow() : null;
    Promise.resolve(done).then(() => {
      folded.forEach(([id, t]) => window.fbClearTokenMove && window.fbClearTokenMove(state.campaignId, id, t));
    });
  }
  return changed;
}

// DM only: keep token images and the token library in step with character portraits
function syncPortraitsToWorld() {
  if (!state.currentUser?.isDM || !_worldLoaded) return;
  let changed = false;
  state.characters.forEach(ch => {
    if (!ch.portrait) return;
    const libKey = 'char_portrait_' + ch.id;
    const lib = state.tokenLibrary.find(l => l.id === libKey);
    if (!lib) { state.tokenLibrary.push({ id: libKey, name: ch.name, img: ch.portrait, charId: ch.id }); changed = true; }
    else if (lib.img !== ch.portrait || lib.name !== ch.name) { lib.img = ch.portrait; lib.name = ch.name; changed = true; }
    const allTokens = [mapState.tokens, ...state.maps.filter(m => m.id !== state.viewMapId).map(m => m.tokens || [])];
    allTokens.forEach(list => list.forEach(t => {
      if (t.charId === ch.id && t.img !== ch.portrait) { t.img = ch.portrait; changed = true; }
    }));
  });
  if (changed) { save(); renderTokenLibrary(); redrawMap(); }
}

function updateSyncStatus(status) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  const styles = {
    connected: { text: '🟢 Syncing', color: '#8fd48f' },
    connecting: { text: '🟡 Connecting…', color: '#e3b545' },
    off:        { text: '⚪ Local only', color: '#cdb791' },
    error:      { text: '🔴 Offline: changes stay on this device', color: '#ff9a8a' },
  };
  const s = styles[status] || styles.off;
  el.textContent = s.text;
  el.style.color = s.color;
}

// DM passphrase. Only a SHA-256 hash is stored, in Firebase and on this device.
// Note: this hides the passphrase, but anyone with database access can still
// write data unless the Firebase rules are locked down.
function hashPass(p) {
  const bytes = new TextEncoder().encode('chronicler:' + p);
  return crypto.subtle.digest('SHA-256', bytes)
    .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
}

let _usingDefaultPass = false;
const LEGACY_CAMPAIGN = 'trinitydnd'; // the original campaign keeps its old storage keys
function localPassKey(campaignId) {
  return campaignId === LEGACY_CAMPAIGN ? 'chronicler_dm_pass_hash' : 'chronicler_dm_pass_hash_' + campaignId;
}

// Check a DM passphrase for a campaign against Firebase (or, offline, this device)
function checkDMPass(campaignId, pass, meta) {
  return hashPass(pass).then(h => {
    let ok;
    if (meta?.dmPassHash) {
      ok = h === meta.dmPassHash;
    } else if (meta?.dmPass) {
      // Older plain-text passphrase: accept it once, then store only the hash
      ok = pass === meta.dmPass;
      if (ok && window.fbSaveMeta) window.fbSaveMeta(campaignId + '_auth', { dmPassHash: h });
    } else {
      // Nothing in Firebase (offline, or the original campaign before a passphrase was set)
      const localHash = localStorage.getItem(localPassKey(campaignId));
      const legacy = campaignId === LEGACY_CAMPAIGN ? localStorage.getItem('chronicler_dm_pass') : null;
      if (localHash) ok = h === localHash;
      else if (campaignId === LEGACY_CAMPAIGN) { ok = pass === (legacy || 'dm'); _usingDefaultPass = ok && !legacy; }
      else ok = false;
    }
    if (ok) {
      localStorage.setItem(localPassKey(campaignId), h);
      localStorage.removeItem('chronicler_dm_pass');
    }
    return ok;
  });
}

// Fetch the campaign's passphrase record and check it; false if it can't be checked
function verifyCampaignPass(campaignId, pass) {
  const meta = window.fbFetchMeta ? window.fbFetchMeta(campaignId + '_auth').catch(() => null) : Promise.resolve(null);
  return meta.then(m => checkDMPass(campaignId, pass, m));
}

function setDMPass(p) {
  const campaignId = state.campaignId;
  return hashPass(p).then(h => {
    localStorage.setItem(localPassKey(campaignId), h);
    localStorage.removeItem('chronicler_dm_pass');
    _usingDefaultPass = false;
    if (window.fbSaveMeta && campaignId) return window.fbSaveMeta(campaignId + '_auth', { dmPassHash: h });
  });
}
