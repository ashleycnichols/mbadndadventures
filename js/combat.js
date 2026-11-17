// ============================================================
// QUICK VIEW, COMBAT VIEW, CONCENTRATION, DM NOTES
// ============================================================

// ---- Quick View (players in Roll20 campaigns): compact sheet to keep beside Roll20 ----
function renderQuickView() {
  const container = document.getElementById('quick-content');
  if (!container) return;
  const c = myActiveChar();
  if (!c) {
    container.innerHTML = `<div class="empty-state"><p>No character for <strong>${esc(state.currentUser?.name)}</strong> yet.</p>
      <p style="margin-top:1rem"><button class="btn-primary btn-gold" style="width:auto;padding:0.7rem 1.5rem" onclick="openCreator()">Create Your Character</button></p></div>`;
    return;
  }
  const mine = myCharacters();
  const picker = mine.length > 1 ? `<select onchange="setActiveChar(this.value)" style="width:100%;margin-bottom:0.5rem;padding:0.3rem;border:1px solid var(--border);background:var(--parchment);border-radius:2px;font-family:'Cinzel',serif">
      ${mine.map(ch => `<option value="${ch.id}" ${ch.id === c.id ? 'selected' : ''}>${esc(ch.name) || 'Unnamed'}</option>`).join('')}</select>` : '';
  container.innerHTML = picker + `<div style="background:var(--parchment);border:1px solid var(--border);border-radius:2px">${compactSheetHTML(c, 'quick')}</div>
    <div style="font-size:0.72rem;color:var(--text-muted);font-style:italic;text-align:center;margin-top:0.5rem">Tip: open this in a narrow window beside Roll20. Full details are on My Sheet.</div>`;
}

// ---- Concentration ----
function concentrationSpells(c) {
  return (c.spells || []).map(id => SPELLS.find(s => s.id === id))
    .filter(sp => sp && /concentration/i.test(sp.duration || ''));
}

function setConcentration(id, spellId) {
  const c = state.characters.find(x => x.id === id);
  if (!c) return;
  if (spellId) c.concentration = spellId; else delete c.concentration;
  save(); refreshSheets();
}

function concentrationName(c) {
  if (!c.concentration) return '';
  return SPELLS.find(s => s.id === c.concentration)?.name || c.concentration;
}

// A small "Concentrating on" control for the sheet and the compact view
function concentrationControl(c) {
  const options = concentrationSpells(c);
  if (!options.length && !c.concentration) return '';
  return `<div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.4rem;flex-wrap:wrap">
    <span style="font-family:'Cinzel',serif;font-size:0.65rem;text-transform:uppercase;letter-spacing:0.06em;color:${c.concentration ? '#4a7ca5' : 'var(--text-muted)'}">Concentrating</span>
    <select onchange="setConcentration('${c.id}', this.value)" style="flex:1;min-width:120px;font-size:0.78rem;padding:0.2rem;border:1px solid ${c.concentration ? '#4a7ca5' : 'var(--border)'};background:var(--parchment);border-radius:2px;font-family:'Cinzel',serif">
      <option value="">Nothing</option>
      ${options.map(sp => `<option value="${sp.id}" ${c.concentration === sp.id ? 'selected' : ''}>${esc(sp.name)}</option>`).join('')}
    </select>
  </div>`;
}

// ---- Combat view (DM): everyone at a glance ----
const CONDITION_LIST = ['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious'];

