'use strict';
// Monsters: boss move sets, behaviours (AI), monster types, elite modifiers, pack rolling.
// ---------- monster behaviours ----------
// ---------- bosses: each act's boss has its own move set and a second phase below 50% life ----------
const later=(t,fn)=>G.delayed.push({t,fn});
const bossLater=(e,t,fn)=>later(t,()=>{if(!e.dead)fn();});
// Telegraphed ground circle: fills up, then hits whoever is inside.
function groundStrike(e,x,y,r,delay,dmg,col,after){G.fx.push({type:'tele',x,y,r,t:0,max:delay,col});
  later(delay,()=>{if(e.dead)return;const p=G.p;if(Math.hypot(p.x-x,p.y-y)<r+p.r*0.5)dmgPlayer(dmg,e);G.fx.push({type:'ring',x,y,r0:r*0.3,r1:r,t:0,max:0.25,col});burst(x,y,12,col,170);if(after)after();});}
// Telegraphed line from (x,y) along ang: fills up, then hits and chills.
function lineStrike(e,x,y,ang,len,w,delay,dmg,col){G.fx.push({type:'tline',x,y,a:ang,len,w,t:0,max:delay,col});
  later(delay,()=>{if(e.dead)return;const p=G.p,dx=p.x-x,dy=p.y-y,al=dx*Math.cos(ang)+dy*Math.sin(ang),pe=Math.abs(-dx*Math.sin(ang)+dy*Math.cos(ang));
    if(al>-p.r&&al<len+p.r&&pe<w/2+p.r*0.6&&dmgPlayer(dmg,e))slowPlayer(0.4,1.2);G.fx.push({type:'lflash',x,y,a:ang,len,w,t:0,max:0.22,col});G.shake=Math.max(G.shake,4);});}
function ring(e,n,spd,col,dmg,r,off,gap,extra){for(let k=0;k<n;k++){if(gap&&k<gap)continue;enemyShoot(e,off+k/n*TAU,spd,col,dmg,r,extra);}}
function bossSummon(e,type,n,cap){const k=Math.min(n,cap-G.enemies.filter(o=>!o.dead&&o.master===e).length);
  for(let i=0;i<k;i++){const a=rand(0,TAU);let x=e.x+Math.cos(a)*(e.r+30),y=e.y+Math.sin(a)*(e.r+30);if(blockedAt(x,y,18)){x=e.x;y=e.y;}
    const m=makeEnemy(type,x,y,G.depth,false,e.pack);m.aggro=true;m.master=e;m.summoned=true;m.spawnT=0.4;G.enemies.push(m);burst(x,y,12,'#c080ff',140);}return k>0;}
