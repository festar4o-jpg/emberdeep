'use strict';
// Town portal and zone instances.
// The HUD's 🌀 button (or T) casts a portal: 1 s, broken by any hit, refused while a boss fight is on (a boss bar is up).
// It opens where you stand and takes you to town; a return portal next to the stash leads back to that exact spot.
// Zone instances: a zone you leave by portal (or through a side passage) is kept as you left it: layout, map art,
// the living where they stood, the dead staying dead, everything on the ground, objectives, the explored map. Kept in
// memory and in localStorage (INST_KEY, per hero), so it survives closing the app. Only waypoint travel to another
// zone throws it away (a waypoint into the same zone goes back into it). A death respawns you inside the instance.
const INST_KEY='zinst_v1'; // not "emberdeep…": instances stay out of save backups (backup.js isBackupKey)
const TP_CAST=1,INST_MAX=4;
let INST={cid:null,z:{}}; // z[zid] = {live} (this session's objects) or {packed} (from storage)
// ---------- packing (typed arrays as run lengths, references as indexes, functions dropped) ----------
const rle=a=>{if(!a)return null;const o=[];let v=a[0],n=0;for(let i=0;i<a.length;i++){if(a[i]===v)n++;else{o.push(v,n);v=a[i];n=1;}}o.push(v,n);return o;};
const unrle=o=>{if(!o)return null;const a=new Uint8Array(MW*MH);let k=0;for(let i=0;i+1<o.length;i+=2){a.fill(o[i],k,k+o[i+1]);k+=o[i+1];}return a;};
const plain=v=>v===null||typeof v!=='object'||Array.isArray(v)||Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null;
const ENEMY_SKIP=new Set(['act','tele','lockA','_spr','_wd','_lunge']);
function packEnemies(list,feats){const alive=list.filter(e=>!e.dead),ix=new Map(alive.map((e,i)=>[e,i]));
  return alive.map(e=>{const o={};for(const k in e){const v=e[k];if(typeof v==='function'||ENEMY_SKIP.has(k))continue;
    if(v&&typeof v==='object'){if(k==='master'||k==='shieldOf'){o[k+'#']=ix.has(v)?ix.get(v):-1;continue;}if(k==='chest'){o['chest#']=feats.indexOf(v);continue;}if(!plain(v))continue;}
    o[k]=v;}return o;});}
function unpackEnemies(list,feats){for(const e of list){for(const k of ['master','shieldOf','chest']){const i=e[k+'#'];delete e[k+'#'];if(i==null||i<0)continue;e[k]=k==='chest'?feats[i]:list[i];}
  e.wind=0;e.busy=0;e.dash=0;e.act=null;}return list;}
const ZFEATS=['wp','hchest','seal','captive','key'];
function packFeats(fs){return fs.map(f=>{const o={};for(const k in f)if(typeof f[k]!=='function')o[k]=f[k];return o;});}
function unpackFeats(fs){for(const f of fs){if(ZFEATS.includes(f.kind)){f.use=FEAT_USE[f.kind];f.zdraw=FEAT_DRAW[f.kind];if(!f.use)delete f.use;}else if(f.kind==='ambush')f.zdraw=()=>{};}return fs;}
// ---------- snapshots ----------
function snapZone(){return {zid:G.zone,t:Date.now(),grid:G.grid,terrain:G.terrain,road:G.road,rooms:G.rooms,portal:G.portal,side:G.sidePortal,enemies:G.enemies,
  feats:G.feats,loot:G.loot.filter(l=>!l.taken),explored:G.explored,mapCv:G.mapCv,lights:G.lights,theme:G.zoneTheme,splats:G.splats||[],artSeed:G.artSeed,
  px:G.p.x,py:G.p.y,start:G.zStart,levelMode:G.levelMode,depth:G.depth};}
function packSnap(S){return {zid:S.zid,t:S.t,grid:rle(S.grid),terrain:rle(S.terrain),road:rle(S.road),rooms:S.rooms,portal:S.portal,side:S.side,
  enemies:packEnemies(S.enemies,S.feats),feats:packFeats(S.feats),loot:S.loot,explored:rle(S.explored),theme:S.theme,splats:(S.splats||[]).slice(-40),artSeed:S.artSeed,
  px:S.px,py:S.py,start:S.start,levelMode:S.levelMode,depth:S.depth};}
