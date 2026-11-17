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
    const hpColor = hpPct > 60 ? '#2d6a2d' : hpPct > 25 ? '#8b6914' : '#8b1a1a';
    const cardClick = isDM ? `editCharacter('${c.id}')` : `showPanel('sheet',document.getElementById('sheet-tab'))`;
    html += `<div class="character-card" style="position:relative" onclick="${cardClick}">
      ${isDM ? `<button onclick="event.stopPropagation();confirmDeleteChar('${c.id}')" style="position:absolute;top:0.5rem;right:0.5rem;background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.1rem;line-height:1;padding:0.2rem 0.4rem;border-radius:2px;transition:color 0.15s" onmouseover="this.style.color='var(--blood)'" onmouseout="this.style.color='var(--text-muted)'" title="Delete character">\u2715</button>` : ''}
      <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.3rem">
        ${c.portrait ? `<img src="${c.portrait}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid var(--gold);flex-shrink:0">` : `<div style="width:36px;height:36px;border-radius:50%;background:var(--parchment-dark);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">🧙</div>`}
        <div style="min-width:0">
          <div class="char-name" style="padding-right:${isDM ? '1.5rem' : '0'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name || 'Unnamed'}</div>
          <div class="char-meta">${c.player || ''} \u00b7 ${getRace(c.race)} ${getClass(c.class)} ${c.level}</div>
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
    <div style="font-family:'Cinzel Decorative',serif;font-size:1rem;color:var(--blood);margin-bottom:0.75rem">Delete Character?</div>
    <div style="font-family:'Cinzel',serif;font-size:1.1rem;color:var(--text-main);margin-bottom:0.5rem">${esc(c.name) || 'Unnamed'}</div>
    <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1.25rem">${getRace(c.race)} ${getClass(c.class)} · Level ${c.level}<br><em>This cannot be undone.</em></div>
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
  localStorage.setItem('chronicler_v2', JSON.stringify(buildSaveData()));
  document.getElementById('delete-confirm-overlay')?.remove();
  renderCharacters();
  // Suppress incoming updates for 3s so the deletion sticks
  _suppressRemoteUntil = Date.now() + 3000;
  if (state.syncEnabled && state.campaignId && window.fbDeleteCharacter) {
    clearTimeout(_saveDebounce);
    window.fbDeleteCharacter(state.campaignId, id).then(() => {
      _suppressRemoteUntil = Date.now() + 500;
    });
  }
}

function getRace(id) { return RACES.find(r => r.id === id)?.name || id || '?'; }

function calcAC(ch) {
  if (!ch?.stats) return 10;
  const dexMod = Math.floor(((ch.stats.dex || 10) - 10) / 2);
  const conMod = Math.floor(((ch.stats.con || 10) - 10) / 2);
  const wisMod = Math.floor(((ch.stats.wis || 10) - 10) / 2);
  if (ch.race === 'tortle') return 17;
  if (ch.class === 'barbarian') return 10 + dexMod + conMod;
  if (ch.class === 'monk') return 10 + dexMod + wisMod;
  if (['fighter','paladin'].includes(ch.class)) return Math.max(16, 10 + dexMod);
  return 10 + dexMod;
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
      // Sync into token library
      const libKey = 'char_portrait_' + charId;
      const existing = state.tokenLibrary.find(l => l.id === libKey);
      if (existing) { existing.img = portrait; existing.name = ch.name; }
      else { state.tokenLibrary.push({ id: libKey, name: ch.name, img: portrait, charId }); }
      // Auto-place or update token on active map
      const active = state.maps.find(m => m.id === state.activeMapId);
      if (active) {
        const existing = mapState.tokens.find(t => t.charId === charId);
        if (existing) {
          existing.img = portrait;
          active.tokens = mapState.tokens;
        } else {
          const tok = { id: 'tok_' + Date.now(), name: ch.name, type: 'player', charId,
            x: 0.5, y: 0.5,
            img: portrait, hidden: false };
          mapState.tokens.push(tok);
          active.tokens = mapState.tokens;
        }
      }
      save();
      renderMySheet();
      renderTokenLibrary();
      redrawMap();
    });
  };
  reader.readAsDataURL(file);
}
function getClass(id) { return CLASSES.find(c => c.id === id)?.name || id || '?'; }

