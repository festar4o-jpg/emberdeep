'use strict';
// Main loop and boot.
// ---------- main loop ----------
let last=performance.now();
function frame(now){
  const gap=now-last,dt=Math.min(0.05,gap/1000);last=now;const t0=performance.now();
  if(G.hitStop>0)G.hitStop-=dt; // hit-stop: heavy blows freeze the action for a few frames (fx.js)
  else if(G.char&&G.p&&!G.paused&&!portraitBlocked())update(dt);
  render();musicTick(dt); // music.js
  if(G.char&&G.p){updateHud();G.mmT-=dt;if(G.mmT<=0){G.mmT=0.2;drawMinimap();}}
  perfFrame(gap,performance.now()-t0); // perf.js: FPS counter
  requestAnimationFrame(frame);
}
migrateSaves();loadStash();loadCur();loadSigils();loadEngs();loadBook();loadSettings();setupBackupUi();
resize();showTitle();requestAnimationFrame(frame);
$('verTxt').textContent='Emberdeep v'+GAME_VERSION;
// Debug autotest (a bot that plays and reports; see debug/autotest.js): only with ?autotest=1 in the URL. The file is not in
// sw.js FILES, so the Android app and the public site don't have it and can never run it.
if(typeof location!=='undefined'&&/[?&]autotest=1(&|$)/.test(location.search||'')){const s=document.createElement('script');s.src='debug/autotest.js';document.head.appendChild(s);}
if(installedApp())$('startOv').classList.add('hidden'); // the installed app already opens fullscreen in landscape
// Service worker for "Add to Home Screen" and offline play (only on https or localhost).
if(typeof navigator!=='undefined'&&'serviceWorker' in navigator&&typeof location!=='undefined'&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'))
  addEventListener('load',()=>{
    // When an updated service worker takes over a page an older one was serving, reload once so no old file stays on screen.
    // (Only on title/start screens: never yank a hero out of a fight; the next launch picks the update up anyway.)
    const hadOld=!!navigator.serviceWorker.controller;let reloaded=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!hadOld||reloaded||G.char)return;reloaded=true;location.reload();});
    navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{});});
