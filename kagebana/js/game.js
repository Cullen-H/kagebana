'use strict';
/* =====================================================================
   KAGEBANA — game.js
   Save data, the main loop, rooms & runs, the hub, combat resolution,
   effects and rendering.
   ===================================================================== */

/* ------------------------------------------------------------------ */
/*  SAVE                                                               */
/* ------------------------------------------------------------------ */
const SAVE = {
  key: 'kagebana_save_v1', data: null,
  defaults() {
    return {
      v: 1, shards: 0, keys: 0, fragments: [], mirror: {}, pact: {},
      heroes: Object.fromEntries(HERO_ORDER.map(h => [h, { unlocked: h === 'akane', forms: [0], form: 0 }])), patron: 'fire', patron2: 'ice',
      hero: 'akane', flags: {}, talked: {}, runs: 0, deaths: 0, clears: 0, bossKills: {}, bossMeets: {}, clearsByHero: {},
      seen: {}, kills: {}, relicsSeen: {}, kamiSeen: {}, bestHeat: -1, bestDepth: 0, playTime: 0,
      settings: { vol: 0.7, sfx: 0.8, music: 0.5, shake: true, dmgNum: true, touch: 'auto', touchFs: true, gfx: 'auto', binds: JSON.parse(JSON.stringify(DEFAULT_BINDS)) },
    };
  },
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(this.key)); } catch (e) { d = null; }
    const def = this.defaults();
    if (!d || typeof d !== 'object') d = def;
    for (const k in def) if (d[k] === undefined) d[k] = def[k];
    for (const h in def.heroes) if (!d.heroes[h]) d.heroes[h] = def.heroes[h];
    for (const k in def.settings) if (d.settings[k] === undefined) d.settings[k] = def.settings[k];
    for (const a in DEFAULT_BINDS) if (!Array.isArray(d.settings.binds[a])) d.settings.binds[a] = DEFAULT_BINDS[a].slice();
    this.data = d;
    this.applySettings();
  },
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* storage full or blocked */ } },
  wipe() { this.data = this.defaults(); this.save(); },
  exists() { try { return !!localStorage.getItem(this.key); } catch (e) { return false; } },
  applySettings() {
    const s = this.data.settings;
    SFX.vol = s.vol; SFX.sfxVol = s.sfx; SFX.musicVol = s.music; SFX.applyVol();
  },
  heat() { return Object.values(this.data.pact).reduce((a, b) => a + b, 0); },
};

const ROOMS_PER_ACT = 9; // 1-7 combat/encounters, 8 waystation, 9 boss
const WALL = 40, WALL_TOP = 90;

