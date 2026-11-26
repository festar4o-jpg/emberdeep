'use strict';
// v1.0.143: painted monsters (2.5D step 4, Act 1). Pre-rendered monsters from the free ARPG Flare (CC-BY-SA 3.0,
// art/mon/CREDITS.txt), built into art/mon/ by tools/hero-art/build-mon.js: the Ghoul (Flare's zombie), the Bone
// Archer (skeleton archer), the Minotaur and the Act 1 boss Varrok (skeleton knight). Other monsters keep their drawn
// look until their act is painted. With the angled camera only; Settings › Monsters: Painted or Drawn.
// A monster stands, runs, winds up and strikes (or shoots or casts), flinches when hit and falls when it dies,
// following what the game already does (e.wind, e.flash, movement): gameplay never changes. Its sheets load the first
// time one is seen (the service worker keeps them, sw.js ART); until then it is drawn as before.
const MA={idx:null,want:false,img:{}};
const MA_BASE='art/mon/';
const maOn=()=>SETTINGS.mons!=='drawn'&&typeof Image!=='undefined'&&typeof fetch==='function';
function maLoadIndex(){if(MA.want)return;MA.want=true;fetch(MA_BASE+'mon.json').then(r=>r.ok?r.json():null).then(j=>{if(j&&j.mons)MA.idx=j;}).catch(()=>{MA.want=false;});}
// Which painted monster an enemy is, or null: the Act 1 boss, and the monster types that have art (zone bosses and
// champions of those types too); act bosses by act (boss0 = Act 1). Pinnacle bosses keep their own looks.
function maKey(e){if(e.type==='boss'){const k='boss'+e.kind;return typeof e.kind==='number'&&!e.zb&&!e.ab&&MA.idx.mons[k]?k:null;}return MA.idx.mons[e.type]?e.type:null;} // act bosses: boss0..boss4
function maSheet(key,s){const n=key+(s?'-'+s:'');let im=MA.img[n];if(!im){im=MA.img[n]=new Image();im.decoding='async';im.src=MA_BASE+n+'.webp';}return im.complete&&im.naturalWidth?im:null;}
// The painted monster for e when all its sheets are in, else null (and the loading starts).
function maReady(e){if(!maOn())return null;maLoadIndex();if(!MA.idx)return null;const key=maKey(e);if(!key)return null;
  const M=MA.idx.mons[key];let ok=true;for(let s=0;s<M.sheets;s++)if(!maSheet(key,s))ok=false;return ok?key:null;}
// Its size: the art's own scale, grown with the monster (elites and champions are bigger).
// MA_SIZE: all painted monsters a touch smaller than built (v1.0.144: they felt too big for the dungeons).
const MA_SIZE=0.85;
function maScale(e,M){const T=ETYPES[e.type];return M.draw*MA_SIZE*(T&&T.r?e.r/T.r:1);}
const maDir=a=>((Math.round(a/(Math.PI/4))+4)%8+8)%8;
// The animation and frame for what the monster is doing now.
function maPose(e,M){const t=G.time,A=M.a,strike=A.swing?'swing':A.shoot?'shoot':'cast';
  const dx=e.x-(e._mx??e.x),dy=e.y-(e._my??e.y),mv=Math.hypot(dx,dy);e._mx=e.x;e._my=e.y;
  if(mv>0.05){e._mrun=((e._mrun||0)+mv/(M.top*M.draw*1.6))%1;e._mhs=0.2;}else e._mhs=Math.max(0,(e._mhs||0)-1/60);
  // a wind-up (e.wind) plays the first half of the attack and the blow the second; a shot without one (eShoot marks
  // e._lunge) plays all of it. Boss spells (a wind-up with a ground mark) cast instead of swinging.
  if(e.wind>0&&!(e._mw>0)){e._mw0=e.wind;e._man=e.type==='boss'&&e.tele&&A.cast?'cast':strike;}
  if(!(e.wind>0)&&e._mw>0)e._mstr=t;e._mw=e.wind||0;
  const half=n=>Math.max(1,Math.floor(n/2)),an=e._man||strike;
  if(e.wind>0){const n=A[an].n,u=1-e.wind/(e._mw0||e.wind);return [an,Math.min(half(n)-1,Math.floor(u*half(n)))];}
  const sw=(t-(e._mstr??-9))/0.3,sh=(t-(e._lunge??-9))/0.35;
  if(sw>=0&&sw<1){const n=A[an].n;return [an,Math.min(n-1,half(n)+Math.floor(sw*(n-half(n))))];}
  if(sh>=0&&sh<1){const n=A[strike].n;return [strike,Math.min(n-1,Math.floor(sh*n))];}
  if(e._mhid){e._mhid=0;e._memerge=t;} // render.js: it was under the sand until now
  const em=(t-(e._memerge??-9))/0.6;if(em>=0&&em<1&&A.spawn)return ['spawn',Math.min(A.spawn.n-1,Math.floor(em*A.spawn.n))]; // bursting up out of the sand
  if(e.flash>0&&A.hit)return ['hit',e.flash>0.05?0:Math.min(1,A.hit.n-1)];
  if(e.stun>0||e.frozen>0)return ['stance',0];
  if(e._mhs>0&&A.run)return ['run',Math.floor(e._mrun*A.run.n)%A.run.n];
  const a=A.stance,n=a.n,k=Math.floor((t+(e.seed||0))*1000/a.ms*n)%(2*n-2);return ['stance',k<n?k:2*n-2-k];}
