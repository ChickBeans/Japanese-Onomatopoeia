// ぷるぷる — a custard pudding on a plate that wobbles when you poke it or shake the plate.
SCENES.push({
  id: 'purupuru', kana: 'ぷるぷる', kata: 'プルプル', romaji: 'puru-puru', emoji: '🍮',
  act: { ja: 'プリンをつついたり、お皿をゆらしてみよう', en: 'Poke the pudding, or shake the plate.' },
  cue: (s) => { const b = s.body, i = s.topCenter; return { x: b.x[i] + s.R * 0.4, y: b.y[i] + s.R * 0.5 }; },
  color: '#ffe08a', accent: '#d48a10',
  create: (w, h) => new PuruScene(w, h),
});

class PuruScene {
  constructor(w, h) {
    this.t = 0;
    this.texts = new FloatTexts();
    this.resize(w, h);
    this.actions = [{ label: '↺ Reset', fn: () => this.build() }];
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.build();
  }

  build() {
    const { w, h } = this;
    const R = U.clamp(Math.min(w, h) * 0.2, 60, 140);
    this.R = R;
    this.plate = { x: w / 2, y: Math.round(h * 0.72), tx: w / 2, ty: Math.round(h * 0.72), vx: 0, vy: 0, rest: Math.round(h * 0.72) };
    const Wb = R * 2.2, Wt = R * 1.55, H = R * 1.45;
    // outline of the pudding (relative to plate centre), sampled evenly
    const corners = [[-Wt / 2, -H], [Wt / 2, -H], [Wb / 2, 0], [-Wb / 2, 0]];
    let per = 0;
    const segs = corners.map((c, i) => {
      const d = corners[(i + 1) % 4];
      const l = Math.hypot(d[0] - c[0], d[1] - c[1]);
      per += l;
      return { c, d, l };
    });
    const N = 56, xs = [], ys = [], relX = [], relY = [];
    for (let k = 0; k < N; k++) {
      let s = (k / N) * per;
      for (const sg of segs) {
        if (s <= sg.l) {
          const t = s / sg.l;
          relX.push(sg.c[0] + (sg.d[0] - sg.c[0]) * t);
          relY.push(sg.c[1] + (sg.d[1] - sg.c[1]) * t);
          break;
        }
        s -= sg.l;
      }
    }
    for (let i = 0; i < N; i++) { xs.push(this.plate.x + relX[i]); ys.push(this.plate.y + relY[i]); }
    this.relX = relX; this.relY = relY; this.H = H;
    this.body = new SoftBody(xs, ys, { shape: 0.03, ring: 0.25, area: 0.6, damp: 0.9985, gravity: 1200, iters: 2 });
    this.base = [];
    this.topIdx = [];
    for (let i = 0; i < N; i++) {
      if (relY[i] > -1) this.base.push(i);
      if (relY[i] < -H * 0.72) this.topIdx.push(i);
    }
    this.topCenter = 0;
    let best = Infinity;
    for (let i = 0; i < N; i++) {
      const s = Math.abs(relX[i]) + Math.abs(relY[i] + H) * 3;
      if (s < best) { best = s; this.topCenter = i; }
    }
    this.body.onConstrain = (b) => this.constrain(b);
    this.grab = null;
  }

  constrain(b) {
    const pl = this.plate;
    for (const i of this.base) { b.qx[i] = pl.x + this.relX[i]; b.qy[i] = pl.y; }
    const g = this.grab;
    if (g && g.kind === 'body') {
      for (const p of g.pts) {
        b.qx[p.i] += (g.x + p.ox - b.qx[p.i]) * p.w * 0.35;
        b.qy[p.i] += (g.y + p.oy - b.qy[p.i]) * p.w * 0.35;
      }
    }
    for (let i = 0; i < b.n; i++) if (b.qy[i] > pl.y + 2) b.qy[i] = pl.y + 2;
  }

  down(p) {
    const pl = this.plate, b = this.body;
    if (Math.abs(p.y - pl.y) < 34 && Math.abs(p.x - pl.x) < this.R * 1.9 && !b.contains(p.x, p.y)) {
      this.grab = { kind: 'plate', ox: pl.x - p.x, oy: pl.y - p.y };
      return;
    }
    const near = b.nearest(p.x, p.y);
    if (near.d > 50 && !b.contains(p.x, p.y)) return;
    const pts = [];
    for (let k = -5; k <= 5; k++) {
      const i = (near.i + k + b.n) % b.n;
      if (this.base.includes(i)) continue;
      pts.push({ i, w: Math.exp(-((k / 2.5) ** 2)), ox: b.x[i] - p.x, oy: b.y[i] - p.y });
    }
    this.grab = { kind: 'body', x: p.x, y: p.y, x0: p.x, y0: p.y, t0: performance.now(), moved: false, pts };
  }

