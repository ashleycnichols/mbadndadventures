// ============================================================
// MAP / CANVAS
// ============================================================
let canvas, ctx, mapImage = null;
let pendingTokenImg = null;


// ============================================================
// COMBAT SIDEBAR (player map panel)
// ============================================================
// The sidebar reuses the sheet's actions; refreshSheets() redraws the sidebar
function mapAdjustHP(id, sign) { sheetAdjustHP(id, sign, 'map-hp-adjust'); }
function mapToggleSlot(id, spellLevel, slotIndex) { toggleSlot(id, spellLevel, slotIndex); }
function mapUseHitDie(id) { useHitDie(id); }
function mapShortRest(id) { doShortRest(id); }
function mapLongRest(id) { doLongRest(id); }
function mapToggleDeathSave(id, type, index) { toggleDeathSave(id, type, index); }

function renderCombatSidebar() {
  const container = document.getElementById('combat-sidebar-content');
  if (!container) return;

  const c = myActiveChar();

  if (!c) {
    container.innerHTML = `<div style="padding:1rem;font-size:0.8rem;color:var(--text-muted);font-style:italic;font-family:'Crimson Pro',serif">
      No character linked to <strong>${state.currentUser?.name}</strong>.<br>
      <button onclick="showPanel('characters',this)" class="btn-secondary btn-sm" style="margin-top:0.75rem">Create Character</button>
    </div>`;
    return;
  }

  // Ensure fields
  if (!c.usedSlots) c.usedSlots = {};
  if (!c.tempHp) c.tempHp = 0;
  if (!c.deathSaves) c.deathSaves = {success:0, fail:0};
  if (!c.hitDiceUsed) c.hitDiceUsed = 0;
  if (!Array.isArray(c.spells)) c.spells = [];
  if (!Array.isArray(c.weapons)) c.weapons = [];
  if (!c.stats) c.stats = {str:10,dex:10,con:10,int:10,wis:10,cha:10};
  if (!c.conditions) c.conditions = [];

  const cls = CLASSES.find(cl => cl.id === c.class);
  const race = RACES.find(r => r.id === c.race);
  const profBonus = Math.ceil(c.level / 4) + 1;
  const getMod = s => Math.floor(((c.stats[s]||10) - 10) / 2);
  const hpPct = Math.max(0, Math.round(c.currentHp / c.maxHp * 100));
  const hpColor = hpPct > 60 ? 'var(--green-health)' : hpPct > 25 ? '#8b6914' : 'var(--blood)';
  const initMod = getMod('dex');
  const acMod = getMod('dex'); // rough proxy — no armour calc
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
  const label = 'font-family:"Cinzel",serif;font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:0.3rem';
  const pipBtn = (filled, onclick) => `<button onclick="${onclick}" style="width:14px;height:14px;border-radius:50%;border:1.5px solid ${filled ? (hpColor) : 'var(--border)'};background:${filled ? hpColor : 'transparent'};cursor:pointer;padding:0;flex-shrink:0;transition:all 0.15s"></button>`;

  let html = '';

  // ── Character name + quick meta ──
  html += `<div style="${sec};background:var(--parchment-dark)">
    <div style="font-family:'Cinzel',serif;font-size:0.9rem;color:var(--text-main);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</div>
    <div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.1rem">${race?.name||''} ${cls?.name||''} · Lvl ${c.level}${c.inspiration ? ' ⭐' : ''}</div>
  </div>`;

  // ── HP block ──
  html += `<div style="${sec}">
    <div style="${label}">Hit Points</div>
    <div style="display:flex;align-items:baseline;gap:0.4rem;margin-bottom:0.3rem">
      <span style="font-family:'Cinzel Decorative',serif;font-size:2rem;color:${hpColor};line-height:1">${c.currentHp}</span>
      <span style="color:var(--text-muted);font-size:0.85rem">/ ${c.maxHp}</span>
      ${c.tempHp > 0 ? `<span style="font-size:0.75rem;color:#4a7ca5">+${c.tempHp}</span>` : ''}
    </div>
    <div style="height:5px;background:var(--parchment-dark);border-radius:3px;margin-bottom:0.5rem;overflow:hidden">
      <div style="height:100%;width:${hpPct}%;background:${hpColor};transition:width 0.3s"></div>
    </div>
    <div style="display:flex;align-items:center;gap:0.3rem;margin-bottom:0.4rem">
      <input id="map-hp-adjust" type="number" min="1" placeholder="amt" style="width:52px;border:1px solid var(--border);background:var(--parchment);border-radius:2px;padding:0.3rem 0.4rem;font-family:'Cinzel',serif;font-size:0.8rem;color:var(--text-main);text-align:center">
      <button onclick="mapAdjustHP('${c.id}',1)" style="flex:1;padding:0.3rem;background:rgba(45,106,45,0.15);border:1px solid var(--green-health);border-radius:2px;cursor:pointer;font-family:'Cinzel',serif;font-size:0.7rem;color:var(--green-health)">+ Heal</button>
      <button onclick="mapAdjustHP('${c.id}',-1)" style="flex:1;padding:0.3rem;background:rgba(139,26,26,0.1);border:1px solid var(--blood);border-radius:2px;cursor:pointer;font-family:'Cinzel',serif;font-size:0.7rem;color:var(--blood)">− Dmg</button>
    </div>
    ${isDying ? `<div style="margin-bottom:0.4rem">
      <div style="${label};color:var(--blood)">Death Saves</div>
      <div style="display:flex;gap:0.5rem;align-items:center">
        <span style="font-size:0.65rem;color:var(--green-health);font-family:'Cinzel',serif">✓</span>
        <div style="display:flex;gap:0.25rem">${[0,1,2].map(i => pipBtn(i < c.deathSaves.success, `mapToggleDeathSave('${c.id}','success',${i})`)).join('')}</div>
        <span style="font-size:0.65rem;color:var(--blood);font-family:'Cinzel',serif">✗</span>
        <div style="display:flex;gap:0.25rem">${[0,1,2].map(i => pipBtn(i < c.deathSaves.fail, `mapToggleDeathSave('${c.id}','fail',${i})`)).join('')}</div>
      </div>
    </div>` : ''}
    <div style="display:flex;gap:0.3rem">
      <button onclick="mapShortRest('${c.id}')" style="flex:1;padding:0.25rem 0.3rem;background:none;border:1px solid var(--border);border-radius:2px;cursor:pointer;font-family:'Cinzel',serif;font-size:0.6rem;color:var(--text-muted);white-space:nowrap">☕ Short</button>
      <button onclick="mapLongRest('${c.id}')" style="flex:1;padding:0.25rem 0.3rem;background:none;border:1px solid var(--border);border-radius:2px;cursor:pointer;font-family:'Cinzel',serif;font-size:0.6rem;color:var(--text-muted);white-space:nowrap">🌙 Long</button>
      <button onclick="mapUseHitDie('${c.id}')" style="flex:1;padding:0.25rem 0.3rem;background:none;border:1px solid var(--border);border-radius:2px;cursor:pointer;font-family:'Cinzel',serif;font-size:0.6rem;color:var(--text-muted);white-space:nowrap" title="Use Hit Die">🎲 d${cls?.hd||8}</button>
    </div>
  </div>`;

  // ── Quick stats ──
  const qStats = [
    ['Prof', '+'+profBonus],
    ['Init', (initMod>=0?'+':'')+initMod],
    ['Perc', 10+getMod('wis')],
  ];
  if (cls?.spellcaster) {
    qStats.push(['DC', spellDC]);
    qStats.push(['Atk', (spellAtk>=0?'+':'')+spellAtk]);
  }
  html += `<div style="${sec};display:grid;grid-template-columns:repeat(${qStats.length},1fr);gap:0.2rem;text-align:center">
    ${qStats.map(([l,v]) => `<div style="background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:0.3rem 0.1rem">
      <div style="font-family:'Cinzel Decorative',serif;font-size:0.85rem;color:var(--gold)">${v}</div>
      <div style="font-size:0.58rem;font-family:'Cinzel',serif;color:var(--text-muted);text-transform:uppercase">${l}</div>
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
          <div style="font-size:0.7rem;font-family:'Cinzel',serif;color:var(--gold)">${mod>=0?'+':''}${mod}</div>
          <div style="font-size:0.55rem;font-family:'Cinzel',serif;color:var(--text-muted)">${s.toUpperCase()}</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;

  // ── Weapons ──
  if (weaponObjs.length) {
    html += `<div style="${sec}">
      <div style="${label}">Attacks</div>
      ${weaponObjs.map(w => {
        const isFinesse = w.id === 'rapier' || w.id === 'shortsword' || w.id === 'dagger' || w.id === 'whip';
        const isRanged = w.range === 'Ranged';
        const atkStat = isFinesse || isRanged ? 'dex' : 'str';
        const atkMod = getMod(atkStat) + profBonus;
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.25rem 0;border-bottom:1px solid rgba(0,0,0,0.05);font-size:0.72rem">
          <span style="color:var(--text-main);font-family:'Cinzel',serif;font-size:0.68rem">${w.name}</span>
          <span style="color:var(--gold);font-family:'Cinzel',serif">${atkMod>=0?'+':''}${atkMod} · ${w.dmg}</span>
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
          <span style="font-size:0.62rem;font-family:'Cinzel',serif;color:var(--text-muted);width:16px">L${level}</span>
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
        ${cantrips.map(sp => `<span onclick="showSheetSpellDetail('${sp.id}')" style="font-size:0.68rem;font-family:'Cinzel',serif;background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:0.15rem 0.35rem;cursor:pointer;color:var(--text-muted)" title="${esc(sp.name)}">${esc(sp.name)}</span>`).join('')}
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
          <div style="font-size:0.58rem;font-family:'Cinzel',serif;color:var(--text-muted);text-transform:uppercase;margin-bottom:0.15rem">Level ${lvl}</div>
          <div style="display:flex;flex-wrap:wrap;gap:0.2rem">
            ${spells.map(sp => `<span onclick="showSheetSpellDetail('${sp.id}')" style="font-size:0.65rem;font-family:'Cinzel',serif;background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:0.12rem 0.3rem;cursor:pointer;color:var(--text-muted)">${esc(sp.name)}</span>`).join('')}
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
        ${c.conditions.map(cond => `<span onclick="removeCondition('${c.id}','${cond}')" style="font-size:0.65rem;background:rgba(139,26,26,0.12);border:1px solid var(--blood);color:var(--blood);padding:0.1rem 0.3rem;border-radius:2px;cursor:pointer" title="Click to remove">${cond} ✕</span>`).join('')}
      </div>
    </div>`;
  }

  // ── Grid toggle at bottom ──
  html += `<div style="padding:0.75rem;display:flex;align-items:center;gap:0.4rem">
    <input type="checkbox" id="grid-toggle-player" onchange="toggleGrid(this)" ${effectiveShowGrid() ? 'checked' : ''} style="cursor:pointer">
    <label for="grid-toggle-player" style="font-family:'Cinzel',serif;font-size:0.7rem;color:var(--text-muted);cursor:pointer">Show Grid</label>
  </div>`;

  container.innerHTML = html;
}

