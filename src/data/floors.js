// ---------------------------------------------------------------------------
// THE SCHOOL — geometry as data. Three levels of one building.
//
// Space (each level drawn at y = index * FLOOR_H):
//   x: -24.5 .. 24.5   bays divided by walls at -24.5,-11.5,-1.5,6.5,16.5,24.5
//   z:  -8.5 ..  8.5   'n' = north rooms, 's' = south rooms, |z|<1.35 = corridor
//
// A wall run is a strip with door gaps punched in it; the same description
// drives meshes, colliders, doorway leaves and the AI's flow field:
//   { k:'H', z, x0, x1, door:[{x,w}] }   { k:'V', x, z0, z1, door:[{z,w}] }
//
// Rule of the house: every room has exactly one door onto the corridor, the
// corridor and the entrance hall are one open volume, and the east bay holds
// the stairs. tools/walk.mjs + tools/anchors.mjs enforce it.
// ---------------------------------------------------------------------------

export const BAY = [-24.5, -11.5, -1.5, 6.5, 16.5, 24.5];
export const CORR_Z = 1.2;

const rect = (bay, side, over = {}) => ({
  x0: BAY[bay] + 0.15,
  x1: BAY[bay + 1] - 0.15,
  z0: side === 'n' ? 1.5 : -8.35,
  z1: side === 'n' ? 8.35 : -1.5,
  ...over,
});

const room = (id, name, bay, side, props, lights) => ({
  id,
  name,
  props,
  lights: lights === undefined ? [[0, 5]] : lights,
  rect: rect(bay, side),
});
const hall = (id, name, lights) => ({
  id,
  name,
  props: 'corridor',
  lights,
  rect: { x0: -24.35, x1: 24.35, z0: -1.35, z1: 1.35 },
});

const corrWalls = (north, south) => [
  { k: 'H', z: CORR_Z, x0: -24.5, x1: 24.5, door: north },
  { k: 'H', z: -CORR_Z, x0: -24.5, x1: 24.5, door: south },
];
const shell = () => [
  { k: 'H', z: 8.35, x0: -24.5, x1: 24.5 },
  { k: 'H', z: -8.35, x0: -24.5, x1: 24.5 },
  { k: 'V', x: -24.5, z0: -8.5, z1: 8.5 },
  { k: 'V', x: 24.5, z0: -8.5, z1: 8.5 },
];
/** bay divider, split so it never crosses the corridor */
const divider = (x, gapZ) => [
  { k: 'V', x, z0: -8.5, z1: -1.35, ...(gapZ && gapZ < 0 ? { door: [{ z: gapZ }] } : {}) },
  { k: 'V', x, z0: 1.35, z1: 8.5, ...(gapZ && gapZ > 0 ? { door: [{ z: gapZ }] } : {}) },
];
const nd = (id, x, name, extra = {}) => ({ id, x, z: CORR_Z, axis: 'x', name, ...extra });
const sd = (id, x, name, extra = {}) => ({ id, x, z: -CORR_Z, axis: 'x', name, ...extra });

