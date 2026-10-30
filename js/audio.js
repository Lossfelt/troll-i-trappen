// Lyd: innspilte MP3-er fra audio/ når de finnes (laget med tools/generate-audio.mjs),
// ellers syntetiske lydeffekter og nettleserens talesyntese.
import { KID, TROLL } from './lines.js';

let ctx = null, master = null, voiceOut = null, soundOn = true, voiceOn = true, voices = [];
let manifest = { speech: {}, sfx: {} };
const buffers = new Map();
let currentClip = null;

export function initAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!ctx && AC) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.45;
    master.connect(ctx.destination);
    // Begrenser etter forsterkningen, så de sterkeste replikkene ikke skurrer
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6; limiter.knee.value = 4; limiter.ratio.value = 12;
    limiter.attack.value = 0.003; limiter.release.value = 0.15;
    limiter.connect(ctx.destination);
    voiceOut = ctx.createGain();
    voiceOut.gain.value = 1;
    voiceOut.connect(limiter);
  }
  ctx?.resume?.();
  // iOS slipper bare til tale som startes fra et trykk
  const s = window.speechSynthesis;
  if (s) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; s.speak(u); }
}

export function setSound(on) { soundOn = on; if (!on) stopSpeech(); }
export function setVoice(on) { voiceOn = on; if (!on) stopSpeech(); }
export function stopSpeech() {
  window.speechSynthesis?.cancel();
  try { currentClip?.stop(); } catch { /* allerede stoppet */ }
  currentClip = null;
}

// --- Innspilte lydfiler ---

export async function loadClips() {
  try {
    const r = await fetch('audio/manifest.json', { cache: 'no-cache' });
    if (r.ok) manifest = await r.json();
  } catch { /* ingen lydfiler: spillet bruker talesyntese */ }
}

// Replikkene jevnes ut mot denne lydstyrken (RMS over partiene med lyd). Uten dette lå f.eks.
// Lille Lurv (sjenert) 12 dB lavere enn Kjempetrollet.
const SPEECH_TARGET_DB = -16;

/** Måler topp og lydstyrke. Lydeffektene jevnes ut på topp, replikkene på lydstyrke. */
function normalize(buf) {
  let peak = 0, sum = 0, n = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i += 8) {
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
      if (a > 0.01) { sum += a * a; n++; }
    }
  }
  buf.gain = peak > 0.01 ? Math.min(4, 0.9 / peak) : 1;
  const rms = Math.sqrt(sum / Math.max(1, n));
  buf.speechGain = rms > 0.001 ? Math.min(4, Math.max(0.6, 10 ** (SPEECH_TARGET_DB / 20) / rms)) : 1;
  return buf;
}

function getBuffer(file) {
  if (!ctx) return Promise.resolve(null);
  if (!buffers.has(file)) {
    buffers.set(file, fetch(`audio/${file}`).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)).then(normalize).catch(() => null));
  }
  return buffers.get(file);
}

/** Laster alle lydfilene i bakgrunnen, noen få om gangen. */
export async function preloadClips() {
  const files = [...Object.values(manifest.speech), ...Object.values(manifest.sfx)];
  for (let i = 0; i < files.length; i += 4) await Promise.all(files.slice(i, i + 4).map(getBuffer));
}

function playBuffer(buf, out, vol = 1) {
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buf; g.gain.value = vol;
  src.connect(g).connect(out);
  src.start();
  return src;
}

async function playSpeechClip(file) {
  if (ctx.state !== 'running') await ctx.resume().catch(() => {});
  if (ctx.state !== 'running') return false; // lyd på pause: bruk talesyntese i stedet
  const buf = await getBuffer(file);
  if (!buf) return false;
  stopSpeech();
  const src = playBuffer(buf, voiceOut, buf.speechGain);
  currentClip = src;
  // Sikring: dialogen skal aldri bli hengende om 'ended' uteblir
  await new Promise((r) => { src.onended = r; setTimeout(r, buf.duration * 1000 + 800); });
  if (currentClip === src) currentClip = null;
  return true;
}

// --- Stemmer ---
// Ekstrem tonehøyde får talesyntese til å låte som en robot. Derfor velger vi heller
// den beste norske stemmen enheten har, og en egen stemme til gutten hvis det finnes.
const isNorwegian = (v) => /^(nb|no|nn)\b/i.test(v.lang) || /norw|norsk|bokm/i.test(v.name);
const FEMALE = /pernille|iselin|nora|hulda|ingrid|kari|female|kvinne/i;
const MALE = /finn|jon\b|henrik|magnus|\bmale|mann/i;
const choice = { troll: '', kid: '' };

function quality(v) {
  let s = 0;
  if (/natural|neural|enhanced|premium|wavenet/i.test(v.name)) s += 10;
  if (/online|google/i.test(v.name)) s += 4;
  if (/compact|eloquence/i.test(v.name)) s -= 6;
  return s;
}

