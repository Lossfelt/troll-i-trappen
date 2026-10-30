import { ITEMS } from './trolls.js';
import { say, sfx, stopSpeech } from './audio.js';
import { store } from './store.js';
import { burst } from './fx.js';
import { makeItem } from './models.js';
import { startChase, startLeave } from './actors.js';
import * as ui from './ui.js';
import { KID, TROLL } from './lines.js';

// Et møte med et troll: replikk, valg, reaksjon og utfall.
const SOUND = { win: 'win', lose: 'laugh', chase: 'troll', meh: 'meh', stay: 'hmm' };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function reaction(def, kind, item) {
  if (kind !== 'deal') return def[kind];
  const d = def.deal;
  if (!item) return d.none;
  const hit = d.wants === 'any' || (d.wants === 'food' ? ITEMS[item].food : d.wants === item);
  return hit ? d.hit : d.miss || d.hit;
}

function shoutText(level) {
  if (level < 0.35) return 'Gå vekk...';
  return level < 0.65 ? 'Gå vekk!' : 'GÅ VEKK, TROLL!!!';
}

export function createEncounters(G) {
  let cur = null, token = 0;

  function start(t) {
    cur = t;
    G.mode = 'encounter'; G.path = null;
    t.state = 'talk'; t.awake = true; t.react = 'chase'; t.reactT = 0.5;
    if (!t.met) { t.met = true; store.mark(t.def.id, 'met'); }
    sfx.troll(); G.shake = 0.3;
    ui.openDialog(t.def, G.portraits[t.def.id]);
    const line = pick(t.def.intro);
    ui.dialogLine(t.def.name, line, 'troll');
    ui.setChoices(mainChoices());
    say(line, t.def.id);
  }

  function mainChoices() {
    const list = [
      { icon: '🏃', label: 'Løp!', act: () => resolve('run') },
      { icon: '🤝', label: 'Forhandle', act: offer },
      { icon: '✋', label: 'Gå vekk!', act: shout },
      { icon: '👋', label: 'Hei, troll!', act: () => resolve('friend') },
    ];
    const f = G.follower;
    if (f && !f.helped && f !== cur) list.push({ icon: '💚', label: `Spør ${f.def.name}`, cls: 'friend', act: askFriend });
    return list;
  }

  function offer() {
    if (!G.inv.length) { resolve('deal', -1); return; }
    ui.setChoices([
      ...G.inv.map((id, i) => ({ icon: ITEMS[id].emoji, label: cap(ITEMS[id].name), act: () => resolve('deal', i) })),
      { icon: '↩️', label: 'Tilbake', act: () => ui.setChoices(mainChoices()) },
    ]);
  }

  // «Gå vekk!» er et lite spill: trykk fort for å rope høyt nok
  async function shout() {
    const my = ++token;
    ui.dialogLine(G.name, 'Trykk fort for å rope høyt!', 'kid');
    const loud = await ui.shoutGame((level) => {
      G.kidAnim('shoo');
      G.shake = Math.max(G.shake, 0.12 * level);
      sfx.shout(level);
      ui.bubble('kid', G.kid.m.group, 1.55, shoutText(level), 1500, level >= 0.65 ? 'kid loud' : 'kid');
    });
    if (my === token) resolve('shoo', -1, loud);
  }

  async function resolve(kind, itemIdx = -1, loud = true) {
    const t = cur, def = t.def, my = ++token;
    ui.setChoices([]);
    const item = itemIdx >= 0 ? G.inv.splice(itemIdx, 1)[0] : null;
    ui.updateHud(G);
    let kidLine = (kind === 'friend' && def.kidFriend) || KID[kind];
    if (kind === 'deal') kidLine = item ? KID.offer(item) : KID.none;
    if (kind === 'shoo' && !loud) kidLine = KID.quietShoo;
    G.kidAnim(kind);
    ui.dialogLine(G.name, kidLine, 'kid');
    await say(kidLine, 'kid');
    if (my !== token) return;

    let [outcome, text] = reaction(def, kind, item);
    if (kind === 'shoo' && !loud && outcome === 'win') [outcome, text] = ['stay', TROLL.shoutFail];
    if (kind === 'friend' && def.friendGate && G.friendsRound >= def.friendGate.count) {
      [outcome, text] = ['win', def.friendGate.text];
    }
    respond(t, outcome, text, my);
  }

  async function askFriend() {
    const t = cur, f = G.follower, my = ++token;
    f.helped = true;
    ui.setChoices([]);
    const ask = KID.askHelp(f.def.id);
    ui.dialogLine(G.name, ask, 'kid');
    await say(ask, 'kid');
    if (my !== token) return;
    const line = pick(TROLL.helpLines);
    ui.dialogLine(f.def.name, line, 'troll');
    G.trollSay(f, line, 3000);
    f.react = 'win'; f.reactT = 1.5;
    await say(line, f.def.id);
    if (my !== token) return;
    respond(t, 'win', TROLL.helpReply, my, true);
  }

  function respond(t, outcome, text, my, helped = false) {
    t.react = outcome; t.reactT = 2.5;
    sfx[SOUND[outcome]]();
    ui.dialogLine(t.def.name, text, 'troll');
    const chase = outcome === 'chase';
    setTimeout(() => {
      if (my !== token) return;
      ui.setChoices([{ icon: chase ? '🏃' : '▶️', label: chase ? 'LØP!' : 'Videre', cls: 'primary', act: () => finish(outcome, helped) }]);
    }, 450);
    say(text, t.def.id);
  }

  function finish(outcome, helped) {
    stopSpeech();
    ui.closeDialog();
    token++;
    const t = cur;
    cur = null;
    apply(t, outcome, helped);
  }

  function celebrate(t) {
    const aw = t.def.afterWin;
    G.kidAnim('dance');
    burst(G.scene, t.pos, 0xffd76a, 26);
    if (!aw) return;
    setTimeout(() => {
      if (t.state === 'gone') return;
      if (aw.sound) sfx[aw.sound]();
      G.trollSay(t, aw.line, 2600, true);
      if (aw.wear) {
        const sock = makeItem(aw.wear).float;
        sock.position.set(0, -0.02, 0.55); sock.rotation.x = -0.7; sock.scale.setScalar(1.3);
        t.m.heads[0].add(sock);
      }
      if (aw.kid) setTimeout(() => G.kidSay(aw.kid), 1300);
    }, 900);
  }

  function apply(t, outcome, helped) {
    const def = t.def;
    G.mode = 'play';
    t.reactT = 0;
    if (outcome === 'chase') { startChase(G, t); return; }
    if (outcome === 'win') {
      t.done = true;
      G.friendsRound++;
      store.mark(def.id, 'friends');
      G.addStar();
      celebrate(t);
      if (def.id === 'trapp') {
        t.state = 'aside';
        G.house.blocker.off = true;
        G.rebuildNav();
      } else if (def.sleeps) {
        t.state = 'sleep'; t.awake = false;
      } else if (helped) {
        startLeave(t, 3.5);
      } else {
        if (G.follower) { G.trollSay(G.follower, TROLL.bye, 2600, true); startLeave(G.follower, 1.4); }
        G.follower = t;
        t.state = 'follow';
      }
    } else if (outcome === 'meh') {
      t.done = true;
      if (def.sleeps) { t.state = 'sleep'; t.awake = false; } else startLeave(t, 1.5);
    } else if (outcome === 'stay' || (outcome === 'lose' && def.id === 'trapp')) {
      t.cooldown = 4;
      t.state = def.id === 'trapp' ? 'guard' : def.sleeps ? 'sleep' : 'idle';
      t.awake = false;
      G.pushKidAway(t);
      if (outcome === 'lose') G.hurt();
    } else if (outcome === 'lose') {
      startLeave(t, 1.2);
      G.hurt();
    }
  }

  return { start, get active() { return cur; } };
}
