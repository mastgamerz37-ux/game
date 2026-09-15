// ---------------------------------------------------------------------------
// Model system: procedural placeholder humans + drop-in replacement with your
// own .glb / .fbx / .obj.
//
//   public/models/models.json
//   {
//     "player":  "PlayerModel.glb",
//     "friend1": "Friend1.fbx",
//     "friend2": "Friend2.obj",
//     "friend3": "Friend3.glb",
//     "ghost":   "Monster.glb"
//   }
//
// Anything listed is loaded, auto-scaled to ~1.75 m and feet-anchored. If the
// file is missing, the placeholder rig is used instead, so the game never
// breaks while you are swapping models.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { canvasTexture, rand } from '../utils.js';

export const TARGET_HEIGHT = 1.74;

const loaders = {};
function loaderFor(kind) {
  if (kind === 'gltf') return (loaders.gltf ||= new GLTFLoader());
  if (kind === 'fbx') return (loaders.fbx ||= new FBXLoader());
  return (loaders.obj ||= new OBJLoader());
}

function kindOf(url) {
  const u = url.toLowerCase().split('?')[0];
  if (u.endsWith('.glb') || u.endsWith('.gltf')) return 'gltf';
  if (u.endsWith('.fbx')) return 'fbx';
  return 'obj';
}

export function loadModel(url) {
  const kind = kindOf(url);
  return new Promise((resolve, reject) => {
    const done = (obj, clips) => {
      // normalise: stand on y=0, ~1.75m tall
      const bbox = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      bbox.getSize(size);
      bbox.getCenter(center);
      const h = Math.max(0.001, size.y);
      const s = TARGET_HEIGHT / h;
      obj.scale.setScalar(s);
      obj.position.set(-center.x * s, -bbox.min.y * s, -center.z * s);
      const wrapper = new THREE.Group();
      wrapper.add(obj);
      wrapper.userData.custom = true;
      wrapper.userData.clips = clips || [];
      resolve(wrapper);
    };
    try {
      if (kind === 'gltf') {
        loaderFor(kind).load(url, (gltf) => done(gltf.scene, gltf.animations), undefined, reject);
      } else {
        loaderFor(kind).load(url, (o) => done(o, o.animations), undefined, reject);
      }
    } catch (e) {
      reject(e);
    }
  });
}

export async function readManifest() {
  try {
    const r = await fetch('models/models.json', { cache: 'no-store' });
    if (!r.ok) return {};
    return await r.json();
  } catch (e) {
    return {};
  }
}

/**
 * Build the visual for a character: custom model if the manifest has one and
 * it loads, otherwise the placeholder rig.
 */
export async function buildCharacter(def) {
  const root = new THREE.Group();
  root.name = `char_${def.id}`;
  const manifest = await readManifest();
  const file = manifest[def.id];
  if (file) {
    try {
      const m = await loadModel(`models/${file}`);
      root.add(m);
      root.userData.custom = true;
      root.userData.mixer = m.userData.clips.length ? new THREE.AnimationMixer(m) : null;
      if (root.userData.mixer) {
        const clip =
          m.userData.clips.find((c) => /walk|run/i.test(c.name)) ||
          m.userData.clips.find((c) => /idle/i.test(c.name)) ||
          m.userData.clips[0];
        if (clip) root.userData.mixer.clipAction(clip).play();
      }
      root.userData.placeholder = null;
      return root;
    } catch (e) {
      console.warn(`[models] could not load "${file}" for ${def.id} — using placeholder.`, e.message);
    }
  }
  const ph = placeholderRig(def);
  root.add(ph);
  root.userData.placeholder = ph;
  return root;
}

