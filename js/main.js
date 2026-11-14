import * as THREE from 'three';
import { createRenderer, createScene, setSkyDim } from './world.js';
import { buildHouse, updateHouse, roomAt, onStairs, STAIRS } from './house.js';
import { addGarden } from './garden.js';
import { updateDecor } from './decor.js';
import { TROLLS } from './trolls.js';
import { PJS } from './models.js';
import { NavGrid, segmentHitsWall } from './physics.js';
import { createInput } from './input.js';
import { loadClips, say, sfx } from './audio.js';
import { setMusic } from './music.js';
import { store } from './store.js';
import * as ui from './ui.js';
import { makePortraits } from './portraits.js';
import { updateFx, makeTextSprite } from './fx.js';
import { updateTrolls, updateChase, poof, startChase } from './actors.js';
import { createFriends } from './friends.js';
import { createEncounters } from './encounter.js';
import { createKidController, KID_R } from './kid.js';
import { createRounds } from './round.js';
import { createToys } from './toys.js';
import { createEnding } from './ending.js';
import { createCamera } from './camera.js';
import { setupMenu } from './menu.js';
import { KID, QUIPS, PAPPA } from './lines.js';

const $ = ui.$;
const TALKING = ['idle', 'sleep', 'guard', 'approach'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const canvas = $('c');
const renderer = createRenderer(canvas);
const scene = createScene();
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);
const house = buildHouse(scene);
const garden = addGarden(scene);
const nav = new NavGrid({ minX: -12, maxX: 12, minZ: -9, maxZ: 9 }, 0.3);
const input = createInput(canvas);

const G = {
  scene, camera, house, nav, KID_R, mode: 'title', prevMode: 'play', night: 1, lastWin: false,
  trolls: [], items: [], hearts: 3, stars: 0, inv: [], hasBamse: false, friendsRound: 0,
  chase: null, path: null, room: null, shake: 0, portraits: {}, name: 'Helten', stairWarn: 0, hintT: 0,
  dim: 0, cine: null,
};
const K = createKidController(G, input);
G.kid = K;
G.friends = createFriends(G);
const enc = createEncounters(G);
G.enc = enc;
const rounds = createRounds(G);
const toys = createToys(G);
const ending = createEnding(G, () => endGame('win'));
const cam = createCamera(G, camera, renderer);

G.rebuildNav = () => nav.build(house.boxes, KID_R + 0.02, 'kid');
G.kidSay = (text) => { ui.bubble('kid', K.m.group, 1.55, text, 2800, 'kid'); return say(text, 'kid'); };
G.trollSay = (t, text, ms = 2600, speak = false) => {
  ui.bubble(`t${t.uid}`, t.m.group, t.h + 0.25, text, ms, 'troll');
  if (speak) say(text, t.def.id);
};
G.kidAnim = (kind) => { K.anim = kind; K.animT = kind === 'dance' ? 1.8 : 1.5; };
G.addStar = () => {
  G.stars++;
  store.set({ stars: store.get().stars + 1 });
  sfx.win();
  const p = cam.toScreen(K.pos, 1.2);
  ui.flyStar(p.x, p.y);
  setTimeout(() => ui.updateHud(G), 650);
};
G.hurt = () => {
  G.hearts--;
  sfx.hurt(); ui.flash(); G.shake = 0.45;
  ui.updateHud(G);
  if (G.hearts <= 0) endGame('pappa');
};
G.pushKidAway = (t) => {
  const dx = K.pos.x - t.pos.x, dz = K.pos.z - t.pos.z, d = Math.hypot(dx, dz) || 1;
  const back = 1.4 + (t.def.id === 'trapp' ? 1 : 0);
  G.path = nav.path(K.pos, { x: K.pos.x + (dx / d) * back, z: K.pos.z + (dz / d) * back });
};

