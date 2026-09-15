// ---------------------------------------------------------------------------
// Small helpers: canvas textures, easing, RNG.
// ---------------------------------------------------------------------------

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let seed = 20980914;
/** deterministic RNG so layout noise looks identical on every run */
export function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
export const randRange = (a, b) => a + rand() * (b - a);
export const pick = (arr) => arr[Math.floor(rand() * arr.length) % arr.length];

/**
 * Paint on a canvas, return a THREE.CanvasTexture. Used for the blackboard,
 * the register, posters, nameplates, signs.
 */
export async function canvasTexture(w, h, paint, THREE, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  await paint(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = opts.anisotropy ?? 4;
  return tex;
}

const HANDFONT = "'Segoe Print','Bradley Hand','Comic Sans MS',cursive";

/** chalk-style text with jitter */
export function chalkText(ctx, text, x, y, size, opts = {}) {
  const {
    color = 'rgba(236,240,245,0.92)',
    jitter = 1.4,
    angle = 0,
    align = 'center',
    font = HANDFONT,
    repeat = 3,
  } = opts;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.font = `${size}px ${font}`;
  ctx.fillStyle = color;
  for (let i = 0; i < repeat; i++) {
    ctx.globalAlpha = 0.3;
    ctx.fillText(text, (rand() - 0.5) * jitter * 2, (rand() - 0.5) * jitter * 2);
  }
  ctx.globalAlpha = 1;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

export function grain(ctx, w, h, alpha = 0.05, step = 3) {
  for (let i = 0; i < w; i += step) {
    for (let j = 0; j < h; j += step) {
      if (rand() > 0.6) {
        ctx.fillStyle = `rgba(255,255,255,${(rand() * alpha).toFixed(3)})`;
        ctx.fillRect(i, j, step, step);
      }
    }
  }
}

export function vignette(ctx, w, h, strength = 0.55) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
