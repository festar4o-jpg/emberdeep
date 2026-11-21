'use strict';
// Elite affixes, shrines, cursed chests and the treasure thief.
// ---------- elite affixes: a pack's elites share 1-3 of these; nastier ones unlock in later acts ----------
// act = first act (1-5) the affix can roll in; endless depths roll from all of them.
const AFFIXES={
  fast:{name:'Fast',col:'#ffe060',act:1},
  shielded:{name:'Shielded',col:'#9ab0ff',act:1},
  vampiric:{name:'Vampiric',col:'#e04060',act:1},
  explodes:{name:'Explodes on Death',col:'#ff6a3a',act:1},
  molten:{name:'Molten',col:'#ff9a2a',act:2},
  teleporter:{name:'Teleporter',col:'#c080ff',act:2},
  waller:{name:'Waller',col:'#c8a878',act:2},
  frozen:{name:'Frozen Pulse',col:'#bfe8ff',act:3},
  summoner:{name:'Summoner',col:'#b070ff',act:3},
  reflect:{name:'Reflects Damage',col:'#ff5ad0',act:4}
};
// Affix count [min,max] per act; endless depths always get 3.
const AFFIX_N=[[1,2],[1,2],[1,2],[2,3],[2,3]];
function rollAffixes(depth){const a=actIdx(depth)+1,end=depth>25,pool=Object.keys(AFFIXES).filter(k=>end||AFFIXES[k].act<=a);
  const [lo,hi]=end?[3,3]:AFFIX_N[a-1],n=randi(lo,hi),out=[];
  while(out.length<n&&pool.length)out.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  return out;}
const hasAff=(e,k)=>!!(e&&e.affs&&e.affs.includes(k));
// Affix strength step: 0 in act 1 … 4 in act 5, 5 in endless.
const affLv=()=>Math.min(5,actIdx(G.depth)+(G.depth>25?1:0));
// Cheapest non-summoner monster of the act: what Summoner elites call in.
function minionType(){return ACTS[actIdx(G.depth)].roster.map(r=>r[0]).filter(t=>t!=='summoner').sort((a,b)=>ETYPES[a].cost-ETYPES[b].cost)[0];}
// Telegraphed blast that does not depend on its caster staying alive.
function affStrike(x,y,r,delay,dmg,col,onHit){G.fx.push({type:'tele',x,y,r,t:0,max:delay,col});
  later(delay,()=>{const p=G.p;if(Math.hypot(p.x-x,p.y-y)<r+p.r*0.5&&dmgPlayer(dmg,null)&&onHit)onHit();G.fx.push({type:'ring',x,y,r0:r*0.3,r1:r,t:0,max:0.25,col});burst(x,y,14,col,180);});}
