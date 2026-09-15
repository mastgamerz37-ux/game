// ---------------------------------------------------------------------------
// GameState — every flag the story director and the world need, in one place.
// Chapter progress + clue collection persist to localStorage so a 45 minute
// play session can survive a refresh.
// ---------------------------------------------------------------------------
import { SAVE_KEY } from '../constants.js';
import { CORE_CLUES, BONUS_CLUES } from '../data/map.js';

export const CHAPTERS = [
  { id: 1, title: 'The Gate', brief: 'Andar jao. Gate lock ho chuka hai — power wapas laao.' },
  { id: 2, title: 'Attendance', brief: 'Reception ka drawer kholo aur register padho.' },
  { id: 3, title: 'The Classroom', brief: 'Char ankgan dhoondo, board ke saamne wale panel pe daalo.' },
  { id: 4, title: 'The Basement', brief: 'Neeche rikoords hain. Aur kuch aur bhi hai.' },
  { id: 5, title: 'The Last Period', brief: 'Aakhri classroom. Attendance lagni hai.' },
];

export class GameState {
  constructor() {
    this.chapter = 0; // 0 = intro/prologue, 1..5 chapters
    this.stage = 'outside';
    this.entered = false;
    this.gateLocked = false;
    this.gateOpen = false;
    this.power = false;
    this.gen = { breaker: false, valve: false, start: false };
    this.readRegister = false;
    this.readDrawer = false;
    this.clues = new Set();
    this.digits = [null, null, null, null];
    this.codeEntered = false;
    this.bookcaseOpen = false;
    this.inBasement = false;
    this.sawBasement = false;
    this.hasFuseKey = false;
    this.fusePulled = false;
    this.caught = 0;
    this.chasePhase = 'idle'; // idle | hunt | key | fuse | flee
    this.hiding = false;
    this.attendanceStarted = false;
    this.answered = false;
    this.ending = null;
    this.dead = false;
    this.firstEventDone = false;
    this.chapterTitle = '';
    this.itemsTaken = [];
  }

  get digitsFound() {
    return this.digits.filter((d) => d !== null).length;
  }

  get code() {
    return this.digits.map((d) => (d === null ? '—' : d)).join('');
  }

  hasClue(id) {
    return this.clues.has(id);
  }

  addClue(id) {
    if (this.clues.has(id)) return false;
    this.clues.add(id);
    this.save();
    return true;
  }

  get coreClues() {
    return CORE_CLUES.filter((c) => this.clues.has(c));
  }

  get secretReady() {
    return CORE_CLUES.every((c) => this.clues.has(c));
  }

  get clueTotal() {
    return this.clues.size;
  }

  get clueMax() {
    return CORE_CLUES.length + BONUS_CLUES.length;
  }

  setDigit(slot, value) {
    if (this.digits[slot] === value) return false;
    this.digits[slot] = value;
    this.save();
    return true;
  }

  objective() {
    if (this.ending) return null;
    switch (this.stage) {
      case 'outside':
        return 'Enter the school. It is a joke. It is only a joke.';
      case 'ch1_gate':
        return 'Walk in through the gate. Do not look at the dark behind it.';
      case 'ch1_locked':
        return 'Find the generator room and get the power back.';
      case 'ch1_gen':
        return 'Generator room (ground floor, east). Breaker → valve → start.';
      case 'ch2_search':
        return 'Find the store key, then open the reception drawer.';
      case 'ch2_register':
        return 'Open the attendance register on the reception desk.';
      case 'ch3_digits':
        return `Collect the four digits for the panel (${this.digitsFound}/4).`;
      case 'ch3_panel':
        return 'Enter the four digits on the panel beside the blackboard.';
      case 'ch4_down':
        return 'Go down behind the bookcase. Take every clue you can find first.';
      case 'ch4_records':
        return 'Old Records Room — find the file, then the iron key.';
      case 'ch4_key':
        return 'Take the iron key from the records room.';
      case 'ch4_fuse':
        return 'Fuse room. Pull the main handle. Kill the records.';
      case 'ch4_flee':
        return 'RUN. Upstairs. The main gate.';
      case 'ch5_wait':
        return 'Go to the room with no number. Attendance is being taken.';
      case 'ch5_final':
        return 'Sit when your name is called — or do not.';
      default:
        return null;
    }
  }

  save() {
    try {
      const d = {
        chapter: this.chapter,
        stage: this.stage,
        entered: this.entered,
        gateLocked: this.gateLocked,
        gateOpen: this.gateOpen,
        power: this.power,
        gen: this.gen,
        readRegister: this.readRegister,
        readDrawer: this.readDrawer,
        clues: [...this.clues],
        digits: this.digits,
        codeEntered: this.codeEntered,
        bookcaseOpen: this.bookcaseOpen,
        inBasement: this.inBasement,
        sawBasement: this.sawBasement,
        hasFuseKey: this.hasFuseKey,
        fusePulled: this.fusePulled,
        caught: this.caught,
        chasePhase: this.chasePhase,
        attendanceStarted: this.attendanceStarted,
        answered: this.answered,
        ending: this.ending,
        firstEventDone: this.firstEventDone,
        itemsTaken: this.itemsTaken || [],
        level: this.level,
        pos: this.pos,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(d));
    } catch (e) {
      /* private mode: just don't persist */
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      Object.assign(this, d);
      this.clues = new Set(d.clues || []);
      return true;
    } catch (e) {
      return false;
    }
  }

  static clearSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
  }
}
