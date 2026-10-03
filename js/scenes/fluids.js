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

// ---------- どろどろ ----------
SCENES.push({
  id: 'dorodoro', kana: 'どろどろ', kata: 'ドロドロ', romaji: 'doro-doro', emoji: '🟤',
  color: '#c9a27e', accent: '#7a4a24',
  short: 'Thick, muddy, sludgy',
  meaning: 'Thick, heavy and muddy; a sludgy liquid that oozes slowly. (泥 doro = mud)',
  nuance: '😖 Usually unpleasant: mud, sludge, melted things. Also thick stews, or messy emotions.',
  example: { ja: '雨で道がどろどろになった。', en: 'The rain turned the road into thick mud.' },
  hint: 'Stir the mud with your finger. Then press "Pour again" and watch it pile up.',
  create: (w, h) => new FluidScene(w, h, {
    fill: 0.26,
    fluid: { gravity: 0.008, rho0: 2, k: 0.02, kNear: 0.1, sigma: 0.3, beta: 0.2, xsph: 0.4, bulkDrag: 0.04, springs: true, kSpring: 0.05, plasticity: 0.5, yieldRatio: 0.05, wallFriction: 0.5 },
    drag: 0.25, toolR: 1.0, pourRate: 3, spoutW: 2.2,
    color: { r: 122, g: 80, b: 46 },
    render: { spec: 0.35, edgeDark: 0.45 },
    textColor: '#6b3f1d',
    background(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#e9ddc9'); g.addColorStop(1, '#d8c3a3');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(110,80,50,0.08)';
      for (let i = 0; i < 60; i++) ctx.fillRect((i * 97.3) % w, (i * 53.7) % h, 3, 2);
    },
    drawSpout(ctx, x) {
      ctx.fillStyle = '#7d8a96';
      ctx.beginPath(); ctx.moveTo(x - 40, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x + 26, 18); ctx.lineTo(x - 26, 18); ctx.fill();
    },
    drawTool(ctx, p, hp) {
      // wooden stick
      ctx.strokeStyle = '#a77a4b'; ctx.lineWidth = hp * 0.7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x + 12, p.y - 120); ctx.lineTo(p.x, p.y); ctx.stroke();
    },
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
  color: '#ffd98a', accent: '#c98a12',
  short: 'Watery, thin, runny',
  meaning: 'Watery and thin; runnier than it should be (sauce, curry, soup).',
  nuance: '😕 Often a complaint about food that is too thin. The opposite of どろどろ.',
  example: { ja: 'このカレー、しゃばしゃばだね。', en: 'This curry is really watery, isn’t it?' },
  hint: 'Stir fast and splash it around. Press "Pour again" — compare with どろどろ!',
  create: (w, h) => new FluidScene(w, h, {
    fill: 0.26,
    fluid: { gravity: 0.008, rho0: 2, k: 0.02, kNear: 0.1, sigma: 0.0, beta: 0.04, wallFriction: 0.02 },
    drag: 0.05, toolR: 1.0, pourRate: 2, spoutW: 0.8,
    color: { r: 236, g: 176, b: 70, a: 0.82 },
    render: { spec: 1.0, edgeDark: 0.15, depthAlpha: true },
    textColor: '#b06d00',
    background(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#f6ead6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      // plate pattern
      ctx.strokeStyle = 'rgba(70,110,170,0.18)'; ctx.lineWidth = 3;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.strokeStyle = 'rgba(70,110,170,0.1)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(20, 20, w - 40, h - 40);
      // a few rice grains peeking out
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 26; i++) {
        ctx.save();
        ctx.translate(w * 0.08 + (i * 37) % (w * 0.84), h - 14 - (i % 3) * 9);
        ctx.rotate(i);
        ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    },
    drawSpout(ctx, x) {
      ctx.fillStyle = '#c0c6cc';
      ctx.beginPath(); ctx.ellipse(x, 6, 34, 14, 0, 0, Math.PI * 2); ctx.fill();
    },
    drawTool(ctx, p, hp) {
      // spoon
      ctx.fillStyle = '#d6dbe0'; ctx.strokeStyle = '#9aa3ad'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, hp * 0.9, hp * 1.2, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.strokeStyle = '#c3c9cf';
      ctx.beginPath(); ctx.moveTo(p.x + hp * 0.25, p.y - hp * 1.1); ctx.lineTo(p.x + hp * 1.0, p.y - hp * 5); ctx.stroke();
    },
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
  color: '#b9e58f', accent: '#4f9a1e',
  short: 'Sticky, gooey, slimy',
  meaning: 'Sticky and gooey; clings to you and stretches in strings when you pull away.',
  nuance: '🤢 Unpleasant: slime, gum on a shoe, sweaty skin. Similar: ねばねば (natto), べたべた.',
  example: { ja: 'ガムが靴の裏にくっついてねちょねちょする。', en: 'Gum is stuck to my shoe and it’s all gooey.' },
  hint: 'Touch the slime and slowly pull away. Fling some at the walls — it sticks!',
  create: (w, h) => new FluidScene(w, h, {
    fill: 0.2,
    fluid: {
      gravity: 0.006, rho0: 2, k: 0.02, kNear: 0.1, sigma: 0.3, beta: 0.2, xsph: 0.3, bulkDrag: 0.02,
      springs: true, kSpring: 0.03, plasticity: 0.5, yieldRatio: 0.1, maxSpringLen: 3,
      stick: 0.08, stickDist: 0.7, wallFriction: 0.6,
    },
    obstacle: false, pourRate: 3, spoutW: 2.5, blobR: 0.85,
    color: { r: 120, g: 205, b: 70, a: 0.95 },
    render: { spec: 1.2, edgeDark: 0.4, threshold: 0.5 },
    textColor: '#3e8a14',
    background(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#f2eefa'); g.addColorStop(1, '#e2dcf0');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(120,100,160,0.12)'; ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    },
    drawSpout(ctx, x) {
      ctx.fillStyle = '#8b6cc2';
      ctx.beginPath(); ctx.moveTo(x - 30, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 14, 22); ctx.lineTo(x - 14, 22); ctx.fill();
    },
    drawTool(ctx, p, hp) {
      // fingertip
      ctx.fillStyle = 'rgba(255,214,190,0.9)'; ctx.strokeStyle = 'rgba(180,120,100,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, hp * 0.75, hp * 0.9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    },
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
