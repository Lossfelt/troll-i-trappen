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

/** Lys som legges oppå det som er bak, for måneskinn, ildfluer og glitter. */
export function shine(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
}

export function createRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}

const NIGHT = 0x0e1424;

/**
 * Kveld i huset: kjølig måneskinn utenfra og varme lamper inne.
 * scene.userData.sky har lysene som dempes når gutten har lagt seg.
 */
export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(NIGHT);
  scene.fog = new THREE.Fog(NIGHT, 26, 52);
  const hemi = new THREE.HemisphereLight(0xd3dcff, 0x3a3052, 0.9);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(0xc4d2ff, 1.05);
  moon.position.set(-6, 16, 9);
  moon.castShadow = true;
  const small = Math.min(screen.width, screen.height) < 700;
  moon.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(moon.shadow.camera, { left: -17, right: 17, top: 16, bottom: -16, near: 1, far: 45 });
  moon.shadow.camera.updateProjectionMatrix();
  moon.shadow.bias = -0.0008;
  scene.add(moon);

  // Et lite, varmt lys som følger gutten, så han alltid er lett å se
  const kidLight = new THREE.PointLight(0xffe0b0, 3.2, 6, 1.5);
  scene.add(kidLight);
  scene.userData.sky = { hemi, moon, kidLight, hemiBase: hemi.intensity, moonBase: moon.intensity };
  return scene;
}

/** dim 0 = vanlig kveld, 1 = natt (lyset er slukket). */
export function setSkyDim(scene, dim) {
  const s = scene.userData.sky;
  s.hemi.intensity = s.hemiBase * (1 - 0.6 * dim);
  s.moon.intensity = s.moonBase * (1 - 0.35 * dim);
}
