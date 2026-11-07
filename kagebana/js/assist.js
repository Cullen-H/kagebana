'use strict';
/* =====================================================================
   KAGEBANA — assist.js
   Shard Assist. Akane's shard already pulls her allies back from death;
   Ponta notches the thread so it can pull one of them in for a moment.
   Pick a partner at the Altar of Heroes, press the assist key in a run,
   and they appear, do one move, and go. Then the thread has to cool.

   Unlocked by Ponta's talk after his rescue (S.talked.pt_assist).
   Some heroes have their own move; everyone else uses Thread Strike.
   Kuroto isn't on the thread at all. He comes because Akane remembers him.
   ===================================================================== */

const ASSIST_CD = 30;
DEFAULT_BINDS.assist = ['KeyR', 'KeyI'];
BIND_LABELS.assist = 'Shard Assist';
Input.assistHit = function () { return this.actHit('assist') || this.padPressed(4); };
// LB was a second ultimate button; it calls the assist now
Input.ultHit = function () { return this.actHit('ult') || this.padPressed(5); };
// saves made before the assist key existed have no binding for it
Input.binds = function () {
  const B = (typeof SAVE !== 'undefined' && SAVE.data && SAVE.data.settings.binds) || DEFAULT_BINDS;
  if (!B.assist) B.assist = DEFAULT_BINDS.assist.slice();
  return B;
};

const ASSIST_BARKS = {
  akane: ['Behind me!', 'Got it!'], rei: ['Stand back!', 'One punch!'], yuki: ['Hold still.', 'Covering you.'],
  kaito: ['Reaping.', 'Duck.'], sekka: ['Hold your breath.', 'One second is plenty.'],
  kuroto: ['Move.', 'Tch. Again?'],
  sayo: ['Sit. Stay.', 'Sealed!'], tetsu: ['One is enough.', 'Hm.'],
  sora: ['Special delivery!', 'Sign here!'], daigo: ['Load! Fire!', 'Cover your ears!'],
  isamu: ['Heaven!', 'And earth!'], hibiki: ['Follow the beat!', 'Encore!'],
  rinne: ['Not today.', 'Return to sender.'], hinome: ['Morning comes!', 'Rise and burn!'],
  raika: ['Feel the drum!', 'Thunder\'s here!'], tsukiyo: ['Out and back.', 'Watch the moon.'],
  mizuha: ['Breathe.', 'Be still.'], kazane: ['Gather round!', 'Wheee!'],
  shuten: ['A toast!', 'Drink up, small fry!'], kogane: ['Lucky you!', 'Heads, I win!'],
};
const ASSIST_KUROTO_FIRST = 'I\'m not on your thread. I just know where you are.';

