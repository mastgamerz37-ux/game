// ---------------------------------------------------------------------------
// Prop factory. Everything here is built from primitives, so that a real
// .glb/.fbx/.obj can be swapped in later by just replacing one group.
// Each builder returns { group, colliders } — colliders are world-space AABBs
// (already translated relative to the group's position) so props block movement.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { COLORS } from '../constants.js';
import { addBox, box, lambert } from './geometry.js';
import { rand, randRange } from '../utils.js';

const DESK_TOP = 0.76;

export function makeDesk(material) {
  const g = new THREE.Group();
  addBox(g, { x: 0, y: DESK_TOP, z: 0, w: 0.62, h: 0.06, d: 0.46, material: material || lambert(COLORS.desk) });
  for (const sx of [-0.26, 0.26]) {
    for (const sz of [-0.18, 0.18]) {
      addBox(g, { x: sx, y: 0, z: sz, w: 0.05, h: DESK_TOP, d: 0.05, material: lambert(COLORS.metal) });
    }
  }
  addBox(g, { x: 0, y: 0.2, z: -0.02, w: 0.56, h: 0.04, d: 0.4, material: lambert(0x46362a) });
  return g;
}

export function makeChair(material) {
  const g = new THREE.Group();
  addBox(g, { x: 0, y: 0.44, z: 0, w: 0.4, h: 0.05, d: 0.4, material: material || lambert(COLORS.desk) });
  addBox(g, { x: 0, y: 0.49, z: -0.19, w: 0.4, h: 0.42, d: 0.05, material: material || lambert(COLORS.desk) });
  for (const sx of [-0.16, 0.16]) for (const sz of [-0.16, 0.16]) {
    addBox(g, { x: sx, y: 0, z: sz, w: 0.05, h: 0.44, d: 0.05, material: lambert(COLORS.metal) });
  }
  return g;
}

/** classroom grid: rows of desks facing the blackboard (which sits at +z wall) */
export function makeClassroom(rect, opts = {}) {
  const g = new THREE.Group();
  const colliders = [];
  const wood = lambert(COLORS.desk);
  const rows = 3;
  const cols = Math.max(2, Math.floor(rect.w / 2.4));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const x = rect.x0 + 1.7 + j * 2.4;
      const z = rect.z0 + 2.3 + i * 1.8;
      if (x > rect.x1 - 1.5 || z > rect.z1 - 1.5) continue;
      // never park a desk in front of a doorway (opts.avoidX / avoidZ)
      if (opts.avoidX !== undefined && Math.abs(x - opts.avoidX) < 1.4) continue;
      if (opts.avoidZ !== undefined && Math.abs(z - opts.avoidZ) < 1.4) continue;
      const d = makeDesk(wood);
      d.position.set(x, 0, z);
      d.rotation.y = opts.flip ? Math.PI : 0;
      g.add(d);
      colliders.push(rectBox(x, z, 0.7, 0.5));
      if (rand() > 0.55) {
        const c = makeChair(wood);
        c.position.set(x, 0, z + (opts.flip ? -0.72 : 0.72));
        c.rotation.y = randRange(-0.4, 0.4) + (opts.flip ? Math.PI : 0);
        if (rand() > 0.85) {
          c.rotation.z = Math.PI / 2;
          c.position.y = 0.2;
        }
        g.add(c);
      }
    }
  }
  // teacher desk at the front of the room
  addBox(g, { x: rect.cx, y: 0, z: rect.z1 - 1.35, w: 1.6, h: 0.8, d: 0.7, material: lambert(0x4a3a28) });
  colliders.push(rectBox(rect.cx, rect.z1 - 1.35, 1.7, 0.8));
  return { group: g, colliders };
}

