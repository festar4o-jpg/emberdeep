'use strict';
// Creature sprites: grounded, worn, top-down figures (facing +x), painted once per animation frame into small
// offscreen canvases and then only rotated and stamped each frame. Painters draw in world units around (0,0);
// the cache renders them at the screen's pixel density (cleared when that changes and on every new map).
// Shading is a dome (lit centre, dark rim) so it reads the same from any facing; muted earthy colours, grit
// speckles and dark outlines keep them gritty and readable against the dark.
const SPR_F=4;           // animation frames per creature (a walk / flap / sway cycle)
const SPR=new Map();let SPR_RS=0;
const sprClear=()=>SPR.clear();
function sprite(key,half,paint){const rs=Math.min(2,Math.max(1,DPR*Z));if(rs!==SPR_RS){SPR.clear();SPR_RS=rs;}
  let c=SPR.get(key);if(c)return c;if(SPR.size>360)SPR.clear();
  const px=Math.ceil(half*2*rs);c=mkCanvas(px,px);const x=c.getContext('2d');x.setTransform(rs,0,0,rs,px/2,px/2);x.lineJoin='round';x.lineCap='round';
  const R0=Math.random;let h=0;for(const ch of key)h=Math.imul(h^ch.charCodeAt(0),16777619);Math.random=artRng(h);try{paint(x);}finally{Math.random=R0;}
  c.half=half;SPR.set(key,c);return c;}
function blit(c,x,y,ang,alpha){ctx.save();ctx.translate(x,y);ctx.rotate(ang);if(alpha!=null)ctx.globalAlpha=alpha;ctx.drawImage(c,-c.half,-c.half,c.half*2,c.half*2);ctx.restore();}
// ---------- painting helpers (x = the sprite's 2d context) ----------
const OUT='rgba(8,5,3,.9)';
const swing=f=>Math.sin(f/SPR_F*TAU);
function path(x,pts){x.beginPath();pts.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath();}
// Fill the current path with a base colour and a dome shade (lit centre, dark rim), then outline it.
function shadeFill(x,cx,cy,rad,base,lw){x.fillStyle=base;x.fill();const g=x.createRadialGradient(cx+rad*0.12,cy,rad*0.05,cx,cy,rad*1.05);
  g.addColorStop(0,'rgba(255,240,215,.2)');g.addColorStop(0.5,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.6)');x.fillStyle=g;x.fill();
  if(lw!==0){x.strokeStyle=OUT;x.lineWidth=lw||1.3;x.stroke();}}
function oval(x,cx,cy,rx,ry,base,lw,rot){x.beginPath();x.ellipse(cx,cy,rx,ry,rot||0,0,TAU);shadeFill(x,cx,cy,Math.max(rx,ry),base,lw);}
function dot(x,cx,cy,r,col){x.fillStyle=col;x.beginPath();x.arc(cx,cy,r,0,TAU);x.fill();}
// Grit: dark and pale specks scattered over a round area.
function grit(x,cx,cy,rad,n,dark,lite){for(let k=0;k<n;k++){const a=rand(0,TAU),d=Math.sqrt(Math.random())*rad;x.fillStyle=Math.random()<0.7?(dark||'rgba(0,0,0,.3)'):(lite||'rgba(255,235,210,.12)');
  x.fillRect(cx+Math.cos(a)*d,cy+Math.sin(a)*d,rand(0.5,1.4),rand(0.5,1.4));}}
// Glowing eyes on the front of a head.
function eyes(x,hx,sp,sz,col){for(const s of [-1,1]){const g=x.createRadialGradient(hx,s*sp,0,hx,s*sp,sz*3);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(hx-sz*3,s*sp-sz*3,sz*6,sz*6);dot(x,hx,s*sp,sz,'#fff8e0');}}
// A walking humanoid seen from above: feet, arms, torso (shoulders), head. P: colours and shape tweaks.
function walker(x,r,f,P){const s=swing(f);
  for(const sd of [-1,1])oval(x,sd*s*r*0.38-r*0.05,sd*r*0.3,r*0.26,r*0.15,P.boot||'#2a2018',1);
  if(P.cape)P.cape(x,r,s);
  const arm=(sd)=>{const ax=(P.reach||0)*r-sd*s*r*0.22,ay=sd*r*(P.armY||0.86);oval(x,ax*0.55,ay,r*0.42,r*0.17,P.sleeve||P.torso,1.1);oval(x,ax,ay*(P.reach?0.9:1),r*0.17,r*0.16,P.hand||P.skin,1);if(P.claw)P.claw(x,ax,ay*(P.reach?0.9:1),r,sd);};
  if(P.arms!==false){arm(-1);arm(1);}
  oval(x,-r*0.06,0,r*(P.chest||0.5),r*(P.wide||0.9),P.torso,1.4);if(P.torsoDeco)P.torsoDeco(x,r,s);
  oval(x,r*(P.headX||0.16),0,r*(P.head||0.36),r*(P.head||0.36)*0.95,P.skinHead||P.skin,1.2);if(P.headDeco)P.headDeco(x,r,s);}
// ---------- creatures (key = ETYPES shape or type) ----------
const PAINT={};
// Ghoul: emaciated, hunched, long clawed arms reaching forward, spine ridges, pale sunken head.
PAINT.ghoul=(x,r,f)=>walker(x,r,f,{skin:'#7a7d66',torso:'#565b45',boot:'#2c2a20',reach:0.55,armY:0.72,chest:0.46,wide:0.78,head:0.3,headX:0.3,
  claw:(x,ax,ay,r,sd)=>{x.strokeStyle='#d8d0b8';x.lineWidth=1.2;x.beginPath();for(const k of [-1,0,1]){x.moveTo(ax+r*0.12,ay+k*r*0.08);x.lineTo(ax+r*0.32,ay+k*r*0.12+sd*r*0.04);}x.stroke();},
  torsoDeco:(x,r)=>{for(let k=0;k<5;k++)dot(x,-r*0.42+k*r*0.14,0,r*0.06,'rgba(220,210,180,.5)');x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=1;for(const sd of [-1,1])for(let k=0;k<3;k++){x.beginPath();x.arc(-r*0.1,0,r*(0.22+k*0.12),sd*0.9,sd*1.6,sd<0);x.stroke();}grit(x,0,0,r*0.6,26);},
  headDeco:(x,r)=>{dot(x,r*0.3,0,r*0.22,'rgba(0,0,0,.25)');eyes(x,r*0.48,r*0.11,r*0.05,'#c8ff60');}});
