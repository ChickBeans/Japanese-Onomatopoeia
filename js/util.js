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
  add(x, y, text, color = '#333', size = 22) {
    if (this.items.length > 24) this.items.shift();
    this.items.push({ x, y, text, color, size, life: 0, rot: U.rand(-0.25, 0.25) });
  }
  update(dt) {
    for (const t of this.items) { t.life += dt; t.y -= 40 * dt; }
    this.items = this.items.filter((t) => t.life < 1.1);
  }
  draw(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.items) {
      const k = t.life / 1.1;
      const pop = t.life < 0.12 ? 0.6 + (t.life / 0.12) * 0.5 : 1.1 - Math.min(0.1, (t.life - 0.12));
      ctx.globalAlpha = 1 - k * k;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rot);
      ctx.scale(pop, pop);
      ctx.font = `800 ${t.size}px "M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", sans-serif`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }
}

const SCENES = [];

if (typeof module !== 'undefined') module.exports = { U, FloatTexts, SCENES };
