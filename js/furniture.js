import * as THREE from 'three';
import { mat, matUnique, glow } from './world.js';
import { box, cyl, ball, rug, lamp, collider } from './house.js';

// Møblene i hvert rom. Høyder er fra en treåring sitt perspektiv: bordet er stort nok til å gå under.

function chair(h, x, z, rot) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = rot;
  const parts = [[0.55, 0.06, 0.55, 0, 0.63, 0], [0.55, 0.6, 0.05, 0, 0.96, -0.25]];
  for (const [sx, sz] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) parts.push([0.05, 0.6, 0.05, sx, 0.3, sz]);
  for (const [w, ht, d, px, py, pz] of parts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, ht, d), mat(0x8c5a32));
    m.position.set(px, py, pz); m.castShadow = true; g.add(m);
  }
  h.group.add(g);
  collider(h, x - 0.28, x + 0.28, z - 0.28, z + 0.28, 'both');
}

export function addKitchen(h) {
  box(h, 1.2, 2.1, 0.9, 0xf1efe8, -11.3, 0, -8.4, 'both');
  box(h, 0.06, 0.7, 0.05, 0x9aa3a8, -10.85, 1.0, -7.93);
  box(h, 5.6, 1.0, 0.85, 0xdccdb0, -7.9, 0, -8.47, 'both');
  box(h, 5.7, 0.08, 0.95, 0x6b4a2f, -7.9, 1.0, -8.45);
  for (const x of [-10, -8.6, -7.2, -5.8]) box(h, 0.3, 0.04, 0.03, 0x8a7a60, x, 0.8, -8.03);
  box(h, 0.9, 0.03, 0.6, 0x2e2e2e, -6.2, 1.08, -8.45);
  for (const [dx, dz] of [[-0.2, -0.13], [0.2, -0.13], [-0.2, 0.13], [0.2, 0.13]]) cyl(h, 0.09, 0.09, 0.012, 0x8a2f22, -6.2 + dx, 1.11, -8.45 + dz);

  // Kjøkkenbordet er et gjemmested: troll får ikke plass under
  const tableMat = matUnique(0xb5834f, { transparent: true });
  box(h, 2.6, 0.1, 1.6, 0, -7, 1.15, -4.2, null, tableMat);
  for (const [dx, dz] of [[-1.15, -0.65], [1.15, -0.65], [-1.15, 0.65], [1.15, 0.65]]) box(h, 0.1, 1.15, 0.1, 0, -7 + dx, 0, -4.2 + dz, null, tableMat);
  collider(h, -8.3, -5.7, -5.0, -3.4, 'troll');
  h.hideZones.push({ minX: -8.3, maxX: -5.7, minZ: -5.0, maxZ: -3.4, materials: [tableMat], opacity: 1, name: 'under bordet' });
  cyl(h, 0.25, 0.15, 0.12, 0xe8e0d0, -7.2, 1.25, -4.2);
  ball(h, 0.08, 0xd6402f, -7.28, 1.4, -4.18); ball(h, 0.08, 0x8ab33a, -7.1, 1.4, -4.25); ball(h, 0.07, 0xf2c14e, -7.2, 1.42, -4.08);
  for (const [x, z, r] of [[-7.7, -5.4, 0], [-6.3, -5.4, 0], [-7.7, -3.0, Math.PI], [-6.3, -3.0, Math.PI]]) chair(h, x, z, r);
  lamp(h, -7, 2.1, -4.2, 0xffc277, 9);
}

