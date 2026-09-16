// ---------------------------------------------------------------------------
// AudioEngine — every sound is synthesised with WebAudio, so the game ships
// with zero audio assets. All one-shots are short envelopes + filtered noise,
// which is exactly what a creaky school is made of.
// ---------------------------------------------------------------------------

const noiseLen = 2.2;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.muted = false;
    this.tension = 0; // 0..1 -> drone + heartbeat level
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.ratio.value = 6;
    this.master.connect(this.comp).connect(ctx.destination);

    // shared noise buffer
    const buf = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;

    // ambience: low drone + room tone + a "wind through broken windows" layer
    this.ambGain = ctx.createGain();
    this.ambGain.gain.value = 0.0;
    this.ambGain.connect(this.master);

    const droneOsc = ctx.createOscillator();
    droneOsc.type = 'sine';
    droneOsc.frequency.value = 41;
    const droneOsc2 = ctx.createOscillator();
    droneOsc2.type = 'sine';
    droneOsc2.frequency.value = 61.5;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.16;
    droneOsc.connect(this.droneGain);
    droneOsc2.connect(this.droneGain);
    this.droneGain.connect(this.ambGain);
    droneOsc.start();
    droneOsc2.start();
    this.droneOsc = droneOsc;
    this.droneOsc2 = droneOsc2;

    this.roomSrc = ctx.createBufferSource();
    this.roomSrc.buffer = buf;
    this.roomSrc.loop = true;
    const roomFilter = ctx.createBiquadFilter();
    roomFilter.type = 'lowpass';
    roomFilter.frequency.value = 420;
    this.roomGain = ctx.createGain();
    this.roomGain.gain.value = 0.05;
    this.roomSrc.connect(roomFilter).connect(this.roomGain).connect(this.ambGain);
    this.roomSrc.start();

    this.hum = ctx.createOscillator();
    this.hum.type = 'sawtooth';
    this.hum.frequency.value = 100;
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0;
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'bandpass';
    humFilter.frequency.value = 210;
    humFilter.Q.value = 6;
    this.hum.connect(humFilter).connect(this.humGain).connect(this.master);
    this.hum.start();
  }

  resume() {
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.started = true;
    this.ambGain.gain.value = 1;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }

  /** power state changes the electrical hum, tension changes the drone */
  setPower(on) {
    if (!this.ctx) return;
    this.humGain.gain.linearRampToValueAtTime(on ? 0.035 : 0, this.ctx.currentTime + 1.4);
    this.hum.frequency.linearRampToValueAtTime(on ? 100 : 58, this.ctx.currentTime + 1.4);
  }

  setTension(v) {
    if (!this.ctx) return;
    this.tension = v;
    const t = this.ctx.currentTime;
    this.droneGain.gain.linearRampToValueAtTime(0.14 + 0.22 * v, t + 0.5);
    this.roomGain.gain.linearRampToValueAtTime(0.05 + 0.06 * v, t + 0.5);
    this.droneOsc.frequency.linearRampToValueAtTime(41 - 5 * v, t + 1.2);
  }

  // ---- primitives ---------------------------------------------------------
  burst({ dur = 0.3, type = 'lowpass', freq = 800, q = 1, gain = 0.4, curve = 'exp', rate = 1, pan = 0 }) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.03, dur * 0.2));
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    else g.gain.linearRampToValueAtTime(0, t + dur);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(f).connect(g).connect(p).connect(this.master);
    src.start(t, Math.random() * (noiseLen - dur - 0.05));
    src.stop(t + dur + 0.05);
  }

  tone({ freq = 220, dur = 0.4, type = 'sine', gain = 0.2, slide = 0, detune = 0, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    const t = ctx.currentTime + delay;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // ---- the actual vocabulary ---------------------------------------------
  step(sprint = false) {
    this.burst({ dur: sprint ? 0.13 : 0.1, freq: sprint ? 950 : 620, gain: sprint ? 0.2 : 0.13, rate: 0.8 + Math.random() * 0.5, pan: Math.random() * 0.4 - 0.2 });
  }

  creak() {
    this.tone({ freq: 190 + Math.random() * 90, dur: 0.9, type: 'sawtooth', gain: 0.05, slide: -120 });
    this.burst({ dur: 0.8, freq: 700, gain: 0.05, rate: 0.25, type: 'bandpass', q: 9 });
  }

  slam() {
    this.burst({ dur: 0.35, freq: 260, gain: 0.75 });
    this.tone({ freq: 68, dur: 0.5, type: 'sine', gain: 0.4, slide: -40 });
  }

  knock(n = 3) {
    for (let i = 0; i < n; i++) {
      this.burst({ dur: 0.12, freq: 340, gain: 0.35, rate: 0.7 });
      this.tone({ freq: 130, dur: 0.16, gain: 0.16, slide: -60, delay: i * 0.34 });
    }
  }

  whisper(pan = 0) {
    this.burst({ dur: 1.4, freq: 1700, q: 3.2, gain: 0.09, rate: 0.55, pan });
    this.burst({ dur: 1.1, freq: 2600, q: 6, gain: 0.05, rate: 0.4, pan: -pan });
  }

  hum(pain = 0.4) {
    this.burst({ dur: 1.6, freq: 1200, q: 12, gain: 0.05 + pain * 0.05, rate: 0.9 });
  }

  stinger() {
    this.tone({ freq: 900, dur: 1.5, type: 'sawtooth', gain: 0.22, slide: -840 });
    this.tone({ freq: 132, dur: 1.9, type: 'square', gain: 0.15, slide: -80 });
    this.burst({ dur: 1.1, freq: 2400, gain: 0.4, rate: 1.6 });
  }

  heartbeat() {
    this.tone({ freq: 54, dur: 0.18, type: 'sine', gain: 0.34, slide: -18 });
    this.tone({ freq: 48, dur: 0.2, type: 'sine', gain: 0.22, slide: -16, delay: 0.26 });
  }

  pickup() {
    this.tone({ freq: 660, dur: 0.16, gain: 0.16, slide: 240 });
    this.tone({ freq: 990, dur: 0.2, gain: 0.1, delay: 0.1 });
  }

  page() {
    this.burst({ dur: 0.24, freq: 2400, gain: 0.14, rate: 1.7 });
  }

  machine() {
    this.burst({ dur: 1.9, freq: 220, gain: 0.3, rate: 0.3 });
    this.tone({ freq: 34, dur: 2.2, type: 'square', gain: 0.1, slide: 46 });
    this.tone({ freq: 62, dur: 2.0, type: 'sawtooth', gain: 0.06, slide: 28, delay: 0.2 });
  }

  bell() {
    for (let i = 0; i < 3; i++) {
      this.tone({ freq: 880, dur: 1.3, type: 'sine', gain: 0.2, delay: i * 0.5 });
      this.tone({ freq: 1320, dur: 1.0, type: 'sine', gain: 0.09, delay: i * 0.5 });
    }
  }

  /** school PA announcement: bandpassed, distorted, with speaker crackle */
  announcement(seconds = 3.5) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 140;
    const wobble = ctx.createOscillator();
    wobble.frequency.value = 5.5;
    const wobGain = ctx.createGain();
    wobGain.gain.value = 26;
    wobble.connect(wobGain).connect(o.frequency);
    const shape = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 3.4);
    }
    shape.curve = curve;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1250;
    bp.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.25);
    g.gain.setValueAtTime(0.3, t + seconds - 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    o.connect(bp).connect(shape).connect(g).connect(this.master);
    o.start(t);
    wobble.start(t);
    o.stop(t + seconds + 0.1);
    wobble.stop(t + seconds + 0.1);
    // crackle
    for (let i = 0; i < 14; i++) {
      this.burst({ dur: 0.05, freq: 3200, gain: 0.06, rate: 2.2 });
    }
    // the "click" of the mic
    this.burst({ dur: 0.09, freq: 900, gain: 0.3 });
  }

  growl(dist = 1) {
    const g = Math.max(0.04, 0.5 / dist);
    this.tone({ freq: 61, dur: 1.8, type: 'sawtooth', gain: 0.1 * g, slide: -18 });
    this.burst({ dur: 1.9, freq: 320, gain: 0.18 * g, rate: 0.28, type: 'lowpass' });
  }
}

export const audio = new AudioEngine();