// Bone Archer: a skeleton from above, rib cage and spine, skull, a short bow held forward; rags on the shoulders.
PAINT.archer=(x,r,f)=>{const s=swing(f);
  for(const sd of [-1,1])oval(x,sd*s*r*0.38-r*0.05,sd*r*0.3,r*0.22,r*0.1,'#9a927c',1);
  x.fillStyle='#3a3026';path(x,[[-r*0.2,-r*0.9],[-r*0.75,-r*0.6+s*r*0.1],[-r*0.9,0],[-r*0.75,r*0.6-s*r*0.1],[-r*0.2,r*0.9]]);x.fill();
  x.strokeStyle='#b8b098';x.lineWidth=2.2;for(const sd of [-1,1]){x.beginPath();x.moveTo(0,sd*r*0.75);x.lineTo(r*0.45,sd*r*0.5);x.lineTo(r*0.85,sd*r*0.2);x.stroke();}
  x.strokeStyle='#6a5236';x.lineWidth=2;x.beginPath();x.arc(r*0.55,0,r*0.8,-0.85,0.85);x.stroke();x.strokeStyle='rgba(220,210,180,.6)';x.lineWidth=0.7;x.beginPath();x.moveTo(r*0.55+Math.cos(-0.85)*r*0.8,Math.sin(-0.85)*r*0.8);x.lineTo(r*0.85,0);x.lineTo(r*0.55+Math.cos(0.85)*r*0.8,Math.sin(0.85)*r*0.8);x.stroke();
  oval(x,-r*0.05,0,r*0.4,r*0.78,'#b3ab92',1.3);x.strokeStyle='rgba(30,22,14,.75)';x.lineWidth=1;for(let k=-2;k<=2;k++){x.beginPath();x.moveTo(-r*0.35,k*r*0.2);x.quadraticCurveTo(-r*0.05,k*r*0.26,r*0.25,k*r*0.2);x.stroke();}
  x.lineWidth=2;x.beginPath();x.moveTo(-r*0.42,0);x.lineTo(r*0.28,0);x.stroke();
  for(const sd of [-1,1]){x.fillStyle='rgba(60,48,36,.9)';path(x,[[-r*0.25,sd*r*0.5],[r*0.15,sd*r*0.88],[-r*0.1,sd*r*1.02],[-r*0.45,sd*r*0.75]]);x.fill();}
  oval(x,r*0.2,0,r*0.33,r*0.3,'#cfc6aa',1.2);dot(x,r*0.33,-r*0.12,r*0.08,'#120c08');dot(x,r*0.33,r*0.12,r*0.08,'#120c08');eyes(x,r*0.36,r*0.12,r*0.035,'#ff8a5a');};
// Ogre: hulking, hide wrap over one shoulder, small head pushed forward, a heavy club.
PAINT.ogre=(x,r,f)=>{walker(x,r,f,{skin:'#7d634d',torso:'#6b5240',sleeve:'#6e5442',boot:'#2a1e14',chest:0.6,wide:0.92,head:0.27,headX:0.4,armY:0.95,
  torsoDeco:(x,r)=>{x.fillStyle='#4a3a28';path(x,[[-r*0.5,-r*0.85],[r*0.25,-r*0.6],[r*0.15,r*0.2],[-r*0.55,r*0.1]]);x.fill();x.strokeStyle='rgba(0,0,0,.4)';x.lineWidth=1;x.stroke();
    x.strokeStyle='#2a1e12';x.lineWidth=1.6;x.beginPath();x.moveTo(-r*0.45,-r*0.55);x.lineTo(r*0.2,r*0.15);x.stroke();grit(x,0,0,r*0.75,40);
    for(let k=0;k<3;k++){x.strokeStyle='rgba(60,10,6,.55)';x.lineWidth=1;x.beginPath();const y=rand(0.25,0.7)*r;x.moveTo(-r*0.2,y);x.lineTo(r*0.15,y+rand(-3,3));x.stroke();}},
  headDeco:(x,r)=>{eyes(x,r*0.56,r*0.09,r*0.035,'#ffb040');x.fillStyle='#e8dcc0';for(const sd of [-1,1]){path(x,[[r*0.58,sd*r*0.06],[r*0.72,sd*r*0.18],[r*0.6,sd*r*0.14]]);x.fill();}}});
  const s=swing(f),hx=r*0.4+s*r*0.1,hy=r*0.95;x.save();x.translate(hx,hy);x.rotate(-0.5);oval(x,r*0.45,0,r*0.5,r*0.17,'#4a3624',1.2);oval(x,r*0.85,0,r*0.22,r*0.22,'#3c2c1e',1.2);
  for(let k=0;k<4;k++)dot(x,r*(0.75+k*0.07),(k%2?1:-1)*r*0.16,1.2,'#8a8580');x.restore();};
