'use strict';
// Ailments on enemies: what elemental hits leave behind.
//   Ignite (fire)   burning: 25% of the hit per second for 3s (the stronger fire wins; also the Ignite power, uniques.js)
//   Shock (light)   +10% damage taken per stack, up to 3 stacks, 4s (a new shock renews it)
//   Chill (cold)    slowed (30%, Cold Snap 50%) for 2s; every cold hit adds a stack, 4 stacks freeze for 1s (bosses 0.35s)
//   Poison (any)    20% of the hit per second for 3s, every hit its own stack (no limit but AIL_POISON_MAX for speed)
//   Bleed (phys)    from weapons and Cleave powers (game.js hitEnemy), unchanged
// A skill's element (SKILL_ELEM) gives its own chance; item stats igniteCh / shockCh / poisonCh add to any hit.
// Ailments come from direct hits only: not from damage over time, burning ground or splash.
const SKILL_ELEM={warden:['phys','phys','phys','phys','phys'],arcanist:['arcane','fire','cold','light','fire']};
const AIL_BASE={fire:20,light:35}; // a skill's own chance to Ignite / Shock (Meteor: AIL_METEOR)
const AIL_METEOR=50,IGNITE_DPS=0.25,IGNITE_DUR=3,SHOCK_PER=0.1,SHOCK_MAX=3,SHOCK_DUR=4,CHILL_DUR=2,CHILL_SLOW=0.3,CHILL_FREEZE=4,
  POISON_DPS=0.2,POISON_DUR=3,AIL_POISON_MAX=30;
const AIL_COL={bleed:'#e04040',burn:'#ff8a2a',poison:'#8ae05a',chill:'#bfe8ff',shock:'#ffe24a'};
// The element line on the skill screen (renderSkills): what a skill's hits can leave, from the same numbers as above.
function skillElemText(cls,i){const el=SKILL_ELEM[cls][i];if(cls==='arcanist'&&i===4&&hasMod('comet'))return `Cold: chills, ${freezeAt()} cold hits freeze`;
  if(el==='fire')return `Fire: ${cls==='arcanist'&&i===4?AIL_METEOR:i===1&&hasMod('ignite')?100:AIL_BASE.fire}% chance to Ignite`;
  if(el==='light')return `Lightning: ${i===3&&hasMod('static')?'always Shocks (2 stacks)':AIL_BASE.light+'% chance to Shock'}`;
  if(el==='cold')return i===2&&hasMod('coldsnap')?'Cold: chills (Cold Snap never freezes)':`Cold: chills, ${freezeAt()} cold hits freeze`;
  return '';}
// the element of the hit being dealt now (G.sk: the skill it comes from)
function hitElem(){const c=G.char;if(!c||G.sk==null)return null;if(c.cls==='arcanist'&&G.sk===4&&hasMod('comet'))return 'cold';return SKILL_ELEM[c.cls][G.sk]||null;}
// damage taken multiplier from Shock
function shockMul(e){return e.shockT>0?1+SHOCK_PER*(e.shockN||0):1;}
// called by hitEnemy after a hit lands (d: the damage dealt)
function applyAilments(e,d,opts){if(e.dead||opts.dot||opts.haz||opts.splashed)return;
  const s=G.stats,el=hitElem(),c=G.char,fb=c&&c.cls==='arcanist'&&G.sk===1;
  let ig=(el==='fire'?(c.cls==='arcanist'&&G.sk===4?AIL_METEOR:AIL_BASE.fire):0)+(s.igniteCh||0);if(fb&&hasMod('ignite'))ig=100;
  if(ig>0&&Math.random()*100<ig)igniteHit(e,d);
  const stat=c&&c.cls==='arcanist'&&G.sk===3&&hasMod('static'),sh=(el==='light'?AIL_BASE.light:0)+(s.shockCh||0);
  if(stat)shockHit(e,2);else if(sh>0&&Math.random()*100<sh)shockHit(e,1);
  if(el==='cold')chillHit(e,opts.chill?0.5:CHILL_SLOW,Math.max(CHILL_DUR,opts.chill||0),!!opts.chill); // Cold Snap (opts.chill): slows only, never builds a freeze
  if((s.poisonCh||0)>0&&Math.random()*100<s.poisonCh)poisonHit(e,d);}
function igniteHit(e,d){const dps=d*IGNITE_DPS*(1-(e.dr||0));e.burnDps=e.burnT>0?Math.max(e.burnDps,dps):dps;e.burnT=Math.max(e.burnT||0,IGNITE_DUR);}
function shockHit(e,n){const was=e.shockT>0;e.shockN=Math.min(shockMax(),(was?e.shockN||0:0)+n); /* subclasses.js: High Voltage */e.shockT=SHOCK_DUR;if(!was)floatText(e.x,e.y-e.r-16,'Shocked',AIL_COL.shock,false);}
function chillHit(e,amt,t,noFreeze){e.chillAmt=Math.max(e.chillT>0?e.chillAmt||0:0,amt);e.chillT=Math.max(e.chillT||0,t);if(noFreeze)return;e.chillN=(e.chillN||0)+1;
  if(e.chillN>=freezeAt()){ /* subclasses.js: Quick Freeze */e.chillN=0;e.frozen=Math.max(e.frozen,e.type==='boss'?0.35:1);floatText(e.x,e.y-e.r-16,'Frozen',AIL_COL.chill,false);}}