// Convert fractional token position to canvas pixels
function tokToCanvas(frac, dim) { return frac * dim; }
// Convert canvas pixels to fractional position
function canvasToTok(px, dim) { return dim > 0 ? px / dim : 0; }
// Migrate old pixel coords to fractions (called when loading tokens)
function migrateTokenCoords(tokens) {
  if (!canvas || !tokens) return tokens;
  return tokens.map(t => {
    // Heuristic: if x or y > 1 it's still in pixel space
    if (t.x > 1 || t.y > 1) {
      return { ...t, x: canvasToTok(t.x, canvas.width), y: canvasToTok(t.y, canvas.height) };
    }
    return t;
  });
}

let _mapInited = false;
function initMap() {
  if (_mapInited) return; // set up once; a second call would double every drag handler
  _mapInited = true;
  canvas = document.getElementById('map-canvas');
  ctx = canvas.getContext('2d');

  const viewport = document.getElementById('map-viewport');
  const resizeCanvas = () => {
    canvas.width = viewport.clientWidth;
    canvas.height = viewport.clientHeight;
    // Migrate any old pixel-coord tokens to fractional on first resize
    mapState.tokens = migrateTokenCoords(mapState.tokens);
    redrawMap();
  };
  new ResizeObserver(resizeCanvas).observe(viewport);
  resizeCanvas();

  // Load active map image
  const active = state.maps.find(m => m.id === state.activeMapId);
  if (active?.img) {
    const img = new Image();
    img.onload = () => { mapImage = img; redrawMap(); };
    img.src = active.img;
  }

  renderTokenList();
  renderTokenLibrary();
  if (!state.currentUser?.isDM) renderCombatSidebar();

  // Mouse events for drag
  canvas.addEventListener('mousedown', onMapMouseDown);
  canvas.addEventListener('mousemove', onMapMouseMove);
  canvas.addEventListener('mouseup', onMapMouseUp);
  canvas.addEventListener('mouseleave', onMapMouseUp);
  canvas.addEventListener('touchstart', onTouchStart, {passive:false});
  canvas.addEventListener('touchmove', onTouchMove, {passive:false});
  canvas.addEventListener('touchend', onMapMouseUp);
}

