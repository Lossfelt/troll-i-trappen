import { TROLLS, ITEMS } from './trolls.js';

// Alt som leses høyt utenom trollenes egne replikker i trolls.js.
// Lydskriptet (tools/generate-audio.mjs) bruker allSpoken() for å vite hva som skal lages.
// Talerne er 'kid', 'pappa' eller en trolltype-id.

const cap = (s) => s[0].toUpperCase() + s.slice(1);

export const KID = {
  run: 'Aaaah! Løp!',
  shoo: 'GÅ VEKK, TROLL!',
  quietShoo: 'Gå... vekk...?',
  friend: 'Hei, troll!',
  none: 'Jeg har ingenting...',
  offer: (item) => `Vil du ha ${ITEMS[item].en}?`,
  pickup: (item) => `${cap(ITEMS[item].en)}! Den tar jeg med.`,
  askHelp: (trollId) => `${TROLLS[trollId].name}, kan du hjelpe meg?`,
  bamse: 'Bamse! Der er du jo! Nå skal vi opp trappen og legge oss.',
  stairs: 'Å nei, bamsen! Jeg må finne bamsen først.',
  chase: 'Løp, løp, løp!',
  boo: 'Aaah! Et troll!',
  start: 'Pappa sier det er leggetid. Men hvor er bamsen min?',
  again: 'En gang til! Jeg er modig!',
  nextNight: 'En ny natt! Hvor er bamsen nå?',
  callPappa: 'PAPPAAA!',
  sample: 'Hei! Jeg er ikke redd for troll!',
};

export const QUIPS = ['Hallo? Er det noen troll her?', 'Hm... det er litt mørkt her.', 'Bamse? Hvor er du?', 'Jeg er ikke redd. Nesten ikke.'];

export const TROLL = {
  boo: 'BØ!',
  bye: 'Ha det! Lykke til!',
  shoutFail: 'Hæ? Sa du noe? Du må rope HØYERE!',
  helpReply: 'Er han vennen din? Da er vi venner også!',
  helpLines: ['Hei! Han her er vennen min. Vær snill med ham!', 'Psst! Han er skikkelig grei, altså.', 'Han deler kjeksen sin! Han er snill!'],
  sample: 'Hvem er det som tramper i min trapp?',
};

export const WHERE = { kjokken: 'på kjøkkenet', stue: 'i stua', lekerom: 'på lekerommet', bad: 'på badet', gang: 'i gangen' };

export const PAPPA = {
  where: (roomId) => `Jeg tror bamsen er ${WHERE[roomId] || 'et sted i huset'}!`,
  done: 'Kom opp trappen, så leser vi en bok!',
  hide: (zoneName) => `Trollet fikk ikke plass ${zoneName}! Smart!`,
  win: 'God natt! Du fant bamsen og kom deg helt opp trappen til senga. Trollene får vente til i morgen.',
  lose: 'Pappa kom med en kjempeklem, og vips, så var alle trollene borte.',
};

export const HIDE_ZONES = ['under bordet', 'i teltet'];

/** Alle replikker som kan bli lest høyt, som { who, text }. */
export function allSpoken() {
  const out = [];
  const add = (who, text) => { if (text) out.push({ who, text }); };
  const helpers = Object.keys(TROLLS).filter((id) => id !== 'trapp');

  for (const t of Object.values(KID)) if (typeof t === 'string') add('kid', t);
  for (const id of Object.keys(ITEMS)) { add('kid', KID.offer(id)); add('kid', KID.pickup(id)); }
  for (const id of helpers) add('kid', KID.askHelp(id));
  QUIPS.forEach((q) => add('kid', q));

  for (const [id, def] of Object.entries(TROLLS)) {
    def.intro.forEach((l) => add(id, l));
    for (const k of ['run', 'shoo', 'friend']) add(id, def[k][1]);
    for (const k of ['hit', 'miss', 'none']) add(id, def.deal[k]?.[1]);
    add(id, def.friendGate?.text);
    add(id, def.afterWin?.line);
    add('kid', def.afterWin?.kid);
    add('kid', def.kidFriend);
    add(id, def.chase?.caught);
    add('pappa', def.chase?.escape);
    add(id, TROLL.helpReply);
    if (def.shoo[0] === 'win') add(id, TROLL.shoutFail);
  }
  for (const id of helpers) {
    if (!TROLLS[id].sleeps) { add(id, TROLL.boo); add(id, TROLL.bye); }
    TROLL.helpLines.forEach((l) => add(id, l));
  }
  add('trapp', TROLL.sample);

  Object.keys(WHERE).forEach((r) => add('pappa', PAPPA.where(r)));
  for (const k of ['done', 'win', 'lose']) add('pappa', PAPPA[k]);
  HIDE_ZONES.forEach((z) => add('pappa', PAPPA.hide(z)));

  const seen = new Set();
  return out.filter((l) => { const key = `${l.who}|${l.text}`; return !seen.has(key) && seen.add(key); });
}
