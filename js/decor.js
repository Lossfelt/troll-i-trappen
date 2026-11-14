import * as THREE from 'three';
import { mat, glow, shine } from './world.js';
import { box, cyl, ball, lamp, STAIRS } from './house.js';

// Pynt og stemning: senga øverst i trappen, gardiner, bilder, lysslynge, måneskinn og såpebobler.
// Ingenting her har kollisjon.

const add = (h, m) => { h.group.add(m); return m; };

function flat(geo, material, x, y, z) {
  const m = new THREE.Mesh(geo, material);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}

/** Senga står på avsatsen øverst i trappen. Dyna brettes ut når gutten har lagt seg. */
function addBed(h) {
  const y = STAIRS.height, x = 3.3;
  box(h, 1.2, 0.22, 1.9, 0x8a5a2e, x, y, 1.15);
  box(h, 1.1, 0.14, 1.8, 0xf7f3ea, x, y + 0.22, 1.15);
  box(h, 1.24, 0.75, 0.1, 0x8a5a2e, x, y, 0.2);
  ball(h, 0.26, 0xfdfbf2, x, y + 0.42, 0.56, [1.5, 0.45, 0.9]);
  const fold = box(h, 1.12, 0.1, 0.45, 0x3f5fae, x, y + 0.36, 1.8);
  const cover = new THREE.Group();
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 12), mat(0x3f5fae));
  top.scale.set(1.16, 0.44, 1.02); top.castShadow = true;
  cover.add(top);
  for (const [sx, sz] of [[-0.3, -0.2], [0.25, 0.1], [-0.1, 0.3], [0.32, -0.3], [-0.38, 0.12]]) {
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat(0xffd84a));
    star.position.set(sx, 0.2 - Math.abs(sx) * 0.12, sz);
    cover.add(star);
  }
  cover.position.set(x, y + 0.5, 1.5);
  cover.visible = false;
  add(h, cover);
  // Nattlampe som en liten måne på veggen
  add(h, new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), glow(0xffe9a8))).position.set(3.86, y + 1.0, 0.45);
  h.bed = { x, y: y + 0.36, feetZ: 1.72, fold, cover };
}

function curtains(h, x, color) {
  const z = -8.84;
  for (const s of [-1, 1]) box(h, 0.3, 1.35, 0.06, color, x + s * 0.9, 1.05, z);
  box(h, 2.3, 0.05, 0.05, 0x6e4b33, x, 2.38, z);
  // Måneskinnet faller inn på gulvet
  add(h, flat(new THREE.PlaneGeometry(1.3, 2.5), shine(0x9db8ff, 0.13), x - 0.25, 0.014, -6.7));
}

/** Bilde på en vegg som vender mot kamera (sørsiden av en vegg). */
function picture(h, x, y, z, w, ht, art, frame = 0x6e4b33) {
  box(h, w + 0.1, ht + 0.1, 0.05, frame, x, y, z);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, ht), mat(art[0]));
  p.position.set(x, y + ht / 2 + 0.05, z + 0.03);
  add(h, p);
  // Enkle motiver: [farge, relativ x, relativ y, størrelse]
  for (const [c, rx, ry, s] of art.slice(1)) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(s, 12), mat(c));
    d.position.set(x + rx * w, y + 0.05 + ht / 2 + ry * ht, z + 0.035);
    add(h, d);
  }
}

function clock(h, x, y, z) {
  const face = add(h, new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 24), mat(0xfdfbf2)));
  face.rotation.x = Math.PI / 2; face.position.set(x, y, z);
  const rim = add(h, new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 8, 24), mat(0xc8442f)));
  rim.position.set(x, y, z + 0.02);
  // Klokka viser leggetid: sju
  for (const [len, ang] of [[0.2, 0], [0.13, (7 / 12) * Math.PI * 2]]) {
    const hand = add(h, new THREE.Mesh(new THREE.BoxGeometry(0.03, len, 0.02), mat(0x2a2018)));
    hand.position.set(x + Math.sin(ang) * len / 2, y + Math.cos(ang) * len / 2, z + 0.04);
    hand.rotation.z = -ang;
  }
}

/** Lysslynge som henger i en bue mellom to punkter. */
function fairyLights(h, x0, x1, y, z) {
  const colors = [0xffd166, 0xff7a6b, 0x7fd6a8, 0x8fc4ff, 0xf5a3d8];
  const n = Math.round((x1 - x0) / 0.32);
  for (let i = 0; i <= n; i++) {
    const t = i / n, sag = Math.sin(t * Math.PI) * 0.22;
    const b = add(h, new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), glow(colors[i % colors.length])));
    b.position.set(x0 + (x1 - x0) * t, y - sag, z);
    h.twinkles.push({ m: b, phase: i * 1.7 });
  }
}

