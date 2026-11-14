import * as THREE from 'three';

// Småeffekter: glitter, støvskyer, emojier som spretter ut, og tekstskilt.
const parts = [];
const geo = new THREE.OctahedronGeometry(1, 0);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function addPart(scene, m, material, base, life, v, extra = {}) {
  material.userData.n = (material.userData.n || 0) + 1;
  scene.add(m);
  parts.push({ m, material, base, life, max: life, v, gravity: 4, spin: true, ...extra });
}

/** Glitter eller røyk som spruter ut fra et punkt. */
export function burst(scene, pos, color, n = 16, opts = {}) {
  const { speed = 2.6, size = 0.08, life = 0.9, up = 2.5, lift = 0.6 } = opts;
  const material = new THREE.MeshBasicMaterial({ color, transparent: true });
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, material);
    const base = size * (0.6 + Math.random() * 0.8);
    m.scale.setScalar(base);
    m.position.copy(pos);
    m.position.y += lift + Math.random() * lift;
    const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
    addPart(scene, m, material, base, life, new THREE.Vector3(Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s));
  }
}

/** Liten støvsky ved føttene, for løping og landing. */
export function puff(scene, pos, n = 5) {
  if (reducedMotion) return;
  burst(scene, pos, 0xe9dfcc, n, { speed: 0.9, size: 0.07, life: 0.45, up: 0.7, lift: 0.04 });
}

const emojiTex = new Map();
function emojiTexture(ch) {
  if (!emojiTex.has(ch)) {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d');
    g.font = '72px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ch, 48, 54);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    emojiTex.set(ch, t);
  }
  return emojiTex.get(ch);
}

function emojiSprite(ch, size) {
  const material = new THREE.SpriteMaterial({ map: emojiTexture(ch), transparent: true, depthTest: false });
  const m = new THREE.Sprite(material);
  m.scale.setScalar(size); m.renderOrder = 9;
  return m;
}

/** Emojier som spruter ut: stjerner, hjerter, noter. */
export function sparkle(scene, pos, emoji, n = 8, opts = {}) {
  const { speed = 2.2, size = 0.34, life = 1.2, up = 3.2, lift = 0.7 } = opts;
  for (let i = 0; i < n; i++) {
    const base = size * (0.7 + Math.random() * 0.6), m = emojiSprite(emoji, base);
    m.position.set(pos.x, pos.y + lift + Math.random() * 0.5, pos.z);
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    addPart(scene, m, m.material, base, life, new THREE.Vector3(Math.cos(a) * s, up * (0.5 + Math.random() * 0.6), Math.sin(a) * s), { spin: false });
  }
}

/** Én emoji som stiger rolig opp over hodet på noen. */
export function emote(scene, pos, y, emoji, size = 0.6) {
  const m = emojiSprite(emoji, size);
  m.position.set(pos.x, pos.y + y, pos.z);
  addPart(scene, m, m.material, size, 1.4, new THREE.Vector3(0, 0.7, 0), { gravity: 0, spin: false, pop: true });
}

export function updateFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    p.v.y -= p.gravity * dt;
    p.m.position.addScaledVector(p.v, dt);
    if (p.spin) { p.m.rotation.x += dt * 5; p.m.rotation.y += dt * 4; }
    const k = Math.max(0, p.life / p.max);
    p.material.opacity = Math.min(1, k * 2);
    // Emojier over hodet spretter ut og blir stående; glitter krymper
    p.m.scale.setScalar(p.pop ? p.base * Math.min(1, (1 - k) * 8) : p.base * (0.5 + k * 0.5));
    if (p.life <= 0) {
      p.m.removeFromParent();
      if (--p.material.userData.n <= 0) p.material.dispose();
      parts.splice(i, 1);
    }
  }
}

export function makeTextSprite(text, color = '#fff', height = 0.5) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), fs = 64;
  const font = `800 ${fs}px Grandstander, "Trebuchet MS", sans-serif`;
  g.font = font;
  c.width = Math.ceil(g.measureText(text).width) + 28;
  c.height = fs + 28;
  g.font = font;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 9; g.strokeStyle = 'rgba(20,27,43,.85)';
  g.strokeText(text, c.width / 2, c.height / 2);
  g.fillStyle = color;
  g.fillText(text, c.width / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.set((height * c.width) / c.height, height, 1);
  s.renderOrder = 10;
  return s;
}
