import * as THREE from 'three';

let gradient = null;
const cache = new Map();

// Tre-trinns toon-skygge gir et tegnebok-preg.
function toonGradient() {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([70, 150, 215, 255]), 4, 1, THREE.RedFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

/** Delt toon-materiale per farge. */
export function mat(color) {
  if (!cache.has(color)) cache.set(color, matUnique(color));
  return cache.get(color);
}

/** Eget materiale, for ting som skal kunne tones ut. */
export function matUnique(color, params = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...params });
}

export function glow(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
}

export function createRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x141b2b);
  scene.add(new THREE.HemisphereLight(0xfff0dc, 0x3d3550, 1.5));

  const sun = new THREE.DirectionalLight(0xffe8c8, 1.6);
  sun.position.set(-6, 16, 9);
  sun.castShadow = true;
  const small = Math.min(screen.width, screen.height) < 700;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 16, bottom: -16, near: 1, far: 45 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  return scene;
}