function loadMapImage(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    // Compress map to max 1200px wide at 0.85 quality — keeps it sharp but Firebase-safe
    compressImage(e.target.result, 1200, 0.85, compressed => {
      let active = state.maps.find(m => m.id === state.activeMapId);
      if (!active) {
        active = { id: 'map_' + Date.now(), name: 'Map 1', img: null, tokens: [] };
        state.maps.push(active);
        state.activeMapId = active.id;
      }
      active.img = compressed;
      state.mapImg = compressed;
      const img = new Image();
      img.onload = () => {
        mapImage = img;
        redrawMap();
        renderMapTabs();
        // Send straight away: map uploads are large and shouldn't wait
        saveNow();
      };
      img.src = compressed;
    });
  };
  reader.readAsDataURL(file);
}

// ---- Multi-map management ----
function renderMapTabs() {
  const bar = document.getElementById('map-tabs-bar');
  if (!bar) return;
  if (!state.currentUser?.isDM) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';

  let html = '';
  state.maps.forEach(m => {
    const isActive = m.id === state.activeMapId;
    html += `<div style="display:flex;align-items:center;gap:0;background:${isActive?'var(--parchment)':'transparent'};border:1px solid ${isActive?'var(--gold)':'var(--border)'};border-radius:2px;overflow:hidden">
      <button onclick="switchMap('${m.id}')" style="background:none;border:none;cursor:pointer;padding:0.3rem 0.75rem;font-family:'Cinzel',serif;font-size:0.8rem;color:${isActive?'var(--gold)':'var(--text-muted)'};white-space:nowrap">${m.name}${m.img ? '' : ' <span style="opacity:0.5;font-size:0.7rem">(no image)</span>'}</button>
      ${state.maps.length > 1 ? `<button onclick="deleteMap('${m.id}')" style="background:none;border:none;border-left:1px solid var(--border);cursor:pointer;padding:0.3rem 0.4rem;color:var(--text-muted);font-size:0.8rem;line-height:1" title="Delete map">✕</button>` : ''}
    </div>`;
  });

  html += `<button onclick="addNewMap()" style="background:none;border:1px dashed var(--border);border-radius:2px;cursor:pointer;padding:0.3rem 0.6rem;font-family:'Cinzel',serif;font-size:0.8rem;color:var(--text-muted)" title="Add new map">+ New Map</button>`;
  bar.innerHTML = html;

  // Update map name input
  const nameInput = document.getElementById('active-map-name');
  if (nameInput) {
    const active = state.maps.find(m => m.id === state.activeMapId);
    nameInput.value = active ? active.name : '';
  }
}

