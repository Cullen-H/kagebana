'use strict';
/* =====================================================================
   KAGEBANA — entities.js
   Player, enemies (and their AI), bosses (and their attack patterns),
   projectiles, telegraphed zones, pickups — plus how they're drawn.
   ===================================================================== */

let P = null; // the player

/* ------------------------------------------------------------------ */
/*  STATS                                                              */
/* ------------------------------------------------------------------ */
function computeStats(pl) {
  const h = pl.hero, S = SAVE.data;
  const s = {
    maxHp: h.base.maxHp, speed: h.base.speed, atk: 1, sp: 1, ult: 1, dmgAll: 1,
    crit: 0.05, critDmg: 0.6, dash: 1, dashCd: 1.1, dashDist: 1, armor: 0, lifesteal: h.base.lifesteal || 0,
    ultGain: 1, gold: 1, luck: 0, spCd: h.specialCd, spCdAdd: 0, spRange: 1, atkSpeed: 1, el: {},
    burnMult: 1, wildfire: 0, roomHeal: 0, phoenix: 0, chainExtra: 0, chainMult: 1, drum: 0, stormEye: 0,
    curseMult: 0, harvest: 0, freezeDur: 0, frozenMult: 0, shatter: 0, mantle: false, dashChill: false, chillWeak: 0,
    windTrail: 0, whirl: 0, rage: 0, feast: 0, dashDmg: h.dashHit || 0, critHeal: 0, clearHeal: 0, extraChoice: 0,
    roomShield: false, resolve: false, ultStart: 0, sakeBonus: 0, healMult: 1,
    devotion: 1, devPer: 0, devHp: 0, discMult: 1, clearGold: 0, discount: 0, coinWard: 0, bigGame: 0, dashHeal: 0,
    kbMult: 1, whirlMult: 1, freezeAt: 5, chainRange: 1, burnDur: 0, skyDancer: 0,
  };
  if (h.statMods) h.statMods(s);
  for (const m of MIRROR) { const r = S.mirror[m.id] || 0; if (r) m.apply(s, r); }
  const form = h.forms[pl.form] || h.forms[0];
  form.apply(s);
  const run = G.run;
  if (run) {
    s.elAll = {};
    let devCount = 0;
    const slotSeen = {};
    const ordered = run.boons.slice().sort((x, y) => boonPower(y) - boonPower(x));
    for (const b of ordered) {
      const def = BOON_BY_ID[b.id];
      const dv = s.devotion !== 1 && run.patrons && !run.patrons.includes(def.k) ? 1 : s.devotion;
      if (dv !== 1) devCount++;
      // only the strongest boon per slot grants its full stat bonus; extras add 15% (their element still procs fully)
      const extra = def.slot !== 'passive' && slotSeen[def.slot];
      if (def.slot !== 'passive') slotSeen[def.slot] = true;
      const savedEl = extra ? s.el[def.slot] : null;
      def.apply(s, boonPower(b) * dv * (extra ? 0.15 : 1), b);
      if (extra) s.el[def.slot] = savedEl;
      if (def.slot !== 'passive') (s.elAll[def.slot] = s.elAll[def.slot] || []).push({ k: def.k, pw: boonPower(b) * dv });
    }
    if (s.devPer && devCount) { s.dmgAll *= 1 + s.devPer * devCount; s.maxHp += s.devHp * devCount; }
    for (const k of run.sparks || []) { const sp = GODSPARKS[k]; if (sp) sp.apply(s); }
    for (const id in run.disc) { const d = DISC_BY_ID[id]; if (d) d.apply(s, run.disc[id] * s.discMult); }
    s.dmgAll *= 1 + (run.bonusDmg || 0);
    if (s.bloodPrice) s.maxHp *= 0.88;
    s.maxHp += run.feastHp || 0;
    for (const rid of run.relics) { const r = RELIC_BY_ID[rid]; if (r.apply) r.apply(s); }
    s.maxHp += run.bonusHp;
    s.maxHp -= 15 * (run.heat.moonless || 0);
    s.healMult *= 1 - 0.25 * (run.heat.heal || 0);
  }
  s.maxHp = Math.max(20, Math.round(s.maxHp));
  s.armor = clamp(s.armor, -0.5, 0.6);
  s.dashCd = Math.max(0.3, s.dashCd);
  return s;
}

/* ------------------------------------------------------------------ */
/*  PLAYER                                                             */
/* ------------------------------------------------------------------ */
class Player {
  constructor(heroId, form) {
    this.hero = HEROES[heroId]; this.form = form || 0;
    this.x = 0; this.y = 0; this.r = 15; this.t = 0;
    this.aim = -Math.PI / 2; this.lookX = 0; this.lookY = 1;
    this.combo = 0; this.comboT = 0; this.atkCd = 0; this.spT = 0;
    this.iframes = 0; this.invuln = 0; this.dashT = 0; this.dashTimer = 0; this.dashDir = { x: 0, y: 0 };
    this.dashFrom = { x: 0, y: 0 }; this.dashHit = new Set();
    this.lv = 0; this.swingT = 0; this.swingDur = 0.2; this.swingFrom = 0; this.swingTo = 0;
    this.trail = []; this.ult = 0; this.moving = false; this.hurtFlash = 0;
    this.whirlA = 0; this.whirlT = 0; this.drumT = 0; this.phoenixUsed = false; this.shieldUp = false; this.frozenHeartT = 0;
    this.vxEst = 0; this.vyEst = 0; this.px = 0; this.py = 0; this.spMax = 1;
    this.bankaiT = 0; this.berserkT = 0; this.exhaustT = 0; this.exhaustDur = 5; this.slowT = 0; this.shunpoT = 0;
    this.prayT = 0; this.parryT = 0; this.domainT = 0; this.spinT = 0; this.frenzy = 0; this.frenzyT = 0; this.groove = 0; this.grooveT = 0;
    this.critCharges = 0; this.feastT = 0; this.luckyT = 0; this.auraT = 0; this.weapon = 0; this.stopCd = 0;
    this.critNext = false; this.guardT = 0; this.stillT = 0; this.rally = 0; this.rallyT = 0; this.capCount = 0; this.shards = 0;
    this.stats = computeStats(this);
    this.hp = this.stats.maxHp; this.dashes = this.stats.dash;
  }
  recompute() {
    const oldMax = this.stats.maxHp;
    this.stats = computeStats(this);
    if (this.stats.maxHp > oldMax) this.hp += this.stats.maxHp - oldMax;
    this.hp = Math.min(this.hp, this.stats.maxHp);
    this.dashes = Math.min(this.dashes, this.stats.dash);
  }
  heal(n, quiet) {
    if (this.hp <= 0) return;
    const amt = n * this.stats.healMult;
    const before = this.hp;
    this.hp = Math.min(this.stats.maxHp, this.hp + amt);
    const got = this.hp - before;
    if (got >= 1 && !quiet) { G.text(this.x, this.y - 50, '+' + Math.round(got), '#7dffb0', 16); }
    if (got >= 8 && !quiet) SFX.play('heal');
  }
  hurtRaw(n) { this.hp = Math.max(1, this.hp - n); this.hurtFlash = 0.3; SFX.play('hurt'); G.text(this.x, this.y - 50, '-' + n, '#ff5577', 18); }
  lunge(d) { this.lv = d; }
  dmgBonus() {
    const s = this.stats; let m = s.dmgAll;
    const missing = 1 - this.hp / s.maxHp;
    if (s.rage) m *= 1 + s.rage * Math.floor(missing * 10);
    if (s.resolve && this.hp / s.maxHp < 0.35) m *= 1.3;
    if (s.bloodMoonForm && this.hp / s.maxHp < 0.5) m *= 1.5;
    if (this.bankaiT > 0) m *= 1.3;
    if (this.groove) m *= 1 + 0.03 * this.groove;
    if (this.feastT > 0) m *= 1.25;
    if (s.stillWater && this.stillT > 0.5) m *= 1 + s.stillWater;
    if (this.berserkT > 0) m *= 1.35;
    return m;
  }
  speedMult() {
    const s = this.stats;
    return (this.bankaiT > 0 ? 1.45 : 1) * (this.berserkT > 0 ? 1.15 : 1) * (this.exhaustT > 0 ? (s.unbound ? 0.5 : 0.6) : 1) * (this.slowT > 0 ? 0.65 : 1)
      * (this.prayT > 0 && s.earthPrayer ? 1.25 : 1) * (s.goldRush && G.run ? 1 + Math.min(0.2, G.run.gold / 5000) : 1) * (this.spinT > 0 ? 0.85 : 1);
  }
  atkMult() {
    const s = this.stats;
    return s.atkSpeed * (this.prayT > 0 ? 1.5 : 1) * (1 + (s.frenzy || 0) * this.frenzy);
  }
  update(dt) {
    const s = this.stats;
    this.t += dt;
    this.iframes -= dt; this.invuln -= dt; this.hurtFlash -= dt; this.swingT -= dt; this.frozenHeartT -= dt;
    this.atkCd -= dt; this.spT -= dt; this.comboT -= dt;
    this.bankaiT -= dt; this.exhaustT -= dt; this.slowT -= dt; this.shunpoT -= dt;
    this.feastT -= dt; this.luckyT -= dt; this.auraT -= dt;
    this.prayT -= dt; this.parryT -= dt; this.domainT -= dt; this.spinT -= dt; this.guardT -= dt; this.rallyT -= dt;
    this.frenzyT -= dt; if (this.frenzyT <= 0) this.frenzy = 0;
    this.grooveT -= dt; if (this.grooveT <= 0 && this.groove) this.groove = Math.max(0, this.groove - 1), this.grooveT = 0.6;
    if (this.prayT > 0 && Math.random() < dt * 20) G.parts.add({ x: this.x + rand(-16, 16), y: this.y - rand(0, 40), vx: 0, vy: -70, life: 0.6, t: 0, size: 3, color: '#ffe9a0', type: 'glow', drag: 1, grav: 0, rot: 0, vr: 0 });
    if (this.domainT > 0 && Math.random() < dt * 20) G.parts.add({ x: this.x + rand(-30, 30), y: this.y - rand(0, 50), vx: 0, vy: -40, life: 0.6, t: 0, size: 3, color: '#e8f4ff', type: 'shard', drag: 1, grav: 0, rot: rand(0, 6), vr: 3 });
    if (this.berserkT > 0) {
      this.berserkT -= dt;
      if (Math.random() < dt * 30) G.parts.add({ x: this.x + rand(-14, 14), y: this.y - rand(10, 40), vx: 0, vy: -90, life: 0.5, t: 0, size: 4, color: '#ff3d2e', type: 'glow', drag: 1, grav: 0, rot: 0, vr: 0 });
      if (this.berserkT <= 0) { this.exhaustT = this.exhaustDur; G.text(this.x, this.y - 60, 'EXHAUSTED', '#bbbbbb', 18); SFX.play('hurt', 0.6); }
    }
    if (this.exhaustT > 0 && Math.random() < dt * 12) G.parts.add({ x: this.x + rand(-12, 12), y: this.y - 40, vx: rand(-10, 10), vy: -40, life: 0.9, t: 0, size: 5, color: '#dddddd', type: 'smoke', drag: 1, grav: 0, rot: 0, vr: 0 });
    if (this.bankaiT > 0 && Math.random() < dt * 40) G.parts.add({ x: this.x + rand(-16, 16), y: this.y - rand(0, 44), vx: rand(-20, 20), vy: -120, life: 0.4, t: 0, size: 3, color: Math.random() < 0.5 ? '#c8102e' : '#1a0008', type: 'spark', drag: 1, grav: 0, rot: 0, vr: 0 });
    if (this.comboT <= 0 && this.atkCd <= 0) this.combo = 0;
    // aim
    if (Input.usingPad) this.aim = Math.atan2(Input.padAim.y, Input.padAim.x);
    else this.aim = Math.atan2(Input.mouse.wy - (this.y - 18), Input.mouse.wx - this.x);
    const mv = G.controlLocked ? { x: 0, y: 0 } : Input.moveVec();
    this.moving = Math.hypot(mv.x, mv.y) > 0.1;
    // facing for the portrait: blend aim if attacking else movement
    const fx = this.swingT > 0 || Input.attackHeld() ? Math.cos(this.aim) : (this.moving ? mv.x : this.lookX);
    const fy = this.swingT > 0 || Input.attackHeld() ? Math.sin(this.aim) : (this.moving ? mv.y : this.lookY);
    this.lookX = lerp(this.lookX, fx, Math.min(1, dt * 14)); this.lookY = lerp(this.lookY, fy, Math.min(1, dt * 14));

    // dash recharge
    if (this.dashes < s.dash) {
      this.dashTimer += dt;
      if (this.dashTimer >= s.dashCd) {
        this.dashTimer = 0; this.dashes++;
        if (s.stormFront && G.scene === 'run') { const e = G.nearestEnemy(this.x, this.y, 520); if (e) { G.fxBolt(e.x, e.y - 400, e.x, e.y - 10); G.damageEnemy(e, 25 * s.stormFront, { slot: 'misc', noProc: true }); SFX.play('thunder', 0.5); } }
      }
    }
    else this.dashTimer = 0;

    if (this.dashT > 0) {
      this.dashT -= dt;
      const sp = 1150 * s.dashDist * (this.bankaiT > 0 ? 1.2 : 1);
      G.moveSafe(this, this.dashDir.x * sp * dt, this.dashDir.y * sp * dt);
      if (s.dashDmg > 0) {
        for (const e of G.enemies) {
          if (e.dead || e.spawnT > 0 || this.dashHit.has(e)) continue;
          if (Math.hypot(e.x - this.x, e.y - this.y) < e.r + this.r + 14) {
            this.dashHit.add(e);
            G.damageEnemy(e, s.dashDmg, { slot: 'dash', kb: 260, kbAng: Math.atan2(this.dashDir.y, this.dashDir.x) });
          }
        }
      }
      if ((s.emberTrail || s.blizWake) && Math.random() < dt * 40) {
        const ember = s.emberTrail;
        G.pZone({ x: this.x, y: this.y, r: 50, warn: 0.15, dmg: 4, slot: 'misc', color: ember ? '#ff7a3d' : '#9ee7ff', quiet: true, noProc: true,
          onFire: z => { for (const e of G.enemiesInRange(z.x, z.y, z.r)) { if (ember) G.burn(e, 6 * ember); if (s.blizWake) G.chill(e, 1); } } });
      }
      if (s.windTrail && Math.random() < dt * 40) G.pZone({ x: this.x, y: this.y, r: 46, warn: 0.15, dmg: 16 * s.windTrail, slot: 'misc', color: '#7dffb0', quiet: true, noProc: true });
      if (Math.random() < 0.6) G.ghost(this, this.x, this.y, 0.22);
    } else if (!G.controlLocked) {
      if (this.moving) this.stillT = 0; else this.stillT += dt;
      const sp = s.speed * (s.resolve && this.hp / s.maxHp < 0.35 ? 1.15 : 1) * (this.swingT > 0 ? 0.55 : 1) * this.speedMult();
      G.moveSafe(this, mv.x * sp * dt, mv.y * sp * dt);
    }
    // lunge
    if (Math.abs(this.lv) > 1) {
      G.moveSafe(this, Math.cos(this.aim) * this.lv * dt, Math.sin(this.aim) * this.lv * dt);
      this.lv *= Math.pow(0.0005, dt);
    }

    if (!G.controlLocked) {
      // attack
      if (Input.attackHeld() && this.atkCd <= 0 && this.dashT <= 0 && !G.qteBlocks('attack')) {
        this.atkCd = this.hero.attack(this) / (this.hero.id === 'sora' ? 1 : this.atkMult() / this.stats.atkSpeed);
        this.comboT = this.atkCd + 0.45;
      }
      // special
      if (Input.specialHit() && this.spT <= 0 && this.dashT <= 0 && !G.qteBlocks('special')) {
        const cdo = this.hero.special(this);
        this.spT = typeof cdo === 'number' ? cdo : s.spCd + s.spCdAdd;
        if (s.vortex) {
          for (const e of G.enemiesInRange(this.x, this.y, 240)) { if (e.isBoss) continue; const a = angTo(e, this); e.vx += Math.cos(a) * 300 * Math.min(2, s.vortex) * (1 - e.kbRes); e.vy += Math.sin(a) * 300 * Math.min(2, s.vortex) * (1 - e.kbRes); }
          G.fxRing(this.x, this.y, 240, '#7dffb0', 0.3, 5);
        }
        this.spMax = this.spT;
      }
      // dash
      if (Input.dashHit() && this.dashes > 0 && this.dashT <= 0) {
        this.dashes--;
        const l = Math.hypot(mv.x, mv.y);
        this.dashDir = l > 0.1 ? { x: mv.x / l, y: mv.y / l } : { x: Math.cos(this.aim), y: Math.sin(this.aim) };
        this.dashT = 0.16; this.iframes = Math.max(this.iframes, 0.24 + s.skyDancer);
        if (s.dashCrit) this.critNext = true;
        if (s.dashGuard) this.guardT = 1;
        this.dashFrom = { x: this.x, y: this.y }; this.dashHit = new Set();
        SFX.play('dash');
        G.parts.burst(this.x, this.y, 8, { type: 'smoke', color: '#ffffff', min: 20, max: 80, size: 4 });
        if (this.hero.onDash) this.hero.onDash(this);
        if (s.dashHeal) this.heal(s.dashHeal, true);
        if (s.dashChill) for (const e of G.enemiesInRange(this.x, this.y, 140)) G.chill(e, 1);
        if (s.tempest) {
          const ts = G.enemiesInRange(this.x, this.y, 420).slice(0, 3);
          for (const e of ts) { G.fxBolt(this.x, this.y - 20, e.x, e.y - 15, '#ffe14d'); G.damageEnemy(e, 30, { slot: 'misc', noProc: true }); }
          if (ts.length) SFX.play('thunder');
        }
      }
      // ultimate
      if (Input.ultHit() && this.hero.swap) { this.hero.swap(this); }
      else if (Input.ultHit()) {
        if (this.ult >= 100) {
          this.ult = 0;
          G.cutin(this.hero.id, this.hero.ultName, this.hero.ultJp, this.hero.ultSub);
          SFX.play('ult'); G.stop(0.3);
          this.hero.ult(this);
          for (const u of (s.elAll && s.elAll.ult) || (s.el.ult ? [s.el.ult] : [])) G.ultProc(u);
        } else if (G.scene === 'run') SFX.play('deny');
      }
    }
    // passives
    if (s.whirl && G.scene === 'run') {
      this.whirlA += dt * 4; this.whirlT -= dt;
      if (this.whirlT <= 0) {
        this.whirlT = 0.3;
        const wx = this.x + Math.cos(this.whirlA) * 70, wy = this.y + Math.sin(this.whirlA) * 50;
        G.hitCircle(wx, wy, 34, 10 * s.whirl * s.whirlMult, { slot: 'misc', kb: 60, noProc: true, quiet: true });
        if (s.whirl >= 2) G.hitCircle(this.x - Math.cos(this.whirlA) * 70, this.y - Math.sin(this.whirlA) * 50, 34, 10 * s.whirl * s.whirlMult * 0.5, { slot: 'misc', kb: 60, noProc: true, quiet: true });
      }
    }
    if (s.drum && G.scene === 'run' && G.enemies.length) {
      this.drumT -= dt;
      if (this.drumT <= 0) {
        this.drumT = s.drumFast ? 1.75 : 3.5;
        const live = G.enemies.filter(e => !e.dead && e.spawnT <= 0 && !e.passive);
        if (live.length) {
          const e = pick(live);
          G.fxBolt(e.x + rand(-40, 40), e.y - 500, e.x, e.y - 10, '#ffe14d');
          G.damageEnemy(e, 35 * s.drum, { slot: 'misc', noProc: true, stun: 0.3 });
          SFX.play('thunder');
        }
      }
    }
    // trail
    const last = this.trail[0];
    if (!last || Math.hypot(last.x - this.x, last.y - this.y) > 5) {
      this.trail.unshift({ x: this.x, y: this.y });
      if (this.trail.length > 7) this.trail.pop();
    } else if (!this.moving && this.trail.length > 2 && Math.random() < 0.3) this.trail.pop();
  }
  draw(ctx) {
    const blink = this.iframes > 0 && this.dashT <= 0 && Math.floor(this.t * 20) % 2 === 0 && this.hurtFlash > -0.5;
    const flash = this.hurtFlash > 0.15;
    const aimUp = Math.sin(this.aim) < -0.3;
    const h = this.hero;
    // whirlwind
    if (this.stats.whirl && G.scene === 'run') {
      ctx.save(); ctx.globalAlpha = 0.6; ctx.strokeStyle = '#7dffb0'; ctx.lineWidth = 3;
      const wx = this.x + Math.cos(this.whirlA) * 70, wy = this.y + Math.sin(this.whirlA) * 50;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(wx, wy - 10, 10 + i * 8, this.t * 10 + i, this.t * 10 + i + 3.5); ctx.stroke(); }
      ctx.restore();
    }
    const wa = this.swingT > 0 ? lerp(this.swingTo, this.swingFrom, Math.max(0, this.swingT / this.swingDur)) : this.aim + 0.6;
    const hx = this.x + Math.cos(this.aim) * 12, hy = this.y - 20 + Math.sin(this.aim) * 6;
    if (aimUp) h.drawWeapon(ctx, this, hx, hy, wa);
    if (this.berserkT > 0 || this.bankaiT > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3 + Math.sin(this.t * 20) * 0.08;
      ctx.fillStyle = this.berserkT > 0 ? '#ff3d2e' : '#c8102e'; ell(ctx, this.x, this.y - 24, 30, 40); ctx.restore();
    }
    const pal = this.bankaiT > 0 && h.bankaiPal ? h.bankaiPal : h.pal;
    if (this.prayT > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25; ctx.fillStyle = '#ffe9a0'; ell(ctx, this.x, this.y - 26, 26, 44); ctx.restore(); }
    if (this.spinT > 0) { ctx.save(); ctx.strokeStyle = 'rgba(200,240,255,.55)'; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(this.x, this.y - 18, 100 - i * 18, 50 - i * 9, 0, this.t * 18 + i, this.t * 18 + i + 2.2); ctx.stroke(); } ctx.restore(); }
    drawChar(ctx, { x: this.x, y: this.y, s: h.size || 13, lookX: this.lookX, lookY: this.lookY, pal, t: this.t, moving: this.moving || this.dashT > 0,
      flash, hair: h.hair, acc: h.acc, alpha: blink ? 0.45 : 1, trail: this.trail, mood: this.hp / this.stats.maxHp < 0.3 ? 'angry' : null });
    if (!aimUp) h.drawWeapon(ctx, this, hx, hy, wa);
    if (this.invuln > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + Math.sin(this.t * 30) * 0.1;
      ctx.fillStyle = h.pal.scarf; circ(ctx, this.x, this.y - 22, 34); ctx.restore();
    }
    if (this.shieldUp) {
      ctx.save(); ctx.strokeStyle = 'rgba(120,220,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.x, this.y - 20, 30, 0, TAU); ctx.stroke(); ctx.restore();
    }
  }
}

/* ------------------------------------------------------------------ */
/*  ENEMIES                                                            */
/* ------------------------------------------------------------------ */
const ELITE_TRAITS = ['hasted', 'armored', 'explosive', 'regen'];
class Enemy {
  constructor(id, x, y, o = {}) {
    const boss = BOSSES[id];
    this.def = boss || ENEMIES[id]; this.id = id; this.isBoss = !!boss;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.elite = !!o.elite; this.trait = this.elite ? (o.trait || pick(ELITE_TRAITS)) : null;
    const d = this.def;
    this.r = d.r * (this.elite ? 1.2 : 1);
    this.maxHp = this.hp = Math.round(d.hp * (o.hpMult || 1) * (this.elite ? 2.4 : 1));
    this.spd = (d.spd || 0) * (o.spdMult || 1) * (this.trait === 'hasted' ? 1.35 : 1);
    this.dmg = (d.dmg || 0) * (o.dmgMult || 1) * (this.elite ? 1.25 : 1);
    this.tempo = (o.spdMult || 1) * (o.tempoMult || 1) * (this.trait === 'hasted' ? 1.3 : 1); // affects cooldowns
    this.kbRes = d.kbRes || 0;
    this.st = { burn: 0, burnT: 0, burnTick: 0, chill: 0, chillT: 0, freeze: 0, curse: 0, bleed: 0, stun: 0 };
    this.state = 'approach'; this.stT = 0; this.cd = rand(0.6, 1.8); this.face = 0; this.t = rand(0, 10);
    this.seed = rand(0, 100); this.strafe = pick([-1, 1]); this.spawnT = o.noSpawn ? 0 : 0.7; this.flash = 0; this.dead = false;
    this.minion = !!o.minion; this.passive = d.ai === 'dummy';
    this.moving = false; this.alpha = 1;
    if (this.isBoss) {
      this.phase = 0; this.busy = 0; this.rest = 1.2; this.intro = 0.5; this.lastPat = '';
      this.speedMul = o.speedMul || 1; this.invulnT = 0;
    }
  }
  walk(a, spd, dt) {
    const sl = this.slowF();
    G.moveSafe(this, Math.cos(a) * spd * sl * dt, Math.sin(a) * spd * sl * dt);
    this.moving = true;
  }
  slowF() { return Math.max(0.35, 1 - 0.11 * this.st.chill); }
  /* Flying from Kuroto's Grab Throw. Ends on a wall, an obstacle, another foe, or running out of steam. */
  updateThrown(dt) {
    const T = this.thrown, speed = 1150;
    T.t -= dt; this.moving = true;
    const wall = G.moveSafe(this, Math.cos(T.a) * speed * dt, Math.sin(T.a) * speed * dt);
    if (Math.random() < 0.5) G.ghostE(this, this.x, this.y);
    let foe = null;
    for (const o of G.enemies) {
      if (o === this || o.dead || o.spawnT > 0 || o.thrown) continue;
      if (Math.hypot(o.x - this.x, o.y - this.y) < o.r + this.r) { foe = o; break; }
    }
    if (!wall && !foe && T.t > 0) return;
    this.thrown = null;
    this.st.stun = Math.max(this.st.stun, 0.8);
    if (!wall && !foe) { G.damageEnemy(this, 25, { slot: 'special' }); return; }
    G.fxRing(this.x, this.y - this.r, 90, '#c8c8c8', 0.25, 8);
    G.parts.burst(this.x, this.y - this.r, 18, { color: '#fff3b0', min: 100, max: 420, size: 3 });
    SFX.play('heavy'); SFX.play('clang', 0.6); G.shake(10); G.stop(0.08);
    if (foe) G.damageEnemy(foe, 70, { slot: 'special', kb: 320, kbAng: T.a, stun: 0.7, pierceGuard: true });
    G.damageEnemy(this, 95, { slot: 'special' });
  }
  disabled() { return this.st.freeze > 0 || this.st.stun > 0; }
  update(dt) {
    this.t += dt; this.moving = false;
    if (this.spawnT > 0) { this.spawnT -= dt; return; }
    this.flash -= dt;
    if (this.thrown) { this.updateThrown(dt); return; }
    const st = this.st;
    if (st.burnT > 0) {
      st.burnT -= dt; st.burnTick += dt;
      if (st.burnTick >= 0.5) {
        st.burnTick = 0;
        G.damageEnemy(this, st.burn * 0.5 * P.stats.burnMult, { slot: 'dot', noProc: true, color: '#ff9a4d', dot: true });
        if (Math.random() < 0.5) G.parts.add({ x: this.x + rand(-8, 8), y: this.y - 20, vx: 0, vy: -60, life: 0.5, t: 0, size: 3, color: '#ff7a3d', type: 'glow', drag: 1, grav: 0, rot: 0, vr: 0 });
      }
    } else st.burn = 0;
    if (st.chillT > 0) { st.chillT -= dt; } else st.chill = 0;
    st.freeze -= dt; st.curse -= dt; st.stun -= dt;
    if (this.trait === 'regen' && !this.dead) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.02 * dt);
    if (this.isBoss) { this.invulnT -= dt; this.armorT = (this.armorT || 0) - dt; }
    // knockback physics
    if (Math.abs(this.vx) + Math.abs(this.vy) > 5) {
      const hit = G.moveSafe(this, this.vx * dt, this.vy * dt);
      const spd = Math.hypot(this.vx, this.vy);
      if (hit && spd > 280 && this.windSlam) {
        G.damageEnemy(this, this.windSlam, { slot: 'misc', noProc: true, color: '#7dffb0' });
        G.parts.burst(this.x, this.y, 8, { color: '#7dffb0' });
        this.windSlam = 0; this.vx *= -0.3; this.vy *= -0.3;
      }
      const k = Math.pow(0.002, dt); this.vx *= k; this.vy *= k;
    } else { this.vx = 0; this.vy = 0; this.windSlam = 0; }
    if (this.disabled()) return;
    if (this.isBoss) BOSS_AI(this, dt);
    else (AI[this.def.ai] || AI.chase)(this, dt);
    // contact damage
    if ((this.def.contact || this.dashing) && P && Math.hypot(P.x - this.x, P.y - this.y) < this.r + P.r + 2) {
      if (G.hurtPlayer(this.dashing ? this.dmg * 1.2 : this.dmg, this) && this.def.slowTouch) P.slowT = 1.3;
      if (P.stats.mantle) G.chill(this, 2);
    }
  }
  draw(ctx) {
    const t = this.t;
    ctx.save();
    if (this.spawnT > 0) {
      const k = 1 - this.spawnT / 0.7;
      ctx.globalAlpha = k;
      ctx.strokeStyle = G.biome().accent; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r * 2 * (1 - k) + this.r, (this.r * 2 * (1 - k) + this.r) * 0.4, 0, 0, TAU); ctx.stroke();
    }
    if (this.elite) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const ec = { hasted: '#7dffb0', armored: '#ffd56b', explosive: '#ff6a3d', regen: '#ff5fa2' }[this.trait];
      ctx.fillStyle = rgba(ec, 0.15 + Math.sin(t * 6) * 0.05); circ(ctx, this.x, this.y - this.r, this.r * 2.1);
      ctx.restore();
    }
    ctx.globalAlpha *= this.alpha;
    const fn = EDRAW[this.def.draw] || EDRAW.kappa;
    if (this.hop) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(ctx, this.x, this.y, this.r, this.r * 0.4); ctx.translate(0, -this.hop); }
    fn(ctx, this, t, this.flash > 0);
    if (this.hop) ctx.translate(0, this.hop);
    if (this.armorT > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ff6a3d'; ctx.lineWidth = 4; ctx.globalAlpha = 0.6 + Math.sin(t * 20) * 0.2; ctx.beginPath(); ctx.arc(this.x, this.y - this.r * 1.6, this.r * 1.9, 0, TAU); ctx.stroke(); ctx.restore(); }
    // status overlays
    if (this.st.freeze > 0) {
      ctx.fillStyle = 'rgba(180,240,255,.45)'; ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 2;
      star(ctx, this.x, this.y - this.r, this.r * 1.5, this.r * 1.0, 6, 0.3); ctx.fill(); ctx.stroke();
    } else if (this.st.chill > 0) {
      ctx.fillStyle = 'rgba(120,220,255,.18)'; circ(ctx, this.x, this.y - this.r, this.r * 1.2);
    }
    if (this.st.curse > 0) {
      ctx.fillStyle = '#b49cff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('月', this.x, this.y - this.r * 2.6 - 18);
    }
    if (this.st.stun > 0 && !this.isBoss) {
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#ffe14d'; const a = t * 6 + i * 2.1; circ(ctx, this.x + Math.cos(a) * 14, this.y - this.r * 2.4 - 8 + Math.sin(a) * 4, 3); }
    }
    // hp bar
    if (!this.isBoss && !this.passive && this.hp < this.maxHp && this.spawnT <= 0) {
      const w = Math.max(30, this.r * 2.2), y = this.y - this.r * 2.4 - 10;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(this.x - w / 2 - 1, y - 1, w + 2, 6);
      ctx.fillStyle = this.elite ? '#ffd56b' : '#ff3d5e'; ctx.fillRect(this.x - w / 2, y, w * (this.hp / this.maxHp), 4);
      if (this.st.bleed) { ctx.fillStyle = '#ff3d5e'; for (let i = 0; i < this.st.bleed; i++) ctx.fillRect(this.x - w / 2 + i * 6, y + 6, 4, 3); }
    }
    ctx.restore();
  }
}

