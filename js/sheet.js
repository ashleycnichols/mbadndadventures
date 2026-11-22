// ============================================================
// MY SHEET
// ============================================================
// Starting equipment by class
const STARTING_EQUIPMENT = {
  barbarian: 'Greataxe, Two handaxes, Explorer\'s pack, Four javelins, 2gp',
  bard: 'Rapier, Diplomat\'s pack, Lute, Leather armor, Dagger, 15gp',
  cleric: 'Mace, Scale mail, Light crossbow with 20 bolts, Priest\'s pack, Shield, Holy symbol, 15gp',
  druid: 'Wooden shield, Scimitar, Leather armor, Explorer\'s pack, Druidic focus, 2gp',
  fighter: 'Chain mail, Martial weapon, Shield, Light crossbow with 20 bolts, Dungeoneer\'s pack, 10gp',
  monk: 'Shortsword, Dungeoneer\'s pack, 10 darts, 5gp',
  paladin: 'Martial weapon, Shield, Javelins x5, Priest\'s pack, Chain mail, Holy symbol, 15gp',
  ranger: 'Scale mail, Two shortswords, Dungeoneer\'s pack, Longbow, Quiver with 20 arrows, 10gp',
  rogue: 'Rapier, Shortbow with 20 arrows, Burglar\'s pack, Leather armor, Two daggers, Thieves\' tools, 10gp',
  sorcerer: 'Light crossbow with 20 bolts, Arcane focus, Dungeoneer\'s pack, Two daggers, 3gp',
  warlock: 'Light crossbow with 20 bolts, Arcane focus, Scholar\'s pack, Leather armor, Simple weapon, Two daggers, 10gp',
  wizard: 'Quarterstaff, Spellbook, Scholar\'s pack, Arcane focus, 4gp',
  artificer: 'Two hand crossbows with 20 bolts each, Alchemist\'s supplies, Dungeoneer\'s pack, Leather armor, Thieves\' tools, 10gp',
  'blood-hunter': 'Martial weapon, Leather armor, Dungeoneer\'s pack, 10gp',
};

// Characters belonging to the logged-in player, and the one they're playing now
function myCharacters() {
  if (!state.currentUser || state.currentUser.isDM) return [];
  return state.characters.filter(isMine);
}
function myActiveChar() {
  const mine = myCharacters();
  const id = localStorage.getItem('chronicler_active_char');
  return mine.find(c => c.id === id) || mine[0] || null;
}
function setActiveChar(id) {
  localStorage.setItem('chronicler_active_char', id);
  refreshSheets();
}

// Redraw whichever character views are open, after any change
function refreshSheets(opts = {}) {
  const typing = opts.skipIfTyping && document.activeElement && ['TEXTAREA','INPUT','SELECT'].includes(document.activeElement.tagName);
  const isActive = id => document.getElementById(id)?.classList.contains('active');
  if (!state.currentUser?.isDM && isActive('panel-map')) renderCombatSidebar();
  if (typing) return;
  if (isActive('panel-sheet')) renderMySheet();
  if (isActive('panel-party')) state.dmPartyCharId ? renderDMSheet(state.dmPartyCharId) : renderPartyPanel();
  if (isActive('panel-quick')) renderQuickView();
  if (isActive('panel-combat')) renderCombatView();
}

function renderMySheet() {
  const container = document.getElementById('sheet-content');
  if (!container) return;
  if (!state.currentUser) { container.innerHTML = '<div class="empty-state"><p>Not logged in.</p></div>'; return; }
  if (state.currentUser.isDM) {
    container.innerHTML = '<div class="empty-state"><p>Open a character from the Party tab.</p></div>';
    return;
  }
  const c = myActiveChar();
  if (!c) {
    container.innerHTML = `<div class="empty-state">
      <p>No character found for <strong>${esc(state.currentUser.name)}</strong>.</p>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-top:0.5rem">Characters in campaign: ${esc(state.characters.map(ch => ch.player || 'unknown').join(', ')) || 'none'}</p>
      <p style="margin-top:1rem"><button class="btn-primary btn-gold" style="width:auto;padding:0.7rem 1.5rem" onclick="openCreator()">Create Your Character</button></p>
    </div>`;
    return;
  }
  const mine = myCharacters();
  const picker = mine.length > 1 ? `<div style="max-width:900px;margin:0 auto;padding:1rem 1rem 0;display:flex;align-items:center;gap:0.5rem">
      <span style="font-family:var(--font-ui);font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">Playing as</span>
      <select onchange="setActiveChar(this.value)" style="padding:0.3rem 0.5rem;border:1px solid var(--border);background:var(--parchment);border-radius:2px;font-family:var(--font-ui);font-size:0.85rem">
        ${mine.map(ch => `<option value="${ch.id}" ${ch.id === c.id ? 'selected' : ''}>${esc(ch.name) || 'Unnamed'}</option>`).join('')}
      </select>
    </div>` : '';
  container.innerHTML = picker + renderSheet(c);
}

