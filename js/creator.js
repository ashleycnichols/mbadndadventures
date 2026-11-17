// ============================================================
// CHARACTER CREATOR
// ============================================================
function openCreator(id) {
  creatorState.editingId = id || null;
  if (id) {
    const c = state.characters.find(x => x.id === id);
    creatorState.draft = JSON.parse(JSON.stringify(c));
    document.getElementById('creator-modal-title').textContent = 'Edit Character';
  } else {
    creatorState.draft = {
      name:'', player: state.currentUser.isDM ? '' : state.currentUser.name,
      race:null, class:null, background:null, level:1,
      stats:{str:10,dex:10,con:10,int:10,wis:10,cha:10},
      spells:[], weapons:[], backstory:'', notes:'',
      maxHp:10, currentHp:10, spellSlots:{}
    };
    document.getElementById('creator-modal-title').textContent = 'Create New Character';
  }
  creatorState.step = 0;
  document.getElementById('creator-modal').classList.add('open');
  renderCreatorStep();
}

function closeCreator() {
  document.getElementById('creator-modal').classList.remove('open');
}

function editCharacter(id) {
  openCreator(id);
}

function creatorNext() {
  if (!validateCreatorStep()) return;
  if (creatorState.step < CREATOR_STEPS.length - 1) {
    creatorState.step++;
    renderCreatorStep();
  } else {
    saveCharacter();
  }
}

function creatorBack() {
  if (creatorState.step > 0) { creatorState.step--; renderCreatorStep(); }
}

function validateCreatorStep() {
  const d = creatorState.draft;
  if (creatorState.step === 0 && !d.name) { alert('Enter a name for your character.'); return false; }
  if (creatorState.step === 1 && !d.race) { alert('Choose a race.'); return false; }
  if (creatorState.step === 2 && !d.class) { alert('Choose a class.'); return false; }
  return true;
}