// Scarab: segmented oily shell, six legs in a scuttle cycle, mandibles.
PAINT.scarab=(x,r,f)=>{const s=swing(f);x.strokeStyle='#14100c';x.lineWidth=1.3;
  for(const sd of [-1,1])for(let k=-1;k<=1;k++){const w=(k===0?-s:s)*r*0.25;x.beginPath();x.moveTo(k*r*0.45,sd*r*0.4);x.lineTo(k*r*0.55+w,sd*r*0.95);x.lineTo(k*r*0.75+w,sd*r*1.15);x.stroke();}
  for(const sd of [-1,1]){x.beginPath();x.moveTo(r*1.05,sd*r*0.15);x.quadraticCurveTo(r*1.45,sd*r*0.3,r*1.4,sd*r*0.02);x.stroke();}
  oval(x,r*0.95,0,r*0.36,r*0.38,'#1e2426',1.1);
  x.beginPath();x.ellipse(-r*0.1,0,r*1.05,r*0.78,0,0,TAU);shadeFill(x,-r*0.1,0,r,'#2c3a3e',1.3);
  x.strokeStyle='rgba(0,0,0,.6)';x.lineWidth=1.1;x.beginPath();x.moveTo(-r*1.1,0);x.lineTo(r*0.7,0);x.stroke();
  x.fillStyle='rgba(160,200,190,.22)';for(const sd of [-1,1]){x.beginPath();x.ellipse(-r*0.1,sd*r*0.38,r*0.55,r*0.12,sd*0.15,0,TAU);x.fill();}
  x.fillStyle='rgba(220,190,120,.25)';x.fillRect(r*0.55,-r*0.6,1.2,r*1.2);grit(x,-r*0.1,0,r*0.8,14,'rgba(0,0,0,.35)','rgba(200,230,220,.12)');};
// Robed caster (Dust Mage, Ember Summoner): deep hood, draped robe trailing behind, hands forward around a light.
const robe=(col,trim,orb)=>(x,r,f)=>{const s=swing(f);
  x.fillStyle=col;path(x,[[r*0.2,-r*0.95],[-r*0.6,-r*1.0+s*r*0.08],[-r*1.25,-r*0.45],[-r*1.35+s*r*0.12,0],[-r*1.25,r*0.45],[-r*0.6,r*1.0-s*r*0.08],[r*0.2,r*0.95]]);shadeFill(x,-r*0.4,0,r*1.2,col,1.3);
  x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=1;for(const k of [-0.5,0,0.5]){x.beginPath();x.moveTo(-r*0.2,k*r);x.lineTo(-r*1.15,k*r*1.1);x.stroke();}
  x.strokeStyle=trim;x.lineWidth=1.4;x.beginPath();x.moveTo(r*0.2,-r*0.95);x.lineTo(-r*0.6,-r*1.0);x.moveTo(r*0.2,r*0.95);x.lineTo(-r*0.6,r*1.0);x.stroke();
  for(const sd of [-1,1]){oval(x,r*0.35,sd*r*0.62,r*0.4,r*0.2,col,1.1);oval(x,r*0.7,sd*r*0.4,r*0.13,r*0.12,'#8a7460',1);}
  oval(x,r*0.05,0,r*0.48,r*0.46,col,1.3);x.fillStyle='#07050a';x.beginPath();x.ellipse(r*0.28,0,r*0.22,r*0.26,0,0,TAU);x.fill();eyes(x,r*0.36,r*0.09,r*0.04,orb);grit(x,-r*0.4,0,r,30);};
PAINT.dustmage=robe('#6e5a3e','#a08a5a','#ffd890');
PAINT.summoner=robe('#4a2032','#8a5a3a','#ff5aa0');
// Sandworm: a ringed body undulating behind a round maw full of teeth.
PAINT.worm=(x,r,f)=>{const ph=f/SPR_F*TAU;
  for(let k=4;k>=1;k--){const cx=-k*r*0.62,cy=Math.sin(ph+k*1.1)*r*0.22,rr=r*(1-k*0.13);oval(x,cx,cy,rr,rr*0.95,k%2?'#7a6044':'#6a5038',1.2);
    x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=1;x.beginPath();x.arc(cx,cy,rr*0.7,-1.2,1.2);x.stroke();}
  oval(x,0,0,r,r,'#806548',1.4);grit(x,0,0,r*0.9,20);x.fillStyle='#1a0806';x.beginPath();x.arc(r*0.35,0,r*0.58,0,TAU);x.fill();
  x.fillStyle='#4a1410';x.beginPath();x.arc(r*0.35,0,r*0.36,0,TAU);x.fill();x.fillStyle='#d8ccb0';
  for(let ring=0;ring<2;ring++)for(let k=0;k<9;k++){const a=k/9*TAU+ring*0.35,R1=r*(0.58-ring*0.2),R2=R1-r*0.16;x.beginPath();x.moveTo(r*0.35+Math.cos(a-0.12)*R1,Math.sin(a-0.12)*R1);x.lineTo(r*0.35+Math.cos(a)*R2,Math.sin(a)*R2);x.lineTo(r*0.35+Math.cos(a+0.12)*R1,Math.sin(a+0.12)*R1);x.fill();}};
// Spore Toad: bloated, warty, pale spore sacs on its back, legs splayed; squashes while hopping (frame 2).
PAINT.toad=(x,r,f)=>{const sq=f===2?1.12:1;
  for(const sd of [-1,1]){oval(x,-r*0.55,sd*r*0.8,r*0.42,r*0.2,'#4e5430',1.1,sd*0.5);oval(x,r*0.55,sd*r*0.72,r*0.3,r*0.14,'#4e5430',1.1,-sd*0.6);}
  x.beginPath();x.ellipse(0,0,r*1.12*sq,r*0.95/sq,0,0,TAU);shadeFill(x,0,0,r*1.1,'#5d6236',1.4);grit(x,0,0,r*0.95,40,'rgba(0,0,0,.35)','rgba(220,230,160,.15)');
  for(const [a,b,c] of [[-0.45,0.35,0.24],[-0.5,-0.32,0.2],[0.05,-0.15,0.16],[-0.15,0.55,0.13],[-0.75,0,0.15]])oval(x,a*r,b*r,c*r,c*r,'#b8b07a',0.9);
  for(const sd of [-1,1]){oval(x,r*0.6,sd*r*0.42,r*0.22,r*0.22,'#5d6236',1);dot(x,r*0.66,sd*r*0.42,r*0.11,'#d8b030');dot(x,r*0.68,sd*r*0.42,r*0.05,'#140c04');}
  x.strokeStyle='rgba(0,0,0,.55)';x.lineWidth=1.2;x.beginPath();x.arc(r*0.55,0,r*0.42,-0.9,0.9);x.stroke();};
