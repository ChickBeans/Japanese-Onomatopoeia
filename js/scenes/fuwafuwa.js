// ふわふわ — fluffy cotton puffs that float down slowly.
SCENES.push({
  id: 'fuwafuwa', kana: 'ふわふわ', kata: 'フワフワ', romaji: 'fuwa-fuwa', emoji: '☁️',
  act: { ja: '綿を高いところから落としてみよう', en: 'Lift the cotton up high and let it go.' },
  cue: (s) => { const f = s.puffs[0]; return { x: f.x, y: f.y, x2: f.x + 20, y2: Math.max(40, f.y - 160) }; },
  color: '#f9c9dc', accent: '#e46a9c',
  create: (w, h) => new FuwaScene(w, h),
});

class FuwaScene {
  constructor(w, h) {
    this.t = 0;
    this.texts = new FloatTexts();
    this.fibers = [];
    this.grab = null;
    this.tracker = U.makeTracker();
    this.resize(w, h);
    this.reset();
    this.actions = [{ label: '↺ Reset', fn: () => this.reset() }];
  }

  reset() {
    const { w, h } = this;
    const n = w < 520 ? 4 : 6;
    const tints = ['255,240,246', '240,246,255', '255,251,236', '246,240,255', '255,255,255', '238,255,248'];
    this.puffs = [];
    for (let i = 0; i < n; i++) {
      const r = U.rand(44, 60) * this.scale;
      this.puffs.push(this.makePuff((w / n) * (i + 0.5), U.rand(h * 0.15, h * 0.55), r, tints[i % tints.length]));
    }
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.floor = h - Math.max(24, h * 0.06);
    this.scale = U.clamp(Math.min(w, h) / 440, 0.75, 1.3);
    if (this.puffs) for (const p of this.puffs) { p.x = U.clamp(p.x, p.r, w - p.r); p.y = Math.min(p.y, this.floor - p.r); }
  }

  makePuff(x, y, r, tint) {
    // cloud-like outline made of soft bumps, plus loose fibres all around
    const K = 9, bumps = [];
    for (let i = 0; i < K; i++) bumps.push({ r: U.rand(0.86, 1.05), ph: U.rand(0, 6.28) });
    const fibres = [];
    for (let i = 0; i < 90; i++) {
      fibres.push({ a: U.rand(0, Math.PI * 2), r0: U.rand(0.7, 0.92), l: U.rand(0.18, 0.42), c: U.rand(-0.5, 0.5), dark: Math.random() < 0.25 });
    }
    return { x, y, r, vx: 0, vy: 0, sq: 1, sqv: 0, rot: 0, bumps, fibres, tint, seed: U.rand(0, 100), held: false };
  }

