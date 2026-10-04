// Small shared helpers used by every scene.
const U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a = 0, b = 1) => a + Math.random() * (b - a),
  pick: (arr) => arr[(Math.random() * arr.length) | 0],
  dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),

  // Closed smooth curve through points (quadratic curves between midpoints).
  smoothClosedPath(ctx, xs, ys, n) {
    const mx = (a, b) => (xs[a] + xs[b]) / 2;
    const my = (a, b) => (ys[a] + ys[b]) / 2;
    ctx.beginPath();
    ctx.moveTo(mx(n - 1, 0), my(n - 1, 0));
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      ctx.quadraticCurveTo(xs[i], ys[i], mx(i, j), my(i, j));
    }
    ctx.closePath();
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  // Tracks recent pointer positions so a release can be turned into a throw.
  makeTracker() {
    const hist = [];
    return {
      reset() { hist.length = 0; },
      push(x, y) {
        const t = performance.now();
        hist.push({ x, y, t });
        while (hist.length > 2 && t - hist[0].t > 100) hist.shift();
      },
      velocity() {
        if (hist.length < 2) return { vx: 0, vy: 0 };
        const a = hist[0], b = hist[hist.length - 1];
        const dt = Math.max(16, b.t - a.t) / 1000;
        return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
      },
    };
  },
};

// Floating onomatopoeia text ("ぷちっ!") that pops up where things happen.
class FloatTexts {
  constructor() { this.items = []; }
  add(x, y, text, color, size = 18) {
    if (this.items.length > 16) this.items.shift();
    this.items.push({ x, y, text, size: Math.round(size * 0.8), life: 0 });
  }
  update(dt) {
    for (const t of this.items) { t.life += dt; t.y -= 24 * dt; }
    this.items = this.items.filter((t) => t.life < 1.2);
  }
  draw(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.items) {
      const k = t.life / 1.2;
      ctx.globalAlpha = Math.min(1, t.life * 8) * (1 - k * k) * 0.85;
      ctx.font = `500 ${t.size}px "Noto Sans JP", "Hiragino Sans", sans-serif`;
      ctx.fillStyle = '#f2f2f2';
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }
}

// Low-poly, flat-shaded fill of a closed outline: an outer ring of facets plus an
// inner ring and a centre fan, each facet lit by its tilt toward a fixed light.
const LIGHT = (() => { const l = [-0.45, -0.65, 0.62], m = Math.hypot(...l); return l.map((v) => v / m); })();
U.facet = function (ctx, xs, ys, n, cx, cy, rgb, opts = {}) {
  const inner = opts.inner ?? 0.55, alpha = opts.alpha ?? 1, lo = opts.lo ?? 0.28, hi = opts.hi ?? 1.0;
  const ix = new Array(n), iy = new Array(n);
  for (let i = 0; i < n; i++) {
    const j = Math.sin(i * 12.9898) * 0.06;
    ix[i] = cx + (xs[i] - cx) * (inner + j);
    iy[i] = cy + (ys[i] - cy) * (inner + j);
  }
  const tri = (ax, ay, bx, by, qx, qy, tilt, seed) => {
    const mx = (ax + bx + qx) / 3 - cx, my = (ay + by + qy) / 3 - cy, ml = Math.hypot(mx, my) || 1;
    const nx = (mx / ml) * tilt, ny = (my / ml) * tilt, nz = Math.sqrt(Math.max(0, 1 - tilt * tilt));
    const lam = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
    const s = lo + (hi - lo) * lam + Math.sin(seed * 78.233) * 0.035;
    const c = `rgba(${Math.round(rgb[0] * s)},${Math.round(rgb[1] * s)},${Math.round(rgb[2] * s)},${alpha})`;
    ctx.fillStyle = c; ctx.strokeStyle = c;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(qx, qy); ctx.closePath();
    ctx.fill(); if (alpha >= 1) ctx.stroke();
  };
  ctx.save();
  ctx.lineWidth = 0.6; ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const k = (i + 1) % n;
    tri(xs[i], ys[i], xs[k], ys[k], ix[k], iy[k], 0.92, i * 3 + 1);
    tri(xs[i], ys[i], ix[k], iy[k], ix[i], iy[i], 0.8, i * 3 + 2);
    tri(ix[i], iy[i], ix[k], iy[k], cx, cy, 0.4, i * 3 + 3);
  }
  if (opts.edge) {
    ctx.strokeStyle = opts.edge; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < n; i++) i ? ctx.lineTo(xs[i], ys[i]) : ctx.moveTo(xs[i], ys[i]);
    ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
};

// Every k-th point of an outline, for a chunkier low-poly look.
U.decimate = function (xs, ys, n, k) {
  const ox = [], oy = [];
  for (let i = 0; i < n; i += k) { ox.push(xs[i]); oy.push(ys[i]); }
  return [ox, oy];
};

// Shared monochrome palette for scenes.
const INK = { bg: '#0d0d0d', line: '#2c2c2c', mid: '#5a5a5a', soft: '#8c8c8c', hi: '#e8e8e8' };

const SCENES = [];

if (typeof module !== 'undefined') module.exports = { U, FloatTexts, SCENES };