/* ---------- regular enemy AI ---------- */
const AI = {
  dummy() {},
  chase(e, dt) { e.face = angTo(e, P); e.walk(e.face, e.spd, dt); },
  swarm(e, dt) { e.face = angTo(e, P) + Math.sin(e.t * 4 + e.seed) * 0.7; e.walk(e.face, e.spd, dt); },
  melee(e, dt) {
    const d = dist(e, P); e.cd -= dt * e.tempo;
    if (e.state === 'approach') {
      e.face = angTo(e, P);
      if (d > e.def.range * 0.75) e.walk(e.face, e.spd, dt);
      if (d < e.def.range + 10 && e.cd <= 0) {
        e.state = 'windup'; e.stT = e.def.windup / e.tempo;
        G.addZone({ shape: 'cone', x: e.x, y: e.y, r: e.def.range + 22, ang: e.face, arc: e.def.arc, warn: e.stT, dmg: e.dmg, owner: e, follow: true });
      }
    } else if (e.state === 'windup') {
      e.stT -= dt;
      if (e.stT <= 0) { e.state = 'recover'; e.stT = 0.45; e.lungeT = 0.1; SFX.play('slash', 0.6); }
    } else {
      e.stT -= dt;
      if (e.lungeT > 0) { e.lungeT -= dt; G.moveSafe(e, Math.cos(e.face) * 500 * dt, Math.sin(e.face) * 500 * dt); }
      if (e.stT <= 0) { e.state = 'approach'; e.cd = (e.def.cd || 1.2) * rand(0.8, 1.3); }
    }
  },
  brute(e, dt) {
    const d = dist(e, P); e.cd -= dt * e.tempo;
    if (e.state === 'approach') {
      e.face = angTo(e, P);
      if (d > 90) e.walk(e.face, e.spd, dt);
      if (d < 150 && e.cd <= 0) {
        e.state = 'windup'; e.stT = 0.85 / e.tempo;
        G.addZone({ shape: 'circle', x: e.x, y: e.y, r: e.def.slamR || 125, warn: e.stT, dmg: e.dmg, owner: e, follow: true, onFire: z => { G.shake(7);
          if (e.def.ringShots) { const n = e.def.ringShots, o = rand(0, TAU); for (let i = 0; i < n; i++) G.eProj({ x: z.x, y: z.y - 10, ang: o + i * TAU / n, speed: 230, dmg: e.dmg * 0.6, r: 10, color: '#9ee7ff', kind: 'bubble' }); SFX.play('splash'); } SFX.play('boom', 0.7); G.parts.burst(z.x, z.y, 18, { type: 'smoke', color: '#bbb', min: 60, max: 220, size: 6 }); } });
      }
    } else if (e.state === 'windup') { e.stT -= dt; if (e.stT <= 0) { e.state = 'recover'; e.stT = 0.7; } }
    else { e.stT -= dt; if (e.stT <= 0) { e.state = 'approach'; e.cd = 2.2 * rand(0.8, 1.2); } }
  },
  shooter(e, dt) {
    const d = dist(e, P), a = angTo(e, P); e.face = a; e.cd -= dt * e.tempo;
    const keep = e.def.keep || 330;
    if (e.state !== 'aim') {
      if (d > keep + 60) e.walk(a, e.spd, dt);
      else if (d < keep - 90) e.walk(a + Math.PI, e.spd * 0.8, dt);
      else e.walk(a + Math.PI / 2 * e.strafe, e.spd * 0.45, dt);
      if (Math.random() < dt * 0.4) e.strafe *= -1;
    }
    if (e.cd <= 0 && e.state !== 'aim') { e.state = 'aim'; e.stT = 0.5; }
    if (e.state === 'aim') {
      e.stT -= dt;
      if (e.stT <= 0) {
        e.state = ''; e.cd = e.def.cd * rand(0.85, 1.25);
        const n = e.def.shots;
        for (let i = 0; i < n; i++) {
          const off = n > 1 ? (i - (n - 1) / 2) * e.def.spread : 0;
          G.eProj({ x: e.x, y: e.y - e.r, ang: a + off, speed: e.def.pspeed, dmg: e.dmg, r: e.def.slowShot ? 10 : 8, color: e.def.slowShot ? '#d8d0ff' : e.def.col, kind: e.def.slowShot ? 'web' : e.def.wave ? 'bubble' : 'orb', homing: e.def.homing, life: e.def.homing ? 4 : 3, slow: e.def.slowShot, wave: e.def.wave });
        }
        SFX.play('eshoot');
      }
    }
  },
  twin(e, dt) {
    const d = dist(e, P); e.cd -= dt * e.tempo;
    if (e.state === 'approach') {
      e.face = angTo(e, P);
      if (d > e.def.range * 0.75) e.walk(e.face, e.spd, dt);
      if (d < e.def.range + 20 && e.cd <= 0) {
        const n = e.def.strikes || 2, w = e.def.windup / e.tempo;
        e.state = 'combo'; e.stT = w + (n - 1) * 0.36 + 0.4;
        for (let k = 0; k < n; k++) G.after(k * 0.36, () => {
          if (e.dead || e.disabled()) return;
          e.face = angTo(e, P);
          G.addZone({ shape: 'cone', x: e.x, y: e.y, r: e.def.range + 22 + (k === n - 1 ? 20 : 0), ang: e.face, arc: e.def.arc * (k === n - 1 ? 1.3 : 1), warn: w, dmg: e.dmg, owner: e, follow: true, color: e.def.col2 });
          G.after(w, () => { if (!e.dead) G.moveSafe(e, Math.cos(e.face) * 40, Math.sin(e.face) * 40); }, e);
        }, e);
      }
    } else { e.stT -= dt; if (e.stT <= 0) { e.state = 'approach'; e.cd = (e.def.cd || 1.2) * rand(0.8, 1.2); } }
  },
  beamer(e, dt) {
    e.cd -= dt * e.tempo;
    if (e.state === 'approach') {
      e.face = angTo(e, P); e.walk(e.face + Math.sin(e.t) * 1.4, e.spd * 0.6, dt);
      if (e.cd <= 0) { e.state = 'fade'; e.stT = 0.3; }
    } else if (e.state === 'fade') {
      e.stT -= dt; e.alpha = Math.max(0.05, e.stT / 0.3);
      if (e.stT <= 0) {
        const a = rand(0, TAU), p = G.clampToArena(P.x + Math.cos(a) * 240, P.y + Math.sin(a) * 240, e.r);
        e.x = p.x; e.y = p.y; e.alpha = 1; e.face = angTo(e, P); e.state = 'lash'; e.stT = 0.85 / e.tempo;
        G.addZone({ shape: 'line', x: e.x, y: e.y - 10, ang: e.face, len: 460, w: 34, warn: e.stT, dmg: e.dmg, owner: e, color: '#ff3d5e', onFire: z => G.fxLine(z.x, z.y, z.x + Math.cos(z.ang) * 460, z.y + Math.sin(z.ang) * 460, '#1a1020', 14, 0.3) });
      }
    } else { e.stT -= dt; if (e.stT <= 0) { e.state = 'approach'; e.cd = e.def.cd * rand(0.8, 1.2); } }
  },
  turret(e, dt) {
    e.face = angTo(e, P); e.cd -= dt * e.tempo;
    if (e.cd <= 0) {
      e.cd = e.def.cd * rand(0.85, 1.15);
      const p = G.clampToArena(P.x + P.vxEst * 0.6, P.y + P.vyEst * 0.6, 40);
      G.addZone({ shape: 'circle', x: p.x, y: p.y, r: 85, warn: 1.1, dmg: e.dmg, color: '#ff8a3d', kind: 'missile', onFire: z => G.boom(z.x, z.y, 85) });
      SFX.play('boom', 0.3); e.recoil = 0.2;
    }
    e.recoil = Math.max(0, (e.recoil || 0) - dt);
  },
  flamer(e, dt) {
    const d = dist(e, P); e.cd -= dt * e.tempo;
    if (e.state === 'approach') {
      e.face += clamp(angDiff(e.face, angTo(e, P)), -3 * dt, 3 * dt);
      if (d > 120) e.walk(e.face, e.spd, dt);
      if (d < 200 && e.cd <= 0) {
        e.state = 'flame'; e.stT = 1.7;
        G.addZone({ shape: 'cone', x: e.x, y: e.y, r: 210, ang: e.face, arc: 0.9, warn: 0.5 / e.tempo, dur: 1.2, field: true, tick: 0, dmg: e.dmg, owner: e, follow: true, aimOwner: true, color: '#ffb347', kind: 'flame' });
      }
    } else if (e.state === 'flame') {
      e.stT -= dt; e.face += clamp(angDiff(e.face, angTo(e, P)), -0.9 * dt, 0.9 * dt);
      if (e.stT <= 0) { e.state = 'approach'; e.cd = 2.4; }
    }
  },
  ricochet(e, dt) {
    if (e.rdir === undefined) e.rdir = angTo(e, P) + rand(-0.4, 0.4);
    const sl = e.slowF();
    const hit = G.moveSafe(e, Math.cos(e.rdir) * e.spd * sl * dt, Math.sin(e.rdir) * e.spd * sl * dt);
    e.moving = true; e.face = e.rdir;
    if (hit) { e.rdir = angTo(e, P) + rand(-0.6, 0.6); SFX.play('clang', 0.3); G.shake(2); }
    if (e.def.flameTrail && Math.random() < dt * 6) G.addZone({ shape: 'circle', x: e.x, y: e.y, r: 40, warn: 0.5, dur: 2.0, field: true, tick: 0, dmg: e.dmg * 0.4, color: '#ff6a3d', kind: 'fire' });
  },
  dasher(e, dt) {
    const d = dist(e, P); e.cd -= dt * e.tempo;
    if (e.state === 'approach') {
      e.face = angTo(e, P);
      if (d > 280) e.walk(e.face, e.spd, dt); else e.walk(e.face + Math.PI / 2 * e.strafe, e.spd * 0.6, dt);
      if (d < 420 && e.cd <= 0) {
        e.state = 'windup'; e.stT = 0.6 / e.tempo; e.dashLen = Math.min(460, d + 120);
        G.addZone({ shape: 'line', x: e.x, y: e.y, ang: e.face, len: e.dashLen, w: e.r * 2 + 10, warn: e.stT, dmg: 0, owner: e, visual: true });
      }
    } else if (e.state === 'windup') {
      const ds = e.def.dashSpd || 950;
      e.stT -= dt; if (e.stT <= 0) { e.state = 'dash'; e.stT = e.dashLen / ds; e.dashing = true; SFX.play('dash', 0.6); }
    } else if (e.state === 'dash') {
      const ds = e.def.dashSpd || 950;
      G.moveSafe(e, Math.cos(e.face) * ds * dt, Math.sin(e.face) * ds * dt);
      e.stT -= dt; if (Math.random() < 0.7) G.ghostE(e);
      if (e.stT <= 0) { e.state = 'recover'; e.stT = 0.7; e.dashing = false; }
    } else {
      e.stT -= dt;
      if (e.def.multi && (e.chain || 0) < e.def.multi - 1) { e.chain = (e.chain || 0) + 1; e.state = 'approach'; e.cd = 0; e.stT = 0; return; }
      if (e.stT <= 0) { e.chain = 0; e.state = 'approach'; e.cd = 1.6 * rand(0.8, 1.3); }
    }
  },
  teleporter(e, dt) {
    e.cd -= dt * e.tempo; e.face = angTo(e, P);
    if (e.state === 'approach') {
      e.walk(e.face + Math.sin(e.t) * 1.2, e.spd * 0.5, dt);
      if (e.cd <= 0) { e.state = 'fade'; e.stT = 0.35; }
    } else if (e.state === 'fade') {
      e.stT -= dt; e.alpha = Math.max(0, e.stT / 0.35);
      if (e.stT <= 0) {
        const a = rand(0, TAU), r = rand(200, 300);
        const p = G.clampToArena(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r, e.r);
        e.x = p.x; e.y = p.y; e.state = 'charge'; e.stT = 0.55; e.alpha = 1;
        G.parts.burst(e.x, e.y - 15, 12, { type: 'shard', color: '#dff6ff', min: 30, max: 120 });
      }
    } else if (e.state === 'charge') {
      e.stT -= dt;
      if (e.stT <= 0) {
        if (e.def.fan) {
          const a = angTo(e, P);
          for (let i = -1; i <= 1; i++) G.eProj({ x: e.x, y: e.y - 15, ang: a + i * 0.22, speed: 420, dmg: e.dmg, r: 9, color: '#d8d8e0', kind: 'shuriken' });
          SFX.play('shoot', 0.6); G.parts.burst(e.x, e.y - 15, 10, { type: 'smoke', color: '#888', min: 20, max: 90, size: 6 });
        } else {
          const n = e.elite ? 12 : 8, off = rand(0, TAU);
          for (let i = 0; i < n; i++) G.eProj({ x: e.x, y: e.y - 15, ang: off + i * TAU / n, speed: 210, dmg: e.dmg, r: 8, color: '#9ee7ff', kind: 'shard' });
          SFX.play('freeze', 0.5);
        }
        e.state = 'approach'; e.cd = e.def.cd * rand(0.8, 1.2);
      }
    }
  },
  bomber(e, dt) {
    const d = dist(e, P);
    if (e.state === 'approach') {
      e.face = angTo(e, P) + Math.sin(e.t * 5) * 0.3; e.walk(e.face, e.spd, dt);
      if (d < 70) {
        e.state = 'fuse'; e.stT = 0.65;
        G.addZone({ shape: 'circle', x: e.x, y: e.y, r: 100, warn: 0.65, dmg: e.dmg, owner: e, follow: true, keepOnDeath: true, onFire: z => { G.boom(z.x, z.y, 100);
          if (e.def.lingering) G.addZone({ shape: 'circle', x: z.x, y: z.y, r: 90, warn: 0.05, dur: 3.0, field: true, tick: 0.3, dmg: e.dmg * 0.35, color: '#e0203a', kind: 'fire' }); if (!e.dead) G.killEnemy(e, true); G.hitCircle(z.x, z.y, 100, 40, { slot: 'misc', noProc: true, kb: 300, quiet: true }); } });
      }
    } else { e.stT -= dt; }
  },
  spinner(e, dt) {
    e.cd -= dt * e.tempo; e.face = angTo(e, P);
    if (e.state === 'approach') {
      const d = dist(e, P);
      e.walk(e.face + (d < 250 ? Math.PI : 0) + Math.sin(e.t * 0.7) * 0.8, e.spd, dt);
      if (e.cd <= 0) { e.state = 'spin'; e.stT = 1.8; e.spinA = rand(0, TAU); e.shotT = 0; }
    } else {
      e.stT -= dt; e.shotT -= dt; e.spinA += dt * 2.6;
      if (e.def.burst) {
        if (e.shotT <= 0) { e.shotT = 0.55; const n = 14, o = rand(0, TAU); for (let i = 0; i < n; i++) G.eProj({ x: e.x, y: e.y - e.r, ang: o + i * TAU / n, speed: 200, dmg: e.dmg, r: 9, color: '#ffb347', kind: 'flare' }); SFX.play('burn', 0.5); }
      } else if (e.shotT <= 0) {
        e.shotT = 0.2;
        const arms = e.elite ? 3 : 2;
        for (let i = 0; i < arms; i++) G.eProj({ x: e.x, y: e.y - e.r, ang: e.spinA + i * TAU / arms, speed: 190, dmg: e.dmg, r: 7, color: e.def.col2, kind: 'orb' });
        SFX.play('eshoot', 0.4);
      }
      if (e.stT <= 0) { e.state = 'approach'; e.cd = 3.2 * rand(0.8, 1.2); }
    }
  },
  summoner(e, dt) {
    const d = dist(e, P), a = angTo(e, P); e.face = a; e.cd -= dt * e.tempo;
    if (d < 320) e.walk(a + Math.PI, e.spd, dt); else e.walk(a + Math.PI / 2 * e.strafe, e.spd * 0.5, dt);
    if (e.cd <= 0) {
      e.cd = 5.5;
      if (G.enemies.filter(x => !x.dead && x.id === e.def.summon).length < 10) {
        for (let i = 0; i < 3; i++) G.spawnEnemy(e.def.summon, e.x + rand(-60, 60), e.y + rand(-60, 60), { minion: true });
        SFX.play('spawn');
      }
    }
  },
  shield(e, dt) {
    const d = dist(e, P); e.cd -= dt * e.tempo;
    const want = angTo(e, P);
    e.face += clamp(angDiff(e.face, want), -2.2 * dt, 2.2 * dt);
    if (e.state === 'approach') {
      if (d > 70) e.walk(e.face, e.spd, dt);
      if (d < e.def.range + 10 && e.cd <= 0) {
        e.state = 'windup'; e.stT = e.def.windup / e.tempo;
        G.addZone({ shape: 'cone', x: e.x, y: e.y, r: e.def.range + 22, ang: e.face, arc: e.def.arc, warn: e.stT, dmg: e.dmg, owner: e, follow: true });
      }
    } else AI.melee(e, dt);
  },
  leaper(e, dt) {
    const d = dist(e, P); e.cd -= dt * e.tempo;
    if (e.state === 'approach') {
      e.face = angTo(e, P);
      e.walk(e.face + (d < 150 ? Math.PI : 0), e.spd, dt);
      if (d < 420 && e.cd <= 0) { e.state = 'crouch'; e.stT = 0.45; }
    } else if (e.state === 'crouch') {
      e.stT -= dt;
      if (e.stT <= 0) {
        const tgt = G.clampToArena(P.x, P.y, e.r);
        e.from = { x: e.x, y: e.y }; e.to = tgt; e.state = 'air'; e.stT = 0.75; SFX.play('dash', 0.5);
        G.addZone({ shape: 'circle', x: tgt.x, y: tgt.y, r: 90, warn: 0.75, dmg: e.dmg, owner: e, keepOnDeath: false, color: '#ffb347', onFire: z => { G.shake(6); SFX.play('boom', 0.5); G.parts.burst(z.x, z.y, 14, { type: 'smoke', color: '#998', min: 50, max: 200, size: 6 }); } });
      }
    } else if (e.state === 'air') {
      e.stT -= dt; const k = 1 - Math.max(0, e.stT) / 0.75;
      e.x = lerp(e.from.x, e.to.x, k); e.y = lerp(e.from.y, e.to.y, k); e.hop = Math.sin(Math.PI * k) * 140;
      if (e.stT <= 0) { e.hop = 0; e.state = 'recover'; e.stT = 0.8; }
    } else { e.stT -= dt; if (e.stT <= 0) { e.state = 'approach'; e.cd = 2.2 * rand(0.8, 1.2); } }
  },
  caster(e, dt) {
    const d = dist(e, P), a = angTo(e, P); e.face = a; e.cd -= dt * e.tempo;
    if (d < 320) e.walk(a + Math.PI, e.spd, dt); else if (d > 520) e.walk(a, e.spd, dt); else e.walk(a + Math.PI / 2 * e.strafe, e.spd * 0.5, dt);
    if (e.cd <= 0) {
      e.cd = 3.3 * rand(0.85, 1.2);
      const lead = { x: P.x + P.vxEst * 0.5, y: P.y + P.vyEst * 0.5 };
      for (let i = 0; i < 3; i++) {
        const p = G.clampToArena(lead.x + (i ? rand(-90, 90) : 0), lead.y + (i ? rand(-90, 90) : 0), 30);
        if (e.def.fieldCast) G.addZone({ shape: 'circle', x: p.x, y: p.y, r: 75, warn: 1.0, dur: 3.2, field: true, tick: 0, dmg: e.dmg * 0.6, color: '#ffb347', kind: 'fire', owner: e, keepOnDeath: true });
        else G.addZone({ shape: 'circle', x: p.x, y: p.y, r: 62, warn: 1.0, dmg: e.dmg, color: '#9ee7ff', kind: 'icicle', owner: e, keepOnDeath: true, onFire: z => { G.parts.burst(z.x, z.y, 10, { type: 'shard', color: '#dff8ff', min: 60, max: 200 }); SFX.play('freeze', 0.4); } });
      }
    }
  },
  assassin(e, dt) {
    const d = dist(e, P); e.cd -= dt * e.tempo;
    if (e.state === 'approach') {
      e.face = angTo(e, P); e.walk(e.face + Math.PI / 2 * e.strafe * 0.6, e.spd * 0.6, dt);
      if (e.cd <= 0) { e.state = 'fade'; e.stT = 0.3; }
    } else if (e.state === 'fade') {
      e.stT -= dt; e.alpha = Math.max(0.05, e.stT / 0.3);
      if (e.stT <= 0) {
        const p = G.clampToArena(P.x - Math.cos(P.aim) * 75, P.y - Math.sin(P.aim) * 75, e.r);
        e.x = p.x; e.y = p.y; e.alpha = 1; e.face = angTo(e, P);
        e.state = 'windup'; e.stT = 0.4 / e.tempo;
        G.addZone({ shape: 'cone', x: e.x, y: e.y, r: 120, ang: e.face, arc: 1.5, warn: e.stT, dmg: e.dmg, owner: e, follow: true, color: '#c084ff' });
        G.parts.burst(e.x, e.y - 15, 10, { color: '#c084ff', min: 40, max: 160 });
      }
    } else if (e.state === 'windup') { e.stT -= dt; if (e.stT <= 0) { e.state = 'recover'; e.stT = 0.6; SFX.play('slash', 0.6); } }
    else { e.stT -= dt; if (e.stT <= 0) { e.state = 'approach'; e.cd = 2.6 * rand(0.8, 1.2); } }
  },
  sniper(e, dt) {
    const d = dist(e, P), a = angTo(e, P); e.cd -= dt * e.tempo;
    if (e.state === 'approach') {
      e.face = a;
      if (d < 380) e.walk(a + Math.PI, e.spd, dt); else if (d > 600) e.walk(a, e.spd, dt); else e.walk(a + Math.PI / 2 * e.strafe, e.spd * 0.4, dt);
      if (e.cd <= 0) {
        e.state = 'aim'; e.stT = 1.25;
        e.aimZone = G.addZone({ shape: 'line', x: e.x, y: e.y - 14, ang: a, len: 1100, w: 6, warn: 1.25, dmg: 0, owner: e, visual: true, track: 0.3, color: '#5ad1ff' });
      }
    } else if (e.state === 'aim') {
      e.stT -= dt;
      if (e.stT > 0.3) e.face = angTo(e, P);
      if (e.stT <= 0) {
        G.eProj({ x: e.x, y: e.y - 14, ang: e.face, speed: 1150, dmg: e.dmg, r: 9, color: '#bff0ff', kind: 'arrow' });
        SFX.play('arrow'); e.state = 'approach'; e.cd = 2.6 * rand(0.8, 1.2);
      }
    }
  },
};

