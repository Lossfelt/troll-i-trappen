// Gir alle JavaScript-modulene et versjonsnummer i index.html før publisering.
// GitHub Pages lar nettlesere bufre filer i 10 minutter, og uten dette kan en telefon få ny
// index.html sammen med gamle moduler. Kjøres av .github/workflows/pages.yml med commit-ID-en.
//   node tools/stamp-version.mjs <versjon>
import { readFile, writeFile, readdir } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const version = (process.argv[2] || Date.now().toString(36)).slice(0, 12);
const file = new URL('index.html', ROOT);
let html = await readFile(file, 'utf8');

// Import-kartet kan peke relative modul-URL-er til versjonerte URL-er, også for import inne i modulene
const imports = { three: './vendor/three/three.module.min.js' };
for (const f of (await readdir(new URL('js/', ROOT))).filter((n) => n.endsWith('.js')).sort()) {
  imports[`./js/${f}`] = `./js/${f}?v=${version}`;
}
const map = `<script type="importmap">\n  ${JSON.stringify({ imports }, null, 2).replace(/\n/g, '\n  ')}\n</script>`;

const before = html;
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, map);
html = html.replace(/<script type="module" src="js\/main\.js[^"]*"><\/script>/, `<script type="module" src="js/main.js?v=${version}"></script>`);
if (html === before) throw new Error('Fant ikke import-kartet eller main.js i index.html');
await writeFile(file, html);
console.log(`Versjonsmerket ${Object.keys(imports).length - 1} moduler med v=${version}`);
