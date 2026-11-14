import { Box3 } from 'three';
import { TROLLS } from './trolls.js';
import { makeTroll } from './models.js';
import { collideCircle, circleFree, segmentHitsWall } from './physics.js';
import { ROOMS, stairHeight, inZone, TRAPP_ASIDE } from './house.js';
import { burst, emote, makeTextSprite } from './fx.js';
import { sfx, say } from './audio.js';
import * as ui from './ui.js';
import { KID, TROLL, PAPPA } from './lines.js';
import { animateTroll } from './trollanim.js';

// Trollenes oppførsel: vandre, sove, lure, jage og forsvinne. Trolltoget står i friends.js.
let uid = 0;
const PEEK = 0.2; // så mye av et lurende troll stikker opp av gulvet

export function spawnTroll(G, id, x, z, room, { lurk = false } = {}) {
  const def = { id, ...TROLLS[id] };
  const m = makeTroll(def.look);
  m.group.position.set(x, 0, z);
  G.scene.add(m.group);
  const size = def.look.size;
  const t = {
    uid: ++uid, def, m, room, pos: m.group.position, yaw: Math.random() * Math.PI * 2,
    state: def.sleeps ? 'sleep' : 'idle', r: 0.42 * size + 0.1, h: 2.2 * size + (def.look.heads === 3 ? 0.3 : 0),
    cooldown: 0, timer: Math.random() * 2, target: null, walk: 0, stuck: 0,
    react: null, reactT: 0, noticed: false, done: false, awake: false, lookX: 0, hopT: 0,
  };
  if (def.sleeps) {
    t.zzz = makeTextSprite('Zzz', '#dfe8ff', 0.45);
    t.zzz.position.set(0.4, t.h, 0);
    m.group.add(t.zzz);
  }
  // Et lurende troll gjemmer seg under gulvet til gutten kommer nær. Bare hårtusten stikker opp.
  if (lurk) {
    t.state = 'lurk';
    m.group.updateMatrixWorld(true);
    t.lurkY = PEEK - new Box3().setFromObject(m.group).max.y;
    t.pos.y = t.lurkY;
  }
  G.trolls.push(t);
  return t;
}

export function randomSpot(G, roomId, r, avoid = [], minDist = 1.8, who = 'both') {
  const room = ROOMS.find((q) => q.id === roomId);
  const pad = r + 0.4;
  for (let i = 0; i < 300; i++) {
    const x = room.minX + pad + Math.random() * (room.maxX - room.minX - 2 * pad);
    const z = room.minZ + pad + Math.random() * (room.maxZ - room.minZ - 2 * pad);
    if (roomId === 'gang' && x > 1.8) continue;
    if (!circleFree(G.house.boxes, x, z, r, 'kid')) continue;
    if (who !== 'kid' && !circleFree(G.house.boxes, x, z, r, 'troll')) continue;
    if (avoid.some((p) => Math.hypot(p.x - x, p.z - z) < minDist)) continue;
    return { x, z };
  }
  return { x: (room.minX + room.maxX) / 2, z: (room.minZ + room.maxZ) / 2 };
}

export function turnTo(t, dx, dz, dt, rate = 8) {
  let d = Math.atan2(dx, dz) - t.yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  t.yaw += d * Math.min(1, rate * dt);
}

export function step(G, t, tx, tz, speed, dt, collide = true) {
  const dx = tx - t.pos.x, dz = tz - t.pos.z, d = Math.hypot(dx, dz);
  if (d < 0.05) return 0;
  const bx = t.pos.x, bz = t.pos.z, s = Math.min(d, speed * dt);
  t.pos.x += (dx / d) * s; t.pos.z += (dz / d) * s;
  if (collide) collideCircle(t.pos, t.r, G.house.boxes, 'troll');
  turnTo(t, dx, dz, dt);
  const moved = Math.hypot(t.pos.x - bx, t.pos.z - bz);
  t.walk += (moved * 4) / t.def.look.size;
  return moved;
}