const near=(r)=>{const p=G.p;for(let k=0;k<12;k++){const a=rand(0,TAU),d=rand(0,r),x=p.x+Math.cos(a)*d,y=p.y+Math.sin(a)*d;if(!wallAt(Math.floor(x/TILE),Math.floor(y/TILE)))return [x,y];}return [p.x,p.y];};
// hp/dmg/pace stack on top of depth scaling so each act's boss is a clear step up; loot improves with it.
// Fights run on js/bossfight.js: phases at 70% / 35% (phases[0] starts at 70%, phases[1] at 35%), big attacks with an
// exposed window, stagger, shields held by adds, shrinking arenas, enrage. moves: ph = first phase (0..2) it is used in.
const BIG=e=>e.dmg*4; // a big attack: about half your life with act-appropriate gear
const BOSSES=[
  { // Act 1: Varrok the Hollow, a crypt lord who raises the dead. Teaches dodging: Grave Cleave.
    elem:['cres',0.4],hp:0.75,dmg:1,pace:1,spd:0.9,enrage:'tears open the graves!',
    vs:{warden:[1.35,'Old bone shatters under steel'],arcanist:[0.55,'Grave wards blunt your spells']},
    loot:{n:2,rare:1,unique:0,ilvl:2,gold:60},
    phases:[
      {name:'Bone Ward',enter(e){shieldAdds(e,'grunt',4,'Bone Warden',2);}},
      {name:'Crypt Collapse',tick(e,dt){e.colT=(e.colT||1)-dt;if(e.colT<=0){e.colT=e.enraged?0.8:1.1;for(let i=0;i<2;i++){const [x,y]=i?near(160):[G.p.x+rand(-30,30),G.p.y+rand(-30,30)];groundStrike(e,x,y,50,1,e.dmg*1.1,'#9ab0d8',()=>burst(x,y,10,'#8a7a62',150));}}}}],
    moves:[
    {name:'Grave Cleave',w:3,cd:1.4,big:1,fn(e){const a=Math.atan2(G.p.y-e.y,G.p.x-e.x);e.lockA=a;bigAttack(e,1.5,()=>lineStrike(e,e.x-Math.cos(a)*20,e.y-Math.sin(a)*20,a,250,150,1.5,BIG(e)*1.1,'#ff6a3a'));}},
    {name:'Bone Spiral',w:3,cd:1.2,fn(e){const arms=e.phase?2:1,off=rand(0,TAU);e.busy=2.1;for(let i=0;i<24;i++)bossLater(e,i*0.08,()=>{for(let a=0;a<arms;a++)enemyShoot(e,off+i*0.33+a*Math.PI,210,'#e8e0c0',e.dmg*0.5,6);});}},
    {name:'Raise Dead',w:2,cd:2,fn(e){e.wind=0.8;e.tele={r:e.r+30,col:'#9ab0d8'};e.act=()=>{bossSummon(e,'grunt',e.phase?4:3,6);if(e.phase)bossSummon(e,'archer',1,7);};}},
    {name:'Grave Hands',w:3,cd:1.6,fn(e){const n=e.phase?7:5;e.busy=0.5;for(let i=0;i<n;i++)bossLater(e,i*0.15,()=>{const [x,y]=i===0?[G.p.x,G.p.y]:near(110);groundStrike(e,x,y,58,0.9,e.dmg*0.9,'#9ab0d8');});}}]},
  { // Act 2: The Ash Tyrant, a fast brute of chained charges and falling ash
    elem:['lres',0.5],hp:1.45,dmg:1.05,pace:0.95,spd:1.2,enrage:'whips up the sandstorm!',
    vs:{warden:[1.3,'Steel finds the cracks in his ash-hardened hide'],arcanist:[0.75,'Keep your distance: his charges are deadly up close']},
    loot:{n:3,rare:1,unique:0,ilvl:3,gold:75},
    phases:[
      {name:'Sandstorm',tick(e,dt){e.trT=(e.trT||0)-dt;if(e.trT<=0){e.trT=0.4;addEHaz(e.x,e.y,34,4,e.dmg*0.4,'fire');}e.swT=(e.swT??3)-dt;if(e.swT<=0){e.swT=9;bossSummon(e,'scarab',5,12);}}},
      {name:'Closing Storm',enter(e){e.arena={x:e.homeX,y:e.homeY,r:540,min:210,rate:15};toast('The storm closes in','Stay inside the ring');},
        tick(e,dt){e.trT=(e.trT||0)-dt;if(e.trT<=0){e.trT=0.5;addEHaz(e.x,e.y,30,3,e.dmg*0.4,'fire');}}}],
    moves:[
    {name:'Sundering Charge',w:3,cd:1.4,big:1,fn(e){const a=Math.atan2(G.p.y-e.y,G.p.x-e.x);e.lockA=a;
      bigAttack(e,1.2,()=>G.fx.push({type:'tline',x:e.x,y:e.y,a,len:440,w:e.r*2.2,t:0,max:1.2,col:'#e0a860'}),()=>{e.dash=0.55;e.dashHit=false;e.dashDmg=BIG(e);e.dvx=Math.cos(a)*800;e.dvy=Math.sin(a)*800;},1.8);}},
    {name:'Chained Charges',w:2,cd:1.3,fn(e){const n=e.phase?3:2;e.busy=n*1.05;for(let k=0;k<n;k++)bossLater(e,k*1.05,()=>{const a=Math.atan2(G.p.y-e.y,G.p.x-e.x);e.wind=0.5;e.act='charge';e.chargeA=a;e.dashDmg=null;
        G.fx.push({type:'tline',x:e.x,y:e.y,a,len:300,w:e.r*2,t:0,max:0.5,col:'#e0a860'});});}},
    {name:'Ash Meteors',w:3,cd:1.4,fn(e){const n=e.phase?8:6;e.busy=0.8;for(let i=0;i<n;i++)bossLater(e,i*0.2,()=>{const [x,y]=i===0?[G.p.x,G.p.y]:near(150);groundStrike(e,x,y,55,1,e.dmg,'#ff9a4a',()=>addEHaz(x,y,42,2.5,e.dmg*0.35,'fire'));});}},
    {name:'Blink Slam',w:2,cd:1,big:1,fn(e){if(!blinkNear(e))return;bigAttack(e,1.1,()=>{e.tele={r:130,col:'#e0a860'};},()=>{if(dist(e,G.p)<130+G.p.r)dmgPlayer(BIG(e)*0.85,e);G.shake=Math.max(G.shake,10);burst(e.x,e.y,24,'#c8a070',220);fxCracks(e.x,e.y,130,'#ffb060');
        if(e.phase)ring(e,12,240,'#f0c878',e.dmg*0.45,6,rand(0,TAU));});}}]},
  { // Act 3: Mother of Rot, slow, fills the arena with poison and spawn
    elem:['pres',0.6],hp:1.37,dmg:1.05,pace:0.95,spd:0.6,enrage:'bursts with festering rot!',
    vs:{warden:[1.0,'Steel cuts through rotting flesh'],arcanist:[0.9,'Her rot drinks your magic, but you keep your distance',0.86]},
    loot:{n:3,rare:1,unique:0,ilvl:3,gold:90},
    phases:[
      {name:'Brood Cocoon',enter(e){shieldAdds(e,'vinelasher',2,'Brood Sac',1.8);bossSummon(e,'sporetoad',2,5);}},
      {name:'Rising Rot',tick(e,dt){e.rotT=(e.rotT??1)-dt;if(e.rotT<=0){e.rotT=e.enraged?3.2:4.3;for(let i=0;i<3;i++){const [x,y]=i?near(280):[G.p.x,G.p.y];groundStrike(e,x,y,75,1.3,e.dmg*0.6,'#9fe04a',()=>addEHaz(x,y,75,6.5,e.dmg*0.32,'poison'));}}}}],
    moves:[
    {name:'Rot Eruption',w:3,cd:1.5,big:1,fn(e){bigAttack(e,1.5,()=>groundStrike(e,e.x,e.y,230,1.5,BIG(e)*1.05,'#9fe04a',()=>{fxCracks(e.x,e.y,230,'#a8e060');for(let k=0;k<5;k++)addEHaz(e.x+rand(-120,120),e.y+rand(-120,120),50,4,e.dmg*0.4,'poison');}));}},
    {name:'Poison Globs',w:3,cd:1.3,fn(e){const n=e.phase?6:4;e.busy=0.6;for(let i=0;i<n;i++)bossLater(e,i*0.18,()=>{const [x,y]=i===0?[G.p.x,G.p.y]:near(170);
        groundStrike(e,x,y,60,1.1,e.dmg*0.6,'#9fe04a',()=>addEHaz(x,y,65,5,e.dmg*0.45,'poison'));});}},
    {name:'Spore Nova',w:2,cd:1.3,fn(e){const off=rand(0,TAU);ring(e,18,170,'#a8e060',e.dmg*0.5,7,off,0,{slow:0.35});if(e.phase)bossLater(e,0.35,()=>ring(e,18,170,'#a8e060',e.dmg*0.5,7,off+TAU/36,0,{slow:0.35}));e.busy=0.6;}},
    {name:'Brood',w:2,cd:1.8,fn(e){e.wind=0.8;e.tele={r:e.r+30,col:'#9fe04a'};e.act=()=>bossSummon(e,'sporetoad',e.phase?4:3,7);}}]},
  { // Act 4: Rimeheart, the Frozen King, ice lances, avalanches, a warded shield and a floor that shatters
    elem:['cres',0.6],hp:2.7,dmg:1.15,pace:0.85,spd:0.75,dr:0.15,
    vs:{warden:[0.95,'Ice armour turns your blades, but your plate holds the cold out',0.95],arcanist:[1.15,'Fire and lightning crack his ice']},enrage:'calls down the endless winter!',
    loot:{n:4,rare:2,unique:0,ilvl:4,gold:110},
    phases:[
      {name:'Ice Ward',enter(e){shieldAdds(e,'frostwraith',3,'Rime Warden',2.2);},tick(e,dt){e.snowT=(e.snowT??2)-dt;if(e.snowT<=0){e.snowT=2.6;for(let i=0;i<3;i++)bossLater(e,i*0.2,()=>{const [x,y]=near(220);groundStrike(e,x,y,45,0.8,e.dmg*0.8,'#dff4ff',()=>slowPlayer(0.3,0.8));});}}},
      {name:'Shattering Floor',tick(e,dt){e.shT=(e.shT??1)-dt;if(e.shT<=0){e.shT=e.enraged?1.1:1.6;const [x,y]=Math.random()<0.5?[G.p.x,G.p.y]:near(220);groundStrike(e,x,y,72,1.2,e.dmg*0.9,'#bfe8ff',()=>addEHaz(x,y,72,8,e.dmg*0.35,'frost'));}}}],
    moves:[
    {name:'Glacial Lances',w:3,cd:1.3,big:1,fn(e){const n=e.phase?5:3,a=Math.atan2(G.p.y-e.y,G.p.x-e.x);bigAttack(e,1.25,()=>{for(let k=0;k<n;k++)lineStrike(e,e.x,e.y,a+(k-(n-1)/2)*0.34,560,50,1.25,BIG(e)*0.8,'#bfe8ff');});}},
    {name:'Avalanche',w:2,cd:1.4,big:1,fn(e){const x=G.p.x,y=G.p.y;bigAttack(e,1.4,()=>groundStrike(e,x,y,125,1.4,BIG(e),'#dff4ff',()=>{fxCracks(x,y,125,'#bfe8ff');slowPlayer(0.4,1.2);}));}},
    {name:'Frost Ring',w:2,cd:1.2,fn(e){const off=rand(0,TAU);ring(e,24,200,'#bfe8ff',e.dmg*0.5,6,off,0,{slow:0.4});if(e.phase)bossLater(e,0.4,()=>ring(e,24,200,'#bfe8ff',e.dmg*0.5,6,off+TAU/48,0,{slow:0.4}));e.busy=0.6;}},
    {name:'Shardlings',w:2,cd:1.6,fn(e){e.wind=0.8;e.tele={r:e.r+30,col:'#8fd0f8'};e.act=()=>bossSummon(e,'shardling',e.phase?4:3,6);}}]},
  { // Act 5: The Cinder King: Cataclysm with one safe wedge, meteors, burning charges; a molten shield; the Core melts down
    elem:['fres',0.6],hp:9.0,dmg:0.85,pace:0.8,spd:1,enrage:'ignites the Core!',
    vs:{warden:[1.75,'His molten armour breaks under steel, but your plate burns',1.6],arcanist:[0.75,'Living flame shrugs off your spells, but your wards resist his fire',0.75]},
    loot:{n:4,rare:1,unique:1,ilvl:5,gold:140},
    phases:[
      {name:'Molten Shield',enter(e){shieldAdds(e,'magmabrute',2,'Molten Warden',1.3);e.jetA=rand(0,TAU);e.jetDir=Math.random()<0.5?1:-1;},tick(e,dt){cinderJets(e,dt,2);}},
      {name:'Core Meltdown',enter(e){e.arena={x:e.homeX,y:e.homeY,r:500,min:190,rate:14};toast('The Core melts down','Stay inside the ring');},tick(e,dt){cinderJets(e,dt,e.enraged?4:3);}}],
    moves:[
    {name:'Cataclysm',w:2,cd:1.6,big:1,fn(e){const a=rand(0,TAU),half=0.6;bigAttack(e,2.2,()=>{G.fx.push({type:'cata',x:e.x,y:e.y,a,half,t:0,max:2.2});
      bossLater(e,2.2,()=>{const p=G.p,pa=Math.atan2(p.y-e.y,p.x-e.x);if(Math.abs(angDiff(pa,a))>half&&!p.dodge)dmgPlayer(BIG(e)*1.25,e);G.shake=Math.max(G.shake,14);fxExplosion(e.x,e.y,200,'#ff6a1a');
        for(let k=0;k<6;k++){const r=rand(80,400),b=a+Math.PI+rand(-2.4,2.4);addEHaz(e.x+Math.cos(b)*r,e.y+Math.sin(b)*r,45,2.5,e.dmg*0.24,'fire');}});});}},
    {name:'Meteor Rain',w:3,cd:1.5,fn(e){const n=e.phase?9:7;e.busy=0.8;for(let i=0;i<n;i++)bossLater(e,i*0.18,()=>{const [x,y]=i===0?[G.p.x,G.p.y]:near(180);groundStrike(e,x,y,70,1.1,e.dmg*1.2,'#ff6a1a',()=>addEHaz(x,y,55,3,e.dmg*0.26,'fire'));});}},
    {name:'Burning Charge',w:2,cd:1.2,big:1,fn(e){const a=Math.atan2(G.p.y-e.y,G.p.x-e.x);e.lockA=a;bigAttack(e,1.1,()=>G.fx.push({type:'tline',x:e.x,y:e.y,a,len:400,w:e.r*2.2,t:0,max:1.1,col:'#ff7a3a'}),
      ()=>{e.dash=0.55;e.dashHit=false;e.dashDmg=BIG(e);e.dvx=Math.cos(a)*760;e.dvy=Math.sin(a)*760;for(let i=0;i<8;i++)bossLater(e,i*0.06,()=>addEHaz(e.x,e.y,30,3,e.dmg*0.26,'fire'));},1.7);}},
    {name:'Supernova',w:4,cd:2,big:1,ph:2,fn(e){e.busy=0;bigAttack(e,2.4,()=>{G.fx.push({type:'nova',x:e.x,y:e.y,r:115,t:0,max:2.4});toast('Supernova!','Get close to him');
      bossLater(e,2.4,()=>{const p=G.p;if(Math.hypot(p.x-e.x,p.y-e.y)>115+p.r*0.5&&!p.dodge)dmgPlayer(BIG(e)*1.5,e);G.shake=Math.max(G.shake,18);G.hitStop=0.12;fxExplosion(e.x,e.y,320,'#ffcc66');
        G.fx.push({type:'ring',x:e.x,y:e.y,r0:115,r1:700,t:0,max:0.6,col:'#ffcc66'});});});}},
    {name:'Flame Wave',w:3,cd:1.3,fn(e){const off=rand(0,TAU);ring(e,30,190,'#ff8a2a',e.dmg*0.42,8,off,6);if(e.phase)bossLater(e,0.6,()=>ring(e,30,190,'#ff8a2a',e.dmg*0.42,8,off+Math.PI,6));e.busy=0.7;}}]}
];
// Rotating fire jets (n directions) from the Cinder King.
function cinderJets(e,dt,n){e.jetT=(e.jetT||0)-dt;if(e.jetT<=0){e.jetT=0.34;e.jetA=(e.jetA||0)+0.2*(e.jetDir||1);for(let k=0;k<n;k++)enemyShoot(e,e.jetA+k*TAU/n,220,'#ffb040',e.dmg*0.18,6);}}
function blinkNear(e){const p=G.p;for(let k=0;k<20;k++){const a=rand(0,TAU),r=rand(110,160),x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r,ti=tileIdx(x,y);
  if(blockedAt(x,y,e.r)||!(G.flow[ti]>=0))continue;burst(e.x,e.y,20,'#e0c080',180);e.x=x;e.y=y;burst(x,y,20,'#e0c080',180);return true;}return false;}
