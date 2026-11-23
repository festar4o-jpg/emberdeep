'use strict';
// Effects: glowing projectiles and sparks, kill stains on the floor, and drifting motes in the dungeon air.
// Everything bright is drawn additively ('lighter') from pre-rendered sprites (a white-hot core fading into the
// colour); dull particles (blood, dust, bone) stay plain and dark so only real light glows.
const SPARK={},HOT={};
function sparkSprite(rgb){let c=SPARK[rgb];if(c)return c;const S=48;c=mkCanvas(S,S);const x=c.getContext('2d'),g=x.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
  g.addColorStop(0,'rgba(255,255,245,1)');g.addColorStop(0.18,`rgba(${rgb},0.95)`);g.addColorStop(0.45,`rgba(${rgb},0.35)`);g.addColorStop(1,`rgba(${rgb},0)`);x.fillStyle=g;x.fillRect(0,0,S,S);return SPARK[rgb]=c;}
// Bright, coloured particles glow; dark or dull ones (blood, dust, bone) don't.
function isHot(col){let h=HOT[col];if(h!=null)return h;const [r,g,b]=rgbOf(col).split(',').map(Number),mx=Math.max(r,g,b),mn=Math.min(r,g,b);return HOT[col]=mx>=235||(mx>=200&&mx-mn>=90);}
// Projectiles: a short fading tail and a hot core.
function drawProjectiles(){if(!G.proj.length)return;ctx.globalCompositeOperation='lighter';
  for(const q of G.proj){projTrail(q);const S=sparkSprite(rgbOf(q.col)),R=q.r*3.2;
    for(let k=3;k>=1;k--){const r=R*(1-k*0.2);ctx.globalAlpha=0.35-k*0.07;ctx.drawImage(S,q.x-q.vx*0.014*k-r,q.y-q.vy*0.014*k-r,r*2,r*2);}
    ctx.globalAlpha=1;ctx.drawImage(S,q.x-R,q.y-R,R*2,R*2);}
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;}
// Particles: dull ones as small dark flecks, hot ones as additive sparks.
function drawParticles(){const P=G.parts;if(!P.length)return;
  for(const q of P){if(isHot(q.col))continue;const a=Math.max(0,q.life/q.max);
    if(q.soft){const r=q.s*(1.6-a*0.6);ctx.globalAlpha=a*0.32;ctx.drawImage(falloff(rgbOf(q.col)),q.x-r,q.y-r,r*2,r*2);continue;} // dust and smoke: soft, spreading
    ctx.globalAlpha=a;ctx.fillStyle=q.col;ctx.fillRect(q.x-q.s/2,q.y-q.s/2,q.s,q.s);}
  ctx.globalCompositeOperation='lighter';
  for(const q of P){if(!isHot(q.col))continue;const a=Math.max(0,q.life/q.max),r=q.s*2.2;ctx.globalAlpha=a;ctx.drawImage(sparkSprite(rgbOf(q.col)),q.x-r,q.y-r,r*2,r*2);}
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;}
// ---------- kill stains ----------
// What a creature leaves on the floor when it dies: [colour, flecks colour, size].
const STAIN={archer:['rgba(150,140,115,.35)','rgba(200,190,160,.6)',0.8],scarab:['rgba(30,50,40,.45)','rgba(60,90,70,.6)',0.9],dustmage:['rgba(70,10,6,.4)','rgba(90,15,8,.6)',1],
  sporetoad:['rgba(90,110,30,.4)','rgba(150,170,60,.55)',1.1],vinelasher:['rgba(40,60,20,.45)','rgba(70,100,30,.6)',1],frostwraith:['rgba(150,190,230,.25)','rgba(210,235,255,.6)',0.8],
  icegolem:['rgba(150,190,230,.25)','rgba(220,240,255,.7)',1],shardling:['rgba(150,190,230,.25)','rgba(220,240,255,.7)',0.8],magmabrute:['rgba(10,4,2,.6)','rgba(255,110,30,.6)',1.1],
  imp:['rgba(20,6,2,.5)','rgba(140,30,10,.6)',0.8]};