export function poof(G, t) {
  if (t.state === 'gone') return;
  burst(G.scene, t.pos, 0xf3ecff, 22, { speed: 2, size: 0.12 });
  sfx.poof();
  t.m.group.removeFromParent();
  t.state = 'gone';
  G.friends.remove(t);
}

export function startLeave(t, seconds) {
  t.state = 'leave'; t.leaveT = seconds; t.done = true;
}

function wander(G, t, dt) {
  t.timer -= dt;
  if (!t.target || t.timer <= 0 || t.stuck > 0.8) {
    t.target = randomSpot(G, t.room, t.r, [], 0, 'troll');
    t.timer = 3 + Math.random() * 4; t.stuck = 0;
  }
  if (Math.hypot(t.target.x - t.pos.x, t.target.z - t.pos.z) < 0.3) return 0;
  const moved = step(G, t, t.target.x, t.target.z, 0.7, dt);
  t.stuck = moved < 0.2 * dt ? t.stuck + dt : 0;
  return moved;
}

function popUp(G, t) {
  t.state = 'pop'; t.popT = 0.5;
  t.yaw = Math.atan2(G.kid.pos.x - t.pos.x, G.kid.pos.z - t.pos.z);
  burst(G.scene, { x: t.pos.x, y: -0.5, z: t.pos.z }, 0x9a8a70, 18, { speed: 2.2, size: 0.1 });
  sfx.boo();
  G.shake = 0.35;
  ui.bubble(`t${t.uid}`, t.m.group, t.h + 0.25, TROLL.boo, 1500, 'troll loud');
  say(TROLL.boo, t.def.id);
  G.kidAnim('run');
  G.path = null;
  setTimeout(() => G.kidSay(KID.boo), 700);
}

export function updateTrolls(G, dt, time) {
  const kid = G.kid.pos;
  for (const t of G.trolls) {
    if (t.state === 'gone') continue;
    t.cooldown -= dt; t.reactT -= dt;
    const dx = kid.x - t.pos.x, dz = kid.z - t.pos.z, dist = Math.hypot(dx, dz);
    let moved = 0;
    // Øynene følger gutten når han er foran trollet
    const diff = Math.atan2(dx, dz) - t.yaw;
    const look = dist < 8 && Math.cos(diff) > -0.3 ? Math.max(-1, Math.min(1, Math.sin(diff) * 1.6)) : 0;
    if (t.state === 'lurk') {
      // Hårtusten vipper og snur seg av og til, så den som ser nøye etter kan oppdage trollet
      const wig = Math.max(0, Math.sin(time * 1.7 + t.uid * 2));
      t.pos.y = t.lurkY + wig * 0.1;
      t.m.group.rotation.y = t.yaw + Math.sin(time * 6 + t.uid) * 0.3 * wig;
      if (G.mode === 'play' && dist < 3.2 && !segmentHitsWall(G.house.boxes, kid.x, kid.z, t.pos.x, t.pos.z)) popUp(G, t);
      continue;
    }
    if (t.state === 'pop') {
      t.popT -= dt;
      const k = 1 - Math.max(0, t.popT) / 0.5;
      t.pos.y = t.lurkY * (1 - k) * (1 - k);
      t.m.group.rotation.y = t.yaw;
      if (t.popT <= 0) { t.state = 'approach'; t.approachT = 3; }
      animateTroll(t, 0, time, dt, look);
      continue;
    }
    if (t.state === 'approach') {
      t.approachT -= dt;
      moved = step(G, t, kid.x, kid.z, 1.5, dt);
      if (t.approachT <= 0) t.state = 'idle';
    } else if (t.state === 'idle') {
      if (dist < 4.5 && G.mode === 'play' && !t.done) {
        turnTo(t, dx, dz, dt, 4);
        if (!t.noticed) { t.noticed = true; G.trollSay(t, 'Hm?', 1400); sfx.hmm(); }
      } else {
        if (dist > 6) t.noticed = false;
        moved = wander(G, t, dt);
      }
    } else if (t.state === 'guard' || t.state === 'talk' || t.state === 'aside') {
      if (t.state === 'aside') moved = step(G, t, TRAPP_ASIDE.x, TRAPP_ASIDE.z, 1.2, dt, false);
      if (!moved && dist < 6) turnTo(t, dx, dz, dt, 5);
    } else if (t.state === 'leave') {
      t.leaveT -= dt;
      moved = step(G, t, t.pos.x - dx, t.pos.z - dz, 1.6, dt);
      if (t.leaveT <= 0) { poof(G, t); continue; }
    } else if (t.state === 'follow') {
      moved = G.friends.follow(t, dt);
    } else if (t.state === 'party') {
      // Leggetid: gå til plassen sin nederst i trappen og vink god natt
      const s = t.spot;
      if (Math.hypot(s.x - t.pos.x, s.z - t.pos.z) > 0.25) moved = step(G, t, s.x, s.z, 2.6, dt, false);
      else { turnTo(t, s.faceX - t.pos.x, s.faceZ - t.pos.z, dt, 5); t.react = 'win'; t.reactT = 0.2; }
    }
    t.pos.y += (stairHeight(t.pos.x, t.pos.z) - t.pos.y) * Math.min(1, dt * 14);
    t.m.group.rotation.y = t.yaw;
    animateTroll(t, moved, time, dt, look);
  }
}

