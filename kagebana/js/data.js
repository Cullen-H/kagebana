'use strict';
/* =====================================================================
   KAGEBANA — data.js
   Every piece of content: heroes & forms, the six Kami and their boons,
   relics, enemies, bosses, biomes, meta upgrades, the Moon Phase pact,
   Moon Fragments, the cast, events and the whole story script.
   ===================================================================== */

const RARITY = [
  { name: 'Common', color: '#cfd6e6', mult: 1.0 },
  { name: 'Rare', color: '#4fc3ff', mult: 1.4 },
  { name: 'Epic', color: '#c77dff', mult: 1.85 },
  { name: 'Legendary', color: '#ffb347', mult: 2.5 },
];
const boonPower = b => RARITY[b.r].mult * (1 + 0.3 * (b.lv - 1));

/* ------------------------------------------------------------------ */
/*  HEROES                                                             */
/* ------------------------------------------------------------------ */
const HEROES = {
  akane: {
    id: 'akane', name: 'Akane Hoshizora', jp: '星空 茜', title: 'The Moonbound Blade', weapon: 'Katana — Benizakura',
    desc: 'A swift swordswoman bound to the shattered moon. Balanced, mobile, lethal combos.',
    pal: { hair: '#ff4f79', hair2: '#a3204a', skin: '#ffe6d8', outfit: '#262840', outfit2: '#15162a', eye: '#ff3d7f', accent: '#f6f0ff', scarf: '#ff2e63' },
    hair: 'ponytail', acc: 'ribbon', base: { maxHp: 100, speed: 300 },
    specialName: 'Iaido: Crimson Flash', specialCd: 2.8, ultName: 'Senka Ranbu', ultJp: '千花乱舞', ultSub: 'Thousand Petal Requiem',
    controls: 'LMB 3-hit combo · RMB lunging iaido dash-slash · Q Thousand Petal Requiem',
    forms: [
      { name: 'Form of Benizakura', desc: 'The blade as your master taught it. No changes.', cost: 0, apply() {} },
      { name: 'Form of the Gale', desc: 'Combo 25% faster, +1 dash. Attack damage −10%.', cost: 2, apply(s) { s.atkSpeed *= 1.25; s.dash += 1; s.atk *= 0.9; } },
      { name: 'Form of the Blood Moon', desc: 'Max HP −20. Below 50% HP deal +50% damage. Iaido heals 3 per enemy cut.', cost: 3, apply(s) { s.maxHp -= 20; s.bloodMoonForm = true; } },
    ],
    attack(p) {
      const i = p.combo % 3, s = p.stats;
      const dmg = [20, 22, 40][i], arc = [2.1, 2.1, 2.7][i], r = [96, 96, 118][i];
      p.lunge(i === 2 ? 240 : 110);
      G.swing(p, { r, arc, dmg, slot: 'attack', kb: i === 2 ? 340 : 140, color: p.hero.pal.scarf, dir: i % 2 ? -1 : 1, width: i === 2 ? 1.35 : 1, stun: i === 2 ? 0.25 : 0 });
      SFX.play(i === 2 ? 'heavy' : 'slash');
      p.combo = (i + 1) % 3;
      return (i === 2 ? 0.44 : 0.25) / s.atkSpeed;
    },
    special(p) {
      const a = p.aim, len = 250 * p.stats.spRange;
      const x1 = p.x, y1 = p.y;
      G.moveSafe(p, Math.cos(a) * len, Math.sin(a) * len);
      p.iframes = Math.max(p.iframes, 0.3);
      const n = G.hitLine(x1, y1, p.x, p.y, 60, 50, { slot: 'special', kb: 200, stun: 0.3 });
      if (p.stats.bloodMoonForm && n) p.heal(3 * n, true);
      G.fxLine(x1, y1, p.x, p.y, p.hero.pal.scarf, 18, 0.35);
      for (let k = 0; k < 4; k++) G.ghost(p, lerp(x1, p.x, k / 4), lerp(y1, p.y, k / 4), 0.3);
      SFX.play('dash'); SFX.play('heavy');
      if (n) { G.stop(0.07); G.shake(6); }
    },
    ult(p) {
      p.invuln = 1.5;
      const S = p.stats;
      for (let i = 0; i < 10; i++) {
        G.after(0.1 + i * 0.1, () => {
          for (const e of G.enemiesInRange(p.x, p.y, 820)) {
            G.fxSlash({ x: e.x + rand(-20, 20), y: e.y - 14 + rand(-20, 20), r: rand(40, 70), ang: rand(0, TAU), arc: 2.4, color: pick(['#ff2e63', '#ffd1dc', '#fff']), dur: 0.22, width: 0.9 });
            G.damageEnemy(e, 24 * S.ult, { slot: 'ult', kb: 30 });
          }
          G.parts.burst(p.x + rand(-300, 300), p.y + rand(-200, 200), 6, { type: 'petal', color: '#ffb7c8', min: 30, max: 140, life: 1.2, size: 3, drag: 1 });
          SFX.play('slash');
        });
      }
      G.after(1.2, () => {
        for (const e of G.enemiesInRange(p.x, p.y, 820)) G.damageEnemy(e, 90 * S.ult, { slot: 'ult', kb: 400, stun: 0.6 });
        G.flash('#ffffff', 0.6); G.shake(16); SFX.play('boom');
      });
    },
    drawWeapon(ctx, p, x, y, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = '#3a1020'; ctx.fillRect(-6, -2.5, 14, 5);
      ctx.fillStyle = '#ffcf5a'; ctx.fillRect(7, -5, 3, 10);
      const g = ctx.createLinearGradient(10, 0, 52, 0); g.addColorStop(0, '#fff'); g.addColorStop(1, '#ffd6e2');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(10, -2); ctx.lineTo(48, -3); ctx.lineTo(56, 0); ctx.lineTo(10, 2.5); ctx.fill();
      ctx.restore();
    }
  },

  rei: {
    id: 'rei', name: 'Rei Kurogane', jp: '黒鉄 零', title: 'The Iron Star', weapon: 'Gauntlets — Tekkou',
    desc: 'Akane\'s hot-headed rival. Blistering close-range punches; his dash is itself an attack.',
    pal: { hair: '#2b2f45', hair2: '#14162a', skin: '#f2d0b5', outfit: '#d9372f', outfit2: '#3a1414', eye: '#ffb300', accent: '#ffe7a0', scarf: '#ffcc00' },
    hair: 'spiky', acc: 'headband', base: { maxHp: 120, speed: 285 },
    specialName: 'Shoryu: Rising Dragon', specialCd: 3.6, ultName: 'Tekkou Ryuseigun', ultJp: '鉄甲流星群', ultSub: 'Iron Star Barrage',
    controls: 'LMB 4-hit jab chain · RMB Rising Dragon AoE uppercut · dash shoulder-charges · Q Iron Star Barrage',
    forms: [
      { name: 'Form of Tekkou', desc: 'Iron fists, iron will. No changes.', cost: 0, apply() {} },
      { name: 'Form of the Thunder Tiger', desc: 'Rising Dragon cooldown −40% and it calls lightning on all hit.', cost: 2, apply(s) { s.spCd *= 0.6; s.tigerForm = true; } },
      { name: 'Form of the Mountain', desc: '+20% armor, +20% attack damage, −12% move speed.', cost: 3, apply(s) { s.armor += 0.2; s.atk *= 1.2; s.speed *= 0.88; } },
    ],
    dashHit: 16,
    attack(p) {
      const i = p.combo % 4, s = p.stats;
      const fin = i === 3;
      p.lunge(fin ? 160 : 70);
      G.swing(p, { r: fin ? 82 : 66, arc: fin ? 2.2 : 1.3, dmg: fin ? 34 : 12, slot: 'attack', kb: fin ? 380 : 90, color: '#ffcc00', dir: 1, width: fin ? 1.2 : 0.6, punch: true, stun: fin ? 0.3 : 0 });
      SFX.play(fin ? 'heavy' : 'punch');
      p.punchSide = -(p.punchSide || 1);
      p.combo = (i + 1) % 4;
      return (fin ? 0.36 : 0.12) / s.atkSpeed;
    },
    special(p) {
      const r = 135 * p.stats.spRange;
      const n = G.hitCircle(p.x, p.y, r, 56, { slot: 'special', kb: 520, stun: 0.6 });
      G.fxRing(p.x, p.y, r, '#ffcc00', 0.35, 10);
      G.parts.burst(p.x, p.y, 30, { color: '#ff7a1a', type: 'glow', min: 100, max: 360, size: 4, grav: -300 });
      if (p.stats.tigerForm) {
        for (const e of G.enemiesInRange(p.x, p.y, r)) { G.fxBolt(e.x, e.y - 400, e.x, e.y, '#fff27a'); G.damageEnemy(e, 25, { slot: 'misc', noProc: true }); }
        SFX.play('thunder');
      }
      SFX.play('boom'); G.shake(9); if (n) G.stop(0.08);
    },
    ult(p) {
      p.invuln = 2.0;
      const S = p.stats;
      for (let i = 0; i < 12; i++) {
        G.after(0.1 + i * 0.12, () => {
          const t = G.nearestEnemy(p.x, p.y, 600);
          if (t) { G.ghost(p, p.x, p.y, 0.25); G.placeNear(p, t, 30); }
          G.hitCircle(p.x, p.y, 95, 28 * S.ult, { slot: 'ult', kb: 160 });
          G.fxRing(p.x, p.y, 80, '#ffe066', 0.18, 6);
          G.parts.burst(p.x, p.y, 8, { color: '#fff', min: 150, max: 400 });
          SFX.play('punch'); G.shake(4);
        });
      }
      G.after(1.65, () => {
        G.hitCircle(p.x, p.y, 260, 110 * S.ult, { slot: 'ult', kb: 600, stun: 0.8 });
        G.fxRing(p.x, p.y, 260, '#ffcc00', 0.5, 20); G.flash('#ffe8a0', 0.5); G.shake(18); SFX.play('boom');
      });
    },
    drawWeapon(ctx, p, x, y, a) {
      const ext = p.swingT > 0 ? 14 * (p.swingT / p.swingDur) : 0;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = '#4a4f66'; rrect(ctx, 4 + ext, -8, 16, 16, 5); ctx.fill();
      ctx.fillStyle = '#ffcc00'; ctx.fillRect(16 + ext, -7, 4, 14);
      ctx.fillStyle = '#6b7190'; rrect(ctx, -4, 6, 13, 12, 4); ctx.fill();
      ctx.restore();
    }
  },

  yuki: {
    id: 'yuki', name: 'Yuki Shirogane', jp: '白銀 雪', title: 'The Snow Talisman', weapon: 'Spirit Bow — Hyouketsu',
    desc: 'Daughter of the Snow Empress. Fires spirit arrows from range and sets frost lotuses.',
    pal: { hair: '#e8f4ff', hair2: '#9fc2e6', skin: '#fff0ea', outfit: '#3e6fb5', outfit2: '#1d3460', eye: '#5ad1ff', accent: '#ffffff', scarf: '#9ee7ff' },
    hair: 'hime', acc: 'ribbon', base: { maxHp: 85, speed: 295 },
    specialName: 'Hyouka: Frost Lotus', specialCd: 3.0, ultName: 'Zettai Reido', ultJp: '絶対零度', ultSub: 'Absolute Zero Bloom',
    controls: 'LMB spirit arrows (every 3rd pierces) · RMB Frost Lotus at cursor · dash leaves frost · Q Absolute Zero',
    forms: [
      { name: 'Form of Hyouketsu', desc: 'The bow her mother gave her. No changes.', cost: 0, apply() {} },
      { name: 'Form of the Twin Moon', desc: 'Every shot fires two arrows at 65% damage each.', cost: 2, apply(s) { s.twinForm = true; } },
      { name: 'Form of the Blizzard Heart', desc: 'Frost Lotus +50% size and freezes instantly, but +1s cooldown.', cost: 3, apply(s) { s.spRange *= 1.5; s.spCdAdd += 1; s.blizzardForm = true; } },
    ],
    attack(p) {
      const i = p.combo % 3, S = p.stats;
      const pierce = i === 2;
      const dmg = pierce ? 26 : 17;
      const shots = S.twinForm ? [-0.09, 0.09] : [0];
      for (const off of shots) {
        G.pProj({ x: p.x + Math.cos(p.aim) * 20, y: p.y - 18 + Math.sin(p.aim) * 20, ang: p.aim + off, speed: 980, dmg: dmg * (S.twinForm ? 0.65 : 1), slot: 'attack', r: 9, pierce: pierce ? 6 : 0, life: 0.7, kind: 'arrow', color: '#9ee7ff', kb: 60 });
      }
      SFX.play('arrow');
      p.combo = (i + 1) % 3;
      return 0.2 / S.atkSpeed;
    },
    special(p) {
      const S = p.stats;
      const d = Math.min(440, Math.hypot(Input.mouse.wx - p.x, Input.mouse.wy - p.y));
      const tx = p.x + Math.cos(p.aim) * d, ty = p.y + Math.sin(p.aim) * d;
      const r = 115 * S.spRange;
      G.pZone({ x: tx, y: ty, r, warn: S.blizzardForm ? 0.2 : 0.45, dmg: 52, slot: 'special', color: '#9ee7ff', kind: 'lotus',
        onFire: (z) => {
          for (const e of G.enemiesInRange(z.x, z.y, z.r)) { G.chill(e, S.blizzardForm ? 5 : 2); }
          G.fxRing(z.x, z.y, z.r, '#e8fbff', 0.4, 8);
          G.parts.burst(z.x, z.y, 26, { type: 'shard', color: '#c9f3ff', min: 80, max: 320, size: 3 });
          SFX.play('freeze'); G.shake(4);
        } });
    },
    onDash(p) {
      for (const e of G.enemiesInRange(p.x, p.y, 90)) G.chill(e, 1);
      G.parts.burst(p.x, p.y, 10, { type: 'shard', color: '#dff8ff', min: 40, max: 160, size: 2 });
    },
    ult(p) {
      p.invuln = 1.0;
      const S = p.stats;
      G.flash('#e8fbff', 0.8);
      G.after(0.35, () => {
        for (const e of G.enemiesInRange(p.x, p.y, 900)) {
          G.damageEnemy(e, 75 * S.ult, { slot: 'ult', kb: 0 });
          if (!e.dead) { e.st.freeze = Math.max(e.st.freeze, e.isBoss ? 1.2 : 3.2); }
          G.parts.burst(e.x, e.y - 10, 10, { type: 'shard', color: '#bff0ff', min: 60, max: 220, size: 3 });
        }
        G.fxRing(p.x, p.y, 700, '#ffffff', 0.7, 30); SFX.play('freeze'); SFX.play('boom'); G.shake(12);
      });
    },
    drawWeapon(ctx, p, x, y, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.strokeStyle = '#dff6ff'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(-4, 0, 22, -1.2, 1.2); ctx.stroke();
      ctx.strokeStyle = 'rgba(158,231,255,.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-4 + Math.cos(-1.2) * 22, Math.sin(-1.2) * 22); ctx.lineTo(-4 + Math.cos(1.2) * 22, Math.sin(1.2) * 22); ctx.stroke();
      ctx.restore();
      // orbiting talismans
      for (let i = 0; i < 3; i++) {
        const oa = p.t * 2 + i * TAU / 3;
        ctx.save(); ctx.translate(p.x + Math.cos(oa) * 30, p.y - 30 + Math.sin(oa) * 12); ctx.rotate(Math.sin(p.t * 3 + i) * 0.3);
        ctx.fillStyle = '#fffbe8'; ctx.fillRect(-4, -7, 8, 14); ctx.fillStyle = '#d33'; ctx.fillRect(-2, -4, 4, 7); ctx.restore();
      }
    }
  },

  kaito: {
    id: 'kaito', name: 'Kaito Ryuuga', jp: '竜牙 海斗', title: 'The Eclipse Reaper', weapon: 'Moon Scythe — Tsukigari',
    desc: 'Former general of the Hollow Emperor. Huge sweeping arcs, life-draining blade, returning scythe throw.',
    pal: { hair: '#b9b4ff', hair2: '#5b4fa8', skin: '#e9d6cc', outfit: '#17131f', outfit2: '#0a0810', eye: '#c084ff', accent: '#6d5acf', scarf: '#7b5cff' },
    hair: 'wild', acc: 'mask', base: { maxHp: 110, speed: 280, lifesteal: 0.02 },
    specialName: 'Tsukigari: Moon Hunt', specialCd: 2.8, ultName: 'Gekkou Hakai', ultJp: '月光破壊', ultSub: 'Moon Devourer',
    controls: 'LMB wide 2-hit sweeps (innate lifesteal) · RMB returning scythe throw · dash leaves exploding afterimage · Q Moon Devourer',
    forms: [
      { name: 'Form of the Hollow Reaper', desc: 'The scythe of a fallen general. No changes.', cost: 0, apply() {} },
      { name: 'Form of the Eclipse', desc: 'Lifesteal tripled. Max HP −30.', cost: 2, apply(s) { s.lifesteal *= 3; s.maxHp -= 30; } },
      { name: 'Form of the Starfall', desc: 'Moon Hunt throws three scythes in a fan.', cost: 3, apply(s) { s.starfallForm = true; } },
    ],
    attack(p) {
      const i = p.combo % 2, s = p.stats;
      p.lunge(i ? 180 : 100);
      G.swing(p, { r: 128, arc: 3.4, dmg: i ? 42 : 32, slot: 'attack', kb: i ? 300 : 180, color: '#9b82ff', dir: i ? -1 : 1, width: 1.3, stun: i ? 0.2 : 0 });
      SFX.play('heavy');
      p.combo = (i + 1) % 2;
      return (i ? 0.56 : 0.44) / s.atkSpeed;
    },
    special(p) {
      const offs = p.stats.starfallForm ? [-0.35, 0, 0.35] : [0];
      for (const o of offs) {
        G.pProj({ x: p.x, y: p.y - 16, ang: p.aim + o, speed: 760, dmg: 36, slot: 'special', r: 26, pierce: 99, life: 2.4, kind: 'scythe', color: '#b9a6ff', returning: 440, kb: 120 });
      }
      SFX.play('slash');
    },
    onDash(p) {
      const x = p.dashFrom.x, y = p.dashFrom.y;
      G.ghost(p, x, y, 0.45);
      G.after(0.4, () => {
        G.hitCircle(x, y, 75, 22, { slot: 'dash', kb: 150 });
        G.fxRing(x, y, 75, '#7b5cff', 0.25, 6); SFX.play('burn');
      });
    },
    ult(p) {
      p.invuln = 1.4;
      const S = p.stats;
      for (let i = 0; i < 3; i++) {
        G.after(0.15 + i * 0.32, () => {
          G.hitCircle(p.x, p.y, 270, 72 * S.ult, { slot: 'ult', kb: 250 });
          G.fxSlash({ x: p.x, y: p.y - 14, r: 260, ang: i * 2.1, arc: TAU * 0.98, color: '#9b82ff', dur: 0.32, width: 2.2, dir: i % 2 ? -1 : 1 });
          SFX.play('heavy'); G.shake(10);
        });
      }
      G.after(1.1, () => { p.heal(p.stats.maxHp * 0.15); G.flash('#2a1650', 0.6); });
    },
    drawWeapon(ctx, p, x, y, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.strokeStyle = '#3d3352'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(42, 0); ctx.stroke();
      ctx.fillStyle = '#d9d0ff';
      ctx.beginPath(); ctx.moveTo(40, -2); ctx.quadraticCurveTo(62, 18, 34, 42); ctx.quadraticCurveTo(50, 16, 36, 2); ctx.fill();
      ctx.fillStyle = '#7b5cff'; circ(ctx, 40, 0, 4);
      ctx.restore();
    }
  }
};
const HERO_ORDER = ['akane', 'rei', 'yuki', 'kaito'];
const HERO_UNLOCK = {
  akane: { keys: 0, req: null, hint: '' },
  rei: { keys: 2, req: s => (s.bossKills.gekkou || 0) >= 1, hint: 'Defeat Gekkou, the Crimson Ronin, once.' },
  yuki: { keys: 3, req: s => (s.bossKills.shirahime || 0) >= 1, hint: 'Defeat Shirahime, the Snow Empress, once.' },
  kaito: { keys: 4, req: s => (s.bossKills.mugen || 0) >= 1, hint: 'Defeat Mugen, the Hollow Emperor, once.' },
};

/* ------------------------------------------------------------------ */
/*  KAMI (patron gods) & BOONS                                         */
/* ------------------------------------------------------------------ */
const KAMI = {
  fire: { name: 'Hinome', title: 'Kami of the Burning Dawn', color: '#ff7a3d', glyph: '炎', el: 'Burn',
    hello: ['Little moon, let me set your blade alight!', 'Ahaha! Burn bright, burn brighter!', 'Dawn always returns. So will you.', 'Make them remember the sunrise.'] },
  thunder: { name: 'Raika', title: 'Kami of the Storm Drum', color: '#ffe14d', glyph: '雷', el: 'Chain',
    hello: ['BA-DUM! Feel the rhythm of the storm!', 'Faster! Louder! Again!', 'My drum beats for you, Moonbound.', 'Let the sky do the talking.'] },
  moon: { name: 'Tsukiyo', title: 'Kami of the Silver Night', color: '#b49cff', glyph: '月', el: 'Curse',
    hello: ['The eighth moon was my sister. Avenge her.', 'Strike where the light does not reach.', 'Silver for your blade, shadow for your foes.', 'Precision is a kind of prayer.'] },
  ice: { name: 'Mizuha', title: 'Kami of Still Waters', color: '#6ee7ff', glyph: '氷', el: 'Chill',
    hello: ['Be still. Be the river. Then freeze it.', 'Patience is colder than any blade.', 'The water remembers every face.', 'Let them stop. Forever.'] },
  wind: { name: 'Kazane', title: 'Kami of the Wandering Wind', color: '#7dffb0', glyph: '風', el: 'Gust',
    hello: ['Whoosh~! Catch me if you can!', 'Never stay in one place, little moon.', 'The wind carries your name everywhere.', 'Go! Go! Gooo!'] },
  blood: { name: 'Shuten', title: 'Oni-King of Crimson Sake', color: '#ff3d5e', glyph: '血', el: 'Bleed',
    hello: ['Drink, Moonbound! Drink of their blood!', 'GAHAHA! You fight like an oni!', 'Pain is just sake that has not been poured yet.', 'Take. Take everything.'] },
};
const KAMI_ORDER = ['fire', 'thunder', 'moon', 'ice', 'wind', 'blood'];
const SLOT_LABEL = { attack: 'Attack', special: 'Special', dash: 'Dash', ult: 'Ultimate', passive: 'Passive' };

const pct = v => Math.round(v * 100) + '%';
const n0 = v => Math.round(v);
const ELEMENT_TXT = {
  fire: pw => `ignites foes for ${n0(6 * pw)} burn/sec`,
  thunder: pw => `chains lightning for ${n0(12 * pw)} to ${pw > 1.7 ? 3 : 2} foes`,
  moon: pw => `+${n0(12 * pw)}% crit chance; crits Curse (+30% dmg taken)`,
  ice: pw => `Chills (5 stacks Freeze for ${(1 + 0.3 * pw).toFixed(1)}s)`,
  wind: pw => `+${n0(15 * pw)}% dmg, hurls foes (wall slam ${n0(20 * pw)})`,
  blood: pw => `heals ${(2 * pw).toFixed(1)}% of damage; Bleed bursts for ${n0(25 * pw)}`,
};
const SLOT_NAMES = {
  fire: { attack: 'Dawnfire Strike', special: 'Solar Flare Arts', dash: 'Ember Step', ult: 'Sunburst Finale' },
  thunder: { attack: 'Drumbeat Strike', special: 'Thunderclap Arts', dash: 'Lightning Step', ult: 'Storm King Finale' },
  moon: { attack: 'Silver Crescent Strike', special: 'Moonlit Arts', dash: 'Shadow Step', ult: 'Eclipse Finale' },
  ice: { attack: 'Frostbite Strike', special: 'Glacier Arts', dash: 'Mist Step', ult: 'Winter Bloom Finale' },
  wind: { attack: 'Gale Strike', special: 'Cyclone Arts', dash: 'Zephyr Step', ult: 'Typhoon Finale' },
  blood: { attack: 'Crimson Strike', special: 'Oni Arts', dash: 'Bloodrush Step', ult: 'Feast Finale' },
};
const BOONS = [];
for (const k of KAMI_ORDER) {
  BOONS.push({ id: k + '_attack', k, slot: 'attack', name: SLOT_NAMES[k].attack,
    desc: pw => `Attack deals +${n0(25 * pw)}% damage and ${ELEMENT_TXT[k](pw)}.`,
    apply: (s, pw) => { s.atk *= 1 + 0.25 * pw; s.el.attack = { k, pw }; } });
  BOONS.push({ id: k + '_special', k, slot: 'special', name: SLOT_NAMES[k].special,
    desc: pw => `Special deals +${n0(40 * pw)}% damage and ${ELEMENT_TXT[k](pw)}.`,
    apply: (s, pw) => { s.sp *= 1 + 0.4 * pw; s.el.special = { k, pw }; } });
  BOONS.push({ id: k + '_dash', k, slot: 'dash', name: SLOT_NAMES[k].dash,
    desc: pw => `Your dash strikes foes in its path for ${n0(22 * pw)} and ${ELEMENT_TXT[k](pw)}.`,
    apply: (s, pw) => { s.dashDmg += 22 * pw; s.el.dash = { k, pw }; } });
  BOONS.push({ id: k + '_ult', k, slot: 'ult', name: SLOT_NAMES[k].ult,
    desc: pw => `Ultimate deals +${n0(35 * pw)}% damage, charges ${n0(10 * pw)}% faster and ${ELEMENT_TXT[k](pw)}.`,
    apply: (s, pw) => { s.ult *= 1 + 0.35 * pw; s.ultGain *= 1 + 0.1 * pw; s.el.ult = { k, pw }; } });
}
const P_ = (id, k, name, desc, apply, req) => BOONS.push({ id, k, slot: 'passive', name, desc, apply, req });
// fire
P_('fire_kindle', 'fire', 'Kindled Spirit', pw => `All Burn deals +${n0(45 * pw)}% damage.`, (s, pw) => { s.burnMult += 0.45 * pw; });
P_('fire_wild', 'fire', 'Wildfire', pw => `Burning foes explode on death for ${n0(30 * pw)} and spread Burn.`, (s, pw) => { s.wildfire = Math.max(s.wildfire, pw); });
P_('fire_hearth', 'fire', 'Hearth of Dawn', pw => `Heal ${n0(6 * pw)} HP when entering each room. +10 Max HP.`, (s, pw) => { s.roomHeal += 6 * pw; s.maxHp += 10; });
P_('fire_phoenix', 'fire', 'Phoenix Pyre', pw => `Once per room, falling below 30% HP unleashes a nova for ${n0(60 * pw)} and heals ${n0(12 * pw)}.`, (s, pw) => { s.phoenix = Math.max(s.phoenix, pw); });
// thunder
P_('thunder_static', 'thunder', 'Static Overload', pw => `Chain lightning jumps +1 more time and deals +${n0(30 * pw)}% damage.`, (s, pw) => { s.chainExtra += 1; s.chainMult += 0.3 * pw; });
P_('thunder_drum', 'thunder', 'Thunder Drum', pw => `Every 3.5 sec, lightning strikes a random foe for ${n0(35 * pw)}.`, (s, pw) => { s.drum += pw; });
P_('thunder_reflex', 'thunder', 'Lightning Reflexes', pw => `Dash recharges ${n0(Math.min(45, 15 * pw))}% faster. +5% move speed.`, (s, pw) => { s.dashCd *= 1 - Math.min(0.45, 0.15 * pw); s.speed *= 1.05; });
P_('thunder_eye', 'thunder', 'Eye of the Storm', pw => `When hit, lightning strikes all nearby foes for ${n0(40 * pw)}.`, (s, pw) => { s.stormEye += pw; });
// moon
P_('moon_edge', 'moon', 'Lunar Edge', pw => `Critical hits deal +${n0(35 * pw)}% damage.`, (s, pw) => { s.critDmg += 0.35 * pw; });
P_('moon_fortune', 'moon', 'Crescent Fortune', pw => `+${n0(5 * pw)}% critical chance with everything.`, (s, pw) => { s.crit += 0.05 * pw; });
P_('moon_mark', 'moon', 'Eclipse Mark', pw => `Cursed foes take an extra +${n0(20 * pw)}% damage.`, (s, pw) => { s.curseMult += 0.2 * pw; });
P_('moon_harvest', 'moon', 'Night Harvest', pw => `Slaying a foe grants +${n0(3 * pw)}% Ultimate charge (x3 if Cursed).`, (s, pw) => { s.harvest += 3 * pw; });
// ice
P_('ice_perma', 'ice', 'Permafrost', pw => `Freeze lasts +${(0.5 * pw).toFixed(1)}s. Frozen foes take +${n0(25 * pw)}% damage.`, (s, pw) => { s.freezeDur += 0.5 * pw; s.frozenMult += 0.25 * pw; });
P_('ice_shatter', 'ice', 'Shatter', pw => `Frozen or Chilled foes that die burst into shards for ${n0(30 * pw)}.`, (s, pw) => { s.shatter = Math.max(s.shatter, pw); });
P_('ice_mantle', 'ice', 'Frost Mantle', pw => `+${n0(6 * pw)}% armor. Foes that strike you are Chilled x2.`, (s, pw) => { s.armor += 0.06 * pw; s.mantle = true; });
P_('ice_heart', 'ice', 'Glacial Heart', pw => `Dashing Chills nearby foes. Chilled foes deal ${n0(Math.min(40, 10 * pw))}% less damage.`, (s, pw) => { s.dashChill = true; s.chillWeak = Math.min(0.4, 0.1 * pw); });
// wind
P_('wind_force', 'wind', 'Gale Force', pw => `+${n0(6 * pw)}% move speed. Dash travels ${n0(12 * pw)}% further.`, (s, pw) => { s.speed *= 1 + 0.06 * pw; s.dashDist *= 1 + 0.12 * pw; });
P_('wind_tail', 'wind', 'Tailwind', pw => `+1 Dash charge. Dash recharges ${n0(Math.min(30, 8 * pw))}% faster.`, (s, pw) => { s.dash += 1; s.dashCd *= 1 - Math.min(0.3, 0.08 * pw); });
P_('wind_blades', 'wind', 'Cutting Breeze', pw => `Dashing leaves wind blades that deal ${n0(16 * pw)}.`, (s, pw) => { s.windTrail += pw; });
P_('wind_whirl', 'wind', 'Little Whirlwind', pw => `A whirlwind orbits you, dealing ${n0(10 * pw)} to foes it touches.`, (s, pw) => { s.whirl += pw; });
// blood
P_('blood_vigor', 'blood', 'Oni Vigor', pw => `+${n0(22 * pw)} Max HP.`, (s, pw) => { s.maxHp += 22 * pw; });
P_('blood_rage', 'blood', 'Berserker\'s Sake', pw => `+${(2.5 * pw).toFixed(1)}% damage for each 10% HP you are missing.`, (s, pw) => { s.rage += 0.025 * pw; });
P_('blood_feast', 'blood', 'Crimson Feast', pw => `Slaying a foe heals ${(1.5 * pw).toFixed(1)} HP.`, (s, pw) => { s.feast += 1.5 * pw; });
P_('blood_pact', 'blood', 'Oni Hide', pw => `+${n0(5 * pw)}% armor and +12 Max HP.`, (s, pw) => { s.armor += 0.05 * pw; s.maxHp += 12; });
// duos (require one boon from each)
const D_ = (id, a, b, name, desc, apply) => BOONS.push({ id, k: a, k2: b, duo: true, slot: 'passive', name, desc: () => desc, apply });
D_('duo_plasma', 'fire', 'thunder', 'Plasma Storm', 'Chain lightning also applies heavy Burn.', s => { s.plasma = true; });
D_('duo_steam', 'fire', 'ice', 'Steam Burst', 'Burning foes that become Frozen erupt for 60 damage.', s => { s.steam = true; });
D_('duo_bloodmoon', 'moon', 'blood', 'Blood Moon Rising', 'Critical hits heal 2 HP. +5% crit chance.', s => { s.critHeal += 2; s.crit += 0.05; });
D_('duo_tempest', 'wind', 'thunder', 'Tempest Dance', 'Each dash fires lightning at 3 nearby foes for 30.', s => { s.tempest = true; });
D_('duo_frostmoon', 'ice', 'moon', 'Moonlit Frost', 'Critical hits Chill x2. Frozen foes are always crit.', s => { s.frostMoon = true; });
D_('duo_firestorm', 'wind', 'fire', 'Firestorm', 'Gust effects also Burn. Burn spreads to nearby foes.', s => { s.firestorm = true; });
D_('duo_infernal', 'blood', 'fire', 'Infernal Sake', 'Burning foes that die heal you for 3 HP.', s => { s.infernal = true; });
D_('duo_frozenheart', 'blood', 'ice', 'Frozen Heart', 'Max HP +30. Taking damage Freezes nearby foes (8s cooldown).', s => { s.maxHp += 30; s.frozenHeart = true; });
const BOON_BY_ID = Object.fromEntries(BOONS.map(b => [b.id, b]));

