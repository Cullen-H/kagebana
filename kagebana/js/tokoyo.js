'use strict';
/* =====================================================================
   KAGEBANA — tokoyo.js
   Arc II, Act I. The rift becomes a gate to Tokoyo, Sekka and Kuroto's
   world, where one night has been stopped for years: the Town of Hanging
   Snow, the Worn, Okina, and Ponta's rescue.

   Story beats play once and are remembered in save flags:
     t_open    the rift has settled and the opening scene has played
     t_arrive  the first walk into the frozen festival
     t_rescue  Okina beaten for the first time, Ponta found
     t_forge   back at the shrine with the forge relit

   In dialogue, '$h' is the hero, unless the hero is Sekka or Kuroto. They
   are already in these scenes, so Akane asks the questions instead.
   ===================================================================== */

/* ---------------- music ---------------- */
Object.assign(THEMES, {
  tokoyo: { bpm: 104, root: 50, scale: 'hira', prog: [0, 1, 3, 1], lead: 'triangle', bass: 'triangle', drums: 'clock', density: 0.38, pad: 0.05 },
  okina: { bpm: 148, root: 45, scale: 'kumoi', prog: [0, 3, 0, 4], lead: 'square', bass: 'sawtooth', drums: 'taiko', density: 0.7, pad: 0.04 },
});

/* ---------------- the world ---------------- */
const TOKOYO_TOWN = { id: 'tokoyo', name: 'Town of Hanging Snow', jp: '懸雪の町', act: 'Act I', floor: '#1a2230', floor2: '#202a3a', line: '#34435a', wall: '#070a10', accent: '#bcd8f5', amb: 'hang', music: 'tokoyo', bossMusic: 'okina', prop: 'frozen', hazard: 'hangsnow',
  pool: { seep: 3, wvendor: 4, wdancer: 3, wlantern: 3, wfan: 2, wporter: 2 }, boss: 'okina', tint: 'rgba(120,160,220,0.07)' };
CAMPAIGNS.push({ id: 'tokoyo', name: 'The Stopped Night', jp: '止まった夜', acts: [TOKOYO_TOWN], hpMult: 1.25, dmgMult: 1.4, spdMult: 1.1, tempo: 1.15, extraWaves: 1, eliteBonus: 0.15, shardMult: 2.5 });

/* ---------------- the Worn ---------------- */
Object.assign(ENEMIES, {
  seep: { name: 'Seepling', ai: 'swarm', hp: 16, spd: 180, dmg: 6, r: 10, cost: 0.5, gold: 1, contact: true, group: 3, draw: 'seep', col: '#1a0f2a', col2: '#c084ff', desc: 'What the Calamity leaves in the cracks. It has not found anyone to wear yet, and it is looking.' },
  wvendor: { name: 'Worn Vendor', worn: true, prop: 'ladle', ai: 'melee', hp: 70, spd: 105, dmg: 14, r: 17, cost: 1.5, gold: 4, range: 85, arc: 1.4, windup: 0.55, cd: 1.3, draw: 'worn', col: '#a8b8cc', col2: '#1a0f2a', desc: 'Somebody who was selling something when the night stopped. Hit it until the dark leaves, and the person goes back to standing still.' },
  wdancer: { name: 'Worn Dancer', worn: true, prop: 'sash', ai: 'dasher', hp: 62, spd: 140, dmg: 16, r: 16, cost: 2, gold: 5, draw: 'worn', col: '#c8a8c8', col2: '#1a0f2a', desc: 'The festival dance, with the joy taken out and the speed left in.' },
  wlantern: { name: 'Worn Lantern-Bearer', worn: true, prop: 'lantern', ai: 'shooter', hp: 44, spd: 90, dmg: 10, r: 16, cost: 1.8, gold: 4, shots: 3, spread: 0.22, cd: 2.2, pspeed: 280, keep: 320, draw: 'worn', col: '#ffb46a', col2: '#1a0f2a', desc: 'The flame in that lantern stopped years ago. It only moves when the thing holding it wants it to.' },
  wfan: { name: 'Worn Fan-Seller', worn: true, prop: 'fan', ai: 'spinner', hp: 80, spd: 78, dmg: 10, r: 18, cost: 2.5, gold: 6, draw: 'worn', col: '#e88aa0', col2: '#1a0f2a', desc: 'It turns and turns, showing you the goods. Every fan is sharp now.' },
  wporter: { name: 'Worn Porter', worn: true, prop: 'pole', ai: 'brute', hp: 190, spd: 70, dmg: 24, r: 28, cost: 3.2, gold: 8, kbRes: 0.6, draw: 'worn', col: '#8a9ab0', col2: '#1a0f2a', desc: 'One of the men carrying the festival shrine. The others are still holding up their side.' },
});

/* ---------------- Okina ---------------- */
Object.assign(BOSSES, {
  okina: { id: 'okina', name: 'Okina', title: 'Master of the Festival', jp: '祭の主 翁', hp: 7800, r: 34, spd: 95, dmg: 20, draw: 'okina', col: '#e8dcc8', kbRes: 1,
    pal: { hair: '#e8e4dc', hair2: '#b8b4ac', skin: '#efe6d4', outfit: '#8a2230', outfit2: '#4a1018', eye: '#1a0f2a', accent: '#e8c050', scarf: '#e8c050', acc2: '#c8a050' }, hair: 'short', acc: null,
    desc: 'He ran the festival for forty years and let the children win at every game. Something else is finishing the dance now.',
    phases: [0.62, 0.3],
    patterns: [['sleeveSweep', 'lanternRain', 'festivalDrum'], ['sleeveSweep', 'lanternRain', 'festivalDrum', 'hangingSnow', 'everyoneHere'], ['festivalDrum', 'hangingSnow', 'lanternRain', 'everyoneHere', 'lastDance']],
    desperation: { at: 0.1, pat: 'finalBow' } },
});
Object.assign(CAST, {
  okina: { name: 'Okina', pal: BOSSES.okina.pal, hair: 'short', acc: null, mask: true },
  ume: { name: 'Ume', pal: frostPal({ hair: '#3a2a2a', hair2: '#2a1c1c', skin: '#f2d6b8', outfit: '#c84a6a', outfit2: '#7a2a40', eye: '#3a2a1a', accent: '#f2e6c8', scarf: '#f2e6c8', acc2: '#7a2a40' }, 0.28), hair: 'bun', acc: null, eyesClosed: true },
});

/* Pulls a palette toward the colour of old ice. */
function frostPal(pal, k = 0.45) {
  const out = {};
  for (const key in pal) {
    const v = parseInt(pal[key].slice(1), 16), r = v >> 16, g = (v >> 8) & 255, b = v & 255;
    const mix = (a, to) => Math.round(a + (to - a) * k).toString(16).padStart(2, '0');
    out[key] = '#' + mix(r, 0xc8) + mix(g, 0xdc) + mix(b, 0xf0);
  }
  return out;
}

