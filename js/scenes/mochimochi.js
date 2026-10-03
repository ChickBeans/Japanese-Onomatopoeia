// もちもち — a rice cake stuck to the board: pinch it and it stretches, then slowly comes back.
SCENES.push({
  id: 'mochimochi', kana: 'もちもち', kata: 'モチモチ', romaji: 'mochi-mochi', emoji: '🍡',
  color: '#f3e3c7', accent: '#c48a3a',
  short: 'Soft, stretchy and chewy',
  meaning: 'Soft, springy and chewy — stretchy and elastic like mochi rice cake.',
  nuance: '😊 Very positive for food: bread, noodles, dumplings. Also baby cheeks!',
  example: { ja: 'このパンはもちもちしている。', en: 'This bread is soft and chewy.' },
  hint: 'Pinch the edge of the mochi and pull it far away. Tap it to poke a dent.',
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
    const { w, h, floor, R } = this, b = this.body;
    // warm kitchen backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, floor);
    bg.addColorStop(0, '#fbeedd'); bg.addColorStop(1, '#f6e1c6');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, floor);
    // noren-ish stripes
    ctx.fillStyle = 'rgba(200,120,60,0.06)';
    for (let x = 0; x < w; x += 46) ctx.fillRect(x, 0, 22, floor);
    // wooden board
    ctx.fillStyle = '#d9b07a'; ctx.fillRect(0, floor, w, h - floor);
    ctx.fillStyle = '#c99c62'; ctx.fillRect(0, floor, w, 6);
    ctx.strokeStyle = 'rgba(120,80,40,0.18)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const y = floor + 14 + i * ((h - floor) / 6);
      ctx.beginPath(); ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.3, y - 6, w * 0.6, y + 6, w, y - 2);
      ctx.stroke();
    }
    // potato-starch powder under the mochi
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 70; i++) {
      const x = w / 2 + Math.sin(i * 12.9898) * R * 1.8, y = floor + 4 + Math.abs(Math.sin(i * 78.233)) * 18;
      ctx.beginPath(); ctx.arc(x, y, 1.3 + (i % 3) * 0.6, 0, Math.PI * 2); ctx.fill();
    }
    // shadow
    ctx.fillStyle = 'rgba(120,80,40,0.22)';
    ctx.beginPath(); ctx.ellipse(w / 2, floor + 3, R * 1.25, 9, 0, 0, Math.PI * 2); ctx.fill();

    // the mochi
    U.smoothClosedPath(ctx, b.x, b.y, b.n);
    const c = b.centroid();
    let top = Infinity;
    for (let i = 0; i < b.n; i++) top = Math.min(top, b.y[i]);
    const g = ctx.createRadialGradient(c.x - R * 0.35, top + R * 0.35, R * 0.1, c.x, c.y + R * 0.3, R * 2.2);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#fffaf2'); g.addColorStop(1, '#f0e2cc');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(170,130,90,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    // soft highlight
    ctx.save();
    U.smoothClosedPath(ctx, b.x, b.y, b.n);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.ellipse(c.x - R * 0.45, top + R * 0.28, R * 0.32, R * 0.12, -0.35, 0, Math.PI * 2); ctx.fill();
    // dusting of starch on the skin
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 26; i++) {
      const a = i * 2.4, r = R * (0.2 + (i % 5) * 0.17);
      ctx.beginPath(); ctx.arc(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 0.5, 1.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // face
    const fx = c.x, fy = c.y - R * 0.05, stretched = !!this.grab;
    ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    if (stretched) {
      ctx.moveTo(fx - R * 0.33, fy - 6); ctx.lineTo(fx - R * 0.22, fy); ctx.lineTo(fx - R * 0.33, fy + 6);
      ctx.moveTo(fx + R * 0.33, fy - 6); ctx.lineTo(fx + R * 0.22, fy); ctx.lineTo(fx + R * 0.33, fy + 6);
    } else {
      ctx.arc(fx - R * 0.27, fy + 3, 6, Math.PI * 1.1, Math.PI * 1.9);
      ctx.moveTo(fx + R * 0.27 + 6 * Math.cos(Math.PI * 1.1), fy + 3 + 6 * Math.sin(Math.PI * 1.1));
      ctx.arc(fx + R * 0.27, fy + 3, 6, Math.PI * 1.1, Math.PI * 1.9);
    }
    ctx.stroke();
    ctx.beginPath();
    if (stretched) ctx.arc(fx, fy + 14, 5, 0, Math.PI * 2);
    else { ctx.moveTo(fx - 6, fy + 10); ctx.quadraticCurveTo(fx, fy + 16, fx + 6, fy + 10); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,140,150,0.35)';
    ctx.beginPath(); ctx.ellipse(fx - R * 0.45, fy + 12, 10, 6, 0, 0, Math.PI * 2); ctx.ellipse(fx + R * 0.45, fy + 12, 10, 6, 0, 0, Math.PI * 2); ctx.fill();

    if (this.grab) {
      ctx.fillStyle = 'rgba(255,170,120,0.35)';
      ctx.beginPath(); ctx.arc(this.grab.x, this.grab.y, 16, 0, Math.PI * 2); ctx.fill();
    }
    this.texts.draw(ctx);
  }
}