/* ------------------------------------------------------------------ */
/*  RELICS                                                             */
/* ------------------------------------------------------------------ */
const RELICS = [
  { id: 'feather', name: 'Tengu Feather', icon: '🪶', desc: '+1 Dash charge.', apply: s => { s.dash += 1; } },
  { id: 'neko', name: 'Maneki-Neko', icon: '🐱', desc: '+35% gold from all sources.', apply: s => { s.gold += 0.35; } },
  { id: 'onimask', name: 'Oni Mask', icon: '👹', desc: '+18% damage, but take +10% damage.', apply: s => { s.dmgAll *= 1.18; s.armor -= 0.1; } },
  { id: 'crane', name: 'Paper Crane', icon: '🕊', desc: 'Once, when slain, unfold and revive at 40% HP.', onGain: () => { G.run.crane = (G.run.crane || 0) + 1; } },
  { id: 'bell', name: 'Kitsune Bell', icon: '🔔', desc: '+8% critical chance.', apply: s => { s.crit += 0.08; } },
  { id: 'hairpin', name: 'Sakura Hairpin', icon: '🌸', desc: 'Heal 6 HP whenever you clear a room.', apply: s => { s.clearHeal += 6; } },
  { id: 'daruma', name: 'Daruma Doll', icon: '🎎', desc: '+25 Max HP.', apply: s => { s.maxHp += 25; } },
  { id: 'watch', name: 'Broken Pocket Watch', icon: '⏱', desc: 'Special cooldown −25%.', apply: s => { s.spCd *= 0.75; } },
  { id: 'taiko', name: 'Festival Taiko', icon: '🥁', desc: 'Ultimate charges 25% faster.', apply: s => { s.ultGain *= 1.25; } },
  { id: 'magatama', name: 'Jade Magatama', icon: '🟢', desc: '+10% armor.', apply: s => { s.armor += 0.1; } },
  { id: 'muramasa', name: 'Muramasa Edge', icon: '🗡', desc: '+35% attack damage. −15 Max HP.', apply: s => { s.atk *= 1.35; s.maxHp -= 15; } },
  { id: 'mochi', name: 'Moon Rabbit Mochi', icon: '🍡', desc: 'Heal 30% now. +10 Max HP.', apply: s => { s.maxHp += 10; }, onGain: () => { P.heal(P.stats.maxHp * 0.3); } },
  { id: 'lantern', name: 'Shrine Lantern', icon: '🏮', desc: 'Boon offerings show 4 choices.', apply: s => { s.extraChoice = 1; } },
  { id: 'strawhat', name: 'Ronin\'s Straw Hat', icon: '👒', desc: '+10% move speed, +6% damage.', apply: s => { s.speed *= 1.1; s.dmgAll *= 1.06; } },
  { id: 'kappa', name: 'Kappa Dish', icon: '🥏', desc: 'The first hit you take in each room is negated.', apply: s => { s.roomShield = true; } },
  { id: 'capsule', name: 'Gacha Capsule', icon: '💊', desc: 'Instantly level up 2 random boons.', onGain: () => { G.levelRandomBoons(2); } },
  { id: 'hachimaki', name: 'Hachimaki of Resolve', icon: '🎌', desc: 'Below 35% HP: +30% damage and +15% speed.', apply: s => { s.resolve = true; } },
  { id: 'jar', name: 'Spirit Jar', icon: '🏺', desc: 'Slaying a foe grants +2% Ultimate charge.', apply: s => { s.harvest += 2; } },
  { id: 'pearl', name: 'Dragon Pearl', icon: '🔮', desc: 'Begin each room with 40% Ultimate charge.', apply: s => { s.ultStart = Math.max(s.ultStart, 40); } },
  { id: 'redstring', name: 'Red String of Fate', icon: '🧵', desc: 'Critical hits restore 1 HP. +4% crit chance.', apply: s => { s.critHeal += 1; s.crit += 0.04; } },
  { id: 'gourd', name: 'Sake Gourd', icon: '🍶', desc: 'Spirit Sake gives +2 levels instead of +1.', apply: s => { s.sakeBonus = 1; } },
  { id: 'omamori', name: 'Golden Omamori', icon: '🧧', desc: '+1 boon reroll. +10% rarity luck.', apply: s => { s.luck += 0.1; }, onGain: () => { G.run.rerolls++; } },
];
const RELIC_BY_ID = Object.fromEntries(RELICS.map(r => [r.id, r]));

/* ------------------------------------------------------------------ */
/*  ENEMIES                                                            */
/* ------------------------------------------------------------------ */
const ENEMIES = {
  // ---- Act I: Ember Bamboo Grove
  kappa:    { name: 'Ember Kappa', ai: 'chase', hp: 42, spd: 115, dmg: 9, r: 16, cost: 1, gold: 3, contact: true, draw: 'kappa', col: '#5fbf6a', col2: '#2f6b3b', desc: 'River imps whose water-dish boiled over when the moon broke. They just want to bite something.' },
  ashigaru: { name: 'Shade Ashigaru', ai: 'melee', hp: 62, spd: 100, dmg: 13, r: 17, cost: 1.5, gold: 4, range: 80, arc: 1.3, windup: 0.55, cd: 1.3, draw: 'ashigaru', col: '#3b3f5c', col2: '#c33', desc: 'Foot soldiers of a forgotten war, still holding the line for a lord who no longer exists.' },
  chochin:  { name: 'Chochin Lantern', ai: 'shooter', hp: 36, spd: 90, dmg: 9, r: 16, cost: 1.5, gold: 4, shots: 1, spread: 0, cd: 2.0, pspeed: 260, keep: 320, draw: 'lantern', col: '#ff9a3c', col2: '#ffe08a', fly: true, desc: 'Paper lanterns that swallowed a ghost. Their tongues are hot enough to light a shrine.' },
  tengu:    { name: 'Crow Tengu', ai: 'dasher', hp: 55, spd: 135, dmg: 15, r: 16, cost: 2, gold: 5, draw: 'tengu', col: '#1d1d2b', col2: '#d23b3b', desc: 'Proud mountain goblins. Their charge leaves a black feather in the wound.' },
  kodama:   { name: 'Cinder Kodama', ai: 'swarm', hp: 15, spd: 175, dmg: 5, r: 10, cost: 0.5, gold: 1, contact: true, group: 3, draw: 'kodama', col: '#ffd9a8', col2: '#3a2a1a', desc: 'Tree spirits. When their bamboo burned, they forgot how to be gentle.' },
  // ---- Act II: Neon Hollow City
  cyberoni: { name: 'Chrome Oni', ai: 'brute', hp: 170, spd: 72, dmg: 22, r: 26, cost: 3, gold: 8, draw: 'oni', col: '#e0435f', col2: '#9ef', kbRes: 0.6, desc: 'An oni who sold his horns for chrome. The slam still hurts like the old days.' },
  drone:    { name: 'Kitsune Drone', ai: 'shooter', hp: 52, spd: 120, dmg: 10, r: 15, cost: 2, gold: 5, shots: 3, spread: 0.25, cd: 2.2, pspeed: 330, keep: 380, draw: 'drone', col: '#ff8fd0', col2: '#49f0ff', fly: true, desc: 'Nine-tailed surveillance units. They giggle in binary before opening fire.' },
  kasa:     { name: 'Kasa-obake', ai: 'spinner', hp: 76, spd: 80, dmg: 10, r: 18, cost: 2.5, gold: 6, draw: 'umbrella', col: '#7b4dff', col2: '#ffde59', desc: 'A one-eyed umbrella spirit. It spins. Bullets come out. Nobody knows why.' },
  riot:     { name: 'Riot Ashigaru', ai: 'shield', hp: 95, spd: 85, dmg: 15, r: 20, cost: 2.5, gold: 6, range: 90, arc: 1.2, windup: 0.6, cd: 2.2, draw: 'riot', col: '#3a4a66', col2: '#49f0ff', kbRes: 0.5, desc: 'City guards with hard-light shields. Strike from the flank — the front is unbreakable.' },
  bakeneko: { name: 'Bomb Bakeneko', ai: 'bomber', hp: 32, spd: 195, dmg: 24, r: 14, cost: 1.5, gold: 3, draw: 'neko', col: '#2b2b2b', col2: '#ff4d4d', desc: 'Cat yokai with a fuse for a tail. Pet at your own risk.' },
  // ---- Act III: Frostveil Sky Temple
  wraith:   { name: 'Snow Wraith', ai: 'teleporter', hp: 72, spd: 90, dmg: 11, r: 17, cost: 2.5, gold: 6, cd: 3.2, draw: 'wraith', col: '#dff6ff', col2: '#5ad1ff', fly: true, desc: 'Travelers lost in the white silence. They blink between snowflakes.' },
  archer:   { name: 'Frost Archer', ai: 'sniper', hp: 58, spd: 95, dmg: 22, r: 16, cost: 2.5, gold: 6, draw: 'archer', col: '#9fc2e6', col2: '#2a3e66', desc: 'Temple guardians who never miss. Watch for the blue line.' },
  yeti:     { name: 'Yuki-Oni', ai: 'brute', hp: 240, spd: 66, dmg: 26, r: 30, cost: 3.5, gold: 9, draw: 'yeti', col: '#f0f6ff', col2: '#5a7aa6', kbRes: 0.7, desc: 'Great white oni of the peaks. Its slam can crack a glacier.' },
  shikigami:{ name: 'Paper Shikigami', ai: 'swarm', hp: 18, spd: 190, dmg: 6, r: 10, cost: 0.6, gold: 1, contact: true, group: 4, draw: 'shiki', col: '#fffbe8', col2: '#d33', fly: true, desc: 'Folded servants of the Snow Empress\'s priests. Fragile, fast, endless.' },
  monk:     { name: 'Frostfist Monk', ai: 'melee', hp: 85, spd: 150, dmg: 14, r: 17, cost: 2, gold: 5, range: 70, arc: 1.6, windup: 0.4, cd: 0.9, draw: 'monk', col: '#5a7aa6', col2: '#ffcf5a', desc: 'Monks who meditated until their hearts froze. Lightning-quick jabs.' },
  priest:   { name: 'Paper Priest', ai: 'summoner', hp: 80, spd: 80, dmg: 8, r: 18, cost: 3, gold: 7, summon: 'shikigami', keep: 380, draw: 'priest', col: '#e8e0ff', col2: '#d33', desc: 'Onmyoji of the temple. Kill the priest and the paper falls silent.' },
  // ---- Act IV: Palace of the Hollow Moon
  hknight:  { name: 'Hollow Knight', ai: 'melee', hp: 190, spd: 95, dmg: 24, r: 24, cost: 3.5, gold: 9, range: 110, arc: 1.8, windup: 0.7, cd: 1.6, draw: 'hknight', col: '#22202e', col2: '#c084ff', kbRes: 0.6, desc: 'Samurai who gave their memories to Mugen in exchange for never feeling fear.' },
  voideye:  { name: 'Void Eye', ai: 'spinner', hp: 120, spd: 60, dmg: 13, r: 22, cost: 3, gold: 8, draw: 'voideye', col: '#14101e', col2: '#c084ff', fly: true, desc: 'An eye that saw the moon break, and never closed again.' },
  hshade:   { name: 'Hollow Echo', ai: 'dasher', hp: 105, spd: 150, dmg: 20, r: 17, cost: 3, gold: 7, draw: 'echo', col: '#5b4fa8', col2: '#ff2e63', desc: 'A faint copy of a Moonbound warrior from a loop that ended badly. It wears your face.' },
  dummy:    { name: 'Straw Dummy', ai: 'dummy', hp: 999999, spd: 0, dmg: 0, r: 22, cost: 0, gold: 0, draw: 'dummy', col: '#d9b36b', col2: '#8a5a2b', kbRes: 1, desc: 'Ponta built it. Ponta says it has feelings. Ponta is lying.' },
};

/* ------------------------------------------------------------------ */
/*  BOSSES                                                             */
/* ------------------------------------------------------------------ */
const BOSSES = {
  gekkou: { id: 'gekkou', name: 'Gekkou', title: 'The Crimson Ronin', jp: '紅の浪人 月光', hp: 3600, r: 26, spd: 165, dmg: 16, draw: 'gekkou', col: '#8a1c2b',
    pal: { hair: '#e9e4f2', hair2: '#9a93ad', skin: '#e8cbb8', outfit: '#7a1426', outfit2: '#3a0a14', eye: '#ff3355', accent: '#1a1a1a', scarf: '#ff3355', acc2: '#c9a36b' }, hair: 'long', acc: 'hat',
    phases: [0.62, 0.3], patterns: [['dashSlash', 'crescent', 'iaiCircle'], ['dashSlash', 'crescent', 'iaiCircle', 'petalStorm'], ['dashSlash', 'petalStorm', 'shadowClones', 'iaiCircle', 'crescent']] },
  mecha: { id: 'mecha', name: 'MK-VIII "Onigiri"', title: 'Rampaging Mecha-Oni', jp: '機甲鬼 八号機', hp: 5600, r: 40, spd: 90, dmg: 18, draw: 'mecha', col: '#e0435f', kbRes: 1,
    phases: [0.6, 0.3], patterns: [['laserSweep', 'missiles', 'rocketPunch'], ['laserSweep', 'missiles', 'bulletRing', 'rocketPunch', 'drones'], ['doubleLaser', 'missiles', 'bulletRing', 'rocketPunch', 'drones']] },
  shirahime: { id: 'shirahime', name: 'Shirahime', title: 'Empress of White Silence', jp: '白銀の女帝 白姫', hp: 7400, r: 26, spd: 120, dmg: 20, draw: 'shirahime', col: '#bfe9ff',
    pal: { hair: '#f4fbff', hair2: '#a8d4f0', skin: '#fdf4f2', outfit: '#cde9ff', outfit2: '#5c87b8', eye: '#3ab7ff', accent: '#ffffff', scarf: '#9ee7ff', acc2: '#e6f7ff' }, hair: 'hime', acc: 'crown',
    phases: [0.62, 0.3], patterns: [['iceRing', 'icicles', 'blizzard'], ['iceRing', 'icicles', 'blizzard', 'mirrors'], ['iceRing', 'icicleGrid', 'blizzard', 'mirrors', 'whiteSilence']] },
  mugen: { id: 'mugen', name: 'Mugen', title: 'The Hollow Emperor', jp: '虚月の皇帝 夢幻', hp: 10500, r: 28, spd: 150, dmg: 24, draw: 'mugen', col: '#1a0f2a',
    pal: { hair: '#1a1424', hair2: '#0a0710', skin: '#d8c8d0', outfit: '#120c1c', outfit2: '#050308', eye: '#ff2e63', accent: '#c084ff', scarf: '#5b2b8a', acc2: '#c084ff' }, hair: 'ponytail', acc: 'crown',
    phases: [0.66, 0.33], patterns: [['dashSlash', 'voidOrbs', 'hollowGrasp', 'crescent'], ['laserSweep', 'iceRing', 'voidOrbs', 'hollowGrasp', 'dashSlash'], ['eclipse', 'voidOrbs', 'dashSlash', 'iceRing', 'laserSweep', 'hollowGrasp']] },
  thousandth: { id: 'thousandth', name: 'Mugen', title: 'The Thousandth Akane', jp: '千度目の茜', hp: 8800, r: 24, spd: 190, dmg: 26, draw: 'thousandth', col: '#2a0f1a',
    pal: { hair: '#f2f0ff', hair2: '#a59ac2', skin: '#efdcd6', outfit: '#0e0a14', outfit2: '#050308', eye: '#ffd56b', accent: '#ff2e63', scarf: '#ff2e63', acc2: '#ffd56b' }, hair: 'ponytail', acc: 'ribbon',
    phases: [0.5], patterns: [['dashSlash', 'petalStorm', 'eclipse', 'voidOrbs', 'mirrorUlt'], ['dashSlash', 'petalStorm', 'eclipse', 'voidOrbs', 'mirrorUlt', 'moonfall']] },
};

/* ------------------------------------------------------------------ */
/*  BIOMES                                                             */
/* ------------------------------------------------------------------ */
const BIOMES = [
  { id: 'grove', name: 'Ember Bamboo Grove', jp: '燃える竹林', act: 'Act I', floor: '#2b1b1f', floor2: '#3a2228', line: '#4a2a2e', wall: '#120a0c', accent: '#ff7a3d', amb: 'ember', music: 'grove', prop: 'bamboo',
    pool: { kappa: 5, ashigaru: 4, chochin: 3, tengu: 2, kodama: 3 }, boss: 'gekkou', tint: 'rgba(255,90,40,0.05)' },
  { id: 'city', name: 'Neon Hollow City', jp: '虚ろな街', act: 'Act II', floor: '#14121f', floor2: '#1c1930', line: '#2c2550', wall: '#07060d', accent: '#ff4fd8', amb: 'rain', music: 'city', prop: 'neon',
    pool: { cyberoni: 2, drone: 4, kasa: 3, riot: 3, bakeneko: 3, ashigaru: 2 }, boss: 'mecha', tint: 'rgba(120,60,255,0.06)' },
  { id: 'temple', name: 'Frostveil Sky Temple', jp: '霜の天空寺', act: 'Act III', floor: '#1b2433', floor2: '#232f42', line: '#33445c', wall: '#0a0f18', accent: '#6ee7ff', amb: 'snow', music: 'temple', prop: 'ice',
    pool: { wraith: 3, archer: 3, yeti: 2, shikigami: 3, monk: 4, priest: 2 }, boss: 'shirahime', tint: 'rgba(150,220,255,0.06)' },
  { id: 'palace', name: 'Palace of the Hollow Moon', jp: '虚月宮', act: 'Act IV', floor: '#120c18', floor2: '#1b1224', line: '#2e1d40', wall: '#040208', accent: '#c084ff', amb: 'void', music: 'palace', prop: 'void',
    pool: { hknight: 3, voideye: 3, hshade: 3, wraith: 2, archer: 2, bakeneko: 2, riot: 1 }, boss: 'mugen', tint: 'rgba(160,60,255,0.07)' },
];

/* ------------------------------------------------------------------ */
/*  META: Lantern Mirror, Moon Phase Pact, Moon Fragments              */
/* ------------------------------------------------------------------ */
const MIRROR = [
  { id: 'vit', name: 'Lantern of Vitality', desc: '+10 Max HP per rank.', max: 5, cost: r => 25 + r * 30, apply: (s, r) => { s.maxHp += 10 * r; } },
  { id: 'fer', name: 'Lantern of Ferocity', desc: '+5% damage per rank.', max: 5, cost: r => 30 + r * 35, apply: (s, r) => { s.dmgAll *= 1 + 0.05 * r; } },
  { id: 'swift', name: 'Lantern of the Swallow', desc: '+1 Dash charge per rank.', max: 2, cost: r => [80, 220][r], apply: (s, r) => { s.dash += r; } },
  { id: 'wind', name: 'Lantern of Second Wind', desc: 'Revive once per run at 50% HP, per rank.', max: 3, cost: r => [100, 220, 400][r], apply: () => {} },
  { id: 'luck', name: 'Lantern of Fortune', desc: '+5% chance of rarer boons per rank.', max: 4, cost: r => 50 + r * 50, apply: (s, r) => { s.luck += 0.05 * r; } },
  { id: 'greed', name: 'Lantern of Greed', desc: 'Begin each run with +40 gold per rank.', max: 3, cost: r => 40 + r * 40, apply: () => {} },
  { id: 'insight', name: 'Lantern of Insight', desc: '+1 boon reroll per run, per rank.', max: 3, cost: r => 60 + r * 70, apply: () => {} },
  { id: 'ki', name: 'Lantern of Ki', desc: 'Ultimate charges +10% faster per rank.', max: 4, cost: r => 40 + r * 40, apply: (s, r) => { s.ultGain *= 1 + 0.1 * r; } },
  { id: 'eye', name: 'Lantern of the Hawk', desc: '+3% critical chance per rank.', max: 3, cost: r => 50 + r * 50, apply: (s, r) => { s.crit += 0.03 * r; } },
  { id: 'skin', name: 'Lantern of Iron', desc: '+3% armor per rank.', max: 3, cost: r => 60 + r * 60, apply: (s, r) => { s.armor += 0.03 * r; } },
  { id: 'dawn', name: 'Lantern of Dawn', desc: 'Begin each run with a random boon.', max: 1, cost: () => 250, apply: () => {} },
  { id: 'wealth', name: 'Lantern of Plenty', desc: '+10% Spirit Shards earned per rank.', max: 3, cost: r => 120 + r * 120, apply: () => {} },
];
const PACT = [
  { id: 'hp', name: 'Blood Moon', desc: 'Foes have +15% HP per rank.', max: 4 },
  { id: 'dmg', name: 'Sharpened Fangs', desc: 'Foes deal +20% damage per rank.', max: 3 },
  { id: 'spd', name: 'Swift Shadows', desc: 'Foes move and attack 12% faster per rank.', max: 2 },
  { id: 'elite', name: 'Elite Legion', desc: 'Elite foes appear far more often.', max: 2 },
  { id: 'heal', name: 'Fading Light', desc: 'All healing −25% per rank.', max: 2 },
  { id: 'boss', name: 'Hollow Tyrants', desc: 'Bosses have +20% HP and act faster per rank.', max: 2 },
  { id: 'price', name: 'Empty Purse', desc: 'Udon\'s prices +30% per rank.', max: 2 },
  { id: 'moonless', name: 'Moonless Night', desc: 'Begin with −15 Max HP per rank.', max: 2 },
  { id: 'waves', name: 'Endless Tide', desc: 'Combat rooms have an extra wave.', max: 1 },
];
const FRAGMENTS = [
  { id: 'first_clear', name: 'Fragment of the First Dawn', hint: 'Defeat Mugen, the Hollow Emperor.' },
  { id: 'gekkou_memory', name: 'Fragment of the Master', hint: 'Help Gekkou remember who he was (defeat him 5 times).' },
  { id: 'mecha_heart', name: 'Fragment of the Iron Heart', hint: 'Defeat MK-VIII 4 times, then talk to Ponta.' },
  { id: 'snow_peace', name: 'Fragment of the Thaw', hint: 'Defeat Shirahime as Yuki.' },
  { id: 'heat5', name: 'Fragment of the Waning Moon', hint: 'Defeat Mugen with Moon Phase 5 or higher.' },
  { id: 'heat10', name: 'Fragment of the New Moon', hint: 'Defeat Mugen with Moon Phase 10 or higher.' },
  { id: 'all_heroes', name: 'Fragment of Bonds', hint: 'Defeat Mugen with every hero.' },
  { id: 'kaito_oath', name: 'Fragment of the Broken Oath', hint: 'Defeat Mugen as Kaito, his former general.' },
];

/* ------------------------------------------------------------------ */
/*  CAST (for portraits & dialogue)                                    */
/* ------------------------------------------------------------------ */
const CAST = {
  akane: { name: 'Akane', pal: HEROES.akane.pal, hair: 'ponytail', acc: 'ribbon' },
  rei: { name: 'Rei', pal: HEROES.rei.pal, hair: 'spiky', acc: 'headband' },
  yuki: { name: 'Yuki', pal: HEROES.yuki.pal, hair: 'hime', acc: 'ribbon' },
  kaito: { name: 'Kaito', pal: HEROES.kaito.pal, hair: 'wild', acc: 'mask' },
  hanabi: { name: 'Hanabi', pal: { hair: '#ffb04d', hair2: '#d9712a', skin: '#fff0e6', outfit: '#c9302c', outfit2: '#fff6ea', eye: '#ffc23d', accent: '#ffffff', scarf: '#ffd56b', acc2: '#fff0d0' }, hair: 'long', acc: 'foxears' },
  tama: { name: 'Obaa Tama', pal: { hair: '#d6d2cc', hair2: '#9c968e', skin: '#ecd3c0', outfit: '#5b6e5a', outfit2: '#2f3a2f', eye: '#5a4a3a', accent: '#f2e6c8', scarf: '#c9a36b' }, hair: 'bun', acc: null, eyesClosed: true },
  ponta: { name: 'Ponta', pal: { hair: '#8a5a33', hair2: '#5c3a1e', skin: '#f2d6b8', outfit: '#3a5a8a', outfit2: '#22344f', eye: '#3a2a1a', accent: '#f2e6c8', scarf: '#ff8a3d', acc2: '#3a2a20' }, hair: 'short', acc: 'tanuki' },
  udon: { name: 'Old Man Udon', pal: { hair: '#f2f2f2', hair2: '#bbb', skin: '#efcfb0', outfit: '#f2f2f2', outfit2: '#444', eye: '#333', accent: '#c33', scarf: '#c33' }, hair: 'short', acc: 'headband', eyesClosed: true },
  gekkou: { name: 'Gekkou', pal: BOSSES.gekkou.pal, hair: 'long', acc: 'hat' },
  mecha: { name: 'MK-VIII', mech: true },
  shirahime: { name: 'Shirahime', pal: BOSSES.shirahime.pal, hair: 'hime', acc: 'crown' },
  mugen: { name: 'Mugen', pal: BOSSES.mugen.pal, hair: 'ponytail', acc: 'crown' },
  thousandth: { name: '???', pal: BOSSES.thousandth.pal, hair: 'ponytail', acc: 'ribbon' },
  kami_fire: { name: 'Hinome', kami: 'fire' }, kami_thunder: { name: 'Raika', kami: 'thunder' }, kami_moon: { name: 'Tsukiyo', kami: 'moon' },
  kami_ice: { name: 'Mizuha', kami: 'ice' }, kami_wind: { name: 'Kazane', kami: 'wind' }, kami_blood: { name: 'Shuten', kami: 'blood' },
  narrator: { name: '', narrator: true },
};

/* ------------------------------------------------------------------ */
/*  STORY                                                              */
/* ------------------------------------------------------------------ */
// line = [speaker, text, mood?]   ("$hero" = currently played hero)
const STORY = {
  prologue: [
    ['narrator', 'Seven moons hung over the land of Hinomoto. The eighth — the Moon of Memory — kept every soul\'s story safe.'],
    ['narrator', 'One night, the Eighth Moon shattered. From its hollow core rose an emperor who devours memories: Mugen.'],
    ['narrator', 'Those who die beneath the broken moon forget themselves and become Hollow. All but one.'],
    ['hanabi', 'Oi. Oiii. Wake up, sleepyhead. You\'re drooling on my shrine.', 'happy'],
    ['akane', '...Where... Who are you? Why do I smell like smoke?'],
    ['hanabi', 'I\'m Hanabi, keeper of this Shrine of Lanterns. You\'re Akane, and you just died. Fourth time this week, actually.', 'happy'],
    ['akane', 'I... died?'],
    ['hanabi', 'A shard of the Eighth Moon is lodged in your heart. When you fall, it drags you back here. We call people like you Moonbound.'],
    ['hanabi', 'Each time you return, you lose a little memory. So let\'s make this quick, hm? Climb to the Palace of the Hollow Moon. Defeat Mugen.'],
    ['akane', 'And if I can\'t?'],
    ['hanabi', 'Then you\'ll keep trying until you can! Or until you forget why. Ehehe~ No pressure!', 'happy'],
    ['hanabi', 'The Kami of the six winds will lend you their blessings out there. Talk to Obaa Tama about the lanterns, and Ponta about... well, Ponta will talk to YOU. At length.'],
    ['hanabi', 'The torii gate to the north leads into the Ember Grove. Go on, Moonbound. The moon is waiting.'],
  ],
  firstDeath: [
    ['hanabi', 'Welcome baaack~! How was dying? Tingly? Did you see a light?', 'happy'],
    ['$hero', 'That hurt more than I expected.'],
    ['hanabi', 'It always does. But look — you brought back Spirit Shards. Obaa Tama can pour them into the Lantern Mirror and make you stronger.'],
    ['hanabi', 'Every death is a lesson. Every lesson is a lantern. That\'s what Obaa says, anyway. I mostly just nap.'],
  ],
  firstClear: [
    ['mugen', '...So. You climbed all the way up here. Again.'],
    ['$hero', 'Again?'],
    ['mugen', 'You still do not see it. Look at my face, Moonbound. Look closely, before the moon pulls you home.'],
    ['narrator', 'For a heartbeat, the Emperor\'s mask cracks. Beneath it — a familiar ribbon, faded to grey.'],
    ['mugen', 'Shatter me a hundred times. The moon stays broken. You need all eight fragments to make it whole... and I am the last one.'],
    ['narrator', 'Light swallows the throne room. The shard in your heart burns — and pulls you home.'],
    ['hanabi', '...You did it. You actually beat him. Then why is the moon still broken?'],
    ['hanabi', 'Eight fragments, he said? ...I\'ll check the old scrolls. You — rest. Then go again. Something tells me this is only the beginning.'],
  ],
  trueEnding: [
    ['narrator', 'The eighth fragment slots into place. Mugen kneels, his crown splitting down the middle.'],
    ['thousandth', 'Do you understand now? I am you. The Akane who died a thousand times, and on the thousandth, decided to stop.'],
    ['thousandth', 'I thought: if memory is what hurts, then let no one remember. Let the moon stay hollow. Let everyone be empty and at peace.'],
    ['akane', 'You\'re wrong. Every time I came back, I forgot something. But I kept the people. Hanabi. Rei. Yuki. Kaito. Even you.'],
    ['akane', 'Memory isn\'t the wound. It\'s the stitches.'],
    ['thousandth', '...Hah. You always were the stubborn one. Take it, then. Take my thousand deaths. Make them mean something.'],
    ['narrator', 'The Thousandth Akane dissolves into silver light, flowing into the shard in your chest. Above the palace, eight moons blaze to life.'],
    ['narrator', 'Across Hinomoto, the Hollow wake up. They remember their names. They remember each other.'],
    ['hanabi', '...Akane? Akane! Look at the sky! It\'s — it\'s whole! You did it!', 'happy'],
    ['akane', 'We did it. ...Hanabi, why are you crying?'],
    ['hanabi', 'I\'m a fox spirit! We don\'t cry! It\'s just — moon dust. In my eyes. Shut up.', 'happy'],
    ['narrator', 'THE END ...?  — The lanterns still burn. The Moon Phase Pact still calls. Your story is yours to keep writing.'],
  ],
};

