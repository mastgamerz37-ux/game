// Walk test with a real path: BFS on a fine grid, then drive the player along
// it with the game's own collision response. If this says WALKABLE, a human can
// walk there.  Run:  node tools/walk.mjs <level> <x,z> <x,z>
//   or:               node tools/walk.mjs --all
import { World } from '../src/world/world.js';
import { moveWithCollision, pointFree } from '../src/core/collision.js';
import { PLAYER_RADIUS } from '../src/constants.js';
import { FLOORS } from '../src/data/floors.js';

const noop = () => {};
const ctx2d = new Proxy(
  {
    canvas: {},
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    measureText: () => ({ width: 10 }),
  },
  { get: (t, k) => (k in t ? t[k] : noop), set: () => true }
);
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }),
  addEventListener: noop,
  getElementById: () => null,
};
globalThis.window = { addEventListener: noop };
if (!globalThis.requestAnimationFrame) globalThis.requestAnimationFrame = (f) => setTimeout(() => f(0), 16);

class Scene {
  constructor() { this.children = []; }
  add(o) { this.children.push(o); return this; }
}

const world = new World(new Scene(), FLOORS);
await world.build();

const CELL = 0.5;
const MINX = -25;
const MINZ = -9;
const GW = 100;
const GH = 36;
// probe with the player's real radius: the route then keeps a full clearance
// margin from walls and props, exactly like walking would
const PROBE = 0.34;

function boxesOf(level) {
  for (const d of level.doors.values()) {
    d.setOpen(true);
    for (let i = 0; i < 6; i++) d.update(1);
  }
  for (const b of level.colliders()) if (b.label === 'gate') b.active = false;
  return level.colliders().filter((b) => !(b.dynamic && b.active === false) && !(b.h !== undefined && b.h <= 1.9));
}

function pathOn(boxes, ax, az, bx, bz) {
  const gi = (x) => Math.round((x - MINX) / CELL);
  const gj = (z) => Math.round((z - MINZ) / CELL);
  const free = new Uint8Array(GW * GH);
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) free[j * GW + i] = pointFree(MINX + i * CELL, MINZ + j * CELL, PROBE, boxes) ? 1 : 0;
  const s = gj(az) * GW + gi(ax);
  const t = gj(bz) * GW + gi(bx);
  if (!free[s] || !free[t]) return { error: !free[s] ? 'start inside geometry' : 'goal inside geometry' };
  const dist = new Int32Array(GW * GH).fill(-1);
  const q = [s];
  dist[s] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    if (c === t) break;
    const ci = c % GW;
    const cj = (c - ci) / GW;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = ci + di;
      const nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
      const k = nj * GW + ni;
      if (!free[k] || dist[k] !== -1) continue;
      dist[k] = dist[c] + 1;
      q.push(k);
    }
  }
  if (dist[t] === -1) return { error: 'no route' };
  const pts = [];
  let c = t;
  while (c !== s) {
    pts.push([MINX + (c % GW) * CELL, MINZ + Math.floor(c / GW) * CELL]);
    const ci = c % GW;
    const cj = (c - ci) / GW;
    const d0 = dist[c];
    let nxt = -1;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = (cj + dj) * GW + ci + di;
      if (ci + di < 0 || cj + dj < 0 || ci + di >= GW || cj + dj >= GH) continue;
      if (dist[k] === d0 - 1) { nxt = k; break; }
    }
    if (nxt < 0) break;
    c = nxt;
  }
  pts.reverse();
  return { pts, cost: dist[t] };
}

/** drive the player along the path with the game's collision code */
function walkPath(boxes, pts, sx, sz) {
  let x = sx;
  let z = sz;
  let i = 0;
  for (let guard = 0; guard < 6000 && i < pts.length; guard++) {
    const [tx, tz] = pts[i];
    const dx = tx - x;
    const dz = tz - z;
    const d = Math.hypot(dx, dz);
    if (d < 0.18) {
      i++;
      continue;
    }
    const r = moveWithCollision(x, z, (dx / d) * 0.1, (dz / d) * 0.1, PLAYER_RADIUS, boxes);
    if (Math.hypot(r.x - x, r.z - z) < 1e-6) return { stuck: [x, z], ptsIndex: i };
    x = r.x;
    z = r.z;
  }
  return { x, z, reached: i >= pts.length };
}