// Vine Lasher: a knot of roots and thorned leaves around a bulb that splits into a red maw; the tendrils sway.
PAINT.vine=(x,r,f)=>{const ph=f/SPR_F*TAU;x.strokeStyle='#241a10';x.lineWidth=3;
  for(let k=0;k<6;k++){const a=k/6*TAU+0.3,w=Math.sin(ph+k)*0.18;x.beginPath();x.moveTo(0,0);x.quadraticCurveTo(Math.cos(a+w)*r*0.9,Math.sin(a+w)*r*0.9,Math.cos(a-w)*r*1.6,Math.sin(a-w)*r*1.6);x.stroke();}
  for(let k=0;k<9;k++){const a=k/9*TAU+Math.sin(ph+k)*0.08;x.save();x.rotate(a);x.beginPath();x.moveTo(r*0.4,0);x.quadraticCurveTo(r*0.9,-r*0.28,r*1.35,0);x.quadraticCurveTo(r*0.9,r*0.28,r*0.4,0);shadeFill(x,r*0.85,0,r*0.5,k%2?'#2e4224':'#36482a',1);
    x.strokeStyle='rgba(0,0,0,.4)';x.lineWidth=0.8;x.beginPath();x.moveTo(r*0.45,0);x.lineTo(r*1.3,0);x.stroke();x.restore();}
  oval(x,0,0,r*0.72,r*0.72,'#4a3a28',1.3);grit(x,0,0,r*0.6,16);
  for(const sd of [-1,1]){x.fillStyle='#5a2a2a';path(x,[[0,0],[r*0.75,sd*r*0.55],[r*0.55,sd*r*0.05]]);shadeFill(x,r*0.4,sd*r*0.3,r*0.5,'#6a2a30',1);}
  x.fillStyle='#2a0608';path(x,[[r*0.05,0],[r*0.6,-r*0.12],[r*0.6,r*0.12]]);x.fill();x.fillStyle='#d8ccb0';for(let k=0;k<3;k++){x.fillRect(r*(0.2+k*0.13),-r*0.08,1,r*0.06);x.fillRect(r*(0.2+k*0.13),r*0.02,1,r*0.06);}};
// Marsh Troll: huge stooped body under a back of moss and mud, long knuckle-dragging arms, tusks.
PAINT.troll=(x,r,f)=>{walker(x,r,f,{skin:'#56644a',torso:'#4a5a3c',sleeve:'#4f5e40',boot:'#22261a',chest:0.62,wide:0.95,head:0.28,headX:0.42,reach:0.3,armY:1.0,
  torsoDeco:(x,r)=>{for(let k=0;k<9;k++)oval(x,rand(-0.55,0.15)*r,rand(-0.6,0.6)*r,rand(0.14,0.24)*r,rand(0.12,0.2)*r,Math.random()<0.5?'#2f4224':'#3a4a2a',0);grit(x,-r*0.2,0,r*0.7,40,'rgba(0,0,0,.35)','rgba(180,200,120,.15)');
    x.strokeStyle='rgba(30,40,20,.8)';x.lineWidth=1.2;for(let k=0;k<4;k++){x.beginPath();const y=rand(-0.6,0.6)*r;x.moveTo(-r*0.6,y);x.quadraticCurveTo(-r*0.9,y+rand(-4,4),-r*1.0,y+rand(-6,6));x.stroke();}},
  headDeco:(x,r)=>{eyes(x,r*0.58,r*0.09,r*0.035,'#ffb020');x.strokeStyle='#e0d6b8';x.lineWidth=2;for(const sd of [-1,1]){x.beginPath();x.moveTo(r*0.62,sd*r*0.1);x.quadraticCurveTo(r*0.8,sd*r*0.2,r*0.78,sd*r*0.32);x.stroke();}}});};
// Frost Wraith: a hooded shade dissolving into tatters behind it, cold light in the hood.
PAINT.wraith=(x,r,f)=>{const ph=f/SPR_F*TAU;
  for(let k=0;k<5;k++){const t=k/4,y=(1-2*t)*r*0.8,w=Math.sin(ph+k*1.3)*r*0.18;x.fillStyle=`rgba(140,175,210,${0.32-t*0.04})`;path(x,[[-r*0.2,y*0.6-r*0.18],[-r*1.7+w,y+w*0.4],[-r*0.2,y*0.6+r*0.18]]);x.fill();}
  x.globalAlpha=0.9;x.beginPath();x.moveTo(r*0.5,0);x.arc(0,0,r*0.95,-1.9,1.9);x.closePath();shadeFill(x,0,0,r,'#7d93ab',1.2);x.globalAlpha=1;
  for(const sd of [-1,1]){x.strokeStyle='rgba(200,225,250,.55)';x.lineWidth=1.6;x.beginPath();x.moveTo(r*0.1,sd*r*0.7);x.quadraticCurveTo(r*0.7,sd*r*0.85,r*0.95,sd*r*0.55);x.stroke();}
  oval(x,r*0.1,0,r*0.5,r*0.48,'#5d7088',1.2);x.fillStyle='#04070c';x.beginPath();x.ellipse(r*0.3,0,r*0.25,r*0.28,0,0,TAU);x.fill();eyes(x,r*0.38,r*0.1,r*0.045,'#7fe8ff');};
