'use strict';
/* =====================================================================
   KAGEBANA — dev.js  (only loaded with ?dev in the URL)
   Jump to any scene or boss, and crash-test the whole cast. Uses its own
   save slot, so it never touches a real save. Press ` to show or hide.
   ===================================================================== */
SAVE.key = 'kagebana_dev_save';

const DEV = {
  god: false,
  errors: [],

  /* ---------------- jumps ---------------- */
  startGame() { const t = document.querySelector('#title'); if (t) t.className = ''; UI.setModal(false); UI.close && UI.close(); },
  /* Drops anything still pending from wherever we jumped from: timers, fades, slow-motion, open dialogue. */
  resetState() {
    this.closeOverlays();
    G.clearWorld(); G.run = null; G.timers = [];
    G.timeScale = 1; G.slowT = 0; G.timeStopT = 0; G.hitstop = 0;
    G.fadeDir = 0; G.fadeCb = null; G.fadeA = 0;
    G.controlLocked = false; G.camTarget = null;
  },
  scene(flags) {
    const f = SAVE.data.flags;
    for (const k of ['arcEnd', 'cs1', 'cs2', 'newcomer', 'riftAt', 't_open', 't_arrive', 't_rescue', 't_rescueRuns', 't_forge']) delete f[k];
    Object.assign(f, { prologue: true }, flags);
    SAVE.save(); this.startGame(); this.resetState();
    G.scene = 'hub';
    G.toHub();
  },
  /* Plays out the tag-team fight with a crude bot, instantly. It doesn't dodge, so downs are a worst case. */
  botFight(allyId, heroId = 'akane') {
    SAVE.data.hero = heroId; SAVE.data.heroes[heroId].unlocked = true;
    this.scene({ arcEnd: true, cs1: true });
    G.timers = []; G.controlLocked = true;
    G.npcs.push(makeFighter('sekka', 1150, 660, 0), makeFighter('kuroto', 850, 660, 0));
    G.startHubFight(allyId);
    const F = G.hubFight, b = F.boss;
    const log = { allyId, heroId, seconds: 0, downs: 0, phases: 0, tags: 0, playerHits: 0, ended: false };
    const realDown = G.hubFightDown, realTag = G.tagAttack, realHurt = G.hurtPlayer;
    G.hubFightDown = function () { log.downs++; return realDown.call(this); };
    G.tagAttack = function (x) { log.tags++; return realTag.call(this, x); };
    G.hurtPlayer = function (d, s) { const r = realHurt.call(this, d, s); if (r) log.playerHits++; return r; };
    let cd = 0, ang = 0;
    try {
      for (; log.seconds < 240 && G.hubFight; log.seconds += 1 / 30) {
        ang += 1 / 30;
        const reach = 80;
        P.x = b.x + Math.cos(ang) * reach; P.y = b.y + Math.sin(ang) * reach; G.resolve(P);
        P.aim = angTo(P, b);
        cd -= 1 / 30; if (cd <= 0) cd = P.hero.attack(P) || 0.3;
        if (F.tag >= 100) G.tagAttack(F);
        G.update(1 / 30);
        log.phases = b.phase;
      }
      log.ended = !G.hubFight;
    } finally { G.hubFightDown = realDown; G.tagAttack = realTag; G.hurtPlayer = realHurt; }
    log.seconds = Math.round(log.seconds);
    log.rivalHpPct = Math.round(b.hp / b.maxHp * 100);
    return log;
  },
  campOf(id) {
    const d = BOSSES[id], inCamp = c => CAMPAIGNS[c].acts.some(b => b.boss === id || b.altBoss === id || b.duel === id);
    return d.god || id === 'omaga' ? 2 : inCamp(3) ? 3 : inCamp(1) ? 1 : 0;
  },
  fightBoss(id) {
    this.startGame();
    const camp = this.campOf(id);
    G.startRun(camp); G.fadeDir = 0; G.fadeCb = null; G.fadeA = 0;
    G.run.bossFor = G.acts().map(() => id);
    G.enterRoom({ type: 'boss', boss: id });
  },
  /* Every hero and Form, fragment, seal, boss win, Codex entry and lantern, plus lots of shards and keys.
     Story flags are left alone, so Arc II scenes still play (use the Scene buttons for those). */
  unlockAll() {
    const S = SAVE.data;
    for (const id of HERO_ORDER) { const h = S.heroes[id]; h.unlocked = true; h.forms = HEROES[id].forms.map((_, i) => i); }
    S.fragments = FRAGMENTS.map(f => f.id);
    S.seals = SEALS.map(s => s.id);
    for (const id of Object.keys(BOSSES)) { S.bossKills[id] = Math.max(1, S.bossKills[id] || 0); S.bossMeets[id] = Math.max(1, S.bossMeets[id] || 0); S.seen[id] = true; }
    for (const id of Object.keys(ENEMIES)) S.seen[id] = true;
    for (const r of RELICS) S.relicsSeen[r.id] = true;
    for (const k of Object.keys(KAMI)) S.kamiSeen[k] = true;
    for (const m of MIRROR) S.mirror[m.id] = m.max;
    S.shards = Math.max(S.shards, 99999); S.keys = Math.max(S.keys, 999);
    S.clears = Math.max(S.clears, 1);
    S.talked.pt_assist = true;
    SAVE.save();
    if (G.scene === 'hub') G.toHub();
  },
  hero(id) { const S = SAVE.data; S.heroes[id].unlocked = true; S.hero = id; SAVE.save(); if (G.scene === 'hub') G.toHub(); },
  tick() {
    if (this.god && P) { P.hp = P.stats.maxHp; P.ult = 100; if (G.hubFight) G.hubFight.tag = 100; }
    requestAnimationFrame(() => this.tick());
  },

  /* ---------------- crash test ---------------- */
  /* Runs synchronously with a stepped clock, so it is fast and doesn't depend on the frame rate. */
  sim(seconds) { for (let t = 0; t < seconds; t += 1 / 30) { G.update(1 / 30); G.render(); } },
  fail(where, err) { this.errors.push({ where, error: String(err && err.message || err), at: String(err && err.stack || '').split('\n').slice(1, 3).map(s => s.trim()).join(' < ') }); },
  arena(camp) {
    G.startRun(camp); G.fadeDir = 0; G.fadeCb = null; G.fadeA = 0;
    G.clearWorld(); G.makeRoom({ type: 'boss' });
    const R = G.room; P.x = R.x0 + R.w / 2; P.y = R.y0 + R.h - 150; G.controlLocked = false;
    return R;
  },
  closeOverlays() { try { UI.close(); } catch (e) { /* nothing open */ } const d = document.querySelector('#dialogue'); if (d) d.classList.add('hidden'); UI.modal = false; UI.dlgDone = null; if (UI.setModal) UI.setModal(false); },
  smoke() {
    this.errors = [];
    const report = { heroes: 0, bosses: 0, patterns: 0, defeats: 0, missingPatterns: [] };
    const saved = JSON.stringify(SAVE.data), wasGod = this.god;
    this.startGame(); this.god = false;
    const allHeroes = Object.keys(HEROES);
    for (const id of allHeroes) {
      try {
        SAVE.data.heroes[id].unlocked = true; SAVE.data.hero = id;
        const R = this.arena(0);
        const dummy = G.spawnEnemy('kappa', P.x, P.y - 160, { noSpawn: true, hpMult: 200 });
        P.aim = -Math.PI / 2;
        const H = P.hero;
        for (let i = 0; i < 6; i++) { if (H.attack) H.attack(P); this.sim(0.3); }
        if (H.special) H.special(P); this.sim(1);
        if (H.swap) for (let i = 0; i < 3; i++) { H.swap(P); H.attack(P); H.special(P); this.sim(1); }
        if (H.ult) H.ult(P); this.sim(4);
        report.heroes++;
      } catch (e) { this.fail('hero ' + id, e); }
      this.closeOverlays();
    }
    SAVE.data.hero = 'akane';
    for (const id of Object.keys(BOSSES)) {
      const d = BOSSES[id], camp = this.campOf(id);
      let boss;
      try {
        this.arena(camp);
        boss = G.spawnEnemy(id, G.room.w / 2, G.room.h * 0.38, { noSpawn: true });
        G.boss = boss; UI.bossBar(boss);
        P.invuln = 1e6; boss.intro = 0;
      } catch (e) { this.fail('boss spawn ' + id, e); this.closeOverlays(); continue; }
      const pats = new Set(d.patterns.flat()); if (d.desperation) pats.add(d.desperation.pat);
      for (const p of pats) {
        if (!BOSS_PAT[p]) { report.missingPatterns.push(id + ':' + p); continue; }
        for (const phase of [0, d.phases.length]) {
          try { boss.phase = phase; boss.busy = 9; BOSS_PAT[p](boss); this.sim(1.5); report.patterns++; }
          catch (e) { this.fail(`boss ${id} pattern ${p} (phase ${phase})`, e); }
        }
      }
      report.bosses++;
      if (!d.duel || !id.startsWith('duel_')) {
        try { boss.invulnT = 0; G.killEnemy(boss); this.sim(2); report.defeats++; }
        catch (e) { this.fail('boss defeat ' + id, e); }
      }
      this.closeOverlays();
    }
    // leave things as they were
    SAVE.data = JSON.parse(saved); SAVE.save();
    this.god = wasGod; this.closeOverlays();
    this.resetState();
    G.toHub();
    report.errors = this.errors;
    console.log('[smoke]', report);
    return report;
  },

  /* ---------------- the panel ---------------- */
  panel() {
    const el = document.createElement('div');
    el.id = 'devpanel';
    el.style.cssText = 'position:fixed;top:8px;right:8px;z-index:9999;width:230px;max-height:calc(100vh - 16px);overflow:auto;background:rgba(10,8,18,.94);color:#eee;font:12px sans-serif;padding:8px;border:1px solid #5b2b8a;border-radius:6px';
    const sel = (label, opts, fn) => {
      const s = document.createElement('select'); s.style.cssText = 'width:100%;margin:2px 0 6px';
      s.innerHTML = `<option value="">${label}…</option>` + opts.map(o => `<option value="${o}">${o}</option>`).join('');
      s.onchange = () => { if (s.value) fn(s.value); s.value = ''; s.blur(); };
      el.appendChild(s);
    };
    const btn = (label, fn) => {
      const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'display:block;width:100%;margin:2px 0;padding:3px;cursor:pointer';
      b.onclick = () => { fn(b); b.blur(); }; el.appendChild(b);
    };
    const h = document.createElement('b'); h.textContent = 'KAGEBANA DEV (` hides)'; el.appendChild(h);
    btn('Unlock everything', b => { this.unlockAll(); b.textContent = 'Unlock everything ✓'; });
    btn('Scene: shrine breaks, rift opens', () => this.scene({ arcEnd: true }));
    btn('Scene: rift entrance + tag team', () => this.scene({ arcEnd: true, cs1: true }));
    btn('Scene: after the rift', () => this.scene({ arcEnd: true, cs1: true, cs2: true, newcomer: 'sekka' }));
    btn('Scene: rift settled', () => this.scene({ arcEnd: true, cs1: true, cs2: true, newcomer: 'sekka', riftAt: -1 }));
    btn('Scene: forge relit', () => this.scene({ arcEnd: true, cs1: true, cs2: true, newcomer: 'sekka', t_open: true, t_arrive: true, t_rescue: true, t_rescueRuns: 0 }));
    btn('Start Tokoyo (first time)', () => { this.scene({ arcEnd: true, cs1: true, cs2: true, newcomer: 'sekka', t_open: true }); G.startRun(3); });
    sel('Shard Assist partner', Object.keys(HEROES), v => { SAVE.data.talked.pt_assist = true; SAVE.data.heroes[v].unlocked = true; SAVE.data.assist = v; SAVE.save(); if (G.run) G.run.assistCd = 0; });
    btn('Start Campaign I', () => { this.startGame(); G.startRun(0); });
    btn('Start Campaign II', () => { this.startGame(); G.startRun(1); });
    btn('Start Campaign III', () => { this.startGame(); G.startRun(2); });
    sel('Play as', Object.keys(HEROES), v => this.hero(v));
    sel('Fight boss', Object.keys(BOSSES).filter(id => !id.startsWith('duel_')), v => this.fightBoss(v));
    btn('God mode: off', b => { this.god = !this.god; b.textContent = 'God mode: ' + (this.god ? 'on' : 'off'); });
    btn('Rival/boss to 1 hit from finish', () => { if (G.boss) G.boss.hp = G.boss.maxHp * ((G.boss.scriptedFloor || 0) + 0.01); });
    btn('Crash-test everything', () => { const r = this.smoke(); alert(`Heroes ${r.heroes}, bosses ${r.bosses}, patterns ${r.patterns}, defeats ${r.defeats}\nErrors: ${r.errors.length}\nDetails in the console.`); });
    document.body.appendChild(el);
    addEventListener('keydown', e => { if (e.code === 'Backquote') el.style.display = el.style.display === 'none' ? '' : 'none'; });
  },
};
window.DEV = DEV;
addEventListener('load', () => { DEV.panel(); DEV.tick(); });
