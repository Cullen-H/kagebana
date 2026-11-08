'use strict';
/* =====================================================================
   KAGEBANA — engine.js
   Math helpers, input (keyboard / mouse / gamepad), synthesized audio,
   procedural music, particles and the anime character renderer.
   ===================================================================== */

// ---------- math ----------
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const angDiff = (a, b) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function weighted(list, wf) {
  let tot = 0;
  for (const it of list) tot += wf(it);
  let r = Math.random() * tot;
  for (const it of list) { r -= wf(it); if (r <= 0) return it; }
  return list[list.length - 1];
}
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}
function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = v => clamp(Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)), 0, 255);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
// distance from point to segment
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// ---------- input ----------
const DEFAULT_BINDS = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  attack: ['Mouse0', 'KeyJ'], special: ['Mouse2', 'KeyK'], dash: ['Space', 'ShiftLeft'], ult: ['KeyQ', 'KeyL'],
  interact: ['KeyF', 'KeyE'], pause: ['KeyP', ''],
};
const BIND_LABELS = { up: 'Move Up', down: 'Move Down', left: 'Move Left', right: 'Move Right', attack: 'Attack', special: 'Special', dash: 'Dash', ult: 'Ultimate', interact: 'Interact', pause: 'Pause (Esc always works)' };
function keyName(c) {
  if (!c) return '—';
  const M = { Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5', Space: 'Space', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', AltRight: 'R-Alt', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: 'Bksp', CapsLock: 'Caps' };
  if (M[c]) return M[c];
  if (c.startsWith('Key')) return c.slice(3);
  if (c.startsWith('Digit')) return c.slice(5);
  if (c.startsWith('Numpad')) return 'Num ' + c.slice(6);
  return c;
}
const Input = {
  keys: {}, pressed: {},
  mouse: { x: 0, y: 0, wx: 0, wy: 0, down: [false, false, false, false, false], pressed: [false, false, false, false, false] },
  pad: null, padPrev: [], usingPad: false, padAim: { x: 1, y: 0 },
  init(canvas) {
    window.addEventListener('keydown', e => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code) &&
          !(e.target && (e.target.tagName === 'INPUT'))) e.preventDefault();
      if (!this.keys[e.code]) this.pressed[e.code] = true;
      this.keys[e.code] = true;
      this.usingPad = false;
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mouse.down = [false, false, false]; });
    canvas.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
      this.usingPad = false;
    });
    canvas.addEventListener('mousedown', e => {
      if (e.button < 5) { this.mouse.down[e.button] = true; this.mouse.pressed[e.button] = true; }
      SFX.unlock();
    });
    window.addEventListener('mouseup', e => { if (e.button < 5) this.mouse.down[e.button] = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', () => SFX.unlock(), { once: false });
  },
  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && [...pads].find(x => x);
    this.pad = p || null;
    if (!p) return;
    const b = p.buttons.map(x => x.pressed);
    const ax = p.axes;
    if (b.some(x => x) || Math.hypot(ax[0], ax[1]) > 0.3) this.usingPad = true;
    this.padNow = b;
    this.padHit = b.map((v, i) => v && !this.padPrev[i]);
    this.padPrev = b;
    if (Math.hypot(ax[2] || 0, ax[3] || 0) > 0.35) this.padAim = { x: ax[2], y: ax[3] };
    else if (Math.hypot(ax[0], ax[1]) > 0.35) this.padAim = { x: ax[0], y: ax[1] };
  },
  down(code) { return !!this.keys[code]; },
  hit(code) { return !!this.pressed[code]; },
  padDown(i) { return !!(this.padNow && this.padNow[i]); },
  padPressed(i) { return !!(this.padHit && this.padHit[i]); },
  // ---- rebindable actions ----
  binds() { return (typeof SAVE !== 'undefined' && SAVE.data && SAVE.data.settings.binds) || DEFAULT_BINDS; },
  codeDown(c) { if (!c) return false; if (c.startsWith('Mouse')) return !!this.mouse.down[+c.slice(5)]; return !!this.keys[c]; },
  codeHit(c) { if (!c) return false; if (c.startsWith('Mouse')) return !!this.mouse.pressed[+c.slice(5)]; return !!this.pressed[c]; },
  act(a) { return (this.binds()[a] || []).some(c => this.codeDown(c)); },
  actHit(a) { return (this.binds()[a] || []).some(c => this.codeHit(c)); },
  // high level actions
  moveVec() {
    let x = 0, y = 0;
    if (this.act('up')) y -= 1;
    if (this.act('down')) y += 1;
    if (this.act('left')) x -= 1;
    if (this.act('right')) x += 1;
    if (this.pad) {
      const ax = this.pad.axes;
      if (Math.hypot(ax[0], ax[1]) > 0.25) { x += ax[0]; y += ax[1]; }
    }
    const l = Math.hypot(x, y);
    return l > 1 ? { x: x / l, y: y / l } : { x, y };
  },
  attackHeld() { return this.act('attack') || this.padDown(2) || this.padDown(7); },
  attackHit() { return this.actHit('attack') || this.padPressed(2) || this.padPressed(7); },
  specialHit() { return this.actHit('special') || this.padPressed(3) || this.padPressed(6); },
  dashHit() { return this.actHit('dash') || this.padPressed(0); },
  ultHit() { return this.actHit('ult') || this.padPressed(5) || this.padPressed(4); },
  interactHit() { return this.actHit('interact') || this.padPressed(1); },
  pauseHit() { return this.hit('Escape') || this.actHit('pause') || this.padPressed(9); },
  endFrame() { this.pressed = {}; this.mouse.pressed = [false, false, false, false, false]; },
  clear() { this.pressed = {}; this.mouse.pressed = [false, false, false, false, false]; this.mouse.down = [false, false, false, false, false]; }
};

