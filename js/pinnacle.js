'use strict';
// Citadels and the pinnacle boss (v1.0.68, endgame phase 4). The three Citadels on every Atlas (sigils.js) hold a
// guardian each: the Ashen Warden, the Rime Sentinel and the Rotted Matron, act-boss fights (bossfight.js: phases,
// stagger, big attacks) with two phases, in a map run from a Sigil on the Citadel node. Each drops its Fragment of
// the Hollow Sun (and the usual map rewards). One of each opens THE HOLLOW SUN at the Map Device: the hardest fight in
// the game, four phases in the burning crater (power depth 105), with its own uniques and the Sunfire Crucible.
// These bosses reuse an act boss's body, colours and lights (look: 0-4) and keep their own rules in ARCH (bossDef).
const FRAGS={ash:{name:'Ash Fragment',col:'#ff8a3a',boss:'The Ashen Warden'},frost:{name:'Frost Fragment',col:'#9fd8ff',boss:'The Rime Sentinel'},rot:{name:'Rot Fragment',col:'#9fe04a',boss:'The Rotted Matron'}};
const FRAG_KEYS=Object.keys(FRAGS);
const fragsOf=c=>{const F=c.frags&&typeof c.frags==='object'?c.frags:(c.frags={});for(const k of FRAG_KEYS)if(!(F[k]>=0))F[k]=0;return F;};
const sunReady=c=>FRAG_KEYS.every(k=>fragsOf(c)[k]>0);
// ---------- the bosses ----------
const SUN_COL='#ffcc55';
const ARCH={
  ash:{name:'The Ashen Warden',sub:'Keeper of the first Citadel, armoured in cinders',look:4,hp:9,dmg:0.9,pace:0.9,elem:['fres',0.6],enrage:'burns white-hot!',phaseAt:[0.5],frag:'ash',
    vs:{warden:[1.1,'Steel bites his cooling armour'],arcanist:[0.95,'Fire feeds him']},loot:{n:3,rare:2,unique:0,ilvl:4,gold:200},
    phases:[{name:'Ash Storm',enter(e){e.arena={x:e.homeX,y:e.homeY,r:480,min:240,rate:10};toast('An ash storm closes in','Stay inside the ring');},tick(e,dt){cinderJets(e,dt,2);}}],
    moves:[
      {name:'Cinder Rain',w:3,cd:1.4,fn(e){e.busy=0.7;for(let i=0;i<6;i++)bossLater(e,i*0.2,()=>{const [x,y]=i===0?[G.p.x,G.p.y]:near(170);groundStrike(e,x,y,66,1.05,e.dmg*1.15,'#ff6a1a',()=>addEHaz(x,y,50,2.5,e.dmg*0.24,'fire'));});}},
      {name:'Searing Charge',w:2,cd:1.3,big:1,fn(e){const a=Math.atan2(G.p.y-e.y,G.p.x-e.x);e.lockA=a;bigAttack(e,1.0,()=>G.fx.push({type:'tline',x:e.x,y:e.y,a,len:380,w:e.r*2.2,t:0,max:1.0,col:'#ff7a3a'}),
        ()=>{e.dash=0.5;e.dashHit=false;e.dashDmg=BIG(e);e.dvx=Math.cos(a)*740;e.dvy=Math.sin(a)*740;},1.6);}},
      {name:'Flame Ring',w:3,cd:1.2,fn(e){ring(e,24,200,'#ff8a2a',e.dmg*0.4,8,rand(0,TAU),5);e.busy=0.6;}}]},
  frost:{name:'The Rime Sentinel',sub:'Its watch never ended; the cold only grew',look:3,hp:9,dmg:0.9,pace:0.9,elem:['cres',0.6],enrage:'freezes the air solid!',phaseAt:[0.5],frag:'frost',
    vs:{warden:[0.95,'Ice turns your edge'],arcanist:[1.1,'Fire cracks its shell']},loot:{n:3,rare:2,unique:0,ilvl:4,gold:200},
    phases:[{name:'Shattering Floor',enter(e){toast('The floor begins to crack','Keep moving');},tick(e,dt){e.crT=(e.crT||1)-dt;if(e.crT<=0){e.crT=0.9;const [x,y]=near(220);groundStrike(e,x,y,60,1.2,e.dmg*0.9,'#bfe8ff',()=>addEHaz(x,y,46,3,e.dmg*0.2,'frost'));}}}],
    moves:[
      {name:'Glacial Lances',w:3,cd:1.4,fn(e){const a0=Math.atan2(G.p.y-e.y,G.p.x-e.x);e.busy=0.8;for(let k=-1;k<=1;k++)lineStrike(e,e.x,e.y,a0+k*0.35,420,40,0.9,e.dmg*1.1,'#bfe8ff');}},
      {name:'Frost Nova',w:2,cd:1.6,big:1,fn(e){bigAttack(e,1.4,()=>{e.tele={r:170,col:'#bfe8ff'};},()=>{if(dist(e,G.p)<170+G.p.r&&!G.p.dodge&&dmgPlayer(BIG(e)*0.9,e))slowPlayer(0.5,2);G.shake=Math.max(G.shake,10);
        G.fx.push({type:'ring',x:e.x,y:e.y,r0:20,r1:175,t:0,max:0.4,col:'#dff4ff'});});}},
      {name:'Icicle Volley',w:3,cd:1.1,fn(e){ring(e,18,230,'#dff4ff',e.dmg*0.42,7,rand(0,TAU),4,{slow:0.3});e.busy=0.5;}}]},
  rot:{name:'The Rotted Matron',sub:'She remembers the marsh, and brought it with her',look:2,hp:9,dmg:0.9,pace:0.9,elem:['pres',0.6],enrage:'bursts with spores!',phaseAt:[0.5],frag:'rot',
    vs:{warden:[1.05,'Her rot drinks magic, not steel'],arcanist:[0.95,'Spells sink into her']},loot:{n:3,rare:2,unique:0,ilvl:4,gold:200},
    phases:[{name:'Rising Rot',enter(e){toast('The rot rises','Find clean ground');},tick(e,dt){e.rtT=(e.rtT||1.4)-dt;if(e.rtT<=0){e.rtT=1.1;const [x,y]=near(260);addEHaz(x,y,70,6,e.dmg*0.26,'poison');}}}],
    moves:[
      {name:'Spore Burst',w:3,cd:1.3,fn(e){e.busy=0.7;for(let i=0;i<4;i++){const [x,y]=near(150);groundStrike(e,x,y,70,1.1,e.dmg*1.1,'#9fe04a',()=>addEHaz(x,y,60,3.5,e.dmg*0.25,'poison'));}}},
      {name:'Brood Call',w:2,cd:2.2,fn(e){bossSummon(e,'sporetoad',3,6);e.busy=0.6;}},
      {name:'Bile Wave',w:2,cd:1.5,big:1,fn(e){const a=Math.atan2(G.p.y-e.y,G.p.x-e.x);bigAttack(e,1.2,()=>G.fx.push({type:'tline',x:e.x,y:e.y,a,len:420,w:110,t:0,max:1.2,col:'#9fe04a'}),
        ()=>{const p=G.p,dx=p.x-e.x,dy=p.y-e.y,al=dx*Math.cos(a)+dy*Math.sin(a),pe=Math.abs(-dx*Math.sin(a)+dy*Math.cos(a));if(al>-p.r&&al<420&&pe<55+p.r&&!p.dodge)dmgPlayer(BIG(e),e);
          for(let k=1;k<6;k++)addEHaz(e.x+Math.cos(a)*k*70,e.y+Math.sin(a)*k*70,45,3,e.dmg*0.22,'poison');});}}]},
  // THE HOLLOW SUN: four phases (75 / 50 / 25%): Coronal Shield (solar wisps hold it), the crater collapses (a shrinking
  // ring), Collapse (faster ring, rotating jets); Eclipse (hide in the moving shadows), Gravity Well (run against the pull).
  sun:{name:'The Hollow Sun',sub:'A dead star that wants to burn again',look:4,hp:26,dmg:1,pace:0.85,spd:0.95,elem:['fres',0.5],enrage:'collapses inward!',phaseAt:[0.75,0.5,0.25],pinnacle:1,
    vs:{warden:[1,'Nothing here favours anyone'],arcanist:[1,'Nothing here favours anyone']},loot:{n:6,rare:3,unique:1,ilvl:8,gold:400},
    phases:[
      {name:'Coronal Shield',enter(e){shieldAdds(e,'imp',3,'Solar Wisp',2.2);}},
      {name:'The Crater Collapses',enter(e){e.arena={x:e.homeX,y:e.homeY,r:540,min:230,rate:12};toast('The crater collapses','Stay inside the ring');}},
      {name:'Collapse',enter(e){e.arena={x:e.homeX,y:e.homeY,r:Math.max(260,e.arena?e.arena.r:400),min:190,rate:18};e.jetA=rand(0,TAU);e.jetDir=1;},tick(e,dt){cinderJets(e,dt,3);}}],
    moves:[
      {name:'Solar Flare',w:3,cd:1.3,fn(e){const off=rand(0,TAU);ring(e,28,210,SUN_COL,e.dmg*0.42,8,off,6);if(e.phase>=2)bossLater(e,0.55,()=>ring(e,28,210,SUN_COL,e.dmg*0.42,8,off+Math.PI,6));e.busy=0.7;}},
      {name:'Corona Lances',w:3,cd:1.4,fn(e){const a0=rand(0,TAU),n=e.phase>=1?6:4;e.busy=0.9;for(let k=0;k<n;k++)lineStrike(e,e.x,e.y,a0+k*TAU/n,460,44,1.0,e.dmg*1.15,'#ffb040');}},
      {name:'Sunspots',w:3,cd:1.4,fn(e){e.busy=0.8;for(let i=0;i<5+e.phase;i++)bossLater(e,i*0.22,()=>{const [x,y]=i<2?[G.p.x,G.p.y]:near(160);groundStrike(e,x,y,62,1.0,e.dmg*1.15,'#ff9a2a',()=>addEHaz(x,y,48,2.5,e.dmg*0.24,'fire'));});}},
      // Eclipse: the sky burns; three moving shadows are the only safety
      {name:'Eclipse',w:2,cd:2,big:1,ph:1,fn(e){const S=[];for(let k=0;k<3;k++){const a=rand(0,TAU),r=rand(120,260);S.push({x:e.x+Math.cos(a)*r,y:e.y+Math.sin(a)*r,vx:rand(-40,40),vy:rand(-40,40)});}
        bigAttack(e,2.6,()=>{toast('Eclipse!','Hide in a shadow');G.fx.push({type:'eclipse',S,t:0,max:2.6,r:70});},()=>{const p=G.p;if(!p.dodge&&!S.some(s=>Math.hypot(p.x-s.x,p.y-s.y)<70+p.r*0.5))dmgPlayer(BIG(e)*1.3,e);
          G.shake=Math.max(G.shake,16);G.hitStop=0.1;fxExplosion(e.x,e.y,260,SUN_COL);},2.6);
        for(let i=0;i<26;i++)later(i*0.1,()=>{for(const s of S){s.x+=s.vx*0.1;s.y+=s.vy*0.1;}});}},
      // Gravity Well: a pull toward the sun, then a burst around it: run outward
      {name:'Gravity Well',w:2,cd:2,big:1,ph:2,fn(e){bigAttack(e,2.2,()=>{toast('Gravity Well!','Run against the pull');e.tele={r:150,col:'#ff6a1a'};e.pullT=2.2;},()=>{e.pullT=0;if(dist(e,G.p)<150+G.p.r&&!G.p.dodge)dmgPlayer(BIG(e)*1.5,e);
        G.shake=Math.max(G.shake,18);fxExplosion(e.x,e.y,180,'#ff6a1a');},2.25);}},
      {name:'Starfall',w:3,cd:1.6,ph:3,fn(e){e.busy=1;for(let i=0;i<10;i++)bossLater(e,i*0.15,()=>{const [x,y]=near(260);groundStrike(e,x,y,60,1.1,e.dmg*1.1,SUN_COL,()=>addEHaz(x,y,44,2.5,e.dmg*0.22,'fire'));});}}]}
};
// Gravity Well's pull (called from bossFrame through archTick).
function archTick(e,dt){if(e.pullT>0){e.pullT-=dt;const p=G.p,d=Math.hypot(e.x-p.x,e.y-p.y);if(d>20&&!p.dodge)moveEnt(p,(e.x-p.x)/d*110*dt,(e.y-p.y)/d*110*dt);}}
// A Citadel guardian or the Hollow Sun: an act boss built at this depth, then given its own life, damage and rules.
function makeArchBoss(key,x,y,depth){const A=ARCH[key],e=makeEnemy('boss',x,y,depth,false,'arch-'+key),B0=BOSSES[e.kind]||BOSSES[0];
  e.ab=key;e.hp=e.maxHp=e.maxHp/B0.hp*A.hp;e.dmg=e.dmg/B0.dmg*A.dmg;e.spd=e.spd/(B0.spd||1)*(A.spd||1);e.kind=A.look;e.name=A.name;e.elem=A.elem[0];e.elemS=A.elem[1];
  if(A.pinnacle){e.r*=1.15;e.col=SUN_COL;}return e;}
