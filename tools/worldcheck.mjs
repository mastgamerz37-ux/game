// Runs the REAL world builder in Node (no WebGL) and checks the geometry.
//   node tools/worldcheck.mjs
//
// checks:
//  1. every level builds, colliders/doors/fixtures exist
//  2. spawn points are standable (using the game's own collision code)
//  3. with every door open, the level is ONE connected region (flood fill)
//  4. every interaction anchor has standable ground within reach
import { World } from '../src/world/world.js';
import { pointFree, moveWithCollision } from '../src/core/collision.js';
import { PLAYER_RADIUS, FLOOR_H } from '../src/constants.js';

// ---------------------------------------------------------------- DOM shim --
const noop = () => {};
const ctx2d = new Proxy(
  {
    canvas: {},
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: noop,
    save: noop,
    restore: noop,
  },
  { get: (t, k) => (k in t ? t[k] : noop), set: () => true }
);
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }),
  addEventListener: noop,
  getElementById: () => null,
};
globalThis.window = { addEventListener: noop };
globalThis.self = globalThis.window;
if (!globalThis.requestAnimationFrame) globalThis.requestAnimationFrame = (f) => setTimeout(() => f(0), 16);

class Scene {
  constructor() {
    this.children = [];
  }
  add(o) {
    this.children.push(o);
    return this;
  }
}

import { FLOORS } from '../src/data/floors.js';
const world = new World(new Scene(), FLOORS);
await world.build();

const X0 = -25;
const Z0 = -9;
const W = 50;
const H = 18;

let fail = 0;
for (const floor of FLOORS) {
  const lv = world.levels[floor.index];
  const boxes = lv.colliders();
  // drive the real Door objects (collider.active flips inside update())
  const open = () => {
    for (const d of lv.doors.values()) {
      d.setOpen(true);
      for (let i = 0; i < 3; i++) d.update(0.5);
    }
  };
  const close = () => {
    for (const d of lv.doors.values()) {
      d.setOpen(false);
      for (let i = 0; i < 3; i++) d.update(0.5);
    }
  };
  const dyn = () => boxes.filter((b) => ((b.dynamic && b.active !== false) || (b.h !== undefined && b.h > 1.9) || (!b.dynamic && b.h === undefined)));

  console.log(`\n${floor.name}: ${lv.doors.size} doors, ${lv.fixtures.length} lights, ${boxes.length} colliders`);

  // 2. spawn standable
  const sp = floor.index === 0 ? { x: 3.4, z: -5.0, yaw: 0 } : floor.spawn;
  const okSpawn = pointFree(sp.x, sp.z, PLAYER_RADIUS, dyn());
  console.log(`  spawn (${sp.x}, ${sp.z}) standable: ${okSpawn}`);
  if (!okSpawn) fail++;

  // movement works (a push against a wall slides instead of sticking)
  const mv = moveWithCollision(sp.x, sp.z, 0.5, 0.5, PLAYER_RADIUS, dyn());
  if (Number.isNaN(mv.x) || Number.isNaN(mv.z)) {
    console.log('  ! movement returned NaN');
    fail++;
  }

  // 3 + 4 with doors open
  open();
  const freeAt = (i, j) => pointFree(X0 + i + 0.5, Z0 + j + 0.5, 0.18, dyn());
  let si = Math.floor(sp.x - X0);
  let sj = Math.floor(sp.z - Z0);
  for (let rad = 0; rad <= 4 && !freeAt(si, sj); rad++)
    for (let dj = -rad; dj <= rad; dj++)
      for (let di = -rad; di <= rad; di++)
        if (freeAt(si + di, sj + dj)) {
          si += di;
          sj += dj;
          rad = 99;
          break;
        }
  const seen = new Set([sj * W + si]);
  const stack = [sj * W + si];
  void moveWithCollision;
  while (stack.length) {
    const c = stack.pop();
    const ci = c % W;
    const cj = (c - ci) / W;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const ni = ci + di;
      const nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const k = nj * W + ni;
      if (seen.has(k) || !freeAt(ni, nj)) continue;
      seen.add(k);
      stack.push(k);
    }
  }
  let totalFree = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (freeAt(i, j)) totalFree++;
  console.log(`  open region: ${seen.size} cells of ${totalFree} free (doors open)`);
  if (seen.size < totalFree * 0.9) {
    console.log(`  ! ${totalFree - seen.size} free cells are cut off from the spawn`);
    // name the orphans so it is fixable
    const orphanRooms = new Set();
    for (const room of lv.def.rooms) {
      const i = Math.floor((room.rect.x0 + room.rect.x1) / 2 - X0);
      const j = Math.floor((room.rect.z0 + room.rect.z1) / 2 - Z0);
      if (freeAt(i, j) && !seen.has(j * W + i)) orphanRooms.add(room.name);
    }
    if (orphanRooms.size) console.log(`    orphaned rooms: ${[...orphanRooms].join(', ')}`);
    fail++;
  }

  // 4. anchors standable & reachable
  const bad = [];
  for (const it of lv.def.interactions || []) {
    let ok = false;
    for (const [di, dj] of [
      [0, 0],
      [0.6, 0],
      [-0.6, 0],
      [0, 0.6],
      [0, -0.6],
      [0.6, 0.6],
      [-0.6, 0.6],
      [0.6, -0.6],
      [-0.6, -0.6],
      [1.2, 0],
      [-1.2, 0],
      [0, 1.2],
      [0, -1.2],
    ]) {
      const x = it.x + di;
      const z = it.z + dj;
      if (!pointFree(x, z, PLAYER_RADIUS, dyn())) continue;
      const i = Math.floor(x - X0);
      const j = Math.floor(z - Z0);
      if (seen.has(j * W + i)) {
        ok = true;
        break;
      }
    }
    if (!ok) bad.push(it.id);
  }
  console.log(`  anchors: ${(lv.def.interactions || []).length} reachable-standable, ${bad.length ? 'PROBLEM → ' + bad.join(', ') : 'all good'}`);
  if (bad.length) fail++;
  close();
}