function bossAI(e,T,d,toP,step,chase,dt){const B=BOSSES[e.kind]||BOSSES[0];
  if(e.busy>0)return;
  if(e.cd<=0){const ms=B.moves.filter(m=>m.name!==e.last&&(m.ph||0)<=e.phase);let w=Math.random()*ms.reduce((a,m)=>a+m.w,0),mv=ms[0];
    for(const m of ms){w-=m.w;if(w<0){mv=m;break;}}
    e.last=mv.name;mv.fn(e,d,toP);e.cd=mv.cd*(e.phase?0.85:1)*(e.phase>1?0.9:1)*(e.enraged?0.65:1)*B.pace;}
  else if(d>70)chase();
}
function blinkAway(e){const p=G.p;for(let k=0;k<20;k++){const a=rand(0,TAU),r=rand(200,300),x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r,ti=tileIdx(x,y);
  if(x<TILE||y<TILE||x>(MW-1)*TILE||y>(MH-1)*TILE||blockedAt(x,y,e.r+2)||G.terrain[ti]!==0||!(G.flow[ti]>=0))continue;
  burst(e.x,e.y,14,'#e8c890',150);G.fx.push({type:'ring',x:e.x,y:e.y,r0:4,r1:30,t:0,max:0.25,col:'#f0c878'});e.x=x;e.y=y;burst(x,y,14,'#e8c890',150);return true;}return false;}
