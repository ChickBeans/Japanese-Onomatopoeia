// ぷちぷち — bubble wrap. Press each bubble until it pops.
SCENES.push({
  id: 'puchipuchi', kana: 'ぷちぷち', kata: 'プチプチ', romaji: 'puchi-puchi', emoji: '🫧',
  act: { ja: 'プチプチをつぶしてみよう', en: 'Pop the bubbles.' },
  cue: (s) => { const b = s.bubbles[Math.floor(s.bubbles.length / 2)]; return { x: b.x, y: b.y }; },
  color: '#cfe3ff', accent: '#3b7bd8',
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
    ctx.fillStyle = INK.bg; ctx.fillRect(0, 0, w, h);
    for (const b of this.bubbles) {
      if (b.state === 1) {
        // flattened plastic: a dull crumpled polygon
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.beginPath();
        b.crinkle.forEach((c, k) => {
          const a = (k / b.crinkle.length) * Math.PI * 2;
          k ? ctx.lineTo(Math.cos(a) * r * c, Math.sin(a) * r * c) : ctx.moveTo(Math.cos(a) * r * c, Math.sin(a) * r * c);
        });
        ctx.closePath();
        ctx.fillStyle = '#1a1a1a'; ctx.fill();
        ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();
        continue;
      }
      // intact bubble: a faceted dome that squashes while pressed
      const sx = 1 + b.press * 0.12, sy = 1 - b.press * 0.3;
      const xs = [], ys = [];
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + b.rot * 0.1;
        xs.push(b.x + Math.cos(a) * r * sx); ys.push(b.y + Math.sin(a) * r * sy);
      }
      U.facet(ctx, xs, ys, 10, b.x - r * 0.2, b.y - r * 0.25 * sy, [225, 225, 225], { lo: 0.32, inner: 0.5 });
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
    for (const q of this.parts) {
      ctx.globalAlpha = q.life * 4;
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.04, q.y - q.vy * 0.04); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this.texts.draw(ctx);
  }
}
