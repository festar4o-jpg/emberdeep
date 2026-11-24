'use strict';
// Performance: the optional FPS counter (Settings > Performance > Show FPS).
// perfFrame runs at the end of every frame (main.js) with the time since the last frame and how long this one took
// to update and draw. The counter shows frames per second, the average work per frame in ms and the slowest frame
// of the last second (what a stutter looks like); it only touches the page twice a second.
const PERF={n:0,acc:0,work:0,worst:0,t:0,shown:'',idleAt:-1e9,draws:0};
const IDLE_DRAW_MS=250; // main.js: with a menu open the scene is redrawn 4 times a second instead of every frame
function perfFrame(gapMs,workMs){if(!SETTINGS.fps)return;const P=PERF;P.n++;P.acc+=gapMs;P.work+=workMs;P.worst=Math.max(P.worst,gapMs);
  if(P.acc<500)return;const fps=P.n*1000/P.acc,txt=`${Math.round(fps)} fps · ${(P.work/P.n).toFixed(1)} ms · slowest ${Math.round(P.worst)} ms`;
  P.n=0;P.acc=0;P.work=0;P.worst=0;if(txt!==P.shown){P.shown=txt;const el=$('fpsTxt');if(el)el.textContent=txt;}}
function applyPerfSettings(){const el=$('fpsTxt');if(el)el.classList.toggle('hidden',!SETTINGS.fps);PERF.shown='';}
