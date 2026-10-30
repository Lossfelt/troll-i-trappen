import * as THREE from 'three';
import { mat, matUnique, glow } from './world.js';
import { addKitchen, addLiving, addBath, addPlayroom } from './furniture.js';

// Huset sett ovenfra (x mot høyre, z mot kamera):
//   Kjøkken | Stue
//   Lekerom | Gang med trapp | Bad
export const WALL_H = 2.4;
const T = 0.2;
const WALL = 0xe8d9bf;

export const ROOMS = [
  { id: 'kjokken', name: 'Kjøkkenet', minX: -12, maxX: -2, minZ: -9, maxZ: 0, floor: 'tiles', c1: 0xe3d8c0, c2: 0xc4b48f },
  { id: 'stue', name: 'Stua', minX: -2, maxX: 12, minZ: -9, maxZ: 0, floor: 'planks', c1: 0xb57d4a },
  { id: 'lekerom', name: 'Lekerommet', minX: -12, maxX: -4, minZ: 0, maxZ: 9, floor: 'carpet', c1: 0x7aa36a },
  { id: 'gang', name: 'Gangen', minX: -4, maxX: 4, minZ: 0, maxZ: 9, floor: 'planks', c1: 0x9a6640 },
  { id: 'bad', name: 'Badet', minX: 4, maxX: 12, minZ: 0, maxZ: 9, floor: 'tiles', c1: 0xd6e8ee, c2: 0xa3c8d4 },
];
export const START = { x: -1.2, z: 6.6 };
export const STAIRS = { minX: 2.4, maxX: 4, bottomZ: 7.6, topZ: 3.0, height: 2.0, steps: 8 };
export const TRAPP_SPOT = { x: 3.2, z: 7.95 };
export const TRAPP_ASIDE = { x: 3.3, z: 8.55 };

/** Høyden på trinnet under (x, z). Bare gangen har trapp; alt annet er gulv. */
export function stairHeight(x, z) {
  const { minX, maxX, bottomZ, topZ, height, steps } = STAIRS;
  if (x < minX - 0.05 || x > maxX || z <= 0.1 || z >= bottomZ) return 0;
  const step = Math.min(steps, Math.floor((bottomZ - z) / ((bottomZ - topZ) / steps)) + 1);
  return (step * height) / steps;
}

export const onStairs = (p) => p.x > STAIRS.minX && p.x < STAIRS.maxX && p.z > 0.1 && p.z < STAIRS.bottomZ;

export function roomAt(x, z) {
  return ROOMS.find((r) => x >= r.minX && x < r.maxX && z >= r.minZ && z < r.maxZ) || null;
}

export const inZone = (p, z) => p.x > z.minX && p.x < z.maxX && p.z > z.minZ && p.z < z.maxZ;

export function buildHouse(scene) {
  const h = { group: new THREE.Group(), boxes: [], walls: [], walkables: [], hideZones: [], blocker: null };
  scene.add(h.group);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat(0x1d2a24));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true;
  h.group.add(ground);
  for (const room of ROOMS) addFloor(h, room);
  addWalls(h);
  addWindow(h, -8, true); addWindow(h, 6, false);
  addKitchen(h); addLiving(h); addBath(h); addPlayroom(h); addHall(h);
  return h;
}

// Hjelpere som møblene også bruker
export function collider(h, minX, maxX, minZ, maxZ, who = 'both', extra = {}) {
  const b = { minX, maxX, minZ, maxZ, kid: who !== 'troll', troll: who !== 'kid', ...extra };
  h.boxes.push(b);
  return b;
}

export function box(h, w, ht, d, color, x, y, z, coll = null, material = null) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, ht, d), material || mat(color));
  m.position.set(x, y + ht / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  h.group.add(m);
  if (coll) collider(h, x - w / 2, x + w / 2, z - d / 2, z + d / 2, coll);
  return m;
}

export function cyl(h, rt, rb, ht, color, x, y, z, seg = 16, material = null) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, ht, seg), material || mat(color));
  m.position.set(x, y + ht / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  h.group.add(m);
  return m;
}

export function ball(h, r, color, x, y, z, s = [1, 1, 1]) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(color));
  m.position.set(x, y, z); m.scale.set(...s); m.castShadow = true;
  h.group.add(m);
  return m;
}

