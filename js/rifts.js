// Ember Rifts (v1.0.108): an endless, timed challenge from the Map Device's Rift tab, open once Hell is beaten.
// Rift L is a map run (c.mapRun with rift: L; sigils.js) built from a random zone layout, packed with monsters, power
// like depth riftPD(L), no boss at the start. Kills fill the Rift bar (riftW: elites and champions count more); a full
// bar calls the Rift Guardian (a map zone boss with more Life) next to you. Kill it with time left: the next level opens
// (2 with over half the time left, 3 with over two thirds). Time up: the Guardian still comes, but no level opens.
// Dying puts you back at the entrance and costs RIFT_DEATH seconds (no lives). The clock runs in town too.
// Each hero keeps c.rift = {top: highest level you may open, best: highest cleared in time, bt: {level: best seconds}, runs}.
// Rewards (v1.0.109): normal monsters and elites drop half the items (RIFT_DROP); the Guardian drops more the higher
// the level (riftReward), and the first clear in time of every 5th level gives a unique or set item (c.rift.ms: the last one paid).
// Hooks (marked "rifts.js" there): sigils.js (mapPD, regMapZone, mapComplete, the Rift tab), zones.js (no boss placed,
// zoneHud), game.js (killEnemy, update), ui.js (respawnHero, the Rift bar).
// v1.0.110 balance: the bar is the same size in every layout (RIFT_NEED, less only in a sparse one), Rift 1 is like
// late Hell (power depth 63) and each level adds 3, and the Guardian has 20% more Life than a map boss.
const RIFT_TIME=240,RIFT_DEATH=15,RIFT_NEED=180,RIFT_FILL=0.75,RIFT_GUARD_HP=1.2,RIFT_DROP=0.5,RIFT_MS=5;
const riftDropMul=()=>inRift()?RIFT_DROP:1;
const riftPD=L=>60+3*L;
const riftOf=c=>c.rift&&typeof c.rift==='object'?c.rift:(c.rift={top:1,best:0,bt:{},runs:0,ms:0});
function fixRift(c){const R=riftOf(c);R.top=Math.max(1,R.top|0);R.best=Math.max(0,R.best|0);R.runs=R.runs|0;if(typeof R.ms!=='number')R.ms=Math.floor(R.best/RIFT_MS)*RIFT_MS;if(!R.bt||typeof R.bt!=='object')R.bt={};
  const r=c.mapRun;if(r&&r.rift){r.t=Math.max(0,+r.t||0);r.prog=+r.prog||0;r.need=Math.max(1,+r.need||1);r.unit=Math.max(1,+r.unit||1);}return R;}