function bubbles(h) {
  const material = new THREE.MeshBasicMaterial({ color: 0xeaf7ff, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 7; i++) {
    const m = add(h, new THREE.Mesh(new THREE.SphereGeometry(0.05 + (i % 3) * 0.025, 10, 8), material));
    h.bubbles.push({ m, x: 10.6 + ((i * 0.37) % 1) * 1.0, z: 6.0 + ((i * 0.61) % 1) * 2.4, phase: i / 7 });
  }
}

export function addDecor(h) {
  Object.assign(h, { twinkles: [], bubbles: [], flames: h.flames || [] });
  addBed(h);
  curtains(h, -8, 0xc8442f);
  curtains(h, 6, 0x3d6a8a);
  clock(h, -3.2, 1.85, -8.86);
  // Stua: maleri over peisen og et lite bilde ved bokhylla
  picture(h, 10.2, 1.62, -8.86, 0.9, 0.55, [0x8fc4e8, [0x4f8a3c, -0.2, -0.28, 0.2], [0x3f7a35, 0.22, -0.3, 0.16], [0xfff1b8, 0.25, 0.22, 0.08]]);
  picture(h, 1.4, 1.5, -8.86, 0.5, 0.5, [0xf4c9a7, [0x7b4a27, 0, 0.12, 0.13], [0x4f7fd1, 0, -0.3, 0.16]]);
  // Lekerommet: tegninger og lysslynge
  picture(h, -10.6, 1.1, 0.13, 0.5, 0.4, [0xffffff, [0xe04b3a, -0.2, 0, 0.08], [0xf2c14e, 0.15, 0.15, 0.07], [0x3d7cc9, 0.1, -0.2, 0.06]], 0xf2c14e);
  picture(h, -5.6, 1.15, 0.13, 0.45, 0.45, [0xffffff, [0x7f8f5c, 0, 0, 0.13], [0x2f5a2e, 0, 0.3, 0.07]], 0xe04b3a);
  fairyLights(h, -11.7, -9.2, 2.15, 0.14);
  fairyLights(h, -7.2, -4.2, 2.15, 0.14);
  lamp(h, -8, 2.0, 2.4, 0xffd0a0, 9);
  // Gangen: bilde og lys
  picture(h, -2.2, 1.4, 0.13, 0.7, 0.5, [0xf7e7c8, [0x4f7fd1, -0.22, -0.1, 0.1], [0xc8442f, 0.05, 0, 0.13], [0xe9c46a, 0.28, -0.15, 0.08]]);
  lamp(h, -1.2, 2.2, 4.6, 0xffcf8f, 9);
  // Badet: håndklær og såpebobler
  box(h, 1.1, 0.04, 0.04, 0x9aa3a8, 6.2, 1.5, 0.14);
  box(h, 0.4, 0.6, 0.05, 0xf2c14e, 5.95, 0.92, 0.15);
  box(h, 0.4, 0.5, 0.05, 0x6aa7c8, 6.45, 1.02, 0.15);
  lamp(h, 8, 2.1, 4.4, 0xd6ecff, 8);
  bubbles(h);
}

/** dim 0 = kveld, 1 = natt. Nattlampa ved senga står alltid på. */
export function updateDecor(h, time, dim = 0) {
  for (const l of h.lamps) {
    const flick = l.flicker ? 1 + l.flicker * (Math.sin(time * 11) * 0.5 + Math.sin(time * 23.7) * 0.3 + Math.sin(time * 5.3) * 0.2) : 1;
    l.light.intensity = l.base * flick * (l.night ? 1 : 1 - 0.8 * dim);
  }
  h.flames.forEach((f, i) => {
    f.scale.y = 1 + Math.sin(time * (9 + i * 2.3) + i) * 0.22;
    f.scale.x = f.scale.z = 1 + Math.sin(time * (7 + i * 1.7)) * 0.1;
  });
  for (const t of h.twinkles) t.m.scale.setScalar(0.85 + Math.sin(time * 2.2 + t.phase) * 0.25);
  for (const b of h.bubbles) {
    const k = (time * 0.16 + b.phase) % 1;
    b.m.position.set(b.x + Math.sin(time * 1.3 + b.phase * 9) * 0.12, 0.65 + k * 1.3, b.z);
    b.m.scale.setScalar(k < 0.9 ? 0.5 + k * 0.7 : (1 - k) * 11);
  }
}
