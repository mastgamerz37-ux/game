// ---------------------------------------------------------------------------
// Actors: the three friends (follow AI), the shadow figure (staged scares)
// and the monster (flow-field chase AI). No combat anywhere: it is always
// RUN → HIDE → FIND → ESCAPE.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { PLAYER_RADIUS, FLOOR_H } from '../constants.js';
import { moveWithCollision, pointFree } from '../core/collision.js';
import { buildCharacter, makeLabel, placeholderRig } from './models.js';
import { CAST, GHOST } from '../data/characters.js';
import { clamp, damp, rand } from '../utils.js';
import { audio } from '../core/audio.js';

class Actor {
  constructor(def, scene) {
    this.def = def;
    this.node = new THREE.Group();
    this.node.position.set(0, 0, 0);
    scene.add(this.node);
    this.visual = null;
    this.yaw = 0;
    this.move = 0;
    this.animT = rand() * 10;
    this.vel = new THREE.Vector3();
    this.visible = true;
  }

  async attach(scene) {
    this.visual = await buildCharacter(this.def);
    this.node.add(this.visual);
    if (this.def.id !== 'ghost' && this.def.id !== 'player') {
      const label = await makeLabel(this.def.name, this.def.id === 'friend3' ? '#f1e0a8' : '#cfd9e8');
      this.node.add(label);
    }
    return this;
  }

  setPosition(x, z, level) {
    this.node.position.set(x, level * FLOOR_H, z);
  }

  face(yaw) {
    this.yaw = damp(this.yaw, yaw, 7, 1 / 60);
    this.node.rotation.y = this.yaw;
  }

  animate(dt) {
    this.animT += dt * (1 + this.move * 2.6);
    const ph = this.visual?.userData?.placeholder;
    if (this.visual?.userData?.mixer) this.visual.userData.mixer.update(dt * (0.7 + this.move));
    if (!ph) {
      if (this.visual) {
        // custom model: gentle breathing / walk bob, works with any mesh
        this.visual.rotation.z = Math.sin(this.animT * 1.6) * 0.02 * (1 - this.move);
        this.visual.position.y = Math.abs(Math.sin(this.animT * 6)) * 0.05 * this.move;
      }
      return;
    }
    const swing = Math.sin(this.animT * 7.2) * (0.12 + this.move * 0.75);
    const swing2 = Math.sin(this.animT * 7.2 + Math.PI) * (0.12 + this.move * 0.75);
    ph.userData.legL.rotation.x = swing;
    ph.userData.legR.rotation.x = swing2;
    ph.userData.armL.rotation.x = swing2 * 0.8;
    ph.userData.armR.rotation.x = swing * 0.8;
    ph.position.y = Math.abs(Math.sin(this.animT * 7.2)) * 0.035 * (0.25 + this.move);
    ph.rotation.z = Math.sin(this.animT * 3.3) * 0.018 * (1 - this.move * 0.5);
  }
}

export class Friends {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.ready = false;
  }

  async build() {
    for (const def of CAST.slice(1)) {
      const a = new Actor(def, this.scene);
      await a.attach(this.scene);
      a.home = { x: 0, z: 0 };
      a.jitter = rand() * 6.28;
      a.talkT = 0;
      this.list.push(a);
    }
    this.playerActor = new Actor(CAST[0], this.scene);
    await this.playerActor.attach(this.scene);
    this.ready = true;
    return this;
  }

  spawnAround(x, z, level) {
    const offs = [
      [1.3, 1.2],
      [-1.5, 1.0],
      [0.2, 2.1],
    ];
    this.list.forEach((a, i) => {
      const o = offs[i % offs.length];
      let px = x + o[0];
      let pz = z + o[1];
      const boxes = this.boxesFor(level);
      if (!pointFree(px, pz, 0.4, boxes)) {
        px = x;
        pz = z;
      }
      a.setPosition(px, pz, level);
    });
  }

  boxesFor(level) {
    return this.world ? this.world.levels[level].colliders() : [];
  }

  update(dt, t, player, world, opts = {}) {
    if (!this.ready) return;
    this.world = world;
    const boxes = world.levels[world.levelIndex].colliders();
    const keep = opts.keepDistance ?? 2.0;
    this.list.forEach((a, i) => {
      const dx = player.pos.x - a.node.position.x;
      const dz = player.pos.z - a.node.position.z;
      const d = Math.hypot(dx, dz);
      // drift a bit so they do not glue to one spot
      const wob = Math.sin(t * 0.35 + a.jitter) * 0.6;
      let tx = 0;
      let tz = 0;
      if (d > keep + 1.6) {
        tx = dx / d;
        tz = dz / d;
      } else if (d < keep - 0.5) {
        tx = -dx / d;
        tz = -dz / d;
      } else {
        tx = -dz / d * wob * 0.35;
        tz = dx / d * wob * 0.35;
      }
      const spd = opts.excited ? 4.4 : 1.55;
      const step = Math.min(d, 1) * spd * dt;
      const res = moveWithCollision(a.node.position.x, a.node.position.z, tx * step, tz * step, 0.3, boxes);
      const moved = Math.hypot(res.x - a.node.position.x, res.z - a.node.position.z);
      a.node.position.x = res.x;
      a.node.position.z = res.z;
      a.move = clamp(moved / dt / 2.2, 0, 1);
      a.node.position.y = world.levelIndex * FLOOR_H;
      // face the player when close, else face where they walk
      const targetYaw = d < 4.5 ? Math.atan2(-dx, -dz) : Math.atan2(tx, tz);
      if (!Number.isNaN(targetYaw)) a.face(targetYaw);
      a.animate(dt);
      if (opts.speak) a.talkT = 0.5;
      if (a.talkT > 0) {
        a.talkT -= dt;
        a.node.position.y += Math.abs(Math.sin(t * 12)) * 0.012;
      }
    });

    const pa = this.playerActor;
    if (pa) {
      pa.node.position.set(player.pos.x, player.pos.y, player.pos.z);
      pa.node.rotation.y = player.yaw;
      pa.move = player.mode === 'tp' ? 0 : player._speed || 0;
      pa.animate(dt);
      pa.node.visible = player.mode === 'tp';
    }
  }

  /** where a given speaker currently is (for subtitles + sound) */
  positionOf(id) {
    if (id === 'player' || id === 'arjun') return this.playerActor?.node.position ?? null;
    const i = ['friend1', 'friend2', 'friend3'].indexOf(id);
    return i >= 0 ? this.list[i]?.node.position : null;
  }
}

