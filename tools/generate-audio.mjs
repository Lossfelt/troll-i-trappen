// Lager replikker og lydeffekter med ElevenLabs og lagrer dem som MP3 i audio/.
//
//   node tools/generate-audio.mjs --sample     én prøvereplikk per figur, til tools/stemmeprover.html
//   node tools/generate-audio.mjs              lag alt som mangler
//   node tools/generate-audio.mjs --only sfx   bare lydeffekter (speech | sfx | manifest)
//   node tools/generate-audio.mjs --redo sinna lag replikkene til én figur på nytt
//
// Stemmene er norske stemmer fra ElevenLabs sitt bibliotek (krever betalt plan). Første gang
// legges de til kontoen og ID-ene lagres i tools/voices.json. Vil du bytte stemme for en figur,
// endre CAST under og slett figuren fra tools/voices.json. Filnavnene inneholder stemme-ID-en,
// så nye stemmer gir nye filer automatisk.
//
// Nøkkelen leses fra ELEVENLABS_API_KEY eller fra .env i prosjektmappen. Den havner aldri i spillet.
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { allSpoken, KID, PAPPA } from '../js/lines.js';
import { TROLLS } from '../js/trolls.js';

const ROOT = new URL('../', import.meta.url);
const AUDIO = new URL('audio/', ROOT);
const PREVIEWS = new URL('tools/voice-previews/', ROOT);
const VOICES_FILE = new URL('tools/voices.json', ROOT);
const API = 'https://api.elevenlabs.io';
// eleven_v4 holdt seg best på norsk i lyttetestene. En figur kan overstyre med `model`.
const TTS_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_v4';
const modelFor = (who) => CAST[who].model || TTS_MODEL;
// Lydtagger som [gruffly] styrer framføringen. Lyttetesten viste at de virker med eleven_v4 også.
const tagFor = (who) => `${CAST[who].tag} `;

// Figurene: norsk bibliotekstemme (id og eier) og en lydtagg som styrer framføringen
const CAST = {
  kid: { name: 'Mia Starset', id: 'uNsWM1StCcpydKYOjKyu', owner: '3bf4c08299e6441b6aa586890a6b517944b453b4d3748fd13d690594323696be', tag: '[excited]' },
  pappa: { name: 'Magnar', id: 'St7X3jjf2NZQB9rcGjjZ', owner: 'f3f67c5bcd3769e278ad346b5f2404bb230be4cd1727d12e263c44d79b06ae4f', tag: '[warmly]' },
  trapp: { name: 'Robert', id: 'CMbvLbbccSd611KtwxV3', owner: '5ab0f7a5d379d8109fa39e6b61d323dbb413711d8932e6570b27c4ca686473bb', tag: '[gruffly]' },
  sinna: { name: 'Karsten', id: 'nDDLnlNUK5tNoyGVJSRp', owner: '7ad2be120018af8e178c0619e497f0291ffb7721d87764a9e2d0a7efce19eabc', tag: '[angry] [growls]' },
  sulten: { name: 'Johann', id: 'goUjLCRHn3Deb8y2jFuG', owner: '0eaf1982eedee416daf4537e6598a997f5ecafa97861d22223f97a91ce8b40af', tag: '[hungrily]' },
  lurv: { name: 'Emma', id: 'b3jcIbyC3BSnaRu8avEk', owner: '733ece35e3c8f904fc911d879eec258114b4b8095e84396a60a702cdb0a222b2', tag: '[shyly]' },
  kjempe: { name: 'Øyvind', id: 'nhvaqgRyAq6BmFs3WcdX', owner: '17f3d10a30c42fdac07a6f26feda26b7892eea50287931c0727fcf66ceb0fd46', tag: '[booming]' },
  sokk: { name: 'Johannes', id: '2dhHLsmg0MVma2t041qT', owner: 'a6cf09452d2213d7d3379df948a758c410234ddbf9b2a872ab1e18708e317f36', tag: '[excitedly]' },
  sovn: { name: 'Olaf', id: 'xF681s0UeE04gsf0mVsJ', owner: 'a24ac786e5161a691ef62c3dd1dce004cd631a269b4506f953f574d21fad1754', tag: '[sleepily] [yawns]' },
};

// Lydeffekter som erstatter de syntetiske i js/audio.js (samme navn)
const SFX = {
  troll: ['Short deep friendly cartoon troll growl, playful, not scary, for a toddler game', 1.2],
  hmm: ['Curious deep cartoon troll humming "hmm?" sound', 0.8],
  laugh: ['Big jolly cartoon troll laughing "ho ho ho", deep and silly', 1.8],
  meh: ['Grumpy cartoon troll "hmpf" grumble, short', 0.8],
  burp: ['Long funny cartoon burp', 1.2],
  snore: ['Cartoon troll snoring loudly, two big snores', 2.5],
  boo: ['Cartoon creature popping up out of the floor with a whoosh and a playful boo shout', 1.0],
  poof: ['Magic cartoon puff of smoke with sparkles, poof', 0.8],
  pickup: ['Bright sparkly item pickup chime for a children\'s game', 0.6],
  win: ['Short happy magical chime fanfare for a children\'s game', 1.5],
  hurt: ['Gentle cartoon bonk followed by a soft sad descending slide whistle, for toddlers', 1.2],
  night: ['Gentle music box lullaby, soft, slow and sleepy', 7],
};

