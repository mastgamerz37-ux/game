// ---------------------------------------------------------------------------
// PlayerController — first person by default, third person on V.
//
// IMPORTANT for modding: the controller never touches the model. It moves a
// transform (`player.node`) and the camera. Whatever mesh you plug into
// `player.modelSlot` (our placeholder, or your .glb/.fbx/.obj) just follows
// along, so swapping models never breaks movement.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { EYE_HEIGHT, CROUCH_HEIGHT, PLAYER_RADIUS, PLAYER_SPEED, PLAYER_SPRINT, GRAVITY, FLOOR_H } from '../constants.js';
import { moveWithCollision, pointFree } from '../core/collision.js';
import { damp, clamp } from '../utils.js';

export class PlayerController {
  constructor(camera, input, world) {
    this.camera = camera;
    this.input = input;
    this.world = world;

    this.node = new THREE.Group(); // world-space player root
    this.modelSlot = new THREE.Group(); // <- your model goes here
    this.node.add(this.modelSlot);

    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.vel = 0;
    this.height = EYE_HEIGHT;
    this.crouching = false;
    this.sprinting = false;
    this.stamina = 1;
    this.bob = 0;
    this.stepAcc = 0;
    this.mode = 'fp'; // 'fp' | 'tp'
    this.locked = false; // cutscene / menu
    this.flashOn = true;
    this.battery = 1;
    this.onStep = null;
    this.frozen = false;
    this.shake = 0;
    this.thirdPersonDist = 3.4;
    this.breath = 0;

    // flashlight
    this.flash = new THREE.SpotLight(0xfff2d8, 0, 26, Math.PI / 6.2, 0.45, 1.35);
    this.flash.castShadow = true;
    this.flash.shadow.mapSize.set(1024, 1024);
    this.flash.shadow.camera.near = 0.2;
    this.flash.shadow.camera.far = 26;
    this.flash.shadow.bias = -0.0012;
    this.camera.add(this.flash);
    this.flash.position.set(0.16, -0.13, 0.05);
    this.flashTarget = new THREE.Object3D();
    this.flashTarget.position.set(0, 0, -1);
    this.camera.add(this.flashTarget);
    this.flash.target = this.flashTarget;

    this.ghost = new THREE.Object3D(); // what "the player" is for the AI
  }

  spawn(x, z, yaw = 0, level = 0) {
    this.pos.set(x, level * FLOOR_H, z);
    this.yaw = yaw;
    this.pitch = 0;
    this.node.position.copy(this.pos);
  }

  toggleView() {
    this.mode = this.mode === 'fp' ? 'tp' : 'fp';
    return this.mode;
  }