// Runs every frame for an aggroed, active elite with affixes (d = distance to the player).
function affixTick(e,d,dt){const L=affLv(),T=e.affT||(e.affT={});
  const ready=(k,cd)=>{T[k]=(T[k]??rand(1,cd))-dt;if(T[k]>0)return false;T[k]=cd*rand(0.85,1.15);return true;};
  for(const k of e.affs){
    if(k==='shielded'){if(!(e.shieldT>0)&&ready(k,7-L*0.4)){e.shieldT=1.8+L*0.25;G.fx.push({type:'ring',x:e.x,y:e.y,r0:e.r,r1:e.r+16,t:0,max:0.3,col:'#9ab0ff'});}}
    else if(k==='teleporter'){if(ready(k,6-L*0.5)){if(d>200||d<70){if(blinkNear(e))e.cd=Math.max(e.cd,0.5);}else T[k]=0.4;}}
    else if(k==='frozen'){if(d<420&&ready(k,5.5-L*0.4)){const p=G.p;affStrike(p.x+rand(-25,25),p.y+rand(-25,25),70+L*4,1.2,e.dmg*0.7,'#bfe8ff',()=>slowPlayer(0.3+L*0.05,1.5));}}
    else if(k==='summoner'){if(ready(k,9-L*0.6)){const t=minionType(),n=(t==='scarab'?3:2)+(L>=3?1:0);bossSummon(e,t,n,n+2);}}
    else if(k==='molten'){T.molten=(T.molten||0)-dt;if(T.molten<=0){T.molten=0.4;addEHaz(e.x,e.y,26,2.5+L*0.2,e.dmg*0.35,'fire');}}
    else if(k==='waller'){if(d<260&&ready(k,8-L*0.5))raiseWall(e,L);}
  }
}
// Reflects Damage: part of each hit comes back (capped per hit, sent at most 4 times a second).
function reflectHit(e,dealt){const L=affLv();e.reflAcc=(e.reflAcc||0)+Math.min(dealt*(0.08+0.02*L),e.dmg*0.6);
  if(G.time-(e.reflLast||-9)<0.25||e.reflAcc<1)return;e.reflLast=G.time;const v=e.reflAcc;e.reflAcc=0;burnPlayer(v,'#ff5ad0');
  G.fx.push({type:'ring',x:e.x,y:e.y,r0:e.r,r1:e.r+12,t:0,max:0.2,col:'#ff5ad0'});}
function affixDeath(e){if(hasAff(e,'explodes')){const L=affLv();affStrike(e.x,e.y,80+L*5,1,e.dmg*(1.1+0.1*L),'#ff6a3a');}}
// Waller: a short line of stone rises just behind the player (away from the elite), then crumbles.
function raiseWall(e,L){const p=G.p,a=Math.atan2(p.y-e.y,p.x-e.x),cx=p.x+Math.cos(a)*TILE*1.6,cy=p.y+Math.sin(a)*TILE*1.6,px=-Math.sin(a),py=Math.cos(a),n=5+(L>=3?2:0);
  const P=G.portal,pk=tileIdx(P.x,P.y),busy=[p,...G.enemies.filter(o=>!o.dead),...G.feats];let any=false;
  for(let s=0;s<n;s++){const o=(s-(n-1)/2)*TILE,i=Math.floor((cx+px*o)/TILE),j=Math.floor((cy+py*o)/TILE),k=j*MW+i;
    if(!inner(i,j)||G.grid[k]!==0||k===pk||G.walls.some(w=>w.k===k))continue;
    if(busy.some(b=>{const r=(b.r||20)+3,qx=clamp(b.x,i*TILE,(i+1)*TILE),qy=clamp(b.y,j*TILE,(j+1)*TILE);return Math.hypot(b.x-qx,b.y-qy)<r;}))continue;
    G.grid[k]=1;G.walls.push({k,i,j,t:4+L*0.3});burst((i+0.5)*TILE,(j+0.5)*TILE,6,'#c8a878',120);any=true;}
  if(any){G.flowTile=-1;G.shake=Math.max(G.shake,4);}}

// ---------- shrines: one touch, 30 s buff ----------
const SHRINES={
  dmg:{name:'Shrine of Fury',buff:'+40% Damage',col:'#ff5a3a',icon:'⚔',short:'Fury'},
  speed:{name:'Shrine of Haste',buff:'+30% Move & Attack Speed',col:'#ffe060',icon:'»',short:'Haste'},
  armor:{name:'Shrine of Stone',buff:'+60% Armor',col:'#9ab0ff',icon:'⛨',short:'Stone'},
  xp:{name:'Shrine of Wisdom',buff:'+50% Experience',col:'#7fe0a0',icon:'✦',short:'Wisdom'}
};
const SHRINE_T=30;
// Called at the end of calcStats: active shrine buffs.
function shrineStats(s){const b=G.p&&G.p.shr;if(!b)return;
  if(b.dmg>0)s.dmg+=40;if(b.speed>0){s.move+=30;s.aspd+=30;}if(b.armor>0)s.armor=s.armor*1.6+4*(G.depth||1);}
