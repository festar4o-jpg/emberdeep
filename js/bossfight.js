'use strict';
// Boss fights, PoE2 style: mechanics, not just life.
//   Phases      at 70% and 35% life. Crossing a threshold: life is held there (overflow is lost), the boss is immune
//               for TRANS_T while it transitions (roar, shockwave, banner, sound), then the next phase's mechanic starts.
//               No phase can be skipped.
//   Big attacks long red/orange telegraphs with a warning horn; they hit for about half your life but can be dodged;
//               afterwards the boss is EXPOSED for PUNISH_T and takes +50% damage.
//   Stagger     hits fill a bar (heavy hits more); when full the boss is STAGGERED (stunned) for STAG_T and takes +35%;
//               each stagger makes the bar 30% longer; it drains when you stop hitting.
//   Damage cap  a boss loses at most DPS_CAP of its life per second (x1.5 while exposed/staggered; a small reserve
//               lets a burst land) and at most HIT_CAP in one hit: great gear speeds a fight up but can't skip it.
//   Enrage      below ENRAGE_AT in the last phase: faster attacks and movement.
//   Shields     some phases raise a shield held up by adds (tethered to the boss); kill them to break it.
//   Arenas      some phases shrink the arena: outside the ring you burn.
//   Matchups    each boss takes more or less damage from each class (BOSSES[k].vs), so each class has bosses it
//               finds easier and harder; the entrance banner says which.
// Also here: area levels and the level/gear difference rule (diminishing returns when far overleveled/overgeared).
const PHASE_AT=[0.7,0.35],TRANS_T=2.2,PUNISH_T=2.5,STAG_T=3,HIT_CAP=0.05,DPS_CAP=0.03,ENRAGE_AT=0.15,BOSS_HP_K=2.6;
const ROMAN_PH=['I','II','III'];
function bossInit(e){e.phase=0;e.stagger=0;e.staggerMax=100;e.staggers=0;e.punishes=0;e.homeX=e.x;e.homeY=e.y;e.maxHp*=BOSS_HP_K;e.hp=e.maxHp;}
// ---------- area level and the level / gear difference ----------
// Area level: twice the depth in the story (Act 1 = 2..10, Act 5 = 42..50), then +1 per endless depth.
const areaLvl=d=>{d=d??G.depth;return d<=25?d*2:50+(d-25);};
// Your damage against monsters: -5% per level beyond 3 over the area (down to 50%), and -12% per gear tier above the
// act's tier beyond half a tier (down to 60%), averaged over your tiered gear.
let OM_T=-1,OM_V=1;
function overMul(){if(OM_T===G.time)return OM_V;OM_T=G.time;const c=G.char;if(!c||G.inTown)return OM_V=1;
  const diff=c.lvl-areaLvl();let m=diff>3?Math.max(0.5,1-0.05*(diff-3)):1;
  const ts=EQ_SLOTS.map(s=>c.equip[s]).filter(it=>it&&it.tier);
  if(ts.length){const over=ts.reduce((a,it)=>a+it.tier,0)/ts.length-dropAct(G.depth);if(over>0.5)m*=Math.max(0.6,1-0.12*(over-0.5));}
  return OM_V=m;}
// Monsters hit harder when you are underleveled for the area: +5% per level beyond 2 under (up to double).
const underMul=()=>{const c=G.char;if(!c||G.inTown)return 1;return Math.min(2,1+0.05*Math.max(0,areaLvl()-c.lvl-2));};
// ---------- damage into a monster (hitEnemy) ----------
function dmgTo(e,d,crit,opts){d*=overMul();if(e.type!=='boss')return Math.max(1,Math.round(d));
  const V=(BOSSES[e.kind]||BOSSES[0]).vs,cm=V&&G.char&&V[G.char.cls];if(cm)d*=cm[0]; /* class matchup: each boss favours one class */
  const open=e.punishT>0||e.staggerT>0;if(e.punishT>0)d*=1.5;if(e.staggerT>0)d*=1.35;
  d=Math.min(d,e.maxHp*HIT_CAP,e.budget??e.maxHp*DPS_CAP*1.5);e.budget=(e.budget??e.maxHp*DPS_CAP*1.5)-d;
  if(!(e.staggerT>0)&&!(e.transT>0)&&!(e.shieldT>0)){e.stagger+=(opts&&opts.dot?0:4)+90*d/e.maxHp*(crit||(opts&&opts.kb>=95)?1.6:1);if(e.stagger>=e.staggerMax)staggerBoss(e);}
  return Math.max(1,Math.round(d));}