const inRift=()=>typeof inMap==='function'&&inMap()&&!!G.char.mapRun.rift;
const riftRun=()=>{const r=G.char&&G.char.mapRun;return r&&r.rift?r:null;};
const clockTxt=t=>{t=Math.max(0,Math.ceil(t));return `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;};
// How much a kill fills the bar: its Life in normal grunts of this Rift (r.unit), so an elite counts about 2.4, a
// champion about 5 and a brute more than a skeleton; the same bar takes the same work in every layout.
const riftW=e=>{const r=riftRun();if(e.zb||e.type==='boss'||!r)return 0;return Math.max(0.3,Math.min(10,(e.maxHp||0)/(r.unit||1)));};
function openRift(L){const c=G.char;if(!mapsOpen(c)||c.mapRun&&c.mapRun.lives>0&&!c.mapRun.done)return false;const R=riftOf(c);L=L|0;if(L<1||L>R.top)return false;
  c.mapRun={sig:{id:++ITEM_ID,tier:Math.min(15,Math.ceil(L/2)),rarity:0,mods:[]},rift:L,src:mapSource(),boss:pick(Object.keys(ZBOSS)),su:shuffle(Object.keys(SUPERU).slice()).slice(0,2),
    lives:1,done:false,town:G.inTown?G.depth:c.depth<=25?c.depth:25,t:RIFT_TIME,prog:0,need:1,unit:1,guard:false,late:false};
  regMapZone(c.mapRun);if(c.zst)delete c.zst.map;closeMapDevice();startZone('map','fresh');c.mapRun.unit=makeEnemy('grunt',0,0,G.depth,false,0,null).maxHp;
  if(typeof hint==='function')hint('rift','Ember Rift','Kill monsters to fill the orange bar before the clock runs out, then slay the Rift Guardian. Elites and champions fill more. Dying costs 15 seconds; fast clears skip levels.'); // hints.js
  const r=c.mapRun;r.need=Math.max(20,Math.min(RIFT_NEED,Math.round(G.enemies.reduce((a,e)=>a+riftW(e),0)*RIFT_FILL)));R.runs++;saveChar();playSfx('portal');
  toast(`🔥 Ember Rift ${L}`,`Fill the bar in ${clockTxt(RIFT_TIME)} to call the Rift Guardian`);return true;}
// A kill in the Rift fills the bar; full: the Guardian comes.
function riftKill(e){const r=riftRun();if(!r||!inRift()||r.guard||r.done)return;r.prog+=riftW(e);if(r.prog>=r.need)riftGuardian();}
function riftGuardian(){const r=riftRun(),p=G.p;if(!r||r.guard||!p)return;r.guard=true;let x=p.x,y=p.y;
  for(let k=0;k<16;k++){const a=k/16*TAU,d=170-k*4,qx=p.x+Math.cos(a)*d,qy=p.y+Math.sin(a)*d;if(!blockedAt(qx,qy,30)){x=qx;y=qy;break;}}
  const b=makeZoneBoss(r.boss,x,y,G.depth);b.hp=b.maxHp=b.maxHp*RIFT_GUARD_HP;b.name='Rift Guardian '+b.name.split(',')[0];b.aggro=true;
  G.enemies.push(b);G.zboss=b;G.shake=Math.max(G.shake,10);burst(x,y,40,'#ff7a2a',220);playSfx('phase');
  toast('The Rift Guardian','Slay it'+(r.late?' (time is up: no new level)':` · ${clockTxt(r.t)} left`));}
// Every frame (game.js update), in town too.
function riftTick(dt){const r=riftRun();if(!r||r.done)return;
  if(!r.late){r.t-=dt;if(r.t<=0){r.t=0;r.late=true;toast("Time's up",'Kill the Guardian to close the Rift; no new level this time');}}
  if(r.late&&!r.guard&&inRift())riftGuardian();}
function riftDeath(){const r=riftRun();if(!r||r.done||r.late)return;r.t=Math.max(0,r.t-RIFT_DEATH);toast(`−${RIFT_DEATH} seconds`,`${clockTxt(r.t)} left in the Rift`);}
// The Guardian falls (sigils.js mapComplete): the result.
function riftDone(e){const c=G.char,r=c.mapRun,R=riftOf(c);if(r.done)return;r.done=true;if(G.portal&&e&&!blockedAt(e.x,e.y,20)){G.portal.x=e.x;G.portal.y=e.y;G.portal.active=true;} // the way home opens where it fell
  const L=r.rift,used=Math.round(RIFT_TIME-r.t);
  if(r.late)toast(`Rift ${L}: too late`,'The Guardian falls, but no new level opens. Take the portal home');
  else{const gain=1+(r.t>RIFT_TIME/2?1:0)+(r.t>RIFT_TIME*2/3?1:0);R.top=Math.max(R.top,L+gain);R.best=Math.max(R.best,L);if(!(R.bt[L]<=used))R.bt[L]=used;
    const u=riftReward(e,L,false);toast(`Rift ${L} cleared in ${clockTxt(used)}`,`Rift ${L+gain} is open${gain>1?` (+${gain} levels)`:''}${u?` · milestone: ${u>1?u+' unique or set items':'a unique or set item'}`:''} · take the portal home`);playSfx('unique');}
  if(r.late)riftReward(e,L,true);saveChar();}
// The Guardian's loot on top of a map boss's: in time, 1 rare + 1 more per 4 levels (some better), crafting orbs and
// gold that grow with the level, and a unique for each new 5th level; too late, one rare and a little gold.
function riftReward(e,L,late){const c=G.char,R=riftOf(c),d=PD(),at=(k=50)=>[e.x+rand(-k,k),e.y+rand(-k,k)];
  if(late){dropItem(...at(),rollDrop(c,d+2,2,2,{act:5}));dropGold(...at(20),d*15);return 0;}
  const n=1+Math.floor(L/4);for(let i=0;i<n;i++)dropItem(...at(),rollDrop(c,d+2,3,i===0?2:Math.random()<Math.min(0.5,0.1+L*0.01)?2:1,{act:5}));
  for(let i=0,m=1+Math.floor(L/8);i<m;i++)dropCurrency(e,'boss');dropGold(...at(20),Math.round(d*40*(1+L/10)));
  let u=0;while(R.ms+RIFT_MS<=L){R.ms+=RIFT_MS;u++;dropItem(...at(),rollDrop(c,d+2,3,3,{act:5,top:true}));}
  return u;}
// HUD line (zones.js zoneHud).
function riftHud(){const r=riftRun();return `🔥 Rift ${r.rift} · Lv ${areaLvl(PD())} · ${r.done?'Closed: take the portal home':r.guard?'Slay the Guardian':'Fill the bar'} · ⏱ ${clockTxt(r.t)}${r.late&&!r.done?' (time up)':''}`;}
// ---------- the Rift tab on the Map Device (sigils.js) ----------
let riftPick=0;
function riftHtml(c){const R=riftOf(c);if(!riftPick||riftPick>R.top)riftPick=R.top;const L=riftPick,bt=R.bt[L];
  return `<div class="pinfo"><b style="color:#ff9a4a">🔥 Ember Rifts</b> <span class="fdim">best: ${R.best?'Rift '+R.best+(R.bt[R.best]!=null?' in '+clockTxt(R.bt[R.best]):''):'none yet'} · ${R.runs} runs</span>
    <div class="row" style="align-items:center;margin-top:6px"><div class="btn sm${L<=1?' dis':''}" id="riftDown">−</div><b style="min-width:84px;text-align:center">Rift ${L}</b><div class="btn sm${L>=R.top?' dis':''}" id="riftUp">+</div>
    <div class="btn sm${L>=R.top?' dis':''}" id="riftTop">Highest (${R.top})</div></div>
    <div class="fdim">Power like depth ${riftPD(L)} · area level ${areaLvl(riftPD(L))}${bt!=null?` · your best here: ${clockTxt(bt)}`:''}</div>
    <div class="fdim">Kill monsters to fill the bar in ${clockTxt(RIFT_TIME)} (tougher ones fill more), then slay the Rift Guardian. Fast clears skip levels. Dying costs ${RIFT_DEATH} seconds.</div>
    <div class="row"><div class="btn" id="riftGo">🔥 Open Rift ${L}</div></div></div>`;}
function riftBind(c){const R=riftOf(c),set=v=>{riftPick=Math.max(1,Math.min(R.top,v));renderMapDevice();};
  if($('riftDown'))$('riftDown').onclick=()=>set(riftPick-1);if($('riftUp'))$('riftUp').onclick=()=>set(riftPick+1);if($('riftTop'))$('riftTop').onclick=()=>set(R.top);
  if($('riftGo'))$('riftGo').onclick=()=>{if(!openRift(riftPick))toast("Can't open it",'Finish or abandon your open map first');};}
// ---------- 📖 Book › Rifts (sockets.js renderBook): every hero's best ----------
function riftBoard(){return SAVES.filter(c=>c&&c.rift&&(c.rift.runs||c.rift.best)).map(c=>({c,R:riftOf(c)})).sort((a,b)=>b.R.best-a.R.best||(a.R.bt[a.R.best]??1e9)-(b.R.bt[b.R.best]??1e9));}
function renderRiftBook(){const B=riftBoard();
  $('bookSub').textContent=`Ember Rifts open after Hell (Map Device › 🔥 Rift). Your heroes, best first: the highest Rift cleared in time and how fast. Every ${RIFT_MS}th level cleared for the first time gives a unique or set item.`;
  $('bookList').innerHTML=B.length?B.map(({c,R},i)=>`<div class="slot"><div class="ic" style="color:#ff9a4a">${i===0?'🏆':'🔥'}<small>${R.best||'–'}</small></div><div class="info"><b>${esc(c.name)}</b> <span class="fdim">Lv ${lvlLabel(c)} ${esc(titleOf(c))}</span>
    <div>${R.best?`Best: Rift ${R.best}${R.bt[R.best]!=null?' in '+clockTxt(R.bt[R.best]):''}`:'No Rift cleared in time yet'} <span class="fdim">· can open up to ${R.top} · ${R.runs} runs</span></div></div></div>`).join(''):'<div class="fdim">No hero has run a Rift yet.</div>';}