/* ---------------- drawing ---------------- */
const TOWNSFOLK = [['#c84a6a', '#7a2a40'], ['#4a6a9a', '#2a3e5e'], ['#c8a050', '#7a5a2a'], ['#5a8a6a', '#2f5a42'], ['#8a5ab0', '#4a2a6a'], ['#b0683a', '#6a3a1e']].map(([outfit, outfit2]) =>
  frostPal({ hair: '#2a2430', hair2: '#1a1620', skin: '#f2d6b8', outfit, outfit2, eye: '#2a2a3a', accent: '#f2e6c8', scarf: '#e8d8c0', acc2: '#6a5a4a' }));
const WORN_PAL = {};
function wornPal(col) { return WORN_PAL[col] = WORN_PAL[col] || Object.assign(frostPal({ hair: '#2a2430', hair2: '#1a1620', skin: '#e8d0b8', outfit: col, outfit2: '#2a2838', accent: '#e8e4dc', scarf: '#2a1a3a', acc2: '#1a0f2a', eye: '#000000' }, 0.3), { eye: '#0a0612' }); }

function drawPropHeld(ctx, kind, x, y, s, t, lit) {
  if (kind === 'fan') {
    ctx.fillStyle = '#f0d0d8'; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, s * 1.1, -2.5, -0.65); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a84a6a'; ctx.lineWidth = 1; for (let i = 0; i < 5; i++) { const a = -2.5 + i * 0.46; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * s * 1.1, y + Math.sin(a) * s * 1.1); ctx.stroke(); }
  } else if (kind === 'lantern') {
    ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - s * 0.7); ctx.stroke();
    ctx.fillStyle = '#e8863a'; ell(ctx, x, y + s * 0.3, s * 0.42, s * 0.55);
    if (lit) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,160,70,.3)'; circ(ctx, x, y + s * 0.3, s * 1.1); ctx.restore(); }
  } else if (kind === 'ladle') {
    ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * 0.9, y - s * 1.1); ctx.stroke();
    ctx.fillStyle = '#5a4030'; ell(ctx, x + s * 1.0, y - s * 1.25, s * 0.35, s * 0.25);
  } else if (kind === 'pole') {
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x - s * 2, y - s * 1.8, s * 4, s * 0.3);
  } else if (kind === 'sash') {
    ctx.strokeStyle = '#d8688a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s, y - s * (1 + Math.sin(t * 6) * 0.4), x + s * 1.6, y + s * 0.3); ctx.stroke();
  } else if (kind === 'dango') {
    ctx.strokeStyle = '#c8b090'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * 0.6, y - s); ctx.stroke();
    ['#f0c0d0', '#f0f0e8', '#a8d0a0'].forEach((c, i) => { ctx.fillStyle = c; circ(ctx, x + s * (0.2 + i * 0.16), y - s * (0.35 + i * 0.27), s * 0.17); });
  }
}
/* A person stopped mid-moment, with a few flakes hanging around them. */
function drawFrozenPerson(ctx, x, y, seed, o = {}) {
  const s = o.s || 13, a = o.look === undefined ? seed : o.look;
  const pal = o.pal || TOWNSFOLK[Math.floor(seed * 7.3) % TOWNSFOLK.length];
  const hair = o.hair || ['short', 'bun', 'ponytail', 'long'][Math.floor(seed * 3.1) % 4];
  drawChar(ctx, { x, y, s, lookX: Math.cos(a), lookY: Math.abs(Math.sin(a)), pal, t: 0, moving: !!o.running, hair, acc: null, mood: 'happy', eyesClosed: !!o.eyesClosed });
  if (o.prop) drawPropHeld(ctx, o.prop, x + s * 0.95, y - s * 1.1, s, 0, true);
  ctx.fillStyle = 'rgba(235,245,255,.8)';
  for (let i = 0; i < 5; i++) circ(ctx, x + Math.sin(seed + i * 2.4) * s * 1.7, y - s * 2 + Math.cos(seed * 2 + i * 1.7) * s * 1.6, 1.3);
}
function drawFrozenNpc(ctx, n) {
  if (n.twitch) { const k = Math.floor(G.t * 9) % 2 ? 1.2 : -1.2; ctx.save(); ctx.translate(k, 0); drawFrozenPerson(ctx, n.x, n.y, n.seed, n.look !== undefined ? Object.assign({}, n.opt, { look: G.t * 0.7 }) : n.opt); ctx.restore(); return; }
  drawFrozenPerson(ctx, n.x, n.y, n.seed, n.opt);
}
/* The props that fill the streets: frozen crowds, stopped lanterns and stalls. */
function drawTokoyoProp(ctx, o, x, y, r, t) {
  ctx.fillStyle = 'rgba(210,228,245,.28)'; ell(ctx, x, y, r * 1.1, r * 0.45);
  if (o.seed < 50) {
    drawFrozenPerson(ctx, x - (r > 34 ? 14 : 0), y, o.seed, { prop: ['fan', 'dango', 'lantern', null][Math.floor(o.seed) % 4] });
    if (r > 34) drawFrozenPerson(ctx, x + 16, y + 3, o.seed + 9, { prop: Math.floor(o.seed) % 2 ? 'dango' : null });
  } else if (o.seed < 75) {
    ctx.fillStyle = '#3a2a20'; ctx.fillRect(x - 3, y - r * 2.6, 6, r * 2.6);
    ctx.fillRect(x - r * 0.8, y - r * 2.6, r * 1.6, 4);
    for (const s of [-1, 1]) { ctx.fillStyle = '#e8863a'; ell(ctx, x + s * r * 0.65, y - r * 2.15, r * 0.3, r * 0.38); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,160,70,.2)'; circ(ctx, x + s * r * 0.65, y - r * 2.15, r * 0.8); ctx.restore(); }
  } else {
    ctx.fillStyle = '#4a3a2c'; ctx.fillRect(x - r, y - r * 0.8, r * 2, r * 0.8);
    ctx.fillStyle = '#3a2a20'; ctx.fillRect(x - r, y - r * 2.2, 4, r * 1.5); ctx.fillRect(x + r - 4, y - r * 2.2, 4, r * 1.5);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#e8e4dc' : '#b84a5a'; ctx.fillRect(x - r * 1.15 + i * r * 0.383, y - r * 2.45, r * 0.39, r * 0.45); }
  }
}
Object.assign(EDRAW, {
  seep(ctx, e, t, f) {
    const x = e.x, y = e.y - 8, r = e.r, w = Math.sin(t * 9 + e.x) * 2;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(ctx, e.x, e.y, r, r * 0.35);
    ctx.fillStyle = f ? '#fff' : e.def.col; ell(ctx, x, y, r + w * 0.4, r * 0.85 - w * 0.3);
    circ(ctx, x - r * 0.7, y + r * 0.5, r * 0.3); circ(ctx, x + r * 0.7, y + r * 0.5, r * 0.3);
    ctx.fillStyle = '#e8e4dc'; ctx.strokeStyle = '#e8e4dc'; ctx.lineWidth = 1.5;
    circ(ctx, x - 3, y - 2, 1.3); circ(ctx, x + 3, y - 2, 1.3);
    ctx.beginPath(); ctx.arc(x, y, 4, 0.3, Math.PI - 0.3); ctx.stroke();
  },
  worn(ctx, e, t, f) {
    const d = e.def, s = e.r * 0.78, jerk = Math.floor(t * 8) / 8, lx = Math.cos(e.face), ly = Math.sin(e.face);
    // the dark leaking out of them
    ctx.fillStyle = 'rgba(26,15,42,.65)'; ell(ctx, e.x, e.y, s * 1.35, s * 0.5);
    for (let i = 0; i < 4; i++) { const k = (t * 0.9 + i / 4) % 1; ctx.fillStyle = `rgba(26,15,42,${0.85 * (1 - k)})`; circ(ctx, e.x + Math.sin(i * 2.1 + e.x) * s * 1.1, e.y - k * s * 3, s * 0.42 * (1 - k * 0.5)); }
    drawChar(ctx, { x: e.x, y: e.y, s, lookX: lx, lookY: ly, pal: wornPal(d.col), t: jerk, moving: e.moving, flash: f, hair: d.prop === 'pole' ? 'short' : d.prop === 'sash' ? 'long' : 'bun', acc: null, mood: 'happy' });
    drawPropHeld(ctx, d.prop, e.x + lx * s * 0.9, e.y - s * 1.15, s, jerk, d.prop === 'lantern');
    // veins of it, over the smile that never changes
    ctx.strokeStyle = 'rgba(26,15,42,.9)'; ctx.lineWidth = Math.max(1.5, s * 0.14); const hy = e.y - s * 2.6;
    if (ly > -0.3) for (const side of [-1, 1]) {
      const ex = e.x + lx * s * 0.32 + side * s * 0.34, ey = hy + s * 0.28;
      ctx.fillStyle = '#0a0612'; ell(ctx, ex, ey, s * 0.22, s * 0.3);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(192,132,255,.9)'; circ(ctx, ex, ey, s * 0.09); ctx.restore();
      ctx.beginPath(); ctx.moveTo(ex, ey + s * 0.25); ctx.lineTo(ex + side * s * 0.12, ey + s * 0.6); ctx.lineTo(ex - side * s * 0.02, ey + s * 0.95); ctx.stroke();
    }
  },
  okina(ctx, e, t, f) { drawOkina(ctx, e.x, e.y, e, t, f); },
});
function drawNoMask(ctx, x, y, s, tilt, cracked, flash) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
  ctx.fillStyle = flash ? '#fff' : '#f2ead8'; ell(ctx, 0, 0, s * 0.85, s * 1.02);
  ctx.strokeStyle = '#2a1a1a'; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.arc(side * s * 0.34, -s * 0.12, s * 0.2, Math.PI + 0.3, -0.3); ctx.stroke(); // laughing eyes
    ctx.strokeStyle = 'rgba(90,70,60,.6)'; ctx.lineWidth = s * 0.05;
    ctx.beginPath(); ctx.arc(side * s * 0.42, s * 0.22, s * 0.18, 0.4, 2.4); ctx.stroke(); // creased cheeks
    ctx.strokeStyle = '#2a1a1a'; ctx.lineWidth = s * 0.09;
  }
  ctx.fillStyle = '#6a2a2a'; ctx.beginPath(); ctx.arc(0, s * 0.38, s * 0.36, 0.1, Math.PI - 0.1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8e4dc';
  for (const side of [-1, 1]) ell(ctx, side * s * 0.32, -s * 0.52, s * 0.2, s * 0.08, side * -0.2); // brows
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * s * 0.12 - s * 0.05, s * 0.8); ctx.lineTo(i * s * 0.14, s * 1.42 - Math.abs(i) * s * 0.12); ctx.lineTo(i * s * 0.12 + s * 0.05, s * 0.8); ctx.fill(); } // beard
  if (cracked) {
    ctx.strokeStyle = '#1a0f2a'; ctx.lineWidth = s * 0.07;
    ctx.beginPath(); ctx.moveTo(s * 0.5, -s * 0.8); ctx.lineTo(s * 0.18, -s * 0.3); ctx.lineTo(s * 0.32, s * 0.05); ctx.lineTo(s * 0.05, s * 0.3); ctx.stroke();
  }
  ctx.restore();
}
/* The mask looks at you first, and the body follows a moment later. */
function drawOkina(ctx, x, y, e, t, f) {
  const sc = 2.1, s = 13 * sc, frozen = !!e.frozen, phase = e.phase || 0;
  if (!frozen && e.face !== undefined) {
    const turn = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
    e.maskA = turn(e.maskA === undefined ? e.face : e.maskA, e.face, 0.12);
    e.bodyA = turn(e.bodyA === undefined ? e.face : e.bodyA, e.maskA, 0.025);
  }
  const body = e.bodyA || 0, mask = e.maskA === undefined ? Math.PI / 2 : e.maskA;
  const d = BOSSES.okina, pal = frozen ? frostPal(d.pal, 0.5) : d.pal, tt = frozen ? 0 : t;
  const dance = frozen ? 1 : 0.65 + Math.sin(tt * 1.6) * 0.35;
  if (!frozen) for (let i = 0; i < 4; i++) { const k = (t * 0.6 + i / 4) % 1; ctx.fillStyle = `rgba(26,15,42,${(0.3 + phase * 0.15) * (1 - k)})`; circ(ctx, x + Math.sin(i * 2 + 1) * s * 1.2, y - k * s * 1.4, s * 0.4 * (1 - k * 0.4)); }
  drawChar(ctx, { x, y, s, lookX: Math.cos(body), lookY: Math.sin(body), pal, t: tt, moving: !!e.moving, flash: f, hair: 'short', acc: null, noShadow: false });
  // great sleeves, one always raised mid-dance
  ctx.fillStyle = f ? '#fff' : pal.outfit;
  ctx.beginPath(); ctx.moveTo(x - s * 0.75, y - s * 1.9); ctx.quadraticCurveTo(x - s * 2.1, y - s * 2.1, x - s * 1.8, y - s * 0.75); ctx.lineTo(x - s * 0.85, y - s * 1.0); ctx.fill();
  const raise = s * 1.6 * dance;
  ctx.beginPath(); ctx.moveTo(x + s * 0.75, y - s * 1.9); ctx.quadraticCurveTo(x + s * 1.7, y - s * 2.0 - raise * 0.5, x + s * 1.5, y - s * 2.3 - raise); ctx.lineTo(x + s * 0.85, y - s * 1.25); ctx.fill();
  ctx.fillStyle = f ? '#fff' : pal.accent; ctx.fillRect(x - s * 0.8, y - s * 1.1, s * 1.6, s * 0.18);
  drawPropHeld(ctx, 'fan', x + s * 1.5, y - s * 2.3 - raise, s * 0.8, tt);
  // the mask
  const hy = y - s * 2.6, lean = e.bodyA === undefined ? 0 : Math.sin(tt * 2.7) * 0.03;
  drawNoMask(ctx, x + Math.cos(mask) * s * 0.28, hy + s * 0.15 + Math.sin(mask) * s * 0.1, s * 0.95, (frozen ? e.tilt || 0 : Math.cos(mask) * 0.32) + lean, phase >= 2, f);
  if (frozen) { ctx.fillStyle = 'rgba(235,245,255,.8)'; for (let i = 0; i < 12; i++) circ(ctx, x + Math.sin(i * 2.4) * s * 2.2, y - s * 2 + Math.cos(i * 1.7) * s * 2, 1.5); }
}
function drawOkinaStatue(ctx, n) { drawOkina(ctx, n.x, n.y, n, G.t, false); }
function drawStage(ctx, n, t) {
  const x = n.x, y = n.y, w = n.w;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x - w / 2 + 8, y + 150, w - 16, 18);
  ctx.fillStyle = '#3a2a22'; ctx.fillRect(x - w / 2, y - 80, w, 230);
  ctx.strokeStyle = '#2a1c16'; ctx.lineWidth = 2; for (let i = 1; i < 6; i++) { const py = y - 80 + i * 38; ctx.beginPath(); ctx.moveTo(x - w / 2, py); ctx.lineTo(x + w / 2, py); ctx.stroke(); }
  ctx.fillStyle = '#6a2030'; ctx.fillRect(x - w / 2, y + 138, w, 12);
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#7a1a22'; ctx.fillRect(x + s * w / 2 - 8, y - 240, 16, 390);
    for (let i = 0; i < 5; i++) { const lx = x + s * (w / 2 - 34 - i * 82), ly = y - 210 + Math.abs(i - 2) * 6; ctx.strokeStyle = '#2a1c16'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx, y - 236); ctx.lineTo(lx, ly); ctx.stroke(); ctx.fillStyle = '#e8863a'; ell(ctx, lx, ly + 10, 13, 17); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,160,70,.18)'; circ(ctx, lx, ly + 10, 34); ctx.restore(); }
  }
  ctx.fillStyle = '#7a1a22'; ctx.fillRect(x - w / 2 - 8, y - 244, w + 16, 12);
}
function drawAllyNpc(ctx, n, t) {
  const c = CAST[n.cast], a = n.aim === undefined ? -Math.PI / 2 : n.aim;
  drawChar(ctx, { x: n.x, y: n.y, s: 13, lookX: Math.cos(a), lookY: Math.sin(a), pal: c.pal, t, moving: !!n.moving, hair: c.hair, acc: c.acc, eyesClosed: c.eyesClosed, mood: n.mood || null });
}
function drawPontaHammer(ctx, n, t) {
  drawNpcChar(ctx, n, t);
  const k = Math.max(0, Math.sin(t * 9));
  ctx.save(); ctx.translate(n.x + 18, n.y - 28); ctx.rotate(-1 + k * 1.1);
  ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(22, 0); ctx.stroke();
  ctx.fillStyle = '#8a8a94'; ell(ctx, 26, 0, 7, 5); ctx.restore();
  ctx.fillStyle = '#4a4a58'; rrect(ctx, n.x + 30, n.y - 14, 34, 18, 4); ctx.fill();
  ctx.fillStyle = '#6a6a78'; ctx.fillRect(n.x + 36, n.y - 26, 20, 12);
  if (k > 0.95) { ctx.fillStyle = '#ffd56b'; for (let i = 0; i < 3; i++) circ(ctx, n.x + 40 + i * 6, n.y - 28 - i * 3, 1.6); }
}
function drawFanStall(ctx, n, t) {
  const x = n.x, y = n.y;
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ell(ctx, x, y + 24, 118, 26);
  ctx.fillStyle = '#4a3a2c'; ctx.fillRect(x - 95, y - 26, 190, 50);
  ctx.fillStyle = '#3a2a20'; ctx.fillRect(x - 95, y - 118, 7, 92); ctx.fillRect(x + 88, y - 118, 7, 92);
  for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? '#e8e4dc' : '#c84a6a'; ctx.fillRect(x - 108 + i * 24, y - 140, 24, 28); }
  for (let i = 0; i < 6; i++) drawPropHeld(ctx, 'fan', x - 72 + i * 29, y - 16, 15, 0);
  drawFrozenPerson(ctx, x - 44, y - 42, 2, { pal: CAST.ume.pal, hair: 'bun', eyesClosed: true, prop: 'fan' });
}
function drawStillBrazier(ctx, n, t) {
  const x = n.x, y = n.y;
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ell(ctx, x, y + 10, 62, 16);
  ctx.fillStyle = '#3a3440'; ctx.beginPath(); ctx.moveTo(x - 44, y - 34); ctx.lineTo(x + 44, y - 34); ctx.lineTo(x + 26, y + 6); ctx.lineTo(x - 26, y + 6); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const a = n.used ? 0.12 : 0.6;
  // the flames do not flicker: they stopped with everything else
  [[-22, 26], [-8, 44], [8, 36], [22, 24]].forEach(([dx, h]) => { ctx.fillStyle = `rgba(255,140,50,${a})`; ctx.beginPath(); ctx.moveTo(x + dx - 10, y - 34); ctx.quadraticCurveTo(x + dx - 4, y - 34 - h * 0.7, x + dx, y - 34 - h); ctx.quadraticCurveTo(x + dx + 4, y - 34 - h * 0.7, x + dx + 10, y - 34); ctx.fill(); });
  ctx.fillStyle = `rgba(255,140,50,${a * 0.2})`; circ(ctx, x, y - 50, 90);
  ctx.restore();
}
function drawOmikuji(ctx, n, t) {
  const x = n.x, y = n.y;
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ell(ctx, x, y + 6, 40, 12);
  ctx.fillStyle = '#7a1a22'; rrect(ctx, x - 26, y - 62, 52, 66, 5); ctx.fill();
  ctx.fillStyle = '#e8dcc8'; ctx.font = '900 22px serif'; ctx.textAlign = 'center'; ctx.fillText('祭', x, y - 20);
  ctx.fillStyle = '#3a2a22'; ctx.fillRect(x - 34, y - 70, 68, 9);
  for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(235,245,255,.75)'; circ(ctx, x + Math.sin(i * 2.4) * 46, y - 50 + Math.cos(i * 1.7) * 36, 1.4); }
}

