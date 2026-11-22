// ============================================================
// MAP / CANVAS
// ============================================================
let canvas, ctx, mapImage = null;
let pendingTokenImg = null;


// ============================================================
// COMBAT SIDEBAR (player map panel)
// ============================================================
// The sidebar reuses the sheet's actions; refreshSheets() redraws the sidebar
function mapToggleSlot(id, spellLevel, slotIndex) { toggleSlot(id, spellLevel, slotIndex); }
function mapUseHitDie(id) { useHitDie(id); }
function mapShortRest(id) { doShortRest(id); }
function mapLongRest(id) { doLongRest(id); }
function mapToggleDeathSave(id, type, index) { toggleDeathSave(id, type, index); }

// Compact character view: the map sidebar and the Quick View (for Roll20 campaigns)
function compactSheetHTML(c, prefix) {
  normalizeChar(c);

  const cls = CLASSES.find(cl => cl.id === c.class);
  const race = RACES.find(r => r.id === c.race);
  const profBonus = Math.ceil(c.level / 4) + 1;
  const getMod = s => Math.floor(((c.stats[s]||10) - 10) / 2);
  const hpPct = Math.max(0, Math.round(c.currentHp / c.maxHp * 100));
  const hpColor = hpPct > 60 ? 'var(--green-health)' : hpPct > 25 ? 'var(--amber)' : 'var(--blood)';
  const initMod = initiativeBonus(c);
  const spellMod = cls?.statHp ? getMod(cls.statHp) : 0;
  const spellDC = 8 + profBonus + spellMod;
  const spellAtk = profBonus + spellMod;

  // Spell slots
  const lvlIdx = Math.min(c.level - 1, 19);
  const slotCounts = cls?.spellSlots?.[lvlIdx] || [];
  const hasSlots = slotCounts.some(Boolean);

  // Weapons
  const weaponObjs = (c.weapons||[]).map(id => WEAPONS.find(w => w.id === id)).filter(Boolean);

  // Spells
  const spellObjs = (c.spells||[]).map(id => SPELLS.find(s => s.id === id)).filter(Boolean);
  const cantrips = spellObjs.filter(s => s.level === 0);
  const leveled = spellObjs.filter(s => s.level > 0);

  // Dead / dying
  const isDying = c.currentHp <= 0;

  // Section styles
  const sec = 'padding:0.75rem;border-bottom:1px solid var(--border)';
  const label = 'font-family:var(--font-ui);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:0.3rem';
  const pipBtn = (filled, onclick) => `<button onclick="${onclick}" style="width:14px;height:14px;border-radius:50%;border:1.5px solid ${filled ? (hpColor) : 'var(--border)'};background:${filled ? hpColor : 'transparent'};cursor:pointer;padding:0;flex-shrink:0;transition:all 0.15s"></button>`;

  let html = '';

  // ── Character name + quick meta ──
  html += `<div style="${sec};background:var(--parchment-dark)">
    <div style="font-family:var(--font-heading);font-size:0.9rem;color:var(--text-main);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</div>
    <div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.1rem">${race?.name||''} ${cls?.name||''} · Lvl ${c.level}${c.inspiration ? ' ⭐' : ''}</div>
  </div>`;

  // ── HP block ──
  html += `<div style="${sec}">
    <div style="${label}">Hit Points</div>
    <div style="display:flex;align-items:baseline;gap:0.4rem;margin-bottom:0.3rem">
      <span style="font-family:var(--font-ui);font-weight:600;font-variant-numeric:lining-nums;font-size:2rem;color:${hpColor};line-height:1">${c.currentHp}</span>
      <span style="color:var(--text-muted);font-size:0.85rem">/ ${c.maxHp}</span>
      ${c.tempHp > 0 ? `<span style="font-size:0.75rem;color:var(--blue)">+${c.tempHp}</span>` : ''}
    </div>
    <div style="height:5px;background:var(--parchment-dark);border-radius:3px;margin-bottom:0.5rem;overflow:hidden">
      <div style="height:100%;width:${hpPct}%;background:${hpColor};transition:width 0.3s"></div>
    </div>
    <div style="display:flex;align-items:center;gap:0.3rem;margin-bottom:0.4rem">
      <input id="${prefix}-hp-adjust" type="number" min="1" placeholder="amt" style="width:52px;border:1px solid var(--border);background:var(--parchment);border-radius:2px;padding:0.3rem 0.4rem;font-family:var(--font-ui);font-size:0.8rem;color:var(--text-main);text-align:center">
      <button onclick="sheetAdjustHP('${c.id}',1,'${prefix}-hp-adjust')" style="flex:1;padding:0.3rem;background:rgba(45,106,45,0.15);border:1px solid var(--green-health);border-radius:2px;cursor:pointer;font-family:var(--font-ui);font-size:0.7rem;color:var(--green-health)">+ Heal</button>
      <button onclick="sheetAdjustHP('${c.id}',-1,'${prefix}-hp-adjust')" style="flex:1;padding:0.3rem;background:rgba(139,26,26,0.1);border:1px solid var(--blood);border-radius:2px;cursor:pointer;font-family:var(--font-ui);font-size:0.7rem;color:var(--blood)">− Dmg</button>
    </div>
    ${isDying ? `<div style="margin-bottom:0.4rem">
      <div style="${label};color:var(--blood)">Death Saves</div>
      <div style="display:flex;gap:0.5rem;align-items:center">
        <span style="font-size:0.72rem;color:var(--green-health);font-family:var(--font-ui)">✓</span>
        <div style="display:flex;gap:0.25rem">${[0,1,2].map(i => pipBtn(i < c.deathSaves.success, `mapToggleDeathSave('${c.id}','success',${i})`)).join('')}</div>
        <span style="font-size:0.72rem;color:var(--blood);font-family:var(--font-ui)">✗</span>
        <div style="display:flex;gap:0.25rem">${[0,1,2].map(i => pipBtn(i < c.deathSaves.fail, `mapToggleDeathSave('${c.id}','fail',${i})`)).join('')}</div>
      </div>
    </div>` : ''}
    <div style="display:flex;gap:0.3rem">
      <button onclick="mapShortRest('${c.id}')" style="flex:1;padding:0.25rem 0.3rem;background:none;border:1px solid var(--border);border-radius:2px;cursor:pointer;font-family:var(--font-ui);font-size:0.72rem;color:var(--text-muted);white-space:nowrap">☕ Short</button>
      <button onclick="mapLongRest('${c.id}')" style="flex:1;padding:0.25rem 0.3rem;background:none;border:1px solid var(--border);border-radius:2px;cursor:pointer;font-family:var(--font-ui);font-size:0.72rem;color:var(--text-muted);white-space:nowrap">🌙 Long</button>
      <button onclick="mapUseHitDie('${c.id}')" style="flex:1;padding:0.25rem 0.3rem;background:none;border:1px solid var(--border);border-radius:2px;cursor:pointer;font-family:var(--font-ui);font-size:0.72rem;color:var(--text-muted);white-space:nowrap" title="Use Hit Die">🎲 d${cls?.hd||8}</button>
    </div>
  </div>`;

  html += `<div style="${sec};padding-top:0">${concentrationControl(c)}</div>`;

  // ── Quick stats ──
  const qStats = [
    ['AC', calcAC(c)],
    ['Prof', '+'+profBonus],
    ['Init', (initMod>=0?'+':'')+initMod],
    ['Perc', passivePerception(c)],
  ];
  if (cls?.spellcaster) {
    qStats.push(['DC', spellDC]);
    qStats.push(['Atk', (spellAtk>=0?'+':'')+spellAtk]);
  }
  html += `<div style="${sec};display:grid;grid-template-columns:repeat(${qStats.length},1fr);gap:0.2rem;text-align:center">
    ${qStats.map(([l,v]) => `<div style="background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:0.3rem 0.1rem">
      <div style="font-family:var(--font-ui);font-weight:600;font-variant-numeric:lining-nums;font-size:0.85rem;color:var(--gold-text)">${v}</div>
      <div style="font-size:0.72rem;font-family:var(--font-ui);color:var(--text-muted);text-transform:uppercase">${l}</div>
    </div>`).join('')}
  </div>`;

  // ── Ability scores compact ──
  const statKeys = ['str','dex','con','int','wis','cha'];
  html += `<div style="${sec}">
    <div style="${label}">Abilities</div>
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:0.15rem;text-align:center">
      ${statKeys.map(s => {
        const mod = getMod(s);
        return `<div style="background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:0.2rem 0">
          <div style="font-size:0.7rem;font-family:var(--font-ui);color:var(--gold-text)">${mod>=0?'+':''}${mod}</div>
          <div style="font-size:0.72rem;font-family:var(--font-ui);color:var(--text-muted)">${s.toUpperCase()}</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;

  // ── Weapons ──
  if (weaponObjs.length) {
    html += `<div style="${sec}">
      <div style="${label}">Attacks</div>
      ${weaponObjs.map(w => {
        const wa = weaponAttack(c, w);
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.25rem 0;border-bottom:1px solid rgba(0,0,0,0.05);font-size:0.72rem">
          <span style="color:var(--text-main);font-family:var(--font-ui);font-size:0.72rem">${w.name}${wa.proficient ? '' : ' ⚠'}</span>
          <span style="color:var(--gold-text);font-family:var(--font-ui)">${fmtMod(wa.atk)} · ${wa.dmg}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  // ── Spell slots ──
  if (hasSlots) {
    html += `<div style="${sec}">
      <div style="${label}">Spell Slots</div>
      ${slotCounts.map((total, i) => {
        if (!total) return '';
        const level = i + 1;
        const used = c.usedSlots[level] || 0;
        const remaining = total - used;
        return `<div style="display:flex;align-items:center;gap:0.35rem;margin-bottom:0.3rem">
          <span style="font-size:0.72rem;font-family:var(--font-ui);color:var(--text-muted);width:16px">L${level}</span>
          <div style="display:flex;gap:0.2rem;flex-wrap:wrap">
            ${Array.from({length:total}, (_,si) => `<button onclick="mapToggleSlot('${c.id}',${level},${si})"
              style="width:14px;height:14px;border-radius:50%;border:1.5px solid ${si < remaining ? 'var(--gold)' : 'var(--border)'};background:${si < remaining ? 'var(--gold)' : 'transparent'};cursor:pointer;padding:0;transition:all 0.15s"></button>`).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  // ── Cantrips ──
  if (cantrips.length) {
    html += `<div style="${sec}">
      <div style="${label}">Cantrips</div>
      <div style="display:flex;flex-wrap:wrap;gap:0.25rem">
        ${cantrips.map(sp => `<span onclick="showSheetSpellDetail('${sp.id}','${c.id}')" style="font-size:0.72rem;font-family:var(--font-ui);background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:0.15rem 0.35rem;cursor:pointer;color:var(--text-muted)" title="${esc(sp.name)}">${esc(sp.name)}</span>`).join('')}
      </div>
    </div>`;
  }

  // ── Leveled spells (compact, grouped by level) ──
  if (leveled.length) {
    const byLevel = {};
    leveled.forEach(sp => { (byLevel[sp.level] = byLevel[sp.level]||[]).push(sp); });
    html += `<div style="${sec}">
      <div style="${label}">Spells</div>
      ${Object.entries(byLevel).map(([lvl, spells]) =>
        `<div style="margin-bottom:0.3rem">
          <div style="font-size:0.72rem;font-family:var(--font-ui);color:var(--text-muted);text-transform:uppercase;margin-bottom:0.15rem">Level ${lvl}</div>
          <div style="display:flex;flex-wrap:wrap;gap:0.2rem">
            ${spells.map(sp => `<span onclick="showSheetSpellDetail('${sp.id}','${c.id}')" style="font-size:0.72rem;font-family:var(--font-ui);background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:0.12rem 0.3rem;cursor:pointer;color:var(--text-muted)">${esc(sp.name)}</span>`).join('')}
          </div>
        </div>`
      ).join('')}
    </div>`;
  }

  // ── Conditions ──
  if (c.conditions.length) {
    html += `<div style="${sec}">
      <div style="${label}">Conditions</div>
      <div style="display:flex;flex-wrap:wrap;gap:0.2rem">
        ${c.conditions.map(cond => `<span onclick="removeCondition('${c.id}','${cond}')" style="font-size:0.72rem;background:rgba(139,26,26,0.12);border:1px solid var(--blood);color:var(--blood);padding:0.1rem 0.3rem;border-radius:2px;cursor:pointer" title="Click to remove">${cond} ✕</span>`).join('')}
      </div>
    </div>`;
  }

  return html;
}

// Convert fractional token position to canvas pixels

function renderCombatSidebar() {
  const container = document.getElementById('combat-sidebar-content');
  if (!container) return;
  const c = myActiveChar();
  if (!c) {
    container.innerHTML = `<div style="padding:1rem;font-size:0.8rem;color:var(--text-muted);font-style:italic;font-family:var(--font-ui)">
      No character linked to <strong>${esc(state.currentUser?.name)}</strong>.<br>
      <button onclick="showPanel('characters',this)" class="btn-secondary btn-sm" style="margin-top:0.75rem">Create Character</button>
    </div>`;
    return;
  }
  container.innerHTML = compactSheetHTML(c, 'map') + `<div style="padding:0.75rem;display:flex;align-items:center;gap:0.4rem">
    <input type="checkbox" id="grid-toggle-player" onchange="toggleGrid(this)" ${effectiveShowGrid() ? 'checked' : ''} style="cursor:pointer">
    <label for="grid-toggle-player" style="font-family:var(--font-ui);font-size:0.7rem;color:var(--text-muted);cursor:pointer">Show Grid</label>
  </div>`;
}

// ============================================================
// MAP GEOMETRY, ZOOM AND PAN
// ============================================================
// Token positions are stored as fractions (0 to 1) of the map image, so they
// land on the same spot on every screen. The image is fitted inside the canvas
// without stretching, then zoomed and panned per device (mapView is never synced).
// The grid is measured in map-image pixels and set per map.
let mapView = { zoom: 1, panX: 0, panY: 0 };
const MIN_ZOOM = 0.5, MAX_ZOOM = 5;

function viewedMap() { return state.maps.find(m => m.id === state.viewMapId) || null; }
function mapGridSize() { return viewedMap()?.gridSize || state.gridSize || 50; }

function mapRect() {
  if (!canvas) return { x: 0, y: 0, w: 1, h: 1, scale: 1 };
  let bw, bh, baseScale;
  if (mapImage && mapImage.naturalWidth) {
    baseScale = Math.min(canvas.width / mapImage.naturalWidth, canvas.height / mapImage.naturalHeight);
    bw = mapImage.naturalWidth * baseScale; bh = mapImage.naturalHeight * baseScale;
  } else {
    baseScale = 1; bw = canvas.width; bh = canvas.height;
  }
  const w = bw * mapView.zoom, h = bh * mapView.zoom;
  return { x: (canvas.width - w) / 2 + mapView.panX, y: (canvas.height - h) / 2 + mapView.panY, w, h, scale: baseScale * mapView.zoom };
}
function gridPx() { return mapGridSize() * mapRect().scale; }
function tokX(t) { const r = mapRect(); return r.x + t.x * r.w; }
function tokY(t) { const r = mapRect(); return r.y + t.y * r.h; }
function canvasToTok(px, dim) { return dim > 0 ? px / dim : 0; }
// Old saves kept pixel positions; convert any to fractions
function migrateTokenCoords(tokens) {
  if (!canvas || !tokens) return tokens;
  return tokens.map(t => (t.x > 1 || t.y > 1)
    ? { ...t, x: canvasToTok(t.x, canvas.width), y: canvasToTok(t.y, canvas.height) } : t);
}

// Zoom around a point on the canvas (defaults to the centre)
function zoomMap(factor, cx, cy) {
  if (!canvas) return;
  cx = cx ?? canvas.width / 2; cy = cy ?? canvas.height / 2;
  const before = mapRect();
  const fx = (cx - before.x) / before.w, fy = (cy - before.y) / before.h;
  mapView.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, mapView.zoom * factor));
  const after = mapRect();
  // Keep the point under the cursor where it was
  mapView.panX += (cx - fx * after.w) - after.x;
  mapView.panY += (cy - fy * after.h) - after.y;
  redrawMap();
  updateZoomLabel();
}
// DM: grid size belongs to the open map
function setMapGridSize(v) {
  const m = viewedMap();
  const n = Math.max(5, Math.min(300, +v || 50));
  if (m && n !== mapGridSize()) { m.gridSize = n; save(); }
  redrawMap();
}

function resetMapView() { mapView = { zoom: 1, panX: 0, panY: 0 }; redrawMap(); updateZoomLabel(); }
function updateZoomLabel() {
  const el = document.getElementById('map-zoom-label');
  if (el) el.textContent = Math.round(mapView.zoom * 100) + '%';
}
// Size the map area to fill the window exactly, so the page itself never scrolls
function fitMapLayout() {
  const panel = document.getElementById('panel-map');
  const box = panel?.querySelector('.map-container');
  if (!box) return;
  if (!panel.classList.contains('active') || window.innerWidth <= 700) { box.style.height = ''; return; }
  const top = box.getBoundingClientRect().top + window.scrollY;
  const main = document.querySelector('.main-content');
  const below = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
  box.style.height = Math.max(360, Math.floor(window.innerHeight - top - below - 2)) + 'px';
}
window.addEventListener('resize', fitMapLayout);

// Side panel sections fold up when you click their heading; remembered per device
function setupSidebarFolding() {
  const saved = JSON.parse(localStorage.getItem('chronicler_folded') || '{}');
  document.querySelectorAll('.map-sidebar .sidebar-section[id]').forEach(sec => {
    if (saved[sec.id]) sec.classList.add('collapsed');
    const title = sec.querySelector(':scope > .sidebar-title');
    if (!title || title._fold) return;
    title._fold = true;
    title.title = 'Click to fold or unfold';
    title.addEventListener('click', () => {
      sec.classList.toggle('collapsed');
      const now = JSON.parse(localStorage.getItem('chronicler_folded') || '{}');
      now[sec.id] = sec.classList.contains('collapsed');
      localStorage.setItem('chronicler_folded', JSON.stringify(now));
    });
  });
}

function toggleWideMap() {
  const box = document.querySelector('.map-container');
  if (!box) return;
  box.classList.toggle('map-wide');
  localStorage.setItem('chronicler_map_wide', box.classList.contains('map-wide') ? '1' : '');
  fitMapLayout();
}

// ============================================================
// MAP IMAGES: stored at campaigns/<id>/mapImages/<mapId>, fetched when needed
// ============================================================
const _mapImgCache = {}; // mapId -> { v, src }
let _mapImgWanted = null;

function mapImageKey(m) { return m ? m.id + ':' + (m.img ? 'inline' : (m.imgV || '')) : ''; }

function ensureMapImage() {
  const m = viewedMap();
  const key = mapImageKey(m);
  if (!m || (!m.img && !m.imgV)) { _mapImgWanted = key; if (mapImage) { mapImage = null; redrawMap(); } return; }
  if (_mapImgWanted === key && mapImage) return;
  _mapImgWanted = key;
  const show = src => {
    const img = new Image();
    img.onload = () => { if (_mapImgWanted === key) { mapImage = img; redrawMap(); } };
    img.src = src;
  };
  if (m.img) return show(m.img); // older maps kept the image inline
  const cached = _mapImgCache[m.id];
  if (cached && cached.v === m.imgV) return show(cached.src);
  mapImage = null; redrawMap();
  if (!window.fbGet || !state.syncEnabled) return;
  window.fbGet('campaigns/' + state.campaignId + '/mapImages/' + m.id).then(src => {
    if (!src) return;
    _mapImgCache[m.id] = { v: m.imgV, src };
    if (_mapImgWanted === key) show(src);
  });
}

// DM: move images that older versions stored inside the world into their own path
let _migratingImages = false;
function migrateInlineMapImages() {
  if (_migratingImages || !state.currentUser?.isDM || !state.syncEnabled || !window.fbSet) return;
  const inline = state.maps.filter(m => m.img);
  if (!inline.length) return;
  _migratingImages = true;
  Promise.all(inline.map(m => {
    const v = Date.now();
    return window.fbSet('campaigns/' + state.campaignId + '/mapImages/' + m.id, m.img).then(() => {
      _mapImgCache[m.id] = { v, src: m.img };
      delete m.img; m.imgV = v;
    });
  })).then(() => { _migratingImages = false; saveNow(); });
}

let _mapInited = false;
function initMap() {
  if (_mapInited) return; // set up once; a second call would double every handler
  _mapInited = true;
  canvas = document.getElementById('map-canvas');
  ctx = canvas.getContext('2d');

  const viewport = document.getElementById('map-viewport');
  const resizeCanvas = () => {
    canvas.width = viewport.clientWidth;
    canvas.height = viewport.clientHeight;
    mapState.tokens = migrateTokenCoords(mapState.tokens);
    redrawMap();
  };
  new ResizeObserver(resizeCanvas).observe(viewport);
  resizeCanvas();
  if (localStorage.getItem('chronicler_map_wide')) document.querySelector('.map-container')?.classList.add('map-wide');

  ensureMapImage();
  renderTokenList();
  renderTokenLibrary();
  renderQuickTokens();
  setupSidebarFolding();
  if (!state.currentUser?.isDM) renderCombatSidebar();

  canvas.addEventListener('mousedown', onMapMouseDown);
  canvas.addEventListener('mousemove', onMapMouseMove);
  canvas.addEventListener('mouseup', onMapMouseUp);
  canvas.addEventListener('mouseleave', onMapMouseUp);
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    zoomMap(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  canvas.addEventListener('touchstart', onTouchStart, {passive:false});
  canvas.addEventListener('touchmove', onTouchMove, {passive:false});
  canvas.addEventListener('touchend', onTouchEnd);
  updateZoomLabel();
}

function loadMapImage(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  evt.target.value = '';
  const reader = new FileReader();
  reader.onload = e => {
    // Up to 2000px: sharp when zoomed in. Stored separately, so it's sent only once.
    compressImage(e.target.result, 2000, 0.82, compressed => {
      let m = viewedMap();
      if (!m) {
        m = { id: 'map_' + Date.now(), name: 'Map 1', tokens: [] };
        state.maps.push(m);
        state.viewMapId = m.id;
        if (!state.activeMapId) state.activeMapId = m.id;
      }
      const v = Date.now();
      delete m.img;
      m.imgV = v;
      _mapImgCache[m.id] = { v, src: compressed };
      const send = window.fbSet && state.syncEnabled
        ? window.fbSet('campaigns/' + state.campaignId + '/mapImages/' + m.id, compressed)
        : Promise.resolve();
      // The image goes first, then the map record that points to it
      send.then(() => saveNow());
      resetMapView();
      ensureMapImage();
      renderMapTabs();
    });
  };
  reader.readAsDataURL(file);
}

// ============================================================
// MAP LIBRARY (DM): open any map privately, show one to players
// ============================================================
function renderMapTabs() {
  const bar = document.getElementById('map-tabs-bar');
  if (!bar) return;
  if (!state.currentUser?.isDM) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';

  let html = '';
  state.maps.forEach(m => {
    const open = m.id === state.viewMapId;
    const live = m.id === state.activeMapId;
    html += `<div style="display:flex;align-items:center;background:${open ? 'var(--parchment)' : 'transparent'};border:1px solid ${open ? 'var(--gold)' : 'var(--border)'};border-radius:2px;overflow:hidden">
      <button onclick="viewMap('${m.id}')" title="${live ? 'Players see this map' : 'Open privately to prepare'}" style="background:none;border:none;cursor:pointer;padding:0.3rem 0.75rem;font-family:var(--font-ui);font-size:0.9rem;color:${open ? 'var(--gold-text)' : 'var(--text-muted)'};white-space:nowrap">${live ? '<span style="color:var(--blood);font-size:0.75rem;font-weight:700">● LIVE </span>' : ''}${esc(m.name)}${(m.img || m.imgV) ? '' : ' <span style="opacity:0.6;font-size:0.78rem">(no image)</span>'}</button>
    </div>`;
  });
  html += `<button onclick="addNewMap()" style="background:none;border:1px dashed var(--border);border-radius:2px;cursor:pointer;padding:0.3rem 0.6rem;font-family:var(--font-ui);font-size:0.9rem;color:var(--text-muted)" title="Add a new map">+ New Map</button>`;
  bar.innerHTML = html;
  fitMapLayout(); // the tab row can wrap and change height

  // Actions for the open map
  const m = viewedMap();
  const nameInput = document.getElementById('active-map-name');
  if (nameInput && document.activeElement !== nameInput) nameInput.value = m ? m.name : '';
  const liveBox = document.getElementById('map-live-status');
  if (liveBox) {
    liveBox.innerHTML = !m ? '' : m.id === state.activeMapId
      ? `<div style="font-size:0.9rem;color:var(--blood);font-weight:600">● Players can see this map</div>`
      : `<button class="control-btn" onclick="showMapToPlayers()" style="border-color:var(--blood);color:var(--blood);font-weight:600">📡 Show this map to players</button>
         <div style="font-size:0.82rem;color:var(--text-muted);font-style:italic;margin-top:0.25rem">Players see "${esc(state.maps.find(x => x.id === state.activeMapId)?.name || 'nothing')}" until you do.</div>`;
  }
}

// Keep the open map's tokens filed under it before opening another
function stashViewedTokens() {
  const cur = viewedMap();
  if (cur) cur.tokens = mapState.tokens;
}

function openMapLocally(id) {
  stashViewedTokens();
  state.viewMapId = id;
  const next = viewedMap();
  mapState.tokens = next ? [...(next.tokens || [])] : [];
  mapState.dragging = null;
  resetMapView();
  ensureMapImage();
  syncGridControls();
  renderMapTabs();
  renderTokenList();
}

// DM: open a map to look at or prepare. Players keep seeing the live map.
function viewMap(id) {
  if (id === state.viewMapId) return;
  openMapLocally(id);
}

function showMapToPlayers() {
  const m = viewedMap();
  if (!m) return;
  state.activeMapId = m.id;
  saveNow();
  renderMapTabs();
  showLimitWarning(`Players now see "${m.name}".`);
}

function addNewMap() {
  stashViewedTokens();
  const newMap = { id: 'map_' + Date.now(), name: `Map ${state.maps.length + 1}`, tokens: [], gridSize: state.gridSize || 50 };
  state.maps.push(newMap);
  if (!state.activeMapId) state.activeMapId = newMap.id;
  save();
  openMapLocally(newMap.id);
  showLimitWarning('New map created. Players won\'t see it until you press "Show this map to players".');
}

function duplicateMap() {
  const src = viewedMap();
  if (!src) return;
  stashViewedTokens();
  const id = 'map_' + Date.now();
  const copy = JSON.parse(JSON.stringify({ ...src, id, name: src.name + ' (copy)' }));
  copy.tokens = (copy.tokens || []).map((t, i) => ({ ...t, id: 'tok_' + Date.now() + '_' + i }));
  const finish = () => { state.maps.push(copy); saveNow(); openMapLocally(id); showLimitWarning(`Copied to "${copy.name}".`); };
  if (src.img || !src.imgV) return finish();
  // Copy the image too, so deleting either map leaves the other intact
  const path = 'campaigns/' + state.campaignId + '/mapImages/';
  const cached = _mapImgCache[src.id];
  (cached ? Promise.resolve(cached.src) : window.fbGet(path + src.id)).then(img => {
    if (img) { _mapImgCache[id] = { v: copy.imgV, src: img }; return window.fbSet(path + id, img); }
  }).then(finish);
}

function deleteMap(id) {
  id = id || state.viewMapId;
  const m = state.maps.find(x => x.id === id);
  if (!m) return;
  if (state.maps.length <= 1) { showLimitWarning("Can't delete the last map."); return; }
  if (!confirm(`Delete "${m.name}" and its tokens? This cannot be undone.`)) return;
  const other = state.maps.find(x => x.id !== id);
  if (state.viewMapId === id) openMapLocally(other.id);
  if (state.activeMapId === id) state.activeMapId = state.viewMapId;
  state.maps = state.maps.filter(x => x.id !== id);
  delete _mapImgCache[id];
  if (window.fbSet && state.syncEnabled) window.fbSet('campaigns/' + state.campaignId + '/mapImages/' + id, null);
  saveNow();
  renderMapTabs();
}

function renameActiveMap(name) {
  const m = viewedMap();
  if (m && name.trim() && m.name !== name.trim()) { m.name = name.trim(); save(); renderMapTabs(); }
}

function compressImage(dataUrl, maxSize, quality, callback) {
  const canvas = document.createElement('canvas');
  const img = new Image();
  img.onload = () => {
    let w = img.width, h = img.height;
    if (w > maxSize || h > maxSize) {
      if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
      else { w = Math.round(w * maxSize / h); h = maxSize; }
    }
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    callback(canvas.toDataURL('image/jpeg', quality));
  };
  img.onerror = () => callback(dataUrl); // fall back to original if compression fails
  img.src = dataUrl;
}

function loadTokenImage(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const name = file.name.replace(/\.[^.]+$/, '');
  const reader = new FileReader();
  reader.onload = e => {
    compressImage(e.target.result, 128, 0.75, img => {
      pendingTokenImg = img;
      if (!state.tokenLibrary.find(l => l.name === name)) {
        state.tokenLibrary.push({ id: 'lib_' + Date.now(), name, img });
        save();
      }
      showTokenImgPreview(img);
      renderTokenLibrary();
      const nameInput = document.getElementById('new-token-name');
      if (nameInput && !nameInput.value) nameInput.value = name;
    });
  };
  reader.readAsDataURL(file);
}

function selectLibraryToken(id) {
  const entry = state.tokenLibrary.find(l => l.id === id);
  if (!entry) return;
  pendingTokenImg = entry.img;
  showTokenImgPreview(entry.img);
  // Pre-fill name
  const nameInput = document.getElementById('new-token-name');
  if (nameInput && !nameInput.value) nameInput.value = entry.name;
  // Highlight selected
  document.querySelectorAll('.lib-token-btn').forEach(b => b.style.outline = 'none');
  const btn = document.getElementById('lib-btn-' + id);
  if (btn) btn.style.outline = '2px solid var(--gold)';
}

function deleteLibraryToken(id) {
  const removed = state.tokenLibrary.find(l => l.id === id);
  state.tokenLibrary = state.tokenLibrary.filter(l => l.id !== id);
  if (removed && pendingTokenImg === removed.img) {
    pendingTokenImg = null;
    hideTokenImgPreview();
  }
  save();
  renderTokenLibrary();
}

function showTokenImgPreview(src) {
  const preview = document.getElementById('token-img-preview');
  const img = document.getElementById('token-img-preview-img');
  if (preview && img) { img.src = src; preview.style.display = ''; }
}

function hideTokenImgPreview() {
  const preview = document.getElementById('token-img-preview');
  if (preview) preview.style.display = 'none';
}

function renderTokenLibrary() {
  const section = document.getElementById('token-library-section');
  const grid = document.getElementById('token-library-grid');
  if (!section || !grid) return;

  if (!state.tokenLibrary.length) { section.style.display = 'none'; return; }
  section.style.display = '';

  grid.innerHTML = state.tokenLibrary.map(entry => `
    <div style="position:relative" title="${esc(entry.name)}">
      <button id="lib-btn-${entry.id}" class="lib-token-btn" onclick="quickAddLibrary('${entry.id}')" oncontextmenu="event.preventDefault();selectLibraryToken('${entry.id}')"
        style="width:44px;height:44px;border-radius:50%;border:2px solid var(--border);background:var(--parchment-dark);cursor:pointer;overflow:hidden;padding:0;outline:${pendingTokenImg===entry.img?'2px solid var(--gold)':'none'}">
        <img src="${entry.img}" style="width:100%;height:100%;object-fit:cover">
      </button>
      <button onclick="event.stopPropagation();deleteLibraryToken('${entry.id}')"
        style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;border-radius:50%;border:none;background:var(--blood);color:#fff;font-size:9px;cursor:pointer;line-height:16px;text-align:center;padding:0;display:none"
        class="lib-delete-btn">✕</button>
    </div>`).join('');

  // Show delete buttons on hover
  grid.querySelectorAll('div').forEach(wrap => {
    const del = wrap.querySelector('.lib-delete-btn');
    if (!del) return;
    wrap.addEventListener('mouseenter', () => del.style.display = 'block');
    wrap.addEventListener('mouseleave', () => del.style.display = 'none');
  });
}

// ---- Placing tokens ----
// Where the middle of the DM's current view falls on the map, as fractions
function viewCentreFrac() {
  const r = mapRect();
  return { x: Math.min(0.95, Math.max(0.05, (canvas.width / 2 - r.x) / r.w)),
           y: Math.min(0.95, Math.max(0.05, (canvas.height / 2 - r.y) / r.h)) };
}

// n grid-snapped positions in a tight block around a centre point
function clusterPositions(n, size, centre) {
  const r = mapRect();
  const gs = gridPx();
  const cols = Math.ceil(Math.sqrt(n));
  const step = gs * Math.max(1, size);
  const cx = r.x + centre.x * r.w, cy = r.y + centre.y * r.h;
  const startCol = Math.floor((cx - r.x) / gs) - Math.floor((cols - 1) * Math.max(1, size) / 2);
  const startRow = Math.floor((cy - r.y) / gs) - Math.floor((Math.ceil(n / cols) - 1) * Math.max(1, size) / 2);
  const out = [];
  for (let i = 0; i < n; i++) {
    const col = startCol + (i % cols) * Math.max(1, size);
    const row = startRow + Math.floor(i / cols) * Math.max(1, size);
    const px = r.x + col * gs + (size * gs) / 2, py = r.y + row * gs + (size * gs) / 2;
    out.push({ x: Math.min(1, Math.max(0, (px - r.x) / r.w)), y: Math.min(1, Math.max(0, (py - r.y) / r.h)) });
  }
  return out;
}

// Names continue from what's already on the map: Goblin 1, Goblin 2...
function numberedNames(base, n) {
  const re = new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?: (\\d+))?$');
  let max = 0, exists = false;
  mapState.tokens.forEach(t => { const m = (t.name || '').match(re); if (m) { exists = true; max = Math.max(max, +(m[1] || 1)); } });
  if (n === 1 && !exists) return [base];
  return Array.from({ length: n }, (_, i) => `${base} ${max + i + 1}`);
}

function placeTokens(spec, n) {
  const m = viewedMap();
  if (!m) { showLimitWarning('Add a map first.'); return []; }
  n = Math.max(1, Math.min(20, n || 1));
  const size = spec.size || 1;
  const names = numberedNames(spec.name || 'Token', n);
  const spots = clusterPositions(n, size, viewCentreFrac());
  const made = names.map((name, i) => ({
    id: 'tok_' + Date.now() + '_' + i + Math.random().toString(36).slice(2, 6),
    name, type: spec.type || 'monster', size, charId: spec.charId || '',
    img: spec.img || null, hidden: !!spec.hidden, x: spots[i].x, y: spots[i].y,
  }));
  mapState.tokens.push(...made);
  mapState.dragging = null;
  m.tokens = mapState.tokens;
  save();
  redrawMap();
  renderTokenList();
  return made;
}

function quickQty() { return +document.getElementById('quick-qty')?.value || 1; }
function quickSize() { return +document.getElementById('new-token-size')?.value || 1; }
function quickHidden() { return !!document.getElementById('quick-hidden')?.checked; }
function setQuickQty(delta) {
  const el = document.getElementById('quick-qty');
  if (el) el.value = Math.max(1, Math.min(20, (+el.value || 1) + delta));
}

// One click: add N tokens of a kind (from the presets or the saved images)
const TOKEN_PRESETS = [
  { key: 'monster', label: '👹 Monster', name: 'Monster', type: 'monster' },
  { key: 'guard',   label: '🛡 Guard',   name: 'Guard',   type: 'npc' },
  { key: 'npc',     label: '🧑 NPC',     name: 'NPC',     type: 'npc' },
  { key: 'beast',   label: '🐺 Beast',   name: 'Beast',   type: 'monster' },
  { key: 'undead',  label: '💀 Undead',  name: 'Undead',  type: 'monster' },
];
function quickAddPreset(key) {
  const p = TOKEN_PRESETS.find(x => x.key === key);
  if (!p) return;
  const made = placeTokens({ name: p.name, type: p.type, size: quickSize(), hidden: quickHidden() }, quickQty());
  if (made.length) showLimitWarning(`Added ${made.length} ${p.name.toLowerCase()} token${made.length > 1 ? 's' : ''}. Drag them where you want them.`);
}
function quickAddLibrary(id) {
  const entry = state.tokenLibrary.find(l => l.id === id);
  if (!entry) return;
  const ch = entry.charId && state.characters.find(c => c.id === entry.charId);
  const made = placeTokens({ name: ch ? ch.name : entry.name, type: entry.type || (ch ? 'player' : 'monster'), img: entry.img,
    size: quickSize(), charId: ch ? ch.id : '', hidden: quickHidden() }, ch ? 1 : quickQty());
  if (made.length) showLimitWarning(`Added ${made.length} × ${made[0].name.replace(/ \d+$/, '')}.`);
}

function renderQuickTokens() {
  const box = document.getElementById('quick-token-presets');
  if (box) box.innerHTML = TOKEN_PRESETS.map(p =>
    `<button class="quick-chip" onclick="quickAddPreset('${p.key}')" title="Add ${p.name.toLowerCase()} tokens">${p.label}</button>`).join('');
}

function generatePlayerTokens() {
  const m = viewedMap();
  if (!m) { showLimitWarning('Add a map first.'); return; }
  const missing = state.characters.filter(ch => !mapState.tokens.some(t => t.charId === ch.id));
  if (!missing.length) { showLimitWarning('All player characters already have tokens on this map.'); return; }
  const spots = clusterPositions(missing.length, 1, viewCentreFrac());
  missing.forEach((ch, i) => mapState.tokens.push({
    id: 'tok_' + Date.now() + '_' + ch.id, name: ch.name, type: 'player', charId: ch.id, size: 1,
    x: spots[i].x, y: spots[i].y, img: ch.portrait || null, hidden: false,
  }));
  m.tokens = mapState.tokens;
  save();
  redrawMap();
  renderTokenList();
}

// The detailed form: name, type, linked character, image, size and quantity
function addToken() {
  const name = document.getElementById('new-token-name').value.trim() || 'Token';
  const type = document.getElementById('new-token-type').value;
  const charId = document.getElementById('new-token-char').value;
  placeTokens({ name, type, charId, size: quickSize(), img: pendingTokenImg || null, hidden: quickHidden() }, charId ? 1 : quickQty());
  pendingTokenImg = null;
  document.getElementById('new-token-name').value = '';
  document.getElementById('token-img-input').value = '';
  hideTokenImgPreview();
  document.querySelectorAll('.lib-token-btn').forEach(b => b.style.outline = 'none');
}

function duplicateToken(id) {
  const t = mapState.tokens.find(x => x.id === id);
  if (!t) return;
  const base = (t.name || 'Token').replace(/ \d+$/, '');
  // A numbered original ("Goblin 2") makes "Goblin 3"; an unnumbered one becomes "Goblin 1" and the copy "Goblin 2"
  if (!/ \d+$/.test(t.name || '') && !mapState.tokens.some(x => x !== t && x.name.startsWith(base + ' '))) t.name = base + ' 1';
  const gs = gridPx(), r = mapRect();
  const name = numberedNames(base, 1)[0]; // next free number after the existing ones
  const copy = { ...t, id: 'tok_' + Date.now() + Math.random().toString(36).slice(2, 6), name, charId: t.type === 'player' ? '' : t.charId,
    x: Math.min(1, t.x + (gs * (t.size || 1)) / r.w), y: t.y };
  mapState.tokens.push(copy);
  const m = viewedMap(); if (m) m.tokens = mapState.tokens;
  save(); redrawMap(); renderTokenList();
}

// DM: grid on/off for everyone. Player: a view setting for this device only.
function toggleGrid(el) {
  if (state.currentUser?.isDM) {
    state.showGrid = document.getElementById('grid-toggle').checked;
    save();
  } else {
    const on = (el || document.getElementById('grid-toggle-player')).checked;
    localStorage.setItem('chronicler_player_grid', on ? 'on' : 'off');
  }
  redrawMap();
}

function effectiveShowGrid() {
  if (state.currentUser?.isDM) return state.showGrid;
  const pref = localStorage.getItem('chronicler_player_grid');
  return pref === 'on' ? true : pref === 'off' ? false : state.showGrid;
}

function redrawMap() {
  if (!canvas || !ctx) return;
  const rect = mapRect();
  const gs = gridPx();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background, then the map fitted without stretching
  ctx.fillStyle = '#1a1009';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (mapImage) {
    ctx.drawImage(mapImage, rect.x, rect.y, rect.w, rect.h);
  } else {
    ctx.fillStyle = '#a08a62';
    ctx.font = '18px "Crimson Pro", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Upload a map image to begin', canvas.width/2, canvas.height/2);
  }

  // Grid, over the map area only
  if (effectiveShowGrid() && gs >= 4) {
    ctx.strokeStyle = 'rgba(201,148,42,0.3)';
    ctx.lineWidth = 1;
    for (let x = rect.x; x <= rect.x + rect.w + 0.5; x += gs) {
      ctx.beginPath(); ctx.moveTo(x, rect.y); ctx.lineTo(x, rect.y + rect.h); ctx.stroke();
    }
    for (let y = rect.y; y <= rect.y + rect.h + 0.5; y += gs) {
      ctx.beginPath(); ctx.moveTo(rect.x, y); ctx.lineTo(rect.x + rect.w, y); ctx.stroke();
    }
  }

  // Tokens
  mapState.tokens.forEach(t => {
    if (t.hidden && !state.currentUser?.isDM) return;
    drawToken(t, gs);
  });

  renderTokenList();
}

function drawToken(t, gs) {
  const sz = t.size || 1;
  const r = sz === 1 ? gs * 0.42 : (sz * gs) / 2 - gs * 0.08;
  // Convert fractional position to canvas pixels for drawing
  const cx = tokX(t);
  const cy = tokY(t);

  if (t.hidden) {
    ctx.globalAlpha = 0.45;
    ctx.setLineDash([4, 4]);
  } else {
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }

  // Circle bg
  // Canvas can't read CSS variables, so token colours are fixed
  const typeColor = t.type === 'player' ? '#2d6a2d' : t.type === 'npc' ? '#2a5a8b' : '#8b1a1a';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.fillStyle = typeColor;
  ctx.fill();
  ctx.strokeStyle = '#c9942a';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (t.img) {
    // Draw image in circle
    let cached = tokenImgCache[t.id];
    if (!cached || cached._src !== t.img) {
      // New token or changed image (for example a new portrait)
      cached = tokenImgCache[t.id] = new Image();
      cached._src = t.img;
      cached.onload = () => redrawMap();
      cached.src = t.img;
    }
    if (cached.complete && cached.naturalWidth) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.clip();
      ctx.drawImage(cached, cx-r, cy-r, r*2, r*2);
      ctx.restore();
    }
  } else {
    // Initials
    ctx.fillStyle = '#f4ead5';
    ctx.font = `bold ${r*0.7}px Cinzel, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.name.charAt(0).toUpperCase(), cx, cy);
  }

  // Name label
  ctx.globalAlpha = t.hidden ? 0.5 : 1;
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.font = '600 13px "Crimson Pro", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const metrics = ctx.measureText(t.name);
  const lw = metrics.width + 8;
  ctx.fillRect(cx - lw/2, cy + r + 2, lw, 16);
  ctx.fillStyle = '#f4ead5';
  ctx.fillText(t.name, cx, cy + r + 4);

  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
}

const tokenImgCache = {};

function getTokenAt(x, y) {
  const gs = gridPx();
  for (let i = mapState.tokens.length - 1; i >= 0; i--) {
    const t = mapState.tokens[i];
    if (t.hidden && !state.currentUser.isDM) continue;
    const sz = t.size || 1;
    const r = sz === 1 ? gs * 0.42 : (sz * gs) / 2 - gs * 0.08;
    // Compare in pixel space
    const tx = tokX(t);
    const ty = tokY(t);
    const dx = x - tx, dy = y - ty;
    if (dx*dx + dy*dy <= r*r) return t;
  }
  return null;
}

function canMoveToken(t) {
  if (state.currentUser.isDM) return true;
  if (t.type === 'player') {
    const c = state.characters.find(x => x.id === t.charId);
    return c && c.player === state.currentUser.name;
  }
  return false;
}

// Mouse and touch: drag a token you can move; drag empty space to pan;
// wheel or pinch to zoom (zoom and pan are this device's own view)
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function onMapMouseDown(e) {
  if (e.target !== canvas) return;
  const { x, y } = canvasPoint(e);
  if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) return;
  const t = getTokenAt(x, y);
  if (t && canMoveToken(t)) {
    mapState.dragging = t;
    mapState.offsetX = x - tokX(t);
    mapState.offsetY = y - tokY(t);
    showTokenPopup(t, x, y);
  } else {
    hideTokenPopup();
    if (t) showTokenPopup(t, x, y);
    mapState.panning = { x, y, panX: mapView.panX, panY: mapView.panY };
    canvas.style.cursor = 'grabbing';
  }
}

function onMapMouseMove(e) {
  const { x, y } = canvasPoint(e);
  if (mapState.dragging) {
    const gs = gridPx();
    const rect = mapRect();
    const sz = mapState.dragging.size || 1;
    // Snap to the grid (measured from the map's corner), then store as fractions of the map
    const cellX = Math.floor((x - mapState.offsetX - rect.x) / gs);
    const cellY = Math.floor((y - mapState.offsetY - rect.y) / gs);
    const snapX = rect.x + cellX * gs + (sz * gs) / 2;
    const snapY = rect.y + cellY * gs + (sz * gs) / 2;
    mapState.dragging.x = Math.min(1, Math.max(0, (snapX - rect.x) / rect.w));
    mapState.dragging.y = Math.min(1, Math.max(0, (snapY - rect.y) / rect.h));
    redrawMap();
  } else if (mapState.panning) {
    mapView.panX = mapState.panning.panX + (x - mapState.panning.x);
    mapView.panY = mapState.panning.panY + (y - mapState.panning.y);
    redrawMap();
  }
}

function onMapMouseUp() {
  if (mapState.dragging) {
    const t = mapState.dragging;
    if (state.currentUser?.isDM) {
      save();
    } else {
      // Players write only their token's position; the DM's screen folds it into the map
      if (window.fbSaveTokenPos && state.campaignId && state.viewMapId) {
        window.fbSaveTokenPos(state.campaignId, state.viewMapId, t.id, t.x, t.y);
      }
      const m = viewedMap();
      if (m) m.tokens = mapState.tokens;
      cacheLocally();
    }
  }
  mapState.dragging = null;
  mapState.panning = null;
  if (canvas) canvas.style.cursor = '';
}

let _pinch = null;
function onTouchStart(e) {
  e.preventDefault();
  if (e.touches.length === 2) {
    // Two fingers: pinch to zoom (drop any drag or pan)
    mapState.dragging = null; mapState.panning = null;
    const [a, b] = e.touches;
    _pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
    return;
  }
  const t = e.touches[0];
  onMapMouseDown({ clientX: t.clientX, clientY: t.clientY, target: canvas });
}

function onTouchMove(e) {
  e.preventDefault();
  if (e.touches.length === 2 && _pinch) {
    const [a, b] = e.touches;
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const mid = canvasPoint({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 });
    if (_pinch.d > 0) zoomMap(d / _pinch.d, mid.x, mid.y);
    _pinch.d = d;
    return;
  }
  const t = e.touches[0];
  onMapMouseMove({ clientX: t.clientX, clientY: t.clientY });
}

function onTouchEnd(e) {
  if (e.touches && e.touches.length) return; // a finger is still down
  _pinch = null;
  onMapMouseUp();
}

function showTokenPopup(t, x, y) {
  const popup = document.getElementById('token-popup');
  const c = t.charId ? state.characters.find(ch => ch.id === t.charId) : null;
  const hpPct = c ? Math.max(0, Math.round(c.currentHp / c.maxHp * 100)) : 0;
  popup.innerHTML = `<div class="token-popup-name">${esc(t.name)}</div>
    <div class="token-popup-meta">${t.type}${t.hidden ? ' (hidden)' : ''}</div>
    ${c ? `<div class="token-popup-hp">
      <div style="font-size:0.8rem">${c.currentHp}/${c.maxHp} HP · ${getClass(c.class)} ${c.level}</div>
      <div class="token-popup-bar"><div class="token-popup-fill" style="width:${hpPct}%;background:${hpPct>60?'var(--green-health)':hpPct>25?'var(--amber)':'var(--blood)'}"></div></div>
    </div>` : ''}`;
  popup.style.left = Math.min(x + 10, canvas.width - 200) + 'px';
  popup.style.top = Math.min(y + 10, canvas.height - 120) + 'px';
  popup.classList.remove('hidden');
  setTimeout(hideTokenPopup, 3000);
}

function hideTokenPopup() {
  document.getElementById('token-popup')?.classList.add('hidden');
}

function renderTokenList() {
  const list = document.getElementById('token-list');
  if (!list) return;
  const isDM = state.currentUser?.isDM;
  const visible = isDM ? mapState.tokens : mapState.tokens.filter(t => !t.hidden);
  if (!visible.length) {
    list.innerHTML = '<div style="font-size:0.8rem;color:var(--text-muted);font-style:italic;padding:0.5rem">No tokens placed yet.</div>';
    return;
  }
  list.innerHTML = visible.map(t => {
    return `<div class="token-item ${t.hidden ? 'hidden-token' : ''}">
      <div class="token-thumb">${t.img ? `<img src="${t.img}">` : t.name.charAt(0)}</div>
      <div class="token-info">
        <div class="token-name">${esc(t.name)}</div>
        <div class="token-type">${t.type}${t.size > 1 ? ' · ' + ['','','Large','Huge','Gargantuan'][t.size] : ''}${t.hidden ? ' · hidden' : ''}</div>
      </div>
      ${isDM ? `<button class="token-toggle" onclick="duplicateToken('${t.id}')" title="Add another like this">⧉</button>
        <button class="token-toggle" onclick="toggleTokenVisibility('${t.id}')" title="${t.hidden ? 'Show to players' : 'Hide from players'}">${t.hidden ? '👁' : '🚫'}</button>
        <button class="token-toggle" style="color:var(--blood)" onclick="removeToken('${t.id}')" title="Remove">✕</button>` : ''}
    </div>`;
  }).join('');
}

function toggleTokenVisibility(id) {
  const t = mapState.tokens.find(x => x.id === id);
  if (t) {
    t.hidden = !t.hidden;
    const activeMap = state.maps.find(m => m.id === state.viewMapId);
    if (activeMap) activeMap.tokens = mapState.tokens;
      save(); redrawMap();
  }
}

function removeToken(id) {
  mapState.tokens = mapState.tokens.filter(x => x.id !== id);
  const activeMap = state.maps.find(m => m.id === state.viewMapId);
  if (activeMap) activeMap.tokens = mapState.tokens;
  save(); redrawMap();
}

function refreshTokenCharSelect() {
  const sel = document.getElementById('new-token-char');
  if (!sel) return;
  sel.innerHTML = '<option value="">— none —</option>';
  state.characters.forEach(c => {
    sel.innerHTML += `<option value="${c.id}">${esc(c.name)} (${getClass(c.class)} ${c.level})</option>`;
  });
}