// --- Jakt ---

/** Gutten løper av seg selv i den retningen som kommer lengst unna trollet. */
function escapePath(G, t) {
  const k = G.kid.pos, ax = k.x - t.pos.x, az = k.z - t.pos.z, ad = Math.hypot(ax, az) || 1;
  let best = null, bestScore = -Infinity;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const p = G.nav.path(k, { x: k.x + Math.sin(a) * 7, z: k.z + Math.cos(a) * 7 });
    if (!p?.length) continue;
    const first = p[0], fd = Math.hypot(first.x - k.x, first.z - k.z) || 1;
    const towardTroll = ((first.x - k.x) * ax + (first.z - k.z) * az) / (fd * ad) < -0.2;
    const end = p[p.length - 1];
    const score = Math.hypot(end.x - t.pos.x, end.z - t.pos.z) - (towardTroll ? 6 : 0);
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}

export function startChase(G, t) {
  G.mode = 'chase';
  t.state = 'chase';
  G.chase = { troll: t, t: 4.5, max: 4.5, delay: 1.0, beat: 0 };
  ui.show('chaseBar');
  G.path = escapePath(G, t);
  emote(G.scene, t.pos, t.h + 0.5, '💢');
  G.kidSay(KID.chase);
}

export function updateChase(G, dt) {
  const c = G.chase, t = c.troll, kid = G.kid.pos;
  c.beat -= dt;
  if (c.beat <= 0) { sfx.heartbeat(); c.beat = 0.55; }
  ui.chaseBar(c.t / c.max);
  // Står gutten stille, flykter han videre av seg selv
  c.repath = (c.repath ?? 0) - dt;
  if (!G.path && c.repath <= 0) { G.path = escapePath(G, t); c.repath = 0.4; }
  if (c.delay > 0) { c.delay -= dt; t.react = 'chase'; t.reactT = 0.1; return; }
  c.t -= dt;
  step(G, t, kid.x, kid.z, t.def.chase.speed, dt);
  const d = Math.hypot(kid.x - t.pos.x, kid.z - t.pos.z);
  const zone = G.house.hideZones.find((z) => inZone(kid, z));
  if (d < G.KID_R + t.r * 0.85) endChase(G, 'caught');
  else if (zone) endChase(G, 'hid', zone);
  else if (c.t <= 0 || d > 6) endChase(G, 'escaped');
}

function endChase(G, how, zone) {
  const t = G.chase.troll;
  G.chase = null;
  G.mode = 'play';
  ui.show('chaseBar', false);
  t.done = true;
  if (how === 'caught') {
    G.trollSay(t, t.def.chase.caught, 2800, true);
    startLeave(t, 1.4);
    G.hurt();
    return;
  }
  const text = how === 'hid' ? PAPPA.hide(zone.name) : t.def.chase.escape;
  G.trollSay(t, text, 3000);
  say(text, 'pappa');
  if (how === 'hid' || t.def.chase.star) G.addStar();
  startLeave(t, 1.8);
}
