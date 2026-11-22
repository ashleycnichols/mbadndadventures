// ============================================================
// CLASS FEATURES, SPECIALTIES AND COUNTERS
// Rules helpers that read CLASS_FEATURES and SUBCLASS_INFO, plus the
// feature cards and counters shown on the sheet, map and combat view.
// ============================================================

// The character's specialty, once they are high enough level to have one
function activeSub(c) {
  if (!c?.subclass) return null;
  if ((c.level || 1) < (SUBCLASS_LEVEL[c.class] || 3)) return null;
  return SUBCLASS_INFO[c.subclass] || null;
}

// The class as far as spellcasting goes. Eldritch Knights, Arcane Tricksters
// and Profane Souls become casters through their specialty.
function casterClass(c) {
  const cls = CLASSES.find(x => x.id === c?.class);
  if (!cls) return cls;
  const s = activeSub(c);
  if (!cls.spellcaster && s?.caster) {
    const k = s.caster;
    return { ...cls, spellcaster: true, statHp: k.stat, spellSlots: k.slots, spellsKnown: k.known,
      cantripsKnown: k.cantrips, spellList: k.list, pact: !!k.pact, spellbookPerLevel: 0 };
  }
  return { ...cls, pact: cls.id === 'warlock' };
}
function slotsFor(c) { return casterClass(c)?.spellSlots?.[Math.min((c.level || 1) - 1, 19)] || []; }

// ---- Specialty spells ----
function subSpellMap(c) {
  const s = activeSub(c);
  if (!s) return {};
  const m = {};
  Object.entries(s.spells || {}).forEach(([l, ids]) => { m[l] = [...ids]; });
  const ch = s.options?.choices;
  const opt = ch && !Array.isArray(ch) && c.subclassOption ? ch[c.subclassOption] : null;
  if (opt) Object.entries(opt).forEach(([l, ids]) => { m[l] = [...(m[l] || []), ...ids]; });
  return m;
}
function subSpellIds(c, upTo) {
  const lim = upTo ?? c.level;
  return Object.entries(subSpellMap(c)).filter(([l]) => +l <= lim).flatMap(([, ids]) => ids);
}
// Spells the specialty gives for free: always prepared or always known, not counted
function grantedSpells(c) {
  const s = activeSub(c);
  if (!s) return [];
  const ids = [...(s.cantrips || [])];
  if (s.spellMode !== 'expanded') ids.push(...subSpellIds(c));
  return [...new Set(ids)].filter(id => SPELLS.some(x => x.id === id));
}
function allSpellIds(c) { return [...new Set([...(c?.spells || []), ...grantedSpells(c)])]; }
function isGrantedSpell(c, id) { return grantedSpells(c).includes(id); }
function grantedLabel(c) {
  const s = activeSub(c);
  return s?.spellMode === 'known' ? `Always known (${c.subclass})` : `Always prepared (${c.subclass})`;
}

// Can this character pick this spell? Class list, specialty lists, Magical Secrets.
function spellOnList(c, sp) {
  const cc = casterClass(c);
  if (!cc?.spellcaster || !sp) return false;
  if (c.class === 'bard' && c.level >= 10) return true;                      // Magical Secrets
  if (c.subclass === 'College of Lore' && c.level >= 6) return true;          // Additional Magical Secrets
  const s = activeSub(c);
  const lists = [cc.spellList || c.class];
  if (s?.list) lists.push(s.list);
  if (sp.classes.some(x => lists.includes(x))) return true;
  return s?.spellMode === 'expanded' && subSpellIds(c, 20).includes(sp.id);
}
// Highest spell level this character has slots for
function maxSpellLevel(c) { return slotsFor(c).reduce((m, n, i) => n > 0 ? i + 1 : m, 0); }