/** Kaller onChange med navnene på norske stemmer, beste først. */
export function loadVoices(onChange) {
  const s = window.speechSynthesis;
  if (!s) { onChange?.([]); return; }
  const refresh = () => {
    voices = s.getVoices().filter(isNorwegian).sort((a, b) => quality(b) - quality(a));
    onChange?.(voices.map((v) => v.name));
  };
  refresh();
  s.addEventListener?.('voiceschanged', refresh);
}

export function setVoiceChoice(role, name) { choice[role] = name || ''; }

function voiceFor(role) {
  const named = voices.find((v) => v.name === choice[role]);
  if (named) return named;
  const want = role === 'kid' ? FEMALE : MALE;
  return voices.find((v) => want.test(v.name)) || voices[0] || null;
}

// [stemme, tonehøyde, tempo] per rolle
const ROLES = {
  troll: ['troll', 0.75, 0.9], big: ['troll', 0.55, 0.82], small: ['troll', 1.3, 1.05],
  kid: ['kid', 1.3, 1.08], pappa: ['troll', 1, 0.95],
};
const TROLL_ROLE = { kjempe: 'big', lurv: 'small' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Leser opp tekst. `who` er 'kid', 'pappa' eller en trolltype-id.
 * Løses når opplesningen er ferdig, eller etter et anslag uten tale.
 */
export async function say(text, who = 'troll') {
  const file = manifest.speech[`${who}|${text}`];
  if (file && ctx && voiceOn && soundOn && await playSpeechClip(file)) return;
  return speak(text, ROLES[who] ? who : TROLL_ROLE[who] || 'troll');
}

function speak(text, who) {
  const s = window.speechSynthesis;
  const est = Math.min(5000, 600 + text.length * 55);
  if (!s || !voiceOn || !soundOn) return wait(Math.min(1400, est * 0.5));
  return new Promise((resolve) => {
    const [role, pitch, rate] = ROLES[who] || ROLES.pappa;
    const voice = voiceFor(role);
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang || 'nb-NO';
    u.pitch = pitch; u.rate = rate;
    let done = false;
    const fin = () => { if (!done) { done = true; resolve(); } };
    u.onend = fin; u.onerror = fin;
    setTimeout(fin, est + 3000);
    // Chrome mister av og til en replikk som startes rett etter cancel()
    if (s.speaking || s.pending) { s.cancel(); setTimeout(() => s.speak(u), 60); } else s.speak(u);
  });
}

export function sampleVoice(role) {
  speak(role === 'kid' ? KID.sample : TROLL.sample, role);
}

function tone(freq, dur, { type = 'sine', vol = 0.3, to = null, delay = 0 } = {}) {
  if (!ctx || !soundOn) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur, vol = 0.2, freq = 900) {
  if (!ctx || !soundOn) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start();
}

const synth = {
  step: () => tone(150 + Math.random() * 50, 0.05, { type: 'triangle', vol: 0.05 }),
  pickup: () => [660, 880, 1320].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.18, delay: i * 0.07 })),
  hmm: () => tone(150, 0.35, { type: 'triangle', vol: 0.14, to: 115 }),
  troll: () => { tone(95, 0.7, { type: 'sawtooth', vol: 0.12, to: 55 }); tone(48, 0.5, { vol: 0.35, to: 32 }); },
  laugh: () => [0, 0.22, 0.44].forEach((d) => tone(130, 0.18, { type: 'square', vol: 0.06, to: 100, delay: d })),
  meh: () => { tone(330, 0.2, { type: 'triangle', vol: 0.12, to: 290 }); tone(262, 0.3, { type: 'triangle', vol: 0.12, to: 220, delay: 0.2 }); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, { type: 'triangle', vol: 0.16, delay: i * 0.09 })),
  hurt: () => [392, 330, 247].forEach((f, i) => tone(f, 0.22, { type: 'square', vol: 0.06, delay: i * 0.12 })),
  poof: () => noise(0.35, 0.3, 700),
  heartbeat: () => { tone(62, 0.12, { vol: 0.4, to: 45 }); tone(62, 0.12, { vol: 0.28, to: 45, delay: 0.16 }); },
  shout: (l) => tone(260 + l * 420, 0.09, { type: 'square', vol: 0.04 + l * 0.05 }),
  boo: () => { noise(0.25, 0.35, 400); tone(220, 0.35, { type: 'sawtooth', vol: 0.15, to: 90 }); },
  burp: () => { tone(110, 0.45, { type: 'sawtooth', vol: 0.2, to: 70 }); noise(0.4, 0.15, 250); },
  snore: () => [0, 0.9].forEach((d) => tone(90, 0.6, { type: 'sawtooth', vol: 0.08, to: 70, delay: d })),
  night: () => [784, 659, 523, 587, 523, 392, 523].forEach((f, i) => tone(f, 0.5, { vol: 0.12, delay: i * 0.36 })),
};

// Innspilte effekter brukes når de finnes; ellers den syntetiske varianten
export const sfx = new Proxy(synth, {
  get(target, name) {
    return (...args) => {
      const file = manifest.sfx[name];
      if (!file || !ctx || !soundOn) return target[name]?.(...args);
      getBuffer(file).then((buf) => (buf ? playBuffer(buf, ctx.destination, 0.6 * buf.gain) : target[name]?.(...args)));
    };
  },
});