// ============================================================== GROUND ======
export const GROUND = {
  index: 0,
  name: 'Ground Floor',
  spawn: { x: -8.5, z: -11.2, yaw: 0.55 }, // you start outside, in the yard
  entryTrigger: { x0: -2.0, x1: 7.5, z0: -7.2, z1: -2.6 },
  gate: { x: 2.5, z: -8.35, w: 3.2 },
  rooms: [
    room('c1', 'Classroom 1', 0, 'n', 'classroom', [[-18, 4.6], [-14, 7.0]]),
    room('lounge', 'Staff Lounge', 1, 'n', 'office', [[-6.5, 4.8]]),
    room('reception', 'Reception', 2, 'n', 'office', [[2.5, 4.8]]),
    room('principal', "Principal's Office", 3, 'n', 'office', [[11.5, 4.8]]),
    room('stairhall', 'Stairwell', 4, 'n', 'stair', [[20.5, 4.6]]),
    room('lost', 'Lost & Found', 1, 's', 'storage', [[-6.5, -4.6]]),
    room('c2', 'Classroom 2', 0, 's', 'classroom', [[-18, -4.6]]),
    room('hall', 'Entrance Hall', 2, 's', 'hall', [[2.5, -4.6]]),
    room('gen', 'Generator Room', 3, 's', 'utility', []),
    room('store', 'General Store', 4, 's', 'storage', [[20.5, -4.6]]),
    hall('lobby', 'Main Corridor', 'auto'),
  ],
  runs: [
    // north side: classroom 1, reception, principal, stair hall (bay1 north = lounge,
    // reached through the lounge door at x=-6.5 is on the south list; keep one each)
    ...corrWalls([{ x: -18.5 }, { x: -6.5 }, { x: 2.5 }, { x: 11.5 }, { x: 20.5 }], [{ x: -18.5 }, { x: -6.5 }, { x: 2.5 }, { x: 11.5 }, { x: 20.5 }]),
    ...shell(),
    ...divider(-11.5),
    ...divider(-1.5),
    ...divider(6.5),
    ...divider(16.5),
  ],
  doors: [
    nd('d_c1', -18.5, 'Classroom 1 door'),
    nd('d_lounge', -6.5, 'Staff lounge door'),
    nd('d_rec', 2.5, 'Reception door'),
    nd('d_prin', 11.5, "Principal's office door"),
    nd('d_stairs', 20.5, 'Stairwell door'),
    sd('d_c2', -18.5, 'Classroom 2 door'),
    sd('d_lost', -6.5, 'Lost & Found door'),
    sd('d_gen', 11.5, 'Generator room door'),
    sd('d_store', 20.5, 'Store door'),
  ],
  stairs: { id: 'g_up', rect: { x0: 18.8, x1: 23.4, z0: 5.0, z1: 8.0 }, to: 1, dir: 'up', label: 'Stairs up' },
  signs: [
    { text: 'CLASSROOM 1', x: -18.5, z: 1.42, face: 'n' },
    { text: 'LOST & FOUND', x: -6.5, z: -1.42, face: 's' },
    { text: 'CLASSROOM 2', x: -18.5, z: -1.42, face: 's' },
    { text: 'STAFF LOUNGE', x: -6.5, z: 1.42, face: 'n' },
    { text: 'RECEPTION', x: 2.5, z: 1.42, face: 'n' },
    { text: "PRINCIPAL'S OFFICE", x: 11.5, z: 1.42, face: 'n' },
    { text: 'GENERATOR', x: 11.5, z: -1.42, face: 's' },
    { text: 'GENERAL STORE', x: 20.5, z: -1.42, face: 's' },
    { text: 'STAIRS', x: 20.5, z: 1.42, face: 'n' },
    { text: 'SHUT DOWN FOR RENOVATION — NO ENTRY AFTER 8 PM', x: 2.5, z: -8.15, face: 'n', big: true },
  ],
  interactions: [
    { id: 'digit_c1', label: 'Broken desk with something scratched under it', x: -14.2, z: 7.4, once: true, text: 'Under the desk top, scratched deep into the wood, one chalk mark:\n\n『 9 』', give: { digit: { slot: 1, value: 9 } } },
    { id: 'board_c1', label: 'Classroom 1 blackboard', x: -23.9, z: 4.6, face: 'e', text: 'Everything has been erased except one line at the bottom:\n\n『 HE STAYED BACK FOR THE LAST PERIOD. 』' },
    { id: 'notice_c2', label: 'Notice board', x: -23.9, z: -4.6, face: 'e', text: 'Rotted notices. One is still legible, dated 12 Nov 1998:\n\n『 DETENTION LIST — PERIOD 6 → A. VERMA (9) …  the rest is torn away. 』' },
    { id: 'clue_ruler', label: 'A broken wooden ruler, lined up on the sill', x: -13.5, z: -7.9, face: 's', text: 'Six broken rulers, all snapped in half, all laid parallel, all pointing at the board.\n\nSomeone was keeping a count. Under the last one: <b>『 6 periods. He waited through 6. 』</b>', clue: 'rulers' },
    { id: 'clue_ledger', label: 'Torn page in the Lost & Found box', x: -6.5, z: -7.9, face: 's', text: 'A page torn from the school accounts, used to wrap something:\n\n『 14 Nov 1998 — Repair of B2 door.  Silencing of the family.  Advance paid. 』', clue: 'ledger' },
    { id: 'key_reception', label: 'Key ring on a nail', x: -1.9, z: -4.6, face: 'e', text: 'A small brass key on a nail, with a paper tag:\n\n『 RECEPTION — DRAWER — DO NOT TAKE 』', take: 'key_reception' },
    { id: 'digit_photo', label: 'Framed class photograph', x: -1.1, z: 4.8, face: 'w', text: 'Class photograph, 1998. On the back, in pen:\n\n『 43 present. 1 absent. 』\n\nPressed hard into the card below it, one digit:  1', give: { digit: { slot: 0, value: 1 } } },
    { id: 'register', label: 'Attendance register on the desk', x: 3.2, z: 6.4, special: 'register', locked: 'needs_reception_key' },
    { id: 'drawer', label: 'Locked reception drawer', x: 5.2, z: 6.4, special: 'drawer', locked: 'needs_reception_key' },
    { id: 'clue_suspension', label: 'Suspension order on the desk', x: 11.5, z: 6.8, text: '『 A. VERMA is suspended for wilful damage, pending payment. 』\n\nNo payment record. No rejoining record. The order is dated two days AFTER he disappeared.', clue: 'suspension' },
    { id: 'digit_nameplate', label: "Principal's brass nameplate", x: 7.1, z: 4.9, face: 'e', text: 'Polished by years of nervous hands.\n\nH. M. DUTTA — 1 9 9 8\n\nOne of the 9s in the year has been circled twice, hard enough to score the brass.', give: { digit: { slot: 2, value: 9 } } },
    { id: 'gen_breaker', label: 'Main breaker', x: 7.1, z: -4.6, face: 'e', special: 'breaker' },
    { id: 'gen_valve', label: 'Fuel valve', x: 7.1, z: -6.4, face: 'e', special: 'valve' },
    { id: 'gen_start', label: 'Start lever', x: 13.0, z: -7.6, face: 's', special: 'start' },
    { id: 'chalk_hint', label: 'Chalk symbols on the floor', x: 15.0, z: -2.6, text: 'Three chalk symbols, in order:\n\n『  ⌁  →  ≈  →  ⟳  』\n\nBreaker. Valve. Start. Whoever wrote this wanted the machine to be found.' },
    { id: 'digit_fuse', label: 'Fuse box with a taped note', x: 15.9, z: -6.6, face: 'w', text: 'A note taped inside the fuse box, dated the night of 12 Nov 1998:\n\n『 Generator shut-down at 8pm. The CHILD IN PERIOD 6 is not to be counted. 』\n\nThe last digit of that year is written on the box again and again, in a shaking hand:  8 8 8 8', give: { digit: { slot: 3, value: 8 } } },
    { id: 'main_gate', label: 'The main gate', x: 2.5, z: -8.0, face: 'n', special: 'gate' },
  ],
};

