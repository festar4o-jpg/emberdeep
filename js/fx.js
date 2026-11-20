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
  for(const q of G.proj){const S=sparkSprite(rgbOf(q.col)),R=q.r*3.2;
    for(let k=3;k>=1;k--){const r=R*(1-k*0.2);ctx.globalAlpha=0.35-k*0.07;ctx.drawImage(S,q.x-q.vx*0.014*k-r,q.y-q.vy*0.014*k-r,r*2,r*2);}
    ctx.globalAlpha=1;ctx.drawImage(S,q.x-R,q.y-R,R*2,R*2);}
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;}
// Particles: dull ones as small dark flecks, hot ones as additive sparks.
function drawParticles(){const P=G.parts;if(!P.length)return;
  for(const q of P){if(isHot(q.col))continue;ctx.globalAlpha=Math.max(0,q.life/q.max);ctx.fillStyle=q.col;ctx.fillRect(q.x-q.s/2,q.y-q.s/2,q.s,q.s);}
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
// ---------- dungeon air ----------
// A few dozen motes drift through the light: dust in the crypts and wastes, spores in the marsh, snow in the
// citadel, embers in the core. Screen-space and wrapped, so they cost the same anywhere on the map.
const AIR={crypt:['200,200,210',0.25,-4,6,1.4],desert:['220,190,140',0.3,14,4,1.5],marsh:['170,220,110',0.35,-3,-6,1.6],citadel:['235,245,255',0.55,-6,22,1.8],ember:['255,130,40',0.8,4,-26,1.6]};
let airT=0;const airP=[],airRnd=artRng(9137); // its own random numbers: drawing never shifts gameplay rolls
function drawAir(){if(G.inTown||!G.p)return;const A=AIR[ACTS[actIdx(G.depth)].gen];if(!A)return;const dt=Math.min(0.05,Math.max(0,G.time-airT));airT=G.time;
  const w=CW/Z,h=CH/Z,x0=G.cam.x-w/2,y0=G.cam.y-h/2,N=36;
  while(airP.length<N)airP.push({x:airRnd()*w,y:airRnd()*h,s:0.5+airRnd(),p:airRnd()*TAU});
  const S=sparkSprite(A[0]);ctx.globalCompositeOperation='lighter';
  for(const m of airP){m.x=(m.x+(A[2]+Math.sin(G.time*0.7+m.p)*5)*m.s*dt+w)%w;m.y=(m.y+A[3]*m.s*dt+h)%h;
    const r=A[4]*m.s*2.4;ctx.globalAlpha=A[1]*(0.5+0.5*Math.sin(G.time*1.3+m.p));ctx.drawImage(S,x0+m.x-r,y0+m.y-r,r*2,r*2);}
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;}
