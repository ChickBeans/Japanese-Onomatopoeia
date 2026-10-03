// ぷちぷち — bubble wrap. Press each bubble until it pops.
SCENES.push({
  id: 'puchipuchi', kana: 'ぷちぷち', kata: 'プチプチ', romaji: 'puchi-puchi', emoji: '🫧',
  color: '#cfe3ff', accent: '#3b7bd8',
  short: 'Little popping bubbles',
  meaning: 'Lots of little things popping one after another; the feel of tiny beads bursting.',
  nuance: '😊 Fun: bubble wrap (literally called プチプチ in Japan), salmon roe, tapioca pearls.',
  example: { ja: 'いくらのぷちぷちした食感が好き。', en: 'I love the poppy texture of salmon roe.' },
  hint: 'Press the bubbles to pop them. Drag across many at once!',
  create: (w, h) => new PuchiScene(w, h),
});

class PuchiScene {
  constructor(w, h) {
    this.t = 0;
    this.texts = new FloatTexts();
    this.parts = [];
    this.ptrs = new Map();
    this.resize(w, h);
    this.actions = [{ label: '↺ New sheet', fn: () => this.reset() }];
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.reset();
  }

  reset() {
    const { w, h } = this;
    const r = U.clamp(Math.min(w, h) / 13, 16, 30);
    this.r = r;
    const dx = r * 2.25, dy = r * 1.95;
    this.bubbles = [];
    let row = 0;
    for (let y = r * 1.4; y < h - r * 0.8; y += dy, row++) {
      for (let x = r * 1.3 + (row % 2) * dx / 2; x < w - r * 0.8; x += dx) {
        const crinkle = [];
        for (let k = 0; k < 9; k++) crinkle.push(U.rand(0.55, 1.0));
        this.bubbles.push({ x, y, state: 0, press: 0, crinkle, rot: U.rand(0, 6) });
      }
    }
    this.popped = 0;
    this.doneAt = 0;
  }

  bubbleAt(x, y) {
    let best = null, bd = this.r * this.r;
    for (const b of this.bubbles) {
      const d = (b.x - x) ** 2 + (b.y - y) ** 2;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  down(p) { this.ptrs.set(p.id, { x: p.x, y: p.y }); }
  move(p) { if (p.pressed && this.ptrs.has(p.id)) this.ptrs.set(p.id, { x: p.x, y: p.y }); }
  up(p) { this.ptrs.delete(p.id); }

  pop(b) {
    b.state = 1;
    this.popped++;
    const pitch = U.rand(0.8, 1.3);
    Sound.noise({ dur: 0.05, type: 'highpass', freq: 1800 * pitch, gain: 0.5, attack: 0.001 });
    Sound.tone({ freq: 900 * pitch, freqEnd: 300 * pitch, dur: 0.05, type: 'triangle', gain: 0.18, attack: 0.001 });
    Sound.vibrate(12);
    for (let k = 0; k < 6; k++) {
      const a = U.rand(0, Math.PI * 2);
      this.parts.push({ x: b.x, y: b.y, vx: Math.cos(a) * U.rand(60, 160), vy: Math.sin(a) * U.rand(60, 160), life: 0.25 });
    }
    this.texts.add(b.x, b.y - this.r * 1.2, U.pick(['ぷちっ', 'ぷちっ', 'ぱちっ', 'ぷち']), '#2f63b8', 18);
    if (this.popped === this.bubbles.length) {
      this.doneAt = this.t;
      setTimeout(() => this.texts.add(this.w / 2, this.h / 2, 'ぜんぶ ぷちぷちした！', '#2f63b8', 26), 200);
    }
  }

  update(dt) {
    this.t += dt;
    const touched = new Set();
    for (const p of this.ptrs.values()) {
      const b = this.bubbleAt(p.x, p.y);
      if (b && b.state === 0) touched.add(b);
    }
    for (const b of this.bubbles) {
      if (b.state !== 0) continue;
      if (touched.has(b)) {
        b.press += dt * 9;
        if (b.press >= 1) this.pop(b);
      } else b.press = Math.max(0, b.press - dt * 6);
    }
    for (const q of this.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
    this.parts = this.parts.filter((q) => q.life > 0);
    if (this.doneAt && this.t - this.doneAt > 2.5) this.reset();
    this.texts.update(dt);
  }

  draw(ctx) {
    const { w, h, r } = this;
    ctx.fillStyle = '#e9f2fc'; ctx.fillRect(0, 0, w, h);
    // the plastic sheet sheen
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(255,255,255,0.6)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.4)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    for (const b of this.bubbles) {
      if (b.state === 1) {
        // flattened, crinkled plastic
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.beginPath();
        b.crinkle.forEach((c, k) => {
          const a = (k / b.crinkle.length) * Math.PI * 2;
          const x = Math.cos(a) * r * c, y = Math.sin(a) * r * c;
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = 'rgba(200,215,235,0.55)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(140,165,200,0.6)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();
        continue;
      }
      const s = 1 - b.press * 0.18, sy = 1 - b.press * 0.32;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = 'rgba(90,120,170,0.15)';
      ctx.beginPath(); ctx.ellipse(r * 0.12, r * 0.18, r * 1.0, r * 0.95, 0, 0, Math.PI * 2); ctx.fill();
      ctx.scale(s + b.press * 0.25, sy);
      const bg = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      bg.addColorStop(0, 'rgba(255,255,255,0.95)');
      bg.addColorStop(0.5, 'rgba(225,238,255,0.6)');
      bg.addColorStop(1, 'rgba(160,190,230,0.7)');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(130,160,210,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(80,130,210,0.8)'; ctx.lineWidth = 2;
    for (const q of this.parts) {
      ctx.globalAlpha = q.life * 4;
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.04, q.y - q.vy * 0.04); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // counter
    ctx.font = '800 14px "M PLUS Rounded 1c", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(40,70,120,0.75)';
    ctx.fillText(`ぷちっ × ${this.popped} / ${this.bubbles.length}`, 12, h - 12);
    this.texts.draw(ctx);
  }
}