// ---------------------------------------------------------------------------
// Shadow figure — the "is that you?" mechanic. Placed by story beats.
// ---------------------------------------------------------------------------
export class ShadowFigure {
  constructor(scene) {
    this.scene = scene;
    this.node = new THREE.Group();
    this.rig = placeholderRig({ ...GHOST, color: 0x11151b, accent: 0x0d1116, skin: 0x1a2028 });
    this.node.add(this.rig);
    this.node.visible = false;
    scene.add(this.node);
    this.t = 0;
    this.life = 0;
    this.mode = 'idle'; // idle | stand | dart | dartback
    this.base = new THREE.Vector3();
  }

  show(x, z, level, { yaw = 0, mode = 'stand', life = 5, y = null } = {}) {
    this.node.position.set(x, (y ?? level * FLOOR_H) + 0.02, z);
    this.node.rotation.y = yaw;
    this.mode = mode;
    this.life = life;
    this.t = 0;
    this.base.copy(this.node.position);
    this.node.visible = true;
    audio.whisper(Math.sin(yaw));
  }

  hide(fade = 0.35) {
    this.dying = fade;
  }

  update(dt) {
    if (!this.node.visible) return;
    this.t += dt;
    const mats = [];
    this.rig.traverse((o) => o.material && mats.push(o.material));
    if (this.life > 0) this.life -= dt;
    const near = clamp(this.life / 1.2, 0, 1);
    for (const m of mats) {
      m.transparent = true;
      m.opacity = m.opacity !== undefined ? near * (this.mode === 'stand' ? 0.85 : 0.7) : 1;
    }
    if (this.mode === 'dart') {
      this.node.position.x = this.base.x + Math.sin(this.t * 21) * 0.03;
      this.node.position.z = this.base.z - this.t * 3.4;
    }
    if (this.mode === 'stand') {
      this.node.position.y = this.base.y + Math.abs(Math.sin(this.t * 0.9)) * 0.008;
    }
    if (this.dying !== undefined) {
      this.dying -= dt;
      for (const m of mats) m.opacity = Math.max(0, this.dying / 0.35) * 0.85;
      if (this.dying <= 0) {
        this.node.visible = false;
        this.dying = undefined;
        for (const m of mats) m.opacity = 0.85;
      }
    }
    if (this.life <= 0 && this.dying === undefined) this.hide(0.4);
    const legs = this.rig.userData;
    if (legs?.legL && this.mode === 'dart') {
      legs.legL.rotation.x = Math.sin(this.t * 16) * 0.7;
      legs.legR.rotation.x = -Math.sin(this.t * 16) * 0.7;
    }
  }
}