/* ---------------- how Okina fights ---------------- */
const SNOW = '#dcecff', PAPER = '#f0d0d8', LANTERN_C = '#ffa050';
function closingRing(e, n, radius, speed, gapWidth) {
  const gap = rand(0, TAU), R = G.room, cx = P.x, cy = P.y - 16;
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, off = Math.abs(Math.atan2(Math.sin(a - gap), Math.cos(a - gap)));
    if (off < gapWidth) continue;
    const x = cx + Math.cos(a) * radius, y = cy + Math.sin(a) * radius;
    if (x < R.x0 + WALL || x > R.x0 + R.w - WALL || y < R.y0 + WALL_TOP || y > R.y0 + R.h - WALL) continue;
    G.eProj({ x, y, ang: a + Math.PI, speed, dmg: e.dmg * 0.7, r: 9, color: PAPER, kind: 'orb', life: radius / speed + 0.6 });
  }
}
Object.assign(BOSS_PAT, {
  sleeveSweep(e) {
    const base = angTo(e, P), n = 2 + e.phase;
    for (let i = 0; i < n; i++) {
      const dir = (i % 2 ? -1 : 1) * e.strafe;
      G.after(i * 0.55, () => {
        const a = base + dir * 0.75;
        G.addZone({ shape: 'cone', x: e.x, y: e.y, r: 320, ang: a, arc: 1.5, warn: 0.5, dmg: e.dmg * 1.15, owner: e, color: PAPER,
          onFire: z => { G.fxSlash({ x: z.x, y: z.y - 20, r: 290, ang: z.ang, arc: 1.5, color: PAPER, dur: 0.25, width: 1.8 }); SFX.play('slash');
            for (let k = -3; k <= 3; k++) G.eProj({ x: z.x, y: z.y - 40, ang: z.ang + k * 0.2, speed: 300, dmg: e.dmg * 0.55, r: 8, color: PAPER, kind: 'orb', life: 2.6 }); } });
      }, e);
    }
    e.busy = 0.5 + n * 0.55;
  },
  lanternRain(e) {
    const n = 6 + e.phase * 3;
    if (Math.random() < 0.5) G.say(e, 'Such a fine night.', 1.6);
    for (let i = 0; i < n; i++) {
      G.after(i * 0.14, () => {
        const p = G.clampToArena(P.x + rand(-210, 210), P.y + rand(-170, 170), 50);
        G.addZone({ shape: 'circle', x: p.x, y: p.y, r: 80, warn: 0.85, dmg: e.dmg, owner: e, color: LANTERN_C,
          onFire: z => { G.parts.burst(z.x, z.y, 12, { type: 'glow', color: LANTERN_C, min: 60, max: 220, size: 3 }); SFX.play('burn', 0.5);
            if (e.phase >= 1) for (let k = 0; k < 4; k++) G.eProj({ x: z.x, y: z.y - 10, ang: k * TAU / 4 + 0.78, speed: 210, dmg: e.dmg * 0.5, r: 7, color: LANTERN_C, kind: 'orb', life: 1.6 }); } });
      }, e);
    }
    e.busy = 0.9 + n * 0.14;
  },
  festivalDrum(e) {
    const beats = 3 + e.phase, x = e.x, y = e.y;
    for (let i = 0; i < beats; i++) {
      G.after(i * 0.56, () => {
        const r = 30 + i * 125;
        G.addZone({ shape: 'ring', x, y, r, r2: r + 96, warn: 0.5, dmg: e.dmg, owner: e, color: '#e8dcc8',
          onFire: () => { G.shake(5); SFX.play('heavy', 0.7); G.fxRing(x, y, r + 96, '#e8dcc8', 0.25, 6); } });
      }, e);
    }
    e.busy = 0.8 + beats * 0.56;
  },
  /* The snow in the air is as hard as whatever hit it last. */
  hangingSnow(e) {
    const R = G.room, n = 16 + e.phase * 6, delay = 1.5;
    SFX.play('tick');
    for (let i = 0; i < n; i++) {
      let x, y, tries = 0;
      do { x = rand(R.x0 + WALL + 30, R.x0 + R.w - WALL - 30); y = rand(R.y0 + WALL_TOP + 30, R.y0 + R.h - WALL - 30); } while (Math.hypot(x - P.x, y - P.y) < 170 && tries++ < 8);
      G.eProj({ x, y, ang: 0, speed: 0, dmg: e.dmg * 0.55, r: 7, color: SNOW, kind: 'orb', life: delay + 2.6, delayAim: delay + i * 0.02, aimSpeed: 430 });
    }
    e.busy = delay + 0.6;
  },
  everyoneHere(e) {
    G.say(e, 'Everyone is here.', 2);
    SFX.play('bell');
    if (G.enemies.filter(x => !x.dead && x.minion).length < 4) {
      const ids = e.phase >= 2 ? ['wdancer', 'wlantern', 'wvendor'] : ['wvendor', 'wlantern'];
      for (const id of ids) { const p = G.clampToArena(e.x + rand(-300, 300), e.y + rand(-80, 240), 60); G.spawnEnemy(id, p.x, p.y, { minion: true, hpMult: 0.7 }); }
    }
    e.busy = 1.0;
  },
  lastDance(e) {
    G.say(e, 'Stay for the last dance.', 2);
    SFX.play('bell');
    closingRing(e, 40, 500, 190, 0.34);
    G.after(1.25, () => closingRing(e, 40, 500, 190, 0.3), e);
    e.busy = 2.3;
  },
  finalBow(e) {
    G.say(e, 'It is always the last dance.', 3);
    SFX.play('roar'); G.flash('#dcecff', 0.4);
    e.invulnT = 1;
    for (let i = 0; i < 3; i++) G.after(i * 1.1, () => { closingRing(e, 44, 520, 210, 0.3); G.fxRing(e.x, e.y, 300, PAPER, 0.5, 8); SFX.play('heavy'); }, e);
    e.busy = 3.6;
  },
});

