import * as THREE from 'three';

const parts = [];
const geo = new THREE.OctahedronGeometry(1, 0);

/** Glitter eller røyk som spruter ut fra et punkt. */
export function burst(scene, pos, color, n = 16, opts = {}) {
  const { speed = 2.6, size = 0.08, life = 0.9, up = 2.5 } = opts;
  const material = new THREE.MeshBasicMaterial({ color, transparent: true });
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, material);
    const base = size * (0.6 + Math.random() * 0.8);
    m.scale.setScalar(base);
    m.position.copy(pos);
    m.position.y += 0.6 + Math.random() * 0.6;
    const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
    scene.add(m);
    parts.push({ m, material, base, life, max: life, v: new THREE.Vector3(Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s) });
  }
}

export function updateFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    p.v.y -= 4 * dt;
    p.m.position.addScaledVector(p.v, dt);
    p.m.rotation.x += dt * 5; p.m.rotation.y += dt * 4;
    const k = Math.max(0, p.life / p.max);
    p.material.opacity = k;
    p.m.scale.setScalar(p.base * (0.5 + k * 0.5));
    if (p.life <= 0) { p.m.removeFromParent(); parts.splice(i, 1); }
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
