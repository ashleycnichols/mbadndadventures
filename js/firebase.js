  import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
  import { getDatabase, ref, set, get, onValue, off, runTransaction } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

  const HARDCODED_CONFIG = {
    apiKey: "AIzaSyAR57EkvBIBBZIFmnAxJaiNTd8rIPK5iGg",
    authDomain: "trinitydnd-9091d.firebaseapp.com",
    databaseURL: "https://trinitydnd-9091d-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "trinitydnd-9091d",
    storageBucket: "trinitydnd-9091d.firebasestorage.app",
    messagingSenderId: "862791504900",
    appId: "1:862791504900:web:480f4ff4cff287b8ec9151"
  };
  window._hardcodedConfig = HARDCODED_CONFIG;

  try {
    const app = initializeApp(HARDCODED_CONFIG);
    const db = getDatabase(app);
    const path = (campaignId, rest) => ref(db, 'campaigns/' + campaignId + (rest ? '/' + rest : ''));

    // Data layout:
    //   campaigns/<id>/characters/<charId>  one record per character
    //   campaigns/<id>/world                maps, tokens, token library, grid (written by the DM)
    //   campaigns/<id>/tokenMoves/<tokenId> player token moves, folded into world by the DM and then cleared
    //   campaigns/<id>/dmNotes/<charId>     DM-only notes (only DM screens load these)
    //   campaignIndex/<id>                  campaign name and settings, listed at login
    //   meta/<id>_auth                      the campaign's DM passphrase hash
    //   meta/_admin                         master passphrase hash, needed to create campaigns

    window.fbSaveCharacter = function(campaignId, charId, charData) {
      return set(path(campaignId, 'characters/' + charId), charData)
        .catch(e => console.warn('fbSaveCharacter:', e));
    };

    window.fbDeleteCharacter = function(campaignId, charId) {
      return set(path(campaignId, 'characters/' + charId), null)
        .catch(e => console.warn('fbDeleteCharacter:', e));
    };

    window.fbSaveWorld = function(campaignId, worldData) {
      return set(path(campaignId, 'world'), worldData)
        .catch(e => console.warn('fbSaveWorld:', e));
    };

    // A player moving their own token writes only to tokenMoves
    window.fbSaveTokenPos = function(campaignId, mapId, tokenId, x, y) {
      return set(path(campaignId, 'tokenMoves/' + tokenId), { mapId, x, y, _t: Date.now() })
        .catch(e => console.warn('fbSaveTokenPos:', e));
    };

    // The DM clears a move once it is folded into the world, but only if no newer move replaced it
    window.fbClearTokenMove = function(campaignId, tokenId, t) {
      return runTransaction(path(campaignId, 'tokenMoves/' + tokenId), cur => {
        if (cur && cur._t !== t) return; // a newer move arrived: leave it
        return null;
      }).catch(e => console.warn('fbClearTokenMove:', e));
    };

    let _refs = [];
    window.fbListen = function(campaignId, onChars, onWorld, onTokenMove) {
      window.fbStopListen();
      const charRef = path(campaignId, 'characters');
      const worldRef = path(campaignId, 'world');
      const moveRef = path(campaignId, 'tokenMoves');
      _refs = [charRef, worldRef, moveRef];
      onValue(charRef, snap => { onChars(snap.exists() ? snap.val() : {}); });
      onValue(worldRef, snap => { onWorld(snap.exists() ? snap.val() : null); });
      onValue(moveRef, snap => { if (onTokenMove) onTokenMove(snap.exists() ? snap.val() : {}); });
    };

    window.fbStopListen = function() {
      _refs.forEach(r => off(r));
      _refs = [];
    };

    window.fbSaveMeta = function(key, metaData) {
      return set(ref(db, 'meta/' + key), metaData)
        .catch(e => console.warn('fbSaveMeta:', e));
    };

    window.fbFetchMeta = function(key) {
      return get(ref(db, 'meta/' + key)).then(snap => snap.exists() ? snap.val() : null);
    };

    // General helpers for the smaller paths (campaign list and settings, DM notes, meta)
    window.fbGet = function(p) {
      return get(ref(db, p)).then(snap => snap.exists() ? snap.val() : null);
    };
    window.fbSet = function(p, value) {
      return set(ref(db, p), value).catch(e => console.warn('fbSet ' + p + ':', e));
    };
    // Returns a function that stops listening
    window.fbOn = function(p, cb) {
      return onValue(ref(db, p), snap => cb(snap.exists() ? snap.val() : null));
    };

    window._fbReady = true;
    // Run anything that was waiting for Firebase
    (window._fbReadyQueue || []).forEach(fn => fn());
    window._fbReadyQueue = null;
  } catch(e) {
    console.warn('Firebase init failed:', e.message);
    window._fbReady = false;
  }
