import * as THREE from 'three';
import { makeTroll } from './models.js';

/** Tegner et portrett av hver trolltype én gang, til dialogen og trollboka. */
export function makePortraits(types) {
  const out = {};
  let r;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 192;
    r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return out;
  }
  r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x504060, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(2, 3, 5);
  scene.add(key);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const box = new THREE.Box3(), size = new THREE.Vector3();
  for (const [id, def] of Object.entries(types)) {
    const t = makeTroll(def.look);
    t.group.rotation.y = -0.35;
    scene.add(t.group);
    t.group.updateMatrixWorld(true);
    box.setFromObject(t.group);
    box.getSize(size);
    const cy = box.min.y + size.y * 0.66, fit = Math.max(size.y * 0.72, size.x * 1.1);
    cam.position.set(0, cy + size.y * 0.06, fit / 2 / Math.tan(THREE.MathUtils.degToRad(15)) + size.z / 2);
    cam.lookAt(0, cy, 0);
    r.render(scene, cam);
    out[id] = r.domElement.toDataURL('image/png');
    scene.remove(t.group);
  }
  r.dispose();
  r.forceContextLoss();
  return out;
}
