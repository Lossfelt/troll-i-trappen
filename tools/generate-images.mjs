// Lager app-ikon og delingsbilde med OpenAI sitt bilde-API. Originalene lagres i tools/image-originals/;
// skaler dem med tools/resize-images.ps1 til filene i icons/.
//   node tools/generate-images.mjs            lag begge
//   node tools/generate-images.mjs icon       bare ikonet (icon | share)
import { writeFile, mkdir } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const OUT = new URL('tools/image-originals/', ROOT);
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) throw new Error('OPENAI_API_KEY mangler i miljøet.');
const MODELS = (process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-flare,gpt-image-2.5-sunburst,gpt-image-1').split(',');

const STYLE = 'Cute, cozy children\'s storybook style like a soft 3D toy render with simple rounded shapes and gentle toon shading. '
  + 'Friendly and funny, never scary; made for a three-year-old. Warm evening light. Palette: deep spruce green (#203328), '
  + 'warm ochre (#e3a93c), lingonberry red (#c7432e), moss green, cream.';

const IMAGES = {
  icon: {
    size: '1024x1024',
    prompt: 'App icon. A friendly Norwegian fairy-tale troll face peeking up over a wooden stair step: big round nose, '
      + 'big kind eyes, mossy brown hair with a tiny pine tree growing on top, small pointy ears. Centered, filling about '
      + '70% of the square, on a plain deep spruce green background. Bold simple shapes that read well at tiny sizes. '
      + 'No text, no border, no rounded corners. ' + STYLE,
  },
  share: {
    size: '1536x864',
    prompt: 'Wide illustration for a link preview of a children\'s game called "Troll i trappen". A cozy Norwegian home at '
      + 'night: a small boy in blue pyjamas with yellow stars, holding a teddy bear, stands at the bottom of a wooden '
      + 'staircase. On the stairs sits a big, friendly, slightly grumpy troll with a long nose, a beard and a tiny pine tree '
      + 'on its head, holding out its hand as if asking for a toll. A small shy troll peeks out from behind a sofa. '
      + 'The title text "Troll i trappen" in big, chunky, playful ochre letters with a dark outline in the upper left. '
      + 'Spell the title exactly: Troll i trappen. ' + STYLE,
  },
};

async function generate(name, { size, prompt }) {
  for (const model of MODELS) {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, size, quality: 'high', output_format: 'png', n: 1 }),
    });
    const text = await res.text();
    if (res.ok) {
      const file = new URL(`${name}.png`, OUT);
      await writeFile(file, Buffer.from(JSON.parse(text).data[0].b64_json, 'base64'));
      console.log(`${name}: laget med ${model}`);
      return;
    }
    console.warn(`${name}: ${model} ga ${res.status}: ${text.slice(0, 200)}`);
    if (res.status !== 404 && !/model/i.test(text)) throw new Error(`Stopper: ${text.slice(0, 300)}`);
  }
  throw new Error(`${name}: ingen modell virket`);
}

await mkdir(OUT, { recursive: true });
const wanted = process.argv[2] ? [process.argv[2]] : Object.keys(IMAGES);
for (const name of wanted) await generate(name, IMAGES[name]);