function addNewMap() {
  // Save current map state before switching
  if (state.activeMapId) {
    const cur = state.maps.find(m => m.id === state.activeMapId);
    if (cur) cur.tokens = mapState.tokens;
  }
  const newMap = { id: 'map_' + Date.now(), name: `Map ${state.maps.length + 1}`, img: null, tokens: [] };
  state.maps.push(newMap);
  state.activeMapId = newMap.id;
  mapState.tokens = [];
  mapImage = null;
  state.mapImg = null;
  save();
  renderMapTabs();
  redrawMap();
  renderTokenList();
}

function switchMap(id) {
  if (id === state.activeMapId) return;
  // Save current tokens to current map before switching
  if (state.activeMapId) {
    const cur = state.maps.find(m => m.id === state.activeMapId);
    if (cur) cur.tokens = mapState.tokens;
  }
  state.activeMapId = id;
  const next = state.maps.find(m => m.id === id);
  mapState.tokens = next ? [...(next.tokens || [])] : [];
  state.mapImg = next?.img || null;
  mapState.dragging = null;

  if (next?.img) {
    const img = new Image();
    img.onload = () => { mapImage = img; redrawMap(); };
    img.src = next.img;
  } else {
    mapImage = null;
    redrawMap();
  }
  // Send straight away so players follow the DM to the new map
  saveNow();
  renderMapTabs();
  renderTokenList();
}