/* ---------- boss AI ---------- */
function BOSS_AI(e, dt) {
  if (e.intro > 0) { e.intro -= dt; return; }
  const d = e.def;
  while (e.phase < d.phases.length && e.hp / e.maxHp <= d.phases[e.phase]) {
    e.phase++; G.bossPhase(e);
  }
  e.face = angTo(e, P);
  if (e.busy > 0) { e.busy -= dt; return; }
  if (d.desperation && !e.despDone && e.hp / e.maxHp < d.desperation.at) { e.despDone = true; BOSS_PAT[d.desperation.pat](e); return; }
  if (e.rest > 0) {
    e.rest -= dt;
    const dd = dist(e, P);
    const want = d.hover ? 330 : ({ mecha: 260, bakusou: 300, daigo: 190, tamamo: 280, duel_sekka: 340, duel_kuroto: 150, okina: 270 }[e.id] || 210);
    if (dd > want + 40) e.walk(e.face, e.spd, dt);
    else if (dd < want - 60) e.walk(e.face + Math.PI, e.spd * 0.7, dt);
    else e.walk(e.face + Math.PI / 2 * e.strafe, e.spd * 0.6, dt);
    if (Math.random() < dt * 0.3) e.strafe *= -1;
    return;
  }
  const pats = d.patterns[Math.min(e.phase, d.patterns.length - 1)];
  let p = pick(pats); if (p === e.lastPat && pats.length > 1) p = pick(pats.filter(x => x !== p));
  e.lastPat = p;
  BOSS_PAT[p](e);
  e.rest = Math.max(0.35, (1.15 - e.phase * 0.25) * e.speedMul);
}

const BOSS_PAT = {
  dashSlash(e) {
    const n = e.id === 'thousandth' ? 4 : 2 + e.phase;
    let t = 0;
    for (let i = 0; i < n; i++) {
      G.after(t, () => {
        const a = angTo(e, P), len = clamp(dist(e, P) + 170, 220, 580);
        e.face = a;
        G.addZone({ shape: 'line', x: e.x, y: e.y, ang: a, len, w: 64, warn: 0.55 * e.speedMul, dmg: e.dmg * 1.3, owner: e, color: '#ff3355',
          onFire: () => { const x0 = e.x, y0 = e.y; G.moveSafe(e, Math.cos(a) * len, Math.sin(a) * len); G.fxLine(x0, y0, e.x, e.y, '#ff3355', 18, 0.3); SFX.play('heavy'); G.shake(5); for (let k = 0; k < 3; k++) G.ghostE(e, lerp(x0, e.x, k / 3), lerp(y0, e.y, k / 3)); } });
      }, e);
      t += 0.78 * e.speedMul;
    }
    e.busy = t + 0.35;
  },
  crescent(e) {
    const n = 3 + e.phase * 2;
    for (let v = 0; v < 2; v++) {
      G.after(v * 0.55, () => {
        const a = angTo(e, P);
        for (let i = 0; i < n; i++) G.eProj({ x: e.x, y: e.y - 20, ang: a + (i - (n - 1) / 2) * 0.22, speed: 380, dmg: e.dmg, r: 14, color: '#ff3355', kind: 'crescent' });
        SFX.play('slash');
      }, e);
    }
    e.busy = 1.3;
  },
  iaiCircle(e) {
    G.say(e, pick(['Iaido...', 'Be still.', 'Kesa-giri!']));
    G.addZone({ shape: 'circle', x: e.x, y: e.y, r: 175, warn: 0.8 * e.speedMul, dmg: e.dmg * 1.5, owner: e, follow: true, color: '#ff3355',
      onFire: z => { G.fxSlash({ x: z.x, y: z.y - 15, r: 170, ang: 0, arc: TAU, color: '#ff3355', dur: 0.3, width: 1.6 }); SFX.play('heavy'); G.shake(6); } });
    if (e.phase >= 1) G.after(0.55 * e.speedMul, () => G.addZone({ shape: 'ring', x: e.x, y: e.y, r: 175, r2: 320, warn: 0.6, dmg: e.dmg * 1.2, owner: e, color: '#ff3355' }), e);
    e.busy = 1.6;
  },
  petalStorm(e) {
    G.say(e, 'Scatter, petals of the crimson plum.');
    let a = rand(0, TAU);
    for (let i = 0; i < 28; i++) {
      G.after(0.3 + i * 0.1, () => {
        a += 0.42;
        for (let k = 0; k < 3; k++) G.eProj({ x: e.x, y: e.y - 20, ang: a + k * TAU / 3, speed: 200, dmg: e.dmg * 0.8, r: 8, color: '#ffb7c8', kind: 'petal' });
      }, e);
    }
    e.busy = 3.3;
  },
  shadowClones(e) {
    G.say(e, 'Shadows of my students... rise.');
    for (let i = 0; i < 2; i++) G.spawnEnemy('hshade', e.x + rand(-120, 120), e.y + rand(-80, 80), { minion: true, hpMult: 0.5 * G.actMult(), dmgMult: 0.55 });
    e.busy = 0.8;
  },
  laserSweep(e) {
    const a0 = angTo(e, P) - 1.3 * e.strafe;
    G.addZone({ shape: 'beam', x: e.x, y: e.y - 30, ang: a0, len: 1100, w: 34, warn: 0.9, dur: 2.0, rot: 1.3 * e.strafe, dmg: e.dmg, owner: e, follow: true, color: '#ff4fd8', onFire: () => SFX.play('laser') });
    e.busy = 3.1;
  },
  doubleLaser(e) {
    const a0 = angTo(e, P) + Math.PI / 2;
    for (const off of [0, Math.PI]) G.addZone({ shape: 'beam', x: e.x, y: e.y - 30, ang: a0 + off, len: 1100, w: 34, warn: 1.0, dur: 2.6, rot: 1.0 * e.strafe, dmg: e.dmg, owner: e, follow: true, color: '#ff4fd8', onFire: () => SFX.play('laser') });
    e.busy = 3.8;
  },
  missiles(e) {
    G.say(e, 'MISSILE BARRAGE. HAVE A NICE DAY.');
    const n = 6 + e.phase * 3;
    for (let i = 0; i < n; i++) {
      G.after(i * 0.13, () => {
        const p = G.clampToArena(P.x + rand(-140, 140) + P.vxEst * 0.4, P.y + rand(-140, 140), 40);
        G.addZone({ shape: 'circle', x: p.x, y: p.y, r: 72, warn: 0.95, dmg: e.dmg, color: '#ff8a3d', kind: 'missile', onFire: z => G.boom(z.x, z.y, 72) });
      }, e);
    }
    e.busy = 1.2 + n * 0.13;
  },
  rocketPunch(e) {
    for (let i = 0; i < (e.phase >= 2 ? 3 : 2); i++) {
      G.after(i * 1.0, () => {
        const a = angTo(e, P), len = clamp(dist(e, P) + 140, 250, 620);
        G.addZone({ shape: 'line', x: e.x, y: e.y, ang: a, len, w: 90, warn: 0.7, dmg: e.dmg * 1.4, owner: e, color: '#ff4f4f',
          onFire: () => { G.moveSafe(e, Math.cos(a) * len, Math.sin(a) * len); G.shake(10); SFX.play('boom'); G.parts.burst(e.x, e.y, 20, { type: 'smoke', color: '#aaa', min: 60, max: 260, size: 6 }); } });
      }, e);
    }
    e.busy = e.phase >= 2 ? 3.2 : 2.2;
  },
  bulletRing(e) {
    for (let w = 0; w < 3 + e.phase; w++) {
      G.after(w * 0.45, () => {
        const n = 22, gap = rand(0, TAU);
        for (let i = 0; i < n; i++) { const a = gap + i * TAU / n; if (i < 3) continue; G.eProj({ x: e.x, y: e.y - 30, ang: a, speed: 230, dmg: e.dmg * 0.8, r: 8, color: '#49f0ff', kind: 'orb' }); }
        SFX.play('eshoot');
      }, e);
    }
    e.busy = 2.2;
  },
  drones(e) {
    G.say(e, 'DEPLOYING FRIENDS.');
    if (G.enemies.filter(x => !x.dead && x.minion).length < 4)
      for (let i = 0; i < 2; i++) G.spawnEnemy('drone', e.x + rand(-150, 150), e.y + rand(-100, 100), { minion: true, hpMult: G.actMult() * 0.8 });
    e.busy = 0.9;
  },
  iceRing(e) {
    for (let w = 0; w < 3; w++) {
      G.after(w * 0.6, () => {
        const n = 26, gapA = angTo(e, P) + rand(-1.5, 1.5);
        for (let i = 0; i < n; i++) {
          const a = i * TAU / n;
          if (Math.abs(angDiff(a, gapA)) < 0.38) continue;
          G.eProj({ x: e.x, y: e.y - 20, ang: a, speed: 200, dmg: e.dmg * 0.8, r: 9, color: e.id === 'mugen' ? '#c084ff' : '#9ee7ff', kind: 'shard' });
        }
        SFX.play('freeze', 0.5);
      }, e);
    }
    e.busy = 2.2;
  },
  icicles(e) {
    const a = angTo(e, P);
    for (const off of [-0.45, 0, 0.45]) G.addZone({ shape: 'line', x: e.x, y: e.y, ang: a + off, len: 900, w: 44, warn: 0.75, dmg: e.dmg, color: '#9ee7ff', owner: e, onFire: z => { G.fxLine(z.x, z.y, z.x + Math.cos(z.ang) * z.len, z.y + Math.sin(z.ang) * z.len, '#e8fbff', 14, 0.3); SFX.play('freeze', 0.6); } });
    G.after(0.6, () => { const a2 = angTo(e, P); for (const off of [-0.22, 0.22]) G.addZone({ shape: 'line', x: e.x, y: e.y, ang: a2 + off, len: 900, w: 44, warn: 0.7, dmg: e.dmg, color: '#9ee7ff', owner: e }); }, e);
    e.busy = 1.8;
  },
  icicleGrid(e) {
    G.say(e, 'Freeze in place, little flame.');
    const R = G.room;
    for (let k = 0; k < 2; k++) {
      G.after(k * 1.0, () => {
        const off = k ? 0.5 : 0;
        for (let i = 0; i < 4; i++) { const x = R.x0 + (i + 0.5 + off * 0.5) * (R.w / 4); G.addZone({ shape: 'line', x, y: R.y0, ang: Math.PI / 2, len: R.h, w: 50, warn: 1.0, dmg: e.dmg, color: '#9ee7ff' }); }
        for (let i = 0; i < 3; i++) { const y = R.y0 + (i + 0.5 + off * 0.5) * (R.h / 3); G.addZone({ shape: 'line', x: R.x0, y, ang: 0, len: R.w, w: 50, warn: 1.0, dmg: e.dmg, color: '#9ee7ff' }); }
      }, e);
    }
    e.busy = 2.6;
  },
  blizzard(e) {
    G.say(e, 'Let the white silence fall.');
    const R = G.room;
    for (let i = 0; i < 30; i++) {
      G.after(i * 0.08, () => {
        const x = rand(R.x0, R.x0 + R.w), y = R.y0 + 10;
        G.eProj({ x, y, ang: angTo({ x, y }, P) + rand(-0.3, 0.3), speed: rand(150, 230), dmg: e.dmg * 0.7, r: 9, color: '#e8fbff', kind: 'flake', life: 6 });
      }, e);
    }
    e.busy = 2.8;
  },
  mirrors(e) {
    G.say(e, 'My servants. Embrace them.');
    if (G.enemies.filter(x => !x.dead && x.minion).length < 4)
      for (let i = 0; i < 2; i++) G.spawnEnemy('wraith', e.x + rand(-160, 160), e.y + rand(-100, 100), { minion: true, hpMult: G.actMult() * 0.7 });
    e.busy = 0.8;
  },
  whiteSilence(e) { BOSS_PAT.eclipse(e, '#e8fbff', 'WHITE SILENCE.'); },
  eclipse(e, col, line) {
    G.say(e, line || 'ECLIPSE. Find the light, or be devoured.');
    const R = G.room, safes = [];
    for (let i = 0; i < 2; i++) safes.push(G.clampToArena(rand(R.x0 + 120, R.x0 + R.w - 120), rand(R.y0 + 120, R.y0 + R.h - 120), 100));
    G.addZone({ shape: 'inverse', x: R.x0, y: R.y0, safes, sr: 95, warn: 2.2, dmg: e.dmg * 2, color: col || '#c084ff', onFire: () => { G.flash(col || '#3a1060', 0.6); G.shake(12); SFX.play('boom'); } });
    e.busy = 2.8;
  },
  voidOrbs(e) {
    const n = 6 + e.phase * 2;
    for (let i = 0; i < n; i++) {
      G.eProj({ x: e.x, y: e.y, ang: 0, speed: 0, dmg: e.dmg * 0.9, r: 12, color: '#c084ff', kind: 'void', life: 4,
        orbit: { c: e, a: i * TAU / n, r: 30, launch: 1.4 + i * 0.08 } });
    }
    SFX.play('spawn');
    e.busy = 2.0;
  },
  hollowGrasp(e) {
    G.say(e, pick(['Nowhere to run.', 'I see you.', 'Your memories are mine.']));
    for (let i = 0; i < 5; i++) G.after(i * 0.38, () => G.addZone({ shape: 'circle', x: P.x, y: P.y, r: 82, warn: 0.62, dmg: e.dmg, color: '#c084ff', onFire: z => { G.parts.burst(z.x, z.y, 14, { color: '#c084ff', type: 'glow', min: 40, max: 200 }); SFX.play('burn'); } }), e);
    e.busy = 2.4;
  },
  mirrorUlt(e) {
    G.cutin('thousandth', 'Senka Ranbu: Kyomu', '千花乱舞・虚無', 'Thousand Hollow Petals');
    SFX.play('ult');
    for (let i = 0; i < 12; i++) G.after(0.5 + i * 0.12, () => {
      const p = G.clampToArena(P.x + rand(-110, 110), P.y + rand(-110, 110), 40);
      G.addZone({ shape: 'circle', x: p.x, y: p.y, r: 62, warn: 0.5, dmg: e.dmg * 0.8, color: '#ff2e63', onFire: z => G.fxSlash({ x: z.x, y: z.y - 10, r: 60, ang: rand(0, TAU), arc: 2.4, color: '#ff2e63', dur: 0.2 }) });
    }, e);
    e.busy = 2.6;
  },
  moonfall(e) {
    G.say(e, 'Let the moon fall on both of us.');
    for (let i = 0; i < 4; i++) G.after(i * 0.4, () => {
      const p = i === 0 ? { x: P.x, y: P.y } : G.clampToArena(rand(G.room.x0 + 150, G.room.x0 + G.room.w - 150), rand(G.room.y0 + 150, G.room.y0 + G.room.h - 150), 150);
      G.addZone({ shape: 'circle', x: p.x, y: p.y, r: 165, warn: 1.4, dmg: e.dmg * 1.6, color: '#ffd56b', kind: 'moon', onFire: z => G.boom(z.x, z.y, 165) });
    }, e);
    e.busy = 3.0;
  },
};