// Ice Golem: slabs of blue-grey ice and rock, faceted with crisp edges, heavy shoulders.
PAINT.golem=(x,r,f)=>{const s=swing(f);const slab=(pts,c)=>{path(x,pts);shadeFill(x,pts.reduce((a,p)=>a+p[0],0)/pts.length,pts.reduce((a,p)=>a+p[1],0)/pts.length,r*0.7,c,1.3);};
  for(const sd of [-1,1])slab([[sd*s*r*0.3-r*0.3,sd*r*0.15],[sd*s*r*0.3+r*0.15,sd*r*0.2],[sd*s*r*0.3+r*0.1,sd*r*0.5],[sd*s*r*0.3-r*0.35,sd*r*0.48]],'#3e4e5c');
  slab([[r*0.55,-r*0.5],[r*0.1,-r*0.95],[-r*0.6,-r*0.8],[-r*0.75,0],[-r*0.6,r*0.8],[r*0.1,r*0.95],[r*0.55,r*0.5]],'#5f7a90');
  for(const sd of [-1,1]){const ax=r*0.25-sd*s*r*0.15;slab([[ax+r*0.45,sd*r*0.85],[ax+r*0.1,sd*r*1.25],[ax-r*0.45,sd*r*1.15],[ax-r*0.35,sd*r*0.75]],'#6d8aa2');
    x.fillStyle='rgba(225,245,255,.7)';path(x,[[ax-r*0.1,sd*r*1.0],[ax+r*0.05,sd*r*1.42],[ax+r*0.2,sd*r*1.02]]);x.fill();}
  x.strokeStyle='rgba(230,248,255,.35)';x.lineWidth=1;x.beginPath();x.moveTo(r*0.1,-r*0.9);x.lineTo(-r*0.1,0);x.lineTo(r*0.1,r*0.9);x.moveTo(-r*0.1,0);x.lineTo(-r*0.7,0);x.stroke();
  grit(x,0,0,r*0.8,26,'rgba(10,20,30,.3)','rgba(230,248,255,.2)');slab([[r*0.7,-r*0.22],[r*0.35,-r*0.32],[r*0.25,0],[r*0.35,r*0.32],[r*0.7,r*0.22]],'#4e6478');eyes(x,r*0.58,r*0.13,r*0.04,'#7fe8ff');};
// Shardling: a cluster of jagged crystals (it spins as a whole; drawn live).
PAINT.shard=(x,r)=>{for(let k=0;k<7;k++){const a=k/7*TAU+0.3,L=r*rand(0.8,1.25);x.save();x.rotate(a);path(x,[[r*0.1,-r*0.36],[L*0.75,-r*0.18],[L,0],[L*0.75,r*0.18],[r*0.1,r*0.36]]);shadeFill(x,L*0.4,0,L*0.6,k%2?'#6a96b4':'#7fa8c4',1.1);
    x.fillStyle='rgba(235,250,255,.45)';path(x,[[r*0.1,-r*0.05],[L*0.85,0],[r*0.1,r*0.05]]);x.fill();x.restore();}
  oval(x,0,0,r*0.45,r*0.45,'#58809c',1.2);eyes(x,r*0.15,r*0.1,r*0.04,'#bff4ff');};
// Imp: a wiry little devil, leathery wings beating (frames), horns, barbed tail.
PAINT.imp=(x,r,f)=>{const fl=[0.1,0.45,0.1,-0.25][f];
  x.strokeStyle='#2a0c06';x.lineWidth=1.5;x.beginPath();x.moveTo(-r*0.5,0);x.quadraticCurveTo(-r*1.2,r*0.3,-r*1.6,-r*0.1);x.stroke();x.fillStyle='#2a0c06';path(x,[[-r*1.6,-r*0.1],[-r*1.85,-r*0.3],[-r*1.75,r*0.05]]);x.fill();
  for(const sd of [-1,1]){x.save();x.scale(1,sd);x.rotate(-fl);path(x,[[-r*0.1,r*0.35],[-r*0.6,r*1.75],[-r*0.9,r*1.2],[-r*1.2,r*1.4],[-r*0.9,r*0.6],[-r*0.5,r*0.4]]);shadeFill(x,-r*0.6,r*1,r,'#4a1a12',1.1);
    x.strokeStyle='rgba(0,0,0,.5)';x.lineWidth=0.8;x.beginPath();x.moveTo(-r*0.15,r*0.38);x.lineTo(-r*0.6,r*1.75);x.moveTo(-r*0.3,r*0.4);x.lineTo(-r*0.9,r*1.2);x.stroke();x.restore();}
  oval(x,0,0,r*0.62,r*0.6,'#8a2c1a',1.3);grit(x,0,0,r*0.5,12);oval(x,r*0.35,0,r*0.36,r*0.34,'#9a3420',1.1);
  x.fillStyle='#1a0a06';for(const sd of [-1,1]){path(x,[[r*0.3,sd*r*0.25],[r*0.05,sd*r*0.62],[r*0.45,sd*r*0.3]]);x.fill();}eyes(x,r*0.58,r*0.13,r*0.05,'#ffe040');};
// Magma Brute: a lumbering mass of black basalt plates split by glowing seams.
PAINT.magma=(x,r,f)=>{walker(x,r,f,{skin:'#2a1a14',torso:'#2e1c14',sleeve:'#2a1a12',boot:'#140c08',chest:0.62,wide:0.95,head:0.28,headX:0.4,armY:0.98,
  torsoDeco:(x,r)=>{x.strokeStyle='rgba(255,120,30,.95)';x.lineWidth=1.6;x.shadowColor='#ff6a1a';x.shadowBlur=4;x.beginPath();
    for(const [a,b,c,d] of [[-0.55,-0.3,0.05,0.2],[0.05,0.2,-0.2,0.7],[0.05,0.2,0.45,-0.35],[-0.55,-0.3,-0.3,-0.8],[-0.3,0.3,-0.6,0.6]]){x.moveTo(a*r,b*r);x.lineTo(c*r,d*r);}x.stroke();x.shadowBlur=0;
    grit(x,0,0,r*0.8,30,'rgba(0,0,0,.4)','rgba(255,140,60,.25)');},
  headDeco:(x,r)=>eyes(x,r*0.56,r*0.1,r*0.045,'#ffd040')});};
