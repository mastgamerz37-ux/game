// ---------------------------------------------------------------------------
// StoryDirector — the only place that knows what happens *when*.
// Chapters are plain async functions built from a small set of stage
// primitives (say / flicker / shake / big / beat). If you want to write your
// own horror sequence, copy one chapter function and edit the beats.
// ---------------------------------------------------------------------------
import { FLOOR_H } from '../constants.js';
import { DIALOGUE } from '../data/dialogue.js';
import { CLUE_TITLES, CORE_CLUES, FLOORS } from '../data/map.js';
import { nameOf } from '../data/characters.js';
import { audio } from '../core/audio.js';
import { CHAPTERS } from './state.js';
import { clamp, wait, rand, pick } from '../utils.js';

const CODE = [1, 9, 9, 8];

export class StoryDirector {
  constructor(game) {
    this.g = game;
    this.ui = game.ui;
    this.state = game.state;
    this.started = false;
    this.chaseActive = false;
    this.excited = false;
    this.flickers = [];
    this.debugMode = new URLSearchParams(location.search).has('debug');
    this.lockedDoors = new Set();
    this.endingShown = false;
    this.playerName = nameOf('player');
  }

  get world() {
    return this.g.world;
  }
  get player() {
    return this.g.player;
  }
  get monster() {
    return this.g.monster;
  }
  get shadow() {
    return this.g.shadow;
  }
  get level() {
    return this.world.levelIndex;
  }

  // ------------------------------------------------------------------ run --
  async begin(cont = false) {
    this.started = true;
    this.g.ui.el.menuStatus && (this.g.ui.el.menuStatus.textContent = '');
    this.applyPersistentWorldState();
    this.ui.setChapter(0, 'Prologue');
    if (!cont) {
      await this.prologue();
    } else {
      await this.resume();
    }
    if (this.debugMode) this.g.ui.toast('DEBUG: 1-5 = jump chapter, G = give keys, X = skip beats');
  }

  applyPersistentWorldState() {
    const s = this.state;
    // power
    for (const lvl of this.world.levels) {
      for (const f of lvl.fixtures) {
        f.enabled = s.power;
        f.on = s.power;
      }
    }
    if (s.level == null) s.level = 0;
    this.world.setLevel(s.level);
    this.g.player.pos.set(FLOORS[s.level].spawn.x, s.level * FLOOR_H, FLOORS[s.level].spawn.z);
    // doors
    for (const [key, door] of this.world.allDoors) {
      const [lv, id] = key.split(':');
      door.open = id === 'd_c1e' || id === 'd_secret' ? false : false;
      door.openFrac = 0;
    }
    if (s.codeEntered) this.openBookcase(true);
    if (s.chapter >= 4) {
      const secretStair = this.g.interactables.find((i) => i.id === 'f_up');
      if (secretStair) secretStair.hidden = false;
    }
    if (s.fusePulled) {
      this.setFinalDoorLocked(false);
      this.setGateLocked(false);
    }
    if (s.gateLocked) this.setGateLocked(true);
    this.syncInventory();
    this.refreshObjective();
  }

  // ------------------------------------------------------------- prologue --
  async prologue() {
    const g = this.g;
    await g.teleportTo(FLOORS[0].spawn.x, FLOORS[0].spawn.z, 0, 0, { fade: 900 });
    this.state.stage = 'outside';
    await g.lockPlayer(true);
    await this.ui.titleCard(0, 'THE LAST PERIOD', 'Raat, gyara bajte. Ek band school. Ek mazaak.', 3200);
    await this.saySeq('intro');
    await g.lookAt(2.5, -8.3, 1400);
    await wait(500);
    await g.lockPlayer(false);
    this.ui.toast('Walk through the gate');
    this.state.stage = 'ch1_gate';
    this.refreshObjective();
    this.watchGateEntry();
  }

  watchGateEntry() {
    const g = this.g;
    const t = g.world.levels[0].def.entryTrigger;
    const inBox = () => {
      const p = g.player.pos;
      return p.x > t.x0 && p.x < t.x1 && p.z > t.z0 && p.z < t.z1;
    };
    const iv = setInterval(async () => {
      if (this.state.stage !== 'ch1_gate') return clearInterval(iv);
      if (!inBox()) return;
      if (!this.armed) {
        // wait for them to actually pass the threshold, then hold still a beat
        this.armed = inBox();
        audio.creak();
        return;
      }
      clearInterval(iv);
      await this.chapterOne();
    }, 140);
  }

  async resume() {
    const g = this.g;
    await g.lockPlayer(true);
    await this.ui.titleCard(this.state.chapter || 1, (CHAPTERS.find((c) => c.id === (this.state.chapter || 1)) || {}).title, this.state.objective(), 2400);
    await g.lockPlayer(false);
    switch (this.state.stage) {
      case 'outside':
      case 'ch1_gate':
        return this.watchGateEntry();
      case 'ch1_gen':
        return this.generatorGoal();
      case 'ch2_search':
      case 'ch2_register':
        return this.chapterTwo();
      case 'ch3_digits':
      case 'ch3_panel':
        return this.chapterThree();
      case 'ch4_down':
        return this.chapterFour(false);
      case 'ch4_down':
        this.state.stage = 'ch4_records';
        if (!this.state.sawBasement) this.awaitCorridor = true;
        else this.setChase('hunt');
        return this.refreshObjective();
      case 'ch4_records':
      case 'ch4_key':
        this.state.stage = 'ch4_records';
        if (!this.state.sawBasement) this.awaitCorridor = true;
        else this.setChase('hunt');
        return this.refreshObjective();
      case 'ch4_fuse':
        this.setChase('hunt');
        return this.refreshObjective();
      case 'ch4_flee':
        this.setChase('flee');
        return this.refreshObjective();
      case 'ch5_wait':
        return this.refreshObjective();
      case 'ch5_final':
        return this.refreshObjective();
      default:
        return this.refreshObjective();
    }
  }

