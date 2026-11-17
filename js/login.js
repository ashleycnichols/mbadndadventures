// ============================================================
// LOGIN
// ============================================================
let selectedRole = 'player';

function selectRole(role) {
  selectedRole = role;
  document.getElementById('role-player').classList.toggle('active', role === 'player');
  document.getElementById('role-dm').classList.toggle('active', role === 'dm');
  document.getElementById('player-name-group').classList.toggle('hidden', role === 'dm');
  document.getElementById('dm-pass-group').classList.toggle('hidden', role !== 'dm');
}

// Wait for Firebase to load, up to a limit, then run fn(ready)
function whenFirebaseReady(fn, limitMs) {
  if (window._fbReady && window.fbListen) { fn(true); return; }
  let waited = 0;
  const poll = setInterval(() => {
    waited += 100;
    if (window._fbReady && window.fbListen) { clearInterval(poll); fn(true); }
    else if (waited >= limitMs) { clearInterval(poll); fn(false); }
  }, 100);
}

function enterApp() {
  const err = document.getElementById('login-error');
  err.classList.add('hidden');
  const campaignId = selectedCampaignId();
  if (!campaignId) { err.textContent = 'Choose a campaign.'; err.classList.remove('hidden'); return; }
  state.campaignId = campaignId;
  localStorage.setItem('chronicler_last_campaign', campaignId);

  if (selectedRole === 'dm') {
    const pass = document.getElementById('dm-pass-input').value;
    const btn = document.getElementById('enter-btn');
    if (btn) btn.disabled = true;
    const fail = () => {
      err.textContent = 'Incorrect passphrase.';
      err.classList.remove('hidden');
      if (btn) btn.disabled = false;
    };
    const succeed = () => {
      state.currentUser = { name: 'Dungeon Master', isDM: true };
      _launchApp();
      if (_usingDefaultPass) setTimeout(() => showLimitWarning('You are using the default DM passphrase. Set your own in Settings.'), 800);
    };
    // Firebase holds the authoritative passphrase; fall back to this device if it can't be reached
    whenFirebaseReady(ready => {
      (ready ? verifyCampaignPass(campaignId, pass) : checkDMPass(campaignId, pass, null))
        .then(ok => ok ? succeed() : fail());
    }, 5000);
    return;
  }

  const name = document.getElementById('player-name-input').value.trim();
  if (!name) { err.textContent = 'Enter your name.'; err.classList.remove('hidden'); return; }
  state.currentUser = { name, isDM: false };
  _launchApp();
}

function _launchApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('app').style.flexDirection = 'column';

  const isDM = state.currentUser.isDM;
  const badge = document.getElementById('user-badge');
  badge.textContent = (isDM ? '⚔ DM' : '🧙 ') + (isDM ? '' : state.currentUser.name);
  badge.className = 'user-badge ' + (isDM ? 'badge-dm' : 'badge-player');

  document.getElementById('dm-token-section').style.display = isDM ? '' : 'none';
  document.getElementById('dm-map-section').style.display = isDM ? '' : 'none';
  document.getElementById('player-map-section').style.display = isDM ? 'none' : '';
  // The DM works from the Party tab; players get My Sheet
  document.getElementById('sheet-tab').style.display = isDM ? 'none' : 'block';
  document.getElementById('party-tab').style.display = isDM ? 'block' : 'none';
  document.querySelectorAll('.dm-only').forEach(el => { el.style.display = isDM ? '' : 'none'; });
  document.getElementById('combat-tab').style.display = isDM ? 'block' : 'none';
  campaignInfo = { name: campaignName(state.campaignId) };
  applyCampaignInfo();

  initMap();
  renderCharacters();
  renderMapTabs();
  updateSyncStatus('connecting');

  whenFirebaseReady(ready => {
    if (!ready) {
      // Firebase didn't load (offline or blocked): show this device's cached copy
      console.warn('Firebase not available, using this device\'s cached data');
      state.syncEnabled = false;
      load();
      _rerender();
      updateSyncStatus('error');
      return;
    }
    const campaignId = state.campaignId;
    state.syncEnabled = true;
    window.fbListen(campaignId, onRemoteChars, onRemoteWorld, onRemoteTokenMove);
    listenCampaignInfo(campaignId);
    if (isDM) listenDMNotes(campaignId);
    updateSyncStatus('connected');

    // If Firebase is slow to send data, show the cached copy meanwhile.
    // The first real snapshot replaces it.
    window._fbLoadTimeout = setTimeout(() => {
      window._fbLoadTimeout = null;
      if (!_charsLoaded && !_worldLoaded) { load(); _rerender(); }
    }, 5000);
  }, 8000);
}

function logout() {
  if (!confirm('Log out?')) return;
  _flushSave();
  // Give Firebase a moment to send, then reload
  setTimeout(() => location.reload(), 1000);
}

// Fill the campaign list as soon as the login screen shows
document.addEventListener('DOMContentLoaded', () => renderCampaignPicker());