/* ------------------------------------------------------------------ */
/*  PROJECTILES                                                        */
/* ------------------------------------------------------------------ */
class Proj {
  constructor(o) {
    Object.assign(this, { r: 8, life: 3, pierce: 0, kb: 0, t: 0 }, o);
    this.vx = Math.cos(o.ang) * o.speed; this.vy = Math.sin(o.ang) * o.speed;
    this.hit = new Set(); this.dead = false; this.sx = o.x; this.sy = o.y;
    if (this.team === 'p' && G.timeStopT > 0) this.hang = true;
  }
  update(dt) {
    if (this.hang && G.timeStopT > 0) return;
    this.t += dt;
    if (this.delayAim !== undefined && !this.aimed) {
      const k = Math.pow(0.004, dt); this.vx *= k; this.vy *= k;
      if (this.t >= this.delayAim) { this.aimed = true; const a = Math.atan2(P.y - 16 - this.y, P.x - this.x) + (this.aimOff || 0); this.vx = Math.cos(a) * this.aimSpeed; this.vy = Math.sin(a) * this.aimSpeed; }
    }
    if (this.turn) { const sp = Math.hypot(this.vx, this.vy), a = Math.atan2(this.vy, this.vx) + this.turn * dt; this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp; }
    if (this.accel) { const sp = Math.hypot(this.vx, this.vy) || 1, ns = clamp(sp + this.accel * dt, this.minSpd || 20, this.maxSpd || 900); this.vx *= ns / sp; this.vy *= ns / sp; }
    if (this.gy) this.vy += this.gy * dt;
    if (this.t > this.life) { this.dead = true; return; }
    if (this.orbit) {
      const o = this.orbit;
      if (this.t < o.launch && !o.c.dead) {
        o.a += dt * 2.5; o.r += dt * 70;
        this.x = o.c.x + Math.cos(o.a) * o.r; this.y = o.c.y - 20 + Math.sin(o.a) * o.r;
        return;
      } else if (!this.launched) {
        this.launched = true; const a = angTo(this, P);
        this.vx = Math.cos(a) * 360; this.vy = Math.sin(a) * 360;
      }
    }
    if (this.returning && !this.back) {
      if (Math.hypot(this.x - this.sx, this.y - this.sy) > this.returning) { this.back = true; this.hit.clear(); }
    }
    if (this.back) {
      const tg = this.team === 'p' ? { x: P.x, y: P.y - 16 } : (this.owner && !this.owner.dead ? { x: this.owner.x, y: this.owner.y - 20 } : null);
      if (!tg) { this.dead = true; return; }
      const a = Math.atan2(tg.y - this.y, tg.x - this.x), sp = Math.hypot(this.vx, this.vy) || 700;
      this.vx = Math.cos(a) * Math.max(sp, 760); this.vy = Math.sin(a) * Math.max(sp, 760);
      if (Math.hypot(tg.x - this.x, tg.y - this.y) < 26) { this.dead = true; return; }
    }
    if (this.homing && this.t > 0.1) {
      const tg = this.team === 'p' ? G.nearestEnemy(this.x, this.y, 420) : (this.t < 2.5 ? { x: P.x, y: P.y - 16, r: 0 } : null);
      if (tg) {
        const cur = Math.atan2(this.vy, this.vx), want = Math.atan2(tg.y - (tg.r || 0) * 0.8 - this.y, tg.x - this.x), sp = Math.hypot(this.vx, this.vy);
        const na = cur + clamp(angDiff(cur, want), -this.homing * dt, this.homing * dt);
        this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
      }
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.wave) { const sp = Math.hypot(this.vx, this.vy) || 1, ph = Math.cos(this.t * 7) * this.wave * 7 * dt; this.x += -this.vy / sp * ph; this.y += this.vx / sp * ph; }
    if (this.bounce > 0 && G.blocked(this.x, this.y, this.r * 0.5)) {
      this.bounce--; const R = G.room;
      if (this.x < R.x0 + WALL + 10 || this.x > R.x0 + R.w - WALL - 10) this.vx *= -1; else this.vy *= -1;
      this.x += this.vx * dt * 2; this.y += this.vy * dt * 2; SFX.play('clang', 0.25);
    }
    if (!this.returning && !this.orbit && G.blocked(this.x, this.y, this.r * 0.5)) {
      this.dead = true; G.parts.burst(this.x, this.y, 5, { color: this.color, min: 30, max: 120 }); return;
    }
    if (this.team === 'p') {
      for (const e of G.enemies) {
        if (e.dead || e.spawnT > 0 || this.hit.has(e)) continue;
        if (Math.hypot(e.x - this.x, e.y - e.r - this.y) < e.r + this.r) {
          this.hit.add(e);
          G.damageEnemy(e, this.dmg, { slot: this.slot, kb: this.kb, kbAng: Math.atan2(this.vy, this.vx) });
          if (this.pierce-- <= 0) { this.dead = true; break; }
        }
      }
    } else {
      if (Math.hypot(P.x - this.x, P.y - 16 - this.y) < this.r + P.r - 2) {
        if (G.hurtPlayer(this.dmg, this)) { if (this.slow && P.parryT <= 0 && P.domainT <= 0) P.slowT = 1.5; if (!this.returning) this.dead = true; }
        else if (P.dashT > 0 && !this.grazed) { this.grazed = true; P.ult = Math.min(100, P.ult + 1.5); }
      }
    }
  }
  draw(ctx) {
    const a = Math.atan2(this.vy, this.vx);
    ctx.save(); ctx.translate(this.x, this.y);
    const c = this.color;
    switch (this.kind) {
      case 'arrow':
        ctx.rotate(a); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba(c, 0.35); ell(ctx, -10, 0, 22, 6);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-14, -3); ctx.lineTo(-14, 3); ctx.fill();
        break;
      case 'crescent':
        ctx.rotate(a); ctx.fillStyle = c; ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath(); ctx.arc(0, 0, this.r * 1.3, -1.3, 1.3); ctx.arc(-6, 0, this.r * 1.0, 1.2, -1.2, true); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, this.r * 1.1, -0.8, 0.8); ctx.arc(-4, 0, this.r * 1.0, 0.7, -0.7, true); ctx.fill();
        break;
      case 'getsuga': {
        ctx.rotate(a); ctx.globalCompositeOperation = 'lighter';
        const R = this.r * 1.5, fade = Math.min(1, (this.life - this.t) * 4);
        ctx.globalAlpha = fade;
        ctx.fillStyle = rgba(c, 0.55); ctx.beginPath(); ctx.arc(0, 0, R, -1.4, 1.4); ctx.arc(-R * 0.35, 0, R * 0.85, 1.25, -1.25, true); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, R * 0.95, -1.0, 1.0); ctx.arc(-R * 0.15, 0, R * 0.85, 0.95, -0.95, true); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        if (c === '#c8102e') { ctx.fillStyle = 'rgba(10,0,4,.8)'; ctx.beginPath(); ctx.arc(-4, 0, R * 0.9, -1.1, 1.1); ctx.arc(-R * 0.3, 0, R * 0.8, 1.0, -1.0, true); ctx.fill(); }
        break;
      }
      case 'knife':
        ctx.rotate(a); ctx.fillStyle = '#dfe8f0'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-4, -2.5); ctx.lineTo(-4, 2.5); ctx.fill();
        ctx.fillStyle = '#c84a6a'; ctx.fillRect(-10, -1.5, 6, 3);
        if (this.hang) { ctx.strokeStyle = 'rgba(160,190,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.stroke(); }
        break;
      case 'coin':
        ctx.rotate(this.t * 14); ctx.fillStyle = '#ffcf40'; ell(ctx, 0, 0, this.r, this.r * Math.abs(Math.cos(this.t * 10)) + 1);
        ctx.fillStyle = '#b8862a'; ctx.fillRect(-2, -2, 4, 4);
        break;
      case 'wblade':
        ctx.rotate(a); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(c, 0.7);
        ctx.beginPath(); ctx.arc(0, 0, this.r * 1.2, -1.2, 1.2); ctx.arc(-6, 0, this.r, 1.0, -1.0, true); ctx.fill();
        break;
      case 'chakram':
        ctx.rotate(this.t * 20); ctx.fillStyle = rgba(c, 0.35); circ(ctx, 0, 0, this.r * 1.2); ctx.fillStyle = '#efe8ff';
        for (let i = 0; i < 2; i++) { ctx.rotate(Math.PI); ctx.beginPath(); ctx.arc(0, 0, this.r, -0.3, 1.6); ctx.arc(-this.r * 0.25, this.r * 0.15, this.r * 0.8, 1.6, -0.3, true); ctx.fill(); }
        break;
      case 'needle':
        ctx.rotate(a); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(c, 0.5); ell(ctx, 0, 0, this.r * 2.2, this.r * 0.7);
        ctx.fillStyle = '#fff'; ell(ctx, 0, 0, this.r * 1.4, this.r * 0.35);
        break;
      case 'web':
        ctx.rotate(this.t * 3); ctx.strokeStyle = c; ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(-this.r, 0); ctx.lineTo(this.r, 0); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(0, 0, this.r * 0.6, 0, TAU); ctx.stroke();
        break;
      case 'bubble':
        ctx.globalAlpha = 0.85; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.fillStyle = rgba(c, 0.2);
        ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; circ(ctx, -this.r * 0.35, -this.r * 0.35, this.r * 0.22);
        break;
      case 'gear':
        ctx.rotate(this.t * 10); ctx.fillStyle = '#b8a06a'; star(ctx, 0, 0, this.r, this.r * 0.72, 8); ctx.fill();
        ctx.fillStyle = '#3a2a14'; circ(ctx, 0, 0, this.r * 0.3);
        break;
      case 'shuriken':
        ctx.rotate(this.t * 22); ctx.fillStyle = c; star(ctx, 0, 0, this.r, this.r * 0.3, 4); ctx.fill();
        break;
      case 'flare':
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(c, 0.45); circ(ctx, 0, 0, this.r * 1.8);
        ctx.fillStyle = '#1a0a00'; circ(ctx, 0, 0, this.r * 0.8); ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, this.r * 0.9, 0, TAU); ctx.stroke();
        break;
      case 'ofuda':
        ctx.rotate(a + Math.PI / 2 + Math.sin(this.t * 20) * 0.2);
        ctx.fillStyle = rgba(c, 0.4); ctx.globalCompositeOperation = 'lighter'; circ(ctx, 0, 0, 12); ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#fffbe8'; ctx.fillRect(-4, -8, 8, 16); ctx.fillStyle = '#c8302c'; ctx.fillRect(-1.5, -5, 3, 10);
        break;
      case 'scythe':
        ctx.rotate(this.t * 18); ctx.fillStyle = rgba(c, 0.3); circ(ctx, 0, 0, this.r * 1.2);
        ctx.fillStyle = '#e8e0ff';
        for (let i = 0; i < 2; i++) { ctx.rotate(Math.PI); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(this.r * 1.2, -this.r * 0.2, this.r * 0.7, this.r * 1.1); ctx.quadraticCurveTo(this.r * 0.7, this.r * 0.2, 0, 0); ctx.fill(); }
        break;
      case 'shard':
        ctx.rotate(a); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(this.r * 1.6, 0); ctx.lineTo(0, -this.r * 0.6); ctx.lineTo(-this.r, 0); ctx.lineTo(0, this.r * 0.6); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(this.r * 1.2, 0); ctx.lineTo(0, -this.r * 0.3); ctx.lineTo(-this.r * 0.4, 0); ctx.fill();
        break;
      case 'petal':
        ctx.rotate(this.t * 6); ctx.fillStyle = c; ell(ctx, 0, 0, this.r * 1.3, this.r * 0.7);
        ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.6; ell(ctx, -2, -1, this.r * 0.5, this.r * 0.3);
        break;
      case 'flake':
        ctx.rotate(this.t * 2); ctx.strokeStyle = c; ctx.lineWidth = 2.5;
        for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(-this.r, 0); ctx.lineTo(this.r, 0); ctx.stroke(); }
        break;
      case 'void':
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(c, 0.4); circ(ctx, 0, 0, this.r * 1.6);
        ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#0a0612'; circ(ctx, 0, 0, this.r * 0.8);
        ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU); ctx.stroke();
        break;
      default:
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba(c, 0.35); circ(ctx, 0, 0, this.r * 1.7);
        ctx.fillStyle = c; circ(ctx, 0, 0, this.r);
        ctx.fillStyle = '#fff'; circ(ctx, 0, 0, this.r * 0.5);
    }
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ */
/*  ZONES (telegraphs and area attacks)                                */
/* ------------------------------------------------------------------ */
class Zone {
  constructor(o) {
    Object.assign(this, { team: 'e', dur: 0.1, t: 0, color: '#ff3355', w: 40, arc: 1, r2: 0, rot: 0, tick: 0 }, o);
    this.maxWarn = this.warn; this.fired = false; this.dead = false; this.hitDone = false;
  }
  inside(px, py, pr = 0) {
    const dx = px - this.x, dy = py - this.y, d = Math.hypot(dx, dy);
    switch (this.shape) {
      case 'circle': return d < this.r + pr;
      case 'ring': return d > this.r - pr && d < this.r2 + pr;
      case 'arcring': return d > this.r - pr && d < this.r2 + pr && Math.abs(angDiff(this.gap, Math.atan2(dy, dx))) > this.gapW / 2;
      case 'cone': return d < this.r + pr && Math.abs(angDiff(this.ang, Math.atan2(dy, dx))) < this.arc / 2 + 0.15;
      case 'line': case 'beam': {
        const x2 = this.x + Math.cos(this.ang) * this.len, y2 = this.y + Math.sin(this.ang) * this.len;
        return segDist(px, py, this.x, this.y, x2, y2) < this.w / 2 + pr;
      }
      case 'inverse': return !this.safes.some(s => Math.hypot(px - s.x, py - s.y) < this.sr - 4);
    }
    return false;
  }
  update(dt) {
    const o = this.owner;
    if (o && !this.keepOnDeath && (o.dead || (o.disabled && o.disabled() && !o.isBoss))) { this.dead = true; return; }
    if (this.follow && o && !o.dead) { this.x = o.x; this.y = o.y - (this.shape === 'beam' ? 30 : 0); if (this.aimOwner) this.ang = o.face; }
    if (this.track && this.warn > this.track && P) this.ang = angTo(this, { x: P.x, y: P.y - 14 });
    if (!this.fired) {
      this.warn -= dt;
      if (this.warn <= 0) {
        this.fired = true;
        if (this.onFire) this.onFire(this);
        if (!this.visual) this.applyHit();
      }
    } else {
      this.t += dt;
      if (this.shape === 'beam') {
        this.ang += this.rot * dt; this.tick -= dt;
        if (this.tick <= 0) { this.tick = 0.3; this.applyHit(true); }
      }
      if (this.field && P) {
        this.tick -= dt;
        if (this.dmg > 0 && this.tick <= 0) { this.tick = 0.4; this.applyHit(true); }
        if (this.slowField && this.inside(P.x, P.y, 0)) P.slowT = Math.max(P.slowT, 0.2);
        if (this.pull) {
          const a = Math.atan2(this.y - P.y, this.x - P.x), d = Math.hypot(this.x - P.x, this.y - P.y);
          if (d < this.r * 2.2 && d > 20) G.moveSafe(P, Math.cos(a) * this.pull * dt, Math.sin(a) * this.pull * dt);
        }
      }
      if (this.t >= this.dur) this.dead = true;
    }
  }
  applyHit(repeat) {
    if (this.team === 'e') {
      const inner = this.field && this.pull ? this.r * 0.4 : null;
      if (P && this.dmg > 0 && (inner ? Math.hypot(P.x - this.x, P.y - this.y) < inner : this.inside(P.x, P.y - 10, P.r * 0.6))) G.hurtPlayer(this.dmg, this);
    } else {
      if (this.shape === 'circle') G.hitCircle(this.x, this.y, this.r, this.dmg, { slot: this.slot, kb: 200, noProc: this.noProc, quiet: this.quiet });
    }
  }
  draw(ctx) {
    const k = this.fired ? 1 : 1 - this.warn / this.maxWarn;
    const c = this.color;
    ctx.save();
    if (this.team === 'p') {
      if (this.kind === 'cannon') {
        if (!this.fired) {
          ctx.globalAlpha = 0.5; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
          ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          const bx = lerp(this.sx, this.x, k), by = lerp(this.sy, this.y, k) - Math.sin(Math.PI * k) * 170;
          ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(ctx, lerp(this.sx, this.x, k), lerp(this.sy + 34, this.y, k), 12, 5);
          ctx.fillStyle = '#1a1a20'; circ(ctx, bx, by, 12); ctx.fillStyle = '#ffb347'; circ(ctx, bx - 4, by - 4, 3);
        }
        ctx.restore(); return;
      }
      if (this.quiet) { ctx.globalAlpha = 0.5 * (1 - k); ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.x, this.y, this.r * (0.5 + k * 0.5), 0, TAU); ctx.stroke(); ctx.restore(); return; }
      ctx.globalAlpha = this.fired ? 0.6 * (1 - this.t / this.dur) : 0.6;
      ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -this.warn * 60;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = rgba(c, 0.15 + k * 0.2); circ(ctx, this.x, this.y, this.r * k);
      if (this.kind === 'moonfall' && !this.fired) { ctx.globalAlpha = 0.9; ctx.fillStyle = '#efe8ff'; circ(ctx, this.x, this.y - (1 - k) * 600, 40 + k * 40); ctx.fillStyle = 'rgba(180,156,255,.6)'; circ(ctx, this.x + 12, this.y - (1 - k) * 600 - 8, 14 + k * 10); }
      if (this.kind === 'koban' && !this.fired) { ctx.globalAlpha = 1; ctx.fillStyle = '#ffcf40'; ell(ctx, this.x, this.y - (1 - k) * 300, 10, 14); }
      if (this.kind === 'lotus') { ctx.fillStyle = rgba('#ffffff', 0.4); for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + this.warn * 3; ell(ctx, this.x + Math.cos(a) * this.r * 0.4 * k, this.y + Math.sin(a) * this.r * 0.4 * k, 14 * k, 6 * k, a); } }
      ctx.restore(); return;
    }
    if (this.visual) {
      ctx.globalAlpha = 0.35 + k * 0.4;
      ctx.strokeStyle = c; ctx.lineWidth = this.w; ctx.lineCap = 'round';
      const x2 = this.x + Math.cos(this.ang) * this.len, y2 = this.y + Math.sin(this.ang) * this.len;
      ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.globalAlpha = 0.8; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.restore(); return;
    }
    const fillA = this.fired ? 0.55 * (1 - this.t / Math.max(0.1, this.dur)) : 0.12 + k * 0.22;
    ctx.fillStyle = rgba(c, fillA); ctx.strokeStyle = rgba(c, this.fired ? 0.9 : 0.75); ctx.lineWidth = 2.5;
    const path = (grow) => {
      ctx.beginPath();
      switch (this.shape) {
        case 'circle': ctx.arc(this.x, this.y, this.r * grow, 0, TAU); break;
        case 'ring': ctx.arc(this.x, this.y, this.r2, 0, TAU); ctx.arc(this.x, this.y, this.r2 - (this.r2 - this.r) * grow, 0, TAU, true); break;
        case 'arcring': { const g0 = this.gap + this.gapW / 2, g1 = this.gap - this.gapW / 2 + TAU, ri = this.r2 - (this.r2 - this.r) * grow; ctx.arc(this.x, this.y, this.r2, g0, g1); ctx.arc(this.x, this.y, ri, g1, g0, true); ctx.closePath(); break; }
        case 'cone': ctx.moveTo(this.x, this.y); ctx.arc(this.x, this.y, this.r * grow, this.ang - this.arc / 2, this.ang + this.arc / 2); ctx.closePath(); break;
        case 'line': case 'beam': {
          const c2 = Math.cos(this.ang), s2 = Math.sin(this.ang), hw = this.w / 2 * (this.shape === 'beam' && !this.fired ? 0.25 : 1), L = this.len * (this.shape === 'line' ? grow : 1);
          ctx.moveTo(this.x - s2 * hw, this.y + c2 * hw); ctx.lineTo(this.x + c2 * L - s2 * hw, this.y + s2 * L + c2 * hw);
          ctx.lineTo(this.x + c2 * L + s2 * hw, this.y + s2 * L - c2 * hw); ctx.lineTo(this.x + s2 * hw, this.y - c2 * hw); ctx.closePath(); break;
        }
        case 'inverse':
          ctx.rect(G.room.x0, G.room.y0, G.room.w, G.room.h);
          for (const s of this.safes) { ctx.moveTo(s.x + this.sr, s.y); ctx.arc(s.x, s.y, this.sr, 0, TAU, true); }
          break;
      }
    };
    if (this.field && this.fired) {
      const pulse = 0.5 + Math.sin(this.t * 8) * 0.15, fade = Math.min(1, (this.dur - this.t) * 2);
      ctx.globalAlpha = fade;
      if (this.shape === 'cone') {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) { ctx.fillStyle = rgba(i ? '#ffffff' : c, 0.25 + i * 0.08); ctx.beginPath(); ctx.moveTo(this.x, this.y - 16); ctx.arc(this.x, this.y - 16, this.r * (1 - i * 0.25) * (0.9 + Math.random() * 0.1), this.ang - this.arc / 2 * (1 - i * 0.3), this.ang + this.arc / 2 * (1 - i * 0.3)); ctx.closePath(); ctx.fill(); }
      } else if (this.pull) {
        ctx.strokeStyle = rgba(c, 0.7); ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(this.x, this.y, this.r * (0.3 + i * 0.25), this.t * 4 + i, this.t * 4 + i + 4); ctx.stroke(); }
        ctx.fillStyle = rgba(c, 0.35); circ(ctx, this.x, this.y, this.r * 0.4);
      } else if (this.slowField) {
        ctx.strokeStyle = 'rgba(216,208,255,.6)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 8; i++) { const a = i * TAU / 8; ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r); ctx.stroke(); }
        for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(this.x, this.y, this.r * i / 3, 0, TAU); ctx.stroke(); }
      } else {
        ctx.fillStyle = rgba(c, 0.28 * pulse + 0.1); circ(ctx, this.x, this.y, this.r);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) { ctx.fillStyle = rgba(c, 0.35); const fx = this.x + Math.sin(this.t * 5 + i * 2) * this.r * 0.5, fy = this.y + Math.cos(this.t * 4 + i) * this.r * 0.3; ell(ctx, fx, fy - 8, 6, 14); }
      }
      ctx.restore(); return;
    }
    if (this.shape === 'beam' && this.fired) {
      ctx.globalCompositeOperation = 'lighter';
      const c2 = Math.cos(this.ang), s2 = Math.sin(this.ang);
      ctx.strokeStyle = rgba(c, 0.5); ctx.lineWidth = this.w * 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x + c2 * this.len, this.y + s2 * this.len); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = this.w * 0.45;
      ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x + c2 * this.len, this.y + s2 * this.len); ctx.stroke();
      ctx.restore(); return;
    }
    path(1); ctx.fill('evenodd');
    if (!this.fired) { ctx.stroke(); ctx.fillStyle = rgba(c, 0.25); path(k); ctx.fill('evenodd'); }
    if (this.shape === 'inverse' && !this.fired) {
      for (const s of this.safes) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(s.x, s.y, this.sr, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    }
    if (this.kind === 'bomb' && !this.fired) {
      ctx.fillStyle = '#2a2418'; circ(ctx, this.x, this.y - 10, 16); ctx.fillStyle = '#ffcf40'; ctx.font = '900 18px "Rajdhani", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(Math.ceil(this.warn), this.x, this.y - 10);
      if (Math.floor(this.warn * 4) !== this.lastTick) { this.lastTick = Math.floor(this.warn * 4); SFX.play('tick'); }
    }
    if (this.kind === 'meteor' && !this.fired) {
      ctx.globalCompositeOperation = 'lighter'; const hgt = (1 - k) * 640;
      ctx.fillStyle = 'rgba(255,180,70,.85)'; circ(ctx, this.x + hgt * 0.3, this.y - hgt, 18 + k * 12);
      ctx.fillStyle = 'rgba(255,120,40,.3)'; ell(ctx, this.x + hgt * 0.3 + 20, this.y - hgt - 30, 14, 40, -0.3);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (this.kind === 'icicle' && !this.fired) {
      ctx.fillStyle = 'rgba(220,245,255,.9)'; const hgt = (1 - k) * 380;
      ctx.beginPath(); ctx.moveTo(this.x, this.y - hgt + 10); ctx.lineTo(this.x - 8, this.y - hgt - 30); ctx.lineTo(this.x + 8, this.y - hgt - 30); ctx.fill();
    }
    if (this.kind === 'bolt' && !this.fired && k > 0.7) {
      ctx.strokeStyle = 'rgba(255,240,120,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(this.x, this.y - 500); ctx.lineTo(this.x + rand(-10, 10), this.y - 250); ctx.lineTo(this.x, this.y); ctx.stroke();
    }
    if (this.kind === 'missile' && !this.fired) {
      ctx.fillStyle = '#ffd0a0'; const hgt = (1 - k) * 400;
      ctx.beginPath(); ctx.moveTo(this.x, this.y - hgt); ctx.lineTo(this.x - 6, this.y - hgt - 22); ctx.lineTo(this.x + 6, this.y - hgt - 22); ctx.fill();
    }
    if (this.kind === 'moon' && !this.fired) {
      ctx.fillStyle = 'rgba(255,213,107,.8)'; circ(ctx, this.x, this.y - (1 - k) * 600, 30 + k * 40);
    }
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ */
/*  ENEMY DRAWING                                                      */
/* ------------------------------------------------------------------ */
function shadePal(base, eye, extra = {}) {
  return Object.assign({ hair: base, hair2: shade(base, -0.4), skin: shade(base, 0.15), outfit: base, outfit2: shade(base, -0.5), eye, accent: shade(base, 0.3), scarf: eye }, extra);
}
function eyeGlow(ctx, x, y, c, r = 3) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(c, 0.5); circ(ctx, x, y, r * 2.2); ctx.fillStyle = '#fff'; circ(ctx, x, y, r * 0.8); ctx.restore();
}
const PAL_CACHE = {};
const EDRAW = {
  kappa(ctx, e, t, f) {
    const x = e.x, y = e.y, r = e.r, b = Math.abs(Math.sin(t * 10)) * 3;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(ctx, x, y, r, r * 0.4);
    ctx.fillStyle = f ? '#fff' : '#7a5a2a'; ell(ctx, x, y - r - b, r * 1.0, r * 0.9);
    ctx.fillStyle = f ? '#fff' : e.def.col; circ(ctx, x, y - r - b, r * 0.85);
    ctx.fillStyle = f ? '#fff' : '#ffd23d'; ctx.beginPath(); ctx.moveTo(x - 6, y - r - b + 2); ctx.lineTo(x + 6, y - r - b + 2); ctx.lineTo(x, y - r - b + 10); ctx.fill();
    ctx.fillStyle = '#fff'; circ(ctx, x - 6, y - r - b - 5, 4); circ(ctx, x + 6, y - r - b - 5, 4);
    ctx.fillStyle = '#111'; circ(ctx, x - 5 + Math.cos(e.face) * 1.5, y - r - b - 5, 2); circ(ctx, x + 7 + Math.cos(e.face) * 1.5, y - r - b - 5, 2);
    ctx.fillStyle = '#ff8a3d'; ell(ctx, x, y - r * 1.75 - b, r * 0.6, r * 0.22);
    ctx.fillStyle = 'rgba(255,200,80,.8)'; ell(ctx, x, y - r * 1.8 - b, r * 0.4, r * 0.1);
  },
  ashigaru(ctx, e, t, f) {
    const k = 'ashi';
    PAL_CACHE[k] = PAL_CACHE[k] || shadePal('#2c2f45', '#ff3d5e', { acc2: '#8a1a24', skin: '#3d4060' });
    drawChar(ctx, { x: e.x, y: e.y, s: e.r * 0.8, lookX: Math.cos(e.face), lookY: Math.sin(e.face), pal: PAL_CACHE[k], t, moving: e.moving, flash: f, hair: 'short', acc: 'hat', mood: 'angry' });
    ctx.save(); ctx.translate(e.x, e.y - e.r * 1.2); ctx.rotate(e.face + (e.state === 'windup' ? -0.6 : 0));
    ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(44, 0); ctx.stroke();
    ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(44, -4); ctx.lineTo(58, 0); ctx.lineTo(44, 4); ctx.fill(); ctx.restore();
  },
  lantern(ctx, e, t, f) {
    const x = e.x, y = e.y - 30 + Math.sin(t * 3) * 5, r = e.r;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ell(ctx, e.x, e.y, r * 0.8, r * 0.3);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba('#ff9a3c', e.state === 'aim' ? 0.5 : 0.25); circ(ctx, x, y, r * 2); ctx.restore();
    ctx.fillStyle = f ? '#fff' : e.def.col; ell(ctx, x, y, r, r * 1.25);
    ctx.strokeStyle = 'rgba(120,40,0,.5)'; ctx.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(x, y + i * r * 0.4, r * Math.sqrt(1 - (i * 0.4 / 1.25) ** 2), 2, 0, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = '#2a1a1a'; ctx.fillRect(x - r * 0.5, y - r * 1.35, r, 5); ctx.fillRect(x - r * 0.5, y + r * 1.2, r, 5);
    ctx.fillStyle = '#111'; ell(ctx, x - 6, y - 4, 3, 5); ell(ctx, x + 6, y - 4, 3, 5);
    ctx.fillStyle = '#c21f3a'; ctx.beginPath(); ctx.moveTo(x - 7, y + 5); ctx.quadraticCurveTo(x, y + 26 + Math.sin(t * 8) * 4, x + 7, y + 5); ctx.fill();
  },
  tengu(ctx, e, t, f) {
    const k = 'tengu';
    PAL_CACHE[k] = PAL_CACHE[k] || { hair: '#1a1a26', hair2: '#0d0d14', skin: '#c43030', outfit: '#262636', outfit2: '#12121c', eye: '#ffe14d', accent: '#e8e8e8', scarf: '#c43030' };
    // wings
    ctx.fillStyle = f ? '#fff' : '#121220';
    const fl = Math.sin(t * (e.dashing ? 30 : 6)) * 0.3;
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(e.x, e.y - e.r * 1.6); ctx.lineTo(e.x + sd * e.r * 2.6, e.y - e.r * (2.8 + fl)); ctx.lineTo(e.x + sd * e.r * 2.0, e.y - e.r * 1.1); ctx.lineTo(e.x + sd * e.r * 2.4, e.y - e.r * 1.6); ctx.closePath(); ctx.fill(); }
    drawChar(ctx, { x: e.x, y: e.y, s: e.r * 0.78, lookX: Math.cos(e.face), lookY: Math.sin(e.face), pal: PAL_CACHE[k], t, moving: e.moving, flash: f, hair: 'wild', mood: 'angry' });
    ctx.fillStyle = f ? '#fff' : '#d23b3b'; const hx = e.x + Math.cos(e.face) * 6, hy = e.y - e.r * 2.0;
    ctx.beginPath(); ctx.moveTo(hx - 3, hy); ctx.lineTo(hx + Math.cos(e.face) * 14, hy + 4); ctx.lineTo(hx + 3, hy + 5); ctx.fill();
  },
  kodama(ctx, e, t, f) {
    const x = e.x, y = e.y - e.r - Math.abs(Math.sin(t * 14)) * 4, r = e.r;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ell(ctx, e.x, e.y, r * 0.8, r * 0.3);
    ctx.fillStyle = f ? '#fff' : e.def.col; ell(ctx, x, y, r * 0.9, r * 1.1);
    ctx.fillStyle = '#3a2a1a'; circ(ctx, x - 3.5, y - 2, 2.2); circ(ctx, x + 3.5, y - 2, 2.2); ell(ctx, x, y + 4, 1.8, 2.5);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,120,40,.5)'; circ(ctx, x, y - r, 5 + Math.sin(t * 20) * 2); ctx.restore();
  },
  oni(ctx, e, t, f) {
    const k = 'oni';
    PAL_CACHE[k] = PAL_CACHE[k] || { hair: '#20202a', hair2: '#101018', skin: '#e0435f', outfit: '#3a3a4a', outfit2: '#22222c', eye: '#9ef', accent: '#9ef', scarf: '#9ef', acc2: '#c0c8d8' };
    drawChar(ctx, { x: e.x, y: e.y, s: e.r * 0.7, lookX: Math.cos(e.face), lookY: Math.sin(e.face), pal: PAL_CACHE[k], t, moving: e.moving, flash: f, hair: 'wild', acc: 'horns', mood: 'angry' });
    ctx.save(); ctx.translate(e.x + e.r * 0.8, e.y - e.r * 1.2); ctx.rotate(e.state === 'windup' ? -1.2 : 0.4);
    ctx.fillStyle = f ? '#fff' : '#8a93a8'; rrect(ctx, -5, -40, 10, 46, 4); ctx.fill();
    ctx.fillStyle = '#49f0ff'; for (let i = 0; i < 3; i++) circ(ctx, 0, -32 + i * 12, 2.5); ctx.restore();
  },
  drone(ctx, e, t, f) {
    const x = e.x, y = e.y - 34 + Math.sin(t * 4) * 4, r = e.r;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ell(ctx, e.x, e.y, r * 0.8, r * 0.3);
    ctx.strokeStyle = e.def.col; ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) { const a = Math.PI * 0.6 + i * 0.35 + Math.sin(t * 5 + i) * 0.1; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * r * 1.6, y + Math.sin(a) * r, x + Math.cos(a) * r * 2.2, y + Math.sin(a) * r * 1.6); ctx.stroke(); }
    ctx.fillStyle = f ? '#fff' : '#f2f2ff'; ell(ctx, x, y, r * 1.1, r * 0.8);
    ctx.fillStyle = e.def.col; ctx.beginPath(); ctx.moveTo(x - r * 0.9, y - r * 0.4); ctx.lineTo(x - r * 0.5, y - r * 1.4); ctx.lineTo(x - r * 0.1, y - r * 0.6); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + r * 0.9, y - r * 0.4); ctx.lineTo(x + r * 0.5, y - r * 1.4); ctx.lineTo(x + r * 0.1, y - r * 0.6); ctx.fill();
    ctx.fillStyle = '#111'; rrect(ctx, x - r * 0.7, y - r * 0.25, r * 1.4, r * 0.45, 4); ctx.fill();
    eyeGlow(ctx, x - 5 + Math.cos(e.face) * 3, y, e.state === 'aim' ? '#ff4f4f' : e.def.col2, 2.5); eyeGlow(ctx, x + 5 + Math.cos(e.face) * 3, y, e.state === 'aim' ? '#ff4f4f' : e.def.col2, 2.5);
  },
  umbrella(ctx, e, t, f) {
    const x = e.x, y = e.y - e.r * 1.6 - Math.abs(Math.sin(t * 6)) * 6, r = e.r;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ell(ctx, e.x, e.y, r * 0.9, r * 0.35);
    ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, e.y - 4); ctx.stroke();
    ctx.save(); ctx.translate(x, y); ctx.rotate(e.state === 'spin' ? e.spinA : Math.sin(t * 2) * 0.1);
    ctx.fillStyle = f ? '#fff' : e.def.col;
    ctx.beginPath(); ctx.moveTo(0, -r * 1.2);
    for (let i = 0; i <= 8; i++) { const a = Math.PI + i * Math.PI / 8; ctx.lineTo(Math.cos(a) * r * 1.6, Math.sin(a) * r * 0.9 + r * 0.3 * (i % 2)); }
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff'; circ(ctx, x, y - r * 0.25, 7); ctx.fillStyle = e.def.col2; circ(ctx, x + Math.cos(e.face) * 2, y - r * 0.25, 4); ctx.fillStyle = '#111'; circ(ctx, x + Math.cos(e.face) * 2.5, y - r * 0.25, 2);
    ctx.fillStyle = '#c21f3a'; ell(ctx, x, y + r * 0.35, 4, 7);
  },
  riot(ctx, e, t, f) {
    const k = 'riot';
    PAL_CACHE[k] = PAL_CACHE[k] || shadePal('#33405c', '#49f0ff', { acc2: '#1a2233', skin: '#2a3550' });
    drawChar(ctx, { x: e.x, y: e.y, s: e.r * 0.72, lookX: Math.cos(e.face), lookY: Math.sin(e.face), pal: PAL_CACHE[k], t, moving: e.moving, flash: f, hair: 'short', acc: 'hood', mood: 'angry' });
    ctx.save(); ctx.translate(e.x, e.y - e.r * 1.1); ctx.rotate(e.face);
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(73,240,255,.35)'; ctx.strokeStyle = '#49f0ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, e.r * 1.5, -0.7, 0.7); ctx.arc(0, 0, e.r * 1.2, 0.7, -0.7, true); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  },
  neko(ctx, e, t, f) {
    const x = e.x, y = e.y - e.r, r = e.r, fuse = e.state === 'fuse';
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ell(ctx, e.x, e.y, r, r * 0.35);
    ctx.fillStyle = f || (fuse && Math.floor(t * 16) % 2) ? '#fff' : e.def.col;
    ell(ctx, x, y, r * 1.1, r * 0.9);
    ctx.beginPath(); ctx.moveTo(x - r * 0.8, y - r * 0.4); ctx.lineTo(x - r * 0.6, y - r * 1.3); ctx.lineTo(x - r * 0.1, y - r * 0.7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + r * 0.8, y - r * 0.4); ctx.lineTo(x + r * 0.6, y - r * 1.3); ctx.lineTo(x + r * 0.1, y - r * 0.7); ctx.fill();
    ctx.fillStyle = '#ffe14d'; ell(ctx, x - 5, y - 2, 3, 4); ell(ctx, x + 5, y - 2, 3, 4);
    ctx.fillStyle = '#111'; ell(ctx, x - 5, y - 2, 1, 3.5); ell(ctx, x + 5, y - 2, 1, 3.5);
    ctx.strokeStyle = '#444'; ctx.lineWidth = 2; const tx = x - Math.cos(e.face) * r, ty = y;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx - Math.cos(e.face) * 10, ty - 18, tx - Math.cos(e.face) * 4, ty - 26); ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = fuse ? '#ff4d4d' : '#ffb347'; circ(ctx, tx - Math.cos(e.face) * 4, ty - 27, 3 + Math.random() * 3); ctx.restore();
  },
  wraith(ctx, e, t, f) {
    const x = e.x, y = e.y - 34 + Math.sin(t * 2) * 6, r = e.r;
    ctx.save(); ctx.globalAlpha *= 0.85;
    ctx.fillStyle = f ? '#fff' : e.def.col;
    ctx.beginPath(); ctx.arc(x, y - r * 0.4, r * 0.9, Math.PI, 0);
    for (let i = 0; i <= 5; i++) ctx.lineTo(x + r * 0.9 - i * r * 0.36, y + r * 1.2 + Math.sin(t * 6 + i) * 5 * (i % 2 ? 1 : -1));
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9eaff'; ctx.beginPath(); ctx.moveTo(x - r * 0.9, y - r * 0.3); ctx.lineTo(x - r * 1.3, y + r * 0.9); ctx.lineTo(x - r * 0.6, y + r * 0.2); ctx.fill();
    ctx.fillStyle = '#1a2a3a'; ell(ctx, x - 5, y - r * 0.4, 3, 5); ell(ctx, x + 5, y - r * 0.4, 3, 5);
    if (e.state === 'charge') eyeGlow(ctx, x, y, '#5ad1ff', 8);
    ctx.restore();
  },
  archer(ctx, e, t, f) {
    const k = 'archer';
    PAL_CACHE[k] = PAL_CACHE[k] || { hair: '#d6e6f6', hair2: '#8aa4c0', skin: '#e6eef8', outfit: '#2a3e66', outfit2: '#16223a', eye: '#5ad1ff', accent: '#e8fbff', scarf: '#5ad1ff', acc2: '#c9dff2' };
    drawChar(ctx, { x: e.x, y: e.y, s: e.r * 0.8, lookX: Math.cos(e.face), lookY: Math.sin(e.face), pal: PAL_CACHE[k], t, moving: e.moving, flash: f, hair: 'long', acc: 'hat' });
    ctx.save(); ctx.translate(e.x + Math.cos(e.face) * 12, e.y - e.r * 1.2); ctx.rotate(e.face);
    ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-4, 0, 20, -1.3, 1.3); ctx.stroke();
    if (e.state === 'aim') { ctx.strokeStyle = '#5ad1ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-4 + Math.cos(-1.3) * 20, Math.sin(-1.3) * 20); ctx.lineTo(-14, 0); ctx.lineTo(-4 + Math.cos(1.3) * 20, Math.sin(1.3) * 20); ctx.stroke(); }
    ctx.restore();
  },
  yeti(ctx, e, t, f) {
    const x = e.x, y = e.y, r = e.r, b = e.moving ? Math.abs(Math.sin(t * 6)) * 4 : 0;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(ctx, x, y, r * 1.1, r * 0.4);
    ctx.fillStyle = f ? '#fff' : e.def.col;
    ell(ctx, x, y - r - b, r * 1.15, r * 1.05);
    for (let i = 0; i < 9; i++) { const a = Math.PI + i * Math.PI / 8; circ(ctx, x + Math.cos(a) * r * 1.05, y - r - b + Math.sin(a) * r * 0.95, r * 0.28); }
    const armU = e.state === 'windup' ? r * 1.2 : 0;
    ell(ctx, x - r * 1.1, y - r * 0.7 - b - armU, r * 0.35, r * 0.7); ell(ctx, x + r * 1.1, y - r * 0.7 - b - armU, r * 0.35, r * 0.7);
    ctx.fillStyle = f ? '#fff' : '#9fb4d0'; ell(ctx, x, y - r * 1.1 - b, r * 0.6, r * 0.45);
    ctx.fillStyle = '#1a2a3a'; ell(ctx, x - 7, y - r * 1.2 - b, 3, 4); ell(ctx, x + 7, y - r * 1.2 - b, 3, 4);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x - 6, y - r * 0.9 - b); ctx.lineTo(x - 3, y - r * 0.75 - b); ctx.lineTo(x, y - r * 0.9 - b); ctx.lineTo(x + 3, y - r * 0.75 - b); ctx.lineTo(x + 6, y - r * 0.9 - b); ctx.fill();
    ctx.fillStyle = '#5a7aa6'; ctx.beginPath(); ctx.moveTo(x - 10, y - r * 2 - b); ctx.lineTo(x - 6, y - r * 2.6 - b); ctx.lineTo(x - 2, y - r * 1.95 - b); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + 10, y - r * 2 - b); ctx.lineTo(x + 6, y - r * 2.6 - b); ctx.lineTo(x + 2, y - r * 1.95 - b); ctx.fill();
  },
  shiki(ctx, e, t, f) {
    const x = e.x, y = e.y - 26 + Math.sin(t * 9 + e.seed) * 4;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, e.x, e.y, 8, 3);
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 7) * 0.3);
    ctx.fillStyle = f ? '#fff' : e.def.col;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(10, -2); ctx.lineTo(6, 2); ctx.lineTo(9, 12); ctx.lineTo(0, 7); ctx.lineTo(-9, 12); ctx.lineTo(-6, 2); ctx.lineTo(-10, -2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d33'; ctx.fillRect(-1.5, -6, 3, 9); ctx.restore();
  },
  monk(ctx, e, t, f) {
    const k = 'monk';
    PAL_CACHE[k] = PAL_CACHE[k] || { hair: '#d8c8b8', hair2: '#a89888', skin: '#c8dcf0', outfit: '#d9a23a', outfit2: '#5a7aa6', eye: '#5ad1ff', accent: '#f0e0c0', scarf: '#5a7aa6' };
    drawChar(ctx, { x: e.x, y: e.y, s: e.r * 0.8, lookX: Math.cos(e.face), lookY: Math.sin(e.face), pal: PAL_CACHE[k], t, moving: e.moving, flash: f, hair: 'short', mood: 'angry' });
    ctx.fillStyle = '#8a5a3a'; for (let i = 0; i < 7; i++) { const a = Math.PI * 0.15 + i * 0.12; circ(ctx, e.x + Math.cos(a) * e.r * 0.6 - e.r * 0.3, e.y - e.r * 1.75 + Math.sin(a) * e.r * 0.6, 2.4); }
  },
  priest(ctx, e, t, f) {
    const k = 'priest';
    PAL_CACHE[k] = PAL_CACHE[k] || { hair: '#1a1a2a', hair2: '#0a0a14', skin: '#f0e8e8', outfit: '#f2eeff', outfit2: '#7a6aa8', eye: '#d33', accent: '#d33', scarf: '#d33', acc2: '#1a1a2a' };
    drawChar(ctx, { x: e.x, y: e.y, s: e.r * 0.8, lookX: Math.cos(e.face), lookY: Math.sin(e.face), pal: PAL_CACHE[k], t, moving: e.moving, flash: f, hair: 'long', acc: 'hat', eyesClosed: true });
    for (let i = 0; i < 4; i++) { const a = t * 1.5 + i * TAU / 4; ctx.fillStyle = '#fffbe8'; ctx.fillRect(e.x + Math.cos(a) * 26 - 4, e.y - 40 + Math.sin(a) * 10 - 6, 8, 12); ctx.fillStyle = '#d33'; ctx.fillRect(e.x + Math.cos(a) * 26 - 1.5, e.y - 40 + Math.sin(a) * 10 - 3, 3, 7); }
  },
  hknight(ctx, e, t, f) {
    const k = 'hk';
    PAL_CACHE[k] = PAL_CACHE[k] || { hair: '#1c1a26', hair2: '#0c0a12', skin: '#1c1a26', outfit: '#2a2638', outfit2: '#14121c', eye: '#c084ff', accent: '#c084ff', scarf: '#5b2b8a', acc2: '#3a3450' };
    drawChar(ctx, { x: e.x, y: e.y, s: e.r * 0.72, lookX: Math.cos(e.face), lookY: Math.sin(e.face), pal: PAL_CACHE[k], t, moving: e.moving, flash: f, hair: 'short', acc: 'horns', mood: 'angry' });
    ctx.save(); ctx.translate(e.x, e.y - e.r * 1.1); ctx.rotate(e.face + (e.state === 'windup' ? -1.2 : 0.3));
    ctx.fillStyle = '#3a3450'; ctx.fillRect(-8, -3, 14, 6);
    ctx.fillStyle = f ? '#fff' : '#a090c8'; ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(70, -5); ctx.lineTo(80, 0); ctx.lineTo(6, 4); ctx.fill();
    ctx.restore();
  },
  voideye(ctx, e, t, f) {
    const x = e.x, y = e.y - 40 + Math.sin(t * 2) * 6, r = e.r;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(ctx, e.x, e.y, r * 0.8, r * 0.3);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(192,132,255,.25)'; circ(ctx, x, y, r * 1.8); ctx.restore();
    ctx.strokeStyle = '#5b2b8a'; ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + t; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.lineTo(x + Math.cos(a + 0.3) * r * 1.6, y + Math.sin(a + 0.3) * r * 1.6); ctx.stroke(); }
    ctx.fillStyle = f ? '#fff' : '#f0e8ff'; ell(ctx, x, y, r, r * 0.75);
    ctx.fillStyle = e.def.col2; circ(ctx, x + Math.cos(e.face) * r * 0.3, y + Math.sin(e.face) * r * 0.2, r * 0.45);
    ctx.fillStyle = '#000'; ell(ctx, x + Math.cos(e.face) * r * 0.35, y + Math.sin(e.face) * r * 0.22, r * 0.12, r * 0.35);
  },
  echo(ctx, e, t, f) {
    const k = 'echo';
    PAL_CACHE[k] = PAL_CACHE[k] || { hair: '#5b4fa8', hair2: '#2a2050', skin: '#8a80b8', outfit: '#2a2050', outfit2: '#140f28', eye: '#ff2e63', accent: '#8a80b8', scarf: '#ff2e63' };
    ctx.save(); ctx.globalAlpha *= 0.85;
    drawChar(ctx, { x: e.x, y: e.y, s: e.r * 0.78, lookX: Math.cos(e.face), lookY: Math.sin(e.face), pal: PAL_CACHE[k], t, moving: e.moving, flash: f, hair: 'ponytail', acc: 'ribbon', mood: 'angry' });
    ctx.restore();
    HEROES.akane.drawWeapon(ctx, e, e.x + Math.cos(e.face) * 10, e.y - 18, e.face + 0.6);
  },
  dummy(ctx, e, t, f) {
    const x = e.x, y = e.y, wob = e.flash > 0 ? Math.sin(t * 50) * 0.15 : Math.sin(t * 2) * 0.03;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(ctx, x, y, 18, 7);
    ctx.save(); ctx.translate(x, y); ctx.rotate(wob);
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-3, -60, 6, 60); ctx.fillRect(-26, -48, 52, 6);
    ctx.fillStyle = f ? '#fff' : e.def.col; ell(ctx, 0, -38, 16, 20); circ(ctx, 0, -66, 13);
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, -30); ctx.lineTo(14, -30); ctx.moveTo(-15, -42); ctx.lineTo(15, -42); ctx.stroke();
    ctx.fillStyle = '#c33'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('×', -5, -62); ctx.fillText('×', 5, -62);
    ctx.restore();
  },
  // bosses
  gekkou(ctx, e, t, f) { bossChar(ctx, e, t, f, 1.25, (c, x, y, a) => HEROES.akane.drawWeapon(c, e, x, y, a)); },
  shirahime(ctx, e, t, f) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(158,231,255,.15)'; circ(ctx, e.x, e.y - 40, 70); ctx.restore();
    bossChar(ctx, e, t, f, 1.3, (c, x, y, a) => {
      c.save(); c.translate(x, y); c.rotate(Math.sin(t * 2) * 0.3);
      c.fillStyle = '#e8fbff'; c.beginPath(); c.moveTo(0, 0); for (let i = 0; i < 7; i++) { const aa = -Math.PI / 2 - 0.9 + i * 0.3; c.lineTo(Math.cos(aa) * 30, Math.sin(aa) * 30); } c.closePath(); c.fill();
      c.strokeStyle = '#9ee7ff'; c.lineWidth = 1; c.stroke(); c.restore();
    }, true);
  },
  mugen(ctx, e, t, f) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) { ctx.fillStyle = `rgba(192,132,255,${0.08 + i * 0.03})`; circ(ctx, e.x, e.y - 45, 80 - i * 18 + Math.sin(t * 3 + i) * 5); }
    ctx.restore();
    // cape
    ctx.fillStyle = f ? '#fff' : '#2a1640';
    ctx.beginPath(); ctx.moveTo(e.x - 18, e.y - 60); ctx.lineTo(e.x + 18, e.y - 60);
    for (let i = 0; i <= 6; i++) ctx.lineTo(e.x + 34 - i * 11.3, e.y + 4 + Math.sin(t * 4 + i) * 4 * (i % 2 ? 1 : -1));
    ctx.closePath(); ctx.fill();
    bossChar(ctx, e, t, f, 1.3, (c, x, y, a) => HEROES.kaito.drawWeapon(c, e, x, y, a));
    // void mask
    if (!f) { ctx.fillStyle = '#e8e0f0'; ell(ctx, e.x + Math.cos(e.face) * 3, e.y - 1.3 * 13 * 2.6 + 6, 12, 8); ctx.fillStyle = '#ff2e63'; ell(ctx, e.x - 5 + Math.cos(e.face) * 3, e.y - 1.3 * 13 * 2.6 + 6, 2.5, 3); ell(ctx, e.x + 5 + Math.cos(e.face) * 3, e.y - 1.3 * 13 * 2.6 + 6, 2.5, 3); }
  },
  thousandth(ctx, e, t, f) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) { const a = t * 0.8 + i * TAU / 8; ctx.fillStyle = 'rgba(255,213,107,.5)'; circ(ctx, e.x + Math.cos(a) * 60, e.y - 50 + Math.sin(a) * 24, 5); }
    ctx.fillStyle = 'rgba(255,46,99,.12)'; circ(ctx, e.x, e.y - 40, 70);
    ctx.restore();
    bossChar(ctx, e, t, f, 1.2, (c, x, y, a) => HEROES.akane.drawWeapon(c, e, x, y, a));
  },
  mecha(ctx, e, t, f) {
    const x = e.x, y = e.y, r = e.r, st = Math.sin(t * (e.moving ? 8 : 2)) * 3;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ell(ctx, x, y, r * 1.3, r * 0.45);
    const M = f ? '#fff' : '#e0435f', D = f ? '#fff' : '#3a3a4a', W = f ? '#fff' : '#f2f2f2';
    // legs
    ctx.fillStyle = D; rrect(ctx, x - r * 0.9, y - r * 0.9 + st, r * 0.5, r * 0.9, 6); ctx.fill(); rrect(ctx, x + r * 0.4, y - r * 0.9 - st, r * 0.5, r * 0.9, 6); ctx.fill();
    // onigiri body (rice ball triangle)
    ctx.fillStyle = W;
    ctx.beginPath(); ctx.moveTo(x, y - r * 3.2); ctx.quadraticCurveTo(x + r * 1.5, y - r * 1.3, x + r * 1.2, y - r * 0.8); ctx.lineTo(x - r * 1.2, y - r * 0.8); ctx.quadraticCurveTo(x - r * 1.5, y - r * 1.3, x, y - r * 3.2); ctx.fill();
    ctx.fillStyle = f ? '#fff' : '#1a2a1a'; rrect(ctx, x - r * 0.85, y - r * 1.55, r * 1.7, r * 0.75, 6); ctx.fill(); // nori
    ctx.fillStyle = M; ctx.fillRect(x - r * 0.9, y - r * 2.15, r * 1.8, r * 0.12);
    // visor
    ctx.fillStyle = '#111'; rrect(ctx, x - r * 0.6, y - r * 2.55, r * 1.2, r * 0.35, 8); ctx.fill();
    eyeGlow(ctx, x - r * 0.25 + Math.cos(e.face) * 6, y - r * 2.38, e.phase >= 2 ? '#ff2e63' : '#49f0ff', 4);
    eyeGlow(ctx, x + r * 0.25 + Math.cos(e.face) * 6, y - r * 2.38, e.phase >= 2 ? '#ff2e63' : '#49f0ff', 4);
    // arms
    ctx.fillStyle = M;
    for (const sd of [-1, 1]) { rrect(ctx, x + sd * r * 1.35 - r * 0.3, y - r * 2.0 + Math.sin(t * 3 + sd) * 4, r * 0.6, r * 0.9, 8); ctx.fill(); ctx.fillStyle = D; circ(ctx, x + sd * r * 1.35, y - r * 0.95 + Math.sin(t * 3 + sd) * 4, r * 0.35); ctx.fillStyle = M; }
    // horns
    ctx.fillStyle = '#ffd56b'; ctx.beginPath(); ctx.moveTo(x - r * 0.4, y - r * 2.9); ctx.lineTo(x - r * 0.7, y - r * 3.6); ctx.lineTo(x - r * 0.15, y - r * 3.0); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + r * 0.4, y - r * 2.9); ctx.lineTo(x + r * 0.7, y - r * 3.6); ctx.lineTo(x + r * 0.15, y - r * 3.0); ctx.fill();
  },
};
function bossChar(ctx, e, t, f, sc, weapon, noBack) {
  const d = e.def, lx = Math.cos(e.face), ly = Math.sin(e.face);
  const s = 13 * sc;
  const wa = e.face + 0.6 + (e.busy > 0 ? Math.sin(t * 20) * 0.5 : 0);
  const hx = e.x + lx * 14, hy = e.y - 22 * sc + ly * 6;
  if (ly < -0.3) weapon(ctx, hx, hy, wa);
  drawChar(ctx, { x: e.x, y: e.y, s, lookX: lx, lookY: ly, pal: d.pal, t, moving: e.moving, flash: f, hair: d.hair, acc: d.acc, mood: e.phase >= 1 ? 'angry' : null, trail: e.trail });
  if (ly >= -0.3) weapon(ctx, hx, hy, wa);
}