// Painted straight into the map canvas (so it costs nothing afterwards) with the creature's own seed:
// no gameplay random numbers are used.
function stainFloor(e){const cv=G.mapCv;if(!cv||!cv.getContext||G.inTown)return;const x=cv.getContext('2d');if(!x||!x.beginPath)return;
  const [c1,c2,k]=STAIN[e.type]||['rgba(70,8,4,.42)','rgba(90,12,6,.6)',1],rnd=artRng(Math.floor((e.seed||1)*1e6)),R=e.r*k*(e.type==='boss'?1.4:1);
  x.save();x.fillStyle=c1;x.beginPath();x.ellipse(e.x,e.y+e.r*0.3,R*1.1,R*0.75,rnd()*3,0,TAU);x.fill();
  x.fillStyle=c2;for(let n=0;n<10;n++){const a=rnd()*TAU,d=R*(0.6+rnd()*1.2);x.beginPath();x.arc(e.x+Math.cos(a)*d,e.y+e.r*0.3+Math.sin(a)*d*0.7,0.8+rnd()*2.2,0,TAU);x.fill();}x.restore();}
// ---------- fog ----------
// Two layers of soft mist drifting at different speeds and scales (parallax), tinted per act and drawn before the
// light map, so the fog is only seen where light falls on it. One noise texture, built once, tinted once per act.
const FOG={crypt:['150,175,130',0.22],desert:['205,175,125',0.1],marsh:['140,170,195',0.2],citadel:['205,225,245',0.2],ember:['90,45,35',0.26]};
let FOG_TEX=null;const FOG_TINT={};
function fogTex(rgb){if(FOG_TINT[rgb])return FOG_TINT[rgb];if(!FOG_TEX){const S=128,c=mkCanvas(S,S),x=c.getContext('2d'),img=x.createImageData(S,S),v=new Float32Array(S*S),rnd=artRng(4242);
    for(const [cell,amp] of [[32,0.6],[16,0.28],[8,0.12]]){const n=S/cell,R=new Float32Array(n*n).map(()=>rnd());
      for(let j=0;j<S;j++)for(let i=0;i<S;i++){const fx=i/cell,fy=j/cell,ix=fx|0,iy=fy|0,tx=fx-ix,ty=fy-iy,sx=tx*tx*(3-2*tx),sy=ty*ty*(3-2*ty),a=R[iy%n*n+ix%n],b=R[iy%n*n+(ix+1)%n],cc=R[(iy+1)%n*n+ix%n],d=R[(iy+1)%n*n+(ix+1)%n];
        v[j*S+i]+=amp*(a+(b-a)*sx+(cc-a)*sy+(a-b-cc+d)*sx*sy);}}
    for(let k=0;k<S*S;k++){const a=Math.max(0,Math.min(1,(v[k]-0.35)/0.45));img.data[k*4]=img.data[k*4+1]=img.data[k*4+2]=255;img.data[k*4+3]=a*a*(3-2*a)*255|0;}x.putImageData(img,0,0);FOG_TEX=c;}
  const c=mkCanvas(FOG_TEX.width,FOG_TEX.height),x=c.getContext('2d');x.drawImage(FOG_TEX,0,0);x.globalCompositeOperation='source-in';x.fillStyle=`rgb(${rgb})`;x.fillRect(0,0,c.width,c.height);return FOG_TINT[rgb]=c;}
