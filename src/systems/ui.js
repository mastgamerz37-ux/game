// ---------------------------------------------------------------------------
// HUD + modals, plain DOM. Kept separate from rendering so you can restyle
// the whole interface without touching the 3D code.
// ---------------------------------------------------------------------------
import { CAST } from '../data/characters.js';

const $ = (id) => document.getElementById(id);

export class Ui {
  constructor(root) {
    this.root = root;
    this.root.innerHTML = `
      <div id="crosshair"></div>
      <div id="prompt" class="hidden"><div id="prompt-ring"><svg viewBox="0 0 40 40"><circle id="ring-bg" cx="20" cy="20" r="16"/><circle id="ring-fg" cx="20" cy="20" r="16"/></svg></div><div id="prompt-key">E</div><div id="prompt-label"></div></div>
      <div id="objective"><span id="objective-chapter"></span><span id="objective-text"></span></div>
      <div id="meters">
        <div class="meter"><span>Fear</span><i id="fear-fill"></i></div>
        <div class="meter"><span>Breath</span><i id="stam-fill"></i></div>
        <div class="meter small"><span>Torch</span><i id="batt-fill"></i></div>
      </div>
      <div id="inventory"></div>
      <div id="clue-count" title="J (journal)">0 / 8 truths</div>
      <div id="room-name"></div>
      <div id="subtitle" class="hidden"><b id="sub-who"></b><span id="sub-text"></span></div>
      <div id="bigtext"></div>
      <div id="vignette"></div>
      <div id="grain"></div>
      <div id="fade"></div>
      <div id="title-card" class="hidden"><div id="tc-chapter"></div><div id="tc-title"></div><div id="tc-brief"></div></div>
      <div id="modal" class="hidden"><div id="modal-box"></div></div>
      <div id="menu">
        <div id="menu-inner">
          <h1>THE LAST PERIOD</h1>
          <p class="tag">a 3D story horror — one school, five chapters, three endings</p>
          <div id="menu-status"></div>
          <button id="btn-start" autofocus>ENTER THE SCHOOL</button>
          <div class="row">
            <button id="btn-continue" class="ghost hidden">CONTINUE</button>
            <button id="btn-erase" class="ghost hidden">ERASE SAVE</button>
          </div>
          <div class="cols">
            <div>
              <h3>Controls</h3>
              <ul class="keys">
                <li><b>W A S D</b> move · <b>Shift</b> run · <b>C</b> crouch</li>
                <li><b>Mouse</b> look · <b>E</b> interact · <b>F</b> torch</li>
                <li><b>V</b> 1st / 3rd person · <b>J</b> journal (clues)</li>
                <li><b>Esc</b> pause · <b>M</b> mute · <b>H</b> hide/debug help</li>
              </ul>
            </div>
            <div>
              <h3>Your own models</h3>
              <p class="small">Drop <code>.glb / .fbx / .obj</code> into <code>public/models/</code> and list them in <code>models.json</code> as
              <code>player, friend1, friend2, friend3, ghost</code>. Same rig, same dialogue, same controller — the code never assumes which mesh you use.</p>
            </div>
          </div>
          <p class="small dim">Headphones on. Lights off. It is much better that way.</p>
        </div>
      </div>
      <div id="pause" class="hidden"><div id="pause-inner">
        <h2>PAUSED</h2>
        <div id="pause-hint" class="small dim">Esc or click to go back in.</div>
        <div class="row">
          <button id="btn-resume">RESUME</button>
          <button id="btn-mute" class="ghost">MUTE</button>
          <button id="btn-restart" class="ghost">RESTART CHAPTER</button>
          <button id="btn-abandon" class="ghost">ABANDON & ERASE SAVE</button>
        </div>
        <div id="chapter-list"></div>
      </div></div>
      <div id="endcard" class="hidden"><div id="end-inner"><h2 id="end-title"></h2><div id="end-body"></div><div class="row"><button id="btn-again">PLAY AGAIN</button></div></div></div>
      <div id="toast"></div>
      <div id="debug" class="hidden"></div>
    `;
    this.el = {
      prompt: $('prompt'),
      promptLabel: $('prompt-label'),
      ring: $('ring-fg'),
      objective: $('objective-text'),
      objectiveChapter: $('objective-chapter'),
      fear: $('fear-fill'),
      stam: $('stam-fill'),
      batt: $('batt-fill'),
      inventory: $('inventory'),
      clueCount: $('clue-count'),
      room: $('room-name'),
      subtitle: $('subtitle'),
      subWho: $('sub-who'),
      subText: $('sub-text'),
      big: $('bigtext'),
      vignette: $('vignette'),
      fade: $('fade'),
      modal: $('modal'),
      modalBox: $('modal-box'),
      titleCard: $('title-card'),
      tcChapter: $('tc-chapter'),
      tcTitle: $('tc-title'),
      tcBrief: $('tc-brief'),
      menu: $('menu'),
      pause: $('pause'),
      endcard: $('endcard'),
      toast: $('toast'),
      debug: $('debug'),
      crosshair: $('crosshair'),
      grain: $('grain'),
      menuStatus: $('menu-status'),
      endTitle: $('end-title'),
      endBody: $('end-body'),
    };
    this.subQueue = [];
    this.subActive = false;
    this.held = new Set();
  }

