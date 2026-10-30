// Henter norske stemmer fra ElevenLabs sitt stemmebibliotek og lager en lytteside.
// Lytting bruker bibliotekets egne prøver og koster ingen kreditter.
//   node tools/find-voices.mjs   og åpne http://localhost:5173/tools/norske-stemmer.html
import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);

async function loadKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  const env = await readFile(new URL('.env', ROOT), 'utf8');
  return env.match(/^\s*ELEVENLABS_API_KEY\s*=\s*["']?([^"'\r\n]+)/m)[1].trim();
}
const KEY = await loadKey();

const voices = [];
for (let page = 0; page < 5; page++) {
  const q = new URLSearchParams({ language: 'no', page_size: '100', page: String(page), sort: 'cloned_by_count' });
  const res = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${q}`, { headers: { 'xi-api-key': KEY } });
  if (!res.ok) throw new Error(`Søk ga ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  voices.push(...j.voices);
  if (!j.has_more) break;
}

const slim = voices.map((v) => ({
  id: v.voice_id, owner: v.public_owner_id, name: v.name, gender: v.gender, age: v.age, accent: v.accent,
  descriptive: v.descriptive, use: v.use_case, locale: v.locale, clones: v.cloned_by_count,
  description: (v.description || '').slice(0, 300), preview: v.preview_url,
}));
await writeFile(new URL('tools/library-no.json', ROOT), JSON.stringify(slim, null, 1));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Norske stemmer</title>
<style>
  body { font: 15px/1.4 system-ui, sans-serif; margin: 0; padding: 20px max(16px, env(safe-area-inset-left)); background: #141b2b; color: #fff3d9; }
  h1 { color: #e3a93c; margin: 0 0 4px; } p.lead { color: #cfc6ad; }
  .v { display: grid; gap: 4px; padding: 12px 0; border-top: 1px solid #2c4636; }
  .v b { color: #e3a93c; } .meta { color: #a7c86c; font-size: .85rem; } .d { color: #cfc6ad; font-size: .85rem; }
  audio { width: 100%; max-width: 420px; } code { color: #9fc4ff; }
</style>
<h1>Norske stemmer i ElevenLabs-biblioteket</h1>
<p class="lead">${slim.length} stemmer, mest brukte først. Prøvene er bibliotekets egne.</p>
${slim.map((v) => `<div class="v"><b>${esc(v.name)}</b>
<span class="meta">${esc([v.gender, v.age, v.accent, v.descriptive, v.use, v.locale].filter(Boolean).join(' · '))} · brukt av ${v.clones}</span>
<span class="d">${esc(v.description)}</span>
${v.preview ? `<audio controls preload="none" src="${esc(v.preview)}"></audio>` : ''}
<code>${esc(v.id)}</code></div>`).join('\n')}`;
await writeFile(new URL('tools/norske-stemmer.html', ROOT), html);
console.log(`Fant ${slim.length} norske stemmer. Skrev tools/norske-stemmer.html og tools/library-no.json`);