/* ------------------------------------------------------------------ */
/*  GAME                                                               */
/* ------------------------------------------------------------------ */
const G = {
  scene: 'boot', t: 0, hitstop: 0, timeScale: 1, slowT: 0, fadeA: 0, fadeDir: 0, fadeCb: null,
  enemies: [], projs: [], zones: [], pickups: [], obstacles: [], doors: [], npcs: [], ghosts: [], decals: [], stopHeld: [],
  slashes: [], rings: [], lines: [], bolts: [], texts: [], timers: [], says: [], amb: [],
  parts: new Particles(), cam: { x: 700, y: 450, shake: 0, sx: 0, sy: 0 }, zoom: 1,
  room: null, run: null, controlLocked: false, flashA: 0, flashC: '#fff', boss: null,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    SAVE.load();
    Input.init(this.canvas);
    UI.init();
    window.addEventListener('resize', () => this.resize());
    // Phones: if Chrome drops the canvas's memory (full screen, rotating, low memory), redraw the room's floor.
    this.canvas.addEventListener('contextrestored', () => { if (this.room) this.room.floor = this.buildFloor(this.room); this.vig = null; });
    window.addEventListener('error', e => this.showError(e.error || e.message));
    window.addEventListener('unhandledrejection', e => this.showError(e.reason));
    this.resize();
    this.makeHubRoom();
    this.scene = 'title';
    UI.title();
    this.last = performance.now();
    requestAnimationFrame(ts => this.loop(ts));
    setInterval(() => { if (this.scene === 'run' || this.scene === 'hub') { SAVE.data.playTime += 10; } }, 10000);
  },
  resize() {
    const dpr = this.lite ? 1 : Math.min(2, window.devicePixelRatio || 1); // Lite graphics (touch.js) renders at 1x
    this.dpr = dpr; this.w = window.innerWidth; this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * dpr); this.canvas.height = Math.floor(this.h * dpr);
    this.canvas.style.width = this.w + 'px'; this.canvas.style.height = this.h + 'px';
    this.zoom = clamp(Math.min(this.w / 1020, this.h / 690), 0.5, 1.6);
    this.vig = null;
  },
  biome() { return this.room ? this.room.biome : BIOMES[0]; },
  acts() { return CAMPAIGNS[this.run ? this.run.camp || 0 : 0].acts; },
  camp() { return CAMPAIGNS[this.run ? this.run.camp || 0 : 0]; },
  qtes: [], darkT: 0, timeStopT: 0, timeStopMax: 1, bubbles: [], camTarget: null, riftOpen: 0, hubBreak: 0,
  ez() { return this.zoom * ((this.room && this.room.zoomMul) || 1); },
  /* The interact prompt's key: the bound key, the pad button, or the touch button. */
  intKey() { return Input.usingTouch && !Input.usingPad ? '✋' : Input.usingPad ? '(B)' : `[${keyName(Input.binds().interact[0])}]`; },
  pAfter(t, fn) { this.timers.push({ t, fn, p: true }); },
  actMult() { return [1, 1.45, 2.0, 2.7][this.run ? this.run.act : 0]; },

  /* ---------------- main loop ---------------- */
  /* One bad frame shouldn't freeze the game: keep looping, and show the error on screen
     (there's no console on a phone). */
  loop(ts) {
    try { this.frame(ts); } catch (e) { this.showError(e); this.last = ts; requestAnimationFrame(t => this.loop(t)); }
  },
  showError(e) {
    const msg = String((e && e.message) || e), at = String((e && e.stack) || '').split('\n').slice(0, 3).join(' < ').replace(/https?:\/\/[^ )]*\/js\//g, '');
    this.errs = this.errs || {};
    if (this.errs[msg]) return; this.errs[msg] = true;
    let box = document.getElementById('errbox');
    if (!box) {
      box = document.createElement('div'); box.id = 'errbox';
      box.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:9999;background:rgba(120,0,20,.92);color:#fff;font:12px monospace;padding:8px;border-radius:6px;max-height:40vh;overflow:auto;white-space:pre-wrap';
      box.onclick = () => box.remove();
      document.body.appendChild(box);
      box.textContent = 'Something broke (tap to hide). Please screenshot this:\n';
    }
    box.textContent += '\n• ' + msg + '\n  ' + at + '\n  ' + navigator.userAgent.replace(/^Mozilla\/5\.0 /, '');
  },
  /* ?debug in the address: a small readout for testing on phones. */
  debugInfo(ts) {
    this.dbgN = (this.dbgN || 0) + 1;
    if (ts - (this.dbgT || 0) < 500) return;
    let el = document.getElementById('dbg');
    if (!el) { el = document.createElement('div'); el.id = 'dbg'; el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:4px;z-index:9998;background:rgba(0,0,0,.75);color:#7dffb0;font:11px monospace;padding:3px 6px;pointer-events:none;white-space:nowrap'; document.body.appendChild(el); }
    const fps = Math.round(this.dbgN * 1000 / (ts - (this.dbgT || ts - 500))), c = this.canvas, lost = this.ctx.isContextLost ? this.ctx.isContextLost() : '?';
    el.textContent = `${fps}fps · win ${innerWidth}x${innerHeight} · canvas ${c.width}x${c.height} (${c.style.width}) · dpr ${this.dpr} · lost ${lost} · ${this.scene} · cam ${Math.round(this.cam.x)},${Math.round(this.cam.y)} · P ${P ? Math.round(P.x) + ',' + Math.round(P.y) : '-'} · fs ${!!document.fullscreenElement}`;
    this.dbgT = ts; this.dbgN = 0;
  },
  frame(ts) {
    // Going full screen or rotating can resize the page without a usable resize event (or with one fired
    // mid-transition at the wrong size), leaving a blank canvas. Check the size every frame instead.
    if (innerWidth > 0 && innerHeight > 0 && (innerWidth !== this.w || innerHeight !== this.h)) this.resize();
    if (this.debug === undefined) this.debug = /[?&]debug\b/.test(location.search);
    if (this.debug) this.debugInfo(ts);
    const rdt = Math.min(0.05, (ts - this.last) / 1000 || 0.016);
    this.last = ts;
    Input.pollPad();
    const z = this.ez();
    Input.mouse.wx = (Input.mouse.x - this.w / 2) / z + this.cam.x;
    Input.mouse.wy = (Input.mouse.y - this.h / 2) / z + this.cam.y;
    // With no mouse (touch or gamepad), moves aimed "at the cursor" target a point ahead of the hero.
    if ((Input.usingTouch || Input.usingPad) && P) {
      const d = Input.usingTouch && !Input.usingPad && typeof TOUCH !== 'undefined' ? TOUCH.reach() : 260;
      Input.mouse.wx = P.x + Math.cos(P.aim) * d; Input.mouse.wy = P.y - 18 + Math.sin(P.aim) * d;
    }
    if ((this.scene === 'run' || this.scene === 'hub') && !UI.modal && Input.pauseHit()) UI.pause();
    const active = (this.scene === 'run' || this.scene === 'hub' || this.scene === 'title') && !UI.modal;
    if (active) this.update(rdt);
    else { this.parts.update(rdt * 0.3); this.updateAmb(rdt); }
    this.updateFade(rdt);
    this.render();
    if (this.scene === 'run' || this.scene === 'hub') UI.hud();
    if (typeof TOUCH !== 'undefined') TOUCH.tick();
    Input.endFrame();
    requestAnimationFrame(t => this.loop(t));
  },
  update(rdt) {
    if (this.scene === 'title') { this.t += rdt; this.updateAmb(rdt); this.parts.update(rdt); this.cam.x = 700 + Math.sin(this.t * 0.1) * 120; this.cam.y = 450; return; }
    if (this.slowT > 0) { this.slowT -= rdt; if (this.slowT <= 0) this.timeScale = 1; }
    let dt = rdt * this.timeScale;
    if (this.hitstop > 0) { this.hitstop -= rdt; dt = 0; }
    this.t += dt;
    if (this.run) this.run.time += dt;
    // timers
    const stopped = this.timeStopT > 0;
    if (stopped) { this.timeStopT -= dt; if (this.timeStopT <= 0) { SFX.play('timeresume'); this.flash('#c8d8ff', 0.3); } }
    for (const b of this.bubbles) b.t += dt;
    this.bubbles = this.bubbles.filter(b => b.t < b.dur);
    const inBubble = (x, y) => this.bubbles.some(b => Math.hypot(x - b.x, y - b.y) < b.r);
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      if (stopped && !tm.p) continue;
      tm.t -= dt;
      if (tm.t <= 0) { this.timers.splice(i, 1); if (!tm.owner || !tm.owner.dead) tm.fn(); }
    }
    if (P && P.hp > 0) {
      P.px = P.x; P.py = P.y;
      P.update(dt);
      if (dt > 0) { P.vxEst = lerp(P.vxEst, (P.x - P.px) / dt, 0.2); P.vyEst = lerp(P.vyEst, (P.y - P.py) / dt, 0.2); }
    }
    if (!stopped) for (const e of this.enemies) if (!e.dead) e.update(this.bubbles.length && inBubble(e.x, e.y) ? dt * 0.3 : dt);
    this.separate();
    this.enemies = this.enemies.filter(e => !e.dead);
    // Time stop freezes every projectile, yours included; they carry on when time resumes.
    for (const p of this.projs) { if (stopped) continue; if (p.team === 'e') p.update(this.bubbles.length && inBubble(p.x, p.y) ? dt * 0.3 : dt); else p.update(dt); }
    if (!stopped && this.stopHeld.length) this.releaseStop();
    this.projs = this.projs.filter(p => !p.dead);
    for (const z of this.zones) if (!(stopped && z.team === 'e')) z.update(dt);
    this.zones = this.zones.filter(z => !z.dead);
    this.updatePickups(dt);
    this.updateQte(dt);
    this.darkT = Math.max(0, this.darkT - dt);
    this.updateFx(dt);
    this.updateAmb(rdt);
    if (this.scene === 'run') this.updateRoom(dt);
    if (this.scene === 'hub') this.updateHub(dt);
    this.updateCamera(rdt);
  },
  separate() {
    const E = this.enemies;
    for (let i = 0; i < E.length; i++) {
      const a = E[i]; if (a.dead || a.isBoss && a.id === 'mecha') continue;
      for (let j = i + 1; j < E.length; j++) {
        const b = E[j]; if (b.dead) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = (a.r + b.r) * 0.9;
        if (d < m && d > 0.01) {
          const push = (m - d) * 0.5, nx = dx / d, ny = dy / d;
          if (!a.isBoss) { a.x -= nx * push; a.y -= ny * push; }
          if (!b.isBoss) { b.x += nx * push; b.y += ny * push; }
        }
      }
    }
  },
  updateCamera(rdt) {
    if (!P) return;
    const R = this.room, z = this.ez();
    const vw = this.w / z, vh = this.h / z;
    let tx = P.x + Math.cos(P.aim) * 40, ty = P.y - 20 + Math.sin(P.aim) * 30;
    if (this.camTarget) { tx = this.camTarget.x; ty = this.camTarget.y; }
    const mx = 140;
    tx = vw > R.w + mx * 2 ? R.x0 + R.w / 2 : clamp(tx, R.x0 + vw / 2 - mx, R.x0 + R.w - vw / 2 + mx);
    ty = vh > R.h + mx * 2 ? R.y0 + R.h / 2 : clamp(ty, R.y0 + vh / 2 - mx, R.y0 + R.h - vh / 2 + mx);
    const k = Math.min(1, rdt * 6);
    this.cam.x = lerp(this.cam.x, tx, k); this.cam.y = lerp(this.cam.y, ty, k);
    if (this.cam.shake > 0) {
      const s = SAVE.data.settings.shake ? this.cam.shake : 0;
      this.cam.sx = rand(-s, s); this.cam.sy = rand(-s, s);
      this.cam.shake = Math.max(0, this.cam.shake - rdt * 40);
    } else { this.cam.sx = 0; this.cam.sy = 0; }
  },

  /* ---------------- generic API used by heroes / enemies ---------------- */
  after(t, fn, owner) { this.timers.push({ t, fn, owner }); },
  shake(a) { this.cam.shake = Math.max(this.cam.shake, a); },
  stop(t) { this.hitstop = Math.max(this.hitstop, t); },
  slow(scale, t) { this.timeScale = scale; this.slowT = t; },
  flash(c, a) { this.flashC = c; this.flashA = Math.max(this.flashA, a); },
  text(x, y, txt, color = '#fff', size = 16, o = {}) {
    if (!SAVE.data.settings.dmgNum && o.dmg) return;
    if (this.texts.length > 80) this.texts.shift();
    this.texts.push({ x: x + rand(-8, 8), y, txt: String(txt), color, size, t: 0, life: o.life || 0.8, vy: o.vy || -70, crit: o.crit });
  },
  say(e, txt, dur = 2.2) { this.says = this.says.filter(s => s.e !== e); this.says.push({ e, txt, t: 0, dur }); },
  fxSlash(o) { this.slashes.push(Object.assign({ t: 0, dur: 0.18, dir: 1, width: 1 }, o)); },
  fxRing(x, y, r, color, dur = 0.3, width = 6) { this.rings.push({ x, y, r, color, dur, width, t: 0 }); },
  fxLine(x1, y1, x2, y2, color, width = 10, dur = 0.25) { this.lines.push({ x1, y1, x2, y2, color, width, dur, t: 0 }); },
  fxBolt(x1, y1, x2, y2, color = '#ffe14d') {
    const pts = [], n = 8;
    for (let i = 0; i <= n; i++) { const k = i / n; pts.push({ x: lerp(x1, x2, k) + (i && i < n ? rand(-14, 14) : 0), y: lerp(y1, y2, k) + (i && i < n ? rand(-14, 14) : 0) }); }
    this.bolts.push({ pts, color, t: 0, dur: 0.2 });
  },
  ghost(p, x, y, dur = 0.3) { this.ghosts.push({ kind: 'p', x, y, dur, t: 0, pal: p.hero.pal, hair: p.hero.hair, acc: p.hero.acc, lx: p.lookX, ly: p.lookY, pt: p.t }); },
  /* A one-off drawing in the world, depth-sorted with everything else (see dashfx.js).
     draw(ctx, d, k): k runs 0 → 1 over its life. tick(d, dt) and end(d) are optional. */
  decal(o) { const d = Object.assign({ t: 0, dur: 0.5 }, o); this.decals.push(d); return d; },
  ghostE(e, x, y) { this.ghosts.push({ kind: 'e', e, x: x === undefined ? e.x : x, y: y === undefined ? e.y : y, dur: 0.25, t: 0 }); },
  boom(x, y, r) {
    this.fxRing(x, y, r, '#ffb347', 0.35, 10);
    this.parts.burst(x, y, 22, { type: 'glow', color: '#ff8a3d', min: 80, max: 320, size: 5 });
    this.parts.burst(x, y, 10, { type: 'smoke', color: '#555', min: 30, max: 140, size: 8 });
    SFX.play('boom'); this.shake(8);
  },
  cutin(id, name, jp, sub) { UI.cutin(id, name, jp, sub); },
  enemiesInRange(x, y, r) {
    return this.enemies.filter(e => !e.dead && e.spawnT <= 0 && !e.passive && Math.hypot(e.x - x, e.y - y) < r + e.r);
  },
  nearestEnemy(x, y, r) {
    let best = null, bd = r;
    for (const e of this.enemies) { if (e.dead || e.spawnT > 0) continue; const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } }
    return best;
  },
  placeNear(p, t, d) { const a = rand(0, TAU); p.x = t.x + Math.cos(a) * (t.r + d); p.y = t.y + Math.sin(a) * (t.r + d); this.resolve(p); p.aim = angTo(p, t); },
  clampToArena(x, y, r = 20) {
    const R = this.room;
    return { x: clamp(x, R.x0 + WALL + r, R.x0 + R.w - WALL - r), y: clamp(y, R.y0 + WALL_TOP + r, R.y0 + R.h - WALL - r) };
  },
  blocked(x, y, r) {
    const R = this.room;
    if (x < R.x0 + WALL - 20 || x > R.x0 + R.w - WALL + 20 || y < R.y0 + WALL_TOP - 50 || y > R.y0 + R.h - WALL + 20) return true;
    for (const o of this.obstacles) if (Math.hypot(x - o.x, y - o.y) < o.r + r) return true;
    return false;
  },
  resolve(e) {
    const R = this.room, r = e.r * 0.8;
    let hit = false;
    const x0 = R.x0 + WALL + r, x1 = R.x0 + R.w - WALL - r, y0 = R.y0 + WALL_TOP + r * 0.5, y1 = R.y0 + R.h - WALL - r * 0.3;
    if (e.x < x0) { e.x = x0; hit = true; } else if (e.x > x1) { e.x = x1; hit = true; }
    if (e.y < y0) { e.y = y0; hit = true; } else if (e.y > y1) { e.y = y1; hit = true; }
    if (!(e.def && e.def.fly)) {
      for (const o of this.obstacles) {
        let dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy);
        const m = o.r + r;
        if (d < m) { if (d < 0.01) { dx = 1; d = 1; } e.x = o.x + dx / d * m; e.y = o.y + dy / d * m; hit = true; }
      }
    }
    return hit;
  },
  moveSafe(e, dx, dy) {
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 12) || 1;
    let hit = false;
    for (let i = 0; i < steps; i++) { e.x += dx / steps; e.y += dy / steps; if (this.resolve(e)) hit = true; }
    return hit;
  },
  spawnEnemy(id, x, y, o = {}) {
    const R = this.room;
    const p = this.clampToArena(x, y, 30);
    const heat = this.run ? this.run.heat : {};
    const opt = Object.assign({
      hpMult: this.actMult() * (1 + 0.15 * (heat.hp || 0)) * (1 + 0.05 * (this.run ? this.run.roomNum : 0)),
      dmgMult: [1, 1.15, 1.3, 1.45][this.run ? this.run.act : 0] * (1 + 0.2 * (heat.dmg || 0)),
      spdMult: 1 + 0.12 * (heat.spd || 0),
    }, o);
    const C = this.camp();
    if (C.hpMult) { const boss = !!BOSSES[id]; if (!boss) opt.hpMult *= C.hpMult; opt.dmgMult *= boss ? C.dmgMult * 0.9 : C.dmgMult; opt.spdMult = (opt.spdMult || 1) * C.spdMult; opt.tempoMult = C.tempo; }
    const e = new Enemy(id, p.x, p.y, opt);
    this.enemies.push(e);
    if (!SAVE.data.seen[id]) SAVE.data.seen[id] = true;
    if (!o.noSpawn) SFX.play('spawn', 0.4);
    return e;
  },
  eProj(o) { const p = new Proj(Object.assign({ team: 'e' }, o)); this.projs.push(p); return p; },
  pProj(o) { const p = new Proj(Object.assign({ team: 'p' }, o)); this.projs.push(p); return p; },
  addZone(o) { const z = new Zone(Object.assign({ team: 'e' }, o)); this.zones.push(z); return z; },
  pZone(o) { const z = new Zone(Object.assign({ team: 'p', shape: 'circle' }, o)); this.zones.push(z); return z; },

  /* ---------------- player hits ---------------- */
  swing(p, o) {
    const a = p.aim, cx = p.x, cy = p.y - 14, dir = o.dir || 1;
    p.swingT = p.swingDur = 0.16;
    p.swingFrom = a - dir * o.arc / 2; p.swingTo = a + dir * o.arc / 2;
    this.fxSlash({ x: cx, y: cy, r: o.r, ang: a, arc: o.arc, color: o.color, dur: o.punch ? 0.12 : 0.2, dir, width: o.width || 1, punch: o.punch });
    let n = 0;
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const ex = e.x, ey = e.y - e.r * 0.8;
      const d = Math.hypot(ex - cx, ey - cy);
      if (d < o.r + e.r && (d < e.r + 12 || Math.abs(angDiff(a, Math.atan2(ey - cy, ex - cx))) < o.arc / 2 + 0.25)) {
        this.damageEnemy(e, o.dmg, { slot: o.slot, kb: o.kb, kbAng: a, stun: o.stun, el: o.el, pierceGuard: o.pierceGuard }); n++;
      }
    }
    if (n) { this.stop(Math.min(0.08, 0.03 + 0.012 * n)); this.shake(o.punch ? 2 : 3); }
    return n;
  },
  hitCircle(x, y, r, dmg, src) {
    let n = 0;
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      if (Math.hypot(e.x - x, e.y - e.r * 0.6 - y) < r + e.r) { this.damageEnemy(e, dmg, Object.assign({ kbAng: Math.atan2(e.y - y, e.x - x) }, src)); n++; }
    }
    return n;
  },
  hitLine(x1, y1, x2, y2, w, dmg, src) {
    let n = 0;
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      if (segDist(e.x, e.y - e.r * 0.6, x1, y1 - 12, x2, y2 - 12) < w / 2 + e.r) { this.damageEnemy(e, dmg, Object.assign({ kbAng: Math.atan2(y2 - y1, x2 - x1) }, src)); n++; }
    }
    return n;
  },
  damageEnemy(e, base, src = {}) {
    if (!e || e.dead || e.spawnT > 0 || !P) return 0;
    if (e.isBoss && (e.invulnT > 0 || e.intro > 0)) { if (Math.random() < 0.06) this.text(e.x, e.y - 70, 'IMMUNE', '#aaa', 12); return 0; }
    // During a time stop, hits are held and all land together when time resumes (releaseStop).
    if (this.timeStopT > 0 && !src.released) {
      (e.stopHits || (e.stopHits = [])).push([base, src]);
      if (!this.stopHeld.includes(e)) this.stopHeld.push(e);
      this.parts.burst(e.x, e.y - e.r, 3, { color: '#c8d8ff', min: 40, max: 120, size: 2, life: 0.3 });
      if (this.t - (e.stopTxt || -9) > 0.12) { e.stopTxt = this.t; this.text(e.x, e.y - e.r * 2.5, '×' + e.stopHits.length, '#c8d8ff', 13); SFX.play('tick', 0.6); }
      return 0;
    }
    const s = P.stats, slot = src.slot, dot = !!src.dot;
    let dmg = base;
    if (slot === 'attack') dmg *= s.atk; else if (slot === 'special') dmg *= s.sp;
    if (!dot) dmg *= P.dmgBonus();
    const els = (src.el ? [src.el] : []).concat(src.el && src.elOnly ? [] : ((slot && s.elAll && s.elAll[slot]) || []));
    const el = els[0] || null;
    const elSum = k => { let t = 0; for (const x of els) if (x.k === k) t += x.pw; return t; };
    const pwMoon = elSum('moon'), pwIce = elSum('ice'), pwWind = elSum('wind'), pwGold = elSum('gold');
    let critC = s.crit + 0.12 * pwMoon + (s.luckyStar && this.run ? Math.min(0.12, this.run.gold / 10000) : 0);
    if (s.frostMoon && e.st.freeze > 0) critC = 1;
    if (s.moonTide && P.hp > s.maxHp * 0.8) critC += s.moonTide;
    let crit = !dot && slot !== 'misc' && Math.random() < critC;
    if (P.critNext && !dot && slot !== 'misc') { crit = true; P.critNext = false; }
    if (!dot && slot !== 'misc' && (P.luckyT > 0 || (P.critCharges > 0 && slot === 'attack'))) { if (!crit && P.critCharges > 0 && P.luckyT <= 0) P.critCharges--; crit = true; }
    if (crit && s.fullMoon && e.st.curse > 0) dmg *= 2;
    if (s.execute && e.hp < e.maxHp * 0.3) dmg *= 1 + s.execute;
    if (s.dawnbreak && e.st.burnT > 0) dmg *= 1.25;
    if (s.kiln) { let n = 0; for (const o of this.enemies) if (!o.dead && o.st.burnT > 0) n++; dmg *= 1 + Math.min(0.25, 0.02 * s.kiln * n); }
    if (s.jackpot && !dot && Math.random() < s.jackpot) { dmg *= 5; this.text(e.x, e.y - e.r * 3.2, 'JACKPOT!', '#ffcf40', 18); SFX.play('coin'); }
    if (crit) dmg *= 1 + s.critDmg;
    if (e.st.curse > 0) dmg *= 1.3 + s.curseMult;
    if (e.st.sake > 0) dmg *= 1.2; // Shuten's assist
    if (e.st.freeze > 0) dmg *= 1 + s.frozenMult;
    if (pwIce && e.st.chill > 0) dmg *= 1 + 0.03 * pwIce * e.st.chill;
    if (pwWind) dmg *= 1 + 0.15 * pwWind;
    if (pwGold && this.run) dmg *= 1 + Math.min(s.inariBless ? 2.4 : 1.2, 0.04 * pwGold * this.run.gold / 100 * (s.inariBless ? 2 : 1));
    if (s.bigGame && (e.elite || e.isBoss)) dmg *= 1 + s.bigGame;
    if (e.trait === 'armored') dmg *= 0.65;
    if (e.armorT > 0 && !src.pierceGuard) { dmg *= 0.3; if (Math.random() < 0.15) this.text(e.x, e.y - 90, 'ARMOR', '#ff6a3d', 12); }
    let blocked = false;
    if (e.def.ai === 'shield' && !dot && slot !== 'ult' && !src.pierceGuard) {
      const fromA = Math.atan2(P.y - e.y, P.x - e.x);
      if (Math.abs(angDiff(e.face, fromA)) < 1.05) { dmg *= 0.15; blocked = true; }
    }
    if (this.run && this.run.overload > 1) dmg /= this.run.overload;
    dmg = Math.max(1, dmg);
    e.hp -= dmg; e.flash = 0.09;
    if (this.run) this.run.dmgDealt = (this.run.dmgDealt || 0) + dmg;
    // knockback
    let kb = (src.kb || 0) * (1 - e.kbRes) * (pwWind ? 1.8 : 1) * s.kbMult;
    if (e.isBoss) kb *= 0.1;
    if (kb !== 0) { const a = src.kbAng !== undefined ? src.kbAng : angTo(P, e); e.vx += Math.cos(a) * kb; e.vy += Math.sin(a) * kb; }
    if (pwWind && !src.noProc) e.windSlam = 20 * pwWind;
    if (src.stun && !e.isBoss) e.st.stun = Math.max(e.st.stun, src.stun);
    // feedback
    if (blocked) {
      SFX.play('clang'); this.parts.burst(e.x + Math.cos(e.face) * 20, e.y - 20, 6, { color: '#49f0ff' });
      this.text(e.x, e.y - e.r * 2.5, 'BLOCK', '#49f0ff', 12, { dmg: true });
    } else if (src.released) {
      // one combined number is shown by releaseStop instead
    } else if (!src.quiet || dmg >= 10) {
      const col = dot ? (src.color || '#ff9a4d') : crit ? '#ffe14d' : (src.color || '#ffffff');
      this.text(e.x, e.y - e.r * 2.5, Math.round(dmg) + (crit ? '!' : ''), col, crit ? 24 : dot ? 13 : 17, { dmg: true, crit });
    }
    if (!dot) {
      this.parts.burst(e.x, e.y - e.r, crit ? 10 : 5, { color: crit ? '#ffe14d' : (el ? KAMI[el.k].color : '#fff'), min: 80, max: 300, size: 2 });
      if (!src.released) SFX.play(crit ? 'crit' : 'hit', 0.8);
      if (slot !== 'ult' && !src.released && !(P.bankaiT > 0 || P.prayT > 0 || P.berserkT > 0 || P.feastT > 0 || P.luckyT > 0 || P.domainT > 0 || P.auraT > 0 || P.typhoon || this.timeStopT > 0)) P.ult = Math.min(100, P.ult + dmg * 0.075 * s.ultGain);
      if (s.lifesteal) P.heal(dmg * s.lifesteal, true);
      if (P.feastT > 0) P.heal(dmg * 0.08, true);
      if (s.unbound && P.berserkT > 0) P.heal(dmg * 0.05, true);
      if (P.rally > 0 && P.rallyT > 0) { const h = Math.min(P.rally, dmg * 0.15); P.heal(h, true); P.rally -= h; }
      if (crit && s.critBurn) this.burn(e, 7 * s.critBurn);
      if (crit && s.waxing) P.ult = Math.min(100, P.ult + s.waxing);
      if (slot === 'special' && s.avalanche) this.chill(e, 2);
      if (s.frozenAssets && e.st.freeze > 0 && Math.random() < 0.2) this.pickups.push({ kind: 'coin', x: e.x, y: e.y, vx: rand(-100, 100), vy: rand(-100, 100), v: 3, t: 0 });
      if (s.capacitor && slot === 'attack' && ++P.capCount >= 6) { P.capCount = 0; const tg = e; this.after(0, () => { if (!tg.dead) { this.fxBolt(tg.x, tg.y - 450, tg.x, tg.y - 10); this.damageEnemy(tg, 40 * s.capacitor, { slot: 'misc', noProc: true }); SFX.play('thunder', 0.5); } }); }
      if (crit && s.critHeal) P.heal(s.critHeal, true);
    }
    if (!src.noProc && !dot && !blocked) for (const x of els) { if (e.dead) break; this.proc(e, x, dmg, crit); }
    if (e.scriptedFloor && this.hubFight && e.hp <= e.maxHp * e.scriptedFloor) { e.hp = e.maxHp * e.scriptedFloor; this.endHubFight(e); return dmg; }
    if (e.hp <= 0 && !e.dead) this.killEnemy(e);
    return dmg;
  },
  /* Time has resumed: every hit held on each enemy lands at once, with one combined number. */
  releaseStop() {
    const held = this.stopHeld; this.stopHeld = [];
    let any = false;
    for (const e of held) {
      const hits = e.stopHits || []; e.stopHits = null;
      if (e.dead || !hits.length) continue;
      let tot = 0;
      for (const [b, src] of hits) { if (e.dead) break; tot += this.damageEnemy(e, b, Object.assign({}, src, { released: true })) || 0; }
      if (tot > 0) {
        any = true;
        this.text(e.x, e.y - e.r * 3, Math.round(tot) + (hits.length > 1 ? `  ×${hits.length}` : ''), '#c8d8ff', hits.length > 4 ? 26 : 20, { dmg: true, crit: true });
        this.parts.burst(e.x, e.y - e.r, Math.min(20, 4 + hits.length * 2), { type: 'shard', color: '#dfe8ff', min: 100, max: 340, size: 2 });
      }
    }
    if (any) { SFX.play('crit'); SFX.play('heavy', 0.6); this.shake(6); }
  },
  proc(e, el, dmg, crit) {
    const s = P.stats, pw = el.pw;
    switch (el.k) {
      case 'fire': this.burn(e, 6 * pw); break;
      case 'thunder': this.chain(e, 12 * pw * s.chainMult, 2 + (pw > 1.7 ? 1 : 0) + s.chainExtra); break;
      case 'moon': if (crit) { e.st.curse = s.lunacy ? 6 : 3; if (s.lunacy) this.chill(e, 1); if (s.eclipseBurn) this.burn(e, 8); } break;
      case 'ice': this.chill(e, 1, pw); break;
      case 'wind': if (s.firestorm) this.burn(e, 5 * pw); break;
      case 'gold':
        if (this.scene === 'run' && Math.random() < 0.12) this.pickups.push({ kind: 'coin', x: e.x, y: e.y, vx: rand(-120, 120), vy: rand(-120, 120), v: 1 + pw, t: 0 });
        break;
      case 'blood':
        P.heal(dmg * 0.02 * pw, true);
        e.st.bleed = (e.st.bleed || 0) + 1;
        if (e.st.bleed >= 5) {
          e.st.bleed = 0;
          this.parts.burst(e.x, e.y - e.r, 16, { color: '#ff3d5e', min: 60, max: 260, size: 3, grav: 400 });
          SFX.play('burn');
          this.after(0, () => this.damageEnemy(e, 25 * pw, { slot: 'misc', noProc: true, color: '#ff3d5e' }));
        }
        break;
    }
    if (crit && s.frostMoon) this.chill(e, 2, 1);
  },
  burn(e, dps) {
    if (e.dead) return;
    const s = P.stats;
    e.st.burn = Math.min(e.st.burn + dps, 70 * Math.max(1, dps / 6));
    e.st.burnT = 3 + (s.burnDur || 0);
    if (s.firestorm && Math.random() < 0.25) {
      const n = this.enemiesInRange(e.x, e.y, 130).find(o => o !== e && o.st.burnT <= 0);
      if (n) { n.st.burn = Math.max(n.st.burn, dps); n.st.burnT = 3; }
    }
  },
  chill(e, n, pw = 1) {
    if (e.dead || !P) return;
    const s = P.stats;
    e.st.chill += n; e.st.chillT = 3.5;
    if (e.st.chill >= s.freezeAt) {
      e.st.chill = 0;
      const dur = (1 + 0.3 * pw + s.freezeDur) * (e.isBoss ? 0.35 : (s.absolute ? 2 : 1));
      if (s.coldSnap && !this._snap) { this._snap = true; for (const o of this.enemiesInRange(e.x, e.y, 150)) if (o !== e) this.chill(o, 2); this._snap = false; }
      if (s.steam && e.st.burnT > 0) { this.boom(e.x, e.y - 10, 90); this.hitCircle(e.x, e.y, 90, 60, { slot: 'misc', noProc: true }); }
      e.st.freeze = Math.max(e.st.freeze, dur);
      SFX.play('freeze', 0.6);
      this.parts.burst(e.x, e.y - e.r, 10, { type: 'shard', color: '#c9f3ff', min: 60, max: 200, size: 3 });
    }
  },
  chain(src, dmg, hops) {
    const s = P.stats, seen = new Set([src]);
    let cur = src;
    SFX.play('thunder', 0.6);
    for (let i = 0; i < hops; i++) {
      let best = null, bd = 240 * s.chainRange;
      for (const e of this.enemies) { if (e.dead || seen.has(e) || e.spawnT > 0 || e.passive) continue; const d = Math.hypot(e.x - cur.x, e.y - cur.y); if (d < bd) { bd = d; best = e; } }
      if (!best) break;
      seen.add(best);
      this.fxBolt(cur.x, cur.y - cur.r, best.x, best.y - best.r, '#ffe14d');
      const target = best;
      let cd = dmg;
      if (s.superCond) { if (target.st.freeze > 0) cd *= 2; this.chill(target, 1); }
      if (s.chainCrit && Math.random() < s.crit) { cd *= 1 + s.critDmg; this.text(target.x, target.y - 60, 'CRIT', '#ffe14d', 12); }
      this.damageEnemy(target, cd, { slot: 'misc', noProc: true, color: '#ffe14d' });
      if (s.plasma) this.burn(target, 10);
      if (s.chainStun && !target.isBoss) target.st.stun = Math.max(target.st.stun, s.chainStun);
      if (s.bloodBolt) P.heal(1, true);
      if (s.electrum && Math.random() < 0.2) this.pickups.push({ kind: 'coin', x: target.x, y: target.y, vx: rand(-100, 100), vy: rand(-100, 100), v: 3, t: 0 });
      cur = best;
    }
  },
  ultProc(u) {
    const list = this.enemiesInRange(P.x, P.y, 900), pw = u.pw;
    for (const e of list) {
      if (u.k === 'fire') this.burn(e, 15 * pw);
      else if (u.k === 'ice') this.chill(e, 3, pw);
      else if (u.k === 'moon') e.st.curse = 6;
      else if (u.k === 'thunder') this.after(rand(0.2, 1), () => { if (!e.dead) { this.fxBolt(e.x, e.y - 500, e.x, e.y - 10); this.damageEnemy(e, 40 * pw, { slot: 'misc', noProc: true }); SFX.play('thunder'); } });
      else if (u.k === 'wind') { const a = angTo(P, e); e.vx += Math.cos(a) * 700; e.vy += Math.sin(a) * 700; e.windSlam = 30 * pw; }
      else if (u.k === 'gold') for (let i = 0; i < 2; i++) this.pickups.push({ kind: 'coin', x: e.x, y: e.y, vx: rand(-200, 200), vy: rand(-200, 200), v: 2 + pw, t: 0 });
    }
    if (u.k === 'blood') P.heal(P.stats.maxHp * 0.08 * pw);
  },
  killEnemy(e, silent) {
    if (e.dead) return;
    e.dead = true;
    if (e.def.worn) this.wornFreed(e);
    const s = P ? P.stats : null;
    this.parts.burst(e.x, e.y - e.r, e.isBoss ? 60 : 16, { color: e.def.col || '#fff', min: 80, max: 360, size: 3 });
    this.parts.burst(e.x, e.y - e.r, 6, { type: 'smoke', color: '#222', min: 20, max: 90, size: 6 });
    SFX.play('kill');
    if (e.passive) return;
    SAVE.data.kills[e.id] = (SAVE.data.kills[e.id] || 0) + 1;
    if (this.run) this.run.kills++;
    if (!silent && this.scene === 'run' && !e.isBoss) {
      const gold = Math.round((e.def.gold || 1) * 0.5 * (e.elite ? 3 : 1) * (s ? s.gold : 1) * (1 + 0.1 * this.run.act));
      const coins = Math.max(1, Math.min(6, Math.ceil(gold / 3)));
      for (let i = 0; i < coins; i++) this.pickups.push({ kind: 'coin', x: e.x + rand(-10, 10), y: e.y + rand(-10, 10), vx: rand(-150, 150), vy: rand(-150, 150), v: gold / coins, t: 0 });
      if (this.run.luckyT > 0) for (let i = 0; i < 3; i++) this.pickups.push({ kind: 'coin', x: e.x, y: e.y, vx: rand(-200, 200), vy: rand(-200, 200), v: Math.max(2, gold / 2), t: 0 }); // Kogane's assist
      if (e.elite) for (let i = 0; i < 3; i++) this.pickups.push({ kind: 'shard', x: e.x, y: e.y, vx: rand(-120, 120), vy: rand(-120, 120), v: 2, t: 0 });
      if (Math.random() < 0.035) this.pickups.push({ kind: 'heal', x: e.x, y: e.y, vx: 0, vy: 0, v: 10, t: 0 });
    }
    if (!s || this.scene !== 'run') return;
    if (s.feast) P.heal(s.feast, true);
    if (s.frenzy) { P.frenzy = Math.min(5, P.frenzy + 1); P.frenzyT = 4; }
    if (s.bloodMoney) { P.heal(1, true); this.run.gold += 2; }
    if (s.bounty && e.elite) { this.run.gold += 30; this.addShards(2, true); this.text(e.x, e.y - 40, '+30 金 bounty', '#ffcf40', 13); }
    if (s.oniFeast && (this.run.feastHp || 0) < 40) { this.run.feastHp = (this.run.feastHp || 0) + 1; P.recompute(); P.heal(1, true); }
    if (e.def.deathField) this.addZone({ shape: 'circle', x: e.x, y: e.y, r: 85, warn: 0.3, dur: 3, field: true, tick: 0, dmg: e.dmg * 0.6, color: '#ffe14d', kind: 'fire' });
    if (s.harvest) P.ult = Math.min(100, P.ult + s.harvest * (e.st.curse > 0 ? 3 : 1));
    if (s.infernal && e.st.burnT > 0) P.heal(3, true);
    if (s.burnFortune && e.st.burnT > 0) for (let i = 0; i < 4; i++) this.pickups.push({ kind: 'coin', x: e.x, y: e.y, vx: rand(-200, 200), vy: rand(-200, 200), v: 3, t: 0 });
    if (s.wildfire && e.st.burnT > 0) {
      const pw = s.wildfire, x = e.x, y = e.y;
      this.after(0.05, () => {
        this.fxRing(x, y - 10, 110, '#ff7a3d', 0.3, 8);
        this.parts.burst(x, y - 10, 16, { type: 'glow', color: '#ff7a3d', min: 80, max: 260, size: 4 });
        for (const o of this.enemiesInRange(x, y, 110)) { this.damageEnemy(o, 30 * pw, { slot: 'misc', noProc: true, color: '#ff7a3d' }); this.burn(o, 6 * pw); }
        SFX.play('burn');
      });
    }
    if (s.shatter && (e.st.freeze > 0 || e.st.chill > 0)) {
      const pw = s.shatter, x = e.x, y = e.y;
      this.after(0.05, () => {
        this.parts.burst(x, y - 10, 18, { type: 'shard', color: '#c9f3ff', min: 100, max: 320, size: 3 });
        for (const o of this.enemiesInRange(x, y, 105)) { this.damageEnemy(o, 30 * pw, { slot: 'misc', noProc: true, color: '#9ee7ff' }); this.chill(o, 1); }
        SFX.play('freeze', 0.5);
      });
    }
    if (e.trait === 'explosive') {
      this.addZone({ shape: 'circle', x: e.x, y: e.y, r: 110, warn: 0.75, dmg: e.dmg, color: '#ff6a3d', onFire: z => this.boom(z.x, z.y, 110) });
    }
    if (e.isBoss) this.bossDefeated(e);
  },
  hurtPlayer(dmg, src) {
    if (!P || P.hp <= 0 || (this.scene !== 'run' && !this.hubFight)) return false;
    const parrying = (P.parryT > 0 || P.domainT > 0) && P.hero.onParry;
    // A raised mirror catches every projectile, even in the instant right after another parry.
    if (parrying && src instanceof Proj) { src.dead = true; P.hero.onParry(P, src); return true; }
    if (P.iframes > 0 || P.invuln > 0) {
      if (P.dashAt !== undefined && this.t - P.dashAt < 0.3 && P.dashFx && P.dashFx.dodge) P.dashFx.dodge(P);
      return false;
    }
    const s = P.stats;
    if (parrying) {
      let foe = src;
      if (src instanceof Zone) foe = src.owner || this.nearestEnemy(P.x, P.y, 400);
      P.hero.onParry(P, src instanceof Proj ? src : foe);
      return true;
    }
    if (P.berserkT > 0) {
      P.iframes = 0.3; SFX.play('clang', 0.7);
      this.parts.burst(P.x, P.y - 24, 8, { color: '#ff6a3d', min: 80, max: 240 });
      this.text(P.x, P.y - 58, 'ARMOR', '#ff6a3d', 14);
      return true;
    }
    if (P.shieldUp) {
      P.shieldUp = false; P.iframes = 0.6; SFX.play('clang');
      this.parts.burst(P.x, P.y - 20, 14, { color: '#9ee7ff', min: 80, max: 260 });
      this.text(P.x, P.y - 55, 'NEGATED', '#9ee7ff', 14);
      return true;
    }
    if (src && src.st && src.st.chill > 0 && s.chillWeak) dmg *= 1 - s.chillWeak;
    dmg *= 1 - s.armor;
    if (s.gilded && this.run) dmg *= 1 - Math.min(0.12, this.run.gold / 10000);
    if (P.guardT > 0 && s.dashGuard) dmg *= 1 - s.dashGuard;
    if (P.exhaustT > 0) dmg *= s.unbound ? 1.8 : 1.6;
    if (s.coinWard && this.run && this.run.gold >= 10) { this.run.gold -= 10; dmg *= 1 - s.coinWard; this.text(P.x + 20, P.y - 40, '-10 金', '#ffcf40', 12); }
    dmg = Math.max(1, Math.round(dmg));
    P.hp -= dmg; P.iframes = 0.85; P.hurtFlash = 0.3;
    if (s.rally) { P.rally = dmg * s.rally; P.rallyT = 3; }
    if (s.cinder) for (const e of this.enemiesInRange(P.x, P.y, 170)) this.burn(e, 10 * s.cinder);
    if (this.run) this.run.damageTaken = (this.run.damageTaken || 0) + dmg;
    this.shake(9); this.stop(0.06); this.flash('#ff2244', 0.35);
    SFX.play('hurt');
    this.text(P.x, P.y - 55, '-' + dmg, '#ff4d6d', 22);
    if (s.stormEye) {
      for (const e of this.enemiesInRange(P.x, P.y, 280)) { this.fxBolt(e.x, e.y - 400, e.x, e.y - 10, '#ffe14d'); this.damageEnemy(e, 40 * s.stormEye, { slot: 'misc', noProc: true }); }
      SFX.play('thunder');
    }
    if (s.frozenHeart && P.frozenHeartT <= 0) {
      P.frozenHeartT = 8;
      for (const e of this.enemiesInRange(P.x, P.y, 220)) this.chill(e, 5);
      this.fxRing(P.x, P.y, 220, '#9ee7ff', 0.4, 8);
    }
    if (s.phoenix && !P.phoenixUsed && P.hp > 0 && P.hp < s.maxHp * 0.3) {
      P.phoenixUsed = true;
      this.fxRing(P.x, P.y, 230, '#ff7a3d', 0.5, 14); this.flash('#ff7a3d', 0.4);
      this.hitCircle(P.x, P.y, 230, 60 * s.phoenix, { slot: 'misc', noProc: true, kb: 400 });
      P.heal(12 * s.phoenix); SFX.play('boom');
    }
    if (P.hp <= 0) this.playerDown();
    return true;
  },
  playerDown() {
    if (this.hubFight) { this.hubFightDown(); return; }
    const run = this.run;
    if (run.defy > 0) {
      run.defy--; P.hp = Math.round(P.stats.maxHp * 0.5); P.invuln = 2.2;
      UI.banner('SECOND WIND', '再起 — the lantern flickers, but does not go out'); this.flash('#ffffff', 0.7); SFX.play('heal'); this.slow(0.3, 0.8);
      this.hitCircle(P.x, P.y, 260, 0, { slot: 'misc', kb: 700, noProc: true, quiet: true });
      return;
    }
    if (run.ferryCoin) {
      run.ferryCoin = 0; run.relics = run.relics.filter(r => r !== 'c_coin'); P.recompute();
      P.hp = Math.round(P.stats.maxHp * 0.6); P.invuln = 2.2; run.gold = 0;
      UI.banner('THE FERRYMAN\'S TOLL', 'every coin you carried sinks into the river'); this.flash('#9ee7ff', 0.7); SFX.play('splash'); this.slow(0.3, 0.8);
      return;
    }
    if (run.crane > 0) {
      run.crane--; run.relics = run.relics.filter(r => r !== 'crane'); P.recompute();
      P.hp = Math.round(P.stats.maxHp * 0.4); P.invuln = 2.2;
      UI.banner('PAPER CRANE', 'the crane unfolds and carries you back'); this.flash('#ffffff', 0.7); SFX.play('heal'); this.slow(0.3, 0.8);
      return;
    }
    P.hp = 0; this.controlLocked = true;
    this.slow(0.25, 2.5); this.flash('#000000', 0.5);
    SFX.play('boom'); Music.stop();
    this.parts.burst(P.x, P.y - 20, 40, { type: 'petal', color: P.hero.pal.scarf, min: 50, max: 300, life: 2, size: 4, drag: 1 });
    UI.banner('DEFEATED', 'the moon pulls you home…', 'red');
    this.after(0.55, () => this.endRun(false));
  },

  /* ---------------- pickups ---------------- */
  updatePickups(dt) {
    if (!P) return;
    for (const p of this.pickups) {
      p.t += dt;
      if (p.kind === 'reward') {
        if (P.hp > 0 && Math.hypot(P.x - p.x, P.y - p.y) < 44 && !UI.modal) { p.dead = true; this.collectReward(p.reward); }
        continue;
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - Math.min(1, dt * 5); p.vy *= 1 - Math.min(1, dt * 5);
      const d = Math.hypot(P.x - p.x, P.y - p.y);
      const magnet = this.enemies.length === 0 ? 2000 : 150;
      if (p.t > 0.35 && d < magnet) { const a = angTo(p, P), sp = 300 + (magnet - d) * 2; p.x += Math.cos(a) * Math.min(sp, 900) * dt; p.y += Math.sin(a) * Math.min(sp, 900) * dt; }
      if (d < 24 && p.t > 0.2) {
        p.dead = true;
        if (p.kind === 'coin') { this.run.gold += Math.max(1, Math.round(p.v)); SFX.play('coin', 0.5); if (P.stats.coinHeal) P.heal(1, true); }
        else if (p.kind === 'shard') { this.addShards(p.v, true); SFX.play('coin', 0.5); }
        else if (p.kind === 'heal') { P.heal(p.v); SFX.play('heal'); }
      }
    }
    this.pickups = this.pickups.filter(p => !p.dead);
  },
  addGold(n) { const g = Math.round(n * P.stats.gold); this.run.gold += g; this.text(P.x, P.y - 60, '+' + g + ' 金', '#ffd56b', 18); SFX.play('coin'); },
 addShards(n, quiet) {
    const mult = (this.camp().shardMult || 1) * (1 + 0.1 * (this.run ? this.run.heatTotal : 0)) * (1 + 0.1 * (SAVE.data.mirror.wealth || 0));
    const v = Math.max(1, Math.round(n * mult));
    SAVE.data.shards += v; if (this.run) this.run.shards += v;
    if (!quiet) this.text(P.x, P.y - 60, '+' + v + ' 魂', '#6ee7ff', 18);
    return v;
  },
  addKeys(n) { SAVE.data.keys += n; if (this.run) this.run.keys += n; this.text(P.x, P.y - 75, '+' + n + ' Moon Key', '#ffd56b', 20); SFX.play('levelup'); SAVE.save(); },

  /* ---------------- boons & relics ---------------- */
  rollRarity(min = 0) {
    const L = (P ? P.stats.luck : 0) + (this.room && this.room.type === 'elite' ? 0.12 : 0);
    const r = Math.random();
    let v = 0;
    if (r < 0.025 + L * 0.4) v = 3; else if (r < 0.12 + L) v = 2; else if (r < 0.4 + L * 1.4) v = 1;
    return Math.max(min, v);
  },
  hasKami(k) { return this.run.boons.some(b => { const d = BOON_BY_ID[b.id]; return !d.duo && d.k === k; }); },
  deferOffers: false, pendingOffers: [],
  finishBoon() { const f = UI.onBoonDone; UI.onBoonDone = null; if (f) f(); },
  offerBoons(kami, o = {}) {
    if (this.deferOffers) { this.pendingOffers.push([kami, o]); return; }
    if (P.hero.godless) { this.offerDiscipline(o.minRarity >= 2 ? 2 : 1); return; }
    const run = this.run, have = new Set(run.boons.map(b => b.id));
    if (P.hero.devotion) {
      kami = null; o = Object.assign({}, o, { kamiPool: run.patrons, devotion: true });
      if (P.stats.living) o.minRarity = Math.max(o.minRarity || 0, 2);
    }
    const count = (o.count || 3) + P.stats.extraChoice;
    let pool = BOONS.filter(b => !have.has(b.id) && (!b.duo || (this.hasKami(b.k) && this.hasKami(b.k2))) && (!b.req || b.req(run)));
    if (kami) pool = pool.filter(b => b.k === kami || b.k2 === kami);
    else if (o.devotion) pool = pool.filter(b => b.duo ? (o.kamiPool.includes(b.k) && o.kamiPool.includes(b.k2)) : o.kamiPool.includes(b.k));
    else if (o.kamiPool) pool = pool.filter(b => o.kamiPool.includes(b.k) && !b.duo);
    const duos = pool.filter(b => b.duo);
    let picks = shuffle(pool.filter(b => !b.duo)).slice(0, count);
    if (duos.length && Math.random() < 0.6) { picks[picks.length - 1] = pick(duos); }
    picks = picks.filter(Boolean);
    if (!picks.length && o.devotion && run.boons.length) { UI.toast('Your patron has nothing left to give — it deepens a blessing instead.', KAMI[run.patrons[0]].color); UI.sake(1, () => this.finishBoon()); return; }
    if (!picks.length) { this.addGold(100); UI.toast('No more blessings to give — the Kami leave gold instead.'); this.finishBoon(); return; }
    const caps = pool.filter(b => b.capstone);
    if (caps.length && Math.random() < 0.5 && picks.length) picks[0] = pick(caps);
    const opts = picks.map(b => ({ def: b, r: b.duo || b.capstone ? 3 : this.rollRarity(o.minRarity || 0) }));
    if (kami) SAVE.data.kamiSeen[kami] = true;
    for (const op of opts) SAVE.data.kamiSeen[op.def.k] = true;
    UI.boonChoice(opts, kami || (o.kamiPool ? pick(o.kamiPool) : opts[0].def.k), (choice) => this.addBoon(choice.def, choice.r), () => {
      if (run.rerolls <= 0) return null;
      run.rerolls--;
      return shuffle(pool.slice()).slice(0, count).map(b => ({ def: b, r: b.duo || b.capstone ? 3 : this.rollRarity(o.minRarity || 0) }));
    });
  },
  patronOf() {
    const ps = this.run ? this.run.patrons : [SAVE.data.patron || 'fire'];
    return ps[Math.floor(this.t * 0.5) % ps.length] || 'fire';
  },
  fixReward(rw) {
    if (!rw || !this.run) return rw;
    const h = HEROES[this.run.hero];
    if (rw.t === 'boon' && h.godless) return { t: 'disc' };
    if (rw.t === 'sake' && h.godless) return { t: 'disc', x2: true };
    if (rw.t === 'boon' && h.devotion) return { t: 'boon', k: pick(this.run.patrons) };
    return rw;
  },
  offerDiscipline(levels = 1) {
    const run = this.run;
    const pool = DISCIPLINES.filter(d => !d.max || (run.disc[d.id] || 0) < d.max);
    const opts = shuffle(pool.slice()).slice(0, 3 + (P.stats.extraChoice || 0));
    UI.discChoice(opts, levels, (d) => {
      run.disc[d.id] = Math.min(d.max || 99, (run.disc[d.id] || 0) + levels);
      P.recompute(); SFX.play('levelup'); this.flash('#e8e0d0', 0.25);
      this.parts.burst(P.x, P.y - 20, 20, { type: 'glow', color: '#e8e0d0', min: 60, max: 240, size: 4 });
      this.finishBoon();
    });
  },
  deepen(n) {
    if (P.hero.godless) { const ids = Object.keys(this.run.disc); if (ids.length) { const id = pick(ids); this.run.disc[id] += n; P.recompute(); UI.toast(DISC_BY_ID[id].name + ' deepened!', '#e8e0d0'); } else this.offerDiscipline(n); return; }
    this.levelRandomBoons(1);
  },
  upgradeRarity() {
    if (P.hero.godless) { this.deepen(1); return; }
    const bs = this.run.boons.filter(b => b.r < 3 && !BOON_BY_ID[b.id].duo);
    if (!bs.length) { this.levelRandomBoons(1); return; }
    const b = pick(bs); b.r++; P.recompute(); UI.toast(`${BOON_BY_ID[b.id].name} became ${RARITY[b.r].name}!`, RARITY[b.r].color);
  },
  addBoon(def, r) {
    const run = this.run;
    if (def.slot !== 'passive') run.boons = run.boons.filter(b => BOON_BY_ID[b.id].slot !== def.slot);
    run.boons.push({ id: def.id, r, lv: 1 });
    P.recompute();
    SFX.play('pickup'); this.flash(KAMI[def.k].color, 0.25);
    this.parts.burst(P.x, P.y - 20, 24, { type: 'glow', color: KAMI[def.k].color, min: 60, max: 260, size: 4 });
  },
  levelRandomBoons(n) {
    if (P.hero.godless) { const ids = shuffle(Object.keys(this.run.disc)).slice(0, n); for (const id of ids) this.run.disc[id]++; if (ids.length) { P.recompute(); UI.toast('Disciplines deepened!', '#e8e0d0'); } return; }
    const bs = shuffle(this.run.boons.slice()).slice(0, n);
    for (const b of bs) b.lv++;
    if (bs.length) { P.recompute(); UI.toast(bs.map(b => BOON_BY_ID[b.id].name).join(', ') + ' leveled up!'); }
  },
  giveRelic(id, cursed) {
    const run = this.run;
    if (!id) {
      const pool = RELICS.filter(r => !run.relics.includes(r.id) && (!r.camp || run.camp) && (!cursed || r.camp));
      if (!pool.length) { this.addGold(150); return; }
      id = pick(pool).id;
    }
    const r = RELIC_BY_ID[id];
    run.relics.push(id);
    SAVE.data.relicsSeen[id] = true;
    P.recompute();
    if (r.onGain) r.onGain();
    UI.toast(`${r.icon} ${r.name} — ${r.desc}`, '#ffd56b');
    SFX.play('pickup');
  },

  /* ---------------- run flow ---------------- */
  startRun(camp = 0) {
    const S = SAVE.data, M = S.mirror;
    const heat = Object.assign({}, S.pact);
    this.run = {
      hero: S.hero, form: S.heroes[S.hero].form, act: 0, roomNum: 0, gold: 40 * (M.greed || 0), boons: [], relics: [], bonusHp: 0,
      heat, heatTotal: SAVE.heat(), rerolls: M.insight || 0, defy: M.wind || 0, crane: 0, shards: 0, keys: 0, kills: 0, time: 0,
      cleared: 0, lastShop: -9, trueFinal: S.fragments.length >= 8, dmgDealt: 0, damageTaken: 0, history: [],
      camp, feastHp: 0, disc: {}, bonusDmg: 0, patrons: [S.patron || 'fire'], bossFor: [], duelOffered: {}, duelDone: {},
    };
    this.run.before = UI.progressSnap(S); // the results screen lists what changed since now
    if (camp && !S.flags.c2intro) S.flags.c2intro = true;
    if (S.hero === 'sayo' && S.heroes.sayo.form === 1) this.run.patrons = [S.patron || 'fire', S.patron2 && S.patron2 !== S.patron ? S.patron2 : (S.patron === 'ice' ? 'fire' : 'ice')];
    for (let a = 0; a < this.acts().length; a++) {
      const B = this.acts()[a], base = B.boss, alt = B.altBoss;
      let id = base;
      if (alt && (S.bossKills[base] || 0) >= 1) {
        const altMet = S.bossMeets[alt] || 0;
        if ((!altMet && (S.bossKills[base] || 0) >= 2) || Math.random() < 0.5) id = alt;
      }
      this.run.bossFor[a] = id;
    }
    S.runs++;
    SAVE.save();
    P = new Player(S.hero, this.run.form);
    this.scene = 'run';
    if (M.dawn) {
      if (P.hero.godless) this.run.disc[pick(DISCIPLINES).id] = 1;
      else {
        const b = pick(BOONS.filter(b => !b.duo && b.slot !== 'passive' && (!P.hero.devotion || this.run.patrons.includes(b.k))));
        this.run.boons.push({ id: b.id, r: 0, lv: 1 });
      }
      P.recompute(); P.hp = P.stats.maxHp;
    }
    if (camp === 2) {
      const run = this.run;
      run.act = 3; run.godsDone = []; run.sparks = [];
      if (P.hero.godless) { for (const d of DISCIPLINES) run.disc[d.id] = d.max ? 1 : 2; }
      else run.boons = BOONS.filter(b => !b.duo && !b.capstone).map(b => ({ id: b.id, r: 0, lv: 1 }));
      P.recompute(); P.hp = P.stats.maxHp; this.updateOverload();
      this.transition(() => this.enterRoom({ type: 'pantheon', actStart: true }));
      return;
    }
    this.transition(() => this.enterRoom({ type: 'combat', reward: this.fixReward({ t: 'boon', k: pick(KAMI_ORDER) }), actStart: true }));
  },
  kamiHeld() {
    const run = this.run;
    if (P.hero.godless) return Math.round(7 * Object.keys(run.disc).length / DISCIPLINES.length);
    return KAMI_ORDER.filter(k => run.boons.some(b => BOON_BY_ID[b.id].k === k)).length;
  },
  updateOverload() {
    const run = this.run; if (!run || run.camp !== 2) return;
    run.overload = P.hero.godless ? 1 : OVERLOAD[this.kamiHeld()] || 1;
  },
  godScale() {
    const k = this.kamiHeld(), sparks = (this.run.sparks || []).length;
    return Math.pow(1 + (P.hero.godless ? 0.17 : 0.7) * k, 0.8) * (1 + 0.06 * sparks);
  },
  enterRoom(spec) {
    const run = this.run;
    if (spec.nextAct) { run.act++; run.roomNum = 0; }
    run.roomNum++;
    run.history.push(spec.type);
    this.clearWorld();
    this.makeRoom(spec);
    const R = this.room;
    P.x = R.x0 + R.w / 2; P.y = R.y0 + R.h - WALL - 60; P.aim = -Math.PI / 2; P.lookY = -1;
    P.trail = []; P.lv = 0; P.dashT = 0; P.iframes = 1.0;
    this.cam.x = P.x; this.cam.y = P.y - 200;
    P.phoenixUsed = false; P.shieldUp = P.stats.roomShield;
    if (P.stats.ultStart) P.ult = Math.max(P.ult, P.stats.ultStart);
    if (P.stats.roomHeal) P.heal(P.stats.roomHeal);
    this.controlLocked = false;
    const B = R.biome;
    const c2 = !!run.camp;
    if (run.camp === 2) Music.play(spec.type === 'final' ? 'calamity' : spec.type === 'god' ? 'godfight' : 'heaven');
    else Music.play(spec.type === 'boss' ? (B.bossMusic || (B.id === 'palace' ? 'final' : B.id === 'blacksun' ? 'sunfinal' : c2 ? 'boss2' : 'boss')) : spec.type === 'duel' ? 'boss' : B.music);
    if (P.stats.interest && run.gold > 0) { const g = Math.min(60, Math.floor(run.gold * P.stats.interest)); if (g > 0) this.after(0.8, () => { run.gold += g; this.text(P.x, P.y - 60, '+' + g + ' 金 interest', '#ffcf40', 14); }); }
    R.hazardT = 3;
    if (spec.type === 'shop' && P.stats.shopHeal) this.after(0.5, () => P.heal(P.stats.maxHp * 0.25));
    if (run.camp === 2 && spec.actStart) UI.banner('Wrath of the Gods', '神々の怒り — choose which god to free first', 'act');
    else if (spec.actStart || spec.nextAct) UI.banner(B.act + ' — ' + B.name, this.camp().bannerTag + B.jp, 'act');
    if (spec.type === 'combat' || spec.type === 'elite') {
      R.waves = this.genWaves(spec); R.wave = -1; R.waveDelay = 1.0;
    } else if (spec.type === 'boss' || spec.type === 'duel' || spec.type === 'god' || spec.type === 'final') {
      this.startBoss(spec);
    } else {
      this.placeStation(spec);
      this.after(0.6, () => this.openDoors());
    }
    if (SAVE.data.runs <= 1 && run.act === 0) {
      const tips = { 1: 'Red shapes on the ground are incoming attacks — step out, or dash (Space) through them.', 2: 'Hit enemies to charge your Ultimate (bottom right). Press Q when it glows.', 3: 'Door symbols show the reward waiting beyond. Kanji doors are Kami blessings.' };
      if (tips[run.roomNum]) this.after(1.6, () => UI.toast(tips[run.roomNum], '#ffd56b', 6));
    }
    if (run.camp === 3) this.tokoyoEnter(spec);
    SAVE.data.bestDepth = Math.max(SAVE.data.bestDepth, run.act * ROOMS_PER_ACT + run.roomNum);
    SAVE.save();
  },
  clearWorld() {
    this.hubFight = null; this.assistActor = null;
    this.enemies = []; this.projs = []; this.zones = []; this.pickups = []; this.obstacles = []; this.doors = []; this.npcs = [];
    this.ghosts = []; this.slashes = []; this.rings = []; this.lines = []; this.bolts = []; this.texts = []; this.timers = []; this.says = [];
    this.decals = []; this.stopHeld = [];
    this.parts.clear(); this.boss = null; UI.bossBar(null);
  },
  makeRoom(spec) {
    const B = spec.type === 'final' ? CALAMITY : this.acts()[this.run.act];
    const godly = spec.type === 'god' || spec.type === 'final';
    const big = spec.type === 'boss' || spec.type === 'duel';
    const w = godly ? 1600 : spec.type === 'pantheon' ? 1700 : big ? 1500 : (spec.type === 'combat' || spec.type === 'elite') ? randi(1250, 1450) : 1150;
    const h = godly ? 1080 : spec.type === 'pantheon' ? 900 : big ? 1000 : (spec.type === 'combat' || spec.type === 'elite') ? randi(840, 940) : 800;
    this.room = { x0: 0, y0: 0, w, h, biome: B, type: spec.type, spec, waves: [], wave: -1, cleared: false, rewardTaken: false, zoomMul: godly ? 0.8 : 1 };
    if (spec.type === 'combat' || spec.type === 'elite') {
      const n = randi(2, 5);
      for (let i = 0; i < n * 3 && this.obstacles.length < n; i++) {
        const o = { x: rand(160, w - 160), y: rand(WALL_TOP + 120, h - 180), r: rand(26, 44), kind: B.prop, seed: rand(0, 100) };
        if (Math.hypot(o.x - w / 2, o.y - h / 2) < 140) continue;
        if (Math.abs(o.x - w / 2) < 120 && o.y > h - 260) continue;
        if (this.obstacles.some(q => Math.hypot(q.x - o.x, q.y - o.y) < q.r + o.r + 90)) continue;
        this.obstacles.push(o);
      }
    }
    if (B.hazard === 'vents') { this.room.vents = []; for (let i = 0; i < 5; i++) this.room.vents.push({ x: rand(180, w - 180), y: rand(WALL_TOP + 140, h - 160) }); }
    this.room.floor = this.buildFloor(this.room);
  },
  genWaves(spec) {
    const run = this.run, B = this.acts()[run.act], elite = spec.type === 'elite';
    const depth = run.roomNum;
    let nW = 2 + (depth >= 4 ? 1 : 0) + (run.heat.waves || 0) + (elite ? 1 : 0) + (this.camp().extraWaves || 0);
    if (spec.actStart && run.act === 0) nW = 2;
    nW = Math.min(this.camp().extraWaves ? 5 : 4, nW);
    const pool = Object.entries(B.pool).map(([id, w]) => ({ id, w, def: ENEMIES[id] }));
    const eliteChance = 0.04 + run.act * 0.04 + 0.12 * (run.heat.elite || 0) + (this.camp().eliteBonus || 0);
    const waves = [];
    for (let i = 0; i < nW; i++) {
      let budget = 4 + depth * 0.65 + run.act * 1.4 + i * 1.2;
      if (spec.actStart && run.act === 0) budget = 3 + i;
      const wave = [];
      let guard = 0;
      while (budget > 0.4 && guard++ < 40) {
        const e = weighted(pool, p => p.w);
        const grp = e.def.group || 1;
        for (let g = 0; g < grp; g++) wave.push({ id: e.id, elite: !e.def.group && Math.random() < eliteChance });
        budget -= e.def.cost * grp;
      }
      if (elite && i === nW - 1) {
        const strong = pool.filter(p => !p.def.group).sort((a, b) => b.def.cost - a.def.cost).slice(0, 3);
        for (let k = 0; k < 1 + (run.act >= 2 ? 1 : 0); k++) wave.push({ id: pick(strong).id, elite: true });
      }
      waves.push(wave);
    }
    return waves;
  },
  qte(o) { this.qtes.push(Object.assign({ t: -(o.delay || 0), dur: 0.45, done: false }, o)); },
  qteBlocks(key) {
    return this.qtes.some(q => !q.done && q.t >= -0.05 && (q.keys === 'any' || q.keys === key));
  },
  updateQte(dt) {
    if (!this.qtes.length) return;
    const pa = Input.attackHit();
    const ps = Input.specialHit();
    let used = false;
    for (const q of this.qtes) {
      if (q.done) { q.fade = (q.fade || 0) + dt; continue; }
      q.t += dt;
      if (q.t < 0) continue;
      const press = !used && ((q.keys === 'attack' && pa) || (q.keys === 'special' && ps) || (q.keys === 'any' && (pa || ps)));
      const strict = P && P.stats.thunderDrum;
      const judge = (res) => {
        q.done = true; q.res = res; used = true;
        if (P) this.text(P.x, P.y - 80, res === 'perfect' ? 'PERFECT!' : res === 'good' ? 'GOOD' : 'MISS', res === 'perfect' ? '#ffcf40' : res === 'good' ? '#7ad7ff' : '#888888', res === 'perfect' ? 20 : 15);
        if (res === 'miss' && P) { P.groove = Math.max(0, (P.groove || 0) - 2); SFX.play('deny', 0.6); }
        q.onJudge(res);
      };
      if (press) {
        const diff = Math.abs(q.t - q.dur);
        if (diff <= 0.075) judge('perfect');
        else if (diff <= 0.16 && !strict) judge('good');
        else if (q.t > q.dur * 0.35) judge('miss');
      } else if (q.t > q.dur + 0.16) judge('miss');
    }
    this.qtes = this.qtes.filter(q => !q.done || q.fade < 0.3);
  },
  drawQte(ctx) {
    if (!P) return;
    for (const q of this.qtes) {
      if (q.t < 0) continue;
      const x = P.x, y = P.y - 22;
      if (q.done) {
        const k = 1 - (q.fade || 0) / 0.3;
        ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = q.res === 'perfect' ? '#ffcf40' : q.res === 'good' ? '#7ad7ff' : '#666'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(x, y, 30 + (q.fade || 0) * 120, 0, TAU); ctx.stroke(); ctx.restore();
        continue;
      }
      const k = clamp(q.t / q.dur, 0, 1.4), rr = lerp(110, 30, Math.min(1, k)) - Math.max(0, k - 1) * 30;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,207,64,.12)'; circ(ctx, x, y, 30);
      ctx.strokeStyle = Math.abs(q.t - q.dur) < 0.075 ? '#ffcf40' : '#ff5a3d'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, Math.max(4, rr), 0, TAU); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '900 13px "Zen Kaku Gothic New", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(q.keys === 'attack' ? 'ドン' : '祭', x, y);
      ctx.restore();
    }
  },
  updateHazard(dt) {
    const R = this.room, hz = R.biome.hazard;
    if (!hz || !this.run || !this.run.camp || this.enemies.filter(e => !e.dead).length === 0) return;
    R.hazardT -= dt;
    if (R.hazardT > 0) return;
    const dm = 10 * [1, 1.15, 1.3, 1.45][this.run.act] * this.camp().dmgMult;
    if (hz === 'hands') {
      R.hazardT = 5;
      G.addZone({ shape: 'circle', x: P.x, y: P.y, r: 70, warn: 1.0, dmg: dm, color: '#e0203a', kind: 'hands', onFire: z => G.parts.burst(z.x, z.y, 12, { color: '#2a1a2a', min: 60, max: 200, grav: -300, size: 4 }) });
    } else if (hz === 'tide') {
      R.hazardT = 9;
      UI.toast('The tide surges!', '#49f0ff', 1.5);
      const gap = rand(0.15, 0.85);
      for (let i = 0; i < 4; i++) {
        const y = R.y0 + WALL_TOP + 40 + i * (R.h - WALL_TOP - WALL - 40) / 3.4;
        for (const [a0, a1] of [[0, gap - 0.1], [gap + 0.1, 1]]) if (a1 - a0 > 0.03) G.addZone({ shape: 'line', x: R.x0 + a0 * R.w, y, ang: 0, len: (a1 - a0) * R.w, w: 50, warn: 1.0 + i * 0.3, dmg: dm, color: '#49f0ff' });
      }
    } else if (hz === 'vents') {
      R.hazardT = 3.6;
      for (const v of R.vents || []) G.addZone({ shape: 'circle', x: v.x, y: v.y, r: 78, warn: 0.9, dmg: dm, color: '#e8e0d0', onFire: z => G.parts.burst(z.x, z.y, 8, { type: 'smoke', color: '#eee', min: 40, max: 140, size: 8, grav: -250 }) });
    } else if (hz === 'flare') {
      R.hazardT = 7;
      const vert = Math.random() < 0.5;
      if (vert) G.addZone({ shape: 'line', x: clamp(P.x, R.x0 + 80, R.x0 + R.w - 80), y: R.y0, ang: Math.PI / 2, len: R.h, w: 90, warn: 1.2, dmg: dm * 1.3, color: '#ffcf40' });
      else G.addZone({ shape: 'line', x: R.x0, y: clamp(P.y, R.y0 + WALL_TOP + 40, R.y0 + R.h - 60), ang: 0, len: R.w, w: 90, warn: 1.2, dmg: dm * 1.3, color: '#ffcf40' });
    } else if (hz === 'hangsnow') {
      R.hazardT = 4.5;
      for (let i = 0; i < 3; i++) {
        const p = i ? this.clampToArena(P.x + rand(-240, 240), P.y + rand(-190, 190), 50) : P;
        G.addZone({ shape: 'circle', x: p.x, y: p.y, r: 62, warn: 1.1, dmg: dm, color: '#dcecff', onFire: z => G.parts.burst(z.x, z.y - 10, 12, { color: '#eef6ff', min: 60, max: 220, size: 3 }) });
      }
    }
  },
  updateRoom(dt) {
    const R = this.room;
    if (this.run && this.run.camp === 3) this.tokoyoTick(dt);
    this.updateAssist(dt);
    if (R && (R.type === 'combat' || R.type === 'elite' || R.type === 'boss') && !R.cleared) this.updateHazard(dt);
    if (!R || R.cleared || !(R.type === 'combat' || R.type === 'elite')) return;
    const alive = this.enemies.filter(e => !e.dead).length;
    if (alive === 0) {
      R.waveDelay -= dt;
      if (R.waveDelay <= 0) {
        R.wave++;
        if (R.wave >= R.waves.length) { this.roomClear(); return; }
        for (const sp of R.waves[R.wave]) {
          let x, y, tries = 0;
          do { x = rand(R.x0 + 120, R.x0 + R.w - 120); y = rand(R.y0 + WALL_TOP + 60, R.y0 + R.h - 120); tries++; }
          while ((Math.hypot(x - P.x, y - P.y) < 280 || this.blocked(x, y, 30)) && tries < 30);
          this.spawnEnemy(sp.id, x, y, { elite: sp.elite });
        }
        R.waveDelay = 0.8;
      }
    }
  },
  roomClear() {
    const R = this.room, run = this.run;
    R.cleared = true; run.cleared++;
    this.projs = this.projs.filter(p => p.team === 'p');
    this.zones = this.zones.filter(z => z.team === 'p');
    this.slow(0.35, 0.5);
    SFX.play('bell');
    UI.banner('CLEAR', pick(['清め', '勝利', '一閃', '斬']), 'clear');
    if (P.stats.clearHeal) P.heal(P.stats.clearHeal);
    if (P.stats.clearGold) this.addGold(P.stats.clearGold);
    this.addShards(randi(2, 4) + run.act, true);
    if (R.spec.reward) this.after(0.6, () => this.pickups.push({ kind: 'reward', reward: R.spec.reward, x: R.x0 + R.w / 2, y: R.y0 + R.h / 2, t: 0, elite: R.type === 'elite' }));
    else this.after(0.6, () => this.openDoors());
    if (R.type === 'elite' && Math.random() < 0.5) this.after(0.8, () => this.giveRelic());
  },
  collectReward(rw) {
    const run = this.run, elite = this.room.type === 'elite';
    const done = () => { this.room.rewardTaken = true; this.openDoors(); };
    SFX.play('pickup');
    switch (rw.t) {
      case 'boon': this.offerBoonsThen(rw.k, done, elite ? { minRarity: 1 } : {}); return;
      case 'sake': UI.sake(elite ? 2 : 1, done); return;
      case 'gold': this.addGold(Math.round((60 + run.act * 40) * (elite ? 1.6 : 1) * rand(0.85, 1.15))); break;
      case 'heart': run.bonusHp += elite ? 35 : 25; P.recompute(); P.heal(elite ? 35 : 25); UI.toast('Heart of the Mountain — Max HP up!', '#ff5577'); break;
      case 'shards': { const v = this.addShards(Math.round((18 + run.act * 10) * (elite ? 1.6 : 1))); UI.toast(`Gathered ${v} Spirit Shards`, '#6ee7ff'); break; }
      case 'key': this.addKeys(1); break;
      case 'relic': this.giveRelic(); break;
      case 'disc': UI.onBoonDone = done; this.offerDiscipline(rw.x2 || elite ? 2 : 1); return;
    }
    done();
  },
  offerBoonsThen(k, done, o) {
    UI.onBoonDone = done;
    this.offerBoons(k, o);
  },
  placeStation(spec) {
    const R = this.room, cx = R.x0 + R.w / 2, cy = R.y0 + R.h / 2 - 40;
    if (spec.type === 'pantheon') {
      this.npcs.push({ id: 'altar7', x: cx, y: cy + 60, r: 60, name: 'Altar of the Seven', prompt: 'Look', draw: drawSevenAltar,
        interact: () => { const left = KAMI_ORDER.filter(k => !this.run.godsDone.includes(k)); UI.toast(left.length ? `Still corrupted: ${left.map(k => KAMI[k].name).join(', ')}` : 'All seven are free. The floor of heaven has split open.', '#ffcf40', 4); } });
      if (this.run.godsDone.length === KAMI_ORDER.length && !this.run.allFreedSaid) { this.run.allFreedSaid = true; this.after(0.8, () => UI.dialogue(STORY3.allFreed)); }
      return;
    }
    if (this.run.camp === 3) { this.tokoyoStation(spec); return; }
    if (this.run.camp) {
      if (spec.type === 'shop') {
        this.npcs.push({ id: 'ferry', x: cx, y: cy, r: 60, name: 'Sanzu\'s Ferry Market', prompt: 'Trade', draw: drawFerry, interact: () => UI.shop(true) });
        this.genShop(); this.room.shop.forEach(it => { if (FERRY_NAMES[it.id]) Object.assign(it, FERRY_NAMES[it.id]); });
        this.after(0.4, () => UI.toast(pick(['"Coins, memories or blood. I take all three."', '"The river does not haggle."', '"Buy quickly. The current is impatient."']), '#9ee7ff'));
        return;
      }
      if (spec.type === 'spring') {
        this.npcs.push({ id: 'boat', x: cx, y: cy, r: 80, name: 'Lantern Boat', prompt: 'Rest', draw: drawLanternBoat, used: false,
          interact: (n) => { if (n.used) { UI.toast('The lantern has burned out.'); return; } n.used = true; P.heal(P.stats.maxHp * 0.35); this.flash('#ffcf40', 0.3); UI.toast('You rest in the lantern\'s glow. Healed 35%.', '#ffcf40'); } });
        return;
      }
      if (spec.type === 'event') {
        const ev = pick(EVENTS2);
        this.npcs.push({ id: 'event', x: cx, y: cy, r: 50, name: ev.title, prompt: 'Investigate', draw: drawYomiShrine, used: false, ev,
          interact: (n) => { if (n.used) { UI.toast('Nothing more here.'); return; } UI.event(ev, () => { n.used = true; }); } });
        return;
      }
    }
    if (spec.type === 'shop') {
      this.npcs.push({ id: 'udon', x: cx, y: cy, r: 50, name: 'Old Man Udon\'s Ramen Cart', prompt: 'Shop', draw: drawRamenCart,
        interact: () => { UI.shop(); } });
      this.genShop();
      this.after(0.4, () => UI.toast(pick(SHOP_LINES), '#ffd56b'));
    } else if (spec.type === 'spring') {
      this.npcs.push({ id: 'onsen', x: cx, y: cy, r: 80, name: 'Moonlit Hot Spring', prompt: 'Bathe', draw: drawOnsen, used: false,
        interact: (n) => { if (n.used) { UI.toast('The water has gone cold.'); return; } n.used = true; P.heal(P.stats.maxHp * 0.5); this.flash('#9ee7ff', 0.3); UI.toast('You soak in the moonlit spring. Healed 50%.', '#7dffb0'); } });
    } else if (spec.type === 'event') {
      const ev = pick(EVENTS);
      this.npcs.push({ id: 'event', x: cx, y: cy, r: 50, name: ev.title, prompt: 'Investigate', draw: drawShrine, used: false, ev,
        interact: (n) => { if (n.used) { UI.toast('Nothing more here.'); return; } UI.event(ev, () => { n.used = true; }); } });
    }
  },
  genShop() {
    const run = this.run, pm = (1 + 0.3 * (run.heat.price || 0)) * (1 + 0.15 * run.act);
    const k = P.hero.devotion ? pick(run.patrons) : pick(KAMI_ORDER), relic = pick(RELICS.filter(r => !run.relics.includes(r.id) && (!r.camp || run.camp))) || null;
    const items = [
      { id: 'ramen', name: 'Tonkotsu Ramen', icon: '🍜', desc: 'Heal 40% HP.', price: 50, fn: () => P.heal(P.stats.maxHp * 0.4) },
      { id: 'sake', name: 'Spirit Sake', icon: '🍶', desc: 'Level up one of your boons.', price: 95, fn: () => UI.sake(1, () => UI.shop()), cond: () => run.boons.length > 0, chain: true },
      { id: 'boon', name: KAMI[k].name + '\'s Offering', icon: KAMI[k].glyph, color: KAMI[k].color, desc: `Receive a blessing from ${KAMI[k].name}.`, price: 140, fn: () => { UI.onBoonDone = () => UI.shop(); this.offerBoons(k); }, chain: true },
      { id: 'onigiri', name: 'Iron Onigiri', icon: '🍙', desc: '+15 Max HP.', price: 85, fn: () => { run.bonusHp += 15; P.recompute(); P.heal(15); } },
      { id: 'charm', name: 'Reroll Charm', icon: '🎲', desc: '+1 boon reroll.', price: 55, fn: () => { run.rerolls++; } },
    ];
    if (relic) items.splice(3, 0, { id: 'relic', name: relic.name, icon: relic.icon, desc: relic.desc, price: 165, fn: () => this.giveRelic(relic.id) });
    if (P.hero.godless) {
      items.splice(1, 2,
        { id: 'scroll', name: 'Discipline Scroll', icon: '修', desc: 'Train a new Discipline (or deepen one).', price: 130, fn: () => { UI.onBoonDone = () => UI.shop(); this.offerDiscipline(1); }, chain: true },
        { id: 'lesson', name: 'Master\'s Lesson', icon: '道', desc: 'Deepen a random Discipline you know by one level.', price: 90, cond: () => Object.keys(run.disc).length > 0, fn: () => this.deepen(1) });
    }
    if (Math.random() < 0.3) items.push({ id: 'key', name: 'Tarnished Moon Key', icon: '🗝', desc: 'A Moon Key someone dropped in the broth. +1 Key.', price: 220, fn: () => this.addKeys(1) });
    for (const it of items) it.price = Math.round(it.price * pm * (1 - (P.stats.discount || 0)));
    this.room.shop = items;
  },
  genDoors() {
    const run = this.run, next = run.roomNum + 1;
    if (run.camp === 2) {
      if (this.room.type === 'final') return [];
      if (this.room.type === 'god') return [{ type: 'pantheon', label: 'Return to the Pantheon' }];
      const left = KAMI_ORDER.filter(k => !run.godsDone.includes(k));
      if (!left.length) return [{ type: 'final', boss: 'omaga' }];
      return left.map(k => ({ type: 'god', boss: 'god_' + k, kami: k }));
    }
    if (this.room.type === 'boss') {
      if (run.act >= this.acts().length - 1) return [];
      return [{ type: 'combat', reward: { t: 'boon', k: pick(KAMI_ORDER) }, nextAct: true, label: 'Ascend to ' + this.acts()[run.act + 1].act }];
    }
    if (next === ROOMS_PER_ACT - 1) return [{ type: 'shop' }, { type: 'spring' }];
    if (next === ROOMS_PER_ACT) return [{ type: 'boss' }];
    const n = Math.random() < 0.4 ? 3 : 2;
    const out = [], usedK = new Set();
    for (let i = 0; i < n; i++) {
      let spec;
      const r = Math.random();
      const canShop = run.roomNum - run.lastShop >= 3 && !out.some(d => d.type === 'shop');
      if (r < 0.08 && canShop) spec = { type: 'shop' };
      else if (r < 0.18 && !out.some(d => d.type === 'event')) spec = { type: 'event' };
      else if (r < 0.21 && !out.some(d => d.type === 'spring') && P.hp < P.stats.maxHp * 0.7) spec = { type: 'spring' };
      else {
        const elite = Math.random() < 0.14 + run.act * 0.04 && next > 2;
        const rw = weighted([
          { t: 'boon', w: 46 }, { t: 'sake', w: run.boons.length ? 16 : 0 }, { t: 'gold', w: 10 }, { t: 'heart', w: 9 },
          { t: 'shards', w: 10 }, { t: 'key', w: run.act >= 1 ? 3 : 1 }, { t: 'relic', w: 5 }], x => x.w).t;
        const reward = { t: rw };
        if (rw === 'boon') { let k; let g = 0; do { k = pick(KAMI_ORDER); } while (usedK.has(k) && g++ < 10); usedK.add(k); reward.k = k; }
        spec = { type: elite ? 'elite' : 'combat', reward };
      }
      out.push(spec);
    }
    const B = this.acts()[run.act];
    if (B.duel && !run.duelOffered[run.act] && next >= 3 && next <= 6) {
      const beaten = (SAVE.data.bossKills[B.duel] || 0) >= 1;
      if (Math.random() < (beaten ? 0.18 : 0.4) || (!beaten && next === 6)) {
        run.duelOffered[run.act] = true;
        out[out.length - 1] = { type: 'duel', boss: B.duel };
      }
    }
    return out;
  },
  openDoors() {
    if (this.doors.length) return;
    const R = this.room, specs = this.genDoors();
    if (!specs.length) return;
    const n = specs.length, gap = Math.min(300, (R.w - 300) / n);
    specs.forEach((s, i) => {
      if (s.reward) s.reward = this.fixReward(s.reward);
      this.doors.push({ x: R.x0 + R.w / 2 + (i - (n - 1) / 2) * gap, y: R.y0 + WALL_TOP - 10, spec: s, t: 0, open: true });
    });
    SFX.play('door');
  },
  enterDoor(d) {
    if (this.leaving) return;
    this.leaving = true;
    if (d.spec.type === 'shop') this.run.lastShop = this.run.roomNum + 1;
    SFX.play('door');
    this.transition(() => { this.leaving = false; this.enterRoom(d.spec); });
  },

  /* ---------------- bosses ---------------- */
  startBoss(spec) {
    const R = this.room, B = R.biome, S = SAVE.data;
    const id = spec.boss || this.run.bossFor[this.run.act] || B.boss;
    this.controlLocked = true;
    const meets = S.bossMeets[id] || 0;
    const heat = this.run.heat;
    const spawn = (bid) => {
      const boss = this.spawnEnemy(bid, R.x0 + R.w / 2, R.y0 + R.h * 0.38, { hpMult: (1 + 0.2 * (heat.boss || 0)) * (1 + 0.08 * (heat.hp || 0)) * (this.run.camp === 2 ? this.godScale() : 1), dmgMult: [1, 1.15, 1.3, 1.45][this.run.act] * (1 + 0.2 * (heat.dmg || 0)), speedMul: 1 - 0.15 * (heat.boss || 0), noSpawn: true });
      this.boss = boss; UI.bossBar(boss);
      return boss;
    };
    const boss = spawn(id);
    boss.intro = 99;
    const hero = this.run.hero;
    let lines;
    if (id === 'shirahime' && hero === 'yuki') lines = BOSS_TALK.shirahime_yuki;
    else if (id === 'mugen' && hero === 'kaito' && !S.fragments.includes('kaito_oath')) lines = BOSS_TALK.mugen_kaito;
    else { const arr = BOSS_TALK[id]; lines = arr[Math.min(meets, arr.length - 1)]; }
    S.bossMeets[id] = meets + 1;
    SFX.play('roar');
    if (id === 'okina') this.okinaIntro(meets);
    this.after(0.8, () => UI.dialogue(lines, () => {
      if (id === 'okina') { this.dismissAllies(); this.camTarget = null; }
      boss.intro = 0.4; this.controlLocked = false;
      UI.banner(BOSSES[id].duel ? 'DUEL — ' + BOSSES[id].name : BOSSES[id].name, BOSSES[id].jp + ' — ' + BOSSES[id].title, 'boss');
    }));
  },
  bossPhase(e) {
    e.invulnT = 1.2;
    this.shake(14); this.flash('#ffffff', 0.4); SFX.play('roar');
    this.fxRing(e.x, e.y, 400, e.def.col || '#fff', 0.6, 14);
    if (P && Math.hypot(P.x - e.x, P.y - e.y) < 260) { const a = angTo(e, P); this.moveSafe(P, Math.cos(a) * 120, Math.sin(a) * 120); }
    const lines = {
      gekkou: ['My blade remembers... even if I do not!', 'Enough! Witness the plum dojo\'s final form!'],
      mecha: ['WARNING. DAMAGE CRITICAL. ENGAGING FURY.EXE', 'PONTA... I AM SORRY... MAXIMUM OUTPUT.'],
      shirahime: ['The snow thickens. Can you breathe, little flame?', 'Then freeze with me. Forever.'],
      mugen: ['Do you see? I wield every one of them.', 'The eclipse is coming, Moonbound. It always comes.'],
      thousandth: ['A thousand deaths, compressed into one blade!'],
      tamamo: ['You\'re ruining my hair! Unforgivable!', 'Fine! FINE! All nine tails, then!'],
      bakusou: ['SECOND GEAR, BABY!', 'NO BRAKES! NO BRAKES!!'],
      shiro: ['Now we\'re talking!', 'Let me show you what a REAL reaper looks like.'],
      tetsu: ['Better. Again.', 'No god ever pushed me this far.'],
      daigo: ['GAHAHA! NOW IT IS A FIGHT!', 'THE GATE DOES NOT FALL!'],
      duel_sekka: ['You picked the wrong clock to break.', 'I have held one second longer than you have been alive.'],
      duel_kuroto: ['Better. Now try it without the gods.', 'Nothing given. Everything taken.'],
      okina: ['Everyone is here. Everyone is here. No one has gone home.', 'Stay. Stay for the last dance. It is always the last dance. Stay —'],
    }[e.id] || [];
    if (lines[e.phase - 1]) this.say(e, lines[e.phase - 1], 3);
    this.projs = this.projs.filter(p => p.team === 'p');
    UI.banner('PHASE ' + (e.phase + 1), '', 'phase');
  },
  bossDefeated(e) {
    const S = SAVE.data, run = this.run, id = e.id;
    UI.bossBar(null);
    this.controlLocked = true;
    this.projs = []; this.zones = [];
    for (const o of this.enemies) if (!o.dead && o !== e) { o.dead = true; this.parts.burst(o.x, o.y - 20, 10, { color: '#fff' }); }
    this.slow(0.2, 1.4); this.flash('#ffffff', 0.9); this.shake(20);
    SFX.play('boom'); SFX.play('bell');
    this.parts.burst(e.x, e.y - 30, 80, { type: 'petal', color: '#ffd1dc', min: 60, max: 420, life: 2, size: 4, drag: 1 });
    if (id === 'thousandth') { this.after(0.6, () => this.trueVictory()); return; }
    if (id === 'okina') this.okinaFalls(e);
    if (run.camp && SEALS.some(x => x.id === id) && !(S.seals || []).includes(id)) { S.seals = S.seals || []; S.seals.push(id); this.after(2.5, () => UI.toast(`☀ BLACK SUN SEAL — ${SEALS.find(x => x.id === id).name} (${S.seals.length}/4)`, '#ffcf40', 5)); }
    S.bossKills[id] = (S.bossKills[id] || 0) + 1;
    const kills = S.bossKills[id];
    run.bossesBeaten = (run.bossesBeaten || 0) + 1;
    if (run.camp === 2) { this.after(1.0, () => (id === 'omaga' ? this.calamityDefeated() : this.godFreed(e))); return; }
    const lines = [];
    let frag = null;
    if (id === 'gekkou') { const arr = BOSS_TALK.gekkou_defeat; lines.push(...arr[Math.min(kills - 1, arr.length - 1)]); if (kills >= 5) frag = 'gekkou_memory'; }
    else if (id === 'shirahime' && run.hero === 'yuki') { lines.push(...BOSS_TALK.shirahime_yuki_defeat); frag = 'snow_peace'; }
    else if (id === 'mugen' && run.hero === 'kaito' && !S.fragments.includes('kaito_oath')) { lines.push(...BOSS_TALK.mugen_kaito_defeat); frag = 'kaito_oath'; }
    else if (id === 'mecha') lines.push(['mecha', pick(['SYSTEM... SHUTDOWN... PONTA...', 'RICE... DELIVERED... BEEP.', 'ERROR 404: WILL TO FIGHT NOT FOUND.'])]);
    else if (id === 'shirahime') lines.push(['shirahime', pick(['The snow... is warm...?', 'Why... does that bow... look familiar...', 'Spring... again...'])]);
    else if (id === 'mugen') lines.push(['mugen', pick(['Again. And again. And again.', 'You cannot kill what is already hollow.', 'See you next loop, Moonbound.'])]);
    else if (BOSS_TALK[id + '_defeat']) { const arr = BOSS_TALK[id + '_defeat']; lines.push(...arr[Math.min(kills - 1, arr.length - 1)]); }
    for (const [h, u] of Object.entries(HERO_UNLOCK)) if (u.req && !S.heroes[h].unlocked && u.req(S) && !S.flags['recruit_' + h]) { S.flags['recruit_' + h] = 1; this.after(1.5, () => UI.toast(`${HEROES[h].name} can now be recruited at Ponta's Forge!`, HEROES[h].pal.scarf, 6)); }
    if (frag && S.fragments.includes(frag)) { if (lines.length && lines[lines.length - 1][0] === 'narrator') lines.pop(); frag = null; }
    this.after(1.0, () => {
      const finish = () => {
        if (frag) this.awardFragment(frag);
        if (id === 'mugen') { this.mugenDefeated(); return; }
        if (id === 'kurohi') { this.sunDefeated(); return; }
        if (id === 'okina') { this.okinaDefeated(); return; }
        this.addKeys(run.camp ? 2 : 1);
        if (BOSSES[id].duel) { run.duelDone[run.act] = true; this.giveRelic(); }
        const v = this.addShards(35 + run.act * 20);
        P.heal(P.stats.maxHp * 0.3);
        UI.toast(`Boss defeated! +1 Moon Key, +${v} Spirit Shards`, '#ffd56b');
        this.controlLocked = false;
        this.after(0.6, () => this.openDoors());
        SAVE.save();
      };
      if (lines.length) UI.dialogue(lines, finish); else finish();
    });
  },
  mugenDefeated() {
    const S = SAVE.data, run = this.run;
    // fragment checks
    const award = [];
    if (!S.fragments.includes('first_clear')) award.push('first_clear');
    if (run.heatTotal >= 5) award.push('heat5');
    if (run.heatTotal >= 10) award.push('heat10');
    S.clearsByHero[run.hero] = (S.clearsByHero[run.hero] || 0) + 1;
    if (HERO_ORDER.filter(h => S.clearsByHero[h]).length >= 4) award.push('all_heroes');
    for (const f of award) this.awardFragment(f);
    this.addKeys(1); this.addShards(120);
    if (run.trueFinal) {
      UI.dialogue(BOSS_TALK.mugen_true, () => {
        const R = this.room;
        const b = this.spawnEnemy('thousandth', R.x0 + R.w / 2, R.y0 + R.h * 0.35, { hpMult: 1 + 0.15 * (run.heat.boss || 0), dmgMult: 1.45 * (1 + 0.2 * (run.heat.dmg || 0)), noSpawn: true });
        this.boss = b; UI.bossBar(b); b.intro = 99;
        Music.cur = null; Music.play('final');
        UI.dialogue(BOSS_TALK.thousandth[0], () => { b.intro = 0.5; this.controlLocked = false; UI.banner('THE THOUSANDTH AKANE', '千度目の茜', 'boss'); });
      });
      return;
    }
    const first = !S.flags.firstClear;
    S.flags.firstClear = true;
    const end = () => this.endRun(true);
    if (first) UI.dialogue(STORY.firstClear, end);
    else this.after(0.5, end);
  },
  godFreed(e) {
    const S = SAVE.data, run = this.run, k = e.def.kami, hero = e.def.hero;
    run.godsDone.push(k); run.sparks.push(k);
    if (P.hero.godless) { const ids = shuffle(Object.keys(run.disc)).slice(0, 2); for (const id of ids) delete run.disc[id]; }
    else run.boons = run.boons.filter(b => { const d = BOON_BY_ID[b.id]; return d.k !== k && d.k2 !== k; });
    P.recompute(); P.hp = P.stats.maxHp; P.ult = Math.max(P.ult, 50); this.updateOverload();
    const newHero = !S.heroes[hero].unlocked;
    if (newHero) { S.heroes[hero].unlocked = true; S.heroes[hero].forms = [0]; }
    this.addKeys(1); this.addShards(60);
    SAVE.save();
    UI.dialogue(STORY3.freed[k], () => {
      UI.toast(`${KAMI[k].glyph} ${GODSPARKS[k].name} — ${GODSPARKS[k].desc}`, KAMI[k].color, 5);
      UI.toast(P.hero.godless ? 'Two Disciplines fade with the god\'s release.' : `All of ${KAMI[k].name}'s blessings return to them.`, '#cccccc', 5);
      if (newHero) this.after(0.6, () => UI.toast(`★ ${HEROES[hero].name} is now playable! (Altar of Heroes)`, KAMI[k].color, 6));
      this.controlLocked = false;
      this.after(0.6, () => this.openDoors());
    });
  },
  calamityDefeated() {
    const S = SAVE.data, run = this.run;
    S.flags.arcEnd = true; S.clears3 = (S.clears3 || 0) + 1;
    S.clearsByHero[run.hero] = (S.clearsByHero[run.hero] || 0) + 1;
    this.addKeys(3); this.addShards(300); SAVE.save();
    Music.play('victory');
    UI.dialogue(STORY3.omagaDefeat, () => this.endRun(true));
  },
  sunDefeated() {
    const S = SAVE.data, run = this.run;
    S.clears2 = (S.clears2 || 0) + 1;
    S.clearsByHero[run.hero] = (S.clearsByHero[run.hero] || 0) + 1;
    this.addKeys(2); this.addShards(150);
    const first = !S.flags.sunEnd;
    S.flags.sunEnd = true; SAVE.save();
    Music.play('victory');
    const end = () => this.endRun(true);
    if (first) UI.dialogue(STORY2.ending, end); else this.after(0.5, end);
  },
  trueVictory() {
    const S = SAVE.data;
    S.flags.trueEnd = true;
    S.bossKills.thousandth = (S.bossKills.thousandth || 0) + 1;
    Music.play('victory');
    UI.dialogue(STORY.trueEnding, () => this.endRun(true, true));
  },
  awardFragment(id) {
    const S = SAVE.data;
    if (S.fragments.includes(id)) return;
    S.fragments.push(id);
    const f = FRAGMENTS.find(x => x.id === id);
    UI.toast(`🌕 MOON FRAGMENT — ${f.name} (${S.fragments.length}/8)`, '#fff3b0', 5);
    SFX.play('levelup');
    SAVE.save();
  },
  endRun(victory, trueEnd) {
    const S = SAVE.data, run = this.run;
    if (victory) { S.clears++; S.bestHeat = Math.max(S.bestHeat, run.heatTotal); }
    else S.deaths++;
    SAVE.save();
    const summary = {
      victory, trueEnd, camp: run.camp || 0, hero: run.hero, act: run.act, room: run.roomNum, kills: run.kills, time: run.time, shards: run.shards, keys: run.keys,
      boons: run.boons.slice(), relics: run.relics.slice(), disc: Object.assign({}, run.disc), heat: run.heatTotal, dmg: Math.round(run.dmgDealt), gold: run.gold,
      before: run.before,
    };
    Music.stop();
    this.after(victory ? 0.1 : 0.9, () => {
      UI.results(summary, () => this.transition(() => this.toHub(victory ? (run.camp === 2 ? 'arcend' : 'victory') : 'death')));
    });
  },

  /* ---------------- hub ---------------- */
  makeHubRoom() {
    const broken = SAVE.data && SAVE.data.flags.cs1;
    this.hubBreak = broken ? (SAVE.data.flags.t_rescue ? 0.8 : 1) : 0; this.riftOpen = broken ? 1 : 0; this.riftOpening = false;
    this.room = { x0: 0, y0: 0, w: 1400, h: 960, biome: broken
      ? { id: 'hub', name: 'Shattered Shrine', floor: '#16141c', floor2: '#1c1924', line: '#2a2236', wall: '#050408', accent: '#9a6aff', amb: 'void', prop: 'none', tint: 'rgba(70,30,120,0.12)' }
      : { id: 'hub', name: 'Shrine of Lanterns', floor: '#1c1a26', floor2: '#24212f', line: '#2f2a3e', wall: '#0b0a10', accent: '#ffb04d', amb: 'petal', prop: 'none' }, type: 'hub', hub: true };
    this.room.floor = this.buildFloor(this.room);
  },
  toHub(reason) {
    const S = SAVE.data;
    this.scene = 'hub'; this.run = null;
    this.clearWorld();
    this.makeHubRoom();
    this.controlLocked = false;
    P = new Player(S.hero, S.heroes[S.hero].form);
    P.x = 700; P.y = 640; P.aim = -Math.PI / 2;
    this.cam.x = P.x; this.cam.y = P.y;
    this.buildHubNpcs();
    Music.play(S.flags.cs1 ? 'ruin' : 'hub');
    UI.showHud(true);
    if (S.flags.arcEnd && !S.flags.cs1) { this.after(0.8, () => this.cutsceneBreak()); return; }
    if (S.flags.cs1 && !S.flags.cs2) { this.after(0.8, () => this.cutsceneNewcomers()); return; }
    if (this.tokoyoHubScene()) return;
    if (!S.flags.prologue) { S.flags.prologue = true; SAVE.save(); this.after(0.5, () => UI.dialogue(STORY.prologue, () => UI.toast(UI.controlsLine(), '#fff', 8))); }
    else if (reason === 'death' && !S.flags.firstDeath) { S.flags.firstDeath = true; SAVE.save(); this.after(0.5, () => UI.dialogue(STORY.firstDeath)); }
  },
  heavenGateNpc() {
    const S = SAVE.data;
    return { id: 'heaven', x: 1215, y: 115, r: 60, name: 'Stair of Heaven', prompt: 'Wrath of the Gods', draw: drawHeavenGate, interact: () => {
      const ok = S.fragments.length >= 8 && (S.seals || []).length >= 4;
      if (!ok) { UI.toast(`Sealed. Needs all 8 Moon Fragments (${S.fragments.length}/8) and all 4 Black Sun Seals (${(S.seals || []).length}/4).`, '#ffcf40', 5); return; }
      if (!S.flags.c3intro && !S.flags.cs1) { S.flags.c3intro = true; SAVE.save(); UI.dialogue(STORY3.intro, () => UI.confirmRun(2)); } else UI.confirmRun(2);
    } };
  },
  buildHubNpcs() {
    const S = SAVE.data, N = this.npcs;
    N.length = 0;
    N.push({ id: 'gate', x: 700, y: 120, r: 70, name: 'Torii of Ascent', prompt: 'Begin the Ascent', draw: drawTorii, interact: () => UI.confirmRun() });
    if (S.flags.cs1) {
      if (S.fragments.includes('first_clear')) N.push({ id: 'yomigate', x: 330, y: 120, r: 60, name: 'Black Torii of Yomi', prompt: 'Campaign II', draw: drawYomiTorii, interact: () => UI.confirmRun(1) });
      N.push(this.heavenGateNpc());
      N.push({ id: 'pact', x: 980, y: 190, r: 40, name: 'Moon Phase Stone', prompt: 'Moon Phase Pact', draw: drawPactStone, interact: () => UI.pact() });
      N.push({ id: 'altar', x: 700, y: 400, r: 44, name: 'Altar of Heroes', prompt: 'Change Hero', draw: drawAltar, interact: () => UI.altar() });
      N.push({ id: 'mirrorobj', x: 1020, y: 380, r: 34, name: 'Guttering Lanterns', prompt: 'Lantern Mirror', draw: drawLanternsOnly, interact: () => UI.mirror() });
      if (S.flags.t_rescue) N.push(this.pontaNpc());
      else N.push({ id: 'anvilobj', x: 330, y: 660, r: 34, name: 'Ponta\'s Abandoned Forge', prompt: 'Forge', draw: drawAnvilOnly, interact: () => UI.forge() });
      N.push({ id: 'ribbon', x: 400, y: 320, r: 28, name: 'Hanabi\'s Ribbon', prompt: 'Codex', draw: drawRibbon, interact: () => UI.codex() });
      N.push(this.riftNpc());
      if (S.flags.cs2) for (const [id, x] of [['sekka', 905], ['kuroto', 1095]]) if (S.hero !== id) N.push({ id, x, y: 660, r: 28, name: HEROES[id].name, prompt: 'Talk', cast: id, draw: drawNpcChar, interact: () => (S.flags.newcomer === id || S.flags.t_rescue ? this.talk(id) : UI.dialogue([[id, id === 'sekka' ? 'I am keeping the rift\'s clock. It ticks... irregularly. Go on, Moonbound.' : 'I\'m watching the hole. Go fight something.']])) });
      const dm = new Enemy('dummy', 1240, 780, { noSpawn: true }); this.enemies.push(dm);
      return;
    }
    if (S.fragments.includes('first_clear')) {
      N.push({ id: 'yomigate', x: 330, y: 120, r: 60, name: 'Black Torii of Yomi', prompt: 'Campaign II', draw: drawYomiTorii, interact: () => { if (!S.flags.c2intro) { S.flags.c2intro = true; SAVE.save(); UI.dialogue(STORY2.intro, () => UI.confirmRun(1)); } else UI.confirmRun(1); } });
      N.push({ id: 'sanzu', x: 470, y: 190, r: 30, name: 'Sanzu the Ferryman', prompt: 'Talk', cast: 'sanzu', draw: drawNpcChar, interact: () => this.talk('sanzu') });
    }
    if (S.fragments.includes('first_clear')) N.push(this.heavenGateNpc());
    N.push({ id: 'pact', x: 980, y: 190, r: 40, name: 'Moon Phase Stone', prompt: 'Moon Phase Pact', draw: drawPactStone, interact: () => UI.pact() });
    N.push({ id: 'hanabi', x: 400, y: 320, r: 30, name: 'Hanabi', prompt: 'Talk', cast: 'hanabi', draw: drawNpcChar, interact: () => UI.menu('Hanabi', 'Fox spirit, shrine keeper, professional napper.', [{ label: '💬 Talk', fn: () => this.talk('hanabi') }, { label: '📜 Codex & Moon Fragments', fn: () => UI.codex() }]) });
    N.push({ id: 'tama', x: 1020, y: 380, r: 30, name: 'Obaa Tama', prompt: 'Lantern Mirror', cast: 'tama', draw: drawNpcChar, extra: drawLanterns, interact: () => UI.menu('Obaa Tama', 'Keeper of the Lantern Mirror.', [{ label: '🏮 Lantern Mirror', fn: () => UI.mirror() }, { label: '💬 Talk', fn: () => this.talk('tama') }]) });
    N.push({ id: 'ponta', x: 330, y: 660, r: 30, name: 'Ponta', prompt: 'Forge', cast: 'ponta', draw: drawNpcChar, extra: drawAnvil, interact: () => UI.menu('Ponta', 'Tanuki blacksmith. Do not drink the tea.', [{ label: '⚒ Forge (Heroes & Forms)', fn: () => UI.forge() }, { label: '💬 Talk', fn: () => this.talk('ponta') }]) });
    N.push({ id: 'altar', x: 700, y: 400, r: 44, name: 'Altar of Heroes', prompt: 'Change Hero', draw: drawAltar, interact: () => UI.altar() });
    const dummy = new Enemy('dummy', 1110, 700, { noSpawn: true });
    this.enemies.push(dummy);
    const spots = { rei: [540, 800], yuki: [880, 810], kaito: [1180, 500], sayo: [250, 450], tetsu: [1250, 330], sora: [1020, 890], daigo: [420, 900], isamu: [1260, 620], hibiki: [160, 600], rinne: [760, 700] };
    for (const h of ['rei', 'yuki', 'kaito', 'sayo', 'tetsu', 'sora', 'daigo', 'isamu', 'hibiki', 'rinne']) {
      if (S.heroes[h].unlocked && S.hero !== h) N.push({ id: h, x: spots[h][0], y: spots[h][1], r: 28, name: HEROES[h].name, prompt: 'Talk', cast: h, draw: drawNpcChar, interact: () => this.talk(h) });
    }
    if (S.hero !== 'akane') N.push({ id: 'akane', x: 600, y: 520, r: 28, name: 'Akane', prompt: 'Talk', cast: 'akane', draw: drawNpcChar, interact: () => UI.dialogue([['akane', pick(['Go on. I\'ll keep the shrine warm.', 'Watch out for Gekkou\'s third dash. It always comes.', 'If you see Hanabi\'s fried tofu, do NOT eat it. It\'s a trap.'])]]) });
  },
  updateHub(dt) {
    for (const n of this.npcs) {
      if (n.dissolve) { n.alpha = (n.alpha === undefined ? 1 : n.alpha) - dt * 0.6; if (Math.random() < 0.6) this.parts.add({ x: n.x + rand(-14, 14), y: n.y - rand(0, 50), vx: rand(-20, 20), vy: -rand(60, 140), life: 1.2, t: 0, size: 3, color: '#c8a8ff', type: 'glow', drag: 1, grav: 0, rot: 0, vr: 0 }); }
      if (n.appear) { n.alpha = Math.min(1, (n.alpha || 0) + dt * 0.7); if (n.alpha >= 1) n.appear = false; }
    }
    this.npcs = this.npcs.filter(n => !(n.dissolve && n.alpha <= 0));
    if (this.riftOpening) this.riftOpen = Math.min(1, this.riftOpen + dt * 0.45);
    this.updateFighters(dt);
    if (this.hubFight) this.updateHubFight(dt);
    if (this.controlLocked) { this.nearNpc = null; return; }
    let near = null, nd = 1e9;
    for (const n of this.npcs) {
      const d = Math.hypot(P.x - n.x, P.y - n.y);
      if (d < n.r + 60 && d < nd) { nd = d; near = n; }
    }
    if (this.hubFight) near = null; // F is the tag attack during the fight
    this.nearNpc = near;
    if (near && Input.interactHit() && !UI.modal) { SFX.play('ui'); near.interact(near); }
    // collision with npcs
    for (const n of this.npcs) {
      if (n.id === 'gate' || n.fighter) continue;
      const dx = P.x - n.x, dy = P.y - n.y, d = Math.hypot(dx, dy), m = n.r * 0.7 + P.r;
      if (d < m && d > 0.01) { P.x = n.x + dx / d * m; P.y = n.y + dy / d * m; }
    }
  },
  talk(id) {
    const S = SAVE.data;
    const list = TALKS[id] || [];
    const entry = list.find(e => !S.talked[e.id] && e.cond(S));
    if (entry) {
      S.talked[entry.id] = true; SAVE.save();
      UI.dialogue(entry.lines, () => { if (entry.frag) this.awardFragment(entry.frag); });
    } else {
      const idle = TALKS[id + '_idle'] || [[[id, '...']]];
      UI.dialogue(pick(idle));
    }
  },

  /* ---------------- cutscenes ---------------- */
  runScript(steps, done) {
    let i = 0;
    const next = () => {
      if (i >= steps.length) { this.camTarget = null; if (done) done(); return; }
      const st = steps[i++];
      if (st.cam) this.camTarget = { x: st.cam[0], y: st.cam[1] };
      if (st.fn) st.fn();
      const cont = () => { if (st.after) st.after(); this.after(st.wait || 0.05, next); };
      if (st.lines) this.after(st.pre || 0.6, () => UI.dialogue(st.lines, cont)); else cont();
    };
    next();
  },
  cutsceneBreak() {
    const S = SAVE.data;
    this.controlLocked = true;
    Music.play('ruin');
    const dissolve = (pred) => { for (const n of this.npcs) if (pred(n)) n.dissolve = true; SFX.play('rift', 0.5); this.shake(8); };
    const isHero = n => n.cast && HEROES[n.cast];
    const steps = [
      { cam: [700, 380], lines: STORY3.breakA, pre: 0.4 },
      { fn: () => { this.hubBreak = 0.35; this.shake(14); SFX.play('boom'); this.flash('#2a1040', 0.4); }, wait: 1.2 },
      { cam: [330, 620], lines: STORY3.breakPonta, after: () => dissolve(n => n.id === 'ponta'), wait: 1.8 },
      { cam: [1020, 360], lines: STORY3.breakTama, after: () => dissolve(n => n.id === 'tama'), wait: 1.8 },
      { cam: [700, 640], fn: () => { this.hubBreak = 0.65; }, lines: STORY3.breakHeroes, after: () => dissolve(isHero), wait: 2.0 },
    ];
    if (this.npcs.some(n => n.id === 'sanzu')) steps.push({ cam: [470, 200], lines: STORY3.breakSanzu, after: () => dissolve(n => n.id === 'sanzu'), wait: 1.6 });
    steps.push(
      { cam: [400, 320], lines: STORY3.breakHanabi, after: () => dissolve(n => n.id === 'hanabi'), wait: 2.0 },
      { cam: [1000, 580], fn: () => { this.riftOpening = true; this.hubBreak = 1; SFX.play('rift'); SFX.play('roar'); this.shake(24); this.flash('#5b2b8a', 0.7); }, wait: 2.8 },
      { lines: STORY3.breakRift, pre: 0.2 },
      { fn: () => { UI.banner('END OF ARC I', 'Requiem — the first story is over. The rift remains.', 'act'); SFX.play('bell'); }, wait: 3.4 },
    );
    this.runScript(steps, () => { S.flags.cs1 = true; SAVE.save(); this.transition(() => this.toHub('afterbreak')); });
  },
  // cutsceneNewcomers and the tag-team fight live in rift.js

  /* ---------------- transitions ---------------- */
  transition(fn) { this.fadeDir = 1; this.fadeCb = fn; },
  updateFade(rdt) {
    if (this.fadeDir === 1) {
      this.fadeA = Math.min(1, this.fadeA + rdt * 4);
      if (this.fadeA >= 1) { this.fadeDir = -1; const cb = this.fadeCb; this.fadeCb = null; if (cb) cb(); }
    } else if (this.fadeDir === -1) {
      this.fadeA = Math.max(0, this.fadeA - rdt * 3);
      if (this.fadeA <= 0) this.fadeDir = 0;
    }
  },

  /* ---------------- fx update ---------------- */
  updateFx(dt) {
    const step = (arr) => { for (const f of arr) f.t += dt; return arr.filter(f => f.t < f.dur); };
    this.slashes = step(this.slashes); this.rings = step(this.rings); this.lines = step(this.lines); this.bolts = step(this.bolts); this.ghosts = step(this.ghosts);
    for (const d of this.decals) { d.t += dt; if (d.tick) d.tick(d, dt); if (d.t >= d.dur && d.end) d.end(d); }
    this.decals = this.decals.filter(d => d.t < d.dur);
    for (const t of this.texts) { t.t += dt; t.y += t.vy * dt; t.vy *= 1 - dt * 2.5; }
    this.texts = this.texts.filter(t => t.t < t.life);
    for (const s of this.says) s.t += dt;
    this.says = this.says.filter(s => s.t < s.dur && !s.e.dead);
    this.parts.update(dt);
    this.flashA = Math.max(0, this.flashA - dt * 2.2);
    for (const d of this.doors) {
      d.t += dt;
      if (P && P.hp > 0 && !UI.modal && Math.abs(P.x - d.x) < 46 && P.y < d.y + WALL_TOP * 0.5 + 40) this.enterDoor(d);
    }
  },
  updateAmb(rdt) {
    const B = this.scene === 'title' ? { amb: 'petal' } : this.biome();
    const want = B.amb === 'rain' || B.amb === 'hang' ? 90 : 55;
    while (this.amb.length < want) this.amb.push(this.newAmb(B.amb, true));
    for (let i = 0; i < this.amb.length; i++) {
      const a = this.amb[i];
      a.x += a.vx * rdt; a.y += a.vy * rdt; a.t += rdt; a.rot += a.vr * rdt;
      if (a.x < -40 || a.x > this.w + 40 || a.y < -40 || a.y > this.h + 40 || a.type !== B.amb) this.amb[i] = this.newAmb(B.amb, false);
    }
  },
  newAmb(type, init) {
    const w = this.w, h = this.h;
    const a = { type, x: rand(0, w), y: init ? rand(0, h) : -20, vx: 0, vy: 0, t: rand(0, 10), rot: rand(0, TAU), vr: rand(-2, 2), s: rand(1, 3) };
    if (type === 'ember') { a.y = init ? rand(0, h) : h + 20; a.vx = rand(-15, 15); a.vy = rand(-60, -20); }
    else if (type === 'rain') { a.vx = -120; a.vy = rand(700, 900); a.x = rand(0, w + 200); }
    else if (type === 'snow') { a.vx = rand(-20, 30); a.vy = rand(30, 80); }
    else if (type === 'hang') a.y = rand(0, h);
    else if (type === 'void') { a.y = init ? rand(0, h) : h + 20; a.vx = rand(-10, 10); a.vy = rand(-35, -10); }
    else if (type === 'bubble' || type === 'steam') { a.y = init ? rand(0, h) : h + 20; a.vx = rand(-12, 12); a.vy = type === 'steam' ? rand(-70, -30) : rand(-50, -20); }
    else if (type === 'sunash') { a.vx = rand(-30, 30); a.vy = rand(20, 60); }
    else if (type === 'lily') { a.vx = rand(10, 40); a.vy = rand(20, 50); if (!init) a.x = rand(-100, w); }
    else { a.vx = rand(20, 60); a.vy = rand(30, 70); if (!init) a.x = rand(-100, w); }
    return a;
  },

  /* ================================================================ */
  /*  RENDER                                                            */
  /* ================================================================ */
  render() {
    const ctx = this.ctx, z = this.ez(), dpr = this.dpr;
    const B = this.scene === 'title' ? this.room.biome : this.biome();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = B.wall || '#000'; ctx.fillRect(0, 0, this.w, this.h);
    if (!this.room) return;
    const cx = this.cam.x + this.cam.sx, cy = this.cam.y + this.cam.sy;
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (this.w / 2 - cx * z), dpr * (this.h / 2 - cy * z));
    const R = this.room;
    if (R.floor) ctx.drawImage(R.floor.c, R.x0 - R.floor.pad, R.y0 - R.floor.pad, R.floor.w, R.floor.h);
    if (this.scene === 'title') { this.drawHubDecor(ctx); this.renderScreen(ctx, B); return; }
    if (R.hub) this.drawHubDecor(ctx);
    // doors
    for (const d of this.doors) drawDoor(ctx, d, this.t);
    if (R.vents) for (const v of R.vents) { ctx.fillStyle = '#2a2014'; ell(ctx, v.x, v.y, 46, 20); ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 3; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(v.x + i * 14, v.y - 14); ctx.lineTo(v.x + i * 14, v.y + 14); ctx.stroke(); } }
    // zones under
    for (const zn of this.zones) zn.draw(ctx);
    for (const b of this.bubbles) {
      const k = Math.min(1, b.t * 4) * Math.min(1, (b.dur - b.t) * 3);
      ctx.save(); ctx.globalAlpha = 0.7 * k; ctx.strokeStyle = '#c8d8ff'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(160,190,255,.1)';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 12; i++) { const a = i * TAU / 12; ctx.beginPath(); ctx.moveTo(b.x + Math.cos(a) * b.r * 0.86, b.y + Math.sin(a) * b.r * 0.86); ctx.lineTo(b.x + Math.cos(a) * b.r, b.y + Math.sin(a) * b.r); ctx.stroke(); }
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + Math.cos(b.t * 0.6 - 1.57) * b.r * 0.55, b.y + Math.sin(b.t * 0.6 - 1.57) * b.r * 0.55); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + Math.cos(b.t * 6 - 1.57) * b.r * 0.8, b.y + Math.sin(b.t * 6 - 1.57) * b.r * 0.8); ctx.stroke();
      ctx.restore();
    }
    // pickups
    for (const p of this.pickups) drawPickup(ctx, p, this.t);
    // depth sorted entities
    const list = [];
    for (const o of this.obstacles) list.push({ y: o.y, d: () => drawObstacle(ctx, o, B, this.t) });
    for (const n of this.npcs) list.push({ y: n.drawY === undefined ? n.y : n.drawY, d: () => { const fa = n.alpha !== undefined && n.alpha < 1; if (fa) { ctx.save(); ctx.globalAlpha = Math.max(0, n.alpha); } n.draw(ctx, n, this.t); if (n.extra) n.extra(ctx, n, this.t); if (fa) ctx.restore(); } });
    for (const e of this.enemies) list.push({ y: e.y, d: () => e.draw(ctx) });
    for (const g of this.ghosts) list.push({ y: g.y - 1, d: () => this.drawGhost(ctx, g) });
    for (const dc of this.decals) list.push({ y: dc.y === undefined ? -1e9 : dc.y - 2, d: () => { try { dc.draw(ctx, dc, Math.min(1, dc.t / dc.dur)); } catch (err) { dc.t = dc.dur; } } });
    if (P && (P.hp > 0 || this.scene === 'hub')) list.push({ y: P.y, d: () => P.draw(ctx) });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.d();
    // projectiles & fx
    for (const p of this.projs) p.draw(ctx);
    this.drawFx(ctx);
    this.drawQte(ctx);
    this.parts.draw(ctx);
    this.drawTexts(ctx);
    // interaction prompt
    if (this.scene === 'hub' && this.nearNpc && !UI.modal) {
      const n = this.nearNpc;
      ctx.save(); ctx.font = '700 14px "Zen Kaku Gothic New", sans-serif'; ctx.textAlign = 'center';
      const txt = `${this.intKey()} ${n.prompt}`, w = ctx.measureText(txt).width + 24;
      const y = n.y - (n.id === 'gate' ? 170 : 90) + Math.sin(this.t * 4) * 3;
      ctx.fillStyle = 'rgba(10,8,20,.85)'; rrect(ctx, n.x - w / 2, y - 18, w, 28, 8); ctx.fill();
      ctx.strokeStyle = '#ffb04d'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillText(txt, n.x, y + 1);
      ctx.fillStyle = '#ffb04d'; ctx.font = '600 11px sans-serif'; ctx.fillText(n.name, n.x, y - 24);
      ctx.restore();
    }
    if (this.scene === 'run') this.nearNpc = null; // set again just below if someone is close
    if (this.scene === 'run' && this.room.spec && this.npcs.length && !UI.modal) {
      for (const n of this.npcs) {
        if (n.scenery) continue;
        const d = Math.hypot(P.x - n.x, P.y - n.y);
        if (d < n.r + 70) {
          this.nearNpc = n;
          ctx.save(); ctx.font = '700 14px sans-serif'; ctx.textAlign = 'center';
          const txt = `${this.intKey()} ${n.prompt}`, w = ctx.measureText(txt).width + 24, y = n.y - 110;
          ctx.fillStyle = 'rgba(10,8,20,.85)'; rrect(ctx, n.x - w / 2, y - 18, w, 28, 8); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(txt, n.x, y + 1); ctx.restore();
          if (Input.interactHit()) { SFX.play('ui'); n.interact(n); }
        }
      }
    }
    this.renderScreen(ctx, B);
  },
  renderScreen(ctx, B) {
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // ambient
    ctx.save();
    for (const a of this.amb) {
      if (a.type === 'ember') { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,${120 + Math.sin(a.t * 3) * 40 | 0},40,${0.5 + Math.sin(a.t * 5) * 0.3})`; circ(ctx, a.x + Math.sin(a.t) * 10, a.y, a.s); }
      else if (a.type === 'rain') { ctx.strokeStyle = 'rgba(160,140,255,.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + a.vx * 0.03, a.y + a.vy * 0.03); ctx.stroke(); }
      else if (a.type === 'snow') { ctx.fillStyle = 'rgba(240,250,255,.75)'; circ(ctx, a.x + Math.sin(a.t * 1.5) * 12, a.y, a.s * 1.1); }
      else if (a.type === 'hang') { const k = a.s / 3, px = a.x - this.cam.x * k, py = a.y - this.cam.y * k; ctx.fillStyle = 'rgba(235,245,255,.7)'; circ(ctx, ((px % this.w) + this.w) % this.w, ((py % this.h) + this.h) % this.h, a.s * 0.9); }
      else if (a.type === 'void') { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(192,132,255,${0.3 + Math.sin(a.t * 2) * 0.2})`; circ(ctx, a.x, a.y, a.s * 1.2); }
      else if (a.type === 'bubble') { ctx.strokeStyle = 'rgba(160,230,255,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(a.x + Math.sin(a.t * 2) * 6, a.y, a.s * 2, 0, TAU); ctx.stroke(); }
      else if (a.type === 'steam') { ctx.fillStyle = 'rgba(240,230,210,.06)'; circ(ctx, a.x, a.y, a.s * 10); }
      else if (a.type === 'sunash') { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,${150 + (a.s * 30 | 0)},60,${0.4 + Math.sin(a.t * 4) * 0.3})`; circ(ctx, a.x, a.y, a.s * 0.9); }
      else if (a.type === 'lily') { ctx.fillStyle = 'rgba(224,32,58,.75)'; ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.rot); ell(ctx, 0, 0, a.s * 2.6, a.s * 0.6); ctx.restore(); }
      else { ctx.fillStyle = 'rgba(255,183,200,.8)'; ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.rot); ell(ctx, 0, 0, a.s * 2.2, a.s); ctx.restore(); }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    if (B.tint) { ctx.fillStyle = B.tint; ctx.fillRect(0, 0, this.w, this.h); }
    // vignette
    if (!this.vig) {
      const g = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.35, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.6)');
      this.vig = g;
    }
    ctx.fillStyle = this.vig; ctx.fillRect(0, 0, this.w, this.h);
    if (P && this.scene === 'run' && P.hp > 0 && P.hp < P.stats.maxHp * 0.3) {
      const a = 0.25 + Math.sin(this.t * 6) * 0.1;
      const g = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.3, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.7);
      g.addColorStop(0, 'rgba(255,0,40,0)'); g.addColorStop(1, `rgba(255,0,40,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
    }
    // speed lines during dash
    if (P && P.dashT > 0 && this.scene === 'run') {
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2;
      for (let i = 0; i < 18; i++) { const a = rand(0, TAU), r1 = rand(0.35, 0.5) * Math.max(this.w, this.h), r2 = r1 + rand(60, 200); ctx.beginPath(); ctx.moveTo(this.w / 2 + Math.cos(a) * r1, this.h / 2 + Math.sin(a) * r1); ctx.lineTo(this.w / 2 + Math.cos(a) * r2, this.h / 2 + Math.sin(a) * r2); ctx.stroke(); }
      ctx.restore();
    }
    if (this.timeStopT > 0) {
      // Greyscale the world. Browsers without the 'saturation' blend ignore it, which would paint solid grey, so check first.
      ctx.save(); ctx.globalCompositeOperation = 'saturation';
      if (ctx.globalCompositeOperation === 'saturation') { ctx.fillStyle = 'hsl(0,0%,50%)'; ctx.fillRect(0, 0, this.w, this.h); }
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(70,100,200,.14)'; ctx.fillRect(0, 0, this.w, this.h);
      const k = this.timeStopT / this.timeStopMax, cx = this.w / 2, cy = 70;
      ctx.strokeStyle = 'rgba(200,216,255,.8)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, 30, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
      ctx.fillStyle = '#e8eef8'; ctx.font = '900 16px "Shippori Mincho", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('止', cx, cy);
      ctx.restore();
    }
    if (this.darkT > 0 && P && this.scene === 'run') {
      const z = this.ez(), sx = (P.x - this.cam.x) * z + this.w / 2, sy = (P.y - 20 - this.cam.y) * z + this.h / 2, rr = 230 * z;
      const a = Math.min(1, this.darkT) * 0.93;
      const g = ctx.createRadialGradient(sx, sy, rr * 0.4, sx, sy, rr);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(4,2,0,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
      if (this.boss && !this.boss.dead) { const bx = (this.boss.x - this.cam.x) * z + this.w / 2, by = (this.boss.y - 60 - this.cam.y) * z + this.h / 2; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g2 = ctx.createRadialGradient(bx, by, 5, bx, by, 90 * z); g2.addColorStop(0, 'rgba(255,180,70,.5)'); g2.addColorStop(1, 'rgba(255,180,70,0)'); ctx.fillStyle = g2; ctx.fillRect(bx - 100 * z, by - 100 * z, 200 * z, 200 * z); ctx.restore(); }
    }
    if (this.flashA > 0) { ctx.globalAlpha = Math.min(1, this.flashA); ctx.fillStyle = this.flashC; ctx.fillRect(0, 0, this.w, this.h); ctx.globalAlpha = 1; }
    if (this.fadeA > 0) { ctx.fillStyle = `rgba(4,2,8,${this.fadeA})`; ctx.fillRect(0, 0, this.w, this.h); }
  },
  drawGhost(ctx, g) {
    const k = 1 - g.t / g.dur;
    if (g.kind === 'p') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      drawChar(ctx, { x: g.x, y: g.y, s: 13, lookX: g.lx, lookY: g.ly, pal: g.pal, t: g.pt, flash: true, hair: g.hair, acc: g.acc, alpha: 0.35 * k, noShadow: true });
      ctx.restore();
    } else {
      const e = g.e, fake = Object.create(e);
      fake.x = g.x; fake.y = g.y; fake.flash = 0;
      ctx.save(); ctx.globalAlpha = 0.28 * k; ctx.globalCompositeOperation = 'lighter';
      (EDRAW[e.def.draw] || EDRAW.kappa)(ctx, fake, e.t, false);
      ctx.restore();
    }
  },
  drawFx(ctx) {
    ctx.save();
    for (const s of this.slashes) drawSlash(ctx, s);
    for (const r of this.rings) {
      const k = r.t / r.dur;
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.color; ctx.lineWidth = r.width * (1 - k) + 1;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r * (0.3 + 0.7 * ease(k)), r.r * (0.3 + 0.7 * ease(k)) * 0.6, 0, 0, TAU); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const l of this.lines) {
      const k = l.t / l.dur;
      ctx.globalAlpha = 1 - k; ctx.lineCap = 'round';
      ctx.strokeStyle = l.color; ctx.lineWidth = l.width * (1 - k * 0.6);
      ctx.beginPath(); ctx.moveTo(l.x1, l.y1 - 14); ctx.lineTo(l.x2, l.y2 - 14); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = l.width * 0.3 * (1 - k);
      ctx.beginPath(); ctx.moveTo(l.x1, l.y1 - 14); ctx.lineTo(l.x2, l.y2 - 14); ctx.stroke();
    }
    for (const b of this.bolts) {
      ctx.globalAlpha = 1 - b.t / b.dur; ctx.strokeStyle = b.color; ctx.lineWidth = 4;
      ctx.beginPath(); b.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.restore();
  },
  drawTexts(ctx) {
    ctx.save(); ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    for (const t of this.texts) {
      const k = t.t / t.life, pop = t.t < 0.1 ? 1 + (0.1 - t.t) * (t.crit ? 6 : 3) : 1;
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = `900 ${Math.round(t.size * pop)}px "Rajdhani", "Zen Kaku Gothic New", sans-serif`;
      ctx.strokeStyle = 'rgba(10,5,20,.9)'; ctx.lineWidth = 4; ctx.strokeText(t.txt, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    for (const s of this.says) {
      const e = s.e, k = s.t / s.dur;
      ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : Math.min(1, s.t * 6);
      ctx.font = '700 15px "Zen Kaku Gothic New", sans-serif';
      const w = ctx.measureText(s.txt).width + 26, y = e.y - (e.r * 2.8 + 70);
      ctx.fillStyle = 'rgba(255,255,255,.95)'; rrect(ctx, e.x - w / 2, y - 20, w, 32, 14); ctx.fill();
      ctx.beginPath(); ctx.moveTo(e.x - 8, y + 11); ctx.lineTo(e.x, y + 22); ctx.lineTo(e.x + 8, y + 11); ctx.fill();
      ctx.fillStyle = '#1a1020'; ctx.fillText(s.txt, e.x, y + 1);
    }
    ctx.restore();
  },
  drawHubDecor(ctx) {
    const t = this.t;
    // pond
    ctx.save();
    ctx.fillStyle = '#16304a'; ell(ctx, 1110, 190, 150, 70);
    ctx.fillStyle = 'rgba(120,200,255,.15)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(1110, 190, 40 + ((t * 20 + i * 40) % 120), (40 + ((t * 20 + i * 40) % 120)) * 0.45, 0, 0, TAU); ctx.strokeStyle = `rgba(160,220,255,${0.25 - ((t * 20 + i * 40) % 120) / 600})`; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.fillStyle = '#ff8a3d'; ell(ctx, 1080 + Math.sin(t) * 40, 190 + Math.cos(t * 1.3) * 18, 8, 4, t); ctx.fillStyle = '#fff'; ell(ctx, 1140 + Math.cos(t * 0.8) * 30, 200 + Math.sin(t) * 14, 7, 3.5, -t);
    // sakura trees
    for (const [x, y, s] of [[110, 330, 1.1], [1250, 760, 1.0], [150, 860, 0.9], [580, 150, 0.7]]) {
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(ctx, x, y + 6, 70 * s, 22 * s);
      ctx.fillStyle = '#3a2420'; ctx.fillRect(x - 8 * s, y - 120 * s, 16 * s, 126 * s);
      if (this.hubBreak < 0.6) {
        for (let i = 0; i < 7; i++) { const a = i * 0.9; ctx.fillStyle = i % 2 ? '#ff9ec0' : '#ffb7d0'; circ(ctx, x + Math.cos(a) * 55 * s, y - 150 * s + Math.sin(a) * 35 * s, 45 * s); }
        ctx.fillStyle = '#ffd0e0'; circ(ctx, x, y - 160 * s, 40 * s);
      } else {
        ctx.strokeStyle = '#3a2420'; ctx.lineWidth = 6 * s; ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.5; ctx.beginPath(); ctx.moveTo(x, y - 110 * s); ctx.lineTo(x + Math.cos(a) * 70 * s, y - 110 * s + Math.sin(a) * 70 * s); ctx.stroke(); }
      }
    }
    // stone lanterns
    for (const [x, y] of [[560, 260], [840, 260], [560, 560], [840, 560]]) {
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(ctx, x, y + 2, 20, 7);
      ctx.fillStyle = '#6a6470'; ctx.fillRect(x - 6, y - 40, 12, 40); ctx.fillRect(x - 16, y - 62, 32, 22);
      ctx.fillStyle = '#4a4450'; ctx.beginPath(); ctx.moveTo(x - 22, y - 62); ctx.lineTo(x, y - 78); ctx.lineTo(x + 22, y - 62); ctx.fill();
      if (this.hubBreak < 0.3) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,176,77,${0.6 + Math.sin(t * 5 + x) * 0.15})`; ctx.fillRect(x - 9, y - 58, 18, 14); ctx.fillStyle = 'rgba(255,150,50,.12)'; circ(ctx, x, y - 50, 60); ctx.restore(); }
    }
    ctx.restore();
    if (this.hubBreak > 0) drawShrineBreak(ctx, this.hubBreak, t);
    if (this.riftOpen > 0) drawRift(ctx, 1000, 600, this.riftOpen, t);
  },
};

/* ------------------------------------------------------------------ */
/*  DRAWING HELPERS (world objects)                                    */
/* ------------------------------------------------------------------ */
function ease(k) { return 1 - Math.pow(1 - k, 3); }
function drawSlash(ctx, s) {
  const k = s.t / s.dur, rev = Math.min(1, k * 2.6), fade = 1 - Math.max(0, (k - 0.3) / 0.7);
  const a0 = s.ang - s.dir * s.arc / 2, sweep = s.dir * s.arc * rev;
  const thick = 16 * s.width * (s.punch ? 0.7 : 1);
  const N = 18;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let layer = 0; layer < 2; layer++) {
    ctx.beginPath();
    for (let i = 0; i <= N; i++) { const u = i / N, a = a0 + sweep * u; ctx.lineTo(s.x + Math.cos(a) * s.r, s.y + Math.sin(a) * s.r * 0.85); }
    for (let i = N; i >= 0; i--) {
      const u = i / N, a = a0 + sweep * u, th = thick * Math.sin(Math.PI * Math.min(1, u * 1.1)) * (layer ? 0.4 : 1) * (0.4 + 0.6 * u);
      ctx.lineTo(s.x + Math.cos(a) * (s.r - th), s.y + Math.sin(a) * (s.r - th) * 0.85);
    }
    ctx.closePath();
    ctx.fillStyle = layer ? `rgba(255,255,255,${0.9 * fade})` : rgba(s.color, 0.75 * fade);
    ctx.fill();
  }
  ctx.restore();
}
function drawDoor(ctx, d, t) {
  const x = d.x, y = d.y, spec = d.spec;
  const elite = spec.type === 'elite', boss = spec.type === 'boss' || spec.type === 'duel' || spec.type === 'god' || spec.type === 'final';
  const col = boss ? '#ff2e63' : elite ? '#ff8a3d' : '#c8302c';
  ctx.save();
  // portal glow
  const g = ctx.createRadialGradient(x, y - 50, 5, x, y - 50, 70);
  const ic = doorIcon(spec);
  g.addColorStop(0, rgba(ic.color, 0.7)); g.addColorStop(1, rgba(ic.color, 0));
  ctx.fillStyle = g; ctx.fillRect(x - 70, y - 130, 140, 140);
  ctx.fillStyle = '#05030a'; rrect(ctx, x - 34, y - 100, 68, 100, 6); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(ic.color, 0.25 + Math.sin(t * 3) * 0.1); rrect(ctx, x - 30, y - 96, 60, 96, 6); ctx.fill(); ctx.restore();
  // torii
  ctx.fillStyle = col;
  ctx.fillRect(x - 46, y - 110, 10, 110); ctx.fillRect(x + 36, y - 110, 10, 110);
  ctx.fillRect(x - 56, y - 104, 112, 9);
  ctx.beginPath(); ctx.moveTo(x - 66, y - 124); ctx.quadraticCurveTo(x, y - 116, x + 66, y - 124); ctx.lineTo(x + 62, y - 113); ctx.quadraticCurveTo(x, y - 106, x - 62, y - 113); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1a0a0a'; ctx.fillRect(x - 64, y - 128, 128, 5);
  // icon
  const iy = y - 160 + Math.sin(t * 3 + x) * 5;
  ctx.fillStyle = 'rgba(10,6,20,.85)'; circ(ctx, x, iy, 24);
  ctx.strokeStyle = ic.color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, iy, 24, 0, TAU); ctx.stroke();
  if (elite) { ctx.strokeStyle = '#ff8a3d'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(x, iy, 30, t, t + TAU); ctx.stroke(); ctx.setLineDash([]); }
  ctx.fillStyle = ic.color; ctx.font = '900 24px "Zen Kaku Gothic New", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(ic.glyph, x, iy + 1);
  ctx.font = '700 11px sans-serif'; ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(spec.label || ic.label, x, iy + 42);
  ctx.restore();
}
function doorIcon(spec) {
  if (spec.type === 'boss') return { glyph: '鬼', color: '#ff2e63', label: 'BOSS' };
  if (spec.type === 'god') return { glyph: KAMI[spec.kami].glyph, color: KAMI[spec.kami].color, label: KAMI[spec.kami].name };
  if (spec.type === 'final') return { glyph: '禍', color: '#ff2e63', label: 'THE CALAMITY' };
  if (spec.type === 'pantheon') return { glyph: '殿', color: '#ffcf40', label: spec.label || 'Pantheon' };
  if (spec.type === 'duel') return { glyph: '決', color: '#ffb347', label: 'DUEL · ' + BOSSES[spec.boss].name };
  if (spec.type === 'shop') return { glyph: '麺', color: '#ffd56b', label: 'Ramen Cart' };
  if (spec.type === 'spring') return { glyph: '湯', color: '#7dffb0', label: 'Hot Spring' };
  if (spec.type === 'event') return { glyph: '?', color: '#e0d0ff', label: 'Mystery' };
  const rw = spec.reward || {};
  const pre = spec.type === 'elite' ? 'Elite · ' : '';
  switch (rw.t) {
    case 'boon': return { glyph: KAMI[rw.k].glyph, color: KAMI[rw.k].color, label: pre + KAMI[rw.k].name };
    case 'sake': return { glyph: '酒', color: '#f2f0ff', label: pre + 'Spirit Sake' };
    case 'gold': return { glyph: '金', color: '#ffd56b', label: pre + 'Gold' };
    case 'heart': return { glyph: '♥', color: '#ff5577', label: pre + 'Max HP' };
    case 'shards': return { glyph: '魂', color: '#6ee7ff', label: pre + 'Spirit Shards' };
    case 'key': return { glyph: '鍵', color: '#ffd56b', label: pre + 'Moon Key' };
    case 'relic': return { glyph: '宝', color: '#ffb347', label: pre + 'Relic' };
    case 'disc': return { glyph: '修', color: '#e8e0d0', label: pre + 'Discipline' };
  }
  return { glyph: '?', color: '#fff', label: '' };
}
function drawPickup(ctx, p, t) {
  ctx.save();
  if (p.kind === 'coin') {
    ctx.fillStyle = '#ffd56b'; ell(ctx, p.x, p.y - 6, 5 * Math.abs(Math.cos(t * 6 + p.x)) + 1, 5);
    ctx.fillStyle = '#b8862a'; ell(ctx, p.x, p.y - 6, 2 * Math.abs(Math.cos(t * 6 + p.x)), 2);
  } else if (p.kind === 'shard') {
    ctx.fillStyle = '#6ee7ff'; ctx.beginPath(); ctx.moveTo(p.x, p.y - 16); ctx.lineTo(p.x + 5, p.y - 8); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x - 5, p.y - 8); ctx.fill();
  } else if (p.kind === 'heal') {
    ctx.fillStyle = '#ff5577'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('♥', p.x, p.y - 4 + Math.sin(t * 5) * 3);
  } else if (p.kind === 'reward') {
    const ic = doorIcon({ type: 'combat', reward: p.reward });
    const y = p.y - 30 + Math.sin(t * 3) * 6, k = Math.min(1, p.t * 3);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(ctx, p.x, p.y, 26, 9);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(p.x, y, 4, p.x, y, 70 * k); g.addColorStop(0, rgba(ic.color, 0.8)); g.addColorStop(1, rgba(ic.color, 0));
    ctx.fillStyle = g; circ(ctx, p.x, y, 70 * k);
    for (let i = 0; i < 4; i++) { const a = t * 2 + i * TAU / 4; ctx.fillStyle = rgba(ic.color, 0.7); circ(ctx, p.x + Math.cos(a) * 36, y + Math.sin(a) * 14, 3); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(10,6,20,.9)'; circ(ctx, p.x, y, 26 * k);
    ctx.strokeStyle = ic.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, y, 26 * k, 0, TAU); ctx.stroke();
    ctx.fillStyle = ic.color; ctx.font = `900 ${Math.round(28 * k)}px "Zen Kaku Gothic New", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ic.glyph, p.x, y + 1);
  }
  ctx.restore();
}
function drawObstacle(ctx, o, B, t) {
  const x = o.x, y = o.y, r = o.r;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ell(ctx, x, y + 4, r * 1.1, r * 0.45);
  if (o.kind === 'bamboo') {
    for (let i = 0; i < 4; i++) {
      const bx = x + (i - 1.5) * r * 0.45, h = r * (3.5 + ((o.seed * (i + 3)) % 1.5)), sway = Math.sin(t * 1.2 + i + o.seed) * 3;
      ctx.strokeStyle = i % 2 ? '#3f6b3a' : '#4d7d45'; ctx.lineWidth = r * 0.3; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx + sway, y - h); ctx.stroke();
      ctx.strokeStyle = '#2a4a28'; ctx.lineWidth = 2;
      for (let j = 1; j < 5; j++) { const yy = y - h * j / 5; ctx.beginPath(); ctx.moveTo(bx - r * 0.15 + sway * j / 5, yy); ctx.lineTo(bx + r * 0.15 + sway * j / 5, yy); ctx.stroke(); }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,100,40,.25)'; circ(ctx, bx + sway, y - h, 6); ctx.restore();
    }
  } else if (o.kind === 'neon') {
    ctx.fillStyle = '#1a1830'; rrect(ctx, x - r * 0.8, y - r * 3, r * 1.6, r * 3, 4); ctx.fill();
    ctx.fillStyle = '#2a2650'; ctx.fillRect(x - r * 0.8, y - r * 3, r * 1.6, r * 0.3);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const c = ['#ff4fd8', '#49f0ff', '#ffe14d'][Math.floor(o.seed) % 3];
    ctx.fillStyle = rgba(c, 0.6 + (Math.sin(t * 8 + o.seed) > 0.95 ? -0.4 : 0)); rrect(ctx, x - r * 0.6, y - r * 2.6, r * 1.2, r * 1.6, 3); ctx.fill();
    ctx.fillStyle = rgba(c, 0.12); circ(ctx, x, y - r * 1.8, r * 2);
    ctx.restore();
    ctx.fillStyle = '#0a0a14'; ctx.font = `900 ${Math.round(r * 0.7)}px serif`; ctx.textAlign = 'center';
    ctx.fillText(['酒', '夢', '鬼', '月'][Math.floor(o.seed * 7) % 4], x, y - r * 1.6);
  } else if (o.kind === 'ice') {
    ctx.fillStyle = 'rgba(180,230,255,.85)';
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x - r * 0.6, y - r * 2.6); ctx.lineTo(x - r * 0.1, y - r * 1.2); ctx.lineTo(x + r * 0.3, y - r * 3.2); ctx.lineTo(x + r * 0.7, y - r * 1.4); ctx.lineTo(x + r, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.moveTo(x + r * 0.3, y - r * 3.2); ctx.lineTo(x + r * 0.4, y - r * 0.6); ctx.lineTo(x + r * 0.1, y); ctx.fill();
  } else if (o.kind === 'void') {
    ctx.fillStyle = '#1e1430'; rrect(ctx, x - r * 0.6, y - r * 3.4, r * 1.2, r * 3.4, 6); ctx.fill();
    ctx.fillStyle = '#2e1d48'; ctx.fillRect(x - r * 0.8, y - r * 3.6, r * 1.6, r * 0.4);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(192,132,255,${0.4 + Math.sin(t * 2 + o.seed) * 0.2})`; ctx.fillRect(x - 3, y - r * 3.2, 6, r * 2.8); ctx.restore();
  } else if (o.kind === 'grave') {
    ctx.fillStyle = '#3a3440'; rrect(ctx, x - r * 0.55, y - r * 2.2, r * 1.1, r * 2.2, 8); ctx.fill();
    ctx.fillStyle = '#2a2430'; ctx.fillRect(x - r * 0.8, y - r * 0.3, r * 1.6, r * 0.3);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.font = `900 ${Math.round(r * 0.6)}px serif`; ctx.textAlign = 'center'; ctx.fillText('死', x, y - r * 1.2);
    for (let i = 0; i < 3; i++) { ctx.strokeStyle = '#2a5a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - r + i * r * 0.8, y); ctx.lineTo(x - r + i * r * 0.8, y - 14); ctx.stroke(); ctx.fillStyle = '#e0203a'; circ(ctx, x - r + i * r * 0.8, y - 16, 4); }
  } else if (o.kind === 'coral') {
    ctx.strokeStyle = '#ff7a8a'; ctx.lineWidth = r * 0.22; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.4, sway = Math.sin(t * 1.5 + i + o.seed) * 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * r * 0.8 + sway, y + Math.sin(a) * r, x + Math.cos(a) * r * 1.3 + sway, y + Math.sin(a) * r * 2.3); ctx.stroke(); }
    ctx.fillStyle = '#ffb0c0'; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.4; circ(ctx, x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 2.3, r * 0.15); }
  } else if (o.kind === 'gear') {
    ctx.save(); ctx.translate(x, y - r * 1.3); ctx.rotate(t * 0.6 * (o.seed > 50 ? 1 : -1));
    ctx.fillStyle = '#8a6a2a'; star(ctx, 0, 0, r * 1.3, r * 1.0, 12); ctx.fill(); ctx.fillStyle = '#3a2a14'; circ(ctx, 0, 0, r * 0.45);
    ctx.restore();
    ctx.fillStyle = '#4a3a1a'; ctx.fillRect(x - 6, y - r * 1.3, 12, r * 1.3);
  } else if (o.kind === 'pyre') {
    ctx.fillStyle = '#2a1a0a'; rrect(ctx, x - r * 0.8, y - r * 0.8, r * 1.6, r * 0.8, 4); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) { const fx = x + (i - 2) * r * 0.3, h = r * (1.6 + Math.sin(t * 8 + i * 2) * 0.4); ctx.fillStyle = 'rgba(255,140,40,.55)'; ell(ctx, fx, y - r * 0.8 - h / 2, r * 0.25, h / 2); }
    ctx.fillStyle = 'rgba(255,120,30,.12)'; circ(ctx, x, y - r * 1.5, r * 2.2);
    ctx.restore();
  } else if (o.kind === 'frozen') {
    drawTokoyoProp(ctx, o, x, y, r, t);
  } else {
    ctx.fillStyle = '#555'; circ(ctx, x, y - r * 0.5, r);
  }
  ctx.restore();
}
const FERRY_NAMES = {
  ramen: { name: 'Peach of Izanagi', icon: '🍑', desc: 'Heal 35% HP.', fn: () => P.heal(P.stats.maxHp * 0.35) },
  sake: { name: 'Yomi Sake', icon: '🍶' }, onigiri: { name: 'Lantern Oil', icon: '🪔', desc: '+12 Max HP.', fn: () => { G.run.bonusHp += 12; P.recompute(); P.heal(12); } },
  charm: { name: 'Ferry Token', icon: '🎴' }, scroll: { name: 'Drowned Scroll', icon: '📜' }, key: { name: 'Key from the Riverbed', icon: '🗝' },
};
function drawFerry(ctx, n, t) {
  const x = n.x, y = n.y, bob = Math.sin(t * 1.5) * 3;
  ctx.fillStyle = '#0a1a24'; ell(ctx, x, y + 10, 150, 40);
  ctx.strokeStyle = 'rgba(158,231,255,.25)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x, y + 10, 110 + i * 20 + Math.sin(t + i) * 4, 28 + i * 6, 0, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.moveTo(x - 120, y - 10 + bob); ctx.quadraticCurveTo(x, y + 30 + bob, x + 120, y - 10 + bob); ctx.lineTo(x + 100, y - 30 + bob); ctx.lineTo(x - 100, y - 30 + bob); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5a4030'; ctx.fillRect(x - 100, y - 34 + bob, 200, 6);
  ctx.strokeStyle = '#6a5040'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 70, y - 34 + bob); ctx.lineTo(x + 110, y - 140 + bob); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(158,231,255,.5)'; circ(ctx, x - 80, y - 70 + bob, 12 + Math.sin(t * 5) * 2); ctx.restore();
  ctx.strokeStyle = '#444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 80, y - 34 + bob); ctx.lineTo(x - 80, y - 58 + bob); ctx.stroke();
  drawChar(ctx, { x: x - 10, y: y - 30 + bob, s: 12, lookX: 0, lookY: 1, pal: CAST.sanzu.pal, t, hair: 'short', acc: 'hat', eyesClosed: true, noShadow: true });
  for (let i = 0; i < 3; i++) { ctx.fillStyle = ['#c8302c', '#ffcf40', '#7ad7ff'][i]; rrect(ctx, x + 20 + i * 18, y - 48 + bob, 14, 14, 3); ctx.fill(); }
}
function drawLanternBoat(ctx, n, t) {
  const x = n.x, y = n.y, bob = Math.sin(t * 1.3) * 3;
  ctx.fillStyle = '#0a141e'; ell(ctx, x, y, 140, 56);
  ctx.fillStyle = '#4a3020'; ctx.beginPath(); ctx.moveTo(x - 70, y + bob); ctx.quadraticCurveTo(x, y + 30 + bob, x + 70, y + bob); ctx.lineTo(x + 60, y - 14 + bob); ctx.lineTo(x - 60, y - 14 + bob); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const a = n.used ? 0.1 : 0.7 + Math.sin(t * 4) * 0.15;
  ctx.fillStyle = `rgba(255,200,90,${a})`; ell(ctx, x, y - 40 + bob, 18, 24);
  ctx.fillStyle = `rgba(255,170,60,${a * 0.2})`; circ(ctx, x, y - 40 + bob, 90);
  ctx.restore();
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 14 + bob); ctx.lineTo(x, y - 64 + bob); ctx.stroke();
  ctx.fillStyle = '#ffcf40'; ctx.font = '900 26px serif'; ctx.textAlign = 'center'; ctx.fillText('灯', x, y - 90);
}
function drawYomiShrine(ctx, n, t) {
  const x = n.x, y = n.y;
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ell(ctx, x, y + 4, 60, 16);
  ctx.fillStyle = '#1a1420'; ctx.fillRect(x - 42, y - 52, 84, 52);
  ctx.fillStyle = '#0a0810'; ctx.beginPath(); ctx.moveTo(x - 58, y - 52); ctx.lineTo(x, y - 90); ctx.lineTo(x + 58, y - 52); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(224,32,58,${n.used ? 0.05 : 0.3 + Math.sin(t * 3) * 0.1})`; circ(ctx, x, y - 30, 44); ctx.restore();
  ctx.fillStyle = '#e0203a'; ctx.font = '900 22px serif'; ctx.textAlign = 'center'; ctx.fillText(n.used ? '・' : '冥', x, y - 18);
  for (let i = 0; i < 5; i++) { const fx = x - 50 + i * 25; ctx.strokeStyle = '#2a5a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, y + 8); ctx.lineTo(fx, y - 6); ctx.stroke(); ctx.fillStyle = '#e0203a'; circ(ctx, fx, y - 8, 4); }
}
function drawYomiTorii(ctx, n, t) {
  const x = n.x, y = n.y + 40;
  ctx.save();
  const g = ctx.createRadialGradient(x, y - 80, 10, x, y - 80, 130); g.addColorStop(0, 'rgba(224,32,58,.4)'); g.addColorStop(1, 'rgba(224,32,58,0)');
  ctx.fillStyle = g; ctx.fillRect(x - 140, y - 220, 280, 240);
  ctx.fillStyle = '#000'; ctx.fillRect(x - 50, y - 140, 100, 140);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(224,32,58,${0.2 + Math.sin(t * 1.5) * 0.1})`; ctx.fillRect(x - 50, y - 140, 100, 140); ctx.restore();
  ctx.fillStyle = '#141018';
  ctx.fillRect(x - 66, y - 150, 14, 150); ctx.fillRect(x + 52, y - 150, 14, 150);
  ctx.fillRect(x - 80, y - 140, 160, 10);
  ctx.beginPath(); ctx.moveTo(x - 96, y - 168); ctx.quadraticCurveTo(x, y - 156, x + 96, y - 168); ctx.lineTo(x + 90, y - 154); ctx.quadraticCurveTo(x, y - 146, x - 90, y - 154); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e0203a'; ctx.font = '900 14px serif'; ctx.textAlign = 'center'; ctx.fillText('黄泉', x, y - 132);
  const S = SAVE.data; if (S.flags.sunEnd) { ctx.fillStyle = '#ffcf40'; ctx.font = '700 11px sans-serif'; ctx.fillText('☀ cleared ×' + (S.clears2 || 0), x, y + 20); }
  ctx.restore();
}

// hub & station drawings
function drawNpcChar(ctx, n, t) {
  const c = CAST[n.cast];
  const dx = P ? P.x - n.x : 0, dy = P ? P.y - n.y : 1, l = Math.hypot(dx, dy) || 1;
  const near = l < 160;
  if (n.cast === 'hanabi') {
    ctx.fillStyle = c.pal.hair; const sw = Math.sin(t * 3) * 0.3;
    ctx.save(); ctx.translate(n.x + 14, n.y - 14); ctx.rotate(0.6 + sw); ell(ctx, 10, 0, 18, 8); ctx.fillStyle = '#fff'; ell(ctx, 24, 0, 6, 5); ctx.restore();
  }
  drawChar(ctx, { x: n.x, y: n.y, s: 13, lookX: near ? dx / l : Math.sin(t * 0.5) * 0.3, lookY: near ? dy / l : 0.8, pal: c.pal, t, moving: false, hair: c.hair, acc: c.acc, eyesClosed: c.eyesClosed, mood: 'happy' });
  const unread = (TALKS[n.talkKey || n.cast] || []).some(e => !SAVE.data.talked[e.id] && e.cond(SAVE.data));
  if (unread) {
    ctx.save(); ctx.fillStyle = '#ffd56b'; ctx.font = '900 22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('!', n.x, n.y - 62 + Math.sin(t * 5) * 3); ctx.restore();
  }
}
function drawLanterns(ctx, n, t) {
  for (let i = 0; i < 5; i++) {
    const x = n.x - 80 + i * 40, y = n.y - 70 - Math.sin(i * 1.3) * 10 + Math.sin(t * 2 + i) * 3;
    const lit = i < Object.values(SAVE.data.mirror).reduce((a, b) => a + b, 0) / 4;
    ctx.fillStyle = '#3a2a20'; ctx.fillRect(x - 1, y - 30, 2, 18);
    ctx.fillStyle = lit ? '#ff7a3d' : '#5a4038'; ell(ctx, x, y, 9, 12);
    if (lit) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,150,60,.25)'; circ(ctx, x, y, 22); ctx.restore(); }
  }
}
function drawAnvil(ctx, n, t) {
  const x = n.x + 50, y = n.y + 6;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(ctx, x, y, 26, 8);
  ctx.fillStyle = '#3a3a48'; ctx.fillRect(x - 10, y - 22, 20, 22); ctx.fillRect(x - 24, y - 32, 44, 12);
  ctx.beginPath(); ctx.moveTo(x + 20, y - 32); ctx.lineTo(x + 34, y - 28); ctx.lineTo(x + 20, y - 22); ctx.fill();
  if (Math.sin(t * 3) > 0.9) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffb347'; for (let i = 0; i < 5; i++) circ(ctx, x + rand(-15, 15), y - 36 - rand(0, 20), 2); ctx.restore(); }
}
function drawAltar(ctx, n, t) {
  const x = n.x, y = n.y;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ell(ctx, x, y + 4, 60, 18);
  ctx.fillStyle = '#4a4458'; rrect(ctx, x - 52, y - 20, 104, 24, 6); ctx.fill();
  ctx.fillStyle = '#5a546a'; rrect(ctx, x - 40, y - 34, 80, 16, 5); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y - 70, 5, x, y - 70, 70); g.addColorStop(0, 'rgba(255,200,230,.5)'); g.addColorStop(1, 'rgba(255,200,230,0)');
  ctx.fillStyle = g; circ(ctx, x, y - 70, 70);
  ctx.restore();
  // floating moon shard
  ctx.fillStyle = '#fff6d8';
  const fy = y - 80 + Math.sin(t * 2) * 6;
  ctx.beginPath(); ctx.arc(x, fy, 18, 0.6, TAU - 0.6); ctx.arc(x + 8, fy, 14, TAU - 0.9, 0.9, true); ctx.fill();
  const hs = HERO_ORDER.filter(h => SAVE.data.heroes[h].unlocked);
  ctx.font = '700 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.fillText(hs.length + '/' + HERO_ORDER.length + ' heroes', x, y + 20);
}
function drawTorii(ctx, n, t) {
  const x = n.x, y = n.y + 40;
  ctx.save();
  const g = ctx.createRadialGradient(x, y - 80, 10, x, y - 80, 130); g.addColorStop(0, 'rgba(255,90,90,.45)'); g.addColorStop(1, 'rgba(255,90,90,0)');
  ctx.fillStyle = g; ctx.fillRect(x - 140, y - 220, 280, 240);
  ctx.fillStyle = '#05030a'; ctx.fillRect(x - 60, y - 160, 120, 160);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,60,90,${0.25 + Math.sin(t * 2) * 0.1})`; ctx.fillRect(x - 60, y - 160, 120, 160); ctx.restore();
  ctx.fillStyle = '#c8302c';
  ctx.fillRect(x - 78, y - 170, 16, 170); ctx.fillRect(x + 62, y - 170, 16, 170);
  ctx.fillRect(x - 92, y - 160, 184, 12);
  ctx.beginPath(); ctx.moveTo(x - 110, y - 192); ctx.quadraticCurveTo(x, y - 178, x + 110, y - 192); ctx.lineTo(x + 104, y - 176); ctx.quadraticCurveTo(x, y - 166, x - 104, y - 176); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1a0a0a'; ctx.fillRect(x - 106, y - 198, 212, 7);
  ctx.fillStyle = '#1a0a0a'; ctx.fillRect(x - 16, y - 176, 32, 22); ctx.fillStyle = '#ffd56b'; ctx.font = '900 14px serif'; ctx.textAlign = 'center'; ctx.fillText('昇', x, y - 160);
  const heat = SAVE.heat();
  if (heat > 0) { ctx.fillStyle = '#c084ff'; ctx.font = '700 12px sans-serif'; ctx.fillText('Moon Phase ' + heat, x, y + 22); }
  ctx.restore();
}
function drawPactStone(ctx, n, t) {
  const x = n.x, y = n.y, heat = SAVE.heat();
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ell(ctx, x, y + 3, 34, 11);
  ctx.fillStyle = '#3a3448'; ctx.beginPath(); ctx.moveTo(x - 26, y); ctx.lineTo(x - 20, y - 60); ctx.lineTo(x + 4, y - 74); ctx.lineTo(x + 24, y - 54); ctx.lineTo(x + 28, y); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i - 3.5) * 0.28, lit = heat > i * 2;
    ctx.fillStyle = lit ? '#c084ff' : '#5a5070';
    circ(ctx, x + Math.cos(a) * 18, y - 36 + Math.sin(a) * 18 + 6, 3);
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(192,132,255,${0.2 + heat * 0.02})`; circ(ctx, x, y - 36, 26 + Math.sin(t * 2) * 3); ctx.restore();
}
function drawRamenCart(ctx, n, t) {
  const x = n.x, y = n.y;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ell(ctx, x, y + 4, 90, 22);
  ctx.fillStyle = '#5a3a24'; ctx.fillRect(x - 80, y - 60, 160, 60);
  ctx.fillStyle = '#3a2416'; circ(ctx, x - 60, y, 16); circ(ctx, x + 60, y, 16);
  ctx.fillStyle = '#c33'; ctx.fillRect(x - 90, y - 130, 180, 20);
  for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#c33'; ctx.fillRect(x - 90 + i * 30, y - 110, 30, 14); }
  ctx.fillStyle = '#3a2416'; ctx.fillRect(x - 84, y - 112, 6, 54); ctx.fillRect(x + 78, y - 112, 6, 54);
  ctx.fillStyle = '#fff'; ctx.font = '900 16px serif'; ctx.textAlign = 'center'; ctx.fillText('ら ー め ん', x, y - 115);
  // noren flaps
  for (let i = 0; i < 4; i++) { ctx.fillStyle = '#2a3a6a'; ctx.fillRect(x - 70 + i * 36, y - 96, 30, 26 + Math.sin(t * 2 + i) * 2); }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,180,80,.25)'; circ(ctx, x + 70, y - 140, 26 + Math.sin(t * 6) * 3); ctx.fillStyle = '#ffb347'; ell(ctx, x + 70, y - 140, 10, 13); ctx.restore();
  // steam
  for (let i = 0; i < 3; i++) { ctx.fillStyle = `rgba(255,255,255,${0.15 - ((t * 0.6 + i * 0.33) % 1) * 0.15})`; circ(ctx, x - 20 + i * 18 + Math.sin(t + i) * 6, y - 70 - ((t * 40 + i * 30) % 90), 10); }
  drawChar(ctx, { x: x, y: y - 56, s: 11, lookX: 0, lookY: 1, pal: CAST.udon.pal, t, hair: 'short', acc: 'headband', eyesClosed: true, mood: 'happy', noShadow: true });
}
function drawOnsen(ctx, n, t) {
  const x = n.x, y = n.y;
  ctx.fillStyle = '#4a4458'; ell(ctx, x, y, 130, 64);
  ctx.fillStyle = n.used ? '#24405a' : '#3aa0c8'; ell(ctx, x, y, 112, 52);
  ctx.fillStyle = 'rgba(255,255,255,.15)'; ell(ctx, x - 30, y - 12, 40, 10);
  for (let i = 0; i < 6; i++) { if (n.used) break; ctx.fillStyle = `rgba(255,255,255,${0.18 - ((t * 0.5 + i / 6) % 1) * 0.18})`; circ(ctx, x - 80 + i * 32 + Math.sin(t + i) * 8, y - 20 - ((t * 30 + i * 25) % 110), 16); }
  for (const [rx, ry] of [[-120, 10], [-90, -50], [100, -46], [126, 14], [0, 60]]) { ctx.fillStyle = '#6a6470'; ell(ctx, x + rx, y + ry, 22, 14); }
  ctx.fillStyle = '#7dffb0'; ctx.font = '900 28px serif'; ctx.textAlign = 'center'; ctx.fillText('♨', x, y - 70);
}
function drawShrine(ctx, n, t) {
  const x = n.x, y = n.y;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ell(ctx, x, y + 4, 56, 16);
  ctx.fillStyle = '#5a3a24'; ctx.fillRect(x - 40, y - 50, 80, 50);
  ctx.fillStyle = '#3a2416'; ctx.beginPath(); ctx.moveTo(x - 56, y - 50); ctx.lineTo(x, y - 86); ctx.lineTo(x + 56, y - 50); ctx.fill();
  ctx.fillStyle = '#c33'; ctx.fillRect(x - 30, y - 44, 60, 6);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(224,208,255,${n.used ? 0.05 : 0.3 + Math.sin(t * 3) * 0.1})`; circ(ctx, x, y - 30, 40); ctx.restore();
  ctx.fillStyle = '#ffd56b'; ctx.font = '900 20px serif'; ctx.textAlign = 'center'; ctx.fillText(n.used ? '・' : '?', x, y - 18);
  // shimenawa rope
  ctx.strokeStyle = '#d9c08a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 40, y - 50); ctx.quadraticCurveTo(x, y - 40, x + 40, y - 50); ctx.stroke();
  for (let i = -1; i <= 1; i++) { ctx.fillStyle = '#fff'; ctx.fillRect(x + i * 20 - 3, y - 46, 6, 12); }
}

