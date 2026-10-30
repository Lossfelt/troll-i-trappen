import * as THREE from 'three';
import { makeKid } from './models.js';
import { collideCircle } from './physics.js';
import { stairHeight, START } from './house.js';
import { sfx } from './audio.js';

// Gutten: bevegelse etter sti eller taster, og animasjon.
export const KID_R = 0.3;

export function createKidController(G, input) {
  const K = { m: null, pos: new THREE.Vector3(START.x, 0, START.z), yaw: Math.PI, walk: 0, anim: null, animT: 0, stuck: 0, stepT: 0 };

  K.rebuild = (hair) => {
    const p = K.pos.clone();
    K.m?.group.removeFromParent();
    K.m = makeKid(hair);
    K.m.group.position.copy(p);
    K.pos = K.m.group.position;
    G.scene.add(K.m.group);
  };

  K.turn = (dx, dz, dt) => {
    let d = Math.atan2(dx, dz) - K.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    K.yaw += d * Math.min(1, dt * 12);
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
    K.stepT -= moved;
    if (K.stepT <= 0) { K.stepT = 0.55; sfx.step(); }
    return moved > 0.001;
  };

  // Myk overgang mellom trinnene, så han tråkker opp i stedet for å hoppe
  K.place = (dt) => {
    K.pos.y += (stairHeight(K.pos.x, K.pos.z) - K.pos.y) * Math.min(1, dt * 16);
    K.m.group.rotation.y = K.yaw;
  };

  K.animate = (dt, moving, time) => {
    const m = K.m;
    if (moving) K.walk += dt * (G.mode === 'chase' ? 17 : 12);
    const sw = moving ? Math.sin(K.walk) * 0.7 : 0;
    m.legL.rotation.x = sw; m.legR.rotation.x = -sw;
    m.armL.rotation.set(-sw * 0.8, 0, -0.25);
    m.armR.rotation.set(sw * 0.8, 0, 0.25);
    m.body.position.y = moving ? Math.abs(Math.sin(K.walk)) * 0.025 : Math.sin(time * 2.4) * 0.01;
    m.body.rotation.y = 0;
    if (G.hasBamse) { m.armL.rotation.x = -1 + sw * 0.1; m.armR.rotation.x = -1 - sw * 0.1; }
    if (K.animT <= 0) return;
    K.animT -= dt;
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
  };

  return K;
}