/* =====================================================================
   EXPANSION — boss patterns and drawings
   ===================================================================== */
Object.assign(BOSS_PAT, {
  // ---- Tamamo-no-Mae
  foxfire(e) {
    const n = 6 + e.phase * 2;
    for (let i = 0; i < n; i++) G.after(i * 0.08, () => G.eProj({ x: e.x, y: e.y - 30, ang: i * TAU / n + e.t, speed: 190, dmg: e.dmg * 0.8, r: 10, color: '#7ad7ff', kind: 'orb', homing: 1.5, life: 4.5 }), e);
    SFX.play('burn'); e.busy = 1.4;
  },
  tailSweep(e) {
    const base = angTo(e, P);
    [-1.1, 0, 1.1].forEach((o, i) => G.after(i * 0.32, () => G.addZone({ shape: 'cone', x: e.x, y: e.y, r: 270, ang: base + o * e.strafe, arc: 1.25, warn: 0.55, dmg: e.dmg * 1.2, owner: e, color: '#ffb347', onFire: z => { G.fxSlash({ x: z.x, y: z.y - 10, r: 240, ang: z.ang, arc: 1.25, color: '#ffcf40', dur: 0.25, width: 1.8 }); SFX.play('slash'); } }), e));
    e.busy = 1.6;
  },
  foxClones(e) {
    G.say(e, pick(['Which one is the real me? Ohoho~', 'Illusions, darling. Keep up.']));
    G.ghostE(e);
    const p = G.clampToArena(rand(G.room.x0 + 200, G.room.x0 + G.room.w - 200), rand(G.room.y0 + 200, G.room.y0 + G.room.h - 250), 40);
    e.x = p.x; e.y = p.y;
    if (G.enemies.filter(x => !x.dead && x.minion).length < 3)
      for (let i = 0; i < 2; i++) G.spawnEnemy('foxclone', e.x + rand(-200, 200), e.y + rand(-120, 120), { minion: true, hpMult: G.actMult() * 0.7 });
    e.busy = 0.9;
  },
  kitsuneRain(e) {
    const R = G.room;
    for (let row = 0; row < 4; row++) {
      G.after(row * 0.28, () => {
        const y = clamp(P.y + (row - 1.5) * 120, R.y0 + WALL_TOP + 40, R.y0 + R.h - 60), off = row % 2 ? 65 : 0;
        for (let x = R.x0 + 90 + off; x < R.x0 + R.w - 60; x += 150) G.addZone({ shape: 'circle', x, y, r: 55, warn: 0.9, dmg: e.dmg * 0.9, color: '#7ad7ff' });
      }, e);
    }
    e.busy = 2.0;
  },
  ninefold(e) {
    G.say(e, 'Behold — all nine tails!');
    for (let w = 0; w < 2; w++) G.after(w * 0.7, () => { const o = angTo(e, P) + w * 0.35; for (let i = 0; i < 9; i++) G.addZone({ shape: 'line', x: e.x, y: e.y, ang: o + i * TAU / 9, len: 820, w: 44, warn: 0.95, dmg: e.dmg * 1.2, owner: e, color: '#ffcf40' }); }, e);
    e.busy = 2.3;
  },
  // ---- Bakusou
  rideCharge(e) {
    const n = e.phase >= 1 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      G.after(i * 0.95, () => {
        const a = angTo(e, P), len = clamp(dist(e, P) + 200, 300, 700);
        G.addZone({ shape: 'line', x: e.x, y: e.y, ang: a, len, w: 84, warn: 0.6, dmg: e.dmg * 1.4, owner: e, color: '#ffe14d',
          onFire: () => {
            const x0 = e.x, y0 = e.y; e.face = a; G.moveSafe(e, Math.cos(a) * len, Math.sin(a) * len);
            G.fxLine(x0, y0, e.x, e.y, '#ffe14d', 22, 0.35); SFX.play('dash'); SFX.play('thunder', 0.6); G.shake(7);
            const steps = Math.floor(dist({ x: x0, y: y0 }, e) / 80);
            for (let k = 1; k <= steps; k++) { const t = k / (steps + 1); G.addZone({ shape: 'circle', x: lerp(x0, e.x, t), y: lerp(y0, e.y, t), r: 48, warn: 0.45, dmg: e.dmg * 0.7, color: '#ffe14d', kind: 'bolt', onFire: z => G.fxBolt(z.x, z.y - 400, z.x, z.y) }); }
          } });
      }, e);
    }
    e.busy = n * 0.95 + 0.3;
  },
  thunderDrift(e) {
    G.say(e, 'DRIFT KIIIING!');
    const R = G.room, cx = R.x0 + R.w / 2, cy = R.y0 + R.h / 2 + 20, rad = Math.min(R.w, R.h) * 0.33;
    let a = Math.atan2(e.y - cy, e.x - cx);
    e.dashing = true;
    for (let i = 0; i < 26; i++) {
      G.after(i * 0.09, () => {
        a += 0.27 * e.strafe;
        const tx = cx + Math.cos(a) * rad, ty = cy + Math.sin(a) * rad * 0.8;
        e.face = Math.atan2(ty - e.y, tx - e.x); e.x = tx; e.y = ty; G.resolve(e);
        if (i % 2 === 0) G.addZone({ shape: 'circle', x: e.x, y: e.y, r: 56, warn: 0.6, dmg: e.dmg * 0.8, color: '#ffe14d', kind: 'bolt', onFire: z => G.fxBolt(z.x, z.y - 400, z.x, z.y) });
        if (i === 25) e.dashing = false;
      }, e);
    }
    e.busy = 2.6;
  },
  lightningStrikes(e) {
    for (let i = 0; i < 8 + e.phase * 3; i++) G.after(i * 0.2, () => {
      const p = G.clampToArena(P.x + rand(-80, 80) + P.vxEst * 0.3, P.y + rand(-80, 80) + P.vyEst * 0.3, 30);
      G.addZone({ shape: 'circle', x: p.x, y: p.y, r: 62, warn: 0.7, dmg: e.dmg, color: '#ffe14d', kind: 'bolt', onFire: z => { G.fxBolt(z.x + rand(-20, 20), z.y - 520, z.x, z.y); SFX.play('thunder', 0.5); } });
    }, e);
    e.busy = 1.4 + e.phase * 0.5;
  },
  shockHorn(e) {
    G.say(e, 'BWAAAAAMP!'); SFX.play('roar');
    [[50, 170], [170, 290], [290, 410], [410, 540]].forEach((rr, i) => G.addZone({ shape: 'ring', x: e.x, y: e.y, r: rr[0], r2: rr[1], warn: 0.55 + i * 0.28, dmg: e.dmg, owner: e, color: '#ffe14d' }));
    e.busy = 1.8;
  },
  gangCall(e) {
    G.say(e, 'BOYS! GET \'EM!');
    if (G.enemies.filter(x => !x.dead && x.minion).length < 4)
      for (let i = 0; i < 2; i++) G.spawnEnemy('bikeoni', e.x + rand(-160, 160), e.y + rand(-100, 100), { minion: true, hpMult: G.actMult() * 0.8 });
    e.busy = 0.8;
  },
  // ---- Shiro
  getsugaWave(e) {
    G.say(e, pick(['Getsuga...', 'Too slow!', 'Heh.']));
    for (let i = 0; i < 3; i++) G.after(i * 0.42, () => {
      const a = angTo(e, P), offs = e.phase >= 1 ? [-0.32, 0, 0.32] : [0];
      for (const o of offs) G.eProj({ x: e.x, y: e.y - 20, ang: a + o, speed: 520, dmg: e.dmg * 1.1, r: 30, color: '#c8102e', kind: 'getsuga', life: 2.4 });
      SFX.play('heavy');
    }, e);
    e.busy = 1.6;
  },
  flashStep(e) {
    const n = 2 + e.phase;
    for (let i = 0; i < n; i++) G.after(i * 0.75, () => {
      G.ghostE(e);
      const p = G.clampToArena(P.x - Math.cos(P.aim) * 95 + rand(-30, 30), P.y - Math.sin(P.aim) * 95 + rand(-30, 30), e.r);
      e.x = p.x; e.y = p.y; e.face = angTo(e, P); SFX.play('dash');
      G.addZone({ shape: 'cone', x: e.x, y: e.y, r: 140, ang: e.face, arc: 1.8, warn: 0.42, dmg: e.dmg * 1.1, owner: e, follow: true, color: '#c8102e', onFire: z => G.fxSlash({ x: z.x, y: z.y - 12, r: 130, ang: z.ang, arc: 1.8, color: '#ffffff', dur: 0.2, width: 1.3 }) });
    }, e);
    e.busy = n * 0.75 + 0.2;
  },
  cleaverThrow(e) {
    G.eProj({ x: e.x, y: e.y - 20, ang: angTo(e, P), speed: 640, dmg: e.dmg, r: 26, color: '#eeeeee', kind: 'scythe', returning: 460, owner: e, life: 3.5 });
    SFX.play('slash'); e.busy = 1.6;
  },
  hollowCero(e) {
    G.say(e, 'Cero.');
    G.addZone({ shape: 'beam', x: e.x, y: e.y - 30, ang: angTo(e, P), len: 1100, w: 58, warn: 1.0, dur: 1.4, rot: 0.55 * e.strafe, dmg: e.dmg, owner: e, follow: true, color: '#c8102e', onFire: () => SFX.play('laser') });
    e.busy = 2.6;
  },
  bankaiMirror(e) {
    if (e.bankaiDone) { BOSS_PAT.getsugaWave(e); return; }
    e.bankaiDone = true;
    G.cutin('shiro', 'Bankai', '卍解', 'Hollow Heaven Chain');
    SFX.play('ult'); e.speedMul *= 0.7; e.spd *= 1.25;
    G.fxRing(e.x, e.y, 300, '#c8102e', 0.6, 16); G.flash('#2a0008', 0.5);
    e.busy = 1.2;
  },
  // ---- Tetsu
  godCut(e) {
    G.say(e, 'Kamikiri.');
    const a = angTo(e, P);
    G.addZone({ shape: 'line', x: e.x, y: e.y, ang: a, len: 1300, w: 110, warn: 1.05, dmg: e.dmg * 2, owner: e, color: '#8a1c2b',
      onFire: z => { G.fxLine(z.x, z.y, z.x + Math.cos(a) * 1300, z.y + Math.sin(a) * 1300, '#ffffff', 30, 0.45); G.moveSafe(e, Math.cos(a) * 280, Math.sin(a) * 280); G.shake(12); SFX.play('heavy'); SFX.play('boom', 0.5); } });
    e.busy = 1.7;
  },
  // ---- Daigo
  slamLine(e) {
    const a = angTo(e, P);
    for (let i = 0; i < 3 + (e.phase >= 2 ? 1 : 0); i++) {
      const x = e.x + Math.cos(a) * i * 190, y = e.y + Math.sin(a) * i * 190;
      G.addZone({ shape: 'line', x, y, ang: a, len: 210, w: 104, warn: 0.6 + i * 0.2, dmg: e.dmg * 1.2, color: '#ffb347', onFire: z => { G.shake(7); SFX.play('boom', 0.5); G.parts.burst(z.x + Math.cos(a) * 100, z.y + Math.sin(a) * 100, 10, { type: 'shard', color: '#8a7a6a', min: 60, max: 240, grav: 600 }); } });
    }
    e.busy = 1.5;
  },
  cannonVolley(e) {
    G.say(e, 'FIRE THE IRON GATE CANNONS!');
    for (let i = 0; i < 5 + e.phase * 2; i++) G.after(i * 0.15, () => {
      const p = G.clampToArena(P.x + rand(-130, 130) + P.vxEst * 0.5, P.y + rand(-130, 130) + P.vyEst * 0.5, 40);
      G.addZone({ shape: 'circle', x: p.x, y: p.y, r: 88, warn: 1.0, dmg: e.dmg, color: '#ff8a3d', kind: 'missile', onFire: z => G.boom(z.x, z.y, 88) });
    }, e);
    e.busy = 1.8 + e.phase * 0.3;
  },
  stomp(e) {
    G.addZone({ shape: 'circle', x: e.x, y: e.y, r: 215, warn: 0.9, dmg: e.dmg * 1.4, owner: e, follow: true, color: '#ff6a3d', onFire: z => G.boom(z.x, z.y, 215) });
    e.busy = 1.3;
  },
  berserkArmor(e) {
    if (e.armorT > 0) { BOSS_PAT.stomp(e); return; }
    G.say(e, 'KISHIN ARMOR! HIT ME IF YOU CAN!');
    e.armorT = 4.5; SFX.play('roar'); G.fxRing(e.x, e.y, 200, '#ff3d2e', 0.5, 12);
    e.busy = 0.6;
  },
});

