import { step, turnTo } from './actors.js';
import { startHop } from './trollanim.js';
import { sfx } from './audio.js';
import { sparkle } from './fx.js';

// Trolltoget: alle trollvennene går på rekke og rad etter gutten, i sporene hans.
const CRUMB = 0.15; // avstand mellom punktene i sporet
const TRAIL_MAX = 500;

export function createFriends(G) {
  const list = [], trail = [];

  function reset() { list.length = 0; trail.length = 0; }

  function add(t) {
    t.state = 'follow'; t.helped = false;
    if (!list.includes(t)) list.push(t);
  }

  function remove(t) {
    const i = list.indexOf(t);
    if (i >= 0) list.splice(i, 1);
  }

  /** Husker hvor gutten har gått. Kalles hver bilderute. */
  function record() {
    const k = G.kid.pos, last = trail[trail.length - 1];
    if (last && Math.hypot(k.x - last.x, k.z - last.z) < CRUMB) return;
    trail.push({ x: k.x, z: k.z });
    if (trail.length > TRAIL_MAX) trail.shift();
  }

  /** Flytter én venn mot plassen sin i toget. Returnerer hvor langt den gikk. */
  function follow(t, dt) {
    const k = G.kid, i = list.indexOf(t);
    let back = 0.25;
    for (let j = 0; j <= i; j++) back += 0.35 + list[j].r * 1.5;
    const idx = trail.length - 1 - Math.round(back / CRUMB);
    const spot = idx >= 0 ? trail[idx] : { x: k.pos.x - Math.sin(k.yaw) * back, z: k.pos.z - Math.cos(k.yaw) * back };
    const d = Math.hypot(spot.x - t.pos.x, spot.z - t.pos.z);
    if (d > 0.2) return step(G, t, spot.x, spot.z, Math.min(5.5, Math.max(1.2, d * 3)), dt, false);
    turnTo(t, k.pos.x - t.pos.x, k.pos.z - t.pos.z, dt, 3);
    return 0;
  }

  /** Første venn som ikke har hjulpet til ennå (og som ikke er trollet vi snakker med). */
  const helper = (not) => list.find((f) => !f.helped && f !== not) || null;

  /** Bølgen: vennene hopper etter tur når gutten hopper. */
  function hopAll() { list.forEach((f, i) => startHop(f, 0.15 + i * 0.13)); }

  function tickle(t) {
    startHop(t);
    t.react = 'win'; t.reactT = 0.9;
    sfx.giggle(t.def.look.size);
    sparkle(G.scene, t.pos, '💚', 4, { lift: t.h * 0.7, speed: 1.2, size: 0.28 });
  }

  /** Vennene samler seg nederst i trappen og vinker god natt. */
  function party(face) {
    list.forEach((f, i) => {
      f.state = 'party';
      f.spot = { x: 1.4 - (i % 3) * 1.25, z: 7.5 - Math.floor(i / 3) * 1.2 + (i % 2) * 0.3, faceX: face.x, faceZ: face.z };
    });
  }

  return { list, reset, add, remove, record, follow, helper, hopAll, tickle, party };
}
