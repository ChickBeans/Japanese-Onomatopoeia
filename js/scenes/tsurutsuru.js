// つるつる — a wooden floor next to a sheet of ice. Things glide forever on the ice.
SCENES.push({
  id: 'tsurutsuru', kana: 'つるつる', kata: 'ツルツル', romaji: 'tsuru-tsuru', emoji: '🧊',
  act: { ja: '氷の上に物を滑らせてみよう', en: 'Slide things across the ice.' },
  cue: (s) => { const o = s.objs[0]; return { x: o.x, y: o.y, x2: o.x + s.w * 0.45, y2: o.y - 30, fast: true }; },
  color: '#bfe6f7', accent: '#2b8fc4',
  create: (w, h) => new TsuruScene(w, h),
});

class TsuruScene {
  constructor(w, h) {
    this.t = 0;
    this.texts = new FloatTexts();
    this.parts = [];
    this.grab = null;
    this.tracker = U.makeTracker();
    this.resize(w, h);
    this.reset();
    this.cracks = [];
    for (let i = 0; i < 9; i++) {
      const pts = [[U.rand(0, 1), U.rand(0, 1)]];
      for (let k = 0; k < 4; k++) pts.push([pts[k][0] + U.rand(-0.08, 0.08), pts[k][1] + U.rand(-0.15, 0.15)]);
      this.cracks.push(pts);
    }
    this.actions = [{ label: '↺ Reset', fn: () => this.reset() }];
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.gy = Math.round(h * 0.68);
    this.iceX = Math.round(w * (w > h ? 0.34 : 0.3));
    this.s = U.clamp(Math.min(w, h) / 420, 0.8, 1.3);
    if (this.objs) for (const o of this.objs) { o.x = U.clamp(o.x, o.hw, w - o.hw); o.y = Math.min(o.y, this.gy - o.hh); }
  }

  reset() {
    const s = this.s, x0 = this.iceX;
    const mk = (type, x, hw, hh) => ({ type, x, y: this.gy - hh - 40, vx: 0, vy: 0, hw, hh, ang: 0, av: 0, held: false, ground: false });
    this.objs = [
      mk('crate', x0 * 0.25, 30 * s, 30 * s),
      mk('stone', x0 * 0.6, 30 * s, 20 * s),
      mk('rock', x0 + (this.w - x0) * 0.35, 26 * s, 24 * s),
    ];
  }

  onIce(o) { return o.x > this.iceX; }

  down(p) {
    for (let i = this.objs.length - 1; i >= 0; i--) {
      const o = this.objs[i];
      if (Math.abs(p.x - o.x) < o.hw + 14 && Math.abs(p.y - o.y) < o.hh + 14) {
        o.held = true;
        this.grab = { o, ox: o.x - p.x, oy: o.y - p.y, tx: o.x, ty: o.y };
        this.tracker.reset();
        this.tracker.push(p.x, p.y);
        if (!this.iceLoop) {
          this.iceLoop = Sound.loop({ type: 'highpass', freq: 5000, q: 0.5 });
          this.woodLoop = Sound.loop({ type: 'bandpass', freq: 380, q: 1.2 });
        }
        return;
      }
    }
  }

  move(p) {
    if (!this.grab || !p.pressed) return;
    this.grab.tx = p.x + this.grab.ox;
    this.grab.ty = p.y + this.grab.oy;
    this.tracker.push(p.x, p.y);
  }

  up() {
    if (!this.grab) return;
    const o = this.grab.o, v = this.tracker.velocity();
    o.held = false;
    o.vx = U.clamp(v.vx, -2600, 2600);
    o.vy = U.clamp(v.vy, -1800, 1800);
    o.av = U.clamp(v.vx * 0.004, -6, 6);
    this.grab = null;
  }

