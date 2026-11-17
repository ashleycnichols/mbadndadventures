  import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
  import { getDatabase, ref, set, get, onValue, off } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

  const HARDCODED_CONFIG = {
    apiKey: "AIzaSyAR57EkvBIBBZIFmnAxJaiNTd8rIPK5iGg",
    authDomain: "trinitydnd-9091d.firebaseapp.com",
    databaseURL: "https://trinitydnd-9091d-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "trinitydnd-9091d",
    storageBucket: "trinitydnd-9091d.firebasestorage.app",
    messagingSenderId: "862791504900",
    appId: "1:862791504900:web:480f4ff4cff287b8ec9151"
  };
  const HARDCODED_CAMPAIGN_ID = 'trinitydnd';

  window._hardcodedConfig = HARDCODED_CONFIG;
  window._hardcodedCampaignId = HARDCODED_CAMPAIGN_ID;

  try {
    const app = initializeApp(HARDCODED_CONFIG);
    const db = getDatabase(app);

    window.fbSave = function(campaignId, data) {
      return set(ref(db, 'campaigns/' + campaignId), data)
        .catch(e => console.warn('fbSave error:', e));
    };

    // Split-path architecture:
    // campaigns/<id>/characters/<charId>  — each character separate, written by its player
    // campaigns/<id>/world                — maps, tokens, library — written by DM only
    let _charRef = null, _worldRef = null;

    window.fbSaveCharacter = function(campaignId, charId, charData) {
      return set(ref(db, 'campaigns/' + campaignId + '/characters/' + charId), charData)
        .catch(e => console.warn('fbSaveCharacter:', e));
    };

    window.fbDeleteCharacter = function(campaignId, charId) {
      return set(ref(db, 'campaigns/' + campaignId + '/characters/' + charId), null)
        .catch(e => console.warn('fbDeleteCharacter:', e));
    };

    window.fbSaveWorld = function(campaignId, worldData) {
      return set(ref(db, 'campaigns/' + campaignId + '/world'), worldData)
        .catch(e => console.warn('fbSaveWorld:', e));
    };

    // Write a single token's position — used by players moving their own token
    window.fbSaveTokenPos = function(campaignId, mapId, tokenId, x, y) {
      // Find the map index and update just that token in the world/maps array
      // Simpler: write to a separate tokenMoves path the DM listener merges in
      return set(ref(db, 'campaigns/' + campaignId + '/tokenMoves/' + tokenId), { mapId, x, y, _t: Date.now() })
        .catch(e => console.warn('fbSaveTokenPos:', e));
    };

    // Legacy full save — still used for bulk operations
    window.fbSave = function(campaignId, data) {
      return set(ref(db, 'campaigns/' + campaignId), data)
        .catch(e => console.warn('fbSave:', e));
    };

    window.fbListen = function(campaignId, onChars, onWorld, onTokenMove) {
      _charRef = ref(db, 'campaigns/' + campaignId + '/characters');
      _worldRef = ref(db, 'campaigns/' + campaignId + '/world');
      const _moveRef = ref(db, 'campaigns/' + campaignId + '/tokenMoves');
      onValue(_charRef, snap => { onChars(snap.exists() ? snap.val() : {}); });
      onValue(_worldRef, snap => { onWorld(snap.exists() ? snap.val() : null); });
      onValue(_moveRef, snap => { if (snap.exists() && onTokenMove) onTokenMove(snap.val()); });
    };

    window.fbStopListen = function() {
      if (_charRef) { off(_charRef); _charRef = null; }
      if (_worldRef) { off(_worldRef); _worldRef = null; }
    };

    window.fbPauseListen = function() { window.fbStopListen(); };
    window.fbResumeListen = function() {}; // handled by re-listening on login

    window.fbSaveMeta = function(joinCode, metaData) {
      return set(ref(db, 'meta/' + joinCode), metaData)
        .catch(e => console.warn('fbSaveMeta error:', e));
    };

    // Read a meta value once — used for DM password verification
    window.fbFetchMeta = function(joinCode) {
      return get(ref(db, 'meta/' + joinCode)).then(snap => snap.exists() ? snap.val() : null);
    };

    window.fbSaveCharacter = function(campaignId, charId, charData) {
      return set(ref(db, 'campaigns/' + campaignId + '/characters/' + charId), charData)
        .catch(e => console.warn('fbSaveCharacter error:', e));
    };

    window._fbReady = true;
    // Drain any callbacks that were queued while Firebase was loading
    (window._fbReadyQueue || []).forEach(fn => fn());
    window._fbReadyQueue = null;
  } catch(e) {
    console.warn('Firebase init failed:', e.message);
    window._fbReady = false;
  }