// Treasure thief: a hooded runner hauling a bulging sack of coin over one shoulder.
PAINT.thief=(x,r,f)=>{walker(x,r,f,{skin:'#9a8064',torso:'#3a3226',boot:'#1e1810',head:0.34,headX:0.2,
  cape:(x,r,s)=>{x.fillStyle='#2a241a';path(x,[[0,-r*0.8],[-r*1.0,-r*0.6+s*r*0.1],[-r*1.2,0],[-r*1.0,r*0.6-s*r*0.1],[0,r*0.8]]);x.fill();},
  headDeco:(x,r)=>{oval(x,r*0.12,0,r*0.38,r*0.36,'#2e281e',1);x.fillStyle='#060403';x.beginPath();x.ellipse(r*0.3,0,r*0.16,r*0.2,0,0,TAU);x.fill();eyes(x,r*0.36,r*0.07,r*0.03,'#ffe060');}});
  oval(x,-r*0.6,r*0.55,r*0.72,r*0.68,'#8a6a3a',1.3);x.strokeStyle='rgba(0,0,0,.45)';x.lineWidth=1;x.beginPath();x.moveTo(-r*0.2,r*0.2);x.lineTo(-r*0.4,r*0.4);x.stroke();
  for(const [a,b] of [[-0.8,0.3],[-0.5,0.75],[-0.9,0.8]])dot(x,a*r,b*r,1.8,'#e8c040');};
