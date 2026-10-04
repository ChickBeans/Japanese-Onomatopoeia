// もちもち — a rice cake stuck to the board: pinch it and it stretches, then slowly comes back.
SCENES.push({
  id: 'mochimochi', kana: 'もちもち', kata: 'モチモチ', romaji: 'mochi-mochi', emoji: '🍡',
  act: { ja: 'もちをつまんで引っぱってみよう', en: 'Pinch the mochi and pull.' },
  cue: (s) => { const b = s.body; let t = 0; for (let i = 0; i < b.n; i++) if (b.y[i] < b.y[t]) t = i; return { x: b.x[t] + 20, y: b.y[t] + 6, x2: b.x[t] + 70, y2: b.y[t] - s.R * 1.6 }; },
  color: '#f3e3c7', accent: '#c48a3a',
  create: (w, h) => new MochiScene(w, h),
});

class MochiScene {
  constructor(w, h) {
    this.t = 0;
    this.texts = new FloatTexts();
    this.grab = null;
    this.resize(w, h);
    this.actions = [{ label: '↺ Reset', fn: () => this.build() }];
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.floor = Math.round(h * 0.78);
    this.build();
  }

  build() {
    const { w, floor } = this;
    const R = U.clamp(Math.min(w, this.h) * 0.2, 60, 150);
    const N = 36, xs = [], ys = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      // daifuku shape: round top, flatter bottom
      const sy = Math.sin(a) > 0 ? 0.62 : 0.9;
      xs.push(w / 2 + Math.cos(a) * R * 1.18);
      ys.push(floor - R * 0.62 + Math.sin(a) * R * sy);
    }
    this.R = R;
    this.body = new SoftBody(xs, ys, {
      shape: 0.0012, ring: 0.3, area: 0.4, damp: 0.93, gravity: 1200, iters: 4, plastic: 20, recover: 1.5,
    });
    this.restX = Float32Array.from(xs);
    this.restY = Float32Array.from(ys);
    this.base = [];
    for (let i = 0; i < N; i++) if (ys[i] > floor - R * 0.2) this.base.push(i);
    this.body.onConstrain = (b) => this.constrain(b);
    this.grab = null;
  }

  constrain(b) {
    const { floor, w } = this;
    for (const i of this.base) {
      b.qx[i] += (this.restX[i] - b.qx[i]) * 0.9;
      b.qy[i] += (this.restY[i] - b.qy[i]) * 0.9;
    }
    const g = this.grab;
    if (g) {
      for (const p of g.pts) {
        b.qx[p.i] += (g.x + p.ox - b.qx[p.i]) * p.w * 0.5;
        b.qy[p.i] += (g.y + p.oy - b.qy[p.i]) * p.w * 0.5;
      }
    }
    for (let i = 0; i < b.n; i++) {
      if (b.qy[i] > floor) { b.qy[i] = floor; b.qx[i] = b.x[i] + (b.qx[i] - b.x[i]) * 0.4; }
      b.qx[i] = U.clamp(b.qx[i], 4, w - 4);
      if (b.qy[i] < 4) b.qy[i] = 4;
    }
  }

  down(p) {
    const b = this.body;
    const near = b.nearest(p.x, p.y);
    if (near.d > 60 && !b.contains(p.x, p.y)) return;
    const pts = [];
    for (let k = -6; k <= 6; k++) {
      const i = (near.i + k + b.n) % b.n;
      if (this.base.includes(i)) continue;
      const wgt = Math.exp(-((k / 3) ** 2));
      pts.push({ i, w: wgt, ox: (b.x[i] - p.x) * 0.5, oy: (b.y[i] - p.y) * 0.5 });
    }
    if (!pts.length) return;
    this.grab = { x: p.x, y: p.y, x0: p.x, y0: p.y, t0: performance.now(), moved: false, pts, said: false };
    Sound.noise({ dur: 0.12, type: 'lowpass', freq: 400, gain: 0.12 });
  }

  move(p) {
    const g = this.grab;
    if (!g || !p.pressed) return;
    g.x = p.x; g.y = p.y;
    const d = U.dist(p.x, p.y, g.x0, g.y0);
    if (d > 10) g.moved = true;
    if (d > this.R * 1.2 && !g.said) {
      g.said = true;
      this.texts.add(p.x, p.y - 30, U.pick(['のびーる', 'びよーん', 'もちーっ']), '#b07020');
      Sound.tone({ freq: 140, freqEnd: 260, dur: 0.5, type: 'triangle', gain: 0.07, attack: 0.1 });
    }
  }

  up(p) {
    const g = this.grab;
    if (!g) return;
    this.grab = null;
    const b = this.body, c = b.centroid();
    if (!g.moved && performance.now() - g.t0 < 300) {
      // poke: press a dent that comes back slowly
      for (let i = 0; i < b.n; i++) {
        if (this.base.includes(i)) continue;
        const d = U.dist(b.x[i], b.y[i], g.x, g.y);
        const f = Math.max(0, 1 - d / (this.R * 0.7));
        if (f <= 0) continue;
        const dx = c.x - b.x[i], dy = c.y - b.y[i], l = Math.hypot(dx, dy) || 1;
        b.x[i] += (dx / l) * 26 * f; b.y[i] += (dy / l) * 26 * f;
        b.vx[i] = 0; b.vy[i] = 0;
      }
      this.texts.add(g.x, g.y - 30, U.pick(['もちっ', 'むにっ', 'ぷにっ']), '#b07020');
      Sound.tone({ freq: 180, freqEnd: 110, dur: 0.18, gain: 0.22 });
      Sound.noise({ dur: 0.08, type: 'lowpass', freq: 500, gain: 0.08 });
      Sound.vibrate(10);
    } else {
      this.texts.add(g.x, g.y - 30, U.pick(['もちもち', 'ぷるん', 'もちーん']), '#b07020');
      Sound.tone({ freq: 240, freqEnd: 120, dur: 0.3, gain: 0.2 });
      Sound.vibrate(15);
    }
  }

  update(dt) {
    this.t += dt;
    const S = 4;
    for (let i = 0; i < S; i++) this.body.step(dt / S);
    this.texts.update(dt);
  }

  draw(ctx) {
    const { w, h, floor } = this, b = this.body;
    ctx.fillStyle = INK.bg; ctx.fillRect(0, 0, w, h);
    // board
    ctx.fillStyle = '#161616'; ctx.fillRect(0, floor, w, h - floor);
    ctx.strokeStyle = INK.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, floor + 0.5); ctx.lineTo(w, floor + 0.5); ctx.stroke();

    const c = b.centroid();
    const [xs, ys] = U.decimate(b.x, b.y, b.n, 2);
    U.facet(ctx, xs, ys, xs.length, c.x - this.R * 0.1, c.y - this.R * 0.15, [240, 238, 232], { lo: 0.58, inner: 0.6 });

    if (this.grab) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(this.grab.x, this.grab.y, 14, 0, Math.PI * 2); ctx.stroke();
    }
    this.texts.draw(ctx);
  }
}
