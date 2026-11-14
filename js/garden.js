import * as THREE from 'three';
import { mat, matUnique, glow } from './world.js';

// Hagen rundt huset om kvelden: gress, grantrær, busker, fluesopp og ildfluer.

/** Fast tilfeldighet, så hagen ser lik ut hver gang. */
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function grassTexture(rnd) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2b4a36'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(120,170,110,.16)' : 'rgba(10,25,20,.2)';
    g.fillRect(rnd() * 128, rnd() * 128, 2, 3 + rnd() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(30, 30);
  return t;
}

function pine(g, x, z, s) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.17 * s, 0.7 * s, 7), mat(0x4a3324));
  trunk.position.set(x, 0.35 * s, z);
  g.add(trunk);
  [[0.95, 1.3, 0.6, 0x24523a], [0.75, 1.15, 1.25, 0x2a5c40], [0.52, 1.0, 1.85, 0x316846]].forEach(([r, ht, y, c]) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r * s, ht * s, 9), mat(c));
    cone.position.set(x, (y + ht / 2) * s, z);
    g.add(cone);
  });
}

function bush(g, x, z, s, rnd) {
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.4 * s * (0.7 + rnd() * 0.5), 10, 8), mat(i % 2 ? 0x356b40 : 0x2c5a38));
    b.position.set(x + (rnd() - 0.5) * 0.7 * s, 0.22 * s, z + (rnd() - 0.5) * 0.4 * s);
    b.scale.y = 0.8;
    g.add(b);
  }
}

function mushroom(g, x, z, s) {
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.08 * s, 0.22 * s, 8), mat(0xf4efe0));
  stem.position.set(x, 0.11 * s, z);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd0392b));
  cap.position.set(x, 0.2 * s, z); cap.scale.y = 0.8;
  g.add(stem, cap);
  for (const [dx, dz] of [[0.08, 0.05], [-0.07, 0.08], [0, -0.09]]) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.03 * s, 6, 5), mat(0xffffff));
    dot.position.set(x + dx * s, 0.2 * s + 0.13 * s, z + dz * s);
    g.add(dot);
  }
}

function flower(g, x, z, color) {
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 5), mat(0x3f7a35));
  stem.position.set(x, 0.15, z);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mat(color));
  head.position.set(x, 0.33, z);
  const mid = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), mat(0xffd84a));
  mid.position.set(x, 0.37, z + 0.03);
  g.add(stem, head, mid);
}

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.4, 'rgba(255,255,255,.5)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export function addGarden(scene) {
  const rnd = seeded(7), g = new THREE.Group();
  scene.add(g);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), matUnique(0xffffff, { map: grassTexture(rnd) }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true;
  g.add(ground);

  // Høye graner i nord og på sidene, lavere foran så de ikke skjuler huset
  const band = (n, x0, x1, z0, z1, s0, s1) => {
    for (let i = 0; i < n; i++) pine(g, x0 + rnd() * (x1 - x0), z0 + rnd() * (z1 - z0), s0 + rnd() * (s1 - s0));
  };
  band(11, -18, 18, -17, -11.2, 1.5, 2.4);
  band(5, -19, -14, -9, 11, 1.2, 2.0);
  band(5, 14, 19, -9, 11, 1.2, 2.0);
  band(6, -17, 17, 13.2, 17, 0.9, 1.4);

  for (let i = 0; i < 9; i++) bush(g, -11 + i * 2.8 + rnd(), 10 + rnd() * 0.5, 0.9 + rnd() * 0.4, rnd);
  for (const z of [-6, -1.5, 3, 7]) { bush(g, -13 - rnd() * 0.6, z + rnd(), 1.2, rnd); bush(g, 13 + rnd() * 0.6, z + rnd(), 1.2, rnd); }
  const petals = [0xf5a3d8, 0xffd166, 0xff7a6b, 0xf4efe0, 0x8fc4ff];
  for (let i = 0; i < 16; i++) flower(g, -11.5 + rnd() * 23, 9.5 + rnd() * 0.5, petals[i % petals.length]);
  for (const [x, z, s] of [[-14, 9.6, 1.5], [-13.4, 10.3, 0.9], [13.6, 10.4, 1.3], [14.3, 9.8, 0.8], [1.5, 11.4, 1.1], [-6.5, 11.6, 0.8], [8.2, 11.5, 1.0]]) mushroom(g, x, z, s);
  for (let i = 0; i < 10; i++) {
    const a = rnd() * Math.PI * 2, r = 0.2 + rnd() * 0.25;
    const stone = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat(0x6f7480));
    stone.position.set(Math.cos(a) * (15 + rnd() * 2), r * 0.3, Math.sin(a) * (12 + rnd() * 2)); stone.scale.y = 0.6;
    g.add(stone);
  }
  // En liten lykt ved hjørnet
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.3, 8), mat(0x2a2a30));
  post.position.set(12.9, 0.65, 10.3);
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), glow(0xffd98a));
  lantern.position.set(12.9, 1.4, 10.3);
  g.add(post, lantern);

  // Ildfluer som svever rundt huset
  const N = 46, base = [], pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const side = i % 4;
    const x = side === 1 ? -13 - rnd() * 4 : side === 2 ? 13 + rnd() * 4 : -14 + rnd() * 28;
    const z = side === 0 ? 9.8 + rnd() * 4 : side === 3 ? -10.5 - rnd() * 3 : -9 + rnd() * 19;
    base.push({ x, y: 0.4 + rnd() * 1.6, z, p: rnd() * 20, s: 0.4 + rnd() * 0.6 });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const flies = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xfff2a0, size: 0.3, map: dotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  flies.frustumCulled = false;
  g.add(flies);

  return {
    update(time) {
      base.forEach((b, i) => {
        pos[i * 3] = b.x + Math.sin(time * 0.5 * b.s + b.p) * 0.9;
        pos[i * 3 + 1] = b.y + Math.sin(time * 0.9 * b.s + b.p * 2) * 0.35;
        pos[i * 3 + 2] = b.z + Math.cos(time * 0.4 * b.s + b.p) * 0.7;
      });
      geo.attributes.position.needsUpdate = true;
      flies.material.opacity = 0.75 + Math.sin(time * 2.1) * 0.25;
    },
  };
}