export function makeBlackboard(width = 4.2) {
  const g = new THREE.Group();
  addBox(g, { x: 0, y: 1.0, z: 0, w: width, h: 1.45, d: 0.08, material: lambert(0x1a2a20) });
  addBox(g, { x: 0, y: 0.94, z: 0.06, w: width - 0.16, h: 1.28, d: 0.02, material: lambert(0x203528, { emissive: 0x07120b }) });
  addBox(g, { x: 0, y: 0.86, z: 0.1, w: width, h: 0.06, d: 0.14, material: lambert(COLORS.metal) });
  return g;
}

export function makeLockers(count = 4) {
  const g = new THREE.Group();
  const colliders = [];
  const metal = lambert(0x3d4854);
  for (let i = 0; i < count; i++) {
    const x = i * 0.62;
    addBox(g, { x, y: 0, z: 0, w: 0.6, h: 1.8, d: 0.42, material: metal });
    addBox(g, { x, y: 1.5, z: 0.22, w: 0.5, h: 0.03, d: 0.02, material: lambert(0x2a333c) });
    colliders.push(rectBox(x, 0, 0.62, 0.44));
  }
  return { group: g, colliders };
}

export function makeShelves(rows = 4) {
  const g = new THREE.Group();
  const colliders = [];
  const wood = lambert(0x4b3a29);
  for (let i = 0; i < rows; i++) {
    addBox(g, { x: 0, y: 0.35 + i * 0.5, z: 0, w: 2.4, h: 0.06, d: 0.5, material: wood });
    for (let k = 0; k < 9; k++) {
      if (rand() > 0.35) {
        const h = randRange(0.16, 0.3);
        addBox(g, { x: -1.05 + k * 0.25, y: 0.41 + i * 0.5, z: 0, w: 0.16, h, d: 0.36, material: lambert([0x6b3a34, 0x3a5568, 0x5c6b3a, 0x6b5c3a][k % 4]) });
      }
    }
  }
  addBox(g, { x: 0, y: 0, z: 0, w: 2.4, h: 0.35, d: 0.5, material: wood });
  colliders.push(rectBox(0, 0, 2.4, 0.55));
  return { group: g, colliders };
}

export function makeLabBench() {
  const g = new THREE.Group();
  const colliders = [];
  addBox(g, { x: 0, y: 0, z: 0, w: 3.4, h: 0.9, d: 0.9, material: lambert(0x2f3a3d) });
  addBox(g, { x: 0, y: 0.9, z: 0, w: 3.5, h: 0.06, d: 1.0, material: lambert(0x141a1c) });
  colliders.push(rectBox(0, 0, 3.5, 1.0));
  for (let i = 0; i < 5; i++) {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 10), new THREE.MeshLambertMaterial({ color: 0x9fc6c4, transparent: true, opacity: 0.42 }));
    jar.position.set(-1.3 + i * 0.65, 1.04, randRange(-0.2, 0.2));
    g.add(jar);
  }
  return { group: g, colliders };
}

export function makeDeskOffice() {
  const g = new THREE.Group();
  addBox(g, { x: 0, y: 0, z: 0, w: 2.0, h: 0.78, d: 0.9, material: lambert(0x3c2c1e) });
  addBox(g, { x: 0, y: 0.78, z: 0, w: 2.1, h: 0.06, d: 1.0, material: lambert(0x4a3626) });
  addBox(g, { x: 0.7, y: 0.2, z: 0.52, w: 0.6, h: 0.5, d: 0.05, material: lambert(0x2a1f16) });
  return { group: g, colliders: [rectBox(0, 0, 2.15, 1.05)] };
}

export function makeGenerator() {
  const g = new THREE.Group();
  const colliders = [];
  addBox(g, { x: 0, y: 0, z: 0, w: 2.2, h: 1.2, d: 1.1, material: lambert(0x3a4148) });
  addBox(g, { x: 0, y: 1.2, z: 0, w: 1.0, h: 0.4, d: 0.8, material: lambert(0x2c3238) });
  addBox(g, { x: -0.55, y: 1.6, z: 0, w: 0.22, h: 0.7, d: 0.22, material: lambert(0x4a4a4a) });
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 14), lambert(0x6b2a2a));
  wheel.position.set(0.75, 0.95, 0.6);
  g.add(wheel);
  colliders.push(rectBox(0, 0, 2.3, 1.2));
  g.userData.wheel = wheel;
  return { group: g, colliders };
}