// ---- Number changes from class features and specialties ----
function subHpPerLevel(c) { return activeSub(c)?.hpPerLevel || 0; }
function subArmorGuess(c, classAC) {
  const s = activeSub(c);
  const dex = abilityMod(c, 'dex');
  let ac = classAC;
  if (s?.acBase) ac = Math.max(ac, s.acBase + dex);                          // Draconic Resilience
  if (s?.armor === 'heavy') ac = Math.max(ac, 16);                           // chain mail
  if (s?.armor === 'medium') ac = Math.max(ac, 14 + Math.min(dex, 2));       // scale mail
  if (c.bladesong && s?.bladesong) ac += Math.max(0, abilityMod(c, 'int'));   // Bladesong
  return ac;
}
function classSpeedBonus(c) {
  const l = c?.level || 1;
  let b = 0;
  if (c?.class === 'barbarian' && l >= 5) b += 10;
  if (c?.class === 'monk' && l >= 2) b += l >= 18 ? 30 : l >= 14 ? 25 : l >= 10 ? 20 : l >= 6 ? 15 : 10;
  if (c?.bladesong && activeSub(c)?.bladesong) b += 10;
  return b;
}
function subInitBonus(c) {
  const s = activeSub(c);
  return s?.init ? abilityMod(c, s.init) : 0;
}
function extraSaveProf(c, ab) {
  const l = c?.level || 1;
  if (c?.class === 'monk' && l >= 14) return true;                 // Diamond Soul
  if (c?.class === 'rogue' && l >= 15 && ab === 'wis') return true; // Slippery Mind
  return (activeSub(c)?.saves || []).some(([lv, a]) => a === ab && l >= lv);
}
function auraBonus(c) { return c?.class === 'paladin' && c.level >= 6 ? Math.max(1, abilityMod(c, 'cha')) : 0; }
function subSkills(c) { return activeSub(c)?.skills || []; }
function canExpertise(c) {
  return (c?.class === 'rogue') || (c?.class === 'bard' && c.level >= 3) || c?.subclass === 'Knowledge Domain';
}
// Half proficiency on checks you aren't proficient in: Jack of All Trades, Remarkable Athlete
function halfProfOn(c, ab) {
  if (c?.class === 'bard' && c.level >= 2) return true;
  if (c?.subclass === 'Champion' && c.level >= 7 && ['str', 'dex', 'con'].includes(ab)) return true;
  return false;
}
function subWeaponProf(c, w) { return activeSub(c)?.weapons === 'martial' && w.weight === 'Martial'; }
function critRange(c) { const s = activeSub(c); return s?.crit ? s.crit(c) : 20; }
const MONK_WEAPONS = ['club', 'dagger', 'handaxe', 'javelin', 'light-hammer', 'mace', 'quarterstaff', 'sickle', 'spear', 'shortsword'];
function isMonkWeapon(c, w) { return c?.class === 'monk' && MONK_WEAPONS.includes(w.id); }
// Disciple of Life: extra healing on healing spells
function healBonusText(c, sp, slotLevel) {
  if (!activeSub(c)?.healBonus || !sp || sp.level < 1) return '';
  const heals = /regain|restore[s]? .*hit points|heal/i.test(sp.desc + ' ' + (sp.detail || '')) && !/damage/i.test(sp.desc);
  return heals ? ` Disciple of Life: add +${2 + slotLevel} to each creature's healing.` : '';
}