// ---------------------------------------------------------------------------
// Monster
// ---------------------------------------------------------------------------
export class Monster {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.node = new THREE.Group();
    this.rig = placeholderRig({ ...GHOST });
    this.rig.scale.setScalar(1.06);
    this.node.add(this.rig);
    this.node.visible = false;
    scene.add(this.node);
    this.state = 'dormant'; // dormant | stalk | hunt | search | flee | frozen
    this.speed = 2.6;
    this.level = 0;
    this.repath = 0;
    this.lastSeen = new THREE.Vector3();
    this.searchT = 0;
    this.growlT = 0;
    this.caughtCooldown = 0;
    this.stalkPoint = new THREE.Vector3();
    this.glitch = 0;
  }

  activate(level, x, z, state = 'hunt') {
    this.level = level;
    this.state = state;
    this.node.visible = true;
    this.node.position.set(x, level * FLOOR_H + 0.02, z);
  }

  deactivate() {
    this.state = 'dormant';
    this.node.visible = false;
  }

  /** crude line of sight along the corridor/rooms (collider sampling) */
  canSee(player) {
    if (player.hidden) return false;
    if (this.level !== this.world.levelIndex) return false;
    const boxes = this.world.levels[this.level].colliders();
    const a = this.node.position;
    const b = player.pos;
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    if (d > 24) return false;
    const steps = Math.ceil(d / 0.5);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      let hit = false;
      for (const bx of boxes) {
        if (bx.dynamic === true && bx.active === false) continue;
        if (x > bx.minx && x < bx.maxx && z > bx.minz && z < bx.maxz) {
          hit = true;
          break;
        }
      }
      if (hit) return false;
    }
    return true;
  }

  update(dt, t, player, onCatch) {
    if (this.state === 'dormant' || this.state === 'frozen') return;
    const level = this.world.levels[this.level];
    if (this.level !== this.world.levelIndex) return;

    const flow = level.flow;
    this.repath -= dt;
    if (this.repath <= 0) {
      this.repath = 0.32;
      level.flow.setBlockedFromBoxes(level.colliders());
      for (const d of level.doors.values()) if (!d.open) level.flow.blockCell(d.collider.minx + 0.1, d.collider.minz + 0.1);
      flow.compute(player.pos.x, player.pos.z);
    }

    let target = null;
    let spd = this.speed;
    if (this.state === 'hunt') {
      const hidden = player.hidden;
      if (hidden && this.dist(player) > 5) {
        this.state = 'search';
        this.searchT = 6;
      } else {
        target = flow.dirAt(this.node.position.x, this.node.position.z);
        spd = this.speed;
      }
      if (!target) target = { x: player.pos.x - this.node.position.x, z: player.pos.z - this.node.position.z };
    } else if (this.state === 'search') {
      this.searchT -= dt;
      if (this.searchT <= 0) {
        if (player.hidden) this.searchT = 4;
        else this.state = 'hunt';
      }
      const a = t * 0.7;
      target = { x: Math.cos(a) * 1.4 + (player.pos.x - this.node.position.x) * 0.25, z: Math.sin(a * 1.3) * 1.4 + (player.pos.z - this.node.position.z) * 0.25 };
      spd = 1.8;
    } else if (this.state === 'stalk') {
      const d = this.dist(player);
      if (d < 9) this.stalkPoint.set(player.pos.x, this.stalkPoint.y, player.pos.z - 8);
      target = { x: this.stalkPoint.x - this.node.position.x, z: this.stalkPoint.z - this.node.position.z };
      spd = 1.2;
    }

    if (target) {
      const len = Math.hypot(target.x, target.z) || 1;
      const res = moveWithCollision(this.node.position.x, this.node.position.z, (target.x / len) * spd * dt, (target.z / len) * spd * dt, 0.34, level.colliders());
      const moved = Math.hypot(res.x - this.node.position.x, res.z - this.node.position.z);
      this.node.position.x = res.x;
      this.node.position.z = res.z;
      this.rig.userData.move = clamp(moved / dt / 2.5, 0, 1);
      this.node.rotation.y = Math.atan2(target.x, target.z);
      const anim = { move: clamp(moved / dt / 2.2, 0, 1) };
      this.animateRig(dt, anim.move);
    }

    // growl volume by distance
    this.growlT -= dt;
    if (this.growlT <= 0 && this.state !== 'stalk') {
      this.growlT = clamp(this.dist(player) * 0.28, 0.9, 3.4);
      audio.growl(Math.max(0.6, this.dist(player) / 4));
    }

    // catch
    this.caughtCooldown -= dt;
    const d = this.dist(player);
    if (d < 1.15 && !player.hidden && this.caughtCooldown <= 0 && this.state !== 'stalk') {
      this.caughtCooldown = 8;
      onCatch?.(this);
    }
    if (d < 7) this.glitch = clamp(this.glitch + dt, 0, 1);
    else this.glitch = damp(this.glitch, 0, 3, dt);
    // flicker the emissive so it reads as "not quite there"
    this.rig.traverse((o) => {
      if (o.material && o.material.opacity !== undefined) {
        o.material.transparent = true;
        const base = 0.72;
        o.material.opacity = base * (0.55 + 0.45 * Math.abs(Math.sin(t * (3 + d) + o.id)));
      }
    });
  }

  animateRig(dt, move) {
    const u = this.rig.userData;
    this.t = (this.t || 0) + dt * (1 + move * 3);
    if (!u.legL) return;
    u.legL.rotation.x = Math.sin(this.t * 7) * (0.2 + move * 0.8);
    u.legR.rotation.x = -Math.sin(this.t * 7) * (0.2 + move * 0.8);
    u.armL.rotation.x = -Math.sin(this.t * 7) * (0.15 + move * 0.5);
    u.armR.rotation.x = Math.sin(this.t * 7) * (0.15 + move * 0.5);
    this.rig.position.y = Math.abs(Math.sin(this.t * 7)) * 0.04 * move;
  }

  dist(player) {
    return Math.hypot(player.pos.x - this.node.position.x, player.pos.z - this.node.position.z);
  }

  scare(player) {
    this.node.visible = false;
    player.scaredAt = performance.now();
  }
}