// Screen space (ctx transform = DPR): each layer is a handful of stretched tiles.
function drawFog(){if(G.inTown||!G.p)return;const F=FOG[ACTS[actIdx(G.depth)].gen];if(!F)return;const tex=fogTex(F[0]),t=G.time;
  // both layers are painted into a small canvas (the light map's resolution: fog is soft anyway), then stretched over the screen once
  const R=LIGHT_RES,w=Math.ceil(CW*R),h=Math.ceil(CH*R);if(!FOGC){FOGC=mkCanvas(w,h);FOGX=FOGC.getContext('2d');}else if(FOGC.width!==w||FOGC.height!==h){FOGC.width=w;FOGC.height=h;}
  const X=FOGX,pat=tex.pat||(tex.pat=X.createPattern(tex,'repeat')); // a repeating pattern tiles without seams
  X.setTransform(1,0,0,1,0,0);X.globalAlpha=1;X.clearRect(0,0,w,h);
  for(const [sc,vx,vy,par,al] of [[5.5,9,3,1,F[1]],[3.4,-14,5,1.25,F[1]*0.7]]){const k=sc*Z*R,T=128*k,ox=-(((G.cam.x*par+t*vx)*Z*R)%T+T)%T,oy=-(((G.cam.y*par+t*vy)*Z*R)%T+T)%T;
    X.setTransform(k,0,0,k,ox,oy);X.globalAlpha=al;X.fillStyle=pat;X.fillRect(0,0,(w-ox)/k+1,(h-oy)/k+1);}
  ctx.drawImage(FOGC,0,0,w,h,0,0,w/R,h/R);}
let FOGC=null,FOGX=null;
// ---------- dungeon air ----------
// A few dozen motes drift through the light: dust in the crypts and wastes, spores in the marsh, snow in the
// citadel, embers in the core. Screen-space and wrapped, so they cost the same anywhere on the map.
const AIR={crypt:['190,205,170',0.28,-4,6,1.4],desert:['220,190,140',0.3,14,4,1.5],marsh:['170,200,225',0.35,-3,-6,1.6],citadel:['235,245,255',0.55,-6,22,1.8],ember:['255,130,40',0.8,4,-26,1.6]};
let airT=0;const airP=[],airRnd=artRng(9137); // its own random numbers: drawing never shifts gameplay rolls
function drawAir(){if(G.inTown||!G.p)return;const A=AIR[ACTS[actIdx(G.depth)].gen];if(!A)return;const dt=Math.min(0.05,Math.max(0,G.time-airT));airT=G.time;
  const w=CW/Z,h=CH/Z,x0=G.cam.x-w/2,y0=G.cam.y-h/2,N=36;
  while(airP.length<N)airP.push({x:airRnd()*w,y:airRnd()*h,s:0.5+airRnd(),p:airRnd()*TAU});
  const S=sparkSprite(A[0]);ctx.globalCompositeOperation='lighter';
  for(const m of airP){m.x=(m.x+(A[2]+Math.sin(G.time*0.7+m.p)*5)*m.s*dt+w)%w;m.y=(m.y+A[3]*m.s*dt+h)%h;
    const r=A[4]*m.s*2.4;ctx.globalAlpha=A[1]*(0.5+0.5*Math.sin(G.time*1.3+m.p));ctx.drawImage(S,x0+m.x-r,y0+m.y-r,r*2,r*2);}
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;}
// ---------- loot ----------
// Light beam over rare and better drops: a soft column, brightest at the floor, fading upward (one sprite per colour).
const BEAM={};
function beamSprite(rgb){let c=BEAM[rgb];if(c)return c;const W=32,H=256;c=mkCanvas(W,H);const x=c.getContext('2d');
  const h=x.createLinearGradient(0,0,W,0);h.addColorStop(0,`rgba(${rgb},0)`);h.addColorStop(0.5,`rgba(${rgb},1)`);h.addColorStop(1,`rgba(${rgb},0)`);x.fillStyle=h;x.fillRect(0,0,W,H);
  x.fillStyle='rgba(255,255,255,.9)';x.fillRect(W/2-1.5,0,3,H); // hot core
  x.globalCompositeOperation='destination-in';const v=x.createLinearGradient(0,0,0,H);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(0.6,'rgba(0,0,0,.45)');v.addColorStop(1,'rgba(0,0,0,1)');x.fillStyle=v;x.fillRect(0,0,W,H);return BEAM[rgb]=c;}
