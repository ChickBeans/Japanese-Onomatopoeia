// どろどろ / しゃばしゃば / ねちょねちょ — the same particle fluid with different "texture" settings.
class FluidScene {
  constructor(w, h, cfg) {
    this.cfg = cfg;
    this.t = 0;
    this.texts = new FloatTexts();
    this.renderer = new FluidRenderer();
    this.ptr = null;
    this.attached = [];
    this.pourLeft = 0;
    this.resize(w, h);
    this.actions = [{ label: '🫗 Pour again', fn: () => this.pour() }];
  }

  resize(w, h) {
    const first = !this.fluid;
    this.w = w; this.h = h;
    const fill = this.cfg.fill || 0.3;
    this.hp = U.clamp(Math.sqrt((fill * w * h) / (520 * 0.2)), 14, 30);
    this.N = Math.min(900, Math.round((fill * w * h) / (0.2 * this.hp * this.hp)));
    const f = new Fluid(Object.assign({ max: 1000 }, this.cfg.fluid));
    f.setBounds(w / this.hp, h / this.hp);
    f.onConstrain = (fl) => this.constrain(fl);
    this.fluid = f;
    this.pxs = new Float32Array(1000);
    this.pys = new Float32Array(1000);
    this.renderer.resize(w, h, U.clamp(Math.round(this.hp / 12), 2, 4));
    if (first) this.pour();
    else this.fillBlock();
  }

  fillBlock() {
    const f = this.fluid, W = f.W, H = f.H;
    f.clear();
    const cols = Math.floor((W - 0.4) / 0.6);
    for (let i = 0; i < this.N; i++) f.add(0.3 + (i % cols) * 0.6 + Math.random() * 0.01, H - 0.3 - Math.floor(i / cols) * 0.55);
  }

  pour() {
    this.fluid.clear();
    this.attached = [];
    this.pourLeft = this.N;
    this.spoutX = this.fluid.W * U.rand(0.35, 0.65);
  }

  down(p) {
    this.ptr = { x: p.x, y: p.y, px: p.x, py: p.y, speed: 0 };
    if (this.cfg.onDown) this.cfg.onDown(this, p);
  }
  move(p) {
    if (!this.ptr || !p.pressed) return;
    this.ptr.x = p.x; this.ptr.y = p.y;
  }
  up(p) {
    if (this.cfg.onUp && this.ptr) this.cfg.onUp(this, p);
    this.ptr = null;
    this.fluid.obstacles.length = 0;
    this.attached = [];
  }

  constrain(fl) {
    // sticky finger (ねちょねちょ): attached particles follow the fingertip
    if (!this.attached.length || !this.ptr) return;
    const tx = this.ptr.x / this.hp, ty = this.ptr.y / this.hp;
    const keep = [];
    for (const a of this.attached) {
      const i = a.i;
      const gx = tx + a.ox, gy = ty + a.oy;
      fl.x[i] += (gx - fl.x[i]) * a.k;
      fl.y[i] += (gy - fl.y[i]) * a.k;
      // weaker grip the further it is dragged: strands eventually snap off
      if (U.dist(fl.x[i], fl.y[i], gx, gy) < 2.2) keep.push(a);
    }
    if (keep.length < this.attached.length && keep.length < this.attached.length * 0.7) {
      this.texts.add(this.ptr.x, this.ptr.y - 30, 'ぶちっ', this.cfg.textColor, 18);
      Sound.noise({ dur: 0.08, type: 'lowpass', freq: 700, gain: 0.1 });
    }
    this.attached = keep;
  }

