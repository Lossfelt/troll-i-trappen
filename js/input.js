// Trykk/hold på skjermen for å gå dit, eller piltaster/WASD.
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

  st.keyDir = () => {
    const x = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0);
    const z = (keys.has('d') ? 1 : 0) - (keys.has('u') ? 1 : 0);
    if (!x && !z) return null;
    const l = Math.hypot(x, z);
    return { x: x / l, z: z / l };
  };
  return st;
}