/* ---------------- the script ---------------- */
const STORY4 = {
  opening: [
    ['narrator', 'The rift has stopped growling.'],
    ['sekka', 'It has settled. We can cross.'],
    ['kuroto', 'You look terrible.'],
    ['sekka', 'I always look like this.'],
    ['kuroto', 'No. You don\'t.'],
    ['$h', 'Is it safe?'],
    ['sekka', 'It will not grind you to paste. That is the most anyone can promise.'],
    ['$h', 'And my friends are in there?'],
    ['sekka', 'Scattered across it. I can hear them.'],
    ['kuroto', 'Stay near me when we land. The first thing you\'ll want to do over there is stand still and look. Don\'t.'],
  ],
  arriveA: [
    ['narrator', 'The snow doesn\'t fall. It hangs. Every flake sits where it stopped. A festival fills the street, and nobody in it is moving.'],
    ['$h', '...Are they dead?'],
    ['sekka', 'No. It is still the same night here. It has been the same night for a very long time.'],
    ['$h', 'Can they hear us?'],
    ['sekka', 'I used to ask them that.'],
  ],
  arriveB: [
    ['sekka', 'This is Ume. She sells fans. Her knee hurts when it rains. That is Haruki, and he is about to be told off for running.'],
    ['$h', 'You know all of them?'],
    ['sekka', 'There has been time.'],
    ['kuroto', 'Haruki steals plums. Ume overcharges. Don\'t touch the snow. It\'s exactly as hard as whatever hit it last.'],
    ['narrator', 'Sekka looks at him for a moment. Neither says anything. They both know this street.'],
  ],
  arriveC: [
    ['narrator', 'Further in, a frozen vendor twitches. Something dark moves behind their eyes. The vendor\'s head turns, and the smile doesn\'t change.'],
    ['$h', 'You said nobody moves here!'],
    ['kuroto', 'Nobody does. That\'s not somebody. That\'s a Worn. The thing you killed at the bottom left its filth in every crack in every world. It climbs inside them and walks them around.'],
    ['sekka', 'They can be freed. The same way as your gods.'],
    ['kuroto', 'By hitting them until it leaves.'],
    ['sekka', 'That is what I said.'],
  ],
  rescue: [
    ['narrator', 'Behind the festival stage, among racks of frozen lanterns, one small and very much unfrozen tanuki is hammering at a Worn\'s discarded armor with a stolen ladle.'],
    ['ponta', '— and ANOTHER thing, you\'ve got the temper all wrong on this, who forged this, a child? Moonbound! MOONBOUND! Did you know they don\'t have tea here?!'],
    ['$h', 'Ponta! You can move!'],
    ['ponta', 'I\'m extremely moving! It\'s the only thing happening for miles! The coals won\'t catch, the water won\'t pour, I\'ve been shouting at a frozen man for what I think is a week!'],
    ['sekka', 'It only holds what was here that night. You are a visitor.'],
    ['ponta', 'Well, the hospitality is DREADFUL. ...Who\'s that?'],
    ['kuroto', 'Nobody.'],
    ['ponta', 'Well, nobody\'s got a bad grip on that spear. I can fix that. Get me back to my forge.'],
  ],
  hanabi: [
    ['narrator', 'A faint voice carries down the street: "...and I SAID, this is NOT how you fold an aburaage..."'],
    ['sekka', 'Your fox\'s clock is still ticking.'],
    ['$h', 'Is that —'],
    ['kuroto', 'Long way up. Move.'],
  ],
  forge: [
    ['narrator', 'Back at the ruined shrine, the forge is relit and Ponta stands at it again. The first piece of the shrine has come back.'],
  ],
};
Object.assign(BOSS_TALK, {
  okina: [
    [['narrator', 'At the top of the street, on a stage hung with lanterns, stands a huge figure in festival robes and a smiling old man\'s mask. He is mid-dance, one sleeve raised. The mask tilts toward you, and the rest of him follows a moment later.'],
      ['sekka', 'Okina-san ran this festival for forty years. He let the children win at every game and thought no one noticed.'],
      ['kuroto', 'He let me win too. Only one who ever did.'],
      ['okina', 'Such a fine night. Such a fine night. Such a fine night.'],
      ['kuroto', 'It\'s had him a long time. Don\'t let him finish the dance.'],
      ['$h', 'Can he hear us?'],
      ['sekka', 'Forgive me, Okina-san.']],
    [['okina', 'Such a fine night. Such a fine night.']],
  ],
  okina_defeat: [
    [['narrator', 'The dark pours out from under the mask and soaks into the cracks in the stage. Okina is frozen again, one sleeve raised. But his head has stopped at a new angle, and the mask is facing Sekka.'],
      ['$h', 'Is he looking at you?'],
      ['sekka', 'No. ...No. It is only the angle.'],
      ['narrator', 'Kuroto looks at her and says nothing.']],
    [['narrator', 'The dark soaks into the cracks in the stage. It will climb back up. Okina stands frozen, one sleeve raised.']],
  ],
});
TALKS.sekka.push({ id: 'tk_sekka1', cond: s => s.flags.newcomer === 'sekka' && s.flags.t_arrive, lines: [
  ['sekka', 'You walk into that street as if you expect to come back.'],
  ['$h', 'I do come back. It\'s the one thing I\'m good at.'],
  ['sekka', '...Yes. I would like to hear about that. Not today.'],
] });
TALKS.kuroto.push({ id: 'tk_kuroto1', cond: s => s.flags.newcomer === 'kuroto' && s.flags.t_arrive, lines: [
  ['kuroto', 'She\'s getting slower.'],
  ['$h', 'You sound worried.'],
  ['kuroto', 'I sound like a man counting. Everyone in that street knew me. I\'ve had a long time to learn what they look like not moving.'],
  ['$h', 'And you think she\'s doing it.'],
  ['kuroto', 'Ask her. See how fast she changes the subject.'],
] });
TALKS.ponta_t = [
  { id: 'pt_forget', cond: s => s.flags.t_rescue && s.runs >= (s.flags.t_rescueRuns || 0) + 3, lines: [
    ['ponta', 'Moonbound! Good. Who\'s your friend with the terrible grip?'],
    ['kuroto', 'We\'ve met.'],
    ['ponta', 'Have we? Ha! Must\'ve been a slow day.'],
    ['narrator', 'Kuroto says nothing.'],
  ] },
];
TALKS.ponta_t_idle = [
  [['ponta', 'A whole shrine, split like a bad casting, and the anvil survives. Tells you who the real god around here is.']],
  [['ponta', 'I made tea. Don\'t drink it. I\'m just glad the water pours.']],
  [['ponta', 'A week I shouted at that frozen man. I think we really connected.']],
  [['ponta', 'Bring me back a bit of that Worn armor. Not to use. I want to show it what proper work looks like.']],
];