function checkWorld(dt) {
  rounds.collectItems();
  const room = roomAt(K.pos.x, K.pos.z);
  if (room && room !== G.room) {
    const first = !G.room;
    G.room = room;
    if (!first) {
      ui.toast(room.name);
      if (Math.random() < 0.3) G.kidSay(pick(QUIPS));
    }
  }

  G.stairWarn -= dt;
  if (onStairs(K.pos) && K.pos.z < STAIRS.topZ + 0.6) {
    if (G.hasBamse) { ending.start(); return; }
    if (G.stairWarn <= 0) {
      G.stairWarn = 3;
      G.kidSay(KID.stairs);
      G.path = nav.path(K.pos, { x: 1.2, z: 7.4 });
    }
  }

  for (const t of G.trolls) {
    if (t.done || t.cooldown > 0 || !TALKING.includes(t.state)) continue;
    const reach = 1.25 + t.r + (t.def.id === 'trapp' ? 0.9 : 0);
    if (Math.hypot(t.pos.x - K.pos.x, t.pos.z - K.pos.z) > reach) continue;
    if (segmentHitsWall(house.boxes, K.pos.x, K.pos.z, t.pos.x, t.pos.z)) continue;
    enc.start(t);
    break;
  }
}

/** Pysjer som ble låst opp av stjernene fra denne natta. */
function newPyjamas() {
  const total = store.get().stars;
  return Object.values(PJS).filter((p) => p.need > 0 && p.need > total - G.stars && p.need <= total).map((p) => p.name);
}

/** 'win' kommer fra leggescenen når gutten har sovnet; 'pappa' når hjertene er brukt opp. */
function endGame(kind) {
  if (G.mode === 'over') return;
  G.mode = 'over'; G.path = null; G.chase = null;
  ui.closeDialog();
  ui.show('chaseBar', false);
  const win = kind === 'win';
  G.lastWin = win;
  const friends = G.friendsRound, unlocked = newPyjamas();
  $('endEmoji').textContent = win ? '🌙' : '🤗';
  $('endTitle').textContent = win ? `God natt, ${G.name}!` : 'PAPPAAA!';
  $('endText').textContent = win
    ? 'Du fant bamsen og kom deg helt opp trappen til senga. Trollene får vente til i morgen.'
    : `${G.name} ropte på pappa. Pappa kom med en kjempeklem, og vips, så var alle trollene borte.`;
  $('endStats').textContent = `Natt ${G.night} · ⭐ ${G.stars} ${G.stars === 1 ? 'stjerne' : 'stjerner'} · 🤝 ${friends} ${friends === 1 ? 'ny trollvenn' : 'nye trollvenner'}`;
  $('endUnlock').hidden = !unlocked.length;
  $('endUnlock').textContent = unlocked.length ? `🎁 Ny pysj på startskjermen: ${unlocked.join(' og ')}!` : '';
  $('btnAgain').textContent = win ? `Natt ${G.night + 1} 🌙` : 'Prøv igjen';
  $('screenEnd').classList.toggle('win', win);
  if (!win) setTimeout(() => G.trolls.forEach((t) => poof(G, t)), 600);
  setTimeout(() => {
    ui.show('hud', false);
    ui.show('screenEnd');
    if (win) say(PAPPA.win, 'pappa');
    else say(KID.callPappa, 'kid').then(() => say(PAPPA.lose, 'pappa'));
  }, win ? 200 : 1100);
}

function hint() {
  if (G.mode !== 'play') return;
  const b = G.items.find((i) => i.id === 'bamse' && !i.taken);
  const text = G.hasBamse || !b ? PAPPA.done : PAPPA.where(roomAt(b.pos.x, b.pos.z)?.id);
  ui.toast(`Pappa: ${text}`, 3200);
  say(text, 'pappa');
  G.hintT = 4;
}

/** Gutten hopper, og trollvennene hopper etter i en bølge. */
function jump() {
  if ((G.mode === 'play' || G.mode === 'chase') && K.jump()) G.friends.hopAll();
}
input.onJump = jump;

// --- Styring med trykk ---

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitV = new THREE.Vector3(), mid = new THREE.Vector3();
const marker = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.28, 24), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0 }));
marker.rotation.x = -Math.PI / 2;
scene.add(marker);
let lastPath = 0;

/** Traff trykket en figur? Sjekker avstanden fra siktelinjen til midten av figuren. */
const tapped = (pos, height, r) => ray.ray.distanceToPoint(mid.set(pos.x, pos.y + height / 2, pos.z)) < r;

