// ---------------------------------------------------------------------------
// World builder: turns the declarative map data into three stacked level
// groups, each with its own colliders, doors, lights and prop layout.
//
//   world.setLevel(i)     show one level, hide the others
//   world.colliders(i)    AABB list for movement + AI
//   world.doors           { id: { open(), close(), locked, ... } }
//   world.fixtures        lights, with per-fixture flicker
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { FLOOR_H, WT, WALL_H, DOOR_H, DOOR_W, COLORS } from '../constants.js';
import { getTextures, wallMaterial, floorMaterial, addBox, box, lambert } from './geometry.js';
import {
  makeClassroom, makeBlackboard, makeLockers, makeShelves, makeLabBench, makeDeskOffice,
  makeGenerator, makeTeacherDesk, makeCrate, makeRubble, makeStairRun, makeBookcase, makeChair, rectBox, transformBox,
} from './props.js';
import { FlowField } from '../core/collision.js';
import { canvasTexture, chalkText, rand, randRange, grain } from '../utils.js';

const DOOR_T = 0.1;

export class Door {
  constructor(def, level, group) {
    this.id = def.id;
    this.level = level;
    this.axis = def.axis || 'x';
    this.w = def.w || DOOR_W;
    this.open = false;
    this.locked = def.locked || null;
    this.openFrac = 0;
    this.swing = def.swing ?? 1;
    this.hidden = false;
    this.special = !!def.special;
    this.name = def.name || 'door';

    const pivot = new THREE.Group();
    pivot.position.set(def.x, 0, def.z);
    if (this.axis === 'z') pivot.rotation.y = Math.PI / 2;
    group.add(pivot);
    this.pivot = pivot;

    const leafMat = lambert(def.special ? 0x2a1a12 : COLORS.door, { emissive: 0x0a0603 });
    const leaf = new THREE.Group();
    leaf.position.x = -this.w / 2;
    pivot.add(leaf);
    const mesh = new THREE.Mesh(box(this.w, DOOR_H, DOOR_T), leafMat);
    mesh.position.x = this.w / 2;
    mesh.position.y = DOOR_H / 2;
    leaf.add(mesh);
    // handle
    const handle = new THREE.Mesh(box(0.16, 0.06, 0.06), lambert(0x9a8b5a, { emissive: 0x1a1406 }));
    handle.position.set(this.w - 0.18, 1.05, 0.09);
    leaf.add(handle);
    this.leaf = leaf;
    this.mesh = mesh;

    // door frame
    const frameMat = lambert(0x22262c);
    for (const s of [-1, 1]) {
      const jamb = new THREE.Mesh(box(0.14, DOOR_H + 0.3, WT + 0.06), frameMat);
      jamb.position.set(def.x + (this.axis === 'x' ? s * (this.w / 2 + 0.07) : 0), (DOOR_H + 0.3) / 2, def.z + (this.axis === 'z' ? s * (this.w / 2 + 0.07) : 0));
      group.add(jamb);
    }
    const lintel = new THREE.Mesh(box(this.axis === 'x' ? this.w + 0.3 : WT + 0.06, 0.22, this.axis === 'x' ? WT + 0.06 : this.w + 0.3), frameMat);
    lintel.position.set(def.x, DOOR_H + 0.11, def.z);
    group.add(lintel);

    this.collider = {
      minx: this.axis === 'x' ? def.x - this.w / 2 : def.x - WT / 2 - 0.02,
      maxx: this.axis === 'x' ? def.x + this.w / 2 : def.x + WT / 2 + 0.02,
      minz: this.axis === 'z' ? def.z - this.w / 2 : def.z - WT / 2 - 0.02,
      maxz: this.axis === 'z' ? def.z + this.w / 2 : def.z + WT / 2 + 0.02,
      dynamic: true,
      label: `door:${def.id}`,
    };
    level.staticBoxes.push(this.collider);
    level.anchors.push({ kind: 'door', id: def.id, x: def.x, z: def.z, level: level.index });
  }

  setOpen(v) {
    if (this.open === v) return false;
    this.open = v;
    return true;
  }

  update(dt) {
    const target = this.open ? 1 : 0;
    if (Math.abs(this.openFrac - target) < 0.001) {
      this.openFrac = target;
      return;
    }
    this.openFrac += Math.sign(target - this.openFrac) * Math.min(Math.abs(target - this.openFrac), dt * 1.5);
    this.pivot.rotation.y = (this.axis === 'z' ? Math.PI / 2 : 0) + this.swing * this.openFrac * 1.3;
    this.collider.active = this.openFrac < 0.55;
  }
}