  update(dt) {
    this.t += dt;
    const G = 2000, { w, gy } = this;
    let iceNoise = 0, woodNoise = 0;
    const steps = 3, h = dt / steps;
    for (let k = 0; k < steps; k++) {
      for (const o of this.objs) {
        if (o.held) {
          const g = this.grab;
          const nx = o.x + (g.tx - o.x) * Math.min(1, h * 25);
          const ny = Math.min(gy - o.hh, o.y + (g.ty - o.y) * Math.min(1, h * 25));
          o.vx = (nx - o.x) / h; o.vy = (ny - o.y) / h;
          o.x = nx; o.y = ny;
          o.ang += (-o.ang) * Math.min(1, h * 8);
          o.ground = o.y >= gy - o.hh - 0.5;
          continue;
        }
        o.vy += G * h;
        o.x += o.vx * h; o.y += o.vy * h;
        o.ground = false;
        if (o.y + o.hh >= gy) {
          o.y = gy - o.hh;
          if (o.vy > 350) {
            this.thud(o);
            o.vy = -o.vy * 0.22;
          } else o.vy = 0;
          o.ground = true;
        }
        if (o.x - o.hw < 0) { o.x = o.hw; o.vx = Math.abs(o.vx) * 0.75; this.knock(o); }
        if (o.x + o.hw > w) { o.x = w - o.hw; o.vx = -Math.abs(o.vx) * 0.75; this.knock(o); }
        this.friction(o, h, G);
      }
      this.collideObjects();
    }
    for (const o of this.objs) {
      if (!o.ground || o.held) continue;
      const sp = Math.abs(o.vx);
      if (this.onIce(o)) {
        iceNoise += Math.min(1, sp / 900);
        if (sp > 120 && Math.random() < 0.5) this.spark(o);
        if (sp > 500 && Math.random() < dt * 1.2) this.texts.add(o.x, gy - o.hh * 2 - 20, U.pick(['つるーっ', 'すいーっ', 'つるつる']), '#1b7bb0', 20);
      } else {
        woodNoise += Math.min(1, sp / 500);
        if (sp > 60 && Math.random() < 0.6) this.dust(o);
      }
    }
    if (this.iceLoop) {
      this.iceLoop.set(0.12 * Math.min(1.5, iceNoise), 4000 + iceNoise * 2000);
      this.woodLoop.set(0.35 * Math.min(1.5, woodNoise), 300 + woodNoise * 200);
    }
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.life -= dt; }
    this.parts = this.parts.filter((p) => p.life > 0);
    this.texts.update(dt);
  }

  friction(o, h, G) {
    if (o.ground) {
      const ice = this.onIce(o);
      const mu = ice ? 0.012 : 0.75;
      const dec = mu * G * h;
      if (Math.abs(o.vx) <= dec) {
        if (!ice && Math.abs(o.vx) > 200) o.av += Math.sign(o.vx) * 3; // sudden stop tips it forward
        o.vx = 0;
      } else {
        o.vx -= Math.sign(o.vx) * dec;
        if (!ice) o.av += Math.sign(o.vx) * h * Math.min(30, Math.abs(o.vx) * 0.03);
      }
    }
    // wobble back upright
    o.av += (-o.ang * 160 - o.av * (o.ground ? 9 : 1)) * h;
    o.ang = U.clamp(o.ang + o.av * h, -0.6, 0.6);
  }

  collideObjects() {
    const objs = this.objs;
    for (let i = 0; i < objs.length; i++) {
      for (let j = i + 1; j < objs.length; j++) {
        const a = objs[i], b = objs[j];
        const ox = a.hw + b.hw - Math.abs(a.x - b.x);
        const oy = a.hh + b.hh - Math.abs(a.y - b.y);
        if (ox <= 0 || oy <= 0) continue;
        if (ox < oy) {
          const dir = a.x < b.x ? -1 : 1;
          const ma = a.held ? 0 : 1, mb = b.held ? 0 : 1;
          if (ma + mb === 0) continue;
          a.x += dir * ox * (ma / (ma + mb));
          b.x -= dir * ox * (mb / (ma + mb));
          const rel = (a.vx - b.vx) * -dir;
          if (rel > 0) {
            if (!a.held && !b.held) {
              const avg = (a.vx + b.vx) / 2, e = 0.85;
              const d = (a.vx - b.vx) / 2;
              a.vx = avg - e * d; b.vx = avg + e * d;
            } else if (a.held) b.vx = a.vx * 1.1;
            else a.vx = b.vx * 1.1;
            if (rel > 200) this.knock(a);
          }
        } else {
          const top = a.y < b.y ? a : b, bot = top === a ? b : a;
          if (top.held) continue;
          top.y = bot.y - bot.hh - top.hh;
          if (top.vy > 0) top.vy = 0;
          top.ground = true;
          top.vx += (bot.vx - top.vx) * 0.2;
        }
      }
    }
  }

  thud(o) {
    const ice = this.onIce(o);
    Sound.tone({ freq: ice ? 300 : 140, freqEnd: ice ? 180 : 70, dur: 0.12, type: ice ? 'triangle' : 'sine', gain: 0.25 });
    Sound.noise({ dur: 0.08, type: 'lowpass', freq: ice ? 3000 : 900, gain: 0.15 });
    if (ice) Sound.tone({ freq: 2400, freqEnd: 1800, dur: 0.15, type: 'sine', gain: 0.03 });
  }

  knock(o) {
    Sound.tone({ freq: 180, freqEnd: 90, dur: 0.1, gain: 0.2 });
    Sound.noise({ dur: 0.05, type: 'lowpass', freq: 1200, gain: 0.12 });
  }

  spark(o) {
    this.parts.push({
      x: o.x - Math.sign(o.vx) * o.hw * U.rand(0.5, 1), y: this.gy - U.rand(0, 3),
      vx: -o.vx * U.rand(0.05, 0.15), vy: U.rand(-60, -10), g: 80, life: U.rand(0.3, 0.7), kind: 'spark',
    });
  }

  dust(o) {
    this.parts.push({
      x: o.x - Math.sign(o.vx) * o.hw, y: this.gy - 2,
      vx: -o.vx * U.rand(0.05, 0.2) + U.rand(-15, 15), vy: U.rand(-50, -15), g: 30, life: U.rand(0.4, 0.8), kind: 'dust',
    });
  }

  draw(ctx) {
    const { w, h, gy, iceX } = this;
    ctx.fillStyle = INK.bg; ctx.fillRect(0, 0, w, h);

    // wood: dark, with plank seams
    ctx.fillStyle = '#1e1c1a'; ctx.fillRect(0, gy, iceX, h - gy);
    ctx.strokeStyle = '#2e2b28'; ctx.lineWidth = 1;
    for (let y = gy + 14; y < h; y += 16) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(iceX, y + 0.5); ctx.stroke(); }
    for (let r = 0, y = gy; y < h; r++, y += 16) {
      for (let x = (r % 2) * 30 + 20; x < iceX; x += 60) { ctx.beginPath(); ctx.moveTo(x + 0.5, y); ctx.lineTo(x + 0.5, y + 16); ctx.stroke(); }
    }

    // ice: pale, glossy, reflective
    const ice = ctx.createLinearGradient(0, gy, 0, h);
    ice.addColorStop(0, '#9fb1bb'); ice.addColorStop(1, '#43535c');
    ctx.fillStyle = ice; ctx.fillRect(iceX, gy, w - iceX, h - gy);
    ctx.save();
    ctx.beginPath(); ctx.rect(iceX, gy, w - iceX, h - gy); ctx.clip();
    ctx.globalAlpha = 0.3;
    for (const o of this.objs) {
      ctx.save();
      ctx.translate(o.x, gy + (gy - (o.y + o.hh)));
      ctx.scale(1, -1);
      ctx.rotate(o.ang);
      this.drawObj(ctx, o);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 0.8;
    for (const c of this.cracks) {
      ctx.beginPath();
      c.forEach(([u, v], i) => {
        const x = iceX + u * (w - iceX), y = gy + v * (h - gy);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 3; i++) {
      const x = iceX + ((i * 0.33 + 0.1) * (w - iceX) + this.t * 4) % (w - iceX);
      ctx.beginPath();
      ctx.moveTo(x, gy); ctx.lineTo(x + 18, gy); ctx.lineTo(x - 30, h); ctx.lineTo(x - 48, h);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(iceX, gy, w - iceX, 1.5);

    for (const p of this.parts) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.kind === 'spark' ? '#ffffff' : 'rgba(150,140,130,0.35)';
      const r = p.kind === 'spark' ? 1.4 : 1.5 + (0.8 - p.life) * 5;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const o of this.objs) {
      ctx.save();
      ctx.translate(o.x, o.y + o.hh);
      ctx.rotate(o.ang);
      this.drawObj(ctx, o);
      ctx.restore();
    }
    this.texts.draw(ctx);
  }

  // drawn with origin at bottom-centre of the object; flat-shaded faces
  drawObj(ctx, o) {
    const { hw, hh } = o;
    const face = (pts, c) => {
      ctx.fillStyle = c; ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath(); ctx.fill();
    };
    if (o.type === 'crate') {
      const d = hw * 0.35;
      face([[-hw, 0], [hw - d, 0], [hw - d, -hh * 2 + d], [-hw, -hh * 2 + d]], '#bdbdbd');
      face([[-hw, -hh * 2 + d], [hw - d, -hh * 2 + d], [hw, -hh * 2], [-hw + d, -hh * 2]], '#ececec');
      face([[hw - d, 0], [hw, -d], [hw, -hh * 2], [hw - d, -hh * 2 + d]], '#7d7d7d');
    } else if (o.type === 'stone') {
      // puck: a short prism
      face([[-hw, -hh * 0.4], [hw, -hh * 0.4], [hw * 0.9, 0], [-hw * 0.9, 0]], '#6f6f6f');
      face([[-hw, -hh * 0.4], [-hw * 0.6, -hh * 1.1], [hw * 0.6, -hh * 1.1], [hw, -hh * 0.4]], '#a8a8a8');
      face([[-hw * 0.6, -hh * 1.1], [-hw * 0.2, -hh * 1.5], [hw * 0.3, -hh * 1.5], [hw * 0.6, -hh * 1.1]], '#d6d6d6');
    } else {
      // rock: a faceted lump
      const xs = [-hw, -hw * 0.8, -hw * 0.2, hw * 0.5, hw, hw * 0.9], ys = [0, -hh * 1.3, -hh * 2, -hh * 1.7, -hh * 0.8, 0];
      U.facet(ctx, xs, ys, 6, -hw * 0.1, -hh * 1.0, [210, 210, 210], { lo: 0.3, inner: 0.45 });
    }
  }
}