// door sanity
let doorOk = 0;
for (const [k, d] of world.allDoors) {
  d.setOpen(true);
  d.update(1);
  d.update(1);
  if (d.collider.active === false) doorOk++;
}
if (process.env.CELLS) {
  const floor = FLOORS[Number(process.env.CELLS)];
  const lv = world.levels[floor.index];
  for (const d of lv.doors.values()) { d.setOpen(true); d.update(0.5); d.update(0.5); }
  const bs = lv.colliders().filter((b) => ((b.dynamic && b.active !== false) || (b.h !== undefined && b.h > 1.9) || (!b.dynamic && b.h === undefined)));
  console.log(`\n--- ${floor.name} (rows north->south; # blocked, . free) ---`);
  for (let j = H - 1; j >= 0; j--) {
    let l = '';
    for (let i = 0; i < W; i++) l += pointFree(X0 + i + 0.5, Z0 + j + 0.5, PLAYER_RADIUS, bs) ? '.' : '#';
    console.log(`  z${String(Z0 + j + 1).padStart(3)} ${l}`);
  }
}

console.log(`\ndoors: ${world.allDoors.size} total, ${doorOk} disable their collider when open`);
if (doorOk !== world.allDoors.size) fail++;
console.log(`fixtures: ${world.allFixtures.length}, levels: ${world.levels.length}, floorY check: ${world.levels[2].group.position.y === 2 * FLOOR_H}`);



if (process.env.AT) {
  const [lv, xy] = process.env.AT.split('=');
  const [x, z] = xy.split(',').map(Number);
  const level = world.levels[Number(lv)];
  for (const d of level.doors.values()) { d.setOpen(true); d.update(0.5); d.update(0.5); }
  const bs = level.colliders();
  let k = 0;
  for (const b of bs) {
    const cx = (b.minx + b.maxx) / 2;
    const cz = (b.minz + b.maxz) / 2;
    if (Math.abs(cx - x) < 2.2 && Math.abs(cz - z) < 2.2) {
      k++;
      console.log(`  near(${x},${z}) [${b.minx.toFixed(2)},${b.maxx.toFixed(2)}]x[${b.minz.toFixed(2)},${b.maxz.toFixed(2)}] h=${b.h} active=${b.active} door=${!!b.dynamic}`);
    }
  }
  console.log(`  ${k} colliders near (${x},${z}) on level ${lv}; pointFree=${pointFree(x, z, PLAYER_RADIUS, bs)}`);
}