function poisonHit(e,d){if(!e.pois)e.pois=[];if(!e.pois.length)floatText(e.x,e.y-e.r-16,'Poisoned',AIL_COL.poison,false);
  e.pois.push({dps:d*POISON_DPS*poisonMul()*(1-(e.dr||0)),t:POISON_DUR}); /* subclasses.js: Venom Blood */if(e.pois.length>AIL_POISON_MAX)e.pois.shift();}
// per frame for each living enemy; true when the poison killed it
function ailTick(e,dt){
  if(e.shockT>0){e.shockT-=dt;if(e.shockT<=0)e.shockN=0;else if(Math.random()<dt*5)G.parts.push({x:e.x+rand(-e.r,e.r),y:e.y+rand(-e.r,e.r)*0.6,vx:rand(-40,40),vy:rand(-40,40),life:0.15,max:0.15,col:AIL_COL.shock,s:2});}
  if(e.chillT>0){e.chillT-=dt;if(e.chillT<=0){e.chillAmt=0;e.chillN=0;}else if(Math.random()<dt*6)G.parts.push({x:e.x+rand(-e.r,e.r),y:e.y+rand(-e.r,e.r)*0.5,vx:0,vy:-20,life:0.5,max:0.5,col:AIL_COL.chill,s:3});}
  if(e.pois&&e.pois.length){let dps=0;for(const q of e.pois){q.t-=dt;if(q.t>0)dps+=q.dps;}e.pois=e.pois.filter(q=>q.t>0);
    const b=dps*dt;e.hp-=b;bossGate(e);e.poisAcc=(e.poisAcc||0)+b;e.poisTick=(e.poisTick||0)-dt;
    if(Math.random()<dt*6)G.parts.push({x:e.x+rand(-e.r,e.r)*0.6,y:e.y-rand(0,e.r)*0.5,vx:0,vy:-25,life:0.5,max:0.5,col:AIL_COL.poison,s:3});
    if(e.poisTick<=0&&e.poisAcc>=1){e.poisTick=0.6;floatText(e.x+rand(-6,6),e.y-e.r-6,Math.round(e.poisAcc),AIL_COL.poison,false);e.poisAcc=0;}
    if(e.hp<=0)return true;}
  return false;}
// enemy movement multiplier from Chill
function chillMul(e){return e.chillT>0?1-(e.chillAmt||0):1;}
// small coloured dots over an enemy for each ailment on it (shock: one dot per stack)
function drawAilPips(e){const on=[];if(e.bleedT>0)on.push(AIL_COL.bleed);if(e.burnT>0)on.push(AIL_COL.burn);if(e.pois&&e.pois.length)on.push(AIL_COL.poison);
  if(e.chillT>0)on.push(AIL_COL.chill);if(e.shockT>0)for(let k=0;k<(e.shockN||1);k++)on.push(AIL_COL.shock);if(!on.length)return;
  const y=e.y-e.r-(e.type==='boss'?22:16),x0=e.x-(on.length-1)*3.5;
  for(let k=0;k<on.length;k++){ctx.fillStyle='#000c';ctx.beginPath();ctx.arc(x0+k*7,y,3.4,0,TAU);ctx.fill();ctx.fillStyle=on[k];ctx.beginPath();ctx.arc(x0+k*7,y,2.4,0,TAU);ctx.fill();}}

