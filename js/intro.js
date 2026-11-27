'use strict';
// v1.0.162: the opening (roadmap: the first 10 minutes). A brand-new hero first sees the Mourning Fields at night
// from a slow drifting camera, black bars top and bottom, while four short lines of story fade in and out; then the
// title, and the hero takes over. The world holds still meanwhile (no update), but fires and lights keep moving.
// Tap or any key skips. Only once per hero (c.intro), started by ui.js right after a hero is created.
const INTRO={on:false,t:0,from:null,shown:-1};
const INTRO_LINES=['Long ago, the world\'s last fire was buried deep beneath Gravewatch.','Now the ember stirs, and the dead will not stay in the ground.',
  'Bells ring with no hand to pull them. Lights walk the fields at night.','Gravewatch needs someone who will walk into the dark.'];
const INTRO_LINE_S=5,INTRO_TITLE_S=3.6,INTRO_S=INTRO_LINES.length*INTRO_LINE_S+INTRO_TITLE_S;
function introStart(){const p=G.p,c=G.char;if(!p||!c||c.intro)return;c.intro=1;
  // start some way up and to the right of the hero, inside the map, and drift down onto them
  const W=MW*TILE,H=MH*TILE;INTRO.from={x:Math.max(300,Math.min(W-300,p.x+560)),y:Math.max(260,Math.min(H-260,p.y-460))};
  INTRO.on=true;INTRO.t=0;INTRO.shown=-1;G.cam.x=INTRO.from.x;G.cam.y=INTRO.from.y;
  $('introOv').classList.remove('hidden');$('introOv').classList.remove('out');$('hud').classList.add('hidden');$('introTxt').className='';}
// every frame instead of update() while it runs: time for flames and lights, the camera, the lines
function introTick(dt){INTRO.t+=dt;G.time+=dt;const p=G.p,k=Math.min(1,INTRO.t/(INTRO_S-1)),e=k*k*(3-2*k);
  G.cam.x=INTRO.from.x+(p.x-INTRO.from.x)*e;G.cam.y=INTRO.from.y+(p.y-INTRO.from.y)*e;
  const i=Math.floor(INTRO.t/INTRO_LINE_S),el=$('introTxt');
  if(i!==INTRO.shown){INTRO.shown=i;if(i<INTRO_LINES.length){el.className='';el.textContent=INTRO_LINES[i];void el.offsetWidth;el.className='in';}
    else{el.className='';el.innerHTML='<b>EMBERDEEP</b><small>'+esc(G.zone&&ZONES[G.zone]?ZONES[G.zone].name:'')+'</small>';void el.offsetWidth;el.className='in title';}}
  if(i<INTRO_LINES.length&&INTRO.t-i*INTRO_LINE_S>INTRO_LINE_S-1.1&&el.className==='in')el.className='in fade';
  if(INTRO.t>=INTRO_S)introEnd();}
function introEnd(){if(!INTRO.on)return;INTRO.on=false;const o=$('introOv');o.classList.add('out');setTimeout(()=>o.classList.add('hidden'),900);
  $('hud').classList.remove('hidden');saveChar();if(!HINT.cur)nextHint();}
if(typeof addEventListener==='function'){addEventListener('pointerdown',()=>{if(INTRO.on&&INTRO.t>0.4)introEnd();},{passive:true});addEventListener('keydown',()=>{if(INTRO.on&&INTRO.t>0.4)introEnd();});}
