// Tiny synthesized sound kit (no audio files needed) + speech + haptics.
const Sound = (() => {
  let ctx = null, master = null, noiseBuf = null, muted = false;
  const loops = new Set();

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function envGain(t0, attack, dur, peak) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    return g;
  }

  // One-shot filtered noise burst.
  function noise({ dur = 0.1, type = 'bandpass', freq = 2000, freqEnd = null, q = 1, gain = 0.3, attack = 0.003 } = {}) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    f.Q.value = q;
    const g = envGain(t0, attack, dur, gain);
    src.connect(f).connect(g).connect(master);
    src.start(t0, Math.random() * 1.5, dur + 0.05);
  }

  // One-shot tone with optional pitch glide.
  function tone({ freq = 440, freqEnd = null, dur = 0.15, type = 'sine', gain = 0.2, attack = 0.005 } = {}) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    const g = envGain(t0, attack, dur, gain);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  // Continuous noise whose loudness/colour a scene drives every frame.
  function loop({ type = 'bandpass', freq = 2000, q = 1 } = {}) {
    const dummy = { set() {}, stop() {} };
    if (!ensure()) return dummy;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(master);
    src.start();
    const h = {
      set(level, fr) {
        const t = ctx.currentTime;
        g.gain.setTargetAtTime(Math.max(0, level), t, 0.04);
        if (fr) f.frequency.setTargetAtTime(fr, t, 0.05);
      },
      stop() {
        try { src.stop(); } catch (e) {}
        loops.delete(h);
      },
    };
    loops.add(h);
    return h;
  }

  let jaVoice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices();
    jaVoice = vs.find((v) => /ja[-_]JP/i.test(v.lang)) || vs.find((v) => /^ja/i.test(v.lang)) || null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  function speak(text, rate = 0.8) {
    if (!('speechSynthesis' in window)) return false;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = rate;
    if (jaVoice) u.voice = jaVoice;
    speechSynthesis.speak(u);
    return true;
  }

  function vibrate(p) {
    if (muted || !navigator.vibrate) return;
    try { navigator.vibrate(p); } catch (e) {}
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.9;
  }

  function stopAllLoops() { for (const l of [...loops]) l.stop(); }

  return { ensure, noise, tone, loop, speak, vibrate, setMuted, stopAllLoops, get muted() { return muted; } };
})();