/* ---------- drawings for new foes ---------- */
Object.assign(EDRAW, {
  wisp(ctx, e, t, f) {
    const x = e.x, y = e.y - 32 + Math.sin(t * 4 + e.seed) * 6, r = e.r;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, e.x, e.y, r * 0.7, r * 0.25);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(e.def.col, e.state === 'aim' ? 0.55 : 0.3); circ(ctx, x, y, r * 2);
    ctx.fillStyle = f ? '#fff' : e.def.col;
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.quadraticCurveTo(x - r * 0.6, y - r * 2.2 + Math.sin(t * 9) * 4, x, y - r * 2.6); ctx.quadraticCurveTo(x + r * 0.6, y - r * 2.2, x + r, y); ctx.arc(x, y, r, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#fff'; circ(ctx, x, y, r * 0.55);
    ctx.restore();
    ctx.fillStyle = '#123'; ell(ctx, x - 3.5, y - 1, 1.8, 3); ell(ctx, x + 3.5, y - 1, 1.8, 3);
  },
  nue(ctx, e, t, f) {
    const x = e.x, y = e.y, r = e.r, b = e.moving ? Math.abs(Math.sin(t * 8)) * 3 : 0, crouch = e.state === 'crouch' ? r * 0.25 : 0;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; if (!e.hop) ell(ctx, x, y, r * 1.1, r * 0.4);
    // snake tail
    ctx.strokeStyle = f ? '#fff' : '#3a6a3a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    const tx = x - Math.cos(e.face) * r;
    ctx.beginPath(); ctx.moveTo(tx, y - r * 0.8); ctx.quadraticCurveTo(tx - Math.cos(e.face) * 20, y - r * 2 + Math.sin(t * 5) * 6, tx - Math.cos(e.face) * 8, y - r * 2.4); ctx.stroke();
    ctx.fillStyle = f ? '#fff' : '#3a6a3a'; circ(ctx, tx - Math.cos(e.face) * 8, y - r * 2.4, 5);
    // tiger legs
    ctx.fillStyle = f ? '#fff' : '#e8a040';
    for (const sd of [-1, 1]) { rrect(ctx, x + sd * r * 0.55 - 5, y - r * 0.7 + crouch, 10, r * 0.7 - crouch, 4); ctx.fill(); }
    ctx.fillStyle = '#2a1a0a'; for (const sd of [-1, 1]) { ctx.fillRect(x + sd * r * 0.55 - 5, y - r * 0.5, 10, 2); ctx.fillRect(x + sd * r * 0.55 - 5, y - r * 0.3, 10, 2); }
    // tanuki body
    ctx.fillStyle = f ? '#fff' : e.def.col; ell(ctx, x, y - r - b + crouch, r * 1.15, r * 0.85);
    // monkey face
    ctx.fillStyle = f ? '#fff' : '#c88a6a'; circ(ctx, x + Math.cos(e.face) * r * 0.5, y - r * 1.5 - b + crouch, r * 0.55);
    ctx.fillStyle = f ? '#fff' : '#f2c8a8'; ell(ctx, x + Math.cos(e.face) * r * 0.55, y - r * 1.4 - b + crouch, r * 0.35, r * 0.28);
    ctx.fillStyle = e.def.col2; circ(ctx, x + Math.cos(e.face) * r * 0.55 - 5, y - r * 1.55 - b + crouch, 2.6); circ(ctx, x + Math.cos(e.face) * r * 0.55 + 5, y - r * 1.55 - b + crouch, 2.6);
  },
  rokuro(ctx, e, t, f) {
    const k = 'rokuro';
    PAL_CACHE[k] = PAL_CACHE[k] || { hair: '#1a1020', hair2: '#0a0610', skin: '#f2e4ec', outfit: '#8a2a5a', outfit2: '#3a0a24', eye: '#ff4f79', accent: '#ffd0e0', scarf: '#ffb7c8' };
    // stretched neck during strike
    const ext = e.state === 'windup' ? (1 - e.stT / (e.def.windup / e.tempo)) * 30 : e.state === 'recover' && e.stT > 0.25 ? 150 * ((e.stT - 0.25) / 0.2) : 0;
    const hx = e.x + Math.cos(e.face) * ext, hy = e.y - 30 + Math.sin(e.face) * ext * 0.6 - (ext ? 10 : 0);
    if (ext > 1) { ctx.strokeStyle = f ? '#fff' : PAL_CACHE[k].skin; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(e.x, e.y - 30); ctx.quadraticCurveTo((e.x + hx) / 2, (e.y - 30 + hy) / 2 - 30 + Math.sin(t * 10) * 8, hx, hy); ctx.stroke(); }
    drawChar(ctx, { x: e.x, y: e.y, s: e.r * 0.78, lookX: Math.cos(e.face), lookY: Math.sin(e.face), pal: PAL_CACHE[k], t, moving: e.moving, flash: f, hair: 'hime', mood: 'angry', noShadow: false, alpha: ext > 1 ? 0.95 : 1 });
    if (ext > 20) { ctx.fillStyle = f ? '#fff' : PAL_CACHE[k].hair; circ(ctx, hx, hy, 13); ctx.fillStyle = PAL_CACHE[k].skin; circ(ctx, hx, hy + 3, 10); ctx.fillStyle = '#ff4f79'; circ(ctx, hx - 4, hy + 2, 2); circ(ctx, hx + 4, hy + 2, 2); ctx.fillStyle = '#c21f3a'; ell(ctx, hx, hy + 8, 4, 3); }
  },
  bikeoni(ctx, e, t, f) { drawBike(ctx, e, t, f, 0.75, { hair: '#1a1a26', hair2: '#0a0a14', skin: '#e0435f', outfit: '#2a2a36', outfit2: '#14141c', eye: '#ffe14d', accent: '#ffe14d', scarf: '#ffe14d', acc2: '#f4e4c1' }); },
  warashi(ctx, e, t, f) {
    const x = e.x, y = e.y - e.r - Math.abs(Math.sin(t * 12 + e.seed)) * 4, r = e.r;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, e.x, e.y, r * 0.8, r * 0.3);
    ctx.fillStyle = f ? '#fff' : '#9ec8e8'; ell(ctx, x, y + r * 0.4, r * 0.9, r * 0.7);
    ctx.fillStyle = f ? '#fff' : e.def.col; circ(ctx, x, y - r * 0.3, r * 0.75);
    ctx.fillStyle = '#1a2a3a'; ctx.beginPath(); ctx.arc(x, y - r * 0.4, r * 0.78, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#1a2a3a'; circ(ctx, x - 3, y - r * 0.15, 1.8); circ(ctx, x + 3, y - r * 0.15, 1.8);
    ctx.fillStyle = 'rgba(255,140,170,.5)'; circ(ctx, x - 5, y, 2); circ(ctx, x + 5, y, 2);
  },
  tsurara(ctx, e, t, f) {
    const k = 'tsurara';
    PAL_CACHE[k] = PAL_CACHE[k] || { hair: '#dff6ff', hair2: '#8ac8e8', skin: '#eaf6ff', outfit: '#bfe9ff', outfit2: '#6aa8d8', eye: '#3ab7ff', accent: '#ffffff', scarf: '#9ee7ff', acc2: '#e8fbff' };
    ctx.save(); ctx.translate(0, -16 + Math.sin(t * 2) * 5);
    drawChar(ctx, { x: e.x, y: e.y, s: e.r * 0.8, lookX: Math.cos(e.face), lookY: Math.sin(e.face), pal: PAL_CACHE[k], t, moving: false, flash: f, hair: 'hime', acc: 'crown', eyesClosed: true, alpha: 0.9 });
    ctx.fillStyle = 'rgba(200,240,255,.85)';
    for (let i = 0; i < 5; i++) { const ix = e.x - 16 + i * 8; ctx.beginPath(); ctx.moveTo(ix - 3, e.y - 2); ctx.lineTo(ix, e.y + 10 + (i % 2) * 6); ctx.lineTo(ix + 3, e.y - 2); ctx.fill(); }
    ctx.restore();
  },
  usagi(ctx, e, t, f) {
    const k = 'usagi';
    PAL_CACHE[k] = PAL_CACHE[k] || { hair: '#f2f0ff', hair2: '#b8b0d8', skin: '#f8f4ff', outfit: '#2a2040', outfit2: '#140f24', eye: '#c084ff', accent: '#c084ff', scarf: '#c084ff', acc2: '#ffd0e0' };
    // tall rabbit ears
    ctx.fillStyle = f ? '#fff' : '#f2f0ff';
    const hy = e.y - e.r * 0.8 * 2.6 - e.r * 0.8;
    for (const sd of [-1, 1]) { ell(ctx, e.x + sd * 6, hy - 14, 4.5, 15, sd * 0.2); }
    ctx.fillStyle = '#ffd0e0'; for (const sd of [-1, 1]) ell(ctx, e.x + sd * 6, hy - 14, 2, 10, sd * 0.2);
    drawChar(ctx, { x: e.x, y: e.y, s: e.r * 0.8, lookX: Math.cos(e.face), lookY: Math.sin(e.face), pal: PAL_CACHE[k], t, moving: e.moving, flash: f, hair: 'short', acc: 'mask', mood: 'angry' });
    ctx.save(); ctx.translate(e.x + Math.cos(e.face) * 12, e.y - 18); ctx.rotate(e.face + (e.state === 'windup' ? -0.8 : 0.5));
    ctx.fillStyle = '#d8d0ff'; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(26, -1); ctx.lineTo(32, 0); ctx.lineTo(0, 2); ctx.fill(); ctx.restore();
  },
  gasha(ctx, e, t, f) {
    const x = e.x, y = e.y, r = e.r, b = e.moving ? Math.abs(Math.sin(t * 4)) * 4 : 0, up = e.state === 'windup' ? r * 1.2 : 0;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ell(ctx, x, y, r * 1.2, r * 0.45);
    const B = f ? '#fff' : e.def.col;
    ctx.strokeStyle = B; ctx.lineWidth = 6; ctx.lineCap = 'round';
    // ribcage
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x, y - r * 1.0 - i * 9 - b, r * (0.8 - i * 0.08), 6, 0, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x, y - r * 0.6 - b); ctx.lineTo(x, y - r * 2.0 - b); ctx.stroke();
    // arms
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sd * r * 0.7, y - r * 1.8 - b); ctx.lineTo(x + sd * r * 1.3, y - r * 1.1 - b - up); ctx.lineTo(x + sd * r * 1.2, y - r * 0.3 - b - up * 1.5); ctx.stroke(); }
    // skull
    ctx.fillStyle = B; circ(ctx, x, y - r * 2.4 - b, r * 0.62); ctx.fillRect(x - r * 0.35, y - r * 2.1 - b, r * 0.7, r * 0.35);
    ctx.fillStyle = '#140f1e'; circ(ctx, x - r * 0.24, y - r * 2.45 - b, r * 0.17); circ(ctx, x + r * 0.24, y - r * 2.45 - b, r * 0.17);
    eyeGlow(ctx, x - r * 0.24, y - r * 2.45 - b, e.def.col2, 3); eyeGlow(ctx, x + r * 0.24, y - r * 2.45 - b, e.def.col2, 3);
  },
  foxclone(ctx, e, t, f) {
    ctx.save(); ctx.globalAlpha *= 0.65;
    drawFoxTails(ctx, e.x, e.y - 30, 3, t, '#ffe7a0', f);
    drawChar(ctx, { x: e.x, y: e.y, s: 11, lookX: Math.cos(e.face), lookY: Math.sin(e.face), pal: BOSSES.tamamo.pal, t, moving: e.moving, flash: f, hair: 'hime', acc: 'foxears' });
    ctx.restore();
  },
  // bosses
  tamamo(ctx, e, t, f) {
    drawFoxTails(ctx, e.x, e.y - 34, 9, t, '#fff1d6', f);
    bossChar(ctx, e, t, f, 1.25, (c, x, y) => { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(122,215,255,.7)'; circ(c, x + 6, y - 6, 8 + Math.sin(t * 8) * 2); c.fillStyle = '#fff'; circ(c, x + 6, y - 6, 3.5); c.restore(); });
  },
  bakusou(ctx, e, t, f) {
    if (e.dashing || e.busy > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,225,77,.18)'; circ(ctx, e.x, e.y - 30, 70); ctx.restore(); }
    drawBike(ctx, e, t, f, 1.25, BOSSES.bakusou.pal);
  },
  shiro(ctx, e, t, f) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = e.bankaiDone ? 'rgba(200,16,46,.2)' : 'rgba(255,255,255,.1)'; circ(ctx, e.x, e.y - 40, 60); ctx.restore();
    bossChar(ctx, e, t, f, 1.2, (c, x, y, a) => HEROES.sora.drawWeapon(c, { t, bankaiT: e.bankaiDone ? 1 : 0 }, x, y, a));
    // hollow mask stripes
    const hy = e.y - 13 * 1.2 * 2.6;
    ctx.fillStyle = '#c8102e'; ctx.fillRect(e.x - 9, hy - 8, 3, 14); ctx.fillRect(e.x + 6, hy - 8, 3, 14);
  },
  tetsuB(ctx, e, t, f) { bossChar(ctx, e, t, f, 1.25, (c, x, y, a) => HEROES.tetsu.drawWeapon(c, e, x, y, a)); },
  daigoB(ctx, e, t, f) {
    if (e.armorT > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,61,46,.25)'; ell(ctx, e.x, e.y - 50, 50, 64); ctx.restore(); }
    bossChar(ctx, e, t, f, 1.55, (c, x, y, a) => { c.save(); c.translate(x, y); c.scale(1.3, 1.3); HEROES.daigo.drawWeapon(c, e, 0, 0, a); c.restore(); });
  },
});
function drawFoxTails(ctx, x, y, n, t, col, f) {
  ctx.save();
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i - (n - 1) / 2) * (n > 3 ? 0.32 : 0.5) + Math.sin(t * 2 + i) * 0.08;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = f ? '#fff' : col;
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.quadraticCurveTo(28, -16, 54, -4 + Math.sin(t * 3 + i) * 4); ctx.quadraticCurveTo(30, 12, 0, 6); ctx.fill();
    ctx.fillStyle = '#ffffff'; ell(ctx, 50, -3 + Math.sin(t * 3 + i) * 4, 8, 6);
    ctx.restore();
  }
  ctx.restore();
}
function drawBike(ctx, e, t, f, sc, pal) {
  const x = e.x, y = e.y, lx = Math.cos(e.face), dir = lx >= 0 ? 1 : -1;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ell(ctx, x, y, 44 * sc, 12 * sc);
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * sc, sc);
  // wheels
  ctx.fillStyle = '#111'; circ(ctx, -26, -10, 12); circ(ctx, 28, -10, 12);
  ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-26, -10, 8, t * 20, t * 20 + 4); ctx.stroke(); ctx.beginPath(); ctx.arc(28, -10, 8, t * 20, t * 20 + 4); ctx.stroke();
  // frame
  ctx.fillStyle = f ? '#fff' : '#c8302c'; rrect(ctx, -30, -34, 60, 18, 6); ctx.fill();
  ctx.fillStyle = f ? '#fff' : '#ffe14d'; ctx.fillRect(-20, -30, 40, 3);
  ctx.fillStyle = '#333'; ctx.fillRect(18, -46, 4, 16); ctx.fillRect(12, -48, 14, 3);
  // exhaust flames
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,200,60,.8)'; ell(ctx, -40 - Math.random() * 6, -18, 8 + Math.random() * 4, 4); ctx.restore();
  ctx.restore();
  drawChar(ctx, { x: x - dir * 2 * sc, y: y - 26 * sc, s: 11 * sc, lookX: lx, lookY: Math.sin(e.face) * 0.4, pal, t, moving: false, flash: f, hair: 'wild', acc: 'horns', mood: 'angry', noShadow: true });
}

/* =====================================================================
   UPDATE 2 — Campaign II boss patterns and drawings
   ===================================================================== */
Object.assign(BOSS_PAT, {
  // ---- Jorōgumo
  webShot(e) {
    for (let v = 0; v < 3; v++) G.after(v * 0.4, () => { const a = angTo(e, P); for (let i = -2; i <= 2; i++) G.eProj({ x: e.x, y: e.y - 30, ang: a + i * 0.2, speed: 300, dmg: e.dmg * 0.7, r: 11, color: '#d8d0ff', kind: 'web', slow: true }); SFX.play('shoot', 0.5); }, e);
    e.busy = 1.5;
  },
  silkLines(e) {
    for (let w = 0; w < 3; w++) G.after(w * 0.38, () => { const o = angTo(e, P) + w * 0.26; for (let i = 0; i < 6; i++) G.addZone({ shape: 'line', x: e.x, y: e.y, ang: o + i * TAU / 6, len: 780, w: 30, warn: 0.7, dmg: e.dmg, owner: e, color: '#d8d0ff' }); }, e);
    e.busy = 1.7;
  },
  spiderlings(e) {
    G.say(e, pick(['Children, dinner has arrived.', 'Go, my little ones.']));
    if (G.enemies.filter(x => !x.dead && x.minion).length < 10)
      for (let i = 0; i < 5; i++) G.spawnEnemy('kumoko', e.x + rand(-140, 140), e.y + rand(-90, 90), { minion: true });
    e.busy = 0.8;
  },
  pounce(e) {
    const tgt = G.clampToArena(P.x, P.y, e.r), from = { x: e.x, y: e.y };
    G.addZone({ shape: 'circle', x: tgt.x, y: tgt.y, r: 125, warn: 0.95, dmg: e.dmg * 1.4, color: '#ff3d8f',
      onFire: z => { G.shake(10); SFX.play('boom'); for (let i = 0; i < 12; i++) G.eProj({ x: z.x, y: z.y - 20, ang: i * TAU / 12, speed: 260, dmg: e.dmg * 0.6, r: 10, color: '#d8d0ff', kind: 'web', slow: true }); } });
    for (let i = 1; i <= 10; i++) G.after(i * 0.095, () => { const k = i / 10; e.x = lerp(from.x, tgt.x, k); e.y = lerp(from.y, tgt.y, k); e.hop = Math.sin(Math.PI * k) * 180; if (i === 10) e.hop = 0; }, e);
    e.busy = 1.6;
  },
  webTrap(e) {
    for (let i = 0; i < 4; i++) { const p = G.clampToArena(P.x + rand(-170, 170), P.y + rand(-170, 170), 60); G.addZone({ shape: 'circle', x: p.x, y: p.y, r: 95, warn: 0.85, dur: 5.5, field: true, slowField: true, dmg: 0, color: '#d8d0ff' }); }
    G.say(e, 'Stay a while.'); e.busy = 1.1;
  },
  silkStorm(e) {
    G.say(e, 'Dance on my strings!');
    for (let i = 0; i < 4; i++) G.addZone({ shape: 'beam', x: e.x, y: e.y - 30, ang: i * TAU / 4, len: 1100, w: 20, warn: 0.9, dur: 2.8, rot: 0.85 * e.strafe, dmg: e.dmg * 0.8, owner: e, follow: true, color: '#d8d0ff' });
    e.busy = 3.8;
  },
  // ---- Watatsumi
  tidalWave(e, dirOverride) {
    const R = G.room, dir = dirOverride !== undefined ? dirOverride : randi(0, 3);
    const horiz = dir < 2, n = 6;
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n, fwd = dir % 2 ? 1 - k : k;
      const gapC = rand(0.2, 0.8), gapW = 0.22;
      for (const [a0, a1] of [[0, gapC - gapW / 2], [gapC + gapW / 2, 1]]) {
        if (a1 - a0 < 0.03) continue;
        const span = horiz ? R.w : R.h;
        if (horiz) G.addZone({ shape: 'line', x: R.x0 + a0 * span, y: R.y0 + WALL_TOP + fwd * (R.h - WALL_TOP - WALL), ang: 0, len: (a1 - a0) * span, w: 64, warn: 0.8 + i * 0.22, dmg: e.dmg * 0.9, color: '#49f0ff' });
        else G.addZone({ shape: 'line', x: R.x0 + WALL + fwd * (R.w - WALL * 2), y: R.y0 + a0 * span, ang: Math.PI / 2, len: (a1 - a0) * span, w: 64, warn: 0.8 + i * 0.22, dmg: e.dmg * 0.9, color: '#49f0ff' });
      }
      G.after(0.8 + i * 0.22, () => SFX.play('splash', 0.5), e);
    }
    e.busy = 2.4;
  },
  whirlpool(e) {
    G.say(e, 'SINK!');
    const p = G.clampToArena(P.x + rand(-60, 60), P.y + rand(-60, 60), 120);
    G.addZone({ shape: 'circle', x: p.x, y: p.y, r: 210, warn: 0.7, dur: 3.8, field: true, pull: 150, dmg: e.dmg * 0.8, color: '#49f0ff' });
    e.busy = 1.0;
  },
  bubblePrison(e) {
    for (let i = 0; i < 5 + e.phase; i++) G.after(i * 0.12, () => G.eProj({ x: e.x, y: e.y - 30, ang: angTo(e, P) + rand(-1.2, 1.2), speed: 150, dmg: e.dmg * 0.8, r: 18, color: '#9ee7ff', kind: 'bubble', homing: 1.3, life: 6, slow: true }), e);
    e.busy = 1.3;
  },
  dragonBreath(e) {
    G.say(e, 'BREATH OF THE DEEP!');
    G.addZone({ shape: 'beam', x: e.x, y: e.y - 30, ang: angTo(e, P) - 0.8 * e.strafe, len: 1100, w: 52, warn: 0.9, dur: 2.0, rot: 0.8 * e.strafe, dmg: e.dmg, owner: e, follow: true, color: '#49f0ff', onFire: () => SFX.play('laser') });
    e.busy = 3.0;
  },
  coilCrush(e) {
    const segs = (e.segs || []).filter((_, i) => i % 2 === 0);
    for (const s of segs) G.addZone({ shape: 'circle', x: s.x, y: s.y, r: 70, warn: 0.75, dmg: e.dmg, color: '#1a8aaa' });
    G.addZone({ shape: 'circle', x: e.x, y: e.y, r: 160, warn: 0.9, dmg: e.dmg * 1.2, owner: e, follow: true, color: '#1a8aaa', onFire: () => SFX.play('splash') });
    e.busy = 1.3;
  },
  tsunami(e) {
    G.say(e, 'THE WHOLE SEA RISES!');
    const d = randi(0, 1);
    BOSS_PAT.tidalWave(e, d);
    G.after(1.2, () => BOSS_PAT.tidalWave(e, d + 2), e);
    e.busy = 3.6;
  },
  // ---- Tokugane
  clockHands(e) {
    G.say(e, 'TICK. TOCK.');
    G.addZone({ shape: 'beam', x: e.x, y: e.y - 30, ang: angTo(e, P), len: 1100, w: 34, warn: 1.0, dur: 4.0, rot: 0.5, dmg: e.dmg, owner: e, follow: true, color: '#ffcf40' });
    G.addZone({ shape: 'beam', x: e.x, y: e.y - 30, ang: angTo(e, P) + Math.PI, len: 1100, w: 22, warn: 1.0, dur: 4.0, rot: 1.5, dmg: e.dmg * 0.8, owner: e, follow: true, color: '#ff8a3d' });
    for (let i = 0; i < 16; i++) G.after(1 + i * 0.25, () => SFX.play('tick'), e);
    e.busy = 5.0;
  },
  gearStorm(e) {
    for (let i = 0; i < 6 + e.phase * 2; i++) G.eProj({ x: e.x, y: e.y - 30, ang: i * TAU / (6 + e.phase * 2) + rand(-0.2, 0.2), speed: 320, dmg: e.dmg * 0.8, r: 16, color: '#b8a06a', kind: 'gear', bounce: 3, life: 5 });
    SFX.play('clang'); e.busy = 1.4;
  },
  steamGrid(e) {
    const R = G.room, sp = 170;
    for (let k = 0; k < 2; k++) G.after(k * 0.7, () => {
      for (let i = 0; R.x0 + 100 + i * sp < R.x0 + R.w - 60; i++) for (let j = 0; R.y0 + WALL_TOP + 60 + j * sp < R.y0 + R.h - 40; j++) {
        if ((i + j) % 2 !== k) continue;
        G.addZone({ shape: 'circle', x: R.x0 + 100 + i * sp, y: R.y0 + WALL_TOP + 60 + j * sp, r: 78, warn: 1.0, dmg: e.dmg * 0.9, color: '#e8e0d0', onFire: z => G.parts.burst(z.x, z.y, 8, { type: 'smoke', color: '#eee', min: 40, max: 160, size: 8, grav: -200 }) });
      }
    }, e);
    e.busy = 2.0;
  },
  tickBombs(e) {
    G.say(e, 'COUNTDOWN. INITIATED.');
    for (let i = 0; i < 4 + e.phase; i++) { const a = i * TAU / (4 + e.phase) + rand(-0.3, 0.3), p = G.clampToArena(P.x + Math.cos(a) * 170, P.y + Math.sin(a) * 170, 60); G.addZone({ shape: 'circle', x: p.x, y: p.y, r: 125, warn: 3.0, dmg: e.dmg * 1.5, color: '#ff8a3d', kind: 'bomb', onFire: z => G.boom(z.x, z.y, 125) }); }
    e.busy = 1.0;
  },
  shogunSweep(e) {
    const a = angTo(e, P);
    G.addZone({ shape: 'cone', x: e.x, y: e.y, r: 310, ang: a, arc: 4.4, warn: 0.85, dmg: e.dmg * 1.5, owner: e, follow: true, color: '#c8302c', onFire: z => { G.fxSlash({ x: z.x, y: z.y - 20, r: 290, ang: a, arc: 4.4, color: '#ffcf40', dur: 0.3, width: 2 }); SFX.play('heavy'); G.shake(10); } });
    G.after(1.0, () => G.addZone({ shape: 'cone', x: e.x, y: e.y, r: 230, ang: a + Math.PI, arc: 2.0, warn: 0.5, dmg: e.dmg * 1.2, owner: e, follow: true, color: '#c8302c' }), e);
    e.busy = 1.8;
  },
  overclock(e) {
    if (e.overclocked) { BOSS_PAT.clockHands(e); return; }
    e.overclocked = true; G.say(e, 'OVERCLOCK. 400% SPEED.', 3);
    e.speedMul *= 0.72; e.spd *= 1.3;
    G.fxRing(e.x, e.y, 300, '#ffcf40', 0.6, 14); SFX.play('roar');
    for (let i = 0; i < 2; i++) G.spawnEnemy('chadoll', e.x + rand(-140, 140), e.y + rand(-90, 90), { minion: true, hpMult: G.actMult() });
    e.busy = 1.0;
  },
  // ---- Kurohi
  solarFlare(e) {
    [[70, 190], [190, 310], [310, 430], [430, 560]].forEach((rr, i) => G.addZone({ shape: 'arcring', x: e.x, y: e.y, r: rr[0], r2: rr[1], gap: rand(0, TAU), gapW: 1.0, warn: 0.65 + i * 0.3, dmg: e.dmg, owner: e, color: '#ffb347' }));
    SFX.play('burn'); e.busy = 2.0;
  },
  sunspots(e) {
    for (let i = 0; i < 5 + e.phase; i++) { const p = G.clampToArena(P.x + rand(-220, 220), P.y + rand(-220, 220), 60); G.addZone({ shape: 'circle', x: p.x, y: p.y, r: 85, warn: 0.9, dur: 4, field: true, tick: 0, dmg: e.dmg * 0.6, color: '#ff8a3d', kind: 'fire' }); }
    e.busy = 1.2;
  },
  coronaBeams(e) {
    G.say(e, 'BEHOLD THE CORONA.');
    for (let i = 0; i < 6; i++) G.addZone({ shape: 'beam', x: e.x, y: e.y - 30, ang: i * TAU / 6 + rand(0, 1), len: 1100, w: 26, warn: 1.0, dur: 3.0, rot: 0.5 * e.strafe, dmg: e.dmg * 0.8, owner: e, follow: true, color: '#ffcf40' });
    e.busy = 4.0;
  },
  meteorRain(e) {
    for (let i = 0; i < 10 + e.phase * 3; i++) G.after(i * 0.16, () => {
      const p = G.clampToArena(P.x + rand(-200, 200) + P.vxEst * 0.4, P.y + rand(-200, 200) + P.vyEst * 0.4, 40);
      G.addZone({ shape: 'circle', x: p.x, y: p.y, r: 95, warn: 1.15, dmg: e.dmg, color: '#ff6a3d', kind: 'meteor', onFire: z => G.boom(z.x, z.y, 95) });
    }, e);
    e.busy = 2.2 + e.phase * 0.4;
  },
  crowSwarm(e) {
    G.say(e, 'My crows. Pluck out its eyes.');
    if (G.enemies.filter(x => !x.dead && x.minion).length < 5)
      for (let i = 0; i < 3; i++) G.spawnEnemy('yata', e.x + rand(-180, 180), e.y + rand(-100, 100), { minion: true, hpMult: G.actMult() * 0.8 });
    e.busy = 0.8;
  },
  blackEclipse(e) {
    if (G.darkT > 0) { BOSS_PAT.solarFlare(e); return; }
    G.say(e, 'Let there be no light but mine.', 3);
    G.darkT = 8; SFX.play('roar'); e.busy = 0.8;
  },
  supernova(e) {
    G.say(e, 'IF I CANNOT SHINE, NOTHING WILL!', 3.5);
    const R = G.room, corners = [[R.x0 + 140, R.y0 + WALL_TOP + 100], [R.x0 + R.w - 140, R.y0 + WALL_TOP + 100], [R.x0 + 140, R.y0 + R.h - 120], [R.x0 + R.w - 140, R.y0 + R.h - 120]];
    const far = corners.sort((a, b) => Math.hypot(b[0] - e.x, b[1] - e.y) - Math.hypot(a[0] - e.x, a[1] - e.y))[0];
    e.invulnT = 3;
    G.addZone({ shape: 'inverse', x: R.x0, y: R.y0, safes: [{ x: far[0], y: far[1] }], sr: 110, warn: 3.0, dmg: e.dmg * 3, color: '#ffcf40', onFire: () => { G.flash('#ffffff', 1); G.shake(25); SFX.play('boom'); } });
    e.busy = 3.6;
  },
});