// ---------- synthesized sound ----------
const SFX = {
  ctx: null, master: null, sfxBus: null, musicBus: null, noiseBuf: null, last: {},
  vol: 0.7, sfxVol: 0.8, musicVol: 0.5,
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      this.ctx = new C();
    } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    this.master.connect(comp); comp.connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
    this.musicBus = c.createGain(); this.musicBus.connect(this.master);
    const len = c.sampleRate * 1;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVol();
    Music.onUnlock();
  },
  applyVol() {
    if (!this.ctx) return;
    this.master.gain.value = this.vol;
    this.sfxBus.gain.value = this.sfxVol;
    this.musicBus.gain.value = this.musicVol * 0.55;
  },
  tone(f, dur, type = 'square', v = 0.15, f2 = null, delay = 0, bus = null) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, v = 0.2, freq = 1500, ftype = 'bandpass', delay = 0, f2 = null, bus = null) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    s.playbackRate.value = rand(0.8, 1.2);
    const f = c.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(freq, t);
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    f.Q.value = 1.2;
    const g = c.createGain();
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || this.sfxBus);
    s.start(t, rand(0, 0.5)); s.stop(t + dur + 0.02);
  },
  play(name, vol = 1) {
    if (!this.ctx) return;
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < 35) return;
    this.last[name] = now;
    const v = vol;
    switch (name) {
      case 'slash': this.noise(0.1, 0.25 * v, 3000, 'bandpass', 0, 900); this.tone(700, 0.07, 'sawtooth', 0.04 * v, 250); break;
      case 'heavy': this.noise(0.2, 0.35 * v, 1400, 'bandpass', 0, 300); this.tone(260, 0.18, 'sawtooth', 0.08 * v, 60); break;
      case 'punch': this.noise(0.06, 0.3 * v, 900, 'lowpass'); this.tone(180, 0.06, 'square', 0.08 * v, 70); break;
      case 'hit': this.tone(320, 0.07, 'square', 0.07 * v, 90); this.noise(0.05, 0.18 * v, 2200); break;
      case 'crit': this.tone(1100, 0.12, 'square', 0.07 * v, 300); this.noise(0.08, 0.25 * v, 4000); break;
      case 'clang': this.tone(1800, 0.15, 'triangle', 0.08 * v, 1500); this.tone(2400, 0.1, 'square', 0.03 * v); break;
      case 'dash': this.noise(0.16, 0.18 * v, 800, 'highpass', 0, 5000); break;
      case 'hurt': this.tone(240, 0.22, 'sawtooth', 0.12 * v, 70); this.noise(0.12, 0.25 * v, 600, 'lowpass'); break;
      case 'kill': this.tone(520, 0.09, 'square', 0.05 * v, 1100); this.noise(0.1, 0.15 * v, 3000, 'highpass'); break;
      case 'shoot': this.tone(900, 0.06, 'square', 0.04 * v, 420); break;
      case 'arrow': this.noise(0.08, 0.15 * v, 5000, 'highpass', 0, 2000); this.tone(1500, 0.05, 'triangle', 0.04 * v, 700); break;
      case 'eshoot': this.tone(420, 0.09, 'triangle', 0.05 * v, 260); break;
      case 'boom': this.noise(0.45, 0.45 * v, 900, 'lowpass', 0, 80); this.tone(130, 0.4, 'sine', 0.25 * v, 35); break;
      case 'thunder': this.noise(0.25, 0.3 * v, 4000, 'bandpass', 0, 600); this.tone(1600, 0.05, 'square', 0.05 * v, 200); break;
      case 'freeze': this.tone(1300, 0.18, 'sine', 0.07 * v, 2600); this.tone(2600, 0.25, 'triangle', 0.03 * v, 3400, 0.05); break;
      case 'burn': this.noise(0.15, 0.12 * v, 700, 'lowpass', 0, 2000); break;
      case 'coin': this.tone(988, 0.06, 'square', 0.05 * v); this.tone(1319, 0.14, 'square', 0.05 * v, null, 0.06); break;
      case 'pickup': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.07 * v, null, i * 0.05)); break;
      case 'heal': [392, 523, 659, 880].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.07 * v, null, i * 0.07)); break;
      case 'levelup': [523, 784, 1047, 1568].forEach((f, i) => this.tone(f, 0.2, 'square', 0.05 * v, null, i * 0.06)); break;
      case 'ult': this.tone(200, 0.6, 'sawtooth', 0.12 * v, 1600); this.noise(0.7, 0.25 * v, 400, 'bandpass', 0, 6000); this.tone(80, 0.8, 'sine', 0.3 * v, 40, 0.5); break;
      case 'ui': this.tone(740, 0.035, 'square', 0.035 * v); break;
      case 'uiok': this.tone(880, 0.06, 'square', 0.05 * v); this.tone(1320, 0.1, 'square', 0.05 * v, null, 0.06); break;
      case 'uino': this.tone(300, 0.12, 'square', 0.06 * v, 200); break;
      case 'door': this.tone(110, 0.5, 'sawtooth', 0.08 * v, 220); this.noise(0.5, 0.1 * v, 300, 'lowpass', 0, 1200); break;
      case 'warn': this.tone(520, 0.08, 'square', 0.04 * v); this.tone(520, 0.08, 'square', 0.04 * v, null, 0.12); break;
      case 'roar': this.tone(90, 0.9, 'sawtooth', 0.18 * v, 45); this.noise(0.9, 0.3 * v, 500, 'lowpass', 0, 120); break;
      case 'spawn': this.tone(200, 0.25, 'sine', 0.06 * v, 600); break;
      case 'laser': this.tone(150, 0.6, 'sawtooth', 0.1 * v, 140); this.noise(0.6, 0.12 * v, 2500, 'bandpass'); break;
      case 'bell': this.tone(1046, 1.2, 'sine', 0.08 * v); this.tone(2093, 0.8, 'sine', 0.03 * v); this.tone(1568, 1.0, 'triangle', 0.02 * v); break;
      case 'deny': this.tone(160, 0.15, 'square', 0.05 * v); break;
      case 'don': this.tone(110, 0.25, 'sine', 0.35 * v, 55); this.noise(0.12, 0.25 * v, 300, 'lowpass'); break;
      case 'ka': this.tone(1400, 0.05, 'square', 0.06 * v, 900); this.noise(0.04, 0.2 * v, 5000, 'highpass'); break;
      case 'perfect': this.tone(1568, 0.1, 'square', 0.05 * v); this.tone(2093, 0.16, 'square', 0.05 * v, null, 0.05); break;
      case 'parry': this.tone(2200, 0.25, 'triangle', 0.12 * v, 1800); this.tone(3300, 0.18, 'sine', 0.06 * v); this.noise(0.08, 0.3 * v, 6000, 'highpass'); break;
      case 'tick': this.tone(2400, 0.02, 'square', 0.03 * v); break;
      case 'splash': this.noise(0.35, 0.3 * v, 1200, 'lowpass', 0, 300); this.tone(400, 0.2, 'sine', 0.06 * v, 120); break;
      case 'timestop': this.tone(1800, 0.6, 'sine', 0.1 * v, 200); this.tone(900, 0.8, 'triangle', 0.06 * v, 60, 0.1); this.noise(0.5, 0.15 * v, 2000, 'bandpass', 0, 200); break;
      case 'timeresume': this.tone(200, 0.4, 'sine', 0.1 * v, 1800); this.noise(0.3, 0.12 * v, 300, 'bandpass', 0, 3000); break;
      case 'rift': this.tone(55, 2.0, 'sawtooth', 0.12 * v, 40); this.noise(2.0, 0.2 * v, 200, 'lowpass', 0, 900); break;
      case 'type': this.tone(1200 + Math.random() * 300, 0.02, 'square', 0.012 * v); break;
    }
  }
};