  // ------------------------------------------------------------- chapter 1 --
  async chapterOne() {
    const g = this.g;
    this.state.chapter = 1;
    this.state.entered = true;
    this.state.stage = 'ch1_gate';
    this.refreshObjective();
    if (this.state.power) {
      // continuing a save that already has power: skip the lock-in scene
      this.state.stage = this.state.readRegister ? 'ch3_digits' : 'ch1_gen';
      this.state.chapter = this.state.readRegister ? 3 : 1;
      this.refreshObjective();
      return;
    }
    await g.lockPlayer(true);

    // the gate slams
    this.world.setGateOpen(false);
    this.setGateLocked(true);
    this.state.stage = 'ch1_locked';
    audio.slam();
    audio.burst({ dur: 0.6, freq: 180, gain: 0.4, rate: 0.5 });
    g.player.shake = 0.09;
    await this.saySeq('gate_lock');
    audio.announcement(3.4);
    await this.ui.say('entity', DIALOGUE.announcement[0].t, 2600);
    this.ui.big('YOUR LAST PERIOD BEGINS NOW', 3400);
    audio.bell();
    await wait(900);
    this.state.stage = 'ch1_gen';
    await g.lockPlayer(false);
    await this.saySeq('ch1_goal');
    this.refreshObjective();
    this.ui.toast('Generator room — ground floor, east side');
  }

  generatorGoal() {
    this.state.chapter = 1;
    this.refreshObjective();
    this.ui.toast('Breaker → valve → start');
  }

  async generatorStep(which) {
    const s = this.state.gen;
    if (which === 'breaker') {
      s.breaker = !s.breaker;
      audio.burst({ dur: 0.14, freq: 2600, gain: 0.3, rate: 1.6 });
      this.ui.toast(s.breaker ? 'BREAKER: ON' : 'BREAKER: OFF');
    } else if (which === 'valve') {
      if (!s.breaker) {
        this.ui.say('meera', DIALOGUE.hint_no_power[0].t);
        audio.burst({ dur: 0.3, freq: 500, gain: 0.12, rate: 0.6 });
        return;
      }
      s.valve = !s.valve;
      audio.burst({ dur: 0.5, freq: 900, gain: 0.16, rate: 0.3, type: 'bandpass', q: 5 });
      this.ui.toast(s.valve ? 'VALVE: OPEN' : 'VALVE: CLOSED');
    } else if (which === 'start') {
      if (!s.breaker || !s.valve) {
        audio.burst({ dur: 0.5, freq: 300, gain: 0.2, rate: 0.4 });
        this.ui.toast('Nothing. Breaker, then valve.');
        return;
      }
      s.start = true;
      audio.machine();
      this.g.player.shake = 0.05;
      await wait(1500);
      await this.lightsOn();
    }
    this.state.save();
  }

  async lightsOn() {
    const g = this.g;
    this.state.power = true;
    this.state.chapter = 1;
    audio.setPower(true);
    this.state.stage = 'ch2_search';
    await g.lockPlayer(true);
    this.ui.big('LIGHTS', 1600);
    // staggered wake-up: corridor lights come alive one by one, east to west
    const f0 = this.world.levels[0];
    const list = f0.fixtures.slice().sort((a, b) => b.x - a.x);
    for (const f of list) {
      f.enabled = true;
      f.on = true;
      f.flicker = rand() < 0.4 ? 0.7 : 0.15;
      audio.burst({ dur: 0.09, freq: 2000, gain: 0.1, rate: 2 });
      await wait(65);
    }
    for (const f of this.world.levels[1].fixtures) {
      f.enabled = true;
      f.on = true;
      f.flicker = rand() < 0.3 ? 0.5 : 0;
    }
    await this.saySeq('gen_done');
    await this.firstHorrorEvent();
    this.state.stage = 'ch2_search';
    this.state.chapter = 2;
    this.state.save();
    await g.lockPlayer(false);
    await this.saySeq('ch2_goal');
    this.refreshObjective();
  }

  // --------------------------------------------------- first horror event ---
  async firstHorrorEvent() {
    const g = this.g;
    if (this.state.firstEventDone) return;
    this.state.firstEventDone = true;
    this.state.chapter = 1;
    const p = g.player.pos;

    // SOUND — footsteps that are not ours, walking along the corridor
    await this.walkPast(p.x, 1.15, 5);
    await g.lookAt(-18.5, 1.2, 900);
    await this.saySeq('first_event');

    // LIGHTS — they die one by one, in one direction: something is passing them
    await this.flickerDownCorridor(0);
    await wait(300);

    // OBJECT MOVEMENT — a chair walks out of the room while nobody is looking
    this.moveProp(0, 'chair');
    audio.burst({ dur: 0.8, freq: 280, gain: 0.2, rate: 0.35, pan: -0.4 });
    await wait(500);

    // you turn around: nobody
    await this.lookBehind(700);
    await this.saySeq('turn_nobody');
    await this.flicker(0.7, 0);

    // SHORT APPEARANCE — Classroom 1's door opens by itself, and something is
    // standing in the doorway wearing a shape borrowed from your group
    const door = this.world.door(0, 'd_c1');
    if (door) {
      audio.creak();
      door.setOpen(true);
    }
    await this.saySeq('door_open');
    await g.lookAt(-18.5, 2.8, 1100, 0.02);
    this.shadow.show(-18.5, 2.7, 0, { yaw: Math.PI, mode: 'stand', life: 2.6 });
    this.ui.big('Rohan?', 1400);
    await wait(1500);
    this.shadow.hide(0.15);
    audio.stinger();
    g.player.shake = 0.16;
    await wait(360);
    await this.ui.say('rohan', '(from right behind you) …bhai. Main yahan hoon.', 2400);
    this.setPowerFlicker();
    this.state.save();
  }