const AI={
  melee(e,T,d,toP,step,chase,cdm){if(d>e.r+G.p.r+T.range)chase();else if(e.cd<=0){e.wind=T.heavy?0.45:0.35;e.cd=T.cd*cdm;}},
  // scarabs: fast, weaving approach in swarms, quick nips
  swarm(e,T,d,toP,step,chase,cdm){if(d>e.r+G.p.r+T.range){step((d<TILE*1.6?toP:(flowDir(e)??toP))+Math.sin(G.time*9+e.seed)*0.7,1);}else if(e.cd<=0){e.wind=0.18;e.cd=T.cd*cdm;}},
  ranged(e,T,d,toP,step,chase,cdm){if(d>240)chase();else if(d<140)step(toP+Math.PI,0.8);if(d<T.range&&e.cd<=0){eShoot(e,toP);e.cd=T.cd*cdm*rand(0.8,1.2);}},
  // frost wraith: hovers at range, drifting sideways, slowing bolts
  kite(e,T,d,toP,step,chase,cdm){if(d>280)chase();else if(d<180)step(toP+Math.PI+Math.sin(G.time+e.seed)*0.5,0.9);else step(toP+Math.PI/2*e.dir,0.45);
    if(Math.random()<0.006)e.dir*=-1;if(d<T.range&&e.cd<=0){eShoot(e,toP);e.cd=T.cd*cdm*rand(0.85,1.15);}},
  // imps: circle the player at ~170 throwing fireballs
  strafe(e,T,d,toP,step,chase,cdm){if(d>320)chase();else{const k=clamp((d-170)/150,-1,1);step(toP+e.dir*(Math.PI/2-k*1.1),1);if(Math.random()<0.01)e.dir*=-1;}
    if(d<T.range&&e.cd<=0){eShoot(e,toP+rand(-0.08,0.08));e.cd=T.cd*cdm*rand(0.8,1.3);}},
  // dust mage: keeps range, teleports away when you close in or hit it
  blink(e,T,d,toP,step,chase,cdm,dt){e.blinkCd=(e.blinkCd??rand(1,2))-dt;
    if(e.blinkCd<=0&&(d<150||G.time-(e.lastHit||-9)<0.3)){e.blinkCd=blinkAway(e)?rand(3.5,5):1;return;}
    if(d>300)chase();else if(d<200)step(toP+Math.PI,0.7);
    if(d<T.range&&e.cd<=0){e.wind=0.4;e.tele={r:e.r+8,col:'#f0c878'};e.act=()=>eShoot(e,Math.atan2(G.p.y-e.y,G.p.x-e.x));e.cd=T.cd*cdm*rand(0.85,1.15);}},
  // sandworm: tunnels unseen, erupts under you, bites a while, burrows again
  burrow(e,T,d,toP,step,chase,cdm,dt){e.stateT-=dt;
    if(e.under){chase();if(Math.random()<dt*10)G.parts.push({x:e.x+rand(-12,12),y:e.y+rand(-6,6),vx:rand(-30,30),vy:-rand(20,50),life:0.4,max:0.4,col:'#a8875a',s:3});
      if(d<55||e.stateT<=0&&d<200){e.wind=0.7;e.tele={r:75,col:'#d8a860'};e.act=()=>{e.under=false;e.hidden=false;e.stateT=rand(2.4,3.2);G.shake=Math.max(G.shake,7);burst(e.x,e.y,24,'#b89058',220);
        if(dist(e,G.p)<75+G.p.r)dmgPlayer(e.dmg*1.4,e);};}
      return;}
    if(e.stateT<=0){e.under=true;e.hidden=true;e.stateT=rand(2.5,4);burst(e.x,e.y,16,'#a8875a',160);return;}
    if(d<=e.r+G.p.r+T.range+6){if(e.cd<=0){e.wind=0.4;e.cd=T.cd*cdm;}}else step(toP,0.35);},
  // spore toad: approaches in hops
  hop(e,T,d,toP,step,chase,cdm,dt){if(e.hopT>0){e.hopT-=dt;moveEnt(e,e.hvx*dt,e.hvy*dt);return;}
    if(d<=e.r+G.p.r+T.range){if(e.cd<=0){e.wind=0.3;e.cd=T.cd*cdm;}return;}
    e.hopCd=(e.hopCd||0)-dt;if(e.hopCd<=0){const a=d<TILE*1.6?toP:(flowDir(e)??toP),sp=e.spd*2.8;e.hvx=Math.cos(a)*sp;e.hvy=Math.sin(a)*sp;e.hopT=0.32;e.hopCd=rand(0.45,0.85);}},
  // vine lasher: rooted; lashes the ground up close, thorn volleys at range
  turret(e,T,d,toP,step,chase,cdm){if(e.cd>0)return;
    if(d<85+G.p.r){e.wind=0.45;e.tele={r:90,col:'#9fd060'};e.act=()=>{if(dist(e,G.p)<90+G.p.r)dmgPlayer(e.dmg*1.3,e);G.fx.push({type:'ring',x:e.x,y:e.y,r0:10,r1:90,t:0,max:0.25,col:'#9fd060'});};e.cd=T.cd*cdm;}
    else if(d<T.range){eShoot(e,toP);e.cd=T.cd*cdm*rand(0.85,1.15);}},
  // ice golem: slow, armored, telegraphed ground slam that chills
  golem(e,T,d,toP,step,chase,cdm){if(d>e.r+G.p.r+T.range+20)chase();
    else if(e.cd<=0){e.wind=0.75;e.tele={r:95,col:'#bfe8ff'};e.act=()=>{if(dist(e,G.p)<95+G.p.r&&dmgPlayer(e.dmg,e))slowPlayer(0.3,1);G.shake=Math.max(G.shake,8);
      G.fx.push({type:'ring',x:e.x,y:e.y,r0:10,r1:95,t:0,max:0.3,col:'#bfe8ff'});burst(e.x,e.y,16,'#dff4ff',180);};e.cd=T.cd*cdm;}},
  // summoner: hangs back and calls imps (max 5 alive per summoner)
  summon(e,T,d,toP,step,chase,cdm){if(d>340)chase();else if(d<220)step(toP+Math.PI,0.8);else step(toP+Math.PI/2*e.dir,0.3);
    if(e.cd<=0){if(G.enemies.filter(o=>!o.dead&&o.master===e).length<5){e.wind=0.9;e.tele={r:40,col:'#ff5aa0'};e.act=()=>{for(let k=0;k<2;k++){const a=rand(0,TAU);let x=e.x+Math.cos(a)*34,y=e.y+Math.sin(a)*34;if(blockedAt(x,y,12)){x=e.x;y=e.y;}
        const m=makeEnemy('imp',x,y,G.depth,false,e.pack);m.aggro=true;m.master=e;m.summoned=true;m.spawnT=0.3;G.enemies.push(m);burst(x,y,10,'#ff5aa0',120);}};}
      e.cd=T.cd*cdm*rand(0.9,1.1);}},
  boss(e,T,d,toP,step,chase,cdm,dt){bossAI(e,T,d,toP,step,chase,dt);}
};
function blockedAt(x,y,r){const x0=Math.floor((x-r)/TILE),x1=Math.floor((x+r)/TILE),y0=Math.floor((y-r)/TILE),y1=Math.floor((y+r)/TILE);for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++)if(solid(tx,ty))return true;return false;}
function moveEnt(e,dx,dy){const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/(e.r*0.7)));const sx=dx/steps,sy=dy/steps;
  for(let k=0;k<steps;k++){
    if(!blockedAt(e.x+sx,e.y,e.r))e.x+=sx;else if(sx&&Math.abs(sx)>Math.abs(sy))cornerSlide(e,sx,0);
    if(!blockedAt(e.x,e.y+sy,e.r))e.y+=sy;else if(sy&&Math.abs(sy)>=Math.abs(sx))cornerSlide(e,0,sy);}}
