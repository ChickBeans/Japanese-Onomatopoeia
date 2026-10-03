// さらさら — scoop up fine dry sand and let it slip through your fingers.
SCENES.push({
  id: 'sarasara', kana: 'さらさら', kata: 'サラサラ', romaji: 'sara-sara', emoji: '⏳',
  cue: (s) => ({ x: s.w * 0.3, y: s.h * 0.92, x2: s.w * 0.45, y2: s.h * 0.3, hold: true }),
  color: '#f6e2b0', accent: '#b8862c',
  create: (w, h) => new SaraScene(w, h),
});

class SaraScene {
  constructor(w, h) {
    this.t = 0;
    this.texts = new FloatTexts();
    this.ptr = null;
    this.held = 0;
    this.flow = 0;
    this.resize(w, h);
    this.actions = [{ label: '↺ Reset', fn: () => this.reset() }];
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.cs = w * h > 700000 ? 3 : 2;
    this.gw = Math.ceil(w / this.cs);
    this.gh = Math.ceil(h / this.cs);
    this.cv = document.createElement('canvas');
    this.cv.width = this.gw; this.cv.height = this.gh;
    this.cx = this.cv.getContext('2d');
    this.img = this.cx.createImageData(this.gw, this.gh);
    this.palette = [
      null, [238, 214, 160], [230, 202, 146], [245, 225, 178], [222, 192, 136], [250, 234, 196], [214, 184, 128],
    ];
    this.reset();
  }

  reset() {
    const { gw, gh } = this;
    this.g = new Uint8Array(gw * gh);
    const g = this.g;
    // two slanted ledges so the sand slides and pours
    const ledge = (x0, y0, len, dir) => {
      for (let k = 0; k < len; k++) {
        const x = x0 + k * dir, y = y0 + Math.floor(k / 2.2);
        for (let t = 0; t < 3; t++) if (x >= 0 && x < gw && y + t < gh) g[(y + t) * gw + x] = 255;
      }
    };
    ledge(Math.floor(gw * 0.08), Math.floor(gh * 0.38), Math.floor(gw * 0.42), 1);
    ledge(Math.floor(gw * 0.92), Math.floor(gh * 0.58), Math.floor(gw * 0.38), -1);
    // a soft dune at the bottom
    for (let x = 0; x < gw; x++) {
      const hgt = Math.floor(gh * (0.16 + 0.08 * Math.sin((x / gw) * Math.PI * 1.3 + 0.4)));
      for (let y = gh - hgt; y < gh; y++) g[y * gw + x] = 1 + ((Math.random() * 6) | 0);
    }
    this.held = 0;
  }