// Prøvereplikkene: noe typisk for hver figur
const SAMPLES = {
  kid: KID.start, pappa: PAPPA.win,
  ...Object.fromEntries(Object.entries(TROLLS).map(([id, def]) => [id, def.intro[0]])),
};

const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] ?? true : null);
const only = flag('--only'), redo = flag('--redo'), sample = args.includes('--sample');
const wants = (step) => !only || only === step;

async function loadKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  try {
    const env = await readFile(new URL('.env', ROOT), 'utf8');
    const m = env.match(/^\s*ELEVENLABS_API_KEY\s*=\s*["']?([^"'\r\n]+)/m);
    if (m) return m[1].trim();
  } catch { /* ingen .env */ }
  throw new Error('Fant ingen nøkkel. Sett ELEVENLABS_API_KEY i miljøet eller i .env i prosjektmappen.');
}

const KEY = await loadKey();

async function api(path, { body, binary = false } = {}) {
  const method = body ? 'POST' : 'GET';
  const res = await fetch(API + path, {
    method,
    headers: { 'xi-api-key': KEY, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} ga ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return binary ? Buffer.from(await res.arrayBuffer()) : res.json();
}

// Feil som gjelder hele kontoen. Da stopper vi i stedet for å sende flere kall.
const FATAL = /detected_unusual_activity|payment_required|paid_plan_required|missing_permissions|quota_exceeded|invalid_api_key/;
const CONCURRENCY = Number(process.env.ELEVENLABS_CONCURRENCY) || 2;
let aborted = null;

/** Kjører oppgaver med begrenset samtidighet. Samler vanlige feil, stopper ved kontofeil. */
async function pool(items, fn) {
  const errors = [];
  let i = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (i < items.length && !aborted) {
      const item = items[i++];
      try { await fn(item); } catch (e) {
        errors.push(e.message);
        console.error('\n  FEIL:', e.message);
        if (FATAL.test(e.message)) aborted = e.message;
      }
    }
  }));
  return errors;
}

const spoken = allSpoken();
let voices = {};
const fileFor = (who, text) => `${who}-${createHash('sha1').update(`${voices[who]}|${modelFor(who)}|${tagFor(who)}${text}`).digest('hex').slice(0, 10)}.mp3`;

// --- 1. Stemmer: legg bibliotekstemmene til kontoen ---

async function ensureVoices() {
  const saved = existsSync(VOICES_FILE) ? JSON.parse(await readFile(VOICES_FILE, 'utf8')) : {};
  for (const [who, c] of Object.entries(CAST)) {
    if (saved[who]?.library === c.id) continue;
    console.log(`Legger til ${c.name} (${who}) på kontoen`);
    const res = await api(`/v1/voices/add/${c.owner}/${c.id}`, { body: { new_name: `Troll i trappen: ${who} (${c.name})` } });
    saved[who] = { library: c.id, voice: res.voice_id };
    await writeFile(VOICES_FILE, JSON.stringify(saved, null, 2));
  }
  return Object.fromEntries(Object.keys(CAST).map((who) => [who, saved[who].voice]));
}

// --- 2. Replikker ---

let languageNote = null;
async function tts(who, text) {
  const body = { text: `${tagFor(who)}${text}`, model_id: modelFor(who), language_code: 'no' };
  const path = `/v1/text-to-speech/${voices[who]}?output_format=mp3_44100_64`;
  try {
    return await api(path, { body, binary: true });
  } catch (e) {
    if (!/ga 4(00|22):/.test(e.message)) throw e;
    // Noen modeller tar ikke språkkode. Si fra, siden det kan gi dårligere norsk.
    if (!languageNote) { languageNote = e.message.slice(0, 200); console.warn(`\n  Språkkoden ble avvist, prøver uten: ${languageNote}`); }
    delete body.language_code;
    return api(path, { body, binary: true });
  }
}

async function makeSpeech() {
  if (redo && CAST[redo]) {
    for (const f of await readdir(AUDIO)) if (f.startsWith(`${redo}-`)) await rm(new URL(f, AUDIO));
  }
  const todo = spoken.filter((l) => !existsSync(new URL(fileFor(l.who, l.text), AUDIO)));
  const chars = todo.reduce((n, l) => n + l.text.length + tagFor(l.who).length, 0);
  console.log(`Replikker: lager ${todo.length} av ${spoken.length} (ca. ${chars} tegn), modell ${TTS_MODEL} (unntak: ${Object.keys(CAST).filter((w) => CAST[w].model).map((w) => `${w}=${CAST[w].model}`).join(', ') || 'ingen'})`);
  return pool(todo, async (l) => {
    await writeFile(new URL(fileFor(l.who, l.text), AUDIO), await tts(l.who, l.text));
    process.stdout.write('.');
  });
}

