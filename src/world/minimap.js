// ---------------------------------------------------------------------------
// Debug minimap: draws the *actual* collider list of the current level, plus
// doors, friends, the monster and interaction anchors. This is the fastest way
// to check that a hand-edited map.js does not trap the player.
//   enabled with ?debug=1  (toggle with K)
// ---------------------------------------------------------------------------
import { FLOOR_H } from '../constants.js';

const W = 50;
const H = 26;
const X0 = -25;
const Z0 = -17;

export class Minimap {
  constructor(game) {
    this.g = game;
    this.el = document.createElement('canvas');
    this.el.id = 'minimap';
    this.el.width = W * 8;
    this.el.height = H * 8;
    document.getElementById('ui').appendChild(this.el);
    this.ctx = this.el.getContext('2d');
    this.on = false;
  }
  toggle() {
    this.on = !this.on;
    this.el.classList.toggle('hidden', !this.on);
  }
  update() {
    if (!this.on) return;
    const g = this.g;
    const ctx = this.ctx;
    const s = 8;
    const level = g.world.levels[g.world.levelIndex];
    ctx.clearRect(0, 0, W * s, H * s);
    ctx.fillStyle = 'rgba(6,9,13,0.86)';
    ctx.fillRect(0, 0, W * s, H * s);
    // rooms
    ctx.font = '9px ui-monospace';
    for (const room of level.def.rooms) {
      const r = room.rect;
      ctx.fillStyle = 'rgba(70,90,120,0.22)';
      ctx.fillRect((r.x0 - X0) * s, H * s - (r.z1 - Z0) * s, (r.x1 - r.x0) * s, (r.z1 - r.z0) * s);
      ctx.fillStyle = 'rgba(150,175,205,0.55)';
      ctx.fillText(room.name.slice(0, 16), (r.x0 - X0) * s + 3, H * s - (r.z1 - Z0) * s + 11);
    }
    // colliders
    ctx.fillStyle = 'rgba(150,170,200,0.75)';
    for (const b of level.colliders()) {
      const isDoor = b.label && String(b.label).startsWith('door:');
      if (isDoor && b.active === false) continue;
      ctx.fillStyle = isDoor ? 'rgba(230,180,90,0.9)' : 'rgba(150,170,200,0.75)';
      ctx.fillRect((b.minx - X0) * s, H * s - (b.maxz - Z0) * s, Math.max(2, (b.maxx - b.minx) * s), Math.max(2, (b.maxz - b.minz) * s));
    }
    // interaction anchors
    for (const it of g.interactables) {
      if (it.level !== g.world.levelIndex || it.kind === 'door') continue;
      if (g.story?.blocked(it)) continue;
      ctx.fillStyle = it.kind === 'point' ? 'rgba(120,220,255,0.9)' : 'rgba(120,255,170,0.75)';
      ctx.fillRect((it.x - X0) * s - 1.5, H * s - (it.z - Z0) * s - 1.5, 3.5, 3.5);
    }
    // friends
    for (const a of g.friends.list) {
      ctx.fillStyle = '#f0d878';
      ctx.fillRect((a.node.position.x - X0) * s - 2, H * s - (a.node.position.z - Z0) * s - 2, 4, 4);
    }
    // monster
    if (g.monster?.node.visible) {
      ctx.fillStyle = '#ff5a6a';
      ctx.fillRect((g.monster.node.position.x - X0) * s - 3, H * s - (g.monster.node.position.z - Z0) * s - 3, 6, 6);
    }
    // player + view cone
    const px = (g.player.pos.x - X0) * s;
    const pz = H * s - (g.player.pos.z - Z0) * s;
    ctx.strokeStyle = 'rgba(220,235,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(px, pz);
    const a0 = -g.player.yaw - 0.6;
    const a1 = -g.player.yaw + 0.6;
    ctx.lineTo(px + Math.sin(a0) * -34, pz + Math.cos(a0) * -34);
    ctx.lineTo(px + Math.sin(a1) * -34, pz + Math.cos(a1) * -34);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#eaf2ff';
    ctx.beginPath();
    ctx.arc(px, pz, 3, 0, 6.3);
    ctx.fill();
  }
}
