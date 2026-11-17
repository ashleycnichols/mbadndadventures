// ============================================================
// SYNC
// ============================================================
function connectSync() {
  const campaignId = document.getElementById('campaign-id-input').value.trim();
  const configStr = document.getElementById('firebase-config-input').value.trim();
  const msg = document.getElementById('sync-settings-msg');
  if (!campaignId) { msg.style.color='var(--blood)'; msg.textContent='Enter a Campaign ID.'; return; }

  state.campaignId = campaignId;
  localStorage.setItem('chronicler_campaign_id', campaignId);

  if (configStr) {
    try {
      const config = JSON.parse(configStr);
      localStorage.setItem('chronicler_fb_config', configStr);
      updateSyncStatus('connecting');
      msg.style.color='var(--gold)'; msg.textContent='Connecting…';
      const doConnect = () => {
        window.firebaseInit(config);
        // Push current data + write meta for player auto-join
        const localData = JSON.parse(localStorage.getItem('chronicler_v2') || '{}');
        Promise.all([
          window.fbSave(campaignId, localData),
          window.fbSaveMeta(campaignId, { config, campaignId, updatedAt: Date.now() }),
        ]).then(() => {
          startSync(campaignId);
          msg.style.color='var(--green-health)';
          msg.textContent='✓ Connected as "' + campaignId + '" — players can now join with just the Campaign ID!';
        });
      };
      if (window.firebaseInit) doConnect();
      else window.addEventListener('fb-ready', doConnect, { once: true });
    } catch(e) {
      msg.style.color='var(--blood)'; msg.textContent='Invalid JSON config: ' + e.message;
      return;
    }
  } else if (window._fbReady && localStorage.getItem('chronicler_fb_config')) {
    startSync(campaignId);
    msg.style.color='var(--green-health)'; msg.textContent='Now syncing as "' + campaignId + '"';
  } else {
    msg.style.color='var(--blood)'; msg.textContent='Paste your Firebase config JSON above.';
  }
}

function populateSyncSettings() {
  // Only DMs can see/change the passphrase
  const dmSection = document.getElementById('dm-pass-settings-section');
  if (dmSection) dmSection.style.display = state.currentUser?.isDM ? '' : 'none';
  const idInput = document.getElementById('campaign-id-input');
  const cfgInput = document.getElementById('firebase-config-input');
  if (idInput && state.campaignId) idInput.value = state.campaignId;
  const saved = localStorage.getItem('chronicler_fb_config');
  if (cfgInput && saved) cfgInput.value = saved;
}

