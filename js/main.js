// App shell: home list, scene stage, render loop and pointer routing.
(() => {
  const $ = (id) => document.getElementById(id);
  const home = $('home'), stage = $('stage'), wrap = $('canvas-wrap'), cv = $('cv');
  const ctx = cv.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  let idx = -1, scene = null, hintTimer = 0;

  // ---------- home ----------
  const cards = $('cards');
  SCENES.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'card';
    b.style.setProperty('--c', s.color);
    b.innerHTML = `<span class="emoji">${s.emoji}</span><span class="kana${s.kana.length > 4 ? ' long' : ''}">${s.kana}</span>` +
      `<span class="romaji">${s.romaji}</span><span class="short">${s.short}</span>`;
    b.addEventListener('click', () => open(i));
    cards.appendChild(b);
  });

  // ---------- stage ----------
  function open(i) {
    Sound.ensure();
    close(false);
    idx = (i + SCENES.length) % SCENES.length;
    const s = SCENES[idx];
    home.classList.add('hidden');
    stage.classList.remove('hidden');
    $('w-kana').textContent = s.kana;
    $('w-kata').textContent = s.kata;
    $('w-romaji').textContent = s.romaji;
    $('w-meaning').textContent = s.meaning;
    $('w-nuance').textContent = s.nuance;
    $('ex-ja').textContent = s.example.ja;
    $('ex-en').textContent = s.example.en;
    $('prev-name').textContent = SCENES[(idx - 1 + SCENES.length) % SCENES.length].kana;
    $('next-name').textContent = SCENES[(idx + 1) % SCENES.length].kana;
    $('pos').textContent = `${idx + 1} / ${SCENES.length}`;
    document.documentElement.style.setProperty('--accent', s.accent || '#ff7a59');
    const hint = $('hint');
    hint.textContent = s.hint;
    hint.classList.remove('faded');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.add('faded'), 6000);
    measure();
    scene = s.create(w, h);
    const acts = $('actions');
    acts.innerHTML = '';
    for (const a of scene.actions || []) {
      const b = document.createElement('button');
      b.textContent = a.label;
      b.addEventListener('click', () => { Sound.ensure(); a.fn(); });
      acts.appendChild(b);
    }
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
  $('word').addEventListener('click', () => Sound.speak(SCENES[idx].kana));
  $('example').addEventListener('click', () => Sound.speak(SCENES[idx].example.ja, 0.9));
  $('btn-mute').addEventListener('click', (e) => {
    Sound.setMuted(!Sound.muted);
    e.currentTarget.textContent = Sound.muted ? '🔇' : '🔈';
  });
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
    $('hint').classList.add('faded');
    if (scene && scene.down) scene.down(p);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!scene) return;
    const p = pos(e);
    p.pressed = pointers.has(e.pointerId);
    if (p.pressed) pointers.set(e.pointerId, p);
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

  // ---------- loop ----------
  let last = performance.now();
  function frame(t) {
    const dt = Math.min(1 / 30, Math.max(0.001, (t - last) / 1000));
    last = t;
    if (scene) {
      scene.update(dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      scene.draw(ctx);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // deep link: index.html#mochimochi
  const start = SCENES.findIndex((s) => '#' + s.id === location.hash);
  if (start >= 0) open(start);

  window.App = { open, close, get scene() { return scene; } };
})();
