'use strict';
/* =====================================================================
   KAGEBANA — dashfx.js
   Each hero's own dash look, plus a few small dash perks.
   Every field is optional:
     start(p)      when the dash begins (p.dashFrom is where it began)
     trail(p, dt)  every frame of the dash
     end(p)        when the dash finishes
     wall(p)       the dash ran into a wall or obstacle
     dodge(p)      the dash's i-frames just avoided a hit
     noPuff        skip the shared smoke puff
     noGhost       skip the shared afterimages
     hide          the hero isn't drawn while dashing (a blink)
     sfx           replaces the shared whoosh
   Heroes with no entry keep the shared dash.
   ===================================================================== */

const dashLine = (p, col, w = 3, dur = 0.22) => G.fxLine(p.dashFrom.x, p.dashFrom.y - 18, p.x, p.y - 18, col, w, dur);
const dashAng = p => Math.atan2(p.dashDir.y, p.dashDir.x);

function drawCracks(ctx, d, k, col) {
  ctx.save(); ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (const c of d.lines) { ctx.beginPath(); ctx.moveTo(d.x, d.y); for (const q of c) ctx.lineTo(d.x + q[0], d.y + q[1]); ctx.stroke(); }
  ctx.restore();
}
function makeCracks(n, len) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let a = rand(0, TAU), x = 0, y = 0; const c = [];
    for (let j = 0; j < 3; j++) { a += rand(-0.6, 0.6); const l = rand(len * 0.4, len * 0.7); x += Math.cos(a) * l; y += Math.sin(a) * l * 0.5; c.push([x, y]); }
    out.push(c);
  }
  return out;
}
/* Flash step: no smoke, no afterimage, a streak from start to end and a flicker on arrival. */
function flashStep(col) {
  return {
    noPuff: true, noGhost: true, hide: true,
    start(p) { G.parts.burst(p.x, p.y - 18, 5, { type: 'glow', color: col, min: 10, max: 40, size: 4, life: 0.25 }); },
    end(p) {
      dashLine(p, col, 2, 0.16); dashLine(p, '#ffffff', 1, 0.1);
      G.parts.burst(p.x, p.y - 18, 8, { type: 'spark', color: col, min: 60, max: 200, size: 2, life: 0.25 });
      G.ghost(p, p.x, p.y, 0.12);
    },
  };
}

