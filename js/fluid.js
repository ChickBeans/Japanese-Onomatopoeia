// Particle-based viscoelastic fluid (Clavet et al. 2005, "double density relaxation").
// Units: the interaction radius is 1, one step = one time unit. The scene converts to px.
// Changing viscosity / springs / stickiness turns the same engine into
// thick mud (どろどろ), thin soup (しゃばしゃば) or sticky slime (ねちょねちょ).
class Fluid {
  constructor(opts) {
    this.o = Object.assign({
      gravity: 0.01,
      rho0: 2.0,
      k: 0.04,
      kNear: 0.12,
      sigma: 0.0, // linear viscosity
      beta: 0.0, // quadratic viscosity
      bulkDrag: 0.0, // damping inside the bulk: slow, oozing flow
      xsph: 0.0, // velocity smoothing with neighbours (thick, honey-like flow)
      springs: false,
      kSpring: 0.3,
      plasticity: 0.3,
      yieldRatio: 0.1,
      maxSpringLen: 1.6,
      stick: 0.0, // pull toward walls when close
      stickDist: 0.6,
      wallFriction: 0.1,
      max: 1200,
    }, opts);
    const M = this.o.max;
    this.n = 0;
    this.x = new Float32Array(M); this.y = new Float32Array(M);
    this.px = new Float32Array(M); this.py = new Float32Array(M);
    this.vx = new Float32Array(M); this.vy = new Float32Array(M);
    this.rho = new Float32Array(M); this.rhoN = new Float32Array(M);
    this.cellOf = new Int32Array(M); this.order = new Int32Array(M);
    this.pairCap = M * 24;
    this.pi = new Int32Array(this.pairCap); this.pj = new Int32Array(this.pairCap);
    this.np = 0;
    this.springMap = new Map();
    this.W = 10; this.H = 10;
    this.obstacles = []; // {x,y,r,dx,dy,drag}
    this.onConstrain = null;
  }

  setBounds(W, H) { this.W = W; this.H = H; }

  clear() { this.n = 0; this.springMap.clear(); }

  add(x, y, vx = 0, vy = 0) {
    if (this.n >= this.o.max) return -1;
    const i = this.n++;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    return i;
  }

  buildPairs() {
    const n = this.n, cols = Math.ceil(this.W) + 2, rows = Math.ceil(this.H) + 2;
    const nc = cols * rows;
    if (!this.cellStart || this.cellStart.length < nc + 1) this.cellStart = new Int32Array(nc + 1);
    const cs = this.cellStart;
    cs.fill(0);
    for (let i = 0; i < n; i++) {
      const cx = Math.min(cols - 1, Math.max(0, (this.x[i] | 0) + 1));
      const cy = Math.min(rows - 1, Math.max(0, (this.y[i] | 0) + 1));
      const c = cy * cols + cx;
      this.cellOf[i] = c;
      cs[c + 1]++;
    }
    for (let c = 0; c < nc; c++) cs[c + 1] += cs[c];
    const fill = this._fill && this._fill.length >= nc ? this._fill : (this._fill = new Int32Array(nc));
    fill.set(cs.subarray(0, nc));
    for (let i = 0; i < n; i++) this.order[fill[this.cellOf[i]]++] = i;

    let np = 0;
    const x = this.x, y = this.y;
    for (let i = 0; i < n; i++) {
      const c = this.cellOf[i];
      const cx = c % cols, cy = (c / cols) | 0;
      for (let oy = -1; oy <= 1; oy++) {
        const yy = cy + oy;
        if (yy < 0 || yy >= rows) continue;
        for (let ox = -1; ox <= 1; ox++) {
          const xx = cx + ox;
          if (xx < 0 || xx >= cols) continue;
          const cc = yy * cols + xx;
          for (let k = cs[cc], e = cs[cc + 1]; k < e; k++) {
            const j = this.order[k];
            if (j <= i) continue;
            const dx = x[j] - x[i], dy = y[j] - y[i];
            if (dx * dx + dy * dy < 1 && np < this.pairCap) {
              this.pi[np] = i; this.pj[np] = j; np++;
            }
          }
        }
      }
    }
    this.np = np;
  }

