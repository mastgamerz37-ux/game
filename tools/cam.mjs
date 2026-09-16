// Headless checks for the two things that are easy to break and invisible in
// the story sim: the third-person camera arm (must never sit inside a wall)
// and the touch/virtual axis (must feed the same movement code as the keys).
//      node tools/cam.mjs
const noop = () => {};
globalThis.window = { addEventListener: noop, devicePixelRatio: 1 };
globalThis.document = {
  addEventListener: noop,
  pointerLockElement: null,
  exitPointerLock: noop,
  createElement: () => ({
    width: 0, height: 0, style: {}, addEventListener: noop,
    getContext: () => new Proxy({ canvas: {}, createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }), measureText: () => ({ width: 10 }) }, { get: (t, k) => (k in t ? t[k] : noop), set: () => true }),
  }),
};
globalThis.addEventListener = noop;

const THREE = await import('three');
const { PlayerController } = await import('../src/player/controller.js');
const { Input } = await import('../src/core/input.js');
const { FLOORS } = await import('../src/data/floors.js');
const { World } = await import('../src/world/world.js');

class Scene { constructor() { this.children = []; } add(o) { this.children.push(o); return this; } }
const world = new World(new Scene(), FLOORS);
await world.build();
// the colliders a wall/door lookup would see at runtime
const boxes = () => world.levels[0].colliders();

let fails = 0;
const ok = (cond, msg) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) fails++;
};

const camera = new THREE.PerspectiveCamera(72, 1.6, 0.1, 120);
const canvas = { addEventListener: noop, requestPointerLock: noop, style: {} };
const input = new Input(canvas);
const player = new PlayerController(camera, input, world);

// ---- 1. third person behind a wall ---------------------------------------
// the north wall of the ground-floor hall runs along z = -8.5; stand in the
// hall facing the corridor, then look back so the camera arm crosses a wall
player.mode = 'tp';
player.spawn(2.5, -6.0, Math.PI, 0); // facing +z: camera sits toward -z, in the wall
player.thirdPersonDist = 3.4;
input.touch = true; // no pointer lock needed to run the camera code
for (let i = 0; i < 30; i++) player.update(1 / 60, i / 60);
const camPos = camera.position.clone();
const inside = boxes().some(
  (b) => camPos.x > b.minx && camPos.x < b.maxx && camPos.z > b.minz && camPos.z < b.maxz && camPos.y < (b.h ?? 1.9)
);
ok(!inside, `tp camera is not inside a solid (${camPos.x.toFixed(2)}, ${camPos.y.toFixed(2)}, ${camPos.z.toFixed(2)})`);
const d = Math.hypot(camPos.x - player.pos.x, camPos.z - player.pos.z);
ok(d < player.thirdPersonDist + 0.05, `tp camera was pulled in (${d.toFixed(2)}m of ${player.thirdPersonDist}m)`);

// open courtyard: the arm should extend fully
player.spawn(2.5, 4.0, Math.PI, 0);
player.camDist = 0.5;
for (let i = 0; i < 120; i++) player.update(1 / 60, i / 60);
const free = Math.hypot(camera.position.x - player.pos.x, camera.position.z - player.pos.z);
ok(free > player.thirdPersonDist - 0.2, `tp camera extends in open space (${free.toFixed(2)}m)`);

// ---- 2. the virtual stick drives movement ---------------------------------
player.mode = 'fp';
player.spawn(2.5, -0.5, 0, 0);
input.touch = true;
input.virtual = null;
let before = player.pos.z;
for (let i = 0; i < 10; i++) player.update(1 / 60, i / 60);
ok(Math.abs(player.pos.z - before) < 1e-6, 'idle stick does not move the player');

const settle = (frames = 6) => { for (let i = 0; i < frames; i++) player.update(1 / 60, i / 60); };

input.virtual = { x: 0, z: 1 }; // full push forward (yaw 0 looks toward -z)
settle();
before = player.pos.z;
for (let i = 0; i < 30; i++) player.update(1 / 60, i / 60);
const full = before - player.pos.z;
ok(full > 1.0, `full push walks forward (${full.toFixed(3)}m in 0.5s)`);

input.virtual = { x: 0, z: 0.4 }; // half push
player.spawn(2.5, -0.5, 0, 0);
settle();
before = player.pos.z;
for (let i = 0; i < 30; i++) player.update(1 / 60, i / 60);
const half = before - player.pos.z;
ok(half > 0 && half < full * 0.75, `partial push walks slower (${half.toFixed(3)}m vs ${full.toFixed(3)}m)`);

// ---- 3. diagonal keys are not faster --------------------------------------
input.virtual = null;
player.spawn(2.5, -0.5, 0, 0);
settle();
input.held = { forward: true };
let px = player.pos.x, pz = player.pos.z;
for (let i = 0; i < 12; i++) player.update(1 / 60, i / 60);
const card = Math.hypot(player.pos.x - px, player.pos.z - pz);
ok(pz - player.pos.z > 0.3, 'W walks toward where the camera looks');
player.spawn(2.5, -0.5, 0, 0);
settle();
input.held = { forward: true, right: true };
px = player.pos.x; pz = player.pos.z;
for (let i = 0; i < 12; i++) player.update(1 / 60, i / 60);
const diag = Math.hypot(player.pos.x - px, player.pos.z - pz);
ok(Math.abs(diag - card) < 0.02, `diagonal speed == cardinal speed (${diag.toFixed(4)} vs ${card.toFixed(4)})`);

console.log(fails ? `\n${fails} camera/touch check(s) FAILED\n` : '\ncamera + touch checks clean\n');
process.exit(fails ? 1 : 0);