const DASH_FX = {
  akane: {
    trail(p) { if (Math.random() < 0.7) G.parts.burst(p.x, p.y - 16, 1, { type: 'petal', color: Math.random() < 0.5 ? '#ffb7c5' : '#ff8fa8', min: 10, max: 50, size: 3, drag: 1.5, grav: 25, life: 1.1 }); },
  },
  rei: {
    start(p) {
      G.parts.burst(p.x, p.y, 10, { type: 'smoke', color: '#c8b48a', ang: dashAng(p) + Math.PI, spread: 0.9, min: 40, max: 140, size: 4 });
      G.decal({ x: p.x, y: p.y, dur: 0.9, lines: makeCracks(4, 26), draw: (ctx, d, k) => drawCracks(ctx, d, k, '#5a4a3a') });
    },
    noPuff: true,
  },
  yuki: {
    end(p) {
      const a = dashAng(p), nx = -Math.sin(a) * 7, ny = Math.cos(a) * 7, x1 = p.dashFrom.x, y1 = p.dashFrom.y, x2 = p.x, y2 = p.y;
      G.decal({ dur: 1.2, y: Math.min(y1, y2) - 1, draw(ctx, d, k) {
        ctx.save(); ctx.globalAlpha = (1 - k) * 0.6; ctx.strokeStyle = '#dff8ff'; ctx.lineWidth = 2;
        for (const s of [1, -1]) { ctx.beginPath(); ctx.moveTo(x1 + nx * s, y1 + ny * s); ctx.lineTo(x2 + nx * s, y2 + ny * s); ctx.stroke(); }
        ctx.restore();
      } });
    },
  },
  kaito: {
    start(p) { G.decal({ x: p.x, y: p.y - 30, dur: 0.4, draw(ctx, d, k) { ctx.save(); ctx.globalAlpha = 1 - k; ctx.fillStyle = '#f0eaff'; ctx.beginPath(); ctx.arc(d.x, d.y, 9, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(d.x + 4, d.y - 2, 8, 0, TAU); ctx.fill(); ctx.restore(); } }); },
    trail(p) { if (Math.random() < 0.6) G.parts.burst(p.x, p.y - 18, 1, { type: 'glow', color: '#7a4bd6', min: 5, max: 30, size: 4, life: 0.4 }); },
  },
  sayo: {
    start(p) {
      const col = (KAMI[SAVE.data.patron] || KAMI.fire).color;
      G.decal({ x: p.x, y: p.y - 30, dur: 1.1, rot: rand(-0.4, 0.4), draw(ctx, d, k) {
        ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.translate(d.x + Math.sin(k * 7) * 6, d.y + k * 26); ctx.rotate(d.rot + Math.sin(k * 6) * 0.3);
        ctx.fillStyle = '#f6efd8'; ctx.fillRect(-5, -9, 10, 18); ctx.fillStyle = col; ctx.fillRect(-3, -6, 6, 2); ctx.fillRect(-1, -3, 2, 9);
        ctx.restore();
      } });
    },
  },
  tetsu: {
    // No god, no glow: just a scuff in the dirt.
    noPuff: true,
    start(p) { G.parts.burst(p.x, p.y, 4, { type: 'smoke', color: '#8a7a66', ang: dashAng(p) + Math.PI, spread: 0.5, min: 20, max: 60, size: 3 }); },
    dodge(p) { if (!p.critNext) { p.critNext = true; G.text(p.x, p.y - 60, 'READ', '#e8e0d0', 13); SFX.play('clang', 0.4); } },
  },
  sora: flashStep('#e8f4ff'),
  daigo: {
    noPuff: true,
    start(p) {
      G.shake(4); SFX.play('heavy', 0.5);
      G.parts.burst(p.x, p.y, 12, { type: 'smoke', color: '#b0a090', min: 40, max: 160, size: 5 });
      G.decal({ x: p.x, y: p.y, dur: 1.1, lines: makeCracks(6, 34), draw: (ctx, d, k) => drawCracks(ctx, d, k, '#3a2a1a') });
    },
    // Small foes in his path are shoved aside.
    trail(p) {
      const a = dashAng(p);
      for (const e of G.enemiesInRange(p.x, p.y, p.r + 34)) {
        if (e.isBoss || e.elite || e.r > 22 || p.fxHit.has(e)) continue;
        p.fxHit.add(e);
        const side = Math.sign((e.x - p.x) * -Math.sin(a) + (e.y - p.y) * Math.cos(a)) || 1, sa = a + side * Math.PI / 2;
        e.vx += Math.cos(sa) * 520 * (1 - e.kbRes); e.vy += Math.sin(sa) * 520 * (1 - e.kbRes);
      }
    },
  },
  isamu: {
    start(p) { DASH_FX.isamu.glint(p.x, p.y - 20); },
    end(p) { DASH_FX.isamu.glint(p.x, p.y - 20); },
    glint(x, y) { G.fxLine(x - 14, y - 14, x + 14, y + 14, '#e8f0ff', 2, 0.18); G.fxLine(x + 14, y - 14, x - 14, y + 14, '#e8f0ff', 2, 0.18); },
  },
  hibiki: {
    sfx: 'don',
    // While Groove is up, the dash rides the beat and goes farther.
    start(p) { G.fxRing(p.x, p.y, 60, '#ffcf40', 0.25, 4); if (p.groove > 0 && p.grooveT > 0) { p.dashMul = 1.25; SFX.play('ka', 0.6); } },
    end(p) { G.fxRing(p.x, p.y, 40, '#ff5a3d', 0.2, 3); },
  },
  rinne: {
    noGhost: true,
    // Leaves a mirror image that reflects one bullet, then shatters.
    start(p) {
      G.ghost(p, p.x, p.y, 0.5);
      G.decal({ x: p.x, y: p.y, dur: 0.5, used: false,
        tick(d) {
          if (d.used) return;
          for (const b of G.projs) {
            if (b.team !== 'e' || b.dead || Math.hypot(b.x - d.x, b.y - (d.y - 18)) > 26) continue;
            b.team = 'p'; b.vx *= -1; b.vy *= -1; b.dmg = (b.dmg || 10) * 1.5; b.hit = new Set(); b.color = '#e8f8ff';
            d.used = true; d.t = d.dur; SFX.play('parry', 0.6);
            G.parts.burst(d.x, d.y - 18, 12, { type: 'shard', color: '#e8f8ff', min: 80, max: 260, size: 3 });
            break;
          }
        },
        draw(ctx, d, k) { ctx.save(); ctx.globalAlpha = (1 - k) * 0.7; ctx.strokeStyle = '#e8f8ff'; ctx.lineWidth = 2; ctx.strokeRect(d.x - 12, d.y - 40, 24, 38); ctx.restore(); },
        end(d) { if (!d.used) G.parts.burst(d.x, d.y - 20, 8, { type: 'shard', color: '#cfe8ff', min: 40, max: 160, size: 2 }); },
      });
    },
  },
  hinome: {
    noPuff: true,
    trail(p) { G.parts.burst(p.x, p.y - 10, 2, { type: 'spark', color: Math.random() < 0.5 ? '#ff7a3d' : '#ffcf40', min: 20, max: 90, size: 2, grav: -120, life: 0.6 }); },
  },
  raika: {
    noPuff: true,
    start(p) { G.parts.burst(p.x, p.y - 18, 8, { type: 'spark', color: '#ffe14d', min: 100, max: 280, size: 2, life: 0.2 }); SFX.play('thunder', 0.3); },
    // Landing zaps the nearest foe.
    end(p) {
      G.fxBolt(p.dashFrom.x, p.dashFrom.y - 18, p.x, p.y - 18, '#ffe14d');
      const t = G.enemiesInRange(p.x, p.y, 260).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (t) { G.fxBolt(p.x, p.y - 18, t.x, t.y - 15, '#ffe14d'); G.damageEnemy(t, 12, { slot: 'misc', noProc: true }); }
    },
  },
  tsukiyo: {
    trail(p) {
      if (Math.random() < 0.7) G.parts.burst(p.x, p.y - 18, 1, { type: 'glow', color: '#d8ccff', min: 5, max: 20, size: 3, life: 0.5 });
      // Foes she passes through are briefly cursed.
      for (const e of G.enemiesInRange(p.x, p.y, p.r + 16)) if (!p.fxHit.has(e)) { p.fxHit.add(e); e.st.curse = Math.max(e.st.curse || 0, 1.5); G.parts.burst(e.x, e.y - e.r, 6, { color: '#b49cff', min: 40, max: 120 }); }
    },
  },
  mizuha: {
    noPuff: true, sfx: 'splash',
    start(p) { G.parts.burst(p.x, p.y - 6, 10, { type: 'shard', color: '#9ee7ff', min: 60, max: 180, size: 2, grav: 300 }); },
    end(p) { G.fxRing(p.x, p.y, 34, '#9ee7ff', 0.4, 2); G.after(0.12, () => G.fxRing(p.x, p.y, 54, '#6ee7ff', 0.45, 2)); },
  },
  kazane: {
    start(p) { p.dashMul = 1.15; },
    trail(p) { if (Math.random() < 0.8) G.parts.burst(p.x, p.y - 16, 1, { type: 'petal', color: Math.random() < 0.5 ? '#7dffb0' : '#4fc77f', min: 30, max: 90, size: 2.5, drag: 2, life: 0.8 }); },
  },
  shuten: {
    noPuff: true,
    start(p) { G.parts.burst(p.x, p.y - 20, 10, { type: 'spark', color: '#ff7a8a', min: 60, max: 200, size: 2, grav: 400, life: 0.5 }); G.shake(2); },
  },
  kogane: {
    noPuff: true,
    trail(p) { if (Math.random() < 0.6) G.parts.burst(p.x, p.y - 20, 1, { type: 'glow', color: '#6ab8ff', min: 5, max: 25, size: 5, drag: 3, grav: -40, life: 0.9 }); },
  },
  sekka: {
    // The dash is really time stopping around her: no whoosh, no afterimage, just a clock where she stood.
    noPuff: true, noGhost: true, hide: true, sfx: 'tick',
    start(p) {
      G.decal({ x: p.x, y: p.y - 22, dur: 0.5, draw(ctx, d, k) {
        ctx.save(); ctx.globalAlpha = k < 0.8 ? 1 : (1 - k) * 5; ctx.translate(d.x, d.y);
        ctx.fillStyle = 'rgba(20,24,40,.75)'; ctx.strokeStyle = '#dfe8f0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#ffcf40'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 12; i++) { const a = i * TAU / 12; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10); ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12); ctx.stroke(); }
        const h = -Math.PI / 2 + (k > 0.5 ? TAU / 12 : 0); // the hand ticks once
        ctx.strokeStyle = '#dfe8f0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(h) * 9, Math.sin(h) * 9); ctx.stroke();
        ctx.restore();
        if (k > 0.5 && !d.ticked) { d.ticked = true; SFX.play('tick'); }
      } });
    },
    end(p) { G.parts.burst(p.x, p.y - 18, 5, { type: 'glow', color: '#c8d8ff', min: 10, max: 40, size: 3, life: 0.25 }); },
  },
  kuroto: Object.assign(flashStep('#c8c8d8'), {
    // Hitting a wall mid-dash gives the charge back. Only once per dash, and only after the dash
    // has actually travelled, so dashing into a wall you're already touching does nothing.
    wall(p) {
      if (p.wallUsed || Math.hypot(p.x - p.dashFrom.x, p.y - p.dashFrom.y) < 24) return;
      p.wallUsed = true;
      p.dashes = Math.min(p.stats.dash, p.dashes + 1);
      p.dashT = 0;
      G.fxRing(p.x, p.y - 10, 30, '#ffffff', 0.2, 3);
      G.parts.burst(p.x, p.y - 10, 8, { type: 'spark', color: '#ffffff', min: 80, max: 220, size: 2, life: 0.2 });
      SFX.play('clang', 0.35);
    },
  }),
};
