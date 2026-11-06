'use strict';
/* =====================================================================
   KAGEBANA — rift.js
   The rift entrance: Sekka and Kuroto burst through mid-fight, the player
   picks a side, and fights the other one with the chosen one as an ally.

   The hub normally can't hurt the player and has no run, so this fight
   runs in its own small mode (G.hubFight). It can't be lost: going down
   makes the ally drag you back up, and the rival breaks off at low HP
   instead of dying, so the normal boss-defeat path never runs.
   ===================================================================== */

const RIVAL_FLOOR = 0.15; // the rival breaks off at this fraction of HP
const TAG_SECONDS = 18;   // time for the tag meter to fill

const ALLY_LINES = {
  sekka: { hit: ['Left. Now.', 'I have seen this move already.', 'He telegraphs. Watch his shoulder.', 'Do keep up.'], down: 'Get up. I have held on far longer than this.', tag: 'Hold your breath.' },
  kuroto: { hit: ['She blinks before she throws.', 'Stay close. Knives hate close.', 'Tch. Faster, shard-kid.', 'Don\'t stop moving.'], down: 'Get up, shard-kid. I\'m not doing this alone.', tag: 'Move.' },
};

/* ---------------- the rival bosses ---------------- */
Object.assign(BOSSES, {
  duel_sekka: { id: 'duel_sekka', duel: true, name: 'Sekka Tokimiya', title: 'The Stilled Hour', jp: '止まった刻 時宮雪華', hp: 7000, r: 22, spd: 190, dmg: 13, draw: 'sekkaB', col: '#c8a050',
    pal: HEROES.sekka.pal, hair: 'hime', acc: 'ribbon',
    desc: 'She came through the rift with knives already in the air. She is not telling you everything.',
    phases: [0.62, 0.36], patterns: [['knifeFan', 'hangingKnives'], ['knifeFan', 'hangingKnives', 'stoppedHour'], ['knifeFan', 'hangingKnives', 'stoppedHour', 'stoppedHour']] },
  duel_kuroto: { id: 'duel_kuroto', duel: true, name: 'Kuroto Amagiri', title: 'The Shardless', jp: '無片 天霧玄人', hp: 7000, r: 24, spd: 235, dmg: 16, draw: 'kurotoB', col: '#8a8a94',
    pal: HEROES.kuroto.pal, hair: 'short', acc: null,
    desc: 'He came through the rift swinging. No shard, no blessing, and no intention of explaining himself.',
    phases: [0.62, 0.36], patterns: [['spearRush', 'chainLash', 'staffSpin'], ['spearRush', 'chainLash', 'staffSpin', 'ambush'], ['ambush', 'spearRush', 'chainLash', 'staffSpin', 'ambush']] },
});

/* ---------------- how the rivals look ---------------- */
const rivalWeaponPose = (e, t, weapon) => ({ x: e.x, y: e.y, aim: e.face, t, weapon, lookX: Math.cos(e.face), lookY: Math.sin(e.face) });
Object.assign(EDRAW, {
  sekkaB(ctx, e, t, f) { bossChar(ctx, e, t, f, 1.05, (c, x, y, a) => HEROES.sekka.drawWeapon(c, rivalWeaponPose(e, t, 0), x, y, a)); },
  kurotoB(ctx, e, t, f) { bossChar(ctx, e, t, f, 1.1, (c, x, y, a) => HEROES.kuroto.drawWeapon(c, rivalWeaponPose(e, t, e.weapon || 0), x, y, a)); },
});