// Hub conversations. First matching unseen entry plays; otherwise a random idle line.
const TALKS = {
  hanabi: [
    { id: 'h1', cond: s => s.runs >= 2, lines: [['hanabi', 'You know, most people would give up after three or four deaths. You\'re weirdly persistent.'], ['$hero', 'Is that a compliment?'], ['hanabi', 'It\'s an observation! ...okay, it\'s a compliment.', 'happy']] },
    { id: 'h2', cond: s => (s.bossKills.gekkou || 0) >= 1, lines: [['hanabi', 'That ronin in the Grove — Gekkou. Did he... say anything to you?'], ['$hero', 'He called me "little blossom". Like he knew me.'], ['hanabi', 'Hmm. The Hollow keep echoes of who they were. Beat him again. Maybe the echo gets louder.']] },
    { id: 'h3', cond: s => (s.bossKills.mecha || 0) >= 1, lines: [['hanabi', 'Ponta has been sobbing into his tea for an hour. Something about "my precious Onigiri". You wouldn\'t know anything about that?'], ['$hero', 'The giant robot tried to step on me.'], ['hanabi', 'Ahh. Yes. That would do it.']] },
    { id: 'h4', cond: s => (s.bossKills.shirahime || 0) >= 1, lines: [['hanabi', 'The Snow Empress... she wasn\'t always cruel. She used to make snow fall softly on the harvest festival. Kids would catch it on their tongues.'], ['hanabi', 'Whatever Mugen took from her, it must have been something precious.']] },
    { id: 'h5', cond: s => (s.bossKills.mugen || 0) >= 1, lines: [['hanabi', 'I found the scroll. "Eight fragments for the Eighth Moon. One for each bond that refuses to be forgotten."'], ['hanabi', 'Check the Codex — I wrote down what I think each fragment needs. Tell nobody that I did homework.']] },
    { id: 'h6', cond: s => s.fragments.length >= 4, lines: [['hanabi', 'Half the fragments... The shrine bell rang on its own last night. Like the moon is waking up.'], ['$hero', 'Hanabi, what happens to you when the moon is restored?'], ['hanabi', '...Let\'s not get ahead of ourselves, hm?']] },
    { id: 'h7', cond: s => s.fragments.length >= 8 && !s.flags.trueEnd, lines: [['hanabi', 'All eight. They\'re humming, can you hear it?'], ['hanabi', 'When you face Mugen this time, the fragments will strip away his mask. Whatever is under it... be ready.']] },
    { id: 'h8', cond: s => s.flags.trueEnd, lines: [['hanabi', 'Eight moons. I keep staring at them. You\'d think I\'d be bored by now.'], ['hanabi', 'The Pact is still here, you know. If you want to test yourself against harder phases. For fun! Ehehe.', 'happy']] },
  ],
  hanabi_idle: [
    [['hanabi', 'Fox tip: dashing through attacks makes you invincible for a moment. Fox tip two: do that more.']],
    [['hanabi', 'If you see a door with a kanji on it, that\'s a Kami offering their blessing. Pick ones that work together!']],
    [['hanabi', 'Elite foes glow. They hit harder, but their rooms give better rewards. Risk and reward~']],
    [['hanabi', 'Old Man Udon\'s ramen can heal almost anything. Except stupidity. I\'ve asked.']],
    [['hanabi', 'Your Ultimate charges as you deal damage. Press Q when the gauge glows. Very dramatic. Very anime.', 'happy']],
    [['hanabi', 'Spirit Sake levels up a boon you already have. Stack one god deep, or spread across many — your call.']],
  ],
  tama: [
    { id: 't1', cond: () => true, lines: [['tama', 'Ah, the little moon. Come, sit. These old bones remember your grandmother.'], ['tama', 'This is the Lantern Mirror. Bring me Spirit Shards and I\'ll light a lantern for you. Each flame is a piece of strength the moon cannot take away.']] },
    { id: 't2', cond: s => s.runs >= 5, lines: [['tama', 'You know why lanterns float on the river at Obon? So the dead can find their way home.'], ['tama', 'You are a lantern that keeps floating back, child. Mind you don\'t burn out.']] },
    { id: 't3', cond: s => (s.bossKills.mugen || 0) >= 2, lines: [['tama', 'That Emperor... I saw his face once, long ago, when he first came down from the moon.'], ['tama', 'He looked so very tired. Like someone who had lived the same day a thousand times.']] },
  ],
  tama_idle: [
    [['tama', 'Shards don\'t grow on trees, but Hollow do drop them. Go and fetch.']],
    [['tama', 'In my day, we fought yokai with a broom and harsh words.']],
    [['tama', 'Eat. You look pale. ...Oh, you\'re a ghost-adjacent. Never mind.']],
  ],
  ponta: [
    { id: 'p1', cond: () => true, lines: [['ponta', 'A CUSTOMER! Finally! Welcome to Ponta\'s Legendary Forge and Discount Tea House!', 'happy'], ['ponta', 'Bring me Moon Keys — the bosses drop them — and I can awaken new Forms of your weapon. I can also, um, help unlock other heroes. For a fee.'], ['$hero', 'Is the tea free?'], ['ponta', 'The tea is cursed. Please do not drink the tea.']] },
    { id: 'p2', cond: s => (s.bossKills.mecha || 0) >= 1, lines: [['ponta', 'You... you fought Onigiri. My MK-VIII. I built him to carry rice to the shrine festival!'], ['ponta', 'When the moon broke, a Hollow shard got into his core. He\'s not evil! He\'s just... very confused and very large.'], ['ponta', 'If you defeat him enough times, maybe the corruption will crack. Then I could fix him. Please, Moonbound!']] },
    { id: 'p3', cond: s => (s.bossKills.mecha || 0) >= 4, frag: 'mecha_heart', lines: [['ponta', 'LOOK! LOOK WHAT I FOUND IN THE SCRAP YOU BROUGHT BACK!'], ['ponta', 'His heart-core! The shard came out clean! He\'s... he\'s still in there. He beeped at me!'], ['ponta', 'And look, the shard — it\'s glowing silver. That\'s a Moon Fragment, isn\'t it? Take it. Onigiri would want you to have it.'], ['narrator', 'Obtained the Fragment of the Iron Heart.']] },
    { id: 'p4', cond: s => s.heroes.rei && s.heroes.rei.unlocked, lines: [['ponta', 'That Rei boy keeps punching my anvil. Says it\'s "training". The anvil has feelings too, you know!']] },
  ],
  ponta_idle: [
    [['ponta', 'Every Form is a different memory of your weapon. Same blade, different stories!']],
    [['ponta', 'Moon Keys from bosses! Moon Keys from rare doors! Moon Keys from... no, that\'s all of them.']],
    [['ponta', 'Hit the training dummy! It\'s tougher than it looks! (It is exactly as tough as it looks.)']],
  ],
  rei: [
    { id: 'r1', cond: () => true, lines: [['rei', 'Took you long enough. I\'ve been dead for, like, three loops waiting for you to show up.'], ['akane', 'Rei?! You\'re Moonbound too?'], ['rei', 'Apparently. Hanabi says it\'s your shard doing it. Anyone who fights beside you gets dragged back too. So I can\'t even die without you getting the credit.', 'happy'], ['rei', 'Use me if you want. These gauntlets don\'t do subtle.']] },
    { id: 'r2', cond: s => s.runs >= 8, lines: [['rei', 'Hey. When we were kids, you used to beat me in every sparring match. Every one.'], ['rei', 'I\'ve been getting a little of that back each time I die. The memories, I mean. Not the losses. ...Okay, also the losses.']] },
    { id: 'r3', cond: s => (s.clearsByHero.rei || 0) >= 1, lines: [['rei', 'I punched an Emperor in the face. Childhood dream: achieved.', 'happy']] },
  ],
  rei_idle: [[['rei', 'Wanna spar? No? Coward.']], [['rei', 'Dash forward, not away. Offense is defense!']], [['rei', 'Ponta\'s tea made my tongue go numb for a whole loop.']]],
  yuki: [
    { id: 'y1', cond: () => true, lines: [['yuki', 'You fought my mother.'], ['$hero', 'I... yes. I\'m sorry.'], ['yuki', 'Don\'t be. That thing on the throne isn\'t her. Mugen took her memory of me, and all that was left was the cold.'], ['yuki', 'Let me come with you. If anyone can melt that ice, it\'s her daughter.']] },
    { id: 'y2', cond: s => s.fragments.includes('snow_peace'), lines: [['yuki', 'She said my name. At the very end, she said my name.'], ['yuki', 'Thank you for bringing me there. I think... the snow will fall softly again someday.', 'happy']] },
  ],
  yuki_idle: [[['yuki', 'Frost Lotus works best where foes are about to be. Predict them.']], [['yuki', 'Hanabi stole my hairpin. I know she did. She smells like guilt and fried tofu.']]],
  kaito: [
    { id: 'k1', cond: () => true, lines: [['kaito', 'Don\'t look at me like that. Yes, I served Mugen. I was his general for longer than I care to remember.'], ['kaito', 'He promised that if we forgot our pain, we\'d be free. All I found was a hole where my name should be.'], ['kaito', 'I owe this world a debt. Let my scythe pay some of it back.']] },
    { id: 'k2', cond: s => s.fragments.includes('kaito_oath'), lines: [['kaito', 'He recognized me. In the end, he said: "You were always my most loyal general." ...And then he thanked me for leaving.'], ['kaito', 'I don\'t know what to do with that.']] },
  ],
  kaito_idle: [[['kaito', 'The scythe returns. Always position for the return trip.']], [['kaito', 'Rei challenged me to an arm-wrestle. I let him win. Don\'t tell him.']]],
};

// Boss dialogue (by number of previous encounters). Last entry repeats.
const BOSS_TALK = {
  gekkou: [
    [['gekkou', 'Another wanderer in my grove. Draw your blade, or turn back.'], ['$hero', 'Out of my way, ronin.'], ['gekkou', 'Hmph. Your stance... it is familiar. No matter. Fall.']],
    [['gekkou', 'You again. Why does your face... hurt to look at?'], ['$hero', 'Maybe because I keep beating you.']],
    [['gekkou', 'I dreamed of a girl. She held a wooden sword upside down. I laughed, and she cried.'], ['gekkou', '...Show me your blade. Perhaps it will tell me her name.']],
    [['gekkou', 'Benizakura. That sword is called Benizakura. I... forged it. For a student.'], ['$hero', 'Master...?'], ['gekkou', 'Do not call me that! Not until I remember why!', 'angry']],
    [['gekkou', 'Little blossom. It is you. I remember now — the dojo, the plum trees, your terrible footwork.'], ['gekkou', 'Mugen\'s shard still binds me. Cut me down one last time, and set me free properly.']],
    [['gekkou', 'Again, little blossom. Your footwork is still terrible. Show me it has improved.', 'happy']],
  ],
  gekkou_defeat: [
    [['gekkou', 'Ngh... a fine cut...']],
    [['gekkou', 'That technique... who taught you...']],
    [['gekkou', 'The plum trees... they bloomed white... that spring...']],
    [['gekkou', 'Benizakura... still sharp...']],
    [['gekkou', 'Thank you, Akane. Go. Find the moon. I will be here, keeping the grove for you.'], ['narrator', 'Obtained the Fragment of the Master.']],
    [['gekkou', 'Better. Much better. Now go.', 'happy']],
  ],
  mecha: [
    [['mecha', 'BZZT. INTRUDER DETECTED. RICE DELIVERY PROTOCOL... OVERRIDDEN. EXTERMINATE.'], ['$hero', 'Is that robot shaped like a rice ball?']],
    [['mecha', 'YOU AGAIN. PROBABILITY OF FRIENDSHIP: 0.0%. INITIATING ROCKET PUNCH.']],
    [['mecha', 'ERROR. ERROR. MEMORY FILE: "PONTA.JPG" DETECTED. ...SUPPRESSING. SUPPRESSING.']],
    [['mecha', 'PON... TA... RICE... FESTIVAL... CORE INSTABILITY 87%. PLEASE... STOP... ME.']],
    [['mecha', 'BEEP BOOP. SYSTEMS PARTIALLY RESTORED. COMBAT SUBROUTINE STILL CORRUPTED. APOLOGIES IN ADVANCE.']],
  ],
  shirahime: [
    [['shirahime', 'Little flame. You have climbed so high just to freeze.'], ['shirahime', 'Kneel in the snow. It is quiet here. There is no pain in silence.']],
    [['shirahime', 'You return. Like spring. I despise spring.']],
    [['shirahime', 'Why do you keep coming? What is it you remember that I cannot?']],
  ],
  shirahime_yuki: [['shirahime', 'That bow... I carved that bow. For a small girl with cold hands. Who... who are you?'], ['yuki', 'Mother. It\'s me. It\'s Yuki.'], ['shirahime', 'I... have no daughter. I have only snow!', 'angry'], ['yuki', 'Then I\'ll melt it. Every flake.']],
  shirahime_yuki_defeat: [['shirahime', 'Yuki... my snowdrop... your hands are still so cold...'], ['yuki', 'Then hold them, Mother. Just for a moment.'], ['narrator', 'Obtained the Fragment of the Thaw.']],
  mugen: [
    [['mugen', 'Welcome to the end of your story, Moonbound. Kneel, and I will make you forget it all.'], ['$hero', 'Not a chance.'], ['mugen', 'They all say that. The first time.']],
    [['mugen', 'Again. Do you know how many times I have watched this exact scene?'], ['$hero', 'Then you know how it ends.']],
    [['mugen', 'Every loop you grow stronger. Every loop you forget a little more. Tell me — what was your mother\'s name?'], ['$hero', '...'], ['mugen', 'You see? I am only finishing what the moon started.']],
    [['mugen', 'You still don\'t have them all. The fragments. Without them, this is just a dance.'], ['mugen', 'Fine. I like dancing.']],
  ],
  mugen_kaito: [['mugen', 'Kaito. My loyal general. You wear their colors now?'], ['kaito', 'I wear my own, Majesty. For the first time.'], ['mugen', 'Then I will take your name back myself.']],
  mugen_kaito_defeat: [['mugen', 'You... were always my most loyal general. Even now. Especially now.'], ['mugen', 'Thank you... for leaving.'], ['kaito', '...'], ['narrator', 'Obtained the Fragment of the Broken Oath.']],
  mugen_true: [['mugen', 'Eight fragments. You actually gathered them all.'], ['mugen', 'Then there is no more need for this mask.'], ['narrator', 'The fragments flare. Mugen\'s mask shatters, and silver hair spills out from beneath the crown.']],
  thousandth: [['thousandth', 'Hello, me. Shall we see which of us the moon prefers?']],
};

/* ------------------------------------------------------------------ */
/*  EVENTS (fortune shrines)                                           */
/* ------------------------------------------------------------------ */
const EVENTS = [
  { id: 'omikuji', title: 'Omikuji Fortune Stand', text: 'A rickety stand of paper fortunes, untouched by the flames. A sign reads: "One draw per soul. The Kami are watching."',
    choices: [
      { label: 'Draw a fortune', fn: () => {
        const r = Math.random();
        if (r < 0.25) { G.offerBoons(null, { minRarity: 2 }); return 'GREAT BLESSING! (大吉) A Kami answers in a blaze of light.'; }
        if (r < 0.6) { G.addGold(80); return 'Blessing. (吉) Coins spill from the fortune box. +80 gold.'; }
        if (r < 0.85) { P.heal(P.stats.maxHp * 0.25); return 'Small blessing. (小吉) A warm breeze. Healed 25%.'; }
        P.hurtRaw(15); return 'CURSE. (凶) The paper bursts into flame in your hand. −15 HP.';
      } },
      { label: 'Leave it be', fn: () => 'You bow politely and move on. Somewhere, a Kami nods in approval.' },
    ] },
  { id: 'tanuki', title: 'Shady Tanuki Peddler', text: 'A tanuki in a far-too-large coat opens it to reveal trinkets. "Psst. Treasures. Pay in blood, very fair price, hm?"',
    choices: [
      { label: 'Trade 25% of your HP for a relic', cond: () => P.hp > P.stats.maxHp * 0.3, fn: () => { P.hurtRaw(Math.round(P.stats.maxHp * 0.25)); G.giveRelic(); return 'He grins, pockets a little of your life force, and hands you something shiny.'; } },
      { label: 'Trade 120 gold for a relic', cond: () => G.run.gold >= 120, fn: () => { G.run.gold -= 120; G.giveRelic(); return '"Pleasure doing business! Tell no one! Especially not Ponta."'; } },
      { label: 'Walk away', fn: () => '"Your loss, Moonbound!" He vanishes in a puff of leaves.' },
    ] },
  { id: 'jizo', title: 'Weathered Jizo Statue', text: 'A small stone Jizo with a red bib, half-buried in ash. Someone left an empty offering bowl.',
    choices: [
      { label: 'Offer 70 gold (+25 Max HP)', cond: () => G.run.gold >= 70, fn: () => { G.run.gold -= 70; G.run.bonusHp += 25; P.recompute(); P.heal(25); return 'The statue seems to smile. You feel sturdier.'; } },
      { label: 'Pray quietly (heal 35%)', fn: () => { P.heal(P.stats.maxHp * 0.35); return 'You clasp your hands. Warmth spreads through your chest.'; } },
      { label: 'Clean the statue (+30 Spirit Shards)', fn: () => { G.addShards(30); return 'You brush off the ash. Glittering shards fall from the bib.'; } },
    ] },
  { id: 'muramasa', title: 'A Blade in the Stone', text: 'A sword is buried to the hilt in a cracked boulder. It whispers. It wants to be held. It REALLY wants to be held.',
    choices: [
      { label: 'Pull the cursed blade', fn: () => { G.giveRelic('muramasa'); P.hurtRaw(10); return 'The blade cuts your palm as you grip it. It drinks, and purrs.'; } },
      { label: 'Leave it', fn: () => 'You leave the sword whispering to nobody. It sounds offended.' },
    ] },
  { id: 'gambler', title: 'The Fox Gambler', text: 'A kitsune shuffles hanafuda cards on a tree stump. "Double or nothing, Moonbound? The cards never lie. I do, though."',
    choices: [
      { label: 'Bet half your gold', cond: () => G.run.gold >= 20, fn: () => { const b = Math.floor(G.run.gold / 2); if (Math.random() < 0.5) { G.addGold(b); return `You win! +${b} gold. The fox looks genuinely surprised.`; } G.run.gold -= b; return `You lose ${b} gold. The fox cackles and vanishes.`; } },
      { label: 'Bet your health (win: Epic boon / lose: −20 HP)', fn: () => { if (Math.random() < 0.5) { G.offerBoons(null, { minRarity: 2 }); return 'A winning hand! The fox grumbles and summons a Kami.'; } P.hurtRaw(20); return 'The cards turn to knives. Ouch.'; } },
      { label: 'Decline', fn: () => '"Boring!" The fox flicks a card at your head.' },
    ] },
  { id: 'sleeping', title: 'Sleeping Kami Shrine', text: 'Two small shrines sit side by side, their bells swaying without wind. Two Kami are dozing here.',
    choices: [
      { label: 'Ring both bells', fn: () => { const ks = shuffle(KAMI_ORDER.slice()).slice(0, 2); G.offerBoons(null, { kamiPool: ks, count: 3 }); return 'Two drowsy voices answer at once.'; } },
      { label: 'Let them sleep (+1 reroll, heal 15%)', fn: () => { G.run.rerolls++; P.heal(P.stats.maxHp * 0.15); return 'You tiptoe past. The quiet is restful.'; } },
    ] },
  { id: 'memory', title: 'Floating Memory', text: 'A soap-bubble of light drifts by. Inside, you see a girl practicing with a wooden sword under plum blossoms. An old man laughs nearby.',
    choices: [
      { label: 'Touch it', fn: () => { G.addShards(45); G.run.ultBank = 100; P.ult = 100; return 'The memory sinks into you. Ultimate fully charged. +45 Spirit Shards.'; } },
      { label: 'Let it drift away', fn: () => { P.heal(20); return 'Some memories are better left floating. You feel lighter. +20 HP.'; } },
    ] },
  { id: 'onsen_cat', title: 'Lost Bakeneko Kitten', text: 'A tiny cat yokai is stuck in a bamboo cage, mewing pitifully. Its fuse-tail is unlit. For now.',
    choices: [
      { label: 'Free the kitten', fn: () => { if (Math.random() < 0.7) { G.giveRelic('neko'); return 'The kitten purrs and leaves a lucky Maneki-Neko charm behind!'; } P.hurtRaw(12); return 'It explodes affectionately. −12 HP. You regret nothing.'; } },
      { label: 'Leave it', fn: () => 'You walk away. The mewing follows you for a long time.' },
    ] },
];

const SHOP_LINES = ['Ramen! Hot ramen! Heals body and soul!', 'Ah, Moonbound! The usual? I don\'t remember what the usual is. Neither do you!', 'Broth simmered for three hundred years. Or since Tuesday. Time is weird now.', 'No refunds. No substitutions. No fighting in the cart.', 'You look hungry. Also, on fire. Mostly hungry.'];

const LORE = [
  { id: 'l_moon', title: 'The Eight Moons', cond: () => true, text: 'Seven moons rule the tides, seasons, dreams, sleep, wine, war and love. The eighth held memory — every name, every face, every story. When it shattered, the world began to forget itself.' },
  { id: 'l_moonbound', title: 'The Moonbound', cond: s => s.runs >= 1, text: 'The shard in Akane\'s heart does one thing: it will not let her stay dead. It drags her soul back to the shrine, and each return costs a sliver of memory. Its pull reaches anyone who fights beside her. They come back too, along a thinner thread, and they pay the same price.' },
  { id: 'l_hollow', title: 'The Hollow', cond: s => s.runs >= 3, text: 'Souls emptied of memory by Mugen. They are not evil — they are blank. Some retain echoes: a habit, a song, a stance with a sword.' },
  { id: 'l_kami', title: 'The Six Kami', cond: s => s.runs >= 2, text: 'Hinome, Raika, Tsukiyo, Mizuha, Kazane and Shuten. Without the Eighth Moon, they cannot walk the world, but they can pour their power into a willing vessel.' },
  { id: 'l_gekkou', title: 'Gekkou of the Plum Dojo', cond: s => (s.bossKills.gekkou || 0) >= 3, text: 'A swordsmith and teacher who forged Benizakura for his only student. When the moon broke, he went into the grove to protect his village — and never came out.' },
  { id: 'l_onigiri', title: 'MK-VIII "Onigiri"', cond: s => (s.bossKills.mecha || 0) >= 1, text: 'A festival robot designed by Ponta to deliver rice balls to children. Height: 6 meters. Top speed: "zoom". Corruption: severe.' },
  { id: 'l_shira', title: 'The Snow Empress', cond: s => (s.bossKills.shirahime || 0) >= 1, text: 'Shirahime once ruled the sky temple with gentle frost. Mugen took one memory from her — her daughter — and her heart froze around the hole.' },
  { id: 'l_mugen', title: 'Mugen, the Hollow Emperor', cond: s => (s.bossKills.mugen || 0) >= 1, text: 'He descended from the shattered moon wearing a crown of void. He fights with techniques no Hollow should know: a ronin\'s dash, a machine\'s lasers, an empress\'s ice.' },
  { id: 'l_thousand', title: 'The Thousandth Akane', cond: s => s.flags.trueEnd, text: 'On her thousandth return, a Moonbound girl decided that memory was the source of all suffering. She became the very thing she was fighting. She was wrong — but she was not cruel. Only tired.' },
];

/* =====================================================================
   EXPANSION — "Blades of the Forsaken Moon"
   Four new heroes, a seventh Kami, alternate bosses, duels, new foes,
   relics, events, disciplines and story.
   ===================================================================== */