// Full character sheet HTML, used by My Sheet and by the DM's Party tab
function renderSheet(c) {
  normalizeChar(c);
  const race = RACES.find(r => r.id === c.race);
  const cls = casterClass(c);   // includes Eldritch Knight / Arcane Trickster spellcasting
  const bg = BACKGROUNDS.find(b => b.id === c.background);
  const stats = ['str','dex','con','int','wis','cha'];
  const labels = {str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma'};
  const shortLabels = {str:'STR',dex:'DEX',con:'CON',int:'INT',wis:'WIS',cha:'CHA'};

  // Derived stats
  const profBonus = Math.ceil(c.level / 4) + 1;
  const getMod = s => Math.floor(((c.stats[s]||10) - 10) / 2);
  const spellMod = cls?.statHp ? getMod(cls.statHp) : 0;
  const spellDC = 8 + profBonus + spellMod;
  const spellAtk = profBonus + spellMod;
  const initMod = initiativeBonus(c);
  const passivePerc = passivePerception(c);

  const ac = calcAC(c);

  const hpPct = Math.max(0, Math.round(c.currentHp / c.maxHp * 100));
  const hpColor = hpPct > 60 ? 'var(--green-health)' : hpPct > 25 ? 'var(--amber)' : 'var(--blood)';

  const spellObjs = allSpellIds(c).map(id => SPELLS.find(s => s.id === id)).filter(Boolean);
  const granted = grantedSpells(c);
  const star = id => granted.includes(id) ? ` <span title="${esc(grantedLabel(c))}" style="color:var(--gold-text);font-size:0.75rem">★</span>` : '';
  const weaponObjs = c.weapons.map(id => WEAPONS.find(w => w.id === id)).filter(Boolean);
  const cantrips = spellObjs.filter(s => s.level === 0);
  const leveledSpells = spellObjs.filter(s => s.level > 0);

  // Spell slots for this character
  const lvlIdx = Math.min(c.level - 1, 19);
  const slotCounts = cls?.spellSlots?.[lvlIdx] || [];

  const CONDITIONS = ['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious'];

  return `
  <div style="max-width:900px;margin:0 auto;padding:1rem">
    <!-- HEADER -->
    <div style="background:var(--parchment-dark);border:2px solid var(--gold);border-radius:2px;padding:1rem 1.5rem;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem">
      <div style="display:flex;gap:1rem;align-items:center">
        <div style="position:relative;flex-shrink:0">
          <div style="width:72px;height:72px;border-radius:50%;border:2px solid var(--gold);overflow:hidden;background:var(--parchment-dark);display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="document.getElementById('portrait-upload-${c.id}').click()" title="Click to upload portrait">
            ${c.portrait ? `<img src="${c.portrait}" style="width:100%;height:100%;object-fit:cover">` : `<span style="font-size:2rem;opacity:0.4">🧙</span>`}
          </div>
          <input type="file" id="portrait-upload-${c.id}" accept="image/*" style="display:none" onchange="uploadPortrait('${c.id}', this)">
          <div style="font-size:0.72rem;font-family:var(--font-ui);color:var(--text-muted);text-align:center;margin-top:0.2rem;opacity:0.7">click to change</div>
        </div>
        <div>
          <div style="font-family:var(--font-display);font-size:1.4rem;color:var(--text-main)">${esc(c.name) || 'Unnamed Hero'}</div>
          <div style="font-family:var(--font-ui);font-size:0.8rem;color:var(--text-muted);margin-top:0.2rem">${race?.name||''} ${cls?.name||''}${c.subclass ? ' (' + esc(c.subclass) + ')' : ''} · Level ${c.level} · ${bg?.name||'No Background'}${c.player ? ' · ' + esc(c.player) : ''}</div>
          ${subclassPickerHTML(c)}
        </div>
      </div>
      <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
        <button class="btn-secondary btn-sm" onclick="doShortRest('${c.id}')">☕ Short Rest</button>
        <button class="btn-secondary btn-sm" onclick="doLongRest('${c.id}')">🌙 Long Rest</button>
        <button class="btn-secondary btn-sm" style="border-color:var(--gold);color:var(--gold-text)" onclick="openLevelUp('${c.id}')">⬆ Level Up</button>
        <button class="btn-secondary btn-sm" onclick="editCharacter('${c.id}')">✏ Edit</button>
        <button onclick="toggleInspiration('${c.id}')" title="${c.inspiration ? 'Remove Inspiration' : 'Grant Inspiration'}" style="background:${c.inspiration ? 'rgba(201,148,42,0.2)' : 'none'};border:1px solid ${c.inspiration ? 'var(--gold)' : 'var(--border)'};border-radius:2px;cursor:pointer;padding:0.3rem 0.6rem;font-size:1rem;line-height:1;transition:all 0.15s" title="Inspiration">⭐</button>
      </div>
    </div>

    <!-- QUICK STATS BAR -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:0.5rem;margin-bottom:1rem">
      ${[
        ['AC', ac, `editAC('${c.id}')`, c.acOverride !== undefined ? 'Set by hand. Click to change' : 'Class default. Click to set your actual AC'],
        ['Proficiency','+'+profBonus],
        ['Initiative',(initMod>=0?'+':'')+initMod],
        ['Passive Perc.',passivePerc],
        ['Speed', raceSpeedText(c)],
        cls?.spellcaster ? ['Spell DC', spellDC] : null,
        cls?.spellcaster ? ['Spell Atk', (spellAtk>=0?'+':'')+spellAtk] : null,
      ].filter(Boolean).map(([label,val,click,tip]) => `
        <div ${click ? `onclick="${click}" title="${tip}"` : ''} style="background:var(--parchment-dark);border:1px solid ${click ? 'var(--gold)' : 'var(--border)'};border-radius:2px;padding:0.5rem;text-align:center;${click ? 'cursor:pointer' : ''}">
          <div style="font-size:1.1rem;font-family:var(--font-ui);font-weight:600;font-variant-numeric:lining-nums;color:var(--gold-text)">${val}</div>
          <div style="font-size:0.72rem;font-family:var(--font-ui);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">${label}</div>
        </div>`).join('')}
      ${c.inspiration ? `<div style="background:rgba(201,148,42,0.15);border:1px solid var(--gold);border-radius:2px;padding:0.5rem;text-align:center">
        <div style="font-size:1.1rem">⭐</div>
        <div style="font-size:0.72rem;font-family:var(--font-ui);color:var(--gold-text);text-transform:uppercase;letter-spacing:0.05em">Inspired</div>
      </div>` : ''}
    </div>

    <div class="sheet-two-col" style="display:grid;grid-template-columns:1fr 1.6fr;gap:1rem">
      <!-- LEFT COLUMN -->
      <div style="display:flex;flex-direction:column;gap:1rem">

        <!-- HP BLOCK -->
        <div style="background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:1rem">
          <div style="font-family:var(--font-ui);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:0.5rem">Hit Points</div>
          <div style="display:flex;align-items:baseline;gap:0.5rem;margin-bottom:0.4rem">
            <span id="hp-display-${c.id}" style="font-family:var(--font-ui);font-weight:600;font-variant-numeric:lining-nums;font-size:2.5rem;color:${hpColor};line-height:1">${c.currentHp}</span>
            <span style="color:var(--text-muted);font-size:0.9rem">/ ${c.maxHp}</span>
            ${c.tempHp > 0 ? `<span style="font-size:0.8rem;color:var(--blue);margin-left:0.25rem">(+${c.tempHp} temp)</span>` : ''}
          </div>
          <div class="char-hp-bar" style="margin-bottom:0.75rem"><div class="char-hp-fill" style="width:${hpPct}%;background:${hpColor}"></div></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;margin-bottom:0.5rem">
            <button class="btn-secondary btn-sm" style="color:var(--green-health);border-color:var(--green-health)" onclick="sheetAdjustHP('${c.id}',1)">+ Heal</button>
            <button class="btn-secondary btn-sm" style="color:var(--blood);border-color:var(--blood)" onclick="sheetAdjustHP('${c.id}',-1)">− Damage</button>
          </div>
          <div style="display:flex;gap:0.4rem;align-items:center">
            <input type="number" id="hp-adjust-${c.id}" min="1" placeholder="Amount" style="flex:1;padding:0.3rem 0.5rem;border:1px solid var(--parchment-deeper);border-radius:2px;font-size:0.85rem;background:var(--input-bg);font-family:var(--font-ui)">
            <input type="number" id="temp-hp-input-${c.id}" min="0" placeholder="Temp HP" style="flex:1;padding:0.3rem 0.5rem;border:1px solid var(--parchment-deeper);border-radius:2px;font-size:0.85rem;background:var(--input-bg);font-family:var(--font-ui)" oninput="setTempHP('${c.id}',this.value)" value="${c.tempHp||''}">
          </div>
        </div>

        <!-- DEATH SAVES -->
        ${c.currentHp <= 0 ? `
        <div style="background:var(--parchment-dark);border:2px solid var(--blood);border-radius:2px;padding:1rem">
          <div style="font-family:var(--font-ui);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--blood);margin-bottom:0.6rem">Death Saving Throws</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem">
            <span style="font-size:0.85rem;color:var(--green-health)">Successes</span>
            <div style="display:flex;gap:0.4rem">${[0,1,2].map(i => `<button onclick="toggleDeathSave('${c.id}','success',${i})" style="width:24px;height:24px;border-radius:50%;border:2px solid var(--green-health);background:${i<c.deathSaves.success?'var(--green-health)':'transparent'};cursor:pointer"></button>`).join('')}</div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:0.85rem;color:var(--blood)">Failures</span>
            <div style="display:flex;gap:0.4rem">${[0,1,2].map(i => `<button onclick="toggleDeathSave('${c.id}','fail',${i})" style="width:24px;height:24px;border-radius:50%;border:2px solid var(--blood);background:${i<c.deathSaves.fail?'var(--blood)':'transparent'};cursor:pointer"></button>`).join('')}</div>
          </div>
        </div>` : ''}

        <!-- HIT DICE -->
        <div style="background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:1rem">
          <div style="font-family:var(--font-ui);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:0.5rem">Hit Dice · d${cls?.hd||8}</div>
          <div style="display:flex;align-items:center;gap:0.75rem">
            <span style="font-family:var(--font-ui);font-weight:600;font-variant-numeric:lining-nums;font-size:1.5rem;color:var(--gold-text)">${c.level - (c.hitDiceUsed||0)}</span>
            <span style="color:var(--text-muted);font-size:0.85rem">/ ${c.level} remaining</span>
            <button class="btn-secondary btn-sm" onclick="useHitDie('${c.id}')" ${(c.hitDiceUsed||0)>=c.level?'disabled':''}>Use</button>
          </div>
        </div>

        <!-- ABILITY SCORES -->
        <div style="background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:1rem">
          <div style="font-family:var(--font-ui);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:0.5rem">Ability Scores</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem">
            ${stats.map(s => {
              const val = c.stats[s]||10;
              const mod = getMod(s);
              return `<div style="background:var(--parchment);border:1px solid var(--parchment-deeper);border-radius:2px;padding:0.4rem 0.5rem;display:flex;justify-content:space-between;align-items:center">
                <span style="font-family:var(--font-ui);font-size:0.7rem;color:var(--text-muted)">${shortLabels[s]}</span>
                <span style="font-size:0.9rem;font-weight:600">${val}</span>
                <span style="font-family:var(--font-ui);font-size:0.8rem;color:var(--gold-text)">${mod>=0?'+':''}${mod}</span>
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- SAVING THROWS -->
        <div style="background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:1rem">
          <div style="font-family:var(--font-ui);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:0.5rem">Saving Throws</div>
          <div style="display:flex;flex-direction:column;gap:0.2rem">
            ${stats.map(s => {
              const bonus = saveBonus(c, s);
              const prof = isSaveProficient(c, s);
              return `<div style="display:flex;justify-content:space-between;font-size:0.85rem">
                <span style="color:var(--text-muted)"><span style="color:${prof ? 'var(--gold)' : 'var(--border)'}" title="${prof ? 'Proficient' : ''}">${prof ? '●' : '○'}</span> ${labels[s]}</span>
                <span style="font-family:var(--font-ui);color:var(--text-main)">${fmtMod(bonus)}</span>
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- CONDITIONS -->
        <div style="background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:1rem">
          <div style="font-family:var(--font-ui);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:0.5rem">Conditions</div>
          <div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.5rem">
            ${c.conditions.length ? c.conditions.map(cond => `<span style="background:rgba(139,26,26,0.15);border:1px solid var(--blood);border-radius:10px;padding:0.15rem 0.6rem;font-size:0.75rem;font-family:var(--font-ui);cursor:pointer" onclick="removeCondition('${c.id}','${cond}')" title="Click to remove">${cond} ✕</span>`).join('') : '<span style="font-size:0.8rem;color:var(--text-muted);font-style:italic">None</span>'}
          </div>
          <select id="condition-select-${c.id}" style="font-size:0.8rem;padding:0.25rem;border:1px solid var(--border);background:var(--parchment);border-radius:2px;font-family:var(--font-ui)" onchange="addCondition('${c.id}',this)">
            <option value="">+ Add condition…</option>
            ${CONDITIONS.map(cond => `<option value="${cond}">${cond}</option>`).join('')}
          </select>
          ${concentrationControl(c)}
          <div style="margin-top:0.5rem">
            <span style="font-size:0.8rem;color:var(--text-muted)">Exhaustion: </span>
            ${[1,2,3,4,5,6].map(i => `<button onclick="setExhaustion('${c.id}',${i===c.exhaustion?i-1:i})" style="width:20px;height:20px;border-radius:50%;border:1px solid var(--border);background:${i<=c.exhaustion?'var(--blood)':'transparent'};font-size:0.72rem;cursor:pointer;margin-left:2px" title="Level ${i}">${i}</button>`).join('')}
          </div>
        </div>

        <!-- RACIAL TRAITS (left column, so it's close at hand) -->
        ${racialTraitsBlock(c)}
      </div>

      <!-- RIGHT COLUMN -->
      <div style="display:flex;flex-direction:column;gap:1rem">

        <!-- CLASS RESOURCES (Ki, Rage, Channel Divinity...) -->
        ${resourcesHTML(c)}

        <!-- SKILLS -->
        <div style="background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:1rem">
          <div style="font-family:var(--font-ui);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:0.5rem">Skills <span style="text-transform:none;letter-spacing:0;font-style:italic">· ● proficient${canExpertise(c) ? ', ◉ expertise' : ''}, click to change</span></div>
          <div class="skills-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:0.15rem">
            ${SKILL_LIST.map(sk => {
              const prof = isSkillProficient(c, sk.name);
              const expert = hasExpertise(c, sk.name);
              const fromBg = fixedSkills(c).includes(sk.name);
              const src = backgroundSkills(c).includes(sk.name) ? 'Proficient from background' : raceSkills(c).includes(sk.name) ? 'Proficient from race' : subSkills(c).includes(sk.name) ? 'Proficient from ' + c.subclass : prof ? 'Proficient' : '';
              const tip = expert ? 'Expertise (double proficiency). Click to remove' : canExpertise(c) && prof ? src + '. Click to mark Expertise' : fromBg ? src : prof ? 'Proficient. Click to remove' : 'Click to mark proficient';
              return `<div onclick="toggleSkillProf('${c.id}','${sk.name}')" title="${tip}" style="display:flex;justify-content:space-between;align-items:center;font-size:0.82rem;padding:0.1rem 0.25rem;cursor:${fromBg && !canExpertise(c) ? 'default' : 'pointer'}">
                <span style="color:var(--text-main)"><span style="color:${prof ? 'var(--gold)' : 'var(--border)'}">${expert ? '◉' : prof ? '●' : '○'}</span> ${sk.name} <span style="color:var(--text-muted);font-size:0.72rem">(${shortLabels[sk.ab]})</span></span>
                <span style="font-family:var(--font-ui);color:var(--text-main);font-size:0.8rem">${fmtMod(skillBonus(c, sk.name))}</span>
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- WEAPONS / ATTACKS -->
        ${weaponObjs.length ? `
        <div style="background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:1rem">
          <div style="font-family:var(--font-ui);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:0.5rem">Weapons & Attacks</div>
          <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:0.25rem 0.75rem;align-items:center">
            <div style="font-size:0.7rem;color:var(--text-muted);font-family:var(--font-ui)">Name</div>
            <div style="font-size:0.7rem;color:var(--text-muted);font-family:var(--font-ui)">Atk</div>
            <div style="font-size:0.7rem;color:var(--text-muted);font-family:var(--font-ui)">Dmg</div>
            <div style="font-size:0.7rem;color:var(--text-muted);font-family:var(--font-ui)">Type</div>
            ${weaponObjs.map(w => {
              const wa = weaponAttack(c, w);
              return `<div style="font-family:var(--font-ui);font-size:0.85rem">${w.name}${wa.proficient ? '' : ' <span title="Not proficient: no proficiency bonus" style="color:var(--blood)">⚠</span>'}${wa.crit < 20 ? ` <span style="font-size:0.72rem;color:var(--gold-text)" title="Critical hit range">crit ${wa.crit}–20</span>` : ''}</div>
                <div style="font-family:var(--font-ui);font-size:0.85rem;color:var(--gold-text)">${fmtMod(wa.atk)}</div>
                <div style="font-family:var(--font-ui);font-size:0.85rem;color:var(--blood)">${wa.dmg}</div>
                <div style="font-size:0.78rem;color:var(--text-muted);font-style:italic">${w.type}</div>`;
            }).join('')}
          </div>
        </div>` : ''}

        <!-- SPELL SLOTS -->
        ${cls?.spellcaster && slotCounts.length ? `
        <div style="background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:1rem">
          <div style="font-family:var(--font-ui);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:0.6rem">Spell Slots</div>
          ${slotCounts.map((total, i) => {
            if (!total) return '';
            const spellLvl = i + 1;
            const used = c.usedSlots[spellLvl] || 0;
            const remaining = total - used;
            return `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem">
              <span style="font-family:var(--font-ui);font-size:0.75rem;color:var(--text-muted);width:45px">Lvl ${spellLvl}</span>
              <div style="display:flex;gap:0.3rem;flex:1">
                ${Array.from({length:total},(_,j) => `<button onclick="toggleSlot('${c.id}',${spellLvl},${j})" style="width:22px;height:22px;border-radius:50%;border:2px solid var(--gold);background:${j<remaining?'var(--gold)':'transparent'};cursor:pointer;transition:background 0.15s" title="${j<remaining?'Expend slot':'Slot expended — click to recover'}"></button>`).join('')}
              </div>
              <span style="font-size:0.75rem;color:var(--text-muted)">${remaining}/${total}</span>
            </div>`;
          }).join('')}
        </div>` : ''}

        <!-- CANTRIPS -->
        ${cantrips.length ? `
        <div style="background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:1rem">
          <div style="font-family:var(--font-ui);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:0.4rem">Cantrips (at will)</div>
          <div style="display:flex;flex-wrap:wrap;gap:0.3rem">
            ${cantrips.map(sp => `<span onclick="showSheetSpellDetail('${sp.id}','${c.id}')" style="background:var(--parchment);border:1px solid var(--border);border-radius:2px;padding:0.2rem 0.6rem;font-family:var(--font-ui);font-size:0.78rem;cursor:pointer;transition:border-color 0.15s" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border)'">${sp.name}${star(sp.id)}</span>`).join('')}
          </div>
        </div>` : ''}

        <!-- LEVELED SPELLS -->
        ${cls?.spellcaster ? `
        <div style="background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:1rem">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem">
            <div style="font-family:var(--font-ui);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted)">Spells</div>
            <button onclick="openAddSpell('${c.id}')" style="background:none;border:1px solid var(--gold);color:var(--gold-text);border-radius:2px;padding:0.2rem 0.6rem;font-family:var(--font-ui);font-size:0.7rem;cursor:pointer">＋ ${c.class==='wizard'?'Copy to Spellbook':'Add Spell'}</button>
          </div>
          ${[1,2,3,4,5,6,7,8,9].map(lvl => {
            const group = leveledSpells.filter(s => s.level === lvl);
            if (!group.length) return '';
            return `<div style="margin-bottom:0.5rem">
              <div style="font-size:0.72rem;font-family:var(--font-ui);color:var(--gold-text);margin-bottom:0.2rem">Level ${lvl}</div>
              ${group.map(sp => {
                const canCast = castOptions(c, sp).length > 0;
                return `<div onclick="showSheetSpellDetail('${sp.id}','${c.id}')" style="display:flex;align-items:center;gap:0.5rem;font-size:0.9rem;padding:0.25rem 0.25rem;border-bottom:1px solid var(--parchment-deeper);cursor:pointer;border-radius:2px;transition:background 0.12s" onmouseover="this.style.background='rgba(201,148,42,0.1)'" onmouseout="this.style.background=''">
                <span style="flex:1">${sp.name}${star(sp.id)}${/concentration/i.test(sp.duration || '') ? ' <span title="Concentration" style="font-size:0.75rem;color:var(--blue)">◆</span>' : ''}</span>
                <span style="font-size:0.8rem;color:var(--text-muted);font-style:italic">${sp.school}</span>
                <button onclick="event.stopPropagation();castSpell('${c.id}','${sp.id}')" ${canCast ? '' : 'disabled'} title="${canCast ? 'Cast using the lowest free slot' : 'No slots of this level or higher left'}" style="border:1px solid ${canCast ? 'var(--gold)' : 'var(--border)'};background:${canCast ? 'rgba(201,148,42,0.12)' : 'none'};color:${canCast ? 'var(--gold-text)' : 'var(--text-muted)'};border-radius:2px;padding:0.1rem 0.5rem;font-family:var(--font-ui);font-size:0.8rem;cursor:${canCast ? 'pointer' : 'default'}">Cast</button>
              </div>`;
              }).join('')}
            </div>`;
          }).join('')}
          ${!leveledSpells.length ? `<div style="font-size:0.8rem;color:var(--text-muted);font-style:italic">No spells known yet.</div>` : ''}
        </div>` : ''}

        <!-- CLASS FEATURES -->
        ${featuresBlock(c)}

        <!-- INVENTORY -->
        <div style="background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:1rem">
          <div style="font-family:var(--font-ui);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:0.4rem">Inventory & Equipment</div>
          <textarea id="inventory-text-${c.id}" style="width:100%;min-height:120px;background:var(--input-bg);border:1px solid var(--parchment-deeper);border-radius:2px;padding:0.5rem;font-family:var(--font-ui);font-size:0.9rem;color:var(--text-main);resize:vertical;line-height:1.5" onblur="saveInventory('${c.id}',this.value)">${esc(c.inventory)}</textarea>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.35rem">
            <span id="inventory-save-status-${c.id}" style="font-size:0.72rem;color:var(--text-muted);font-style:italic"></span>
            <button onclick="saveInventoryBtn('${c.id}')" class="btn-primary btn-gold btn-sm" style="width:auto;padding:0.35rem 1rem">💾 Save Inventory</button>
          </div>
        </div>

        <!-- BACKSTORY & NOTES -->
        ${c.backstory || c.notes ? `
        <div style="background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:1rem">
          ${c.backstory ? `<div style="margin-bottom:0.75rem"><div style="font-family:var(--font-ui);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:0.3rem">Backstory</div><p style="font-style:italic;font-size:0.9rem;line-height:1.6;color:var(--text-muted)">${esc(c.backstory)}</p></div>` : ''}
          ${c.notes ? `<div><div style="font-family:var(--font-ui);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:0.3rem">Notes</div><p style="font-size:0.9rem;line-height:1.6;color:var(--text-muted)">${esc(c.notes)}</p></div>` : ''}
        </div>` : ''}

      </div>
    </div>
  </div>`;
}


// Racial traits, with what the sheet already includes in its numbers
function racialTraitsBlock(c) {
  const traits = RACE_TRAITS[c.race];
  const race = RACES.find(r => r.id === c.race);
  if (!traits || !race) return '';
  const bonusApplied = !!c.racialApplied;
  return `<div style="background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:1rem">
    <div style="font-family:var(--font-ui);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:0.4rem">${esc(race.name)} Traits</div>
    <div style="font-size:0.85rem;color:var(--text-muted);font-style:italic;margin-bottom:0.6rem">
      <span style="color:var(--green-health);font-style:normal">✓ Included</span> means the sheet's numbers already count it.
      <span style="color:var(--amber);font-style:normal">✎ Your choice</span> means you add it yourself with Edit.
    </div>
    ${traits.map(t => {
      const included = t.auto && (t.auto.startsWith('ability') ? bonusApplied : true);
      return `<div style="padding:0.35rem 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;gap:0.5rem;flex-wrap:wrap">
          <strong style="font-size:0.92rem">${t.name}</strong>
          <span style="font-size:0.8rem;display:flex;gap:0.5rem;flex-wrap:wrap">
            ${included ? `<span style="color:var(--green-health)" title="Already in the sheet's numbers">✓ Included in ${t.auto}</span>` : ''}
            ${t.auto && !included ? `<span style="color:var(--amber)">Not yet applied to this character</span>` : ''}
            ${t.choose ? `<span style="color:var(--amber)">✎ Your choice: ${t.choose}</span>` : ''}
          </span>
        </div>
        <div style="font-size:0.88rem;color:var(--text-muted);line-height:1.4">${t.text}</div>
      </div>`;
    }).join('')}
  </div>`;
}

function toggleInspiration(id) {
  const c = state.characters.find(x => x.id === id);
  if (!c) return;
  c.inspiration = !c.inspiration;
  save();
  refreshSheets();
  renderCharacters();
}
// Damage comes off temporary HP first; healing stops at max HP
function applyHpChange(c, sign, amt) {
  if (sign < 0) {
    const absorbed = Math.min(c.tempHp || 0, amt);
    c.tempHp = (c.tempHp || 0) - absorbed;
    c.currentHp = Math.max(0, c.currentHp - (amt - absorbed));
    if (c.concentration) {
      if (c.currentHp <= 0) {
        showLimitWarning(`${c.name || 'Character'} is down: concentration on ${concentrationName(c)} ends.`);
        delete c.concentration;
      } else {
        showLimitWarning(`${c.name || 'Character'}: Constitution save DC ${Math.max(10, Math.floor(amt / 2))} to keep concentrating on ${concentrationName(c)}.`);
      }
    }
  } else {
    const wasDown = c.currentHp <= 0;
    c.currentHp = Math.min(c.maxHp, c.currentHp + amt);
    if (wasDown && c.currentHp > 0) c.deathSaves = { success: 0, fail: 0 };
  }
}

function sheetAdjustHP(id, sign, inputId) {
  const c = state.characters.find(x => x.id === id);
  if (!c) return;
  const input = document.getElementById(inputId || ('hp-adjust-' + id));
  const amt = Math.floor(+(input?.value));
  if (!amt || amt < 0) { showLimitWarning('Enter an amount first'); return; }
  applyHpChange(c, sign, amt);
  if (input) input.value = '';
  save(); refreshSheets();
}

function setTempHP(id, val) {
  const c = state.characters.find(x => x.id === id);
  if (!c) return;
  c.tempHp = Math.max(0, parseInt(val)||0);
  save();
}

function toggleSlot(id, spellLevel, slotIndex) {
  const c = state.characters.find(x => x.id === id);
  if (!c) return;
  if (!c.usedSlots) c.usedSlots = {};
  const cls = CLASSES.find(cl => cl.id === c.class);
  const lvlIdx = Math.min(c.level - 1, 19);
  const total = slotsFor(c)[spellLevel - 1] || 0;
  const used = c.usedSlots[spellLevel] || 0;
  const remaining = total - used;
  // Click a filled slot = expend it; click empty = recover it
  if (slotIndex < remaining) {
    c.usedSlots[spellLevel] = used + 1; // expend
  } else {
    c.usedSlots[spellLevel] = Math.max(0, used - 1); // recover
  }
  save(); refreshSheets();
}

function toggleDeathSave(id, type, index) {
  const c = state.characters.find(x => x.id === id);
  if (!c) return;
  if (!c.deathSaves) c.deathSaves = {success:0,fail:0};
  c.deathSaves[type] = c.deathSaves[type] === index + 1 ? index : index + 1;
  save(); refreshSheets();
}

function useHitDie(id) {
  const c = state.characters.find(x => x.id === id);
  if (!c) return;
  if ((c.hitDiceUsed || 0) >= c.level) { showLimitWarning('No hit dice left. A long rest recovers some.'); return; }
  const cls = CLASSES.find(cl => cl.id === c.class);
  const hd = cls?.hd || 8;
  const roll = Math.floor(Math.random() * hd) + 1;
  const conMod = Math.floor(((c.stats.con||10)-10)/2);
  const heal = Math.max(1, roll + conMod);
  applyHpChange(c, 1, heal);
  c.hitDiceUsed = (c.hitDiceUsed||0) + 1;
  showLimitWarning(`Rolled d${hd}: ${roll} ${conMod >= 0 ? '+' : '−'} ${Math.abs(conMod)} CON = ${heal} HP restored`);
  save(); refreshSheets();
}

function addCondition(id, select) {
  const val = select.value;
  if (!val) return;
  const c = state.characters.find(x => x.id === id);
  if (!c) return;
  if (!c.conditions) c.conditions = [];
  if (!c.conditions.includes(val)) c.conditions.push(val);
  select.value = '';
  save(); refreshSheets();
}

function removeCondition(id, cond) {
  const c = state.characters.find(x => x.id === id);
  if (!c) return;
  c.conditions = (c.conditions||[]).filter(x => x !== cond);
  save(); refreshSheets();
}

function setExhaustion(id, level) {
  const c = state.characters.find(x => x.id === id);
  if (!c) return;
  c.exhaustion = level;
  save(); refreshSheets();
}

function saveInventory(id, text) {
  const c = state.characters.find(x => x.id === id);
  if (!c) return;
  c.inventory = text;
  save();
}

function saveInventoryBtn(id) {
  const ta = document.getElementById('inventory-text-' + id);
  if (!ta) return;
  saveInventory(id, ta.value);
  const status = document.getElementById('inventory-save-status-' + id);
  if (status) {
    status.textContent = '✓ Saved & synced';
    status.style.color = 'var(--green-health)';
    setTimeout(() => { if (status) { status.textContent = ''; } }, 2500);
  }
}

// ============================================================
// ADD SPELL (spellbook copying / learning outside level-up)
// ============================================================
function openAddSpell(charId) {
  const c = state.characters.find(x => x.id === charId);
  if (!c) return;
  const cls = casterClass(c);
  if (!cls?.spellcaster) return;

  // Max castable spell level from the class slot table
  const maxSlot = maxSpellLevel(c);
  const have = allSpellIds(c);
  const available = SPELLS.filter(sp =>
    spellOnList(c, sp) &&
    sp.level <= maxSlot &&
    !have.includes(sp.id)
  ).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  const existing = document.getElementById('addspell-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'addspell-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:4000;display:flex;align-items:center;justify-content:center;padding:1rem';
  const title = c.class === 'wizard' ? 'Copy Spell to Spellbook' : 'Add Spell';
  const note = c.class === 'wizard'
    ? 'Copy spells you have found on scrolls or in other spellbooks. Check with your DM that you have access to the spell in-game.'
    : 'Add a spell your character has learned. Check with your DM first.';
  modal.innerHTML = `
    <div style="background:var(--parchment);border:2px solid var(--gold);border-radius:2px;max-width:520px;width:100%;padding:1.5rem;box-shadow:0 24px 64px rgba(0,0,0,0.5);max-height:85vh;display:flex;flex-direction:column">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem">
        <div style="font-family:var(--font-display);font-size:1.1rem;color:var(--text-main)">${title}</div>
        <button onclick="document.getElementById('addspell-modal').remove()" style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--text-muted);line-height:1">✕</button>
      </div>
      <p style="font-size:0.8rem;color:var(--text-muted);font-style:italic;margin-bottom:0.75rem">${note} Spells up to level ${maxSlot} available.</p>
      <input id="addspell-filter" placeholder="Search spells..." oninput="filterAddSpellList()" style="width:100%;padding:0.45rem;border:1px solid var(--border);background:var(--input-bg);border-radius:2px;font-family:var(--font-ui);font-size:0.9rem;margin-bottom:0.5rem">
      <div id="addspell-list" style="overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:0.2rem">
        ${available.length ? available.map(sp => `
          <div class="addspell-row" data-name="${sp.name.toLowerCase()}" style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0.4rem;border-bottom:1px solid var(--parchment-deeper)">
            <span style="font-family:var(--font-ui);font-size:0.7rem;color:var(--gold-text);width:38px;flex-shrink:0">${sp.level === 0 ? 'Cant.' : 'Lv ' + sp.level}</span>
            <span style="font-size:0.88rem;cursor:pointer" onclick="showSheetSpellDetail('${sp.id}')" title="Click for details">${sp.name}</span>
            <span style="font-size:0.72rem;color:var(--text-muted);font-style:italic;margin-left:auto;margin-right:0.5rem">${sp.classes.includes(cls.spellList || c.class) ? '' : 'other list · '}${sp.school}</span>
            <button onclick="confirmAddSpell('${charId}','${sp.id}')" style="background:none;border:1px solid var(--gold);color:var(--gold-text);border-radius:2px;padding:0.15rem 0.5rem;font-family:var(--font-ui);font-size:0.7rem;cursor:pointer;flex-shrink:0">Add</button>
          </div>`).join('') : '<div style="font-size:0.85rem;color:var(--text-muted);font-style:italic;padding:0.5rem">No more spells available at your level.</div>'}
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function filterAddSpellList() {
  const q = (document.getElementById('addspell-filter')?.value || '').toLowerCase();
  document.querySelectorAll('.addspell-row').forEach(row => {
    row.style.display = row.dataset.name.includes(q) ? '' : 'none';
  });
}

function confirmAddSpell(charId, spellId) {
  const c = state.characters.find(x => x.id === charId);
  if (!c) return;
  if (!c.spells.includes(spellId)) {
    c.spells.push(spellId);
    save();
  }
  const sp = SPELLS.find(s => s.id === spellId);
  showLimitWarning(`${sp?.name || 'Spell'} added!`);
  document.getElementById('addspell-modal')?.remove();
  refreshSheets();
}

// ---- Casting: spends the right slot automatically ----
// Slot levels this spell can be cast with that still have a slot free
function castOptions(c, sp) {
  if (!c || !sp || sp.level === 0) return [];
  const slots = slotsFor(c);
  return slots.map((total, i) => ({ level: i + 1, left: (total || 0) - (c.usedSlots?.[i + 1] || 0) }))
    .filter(o => o.level >= sp.level && o.left > 0);
}

function castSpell(charId, spellId, atLevel) {
  const c = state.characters.find(x => x.id === charId);
  const sp = SPELLS.find(s => s.id === spellId);
  if (!c || !sp) return;
  const concentrates = /concentration/i.test(sp.duration || '');
  let msg;
  if (sp.level === 0) {
    msg = `${sp.name}: cantrips don't use spell slots.`;
  } else {
    const opts = castOptions(c, sp);
    if (!opts.length) { showLimitWarning(`No spell slots of level ${sp.level} or higher left. A long rest restores them.`); return; }
    const use = (atLevel && opts.find(o => o.level === atLevel)) || opts[0];
    c.usedSlots = c.usedSlots || {};
    c.usedSlots[use.level] = (c.usedSlots[use.level] || 0) + 1;
    msg = `Cast ${sp.name}${use.level > sp.level ? ` at level ${use.level}` : ''}. ${use.left - 1} level-${use.level} slot${use.left - 1 === 1 ? '' : 's'} left.` + healBonusText(c, sp, use.level);
  }
  if (concentrates) {
    const prev = c.concentration && c.concentration !== sp.id ? concentrationName(c) : null;
    c.concentration = sp.id;
    msg += prev ? ` Concentration on ${prev} ends; now concentrating on ${sp.name}.` : ` Concentrating on ${sp.name}.`;
  }
  document.getElementById('sheet-spell-modal')?.remove();
  showLimitWarning(msg);
  save(); refreshSheets();
}

// Remove a spell (for example, changing prepared spells after a long rest)
function removeSpell(charId, spellId) {
  const c = state.characters.find(x => x.id === charId);
  if (!c) return;
  c.spells = c.spells.filter(x => x !== spellId);
  document.getElementById('sheet-spell-modal')?.remove();
  save(); refreshSheets();
}

function doShortRest(id) {
  const c = state.characters.find(x => x.id === id);
  if (!c) return;
  // Warlocks (and Profane Souls) recover pact magic slots on a short rest
  const pact = casterClass(c)?.pact;
  if (pact) c.usedSlots = {};
  const refills = classResources(c).filter(r => r.reset === 'short' && (c.resUsed?.[r.id] || 0) > 0).map(r => r.name);
  refillResources(c, 'short');
  c.deathSaves = {success:0, fail:0};
  showLimitWarning('Short rest complete.' + (pact ? ' Pact slots recovered.' : '') + (refills.length ? ` Refilled: ${refills.join(', ')}.` : '') + ' Spend hit dice to recover HP.');
  save(); refreshSheets();
}

function doLongRest(id) {
  const c = state.characters.find(x => x.id === id);
  if (!c) return;
  c.currentHp = c.maxHp;
  c.tempHp = 0;
  c.usedSlots = {};
  c.hitDiceUsed = Math.max(0, (c.hitDiceUsed||0) - Math.max(1, Math.floor(c.level/2)));
  c.deathSaves = {success:0, fail:0};
  delete c.concentration;
  refillResources(c, 'long');
  c.bladesong = false;
  const hadExhaustion = c.exhaustion > 0;
  if (hadExhaustion) c.exhaustion -= 1;
  showLimitWarning('Long rest complete! HP, spell slots and class resources restored' + (hadExhaustion ? ', exhaustion reduced by 1.' : '.'));
  save(); refreshSheets();
}

// ============================================================
// SPELL DETAIL MODAL (sheet)
// ============================================================
function showSheetSpellDetail(id, charId) {
  const sp = SPELLS.find(s => s.id === id);
  if (!sp) return;
  const existing = document.getElementById('sheet-spell-modal');
  if (existing) existing.remove();
  const lvlLabel = sp.level === 0 ? 'Cantrip' : `Level ${sp.level}`;
  const modal = document.createElement('div');
  modal.id = 'sheet-spell-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:4000;display:flex;align-items:center;justify-content:center;padding:1rem';
  modal.innerHTML = `
    <div style="background:var(--parchment);border:2px solid var(--gold);border-radius:2px;max-width:520px;width:100%;padding:1.5rem;box-shadow:0 24px 64px rgba(0,0,0,0.5);max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem">
        <div>
          <div style="font-family:var(--font-display);font-size:1.2rem;color:var(--text-main)">${sp.name}</div>
          <div style="font-family:var(--font-ui);font-size:0.75rem;color:var(--gold-text);margin-top:0.2rem">${lvlLabel} · ${sp.school}</div>
        </div>
        <button onclick="document.getElementById('sheet-spell-modal').remove()" style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--text-muted);padding:0 0.25rem;line-height:1">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem 1rem;margin-bottom:1rem;padding:0.75rem;background:var(--parchment-dark);border-radius:2px;border:1px solid var(--border)">
        <div><span style="font-family:var(--font-ui);font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">Casting Time</span><div style="font-size:0.9rem">${sp.cast||'—'}</div></div>
        <div><span style="font-family:var(--font-ui);font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">Range</span><div style="font-size:0.9rem">${sp.range||'—'}</div></div>
        <div><span style="font-family:var(--font-ui);font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">Duration</span><div style="font-size:0.9rem">${sp.duration||'—'}</div></div>
        ${sp.components ? `<div><span style="font-family:var(--font-ui);font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">Components</span><div style="font-size:0.9rem">${sp.components}</div></div>` : ''}
      </div>
      <p style="font-style:italic;color:var(--text-muted);font-size:0.9rem;margin-bottom:0.75rem;line-height:1.5">${sp.desc||''}</p>
      <p style="font-size:0.95rem;line-height:1.7;color:var(--text-main)">${sp.detail||''}</p>
      ${(() => {
        const ch = charId && state.characters.find(x => x.id === charId);
        if (!ch || !allSpellIds(ch).includes(id) || sp.level === 0) return '';
        const opts = castOptions(ch, sp);
        if (!opts.length) return `<div style="margin-top:1rem;font-size:0.9rem;color:var(--blood)">No spell slots of level ${sp.level} or higher left.</div>`;
        return `<div style="margin-top:1rem;padding-top:0.75rem;border-top:1px solid var(--border)">
          <div style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:0.4rem">Cast using a slot of level</div>
          <div style="display:flex;flex-wrap:wrap;gap:0.4rem">${opts.map(o => `<button onclick="castSpell('${charId}','${id}',${o.level})" style="border:1px solid var(--gold);background:rgba(201,148,42,0.12);color:var(--gold-text);border-radius:2px;padding:0.35rem 0.7rem;font-family:var(--font-ui);font-size:0.95rem;cursor:pointer">${o.level}${o.level > sp.level ? ' (upcast)' : ''} · ${o.left} left</button>`).join('')}</div>
        </div>`;
      })()}
      <div style="margin-top:1.25rem;display:flex;justify-content:space-between;gap:0.5rem">
        ${charId && isGrantedSpell(state.characters.find(x => x.id === charId), id) ? `<span style="font-size:0.8rem;color:var(--gold-text)">★ ${esc(grantedLabel(state.characters.find(x => x.id === charId)))}</span>` : ''}${charId && state.characters.find(x => x.id === charId)?.spells.includes(id) && !isGrantedSpell(state.characters.find(x => x.id === charId), id) ? `<button class="btn-secondary btn-sm" style="color:var(--blood);border-color:var(--blood)" onclick="removeSpell('${charId}','${id}')">Remove from sheet</button>` : '<span></span>'}
        <button class="btn-secondary btn-sm" onclick="document.getElementById('sheet-spell-modal').remove()">Close</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

