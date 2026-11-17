'use strict';
/* =====================================================================
   KAGEBANA — pwa.js
   Lets the game be installed as an app and played offline (with sw.js
   and manifest.webmanifest).
   - Registers the service worker (on the live https site, or with ?sw).
   - Keeps Chrome's install offer so the title screen can show a button.
   - Once, on Wi-Fi, loads the Japanese font pieces the game's text uses,
     so kanji still look right offline even on screens you haven't seen.
   ===================================================================== */
const PWA = {
  prompt: null, // Chrome's saved install offer, if the game can be installed right now
  installed() { try { return matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } },
  init() {
    addEventListener('beforeinstallprompt', e => { e.preventDefault(); this.prompt = e; this.refresh(); });
    addEventListener('appinstalled', () => { this.prompt = null; this.refresh(); });
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && !/[?&]sw\b/.test(location.search)) return;
    navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => setTimeout(() => this.warmFonts(), 5000)).catch(() => {});
  },
  /* Redraw the title screen's menu if it's showing, so the Install button appears or goes. */
  refresh() { try { if (typeof G !== 'undefined' && G.scene === 'title' && UI.titleEl && UI.titleEl.className === 'show' && !document.querySelector('#modal.show')) UI.title(); } catch (e) { /* not ready yet */ } },
  async install() {
    const p = this.prompt; if (!p) return false;
    this.prompt = null;
    try { p.prompt(); const r = await p.userChoice; return r && r.outcome === 'accepted'; } catch (e) { return false; } finally { this.refresh(); }
  },
  /* Google serves the Japanese fonts in ~100 small pieces and the browser only fetches the pieces a
     page has drawn. Ask for every non-Latin character in the game's files so sw.js saves them all. */
  async warmFonts() {
    try {
      const ver = (document.querySelector('script[src*="game.js"]') || { src: '' }).src.split('?')[1] || '0';
      if (localStorage.getItem('kagebana_fonts') === ver || !document.fonts || !navigator.onLine) return;
      const c = navigator.connection;
      if (c && (c.saveData || c.type === 'cellular')) return; // a few MB: wait for Wi-Fi
      const chars = new Set();
      for (const s of document.querySelectorAll('script[src^="js/"], script[src*="/js/"]')) {
        const txt = await fetch(s.src).then(r => r.text());
        for (const ch of txt) if (ch.codePointAt(0) > 0x2000) chars.add(ch);
      }
      for (const ch of 'Aa0—·') chars.add(ch);
      const codes = [...chars].map(ch => ch.codePointAt(0));
      // Read the font stylesheet, and fetch each piece whose character range covers something we use.
      // Fetching (rather than asking the browser to load the font) makes sure sw.js sees and saves it.
      const link = document.querySelector('link[rel="stylesheet"][href*="fonts.googleapis.com"]');
      if (!link || !navigator.serviceWorker.controller) return;
      const css = await fetch(link.href).then(r => r.text());
      const want = [];
      for (const block of css.match(/@font-face\s*\{[^}]*\}/g) || []) {
        const url = (block.match(/url\(([^)]+)\)/) || [])[1], range = (block.match(/unicode-range:\s*([^;]+)/) || [])[1];
        if (!url) continue;
        const spans = (range || 'U+0-10FFFF').split(',').map(r => { const m = r.trim().replace(/^U\+/i, '').split('-'); return [parseInt(m[0].replace(/\?/g, '0'), 16), parseInt((m[1] || m[0]).replace(/\?/g, 'F'), 16)]; });
        if (codes.some(c => spans.some(([a, b]) => c >= a && c <= b))) want.push(url.replace(/["']/g, ''));
      }
      let ok = 0;
      for (let i = 0; i < want.length; i += 8) ok += (await Promise.all(want.slice(i, i + 8).map(u => fetch(u).then(r => r.ok, () => false)))).filter(Boolean).length;
      if (ok === want.length) localStorage.setItem('kagebana_fonts', ver);
    } catch (e) { /* try again next visit */ }
  },
};
PWA.init();