const shrineXp=v=>G.p&&G.p.shr&&G.p.shr.xp>0?v*1.5:v;
function shrineText(){const b=G.p&&G.p.shr;if(!b)return '';return Object.keys(SHRINES).filter(k=>b[k]>0).map(k=>`${SHRINES[k].icon} ${SHRINES[k].short} ${Math.ceil(b[k])}s`).join('  ');}

// ---------- level placement ----------
// Shrines (0-2), a cursed chest (not on boss depths) and, rarely, a treasure thief — each in its own room.
function placeEncounters(depth,rooms,start,exit,isBoss,spot){
  G.feats=[];G.walls=[];const a=actIdx(depth)+1,free=shuffle(rooms.filter(r=>r!==start&&!(isBoss&&r===exit)));
  const take=()=>{const r=free.pop();return r?spot(r):null;};
  const nS=Math.random()<0.6?(Math.random()<0.25?2:1):0;
  for(let k=0;k<nS;k++){const q=take();if(q)G.feats.push({kind:'shrine',type:pick(Object.keys(SHRINES)),x:q.x,y:q.y,r:22,used:false});}
  if(!isBoss&&Math.random()<0.35){const q=take();if(q)G.feats.push({kind:'chest',x:q.x,y:q.y,r:20,state:'idle',wave:0,waitT:0});}
  if(!isBoss&&Math.random()<0.06+0.02*a){const q=take();if(q){const t=makeEnemy('thief',q.x,q.y,depth,false,'thief');G.enemies.push(t);}}
}

// ---------- using shrines and chests ----------
function nearFeat(){const p=G.p;let best=null,bd=70;
  for(const f of G.feats){if(f.use?f.done:f.kind==='shrine'?f.used:f.state!=='idle')continue; /* f.use: zones.js features */const d=Math.hypot(f.x-p.x,f.y-p.y);if(d<bd){bd=d;best=f;}}return best;}
function useFeature(){const f=G.nearFeat,p=G.p;if(G.inTown&&G.elderNear&&!G.paused)return openQuests(); /* zones.js */
  if(!f||G.paused||p.dead||G.inTown)return;if(f.use){f.use(f);G.nearFeat=null;return;}
  if(f.kind==='shrine'&&!f.used){const S=SHRINES[f.type];f.used=true;(p.shr||(p.shr={}))[f.type]=SHRINE_T;refreshStats();
    toast(S.name,S.buff+' for 30s');G.fx.push({type:'ring',x:p.x,y:p.y,r0:10,r1:110,t:0,max:0.5,col:S.col});burst(f.x,f.y,30,S.col,200);}
  else if(f.kind==='chest'&&f.state==='idle'){f.state='waves';toast('The chest is cursed!','Survive 3 waves');G.shake=8;nextWave(f);}
  G.nearFeat=null;}
const chestPack=f=>'chest'+G.feats.indexOf(f)+'-'+f.wave;
// Wave 1: a pack. Wave 2: a pack and a half. Wave 3: an elite pack with affixes.
function nextWave(f){f.wave++;const d=G.depth,w=f.wave,id=chestPack(f);
  let types=rollPack(d,w===3);if(w===2)types=types.concat(rollPack(d,false).slice(0,Math.ceil(types.length/2)));
  const affs=w===3?rollAffixes(d):null;
  types.forEach((type,m)=>{const T=ETYPES[type];let x=f.x,y=f.y;
    for(let k=0;k<20;k++){const a=rand(0,TAU),r=rand(120,200),qx=f.x+Math.cos(a)*r,qy=f.y+Math.sin(a)*r,ti=tileIdx(qx,qy);
      if(!blockedAt(qx,qy,T.r)&&G.terrain[ti]===0&&G.flow[ti]>=0){x=qx;y=qy;break;}}
    const e=makeEnemy(type,x,y,d,w===3&&m<4,id,affs);e.aggro=true;e.spawnT=0.7;e.chest=f;G.enemies.push(e);burst(x,y,12,'#b060ff',150);});
  if(w>1)toast(`Wave ${w}/3`,w===3?'The guardians awaken':'');
  G.fx.push({type:'ring',x:f.x,y:f.y,r0:10,r1:200,t:0,max:0.6,col:'#b060ff'});}
