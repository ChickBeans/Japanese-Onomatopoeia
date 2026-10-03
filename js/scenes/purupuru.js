// ぷるぷる — a custard pudding on a plate that wobbles when you poke it or shake the plate.
SCENES.push({
  id: 'purupuru', kana: 'ぷるぷる', kata: 'プルプル', romaji: 'puru-puru', emoji: '🍮',
  color: '#ffe08a', accent: '#d48a10',
  short: 'Jiggly, wobbly, bouncy-soft',
  meaning: 'Jiggly and wobbly, soft and bouncy — like jelly or pudding.',
  nuance: '😊 Pudding, jelly, plump lips or skin. (Shaking from cold or fear is also ぷるぷる.)',
  example: { ja: 'ぷるぷるのプリンが食べたい。', en: 'I want to eat a jiggly pudding.' },
  hint: 'Tap the pudding, or drag the plate left and right to shake it.',
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
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#fff6dc'); bg.addColorStop(1, '#ffe7b8');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    // checked tablecloth
    const ty = pl.rest + 26;
    ctx.fillStyle = '#ffd7d7'; ctx.fillRect(0, ty, w, h - ty);
    ctx.fillStyle = 'rgba(230,90,90,0.25)';
    for (let x = 0; x < w; x += 36) ctx.fillRect(x, ty, 18, h - ty);
    for (let y = ty; y < h; y += 36) ctx.fillRect(0, y, w, 18);

    // plate
    ctx.fillStyle = 'rgba(120,60,20,0.18)';
    ctx.beginPath(); ctx.ellipse(pl.x, pl.y + 16, R * 1.9, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(pl.x, pl.y + 6, R * 1.85, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c9d6e8'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#e6edf6';
    ctx.beginPath(); ctx.ellipse(pl.x, pl.y + 4, R * 1.35, 12, 0, 0, Math.PI * 2); ctx.stroke();

    // caramel puddle on the plate
    ctx.fillStyle = 'rgba(160,80,10,0.55)';
    ctx.beginPath(); ctx.ellipse(pl.x, pl.y + 2, R * 1.3, 9, 0, 0, Math.PI * 2); ctx.fill();

    // pudding body
    U.smoothClosedPath(ctx, b.x, b.y, b.n);
    const c = b.centroid();
    const g = ctx.createLinearGradient(c.x - R, 0, c.x + R, 0);
    g.addColorStop(0, '#ffe27a'); g.addColorStop(0.45, '#ffd257'); g.addColorStop(1, '#f0b232');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // caramel band that follows the deformed top
    const t = this.topIdx, cth = R * 0.32;
    ctx.beginPath();
    t.forEach((i, k) => (k ? ctx.lineTo(b.x[i], b.y[i] - 4) : ctx.moveTo(b.x[i], b.y[i] - 4)));
    for (let k = t.length - 1; k >= 0; k--) {
      const i = t[k];
      ctx.lineTo(b.x[i], b.y[i] + cth);
    }
    ctx.closePath();
    const cg = ctx.createLinearGradient(0, c.y - this.H, 0, c.y - this.H * 0.4);
    cg.addColorStop(0, '#7a3a08'); cg.addColorStop(1, '#a8560e');
    ctx.fillStyle = cg;
    ctx.fill();
    // gloss
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(c.x - R * 0.5, c.y - R * 0.05, R * 0.09, R * 0.38, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const tc = this.topCenter;
    ctx.beginPath(); ctx.ellipse(b.x[tc] - R * 0.25, b.y[tc] + 8, R * 0.25, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // whipped cream + cherry riding on top
    const tx = b.x[tc], tyy = b.y[tc];
    const a = Math.atan2(b.y[(tc + 1) % b.n] - b.y[(tc - 1 + b.n) % b.n], b.x[(tc + 1) % b.n] - b.x[(tc - 1 + b.n) % b.n]);
    ctx.save();
    ctx.translate(tx, tyy);
    ctx.rotate(a);
    ctx.fillStyle = '#fffaf2';
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      ctx.ellipse(0, -R * (0.1 + k * 0.1), R * (0.36 - k * 0.08), R * 0.1, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.strokeStyle = '#3f7a2e'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, -R * 0.55); ctx.quadraticCurveTo(R * 0.1, -R * 0.8, R * 0.22, -R * 0.85); ctx.stroke();
    ctx.fillStyle = '#e8283c';
    ctx.beginPath(); ctx.arc(0, -R * 0.5, R * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(-R * 0.04, -R * 0.55, R * 0.035, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (this.grab && this.grab.kind === 'plate') {
      ctx.fillStyle = 'rgba(30,30,40,0.55)';
      ctx.font = '700 13px "M PLUS Rounded 1c", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('← shake →', pl.x, pl.y + 46);
    }
    this.texts.draw(ctx);
  }
}
