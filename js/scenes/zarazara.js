// ざらざら — rub your finger over sandpaper: it catches, judders and scatters grit.
SCENES.push({
  id: 'zarazara', kana: 'ざらざら', kata: 'ザラザラ', romaji: 'zara-zara', emoji: '🪨',
  color: '#d8c3a0', accent: '#8a6a3a',
  short: 'Rough, gritty, coarse',
  meaning: 'Rough and gritty to the touch; a coarse, bumpy surface.',
  nuance: '😕 Usually not nice: sandpaper, a sandy floor, rough dry skin, a husky voice.',
  example: { ja: '紙やすりはざらざらしている。', en: 'Sandpaper feels rough.' },
  hint: 'Rub your finger back and forth across the surface. Feel it catch on the bumps.',
  create: (w, h) => new ZaraScene(w, h),
});

class ZaraScene {
  constructor(w, h) {
    this.t = 0;
    this.texts = new FloatTexts();
    this.parts = [];
    this.trail = [];
    this.ptr = null;
    this.buzz = 0;
    this.resize(w, h);
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.secH = Math.round(U.clamp(h * 0.26, 110, 190));
    this.boardH = h - this.secH;
    // pre-render the rough texture once
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * dpr); cv.height = Math.round(this.boardH * dpr);
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    c.fillStyle = '#b48a55';
    c.fillRect(0, 0, w, this.boardH);
    const n = Math.round((w * this.boardH) / 14);
    for (let i = 0; i < n; i++) {
      const x = Math.random() * w, y = Math.random() * this.boardH, s = U.rand(1, 3.6);
      const l = U.rand(28, 72);
      c.fillStyle = `hsl(${U.rand(25, 40)},${U.rand(25, 45)}%,${l}%)`;
      c.beginPath();
      c.moveTo(x + U.rand(-s, s), y + U.rand(-s, s));
      c.lineTo(x + U.rand(-s, s), y + U.rand(-s, s));
      c.lineTo(x + U.rand(-s, s), y + U.rand(-s, s));
      c.fill();
    }
    // glints on the grains
    for (let i = 0; i < n / 8; i++) {
      c.fillStyle = 'rgba(255,245,220,0.6)';
      c.fillRect(Math.random() * w, Math.random() * this.boardH, 1, 1);
    }
    const vg = c.createRadialGradient(w / 2, this.boardH / 2, 10, w / 2, this.boardH / 2, Math.max(w, this.boardH) * 0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(60,30,0,0.25)');
    c.fillStyle = vg; c.fillRect(0, 0, w, this.boardH);
    this.tex = cv;
    // jagged cross-section profile: one bump every few px
    this.step = 7;
    this.prof = [];
    for (let x = 0; x <= w + this.step; x += this.step) this.prof.push((U.rand(0, 1) ** 0.7 * 0.6 + (Math.random() < 0.15 ? 0.3 : 0)) * this.secH * 0.3);
  }

  profileAt(x) {
    const i = x / this.step, a = Math.floor(i), f = i - a;
    const p0 = this.prof[U.clamp(a, 0, this.prof.length - 1)], p1 = this.prof[U.clamp(a + 1, 0, this.prof.length - 1)];
    return p0 + (p1 - p0) * f;
  }

  down(p) {
    if (p.y > this.boardH) p.y = this.boardH - 4;
    this.ptr = { x: p.x, y: p.y, lx: p.x, ly: p.y, jx: 0, jy: 0, speed: 0, dist: 0 };
    if (!this.loop) this.loop = Sound.loop({ type: 'bandpass', freq: 1800, q: 0.8 });
  }

  move(p) {
    if (!this.ptr || !p.pressed) return;
    this.ptr.x = p.x;
    this.ptr.y = Math.min(p.y, this.boardH - 4);
  }

  up() {
    this.ptr = null;
    if (this.loop) this.loop.set(0);
  }

