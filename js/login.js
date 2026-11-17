// ============================================================
// LOGIN
// ============================================================
let selectedRole = 'player';

function selectRole(role) {
  selectedRole = role;
  document.getElementById('role-player').classList.toggle('active', role === 'player');
  document.getElementById('role-dm').classList.toggle('active', role === 'dm');
  document.getElementById('player-name-group').classList.toggle('hidden', role === 'dm');
  document.getElementById('player-joincode-group')?.classList.toggle('hidden', role === 'dm');
  document.getElementById('dm-pass-group').classList.toggle('hidden', role !== 'dm');
}

function enterApp() {
  const err = document.getElementById('login-error');
  err.classList.add('hidden');

  if (selectedRole === 'dm') {
    const pass = document.getElementById('dm-pass-input').value;
    const btn = document.getElementById('enter-btn');
    // Try Firebase for the authoritative pass first, fall back to localStorage
    const checkAndLogin = (storedPass) => {
      if (pass !== storedPass) {
        err.textContent = 'Incorrect passphrase.';
        err.classList.remove('hidden');
        if (btn) btn.disabled = false;
        return;
      }
      // Sync the confirmed pass to localStorage
      localStorage.setItem('chronicler_dm_pass', storedPass);
      state.currentUser = { name: 'Dungeon Master', isDM: true };
      _launchApp();
    };
    if (btn) btn.disabled = true;
    // Fetch authoritative pass from Firebase, waiting for FB to be ready if needed
    const doFetch = () => {
      window.fbFetchMeta(window._hardcodedCampaignId + '_auth').then(meta => {
        checkAndLogin(meta?.dmPass || getDMPass());
      }).catch(() => {
        checkAndLogin(getDMPass());
      });
    };
    if (window._fbReady && window.fbFetchMeta) {
      doFetch();
    } else {
      // Firebase not ready yet (common on mobile cold load) — wait up to 5s
      let waited = 0;
      const poll = setInterval(() => {
        waited += 100;
        if (window._fbReady && window.fbFetchMeta) {
          clearInterval(poll);
          doFetch();
        } else if (waited >= 5000) {
          clearInterval(poll);
          if (btn) btn.disabled = false;
          checkAndLogin(getDMPass()); // fall back to localStorage
        }
      }, 100);
    }
    return;
  } else {
    const name = document.getElementById('player-name-input').value.trim();
    if (!name) { err.textContent = 'Enter your name.'; err.classList.remove('hidden'); return; }
    state.currentUser = { name, isDM: false };

    // Config is hardcoded — always launch directly, sync auto-connects
    _launchApp();
  }
}

function _playerAutoJoin(joinCode) {
  const btn = document.getElementById('enter-btn');
  const connecting = document.getElementById('login-connecting');
  const err = document.getElementById('login-error');
  if (btn) btn.disabled = true;
  if (connecting) connecting.style.display = 'block';

  // We need to initialise Firebase with the config stored in meta.
  // The meta path stores the config + campaignId written by the DM.
  // But we need Firebase to read Firebase — chicken/egg.
  // Solution: DM stores the databaseURL in meta at a predictable public URL,
  // and we bootstrap using a fetch() call to the REST API (no SDK needed).
  const restUrl = `https://${joinCode}-default-rtdb.europe-west1.firebasedatabase.app/meta/${joinCode}.json`;
  const restUrlUs = `https://${joinCode}-default-rtdb.firebaseio.com/meta/${joinCode}.json`;

  // Try europe-west1 first (user's region), fall back to us-central
  const tryFetch = (url) => fetch(url).then(r => r.ok ? r.json() : null);

  // We also store the meta at the campaign databaseURL, so try both patterns
  // DM stores meta at: <databaseURL>/meta/<campaignId>.json
  // We stored campaignId = joinCode typically
  // But we also stored the full databaseURL in meta, so try the saved one first
  const savedFbConfig = localStorage.getItem('chronicler_fb_config');
  const savedCampaignId = localStorage.getItem('chronicler_campaign_id');

  if (savedFbConfig && savedCampaignId === joinCode) {
    // Already have config locally — just connect
    if (connecting) connecting.style.display = 'none';
    if (btn) btn.disabled = false;
    try {
      const config = JSON.parse(savedFbConfig);
      _launchApp();
      _initAndSync(config, joinCode);
    } catch(e) { _launchApp(); }
    return;
  }

  // Try to get meta from Firebase REST API
  // DM must have already connected and pushed meta
  // We stored databaseURL in the meta record itself
  _fetchMetaByCode(joinCode).then(meta => {
    if (connecting) connecting.style.display = 'none';
    if (btn) btn.disabled = false;
    if (meta && meta.config && meta.campaignId) {
      localStorage.setItem('chronicler_fb_config', JSON.stringify(meta.config));
      localStorage.setItem('chronicler_campaign_id', meta.campaignId);
      _launchApp();
      _initAndSync(meta.config, meta.campaignId);
    } else {
      _launchApp(); // proceed locally, sync won't work
    }
  }).catch(e => {
    console.warn('Auto-join failed:', e);
    if (connecting) connecting.style.display = 'none';
    if (btn) btn.disabled = false;
    _launchApp(); // proceed locally
  });
}

