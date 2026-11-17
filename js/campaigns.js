// ============================================================
// CAMPAIGNS
// ============================================================
// Each campaign has its own characters, maps, DM passphrase and settings.
// The list shown at login lives at campaignIndex/<id> = { name, createdAt, roll20Map }.
// Only someone with the master passphrase can create a campaign.

let campaignInfo = {};      // settings of the campaign we're in
let _campaignList = [];
let _campaignInfoOff = null;
const DEFAULT_CAMPAIGNS = [{ id: 'trinitydnd', name: 'Trinity DnD' }];

function loadCampaignList() {
  return new Promise(resolve => {
    whenFirebaseReady(ready => {
      if (!ready || !window.fbGet) {
        const cached = JSON.parse(localStorage.getItem('chronicler_campaigns') || 'null');
        resolve(cached || DEFAULT_CAMPAIGNS);
        return;
      }
      window.fbGet('campaignIndex').then(idx => {
        let list = Object.entries(idx || {}).map(([id, v]) => ({ id, ...v }));
        if (!list.some(c => c.id === 'trinitydnd')) list = [...DEFAULT_CAMPAIGNS, ...list];
        list.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
        localStorage.setItem('chronicler_campaigns', JSON.stringify(list));
        resolve(list);
      }).catch(() => resolve(DEFAULT_CAMPAIGNS));
    }, 8000);
  });
}

function renderCampaignPicker(selectId) {
  return loadCampaignList().then(list => {
    _campaignList = list;
    const sel = document.getElementById('campaign-select');
    if (!sel) return;
    const fromUrl = new URLSearchParams(location.search).get('c');
    const want = selectId || fromUrl || localStorage.getItem('chronicler_last_campaign');
    sel.innerHTML = list.map(c => `<option value="${esc(c.id)}">${esc(c.name || c.id)}</option>`).join('');
    if (want && list.some(c => c.id === want)) sel.value = want;
  });
}

function selectedCampaignId() {
  return document.getElementById('campaign-select')?.value || null;
}

function campaignName(id) {
  return _campaignList.find(c => c.id === id)?.name || campaignInfo?.name || id;
}