// After any loss of life (hits, bleeding, burning): hold a boss at its phase threshold and start the transition.
function bossGate(e){if(e.type!=='boss'||e.dead)return;
  if(e.transT>0||e.shieldT>0){if(e.hpLock!=null&&e.hp<e.hpLock)e.hp=e.hpLock;return;}
  const th=PHASE_AT[e.phase];if(th!=null&&e.hp<e.maxHp*th){e.hp=e.maxHp*th;bossTransition(e);}}
function bossTransition(e){e.phase++;e.transT=TRANS_T;e.hpLock=e.hp;e.busy=0;e.wind=0;e.tele=null;e.act=null;e.dash=0;e.punishT=0;e.staggerT=0;e.stun=0;e.stagger=0;
  const col=ACTS[e.kind||0].col,p=G.p;G.shake=Math.max(G.shake,14);G.hitStop=0.1;playSfx('phase');
  G.fx.push({type:'ring',x:e.x,y:e.y,r0:e.r,r1:240,t:0,max:0.7,col});G.fx.push({type:'ring',x:e.x,y:e.y,r0:e.r,r1:150,t:0,max:0.45,col:'#ffffff'});
  const d=Math.hypot(p.x-e.x,p.y-e.y);if(d<170&&d>0){const k=(170-d)*0.8;moveEnt(p,(p.x-e.x)/d*k,(p.y-e.y)/d*k);}
  G.phaseBanner={text:`Phase ${ROMAN_PH[e.phase]}`,sub:((BOSSES[e.kind]||BOSSES[0]).phases[e.phase-1]||{}).name||'',t:G.time,col};}
function staggerBoss(e){e.staggerT=STAG_T;e.stun=Math.max(e.stun||0,STAG_T);e.stagger=0;e.staggerMax*=1.3;e.staggers++;e.busy=0;e.wind=0;e.act=null;e.tele=null;e.dash=0;
  G.shake=Math.max(G.shake,8);G.hitStop=Math.max(G.hitStop||0,0.08);playSfx('stagger');floatText(e.x,e.y-e.r*1.6,'STAGGERED','#ffd54a',true);
  G.fx.push({type:'ring',x:e.x,y:e.y,r0:e.r,r1:e.r*2.6,t:0,max:0.35,col:'#ffd54a'});}
// A big attack: warning horn, the boss rears back for `wind` seconds (cast() draws the telegraphs and schedules the
// hit), then it is exposed for PUNISH_T.
function bigAttack(e,wind,cast,act,hitAt){playSfx('warn');e.wind=wind;e.act=act||(()=>{});const h=hitAt??wind+0.25;e.busy=h+PUNISH_T+0.1;cast();
  bossLater(e,h,()=>{if(e.transT>0)return;e.punishT=PUNISH_T;e.punishes++;floatText(e.x,e.y-e.r*1.6,'EXPOSED','#ffe08a',false);});}
// Adds that hold up a shield on the boss until they are all dead (tethered to it on screen).
function shieldAdds(e,type,n,name,hpK){e.shieldBy=true;e.shieldT=9999;e.hpLock=e.hp;
  for(let i=0;i<n;i++){let x=e.x,y=e.y;for(let k=0;k<30;k++){const a=i/n*TAU+rand(-0.5,0.5),r=rand(110,190)*(1-k/40),cx=e.x+Math.cos(a)*r,cy=e.y+Math.sin(a)*r;if(!blockedAt(cx,cy,22)){x=cx;y=cy;break;}} /* open floor near the boss, never inside a wall */
    const m=makeEnemy(type,x,y,G.depth,true,e.pack,null);m.name=name;m.hp=m.maxHp=m.maxHp*(hpK||1.6);m.aggro=true;m.shieldOf=e;m.spawnT=0.5;G.enemies.push(m);burst(x,y,16,ACTS[e.kind||0].col,160);}
  toast(e.name+' is shielded',`Kill the ${name}s to break it`);}