/* Each move gets the assist actor and a scale for the act and campaign. */
const ASSIST_MOVES = {
  akane: { name: 'Crescent Cut', jp: '三日月', fn(A, k) {
    const t = G.assistTarget(A, 520), a = t ? angTo(A, t) : P.aim, len = t ? clamp(dist(A, t) + 140, 260, 560) : 380;
    const x0 = A.x, y0 = A.y;
    G.moveSafe(A, Math.cos(a) * len, Math.sin(a) * len); A.aim = a;
    G.hitLine(x0, y0, A.x, A.y, 70, 95 * k, { slot: 'misc', noProc: true, kb: 260 });
    G.fxLine(x0, y0 - 14, A.x, A.y - 14, '#ff3355', 16, 0.3); SFX.play('heavy'); G.shake(5);
  } },
  rei: { name: 'Meteor Fist', jp: '流星拳', fn(A, k) {
    const t = G.assistTarget(A, 480), p = t ? G.clampToArena(t.x, t.y, 30) : A;
    G.fxLine(A.x, A.y - 60, p.x, p.y - 20, '#ffb04d', 8, 0.25); A.x = p.x; A.y = p.y + 4;
    G.hitCircle(A.x, A.y, 150, 125 * k, { slot: 'misc', noProc: true, kb: 380, stun: 0.6 });
    G.fxRing(A.x, A.y, 160, '#ffb04d', 0.35, 12); G.parts.burst(A.x, A.y, 24, { type: 'smoke', color: '#a89880', min: 80, max: 320, size: 7 });
    SFX.play('boom'); G.shake(10);
  } },
  yuki: { name: 'Frost Volley', jp: '氷雨', fn(A, k) {
    const t = G.assistTarget(A, 900), a = t ? angTo(A, t) : P.aim;
    for (let v = 0; v < 2; v++) G.after(v * 0.2, () => {
      for (let i = -3; i <= 3; i++) G.pProj({ x: A.x, y: A.y - 18, ang: a + i * 0.11, speed: 1100, dmg: 30 * k, slot: 'misc', r: 8, life: 0.9, kind: 'arrow', color: '#9ee7ff', pierce: 2 });
      SFX.play('arrow', 0.5);
    });
  } },
  kaito: { name: 'Reaping Arc', jp: '刈月', fn(A, k) {
    const n = G.hitCircle(A.x, A.y - 10, 180, 85 * k, { slot: 'misc', noProc: true, kb: 200 });
    G.fxSlash({ x: A.x, y: A.y - 14, r: 175, ang: 0, arc: TAU, color: '#b48cff', dur: 0.3, width: 1.5 });
    if (n) P.heal(Math.min(20, n * 4)); SFX.play('slash'); G.shake(6);
  } },
  sekka: { name: 'One Held Second', jp: '一秒', fn(A, k) {
    G.timeStopT = Math.max(G.timeStopT || 0, 1.6); G.timeStopMax = 1.6;
    G.flash('#c8d8ff', 0.5); SFX.play('timestop');
    const t = G.assistTarget(A, 700) || A;
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU, x = t.x + Math.cos(a) * 170, y = t.y - (t.r || 0) + Math.sin(a) * 170;
      G.pProj({ x, y, ang: a + Math.PI, speed: 900, dmg: 20 * k, slot: 'misc', r: 8, life: 0.5, kind: 'knife', color: KNIFE });
    }
  } },
  kuroto: { name: 'Nothing Given', jp: '無手', fn(A, k) {
    G.slow(0.35, 0.6);
    for (let i = 0; i < 4; i++) G.after(0.04 + i * 0.1, () => {
      const t = G.assistTarget(A, 700); if (!t) return;
      G.allyStrike(A, t, (i === 3 ? 110 : 45) * k);
    });
  } },

  sayo: { name: 'Ofuda Seal', jp: '封札', job: 'control', fn(A, k) {
    for (let i = 0; i < 6; i++) G.pProj({ x: A.x, y: A.y - 20, ang: A.aim + (i - 2.5) * 0.4, speed: 620, dmg: 22 * k, slot: 'misc', noProc: true, r: 10, life: 2.2, kind: 'ofuda', color: '#ffe9a8', homing: 7,
      onHit: e => { if (!e.isBoss) e.st.stun = Math.max(e.st.stun, 2); G.parts.burst(e.x, e.y - e.r, 6, { color: '#ffe9a8', min: 40, max: 140 }); } });
    SFX.play('arrow', 0.5);
  } },
  tetsu: { name: 'One Stroke', jp: '一閃', job: 'damage', fn(A, k) {
    const t = G.assistTarget(A, 700), a = t ? angTo(A, t) : P.aim, x2 = A.x + Math.cos(a) * 760, y2 = A.y + Math.sin(a) * 760;
    A.aim = a;
    G.fxLine(A.x, A.y - 14, x2, y2 - 14, 'rgba(255,255,255,0.35)', 2, 0.35);
    G.after(0.3, () => {
      G.hitLine(A.x, A.y - 10, x2, y2 - 10, 60, 190 * k, { slot: 'misc', noProc: true, pierceGuard: true, kb: 120 });
      G.fxLine(A.x, A.y - 14, x2, y2 - 14, '#f4f4ff', 10, 0.25); G.flash('#ffffff', 0.15); SFX.play('heavy'); G.shake(8);
    });
  } },
  sora: { name: 'Midnight Delivery', jp: '深夜便', job: 'damage', fn(A, k) {
    const seen = new Set();
    for (let i = 0; i < 5; i++) G.after(i * 0.09, () => {
      let best = null, bd = i ? 420 : 720;
      for (const e of G.enemies) { if (e.dead || e.spawnT > 0 || e.passive || seen.has(e)) continue; const d = Math.hypot(e.x - A.x, e.y - A.y); if (d < bd) { bd = d; best = e; } }
      if (!best) best = G.boss && !G.boss.dead ? G.boss : null;
      if (!best) return;
      if (!best.isBoss) seen.add(best);
      const p = G.clampToArena(best.x + rand(-30, 30), best.y + 26, 30);
      G.fxLine(A.x, A.y - 14, p.x, p.y - 14, '#ffd36b', 5, 0.2);
      A.x = p.x; A.y = p.y; A.aim = angTo(A, best);
      G.damageEnemy(best, 48 * k, { slot: 'misc', noProc: true, kb: 160, kbAng: A.aim });
      SFX.play('dash', 0.5);
    });
  } },
  daigo: { name: 'Siege Shot', jp: '攻城砲', job: 'damage', fn(A, k) {
    const t = G.assistTarget(A, 900), p = t ? { x: t.x, y: t.y } : G.clampToArena(A.x + Math.cos(P.aim) * 320, A.y + Math.sin(P.aim) * 320, 40);
    SFX.play('heavy', 0.6);
    G.pZone({ x: p.x, y: p.y, r: 130, warn: 0.55, dmg: 150 * k, slot: 'misc', noProc: true, color: '#ffb347', kind: 'cannon', sx: A.x, sy: A.y - 34,
      onFire: z => {
        G.boom(z.x, z.y, 130); G.shake(10);
        for (const e of G.enemiesInRange(z.x, z.y, 200)) if (!e.isBoss) { const a = Math.atan2(e.y - z.y, e.x - z.x); e.vx += Math.cos(a) * 650; e.vy += Math.sin(a) * 650; }
      } });
  } },
  isamu: { name: 'Heaven and Earth', jp: '天地', job: 'control', fn(A, k) {
    const t = G.assistTarget(A, 600), c = t ? { x: t.x, y: t.y - (t.r || 0) * 0.5 } : { x: A.x + Math.cos(P.aim) * 160, y: A.y + Math.sin(P.aim) * 160 };
    const cut = (ang, stun, dmg) => {
      const dx = Math.cos(ang) * 190, dy = Math.sin(ang) * 190;
      G.hitLine(c.x - dx, c.y - dy, c.x + dx, c.y + dy, 64, dmg, { slot: 'misc', noProc: true, kb: 140, stun });
      G.fxLine(c.x - dx, c.y - dy, c.x + dx, c.y + dy, '#9fd0ff', 12, 0.25); SFX.play('slash');
    };
    cut(-Math.PI / 4, 0, 70 * k);
    G.after(0.22, () => { cut(Math.PI / 4, 1.4, 90 * k); G.shake(6); });
  } },
  hibiki: { name: 'Festival Beat', jp: '祭囃子', job: 'control', fn(A, k) {
    assistStep(A, G.assistTarget(A, 700), 120, '#ffb0ea');
    for (let i = 0; i < 4; i++) G.after(i * 0.3, () => {
      const last = i === 3;
      G.hitCircle(A.x, A.y, 260, (last ? 60 : 32) * k, { slot: 'misc', noProc: true, kb: last ? 320 : 120, stun: last ? 1.2 : 0 });
      G.fxRing(A.x, A.y, 270, last ? '#ff6ad5' : '#ffb0ea', 0.3, last ? 12 : 6); SFX.play(last ? 'boom' : 'punch', 0.6);
      if (last) G.shake(7);
    });
  } },
  rinne: { name: 'Mirror Wall', jp: '鏡壁', job: 'support', fn(A, k) {
    const R = 190, tick = n => {
      if (n <= 0 || !G.run) return;
      G.fxRing(P.x, P.y - 16, R, 'rgba(200,230,255,0.55)', 0.12, 3);
      for (const p of G.projs) {
        if (p.team !== 'e' || p.dead || Math.hypot(p.x - P.x, p.y - P.y + 16) > R) continue;
        p.team = 'p'; p.dmg = 40 * k; p.slot = 'misc'; p.noProc = true; p.vx *= -1.2; p.vy *= -1.2; p.hit.clear();
        p.homing = 0; p.orbit = null; p.returning = 0; p.back = false; p.delayAim = undefined; p.turn = 0; p.accel = 0; p.gy = 0; p.life = p.t + 1.5; p.color = '#cfe8ff';
        G.parts.burst(p.x, p.y, 4, { color: '#cfe8ff', min: 40, max: 120 });
      }
      G.after(0.05, () => tick(n - 1));
    };
    SFX.play('parry'); tick(40);
  } },
  hinome: { name: 'Sunrise Sweep', jp: '日の出', job: 'damage', fn(A, k) {
    const t = G.assistTarget(A, 700); assistStep(A, t, 200, '#ff7a3d'); const a = t ? angTo(A, t) : P.aim;
    A.aim = a;
    for (const e of G.enemiesInRange(A.x, A.y, 380)) if (Math.abs(angDiff(a, angTo(A, e))) < 0.8) { G.damageEnemy(e, 55 * k, { slot: 'misc', noProc: true, kb: 180, kbAng: a }); G.burn(e, 14 * k); }
    G.fxSlash({ x: A.x, y: A.y - 14, r: 370, ang: a, arc: 1.6, color: '#ff7a3d', dur: 0.35, width: 2 });
    const d0 = t ? Math.min(dist(A, t), 300) : 180, gx = A.x + Math.cos(a) * d0, gy = A.y + Math.sin(a) * d0;
    G.pZone({ x: gx, y: gy, r: 120, warn: 0.05, dur: 3, field: true, tick: 0, dmg: 10 * k, slot: 'misc', noProc: true, quiet: true, color: '#ff7a3d', kind: 'fire' });
    for (let i = 0; i < 6; i++) G.after(i * 0.5, () => G.parts.burst(gx + rand(-90, 90), gy + rand(-60, 60), 6, { type: 'glow', color: '#ff9a4d', min: 20, max: 90, size: 4 }));
    SFX.play('burn'); G.shake(5);
  } },
  raika: { name: 'Chain Lightning', jp: '連雷', job: 'damage', fn(A, k) {
    const t = G.assistTarget(A, 700); if (!t) return;
    G.fxBolt(A.x, A.y - 30, t.x, t.y - (t.r || 0), '#ffe14d');
    G.damageEnemy(t, 60 * k, { slot: 'misc', noProc: true, color: '#ffe14d' });
    G.chain(t, 42 * k, 6); G.shake(5);
  } },
  tsukiyo: { name: 'Crescent Return', jp: '還月', job: 'damage', fn(A, k) {
    const t = G.assistTarget(A, 700), a = t ? angTo(A, t) : P.aim;
    G.pProj({ x: A.x, y: A.y - 18, ang: a, speed: 820, dmg: 55 * k, slot: 'misc', noProc: true, r: 24, life: 3, kind: 'chakram', color: '#b49cff', pierce: 99, returning: t ? clamp(dist(A, t) + 120, 300, 640) : 460,
      onHit: e => { e.st.curse = Math.max(e.st.curse, 4); } });
    SFX.play('slash', 0.6);
  } },
  mizuha: { name: 'Still Water', jp: '止水', job: 'support', fn(A, k) {
    const x = P.x, y = P.y, R = 170, heal = P.stats.maxHp * 0.15 / 8;
    const tick = n => {
      if (n <= 0 || !G.run) return;
      G.fxRing(x, y, R, '#6ee7ff', 0.5, 4);
      if (Math.hypot(P.x - x, P.y - y) < R) P.heal(heal, true);
      for (const e of G.enemiesInRange(x, y, R)) G.chill(e, 1);
      G.after(0.5, () => tick(n - 1));
    };
    G.parts.burst(x, y, 20, { type: 'glow', color: '#9ef0ff', min: 40, max: 200, size: 3 });
    SFX.play('freeze', 0.5); tick(8);
  } },
  kazane: { name: 'Gale Gather', jp: '集風', job: 'control', fn(A, k) {
    const t = G.assistTarget(A, 600), c = t ? { x: t.x, y: t.y } : { x: A.x + Math.cos(P.aim) * 200, y: A.y + Math.sin(P.aim) * 200 };
    for (const e of G.enemiesInRange(c.x, c.y, 360)) {
      if (e.isBoss) continue;
      const a = Math.atan2(c.y - e.y, c.x - e.x), d = Math.hypot(c.x - e.x, c.y - e.y);
      e.vx += Math.cos(a) * d * 4.2; e.vy += Math.sin(a) * d * 4.2;
    }
    G.fxRing(c.x, c.y, 340, '#7dffb0', 0.35, 5); SFX.play('dash', 0.8);
    G.after(0.35, () => {
      G.hitCircle(c.x, c.y, 150, 85 * k, { slot: 'misc', noProc: true, kb: 60 });
      G.fxSlash({ x: c.x, y: c.y - 14, r: 145, ang: 0, arc: TAU, color: '#7dffb0', dur: 0.3, width: 1.6 }); SFX.play('slash'); G.shake(6);
    });
  } },
  shuten: { name: 'Oni\'s Toast', jp: '鬼の盃', job: 'support', fn(A, k) {
    const t = G.assistTarget(A, 700); assistStep(A, t, 200, '#ffb0c8'); const a = t ? angTo(A, t) : P.aim;
    A.aim = a;
    for (const e of G.enemiesInRange(A.x, A.y, 400)) if (Math.abs(angDiff(a, angTo(A, e))) < 0.75) {
      G.damageEnemy(e, 30 * k, { slot: 'misc', noProc: true, color: '#ffb0c8' });
      e.st.sake = 4; G.chill(e, 2);
    }
    for (let i = 0; i < 30; i++) { const s = a + rand(-0.7, 0.7); G.parts.add({ x: A.x, y: A.y - 20, vx: Math.cos(s) * rand(260, 700), vy: Math.sin(s) * rand(260, 700), life: 0.5, t: 0, size: 4, color: '#ffd9e6', type: 'glow', drag: 3, grav: 0, rot: 0, vr: 0 }); }
    SFX.play('splash', 0.6);
  } },
  kogane: { name: 'Lucky Toss', jp: '福投げ', job: 'support', fn(A, k) {
    G.run.luckyT = 5;
    for (let i = 0; i < 10; i++) G.pProj({ x: A.x, y: A.y - 20, ang: A.aim + rand(-0.9, 0.9), speed: rand(500, 800), dmg: 26 * k, slot: 'misc', noProc: true, r: 9, life: 0.9, kind: 'coin', color: '#ffcf40', homing: 3 });
    G.text(A.x, A.y - 60, 'Lucky! ×5s', '#ffcf40', 16); SFX.play('coin');
  } },
};
// what the Altar shows under each move
for (const [id, j] of Object.entries({ akane: 'damage', rei: 'control', yuki: 'damage', kaito: 'support', sekka: 'control', kuroto: 'damage' })) ASSIST_MOVES[id].job = j;
const ASSIST_JOB = { damage: ['Damage', '#ff7a8a'], control: ['Control', '#8fd0ff'], support: ['Support', '#9fe8a8'] };
const ASSIST_GENERIC = { name: 'Thread Strike', jp: '糸打ち', job: 'damage', fn(A, k) {
  const col = HEROES[A.cast].pal.scarf, t = G.assistTarget(A, 520);
  if (t) { const p = G.clampToArena(t.x - Math.cos(angTo(A, t)) * 40, t.y - Math.sin(angTo(A, t)) * 40, 30); G.fxLine(A.x, A.y - 14, p.x, p.y - 14, col, 10, 0.25); A.x = p.x; A.y = p.y; A.aim = angTo(A, t); }
  G.hitCircle(A.x, A.y - 10, 130, 80 * k, { slot: 'misc', noProc: true, kb: 240 });
  G.fxSlash({ x: A.x, y: A.y - 14, r: 125, ang: A.aim, arc: TAU, color: col, dur: 0.25, width: 1.3 });
  SFX.play('slash'); G.shake(5);
} };
/* Close the gap to a target before a short-range move, ending about keep px away. */
function assistStep(A, t, keep, col) {
  if (!t || dist(A, t) <= keep + 40) return;
  const a = angTo(t, A), p = G.clampToArena(t.x + Math.cos(a) * keep, t.y + Math.sin(a) * keep, 30);
  G.fxLine(A.x, A.y - 14, p.x, p.y - 14, col, 6, 0.25); A.x = p.x; A.y = p.y; A.aim = angTo(A, t);
}
function assistMove(id) { return ASSIST_MOVES[id] || ASSIST_GENERIC; }