// ---------- the fights' places ----------
// A Citadel map: its guardian instead of a zone boss (zones.js genZone asks for it); the Hollow Sun: the crater.
const citadelOf=(c,node)=>{const g=atlasGraph(atlasOf(c).seed),cs=g.nodes.filter(n=>n.type==='citadel').map(n=>n.id);return FRAG_KEYS[cs.indexOf(node)]||null;};
function openSun(){const c=G.char;if(!mapsOpen(c)||!sunReady(c)||c.mapRun&&c.mapRun.lives>0&&!c.mapRun.done)return false;const F=fragsOf(c);for(const k of FRAG_KEYS)F[k]--;
  c.mapRun={sig:{id:++ITEM_ID,tier:15,rarity:0,mods:[]},src:'a5z5',pinnacle:true,boss:null,su:[],lives:mapLives(c),done:false,town:G.inTown?G.depth:c.depth<=25?c.depth:25};
  regMapZone(c.mapRun);if(c.zst)delete c.zst.map;closeMapDevice();startZone('map','boss');playSfx('portal');return true;}
// In the crater: the act boss arena's boss is replaced by the Hollow Sun.
function sunArena(){const b=G.enemies.find(e=>e.type==='boss');if(!b)return;const s=makeArchBoss('sun',b.x,b.y,G.depth);G.enemies.splice(G.enemies.indexOf(b),1,s);G.boss=s;}
// ---------- rewards ----------
// Pinnacle uniques (UNIQUES with boss:'sun': only the Hollow Sun drops them) and the Sunfire Crucible (currency.js).
function archDown(e){const c=G.char,A=ARCH[e.ab],r=c.mapRun;G.portal.active=true;if(r){zst(c,'map').boss=true;}
  const at=(dx=60)=>[e.x+rand(-dx,dx),e.y+rand(-dx,dx)],L=A.loot;
  for(let k=0;k<L.n;k++){const min=k<L.unique?3:k<L.unique+L.rare?2:1;dropItem(...at(),rollDrop(c,PD()+L.ilvl,3,min,{act:5,top:true}));}
  dropGold(e.x,e.y,PD()*L.gold*0.1);dropCurrency(e,'boss');dropCurrency(e,'boss');
  if(A.frag){const F=fragsOf(c);F[A.frag]++;toast(FRAGS[A.frag].name+'!',`${FRAGS[A.frag].boss} falls · ${FRAG_KEYS.filter(k=>F[k]>0).length}/3 fragments of the Hollow Sun`);}
  if(A.pinnacle){const ks=Object.keys(UNIQUES).filter(k=>UNIQUES[k].boss==='sun'&&(!UNIQUES[k].cls||UNIQUES[k].cls===c.cls)),k=pick(ks);
    if(k){const U=UNIQUES[k];dropItem(...at(),genItem(PD()+3,c.cls,3,U.type,3,U.wt,5,null,k));}
    const [x,y]=at();G.loot.push({x,y,cur:'star',t:0});const [x2,y2]=at();G.loot.push({x:x2,y:y2,cur:'crucible',t:0});
    const cats=CUR_KEYS.filter(q=>CURS[q].cat);for(let i=0;i<2;i++){const [a,b]=at();G.loot.push({x:a,y:b,cur:pick(cats),t:0});}
    const M=c.maps||(c.maps={done:0,best:0});M.sun=(M.sun||0)+1;toast('THE HOLLOW SUN IS EXTINGUISHED',`Victory ${M.sun}: its light is yours`);}
  if(r){r.done=true;if(!A.pinnacle)mapComplete(e);else saveChar();}
  G.shake=Math.max(G.shake,20);saveChar();}