function chestTick(f,dt){if(f.state!=='waves')return;
  if(G.enemies.some(e=>!e.dead&&e.chest===f))return;
  f.waitT+=dt;if(f.waitT<1.5)return;f.waitT=0;
  if(f.wave<3)nextWave(f);else openChest(f);}
// Reward: rare + magic guaranteed, more items in later acts, gold, stones and a charm roll.
function openChest(f){f.state='open';const d=G.depth,a=actIdx(d)+1,c=G.char,n=3+a+(d>25?1:0),e={x:f.x,y:f.y};
  for(let k=0;k<n;k++)dropItem(f.x+rand(-45,45),f.y+rand(-45,45),rollDrop(c,d+2,2,k===0?2:k===1?1:0,{act:dropAct(d)}));
  for(let k=0;k<4;k++)dropGold(f.x,f.y,Math.round(d*randi(6,10)*(1+0.15*a)));
  dropStones(e,'elite');dropStones(e,'elite');dropCharms(e,'elite');
  toast('The curse is lifted!','The chest spills its treasure');G.shake=12;burst(f.x,f.y,40,'#f2d04a',240);saveChar();}

// ---------- treasure thief: never fights, runs, escapes after a while, drops a fortune ----------
ETYPES.thief={name:'Treasure Thief',r:14,hp:85,dmg:0,spd:140,range:0,cd:99,xp:60,col:'#6a5a2a',ai:'flee',drop:0,cost:0,heavy:1,shape:'thief'};
// Next tile away from the player along the flow field (null when cornered or out of range).
function flowAway(e){const tx=Math.floor(e.x/TILE),ty=Math.floor(e.y/TILE),here=G.flow[ty*MW+tx];if(here<0)return null;let best=null,bd=here;
  for(const [ax,ay] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nx=tx+ax,ny=ty+ay;if(solid(nx,ny))continue;if(ax&&ay&&(solid(tx+ax,ty)||solid(tx,ty+ay)))continue;
    const d=G.flow[ny*MW+nx];if(d>bd){bd=d;best=[nx,ny];}}
  return best?Math.atan2((best[1]+0.5)*TILE-e.y,(best[0]+0.5)*TILE-e.x):null;}
AI.flee=(e,T,d,toP,step,chase,cdm,dt)=>{const a=actIdx(G.depth)+1;
  if(e.fleeT==null){e.fleeT=22-a;e.spd=T.spd+a*5;toast('A Treasure Thief!','Catch it before it escapes');}
  e.fleeT-=dt;if(e.fleeT<=0){thiefEscape(e);return;}
  e.blinkCd=(e.blinkCd??2)-dt;if(d<90&&e.blinkCd<=0){e.blinkCd=blinkAway(e)?5:1;return;} // cornered: vanish and reappear further off
  const dir=flowAway(e)??toP+Math.PI;e.face=dir;step(dir+Math.sin(G.time*3+e.seed)*0.3,d<240?1:0.5);};
