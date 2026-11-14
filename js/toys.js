import * as THREE from 'three';
import { mat, matUnique, glow } from './world.js';
import { circleFree } from './physics.js';
import { stairHeight } from './house.js';
import { sfx } from './audio.js';
import { burst, sparkle, emote } from './fx.js';

// Ting i huset det går an å leke med: baller, pianomatte, klossetårn, gyngehest, badeand, do og TV.
// Ingen av dem trengs for å vinne. De er der fordi det er gøy å oppdage dem.

const NOTES = [261.6, 293.7, 329.6, 349.2, 392, 440, 493.9, 523.3];
const RAINBOW = [0xe5484d, 0xf08c3a, 0xf2c94c, 0x5cb85c, 0x3fb8af, 0x4a90d9, 0x8b63c9, 0xe573b5];
const part = (geo, color, x, y, z) => { const m = new THREE.Mesh(geo, mat(color)); m.position.set(x, y, z); m.castShadow = true; return m; };
const cube = (w, h, d, color, x, y, z) => part(new THREE.BoxGeometry(w, h, d), color, x, y, z);
/** Avstand fra et punkt til en boks på gulvet (0 inni boksen). */
const boxDist = (p, b) => Math.hypot(p.x - Math.max(b[0], Math.min(b[1], p.x)), p.z - Math.max(b[2], Math.min(b[3], p.z)));