// ---------- procedural music ----------
const SCALES = {
  insen: [0, 1, 5, 7, 10], hira: [0, 2, 3, 7, 8], minor: [0, 2, 3, 5, 7, 8, 10],
  majpent: [0, 2, 4, 7, 9], yo: [0, 2, 5, 7, 9], dorian: [0, 2, 3, 5, 7, 9, 10], phryg: [0, 1, 3, 5, 7, 8, 10],
  kumoi: [0, 2, 3, 7, 9], ryukyu: [0, 4, 5, 7, 11], iwato: [0, 1, 5, 6, 10], harmin: [0, 2, 3, 5, 7, 8, 11]
};
const THEMES = {
  title:  { bpm: 76,  root: 50, scale: 'hira',   prog: [0, 0, 3, 4], lead: 'triangle', bass: 'sine',     drums: '', density: 0.35, pad: 0.05, swing: 0 },
  hub:    { bpm: 88,  root: 55, scale: 'yo',     prog: [0, 3, 4, 0], lead: 'triangle', bass: 'triangle', drums: 'soft', density: 0.4, pad: 0.05 },
  grove:  { bpm: 138, root: 52, scale: 'insen',  prog: [0, 0, 3, 2], lead: 'square',   bass: 'sawtooth', drums: 'drive', density: 0.55, pad: 0.03 },
  city:   { bpm: 148, root: 49, scale: 'minor',  prog: [0, 5, 3, 4], lead: 'sawtooth', bass: 'sawtooth', drums: 'synth', density: 0.6, pad: 0.04 },
  temple: { bpm: 120, root: 54, scale: 'hira',   prog: [0, 3, 0, 4], lead: 'triangle', bass: 'square',   drums: 'taiko', density: 0.5, pad: 0.05 },
  palace: { bpm: 156, root: 47, scale: 'phryg',  prog: [0, 1, 5, 4], lead: 'square',   bass: 'sawtooth', drums: 'drive', density: 0.6, pad: 0.04 },
  boss:   { bpm: 172, root: 50, scale: 'phryg',  prog: [0, 1, 0, 6], lead: 'sawtooth', bass: 'sawtooth', drums: 'boss', density: 0.7, pad: 0.03 },
  final:  { bpm: 180, root: 45, scale: 'insen',  prog: [0, 3, 1, 4], lead: 'sawtooth', bass: 'sawtooth', drums: 'boss', density: 0.75, pad: 0.04 },
  yomi:   { bpm: 132, root: 46, scale: 'iwato',  prog: [0, 0, 1, 3], lead: 'triangle', bass: 'sawtooth', drums: 'march', density: 0.45, pad: 0.05 },
  ryugu:  { bpm: 124, root: 53, scale: 'ryukyu', prog: [0, 2, 3, 1], lead: 'sine',     bass: 'triangle', drums: 'gallop', density: 0.55, pad: 0.06 },
  karakuri:{ bpm: 154, root: 48, scale: 'harmin', prog: [0, 4, 5, 3], lead: 'square',   bass: 'square',   drums: 'clock', density: 0.65, pad: 0.03 },
  blacksun:{ bpm: 164, root: 44, scale: 'kumoi',  prog: [0, 3, 4, 1], lead: 'sawtooth', bass: 'sawtooth', drums: 'gallop', density: 0.6, pad: 0.04 },
  boss2:  { bpm: 182, root: 43, scale: 'iwato',  prog: [0, 1, 4, 3], lead: 'sawtooth', bass: 'square',   drums: 'boss', density: 0.75, pad: 0.03 },
  sunfinal:{ bpm: 190, root: 41, scale: 'harmin', prog: [0, 5, 3, 4], lead: 'sawtooth', bass: 'sawtooth', drums: 'clock', density: 0.8, pad: 0.04 },
  heaven: { bpm: 84,  root: 52, scale: 'kumoi',  prog: [0, 3, 4, 2], lead: 'sine',     bass: 'triangle', drums: 'soft', density: 0.4, pad: 0.07 },
  godfight:{ bpm: 176, root: 48, scale: 'dorian', prog: [0, 5, 3, 6], lead: 'sawtooth', bass: 'sawtooth', drums: 'boss', density: 0.8, pad: 0.04 },
  calamity:{ bpm: 196, root: 40, scale: 'iwato',  prog: [0, 1, 0, 4], lead: 'sawtooth', bass: 'square',   drums: 'boss', density: 0.85, pad: 0.05 },
  ruin:   { bpm: 60,  root: 45, scale: 'hira',   prog: [0, 1, 3, 1], lead: 'triangle', bass: 'sine',     drums: '', density: 0.25, pad: 0.06 },
  victory:{ bpm: 96,  root: 57, scale: 'majpent',prog: [0, 3, 4, 0], lead: 'triangle', bass: 'triangle', drums: 'soft', density: 0.45, pad: 0.06 },
};
const DRUMS = {
  '':    { k: '................', s: '................', h: '................' },
  soft:  { k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.' },
  drive: { k: 'x...x...x...x.x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
  synth: { k: 'x...x...x...x...', s: '....x.......x..x', h: '.xx.xxx..xx.x.xx' },
  taiko: { k: 'x..x..x.x...x...', s: '......x.....x.x.', h: '................' },
  boss:  { k: 'x.x.x..xx.x.x..x', s: '....x.......x.x.', h: 'xxxxxxxxxxxxxxxx' },
  march: { k: 'x...x...x...x...', s: '..x...x...x.x.x.', h: '................' },
  gallop:{ k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'x.xx.xx.x.xx.xx.' },
  clock: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
};
const Music = {
  cur: null, theme: null, step: 0, next: 0, timer: null, melody: null, want: null,
  midi: n => 440 * Math.pow(2, (n - 69) / 12),
  onUnlock() { if (this.want) { const w = this.want; this.cur = null; this.play(w); } },
  play(name) {
    this.want = name;
    if (!SFX.ctx) return;
    if (this.cur === name) return;
    this.cur = name; this.theme = THEMES[name]; this.step = 0;
    this.next = SFX.ctx.currentTime + 0.1;
    // compose a 4-bar melody, deterministic per theme
    const rng = seeded(name.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const th = this.theme, sc = SCALES[th.scale];
    let deg = 4; this.melody = [];
    for (let i = 0; i < 64; i++) {
      if (rng() < th.density && (i % 2 === 0 || rng() < 0.3)) {
        deg += Math.floor(rng() * 5) - 2; deg = clamp(deg, 0, sc.length * 2);
        this.melody.push(deg);
      } else this.melody.push(null);
    }
    if (!this.timer) this.timer = setInterval(() => this.tick(), 60);
  },
  stop() { this.cur = null; this.theme = null; },
  note(deg, oct) {
    const sc = SCALES[this.theme.scale];
    const o = Math.floor(deg / sc.length), d = ((deg % sc.length) + sc.length) % sc.length;
    return this.theme.root + sc[d] + 12 * (o + oct);
  },
  tick() {
    const c = SFX.ctx; if (!c || !this.theme) return;
    const th = this.theme, spb = 60 / th.bpm / 4;
    while (this.next < c.currentTime + 0.25) {
      const s = this.step % 64, s16 = s % 16, bar = Math.floor(s / 16), t = this.next - c.currentTime;
      const dr = DRUMS[th.drums] || DRUMS[''];
      const bus = SFX.musicBus;
      if (dr.k[s16] === 'x') { SFX.tone(th.drums === 'taiko' ? 90 : 120, 0.18, 'sine', 0.35, 40, t, bus); }
      if (dr.s[s16] === 'x') { SFX.noise(0.12, th.drums === 'taiko' ? 0.18 : 0.12, th.drums === 'taiko' ? 400 : 1800, 'bandpass', t, null, bus); }
      if (dr.h[s16] === 'x') { SFX.noise(0.03, 0.05, 8000, 'highpass', t, null, bus); }
      const chord = th.prog[bar];
      if (s16 % 4 === 0 || (th.drums === 'boss' && s16 % 2 === 0)) {
        SFX.tone(this.midi(this.note(chord, -2)), spb * (th.drums === 'boss' ? 1.6 : 3), th.bass, 0.09, null, t, bus);
      }
      if (s16 === 0 && th.pad) {
        [0, 2, 4].forEach(x => SFX.tone(this.midi(this.note(chord + x, 0)), spb * 15, 'sine', th.pad, null, t, bus));
      }
      const m = this.melody[s];
      if (m !== null && m !== undefined) {
        SFX.tone(this.midi(this.note(m + chord, 0)), spb * 1.8, th.lead, th.lead === 'sawtooth' ? 0.035 : 0.05, null, t, bus);
      }
      // koto-like arpeggio
      if (th.drums !== 'boss' && s16 % 4 === 2) SFX.tone(this.midi(this.note(chord + 4 + (s16 >> 2), 1)), spb * 1.2, 'triangle', 0.025, null, t, bus);
      this.next += spb; this.step++;
    }
  }
};

// ---------- drawing helpers ----------
function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); ctx.fill(); }
function circ(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); ctx.fill(); }
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function star(ctx, x, y, r1, r2, n, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * TAU, r = i % 2 ? r2 : r1;
    i ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

const FLASH_PAL = { hair: '#fff', hair2: '#fff', skin: '#fff', outfit: '#fff', outfit2: '#fff', eye: '#fff', accent: '#fff', scarf: '#fff', acc2: '#fff' };

/* Chibi anime character renderer.
   c = { x, y, s, lookX, lookY, pal, t, moving, flash, hair, acc, alpha, trail, eyesClosed, mood } */
function drawChar(ctx, c) {
  const s = c.s, P = c.flash ? FLASH_PAL : c.pal;
  const lx = c.lookX || 0, ly = c.lookY || 0, t = c.t || 0;
  const moving = !!c.moving;
  const bob = moving ? Math.abs(Math.sin(t * 13)) * s * 0.14 : Math.sin(t * 2.5) * s * 0.05;
  const x = c.x, y = c.y, by = y - bob;
  const back = ly < -0.55;
  ctx.save();
  ctx.globalAlpha = c.alpha === undefined ? 1 : c.alpha;
  // shadow
  if (!c.noShadow) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ell(ctx, x, y + 1, s * 0.95, s * 0.36); }
  // scarf trail (behind)
  if (c.trail && c.trail.length > 1 && P.scarf) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    let px = x, py = by - s * 1.95;
    for (let i = 0; i < c.trail.length; i++) {
      const tp = c.trail[i];
      const nx = tp.x + Math.sin(t * 9 + i) * 2, ny = tp.y - s * 1.9 + i * 1.2;
      ctx.strokeStyle = P.scarf; ctx.lineWidth = s * 0.42 * (1 - i / c.trail.length) + 1;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
      px = nx; py = ny;
    }
  }
  // back hair
  const hy = by - s * 2.6, hr = s * 1.0;
  ctx.fillStyle = P.hair2;
  if (c.hair === 'long' || c.hair === 'hime') {
    ctx.beginPath();
    ctx.moveTo(x - hr * 1.05, hy);
    ctx.lineTo(x - hr * 1.1, by - s * 0.9);
    for (let i = 0; i <= 6; i++) ctx.lineTo(x - hr * 1.1 + (i / 6) * hr * 2.2, by - s * (i % 2 ? 1.1 : 0.85) + Math.sin(t * 3 + i) * 1.5);
    ctx.lineTo(x + hr * 1.05, hy); ctx.closePath(); ctx.fill();
  } else if (c.hair === 'twin') {
    const sw = Math.sin(t * 4) * s * 0.1;
    ell(ctx, x - hr * 1.15 + sw, hy + hr * 0.9, hr * 0.38, hr * 0.95, 0.2);
    ell(ctx, x + hr * 1.15 + sw, hy + hr * 0.9, hr * 0.38, hr * 0.95, -0.2);
  } else if (c.hair === 'ponytail') {
    const sw = Math.sin(t * 5) * s * 0.25 - lx * s * 0.6;
    ctx.beginPath();
    ctx.moveTo(x - hr * 0.3, hy - hr * 0.7);
    ctx.quadraticCurveTo(x + sw - hr * 0.2, hy + hr * 0.6, x + sw * 1.6, hy + hr * 1.9);
    ctx.quadraticCurveTo(x + sw + hr * 0.6, hy + hr * 0.5, x + hr * 0.35, hy - hr * 0.7);
    ctx.fill();
  } else if (c.hair === 'bun') {
    circ(ctx, x, hy - hr * 0.95, hr * 0.45);
  }
  if (c.hair === 'spiky' || c.hair === 'wild') {
    star(ctx, x, hy, hr * (c.hair === 'wild' ? 1.5 : 1.35), hr * 0.95, 9, t * 0.2 * 0);
    ctx.fill();
  }
  circ(ctx, x, hy, hr * 1.06);

  // legs
  const lp = moving ? Math.sin(t * 13) * s * 0.22 : 0;
  ctx.fillStyle = P.outfit2;
  ell(ctx, x - s * 0.32, y - s * 0.12 + lp * 0.5, s * 0.24, s * 0.2);
  ell(ctx, x + s * 0.32, y - s * 0.12 - lp * 0.5, s * 0.24, s * 0.2);
  // body
  ctx.fillStyle = P.outfit;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.62, by - s * 1.95);
  ctx.lineTo(x + s * 0.62, by - s * 1.95);
  ctx.lineTo(x + s * 0.78, by - s * 0.35);
  ctx.quadraticCurveTo(x, by - s * 0.1, x - s * 0.78, by - s * 0.35);
  ctx.closePath(); ctx.fill();
  // body shading + sash
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath(); ctx.moveTo(x + s * 0.1, by - s * 1.95); ctx.lineTo(x + s * 0.62, by - s * 1.95); ctx.lineTo(x + s * 0.78, by - s * 0.35); ctx.lineTo(x + s * 0.2, by - s * 0.25); ctx.fill();
  if (!back) {
    ctx.fillStyle = P.accent;
    ctx.beginPath(); ctx.moveTo(x - s * 0.35, by - s * 1.95); ctx.lineTo(x, by - s * 1.45); ctx.lineTo(x + s * 0.35, by - s * 1.95); ctx.lineTo(x + s * 0.15, by - s * 1.95); ctx.lineTo(x, by - s * 1.7); ctx.lineTo(x - s * 0.15, by - s * 1.95); ctx.fill();
  }
  ctx.fillStyle = P.scarf || P.accent;
  ctx.fillRect(x - s * 0.72, by - s * 1.0, s * 1.44, s * 0.2);
  // arms
  ctx.fillStyle = P.outfit;
  const arm = moving ? Math.sin(t * 13) * s * 0.15 : 0;
  ell(ctx, x - s * 0.8, by - s * 1.35 - arm, s * 0.2, s * 0.42, 0.25);
  ell(ctx, x + s * 0.8, by - s * 1.35 + arm, s * 0.2, s * 0.42, -0.25);
  ctx.fillStyle = P.skin;
  circ(ctx, x - s * 0.88, by - s * 0.98 - arm, s * 0.15);
  circ(ctx, x + s * 0.88, by - s * 0.98 + arm, s * 0.15);

  // head
  if (!back) {
    ctx.fillStyle = P.skin;
    circ(ctx, x + lx * hr * 0.1, hy + hr * 0.12, hr * 0.84);
    // eyes
    const ex = x + lx * hr * 0.32, ey = hy + hr * 0.28 + ly * hr * 0.08;
    const sq = 1 - Math.abs(lx) * 0.25;
    for (const side of [-1, 1]) {
      const exx = ex + side * hr * 0.34 * sq;
      const far = (side === -1 && lx > 0.5) || (side === 1 && lx < -0.5);
      const ew = hr * 0.17 * (far ? 0.75 : 1), eh = hr * 0.27;
      if (c.eyesClosed) {
        ctx.strokeStyle = '#2a1a2a'; ctx.lineWidth = s * 0.1;
        ctx.beginPath(); ctx.arc(exx, ey, ew, 0.2, Math.PI - 0.2); ctx.stroke();
        continue;
      }
      ctx.fillStyle = '#fff'; ell(ctx, exx, ey, ew * 1.15, eh * 1.05);
      ctx.fillStyle = P.eye; ell(ctx, exx + lx * ew * 0.2, ey + eh * 0.08, ew, eh);
      ctx.fillStyle = c.flash ? '#fff' : shade(P.eye, -0.55); ell(ctx, exx + lx * ew * 0.2, ey + eh * 0.2, ew * 0.55, eh * 0.55);
      ctx.fillStyle = '#fff'; circ(ctx, exx - ew * 0.3 + lx * ew * 0.2, ey - eh * 0.35, ew * 0.38);
      circ(ctx, exx + ew * 0.35, ey + eh * 0.4, ew * 0.18);
      ctx.strokeStyle = '#1b1020'; ctx.lineWidth = s * 0.09;
      ctx.beginPath(); ctx.moveTo(exx - ew * 1.25, ey - eh * 0.85 + (c.mood === 'angry' ? side * -eh * 0.35 : 0)); ctx.lineTo(exx + ew * 1.25, ey - eh * 0.95 + (c.mood === 'angry' ? side * eh * 0.35 : 0)); ctx.stroke();
    }
    // blush & mouth
    ctx.fillStyle = 'rgba(255,110,140,.35)';
    ell(ctx, ex - hr * 0.55, ey + hr * 0.32, hr * 0.16, hr * 0.08);
    ell(ctx, ex + hr * 0.55, ey + hr * 0.32, hr * 0.16, hr * 0.08);
    ctx.strokeStyle = '#6a2a3a'; ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    if (c.mood === 'happy') ctx.arc(ex, ey + hr * 0.42, hr * 0.12, 0.1, Math.PI - 0.1);
    else if (c.mood === 'angry') { ctx.moveTo(ex - hr * 0.12, ey + hr * 0.52); ctx.lineTo(ex + hr * 0.12, ey + hr * 0.48); }
    else { ctx.moveTo(ex - hr * 0.08, ey + hr * 0.48); ctx.lineTo(ex + hr * 0.08, ey + hr * 0.48); }
    ctx.stroke();
  }
  // bangs / front hair
  ctx.fillStyle = P.hair;
  ctx.beginPath();
  if (back) {
    circ(ctx, x, hy, hr * 1.02);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ell(ctx, x - hr * 0.3, hy - hr * 0.4, hr * 0.4, hr * 0.2, -0.5);
  } else {
    ctx.moveTo(x - hr * 1.06, hy + hr * 0.35);
    ctx.arc(x, hy, hr * 1.06, Math.PI * 0.92, Math.PI * 2.08);
    const n = 7, off = lx * hr * 0.25;
    for (let i = 0; i <= n; i++) {
      const fx = x + hr * 1.0 - (i / n) * hr * 2.0;
      const deep = i % 2 === 0 ? 0.05 : (i === 3 || i === 4 ? 0.48 : 0.36);
      ctx.lineTo(fx + off * (i % 2), hy - hr * 0.1 + hr * deep);
    }
    ctx.closePath(); ctx.fill();
    // side locks
    ell(ctx, x - hr * 0.95, hy + hr * 0.45, hr * 0.18, hr * 0.5, 0.1);
    ell(ctx, x + hr * 0.95, hy + hr * 0.45, hr * 0.18, hr * 0.5, -0.1);
    // shine
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = s * 0.12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, hy - hr * 0.1, hr * 0.7, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
  }
  // accessories
  const A = c.acc;
  if (A === 'ribbon') {
    ctx.fillStyle = P.scarf || P.accent;
    const rx = x + hr * 0.55, ry = hy - hr * 0.75;
    ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + hr * 0.5, ry - hr * 0.35); ctx.lineTo(rx + hr * 0.45, ry + hr * 0.3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - hr * 0.45, ry - hr * 0.4); ctx.lineTo(rx - hr * 0.35, ry + hr * 0.25); ctx.closePath(); ctx.fill();
    circ(ctx, rx, ry, hr * 0.12);
  } else if (A === 'foxears' || A === 'tanuki' || A === 'catears') {
    ctx.fillStyle = P.hair;
    const round = A === 'tanuki';
    for (const sd of [-1, 1]) {
      const ex = x + sd * hr * 0.62, ey = hy - hr * 0.8;
      if (round) { circ(ctx, ex, ey, hr * 0.32); ctx.fillStyle = P.acc2 || '#3a2a20'; circ(ctx, ex, ey, hr * 0.16); ctx.fillStyle = P.hair; }
      else {
        ctx.beginPath(); ctx.moveTo(ex - sd * hr * 0.35, ey + hr * 0.2); ctx.lineTo(ex + sd * hr * 0.15, ey - hr * 0.75); ctx.lineTo(ex + sd * hr * 0.42, ey + hr * 0.15); ctx.fill();
        ctx.fillStyle = P.acc2 || '#ffd0dc';
        ctx.beginPath(); ctx.moveTo(ex - sd * hr * 0.15, ey + hr * 0.1); ctx.lineTo(ex + sd * hr * 0.13, ey - hr * 0.45); ctx.lineTo(ex + sd * hr * 0.27, ey + hr * 0.08); ctx.fill();
        ctx.fillStyle = P.hair;
      }
    }
  } else if (A === 'horns') {
    ctx.fillStyle = P.acc2 || '#f4e4c1';
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(x + sd * hr * 0.35, hy - hr * 0.85); ctx.quadraticCurveTo(x + sd * hr * 0.9, hy - hr * 1.5, x + sd * hr * 0.7, hy - hr * 1.9); ctx.lineTo(x + sd * hr * 0.6, hy - hr * 0.8); ctx.fill();
    }
  } else if (A === 'headband') {
    ctx.fillStyle = P.scarf || '#fff';
    ctx.fillRect(x - hr * 1.02, hy - hr * 0.42, hr * 2.04, hr * 0.22);
    ctx.beginPath(); ctx.moveTo(x + hr, hy - hr * 0.35); ctx.lineTo(x + hr * 1.6, hy - hr * 0.1 + Math.sin(t * 8) * 3); ctx.lineTo(x + hr * 1.5, hy + hr * 0.15 + Math.sin(t * 8) * 3); ctx.closePath(); ctx.fill();
  } else if (A === 'crown') {
    ctx.fillStyle = P.acc2 || '#ffd56b';
    ctx.beginPath(); ctx.moveTo(x - hr * 0.6, hy - hr * 0.8);
    for (let i = 0; i <= 4; i++) ctx.lineTo(x - hr * 0.6 + i * hr * 0.3, hy - hr * (i % 2 ? 1.05 : 1.45));
    ctx.lineTo(x + hr * 0.6, hy - hr * 0.8); ctx.fill();
  } else if (A === 'hat') {
    ctx.fillStyle = P.acc2 || '#c9a36b';
    ell(ctx, x, hy - hr * 0.6, hr * 1.7, hr * 0.42);
    ctx.beginPath(); ctx.moveTo(x - hr * 0.7, hy - hr * 0.7); ctx.lineTo(x, hy - hr * 1.4); ctx.lineTo(x + hr * 0.7, hy - hr * 0.7); ctx.fill();
  } else if (A === 'mask') {
    ctx.fillStyle = P.acc2 || '#f2f2f2';
    ell(ctx, x - hr * 0.7, hy - hr * 0.55, hr * 0.38, hr * 0.45, -0.5);
    ctx.fillStyle = '#e33'; ctx.fillRect(x - hr * 0.85, hy - hr * 0.6, hr * 0.3, hr * 0.06);
  } else if (A === 'hood') {
    ctx.fillStyle = P.acc2 || P.outfit;
    ctx.beginPath(); ctx.arc(x, hy, hr * 1.15, Math.PI * 0.95, Math.PI * 2.05); ctx.lineTo(x + hr * 1.1, hy + hr * 0.6); ctx.lineTo(x + hr * 0.95, hy + hr * 0.1); ctx.arc(x, hy, hr * 0.98, Math.PI * 2.0, Math.PI * 1.0, true); ctx.lineTo(x - hr * 1.1, hy + hr * 0.6); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ---------- particles ----------
class Particles {
  constructor() { this.list = []; }
  add(p) { if (this.list.length < (this.cap || 900)) this.list.push(p); return p; }
  burst(x, y, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = o.ang !== undefined ? o.ang + rand(-(o.spread || 0.6), o.spread || 0.6) : rand(0, TAU);
      const sp = rand(o.min || 60, o.max || 260);
      this.add({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.25, o.life || 0.6), t: 0,
        size: rand(o.size || 2, (o.size || 2) * 2.2), color: o.color || '#fff', type: o.type || 'spark',
        drag: o.drag === undefined ? 4 : o.drag, grav: o.grav || 0, rot: rand(0, TAU), vr: rand(-8, 8)
      });
    }
  }
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.t += dt;
      if (p.t >= p.life) { L[i] = L[L.length - 1]; L.pop(); continue; }
      p.vx *= 1 - Math.min(1, p.drag * dt); p.vy *= 1 - Math.min(1, p.drag * dt);
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
  }
  draw(ctx) {
    ctx.save();
    for (const p of this.list) {
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
      if (p.type === 'spark') {
        ctx.lineWidth = p.size * k; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); ctx.stroke();
      } else if (p.type === 'petal') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ell(ctx, 0, 0, p.size * 1.6, p.size * 0.8); ctx.restore();
      } else if (p.type === 'smoke') {
        ctx.globalAlpha = k * 0.35; circ(ctx, p.x, p.y, p.size * (2 - k) * 2);
      } else if (p.type === 'shard') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath(); ctx.moveTo(0, -p.size * 1.8); ctx.lineTo(p.size * 0.7, 0); ctx.lineTo(0, p.size * 1.8); ctx.lineTo(-p.size * 0.7, 0); ctx.fill(); ctx.restore();
      } else if (p.type === 'glow') {
        ctx.globalCompositeOperation = 'lighter';
        circ(ctx, p.x, p.y, p.size * k * 1.5);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        circ(ctx, p.x, p.y, p.size * k);
      }
    }
    ctx.restore();
  }
  clear() { this.list.length = 0; }
}
