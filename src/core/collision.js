// ---------------------------------------------------------------------------
// Collision geometry: every collider is an axis-aligned box {minx,maxx,minz,maxz}.
// Movement resolution is axis-separated (classic "slide along wall"), which is
// cheap, stable and beginner friendly: you can never get stuck in a corner.
// ---------------------------------------------------------------------------

export function boxOverlapsBox(a, b) {
  return a.minx < b.maxx && a.maxx > b.minx && a.minz < b.maxz && a.maxz > b.minz;
}

export function circleHitsBox(cx, cz, r, b) {
  const nx = Math.max(b.minx, Math.min(cx, b.maxx));
  const nz = Math.max(b.minz, Math.min(cz, b.maxz));
  const dx = cx - nx;
  const dz = cz - nz;
  return dx * dx + dz * dz < r * r;
}

/**
 * Move a circle from (x,z) by (dx,dz), sliding along boxes.
 * Returns the resolved position and which axes were blocked.
 */
export function moveWithCollision(x, z, dx, dz, radius, boxes) {
  let blockedX = false;
  let blockedZ = false;

  let nx = x + dx;
  for (const b of boxes) {
    if (circleHitsBox(nx, z, radius, b)) {
      nx = dx > 0 ? b.minx - radius : b.maxx + radius;
      blockedX = true;
    }
  }

  let nz = z + dz;
  for (const b of boxes) {
    if (circleHitsBox(nx, nz, radius, b)) {
      nz = dz > 0 ? b.minz - radius : b.maxz + radius;
      blockedZ = true;
    }
  }

  return { x: nx, z: nz, blockedX, blockedZ };
}

/** is a point (with radius) free? used by the AI + trigger system */
export function pointFree(x, z, radius, boxes) {
  for (const b of boxes) if (circleHitsBox(x, z, radius, b)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Flow field: a BFS distance map the monster follows. Recomputed a few times
// per second, so pathfinding is exact and still costs almost nothing.
// ---------------------------------------------------------------------------
export class FlowField {
  constructor({ minX, maxX, minZ, maxZ, cell = 1 }) {
    this.cell = cell;
    this.minX = minX;
    this.minZ = minZ;
    this.w = Math.ceil((maxX - minX) / cell);
    this.h = Math.ceil((maxZ - minZ) / cell);
    this.blocked = new Uint8Array(this.w * this.h);
    this.dist = new Int32Array(this.w * this.h);
    this.queue = new Int32Array(this.w * this.h);
    this.cx = (x) => Math.floor((x - this.minX) / cell);
    this.cz = (z) => Math.floor((z - this.minZ) / cell);
    this.wx = (i) => this.minX + (i + 0.5) * cell;
    this.wz = (j) => this.minZ + (j + 0.5) * cell;
  }

  setBlockedFromBoxes(boxes) {
    this.blocked.fill(0);
    for (const b of boxes) {
      const i0 = clampi(this.cx(b.minx), 0, this.w - 1);
      const i1 = clampi(this.cx(b.maxx), 0, this.w - 1);
      const j0 = clampi(this.cz(b.minz), 0, this.h - 1);
      const j1 = clampi(this.cz(b.maxz), 0, this.h - 1);
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) this.blocked[j * this.w + i] = 1;
      }
    }
  }

  blockCell(x, z) {
    const i = this.cx(x);
    const j = this.cz(z);
    if (i >= 0 && j >= 0 && i < this.w && j < this.h) this.blocked[j * this.w + i] = 1;
  }

  /** BFS outwards from a world point. Returns false if the point is inside a wall. */
  compute(px, pz) {
    this.dist.fill(-1);
    let qi = 0;
    let qn = 0;
    const si = this.cx(px);
    const sj = this.cz(pz);
    if (si < 0 || sj < 0 || si >= this.w || sj >= this.h) return false;
    const start = sj * this.w + si;
    if (this.blocked[start]) return false;
    this.dist[start] = 0;
    this.queue[qn++] = start;
    while (qi < qn) {
      const cur = this.queue[qi++];
      const d = this.dist[cur] + 1;
      const ci = cur % this.w;
      const cj = (cur - ci) / this.w;
      for (let k = 0; k < 4; k++) {
        const ni = ci + (k === 0 ? 1 : k === 1 ? -1 : 0);
        const nj = cj + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (ni < 0 || nj < 0 || ni >= this.w || nj >= this.h) continue;
        const idx = nj * this.w + ni;
        if (this.blocked[idx] || this.dist[idx] !== -1) continue;
        this.dist[idx] = d;
        this.queue[qn++] = idx;
      }
    }
    return true;
  }

  /** unit direction pointing downhill at a world position, or null */
  dirAt(x, z) {
    const i = this.cx(x);
    const j = this.cz(z);
    if (i < 1 || j < 1 || i >= this.w - 1 || j >= this.h - 1) return null;
    const here = this.dist[j * this.w + i];
    if (here < 0) return null;
    let best = here;
    let bi = 0;
    let bj = 0;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        if (di && dj) continue; // 4-neighbourhood keeps it wall-hugging
        const v = this.dist[(j + dj) * this.w + (i + di)];
        if (v >= 0 && v < best) {
          best = v;
          bi = di;
          bj = dj;
        }
      }
    }
    if (!bi && !bj) return null;
    return { x: bi * this.cell, z: bj * this.cell };
  }

  distAt(x, z) {
    const i = this.cx(x);
    const j = this.cz(z);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return -1;
    return this.dist[j * this.w + i];
  }
}

function clampi(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
