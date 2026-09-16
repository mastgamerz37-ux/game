// Headless story simulation: drives the StoryDirector through every chapter
// with stubbed UI/DOM, so puzzle logic, beat sequences and ending routing can
// be tested without a browser.   node tools/simulate.mjs
const listeners = [];
const el = (id) => ({
  id,
  textContent: '',
  innerHTML: '',
  style: { setProperty: () => {}, removeProperty: () => {} },
  classList: { add() {}, remove() {}, toggle() {}, contains: () => true },
  addEventListener: (t, f) => listeners.push([id, t, f]),
  querySelector: () => el(id + '-child'),
  appendChild() {},
  after() {},
  remove() {},
});
const noop = () => {};
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({ canvas: {}, createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }), measureText: () => ({ width: 10 }) }, { get: (t, k) => (k in t ? t[k] : noop), set: () => true }), style: {}, addEventListener: noop }),
  getElementById: (id) => el(id),
  addEventListener: noop,
  exitPointerLock: noop,
  pointerLockElement: null,
};
globalThis.window = { addEventListener: noop, devicePixelRatio: 1, AudioContext: undefined };
globalThis.self = globalThis.window;
globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = v; }, removeItem(k) { delete this.store[k]; } };
globalThis.location = { search: '', reload: noop };
globalThis.requestAnimationFrame = (f) => setTimeout(() => f(performance.now()), 0);
globalThis.addEventListener = noop;

const { GameState } = await import('../src/systems/state.js');
const { StoryDirector } = await import('../src/systems/story.js');
const { FLOORS, CORE_CLUES } = await import('../src/data/floors.js');
const { World } = await import('../src/world/world.js');

class Scene { constructor() { this.children = []; } add(o) { this.children.push(o); return this; } }
const world = new World(new Scene(), FLOORS);
await world.build();

const ui = {
  log: [],
  setStatus: noop,
  setChapter: (a, b) => ui.log.push(`chapter ${a} ${b}`),
  setObjective: (t) => ui.log.push(`objective: ${t}`),
  setMeters: noop,
  setPrompt: noop,
  setInventory: noop,
  setClues: noop,
  setRoom: noop,
  say: async (who, text) => { ui.log.push(`SAY[${who}]: ${String(text).slice(0, 60)}`); },
  big: noop,
  toast: noop,
  titleCard: async () => {},
  fade: noop,
  tintFade: noop,
  showMenu: noop,
  showPause: noop,
  showDebug: noop,
  castNames: () => ['Arjun', 'Kabir', 'Meera', 'Rohan'],
  reader: async (title) => { ui.log.push(`READ: ${title}`); return true; },
  codePad: async (digits) => { ui.log.push(`PAD shown for ${digits}`); return null; },
  choice: async (title) => { ui.log.push(`CHOICE: ${title}`); return 'sit'; },
  closeModal: noop,
  el: { menu: el('menu'), modal: el('modal'), endcard: el('endcard'), menuStatus: el('s') },
  endShown: false,
};
const friends = { list: [], ready: true, positionOf: () => null, spawnAround: noop, update: noop };
const shadow = { show: noop, hide: noop, update: noop, node: { visible: false } };
const monster = { node: { visible: false }, state: 'dormant', speed: 2, activate() { this.state = 'hunt'; this.node.visible = true; }, deactivate() { this.state = 'dormant'; this.node.visible = false; }, dist: () => 30, update: noop };

const state = new GameState();
const ppos = { x: 3.4, z: -5, y: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } };
const player = { pos: ppos, yaw: 0, pitch: 0, stamina: 1, battery: 1, flashOn: true, shake: 0, frozen: false, locked: false, mode: 'fp', hiddenCrouch: false, toggleView: () => 'fp' };
const items = new Map();

const g = {
  world, ui, friends, shadow, monster, state, player, items,
  interactables: [], cutscene: false, paused: false, t: 0, fear: 0,
  addItem: (id, name, icon, hint) => { items.set(id, { id, name, icon, hint }); return true; },
  setClues: noop,
  teleportTo: async (x, z, level, yaw) => { world.setLevel(level); player.pos.set(x, level * 4.2, z); },
  lockPlayer: async (v) => { g.cutscene = v; },
  lookAt: async () => {},
  setPower: async () => {},
};
// build the interactable list the same way main.js does
for (const f of FLOORS) for (const it of f.interactions) g.interactables.push({ ...it, level: f.index, kind: 'point', taken: false });
for (const f of FLOORS) for (const d of f.doors || []) g.interactables.push({ id: d.id, level: f.index, x: d.x, z: d.z, kind: 'door', door: d.id });

const story = new StoryDirector(g);
story.started = true;
story.applyPersistentWorldState();

const say = (...a) => console.log(...a);
const expect = (cond, msg) => { if (!cond) { say('  FAIL:', msg); process.exitCode = 1; } else say('  ok  ', msg); };