export class Fixture {
  constructor(def, level, group, y) {
    this.id = def.id;
    this.x = def.x;
    this.z = def.z;
    this.kind = def.kind || 'tube';
    this.group = def.group || 'room';
    this.on = false;
    this.enabled = true; // level/story gating
    this.flicker = 0; // 0 = rock steady, 1 = badly broken
    this.noise = randRange(0, 6.28);

    const glowMat = new THREE.MeshBasicMaterial({ color: 0x0b0d10, transparent: true, opacity: 0.95 });
    if (this.kind === 'tube') {
      this.mesh = new THREE.Mesh(box(1.5, 0.08, 0.24), glowMat);
      this.mesh.position.set(this.x, y + WALL_H - 0.12, this.z);
      const cage = new THREE.Mesh(box(1.62, 0.05, 0.34), lambert(0x1b1f24));
      cage.position.set(this.x, y + WALL_H - 0.04, this.z);
      group.add(cage);
    } else {
      this.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), glowMat);
      this.mesh.position.set(this.x, y + WALL_H - 0.35, this.z);
      const cord = new THREE.Mesh(box(0.03, 0.4, 0.03), lambert(0x191c20));
      cord.position.set(this.x, y + WALL_H - 0.15, this.z);
      group.add(cord);
    }
    this.mat = glowMat;
    group.add(this.mesh);

    this.light = new THREE.PointLight(this.kind === 'tube' ? 0xbfd4ff : 0xffca87, 0, this.kind === 'tube' ? 11 : 7.5, 1.7);
    this.light.position.set(this.x, y + WALL_H - 0.45, this.z);
    this.light.visible = false;
    level.group.add(this.light);
  }

  /** intensity 0..1 after flicker noise */
  level(now, t) {
    if (!this.on || !this.enabled) return 0;
    if (this.flicker <= 0) return 1;
    const n =
      0.55 +
      0.45 * Math.sin(t * 11 + this.noise) * Math.sin(t * 3.3 + this.noise * 2) +
      (Math.sin(t * 47 + this.noise) > 0.9 - this.flicker * 0.4 ? -this.flicker * 0.85 : 0);
    return Math.max(0, n);
  }

  applyVisual(now, t) {
    const v = this.level(now, t);
    const c = this.kind === 'tube' ? [0.75, 0.85, 1.0] : [1.0, 0.8, 0.55];
    this.mat.color.setRGB(c[0] * v * 0.9 + 0.02, c[1] * v * 0.9 + 0.02, c[2] * v * 0.9 + 0.03);
    this.mat.opacity = 0.35 + 0.6 * v;
    return v;
  }
}

export class Level {
  constructor(index, def) {
    this.index = index;
    this.def = def;
    this.group = new THREE.Group();
    this.group.position.y = index * FLOOR_H;
    this.staticBoxes = [];
    this.doors = new Map();
    this.fixtures = [];
    this.anchors = []; // interaction anchors
    this.boxes = null;
    this.flow = new FlowField({ minX: -25, maxX: 25, minZ: -9, maxZ: 9, cell: 1 });
  }

  colliders() {
    return this.boxes || this.staticBoxes;
  }
}

export class World {
  constructor(scene, floors) {
    this.scene = scene;
    this.floors = floors;
    this.levels = [];
    this.allDoors = new Map();
    this.gateLeaves = [];
    this.gateBolts = [];
    this.gateCollider = null;
    this.gateGroup = null;
    this.allFixtures = [];
    this.levelIndex = 0;
    this.shadowLights = [];
    this.ready = false;
  }

  async build() {
    await getTextures();
    for (const def of this.floors) {
      const level = new Level(def.index, def);
      await this.buildLevel(level, def);
      this.levels.push(level);
      this.scene.add(level.group);
    }
    this.setLevel(0);
    this.ready = true;
    return this;
  }

