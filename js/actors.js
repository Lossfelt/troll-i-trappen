import { TROLLS } from './trolls.js';
import { makeTroll } from './models.js';
import { collideCircle, circleFree, segmentHitsWall } from './physics.js';
import { ROOMS, stairHeight, inZone, TRAPP_ASIDE } from './house.js';
import { burst, makeTextSprite } from './fx.js';
import { sfx } from './audio.js';
import * as ui from './ui.js';
import { KID, TROLL, PAPPA } from './lines.js';
import { say } from './audio.js';

// Trollenes oppførsel: vandre, sove, følge etter, jage og forsvinne.
let uid = 0;

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
    react: null, reactT: 0, noticed: false, done: false, awake: false,
  };
  if (def.sleeps) {
    t.zzz = makeTextSprite('Zzz', '#dfe8ff', 0.45);
    t.zzz.position.set(0.4, t.h, 0);
    m.group.add(t.zzz);
  }
  // Et lurende troll gjemmer seg under gulvet til gutten kommer nær
  if (lurk) { t.state = 'lurk'; m.group.visible = false; t.pos.y = -t.h; }
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

function turnTo(t, dx, dz, dt, rate = 8) {
  let d = Math.atan2(dx, dz) - t.yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  t.yaw += d * Math.min(1, rate * dt);
}

function step(G, t, tx, tz, speed, dt, collide = true) {
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
  if (G.follower === t) G.follower = null;
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

function follow(G, t, dt) {
  const k = G.kid, back = 1.2 + t.r;
  const tx = k.pos.x - Math.sin(k.yaw) * back + Math.cos(k.yaw) * 0.5;
  const tz = k.pos.z - Math.cos(k.yaw) * back - Math.sin(k.yaw) * 0.5;
  const d = Math.hypot(tx - t.pos.x, tz - t.pos.z);
  if (d > 0.3) return step(G, t, tx, tz, Math.max(1.5, d * 2.2), dt, false);
  turnTo(t, k.pos.x - t.pos.x, k.pos.z - t.pos.z, dt, 3);
  return 0;
}

function popUp(G, t) {
  t.state = 'pop'; t.popT = 0.5;
  t.m.group.visible = true;
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
    if (t.state === 'lurk') {
      if (G.mode === 'play' && dist < 3.2 && !segmentHitsWall(G.house.boxes, kid.x, kid.z, t.pos.x, t.pos.z)) popUp(G, t);
      continue;
    }
    if (t.state === 'pop') {
      t.popT -= dt;
      const k = 1 - Math.max(0, t.popT) / 0.5;
      t.pos.y = -t.h * (1 - k) * (1 - k);
      t.m.group.rotation.y = t.yaw;
      if (t.popT <= 0) { t.state = 'approach'; t.approachT = 3; }
      animateTroll(t, 0, time);
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
      moved = follow(G, t, dt);
    }
    t.pos.y += (stairHeight(t.pos.x, t.pos.z) - t.pos.y) * Math.min(1, dt * 14);
    t.m.group.rotation.y = t.yaw;
    animateTroll(t, moved, time);
  }
}

function animateTroll(t, moved, time) {
  const m = t.m, walking = moved > 0.0005;
  const sw = walking ? Math.sin(t.walk) * 0.55 : 0;
  m.legL.rotation.x = sw; m.legR.rotation.x = -sw;
  m.armL.rotation.set(-sw * 0.7, 0, -0.3); m.armR.rotation.set(sw * 0.7, 0, 0.3);
  m.body.position.y = walking ? Math.abs(Math.sin(t.walk)) * 0.035 : Math.sin(time * 2 + t.uid) * 0.02;
  m.body.rotation.set(0, 0, 0);
  m.tail.rotation.z = Math.sin(time * 3 + t.uid) * 0.3;
  const asleep = t.state === 'sleep' && !t.awake;
  const blink = asleep || (time + t.uid * 1.7) % 4 < 0.12 ? 0.12 : 1;
  for (const p of m.pupils) p.scale.y = blink;
  if (t.zzz) {
    t.zzz.visible = asleep;
    t.zzz.position.y = t.h + Math.sin(time * 1.5) * 0.1;
  }
  if (asleep) m.body.rotation.x = 0.12;
  if (t.state === 'chase') { m.armL.rotation.x = -1.3 - sw * 0.3; m.armR.rotation.x = -1.3 + sw * 0.3; }
  if (t.reactT <= 0) return;
  if (t.react === 'win') {
    m.body.position.y = Math.abs(Math.sin(time * 9)) * 0.3;
    m.armL.rotation.z = -2.6; m.armR.rotation.z = 2.6;
  } else if (t.react === 'lose' || t.react === 'stay') {
    m.body.rotation.z = Math.sin(time * 18) * 0.06;
    m.armL.rotation.x = m.armR.rotation.x = -0.6;
  } else if (t.react === 'chase') {
    m.armL.rotation.z = -2.4; m.armR.rotation.z = 2.4;
    m.body.position.y = Math.abs(Math.sin(time * 12)) * 0.08;
  } else if (t.react === 'meh') {
    m.body.rotation.z = Math.sin(time * 2) * 0.1;
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