function unpackSnap(P){const feats=unpackFeats(P.feats||[]);
  return Object.assign({},P,{grid:unrle(P.grid),terrain:unrle(P.terrain),road:unrle(P.road),explored:unrle(P.explored),feats,enemies:unpackEnemies(P.enemies||[],feats),mapCv:null,lights:null});}
// ---------- the store ----------
function instLoad(c){INST={cid:c?c.id:null,z:{}};if(!c)return;
  try{const all=JSON.parse(localStorage.getItem(INST_KEY)||'{}'),mine=all&&all[c.id];if(mine&&typeof mine==='object')for(const zid in mine)if(ZONES[zid])INST.z[zid]={packed:mine[zid]};}catch(e){}}
function instStore(){const c=G.char;if(!c||INST.cid!==c.id)return;
  let all={};try{all=JSON.parse(localStorage.getItem(INST_KEY)||'{}')||{};}catch(e){all={};}
  for(const id in all)if(!SAVES.some(h=>h.id===id)&&id!==c.id)delete all[id]; // heroes deleted since
  const mine={};for(const zid in INST.z){const I=INST.z[zid];try{mine[zid]=I.packed||(I.packed=JSON.parse(JSON.stringify(packSnap(I.live))));}catch(e){}}
  if(Object.keys(mine).length)all[c.id]=mine;else delete all[c.id];
  try{localStorage.setItem(INST_KEY,JSON.stringify(all));}catch(e){ /* full: keep only the portal's zone */
    try{const tp=c.tp&&mine[c.tp.zid];all[c.id]=tp?{[c.tp.zid]:tp}:{};localStorage.setItem(INST_KEY,JSON.stringify(all));}catch(e2){}}}
const hasInstance=zid=>!!(INST.z[zid]&&INST.cid===(G.char&&G.char.id));
function clearInstances(){INST.z={};if(G.char)G.char.tp=null;instStore();}
// Keep the zone you are in (called on the way out: portal, Return to Town, side passage).
function saveInstance(){if(!G.zone||G.inTown||!G.grid||!G.char)return;if(INST.cid!==G.char.id)INST={cid:G.char.id,z:{}};
  INST.z[G.zone]={live:snapZone()};
  const ks=Object.keys(INST.z);if(ks.length>INST_MAX){const keep=new Set([G.zone,G.char.tp&&G.char.tp.zid,ZONES[G.zone].parent]);
    for(const k of ks.sort((a,b)=>(INST.z[a].live||INST.z[a].packed).t-(INST.z[b].live||INST.z[b].packed).t))if(Object.keys(INST.z).length>INST_MAX&&!keep.has(k))delete INST.z[k];}
  instStore();}
