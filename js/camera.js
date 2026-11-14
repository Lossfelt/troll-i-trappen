import * as THREE from 'three';
import { START } from './house.js';

// Kameraet følger gutten ovenfra. Under møter zoomer det inn, under jakt litt ut,
// og G.cine = { focus, k } låser det til et punkt (brukt i leggescenen).
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createCamera(G, camera, renderer) {
  const camPos = new THREE.Vector3(-1, 9, 14), camLook = new THREE.Vector3(START.x, 0, START.z);
  const focus = new THREE.Vector3(), want = new THREE.Vector3(), lookAt = new THREE.Vector3();

  function update(dt, time) {
    const K = G.kid, enc = G.enc.active, narrow = camera.aspect < 0.9;
    let k = narrow ? Math.min(1.8, 1 + (0.9 - camera.aspect) * 1.7) : 1;
    let lift = 0;
    focus.copy(K.pos);
    if (G.cine) {
      focus.copy(G.cine.focus);
      k *= G.cine.k;
      want.set(focus.x + Math.sin(time * 0.3) * 0.5, focus.y + 8.4 * k, focus.z + 6.3 * k);
    } else if (G.mode === 'title') {
      want.set(focus.x + Math.sin(time * 0.25) * 3, focus.y + 6.5 * k, focus.z + 6.5 * k);
    } else {
      // Under møter skyves figurene opp, over dialogpanelet
      if (enc) { focus.lerp(enc.pos, 0.5); k *= 0.72; lift = (narrow ? 2.1 : 1.4) * k; }
      if (G.mode === 'chase') k *= 1.1;
      want.set(focus.x, focus.y + 8.4 * k, focus.z + 6.3 * k);
    }
    lookAt.set(focus.x, focus.y + 0.6, focus.z + lift);
    const s = 1 - Math.exp(-(G.cine ? 1.8 : 3.5) * dt);
    camPos.lerp(want, s);
    camLook.lerp(lookAt, s);
    camera.position.copy(camPos);
    if (G.shake > 0) {
      G.shake -= dt;
      if (!reducedMotion) {
        camera.position.x += (Math.random() - 0.5) * G.shake * 0.5;
        camera.position.y += (Math.random() - 0.5) * G.shake * 0.5;
      }
    }
    camera.lookAt(camLook);
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.9 ? 55 : 48;
    camera.updateProjectionMatrix();
  }

  /** Hvor på skjermen et punkt i verden havner, i piksler. */
  const v = new THREE.Vector3();
  function toScreen(p, yOff = 0) {
    v.set(p.x, (p.y || 0) + yOff, p.z).project(camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  }

  return { update, resize, toScreen };
}