/* ---------------- things to find in the street ---------------- */
const TOKOYO_SHOP_NAMES = {
  ramen: { name: 'Festival Dango', icon: '🍡', desc: 'Heal 35% HP. Still warm, after all these years.', fn: () => P.heal(P.stats.maxHp * 0.35) },
  sake: { name: 'Sweet Festival Sake', icon: '🍶' },
  onigiri: { name: 'Roast Sweet Potato', icon: '🍠', desc: '+12 Max HP.', fn: () => { G.run.bonusHp += 12; P.recompute(); P.heal(12); } },
  charm: { name: 'Paper Fortune', icon: '🎴' },
  scroll: { name: 'Keeper\'s Almanac', icon: '📜' },
  key: { name: 'Key from the Goldfish Game', icon: '🗝' },
};
const EVENTS3 = [
  { id: 'plum', title: 'Haruki\'s Plum', text: 'A boy is frozen mid-sprint with a stolen plum in his fist and a very satisfied look on his face. Behind him, a woman has just started to shout.',
    choices: [
      { label: 'Take the plum (heal 20%)', fn: () => { P.heal(P.stats.maxHp * 0.2); return 'It tastes like the last night of summer. You feel slightly guilty, and much better.'; } },
      { label: 'Leave a coin in his other hand (−30 gold, +1 reroll)', cond: () => G.run.gold >= 30, fn: () => { G.run.gold -= 30; G.run.rerolls++; return 'He will have no idea where it came from, whenever whenever is. The thread at your chest warms a little.'; } },
    ] },
  { id: 'goldfish', title: 'The Goldfish Game', text: 'A tub of water, stopped mid-ripple. The goldfish hang in it like beads. A paper net lies on the edge, and the coin box is open.',
    choices: [
      { label: 'Pay and play (−70 gold, gain a relic)', cond: () => G.run.gold >= 70, fn: () => { G.run.gold -= 70; G.giveRelic(); return 'You lift a fish out whole. It does not notice. There is something under it, at the bottom of the tub.'; } },
      { label: 'Reach in (−20% HP, gain 90 gold)', cond: () => P.hp > P.stats.maxHp * 0.3, fn: () => { P.hurtRaw(Math.round(P.stats.maxHp * 0.2)); G.addGold(90); return 'The water cuts like glass. The coins at the bottom come up with you anyway.'; } },
    ] },
  { id: 'omikuji', title: 'The Fortune Box', text: 'A festival fortune box, the sticks stopped mid-rattle. Somebody was halfway through asking it a question.',
    choices: [
      { label: 'Finish shaking it', fn: () => { if (Math.random() < 0.6) { G.addGold(60); P.heal(P.stats.maxHp * 0.1); return 'Great blessing, it says. Under that, in smaller writing: "Eventually."'; } P.hurtRaw(Math.round(P.stats.maxHp * 0.1)); G.addGold(30); return 'Great curse, it says. A stick flies out and cuts your hand. A few coins come with it.'; } },
      { label: 'Leave their question alone', fn: () => { P.heal(P.stats.maxHp * 0.05); return 'You leave it. Some things they should get to find out themselves.'; } },
    ] },
];