// Into a kept zone. mode: 'tp' (return portal: the spot you left), 'back' (from the side zone: at its passage),
// 'fresh' (waypoint: at the waypoint), else where you stood. Returns false when there is nothing kept to go back to.
function restoreInstance(zid,mode){const I=INST.z[zid];if(!I||!hasInstance(zid))return false;
  if(mode==='respawn'||mode==='boss'||mode==='noboss')return false;
  delete INST.z[zid];let C;try{C=I.live||unpackSnap(I.packed);}catch(e){instStore();return false;}
  Object.assign(G,{grid:C.grid,terrain:C.terrain,road:C.road,rooms:C.rooms,portal:C.portal,sidePortal:C.side,enemies:C.enemies,feats:C.feats,loot:C.loot,explored:C.explored,
    zoneTheme:C.theme,zStart:C.start,levelMode:C.levelMode||'all'});
  if(ZONES[zid].layout!=='boss')G.portal.active=G.portal.active||gateOpen(zid);
  G.zboss=G.enemies.find(e=>e.zb&&!e.dead)||null;G.boss=G.enemies.find(e=>e.type==='boss'&&!e.dead)||null;
  for(const e of G.enemies)if(!e.dead){e.aggro=false;e.wind=0;e.busy=0;e.act=null;e.tele=null;e.dash=0;}
  if(C.mapCv){G.mapCv=C.mapCv;G.lights=C.lights;G.artSeed=C.artSeed;}else renderMap(C.artSeed); // after an app restart: repaint the same art
  G.splats=C.splats||[];
  const c=G.char,wp=G.feats.find(f=>f.kind==='wp');
  const at=mode==='tp'&&c.tp&&c.tp.zid===zid?{x:c.tp.x,y:c.tp.y}:mode==='back'&&C.side?{x:C.side.x,y:C.side.y+60}:mode==='fresh'&&wp?{x:wp.x+50,y:wp.y+20}:{x:C.px,y:C.py};
  G.p.x=at.x;G.p.y=at.y;if(blockedAt(G.p.x,G.p.y,G.p.r)){G.p.x=C.px;G.p.y=C.py;}
  if(c.tp&&c.tp.zid===zid){G.tpField={x:c.tp.x,y:c.tp.y,t:G.time};c.tp=null;}
  G.flow=new Int16Array(MW*MH);G.flowTile=-1;instStore();return true;}
// ---------- casting ----------
function bossFightOn(){const b=G.boss&&!G.boss.dead?G.boss:G.zboss&&!G.zboss.dead?G.zboss:null;return !!(b&&b.aggro&&!G.p.dead);}
function castPortal(){const p=G.p;if(!G.char||!p||G.paused||p.dead||G.inTown||p.tpCast)return false;
  if(bossFightOn()){toast('No portal now','Not during a boss fight');return false;}
  p.tpCast={t:0};return true;}
function portalInterrupt(){const p=G.p;if(p&&p.tpCast){p.tpCast=null;floatText(p.x,p.y-44,'Interrupted','#ff9a6a',false);}}
// Off to town. Zones are kept for the return portal; the older depth levels are rebuilt on the way back.
function openPortal(){const p=G.p,c=G.char;burst(p.x,p.y,30,'#7ab8ff',220);
  if(G.zone&&ZONES[G.zone]){c.tp={zid:G.zone,x:Math.round(p.x),y:Math.round(p.y)};saveInstance();}else c.tp=null;
  startTown(G.depth);}
// Through the return portal in town.
function takePortalBack(){const c=G.char;if(!c.tp||!ZONES[c.tp.zid])return;startZone(c.tp.zid,'tp');}
function portalTick(dt){const p=G.p,C=p.tpCast;
  if(keys.KeyT&&!portalTick.key)castPortal();portalTick.key=!!keys.KeyT;
  if(C){if(p.dead||G.inTown||bossFightOn())p.tpCast=null;
    else{C.t+=dt;if(Math.random()<dt*30){const a=rand(0,TAU);G.parts.push({x:p.x+Math.cos(a)*26,y:p.y+Math.sin(a)*12,vx:-Math.cos(a)*20,vy:-40,life:0.5,max:0.5,col:'#8ac8ff',s:3});}
      if(C.t>=TP_CAST){p.tpCast=null;openPortal();return;}}}
  const T=G.tpBack;G.atTp=!!(G.inTown&&T&&!p.dead&&Math.hypot(p.x-T.x,p.y-T.y)<60);
  const b=$('tpBtn');b.classList.toggle('hidden',!!G.inTown);b.classList.toggle('locked',bossFightOn());
  b.querySelector('.cd').style.setProperty('--p',p.tpCast?1-p.tpCast.t/TP_CAST:0);}
// The return portal sits just below the stash (towns.js keeps the spot clear).
function placeTpBack(){const c=G.char;G.tpBack=G.inTown&&G.stash&&c.tp&&ZONES[c.tp.zid]&&hasInstance(c.tp.zid)?{x:G.stash.x,y:G.stash.y+3*TILE,zid:c.tp.zid}:null;}
// ---------- drawing ----------
function drawGate(x,y,col1,col2,ring,k){ctx.save();ctx.translate(x,y);ctx.globalAlpha=k;const g=ctx.createRadialGradient(0,0,4,0,0,40);g.addColorStop(0,col1);g.addColorStop(0.5,col2);g.addColorStop(1,'#0000');
  ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(0,-6,30,40,0,0,TAU);ctx.fill();ctx.strokeStyle=ring;ctx.lineWidth=3;for(let q=0;q<3;q++){ctx.beginPath();ctx.ellipse(0,-6,24-q*6,34-q*8,0,G.time*(2+q)+q,G.time*(2+q)+q+3.8);ctx.stroke();}ctx.restore();}