/* ------------------------------------------------------------------ */
/*  FLOOR BUILDER                                                      */
/* ------------------------------------------------------------------ */
G.buildFloor = function (R) {
  const pad = 260, B = R.biome, sc = 1.25;
  const W = R.w + pad * 2, H = R.h + pad * 2;
  const c = document.createElement('canvas');
  c.width = Math.round(W * sc); c.height = Math.round(H * sc);
  const x = c.getContext('2d'); x.scale(sc, sc);
  const rnd = seeded(Math.floor(R.w * 7 + R.h * 13 + (B.id || '').length * 101));
  x.fillStyle = B.wall; x.fillRect(0, 0, W, H);
  const X0 = pad, Y0 = pad;
  // floor
  x.fillStyle = B.floor; x.fillRect(X0, Y0, R.w, R.h);
  const ts = 80;
  for (let i = 0; i * ts < R.w; i++) for (let j = 0; j * ts < R.h; j++) {
    if ((i + j) % 2 === 0) { x.fillStyle = B.floor2; x.fillRect(X0 + i * ts, Y0 + j * ts, ts, ts); }
    if (rnd() < 0.12) { x.fillStyle = 'rgba(255,255,255,.025)'; x.fillRect(X0 + i * ts + 6, Y0 + j * ts + 6, ts - 12, ts - 12); }
  }
  x.strokeStyle = B.line; x.lineWidth = 2;
  for (let i = 0; i <= R.w; i += ts) { x.beginPath(); x.moveTo(X0 + i, Y0); x.lineTo(X0 + i, Y0 + R.h); x.stroke(); }
  for (let j = 0; j <= R.h; j += ts) { x.beginPath(); x.moveTo(X0, Y0 + j); x.lineTo(X0 + R.w, Y0 + j); x.stroke(); }
  // biome details
  for (let k = 0; k < 60; k++) {
    const px = X0 + rnd() * R.w, py = Y0 + rnd() * R.h;
    if (B.id === 'grove') { x.fillStyle = `rgba(255,${80 + rnd() * 60 | 0},40,${0.02 + rnd() * 0.04})`; circ(x, px, py, 4 + rnd() * 18); }
    else if (B.id === 'city') { x.strokeStyle = rnd() < 0.5 ? 'rgba(255,79,216,.12)' : 'rgba(73,240,255,.12)'; x.lineWidth = 2; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 40 + rnd() * 80, py); x.stroke(); }
    else if (B.id === 'temple') { x.fillStyle = 'rgba(230,245,255,.045)'; ell(x, px, py, 20 + rnd() * 40, 6 + rnd() * 10); }
    else if (B.id === 'palace') { x.strokeStyle = 'rgba(192,132,255,.08)'; x.lineWidth = 1.5; x.beginPath(); x.arc(px, py, 10 + rnd() * 40, 0, TAU); x.stroke(); }
    else if (B.id === 'yomi') { x.fillStyle = rnd() < 0.3 ? 'rgba(224,32,58,.35)' : 'rgba(10,6,14,.4)'; ell(x, px, py, 3 + rnd() * 6, 2 + rnd() * 3, rnd() * 3); }
    else if (B.id === 'ryugu') { x.strokeStyle = 'rgba(73,240,255,.07)'; x.lineWidth = 3; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 30, py - 20, px + 60, py); x.stroke(); }
    else if (B.id === 'karakuri') { x.strokeStyle = 'rgba(255,179,71,.08)'; x.lineWidth = 2; star(x, px, py, 18, 13, 8); x.stroke(); }
    else if (B.id === 'blacksun') { x.fillStyle = 'rgba(255,120,30,.05)'; circ(x, px, py, 6 + rnd() * 26); }
    else if (B.id === 'heaven') { x.fillStyle = 'rgba(255,230,160,.05)'; ell(x, px, py, 30 + rnd() * 60, 10 + rnd() * 16); }
    else if (B.id === 'calamity') { x.strokeStyle = 'rgba(255,46,99,.08)'; x.lineWidth = 2; x.beginPath(); x.moveTo(px, py); for (let q = 0; q < 4; q++) x.lineTo(px + rnd() * 60 - 30, py + rnd() * 60 - 30); x.stroke(); }
    else { x.fillStyle = 'rgba(255,183,200,.18)'; ell(x, px, py, 4, 2, rnd() * 3); }
  }
  if (B.id === 'palace' || B.id === 'blacksun' || B.id === 'heaven' || B.id === 'calamity' || (R.type === 'boss')) {
    x.strokeStyle = rgba(B.accent || '#fff', 0.15); x.lineWidth = 3;
    x.beginPath(); x.arc(X0 + R.w / 2, Y0 + R.h / 2, Math.min(R.w, R.h) * 0.35, 0, TAU); x.stroke();
    x.beginPath(); x.arc(X0 + R.w / 2, Y0 + R.h / 2, Math.min(R.w, R.h) * 0.25, 0, TAU); x.stroke();
    star(x, X0 + R.w / 2, Y0 + R.h / 2, Math.min(R.w, R.h) * 0.24, Math.min(R.w, R.h) * 0.1, 8); x.stroke();
  }
  if (R.hub) {
    // stone path to the gate
    x.fillStyle = '#2c2838';
    for (let j = 0; j < 12; j++) { rrect(x, X0 + R.w / 2 - 60, Y0 + 150 + j * 62, 120, 48, 8); x.fill(); }
    x.fillStyle = '#28243a'; ell(x, X0 + 700, Y0 + 400, 150, 80);
  }
  // walls
  const wallC = shade(B.floor, -0.45);
  x.fillStyle = wallC;
  x.fillRect(X0, Y0, R.w, WALL_TOP - 20);
  x.fillStyle = shade(B.floor, -0.25); x.fillRect(X0, Y0 + WALL_TOP - 30, R.w, 12);
  x.fillStyle = wallC; x.fillRect(X0, Y0, WALL - 10, R.h); x.fillRect(X0 + R.w - WALL + 10, Y0, WALL - 10, R.h); x.fillRect(X0, Y0 + R.h - WALL + 14, R.w, WALL - 14);
  x.strokeStyle = rgba(B.accent || '#fff', 0.35); x.lineWidth = 2;
  x.strokeRect(X0 + WALL - 10, Y0 + WALL_TOP - 18, R.w - WALL * 2 + 20, R.h - WALL_TOP - WALL + 32);
  // wall decor
  for (let i = 0; i < R.w; i += 120) {
    const wx = X0 + i + 60;
    if (B.id === 'grove') { x.fillStyle = '#3f6b3a'; for (let k = 0; k < 3; k++) x.fillRect(wx - 20 + k * 14, Y0 - 100, 8, WALL_TOP + 60); }
    else if (B.id === 'city') { x.fillStyle = rnd() < 0.5 ? 'rgba(255,79,216,.5)' : 'rgba(73,240,255,.5)'; x.fillRect(wx - 25, Y0 + 14, 50, 22); }
    else if (B.id === 'temple') { x.fillStyle = '#b8d8f0'; x.beginPath(); x.moveTo(wx - 30, Y0 + WALL_TOP - 20); x.lineTo(wx, Y0 + 10); x.lineTo(wx + 30, Y0 + WALL_TOP - 20); x.fill(); }
    else if (B.id === 'palace') { x.fillStyle = 'rgba(192,132,255,.35)'; x.fillRect(wx - 3, Y0 + 6, 6, WALL_TOP - 30); }
    else if (B.id === 'yomi') { x.fillStyle = '#1a1420'; x.fillRect(wx - 12, Y0 + 10, 24, WALL_TOP - 30); x.fillStyle = 'rgba(224,32,58,.6)'; circ(x, wx, Y0 + 24, 5); }
    else if (B.id === 'ryugu') { x.fillStyle = 'rgba(255,120,140,.5)'; ell(x, wx, Y0 + 40, 26, 14); }
    else if (B.id === 'karakuri') { x.fillStyle = '#5a4a2a'; star(x, wx, Y0 + 36, 22, 16, 10); x.fill(); }
    else if (B.id === 'blacksun') { x.fillStyle = 'rgba(255,170,60,.45)'; x.fillRect(wx - 2, Y0 + 6, 4, WALL_TOP - 30); }
    else if (B.id === 'heaven') { x.fillStyle = '#c8a050'; x.fillRect(wx - 5, Y0 + 8, 10, WALL_TOP - 30); x.fillStyle = 'rgba(255,220,140,.4)'; circ(x, wx, Y0 + 14, 8); }
    else if (B.id === 'calamity') { x.fillStyle = 'rgba(91,43,138,.6)'; x.beginPath(); x.moveTo(wx - 16, Y0 + WALL_TOP - 20); x.lineTo(wx, Y0 + 6); x.lineTo(wx + 16, Y0 + WALL_TOP - 20); x.fill(); }
    else if (B.id === 'tokoyo') { x.fillStyle = '#2a2430'; x.fillRect(wx - 30, Y0 + 10, 60, 3); x.fillStyle = '#e8863a'; ell(x, wx, Y0 + 32, 12, 16); x.fillStyle = 'rgba(255,160,70,.18)'; circ(x, wx, Y0 + 32, 28); }
    else { x.fillStyle = '#c8302c'; x.fillRect(wx - 3, Y0 + 20, 6, WALL_TOP - 40); }
  }
  // outer decoration
  for (let k = 0; k < 70; k++) {
    let px = rnd() * W, py = rnd() * H;
    if (px > X0 - 30 && px < X0 + R.w + 30 && py > Y0 - 30 && py < Y0 + R.h + 30) continue;
    if (B.id === 'grove') { const bw = 10 + rnd() * 8; x.strokeStyle = rnd() < 0.5 ? '#2a4d28' : '#335c30'; x.lineWidth = bw; x.beginPath(); x.moveTo(px, py + 90); x.lineTo(px + rnd() * 10, py - 160); x.stroke(); x.strokeStyle = '#1a3018'; x.lineWidth = 2; for (let q = 0; q < 4; q++) { const yy = py + 80 - q * 60; x.beginPath(); x.moveTo(px - bw / 2, yy); x.lineTo(px + bw / 2, yy); x.stroke(); } x.fillStyle = '#2f5a2c'; for (let q = 0; q < 3; q++) ell(x, px + 14 + rnd() * 10, py - 100 + q * 40, 16, 4, -0.5); }
    else if (B.id === 'city') { x.fillStyle = `rgba(${rnd() < .5 ? '255,79,216' : '73,240,255'},.15)`; x.fillRect(px, py, 30 + rnd() * 60, 60 + rnd() * 120); }
    else if (B.id === 'temple') { x.fillStyle = 'rgba(220,240,255,.25)'; circ(x, px, py, 20 + rnd() * 40); }
    else if (B.id === 'palace') { x.fillStyle = 'rgba(192,132,255,.12)'; circ(x, px, py, 4 + rnd() * 10); }
    else if (B.id === 'yomi') { x.strokeStyle = '#2a5a2a'; x.lineWidth = 2; x.beginPath(); x.moveTo(px, py + 20); x.lineTo(px, py); x.stroke(); x.fillStyle = 'rgba(224,32,58,.7)'; circ(x, px, py, 5); }
    else if (B.id === 'ryugu') { x.fillStyle = 'rgba(40,140,180,.12)'; circ(x, px, py, 20 + rnd() * 40); }
    else if (B.id === 'karakuri') { x.fillStyle = 'rgba(139,106,42,.35)'; star(x, px, py, 30 + rnd() * 20, 22 + rnd() * 10, 10); x.fill(); }
    else if (B.id === 'blacksun') { x.fillStyle = 'rgba(255,120,30,.18)'; circ(x, px, py, 4 + rnd() * 16); }
    else if (B.id === 'heaven') { x.fillStyle = 'rgba(255,240,210,.12)'; ell(x, px, py, 40 + rnd() * 60, 14 + rnd() * 16); }
    else if (B.id === 'calamity') { x.fillStyle = 'rgba(91,43,138,.15)'; circ(x, px, py, 6 + rnd() * 20); }
    else if (B.id === 'tokoyo') { x.fillStyle = 'rgba(220,235,250,.14)'; circ(x, px, py, 10 + rnd() * 34); }
    else { x.fillStyle = 'rgba(255,183,200,.25)'; circ(x, px, py, 20 + rnd() * 40); }
  }
  return { c, pad, w: W, h: H };
};