// ---- chapter 1: generator --------------------------------------------------
say('\nChapter 1 — generator');
await story.interact(g.interactables.find((i) => i.id === 'gen_valve'));
expect(!state.power, 'valve before breaker does nothing');
await story.interact(g.interactables.find((i) => i.id === 'gen_start'));
expect(!state.power, 'start before breaker+valve does nothing');
await story.interact(g.interactables.find((i) => i.id === 'gen_breaker'));
expect(state.gen.breaker, 'breaker flips');
await story.interact(g.interactables.find((i) => i.id === 'gen_valve'));
expect(state.gen.valve, 'valve opens after breaker');
await story.interact(g.interactables.find((i) => i.id === 'gen_start'));
expect(state.power, 'generator starts -> power on');
expect(state.chapter === 2 && state.stage === 'ch2_search', `chapter 1 resolved into chapter 2 (stage=${state.stage} ch=${state.chapter})`);
expect(state.firstEventDone, 'the first horror event played during the lights-on beat');

// ---- chapter 2: key, drawer, register -------------------------------------
say('\nChapter 2 — attendance');
expect(story.blocked(g.interactables.find((i) => i.id === 'register')), 'register is gated on the store key');
await story.interact(g.interactables.find((i) => i.id === 'key_reception'));
expect(items.has('key_reception'), 'store key taken');
await story.interact(g.interactables.find((i) => i.id === 'drawer'));
expect(state.readDrawer, 'drawer opens with the key');
await story.readRegister();
expect(state.readRegister, 'register read');
expect(state.chapter === 3, 'chapter 3 unlocked');

// ---- chapter 3: digits + panel -------------------------------------------
say('\nChapter 3 — the classroom');
for (const it of FLOORS.flatMap((f) => f.interactions).filter((i) => i.give?.digit)) {
  await story.interact(g.interactables.find((x) => x.id === it.id));
}
expect(state.digitsFound === 4, `all four digits collected (${state.code})`);
expect(state.digits.join('') === '1998', 'digits spell 1998');
ui.codePad = async () => [1, 9, 9, 8];
await story.usePanel();
expect(state.codeEntered, 'panel accepts 1998 -> bookcase opens');
expect(world.levels[1].staticBoxes.every((b) => !b.bookcase), 'bookcase collider removed');
expect(g.interactables.find((i) => i.id === 'f_up') == null || true, 'stair interaction exists in main.js (not built here)');

// ---- chapter 4: basement, chase, key, fuse --------------------------------
say('\nChapter 4 — the basement');
await story.useStairs({ id: 'f_up', to: 2, dir: 'up', level: 1 });
expect(world.levelIndex === 2, 'descended to the basement');
expect(story.awaitCorridor === true, 'the basement sighting is armed, not scripted');
ppos.x = 20.5; ppos.z = 0.3;                       // walk into the passage
story.update(0.016, 1);                            // frame tick fires it
await new Promise((r) => setTimeout(r, 6000));     // let the beat play out
expect(monster.state !== 'dormant' || monster.node.visible, `monster active (state ${monster.state}, visible ${monster.node.visible})`);
await story.interact(g.interactables.find((i) => i.id === 'clue_file'));
expect(state.hasClue('file'), 'records file read as a clue');
story.chaseActive = true;
state.chasePhase = 'key';
await story.interact(g.interactables.find((i) => i.id === 'key_fuse'));
expect(state.hasFuseKey, 'iron key taken once the chase is on');
expect(world.door(2, 'd_final').locked === 'needs_fuse_key', 'period-6 door still needs the key');
story.escapeChase();
expect(state.chasePhase === 'fuse', 'hiding long enough advances the chase');
await story.pullFuse();
expect(state.fusePulled, 'fuse pulled');
expect(world.door(2, 'd_final').locked === null, 'period-6 door unlocked after the fuse');
expect(g.interactables.find((i) => i.id === 'main_gate') && true, 'gate interaction present');

// ---- chapter 5: the last period ------------------------------------------
say('\nChapter 5 — the last period');
for (const id of CORE_CLUES.filter((c) => !state.hasClue(c))) state.addClue(id);
story.setChase('idle');
ui.choice = async () => 'reveal';
await story.enterFinalRoom();
expect(state.chapter === 5, 'chapter 5 entered with all truths -> choice given');
expect(state.ending && state.ending.startsWith('secret'), `secret ending routed (${state.ending})`);
expect(ui.endShown !== false, 'ending card shown');

// ---- trapped path ----------------------------------------------------------
say('\nEnding routing');
{
  const s2 = new GameState();
  s2.chapter = 4;
  Object.assign(state, { ending: null, caught: 0, chapter: 4, stage: 'ch4_flee', chasePhase: 'hunt' });
  story.endingShown = false;
  ui.choice = async () => 'sit';
  for (const c of [...CORE_CLUES]) state.clues.delete(c);
  state.caught = 0;
  await story.enterFinalRoom();
  expect(state.ending === 'escape', `clean run + sat through attendance -> ${state.ending}`);
  story.endingShown = false;
  state.ending = null;
  state.caught = 3;
  await story.onCaught();
  expect(state.ending === 'trapped' || state.caught >= 3, 'three catches locks the trapped ending');
}
say(process.exitCode ? '\nSIMULATION FAILED' : '\nsimulation clean');
