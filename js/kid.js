import * as THREE from 'three';
import { makeKid } from './models.js';
import { collideCircle } from './physics.js';
import { stairHeight, START } from './house.js';
import { sfx } from './audio.js';
import { puff } from './fx.js';

// Gutten: bevegelse etter sti eller taster, hopp og animasjon.
export const KID_R = 0.3;
const JUMP_V = 3.6, GRAVITY = 13;

export function createKidController(G, input) {
  const K = {
    m: null, pos: new THREE.Vector3(START.x, 0, START.z), yaw: Math.PI, walk: 0, anim: null, animT: 0,
    stuck: 0, stepT: 0, hop: 0, vy: 0, squash: 0, speed: 0,
  };

  K.rebuild = (hair, pj) => {
    const p = K.pos.clone();
    K.m?.group.removeFromParent();
    K.m = makeKid(hair, pj);
    K.m.group.position.copy(p);
    K.pos = K.m.group.position;
    K.hop = K.vy = K.squash = 0;
    G.scene.add(K.m.group);
  };

  K.turn = (dx, dz, dt) => {
    let d = Math.atan2(dx, dz) - K.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    K.yaw += d * Math.min(1, dt * 12);
  };

  /** Et lite hopp, bare for moro skyld. Returnerer om han hoppet. */
  K.jump = () => {
    if (K.hop > 0 || K.vy > 0) return false;
    K.vy = JUMP_V;
    sfx.jump();
    return true;
  };

  /** Flytter gutten ett steg. Returnerer om han faktisk gikk. */
  K.move = (dt) => {
    let dir = input.keyDir() || input.stickDir(), maxStep = Infinity;
    if (dir) G.path = null;
    else if (G.path) {
      while (G.path.length && Math.hypot(G.path[0].x - K.pos.x, G.path[0].z - K.pos.z) < 0.08) G.path.shift();
      if (!G.path.length) G.path = null;
      else {
        const wp = G.path[0], dx = wp.x - K.pos.x, dz = wp.z - K.pos.z, d = Math.hypot(dx, dz);
        dir = { x: dx / d, z: dz / d };
        maxStep = d;
      }
    }
    K.speed = 0;
    if (!dir) return false;
    const speed = G.mode === 'chase' ? 3.6 : 2.4, len = Math.min(speed * dt * (dir.mag ?? 1), maxStep);
    const bx = K.pos.x, bz = K.pos.z;
    K.pos.x += dir.x * len; K.pos.z += dir.z * len;
    collideCircle(K.pos, KID_R, G.house.boxes, 'kid');
    const moved = Math.hypot(K.pos.x - bx, K.pos.z - bz);
    if (moved < len * 0.3) {
      K.stuck += dt;
      if (K.stuck > 0.5) { G.path = null; K.stuck = 0; }
    } else K.stuck = 0;
    K.turn(dir.x, dir.z, dt);
    K.speed = dt > 0 ? moved / dt : 0;
    K.stepT -= moved;
    if (K.stepT <= 0 && K.hop <= 0) {
      K.stepT = 0.55; sfx.step();
      if (G.mode === 'chase') puff(G.scene, K.pos, 3);
    }
    return moved > 0.001;
  };

  // Myk overgang mellom trinnene, så han tråkker opp i stedet for å hoppe
  K.place = (dt) => {
    K.pos.y += (stairHeight(K.pos.x, K.pos.z) - K.pos.y) * Math.min(1, dt * 16);
    K.m.group.rotation.set(0, K.yaw, 0);
  };

  function updateHop(dt) {
    if (K.hop <= 0 && K.vy <= 0) return;
    K.vy -= GRAVITY * dt;
    K.hop += K.vy * dt;
    if (K.hop <= 0) {
      K.hop = 0; K.vy = 0; K.squash = 1;
      sfx.step(); puff(G.scene, K.pos, 6);
    }
  }

  function pose(m, moving, time) {
    const sw = moving ? Math.sin(K.walk) * 0.7 : 0;
    m.legL.rotation.x = sw; m.legR.rotation.x = -sw;
    m.armL.rotation.set(-sw * 0.8, 0, -0.25);
    m.armR.rotation.set(sw * 0.8, 0, 0.25);
    m.body.position.y = moving ? Math.abs(Math.sin(K.walk)) * 0.025 : Math.sin(time * 2.4) * 0.01;
    m.body.rotation.y = 0;
    m.head.rotation.z = moving ? 0 : Math.sin(time * 1.3) * 0.04;
    if (G.hasBamse) { m.armL.rotation.x = -1 + sw * 0.1; m.armR.rotation.x = -1 - sw * 0.1; }
    if (K.hop > 0) {
      m.armL.rotation.z = -2.2; m.armR.rotation.z = 2.2;
      m.legL.rotation.x = 0.5; m.legR.rotation.x = -0.3;
    }
    if (K.animT <= 0) return;
    if (K.anim === 'friend') m.armR.rotation.set(0, 0, 2.7 + Math.sin(time * 14) * 0.35);
    else if (K.anim === 'shoo') {
      m.armR.rotation.set(-1.6, 0, 0.1); m.armL.rotation.set(-1.6, 0, -0.1);
      m.body.position.y = Math.abs(Math.sin(time * 14)) * 0.07;
    } else if (K.anim === 'deal') m.armR.rotation.set(-1.3, 0, 0.1);
    else if (K.anim === 'run') { m.armL.rotation.set(0, 0, -2.6); m.armR.rotation.set(0, 0, 2.6); }
    else if (K.anim === 'dance') {
      m.body.position.y = Math.abs(Math.sin(time * 10)) * 0.15;
      m.body.rotation.y = Math.sin(time * 8) * 0.6;
      m.armL.rotation.set(0, 0, -2.5 - Math.sin(time * 14) * 0.3);
      m.armR.rotation.set(0, 0, 2.5 + Math.sin(time * 14) * 0.3);
    }
  }

  K.animate = (dt, moving, time) => {
    const m = K.m;
    if (moving) K.walk += dt * (G.mode === 'chase' ? 17 : 12);
    updateHop(dt);
    pose(m, moving, time);
    K.animT = Math.max(0, K.animT - dt);
    // Hopp, og klem og strekk når han lander
    K.squash = Math.max(0, K.squash - dt * 5);
    const stretch = K.hop > 0 ? Math.min(0.12, Math.abs(K.vy) * 0.03) : -K.squash * 0.22;
    m.body.scale.set(1 - stretch * 0.6, 1 + stretch, 1 - stretch * 0.6);
    m.body.position.y += K.hop;
    const blink = (time * 0.9) % 3.4 < 0.13;
    for (const e of m.eyes) { e.eye.scale.y = blink ? 0.12 : 1; e.glint.visible = !blink; }
    if (m.cape) m.cape.rotation.x = 0.25 + Math.min(1.1, K.speed * 0.3) + Math.sin(time * 9) * 0.06 * (moving ? 1 : 0.2) + (K.hop > 0 ? 0.5 : 0);
  };

  return K;
}