  step() {
    const o = this.o, n = this.n;
    const x = this.x, y = this.y, vx = this.vx, vy = this.vy, px = this.px, py = this.py;
    for (let i = 0; i < n; i++) vy[i] += o.gravity;

    this.buildPairs();
    const pi = this.pi, pj = this.pj, np = this.np;

    // Viscosity impulses.
    if (o.sigma > 0 || o.beta > 0) {
      for (let p = 0; p < np; p++) {
        const i = pi[p], j = pj[p];
        const dx = x[j] - x[i], dy = y[j] - y[i];
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r < 1e-6) continue;
        const nx = dx / r, ny = dy / r;
        const u = (vx[i] - vx[j]) * nx + (vy[i] - vy[j]) * ny;
        if (u > 0) {
          const I = 0.5 * (1 - r) * (o.sigma * u + o.beta * u * u);
          vx[i] -= I * nx; vy[i] -= I * ny;
          vx[j] += I * nx; vy[j] += I * ny;
        }
      }
    }

    // XSPH smoothing: neighbours share velocity, which also resists shearing.
    if (o.xsph > 0) {
      const ax = this.rho, ay = this.rhoN, ws = this._ws || (this._ws = new Float32Array(o.max));
      ax.fill(0, 0, n); ay.fill(0, 0, n); ws.fill(0, 0, n);
      for (let p = 0; p < np; p++) {
        const i = pi[p], j = pj[p];
        const dx = x[j] - x[i], dy = y[j] - y[i];
        const w = 1 - Math.sqrt(dx * dx + dy * dy);
        if (w <= 0) continue;
        ax[i] += w * (vx[j] - vx[i]); ay[i] += w * (vy[j] - vy[i]); ws[i] += w;
        ax[j] += w * (vx[i] - vx[j]); ay[j] += w * (vy[i] - vy[j]); ws[j] += w;
      }
      for (let i = 0; i < n; i++) {
        if (ws[i] > 0) { const c = o.xsph / Math.max(1, ws[i]); vx[i] += ax[i] * c; vy[i] += ay[i] * c; }
      }
    }

    // Moving obstacles drag nearby fluid along (stirring).
    for (const ob of this.obstacles) {
      if (!ob.drag) continue;
      const R2 = (ob.r + 1) * (ob.r + 1);
      for (let i = 0; i < n; i++) {
        const dx = x[i] - ob.x, dy = y[i] - ob.y;
        if (dx * dx + dy * dy < R2) {
          vx[i] += (ob.dx - vx[i]) * ob.drag;
          vy[i] += (ob.dy - vy[i]) * ob.drag;
        }
      }
    }

    for (let i = 0; i < n; i++) {
      px[i] = x[i]; py[i] = y[i];
      x[i] += vx[i]; y[i] += vy[i];
    }

    if (o.springs) this.springStep(np);

    // Double density relaxation.
    const rho = this.rho, rhoN = this.rhoN;
    rho.fill(0, 0, n); rhoN.fill(0, 0, n);
    for (let p = 0; p < np; p++) {
      const i = pi[p], j = pj[p];
      const dx = x[j] - x[i], dy = y[j] - y[i];
      const r2 = dx * dx + dy * dy;
      if (r2 >= 1) continue;
      const q = 1 - Math.sqrt(r2), q2 = q * q, q3 = q2 * q;
      rho[i] += q2; rho[j] += q2; rhoN[i] += q3; rhoN[j] += q3;
    }
    for (let p = 0; p < np; p++) {
      const i = pi[p], j = pj[p];
      const dx = x[j] - x[i], dy = y[j] - y[i];
      const r2 = dx * dx + dy * dy;
      if (r2 >= 1 || r2 < 1e-12) continue;
      const r = Math.sqrt(r2), q = 1 - r;
      const P = o.k * (rho[i] + rho[j] - 2 * o.rho0) * 0.5;
      const Pn = o.kNear * (rhoN[i] + rhoN[j]) * 0.5;
      const D = 0.5 * (P * q + Pn * q * q) / r;
      x[i] -= D * dx; y[i] -= D * dy;
      x[j] += D * dx; y[j] += D * dy;
    }