/* ---------------- how the rivals fight ---------------- */
const KNIFE = '#dfe8f0', SPEAR = '#e8e0ff', CHAIN = '#8a8a94';
function ringOfKnives(e, n, radius, delay, gap) {
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + gap;
    G.eProj({ x: P.x + Math.cos(a) * radius, y: P.y - 16 + Math.sin(a) * radius, ang: a, speed: 0, dmg: e.dmg, r: 8, color: KNIFE, kind: 'knife', life: delay + 2.2, delayAim: delay, aimSpeed: 560 });
  }
}
Object.assign(BOSS_PAT, {
  knifeFan(e) {
    const volleys = 2 + e.phase;
    for (let v = 0; v < volleys; v++) {
      G.after(v * 0.38, () => {
        const a = angTo(e, P);
        for (let i = -2; i <= 2; i++) G.eProj({ x: e.x, y: e.y - 18, ang: a + i * 0.17, speed: 500, dmg: e.dmg, r: 8, color: KNIFE, kind: 'knife', life: 2.2 });
        SFX.play('arrow', 0.5);
      }, e);
    }
    e.busy = 0.6 + volleys * 0.38;
  },
  hangingKnives(e) {
    G.say(e, pick(['Stay exactly there.', 'One second is plenty.']));
    SFX.play('tick');
    ringOfKnives(e, 10 + e.phase * 3, 250, 1.15, rand(0, TAU));
    e.busy = 1.5;
  },
  stoppedHour(e) {
    G.say(e, 'Stop.', 1.6);
    G.flash('#c8d8ff', 0.5); SFX.play('timestop');
    P.slowT = 1.3;
    ringOfKnives(e, 16, 300, 1.5, rand(0, TAU));
    ringOfKnives(e, 16, 420, 1.9, rand(0, TAU));
    e.busy = 2.5;
  },
  spearRush(e) {
    e.weapon = 0;
    const n = 2 + e.phase;
    let t = 0;
    for (let i = 0; i < n; i++) {
      G.after(t, () => {
        const a = angTo(e, P), len = clamp(dist(e, P) + 150, 220, 540);
        e.face = a;
        G.addZone({ shape: 'line', x: e.x, y: e.y, ang: a, len, w: 54, warn: 0.5, dmg: e.dmg * 1.2, owner: e, color: SPEAR,
          onFire: () => { const x0 = e.x, y0 = e.y; G.moveSafe(e, Math.cos(a) * len, Math.sin(a) * len); G.fxLine(x0, y0, e.x, e.y, SPEAR, 12, 0.22); SFX.play('slash'); G.shake(4); } });
      }, e);
      t += 0.68;
    }
    e.busy = t + 0.25;
  },
  chainLash(e) {
    e.weapon = 2;
    const a0 = angTo(e, P);
    for (const off of e.phase ? [-0.55, 0, 0.55] : [-0.3, 0.3]) {
      const a = a0 + off, len = 620, x0 = e.x, y0 = e.y;
      G.addZone({ shape: 'line', x: x0, y: y0, ang: a, len, w: 34, warn: 0.65, dmg: e.dmg, owner: e, color: CHAIN,
        onFire: () => {
          G.fxLine(x0, y0, x0 + Math.cos(a) * len, y0 + Math.sin(a) * len, CHAIN, 5, 0.22); SFX.play('clang', 0.5);
          // the chain yanks you toward him if it catches you
          if (P.iframes < 0.7 && P.hurtFlash > 0 && segDist(P.x, P.y, x0, y0, x0 + Math.cos(a) * len, y0 + Math.sin(a) * len) < 50) {
            const back = angTo(P, e); G.moveSafe(P, Math.cos(back) * 150, Math.sin(back) * 150);
          }
        } });
    }
    e.busy = 1.25;
  },
  staffSpin(e) {
    e.weapon = 1;
    G.addZone({ shape: 'circle', x: e.x, y: e.y, r: 150, warn: 0.6, dmg: e.dmg * 1.3, owner: e, follow: true, color: '#c8c8c8',
      onFire: z => { G.fxSlash({ x: z.x, y: z.y - 14, r: 145, ang: 0, arc: TAU, color: '#c8c8c8', dur: 0.28, width: 1.3 }); SFX.play('heavy'); G.shake(6); } });
    if (e.phase >= 1) G.after(0.5, () => G.addZone({ shape: 'ring', x: e.x, y: e.y, r: 150, r2: 285, warn: 0.5, dmg: e.dmg * 1.1, owner: e, color: '#c8c8c8' }), e);
    e.busy = 1.35;
  },
  ambush(e) {
    G.say(e, 'Behind you.', 1.2);
    e.weapon = 0;
    e.alpha = 0.25;
    const a = P.aim + Math.PI, p = G.clampToArena(P.x + Math.cos(a) * 60, P.y + Math.sin(a) * 60, 40);
    G.addZone({ shape: 'circle', x: p.x, y: p.y, r: 105, warn: 0.7, dmg: e.dmg * 1.6, owner: e, color: SPEAR,
      onFire: z => { G.ghostE(e, e.x, e.y); e.x = z.x; e.y = z.y; e.alpha = 1; G.fxSlash({ x: z.x, y: z.y - 14, r: 100, ang: rand(0, TAU), arc: 2.4, color: SPEAR, dur: 0.2, width: 1.2 }); SFX.play('heavy'); G.shake(6); } });
    e.busy = 1.2;
  },
});

