// Prøver varianter (stemme, tagg, modell) for figurer som ikke låter norsk nok.
//   node tools/voice-variants.mjs   og åpne http://localhost:5173/tools/varianter.html
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { KID } from '../js/lines.js';
import { TROLLS } from '../js/trolls.js';

const ROOT = new URL('../', import.meta.url);
const OUT = new URL('tools/voice-previews/', ROOT);
const env = await readFile(new URL('.env', ROOT), 'utf8');
const KEY = env.match(/^\s*ELEVENLABS_API_KEY\s*=\s*["']?([^"'\r\n]+)/m)[1].trim();
const saved = JSON.parse(await readFile(new URL('tools/voices.json', ROOT), 'utf8'));

// [figur, etikett, stemme-id, tagg, modell]
const VARIANTS = [
  ['kid', 'Mia, uten tagg, v3', saved.kid.voice, '', 'eleven_v3'],
  ['kid', 'Mia, v4', saved.kid.voice, '', 'eleven_v4'],
  ['kid', 'Ingrid, [excited], v3', 'pbb4nvdETnNfQljwVeaL', '[excited]', 'eleven_v3'],
  ['kid', 'Celine, [excited], v3', 'k5IgYJw2jfo6mO5HhagG', '[excited]', 'eleven_v3'],
  ['trapp', 'Robert, uten tagg, v3', saved.trapp.voice, '', 'eleven_v3'],
  ['trapp', 'Robert, v4', saved.trapp.voice, '', 'eleven_v4'],
  ['trapp', 'Terje, [gruffly], v3', 'ikwOHnCcqQJgOoz5Wxex', '[gruffly]', 'eleven_v3'],
  ['trapp', 'Haldor, [gruffly], v3', 'GC1txXxPYDcfgO0KfuXm', '[gruffly]', 'eleven_v3'],
  ['sokk', 'Johannes, uten tagg, v3', saved.sokk.voice, '', 'eleven_v3'],
  ['sokk', 'Johannes, v4', saved.sokk.voice, '', 'eleven_v4'],
  ['sokk', 'Martin, [excitedly], v3', '9pRpxWU0T7UFt2oEMH6n', '[excitedly]', 'eleven_v3'],
  ['sokk', 'Erik, [excitedly], v3', 'EpYEY8MWJrUGskHBoNMA', '[excitedly]', 'eleven_v3'],
];
const TEXT = { kid: KID.start, trapp: TROLLS.trapp.intro[0], sokk: TROLLS.sokk.intro[0] };

async function tts(voice, text, model) {
  for (const body of [{ text, model_id: model, language_code: 'no' }, { text, model_id: model }]) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
      method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (res.ok) return { audio: Buffer.from(await res.arrayBuffer()), lang: !!body.language_code };
    const err = `${res.status}: ${(await res.text()).slice(0, 200)}`;
    if (!body.language_code || !/^4(00|22)/.test(err)) throw new Error(err);
  }
}

await mkdir(OUT, { recursive: true });
const rows = [];
for (const [i, [who, label, voice, tag, model]] of VARIANTS.entries()) {
  try {
    const { audio, lang } = await tts(voice, `${tag} ${TEXT[who]}`.trim(), model);
    await writeFile(new URL(`variant-${i}.mp3`, OUT), audio);
    rows.push({ who, label: label + (lang ? '' : ' (uten språkkode)'), file: `variant-${i}.mp3` });
    console.log('ok ', who, label, lang ? '' : '(uten språkkode)');
  } catch (e) {
    rows.push({ who, label, error: e.message });
    console.log('FEIL', who, label, e.message);
  }
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Stemmevarianter</title>
<style>
  body { font: 16px/1.4 system-ui, sans-serif; margin: 0; padding: 20px max(16px, env(safe-area-inset-left)); background: #141b2b; color: #fff3d9; }
  h1 { color: #e3a93c; margin: 0 0 4px; } h2 { color: #e3a93c; margin: 22px 0 4px; } p { color: #cfc6ad; margin: 0 0 8px; }
  .v { display: grid; gap: 4px; padding: 8px 0; } .v small { color: #a7c86c; } audio { width: 100%; max-width: 460px; }
</style>
<h1>Stemmevarianter</h1>
${Object.keys(TEXT).map((who) => `<h2>${who}</h2><p>«${esc(TEXT[who])}»</p>
${rows.filter((r) => r.who === who).map((r, n) => `<div class="v"><small>${n + 1}. ${esc(r.label)}</small>${r.file ? `<audio controls preload="none" src="voice-previews/${r.file}"></audio>` : `<span>${esc(r.error)}</span>`}</div>`).join('')}`).join('')}`;
await writeFile(new URL('tools/varianter.html', ROOT), html);
console.log('Skrev tools/varianter.html');