/* ---------- drawings ---------- */
Object.assign(EDRAW, {
  gaki(ctx, e, t, f) {
    const x = e.x, y = e.y, r = e.r, b = Math.abs(Math.sin(t * 14 + e.seed)) * 3;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(ctx, x, y, r, r * 0.35);
    ctx.strokeStyle = f ? '#fff' : e.def.col; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sd * 4, y - r * 0.8); ctx.lineTo(x + sd * 7, y - 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + sd * 6, y - r * 1.6 - b); ctx.lineTo(x + sd * r * 1.2, y - r * 1.1 - b); ctx.stroke(); }
    ctx.fillStyle = f ? '#fff' : '#b8a898'; ell(ctx, x, y - r * 1.1 - b, r * 0.9, r * 0.75);
    ctx.fillStyle = f ? '#fff' : e.def.col; circ(ctx, x, y - r * 2.0 - b, r * 0.55);
    ctx.fillStyle = '#000'; ell(ctx, x - 3, y - r * 2.05 - b, 2.2, 3); ell(ctx, x + 3, y - r * 2.05 - b, 2.2, 3); ell(ctx, x, y - r * 1.75 - b, 2.5, 3.5);
    eyeGlow(ctx, x - 3, y - r * 2.05 - b, e.def.col2, 1.5); eyeGlow(ctx, x + 3, y - r * 2.05 - b, e.def.col2, 1.5);
  },
  shikome(ctx, e, t, f) {
    const k = 'shikome';
    PAL_CACHE[k] = PAL_CACHE[k] || { hair: '#d8d0c8', hair2: '#8a8278', skin: '#7a6a7a', outfit: '#2a1a2a', outfit2: '#140a14', eye: '#ff3d5e', accent: '#5a4a5a', scarf: '#ff3d5e' };
    drawChar(ctx, { x: e.x, y: e.y, s: e.r * 0.78, lookX: Math.cos(e.face), lookY: Math.sin(e.face), pal: PAL_CACHE[k], t, moving: e.moving, flash: f, hair: 'wild', mood: 'angry' });
    ctx.strokeStyle = f ? '#fff' : '#e8e0d8'; ctx.lineWidth = 2;
    for (const sd of [-1, 1]) { const hx = e.x + sd * e.r * 0.75, hy = e.y - e.r * 0.85; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + sd * 6 + Math.cos(e.face) * 8, hy + (i - 1) * 4); ctx.stroke(); } }
  },
  onryo(ctx, e, t, f) {
    const x = e.x, y = e.y - 22 + Math.sin(t * 2) * 4;
    ctx.save(); ctx.globalAlpha *= 0.92;
    ctx.fillStyle = f ? '#fff' : e.def.col;
    ctx.beginPath(); ctx.moveTo(x - 12, y - 30); ctx.lineTo(x + 12, y - 30);
    for (let i = 0; i <= 5; i++) ctx.lineTo(x + 14 - i * 5.6, y + 10 + Math.sin(t * 6 + i) * 4 * (i % 2 ? 1 : -1));
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = f ? '#fff' : '#0a0610';
    ctx.beginPath(); ctx.moveTo(x - 14, y - 40); ctx.quadraticCurveTo(x - 20, y - 5, x - 16 + Math.sin(t * 3) * 3, y + 22); ctx.lineTo(x + 16 + Math.sin(t * 3 + 1) * 3, y + 22); ctx.quadraticCurveTo(x + 20, y - 5, x + 14, y - 40); ctx.closePath(); ctx.fill();
    circ(ctx, x, y - 44, 13);
    ctx.fillStyle = '#e8e0e0'; ell(ctx, x + 2, y - 38, 4, 6);
    eyeGlow(ctx, x + 2, y - 40, '#ff3d5e', 2);
    ctx.restore();
  },
  kumo(ctx, e, t, f) {
    const x = e.x, y = e.y - e.r * 0.9, r = e.r;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(ctx, e.x, e.y, r * 1.2, r * 0.4);
    ctx.strokeStyle = f ? '#fff' : '#1a101a'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) {
      const a = (i - 1.5) * 0.4, kn = Math.sin(t * 12 + i + (sd > 0 ? 1 : 0)) * 3;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sd * r * 1.1, y - r * 0.6 + a * r + kn); ctx.lineTo(x + sd * r * 1.7, y + r * 0.6 + a * r * 0.5); ctx.stroke();
    }
    ctx.fillStyle = f ? '#fff' : e.def.col; ell(ctx, x, y, r * 0.95, r * 0.75);
    ctx.fillStyle = f ? '#fff' : shade(e.def.col, 0.2); circ(ctx, x + Math.cos(e.face) * r * 0.5, y - r * 0.2, r * 0.45);
    ctx.fillStyle = '#ff3d5e'; for (let i = 0; i < 4; i++) circ(ctx, x + Math.cos(e.face) * r * 0.6 + (i - 1.5) * 3, y - r * 0.3 - (i % 2) * 3, 1.6);
    ctx.fillStyle = e.def.col2; ctx.fillRect(x - 2, y + r * 0.1, 4, r * 0.4);
  },
  higan(ctx, e, t, f) {
    const x = e.x, y = e.y - 14, fuse = e.state === 'fuse';
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ell(ctx, e.x, e.y, 10, 4);
    ctx.strokeStyle = '#2a5a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + 12); ctx.lineTo(x, y); ctx.stroke();
    ctx.strokeStyle = f || (fuse && Math.floor(t * 16) % 2) ? '#fff' : e.def.col; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.45 + Math.sin(t * 3) * 0.1; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10 - 6, x + Math.cos(a) * 16, y + Math.sin(a) * 16 + 4); ctx.stroke(); }
    ctx.fillStyle = '#fff'; circ(ctx, x - 3, y - 2, 1.5); circ(ctx, x + 3, y - 2, 1.5);
  },
  shark(ctx, e, t, f) {
    const x = e.x, y = e.y - 18, dir = Math.cos(e.face) >= 0 ? 1 : -1;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(ctx, e.x, e.y, 28, 7);
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.rotate(Math.sin(e.face) * 0.4 * dir);
    ctx.fillStyle = f ? '#fff' : e.def.col;
    ctx.beginPath(); ctx.moveTo(30, 0); ctx.quadraticCurveTo(10, -16, -20, -6); ctx.lineTo(-34, -16 + Math.sin(t * 10) * 3); ctx.lineTo(-28, 0); ctx.lineTo(-34, 14 + Math.sin(t * 10) * 3); ctx.lineTo(-20, 6); ctx.quadraticCurveTo(10, 14, 30, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-6, -26); ctx.lineTo(-12, -8); ctx.fill();
    ctx.fillStyle = f ? '#fff' : e.def.col2; ctx.beginPath(); ctx.moveTo(28, 2); ctx.quadraticCurveTo(10, 10, -16, 5); ctx.quadraticCurveTo(10, 4, 28, 2); ctx.fill();
    ctx.fillStyle = '#000'; circ(ctx, 18, -4, 2.2);
    ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(26 - i * 4, 2); ctx.lineTo(24 - i * 4, 6); ctx.lineTo(22 - i * 4, 2); ctx.fill(); }
    ctx.restore();
  },
  ningyo(ctx, e, t, f) {
    const k = 'ningyo';
    PAL_CACHE[k] = PAL_CACHE[k] || { hair: '#ff8fd0', hair2: '#c84a9a', skin: '#e8f4f0', outfit: '#7ad7ff', outfit2: '#3a8aaa', eye: '#49f0ff', accent: '#ffffff', scarf: '#ff8fd0' };
    const y = e.y - 10 + Math.sin(t * 2) * 4;
    ctx.fillStyle = f ? '#fff' : '#3aaacc';
    ctx.beginPath(); ctx.moveTo(e.x - 10, y - 4); ctx.quadraticCurveTo(e.x + Math.sin(t * 4) * 8, y + 20, e.x - 4 + Math.sin(t * 4) * 12, y + 30); ctx.lineTo(e.x + 14 + Math.sin(t * 4) * 12, y + 34); ctx.lineTo(e.x + 4 + Math.sin(t * 4) * 10, y + 24); ctx.quadraticCurveTo(e.x + 12, y + 8, e.x + 10, y - 4); ctx.fill();
    drawChar(ctx, { x: e.x, y, s: e.r * 0.72, lookX: Math.cos(e.face), lookY: Math.sin(e.face), pal: PAL_CACHE[k], t, moving: false, flash: f, hair: 'long', noShadow: true });
  },
  umibozu(ctx, e, t, f) {
    const x = e.x, y = e.y, r = e.r, up = e.state === 'windup' ? r * 0.6 : 0;
    ctx.fillStyle = 'rgba(0,30,50,.5)'; ell(ctx, x, y, r * 1.5, r * 0.5);
    ctx.fillStyle = f ? '#fff' : e.def.col;
    ctx.beginPath(); ctx.moveTo(x - r * 1.3, y); ctx.quadraticCurveTo(x - r * 1.3, y - r * 2.8 - up, x, y - r * 2.9 - up); ctx.quadraticCurveTo(x + r * 1.3, y - r * 2.8 - up, x + r * 1.3, y);
    for (let i = 0; i <= 6; i++) ctx.lineTo(x + r * 1.3 - i * r * 0.433, y + Math.sin(t * 4 + i) * 4); ctx.fill();
    ctx.fillStyle = '#e8fbff'; ell(ctx, x - r * 0.4, y - r * 2.1 - up, r * 0.18, r * 0.12); ell(ctx, x + r * 0.4, y - r * 2.1 - up, r * 0.18, r * 0.12);
    ctx.fillStyle = 'rgba(160,230,255,.25)'; ell(ctx, x - r * 0.5, y - r * 2.4 - up, r * 0.3, r * 0.6, -0.4);
  },
  jelly(ctx, e, t, f) {
    const x = e.x, y = e.y - 34 + Math.sin(t * 2 + e.seed) * 6, r = e.r;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, e.x, e.y, r * 0.7, r * 0.25);
    ctx.strokeStyle = f ? '#fff' : e.def.col; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x - r * 0.6 + i * r * 0.3, y); ctx.quadraticCurveTo(x - r * 0.6 + i * r * 0.3 + Math.sin(t * 5 + i) * 6, y + 14, x - r * 0.6 + i * r * 0.3, y + 26); ctx.stroke(); }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(e.def.col, 0.5); ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.quadraticCurveTo(x, y + r * 0.3, x - r, y); ctx.fill();
    if (Math.random() < 0.3) { ctx.strokeStyle = e.def.col2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + rand(-r, r), y - r * 0.5); ctx.lineTo(x + rand(-r, r), y + rand(0, 20)); ctx.stroke(); }
    ctx.restore();
  },
  crab(ctx, e, t, f) {
    const x = e.x, y = e.y - e.r * 0.8, r = e.r, dir = Math.cos(e.face);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(ctx, e.x, e.y, r * 1.2, r * 0.4);
    ctx.strokeStyle = f ? '#fff' : shade(e.def.col, -0.2); ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sd * r * 0.6, y + 4 + i * 3); ctx.lineTo(x + sd * r * 1.2, y + 2 + i * 5 + Math.sin(t * 10 + i) * 2); ctx.lineTo(x + sd * r * 1.3, y + r * 0.8); ctx.stroke(); }
    ctx.fillStyle = f ? '#fff' : e.def.col; ell(ctx, x, y, r, r * 0.7);
    ctx.fillStyle = f ? '#fff' : e.def.col2; ell(ctx, x, y - 2, r * 0.6, r * 0.45);
    ctx.fillStyle = '#3a1a0a'; ctx.beginPath(); ctx.moveTo(x - 8, y - 6); ctx.lineTo(x - 2, y - 3); ctx.moveTo(x + 8, y - 6); ctx.lineTo(x + 2, y - 3); ctx.lineWidth = 2; ctx.strokeStyle = '#3a1a0a'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 6, y + 6); ctx.quadraticCurveTo(x, y + 2, x + 6, y + 6); ctx.stroke();
    // claws as shield toward face
    ctx.save(); ctx.translate(x, y); ctx.rotate(e.face);
    ctx.fillStyle = f ? '#fff' : shade(e.def.col, 0.15);
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(r * 1.15, sd * r * 0.45, r * 0.45, r * 0.3, sd * 0.4, 0, TAU); ctx.fill(); }
    ctx.restore();
  },
  kninja(ctx, e, t, f) {
    const k = 'kninja';
    PAL_CACHE[k] = PAL_CACHE[k] || { hair: '#2a2a34', hair2: '#14141a', skin: '#8a8a94', outfit: '#3a3a44', outfit2: '#1a1a20', eye: '#ffb347', accent: '#b8a06a', scarf: '#c8302c' };
    drawChar(ctx, { x: e.x, y: e.y, s: e.r * 0.8, lookX: Math.cos(e.face), lookY: Math.sin(e.face), pal: PAL_CACHE[k], t, moving: e.moving, flash: f, hair: 'short', acc: 'hood', mood: 'angry' });
    ctx.fillStyle = '#b8a06a'; circ(ctx, e.x - 5, e.y - e.r * 1.4, 3); ctx.strokeStyle = '#5a4a2a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(e.x - 5, e.y - e.r * 1.4, 3, t * 5, t * 5 + 4); ctx.stroke();
  },
  turret(ctx, e, t, f) {
    const x = e.x, y = e.y, r = e.r;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ell(ctx, x, y, r * 1.2, r * 0.45);
    ctx.fillStyle = f ? '#fff' : '#3a3020'; rrect(ctx, x - r, y - r * 0.8, r * 2, r * 0.8, 4); ctx.fill();
    ctx.fillStyle = f ? '#fff' : '#5a4a2a'; for (const sd of [-1, 1]) circ(ctx, x + sd * r * 0.7, y - r * 0.15, r * 0.3);
    ctx.save(); ctx.translate(x, y - r * 1.1); ctx.rotate(e.face - (e.recoil || 0));
    ctx.fillStyle = f ? '#fff' : e.def.col; rrect(ctx, -r * 0.4, -r * 0.4, r * 1.7, r * 0.8, 6); ctx.fill();
    ctx.fillStyle = '#111'; circ(ctx, r * 1.3, 0, r * 0.28);
    ctx.restore();
    ctx.fillStyle = f ? '#fff' : '#8a7a4a'; circ(ctx, x, y - r * 1.1, r * 0.55);
  },
  steamsam(ctx, e, t, f) {
    const k = 'steamsam';
    PAL_CACHE[k] = PAL_CACHE[k] || { hair: '#5a4a2a', hair2: '#2a2010', skin: '#a89060', outfit: '#8a6a3a', outfit2: '#3a2a14', eye: '#ffb347', accent: '#c8a050', scarf: '#c8302c', acc2: '#c8a050' };
    drawChar(ctx, { x: e.x, y: e.y, s: e.r * 0.7, lookX: Math.cos(e.face), lookY: Math.sin(e.face), pal: PAL_CACHE[k], t, moving: e.moving, flash: f, hair: 'short', acc: 'horns', mood: 'angry' });
    ctx.fillStyle = f ? '#fff' : '#6a5a3a'; rrect(ctx, e.x - e.r * 0.6, e.y - e.r * 1.95, e.r * 1.2, e.r * 0.5, 4); ctx.fill();
    if (Math.random() < 0.3) G.parts.add({ x: e.x + rand(-10, 10), y: e.y - e.r * 2.1, vx: rand(-10, 10), vy: -60, life: 0.7, t: 0, size: 5, color: '#eeeeee', type: 'smoke', drag: 1, grav: 0, rot: 0, vr: 0 });
  },
  gear(ctx, e, t, f) {
    const x = e.x, y = e.y - e.r, r = e.r;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(ctx, e.x, e.y, r, r * 0.35);
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 12);
    ctx.fillStyle = f ? '#fff' : e.def.col; star(ctx, 0, 0, r * 1.15, r * 0.85, 10); ctx.fill();
    ctx.fillStyle = f ? '#fff' : e.def.col2; circ(ctx, 0, 0, r * 0.55); ctx.fillStyle = f ? '#fff' : e.def.col; circ(ctx, 0, 0, r * 0.25);
    ctx.restore();
    ctx.fillStyle = '#ff3d2e'; circ(ctx, x - 4, y - 2, 2.5); circ(ctx, x + 4, y - 2, 2.5);
  },
  chadoll(ctx, e, t, f) {
    const k = 'chadoll';
    PAL_CACHE[k] = PAL_CACHE[k] || { hair: '#1a1410', hair2: '#0a0806', skin: '#f2e4d8', outfit: '#c8302c', outfit2: '#5a1018', eye: '#1a1410', accent: '#f2e4c8', scarf: '#ffcf40' };
    const fuse = e.state === 'fuse';
    drawChar(ctx, { x: e.x, y: e.y, s: e.r * 0.85, lookX: Math.cos(e.face), lookY: Math.sin(e.face), pal: PAL_CACHE[k], t, moving: e.moving, flash: f || (fuse && Math.floor(t * 16) % 2 === 0), hair: 'bun', mood: 'happy' });
    ctx.fillStyle = '#f2e4c8'; ctx.fillRect(e.x + 8, e.y - 22, 10, 3); ctx.fillStyle = '#7a9a5a'; circ(ctx, e.x + 13, e.y - 24, 3);
  },
  crow3(ctx, e, t, f) {
    const x = e.x, y = e.y - 40 + Math.sin(t * 6) * 5, fl = Math.sin(t * (e.dashing ? 30 : 9)) * 0.5;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ell(ctx, e.x, e.y, 14, 5);
    ctx.save(); ctx.translate(x, y); ctx.rotate(e.face + Math.PI / 2);
    ctx.fillStyle = f ? '#fff' : e.def.col;
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sd * 30, -6 + fl * 10 * sd); ctx.lineTo(sd * 24, 8); ctx.closePath(); ctx.fill(); }
    ell(ctx, 0, 0, 8, 14);
    ctx.fillStyle = '#ffcf40'; ctx.beginPath(); ctx.moveTo(-3, -12); ctx.lineTo(0, -20); ctx.lineTo(3, -12); ctx.fill();
    ctx.strokeStyle = '#ffcf40'; ctx.lineWidth = 1.5; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 3, 12); ctx.lineTo(i * 4, 18); ctx.stroke(); }
    ctx.restore();
    eyeGlow(ctx, x, y - 6, '#ffcf40', 2);
  },
  sunpriest(ctx, e, t, f) {
    const k = 'sunpriest';
    PAL_CACHE[k] = PAL_CACHE[k] || { hair: '#1a0a04', hair2: '#0a0402', skin: '#c8a888', outfit: '#2a1a0a', outfit2: '#140a04', eye: '#ffb347', accent: '#ffcf40', scarf: '#ff6a3d', acc2: '#ffcf40' };
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,180,70,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y - e.r * 2.3, e.r * 1.0, 0, TAU); ctx.stroke(); ctx.restore();
    drawChar(ctx, { x: e.x, y: e.y, s: e.r * 0.78, lookX: Math.cos(e.face), lookY: Math.sin(e.face), pal: PAL_CACHE[k], t, moving: e.moving, flash: f, hair: 'long', acc: 'hood', eyesClosed: true });
  },
  eclsam(ctx, e, t, f) {
    const k = 'eclsam';
    PAL_CACHE[k] = PAL_CACHE[k] || { hair: '#1a1410', hair2: '#0a0806', skin: '#1a1410', outfit: '#2a2014', outfit2: '#140e08', eye: '#ffcf40', accent: '#ffcf40', scarf: '#ff6a3d', acc2: '#ffcf40' };
    drawChar(ctx, { x: e.x, y: e.y, s: e.r * 0.72, lookX: Math.cos(e.face), lookY: Math.sin(e.face), pal: PAL_CACHE[k], t, moving: e.moving, flash: f, hair: 'short', acc: 'crown', mood: 'angry' });
    ctx.save(); ctx.translate(e.x, e.y - e.r * 1.1); ctx.rotate(e.face + (e.state === 'combo' ? Math.sin(t * 14) * 0.9 : 0.4));
    ctx.fillStyle = '#3a2a14'; ctx.fillRect(-10, -3, 16, 6);
    ctx.fillStyle = f ? '#fff' : '#ffcf40'; ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(78, -6); ctx.lineTo(88, 0); ctx.lineTo(6, 4); ctx.fill();
    ctx.restore();
  },
  corona(ctx, e, t, f) {
    const x = e.x, y = e.y - 44 + Math.sin(t * 2) * 6, r = e.r;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(ctx, e.x, e.y, r * 0.8, r * 0.3);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + t; ctx.fillStyle = rgba(e.def.col, 0.5); ell(ctx, x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3, 8, 3, a); }
    ctx.fillStyle = rgba(e.def.col, 0.4); circ(ctx, x, y, r * 1.4);
    ctx.restore();
    ctx.fillStyle = f ? '#fff' : e.def.col2; circ(ctx, x, y, r);
    ctx.strokeStyle = e.def.col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  },
  wanyudo(ctx, e, t, f) {
    const x = e.x, y = e.y - e.r, r = e.r;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(ctx, e.x, e.y, r, r * 0.35);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + t * 6; ctx.fillStyle = 'rgba(255,106,61,.55)'; ell(ctx, x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * 1.15 - 6, 7, 12, a); }
    ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 10);
    ctx.strokeStyle = f ? '#fff' : '#5a3a1a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 3; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * TAU / 6) * r, Math.sin(i * TAU / 6) * r); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = f ? '#fff' : '#e8c8a8'; circ(ctx, x, y, r * 0.5);
    ctx.fillStyle = '#1a0a04'; ell(ctx, x - 4, y - 2, 2, 3); ell(ctx, x + 4, y - 2, 2, 3); ell(ctx, x, y + 5, 4, 3);
  },
  // bosses
  jorogumo(ctx, e, t, f) {
    const legY = e.y - 26;
    ctx.strokeStyle = f ? '#fff' : '#1a0a24'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) {
      const a = (i - 1.5) * 0.5, kn = Math.sin(t * 6 + i * 1.3 + sd) * 6;
      ctx.beginPath(); ctx.moveTo(e.x, legY); ctx.lineTo(e.x + sd * 50, legY - 40 + a * 40 + kn); ctx.lineTo(e.x + sd * 74, legY + 24 + a * 22); ctx.stroke();
    }
    ctx.fillStyle = f ? '#fff' : '#2a1a3a'; ell(ctx, e.x, e.y - 14, 34, 22);
    ctx.fillStyle = '#ff3d8f'; ctx.beginPath(); ctx.moveTo(e.x, e.y - 30); ctx.lineTo(e.x + 8, e.y - 14); ctx.lineTo(e.x, e.y + 2); ctx.lineTo(e.x - 8, e.y - 14); ctx.fill();
    bossChar(ctx, e, t, f, 1.25, (c, x, y) => { c.strokeStyle = 'rgba(216,208,255,.6)'; c.lineWidth = 1; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 20 + i * 6, y - 30 - i * 10); c.stroke(); } });
  },
  watatsumi(ctx, e, t, f) {
    e.segs = e.segs || [];
    const last = e.segs[0];
    if (!last || Math.hypot(last.x - e.x, last.y - e.y) > 16) { e.segs.unshift({ x: e.x, y: e.y }); if (e.segs.length > 16) e.segs.pop(); }
    for (let i = e.segs.length - 1; i >= 0; i--) {
      const s = e.segs[i], k = 1 - i / 18, r = 26 * k + 6;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ell(ctx, s.x, s.y + 4, r, r * 0.35);
      ctx.fillStyle = f ? '#fff' : (i % 2 ? '#1a6a8a' : '#2a8aaa'); circ(ctx, s.x, s.y - 30 + Math.sin(t * 3 + i * 0.6) * 6, r);
      ctx.fillStyle = f ? '#fff' : '#ffe14d'; circ(ctx, s.x, s.y - 30 - r * 0.6 + Math.sin(t * 3 + i * 0.6) * 6, r * 0.25);
    }
    const hx = e.x, hy = e.y - 40, a = e.face;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(a);
    ctx.fillStyle = f ? '#fff' : '#2a9ac0'; ell(ctx, 10, 0, 40, 26);
    ctx.fillStyle = f ? '#fff' : '#9ee7ff'; ell(ctx, 38, 0, 18, 14);
    ctx.fillStyle = '#ffe14d'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-6, sd * 14); ctx.quadraticCurveTo(-30, sd * 40, -46, sd * 30); ctx.lineTo(-20, sd * 12); ctx.fill(); }
    ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 2; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(46, sd * 6); ctx.quadraticCurveTo(70, sd * (20 + Math.sin(t * 4) * 6), 90, sd * 10); ctx.stroke(); }
    ctx.fillStyle = '#111'; circ(ctx, 26, -12, 4); circ(ctx, 26, 12, 4);
    eyeGlow(ctx, 26, -12, '#ffe14d', 3); eyeGlow(ctx, 26, 12, '#ffe14d', 3);
    ctx.restore();
  },
  tokugane(ctx, e, t, f) {
    ctx.save(); ctx.translate(e.x, e.y - 70); ctx.rotate(t * (e.overclocked ? 4 : 1.2));
    ctx.fillStyle = f ? '#fff' : '#8a6a2a'; star(ctx, 0, 0, 52, 42, 14); ctx.fill(); ctx.fillStyle = '#3a2a14'; circ(ctx, 0, 0, 30);
    ctx.restore();
    bossChar(ctx, e, t, f, 1.65, (c, x, y, a) => { c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = '#3a2a14'; c.fillRect(-10, -4, 18, 8); c.fillStyle = f ? '#fff' : '#ffcf40'; c.beginPath(); c.moveTo(8, -5); c.lineTo(96, -7); c.lineTo(108, 0); c.lineTo(8, 5); c.fill(); c.restore(); });
    ctx.save(); ctx.translate(e.x, e.y - 70);
    ctx.strokeStyle = '#ffcf40'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(t) * 22, Math.sin(t) * 22); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(t * 12) * 28, Math.sin(t * 12) * 28); ctx.stroke();
    ctx.restore();
  },
  kurohi(ctx, e, t, f) {
    const hx = e.x, hy = e.y - 92;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) { const a = i * TAU / 16 + t * 0.5; ctx.strokeStyle = 'rgba(255,180,70,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * 32, hy + Math.sin(a) * 32); ctx.lineTo(hx + Math.cos(a) * (46 + Math.sin(t * 6 + i) * 6), hy + Math.sin(a) * (46 + Math.sin(t * 6 + i) * 6)); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,150,50,.2)'; circ(ctx, hx, hy, 50);
    ctx.restore();
    ctx.fillStyle = '#060300'; circ(ctx, hx, hy, 30); ctx.strokeStyle = '#ffcf40'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hx, hy, 30, 0, TAU); ctx.stroke();
    bossChar(ctx, e, t, f, 1.35, (c, x, y) => { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,180,70,.8)'; circ(c, x + 8, y - 8, 9 + Math.sin(t * 8) * 2); c.restore(); });
  },
});

