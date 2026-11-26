'use strict';
// New-player hints: short tips in their own box (top centre), each shown once per phone (not per hero), queued so
// none is lost under other messages, shown HINT_SHOW seconds or until tapped. Settings › Controls: Hints on/off and
// Show hints again (forgets which were seen). hint(key, title, text) is called where something first happens.
const HINT_KEY='emberdeep_hints',HINT_SHOW=6;
const HINT={seen:{},q:[],cur:null,t:0,slowT:0,slowF:0};
function loadHints(){try{const o=JSON.parse(localStorage.getItem(HINT_KEY));if(o&&typeof o==='object')HINT.seen=o;}catch(e){}}
function storeHints(){try{localStorage.setItem(HINT_KEY,JSON.stringify(HINT.seen));}catch(e){}}
function hint(key,title,text){if(SETTINGS.hints===false||HINT.seen[key])return false;HINT.seen[key]=1;storeHints();HINT.q.push({key,title,text});if(!HINT.cur)nextHint();return true;}
function nextHint(){const el=$('hintBox');HINT.cur=HINT.q.shift()||null;HINT.t=HINT_SHOW;if(!el)return;
  if(HINT.cur){el.innerHTML=`<b>💡 ${esc(HINT.cur.title)}</b>${esc(HINT.cur.text)}<small>tap to close${HINT.q.length?` · ${HINT.q.length} more`:''}</small>`;el.classList.remove('hidden');}else el.classList.add('hidden');}
function resetHints(){HINT.seen={};storeHints();HINT.q=[];HINT.cur=null;nextHint();}
// every frame (main.js), with the real time passed: the box timer, and the slow-game check
function hintTick(dt,idle){if(HINT.cur){HINT.t-=dt;if(HINT.t<=0)nextHint();}
  // running slow: under HINT_SLOW_FPS on average over HINT_SLOW_S seconds of fighting (any aggroed enemy), once
  if(idle||!G.char||!G.p||HINT.seen.slow||SETTINGS.hints===false)return;if(!G.enemies.some(e=>!e.dead&&e.aggro)){HINT.slowT=0;HINT.slowF=0;return;}
  HINT.slowT+=dt;HINT.slowF++;if(HINT.slowT<HINT_SLOW_S)return;const fps=HINT.slowF/HINT.slowT;HINT.slowT=0;HINT.slowF=0;
  if(fps<(SETTINGS.fpsCap===30?20:HINT_SLOW_FPS))hint('slow', /* at a 30 cap, only well below it */'Running slow?',"Settings › Performance lets you lower Sharpness, Particles, Lighting, Glows or the frame rate, each on its own (or tap Battery saver).");}
const HINT_SLOW_FPS=40,HINT_SLOW_S=10;
// the hints themselves (called from the systems they explain)
const AIL_HINT={burn:['🔥 Burning','Fire damage over time for a few seconds. Fire resistance makes it rarer and shorter.'],
  chill:['❄️ Chilled','Cold slows you down for a moment. Cold resistance makes it rarer and shorter.'],
  frozen:['🧊 Frozen','A big cold hit froze you for a moment; then it can\'t happen again for 3 seconds. Cold resistance shortens it.'],
  shock:['⚡ Shocked','You take 15% more damage for a few seconds. Lightning resistance makes it rarer and shorter.'],
  poison:['☠️ Poisoned','Poison stacks: each hit adds damage over time. Poison resistance makes it rarer and shorter.']};
function hintAil(kind){const h=AIL_HINT[kind];if(h)hint('ail_'+kind,h[0],h[1]);}
function hintMod(i){const c=G.char;if(c.skills[i]===MOD_UNLOCK[0]){G.modDot=true;hint('mod','Skill modifier unlocked',`Open ✨ and pick one under ${skName(c.cls,i)}. You can swap it any time, for free.`);}}
function hintPath(){const c=G.char;if(c&&c.lvl>=SUB_LVL&&!c.sub&&hasPaths(c))hint('path','Choose your path','Open ✨ › Path. Each class has two; the choice is for good.');}
// v1.0.134: the Ranger's (ranger.js, skills.js tryCast)
function hintRanger(k){const H={wolf:['Your wolf','It follows you and bites the nearest enemy. It can die: call it again to heal it or bring it back. It comes with you to new areas.'],
  trap:['Traps','A trap arms in half a second and springs when an enemy steps close. Lay them where monsters will walk.'],
  focus:['Out of Focus','Focus refills by itself and with every arrow that hits. Arrow Shot costs none: keep shooting to fill it.']}[k];if(H)hint('rg_'+k,H[0],H[1]);}
function hintElite(){hint('elite','Elite pack','Elites carry affixes: their name says what they do. A marked circle on the ground is a strike about to land: dodge out.');}
function hintItem(it){if(it&&(it.affs||[]).some(a=>a.k==='igniteCh'||a.k==='shockCh'||a.k==='poisonCh'))hint('ailstat','Status effect stat','"+% chance to Ignite / Shock / Poison" adds that effect to every hit. Each skill on ✨ shows what its own hits leave.');}