  update(dt) {
    this.t += dt;
    const f = this.fluid, hp = this.hp, cfg = this.cfg;
    const steps = (cfg.substeps || 2) * U.clamp(Math.round(dt * 60), 1, 2);
    // pointer → moving obstacle
    let speed = 0;
    if (this.ptr) {
      const p = this.ptr;
      const dx = (p.x - p.px) / hp, dy = (p.y - p.py) / hp;
      speed = Math.hypot(p.x - p.px, p.y - p.py) / dt;
      p.speed += (speed - p.speed) * 0.3;
      p.px = p.x; p.py = p.y;
      if (cfg.obstacle !== false) {
        f.obstacles[0] = { x: p.x / hp, y: p.y / hp, r: cfg.toolR || 1.1, dx: dx / steps, dy: dy / steps, drag: cfg.drag || 0 };
      }
      if (cfg.onStir) cfg.onStir(this, p.speed, dt);
    }
    for (let s = 0; s < steps; s++) {
      if (this.pourLeft > 0) {
        const k = Math.min(this.pourLeft, cfg.pourRate || 2);
        for (let j = 0; j < k; j++) f.add(this.spoutX + U.rand(-0.35, 0.35) * (cfg.spoutW || 1), 0.6 + U.rand(0, 0.3), 0, 0.12);
        this.pourLeft -= k;
      }
      f.step();
    }
    // average motion drives the ambient sound
    let ke = 0;
    for (let i = 0; i < f.n; i += 4) ke += Math.abs(f.vx[i]) + Math.abs(f.vy[i]);
    this.motion = (ke / Math.max(1, f.n / 4)) * hp * 60;
    if (cfg.onFrame) cfg.onFrame(this, dt);
    this.texts.update(dt);
  }

  draw(ctx) {
    const { w, h, hp, cfg } = this, f = this.fluid;
    cfg.background(ctx, w, h, this);
    for (let i = 0; i < f.n; i++) { this.pxs[i] = f.x[i] * hp; this.pys[i] = f.y[i] * hp; }
    if (this.pourLeft > 0 && cfg.drawSpout) cfg.drawSpout(ctx, this.spoutX * hp, this);
    this.renderer.render(ctx, this.pxs, this.pys, f.n, hp * (cfg.blobR || 0.9), cfg.color, cfg.render || {});
    if (this.ptr) cfg.drawTool(ctx, this.ptr, hp, this);
    this.texts.draw(ctx);
  }

  destroy() { if (this.loop) this.loop.stop(); }
}

