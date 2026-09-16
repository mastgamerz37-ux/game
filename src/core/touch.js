// ---------------------------------------------------------------------------
// TouchControls — plays the game on a phone. Auto-enabled on coarse pointers
// (or with ?touch=1, disabled with ?touch=0). It only writes into the same
// Input object the keyboard/mouse uses, so gameplay code is untouched.
// ---------------------------------------------------------------------------

export class TouchControls {
  constructor(input, game) {
    this.input = input;
    this.g = game;
    this.enabled = false;
    this.stick = { x: 0, z: 0, id: null, cx: 0, cy: 0 };
    this.look = { id: null, x: 0, y: 0 };
    this.sprintOn = false;
  }

  static shouldEnable() {
    const q = new URLSearchParams(location.search);
    if (q.has('touch')) return q.get('touch') !== '0';
    return matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
  }

  mount(root) {
    if (this.enabled) return;
    this.enabled = true;
    this.input.touch = true;
    root.insertAdjacentHTML(
      'beforeend',
      `<div id="touch">
         <div id="t-stick"><i></i></div>
         <div id="t-pad"></div>
         <div id="t-btns">
           <button data-act="KeyE" class="big">USE</button>
           <button data-act="KeyF">TORCH</button>
           <button data-act="KeyV">VIEW</button>
           <button data-act="KeyJ">NOTES</button>
           <button data-act="sprint" class="toggle">RUN</button>
           <button data-act="crouch" class="toggle">SIT</button>
           <button data-act="KeyM">MUTE</button>
         </div>
         <button id="t-menu" data-act="Escape">MENU</button>
       </div>`
    );
    this.el = root.querySelector('#touch');
    this.stickEl = root.querySelector('#t-stick');
    this.knob = this.stickEl.querySelector('i');
    this.padEl = root.querySelector('#t-pad');

    const opts = { passive: false };
    this.stickEl.addEventListener('touchstart', (e) => this.stickStart(e), opts);
    this.stickEl.addEventListener('touchmove', (e) => this.stickMove(e), opts);
    this.stickEl.addEventListener('touchend', (e) => this.stickEnd(e), opts);
    this.padEl.addEventListener('touchstart', (e) => this.lookStart(e), opts);
    this.padEl.addEventListener('touchmove', (e) => this.lookMove(e), opts);
    this.padEl.addEventListener('touchend', (e) => this.lookEnd(e), opts);
    root.querySelector('#t-menu').addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.g.onAction('Escape');
    }, opts);
    this.el.querySelectorAll('#t-btns button').forEach((b) => {
      b.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const act = b.dataset.act;
        if (act === 'sprint' || act === 'crouch') {
          // toggles write straight into `held`, which is where the controller
          // reads Shift/C from on the keyboard
          const on = !this.input.held[act];
          this.input.held[act] = on;
          b.classList.toggle('on', on);
          return;
        }
        this.g.onAction(act);
      }, opts);
    });
    // a tap on the 3D view should also be usable as "look" even before the pad
    // exists; and on iOS a tap is needed once to unlock WebAudio.
    this.g.canvas.addEventListener('touchstart', (e) => this.g.audioResumeOnce?.(), { passive: true });
  }

  // ---- left thumb: movement ------------------------------------------------
  stickStart(e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    const r = this.stickEl.getBoundingClientRect();
    this.stick.id = t.identifier;
    this.stick.cx = r.left + r.width / 2;
    this.stick.cy = r.top + r.height / 2;
    this.stick.radius = r.width / 2;
    this.stickMove(e);
  }

  stickMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== this.stick.id) continue;
      const dx = (t.clientX - this.stick.cx) / this.stick.radius;
      const dy = (t.clientY - this.stick.cy) / this.stick.radius;
      const len = Math.min(1, Math.hypot(dx, dy));
      const a = Math.atan2(dy, dx);
      const kx = Math.cos(a) * len;
      const ky = Math.sin(a) * len;
      this.knob.style.transform = `translate(${kx * 34}px, ${ky * 34}px)`;
      // stick pushed up = walk forward, so screen-y is flipped
      this.input.virtual = { x: kx, z: -ky };
    }
  }

  stickEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier !== this.stick.id) continue;
      this.stick.id = null;
      this.input.virtual = null;
      this.knob.style.transform = 'translate(0,0)';
    }
  }

  // ---- right thumb: look --------------------------------------------------
  lookStart(e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    this.look.id = t.identifier;
    this.look.x = t.clientX;
    this.look.y = t.clientY;
  }

  lookMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== this.look.id) continue;
      this.input.delta.x += (t.clientX - this.look.x) * 1.6;
      this.input.delta.y += (t.clientY - this.look.y) * 1.6;
      this.look.x = t.clientX;
      this.look.y = t.clientY;
    }
  }

  lookEnd(e) {
    for (const t of e.changedTouches) if (t.identifier === this.look.id) this.look.id = null;
  }
}