function slugify(name) {
  return (name || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'campaign';
}

// ---- Create a campaign (master passphrase) ----
function openCreateCampaign() {
  document.getElementById('create-campaign-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'create-campaign-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:4000;display:flex;align-items:center;justify-content:center;padding:1rem';
  overlay.innerHTML = `<div style="background:var(--parchment);border:2px solid var(--gold);border-radius:2px;padding:1.5rem;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
    <div style="font-family:'Cinzel Decorative',serif;font-size:1rem;color:var(--text-main);margin-bottom:1rem">Create a Campaign</div>
    <div class="input-group"><label>Campaign name</label><input class="parchment-input" id="cc-name" placeholder="e.g. Plexis"></div>
    <div class="input-group"><label>DM passphrase for this campaign</label><input class="parchment-input" id="cc-pass" type="password"></div>
    <div class="input-group"><label>Confirm DM passphrase</label><input class="parchment-input" id="cc-pass2" type="password"></div>
    <div id="cc-master-block">
      <div class="input-group"><label>Master passphrase</label><input class="parchment-input" id="cc-master" type="password" placeholder="Only you know this"></div>
    </div>
    <div id="cc-msg" style="font-size:0.85rem;font-style:italic;min-height:1.2em;margin-bottom:0.5rem"></div>
    <div style="display:flex;gap:0.5rem;justify-content:flex-end">
      <button class="btn-secondary btn-sm" onclick="document.getElementById('create-campaign-overlay').remove()">Cancel</button>
      <button class="btn-primary btn-gold btn-sm" style="width:auto;padding:0.5rem 1.2rem" id="cc-create" onclick="createCampaign()">Create</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  // First time: no master passphrase yet. Setting one needs the Trinity DnD DM passphrase.
  whenFirebaseReady(ready => {
    if (!ready) { ccMsg('Can\'t reach the database right now. Try again when online.', true); return; }
    window.fbGet('meta/_admin').then(admin => {
      if (admin?.hash) return;
      document.getElementById('cc-master-block').innerHTML = `
        <div style="font-size:0.8rem;color:var(--text-muted);font-style:italic;margin-bottom:0.6rem">First time: choose a master passphrase. You'll need it to create campaigns from now on. To prove it's you, enter the Trinity DnD DM passphrase too.</div>
        <div class="input-group"><label>New master passphrase</label><input class="parchment-input" id="cc-master" type="password"></div>
        <div class="input-group"><label>Trinity DnD DM passphrase</label><input class="parchment-input" id="cc-legacy" type="password"></div>`;
    });
  }, 5000);
}

function ccMsg(text, isError) {
  const el = document.getElementById('cc-msg');
  if (el) { el.textContent = text; el.style.color = isError ? 'var(--blood)' : 'var(--green-health)'; }
}

function createCampaign() {
  const name = document.getElementById('cc-name').value.trim();
  const pass = document.getElementById('cc-pass').value;
  const pass2 = document.getElementById('cc-pass2').value;
  const master = document.getElementById('cc-master').value;
  const legacyInput = document.getElementById('cc-legacy');
  if (!name) return ccMsg('Enter a campaign name.', true);
  if (!pass) return ccMsg('Choose a DM passphrase for this campaign.', true);
  if (pass !== pass2) return ccMsg('The DM passphrases don\'t match.', true);
  if (!master) return ccMsg('Enter the master passphrase.', true);
  const btn = document.getElementById('cc-create');
  btn.disabled = true;
  const fail = m => { ccMsg(m, true); btn.disabled = false; };

  window.fbGet('meta/_admin').then(admin => {
    if (admin?.hash) {
      return hashPass(master).then(h => h === admin.hash);
    }
    // First-time setup: prove ownership with the original campaign's DM passphrase
    return verifyCampaignPass('trinitydnd', legacyInput ? legacyInput.value : '').then(ok => {
      if (!ok) return false;
      return hashPass(master).then(h => window.fbSet('meta/_admin', { hash: h })).then(() =>
        window.fbSet('campaignIndex/trinitydnd', { name: 'Trinity DnD', createdAt: Date.now() })).then(() => true);
    });
  }).then(ok => {
    if (!ok) return fail(legacyInput ? 'The Trinity DnD DM passphrase is incorrect.' : 'Incorrect master passphrase.');
    return window.fbGet('campaignIndex').then(idx => {
      let id = slugify(name), n = 2;
      while ((idx && idx[id]) || id === 'trinitydnd') id = slugify(name) + '-' + n++;
      return hashPass(pass).then(h => Promise.all([
        window.fbSet('campaignIndex/' + id, { name, createdAt: Date.now() }),
        window.fbSet('meta/' + id + '_auth', { dmPassHash: h }),
      ])).then(() => {
        document.getElementById('create-campaign-overlay')?.remove();
        renderCampaignPicker(id);
        selectRole('dm');
        showLimitWarning(`"${name}" created. Log in as its DM with the passphrase you just set.`);
      });
    });
  }).catch(e => fail('Something went wrong: ' + e.message));
}

// ---- The campaign we're in ----
function listenCampaignInfo(id) {
  if (_campaignInfoOff) _campaignInfoOff();
  _campaignInfoOff = window.fbOn ? window.fbOn('campaignIndex/' + id, info => {
    if (!info && state.currentUser?.isDM) {
      // Campaign not listed yet (the original one): add it so it shows at login
      window.fbSet('campaignIndex/' + id, { name: campaignName(id), createdAt: Date.now() });
    }
    campaignInfo = info || { name: campaignName(id) };
    applyCampaignInfo();
  }) : null;
  campaignInfo = { name: campaignName(id) };
  applyCampaignInfo();
}

function isRoll20Mode() { return !!campaignInfo?.roll20Map; }

function applyCampaignInfo() {
  const title = document.querySelector('.top-bar-title');
  if (title) title.textContent = '⚔ ' + (campaignInfo.name || 'The Chronicler');
  document.title = (campaignInfo.name ? campaignInfo.name + ' · ' : '') + 'The Chronicler';
  const roll20 = isRoll20Mode();
  const isDM = state.currentUser?.isDM;
  const mapTab = document.getElementById('map-tab');
  if (mapTab) mapTab.style.display = roll20 ? 'none' : '';
  const quickTab = document.getElementById('quick-tab');
  if (quickTab) quickTab.style.display = roll20 && !isDM ? '' : 'none';
  if (roll20 && document.getElementById('panel-map')?.classList.contains('active')) {
    showPanel(isDM ? 'combat' : 'quick');
  }
  // Settings form
  const n = document.getElementById('campaign-name-input');
  if (n && document.activeElement !== n) n.value = campaignInfo.name || '';
  const r = document.getElementById('campaign-roll20-toggle');
  if (r) r.checked = roll20;
}

function saveCampaignSettings() {
  if (!state.currentUser?.isDM) return;
  const name = document.getElementById('campaign-name-input').value.trim() || campaignInfo.name;
  const roll20Map = document.getElementById('campaign-roll20-toggle').checked;
  campaignInfo = { ...campaignInfo, name, roll20Map };
  window.fbSet && window.fbSet('campaignIndex/' + state.campaignId, JSON.parse(JSON.stringify(campaignInfo)));
  applyCampaignInfo();
  const msg = document.getElementById('campaign-settings-msg');
  if (msg) { msg.textContent = 'Saved for everyone in this campaign.'; setTimeout(() => { msg.textContent = ''; }, 2500); }
}