  update(dt) {
    this.t += dt;
    const p = this.ptr;
    if (p) {
      const dx = p.x - p.lx, dy = p.y - p.ly, d = Math.hypot(dx, dy);
      p.lx = p.x; p.ly = p.y;
      p.speed += (d / dt - p.speed) * 0.35;
      // stick-slip judder grows with speed
      const amp = Math.min(7, p.speed / 120);
      p.jx = U.rand(-amp, amp); p.jy = U.rand(-amp, amp);
      // every bump crossed makes a tiny click
      p.dist += d;
      let clicks = 0;
      while (p.dist > this.step && clicks < 6) {
        p.dist -= this.step;
        clicks++;
        Sound.noise({ dur: 0.012, type: 'bandpass', freq: U.rand(1500, 4500), q: 1.5, gain: 0.05 + Math.min(0.12, p.speed / 6000) });
      }
      if (p.dist > this.step) p.dist = 0;
      if (this.loop) this.loop.set(Math.min(0.35, p.speed / 2500) * (0.6 + Math.random() * 0.4), 1200 + Math.min(2500, p.speed));
      this.buzz += dt;
      if (p.speed > 80 && this.buzz > 0.07) { this.buzz = 0; Sound.vibrate(10); }
      if (p.speed > 60) {
        this.trail.push({ x: p.x + p.jx, y: p.y + p.jy, life: 1.5, a: Math.atan2(dy, dx) });
        const n = Math.min(4, Math.floor(p.speed / 300) + (Math.random() < 0.5 ? 1 : 0));
        for (let i = 0; i < n; i++) {
          this.parts.push({ x: p.x + U.rand(-10, 10), y: p.y + U.rand(-6, 6), vx: -dx / dt * U.rand(0.05, 0.25) + U.rand(-60, 60), vy: U.rand(-120, -20), life: U.rand(0.4, 0.9), s: U.rand(1, 2.6) });
        }
      }
      if (p.speed > 500 && Math.random() < dt * 2.5) {
        this.texts.add(p.x + U.rand(-30, 30), p.y - 46, U.pick(['ざらざら', 'ざらっ', 'じょりじょり', 'ガリガリ']), '#6e4c1e');
      }
    }
    for (const t of this.trail) t.life -= dt;
    this.trail = this.trail.filter((t) => t.life > 0).slice(-160);
    for (const q of this.parts) { q.vy += 500 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
    this.parts = this.parts.filter((q) => q.life > 0);
    this.texts.update(dt);
  }

  draw(ctx) {
    const { w, h, boardH, secH } = this, p = this.ptr;
    ctx.drawImage(this.tex, 0, 0, w, boardH);
    // scuff marks
    ctx.lineCap = 'round';
    for (const t of this.trail) {
      ctx.strokeStyle = `rgba(255,240,210,${0.25 * t.life})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(t.x - Math.cos(t.a) * 8, t.y - Math.sin(t.a) * 8 + U.rand(-1, 1));
      ctx.lineTo(t.x + Math.cos(t.a) * 8, t.y + Math.sin(t.a) * 8 + U.rand(-1, 1));
      ctx.stroke();
    }
    for (const q of this.parts) {
      ctx.fillStyle = `rgba(110,75,35,${Math.min(1, q.life * 2)})`;
      ctx.fillRect(q.x, q.y, q.s, q.s);
    }
    if (p) {
      const x = p.x + p.jx, y = p.y + p.jy;
      ctx.fillStyle = 'rgba(255,212,190,0.92)'; ctx.strokeStyle = 'rgba(160,100,80,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, 22, 27, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(190,130,110,0.5)'; ctx.lineWidth = 1;
      for (let r = 5; r < 20; r += 4) { ctx.beginPath(); ctx.ellipse(x, y + 2, r * 0.8, r, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    }

    // cross-section panel: the finger riding over the bumps
    const y0 = boardH;
    ctx.fillStyle = '#fbf6ee'; ctx.fillRect(0, y0, w, secH);
    ctx.fillStyle = 'rgba(80,60,40,0.55)';
    ctx.font = '700 12px "M PLUS Rounded 1c", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('断面 cross-section (zoomed)', 12, y0 + 18);
    const base = y0 + secH - 22;
    ctx.beginPath();
    ctx.moveTo(0, base + 20);
    for (let x = 0; x <= w; x += this.step) ctx.lineTo(x, base - this.profileAt(x));
    ctx.lineTo(w, base + 20);
    ctx.closePath();
    ctx.fillStyle = '#b48a55'; ctx.fill();
    ctx.strokeStyle = '#6e4c1e'; ctx.lineWidth = 1.5; ctx.stroke();
    const fx = p ? p.x : w / 2;
    const fr = Math.min(34, secH * 0.2);
    let top = 0;
    for (let k = -fr * 0.6; k <= fr * 0.6; k += 2) top = Math.max(top, this.profileAt(U.clamp(fx + k, 0, w)) - (fr - Math.sqrt(fr * fr - k * k)));
    const fy = base - top - fr + (p ? p.jy * 0.6 : 0);
    ctx.fillStyle = p ? 'rgba(255,212,190,0.95)' : 'rgba(255,212,190,0.5)';
    ctx.strokeStyle = 'rgba(160,100,80,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (p && p.speed > 60) {
      ctx.strokeStyle = 'rgba(110,76,30,0.7)'; ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + U.rand(-0.8, 0.8);
        ctx.beginPath();
        ctx.moveTo(fx + Math.cos(a) * (fr + 4), fy + Math.sin(a) * (fr + 4));
        ctx.lineTo(fx + Math.cos(a) * (fr + 12), fy + Math.sin(a) * (fr + 12));
        ctx.stroke();
      }
    }
    this.texts.draw(ctx);
  }

  destroy() { if (this.loop) this.loop.stop(); }
}