    this.collide();

    const bd = o.bulkDrag;
    for (let i = 0; i < n; i++) {
      vx[i] = x[i] - px[i];
      vy[i] = y[i] - py[i];
      if (bd > 0) {
        const keep = 1 - bd * Math.min(1, rho[i] / o.rho0);
        vx[i] *= keep; vy[i] *= keep;
      }
      // keep things sane if something gets flung hard
      const s2 = vx[i] * vx[i] + vy[i] * vy[i];
      if (s2 > 0.64) { const s = 0.8 / Math.sqrt(s2); vx[i] *= s; vy[i] *= s; }
    }
  }

  springStep(np) {
    const o = this.o, x = this.x, y = this.y, M = o.max, map = this.springMap;
    const pi = this.pi, pj = this.pj;
    for (let p = 0; p < np; p++) {
      const i = pi[p], j = pj[p];
      const key = i * M + j;
      const dx = x[j] - x[i], dy = y[j] - y[i];
      const r = Math.sqrt(dx * dx + dy * dy);
      let L = map.get(key);
      if (L === undefined) { if (map.size < M * 8) map.set(key, r); continue; }
      const d = o.yieldRatio * L;
      if (r > L + d) L += o.plasticity * (r - L - d);
      else if (r < L - d) L = Math.max(0.45, L - o.plasticity * (L - d - r));
      map.set(key, L);
    }
    for (const [key, L] of map) {
      const i = (key / M) | 0, j = key - i * M;
      if (i >= this.n || j >= this.n) { map.delete(key); continue; }
      const dx = x[j] - x[i], dy = y[j] - y[i];
      const r = Math.sqrt(dx * dx + dy * dy);
      if (L > o.maxSpringLen || r > o.maxSpringLen * 1.3) { map.delete(key); continue; }
      if (r < 1e-6) continue;
      const D = 0.5 * o.kSpring * (1 - L / o.maxSpringLen) * (L - r) / r;
      x[i] -= D * dx; y[i] -= D * dy;
      x[j] += D * dx; y[j] += D * dy;
    }
  }

  collide() {
    const o = this.o, n = this.n, x = this.x, y = this.y, px = this.px, py = this.py;
    const m = 0.15, W = this.W - m, H = this.H - m;
    for (const ob of this.obstacles) {
      const R = ob.r, R2 = R * R;
      for (let i = 0; i < n; i++) {
        const dx = x[i] - ob.x, dy = y[i] - ob.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const d = Math.sqrt(d2) || 1e-4;
          x[i] = ob.x + (dx / d) * R;
          y[i] = ob.y + (dy / d) * R;
        }
      }
    }
    if (this.onConstrain) this.onConstrain(this);
    const f = o.wallFriction, st = o.stick, sd = o.stickDist;
    for (let i = 0; i < n; i++) {
      if (st > 0) {
        // sticky walls: particles near a wall get pulled onto it
        let d = x[i] - m; if (d < sd) x[i] -= st * d * (1 - d / sd);
        d = W - x[i]; if (d < sd) x[i] += st * d * (1 - d / sd);
        d = y[i] - m; if (d < sd) y[i] -= st * d * (1 - d / sd);
        d = H - y[i]; if (d < sd) y[i] += st * d * (1 - d / sd);
      }
      if (x[i] < m) { x[i] = m; y[i] -= (y[i] - py[i]) * f; }
      else if (x[i] > W) { x[i] = W; y[i] -= (y[i] - py[i]) * f; }
      if (y[i] < m) { y[i] = m; x[i] -= (x[i] - px[i]) * f; }
      else if (y[i] > H) { y[i] = H; x[i] -= (x[i] - px[i]) * f; }
    }
  }
}