// ---------- ailments on the player ----------
// Elemental hits (dmgPlayer: the hit's element and how much of it is elemental) can leave:
//   Burning (fire)    15% of the hit per second for 3s (the stronger fire wins)
//   Chilled (cold)    slowed 30% for 2s (slowPlayer); a cold hit of 12%+ of your Life also Freezes you (up to 0.5s, then 3s immune)
//   Shocked (light)   you take 15% more damage for 3s
//   Poisoned (pois)   10% of the hit per second for 3s, each its own stack (up to 10)
// The matching resistance lowers both the chance (x (1 - res)) and the duration (75% res: half as long); negative
// resistance (Nightmare / Hell penalty) raises the chance. Potions don't cure them: they run out.
const PAIL_CH={fres:30,cres:50,lres:30,pres:40},PAIL_KIND={fres:'burn',cres:'chill',lres:'shock',pres:'poison'};
const PAIL_ICON={burn:'🔥',chill:'❄️',frozen:'🧊',shock:'⚡',poison:'☠️'};
const PFREEZE_HIT=0.12,PFREEZE_MAX=0.5,PFREEZE_IMM=3,PSHOCK_MUL=1.15,PPOISON_MAX=10;
function pAil(p){return p.ail||(p.ail={burnT:0,burnDps:0,shockT:0,pois:[],frozenT:0,freezeImm:0,acc:0,accT:0});}
function clearPlayerAils(p){p.ail=null;}
// damage taken multiplier while Shocked
function playerShockMul(){const p=G.p;return p&&p.ail&&p.ail.shockT>0?PSHOCK_MUL:1;}
function playerFrozen(){const p=G.p;return !!(p&&p.ail&&p.ail.frozenT>0);}
// after an elemental hit of d damage landed (E: resistance key, sh: elemental share 0..1)
function playerAilHit(E,sh,d){const p=G.p;if(p.dead||!PAIL_KIND[E]||!(d>0))return;const A=pAil(p),res=clamp(resOf(G.stats,E),-60,75),kind=PAIL_KIND[E];
  const dur=1-Math.max(0,res)/150,ch=PAIL_CH[E]*Math.min(1,sh)*(1-res/100);
  if(kind==='chill'&&d>=G.stats.life*PFREEZE_HIT&&A.freezeImm<=0){A.frozenT=Math.max(0.1,PFREEZE_MAX*(1-Math.max(0,res)/100));A.freezeImm=A.frozenT+PFREEZE_IMM;
    floatText(p.x,p.y-p.r-30,'Frozen!',AIL_COL.chill,true);buzz('heavy');}
  if(Math.random()*100>=ch)return;
  if(kind==='burn'){const dps=d*0.15;A.burnDps=A.burnT>0?Math.max(A.burnDps,dps):dps;A.burnT=Math.max(A.burnT,3*dur);}
  else if(kind==='chill')slowPlayer(0.3,2*dur);
  else if(kind==='shock'){if(!(A.shockT>0))floatText(p.x,p.y-p.r-30,'Shocked',AIL_COL.shock,false);A.shockT=Math.max(A.shockT,3*dur);}
  else{if(!A.pois.length)floatText(p.x,p.y-p.r-30,'Poisoned',AIL_COL.poison,false);A.pois.push({dps:d*0.1,t:3*dur});if(A.pois.length>PPOISON_MAX)A.pois.shift();}}
// per frame: damage over time and timers
function playerAilTick(p,dt){const A=p.ail;if(!A||p.dead)return;
  if(A.frozenT>0)A.frozenT-=dt;if(A.freezeImm>0)A.freezeImm-=dt;if(A.shockT>0)A.shockT-=dt;
  let dps=0;if(A.burnT>0){A.burnT-=dt;dps+=A.burnDps;if(Math.random()<dt*8)G.parts.push({x:p.x+rand(-p.r,p.r)*0.6,y:p.y-rand(0,p.r),vx:rand(-10,10),vy:rand(-70,-30),life:0.45,max:0.45,col:AIL_COL.burn,s:3});}
  if(A.pois.length){for(const q of A.pois){q.t-=dt;if(q.t>0)dps+=q.dps;}A.pois=A.pois.filter(q=>q.t>0);if(Math.random()<dt*6)G.parts.push({x:p.x+rand(-p.r,p.r)*0.6,y:p.y-rand(0,p.r)*0.5,vx:0,vy:-25,life:0.5,max:0.5,col:AIL_COL.poison,s:3});}
  if(A.shockT>0&&Math.random()<dt*5)G.parts.push({x:p.x+rand(-p.r,p.r),y:p.y+rand(-p.r,p.r)*0.6,vx:rand(-40,40),vy:rand(-40,40),life:0.15,max:0.15,col:AIL_COL.shock,s:2});
  if(dps>0){const b=dps*dt;p.hp-=b;A.acc+=b;A.accT-=dt;if(A.accT<=0&&A.acc>=1){A.accT=0.6;floatText(p.x+rand(-6,6),p.y-p.r-8,Math.round(A.acc),A.pois.length&&!(A.burnT>0)?AIL_COL.poison:AIL_COL.burn,false);A.acc=0;}checkDeath(p);}}
// the badges next to the life bar: icon + seconds left; only touches the page when something changed
let ailHudKey='';
function ailHudTick(){const p=G.p,el=typeof $==='function'?$('ailHud'):null;if(!el||!p)return;const A=p.ail,on=[];
  if(A&&A.frozenT>0)on.push(['frozen',A.frozenT]);if(A&&A.burnT>0)on.push(['burn',A.burnT]);if(p.slowT>0)on.push(['chill',p.slowT]);
  if(A&&A.shockT>0)on.push(['shock',A.shockT]);if(A&&A.pois.length)on.push(['poison',Math.max(...A.pois.map(q=>q.t)),A.pois.length]);
  const key=on.map(([k,t,n])=>k+Math.ceil(t)+(n||'')).join(',');if(key===ailHudKey)return;ailHudKey=key;
  el.innerHTML=on.map(([k,t,n])=>`<span class="ail ail-${k}">${PAIL_ICON[k]}<b>${Math.ceil(t)}</b>${n>1?`<i>×${n}</i>`:''}</span>`).join('');}
