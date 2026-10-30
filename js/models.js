import * as THREE from 'three';
import { mat, glow } from './world.js';

// Figurer bygget av enkle former: gutten, trollene, bamsen og ting å plukke opp.

const geoCache = new Map();
function sphereGeo(r) {
  if (!geoCache.has(r)) geoCache.set(r, new THREE.SphereGeometry(r, 18, 14));
  return geoCache.get(r);
}

function sph(r, color, x = 0, y = 0, z = 0, s = [1, 1, 1]) {
  const m = new THREE.Mesh(sphereGeo(r), mat(color));
  m.position.set(x, y, z); m.scale.set(...s); m.castShadow = true;
  return m;
}

function cone(r, h, color, seg = 12) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color));
  m.castShadow = true;
  return m;
}

/** Arm eller bein som henger ned fra et ledd. userData.end er y for hånd/fot. */
function limb(r, len, color, x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const c = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat(color));
  c.position.y = -(len / 2 + r * 0.6); c.castShadow = true;
  pivot.add(c);
  pivot.userData.end = -(len + r * 1.2);
  return pivot;
}

const tint = (hex, k) => new THREE.Color(hex).lerp(new THREE.Color(k > 0 ? 0xffffff : 0x000000), Math.abs(k)).getHex();

export const HAIR = { lys: 0xe9c46a, brun: 0x7b4a27, mork: 0x2f2520, rod: 0xb6532b };

export function makeKid(hairKey = 'brun') {
  const PJ = 0x4f7fd1, SKIN = 0xf4c9a7, HAIRC = HAIR[hairKey] ?? HAIR.brun;
  const group = new THREE.Group(), body = new THREE.Group();
  group.add(body);
  const legL = limb(0.085, 0.14, PJ, -0.09, 0.3, 0), legR = limb(0.085, 0.14, PJ, 0.09, 0.3, 0);
  for (const leg of [legL, legR]) leg.add(sph(0.075, 0xf7f3ea, 0, -0.29, 0.03, [1, 0.6, 1.35]));
  body.add(legL, legR);
  body.add(sph(0.2, PJ, 0, 0.48, 0, [1, 1.15, 0.9]));
  body.add(sph(0.028, 0xffd84a, 0.08, 0.55, 0.17), sph(0.022, 0xffd84a, -0.07, 0.42, 0.18), sph(0.02, 0xffd84a, 0.03, 0.35, 0.18));
  const armL = limb(0.058, 0.15, PJ, -0.21, 0.62, 0), armR = limb(0.058, 0.15, PJ, 0.21, 0.62, 0);
  armL.add(sph(0.06, SKIN, 0, armL.userData.end, 0));
  armR.add(sph(0.06, SKIN, 0, armR.userData.end, 0));
  body.add(armL, armR);

  const head = new THREE.Group();
  head.position.y = 0.88;
  body.add(head);
  head.add(sph(0.27, SKIN));
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.29, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), mat(HAIRC));
  hair.rotation.x = -0.45; hair.position.set(0, 0.02, -0.03); hair.castShadow = true;
  head.add(hair, sph(0.12, HAIRC, 0.03, 0.17, 0.17, [1.5, 0.5, 0.6]));
  for (const sx of [-1, 1]) {
    head.add(sph(0.034, 0x2a1d17, sx * 0.09, 0.01, 0.245));
    head.add(sph(0.012, 0xffffff, sx * 0.09 + 0.012, 0.025, 0.272));
    head.add(sph(0.045, 0xf19b8b, sx * 0.16, -0.07, 0.19, [1, 0.6, 0.5]));
    head.add(sph(0.05, SKIN, sx * 0.265, 0, 0));
  }
  head.add(sph(0.035, tint(SKIN, -0.08), 0, -0.02, 0.27));
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), mat(0x8a3a2e));
  smile.rotation.z = Math.PI; smile.position.set(0, -0.08, 0.25);
  head.add(smile);
  return { group, body, head, legL, legR, armL, armR };
}

