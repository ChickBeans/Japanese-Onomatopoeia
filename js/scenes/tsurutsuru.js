// つるつる — a wooden floor next to a sheet of ice. Things glide forever on the ice.
SCENES.push({
  id: 'tsurutsuru', kana: 'つるつる', kata: 'ツルツル', romaji: 'tsuru-tsuru', emoji: '🧊',
  color: '#bfe6f7', accent: '#2b8fc4',
  short: 'Smooth and slippery',
  meaning: 'Smooth, slick and slippery; also shiny-smooth (bald head, polished floor).',
  nuance: '⚠️ / 😊 Slippery ice is dangerous, smooth skin is nice. Also used for slurping noodles.',
  example: { ja: '道が凍ってつるつるだ。', en: 'The road is frozen and slippery.' },
  hint: 'Fling the things onto the ice. Compare how they stop on the wooden floor.',
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
      mk('penguin', x0 + (this.w - x0) * 0.35, 22 * s, 34 * s),
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
    const { w, h, gy, iceX, s } = this;
    // wintry backdrop
    const sky = ctx.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, '#cfe9fb'); sky.addColorStop(1, '#f2fbff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, gy);
    ctx.fillStyle = '#e4f2fb';
    ctx.beginPath(); ctx.moveTo(0, gy);
    for (let i = 0; i <= 8; i++) ctx.lineTo((w / 8) * i, gy - 40 - ((i * 37) % 60) * s);
    ctx.lineTo(w, gy); ctx.fill();

    // wooden floor
    ctx.fillStyle = '#c99a6b'; ctx.fillRect(0, gy, iceX, h - gy);
    ctx.strokeStyle = 'rgba(90,55,25,0.35)'; ctx.lineWidth = 1.5;
    for (let y = gy + 18; y < h; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(iceX, y); ctx.stroke(); }
    for (let r = 0, y = gy; y < h; r++, y += 22) {
      for (let x = (r % 2) * 40 + 30; x < iceX; x += 80) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 22); ctx.stroke(); }
    }
    ctx.fillStyle = '#b08156'; ctx.fillRect(0, gy, iceX, 5);

    // ice: glossy, with reflections
    const ice = ctx.createLinearGradient(0, gy, 0, h);
    ice.addColorStop(0, '#e8f8ff'); ice.addColorStop(0.3, '#bfe7f8'); ice.addColorStop(1, '#8fcfee');
    ctx.fillStyle = ice; ctx.fillRect(iceX, gy, w - iceX, h - gy);
    ctx.save();
    ctx.beginPath(); ctx.rect(iceX, gy, w - iceX, h - gy); ctx.clip();
    ctx.globalAlpha = 0.28;
    for (const o of this.objs) {
      ctx.save();
      ctx.translate(o.x, gy + (gy - (o.y + o.hh)));
      ctx.scale(1, -1);
      ctx.rotate(o.ang);
      this.drawObj(ctx, o);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
    for (const c of this.cracks) {
      ctx.beginPath();
      c.forEach(([u, v], i) => {
        const x = iceX + u * (w - iceX), y = gy + v * (h - gy);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 4; i++) {
      const x = iceX + ((i * 0.27 + 0.1) * (w - iceX) + this.t * 4) % (w - iceX);
      ctx.beginPath();
      ctx.moveTo(x, gy + 6); ctx.lineTo(x + 26, gy + 6); ctx.lineTo(x - 30, h); ctx.lineTo(x - 64, h);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(iceX, gy, w - iceX, 3);

    // floor labels
    ctx.font = `700 ${Math.round(14 * s + 2)}px "M PLUS Rounded 1c", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('木 wood', iceX / 2, gy + 32);
    ctx.fillStyle = 'rgba(20,90,130,0.75)';
    ctx.fillText('氷 ice = つるつる', iceX + (w - iceX) / 2, gy + 32);

    for (const p of this.parts) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      if (p.kind === 'spark') {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(170,130,90,0.3)';
        ctx.beginPath(); ctx.arc(p.x, p.y, 2 + (0.8 - p.life) * 6, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    for (const o of this.objs) {
      const lift = U.clamp((gy - o.y - o.hh) / 200, 0, 1);
      ctx.fillStyle = `rgba(0,30,60,${0.15 * (1 - lift)})`;
      ctx.beginPath(); ctx.ellipse(o.x, gy + 2, o.hw * (1.1 - lift * 0.4), 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.translate(o.x, o.y + o.hh);
      ctx.rotate(o.ang);
      this.drawObj(ctx, o);
      ctx.restore();
    }
    this.texts.draw(ctx);
  }

  // drawn with origin at bottom-centre of the object
  drawObj(ctx, o) {
    const { hw, hh } = o;
    if (o.type === 'crate') {
      ctx.fillStyle = '#d9a35f'; ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 3;
      ctx.fillRect(-hw, -hh * 2, hw * 2, hh * 2);
      ctx.strokeRect(-hw + 1.5, -hh * 2 + 1.5, hw * 2 - 3, hh * 2 - 3);
      ctx.beginPath(); ctx.moveTo(-hw, -hh * 2); ctx.lineTo(hw, 0); ctx.moveTo(hw, -hh * 2); ctx.lineTo(-hw, 0); ctx.stroke();
    } else if (o.type === 'stone') {
      // curling stone
      ctx.fillStyle = '#8b8f99';
      ctx.beginPath(); ctx.ellipse(0, -hh * 0.75, hw, hh * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a9aeb8';
      ctx.beginPath(); ctx.ellipse(0, -hh * 0.95, hw * 0.85, hh * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e04848';
      ctx.fillRect(-hw * 0.12, -hh * 1.75, hw * 0.24, hh * 0.6);
      ctx.fillRect(-hw * 0.12, -hh * 1.75, hw * 0.75, hh * 0.22);
    } else {
      // penguin
      ctx.fillStyle = '#f39a2b';
      ctx.beginPath(); ctx.ellipse(-hw * 0.4, -2, hw * 0.4, 4, 0, 0, Math.PI * 2); ctx.ellipse(hw * 0.4, -2, hw * 0.4, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#26324a';
      ctx.beginPath(); ctx.ellipse(0, -hh, hw, hh, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(0, -hh * 0.85, hw * 0.68, hh * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#26324a';
      ctx.beginPath(); ctx.arc(-hw * 0.3, -hh * 1.45, 2.6, 0, Math.PI * 2); ctx.arc(hw * 0.3, -hh * 1.45, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f39a2b';
      ctx.beginPath(); ctx.moveTo(-5, -hh * 1.32); ctx.lineTo(5, -hh * 1.32); ctx.lineTo(0, -hh * 1.18); ctx.fill();
      ctx.fillStyle = 'rgba(255,120,140,0.5)';
      ctx.beginPath(); ctx.arc(-hw * 0.5, -hh * 1.25, 3.5, 0, Math.PI * 2); ctx.arc(hw * 0.5, -hh * 1.25, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}