function drawAssist(ctx, n, t) {
  const H = HEROES[n.cast], lx = Math.cos(n.aim), ly = Math.sin(n.aim);
  const pose = { x: n.x, y: n.y, aim: n.aim, t, weapon: 0, form: 0, lookX: lx, lookY: ly, bankaiT: 0 };
  const hx = n.x + lx * 14, hy = n.y - 22 + ly * 6, wa = n.aim + 0.6;
  const weapon = () => { try { H.drawWeapon(ctx, pose, hx, hy, wa); } catch (e) { /* some weapons need a real player */ } };
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(H.pal.scarf, 0.18); circ(ctx, n.x, n.y - 20, 34); ctx.restore();
  if (ly < -0.3) weapon();
  drawChar(ctx, { x: n.x, y: n.y, s: (H.size || 13), lookX: lx, lookY: ly, pal: H.pal, t, moving: false, hair: H.hair, acc: H.acc, mood: 'angry' });
  if (ly >= -0.3) weapon();
}

Object.assign(G, {
  assistUnlocked() { return !!(SAVE.data.talked && SAVE.data.talked.pt_assist); },
  /* The partner for this run, or null. */
  assistId() {
    const S = SAVE.data, id = S.assist;
    if (!this.assistUnlocked() || !id || !HEROES[id] || !S.heroes[id] || !S.heroes[id].unlocked) return null;
    const hero = this.run ? this.run.hero : S.hero;
    return id === hero ? null : id;
  },
  assistTarget(A, r) {
    const b = this.boss && !this.boss.dead && Math.hypot(this.boss.x - A.x, this.boss.y - A.y) < r + 300 ? this.boss : null;
    return b || this.nearestEnemy(A.x, A.y, r) || this.nearestEnemy(P.x, P.y, r);
  },
  updateAssist(dt) {
    const run = this.run; if (!run || !P) return;
    if (run.assistCd === undefined) run.assistCd = 0;
    run.assistCd = Math.max(0, run.assistCd - dt);
    if (run.luckyT > 0) run.luckyT -= dt;
    const A = this.assistActor;
    if (A) {
      A.life -= dt;
      if (A.life < 0.35) A.alpha = Math.max(0, A.life / 0.35);
      if (A.life <= 0) { this.npcs = this.npcs.filter(n => n !== A); this.assistActor = null; }
    }
    if (!Input.assistHit() || UI.modal || this.controlLocked || P.hp <= 0) return;
    const id = this.assistId();
    if (!id) return;
    if (run.assistCd > 0 || A) { SFX.play('uino'); return; }
    this.callAssist(id);
  },
  callAssist(id) {
    const run = this.run, mv = assistMove(id);
    run.assistCd = ASSIST_CD;
    const side = Math.cos(P.aim) > 0 ? -1 : 1;
    const p = this.clampToArena(P.x + side * 70, P.y + 10, 30);
    const A = { id: 'assist', assist: true, scenery: true, cast: id, x: p.x, y: p.y, r: 16, aim: P.aim, life: 1.2, alpha: 1, prompt: '', draw: drawAssist, interact: () => {} };
    this.assistActor = A; this.npcs.push(A);
    this.parts.burst(A.x, A.y - 20, 20, { type: 'glow', color: '#c8a8ff', min: 80, max: 300, size: 3 });
    this.fxLine(P.x, P.y - 20, A.x, A.y - 20, '#c8a8ff', 3, 0.4);
    SFX.play('rift', 0.4);
    const bark = id === 'kuroto' && !run.kurotoAssisted ? ASSIST_KUROTO_FIRST : pick(ASSIST_BARKS[id] || ['With you!', 'I\'m here!']);
    if (id === 'kuroto') run.kurotoAssisted = true;
    this.say(A, bark, 1.6);
    this.cutin(id, mv.name, mv.jp, 'Shard Assist');
    const k = this.actMult() * (this.camp().hpMult || 1);
    this.after(0.25, () => { if (this.assistActor === A) mv.fn(A, k); });
  },
});

/* ---------------- Ponta explains it ---------------- */
TALKS.ponta_t.unshift({ id: 'pt_assist', cond: s => s.flags.t_forge, lines: [
  ['ponta', 'Moonbound. Before you run off again. That scrap at the rift, with the two of them? You fought better with someone next to you.'],
  ['ponta', 'That shard of yours already drags your friends back from the dead. I hammered a notch in the thread, so now it can drag one of them over to you for a moment. Don\'t ask how. I don\'t know how.'],
  ['$h', 'How do I use it?'],
  ['ponta', 'Pick a partner at the Altar of Heroes. When it gets bad, call them. They\'ll hit something and go home. Then the thread needs to cool before you pull on it again.'],
  ['ponta', 'And your friend with the terrible grip... he\'s not on the thread at all. ...He\'ll come anyway, won\'t he.'],
] });
// the forge scene ends with Ponta explaining the assist (see tokoyoHubScene), so nobody misses it
STORY4.forge.push(...TALKS.ponta_t[0].lines);
G.assistHint = function () { UI.toast(`Shard Assist unlocked. Choose a partner at the Altar of Heroes, then press ${keyName(Input.binds().assist[0])} in a fight.`, '#c8a8ff', 8); };