/* =====================================================================
   UPDATE 3 — bullet-hell toolkit, god & Calamity patterns, drawings
   ===================================================================== */
const BH = {
  shot(e, a, sp, o = {}) {
    return G.eProj(Object.assign({ x: e.x + (o.ox || 0), y: e.y - 34 + (o.oy || 0), ang: a, speed: sp, dmg: e.dmg * (o.k || 0.62), r: o.r || 9, color: o.color || e.def.col, kind: o.kind || 'orb', life: o.life || 7, owner: e }, o.p || {}));
  },
  ring(e, n, sp, o = {}) {
    const off = o.off !== undefined ? o.off : rand(0, TAU);
    for (let i = 0; i < n; i++) { const a = off + i * TAU / n; if (o.gap !== undefined && Math.abs(angDiff(a, o.gap)) < (o.gapW || 0.5) / 2) continue; BH.shot(e, a, sp, o); }
  },
  aim(e) { return Math.atan2(P.y - 16 - (e.y - 34), P.x - e.x); },
  fan(e, n, spread, sp, o = {}) {
    const a = o.base !== undefined ? o.base : BH.aim(e);
    for (let i = 0; i < n; i++) BH.shot(e, a + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0), sp, o);
  },
  spiral(e, arms, steps, every, sp, rot, o = {}) {
    let a = o.off !== undefined ? o.off : rand(0, TAU);
    for (let st = 0; st < steps; st++) G.after(st * every, () => {
      for (let i = 0; i < arms; i++) BH.shot(e, a + i * TAU / arms, sp, Object.assign({}, o, o.alt ? { p: Object.assign({}, o.p, { turn: (st % 2 ? 1 : -1) * o.alt }) } : {}));
      a += rot;
    }, e);
    return steps * every;
  },
  rain(e, n, every, sp, o = {}) {
    const R = G.room;
    for (let i = 0; i < n; i++) G.after(i * every, () => {
      G.eProj(Object.assign({ x: rand(R.x0 + 60, R.x0 + R.w - 60), y: R.y0 + WALL_TOP - 30, ang: Math.PI / 2 + rand(-0.15, 0.15), speed: sp, dmg: e.dmg * (o.k || 0.55), r: o.r || 9, color: o.color || e.def.col, kind: o.kind || 'orb', life: 9, owner: e }, o.p || {}));
    }, e);
    return n * every;
  },
};
Object.assign(BOSS_PAT, {
  /* ---------------- Hinome ---------------- */
  sunWheel(e) {
    const d = BH.spiral(e, 3, 36 + e.phase * 8, 0.07, 210, 0.19, { color: '#ff7a3d' });
    if (e.phase >= 1) BH.spiral(e, 3, 36 + e.phase * 8, 0.07, 170, -0.23, { color: '#ffcf40', r: 8 });
    SFX.play('burn'); e.busy = d + 0.3;
  },
  flareRings(e) {
    const off = rand(0, TAU), n = 26 + e.phase * 4;
    for (let w = 0; w < 5; w++) G.after(w * 0.34, () => { BH.ring(e, n, 190, { off: off + (w % 2) * Math.PI / n, color: w % 2 ? '#ffcf40' : '#ff7a3d' }); SFX.play('burn', 0.4); }, e);
    e.busy = 2.0;
  },
  emberSwarm(e) {
    BH.ring(e, 12 + e.phase * 4, 150, { k: 0.5, color: '#ffb347', p: { homing: 1.15 }, life: 6 });
    G.after(0.5, () => BH.fan(e, 7, 0.9, 300, { color: '#ff7a3d' }), e);
    e.busy = 1.3;
  },
  pillarSweep(e) {
    const R = G.room, dir = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < 8; i++) { const k = (i + 0.5) / 8, x = R.x0 + (dir > 0 ? k : 1 - k) * R.w; G.addZone({ shape: 'line', x, y: R.y0, ang: Math.PI / 2, len: R.h, w: 74, warn: 0.75 + i * 0.17, dmg: e.dmg * 1.1, color: '#ff7a3d', onFire: z => G.parts.burst(z.x, P.y, 8, { type: 'glow', color: '#ff7a3d', min: 60, max: 200, grav: -300 }) }); }
    BH.ring(e, 20, 160, { color: '#ffcf40' });
    e.busy = 2.3;
  },
  dawnEternal(e) {
    G.say(e, 'A DAWN THAT NEVER ENDS!', 3);
    const d = BH.spiral(e, 4, 52, 0.075, 200, 0.17, { color: '#ff7a3d' });
    BH.spiral(e, 4, 52, 0.075, 160, -0.21, { color: '#ffe9a0', r: 8 });
    G.after(d * 0.5, () => BH.ring(e, 40, 230, { color: '#ffcf40' }), e);
    e.busy = d + 0.5;
  },
  /* ---------------- Raika ---------------- */
  drumBeats(e, beats = 10, every = 0.3) {
    const n = 22 + e.phase * 2, off = rand(0, TAU);
    for (let b = 0; b < beats; b++) G.after(b * every, () => {
      BH.ring(e, n, 240, { off: off + (b % 2) * Math.PI / n, color: '#ffe14d' });
      if (b % 2) BH.fan(e, 3, 0.3, 360, { color: '#ffffff', r: 7 });
      SFX.play('don', 0.6); G.shake(2);
    }, e);
    e.busy = beats * every + 0.4;
  },
  boltGrid(e) {
    for (let w = 0; w < 2; w++) G.after(w * 0.6, () => {
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        if ((i + j + w) % 2) continue;
        const p = G.clampToArena(P.x + i * 140, P.y + j * 140, 40);
        G.addZone({ shape: 'circle', x: p.x, y: p.y, r: 82, warn: 0.75, dmg: e.dmg * 1.1, color: '#ffe14d', kind: 'bolt', onFire: z => { G.fxBolt(z.x, z.y - 520, z.x, z.y); SFX.play('thunder', 0.5); } });
      }
    }, e);
    e.busy = 1.8;
  },
  chainLines(e) {
    const base = rand(0, TAU);
    for (let w = 0; w < 3; w++) G.after(w * 0.45, () => { for (let i = 0; i < 8; i++) G.addZone({ shape: 'line', x: e.x, y: e.y, ang: base + w * 0.2 + i * TAU / 8, len: 900, w: 30, warn: 0.55, dmg: e.dmg, owner: e, color: '#ffe14d', onFire: z => G.fxLine(z.x, z.y, z.x + Math.cos(z.ang) * 900, z.y + Math.sin(z.ang) * 900, '#ffe14d', 6, 0.15) }); }, e);
    e.busy = 2.0;
  },
  thunderDash(e) {
    for (let i = 0; i < 4; i++) G.after(i * 0.7, () => {
      G.ghostE(e);
      const a = rand(0, TAU), p = G.clampToArena(P.x + Math.cos(a) * 280, P.y + Math.sin(a) * 280, 60);
      e.x = p.x; e.y = p.y; G.fxBolt(e.x, e.y - 500, e.x, e.y); SFX.play('thunder');
      BH.ring(e, 16 + e.phase * 4, 260, { color: '#ffe14d' });
    }, e);
    e.busy = 3.0;
  },
  stormSymphony(e) { G.say(e, 'THE STORM IS A SYMPHONY!', 3); BOSS_PAT.drumBeats(e, 14, 0.24); G.after(1.0, () => BOSS_PAT.boltGrid(e), e); e.busy = 4.0; },
  /* ---------------- Tsukiyo ---------------- */
  crescentCurves(e) {
    for (let w = 0; w < 4; w++) G.after(w * 0.5, () => { const tn = (w % 2 ? 1 : -1) * 0.9; BH.ring(e, 18 + e.phase * 2, 230, { kind: 'crescent', r: 11, color: '#b49cff', p: { turn: tn }, life: 6 }); SFX.play('slash', 0.4); }, e);
    e.busy = 2.4;
  },
  moonPhases(e) {
    for (let w = 0; w < 4; w++) G.after(w * 0.35, () => BH.ring(e, 20, 260, { color: '#e8e0ff', k: 0.55, p: { delayAim: 0.9 - w * 0.1, aimSpeed: 340, aimOff: rand(-0.15, 0.15) } }), e);
    e.busy = 2.4;
  },
  eclipseBeams(e) {
    const a = rand(0, TAU);
    for (const o of [0, Math.PI]) G.addZone({ shape: 'beam', x: e.x, y: e.y - 30, ang: a + o, len: 1200, w: 30, warn: 0.9, dur: 3.2, rot: 0.9 * e.strafe, dmg: e.dmg * 0.8, owner: e, follow: true, color: '#b49cff' });
    for (let w = 0; w < 3; w++) G.after(1.0 + w * 0.8, () => BH.ring(e, 16, 140, { color: '#e8e0ff' }), e);
    e.busy = 4.2;
  },
  silverRain(e) { const d = BH.rain(e, 50, 0.05, 230, { kind: 'needle', color: '#e8e0ff' }); for (let i = 0; i < 3; i++) G.after(i * 0.8, () => BH.fan(e, 5, 0.6, 320, { kind: 'crescent', color: '#b49cff' }), e); e.busy = d + 0.4; },
  fullMoonBloom(e) {
    G.say(e, 'BEHOLD THE FULL MOON.', 3);
    BH.ring(e, 72, 110, { color: '#efe8ff', r: 8 }); G.after(0.6, () => BH.ring(e, 72, 110, { color: '#b49cff', r: 8 }), e);
    G.after(1.2, () => BOSS_PAT.moonPhases(e), e);
    e.busy = 4.0;
  },
  /* ---------------- Mizuha ---------------- */
  tideWaves(e) { for (let w = 0; w < 5; w++) G.after(w * 0.4, () => { BH.fan(e, 13, 1.6, 200, { color: '#6ee7ff', kind: 'bubble', r: 10, p: { wave: 40 } }); SFX.play('splash', 0.4); }, e); e.busy = 2.4; },
  snowfall(e) { const d = BH.rain(e, 60, 0.04, 60, { kind: 'flake', color: '#e8fbff', p: { accel: 160, maxSpd: 320 } }); e.busy = d + 0.3; },
  icicleFan(e) { for (let w = 0; w < 4; w++) G.after(w * 0.45, () => BH.fan(e, 9, 1.0, 80, { kind: 'shard', color: '#9ee7ff', p: { accel: 420, maxSpd: 520 } }), e); e.busy = 2.0; },
  frostFields(e) {
    for (let i = 0; i < 4; i++) { const p = G.clampToArena(P.x + rand(-160, 160), P.y + rand(-160, 160), 60); G.addZone({ shape: 'circle', x: p.x, y: p.y, r: 95, warn: 0.6, dur: 5, field: true, slowField: true, dmg: 0, color: '#9ee7ff' }); }
    BH.ring(e, 24, 180, { kind: 'shard', color: '#9ee7ff' }); e.busy = 1.2;
  },
  stillWaters(e) {
    G.say(e, 'BE. STILL.', 3);
    const R = G.room;
    G.addZone({ shape: 'circle', x: R.x0 + R.w / 2, y: R.y0 + R.h / 2, r: 240, warn: 0.6, dur: 4.2, field: true, pull: 130, dmg: e.dmg * 0.8, color: '#6ee7ff' });
    const d = BH.spiral(e, 4, 50, 0.08, 170, 0.15, { color: '#6ee7ff', kind: 'bubble' });
    e.busy = d + 0.3;
  },
  /* ---------------- Kazane ---------------- */
  galeSpiral(e) { const d = BH.spiral(e, 5, 40, 0.06, 300, 0.13, { kind: 'crescent', color: '#7dffb0', r: 9, p: { turn: 0.5 } }); e.busy = d + 0.3; },
  crossWind(e) {
    const R = G.room;
    for (let st = 0; st < 16; st++) G.after(st * 0.12, () => {
      for (const side of [0, 1]) {
        const y = R.y0 + WALL_TOP + 40 + ((st * 3 + side * 7) % 10) / 10 * (R.h - WALL_TOP - 100);
        G.eProj({ x: side ? R.x0 + R.w - WALL - 5 : R.x0 + WALL + 5, y, ang: side ? Math.PI : 0, speed: 320, dmg: e.dmg * 0.55, r: 9, color: '#7dffb0', kind: 'crescent', life: 6, owner: e });
      }
    }, e);
    e.busy = 2.2;
  },
  windDash(e) {
    for (let i = 0; i < 4; i++) G.after(i * 0.8, () => {
      const a = angTo(e, P), len = clamp(dist(e, P) + 200, 300, 650);
      G.addZone({ shape: 'line', x: e.x, y: e.y, ang: a, len, w: 60, warn: 0.45, dmg: e.dmg * 1.2, owner: e, color: '#7dffb0', onFire: () => {
        const x0 = e.x, y0 = e.y; G.moveSafe(e, Math.cos(a) * len, Math.sin(a) * len); SFX.play('dash');
        for (let k = 1; k <= 7; k++) G.eProj({ x: lerp(x0, e.x, k / 8), y: lerp(y0, e.y, k / 8) - 20, ang: a, speed: 1, dmg: e.dmg * 0.55, r: 9, color: '#7dffb0', kind: 'orb', life: 6, owner: e, delayAim: 0.8 + k * 0.05, aimSpeed: 300 });
      } });
    }, e);
    e.busy = 3.4;
  },
  twinTornado(e) {
    const R = G.room;
    for (const fx of [0.28, 0.72]) G.addZone({ shape: 'circle', x: R.x0 + R.w * fx, y: R.y0 + R.h * 0.55, r: 150, warn: 0.6, dur: 4.0, field: true, pull: 110, dmg: e.dmg * 0.7, color: '#7dffb0' });
    BH.ring(e, 28, 200, { kind: 'crescent', color: '#7dffb0' }); e.busy = 1.5;
  },
  typhoonEye(e) {
    G.say(e, 'NOTHING STANDS STILL IN MY STORM!', 3);
    const a = rand(0, TAU);
    for (let i = 0; i < 4; i++) G.addZone({ shape: 'beam', x: e.x, y: e.y - 30, ang: a + i * TAU / 4, len: 1200, w: 24, warn: 0.9, dur: 3.4, rot: 0.75, dmg: e.dmg * 0.8, owner: e, follow: true, color: '#7dffb0' });
    G.after(0.9, () => BOSS_PAT.galeSpiral(e), e);
    e.busy = 4.4;
  },
  /* ---------------- Shuten ---------------- */
  sakeFountain(e) {
    for (let v = 0; v < 3; v++) G.after(v * 0.55, () => { for (let i = 0; i < 14 + e.phase * 4; i++) BH.shot(e, -Math.PI / 2 + rand(-1.25, 1.25), rand(300, 440), { color: '#ff3d5e', k: 0.6, p: { gy: 380 }, life: 4 }); SFX.play('splash', 0.4); }, e);
    e.busy = 2.2;
  },
  clubQuake(e) {
    G.addZone({ shape: 'circle', x: e.x, y: e.y, r: 210, warn: 0.85, dmg: e.dmg * 1.3, owner: e, follow: true, color: '#c8302c', onFire: z => { G.boom(z.x, z.y, 210); BH.ring(e, 36, 230, { color: '#ff3d5e' }); G.after(0.35, () => BH.ring(e, 36, 170, { color: '#ffcf40', r: 8 }), e); } });
    e.busy = 1.9;
  },
  oniRush(e) {
    for (let i = 0; i < 3; i++) G.after(i * 0.9, () => {
      const a = angTo(e, P), len = clamp(dist(e, P) + 160, 280, 640);
      G.addZone({ shape: 'line', x: e.x, y: e.y, ang: a, len, w: 90, warn: 0.6, dmg: e.dmg * 1.4, owner: e, color: '#c8302c', onFire: () => { G.moveSafe(e, Math.cos(a) * len, Math.sin(a) * len); G.shake(8); SFX.play('boom', 0.6); BH.ring(e, 20, 220, { color: '#ff3d5e' }); } });
    }, e);
    e.busy = 3.0;
  },
  bloodRain(e) { const d = BH.rain(e, 50, 0.05, 240, { color: '#ff3d5e' }); for (let i = 0; i < 3; i++) G.after(i * 0.8, () => BH.fan(e, 7, 0.8, 300, { color: '#ffcf40', r: 8 }), e); e.busy = d + 0.3; },
  drunkenSpiral(e) { G.say(e, 'ANOTHER ROUND! GAHAHAHA!', 3); const d = BH.spiral(e, 3, 56, 0.07, 200, 0.21, { color: '#ff3d5e', alt: 0.8 }); G.after(d / 2, () => BOSS_PAT.sakeFountain(e), e); e.busy = d + 0.4; },
  /* ---------------- Kogane ---------------- */
  coinBounce(e) { BH.ring(e, 20 + e.phase * 4, 300, { kind: 'coin', r: 10, color: '#ffcf40', p: { bounce: 3 }, life: 7 }); SFX.play('coin'); e.busy = 1.6; },
  kobanRain(e) {
    const d = BH.rain(e, 45, 0.05, 220, { kind: 'coin', color: '#ffcf40', r: 9 });
    for (let i = 0; i < 6; i++) G.after(i * 0.3, () => { const p = G.clampToArena(P.x + rand(-120, 120), P.y + rand(-120, 120), 40); G.addZone({ shape: 'circle', x: p.x, y: p.y, r: 70, warn: 0.8, dmg: e.dmg, color: '#ffcf40', kind: 'missile', onFire: z => G.parts.burst(z.x, z.y, 10, { color: '#ffcf40', min: 60, max: 220 }) }); }, e);
    e.busy = d + 0.3;
  },
  goldRings(e) { for (let w = 0; w < 4; w++) G.after(w * 0.4, () => BH.ring(e, 24, 200, { kind: 'coin', color: '#ffcf40', r: 9, p: { turn: (w % 2 ? 0.6 : -0.6) } }), e); e.busy = 2.0; },
  slotMachine(e) {
    const opts = ['coinBounce', 'goldRings', 'kobanRain'], a = pick(opts), b = pick(opts);
    G.say(e, pick(['7 - 7 - 7!', 'CHERRY - CHERRY - BAR!', 'FOX - FOX - FOX!']), 2);
    BOSS_PAT[a](e); const t1 = e.busy; G.after(t1 * 0.6, () => BOSS_PAT[b](e), e);
    e.busy = t1 * 0.6 + 2.2;
  },
  jackpotStorm(e) {
    G.say(e, 'JACKPOT! EVERYTHING MUST GO!', 3);
    const d = BH.spiral(e, 6, 44, 0.08, 210, 0.12, { kind: 'coin', color: '#ffcf40', r: 9 });
    BH.rain(e, 40, 0.08, 200, { kind: 'coin', color: '#ffe9a0', r: 8 });
    e.busy = d + 0.4;
  },
  /* ---------------- shared god desperation ---------------- */
  godLament(e) {
    G.say(e, '...help... me...', 3);
    e.invulnT = 1.5;
    for (let w = 0; w < 4; w++) G.after(w * 0.35, () => BH.ring(e, 40, 170 + w * 20, { off: w * 0.08, color: w % 2 ? KAMI[e.def.kami].color : '#5b2b8a' }), e);
    e.busy = 2.0;
  },
  /* ---------------- Ōmagatsuhi ---------------- */
  blackTears(e) {
    const d = BH.rain(e, 60 + e.phase * 10, 0.04, 250, { color: '#5b2b8a', kind: 'void', r: 10 });
    for (let w = 0; w < 3; w++) G.after(w * 0.7, () => BH.ring(e, 30 + e.phase * 4, 210, { color: '#ff2e63' }), e);
    e.busy = Math.max(d, 2.1) * 0.85;
  },
  calamityEye(e) {
    G.say(e, pick(['I SEE YOU.', 'LOOK AT ME.', 'NOWHERE TO HIDE.']));
    for (let i = 0; i < 3; i++) G.after(i * 1.0, () => G.addZone({ shape: 'beam', x: e.x, y: e.y - 40, ang: BH.aim(e) + rand(-0.3, 0.3), len: 1300, w: 54, warn: 0.75, dur: 1.0, rot: 0.6 * (i % 2 ? 1 : -1), dmg: e.dmg, owner: e, follow: true, color: '#ff2e63' }), e);
    G.after(0.4, () => BH.ring(e, 24, 160, { color: '#5b2b8a' }), e);
    e.busy = 3.2;
  },
  abyssSpiral(e) { const d = BH.spiral(e, 6, 54, 0.05, 230, 0.11, { color: '#5b2b8a', kind: 'void', r: 10, alt: 0.35 }); BH.spiral(e, 2, 54, 0.05, 300, -0.31, { color: '#ff2e63', r: 7 }); e.busy = d * 0.9; },
  thousandHands(e) {
    G.say(e, 'A THOUSAND HANDS FROM BELOW.');
    const R = G.room, sp = 150;
    for (let w = 0; w < 2; w++) G.after(w * 0.85, () => {
      for (let i = 0; R.x0 + 90 + i * sp < R.x0 + R.w - 50; i++) for (let j = 0; R.y0 + WALL_TOP + 50 + j * sp < R.y0 + R.h - 40; j++) {
        if ((i + j) % 2 !== w) continue;
        G.addZone({ shape: 'circle', x: R.x0 + 90 + i * sp, y: R.y0 + WALL_TOP + 50 + j * sp, r: 76, warn: 0.95, dmg: e.dmg * 1.2, color: '#ff2e63', kind: 'hands', onFire: z => G.parts.burst(z.x, z.y, 6, { color: '#1a0a1a', min: 60, max: 200, grav: -300, size: 4 }) });
      }
    }, e);
    e.busy = 2.3;
  },
  godEcho(e) {
    const pats = ['sunWheel', 'drumBeats', 'crescentCurves', 'tideWaves', 'galeSpiral', 'sakeFountain', 'coinBounce', 'moonPhases', 'icicleFan', 'clubQuake'];
    const p = pick(pats);
    G.say(e, pick(['I WEAR YOUR GODS.', 'THEIR POWER IS MINE.', 'REMEMBER THIS ONE?']));
    BOSS_PAT[p](e);
    e.busy *= 0.85;
  },
  defile(e) {
    G.say(e, 'DEFILEMENT.', 2.5);
    const R = G.room, safes = [];
    for (let i = 0; i < 2; i++) safes.push(G.clampToArena(rand(R.x0 + 150, R.x0 + R.w - 150), rand(R.y0 + 160, R.y0 + R.h - 150), 110));
    G.addZone({ shape: 'inverse', x: R.x0, y: R.y0, safes, sr: 100, warn: 2.4, dmg: e.dmg * 2, color: '#5b2b8a', onFire: () => { G.flash('#1a0010', 0.6); G.shake(14); SFX.play('boom'); } });
    BH.spiral(e, 3, 30, 0.08, 150, 0.2, { color: '#ff2e63', r: 7 });
    e.busy = 3.0;
  },
  worldEnd(e) {
    G.say(e, 'IF I FALL, THE WORLD FALLS WITH ME!', 4);
    e.invulnT = 4;
    BH.spiral(e, 5, 60, 0.06, 220, 0.12, { color: '#5b2b8a', kind: 'void', r: 10 });
    BH.spiral(e, 5, 60, 0.06, 180, -0.15, { color: '#ff2e63', r: 8 });
    for (let w = 0; w < 4; w++) G.after(0.8 + w * 0.8, () => BH.ring(e, 40, 200, { off: w * 0.1, color: '#ffffff', r: 7 }), e);
    e.busy = 4.5;
  },
});
Object.assign(EDRAW, {
  god(ctx, e, t, f) {
    const k = e.def.kami, col = KAMI[k].color, H = HEROES[e.def.hero], hx = e.x, hy = e.y - 96;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(col, 0.55); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(hx, hy, 34, 0, TAU); ctx.stroke();
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + t * 0.6; ctx.strokeStyle = rgba(col, 0.45); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * 38, hy + Math.sin(a) * 38); ctx.lineTo(hx + Math.cos(a) * (50 + Math.sin(t * 5 + i) * 5), hy + Math.sin(a) * (50 + Math.sin(t * 5 + i) * 5)); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(91,43,138,.85)'; ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + t * 0.4; ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * 30, hy + Math.sin(a) * 30); ctx.quadraticCurveTo(hx + Math.cos(a + 0.6) * 60, hy + Math.sin(a + 0.6) * 60 + Math.sin(t * 3 + i) * 10, hx + Math.cos(a) * 80, hy + Math.sin(a) * 80 + 20); ctx.stroke(); }
    ctx.fillStyle = col; ctx.font = '900 26px "Shippori Mincho", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(KAMI[k].glyph, hx, hy + 1);
    ctx.restore();
    const proxy = { t, x: e.x, y: e.y, aim: e.face, lookX: Math.cos(e.face), swingT: 0, swingDur: 1, auraT: 0, weapon: 0, typhoon: null, feastT: 0, combo: 0 };
    bossChar(ctx, e, t, f, 1.4, (c, x, y, a) => H.drawWeapon(c, proxy, x, y, a));
  },
  omaga(ctx, e, t, f) {
    const x = e.x, y = e.y, r = e.r, ph = e.phase || 0;
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ell(ctx, x, y, r * 2, r * 0.6);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,46,99,${0.1 + ph * 0.03})`; circ(ctx, x, y - r * 1.6, r * 2.8 + Math.sin(t * 2) * 8);
    ctx.restore();
    ctx.strokeStyle = f ? '#fff' : '#1a0a1a'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) { const a = Math.PI * (0.05 + i * 0.13), w = Math.sin(t * 2 + i) * 14; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x + Math.cos(a) * r * 2 + w, y - r - Math.sin(a) * r * 0.4, x + Math.cos(a) * r * 2.8 + w, y + r * 0.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x - Math.cos(a) * r * 2 - w, y - r - Math.sin(a) * r * 0.4, x - Math.cos(a) * r * 2.8 - w, y + r * 0.2); ctx.stroke(); }
    ctx.fillStyle = f ? '#fff' : '#0a0610';
    ctx.beginPath(); ctx.moveTo(x - r * 1.3, y); ctx.quadraticCurveTo(x - r * 1.5, y - r * 3.4, x, y - r * 3.6); ctx.quadraticCurveTo(x + r * 1.5, y - r * 3.4, x + r * 1.3, y);
    for (let i = 0; i <= 8; i++) ctx.lineTo(x + r * 1.3 - i * r * 0.325, y + Math.sin(t * 5 + i) * 6); ctx.fill();
    ctx.fillStyle = '#2a1030';
    for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.32; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 1.0, y - r * 3.1 + Math.sin(a) * r * 0.3); ctx.lineTo(x + Math.cos(a) * r * 1.9, y - r * 3.1 + Math.sin(a) * r * 1.4); ctx.lineTo(x + Math.cos(a + 0.12) * r * 1.0, y - r * 3.1); ctx.fill(); }
    const eyes = [[0, -2.3, 1.0], [-0.55, -1.7, 0.55], [0.55, -1.7, 0.55], [-0.35, -1.1, 0.4], [0.35, -1.1, 0.4], [0, -0.6, 0.35]].slice(0, 2 + ph);
    for (const [ex, ey, es] of eyes) {
      const X = x + ex * r, Y = y + ey * r, R2 = r * 0.32 * es;
      ctx.fillStyle = f ? '#fff' : '#f2e4e8'; ell(ctx, X, Y, R2 * 1.4, R2 * (0.7 + Math.abs(Math.sin(t * 0.7 + ex * 9)) * 0.3));
      ctx.fillStyle = '#ff2e63'; circ(ctx, X + Math.cos(e.face) * R2 * 0.4, Y + Math.sin(e.face) * R2 * 0.2, R2 * 0.55);
      ctx.fillStyle = '#000'; ell(ctx, X + Math.cos(e.face) * R2 * 0.45, Y + Math.sin(e.face) * R2 * 0.2, R2 * 0.14, R2 * 0.45);
    }
  },
});
