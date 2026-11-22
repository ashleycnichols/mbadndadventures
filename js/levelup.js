// ============================================================
// LEVEL UP SYSTEM
// ============================================================
let levelUpState = {};

function openLevelUp(id) {
  const c = state.characters.find(x => x.id === id);
  if (!c) return;
  if (c.level >= 20) { showLimitWarning('Already at maximum level (20)!'); return; }
  levelUpState = { charId: id, newLevel: c.level + 1, choices: {} };
  buildLevelUp(c);
}

// Works out what this level brings. Runs again when the specialty is chosen,
// since that can add features, spells and HP.
function buildLevelUp(c) {
  const choices = levelUpState.choices;
  const newLevel = levelUpState.newLevel;
  // The character as they'll be after levelling, including a specialty picked here
  const p = { ...c, level: newLevel, subclass: choices.subclass || c.subclass, subclassOption: choices.subclassOption || c.subclassOption };
  const cls = CLASSES.find(cl => cl.id === c.class);
  const oldCaster = casterClass(c), newCaster = casterClass(p);
  const baseHp = Math.floor((cls?.hd||8) / 2) + 1 + Math.floor(((c.stats.con||10)-10)/2) + (RACE_HP_PER_LEVEL[c.race] || 0);
  const subHp = subHpPerLevel(p) * newLevel - subHpPerLevel(c) * c.level;   // Draconic Resilience
  const newHpRoll = baseHp + subHp;
  const newProfBonus = Math.ceil(newLevel / 4) + 1;

  const changes = [];
  changes.push({ type:'info', label:'Hit Points', value:`+${newHpRoll} HP (average d${cls?.hd||8} + CON mod${subHp ? ` + ${subHp} ${p.subclass}` : ''})` });

  const oldProf = Math.ceil(c.level / 4) + 1;
  if (newProfBonus > oldProf) changes.push({ type:'info', label:'Proficiency Bonus', value:`+${oldProf} → +${newProfBonus}` });

  // Specialty due at this level (or earlier and never chosen)
  const needsSub = SUBCLASSES[c.class] && !c.subclass && newLevel >= (SUBCLASS_LEVEL[c.class] || 3);
  if (needsSub) changes.push({ type:'subclass', label: SUBCLASS_LABEL[c.class] || 'Specialty' });
  if (p.subclass && subOptionNames(p.subclass).length && !p.subclassOption) changes.push({ type:'subopt', label: SUBCLASS_INFO[p.subclass].options.label });

  // Ability Score Improvement at 4, 8, 12, 16, 19
  if ([4,8,12,16,19].includes(newLevel)) {
    changes.push({ type:'asi', label:'Ability Score Improvement', value:'Choose +2 to one ability or +1 to two abilities' });
    if (!choices.asi) choices.asi = { mode:'double', stat:'str' };
  }

  // New features: the class's at this level, and the specialty's (all of them up to now if just chosen)
  const fromSub = choices.subclass ? 1 : newLevel;
  const feats = featureList(p, newLevel, newLevel).filter(f => f.src !== p.subclass)
    .concat(featureList(p, newLevel, fromSub).filter(f => f.src === p.subclass));
  if (feats.length) changes.push({ type:'features', label:'New Features', list: feats });

  // Spells the specialty gives for free
  const newGranted = grantedSpells(p).filter(id => !grantedSpells(c).includes(id));
  if (newGranted.length) changes.push({ type:'info', label: grantedLabel(p).replace(/ \(.*/, ''), value: newGranted.map(id => SPELLS.find(s => s.id === id)?.name).join(', ') });

  // New spell slots
  const lvlIdx = Math.min(newLevel - 1, 19);
  const oldIdx = Math.min(c.level - 1, 19);
  const newSlots = newCaster?.spellSlots?.[lvlIdx] || [];
  const oldSlots = oldCaster?.spellSlots?.[oldIdx] || [];
  const slotChanges = [];
  for (let i = 0; i < newSlots.length; i++) {
    const gained = (newSlots[i]||0) - (oldSlots[i]||0);
    if (gained > 0) slotChanges.push(`${gained} new Level ${i+1} slot${gained>1?'s':''}`);
  }
  if (slotChanges.length) changes.push({ type:'info', label:'New Spell Slots', value: slotChanges.join(', ') });

  // New cantrips
  const newCantrips = newCaster?.cantripsKnown?.[lvlIdx] || 0;
  const oldCantrips = oldCaster?.cantripsKnown?.[oldIdx] || 0;
  if (newCantrips > oldCantrips) changes.push({ type:'cantrip', label:'New Cantrip', value:`Choose ${newCantrips - oldCantrips} new cantrip${newCantrips - oldCantrips > 1 ? 's' : ''}`, count: newCantrips - oldCantrips });

  // New spells known (for known casters)
  const newKnown = newCaster?.spellsKnown?.[lvlIdx];
  const oldKnown = oldCaster?.spellsKnown?.[oldIdx];
  if (newKnown !== undefined && newKnown > (oldKnown||0)) {
    const gained = newKnown - (oldKnown||0);
    changes.push({ type:'spell', label:'New Spells Known', value:`Choose ${gained} new spell${gained>1?'s':''}`, count: gained });
  }

  // Wizards add spells to their spellbook every level
  if (newCaster?.spellbookPerLevel) {
    changes.push({ type:'spell', label:'Spellbook', value:`Add ${newCaster.spellbookPerLevel} new spells to your spellbook`, count: newCaster.spellbookPerLevel });
  }

  // Spells they can pick at the new level
  const newMaxSlot = newSlots.reduce((max,count,i) => count > 0 ? i+1 : max, 0);
  const have = allSpellIds(p);
  const accessibleSpells = SPELLS.filter(sp => spellOnList(p, sp) && sp.level > 0 && sp.level <= newMaxSlot && !have.includes(sp.id));
  const accessibleCantrips = SPELLS.filter(sp => spellOnList(p, sp) && sp.level === 0 && !have.includes(sp.id));
  // Drop picks that are no longer on offer (for example after changing the specialty)
  ['cantrips','spells'].forEach(k => { if (choices[k]) choices[k] = choices[k].filter(id => (k === 'cantrips' ? accessibleCantrips : accessibleSpells).some(s => s.id === id)); });

  levelUpState.changes = changes;
  levelUpState.newHp = newHpRoll;
  levelUpState.accessibleSpells = accessibleSpells;
  levelUpState.accessibleCantrips = accessibleCantrips;
  levelUpState.newMaxSlot = newMaxSlot;

  renderLevelUpModal(c, changes);
}

function levelUpSetSubclass(value) {
  const c = state.characters.find(x => x.id === levelUpState.charId);
  if (!c) return;
  if (value) levelUpState.choices.subclass = value; else delete levelUpState.choices.subclass;
  delete levelUpState.choices.subclassOption;
  buildLevelUp(c);
}
function levelUpSetSubOption(value) {
  const c = state.characters.find(x => x.id === levelUpState.charId);
  if (!c) return;
  if (value) levelUpState.choices.subclassOption = value; else delete levelUpState.choices.subclassOption;
  buildLevelUp(c);
}

function renderLevelUpModal(c, changes) {
  const existing = document.getElementById('levelup-modal');
  if (existing) existing.remove();

  const cls = CLASSES.find(cl => cl.id === c.class);
  const newLevel = levelUpState.newLevel;
  const choices = levelUpState.choices;

  const modal = document.createElement('div');
  modal.id = 'levelup-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:4000;display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto';

  let choiceHtml = '';

  changes.forEach((ch, idx) => {
    if (ch.type === 'info') {
      choiceHtml += `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.6rem 0.75rem;background:var(--parchment);border:1px solid var(--border);border-radius:2px;margin-bottom:0.5rem">
        <span style="font-family:var(--font-ui);font-size:0.8rem;color:var(--text-muted)">${ch.label}</span>
        <span style="font-size:0.85rem;color:var(--green-health);font-weight:600">${ch.value}</span>
      </div>`;
    }

    if (ch.type === 'subclass') {
      const cur = choices.subclass || '';
      choiceHtml += `<div style="padding:0.75rem;background:var(--parchment);border:1px solid var(--gold);border-radius:2px;margin-bottom:0.5rem">
        <div style="font-family:var(--font-ui);font-size:0.8rem;color:var(--gold-text);margin-bottom:0.4rem">Choose your ${ch.label}</div>
        <select onchange="levelUpSetSubclass(this.value)" style="width:100%;padding:0.4rem;border:1px solid var(--border);background:var(--parchment);border-radius:2px;font-family:var(--font-ui);font-size:0.85rem">
          <option value="">Choose…</option>
          ${SUBCLASSES[c.class].map(sc => `<option value="${sc}" ${cur===sc?'selected':''}>${sc}</option>`).join('')}
        </select>
        ${cur ? '' : '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.3rem;font-style:italic">You can also choose it later at the top of the sheet.</div>'}
      </div>`;
    }

    if (ch.type === 'subopt') {
      const sub = choices.subclass || c.subclass;
      choiceHtml += `<div style="padding:0.75rem;background:var(--parchment);border:1px solid var(--gold);border-radius:2px;margin-bottom:0.5rem">
        <div style="font-family:var(--font-ui);font-size:0.8rem;color:var(--gold-text);margin-bottom:0.4rem">${sub}: choose your ${ch.label}</div>
        <select onchange="levelUpSetSubOption(this.value)" style="width:100%;padding:0.4rem;border:1px solid var(--border);background:var(--parchment);border-radius:2px;font-family:var(--font-ui);font-size:0.85rem">
          <option value="">Choose…</option>
          ${subOptionNames(sub).map(o => `<option value="${o}" ${choices.subclassOption===o?'selected':''}>${o}</option>`).join('')}
        </select>
      </div>`;
    }

    if (ch.type === 'features') {
      choiceHtml += `<div style="padding:0.6rem 0.75rem;background:var(--parchment);border:1px solid var(--border);border-radius:2px;margin-bottom:0.5rem">
        <div style="font-family:var(--font-ui);font-size:0.8rem;color:var(--text-muted);margin-bottom:0.3rem">${ch.label}</div>
        ${ch.list.map(f => `<div style="padding:0.25rem 0;border-top:1px solid var(--parchment-deeper)">
          <div style="display:flex;justify-content:space-between;gap:0.5rem;flex-wrap:wrap"><strong style="font-size:0.88rem">${esc(f.name)}</strong>${featureTagHTML(f.tag)}</div>
          <div style="font-size:0.82rem;color:var(--text-muted);line-height:1.4">${esc(f.text)}</div>
        </div>`).join('')}
      </div>`;
    }

    if (ch.type === 'asi') {
      const asi = choices.asi || { mode:'double', stat:'str' };
      choiceHtml += `<div style="padding:0.75rem;background:var(--parchment);border:1px solid var(--gold);border-radius:2px;margin-bottom:0.5rem">
        <div style="font-family:var(--font-ui);font-size:0.8rem;color:var(--gold-text);margin-bottom:0.6rem">${ch.label}</div>
        <div style="display:flex;gap:0.5rem;margin-bottom:0.6rem">
          <button onclick="levelUpSetASIMode('double')" style="flex:1;padding:0.35rem;border:2px solid ${asi.mode==='double'?'var(--gold)':'var(--border)'};background:${asi.mode==='double'?'rgba(201,148,42,0.15)':'transparent'};border-radius:2px;cursor:pointer;font-family:var(--font-ui);font-size:0.75rem">+2 to one</button>
          <button onclick="levelUpSetASIMode('split')" style="flex:1;padding:0.35rem;border:2px solid ${asi.mode==='split'?'var(--gold)':'var(--border)'};background:${asi.mode==='split'?'rgba(201,148,42,0.15)':'transparent'};border-radius:2px;cursor:pointer;font-family:var(--font-ui);font-size:0.75rem">+1 to two</button>
        </div>
        ${asi.mode === 'double' ? `
        <select onchange="levelUpState.choices.asi={mode:'double',stat:this.value}" style="width:100%;padding:0.4rem;border:1px solid var(--border);background:var(--parchment);border-radius:2px;font-family:var(--font-ui);font-size:0.85rem">
          ${['str','dex','con','int','wis','cha'].map(s => `<option value="${s}" ${asi.stat===s?'selected':''}>${{str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma'}[s]} (${c.stats[s]||10} → ${Math.min(20,(c.stats[s]||10)+2)})</option>`).join('')}
        </select>` : `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem">
          <select onchange="levelUpState.choices.asi={mode:'split',stat1:this.value,stat2:levelUpState.choices.asi?.stat2||'dex'}" style="padding:0.4rem;border:1px solid var(--border);background:var(--parchment);border-radius:2px;font-family:var(--font-ui);font-size:0.8rem">
            ${['str','dex','con','int','wis','cha'].map(s => `<option value="${s}" ${(asi.stat1||'str')===s?'selected':''}>${{str:'STR',dex:'DEX',con:'CON',int:'INT',wis:'WIS',cha:'CHA'}[s]} +1</option>`).join('')}
          </select>
          <select onchange="levelUpState.choices.asi={mode:'split',stat1:levelUpState.choices.asi?.stat1||'str',stat2:this.value}" style="padding:0.4rem;border:1px solid var(--border);background:var(--parchment);border-radius:2px;font-family:var(--font-ui);font-size:0.8rem">
            ${['str','dex','con','int','wis','cha'].map(s => `<option value="${s}" ${(asi.stat2||'dex')===s?'selected':''}>${{str:'STR',dex:'DEX',con:'CON',int:'INT',wis:'WIS',cha:'CHA'}[s]} +1</option>`).join('')}
          </select>
        </div>`}
      </div>`;
    }

    if (ch.type === 'cantrip') {
      const picked = choices.cantrips || [];
      choiceHtml += `<div style="padding:0.75rem;background:var(--parchment);border:1px solid var(--gold);border-radius:2px;margin-bottom:0.5rem">
        <div style="font-family:var(--font-ui);font-size:0.8rem;color:var(--gold-text);margin-bottom:0.5rem">${ch.label} <span style="color:var(--text-muted)">(${picked.length}/${ch.count} chosen)</span></div>
        <div style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:0.25rem">
          ${levelUpState.accessibleCantrips.map(sp => `<label style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0.4rem;cursor:pointer;border-radius:2px;font-size:0.85rem;${picked.includes(sp.id)?'background:rgba(201,148,42,0.15)':''}">
            <input type="checkbox" ${picked.includes(sp.id)?'checked':''} ${!picked.includes(sp.id)&&picked.length>=ch.count?'disabled':''} onchange="levelUpToggleSpell('cantrips','${sp.id}',this.checked,${ch.count})" style="accent-color:var(--gold)">
            <span style="font-family:var(--font-ui)">${sp.name}</span>
            <span style="font-size:0.75rem;color:var(--text-muted);margin-left:auto">${sp.school}</span>
          </label>`).join('')}
        </div>
      </div>`;
    }

    if (ch.type === 'spell') {
      const picked = choices.spells || [];
      choiceHtml += `<div style="padding:0.75rem;background:var(--parchment);border:1px solid var(--gold);border-radius:2px;margin-bottom:0.5rem">
        <div style="font-family:var(--font-ui);font-size:0.8rem;color:var(--gold-text);margin-bottom:0.5rem">${ch.label} <span style="color:var(--text-muted)">(${picked.length}/${ch.count} chosen · up to level ${levelUpState.newMaxSlot})</span></div>
        <div style="max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:0.2rem">
          ${levelUpState.accessibleSpells.map(sp => `<label style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0.4rem;cursor:pointer;border-radius:2px;font-size:0.85rem;${picked.includes(sp.id)?'background:rgba(201,148,42,0.15)':''}">
            <input type="checkbox" ${picked.includes(sp.id)?'checked':''} ${!picked.includes(sp.id)&&picked.length>=ch.count?'disabled':''} onchange="levelUpToggleSpell('spells','${sp.id}',this.checked,${ch.count})" style="accent-color:var(--gold)">
            <span style="font-family:var(--font-ui)">${sp.name}</span>
            <span style="font-size:0.72rem;color:var(--text-muted);margin-left:auto">Lv${sp.level} ${sp.school}</span>
          </label>`).join('')}
        </div>
      </div>`;
    }
  });

  modal.innerHTML = `
    <div style="background:var(--parchment);border:2px solid var(--gold);border-radius:2px;max-width:540px;width:100%;padding:1.5rem;box-shadow:0 24px 64px rgba(0,0,0,0.5);max-height:90vh;overflow-y:auto">
      <div style="text-align:center;margin-bottom:1.25rem">
        <div style="font-family:var(--font-display);font-size:0.85rem;color:var(--gold-text);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:0.3rem">Level Up</div>
        <div style="font-family:var(--font-display);font-size:1.5rem;color:var(--text-main)">${esc(c.name)}</div>
        <div style="font-family:var(--font-ui);font-size:0.85rem;color:var(--text-muted);margin-top:0.25rem">${cls?.name||''} · Level ${c.level} → <strong style="color:var(--gold-text)">${newLevel}</strong></div>
      </div>
      ${choiceHtml}
      <div style="display:flex;gap:0.75rem;margin-top:1.25rem">
        <button class="btn-secondary btn-sm" style="flex:1" onclick="document.getElementById('levelup-modal').remove()">Cancel</button>
        <button class="btn-primary btn-gold btn-sm" style="flex:2" onclick="confirmLevelUp()">⬆ Confirm Level Up</button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function levelUpSetASIMode(mode) {
  const c = state.characters.find(x => x.id === levelUpState.charId);
  if (!c) return;
  levelUpState.choices.asi = { mode, stat:'str', stat1:'str', stat2:'dex' };
  const changes = levelUpState.changes;
  renderLevelUpModal(c, changes);
}

function levelUpToggleSpell(key, id, checked, max) {
  if (!levelUpState.choices[key]) levelUpState.choices[key] = [];
  if (checked) {
    if (levelUpState.choices[key].length < max) levelUpState.choices[key].push(id);
  } else {
    levelUpState.choices[key] = levelUpState.choices[key].filter(x => x !== id);
  }
  // Re-render to update disabled states and counts
  const c = state.characters.find(x => x.id === levelUpState.charId);
  if (c) renderLevelUpModal(c, levelUpState.changes);
}

function confirmLevelUp() {
  const c = state.characters.find(x => x.id === levelUpState.charId);
  if (!c) return;
  const choices = levelUpState.choices;
  const cls = CLASSES.find(cl => cl.id === c.class);

  // Apply level and any specialty chosen here
  c.level = levelUpState.newLevel;
  if (choices.subclass) { c.subclass = choices.subclass; delete c.subclassOption; }
  if (choices.subclassOption) c.subclassOption = choices.subclassOption;

  // Apply HP
  c.maxHp += levelUpState.newHp;
  c.currentHp += levelUpState.newHp;

  // Apply ASI
  const conModBefore = Math.floor(((c.stats.con||10)-10)/2);
  if (choices.asi) {
    const asi = choices.asi;
    if (asi.mode === 'double' && asi.stat) {
      c.stats[asi.stat] = Math.min(20, (c.stats[asi.stat]||10) + 2);
    } else if (asi.mode === 'split') {
      if (asi.stat1) c.stats[asi.stat1] = Math.min(20, (c.stats[asi.stat1]||10) + 1);
      if (asi.stat2) c.stats[asi.stat2] = Math.min(20, (c.stats[asi.stat2]||10) + 1);
    }
    // A higher CON modifier adds 1 HP per level, including this one
    const conDiff = Math.floor(((c.stats.con||10)-10)/2) - conModBefore;
    if (conDiff) { c.maxHp += conDiff * c.level; c.currentHp += conDiff * c.level; }
  }

  // Add new spells
  if (choices.cantrips) c.spells.push(...choices.cantrips);
  if (choices.spells) c.spells.push(...choices.spells);

  document.getElementById('levelup-modal').remove();
  save();
  renderCharacters();
  refreshSheets();
  showLimitWarning(`${esc(c.name)} is now Level ${c.level}! 🎉`);
}

