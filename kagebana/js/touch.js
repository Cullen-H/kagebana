'use strict';
/* =====================================================================
   KAGEBANA — touch.js
   On-screen controls for phones and tablets, plus a "Lite" graphics mode.
   - Left half of the screen: a move stick that appears under your thumb.
   - Right: a fixed aim stick. Holding it attacks; dragging aims. With no drag
     it aims at the nearest foe. Buttons for Dash, Special and Interact sit
     around it; the HUD's Ultimate and Assist icons become buttons too.
   Settings: touch 'auto' | 'on' | 'off', gfx 'auto' | 'full' | 'lite'.
   Touch input feeds the same Input functions the keyboard and gamepad use.
   ===================================================================== */
const TOUCH = {
  seen: false, shown: false,
  move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, aimOn: false, aimHeld: false,
  held: {}, hitQ: {}, ids: {}, lastTouch: 0, targetDist: 0,
  R: 56, // stick radius in px

  // A phone or tablet: the main pointer is a finger. (Touch laptops have a fine pointer, so they stay on mouse.)
  coarse() { try { return matchMedia('(pointer: coarse)').matches && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window); } catch (e) { return false; } },
  mode() { return (SAVE.data && SAVE.data.settings.touch) || 'auto'; },
  wanted() { const m = this.mode(); return m === 'on' || (m === 'auto' && (this.coarse() || this.seen)); },

  init() {
    const el = document.createElement('div');
    el.id = 'touch';
    el.innerHTML = `
      <div class="t-zone"></div>
      <div class="t-stick t-move hidden"><div class="t-knob"></div></div>
      <div class="t-stick t-aim"><div class="t-knob"></div><span class="t-lbl">ATTACK</span></div>
      <button class="t-btn t-dash" data-a="dash"><span>DASH</span><i class="t-pips"></i></button>
      <button class="t-btn t-sp" data-a="special"><span>SPECIAL</span><i class="t-cd"></i></button>
      <button class="t-btn t-int hidden" data-a="interact"><span>✋</span></button>
      <button class="t-pause" data-a="pause">❚❚</button>`;
    document.body.appendChild(el);
    const rot = document.createElement('div');
    rot.id = 'rotate'; rot.innerHTML = '<div><b>⟳</b>Turn your phone sideways to play.</div>';
    document.body.appendChild(rot);
    this.el = el;
    this.zone = el.querySelector('.t-zone');
    this.mv = el.querySelector('.t-move'); this.mvKnob = this.mv.firstElementChild;
    this.am = el.querySelector('.t-aim'); this.amKnob = this.am.firstElementChild;
    this.btnInt = el.querySelector('.t-int'); this.pips = el.querySelector('.t-pips'); this.cd = el.querySelector('.t-cd');

    const opt = { passive: false };
    // Move stick: appears wherever the left thumb lands.
    this.zone.addEventListener('touchstart', e => {
      e.preventDefault(); this.touched();
      for (const t of e.changedTouches) {
        if (this.ids.move !== undefined) break;
        this.ids.move = t.identifier; this.mvBase = { x: t.clientX, y: t.clientY };
        this.mv.style.left = t.clientX + 'px'; this.mv.style.top = t.clientY + 'px'; this.mv.classList.remove('hidden');
        this.setKnob(this.mvKnob, 0, 0);
      }
    }, opt);
    // Aim stick: holding it attacks, dragging it aims.
    this.am.addEventListener('touchstart', e => {
      e.preventDefault(); this.touched();
      const t = e.changedTouches[0];
      if (this.ids.aim !== undefined) return;
      const r = this.am.getBoundingClientRect();
      this.ids.aim = t.identifier; this.amBase = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this.aimHeld = true; this.hitQ.attack = true;
      this.aimMove(t);
    }, opt);
    // Buttons.
    el.querySelectorAll('[data-a]').forEach(b => b.addEventListener('touchstart', e => {
      e.preventDefault(); e.stopPropagation(); this.touched();
      const a = b.dataset.a; this.hitQ[a] = true; this.held[a] = true; this.ids['b' + e.changedTouches[0].identifier] = a;
      b.classList.add('on');
    }, opt));
    // The HUD's Ultimate and Assist icons double as buttons.
    for (const [sel, a] of [['#ult', 'ult'], ['#assist', 'assist']]) {
      const b = document.querySelector(sel); if (!b) continue;
      b.addEventListener('touchstart', e => { e.preventDefault(); this.touched(); this.hitQ[a] = true; }, opt);
    }
    window.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.ids.move) {
          let dx = t.clientX - this.mvBase.x, dy = t.clientY - this.mvBase.y; const l = Math.hypot(dx, dy), R = this.R;
          if (l > R * 1.6) { // drag the base along so the stick never "runs out"
            this.mvBase.x += dx / l * (l - R * 1.6); this.mvBase.y += dy / l * (l - R * 1.6);
            this.mv.style.left = this.mvBase.x + 'px'; this.mv.style.top = this.mvBase.y + 'px';
            dx = t.clientX - this.mvBase.x; dy = t.clientY - this.mvBase.y;
          }
          const k = Math.min(1, Math.hypot(dx, dy) / R), a = Math.atan2(dy, dx);
          this.move = k < 0.15 ? { x: 0, y: 0 } : { x: Math.cos(a) * k, y: Math.sin(a) * k };
          this.setKnob(this.mvKnob, Math.cos(a) * k * R, Math.sin(a) * k * R);
        } else if (t.identifier === this.ids.aim) this.aimMove(t);
      }
      if (this.shown) e.preventDefault();
    }, opt);
    const end = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.ids.move) { delete this.ids.move; this.move = { x: 0, y: 0 }; this.mv.classList.add('hidden'); }
        else if (t.identifier === this.ids.aim) { delete this.ids.aim; this.aimHeld = false; this.aimOn = false; this.setKnob(this.amKnob, 0, 0); }
        const b = this.ids['b' + t.identifier];
        if (b) { delete this.ids['b' + t.identifier]; this.held[b] = false; const be = el.querySelector(`[data-a="${b}"]`); if (be) be.classList.remove('on'); }
      }
    };
    window.addEventListener('touchend', end); window.addEventListener('touchcancel', end);
    // Taps on the bare canvas shouldn't turn into mouse clicks (which would attack).
    G.canvas.addEventListener('touchstart', e => { this.touched(); if (G.scene !== 'title') e.preventDefault(); }, opt);
    // Any touch counts as "on a touch screen". Keyboard or a real mouse switches back.
    window.addEventListener('touchstart', () => this.touched(true), { capture: true, passive: true });
    window.addEventListener('keydown', () => { Input.usingTouch = false; });
    window.addEventListener('mousemove', () => { if (performance.now() - this.lastTouch > 1200) Input.usingTouch = false; });

    this.wrapInput();
    this.ready = true; // G.loop calls tick() every frame from now on
  },
  tick() { if (this.ready) try { this.frame(); } catch (e) { /* never break the game over the overlay */ } },
  touched(passive) {
    this.lastTouch = performance.now();
    if (!this.seen) { this.seen = true; }
    if (this.mode() !== 'off') Input.usingTouch = true;
    if (passive) this.fullscreen();
  },
  fullscreen() {
    if (!this.wanted() || SAVE.data.settings.touchFs === false || document.fullscreenElement || this.fsTried) return;
    const d = document.documentElement, rq = d.requestFullscreen || d.webkitRequestFullscreen;
    if (!rq) return;
    this.fsTried = true; // one attempt per tap-gesture; reset when leaving full screen
    try {
      const p = rq.call(d, { navigationUI: 'hide' });
      if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* not supported */ } }).catch(() => {});
    } catch (e) { /* not allowed */ }
  },
  setKnob(k, x, y) { k.style.transform = `translate(${x}px, ${y}px)`; },
  aimMove(t) {
    const dx = t.clientX - this.amBase.x, dy = t.clientY - this.amBase.y, R = this.R;
    const k = Math.min(1, Math.hypot(dx, dy) / R), a = Math.atan2(dy, dx);
    this.aimOn = k > 0.3;
    if (this.aimOn) this.aim = { x: Math.cos(a), y: Math.sin(a) };
    this.setKnob(this.amKnob, Math.cos(a) * k * R, Math.sin(a) * k * R);
  },
  reset() {
    this.ids = {}; this.held = {}; this.hitQ = {}; this.move = { x: 0, y: 0 }; this.aimOn = false; this.aimHeld = false;
    if (this.mv) { this.mv.classList.add('hidden'); this.setKnob(this.amKnob, 0, 0); this.el.querySelectorAll('.on').forEach(b => b.classList.remove('on')); }
  },

  /* Where the hero aims on touch: the stick if dragged, else the nearest foe, else where you're walking. */
  nearest(p, range = 460) {
    let best = null, bd = range;
    for (const e of G.enemies) { if (e.dead || e.spawnT > 0) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
    return best;
  },
  aimAt(p) {
    this.targetDist = 0;
    if (this.aimOn) return Math.atan2(this.aim.y, this.aim.x);
    const e = this.nearest(p);
    if (e) { this.targetDist = Math.hypot(e.x - p.x, e.y - p.y); return Math.atan2(e.y - e.r * 0.6 - (p.y - 18), e.x - p.x); }
    if (Math.hypot(this.move.x, this.move.y) > 0.2) return Math.atan2(this.move.y, this.move.x);
    return p.aim;
  },
  /* For moves aimed "at the cursor": a point ahead of the hero (on the target if there is one). */
  reach() { return this.targetDist ? clamp(this.targetDist, 120, 420) : 260; },

  wrapInput() {
    const I = Input, T = this;
    for (const [fn, a] of [['attackHit', 'attack'], ['specialHit', 'special'], ['dashHit', 'dash'], ['ultHit', 'ult'], ['interactHit', 'interact'], ['pauseHit', 'pause'], ['assistHit', 'assist']]) {
      const f = I[fn]; if (!f) continue;
      I[fn] = function () { return f.call(this) || !!T.hitQ[a]; };
    }
    const held = I.attackHeld; I.attackHeld = function () { return held.call(this) || T.aimHeld; };
    const mv = I.moveVec;
    I.moveVec = function () {
      const v = mv.call(this); let x = v.x + T.move.x, y = v.y + T.move.y; const l = Math.hypot(x, y);
      return l > 1 ? { x: x / l, y: y / l } : { x, y };
    };
    const ef = I.endFrame; I.endFrame = function () { ef.call(this); T.hitQ = {}; };
  },

  frame() {
    const want = this.wanted();
    document.body.classList.toggle('touch', want);
    const hud = document.getElementById('hud');
    const dlg = document.getElementById('dialogue');
    const show = want && (G.scene === 'run' || G.scene === 'hub') && !UI.modal && hud && !hud.classList.contains('hidden') && !(dlg && !dlg.classList.contains('hidden'));
    if (show !== this.shown) { this.shown = show; this.el.classList.toggle('show', show); if (!show) this.reset(); }
    if (!document.fullscreenElement) this.fsTried = false;
    PERF.frame();
    if (!show || !P) return;
    // G.nearNpc can be left over from another room, so check the distance ourselves.
    const nn = G.nearNpc, nearOk = nn && G.npcs.includes(nn) && !nn.scenery && Math.hypot(P.x - nn.x, P.y - nn.y) < nn.r + 70;
    const canInt = !!nearOk || (G.hubFight && G.hubFight.tag >= 100);
    this.btnInt.classList.toggle('hidden', !canInt);
    const sp = P.spT > 0 && P.spMax ? P.spT / P.spMax : 0;
    this.cd.style.height = (sp * 100) + '%';
    const n = P.dashes | 0, mx = P.stats.dash | 0;
    if (this.pipsN !== n * 10 + mx) { this.pipsN = n * 10 + mx; this.pips.innerHTML = Array.from({ length: mx }, (_, i) => `<b class="${i < n ? 'f' : ''}"></b>`).join(''); }
  },
};

/* ---------------- Lite graphics ---------------- */
/* 'auto' turns Lite on if the game runs slowly for a few seconds during play. */
const PERF = {
  acc: 0, n: 0, last: 0,
  mode() { return (SAVE.data && SAVE.data.settings.gfx) || 'auto'; },
  apply() {
    const lite = this.mode() === 'lite' || (this.mode() === 'auto' && this.autoLite);
    if (lite === !!G.lite) return;
    G.lite = lite; G.parts.cap = lite ? 300 : 900; G.resize();
  },
  frame() {
    const now = performance.now(), dt = now - (this.last || now); this.last = now;
    this.apply();
    if (this.mode() !== 'auto' || this.autoLite || G.scene !== 'run' || UI.modal || dt <= 0 || dt > 250) { this.acc = 0; this.n = 0; return; }
    this.acc += dt; this.n++;
    if (this.acc > 4000) {
      const fps = this.n / (this.acc / 1000);
      if (fps < 42) { this.autoLite = true; this.apply(); if (UI.toast) UI.toast('Lite graphics on to keep things smooth (Settings to change)'); }
      this.acc = 0; this.n = 0;
    }
  },
};

addEventListener('load', () => TOUCH.init());
