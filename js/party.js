// ============================================================
// DM PARTY VIEW
// ============================================================
function renderPartyPanel() {
  state.dmPartyCharId = null;
  const container = document.getElementById('party-content');
  if (!container) return;
  if (!state.characters.length) {
    container.innerHTML = '<div class="empty-state"><p>No characters in the party yet.</p></div>';
    return;
  }

  let html = '<div style="max-width:1000px;margin:0 auto;padding:1rem">';
  html += `<div style="font-family:var(--font-display);font-size:1.1rem;color:var(--gold-text);margin-bottom:1rem">Party Overview</div>`;
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem">';

  state.characters.forEach(ch => {
    normalizeChar(ch);

    const cls = casterClass(ch);
    const race = RACES.find(r => r.id === ch.race);
    const profBonus = Math.ceil(ch.level / 4) + 1;
    const getMod = s => Math.floor(((ch.stats[s]||10) - 10) / 2);
    const hpPct = Math.max(0, Math.round(ch.currentHp / ch.maxHp * 100));
    const hpColor = hpPct > 60 ? 'var(--green-health)' : hpPct > 25 ? 'var(--amber)' : 'var(--blood)';
    const initMod = initiativeBonus(ch);
    const passivePerc = passivePerception(ch);
    const spellMod = spellcastingMod(ch);
    const spellDC = 8 + profBonus + spellMod;
    const chAC = calcAC(ch);

    // Spell slots summary
    const lvlIdx = Math.min(ch.level - 1, 19);
    const slotCounts = cls?.spellSlots?.[lvlIdx] || [];
    let slotSummary = '';
    if (slotCounts.length) {
      slotSummary = slotCounts.map((total, i) => {
        if (!total) return '';
        const used = (ch.usedSlots[i+1] || 0);
        const avail = total - used;
        return `<span style="font-size:0.72rem;color:${avail>0?'var(--gold)':'var(--text-muted)'}">L${i+1}:${avail}/${total}</span>`;
      }).filter(Boolean).join(' ');
    }

    const conditionBadges = ch.conditions.length
      ? ch.conditions.map(cond => `<span style="font-size:0.72rem;background:rgba(139,26,26,0.15);border:1px solid var(--blood);color:var(--blood);padding:0.1rem 0.35rem;border-radius:2px">${cond}</span>`).join('')
      : '';

    html += `<div onclick="openDMSheet('${ch.id}')" style="background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:1rem;cursor:pointer;transition:border-color 0.15s" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border)'">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:0.5rem">
        <div>
          <div style="font-family:var(--font-heading);font-size:1rem;color:var(--text-main);font-weight:600">${esc(ch.name)}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:0.1rem">${esc(race?.name||'')} ${esc(cls?.name||'')} · Lvl ${ch.level}${ch.player ? ' · '+esc(ch.player) : ''}</div>
        </div>
        ${ch.inspiration ? '<span title="Inspiration" style="font-size:1.2rem">⭐</span>' : ''}
      </div>
      <!-- HP bar -->
      <div style="height:6px;background:var(--parchment);border-radius:3px;margin-bottom:0.3rem;overflow:hidden">
        <div style="height:100%;width:${hpPct}%;background:${hpColor};transition:width 0.3s"></div>
      </div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.6rem">HP: <strong style="color:${hpColor}">${ch.currentHp}</strong> / ${ch.maxHp}${ch.tempHp>0 ? ' <span style="color:#4a7fb5">+'+ch.tempHp+' temp</span>' : ''}</div>
      <!-- Quick stats -->
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem">
        ${[['AC',chAC],['Init',(initMod>=0?'+':'')+initMod],['Perc.',passivePerc],['Prof.','+'+profBonus],cls?.spellcaster?['DC',spellDC]:null].filter(Boolean).map(([l,v])=>`<div style="text-align:center;background:var(--parchment);border:1px solid var(--border);border-radius:2px;padding:0.2rem 0.4rem;min-width:36px"><div style="font-size:0.85rem;font-family:var(--font-ui);color:var(--gold-text)">${v}</div><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div></div>`).join('')}
      </div>
      ${slotSummary ? `<div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.4rem">${slotSummary}</div>` : ''}
      ${conditionBadges ? `<div style="display:flex;gap:0.25rem;flex-wrap:wrap">${conditionBadges}</div>` : ''}
      <div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.5rem;font-style:italic">Click to view full sheet →</div>
    </div>`;
  });

  html += '</div></div>';
  container.innerHTML = html;
}

function openDMSheet(charId) {
  state.dmPartyCharId = charId;
  renderDMSheet(charId);
}

function renderDMSheet(charId) {
  const c = state.characters.find(ch => ch.id === charId);
  const container = document.getElementById('party-content');
  if (!container) return;
  if (!c) { backToPartyOverview(); return; } // deleted while open

  const backBtn = `<div style="max-width:900px;margin:0 auto;padding:1rem 1rem 0">
    <button class="btn-secondary btn-sm" onclick="backToPartyOverview()" style="margin-bottom:0.75rem">← Back to Party</button>
  </div>`;
  container.innerHTML = backBtn + dmNoteBlock(c) + renderSheet(c);
}

function backToPartyOverview() {
  state.dmPartyCharId = null;
  renderPartyPanel();
}