/* ---------------- how it plugs into the game ---------------- */
Object.assign(G, {
  riftSettled() { const f = SAVE.data.flags; return !!f.cs2 && (f.riftAt === undefined || SAVE.data.runs > f.riftAt); },
  riftNpc() {
    const open = this.riftSettled();
    return { id: 'rift', x: 1000, y: 600, r: 70, name: 'The Rift', prompt: open ? 'Cross into Tokoyo' : 'Peer into the rift', draw: () => {}, interact: () => {
      if (open) { UI.confirmRun(3); return; }
      UI.toast(pick(['The rift breathes cold air. It is not stable yet.', 'Far away, someone is complaining about fried tofu.', 'Your shard aches when you stand this close.', 'Sekka: "Not yet. Go and fight something while it settles."']), '#c8a8ff', 4);
    } };
  },
  pontaNpc() {
    return { id: 'ponta', x: 330, y: 660, r: 30, name: 'Ponta', prompt: 'Forge', cast: 'ponta', talkKey: 'ponta_t', draw: drawNpcChar, extra: drawAnvil, interact: () => {
      const S = SAVE.data;
      if (TALKS.ponta_t.some(e => !S.talked[e.id] && e.cond(S))) { this.talk('ponta_t'); return; }
      UI.menu('Ponta', 'Back at the anvil. Still won\'t stop talking about the tea.', [{ label: '⚒ Forge (Heroes & Forms)', fn: () => UI.forge() }, { label: '💬 Talk', fn: () => this.talk('ponta_t') }]);
    } };
  },
  /* Returns true when a shrine scene takes over the return to the hub. */
  tokoyoHubScene() {
    const S = SAVE.data, f = S.flags;
    if (f.t_rescue && !f.t_forge) {
      this.controlLocked = true;
      const other = f.newcomer === 'sekka' ? 'kuroto' : 'sekka';
      const ponta = this.npcs.find(n => n.id === 'ponta');
      this.runScript([
        { cam: [330, 620], fn: () => { if (ponta) { ponta.alpha = 0; ponta.appear = true; } SFX.play('clang'); this.parts.burst(380, 640, 18, { type: 'glow', color: '#ffb04d', min: 60, max: 240, size: 3 }); }, pre: 0.8, lines: STORY4.forge },
      ], () => {
        f.t_forge = true; SAVE.save();
        this.controlLocked = false;
        UI.banner('ACT I COMPLETE', 'The road goes on, up toward the Iron Keep. To be continued.', 'act');
        SFX.play('bell');
        UI.toast(`★ ${HEROES[other].name} is now playable! Visit the Altar of Heroes.`, HEROES[other].pal.scarf, 7);
        this.after(1.5, () => UI.toast('Ponta\'s Forge is back.', '#ffb04d', 5));
      });
      return true;
    }
    if (this.riftSettled() && !f.t_open) {
      this.controlLocked = true;
      this.runScript([{ cam: [1000, 620], pre: 0.8, lines: STORY4.opening }], () => {
        f.t_open = true; SAVE.save();
        this.controlLocked = false;
        UI.toast('The rift can be crossed now. It leads to Tokoyo.', '#c8a8ff', 6);
      });
      return true;
    }
    return false;
  },

  /* Someone standing in the scene with you. Sekka and Kuroto, unless you are playing one of them. */
  sceneAllies(positions) {
    const hero = this.run.hero, ids = ['sekka', 'kuroto'].filter(id => id !== hero);
    if (ids.length < 2) ids.push('akane');
    return ids.map((id, i) => {
      const [x, y] = positions[i];
      const n = { id: 'ally_' + id, ally: true, scenery: true, cast: id, x, y, r: 18, prompt: '', draw: drawAllyNpc, interact: () => {} };
      this.npcs.push(n);
      return n;
    });
  },
  dismissAllies() {
    const left = this.npcs.filter(n => n.ally);
    for (const n of left) this.parts.burst(n.x, n.y - 16, 12, { type: 'glow', color: '#c8a8ff', min: 60, max: 240, size: 3 });
    this.npcs = this.npcs.filter(n => !n.ally);
  },
  scenery(n) { Object.assign(n, { scenery: true, prompt: '', interact: () => {} }); this.npcs.push(n); return n; },
  clearProps(x, y, r) { this.obstacles = this.obstacles.filter(o => Math.hypot(o.x - x, o.y - y) > r + o.r); },

  /* Small tweens for people in scenes. Runs every frame in a room. */
  tokoyoTick(dt) {
    for (const n of this.npcs) {
      if (n.appear) { n.alpha = Math.min(1, (n.alpha || 0) + dt * 1.2); if (n.alpha >= 1) n.appear = false; }
      if (!n.goto) continue;
      const dx = n.goto.x - n.x, dy = n.goto.y - n.y, d = Math.hypot(dx, dy), step = 190 * dt;
      if (d <= step) { n.x = n.goto.x; n.y = n.goto.y; n.goto = null; n.moving = false; if (n.lookAt) n.aim = angTo(n, n.lookAt); }
      else { n.x += dx / d * step; n.y += dy / d * step; n.aim = Math.atan2(dy, dx); n.moving = true; }
    }
  },
  wornFreed(e) {
    if (this.scene !== 'run' || !this.room || this.npcs.filter(n => n.freed).length >= 16) return;
    this.parts.burst(e.x, e.y - 24, 14, { type: 'smoke', color: '#1a0f2a', min: 40, max: 170, size: 6, grav: -220 });
    this.scenery({ id: 'freed', freed: true, x: e.x, y: e.y, r: 14, seed: rand(0, 40), opt: { prop: e.def.prop === 'pole' || e.def.prop === 'sash' ? null : e.def.prop, s: Math.min(16, e.r * 0.78) }, alpha: 0, appear: true, draw: drawFrozenNpc });
    this.text(e.x, e.y - 58, 'freed', '#dcecff', 12);
  },

  tokoyoEnter(spec) {
    const S = SAVE.data;
    if (spec.actStart && !S.flags.t_arrive) { S.flags.t_arrive = true; SAVE.save(); this.tokoyoArrival(); }
  },
  tokoyoArrival() {
    const R = this.room, cx = R.x0 + R.w / 2, by = R.y0 + R.h;
    this.controlLocked = true;
    R.waveDelay = 1e9;
    const ume = { x: cx - 210, y: by - 360 }, haruki = { x: cx + 230, y: by - 400 }, vendor = { x: cx + 40, y: R.y0 + WALL_TOP + 180 };
    for (const p of [ume, haruki, vendor]) this.clearProps(p.x, p.y, 110);
    this.scenery({ id: 'ume', x: ume.x, y: ume.y, r: 14, seed: 2, opt: { pal: CAST.ume.pal, hair: 'bun', prop: 'fan', eyesClosed: true }, draw: drawFrozenNpc });
    this.scenery({ id: 'haruki', x: haruki.x, y: haruki.y, r: 14, seed: 5, opt: { s: 10, running: true, hair: 'short', look: -0.3, prop: 'dango' }, draw: drawFrozenNpc });
    const vend = this.scenery({ id: 'vendor', x: vendor.x, y: vendor.y, r: 14, seed: 11, opt: { prop: 'ladle', hair: 'bun', look: 1.57 }, draw: drawFrozenNpc });
    const [a, b] = this.sceneAllies([[cx - 90, P.y - 50], [cx + 90, P.y - 50]]);
    a.aim = b.aim = -Math.PI / 2;
    const sekka = this.npcs.find(n => n.cast === 'sekka') || a;
    this.runScript([
      { cam: [cx, by - 460], lines: STORY4.arriveA, pre: 1.0 },
      { fn: () => { if (sekka.cast === 'sekka') { sekka.goto = { x: ume.x + 55, y: ume.y + 25 }; sekka.lookAt = ume; } }, wait: 1.4 },
      { cam: [cx, by - 400], lines: STORY4.arriveB, pre: 0.2 },
      { cam: [vendor.x, vendor.y + 80], fn: () => { vend.twitch = true; vend.look = 0; SFX.play('tick'); }, wait: 1.3 },
      { lines: STORY4.arriveC, pre: 0.1 },
    ], () => {
      this.npcs = this.npcs.filter(n => n !== vend);
      this.parts.burst(vendor.x, vendor.y - 24, 16, { type: 'smoke', color: '#1a0f2a', min: 40, max: 170, size: 6, grav: -220 });
      this.spawnEnemy('wvendor', vendor.x, vendor.y, { noSpawn: true });
      this.dismissAllies();
      this.controlLocked = false;
      R.waveDelay = 0.5;
    });
  },
  tokoyoStation(spec) {
    const R = this.room, cx = R.x0 + R.w / 2, cy = R.y0 + R.h / 2 - 40;
    if (spec.type === 'shop') {
      this.npcs.push({ id: 'stall', x: cx, y: cy, r: 70, name: 'Ume\'s Fan Stall', prompt: 'Browse', draw: drawFanStall, interact: () => UI.shop() });
      this.genShop();
      this.room.shop.forEach(it => { if (TOKOYO_SHOP_NAMES[it.id]) Object.assign(it, TOKOYO_SHOP_NAMES[it.id]); });
      this.after(0.4, () => UI.toast('Nobody is minding the stall. Leave the coins on the counter.', '#dcecff'));
    } else if (spec.type === 'spring') {
      this.npcs.push({ id: 'brazier', x: cx, y: cy, r: 70, name: 'Stopped Brazier', prompt: 'Warm yourself', draw: drawStillBrazier, used: false,
        interact: n => { if (n.used) { UI.toast('You have taken all the warmth it can give.'); return; } n.used = true; P.heal(P.stats.maxHp * 0.35); this.flash('#ffb04d', 0.3); UI.toast('The flames don\'t move, but they are warm. Healed 35%.', '#ffcf40'); } });
    } else if (spec.type === 'event') {
      const ev = pick(EVENTS3);
      this.npcs.push({ id: 'event', x: cx, y: cy, r: 50, name: ev.title, prompt: 'Investigate', draw: drawOmikuji, used: false, ev,
        interact: n => { if (n.used) { UI.toast('Nothing more here.'); return; } UI.event(ev, () => { n.used = true; }); } });
    }
  },
  okinaIntro(meets) {
    const R = this.room, cx = R.x0 + R.w / 2;
    // drawY keeps the stage under everyone, wherever they stand
    this.scenery({ id: 'stage', x: cx, y: R.y0 + R.h * 0.3, drawY: -1e6, w: 860, draw: drawStage, r: 1 });
    const rnd = seeded(77);
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : -1, x = cx + side * (R.w / 2 - 110 - rnd() * 90), y = R.y0 + WALL_TOP + 160 + (i >> 1) * 130 + rnd() * 40;
      this.scenery({ id: 'crowd', x, y, r: 14, seed: rnd() * 40, opt: { prop: ['lantern', 'dango', 'fan', null][i % 4], look: side > 0 ? 3.14 : 0 }, draw: drawFrozenNpc });
    }
    if (!meets) {
      this.sceneAllies([[cx - 110, P.y - 60], [cx + 110, P.y - 60]]).forEach(n => { n.aim = -Math.PI / 2; });
      this.camTarget = { x: cx, y: R.y0 + R.h * 0.55 };
    }
  },
  /* He does not die. The dark leaves, and he stands still again. */
  okinaFalls(e) {
    const first = !SAVE.data.flags.t_rescue;
    const statue = this.scenery({ id: 'okinaStill', x: e.x, y: e.y, r: 34, frozen: true, phase: 0, draw: drawOkinaStatue, maskA: Math.PI / 2, bodyA: e.bodyA || 0, tilt: 0 });
    this.parts.burst(e.x, e.y - 60, 40, { type: 'smoke', color: '#1a0f2a', min: 60, max: 280, size: 9, grav: -200 });
    if (!first) return;
    const pos = [[P.x - 110, P.y + 10], [P.x + 110, P.y + 10]].map(([x, y]) => { const p = this.clampToArena(x, y, 50); return [p.x, p.y]; });
    const allies = this.sceneAllies(pos);
    for (const n of allies) n.aim = angTo(n, e);
    const sek = allies.find(n => n.cast === 'sekka') || { x: P.x, y: P.y };
    statue.maskA = angTo(statue, sek);
    statue.tilt = clamp(Math.cos(statue.maskA) * 0.55, -0.55, 0.55);
    this.camTarget = { x: (P.x + e.x) / 2, y: (P.y + e.y) / 2 };
  },
  okinaDefeated() {
    const S = SAVE.data, f = S.flags, run = this.run;
    S.clears4 = (S.clears4 || 0) + 1;
    S.clearsByHero[run.hero] = (S.clearsByHero[run.hero] || 0) + 1;
    this.addKeys(2); this.addShards(150);
    Music.play('victory');
    const end = () => { this.camTarget = null; this.endRun(true); };
    if (f.t_rescue) { SAVE.save(); this.after(0.8, end); return; }
    // saved now, so closing the game during the scene can't lose the rescue
    const other = f.newcomer === 'sekka' ? 'kuroto' : 'sekka';
    f.t_rescue = true; f.t_rescueRuns = S.runs; S.heroes[other].unlocked = true; SAVE.save();
    const R = this.room, x = R.x0 + R.w / 2 + 300, y = R.y0 + R.h * 0.3 - 40;
    this.scenery({ id: 'pontaFound', x, y, r: 30, cast: 'ponta', talkKey: 'ponta_t', draw: drawPontaHammer });
    this.runScript([
      { cam: [x, y + 80], lines: STORY4.rescue, pre: 0.5 },
      { cam: [R.x0 + R.w / 2, R.y0 + WALL_TOP + 160], lines: STORY4.hanabi, pre: 0.5 },
    ], end);
  },
});