// Corner correction: pushing into a wall edge that is nearly lined up with an opening slides you sideways into it
// (up to 9 px), instead of snagging on the corner. Found by the autotest bot: loot in one-tile nooks was unreachable.
function cornerSlide(e,sx,sy){const m=Math.max(Math.abs(sx),Math.abs(sy));
  for(let o=1;o<=9;o++)for(const s of [1,-1]){const ox=sy?s*o:0,oy=sx?s*o:0;
    if(!blockedAt(e.x+ox,e.y+oy,e.r)&&!blockedAt(e.x+ox+sx,e.y+oy+sy,e.r)){const k=Math.min(o,m);e.x+=Math.sign(ox)*k;e.y+=Math.sign(oy)*k;return;}}}

// Monster types. ai picks the behaviour; cost is the pack budget it uses (keeps difficulty smooth across acts);
// heavy = immune to knockback; dr = damage reduction; shot = projectile attack.
const ETYPES={
  // Act 1
  grunt:{name:'Ghoul',r:15,hp:18,dmg:5,spd:100,range:18,cd:1.1,xp:8,col:'#6f7f4e',ai:'melee',drop:0.09,cost:1},
  archer:{name:'Bone Archer',r:13,hp:14,dmg:5,spd:85,range:290,cd:1.9,xp:10,col:'#cfc6a8',ai:'ranged',drop:0.1,cost:1,shape:'archer',shot:{spd:280,col:'#e8e0c0'}},
  brute:{name:'Ogre',r:24,hp:70,dmg:13,spd:62,range:24,cd:1.7,xp:26,col:'#8b5a3c',ai:'melee',drop:0.22,cost:2.5,heavy:1},
  // Act 2
  scarab:{name:'Scarab',r:9,hp:6,dmg:3,spd:170,range:10,cd:0.8,xp:3,col:'#2f5a78',ai:'swarm',drop:0.03,cost:0.45,shape:'scarab'},
  dustmage:{name:'Dust Mage',r:13,hp:17,dmg:6,spd:70,range:330,cd:2.3,xp:14,col:'#b89458',ai:'blink',drop:0.12,cost:1.5,shape:'robe',orb:'#ffd890',shot:{spd:250,col:'#f0c878',n:3}},
  sandworm:{name:'Sandworm',r:21,hp:60,dmg:13,spd:120,range:22,cd:1.3,xp:28,col:'#a07850',ai:'burrow',drop:0.22,cost:2.5,heavy:1,shape:'worm'},
  // Act 3
  sporetoad:{name:'Spore Toad',r:15,hp:24,dmg:6,spd:90,range:16,cd:1.2,xp:11,col:'#7a8a3a',ai:'hop',drop:0.1,cost:1,shape:'toad',cloud:1},
  vinelasher:{name:'Vine Lasher',r:17,hp:42,dmg:7,spd:0,range:340,cd:1.5,xp:16,col:'#3f6a2a',ai:'turret',drop:0.14,cost:1.5,heavy:1,shape:'vine',shot:{spd:300,col:'#a8e060',n:2}},
  marshtroll:{name:'Marsh Troll',r:23,hp:80,dmg:14,spd:64,range:24,cd:1.6,xp:30,col:'#55683a',ai:'melee',drop:0.22,cost:2.5,heavy:1,regen:0.05,shape:'troll'},
  // Act 4
  frostwraith:{name:'Frost Wraith',r:14,hp:22,dmg:6,spd:95,range:320,cd:1.9,xp:13,col:'#a8c8e8',ai:'kite',drop:0.12,cost:1.2,shape:'wraith',shot:{spd:260,col:'#bfe8ff',slow:0.4,r:6}},
  icegolem:{name:'Ice Golem',r:27,hp:135,dmg:20,spd:44,range:26,cd:2.2,xp:40,col:'#7aa0c0',ai:'golem',drop:0.28,cost:3,heavy:1,dr:0.4,shape:'golem'},
  shardling:{name:'Shardling',r:16,hp:30,dmg:8,spd:108,range:16,cd:1.1,xp:10,col:'#8fd0f8',ai:'melee',drop:0.08,cost:1.3,split:1,shape:'shard'},
  // Act 5
  imp:{name:'Imp',r:11,hp:13,dmg:6,spd:150,range:270,cd:1.5,xp:7,col:'#d8482a',ai:'strafe',drop:0.06,cost:0.7,shape:'imp',shot:{spd:240,col:'#ff8a2a',r:7}},
  magmabrute:{name:'Magma Brute',r:25,hp:110,dmg:16,spd:68,range:24,cd:1.7,xp:34,col:'#4a160c',ai:'melee',drop:0.24,cost:2.5,heavy:1,trail:1,shape:'magma'},
  summoner:{name:'Ember Summoner',r:15,hp:44,dmg:5,spd:60,range:300,cd:6,xp:22,col:'#6a2440',ai:'summon',drop:0.2,cost:2,shape:'robe',orb:'#ff5aa0'},
  boss:{name:'Boss',r:38,hp:700,dmg:18,spd:80,range:30,cd:2.2,xp:300,col:'#7a1f2b',ai:'boss',drop:1,heavy:1,shape:'boss'}
};
// Elite affixes live in encounters.js (AFFIXES).
// A pack is filled from the act roster until its budget runs out; budget grows slowly with depth.
function rollPack(depth,elite){const A=ACTS[actIdx(depth)],st=stageOf(depth),Z=G.zone&&typeof ZONES!=='undefined'&&ZONES[G.zone];depth=powDepth(depth); /* maps.js: difficulty */
  const ros=(Z&&Z.roster&&Z.act===actIdx(depth)+1?Z.roster:A.roster).filter( /* zones may bring their own monster mix */r=>!r[2]||st>=r[2]||cycleOf(depth)>1),tot=ros.reduce((a,r)=>a+r[1],0);
  let budget=Math.min(depth>25?12:9,3.6+depth*0.22)*(elite?0.8:1);const out=[];
  for(let guard=0;budget>0.35&&out.length<12&&guard<40;guard++){let w=Math.random()*tot,t=ros[0][0];for(const r of ros){w-=r[1];if(w<0){t=r[0];break;}}
    if(t==='summoner'&&out.includes(t))continue;
    const n=t==='scarab'?randi(4,6):t==='imp'?2:1;for(let k=0;k<n;k++)out.push(t);budget-=ETYPES[t].cost*n;}
  return out;}

