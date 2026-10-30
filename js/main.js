import * as THREE from 'three';
import { createRenderer, createScene } from './world.js';
import { buildHouse, updateHouse, roomAt, onStairs, START, STAIRS } from './house.js';
import { TROLLS } from './trolls.js';
import { NavGrid, segmentHitsWall } from './physics.js';
import { createInput } from './input.js';
import { initAudio, loadClips, preloadClips, loadVoices, sampleVoice, say, sfx, setSound, setVoice, setVoiceChoice, stopSpeech } from './audio.js';
import { store } from './store.js';
import * as ui from './ui.js';
import { makePortraits } from './portraits.js';
import { burst, updateFx, makeTextSprite } from './fx.js';
import { updateTrolls, updateChase, poof, startChase } from './actors.js';
import { createEncounters } from './encounter.js';
import { createKidController, KID_R } from './kid.js';
import { createRounds } from './round.js';
import { KID, QUIPS, PAPPA } from './lines.js';

const $ = ui.$;
const TALKING = ['idle', 'sleep', 'guard', 'approach'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = $('c');
const renderer = createRenderer(canvas);
const scene = createScene();
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);
const house = buildHouse(scene);
const nav = new NavGrid({ minX: -12, maxX: 12, minZ: -9, maxZ: 9 }, 0.3);
const input = createInput(canvas);

const G = {
  scene, camera, house, nav, KID_R, mode: 'title', prevMode: 'play', night: 1, lastWin: false,
  trolls: [], items: [], hearts: 3, stars: 0, inv: [], hasBamse: false, friendsRound: 0,
  follower: null, chase: null, path: null, room: null, shake: 0, portraits: {}, name: 'Helten', stairWarn: 0, hintT: 0,
};
const K = createKidController(G, input);
G.kid = K;
const enc = createEncounters(G);
const rounds = createRounds(G);

G.rebuildNav = () => nav.build(house.boxes, KID_R + 0.02, 'kid');
G.kidSay = (text) => { ui.bubble('kid', K.m.group, 1.55, text, 2800, 'kid'); return say(text, 'kid'); };
G.trollSay = (t, text, ms = 2600, speak = false) => {
  ui.bubble(`t${t.uid}`, t.m.group, t.h + 0.25, text, ms, 'troll');
  if (speak) say(text, t.def.id);
};
G.kidAnim = (kind) => { K.anim = kind; K.animT = kind === 'dance' ? 1.8 : 1.5; };
G.addStar = () => { G.stars++; sfx.win(); ui.updateHud(G); };
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
    if (G.hasBamse) { endGame('win'); return; }
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

function endGame(kind) {
  if (G.mode === 'over') return;
  G.mode = 'over'; G.path = null; G.chase = null;
  ui.closeDialog();
  ui.show('chaseBar', false);
  const win = kind === 'win';
  G.lastWin = win;
  const title = win ? `God natt, ${G.name}!` : 'PAPPAAA!';
  const text = win
    ? 'Du fant bamsen og kom deg helt opp trappen til senga. Trollene får vente til i morgen.'
    : `${G.name} ropte på pappa. Pappa kom med en kjempeklem, og vips, så var alle trollene borte.`;
  $('endEmoji').textContent = win ? '🌙' : '🤗';
  $('endTitle').textContent = title;
  $('endText').textContent = text;
  $('endStats').textContent = `Natt ${G.night} · ⭐ ${G.stars} ${G.stars === 1 ? 'stjerne' : 'stjerner'} · 🤝 ${G.friendsRound} ${G.friendsRound === 1 ? 'ny trollvenn' : 'nye trollvenner'}`;
  $('btnAgain').textContent = win ? `Natt ${G.night + 1} 🌙` : 'Prøv igjen';
  if (win) { sfx.night(); burst(scene, K.pos, 0xffd76a, 30); }
  else setTimeout(() => G.trolls.forEach((t) => poof(G, t)), 600);
  setTimeout(() => {
    ui.show('hud', false);
    ui.show('screenEnd');
    if (win) say(PAPPA.win, 'pappa');
    else say(KID.callPappa, 'kid').then(() => say(PAPPA.lose, 'pappa'));
  }, 1100);
}