function drawPortals(onScreen){const p=G.p;
  const T=G.tpBack;if(G.inTown&&T&&onScreen(T.x,T.y,80)){drawGate(T.x,T.y,'#e0f0ff','#3a8cff99','#8ac8ff',1);lbl({x:T.x,y:T.y-18},'🌀 '+ZONES[T.zid].name,'#8ac8ff');}
  const F=G.tpField;if(!G.inTown&&F){const k=1-(G.time-F.t)/3;if(k<=0)G.tpField=null;else if(onScreen(F.x,F.y,80))drawGate(F.x,F.y,'#e0f0ff','#3a8cff99','#8ac8ff',k);}
  if(p&&p.tpCast){const k=p.tpCast.t/TP_CAST;ctx.save();ctx.strokeStyle='#8ac8ff';ctx.lineWidth=3;ctx.globalAlpha=0.5+0.5*k;ctx.beginPath();ctx.ellipse(p.x,p.y+4,26,12,0,-Math.PI/2,-Math.PI/2+TAU*k);ctx.stroke();ctx.restore();}}
$('tpBtn').addEventListener('touchstart',ev=>{ev.preventDefault();castPortal();},{passive:false});$('tpBtn').addEventListener('mousedown',()=>castPortal());
// Rising again in a zone: same instance, at its waypoint (once unlocked) or its entrance. The survivors calm down, heal
// and go back to where they first stood (a zone boss doesn't wait at the entrance); the dead stay dead, the loot stays.
function zoneRespawn(){const p=G.p,c=G.char,Z=ZONES[G.zone];
  p.dead=false;p.hp=G.stats.life;p.res=CLASSES[c.cls].res==='Fury'?20:G.stats.res;p.leap=null;p.dodge=null;p.spin=0;p.tpCast=null;p.cd=[0,0,0,0,0];p.slowT=0;p.burnT=0;p.dotAcc=0;
  p.potions=Math.max(p.potions,potFloor());
  G.proj=[];G.ehaz=[];G.hazards=[];G.delayed=[];G.fx=[];G.texts=[];G.bossIntro=null;
  for(const e of G.enemies)if(!e.dead){e.aggro=false;e.wind=0;e.busy=0;e.act=null;e.tele=null;e.dash=0;e.hp=e.maxHp;e.bleedT=0;e.burnT=0;e.stun=0;e.frozen=0;if(e.hx!=null&&!e.summoned){e.x=e.hx;e.y=e.hy;}}
  G.enemies=G.enemies.filter(e=>!e.summoned||e.dead); /* adds raised in the fight go away */
  const wp=G.feats.find(f=>f.kind==='wp'),at=wp&&hasWp(c,G.zone)?{x:wp.x+50,y:wp.y+20}:G.zStart||{x:p.x,y:p.y};
  p.x=at.x;p.y=at.y;if(blockedAt(p.x,p.y,p.r)&&G.zStart){p.x=G.zStart.x;p.y=G.zStart.y;}
  G.cam.x=p.x;G.cam.y=p.y;G.flowTile=-1;saveChar();setPause();toast(Z.name,'You rise again');}
// The town's main gate: into this act's zones (the last one you were in, else the act's first) or the next depth.
function townGateZone(){const z0=zoneOfDepth(G.depth),c=G.char;if(!z0)return null;return ZONES[c.zone]&&ZONES[c.zone].act===ZONES[z0].act?c.zone:z0;}
function townGateLabel(){const z=townGateZone();return z?`⬇ ${ZONES[z].name}`:`⬇ Enter Depth ${G.depth}`;}
