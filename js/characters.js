// ============================================================
// CHARACTERS
// ============================================================
function renderCharacters() {
  const grid = document.getElementById('characters-grid');
  const isDM = state.currentUser.isDM;
  const chars = isDM
    ? state.characters
    : state.characters.filter(ch => ch.player === state.currentUser.name);

  let html = '';
  chars.forEach(c => {
    const hpPct = Math.max(0, Math.round(c.currentHp / c.maxHp * 100));
    const hpColor = hpPct > 60 ? 'var(--green-health)' : hpPct > 25 ? 'var(--amber)' : 'var(--blood)';
    const cardClick = isDM ? `editCharacter('${c.id}')` : `setActiveChar('${c.id}');showPanel('sheet',document.getElementById('sheet-tab'))`;
    html += `<div class="character-card" style="position:relative" onclick="${cardClick}">
      ${isDM ? `<button onclick="event.stopPropagation();confirmDeleteChar('${c.id}')" style="position:absolute;top:0.5rem;right:0.5rem;background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.1rem;line-height:1;padding:0.2rem 0.4rem;border-radius:2px;transition:color 0.15s" onmouseover="this.style.color='var(--blood)'" onmouseout="this.style.color='var(--text-muted)'" title="Delete character">\u2715</button>` : ''}
      <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.3rem">
        ${c.portrait ? `<img src="${c.portrait}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid var(--gold);flex-shrink:0">` : `<div style="width:36px;height:36px;border-radius:50%;background:var(--parchment-dark);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">🧙</div>`}
        <div style="min-width:0">
          <div class="char-name" style="padding-right:${isDM ? '1.5rem' : '0'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name) || 'Unnamed'}</div>
          <div class="char-meta">${esc(c.player)} \u00b7 ${esc(getRace(c.race))} ${esc(getClass(c.class))} ${c.level}</div>
        </div>
      </div>
      <div class="char-hp-bar"><div class="char-hp-fill" style="width:${hpPct}%;background:${hpColor}"></div></div>
      <div class="char-hp-text">HP: ${c.currentHp} / ${c.maxHp}</div>
    </div>`;
  });

  html += `<div class="add-char-card" onclick="openCreator()"><div class="plus">+</div><div>Create New Character</div></div>`;
  grid.innerHTML = html;

  document.getElementById('char-count-label').textContent = chars.length + ' adventurer' + (chars.length !== 1 ? 's' : '');
  refreshTokenCharSelect();
}