function hint() {
  if (G.mode !== 'play') return;
  initAudio();
  const b = G.items.find((i) => i.id === 'bamse' && !i.taken);
  const text = G.hasBamse || !b ? PAPPA.done : PAPPA.where(roomAt(b.pos.x, b.pos.z)?.id);
  ui.toast(`Pappa: ${text}`, 3200);
  say(text, 'pappa');
  G.hintT = 4;
}

// --- Styring med trykk ---

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitV = new THREE.Vector3();
const marker = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.28, 24), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0 }));
marker.rotation.x = -Math.PI / 2;
scene.add(marker);
let lastPath = 0;

function handlePointer(now) {
  if (!input.dirty || (input.down && now - lastPath < 90)) return;
  input.dirty = false;
  lastPath = now;
  const r = canvas.getBoundingClientRect();
  ndc.set(((input.x - r.left) / r.width) * 2 - 1, -((input.y - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(house.walkables, false)[0];
  const p = hit ? hit.point : ray.ray.intersectPlane(floorPlane, hitV);
  if (!p) return;
  G.path = nav.path(K.pos, p);
  marker.position.set(p.x, p.y + 0.03, p.z);
  marker.material.opacity = 0.9;
}

// --- Kamera ---

const camPos = new THREE.Vector3(-1, 9, 14), camLook = new THREE.Vector3(START.x, 0, START.z);
const focus = new THREE.Vector3(), want = new THREE.Vector3(), lookAt = new THREE.Vector3();

function updateCamera(dt, time) {
  let k = camera.aspect < 0.9 ? Math.min(1.8, 1 + (0.9 - camera.aspect) * 1.7) : 1;
  let lift = 0;
  focus.copy(K.pos);
  if (G.mode === 'title') {
    want.set(focus.x + Math.sin(time * 0.25) * 3, focus.y + 6.5 * k, focus.z + 6.5 * k);
  } else {
    // Under møter skyves figurene opp, over dialogpanelet
    if (enc.active) { focus.lerp(enc.active.pos, 0.5); k *= 0.72; lift = (camera.aspect < 0.9 ? 2.1 : 1.4) * k; }
    want.set(focus.x, focus.y + 8.4 * k, focus.z + 6.3 * k);
  }
  lookAt.set(focus.x, focus.y + 0.6, focus.z + lift);
  const s = 1 - Math.exp(-3.5 * dt);
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

// --- Hovedløkke ---

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  update(now);
}

// Lokal testing: ?debug gir tilgang til tilstanden og lar oss spole fram
if (new URLSearchParams(location.search).has('debug')) {
  window.__troll = { G, K, enc, newRound: rounds.newRound, startChase, tick: (s) => { for (let i = 0; i < s * 30; i++) update(last + 1000 / 30); } };
}

function update(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)), time = now / 1000;
  last = Math.max(last, now);
  const active = G.mode === 'play' || G.mode === 'chase';
  let moving = false;
  if (active) { handlePointer(now); moving = K.move(dt); } else input.dirty = false;
  if (G.mode === 'play') checkWorld(dt);
  if (G.mode === 'chase') updateChase(G, dt);
  if (enc.active) K.turn(enc.active.pos.x - K.pos.x, enc.active.pos.z - K.pos.z, dt);
  if (G.mode !== 'paused') {
    updateTrolls(G, dt, time);
    updateFx(dt);
    rounds.animateItems(dt, time);
    G.hintT -= dt;
  }
  K.place(dt);
  K.animate(dt, moving, time);
  updateHouse(house, K.pos, dt);
  updateCamera(dt, time);
  marker.material.opacity = Math.max(0, marker.material.opacity - dt * 1.5);
  renderer.render(scene, camera);
  ui.placeBubbles(camera, canvas.clientWidth, canvas.clientHeight);
}

// --- Skjermer og knapper ---

function paintSound() {
  const on = store.get().sound;
  $('btnSound').textContent = on ? '🔊' : '🔇';
  $('btnSound').setAttribute('aria-label', on ? 'Slå av lyd' : 'Slå på lyd');
}

function startRound(line) {
  ui.show('hud');
  rounds.newRound();
  G.mode = 'play';
  ui.toast(`Natt ${G.night}`, 2200);
  G.kidSay(line);
}

function startGame() {
  initAudio();
  preloadClips();
  const name = $('heroName').value.trim().slice(0, 16) || 'Helten';
  const hair = document.querySelector('input[name=hair]:checked')?.value || 'brun';
  const voice = $('voiceToggle').checked;
  store.set({ name, hair, voice });
  setVoice(voice);
  setSound(store.get().sound);
  G.name = name;
  G.night = 1;
  ui.show('screenTitle', false);
  startRound(KID.start);
}

function openBook() {
  ui.renderBook(G.portraits);
  if (['play', 'chase', 'encounter'].includes(G.mode)) { G.prevMode = G.mode; G.mode = 'paused'; }
  ui.show('screenBook');
}

function closeBook() {
  ui.show('screenBook', false);
  if (G.mode === 'paused') G.mode = G.prevMode;
}

function setupVoices() {
  const s = store.get();
  for (const role of ['troll', 'kid']) {
    const key = role === 'kid' ? 'voiceKid' : 'voiceTroll';
    const sel = $(key);
    setVoiceChoice(role, s[key]);
    sel.addEventListener('change', () => { store.set({ [key]: sel.value }); setVoiceChoice(role, sel.value); sampleVoice(role); });
    $(role === 'kid' ? 'tryKid' : 'tryTroll').addEventListener('click', () => { initAudio(); sampleVoice(role); });
  }
  loadVoices((names) => {
    $('voiceNote').hidden = names.length > 0;
    $('voiceSettings').hidden = names.length === 0;
    for (const key of ['voiceTroll', 'voiceKid']) {
      const sel = $(key), keep = store.get()[key] || '';
      const opts = [['', 'Automatisk'], ...names.map((n) => [n, n])].map(([value, label]) => {
        const o = document.createElement('option');
        o.value = value; o.textContent = label;
        return o;
      });
      sel.replaceChildren(...opts);
      sel.value = names.includes(keep) ? keep : '';
    }
  });
}

function setupUi() {
  const s = store.get();
  $('heroName').value = s.name;
  for (const r of document.querySelectorAll('input[name=hair]')) {
    r.checked = r.value === s.hair;
    r.addEventListener('change', () => { if (r.checked) { store.set({ hair: r.value }); K.rebuild(r.value); } });
  }
  $('voiceToggle').checked = s.voice;
  $('btnStart').addEventListener('click', startGame);
  $('heroName').addEventListener('keydown', (e) => { if (e.key === 'Enter') startGame(); });
  $('btnAgain').addEventListener('click', () => {
    stopSpeech();
    ui.show('screenEnd', false);
    if (G.lastWin) G.night++;
    startRound(G.lastWin ? KID.nextNight : KID.again);
  });
  for (const id of ['btnBook', 'btnBook2', 'btnBook3']) $(id).addEventListener('click', openBook);
  $('btnCloseBook').addEventListener('click', closeBook);
  $('btnHint').addEventListener('click', hint);
  $('btnSound').addEventListener('click', () => {
    store.set({ sound: !store.get().sound });
    setSound(store.get().sound);
    paintSound();
  });
  paintSound();
  setupVoices();
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopSpeech(); });
  window.addEventListener('resize', resize);
}

async function boot() {
  await Promise.all([loadClips(), Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))])]);
  const sign = makeTextSprite('Senga ↑', '#ffd98a', 0.5);
  sign.position.set(3.2, 3.2, 1.8);
  scene.add(sign);
  G.portraits = makePortraits(TROLLS);
  const peek = $('peek');
  for (const id of ['lurv', 'trapp', 'sinna']) {
    const img = document.createElement('img');
    img.src = G.portraits[id] || ''; img.alt = '';
    peek.append(img);
  }
  setupUi();
  resize();
  rounds.newRound();
  G.mode = 'title';
  requestAnimationFrame(frame);
}

boot();