// Runs every frame for a boss before its AI. Returns true while it can't act (transition).
function bossFrame(e,dt){const B=BOSSES[e.kind]||BOSSES[0];
  if(e.punishT>0)e.punishT-=dt;if(e.staggerT>0)e.staggerT-=dt;
  {const k=e.punishT>0||e.staggerT>0?1.5:1;e.budget=Math.min(e.maxHp*DPS_CAP*1.5*k,(e.budget??e.maxHp*DPS_CAP*1.5)+e.maxHp*DPS_CAP*k*dt);} /* the damage-per-second allowance refills */
  if(e.stagger>0&&G.time-(e.lastHit||-9)>2)e.stagger=Math.max(0,e.stagger-12*dt);
  if(e.transT>0){e.transT-=dt;if(e.hp<e.hpLock)e.hp=e.hpLock;if(Math.random()<dt*14)burst(e.x+rand(-e.r,e.r),e.y+rand(-e.r,e.r),2,ACTS[e.kind||0].col,120);
    if(e.transT<=0){e.hpLock=null;const P=B.phases[e.phase-1];if(P&&P.enter)P.enter(e);}return true;}
  if(e.shieldBy){if(G.enemies.some(o=>!o.dead&&o.shieldOf===e))e.shieldT=9999;else{e.shieldBy=false;e.shieldT=0;e.hpLock=null;G.shake=Math.max(G.shake,10);playSfx('stagger');
    G.fx.push({type:'ring',x:e.x,y:e.y,r0:e.r,r1:e.r*3,t:0,max:0.4,col:'#bcd0ff'});toast('Shield broken!',e.name+' is vulnerable');e.punishT=PUNISH_T;e.punishes++;}}
  if(!e.enraged&&e.phase>=2&&e.hp<e.maxHp*ENRAGE_AT){e.enraged=true;e.spd*=1.25;toast(`${e.name} is enraged!`,(B.enrage||'').replace(/!$/,''));G.shake=Math.max(G.shake,10);}
  if(e.arena){const A=e.arena,p=G.p;A.r=Math.max(A.min,A.r-A.rate*dt);if(!p.dead&&Math.hypot(p.x-A.x,p.y-A.y)>A.r){A.tick=(A.tick||0)-dt;if(A.tick<=0){A.tick=0.5;dmgPlayer(e.dmg*0.35,e);}}}
  const P=B.phases[e.phase-1];if(P&&P.tick)P.tick(e,dt);
  return false;}