  down(p) {
    this.ptr = { x: p.x, y: p.y };
    const { gw, gh, cs, g } = this;
    const cx = Math.floor(p.x / cs), cy = Math.floor(p.y / cs), r = Math.round(30 / cs);
    let got = 0;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
        if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
        const i = y * gw + x;
        if (g[i] && g[i] !== 255) { g[i] = 0; got++; }
      }
    }
    // also gather sand above the hand so a scoop feels generous
    for (let y = cy - r * 3; y < cy - r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
        const i = y * gw + x;
        if (g[i] && g[i] !== 255 && Math.random() < 0.5) { g[i] = 0; got++; }
      }
    }
    this.held = Math.min(2500, this.held + got);
    if (got > 20) {
      this.texts.add(p.x, p.y - 40, 'ざくっ', '#a0761c', 18);
      Sound.noise({ dur: 0.18, type: 'highpass', freq: 3000, gain: 0.15 });
    }
    if (!this.loop) this.loop = Sound.loop({ type: 'highpass', freq: 4500, q: 0.6 });
  }

  move(p) {
    if (this.ptr && p.pressed) { this.ptr.x = p.x; this.ptr.y = p.y; }
  }

  up(p) {
    if (this.held > 0) {
      // open the hand: everything falls at once
      this.release(p.x, p.y, this.held, 34);
      this.texts.add(p.x, p.y - 40, 'さーっ', '#a0761c');
    }
    this.held = 0;
    this.ptr = null;
  }

  release(px, py, count, spread) {
    const { gw, gh, cs, g } = this;
    let left = count, tries = count * 4;
    while (left > 0 && tries-- > 0) {
      const x = Math.floor((px + U.rand(-spread, spread)) / cs);
      const y = Math.floor((py + U.rand(-spread * 0.4, spread * 0.6)) / cs);
      if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
      const i = y * gw + x;
      if (!g[i]) { g[i] = 1 + ((Math.random() * 6) | 0); left--; }
    }
  }

  stepSand() {
    const { gw, gh, g } = this;
    let moved = 0;
    for (let y = gh - 2; y >= 0; y--) {
      const ltr = Math.random() < 0.5;
      for (let k = 0; k < gw; k++) {
        const x = ltr ? k : gw - 1 - k;
        const i = y * gw + x, c = g[i];
        if (!c || c === 255) continue;
        const b = i + gw;
        if (!g[b]) { g[b] = c; g[i] = 0; moved++; continue; }
        const l = x > 0 && !g[b - 1], r = x < gw - 1 && !g[b + 1];
        if (l && r) { const t = Math.random() < 0.5 ? b - 1 : b + 1; g[t] = c; g[i] = 0; moved++; }
        else if (l) { g[b - 1] = c; g[i] = 0; moved++; }
        else if (r) { g[b + 1] = c; g[i] = 0; moved++; }
      }
    }
    return moved;
  }

  update(dt) {
    this.t += dt;
    if (this.ptr && this.held > 0) {
      // sand slips out between the fingers
      const n = Math.min(this.held, 6 * this.cs * this.cs / 4 + 6);
      this.release(this.ptr.x, this.ptr.y + 14, n, 12);
      this.held -= n;
      if (Math.random() < dt * 1.2) this.texts.add(this.ptr.x + U.rand(-30, 30), this.ptr.y - 50, U.pick(['さらさら', 'さらさら〜', 'サラサラ']), '#a0761c', 18);
    }
    let moved = 0;
    for (let k = 0; k < 3; k++) moved += this.stepSand();
    this.flow += (moved - this.flow) * 0.15;
    if (this.loop) this.loop.set(Math.min(0.22, this.flow / 2500), 3500 + Math.min(3000, this.flow * 2));
    this.texts.update(dt);
  }

  draw(ctx) {
    const { w, h, gw, gh, g, img, palette } = this;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#ffe9c4'); sky.addColorStop(1, '#ffd9a8');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(w * 0.82, h * 0.14, Math.min(w, h) * 0.07, 0, Math.PI * 2); ctx.fill();
    const d = img.data;
    for (let i = 0, n = gw * gh; i < n; i++) {
      const c = g[i], o = i * 4;
      if (!c) { d[o + 3] = 0; continue; }
      if (c === 255) { d[o] = 140; d[o + 1] = 98; d[o + 2] = 60; d[o + 3] = 255; continue; }
      const col = palette[c];
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
    this.cx.putImageData(img, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.cv, 0, 0, gw * this.cs, gh * this.cs);
    ctx.restore();
    if (this.ptr) {
      const { x, y } = this.ptr;
      // cupped hand
      ctx.fillStyle = 'rgba(255,214,190,0.55)';
      ctx.strokeStyle = 'rgba(170,110,90,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, 40, 22, 0, 0, Math.PI); ctx.fill(); ctx.stroke();
      for (let k = -2; k <= 1; k++) {
        ctx.beginPath(); ctx.ellipse(x + k * 16 + 8, y - 4, 7, 14, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
      }
      if (this.held > 0) {
        const hh = Math.min(18, 4 + this.held / 80);
        ctx.fillStyle = '#e8cf98';
        ctx.beginPath(); ctx.ellipse(x, y + 2, 30, hh, 0, Math.PI, 0); ctx.fill();
      }
    }
    this.texts.draw(ctx);
  }

  destroy() { if (this.loop) this.loop.stop(); }
}