  hit(p) {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const f = this.puffs[i];
      if (U.dist(p.x, p.y, f.x, f.y) < f.r * 1.15) return f;
    }
    return null;
  }

  down(p) {
    const f = this.hit(p);
    if (!f) return;
    // bring to front
    this.puffs.splice(this.puffs.indexOf(f), 1);
    this.puffs.push(f);
    f.held = true;
    this.grab = { f, ox: f.x - p.x, oy: f.y - p.y, tx: f.x, ty: f.y, x0: p.x, y0: p.y, t0: performance.now(), moved: false };
    this.tracker.reset();
    this.tracker.push(p.x, p.y);
    Sound.noise({ dur: 0.25, type: 'lowpass', freq: 500, q: 0.3, gain: 0.08, attack: 0.05 });
  }

  move(p) {
    const g = this.grab;
    if (!g || !p.pressed) return;
    g.tx = p.x + g.ox;
    g.ty = p.y + g.oy;
    if (U.dist(p.x, p.y, g.x0, g.y0) > 10) g.moved = true;
    this.tracker.push(p.x, p.y);
  }

  up() {
    const g = this.grab;
    if (!g) return;
    const f = g.f;
    f.held = false;
    if (!g.moved && performance.now() - g.t0 < 350) {
      // tap: squish and spring back softly
      f.sqv = -4.2;
      this.emitFibers(f, 10);
      this.texts.add(f.x, f.y - f.r * 1.2, U.pick(['ふわっ', 'ふわふわ', 'ふにゃ']), '#d0578a');
      Sound.noise({ dur: 0.45, type: 'lowpass', freq: 700, freqEnd: 250, q: 0.4, gain: 0.16, attack: 0.08 });
      Sound.vibrate(6);
    } else {
      const v = this.tracker.velocity();
      f.vx = U.clamp(v.vx, -900, 900);
      f.vy = U.clamp(v.vy, -900, 900);
      this.texts.add(f.x, f.y - f.r * 1.2, 'ふわ〜', '#d0578a', 20);
      Sound.noise({ dur: 0.6, type: 'bandpass', freq: 400, freqEnd: 900, q: 0.5, gain: 0.06, attack: 0.2 });
    }
    this.grab = null;
  }

  emitFibers(f, n) {
    for (let i = 0; i < n; i++) {
      const a = U.rand(0, Math.PI * 2);
      this.fibers.push({
        x: f.x + Math.cos(a) * f.r, y: f.y + Math.sin(a) * f.r,
        vx: Math.cos(a) * U.rand(20, 70), vy: Math.sin(a) * U.rand(20, 70) - 20,
        ang: U.rand(0, Math.PI), spin: U.rand(-2, 2), len: U.rand(4, 9), life: U.rand(2.5, 4.5),
      });
    }
  }

  update(dt) {
    this.t += dt;
    const { w, floor } = this;
    for (const f of this.puffs) {
      if (f.held) {
        const g = this.grab;
        const nx = f.x + (g.tx - f.x) * Math.min(1, dt * 12);
        const ny = f.y + (g.ty - f.y) * Math.min(1, dt * 12);
        f.vx = (nx - f.x) / dt; f.vy = (ny - f.y) / dt;
        f.x = nx; f.y = ny;
      } else {
        // very light: weak gravity, strong air drag, a gentle breeze
        f.vy += 110 * dt;
        const drag = Math.exp(-2.4 * dt);
        f.vx *= drag; f.vy *= drag;
        f.vx += Math.sin(this.t * 0.9 + f.seed) * 16 * dt;
        f.x += f.vx * dt; f.y += f.vy * dt;
      }
      const bottom = f.r * 0.82;
      if (f.y + bottom > floor) {
        f.y = floor - bottom;
        if (f.vy > 25) { f.sqv -= f.vy * 0.006; f.vy *= -0.12; } else f.vy = 0;
        f.vx *= Math.exp(-3 * dt);
      }
      if (f.y < f.r * 0.8) { f.y = f.r * 0.8; f.vy = Math.abs(f.vy) * 0.3; }
      if (f.x < f.r * 0.8) { f.x = f.r * 0.8; f.vx = Math.abs(f.vx) * 0.3; }
      if (f.x > w - f.r * 0.8) { f.x = w - f.r * 0.8; f.vx = -Math.abs(f.vx) * 0.3; }
      // squash spring: slow, soft recovery
      const target = f.held ? 0.9 : 1;
      f.sqv += ((target - f.sq) * 55 - f.sqv * 6.5) * dt;
      f.sq = U.clamp(f.sq + f.sqv * dt, 0.55, 1.2);
      f.rot += ((U.clamp(f.vx * 0.0012, -0.35, 0.35)) - f.rot) * Math.min(1, dt * 3);
    }
    // puffs gently push each other apart
    for (let i = 0; i < this.puffs.length; i++) {
      for (let j = i + 1; j < this.puffs.length; j++) {
        const a = this.puffs[i], b = this.puffs[j];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const min = (a.r + b.r) * 0.78;
        if (d < min) {
          const push = (min - d) * Math.min(1, dt * 6) / d;
          if (!a.held) { a.x -= dx * push * 0.5; a.y -= dy * push * 0.5; }
          if (!b.held) { b.x += dx * push * 0.5; b.y += dy * push * 0.5; }
        }
      }
    }
    for (const fb of this.fibers) {
      fb.vy += 12 * dt;
      const d = Math.exp(-2.5 * dt);
      fb.vx *= d; fb.vy *= d;
      fb.vx += Math.sin(this.t * 1.3 + fb.ang * 5) * 8 * dt;
      fb.x += fb.vx * dt; fb.y += fb.vy * dt;
      fb.ang += fb.spin * dt;
      fb.life -= dt;
    }
    this.fibers = this.fibers.filter((f) => f.life > 0 && f.y < this.h);
    this.texts.update(dt);
  }

  draw(ctx) {
    const { w, h, floor } = this;
    ctx.fillStyle = INK.bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = INK.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, floor + 0.5); ctx.lineTo(w, floor + 0.5); ctx.stroke();
    for (const f of this.puffs) {
      // faint contact shadow that shrinks as the puff rises
      const lift = U.clamp((floor - f.y) / 300, 0, 1);
      ctx.fillStyle = `rgba(255,255,255,${0.05 * (1 - lift)})`;
      ctx.beginPath(); ctx.ellipse(f.x, floor + 1, f.r * (0.9 - lift * 0.4), 3, 0, 0, Math.PI * 2); ctx.fill();
    }
    for (const f of this.puffs) this.drawPuff(ctx, f);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 0.8;
    for (const fb of this.fibers) {
      ctx.globalAlpha = Math.min(1, fb.life);
      ctx.beginPath();
      ctx.moveTo(fb.x - Math.cos(fb.ang) * fb.len / 2, fb.y - Math.sin(fb.ang) * fb.len / 2);
      ctx.lineTo(fb.x + Math.cos(fb.ang) * fb.len / 2, fb.y + Math.sin(fb.ang) * fb.len / 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this.texts.draw(ctx);
  }

  drawPuff(ctx, f) {
    const t = this.t, r = f.r, K = f.bumps.length;
    ctx.save();
    ctx.translate(f.x, f.y + r * 0.82 * (1 - f.sq));
    ctx.rotate(f.rot);
    ctx.scale(1 + (1 - f.sq) * 0.9, f.sq);
    const halo = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.45);
    halo.addColorStop(0, 'rgba(255,255,255,0.16)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2); ctx.fill();
    // loose fibres
    ctx.lineWidth = 0.7;
    for (const fb of f.fibres) {
      const a = fb.a + Math.sin(t * 0.9 + fb.a * 4) * 0.04;
      const r0 = r * (fb.r0 + 0.2), r1 = r * (fb.r0 + fb.l * 0.5 + 0.22 + 0.03 * Math.sin(t * 1.7 + fb.a * 7));
      ctx.strokeStyle = fb.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a + fb.c * 0.12) * r1, Math.sin(a + fb.c * 0.12) * r1);
      ctx.stroke();
    }
    // low-poly body: bump points alternating with slightly sunken points
    const xs = [], ys = [];
    for (let i = 0; i < K * 2; i++) {
      const a = (i / (K * 2)) * Math.PI * 2, b = f.bumps[i >> 1];
      const rr = r * (i % 2 ? 0.93 : b.r * 1.08) * (1 + 0.035 * Math.sin(t * 1.4 + b.ph + i));
      xs.push(Math.cos(a) * rr); ys.push(Math.sin(a) * rr);
    }
    U.facet(ctx, xs, ys, xs.length, -r * 0.05, -r * 0.08, [245, 245, 245], { lo: 0.62, inner: 0.5 });
    ctx.restore();
  }
}