// ---------- bosses ----------
const BOSS_PAINT=[
  // Varrok the Hollow: a crypt lord in rusted plate and a torn cape, a bone crown, a long grave-blade
  (x,r,f)=>{walker(x,r,f,{skin:'#c8c0a4',torso:'#4a4c50',sleeve:'#55575a',boot:'#1c1c1e',chest:0.55,wide:0.92,head:0.3,headX:0.2,
    cape:(x,r,s)=>{x.fillStyle='#2a1a1e';path(x,[[r*0.1,-r*0.95],[-r*0.9,-r*1.05+s*r*0.1],[-r*1.45,-r*0.4],[-r*1.35,r*0.1],[-r*1.5,r*0.5],[-r*0.9,r*1.05-s*r*0.1],[r*0.1,r*0.95]]);shadeFill(x,-r*0.6,0,r*1.3,'#2e1c22',1.3);},
    torsoDeco:(x,r)=>{for(const sd of [-1,1])oval(x,-r*0.05,sd*r*0.7,r*0.32,r*0.24,'#6a6c70',1.1);x.strokeStyle='rgba(120,70,40,.4)';x.lineWidth=2;x.beginPath();x.moveTo(-r*0.3,-r*0.4);x.lineTo(r*0.2,r*0.3);x.stroke();grit(x,0,0,r*0.7,50,'rgba(60,30,10,.35)','rgba(220,220,230,.12)');},
    headDeco:(x,r)=>{x.fillStyle='#d8d0b0';for(let k=0;k<5;k++){const a=Math.PI*0.65+k/4*Math.PI*0.7;path(x,[[r*0.2+Math.cos(a-0.15)*r*0.26,Math.sin(a-0.15)*r*0.26],[r*0.2+Math.cos(a)*r*0.5,Math.sin(a)*r*0.5],[r*0.2+Math.cos(a+0.15)*r*0.26,Math.sin(a+0.15)*r*0.26]]);x.fill();}
      dot(x,r*0.34,-r*0.1,r*0.06,'#100c08');dot(x,r*0.34,r*0.1,r*0.06,'#100c08');eyes(x,r*0.36,r*0.1,r*0.03,'#9ad0ff');}});
    x.save();x.translate(r*0.35,r*0.85);x.rotate(-0.25);oval(x,r*0.9,0,r*0.85,r*0.08,'#8a8e92',1.1);x.fillStyle='#4a3a2a';x.fillRect(-r*0.1,-r*0.05,r*0.2,r*0.1);x.restore();},
  // The Ash Tyrant: a towering brute in scorched hide, iron chains wound round its arms, curled horns
  (x,r,f)=>{walker(x,r,f,{skin:'#6a5a4c',torso:'#5a4434',sleeve:'#5e4838',boot:'#1e140c',chest:0.62,wide:0.95,head:0.3,headX:0.38,
    torsoDeco:(x,r)=>{grit(x,0,0,r*0.8,60,'rgba(0,0,0,.35)','rgba(230,210,180,.15)');x.strokeStyle='#6a6660';x.lineWidth=2.4;x.setLineDash([3,2]);for(const sd of [-1,1]){x.beginPath();x.arc(-r*0.1,0,r*0.62,sd*0.6,sd*1.5,sd<0);x.stroke();}x.setLineDash([]);},
    headDeco:(x,r)=>{x.strokeStyle='#cbb894';x.lineWidth=r*0.09;for(const sd of [-1,1]){x.beginPath();x.moveTo(r*0.3,sd*r*0.18);x.quadraticCurveTo(r*0.1,sd*r*0.6,r*0.45,sd*r*0.62);x.stroke();}eyes(x,r*0.6,r*0.1,r*0.035,'#ffb040');}});},
  // Mother of Rot: a swollen mass of fungal flesh, sacs and feelers around a toothed maw
  (x,r,f)=>{const ph=f/SPR_F*TAU;x.strokeStyle='#3a4a20';x.lineWidth=r*0.07;for(let k=0;k<8;k++){const a=k/8*TAU,w=Math.sin(ph+k)*0.2;x.beginPath();x.moveTo(Math.cos(a)*r*0.7,Math.sin(a)*r*0.7);x.quadraticCurveTo(Math.cos(a+w)*r*1.25,Math.sin(a+w)*r*1.25,Math.cos(a-w)*r*1.55,Math.sin(a-w)*r*1.55);x.stroke();}
    oval(x,-r*0.1,0,r*1.0,r*0.95,'#4e5a2c',1.5);grit(x,0,0,r*0.9,80,'rgba(0,0,0,.35)','rgba(220,240,150,.15)');
    for(let k=0;k<9;k++){const a=rand(0,TAU),d=rand(0.2,0.75)*r;oval(x,Math.cos(a)*d-r*0.1,Math.sin(a)*d,r*rand(0.1,0.2),r*rand(0.1,0.18),'#9aa860',0.9);}
    x.fillStyle='#1a0c06';x.beginPath();x.ellipse(r*0.55,0,r*0.3,r*0.36,0,0,TAU);x.fill();x.fillStyle='#d8ccb0';for(let k=0;k<10;k++){const a=k/10*TAU;path(x,[[r*0.55+Math.cos(a-0.15)*r*0.3,Math.sin(a-0.15)*r*0.34],[r*0.55+Math.cos(a)*r*0.18,Math.sin(a)*r*0.2],[r*0.55+Math.cos(a+0.15)*r*0.3,Math.sin(a+0.15)*r*0.34]]);x.fill();}
    for(const [a,b] of [[0.2,-0.5],[0.25,0.5],[0.05,-0.25],[0.1,0.22]])eyes(x,a*r,b*r,r*0.03,'#d0ff60');},
  // Rimeheart, the Frozen King: frost-rimed plate, a long white cloak, a crown of ice spikes
  (x,r,f)=>{walker(x,r,f,{skin:'#9ab0c4',torso:'#5a6e82',sleeve:'#627890',boot:'#1c2430',chest:0.55,wide:0.92,head:0.3,headX:0.2,
    cape:(x,r,s)=>{path(x,[[r*0.1,-r*0.95],[-r*0.9,-r*1.1+s*r*0.1],[-r*1.5,-r*0.3],[-r*1.6,r*0.3],[-r*0.9,r*1.1-s*r*0.1],[r*0.1,r*0.95]]);shadeFill(x,-r*0.6,0,r*1.3,'#a8b4c0',1.3);},
    torsoDeco:(x,r)=>{for(const sd of [-1,1])oval(x,0,sd*r*0.68,r*0.32,r*0.24,'#7a90a6',1.1);x.strokeStyle='rgba(230,248,255,.4)';x.lineWidth=1;x.beginPath();x.moveTo(-r*0.4,0);x.lineTo(r*0.3,0);x.stroke();grit(x,0,0,r*0.7,40,'rgba(10,20,40,.3)','rgba(230,248,255,.25)');},
    headDeco:(x,r)=>{x.fillStyle='#dff4ff';for(let k=0;k<5;k++){const a=Math.PI*0.6+k/4*Math.PI*0.8,h=k===2?0.85:0.65;path(x,[[r*0.2+Math.cos(a-0.12)*r*0.26,Math.sin(a-0.12)*r*0.26],[r*0.2+Math.cos(a)*r*h,Math.sin(a)*r*h],[r*0.2+Math.cos(a+0.12)*r*0.26,Math.sin(a+0.12)*r*0.26]]);x.fill();x.strokeStyle='rgba(40,80,120,.6)';x.lineWidth=0.8;x.stroke();}
      eyes(x,r*0.38,r*0.1,r*0.035,'#5ae0ff');}});},
  // The Cinder King: blackened armour leaking fire at every joint, a crown of flame
  (x,r,f)=>{walker(x,r,f,{skin:'#2a1814',torso:'#2c1a16',sleeve:'#301c16',boot:'#120a08',chest:0.58,wide:0.94,head:0.3,headX:0.25,
    cape:(x,r,s)=>{path(x,[[r*0.1,-r*0.9],[-r*0.8,-r*1.0+s*r*0.1],[-r*1.4,-r*0.35],[-r*1.5,r*0.2],[-r*0.8,r*1.0-s*r*0.1],[r*0.1,r*0.9]]);shadeFill(x,-r*0.6,0,r*1.3,'#3a1208',1.3);
      x.strokeStyle='rgba(255,110,30,.7)';x.lineWidth=1.4;x.beginPath();x.moveTo(-r*1.4,-r*0.35);x.lineTo(-r*1.5,r*0.2);x.stroke();},
    torsoDeco:(x,r)=>{for(const sd of [-1,1])oval(x,0,sd*r*0.68,r*0.32,r*0.24,'#3a2620',1.1);x.strokeStyle='rgba(255,120,30,.9)';x.lineWidth=1.5;x.shadowColor='#ff6a1a';x.shadowBlur=5;x.beginPath();
      for(const [a,b,c,d] of [[-0.45,-0.5,0.2,0.1],[0.2,0.1,-0.3,0.6],[-0.1,-0.2,-0.5,0.2]]){x.moveTo(a*r,b*r);x.lineTo(c*r,d*r);}x.stroke();x.shadowBlur=0;},
    headDeco:(x,r)=>{for(let k=0;k<7;k++){const a=k/7*TAU,cx=r*0.25+Math.cos(a)*r*0.3,cy=Math.sin(a)*r*0.3;x.fillStyle='#ffb040';path(x,[[cx-Math.sin(a)*r*0.06,cy+Math.cos(a)*r*0.06],[cx+Math.cos(a)*r*0.2,cy+Math.sin(a)*r*0.2],[cx+Math.sin(a)*r*0.06,cy-Math.cos(a)*r*0.06]]);x.fill();
      x.fillStyle='#fff0b0';path(x,[[cx-Math.sin(a)*r*0.03,cy+Math.cos(a)*r*0.03],[cx+Math.cos(a)*r*0.11,cy+Math.sin(a)*r*0.11],[cx+Math.sin(a)*r*0.03,cy-Math.cos(a)*r*0.03]]);x.fill();}
      oval(x,r*0.25,0,r*0.27,r*0.26,'#1e1210',1);
      eyes(x,r*0.42,r*0.1,r*0.04,'#ffd040');}});}
];
// The ghoul is the default look for monster types without a painter of their own.
const SHAPE_PAINT={blob:'ghoul',archer:'archer',scarab:'scarab',worm:'worm',toad:'toad',vine:'vine',troll:'troll',wraith:'wraith',golem:'golem',shard:'shard',imp:'imp',magma:'magma',thief:'thief'};
function painterFor(e,T){if(e.type==='boss')return BOSS_PAINT[e.kind||0];if(T.shape==='robe')return PAINT[e.type]||PAINT.dustmage;if(e.type==='brute')return PAINT.ogre;return PAINT[SHAPE_PAINT[T.shape||'blob']];}
// Walk cycle frame from distance actually moved (stands still when the creature does).
function animFrame(o,stride){const dx=o.x-(o._ax??o.x),dy=o.y-(o._ay??o.y);o._ax=o.x;o._ay=o.y;o._ap=((o._ap||0)+Math.hypot(dx,dy)/stride)%SPR_F;return o._ap|0;}
function creatureSprite(e,T){const P=painterFor(e,T);if(!P)return null;const r=Math.round(e.r),f=T.shape==='shard'?0:T.shape==='imp'||T.shape==='wraith'||T.shape==='vine'||e.type==='boss'&&e.kind===2?((G.time*(T.shape==='imp'?14:4)+e.seed)|0)%SPR_F:animFrame(e,Math.max(8,r*0.7));
  return sprite(`${e.type}|${e.kind||0}|${r}|${f}`,r*(T.shape==='worm'?3.3:2.25),x=>P(x,r,f));}