// The fragment and Hollow Sun rows of the Map Device.
function sunRow(c){const F=fragsOf(c),ok=sunReady(c);return `<div class="pinfo"><b style="color:${SUN_COL}">☀ The Hollow Sun</b> <span class="fdim">${(c.maps&&c.maps.sun)?'defeated '+c.maps.sun+'×':'the pinnacle'}</span>
  <div>${FRAG_KEYS.map(k=>`<span style="color:${FRAGS[k].col}">${FRAGS[k].name} ×${F[k]}</span>`).join(' · ')}</div>
  <div class="fdim">Each Citadel's guardian (♜ on the Atlas, run a Sigil there) drops its fragment. One of each opens the crater.</div>
  <div class="row"><div class="btn sm${ok?'':' dis'}" id="sunGo">☀ Enter the crater</div></div></div>`;}
// ---------- looks ----------
// Eclipse: the sky burns orange; the three shadows (safe) drift.
function drawEclipse(f,u){ctx.save();ctx.globalAlpha=0.18+0.32*u;ctx.fillStyle='#ff7a2a';ctx.fillRect(G.cam.x-2000,G.cam.y-2000,4000,4000);ctx.globalAlpha=0.8;
  for(const s of f.S){ctx.fillStyle='#050302';ctx.beginPath();ctx.arc(s.x,s.y,f.r,0,TAU);ctx.fill();ctx.strokeStyle='#ffe0a0';ctx.lineWidth=2;ctx.stroke();}ctx.restore();}
// The Hollow Sun: the Cinder King's body inside a dark corona.
function sunPaint(x,r,f){const g=x.createRadialGradient(0,0,r*0.3,0,0,r*1.25);g.addColorStop(0,'rgba(20,10,4,.95)');g.addColorStop(0.7,'rgba(255,160,40,.55)');g.addColorStop(1,'rgba(255,120,20,0)');
  x.fillStyle=g;x.beginPath();x.arc(0,0,r*1.25,0,TAU);x.fill();BOSS_PAINT[4](x,r*0.92,f);x.fillStyle='rgba(10,5,2,.55)';x.beginPath();x.arc(r*0.05,0,r*0.35,0,TAU);x.fill();}