function _fetchMetaByCode(joinCode) {
  // DM stores meta at their databaseURL/meta/<campaignId>
  // We saved the databaseURL inside the meta record.
  // The joinCode IS the campaignId. We need to know the databaseURL to read it.
  // Approach: DM also writes to a well-known Firestore-free URL using REST.
  // Since the user's databaseURL contains the project ID, and they named their
  // campaign ID to match their project (common), we try common patterns.
  // More reliable: DM should share the full databaseURL once; we store it in meta.
  // For now, try the campaignId as the project ID pattern:
  const patterns = [
    `https://${joinCode}-default-rtdb.europe-west1.firebasedatabase.app/meta/${joinCode}.json`,
    `https://${joinCode}-default-rtdb.firebaseio.com/meta/${joinCode}.json`,
  ];

  return patterns.reduce((promise, url) =>
    promise.catch(() => fetch(url).then(r => {
      if (!r.ok) throw new Error('not found');
      return r.json();
    }).then(data => {
      if (!data) throw new Error('empty');
      return data;
    })),
    Promise.reject('start')
  );
}

function _initAndSync(config, campaignId) {
  updateSyncStatus('connecting');
  const doSync = () => {
    state.campaignId = campaignId;
    state.syncEnabled = true;
    window.fbListen(campaignId, onRemoteChars, onRemoteWorld, onRemoteTokenMove);
    updateSyncStatus('connected');
  };
  if (window._fbReady) {
    doSync();
  } else {
    window.firebaseInit(config);
    window.addEventListener('fb-ready', doSync, { once: true });
  }
}

function _launchApp() {
  // Don't load from localStorage — Firebase is authoritative.
  // We only use localStorage as a fallback if Firebase never responds.
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('app').style.flexDirection = 'column';

  const badge = document.getElementById('user-badge');
  badge.textContent = (state.currentUser.isDM ? '⚔ DM' : '🧙 ') + state.currentUser.name;
  badge.className = 'user-badge ' + (state.currentUser.isDM ? 'badge-dm' : 'badge-player');

  const isDM = state.currentUser.isDM;
  document.getElementById('dm-token-section').style.display = isDM ? '' : 'none';
  document.getElementById('dm-map-section').style.display = isDM ? '' : 'none';
  document.getElementById('player-map-section').style.display = isDM ? 'none' : '';
  document.getElementById('sheet-tab').style.display = 'block';
  if (isDM) document.getElementById('party-tab').style.display = 'block';

  // Auto-connect to hardcoded campaign — works for both DM and players
  const campaignId = window._hardcodedCampaignId || 'trinitydnd';
  const doAutoSync = () => {
    if (!window._fbReady || !window.fbListen || !window.fbSave) {
      console.warn('Firebase not available — falling back to localStorage');
      load();
      renderCharacters();
      renderMapTabs();
      initMap();
      updateSyncStatus('error');
      return;
    }
    state.campaignId = campaignId;
    localStorage.setItem('chronicler_campaign_id', campaignId);
    if (window._hardcodedConfig) {
      localStorage.setItem('chronicler_fb_config', JSON.stringify(window._hardcodedConfig));
    }
    updateSyncStatus('connecting');
    _suppressRemoteUntil = 0;

    // Both DM and players: just listen — Firebase will push current state via onRemoteData
    state.syncEnabled = true;
    window.fbListen(campaignId, onRemoteChars, onRemoteWorld, onRemoteTokenMove);
    updateSyncStatus('connected');

    // DM also writes meta
    if (state.currentUser.isDM) {
      window.fbSaveMeta && window.fbSaveMeta(campaignId, {
        config: window._hardcodedConfig, campaignId, updatedAt: Date.now()
      });
    }

    // Fallback: if Firebase doesn't respond in 5s, load from localStorage
    const fbTimeout = setTimeout(() => {
      if (!state.characters.length) {
        load();
        renderCharacters();
        renderMapTabs();
        initMap();
      }
    }, 5000);
    // Cancel fallback once Firebase responds (onRemoteData will fire)
    const origOnRemote = onRemoteData;
    window._fbLoadTimeout = fbTimeout;
  };

  if (window._fbReady && window.fbListen) {
    doAutoSync();
  } else {
    window._fbReadyQueue = window._fbReadyQueue || [];
    window._fbReadyQueue.push(doAutoSync);
  }

  renderMapTabs();
  initMap();
}

function logout() {
  if (!confirm('Log out?')) return;
  clearTimeout(_saveDebounce);
  _flushSave();
  // Give Firebase 1s to confirm then reload
  setTimeout(() => location.reload(), 1000);
}