function buildHead(hg, L, SKIN, pupils, main) {
  hg.add(sph(0.38, SKIN, 0, 0, 0, [1, 0.95, 0.95]));
  hg.add(sph(0.12, tint(SKIN, -0.12), 0, -0.03, 0.36 + 0.06 * L.nose, [0.95, 0.9, 1.25 * L.nose]));
  const e = L.eyes;
  for (const sx of [-1, 1]) {
    hg.add(sph(0.085 * e, 0xfdfbf2, sx * 0.14, 0.11, 0.3));
    const p = sph(0.045 * e, 0x1d1712, sx * 0.14, 0.11, 0.3 + 0.07 * e);
    hg.add(p); pupils.push(p);
    if (L.lids) hg.add(sph(0.092 * e, SKIN, sx * 0.14, 0.15, 0.3, [1.05, 0.62, 1.05]));
    if (L.brows) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.045, 0.05), mat(0x2a2320));
      b.position.set(sx * 0.14, 0.24, 0.33); b.rotation.z = sx * 0.45 * L.brows;
      hg.add(b);
    }
    const ear = cone(0.1, 0.32, SKIN, 10);
    ear.position.set(sx * 0.4, 0.05, -0.02); ear.rotation.z = -sx * (Math.PI / 2.3);
    hg.add(ear);
    if (L.tusks) {
      const t = cone(0.03, 0.09, 0xf6f0dc, 8);
      t.position.set(sx * 0.08, -0.15, 0.33);
      hg.add(t);
    }
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 14, Math.PI), mat(0x3b1f1c));
  mouth.position.set(0, L.frown ? -0.24 : -0.15, 0.33);
  if (!L.frown) mouth.rotation.z = Math.PI;
  hg.add(mouth);

  const tufts = L.fluffy ? 10 : 6;
  for (let i = 0; i < tufts; i++) {
    const a = (i / tufts) * Math.PI * 2;
    hg.add(sph(L.fluffy ? 0.13 : 0.1, L.hair, Math.cos(a) * 0.22, 0.3 + (i % 2) * 0.03, Math.sin(a) * 0.2 - 0.04));
  }
  hg.add(sph(0.14, L.hair, 0, 0.36, -0.04));
  if (L.beard) hg.add(sph(0.24, L.hair, 0, -0.3, 0.14, [1, 1.15, 0.65]));
  if (L.tree && main) {
    for (const [tx, s] of [[-0.08, 1], [0.17, 0.65]]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.3 * s, 6), mat(0x5b3b22));
      trunk.position.set(tx, 0.4 + 0.15 * s, 0);
      const crown = cone(0.17 * s, 0.45 * s, 0x2f5a2e, 8);
      crown.position.set(tx, 0.4 + 0.3 * s + 0.2 * s, 0);
      hg.add(trunk, crown);
    }
  }
  if (L.hat) {
    const hat = cone(0.3, 0.7, L.hat === 'sock' ? 0xc9473a : 0x3d5fa8, 14);
    hat.position.set(0.04, 0.5, -0.02); hat.rotation.z = -0.35;
    hat.add(sph(0.08, 0xfdf8ee, 0, 0.36, 0));
    const stripes = L.hat === 'sock' ? [-0.33, -0.1, 0.12] : [-0.33];
    for (const y of stripes) {
      const r = (0.3 * (0.35 - y)) / 0.7 + 0.01;
      const band = new THREE.Mesh(new THREE.TorusGeometry(r, y < -0.3 ? 0.05 : 0.03, 6, 20), mat(0xfdf8ee));
      band.rotation.x = Math.PI / 2; band.position.y = y;
      hat.add(band);
    }
    hg.add(hat);
  }
}

export function makeTroll(look) {
  const L = { skin: 0x7d8b5a, hair: 0x4a3a2a, size: 1, nose: 1, heads: 1, eyes: 1, fat: 1, ...look };
  const SKIN = L.skin, DARK = tint(SKIN, -0.25), BELLY = L.belly ?? tint(SKIN, 0.3);
  const group = new THREE.Group(), body = new THREE.Group();
  body.scale.setScalar(L.size);
  group.add(body);

  const legL = limb(0.13, 0.22, SKIN, -0.2, 0.42, 0), legR = limb(0.13, 0.22, SKIN, 0.2, 0.42, 0);
  for (const leg of [legL, legR]) leg.add(sph(0.15, DARK, 0, -0.4, 0.08, [1, 0.5, 1.5]));
  body.add(legL, legR);
  body.add(sph(0.5, SKIN, 0, 0.88, 0, [L.fat, 1.05, 0.85 * L.fat]));
  body.add(sph(0.36, BELLY, 0, 0.8, 0.22 * L.fat, [L.fat, 1.1, 0.55]));
  const cloth = new THREE.Mesh(new THREE.CylinderGeometry(0.47 * L.fat, 0.52 * L.fat, 0.24, 18), mat(0x6b4a2b));
  cloth.position.y = 0.5; cloth.castShadow = true;
  body.add(cloth);

  const armL = limb(0.1, 0.48, SKIN, -0.48 * L.fat, 1.18, 0), armR = limb(0.1, 0.48, SKIN, 0.48 * L.fat, 1.18, 0);
  armL.add(sph(0.13, DARK, 0, armL.userData.end, 0));
  armR.add(sph(0.13, DARK, 0, armR.userData.end, 0));
  body.add(armL, armR);

  const tail = new THREE.Group();
  tail.position.set(0, 0.55, -0.38);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.6, 8), mat(SKIN));
  stick.position.y = -0.3;
  tail.add(stick, sph(0.1, L.hair, 0, -0.62, 0));
  tail.rotation.x = 0.9;
  body.add(tail);

  const spots = L.heads === 3
    ? [[-0.45, 1.5, 0, 0.78], [0, 1.72, 0.04, 0.9], [0.45, 1.5, 0, 0.78]]
    : [[0, 1.62, 0.04, 1]];
  const heads = [], pupils = [];
  spots.forEach(([x, y, z, s], i) => {
    const hg = new THREE.Group();
    hg.position.set(x, y, z); hg.scale.setScalar(s);
    buildHead(hg, L, SKIN, pupils, i === (spots.length === 3 ? 1 : 0));
    if (spots.length === 3 && i !== 1) hg.rotation.z = i === 0 ? 0.25 : -0.25;
    body.add(hg); heads.push(hg);
  });
  return { group, body, heads, legL, legR, armL, armR, tail, pupils };
}

