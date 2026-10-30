// Kollisjon mot aksejusterte bokser og stifinning (A*) på et rutenett.
// En boks har { minX, maxX, minZ, maxZ, kid, troll, wall?, off? }.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function circleHitsBox(x, z, r, b) {
  const dx = x - clamp(x, b.minX, b.maxX);
  const dz = z - clamp(z, b.minZ, b.maxZ);
  return dx * dx + dz * dz < r * r;
}

export function circleFree(boxes, x, z, r, who) {
  return !boxes.some((b) => b[who] && !b.off && circleHitsBox(x, z, r, b));
}

/** Skyver en sirkel (p.x, p.z) ut av alle bokser som gjelder `who`. */
export function collideCircle(p, r, boxes, who) {
  for (let iter = 0; iter < 2; iter++) {
    for (const b of boxes) {
      if (!b[who] || b.off) continue;
      const cx = clamp(p.x, b.minX, b.maxX), cz = clamp(p.z, b.minZ, b.maxZ);
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2), push = (r - d) / d;
        p.x += dx * push; p.z += dz * push;
      } else {
        const l = p.x - b.minX, rr = b.maxX - p.x, t = p.z - b.minZ, bt = b.maxZ - p.z;
        const m = Math.min(l, rr, t, bt);
        if (m === l) p.x = b.minX - r; else if (m === rr) p.x = b.maxX + r;
        else if (m === t) p.z = b.minZ - r; else p.z = b.maxZ + r;
      }
    }
  }
}

function segHitsBox(ax, az, bx, bz, b) {
  let t0 = 0, t1 = 1;
  for (const [a, d, min, max] of [[ax, bx - ax, b.minX, b.maxX], [az, bz - az, b.minZ, b.maxZ]]) {
    if (Math.abs(d) < 1e-9) { if (a < min || a > max) return false; continue; }
    let ta = (min - a) / d, tb = (max - a) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

export function segmentHitsWall(boxes, ax, az, bx, bz) {
  return boxes.some((b) => b.wall && segHitsBox(ax, az, bx, bz, b));
}

class MinHeap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(key, pri) {
    const a = this.k, b = this.p;
    let i = a.length;
    a.push(key); b.push(pri);
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (b[par] <= pri) break;
      a[i] = a[par]; b[i] = b[par]; i = par;
    }
    a[i] = key; b[i] = pri;
  }
  pop() {
    const a = this.k, b = this.p, top = a[0];
    const lk = a.pop(), lp = b.pop();
    if (a.length) {
      let i = 0;
      const n = a.length;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i, mp = lp;
        if (l < n && b[l] < mp) { m = l; mp = b[l]; }
        if (r < n && b[r] < mp) { m = r; }
        if (m === i) break;
        a[i] = a[m]; b[i] = b[m]; i = m;
      }
      a[i] = lk; b[i] = lp;
    }
    return top;
  }
}

export class NavGrid {
  constructor(bounds, cell) {
    this.x0 = bounds.minX; this.z0 = bounds.minZ; this.cell = cell;
    this.w = Math.ceil((bounds.maxX - bounds.minX) / cell);
    this.h = Math.ceil((bounds.maxZ - bounds.minZ) / cell);
    this.blocked = new Uint8Array(this.w * this.h);
  }

  build(boxes, r, who) {
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        const { x, z } = this.center(i, j);
        this.blocked[j * this.w + i] = circleFree(boxes, x, z, r, who) ? 0 : 1;
      }
    }
  }

  free(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h && !this.blocked[j * this.w + i]; }
  center(i, j) { return { x: this.x0 + (i + 0.5) * this.cell, z: this.z0 + (j + 0.5) * this.cell }; }
  cellOf(x, z) {
    return [
      clamp(Math.floor((x - this.x0) / this.cell), 0, this.w - 1),
      clamp(Math.floor((z - this.z0) / this.cell), 0, this.h - 1),
    ];
  }

  nearestFree(i, j) {
    if (this.free(i, j)) return [i, j];
    for (let r = 1; r < 15; r++) {
      let best = null, bd = Infinity;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !this.free(i + di, j + dj)) continue;
          const d = di * di + dj * dj;
          if (d < bd) { bd = d; best = [i + di, j + dj]; }
        }
      }
      if (best) return best;
    }
    return null;
  }

  lineFree(a, b) {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (this.cell * 0.4));
    for (let s = 0; s <= n; s++) {
      const t = n ? s / n : 0;
      if (!this.free(...this.cellOf(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t))) return false;
    }
    return true;
  }

  /** Returnerer en glattet liste med punkter fra `from` til `to`, eller null. */
  path(from, to) {
    const s = this.nearestFree(...this.cellOf(from.x, from.z));
    const g = this.nearestFree(...this.cellOf(to.x, to.z));
    if (!s || !g) return null;
    const goalPt = this.free(...this.cellOf(to.x, to.z)) ? { x: to.x, z: to.z } : this.center(...g);
    const W = this.w, N = W * this.h, start = s[1] * W + s[0], goal = g[1] * W + g[0];
    const cost = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heur = (k) => {
      const dx = Math.abs((k % W) - g[0]), dz = Math.abs(((k / W) | 0) - g[1]);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    const heap = new MinHeap();
    cost[start] = 0; heap.push(start, 0);
    while (heap.size) {
      const k = heap.pop();
      if (k === goal) break;
      if (closed[k]) continue;
      closed[k] = 1;
      const i = k % W, j = (k / W) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if ((!di && !dj) || !this.free(i + di, j + dj)) continue;
          if (di && dj && (!this.free(i + di, j) || !this.free(i, j + dj))) continue;
          const nk = (j + dj) * W + i + di, c = cost[k] + (di && dj ? 1.414 : 1);
          if (c < cost[nk]) { cost[nk] = c; came[nk] = k; heap.push(nk, c + heur(nk)); }
        }
      }
    }
    if (start !== goal && came[goal] < 0) return null;
    const cells = [];
    for (let k = goal; k !== start && k >= 0; k = came[k]) cells.push(k);
    cells.reverse();
    const pts = [{ x: from.x, z: from.z }, ...cells.slice(0, -1).map((k) => this.center(k % W, (k / W) | 0)), goalPt];
    const out = [];
    for (let a = 0; a < pts.length - 1;) {
      let b = pts.length - 1;
      while (b > a + 1 && !this.lineFree(pts[a], pts[b])) b--;
      out.push(pts[b]); a = b;
    }
    return out;
  }
}
