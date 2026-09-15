// ---------------------------------------------------------------------------
// Input: pointer lock mouse-look + keys. Kept deliberately simple: `held`
// for movement, one-shot callbacks for actions, and a `locked` gate so that
// cutscenes/menus can take control away from the player.
// ---------------------------------------------------------------------------

const KEYMAP = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  ControlLeft: 'crouch',
  KeyC: 'crouch',
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = {};
    this.delta = { x: 0, y: 0 };
    this.locked = false;
    this.enabled = true;
    this.sensitivity = 0.0022;
    this.actions = new Set();
    this.onAction = null; // (name) => void

    window.addEventListener('keydown', (e) => this.keydown(e), { passive: false });
    window.addEventListener('keyup', (e) => this.keyup(e));
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked && this.enabled) canvas.requestPointerLock?.();
      else if (e.button === 0) this.fire('click');
    });
    document.addEventListener('mouseup', (e) => {
      if (this.locked && e.button === 2) this.fire('rightclick');
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.delta.x += e.movementX;
      this.delta.y += e.movementY;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.fire(this.locked ? 'lock' : 'unlock');
    });
    window.addEventListener('blur', () => {
      this.held = {};
    });
  }

  fire(name) {
    if (this.actions.has(name)) return;
    this.actions.add(name);
    this.onAction?.(name);
  }

  drainActions() {
    this.actions.clear();
  }

  keydown(e) {
    const a = KEYMAP[e.code];
    if (a) {
      this.held[a] = true;
      e.preventDefault();
      return;
    }
    if (['Escape', 'KeyE', 'KeyF', 'KeyI', 'KeyV', 'KeyT', 'KeyH', 'KeyM', 'KeyP', 'Enter', 'Space'].includes(e.code)) {
      if (e.code === 'Escape' && this.locked) {
        document.exitPointerLock?.();
        return;
      }
      this.held[e.code] = true;
      this.fire(e.code);
      if (e.code !== 'Tab') e.preventDefault();
    }
  }

  keyup(e) {
    const a = KEYMAP[e.code];
    if (a) this.held[a] = false;
    this.held[e.code] = false;
  }

  axis() {
    const x = (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0);
    const z = (this.held.back ? 1 : 0) - (this.held.forward ? 1 : 0);
    return { x, z };
  }

  consumeLook() {
    const d = { x: this.delta.x * this.sensitivity, y: this.delta.y * this.sensitivity };
    this.delta.x = 0;
    this.delta.y = 0;
    return d;
  }
}