  update(dt, t) {
    const input = this.input;
    if (!this.frozen && input.locked) {
      const look = input.consumeLook();
      this.yaw -= look.x;
      this.pitch -= look.y;
      this.pitch = clamp(this.pitch, -1.2, 1.05);
    } else {
      input.consumeLook();
    }

    // ---- movement ---------------------------------------------------------
    const ax = input.enabled && !this.frozen ? input.axis() : { x: 0, z: 0 };
    const len = Math.hypot(ax.x, ax.z) || 1;
    const wantSprint = !!input.held.sprint && !this.crouching && (ax.x || ax.z);
    this.crouching = !!input.held.crouch;
    this.sprinting = wantSprint && this.stamina > 0.02;
    this.stamina = clamp(this.stamina + (this.sprinting ? -dt * 0.28 : dt * 0.22), 0, 1);

    const speed = (this.sprinting ? PLAYER_SPRINT : this.crouching ? PLAYER_SPEED * 0.45 : PLAYER_SPEED) * (this.locked ? 0 : 1);
    const mag = Math.hypot(ax.x, ax.z);
    const s = mag > 0.0001 ? speed / mag : 0;
    // yaw 0 faces -z; strafe right is +x
    const mx = (ax.z * -Math.sin(this.yaw) + ax.x * Math.cos(this.yaw)) * s;
    const mz = (ax.z * -Math.cos(this.yaw) - ax.x * Math.sin(this.yaw)) * s;

    const moving = Math.hypot(mx, mz) > 0.001;
    const level = this.world.levels[this.world.levelIndex];
    const boxes = level.colliders();
    if (moving) {
      const res = moveWithCollision(this.pos.x, this.pos.z, mx * dt, mz * dt, PLAYER_RADIUS, boxes);
      this.pos.x = res.x;
      this.pos.z = res.z;
      // footsteps
      this.stepAcc += dt * (this.sprinting ? 1.7 : this.crouching ? 0.6 : 1.05) * (moving ? 1 : 0);
      if (this.stepAcc > 0.46) {
        this.stepAcc = 0;
        this.onStep?.(this.sprinting, res.x, res.z);
      }
    }

    // stay inside the compound
    this.pos.x = clamp(this.pos.x, -29.5, 29.5);
    this.pos.z = clamp(this.pos.z, -19.8, 8.9);
    void pointFree;

    this.height = damp(this.height, this.crouching ? CROUCH_HEIGHT : EYE_HEIGHT, 12, dt);
    if (this.hiddenCrouch) this.height = damp(this.height, 0.62, 14, dt);
    this.node.position.copy(this.pos);

    // head bob + breathing
    const bobTarget = moving ? (this.sprinting ? 0.075 : 0.04) : 0.006;
    this.bob = damp(this.bob, bobTarget, 6, dt);
    const bobRate = moving ? (this.sprinting ? 12 : 8.4) : 1.9;
    const bobY = Math.sin(t * bobRate) * this.bob;
    const bobX = Math.cos(t * bobRate * 0.5) * this.bob * 0.55;
    this.breath = damp(this.breath, 1 - this.stamina, 3, dt);

    // ---- camera ----------------------------------------------------------
    const cam = this.camera;
    if (this.mode === 'fp') {
      this.modelSlot.visible = false;
      cam.position.set(this.pos.x + bobX * 0.3, this.pos.y + this.height + bobY, this.pos.z + bobX * 0.2);
      cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      if (this.shake > 0) {
        cam.position.x += (Math.random() - 0.5) * this.shake;
        cam.position.y += (Math.random() - 0.5) * this.shake;
        cam.rotation.z = (Math.random() - 0.5) * this.shake * 0.5;
        this.shake = Math.max(0, this.shake - dt * 1.5);
      }
      cam.rotation.y += Math.sin(t * bobRate * 0.5) * bobX * 0.06;
    } else {
      this.modelSlot.visible = true;
      const dist = this.thirdPersonDist;
      const cx = this.pos.x - Math.sin(this.yaw) * dist * Math.cos(this.pitch);
      const cz = this.pos.z - Math.cos(this.yaw) * dist * Math.cos(this.pitch);
      const cy = this.pos.y + this.height + 0.5 + Math.sin(this.pitch) * dist;
      cam.position.set(cx, cy, cz);
      cam.rotation.set(this.pitch * 0.5, this.yaw, 0, 'YXZ');
      this.modelSlot.position.set(this.pos.x, this.pos.y, this.pos.z);
      this.modelSlot.rotation.y = this.yaw;
    }

    this.ghost.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.ghost.lookAt(this.pos.x - Math.sin(this.yaw), this.pos.y, this.pos.z - Math.cos(this.yaw));

    // flashlight + battery
    if (this.flashOn) this.battery = clamp(this.battery - dt * 0.0035, 0, 1);
    const want = this.flashOn && this.battery > 0 ? (this.world.levelIndex === 2 ? 2.6 : 2.2) : 0;
    this.flash.intensity = damp(this.flash.intensity, want, 8, dt);
    if (this.battery <= 0) this.flashOn = false;

    return { moving, speed: Math.hypot(mx, mz) };
  }

  forwardVec(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }
}