function renderCreatorStep() {
  const step = creatorState.step;
  // Steps indicators
  let stepsHtml = CREATOR_STEPS.map((s, i) => {
    let cls = i < step ? 'step-indicator done' : i === step ? 'step-indicator active' : 'step-indicator';
    return `<div class="${cls}" onclick="if(${i}<=${step}){creatorState.step=${i};renderCreatorStep()}">${s}</div>`;
  }).join('');
  document.getElementById('creator-steps').innerHTML = stepsHtml;

  const nextBtn = document.getElementById('creator-next-btn');
  nextBtn.textContent = step === CREATOR_STEPS.length - 1 ? '💾 Save Character' : 'Next →';
  document.getElementById('creator-back-btn').style.visibility = step === 0 ? 'hidden' : 'visible';

  let html = '';
  const d = creatorState.draft;

  switch(step) {
    case 0: // Identity
      html = `<div class="form-row">
        <div class="input-group"><label class="form-label">Character Name *</label>
          <input class="parchment-input" id="f-name" value="${esc(d.name)}" placeholder="Aelindra Swiftwind..."></div>
        <div class="input-group"><label class="form-label">Player Name</label>
          <input class="parchment-input" id="f-player" value="${esc(d.player)}" placeholder="Your name..." ${!state.currentUser?.isDM ? 'readonly style="opacity:0.7;cursor:default"' : ''}></div>
      </div>
      <div class="form-row">
        <div class="input-group"><label class="form-label">Level (1-20)</label>
          <input class="parchment-input" id="f-level" type="number" min="1" max="20" value="${d.level}"></div>
        <div class="input-group" style="display:flex;align-items:flex-end;padding-bottom:0.25rem">
          <div style="font-style:italic;font-size:0.85rem;color:var(--text-muted)">Max HP is calculated automatically from your class Hit Die and Constitution score after you set your stats.</div>
        </div>
      </div>`;
      break;

    case 1: // Race
      html = `<div class="option-grid">${RACES.map(r =>
        `<div class="option-card ${d.race===r.id?'selected':''}" onclick="selectOption('race','${r.id}')">
          <div class="opt-icon">${r.icon}</div>
          <div class="opt-name">${r.name}</div>
          <div class="opt-desc">${r.desc}</div>
        </div>`).join('')}</div>`;
      break;

    case 2: // Class
      html = `<div class="option-grid">${CLASSES.map(c =>
        `<div class="option-card ${d.class===c.id?'selected':''}" onclick="selectOption('class','${c.id}')">
          <div class="opt-icon">${c.icon}</div>
          <div class="opt-name">${c.name}</div>
          <div class="opt-desc">${c.desc}</div>
        </div>`).join('')}</div>`;
      break;

    case 3: // Background
      html = `<div class="option-grid">${BACKGROUNDS.map(b =>
        `<div class="option-card ${d.background===b.id?'selected':''}" onclick="selectOption('background','${b.id}')">
          <div class="opt-icon">${b.icon}</div>
          <div class="opt-name">${b.name}</div>
          <div class="opt-desc">${b.desc}</div>
        </div>`).join('')}</div>`;
      break;

    case 4: // Stats
      const stats = ['str','dex','con','int','wis','cha'];
      const labels = {str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma'};
      const clsObj4 = CLASSES.find(c => c.id === d.class);
      const previewHp = calcMaxHp(d.class, d.level, d.stats);
      html = `<p style="font-style:italic;color:var(--text-muted);margin-bottom:1rem;font-size:0.9rem">Enter your ability scores. Click "Roll" to randomly assign scores.</p>
        <div style="text-align:right;margin-bottom:1rem"><button class="btn-secondary btn-sm" onclick="rollStats()">🎲 Roll 4d6 Drop Lowest</button></div>
        <div class="stat-grid">${stats.map(s => {
          const val = d.stats[s];
          const mod = Math.floor((val - 10) / 2);
          return `<div class="stat-box">
            <div class="stat-name">${labels[s]}</div>
            <input type="number" id="stat-${s}" min="1" max="30" value="${val}" oninput="updateStatMod('${s}');updateHpPreview()" style="width:100%;text-align:center;background:transparent;border:none;outline:none;font-family:'Cinzel Decorative',serif;font-size:1.8rem;color:var(--text-main)">
            <div class="stat-mod" id="mod-${s}">${mod >= 0 ? '+' : ''}${mod}</div>
          </div>`;
        }).join('')}</div>
        <div id="hp-preview" style="margin-top:1.5rem;background:var(--parchment-dark);border:1px solid var(--parchment-deeper);border-left:4px solid var(--gold);border-radius:2px;padding:1rem;font-family:'Cinzel',serif;font-size:0.85rem">
          <span style="color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em">Calculated Max HP: </span>
          <span id="hp-preview-val" style="color:var(--blood);font-size:1.2rem;font-family:'Cinzel Decorative',serif">${previewHp}</span>
          <span style="color:var(--text-muted);font-size:0.75rem;margin-left:0.5rem">(${clsObj4 ? `Hit Die: d${clsObj4.hd}, Max HP at 1st level + avg per level after` : '—'})</span>
        </div>`;
      break;

    case 5: { // Spells & Weapons
      const cls = CLASSES.find(c => c.id === d.class);
      const isSpellcaster = cls?.spellcaster;
      const spellLimits = isSpellcaster ? getSpellLimits(d.class, d.level, d.stats) : null;

      // Determine highest spell slot level available at this character level
      // slots array: index 0 = 1st-level slots, index 1 = 2nd-level slots, etc.
      const lvlIdx = Math.min(d.level - 1, 19);
      const slots = cls?.spellSlots?.[lvlIdx] || [];
      const maxSpellLevel = slots.reduce((max, count, i) => count > 0 ? i + 1 : max, 0);

      // Only show spells the character can actually cast (cantrips always, leveled spells up to maxSpellLevel)
      const classSpells = SPELLS.filter(sp => sp.classes.includes(d.class) && (sp.level === 0 || sp.level <= maxSpellLevel));

      const profWeapons = WEAPONS.filter(w => classCanUseWeapon(d.class, w));
      const nonProfWeapons = WEAPONS.filter(w => !classCanUseWeapon(d.class, w));

      // Count selected cantrips and leveled spells
      const selCantrips = d.spells.filter(id => SPELLS.find(s=>s.id===id)?.level===0).length;
      const selLeveled = d.spells.filter(id => (SPELLS.find(s=>s.id===id)?.level||0) > 0).length;

      html = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
        <div>
          <div class="sidebar-title" style="margin-bottom:0.4rem">Weapons</div>
          <div style="font-size:0.8rem;color:var(--text-muted);font-style:italic;margin-bottom:0.75rem">${cls?.name||'Your class'} is proficient with: <strong style="color:var(--text-main)">${cls?.weaponProf==='all'?'all weapons':cls?.weaponProf?.replace(/,/g,', ')||'—'}</strong>. Non-proficient weapons shown below with ⚠.</div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.4rem">Selected: <strong id="weapon-count" style="color:var(--gold)">${d.weapons.length}</strong> / ${cls?.weaponLimit||4}</div>
          <div class="filter-bar" id="weapon-filter-bar">
            <button class="filter-btn active" onclick="filterWeapons('all',this)">All</button>
            <button class="filter-btn" onclick="filterWeapons('prof',this)">Proficient Only</button>
            <button class="filter-btn" onclick="filterWeapons('Simple',this)">Simple</button>
            <button class="filter-btn" onclick="filterWeapons('Martial',this)">Martial</button>
          </div>
          <div id="weapon-list" style="max-height:320px;overflow-y:auto">
            ${WEAPONS.map(w => {
              const hasProf = classCanUseWeapon(d.class, w);
              return `<div class="weapon-item ${d.weapons.includes(w.id)?'selected':''} ${!hasProf?'no-prof':''}" onclick="toggleWeapon('${w.id}',this)" data-type="${w.weight}" data-prof="${hasProf?'prof':'nonprof'}" style="${!hasProf?'opacity:0.5':''}">
                <input type="checkbox" ${d.weapons.includes(w.id)?'checked':''} style="accent-color:var(--gold)">
                <span class="weapon-name">${!hasProf?'⚠ ':''}${w.name}</span>
                <span class="weapon-dmg">${w.dmg}</span>
                <span class="weapon-type">${w.type}</span>
              </div>`;
            }).join('')}
          </div>
        </div>
        <div>
          <div class="sidebar-title" style="margin-bottom:0.4rem">Spells ${!isSpellcaster?'<span style="font-size:0.7rem;color:var(--text-muted)">(not a spellcaster)</span>':''}</div>
          ${isSpellcaster && spellLimits ? `
          <div style="background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:0.6rem 0.75rem;margin-bottom:0.75rem;font-size:0.8rem">
            <div style="font-family:'Cinzel',serif;font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.3rem">Selection Limits · Level ${d.level} ${cls.name} · Spell slots up to level <strong>${maxSpellLevel || 'none yet'}</strong></div>
            <div style="display:flex;gap:1rem;flex-wrap:wrap">
              <span>Cantrips: <strong id="cantrip-count" style="color:${selCantrips>spellLimits.cantrips?'var(--blood)':'var(--green-health)'}">${selCantrips}</strong> / ${spellLimits.cantrips}</span>
              <span>${spellLimits.isPrepared ? 'Prepared' : 'Known'} spells: <strong id="known-count" style="color:${selLeveled>spellLimits.totalKnown?'var(--blood)':'var(--green-health)'}">${selLeveled}</strong> / ${spellLimits.totalKnown}</span>
            </div>
          </div>
          <div class="filter-bar" id="spell-filter-bar">
            ${[0,1,2,3,4,5,6,7,8,9].filter(l => classSpells.some(s => s.level===l)).map(l =>
              `<button class="filter-btn" onclick="filterSpells(${l},this)">${l===0?'Cantrip':'Lv '+l}</button>`).join('')}
          </div>
          <div id="spell-list" class="spell-list">
            ${classSpells.map(sp => `<div class="spell-item ${d.spells.includes(sp.id)?'selected':''}" onclick="toggleSpell('${sp.id}',this,${sp.level})" data-level="${sp.level}" title="${sp.desc||''}">
              <input type="checkbox" ${d.spells.includes(sp.id)?'checked':''} style="accent-color:var(--gold)" onclick="event.preventDefault();event.stopPropagation();toggleSpell('${sp.id}',this.closest('.spell-item'),${sp.level})">
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:0.4rem">
                  <span class="spell-name">${sp.name}</span>
                  <span class="spell-level">${sp.level===0?'C':sp.level}</span>
                  <span class="spell-school" style="font-size:0.7rem">${sp.school}</span>
                  <button onclick="event.stopPropagation();showSpellDetail('${sp.id}')" style="margin-left:auto;background:none;border:1px solid var(--border);border-radius:2px;padding:0.1rem 0.35rem;font-size:0.65rem;cursor:pointer;color:var(--text-muted);font-family:'Cinzel',serif;flex-shrink:0" title="View full spell details">?</button>
                </div>
                <div style="font-size:0.75rem;color:var(--text-muted);font-style:italic;line-height:1.3;margin-top:0.1rem">${sp.desc||''}</div>
              </div>
            </div>`).join('')}
          </div>` : isSpellcaster ? '<p style="font-style:italic;color:var(--text-muted);font-size:0.85rem">Preparing spellcasting data...</p>' : '<p style="font-style:italic;color:var(--text-muted);font-size:0.85rem">No spellcasting for this class.</p>'}
        </div>
      </div>
      <!-- Spell detail popup -->
      <div id="spell-detail-popup" class="hidden" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:3000;display:none;align-items:center;justify-content:center;padding:1rem" onclick="closeSpellDetail()">
        <div style="background:var(--parchment);border:2px solid var(--gold);border-radius:2px;max-width:500px;width:100%;padding:1.5rem;box-shadow:0 20px 60px rgba(0,0,0,0.5)" onclick="event.stopPropagation()">
          <div id="spell-detail-content"></div>
          <div style="text-align:right;margin-top:1rem"><button class="btn-secondary btn-sm" onclick="closeSpellDetail()">Close</button></div>
        </div>
      </div>`;
      break;
    }

    case 6: // Finish
      const calcedHp = calcMaxHp(d.class, d.level, d.stats);
      html = `<div class="form-full"><label class="form-label">Backstory</label>
        <textarea class="parchment-input" id="f-backstory" rows="4" placeholder="Where did you come from? What drives you?">${esc(d.backstory)}</textarea></div>
      <div class="form-full"><label class="form-label">Notes / Equipment</label>
        <textarea class="parchment-input" id="f-notes" rows="3" placeholder="Gear, personality traits, bonds...">${esc(d.notes)}</textarea></div>
      <div style="background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:1rem;margin-top:1rem">
        <div style="font-family:'Cinzel',serif;font-size:0.8rem;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:0.75rem;text-transform:uppercase">Summary</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;font-size:0.9rem">
          <div><strong>Name:</strong> ${esc(d.name) || '—'}</div>
          <div><strong>Player:</strong> ${esc(d.player) || '—'}</div>
          <div><strong>Race:</strong> ${getRace(d.race)}</div>
          <div><strong>Class:</strong> ${getClass(d.class)} ${d.level}</div>
          <div><strong>Background:</strong> ${d.background || '—'}</div>
          <div><strong>Max HP:</strong> <span style="color:var(--blood);font-weight:bold">${calcedHp}</span> <span style="font-size:0.8rem;color:var(--text-muted)">(auto-calculated)</span></div>
          <div><strong>Spells:</strong> ${d.spells.length}</div>
          <div><strong>Weapons:</strong> ${d.weapons.length}</div>
        </div>
      </div>`;
      break;
  }

  document.getElementById('creator-steps-content').innerHTML = html;
}

function selectOption(field, val) {
  creatorState.draft[field] = val;
  document.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
  event.target.closest('.option-card').classList.add('selected');
}

function updateStatMod(s) {
  const val = +document.getElementById('stat-'+s)?.value || 10;
  creatorState.draft.stats[s] = val;
  const mod = Math.floor((val-10)/2);
  const el = document.getElementById('mod-'+s);
  if (el) el.textContent = (mod>=0?'+':'')+mod;
}

function updateHpPreview() {
  ['str','dex','con','int','wis','cha'].forEach(s => {
    const v = +document.getElementById('stat-'+s)?.value;
    if (v) creatorState.draft.stats[s] = v;
  });
  const hp = calcMaxHp(creatorState.draft.class, creatorState.draft.level, creatorState.draft.stats);
  const el = document.getElementById('hp-preview-val');
  if (el) el.textContent = hp;
}

function calcMaxHp(classId, level, stats) {
  const cls = CLASSES.find(c => c.id === classId);
  if (!cls) return 10;
  const conMod = Math.floor(((stats?.con || 10) - 10) / 2);
  const hd = cls.hd;
  // Level 1: max HD + con. Subsequent levels: average roll (hd/2 + 1) + con
  const avgPerLevel = Math.floor(hd / 2) + 1;
  return (hd + conMod) + (level - 1) * (avgPerLevel + conMod);
}

function showSpellDetail(id) {
  const sp = SPELLS.find(s => s.id === id);
  if (!sp) return;
  const popup = document.getElementById('spell-detail-popup');
  document.getElementById('spell-detail-content').innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;margin-bottom:1rem">
      <div>
        <div style="font-family:'Cinzel',serif;font-size:1.1rem;font-weight:700;color:var(--text-main)">${sp.name}</div>
        <div style="font-size:0.85rem;color:var(--text-muted);font-style:italic;margin-top:0.15rem">${sp.level===0?'Cantrip':'Level '+sp.level} ${sp.school}</div>
      </div>
      <div style="background:var(--parchment-dark);border:1px solid var(--parchment-deeper);border-radius:2px;padding:0.3rem 0.6rem;font-family:'Cinzel',serif;font-size:0.75rem;white-space:nowrap;color:var(--text-muted)">${sp.level===0?'Cantrip':'Lv '+sp.level}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;font-size:0.82rem;margin-bottom:1rem;background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:0.6rem">
      <div><strong>Cast:</strong> ${sp.cast||'—'}</div>
      <div><strong>Range:</strong> ${sp.range||'—'}</div>
      <div><strong>Duration:</strong> ${sp.duration||'—'}</div>
      <div><strong>School:</strong> ${sp.school||'—'}</div>
    </div>
    <div style="font-size:0.95rem;line-height:1.6;color:var(--text-main)">${sp.detail||sp.desc||'No description available.'}</div>`;
  popup.style.display = 'flex';
  popup.classList.remove('hidden');
}

function closeSpellDetail() {
  const popup = document.getElementById('spell-detail-popup');
  if (popup) { popup.style.display = 'none'; popup.classList.add('hidden'); }
}

function updateSpellCounts() {
  const d = creatorState.draft;
  const selCantrips = d.spells.filter(id => (SPELLS.find(s=>s.id===id)?.level||0)===0).length;
  const selLeveled = d.spells.filter(id => (SPELLS.find(s=>s.id===id)?.level||0) > 0).length;
  const limits = getSpellLimits(d.class, d.level, d.stats);
  const cc = document.getElementById('cantrip-count');
  const kc = document.getElementById('known-count');
  if (cc && limits) { cc.textContent = selCantrips; cc.style.color = selCantrips > limits.cantrips ? 'var(--blood)' : 'var(--green-health)'; }
  if (kc && limits) { kc.textContent = selLeveled; kc.style.color = selLeveled > limits.totalKnown ? 'var(--blood)' : 'var(--green-health)'; }
}


function rollStats() {
  const stats = ['str','dex','con','int','wis','cha'];
  stats.forEach(s => {
    const rolls = [1,2,3,4].map(() => Math.ceil(Math.random()*6));
    rolls.sort((a,b) => a-b);
    const val = rolls.slice(1).reduce((a,b) => a+b, 0);
    document.getElementById('stat-'+s).value = val;
    const mod = Math.floor((val-10)/2);
    document.getElementById('mod-'+s).textContent = (mod>=0?'+':'')+mod;
    creatorState.draft.stats[s] = val;
  });
  updateHpPreview();
}

function toggleSpell(id, el, spellLevel) {
  const cb = el.querySelector('input[type="checkbox"]');
  const d = creatorState.draft;
  const limits = getSpellLimits(d.class, d.level, d.stats);
  const isSelected = d.spells.includes(id);

  if (isSelected) {
    // Deselect
    d.spells = d.spells.filter(x => x !== id);
    if (cb) cb.checked = false;
    el.classList.remove('selected');
  } else {
    // Check limits before adding
    if (limits) {
      const isCantrip = spellLevel === 0;
      if (isCantrip) {
        const cur = d.spells.filter(sid => (SPELLS.find(s=>s.id===sid)?.level||0)===0).length;
        if (cur >= limits.cantrips) {
          if (cb) cb.checked = false;
          showLimitWarning(`Cantrip limit reached — ${limits.cantrips} max for Level ${d.level} ${d.class}`);
          return;
        }
      } else {
        const cur = d.spells.filter(sid => (SPELLS.find(s=>s.id===sid)?.level||0) > 0).length;
        if (cur >= limits.totalKnown) {
          if (cb) cb.checked = false;
          showLimitWarning(`Spell limit reached — ${limits.totalKnown} ${limits.isPrepared?'prepared':'known'} spells max for Level ${d.level} ${d.class}`);
          return;
        }
      }
    }
    d.spells.push(id);
    if (cb) cb.checked = true;
    el.classList.add('selected');
  }
  updateSpellCounts();
}

function showLimitWarning(msg) {
  let w = document.getElementById('limit-warning');
  if (!w) {
    w = document.createElement('div');
    w.id = 'limit-warning';
    w.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:var(--blood);color:var(--parchment);font-family:Cinzel,serif;font-size:0.85rem;padding:0.7rem 1.5rem;border-radius:2px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.4);pointer-events:none;transition:opacity 0.3s';
    document.body.appendChild(w);
  }
  w.textContent = msg;
  w.style.opacity = '1';
  clearTimeout(w._t);
  w._t = setTimeout(() => { w.style.opacity = '0'; }, 2500);
}


function toggleWeapon(id, el) {
  const cb = el.querySelector('input[type="checkbox"]');
  const d = creatorState.draft;
  const cls = CLASSES.find(c => c.id === d.class);
  const limit = cls?.weaponLimit || 4;

  if (d.weapons.includes(id)) {
    d.weapons = d.weapons.filter(x => x !== id);
    if (cb) cb.checked = false;
    el.classList.remove('selected');
  } else {
    if (d.weapons.length >= limit) {
      if (cb) cb.checked = false;
      showLimitWarning(`Weapon limit reached — ${cls?.name || 'this class'} can start with ${limit} weapon${limit !== 1 ? 's' : ''}`);
      return;
    }
    d.weapons.push(id);
    if (cb) cb.checked = true;
    el.classList.add('selected');
  }
  const counter = document.getElementById('weapon-count');
  if (counter) counter.textContent = d.weapons.length;
}

function filterSpells(level, btn) {
  document.getElementById('spell-filter-bar')?.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('#spell-list .spell-item').forEach(el => {
    el.style.display = (level === 'all' || +el.dataset.level === +level) ? '' : 'none';
  });
}

function filterWeapons(type, btn) {
  document.getElementById('weapon-filter-bar')?.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('#weapon-list .weapon-item').forEach(el => {
    const matchType = type === 'all' || el.dataset.type === type;
    const matchProf = type !== 'prof' || el.dataset.prof === 'prof';
    el.style.display = (matchType && matchProf) ? '' : 'none';
  });
}


function saveCreatorFields() {
  const d = creatorState.draft;
  const step = creatorState.step;
  if (step === 0) {
    d.name = document.getElementById('f-name')?.value || d.name;
    // For players, always lock player field to their login name — never trust the form value
    if (state.currentUser?.isDM) {
      d.player = document.getElementById('f-player')?.value || d.player;
    } else {
      d.player = state.currentUser.name;
    }
    d.level = +document.getElementById('f-level')?.value || d.level;
  }
  if (step === 4) {
    ['str','dex','con','int','wis','cha'].forEach(s => {
      const v = +document.getElementById('stat-'+s)?.value;
      if (v) d.stats[s] = v;
    });
    // Auto-calculate HP from class hit die + CON
    const hp = calcMaxHp(d.class, d.level, d.stats);
    d.maxHp = hp;
    d.currentHp = hp;
  }
  if (step === 6) {
    d.backstory = document.getElementById('f-backstory')?.value || d.backstory;
    d.notes = document.getElementById('f-notes')?.value || d.notes;
    // Final recalculation in case level changed
    const hp = calcMaxHp(d.class, d.level, d.stats);
    d.maxHp = hp;
    if (!creatorState.editingId) d.currentHp = hp;
  }
}

function saveCharacter() {
  saveCreatorFields();
  const d = creatorState.draft;
  if (!d.id) d.id = 'char_' + Date.now();
  if (!d.currentHp) d.currentHp = d.maxHp;
  // Always stamp the correct player name — never allow mismatch
  if (!state.currentUser?.isDM) d.player = state.currentUser.name;

  const idx = state.characters.findIndex(c => c.id === d.id);
  if (idx >= 0) state.characters[idx] = d;
  else state.characters.push(d);

  save();
  closeCreator();
  renderCharacters();
}

// Intercept next to save fields before advancing
const origCreatorNext = creatorNext;
window.creatorNext = function() {
  saveCreatorFields();
  if (!validateCreatorStep()) return;
  if (creatorState.step < CREATOR_STEPS.length - 1) {
    creatorState.step++;
    renderCreatorStep();
  } else {
    saveCharacter();
  }
};