// ========================================================== FIRST FLOOR ======
export const FIRST = {
  index: 1,
  name: 'First Floor',
  spawn: { x: 20.5, z: 6.0, yaw: Math.PI }, // top of the stairs
  rooms: [
    room('oldclass', 'Old Classroom', 0, 'n', 'classroom', [[-18, 4.6]]),
    room('library', 'Library', 1, 'n', 'library', [[-6.5, 4.6], [-9.5, 7.0]]),
    room('dissect', 'Dissection Room', 2, 'n', 'lab', [[2.5, 4.6]]),
    room('staff', 'Staff Room', 3, 'n', 'office', [[11.5, 4.8]]),
    room('stairhall', 'Stairwell & Hidden Room', 4, 'n', 'back', [[20.5, 4.6]]),
    room('lockedclass', 'Locked Classroom', 0, 's', 'classroom', []),
    room('lab', 'Science Lab', 1, 's', 'lab', [[-6.5, -4.6]]),
    room('secret', 'Room With No Number', 2, 's', 'secret', []),
    room('fstore', 'Store Room', 3, 's', 'storage', []),
    room('bay', 'Open Bay', 4, 's', 'empty', []),
    hall('lobby', 'Main Corridor', 'auto'),
  ],
  runs: [
    ...corrWalls([{ x: -18.5 }, { x: -6.5 }, { x: 2.5 }, { x: 11.5 }, { x: 20.5, w: 1.4 }], [{ x: -18.5 }, { x: -6.5 }, { x: 2.5 }, { x: 11.5 }, { x: 20.5 }]),
    ...shell(),
    ...divider(-11.5),
    ...divider(-1.5),
    ...divider(6.5),
    ...divider(16.5),
  ],
  doors: [
    nd('d_old', -18.5, 'Old classroom door'),
    nd('d_lib', -6.5, 'Library door'),
    nd('d_dissect', 2.5, 'Dissection room door'),
    nd('d_staff', 11.5, 'Staff room door'),
    nd('d_stairs', 20.5, 'Stairwell door', { w: 1.4 }),
    sd('d_locked', -18.5, 'Locked classroom door', { locked: 'needs_brass_key' }),
    sd('d_lab', -6.5, 'Science lab door'),
    sd('d_secret', 2.5, 'Door with no room number'),
    sd('d_fstore', 11.5, 'Store room door'),
  ],
  stairs: { id: 'f_up', rect: { x0: 19.4, x1: 23.0, z0: 6.4, z1: 8.1 }, to: 2, dir: 'up', label: 'Ladder going down', hidden: true },
  downStairs: { id: 'f_down', rect: { x0: 19.4, x1: 23.0, z0: 1.9, z1: 3.4 }, to: 0, dir: 'down', label: 'Stairs down' },
  signs: [
    { text: 'OLD CLASSROOM — PERIOD 6', x: -18.5, z: 1.42, face: 'n' },
    { text: 'LIBRARY', x: -6.5, z: 1.42, face: 'n' },
    { text: 'STAFF ROOM', x: 11.5, z: 1.42, face: 'n' },
    { text: 'DO NOT USE', x: -18.5, z: -1.42, face: 's' },
    { text: 'SCIENCE LAB', x: -6.5, z: -1.42, face: 's' },
    { text: 'NO ROOM NUMBER', x: 2.5, z: -1.42, face: 's', small: true },
  ],
  interactions: [
    { id: 'board_q', label: 'The blackboard', x: -23.9, z: 4.6, face: 'e', special: 'board' },
    { id: 'code_panel', label: 'Old combination panel in the wall', x: -11.35, z: 6.6, face: 'w', special: 'panel' },
    { id: 'clue_diary', label: 'Small blue diary, Biology shelf 3', x: -11.3, z: 4.2, face: 'w', text: "Aarav's diary. The last entry:\n\n『 12 Nov — They say I broke the loudspeaker. I did not. I stayed back to say so. Sir said: wait in period 6, then we will talk. I will wait. I am good at waiting. 』", clue: 'diary' },
    { id: 'digit_book', label: 'Hollow book on the top shelf', x: -11.3, z: 7.5, face: 'w', text: '『 A Textbook of Physics, 1998 』 — the pages have been hollowed out.\n\nInside: a marigold dried to paper, and a slip with one digit:\n\n『 8 』 — and beneath it:  He was still wearing his school shoes.', give: { digit: { slot: 3, value: 8 }, clue: 'flower' } },
    { id: 'desk_carving', label: 'Desks carved with the same word', x: -18.0, z: -4.6, text: 'Every desk in this room carries one word. Forty of them:\n\n『 WAITING 』\n\nOn the last desk, in fresh pencil:  『 4 chairs were set out for us. A fifth was never removed. 』' },
    { id: 'specimen', label: 'Specimen jar with a ring in it', x: -6.5, z: -7.9, face: 's', text: 'A class ring floating in cloudy formalin, and a tag:\n\n『 A.V. — recovered from the Period 6 room, 1998. DO NOT RETURN. 』', clue: 'ring' },
    { id: 'lab_cabinet', label: 'Locked specimen cabinet', x: -1.9, z: -5.4, face: 'e', special: 'lab_cabinet' },
    { id: 'battery', label: 'Torch with spare cells', x: 11.5, z: -7.9, face: 's', text: "A working torch and a packet of cells, on a shelf beside a child's shoe.", give: { battery: true } },
    { id: 'clue_note', label: 'Teacher note pinned to a chair', x: 11.5, z: 6.8, text: '『 Do not sign the register for period 6. If you sign it, it becomes a record. If it is a record, then he is still there. — K. 』', clue: 'note' },
    { id: 'brass_key', label: 'Brass key on a taped-up hook', x: 7.1, z: 6.4, face: 'e', text: 'A hook labelled 『 PERIOD 6 ROOM — H.M. 』 with a heavy brass key, wrapped in black tape so that it will not shine.', take: 'brass_key' },
    { id: 'bookcase', label: 'A bookcase that does not fit the wall', x: 18.8, z: 1.9, face: 's', special: 'bookcase' },
  ],
};