  // ---- fade ---------------------------------------------------------------
  fade(on, ms = 900) {
    this.el.fade.style.transition = `opacity ${ms}ms ease`;
    this.el.fade.style.opacity = on ? 1 : 0;
    this.el.fade.style.pointerEvents = on ? 'auto' : 'none';
  }

  tintFade(color, ms = 900) {
    this.el.fade.style.background = color;
    setTimeout(() => (this.el.fade.style.background = '#000'), ms + 200);
  }

  // ---- objective / hud ---------------------------------------------------
  setChapter(n, title) {
    this.el.objectiveChapter.textContent = n ? `CH ${n} · ${title}` : 'PROLOGUE';
  }

  setObjective(text) {
    this.el.objective.textContent = text || '';
    this.el.objective.style.opacity = text ? 1 : 0;
  }

  setMeters({ fear = 0, stamina = 1, battery = 1 }) {
    this.el.fear.style.width = `${Math.round(fear * 100)}%`;
    this.el.stam.style.width = `${Math.round(stamina * 100)}%`;
    this.el.batt.style.width = `${Math.round(battery * 100)}%`;
    this.el.vignette.style.setProperty('--fear', fear.toFixed(3));
    this.el.grain.style.setProperty('--fear', fear.toFixed(3));
    this.el.crosshair.style.opacity = fear > 0.75 ? 0.25 : 0.55;
  }

  setPrompt(label, progress = 0, key = 'E') {
    if (!label) {
      this.el.prompt.classList.add('hidden');
      return;
    }
    this.el.prompt.classList.remove('hidden');
    this.el.promptLabel.textContent = label;
    $('prompt-key').textContent = key;
    const c = 2 * Math.PI * 16;
    this.el.ring.style.strokeDasharray = `${c}`;
    this.el.ring.style.strokeDashoffset = `${c * (1 - progress)}`;
  }

  setInventory(items) {
    this.el.inventory.innerHTML = items
      .map((it) => `<div class="inv-item" title="${it.hint || ''}"><i>${it.icon}</i><span>${it.name}</span></div>`)
      .join('');
  }

  setClues(found, total, secret) {
    this.el.clueCount.textContent = `${found} / ${total} truths${secret ? ' ✦' : ''}`;
    this.el.clueCount.classList.toggle('secret', !!secret);
  }

  setRoom(name) {
    this.el.room.textContent = name || '';
  }

  // ---- subtitles ----------------------------------------------------------
  async say(who, text, ms) {
    this.subQueue.push({ who, text, ms });
    if (this.subActive) return;
    this.subActive = true;
    while (this.subQueue.length) {
      const { who, text, ms } = this.subQueue.shift();
      await this.showSub(who, text, ms);
    }
    this.subActive = false;
  }