function renderCombatView() {
  const container = document.getElementById('combat-content');
  if (!container || !state.currentUser?.isDM) return;
  const chars = [...state.characters].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  if (!chars.length) { container.innerHTML = '<div class="empty-state"><p>No characters in this campaign yet.</p></div>'; return; }

  const th = 'text-align:left;padding:0.4rem 0.5rem;font-family:\'Cinzel\',serif;font-size:0.65rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);border-bottom:2px solid var(--gold);white-space:nowrap';
  const td = 'padding:0.5rem;border-bottom:1px solid var(--border);vertical-align:top';
  const rows = chars.map(c => {
    normalizeChar(c);
    const cls = CLASSES.find(cl => cl.id === c.class);
    const hpPct = Math.max(0, Math.round(c.currentHp / c.maxHp * 100));
    const hpColor = hpPct > 60 ? 'var(--green-health)' : hpPct > 25 ? '#8b6914' : 'var(--blood)';
    const down = c.currentHp <= 0;
    const note = state.dmNotes?.[c.id] || '';
    const chips = [
      ...c.conditions.map(cond => `<span onclick="removeCondition('${c.id}','${cond}')" title="Click to remove" style="cursor:pointer;font-size:0.7rem;background:rgba(139,26,26,0.12);border:1px solid var(--blood);color:var(--blood);padding:0.05rem 0.35rem;border-radius:2px;white-space:nowrap">${cond} ✕</span>`),
      c.exhaustion ? `<span style="font-size:0.7rem;border:1px solid var(--blood);color:var(--blood);padding:0.05rem 0.35rem;border-radius:2px">Exhaustion ${c.exhaustion}</span>` : '',
    ].join(' ');
    return `<tr>
      <td style="${td}">
        <div style="font-family:'Cinzel',serif;font-weight:600;cursor:pointer" onclick="showPanel('party');openDMSheet('${c.id}')" title="Open full sheet">${esc(c.name) || 'Unnamed'}${c.inspiration ? ' ⭐' : ''}</div>
        <div style="font-size:0.72rem;color:var(--text-muted)">${esc(cls?.name || '')} ${c.level}${c.player ? ' · ' + esc(c.player) : ''}</div>
      </td>
      <td style="${td};min-width:170px">
        <div style="font-family:'Cinzel',serif"><strong style="color:${hpColor};font-size:1.05rem">${c.currentHp}</strong> / ${c.maxHp}${c.tempHp > 0 ? ` <span style="color:#4a7ca5;font-size:0.8rem">+${c.tempHp}</span>` : ''}</div>
        <div style="height:4px;background:var(--parchment-dark);border-radius:2px;margin:0.2rem 0 0.35rem;overflow:hidden"><div style="height:100%;width:${hpPct}%;background:${hpColor}"></div></div>
        ${down ? `<div style="font-size:0.72rem;color:var(--blood);margin-bottom:0.3rem">Down · saves ✓${c.deathSaves.success} ✗${c.deathSaves.fail}</div>` : ''}
        <div style="display:flex;gap:0.25rem">
          <input id="combat-hp-${c.id}" type="number" min="1" placeholder="amt" style="width:48px;border:1px solid var(--border);background:var(--parchment);border-radius:2px;padding:0.2rem;font-size:0.8rem;text-align:center">
          <button onclick="sheetAdjustHP('${c.id}',-1,'combat-hp-${c.id}')" style="padding:0.15rem 0.4rem;border:1px solid var(--blood);color:var(--blood);background:none;border-radius:2px;cursor:pointer;font-size:0.72rem">− Dmg</button>
          <button onclick="sheetAdjustHP('${c.id}',1,'combat-hp-${c.id}')" style="padding:0.15rem 0.4rem;border:1px solid var(--green-health);color:var(--green-health);background:none;border-radius:2px;cursor:pointer;font-size:0.72rem">+ Heal</button>
        </div>
      </td>
      <td style="${td};font-family:'Cinzel',serif;font-size:1.05rem;color:var(--gold);text-align:center">${calcAC(c)}</td>
      <td style="${td};text-align:center">${fmtMod(abilityMod(c, 'dex'))}</td>
      <td style="${td};text-align:center">${passivePerception(c)}</td>
      <td style="${td};text-align:center">${cls?.spellcaster ? 8 + proficiencyBonus(c) + spellcastingMod(c) : '—'}</td>
      <td style="${td};min-width:150px">
        <div style="display:flex;flex-wrap:wrap;gap:0.2rem;margin-bottom:0.25rem">${chips}</div>
        <select onchange="addCondition('${c.id}',this)" style="font-size:0.72rem;padding:0.1rem;border:1px solid var(--border);background:var(--parchment);border-radius:2px">
          <option value="">+ condition</option>${CONDITION_LIST.filter(x => !c.conditions.includes(x)).map(x => `<option>${x}</option>`).join('')}
        </select>
      </td>
      <td style="${td};font-size:0.8rem">${c.concentration
        ? `<span style="color:#4a7ca5">${esc(concentrationName(c))}</span> <button onclick="setConcentration('${c.id}','')" title="End concentration" style="border:none;background:none;cursor:pointer;color:var(--text-muted)">✕</button>`
        : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td style="${td};font-size:0.75rem;color:var(--text-muted);max-width:180px;cursor:pointer" onclick="showPanel('party');openDMSheet('${c.id}')" title="${note ? 'Open to read or edit' : 'Open to add a note'}">${note ? esc(note.length > 80 ? note.slice(0, 80) + '…' : note) : '<span style="opacity:0.6">+ note</span>'}</td>
    </tr>`;
  }).join('');

  container.innerHTML = `<div style="max-width:1200px;margin:0 auto;padding:1rem">
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem">
      <div style="font-family:'Cinzel Decorative',serif;font-size:1.1rem;color:var(--gold)">Combat View</div>
      <div style="font-size:0.75rem;color:var(--text-muted);font-style:italic">Changes here reach players' screens straight away. Click a name for the full sheet.</div>
    </div>
    <div style="overflow-x:auto;background:var(--parchment);border:1px solid var(--border);border-radius:2px">
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
        <thead><tr>
          <th style="${th}">Character</th><th style="${th}">HP</th><th style="${th}">AC</th><th style="${th}">Init</th>
          <th style="${th}">Passive Perc.</th><th style="${th}">Spell DC</th><th style="${th}">Conditions</th>
          <th style="${th}">Concentrating</th><th style="${th}">DM notes</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

// ---- DM-only notes: stored apart from characters and loaded only on DM screens ----
let _dmNotesOff = null;
function listenDMNotes(campaignId) {
  if (_dmNotesOff) _dmNotesOff();
  if (!window.fbOn) return;
  _dmNotesOff = window.fbOn('campaigns/' + campaignId + '/dmNotes', v => {
    state.dmNotes = v || {};
    refreshSheets({ skipIfTyping: true });
  });
}

function saveDMNote(charId, text) {
  if (!state.currentUser?.isDM) return;
  state.dmNotes = state.dmNotes || {};
  const clean = (text || '').trim();
  if ((state.dmNotes[charId] || '') === clean) return;
  if (clean) state.dmNotes[charId] = clean; else delete state.dmNotes[charId];
  if (state.syncEnabled && window.fbSet) window.fbSet('campaigns/' + state.campaignId + '/dmNotes/' + charId, clean || null);
  const status = document.getElementById('dm-note-status-' + charId);
  if (status) { status.textContent = '✓ Saved'; setTimeout(() => { status.textContent = ''; }, 2000); }
}

function dmNoteBlock(c) {
  const note = state.dmNotes?.[c.id] || '';
  return `<div style="max-width:900px;margin:0 auto;padding:0 1rem">
    <div style="background:rgba(201,148,42,0.08);border:1px dashed var(--gold);border-radius:2px;padding:0.75rem">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.3rem">
        <span style="font-family:'Cinzel',serif;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gold)">DM notes · only DM screens load these</span>
        <span id="dm-note-status-${c.id}" style="font-size:0.72rem;color:var(--green-health);font-style:italic"></span>
      </div>
      <textarea id="dm-note-${c.id}" rows="3" placeholder="Secrets, hooks, reminders about this character…" onblur="saveDMNote('${c.id}', this.value)" style="width:100%;background:rgba(255,255,255,0.5);border:1px solid var(--parchment-deeper);border-radius:2px;padding:0.5rem;font-family:'Crimson Pro',serif;font-size:0.9rem;resize:vertical">${esc(note)}</textarea>
    </div>
  </div>`;
}
