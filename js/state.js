// ============================================================
// STATE
// ============================================================
let state = {
  currentUser: null, // {name, isDM}
  characters: [],
  mapImg: null,
  gridSize: 50,
  showGrid: true,
  maps: [], // [{id, name, img, tokens}]
  activeMapId: null,
  tokenLibrary: [], // [{id, name, img}] — reusable token images
  campaignId: null,
  syncEnabled: false,
  dmPartyCharId: null, // which char the DM is viewing in party panel
  dmNotes: {},         // DM-only notes by character id (DM screens only)
};

let creatorState = {
  step: 0,
  editingId: null,
  draft: {
    name:'', player:'', race:null, class:null, background:null,
    level:1, stats:{str:10,dex:10,con:10,int:10,wis:10,cha:10},
    spells:[], weapons:[], backstory:'', notes:'',
    maxHp:10, currentHp:10, spellSlots:{}
  }
};

let mapState = {
  tokens: [], // {id, name, type, x, y, img, charId, hidden}
  dragging: null,
  offsetX:0, offsetY:0,
  scale: 1,
};

const CREATOR_STEPS = ['Identity','Race','Class','Background','Stats','Spells & Weapons','Finish'];

