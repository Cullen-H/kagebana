'use strict';
/* =====================================================================
   KAGEBANA — ui.js
   All DOM interface: title, HUD, dialogue, cut-ins, boon cards, shop,
   events, Lantern Mirror, Forge, Altar, Pact, Codex, pause & results.
   ===================================================================== */

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const UI = {
  modal: false, onBoonDone: null, hudCache: {}, keyHandler: null, layers: 0,

  init() {
    this.hudEl = $('#hud'); this.modalEl = $('#modal'); this.panel = $('#modal .panel');
    this.dlg = $('#dialogue'); this.titleEl = $('#title');
    window.addEventListener('keydown', e => {
      if (this.keyHandler) this.keyHandler(e);
    });
    this.dlg.addEventListener('mousedown', () => this.advanceDialogue());
    document.addEventListener('mousedown', () => SFX.unlock(), { capture: true });
    document.addEventListener('contextmenu', e => { if (this.modal) e.preventDefault(); });
  },
  setModal(v) {
    this.modal = v;
    if (!v) { Input.clear(); }
  },

  /* ---------------- portraits ---------------- */
  portrait(cv, id, mood, face) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    const c = CAST[id];
    if (!c) return;
    if (c.kami) {
      const k = KAMI[c.kami];
      const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W / 2);
      g.addColorStop(0, rgba(k.color, 0.9)); g.addColorStop(1, rgba(k.color, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; ctx.font = `900 ${W * 0.45}px "Shippori Mincho", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(k.glyph, W / 2, H / 2);
      return;
    }
    if (c.mech) {
      ctx.save(); ctx.translate(W / 2, H * 1.05); ctx.scale(W / 190, W / 190);
      EDRAW.mecha(ctx, { x: 0, y: 0, r: 40, face: Math.PI / 2, moving: false, phase: 0 }, performance.now() / 1000, false);
      ctx.restore(); return;
    }
    const s = face ? W / 3.3 : W / 5.2;
    const py = face ? H * 0.42 + s * 2.6 : H + s * 1.1;
    drawChar(ctx, { x: W / 2, y: py, s, lookX: 0.15, lookY: 0.9, pal: c.pal, t: performance.now() / 1000, hair: c.hair, acc: c.acc, eyesClosed: c.eyesClosed, mood: mood || null, noShadow: true });
    if (c.mask) drawNoMask(ctx, W / 2, py - s * 2.45, s * 0.95, 0.08, false, false);
  },

  /* ---------------- title ---------------- */
  title() {
    this.showHud(false);
    this.setModal(true);
    Music.play('title');
    const has = SAVE.exists() && SAVE.data.runs > 0 || SAVE.data.flags.prologue;
    const t = this.titleEl;
    t.className = 'show';
    t.innerHTML = `
      <div class="logo">
        <div class="logo-jp">影花</div>
        <div class="logo-en">KAGEBANA</div>
        <div class="logo-sub">Requiem of the Eighth Moon</div>
      </div>
      <div class="title-menu">
        <button class="btn big" id="t-start">${has ? 'Continue' : 'Begin'}</button>
        <button class="btn" id="t-how">How to Play</button>
        <button class="btn" id="t-set">Settings</button>
        ${has ? '<button class="btn ghost" id="t-wipe">Erase Save</button>' : ''}
      </div>
      <div class="title-foot">${has ? `Runs ${SAVE.data.runs} · Clears ${SAVE.data.clears} · Moon Fragments ${SAVE.data.fragments.length}/8` : 'A roguelike of blades, Kami and broken moons'}</div>`;
    $('#t-start').onclick = () => {
      SFX.unlock(); SFX.play('uiok');
      t.className = '';
      this.setModal(false);
      G.transition(() => G.toHub());
    };
    $('#t-how').onclick = () => { SFX.play('ui'); this.howTo(true); };
    $('#t-set').onclick = () => { SFX.play('ui'); this.settings(true); };
    const w = $('#t-wipe');
    if (w) w.onclick = () => {
      if (w.dataset.armed) { SAVE.wipe(); SFX.play('uino'); this.title(); }
      else { w.dataset.armed = 1; w.textContent = 'Click again to erase everything'; }
    };
  },
  howTo(fromTitle) {
    this.open(`
      <h2>How to Play <span class="jp">遊び方</span></h2>
      <div class="how">
        <div><b>WASD</b> move · <b>Mouse</b> aim</div>
        <div><b>Left click / J</b> attack (hold for combos)</div>
        <div><b>Right click / K</b> special (cooldown)</div>
        <div><b>Space / Shift</b> dash — invincible while dashing</div>
        <div><b>Q / L</b> Ultimate when the gauge is full</div>
        <div><b>F / E</b> interact · <b>Esc</b> pause</div>
        <div class="muted">Gamepad: left stick move, right stick aim, X attack, Y special, A dash, RB ultimate, B interact.</div>
      </div>
      <p>Climb four Acts of nine rooms each. Pick a door, clear the room, claim its reward. Kami boons empower your <b>Attack</b>, <b>Special</b>, <b>Dash</b> and <b>Ultimate</b> with their element, and stack with passives and Duo boons.</p>
      <p>Red shapes on the ground are enemy attacks about to land — get out, or dash through. Hitting a winding-up foe hard enough interrupts it.</p>
      <p>When you fall, you return to the Shrine of Lanterns. Spirit Shards (魂) buy permanent upgrades; Moon Keys (鍵) unlock heroes and weapon Forms. Gather all eight Moon Fragments to see the true ending.</p>
      <div class="row-end"><button class="btn" data-close>Got it</button></div>`, () => { if (fromTitle) this.title(); });
  },

  /* ---------------- generic modal ---------------- */
  open(html, onClose, opts = {}) {
    this.setModal(true);
    this.modalEl.className = 'show' + (opts.wide ? ' wide' : '') + (opts.cls ? ' ' + opts.cls : '');
    this.panel.innerHTML = html;
    this.panel.scrollTop = 0;
    const close = () => { this.close(); if (onClose) onClose(); };
    this.panel.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { SFX.play('ui'); close(); });
    this.keyHandler = (e) => { if (e.code === 'Escape' && !opts.noEsc) { e.preventDefault(); close(); } else if (opts.keys) opts.keys(e); };
    this.currentClose = close;
    return this.panel;
  },
  close() {
    this.modalEl.className = '';
    this.panel.innerHTML = '';
    this.keyHandler = null;
    this.setModal(false);
  },
  menu(title, sub, options) {
    const p = this.open(`<h2>${esc(title)}</h2><p class="muted">${esc(sub)}</p><div class="menu-list"></div><div class="row-end"><button class="btn ghost" data-close>Leave</button></div>`);
    const list = $('.menu-list', p);
    options.forEach((o, i) => {
      const b = el('button', 'btn menu-btn', o.label);
      b.onclick = () => { SFX.play('ui'); this.close(); o.fn(); };
      list.appendChild(b);
    });
  },
  confirmRun(camp = 0) {
    const S = SAVE.data, h = HEROES[S.hero], f = h.forms[S.heroes[S.hero].form], heat = SAVE.heat();
    const C = CAMPAIGNS[camp];
    const p = this.open(`
      <h2>${camp === 3 ? 'The Rift <span class="jp">裂け目</span>' : camp === 2 ? 'The Stair of Heaven <span class="jp">天の階</span>' : camp ? 'The Black Torii of Yomi <span class="jp">黄泉の鳥居</span>' : 'The Torii of Ascent <span class="jp">昇天の鳥居</span>'}</h2>
      <div class="camp-tag ${camp ? 'c2' : ''} ${camp === 2 ? 'c3' : ''}">${camp === 3 ? 'ARC II · TOKOYO' : camp === 2 ? 'FINAL CAMPAIGN' : camp ? 'CAMPAIGN II' : 'CAMPAIGN I'} · ${C.name} <span class="jp">${C.jp}</span></div>
      ${camp === 3 ? '<div class="c2-warn">⚠ Another world. Foes have +25% HP, +40% damage and act faster, with extra waves and more elites. The hanging snow can hurt you. Spirit Shards ×2.5, and your Kami\'s blessings still reach you here through your shard.</div>' : ''}
      ${camp === 2 ? '<div class="c2-warn c3">⚠ A gauntlet of seven corrupted gods, then the Calamity. You begin holding EVERY Kami blessing — each god you free takes its blessings back, so choose your order. Every god is a bullet-hell fight; the Calamity is far worse. Freed gods leave a Godspark and become playable.</div>' : camp === 1 ? '<div class="c2-warn">⚠ Foes have +25% HP, +45% damage and act faster. Extra waves, more elites, and every area has a hazard. Spirit Shards ×2, bosses drop 2 Moon Keys.</div>' : ''}
      <div class="confirm">
        <canvas class="pc" width="140" height="140"></canvas>
        <div>
          <div class="big-name">${h.name} <span class="jp">${h.jp}</span></div>
          <div class="muted">${h.title} · ${h.weapon}</div>
          <div class="form-name">${f.name}</div>
          <div class="muted small">${h.controls}</div>
          <div class="heat-line">Moon Phase: <b>${heat}</b>${heat ? ` · Spirit Shards ×${(1 + heat * 0.1).toFixed(1)}` : ''}</div>
          ${S.fragments.length >= 8 && !S.flags.trueEnd ? '<div class="gold-text">The eight fragments hum. Something waits beneath Mugen\'s mask.</div>' : ''}
        </div>
      </div>
      ${h.devotion ? `<div class="patron-pick"><div class="pp-lbl">Patron Kami${S.heroes.sayo.form === 1 ? ' (choose two)' : ''}</div><div class="pp-row">${KAMI_ORDER.map(k => `<button class="pp ${k === S.patron || (S.heroes.sayo.form === 1 && k === S.patron2) ? 'on' : ''}" data-k="${k}" style="--c:${KAMI[k].color}" title="${KAMI[k].name} — ${KAMI[k].title} · ${KAMI[k].el}"><span>${KAMI[k].glyph}</span><i>${KAMI[k].name}</i></button>`).join('')}</div></div>` : ''}
      <div class="row-end"><button class="btn ghost" data-close>Not yet</button><button class="btn big" id="go">${camp === 3 ? 'Cross Over' : 'Begin Ascent'}</button></div>`);
    this.portrait($('.pc', p), S.hero);
    p.querySelectorAll('.pp').forEach(b => b.onclick = () => {
      const k = b.dataset.k; SFX.play('ui');
      if (S.heroes.sayo.form === 1) { if (k !== S.patron) { S.patron2 = S.patron; S.patron = k; } }
      else S.patron = k;
      SAVE.save(); this.confirmRun(camp);
    });
    if (h.devotion && !S.patron) { S.patron = 'fire'; }
    $('#go', p).onclick = () => { SFX.play('uiok'); this.close(); G.startRun(camp); };
    this.keyHandler = (e) => { if (e.code === 'Escape') this.close(); if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); this.close(); G.startRun(camp); } };
  },

  /* ---------------- HUD ---------------- */
  showHud(v) { this.hudEl.className = v ? '' : 'hidden'; this.hudCache = {}; },
  setH(key, val, fn) { if (this.hudCache[key] !== val) { this.hudCache[key] = val; fn(val); } },
  hud() {
    if (!P) return;
    const s = P.stats, run = G.run, S = SAVE.data;
    const hpPct = Math.max(0, P.hp / s.maxHp);
    this.setH('hp', Math.ceil(P.hp) + '/' + s.maxHp, v => { $('#hp-text').textContent = v; $('#hp-fill').style.width = (hpPct * 100) + '%'; $('#hp-fill').classList.toggle('low', hpPct < 0.3); });
    if (P.hero.swap) this.setH('ult', 'w' + P.weapon, () => { $('#ult').style.setProperty('--p', '100%'); $('#ult').classList.remove('ready'); $('#ult-n').textContent = P.hero.weapons[P.weapon].glyph; $('.ult-lbl').textContent = keyName(Input.binds().ult[0]) + ' SWAP'; });
    else this.setH('ult', Math.floor(P.ult), v => { $('#ult').style.setProperty('--p', v + '%'); $('#ult').classList.toggle('ready', v >= 100); $('#ult-n').textContent = v >= 100 ? keyName(Input.binds().ult[0]) : v; $('.ult-lbl').textContent = 'ULT'; });
    this.setH('dash', P.dashes + '/' + s.dash, () => {
      $('#dashpips').innerHTML = Array.from({ length: s.dash }, (_, i) => `<span class="${i < P.dashes ? 'on' : ''}"></span>`).join('');
    });
    const spk = P.spT > 0 ? Math.round((1 - P.spT / (P.spMax || 1)) * 20) : 20;
    this.setH('sp', spk, v => { $('#spcd-fill').style.width = (v * 5) + '%'; $('#spcd').classList.toggle('ready', v >= 20); });
    this.setH('hero', P.hero.id + ':' + P.weapon, () => { $('#sp-name').textContent = P.hero.weapons ? P.hero.weapons[P.weapon].special : P.hero.specialName; $('#hero-name').textContent = P.hero.name; });
    this.setH('gold', run ? run.gold : -1, v => { $('#r-gold').textContent = v; $('#r-gold').parentElement.style.display = run ? '' : 'none'; });
    this.setH('shards', S.shards, v => $('#r-shards').textContent = v);
    this.setH('keys', S.keys, v => $('#r-keys').textContent = v);
    this.setH('frag', S.fragments.length, v => $('#r-frag').textContent = v + '/8');
    const loc = run && run.camp === 2 ? `Wrath of the Gods · ${run.godsDone.length}/7 gods freed${run.heatTotal ? ' · Phase ' + run.heatTotal : ''}` : run ? `${run.camp === 3 ? 'Tokoyo · ' : run.camp ? 'II · ' : ''}${G.acts()[run.act].act} · Room ${run.roomNum}/${ROOMS_PER_ACT}${run.heatTotal ? ' · Phase ' + run.heatTotal : ''}` : 'Shrine of Lanterns';
    this.setH('loc', loc, v => $('#r-loc').textContent = v);
    const bkey = run ? run.boons.map(b => b.id + b.lv + b.r).join() + '|' + run.relics.join() + '|' + JSON.stringify(run.disc) : '';
    const st = [];
    if (P.bankaiT > 0) st.push(`<span class="chip-s bankai">卍 BANKAI ${Math.ceil(P.bankaiT)}</span>`);
    if (P.berserkT > 0) st.push(`<span class="chip-s berserk">鬼 BERSERK ${Math.ceil(P.berserkT)}</span>`);
    if (P.exhaustT > 0) st.push(`<span class="chip-s exhaust">EXHAUSTED ${Math.ceil(P.exhaustT)}</span>`);
    if (P.slowT > 0) st.push('<span class="chip-s slow">CHILLED</span>');
    if (P.hero.devotion) { const ps = run ? run.patrons : [S.patron || 'fire']; st.push(`<span class="chip-s" style="color:${KAMI[ps[0]].color}">Patron: ${ps.map(k => KAMI[k].name).join(' & ')}</span>`); }
    if (P.hero.godless) st.push('<span class="chip-s godless">GODLESS</span>');
    if (P.prayT > 0) st.push(`<span class="chip-s pray">祈 PRAYER ${Math.ceil(P.prayT)}</span>`);
    if (P.groove) st.push(`<span class="chip-s groove">♪ GROOVE ×${P.groove}</span>`);
    if (P.hero.parrier) st.push(`<span class="chip-s mirror">鏡 ${P.shards || 0}/${P.stats.shardMax || 5}</span>`);
    if (P.domainT > 0) st.push(`<span class="chip-s mirror">MIRROR DOMAIN ${Math.ceil(P.domainT)}</span>`);
    if (G.timeStopT > 0) st.push(`<span class="chip-s mirror">止 TIME STOP ${Math.ceil(G.timeStopT)}</span>`);
    if (P.feastT > 0) st.push(`<span class="chip-s berserk">鬼 FEAST ${Math.ceil(P.feastT)}</span>`);
    if (P.luckyT > 0) st.push(`<span class="chip-s pray">777 LUCKY ${Math.ceil(P.luckyT)}</span>`);
    if (P.critCharges > 0) st.push(`<span class="chip-s mirror">新月 ×${P.critCharges}</span>`);
    if (run && run.camp === 2 && run.overload > 1) st.push(`<span class="chip-s exhaust" title="Your mortal body cannot channel this much divinity. Damage is divided while you hold many gods' blessings.">神力過多 OVERLOAD ÷${run.overload}</span>`);
    if (run && run.camp === 2 && run.sparks.length) st.push(`<span class="chip-s pray">✦ ${run.sparks.length} Godspark${run.sparks.length > 1 ? 's' : ''}</span>`);
    if (P.frenzy) st.push(`<span class="chip-s berserk">FRENZY ×${P.frenzy}</span>`);
    if (G.run && G.run.feastHp) st.push(`<span class="chip-s">FEAST +${G.run.feastHp}</span>`);
    this.setH('status', st.join(''), v => { $('#status').innerHTML = v; });
    this.setH('boons', bkey, () => {
      const box = $('#boons'); box.innerHTML = '';
      if (!run) return;
      if (run.camp === 2) {
        for (const k of KAMI_ORDER) {
          const n = run.boons.filter(b => BOON_BY_ID[b.id].k === k).length;
          const i = el('div', 'bi' + (n ? '' : ' gone'), `<span class="g">${KAMI[k].glyph}</span>${n ? `<span class="lv">${n}</span>` : ''}`);
          i.style.setProperty('--c', n ? KAMI[k].color : '#555'); i.style.borderColor = n ? KAMI[k].color : '#333';
          i.title = n ? `${KAMI[k].name}: ${n} blessings held` : `${KAMI[k].name} has been freed — ${GODSPARKS[k].name}: ${GODSPARKS[k].desc}`;
          box.appendChild(i);
        }
      } else
      for (const b of run.boons) {
        const d = BOON_BY_ID[b.id], k = KAMI[d.k];
        const i = el('div', 'bi' + (d.duo ? ' duo' : ''), `<span class="g">${d.duo ? KAMI[d.k].glyph + KAMI[d.k2].glyph : k.glyph}</span><span class="sl">${d.slot === 'passive' ? '' : d.slot[0].toUpperCase()}</span>${b.lv > 1 ? `<span class="lv">${b.lv}</span>` : ''}`);
        i.style.setProperty('--c', k.color); i.style.borderColor = RARITY[b.r].color;
        i.title = `${d.name} (${RARITY[b.r].name} Lv${b.lv}) — ${d.desc(boonPower(b) * (P ? P.stats.devotion : 1))}`;
        box.appendChild(i);
      }
      for (const id in run.disc) { const D = DISC_BY_ID[id]; const i = el('div', 'bi disc', `<span class="g">${D.icon}</span><span class="lv">${run.disc[id]}</span>`); i.title = `${D.name} Lv${run.disc[id]} — ${D.desc(run.disc[id] * (P.stats.discMult || 1))}`; box.appendChild(i); }
      for (const r of run.relics) { const R = RELIC_BY_ID[r]; const i = el('div', 'bi relic', `<span class="g">${R.icon}</span>`); i.title = R.name + ' — ' + R.desc; box.appendChild(i); }
    });
    // boss bar
    if (G.boss && !G.boss.dead) {
      const b = G.boss, pct = Math.max(0, b.hp / b.maxHp);
      this.setH('boss', Math.round(pct * 400), () => {
        $('#bb-fill').style.width = pct * 100 + '%';
        $('#bb-lag').style.width = pct * 100 + '%';
        $('#bb-ph').innerHTML = b.def.phases.map(ph => `<i style="left:${ph * 100}%"></i>`).join('');
      });
    }
    const hint = $('#hint');
    if (this.modal) hint.textContent = '';
    else if (G.hubFight) hint.textContent = G.hubFight.tag >= 100 ? `TAG READY — press ${keyName(Input.binds().interact[0])} to call ${HEROES[G.hubFight.allyId].name.split(' ')[0]}'s attack` : `Tag attack ${Math.floor(G.hubFight.tag)}%`;
    else if (G.scene === 'hub') hint.textContent = G.nearNpc ? '' : 'WASD move · Mouse aim · LMB attack · RMB special · Space dash · Q ultimate · F interact · Esc menu';
    else if (run && G.doors.length && !G.room.rewardTaken && G.pickups.some(p => p.kind === 'reward')) hint.textContent = 'Claim the reward';
    else if (run && G.doors.length) hint.textContent = 'Choose a door';
    else hint.textContent = '';
  },
  bossBar(b) {
    const bb = $('#bossbar');
    if (!b) { bb.className = 'hidden'; return; }
    bb.className = '';
    $('#bb-name').innerHTML = `${esc(b.def.name)} <span>${esc(b.def.title)}</span>`;
    this.hudCache.boss = null;
  },

  /* ---------------- banners, toasts, cut-ins ---------------- */
  banner(big, small, kind = '') {
    const b = $('#banner');
    b.className = ''; void b.offsetWidth;
    b.innerHTML = `<div class="b-big">${esc(big)}</div>${small ? `<div class="b-small">${esc(small)}</div>` : ''}`;
    b.className = 'show ' + kind;
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => { b.className = ''; }, kind === 'act' || kind === 'boss' ? 3000 : 1700);
  },
  toast(msg, color = '#fff', secs = 3.2) {
    const box = $('#toasts');
    const t = el('div', 'toast', esc(msg));
    t.style.borderColor = color; t.style.color = color;
    box.appendChild(t);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(() => t.classList.add('out'), secs * 1000);
    setTimeout(() => t.remove(), secs * 1000 + 500);
  },
  cutin(id, name, jp, sub) {
    const c = $('#cutin');
    const pal = (CAST[id] && CAST[id].pal) || { scarf: '#fff', hair: '#fff' };
    c.innerHTML = `<div class="ci-band" style="--c:${pal.scarf};--c2:${pal.hair}"><canvas width="260" height="260"></canvas><div class="ci-text"><div class="ci-jp">${esc(jp)}</div><div class="ci-name">${esc(name)}</div><div class="ci-sub">${esc(sub || '')}</div></div></div>`;
    this.portrait($('canvas', c), id, 'angry', true);
    c.className = ''; void c.offsetWidth; c.className = 'show';
    clearTimeout(this.cutT);
    this.cutT = setTimeout(() => { c.className = ''; }, 1500);
  },

  /* ---------------- dialogue ---------------- */
  dialogue(lines, done) {
    if (!lines || !lines.length) { if (done) done(); return; }
    this.setModal(true);
    const hero = G.run ? G.run.hero : SAVE.data.hero;
    // '$h' is for Tokoyo scenes, where Sekka and Kuroto are already speaking: if you play one of them, Akane takes the line
    const speaker = id => id === '$hero' ? hero : id === '$h' ? (hero === 'sekka' || hero === 'kuroto' ? 'akane' : hero) : id;
    this.dlgLines = lines.map(l => [speaker(l[0]), l[1], l[2]]);
    this.dlgIdx = -1; this.dlgDone = done;
    this.dlg.className = 'show';
    this.keyHandler = (e) => { if (['Space', 'Enter', 'KeyF', 'KeyE', 'KeyJ'].includes(e.code)) { e.preventDefault(); this.advanceDialogue(); } else if (e.code === 'Escape') { e.preventDefault(); this.dlgIdx = this.dlgLines.length; this.advanceDialogue(true); } };
    this.nextLine();
  },
  nextLine() {
    this.dlgIdx++;
    if (this.dlgIdx >= this.dlgLines.length) {
      this.dlg.className = 'hidden'; clearInterval(this.typeT);
      this.keyHandler = null; this.setModal(false);
      const d = this.dlgDone; this.dlgDone = null; if (d) d();
      return;
    }
    const [who, text, mood] = this.dlgLines[this.dlgIdx];
    const c = CAST[who] || { name: who };
    const cv = $('#dlg-portrait');
    if (c.narrator) { cv.style.display = 'none'; this.dlg.classList.add('narr'); }
    else { cv.style.display = ''; this.dlg.classList.remove('narr'); this.portrait(cv, who, mood); }
    $('#dlg-name').textContent = c.name;
    $('#dlg-name').style.color = c.pal ? c.pal.scarf : c.kami ? KAMI[c.kami].color : '#ff4fd8';
    const tx = $('#dlg-text');
    this.dlgFull = text; this.dlgPos = 0; tx.textContent = '';
    clearInterval(this.typeT);
    this.typeT = setInterval(() => {
      this.dlgPos += 2;
      tx.textContent = this.dlgFull.slice(0, this.dlgPos);
      if (this.dlgPos % 6 === 0) SFX.play('type');
      if (this.dlgPos >= this.dlgFull.length) clearInterval(this.typeT);
    }, 22);
  },
  advanceDialogue(skipAll) {
    if (!this.dlgLines || this.dlg.className.indexOf('show') < 0) return;
    if (!skipAll && this.dlgPos < this.dlgFull.length) { this.dlgPos = this.dlgFull.length; $('#dlg-text').textContent = this.dlgFull; clearInterval(this.typeT); return; }
    if (skipAll) this.dlgIdx = this.dlgLines.length - 1;
    this.nextLine();
  },

  /* ---------------- boons ---------------- */
  boonCard(o, i) {
    const d = o.def, k = KAMI[d.k], rar = RARITY[o.r];
    const pw = RARITY[o.r].mult * (P.stats.devotion || 1);
    const current = d.slot !== 'passive' ? G.run.boons.find(b => BOON_BY_ID[b.id].slot === d.slot) : null;
    const repl = current ? `<div class="repl">Replaces ${esc(BOON_BY_ID[current.id].name)}</div>` : '';
    const glyph = d.duo ? KAMI[d.k].glyph + KAMI[d.k2].glyph : k.glyph;
    const c2 = d.duo ? KAMI[d.k2].color : k.color;
    return `<div class="card" data-i="${i}" style="--c:${k.color};--c2:${c2};--r:${rar.color}">
      <div class="card-key">${i + 1}</div>
      <div class="card-glyph">${glyph}</div>
      <div class="card-body">
        <div class="card-top"><span class="card-name">${esc(d.name)}</span><span class="card-rar">${d.duo ? 'Duo' : d.capstone ? 'Capstone' : rar.name}</span></div>
        <div class="card-slot">${d.duo ? KAMI[d.k].name + ' × ' + KAMI[d.k2].name : k.name + ' · ' + SLOT_LABEL[d.slot]}</div>
        <div class="card-desc">${esc(d.desc(pw))}</div>${repl}
      </div></div>`;
  },
  boonChoice(opts, kami, onPick, reroll) {
    const k = kami ? KAMI[kami] : null;
    const render = (list) => {
      const p = this.open(`
        <div class="boon-head">
          ${k ? `<canvas class="kp" width="120" height="120"></canvas><div><div class="kami-name" style="color:${k.color}">${k.name} <span class="jp">${k.glyph}</span></div><div class="muted">${k.title}</div><div class="kami-say">“${esc(pick(k.hello))}”</div></div>`
            : `<div><div class="kami-name">A Blessing</div><div class="muted">The Kami offer their power.</div></div>`}
        </div>
        <div class="cards">${list.map((o, i) => this.boonCard(o, i)).join('')}</div>
        <div class="row-end">${reroll ? `<button class="btn ghost" id="reroll" ${G.run.rerolls > 0 ? '' : 'disabled'}>🎲 Reroll (${G.run.rerolls})</button>` : ''}</div>`,
      null, { noEsc: true, wide: true, keys: (e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= list.length) choose(list[n - 1]); } });
      if (k) this.portrait($('.kp', p), 'kami_' + kami);
      p.querySelectorAll('.card').forEach(c => c.onclick = () => choose(list[+c.dataset.i]));
      const rr = $('#reroll', p);
      if (rr) rr.onclick = () => { const nl = reroll(); if (nl && nl.length) { SFX.play('ui'); render(nl); } else SFX.play('uino'); };
    };
    const choose = (o) => {
      SFX.play('uiok');
      this.close();
      onPick(o);
      UI.toast(`${o.def.name} — ${RARITY[o.r].name}`, KAMI[o.def.k].color);
      G.finishBoon();
    };
    render(opts);
  },
  discChoice(list, levels, onPick) {
    const run = G.run;
    const choose = (d) => { SFX.play('uiok'); this.close(); onPick(d); this.toast(`${d.name} — trained`, '#e8e0d0'); };
    const p = this.open(`
      <div class="boon-head"><canvas class="kp" width="120" height="120"></canvas><div><div class="kami-name" style="color:#e8e0d0">Discipline <span class="jp">修行</span></div><div class="muted">No Kami answers the Godless. You train instead${levels > 1 ? ` — ${levels} levels this time` : ''}.</div><div class="kami-say">“${esc(pick(['Steel does not pray.', 'A thousand swings. Then a thousand more.', 'The gods can keep their gifts.', 'Earned, not given.']))}”</div></div></div>
      <div class="cards">${list.map((d, i) => { const lv = run.disc[d.id] || 0, m = (P.stats.discMult || 1); return `<div class="card" data-i="${i}" style="--c:#e8e0d0;--c2:#8a1c2b;--r:#8a1c2b"><div class="card-key">${i + 1}</div><div class="card-glyph">${d.icon}</div><div class="card-body"><div class="card-top"><span class="card-name">${esc(d.name)}</span><span class="card-rar">${lv ? 'Lv ' + lv + ' → ' + (lv + levels) : 'New'}</span></div><div class="card-slot">Discipline</div><div class="card-desc">${esc(d.desc((lv + levels) * m))}</div></div></div>`; }).join('')}</div>`,
      null, { noEsc: true, wide: true, keys: (e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= list.length) choose(list[n - 1]); } });
    this.portrait($('.kp', p), 'tetsu');
    p.querySelectorAll('.card').forEach(c => c.onclick = () => choose(list[+c.dataset.i]));
  },
  sake(levels, done) {
    const run = G.run;
    if (!run.boons.length) { G.addGold(60); if (done) done(); return; }
    const list = shuffle(run.boons.slice()).slice(0, Math.min(3, run.boons.length));
    const lv = levels + (P.stats.sakeBonus || 0);
    const p = this.open(`
      <h2>Spirit Sake <span class="jp">霊酒</span></h2>
      <p class="muted">Pour the sake. One blessing deepens by ${lv} level${lv > 1 ? 's' : ''}.</p>
      <div class="cards">${list.map((b, i) => {
        const d = BOON_BY_ID[b.id], k = KAMI[d.k], dv = P.stats.devotion || 1, now = boonPower(b) * dv, nb = { r: b.r, lv: b.lv + lv }, next = boonPower(nb) * dv;
        return `<div class="card" data-i="${i}" style="--c:${k.color};--c2:${d.duo ? KAMI[d.k2].color : k.color};--r:${RARITY[b.r].color}"><div class="card-key">${i + 1}</div><div class="card-glyph">${d.duo ? k.glyph + KAMI[d.k2].glyph : k.glyph}</div><div class="card-body"><div class="card-top"><span class="card-name">${esc(d.name)}</span><span class="card-rar">Lv ${b.lv} → ${b.lv + lv}</span></div><div class="card-desc">${esc(d.desc(next))}</div><div class="repl">was: ${esc(d.desc(now))}</div></div></div>`;
      }).join('')}</div>`, null, { noEsc: true, wide: true, keys: (e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= list.length) pickIt(n - 1); } });
    const pickIt = (i) => { list[i].lv += lv; P.recompute(); SFX.play('levelup'); this.close(); UI.toast(BOON_BY_ID[list[i].id].name + ' deepened!', '#f2f0ff'); if (done) done(); };
    p.querySelectorAll('.card').forEach(c => c.onclick = () => pickIt(+c.dataset.i));
  },

  /* ---------------- shop ---------------- */
  shop(ferry) {
    const run = G.run, items = G.room.shop || [];
    const stall = run.camp === 3;
    ferry = !stall && (ferry || !!run.camp);
    const p = this.open(`
      ${stall ? `<div class="boon-head"><canvas class="kp" width="120" height="120"></canvas><div><div class="kami-name" style="color:#dcecff">Ume's Fan Stall <span class="jp">梅の扇屋</span></div><div class="muted">She is frozen mid-sale, holding out a fan. The prices are chalked on a board. They are high.</div><div class="kami-say">${esc(pick(['Her knee hurts when it rains. It has not rained in a very long time.', 'The coin box is open. Nobody will stop you. Pay anyway.', 'Whatever else is on this stall, it was here that night.']))}</div></div></div>`
        : ferry ? `<div class="boon-head"><canvas class="kp" width="120" height="120"></canvas><div><div class="kami-name" style="color:#9ee7ff">Sanzu the Ferryman <span class="jp">三途の渡し守</span></div><div class="muted">The river market. Everything costs something.</div><div class="kami-say">“${esc(pick(['Gold is just memory you can spend.', 'I have ferried emperors. You are a better tipper.', 'The current waits for no one. Choose.']))}”</div></div></div>`
        : `<div class="boon-head"><canvas class="kp" width="120" height="120"></canvas><div><div class="kami-name" style="color:#ffd56b">Old Man Udon <span class="jp">うどん爺</span></div><div class="muted">Ramen, sake, trinkets. No refunds.</div><div class="kami-say">“${esc(pick(SHOP_LINES))}”</div></div></div>`}
      <div class="gold-big">金 ${run.gold}</div>
      <div class="shop-list">${items.map((it, i) => {
        const can = !it.sold && run.gold >= it.price && (!it.cond || it.cond());
        return `<div class="shop-item ${it.sold ? 'sold' : ''} ${can ? '' : 'cant'}" data-i="${i}"><div class="si-icon" style="color:${it.color || '#fff'}">${it.icon}</div><div class="si-body"><div class="si-name">${esc(it.name)}</div><div class="si-desc">${esc(it.desc)}</div></div><div class="si-price">${it.sold ? 'SOLD' : '金 ' + it.price}</div></div>`;
      }).join('')}</div>
      <div class="row-end"><button class="btn ghost" data-close>Leave</button></div>`, null, { wide: true });
    this.portrait($('.kp', p), stall ? 'ume' : ferry ? 'sanzu' : 'udon', 'happy');
    p.querySelectorAll('.shop-item').forEach(row => row.onclick = () => {
      const it = items[+row.dataset.i];
      if (it.sold || run.gold < it.price || (it.cond && !it.cond())) { SFX.play('uino'); return; }
      run.gold -= it.price; it.sold = true; SFX.play('coin');
      if (it.chain) { this.close(); it.fn(); }
      else { it.fn(); this.shop(ferry); }
    });
  },

  /* ---------------- events ---------------- */
  event(ev, done) {
    const p = this.open(`
      <h2>${esc(ev.title)}</h2>
      <p class="ev-text">${esc(ev.text)}</p>
      <div class="menu-list">${ev.choices.map((c, i) => `<button class="btn menu-btn" data-i="${i}" ${c.cond && !c.cond() ? 'disabled' : ''}>${esc(c.label)}</button>`).join('')}</div>`, null, { noEsc: true });
    p.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
      const c = ev.choices[+b.dataset.i];
      if (c.cond && !c.cond()) return;
      SFX.play('uiok');
      G.deferOffers = true; G.pendingOffers = [];
      const res = c.fn();
      G.deferOffers = false;
      if (done) done();
      const q = this.open(`<h2>${esc(ev.title)}</h2><p class="ev-text">${esc(res)}</p><div class="row-end"><button class="btn" id="evok">Continue</button></div>`, null, { noEsc: true });
      $('#evok', q).onclick = () => {
        this.close();
        const pend = G.pendingOffers.shift();
        if (pend) G.offerBoons(pend[0], pend[1]);
      };
    });
  },

  /* ---------------- Lantern Mirror ---------------- */
  mirror() {
    const S = SAVE.data;
    const p = this.open(`
      <h2>Lantern Mirror <span class="jp">灯篭の鏡</span></h2>
      <p class="muted">Pour Spirit Shards into the lanterns. Their light stays with you through every death.</p>
      <div class="cur">魂 <b>${S.shards}</b> Spirit Shards</div>
      <div class="mirror-grid">${MIRROR.map(m => {
        const r = S.mirror[m.id] || 0, max = r >= m.max, cost = max ? 0 : m.cost(r);
        return `<div class="mirror-item ${max ? 'max' : ''}"><div class="mi-name">🏮 ${esc(m.name)}</div><div class="mi-desc">${esc(m.desc)}</div>
          <div class="pips">${Array.from({ length: m.max }, (_, i) => `<span class="${i < r ? 'on' : ''}"></span>`).join('')}</div>
          <button class="btn small" data-id="${m.id}" ${max || S.shards < cost ? 'disabled' : ''}>${max ? 'MAX' : '魂 ' + cost}</button></div>`;
      }).join('')}</div>
      <div class="row-end"><button class="btn ghost" id="refund">Refund all</button><button class="btn" data-close>Done</button></div>`, null, { wide: true });
    p.querySelectorAll('[data-id]').forEach(b => b.onclick = () => {
      const m = MIRROR.find(x => x.id === b.dataset.id), r = S.mirror[m.id] || 0;
      if (r >= m.max) return;
      const c = m.cost(r);
      if (S.shards < c) { SFX.play('uino'); return; }
      S.shards -= c; S.mirror[m.id] = r + 1; SAVE.save(); SFX.play('levelup');
      P.recompute(); P.hp = P.stats.maxHp;
      this.mirror();
    });
    $('#refund', p).onclick = () => {
      let back = 0;
      for (const m of MIRROR) { const r = S.mirror[m.id] || 0; for (let i = 0; i < r; i++) back += m.cost(i); }
      S.shards += back; S.mirror = {}; SAVE.save(); SFX.play('coin');
      P.recompute(); P.hp = P.stats.maxHp;
      this.toast(`Refunded ${back} shards`, '#6ee7ff');
      this.mirror();
    };
  },

  /* ---------------- Forge (unlock heroes & forms) ---------------- */
  forge() {
    const S = SAVE.data;
    const p = this.open(`
      <h2>Ponta's Forge <span class="jp">狸の鍛冶場</span></h2>
      <p class="muted">Moon Keys awaken heroes and new Forms of their weapons.</p>
      <div class="cur">🗝 <b>${S.keys}</b> Moon Keys</div>
      <div class="forge-list">${HERO_ORDER.map(id => {
        const h = HEROES[id], hs = S.heroes[id], U = HERO_UNLOCK[id];
        if (!hs.unlocked) {
          const ok = !U.req || U.req(S);
          return `<div class="forge-hero locked"><canvas class="fp" width="90" height="90" data-h="${id}"></canvas><div class="fh-body"><div class="fh-name">${ok ? h.name : '???'} <span class="jp">${ok ? h.jp : ''}</span></div><div class="muted">${ok ? h.desc : 'Requirement: ' + esc(U.hint)}</div></div>
            <button class="btn" data-unlock="${id}" ${ok && S.keys >= U.keys ? '' : 'disabled'}>Unlock · 🗝 ${U.keys}</button></div>`;
        }
        return `<div class="forge-hero"><canvas class="fp" width="90" height="90" data-h="${id}"></canvas><div class="fh-body"><div class="fh-name">${h.name} <span class="jp">${h.jp}</span></div><div class="muted small">${h.weapon}</div>
          <div class="forms">${h.forms.map((f, i) => {
            const own = hs.forms.includes(i);
            return `<div class="form ${own ? 'own' : ''}"><div class="f-name">${esc(f.name)}</div><div class="f-desc">${esc(f.desc)}</div>${own ? '<div class="f-own">Awakened</div>' : `<button class="btn small" data-form="${id}:${i}" ${S.keys >= f.cost ? '' : 'disabled'}>Awaken · 🗝 ${f.cost}</button>`}</div>`;
          }).join('')}</div></div></div>`;
      }).join('')}</div>
      <div class="row-end"><button class="btn" data-close>Done</button></div>`, null, { wide: true });
    p.querySelectorAll('canvas[data-h]').forEach(c => {
      const id = c.dataset.h;
      if (S.heroes[id].unlocked || !HERO_UNLOCK[id].req || HERO_UNLOCK[id].req(S)) this.portrait(c, id);
      else { const x = c.getContext('2d'); x.fillStyle = '#222'; x.font = '900 50px serif'; x.textAlign = 'center'; x.fillStyle = '#555'; x.fillText('?', 45, 62); }
    });
    p.querySelectorAll('[data-unlock]').forEach(b => b.onclick = () => {
      const id = b.dataset.unlock, U = HERO_UNLOCK[id];
      if (S.keys < U.keys) return;
      S.keys -= U.keys; S.heroes[id].unlocked = true; SAVE.save(); SFX.play('levelup');
      this.toast(`${HEROES[id].name} has joined you at the shrine!`, HEROES[id].pal.scarf);
      G.buildHubNpcs();
      this.forge();
    });
    p.querySelectorAll('[data-form]').forEach(b => b.onclick = () => {
      const [id, i] = b.dataset.form.split(':'), f = HEROES[id].forms[+i];
      if (S.keys < f.cost) return;
      S.keys -= f.cost; S.heroes[id].forms.push(+i); S.heroes[id].form = +i; SAVE.save(); SFX.play('levelup');
      if (S.hero === id) { P = new Player(id, +i); P.x = 700; P.y = 640; }
      this.toast(`${f.name} awakened!`, '#ffd56b');
      this.forge();
    });
  },

  /* ---------------- Altar (choose hero / form) ---------------- */
  altar() {
    const S = SAVE.data;
    const p = this.open(`
      <h2>Altar of Heroes <span class="jp">英雄の祭壇</span></h2>
      <p class="muted">Choose who climbs next, and which Form their weapon takes.</p>
      <div class="altar-list">${HERO_ORDER.filter(id => S.heroes[id].unlocked).map(id => {
        const h = HEROES[id], hs = S.heroes[id];
        return `<div class="altar-hero ${S.hero === id ? 'sel' : ''}" data-h="${id}" style="--c:${h.pal.scarf}"><canvas width="120" height="120" data-p="${id}"></canvas>
          <div class="ah-name">${h.name}</div><div class="muted small">${h.title}</div>
          <select data-sel="${id}">${hs.forms.map(i => `<option value="${i}" ${hs.form === i ? 'selected' : ''}>${esc(h.forms[i].name)}</option>`).join('')}</select>
          <div class="small ah-stats">HP ${h.base.maxHp} · ${esc(h.specialName)}</div></div>`;
      }).join('')}</div>
      <div class="row-end"><button class="btn" data-close>Done</button></div>`, null, { wide: true });
    p.querySelectorAll('canvas[data-p]').forEach(c => this.portrait(c, c.dataset.p));
    p.querySelectorAll('.altar-hero').forEach(d => d.onclick = (e) => {
      if (e.target.tagName === 'SELECT' || e.target.tagName === 'OPTION') return;
      const id = d.dataset.h;
      if (S.hero === id) return;
      S.hero = id; SAVE.save(); SFX.play('uiok');
      const x = P.x, y = P.y;
      P = new Player(id, S.heroes[id].form); P.x = x; P.y = y;
      G.buildHubNpcs();
      this.altar();
    });
    p.querySelectorAll('select').forEach(s => s.onchange = () => {
      const id = s.dataset.sel; S.heroes[id].form = +s.value; SAVE.save(); SFX.play('ui');
      if (S.hero === id) { const x = P.x, y = P.y; P = new Player(id, +s.value); P.x = x; P.y = y; }
    });
  },

  /* ---------------- Pact ---------------- */
  pact() {
    const S = SAVE.data, heat = SAVE.heat();
    const p = this.open(`
      <h2>Moon Phase Pact <span class="jp">月相の契り</span></h2>
      <p class="muted">Darken the moon to make the climb harder. Each phase increases Spirit Shards earned by 10%, and some Moon Fragments demand it.</p>
      <div class="cur">🌘 Moon Phase <b>${heat}</b> ${S.bestHeat >= 0 ? `· Best clear: Phase ${S.bestHeat}` : ''}</div>
      <div class="pact-list">${PACT.map(c => {
        const r = S.pact[c.id] || 0;
        return `<div class="pact-item ${r ? 'on' : ''}"><div class="pi-body"><div class="pi-name">${esc(c.name)}</div><div class="pi-desc">${esc(c.desc)}</div></div>
          <div class="pi-ctrl"><button class="btn small" data-m="${c.id}" ${r ? '' : 'disabled'}>−</button><span class="pips">${Array.from({ length: c.max }, (_, i) => `<span class="${i < r ? 'on' : ''}"></span>`).join('')}</span><button class="btn small" data-p="${c.id}" ${r >= c.max ? 'disabled' : ''}>+</button></div></div>`;
      }).join('')}</div>
      <div class="row-end"><button class="btn ghost" id="clr">Clear all</button><button class="btn" data-close>Seal the Pact</button></div>`, null, { wide: true });
    p.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { const c = PACT.find(x => x.id === b.dataset.p); S.pact[c.id] = Math.min(c.max, (S.pact[c.id] || 0) + 1); SAVE.save(); SFX.play('ui'); this.pact(); });
    p.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const c = PACT.find(x => x.id === b.dataset.m); S.pact[c.id] = Math.max(0, (S.pact[c.id] || 0) - 1); if (!S.pact[c.id]) delete S.pact[c.id]; SAVE.save(); SFX.play('ui'); this.pact(); });
    $('#clr', p).onclick = () => { S.pact = {}; SAVE.save(); this.pact(); };
  },

  /* ---------------- Codex ---------------- */
  codex(tab = 'frag') {
    const S = SAVE.data;
    const tabs = { frag: 'Moon Fragments', seals: 'Black Sun Seals', bestiary: 'Bestiary', kami: 'Kami & Boons', relics: 'Relics', lore: 'Lore', stats: 'Records' };
    let body = '';
    if (tab === 'frag') {
      body = `<div class="frag-moon">${FRAGMENTS.map((f, i) => `<span class="fm ${S.fragments.includes(f.id) ? 'on' : ''}" style="transform:rotate(${i * 45}deg) translateY(-70px)"></span>`).join('')}<div class="fm-n">${S.fragments.length}/8</div></div>
        <div class="list">${FRAGMENTS.map(f => { const on = S.fragments.includes(f.id); return `<div class="li ${on ? 'on' : ''}"><b>${on ? '🌕' : '🌑'} ${esc(f.name)}</b><div class="muted small">${esc(f.hint)}</div></div>`; }).join('')}</div>
        ${S.fragments.length >= 8 ? `<p class="gold-text">${S.flags.trueEnd ? 'The eighth moon shines. Thank you for playing.' : 'All eight gathered. Face Mugen once more.'}</p>` : ''}`;
    } else if (tab === 'seals') {
      const sl = S.seals || [];
      body = S.fragments.includes('first_clear') ? `<p class="muted">Campaign II — ${CAMPAIGNS[1].name}. Seals are earned by defeating each of its bosses.</p><div class="list">${SEALS.map(x => `<div class="li ${sl.includes(x.id) ? 'on' : ''}"><b>${sl.includes(x.id) ? '☀' : '●'} ${esc(x.name)}</b><div class="muted small">${esc(x.hint)}</div></div>`).join('')}</div>
        <div class="stats-grid"><div><b>${S.clears2 || 0}</b><span>Campaign II clears</span></div><div><b>${S.clears3 || 0}</b><span>Wrath of the Gods clears</span></div></div>
        <h3 class="codex-h">Wrath of the Gods</h3><p class="muted small">${S.fragments.length >= 8 && sl.length >= 4 ? 'The Stair of Heaven is open.' : `Requires all 8 Moon Fragments (${S.fragments.length}/8) and all 4 Black Sun Seals (${sl.length}/4).`}</p>
        <div class="list two">${KAMI_ORDER.map(k => { const on = (S.bossKills['god_' + k] || 0) > 0; return `<div class="li ${on ? 'on' : ''}"><b style="color:${on ? KAMI[k].color : ''}">${KAMI[k].glyph} ${on ? KAMI[k].name + ' — freed' : '???'}</b><div class="muted small">${on ? GODSPARKS[k].name + ': ' + GODSPARKS[k].desc : 'Corrupted.'}</div></div>`; }).join('')}</div>` : '<p class="muted">Sealed. Defeat Mugen once to open the road to Yomi.</p>';
    } else if (tab === 'bestiary') {
      const all = [...Object.entries(ENEMIES).filter(([id]) => id !== 'dummy'), ...Object.entries(BOSSES)];
      body = `<div class="list">${all.map(([id, d]) => {
        const seen = S.seen[id];
        return `<div class="li ${seen ? 'on' : ''}"><b>${seen ? esc(d.name) : '???'}</b>${d.title && seen ? ` <span class="muted">— ${esc(d.title)}</span>` : ''} <span class="muted small">${seen ? 'Slain: ' + (S.kills[id] || S.bossKills[id] || 0) : ''}</span><div class="muted small">${seen ? esc(d.desc || d.jp || '') : 'Not yet encountered.'}</div></div>`;
      }).join('')}</div>`;
    } else if (tab === 'kami') {
      body = KAMI_ORDER.map(k => {
        const K = KAMI[k], seen = S.kamiSeen[k];
        const bs = BOONS.filter(b => b.k === k && !b.duo);
        return `<div class="kami-block" style="--c:${K.color}"><div class="kb-head"><span class="kb-g">${K.glyph}</span> <b>${seen ? K.name : '???'}</b> <span class="muted">${seen ? K.title + ' · Element: ' + K.el : ''}</span></div>
          ${seen ? `<div class="kb-boons">${bs.map(b => `<span title="${esc(b.desc(1))}">${esc(b.name)}</span>`).join('')}</div>` : ''}</div>`;
      }).join('') + `<div class="kami-block"><div class="kb-head"><b>Duo Boons</b> <span class="muted">— offered when you hold blessings from both Kami</span></div><div class="kb-boons">${BOONS.filter(b => b.duo).map(b => `<span title="${esc(b.desc())}">${KAMI[b.k].glyph}${KAMI[b.k2].glyph} ${esc(b.name)}</span>`).join('')}</div></div>`;
    } else if (tab === 'relics') {
      body = `<div class="list two">${RELICS.map(r => { const s = S.relicsSeen[r.id]; return `<div class="li ${s ? 'on' : ''}"><b>${s ? r.icon + ' ' + esc(r.name) : '❔ ???'}</b><div class="muted small">${s ? esc(r.desc) : 'Not yet found.'}</div></div>`; }).join('')}</div>`;
    } else if (tab === 'lore') {
      body = `<div class="list">${LORE.map(l => { const on = l.cond(S); return `<div class="li ${on ? 'on' : ''}"><b>${on ? esc(l.title) : '???'}</b><div class="small">${on ? esc(l.text) : '<span class="muted">Locked.</span>'}</div></div>`; }).join('')}</div>`;
    } else {
      const hrs = Math.floor(S.playTime / 3600), mins = Math.floor(S.playTime / 60) % 60;
      body = `<div class="stats-grid">
        <div><b>${S.runs}</b><span>Runs</span></div><div><b>${S.clears}</b><span>Clears</span></div><div><b>${S.deaths}</b><span>Deaths</span></div>
        <div><b>${S.bestHeat < 0 ? '—' : S.bestHeat}</b><span>Best Phase</span></div><div><b>${Object.values(S.kills).reduce((a, b) => a + b, 0)}</b><span>Foes slain</span></div><div><b>${hrs}h ${mins}m</b><span>Played</span></div>
        ${Object.entries(BOSSES).map(([id, b]) => `<div><b>${S.bossKills[id] || 0}</b><span>${esc(b.name)} ${id === 'thousandth' ? '(true)' : ''}</span></div>`).join('')}
        ${HERO_ORDER.map(h => `<div><b>${S.clearsByHero[h] || 0}</b><span>${HEROES[h].name.split(' ')[0]} clears</span></div>`).join('')}
      </div>`;
    }
    const p = this.open(`
      <h2>Codex <span class="jp">記録</span></h2>
      <div class="tabs">${Object.entries(tabs).map(([k, v]) => `<button class="tab ${k === tab ? 'on' : ''}" data-t="${k}">${v}</button>`).join('')}</div>
      <div class="codex-body">${body}</div>
      <div class="row-end"><button class="btn" data-close>Close</button></div>`, null, { wide: true });
    p.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { SFX.play('ui'); this.codex(b.dataset.t); });
  },

  /* ---------------- settings / pause / results ---------------- */
  settings(fromTitle, back) {
    const s = SAVE.data.settings;
    const p = this.open(`
      <h2>Settings <span class="jp">設定</span></h2>
      <div class="set-list">
        <label>Master volume <input type="range" min="0" max="1" step="0.05" value="${s.vol}" data-k="vol"></label>
        <label>Sound effects <input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-k="sfx"></label>
        <label>Music <input type="range" min="0" max="1" step="0.05" value="${s.music}" data-k="music"></label>
        <label class="chk"><input type="checkbox" data-c="shake" ${s.shake ? 'checked' : ''}> Screen shake</label>
        <label class="chk"><input type="checkbox" data-c="dmgNum" ${s.dmgNum ? 'checked' : ''}> Damage numbers</label>
        <button class="btn" id="kb-open">⌨ Controls & Keybinds</button>
      </div>
      <div class="row-end"><button class="btn" data-close>Done</button></div>`, () => { if (fromTitle) this.title(); else if (back) back(); });
    p.querySelectorAll('input[type=range]').forEach(i => i.oninput = () => { s[i.dataset.k] = +i.value; SAVE.applySettings(); SAVE.save(); SFX.play('ui'); });
    p.querySelectorAll('input[type=checkbox]').forEach(i => i.onchange = () => { s[i.dataset.c] = i.checked; SAVE.save(); });
    $('#kb-open', p).onclick = () => { SFX.play('ui'); this.keybinds(() => this.settings(fromTitle, back)); };
  },
  keybinds(back) {
    const B = SAVE.data.settings.binds;
    const p = this.open(`
      <h2>Controls <span class="jp">操作設定</span></h2>
      <p class="muted">Click a slot, then press any key or mouse button. Esc cancels. Each action has two slots.</p>
      <div class="kb-list">${Object.keys(DEFAULT_BINDS).map(a => `<div class="kb-row"><span>${BIND_LABELS[a]}</span>${[0, 1].map(i => `<button class="kb-slot" data-a="${a}" data-i="${i}">${keyName(B[a][i])}</button>`).join('')}</div>`).join('')}</div>
      <p class="muted small">Gamepad: left stick move · right stick aim · X attack · Y special · A dash · RB ultimate · B interact · Start pause.</p>
      <div class="row-end"><button class="btn ghost" id="kb-reset">Reset to defaults</button><button class="btn" data-close>Done</button></div>`, back, { noEsc: false });
    $('#kb-reset', p).onclick = () => { SAVE.data.settings.binds = JSON.parse(JSON.stringify(DEFAULT_BINDS)); SAVE.save(); SFX.play('uiok'); this.hudCache = {}; this.keybinds(back); };
    p.querySelectorAll('.kb-slot').forEach(b => b.onclick = (ev) => {
      ev.stopPropagation();
      p.querySelectorAll('.kb-slot').forEach(x => x.classList.remove('listen'));
      b.classList.add('listen'); b.textContent = 'press…';
      const a = b.dataset.a, idx = +b.dataset.i;
      const finish = (code) => {
        window.removeEventListener('keydown', onKey, true); window.removeEventListener('mousedown', onMouse, true);
        setTimeout(() => window.removeEventListener('click', swallow, true), 50);
        this.keyHandler = prevKH;
        if (code !== null) {
          for (const k in B) for (let j = 0; j < 2; j++) if (B[k][j] === code && !(k === a && j === idx)) B[k][j] = '';
          B[a][idx] = code; SAVE.save(); SFX.play('uiok');
        }
        this.hudCache = {}; this.keybinds(back);
      };
      const onKey = (e) => { e.preventDefault(); e.stopPropagation(); finish(e.code === 'Escape' ? null : e.code); };
      const onMouse = (e) => { e.preventDefault(); e.stopPropagation(); window.addEventListener('click', swallow, true); finish('Mouse' + e.button); };
      const swallow = (e) => { e.stopPropagation(); e.preventDefault(); };
      const prevKH = this.keyHandler; this.keyHandler = null;
      setTimeout(() => { window.addEventListener('keydown', onKey, true); window.addEventListener('mousedown', onMouse, true); }, 30);
    });
  },
  newcomerChoice(onPick) {
    const card = id => { const h = HEROES[id]; return `<div class="nc-card" data-h="${id}" style="--c:${h.pal.scarf}"><canvas width="160" height="160" data-p="${id}"></canvas><div class="nc-name">${h.name} <span class="jp">${h.jp}</span></div><div class="muted">${h.title}</div><div class="small nc-desc">${esc(h.desc)}</div><div class="small muted">${esc(h.controls)}</div></div>`; };
    const p = this.open(`
      <h2>Who do you stand with? <span class="jp">選択</span></h2>
      <p class="muted">Whoever you choose fights beside you, starting now. Whoever you don't, you fight.</p>
      <div class="nc-row">${card('sekka')}${card('kuroto')}</div>`, null, { noEsc: true, wide: true });
    p.querySelectorAll('canvas[data-p]').forEach(c => this.portrait(c, c.dataset.p));
    p.querySelectorAll('.nc-card').forEach(c => c.onclick = () => { SFX.play('uiok'); this.close(); onPick(c.dataset.h); });
  },
  pause() {
    const run = G.run;
    const build = run ? `<div class="build">${run.boons.map(b => { const d = BOON_BY_ID[b.id], k = KAMI[d.k]; return `<div class="bld" style="--c:${k.color};--r:${RARITY[b.r].color}"><span class="g">${d.duo ? k.glyph + KAMI[d.k2].glyph : k.glyph}</span><div><b>${esc(d.name)}</b> <span class="muted small">${d.duo ? 'Duo' : RARITY[b.r].name} · Lv ${b.lv} · ${SLOT_LABEL[d.slot]}</span><div class="small">${esc(d.desc(boonPower(b) * (P ? P.stats.devotion : 1)))}</div></div></div>`; }).join('') || '<p class="muted">No boons yet.</p>'}
      ${Object.entries(run.disc).map(([id, lv]) => { const D = DISC_BY_ID[id]; return `<div class="bld relic"><span class="g" style="font-family:var(--mincho)">${D.icon}</span><div><b>${esc(D.name)}</b> <span class="muted small">Discipline · Lv ${lv}</span><div class="small">${esc(D.desc(lv * (P.stats.discMult || 1)))}</div></div></div>`; }).join('')}
      ${run.relics.map(r => { const R = RELIC_BY_ID[r]; return `<div class="bld relic"><span class="g">${R.icon}</span><div><b>${esc(R.name)}</b><div class="small">${esc(R.desc)}</div></div></div>`; }).join('')}</div>
      <div class="muted small">Rerolls: ${run.rerolls} · Second Winds: ${run.defy} · Gold: ${run.gold}</div>` : '';
    const p = this.open(`
      <h2>Paused <span class="jp">一時停止</span></h2>
      ${build}
      <div class="menu-list">
        <button class="btn menu-btn" data-close>Resume</button>
        <button class="btn menu-btn" id="p-how">How to Play</button>
        <button class="btn menu-btn" id="p-set">Settings</button>
        ${run ? '<button class="btn menu-btn danger" id="p-ab">Abandon Run</button>' : ''}
        <button class="btn menu-btn ghost" id="p-title">Quit to Title</button>
      </div>`, null, { wide: !!run });
    $('#p-how', p).onclick = () => this.howTo();
    $('#p-set', p).onclick = () => this.settings(false, () => this.pause());
    const ab = $('#p-ab', p);
    if (ab) ab.onclick = () => {
      if (!ab.dataset.armed) { ab.dataset.armed = 1; ab.textContent = 'Click again to abandon'; return; }
      this.close(); P.hp = 0; P.iframes = 0; G.run.defy = 0; G.run.crane = 0; G.playerDown();
    };
    $('#p-title', p).onclick = () => {
      if (run) { SAVE.data.deaths++; }
      SAVE.save(); this.close(); G.clearWorld(); G.run = null; P = null; G.scene = 'title'; G.makeHubRoom(); this.bossBar(null); this.title();
    };
  },
  results(sum, done) {
    const h = HEROES[sum.hero];
    const mins = Math.floor(sum.time / 60), secs = Math.floor(sum.time % 60);
    const acts = CAMPAIGNS[sum.camp || 0].acts;
    const where = sum.victory ? (sum.camp === 3 ? 'The festival is over, for now' : sum.camp === 2 ? 'The Calamity is sealed — for now' : sum.camp ? 'The Black Sun is broken' : sum.trueEnd ? 'The Eighth Moon is restored' : 'Mugen defeated') : `Fell in ${acts[sum.act].name}, room ${sum.room}`;
    const p = this.open(`
      <div class="res-head ${sum.victory ? 'win' : 'lose'}">${sum.victory ? (sum.trueEnd ? '真 · TRUE VICTORY' : '勝利 · VICTORY') : '敗北 · DEFEATED'}</div>
      <p class="center muted">${esc(where)}</p>
      <div class="stats-grid">
        <div><b>${h.name.split(' ')[0]}</b><span>Hero</span></div><div><b>${mins}:${String(secs).padStart(2, '0')}</b><span>Time</span></div><div><b>${sum.kills}</b><span>Foes slain</span></div>
        <div><b>${sum.dmg}</b><span>Damage dealt</span></div><div><b>+${sum.shards}</b><span>Spirit Shards</span></div><div><b>+${sum.keys}</b><span>Moon Keys</span></div>
        <div><b>${sum.heat}</b><span>Moon Phase</span></div><div><b>${sum.boons.length}</b><span>Boons</span></div><div><b>${sum.relics.length}</b><span>Relics</span></div>
      </div>
      <div class="build mini">${sum.boons.map(b => { const d = BOON_BY_ID[b.id]; return `<span class="chip" style="--c:${KAMI[d.k].color}">${KAMI[d.k].glyph} ${esc(d.name)} ${b.lv > 1 ? 'Lv' + b.lv : ''}</span>`; }).join('')}${sum.relics.map(r => `<span class="chip">${RELIC_BY_ID[r].icon} ${esc(RELIC_BY_ID[r].name)}</span>`).join('')}${Object.entries(sum.disc || {}).map(([id, lv]) => `<span class="chip">${DISC_BY_ID[id].icon} ${esc(DISC_BY_ID[id].name)} Lv${lv}</span>`).join('')}</div>
      <div class="row-end"><button class="btn big" id="res-ok">Return to the Shrine</button></div>`, null, { noEsc: true, wide: true });
    $('#res-ok', p).onclick = () => { SFX.play('uiok'); this.close(); done(); };
    this.keyHandler = (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); this.close(); done(); } };
  },
};