// Metaball renderer: splats particles into a low-res field and shades it like a glossy liquid.
class FluidRenderer {
  constructor() {
    this.cv = document.createElement('canvas');
    this.cx = this.cv.getContext('2d');
  }
  resize(w, h, cell) {
    this.cell = cell;
    this.gw = Math.ceil(w / cell) + 1;
    this.gh = Math.ceil(h / cell) + 1;
    this.cv.width = this.gw; this.cv.height = this.gh;
    this.field = new Float32Array(this.gw * this.gh);
    this.img = this.cx.createImageData(this.gw, this.gh);
  }
  // xs/ys in px; radius in px; color {r,g,b,a}; light: specular strength
  render(ctx, xs, ys, n, radius, col, opt = {}) {
    const { gw, gh, cell, field } = this;
    field.fill(0);
    const R = radius / cell, R2 = R * R, ri = Math.ceil(R);
    for (let i = 0; i < n; i++) {
      const gx = xs[i] / cell, gy = ys[i] / cell;
      const x0 = Math.max(0, (gx | 0) - ri), x1 = Math.min(gw - 1, (gx | 0) + ri + 1);
      const y0 = Math.max(0, (gy | 0) - ri), y1 = Math.min(gh - 1, (gy | 0) + ri + 1);
      for (let yy = y0; yy <= y1; yy++) {
        const dy = yy - gy, row = yy * gw;
        for (let xx = x0; xx <= x1; xx++) {
          const dx = xx - gx, d2 = dx * dx + dy * dy;
          if (d2 < R2) { const t = 1 - d2 / R2; field[row + xx] += t * t; }
        }
      }
    }
    const data = this.img.data, T = opt.threshold || 0.55;
    const spec = opt.spec ?? 0.8, edge = opt.edgeDark ?? 0.35;
    for (let yy = 0; yy < gh; yy++) {
      for (let xx = 0; xx < gw; xx++) {
        const k = yy * gw + xx, f = field[k], o = k * 4;
        if (f < T - 0.25) { data[o + 3] = 0; continue; }
        const a = Math.min(1, Math.max(0, (f - (T - 0.25)) / 0.5));
        // clamp the field before taking the gradient so the inside reads as one smooth surface
        const cap = T + 0.45, cl = (v) => (v < cap ? v : cap);
        const fx = (xx > 1 && xx < gw - 2) ? (cl(field[k + 2]) - cl(field[k - 2])) * 0.5 : 0;
        const fy = (yy > 1 && yy < gh - 2) ? (cl(field[k + 2 * gw]) - cl(field[k - 2 * gw])) * 0.5 : 0;
        // normal from field gradient; light from upper-left
        const gs = cell * 0.08, nl = Math.hypot(fx / gs, fy / gs, 0.6);
        const nx = -fx / gs / nl, ny = -fy / gs / nl, nz = 0.6 / nl;
        let lam = 0.55 + 0.45 * (-0.45 * nx - 0.6 * ny + 0.65 * nz);
        const depth = Math.min(1, f / 3);
        lam *= 1 - edge * (1 - depth);
        const hl = Math.max(0, -0.4 * nx - 0.55 * ny + 0.73 * nz);
        const s = spec * Math.pow(hl, 18) * 255;
        data[o] = Math.min(255, col.r * lam + s);
        data[o + 1] = Math.min(255, col.g * lam + s);
        data[o + 2] = Math.min(255, col.b * lam + s);
        data[o + 3] = 255 * a * (col.a ?? 1) * (opt.depthAlpha ? 0.55 + 0.45 * depth : 1);
      }
    }
    this.cx.putImageData(this.img, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.cv, 0, 0, gw * cell, gh * cell);
    ctx.restore();
  }
}

if (typeof module !== 'undefined') module.exports = { Fluid };
