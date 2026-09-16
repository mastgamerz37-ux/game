// ---------------------------------------------------------------------------
// THE LAST PERIOD — game bootstrap + main loop.
// Story logic lives in systems/story.js; this file owns the renderer, the
// camera rig, interaction targeting, the fear meter and the frame update.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { FLOOR_H, SAVE_KEY } from './constants.js';
import { clamp, damp, wait } from './utils.js';
import { World } from './world/world.js';
import { Input } from './core/input.js';
import { audio } from './core/audio.js';
import { PlayerController } from './player/controller.js';
import { Friends, ShadowFigure, Monster } from './entity/actors.js';
import { Ui } from './systems/ui.js';
import { GameState, CHAPTERS } from './systems/state.js';
import { StoryDirector } from './systems/story.js';
import { FLOORS, CORE_CLUES } from './data/map.js';
import { Minimap } from './world/minimap.js';
import { TouchControls } from './core/touch.js';

const HOLD_TIME = 0.3;

export class Game {
  constructor() {
    this.canvas = document.getElementById('c');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ('outputColorSpace' in this.renderer) this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x04060a);
    this.fog = new THREE.FogExp2(0x05070b, 0.05);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(74, 1, 0.05, 170);
    this.scene.add(this.camera);
    this.scene.add(new THREE.AmbientLight(0x2f3a4c, 0.55));
    this.hemi = new THREE.HemisphereLight(0x4b5c74, 0x0a0c10, 0.34);
    this.scene.add(this.hemi);

    this.ui = new Ui(document.getElementById('ui'));
    this.input = new Input(this.canvas);
    this.world = new World(this.scene, FLOORS);
    this.player = new PlayerController(this.camera, this.input, this.world);
    this.friends = new Friends(this.scene);
    this.shadow = new ShadowFigure(this.scene);
    this.state = new GameState();

    this.fear = 0;
    this.hold = { id: null, t: 0 };
    this.target = null;
    this.paused = false;
    this.running = false;
    this.t = 0;
    this.beat = 0;
    this.items = new Map();
    this.lockers = [];
    this.interactables = [];
    this.cutscene = false;
    this.hidden = false;
    this.monster = null;
    this.story = null;
    this.touch = new TouchControls(this.input, this);
    this.menuCam = { a: 0 };
    this.fpsT = 0;
    this.fpsN = 0;

    this.input.onAction = (a) => this.onAction(a);
    this.ui.onOpenChange = (open) => {
      this.player.frozen = open || this.cutscene;
      this.syncTouchLock();
      if (open) document.exitPointerLock?.();
      else if (!this.input.touch && !this.paused && !this.cutscene && this.running && !this.ui.endShown) this.canvas.requestPointerLock?.();
    };
    this.player.onStep = (sprint) => {
      if (this.cutscene || this.paused) return;
      audio.step(sprint);
    };

    addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.running && !this.paused && this.story?.started) this.setPaused(true);
    });
  }

  // --------------------------------------------------------------- boot ----
  async boot() {
    this.ui.showMenu(true, { hasSave: !!localStorage.getItem(SAVE_KEY) });
    await this.world.build();
    this.story = new StoryDirector(this);
    await this.friends.build();
    this.monster = new Monster(this.scene, this.world);
    this.buildInteractables();
    this.buildMarkers();
    this.minimap = new Minimap(this);
    const q = new URLSearchParams(location.search);
    if (q.has('debug') || q.has('map')) this.minimap.toggle();
    addEventListener('keydown', (e) => { if (e.code === 'Backquote') this.minimap.toggle(); });
    this.resize();
    this.player.spawn(FLOORS[0].spawn.x, FLOORS[0].spawn.z, 0, 0);
    this.world.setGateOpen(true);
    if (TouchControls.shouldEnable()) {
      this.touch.mount(document.getElementById('ui'));
      document.body.classList.add('touch');
    }
    this.audioResumeOnce = () => {
      if (!audio.started) audio.resume();
    };
    this.running = true;
    this.loop();
    this.bindMenu();
    if (new URLSearchParams(location.search).has('skip')) {
      this.ui.setStatus('autostart…');
      setTimeout(() => document.getElementById('btn-start').click(), 400);
    }
  }

  bindMenu() {
    const start = async (cont) => {
      audio.resume();
      if (!this.input.touch) await this.canvas.requestPointerLock?.();
      this.ui.showMenu(false);
      this.syncTouchLock();
      if (cont) this.state.load();
      else GameState.clearSave();
      await this.story.begin(cont);
      this.canvas.requestPointerLock?.();
    };
    document.getElementById('btn-start').onclick = () => start(false);
    document.getElementById('btn-continue').onclick = () => start(true);
    document.getElementById('btn-erase').onclick = (e) => {
      e.stopPropagation();
      GameState.clearSave();
      this.ui.setStatus('SAVE ERASED');
      document.getElementById('btn-continue').classList.add('hidden');
      document.getElementById('btn-erase').classList.add('hidden');
    };
    document.getElementById('btn-resume').onclick = () => this.setPaused(false);
    document.getElementById('btn-mute').onclick = (e) => {
      audio.setMuted(!audio.muted);
      e.target.textContent = audio.muted ? 'UNMUTE' : 'MUTE';
    };
    document.getElementById('btn-restart').onclick = async () => {
      this.setPaused(false);
      await this.story.restartChapter();
    };
    document.getElementById('btn-abandon').onclick = () => {
      GameState.clearSave();
      location.reload();
    };
    document.getElementById('btn-again').onclick = () => {
      GameState.clearSave();
      location.reload();
    };
    document.getElementById('chapter-list').addEventListener('click', async (e) => {
      const b = e.target?.closest?.('.ch-btn');
      if (!b) return;
      this.setPaused(false);
      await this.story.jumpToChapter(Number(b.dataset.ch));
    });
    for (const id of ['modal', 'menu', 'pause', 'endcard']) {
      document.getElementById(id)?.addEventListener('mousedown', (e) => e.stopPropagation());
    }
  }

  // --------------------------------------------------- interactable build --
  buildInteractables() {
    this.interactables = [];
    for (const fdef of FLOORS) {
      for (const it of fdef.interactions || []) {
        this.interactables.push({ ...it, level: fdef.index, taken: false, kind: 'point' });
      }
      for (const d of fdef.doors || []) {
        this.interactables.push({ id: d.id, level: fdef.index, x: d.x, z: d.z, kind: 'door', label: d.name || 'Door', door: d.id, range: 2.3 });
      }
      const stairDefs = [fdef.stairs, fdef.downStairs, fdef.ladderUp].filter(Boolean);
      for (const s of stairDefs) {
        const cx = (s.rect.x0 + s.rect.x1) / 2;
        const cz = s.dir === 'up' && s.id !== 'b_up' ? s.rect.z1 - 0.3 : s.rect.z0 + 0.3;
        this.interactables.push({ id: s.id, level: fdef.index, x: cx, z: s.id === 'b_up' ? (s.rect.z0 + s.rect.z1) / 2 : cz, kind: 'stair', label: s.label, to: s.to, dir: s.dir, range: 2.6 });
      }
      if (fdef.gate) {
        this.interactables.push({ id: 'main_gate', level: fdef.index, x: fdef.gate.x, z: fdef.gate.z + 0.5, kind: 'point', special: 'gate', label: 'The main gate', range: 2.8 });
      }
    }
    // the chair in the last classroom
    this.interactables.push({ id: 'sit_chair', level: 2, x: 2.5, z: 4.4, kind: 'point', special: 'chair', label: 'The chair with your name on it', range: 2.4 });

    // lockers to hide in, along both corridors
    for (const lv of [0, 1]) {
      for (let i = 0; i < 8; i++) {
        const x = -22 + i * 6.1;
        if (Math.abs(x - 2.5) < 3) continue;
        this.lockers.push({ id: `lk_${lv}_${i}n`, level: lv, x: x + 0.6, z: 1.5 });
        this.lockers.push({ id: `lk_${lv}_${i}s`, level: lv, x: x + 3.6, z: -1.5 });
      }
    }
    for (const lk of this.lockers) {
      this.interactables.push({ ...lk, kind: 'locker', label: 'Slatted locker', range: 1.6 });
    }
  }

  buildMarkers() {
    const geo = new THREE.RingGeometry(0.085, 0.135, 20);
    for (const it of this.interactables) {
      if (it.kind !== 'point') continue;
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.4, depthWrite: false }));
      const y = it.face === 'e' || it.face === 'w' ? 1.28 : it.special === 'chair' ? 0.72 : 1.05;
      m.position.set(it.x, it.level * FLOOR_H + y, it.z);
      this.scene.add(m);
      it.marker = m;
    }
  }

  // ----------------------------------------------------------- inventory ---
  addItem(id, name, icon, hint) {
    if (this.items.has(id)) return false;
    this.items.set(id, { id, name, icon, hint });
    this.setInventory();
    return true;
  }

  setInventory() {
    this.ui.setInventory([...this.items.values()]);
  }

  setClues() {
    this.ui.setClues(this.state.coreClues.length, CORE_CLUES.length, this.state.secretReady);
  }

  // --------------------------------------------------------------- actions -
  onAction(a) {
    const modalOpen = !this.ui.el.modal.classList.contains('hidden');
    if (a === 'lock') {
      // pointer lock granted: we are back in the game
      this.ui.showPause(false);
      this.paused = false;
      this.input.enabled = true;
      return;
    }
    if (a === 'unlock') {
      // lock lost (Esc / tab-out). Pause unless a menu or a reading panel owns
      // the mouse, or a cutscene is holding the camera, or we are on touch
      // (where there is no pointer lock at all by design).
      if (this.input.touch) return;
      if (!this.running || this.paused || this.cutscene || this.ui.endShown) return;
      if (this.ui.el.menu && !this.ui.el.menu.classList.contains('hidden')) return;
      if (!this.ui.el.modal.classList.contains('hidden')) return;
      this.setPaused(true);
      return;
    }
    if (a === 'Escape') {
      if (modalOpen) {
        this.ui.closeModal();
        return;
      }
      if (this.running && !this.ui.endShown) this.setPaused(!this.paused);
      return;
    }
    if (!this.running || this.paused || this.ui.endShown) {
      if (a === 'KeyM') audio.setMuted(!audio.muted);
      return;
    }
    if (this.story?.debugMode) {
      if (a === 'Digit1') return this.story.jumpToChapter(1);
      if (a === 'Digit2') return this.story.jumpToChapter(2);
      if (a === 'Digit3') return this.story.jumpToChapter(3);
      if (a === 'Digit4') return this.story.jumpToChapter(4);
      if (a === 'Digit5') return this.story.jumpToChapter(5);
      if (a === 'KeyG') {
        this.addItem('key_reception', 'Store key', '🗝');
        this.addItem('brass_key', 'Brass key', '🗝');
        this.state.hasFuseKey = true;
        this.ui.toast('keys given');
        return;
      }
      if (a === 'KeyT') {
        for (const c of CORE_CLUES) this.state.addClue(c);
        this.setClues();
        this.ui.toast('all truths revealed');
        return;
      }
      if (a === 'KeyX') {
        this.ui.closeModal();
        this.g_skip = !this.g_skip;
        this.ui.toast(this.g_skip ? 'beats auto-skip ON' : 'beats auto-skip OFF');
        return;
      }
      if (a === 'KeyP') {
        this.setPower(!this.state.power);
        return;
      }
    }
    switch (a) {
      case 'KeyE':
      case 'Space':
        if (!modalOpen) this.tryInteract();
        break;
      case 'KeyF':
        this.player.flashOn = !this.player.flashOn;
        this.ui.toast(this.player.flashOn ? 'TORCH ON' : 'TORCH OFF');
        break;
      case 'KeyV': {
        const m = this.player.toggleView();
        this.ui.toast(m === 'tp' ? 'THIRD PERSON' : 'FIRST PERSON');
        break;
      }
      case 'KeyJ':
      case 'KeyI': // both spellings work; the keyboard layout note says J
        this.story?.openJournal();
        break;
      case 'KeyK':
        this.minimap?.toggle();
        break;
      case 'KeyM':
        audio.setMuted(!audio.muted);
        this.ui.toast(audio.muted ? 'MUTED' : 'SOUND ON');
        break;
      default:
        break;
    }
  }

  /** hide the on-screen controls whenever a menu/panel owns the screen, so a
   *  tap goes to the button and not to the look-pad */
  syncTouchLock() {
    if (!this.input.touch) return;
    const e = this.ui.el;
    const blocked =
      this.paused ||
      this.ui.endShown ||
      !e.modal.classList.contains('hidden') ||
      !(e.menu?.classList.contains('hidden') ?? true);
    document.body.classList.toggle('no-touch', blocked);
  }

  setPaused(p) {
    this.paused = p;
    this.input.enabled = !p;
    this.syncTouchLock();
    if (p) {
      document.exitPointerLock?.();
      this.ui.showPause(true, CHAPTERS);
    } else {
      this.ui.showPause(false);
      if (!this.ui.el.modal.classList.contains('hidden')) return;
      if (this.input.touch) return;
      this.canvas.requestPointerLock?.();
    }
  }

  // ---------------------------------------------------------- interaction --
  findTarget() {
    const lv = this.world.levelIndex;
    let best = null;
    let bestScore = 1e9;
    const fx = -Math.sin(this.player.yaw);
    const fz = -Math.cos(this.player.yaw);
    for (const it of this.interactables) {
      if (it.level !== lv) continue;
      const bl = this.story?.blocked(it);
      if (bl === true) continue;
      const dx = it.x - this.player.pos.x;
      const dz = it.z - this.player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > (it.range ?? 2.15)) continue;
      const dot = d > 0.001 ? (dx / d) * fx + (dz / d) * fz : 1;
      if (dot < 0.25 && d > 0.9) continue;
      const score = d - dot * 1.5;
      if (score < bestScore) {
        bestScore = score;
        best = it;
      }
    }
    return best;
  }

  promptFor(it) {
    if (!it) return null;
    if (it.kind === 'door') {
      const door = this.world.door(it.level, it.door);
      if (!door) return null;
      if (door.locked && !this.story.canOpenDoor(door)) return `Locked — ${this.story.lockReason(door)}`;
      return door.open ? 'Close the door' : 'Open the door';
    }
    if (it.kind === 'stair') return it.label;
    if (it.kind === 'locker') return this.hidden ? 'Step out of the locker' : 'Hide inside';
    if (it.special) return this.story.specialPrompt(it);
    if (it.taken) return null;
    if (it.take) return 'Take it';
    return it.label;
  }

  tryInteract() {
    if (this.cutscene) return;
    const it = this.target || this.findTarget();
    if (!it) return;
    const why = this.story?.blocked(it);
    if (typeof why === 'string') return this.ui.toast(why);
    if (it.kind === 'door') return this.story.useDoor(it);
    if (it.kind === 'stair') return this.story.useStairs(it);
    if (it.kind === 'locker') return this.toggleHide();
    return this.story.interact(it);
  }

  toggleHide() {
    this.hidden = !this.hidden;
    if (this.hidden) {
      audio.burst({ dur: 0.45, freq: 400, gain: 0.3, rate: 0.5 });
      this.player.hiddenCrouch = true;
      this.ui.toast('HIDING — stay still');
    } else {
      audio.burst({ dur: 0.3, freq: 320, gain: 0.22, rate: 0.6 });
      this.player.hiddenCrouch = false;
      this.ui.toast('OUT');
    }
    this.story.onHideToggle(this.hidden);
  }

  // ---------------------------------------------------------------- frame --
  loop() {
    let last = performance.now();
    const step = () => {
      requestAnimationFrame(step);
      const now = performance.now();
      let dt = (now - last) / 1000;
      last = now;
      dt = Math.min(Math.max(dt, 0.0005), 0.05);
      this.t += dt;
      this.fpsN++;
      if (this.t - this.fpsT > 1) {
        this.fps = Math.round(this.fpsN / (this.t - this.fpsT));
        this.fpsT = this.t;
        this.fpsN = 0;
      }
      if (this.paused) {
        this.renderer.render(this.scene, this.camera);
        return;
      }
      this.tick(dt);
      this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(step);
  }

  tick(dt) {
    const t = this.t;
    if (!this.story?.started) {
      // idle orbit for the title screen
      this.menuCam.a += dt * 0.09;
      const r = 5.6;
      this.camera.position.set(3.4 + Math.cos(this.menuCam.a) * r, 2.0 + Math.sin(this.menuCam.a * 0.6) * 0.3, -6.2 + Math.sin(this.menuCam.a) * r * 0.5);
      this.camera.lookAt(2.6, 1.4, 2.0);
      this.world.update(dt, t);
      this.world.tickLights(t);
      return;
    }

    this.player.update(dt, t);
    const lvlY = this.world.levelIndex * FLOOR_H;
    this.player.pos.y = lvlY;
    if (this.player.hiddenCrouch) {
      this.camera.position.set(this.player.pos.x, lvlY + 0.62, this.player.pos.z);
      this.camera.rotation.set(this.player.pitch * 0.5, this.player.yaw, 0, 'YXZ');
    }

    if (!this.cutscene && this.input.looking && this.ui.el.modal.classList.contains('hidden')) {
      const it = this.findTarget();
      this.target = it;
      const prompt = this.promptFor(it);
      if (it && prompt) {
        if (this.hold.id !== it.id) this.hold = { id: it.id, t: 0 };
        this.hold.t += dt;
        this.ui.setPrompt(prompt, clamp(this.hold.t / HOLD_TIME, 0, 1), this.input.touch ? 'USE' : 'E');
      } else {
        this.hold = { id: null, t: 0 };
        this.ui.setPrompt(null);
      }
    } else if (!this.input.looking) {
      this.ui.setPrompt(null);
      this.target = null;
    }

    this.world.update(dt, t);
    this.world.refreshLights(this.player.pos, 7);
    this.world.tickLights(t);
    this.friends.update(dt, t, this.player, this.world, { excited: !!this.story?.excited });
    this.shadow.update(dt);
    if (this.monster) this.monster.update(dt, t, this.player, () => this.story.onCaught());

    for (const it of this.interactables) {
      if (!it.marker) continue;
      const vis = it.level === this.world.levelIndex && !it.taken && !this.story.blocked(it);
      it.marker.visible = vis;
      if (vis) {
        const pulse = 0.26 + 0.2 * Math.sin(t * 2.4 + it.x);
        it.marker.material.opacity = this.target === it ? 0.95 : pulse;
        it.marker.scale.setScalar(this.target === it ? 1.5 : 1);
        it.marker.lookAt(this.camera.position);
      }
    }

    // ---- fear ----
    const illum = this.world.illumination(this.player.pos.x, this.player.pos.z, t);
    let rate = (this.world.levelIndex === 2 ? -0.04 : 0.05) - illum * 0.42;
    if (this.monster?.node.visible) {
      const d = this.monster.dist(this.player);
      if (this.monster.state === 'hunt' || this.monster.state === 'search') rate += clamp(1.5 - d * 0.1, 0.1, 1.7);
      if (d < 6 && this.monster.canSee(this.player)) rate += 0.55;
    }
    if (this.hidden) rate -= 0.6;
    let near = 0;
    for (const a of this.friends.list) {
      if (Math.hypot(a.node.position.x - this.player.pos.x, a.node.position.z - this.player.pos.z) < 3.4) near++;
    }
    rate -= near * 0.09;
    if (this.player.flashOn) rate -= 0.05;
    this.fear = clamp(this.fear + rate * dt, 0, 1);
    this.ui.setMeters({ fear: this.fear, stamina: this.player.stamina, battery: this.player.battery });
    audio.setTension(clamp(this.fear * 0.7 + (this.story.chaseActive ? 0.35 : 0), 0, 1));
    this.hemi.intensity = damp(this.hemi.intensity, 0.08 + illum * 0.45, 2, dt);

    this.beat += dt * (0.55 + this.fear * 2.1);
    if (this.beat > 1 && this.fear > 0.45) {
      this.beat = 0;
      audio.heartbeat();
    }

    const fogTarget = this.world.levelIndex === 2 ? 0.075 : this.state.power ? 0.02 : 0.055;
    this.fog.density = damp(this.fog.density, fogTarget, 1.2, dt);
    this.fog.color.setHex(this.world.levelIndex === 2 ? 0x04060a : this.state.power ? 0x0b1018 : 0x05070b);

    if (!this.cutscene) {
      this.ui.setRoom(this.world.roomName(this.player.pos.x, this.player.pos.z));
      if (this.story.debugMode) {
        this.ui.showDebug(
          `fps ${this.fps || '-'}  fear ${this.fear.toFixed(2)}  floor ${this.world.levelIndex}\n` +
            `ch${this.state.chapter} · ${this.state.stage}  caught ${this.state.caught}\n` +
            `pos ${this.player.pos.x.toFixed(1)}, ${this.player.pos.z.toFixed(1)}  clues ${this.state.clueTotal}\n` +
            `[1-5] jump  [G] keys  [T] truths  [X] skip  [P] power`
        );
      }
    }
    this.story?.update(dt, t);
    this.minimap?.update();
    this.input.drainActions();
    void wait;
  }

  // -------------------------------------------------------------- helpers --
  async teleportTo(x, z, level, yaw, { fade = 700 } = {}) {
    if (fade) this.ui.fade(true, fade * 0.8);
    await wait(fade ? fade * 0.45 : 0);
    this.world.setLevel(level);
    this.state.level = level;
    this.player.pos.set(x, level * FLOOR_H, z);
    if (yaw !== undefined && yaw !== null) this.player.yaw = yaw;
    this.player.node.position.copy(this.player.pos);
    this.friends.spawnAround(x, z, level);
    if (this.monster) this.monster.level = level;
    await wait(fade ? fade * 0.35 : 0);
    if (fade) this.ui.fade(false, fade * 0.9);
  }

  async lockPlayer(on) {
    this.cutscene = on;
    this.player.frozen = on;
    this.player.locked = on;
  }

  async lookAt(x, z, ms = 900, pitch = 0) {
    const dx = x - this.player.pos.x;
    const dz = z - this.player.pos.z;
    const targetYaw = Math.atan2(-dx, -dz);
    const start = this.player.yaw;
    let a = targetYaw - start;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    const t0 = performance.now();
    const sp = this.player.pitch;
    await new Promise((res) => {
      const go = () => {
        const k = Math.min(1, (performance.now() - t0) / ms);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        this.player.yaw = start + a * e;
        this.player.pitch = sp + (pitch - sp) * e;
        if (k < 1) requestAnimationFrame(go);
        else res();
      };
      go();
    });
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  /** debug helper: force the electrical state */
  async setPower(on) {
    this.state.power = on;
    audio.setPower(on);
    for (const lvl of this.world.levels) {
      if (lvl.index === 2) continue;
      for (const f of lvl.fixtures) {
        f.enabled = on;
        f.on = on;
      }
    }
    this.ui.toast(on ? 'POWER ON' : 'POWER OFF');
  }
}

const game = new Game();
globalThis.__game = game;
game.boot().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML(
    'beforeend',
    `<pre style="position:fixed;left:12px;bottom:12px;right:12px;max-height:40vh;overflow:auto;background:#180407;color:#ff9a9a;padding:14px;font-size:12px;z-index:99;border-radius:10px">${
      (e && (e.stack || e.message)) || e
    }</pre>`
  );
});
