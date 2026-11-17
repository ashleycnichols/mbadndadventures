// ============================================================
// SETTINGS
// ============================================================
function saveDMPass() {
  const p = document.getElementById('new-dm-pass').value;
  const c = document.getElementById('confirm-dm-pass').value;
  const msg = document.getElementById('settings-msg');
  if (!p) { msg.style.color='var(--blood)'; msg.textContent = 'Enter a passphrase.'; return; }
  if (p !== c) { msg.style.color='var(--blood)'; msg.textContent = 'Passphrases do not match.'; return; }
  setDMPass(p).then(() => {
    msg.style.color = 'var(--green-health)';
    msg.textContent = 'Passphrase saved!';
  });
  document.getElementById('new-dm-pass').value = '';
  document.getElementById('confirm-dm-pass').value = '';
}

// Full backup: every character, map, token and library image
function exportData() {
  // Map images are stored separately; fetch them so the backup is complete
  const images = (window.fbGet && state.syncEnabled)
    ? window.fbGet('campaigns/' + state.campaignId + '/mapImages').catch(() => null)
    : Promise.resolve(null);
  images.then(mapImages => {
    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      campaign: { id: state.campaignId, name: campaignInfo?.name },
      characters: buildCharactersKeyed(),
      world: buildWorldData(),
      mapImages: mapImages || {},
      dmNotes: state.dmNotes || {},
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chronicler-' + slugify(campaignInfo?.name || state.campaignId) + '-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
  });
}

// Restore a backup, replacing the campaign for everyone (DM only)
function importData(evt) {
  const input = evt.target;
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    input.value = '';
    let chars, world, notes = null, mapImages = null;
    try {
      const d = JSON.parse(e.target.result);
      if (d.version === 2) {
        chars = Object.values(d.characters || {});
        world = d.world || {};
        notes = d.dmNotes || {};
        mapImages = d.mapImages || null;
      } else {
        // Older single-map export
        chars = Array.isArray(d.characters) ? d.characters : Object.values(d.characters || {});
        const hasMap = d.mapImg || (d.tokens && d.tokens.length);
        world = {
          maps: hasMap ? [{ id: 'map_' + Date.now(), name: 'Imported map', img: d.mapImg || null, tokens: d.tokens || [] }] : [],
          gridSize: d.gridSize || 50, showGrid: true, tokenLibrary: [],
        };
      }
    } catch(err) { alert('That file isn\'t a Chronicler backup: ' + err.message); return; }
    const mapCount = (Array.isArray(world.maps) ? world.maps : Object.values(world.maps || {})).length;
    if (!confirm(`Replace the whole "${campaignInfo?.name || state.campaignId}" campaign for everyone with this backup?\n\n${chars.length} characters, ${mapCount} maps.\n\nThis cannot be undone. Export a backup first if you might want the current state back.`)) return;

    const keep = new Set(chars.map(c => c.id));
    state.characters.forEach(c => {
      if (keep.has(c.id)) return;
      _deletedIds.add(c.id);
      delete _charSnap[c.id];
      if (state.syncEnabled && window.fbDeleteCharacter) window.fbDeleteCharacter(state.campaignId, c.id);
    });
    state.characters = chars.filter(c => c && c.id).map(normalizeChar);
    if (mapImages && state.syncEnabled && window.fbSet) {
      window.fbSet('campaigns/' + state.campaignId + '/mapImages', mapImages);
      Object.entries(mapImages).forEach(([id, src]) => {
        const maps = Array.isArray(world.maps) ? world.maps : Object.values(world.maps || {});
        const m = maps.find(x => x.id === id);
        if (m) _mapImgCache[id] = { v: m.imgV, src };
      });
    }
    applyWorld(world);
    saveNow();
    if (notes) {
      state.dmNotes = notes;
      if (state.syncEnabled && window.fbSet) window.fbSet('campaigns/' + state.campaignId + '/dmNotes', Object.keys(notes).length ? notes : null);
    }
    _rerender();
    showLimitWarning('Backup restored for everyone.');
  };
  reader.readAsText(file);
}

function clearAll() {
  if (!confirm('Clear the copy stored on this device and log out? Campaign data in the cloud is not affected.')) return;
  Object.keys(localStorage).filter(k => k.startsWith('chronicler_') && k !== 'chronicler_theme').forEach(k => localStorage.removeItem(k));
  location.reload();
}
