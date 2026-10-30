import * as THREE from 'three';
import { ITEMS, TROLLS } from './trolls.js';
import { store } from './store.js';

export const $ = (id) => document.getElementById(id);
export const show = (id, on = true) => { $(id).hidden = !on; };

export function updateHud(G) {
  $('hearts').textContent = '❤️'.repeat(Math.max(0, G.hearts)) + '🤍'.repeat(Math.max(0, 3 - G.hearts));
  $('stars').textContent = `⭐ ${G.stars}`;
  $('night').textContent = `🌙 ${G.night}`;
  $('goal').textContent = G.hasBamse ? '🛏️ Gå opp trappen til senga' : '🧸 Finn bamsen';
  $('invItems').textContent = G.inv.map((id) => ITEMS[id].emoji).join(' ');
  $('inv').hidden = !G.inv.length;
}

let toastTimer = 0;
export function toast(text, ms = 1600) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export function flash() {
  const el = $('flash');
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
}

// --- Snakkebobler som følger figurene ---
const bubbles = new Map();
const v = new THREE.Vector3();

export function bubble(key, anchor, yOff, text, ms = 2600, cls = 'kid') {
  let b = bubbles.get(key);
  if (!b) {
    b = { el: document.createElement('div') };
    $('bubbles').append(b.el);
    bubbles.set(key, b);
  }
  b.el.className = `bubble ${cls}`;
  b.el.textContent = text;
  Object.assign(b, { anchor, yOff, until: performance.now() + ms });
}

export function clearBubbles() {
  for (const b of bubbles.values()) b.el.remove();
  bubbles.clear();
}

export function placeBubbles(camera, w, h) {
  const now = performance.now();
  for (const [key, b] of bubbles) {
    if (now > b.until || !b.anchor.parent) { b.el.remove(); bubbles.delete(key); continue; }
    b.anchor.getWorldPosition(v);
    v.y += b.yOff;
    v.project(camera);
    const x = Math.min(w - 90, Math.max(90, (v.x * 0.5 + 0.5) * w));
    const y = Math.max(70, (-v.y * 0.5 + 0.5) * h);
    b.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }
}

// --- Møtedialog ---
export function openDialog(def, portrait) {
  const img = $('dlgPortrait');
  img.hidden = !portrait;
  if (portrait) img.src = portrait;
  $('dlgName').textContent = def.name;
  $('dlgMood').textContent = def.mood;
  show('dialog');
}

export function dialogLine(speaker, text, who) {
  const p = $('dlgText');
  const s = document.createElement('strong');
  s.textContent = `${speaker}: `;
  p.replaceChildren(s, text);
  p.className = who;
}

export function setChoices(list) {
  $('choices').replaceChildren(...list.map((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `choice ${o.cls || ''}`;
    const ic = document.createElement('span');
    ic.className = 'ic'; ic.setAttribute('aria-hidden', 'true'); ic.textContent = o.icon;
    const label = document.createElement('span');
    label.textContent = o.label;
    b.append(ic, label);
    b.addEventListener('click', o.act, { once: true });
    return b;
  }));
}

export function closeDialog() { show('dialog', false); show('meter', false); setChoices([]); }

/**
 * Rope-spillet: hvert trykk gjør ropet høyere, og det synker sakte igjen.
 * Løses med true hvis ropet var høyt nok innen tre sekunder.
 */
export function shoutGame(onLevel) {
  return new Promise((resolve) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice primary shout';
    b.innerHTML = '<span class="ic" aria-hidden="true">📣</span><span>ROP! Trykk fort!</span>';
    let level = 0, done = false;
    const t0 = performance.now();
    const tap = (e) => {
      e.preventDefault();
      if (done) return;
      level = Math.min(1, level + 0.18);
      onLevel(level);
      b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    };
    b.addEventListener('pointerdown', tap);
    b.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') tap(e); });
    $('choices').replaceChildren(b);
    show('meter');
    b.focus();
    const iv = setInterval(() => {
      const elapsed = (performance.now() - t0) / 1000;
      level = Math.max(0, level - 0.0075);
      $('meterFill').style.transform = `scaleX(${level})`;
      $('meterTime').style.transform = `scaleX(${Math.max(0, 1 - elapsed / 3)})`;
      if (level >= 1 || elapsed >= 3) {
        done = true;
        clearInterval(iv);
        setTimeout(() => { show('meter', false); resolve(level >= 0.65); }, 300);
      }
    }, 50);
  });
}

export function chaseBar(frac) { $('chaseFill').style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`; }

// --- Trollboka ---
export function renderBook(portraits) {
  const book = store.get().book;
  const grid = $('bookGrid');
  grid.replaceChildren();
  let met = 0;
  for (const [id, def] of Object.entries(TROLLS)) {
    const e = book[id] || { met: 0, friends: 0 };
    if (e.met) met++;
    const card = document.createElement('div');
    card.className = 'card' + (e.met ? '' : ' unknown');
    const img = document.createElement('img');
    img.alt = '';
    if (portraits[id]) img.src = portraits[id];
    const name = document.createElement('b');
    name.textContent = e.met ? def.name : '???';
    const mood = document.createElement('small');
    mood.textContent = e.met ? def.mood : 'Ikke møtt ennå';
    card.append(img, name, mood);
    if (e.met) {
      const count = document.createElement('small');
      count.className = 'count';
      count.textContent = `Møtt ${e.met} · Venner ${e.friends}`;
      card.append(count);
    }
    grid.append(card);
  }
  $('bookSummary').textContent = `Du har møtt ${met} av ${Object.keys(TROLLS).length} troll.`;
}
