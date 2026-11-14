import { musicOut } from './audio.js';

// Bakgrunnsmusikk som en spilledåse, laget i nettleseren. Rolig i huset, raskere under jakt.
// Melodien trekkes tilfeldig fra akkordene, så den aldri blir helt lik to ganger.

const CHORDS = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]]; // C, Am, F, G (halvtoner fra C)
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16]; // pentaton, to oktaver
const hz = (semi, base = 523.25) => base * 2 ** (semi / 12);

let mood = 'off', next = 0, stepNo = 0, timer = 0, last = 3;

function pluck(a, freq, t, vol, dur, type = 'sine') {
  const o = a.ctx.createOscillator(), g = a.ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.out);
  o.start(t); o.stop(t + dur + 0.05);
}

function playStep(a, t) {
  const chase = mood === 'chase', bar = Math.floor(stepNo / 8) % 4, beat = stepNo % 8;
  const chord = CHORDS[bar];
  if (chase) {
    // Jakt: lystig tramp i bassen og raske toner, mer tegnefilm enn skummelt
    pluck(a, hz(chord[beat % 2 ? 2 : 0], 130.8), t, 0.16, 0.16, 'triangle');
    if (beat % 2 === 0 || Math.random() < 0.5) pluck(a, hz(chord[(beat * 2) % 3] + (beat % 4 === 3 ? 12 : 0)), t, 0.07, 0.14, 'triangle');
    return;
  }
  if (beat === 0) pluck(a, hz(chord[0], 130.8), t, 0.13, 1.6);
  if (beat % 2 === 1) pluck(a, hz(chord[(beat >> 1) % 3], 261.6), t, 0.035, 0.7);
  if (beat % 4 === 0 || Math.random() < 0.45) {
    // Melodien går i små steg, og lander på akkordtonen på første slag
    last = Math.max(0, Math.min(SCALE.length - 1, last + Math.floor(Math.random() * 5) - 2));
    const semi = beat === 0 ? chord[Math.floor(Math.random() * 3)] + 12 : SCALE[last];
    pluck(a, hz(semi), t, 0.075, 1.1);
    pluck(a, hz(semi + 12), t, 0.018, 0.5);
  }
}

function tick() {
  const a = musicOut();
  if (!a || mood === 'off') { next = 0; return; }
  const stepLen = mood === 'chase' ? 0.17 : 0.34;
  if (next < a.ctx.currentTime) next = a.ctx.currentTime + 0.05;
  while (next < a.ctx.currentTime + 0.25) {
    playStep(a, next);
    next += stepLen;
    stepNo++;
  }
}

/** 'calm' i huset, 'chase' under jakt, 'off' for stillhet. */
export function setMusic(m) {
  if (m === mood) return;
  mood = m;
  stepNo = 0;
  if (!timer) timer = setInterval(tick, 80);
}
