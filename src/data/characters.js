// ---------------------------------------------------------------------------
// Cast. `model` is either the placeholder rig we generate, or your own
// .glb/.fbx/.obj (see public/models/models.json) — the game code only ever
// talks to Character.id / .node / .setMove(), so swapping is free.
// ---------------------------------------------------------------------------
export const CAST = [
  {
    id: 'player',
    name: 'Arjun',
    role: 'You',
    trait: 'Main protagonist — you make the last call',
    color: 0x8fa7c8,
    accent: 0xdfe6f2,
    skin: 0xb98a63,
  },
  {
    id: 'friend1',
    name: 'Kabir',
    role: 'Brave',
    trait: 'Walks first, thinks later',
    color: 0xb2493a,
    accent: 0xe8b4a2,
    skin: 0x9c6b45,
  },
  {
    id: 'friend2',
    name: 'Meera',
    role: 'Logical',
    trait: 'Solves the puzzles, counts the doors',
    color: 0x3f7d68,
    accent: 0xcfe3d6,
    skin: 0xc79a72,
  },
  {
    id: 'friend3',
    name: 'Rohan',
    role: 'Funny but scared',
    trait: 'Jokes to stop himself screaming',
    color: 0xb0913c,
    accent: 0xf1e0a8,
    skin: 0x8d5f3c,
  },
];

export const GHOST = {
  id: 'ghost',
  name: 'UNKNOWN',
  role: 'Present',
  trait: 'Still on the register after 20 years',
  color: 0xdfe6ee,
  accent: 0x9fb2c6,
  skin: 0xc8d4de,
};

export const byId = Object.fromEntries([...CAST, GHOST].map((c) => [c.id, c]));
export const nameOf = (id) => byId[id]?.name ?? id;
