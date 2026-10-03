// App shell: word tiles, scene stage, render loop, pointer routing and the "ghost finger" cue.
(() => {
  const $ = (id) => document.getElementById(id);
  const home = $('home'), stage = $('stage'), wrap = $('canvas-wrap'), cv = $('cv');
  const ctx = cv.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  let idx = -1, scene = null;

  // ---------- home ----------
  SCENES.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'tile' + (s.kana.length > 4 ? ' long' : '');
    b.style.setProperty('--c', s.color);
    b.textContent = s.kana;
    b.addEventListener('click', () => open(i));
    $('tiles').appendChild(b);
  });

  // ---------- stage ----------
  function say() {
    Sound.speak(SCENES[idx].kana);
    const wd = $('word');
    wd.classList.remove('say');
    void wd.offsetWidth;
    wd.classList.add('say');
  }

  function open(i) {
    Sound.ensure();
    close(false);
    idx = (i + SCENES.length) % SCENES.length;
    const s = SCENES[idx];
    home.classList.add('hidden');
    stage.classList.remove('hidden');
    $('w-kana').textContent = s.kana;
    $('w-romaji').textContent = s.romaji;
    measure();
    scene = s.create(w, h);
    $('btn-reset').classList.toggle('hidden', !(scene.actions && scene.actions.length));
    cue.reset();
    say();
    if (location.hash !== '#' + s.id) history.replaceState(null, '', '#' + s.id);
  }

  function close(showHome = true) {
    if (scene && scene.destroy) scene.destroy();
    Sound.stopAllLoops();
    scene = null;
    pointers.clear();
    if (showHome) {
      stage.classList.add('hidden');
      home.classList.remove('hidden');
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function measure() {
    const r = wrap.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nw = Math.max(1, Math.round(r.width)), nh = Math.max(1, Math.round(r.height));
    if (nw === w && nh === h && cv.width === Math.round(nw * dpr)) return false;
    w = nw; h = nh;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    return true;
  }

  new ResizeObserver(() => {
    if (stage.classList.contains('hidden')) return;
    if (measure() && scene && scene.resize) scene.resize(w, h);
  }).observe(wrap);

  $('btn-home').addEventListener('click', () => close(true));
  $('btn-prev').addEventListener('click', () => open(idx - 1));
  $('btn-next').addEventListener('click', () => open(idx + 1));
  $('btn-reset').addEventListener('click', () => { Sound.ensure(); if (scene && scene.actions) scene.actions[0].fn(); });
  $('word').addEventListener('click', say);
  window.addEventListener('keydown', (e) => {
    if (stage.classList.contains('hidden')) return;
    if (e.key === 'ArrowLeft') open(idx - 1);
    else if (e.key === 'ArrowRight') open(idx + 1);
    else if (e.key === 'Escape') close(true);
  });

  // ---------- pointers ----------
  const pointers = new Map();
  function pos(e) {
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId };
  }
  cv.addEventListener('pointerdown', (e) => {
    Sound.ensure();
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    const p = pos(e);
    pointers.set(e.pointerId, p);
    cue.touched();
    if (scene && scene.down) scene.down(p);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!scene) return;
    const p = pos(e);
    p.pressed = pointers.has(e.pointerId);
    if (p.pressed) { pointers.set(e.pointerId, p); cue.touched(); }
    if (scene.move) scene.move(p);
  });
  const up = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (scene && scene.up) scene.up(pos(e));
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------- ghost finger: shows the gesture instead of explaining it ----------
  const cue = {
    idle: 0, used: false, t: 0, path: null,
    reset() { this.idle = 0; this.used = false; this.t = 0; this.path = null; },
    touched() { this.idle = 0; this.used = true; this.t = 0; this.path = null; },
    update(dt) {
      this.idle += dt;
      const wait = this.used ? 12 : 0.9;
      if (pointers.size || this.idle < wait || !scene || !SCENES[idx].cue) { this.t = 0; this.path = null; return; }
      if (!this.path) { this.path = SCENES[idx].cue(scene); this.t = 0; }
      this.t += dt / 2.4;
      if (this.t >= 1) this.path = null;
    },
    draw(g) {
      const p = this.path;
      if (!p) return;
      const t = this.t, ease = (k) => k * k * (3 - 2 * k);
      let x = p.x, y = p.y, alpha = 1, pressed = t > 0.2 && t < 0.8;
      if (t < 0.2) alpha = t / 0.2;
      else if (t > 0.8) alpha = (1 - t) / 0.2;
      if (p.x2 !== undefined && t > 0.25) {
        let k;
        if (p.rub) k = (1 - Math.cos(U.clamp((t - 0.25) / 0.55, 0, 1) * Math.PI * 4)) / 2;
        else if (p.hold) k = ease(U.clamp((t - 0.42) / 0.35, 0, 1));
        else if (p.fast) k = ease(U.clamp((t - 0.25) / 0.2, 0, 1));
        else k = ease(U.clamp((t - 0.25) / 0.5, 0, 1));
        x = p.x + (p.x2 - p.x) * k;
        y = p.y + (p.y2 - p.y) * k;
        if (!p.rub) {
          g.strokeStyle = `rgba(255,255,255,${0.5 * alpha})`;
          g.lineWidth = 3; g.lineCap = 'round'; g.setLineDash([2, 8]);
          g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(x, y); g.stroke();
          g.setLineDash([]);
        }
      }
      if (p.x2 === undefined) pressed = t > 0.3 && t < 0.45;
      // press ripple
      if (t > 0.2 && t < 0.6) {
        const rk = (t - 0.2) / 0.4;
        g.strokeStyle = `rgba(255,255,255,${0.7 * (1 - rk)})`;
        g.lineWidth = 2;
        g.beginPath(); g.arc(p.x, p.y, 18 + rk * 26, 0, Math.PI * 2); g.stroke();
      }
      g.save();
      g.globalAlpha = alpha * 0.9;
      g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowBlur = pressed ? 4 : 14; g.shadowOffsetY = pressed ? 1 : 6;
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(x, y - (pressed ? 0 : 4), pressed ? 15 : 18, 0, Math.PI * 2); g.fill();
      g.restore();
    },
  };

  // ---------- loop ----------
  let last = performance.now();
  function frame(t) {
    const dt = Math.min(1 / 30, Math.max(0.001, (t - last) / 1000));
    last = t;
    if (scene) {
      scene.update(dt);
      cue.update(dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      scene.draw(ctx);
      cue.draw(ctx);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // deep link: index.html#mochimochi
  const start = SCENES.findIndex((s) => '#' + s.id === location.hash);
  if (start >= 0) open(start);

  window.App = { open, close, get scene() { return scene; } };
})();