function drawBeam(l,col,big){const rgb=rgbOf(col),named=l.item&&(l.item.rarity===3||l.item.rarity===5),H=named?330:big?200:125,W=named?34:big?26:18,pu=0.75+0.25*Math.sin(G.time*2.4+l.x);ctx.globalCompositeOperation='lighter';
  ctx.globalAlpha=(big?0.7:0.55)*pu;ctx.drawImage(beamSprite(rgb),l.x-W/2,l.y-H,W,H);
  if(named){ctx.globalAlpha=0.35*pu;ctx.drawImage(beamSprite('255,255,255'),l.x-W/6,l.y-H*0.9,W/3,H*0.9); // white-hot core
    // a slowly turning ring of light on the ground, and a bright flare for the first seconds after the drop
    const age=G.time-(l.born??-9);ctx.save();ctx.translate(l.x,l.y+4);ctx.scale(1,0.4);ctx.strokeStyle=col;ctx.lineWidth=3;
    for(let k=0;k<3;k++){const a0=G.time*1.6+k*TAU/3;ctx.globalAlpha=0.55*pu;ctx.beginPath();ctx.arc(0,0,30,a0,a0+1.3);ctx.stroke();}
    if(age<2.5){const f=1-age/2.5;ctx.globalAlpha=0.9*f;ctx.drawImage(falloff(rgb),-110*f-30,-110*f-30,(110*f+30)*2,(110*f+30)*2);}ctx.restore();}
  ctx.globalAlpha=0.6*pu;ctx.save();ctx.translate(l.x,l.y+4);ctx.scale(1,0.4);const R=named?44:big?34:24;ctx.drawImage(falloff(rgb),-R,-R,R*2,R*2);ctx.restore();
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;}
// The moment a good item hits the ground: rares give a small golden spark; set items and uniques a burst of light,
// a shockwave, a shake and a call-out over the item (the sound is in sfx.js dropSfx).
function dropFlash(l){const it=l.item;if(!it||it.rarity<2)return;const col=RCOL[it.rarity];l.born=G.time;buzz(it.rarity===3?'unique':it.rarity===5?'set':'rare');
  if(it.rarity===2){burst(l.x,l.y,10,col,120);return;}
  if(it.rarity===3||it.rarity===5){burst(l.x,l.y,34,col,260);burst(l.x,l.y,14,'#ffffff',180);
    G.fx.push({type:'ring',x:l.x,y:l.y,r0:10,r1:150,t:0,max:0.6,col});G.fx.push({type:'ring',x:l.x,y:l.y,r0:4,r1:90,t:0,max:0.45,col:'#ffffff'});
    G.shake=Math.max(G.shake||0,6);floatText(l.x,l.y-50,it.rarity===3?'UNIQUE!':'SET ITEM!',col,true);}}
// PoE-style ground label: text in a dark box edged in the item's colour (normal items: a plain grey edge).
// Labels that would overlap one already drawn this frame stack upward instead (LABELS is reset by render()).
const LABELS=[];
function lootLabel(x,y,txt,col,edge,tag,tagCol,small){ctx.font=small?'10px sans-serif':'11px sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';
  const w=ctx.measureText(txt).width,tw=tag?ctx.measureText(' '+tag).width:0,W=w+tw+10,H=small?14:16,x0=x-W/2;
  for(let k=0;k<8&&LABELS.some(r=>x0<r[0]+r[2]&&x0+W>r[0]&&y-H/2<r[1]+r[3]&&y+H/2>r[1]);k++)y-=H+1;LABELS.push([x0,y-H/2,W,H]);const y0=y-H/2;
  ctx.fillStyle='rgba(6,4,3,.84)';ctx.fillRect(x0,y0,W,H);ctx.strokeStyle=edge;ctx.lineWidth=1;ctx.strokeRect(x0+0.5,y0+0.5,W-1,H-1);
  ctx.fillStyle=col;ctx.fillText(txt,x0+5,y+0.5);if(tag){ctx.fillStyle=tagCol;ctx.fillText(' '+tag,x0+5+w,y+0.5);}ctx.textAlign='center';ctx.textBaseline='alphabetic';}
