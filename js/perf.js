'use strict';
// Performance: the optional FPS counter (Settings > Performance > Show FPS).
// perfFrame runs at the end of every frame (main.js) with the time since the last frame and how long this one took
// to update and draw. The counter shows frames per second, the average work per frame in ms and the slowest frame
// of the last second (what a stutter looks like); it only touches the page twice a second.
const PERF={n:0,acc:0,work:0,worst:0,t:0,shown:'',idleAt:-1e9,draws:0};
// Frame rate cap (Settings > Performance): 30, 60 or 0 = as fast as the screen refreshes. A frame that comes sooner
// than the cap allows is skipped whole (no update, no draw); FPS_SLACK_MS absorbs the screen's timing jitter, so
// 60 on a 60Hz screen never drops frames and 30 takes every second one. The game's speed doesn't change: update()
// gets the real time that passed.
const FPS_CAPS=[30,60,0],FPS_SLACK_MS=4;
function capSkip(gapMs){const c=SETTINGS.fpsCap;return c>0&&gapMs<1000/c-FPS_SLACK_MS;}
const IDLE_DRAW_MS=250; // main.js: with a menu open the scene is redrawn 4 times a second instead of every frame
function perfFrame(gapMs,workMs){if(!SETTINGS.fps)return;const P=PERF;P.n++;P.acc+=gapMs;P.work+=workMs;P.worst=Math.max(P.worst,gapMs);
  if(P.acc<500)return;const fps=P.n*1000/P.acc,txt=`${Math.round(fps)} fps · ${(P.work/P.n).toFixed(1)} ms · slowest ${Math.round(P.worst)} ms`;
  P.n=0;P.acc=0;P.work=0;P.worst=0;if(txt!==P.shown){P.shown=txt;const el=$('fpsTxt');if(el)el.textContent=txt;}}
function applyPerfSettings(){const el=$('fpsTxt');if(el)el.classList.toggle('hidden',!SETTINGS.fps);PERF.shown='';applySaver();}
// Battery saver (Settings > Performance, or by itself when the battery is under SAVER_LOW and not charging): draws at
// 1x instead of up to 2x on sharp screens (render.js resize), about half the sparks and particles (game.js burst,
// fx.js part), a coarser light map and fewer coloured glows (light.js). Switching it off while it is on by itself
// keeps it off until the phone has been charged above SAVER_LOW again.
const SAVER_LOW=0.2;
function saverOn(){return SETTINGS.saver===true||PERF.autoSaver===true;}
function applySaver(){const on=saverOn();if(PERF.saver===on&&PERF.saverSet)return;PERF.saver=on;PERF.saverSet=true;
  LIGHT_RES=on?0.22:0.33;GLOW_MAX=on?8:24;if(typeof resize==='function'&&typeof cv!=='undefined')resize();}
function batteryCheck(b){const low=b.level<SAVER_LOW&&!b.charging;
  if(low&&!PERF.autoSaver&&!PERF.autoDismissed&&!SETTINGS.saver){PERF.autoSaver=true;applySaver();toast('Battery low','Battery saver is on (Settings to turn it off)');}
  else if(!low&&(PERF.autoSaver||PERF.autoDismissed)){PERF.autoSaver=false;PERF.autoDismissed=false;applySaver();}}
function watchBattery(){try{if(typeof navigator==='undefined'||!navigator.getBattery)return;navigator.getBattery().then(b=>{batteryCheck(b);
  b.addEventListener('levelchange',()=>batteryCheck(b));b.addEventListener('chargingchange',()=>batteryCheck(b));}).catch(()=>{});}catch(e){}} // not every phone tells