/** Teppe: rektangel eller oval rett over gulvet. */
export function rug(h, w, d, color, x, z, round = false) {
  const g = round ? new THREE.CircleGeometry(0.5, 40) : new THREE.PlaneGeometry(1, 1);
  const m = new THREE.Mesh(g, mat(color));
  m.rotation.x = -Math.PI / 2; m.scale.set(w, d, 1);
  m.position.set(x, 0.006, z); m.receiveShadow = true;
  h.group.add(m);
  return m;
}

export function lamp(h, x, y, z, color = 0xffb866, intensity = 12) {
  const light = new THREE.PointLight(color, intensity, 9, 1.6);
  light.position.set(x, y, z);
  h.group.add(light);
}

function floorTexture(room) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const css = (n) => '#' + n.toString(16).padStart(6, '0');
  g.fillStyle = css(room.c1); g.fillRect(0, 0, 128, 128);
  if (room.floor === 'tiles') {
    g.fillStyle = css(room.c2); g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64);
    g.strokeStyle = 'rgba(60,40,20,.18)'; g.lineWidth = 2;
    for (const p of [0, 64, 128]) { g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 128); g.moveTo(0, p); g.lineTo(128, p); g.stroke(); }
  } else if (room.floor === 'planks') {
    for (let r = 0; r < 4; r++) {
      const y = r * 32, off = (r % 2) * 40;
      for (let s = 0; s < 3; s++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,240,220' : '60,30,10'},${Math.random() * 0.12})`;
        g.fillRect(off + s * 64 - 40, y, 64, 32);
      }
      g.fillStyle = 'rgba(50,25,10,.35)';
      g.fillRect(0, y, 128, 2);
      g.fillRect((off + 24) % 128, y, 2, 32); g.fillRect((off + 88) % 128, y, 2, 32);
    }
  } else {
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(255,255,230,${Math.random() * 0.12})`;
      g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.repeat.set((room.maxX - room.minX) / 2, (room.maxZ - room.minZ) / 2);
  return t;
}

function addFloor(h, room) {
  const w = room.maxX - room.minX, d = room.maxZ - room.minZ;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), matUnique(0xffffff, { map: floorTexture(room) }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(room.minX + w / 2, 0, room.minZ + d / 2);
  m.receiveShadow = true;
  h.group.add(m);
  h.walkables.push(m);
}

function wallSeg(h, horiz, fixed, a, b) {
  const len = b - a, mid = (a + b) / 2;
  const material = matUnique(WALL, { transparent: true });
  const m = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len + T : T, WALL_H, horiz ? T : len + T), material);
  m.position.set(horiz ? mid : fixed, WALL_H / 2, horiz ? fixed : mid);
  m.castShadow = true; m.receiveShadow = true;
  h.group.add(m);
  if (horiz) collider(h, a - T / 2, b + T / 2, fixed - T / 2, fixed + T / 2, 'both', { wall: true });
  else collider(h, fixed - T / 2, fixed + T / 2, a - T / 2, b + T / 2, 'both', { wall: true });
  h.walls.push({ horiz, fixed, a, b, materials: [material], opacity: 1 });
}

function wallLine(h, axis, fixed, from, to, doors = []) {
  let start = from;
  for (const [a, b] of [...doors, [to, to]]) {
    if (a > start) wallSeg(h, axis === 'x', fixed, start, a);
    start = b;
  }
}

function addWalls(h) {
  wallLine(h, 'x', -9, -12, 12);
  wallLine(h, 'x', 9, -12, 12);
  wallLine(h, 'z', -12, -9, 9);
  wallLine(h, 'z', 12, -9, 9);
  wallLine(h, 'x', 0, -12, 12, [[-9, -7.4], [-3.7, -2.3], [0, 1.6], [8, 9.6]]);
  wallLine(h, 'z', -2, -9, 0, [[-5, -3.4]]);
  wallLine(h, 'z', -4, 0, 9, [[3.5, 5.1]]);
  wallLine(h, 'z', 4, 0, 9);
}

function addWindow(h, x, moon) {
  const z = -8.87;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 0.05), mat(0xf4efe4));
  frame.position.set(x, 1.7, z); h.group.add(frame);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.0), glow(0x22355f));
  pane.position.set(x, 1.7, z + 0.03); h.group.add(pane);
  for (const [w, ht] of [[1.3, 0.05], [0.05, 1.0]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, ht, 0.04), mat(0xf4efe4));
    bar.position.set(x, 1.7, z + 0.04); h.group.add(bar);
  }
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.CircleGeometry(0.018, 6), glow(0xfff6c8));
    s.position.set(x - 0.55 + Math.random() * 1.1, 1.3 + Math.random() * 0.75, z + 0.035); h.group.add(s);
  }
  if (moon) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), glow(0xfff1b8));
    m.position.set(x + 0.32, 1.95, z + 0.035); h.group.add(m);
  }
}

function addHall(h) {
  const { minX, maxX, bottomZ, topZ, height, steps } = STAIRS;
  const cx = (minX + maxX) / 2, w = maxX - minX, d = (bottomZ - topZ) / steps, sh = height / steps;
  for (let i = 0; i < steps; i++) {
    h.walkables.push(box(h, w, (i + 1) * sh, d, i % 2 ? 0xa9763f : 0xb7844c, cx, 0, bottomZ - (i + 0.5) * d));
  }
  h.walkables.push(box(h, w, height, topZ - 0.1, 0xa9763f, cx, 0, (topZ + 0.1) / 2, 'both'));
  // rekkverk
  collider(h, 2.3, 2.5, topZ, 6.9, 'both');
  for (let z = topZ + 0.1; z <= 6.9; z += 0.45) cyl(h, 0.03, 0.03, 0.9, 0xf0e6d2, 2.4, stairHeight(cx, z), z, 8);
  const y0 = stairHeight(cx, topZ) + 0.9, y1 = stairHeight(cx, 6.9) + 0.9, dz = 6.9 - topZ;
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, Math.hypot(dz, y0 - y1)), mat(0x8a5a2e));
  rail.position.set(2.4, (y0 + y1) / 2, (topZ + 6.9) / 2);
  rail.rotation.x = Math.atan2(y0 - y1, dz);
  rail.castShadow = true; h.group.add(rail);
  cyl(h, 0.07, 0.07, 1.1, 0x8a5a2e, 2.4, 0, 6.95, 10);
  ball(h, 0.09, 0x8a5a2e, 2.4, 1.15, 6.95);
  // Trappetrollet stenger veien til det er fornøyd
  h.blocker = collider(h, 2.3, 4.0, 6.9, 8.9, 'both');
  lamp(h, cx, 3.1, 1.6, 0xffd27a, 10);
  // gang
  rug(h, 1.3, 5.2, 0xa0453a, -0.6, 4.6);
  box(h, 1.6, 0.4, 0.4, 0x6e4b33, -2.6, 0, 8.65, 'both');
  [[-3.1, 0xc8442f], [-2.7, 0x3d7cc9], [-2.2, 0xf2c14e]].forEach(([x, c]) => box(h, 0.22, 0.1, 0.32, c, x, 0.4, 8.62));
  box(h, 0.12, 0.75, 0.5, 0x2f6fa3, -3.84, 0.9, 7.3);
  box(h, 0.12, 0.6, 0.45, 0xc8442f, -3.84, 1.0, 6.6);
  box(h, 0.08, 0.06, 1.6, 0x6e4b33, -3.88, 1.75, 6.95);
}

/** Toner ut vegger mellom kamera og gutten, og gjemmesteder han står i. */
export function updateHouse(h, kid, dt) {
  const k = 1 - Math.exp(-8 * dt);
  for (const w of h.walls) {
    const hide = w.horiz && w.fixed > kid.z + 0.25 && w.b > kid.x - 9 && w.a < kid.x + 9;
    fade(w, hide ? 0.14 : 1, k);
  }
  for (const z of h.hideZones) fade(z, inZone(kid, z) ? 0.3 : 1, k);
}

function fade(o, target, k) {
  if (Math.abs(o.opacity - target) < 0.005) return;
  o.opacity += (target - o.opacity) * k;
  for (const m of o.materials) { m.opacity = o.opacity; m.depthWrite = o.opacity > 0.95; }
}