// ---------- the player ----------
const HERO={
  warden:(x,r,f)=>walker(x,r,f,{skin:'#b89070',torso:'#55524c',sleeve:'#4a4640',hand:'#5e5a54',boot:'#241a12',chest:0.52,wide:0.92,head:0.36,headX:0.12,arms:false,
    cape:(x,r,s)=>{path(x,[[r*0.05,-r*0.85],[-r*0.8,-r*0.95+s*r*0.08],[-r*1.25,-r*0.4],[-r*1.3,r*0.1],[-r*1.2,r*0.45],[-r*0.8,r*0.95-s*r*0.08],[r*0.05,r*0.85]]);shadeFill(x,-r*0.5,0,r*1.2,'#4a1e1a',1.3);
      x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=1;for(const k of [-0.45,0,0.45]){x.beginPath();x.moveTo(-r*0.3,k*r);x.lineTo(-r*1.2,k*r*1.1);x.stroke();}},
    torsoDeco:(x,r)=>{x.fillStyle='rgba(0,0,0,.18)';for(let i=-3;i<=3;i++)for(let j=-6;j<=6;j++)if((i+j)%2===0){const px=i*r*0.13-r*0.06,py=j*r*0.13;if(px*px/(r*0.5)**2+py*py/(r*0.9)**2<0.85)x.fillRect(px,py,1.1,1.1);}
      x.fillStyle='#3a2a1a';x.fillRect(-r*0.12,-r*0.8,r*0.1,r*1.6);dot(x,-r*0.07,0,r*0.07,'#9a8452');
      for(const sd of [-1,1]){oval(x,-r*0.02,sd*r*0.72,r*0.36,r*0.28,'#706c66',1.2);x.strokeStyle='rgba(255,245,230,.25)';x.lineWidth=0.8;x.beginPath();x.arc(-r*0.02,sd*r*0.72,r*0.22,sd>0?-0.6:2.6,sd>0?0.6:3.7);x.stroke();}
      grit(x,0,0,r*0.8,40,'rgba(0,0,0,.3)','rgba(240,235,225,.12)');},
    headDeco:(x,r)=>{oval(x,r*0.12,0,r*0.36,r*0.34,'#6a6660',1.2);x.fillStyle='#0a0806';x.fillRect(r*0.36,-r*0.18,r*0.08,r*0.36);x.strokeStyle='rgba(255,245,230,.3)';x.lineWidth=0.8;x.beginPath();x.moveTo(-r*0.15,0);x.lineTo(r*0.4,0);x.stroke();}}),
  arcanist:(x,r,f)=>walker(x,r,f,{skin:'#a88a70',torso:'#3c2c40',sleeve:'#3a2a3e',hand:'#a88a70',boot:'#1e1620',chest:0.5,wide:0.88,head:0.36,headX:0.1,arms:false,
    cape:(x,r,s)=>{path(x,[[r*0.1,-r*0.9],[-r*0.8,-r*1.0+s*r*0.1],[-r*1.35,-r*0.4],[-r*1.45+s*r*0.1,0],[-r*1.35,r*0.4],[-r*0.8,r*1.0-s*r*0.1],[r*0.1,r*0.9]]);shadeFill(x,-r*0.5,0,r*1.3,'#2a1e30',1.3);
      x.strokeStyle='#7a6440';x.lineWidth=1.2;x.beginPath();x.moveTo(-r*1.35,-r*0.4);x.lineTo(-r*1.45,0);x.lineTo(-r*1.35,r*0.4);x.stroke();},
    torsoDeco:(x,r)=>{x.strokeStyle='#7a6440';x.lineWidth=1.3;for(const sd of [-1,1]){x.beginPath();x.arc(-r*0.06,0,r*0.55,sd*0.9,sd*1.7,sd<0);x.stroke();}x.fillStyle='#2a1e14';x.fillRect(-r*0.12,-r*0.75,r*0.09,r*1.5);grit(x,0,0,r*0.8,30);},
    headDeco:(x,r)=>{oval(x,r*0.06,0,r*0.4,r*0.38,'#33263a',1.2);x.fillStyle='#08060a';x.beginPath();x.ellipse(r*0.28,0,r*0.17,r*0.22,0,0,TAU);x.fill();dot(x,r*0.32,0,r*0.1,'rgba(168,138,112,.55)');}})};
function heroSprite(cls,r,f){return sprite(`hero|${cls}|${Math.round(r)}|${f}`,r*2,x=>HERO[cls](x,r,f));}