export function makeBamse() {
  const g = new THREE.Group(), B = 0x9b6a3c, LIGHT = 0xd8b07e;
  g.add(sph(0.15, B, 0, 0.17, 0, [1, 1.1, 0.9]), sph(0.08, LIGHT, 0, 0.15, 0.11, [1, 1.1, 0.5]));
  g.add(sph(0.12, B, 0, 0.4, 0), sph(0.05, LIGHT, 0, 0.37, 0.1, [1, 0.8, 0.8]), sph(0.018, 0x1b1b1b, 0, 0.39, 0.15));
  for (const sx of [-1, 1]) {
    g.add(sph(0.045, B, sx * 0.09, 0.5, 0), sph(0.016, 0x1b1b1b, sx * 0.045, 0.44, 0.1));
    g.add(sph(0.06, B, sx * 0.08, 0.05, 0.05), sph(0.055, B, sx * 0.15, 0.22, 0.03));
    g.add(sph(0.03, 0xc8442f, sx * 0.035, 0.29, 0.1));
  }
  return g;
}

function itemShape(id) {
  const g = new THREE.Group();
  if (id === 'kjeks') {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 20), mat(0xc98d4b));
    c.rotation.x = Math.PI / 2.5;
    for (const [x, z] of [[0.06, 0.03], [-0.05, 0.06], [-0.02, -0.07], [0.07, -0.05]]) c.add(sph(0.025, 0x4a2c1a, x, 0.028, z));
    g.add(c);
  } else if (id === 'banan') {
    const b = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 8, 16, Math.PI * 0.7), mat(0xf2d33a));
    b.rotation.z = Math.PI * 1.15;
    g.add(b);
  } else if (id === 'sokk') {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.18, 4, 10), mat(0xd04a3a));
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.12, 4, 10), mat(0xd04a3a));
    foot.rotation.x = Math.PI / 2; foot.position.set(0, -0.13, 0.07);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.02, 6, 16), mat(0xffffff));
    band.rotation.x = Math.PI / 2; band.position.y = 0.1;
    g.add(leg, foot, band);
  } else if (id === 'bil') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.2), mat(0xd63b2f));
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.17), mat(0x6fb7e0));
    cab.position.set(-0.03, 0.1, 0);
    g.add(body, cab);
    for (const [x, z] of [[-0.12, -0.1], [0.12, -0.1], [-0.12, 0.1], [0.12, 0.1]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), mat(0x222222));
      w.rotation.x = Math.PI / 2; w.position.set(x, -0.06, z);
      g.add(w);
    }
  } else if (id === 'ball') {
    g.add(sph(0.14, 0xe94f3f));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.022, 6, 20), mat(0xffffff));
    const ring2 = ring.clone(); ring2.material = mat(0xf2c14e); ring2.rotation.y = Math.PI / 2;
    g.add(ring, ring2);
  } else if (id === 'bamse') {
    const b = makeBamse(); b.position.y = -0.2;
    g.add(b);
  }
  return g;
}

/** Svevende ting med en gylden ring under. */
export function makeItem(id) {
  const group = new THREE.Group(), float = itemShape(id);
  float.position.y = 0.4;
  group.add(float);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.36, 28), glow(0xffd76a, 0.5));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02;
  group.add(ring);
  return { group, float, ring };
}