function drawShrineBreak(ctx, k, t) {
  const rnd = seeded(4242);
  ctx.save(); ctx.strokeStyle = 'rgba(160,110,255,.55)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  const n = Math.floor(18 * k);
  for (let i = 0; i < 18; i++) {
    let x = 200 + rnd() * 1000, y = 200 + rnd() * 700, a = rnd() * TAU;
    if (i >= n) continue;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let j = 0; j < 6; j++) { a += rnd() - 0.5; x += Math.cos(a) * 30; y += Math.sin(a) * 30; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.restore();
  if (k > 0.5) {
    for (let i = 0; i < 9; i++) {
      const bx = 1000 + Math.cos(i * 2.3) * (140 + i * 18), by = 600 - 80 + Math.sin(i * 1.7) * 60 + Math.sin(t * 1.2 + i) * 14 - 40;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ell(ctx, bx, by + 60, 14, 5);
      ctx.fillStyle = i % 2 ? '#2c2838' : '#24212f'; ctx.save(); ctx.translate(bx, by); ctx.rotate(t * 0.3 + i); ctx.fillRect(-10, -7, 20, 14); ctx.restore();
    }
  }
}
function drawRift(ctx, x, y, k, t) {
  const h = 190 * k, w = 70 * k;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y - h * 0.5, 5, x, y - h * 0.5, h * 1.1 + 1);
  g.addColorStop(0, 'rgba(160,100,255,.55)'); g.addColorStop(1, 'rgba(160,100,255,0)');
  ctx.fillStyle = g; ctx.fillRect(x - h * 1.2, y - h * 1.7, h * 2.4, h * 2.4);
  ctx.globalCompositeOperation = 'source-over';
  const path = (sc) => {
    ctx.beginPath(); ctx.moveTo(x, y - h * 1.0);
    for (let i = 0; i <= 10; i++) { const yy = y - h + i * h / 10, ww = Math.sin(i / 10 * Math.PI) * w * sc; ctx.lineTo(x + ww + Math.sin(t * 4 + i) * 4 * sc, yy); }
    for (let i = 10; i >= 0; i--) { const yy = y - h + i * h / 10, ww = Math.sin(i / 10 * Math.PI) * w * sc; ctx.lineTo(x - ww + Math.cos(t * 3 + i) * 4 * sc, yy); }
    ctx.closePath();
  };
  ctx.fillStyle = '#c8a8ff'; path(1.15); ctx.fill();
  ctx.fillStyle = '#05020a'; path(0.9); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  for (let i = 0; i < 14; i++) { const a = t * (0.5 + i * 0.07) + i; circ(ctx, x + Math.cos(a) * w * 0.5 * Math.sin(i), y - h * 0.5 + Math.sin(a) * h * 0.35, 1.5); }
  if (Math.random() < 0.08 && k > 0.9) { ctx.strokeStyle = '#e8d8ff'; ctx.lineWidth = 2; ctx.beginPath(); let lx = x, ly = y - h * 0.5; ctx.moveTo(lx, ly); for (let i = 0; i < 5; i++) { lx += rand(-30, 30); ly += rand(-30, 30); ctx.lineTo(lx, ly); } ctx.stroke(); }
  ctx.restore();
}
function drawHeavenGate(ctx, n, t) {
  const S = SAVE.data, ok = S.fragments.length >= 8 && (S.seals || []).length >= 4, x = n.x, y = n.y + 40;
  ctx.save();
  if (ok) { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y - 90, 10, x, y - 90, 140); g.addColorStop(0, 'rgba(255,220,140,.5)'); g.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = g; ctx.fillRect(x - 150, y - 240, 300, 260); ctx.globalCompositeOperation = 'source-over'; }
  for (let i = 0; i < 5; i++) { ctx.fillStyle = ok ? '#c8a050' : '#5a5060'; ctx.fillRect(x - 60 + i * 6, y - i * 12, 120 - i * 12, 10); }
  ctx.fillStyle = ok ? '#fff6d8' : '#3a3440';
  ctx.fillRect(x - 54, y - 170, 12, 112); ctx.fillRect(x + 42, y - 170, 12, 112);
  ctx.fillRect(x - 66, y - 160, 132, 9);
  ctx.beginPath(); ctx.moveTo(x - 80, y - 186); ctx.quadraticCurveTo(x, y - 174, x + 80, y - 186); ctx.lineTo(x + 76, y - 172); ctx.quadraticCurveTo(x, y - 164, x - 76, y - 172); ctx.closePath(); ctx.fill();
  ctx.fillStyle = ok ? '#ffcf40' : '#777'; ctx.font = '900 14px serif'; ctx.textAlign = 'center'; ctx.fillText('神', x, y - 146);
  if (!ok) { ctx.strokeStyle = '#8a8a94'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 50, y - 140); ctx.lineTo(x + 50, y - 70); ctx.moveTo(x + 50, y - 140); ctx.lineTo(x - 50, y - 70); ctx.stroke(); ctx.fillStyle = '#aaa'; ctx.font = '700 11px sans-serif'; ctx.fillText(`${S.fragments.length}/8 月 · ${(S.seals || []).length}/4 ☀`, x, y + 22); }
  else for (let i = 0; i < 7; i++) { const a = t * 0.6 + i * TAU / 7; ctx.fillStyle = KAMI[KAMI_ORDER[i]].color; circ(ctx, x + Math.cos(a) * 40, y - 110 + Math.sin(a) * 14, 4); }
  ctx.restore();
}
function drawSevenAltar(ctx, n, t) {
  const x = n.x, y = n.y, run = G.run;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ell(ctx, x, y + 4, 90, 26);
  ctx.fillStyle = '#5a4a2a'; rrect(ctx, x - 80, y - 24, 160, 28, 8); ctx.fill();
  for (let i = 0; i < 7; i++) {
    const k = KAMI_ORDER[i], a = -Math.PI / 2 + (i - 3) * 0.42, fx = x + Math.cos(a) * 110, fy = y - 70 + Math.sin(a) * 50, free = run && run.godsDone && run.godsDone.includes(k);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = free ? rgba(KAMI[k].color, 0.5) : 'rgba(91,43,138,.4)'; circ(ctx, fx, fy, 18 + Math.sin(t * 3 + i) * 2); ctx.restore();
    ctx.fillStyle = free ? KAMI[k].color : '#7a5aa8'; ctx.font = '900 18px "Shippori Mincho", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(KAMI[k].glyph, fx, fy + 1);
  }
}
function drawLanternsOnly(ctx, n, t) {
  for (let i = 0; i < 5; i++) {
    const x = n.x - 80 + i * 40, y = n.y - 30 - Math.sin(i * 1.3) * 10 + Math.sin(t * 2 + i) * 3;
    ctx.fillStyle = '#3a2a20'; ctx.fillRect(x - 1, y - 30, 2, 18);
    const lit = i < Object.values(SAVE.data.mirror).reduce((a, b) => a + b, 0) / 4 && Math.sin(t * 7 + i * 3) > -0.6;
    ctx.fillStyle = lit ? '#c8703d' : '#4a3430'; ell(ctx, x, y, 9, 12);
  }
}
function drawAnvilOnly(ctx, n, t) { drawAnvil(ctx, { x: n.x - 50, y: n.y }, t); }
function drawRibbon(ctx, n, t) {
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ell(ctx, n.x, n.y, 18, 6);
  ctx.fillStyle = '#ffd56b'; ctx.save(); ctx.translate(n.x, n.y - 6); ctx.rotate(Math.sin(t) * 0.1);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(14, -9); ctx.lineTo(13, 8); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-14, -9); ctx.lineTo(-13, 8); ctx.closePath(); ctx.fill(); circ(ctx, 0, 0, 3);
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,200,100,${0.15 + Math.sin(t * 2) * 0.08})`; circ(ctx, n.x, n.y - 8, 24); ctx.restore();
}

window.addEventListener('load', () => G.init());