const CASES = {
  0: [
    ['hall -> corridor', 3.4, -6.4, 3.0, -0.4],
    ['corridor -> classroom 1', 3.0, -0.4, -15.0, -3.0],
    ['corridor -> generator', 3.0, -0.4, 12.5, -5.0],
    ['corridor -> reception', 3.0, -0.4, 2.5, 2.2],
    ['corridor -> principal', 3.0, -0.4, 11.5, 2.2],
    ['corridor -> stairwell', 3.0, -0.4, 20.5, 5.0],
    ['corridor -> lost&found', 3.0, -0.4, -6.5, -4.9],
    ['corridor -> store', 3.0, -0.4, 20.5, -3.0],
    ['classroom1 -> hall door', -15.0, -3.0, -3.2, -3.4],
    ['corridor -> gate', 3.0, -0.4, 2.5, -7.4],
  ],
  1: [
    ['stairwell -> corridor', 20.5, 6.0, 20.5, -0.4],
    ['corridor -> old classroom', 20.5, -0.4, -20.0, 3.0],
    ['corridor -> locked classroom', 20.5, -0.4, -18.6, -5.0],
    ['corridor -> library', 20.5, -0.4, -6.5, 2.6],
    ['corridor -> lab', 20.5, -0.4, -6.5, -4.6],
    ['corridor -> store room', 20.5, -0.4, 11.5, -4.6],
    ['corridor -> the no-number room', 20.5, -0.4, 2.5, -4.6],
    ['corridor -> hidden stair hall', 20.5, -0.4, 21.2, 7.4],
    ['corridor -> open bay', 20.5, -0.4, 20.5, -5.0],
  ],
  2: [
    ['hidden room -> corridor', 20.5, 6.0, 20.5, -0.4],
    ['corridor -> records', 20.5, -0.4, -20.0, 3.0],
    ['corridor -> holding', 20.5, -0.4, -18.5, -5.0],
    ['corridor -> fuse room', 20.5, -0.4, -6.5, 3.0],
    ['corridor -> final room', 20.5, -0.4, 2.5, 4.6],
    ['corridor -> boiler', 20.5, -0.4, 11.5, 5.0],
    ['corridor -> coal store', 20.5, -0.4, 11.6, -5.0],
    ['corridor -> sump', 20.5, -0.4, -6.4, -5.0],
  ],
};

let fails = 0;
const argv = process.argv.slice(2);
const runs = [];
if (argv[0] === '--all' || argv.length === 0) {
  for (const lv of ['0', '1', '2']) for (const c of CASES[lv]) runs.push([lv, ...c]);
} else if (argv.length === 1) {
  for (const c of CASES[argv[0]]) runs.push([argv[0], ...c]);
} else {
  const [lv, a, b] = argv;
  const parse = (v) => v.split(',').map(Number);
  runs.push([lv, 'custom', ...parse(a), ...parse(b)]);
}

const byLevel = {};
for (const r of runs) (byLevel[r[0]] ||= []).push(r);

for (const lv of Object.keys(byLevel)) {
  const level = world.levels[Number(lv)];
  const boxes = boxesOf(level);
  console.log(`\n${level.def.name}`);
  for (const [, name, x0, z0, x1, z1] of byLevel[lv]) {
    const p = pathOn(boxes, x0, z0, x1, z1);
    if (p.error) {
      console.log(`  ✗ ${name.padEnd(28)} ${p.error} (${x0},${z0}) -> (${x1},${z1})`);
      fails++;
      continue;
    }
    const w = walkPath(boxes, p.pts, x0, z0);
    const ok = w.reached && Math.hypot(w.x - x1, w.z - z1) < 0.7;
    console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(28)} ${String(p.pts.length).padStart(3)} waypoints -> ${w.x?.toFixed?.(2)},${w.z?.toFixed?.(2)}${w.stuck ? ` stuck ${w.stuck.map((v) => v.toFixed(2)).join(',')}` : ''}`);
    if (!ok) fails++;
  }
}
console.log(fails ? `\n${fails} unreachable` : '\nevery route is walkable');
process.exit(fails ? 1 : 0);