export function addLiving(h) {
  // sofa
  box(h, 4, 0.5, 1.1, 0x9c3f3a, 6, 0, -8.3, 'both');
  box(h, 4, 0.65, 0.3, 0x86332f, 6, 0.45, -8.72);
  box(h, 0.3, 0.75, 1.1, 0x86332f, 3.85, 0, -8.3, 'both');
  box(h, 0.3, 0.75, 1.1, 0x86332f, 8.15, 0, -8.3, 'both');
  box(h, 1.2, 0.35, 0.3, 0xe0b44a, 5.1, 0.55, -8.45);
  box(h, 1.2, 0.35, 0.3, 0x5f8f6a, 6.9, 0.55, -8.45);
  // peis
  box(h, 1.8, 1.4, 0.7, 0x9a5b45, 10.2, 0, -8.55, 'both');
  box(h, 0.9, 0.7, 0.05, 0x1e1410, 10.2, 0.15, -8.18);
  box(h, 2.0, 0.1, 0.8, 0x6b4a2f, 10.2, 1.4, -8.5);
  for (const [dx, r, ht, c] of [[0, 0.17, 0.45, 0xff8a2e], [0.12, 0.1, 0.3, 0xffd166], [-0.13, 0.1, 0.28, 0xffb347]]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(r, ht, 8), glow(c));
    f.position.set(10.2 + dx, 0.17 + ht / 2, -8.28); h.group.add(f);
  }
  lamp(h, 10.2, 0.7, -7.6, 0xff7a2e, 6);
  // bokhylle
  box(h, 2, 2.0, 0.45, 0x7a5233, -0.5, 0, -8.65, 'both');
  const books = [0xc8442f, 0x3d7cc9, 0xf2c14e, 0x4caf6a, 0x8e5aa8, 0xe07a5f];
  for (const y of [0.1, 0.75, 1.4]) {
    let x = -1.35;
    while (x < 0.3) {
      const w = 0.1 + Math.random() * 0.1, ht = 0.35 + Math.random() * 0.2;
      box(h, w, ht, 0.3, books[Math.floor(Math.random() * books.length)], x + w / 2, y, -8.4);
      x += w + 0.02;
    }
  }
  // stålampe
  cyl(h, 0.03, 0.03, 1.8, 0x3a3a3a, 2.6, 0, -8.3, 8);
  cyl(h, 0.3, 0.35, 0.05, 0x3a3a3a, 2.6, 0, -8.3);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 0.35, 16, 1, true), glow(0xf6d79a));
  shade.position.set(2.6, 1.85, -8.3); h.group.add(shade);
  lamp(h, 2.6, 1.8, -8.0);
  // sofabord, teppe, lenestol
  rug(h, 6, 4.2, 0xc99a45, 6, -6, true);
  box(h, 1.6, 0.42, 0.9, 0x8b5e3c, 6, 0, -5.6, 'both');
  cyl(h, 0.06, 0.05, 0.1, 0xf4f1ea, 5.7, 0.42, -5.5);
  box(h, 1, 0.45, 1, 0x3f6b5a, 2.9, 0, -5.8, 'both');
  box(h, 0.25, 0.65, 1, 0x355b4c, 2.5, 0.45, -5.8);
  box(h, 0.8, 0.25, 0.18, 0x355b4c, 2.95, 0.45, -6.22);
  box(h, 0.8, 0.25, 0.18, 0x355b4c, 2.95, 0.45, -5.38);
  // TV
  box(h, 0.5, 0.5, 2.0, 0x5a3e2b, 11.6, 0, -4.5, 'both');
  box(h, 0.08, 0.9, 1.6, 0x1c1c1c, 11.62, 0.5, -4.5);
  const screenPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.78), glow(0x2c3e66));
  screenPlane.position.set(11.57, 0.95, -4.5); screenPlane.rotation.y = -Math.PI / 2; h.group.add(screenPlane);
  // plante
  cyl(h, 0.25, 0.2, 0.45, 0xb0603a, 11.2, 0, -1.0);
  ball(h, 0.45, 0x4f8a3c, 11.2, 0.85, -1.0);
  collider(h, 10.95, 11.45, -1.25, -0.75, 'both');
}

export function addBath(h) {
  box(h, 1.6, 0.65, 3.2, 0xf4f4f1, 11.1, 0, 7.2, 'both');
  box(h, 1.3, 0.02, 2.9, 0, 11.1, 0.6, 7.2, null, glow(0x8fd0e6));
  ball(h, 0.09, 0xf7d23e, 11.0, 0.7, 6.5);
  ball(h, 0.06, 0xf7d23e, 11.0, 0.8, 6.45);
  ball(h, 0.025, 0xe8742a, 11.0, 0.79, 6.39);
  box(h, 0.45, 0.42, 0.55, 0xf4f4f1, 5.3, 0, 8.4, 'both');
  box(h, 0.5, 0.8, 0.22, 0xf4f4f1, 5.3, 0, 8.78);
  cyl(h, 0.24, 0.24, 0.04, 0xdedad0, 5.3, 0.42, 8.38);
  box(h, 1.0, 0.85, 0.5, 0xe9e4da, 7.4, 0, 8.62, 'both');
  cyl(h, 0.3, 0.22, 0.12, 0xffffff, 7.4, 0.85, 8.6);
  cyl(h, 0.35, 0.3, 0.55, 0xc9a46a, 5.0, 0, 1.0);
  collider(h, 4.65, 5.35, 0.65, 1.35, 'both');
  ball(h, 0.1, 0xd04a3a, 4.9, 0.6, 1.05, [1, 1.6, 1]);
  rug(h, 1.0, 1.4, 0x6aa7c8, 9.6, 7.2);
}