// ---------- combat feel ----------
// Cosmetic randomness has its own generator: effects never shift gameplay rolls (or the seeded tests).
const fxRnd=artRng(77177),fr=(a,b)=>a+fxRnd()*(b-a);
// What comes off a creature when it is struck, by material.
const MAT_OF={archer:'bone',scarab:'chitin',vinelasher:'sap',sporetoad:'sap',icegolem:'ice',shardling:'ice',frostwraith:'ice',magmabrute:'magma'};
const matOf=e=>e.type==='boss'?['armor','armor','sap','ice','magma'][e.kind||0]:MAT_OF[e.type]||'flesh';
const MAT={flesh:{blood:'#5e0a06',spray:'#8a1410'},bone:{spray:'#b8ae90',sparks:0.3,sparkCol:'#fff0d0',dust:1},chitin:{blood:'#2a4224',spray:'#4a6a3a'},sap:{blood:'#34501a',spray:'#6a8a2a'},
  ice:{spray:'#dff4ff',sparks:0.7,sparkCol:'#bfe8ff'},magma:{blood:'#140604',spray:'#ff7a2a',sparks:1,sparkCol:'#ffb040'},armor:{blood:'#4e0a06',spray:'#7a1410',sparks:1}};
function part(x,y,vx,vy,life,col,s,extra){if(G.parts.length>420)return;const q={x,y,vx,vy,life,max:life,col,s};if(extra)Object.assign(q,extra);G.parts.push(q);}
// Struck: a spray along the blow, sparks off armour, bone and ice, a splat that lingers on the floor; heavy blows
// (crits, two-handers, big chunks of life) also freeze the action for a few frames (hit-stop) and shake the screen.
function hitFeel(e,d,crit,opts){if(opts&&opts.dot)return;const M=MAT[matOf(e)],p=G.p,a=Math.atan2(e.y-p.y,e.x-p.x),heavy=!!(crit||(opts&&opts.kb>=95)||d>=e.maxHp*0.25);
  const ox=e.x-Math.cos(a)*e.r*0.4,oy=e.y-Math.sin(a)*e.r*0.4;
  for(let k=0;k<(heavy?9:5);k++){const b=a+fr(-0.7,0.7),v=fr(60,200)*(heavy?1.3:1);part(ox,oy,Math.cos(b)*v,Math.sin(b)*v,fr(0.25,0.5),M.spray,fr(1.5,3));}
  const sp=M.sparks||(e.elite||e.shieldT>0?0.5:0);
  for(let k=0;k<(sp?Math.round((heavy?8:4)*sp)+1:0);k++){const b=a+Math.PI+fr(-1.2,1.2),v=fr(150,340);part(ox,oy,Math.cos(b)*v,Math.sin(b)*v,fr(0.12,0.28),M.sparkCol||'#ffe0a0',fr(1.2,2.2));}
  if(M.dust)dustPuff(e.x,e.y,e.r*0.6,3);
  if(M.blood&&fxRnd()<0.75)splat(e.x+Math.cos(a)*fr(4,e.r*1.4),e.y+Math.sin(a)*fr(4,e.r*1.2),fr(3,6)*(heavy?1.5:1),M.blood);
  if(heavy){G.hitStop=Math.max(G.hitStop||0,crit?0.06:0.045);G.shake=Math.max(G.shake,crit?5:3);}if(crit)buzz('crit');}
// Dust kicked up by impacts: soft, slow, spreading puffs.
function dustPuff(x,y,r,n,col){for(let k=0;k<n;k++){const a=fr(0,TAU),v=fr(15,60);part(x+Math.cos(a)*r*fr(0.3,1),y+Math.sin(a)*r*fr(0.3,1)*0.6,Math.cos(a)*v,Math.sin(a)*v*0.6-8,fr(0.6,1.1),col||'#6e604c',fr(6,11),{soft:1});}}
// ---------- blood on the floor ----------
// Splats from hits stay a few seconds and fade (kills leave a permanent stain, see stainFloor).
function splat(x,y,r,col){const S=G.splats||(G.splats=[]);if(S.length>90)S.shift();const dots=[];for(let k=0;k<6;k++){const a=fr(0,TAU),d=r*fr(1,2.6);dots.push([Math.cos(a)*d,Math.sin(a)*d*0.7,fr(0.6,1.8)]);}
  S.push({x,y,r,col,b:G.time,max:6,rot:fr(0,3),dots});}