function handlePointer(now) {
  if (!input.dirty || (input.down && now - lastPath < 90)) return;
  const fresh = input.pressed;
  input.dirty = input.pressed = false;
  lastPath = now;
  const r = canvas.getBoundingClientRect();
  ndc.set(((input.x - r.left) / r.width) * 2 - 1, -((input.y - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (fresh) {
    // Trykk på gutten for å hoppe, og på en trollvenn for å kile den
    if (tapped(K.pos, 1.1, 0.45)) { jump(); return; }
    const friend = G.friends.list.find((t) => tapped(t.pos, t.h, t.r + 0.3));
    if (friend) { G.friends.tickle(friend); return; }
  }
  const hit = ray.intersectObjects(house.walkables, false)[0];
  const p = hit ? hit.point : ray.ray.intersectPlane(floorPlane, hitV);
  if (!p) return;
  G.path = nav.path(K.pos, p);
  marker.position.set(p.x, p.y + 0.03, p.z);
  marker.material.opacity = 0.9;
}

// --- Hovedløkke ---

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  update(now);
}

// Lokal testing: ?debug gir tilgang til tilstanden og lar oss spole fram
if (new URLSearchParams(location.search).has('debug')) {
  window.__troll = { G, K, enc, input, toys, ending, newRound: rounds.newRound, startChase, tick: (s) => { for (let i = 0; i < s * 30; i++) update(last + 1000 / 30); } };
}

const MUSIC = { play: 'calm', encounter: 'calm', paused: 'calm', chase: 'chase' };

function update(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)), time = now / 1000;
  last = Math.max(last, now);
  const active = G.mode === 'play' || G.mode === 'chase';
  let moving = false;
  if (active) { handlePointer(now); moving = K.move(dt); } else input.dirty = input.pressed = false;
  if (G.mode === 'play') checkWorld(dt);
  if (G.mode === 'chase') updateChase(G, dt);
  if (enc.active) K.turn(enc.active.pos.x - K.pos.x, enc.active.pos.z - K.pos.z, dt);
  if (G.mode !== 'paused') {
    G.friends.record();
    updateTrolls(G, dt, time);
    updateFx(dt);
    rounds.animateItems(dt, time);
    toys.update(dt, time, active);
    ending.update(dt, time);
    G.hintT -= dt;
  }
  // I leggescenen styrer ending.js gutten selv
  if (!ending.active) { K.place(dt); K.animate(dt, moving, time); }
  setMusic(MUSIC[G.mode] || 'off');
  updateHouse(house, K.pos, dt);
  updateDecor(house, time, G.dim);
  setSkyDim(scene, G.dim);
  garden.update(time);
  const kidLight = scene.userData.sky.kidLight;
  kidLight.position.set(K.pos.x, K.pos.y + 1.7, K.pos.z + 0.5);
  kidLight.intensity = 3.2 * (1 - 0.6 * G.dim);
  cam.update(dt, time);
  marker.material.opacity = Math.max(0, marker.material.opacity - dt * 1.5);
  renderer.render(scene, camera);
  ui.placeBubbles(camera, canvas.clientWidth, canvas.clientHeight);
}

// --- Start av en natt ---

function startRound(line) {
  ui.fadeThrough(() => {
    ending.reset();
    ui.show('hud');
    rounds.newRound();
    toys.reset();
    G.mode = 'play';
    ui.nightCard(G.night);
    G.kidSay(line);
  });
}

async function boot() {
  await Promise.all([loadClips(), Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))])]);
  const sign = makeTextSprite('Senga ↑', '#ffd98a', 0.5);
  sign.position.set(3.2, 3.9, 1.2);
  scene.add(sign);
  G.sign = sign;
  G.portraits = makePortraits(TROLLS);
  const peek = $('peek');
  for (const id of ['lurv', 'trapp', 'sinna']) {
    const img = document.createElement('img');
    img.src = G.portraits[id] || ''; img.alt = '';
    peek.append(img);
  }
  setupMenu(G, K, {
    start(name) { G.name = name; G.night = 1; startRound(KID.start); },
    again() { if (G.lastWin) G.night++; startRound(G.lastWin ? KID.nextNight : KID.again); },
    hint,
    jump,
  });
  window.addEventListener('resize', cam.resize);
  cam.resize();
  rounds.newRound();
  G.mode = 'title';
  requestAnimationFrame(frame);
}

boot();
