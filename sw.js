'use strict';
// Service worker: the installed home-screen app works fully offline.
// Network first: while the game server runs, every file comes fresh from it and replaces the cached copy;
// when the server is off (or doesn't answer in time) the cached copy is used instead.
// An "off" server on a phone often doesn't refuse connections: Android freezes the Termux process, so requests just hang.
// Requests that get no answer within TIMEOUT (2 s) count as failed, so a launch never hangs waiting for the server.
// Page navigations that fail fall back to the cached index.html (it is the whole game; every page load refreshes it).
// So the first request that fails or times out switches the worker offline: every request still waiting is cut short and
// served from the cache, and later requests skip the network entirely. The next page load (launch or reload) tries the
// server again and goes back online if it answers.
// Saves live in localStorage, which a service worker never reads, writes or clears.
// FILES must list every file the page loads; VERSION must equal GAME_VERSION in js/core.js (tests/game-check.js checks both).
const VERSION='1.0.151',CACHE='emberdeep-'+VERSION,TIMEOUT=2000,INSTALL_TIMEOUT=10000;
// The painted hero's pictures (art/, js/heroart.js) are big and rarely change, so they live in their own cache that
// survives game updates: each one is downloaded the first time it is needed and then always served from the cache.
// Rebuilt art (tools/hero-art/build.js) needs a new ART name, which drops the old pictures.
const ART='emberart-1';
const FILES=[ "./", "index.html", "style.css", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "js/core.js", "js/items.js", "js/uniques.js", "js/maps.js", "js/towns.js", "js/skills.js", "js/skillmods.js", "js/skillalts.js", "js/ranger.js", "js/ailments.js", "js/subclasses.js", "js/passives.js", "js/monsters.js", "js/bossfight.js", "js/game.js", "js/render.js", "js/light.js", "js/sprites.js", "js/hero.js", "js/heroart.js", "js/monart.js", "js/fx.js", "js/sfx.js", "js/music.js", "js/ui.js", "js/stash.js", "js/sockets.js", "js/charms.js", "js/smith.js", "js/currency.js", "js/encounters.js", "js/waystone.js", "js/zones.js", "js/acts.js", "js/portal.js", "js/sigils.js", "js/pinnacle.js", "js/rifts.js", "js/embers.js", "js/backup.js", "js/perf.js", "js/hints.js", "js/treeui.js", "js/updates.js", "changes.json", "js/main.js"];
// One cache entry per file, whatever ?query it was opened with (play.sh opens ./?v=<time>).
const key=u=>{const x=new URL(u,self.location.href);x.search='';x.hash='';return x.href;};
let offline=false;const waiting=new Set();
const goOffline=()=>{offline=true;for(const ac of [...waiting])ac.abort();};
const fresh=(req,ms)=>{const ac=new AbortController(),t=setTimeout(()=>ac.abort(),ms);waiting.add(ac);
  return fetch(req,{cache:'no-cache',signal:ac.signal}).finally(()=>{clearTimeout(t);waiting.delete(ac);});};
const cached=async r=>{const c=await caches.open(CACHE);
  return (await c.match(key(r.url)))||(r.mode==='navigate'&&((await c.match(key('index.html')))||(await c.match(key('./')))))||null;};
// The start page is cached under both / and /index.html, so the navigation fallback is always the newest copy.
const START=[key('./'),key('index.html')];
// skipWaiting + clients.claim: a new version takes over open pages right away instead of waiting for every tab to close.
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.all(FILES.map(f=>
  fresh(f,INSTALL_TIMEOUT).then(res=>{if(!res.ok)throw new Error('sw: could not cache '+f);return c.put(key(f),res);})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('emberdeep-')&&k!==CACHE||k.startsWith('emberart-')&&k!==ART).map(k=>caches.delete(k))))
  .then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==self.location.origin)return;
  const nav=r.mode==='navigate';
  if(new URL(r.url).pathname.includes('/art/')){e.respondWith(caches.open(ART).then(async c=>{const k=key(r.url),m=await c.match(k);if(m)return m;
    const res=await fetch(r);if(res.ok&&res.type==='basic')await c.put(k,res.clone()).catch(()=>{});return res;}).catch(()=>Response.error()));return;}
  if(nav)offline=false; // every page load gives the server another chance
  e.respondWith((async()=>{
    if(offline){const m=await cached(r);if(m)return m;}
    try{
      const res=await fresh(r,TIMEOUT);
      if(res.ok&&res.type==='basic'){const k=key(r.url),ks=nav&&START.includes(k)?START:[k],copies=ks.map(()=>res.clone());
        e.waitUntil(caches.open(CACHE).then(c=>Promise.all(ks.map((x,i)=>c.put(x,copies[i])))).catch(()=>{}));}
      return res;
    }catch(err){goOffline();return (await cached(r))||Response.error();}
  })());});