  async buildLevel(level, def) {
    const g = level.group;
    const yBase = 0; // group is already offset by index*FLOOR_H
    const basement = !!def.basement;

    // ---- the schoolyard (ground floor only) --------------------------------
    if (def.index === 0) {
      const yard = new THREE.Mesh(new THREE.PlaneGeometry(60, 12), floorMaterial('concrete'));
      yard.rotation.x = -Math.PI / 2;
      yard.position.set(0, -0.01, -14.4);
      g.add(yard);
      const yardWallMat = wallMaterial(false);
      const seg = (x0, x1, z0, z1) => {
        const m = new THREE.Mesh(box(x1 - x0, 2.6, z1 - z0), yardWallMat);
        m.position.set((x0 + x1) / 2, 1.3, (z0 + z1) / 2);
        g.add(m);
        level.staticBoxes.push({ minx: x0, maxx: x1, minz: z0, maxz: z1, h: 2.6 });
      };
      seg(-30, -1.6, -20.2, -20);
      seg(6.6, 30, -20.2, -20);
      seg(-30, -28.2, -20, -8.2);
      seg(28.2, 30, -20, -8.2);
      for (let i = 0; i < 9; i++) {
        const pole = new THREE.Mesh(box(0.12, 2.4, 0.12), lambert(0x2f353c));
        pole.position.set(-24 + i * 6, 1.2, -14 - (i % 2) * 3);
        g.add(pole);
      }
    }

    // ---- floors / ceiling -------------------------------------------------
    const fmat = basement ? floorMaterial('concrete') : floorMaterial(basement ? 'concrete' : 'tiles');
    const woodFloor = floorMaterial('wood');
    for (const room of def.rooms) {
      const rect = room.rect;
      const w = rect.x1 - rect.x0;
      const d = rect.z1 - rect.z0;
      const isClass = room.props === 'classroom' || room.props === 'secret';
      const fm = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        isClass ? woodFloor.clone() : fmat.clone()
      );
      fm.rotation.x = -Math.PI / 2;
      fm.position.set((rect.x0 + rect.x1) / 2, 0.002, (rect.z0 + rect.z1) / 2);
      fm.receiveShadow = false;
      g.add(fm);
      if (isClass && fm.material.map) {
        fm.material.map = fm.material.map.clone();
        fm.material.map.needsUpdate = true;
        fm.material.map.repeat.set(Math.max(1, w / 6), Math.max(1, d / 6));
      }
      // ceiling
      const cm = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lambert(basement ? 0x101317 : 0x22262c));
      cm.rotation.x = Math.PI / 2;
      cm.position.set((rect.x0 + rect.x1) / 2, WALL_H + 0.4, (rect.z0 + rect.z1) / 2);
      g.add(cm);
    }

    // ---- walls -----------------------------------------------------------
    this.gateDef = def.gate || null;
    const outerMat = wallMaterial(false);
    const innerMat = wallMaterial(true);
    for (const run of def.runs) {
      const doorsHere = (run.door || []).map((d) => ({ x: d.x, w: d.w || DOOR_W }));
      const isOuter =
        (run.k === 'H' && Math.abs(Math.abs(run.z) - 8.35) < 0.05) ||
        (run.k === 'V' && Math.abs(Math.abs(run.x) - 24.5) < 0.05);
      const mat2 = isOuter ? outerMat : innerMat;
      if (run.gate && this.gateDef) {
        doorsHere.push({ x: this.gateDef.x, w: this.gateDef.w });
      }
      if (run.k === 'H') {
        const z0 = run.z - WT / 2;
        const z1 = run.z + WT / 2;
        let x = run.x0;
        const sorted = doorsHere.slice().sort((a, b) => a.x - b.x);
        for (const d of sorted) {
          this.wallSeg(g, level, mat2, x, d.x - d.w / 2, z0, z1, yBase, WALL_H);
          x = d.x + d.w / 2;
          // transom above the door
          this.wallSeg(g, level, mat2, d.x - d.w / 2, d.x + d.w / 2, z0, z1, yBase + DOOR_H, 0.4);
        }
        this.wallSeg(g, level, mat2, x, run.x1, z0, z1, yBase, WALL_H);
      } else {
        const x0 = run.x - WT / 2;
        const x1 = run.x + WT / 2;
        let z = run.z0;
        const sorted = doorsHere.slice().sort((a, b) => a.z - b.z);
        for (const d of sorted) {
          this.wallSeg(g, level, mat2, x0, x1, z, d.z - d.w / 2, yBase, WALL_H);
          z = d.z + d.w / 2;
          this.wallSeg(g, level, mat2, x0, x1, d.z - d.w / 2, d.z + d.w / 2, yBase + DOOR_H, 0.4);
        }
        this.wallSeg(g, level, mat2, x0, x1, z, run.z1, yBase, WALL_H);
      }
    }

    // ---- doors -----------------------------------------------------------
    for (const d of def.doors || []) {
      const door = new Door(d, level, g);
      level.doors.set(d.id, door);
      this.allDoors.set(`${def.index}:${d.id}`, door);
    }

    // ---- lights --------------------------------------------------------
    for (const room of def.rooms) {
      const list = room.lights === 'auto' ? this.autoCorridorLights(room) : room.lights || [];
      for (let i = 0; i < list.length; i++) {
        const f = new Fixture({ id: `f${def.index}_${room.id}_${i}`, x: list[i][0], z: list[i][1], kind: basement ? 'bulb' : 'tube', group: room.id === 'lobby' ? 'corridor' : 'room' }, level, g, 0);
        f.flicker = rand() < (basement ? 0.75 : 0.25) ? randRange(0.35, 0.9) : 0;
        level.fixtures.push(f);
        this.allFixtures.push(f);
      }
    }
    if (def.index === 2) {
      // final classroom gets one steady bulb; everything else stays dead
      for (const f of level.fixtures) f.enabled = false;
    }

    // ---- props ----------------------------------------------------------
    this.buildProps(level, def, g);

    // ---- signs ----------------------------------------------------------
    for (const s of def.signs || []) {
      const tex = await this.makeSign(s.text, s.big, s.small);
      const w = s.big ? 3.4 : Math.min(2.6, 0.28 * s.text.length * 0.55 + 0.5);
      const h = s.big ? 1.1 : 0.42;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex, transparent: true }));
      m.position.set(s.x, s.big ? 1.9 : 2.55, s.z);
      m.rotation.y = s.face === 'e' ? Math.PI / 2 : s.face === 'w' ? -Math.PI / 2 : s.face === 's' ? Math.PI : 0;
      g.add(m);
    }

    // ---- the main gate: the run marked `gate` is an opening, not a wall ---
    if (def.gate) {
      const g2 = new THREE.Group();
      const bar = new THREE.BoxGeometry(0.09, 2.5, 0.09);
      const iron = lambert(0x4a5158, { emissive: 0x080a0c });
      for (const side of [-1, 1]) {
        const leaf = new THREE.Group();
        leaf.position.set(def.gate.x + (side * def.gate.w) / 2, 0, def.gate.z);
        for (let i = 0; i < 5; i++) {
          const m = new THREE.Mesh(bar, iron);
          m.position.set(-side * (0.16 + i * 0.3), 1.25, 0);
          leaf.add(m);
        }
        for (const yy of [0.35, 2.2]) {
          const rail = new THREE.Mesh(box(def.gate.w / 2, 0.09, 0.09), iron);
          rail.position.set((-side * def.gate.w) / 4, yy, 0);
          leaf.add(rail);
        }
        g2.add(leaf);
        this.gateLeaves.push(leaf);
      }
      // bolts (throw when the school locks you in)
      this.gateBolts = [];
      for (const side of [-1, 1]) {
        const bolt = new THREE.Mesh(box(0.5, 0.1, 0.1), lambert(0x8e5a3a, { emissive: 0x1a0803 }));
        bolt.position.set(def.gate.x + side * 0.45, 1.15, def.gate.z + 0.12);
        bolt.rotation.z = side * 0.9;
        g2.add(bolt);
        this.gateBolts.push(bolt);
      }
      g.add(g2);
      this.gateGroup = g2;
      this.gateCollider = { minx: def.gate.x - def.gate.w / 2, maxx: def.gate.x + def.gate.w / 2, minz: def.gate.z - 0.16, maxz: def.gate.z + 0.16, dynamic: true, active: true, label: 'gate' };
      level.staticBoxes.push(this.gateCollider);
    }

    this.gateDef = null;
    level.boxes = level.staticBoxes.slice();
    level.flow.setBlockedFromBoxes(level.boxes);
  }

  autoCorridorLights(room) {
    const out = [];
    for (let i = 0; i < 9; i++) out.push([-21 + (42 / 8) * i, 0]);
    return out;
  }

  /**
   * One wall strip. Horizontal runs: a0/a1 = x, b0/b1 = z.
   * Vertical runs: the caller passes a0/a1 = x (thin) and b0/b1 = z (long),
   * which is the same box — only the iteration axis differs.
   */
  wallSeg(g, level, material, a0, a1, b0, b1, y, h) {
    if (a1 - a0 <= 0.02 || b1 - b0 <= 0.02 || h <= 0.02) return;
    const mesh = new THREE.Mesh(box(a1 - a0, h, b1 - b0), material);
    mesh.position.set((a0 + a1) / 2, y + h / 2, (b0 + b1) / 2);
    g.add(mesh);
    if (h > 1.2) level.staticBoxes.push({ minx: a0, maxx: a1, minz: b0, maxz: b1, y, h });
  }

  async makeSign(text, big, small) {
    const w = big ? 640 : 384;
    const h = big ? 220 : 88;
    return canvasTexture(w, h, (ctx) => {
      ctx.fillStyle = big ? 'rgba(120,20,20,0.85)' : 'rgba(18,22,28,0.92)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(230,235,240,0.35)';
      ctx.lineWidth = 4;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = big ? 'rgba(240,240,235,0.95)' : 'rgba(225,232,240,0.9)';
      ctx.font = `${big ? 40 : small ? 24 : 30}px 'Segoe Print', cursive`;
      const lines = text.split('\n');
      lines.forEach((ln, i) => ctx.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * (big ? 46 : 32)));
    }, THREE);
  }

  buildProps(level, def, g) {
    const pushNoCollide = (res, x, z, rotY = 0) => {
      const node = res.isObject3D ? res : res.group;
      node.position.set(x, 0, z);
      node.rotation.y = rotY;
      g.add(node);
    };
    const push = (res, x, z, rotY = 0) => {
      const node = res.isObject3D ? res : res.group;
      node.position.set(x, 0, z);
      node.rotation.y = rotY;
      g.add(node);
      for (const c of res.colliders || []) {
        level.staticBoxes.push({
          minx: Math.min(c.minx, c.maxx) + x,
          maxx: Math.max(c.minx, c.maxx) + x,
          minz: Math.min(c.minz, c.maxz) + z,
          maxz: Math.max(c.minz, c.maxz) + z,
          prop: true,
        });
      }
    };
    for (const room of def.rooms) {
      const rect = room.rect;
      const rect2 = { ...rect, w: rect.x1 - rect.x0, d: rect.z1 - rect.z0, cx: (rect.x0 + rect.x1) / 2, cz: (rect.z0 + rect.z1) / 2 };
      switch (room.props) {
        case 'classroom': {
          // the bay divider carries a door into the entrance hall: keep that lane clear
          const res = makeClassroom(rect2, { flip: rect.cz < 0, avoidX: room.id === 'c1' ? -1.5 : undefined });
          push(res, 0, 0);
          const bb = makeBlackboard(Math.min(4.6, rect2.w - 3));
          // classroom boards sit on the wall the desks face
          bb.position.set(rect2.cx, 0, rect2.z1 - 0.22);
          g.add(bb);
          break;
        }
        case 'library': {
          for (let i = 0; i < 4; i++) {
            const res = makeShelves(4);
            push(res, rect2.x0 + 1.5 + i * 2.5, rect2.z0 + 2.4 + (i % 2) * 2.9, 0);
          }
          const t = makeDeskOffice();
          push(t, rect2.cx, rect2.cz - 0.6);
          break;
        }
        case 'lab': {
          for (let i = 0; i < 2; i++) {
            const res = makeLabBench();
            push(res, rect2.cx - 1.0 + i * 2.0, rect2.z0 + 2.6 + i * 2.4);
          }
          break;
        }
        case 'office': {
          // desk against the outer wall so the doorway lane stays clear
          const dz = rect.cz > 0 ? rect2.z1 - 1.6 : rect2.z0 + 1.6;
          const res = makeDeskOffice();
          push(res, rect2.cx + 0.9, dz);
          const c = makeChair();
          c.position.set(rect2.cx + 0.9, 0, dz + (rect.cz > 0 ? -1.0 : 1.0));
          c.rotation.y = rect.cz > 0 ? 0 : Math.PI;
          g.add(c);
          const shelf = new THREE.Mesh(box(1.8, 1.9, 0.4), lambert(0x3a2c20));
          shelf.position.set(rect2.x0 + 1.4, 0.95, rect.cz > 0 ? rect2.z1 - 0.4 : rect2.z0 + 0.4);
          g.add(shelf);
          break;
        }
        case 'storage': {
          for (let i = 0; i < 4; i++) {
            const res = makeCrate();
            push(res, i % 2 ? rect2.x1 - 1.1 : rect2.x0 + 1.1, rect2.z0 + 1.9 + i * 1.6, randRange(0, 1));
          }
          break;
        }
        case 'utility': {
          if (room.id === 'gen') {
            const res = makeGenerator();
            push(res, 12.6, -6.4);
            g.userData.genWheel = res.group.userData.wheel;
            const panel = new THREE.Mesh(box(0.9, 1.2, 0.16), lambert(0x3a2b2b));
            panel.position.set(7.0, 1.3, -5.3);
            g.add(panel);
          } else {
            // fuse panels flat on the wall — deliberately no colliders so a
            // service room can never pinch off the doorway
            for (let i = 0; i < 3; i++) {
              const fuse = new THREE.Mesh(box(0.7, 1.1, 0.14), lambert(0x3b2f2a));
              fuse.position.set(rect2.x0 + 1.4 + i * 0.9, 1.35, rect.cz > 0 ? rect2.z1 - 0.25 : rect2.z0 + 0.25);
              g.add(fuse);
            }
          }
          break;
        }
        case 'hall': {
          // visitor bench + a rope stanchion near the gate
          const bench = new THREE.Mesh(box(2.2, 0.45, 0.5), lambert(0x4a3a28));
          bench.position.set(rect2.x0 + 1.4, 0.225, rect2.cz - 0.6);
          g.add(bench);
          const res = makeRubble();
          push(res, rect2.x0 + 1.1, rect2.z1 - 1.1);
          break;
        }
        case 'final': {
          // 4 chairs + 1 teacher desk + blackboard — the Last Period. The board
          // is on the room's far wall (the side away from the corridor).
          const far = rect2.d > 0 ? (room.rect.z1 > 1 ? rect2.z1 : rect2.z0) : rect2.z0;
          const near = room.rect.z1 > 1 ? rect2.z1 - 1.1 : rect2.z0 + 0.85;
          const td = makeTeacherDesk();
          push(td, rect2.cx, near);
          level.teacherDesk = [rect2.cx, near];
          for (let i = 0; i < 5; i++) {
            const c = makeChair();
            const cz = room.rect.z1 > 1 ? rect2.z0 + 1.8 + (i % 2) * 0.7 : rect2.z1 - 1.8 - (i % 2) * 0.7;
            c.position.set(rect2.x0 + 0.9 + i * ((rect2.w - 1.8) / 4), 0, cz);
            c.rotation.y = room.rect.z1 > 1 ? 0 : Math.PI;
            g.add(c);
            if (i === 4) level.finalChair = c;
          }
          const bb = makeBlackboard(rect2.w - 2);
          bb.position.set(rect2.cx, 0, room.rect.z1 > 1 ? far - 0.22 : far + 0.22);
          g.add(bb);
          level.blackboardTex = null;
          level.finalBlackboard = bb;
          break;
        }
        case 'secret': {
          // the room with no number: chalk marks, and the way out again
          const res = makeRubble();
          push(res, rect2.x0 + 1.3, rect2.z0 + 1.4);
          const res2 = makeShelves(3);
          push(res2, rect2.cx + 0.4, rect2.z0 + 0.45);
          break;
        }
        case 'stair': {
          const dir = level.index === 2 ? -1 : 1;
          const res = makeStairRun(3.6, 4.4, 14, dir);
          push(res, 21.2, 6.0, 0);
          break;
        }
        case 'corridor':
        case 'basement': {
          // lockers hug the ROOM side of the corridor wall so the walkway
          // (|z| < 1.35) is never blocked. Visual only: no colliders, so a
          // row of lockers can never trap the player or the monster.
          for (let i = 0; i < 8; i++) {
            const x = -22 + i * 6.1;
            if (Math.abs(x - 2.5) < 3) continue;
            const res = makeLockers(3);
            pushNoCollide(res, x, 1.57, 0);
            const res2 = makeLockers(3);
            pushNoCollide(res2, x + 3.05, -1.57, Math.PI);
          }
          if (level.index === 2) {
            for (let i = 0; i < 10; i++) {
              const res = makeRubble();
              push(res, -20 + i * 4.5, randRange(-0.8, 0.8));
            }
          }
          break;
        }
        case 'back': {
          // the way down: a bookcase over a hole with a ladder in it
          const bc = makeBookcase(2.6);
          bc.group.position.set(rect2.cx - 2.0, 0, rect2.z0 + 0.3);
          g.add(bc.group);
          level.staticBoxes.push({ ...rectBox(rect2.cx - 2.0, rect2.z0 + 0.3, 1.65, 0.5), bookcase: true });
          level.bookcase = bc.group;
          const frame = new THREE.Mesh(box(1.3, 0.12, 1.3), lambert(0x2a2f36));
          frame.position.set(rect2.cx + 0.6, 0.06, rect2.z1 - 1.6);
          g.add(frame);
          const rungMat = lambert(0x545c66);
          for (let i = 0; i < 7; i++) {
            const rung = new THREE.Mesh(box(1.05, 0.05, 0.06), rungMat);
            rung.position.set(rect2.cx + 0.6, 0.14 + i * 0.42, rect2.z1 - 1.6 + 0.55);
            g.add(rung);
          }
          const rail = new THREE.Mesh(box(1.25, 1.0, 0.07), lambert(0x1d2228));
          rail.position.set(rect2.cx + 0.6, 0.5, rect2.z1 - 1.6 - 0.62);
          g.add(rail);
          break;
        }
        case 'hidden':
        default: {
          if (rand() > 0.4) {
            const res = makeRubble();
            push(res, rect2.cx + (rect2.w / 2 - 1.4) * (rand() > 0.5 ? 1 : -1), rect2.cz - 2.2);
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------------
  setLevel(i) {
    this.levelIndex = i;
    this.levels.forEach((l, k) => (l.group.visible = k === i));
  }

  /** open=false -> bars across the doorway + collision */
  setGateOpen(open) {
    if (this.gateCollider) this.gateCollider.active = !open;
    if (this.gateBolts.length) this.gateBolts.forEach((b, i) => (b.rotation.z = open ? (i ? 1.5 : -1.5) : (i ? 0.9 : -0.9)));
    const leaves = this.gateLeaves;
    if (leaves.length === 2) {
      leaves[0].rotation.y = open ? -1.5 : 0;
      leaves[1].rotation.y = open ? 1.5 : 0;
    }
    this.gateOpen = !!open;
  }

  door(levelIdx, id) {
    return this.allDoors.get(`${levelIdx}:${id}`);
  }

  openDoor(levelIdx, id, v = true) {
    const d = this.door(levelIdx, id);
    if (d) return d.setOpen(v);
    return false;
  }

  update(dt, t) {
    const level = this.levels[this.levelIndex];
    for (const l of this.levels) {
      if (!l.group.visible) continue;
      for (const d of l.doors.values()) d.update(dt);
    }
    return level;
  }

  /** light level 0..1 at a world position on the current level (for fear/dialogue) */
  illumination(x, z, t) {
    const level = this.levels[this.levelIndex];
    let v = 0;
    for (const f of level.fixtures) {
      const dx = f.x - x;
      const dz = f.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 169) continue;
      v += f.level(t, t) / (1 + d2 * 0.1);
    }
    return Math.min(1, v);
  }

  /** activate the nearest few real point lights on the visible level */
  refreshLights(pos, maxLights = 7) {
    const level = this.levels[this.levelIndex];
    const scored = [];
    for (const f of level.fixtures) {
      const dx = f.x - pos.x;
      const dz = f.z - pos.z;
      scored.push([dx * dx + dz * dz, f]);
    }
    scored.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < scored.length; i++) {
      const f = scored[i][1];
      const use = i < maxLights;
      f.light.visible = use;
      f.light.castShadow = false;
      f.light.__on = use;
    }
    return level;
  }

  roomAt(x, z, levelIdx = this.levelIndex) {
    const level = this.levels[levelIdx];
    for (const room of level.def.rooms) {
      const r = room.rect;
      if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return room;
    }
    return null;
  }

  roomName(x, z, levelIdx = this.levelIndex) {
    const r = this.roomAt(x, z, levelIdx);
    return r ? `${r.name} · ${this.levels[levelIdx].def.name}` : this.levels[levelIdx].def.name;
  }

  /** apply current flicker to meshes and drive real light intensity */
  tickLights(t) {
    const level = this.levels[this.levelIndex];
    for (const f of level.fixtures) {
      const v = f.applyVisual(t, t);
      if (f.light.__on !== false) f.light.intensity = v * (f.kind === 'tube' ? 1.55 : 0.95);
    }
    for (const l of this.levels) {
      if (l === level) continue;
      for (const f of l.fixtures) f.applyVisual(t, t);
    }
  }
}