// ---- Counters (Ki, Rage, Channel Divinity...) ----
function resMax(c, spec) {
  if (typeof spec === 'function') return spec(c);
  if (spec === 'pb') return proficiencyBonus(c);
  if (['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(spec)) return Math.max(1, abilityMod(c, spec));
  return +spec || 0;
}
function classResources(c) {
  if (!c) return [];
  const L = c.level || 1, r = [];
  const add = (id, name, max, reset, pool) => { if (max > 0) r.push({ id, name, max, reset, pool: !!pool }); };
  const tbl = arr => arr[Math.min(19, L - 1)];
  switch (c.class) {
    case 'barbarian': if (L < 20) add('rage', 'Rage', tbl([2,2,3,3,3,4,4,4,4,4,4,5,5,5,5,5,6,6,6,6]), 'long'); break;
    case 'bard': add('inspiration', 'Bardic Inspiration', Math.max(1, abilityMod(c, 'cha')), L >= 5 ? 'short' : 'long'); break;
    case 'cleric': if (L >= 2) add('channel', 'Channel Divinity', L >= 18 ? 3 : L >= 6 ? 2 : 1, 'short'); break;
    case 'druid': if (L >= 2 && L < 20) add('wild-shape', 'Wild Shape', 2, 'short'); break;
    case 'fighter':
      add('second-wind', 'Second Wind', 1, 'short');
      if (L >= 2) add('action-surge', 'Action Surge', L >= 17 ? 2 : 1, 'short');
      if (L >= 9) add('indomitable', 'Indomitable', L >= 17 ? 3 : L >= 13 ? 2 : 1, 'long');
      break;
    case 'monk': if (L >= 2) add('ki', 'Ki Points', L, 'short'); break;
    case 'paladin':
      add('divine-sense', 'Divine Sense', 1 + Math.max(0, abilityMod(c, 'cha')), 'long');
      add('lay-on-hands', 'Lay on Hands (HP)', 5 * L, 'long', true);
      if (L >= 3) add('channel', 'Channel Divinity', 1, 'short');
      if (L >= 14) add('cleansing', 'Cleansing Touch', Math.max(1, abilityMod(c, 'cha')), 'long');
      break;
    case 'rogue': if (L >= 20) add('stroke', 'Stroke of Luck', 1, 'short'); break;
    case 'sorcerer': if (L >= 2) add('sorcery', 'Sorcery Points', L, 'long'); break;
    case 'warlock':
      [[11, 6], [13, 7], [15, 8], [17, 9]].forEach(([lv, sl]) => { if (L >= lv) add('arcanum-' + sl, `Mystic Arcanum (${sl}th)`, 1, 'long'); });
      if (L >= 20) add('eldritch-master', 'Eldritch Master', 1, 'long');
      break;
    case 'wizard': add('arcane-recovery', 'Arcane Recovery', 1, 'long'); break;
    case 'artificer': if (L >= 7) add('flash', 'Flash of Genius', Math.max(1, abilityMod(c, 'int')), 'long'); break;
    case 'blood-hunter': add('maledict', 'Blood Maledict', (L >= 17 ? 4 : L >= 13 ? 3 : L >= 6 ? 2 : 1) + (c.subclass === 'Order of the Ghostslayer' && L >= 3 ? 1 : 0), 'short'); break;
  }
  const s = activeSub(c);
  (s?.res || []).forEach(([lv, id, name, spec, reset, pool]) => { if (L >= lv) add('sub-' + id, name, resMax(c, spec), reset, pool); });
  return r;
}
function resLeft(c, r) { return Math.max(0, r.max - Math.min(r.max, c.resUsed?.[r.id] || 0)); }
function setResLeft(charId, resId, left) {
  const c = state.characters.find(x => x.id === charId);
  const r = c && classResources(c).find(x => x.id === resId);
  if (!r) return;
  c.resUsed = c.resUsed || {};
  c.resUsed[resId] = Math.max(0, Math.min(r.max, r.max - left));
  if (!c.resUsed[resId]) delete c.resUsed[resId];
  save(); refreshSheets();
}
function spendRes(charId, resId, n) {
  const c = state.characters.find(x => x.id === charId);
  const r = c && classResources(c).find(x => x.id === resId);
  if (!r) return;
  setResLeft(charId, resId, resLeft(c, r) - n);
}
// Rests refill counters: short rests refill 'short' ones, long rests refill everything
function refillResources(c, kind) {
  if (!c.resUsed) return;
  if (kind === 'long') { c.resUsed = {}; return; }
  classResources(c).filter(r => r.reset === 'short').forEach(r => { delete c.resUsed[r.id]; });
}
function toggleBladesong(charId) {
  const c = state.characters.find(x => x.id === charId);
  if (!c) return;
  if (!c.bladesong) {
    const r = classResources(c).find(x => x.id === 'sub-bladesong');
    if (r && resLeft(c, r) <= 0) { showLimitWarning('No Bladesong uses left. A long rest restores them.'); return; }
    if (r) { c.resUsed = c.resUsed || {}; c.resUsed[r.id] = (c.resUsed[r.id] || 0) + 1; }
    c.bladesong = true;
    showLimitWarning(`Bladesong! +${Math.max(0, abilityMod(c, 'int'))} AC and +10 ft speed for 1 minute.`);
  } else {
    c.bladesong = false;
  }
  save(); refreshSheets();
}

function resourcesHTML(c, compact) {
  const list = classResources(c);
  const s = activeSub(c);
  if (!list.length && !s?.bladesong) return '';
  const pip = compact ? 14 : 20;
  const rows = list.map(r => {
    const left = resLeft(c, r);
    const usePips = !r.pool && r.max <= 10;
    const control = usePips
      ? `<div style="display:flex;gap:${compact ? '0.2rem' : '0.3rem'};flex-wrap:wrap">${Array.from({ length: r.max }, (_, j) =>
          `<button onclick="setResLeft('${c.id}','${r.id}',${j < left ? j : j + 1})" title="${j < left ? 'Use one' : 'Get one back'}" style="width:${pip}px;height:${pip}px;border-radius:50%;border:2px solid var(--gold);background:${j < left ? 'var(--gold)' : 'transparent'};cursor:pointer;padding:0"></button>`).join('')}</div>`
      : `<div style="display:flex;align-items:center;gap:0.3rem">
          <button onclick="spendRes('${c.id}','${r.id}',1)" ${left ? '' : 'disabled'} style="border:1px solid var(--gold);background:none;color:var(--gold-text);border-radius:2px;padding:0 0.45rem;cursor:pointer;font-family:var(--font-ui)">−</button>
          ${r.max >= 20 ? `<button onclick="spendRes('${c.id}','${r.id}',5)" ${left >= 5 ? '' : 'disabled'} style="border:1px solid var(--gold);background:none;color:var(--gold-text);border-radius:2px;padding:0 0.3rem;cursor:pointer;font-family:var(--font-ui);font-size:0.75rem">−5</button>` : ''}
          <strong style="font-family:var(--font-ui);font-variant-numeric:lining-nums;color:var(--gold-text);min-width:2.2em;text-align:center">${left}</strong><span style="font-size:0.75rem;color:var(--text-muted)">/ ${r.max}</span>
          <button onclick="spendRes('${c.id}','${r.id}',-1)" ${left < r.max ? '' : 'disabled'} style="border:1px solid var(--border);background:none;color:var(--text-muted);border-radius:2px;padding:0 0.45rem;cursor:pointer;font-family:var(--font-ui)">+</button>
        </div>`;
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;padding:${compact ? '0.2rem' : '0.3rem'} 0;flex-wrap:wrap">
      <span style="font-family:var(--font-ui);font-size:${compact ? '0.72rem' : '0.85rem'}">${r.name} <span style="font-size:0.7rem;color:var(--text-muted)" title="Refills on a ${r.reset} rest">${r.reset === 'short' ? '☕' : '🌙'}</span></span>
      ${control}
    </div>`;
  }).join('');
  const blade = s?.bladesong ? `<button onclick="toggleBladesong('${c.id}')" style="margin-top:0.35rem;width:100%;padding:0.3rem;border:1px solid var(--gold);border-radius:2px;cursor:pointer;font-family:var(--font-ui);font-size:${compact ? '0.72rem' : '0.8rem'};background:${c.bladesong ? 'var(--gold)' : 'none'};color:${c.bladesong ? 'var(--parchment)' : 'var(--gold-text)'}">${c.bladesong ? '⚔ Bladesong active (tap to end)' : '⚔ Start Bladesong'}</button>` : '';
  if (compact) return rows + blade;
  return `<div style="background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:1rem">
    <div style="font-family:var(--font-ui);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:0.3rem">Class Resources <span style="text-transform:none;letter-spacing:0;font-style:italic">· ☕ refills on a short rest, 🌙 on a long rest</span></div>
    ${rows}${blade}
  </div>`;
}
// One-line summary for the DM's combat table
function resourcesText(c) {
  return classResources(c).map(r => `${r.name.replace(/ \(.*\)$/, '')} ${resLeft(c, r)}/${r.max}`).join(' · ');
}

// ---- Feature cards ----
function featureText(c, t) { return typeof t === 'function' ? t(c) : t; }
// Features gained up to a level; from = only from that level on (for level-up)
function featureList(c, upTo, from) {
  const hi = upTo ?? c.level, lo = from ?? 1;
  const out = [];
  (CLASS_FEATURES[c.class] || []).forEach(([lvl, name, text, tag]) => {
    if (lvl >= lo && lvl <= hi) out.push({ lvl, name, text: featureText(c, text), tag, src: CLASSES.find(x => x.id === c.class)?.name });
  });
  const s = activeSub(c);
  (s?.features || []).forEach(([lvl, name, text, tag]) => {
    if (lvl >= lo && lvl <= hi) out.push({ lvl, name, text: featureText(c, text), tag, src: c.subclass });
  });
  return out.sort((a, b) => a.lvl - b.lvl);
}
function featureTagHTML(tag) {
  if (!tag) return '';
  if (tag.startsWith('auto:')) return `<span style="color:var(--green-health);font-size:0.75rem;white-space:nowrap" title="Already in the sheet's numbers">✓ Included in ${tag.slice(5)}</span>`;
  if (tag === 'res') return `<span style="color:var(--gold-text);font-size:0.75rem;white-space:nowrap" title="Use the counter under Class Resources">◉ Counter on sheet</span>`;
  return '';
}
function featuresBlock(c) {
  const list = featureList(c);
  if (!list.length) return '';
  const needSub = SUBCLASSES[c.class] && !c.subclass && c.level >= (SUBCLASS_LEVEL[c.class] || 3);
  return `<div style="background:var(--parchment-dark);border:1px solid var(--border);border-radius:2px;padding:1rem">
    <div style="font-family:var(--font-ui);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:0.4rem">Class Features${c.subclass ? ' · ' + esc(c.subclass) : ''}</div>
    <div style="font-size:0.82rem;color:var(--text-muted);font-style:italic;margin-bottom:0.5rem">Tap a feature to read it.
      <span style="color:var(--green-health);font-style:normal">✓ Included</span> means the sheet already counts it.
      <span style="color:var(--gold-text);font-style:normal">◉ Counter</span> means it has a tracker under Class Resources.</div>
    ${needSub ? `<div style="font-size:0.85rem;color:var(--amber);margin-bottom:0.5rem">Choose your ${SUBCLASS_LABEL[c.class] || 'specialty'} at the top of the sheet to see its features.</div>` : ''}
    ${list.map(f => `<details class="feat" style="border-bottom:1px solid var(--border);padding:0.3rem 0">
      <summary style="cursor:pointer;display:flex;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;align-items:baseline;list-style:none">
        <span><strong style="font-size:0.92rem">${esc(f.name)}</strong> <span style="font-size:0.72rem;color:var(--text-muted)">Lv ${f.lvl}${f.src !== CLASSES.find(x => x.id === c.class)?.name ? ' · ' + esc(f.src) : ''}</span></span>
        ${featureTagHTML(f.tag)}
      </summary>
      <div style="font-size:0.88rem;color:var(--text-muted);line-height:1.45;padding:0.3rem 0 0.2rem">${esc(f.text)}</div>
    </details>`).join('')}
  </div>`;
}

// ---- Choosing a specialty ----
function setSubclass(charId, value) {
  const c = state.characters.find(x => x.id === charId);
  if (!c || c.subclass === value) return;
  const hpBefore = subHpPerLevel(c);
  c.subclass = value;
  delete c.subclassOption;
  c.bladesong = false;
  const diff = (subHpPerLevel(c) - hpBefore) * c.level;   // Draconic Resilience
  if (diff) { c.maxHp = Math.max(1, c.maxHp + diff); c.currentHp = Math.max(0, Math.min(c.maxHp, c.currentHp + diff)); }
  save(); refreshSheets();
}
function setSubclassOption(charId, value) {
  const c = state.characters.find(x => x.id === charId);
  if (!c) return;
  if (value) c.subclassOption = value; else delete c.subclassOption;
  save(); refreshSheets();
}
function subOptionNames(sub) {
  const ch = SUBCLASS_INFO[sub]?.options?.choices;
  return !ch ? [] : Array.isArray(ch) ? ch : Object.keys(ch);
}
function subclassPickerHTML(c) {
  if (!SUBCLASSES[c.class] || c.level < (SUBCLASS_LEVEL[c.class] || 3)) return '';
  const sel = 'padding:0.25rem 0.4rem;border:1px solid var(--border);background:var(--parchment);border-radius:2px;font-family:var(--font-ui);font-size:0.75rem;color:var(--text-main);max-width:100%';
  const opts = c.subclass ? subOptionNames(c.subclass) : [];
  const optLabel = SUBCLASS_INFO[c.subclass]?.options?.label;
  return `<div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.35rem;flex-wrap:wrap">
    <span style="font-family:var(--font-ui);font-size:0.7rem;color:var(--gold-text);text-transform:uppercase;letter-spacing:0.05em">${SUBCLASS_LABEL[c.class] || 'Specialty'}:</span>
    <select onchange="setSubclass('${c.id}', this.value)" style="${sel};border-color:${c.subclass ? 'var(--border)' : 'var(--gold)'}">
      <option value="" ${!c.subclass ? 'selected' : ''}>Choose…</option>
      ${SUBCLASSES[c.class].map(sc => `<option value="${sc}" ${c.subclass === sc ? 'selected' : ''}>${sc}</option>`).join('')}
    </select>
    ${opts.length ? `<select onchange="setSubclassOption('${c.id}', this.value)" title="${optLabel}" style="${sel};border-color:${c.subclassOption ? 'var(--border)' : 'var(--gold)'}">
      <option value="">${optLabel}…</option>
      ${opts.map(o => `<option value="${o}" ${c.subclassOption === o ? 'selected' : ''}>${o}</option>`).join('')}
    </select>` : ''}
  </div>`;
}