export function makeTeacherDesk() {
  const g = new THREE.Group();
  addBox(g, { x: 0, y: 0, z: 0, w: 1.9, h: 0.85, d: 0.85, material: lambert(0x35261a) });
  addBox(g, { x: 0, y: 0.85, z: 0, w: 2.0, h: 0.07, d: 0.95, material: lambert(0x43301f) });
  return { group: g, colliders: [rectBox(0, 0, 2.0, 0.95)] };
}

export function makeCrate() {
  const g = new THREE.Group();
  addBox(g, { x: 0, y: 0, z: 0, w: 0.8, h: 0.7, d: 0.8, material: lambert(0x4a3d2b) });
  return { group: g, colliders: [rectBox(0, 0, 0.85, 0.85)] };
}

export function makeRubble(seed = 1) {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const s = randRange(0.12, 0.4);
    addBox(g, { x: randRange(-0.9, 0.9), y: 0, z: randRange(-0.9, 0.9), w: s, h: s * 0.6, d: s, material: lambert(0x33373d), rotY: randRange(0, 3) });
  }
  return { group: g, colliders: [] };
}

export function makeStairRun(width, depth, steps, dir) {
  const g = new THREE.Group();
  const colliders = [];
  const mat2 = lambert(0x2e333a);
  for (let i = 0; i < steps; i++) {
    const h = ((i + 1) / steps) * 4.2;
    addBox(g, { x: 0, y: 0, z: (i / steps) * depth * dir, w: width, h, d: depth / steps + 0.02, material: mat2 });
  }
  // deliberately NO collider: the stair volume is a walk-on trigger (the game
  // fades you to the next level), so a closed/awkward stair geometry can never
  // trap the player.
  return { group: g, colliders };
}

export function makeBookcase(h = 2.4) {
  const g = new THREE.Group();
  addBox(g, { x: 0, y: 0, z: 0, w: 1.6, h, d: 0.4, material: lambert(0x3b2c1f) });
  for (let i = 0; i < 4; i++) {
    addBox(g, { x: 0, y: 0.3 + i * 0.5, z: 0.06, w: 1.5, h: 0.04, d: 0.3, material: lambert(0x2a1f16) });
    for (let k = 0; k < 6; k++) {
      addBox(g, { x: -0.6 + k * 0.24, y: 0.34 + i * 0.5, z: 0.06, w: 0.14, h: randRange(0.2, 0.34), d: 0.26, material: lambert([0x6b3a34, 0x3a5568, 0x5c6b3a][k % 3]) });
    }
  }
  return { group: g, colliders: [rectBox(0, 0, 1.6, 0.45)] };
}

export function makeLockerRow(count) {
  return makeLockers(count);
}

export function rectBox(x, z, w, d) {
  return { minx: x - w / 2, maxx: x + w / 2, minz: z - d / 2, maxz: z + d / 2 };
}

/** rotate an axis-aligned box around the group origin, then offset it */
export function transformBox(c, ox, oz, rotY) {
  const corners = [
    [c.minx, c.minz],
    [c.maxx, c.minz],
    [c.minx, c.maxz],
    [c.maxx, c.maxz],
  ].map(([x, z]) => [x * Math.cos(rotY) + z * Math.sin(rotY), -x * Math.sin(rotY) + z * Math.cos(rotY)]);
  const xs = corners.map((p) => p[0]);
  const zs = corners.map((p) => p[1]);
  const out = {
    minx: Math.min(...xs) + ox,
    maxx: Math.max(...xs) + ox,
    minz: Math.min(...zs) + oz,
    maxz: Math.max(...zs) + oz,
  };
  if (c.prop) out.prop = true;
  if (c.bookcase) out.bookcase = true;
  return out;
}