  async showSub(who, text, ms) {
    const names = { arjun: 'Arjun (you)', kabir: 'Kabir', meera: 'Meera', rohan: 'Rohan', system: '', entity: 'THE REGISTER', player: 'Arjun (you)' };
    const col = { kabir: '#e88b78', meera: '#7fd6b8', rohan: '#f0d878', entity: '#cfe0ff', system: '#9aa6b4', arjun: '#cfe0ff', player: '#cfe0ff' };
    this.el.subWho.textContent = names[who] ?? who ?? '';
    this.el.subWho.style.color = col[who] || '#cfe0ff';
    this.el.subtitle.classList.toggle('system', who === 'system' || who === 'entity');
    this.el.subtitle.classList.remove('hidden');
    // typewriter
    const total = Math.max(900, Math.min(9000, text.length * 26 + (ms || 0)));
    const per = total / Math.max(1, text.length);
    this.el.subText.textContent = '';
    const t0 = performance.now();
    await new Promise((res) => {
      const tick = () => {
        const n = Math.min(text.length, Math.floor((performance.now() - t0) / per));
        this.el.subText.textContent = text.slice(0, n);
        if (n < text.length) requestAnimationFrame(tick);
        else res();
      };
      tick();
    });
    const hold = Math.max(700, Math.min(4200, text.length * 34 + 700));
    await new Promise((r) => setTimeout(r, hold));
    this.el.subtitle.classList.add('hidden');
    void total;
  }

  big(text, ms = 2600) {
    this.el.big.textContent = text;
    this.el.big.classList.add('show');
    clearTimeout(this._bigT);
    this._bigT = setTimeout(() => this.el.big.classList.remove('show'), ms);
  }

  toast(text, ms = 2600) {
    const d = document.createElement('div');
    d.className = 'toast-item';
    d.textContent = text;
    this.el.toast.appendChild(d);
    setTimeout(() => {
      d.classList.add('out');
      setTimeout(() => d.remove(), 500);
    }, ms);
  }

  async titleCard(chapter, title, brief, ms = 3400) {
    this.el.tcChapter.textContent = chapter ? `CHAPTER ${chapter}` : 'THE LAST PERIOD';
    this.el.tcTitle.textContent = title;
    this.el.tcBrief.textContent = brief || '';
    this.el.titleCard.classList.remove('hidden');
    this.el.titleCard.classList.add('show');
    await new Promise((r) => setTimeout(r, ms));
    this.el.titleCard.classList.remove('show');
    await new Promise((r) => setTimeout(r, 700));
    this.el.titleCard.classList.add('hidden');
  }

  // ---- menu --------------------------------------------------------------
  setStatus(text) { if (this.el.menuStatus) this.el.menuStatus.textContent = text; }

  showMenu(show, { hasSave = false } = {}) {
    this.el.menu.classList.toggle('hidden', !show);
    $('btn-continue').classList.toggle('hidden', !hasSave);
    $('btn-erase').classList.toggle('hidden', !hasSave);
  }

  showPause(show, chapterList = []) {
    this.el.pause.classList.toggle('hidden', !show);
    if (show) {
      this.el.pause.querySelector('#chapter-list').innerHTML = chapterList
        .map((c) => `<button class="ch-btn" data-ch="${c.id}">${c.id}. ${c.title}</button>`)
        .join('');
    }
  }

  showDebug(html) {
    if (!html) return this.el.debug.classList.add('hidden');
    this.el.debug.classList.remove('hidden');
    this.el.debug.innerHTML = html;
  }

  // ---- modal (reading, code pad, choice, register) ----------------------
  modal(html, { onClose = null } = {}) {
    this.el.modalBox.innerHTML = html;
    this.el.modal.classList.remove('hidden');
    this.onModalClose = onClose;
    this.onOpenChange?.(true);
    return this.el.modalBox;
  }

