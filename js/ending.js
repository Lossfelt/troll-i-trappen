import * as THREE from 'three';
import { stairHeight } from './house.js';
import { sfx } from './audio.js';
import { sparkle, puff, makeTextSprite } from './fx.js';
import { clearBubbles } from './ui.js';

// Leggescenen når natta er vunnet: gutten går bort til senga, hopper oppi og sovner med bamsen,
// lyset dempes, og trollvennene vinker god natt nederst i trappen.
const HOP = 0.75, DIM = 2.2, SHOW_END = 4.5;
const ease = (u) => u * u * (3 - 2 * u);

export function createEnding(G, onAsleep) {
  let s = null, zzz = null;

  function start() {
    const bed = G.house.bed;
    G.mode = 'ending'; G.path = null;
    s = { phase: 'walk', t: 0, shown: false, side: new THREE.Vector3(bed.x, stairHeight(bed.x, 2.55), 2.55) };
    // Kameraet viser hele gangen: senga øverst og trollvennene nederst i trappen.
    // Sluttpanelet legger seg senere over den nederste delen, så senga fortsatt synes.
    G.cine = { focus: new THREE.Vector3(1.9, 0.6, 4.7), k: 0.95 };
    clearBubbles();
    if (G.sign) G.sign.visible = false;
    G.friends.party({ x: bed.x, z: 1 });
    for (const t of G.trolls) if (t.def.id === 'trapp') { t.react = 'win'; t.reactT = 5; }
    sfx.night();
  }

  function reset() {
    const bed = G.house.bed;
    s = null; G.cine = null; G.dim = 0;
    if (G.sign) G.sign.visible = true;
    bed.cover.visible = false; bed.fold.visible = true;
    zzz?.removeFromParent(); zzz = null;
  }

  function walk(dt, time) {
    const K = G.kid, dx = s.side.x - K.pos.x, dz = s.side.z - K.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.06) {
      Object.assign(s, { phase: 'hop', t: 0, from: K.pos.clone(), yaw0: K.yaw });
      sfx.jump();
      return;
    }
    const len = Math.min(d, 2.2 * dt);
    K.pos.x += (dx / d) * len; K.pos.z += (dz / d) * len;
    K.pos.y += (stairHeight(K.pos.x, K.pos.z) - K.pos.y) * Math.min(1, dt * 16);
    K.turn(dx, dz, dt);
    K.m.group.rotation.set(0, K.yaw, 0);
    K.animate(dt, true, time);
  }

  /** Hopper i en bue fra gulvet og lander på ryggen med hodet på puta. */
  function hop(dt, time) {
    const K = G.kid, bed = G.house.bed, u = Math.min(1, s.t / HOP), e = ease(u);
    K.pos.set(
      s.from.x + (bed.x - s.from.x) * e,
      s.from.y + (bed.y + 0.27 - s.from.y) * e + Math.sin(Math.PI * u) * 0.55,
      s.from.z + (bed.feetZ - s.from.z) * e,
    );
    // Snur seg rundt i lufta: fra å se mot senga til å ligge med hodet mot veggen
    const turn = Math.atan2(Math.sin(-s.yaw0), Math.cos(-s.yaw0));
    K.yaw = s.yaw0 + turn * e;
    K.animate(dt, false, time);
    K.m.group.rotation.set((-Math.PI / 2) * e, K.yaw, 0);
    if (u < 1) return;
    s.phase = 'sleep'; s.t = 0;
    bed.cover.visible = true; bed.fold.visible = false;
    sfx.poof();
    puff(G.scene, { x: bed.x, y: bed.y, z: 1.4 }, 8);
    sparkle(G.scene, { x: bed.x, y: bed.y, z: 1.2 }, '⭐', 10, { speed: 1.6, lift: 0.4 });
    zzz = makeTextSprite('Zzz', '#dfe8ff', 0.5);
    G.scene.add(zzz);
  }

  function sleep(time) {
    const m = G.kid.m, bed = G.house.bed;
    G.dim = Math.min(1, s.t / DIM);
    // Armene ned langs siden, og bamsen på puta ved siden av hodet
    m.armL.rotation.set(0, 0, -0.25); m.armR.rotation.set(0, 0, 0.25);
    m.legL.rotation.x = m.legR.rotation.x = 0;
    m.bamse?.position.set(0.3, 0.74, 0.08);
    for (const e of m.eyes) { e.eye.scale.y = 0.12; e.glint.visible = false; }
    // Rolig pust under dyna
    bed.cover.scale.y = 1 + Math.sin(time * 1.8) * 0.04;
    zzz.position.set(bed.x + 0.5 + Math.sin(time * 0.8) * 0.08, bed.y + 1.3 + Math.sin(time * 1.5) * 0.1, 0.8);
    if (!s.shown && s.t > SHOW_END) { s.shown = true; onAsleep(); }
  }

  function update(dt, time) {
    if (!s) return;
    s.t += dt;
    if (s.phase === 'walk') walk(dt, time);
    else if (s.phase === 'hop') hop(dt, time);
    else sleep(time);
  }

  return { start, reset, update, get active() { return !!s; } };
}