function drawSplats(){const S=G.splats;if(!S||!S.length)return;let n=0;
  for(const s of S){const age=G.time-s.b;if(age>s.max||age<0)continue;S[n++]=s;ctx.globalAlpha=Math.min(1,(s.max-age)/2)*0.85;ctx.fillStyle=s.col;
    ctx.beginPath();ctx.ellipse(s.x,s.y,s.r,s.r*0.65,s.rot,0,TAU);ctx.fill();for(const [dx,dy,r] of s.dots){ctx.beginPath();ctx.arc(s.x+dx,s.y+dy,r,0,TAU);ctx.fill();}}
  S.length=n;ctx.globalAlpha=1;}
// ---------- deaths ----------
// Small, brittle or volatile things burst apart; everything else collapses (sprites.js addCorpse) and fades later.
const BURSTS={scarab:1,shardling:1,imp:1,frostwraith:1,sporetoad:1};
function deathBurst(e){const M=MAT[matOf(e)],hot=e.type==='imp';
  for(let k=0;k<(e.r>14?26:16);k++){const a=fr(0,TAU),v=fr(80,260);part(e.x,e.y,Math.cos(a)*v,Math.sin(a)*v,fr(0.35,0.8),k%3===0&&M.sparkCol?M.sparkCol:hot&&k%2?'#ffb040':M.spray,fr(2,4.5));}
  if(M.blood)for(let k=0;k<3;k++)splat(e.x+fr(-e.r,e.r),e.y+fr(-e.r,e.r)*0.7,fr(4,8),M.blood);
  dustPuff(e.x,e.y,e.r,e.type==='sporetoad'?6:3,e.type==='sporetoad'?'#7a8a3a':e.type==='frostwraith'?'#a8c0d8':'#5e5244');
  G.fx.push({type:'ring',x:e.x,y:e.y,r0:e.r*0.5,r1:e.r*2.2,t:0,max:0.22,col:M.sparkCol||M.spray});}
// ---------- skill effects ----------
// Elements by colour: fire, ice, chaos (violet), nature (green), storm (cyan); used for trails and explosions.
function elementOf(col){const [r,g,b]=rgbOf(col).split(',').map(Number);if(r>200&&g<190&&b<120)return 'fire';if(b>200&&r<200&&g>200)return r<140&&g<230?'storm':'ice';if(r>150&&b>200&&g<160)return 'chaos';if(g>200&&r<160&&b<120)return 'nature';return null;}
const TRAIL={fire:[['#ffb040',0.7,1],['#2a1a12',0.35,0]],ice:[['#dff4ff',0.5,1]],chaos:[['#c48bff',0.6,1],['#1a0a24',0.25,0]],nature:[['#a8e060',0.45,1]],storm:[['#bff4ff',0.55,1]]};
// Projectiles shed embers, frost glints or wisps as they fly.
function projTrail(q){const el=q._el!==undefined?q._el:(q._el=elementOf(q.col));const T=el&&TRAIL[el];if(!T)return;
  for(const [col,ch,hot] of T)if(fxRnd()<ch){const a=fr(0,TAU),v=fr(5,30);part(q.x+fr(-q.r,q.r)*0.6,q.y+fr(-q.r,q.r)*0.6,Math.cos(a)*v-q.vx*0.08,Math.sin(a)*v-q.vy*0.08,hot?fr(0.2,0.45):fr(0.5,0.9),col,hot?fr(1.2,2.4):fr(5,9),hot?null:{soft:1});}}