if (process.env.OVERLAY) {
  for (const fi of process.env.OVERLAY.split(',').map(Number)) {
    const floor = FLOORS[fi];
    const lv = world.levels[fi];
    for (const d of lv.doors.values()) { d.setOpen(true); d.update(0.5); d.update(0.5); }
    const dyn = () => lv.colliders().filter((b) => ((b.dynamic && b.active !== false) || (b.h !== undefined && b.h > 1.9) || (!b.dynamic && b.h === undefined)));
    const freeAt = (i, j) => pointFree(X0 + i + 0.5, Z0 + j + 0.5, 0.18, dyn());
    const si = Math.floor(floor.spawn.x - X0);
    const sj = Math.floor(floor.spawn.z - Z0);
    const seen = new Set([sj * W + si]);
    const stack = [sj * W + si];
    while (stack.length) {
      const c = stack.pop();
      const ci = c % W;
      const cj = (c - ci) / W;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const k = nj * W + ni;
        if (seen.has(k) || !freeAt(ni, nj)) continue;
        seen.add(k);
        stack.push(k);
      }
    }
    console.log(`\n--- ${floor.name} overlay (o spawn, @ reachable, # blocked, - free-but-cut-off) ---`);
    for (let j = H - 1; j >= 0; j--) {
      let l = '';
      for (let i = 0; i < W; i++) l += seen.has(j * W + i) ? (i === si && j === sj ? 'o' : '@') : freeAt(i, j) ? '-' : '#';
      console.log(`  z${String(Z0 + j + 1).padStart(3)} ${l}`);
    }
  }
}

console.log(fail ? `\n${fail} FAILURE(S)` : '\nWORLD OK');
process.exit(fail ? 1 : 0);

if (process.env.CELLS) {
  const floor = FLOORS[Number(process.env.CELLS)];
  const lv = world.levels[floor.index];
  for (const d of lv.doors.values()) { d.setOpen(true); d.update(0.5); d.update(0.5); }
  const bs = lv.colliders().filter((b) => ((b.dynamic && b.active !== false) || (b.h !== undefined && b.h > 1.9) || (!b.dynamic && b.h === undefined)));
  console.log(`\n--- ${floor.name} (rows north->south; # blocked, . free) ---`);
  for (let j = H - 1; j >= 0; j--) {
    let l = '';
    for (let i = 0; i < W; i++) l += pointFree(X0 + i + 0.5, Z0 + j + 0.5, PLAYER_RADIUS, bs) ? '.' : '#';
    console.log(`  z${String(Z0 + j + 1).padStart(3)} ${l}`);
  }
}
console.log(fail ? `\n${fail} FAILURE(S)` : '\nWORLD OK');
process.exit(fail ? 1 : 0);

if (process.env.CELLS) {
  const floor = FLOORS[Number(process.env.CELLS)];
  const lv = world.levels[floor.index];
  for (const d of lv.doors.values()) { d.setOpen(true); d.update(0.5); d.update(0.5); }
  const bs = lv.colliders().filter((b) => ((b.dynamic && b.active !== false) || (b.h !== undefined && b.h > 1.9) || (!b.dynamic && b.h === undefined)));
  console.log(`\n--- ${floor.name} (rows north->south; # blocked, . free) ---`);
  for (let j = H - 1; j >= 0; j--) {
    let l = '';
    for (let i = 0; i < W; i++) l += pointFree(X0 + i + 0.5, Z0 + j + 0.5, PLAYER_RADIUS, bs) ? '.' : '#';
    console.log(`  z${String(Z0 + j + 1).padStart(3)} ${l}`);
  }
}

if (process.env.WALK) {
  const [lv, a, b] = process.env.WALK.split('|');
  const level = world.levels[Number(lv)];
  for (const d of level.doors.values()) { d.setOpen(true); d.update(0.5); d.update(0.5); }
  const boxes = level.colliders().filter((x) => !((x.h !== undefined && x.h <= 1.9)));
  let [x, z] = a.split(',').map(Number);
  const [tx, tz] = b.split(',').map(Number);
  let steps = 0;
  while (steps++ < 4000) {
    const dx = tx - x;
    const dz = tz - z;
    const d = Math.hypot(dx, dz);
    if (d < 0.2) break;
    const r = moveWithCollision(x, z, (dx / d) * 0.15, (dz / d) * 0.15, PLAYER_RADIUS, boxes);
    if (Math.abs(r.x - x) < 1e-6 && Math.abs(r.z - z) < 1e-6) {
      // try sliding around the blocker
      const alt = moveWithCollision(x, z, (dz / d) * 0.15, (-dx / d) * 0.15, PLAYER_RADIUS, boxes);
      if (Math.abs(alt.x - x) < 1e-6 && Math.abs(alt.z - z) < 1e-6) break;
      x = alt.x;
      z = alt.z;
    } else {
      x = r.x;
      z = r.z;
    }
  }
  console.log(`\nWALK level ${lv} (${a}) -> (${b}): reached in ${steps} steps at (${x.toFixed(2)},${z.toFixed(2)}) ${Math.hypot(tx - x, tz - z) < 0.3 ? '✓' : '✗ blocked'}`);
}



process.exit(fail ? 1 : 0);