function thiefEscape(e){e.dead=true;G.fx.push({type:'ring',x:e.x,y:e.y,r0:4,r1:50,t:0,max:0.4,col:'#c79bff'});burst(e.x,e.y,24,'#c79bff',180);toast('The thief escaped!','…with all that loot');}
function thiefHit(e){if(Math.random()<0.3)dropGold(e.x,e.y,Math.round(G.depth*randi(1,3)));}
function thiefLoot(e){const d=G.depth,a=actIdx(d)+1,c=G.char,n=3+Math.ceil(a/2)+(d>25?1:0);
  for(let k=0;k<12;k++)dropGold(e.x+rand(-40,40),e.y+rand(-40,40),Math.round(d*randi(8,14)*(1+0.1*a)));
  for(let k=0;k<n;k++)dropItem(e.x+rand(-40,40),e.y+rand(-40,40),rollDrop(c,d+1,1,k===0?2:0,{act:dropAct(d)}));
  dropStones(e,'elite');toast('Treasure Thief slain!','Its hoard spills out');G.shake=10;}

// ---------- per frame: buff timers, walls, chest waves, the use button ----------
let useLabel='';
function encounterTick(dt){const p=G.p,b=p.shr;
  if(b){let ch=false;for(const k in b)if(b[k]>0){b[k]-=dt;if(b[k]<=0){b[k]=0;ch=true;}}if(ch)refreshStats();}
  for(const w of G.walls){w.t-=dt;if(w.t<=0){G.grid[w.k]=0;G.flowTile=-1;burst((w.i+0.5)*TILE,(w.j+0.5)*TILE,6,'#8a7050',90);}}
  G.walls=G.walls.filter(w=>w.t>0);
  for(const f of G.feats)if(f.kind==='chest')chestTick(f,dt);
  G.nearFeat=p.dead||G.inTown?null:nearFeat();
  zoneTick(dt);elderTick();
  const lbl=G.inTown&&G.elderNear?'📜 '+G.elder.who.name:G.nearFeat?G.nearFeat.use?G.nearFeat.label:(G.nearFeat.kind==='shrine'?'✦ '+SHRINES[G.nearFeat.type].name:'☠ Open Cursed Chest'):'';
  if(lbl!==useLabel){useLabel=lbl;$('useBtn').textContent=lbl;$('useBtn').classList.toggle('hidden',!lbl);}
}
tap('useBtn',useFeature);