/* ---------------- new heroes ---------------- */
Object.assign(HEROES, {
  sayo: {
    id: 'sayo', name: 'Sayo Kannagi', jp: '神薙 小夜', title: 'The Devoted Miko', weapon: 'Gohei — Shiranami',
    desc: 'A shrine maiden sworn to a single Kami. Only her patron answers — but it answers far louder.',
    pal: { hair: '#1c1626', hair2: '#0c0a12', skin: '#fff0ea', outfit: '#f6f2ee', outfit2: '#c8302c', eye: '#d6336c', accent: '#c8302c', scarf: '#c8302c' },
    hair: 'long', acc: 'ribbon', base: { maxHp: 90, speed: 295 }, devotion: true,
    specialName: 'Ofuda Barrage', specialCd: 2.6, ultName: 'Kami Oroshi', ultJp: '神降ろし', ultSub: 'Divine Descent',
    controls: 'Choose a patron Kami before the climb — ONLY it offers boons, but they are 60% stronger and every boon adds +6% damage. LMB staff combo · RMB homing talismans · Q Divine Descent (scales with boons held)',
    statMods(s) { s.devotion = 1.6; s.devPer = 0.06; s.devHp = 5; },
    forms: [
      { name: 'Form of Shiranami', desc: 'One patron. Boons +60% stronger; each boon held grants +6% damage and +5 Max HP.', cost: 0, apply() {} },
      { name: 'Form of the Twin Shrines', desc: 'Serve two patrons at once (their Duo boon can appear). Boons only +30% stronger.', cost: 2, apply(s) { s.devotion = 1.3; s.twin = true; } },
      { name: 'Form of the Living Shrine', desc: 'Every boon arrives Epic or better and the per-boon bonus doubles. Max HP −30.', cost: 3, apply(s) { s.living = true; s.devPer = 0.12; s.devHp = 10; s.maxHp -= 30; } },
    ],
    attack(p) {
      const i = p.combo % 3, col = KAMI[G.patronOf()].color;
      p.lunge(i === 2 ? 160 : 90);
      G.swing(p, { r: 94, arc: 1.9, dmg: [16, 16, 26][i], slot: 'attack', kb: i === 2 ? 260 : 120, color: col, dir: i % 2 ? -1 : 1, width: i === 2 ? 1.2 : 0.9 });
      if (i === 2) G.pProj({ x: p.x, y: p.y - 18, ang: p.aim, speed: 760, dmg: 14, slot: 'attack', r: 10, life: 0.8, kind: 'ofuda', color: col, homing: 3 });
      SFX.play('slash');
      p.combo = (i + 1) % 3;
      return (i === 2 ? 0.4 : 0.24) / p.stats.atkSpeed;
    },
    special(p) {
      const col = KAMI[G.patronOf()].color;
      for (let k = -2; k <= 2; k++) G.pProj({ x: p.x, y: p.y - 18, ang: p.aim + k * 0.2, speed: 620, dmg: 20, slot: 'special', r: 10, life: 1.2, kind: 'ofuda', color: col, homing: 3.5, kb: 80 });
      SFX.play('arrow');
    },
    ult(p) {
      p.invuln = 1.2;
      const S = p.stats, k = G.patronOf(), n = G.run ? Math.min(18, G.run.boons.filter(b => G.run.patrons.includes(BOON_BY_ID[b.id].k)).length) : 0, col = KAMI[k].color;
      G.flash(col, 0.5); SFX.play('bell');
      G.after(0.35, () => {
        for (const e of G.enemiesInRange(p.x, p.y, 900)) {
          G.fxLine(e.x, e.y - 700, e.x, e.y + 10, col, 46, 0.55);
          G.damageEnemy(e, (55 + 12 * n) * S.ult, { slot: 'ult', kb: 160, el: { k, pw: 2 } });
        }
        G.fxRing(p.x, p.y, 500, col, 0.6, 18); G.shake(12); SFX.play('boom');
      });
    },
    drawWeapon(ctx, p, x, y, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.strokeStyle = '#c9a36b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(40, 0); ctx.stroke();
      ctx.fillStyle = '#fffbe8';
      for (let i = 0; i < 2; i++) { const sd = i ? 1 : -1; ctx.beginPath(); ctx.moveTo(38, 0); ctx.lineTo(44, sd * 6); ctx.lineTo(36, sd * 10); ctx.lineTo(42, sd * 16 + Math.sin(p.t * 8) * 2); ctx.lineTo(34, sd * 14); ctx.lineTo(32, sd * 4); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
  },

  tetsu: {
    id: 'tetsu', name: 'Tetsu Kamikiri', jp: '神斬 鉄', title: 'The Godless', weapon: 'Nodachi — Kamigoroshi',
    desc: 'A ronin who cut down a god. No Kami will ever bless him. He has never needed them.',
    pal: { hair: '#5a5a66', hair2: '#2e2e36', skin: '#e2c4ac', outfit: '#4a3a2e', outfit2: '#221a14', eye: '#c9d4e6', accent: '#d8d0c0', scarf: '#8a1c2b', acc2: '#c9a36b' },
    hair: 'wild', acc: 'hat', base: { maxHp: 175, speed: 300 }, godless: true,
    specialName: 'Kamikiri: God-Cutter', specialCd: 3.0, ultName: 'Mugen Ittō', ultJp: '無限一刀', ultSub: 'The Endless Single Stroke',
    controls: 'CANNOT receive boons — Kami doors become Disciplines (raw stat training). +55% damage, +10% crit, +12% armor, 175 HP. LMB heavy nodachi · RMB God-Cutter wave · Q stop time, then one endless cut',
    statMods(s) { s.dmgAll *= 1.55; s.crit += 0.1; s.armor += 0.12; s.critDmg += 0.2; },
    forms: [
      { name: 'Form of the Unblessed', desc: 'No gods. Only steel and training.', cost: 0, apply() {} },
      { name: 'Form of the Hundred Cuts', desc: '+40% attack speed, −20% attack damage.', cost: 2, apply(s) { s.atkSpeed *= 1.4; s.atk *= 0.8; } },
      { name: 'Form of the Iron Will', desc: 'Disciplines are 50% stronger. Max HP −30.', cost: 3, apply(s) { s.discMult = 1.5; s.maxHp -= 30; } },
    ],
    attack(p) {
      const i = p.combo % 2;
      p.lunge(i ? 170 : 110);
      G.swing(p, { r: 124, arc: 2.6, dmg: i ? 40 : 30, slot: 'attack', kb: i ? 320 : 170, color: '#d8e2f0', dir: i ? -1 : 1, width: 1.3, stun: i ? 0.25 : 0 });
      SFX.play('heavy');
      p.combo = (i + 1) % 2;
      return (i ? 0.5 : 0.38) / p.stats.atkSpeed;
    },
    special(p) {
      const a = p.aim, len = 420, x1 = p.x, y1 = p.y, x2 = x1 + Math.cos(a) * len, y2 = y1 + Math.sin(a) * len;
      p.lunge(300);
      const n = G.hitLine(x1, y1, x2, y2, 84, 74, { slot: 'special', kb: 320, stun: 0.4 });
      G.fxLine(x1, y1, x2, y2, '#8a1c2b', 44, 0.35); G.fxLine(x1, y1, x2, y2, '#ffffff', 18, 0.4);
      SFX.play('heavy'); SFX.play('slash'); G.shake(7); if (n) G.stop(0.08);
    },
    ult(p) {
      p.invuln = 2.0;
      const S = p.stats;
      G.flash('#000000', 0.8); G.slow(0.5, 1.0);
      for (const e of G.enemiesInRange(p.x, p.y, 900)) { if (e.isBoss) e.st.freeze = Math.max(e.st.freeze, 0.9); else e.st.stun = Math.max(e.st.stun, 1.6); }
      G.after(0.9, () => {
        G.flash('#ffffff', 0.9);
        for (const e of G.enemiesInRange(p.x, p.y, 900)) G.damageEnemy(e, 230 * S.ult, { slot: 'ult', kb: 300 });
        G.fxLine(p.x - 900, p.y - 40, p.x + 900, p.y + 40, '#ffffff', 34, 0.6);
        G.fxLine(p.x - 900, p.y + 70, p.x + 900, p.y - 70, '#8a1c2b', 22, 0.6);
        G.shake(22); SFX.play('boom'); SFX.play('heavy');
      });
    },
    drawWeapon(ctx, p, x, y, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = '#2a1a14'; ctx.fillRect(-12, -2.5, 20, 5);
      ctx.fillStyle = '#8a1c2b'; ctx.fillRect(7, -5, 3, 10);
      ctx.fillStyle = '#e8eef6'; ctx.beginPath(); ctx.moveTo(10, -2.5); ctx.lineTo(70, -4); ctx.lineTo(80, 0); ctx.lineTo(10, 2.5); ctx.fill();
      ctx.restore();
    }
  },

  sora: {
    id: 'sora', name: 'Sora Tengetsu', jp: '天月 空', title: 'The Midnight Reaper', weapon: 'Cleaver — Kurogetsu',
    desc: 'A delivery boy turned substitute reaper when a moon shard hit him. Absurdly fast. Talks too much.',
    pal: { hair: '#ff8a1f', hair2: '#c45a0a', skin: '#f4d8c4', outfit: '#141418', outfit2: '#0a0a0c', eye: '#8a5a2a', accent: '#e8e8e8', scarf: '#e8e8e8' },
    bankaiPal: { hair: '#ff7a10', hair2: '#a8400a', skin: '#f4d8c4', outfit: '#050507', outfit2: '#000000', eye: '#c8102e', accent: '#c8102e', scarf: '#c8102e' },
    hair: 'spiky', acc: null, base: { maxHp: 95, speed: 345 },
    specialName: 'Getsuga: Moon Fang', specialCd: 1.8, ultName: 'Bankai: Tensa Kokuyō', ultJp: '卍解・天鎖黒曜', ultSub: 'Obsidian Heaven Chain',
    controls: '3 dash charges that recharge fast. Attacking right after a dash is a Shunpo strike (+60%). LMB cleaver · RMB crescent wave · Q Bankai — 10s of insane speed, damage and spammable waves',
    statMods(s) { s.dash += 2; s.dashCd *= 0.6; },
    forms: [
      { name: 'Form of the Substitute', desc: 'The cleaver, the coat, the attitude.', cost: 0, apply() {} },
      { name: 'Form of the Hollow Mask', desc: 'Every 3rd swing releases a small crescent wave. Special cooldown +0.8s.', cost: 2, apply(s) { s.maskForm = true; s.spCdAdd += 0.8; } },
      { name: 'Form of the Final Moon', desc: 'Ultimate becomes Mugetsu: one black slash for colossal damage — then you are slowed for 6s.', cost: 3, apply(s) { s.mugetsu = true; } },
    ],
    onDash(p) { p.shunpoT = 0.8; },
    attack(p) {
      const i = p.combo % 3, S = p.stats, bk = p.bankaiT > 0;
      let dmg = [15, 15, 26][i];
      if (p.shunpoT > 0) { dmg *= 1.6; p.shunpoT = 0; G.text(p.x, p.y - 64, 'SHUNPO', '#e8f4ff', 13); }
      p.lunge(i === 2 ? 220 : 120);
      G.swing(p, { r: 108, arc: 2.1, dmg, slot: 'attack', kb: i === 2 ? 260 : 110, color: bk ? '#c8102e' : '#e8f4ff', dir: i % 2 ? -1 : 1, width: i === 2 ? 1.3 : 1, stun: i === 2 ? 0.2 : 0 });
      if (i === 2 && (bk || S.maskForm)) G.pProj({ x: p.x, y: p.y - 18, ang: p.aim, speed: 900, dmg: 16, slot: 'special', r: 22, pierce: 99, life: 0.45, kind: 'getsuga', color: bk ? '#c8102e' : '#8fd8ff', kb: 120 });
      SFX.play(i === 2 ? 'heavy' : 'slash');
      p.combo = (i + 1) % 3;
      return [0.2, 0.2, 0.34][i] / S.atkSpeed / (bk ? 1.3 : 1);
    },
    special(p) {
      const bk = p.bankaiT > 0;
      G.pProj({ x: p.x, y: p.y - 18, ang: p.aim, speed: bk ? 1150 : 900, dmg: bk ? 48 : 40, slot: 'special', r: bk ? 40 : 30, pierce: 99, life: 0.55, kind: 'getsuga', color: bk ? '#c8102e' : '#8fd8ff', kb: 220 });
      SFX.play('slash'); SFX.play('heavy', 0.6); G.shake(4);
      return bk ? 1.1 : undefined;
    },
    ult(p) {
      const S = p.stats;
      if (S.mugetsu) {
        p.invuln = 1.6; G.flash('#000000', 0.95); G.slow(0.4, 1.0);
        G.after(0.7, () => {
          for (const e of G.enemiesInRange(p.x, p.y, 950)) G.damageEnemy(e, 320 * S.ult, { slot: 'ult', kb: 200 });
          G.fxLine(p.x - 1000, p.y, p.x + 1000, p.y, '#000000', 90, 0.8); G.fxLine(p.x - 1000, p.y, p.x + 1000, p.y, '#c8102e', 24, 0.8);
          G.shake(24); SFX.play('boom'); p.exhaustT = 6; p.exhaustDur = 6;
        });
        return;
      }
      p.bankaiT = 10; p.invuln = 0.8;
      G.fxRing(p.x, p.y, 260, '#c8102e', 0.5, 18); G.flash('#2a0008', 0.6);
      G.hitCircle(p.x, p.y, 260, 60 * S.ult, { slot: 'ult', kb: 500 });
      G.parts.burst(p.x, p.y - 20, 50, { type: 'glow', color: '#c8102e', min: 80, max: 420, size: 5 });
      SFX.play('boom');
    },
    drawWeapon(ctx, p, x, y, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      if (p.bankaiT > 0) {
        ctx.strokeStyle = '#444'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-6, 2); for (let i = 0; i < 6; i++) ctx.lineTo(-8 - i * 4, 6 + Math.sin(p.t * 10 + i) * 4); ctx.stroke();
        ctx.fillStyle = '#c8102e'; ctx.fillRect(4, -6, 4, 12);
        ctx.fillStyle = '#0a0a0c'; ctx.beginPath(); ctx.moveTo(8, -2.5); ctx.lineTo(56, -3); ctx.lineTo(64, 0); ctx.lineTo(8, 2.5); ctx.fill();
        ctx.strokeStyle = 'rgba(200,16,46,.8)'; ctx.lineWidth = 1; ctx.stroke();
      } else {
        ctx.fillStyle = '#e8e2d0'; ctx.fillRect(-12, -2.5, 16, 5);
        ctx.fillStyle = '#c9d2dc'; ctx.beginPath(); ctx.moveTo(4, -9); ctx.lineTo(56, -9); ctx.lineTo(66, -2); ctx.lineTo(60, 8); ctx.lineTo(4, 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7a8492'; ctx.fillRect(4, -9, 52, 3);
      }
      ctx.restore();
    }
  },

  daigo: {
    id: 'daigo', name: 'Daigo Ōkabuto', jp: '大兜 大吾', title: 'The Iron Warlord', weapon: 'War Hammer-Cannon — Gōtetsu',
    desc: 'A giant warlord with a hammer that is also a cannon. Slow, devastating, and impossible to stop — for a while.',
    pal: { hair: '#1a1416', hair2: '#0a0808', skin: '#d8a888', outfit: '#7a2e1e', outfit2: '#3a3a44', eye: '#ffb347', accent: '#c9a36b', scarf: '#c9a36b', acc2: '#ffcf5a' },
    hair: 'wild', acc: 'horns', size: 15.5, base: { maxHp: 150, speed: 255 },
    specialName: 'Ōzutsu: Cannonball', specialCd: 2.6, ultName: 'Kishin Gaikai', ultJp: '鬼神鎧解', ultSub: 'Berserker Armor',
    controls: 'LMB downslam — a long line shockwave, every 3rd is huge · RMB lobbed cannonball at cursor · Q Berserker Armor: 7s of NO damage taken, +35% damage — then EXHAUSTED (take +60% damage, −40% speed) for 5s',
    dashHit: 20,
    statMods(s) { s.dashDist *= 0.8; s.armor += 0.1; },
    forms: [
      { name: 'Form of the Iron Kabuto', desc: 'Hammer, cannon, armor. Subtlety not included.', cost: 0, apply() {} },
      { name: 'Form of the Siege', desc: 'Cannonball fires three shells in a spread. Special cooldown +1.2s.', cost: 2, apply(s) { s.siege = true; s.spCdAdd += 1.2; } },
      { name: 'Form of the Unbound Oni', desc: 'Berserker Armor lasts 11s and heals 5% of damage dealt — but Exhaustion lasts 8s and is harsher.', cost: 3, apply(s) { s.unbound = true; } },
    ],
    attack(p) {
      const i = p.combo % 3, big = i === 2, S = p.stats;
      const len = big ? 320 : 235, w = big ? 96 : 72, dmg = big ? 84 : 54, a = p.aim;
      p.swingT = p.swingDur = big ? 0.34 : 0.26; p.swingFrom = a - 2.2; p.swingTo = a + 0.3;
      G.after(0.13, () => {
        const x = p.x + Math.cos(a) * 20, y = p.y + Math.sin(a) * 20, x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
        const n = G.hitLine(x, y, x2, y2, w, dmg, { slot: 'attack', kb: big ? 340 : 190, stun: big ? 0.5 : 0.25, kbAng: a });
        G.fxLine(x, y, x2, y2, '#ffb347', w * 0.55, 0.35);
        for (let k = 0; k < 7; k++) { const t = k / 6; G.parts.burst(lerp(x, x2, t), lerp(y, y2, t), 3, { type: 'shard', color: '#8a7a6a', min: 60, max: 220, size: 3, grav: 600, ang: -Math.PI / 2, spread: 0.8 }); }
        G.fxRing(x2, y2, big ? 90 : 60, '#ffb347', 0.3, 6);
        G.shake(big ? 11 : 6); SFX.play('heavy'); SFX.play('boom', big ? 0.6 : 0.3);
        if (n) G.stop(big ? 0.09 : 0.05);
      });
      p.combo = (i + 1) % 3;
      return (big ? 1.0 : 0.72) / S.atkSpeed;
    },
    special(p) {
      const S = p.stats, d = Math.min(480, Math.max(120, Math.hypot(Input.mouse.wx - p.x, Input.mouse.wy - p.y)));
      const offs = S.siege ? [-0.22, 0, 0.22] : [0];
      offs.forEach((o, i) => {
        const tx = p.x + Math.cos(p.aim + o) * d, ty = p.y + Math.sin(p.aim + o) * d;
        G.pZone({ x: tx, y: ty, r: 110, warn: 0.5 + i * 0.06, dmg: 72, slot: 'special', color: '#ffb347', kind: 'cannon', sx: p.x, sy: p.y - 34,
          onFire: z => G.boom(z.x, z.y, z.r) });
      });
      SFX.play('boom', 0.5); G.shake(4);
      p.lunge(-120);
    },
    ult(p) {
      const S = p.stats;
      p.berserkT = S.unbound ? 11 : 7; p.exhaustDur = S.unbound ? 8 : 5; p.exhaustT = 0;
      G.hitCircle(p.x, p.y, 220, 60 * S.ult, { slot: 'ult', kb: 520, stun: 0.6 });
      G.fxRing(p.x, p.y, 220, '#ff3d2e', 0.5, 16); G.flash('#ff2e2e', 0.45); G.shake(14);
      SFX.play('roar'); SFX.play('boom');
    },
    drawWeapon(ctx, p, x, y, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.strokeStyle = '#5a3a24'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(40, 0); ctx.stroke();
      ctx.fillStyle = '#3a3a44'; rrect(ctx, 34, -16, 26, 32, 5); ctx.fill();
      ctx.fillStyle = '#ffcf5a'; ctx.fillRect(34, -16, 4, 32);
      ctx.fillStyle = '#1a1a20'; circ(ctx, 60, 0, 7); ctx.fillStyle = '#ff8a3d'; circ(ctx, 60, 0, 3);
      ctx.restore();
    }
  },
});
HERO_ORDER.push('sayo', 'tetsu', 'sora', 'daigo');
Object.assign(HERO_UNLOCK, {
  sayo: { keys: 3, req: s => (s.bossKills.tamamo || 0) >= 1, hint: 'Defeat Tamamo-no-Mae, the Nine-Tailed Queen (an alternate Act I boss).' },
  tetsu: { keys: 3, req: s => (s.bossKills.tetsu || 0) >= 1, hint: 'Win the Duel against the Godless Ronin in the Neon Hollow City.' },
  sora: { keys: 4, req: s => (s.bossKills.shiro || 0) >= 1, hint: 'Defeat Shiro, the Hollow Reaper (an alternate Act III boss).' },
  daigo: { keys: 4, req: s => (s.bossKills.daigo || 0) >= 1, hint: 'Win the Duel against the Iron Warlord in the Palace of the Hollow Moon.' },
});

/* ---------------- Disciplines (for the Godless) ---------------- */
const DISCIPLINES = [
  { id: 'body', name: 'Iron Body', icon: '体', desc: m => `+${n0(20 * m)} Max HP.`, apply: (s, m) => { s.maxHp += 20 * m; } },
  { id: 'steel', name: 'Sharpened Steel', icon: '刃', desc: m => `+${n0(12 * m)}% attack damage.`, apply: (s, m) => { s.atk *= 1 + 0.12 * m; } },
  { id: 'focus', name: 'Focus', icon: '眼', desc: m => `+${n0(5 * m)}% critical chance.`, apply: (s, m) => { s.crit += 0.05 * m; } },
  { id: 'intent', name: 'Killing Intent', icon: '殺', desc: m => `Critical hits deal +${n0(25 * m)}% damage.`, apply: (s, m) => { s.critDmg += 0.25 * m; } },
  { id: 'foot', name: 'Footwork', icon: '足', desc: m => `+${n0(7 * m)}% move speed, dash recharges ${n0(Math.min(50, 10 * m))}% faster.`, apply: (s, m) => { s.speed *= 1 + 0.07 * m; s.dashCd *= 1 - Math.min(0.5, 0.1 * m); } },
  { id: 'breath', name: 'Breath of the Void', icon: '息', desc: m => `Ultimate charges ${n0(15 * m)}% faster.`, apply: (s, m) => { s.ultGain *= 1 + 0.15 * m; } },
  { id: 'stone', name: 'Stone Skin', icon: '岩', desc: m => `+${n0(5 * m)}% armor.`, apply: (s, m) => { s.armor += 0.05 * m; } },
  { id: 'blood', name: 'Bloodlust', icon: '鬼', desc: m => `Slaying a foe heals ${(2 * m).toFixed(1)} HP.`, apply: (s, m) => { s.feast += 2 * m; } },
  { id: 'iai', name: 'Iaijutsu', icon: '居', desc: m => `Special +${n0(25 * m)}% damage, cooldown −${n0(Math.min(50, 10 * m))}%.`, apply: (s, m) => { s.sp *= 1 + 0.25 * m; s.spCd *= 1 - Math.min(0.5, 0.1 * m); } },
  { id: 'stride', name: 'Long Stride', icon: '走', desc: () => '+1 Dash charge.', max: 2, apply: (s, m) => { s.dash += Math.round(m); } },
  { id: 'wrath', name: 'Wrath', icon: '怒', desc: m => `+${(3 * m).toFixed(1)}% damage per 10% HP missing.`, apply: (s, m) => { s.rage += 0.03 * m; } },
  { id: 'zen', name: 'Zen Mind', icon: '禅', desc: m => `Ultimate +${n0(15 * m)}% damage. Heal ${n0(4 * m)} entering each room.`, apply: (s, m) => { s.ult *= 1 + 0.15 * m; s.roomHeal += 4 * m; } },
  { id: 'power', name: 'Raw Power', icon: '力', desc: m => `+${n0(8 * m)}% damage with everything.`, apply: (s, m) => { s.dmgAll *= 1 + 0.08 * m; } },
];
const DISC_BY_ID = Object.fromEntries(DISCIPLINES.map(d => [d.id, d]));

/* ---------------- the seventh Kami ---------------- */
KAMI.gold = { name: 'Kogane', title: 'Fox of the Golden Harvest', color: '#ffcf40', glyph: '稲', el: 'Fortune',
  hello: ['Ohoho~ Money makes the blade go round!', 'Every coin you carry, I bless twice.', 'Inari sends regards. And an invoice.', 'Riches, little moon! Riches and violence!'] };
KAMI_ORDER.push('gold');
ELEMENT_TXT.gold = pw => `deals +${(4 * pw).toFixed(1)}% damage per 100 gold carried and may shake loose coins`;
SLOT_NAMES.gold = { attack: 'Golden Grain Strike', special: 'Harvest Moon Arts', dash: 'Coin Step', ult: 'Thousand Koban Finale' };
for (const slot of ['attack', 'special', 'dash', 'ult']) {
  const k = 'gold';
  const b = { id: k + '_' + slot, k, slot, name: SLOT_NAMES.gold[slot] };
  if (slot === 'attack') { b.desc = pw => `Attack deals +${n0(25 * pw)}% damage and ${ELEMENT_TXT.gold(pw)}.`; b.apply = (s, pw) => { s.atk *= 1 + 0.25 * pw; s.el.attack = { k, pw }; }; }
  if (slot === 'special') { b.desc = pw => `Special deals +${n0(40 * pw)}% damage and ${ELEMENT_TXT.gold(pw)}.`; b.apply = (s, pw) => { s.sp *= 1 + 0.4 * pw; s.el.special = { k, pw }; }; }
  if (slot === 'dash') { b.desc = pw => `Your dash strikes foes for ${n0(22 * pw)} and ${ELEMENT_TXT.gold(pw)}.`; b.apply = (s, pw) => { s.dashDmg += 22 * pw; s.el.dash = { k, pw }; }; }
  if (slot === 'ult') { b.desc = pw => `Ultimate deals +${n0(35 * pw)}% damage, charges ${n0(10 * pw)}% faster and ${ELEMENT_TXT.gold(pw)}.`; b.apply = (s, pw) => { s.ult *= 1 + 0.35 * pw; s.ultGain *= 1 + 0.1 * pw; s.el.ult = { k, pw }; }; }
  BOONS.push(b);
}
P_('gold_tithe', 'gold', 'Golden Tithe', pw => `+${n0(25 * pw)}% gold from all sources.`, (s, pw) => { s.gold += 0.25 * pw; });
P_('gold_harvest', 'gold', 'Bountiful Harvest', pw => `Clearing a room grants ${n0(15 * pw)} gold and heals 4.`, (s, pw) => { s.clearGold += 15 * pw; s.clearHeal += 4; });
P_('gold_favor', 'gold', 'Inari\'s Favor', pw => `Udon's prices are ${n0(Math.min(45, 12 * pw))}% lower.`, (s, pw) => { s.discount = Math.max(s.discount, Math.min(0.45, 0.12 * pw)); });
P_('gold_ward', 'gold', 'Kitsune Coin Ward', pw => `When hit, spend 10 gold to take ${n0(Math.min(55, 22 * pw))}% less damage.`, (s, pw) => { s.coinWard = Math.max(s.coinWard, Math.min(0.55, 0.22 * pw)); });
D_('duo_burnfortune', 'gold', 'fire', 'Burning Fortune', 'Burning foes burst into a shower of coins when slain.', s => { s.burnFortune = true; });
D_('duo_luckystar', 'gold', 'moon', 'Lucky Star', '+1% critical chance per 100 gold carried (up to +12%).', s => { s.luckyStar = true; });
for (const b of BOONS) BOON_BY_ID[b.id] = b;

/* ---------------- new relics ---------------- */
RELICS.push(
  { id: 'foxmask', name: 'Inari Fox Mask', icon: '🦊', desc: '+20% damage against elites and bosses.', apply: s => { s.bigGame += 0.2; } },
  { id: 'koban', name: 'Golden Koban', icon: '🪙', desc: 'Gain 100 gold right now.', onGain: () => { G.addGold(100); } },
  { id: 'geta', name: 'Tengu Geta', icon: '👡', desc: 'Dash travels 25% further. +6% move speed.', apply: s => { s.dashDist *= 1.25; s.speed *= 1.06; } },
  { id: 'cranes', name: 'Thousand Cranes', icon: '🎐', desc: 'Every dash heals 2 HP.', apply: s => { s.dashHeal += 2; } },
  { id: 'tsuba', name: 'Iron Tsuba', icon: '⚙', desc: 'Special deals +40% damage.', apply: s => { s.sp *= 1.4; } },
  { id: 'hourglass', name: 'Moon Hourglass', icon: '⌛', desc: 'Ultimate deals +30% damage.', apply: s => { s.ult *= 1.3; } },
  { id: 'nuepelt', name: 'Nue Pelt Cloak', icon: '🧥', desc: '+30 Max HP, −5% move speed.', apply: s => { s.maxHp += 30; s.speed *= 0.95; } },
  { id: 'bento', name: 'Lucky Bento', icon: '🍱', desc: 'Heal 25% every time you visit Udon\'s cart.', apply: s => { s.shopHeal = true; } },
);
for (const r of RELICS) RELIC_BY_ID[r.id] = r;

/* ---------------- new enemies ---------------- */
Object.assign(ENEMIES, {
  kitsunebi: { name: 'Foxfire Wisp', ai: 'shooter', hp: 30, spd: 110, dmg: 9, r: 13, cost: 1.5, gold: 4, shots: 1, spread: 0, cd: 2.6, pspeed: 170, homing: 1.8, keep: 340, draw: 'wisp', col: '#7ad7ff', col2: '#e8fbff', fly: true, desc: 'Blue flames left behind by the Nine-Tailed Queen. Their fire follows you.' },
  nue: { name: 'Nue Chimera', ai: 'leaper', hp: 125, spd: 95, dmg: 18, r: 22, cost: 2.5, gold: 6, draw: 'nue', col: '#7a5a3a', col2: '#ffe14d', kbRes: 0.4, desc: 'Monkey face, tanuki body, tiger legs, a snake for a tail. It leaps where you stand.' },
  rokuro: { name: 'Rokurokubi', ai: 'melee', hp: 72, spd: 90, dmg: 16, r: 16, cost: 2, gold: 5, range: 175, arc: 0.45, windup: 0.65, cd: 1.7, draw: 'rokuro', col: '#e8d8f0', col2: '#2a1a2a', desc: 'A hostess yokai whose neck stretches across the room. The bite comes in a straight line.' },
  bikeoni: { name: 'Bōsō Oni', ai: 'dasher', hp: 82, spd: 175, dmg: 16, r: 18, cost: 2, gold: 5, draw: 'bikeoni', col: '#e0435f', col2: '#ffe14d', desc: 'Biker oni of the Thunder Riders. They charge first and ask questions never.' },
  warashi: { name: 'Yuki-warashi', ai: 'swarm', hp: 22, spd: 165, dmg: 5, r: 11, cost: 0.7, gold: 1, contact: true, group: 3, slowTouch: true, draw: 'warashi', col: '#f4fbff', col2: '#5ad1ff', desc: 'Snow children. Their hugs chill you to the bone — and slow you down.' },
  tsurara: { name: 'Tsurara-onna', ai: 'caster', hp: 78, spd: 80, dmg: 17, r: 17, cost: 3, gold: 7, keep: 380, draw: 'tsurara', col: '#bfe9ff', col2: '#3ab7ff', fly: true, desc: 'Icicle women. They hang from the eaves of the sky temple and drop spears of ice where you step.' },
  usagi: { name: 'Moon Rabbit Assassin', ai: 'assassin', hp: 110, spd: 120, dmg: 22, r: 16, cost: 3, gold: 7, draw: 'usagi', col: '#f2f0ff', col2: '#c084ff', desc: 'The moon rabbits stopped pounding mochi. Now they pound skulls. They strike from behind.' },
  gasha: { name: 'Gashadokuro', ai: 'brute', hp: 330, spd: 60, dmg: 30, r: 34, cost: 4.5, gold: 11, slamR: 170, draw: 'gasha', col: '#e8e0d0', col2: '#c084ff', kbRes: 0.85, desc: 'A giant skeleton made of the starved and the forgotten. Its slam shakes the palace.' },
  foxclone: { name: 'Illusory Tamamo', ai: 'shooter', hp: 150, spd: 120, dmg: 12, r: 18, cost: 0, gold: 0, shots: 3, spread: 0.3, cd: 2.0, pspeed: 200, homing: 1.2, keep: 300, draw: 'foxclone', col: '#ffcf40', col2: '#7ad7ff', desc: 'A foxfire illusion. It fades if you strike it enough.' },
});
BIOMES[0].pool.kitsunebi = 3; BIOMES[0].pool.nue = 2;
BIOMES[1].pool.rokuro = 3; BIOMES[1].pool.bikeoni = 3;
BIOMES[2].pool.warashi = 3; BIOMES[2].pool.tsurara = 2;
BIOMES[3].pool.usagi = 3; BIOMES[3].pool.gasha = 2;
BIOMES[0].altBoss = 'tamamo'; BIOMES[1].altBoss = 'bakusou'; BIOMES[2].altBoss = 'shiro';
BIOMES[1].duel = 'tetsu'; BIOMES[3].duel = 'daigo';

/* ---------------- new bosses ---------------- */
Object.assign(BOSSES, {
  tamamo: { id: 'tamamo', name: 'Tamamo-no-Mae', title: 'Queen of Nine Tails', jp: '九尾の女王 玉藻前', hp: 3600, r: 24, spd: 175, dmg: 16, draw: 'tamamo', col: '#ffb347',
    pal: { hair: '#fff1d6', hair2: '#f0b860', skin: '#fff0ea', outfit: '#c8302c', outfit2: '#5a1018', eye: '#ffcf40', accent: '#ffe7a0', scarf: '#ffcf40', acc2: '#ffd0dc' }, hair: 'hime', acc: 'foxears',
    desc: 'Goddess of the Fox Shrine in the grove. The broken moon left her vain, cruel and very, very bored.',
    phases: [0.62, 0.3], patterns: [['foxfire', 'tailSweep', 'kitsuneRain'], ['foxfire', 'tailSweep', 'foxClones', 'kitsuneRain'], ['foxfire', 'ninefold', 'foxClones', 'tailSweep', 'kitsuneRain']] },
  bakusou: { id: 'bakusou', name: 'Bakusou', title: 'King of the Thunder Riders', jp: '雷走族総長 爆走', hp: 5600, r: 34, spd: 135, dmg: 18, draw: 'bakusou', col: '#ffe14d', kbRes: 1,
    pal: { hair: '#1a1a26', hair2: '#0a0a14', skin: '#e0435f', outfit: '#1a1a26', outfit2: '#0a0a14', eye: '#ffe14d', accent: '#ffe14d', scarf: '#ffe14d', acc2: '#f4e4c1' }, hair: 'wild', acc: 'horns',
    desc: 'Leader of an oni biker gang that rides the neon highways. Literally made of lightning and bad decisions.',
    phases: [0.6, 0.3], patterns: [['rideCharge', 'lightningStrikes', 'shockHorn'], ['rideCharge', 'thunderDrift', 'lightningStrikes', 'gangCall'], ['thunderDrift', 'rideCharge', 'shockHorn', 'lightningStrikes', 'gangCall']] },
  shiro: { id: 'shiro', name: 'Shiro', title: 'The Hollow Reaper', jp: '虚の死神 白', hp: 7400, r: 24, spd: 185, dmg: 21, draw: 'shiro', col: '#f0f0f0',
    pal: { hair: '#f4f4f4', hair2: '#b8b8c0', skin: '#f2f2f2', outfit: '#eeeeee', outfit2: '#c8c8d0', eye: '#ffcc00', accent: '#111111', scarf: '#111111' }, hair: 'spiky', acc: null,
    desc: 'The hollow that lives in a moon shard. It wears the face of whoever the shard struck. It is very fast and very rude.',
    phases: [0.62, 0.3], patterns: [['getsugaWave', 'flashStep', 'cleaverThrow'], ['getsugaWave', 'flashStep', 'cleaverThrow', 'hollowCero'], ['bankaiMirror', 'getsugaWave', 'flashStep', 'hollowCero', 'cleaverThrow']] },
  tetsu: { id: 'tetsu', duel: true, name: 'Tetsu Kamikiri', title: 'The Godless Ronin', jp: '神斬りの浪人 鉄', hp: 4400, r: 24, spd: 175, dmg: 18, draw: 'tetsuB', col: '#8a1c2b',
    pal: HEROES.tetsu.pal, hair: 'wild', acc: 'hat',
    desc: 'He waits at a crossroads in the neon city for anyone the Kami favor. He wants to see if they are worth it.',
    phases: [0.6, 0.3], patterns: [['dashSlash', 'godCut', 'iaiCircle'], ['dashSlash', 'godCut', 'iaiCircle', 'crescent'], ['godCut', 'dashSlash', 'iaiCircle', 'crescent']] },
  daigo: { id: 'daigo', duel: true, name: 'Daigo Ōkabuto', title: 'The Iron Warlord', jp: '鉄門の将 大吾', hp: 9000, r: 32, spd: 115, dmg: 24, draw: 'daigoB', col: '#ff6a3d', kbRes: 1,
    pal: HEROES.daigo.pal, hair: 'wild', acc: 'horns',
    desc: 'Mugen hired his army to guard the palace gate. The army is gone. Daigo is still guarding.',
    phases: [0.6, 0.3], patterns: [['slamLine', 'cannonVolley', 'stomp'], ['slamLine', 'cannonVolley', 'stomp', 'berserkArmor', 'rocketPunch'], ['slamLine', 'cannonVolley', 'berserkArmor', 'stomp', 'rocketPunch']] },
});

/* ---------------- cast ---------------- */
Object.assign(CAST, {
  sayo: { name: 'Sayo', pal: HEROES.sayo.pal, hair: 'long', acc: 'ribbon' },
  tetsu: { name: 'Tetsu', pal: HEROES.tetsu.pal, hair: 'wild', acc: 'hat' },
  sora: { name: 'Sora', pal: HEROES.sora.pal, hair: 'spiky', acc: null },
  daigo: { name: 'Daigo', pal: HEROES.daigo.pal, hair: 'wild', acc: 'horns' },
  tamamo: { name: 'Tamamo', pal: BOSSES.tamamo.pal, hair: 'hime', acc: 'foxears' },
  bakusou: { name: 'Bakusou', pal: BOSSES.bakusou.pal, hair: 'wild', acc: 'horns' },
  shiro: { name: 'Shiro', pal: BOSSES.shiro.pal, hair: 'spiky', acc: null },
  kami_gold: { name: 'Kogane', kami: 'gold' },
});
FRAGMENTS.find(f => f.id === 'all_heroes').hint = 'Defeat Mugen with four different heroes.';

/* ---------------- story: hub talks ---------------- */
Object.assign(TALKS, {
  sayo: [
    { id: 's1', cond: () => true, lines: [['sayo', 'I served at the Fox Shrine in the grove. Lady Tamamo was... difficult. Vain. But she loved the village children.'], ['sayo', 'When the moon broke, she forgot them. So I made her remember me instead. With a staff. Repeatedly.'], ['$hero', 'That\'s one way to pray.'], ['sayo', 'Choose a patron for me before the climb. I give everything to one Kami. That is what devotion means.']] },
    { id: 's2', cond: s => (s.clearsByHero.sayo || 0) >= 1, lines: [['sayo', 'My patron spoke to me at the top of the palace. It said "thank you". Kami never say thank you.', 'happy']] },
    { id: 's3', cond: s => s.heroes.tetsu && s.heroes.tetsu.unlocked, lines: [['sayo', 'That ronin, Tetsu. He cut down a Kami. I should hate him.'], ['sayo', '...He fixed the shrine roof yesterday without being asked. I am very confused.']] },
  ],
  sayo_idle: [[['sayo', 'Twin Shrines form lets me serve two Kami. It is twice the paperwork.']], [['sayo', 'Hanabi keeps asking me to bless her fried tofu. I will not.']]],
  tetsu: [
    { id: 'te1', cond: () => true, lines: [['tetsu', 'You won. Fine. I keep my word.'], ['tetsu', 'My village had a god that demanded a child every winter. I cut it in half. The other Kami have shunned me since.'], ['tetsu', 'No blessings, no favors. Only what I earn with my hands. Take me up that tower and I\'ll show you what training is worth.']] },
    { id: 'te2', cond: s => (s.clearsByHero.tetsu || 0) >= 1, lines: [['tetsu', 'Mugen looked at me like I was the first honest thing he\'d seen in a thousand years.'], ['tetsu', 'Godless and hollow. Not so different. ...Don\'t tell anyone I said that.']] },
  ],
  tetsu_idle: [[['tetsu', 'Disciplines stack. Pick one thing and master it.']], [['tetsu', 'The fox spirit offered me a blessing as a joke. I declined. She cried. It was a strange morning.']]],
  sora: [
    { id: 'so1', cond: () => true, lines: [['sora', 'Yo! Name\'s Sora. I was delivering ramen when a chunk of moon hit me in the face. Woke up with a giant cleaver and THIS haircut.'], ['sora', 'Oh, and the white guy you beat up in the sky temple? That\'s, uh, my inner hollow. He lives in my head. Rent free.'], ['$hero', 'Is he... dangerous?'], ['sora', 'Only when I lose. So I don\'t lose. Simple!', 'happy']] },
    { id: 'so2', cond: s => (s.clearsByHero.sora || 0) >= 1, lines: [['sora', 'Bankai on the Emperor. Got it on video. Ponta\'s making it a festival poster.', 'happy']] },
  ],
  sora_idle: [[['sora', 'Dash, then swing. Shunpo strike! It\'s all about the timing.']], [['sora', 'Rei said he\'s faster than me. Rei is very wrong.']], [['sora', 'Shiro keeps humming in my head. It\'s always the same song. Help.']]],
  daigo: [
    { id: 'd1', cond: () => true, lines: [['daigo', 'GAHAHA! You beat me fair, little Moonbound!', 'happy'], ['daigo', 'Daigo Ōkabuto, last warlord of the Iron Gate. Mugen hired my army to guard his palace. One by one, my soldiers forgot their names.'], ['daigo', 'I am the only one left who remembers them. So I will carry them up those stairs with me. All three hundred.']] },
    { id: 'd2', cond: s => (s.clearsByHero.daigo || 0) >= 1, lines: [['daigo', 'Kaito and I used to drink together, back when we both served the Emperor. He still owes me forty bottles of sake.'], ['daigo', 'I will collect. Eventually.', 'happy']] },
  ],
  daigo_idle: [[['daigo', 'When the armor breaks, I am slow and soft for a while. That is when you guard me, yes?']], [['daigo', 'Ponta asked to study my cannon. Ponta lost an eyebrow. Ponta is fine.']]],
});
TALKS.hanabi.push(
  { id: 'h_alt', cond: s => (s.bossKills.tamamo || 0) + (s.bossKills.bakusou || 0) + (s.bossKills.shiro || 0) >= 1, lines: [['hanabi', 'The moon\'s getting... wobbly. Other monsters are taking the bosses\' thrones on some loops.'], ['hanabi', 'Different paths, same tower. Keep an eye out for the strange ones — some might join you.']] },
  { id: 'h_gold', cond: s => s.kamiSeen.gold, lines: [['hanabi', 'You met KOGANE? Inari\'s greedy little fox? She owes me money!', 'angry'], ['hanabi', 'Her blessings get stronger the more gold you carry. So, uh... maybe don\'t spend it all on ramen.']] },
);

/* ---------------- story: bosses ---------------- */
Object.assign(BOSS_TALK, {
  tamamo: [
    [['tamamo', 'Ohohoho! A little moon wanders into MY grove? How adorable.', 'happy'], ['tamamo', 'Kneel, child. Nine tails, nine ways to make you beg.']],
    [['tamamo', 'You again! Do you have any idea how hard it is to look this beautiful while being repeatedly stabbed?']],
    [['tamamo', 'There was a shrine maiden... she used to brush my tails. Why do I remember that now?']],
  ],
  tamamo_defeat: [[['tamamo', 'Hmph... impressive... for a mortal...']], [['tamamo', 'Sayo... my little Sayo... tell her... the tails need brushing...']]],
  bakusou: [
    [['bakusou', 'YO YO YO! You\'re on Thunder Rider turf, kid! TOLL\'S YOUR LIFE!'], ['$hero', 'Is that... an oni on a motorcycle?'], ['bakusou', 'It\'s a LIFESTYLE!']],
    [['bakusou', 'You came back?! Respect. Still gonna run you over though.']],
    [['bakusou', 'The highway goes nowhere since the moon broke. We just ride in circles. Forever.'], ['bakusou', '...Whatever! LET\'S RIDE!']],
  ],
  bakusou_defeat: [[['bakusou', 'Gah... blew my engine... respect, kid...']], [['bakusou', 'Next time I\'m bringing the whole gang. All four of them.']]],
  shiro: [
    [['shiro', 'Heh. So YOU\'RE the one the moon picked. You look weak.'], ['shiro', 'I live inside the shards, Moonbound. Every one of you has a little of me inside. Wanna meet yours?']],
    [['shiro', 'King or horse, Moonbound? Which one are you?']],
    [['shiro', 'There\'s a kid out there with orange hair carrying a shard with my name on it. Beat me again and maybe he\'ll show up.']],
  ],
  shiro_defeat: [[['shiro', 'Tch... not bad... but you\'re still the horse...']], [['shiro', 'Fine. Go find the orange-haired idiot. Tell him Shiro says he\'s slow.']]],
  tetsu: [
    [['tetsu', 'Blessed by the Kami. I can smell it on you.'], ['tetsu', 'Show me that their gifts make you stronger than steel. Draw.']],
    [['tetsu', 'Again? Good. Neither of us has anywhere better to be.']],
  ],
  tetsu_defeat: [[['tetsu', '...Your blade is honest, at least. I\'ll be at your shrine. If you\'ll have a godless man.']], [['tetsu', 'Good duel. Same time next loop.']]],
  daigo: [
    [['daigo', 'HALT! None pass the Iron Gate! Not while Daigo Ōkabuto still stands!'], ['$hero', 'Your army is gone, Daigo.'], ['daigo', 'THEN I AM THE ARMY! COME!', 'angry']],
    [['daigo', 'GAHAHA! The little moon returns! My hammer remembers your face!', 'happy']],
  ],
  daigo_defeat: [[['daigo', 'Hah... hahaha... I am beaten... the gate is yours...'], ['daigo', 'Tell your fox at the shrine to save me a bowl of rice.']], [['daigo', 'A fine fight! The best kind of exhausted!']]],
});

/* ---------------- new events ---------------- */
EVENTS.push(
  { id: 'tea', title: 'Wandering Tea Ceremony', text: 'An old woman kneels on a tatami mat laid out in the ashes, whisking matcha. She gestures for you to sit.',
    choices: [
      { label: 'Share tea (heal 30%, +1 reroll)', fn: () => { P.heal(P.stats.maxHp * 0.3); G.run.rerolls++; return 'Bitter, warm, perfect. Your hands stop shaking.'; } },
      { label: 'Buy the Matcha of Clarity (60 gold)', cond: () => G.run.gold >= 60, fn: () => { G.run.gold -= 60; G.deepen(1); return 'The tea is so green it hurts. One of your powers sharpens.'; } },
    ] },
  { id: 'well', title: 'Wishing Well', text: 'A stone well with a moonlit surface. Coins glitter at the bottom. A sign: "Wishes 50 gold. No refunds. — Management (Kogane)".',
    choices: [
      { label: 'Toss 50 gold', cond: () => G.run.gold >= 50, fn: () => { G.run.gold -= 50; const r = Math.random(); if (r < 0.4) { G.offerBoons('gold'); return 'A golden fox tail flicks out of the water. Kogane answers!'; } if (r < 0.75) { G.addGold(110); return 'The well coughs up more than you threw in. +110 gold!'; } return 'Plop. Nothing happens. Somewhere, a fox giggles.'; } },
      { label: 'Fish for coins (−10 HP)', fn: () => { P.hurtRaw(10); G.addGold(45); return 'Freezing water, slippery stones, +45 gold.'; } },
      { label: 'Leave', fn: () => 'You resist the urge. Wise.' },
    ] },
  { id: 'mirror', title: 'Mirror of Truth', text: 'A bronze mirror stands alone. Your reflection is a little stronger than you. It holds out its hand.',
    choices: [
      { label: 'Take its hand (−12% Max HP, upgrade a power)', fn: () => { G.run.bonusHp -= Math.round(P.stats.maxHp * 0.12); P.recompute(); G.upgradeRarity(); return 'The reflection steps into you. Something you carry shines brighter.'; } },
      { label: 'Shatter it (+30 Spirit Shards)', fn: () => { G.addShards(30); return 'Seven years bad luck. Thirty shards good luck.'; } },
    ] },
  { id: 'camp', title: 'Ronin Campfire', text: 'Three ronin sit around a fire, sharpening swords. They nod at you. "Rest, or spar?"',
    choices: [
      { label: 'Rest by the fire (heal 40%)', fn: () => { P.heal(P.stats.maxHp * 0.4); return 'You sleep for what feels like a year. Nobody steals your boots.'; } },
      { label: 'Spar with them (−15 HP, +8% damage this run)', fn: () => { P.hurtRaw(15); G.run.bonusDmg += 0.08; P.recompute(); return 'Bruised, but you learned something about your own guard.'; } },
    ] },
);
SHOP_LINES.push('Kogane says I should raise prices. Kogane can eat my broth.', 'That big armored fellow ate eleven bowls. ELEVEN.');

/* ---------------- lore ---------------- */
LORE.push(
  { id: 'l_tamamo', title: 'Tamamo-no-Mae', cond: s => (s.bossKills.tamamo || 0) >= 1, text: 'The nine-tailed goddess of the grove\'s Fox Shrine. Vain, mischievous, secretly sentimental. Her shrine maiden never stopped visiting.' },
  { id: 'l_bakusou', title: 'The Thunder Riders', cond: s => (s.bossKills.bakusou || 0) >= 1, text: 'An oni motorcycle gang who ride the neon highways of the Hollow City. Since the moon broke, every road loops back to where it started.' },
  { id: 'l_shiro', title: 'The Hollow in the Shard', cond: s => (s.bossKills.shiro || 0) >= 1, text: 'Every moon shard carries a sliver of hollowness. In one shard, that sliver grew teeth, a cleaver, and an attitude.' },
  { id: 'l_tetsu', title: 'The God-Cutter', cond: s => (s.bossKills.tetsu || 0) >= 1, text: 'Tetsu Kamikiri slew the Kami of his village to save a child. The six Kami have refused him ever since — and he has grown strong out of spite.' },
  { id: 'l_daigo', title: 'The Iron Gate', cond: s => (s.bossKills.daigo || 0) >= 1, text: 'Three hundred soldiers once guarded the gate of the Hollow Palace. Only their warlord remembers their names. He recites them every night.' },
  { id: 'l_kogane', title: 'Kogane of the Golden Harvest', cond: s => s.kamiSeen.gold, text: 'Inari\'s favorite fox, keeper of the rice and the coin. Her power grows with greed — yours, preferably.' },
);

/* =====================================================================
   UPDATE 2 — "Requiem of the Black Sun"
   Campaign II, three new heroes, ~55 new boons, cursed relics, story.
   ===================================================================== */

/* ---------------- new heroes ---------------- */
Object.assign(HEROES, {
  isamu: {
    id: 'isamu', name: 'Isamu Nitenji', jp: '二天寺 勇', title: 'The Two Heavens', weapon: 'Daishō — Ten & Chi',
    desc: 'A dual-wielder of the Niten school. A long blade for heaven, a short blade for earth, and a prayer between them.',
    pal: { hair: '#2a1a12', hair2: '#140a06', skin: '#ecc8a8', outfit: '#24505a', outfit2: '#10262c', eye: '#7ad7ff', accent: '#e8e0c0', scarf: '#e8b04a' },
    hair: 'ponytail', acc: 'headband', base: { maxHp: 105, speed: 305 },
    specialName: 'Hurricane Barrage', specialCd: 4.5, ultName: 'Kitō: Prayer of Two Heavens', ultJp: '二天の祈祷', ultSub: 'Prayer of Two Heavens',
    controls: 'LMB 5-hit combo alternating short wakizashi and long katana swipes, ending in one heavy slash · RMB spin into a moving blender of blades · Q kneel and pray: +50% attack speed for 10s',
    forms: [
      { name: 'Form of Ten & Chi', desc: 'Heaven and earth in balance.', cost: 0, apply() {} },
      { name: 'Form of the Empty Sky', desc: 'The combo ender also launches a flying slash. Hurricane Barrage is 30% shorter.', cost: 2, apply(s) { s.emptySky = true; } },
      { name: 'Form of the Earth Prayer', desc: 'Prayer also grants +25% move speed and heals 12% — but lasts only 7s.', cost: 3, apply(s) { s.earthPrayer = true; } },
    ],
    attack(p) {
      const i = p.combo % 5, S = p.stats;
      if (i === 4) {
        const a = p.aim, x1 = p.x, y1 = p.y;
        p.lunge(260);
        const x2 = x1 + Math.cos(a) * 175, y2 = y1 + Math.sin(a) * 175;
        const n = G.hitLine(x1, y1, x2, y2, 74, 46, { slot: 'attack', kb: 360, stun: 0.3 });
        G.fxLine(x1, y1, x2, y2, '#e8b04a', 26, 0.3); G.fxLine(x1, y1, x2, y2, '#ffffff', 10, 0.32);
        p.swingT = p.swingDur = 0.2; p.swingFrom = a - 1.6; p.swingTo = a + 0.4;
        if (S.emptySky) G.pProj({ x: p.x, y: p.y - 18, ang: a, speed: 820, dmg: 26, slot: 'attack', r: 22, pierce: 99, life: 0.5, kind: 'getsuga', color: '#e8b04a', kb: 140 });
        SFX.play('heavy'); if (n) { G.stop(0.07); G.shake(6); }
        p.combo = 0;
        return 0.5 / S.atkSpeed;
      }
      const short = i % 2 === 0;
      p.lunge(short ? 70 : 120);
      p.offhand = short;
      G.swing(p, short ? { r: 72, arc: 1.5, dmg: 11, slot: 'attack', kb: 60, color: '#e8e0c0', dir: 1, width: 0.7 }
                       : { r: 104, arc: 2.0, dmg: 15, slot: 'attack', kb: 120, color: '#7ad7ff', dir: -1, width: 1.0 });
      SFX.play('slash');
      p.combo = i + 1;
      return (short ? 0.12 : 0.2) / S.atkSpeed;
    },
    special(p) {
      const S = p.stats, ticks = S.emptySky ? 7 : 10;
      p.spinT = ticks * 0.12;
      for (let k = 0; k < ticks; k++) G.after(k * 0.12, () => {
        G.hitCircle(p.x, p.y, 115, 9, { slot: 'special', kb: 90, quiet: true });
        G.fxSlash({ x: p.x, y: p.y - 14, r: 108, ang: k * 1.3, arc: 3.4, color: k % 2 ? '#7ad7ff' : '#e8e0c0', dur: 0.14, width: 0.9 });
        SFX.play('slash', 0.5);
      });
    },
    ult(p) {
      const S = p.stats;
      p.invuln = 0.7; p.prayT = S.earthPrayer ? 7 : 10;
      if (S.earthPrayer) p.heal(S.maxHp * 0.12);
      G.fxLine(p.x, p.y - 600, p.x, p.y, '#ffe9a0', 60, 0.8);
      G.parts.burst(p.x, p.y - 30, 30, { type: 'petal', color: '#ffe9a0', min: 40, max: 200, life: 1.4, size: 3, drag: 1 });
      SFX.play('bell');
    },
    drawWeapon(ctx, p, x, y, a) {
      // long katana
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = '#1a2a2e'; ctx.fillRect(-6, -2.5, 14, 5); ctx.fillStyle = '#e8b04a'; ctx.fillRect(7, -5, 3, 10);
      ctx.fillStyle = '#eef6ff'; ctx.beginPath(); ctx.moveTo(10, -2); ctx.lineTo(50, -3); ctx.lineTo(58, 0); ctx.lineTo(10, 2.5); ctx.fill();
      ctx.restore();
      // short wakizashi in the off hand
      const a2 = (p.spinT > 0 ? a + Math.PI : a + (p.offhand && p.swingT > 0 ? -0.2 : 1.2));
      ctx.save(); ctx.translate(p.x - Math.cos(p.aim) * 6, y + 4); ctx.rotate(a2);
      ctx.fillStyle = '#1a2a2e'; ctx.fillRect(-4, -2, 10, 4); ctx.fillStyle = '#e8b04a'; ctx.fillRect(5, -4, 2, 8);
      ctx.fillStyle = '#dfe8f0'; ctx.beginPath(); ctx.moveTo(7, -2); ctx.lineTo(30, -2.5); ctx.lineTo(35, 0); ctx.lineTo(7, 2); ctx.fill();
      ctx.restore();
    }
  },

  hibiki: {
    id: 'hibiki', name: 'Hibiki Otonashi', jp: '音無 響', title: 'The Festival Drum', weapon: 'Bachi — Raimei',
    desc: 'A taiko drummer whose rhythm became a weapon. Every strike calls a beat — land it, and the drum answers.',
    pal: { hair: '#2ad4b4', hair2: '#128a78', skin: '#fde6d8', outfit: '#1e3a8a', outfit2: '#0f1d45', eye: '#ffcf40', accent: '#ffffff', scarf: '#ff5a3d' },
    hair: 'twin', acc: 'headband', base: { maxHp: 100, speed: 300 }, rhythm: true,
    specialName: 'Ōdaiko Barrage', specialCd: 4.0, ultName: 'Matsuri Finale', ultJp: '祭囃子・大団円', ultSub: 'Festival Finale',
    controls: 'TIMING HERO. Every 2nd strike calls a beat ring — press attack as it closes: PERFECT = shockwave + stun, GOOD = small wave. Perfects build Groove (+3% damage, max 10). RMB drum slam + 3-beat chain · Q 8-beat finale (press attack or special on each beat)',
    forms: [
      { name: 'Form of Raimei', desc: 'Thunder in the drumskin.', cost: 0, apply() {} },
      { name: 'Form of the Lion Dance', desc: 'Perfect beats heal 2 HP. Groove caps at 5 stacks.', cost: 2, apply(s) { s.lionDance = true; } },
      { name: 'Form of the Thunder Drum', desc: 'No GOOD judgments — only PERFECT or MISS. Perfect shockwaves deal +60% and are bigger.', cost: 3, apply(s) { s.thunderDrum = true; } },
    ],
    attack(p) {
      const i = p.combo % 2;
      G.swing(p, { r: 84, arc: 1.6, dmg: 15, slot: 'attack', kb: 100, color: '#ff5a3d', dir: i ? -1 : 1, width: 0.8, punch: true });
      SFX.play(i ? 'don' : 'ka');
      p.combo = (i + 1) % 2;
      if (i === 1) G.qte({ dur: 0.42, keys: 'attack', onJudge: r => HEROES.hibiki.beat(p, r, 1, 'attack') });
      return 0.22 / p.stats.atkSpeed;
    },
    beat(p, res, scale, slot) {
      const S = p.stats, boost = S.thunderDrum ? 1.6 : 1;
      if (res === 'perfect') {
        const r = 130 * scale * (S.thunderDrum ? 1.25 : 1);
        G.hitCircle(p.x, p.y, r, 34 * scale * boost, { slot, kb: 300, stun: 0.5 });
        G.fxRing(p.x, p.y, r, '#ffcf40', 0.35, 10);
        p.groove = Math.min(S.lionDance ? 5 : 10, (p.groove || 0) + 1); p.grooveT = 3;
        if (S.lionDance) p.heal(2, true);
        SFX.play('don'); SFX.play('perfect'); G.shake(5);
      } else if (res === 'good') {
        G.hitCircle(p.x, p.y, 90 * scale, 18 * scale, { slot, kb: 160 });
        G.fxRing(p.x, p.y, 90 * scale, '#7ad7ff', 0.25, 6); SFX.play('ka');
      }
    },
    special(p) {
      G.hitCircle(p.x, p.y, 135, 28, { slot: 'special', kb: 260, stun: 0.3 });
      G.fxRing(p.x, p.y, 135, '#ff5a3d', 0.3, 10); SFX.play('don'); G.shake(6);
      for (let k = 0; k < 3; k++) G.qte({ delay: k * 0.45, dur: 0.45, keys: 'any', onJudge: r => { HEROES.hibiki.beat(p, r, 1.15, 'special'); if (r === 'perfect') p.ult = Math.min(100, p.ult + 3); } });
    },
    ult(p) {
      const S = p.stats;
      p.invuln = 3.6; p.finale = 0;
      for (let k = 0; k < 8; k++) G.qte({ delay: 0.3 + k * 0.38, dur: 0.38, keys: 'any', onJudge: r => {
        const list = G.enemiesInRange(p.x, p.y, 900);
        if (r === 'perfect') { p.finale++; for (const e of list) G.damageEnemy(e, 30 * S.ult, { slot: 'ult', kb: 60 }); SFX.play('don'); G.fxRing(p.x, p.y, 380, '#ffcf40', 0.3, 8); G.shake(5); }
        else if (r === 'good') { for (const e of list) G.damageEnemy(e, 15 * S.ult, { slot: 'ult', kb: 30 }); SFX.play('ka'); }
        if (k === 7) {
          if (p.finale >= 8) { for (const e of G.enemiesInRange(p.x, p.y, 900)) G.damageEnemy(e, 120 * S.ult, { slot: 'ult', kb: 400, stun: 0.8 }); G.flash('#ffcf40', 0.6); G.shake(18); SFX.play('boom'); G.text(p.x, p.y - 90, 'FULL COMBO!!', '#ffcf40', 30); }
          else G.text(p.x, p.y - 90, `${p.finale}/8`, '#ffffff', 22);
        }
      } });
    },
    drawWeapon(ctx, p, x, y, a) {
      for (const sd of [-1, 1]) {
        ctx.save(); ctx.translate(x + sd * 6, y + sd * 3); ctx.rotate(a + sd * 0.35 + (p.swingT > 0 ? -0.8 * (p.swingT / p.swingDur) : 0));
        ctx.fillStyle = '#c9a36b'; rrect(ctx, -2, -2.5, 30, 5, 2); ctx.fill();
        ctx.fillStyle = '#ff5a3d'; ctx.fillRect(-2, -2.5, 6, 5);
        ctx.restore();
      }
      // drum on back
      ctx.save(); ctx.fillStyle = '#8a3a1a'; ell(ctx, p.x - Math.cos(p.aim) * 14, p.y - 30, 11, 13); ctx.fillStyle = '#f2e4c8'; ell(ctx, p.x - Math.cos(p.aim) * 14, p.y - 30, 7, 9); ctx.restore();
    }
  },

  rinne: {
    id: 'rinne', name: 'Rinne Kagami', jp: '鏡 輪廻', title: 'The Mirror Blade', weapon: 'Iron Fan & Mirror — Yata',
    desc: 'She never strikes first. Every blow aimed at her comes back twice as hard.',
    pal: { hair: '#a8c8ff', hair2: '#5a78b8', skin: '#fdf0ea', outfit: '#2a2a3a', outfit2: '#14141e', eye: '#e8d07a', accent: '#e8d07a', scarf: '#7ab0ff' },
    hair: 'hime', acc: 'ribbon', base: { maxHp: 110, speed: 295 }, parrier: true,
    specialName: 'Riposte: Shattered Reflection', specialCd: 1.2, ultName: 'Mirror Domain', ultJp: '八咫鏡・映し世', ultSub: 'Mirror Domain',
    controls: 'PARRY HERO. LMB raises the mirror for a split second — any hit during it is PARRIED: negated, projectiles reflected, and answered with a counter-burst (+1 Mirror shard). A landed parry has no cooldown. RMB spends all shards on a lunging riposte · Q 6s of automatic parries',
    forms: [
      { name: 'Form of Yata', desc: 'The mirror that showed the Sun her own face.', cost: 0, apply() {} },
      { name: 'Form of the Cracked Mirror', desc: 'Parry window 60% longer, but counter-bursts deal 25% less.', cost: 2, apply(s) { s.parryWin = 1.6; s.counterMult = 0.75; } },
      { name: 'Form of the Eighth Mirror', desc: 'Hold up to 8 shards and each shard adds 20% more to the riposte. Max HP −25.', cost: 3, apply(s) { s.shardMax = 8; s.eighth = true; s.maxHp -= 25; } },
    ],
    attack(p) {
      const S = p.stats;
      p.parryT = 0.24 * (S.parryWin || 1);
      G.swing(p, { r: 70, arc: 1.4, dmg: 8, slot: 'attack', kb: 80, color: '#7ab0ff', dir: 1, width: 0.6 });
      SFX.play('ka', 0.5);
      return 0.42 / S.atkSpeed;
    },
    onParry(p, src) {
      const S = p.stats;
      // A landed parry has no cooldown: the mirror stays up and can be raised again immediately.
      p.parryT = 0.24 * (S.parryWin || 1); p.iframes = Math.max(p.iframes, 0.3); p.atkCd = 0;
      if (src && src.def && !src.dead && !src.isBoss) src.st.stun = Math.max(src.st.stun, 1.2);
      // Every projectile reflects, but the burst and its rewards are limited to one per moment,
      // so a wall of bullets can't deal 60 damage per bullet or refill the ultimate on its own.
      const now = G.t, big = !(now - (p.lastBurstT === undefined ? -9 : p.lastBurstT) < 0.25);
      if (big) {
        p.lastBurstT = now;
        p.shards = Math.min(S.shardMax || 5, (p.shards || 0) + 1);
        G.hitCircle(p.x, p.y, 145, 60 * (S.counterMult || 1), { slot: 'attack', kb: 380, stun: 1.0 });
      }
      if (src instanceof Proj) {
        const tg = (src.owner && !src.owner.dead) ? src.owner : G.nearestEnemy(p.x, p.y, 900);
        const a = tg ? angTo(p, tg) : Math.atan2(-src.vy, -src.vx);
        G.pProj({ x: p.x, y: p.y - 18, ang: a, speed: 900, dmg: Math.max(30, src.dmg * 2), slot: 'attack', r: 12, pierce: 2, life: 1.2, kind: 'orb', color: '#e8d07a', kb: 160 });
      }
      G.parts.burst(p.x, p.y - 20, big ? 16 : 5, { type: 'shard', color: '#e8f4ff', min: 100, max: 320, size: 3 });
      if (!big) return;
      if (p.domainT > 0) p.heal(2, true);
      else p.ult = Math.min(100, p.ult + 4); // Mirror Domain can't recharge itself
      G.fxRing(p.x, p.y, 145, '#e8f4ff', 0.3, 12); G.flash('#e8f4ff', 0.18);
      G.text(p.x, p.y - 70, 'PARRY!', '#e8f4ff', 20);
      SFX.play('parry'); G.stop(0.1); G.shake(6);
    },
    special(p) {
      const S = p.stats, n = p.shards || 0, a = p.aim, x1 = p.x, y1 = p.y, len = 240 + n * 20;
      G.moveSafe(p, Math.cos(a) * len, Math.sin(a) * len);
      p.iframes = Math.max(p.iframes, 0.3);
      const dmg = 30 + 45 * n * (S.eighth ? 1 + 0.2 * n / 4 : 1);
      G.hitLine(x1, y1, p.x, p.y, 70 + n * 6, dmg, { slot: 'special', kb: 300, stun: 0.3 });
      G.fxLine(x1, y1, p.x, p.y, '#7ab0ff', 18 + n * 4, 0.35);
      for (let k = 0; k < n * 3; k++) G.parts.burst(lerp(x1, p.x, k / (n * 3)), lerp(y1, p.y, k / (n * 3)), 2, { type: 'shard', color: '#e8f4ff', min: 40, max: 200 });
      if (n) G.text(p.x, p.y - 70, '鏡 ×' + n, '#7ab0ff', 18);
      p.shards = 0; SFX.play('heavy'); if (n >= 3) { G.stop(0.08); G.shake(8); }
    },
    ult(p) {
      p.domainT = 6; p.invuln = 0.5;
      G.fxRing(p.x, p.y, 300, '#e8f4ff', 0.6, 16); G.flash('#e8f4ff', 0.4); SFX.play('parry'); SFX.play('bell');
    },
    drawWeapon(ctx, p, x, y, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      const open = p.parryT > 0 ? 1 : 0.4;
      ctx.fillStyle = '#2a2a3a';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 26, -0.9 * open, 0.9 * open); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e8d07a'; ctx.lineWidth = 1.5;
      for (let i = -3; i <= 3; i++) { const aa = i * 0.3 * open; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(aa) * 26, Math.sin(aa) * 26); ctx.stroke(); }
      ctx.restore();
      // mirror
      const mx = p.x - Math.cos(p.aim) * 10, my = p.y - 26;
      ctx.save();
      if (p.parryT > 0 || p.domainT > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(232,244,255,.45)'; circ(ctx, p.x, p.y - 24, p.domainT > 0 ? 40 : 32); ctx.globalCompositeOperation = 'source-over'; }
      ctx.fillStyle = '#e8d07a'; circ(ctx, mx, my, 9); ctx.fillStyle = '#dff0ff'; circ(ctx, mx, my, 6.5);
      for (let i = 0; i < (p.shards || 0); i++) { const oa = p.t * 2 + i * TAU / (p.shards || 1); ctx.fillStyle = '#e8f4ff'; ctx.save(); ctx.translate(p.x + Math.cos(oa) * 28, p.y - 30 + Math.sin(oa) * 10); ctx.rotate(oa); ctx.fillRect(-2, -4, 4, 8); ctx.restore(); }
      ctx.restore();
    }
  },
});
HERO_ORDER.push('isamu', 'hibiki', 'rinne');
Object.assign(HERO_UNLOCK, {
  isamu: { keys: 4, req: s => (s.bossKills.mugen || 0) >= 2, hint: 'Defeat Mugen, the Hollow Emperor, twice.' },
  hibiki: { keys: 4, req: s => (s.bossKills.jorogumo || 0) >= 1, hint: 'Defeat Jorōgumo in Campaign II.' },
  rinne: { keys: 5, req: s => (s.bossKills.tokugane || 0) >= 1, hint: 'Defeat the Karakuri Shogun in Campaign II.' },
});
Object.assign(CAST, {
  isamu: { name: 'Isamu', pal: HEROES.isamu.pal, hair: 'ponytail', acc: 'headband' },
  hibiki: { name: 'Hibiki', pal: HEROES.hibiki.pal, hair: 'twin', acc: 'headband' },
  rinne: { name: 'Rinne', pal: HEROES.rinne.pal, hair: 'hime', acc: 'ribbon' },
  sanzu: { name: 'Sanzu the Ferryman', pal: { hair: '#3a3a44', hair2: '#1a1a22', skin: '#c8c0b8', outfit: '#2a2a30', outfit2: '#141418', eye: '#9ee7ff', accent: '#9a9488', scarf: '#5a5048', acc2: '#7a6a4a' }, hair: 'short', acc: 'hat', eyesClosed: true },
});

/* ---------------- ~55 new boons ---------------- */
const CAP = (k, id, name, desc, apply) => BOONS.push({ id, k, slot: 'passive', capstone: true, name, desc: () => desc, apply,
  req: run => run.boons.filter(b => { const d = BOON_BY_ID[b.id]; return d && !d.duo && d.k === k; }).length >= 2 });
// fire
P_('fire_ember', 'fire', 'Ember Trail', pw => `Dashing leaves embers that ignite foes for ${n0(6 * pw)} burn/sec.`, (s, pw) => { s.emberTrail = Math.max(s.emberTrail || 0, pw); });
P_('fire_sunspot', 'fire', 'Sunspot', pw => `Critical hits ignite foes for ${n0(7 * pw)} burn/sec.`, (s, pw) => { s.critBurn = Math.max(s.critBurn || 0, pw); });
P_('fire_kiln', 'fire', 'Kiln Heart', pw => `+${(2 * pw).toFixed(1)}% damage for each burning foe (max +25%).`, (s, pw) => { s.kiln = pw; });
P_('fire_longburn', 'fire', 'Slow Smolder', pw => `Burn lasts ${(1 + 0.5 * pw).toFixed(1)}s longer.`, (s, pw) => { s.burnDur = 1 + 0.5 * pw; });
P_('fire_cinder', 'fire', 'Cinder Skin', pw => `When hit, nearby foes are ignited for ${n0(10 * pw)} burn/sec.`, (s, pw) => { s.cinder = pw; });
CAP('fire', 'fire_dawnbreak', 'Dawnbreak', 'CAPSTONE: Burning foes take +25% damage from everything.', s => { s.dawnbreak = true; });
// thunder
P_('thunder_conductor', 'thunder', 'Conductor', pw => `Chain lightning stuns for ${(0.2 + 0.1 * pw).toFixed(1)}s.`, (s, pw) => { s.chainStun = 0.2 + 0.1 * pw; });
P_('thunder_front', 'thunder', 'Storm Front', pw => `Each recharged dash calls a bolt on the nearest foe for ${n0(25 * pw)}.`, (s, pw) => { s.stormFront = pw; });
P_('thunder_ion', 'thunder', 'Ionize', () => 'Chain lightning reaches 40% further and jumps once more.', s => { s.chainRange = 1.4; s.chainExtra += 1; });
P_('thunder_cap', 'thunder', 'Capacitor', pw => `Every 6th attack hit calls lightning for ${n0(40 * pw)}.`, (s, pw) => { s.capacitor = pw; });
P_('thunder_tempo', 'thunder', 'Drum Tempo', pw => `+${n0(Math.min(30, 9 * pw))}% attack speed.`, (s, pw) => { s.atkSpeed *= 1 + Math.min(0.3, 0.09 * pw); });
CAP('thunder', 'thunder_raijin', 'Raijin\'s Wrath', 'CAPSTONE: Thunder Drum strikes twice as often (you gain a weak one if you had none).', s => { s.drumFast = true; s.drum = Math.max(s.drum, 0.6); });
// moon
P_('moon_umbral', 'moon', 'Umbral Step', () => 'Your first hit after each dash is a guaranteed critical.', s => { s.dashCrit = true; });
P_('moon_exec', 'moon', 'Executioner\'s Moon', pw => `+${n0(45 * pw)}% damage to foes below 30% HP.`, (s, pw) => { s.execute = 0.45 * pw; });
P_('moon_tide', 'moon', 'High Tide', pw => `+${n0(14 * pw)}% critical chance while above 80% HP.`, (s, pw) => { s.moonTide = 0.14 * pw; });
P_('moon_lunacy', 'moon', 'Lunacy', () => 'Curse lasts twice as long and Chills the victim.', s => { s.lunacy = true; });
P_('moon_waxing', 'moon', 'Waxing Gibbous', pw => `Critical hits grant +${(2 * pw).toFixed(1)}% Ultimate charge.`, (s, pw) => { s.waxing = 2 * pw; });
CAP('moon', 'moon_full', 'Full Moon', 'CAPSTONE: Critical hits against Cursed foes deal double damage.', s => { s.fullMoon = true; });
// ice
P_('ice_glacier', 'ice', 'Glacier Plate', pw => `+${n0(18 * pw)} Max HP and +4% armor.`, (s, pw) => { s.maxHp += 18 * pw; s.armor += 0.04; });
P_('ice_snap', 'ice', 'Cold Snap', () => 'Freezing a foe Chills every foe near it twice.', s => { s.coldSnap = true; });
P_('ice_hoar', 'ice', 'Hoarfrost', () => 'Foes Freeze at 4 Chill stacks instead of 5.', s => { s.freezeAt = 4; });
P_('ice_still', 'ice', 'Still Water', pw => `Standing still for half a second grants +${n0(22 * pw)}% damage.`, (s, pw) => { s.stillWater = 0.22 * pw; });
P_('ice_aval', 'ice', 'Avalanche', () => 'Your Special Chills foes twice.', s => { s.avalanche = true; });
CAP('ice', 'ice_absolute', 'Absolute Stillness', 'CAPSTONE: Freeze lasts twice as long on non-boss foes.', s => { s.absolute = true; });
// wind
P_('wind_sky', 'wind', 'Sky Dancer', () => 'Dash invincibility lasts 0.2s longer.', s => { s.skyDancer = 0.2; });
P_('wind_press', 'wind', 'Pressure Front', () => 'All knockback is 50% stronger.', s => { s.kbMult = 1.5; });
P_('wind_feather', 'wind', 'Featherweight', pw => `+${n0(8 * pw)}% move speed and +${n0(Math.min(20, 6 * pw))}% attack speed.`, (s, pw) => { s.speed *= 1 + 0.08 * pw; s.atkSpeed *= 1 + Math.min(0.2, 0.06 * pw); });
P_('wind_vortex', 'wind', 'Vortex', pw => `Using your Special drags nearby foes toward you (strength ${n0(pw * 10)}).`, (s, pw) => { s.vortex = pw; });
P_('wind_guard', 'wind', 'Zephyr Guard', pw => `For 1s after dashing, take ${n0(Math.min(45, 18 * pw))}% less damage.`, (s, pw) => { s.dashGuard = Math.min(0.45, 0.18 * pw); });
CAP('wind', 'wind_eye', 'Eye of Kazane', 'CAPSTONE: Gain a second whirlwind; whirlwinds deal +50% damage.', s => { s.whirl += 1; s.whirlMult = 1.5; });
// blood
P_('blood_frenzy', 'blood', 'Frenzy', pw => `Kills grant +${n0(5 * pw)}% attack speed for 4s (stacks 5×).`, (s, pw) => { s.frenzy = 0.05 * pw; });
P_('blood_liver', 'blood', 'Iron Liver', () => 'All healing +30%.', s => { s.healMult *= 1.3; });
P_('blood_price', 'blood', 'Blood Price', pw => `+${n0(14 * pw)}% damage, −12% Max HP.`, (s, pw) => { s.dmgAll *= 1 + 0.14 * pw; s.bloodPrice = true; });
P_('blood_vamp', 'blood', 'Vampiric Edge', pw => `+${(Math.min(6, 1.5 * pw)).toFixed(1)}% lifesteal.`, (s, pw) => { s.lifesteal += Math.min(0.06, 0.015 * pw); });
P_('blood_rally', 'blood', 'Rally', pw => `After being hit, regain up to ${n0(Math.min(80, 35 * pw))}% of it by striking back within 3s.`, (s, pw) => { s.rally = Math.min(0.8, 0.35 * pw); });
CAP('blood', 'blood_oniking', 'Oni King\'s Feast', 'CAPSTONE: Every kill grants +1 Max HP (up to +40 this run).', s => { s.oniFeast = true; });
// gold
P_('gold_interest', 'gold', 'Compound Interest', pw => `Entering a room grants ${n0(6 * pw)}% of your gold (max 60).`, (s, pw) => { s.interest = 0.06 * pw; });
P_('gold_bounty', 'gold', 'Bounty Hunter', () => 'Elite foes drop 30 extra gold and 2 Spirit Shards.', s => { s.bounty = true; });
P_('gold_jackpot', 'gold', 'Jackpot', pw => `${(Math.min(8, 2.5 * pw)).toFixed(1)}% chance for a hit to deal 5× damage.`, (s, pw) => { s.jackpot = Math.min(0.08, 0.025 * pw); });
P_('gold_magnet', 'gold', 'Coin Magnet', () => 'Coins you pick up heal 1 HP each.', s => { s.coinHeal = true; });
P_('gold_gilded', 'gold', 'Gilded Armor', () => '+1% armor per 100 gold carried (max +12%).', s => { s.gilded = true; });
CAP('gold', 'gold_inari', 'Inari\'s Blessing', 'CAPSTONE: Fortune damage per gold is doubled. +50% gold.', s => { s.inariBless = true; s.gold += 0.5; });
// duos — completing every pair
D_('duo_eclipse', 'fire', 'moon', 'Solar Eclipse', 'Cursing a foe also sets it ablaze.', s => { s.eclipseBurn = true; });
D_('duo_moonstorm', 'thunder', 'moon', 'Moonlit Storm', 'Chain lightning can critically strike.', s => { s.chainCrit = true; });
D_('duo_supercond', 'thunder', 'ice', 'Superconductor', 'Chain lightning Chills, and deals double damage to Frozen foes.', s => { s.superCond = true; });
D_('duo_bloodbolt', 'thunder', 'blood', 'Blood Lightning', 'Each chain lightning jump heals 1 HP.', s => { s.bloodBolt = true; });
D_('duo_electrum', 'thunder', 'gold', 'Electrum', 'Chain lightning jumps may shake loose coins.', s => { s.electrum = true; });
D_('duo_nightgale', 'moon', 'wind', 'Night Gale', 'After dashing, your next hit crits and you move 10% faster.', s => { s.dashCrit = true; s.speed *= 1.1; });
D_('duo_blizwake', 'ice', 'wind', 'Blizzard Wake', 'Dashing leaves frost that Chills foes.', s => { s.blizWake = true; });
D_('duo_frozenassets', 'ice', 'gold', 'Frozen Assets', 'Striking a Frozen foe may shake loose coins.', s => { s.frozenAssets = true; });
D_('duo_crimsongale', 'wind', 'blood', 'Crimson Gale', 'Each dash heals 3 HP.', s => { s.dashHeal += 3; });
D_('duo_goldrush', 'wind', 'gold', 'Gold Rush', '+1% move speed per 50 gold carried (max +20%).', s => { s.goldRush = true; });
D_('duo_bloodmoney', 'blood', 'gold', 'Blood Money', 'Kills heal 1 HP and grant 2 gold.', s => { s.bloodMoney = true; });
for (const b of BOONS) BOON_BY_ID[b.id] = b;

/* ---------------- cursed relics (Campaign II only) ---------------- */
RELICS.push(
  { id: 'c_lantern', camp: 1, name: 'Yomi Lantern', icon: '🪔', desc: 'CURSED: +30% damage, but all healing −40%.', apply: s => { s.dmgAll *= 1.3; s.healMult *= 0.6; } },
  { id: 'c_bowl', camp: 1, name: 'Gaki\'s Bowl', icon: '🥣', desc: 'CURSED: Kills heal 3 HP, but −25 Max HP.', apply: s => { s.feast += 3; s.maxHp -= 25; } },
  { id: 'c_bell', camp: 1, name: 'Drowned Bell', icon: '🛎', desc: 'CURSED: +2 Dash charges, but dashes recharge 45% slower.', apply: s => { s.dash += 2; s.dashCd *= 1.45; } },
  { id: 'c_gear', camp: 1, name: 'Rusted Mainspring', icon: '⚙', desc: 'CURSED: +25% attack speed, but Special cooldown +50%.', apply: s => { s.atkSpeed *= 1.25; s.spCd *= 1.5; } },
  { id: 'c_sun', camp: 1, name: 'Shard of the Black Sun', icon: '🌑', desc: 'CURSED: Ultimate charges 60% faster, but you take 15% more damage.', apply: s => { s.ultGain *= 1.6; s.armor -= 0.15; } },
  { id: 'c_coin', camp: 1, name: 'Ferryman\'s Coin', icon: '🪙', desc: 'CURSED: Once, revive at 60% HP — and lose every coin you carry.', onGain: () => { G.run.ferryCoin = 1; } },
  { id: 'c_comb', camp: 1, name: 'Izanami\'s Comb', icon: '🪮', desc: 'CURSED: +15% critical chance, but −20% Max HP.', apply: s => { s.crit += 0.15; s.maxHp *= 0.8; } },
  { id: 'c_pearl', camp: 1, name: 'Pearl of Tides', icon: '⚪', desc: 'CURSED: +20% armor, but −15% move speed.', apply: s => { s.armor += 0.2; s.speed *= 0.85; } },
);
for (const r of RELICS) RELIC_BY_ID[r.id] = r;

/* ---------------- Campaign II enemies ---------------- */
Object.assign(ENEMIES, {
  // Act I — Yomotsu Hirasaka
  gaki: { name: 'Gaki', ai: 'swarm', hp: 32, spd: 190, dmg: 9, r: 12, cost: 0.6, gold: 1, contact: true, group: 4, draw: 'gaki', col: '#9a8a78', col2: '#ff3d5e', desc: 'Hungry ghosts with needle throats and bottomless bellies. They come in packs and never stop eating.' },
  shikome: { name: 'Shikome', ai: 'twin', hp: 100, spd: 170, dmg: 16, r: 17, cost: 2, gold: 5, range: 85, arc: 1.4, windup: 0.42, cd: 1.1, strikes: 2, draw: 'shikome', col: '#5a4a5a', col2: '#ff3d5e', desc: 'Hags of Yomi who once chased Izanagi to the world\'s edge. They strike twice. Always twice.' },
  onryo: { name: 'Onryō', ai: 'beamer', hp: 88, spd: 90, dmg: 19, r: 16, cost: 2.5, gold: 6, cd: 3.0, draw: 'onryo', col: '#f4f0ee', col2: '#1a1020', fly: true, desc: 'A vengeful spirit. It blinks close and lashes out with a line of black hair.' },
  kumo: { name: 'Tsuchigumo', ai: 'shooter', hp: 74, spd: 120, dmg: 12, r: 18, cost: 2, gold: 5, shots: 3, spread: 0.3, cd: 2.3, pspeed: 300, keep: 300, slowShot: true, draw: 'kumo', col: '#3a2a3a', col2: '#d8d0ff', desc: 'Earth spiders whose webs stick to your feet. Getting slowed in Yomi is how stories end.' },
  higan: { name: 'Higanbana Sprite', ai: 'bomber', hp: 42, spd: 205, dmg: 22, r: 13, cost: 1.5, gold: 3, lingering: true, draw: 'higan', col: '#e0203a', col2: '#ffd0d8', desc: 'Spider lilies bloom on the road to the dead. These ones bloom in your face — and keep burning.' },
  kumoko: { name: 'Spiderling', ai: 'swarm', hp: 16, spd: 200, dmg: 6, r: 9, cost: 0, gold: 0, contact: true, draw: 'kumo', col: '#4a3a4a', col2: '#d8d0ff', desc: 'Jorōgumo\'s children. There are always more.' },
  // Act II — Ryūgū-jō
  isonade: { name: 'Isonade', ai: 'dasher', hp: 125, spd: 150, dmg: 20, r: 19, cost: 3, gold: 7, multi: 3, draw: 'shark', col: '#4a6a8a', col2: '#f0f0f0', desc: 'A shark-yokai with a hooked tail. It charges three times in a row before it tires.' },
  ningyo: { name: 'Ningyo', ai: 'shooter', hp: 92, spd: 110, dmg: 13, r: 17, cost: 2.5, gold: 6, shots: 5, spread: 0.22, cd: 2.6, pspeed: 240, keep: 360, wave: 46, draw: 'ningyo', col: '#7ad7ff', col2: '#ff8fd0', fly: true, desc: 'Mermaids of the drowned palace. Their songs ripple through the water in waves.' },
  umibozu: { name: 'Umibōzu', ai: 'brute', hp: 380, spd: 62, dmg: 30, r: 34, cost: 4.5, gold: 11, slamR: 150, ringShots: 14, draw: 'umibozu', col: '#14222e', col2: '#e8fbff', kbRes: 0.85, desc: 'A sea-giant made of black water. When it slams, the tide comes with it.' },
  kurage: { name: 'Denki Kurage', ai: 'chase', hp: 64, spd: 70, dmg: 14, r: 16, cost: 1.5, gold: 4, contact: true, deathField: true, fly: true, draw: 'jelly', col: '#c8a8ff', col2: '#ffe14d', desc: 'Electric jellyfish. Pop one and the water around it stays charged.' },
  kani: { name: 'Heike Crab Samurai', ai: 'shield', hp: 170, spd: 90, dmg: 20, r: 22, cost: 3, gold: 7, range: 95, arc: 1.4, windup: 0.5, cd: 1.6, draw: 'crab', col: '#c84a2a', col2: '#f2d0a0', kbRes: 0.6, desc: 'The drowned Heike clan reborn as crabs with samurai faces. The shell is unbreakable from the front.' },
  // Act III — Karakuri Fortress
  kninja: { name: 'Karakuri Ninja', ai: 'teleporter', hp: 104, spd: 120, dmg: 15, r: 16, cost: 2.5, gold: 6, cd: 2.2, fan: true, draw: 'kninja', col: '#3a3a44', col2: '#ffb347', desc: 'Clockwork assassins. Puff of smoke, three shuriken, puff of smoke.' },
  turret: { name: 'Ōzutsu Turret', ai: 'turret', hp: 160, spd: 0, dmg: 24, r: 22, cost: 3, gold: 7, cd: 2.6, draw: 'turret', col: '#6a5a3a', col2: '#ff8a3d', kbRes: 1, desc: 'A bolted-down mortar that lobs shells where you are about to be.' },
  steamsam: { name: 'Steam Samurai', ai: 'flamer', hp: 220, spd: 85, dmg: 12, r: 24, cost: 4, gold: 9, draw: 'steamsam', col: '#8a6a3a', col2: '#ffb347', kbRes: 0.6, desc: 'Boilers in armor. Get close and it breathes scalding steam for a long, long time.' },
  gearwheel: { name: 'Runaway Gear', ai: 'ricochet', hp: 120, spd: 260, dmg: 18, r: 18, cost: 2.5, gold: 6, contact: true, draw: 'gear', col: '#b8a06a', col2: '#5a4a2a', kbRes: 0.5, desc: 'A gear that escaped its clock. It bounces off walls and through anything in its path.' },
  chadoll: { name: 'Tea-Serving Doll', ai: 'bomber', hp: 55, spd: 185, dmg: 26, r: 13, cost: 1.5, gold: 3, draw: 'chadoll', col: '#f2e4c8', col2: '#c8302c', desc: 'It offers you tea. The tea is gunpowder.' },
  // Act IV — Throne of the Black Sun
  yata: { name: 'Black Yatagarasu', ai: 'dasher', hp: 115, spd: 170, dmg: 22, r: 16, cost: 2.5, gold: 6, dashSpd: 1300, fly: true, draw: 'crow3', col: '#0a0a12', col2: '#ffcf40', desc: 'Three-legged sun crows, burnt black. They dive like falling stars.' },
  sunpriest: { name: 'Sun-Eater Priest', ai: 'caster', hp: 145, spd: 80, dmg: 20, r: 18, cost: 3.5, gold: 8, keep: 400, fieldCast: true, draw: 'sunpriest', col: '#2a1a0a', col2: '#ffb347', desc: 'Priests who prayed to the eclipse. Where they point, the ground burns for a while.' },
  eclsam: { name: 'Eclipsed Samurai', ai: 'twin', hp: 340, spd: 120, dmg: 30, r: 24, cost: 4.5, gold: 11, range: 115, arc: 1.7, windup: 0.5, cd: 1.5, strikes: 3, draw: 'eclsam', col: '#1a1410', col2: '#ffcf40', kbRes: 0.7, desc: 'Generals of the Black Sun. Three-cut combos, and the third is always the widest.' },
  corona: { name: 'Corona Orb', ai: 'spinner', hp: 200, spd: 55, dmg: 15, r: 22, cost: 3.5, gold: 8, burst: true, fly: true, draw: 'corona', col: '#ffb347', col2: '#1a0a00', desc: 'A drop of the black sun. It pulses out rings of fire.' },
  wanyudo: { name: 'Wanyūdō', ai: 'ricochet', hp: 170, spd: 290, dmg: 24, r: 22, cost: 3.5, gold: 8, contact: true, flameTrail: true, draw: 'wanyudo', col: '#3a2010', col2: '#ff6a3d', kbRes: 0.6, desc: 'A screaming face in a burning ox-cart wheel. It leaves fire wherever it rolls.' },
});

/* ---------------- Campaign II bosses ---------------- */
Object.assign(BOSSES, {
  jorogumo: { id: 'jorogumo', name: 'Jorōgumo', title: 'Silk Empress of Yomi', jp: '黄泉の絹姫 絡新婦', hp: 7200, r: 26, spd: 170, dmg: 22, draw: 'jorogumo', col: '#5a2a6a',
    pal: { hair: '#1a0e24', hair2: '#0a0610', skin: '#f2e4f0', outfit: '#3a1a4a', outfit2: '#1a0a24', eye: '#ff3d8f', accent: '#d8d0ff', scarf: '#ff3d8f', acc2: '#d8d0ff' }, hair: 'hime', acc: 'crown',
    desc: 'A spider who wove the road between the living and the dead. She strings travelers up like pearls.',
    phases: [0.62, 0.3], patterns: [['webShot', 'silkLines', 'pounce', 'spiderlings'], ['webShot', 'silkLines', 'pounce', 'webTrap', 'spiderlings'], ['silkStorm', 'pounce', 'webTrap', 'silkLines', 'spiderlings', 'webShot']] },
  watatsumi: { id: 'watatsumi', name: 'Watatsumi', title: 'The Drowned Dragon King', jp: '溺れた竜王 綿津見', hp: 11000, r: 30, spd: 150, dmg: 26, draw: 'watatsumi', col: '#1a6a8a', kbRes: 1, serpent: true,
    desc: 'King of the undersea palace. The Black Sun boiled his ocean; he wants yours instead.',
    phases: [0.62, 0.3], patterns: [['tidalWave', 'bubblePrison', 'dragonBreath', 'coilCrush'], ['tidalWave', 'whirlpool', 'bubblePrison', 'dragonBreath', 'coilCrush'], ['tsunami', 'whirlpool', 'dragonBreath', 'bubblePrison', 'coilCrush']] },
  tokugane: { id: 'tokugane', name: 'Tokugane', title: 'The Karakuri Shogun', jp: 'からくり将軍 徳鐘', hp: 14000, r: 36, spd: 110, dmg: 28, draw: 'tokugane', col: '#b8902a', kbRes: 1,
    pal: { hair: '#2a2418', hair2: '#14100a', skin: '#c8a868', outfit: '#8a6a2a', outfit2: '#3a2a14', eye: '#ff8a3d', accent: '#ffcf40', scarf: '#c8302c', acc2: '#ffcf40' }, hair: 'short', acc: 'horns',
    desc: 'A clockwork shogun built to rule forever. He has ruled for four hundred years. He is ticking louder.',
    phases: [0.62, 0.3], patterns: [['clockHands', 'gearStorm', 'steamGrid', 'shogunSweep'], ['clockHands', 'gearStorm', 'tickBombs', 'steamGrid', 'shogunSweep'], ['overclock', 'clockHands', 'tickBombs', 'gearStorm', 'steamGrid', 'shogunSweep']] },
  kurohi: { id: 'kurohi', name: 'Kurohi', title: 'The Black Sun', jp: '黒き太陽 黒日', hp: 20000, r: 28, spd: 150, dmg: 30, draw: 'kurohi', col: '#ffb347',
    pal: { hair: '#120a04', hair2: '#060300', skin: '#e8d0b8', outfit: '#1a1008', outfit2: '#0a0604', eye: '#ffcf40', accent: '#ffcf40', scarf: '#ff6a3d', acc2: '#ffcf40' }, hair: 'hime', acc: 'crown',
    desc: 'The Sun herself, eclipsed from within by something that crawled up from Yomi. She burns, and does not know why.',
    desperation: { at: 0.12, pat: 'supernova' },
    phases: [0.66, 0.33], patterns: [['solarFlare', 'sunspots', 'coronaBeams', 'meteorRain'], ['solarFlare', 'sunspots', 'coronaBeams', 'meteorRain', 'crowSwarm', 'blackEclipse'], ['solarFlare', 'coronaBeams', 'meteorRain', 'sunspots', 'crowSwarm', 'blackEclipse']] },
});
Object.assign(CAST, {
  jorogumo: { name: 'Jorōgumo', pal: BOSSES.jorogumo.pal, hair: 'hime', acc: 'crown' },
  watatsumi: { name: 'Watatsumi', pal: { hair: '#9ee7ff', hair2: '#3a8aaa', skin: '#cfe8e0', outfit: '#1a6a8a', outfit2: '#0a3a4a', eye: '#ffe14d', accent: '#ffe14d', scarf: '#49f0ff', acc2: '#ffe14d' }, hair: 'long', acc: 'horns' },
  tokugane: { name: 'Tokugane', pal: BOSSES.tokugane.pal, hair: 'short', acc: 'horns' },
  kurohi: { name: 'Kurohi', pal: BOSSES.kurohi.pal, hair: 'hime', acc: 'crown' },
});

/* ---------------- Campaign II acts ---------------- */
const BIOMES2 = [
  { id: 'yomi', name: 'Yomotsu Hirasaka', jp: '黄泉比良坂', act: 'Act I', floor: '#14101a', floor2: '#1a1422', line: '#2a1a2e', wall: '#050307', accent: '#e0203a', amb: 'lily', music: 'yomi', prop: 'grave', hazard: 'hands',
    pool: { gaki: 4, shikome: 4, onryo: 3, kumo: 3, higan: 3 }, boss: 'jorogumo', tint: 'rgba(200,0,40,0.06)' },
  { id: 'ryugu', name: 'Sunken Ryūgū Palace', jp: '沈める竜宮城', act: 'Act II', floor: '#0a1a24', floor2: '#0e222e', line: '#16384a', wall: '#02080c', accent: '#49f0ff', amb: 'bubble', music: 'ryugu', prop: 'coral', hazard: 'tide',
    pool: { isonade: 3, ningyo: 4, umibozu: 2, kurage: 3, kani: 3 }, boss: 'watatsumi', tint: 'rgba(0,120,200,0.09)' },
  { id: 'karakuri', name: 'Karakuri Fortress', jp: 'からくり城', act: 'Act III', floor: '#1e1810', floor2: '#262014', line: '#3a2e1a', wall: '#0a0804', accent: '#ffb347', amb: 'steam', music: 'karakuri', prop: 'gear', hazard: 'vents',
    pool: { kninja: 4, turret: 2, steamsam: 3, gearwheel: 3, chadoll: 3 }, boss: 'tokugane', tint: 'rgba(255,150,40,0.05)' },
  { id: 'blacksun', name: 'Throne of the Black Sun', jp: '黒日の玉座', act: 'Act IV', floor: '#140a04', floor2: '#1c1006', line: '#3a2008', wall: '#040200', accent: '#ffcf40', amb: 'sunash', music: 'blacksun', prop: 'pyre', hazard: 'flare',
    pool: { yata: 3, sunpriest: 3, eclsam: 3, corona: 2, wanyudo: 3 }, boss: 'kurohi', tint: 'rgba(255,120,0,0.07)' },
];
const CAMPAIGNS = [
  /* gate/gateJp: the menu title · tag: the label above it · warn: the warning box (optional)
     bannerTag: before the act's name on its banner · hudTag: before the act in the HUD · win: the results line for a clear */
  { id: 'moon', name: 'Requiem of the Eighth Moon', jp: '八月の鎮魂歌', acts: BIOMES,
    gate: 'The Torii of Ascent', gateJp: '昇天の鳥居', tag: 'CAMPAIGN I', go: 'Begin Ascent', bannerTag: '', hudTag: '', win: 'Mugen defeated' },
  { id: 'sun', name: 'Requiem of the Black Sun', jp: '黒日の鎮魂歌', acts: BIOMES2, hpMult: 1.25, dmgMult: 1.45, spdMult: 1.1, tempo: 1.15, extraWaves: 1, eliteBonus: 0.15, shardMult: 2,
    gate: 'The Black Torii of Yomi', gateJp: '黄泉の鳥居', tag: 'CAMPAIGN II', cls: 'c2', go: 'Begin Ascent', bannerTag: 'CAMPAIGN II · ', hudTag: 'II · ', win: 'The Black Sun is broken',
    warn: '⚠ Foes have +25% HP, +45% damage and act faster. Extra waves, more elites, and every area has a hazard. Spirit Shards ×2, bosses drop 2 Moon Keys.' },
];
const SEALS = [
  { id: 'jorogumo', name: 'Seal of Silk', hint: 'Defeat Jorōgumo, Silk Empress of Yomi.' },
  { id: 'watatsumi', name: 'Seal of the Tide', hint: 'Defeat Watatsumi, the Drowned Dragon King.' },
  { id: 'tokugane', name: 'Seal of the Clock', hint: 'Defeat Tokugane, the Karakuri Shogun.' },
  { id: 'kurohi', name: 'Seal of Dawn', hint: 'Defeat Kurohi, the Black Sun.' },
];

/* ---------------- Campaign II events ---------------- */
const EVENTS2 = [
  { id: 'sanzu', title: 'The River Sanzu', text: 'Black water separates you from the far bank. An old ferry bobs at the shore, unmanned, with a coin slot.',
    choices: [
      { label: 'Pay the toll (90 gold, heal 25%)', cond: () => G.run.gold >= 90, fn: () => { G.run.gold -= 90; P.heal(P.stats.maxHp * 0.25); return 'The ferry drifts across on its own. You doze, and wake rested.'; } },
      { label: 'Swim (−25% HP, find a cursed relic)', cond: () => P.hp > P.stats.maxHp * 0.3, fn: () => { P.hurtRaw(Math.round(P.stats.maxHp * 0.25)); G.giveRelic(null, true); return 'Hands drag at your ankles. You surface clutching something you did not take.'; } },
    ] },
  { id: 'peach', title: 'The Peach Tree of Izanagi', text: 'A single tree heavy with glowing peaches. Izanagi threw peaches at the hags of Yomi to escape them. These still remember.',
    choices: [
      { label: 'Eat a peach (heal 40%)', fn: () => { P.heal(P.stats.maxHp * 0.4); return 'Sweet beyond reason. The dark recoils from you a little.'; } },
      { label: 'Hurl a peach into the dark (+1 Moon Key, −20 HP)', fn: () => { P.hurtRaw(20); G.addKeys(1); return 'Something shrieks in the dark and flees, dropping a Moon Key. It bit you on the way out.'; } },
    ] },
  { id: 'tamatebako', title: 'Otohime\'s Jeweled Box', text: 'A lacquered box with a silk cord. Urashima Tarō opened one and aged three hundred years. It hums.',
    choices: [
      { label: 'Open it', fn: () => { if (Math.random() < 0.5) { G.offerBoons(null, { minRarity: 2 }); return 'Light pours out — not age, but power. A Kami steps from the smoke.'; } G.run.bonusHp -= Math.round(P.stats.maxHp * 0.25); P.recompute(); return 'White smoke. Your hands look older. (−25% Max HP)'; } },
      { label: 'Leave it sealed (+40 Spirit Shards)', fn: () => { G.addShards(40); return 'You bow and leave it be. The box seems almost disappointed.'; } },
    ] },
  { id: 'teadoll', title: 'A Kindly Automaton', text: 'A tea-serving karakuri doll trundles up, holding a steaming cup. Its gears click politely. It does not appear to be full of gunpowder.',
    choices: [
      { label: 'Accept the tea (+8% damage this run)', fn: () => { G.run.bonusDmg += 0.08; P.recompute(); return 'It is genuinely excellent tea. You feel focused.'; } },
      { label: 'Dismantle it (+110 gold)', fn: () => { G.addGold(110); return 'It keeps bowing as you take it apart. You feel slightly terrible.'; } },
    ] },
  { id: 'crow', title: 'The Yatagarasu Oracle', text: 'A three-legged crow — still golden, somehow — perches on a broken torii. "Blood for sight, Moonbound."',
    choices: [
      { label: 'Offer blood (−15% HP, upgrade a boon\'s rarity)', fn: () => { P.hurtRaw(Math.round(P.stats.maxHp * 0.15)); G.upgradeRarity(); return 'The crow drinks. Something you carry burns brighter.'; } },
      { label: 'Ask for guidance (+2 rerolls)', fn: () => { G.run.rerolls += 2; return '"Every path ends at the Sun. Choose the one you can survive."'; } },
    ] },
];

/* ---------------- Campaign II story ---------------- */
const STORY2 = {
  intro: [
    ['hanabi', 'Akane. Wake up. Something\'s wrong with the sky.'],
    ['narrator', 'At noon, the sun turns black. Not eclipsed — black, from the inside, like a burnt coal still burning.'],
    ['hanabi', 'The road to Yomi has opened behind the shrine. The land of the dead. That\'s where the darkness is coming from.'],
    ['sanzu', '...Passengers. It has been a long time since anyone living walked to my river.'],
    ['hanabi', 'Sanzu! The Ferryman! You\'re supposed to be a myth!', 'happy'],
    ['sanzu', 'I am a myth, fox. Myths are very busy this week. Something from Yomi has crawled into the Sun and is wearing her like a mask.'],
    ['sanzu', 'The road down is cruel. Yomi\'s creatures do not forget like the Hollow. They remember every way to kill you.'],
    ['$hero', 'Then I\'ll make them remember me too.'],
    ['sanzu', 'Hm. Take the black torii when you are ready. I will be waiting at the bottom. I always am.'],
  ],
  ending: [
    ['narrator', 'Kurohi falls to her knees. The black crust on her halo cracks — and gold light pours out through the fissures.'],
    ['kurohi', '...It was so cold inside. Something from below wrapped around my heart and called itself the Sun.'],
    ['kurohi', 'You are the moon-child. The one who never stays dead. ...Thank you for being so stubborn.'],
    ['narrator', 'The black shell shatters. Light floods back across Yomi, the drowned palace, the clockwork fortress, the shrine.'],
    ['sanzu', 'The river runs clear again. Even the dead are squinting.'],
    ['hanabi', 'Two skies saved! Two! Do you know how many fox spirits can say that?', 'happy'],
    ['hanabi', '...None. The answer is none. I\'m putting it on a banner.'],
    ['narrator', 'REQUIEM OF THE BLACK SUN — COMPLETE. The road to Yomi remains open, for those who want to walk it again.'],
  ],
};
Object.assign(TALKS, {
  sanzu: [
    { id: 'z1', cond: () => true, lines: [['sanzu', 'Every soul pays the river. Gold, memory, or blood. The road down is the same.'], ['sanzu', 'Yomi\'s creatures are stronger than anything you met beneath the moon. Bring your best self. Then bring a better one.']] },
    { id: 'z2', cond: s => (s.bossKills.jorogumo || 0) >= 1, lines: [['sanzu', 'The silk empress fell. Her children will mourn her for nine nights and then forget. Spiders are practical.']] },
    { id: 'z3', cond: s => (s.bossKills.watatsumi || 0) >= 1, lines: [['sanzu', 'You fought the Dragon King. In my youth he gave me a ride across the sea on his back. He was gentler then.']] },
    { id: 'z4', cond: s => (s.bossKills.tokugane || 0) >= 1, lines: [['sanzu', 'The shogun\'s clock stopped. Four hundred years of ticking. The silence must be strange for him.']] },
    { id: 'z5', cond: s => s.flags.sunEnd, lines: [['sanzu', 'The Sun shines and the dead squint. You have done something no one in Yomi thought possible.'], ['sanzu', 'The road stays open. Some people walk it for the challenge. I will keep the lantern lit.']] },
  ],
  sanzu_idle: [[['sanzu', 'Cursed relics are only found below. Strong, and they cost you. Everything in Yomi costs you.']], [['sanzu', 'The fox spirit tried to pay my toll in fried tofu. I accepted. Do not tell anyone.']], [['sanzu', 'Down there, enemies hit harder and the rooms fight back. Listen for the hazards.']]],
  isamu: [
    { id: 'i1', cond: () => true, lines: [['isamu', 'Isamu Nitenji. I trained on Mount Ninten until the moon broke and the monastery forgot its own name.'], ['isamu', 'One blade is a tool. Two blades are a conversation. And when the conversation runs long — I pray.'], ['$hero', 'Does praying help?'], ['isamu', 'It makes my arms faster. The gods and I have an understanding.', 'happy']] },
    { id: 'i2', cond: s => s.heroes.tetsu && s.heroes.tetsu.unlocked, lines: [['isamu', 'The godless ronin mocks my prayers. I let him. Then I spar him and pray during.'], ['isamu', 'He has not won yet.', 'happy']] },
  ],
  isamu_idle: [[['isamu', 'Short, long, short, long — then cut. The rhythm is the technique.']], [['isamu', 'The Hurricane moves with you. Walk into them while you spin.']]],
  hibiki: [
    { id: 'hi1', cond: () => true, lines: [['hibiki', 'DON! KA! DON-DON! Hiya! I\'m Hibiki! I was the lead drummer of the Yomi Gate Festival!', 'happy'], ['hibiki', 'Jorōgumo strung up the whole troupe. I drummed so hard her web snapped. Now I want to drum on the Black Sun.'], ['hibiki', 'When the ring closes — hit it! Miss and I\'ll be very sad. Hit and everything around us explodes. It\'s a good deal!']] },
    { id: 'hi2', cond: s => (s.clearsByHero.hibiki || 0) >= 1, lines: [['hibiki', 'Full combo on the final boss! Ponta wants to make my rhythm into a festival game.', 'happy']] },
  ],
  hibiki_idle: [[['hibiki', 'Don\'t hold the button — tap it! On the beat! Like a heartbeat!']], [['hibiki', 'Rei tried my bachi. He hit himself in the face. Twice.']]],
  rinne: [
    { id: 'ri1', cond: () => true, lines: [['rinne', 'You broke the shogun\'s clock. I was the mirror he used to admire himself in, for four hundred years.'], ['rinne', 'I learned everything about violence by reflecting it. I never strike first. I do not need to.'], ['rinne', 'Raise the mirror when they swing. Not before. Not after. Exactly then.']] },
    { id: 'ri2', cond: s => (s.clearsByHero.rinne || 0) >= 1, lines: [['rinne', 'The Black Sun\'s fire, reflected back at her. Poetic. I did not think I would enjoy poetry.']] },
  ],
  rinne_idle: [[['rinne', 'Bosses telegraph everything. The red on the ground is their honesty. Meet it with yours.']], [['rinne', 'Projectiles come back twice as hard. Archers are my favorite.']]],
});
TALKS.hanabi.push(
  { id: 'h_yomi', cond: s => s.fragments.includes('first_clear'), lines: [['hanabi', 'Hey... Do you see that? The sun flickered. Just for a second. Like someone blinked inside it.'], ['hanabi', 'There\'s a black torii behind the shrine that wasn\'t there yesterday. I don\'t like it. I really don\'t like it.']] },
  { id: 'h_sun', cond: s => s.flags.sunEnd, lines: [['hanabi', 'Sun\'s back! Moon\'s back! Can we have ONE normal week now?', 'happy']] },
);
Object.assign(BOSS_TALK, {
  jorogumo: [
    [['jorogumo', 'A living soul on my road... how delicious. Do you know how long it has been since anyone struggled?'], ['jorogumo', 'Struggle for me, darling. It makes the silk sing.']],
    [['jorogumo', 'You came back. You actually came back down here. You poor, beautiful fool.']],
    [['jorogumo', 'Every thread in Yomi trembles when you walk. Even the dead are watching you now.']],
  ],
  jorogumo_defeat: [[['jorogumo', 'Ahh... my threads... cut so cleanly...'], ['narrator', 'The webs across the road go slack. Somewhere above, a festival drum begins to play.']], [['jorogumo', 'Again you tear my silk... I will weave it again. I always do.']]],
  watatsumi: [
    [['watatsumi', 'WHO DARES SWIM IN MY PALACE?! The sun boiled my sea! The sun took my pearls! The sun TAKES and TAKES!'], ['$hero', 'The sun\'s been taken over. I\'m going to free her.'], ['watatsumi', 'THEN DROWN AND PROVE YOUR WORTH!', 'angry']],
    [['watatsumi', 'The little moon swims down again. Do you not tire of the water in your lungs?']],
    [['watatsumi', 'You fight like the tide. Persistent. Infuriating. ...Admirable.']],
  ],
  watatsumi_defeat: [[['watatsumi', 'Enough... enough... the tide recedes. Go. Free her. Bring back my sea.']], [['watatsumi', 'Again... the waters... yield...']]],
  tokugane: [
    [['tokugane', 'TICK. TOCK. YOU ARE. EARLY. NO ONE IS EVER EARLY TO MY FORTRESS.'], ['tokugane', 'I HAVE RULED FOR FOUR HUNDRED YEARS. I WILL RULE FOR FOUR HUNDRED MORE. YOUR TIME. IS UP.']],
    [['tokugane', 'YOU. AGAIN. RECALCULATING. RECALCULATING. TOLERANCE EXCEEDED.']],
    [['tokugane', 'My mirror-maiden has left me. Do you know how quiet four hundred years of ticking becomes? ...TICK.']],
  ],
  tokugane_defeat: [[['tokugane', 'The... spring... unwinds... finally... I can... rest...'], ['narrator', 'A small hand mirror rolls out of the shogun\'s broken chest. It is warm.']], [['tokugane', 'REWINDING. SEE YOU. NEXT CYCLE.']]],
  kurohi: [
    [['kurohi', 'Moon-child. You smell of night and memory. I will burn both out of you.'], ['$hero', 'You\'re not the Sun. Let her go.'], ['kurohi', 'I AM THE SUN NOW. AND THE SUN DOES NOT BEG.', 'angry']],
    [['kurohi', 'Still you climb toward me. Like a moth. Moths always burn, little moon.']],
    [['kurohi', 'There is a voice inside me that keeps whispering your name. Make it stop.']],
  ],
  kurohi_defeat: [[['kurohi', 'The light... it\'s coming back... it hurts... it\'s wonderful...']], [['kurohi', 'Again, the dawn. You are a very stubborn dawn, moon-child.']]],
});
LORE.push(
  { id: 'l_yomi', title: 'Yomi, Land of the Dead', cond: s => s.bossKills.jorogumo >= 1, text: 'Izanagi descended to bring back his wife Izanami and fled in horror, sealing the road with a boulder. The boulder has been moved.' },
  { id: 'l_ryugu', title: 'The Dragon Palace', cond: s => s.bossKills.watatsumi >= 1, text: 'Ryūgū-jō, the palace beneath the waves where a day lasts a century. Its king grew bitter when the Black Sun boiled his sea.' },
  { id: 'l_karakuri', title: 'The Karakuri Shogunate', cond: s => s.bossKills.tokugane >= 1, text: 'A shogun who replaced his own heart with a mainspring so he would never die. He never did. He only ran down.' },
  { id: 'l_kurohi', title: 'The Black Sun', cond: s => s.flags.sunEnd, text: 'Something old from the deepest pit of Yomi wrapped itself around the Sun\'s heart. Her name was never Kurohi. She just could not remember the real one.' },
);

/* =====================================================================
   UPDATE 3 — "Wrath of the Gods" (final campaign of Arc I)
   Seven god-heroes, two rift newcomers, corrupted god bosses,
   Ōmagatsuhi, Godsparks, story and the end of the arc.
   ===================================================================== */
function corruptPal(p) {
  return Object.assign({}, p, { outfit: shade(p.outfit, -0.45), outfit2: '#0a0610', hair2: shade(p.hair2, -0.5), eye: '#ff2e63', scarf: '#5b2b8a', accent: shade(p.accent, -0.3) });
}

/* ---------------- the seven god-heroes ---------------- */
Object.assign(HEROES, {
  hinome: {
    id: 'hinome', kami: 'fire', name: 'Hinome', jp: '日の芽', title: 'Kami of the Burning Dawn', weapon: 'Sun Naginata — Asahi',
    desc: 'The dawn herself, freed from the Calamity. Wide burning sweeps and a body that becomes the morning sun.',
    pal: { hair: '#ffb04d', hair2: '#e0602a', skin: '#fff0e0', outfit: '#c8302c', outfit2: '#6a1410', eye: '#ffcf40', accent: '#ffe9a0', scarf: '#ff7a3d', acc2: '#ffcf40' },
    hair: 'long', acc: 'crown', base: { maxHp: 100, speed: 300 },
    specialName: 'Sunflare', specialCd: 3.0, ultName: 'Daybreak', ultJp: '夜明け', ultSub: 'Daybreak',
    controls: 'LMB 3-hit naginata sweeps that ignite · RMB ring of sunfire around you · Q become the sun: 4s burning aura, then a nova',
    forms: [
      { name: 'Form of Asahi', desc: 'The rising sun.', cost: 0, apply() {} },
      { name: 'Form of the Morning Star', desc: '+12% move speed. Dashing leaves embers.', cost: 2, apply(s) { s.speed *= 1.12; s.emberTrail = Math.max(s.emberTrail || 0, 1); } },
      { name: 'Form of High Noon', desc: 'Sunflare fires twice as many orbs. Special cooldown +1.2s.', cost: 3, apply(s) { s.highNoon = true; s.spCdAdd += 1.2; } },
    ],
    attack(p) {
      const i = p.combo % 3;
      p.lunge(i === 2 ? 200 : 100);
      G.swing(p, { r: 114, arc: 2.3, dmg: [17, 17, 32][i], slot: 'attack', kb: i === 2 ? 300 : 130, color: '#ff7a3d', dir: i % 2 ? -1 : 1, width: i === 2 ? 1.3 : 1, el: { k: 'fire', pw: 0.5 } });
      SFX.play(i === 2 ? 'heavy' : 'slash'); p.combo = (i + 1) % 3;
      return (i === 2 ? 0.46 : 0.27) / p.stats.atkSpeed;
    },
    special(p) {
      const n = p.stats.highNoon ? 20 : 10, o = rand(0, TAU);
      for (let i = 0; i < n; i++) G.pProj({ x: p.x, y: p.y - 18, ang: o + i * TAU / n, speed: 520, dmg: 15, slot: 'special', r: 11, life: 0.6, kind: 'orb', color: '#ff7a3d', pierce: 1, kb: 90 });
      G.hitCircle(p.x, p.y, 95, 20, { slot: 'special', kb: 220 }); G.fxRing(p.x, p.y, 95, '#ffb347', 0.3, 10); SFX.play('burn');
    },
    ult(p) {
      const S = p.stats; p.invuln = 0.8; p.auraT = 4;
      for (let i = 0; i < 16; i++) G.pAfter(i * 0.25, () => { for (const e of G.enemiesInRange(p.x, p.y, 175)) { G.damageEnemy(e, 11 * S.ult, { slot: 'ult', kb: 40 }); G.burn(e, 6); } });
      G.pAfter(4.0, () => { G.hitCircle(p.x, p.y, 300, 120 * S.ult, { slot: 'ult', kb: 500, stun: 0.6 }); G.fxRing(p.x, p.y, 300, '#ffcf40', 0.5, 18); G.flash('#ffe9a0', 0.5); G.shake(14); SFX.play('boom'); });
    },
    drawWeapon(ctx, p, x, y, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.strokeStyle = '#7a3a1a'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(40, 0); ctx.stroke();
      ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.moveTo(40, -3); ctx.quadraticCurveTo(58, -6, 66, 2); ctx.lineTo(40, 4); ctx.fill();
      ctx.fillStyle = '#ff7a3d'; circ(ctx, 38, 0, 4);
      ctx.restore();
      if (p.auraT > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,170,60,${0.18 + Math.sin(p.t * 20) * 0.05})`; circ(ctx, p.x, p.y - 20, 175); ctx.restore(); }
    }
  },
  raika: {
    id: 'raika', kami: 'thunder', name: 'Raika', jp: '雷火', title: 'Kami of the Storm Drum', weapon: 'Thunder Spear — Ikazuchi',
    desc: 'The storm drummer, freed. Lightning-fast spear thrusts, a javelin that chains, and a step that rides the lightning.',
    pal: { hair: '#3a3a5a', hair2: '#1a1a2a', skin: '#f2d8c0', outfit: '#2a3a8a', outfit2: '#14204a', eye: '#ffe14d', accent: '#ffe14d', scarf: '#ffe14d' },
    hair: 'wild', acc: 'headband', base: { maxHp: 100, speed: 310 },
    specialName: 'Thunder Step', specialCd: 3.2, ultName: 'Storm Drum', ultJp: '雷太鼓', ultSub: 'Storm Drum',
    controls: 'LMB 3 spear thrusts then a chaining javelin · RMB teleport toward the cursor with lightning at both ends · Q drum 14 bolts onto foes',
    forms: [
      { name: 'Form of Ikazuchi', desc: 'The spear of the first storm.', cost: 0, apply() {} },
      { name: 'Form of the Rolling Thunder', desc: 'Javelin every 3rd strike instead of 4th. Thrust damage −15%.', cost: 2, apply(s) { s.rolling = true; } },
      { name: 'Form of the Raging Sky', desc: 'Storm Drum calls 50% more bolts. Thunder Step cooldown +1.5s.', cost: 3, apply(s) { s.ragingSky = true; s.spCdAdd += 1.5; } },
    ],
    attack(p) {
      const S = p.stats, n = S.rolling ? 3 : 4, i = p.combo % n, a = p.aim;
      if (i === n - 1) {
        G.pProj({ x: p.x, y: p.y - 18, ang: a, speed: 950, dmg: 26, slot: 'attack', r: 10, pierce: 3, life: 0.6, kind: 'needle', color: '#ffe14d', kb: 120, el: { k: 'thunder', pw: 0.6 } });
        SFX.play('thunder', 0.5); p.combo = 0; return 0.32 / S.atkSpeed;
      }
      p.lunge(90);
      const x2 = p.x + Math.cos(a) * 125, y2 = p.y + Math.sin(a) * 125;
      G.hitLine(p.x, p.y, x2, y2, 42, 13 * (S.rolling ? 0.85 : 1), { slot: 'attack', kb: 90 });
      G.fxLine(p.x, p.y, x2, y2, '#ffe14d', 8, 0.12); SFX.play('slash', 0.6);
      p.combo = i + 1; p.swingT = p.swingDur = 0.1; p.swingFrom = a; p.swingTo = a;
      return 0.15 / S.atkSpeed;
    },
    special(p) {
      const x1 = p.x, y1 = p.y, d = Math.min(300, Math.hypot(Input.mouse.wx - p.x, Input.mouse.wy - p.y));
      G.moveSafe(p, Math.cos(p.aim) * d, Math.sin(p.aim) * d); p.iframes = Math.max(p.iframes, 0.3);
      for (const [x, y] of [[x1, y1], [p.x, p.y]]) { G.fxBolt(x, y - 500, x, y); G.hitCircle(x, y, 100, 36, { slot: 'special', kb: 200, stun: 0.3 }); }
      G.fxLine(x1, y1, p.x, p.y, '#ffe14d', 10, 0.25); SFX.play('thunder');
    },
    ult(p) {
      const S = p.stats, n = S.ragingSky ? 21 : 14;
      for (let i = 0; i < n; i++) G.pAfter(0.15 + i * 0.2, () => {
        const live = G.enemiesInRange(p.x, p.y, 900); const e = live.length ? pick(live) : null;
        const x = e ? e.x : p.x + rand(-300, 300), y = e ? e.y : p.y + rand(-200, 200);
        G.fxBolt(x + rand(-30, 30), y - 520, x, y - 10, '#ffe14d'); G.hitCircle(x, y, 80, 32 * S.ult, { slot: 'ult', kb: 100, stun: 0.3 }); SFX.play('thunder', 0.6);
      });
      p.invuln = 0.6; SFX.play('don');
    },
    drawWeapon(ctx, p, x, y, a) {
      ctx.save(); ctx.strokeStyle = '#c9a36b'; ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) { const oa = i * TAU / 6 + p.t; ctx.fillStyle = '#5a3a1a'; circ(ctx, p.x + Math.cos(oa) * 22, p.y - 38 + Math.sin(oa) * 8, 4.5); }
      ctx.restore();
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(44, 0); ctx.stroke();
      ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.moveTo(44, -4); ctx.lineTo(62, 0); ctx.lineTo(44, 4); ctx.lineTo(48, 0); ctx.fill();
      ctx.restore();
    }
  },
  tsukiyo: {
    id: 'tsukiyo', kami: 'moon', name: 'Tsukiyo', jp: '月夜', title: 'Kami of the Silver Night', weapon: 'Crescent Chakram — Yoizuki',
    desc: 'Sister of the Eighth Moon. Throws a returning crescent, vanishes into shadow, and drops the moon itself.',
    pal: { hair: '#d8d0ff', hair2: '#8a7ac8', skin: '#f6f0ff', outfit: '#2a2050', outfit2: '#140f28', eye: '#b49cff', accent: '#e8e0ff', scarf: '#b49cff', acc2: '#e8e0ff' },
    hair: 'hime', acc: 'crown', base: { maxHp: 95, speed: 305 },
    specialName: 'New Moon', specialCd: 4.0, ultName: 'Moonfall', ultJp: '月墜', ultSub: 'Moonfall',
    controls: 'LMB throw a returning crescent (hits going out and coming back) · RMB vanish: briefly untouchable, next 3 attacks crit · Q drop the moon on the cursor',
    forms: [
      { name: 'Form of Yoizuki', desc: 'The evening moon.', cost: 0, apply() {} },
      { name: 'Form of the Waning Moon', desc: 'Throw two smaller crescents at once, −35% damage each.', cost: 2, apply(s) { s.waning = true; } },
      { name: 'Form of the Harvest Moon', desc: 'Critical hits heal 1 HP. −15 Max HP.', cost: 3, apply(s) { s.critHeal += 1; s.maxHp -= 15; } },
    ],
    attack(p) {
      const S = p.stats, offs = S.waning ? [-0.18, 0.18] : [0];
      for (const o of offs) G.pProj({ x: p.x, y: p.y - 18, ang: p.aim + o, speed: 780, dmg: 13 * (S.waning ? 0.65 : 1), slot: 'attack', r: S.waning ? 14 : 18, pierce: 99, life: 1.6, kind: 'chakram', color: '#b49cff', returning: 230, kb: 60 });
      SFX.play('slash', 0.6);
      return 0.3 / S.atkSpeed;
    },
    special(p) {
      p.invuln = Math.max(p.invuln, 0.8); p.critCharges = 3;
      G.parts.burst(p.x, p.y - 20, 24, { type: 'smoke', color: '#2a2050', min: 40, max: 160, size: 6 });
      G.text(p.x, p.y - 70, '新月', '#b49cff', 20); SFX.play('dash');
    },
    ult(p) {
      const S = p.stats, d = Math.min(450, Math.hypot(Input.mouse.wx - p.x, Input.mouse.wy - p.y));
      const x = p.x + Math.cos(p.aim) * d, y = p.y + Math.sin(p.aim) * d;
      p.invuln = 0.6;
      G.pZone({ x, y, r: 220, warn: 0.85, dmg: 160 * S.ult, slot: 'ult', color: '#e8e0ff', kind: 'moonfall',
        onFire: z => { for (const e of G.enemiesInRange(z.x, z.y, z.r)) e.st.curse = 6; G.flash('#e8e0ff', 0.5); G.shake(16); SFX.play('boom'); G.fxRing(z.x, z.y, z.r, '#b49cff', 0.5, 16); } });
    },
    drawWeapon(ctx, p, x, y, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = '#efe8ff'; ctx.beginPath(); ctx.arc(14, 0, 14, -1.2, 1.2); ctx.arc(10, 0, 11, 1.1, -1.1, true); ctx.fill();
      ctx.restore();
    }
  },
  mizuha: {
    id: 'mizuha', kami: 'ice', name: 'Mizuha', jp: '水波', title: 'Kami of Still Waters', weapon: 'Water Whip — Seiryū',
    desc: 'The river that remembers every face. A long whip of water, a crashing tide, and the stillness that freezes all things.',
    pal: { hair: '#3ab0d8', hair2: '#1a6a8a', skin: '#eaf6f6', outfit: '#e8f4ff', outfit2: '#5aa8c8', eye: '#6ee7ff', accent: '#ffffff', scarf: '#6ee7ff' },
    hair: 'long', acc: 'ribbon', base: { maxHp: 105, speed: 295 },
    specialName: 'Tidal Wave', specialCd: 3.4, ultName: 'Still Waters', ultJp: '明鏡止水', ultSub: 'Still Waters',
    controls: 'LMB long chilling water-whip lashes, every 3rd a wide sweep · RMB a crashing wave that shoves and chills · Q freeze every foe nearby and heal',
    forms: [
      { name: 'Form of Seiryū', desc: 'The clear stream.', cost: 0, apply() {} },
      { name: 'Form of the Spring Rain', desc: 'Every 4th whip hit heals 1 HP.', cost: 2, apply(s) { s.springRain = true; } },
      { name: 'Form of the Glacier', desc: 'Whip reach +30%. Attack speed −15%.', cost: 3, apply(s) { s.glacier = true; s.atkSpeed *= 0.85; } },
    ],
    attack(p) {
      const S = p.stats, i = p.combo % 3, a = p.aim;
      if (i === 2) {
        G.swing(p, { r: 150 * (S.glacier ? 1.3 : 1), arc: 2.4, dmg: 32, slot: 'attack', kb: 200, color: '#6ee7ff', dir: 1, width: 1.1, el: { k: 'ice', pw: 0.5 } });
        SFX.play('splash', 0.6); p.combo = 0; return 0.42 / S.atkSpeed;
      }
      const L = 168 * (S.glacier ? 1.3 : 1), x2 = p.x + Math.cos(a) * L, y2 = p.y + Math.sin(a) * L;
      const n = G.hitLine(p.x, p.y, x2, y2, 40, 21, { slot: 'attack', kb: 80, el: { k: 'ice', pw: 0.5 } });
      if (S.springRain && n) { p.rainHits = (p.rainHits || 0) + n; if (p.rainHits >= 4) { p.rainHits = 0; p.heal(1, true); } }
      G.fxLine(p.x, p.y, x2, y2, '#6ee7ff', 9, 0.18); SFX.play('slash', 0.5);
      p.combo = i + 1; p.swingT = p.swingDur = 0.14; p.swingFrom = a - 0.5; p.swingTo = a + 0.3;
      return 0.24 / S.atkSpeed;
    },
    special(p) {
      const a = p.aim, x2 = p.x + Math.cos(a) * 380, y2 = p.y + Math.sin(a) * 380;
      G.hitLine(p.x, p.y, x2, y2, 130, 34, { slot: 'special', kb: 420, el: { k: 'ice', pw: 1 } });
      G.fxLine(p.x, p.y, x2, y2, '#6ee7ff', 70, 0.4); G.fxLine(p.x, p.y, x2, y2, '#ffffff', 20, 0.4);
      for (let k = 0; k < 10; k++) G.parts.burst(lerp(p.x, x2, k / 10), lerp(p.y, y2, k / 10), 3, { color: '#bfefff', min: 60, max: 220 });
      SFX.play('splash');
    },
    ult(p) {
      const S = p.stats; p.invuln = 0.6;
      for (const e of G.enemiesInRange(p.x, p.y, 700)) { G.damageEnemy(e, 60 * S.ult, { slot: 'ult', kb: 0 }); if (!e.dead) e.st.freeze = Math.max(e.st.freeze, e.isBoss ? 1 : 3.5); }
      p.heal(S.maxHp * 0.15); G.fxRing(p.x, p.y, 700, '#e8fbff', 0.6, 24); G.flash('#e8fbff', 0.5); SFX.play('freeze'); SFX.play('bell');
    },
    drawWeapon(ctx, p, x, y, a) {
      ctx.save(); ctx.strokeStyle = 'rgba(110,231,255,.85)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let i = 1; i <= 6; i++) ctx.lineTo(x + Math.cos(a) * i * 7 + Math.sin(p.t * 8 + i) * 3, y + Math.sin(a) * i * 7 + Math.cos(p.t * 8 + i) * 3);
      ctx.stroke(); ctx.restore();
    }
  },
  kazane: {
    id: 'kazane', kami: 'wind', name: 'Kazane', jp: '風音', title: 'Kami of the Wandering Wind', weapon: 'Wind Blades — Hayate',
    desc: 'Never stays still. A stream of wind blades, a triple-step dance, and a typhoon on a leash.',
    pal: { hair: '#7dffb0', hair2: '#2a9a6a', skin: '#fdf0e6', outfit: '#f2f2e8', outfit2: '#3a7a5a', eye: '#2affc0', accent: '#7dffb0', scarf: '#7dffb0' },
    hair: 'twin', acc: 'ribbon', base: { maxHp: 90, speed: 330 },
    specialName: 'Gale Dance', specialCd: 3.0, ultName: 'Typhoon', ultJp: '台風', ultSub: 'Typhoon on a Leash',
    controls: 'LMB rapid short-range wind blades · RMB three quick slicing steps toward the cursor · Q a typhoon follows your cursor for 5s, dragging foes in',
    forms: [
      { name: 'Form of Hayate', desc: 'The swift wind.', cost: 0, apply() {} },
      { name: 'Form of the Zephyr', desc: '+1 Dash. Gale Dance cooldown +0.8s.', cost: 2, apply(s) { s.dash += 1; s.spCdAdd += 0.8; } },
      { name: 'Form of the Squall', desc: 'Blades split in three, −45% damage each.', cost: 3, apply(s) { s.squall = true; } },
    ],
    attack(p) {
      const S = p.stats, offs = S.squall ? [-0.25, 0, 0.25] : [0];
      for (const o of offs) G.pProj({ x: p.x, y: p.y - 18, ang: p.aim + o + rand(-0.06, 0.06), speed: 920, dmg: 11 * (S.squall ? 0.55 : 1), slot: 'attack', r: 13, pierce: 1, life: 0.33, kind: 'wblade', color: '#7dffb0', kb: 50 });
      SFX.play('dash', 0.25);
      return 0.14 / S.atkSpeed;
    },
    special(p) {
      p.invuln = Math.max(p.invuln, 0.5);
      for (let k = 0; k < 3; k++) G.pAfter(k * 0.12, () => {
        const x1 = p.x, y1 = p.y; G.moveSafe(p, Math.cos(p.aim) * 125, Math.sin(p.aim) * 125);
        G.hitLine(x1, y1, p.x, p.y, 60, 26, { slot: 'special', kb: 140 }); G.fxLine(x1, y1, p.x, p.y, '#7dffb0', 14, 0.25); G.ghost(p, x1, y1, 0.25); SFX.play('slash', 0.6);
      });
    },
    ult(p) {
      const S = p.stats;
      p.typhoon = { x: p.x, y: p.y, t: 5 }; p.invuln = 0.6; SFX.play('ult', 0.4);
      for (let i = 0; i < 25; i++) G.pAfter(i * 0.2, () => {
        const ty = p.typhoon; if (!ty) return;
        const a = Math.atan2(Input.mouse.wy - ty.y, Input.mouse.wx - ty.x), d = Math.min(60, Math.hypot(Input.mouse.wx - ty.x, Input.mouse.wy - ty.y));
        ty.x += Math.cos(a) * d; ty.y += Math.sin(a) * d;
        for (const e of G.enemiesInRange(ty.x, ty.y, 220)) { if (!e.isBoss) { const pa = angTo(e, ty); e.vx += Math.cos(pa) * 160; e.vy += Math.sin(pa) * 160; } }
        G.hitCircle(ty.x, ty.y, 125, 10 * S.ult, { slot: 'ult', kb: 0, quiet: true });
        if (i === 24) p.typhoon = null;
      });
    },
    drawWeapon(ctx, p, x, y, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = '#dff8ec'; ctx.beginPath(); ctx.moveTo(4, -2); ctx.lineTo(26, -6); ctx.lineTo(30, 0); ctx.lineTo(26, 6); ctx.lineTo(4, 2); ctx.fill();
      ctx.restore();
      if (p.typhoon) {
        const ty = p.typhoon; ctx.save(); ctx.strokeStyle = 'rgba(125,255,176,.6)'; ctx.lineWidth = 4;
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(ty.x, ty.y - 40 - i * 18, 30 + i * 20, 10 + i * 5, 0, p.t * 12 + i, p.t * 12 + i + 4.5); ctx.stroke(); }
        ctx.restore();
      }
    }
  },
  shuten: {
    id: 'shuten', kami: 'blood', name: 'Shuten', jp: '酒呑', title: 'Oni-King of Crimson Sake', weapon: 'Kanabō & Gourd — Ōeyama',
    desc: 'The drunkard king of the oni. Enormous club swings, a breath of burning sake, and a feast that heals him with every blow.',
    pal: { hair: '#e8e0d0', hair2: '#9a9288', skin: '#e86a5a', outfit: '#3a1a1a', outfit2: '#1a0a0a', eye: '#ffcf40', accent: '#ffcf40', scarf: '#c8302c', acc2: '#f4e4c1' },
    hair: 'wild', acc: 'horns', size: 15, base: { maxHp: 140, speed: 270 },
    specialName: 'Sake Breath', specialCd: 3.6, ultName: 'Oni King\'s Feast', ultJp: '鬼王の宴', ultSub: 'Oni King\'s Feast',
    controls: 'LMB two huge club swings that stun · RMB drink, then breathe burning sake forward · Q 7s feast: +25% damage, heal 8% of damage dealt',
    forms: [
      { name: 'Form of Ōeyama', desc: 'The mountain of the oni.', cost: 0, apply() {} },
      { name: 'Form of the Drunken Master', desc: '+1 Dash, +10% attack speed, −10% armor.', cost: 2, apply(s) { s.dash += 1; s.atkSpeed *= 1.1; s.armor -= 0.1; } },
      { name: 'Form of the Mountain Oni', desc: '+40 Max HP, −10% move speed.', cost: 3, apply(s) { s.maxHp += 40; s.speed *= 0.9; } },
    ],
    attack(p) {
      const i = p.combo % 2;
      p.lunge(i ? 160 : 90);
      G.swing(p, { r: 124, arc: 2.1, dmg: i ? 50 : 32, slot: 'attack', kb: i ? 380 : 220, color: '#c8302c', dir: i ? -1 : 1, width: 1.4, stun: i ? 0.4 : 0.15 });
      SFX.play('heavy'); if (i) G.shake(5);
      p.combo = (i + 1) % 2;
      return (i ? 0.62 : 0.44) / p.stats.atkSpeed;
    },
    special(p) {
      p.heal(6);
      for (let k = 0; k < 8; k++) G.pAfter(k * 0.1, () => {
        const a = p.aim, x2 = p.x + Math.cos(a) * 210, y2 = p.y + Math.sin(a) * 210;
        for (const e of G.enemies) if (!e.dead && e.spawnT <= 0 && segDist(e.x, e.y - e.r * 0.6, p.x, p.y - 12, x2, y2 - 12) < 50 + e.r) { G.damageEnemy(e, 7, { slot: 'special', kb: 40, quiet: true }); G.burn(e, 6); }
        G.parts.burst(p.x + Math.cos(a) * 30, p.y - 20 + Math.sin(a) * 30, 6, { type: 'glow', color: '#ff7a3d', ang: a, spread: 0.35, min: 260, max: 520, size: 5 });
      });
      SFX.play('burn');
    },
    ult(p) { p.feastT = 7; p.invuln = 0.5; G.flash('#c8302c', 0.4); SFX.play('roar'); G.fxRing(p.x, p.y, 200, '#ff3d5e', 0.4, 12); },
    drawWeapon(ctx, p, x, y, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = '#3a2a1a'; rrect(ctx, -10, -4, 30, 8, 3); ctx.fill();
      ctx.fillStyle = '#2a2a30'; rrect(ctx, 18, -9, 44, 18, 6); ctx.fill();
      ctx.fillStyle = '#9a9aa8'; for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) circ(ctx, 24 + i * 11, sd * 9, 2.5);
      ctx.restore();
      ctx.fillStyle = '#c9a36b'; ell(ctx, p.x - Math.cos(p.aim) * 14, p.y - 18, 6, 8); ell(ctx, p.x - Math.cos(p.aim) * 14, p.y - 28, 4, 5);
      if (p.feastT > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,61,94,.22)'; ell(ctx, p.x, p.y - 26, 32, 46); ctx.restore(); }
    }
  },
  kogane: {
    id: 'kogane', kami: 'gold', name: 'Kogane', jp: '黄金', title: 'Fox of the Golden Harvest', weapon: 'Lucky Coins — Senryō',
    desc: 'Inari\'s greediest fox. Pelts foes with coins, rains koban from the sky, and gambles on every Ultimate.',
    pal: { hair: '#ffcf40', hair2: '#c8901a', skin: '#fff0e0', outfit: '#f2f2f2', outfit2: '#c8302c', eye: '#ffcf40', accent: '#c8302c', scarf: '#ffcf40', acc2: '#fff0d0' },
    hair: 'long', acc: 'foxears', base: { maxHp: 95, speed: 305 },
    specialName: 'Koban Barrage', specialCd: 3.5, ultName: 'Jackpot', ultJp: '大当たり', ultSub: 'Jackpot',
    controls: 'LMB toss a fan of 3 coins · RMB rain golden koban around the cursor · Q spin the wheel: Gold Rush nova, Lucky Seven (6s of crits) or Fortune (heal + shield)',
    forms: [
      { name: 'Form of Senryō', desc: 'A thousand ryō of luck.', cost: 0, apply() {} },
      { name: 'Form of the Golden Tail', desc: '+30% gold. Coins pierce one foe.', cost: 2, apply(s) { s.gold += 0.3; s.goldTail = true; } },
      { name: 'Form of the High Roller', desc: 'Ultimate charges 25% faster. −15 Max HP.', cost: 3, apply(s) { s.ultGain *= 1.25; s.maxHp -= 15; } },
    ],
    attack(p) {
      const S = p.stats;
      for (const o of [-0.16, 0, 0.16]) G.pProj({ x: p.x, y: p.y - 18, ang: p.aim + o, speed: 830, dmg: 7, slot: 'attack', r: 8, pierce: S.goldTail ? 1 : 0, life: 0.6, kind: 'coin', color: '#ffcf40', kb: 50 });
      SFX.play('coin', 0.3);
      return 0.26 / S.atkSpeed;
    },
    special(p) {
      const d = Math.min(420, Math.hypot(Input.mouse.wx - p.x, Input.mouse.wy - p.y)), cx = p.x + Math.cos(p.aim) * d, cy = p.y + Math.sin(p.aim) * d;
      for (let i = 0; i < 6; i++) G.pZone({ x: cx + rand(-90, 90), y: cy + rand(-90, 90), r: 70, warn: 0.3 + i * 0.07, dmg: 26, slot: 'special', color: '#ffcf40', kind: 'koban', onFire: z => { G.parts.burst(z.x, z.y, 8, { color: '#ffcf40', min: 60, max: 200 }); SFX.play('coin', 0.4); } });
    },
    ult(p) {
      const S = p.stats, r = randi(0, 2);
      p.invuln = 0.6;
      if (r === 0) { G.text(p.x, p.y - 90, '金金金 GOLD RUSH!', '#ffcf40', 24); G.hitCircle(p.x, p.y, 400, 150 * S.ult, { slot: 'ult', kb: 400 }); G.fxRing(p.x, p.y, 400, '#ffcf40', 0.5, 18); SFX.play('boom'); }
      else if (r === 1) { G.text(p.x, p.y - 90, '777 LUCKY SEVEN!', '#ff5577', 24); p.luckyT = 6; SFX.play('levelup'); }
      else { G.text(p.x, p.y - 90, '福 FORTUNE!', '#7dffb0', 24); p.heal(S.maxHp * 0.4); p.invuln = 3; SFX.play('heal'); }
      G.flash('#ffcf40', 0.35);
    },
    drawWeapon(ctx, p, x, y, a) {
      ctx.save(); ctx.fillStyle = '#ffcf40';
      for (let i = 0; i < 3; i++) { const oa = p.t * 3 + i * TAU / 3; ell(ctx, p.x + Math.cos(oa) * 20, p.y - 34 + Math.sin(oa) * 7, 5, 5 * Math.abs(Math.cos(p.t * 6 + i)) + 1); }
      ctx.fillStyle = '#ffcf40'; ctx.translate(p.x - Math.cos(p.aim) * 14, p.y - 14); ctx.rotate(Math.sin(p.t * 3) * 0.3);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-30, -6, -40, 8); ctx.quadraticCurveTo(-20, 12, 0, 6); ctx.fill(); ctx.fillStyle = '#fff'; ell(ctx, -38, 7, 6, 5);
      ctx.restore();
    }
  },

  /* ---------------- the two rift newcomers ---------------- */
  sekka: {
    id: 'sekka', name: 'Sekka Tokimiya', jp: '時宮 雪華', title: 'The Stilled Hour', weapon: 'Silver Knives & Pocket Watch — Ichibyō',
    desc: 'From a world where time froze the night the moon broke. Throws knives, slows the hours around her foes, and stops time outright.',
    pal: { hair: '#e8eef8', hair2: '#9aa8c0', skin: '#fdf0ea', outfit: '#1a2240', outfit2: '#0a1020', eye: '#c84a6a', accent: '#c8a050', scarf: '#c8a050' },
    hair: 'hime', acc: 'ribbon', base: { maxHp: 90, speed: 305 },
    specialName: 'Lunar Dial', specialCd: 6.0, ultName: 'Toki yo Tomare', ultJp: '時よ止まれ', ultSub: 'Stop, O Time',
    controls: 'RANGED. LMB fan of 3 knives · RMB place a slow-time dial at the cursor (foes and bullets inside move at 30%) · Q STOP TIME for 4s — knives thrown during the stop hang in the air and all fire when time resumes',
    forms: [
      { name: 'Form of Ichibyō', desc: 'One second, held forever.', cost: 0, apply() {} },
      { name: 'Form of the Eternal Second', desc: 'Time Stop lasts 2s longer. Ultimate charges 30% slower.', cost: 2, apply(s) { s.longStop = true; s.ultGain *= 0.7; } },
      { name: 'Form of Silver Blades', desc: 'Five knives that pierce one foe, −35% damage each.', cost: 3, apply(s) { s.silverBlades = true; } },
    ],
    attack(p) {
      const S = p.stats, n = S.silverBlades ? 5 : 3, sp = S.silverBlades ? 0.12 : 0.14;
      for (let i = 0; i < n; i++) G.pProj({ x: p.x, y: p.y - 18, ang: p.aim + (i - (n - 1) / 2) * sp, speed: 1000, dmg: 10 * (S.silverBlades ? 0.65 : 1), slot: 'attack', r: 7, pierce: S.silverBlades ? 1 : 0, life: G.timeStopT > 0 ? 1.4 : 0.55, kind: 'knife', color: '#dfe8f0', kb: 40 });
      SFX.play('arrow', 0.4);
      return 0.24 / S.atkSpeed;
    },
    special(p) {
      const d = Math.min(420, Math.hypot(Input.mouse.wx - p.x, Input.mouse.wy - p.y));
      G.bubbles.push({ x: p.x + Math.cos(p.aim) * d, y: p.y + Math.sin(p.aim) * d, r: 165, t: 0, dur: 4 });
      SFX.play('tick'); SFX.play('freeze', 0.4);
    },
    ult(p) {
      const dur = p.stats.longStop ? 6 : 4;
      G.timeStopT = dur; G.timeStopMax = dur; p.invuln = 0.5;
      G.flash('#c8d8ff', 0.6); SFX.play('timestop');
    },
    drawWeapon(ctx, p, x, y, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      for (let i = -1; i <= 1; i++) { ctx.save(); ctx.rotate(i * 0.25); ctx.fillStyle = '#dfe8f0'; ctx.beginPath(); ctx.moveTo(6, -1.5); ctx.lineTo(22, 0); ctx.lineTo(6, 1.5); ctx.fill(); ctx.restore(); }
      ctx.restore();
      ctx.fillStyle = '#c8a050'; circ(ctx, p.x - Math.cos(p.aim) * 9, p.y - 22, 5); ctx.fillStyle = '#f2ecdc'; circ(ctx, p.x - Math.cos(p.aim) * 9, p.y - 22, 3.5);
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x - Math.cos(p.aim) * 9, p.y - 22); ctx.lineTo(p.x - Math.cos(p.aim) * 9 + Math.cos(p.t * (G.timeStopT > 0 ? 0 : 3)) * 3, p.y - 22 + Math.sin(p.t * (G.timeStopT > 0 ? 0 : 3)) * 3); ctx.stroke();
    }
  },
  kuroto: {
    id: 'kuroto', name: 'Kuroto Amagiri', jp: '天霧 玄人', title: 'The Shardless', weapon: 'Inverted Spear · Three-Section Staff · Chain',
    desc: 'Born with zero spirit. No shard would take him, no god would see him. So he trained his body until it did not need them.',
    pal: { hair: '#141418', hair2: '#08080a', skin: '#e6c4a8', outfit: '#1a1a20', outfit2: '#2a2a30', eye: '#3a8a5a', accent: '#c8c8c8', scarf: '#2a2a30' },
    hair: 'short', acc: null, base: { maxHp: 115, speed: 345 },
    specialName: 'Ambush · Dash Lunge · Grab Throw', specialCd: 3.4, ultName: 'Weapon Swap', ultJp: '武器交換', ultSub: 'no Ultimate — Q swaps weapons',
    controls: 'VERY CLOSE RANGE. No Ultimate: Q swaps weapons. SPEAR: fast thrusts that pierce shields and armor. STAFF: wide 3-hit spins with huge knockback. CHAIN: long lashes that yank foes in · RMB changes with your weapon. SPEAR Ambush: vanish behind the nearest foe for a guaranteed crit. STAFF Dash Lunge: charge into the first foe in your path. CHAIN Grab Throw: throw a close foe into a wall or another foe',
    statMods(s) { s.dash += 1; s.dashCd *= 0.8; },
    forms: [
      { name: 'Form of the Shardless', desc: 'Nothing given. Everything taken.', cost: 0, apply() {} },
      { name: 'Form of the Mercenary', desc: '+20% gold, +15% damage against elites and bosses.', cost: 2, apply(s) { s.gold += 0.2; s.bigGame += 0.15; } },
      { name: 'Form of the Pure Body', desc: '+40 Max HP and +10% speed. Ambush cooldown +1.5s.', cost: 3, apply(s) { s.maxHp += 40; s.speed *= 1.1; s.spCdAdd += 1.5; } },
    ],
    weapons: [{ name: 'Spear', glyph: '槍', special: 'Ambush' }, { name: 'Staff', glyph: '棍', special: 'Dash Lunge' }, { name: 'Chain', glyph: '鎖', special: 'Grab Throw' }],
    swap(p) { p.weapon = (p.weapon + 1) % 3; p.combo = 0; G.text(p.x, p.y - 70, HEROES.kuroto.weapons[p.weapon].name.toUpperCase(), '#c8c8c8', 16); SFX.play('clang', 0.5); },
    attack(p) {
      const S = p.stats, a = p.aim;
      if (p.weapon === 0) {
        p.lunge(150);
        const x2 = p.x + Math.cos(a) * 98, y2 = p.y + Math.sin(a) * 98;
        G.hitLine(p.x, p.y, x2, y2, 40, 21, { slot: 'attack', kb: 70, pierceGuard: true });
        G.fxLine(p.x, p.y, x2, y2, '#e8e0ff', 6, 0.1); SFX.play('slash', 0.5);
        p.swingT = p.swingDur = 0.1; p.swingFrom = a; p.swingTo = a;
        return 0.17 / S.atkSpeed;
      }
      if (p.weapon === 1) {
        const i = p.combo % 3;
        G.swing(p, { r: 92, arc: TAU * 0.9, dmg: [17, 17, 36][i], slot: 'attack', kb: [260, 260, 520][i], color: '#c8c8c8', dir: i % 2 ? -1 : 1, width: 1.0, stun: i === 2 ? 0.5 : 0.15 });
        SFX.play(i === 2 ? 'heavy' : 'punch'); p.combo = (i + 1) % 3;
        return (i === 2 ? 0.45 : 0.24) / S.atkSpeed;
      }
      const x2 = p.x + Math.cos(a) * 270, y2 = p.y + Math.sin(a) * 270;
      G.hitLine(p.x, p.y, x2, y2, 34, 26, { slot: 'attack', kb: -260, kbAng: a });
      G.fxLine(p.x, p.y, x2, y2, '#8a8a94', 4, 0.2); SFX.play('clang', 0.4);
      p.swingT = p.swingDur = 0.15; p.swingFrom = a; p.swingTo = a;
      return 0.36 / S.atkSpeed;
    },
    special(p) {
      const H = HEROES.kuroto;
      return [H.ambush, H.staffLunge, H.grabThrow][p.weapon](p);
    },
    // Spear: teleport behind the nearest foe for a guaranteed crit. Doubles down on the spear's 1-on-1 strength.
    ambush(p) {
      const t = G.nearestEnemy(p.x, p.y, 460);
      if (!t) { G.moveSafe(p, Math.cos(p.aim) * 180, Math.sin(p.aim) * 180); SFX.play('dash'); return; }
      G.ghost(p, p.x, p.y, 0.3);
      const a = angTo(P, t); p.x = t.x + Math.cos(a) * (t.r + 26); p.y = t.y + Math.sin(a) * (t.r + 26); G.resolve(p);
      p.aim = angTo(p, t); p.iframes = Math.max(p.iframes, 0.35); p.critNext = true;
      G.damageEnemy(t, 62, { slot: 'special', kb: 200, stun: 0.5, pierceGuard: true });
      G.fxSlash({ x: t.x, y: t.y - 14, r: 60, ang: p.aim, arc: 2, color: '#e8e0ff', dur: 0.2, width: 1.2 });
      SFX.play('heavy'); G.stop(0.08);
    },
    // Staff: lunge along your aim into the first foe in the way. Covers the staff's lack of reach and single-target damage.
    staffLunge(p) {
      const a = p.aim, reach = 340 * p.stats.spRange, x1 = p.x, y1 = p.y;
      const x2 = x1 + Math.cos(a) * reach, y2 = y1 + Math.sin(a) * reach;
      let t = null, best = Infinity;
      for (const e of G.enemiesInRange(x1, y1, reach)) {
        const d = Math.hypot(e.x - x1, e.y - y1);
        if (d < best && segDist(e.x, e.y, x1, y1, x2, y2) < e.r + 46) { best = d; t = e; }
      }
      const len = t ? Math.max(0, best - t.r - 30) : reach;
      G.moveSafe(p, Math.cos(a) * len, Math.sin(a) * len);
      p.iframes = Math.max(p.iframes, 0.3);
      G.fxLine(x1, y1, p.x, p.y, '#c8c8c8', 14, 0.25);
      for (let k = 0; k < 3; k++) G.ghost(p, lerp(x1, p.x, k / 3), lerp(y1, p.y, k / 3), 0.25);
      SFX.play('dash');
      if (!t) return;
      G.damageEnemy(t, 78, { slot: 'special', kb: 420, kbAng: a, stun: 0.5, pierceGuard: true });
      G.fxSlash({ x: t.x, y: t.y - 14, r: 70, ang: a, arc: 1.6, color: '#c8c8c8', dur: 0.2, width: 1.3 });
      SFX.play('heavy'); G.stop(0.08); G.shake(6);
    },
    // Chain: grab a close foe and throw it along your aim, into a wall or another foe. Clears rushdown off the chain's short-range gap.
    // Bosses and other immovable foes can't be thrown, so he hits them and vaults off instead.
    grabThrow(p) {
      const t = G.nearestEnemy(p.x, p.y, 200);
      if (!t) {
        G.fxLine(p.x, p.y - 14, p.x + Math.cos(p.aim) * 200, p.y - 14 + Math.sin(p.aim) * 200, '#8a8a94', 4, 0.2);
        SFX.play('clang', 0.3);
        return 1; // a whiff only costs a short cooldown
      }
      G.fxLine(p.x, p.y - 14, t.x, t.y - 14, '#8a8a94', 5, 0.2);
      SFX.play('clang');
      p.iframes = Math.max(p.iframes, 0.35);
      if (t.isBoss || t.kbRes >= 1) {
        G.damageEnemy(t, 55, { slot: 'special', pierceGuard: true });
        const away = angTo(t, p), x0 = p.x, y0 = p.y;
        G.moveSafe(p, Math.cos(away) * 240, Math.sin(away) * 240);
        G.ghost(p, x0, y0, 0.3);
        G.text(t.x, t.y - 80, 'TOO HEAVY', '#c8c8c8', 13);
        return;
      }
      const a = p.aim;
      t.x = p.x + Math.cos(a) * (p.r + t.r + 6); t.y = p.y + Math.sin(a) * (p.r + t.r + 6); G.resolve(t);
      G.damageEnemy(t, 18, { slot: 'special', pierceGuard: true });
      if (!t.dead) { t.thrown = { a, t: 0.8 }; t.vx = 0; t.vy = 0; }
      SFX.play('dash');
    },
    ult() {},
    drawWeapon(ctx, p, x, y, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      if (p.weapon === 0) {
        ctx.fillStyle = '#3a3a44'; ctx.fillRect(-6, -2, 20, 4);
        ctx.fillStyle = '#e8e0ff'; ctx.beginPath(); ctx.moveTo(14, -3); ctx.lineTo(40, -6); ctx.lineTo(34, 0); ctx.lineTo(40, 6); ctx.lineTo(14, 3); ctx.fill();
      } else if (p.weapon === 1) {
        ctx.fillStyle = '#5a3a2a'; for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i ? Math.sin(p.t * 10 + i) * 0.5 : 0); ctx.fillRect(i * 18, -2.5, 16, 5); ctx.restore(); }
      } else {
        ctx.strokeStyle = '#8a8a94'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 8; i++) ctx.lineTo(i * 6, Math.sin(p.t * 10 + i) * 3); ctx.stroke();
      }
      ctx.restore();
      ctx.save(); ctx.strokeStyle = '#8a3a3a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x + 3 + p.lookX * 4, p.y - 30); ctx.lineTo(p.x + 6 + p.lookX * 4, p.y - 25); ctx.stroke(); ctx.restore();
    }
  },
});
HERO_ORDER.push('hinome', 'raika', 'tsukiyo', 'mizuha', 'kazane', 'shuten', 'kogane', 'sekka', 'kuroto');
for (const [h, k] of [['hinome', 'fire'], ['raika', 'thunder'], ['tsukiyo', 'moon'], ['mizuha', 'ice'], ['kazane', 'wind'], ['shuten', 'blood'], ['kogane', 'gold']]) {
  HERO_UNLOCK[h] = { keys: 0, req: s => (s.bossKills['god_' + k] || 0) >= 1, hint: `Free ${KAMI[k].name} from the Calamity in Wrath of the Gods.` };
  CAST[h] = { name: HEROES[h].name, pal: HEROES[h].pal, hair: HEROES[h].hair, acc: HEROES[h].acc };
}
HERO_UNLOCK.sekka = { keys: 0, req: s => s.flags.newcomer === 'sekka', hint: 'She waits by the rift.' };
HERO_UNLOCK.kuroto = { keys: 0, req: s => s.flags.newcomer === 'kuroto', hint: 'He waits by the rift.' };
CAST.sekka = { name: 'Sekka', pal: HEROES.sekka.pal, hair: 'hime', acc: 'ribbon' };
CAST.kuroto = { name: 'Kuroto', pal: HEROES.kuroto.pal, hair: 'short', acc: null };
CAST.omaga = { name: 'Ōmagatsuhi', pal: { hair: '#0a0610', hair2: '#000', skin: '#2a1a2a', outfit: '#0a0610', outfit2: '#000', eye: '#ff2e63', accent: '#5b2b8a', scarf: '#5b2b8a' }, hair: 'wild', acc: 'horns' };

/* ---------------- Godsparks: what each freed god leaves behind ---------------- */
// Divine Overload: damage divisor by number of Kami whose blessings you still hold (measured to flatten the stacking curve)
const OVERLOAD = [1, 1.3, 1.5, 1.9, 2.1, 2.45, 2.55, 2.7];
const GODSPARKS = {
  fire: { name: 'Spark of Dawn', desc: '+12% damage.', apply: s => { s.dmgAll *= 1.12; } },
  thunder: { name: 'Spark of the Storm', desc: '+12% attack speed.', apply: s => { s.atkSpeed *= 1.12; } },
  moon: { name: 'Spark of the Silver Night', desc: '+8% crit chance, +20% crit damage.', apply: s => { s.crit += 0.08; s.critDmg += 0.2; } },
  ice: { name: 'Spark of Still Water', desc: '+25 Max HP.', apply: s => { s.maxHp += 25; } },
  wind: { name: 'Spark of the Wandering Wind', desc: '+1 Dash, +6% move speed.', apply: s => { s.dash += 1; s.speed *= 1.06; } },
  blood: { name: 'Spark of the Oni King', desc: 'Kills heal 3 HP. +3% lifesteal.', apply: s => { s.feast += 3; s.lifesteal += 0.03; } },
  gold: { name: 'Spark of the Harvest', desc: '+6% armor, Ultimate charges 15% faster.', apply: s => { s.armor += 0.06; s.ultGain *= 1.15; } },
};

/* ---------------- the corrupted gods & the Calamity ---------------- */
const GOD_DEFS = [
  ['fire', 'hinome', 'The Corrupted Dawn', '堕ちた暁', ['sunWheel', 'flareRings', 'emberSwarm'], ['sunWheel', 'flareRings', 'emberSwarm', 'pillarSweep'], ['dawnEternal', 'sunWheel', 'flareRings', 'pillarSweep', 'emberSwarm']],
  ['thunder', 'raika', 'The Maddened Storm', '狂える嵐', ['drumBeats', 'boltGrid', 'chainLines'], ['drumBeats', 'boltGrid', 'chainLines', 'thunderDash'], ['stormSymphony', 'drumBeats', 'thunderDash', 'boltGrid', 'chainLines']],
  ['moon', 'tsukiyo', 'The Eclipsed Night', '蝕まれた夜', ['crescentCurves', 'moonPhases', 'silverRain'], ['crescentCurves', 'moonPhases', 'eclipseBeams', 'silverRain'], ['fullMoonBloom', 'crescentCurves', 'moonPhases', 'eclipseBeams', 'silverRain']],
  ['ice', 'mizuha', 'The Drowning Flood', '溺れる洪水', ['tideWaves', 'snowfall', 'icicleFan'], ['tideWaves', 'snowfall', 'icicleFan', 'frostFields'], ['stillWaters', 'tideWaves', 'icicleFan', 'frostFields', 'snowfall']],
  ['wind', 'kazane', 'The Howling Gale', '吠える疾風', ['galeSpiral', 'crossWind', 'windDash'], ['galeSpiral', 'crossWind', 'windDash', 'twinTornado'], ['typhoonEye', 'galeSpiral', 'windDash', 'twinTornado', 'crossWind']],
  ['blood', 'shuten', 'The Bloodmad King', '血に狂う王', ['sakeFountain', 'clubQuake', 'oniRush'], ['sakeFountain', 'clubQuake', 'oniRush', 'bloodRain'], ['drunkenSpiral', 'sakeFountain', 'clubQuake', 'oniRush', 'bloodRain']],
  ['gold', 'kogane', 'The Ravenous Fortune', '貪る黄金', ['coinBounce', 'kobanRain', 'goldRings'], ['coinBounce', 'kobanRain', 'goldRings', 'slotMachine'], ['jackpotStorm', 'coinBounce', 'slotMachine', 'goldRings', 'kobanRain']],
];
for (const [k, hero, title, jpt, p1, p2, p3] of GOD_DEFS) {
  const H = HEROES[hero];
  BOSSES['god_' + k] = { id: 'god_' + k, god: true, kami: k, hero, name: KAMI[k].name, title, jp: jpt + ' ' + KAMI[k].name, hp: 9000, r: 26, spd: 140, dmg: 24, draw: 'god', col: KAMI[k].color,
    pal: corruptPal(H.pal), hair: H.hair, acc: H.acc, hover: true, kbRes: 1, desc: `${KAMI[k].title}, devoured from within by the Calamity.`,
    phases: [0.66, 0.33], patterns: [p1, p2, p3], desperation: { at: 0.08, pat: 'godLament' } };
}
BOSSES.omaga = { id: 'omaga', name: 'Ōmagatsuhi', title: 'The Great Calamity', jp: '大禍津日神', hp: 11500, r: 46, spd: 120, dmg: 30, draw: 'omaga', col: '#5b2b8a', hover: true, kbRes: 1,
  desc: 'The defilement at the bottom of Yomi. It wore the Black Sun. It wore the gods. It has never had a face of its own.',
  phases: [0.8, 0.6, 0.4, 0.2], desperation: { at: 0.05, pat: 'worldEnd' },
  patterns: [['blackTears', 'calamityEye', 'abyssSpiral'], ['blackTears', 'calamityEye', 'abyssSpiral', 'thousandHands', 'godEcho'], ['defile', 'abyssSpiral', 'thousandHands', 'godEcho', 'calamityEye'], ['defile', 'godEcho', 'abyssSpiral', 'thousandHands', 'blackTears', 'calamityEye'], ['godEcho', 'abyssSpiral', 'defile', 'thousandHands', 'calamityEye', 'blackTears']] };

const HEAVEN = { id: 'heaven', name: 'Celestial Pantheon', jp: '神々の殿', act: 'Wrath of the Gods', floor: '#1a1610', floor2: '#221c12', line: '#4a3a1a', wall: '#06050a', accent: '#ffcf40', amb: 'petal', music: 'heaven', prop: 'none', boss: null, tint: 'rgba(255,200,100,0.04)', pool: {} };
const CALAMITY = { id: 'calamity', name: 'Bottom of the World', jp: '禍の底', act: 'Wrath of the Gods', floor: '#0a0610', floor2: '#100a18', line: '#2a1040', wall: '#000000', accent: '#ff2e63', amb: 'void', music: 'calamity', prop: 'none', boss: null, tint: 'rgba(120,0,60,0.1)', pool: {} };
CAMPAIGNS.push({ id: 'gods', name: 'Wrath of the Gods', jp: '神々の怒り', acts: [HEAVEN, HEAVEN, HEAVEN, HEAVEN], hpMult: 1, dmgMult: 1.15, spdMult: 1.1, tempo: 1.2, shardMult: 3,
  gate: 'The Stair of Heaven', gateJp: '天の階', tag: 'FINAL CAMPAIGN', cls: 'c2 c3', warnCls: 'c3', go: 'Begin Ascent', bannerTag: 'WRATH OF THE GODS · ', hudTag: '', win: 'The Calamity is sealed — for now',
  warn: '⚠ A gauntlet of seven corrupted gods, then the Calamity. You begin holding EVERY Kami blessing — each god you free takes its blessings back, so choose your order. Every god is a bullet-hell fight; the Calamity is far worse. Freed gods leave a Godspark and become playable.' });

/* ---------------- story ---------------- */
const STORY3 = {
  intro: [
    ['hanabi', 'Akane... the Kami have gone silent. All seven of them.'],
    ['sanzu', 'Not silent. Screaming. On a frequency only the dead can hear.'],
    ['narrator', 'The thing that wore the Black Sun did not die when Kurohi was freed. It sank into the cracks of heaven — and found the gods.'],
    ['sanzu', 'It has a name, though it hates to hear it: Ōmagatsuhi. The Great Calamity. The filth at the bottom of Yomi that wants to wear something bright.'],
    ['hanabi', 'Right before they went quiet, the Kami poured everything they had into you. Every blessing. All at once. That\'s why your hands are glowing.'],
    ['$hero', 'Then I\'ll give it back to them. By force if I have to.'],
    ['sanzu', 'You will have to. A corrupted god must be slain to be freed — and when it falls, its power returns to it. Your blessings will leave with each one.'],
    ['sanzu', 'You will start as a god, moon-child. You will end as yourself. Choose the order wisely.'],
  ],
  freed: {
    fire: [['hinome', 'Ahh... the sun is warm again. I tried to burn you to ash. I\'m so sorry, little moon.'], ['hinome', 'Take my spark. And — when you\'re done — let me fight beside you. I owe you a sunrise.']],
    thunder: [['raika', '...The rhythm. I can hear my own drum again. That thing made me play its beat for so long.'], ['raika', 'BA-DUM. That one\'s for you. Call me when you need thunder.']],
    moon: [['tsukiyo', 'Moon-child. My sister\'s shard beats in your chest. I nearly shattered it.'], ['tsukiyo', 'The night is mine again. Walk in it whenever you wish — I will walk with you.']],
    ice: [['mizuha', 'The water is clear. I can see my reflection — and yours, standing over me.'], ['mizuha', 'Still waters, little moon. When the storm comes, be the stillness. I will be there.']],
    wind: [['kazane', 'Whoosh... I\'m free! I\'m FREE! Do you know how awful it is for wind to be held still?!'], ['kazane', 'I\'m coming with you. You can\'t stop me. Nobody can stop the wind!']],
    blood: [['shuten', 'GAHAHA... ha... You split my skull, Moonbound. Best drink I\'ve had in a thousand years.'], ['shuten', 'The Oni King owes you a debt. Pour me a cup at the shrine and I\'ll swing my club wherever you point.']],
    gold: [['kogane', 'Ohoho... my coins... they\'re still mine! It tried to eat my fortune and choked on it!'], ['kogane', 'You\'ve earned a discount. A permanent one. Also, me. You\'ve earned me.']],
  },
  allFreed: [
    ['narrator', 'The seventh god falls and rises again, clean. Seven lights hang in the Pantheon\'s sky — and below them, the floor tears open.'],
    ['omaga', 'You took them all back. Every one. You are left with nothing but yourself.'],
    ['omaga', 'Come down, then. Come to the bottom of the world, and see what "yourself" is worth.'],
  ],
  omagaIntro: [
    ['omaga', 'I was here before the moons. Before the sun. I am what is left when every memory rots.'],
    ['omaga', 'I wore the Emperor\'s grief. I wore the Sun\'s light. I wore seven gods like jewelry.'],
    ['$hero', 'And now you\'ve got nothing left to wear.'],
    ['omaga', '...Then I will wear YOU.', 'angry'],
  ],
  omagaDefeat: [
    ['omaga', 'Im...possible... a shard-child... with nothing...'],
    ['omaga', 'Heh... heh... You think... I only lived in the gods?'],
    ['omaga', 'I live in the cracks... between every memory... you ever saved...'],
    ['narrator', 'The Calamity comes apart like wet ash. The seven Kami blaze overhead. And far away, back at the Shrine of Lanterns, something begins to crack.'],
  ],
  breakA: [
    ['hanabi', 'You\'re back! You did it — all seven Kami are free, and that THING is gone!', 'happy'],
    ['tama', '...Child. The lanterns. Look at the lanterns.'],
    ['narrator', 'One by one, the shrine lanterns gutter out. A sound like a great bell cracking rolls across the sky.'],
    ['omaga', 'Did you think I only lived in the gods, moon-child? I am in every crack between the memories you saved.'],
    ['omaga', 'If I cannot have heaven... I will take your home.'],
  ],
  breakPonta: [['ponta', 'M-my forge! The ground is — Moonbound, I can\'t feel my paws — !']],
  breakTama: [['tama', 'Don\'t look back, little moon. Lanterns always find their way home.']],
  breakHeroes: [['narrator', 'The friends you made at the shrine are swallowed one by one by the light between worlds.']],
  breakSanzu: [['sanzu', 'Even the river... cannot ferry this.']],
  breakHanabi: [['hanabi', 'Akane! Listen to me! I\'m not gone — I\'m just somewhere else! Find me! Promise you\'ll —']],
  breakRift: [
    ['$hero', 'HANABI!'],
    ['narrator', 'Where the shrine\'s heart stood, the world splits open — a rift breathing cold, unfamiliar air.'],
  ],
  newcomers: [
    ['kuroto', 'Hold STILL, clock-girl!'],
    ['sekka', 'You first.'],
    ['$hero', 'What — who are you?! Where are my friends?!'],
    ['sekka', '...So this is the world on the other side. Smaller than I imagined. And very broken.'],
    ['kuroto', 'Tch. Broken here too. You — shard-kid. You the one who killed the thing at the bottom?'],
  ],
  newcomersAccuse: [
    ['sekka', 'Sekka Tokimiya. In my world, time stopped the night your moon broke. I am the only one who still moves.'],
    ['kuroto', 'The only one. Then who\'s been trying to kill you all this time?'],
    ['sekka', '...You do not count. You have no clock.'],
    ['kuroto', 'Kuroto Amagiri. No shard. No blessing. No gods. Same world as her. Everyone I know is standing where they stopped, and she\'s why.'],
    ['sekka', 'Your friends were pulled through. They are not dead — I can hear their clocks ticking on the other side. I am the only one who can.'],
    ['sekka', 'And he followed me through that rift to kill me. Ask him. Then ask who finds your friends after he succeeds.'],
    ['kuroto', 'Ask HER what stopped her world. Watch how fast she changes the subject.'],
    ['kuroto', 'So pick, shard-kid. Speed of time — or speed of fists. Whoever you don\'t pick, we go through together.'],
  ],
  pickSekka: [
    ['kuroto', 'Tch. Two on one. Fine.'],
    ['kuroto', 'Doesn\'t matter. Rift\'s not stable. Step in now and it grinds you to paste, and nobody gets to the other side until it settles.'],
    ['sekka', 'Then we wait. And you do not touch me until it opens.'],
    ['kuroto', 'I\'ll watch the hole. Sleep light, clock-girl.'],
    ['sekka', 'A wise choice, Moonbound. I will try not to stop time while you are mid-sentence.'],
  ],
  pickKuroto: [
    ['sekka', '...Enough. Cut me down now and you will never hear your fox\'s clock again.'],
    ['kuroto', 'She\'s right about that. Annoying.'],
    ['kuroto', 'Besides, rift\'s not stable. Step in now and it grinds you to paste. Nobody goes through until it settles. She keeps, until then.'],
    ['sekka', 'Then I will keep the rift\'s clock. Come back in one piece, Moonbound.'],
    ['kuroto', 'Good fight, shard-kid. Try to keep up.'],
  ],
};
Object.assign(BOSS_TALK, {
  god_fire: [[['hinome', 'LITTLE MOON. COME CLOSER. LET ME SHOW YOU A DAWN THAT NEVER ENDS.', 'angry']], [['hinome', 'Burn... burn... why won\'t you BURN?', 'angry']]],
  god_thunder: [[['raika', 'BA-DUM. BA-DUM. DANCE TO HIS RHYTHM, MOONBOUND. DANCE UNTIL YOUR HEART STOPS.', 'angry']], [['raika', 'The drum... is too loud... make it STOP!', 'angry']]],
  god_moon: [[['tsukiyo', 'Sister\'s shard... it should be MINE. Give it back. Give me your heart.', 'angry']], [['tsukiyo', 'The night has no stars left. Only me.', 'angry']]],
  god_ice: [[['mizuha', 'Be still. Be still. BE STILL. Drown, and be STILL.', 'angry']], [['mizuha', 'The water remembers you... it wants to keep you...', 'angry']]],
  god_wind: [[['kazane', 'Hahahaha! Run, run, RUN! The wind takes EVERYTHING!', 'angry']], [['kazane', 'Why do you keep coming back?! Stay AWAY!', 'angry']]],
  god_blood: [[['shuten', 'DRINK, MOONBOUND! DRINK YOUR OWN BLOOD! GAHAHAHA!', 'angry']], [['shuten', 'More... MORE... the feast never ends!', 'angry']]],
  god_gold: [[['kogane', 'Everything has a price. Yours is EVERYTHING. Ohohoho!', 'angry']], [['kogane', 'Pay up, pay up, PAY UP!', 'angry']]],
  omaga: [STORY3.omagaIntro, [['omaga', 'Again. You will break before I do.']]],
});
Object.assign(TALKS, {
  sekka: [{ id: 'sk1', cond: s => s.flags.newcomer === 'sekka', lines: [['sekka', 'Time moves strangely here. Everything is so... loud. So many ticking clocks.'], ['sekka', 'Stop time when the bullets are thickest. Throw everything. Then let it all fall at once. That is the trick.']] }],
  sekka_idle: [[['sekka', 'The rift\'s clock is irregular. Like a heartbeat with a fever.']], [['sekka', 'Your fox friend\'s clock is still ticking. Faintly. I promise.']]],
  kuroto: [{ id: 'ku1', cond: s => s.flags.newcomer === 'kuroto', lines: [['kuroto', 'Spear for things with armor. Staff for crowds. Chain for runners. Swap on the fly.'], ['kuroto', 'Each one does something different when you commit. Spear gets behind them. Staff closes the gap. Chain throws them into something hard.'], ['kuroto', 'No gauge, no magic. Just don\'t get hit, and hit harder.']] }],
  kuroto_idle: [[['kuroto', 'The rift growls at night. Something big on the other side.']], [['kuroto', 'Gods, shards, moons. All crutches. ...Your forms aren\'t bad though.']]],
});
LORE.push(
  { id: 'l_omaga', title: 'Ōmagatsuhi, the Great Calamity', cond: s => (s.bossKills.omaga || 0) >= 1, text: 'In the oldest myths, Magatsuhi was the god of defilement, born from the filth Izanagi washed off after fleeing Yomi. It has no face, so it wears others. It is not dead. It is waiting in the cracks.' },
  { id: 'l_rift', title: 'The Rift', cond: s => s.flags.cs1, text: 'A tear where the Shrine of Lanterns once stood. Cold air drifts out of it, smelling of iron and snow. Through it, faintly, a fox spirit can be heard complaining.' },
);