function stripes() {
  const c = document.createElement('canvas'); c.width = 96; c.height = 8;
  const g = c.getContext('2d');
  ['#e5484d', '#ffffff', '#f2c94c', '#ffffff', '#4a90d9', '#ffffff'].forEach((col, i) => { g.fillStyle = col; g.fillRect(i * 16, 0, 16, 8); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createToys(G) {
  const scene = G.scene, toys = [], boxes = G.house.boxes;
  const walkers = () => [G.kid, ...G.friends.list];

  /** Badeball som kan sparkes rundt. Trollvennene sparker den også. */
  function beachBall(hx, hz) {
    const R = 0.3, m = new THREE.Mesh(new THREE.SphereGeometry(R, 20, 14), matUnique(0xffffff, { map: stripes() }));
    m.castShadow = true;
    scene.add(m);
    const s = { x: hx, z: hz, vx: 0, vz: 0, y: 0, vy: 0, cool: 0 };
    toys.push({
      at: () => s,
      reset() { Object.assign(s, { x: hx, z: hz, vx: 0, vz: 0, y: 0, vy: 0 }); },
      update(dt) {
        s.cool -= dt;
        for (const w of walkers()) {
          const dx = s.x - w.pos.x, dz = s.z - w.pos.z, d = Math.hypot(dx, dz) || 0.01;
          if (s.cool > 0 || d > R + (w.r ?? G.KID_R) + 0.05) continue;
          const speed = 3 + (w.speed ?? 1.5) * 0.9;
          s.vx = (dx / d) * speed; s.vz = (dz / d) * speed; s.vy = 2.6; s.cool = 0.3;
          sfx.boing();
          return true;
        }
        const nx = s.x + s.vx * dt, nz = s.z + s.vz * dt;
        if (circleFree(boxes, nx, s.z, R, 'kid')) s.x = nx; else s.vx *= -0.7;
        if (circleFree(boxes, s.x, nz, R, 'kid')) s.z = nz; else s.vz *= -0.7;
        const drag = Math.exp(-1.2 * dt);
        s.vx *= drag; s.vz *= drag;
        s.vy -= 12 * dt; s.y += s.vy * dt;
        if (s.y < 0) { s.y = 0; s.vy = s.vy < -1.5 ? -s.vy * 0.5 : 0; }
        m.rotation.z -= (s.vx * dt) / R; m.rotation.x += (s.vz * dt) / R;
        m.position.set(s.x, stairHeight(s.x, s.z) + R + s.y, s.z);
        return false;
      },
    });
  }

  /** Pianomatte: hver tangent spiller en tone når noen tråkker på den. */
  function piano(x0, z0) {
    const W = 0.34, D = 0.9, on = new Map();
    const keys = NOTES.map((_, i) => {
      const material = matUnique(RAINBOW[i]);
      const m = new THREE.Mesh(new THREE.BoxGeometry(W - 0.03, 0.05, D), material);
      m.position.set(x0 + (i + 0.5) * W, 0.03, z0); m.receiveShadow = true;
      scene.add(m);
      return { m, material, base: new THREE.Color(RAINBOW[i]), t: 0 };
    });
    const center = { x: x0 + W * 4, z: z0 };
    toys.push({
      at: () => center,
      reset() { on.clear(); },
      update(dt) {
        let played = false;
        for (const w of walkers()) {
          const i = Math.floor((w.pos.x - x0) / W), inside = Math.abs(w.pos.z - z0) < D / 2 && i >= 0 && i < keys.length && !(w.hop > 0.05);
          const key = inside ? i : -1;
          if (key === (on.get(w) ?? -1)) continue;
          on.set(w, key);
          if (key < 0) continue;
          keys[key].t = 0.35;
          sfx.note(NOTES[key]);
          if (w === G.kid) { sparkle(scene, keys[key].m.position, '🎵', 1, { speed: 0.5, up: 2.2, lift: 0.5, size: 0.3 }); played = true; }
        }
        for (const k of keys) {
          k.t = Math.max(0, k.t - dt);
          k.m.position.y = 0.03 - (k.t > 0 ? 0.015 : 0);
          k.material.color.copy(k.base).lerp(WHITE, k.t * 2);
        }
        return played;
      },
    });
  }

  /** Klossetårn som kan veltes. Det bygger seg opp igjen etter en stund. */
  function tower(x, z) {
    const S = 0.26, colors = [0xe04b3a, 0xf2c14e, 0x4caf6a, 0x3d7cc9, 0x8e5aa8];
    const blocks = colors.map((c, i) => {
      const m = cube(S, S, S, c, x, S / 2 + i * S, z);
      scene.add(m);
      return { m, home: m.position.clone(), v: new THREE.Vector3(), spin: 0 };
    });
    let down = 0;
    const center = { x, z };
    const rebuild = () => { for (const b of blocks) { b.m.position.copy(b.home); b.m.rotation.set(0, 0, 0); b.v.set(0, 0, 0); } down = 0; };
    toys.push({
      at: () => center,
      reset: rebuild,
      update(dt) {
        const k = G.kid.pos;
        if (!down) {
          if (Math.hypot(k.x - x, k.z - z) > 0.55) return false;
          down = 6;
          sfx.clatter();
          blocks.forEach((b, i) => {
            const a = Math.atan2(x - k.x, z - k.z) + (Math.random() - 0.5) * 1.6, sp = 1.2 + Math.random() * 1.8 + i * 0.3;
            b.v.set(Math.sin(a) * sp, 2 + Math.random() * 2, Math.cos(a) * sp);
            b.spin = (Math.random() - 0.5) * 12;
          });
          return true;
        }
        down -= dt;
        if (down <= 0) { rebuild(); sfx.pickup(); burst(scene, center, 0xffe08a, 10, { speed: 1.2 }); return false; }
        for (const b of blocks) {
          const p = b.m.position;
          b.v.y -= 11 * dt;
          const nx = p.x + b.v.x * dt, nz = p.z + b.v.z * dt;
          if (circleFree(boxes, nx, p.z, S / 2, 'kid')) p.x = nx; else b.v.x *= -0.5;
          if (circleFree(boxes, p.x, nz, S / 2, 'kid')) p.z = nz; else b.v.z *= -0.5;
          p.y += b.v.y * dt;
          if (p.y < S / 2) { p.y = S / 2; b.v.y = b.v.y < -1.2 ? -b.v.y * 0.4 : 0; b.v.x *= 0.6; b.v.z *= 0.6; b.spin *= 0.5; }
          b.m.rotation.x += b.spin * dt; b.m.rotation.z += b.spin * 0.7 * dt;
        }
        return false;
      },
    });
  }

  /** Noe som reagerer når gutten kommer helt inntil: `area` er [minX, maxX, minZ, maxZ]. */
  function touchToy(area, center, onTouch, animate) {
    let inside = false;
    toys.push({
      at: () => center,
      reset() { inside = false; },
      update(dt, time) {
        const near = boxDist(G.kid.pos, area) < G.KID_R + 0.14, hit = near && !inside;
        inside = near;
        if (hit) onTouch();
        animate?.(dt, time);
        return hit;
      },
    });
  }

  function rockingHorse(x, z) {
    const g = new THREE.Group(), W = 0xa0663a;
    g.add(cube(0.8, 0.3, 0.28, W, 0, 0.6, 0), cube(0.25, 0.35, 0.22, W, 0.45, 0.87, 0), cube(0.1, 0.3, 0.06, 0x3b2a1e, 0.25, 0.9, 0));
    g.add(cube(0.2, 0.14, 0.2, W, 0.6, 0.85, 0), cube(0.06, 0.3, 0.06, 0x3b2a1e, -0.42, 0.55, 0));
    for (const [dx, dz] of [[-0.3, -0.1], [0.3, -0.1], [-0.3, 0.1], [0.3, 0.1]]) g.add(cube(0.06, 0.4, 0.06, 0x8a5530, dx, 0.25, dz));
    for (const dz of [-0.12, 0.12]) g.add(cube(1.0, 0.05, 0.05, 0x6e4b33, 0, 0.03, dz));
    g.position.set(x, 0, z);
    scene.add(g);
    let amp = 0;
    touchToy([x - 0.5, x + 0.6, z - 0.2, z + 0.2], { x, z }, () => { amp = 0.3; sfx.neigh(); }, (dt, time) => {
      amp = Math.max(0, amp - dt * 0.09);
      g.rotation.z = Math.sin(time * 7) * amp;
    });
  }

  function duck(x, z) {
    const g = new THREE.Group(), Y = 0xf7d23e;
    g.add(part(new THREE.SphereGeometry(0.11, 12, 10), Y, 0, 0.08, 0), part(new THREE.SphereGeometry(0.075, 12, 10), Y, 0, 0.2, -0.06));
    g.add(part(new THREE.SphereGeometry(0.03, 8, 6), 0xe8742a, 0, 0.19, -0.14), part(new THREE.SphereGeometry(0.014, 6, 5), 0x1b1b1b, 0.04, 0.23, -0.11), part(new THREE.SphereGeometry(0.014, 6, 5), 0x1b1b1b, -0.04, 0.23, -0.11));
    g.position.set(x, 0.62, z);
    scene.add(g);
    let y = 0, vy = 0;
    // Badekaret: se addBath i furniture.js
    touchToy([10.3, 11.9, 5.6, 8.8], { x: 10.3, z }, () => {
      vy = 3; sfx.quack(); sfx.splash();
      burst(scene, { x, y: 0.2, z }, 0x8fd0e6, 12, { speed: 1.4, up: 2.2, size: 0.06 });
    }, (dt, time) => {
      vy -= 10 * dt; y = Math.max(0, y + vy * dt);
      g.position.y = 0.62 + y + Math.sin(time * 2) * 0.012;
      g.rotation.y += dt * (y > 0 ? 9 : 0.3);
    });
  }

  function toilet() {
    const center = { x: 5.3, z: 8.4 };
    touchToy([5.08, 5.52, 8.13, 8.89], center, () => {
      sfx.flush();
      sparkle(scene, { x: 5.3, y: 0, z: 8.4 }, '💦', 6, { speed: 1, lift: 0.5, size: 0.26 });
    });
  }

  function tv() {
    const material = glow(0x2c3e66), screen = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.78), material);
    screen.position.set(11.57, 0.95, -4.5); screen.rotation.y = -Math.PI / 2;
    scene.add(screen);
    let on = false;
    touchToy([11.35, 11.85, -5.5, -3.5], { x: 11.3, z: -4.5 }, () => { on = !on; sfx.tv(); }, (dt, time) => {
      if (on) material.color.setHSL((time * 0.35) % 1, 0.75, 0.6 + Math.sin(time * 13) * 0.06);
      else material.color.setHex(0x2c3e66);
    });
    toys[toys.length - 1].reset = () => { on = false; };
  }

  beachBall(-6.0, 4.9);
  beachBall(4.2, -3.0);
  piano(-9.36, 3.4);
  tower(-6.5, 7.0);
  rockingHorse(-10.8, 2.0);
  duck(11.0, 6.5);
  toilet();
  tv();

  let hintT = 3;
  return {
    reset() { for (const t of toys) { t.reset(); t.used = false; } },
    update(dt, time, playing) {
      for (const t of toys) if (t.update(dt, time) && playing) t.used = true;
      // Et lite glimt over leker som ikke er prøvd ennå, så de er lette å oppdage
      hintT -= dt;
      if (hintT > 0 || !playing) return;
      hintT = 3.5;
      const k = G.kid.pos, fresh = toys.filter((t) => !t.used && Math.hypot(t.at().x - k.x, t.at().z - k.z) < 6.5);
      if (fresh.length) { const p = fresh[Math.floor(Math.random() * fresh.length)].at(); emote(scene, { x: p.x, y: 0, z: p.z }, 1.1, '✨', 0.45); }
    },
  };
}

const WHITE = new THREE.Color(0xffffff);