// Explosion: a white-hot flash, a swelling fireball, a ring of smoke and flying embers (and light, see light.js).
function fxExplosion(x,y,r,col){col=col||'#ff8a2a';G.fx.push({type:'boom',x,y,r,t:0,max:0.55,col});
  for(let k=0;k<22;k++){const a=fr(0,TAU),v=fr(100,320);part(x,y,Math.cos(a)*v,Math.sin(a)*v,fr(0.3,0.7),k%2?col:'#ffe0a0',fr(1.5,3));}dustPuff(x,y,r*0.5,6,'#3a2a20');}
// Ground torn open (Earthshatter, Leap Slam): dark cracks glowing from inside, fading out.
function fxCracks(x,y,r,col){const L=[];for(let k=0;k<9;k++){let a=k/9*TAU+fr(-0.2,0.2),px=0,py=0;const pts=[[0,0]];for(let s=0;s<4;s++){a+=fr(-0.4,0.4);const d=r*fr(0.18,0.3);px+=Math.cos(a)*d;py+=Math.sin(a)*d;pts.push([px,py]);}L.push(pts);}
  G.fx.push({type:'cracks',x,y,r,L,t:0,max:1.6,col:col||'#ff7a2a'});dustPuff(x,y,r*0.6,10);}
function drawSkillFx(f,t){
  if(f.type==='boom'){const k=1-t,R=f.r*(0.45+0.75*Math.sqrt(t));ctx.globalCompositeOperation='lighter';
    if(t<0.25){ctx.globalAlpha=(1-t/0.25);const W=f.r*0.9;ctx.drawImage(sparkSprite('255,250,235'),f.x-W,f.y-W,W*2,W*2);}
    ctx.globalAlpha=k*0.9;ctx.drawImage(falloff(rgbOf(f.col)),f.x-R,f.y-R,R*2,R*2);ctx.globalCompositeOperation='source-over';
    ctx.strokeStyle=`rgba(30,20,14,${0.5*k})`;ctx.lineWidth=10*k+2;ctx.beginPath();ctx.arc(f.x,f.y,R*0.95,0,TAU);ctx.stroke();ctx.globalAlpha=1;}
  else if(f.type==='cracks'){const k=t<0.1?t/0.1:1-(t-0.1)/0.9;ctx.lineCap='round';
    for(const pts of f.L){ctx.beginPath();pts.forEach(([a,b],i)=>i?ctx.lineTo(f.x+a,f.y+b):ctx.moveTo(f.x+a,f.y+b));ctx.strokeStyle=`rgba(10,6,4,${0.8*k})`;ctx.lineWidth=4;ctx.stroke();
      ctx.globalCompositeOperation='lighter';ctx.strokeStyle=f.col;ctx.globalAlpha=k*0.85;ctx.lineWidth=1.6;ctx.stroke();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;}}}
// Chain lightning: a wide soft glow, a bright channel and a white core, re-forking every frame, sparks at each jump.
function drawBolt(f,t){const k=1-t,P=f.pts;const jag=()=>{ctx.beginPath();for(let i=0;i<P.length;i++){const a=P[i];if(!i){ctx.moveTo(a.x,a.y);continue;}const b=P[i-1];for(let m=1;m<=5;m++){const u=m/5;ctx.lineTo(b.x+(a.x-b.x)*u+(m<5?fr(-11,11):0),b.y+(a.y-b.y)*u+(m<5?fr(-11,11):0));}}};
  ctx.globalCompositeOperation='lighter';ctx.lineJoin='round';jag();ctx.strokeStyle='rgba(120,180,255,1)';ctx.globalAlpha=0.28*k;ctx.lineWidth=12;ctx.stroke();ctx.globalAlpha=0.8*k;ctx.lineWidth=4;ctx.strokeStyle='#9fd0ff';ctx.stroke();
  jag();ctx.globalAlpha=k;ctx.lineWidth=1.6;ctx.strokeStyle='#ffffff';ctx.stroke();
  for(let i=1;i<P.length;i++){const W=18*k+6;ctx.globalAlpha=k;ctx.drawImage(sparkSprite('170,210,255'),P[i].x-W,P[i].y-W,W*2,W*2);}
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  if(!f.sparked){f.sparked=1;for(let i=1;i<P.length;i++)for(let n=0;n<5;n++){const a=fr(0,TAU),v=fr(80,220);part(P[i].x,P[i].y,Math.cos(a)*v,Math.sin(a)*v,fr(0.15,0.35),'#dff0ff',fr(1,2));}}}
// Frost: icicles bursting outward along the expanding ring.
function drawIceRing(f,t,R){const k=1-t;ctx.fillStyle=`rgba(225,245,255,${0.85*k})`;ctx.strokeStyle=`rgba(90,150,200,${0.7*k})`;ctx.lineWidth=1;
  for(let n=0;n<18;n++){const a=n/18*TAU+(n%2)*0.1,L=(n%3?10:18)*k+4;const x=f.x+Math.cos(a)*R,y=f.y+Math.sin(a)*R;ctx.beginPath();ctx.moveTo(x+Math.cos(a+1.57)*3,y+Math.sin(a+1.57)*3);ctx.lineTo(x+Math.cos(a)*L,y+Math.sin(a)*L);ctx.lineTo(x-Math.cos(a+1.57)*3,y-Math.sin(a+1.57)*3);ctx.closePath();ctx.fill();ctx.stroke();}}