async function makeSamples() {
  await mkdir(PREVIEWS, { recursive: true });
  const errors = await pool(Object.keys(CAST), async (who) => {
    await writeFile(new URL(`sample-${TTS_MODEL}-${who}.mp3`, PREVIEWS), await tts(who, SAMPLES[who]));
    process.stdout.write('.');
  });
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Stemmeprøver</title>
<style>
  body { font: 16px/1.4 system-ui, sans-serif; margin: 0; padding: 20px max(16px, env(safe-area-inset-left)); background: #141b2b; color: #fff3d9; }
  h1 { color: #e3a93c; margin: 0 0 4px; } p { color: #cfc6ad; margin: 0 0 16px; }
  .row { display: grid; gap: 6px; padding: 14px 0; border-top: 1px solid #2c4636; }
  .row b { color: #e3a93c; } .row small { color: #a7c86c; } audio { width: 100%; max-width: 460px; }
</style>
<h1>Stemmeprøver: norske stemmer</h1>
<p>ElevenLabs ${TTS_MODEL}, norske bibliotekstemmer.</p>
${Object.entries(CAST).map(([who, c]) => `<div class="row"><b>${who}</b><small>${esc(c.name)}</small><span>«${esc(SAMPLES[who])}»</span>
${existsSync(new URL(`sample-${who}.mp3`, PREVIEWS)) ? `<small>Før: eleven_v3 med tagg</small><audio controls preload="none" src="voice-previews/sample-${who}.mp3"></audio>` : ''}
<small>Nå: ${TTS_MODEL}</small><audio controls preload="none" src="voice-previews/sample-${TTS_MODEL}-${who}.mp3"></audio></div>`).join('\n')}`;
  await writeFile(new URL('tools/stemmeprover.html', ROOT), html);
  console.log('\nSkrev tools/stemmeprover.html');
  return errors;
}

// --- 3. Lydeffekter ---

async function makeSfx() {
  const todo = Object.keys(SFX).filter((n) => n === redo || !existsSync(new URL(`sfx-${n}.mp3`, AUDIO)));
  console.log(`Lydeffekter: ${todo.length} mangler`);
  return pool(todo, async (name) => {
    const [text, duration] = SFX[name];
    const audio = await api('/v1/sound-generation?output_format=mp3_44100_64', {
      body: { text, duration_seconds: duration, prompt_influence: 0.5 }, binary: true,
    });
    await writeFile(new URL(`sfx-${name}.mp3`, AUDIO), audio);
    process.stdout.write('.');
  });
}

// --- Manifest: hva spillet finner i audio/. Bare figurer der alle replikkene finnes. ---

async function writeManifest() {
  const manifest = { speech: {}, sfx: {} };
  const has = (l) => existsSync(new URL(fileFor(l.who, l.text), AUDIO));
  const ready = new Set(Object.keys(CAST).filter((who) => spoken.filter((l) => l.who === who).every(has)));
  for (const l of spoken) if (ready.has(l.who)) manifest.speech[`${l.who}|${l.text}`] = fileFor(l.who, l.text);
  const partial = Object.keys(CAST).filter((id) => !ready.has(id));
  if (partial.length) console.log(`Ikke komplette (bruker enhetens stemme): ${partial.join(', ')}`);
  for (const n of Object.keys(SFX)) if (existsSync(new URL(`sfx-${n}.mp3`, AUDIO))) manifest.sfx[n] = `sfx-${n}.mp3`;
  await writeFile(new URL('manifest.json', AUDIO), JSON.stringify(manifest, null, 1));
  // Rydd bort replikkfiler som ikke lenger brukes (gamle stemmer eller endret tekst)
  const used = new Set(spoken.map((l) => fileFor(l.who, l.text)));
  for (const f of await readdir(AUDIO)) if (f.endsWith('.mp3') && !f.startsWith('sfx-') && !used.has(f)) await rm(new URL(f, AUDIO));
  console.log(`\nManifest: ${Object.keys(manifest.speech).length} replikker og ${Object.keys(manifest.sfx).length} lydeffekter.`);
}

await mkdir(AUDIO, { recursive: true });
const errors = [];
voices = await ensureVoices();
if (sample) errors.push(...await makeSamples());
else {
  if (wants('speech')) errors.push(...await makeSpeech());
  if (wants('sfx')) errors.push(...await makeSfx());
  await writeManifest();
}
if (aborted) console.error(`\nStoppet på grunn av kontofeil: ${aborted.slice(0, 300)}`);
if (errors.length) { console.error(`${errors.length} feil. Kjør skriptet på nytt for å prøve de manglende igjen.`); process.exit(1); }
