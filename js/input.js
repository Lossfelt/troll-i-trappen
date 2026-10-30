// Styrespak nede til høyre, trykk/hold på skjermen for å gå dit, eller piltaster/WASD.

const STICK_RANGE = 48; // hvor langt knotten kan dras, i piksler
const DEAD_ZONE = 0.15;

/** Styrespaken. Returnerer en funksjon som gir retning og fart (mag 0.35–1), eller null. */
function createStick(el) {
  if (!el) return () => null;
  const knob = el.querySelector('i');
  const v = { x: 0, z: 0, active: false };
  const move = (e) => {
    const r = el.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > STICK_RANGE) { dx = (dx / d) * STICK_RANGE; dy = (dy / d) * STICK_RANGE; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    // Kameraet ser rett nordover, så opp på skjermen er -z i verden
    v.x = dx / STICK_RANGE; v.z = dy / STICK_RANGE;
  };
  const release = () => {
    v.active = false; v.x = v.z = 0;
    el.classList.remove('active');
    knob.style.transform = '';
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    v.active = true;
    el.classList.add('active');
    try { el.setPointerCapture(e.pointerId); } catch { /* ignorer */ }
    move(e);
  });
  el.addEventListener('pointermove', (e) => { if (v.active) move(e); });
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  window.addEventListener('blur', release);
  return () => {
    const m = Math.hypot(v.x, v.z);
    if (!v.active || m < DEAD_ZONE) return null;
    return { x: v.x / m, z: v.z / m, mag: 0.35 + 0.65 * Math.min(1, (m - DEAD_ZONE) / (1 - DEAD_ZONE)) };
  };
}
const KEYS = {
  ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd',
  ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r',
};

export function createInput(canvas) {
  const keys = new Set();
  const st = { down: false, x: 0, y: 0, dirty: false };

  canvas.addEventListener('pointerdown', (e) => {
    st.down = true; st.x = e.clientX; st.y = e.clientY; st.dirty = true;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignorer */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!st.down) return;
    st.x = e.clientX; st.y = e.clientY; st.dirty = true;
  });
  const up = () => { st.down = false; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const k = KEYS[e.code];
    if (k) { keys.add(k); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { const k = KEYS[e.code]; if (k) keys.delete(k); });
  window.addEventListener('blur', () => keys.clear());

  st.stickDir = createStick(document.getElementById('stick'));

  st.keyDir = () => {
    const x = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0);
    const z = (keys.has('d') ? 1 : 0) - (keys.has('u') ? 1 : 0);
    if (!x && !z) return null;
    const l = Math.hypot(x, z);
    return { x: x / l, z: z / l };
  };
  return st;
}
