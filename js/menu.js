import { initAudio, preloadClips, loadVoices, sampleVoice, setSound, setVoice, setVoiceChoice, stopSpeech } from './audio.js';
import { PJS } from './models.js';
import { store } from './store.js';
import * as ui from './ui.js';

// Startskjermen, trollboka og knappene i HUD-en.
const $ = ui.$;

function paintSound() {
  const on = store.get().sound;
  $('btnSound').textContent = on ? '🔊' : '🔇';
  $('btnSound').setAttribute('aria-label', on ? 'Slå av lyd' : 'Slå på lyd');
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

/** Pysjvelgeren: pysjer låses opp etter hvert som stjernene samles. */
function setupPyjamas(onLook) {
  const s = store.get(), field = $('pjField');
  if (!PJS[s.pj] || PJS[s.pj].need > s.stars) store.set({ pj: 'bla' });
  $('pjStars').textContent = `⭐ ${s.stars}`;
  for (const [id, pj] of Object.entries(PJS)) {
    const locked = pj.need > s.stars;
    const label = document.createElement('label'), input = document.createElement('input'), dot = document.createElement('span');
    label.className = 'swatch' + (locked ? ' locked' : '');
    Object.assign(input, { type: 'radio', name: 'pj', value: id, disabled: locked, checked: id === store.get().pj });
    dot.style.setProperty('--c', `#${pj.c.toString(16).padStart(6, '0')}`);
    label.append(input, dot, locked ? `${pj.name} (⭐ ${pj.need})` : pj.name);
    input.addEventListener('change', () => { if (input.checked) { store.set({ pj: id }); onLook(); } });
    field.append(label);
  }
}

/**
 * Kobler opp alle knapper. `on` har start(name), again(), hint() og jump();
 * `K` er gutten, som bygges på nytt når hår eller pysj byttes.
 */
export function setupMenu(G, K, on) {
  const s = store.get();
  const relook = () => K.rebuild(store.get().hair, store.get().pj);
  $('heroName').value = s.name;
  for (const r of document.querySelectorAll('input[name=hair]')) {
    r.checked = r.value === s.hair;
    r.addEventListener('change', () => { if (r.checked) { store.set({ hair: r.value }); relook(); } });
  }
  setupPyjamas(relook);
  $('voiceToggle').checked = s.voice;

  const start = () => {
    initAudio();
    preloadClips();
    const name = $('heroName').value.trim().slice(0, 16) || 'Helten';
    const voice = $('voiceToggle').checked;
    store.set({ name, voice });
    setVoice(voice);
    setSound(store.get().sound);
    ui.show('screenTitle', false);
    on.start(name);
  };
  $('btnStart').addEventListener('click', start);
  $('heroName').addEventListener('keydown', (e) => { if (e.key === 'Enter') start(); });
  $('btnAgain').addEventListener('click', () => { stopSpeech(); ui.show('screenEnd', false); on.again(); });

  const openBook = () => {
    ui.renderBook(G.portraits);
    if (['play', 'chase', 'encounter'].includes(G.mode)) { G.prevMode = G.mode; G.mode = 'paused'; }
    ui.show('screenBook');
  };
  for (const id of ['btnBook', 'btnBook2', 'btnBook3']) $(id).addEventListener('click', openBook);
  $('btnCloseBook').addEventListener('click', () => {
    ui.show('screenBook', false);
    if (G.mode === 'paused') G.mode = G.prevMode;
  });
  $('btnHint').addEventListener('click', () => { initAudio(); on.hint(); });
  $('btnJump').addEventListener('pointerdown', (e) => { e.preventDefault(); on.jump(); });
  $('btnJump').addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); on.jump(); } });
  $('btnSound').addEventListener('click', () => {
    store.set({ sound: !store.get().sound });
    setSound(store.get().sound);
    paintSound();
  });
  paintSound();
  setupVoices();
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopSpeech(); });
}