// Draws e (feet at e.x, e.y inside the upright frame) and returns the screen y of its head, or false to draw it as before.
function drawMonArt(e,T){const key=maReady(e);if(!key)return false;const M=MA.idx.mons[key];
  const [an,fi]=maPose(e,M),fr=M.a[an].f[maDir(e.face)][fi];if(!fr)return false;
  let k=maScale(e,M);if(e.introT>0){const u=1-e.introT/2.4;k*=0.55+0.45*Math.min(1,u*1.6);ctx.globalAlpha=Math.min(1,u*2);} // a boss rising for its entrance
  const img=maSheet(key,fr[6]),id=key+'-'+fr[6],x=e.x-fr[4]*k,y=e.y-fr[5]*k,w=fr[2]*k,h=fr[3]*k;
  ctx.drawImage(img,fr[0],fr[1],fr[2],fr[3],x,y,w,h);ctx.globalAlpha=1;
  const glow=(col,a)=>{ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=a;const c=artVariant(img,id,fr,'glow',col);ctx.drawImage(c,0,0,c.width,c.height,x,y,w,h);ctx.restore();};
  if(e.flash>0)glow('#fff8f0',Math.min(1,e.flash/0.1)*0.7); // a brief white hit flash
  else if(e.wind>0&&Math.floor(G.time*20)%2===0)glow('#ff4a1e',0.45); // winding up: flickers red
  if(e.frozen>0)glow('#8fd0ff',0.35);
  if(e.type==='boss'&&e.phase)glow(`rgb(${BOSS_LIGHT[e.kind||0]})`,0.12+Math.sin(G.time*6)*0.06);
  return e.y-M.top*k;}
// Death: the monster's own fall, then it lies there and fades (sprites.js drawCorpses).
function monArtCorpse(e){const key=maReady(e);if(!key)return null;const M=MA.idx.mons[key];
  return {type:'corpse',art:key,x:e.x,y:e.y,d:maDir(e.face),k:maScale(e,M),t:0,max:e.type==='boss'?5:3,boss:e.type==='boss'};}
function drawArtCorpse(f){const M=MA.idx&&MA.idx.mons[f.art];if(!M||!M.a.die)return;const a=M.a.die,fi=Math.min(a.n-1,Math.floor(f.t*1000/a.ms*a.n)),fr=a.f[f.d][fi];if(!fr)return;
  const img=maSheet(f.art,fr[6]);if(!img)return;upr(f.x,f.y);ctx.globalAlpha=Math.min(1,(f.max-f.t)/1.2);
  ctx.drawImage(img,fr[0],fr[1],fr[2],fr[3],f.x-fr[4]*f.k,f.y-fr[5]*f.k,fr[2]*f.k,fr[3]*f.k);ctx.globalAlpha=1;ctx.restore();}