/* ---------------- characters on the field during the scene ---------------- */
function drawFighter(ctx, n, t) {
  const c = CAST[n.cast], H = HEROES[n.cast];
  const lx = Math.cos(n.aim), ly = Math.sin(n.aim);
  const hx = n.x + lx * 14, hy = n.y - 22 + ly * 6, wa = n.aim + 0.6 + (n.swing > 0 ? Math.sin(t * 24) * 0.6 : 0);
  const pose = { x: n.x, y: n.y, aim: n.aim, t, weapon: n.weapon || 0, lookX: lx, lookY: ly };
  if (ly < -0.3) H.drawWeapon(ctx, pose, hx, hy, wa);
  drawChar(ctx, { x: n.x, y: n.y, s: 13, lookX: lx, lookY: ly, pal: c.pal, t, moving: n.moving, hair: c.hair, acc: c.acc, mood: 'angry' });
  if (ly >= -0.3) H.drawWeapon(ctx, pose, hx, hy, wa);
}
function makeFighter(id, x, y, aim) {
  return { id, fighter: true, cast: id, x, y, r: 18, aim, vx: 0, vy: 0, moving: false, swing: 0, name: HEROES[id].name, prompt: '', draw: drawFighter, interact: () => {} };
}

Object.assign(G, {
  hubFight: null,

  /* ---------------- the entrance ---------------- */
  cutsceneNewcomers() {
    this.controlLocked = true;
    const RX = 1000, RY = 600;
    let sekka, kuroto;
    const face = () => { sekka.aim = angTo(sekka, kuroto); kuroto.aim = angTo(kuroto, sekka); };
    const launch = () => {
      kuroto = makeFighter('kuroto', RX, RY + 10, Math.PI);
      sekka = makeFighter('sekka', RX, RY + 10, 0);
      this.npcs.push(kuroto, sekka);
      kuroto.vx = -1350; kuroto.vy = 160;
      sekka.vx = 1050; sekka.vy = 340;
      this.flash('#5b2b8a', 0.8); this.shake(26); this.slow(0.35, 0.45);
      SFX.play('rift'); SFX.play('boom'); SFX.play('heavy');
      this.fxRing(RX, RY, 300, '#c8a8ff', 0.5, 14);
      this.parts.burst(RX, RY, 50, { type: 'glow', color: '#c8a8ff', min: 180, max: 700, size: 4 });
      this.fxLine(RX, RY, RX - 220, RY + 26, '#e8e0ff', 16, 0.35);
      this.fxLine(RX, RY, RX + 170, RY + 55, '#c8a050', 16, 0.35);
    };
    const clash = (big) => {
      const mx = (sekka.x + kuroto.x) / 2 + rand(-40, 40), my = (sekka.y + kuroto.y) / 2 + rand(-40, 40);
      for (const n of [sekka, kuroto]) n.dashTo = { x0: n.x, y0: n.y, x1: mx, y1: my, t: 0, d: 0.13 };
      kuroto.weapon = (kuroto.weapon + 1 || 1) % 3;
      this.fxLine(kuroto.x, kuroto.y - 14, mx, my - 14, '#e8e0ff', 10, 0.2);
      for (let i = -1; i <= 1; i++) { const a = angTo(sekka, { x: mx, y: my }) + i * 0.16; this.fxLine(sekka.x, sekka.y - 18, sekka.x + Math.cos(a) * 240, sekka.y - 18 + Math.sin(a) * 240, KNIFE, 3, 0.16); }
      SFX.play('dash');
      this.after(0.13, () => {
        this.shake(big ? 22 : 12); this.stop(big ? 0.13 : 0.07); this.flash('#ffffff', big ? 0.5 : 0.22);
        SFX.play('clang'); SFX.play('heavy');
        this.fxRing(mx, my - 14, big ? 170 : 90, '#ffffff', 0.25, 8);
        this.fxSlash({ x: mx, y: my - 14, r: big ? 110 : 70, ang: rand(0, TAU), arc: 2.6, color: '#e8e0ff', dur: 0.18, width: 1.2 });
        this.parts.burst(mx, my - 14, big ? 32 : 16, { color: '#fff3b0', min: 120, max: 520, size: 2 });
        const a = Math.atan2(kuroto.y - sekka.y, kuroto.x - sekka.x), v = big ? 950 : 750;
        kuroto.vx = Math.cos(a) * v; kuroto.vy = Math.sin(a) * v;
        sekka.vx = -Math.cos(a) * v; sekka.vy = -Math.sin(a) * v;
        kuroto.swing = sekka.swing = 0.3;
      });
    };
    this.runScript([
      { cam: [1000, 600], fn: () => { SFX.play('rift', 0.6); this.shake(8); }, wait: 1.2 },
      { fn: () => { SFX.play('roar'); this.shake(16); this.flash('#2a1040', 0.4); }, wait: 0.5 },
      { fn: launch, wait: 0.75 },
      { fn: () => { face(); clash(); }, wait: 0.55 },
      { fn: () => { face(); clash(); }, wait: 0.5 },
      { fn: () => { face(); clash(true); }, wait: 0.9 },
      { fn: face, lines: STORY3.newcomers, pre: 0.1 },
      { fn: () => { face(); clash(); }, wait: 0.75 },
      { fn: face, lines: STORY3.newcomersAccuse, pre: 0.1 },
    ], () => {
      this.controlLocked = true;
      UI.newcomerChoice(id => this.startHubFight(id));
    });
  },

  /* ---------------- the fight ---------------- */
  startHubFight(allyId) {
    const rivalId = allyId === 'sekka' ? 'kuroto' : 'sekka';
    const ally = this.npcs.find(n => n.fighter && n.id === allyId);
    const old = this.npcs.find(n => n.fighter && n.id === rivalId);
    this.npcs = this.npcs.filter(n => n !== old);
    this.enemies = []; // the training dummy has no business here
    const boss = this.spawnEnemy('duel_' + rivalId, old.x, old.y, { noSpawn: true, hpMult: 1, dmgMult: 1, spdMult: 1 });
    boss.intro = 1.2; boss.scriptedFloor = RIVAL_FLOOR; boss.weapon = old.weapon || 0;
    this.boss = boss; UI.bossBar(boss);
    this.hubFight = { allyId, rivalId, ally, boss, tag: 0, cd: 1, skillCd: 5, barkCd: 6, strafe: 1 };
    P.hp = P.stats.maxHp; P.invuln = 1.2;
    this.controlLocked = false;
    Music.cur = null; Music.play('boss');
    UI.banner('TAG TEAM', HEROES[allyId].name.split(' ')[0] + ' at your side', 'boss');
  },
  updateFighters(dt) {
    for (const n of this.npcs) {
      if (!n.fighter) continue;
      n.swing = Math.max(0, n.swing - dt);
      if (n.dashTo) {
        const D = n.dashTo; D.t += dt;
        const k = Math.min(1, D.t / D.d);
        n.x = lerp(D.x0, D.x1, k); n.y = lerp(D.y0, D.y1, k); n.moving = true;
        if (k >= 1) n.dashTo = null;
        continue;
      }
      n.moving = Math.abs(n.vx) + Math.abs(n.vy) > 40;
      if (n.moving) {
        this.moveSafe(n, n.vx * dt, n.vy * dt);
        const k = Math.pow(0.002, dt); n.vx *= k; n.vy *= k;
        if (Math.random() < 0.5) this.parts.add({ x: n.x, y: n.y, vx: rand(-40, 40), vy: -rand(10, 60), life: 0.4, t: 0, size: 4, color: '#555', type: 'smoke', drag: 1, grav: 0, rot: 0, vr: 0 });
      } else { n.vx = 0; n.vy = 0; }
    }
  },
  updateHubFight(dt) {
    const F = this.hubFight, A = F.ally, b = F.boss;
    if (!F || b.dead) return;
    if (this.timeStopT > 0) { A.aim = angTo(A, b); return; }
    F.tag = Math.min(100, F.tag + dt * 100 / TAG_SECONDS);
    F.cd -= dt; F.skillCd -= dt; F.barkCd -= dt;
    A.aim = angTo(A, b);
    if (F.barkCd <= 0) { F.barkCd = rand(9, 15); this.say(A, pick(ALLY_LINES[F.allyId].hit), 2.4); }
    if (F.allyId === 'sekka') this.allySekka(F, A, b, dt);
    else this.allyKuroto(F, A, b, dt);
    if (F.tag >= 100 && Input.interactHit() && !UI.modal) this.tagAttack(F);
  },
  allyWalk(A, a, spd, dt) { this.moveSafe(A, Math.cos(a) * spd * dt, Math.sin(a) * spd * dt); A.moving = true; },
  allySekka(F, A, b, dt) {
    const d = dist(A, b);
    if (Math.random() < dt * 0.4) F.strafe *= -1;
    if (d > 380) this.allyWalk(A, A.aim, 290, dt);
    else if (d < 260) this.allyWalk(A, A.aim + Math.PI, 290, dt);
    else this.allyWalk(A, A.aim + Math.PI / 2 * F.strafe, 170, dt);
    if (F.cd <= 0) {
      F.cd = 0.85; A.swing = 0.15;
      for (let i = -1; i <= 1; i++) this.pProj({ x: A.x, y: A.y - 18, ang: A.aim + i * 0.1, speed: 1000, dmg: 7, slot: 'misc', r: 7, life: 0.8, kind: 'knife', color: KNIFE });
      SFX.play('arrow', 0.25);
    }
    if (F.skillCd <= 0) {
      F.skillCd = 9;
      this.bubbles.push({ x: b.x, y: b.y, r: 165, t: 0, dur: 3.5 });
      this.text(b.x, b.y - 80, 'SLOWED', '#c8d8ff', 14);
      SFX.play('tick');
    }
  },
  allyKuroto(F, A, b, dt) {
    const d = dist(A, b);
    if (d > b.r + 70) this.allyWalk(A, A.aim, 320, dt);
    else this.allyWalk(A, A.aim + Math.PI / 2 * F.strafe, 110, dt);
    if (Math.random() < dt * 0.5) F.strafe *= -1;
    if (F.cd <= 0 && d < b.r + 130) {
      F.cd = 0.42; A.swing = 0.15;
      const x2 = A.x + Math.cos(A.aim) * 110, y2 = A.y + Math.sin(A.aim) * 110;
      this.hitLine(A.x, A.y, x2, y2, 44, 10, { slot: 'misc', noProc: true });
      this.fxLine(A.x, A.y - 14, x2, y2 - 14, SPEAR, 5, 0.1);
      SFX.play('slash', 0.3);
    }
    if (F.skillCd <= 0) {
      F.skillCd = 7.5;
      this.allyStrike(A, b, 38);
    }
  },
  /* Kuroto's vanish-and-strike, shared by his normal rhythm and his tag attack. */
  allyStrike(A, b, dmg) {
    const a = rand(0, TAU);
    this.parts.burst(A.x, A.y - 14, 8, { type: 'smoke', color: '#333', min: 30, max: 120, size: 5 });
    const p = this.clampToArena(b.x + Math.cos(a) * (b.r + 30), b.y + Math.sin(a) * (b.r + 30), 30);
    A.x = p.x; A.y = p.y; A.aim = angTo(A, b); A.swing = 0.2;
    this.damageEnemy(b, dmg, { slot: 'misc', noProc: true, pierceGuard: true });
    this.fxSlash({ x: b.x, y: b.y - 14, r: 64, ang: A.aim, arc: 2, color: SPEAR, dur: 0.18, width: 1.1 });
    SFX.play('heavy', 0.7);
  },
  tagAttack(F) {
    F.tag = 0;
    const A = F.ally, b = F.boss;
    P.invuln = Math.max(P.invuln, 1.5);
    this.say(A, ALLY_LINES[F.allyId].tag, 1.6);
    if (F.allyId === 'sekka') {
      this.cutin('sekka', 'One Held Second', '一秒', 'Tag Attack');
      this.timeStopT = 2.6; this.timeStopMax = 2.6;
      this.flash('#c8d8ff', 0.6); SFX.play('timestop');
      for (let i = 0; i < 20; i++) {
        const a = i / 20 * TAU, x = b.x + Math.cos(a) * 170, y = b.y - b.r + Math.sin(a) * 170;
        this.pProj({ x, y, ang: a + Math.PI, speed: 900, dmg: 22, slot: 'misc', r: 8, life: 0.5, kind: 'knife', color: KNIFE });
      }
    } else {
      this.cutin('kuroto', 'Nothing Given', '無手', 'Tag Attack');
      this.slow(0.35, 0.9); this.flash('#ffffff', 0.3);
      for (let i = 0; i < 6; i++) this.after(0.05 + i * 0.09, () => { if (this.hubFight) this.allyStrike(A, b, i === 5 ? 170 : 45); });
    }
  },
  /* Called instead of the normal "defeated" path: the ally hauls you back up. */
  hubFightDown() {
    const F = this.hubFight;
    P.hp = Math.round(P.stats.maxHp * 0.6); P.invuln = 2.5;
    this.flash('#ffffff', 0.6); this.slow(0.3, 0.7); SFX.play('heal');
    this.say(F.ally, ALLY_LINES[F.allyId].down, 3);
    UI.banner('NOT YET', 'your ally drags you back to your feet');
  },
  endHubFight(b) {
    const F = this.hubFight;
    this.hubFight = null;
    this.timers = this.timers.filter(t => t.owner !== b);
    this.zones = []; this.projs = []; this.bubbles = []; this.timeStopT = 0;
    b.intro = 99; b.invulnT = 99; b.busy = 0; b.dashing = false; b.alpha = 1;
    this.boss = null; UI.bossBar(null);
    this.controlLocked = true;
    this.flash('#ffffff', 0.7); this.shake(24); this.slow(0.3, 1.0);
    SFX.play('boom'); SFX.play('clang');
    this.parts.burst(b.x, b.y - 20, 40, { color: b.def.col, min: 100, max: 460, size: 3 });
    this.after(0.5, () => {
      // swap the boss back to a plain figure on the field
      const rival = makeFighter(F.rivalId, b.x, b.y, angTo(b, P));
      rival.weapon = b.weapon || 0;
      this.enemies = this.enemies.filter(e => e !== b);
      this.npcs.push(rival);
      F.ally.aim = angTo(F.ally, rival);
      this.camTarget = { x: (P.x + rival.x) / 2, y: (P.y + rival.y) / 2 };
      UI.dialogue(F.allyId === 'sekka' ? STORY3.pickSekka : STORY3.pickKuroto, () => this.finishNewcomers(F.allyId));
    });
  },
  finishNewcomers(id) {
    const S = SAVE.data;
    S.flags.newcomer = id; S.heroes[id].unlocked = true; S.flags.cs2 = true; SAVE.save();
    this.controlLocked = false; this.camTarget = null;
    this.enemies = [];
    this.buildHubNpcs();
    P.hp = P.stats.maxHp;
    Music.cur = null; Music.play('ruin');
    UI.toast(`★ ${HEROES[id].name} is now playable! Visit the Altar of Heroes.`, HEROES[id].pal.scarf, 7);
  },
});
