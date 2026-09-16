// Anchor validator: for every interaction marker, the player must be able to
// STAND next to it and WALK to it from the level spawn. This is the check that
// actually matters for playability.  node tools/anchors.mjs
import { World } from '../src/world/world.js';
import { pointFree, moveWithCollision } from '../src/core/collision.js';
import { PLAYER_RADIUS } from '../src/constants.js';
import { FLOORS } from '../src/data/floors.js';

const noop = () => {};
const c2 = new Proxy({ canvas: {}, createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }), measureText: () => ({ width: 10 }) }, { get: (t, k) => (k in t ? t[k] : noop), set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => c2, style: {} }), addEventListener: noop, getElementById: () => null };
globalThis.window = { addEventListener: noop };
if (!globalThis.requestAnimationFrame) globalThis.requestAnimationFrame = (f) => setTimeout(() => f(0), 16);
class Scene { constructor() { this.children = []; } add(o) { this.children.push(o); return this; } }

const world = new World(new Scene(), FLOORS);
await world.build();

const CELL = 0.5;
const MINX = -25;
const MINZ = -9;
const GW = 100;
const GH = 36;

function boxesOf(level) {
  for (const d of level.doors.values()) {
    d.setOpen(true);
    for (let i = 0; i < 6; i++) d.update(1);
  }
  for (const b of level.colliders()) if (b.label === 'gate') b.active = false;
  return level.colliders().filter((b) => !(b.dynamic && b.active === false) && !(b.h !== undefined && b.h <= 1.9));
}

function reachMap(boxes, sx, sz) {
  const free = new Uint8Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) free[j * GW + i] = pointFree(MINX + i * CELL, MINZ + j * CELL, PLAYER_RADIUS, boxes) ? 1 : 0;
  const gi = Math.round((sx - MINX) / CELL);
  const gj = Math.round((sz - MINZ) / CELL);
  const seen = new Uint8Array(GW * GH);
  const q = [gj * GW + gi];
  seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    const ci = c % GW;
    const cj = (c - ci) / GW;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = ci + di;
      const nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
      const k = nj * GW + ni;
      if (seen[k] || !free[k]) continue;
      seen[k] = 1;
      q.push(k);
    }
  }
  return { seen, free };
}

let bad = 0;
for (const floor of FLOORS) {
  const level = world.levels[floor.index];
  const boxes = boxesOf(level);
  // flood from inside the building (the yard is a separate volume; tools/walk
  // covers the outdoor -> gate route)
  const seedPt = floor.index === 0 ? { x: 3.4, z: -5.0 } : floor.spawn;
  const { seen } = reachMap(boxes, seedPt.x, seedPt.z);
  const at = (x, z) => seen[Math.round((z - MINZ) / CELL) * GW + Math.round((x - MINX) / CELL)];
  console.log(`\n${floor.name}`);
  const check = (label, x, z) => {
    // stand spots: 0.9m back from the marker (and diagonals for wall props)
    const spots = [
      [0, -0.95], [0, 0.95], [-0.95, 0], [0.95, 0],
      [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7],
      [0, -1.5], [0, 1.5], [-1.5, 0], [1.5, 0],
    ];
    const ok = spots.filter(([dx, dz]) => pointFree(x + dx, z + dz, PLAYER_RADIUS, boxes) && at(x + dx, z + dz));
    if (!ok.length) {
      console.log(`  ✗ ${label}  @ ${x},${z} — nowhere to stand / not reachable`);
      if (process.env.VERBOSE) for (const [dx, dz] of spots) {
        const fr = pointFree(x + dx, z + dz, PLAYER_RADIUS, boxes);
        console.log(`      spot(${(x+dx).toFixed(1)},${(z+dz).toFixed(1)}) free=${fr} reachable=${at(x + dx, z + dz)}`);
      }
      bad++;
    } else if (ok.length <= 2) {
      console.log(`  ~ ${label.padEnd(34)} @ ${x},${z} tight (${ok.length} stand spots)`);
    }
  };
  for (const it of floor.interactions || []) check(`[${floor.index}] ${it.id}`, it.x, it.z);
  for (const d of floor.doors || []) check(`[${floor.index}] door ${d.id}`, d.x, d.z);
  for (const key of ['stairs', 'downStairs', 'ladderUp']) {
    const s = floor[key];
    if (s) check(`[${floor.index}] ${key}`, (s.rect.x0 + s.rect.x1) / 2, s.dir === 'up' && key === 'stairs' ? s.rect.z0 + 0.4 : (s.rect.z0 + s.rect.z1) / 2);
  }
  if (floor.gate) check(`[${floor.index}] main gate`, floor.gate.x, floor.gate.z + 0.9);
}
console.log(bad ? `\n${bad} anchor(s) unplayable` : '\nevery anchor is walkable and standable');
void moveWithCollision;
process.exit(bad ? 1 : 0);