// ============================================================== BASEMENT ====
export const BASEMENT = {
  index: 2,
  name: 'Basement',
  basement: true,
  spawn: { x: 20.5, z: 6.0, yaw: Math.PI }, // at the bottom of the ladder
  rooms: [
    room('records', 'Old Records Room', 0, 'n', 'storage', []),
    room('fuse', 'Fuse Room', 1, 'n', 'utility', []),
    room('final', 'The Last Period', 2, 'n', 'final', [[2.5, 4.8]]),
    room('boiler', 'Boiler Room', 3, 'n', 'utility', []),
    room('hidden', 'Behind the Bookcase', 4, 'n', 'empty', []),
    room('holding', 'Holding Room', 0, 's', 'empty', []),
    room('sump', 'Sump / Pump Room', 1, 's', 'empty', []),
    room('last_hall', 'Back Stairwell', 2, 's', 'empty', []),
    room('coal', 'Coal Store', 3, 's', 'storage', []),
    room('darkbay', 'Dark Bay', 4, 's', 'empty', []),
    hall('lobby', 'Basement Passage', 'auto'),
  ],
  runs: [
    ...corrWalls([{ x: -18.5 }, { x: -6.5 }, { x: 2.5 }, { x: 11.5 }, { x: 20.5, w: 1.4 }], [{ x: -18.5 }, { x: -6.5 }, { x: 2.5 }, { x: 11.5 }, { x: 20.5 }]),
    ...shell(),
    ...divider(-11.5),
    ...divider(-1.5),
    ...divider(6.5),
    ...divider(16.5),
  ],
  doors: [
    nd('d_rec', -18.5, 'Records room door'),
    nd('d_fuse', -6.5, 'Fuse room door'),
    nd('d_final', 2.5, 'Door of Period 6', { locked: 'needs_fuse_key', special: true }),
    nd('d_boiler', 11.5, 'Boiler room door'),
    nd('d_hidden', 20.5, 'Door back to the ladder', { w: 1.4 }),
    sd('d_hold', -18.5, 'Holding room door'),
    sd('d_sump', -6.5, 'Pump room door'),
    sd('d_coal', 11.5, 'Coal store door'),
    sd('d_lasthall', 2.5, 'Back stairwell door'),
  ],
  ladderUp: { id: 'b_up', rect: { x0: 19.4, x1: 23.0, z0: 6.4, z1: 8.1 }, to: 1, dir: 'up', label: 'Ladder back up' },
  signs: [
    { text: 'RECORDS', x: -18.5, z: 1.42, face: 'n' },
    { text: 'FUSE ROOM', x: -6.5, z: 1.42, face: 'n' },
    { text: 'PERIOD 6', x: 2.5, z: 1.42, face: 'n' },
    { text: 'BOILER', x: 11.5, z: 1.42, face: 'n' },
    { text: 'HOLDING', x: -18.5, z: -1.42, face: 's' },
  ],
  interactions: [
    { id: 'clue_file', label: 'File 6-A — "Non-Attendance"', x: -20.5, z: 7.6, face: 'n', text: '『 A. VERMA, Class 9. Status: NON-ATTENDANCE (per instruction). Records closed 12/11/1998. No FIR. Reason: none recorded. 』\n\nTucked in the fold, a receipt for ₹2,00,000 — 『 for the silence of the family of one boy 』 — signed by the manager and three teachers.', clue: 'file' },
    { id: 'key_fuse', label: 'Black iron key on a nail', x: -11.3, z: 5.2, face: 'w', text: 'An iron key, tagged 『 FUSE ROOM — PERIOD 6 』. It is cold, and slightly wet.', take: 'key_fuse', gated: 'chase_key' },
    { id: 'clue_chair', label: 'A chair bolted to the floor, with straps', x: -18.5, z: -5.0, text: 'A school chair with leather straps around the arms, bolted into the concrete.\n\nScratched out beneath it:  『 THE PERIOD NEVER ENDED 』', clue: 'chair' },
    { id: 'fuse_pull', label: 'Main fuse handle', x: -6.5, z: 7.6, face: 'n', special: 'fuse' },
    { id: 'final_register', label: 'Attendance register on the teacher desk', x: 2.5, z: 6.4, special: 'final_register' },
    { id: 'final_board', label: 'The blackboard', x: -1.1, z: 4.6, face: 'w', special: 'final_board' },
    { id: 'portrait', label: 'Portrait under a cloth', x: 6.1, z: 5.4, face: 'e', special: 'portrait' },
    { id: 'clue_shoes', label: 'A pair of small school shoes', x: -6.5, z: -7.9, face: 's', text: 'Black school shoes, polished, toes pointing at the wall — as if someone is standing in them, facing the dark.\n\nThey are still slightly warm.', clue: 'shoes' },
    { id: 'clue_tape', label: 'Reel-to-reel recorder, still turning', x: 11.5, z: 7.6, face: 'n', text: "A reel still running after twenty years. On it, the headmistress's voice:\n\n『 …we will call it a transfer. The register stays as it is. If the register says present, then he was present. That is what records mean. 』", clue: 'tape' },
  ],
};

export const FLOORS = [GROUND, FIRST, BASEMENT];

// The 8 truths that expose the cover-up. All 8 -> the secret ending unlocks.
export const CORE_CLUES = ['diary', 'note', 'suspension', 'ledger', 'file', 'tape', 'chair', 'shoes'];
export const BONUS_CLUES = ['ring', 'flower', 'portrait', 'rulers'];
export const CLUE_TITLES = {
  diary: "Aarav's diary (last entry)",
  note: 'Unsigned teacher note',
  suspension: 'Suspension order, dated after',
  ledger: 'Accounts page — "silencing"',
  file: 'File 6-A — Non-Attendance',
  tape: 'Reel recording — headmistress',
  chair: 'The strapped chair',
  shoes: 'School shoes by the sump',
  ring: 'Class ring in formalin',
  flower: 'Marigold in the hollow book',
  portrait: 'The portrait under the cloth',
  rulers: 'Six broken rulers, all pointing at the board',
};