function confirmDeleteChar(id) {
  const c = state.characters.find(x => x.id === id);
  if (!c) return;
  // Show inline confirm overlay
  const existing = document.getElementById('delete-confirm-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'delete-confirm-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:4000;display:flex;align-items:center;justify-content:center;padding:1rem';
  overlay.innerHTML = `<div style="background:var(--parchment);border:2px solid var(--blood);border-radius:2px;padding:1.5rem 2rem;max-width:380px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
    <div style="font-family:var(--font-display);font-size:1rem;color:var(--blood);margin-bottom:0.75rem">Delete Character?</div>
    <div style="font-family:var(--font-heading);font-size:1.1rem;color:var(--text-main);margin-bottom:0.5rem">${esc(c.name) || 'Unnamed'}</div>
    <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1.25rem">${esc(getRace(c.race))} ${esc(getClass(c.class))} · Level ${c.level}<br><em>This cannot be undone.</em></div>
    <div style="display:flex;gap:0.75rem;justify-content:center">
      <button class="btn-secondary btn-sm" onclick="document.getElementById('delete-confirm-overlay').remove()">Cancel</button>
      <button class="btn-primary btn-gold btn-sm" style="background:var(--blood);border-color:var(--blood)" onclick="deleteCharacter('${id}')">Delete Forever</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function deleteCharacter(id) {
  state.characters = state.characters.filter(x => x.id !== id);
  _deletedIds.add(id);
  delete _charSnap[id];
  cacheLocally();
  document.getElementById('delete-confirm-overlay')?.remove();
  renderCharacters();
  if (state.syncEnabled && state.campaignId && window.fbDeleteCharacter) {
    window.fbDeleteCharacter(state.campaignId, id);
    if (state.dmNotes?.[id]) saveDMNote(id, '');
  }
}

function getRace(id) { return RACES.find(r => r.id === id)?.name || id || '?'; }

// ============================================================
// RULES HELPERS (2014 rules), shared by every view
// ============================================================
function abilityMod(ch, ab) { return Math.floor(((ch?.stats?.[ab] || 10) - 10) / 2); }
function proficiencyBonus(ch) { return Math.ceil((ch?.level || 1) / 4) + 1; }
function fmtMod(n) { return (n >= 0 ? '+' : '') + n; }

// AC: the DM or player can set it; otherwise a guess from the class's starting armour
function classDefaultAC(ch) {
  const dex = abilityMod(ch, 'dex'), con = abilityMod(ch, 'con'), wis = abilityMod(ch, 'wis');
  switch (ch?.class) {
    case 'barbarian': return 10 + dex + con;            // Unarmored Defense
    case 'monk':      return 10 + dex + wis;            // Unarmored Defense
    case 'fighter':
    case 'paladin':   return 16;                        // Chain mail
    case 'cleric':
    case 'ranger':    return 14 + Math.min(dex, 2);     // Scale mail
    case 'bard': case 'rogue': case 'warlock':
    case 'artificer': case 'druid': return 11 + dex;    // Leather
    default:          return 10 + dex;                  // No armour
  }
}
function calcAC(ch) {
  if (!ch?.stats) return 10;
  return Number.isFinite(+ch.acOverride) && ch.acOverride !== '' && ch.acOverride !== null ? +ch.acOverride : classDefaultAC(ch);
}
function editAC(id) {
  const c = state.characters.find(x => x.id === id);
  if (!c) return;
  const v = prompt(`Armour Class for ${c.name || 'this character'}.\nLeave blank to use the class default (${classDefaultAC(c)}).`, c.acOverride ?? '');
  if (v === null) return;
  const n = parseInt(v, 10);
  if (v.trim() === '' || isNaN(n)) delete c.acOverride; else c.acOverride = n;
  save(); refreshSheets();
}

function raceSpeed(ch) { return RACES.find(r => r.id === ch?.race)?.speed || 30; }

function isSaveProficient(ch, ab) { return (CLASSES.find(c => c.id === ch?.class)?.saves || []).includes(ab); }
function saveBonus(ch, ab) { return abilityMod(ch, ab) + (isSaveProficient(ch, ab) ? proficiencyBonus(ch) : 0); }

function backgroundSkills(ch) {
  const bg = BACKGROUNDS.find(b => b.id === ch?.background);
  return bg ? bg.desc.split(',').map(x => x.trim()) : [];
}
function isSkillProficient(ch, skill) { return backgroundSkills(ch).includes(skill) || (ch?.skillProfs || []).includes(skill); }
function skillBonus(ch, skill) {
  const sk = SKILL_LIST.find(s => s.name === skill);
  return abilityMod(ch, sk?.ab) + (isSkillProficient(ch, skill) ? proficiencyBonus(ch) : 0);
}
function passivePerception(ch) { return 10 + skillBonus(ch, 'Perception'); }
function toggleSkillProf(id, skill) {
  const c = state.characters.find(x => x.id === id);
  if (!c || backgroundSkills(c).includes(skill)) return; // background skills are always on
  c.skillProfs = c.skillProfs || [];
  c.skillProfs = c.skillProfs.includes(skill) ? c.skillProfs.filter(s => s !== skill) : [...c.skillProfs, skill];
  save(); refreshSheets();
}

function spellcastingMod(ch) {
  const cls = CLASSES.find(c => c.id === ch?.class);
  return cls?.spellcaster ? abilityMod(ch, cls.statHp) : 0;
}

// Attack bonus and damage for a weapon: finesse uses the better of STR and DEX,
// ranged uses DEX, otherwise STR. Proficiency only if the class has it.
function weaponAttack(ch, w) {
  const str = abilityMod(ch, 'str'), dex = abilityMod(ch, 'dex');
  const mod = w.finesse ? Math.max(str, dex) : w.range === 'Ranged' ? dex : str;
  const proficient = classCanUseWeapon(ch.class, w);
  const atk = mod + (proficient ? proficiencyBonus(ch) : 0);
  const dmg = w.dmg + (mod ? (mod > 0 ? '+' : '−') + Math.abs(mod) : '');
  return { atk, dmg, proficient };
}

// Racial ability bonuses
function racialBonus(raceId) { return RACES.find(r => r.id === raceId)?.stats || {}; }
function addRacialBonus(stats, raceId, sign = 1) {
  const out = { ...stats };
  Object.entries(racialBonus(raceId)).forEach(([ab, n]) => { out[ab] = (out[ab] || 10) + sign * n; });
  return out;
}

// One-time update (DM's screen): give existing characters their racial bonuses.
// The racialApplied flag makes sure it is never added twice.
function applyRacialBonusesToExisting() {
  if (!state.currentUser?.isDM || !_charsLoaded) return;
  let changed = false;
  state.characters.forEach(c => {
    if (c.racialApplied || !c.race) return;
    const conBefore = abilityMod(c, 'con');
    c.stats = addRacialBonus(c.stats, c.race);
    const conDiff = abilityMod(c, 'con') - conBefore;
    if (conDiff) { c.maxHp += conDiff * c.level; c.currentHp = Math.max(0, c.currentHp + conDiff * c.level); }
    c.racialApplied = true;
    changed = true;
  });
  if (changed) save();
}

function uploadPortrait(charId, input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    compressImage(e.target.result, 256, 0.85, portrait => {
      const ch = state.characters.find(x => x.id === charId);
      if (!ch) return;
      ch.portrait = portrait;
      // Only the DM changes the map. A player's new portrait reaches the
      // token library and their tokens when the DM's screen receives it.
      if (state.currentUser?.isDM) {
        const active = state.maps.find(m => m.id === state.activeMapId);
        if (active && !mapState.tokens.some(t => t.charId === charId)) {
          mapState.tokens.push({ id: 'tok_' + Date.now(), name: ch.name, type: 'player', charId,
            x: 0.5, y: 0.5, img: portrait, hidden: false, size: 1 });
          active.tokens = mapState.tokens;
        }
        syncPortraitsToWorld();
      }
      save();
      refreshSheets();
      renderCharacters();
      renderTokenLibrary();
      redrawMap();
    });
  };
  reader.readAsDataURL(file);
}
function getClass(id) { return CLASSES.find(c => c.id === id)?.name || id || '?'; }