// --------------------------------------------------------------------------
// Placeholder rig: 14 boxes, no bones. Two named pivot groups ("limbL/R" and
// "armL/R") so the walk cycle looks alive, plus a floating name label.
// --------------------------------------------------------------------------
export function placeholderRig(def) {
  const g = new THREE.Group();
  const ghost = def.id === 'ghost';
  const cloth = new THREE.MeshLambertMaterial({
    color: def.color,
    transparent: ghost,
    opacity: ghost ? 0.55 : 1,
    emissive: ghost ? 0x1a222c : 0x000000,
  });
  const accent = new THREE.MeshLambertMaterial({ color: def.accent, transparent: ghost, opacity: ghost ? 0.4 : 1 });
  const skin = new THREE.MeshLambertMaterial({ color: def.skin, transparent: ghost, opacity: ghost ? 0.35 : 1 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x15181d });

  const H = ghost ? 2.05 : TARGET_HEIGHT;
  const torsoH = H * 0.42;
  const legH = H * 0.44;
  const headR = H * 0.085;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(H * 0.3, torsoH, H * 0.17), cloth);
  torso.position.y = legH + torsoH / 2;
  torso.castShadow = true;
  g.add(torso);

  const hips = new THREE.Mesh(new THREE.BoxGeometry(H * 0.28, H * 0.08, H * 0.16), accent);
  hips.position.y = legH + H * 0.04;
  g.add(hips);

  const neck = new THREE.Mesh(new THREE.BoxGeometry(H * 0.07, H * 0.05, H * 0.07), skin);
  neck.position.y = legH + torsoH + H * 0.02;
  g.add(neck);

  const head = new THREE.Mesh(new THREE.BoxGeometry(headR * 2, headR * 2.3, headR * 1.9), skin);
  head.position.y = legH + torsoH + headR * 1.35;
  head.castShadow = true;
  g.add(head);

  // hair / cap
  const cap = new THREE.Mesh(new THREE.BoxGeometry(headR * 2.15, headR * 0.8, headR * 2.05), dark);
  cap.position.y = head.position.y + headR * 0.85;
  g.add(cap);

  // face detail so the head reads as a face in torchlight
  const eye = new THREE.Mesh(new THREE.BoxGeometry(headR * 0.34, headR * 0.2, 0.01), new THREE.MeshBasicMaterial({ color: ghost ? 0xdfe9ff : 0x0b0d10 }));
  for (const sx of [-1, 1]) {
    const e = eye.clone();
    e.position.set(sx * headR * 0.55, head.position.y + headR * 0.1, -headR * 0.98);
    g.add(e);
  }

  const mkLimb = (w, h, mat, px, py, pz, name) => {
    const pivot = new THREE.Group();
    pivot.position.set(px, py, pz);
    pivot.name = name;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
    m.position.y = -h / 2;
    m.castShadow = true;
    pivot.add(m);
    g.add(pivot);
    return pivot;
  };

  const sh = legH + torsoH - H * 0.02;
  g.userData.armL = mkLimb(H * 0.075, torsoH * 0.92, cloth, -(H * 0.15 + H * 0.045), sh, 0, 'armL');
  g.userData.armR = mkLimb(H * 0.075, torsoH * 0.92, cloth, H * 0.15 + H * 0.045, sh, 0, 'armR');
  g.userData.legL = mkLimb(H * 0.095, legH, accent, -H * 0.085, legH, 0, 'limbL');
  g.userData.legR = mkLimb(H * 0.095, legH, accent, H * 0.085, legH, 0, 'limbR');

  // bag for the funny one, torch for the brave one etc: tiny silhouette tells
  if (def.id === 'friend2') {
    const glasses = new THREE.Mesh(new THREE.BoxGeometry(headR * 1.9, headR * 0.35, 0.02), new THREE.MeshBasicMaterial({ color: 0xcfe3d6 }));
    glasses.position.set(0, head.position.y + headR * 0.1, -headR * 1.0);
    g.add(glasses);
  }
  if (def.id === 'friend1') {
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(H * 0.34, H * 0.06, H * 0.2), accent);
    sleeve.position.set(0, sh - H * 0.02, 0);
    g.add(sleeve);
  }

  g.userData.label = null;
  return g;
}

export async function makeLabel(text, color = '#dfe6f2') {
  const tex = await canvasTexture(
    256,
    72,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(8,10,14,0.55)';
      const tw = Math.max(70, text.length * 15 + 26);
      ctx.beginPath();
      ctx.roundRect((w - tw) / 2, 10, tw, 46, 10);
      ctx.fill();
      ctx.font = "600 27px 'Segoe UI', system-ui, sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(text, w / 2, 34);
    },
    THREE
  );
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(1.1, 0.31, 1);
  sp.position.y = TARGET_HEIGHT + 0.28;
  return sp;
}