  move(p) {
    const g = this.grab;
    if (!g || !p.pressed) return;
    if (g.kind === 'plate') {
      this.plate.tx = U.clamp(p.x + g.ox, this.R * 1.3, this.w - this.R * 1.3);
      this.plate.ty = U.clamp(p.y + g.oy, this.plate.rest - 40, this.plate.rest + 20);
    } else {
      // limit how far the pudding can be pulled
      const dx = p.x - g.x0, dy = p.y - g.y0, d = Math.hypot(dx, dy), max = this.R * 0.8;
      const k = d > max ? max / d : 1;
      g.x = g.x0 + dx * k; g.y = g.y0 + dy * k;
      if (d > 8) g.moved = true;
    }
  }

  up() {
    const g = this.grab;
    if (!g) return;
    this.grab = null;
    if (g.kind === 'plate') { this.plate.ty = this.plate.rest; return; }
    const b = this.body, c = b.centroid();
    if (!g.moved && performance.now() - g.t0 < 300) {
      for (let i = 0; i < b.n; i++) {
        const f = Math.max(0, 1 - U.dist(b.x[i], b.y[i], g.x, g.y) / (this.R * 1.1));
        if (!f) continue;
        const dx = c.x - g.x, dy = c.y - g.y, l = Math.hypot(dx, dy) || 1;
        b.vx[i] += (dx / l) * 700 * f;
        b.vy[i] += (dy / l) * 700 * f;
      }
    }
    this.texts.add(g.x, g.y - 34, U.pick(['ぷるん', 'ぷるぷる', 'ぷるるん']), '#c07a00');
    this.boing(1);
  }

  boing(strength) {
    Sound.tone({ freq: 330, freqEnd: 180, dur: 0.22, gain: 0.18 * strength });
    setTimeout(() => Sound.tone({ freq: 280, freqEnd: 200, dur: 0.15, gain: 0.1 * strength }), 110);
    Sound.vibrate([8, 40, 8]);
  }

  update(dt) {
    this.t += dt;
    const pl = this.plate;
    // plate follows the finger with a little spring so shakes feel physical
    const ax = (pl.tx - pl.x) * 260 - pl.vx * 22, ay = (pl.ty - pl.y) * 260 - pl.vy * 22;
    const pvx = pl.vx;
    pl.vx += ax * dt; pl.vy += ay * dt;
    if (this.grab && this.grab.kind === 'plate' && Math.sign(pvx) !== Math.sign(pl.vx) && Math.abs(pvx) > 500) {
      this.texts.add(pl.x + U.rand(-40, 40), pl.y - this.H - 40, U.pick(['ぷるぷる', 'ぷるん']), '#c07a00', 18);
      Sound.tone({ freq: 260, freqEnd: 180, dur: 0.12, gain: 0.08 });
    }
    const S = 4;
    for (let i = 0; i < S; i++) {
      pl.x += pl.vx * dt / S; pl.y += pl.vy * dt / S;
      this.body.step(dt / S);
    }
    this.texts.update(dt);
  }

  draw(ctx) {
    const { w, h, R } = this, b = this.body, pl = this.plate;
    ctx.fillStyle = INK.bg; ctx.fillRect(0, 0, w, h);
    const ty = pl.rest + 22;
    ctx.strokeStyle = INK.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, ty + 0.5); ctx.lineTo(w, ty + 0.5); ctx.stroke();

    // plate: a flat faceted disc
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath(); ctx.ellipse(pl.x, pl.y + 7, R * 1.75, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9a9a9a';
    ctx.beginPath(); ctx.ellipse(pl.x, pl.y + 3, R * 1.75, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c4c4c4';
    ctx.beginPath(); ctx.ellipse(pl.x, pl.y + 2, R * 1.3, 7, 0, 0, Math.PI * 2); ctx.fill();

    // pudding body
    const c = b.centroid();
    const [xs, ys] = U.decimate(b.x, b.y, b.n, 2);
    U.facet(ctx, xs, ys, xs.length, c.x - R * 0.15, c.y - R * 0.1, [226, 186, 104], { lo: 0.35, inner: 0.55 });
    // caramel cap following the deformed top
    ctx.save();
    ctx.beginPath();
    xs.forEach((x, i) => (i ? ctx.lineTo(x, ys[i]) : ctx.moveTo(x, ys[i])));
    ctx.closePath();
    ctx.clip();
    const t = this.topIdx, cth = R * 0.3;
    ctx.beginPath();
    t.forEach((i, k) => (k ? ctx.lineTo(b.x[i], b.y[i] - 4) : ctx.moveTo(b.x[i], b.y[i] - 4)));
    for (let k = t.length - 1; k >= 0; k--) ctx.lineTo(b.x[t[k]], b.y[t[k]] + cth);
    ctx.closePath();
    ctx.fillStyle = '#4a3020';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    const tc = this.topCenter;
    ctx.beginPath();
    ctx.moveTo(b.x[tc] - R * 0.5, b.y[tc] + 2); ctx.lineTo(b.x[tc], b.y[tc] + 2); ctx.lineTo(b.x[tc] - R * 0.2, b.y[tc] + cth * 0.6);
    ctx.fill();
    ctx.restore();
    this.texts.draw(ctx);
  }
}
