// Position-based soft body: a ring of points held together by edge lengths,
// an area (volume) constraint and shape matching back to the rest shape.
// Weak shape + heavy damping = もちもち (stretchy, slow to recover)
// Strong shape + light damping = ぷるぷる (fast jiggle)
class SoftBody {
  constructor(restX, restY, opts) {
    this.o = Object.assign({ shape: 0.02, ring: 0.3, area: 0.5, damp: 0.99, gravity: 1500, iters: 4, plastic: 0, recover: 0 }, opts);
    const n = (this.n = restX.length);
    this.x = Float32Array.from(restX); this.y = Float32Array.from(restY);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    this.qx = new Float32Array(n); this.qy = new Float32Array(n);
    let cx = 0, cy = 0;
    for (let i = 0; i < n; i++) { cx += restX[i]; cy += restY[i]; }
    cx /= n; cy /= n;
    this.rx = new Float32Array(n); this.ry = new Float32Array(n);
    for (let i = 0; i < n; i++) { this.rx[i] = restX[i] - cx; this.ry[i] = restY[i] - cy; }
    this.L0 = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.L0[i] = Math.hypot(restX[j] - restX[i], restY[j] - restY[i]);
    }
    this.L = Float32Array.from(this.L0); // working rest lengths (plastic bodies stretch these)
    this.A0 = this.areaOf(this.x, this.y);
    this.onConstrain = null; // (body, dt) => void, works on qx/qy
  }

  areaOf(xs, ys) {
    let a = 0;
    for (let i = 0, n = this.n; i < n; i++) { const j = (i + 1) % n; a += xs[i] * ys[j] - xs[j] * ys[i]; }
    return a * 0.5;
  }

  centroid() {
    let cx = 0, cy = 0;
    for (let i = 0; i < this.n; i++) { cx += this.x[i]; cy += this.y[i]; }
    return { x: cx / this.n, y: cy / this.n };
  }

  // signed angle of the best-fit rotation from rest shape to current shape
  fitAngle(xs, ys, cx, cy) {
    let s = 0, c = 0;
    for (let i = 0; i < this.n; i++) {
      const dx = xs[i] - cx, dy = ys[i] - cy;
      c += this.rx[i] * dx + this.ry[i] * dy;
      s += this.rx[i] * dy - this.ry[i] * dx;
    }
    return Math.atan2(s, c);
  }

  step(dt) {
    const o = this.o, n = this.n;
    const { x, y, vx, vy, qx, qy, rx, ry, L } = this;
    for (let i = 0; i < n; i++) {
      vy[i] += o.gravity * dt;
      vx[i] *= o.damp; vy[i] *= o.damp;
      qx[i] = x[i] + vx[i] * dt;
      qy[i] = y[i] + vy[i] * dt;
    }
    for (let it = 0; it < o.iters; it++) {
      // edges
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const dx = qx[j] - qx[i], dy = qy[j] - qy[i];
        const d = Math.hypot(dx, dy) || 1e-6;
        const k = ((d - L[i]) / d) * 0.5 * o.ring;
        qx[i] += dx * k; qy[i] += dy * k;
        qx[j] -= dx * k; qy[j] -= dy * k;
      }
      // area
      const A = this.areaOf(qx, qy);
      let gsum = 0;
      const gx = this._gx || (this._gx = new Float32Array(n)), gy = this._gy || (this._gy = new Float32Array(n));
      for (let i = 0; i < n; i++) {
        const a = (i + n - 1) % n, b = (i + 1) % n;
        gx[i] = 0.5 * (qy[b] - qy[a]);
        gy[i] = 0.5 * (qx[a] - qx[b]);
        gsum += gx[i] * gx[i] + gy[i] * gy[i];
      }
      if (gsum > 1e-9) {
        const lam = ((this.A0 - A) / gsum) * o.area;
        for (let i = 0; i < n; i++) { qx[i] += lam * gx[i]; qy[i] += lam * gy[i]; }
      }
      // shape matching
      let cx = 0, cy = 0;
      for (let i = 0; i < n; i++) { cx += qx[i]; cy += qy[i]; }
      cx /= n; cy /= n;
      const th = this.fitAngle(qx, qy, cx, cy) * (o.allowRotate === false ? 0 : 1);
      const c = Math.cos(th), s = Math.sin(th);
      for (let i = 0; i < n; i++) {
        const gx2 = cx + c * rx[i] - s * ry[i], gy2 = cy + s * rx[i] + c * ry[i];
        qx[i] += (gx2 - qx[i]) * o.shape;
        qy[i] += (gy2 - qy[i]) * o.shape;
      }
      if (this.onConstrain) this.onConstrain(this, dt);
    }
    for (let i = 0; i < n; i++) {
      vx[i] = (qx[i] - x[i]) / dt;
      vy[i] = (qy[i] - y[i]) / dt;
      x[i] = qx[i]; y[i] = qy[i];
    }
    if (o.plastic > 0) {
      // stretched dough "remembers" its new length, then slowly creeps back
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const d = Math.hypot(x[j] - x[i], y[j] - y[i]);
        if (d > L[i]) L[i] += (d - L[i]) * Math.min(1, o.plastic * dt);
        L[i] += (this.L0[i] - L[i]) * Math.min(1, o.recover * dt);
      }
    }
  }

  // index of the ring point nearest to (px,py)
  nearest(px, py) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < this.n; i++) {
      const d = (this.x[i] - px) ** 2 + (this.y[i] - py) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return { i: best, d: Math.sqrt(bd) };
  }

  contains(px, py) {
    let inside = false;
    for (let i = 0, j = this.n - 1; i < this.n; j = i++) {
      const xi = this.x[i], yi = this.y[i], xj = this.x[j], yj = this.y[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
}

if (typeof module !== 'undefined') module.exports = { SoftBody };