function deleteMap(id) {
  if (state.maps.length <= 1) { showLimitWarning("Can't delete the last map."); return; }
  if (!confirm(`Delete "${state.maps.find(m=>m.id===id)?.name}"? This cannot be undone.`)) return;
  // Move off the map first, so its tokens are filed under it and not under the next map
  if (state.activeMapId === id) switchMap(state.maps.find(m => m.id !== id).id);
  state.maps = state.maps.filter(m => m.id !== id);
  saveNow();
  renderMapTabs();
}

function renameActiveMap(name) {
  const m = state.maps.find(m => m.id === state.activeMapId);
  if (m && name.trim()) { m.name = name.trim(); save(); renderMapTabs(); }
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
  state.tokenLibrary = state.tokenLibrary.filter(l => l.id !== id);
  if (pendingTokenImg === state.tokenLibrary.find(l => l.id === id)?.img) {
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
      <button id="lib-btn-${entry.id}" class="lib-token-btn" onclick="selectLibraryToken('${entry.id}')"
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

function generatePlayerTokens() {
  const active = state.maps.find(m => m.id === state.activeMapId);
  if (!active) { alert('No active map — upload a map first.'); return; }

  let added = 0;
  state.characters.forEach(ch => {
    // Skip if already has a token on this map
    if (mapState.tokens.some(t => t.charId === ch.id)) return;
    // Use portrait if available, otherwise no image
    const img = ch.portrait || null;
    // Spread tokens out in a row along the top of the map
    // Space tokens evenly along the top as fractions
    const tok = {
      id: 'tok_' + Date.now() + '_' + ch.id,
      name: ch.name,
      type: 'player',
      charId: ch.id,
      size: 1,
      x: 0.05 + (added * 0.1),
      y: 0.05,
      img,
      hidden: false,
    };
    mapState.tokens.push(tok);
    added++;
  });

  if (added === 0) {
    alert('All player characters already have tokens on this map.');
    return;
  }

  active.tokens = mapState.tokens;
  save();
  redrawMap();
  renderTokenList();
}

function addToken() {
  const name = document.getElementById('new-token-name').value.trim() || 'Token';
  const type = document.getElementById('new-token-type').value;
  const charId = document.getElementById('new-token-char').value;
  const size = +document.getElementById('new-token-size').value || 1;

  // Place at canvas centre as fraction (0.5, 0.5)
  const t = {
    id: 'tok_' + Date.now(),
    name, type, charId, size,
    x: 0.5, y: 0.5,
    img: pendingTokenImg || null,
    hidden: false,
  };

  mapState.tokens.push(t);
  // Ensure not dragging the new token
  mapState.dragging = null;
  // Sync tokens back to active map immediately before save
  const activeMap = state.maps.find(m => m.id === state.activeMapId);
  if (activeMap) activeMap.tokens = mapState.tokens;
  pendingTokenImg = null;
  document.getElementById('new-token-name').value = '';
  document.getElementById('new-token-size').value = '1';
  document.getElementById('token-img-input').value = '';
  hideTokenImgPreview();
  document.querySelectorAll('.lib-token-btn').forEach(b => b.style.outline = 'none');
  save();
  redrawMap();
  renderTokenList();
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
  const gs = +document.getElementById('grid-size')?.value || 50;
  if (gs !== state.gridSize) { state.gridSize = gs; save(); }
  else { state.gridSize = gs; }
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  if (mapImage) {
    ctx.drawImage(mapImage, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = '#1a1009';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#3d2b0e';
    ctx.font = '16px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Upload a map image to begin', canvas.width/2, canvas.height/2);
  }

  // Grid
  if (effectiveShowGrid()) {
    ctx.strokeStyle = 'rgba(201,148,42,0.3)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += gs) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gs) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
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
  const cx = tokToCanvas(t.x, canvas.width);
  const cy = tokToCanvas(t.y, canvas.height);

  if (t.hidden) {
    ctx.globalAlpha = 0.45;
    ctx.setLineDash([4, 4]);
  } else {
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }

  // Circle bg
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
  ctx.font = '11px Cinzel, serif';
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
  const gs = state.gridSize;
  for (let i = mapState.tokens.length - 1; i >= 0; i--) {
    const t = mapState.tokens[i];
    if (t.hidden && !state.currentUser.isDM) continue;
    const sz = t.size || 1;
    const r = sz === 1 ? gs * 0.42 : (sz * gs) / 2 - gs * 0.08;
    // Compare in pixel space
    const tx = tokToCanvas(t.x, canvas.width);
    const ty = tokToCanvas(t.y, canvas.height);
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

function onMapMouseDown(e) {
  // Only respond to clicks directly on the canvas
  if (e.target !== canvas) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  // Ignore if outside canvas bounds
  if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) return;
  const t = getTokenAt(x, y);
  if (t && canMoveToken(t)) {
    mapState.dragging = t;
    // Store offset in pixel space
    mapState.offsetX = x - tokToCanvas(t.x, canvas.width);
    mapState.offsetY = y - tokToCanvas(t.y, canvas.height);
    showTokenPopup(t, x, y);
  } else {
    hideTokenPopup();
    if (t) showTokenPopup(t, x, y);
  }
}

function onMapMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  if (mapState.dragging) {
    const gs = state.gridSize;
    const sz = mapState.dragging.size || 1;
    // Snap in pixel space, then store as fractions
    const snapX = Math.floor((x - mapState.offsetX) / gs) * gs + (sz * gs) / 2;
    const snapY = Math.floor((y - mapState.offsetY) / gs) * gs + (sz * gs) / 2;
    mapState.dragging.x = canvasToTok(snapX, canvas.width);
    mapState.dragging.y = canvasToTok(snapY, canvas.height);
    redrawMap();
  }
}

function onMapMouseUp() {
  if (mapState.dragging) {
    const t = mapState.dragging;
    if (state.currentUser?.isDM) {
      save();
    } else {
      // Player writes just their token position to tokenMoves
      if (window.fbSaveTokenPos && state.campaignId && state.activeMapId) {
        window.fbSaveTokenPos(state.campaignId, state.activeMapId, t.id, t.x, t.y);
      }
      // Also update local map state
      const active = state.maps.find(m => m.id === state.activeMapId);
      if (active) active.tokens = mapState.tokens;
      localStorage.setItem('chronicler_v2', JSON.stringify(buildSaveData()));
    }
  }
  mapState.dragging = null;
}

function onTouchStart(e) {
  e.preventDefault();
  const t = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  onMapMouseDown({ clientX: t.clientX, clientY: t.clientY, target: canvas });
}

function onTouchMove(e) {
  e.preventDefault();
  const t = e.touches[0];
  onMapMouseMove({ clientX: t.clientX, clientY: t.clientY });
}

function showTokenPopup(t, x, y) {
  const popup = document.getElementById('token-popup');
  const c = t.charId ? state.characters.find(ch => ch.id === t.charId) : null;
  const hpPct = c ? Math.max(0, Math.round(c.currentHp / c.maxHp * 100)) : 0;
  popup.innerHTML = `<div class="token-popup-name">${esc(t.name)}</div>
    <div class="token-popup-meta">${t.type}${t.hidden ? ' (hidden)' : ''}</div>
    ${c ? `<div class="token-popup-hp">
      <div style="font-size:0.8rem">${c.currentHp}/${c.maxHp} HP · ${getClass(c.class)} ${c.level}</div>
      <div class="token-popup-bar"><div class="token-popup-fill" style="width:${hpPct}%;background:${hpPct>60?'#2d6a2d':hpPct>25?'#8b6914':'#8b1a1a'}"></div></div>
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
      ${isDM ? `<button class="token-toggle" onclick="toggleTokenVisibility('${t.id}')">${t.hidden ? '👁' : '🚫'}</button>
        <button class="token-toggle" style="color:var(--blood)" onclick="removeToken('${t.id}')">✕</button>` : ''}
    </div>`;
  }).join('');
}

function toggleTokenVisibility(id) {
  const t = mapState.tokens.find(x => x.id === id);
  if (t) {
    t.hidden = !t.hidden;
    const activeMap = state.maps.find(m => m.id === state.activeMapId);
    if (activeMap) activeMap.tokens = mapState.tokens;
      save(); redrawMap();
  }
}

function removeToken(id) {
  mapState.tokens = mapState.tokens.filter(x => x.id !== id);
  const activeMap = state.maps.find(m => m.id === state.activeMapId);
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