function tent(h, cx, cz) {
  const material = matUnique(0xd8574a, { side: THREE.DoubleSide, transparent: true });
  const half = 0.85, height = 1.5, len = 1.8;
  const slope = Math.hypot(half, height), ang = Math.atan2(height, half);
  for (const s of [1, -1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(len, slope), material);
    p.position.set(cx, height / 2, cz + (s * half) / 2);
    p.rotation.x = -s * (Math.PI / 2 - ang);
    p.castShadow = true;
    h.group.add(p);
  }
  cyl(h, 0.02, 0.02, 0.6, 0x6e4b33, cx + len / 2, height - 0.1, cz, 6);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.18), new THREE.MeshBasicMaterial({ color: 0xf2c14e, side: THREE.DoubleSide }));
  flag.position.set(cx + len / 2 + 0.15, height + 0.38, cz); h.group.add(flag);
  collider(h, cx - len / 2, cx + len / 2, cz - half, cz + half, 'troll');
  h.hideZones.push({ minX: cx - len / 2, maxX: cx + len / 2, minZ: cz - half, maxZ: cz + half, materials: [material], opacity: 1, name: 'i teltet' });
}

export function addPlayroom(h) {
  tent(h, -9.5, 6.2);
  rug(h, 3.4, 3.4, 0xe7c25a, -8, 3.4, true);
  box(h, 1.2, 0.6, 0.6, 0x3d7cc9, -5.0, 0, 8.5, 'both');
  box(h, 1.22, 0.06, 0.62, 0xf2c14e, -5.0, 0.6, 8.5);
  for (const [x, z, y, c] of [[-6.5, 6.8, 0, 0xe04b3a], [-6.2, 7.1, 0, 0xf2c14e], [-6.8, 7.3, 0, 0x4caf6a], [-6.5, 6.8, 0.22, 0x3d7cc9]]) {
    box(h, 0.22, 0.22, 0.22, c, x, y, z);
  }
  // lite tegnebord
  box(h, 1.1, 0.5, 0.75, 0xf2c14e, -6.3, 0, 2.2, 'both');
  box(h, 0.4, 0.01, 0.3, 0xffffff, -6.4, 0.5, 2.2);
  box(h, 0.25, 0.03, 0.03, 0xc8442f, -6.0, 0.51, 2.1);
  // gyngehest
  box(h, 0.8, 0.3, 0.28, 0xa0663a, -10.8, 0.45, 2.0);
  box(h, 0.25, 0.35, 0.22, 0xa0663a, -10.35, 0.7, 2.0);
  box(h, 0.1, 0.3, 0.06, 0x3b2a1e, -10.55, 0.75, 2.0);
  for (const [dx, dz] of [[-0.3, -0.1], [0.3, -0.1], [-0.3, 0.1], [0.3, 0.1]]) box(h, 0.06, 0.4, 0.06, 0x8a5530, -10.8 + dx, 0.05, 2.0 + dz);
  for (const dz of [-0.12, 0.12]) box(h, 1.0, 0.05, 0.05, 0x6e4b33, -10.8, 0, 2.0 + dz);
  collider(h, -11.3, -10.2, 1.8, 2.2, 'both');
  // lav hylle
  box(h, 0.4, 1.0, 1.6, 0xcf8f5a, -11.7, 0, 4.0, 'both');
  box(h, 0.2, 0.25, 0.2, 0x8e5aa8, -11.7, 1.0, 3.6);
  ball(h, 0.12, 0xe04b3a, -11.7, 1.12, 4.3);
}
