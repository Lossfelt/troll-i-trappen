// Animasjon av ett troll: gange, blunking, blikk, hopp og reaksjoner.

const HOP_T = 0.45;

export function startHop(t, delay = 0) { t.hopWait = delay; t.hopQueued = true; }

function hopHeight(t, dt) {
  if (t.hopQueued) {
    t.hopWait -= dt;
    if (t.hopWait <= 0) { t.hopQueued = false; t.hopT = HOP_T; }
  }
  if (t.hopT <= 0) return 0;
  t.hopT -= dt;
  return Math.sin(Math.PI * Math.max(0, 1 - t.hopT / HOP_T)) * 0.4;
}

function react(t, m, time) {
  if (t.react === 'win') {
    m.body.position.y = Math.abs(Math.sin(time * 9)) * 0.3;
    m.armL.rotation.z = -2.6; m.armR.rotation.z = 2.6;
  } else if (t.react === 'lose' || t.react === 'stay') {
    m.body.rotation.z = Math.sin(time * 18) * 0.06;
    m.armL.rotation.x = m.armR.rotation.x = -0.6;
  } else if (t.react === 'chase') {
    m.armL.rotation.z = -2.4; m.armR.rotation.z = 2.4;
    m.body.position.y = Math.abs(Math.sin(time * 12)) * 0.08;
  } else if (t.react === 'meh') {
    m.body.rotation.z = Math.sin(time * 2) * 0.1;
  }
}

/** `look` er hvor langt til siden trollet skal se (-1 til 1), slik at øynene følger gutten. */
export function animateTroll(t, moved, time, dt, look = 0) {
  const m = t.m, walking = moved > 0.0005, size = t.def.look.size;
  const sw = walking ? Math.sin(t.walk) * 0.55 : 0;
  m.legL.rotation.x = sw; m.legR.rotation.x = -sw;
  m.armL.rotation.set(-sw * 0.7, 0, -0.3); m.armR.rotation.set(sw * 0.7, 0, 0.3);
  m.body.position.y = walking ? Math.abs(Math.sin(t.walk)) * 0.035 : Math.sin(time * 2 + t.uid) * 0.02;
  m.body.rotation.set(0, 0, 0);
  m.tail.rotation.z = Math.sin(time * 3 + t.uid) * 0.3;

  const asleep = t.state === 'sleep' && !t.awake;
  const blink = asleep || (time + t.uid * 1.7) % 4 < 0.12 ? 0.12 : 1;
  t.lookX += (look - t.lookX) * Math.min(1, dt * 8);
  const reach = 0.032 * (t.def.look.eyes ?? 1);
  for (const p of m.pupils) { p.scale.y = blink; p.position.x = p.userData.base.x + t.lookX * reach; }
  // Hodene vugger litt hver for seg, så Kjempetrollets tre hoder ser ut til å krangle
  m.heads.forEach((hd, i) => { hd.rotation.z = hd.userData.tilt + Math.sin(time * 1.4 + t.uid + i * 2.1) * (m.heads.length > 1 ? 0.09 : 0.04); });

  if (t.zzz) {
    t.zzz.visible = asleep;
    t.zzz.position.y = t.h + Math.sin(time * 1.5) * 0.1;
  }
  // Sovende troll puster tungt
  m.body.scale.set(size, size * (asleep ? 1 + Math.sin(time * 1.6) * 0.03 : 1), size);
  if (asleep) m.body.rotation.x = 0.12;
  if (t.state === 'chase') { m.armL.rotation.x = -1.3 - sw * 0.3; m.armR.rotation.x = -1.3 + sw * 0.3; }
  if (t.reactT > 0) react(t, m, time);
  m.body.position.y += hopHeight(t, dt);
}