// ---------- shared monochrome visuals ----------
function fluidBackground(ctx, w, h) {
  ctx.fillStyle = INK.bg; ctx.fillRect(0, 0, w, h);
}
function fluidSpout(ctx, x) {
  ctx.fillStyle = '#4a4a4a';
  ctx.beginPath(); ctx.moveTo(x - 28, 0); ctx.lineTo(x + 28, 0); ctx.lineTo(x + 14, 14); ctx.lineTo(x - 14, 14); ctx.fill();
}
function stickTool(ctx, p, hp) {
  ctx.strokeStyle = '#bdbdbd'; ctx.lineWidth = Math.max(4, hp * 0.4); ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(p.x + 10, p.y - 140); ctx.lineTo(p.x, p.y); ctx.stroke();
}
function spoonTool(ctx, p, hp) {
  ctx.fillStyle = '#d0d0d0';
  ctx.beginPath(); ctx.ellipse(p.x, p.y, hp * 0.75, hp * 1.0, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#d0d0d0'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(p.x + hp * 0.2, p.y - hp * 0.9); ctx.lineTo(p.x + hp * 0.9, p.y - hp * 5); ctx.stroke();
}
function fingerTool(ctx, p, hp) {
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(p.x, p.y, hp * 0.75, 0, Math.PI * 2); ctx.stroke();
}

// ---------- どろどろ ----------
SCENES.push({
  id: 'dorodoro', kana: 'どろどろ', kata: 'ドロドロ', romaji: 'doro-doro', emoji: '🟤',
  act: { ja: '泥をかき混ぜてみよう', en: 'Stir the mud.' },
  cue: (s) => ({ x: s.w * 0.2, y: s.h * 0.88, x2: s.w * 0.8, y2: s.h * 0.86 }),
  color: '#c9a27e', accent: '#7a4a24',
  create: (w, h) => new FluidScene(w, h, {
    fill: 0.26,
    fluid: { gravity: 0.008, rho0: 2, k: 0.02, kNear: 0.1, sigma: 0.3, beta: 0.2, xsph: 0.4, bulkDrag: 0.04, springs: true, kSpring: 0.05, plasticity: 0.5, yieldRatio: 0.05, wallFriction: 0.5 },
    drag: 0.25, toolR: 1.0, pourRate: 3, spoutW: 2.2,
    color: { r: 92, g: 74, b: 60 },
    render: { spec: 0.3, edgeDark: 0.5 },
    textColor: '#eee',
    background: fluidBackground,
    drawSpout: fluidSpout,
    drawTool: stickTool,
    onDown(s, p) {
      Sound.tone({ freq: 90, freqEnd: 55, dur: 0.25, gain: 0.25 });
      Sound.noise({ dur: 0.2, type: 'lowpass', freq: 300, gain: 0.25 });
      if (!s.loop) s.loop = Sound.loop({ type: 'lowpass', freq: 220, q: 2 });
    },
    onStir(s, speed, dt) {
      s.blorp = (s.blorp || 0) + speed * dt;
      if (s.blorp > 260) {
        s.blorp = 0;
        Sound.tone({ freq: U.rand(70, 110), freqEnd: 45, dur: 0.22, gain: 0.2 });
        Sound.vibrate(12);
        s.texts.add(s.ptr.x + U.rand(-30, 30), s.ptr.y - 40, U.pick(['どろっ', 'どろどろ', 'ぐちゃ', 'ずぶっ']), '#6b3f1d');
      }
    },
    onFrame(s) {
      if (s.loop) s.loop.set(s.ptr ? Math.min(0.5, s.ptr.speed / 900) : 0, 160 + Math.min(200, (s.ptr ? s.ptr.speed : 0) / 5));
    },
  }),
});

// ---------- しゃばしゃば ----------
SCENES.push({
  id: 'shabashaba', kana: 'しゃばしゃば', kata: 'シャバシャバ', romaji: 'shaba-shaba', emoji: '💧',
  act: { ja: 'うすいスープをかき混ぜてみよう', en: 'Stir the thin soup.' },
  cue: (s) => ({ x: s.w * 0.2, y: s.h * 0.9, x2: s.w * 0.8, y2: s.h * 0.88, fast: true }),
  color: '#ffd98a', accent: '#c98a12',
  create: (w, h) => new FluidScene(w, h, {
    fill: 0.26,
    fluid: { gravity: 0.008, rho0: 2, k: 0.02, kNear: 0.1, sigma: 0.0, beta: 0.04, wallFriction: 0.02 },
    drag: 0.05, toolR: 1.0, pourRate: 2, spoutW: 0.8,
    color: { r: 200, g: 196, b: 186, a: 0.7 },
    render: { spec: 1.0, edgeDark: 0.1, depthAlpha: true },
    textColor: '#eee',
    background: fluidBackground,
    drawSpout: fluidSpout,
    drawTool: spoonTool,
    onDown(s) {
      Sound.noise({ dur: 0.15, type: 'bandpass', freq: 1400, q: 1.5, gain: 0.2 });
      if (!s.loop) s.loop = Sound.loop({ type: 'bandpass', freq: 900, q: 1.2 });
    },
    onStir(s, speed, dt) {
      s.splash = (s.splash || 0) + speed * dt;
      if (s.splash > 180) {
        s.splash = 0;
        Sound.noise({ dur: 0.12, type: 'bandpass', freq: U.rand(1200, 2600), q: 2, gain: 0.18 });
        s.texts.add(s.ptr.x + U.rand(-30, 30), s.ptr.y - 40, U.pick(['しゃばっ', 'ぱしゃっ', 'じゃぶじゃぶ', 'しゃばしゃば']), '#b06d00', 20);
      }
    },
    onFrame(s) {
      if (s.loop) s.loop.set(Math.min(0.25, s.motion / 1600), 700 + Math.min(1200, s.motion));
    },
  }),
});

// ---------- ねちょねちょ ----------
SCENES.push({
  id: 'nechonecho', kana: 'ねちょねちょ', kata: 'ネチョネチョ', romaji: 'necho-necho', emoji: '🟢',
  act: { ja: 'スライムに触って、ゆっくり離してみよう', en: 'Touch the slime, then pull away slowly.' },
  cue: (s) => { const f = s.fluid; let t = 0; for (let i = 0; i < f.n; i++) if (f.y[i] < f.y[t]) t = i; const x = f.x[t] * s.hp, y = f.y[t] * s.hp + 8; return { x, y, x2: x + 10, y2: y - s.h * 0.35 }; },
  color: '#b9e58f', accent: '#4f9a1e',
  create: (w, h) => new FluidScene(w, h, {
    fill: 0.2,
    fluid: {
      gravity: 0.006, rho0: 2, k: 0.02, kNear: 0.1, sigma: 0.3, beta: 0.2, xsph: 0.3, bulkDrag: 0.02,
      springs: true, kSpring: 0.03, plasticity: 0.5, yieldRatio: 0.1, maxSpringLen: 3,
      stick: 0.08, stickDist: 0.7, wallFriction: 0.6,
    },
    obstacle: false, pourRate: 3, spoutW: 2.5, blobR: 0.85,
    color: { r: 128, g: 168, b: 108, a: 0.95 },
    render: { spec: 1.1, edgeDark: 0.45, threshold: 0.5 },
    textColor: '#eee',
    background: fluidBackground,
    drawSpout: fluidSpout,
    drawTool: fingerTool,
    onDown(s, p) {
      const f = s.fluid, hp = s.hp, tx = p.x / hp, ty = p.y / hp;
      s.attached = [];
      for (let i = 0; i < f.n; i++) {
        const dx = f.x[i] - tx, dy = f.y[i] - ty, d = Math.hypot(dx, dy);
        if (d < 1.6) s.attached.push({ i, ox: dx * 0.5, oy: dy * 0.5, k: 0.35 * (1 - d / 1.8) });
      }
      if (s.attached.length) {
        Sound.noise({ dur: 0.18, type: 'lowpass', freq: 900, freqEnd: 300, q: 4, gain: 0.3 });
        s.texts.add(p.x, p.y - 34, U.pick(['ねちょっ', 'ぬちゃっ', 'べちょ']), '#3e8a14');
        Sound.vibrate(20);
      }
      if (!s.loop) s.loop = Sound.loop({ type: 'lowpass', freq: 500, q: 6 });
    },
    onUp(s, p) {
      if (s.attached.length) {
        Sound.noise({ dur: 0.25, type: 'lowpass', freq: 300, freqEnd: 1200, q: 6, gain: 0.25 });
        s.texts.add(p.x, p.y - 34, U.pick(['ねちょねちょ', 'にちゃ〜', 'ねば〜']), '#3e8a14');
      }
    },
    onStir(s, speed, dt) {
      if (!s.attached.length) return;
      s.goo = (s.goo || 0) + speed * dt;
      if (s.goo > 220) {
        s.goo = 0;
        Sound.noise({ dur: 0.14, type: 'lowpass', freq: U.rand(300, 700), q: 8, gain: 0.2 });
        Sound.vibrate(8);
        s.texts.add(s.ptr.x + U.rand(-30, 30), s.ptr.y - 40, U.pick(['ねちょ', 'ねばー', 'ぬちゃ']), '#3e8a14', 18);
      }
    },
    onFrame(s) {
      const sp = s.ptr && s.attached.length ? s.ptr.speed : 0;
      if (s.loop) s.loop.set(Math.min(0.3, sp / 1500), 300 + Math.min(500, sp / 3));
    },
  }),
});