// ---------- drawing ----------
// On the boss: tethers to shield adds, the shield, EXPOSED / STAGGERED / enraged looks, the transition aura.
function drawBossState(e){const t=G.time;
  if(e.shieldBy){ctx.strokeStyle='rgba(170,200,255,.5)';ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.lineDashOffset=-t*30;for(const o of G.enemies)if(!o.dead&&o.shieldOf===e){ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(o.x,o.y);ctx.stroke();}ctx.setLineDash([]);
    ctx.fillStyle='rgba(150,180,255,.16)';ctx.strokeStyle=`rgba(190,215,255,${0.6+0.2*Math.sin(t*6)})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y,e.r*BOSS_SCALE+12,0,TAU);ctx.fill();ctx.stroke();}
  if(e.transT>0){ctx.globalCompositeOperation='lighter';const R=e.r*BOSS_SCALE*(1.4+0.3*Math.sin(t*12));ctx.globalAlpha=0.5;ctx.drawImage(falloff(rgbOf(ACTS[e.kind||0].col)),e.x-R,e.y-R,R*2,R*2);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';}
  if(e.punishT>0){const a=0.55+0.35*Math.sin(t*10);ctx.strokeStyle=`rgba(255,220,120,${a})`;ctx.lineWidth=2.5;ctx.setLineDash([4,6]);ctx.beginPath();ctx.arc(e.x,e.y,e.r*BOSS_SCALE+8,0,TAU);ctx.stroke();ctx.setLineDash([]);
    ctx.font='bold 11px Georgia';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#000';ctx.strokeText('EXPOSED',e.x,e.y-e.r*BOSS_SCALE-26);ctx.fillStyle='#ffe08a';ctx.fillText('EXPOSED',e.x,e.y-e.r*BOSS_SCALE-26);}
  if(e.staggerT>0){ctx.fillStyle='#ffd54a';ctx.font='14px sans-serif';ctx.textAlign='center';for(let k=0;k<4;k++){const a=t*5+k*TAU/4;ctx.fillText('✦',e.x+Math.cos(a)*e.r*1.2,e.y-e.r*1.3+Math.sin(a)*8);}}
  if(e.enraged){ctx.globalCompositeOperation='lighter';const R=e.r*BOSS_SCALE*1.5;ctx.globalAlpha=0.35+0.15*Math.sin(t*8);ctx.drawImage(falloff('255,40,20'),e.x-R,e.y-R,R*2,R*2);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';}}
// A shrinking arena: everything outside the ring smoulders red-brown, the edge burns.
function drawArena(){const b=G.enemies.find(e=>e.type==='boss'&&!e.dead&&e.arena);if(!b)return;const A=b.arena,fire=b.kind===4;
  ctx.save();ctx.beginPath();ctx.rect(G.cam.x-CW/Z,G.cam.y-CH/Z,CW*2/Z,CH*2/Z);ctx.arc(A.x,A.y,A.r,0,TAU,true);ctx.fillStyle=fire?'rgba(140,30,6,.32)':'rgba(120,90,50,.34)';ctx.fill('evenodd');
  ctx.globalCompositeOperation='lighter';ctx.strokeStyle=fire?'rgba(255,110,30,.8)':'rgba(230,180,110,.7)';ctx.lineWidth=6;ctx.setLineDash([14,8]);ctx.lineDashOffset=G.time*40;ctx.beginPath();ctx.arc(A.x,A.y,A.r,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.restore();}
// Cinder King's Cataclysm: the whole arena is marked except one safe wedge.
function drawCata(f,t){const R=900,pulse=0.75+0.25*Math.sin(G.time*14);ctx.save();ctx.beginPath();ctx.arc(f.x,f.y,R,0,TAU);ctx.moveTo(f.x,f.y);ctx.arc(f.x,f.y,R,f.a+f.half,f.a-f.half,true);ctx.closePath();
  ctx.fillStyle=`rgba(150,25,5,${0.16+0.18*t})`;ctx.fill('evenodd');ctx.strokeStyle=`rgba(120,255,160,${0.8*pulse})`;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.lineTo(f.x+Math.cos(f.a-f.half)*R,f.y+Math.sin(f.a-f.half)*R);
  ctx.moveTo(f.x,f.y);ctx.lineTo(f.x+Math.cos(f.a+f.half)*R,f.y+Math.sin(f.a+f.half)*R);ctx.stroke();ctx.restore();}
// "Phase II" banner across the screen (screen space).
function drawPhaseBanner(){const B=G.phaseBanner;if(!B)return;const u=(G.time-B.t)/2.2;if(u>1||u<0){if(u>1)G.phaseBanner=null;return;}const a=u<0.15?u/0.15:u>0.7?(1-u)/0.3:1,y=CH*0.32;
  ctx.globalAlpha=a;ctx.textAlign='center';ctx.font=`bold ${Math.round(24*Math.min(1.3,Z))}px Georgia`;ctx.lineWidth=4;ctx.strokeStyle='#000';ctx.strokeText(B.text,CW/2,y);ctx.fillStyle='#d8c8a8';ctx.fillText(B.text,CW/2,y);
  ctx.font=`italic ${Math.round(13*Math.min(1.3,Z))}px Georgia`;ctx.strokeText(B.sub,CW/2,y+20);ctx.fillStyle=B.col;ctx.fillText(B.sub,CW/2,y+20);ctx.globalAlpha=1;}
