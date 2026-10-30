import { makeItem, makeBamse } from './models.js';
import { TROLLS, ITEMS } from './trolls.js';
import { START, TRAPP_SPOT } from './house.js';
import { spawnTroll, randomSpot } from './actors.js';
import { burst } from './fx.js';
import { sfx } from './audio.js';
import { store } from './store.js';
import * as ui from './ui.js';
import { KID } from './lines.js';

// En runde er én natt: troll og ting plasseres, og gutten plukker opp det han finner.
export const ROOM_IDS = ['kjokken', 'stue', 'lekerom', 'bad'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

export function createRounds(G) {
  const K = G.kid;

  function spawnItem(id, roomId, avoid) {
    const p = randomSpot(G, roomId, 0.35, avoid, 1.6, 'kid');
    const m = makeItem(id);
    m.group.position.set(p.x, 0, p.z);
    G.scene.add(m.group);
    G.items.push({ id, m, pos: m.group.position, taken: false, phase: Math.random() * 6 });
    avoid.push(p);
  }

  /** Natt 1 har fire troll; hver ny natt kommer det ett til, og flere gjemmer seg. */
  function chooseTrolls(night) {
    const count = Math.min(8, 3 + night);
    const pool = shuffle(Object.keys(TROLLS).filter((id) => id !== 'trapp'));
    while (pool.length < count) pool.push(pick(pool.filter((id) => id !== 'kjempe')));
    return pool.slice(0, count);
  }

  function newRound() {
    for (const t of G.trolls) t.m.group.removeFromParent();
    for (const it of G.items) it.m.group.removeFromParent();
    ui.clearBubbles();
    Object.assign(G, {
      trolls: [], items: [], hearts: 3, stars: 0, inv: [], hasBamse: false, friendsRound: 0,
      follower: null, chase: null, path: null, room: null, hintT: 0,
    });
    K.pos.set(START.x, 0, START.z);
    K.yaw = Math.PI;
    K.rebuild(store.get().hair);
    G.house.blocker.off = false;
    G.rebuildNav();

    const trapp = spawnTroll(G, 'trapp', TRAPP_SPOT.x, TRAPP_SPOT.z, 'gang');
    trapp.state = 'guard';
    trapp.yaw = -Math.PI / 2;
    const avoid = [START, TRAPP_SPOT];
    const rooms = shuffle([...ROOM_IDS, ...ROOM_IDS]);
    const lurkers = Math.min(3, 1 + Math.floor(G.night / 2));
    let lurked = 0;
    chooseTrolls(G.night).forEach((id, i) => {
      const room = rooms[i % rooms.length];
      const p = randomSpot(G, room, 0.42 * TROLLS[id].look.size + 0.1, avoid, 2.5, 'troll');
      const lurk = !TROLLS[id].sleeps && lurked < lurkers;
      if (lurk) lurked++;
      avoid.push(p);
      spawnTroll(G, id, p.x, p.z, room, { lurk });
    });
    spawnItem('bamse', pick(ROOM_IDS), avoid);
    shuffle(['kjeks', 'kjeks', 'banan', 'sokk', 'sokk', 'bil', 'ball']).forEach((id, i) => spawnItem(id, ['gang', ...ROOM_IDS][i % 5], avoid));
    ui.updateHud(G);
  }

  function restock() {
    const avoid = G.items.filter((i) => !i.taken).map((i) => i.pos).concat([K.pos]);
    for (const id of shuffle(Object.keys(ITEMS)).slice(0, 2)) spawnItem(id, pick(ROOM_IDS), avoid);
  }

  function take(it) {
    it.taken = true;
    it.m.group.removeFromParent();
    burst(G.scene, it.pos, 0xffe08a, 14, { speed: 1.6 });
    if (it.id === 'bamse') {
      G.hasBamse = true;
      const b = makeBamse();
      b.scale.setScalar(0.85); b.position.set(0, 0.3, 0.2);
      K.m.body.add(b);
      sfx.win();
      G.kidAnim('dance');
      G.kidSay(KID.bamse);
    } else {
      G.inv.push(it.id);
      sfx.pickup();
      G.kidSay(KID.pickup(it.id));
    }
    ui.updateHud(G);
  }

  function collectItems() {
    for (const it of G.items) {
      if (!it.taken && Math.hypot(it.pos.x - K.pos.x, it.pos.z - K.pos.z) < 0.7) take(it);
    }
    if (!G.inv.length && !G.items.some((i) => !i.taken && i.id !== 'bamse')) restock();
  }

  function animateItems(dt, time) {
    for (const it of G.items) {
      if (it.taken) continue;
      it.m.float.position.y = 0.4 + Math.sin(time * 2.2 + it.phase) * 0.07;
      it.m.float.rotation.y += dt * 1.4;
      // Pappas hint får ringen rundt bamsen til å pulsere
      const pulse = it.id === 'bamse' && G.hintT > 0 ? 1 + Math.abs(Math.sin(time * 6)) * 1.5 : 1;
      it.m.ring.scale.setScalar(pulse);
    }
  }

  return { newRound, collectItems, animateItems };
}
