// ============================================================
// SETTINGS
// ============================================================
function saveDMPass() {
  const p = document.getElementById('new-dm-pass').value;
  const c = document.getElementById('confirm-dm-pass').value;
  const msg = document.getElementById('settings-msg');
  if (!p) { msg.style.color='var(--blood)'; msg.textContent = 'Enter a passphrase.'; return; }
  if (p !== c) { msg.style.color='var(--blood)'; msg.textContent = 'Passphrases do not match.'; return; }
  setDMPass(p);
  msg.style.color = 'var(--green-health)';
  msg.textContent = 'Passphrase saved!';
  document.getElementById('new-dm-pass').value = '';
  document.getElementById('confirm-dm-pass').value = '';
}

function exportData() {
  const data = {
    characters: state.characters,
    tokens: mapState.tokens,
    mapImg: state.mapImg,
    gridSize: state.gridSize,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'chronicler-campaign.json';
  a.click();
}

function importData(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const d = JSON.parse(e.target.result);
      if (d.characters) state.characters = d.characters;
      if (d.tokens) mapState.tokens = d.tokens;
      if (d.mapImg) { state.mapImg = d.mapImg; const img = new Image(); img.onload=()=>{mapImage=img;redrawMap();}; img.src=d.mapImg; }
      if (d.gridSize) state.gridSize = d.gridSize;
      save();
      renderCharacters();
      redrawMap();
      alert('Campaign data imported!');
    } catch(err) { alert('Error importing data: ' + err.message); }
  };
  reader.readAsText(file);
}

function clearAll() {
  if (!confirm('Clear ALL campaign data? This cannot be undone.')) return;
  localStorage.removeItem('chronicler_v2');
  location.reload();
}