  closeModal() {
    if (this.el.modal.classList.contains('hidden')) return;
    this.el.modal.classList.add('hidden');
    this.el.modalBox.innerHTML = '';
    const cb = this.onModalClose;
    this.onModalClose = null;
    this.onOpenChange?.(false);
    cb?.();
  }

  /** returns a promise of the chosen value */
  codePad(digits, { error = null, hint = '' } = {}) {
    return new Promise((resolve) => {
      const box = this.modal(
        `<div class="panel">
           <h3>Old combination panel</h3>
           <p class="dim small">${hint}</p>
           <div class="slots">${digits
             .map((d) => `<span class="slot">${d === null ? '·' : d}</span>`)
             .join('')}</div>
           ${error ? `<div class="err">${error}</div>` : ''}
           <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
             .map((n) => `<button data-k="${n}">${n}</button>`)
             .join('')}</div>
           <div class="row">
             <button data-k="clear" class="ghost">CLEAR</button>
             <button data-k="ok">ENTER</button>
             <button data-k="close" class="ghost">STEP AWAY</button>
           </div>
         </div>`
      );
      let cur = digits.filter((d) => d !== null);
      const render = (err) => this.codePadRerender(cur, err, hint, box);
      box.addEventListener('click', (e) => {
        const k = e.target?.dataset?.k;
        if (!k) return;
        if (k === 'close') {
          this.closeModal();
          resolve(null);
        } else if (k === 'clear') {
          cur = [];
          render();
        } else if (k === 'ok') {
          this.closeModal();
          resolve(cur.slice(0, 4));
        } else {
          if (cur.length < 4) cur.push(Number(k));
          render();
        }
      });
      this.onModalClose = () => resolve(null);
    });
  }

  codePadRerender(cur, err, hint) {
    const slots = [...cur, ...Array(4 - cur.length).fill(null)];
    this.el.modalBox.querySelector('.slots').innerHTML = slots.map((d) => `<span class="slot">${d === null ? '·' : d}</span>`).join('');
    let e = this.el.modalBox.querySelector('.err');
    if (err) {
      if (!e) {
        e = document.createElement('div');
        e.className = 'err';
        this.el.modalBox.querySelector('.slots').after(e);
      }
      e.textContent = err;
    } else e?.remove();
  }

  choice(title, body, options) {
    return new Promise((resolve) => {
      const box = this.modal(
        `<div class="panel">
          <h3>${title}</h3>
          <div class="body">${body}</div>
          <div class="choices">${options
            .map((o, i) => `<button data-i="${i}" class="${o.class || ''}">${o.label}${o.hint ? `<small>${o.hint}</small>` : ''}</button>`)
            .join('')}</div>
        </div>`
      );
      box.addEventListener('click', (e) => {
        const b = e.target?.closest?.('button[data-i]');
        if (!b) return;
        const v = options[Number(b.dataset.i)].value;
        this.onModalClose = null;
        this.el.modal.classList.add('hidden');
        this.el.modalBox.innerHTML = '';
        this.onOpenChange?.(false);
        resolve(v);
      });
    });
  }

  reader(title, paragraphs, opts = {}) {
    return new Promise((resolve) => {
      const box = this.modal(
        `<div class="panel paper ${opts.paper ? 'paper-' + opts.paper : ''}">
          <h3>${title}</h3>
          ${paragraphs.map((p) => `<p>${p}</p>`).join('')}
          ${opts.foot ? `<div class="foot">${opts.foot}</div>` : ''}
          <div class="row"><button data-k="close">${opts.closeLabel || 'CLOSE'}</button></div>
        </div>`
      );
      box.addEventListener('click', (e) => {
        if (e.target?.dataset?.k === 'close') {
          this.onModalClose = null;
          this.closeModal();
          resolve(true);
        }
      });
    });
  }

  castNames() {
    return CAST.map((c) => c.name);
  }
}
