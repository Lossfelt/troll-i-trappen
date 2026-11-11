// Rask sjekk av at spillet henger sammen, uten nettleser og uten avhengigheter.
// Kjøres av .github/workflows/ci.yml på hver pull request og push til main.
//   node tools/check.mjs
// Sjekker:
//   - at alle JavaScript-filene har gyldig syntaks (node --check)
//   - at JSON-filene kan leses
//   - at alle lydfiler i audio/manifest.json finnes
//   - at relative import-er i js/ peker på filer som finnes
//   - at lokale lenker i index.html og ikonene i manifest.webmanifest finnes
//   - at tools/stamp-version.mjs (brukes ved publisering) finner det den skal i index.html
import { readFile, readdir, mkdtemp, mkdir, cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const fail = (msg) => errors.push(msg);
const rel = (p) => path.relative(ROOT, p);

const jsFiles = [
  ...(await readdir(path.join(ROOT, 'js'))).filter((f) => f.endsWith('.js')).map((f) => path.join(ROOT, 'js', f)),
  ...(await readdir(path.join(ROOT, 'tools'))).filter((f) => f.endsWith('.mjs')).map((f) => path.join(ROOT, 'tools', f)),
  path.join(ROOT, 'serve.mjs'),
];

// 1. Syntaks
for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (e) {
    fail(`Syntaksfeil i ${rel(file)}:\n${e.stderr}`);
  }
}

// 2. JSON
const json = {};
for (const name of ['audio/manifest.json', 'manifest.webmanifest', 'tools/voices.json', 'package.json']) {
  try {
    json[name] = JSON.parse(await readFile(path.join(ROOT, name), 'utf8'));
  } catch (e) {
    fail(`Kan ikke lese ${name}: ${e.message}`);
  }
}

// 3. Lydfiler i manifestet
for (const [section, entries] of Object.entries(json['audio/manifest.json'] ?? {})) {
  for (const [key, file] of Object.entries(entries)) {
    if (!existsSync(path.join(ROOT, 'audio', file))) fail(`audio/manifest.json (${section}) «${key}»: mangler audio/${file}`);
  }
}

// 4. Relative import-er
for (const file of jsFiles.filter((f) => rel(f).startsWith('js'))) {
  const src = await readFile(file, 'utf8');
  for (const m of src.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const target = path.resolve(path.dirname(file), m[1].split('?')[0]);
    if (!existsSync(target)) fail(`${rel(file)}: import «${m[1]}» finnes ikke`);
  }
}

// 5. Lokale lenker i HTML og ikoner i web-manifestet
const html = await readFile(path.join(ROOT, 'index.html'), 'utf8');
for (const m of html.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
  const value = m[1].trim();
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value)) continue;
  const target = path.join(ROOT, value.split('#')[0].split('?')[0]);
  if (!existsSync(target)) fail(`index.html: «${value}» finnes ikke`);
}
const importmap = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
if (!importmap) fail('index.html: fant ikke import-kartet');
else {
  for (const target of Object.values(JSON.parse(importmap[1]).imports ?? {})) {
    if (!existsSync(path.join(ROOT, target.split('?')[0]))) fail(`index.html: import-kartet peker på «${target}», som ikke finnes`);
  }
}
for (const icon of json['manifest.webmanifest']?.icons ?? []) {
  if (!existsSync(path.join(ROOT, icon.src))) fail(`manifest.webmanifest: ikonet «${icon.src}» finnes ikke`);
}

// 6. Versjonsmerkingen ved publisering, kjørt på en kopi så arbeidsmappen ikke endres
const tmp = await mkdtemp(path.join(tmpdir(), 'troll-check-'));
try {
  await mkdir(path.join(tmp, 'tools'));
  await cp(path.join(ROOT, 'index.html'), path.join(tmp, 'index.html'));
  await cp(path.join(ROOT, 'js'), path.join(tmp, 'js'), { recursive: true });
  await cp(path.join(ROOT, 'tools', 'stamp-version.mjs'), path.join(tmp, 'tools', 'stamp-version.mjs'));
  execFileSync(process.execPath, [path.join(tmp, 'tools', 'stamp-version.mjs'), 'ci-test'], { stdio: 'pipe' });
  const stamped = await readFile(path.join(tmp, 'index.html'), 'utf8');
  if (!stamped.includes('js/main.js?v=ci-test')) fail('stamp-version.mjs versjonsmerket ikke main.js');
} catch (e) {
  fail(`stamp-version.mjs feilet: ${e.stderr || e.message}`);
} finally {
  await rm(tmp, { recursive: true, force: true });
}

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'));
  console.error(`\n${errors.length} feil.`);
  process.exit(1);
}
console.log(`OK: ${jsFiles.length} skriptfiler, lydmanifest, import-er, lenker og versjonsmerking er i orden.`);
