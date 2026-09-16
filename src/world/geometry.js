// ---------------------------------------------------------------------------
// Mesh + material helpers shared by the world builder. Everything is a plain
// box so that custom FBX/GLB/OBJ models can be dropped in later without the
// builder having to know anything about them.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { WT, WALL_H, COLORS } from '../constants.js';
import { canvasTexture, grain, rand } from '../utils.js';

const matCache = new Map();

export function mat(key, factory) {
  if (!matCache.has(key)) matCache.set(key, factory());
  return matCache.get(key);
}

export function lambert(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

const geoCache = new Map();
export function box(w, h, d) {
  const k = `${w.toFixed(2)}_${h.toFixed(2)}_${d.toFixed(2)}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}

export function addBox(parent, { x, y, z, w, h, d, color, material, rotY = 0, name }) {
  const m = new THREE.Mesh(box(w, h, d), material || lambert(color));
  m.position.set(x, y + h / 2, z);
  m.rotation.y = rotY;
  if (name) m.name = name;
  parent.add(m);
  return m;
}

/** one wall strip (already subtracted for door gaps) -> mesh + collider */
export function wallPiece(parent, boxes, { x0, x1, z0, z1, y = 0, h = WALL_H, material }) {
  const w = x1 - x0;
  const d = z1 - z0;
  if (w <= 0.001 || d <= 0.001) return null;
  const mesh = new THREE.Mesh(box(w, h, d), material);
  mesh.position.set((x0 + x1) / 2, y + h / 2, (z0 + z1) / 2);
  parent.add(mesh);
  boxes.push({ minx: x0, maxx: x1, minz: z0, maxz: z1, y, h });
  return mesh;
}

// --------------------------------------------------------------------------
// Procedural textures (painted once into canvases; no image assets needed).
// --------------------------------------------------------------------------
let textures = null;

export async function getTextures() {
  if (textures) return textures;

  const wall = await canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#3a404a';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) {
        const a = rand() * 0.05;
        ctx.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 2})`;
        ctx.fillRect(rand() * w, rand() * h, rand() * 90 + 10, rand() * 90 + 10);
      }
      // damp patches near the bottom, like an old Indian classroom
      const g = ctx.createLinearGradient(0, h, 0, h * 0.45);
      g.addColorStop(0, 'rgba(20,16,10,0.5)');
      g.addColorStop(1, 'rgba(20,16,10,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, h * 0.45, w, h * 0.55);
      grain(ctx, w, h, 0.05);
    },
    THREE
  );
  wall.repeat.set(2, 1.4);

  const tiles = await canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#22272e';
      ctx.fillRect(0, 0, w, h);
      const n = 4;
      const s = w / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          ctx.fillStyle = (i + j) % 2 ? '#2b313a' : '#1e232a';
          ctx.fillRect(i * s, j * s, s, s);
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 3;
          ctx.strokeRect(i * s + 1, j * s + 1, s - 2, s - 2);
        }
      }
      grain(ctx, w, h, 0.06);
    },
    THREE
  );
  tiles.repeat.set(8, 3);

  const wood = await canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#2f2620';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 26) {
        ctx.fillStyle = `rgba(0,0,0,${0.15 + rand() * 0.25})`;
        ctx.fillRect(0, y, w, 3);
        for (let x = 0; x < w; x += 7) {
          ctx.fillStyle = `rgba(${120 + rand() * 60},${90 + rand() * 40},${60 + rand() * 30},0.05)`;
          ctx.fillRect(x, y + 3, 5, 22);
        }
      }
      grain(ctx, w, h, 0.05);
    },
    THREE
  );
  wood.repeat.set(4, 4);

  const concrete = await canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#191d22';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 120; i++) {
        ctx.fillStyle = `rgba(255,255,255,${rand() * 0.04})`;
        ctx.fillRect(rand() * w, rand() * h, rand() * 60, rand() * 4);
      }
      grain(ctx, w, h, 0.07);
    },
    THREE
  );
  concrete.repeat.set(6, 3);

  textures = { wall, tiles, wood, concrete };
  return textures;
}

export function wallMaterial(inner) {
  const t = textures.wall.clone();
  t.needsUpdate = true;
  return new THREE.MeshLambertMaterial({
    map: t,
    color: inner ? COLORS.wallInner : COLORS.wallOuter,
  });
}

export function floorMaterial(kind) {
  if (kind === 'wood') return new THREE.MeshLambertMaterial({ map: textures.wood, color: 0x6a5a48 });
  if (kind === 'concrete') return new THREE.MeshLambertMaterial({ map: textures.concrete, color: 0x7a8089 });
  return new THREE.MeshLambertMaterial({ map: textures.tiles, color: 0x8a929c });
}

export { WT, COLORS };