// Elements (v1.0.57): what part of a monster's hits is fire, cold, lightning or poison ([resistance key, share]); the
// rest is physical (armour only). Resistances cut the elemental part (items.js resOf). Zone bosses: ZB_ELEM (zones.js),
// act bosses: BOSSES[k].elem. Hazards and elite affixes pass their own element to dmgPlayer.
const ELEM_OF={dustmage:['lres',1],sporetoad:['pres',1],vinelasher:['pres',1],scarab:['pres',0.4],frostwraith:['cres',1],icegolem:['cres',0.5],shardling:['cres',0.6],
  imp:['fres',1],magmabrute:['fres',0.6],summoner:['fres',1]};
function makeEnemy(type,x,y,depth,elite,pack,affs){
  const cyc=cycleOf(depth);depth=powDepth(depth); // maps.js: Nightmare and Hell scale like the deeper depths
  const T=ETYPES[type],en=Math.max(0,depth-25),hpM=(1+0.4*(depth-1)+0.02*(depth-1)*(depth-1))*(1+0.03*en),dM=(1+0.25*(depth-1))*(1+0.02*en); // endless depths add a little extra per depth
  const act1=depth<=5?1.3:1,A=ACTS[actIdx(depth)],af=elite&&affs?affs.slice():[],fast=af.includes('fast');
  const e={type,col:T.col,x,y,r:T.r+(elite?3:0),hp:T.hp*hpM*(elite?2.4:1),dmg:T.dmg*dM*act1*(elite?1.35:1),spd:T.spd*(fast?1.35:1)*(elite?1.05:1),cdMul:fast?0.7:1,dr:T.dr||0,affs:af,
    hx:x,hy:y,cd:rand(0.5,1.5),wind:0,stun:0,frozen:0,flash:0,aggro:false,dead:false,elite,pack,face:0,seed:rand(0,TAU),dir:Math.random()<0.5?1:-1,
    xp:T.xp*(1+0.15*(depth-1))*(elite?3*(1+0.2*Math.max(0,af.length-1)):1),name:T.name,dash:0,act:null,stateT:rand(2,3.5)};
  if(T.ai==='burrow'){e.hidden=true;e.under=true;}
  const EL=ELEM_OF[type];if(EL){e.elem=EL[0];e.elemS=EL[1];}
  if(typeof mapEnemy==='function')mapEnemy(e); // sigils.js: map modifiers
  if(type==='boss'){e.hp=T.hp*hpM;e.dmg=T.dmg*dM;e.name=A.boss+(cyc>1?' '+roman(cyc):'');e.col=A.bossCol;e.phase=0;e.kind=actIdx(depth);const B=BOSSES[e.kind];if(B.elem){e.elem=B.elem[0];e.elemS=B.elem[1];}e.hp*=B.hp;e.dmg*=B.dmg;e.spd*=B.spd;e.dr=B.dr||0;e.cd=1.5;e.maxHp=e.hp;bossInit(e);} /* js/bossfight.js: phases, stagger, life x BOSS_HP_K */
  e.maxHp=e.hp;return e;
}