  /** a footstep chain that pans past the player */
  async walkPast(x, z, steps = 5) {
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1) - 0.5;
      audio.burst({ dur: 0.16, freq: 330, gain: 0.15, rate: 0.45, pan: Math.max(-0.9, Math.min(0.9, t * 2)) });
      await wait(430);
    }
  }

  /** corridor lights go out east→west then return: reads as something walking by */
  async flickerDownCorridor(level = 0) {
    const lvl = this.world.levels[level];
    const list = lvl.fixtures.filter((f) => f.group === 'corridor').sort((a, b) => b.x - a.x);
    for (const f of list) {
      f.on = false;
      audio.burst({ dur: 0.05, freq: 2400, gain: 0.05, rate: 2 });
      await wait(90);
    }
    for (const f of list) {
      f.on = this.state.power;
      await wait(70);
    }
  }

  /** turn to face exactly behind the player — the "nobody there" beat */
  async lookBehind(ms = 700) {
    const g = this.g;
    const y = g.player.yaw;
    await g.lookAt(g.player.pos.x + Math.sin(y) * 6, g.player.pos.z + Math.cos(y) * 6, ms);
  }

  /** knock a stray piece of furniture over: the "object movement" rung */
  moveProp(levelIdx, kind = 'chair') {
    const lvl = this.world.levels[levelIdx];
    if (!lvl || lvl.propJittered) return;
    const cands = (lvl.group.children || []).filter((o) => o.isObject3D && o.children.length === 5);
    if (!cands.length) return;
    const c = cands[Math.floor(rand() * cands.length)];
    c.userData.noJitter = true;
    c.rotation.z = Math.PI / 2;
    c.position.y = 0.18;
    c.position.x += 0.7;
    lvl.propJittered = true;
    audio.creak();
  }


  setPowerFlicker() {
    for (const lvl of this.world.levels) {
      for (const f of lvl.fixtures) if (f.on && rand() < 0.25) f.flicker = 0.35;
    }
  }

  // ------------------------------------------------------------- chapter 2 --
  async chapterTwo() {
    this.state.chapter = 2;
    this.state.stage = 'ch2_search';
    this.refreshObjective();
    await this.saySeq('ch2_goal');
  }

  async openDrawer() {
    const g = this.g;
    this.state.readDrawer = true;
    audio.burst({ dur: 0.35, freq: 700, gain: 0.2, rate: 0.6 });
    await this.saySeq('drawer_open');
    this.g.addItem('torch', 'Torch', '🔦', 'Press F');
    if (!this.state.power) this.ui.toast('…useless without power. Generator first.');
    this.state.save();
    this.refreshObjective();
  }

  async readRegister() {
    audio.page();
    const names = this.ui.castNames();
    const rows = names
      .map(
        (n, i) =>
          `<tr class="us"><td>${i + 1}</td><td>${n}</td><td>9</td><td>Period 6</td><td>PRESENT</td></tr>`
      )
      .join('');
    await this.ui.reader(
      'Attendance Register — Class 9, Period 6, 12 Nov 1998',
      [`<table class="register"><tr><th>#</th><th>Name</th><th>Class</th><th>Period</th><th>Status</th></tr>${rows}
        <tr class="fifth"><td>5</td><td>UNKNOWN</td><td>9</td><td>Period 6</td><td>PRESENT</td></tr></table>`,
        'The ink is dry. The paper is new. Twenty years of rain never touched it.',
        'Above the table, in a different, steadier hand: <b>“They will come for the last period. Sign them in.”</b>'],
      { closeLabel: 'CLOSE THE REGISTER', paper: 'aged' }
    );
    this.state.readRegister = true;
    await this.saySeq('register_read');
    audio.stinger();
    this.ui.big('PRESENT', 2200);
    await wait(600);
    this.state.chapter = 3;
    await this.chapterThree();
    this.state.save();
  }

  // ------------------------------------------------------------- chapter 3 --
  async chapterThree() {
    this.state.chapter = 3;
    this.state.stage = this.state.digitsFound === 4 ? 'ch3_panel' : 'ch3_digits';
    await this.ui.titleCard(3, 'The Classroom', 'Board pe sawaal hai. Jawab school mein bikhra hai.', 3000);
    this.refreshObjective();
    if (this.state.digitsFound < 4) await this.saySeq('ch3_goal');
  }

  async readBoard() {
    await this.ui.reader(
      'Old Classroom — blackboard',
      ['<div style="text-align:center;font-size:26px;line-height:1.6;font-family:\'Segoe Print\',cursive">WHERE IS<br>THE MISSING STUDENT?</div>',
        'Below it, in smaller chalk, four blank squares and a hint: <b>『 the year, in four marks 』</b>',
        'The panel beside the board takes four digits. The school has written the year all over itself: <b>reception</b> · <b>classroom 1</b> · <b>the principal</b> · <b>the fuse box</b>.'],
      { closeLabel: 'STEP BACK' }
    );
    if (this.state.chapter < 3) {
      this.state.chapter = 3;
      this.state.stage = 'ch3_digits';
      this.refreshObjective();
    }
  }

  async usePanel() {
    const g = this.g;
    if (this.state.codeEntered) {
      this.ui.toast('The panel is already open.');
      return;
    }
    if (this.state.digitsFound < 4) {
      await this.ui.reader('Old combination panel', [
        `Four dials. You have ${this.state.digitsFound} of 4 marks: <b>${this.state.code}</b>`,
        '<i>Four rooms in this school still smell of chalk. He wrote the year everywhere, because he could not leave.</i>',
      ]);
      return;
    }
    const entered = await this.ui.codePad(this.state.digits, { hint: 'Four dials. A school year?' });
    if (!entered) return;
    if (entered.length < 4) return this.ui.toast('Four dials. All four.');
    if (entered.join('') !== CODE.join('')) {
      audio.burst({ dur: 0.4, freq: 420, gain: 0.2, rate: 0.5 });
      await this.saySeq('panel_wrong');
      return this.ui.toast('The panel refuses.');
    }
    this.state.codeEntered = true;
    this.state.stage = 'ch4_down';
    await this.ui.titleCard(3, '1 9 9 8', '', 1600);
    await this.saySeq('panel_right');
    this.openBookcase(false);
    this.state.save();
    this.refreshObjective();
  }

  openBookcase(instant) {
    const lvl = this.world.levels[1];
    const bc = lvl.bookcase;
    if (!bc) return;
    // drop the bookcase collider so the ladder behind it becomes walkable
    lvl.staticBoxes = lvl.staticBoxes.filter((b) => !b.bookcase);
    lvl.boxes = lvl.staticBoxes.slice();
    const stair = this.g.interactables.find((i) => i.id === 'f_up');
    if (stair) stair.hidden = false;
    audio.creak();
    if (instant) {
      bc.rotation.y = -1.4;
      bc.position.z -= 0.8;
    } else {
      const t0 = performance.now();
      const base = bc.rotation.y;
      const px = bc.position.x;
      const pz = bc.position.z;
      const anim = () => {
        const k = Math.min(1, (performance.now() - t0) / 2600);
        const e = 1 - Math.pow(1 - k, 3);
        bc.rotation.y = base - 1.4 * e;
        bc.position.z = pz - 0.8 * e;
        if (k < 1) requestAnimationFrame(anim);
      };
      anim();
      this.ui.big('A STAIRCASE GOES DOWN', 2400);
    }
    this.flicker(2.4, 1);
  }

  // ------------------------------------------------------------- chapter 4 --
  async chapterFour(fromLadder = true) {
    const g = this.g;
    this.state.chapter = 4;
    this.state.inBasement = true;
    this.state.stage = 'ch4_records';
    await g.lockPlayer(true);
    await this.ui.titleCard(4, 'The Basement', 'Jo gaya hi nahi. Uske kagaz neeche hain.', 3000);
    await this.saySeq('basement_enter');
    if (fromLadder) {
      // the basement has no cutscene monster: you meet it when you step into
      // the passage, so the first sighting is yours, not a scripted camera
      await g.lookAt(20.5, 1.6, 1200, -0.15);
      await this.ui.say('meera', 'Seedhi neeche. Abhi tak koi nahi. Torch on rakho, aur… pairon ki awaaz aaye to ruk mat jana.', 2600);
      this.awaitCorridor = true;
    }
    await g.lockPlayer(false);
    this.refreshObjective();
    this.state.save();
  }

  /** the basement's first sighting, armed on entry, fired in the passage */
  async basementAppearance() {
    const g = this.g;
    this.awaitCorridor = false;
    if (this.state.sawBasement) return;
    this.state.sawBasement = true;
    await g.lockPlayer(true);
    await g.lookAt(-22, 0.3, 1500, 0);
    audio.stinger();
    this.flicker(2.4, 1);
    this.shadow.show(-13, 0.35, 2, { yaw: -Math.PI / 2, mode: 'stand', life: 3.6 });
    await this.saySeq('first_appearance');
    await wait(400);
    this.shadow.hide(0.2);
    audio.slam();
    g.player.shake = 0.2;
    this.setChase('hunt');
    await g.lockPlayer(false);
    this.state.save();
  }

  setChase(mode) {
    const g = this.g;
    if (mode === 'idle') {
      this.chaseActive = false;
      this.excited = false;
      this.monster.deactivate();
      return;
    }
    this.chaseActive = true;
    this.excited = true;
    const lv = this.level;
    // spawn far away, and always in the corridor: the first contact is a sound
    // coming down the passage, never a face already in your room
    const spawnAt =
      mode === 'flee'
        ? { x: this.g.player.pos.x > 0 ? -22 : 22, z: 0.3 }
        : { x: this.g.player.pos.x > 0 ? -22 : 22, z: 0.3 };
    this.monster.activate(lv, spawnAt.x, spawnAt.z, mode === 'flee' ? 'hunt' : 'stalk');
    if (mode === 'flee') this.monster.state = 'hunt';
    this.monster.speed = mode === 'flee' ? 3.15 : 1.05;
    g.ui.toast('🚨 ' + (mode === 'flee' ? 'RUN' : 'SOMETHING IS DOWN HERE'));
  }

  onHideToggle(hidden) {
    if (!this.chaseActive) return;
    if (hidden) audio.burst({ dur: 0.5, freq: 300, gain: 0.25, rate: 0.4 });
    this.hideT = 0;
  }

  update(dt, t) {
    // flicker decay
    for (let i = this.flickers.length - 1; i >= 0; i--) {
      const f = this.flickers[i];
      f.t -= dt;
      if (f.t <= 0) {
        for (const fx of f.list) fx.flicker = f.restore;
        this.flickers.splice(i, 1);
      }
    }
    if (!this.started) return;
    // basement first sighting: trigger when the player walks into the passage
    if (this.awaitCorridor && this.level === 2 && Math.abs(this.g.player.pos.z) < 1.0) {
      this.basementAppearance();
      return;
    }
    // chase rules
    if (this.chaseActive && this.monster.node.visible) {
      const d = this.monster.dist(this.g.player);
      if (this.state.chasePhase === 'key' && this.g.hidden && d < 3.4) {
        this.hideT = (this.hideT || 0) + dt;
        if (this.hideT > 5.5) this.escapeChase();
      }
      if (d < 3.2 && this.state.chasePhase === 'key') {
        this.excited = true;
        if (!this._scareT || t - this._scareT > 7) {
          this._scareT = t;
          audio.whisper(rand() > 0.5 ? 0.6 : -0.6);
          if (rand() > 0.6) this.ui.say('rohan', pick(DIALOGUE.scared).t);
        }
      }
    }
    if (this.state.chasePhase === 'fuse' || this.state.chasePhase === 'flee') this.excited = true;
  }

  escapeChase() {
    audio.burst({ dur: 1.1, freq: 240, gain: 0.2, rate: 0.35 });
    this.monster.state = 'search';
    this.state.chasePhase = 'fuse';
    this.ui.toast('It moved on.');
    this.saySeq('chase_lost');
    this.refreshObjective();
  }

  async onCaught() {
    const g = this.g;
    if (g.cutscene || this.endingShown) return;
    this.state.caught++;
    audio.stinger();
    g.player.shake = 0.34;
    this.ui.big('COLD', 1400);
    await g.lockPlayer(true);
    await this.ui.say('system', DIALOGUE.caught[0].t, 1600);
    const s = this.state;
    if (s.caught >= 3 && s.chasePhase !== 'idle') {
      await this.ending('trapped');
      return;
    }
    // thrown back to the corridor with the friends
    const lvl = this.level;
    await g.teleportTo(lvl === 2 ? 12 : 8, lvl === 2 ? -0.6 : 0.4, lvl, Math.PI, { fade: 420 });
    this.monster.speed = clamp(this.monster.speed - 0.15, 2.4, 3.4);
    this.monster.state = 'hunt';
    await g.lockPlayer(false);
    this.saySeq('safe');
  }

  // ------------------------------------------------------------- chapter 5 --
  async enterFinalRoom() {
    const g = this.g;
    this.state.chapter = 5;
    this.state.stage = 'ch5_final';
    this.state.attendanceStarted = true;
    this.setChase('idle');
    const lvl = this.world.levels[2];
    for (const f of lvl.fixtures) {
      f.enabled = true;
      f.on = true;
      f.flicker = 0.5;
    }
    await g.lockPlayer(true);
    audio.slam();
    const d = this.world.door(2, 'd_final');
    if (d) d.setOpen(false);
    await this.saySeq('final_room');
    await wait(300);

    if (this.state.secretReady) {
      await this.saySeq('choice');
      const v = await this.ui.choice(
        'THE REGISTER IS OPEN ON THE DESK',
        'Eight pieces of paper and you understand the thing at last: he is not a monster. He is a record that was never corrected. The lights are his lesson period and the register is his teacher.<br><br><b>Meera:</b> “Tum choose karo. Dono ka ek hi price hai — hum.”',
        [
          { label: 'Take the records and REVEAL THE TRUTH', hint: 'Secret ending — walk it out in daylight', value: 'reveal', class: 'secret' },
          { label: 'Leave the school FOREVER', hint: 'Secret ending — close the door and never speak of it', value: 'leave', class: 'ghost' },
          { label: 'Sit down. Take the attendance.', hint: 'The register wants a fifth name', value: 'sit' },
        ]
      );
      if (v === 'reveal') return this.ending('secret_reveal');
      if (v === 'leave') return this.ending('secret_leave');
      if (!v) return;
    }

    await this.saySeq('attendance', { name: this.playerName });
    this.ui.big(this.playerName + ' —', 1900);
    await wait(1900);
    // one heartbeat of choice: answer, or run
    const run = await this.ui.choice(
      'THE ROOM IS WAITING FOR YOUR ANSWER',
      'Your mouth is open. The dark behind the blackboard is leaning in to hear it.<br><b>Kabir:</b> “Arjun. agar uthna hai to ab utho. Abhi.”',
      [
        { label: 'Answer “Present.”', hint: 'Stay. Take your name in the register.', value: 'stay' },
        { label: 'STAND UP AND RUN', hint: 'Sprint for the gate — no fighting, just legs', value: 'run' },
      ]
    );
    if (run === 'run') {
      await g.lockPlayer(false);
      this.ui.toast('RUN');
      audio.slam();
      await g.teleportTo(11.5, -0.7, 2, 0, { fade: 420 });
      this.setChase('flee');
      this.state.chasePhase = 'flee';
      this.state.stage = 'ch4_flee';
      this.state.chapter = 4;
      this.refreshObjective();
      return;
    }
    audio.burst({ dur: 2.2, freq: 120, gain: 0.4, rate: 0.25 });
    for (const f of lvl.fixtures) f.on = false;
    await wait(900);
    await this.ending(this.state.caught === 0 ? 'escape' : 'trapped');
  }

  async leaveFinalRoom() {
    const g = this.g;
    await g.lockPlayer(true);
    this.ui.big('RUN', 1200);
    audio.slam();
    await g.teleportTo(12.5, -0.6, 2, 0, { fade: 500 });
    this.setChase('flee');
    this.state.chasePhase = 'flee';
    await g.lockPlayer(false);
    this.refreshObjective();
  }

  // ------------------------------------------------------------- endings ---
  async ending(kind) {
    if (this.endingShown) return;
    this.endingShown = true;
    this.ui.endShown = true;
    const g = this.g;
    this.state.ending = kind;
    this.state.save();
    this.chaseActive = false;
    this.excited = false;
    this.monster.deactivate();
    await g.lockPlayer(true);
    document.exitPointerLock?.();
    audio.setTension(0);
    await wait(500);
    const titles = {
      escape: 'ENDING — ESCAPE',
      trapped: 'ENDING — TRAPPED',
      secret_reveal: 'SECRET ENDING — CLASS DISMISSED',
      secret_leave: 'SECRET ENDING — THE DOOR YOU CLOSED',
    };
    const paras = (DIALOGUE['ending_' + kind] || DIALOGUE.ending_escape).map((p) => p.replace('{playerName}', this.playerName));
    const body = paras
      .map((p, i) => `<p class="${/PRESENT|Status/.test(p) ? 'mark' : ''}">${p}</p>`)
      .join('');
    const stats = `Clues ${this.state.clueTotal}/${this.state.clueMax} · Times caught ${this.state.caught} · Power ${this.state.power ? 'restored' : 'never restored'}`;
    this.ui.el.endcard.classList.remove('hidden');
    this.ui.el.endcard.querySelector('#end-title').textContent = titles[kind] || 'THE END';
    this.ui.el.endcard.querySelector('#end-body').innerHTML = body + `<div id="end-stats">${stats}</div>`;
    const bg = kind.startsWith('secret') ? 'rgba(24,14,40,.9)' : kind === 'trapped' ? 'rgba(30,6,10,.9)' : 'rgba(4,8,12,.94)';
    this.ui.el.endcard.style.background = bg;
  }

  // -------------------------------------------------------- interactions ---
  /** hide things that are not relevant yet, so the prompts stay readable */
  blocked(it) {
    const s = this.state;
    if (it.taken) return true;
    // an interaction can require an item (e.g. the register wants the store key)
    if (it.locked === 'needs_reception_key' && !this.g.items.has('key_reception')) return 'needs the store key';
    // the hidden stairwell only exists once the panel has been opened
    if (it.id === 'f_up' && !s.codeEntered) return true;
    // the iron key only materialises once you are being hunted
    if (it.gated === 'chase_key' && !this.chaseActive && !s.hasFuseKey) return true;
    // the chair in the last classroom only exists for the final chapter
    if (it.id === 'sit_chair' && s.chapter < 5) return true;
    return false;
  }

  specialPrompt(it) {
    const s = this.state;
    switch (it.special) {
      case 'gate':
        if (s.gateLocked && !s.fusePulled) return 'Locked from the outside. Somebody threw the bolts.';
        if (s.fusePulled && s.stage === 'ch4_flee') return 'RUN — go through the gate';
        return s.gateLocked ? 'The gate is bolted' : 'Push the gate';
      case 'breaker':
        return `${s.gen.breaker ? 'Switch' : 'Raise'} the breaker`;
      case 'valve':
        return `${s.gen.valve ? 'Close' : 'Open'} the fuel valve`;
      case 'start':
        return 'Turn the start lever';
      case 'register':
        return s.readRegister ? 'Read the register again' : 'Open the attendance register';
      case 'drawer':
        return s.readDrawer ? 'Empty now' : 'Open the drawer with the key';
      case 'board':
        return 'Read the blackboard';
      case 'panel':
        return s.codeEntered ? 'The panel hangs open' : `Set the four dials (${s.digitsFound}/4)`;
      case 'lab_cabinet':
        return this.g.items.has('brass_key') ? 'The key on the hook fits' : 'Locked — a key marked PERIOD 6';
      case 'fuse':
        return s.fusePulled ? 'The fuse is already pulled' : s.hasFuseKey ? 'Pull the main fuse handle' : 'Locked handle';
      case 'portrait':
        return 'Lift the cloth';
      case 'final_board':
        return 'Read the blackboard';
      case 'final_register':
        return s.chapter >= 5 ? 'Sign the register' : 'Take the register';
      case 'chair':
        return 'Sit down';
      default:
        return it.label;
    }
  }

  canOpenDoor(door) {
    const s = this.state;
    if (!door.locked) return true;
    if (door.locked === 'needs_reception_key') return this.g.items.has('key_reception');
    if (door.locked === 'needs_brass_key') return this.g.items.has('brass_key');
    if (door.locked === 'needs_fuse_key') return s.hasFuseKey || s.fusePulled;
    return true;
  }

  lockReason(door) {
    if (door.locked === 'needs_brass_key') return 'a key marked PERIOD 6';
    if (door.locked === 'needs_fuse_key') return 'an iron key';
    if (door.locked === 'needs_reception_key') return 'the store key';
    return 'locked';
  }

  async useDoor(it) {
    const g = this.g;
    const door = this.world.door(it.level, it.door);
    if (!door) return;
    if (door.locked && !this.canOpenDoor(door)) {
      audio.burst({ dur: 0.24, freq: 620, gain: 0.22, rate: 0.7 });
      g.player.shake = 0.02;
      this.ui.toast(`Locked — ${this.lockReason(door)}`);
      if (this.chaseActive && rand() > 0.55) audio.whisper(Math.sin(g.player.yaw) * 0.7);
      return;
    }
    const opening = !door.open;
    door.setOpen(opening);
    audio.creak();
    if (!opening) audio.burst({ dur: 0.28, freq: 260, gain: 0.22, rate: 0.5 });
    if (opening && door.special && this.level === 2) {
      await this.enterFinalRoom();
    }
  }

  async useStairs(it) {
    const g = this.g;
    const to = it.to;
    if (it.id === 'f_up' && !this.state.codeEntered) return;
    if (to === 2) {
      const sp = FLOORS[2].spawn;
      await g.teleportTo(sp.x, sp.z, 2, sp.yaw, { fade: 800 });
      await this.chapterFour(true);
      return;
    }
    const sp = FLOORS[to].spawn;
    await g.teleportTo(sp.x, sp.z, to, sp.yaw, { fade: 700 });
    this.ui.toast(this.world.levels[to].def.name);
    if (to === 1 && this.state.chasePhase === 'idle') this.refreshObjective();
    if (to === 0 && this.state.stage === 'ch4_flee') {
      // still running
      this.monster.level = 0;
      this.monster.activate(0, 20, 6, 'hunt');
    }
  }

  /** the single entry point for every "press E on a thing" */
  async interact(it) {
    const g = this.g;
    const s = this.state;
    if (it.special === 'gate') return this.onGate();
    if (it.special === 'breaker') return this.generatorStep('breaker');
    if (it.special === 'valve') return this.generatorStep('valve');
    if (it.special === 'start') return this.generatorStep('start');
    if (it.special === 'register') return this.readRegister();
    if (it.special === 'drawer') return this.openDrawer();
    if (it.special === 'board') return this.readBoard();
    if (it.special === 'panel') return this.usePanel();
    if (it.special === 'lab_cabinet') return this.openLabCabinet();
    if (it.special === 'fuse') return this.pullFuse();
    if (it.special === 'portrait') return this.lookPortrait();
    if (it.special === 'final_register') return this.onFinalRegister();
    if (it.special === 'final_board') return this.onFinalBoard();
    if (it.special === 'chair') return this.enterFinalRoom();
    if (it.special === 'bookcase') return this.touchBookcase();

    if (it.take) {
      s.itemsTaken = s.itemsTaken || [];
      if (!s.itemsTaken.includes(it.take)) s.itemsTaken.push(it.take);
      g.addItem(it.take, ITEM_NAMES[it.take]?.name || it.take, ITEM_NAMES[it.take]?.icon || '•', ITEM_NAMES[it.take]?.hint);
      it.taken = true;
      if (it.marker) it.marker.visible = false;
      audio.pickup();
      this.ui.toast('TAKEN — ' + (ITEM_NAMES[it.take]?.name || it.take));
      if (it.take === 'key_fuse') {
        s.hasFuseKey = true;
        this.state.stage = 'ch4_fuse';
        this.refreshObjective();
        this.ui.toast('Fuse room — pull the main handle');
      }
      if (it.take === 'brass_key') {
        this.ui.toast('A key marked PERIOD 6. It fits two doors.');
      }
      s.save();
      if (it.text) await this.ui.reader(it.label, [it.text]);
      return;
    }

    if (it.text) {
      audio.page();
      await this.ui.reader(it.label, it.text.split('\n\n'));
    }
    if (it.give?.digit) {
      const { slot, value } = it.give.digit;
      if (s.setDigit(slot, value)) {
        this.ui.big(`${value}`, 900);
        await this.ui.say('meera', DIALOGUE.digit_found[0].t.replace('{n}', s.digitsFound));
        if (s.digitsFound === 4) {
          s.stage = 'ch3_panel';
          this.ui.toast('All four digits. The panel, old classroom.');
        }
        this.refreshObjective();
        s.save();
      }
    }
    if (it.give?.battery) {
      g.addItem('torch', 'Torch', '🔦', 'Press F');
      it.taken = true;
      if (it.marker) it.marker.visible = false;
      audio.pickup();
    }
    if (it.clue) this.addClue(it.clue);
    this.refreshObjective();
  }

  addClue(id) {
    if (!this.state.addClue(id)) return;
    audio.pickup();
    this.ui.big('TRUTH RECOVERED', 1400);
    this.ui.toast(`📄 ${CLUE_TITLES[id] || id}`);
    this.g.setClues();
    if (this.state.secretReady) {
      this.ui.toast('✦ You now know enough to answer back.');
      audio.tone({ freq: 330, dur: 1.2, gain: 0.1, slide: 120 });
    }
  }

  async touchBookcase() {
    if (this.state.codeEntered) {
      await this.ui.reader('Behind the bookcase', [
        'The opening is a square of darker dark. Iron rungs go down into it, and cold air comes up — the particular cold of a room that has been holding its breath since 1998.',
        '<i>From somewhere below, very far, a chair leg scrapes concrete.</i>',
        '<b>Meera:</b> “Do not go down alone. Nobody goes down alone. Take the torch, take the register list, take everything you have found — the more we know, the less of it is his.”',
      ]);
      this.ui.toast('Use the ladder (E) to go down');
      return;
    }
    audio.burst({ dur: 0.5, freq: 220, gain: 0.24, rate: 0.4 });
    await this.ui.reader('A bookcase that does not fit the wall', [
      'It is 30 mm too deep for the alcove it stands in, and it is nailed — no, <i>sealed</i> — into the plaster on both sides.',
      'Someone wanted this wall to stay a wall.',
      'Along the top rail, in chalk: <b>『 FOUR MARKS, ONE YEAR 』</b>',
    ]);
    if (this.state.chapter < 3) {
      this.state.chapter = 3;
      this.state.stage = 'ch3_digits';
      this.refreshObjective();
    }
  }

  async openLabCabinet() {
    if (!this.g.items.has('brass_key')) {
      audio.burst({ dur: 0.24, freq: 620, gain: 0.2, rate: 0.7 });
      return this.ui.toast('Locked. The label says the key is with the headmaster.');
    }
    await this.ui.reader('Specimen cabinet', [
      'Inside, on a shelf of its own: forty-one glass slides, each labelled with a student name.',
      'The forty-second slot is empty except for a paper tag, and the tag has been written on both sides — one side in 1998, the other in pencil, fresh:',
      '<b>『 HE IS NOT ON A SLIDE. HE IS IN THE ROOM. 』</b>',
    ]);
    this.addClue('ring');
  }

  async pullFuse() {
    const s = this.state;
    if (s.fusePulled) return;
    s.fusePulled = true;
    s.stage = 'ch4_flee';
    const g = this.g;
    await g.lockPlayer(true);
    audio.burst({ dur: 0.5, freq: 900, gain: 0.4, rate: 0.5, type: 'bandpass', q: 3 });
    audio.slam();
    for (const lvl of this.world.levels) for (const f of lvl.fixtures) f.on = false;
    audio.setPower(false);
    this.flicker(1.2, 0);
    await this.saySeq('fuse_pulled');
    // the monster loses its hold on the building: it stops, and the gate opens
    this.monster.state = 'frozen';
    this.setFinalDoorLocked(false);
    this.setGateLocked(false);
    this.world.setGateOpen(true);
    this.ui.big('EVERY LIGHT IS DEAD', 2200);
    await wait(700);
    s.stage = 'ch4_flee';
    this.chaseActive = true;
    this.excited = true;
    this.monster.state = 'hunt';
    this.monster.speed = 3.3;
    await g.lockPlayer(false);
    this.refreshObjective();
    s.save();
  }

  setFinalDoorLocked(v) {
    const d = this.world.door(2, 'd_final');
    if (d) d.locked = v ? 'needs_fuse_key' : null;
  }
  setGateLocked(v) {
    const s = this.state;
    s.gateLocked = v;
    const it = this.g.interactables.find((i) => i.id === 'main_gate');
    if (it) it.lockedGate = v;
    const ex = this.g.interactables.find((i) => i.id === 'gate_exit');
    if (ex) ex.lockedGate = v;
  }

  async onGate() {
    const s = this.state;
    const g = this.g;
    if (s.stage === 'outside') {
      await this.chapterOne();
      return;
    }
    if (s.fusePulled || s.stage === 'ch4_flee') {
      return this.ending('escape');
    }
    audio.burst({ dur: 0.3, freq: 520, gain: 0.25, rate: 0.6 });
    this.ui.toast(s.gateLocked ? 'Bolted. Power would fix a lot of things.' : 'It is not locked. Not yet.');
  }

  onFinalRegister() {
    if (this.state.chapter < 5) {
      this.ui.toast('You take the register. It is heavier than paper.');
      this.g.addItem('register', 'The Register', '📕', 'Do not open it at home');
      return this.enterFinalRoom();
    }
    return this.ui.reader('The register', ['One line left blank. The pen is already in your hand.']);
  }

  onFinalBoard() {
    return this.ui.reader('The blackboard', [
      '<div style="text-align:center;font-size:24px;font-family:\'Segoe Print\',cursive;line-height:1.7">LESSON: WHAT YOU WRITE DOWN<br>IS WHAT HAPPENED</div>',
      'Under the lesson, in the child\'s handwriting: <b>“I can go when the bell rings. Sir, ring the bell.”</b>',
    ]);
  }

  lookPortrait() {
    this.addClue('portrait');
    return this.ui.reader('Portrait under the cloth', [
      'A school portrait, framed, kept clean for twenty years.',
      'A boy in a pressed uniform, hands folded, shoes polished. The nameplate reads <b>AARAV VERMA — 1998 — PRESENT</b>.',
      'Somebody has added a line below it in a shaking adult hand: <b>“Sorry.”</b>',
    ]);
  }

  // ------------------------------------------------------------- journal ---
  openJournal() {
    const s = this.state;
    const all = Object.keys(CLUE_TITLES);
    const items = all
      .map((id) => {
        const got = s.hasClue(id);
        return `<p><b>${got ? '📄' : '▢'} ${CLUE_TITLES[id]}</b>${got ? '' : ' <i class="dim">— not found</i>'}</p>`;
      })
      .join('');
    const digits = `<p><b>Panel digits</b>: ${s.code} ${s.codeEntered ? '(used)' : ''}</p>`;
    const core = CORE_CLUES.filter((c) => s.hasClue(c)).length;
    return this.ui.reader(
      `Journal — ${core}/${CORE_CLUES.length} truths${s.secretReady ? ' ✦' : ''}`,
      [
        `<p class="dim">${s.secretReady ? 'You know the whole story. In the last room you will get a choice.' : 'Truths are pieces of paper. The school does not like them being read.'}</p>`,
        items,
        digits,
      ],
      { closeLabel: 'CLOSE', paper: 'aged' }
    );
  }

  openDebugMenu() {
    this.ui.reader('Debug', ['1-5 jump chapter · G give keys · X skip beat · T teleport · F2 reveal']);
  }

  // ------------------------------------------------------------ utilities --
  async saySeq(id, vars = {}) {
    const lines = DIALOGUE[id] || [];
    for (const l of lines) {
      let text = l.t;
      for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, v);
      await this.say(l.s, text);
    }
  }

  async say(speaker, text, ms) {
    if (this.g.g_skip) return;
    const g = this.g;
    const who = speaker === 'arjun' ? 'player' : speaker;
    const pos = g.friends.positionOf(speaker === 'player' || speaker === 'arjun' ? 'player' : who === 'meera' ? 'friend2' : who === 'kabir' ? 'friend1' : who === 'rohan' ? 'friend3' : null);
    if (pos) {
      const dx = pos.x - g.player.pos.x;
      const pan = clamp(dx / 6, -0.85, 0.85);
      audio.burst({ dur: 0.16, freq: 1200, gain: 0.045, rate: 1.2, pan });
    }
    await this.ui.say(who, text, ms);
  }

  flicker(dur = 1.4, intensity = 1, level = this.level) {
    const lvl = this.world.levels[level];
    if (!lvl) return;
    const list = lvl.fixtures.filter(() => true);
    for (const f of list) {
      f.restore = f.flicker;
      f.flicker = 0.5 + Math.random() * 0.5 * intensity;
    }
    if (intensity > 0.5) audio.hum(0.8);
    this.flickers.push({ t: dur, list, restore: list.map((f) => f.restore) });
    // restore properly
    setTimeout(() => list.forEach((f, i) => (f.flicker = f.restore ?? 0)), dur * 1000);
  }

  /** rebuild the HUD inventory strip from the flags we care about */
  syncInventory() {
    const g = this.g;
    const s = this.state;
    if (g.items) {
      g.items.clear();
      if (s.itemsTaken?.includes('key_reception')) g.addItem('key_reception', 'Store key', '\ud83d\udddd');
      for (const id of s.itemsTaken || []) {
        const meta = ITEM_NAMES[id] || { name: id, icon: '•' };
        g.addItem(id, meta.name, meta.icon, meta.hint);
      }
      void [g];
    }
    this.refreshObjective();
  }

  refreshObjective() {
    const obj = this.state.objective();
    this.ui.setObjective(obj);
    const ch = CHAPTERS.find((c) => c.id === this.state.chapter);
    this.ui.setChapter(this.state.chapter, ch ? ch.title : 'Prologue');
    this.g.setClues();
  }

  async restartChapter() {
    const n = clamp(this.state.chapter || 1, 1, 5);
    await this.jumpToChapter(n, true);
  }

  async jumpToChapter(n, soft = false) {
    const g = this.g;
    await g.lockPlayer(true);
    this.endingShown = false;
    g.ui.el.endcard?.classList.add('hidden');
    this.ui.endShown = false;
    const s = this.state;
    s.chapter = n;
    const level = n <= 2 ? 0 : n === 3 ? 1 : 2;
    s.level = level;
    if (n >= 2) s.gateLocked = true;
    if (n >= 2) {
      s.power = true;
      s.gen = { breaker: true, valve: true, start: true };
      for (const lvl of this.world.levels) for (const f of lvl.fixtures) {
        f.enabled = lvl.index < 2;
        f.on = lvl.index < 2;
      }
      audio.setPower(true);
    }
    if (n >= 3) {
      s.stage = 'ch3_digits';
      g.addItem('key_reception', 'Store key', '🗝', 'Reception drawer');
    }
    if (n >= 4) {
      s.codeEntered = true;
      s.inBasement = true;
      this.openBookcase(true);
      s.stage = 'ch4_records';
      g.addItem('brass_key', 'Brass key', '🗝', 'Period 6 room');
    }
    if (n >= 5) {
      s.hasFuseKey = true;
      s.fusePulled = false;
      this.setFinalDoorLocked(false);
      s.stage = 'ch5_wait';
      this.chaseActive = false;
      s.chasePhase = 'idle';
      this.monster.deactivate();
    }
    if (n < 5) {
      this.setFinalDoorLocked(true);
      this.chaseActive = n === 4;
      s.chasePhase = n === 4 ? 'hunt' : 'idle';
      if (n === 4) this.monster.activate(2, 18, 6, 'stalk');
      else this.monster.deactivate();
    }
    const sp = FLOORS[level].spawn;
    await g.teleportTo(level === 2 ? (n >= 5 ? 8 : -14) : sp.x, level === 2 ? (n >= 5 ? -0.7 : 4.6) : sp.z, level, level === 0 ? 0 : Math.PI, { fade: 800 });
    this.refreshObjective();
    const ch = CHAPTERS.find((c) => c.id === n);
    await this.ui.titleCard(n, ch.title, 'debug jump', 1500);
    await g.lockPlayer(false);
    s.save();
  }

  debugMenu() {
    this.ui.toast('debug: 1-5 jump · G keys · T reveal all');
  }
}

const ITEM_NAMES = {
  key_reception: { name: 'Store key', icon: '🗝', hint: 'Opens the reception drawer' },
  brass_key: { name: 'Brass key', icon: '🗝', hint: 'Marked PERIOD 6' },
  key_fuse: { name: 'Iron key', icon: '🗝', hint: 'Fuse room handle' },
  torch: { name: 'Torch', icon: '🔦', hint: 'F' },
  register: { name: 'The Register', icon: '📕', hint: 'Do not open it at home' },
};
