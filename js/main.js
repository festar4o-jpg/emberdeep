'use strict';
// Main loop and boot.
// ---------- main loop ----------
let last=performance.now();
function frame(now){
  const dt=Math.min(0.05,(now-last)/1000);last=now;
  if(G.hitStop>0)G.hitStop-=dt; // hit-stop: heavy blows freeze the action for a few frames (fx.js)
  else if(G.char&&G.p&&!G.paused&&!portraitBlocked())update(dt);
  render();
  if(G.char&&G.p){updateHud();G.mmT-=dt;if(G.mmT<=0){G.mmT=0.2;drawMinimap();}}
  requestAnimationFrame(frame);
}
migrateSaves();loadStash();loadBook();loadSettings();setupBackupUi();
resize();showTitle();requestAnimationFrame(frame);
$('verTxt').textContent='Emberdeep v'+GAME_VERSION;
if(installedApp())$('startOv').classList.add('hidden'); // the installed app already opens fullscreen in landscape
// Service worker for "Add to Home Screen" and offline play (only on https or localhost).
if(typeof navigator!=='undefined'&&'serviceWorker' in navigator&&typeof location!=='undefined'&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'))
  addEventListener('load',()=>{
    // When an updated service worker takes over a page an older one was serving, reload once so no old file stays on screen.
    // (Only on title/start screens: never yank a hero out of a fight; the next launch picks the update up anyway.)
    const hadOld=!!navigator.serviceWorker.controller;let reloaded=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!hadOld||reloaded||G.char)return;reloaded=true;location.reload();});
    navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{});});