// ---------- drawing ----------
function drawFeatures(onScreen){
  for(const w of G.walls){const x=w.i*TILE,y=w.j*TILE,k=Math.min(1,w.t*2); // crumbles in its last half second
    ctx.globalAlpha=k;ctx.fillStyle='#4a3a2a';ctx.fillRect(x+2,y+2,TILE-4,TILE-4);ctx.fillStyle='#6a5640';ctx.fillRect(x+2,y+2,TILE-4,8);
    ctx.strokeStyle='#1a120a';ctx.lineWidth=2;ctx.strokeRect(x+2,y+2,TILE-4,TILE-4);ctx.globalAlpha=1;}
  ctx.textAlign='center';
  for(const f of G.feats){if(!onScreen(f.x,f.y,60))continue;if(f.zdraw){f.zdraw(f);continue;}
    if(f.kind==='shrine'){const S=SHRINES[f.type],on=!f.used,x=f.x,y=f.y;
      if(on){const g=ctx.createRadialGradient(x,y-18,2,x,y-18,40);g.addColorStop(0,S.col+'aa');g.addColorStop(1,S.col+'00');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y-18,40,0,TAU);ctx.fill();}
      ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(x,y+8,18,7,0,0,TAU);ctx.fill();
      ctx.fillStyle=on?'#5a5248':'#3a3630';ctx.strokeStyle='#0a0705';ctx.lineWidth=2;ctx.fillRect(x-9,y-22,18,30);ctx.strokeRect(x-9,y-22,18,30);ctx.fillRect(x-14,y+2,28,7);ctx.strokeRect(x-14,y+2,28,7);
      ctx.fillStyle=on?S.col:'#555';ctx.beginPath();ctx.arc(x,y-30+(on?Math.sin(G.time*3)*3:0),7,0,TAU);ctx.fill();
      ctx.font='bold 11px sans-serif';ctx.fillStyle='#0a0705';ctx.fillText(S.icon,x,y-8);
      if(on){ctx.font='11px Georgia';ctx.lineWidth=3;ctx.strokeStyle='#000';ctx.strokeText(S.name,x,y-44);ctx.fillStyle=S.col;ctx.fillText(S.name,x,y-44);}}
    else{const x=f.x,y=f.y,open=f.state==='open',act=f.state==='waves';
      if(!open){const g=ctx.createRadialGradient(x,y,2,x,y,46);g.addColorStop(0,act?'#ff40a088':'#9040ff66');g.addColorStop(1,'#9040ff00');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,46,0,TAU);ctx.fill();}
      ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(x,y+12,24,8,0,0,TAU);ctx.fill();
      ctx.fillStyle='#3a2216';ctx.strokeStyle='#0a0705';ctx.lineWidth=2;ctx.fillRect(x-20,y-8,40,20);ctx.strokeRect(x-20,y-8,40,20);
      ctx.fillStyle=open?'#2a180e':'#4a2c1a';if(open){ctx.fillRect(x-20,y-24,40,8);ctx.strokeRect(x-20,y-24,40,8);}else{ctx.beginPath();ctx.moveTo(x-20,y-8);ctx.quadraticCurveTo(x,y-26,x+20,y-8);ctx.closePath();ctx.fill();ctx.stroke();}
      ctx.fillStyle='#6a5a7a';ctx.fillRect(x-20,y-2,40,3);ctx.fillStyle=open?'#f2d04a':'#c060ff';ctx.fillRect(x-4,y-6,8,8);
      const lbl=open?'':act?`Wave ${f.wave}/3`:'Cursed Chest';
      if(lbl){ctx.font='11px Georgia';ctx.lineWidth=3;ctx.strokeStyle='#000';ctx.strokeText(lbl,x,y-32);ctx.fillStyle=act?'#ff70c0':'#c080ff';ctx.fillText(lbl,x,y-32);}}}
}
function minimapFeatures(s){minimapZone(s);
  for(const f of G.feats){if(f.zdraw||!G.explored[tileIdx(f.x,f.y)])continue;
    if(f.kind==='shrine'){if(f.used)continue;mctx.fillStyle=SHRINES[f.type].col;mctx.beginPath();mctx.arc(f.x/TILE*s,f.y/TILE*s,4,0,TAU);mctx.fill();}
    else if(f.state!=='open'){mctx.fillStyle='#c060ff';mctx.fillRect(f.x/TILE*s-4,f.y/TILE*s-3,8,6);}}
  mctx.fillStyle='#f2d04a';for(const e of G.enemies)if(e.type==='thief'&&!e.dead&&G.explored[tileIdx(e.x,e.y)])mctx.fillRect(e.x/TILE*s-3,e.y/TILE*s-3,6,6);
}
// Hooded runner with a bulging sack of loot over its shoulder.
SHAPES.thief=(e,col)=>{ctx.rotate(e.face);const r=e.r;
  ctx.fillStyle='#c8a040';ctx.strokeStyle='#0a0705';ctx.lineWidth=2;ctx.beginPath();ctx.arc(-r*0.8,r*0.5,r*0.75,0,TAU);ctx.fill();ctx.stroke();
  ctx.fillStyle='#f2d04a';ctx.beginPath();ctx.arc(-r*0.9,r*0.3,2.5,0,TAU);ctx.arc(-r*0.5,r*0.7,2,0,TAU);ctx.fill();
  ctx.fillStyle=col;ctx.strokeStyle='#0a0705';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();ctx.stroke();
  ctx.fillStyle='#2a2010';ctx.beginPath();ctx.arc(r*0.2,0,r*0.6,-1.4,1.4);ctx.fill();
  ctx.fillStyle='#ffe060';for(const s of [-1,1]){ctx.beginPath();ctx.arc(r*0.5,s*r*0.22,2,0,TAU);ctx.fill();}};