// Meteor: the rock falls in from above during its marker, trailing fire.
function drawMeteorFall(f,t){const k=1-t,x=f.x-160*k,y=f.y-300*k,S=sparkSprite('255,150,50');ctx.globalCompositeOperation='lighter';
  for(let n=4;n>=1;n--){const W=(14-n*2)*(1+t);ctx.globalAlpha=0.5-n*0.08;ctx.drawImage(S,x+n*14-W,y+n*26-W,W*2,W*2);}ctx.globalAlpha=1;const W=18+10*t;ctx.drawImage(S,x-W,y-W,W*2,W*2);ctx.globalCompositeOperation='source-over';
  ctx.fillStyle='#2a1a12';ctx.beginPath();ctx.arc(x,y,6+4*t,0,TAU);ctx.fill();}
// Enemy telegraphs: always red/orange ground markers, a dark scorched fill that swells as the blow nears, a pulsing
// rim and a turning ring of dashes, so they read as danger whatever the attack's own colour.
function drawWarning(f,t){const pulse=0.75+0.25*Math.sin(G.time*14);
  if(f.type==='tele'){ctx.fillStyle=`rgba(120,20,8,${0.18+0.12*t})`;ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,TAU);ctx.fill();
    ctx.globalCompositeOperation='lighter';ctx.fillStyle=`rgba(255,70,20,${0.22*t})`;ctx.beginPath();ctx.arc(f.x,f.y,f.r*t,0,TAU);ctx.fill();
    ctx.strokeStyle=`rgba(255,110,40,${0.85*pulse})`;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,TAU);ctx.stroke();
    ctx.setLineDash([8,8]);ctx.lineDashOffset=-G.time*40;ctx.strokeStyle=`rgba(255,180,80,${0.6*pulse})`;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(f.x,f.y,f.r*0.8,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.globalCompositeOperation='source-over';}
  else{ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.a);ctx.fillStyle=`rgba(120,20,8,${0.2+0.12*t})`;ctx.fillRect(0,-f.w/2,f.len,f.w);
    ctx.globalCompositeOperation='lighter';ctx.fillStyle=`rgba(255,70,20,${0.25*t})`;ctx.fillRect(0,-f.w/2,f.len*t,f.w);ctx.strokeStyle=`rgba(255,110,40,${0.85*pulse})`;ctx.lineWidth=2;ctx.strokeRect(0,-f.w/2,f.len,f.w);
    ctx.fillStyle=`rgba(255,170,70,${0.5*pulse})`;for(let d=(G.time*120)%40;d<f.len-10;d+=40){ctx.beginPath();ctx.moveTo(d,-f.w*0.25);ctx.lineTo(d+10,0);ctx.lineTo(d,f.w*0.25);ctx.lineTo(d+4,0);ctx.closePath();ctx.fill();}
    ctx.restore();ctx.globalCompositeOperation='source-over';}}
